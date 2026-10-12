/**
 * Derive's own agent loop.
 *
 * The Claude and Codex drivers borrow somebody else's loop: the host CLI
 * decides when to call the model again, runs the tools and hands back a
 * transcript. On an API key there is no such host, so this module is the loop
 * — one `streamText` per turn, bounded by a step cap, with the fourteen tutor
 * tools wired straight to `actions.ts`. Everything a learner is shown still
 * goes through the same `EventSink` as every other driver, so no event type,
 * no reducer branch and no terminal mirror changes because a turn ran here.
 *
 * Two shapes in here are deliberate and easy to undo by accident. The turn's
 * history is accumulated as `fullStream` yields parts rather than asked of the
 * SDK at the end, because `result.responseMessages` rejects after an abort —
 * which is exactly the moment the history matters most. And every tool's
 * `execute` enters a per-lesson promise chain, because the SDK runs a step's
 * tool calls with `Promise.all` and offers no option to change it: a provider
 * flag turns parallel calls off where one exists, and on Gemini there is none,
 * so the chain is the only thing standing between the learner and two cards
 * opening at once.
 *
 * Like every driver it reads its inputs off `ctx` and reports through `sink`;
 * it reads no environment of its own, because `config.ts` is the one module
 * that reads `process.env`.
 */
import { randomUUID } from 'node:crypto';
import { APICallError, isStepCount, jsonSchema, streamText, tool, type JSONSchema7, type LanguageModel, type LanguageModelUsage, type ModelMessage, type ToolSet } from 'ai';
import * as actions from '../actions.js';
import { headroomCheck } from '../context.js';
import { getSetting, loadTurnMessages, recordToolResult, recordedToolResult, saveTurnMessages, type UsageInput } from '../db.js';
import { type Driver, type EventSink, type TurnContext } from '../driver.js';
import { priceTable } from '../prices.js';
import { hintFor, providerSentence } from '../probe.js';
import { labelOf, type ProviderId } from '../providers.js';
import { safeMessage } from '../secrets.js';
import { baseUrlKey, currentTutor, effectiveKey } from '../settings.js';
import { TOOL_LABELS, descriptionFor, jsonSchemaOf, toolsFor, validateToolInput, type ToolDialect } from '../tools.js';
import { adapterFor, nativeSearch, searchCountOf, searchMode, type CostRead } from './adapters.js';

/** How the suite hands this loop a model with no network behind it. The provider id is passed through so a stub can still behave per provider. */
export type ModelFactory = (provider: ProviderId, modelId: string | null) => LanguageModel;

/**
 * A model built in place of the one the adapter table would build. It exists
 * for `server/test/api-driver.test.ts`, in the same spirit as `driver.ts`'s
 * `setDriverOverride`: no route, header, environment variable or config file
 * can set it, and the production path still reads the adapter table. It is
 * what lets a stub `LanguageModel` drive the *real* loop rather than replace
 * it.
 */
let modelFactory: ModelFactory | null = null;

export function setModelOverride(factory: ModelFactory | null) {
  modelFactory = factory;
}

export function modelOverride(): ModelFactory | null {
  return modelFactory;
}

/**
 * How many model calls one turn may make.
 *
 * 400 mirrors the Claude driver's `maxTurns: 400` so no existing lesson behaves
 * differently. It is a runaway guard, not a teaching limit: reaching it ends
 * the turn through the normal `turn_end` with the same continuable shape a Stop
 * produces, so the learner's next message carries the lesson on.
 */
export const STEP_CAP = 400;

/**
 * A lower cap, for the suite. Same spirit as `setModelOverride` and
 * `driver.ts`'s `setDriverOverride`: no route, header, environment variable or
 * config file can set it, and the production path still runs on `STEP_CAP`. It
 * exists because the only honest way to assert the cap's own branch is to reach
 * it, and scripting four hundred stub steps asserts the stub.
 */
let capOverride: number | null = null;

export function setStepCapOverride(n: number | null) {
  capOverride = n;
}

const stepCap = () => capOverride ?? STEP_CAP;

/**
 * How long the loop is willing to wait out a busy provider, in total.
 *
 * Two minutes, because a free-tier Gemini or OpenRouter rate limit can be a
 * full minute and a lesson that dies on it is a dead lesson; a learner who does
 * not want to wait presses Stop, which works throughout.
 */
export const RETRY_WINDOW_MS = 120_000;

