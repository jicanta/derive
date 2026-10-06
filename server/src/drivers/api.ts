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
import { isStepCount, jsonSchema, streamText, tool, type JSONSchema7, type LanguageModel, type LanguageModelUsage, type ModelMessage, type ToolSet } from 'ai';
import * as actions from '../actions.js';
import { getSetting, type UsageInput } from '../db.js';
import { type Driver, type EventSink, type TurnContext } from '../driver.js';
import { type ProviderId } from '../providers.js';
import { safeMessage } from '../secrets.js';
import { baseUrlKey, currentTutor, effectiveKey } from '../settings.js';
import { TOOL_LABELS, descriptionFor, jsonSchemaOf, toolsFor } from '../tools.js';
import { adapterFor } from './adapters.js';

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

/** Every tutor tool, as the SDK takes them: the registry's description, a pre-projected JSON Schema, and an execute that only dispatches. */
function buildTools(lessonId: string, sink: EventSink): ToolSet {
  const set: ToolSet = {};
  for (const spec of toolsFor('agent')) {
    set[spec.name] = tool({
      description: descriptionFor(spec, 'agent'),
      // The projected schema, never the zod schema: handed a zod schema the SDK
      // runs its own conversion and emits draft-07, where `jsonSchemaOf` emits
      // draft-2020-12, so the bytes on the wire would stop matching
      // server/test/wire-surface.json.
      inputSchema: jsonSchema<Record<string, unknown>>(jsonSchemaOf(spec, 'agent') as JSONSchema7),
      execute: async (input: Record<string, unknown>) =>
        serialise(lessonId, async () => {
          sink.emitEphemeral('status', { text: TOOL_LABELS[spec.name] ?? `Using ${spec.name}` });
          return await actions.runTool(lessonId, spec.name, input);
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

  const names = toolsFor('agent').map((s) => s.name);
  // The turn's history, accumulated as the stream yields rather than read from
  // result.responseMessages, which rejects after an abort. Plan 03-04 persists
  // this; here it is what the step after a tool call is built from.
  const messages: ModelMessage[] = [{ role: 'user', content: ctx.prompt }];

  // A text block is persisted the moment it starts and rewritten in place as it
  // grows (checkpointed every ~1.5 s, finalised at block end), so the learner
  // never sees prose that later vanishes: Stop, a dropped connection or a
  // server restart all keep what was written.
  let blockId: string | null = null;
  let blockSeq: number | null = null;
  let blockText = '';
  let lastCheckpoint = 0;
  let verified = 0;
  const flushBlock = () => {
    if (blockId && blockSeq !== null) sink.emitUpdate(blockSeq, 'assistant', { id: blockId, text: blockText });
    blockId = null;
    blockSeq = null;
    blockText = '';
  };

  try {
    const r = streamText({
      model,
      // The array form from the start: it is the shape D-06's stable/volatile
      // cache split needs, and `allowSystemInMessages` defaults to false, so a
      // system message inside `messages` would be refused outright.
      instructions: [{ role: 'system', content: ctx.instructions }],
      messages,
      tools: buildTools(ctx.lessonId, sink),
      toolOrder: names,
      // 400 mirrors today's maxTurns: 400 so no existing lesson behaves
      // differently; the unit here is model calls rather than agent turns, and
      // the cap is a runaway guard rather than a teaching limit — hitting it
      // ends the turn through the normal turn_end with a continuable status,
      // the same shape as a Stop. It is passed explicitly because streamText's
      // own default is a single step.
      stopWhen: isStepCount(400),
      // Derive owns the backoff: the SDK's retry cannot show a countdown, honour
      // a long Retry-After or be stopped mid-wait. streamRetries stays unset,
      // because a retried stream cannot retract prose already persisted.
      maxRetries: 0,
      abortSignal: controller.signal,
      providerOptions: adapter.providerOptions,
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
          messages.push({ role: 'assistant', content: [{ type: 'tool-call', toolCallId: part.toolCallId, toolName: part.toolName, input: part.input }] });
          break;
        case 'tool-result':
          messages.push({ role: 'tool', content: [{ type: 'tool-result', toolCallId: part.toolCallId, toolName: part.toolName, output: { type: 'json', value: part.output as never } }] });
          break;
        case 'tool-error':
          messages.push({ role: 'tool', content: [{ type: 'tool-result', toolCallId: part.toolCallId, toolName: part.toolName, output: { type: 'error-text', value: safeMessage(part.error) } }] });
          break;
        case 'start-step':
          // A model that silently drops a capability says so here and nowhere
          // else; the learner is told rather than left with a tutor that stopped
          // drawing its graph.
          for (const w of part.warnings) if (w.type === 'unsupported') sink.emitEphemeral('status', { text: `This model does not support ${w.feature}` });
          break;
        case 'finish-step':
          sink.usage(usageOf(part.usage, part.response.modelId ?? asked));
          break;
        case 'abort':
          flushBlock();
          break;
        default:
          break;
      }
      if (part.type === 'abort') break;
    }

    flushBlock();
    if (ctx.isStopping()) sink.endTurn({ ok: true, interrupted: true });
    else sink.endTurn({ ok: true, verified });
  } catch (err) {
    flushBlock();
    sink.endTurn({ ok: false, error: safeMessage(err) });
  } finally {
    // The stream can end without a finish (Stop, the provider hanging up). The
    // learner still needs the prose kept and the turn marked finished;
    // sink.endTurn is idempotent, which is what makes this safe.
    flushBlock();
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
 * for. The cost figure arrives with the pricing table in a later plan; until
 * then the honest answer is that nobody reported one.
 */
function usageOf(u: LanguageModelUsage, model: string | null): UsageInput {
  return {
    model,
    input_tokens: reported(u.inputTokenDetails.noCacheTokens),
    output_tokens: reported(u.outputTokens),
    cache_read_tokens: reported(u.inputTokenDetails.cacheReadTokens),
    cache_write_tokens: reported(u.inputTokenDetails.cacheWriteTokens),
    reasoning_tokens: reported(u.outputTokenDetails.reasoningTokens),
    cost_usd: null,
    cost_source: 'unknown',
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
