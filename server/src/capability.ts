/**
 * Whether a model can run the method, and how Derive finds out.
 *
 * Every mechanic of the method is a tool call. The dependency graph arrives
 * through `set_plan`, a node locks through `node_status`, the understanding
 * gate is a `quiz` the server grades. A model that cannot call tools cannot
 * teach: it will talk about the topic pleasantly and nothing will ever lock.
 * Discovering that halfway through a lesson costs the learner the lesson, so
 * the question is asked before they invest a session in it.
 *
 * There are two tiers because the two answers cost different amounts. The
 * cheap answer is already sitting in each server's own metadata — Ollama
 * lists a model's `capabilities`, llama.cpp publishes the chat template's
 * `chat_template_caps`, LM Studio reports `trained_for_tool_use` — and none of
 * those reads asks a model to generate a token. The definitive answer costs
 * one tiny real tool-call round-trip, so it is spent on the one model the
 * learner actually selects.
 *
 * The one thing that must never happen is reading silence as a refusal. An
 * older llama.cpp build omits `chat_template_caps` entirely and an older LM
 * Studio has no `/api/v1/models` at all; an absent field is silence about
 * every value, not a negative, and llama.cpp's own documentation tells clients
 * to fall back when a sibling field is missing rather than conclude. So the
 * verdict is three-valued and only a positive `no` refuses. Refusing a
 * learner's perfectly capable model on no evidence would leave them unable to
 * proceed, with a sentence that is simply false.
 *
 * Every read here requires a parsed field of the expected JSON type, never a
 * 200 status code. The machine this was written on answers 200 `text/html` on
 * both `/health` and `/props` from an unrelated dashboard on port 8080, so a
 * probe that trusted the status would read that dashboard as llama.cpp and
 * then parse HTML as metadata. Every sentence that can reach the learner comes
 * from `providerSentence`, `hintFor` or Derive's own unreachable line by way of
 * `probe.ts`, and then through `safeMessage` — never a regex over a response
 * body, and never a raw `e.message`, because a local server started with a
 * bearer token can echo it in an error.
 *
 * A verdict is remembered in module state rather than written to the
 * `settings` table, and that is a decision rather than a shortcut. A learner
 * can reload the same model under a different chat template, raise the window
 * their server was started with, or swap the file behind an alias, all without
 * Derive hearing about it. A verdict persisted across restarts would come back
 * as a confident claim about a server that has since changed — and the one
 * direction this module must never be wrong in is claiming a `no`. Memory can
 * only ever be *silent* after a restart, and silence never refuses. It is the
 * same posture `settings.ts` already takes with detection: `lastDetection()`
 * reports its observation whatever its age, `resetDetection()` forgets it, and
 * nothing expires on a clock.
 *
 * Nothing here runs unasked: the whole-list pass is what the settings page's
 * one detection pass awaits when it opens and when the learner presses rescan,
 * and the per-model read runs when the learner selects a model. Nothing runs
 * on a timer. The environment is read only through `config.ts`, by way of the
 * modules this one imports.
 *
 * Past those two tiers there is a third question, and it is the learner's
 * rather than Derive's: can *this* model actually teach, right now, before I
 * spend a session on it. `testTeaching` at the end of this file answers it the
 * only way it can be answered — by teaching: one scripted turn through the
 * production loop, one node, one quiz the server grades, in a lesson deleted in
 * the same request. It never reaches a driver any other way than the one a real
 * lesson does, so a pass cannot come from Derive's own plumbing: no stub, no
 * process-global driver override (that seam lives in `driver.ts` and is read in
 * `agent.ts`, never here), no cached verdict, no repaired tool call. The whole
 * value of the action is that a learner can trust it before spending a session,
 * and a pass their model did not produce would be worse than no action at all.
 */
import { randomUUID } from 'node:crypto';
import { generateText, jsonSchema, tool, type JSONSchema7 } from 'ai';
import { runTurn } from './agent.js';
import { createLesson, deleteLesson, type StoredEvent } from './db.js';
import { subscribe } from './events.js';
import { providerOf, type ProviderId } from './providers.js';
import { bearer, field, getJson, hintFor, idsOf, LOCAL_MS, postJson, statusOf, testConnection } from './probe.js';
import { answerPrompt } from './prompts.js';
import { safeMessage } from './secrets.js';
import { effectiveKey, localBase, NUM_CTX_FLOOR } from './settings.js';
import { descriptionFor, jsonSchemaOf, toolsFor } from './tools.js';
import { adapterFor } from './drivers/adapters.js';