/** The first backoff interval, doubled on each further attempt. One second is short enough that a single hiccup costs the learner nothing they would notice. */
export const RETRY_BASE_MS = 1_000;

/**
 * How the loop waits between attempts.
 *
 * Overridable for the suite only, in the same posture as `setModelOverride` and
 * `driver.ts`'s `setDriverOverride`: no route, header, environment variable or
 * config file can set it, and the production path still sleeps for real. It
 * exists because the only honest way to assert the exhaustion branch is to reach
 * it, and reaching it on the real clock would mean a two-minute test.
 */
const realSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
let sleepFor: (ms: number) => Promise<void> = realSleep;

export function setSleepOverride(f: ((ms: number) => Promise<void>) | null) {
  sleepFor = f ?? realSleep;
}

/**
 * What the provider asked us to wait, in milliseconds, or null when it asked
 * for nothing.
 *
 * `retry-after-ms` is read before `retry-after` because it is the precise one
 * where a provider sends it; `retry-after` is a seconds count or an HTTP date.
 * The value is honoured as given and is deliberately **not** capped at 60 s —
 * the SDK's own retry caps it there, which is exactly why `maxRetries: 0` turns
 * that retry off: a provider that says "ninety seconds" means ninety seconds.
 */
export function retryAfterMs(e: unknown): number | null {
  if (!APICallError.isInstance(e)) return null;
  const headers = e.responseHeaders;
  const exact = Number(headers?.['retry-after-ms']);
  if (Number.isFinite(exact) && exact >= 0 && headers?.['retry-after-ms'] !== undefined) return exact;
  const after = headers?.['retry-after'];
  if (after === undefined) return null;
  const seconds = Number(after);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const at = Date.parse(after);
  if (Number.isFinite(at)) return Math.max(0, at - Date.now());
  return null;
}

/**
 * How long to wait before attempt `attempt + 1`, given what the provider asked
 * for and how much of the window has already been spent.
 *
 * Exponential from `RETRY_BASE_MS` with jitter over the same interval, so two
 * lessons that hit one provider's limit together do not retry in lockstep and
 * re-trip it. Every delay is clamped against what is left of
 * `RETRY_WINDOW_MS`, so the cumulative wait can never exceed it; a return of 0
 * means the window is used up and the caller should stop retrying.
 */
export function retryDelay(attempt: number, afterMs: number | null, spent = 0): number {
  // A header of zero falls through to the backoff rather than being honoured:
  // "retry immediately" from a provider that just said it was busy is how a
  // rate limit becomes a tight loop hammering the same endpoint.
  const wanted = afterMs !== null && afterMs > 0 ? afterMs : RETRY_BASE_MS * 2 ** attempt * (1 + Math.random());
  return Math.max(0, Math.min(Math.round(wanted), RETRY_WINDOW_MS - spent));
}

/** Whether a failure is one a provider would answer differently a moment later. `isRetryable` is the SDK's own judgement where it has one; 429 and 5xx are the shapes that mean "busy" where it does not. */
function retryable(e: unknown): boolean {
  if (!APICallError.isInstance(e)) return false;
  if (typeof e.isRetryable === 'boolean') return e.isRetryable;
  const status = e.statusCode ?? 0;
  return status === 429 || (status >= 500 && status < 600);
}

/** Wait, but no longer than the learner's patience: the sleep races the turn's abort signal, so a Stop during a backoff is instant rather than up to a second late. */
async function waitOrStop(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return;
  let onAbort: (() => void) | undefined;
  const stopped = new Promise<void>((resolve) => {
    onAbort = () => resolve();
    signal.addEventListener('abort', onAbort, { once: true });
  });
  try {
    await Promise.race([sleepFor(ms), stopped]);
  } finally {
    if (onAbort) signal.removeEventListener('abort', onAbort);
  }
}

/**
 * Run one attempt, and keep running it while the provider says it is busy.
 *
 * Derive owns this backoff rather than letting the SDK own it, because the SDK's
 * retry cannot show the learner a countdown, cannot honour a `Retry-After`
 * longer than a minute and cannot be stopped mid-wait — and a silent two-minute
 * stall with no visible reason is the worst of the three failures this guards
 * against.
 *
 * What the learner sees is one ephemeral `status` line, the same event
 * `Thinking` and the tool labels ride: `Provider busy, retrying in Ns` while the
 * backoff runs and `Provider busy, retrying now` while an attempt is in flight.
 * There is no attempt counter — `attempt 3 of 6` is machinery the learner cannot
 * act on.
 *
 * `gate` carries the two things the wait needs and `TurnContext` does not have:
 * the provider's own label, for the fix hint an exhausted retry ends with, and
 * the turn's abort signal, so the sleep can be raced against a Stop.
 */
