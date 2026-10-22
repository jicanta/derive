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
 * Nothing here runs unasked: the whole-list pass is what the settings page's
 * one detection pass awaits when it opens and when the learner presses rescan,
 * and the per-model read runs when the learner selects a model. Nothing runs
 * on a timer. The environment is read only through `config.ts`, by way of the
 * modules this one imports.
 */
import { providerOf } from './providers.js';
import { field, hintFor, LOCAL_MS, postJson, statusOf } from './probe.js';
import { safeMessage } from './secrets.js';
import { localBase, NUM_CTX_FLOOR } from './settings.js';

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

/** The metadata read for one model on one local row. Throws the server's own sentence, or Derive's, the way `listModels` does. */
async function readCapability(id: string, model: string): Promise<Capability> {
  const spec = providerOf(id);
  if (!spec) throw new Error('unknown provider');
  const base = localBase(spec);
  if (!base) throw new Error(`${spec.label} has no address to ask`);
  switch (spec.id) {
    case 'ollama':
      // The one metadata read in this phase that is not a GET. Ollama takes no key.
      return ollamaCapability(await postJson(`${base}/api/show`, {}, { model }, LOCAL_MS));
    default:
      return silence();
  }
}

/**
 * Whether one model on one local row can run the method, read now. Always
 * answers and never throws, like `testConnection`: the verdict with its
 * latency, or the server's sentence with Derive's hint beside it. A read that
 * fails leaves the model at silence rather than at a refusal, so a server
 * Derive could not reach never costs the learner their model.
 */
export async function capabilityOf(id: string, model: string): Promise<CapabilityVerdict> {
  const t0 = Date.now();
  const ms = () => Date.now() - t0;
  try {
    const cap = await readCapability(id, model);
    const { selectable, definitive, refusal } = verdictOf(model, cap);
    return { ok: true, model, tools: cap.tools, max_window: cap.maxWindow, served_window: cap.servedWindow, selectable, definitive, refusal, ms: ms() };
  } catch (e) {
    const error = safeMessage(e);
    const spec = providerOf(id);
    const hint = spec ? hintFor(spec.label, statusOf(error), error) : undefined;
    return { ok: false, error, ...(hint ? { hint } : {}), ms: ms() };
  }
}