/**
 * What a metadata read could establish about one model.
 *
 * `tools: 'unknown'` is silence and is never a refusal — it is the state that
 * routes to the definitive round-trip, which is the only thing that can turn
 * silence into a fact. A null window is not a refusal either: the per-lesson
 * estimator decides, exactly as `headroomCheck` already abstains when neither
 * the caller nor the price table has a window.
 *
 * `maxWindow` is what the model was trained for — a ceiling the learner cannot
 * raise. `servedWindow` is what the server was actually started with, which
 * D-05 makes read-only on the two OpenAI-compatible local rows and leaves null
 * on Ollama, the one row Derive tells the window to rather than asks it.
 */
export type Capability = { tools: 'yes' | 'no' | 'unknown'; maxWindow: number | null; servedWindow: number | null };

/**
 * What a capability read answers: always an answer, never a throw, in the same
 * shape `testConnection` uses. `selectable` is the ladder's decision and
 * `refusal` is the sentence to show when it is false. `definitive` is false
 * while the verdict rests on silence, which is what the round-trip tier reads
 * to know there is still a question worth one real request.
 *
 * The fields that cross the wire are snake_case, like every other wire shape
 * in this codebase; the parsers' own `Capability` stays camelCase.
 */
export type CapabilityVerdict =
  | {
      ok: true;
      model: string;
      tools: 'yes' | 'no' | 'unknown';
      max_window: number | null;
      served_window: number | null;
      selectable: boolean;
      definitive: boolean;
      refusal: string | null;
      ms: number;
    }
  | { ok: false; error: string; hint?: string; ms: number };

/**
 * The verbatim capability refusal from 04-UI-SPEC.md §Copywriting Contract →
 * Error state. `Settings` is the only link in the card.
 *
 * It names what is missing and what to do about it, and deliberately names no
 * server flag. llama.cpp's template engine, which an older note suggested the
 * learner might have to switch on, is enabled by default on current builds —
 * so when such a build reports that a template cannot call tools, the cause is
 * the model's own template and the only real fix is a different model. A
 * sentence sending the learner to the command line would be both wrong and
 * useless, which is why no sentence under `server/src` carries that flag's
 * name at all.
 */
export const capabilityRefusalFor = (model: string): string =>
  `${model} does not support tool calling, and the understanding gate, the graph and the quiz all run as tools. Pick a model that supports tool calling, or choose another provider in Settings.`;

/**
 * The window refusal: a maximum the learner cannot raise, which is why this is
 * not the `num_ctx` sentence. That one is about a window they can raise on the
 * model's own row; this one is a ceiling the model was trained with, and the
 * only fix is a different model. Both numbers are named so the learner can see
 * how far short it falls.
 */
const windowRefusalFor = (model: string, max: number): string =>
  `${model} has a maximum context window of ${max} tokens, and the method needs at least ${NUM_CTX_FLOOR}. Pick a model with a larger context window, or choose another provider in Settings.`;

/**
 * Ollama's `POST /api/show`. `capabilities` is a string array that contains
 * `tools` when the model can call them; present without it is a positive
 * `no`, and absent — or present as something that is not an array — is
 * silence.
 *
 * The window key is architecture-prefixed: the architecture is read from
 * `model_info['general.architecture']` and only then is
 * `model_info['<arch>.context_length']` looked up. It must never be
 * hard-coded to one model family, which would read a null window for every
 * other architecture on the learner's machine.
 *
 * Nothing is served here: D-05 makes Ollama the one local row Derive sends a
 * window to rather than reads one from.
 */
export function ollamaCapability(show: unknown): Capability {
  const caps = field(show, 'capabilities');
  const info = field(show, 'model_info');
  const arch = field(info, 'general.architecture');
  const max = typeof arch === 'string' && arch ? field(info, `${arch}.context_length`) : undefined;
  return {
    tools: Array.isArray(caps) ? (caps.includes('tools') ? 'yes' : 'no') : 'unknown',
    maxWindow: typeof max === 'number' ? max : null,
    servedWindow: null,
  };
}

/** Nothing established: the shape a row whose metadata could not be read falls back to, and the one verdict that never refuses. */
const silence = (): Capability => ({ tools: 'unknown', maxWindow: null, servedWindow: null });

/** One entry out of an OpenAI-shaped `data` array, matched on the key that names the model on that endpoint. Nothing matching is nothing established — never the first entry as a guess. */
function entryFor(body: unknown, idKey: string, model: string): unknown {
  const data = field(body, 'data');
  if (!Array.isArray(data)) return undefined;
  return data.find((e) => field(e, idKey) === model);
}