export async function withRetries(run: () => Promise<void>, sink: EventSink, ctx: TurnContext, gate: { label: string; signal: AbortSignal }): Promise<void> {
  // The window bounds how long the loop *waits*, summed from the delays it
  // chose, rather than how long the whole sequence took on the wall clock. A
  // provider that takes thirty seconds to answer each attempt is slow, not busy,
  // and charging its own latency against the learner's patience would cut the
  // retries short for the wrong reason. Everything that is not waiting is bounded
  // by the step cap and by Stop.
  let waited = 0;
  for (let attempt = 0; ; attempt += 1) {
    if (ctx.isStopping()) return;
    try {
      await run();
      return;
    } catch (e) {
      // A Stop is not a provider failure: the learner asked for this ending.
      if (ctx.isStopping()) return;
      if (!retryable(e)) throw e;
      const delay = retryDelay(attempt, retryAfterMs(e), waited);
      waited += delay;
      if (delay <= 0) {
        // The window ran out. The provider's own words reach the learner
        // unchanged, with Derive's fix hint on its own line beside them — the
        // same pair the settings page already shows, never a paraphrase that
        // loses what the provider actually said.
        const status = APICallError.isInstance(e) ? e.statusCode ?? 0 : 0;
        const body = (APICallError.isInstance(e) ? e.responseBody : null) ?? safeMessage(e);
        const sentence = providerSentence(status, body);
        const hint = hintFor(gate.label, status, sentence);
        sink.endTurn({ ok: false, error: safeMessage(hint ? `${sentence}\n${hint}` : sentence) });
        throw e;
      }
      // One tick per whole second of the delay, counted down rather than read
      // off the clock, so the line the learner reads and the time actually
      // waited are the same number however long a tick takes to come back.
      for (let left = delay; left > 0; left -= 1_000) {
        sink.emitEphemeral('status', { text: `Provider busy, retrying in ${Math.ceil(left / 1000)}s` });
        await waitOrStop(Math.min(1_000, left), gate.signal);
        if (ctx.isStopping()) return;
      }
      if (ctx.isStopping()) return;
      sink.emitEphemeral('status', { text: 'Provider busy, retrying now' });
    }
  }
}

/** What the model is told about a tool call the learner's Stop cut short. */
const STOPPED_BEFORE_TOOL = 'The learner stopped the turn before this tool ran.';

/** The output half of a `ToolResultPart`, read off `ModelMessage` rather than imported: `@ai-sdk/provider-utils` declares it but is not a direct dependency of this package. */
type ToolResultOutput = Extract<Extract<ModelMessage, { role: 'tool' }>['content'][number], { type: 'tool-result' }>['output'];

/** The roles a lesson's history keeps. A system message is never one of them: the method text is rebuilt from `method/` every turn and rides `instructions`, so a persisted one would be stale method text. */
const PERSISTED_ROLES = new Set(['assistant', 'tool', 'user']);

/** Every tool call id the history already carries a result for, whichever message it sits on. */
function answeredIds(messages: ModelMessage[]): Set<string> {
  const ids = new Set<string>();
  for (const m of messages) {
    if (!Array.isArray(m.content)) continue;
    for (const part of m.content) if (part.type === 'tool-result') ids.add(part.toolCallId);
  }
  return ids;
}

/** Every tool call id the history already asks for. A provider that retries re-sends an id, and a history asking for one call twice is one a provider may refuse. */
function calledIds(messages: ModelMessage[]): Set<string> {
  const ids = new Set<string>();
  for (const m of messages) {
    if (m.role !== 'assistant' || !Array.isArray(m.content)) continue;
    for (const part of m.content) if (part.type === 'tool-call') ids.add(part.toolCallId);
  }
  return ids;
}

/**
 * Give every tool call an abort left unanswered a synthesized error result.
 *
 * A provider refuses a request whose history asks for a tool call and never
 * answers it, so without this the turn the learner stopped would be the last
 * one the lesson could ever run. `error-text` is the purpose-built
 * `ToolResultOutput` shape and every provider adapter maps it to its own
 * error-result encoding.
 *
 * Idempotent, so it can run on the abort part, in the catch and again in the
 * finally without inventing a second result for the same call. Returns how many
 * it answered.
 *
 * `answered` is the live set the turn keeps, passed in so the patch and a tool
 * still returning cannot both answer the same call: a Stop lands while a card
 * is open, and whichever of the two gets there first is the one result the
 * history carries. The default makes it standalone, which is how it is tested.
 */
export function patchOrphans(messages: ModelMessage[], answered: Set<string> = answeredIds(messages)): number {
  const orphans: { toolCallId: string; toolName: string }[] = [];
  for (const m of messages) {
    if (m.role !== 'assistant' || !Array.isArray(m.content)) continue;
    for (const part of m.content) {
      if (part.type !== 'tool-call' || answered.has(part.toolCallId)) continue;
      answered.add(part.toolCallId);
      orphans.push({ toolCallId: part.toolCallId, toolName: part.toolName });
    }
  }
  for (const o of orphans) {
    messages.push({ role: 'tool', content: [{ type: 'tool-result', toolCallId: o.toolCallId, toolName: o.toolName, output: { type: 'error-text', value: STOPPED_BEFORE_TOOL } }] });
  }
  return orphans.length;
}

/**
 * The tool calls of one lesson, run one at a time.
 *
 * A step's tool calls arrive together and the SDK executes them with
 * `Promise.all`; Derive's cards block on the learner, so a second `execute`
 * starting before the first returns would open two cards at once. Each call
 * chains onto the lesson's previous one and the chain stores a swallowed copy,
 * so one failing tool does not poison every call after it.
 */
const chains = new Map<string, Promise<unknown>>();

function serialise<T>(lessonId: string, f: () => Promise<T>): Promise<T> {
  const prev = chains.get(lessonId) ?? Promise.resolve();
  const next = prev.then(f);
  chains.set(lessonId, next.catch(() => undefined));
  return next;
}

/** A number the provider actually reported, or null. Anything else — undefined, NaN — is a count nobody gave us, and stays blank. */
const reported = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * The warning that means the model was handed a search tool and *no* Derive
 * tools at all.
 *
 * `@ai-sdk/google`'s `prepareTools` discards every function declaration when a
 * provider-defined tool is present on a model it does not treat as Gemini 3,
 * and pushes this one warning instead. There is no exception and no 400: the
 * tutor simply talks and never draws a graph, which is not a Derive lesson.
 */
const DROPS_THE_TOOLS = /combination of function and provider-defined tools/i;

/** What the learner is told when that happens. Lowercase like every Derive sentence, and it names the next step rather than the library that did it. */
const NO_TOOLS_WITH_SEARCH = "this model cannot use derive's tools and a web search tool together; pick a newer model, or set web search to tavily or searxng in settings";

/**
 * Every tool of the owned loop's own surface, as the SDK takes them: the
 * registry's description, a pre-projected JSON Schema, and an execute that
 * replays, dispatches and records.
 *
 * The surface is `api`, which carries the fourteen tutor tools plus Derive's
 * own `fetch_page` and `web_search`, and declares no `per_surface` entry for
 * any of the fourteen — the loop reads the registry's own description and
 * shape, which is what makes parity with the Claude agent surface structural
 * rather than asserted.
 *
 * `omit` is how the search decision reaches here: the fallback `web_search` row
 * is left out when the provider has a native search tool of its own, or when
 * there is no search to be had at all.
 *
 * `dialect` is the provider's own schema dialect, from its adapter row. It
 * changes only what the provider is *shown* — what the server accepts is the
 * full schema, re-checked below on every call.
 *
 * `answer` is how a result reaches the turn's history. It is called from inside
 * the mutex in the same step as the record, so the replay guard and the history
 * can never disagree about whether a call ran.
 */