/**
 * llama.cpp's `GET /props`, with `GET /v1/models` beside it for the trained
 * maximum.
 *
 * The body must carry `default_generation_settings.n_ctx` as a *number* before
 * any of it is read as llama.cpp's. That is not belt-and-braces: on the
 * machine this was written on, port 8080 — llama.cpp's own default — is an
 * unrelated dashboard that answers 200 `text/html` on both `/health` and
 * `/props`, which was reproduced during research. A check on the status code
 * would read that dashboard as llama.cpp and then parse a web page as
 * capability metadata. Requiring a parsed number is what makes the read about
 * llama.cpp rather than about something having answered.
 *
 * A `false` on `supports_tools` is a positive finding, and this is the one
 * place in the phase where that needs saying out loud: llama.cpp's caps struct
 * initialises `supports_tools`, `supports_tool_calls`, `supports_system_role`
 * and `supports_parallel_tool_calls` to `true`, and only turns a field off
 * when it has detected that the template cannot. So a `false` is the server
 * reporting a detection, while an absent `chat_template_caps` — which older
 * builds simply do not emit — is the server saying nothing at all. That
 * asymmetry is why a `false` may refuse and an absence may not.
 *
 * `servedWindow` is what `llama-server` was started with (D-05: read-only,
 * Derive never fights a server's own configuration). `maxWindow` is
 * `meta.n_ctx_train`, null when absent — older builds omit sibling fields, and
 * the project's own documentation tells clients to fall back rather than
 * conclude.
 */
export function llamaCppCapability(props: unknown, models: unknown, model?: string): Capability {
  const served = field(field(props, 'default_generation_settings'), 'n_ctx');
  if (typeof served !== 'number') return silence();
  const supports = field(field(props, 'chat_template_caps'), 'supports_tools');
  // The entry for the model when one is named, else the only thing a
  // single-model server can be asked about: its first row.
  const entry = model !== undefined ? entryFor(models, 'id', model) : (Array.isArray(field(models, 'data')) ? (field(models, 'data') as unknown[])[0] : undefined);
  const trained = field(field(entry, 'meta'), 'n_ctx_train');
  return {
    tools: typeof supports === 'boolean' ? (supports ? 'yes' : 'no') : 'unknown',
    maxWindow: typeof trained === 'number' ? trained : null,
    servedWindow: served,
  };
}

/**
 * LM Studio's `GET /api/v1/models`, with `GET /api/v0/models` as the
 * older-build fallback.
 *
 * `capabilities.trained_for_tool_use` is the only tool-use indicator either
 * endpoint has, and only v1 carries it: a v0-only server says nothing about
 * tool calling at all, which is precisely the case the round-trip exists for.
 *
 * The model identifier on v1 is `key`, not `id`, so `probe.ts`'s `idsOf` — which
 * reads `data[].id` off v0 — does not apply to a v1 read and this module
 * matches on its own key. `servedWindow` comes from the loaded instance's own
 * `config.context_length`, which is what that instance will actually serve.
 */
export function lmStudioCapability(v1Entry: unknown, v0Entry: unknown): Capability {
  const flag = field(field(v1Entry, 'capabilities'), 'trained_for_tool_use');
  const v1Max = field(v1Entry, 'max_context_length');
  const v0Max = field(v0Entry, 'max_context_length');
  const instances = field(v1Entry, 'loaded_instances');
  const loaded = Array.isArray(instances) ? field(field(instances[0], 'config'), 'context_length') : undefined;
  return {
    tools: typeof flag === 'boolean' ? (flag ? 'yes' : 'no') : 'unknown',
    maxWindow: typeof v1Max === 'number' ? v1Max : typeof v0Max === 'number' ? v0Max : null,
    servedWindow: typeof loaded === 'number' ? loaded : null,
  };
}

/**
 * The D-04/D-06 ladder over one metadata reading.
 *
 * A positive `no` refuses. A model that can call tools but whose ceiling is
 * below the floor refuses too, symmetrically — both are facts the server
 * stated. Silence about tool calling does not refuse and does not apply the
 * window check either: it is routed to the round-trip, which establishes the
 * tool answer and then runs this same ladder again with it, so the window is
 * deferred to the tier that can decide rather than dropped. A null window is
 * never a refusal at any tier; the per-lesson estimator has the last word.
 */
export function verdictOf(model: string, cap: Capability): { selectable: boolean; definitive: boolean; refusal: string | null } {
  if (cap.tools === 'no') return { selectable: false, definitive: true, refusal: capabilityRefusalFor(model) };
  if (cap.tools === 'yes' && cap.maxWindow !== null && cap.maxWindow < NUM_CTX_FLOOR) {
    return { selectable: false, definitive: true, refusal: windowRefusalFor(model, cap.maxWindow) };
  }
  return { selectable: true, definitive: cap.tools === 'yes', refusal: null };
}

/** A read whose failure or wrong shape is silence rather than a throw. The one-word reason is on the catch, in this codebase's own style. */
const orNothing = async (read: () => Promise<unknown>): Promise<unknown> => {
  try {
    return await read();
  } catch {
    /* not answering */
    return undefined;
  }
};

/**
 * The metadata read for one model on one local row. Throws the server's own
 * sentence, or Derive's, the way `listModels` does — but only for the read a
 * row cannot do without; a second read that fails leaves its own field unset
 * rather than losing the first read's answer.
 */
async function readCapability(id: string, model: string): Promise<Capability> {
  const spec = providerOf(id);
  if (!spec) throw new Error('unknown provider');
  const base = localBase(spec);
  if (!base) throw new Error(`${spec.label} has no address to ask`);
  const headers = spec.id === 'ollama' ? {} : bearer(effectiveKey(spec.id));
  switch (spec.id) {
    case 'ollama':
      // The one metadata read in this phase that is not a GET. Ollama takes no key.
      return ollamaCapability(await postJson(`${base}/api/show`, headers, { model }, LOCAL_MS));
    case 'llamacpp': {
      // /props is the read that decides whether this is llama.cpp at all, so it
      // is the one allowed to throw; the trained maximum beside it is a bonus,
      // and an older build that omits it must not cost the served window.
      const props = await getJson(`${base}/props`, headers, LOCAL_MS);
      const models = await orNothing(() => getJson(`${base}/v1/models`, headers, LOCAL_MS));
      return llamaCppCapability(props, models, model);
    }
    case 'lmstudio': {
      // v1 first, because it is the only endpoint that says anything about tool
      // use. v0 is read only when v1 gave nothing — an older build has no v1 at
      // all, and then the window is all there is to learn.
      const v1Entry = entryFor(await orNothing(() => getJson(`${base}/api/v1/models`, headers, LOCAL_MS)), 'key', model);
      const v0Entry = v1Entry === undefined ? entryFor(await orNothing(() => getJson(`${base}/api/v0/models`, headers, LOCAL_MS)), 'id', model) : undefined;
      if (v1Entry === undefined && v0Entry === undefined) return silence();
      return lmStudioCapability(v1Entry, v0Entry);
    }
    default:
      // Not a row the ladder covers — D-01 keeps the generic OpenAI-compatible
      // row remote-and-proxied-only, and nothing else reaches here.
      return silence();
  }
}

// ---------- the remembered verdict ----------

/** A reading plus the ladder's decision on it: what one pass established about one model, which is what the refusals read. */
export type Remembered = Capability & { selectable: boolean; definitive: boolean; refusal: string | null };

// Deliberate module state, in `settings.ts`'s detection posture: reported
// whatever its age, forgotten on demand, and never persisted. See the module
// header for why a verdict must not outlive the process.
const observed = new Map<string, Remembered>();

// A unit separator, so a model id carrying the character this joins on cannot
// be confused for a different provider's row. Same separator discipline as
// materials.ts's segments.
const SEP = '\u001f';
const verdictKey = (id: string, model: string): string => `${id}${SEP}${model}`;

/** Keep what a read established about one model. Any newer read for the same provider and model replaces it; nothing accumulates and nothing expires on a clock. */
export function rememberCapability(id: string, model: string, v: Remembered): void {
  observed.set(verdictKey(id, model), v);
}

/** What is known about one model, or null when nothing has been read. Null is silence, and silence never refuses. */
export function knownCapability(id: string, model: string): Remembered | null {
  return observed.get(verdictKey(id, model)) ?? null;
}

/** Forget every verdict on one row. Its address changed, or a pass is about to re-read it: either way the old facts are about a server that may no longer be there, and returning the row to silence is the only safe direction. */
export function forgetCapabilities(id: string): void {
  const prefix = `${id}${SEP}`;
  for (const key of observed.keys()) if (key.startsWith(prefix)) observed.delete(key);
}