function buildTools(
  ctx: TurnContext,
  sink: EventSink,
  answer: (toolCallId: string, toolName: string, output: ToolResultOutput) => void,
  omit: ReadonlySet<string>,
  dialect: ToolDialect,
): ToolSet {
  const set: ToolSet = {};
  for (const spec of toolsFor('api')) {
    if (omit.has(spec.name)) continue;
    set[spec.name] = tool({
      description: descriptionFor(spec, 'api', dialect),
      // The projected schema, never the zod schema: handed a zod schema the SDK
      // runs its own conversion and emits draft-07, where `jsonSchemaOf` emits
      // draft-2020-12, so the bytes on the wire would stop matching
      // server/test/wire-surface.json.
      inputSchema: jsonSchema<Record<string, unknown>>(jsonSchemaOf(spec, 'api', dialect) as JSONSchema7),
      execute: async (input: Record<string, unknown>, { toolCallId }) =>
        serialise(ctx.lessonId, async () => {
          // D-07's replay guard, inside the mutex and before anything else.
          // This is the only version under which resuming cannot re-grade a
          // quiz, and a re-graded quiz moves an FSRS row the learner already
          // earned — a change to their memory record made by a crash rather
          // than by them.
          const recorded = recordedToolResult(ctx.turnId, toolCallId);
          if (recorded) {
            answer(toolCallId, spec.name, { type: 'json', value: recorded.output as never });
            return recorded.output;
          }
          // Against the full schema, never the dialect the provider was shown:
          // a bound the strict projection had to drop or the Gemini projection
          // could not express is still enforced here, before anything writes to
          // the learner's record. A throw reaches the model as a tool error it
          // can correct from, which is the right shape — a malformed call is the
          // model's mistake to fix, not a turn to fail. After the replay guard,
          // so a call that already succeeded is not re-validated.
          const args = validateToolInput(spec, 'api', input);
          sink.emitEphemeral('status', { text: TOOL_LABELS[spec.name] ?? `Using ${spec.name}` });
          const out = await actions.runTool(ctx.lessonId, spec.name, args);
          recordToolResult(ctx.turnId, ctx.lessonId, toolCallId, spec.name, out);
          answer(toolCallId, spec.name, { type: 'json', value: out as never });
          return out;
        }),
    });
  }
  return set;
}