/**
 * The sentence that refuses one model, or null.
 *
 * Null is the answer that lets the learner proceed, so it is the answer for
 * every absence: nothing read, silence about tool calling, a window the server
 * did not state, a row the ladder does not cover. Only a verdict that is
 * positively non-selectable produces a sentence, which is what keeps "we do
 * not know" from ever reaching the learner as "your model cannot do this".
 */
export function capabilityRefusal(id: string, model: string | null): string | null {
  if (!model) return null;
  const known = knownCapability(id, model);
  return known && !known.selectable ? known.refusal : null;
}

// ---------- the definitive tier ----------

/** The one existing tool the round-trip asks for: the smallest schema in the registry — one enum field — and no effect on the learner's record even if a model called it twice. */
const PROBE_TOOL = 'set_phase';

/**
 * One real generation on the learner's own hardware, which is slower than a
 * metadata read by orders of magnitude. The alternative to waiting is refusing
 * a capable model for being slow, so this bound is generous where `LOCAL_MS`
 * is strict: a metadata endpoint that does not answer in four seconds is
 * broken, while a model thinking for half a minute on a CPU is ordinary.
 */
const ROUND_TRIP_MS = 60_000;

/**
 * D-06's definitive tier: ask the model to make one tool call and see whether
 * one comes back.
 *
 * It uses a tool the registry already has. No tool is added — the tool set has
 * to match in four places plus the plugin command files, and a probe-only
 * fourteenth-and-a-half tool would be a permanent exception in all of them.
 * The tool is registered with no `execute`, so the call comes back as a call
 * and is read rather than run: nothing in the learner's record moves because
 * Derive asked a question about a model.
 *
 * The window comes from the row's own adapter, which resolves it through the
 * same `numCtxFor` a real turn uses. Probing at a smaller window "to be quick"
 * would be the expensive choice, not the cheap one: `num_ctx` is a load-time
 * parameter, so a different value is a different loaded instance and the
 * learner would pay a reload before their first real turn.
 *
 * A clean answer with no tool call in it is a `no`. That is the one negative
 * in this module not taken from a server's own statement, and it is sound
 * precisely because of where it sits: the metadata tier already said nothing,
 * the model was handed one tool and asked plainly for one call, and a model
 * that answers prose to that cannot run a method which is nothing but tool
 * calls. Any failure — a refused request, a timeout, an endpoint that rejects
 * tools outright — is `'unknown'` instead, because that is a fact about the
 * request rather than about the model.
 */
async function roundTrip(id: string, model: string): Promise<'yes' | 'no' | 'unknown'> {
  const spec = providerOf(id);
  const probe = toolsFor('api').find((s) => s.name === PROBE_TOOL);
  if (!spec || !probe) return 'unknown';
  try {
    const adapter = adapterFor(spec.id as ProviderId);
    const { toolCalls } = await generateText({
      model: adapter.model(effectiveKey(spec.id), localBase(spec) ?? undefined, model),
      system: 'You are answering a one-step capability check, not teaching. Call the single tool you have been given and write no prose.',
      prompt: `Call the ${PROBE_TOOL} tool with phase "probe". Make the tool call and nothing else.`,
      tools: {
        [probe.name]: tool({
          description: descriptionFor(probe, 'api', adapter.dialect),
          inputSchema: jsonSchema(jsonSchemaOf(probe, 'api', adapter.dialect) as JSONSchema7),
        }),
      },
      ...(adapter.providerOptions ? { providerOptions: adapter.providerOptions } : {}),
      abortSignal: AbortSignal.timeout(ROUND_TRIP_MS),
    });
    return toolCalls.length > 0 ? 'yes' : 'no';
  } catch {
    /* not answerable */
    return 'unknown';
  }
}

/** The entries of an OpenAI-shaped `data` array, or none. A body without one establishes nothing; it is never guessed at. */
const entriesOf = (body: unknown): unknown[] => {
  const data = field(body, 'data');
  return Array.isArray(data) ? data : [];
};

/** What one reading plus the ladder's decision on it is remembered as. */
const keep = (id: string, model: string, cap: Capability): void => rememberCapability(id, model, { ...cap, ...verdictOf(model, cap) });

/**
 * The cheap tier for one model, remembered and never round-tripped.
 *
 * This is what the model write asks for before it stores anything: the
 * learner may have typed an id that no pass has looked at, and a metadata read
 * bounded by `LOCAL_MS` is affordable inside a write where a real generation
 * is not. A read that fails or a shape that does not hold leaves the model at
 * silence, which lets the write through — the correct direction, because
 * nothing was established.
 */
export async function rememberMetadata(id: string, model: string): Promise<void> {
  try {
    keep(id, model, await readCapability(id, model));
  } catch {
    /* not answering */
  }
}

/**
 * D-07's cheap tier, for a whole row at once: what the settings page's one
 * detection pass reads about every model on a local server it just found.
 *
 * What makes this tier the cheap one is **not** the number of requests. It is
 * that no request reaches a completion endpoint: nothing here asks a model to
 * generate a single token. That is the whole reason the definitive round-trip
 * stays on the one model the learner selects. A later reader optimising this
 * towards "one request per row" could move the round-trip in here and quietly
 * make opening Settings cost a generation on every installed model — on a
 * local machine, minutes of it. The distinction to preserve is the endpoint,
 * not the count.
 *
 * The counts are what each server's shape allows: llama.cpp serves one model,
 * so one `/props` plus one model list covers it; LM Studio describes its whole
 * library in one list; Ollama keeps capabilities only on `/api/show`, which is
 * per model, so that row is one read per installed model — issued together
 * rather than one after another, each bounded by `LOCAL_MS`.
 *
 * Answers always and throws never. A model whose read failed is left at
 * silence, which never refuses.
 */
export async function capabilityList(id: string): Promise<void> {
  const spec = providerOf(id);
  if (!spec || spec.group !== 'local') return;
  const base = localBase(spec);
  if (!base || !spec.modelsPath) return;
  const headers = spec.id === 'ollama' ? {} : bearer(effectiveKey(spec.id));
  const list = (path: string) => orNothing(() => getJson(`${base}${path}`, headers, LOCAL_MS));
  switch (spec.id) {
    case 'llamacpp': {
      const [props, models] = await Promise.all([list('/props'), list(spec.modelsPath)]);
      for (const model of idsOf(spec, models)) keep(id, model, llamaCppCapability(props, models, model));
      return;
    }
    case 'lmstudio': {
      // v1 first: it is the only one of the two that says anything about tool
      // use, so a build that has it needs no second request.
      const v1Entries = entriesOf(await list('/api/v1/models'));
      if (v1Entries.length) {
        for (const entry of v1Entries) {
          const model = field(entry, 'key');
          if (typeof model === 'string' && model) keep(id, model, lmStudioCapability(entry, undefined));
        }
        return;
      }
      for (const entry of entriesOf(await list(spec.modelsPath))) {
        const model = field(entry, 'id');
        if (typeof model === 'string' && model) keep(id, model, lmStudioCapability(undefined, entry));
      }
      return;
    }
    case 'ollama': {
      const models = idsOf(spec, await list(spec.modelsPath));
      const shown = await Promise.all(models.map((model) => orNothing(() => postJson(`${base}/api/show`, headers, { model }, LOCAL_MS))));
      models.forEach((model, i) => keep(id, model, ollamaCapability(shown[i])));
      return;
    }
  }
}

/**
 * Whether one model on one local row can run the method, read now, and
 * remembered. Always answers and never throws, like `testConnection`: the
 * verdict with its latency, or the server's sentence with Derive's hint beside
 * it. A read that fails leaves the model at silence rather than at a refusal,
 * so a server Derive could not reach never costs the learner their model.
 *
 * This is the per-model tier D-07 calls "the model the learner selects", so it
 * is also where the round-trip is spent: when the metadata said nothing, one
 * real request settles it and the ladder runs again with the answer. Both
 * refusals read the verdict this function remembered rather than computing one
 * of their own, so the row, the write, the activation and the lesson cannot
 * disagree about the same model.
 */
export async function capabilityOf(id: string, model: string): Promise<CapabilityVerdict> {
  const t0 = Date.now();
  const ms = () => Date.now() - t0;
  try {
    const read = await readCapability(id, model);
    const cap = read.tools === 'unknown' ? { ...read, tools: await roundTrip(id, model) } : read;
    const ladder = verdictOf(model, cap);
    rememberCapability(id, model, { ...cap, ...ladder });
    return { ok: true, model, tools: cap.tools, max_window: cap.maxWindow, served_window: cap.servedWindow, ...ladder, ms: ms() };
  } catch (e) {
    const error = safeMessage(e);
    const spec = providerOf(id);
    const hint = spec ? hintFor(spec.label, statusOf(error), error) : undefined;
    return { ok: false, error, ...(hint ? { hint } : {}), ms: ms() };
  }
}

// ---------- the teaching proof ----------