/** One lesson turn on an API key, through Derive's own loop. */
async function runTurn(provider: ProviderId, ctx: TurnContext, sink: EventSink) {
  const key = effectiveKey(provider);
  const base = getSetting(baseUrlKey(provider)) ?? undefined;
  const asked = ctx.model ?? null;
  const adapter = adapterFor(provider);
  const model = modelOverride()?.(provider, asked) ?? adapter.model(key, base, asked);

  // Registered before the request, so Stop works from the first millisecond of
  // a turn rather than only once the provider has answered.
  const controller = new AbortController();
  ctx.onActive({ interrupt: async () => controller.abort() });

  // Exactly one search source for the turn, decided before the request.
  //
  // A provider with a server-side search tool is handed its own and Derive's
  // `web_search` row is left out; a provider without one gets the row where the
  // learner configured a fallback and nothing where they did not. Never both:
  // a tutor offered two ways to search in one turn will use both, and the
  // method text it reads is rendered from `searchMode`, the same decision.
  // `fetch_page` is registered on every provider — it is one implementation
  // behind one guard and does not depend on a search being available.
  const searchTool = searchCountOf(provider);
  const native = nativeSearch(provider, asked);
  const omit: ReadonlySet<string> = searchMode(provider, asked) === 'fallback' ? new Set() : new Set(['web_search']);
  const names = [...toolsFor('api').map((s) => s.name).filter((n) => !omit.has(n)), ...(native && searchTool ? [searchTool] : [])];
  // The lesson's own history, loaded before the request so an interrupted turn
  // costs a turn rather than the lesson. loadTurnMessages answers with nothing
  // when the stored driver is not this one, so D-04's drop on a provider change
  // needs no branch here.
  const prior = loadTurnMessages(ctx.lessonId, provider) as ModelMessage[];

  // Before the request, never after it: waiting for the provider to say no means
  // five error shapes to recognise, a wasted request each time, and an
  // unrecognised wording reaching the learner raw at the moment they most need a
  // sentence that names the next step. The estimate is over the instructions,
  // the serialised history and the prompt because those are the three things the
  // request will carry; measuring the serialised history rather than its prose
  // over-counts by the JSON envelope, which is the direction this estimate is
  // meant to be wrong in.
  const headroom = headroomCheck({ provider, model: ctx.model ?? null, instructions: ctx.instructions, messages: JSON.stringify(prior), prompt: ctx.prompt }, priceTable());
  if (headroom.refuse) {
    // Three endings, three shapes. A Stop and the step cap are *continuable*
    // (`{ ok: true, interrupted: true }`: the lesson stays resumable and the
    // learner's next message carries it on). This one is *failed*, because a
    // lesson that no longer fits its model's window genuinely cannot continue —
    // which is why it must not be folded into either of the other two. Nothing
    // is compacted or summarised on the way here: the understanding gate would
    // then rest on a summary the model wrote about itself.
    sink.endTurn({ ok: false, error: headroom.reason });
    return;
  }

  // Accumulated as the stream yields rather than read from the SDK's
  // result.responseMessages, which rejects after an abort — the one moment the
  // history matters most.
  const messages: ModelMessage[] = [...prior, { role: 'user', content: ctx.prompt }];
  // Set when a warning says the model received a search tool instead of
  // Derive's; the turn is ended with this sentence before anything unwinds, so
  // the idempotent endTurn keeps it as the one thing the lesson records.
  let refused = false;
  // Every part is persisted verbatim, `providerOptions` included: Anthropic's
  // compaction signature and Google's per-block signature live there and are
  // round-tripped on the next turn, so nothing here filters or rewrites one.
  // Reasoning never reaches this array at all — D-09 keeps it out of SQLite
  // entirely — so there is none to carry forward.
  const persist = () => {
    // A refused turn is not a lesson: nothing the model said under a tool set
    // it could not teach with belongs in the history the next turn resumes.
    if (refused) return;
    try {
      saveTurnMessages(ctx.lessonId, provider, messages.filter((m) => PERSISTED_ROLES.has(m.role)));
    } catch (e) {
      // Best effort, and on purpose: a turn that cannot save its history must
      // still end, or the lesson reads busy until the next boot sweep.
      console.error('[turn]', e);
    }
  };
  const answered = answeredIds(messages);
  const called = calledIds(messages);
  const answer = (toolCallId: string, toolName: string, output: ToolResultOutput) => {
    if (answered.has(toolCallId)) return;
    answered.add(toolCallId);
    messages.push({ role: 'tool', content: [{ type: 'tool-result', toolCallId, toolName, output }] });
    persist();
  };

  // A text block is persisted the moment it starts and rewritten in place as it
  // grows (checkpointed every ~1.5 s, finalised at block end), so the learner
  // never sees prose that later vanishes: Stop, a dropped connection or a
  // server restart all keep what was written.
  let blockId: string | null = null;
  let blockSeq: number | null = null;
  let blockText = '';
  let blockMeta: Record<string, unknown> | null = null;
  let lastCheckpoint = 0;
  let verified = 0;
  // Model calls made, against the cap. A turn that reaches it ends continuable.
  let steps = 0;
  // The provider's own searches in the step now running, counted from the
  // provider-executed tool calls because that path works the same on every
  // provider where the metadata path does not. Reset at each finish-step, so a
  // step is priced for its own searches and not the turn's.
  let searches = 0;
  /** Whether a tool call checked a fact against the web: the provider's own search, Derive's fallback, or the page the tutor read. */
  const verifies = (toolName: string) => toolName === searchTool || toolName === 'web_search' || toolName === 'fetch_page';
  const flushBlock = () => {
    if (blockId && blockSeq !== null) sink.emitUpdate(blockSeq, 'assistant', { id: blockId, text: blockText });
    // The same prose, in the history the next turn resumes from: the learner's
    // log and the model's own record of what it said stay the same text.
    if (blockText) messages.push({ role: 'assistant', content: [{ type: 'text', text: blockText, ...(blockMeta ? { providerOptions: blockMeta as never } : {}) }] });
    blockId = null;
    blockSeq = null;
    blockText = '';
    blockMeta = null;
  };

  // One attempt: the request and the whole stream it yields. The retry
  // controller re-runs this when the provider says it is busy, so the state it
  // accumulates has to be a history a provider will accept on the way back in —
  // which is what the settle in the wrapper below guarantees before any error
  // escapes.
  const attempt = async () => {
    const tools = buildTools(ctx, sink, answer, omit, adapter.dialect);
    // Under the provider's own tool name, which is what `searchCountOf` counts
    // and what the status line above reads.
    if (native && searchTool) tools[searchTool] = native;
    const r = streamText({
      model,
      // The array form from the start: it is the shape D-06's stable/volatile
      // cache split needs, and `allowSystemInMessages` defaults to false, so a
      // system message inside `messages` would be refused outright.
      instructions: [{ role: 'system', content: ctx.instructions }],
      messages,
      tools,
      toolOrder: names,
      // The unit here is model calls rather than agent turns. Passed explicitly
      // because streamText's own default is a single step; see STEP_CAP for why
      // reaching it is a continuable ending rather than an error.
      stopWhen: isStepCount(stepCap()),
      // Derive owns the backoff: the SDK's retry cannot show a countdown, honour
      // a long Retry-After or be stopped mid-wait. streamRetries stays unset,
      // because a retried stream cannot retract prose already persisted.
      maxRetries: 0,
      abortSignal: controller.signal,
      providerOptions: adapter.providerOptions,
      // The SDK's own default here is `console.error(error)`, which would dump a
      // stack trace to the learner's terminal on every tick of an ordinary rate
      // limit. The failure already reaches them through the `error` part below,
      // so the loop is the one place it is reported.
      onError: () => undefined,
    });

    for await (const part of r.fullStream) {
      switch (part.type) {
        case 'text-start':
          flushBlock();
          blockId = randomUUID();
          blockSeq = sink.emit('assistant', { id: blockId, text: '', partial: true }).seq;
          lastCheckpoint = Date.now();
          break;
        case 'text-delta':
          if (blockId && blockSeq !== null) {
            blockText += part.text;
            sink.emitEphemeral('delta', { id: blockId, text: part.text });
            if (Date.now() - lastCheckpoint > 1500) {
              sink.checkpoint(blockSeq, { id: blockId, text: blockText, partial: true });
              lastCheckpoint = Date.now();
            }
          }
          break;
        case 'text-end':
          blockMeta = (part.providerMetadata as Record<string, unknown> | undefined) ?? null;
          flushBlock();
          break;
        case 'reasoning-start':
          // D-09: the learner sees that the model is thinking and never what it
          // thought. reasoning-delta and reasoning-end are discarded before any
          // sink call, so no reasoning reaches SQLite, the SSE replay or the
          // Obsidian mirror.
          sink.emitEphemeral('status', { text: 'Thinking' });
          break;
        case 'tool-call':
          if (searchTool && part.providerExecuted && part.toolName === searchTool) searches += 1;
          // Once per id: a provider retry re-sends a call the history already
          // asks for, and the replay guard below answers it from the record
          // rather than running it again.
          if (called.has(part.toolCallId)) break;
          called.add(part.toolCallId);
          // Counted here rather than in a tool's own execute, because the
          // provider's search runs on its side and has no execute to count in.
          // A loop that searches without counting makes the lesson footer's
          // `facts verified on the web` read as a promise forever.
          if (verifies(part.toolName)) verified += 1;
          // The provider's own search shows the same status line the plugin
          // shows for WebSearch; Derive's two tools carry theirs in the
          // registry, so between them the learner reads the same three strings.
          if (searchTool && part.providerExecuted && part.toolName === searchTool) sink.emitEphemeral('status', { text: 'Verifying with a web search' });
          messages.push({
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId: part.toolCallId,
                toolName: part.toolName,
                input: part.input,
                ...(part.providerExecuted ? { providerExecuted: true } : {}),
                ...(part.providerMetadata ? { providerOptions: part.providerMetadata } : {}),
              },
            ],
          });
          persist();
          break;
        case 'tool-result':
          // A Derive tool has already answered from inside its own execute, in
          // the same step as its record; this is what catches a result the
          // provider produced itself.
          answer(part.toolCallId, part.toolName, { type: 'json', value: part.output as never });
          break;
        case 'tool-error':
          answer(part.toolCallId, part.toolName, { type: 'error-text', value: safeMessage(part.error) });
          break;
        case 'error':
          // A request failure is delivered here rather than thrown, and the SDK
          // then closes the stream normally — so without this the turn would end
          // `ok: true` having taught nothing. Thrown so the retry controller
          // around the attempt sees it; a 429 is where it belongs.
          throw part.error;
        case 'start-step':
          // A model that silently drops a capability says so here and nowhere
          // else; the learner is told rather than left with a tutor that stopped
          // drawing its graph.
          for (const w of part.warnings) {
            if (w.type !== 'unsupported') continue;
            if (DROPS_THE_TOOLS.test(w.feature)) {
              // Not a status line: every one of the fourteen tools was dropped,
              // so continuing would teach a lesson with no graph in it.
              // Refusing is the safe direction, and ending the turn here rather
              // than after the abort unwinds is what makes this sentence the one
              // the lesson records.
              refused = true;
              sink.endTurn({ ok: false, error: NO_TOOLS_WITH_SEARCH });
              controller.abort();
              break;
            }
            sink.emitEphemeral('status', { text: `This model does not support ${w.feature}` });
          }
          break;
        case 'finish-step': {
          const ran = part.response.modelId ?? asked;
          sink.usage(usageOf(part.usage, ran, adapter.cost(part.providerMetadata, part.usage, ran, searches || null)));
          searches = 0;
          steps += 1;
          // Saved at the end of every step, so a crash loses at most the step
          // that was in flight.
          persist();
          break;
        }
        case 'abort':
          flushBlock();
          // Before the save, so what lands on disk is a history a provider will
          // accept on the next turn rather than one with an unanswered call in
          // it.
          patchOrphans(messages, answered);
          persist();
          break;
        default:
          break;
      }
      if (part.type === 'abort' || refused) break;
    }
  };

  try {
    await withRetries(
      async () => {
        try {
          await attempt();
        } catch (e) {
          // Settle before the error escapes, so the next attempt sends a history
          // a provider will accept: a half-written block is kept rather than
          // dropped, and a call this attempt asked for and never answered gets
          // its synthesized result. Both are idempotent, which is why running
          // them here as well as in the catch below is safe.
          flushBlock();
          patchOrphans(messages, answered);
          persist();
          throw e;
        }
      },
      sink,
      ctx,
      { label: labelOf(provider), signal: controller.signal },
    );

    flushBlock();
    persist();
    // The step cap is a runaway guard, not a teaching limit: a turn that ran
    // into it ends with the same continuable shape a Stop produces, never an
    // error card and never a lost lesson.
    if (ctx.isStopping() || steps >= stepCap()) sink.endTurn({ ok: true, interrupted: true });
    else sink.endTurn({ ok: true, verified });
  } catch (err) {
    flushBlock();
    patchOrphans(messages, answered);
    persist();
    sink.endTurn({ ok: false, error: safeMessage(err) });
  } finally {
    // The stream can end without a finish (Stop, the provider hanging up). The
    // learner still needs the prose kept and the turn marked finished;
    // sink.endTurn is idempotent, which is what makes this safe. patchOrphans
    // is idempotent too, so running it here as well covers the ending no
    // branch above saw.
    flushBlock();
    patchOrphans(messages, answered);
    persist();
    sink.endTurn({ ok: true, interrupted: true });
    chains.delete(ctx.lessonId);
  }
}