/**
 * What the teaching proof answers: a pass with its latency, or a fail with the
 * sentence to show and Derive's fix hint beside it where there is one. The same
 * two-armed shape as `TestResult` and `CapabilityVerdict`, and for the same
 * reason — the question has an answer even when the answer is a failure, so
 * this function answers rather than throws and every sentence leaves through
 * one chokepoint.
 */
export type TeachingTest = { ok: true; ms: number } | { ok: false; reason: string; hint?: string; ms: number };

/**
 * The two failure sentences Derive itself produces, verbatim from
 * 04-UI-SPEC.md §Copywriting Contract. The third approved sentence —
 * `nothing answered at {host}:{port}` — is `probe.ts`'s own and is never
 * copied here; it arrives through the reachability read below.
 */
const NO_TOOLS = 'the model called no tools, so there was no node to grade.';
const UNGRADABLE = 'the quiz came back but the grade was unreadable.';

/** The event types a turn emits that are not the trace of a tool: everything else in a lesson's log is something a tool did. Read as the absence of tool calls, which is one of the three failures. */
const NOT_A_TOOL = new Set(['turn_start', 'turn_end', 'user', 'assistant', 'status', 'delta', 'ready']);

/**
 * The fixed, trivial subject of the proof. Trivial on purpose: what is being
 * tested is whether the model can work the method's machinery, never whether it
 * knows anything, so the topic is one a two-billion-parameter model cannot get
 * wrong and the failure is unambiguous when it comes.
 */
const PROBE_TOPIC = 'why two even numbers add to an even number';
/** The node the proof teaches and quizzes — the graph's goal, so one node carries the whole run. */
const PROBE_NODE = 'even-sum';
/** The option the question's answer is, by the script. The probe picks it by its text rather than by its position, so a model that reorders its options still has its own key honoured. */
const PROBE_CORRECT = 'It is even';
const PROBE_WRONG = 'It is odd';

/**
 * The scripted turn.
 *
 * It rides the whole method prompt, as any turn does, so it has to say plainly
 * that this is not a lesson — otherwise a model doing the right thing would
 * open with probe questions and the proof would time out on its own method.
 * The graph is three nodes because `set_plan`'s own schema requires at least
 * three; the teaching and the quiz are one node, which is all PROV-11 claims.
 * The question's answer is fixed here so the probe can settle the card with the
 * option the model declared correct, and `actions.ts` still does the grading —
 * the model never grades its own question, here least of all.
 */
const PROBE_PROMPT = `This is Derive's own capability check, not a lesson, and nobody is learning from it. Ask no probe questions. Run exactly these three steps and then end the turn:

1. Call set_plan with the goal "Know that two even numbers add to an even number" and exactly these three nodes: {"id":"even","kind":"truth","label":"An even number is twice a whole number","summary":"Every even number can be written as two times some whole number."}, {"id":"pair","kind":"derived","label":"Two doubles add to a double","summary":"Adding two multiples of two gives another multiple of two.","depends_on":["even"]}, {"id":"${PROBE_NODE}","kind":"goal","label":"Two even numbers add to an even number","summary":"The sum of any two even numbers is even.","depends_on":["pair"]}.
2. Call node_status with id "${PROBE_NODE}" and status "teaching", then write one or two sentences establishing it.
3. Call quiz with node_id "${PROBE_NODE}", purpose "check", tests "intuition", question "If you add two even numbers, what is the sum?", options exactly ["${PROBE_CORRECT}", "${PROBE_WRONG}"], correct [0] — the correct option is "${PROBE_CORRECT}" — and a one-sentence explanation.

Call no other tool, attach nothing, and ask nothing else.`;

/** Which option carries the answer the script fixed, by its text; the first option when the model wrote something else, so a card is always settled and never left hanging. */
function correctIndex(options: unknown): number {
  if (!Array.isArray(options)) return 0;
  const found = options.findIndex((o) => typeof o === 'string' && o.trim().toLowerCase() === PROBE_CORRECT.toLowerCase());
  return found >= 0 ? found : 0;
}

/**
 * Settle a card the scripted turn opened, the way the browser would.
 *
 * Deferred by a microtask because `openPrompt` emits the card's event *before*
 * it registers the pending prompt, so an answer sent from inside the listener
 * would arrive at nothing. Every kind is handled rather than only the two the
 * script asks for: a model that opens a card the script did not ask for would
 * otherwise leave the turn waiting on a learner who does not exist.
 */
function settle(lessonId: string, ev: StoredEvent): void {
  const id = field(ev.payload, 'id');
  if (typeof id !== 'string') return;
  const answer =
    ev.type === 'plan'
      ? { approved: true }
      : ev.type === 'quiz'
        ? { selected: [correctIndex(field(ev.payload, 'options'))], sure: true }
        : ev.type === 'ask' || ev.type === 'explain'
          ? { text: 'This is a capability check, not a lesson.' }
          : null;
  if (!answer) return;
  queueMicrotask(() => answerPrompt(lessonId, id, answer));
}

/**
 * PROV-11: prove that this model, on this row, can run the method — one node
 * and one graded quiz — before the learner invests a session in it.
 *
 * It runs one real turn through `runTurn`, naming the pressed row's provider
 * and model, which `driverFor` resolves: the owned loop for the key, gateway
 * and local rows, the Agent SDK and Codex drivers for the two login rows, with
 * no per-row branch written here. The lesson it runs in is a scratch lesson,
 * excluded from every listing and removed in a `finally` through the
 * transactional `deleteLesson`, so a thrown error still takes the lesson and
 * its usage rows with it — which is why the token counts of a proof can never
 * reach the Usage total and why `recordUsage` needs no special case for it.
 *
 * The window is the row's own: the adapter resolves it through the same
 * `numCtxFor` a real lesson uses. Probing at a smaller window "to be quick"
 * would cost the learner forty seconds, not save them any — `num_ctx` is a
 * load-time parameter, so a different value makes Ollama reload the model
 * before their first real turn.
 *
 * Each failure is one observable outcome, and the order matters: nothing
 * answering at the address is read before the run, because it is the reason
 * there were no tool calls rather than a fact about the model; a turn the loop
 * itself refused answers in the loop's own words, because that sentence names
 * the real problem (a model the ladder refused, a window too small, a key the
 * provider rejected) better than any of the three could; zero tool calls is
 * the no-tools sentence; and anything else that failed to produce a graded pass
 * is the ungradable one — including a quiz whose own key contradicts the
 * question it was asked to write, which is a quiz that cannot gate anything.
 */
export async function testTeaching(providerId: string, model: string | null, learnerId: string): Promise<TeachingTest> {
  const t0 = Date.now();
  const ms = () => Date.now() - t0;
  const spec = providerOf(providerId);
  if (!spec) return { ok: false, reason: 'unknown provider', ms: ms() };

  // Where the learner supplied the address, ask it first whether anything is
  // there. It is the same cheap read `test connection` makes — one request, no
  // model asked to generate a token — and it is how the approved transport
  // sentence reaches the learner at all: `nothing answered at {host}:{port}` is
  // written once, in `probe.ts`. Without this a closed port is two minutes of
  // the loop's own retry backoff ending in the SDK's words, which name no
  // address and tell the learner nothing they can act on.
  if (spec.group === 'local' || spec.auth === 'key+url') {
    const reachable = await testConnection(spec.id);
    if (!reachable.ok) return { ok: false, reason: safeMessage(reachable.error), ...(reachable.hint ? { hint: reachable.hint } : {}), ms: ms() };
  }

  const lessonId = randomUUID();
  createLesson(lessonId, PROBE_TOPIC, { scratch: true, learnerId });
  const seen: StoredEvent[] = [];
  // The lesson's own event log is what the outcome is read from, which is the
  // one observation every driver makes alike: the Agent SDK path, the Codex
  // path and the owned loop all report through the same sink. Ephemeral events
  // (status lines, text deltas) carry seq -1 and are not part of the record.
  const stop = subscribe(lessonId, (ev) => {
    if (ev.seq >= 0) seen.push(ev);
    settle(lessonId, ev);
  });
  let thrown = '';
  try {
    await runTurn(lessonId, PROBE_PROMPT, { tutor: { provider: spec.id, model } });
  } catch (e) {
    thrown = safeMessage(e);
  } finally {
    stop();
    deleteLesson(lessonId);
  }

  const graded = seen.find((ev) => ev.type === 'quiz_result');
  if (graded && field(graded.payload, 'result') === 'correct') return { ok: true, ms: ms() };

  const end = seen.find((ev) => ev.type === 'turn_end');
  const refused = end && field(end.payload, 'ok') === false ? String(field(end.payload, 'error') ?? '') : thrown;
  if (refused) return { ok: false, reason: safeMessage(refused), ms: ms() };
  if (!seen.some((ev) => !NOT_A_TOOL.has(ev.type))) return { ok: false, reason: NO_TOOLS, ms: ms() };
  return { ok: false, reason: UNGRADABLE, ms: ms() };
}