/**
 * One usage row for one model request.
 *
 * `input_tokens` is the *uncached* count, which is what this repo's column has
 * always meant and what the Claude driver already writes. `usage.inputTokens`
 * is a total that includes cache reads and writes, so mapping it here would
 * make a well-cached lesson read as roughly twice the input it actually paid
 * for.
 *
 * The money comes from the provider's own adapter, which is the only thing that
 * knows where that provider reports a cost. The `searches` the adapter read are
 * already folded into its `cost_usd`: the ledger has no column for a per-call
 * charge, and adding one would give `cost_source` a second meaning.
 */
function usageOf(u: LanguageModelUsage, model: string | null, cost: CostRead): UsageInput {
  return {
    model,
    input_tokens: reported(u.inputTokenDetails?.noCacheTokens),
    output_tokens: reported(u.outputTokens),
    cache_read_tokens: reported(u.inputTokenDetails?.cacheReadTokens),
    cache_write_tokens: reported(u.inputTokenDetails?.cacheWriteTokens),
    reasoning_tokens: reported(u.outputTokenDetails?.reasoningTokens),
    cost_usd: cost.cost_usd,
    cost_source: cost.cost_source,
  };
}

/**
 * The loop, named for the provider it ran on.
 *
 * `Driver.name` is what `startTurn` writes into `turns.driver`, what
 * `recordUsage` denormalises onto every usage row and what the header pill
 * reads back through `providerOfDriver`. One driver called `api` would collapse
 * five providers into a single label in the ledger and in front of the learner,
 * so the name is the catalogue id and the loop is built per provider.
 */
export function apiDriverFor(provider: ProviderId): Driver {
  return {
    name: provider,
    runTurn: (ctx: TurnContext, sink: EventSink) => runTurn(provider, ctx, sink),
  };
}

/**
 * The owned loop for whichever provider is active right now.
 *
 * The dispatch in `agent.ts` builds its driver from the turn's own resolved
 * provider and never reads this; it exists for a caller that wants the loop
 * without naming a provider. `name` is a getter for the same reason the factory
 * above exists: it must be the provider id, never a generic one.
 */
export const apiDriver: Driver = {
  get name() {
    return currentTutor().provider;
  },
  runTurn: (ctx: TurnContext, sink: EventSink) => runTurn(currentTutor().provider, ctx, sink),
};
