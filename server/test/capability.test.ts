import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

// Nothing in this suite opens a server, reaches the network or asks a model to
// generate anything: every case drives a pure parser over a literal taken from
// the JSON quoted in 04-RESEARCH.md §Three Servers, Three Wire Shapes, which
// was read from each project's own source.
//
// The scratch data directory is the same precaution cost.test.ts takes, for
// the same reason and not for this suite's own sake: `capability.ts` needs the
// address of the learner's server, that address comes from `localBase` in
// `settings.ts`, and `settings.ts` imports `db.ts`, which opens the SQLite file
// at import time. So the import alone would otherwise touch the developer's
// own ~/.derive. Pinning it here means the file that gets created is a scratch
// one; no case in this file reads or writes a row.
const scratch = mkdtempSync(join(tmpdir(), 'derive-test-'));
process.env.DERIVE_DATA_DIR = scratch;

const { capabilityRefusal, capabilityRefusalFor, forgetCapabilities, knownCapability, llamaCppCapability, lmStudioCapability, ollamaCapability, rememberCapability, verdictOf } =
  await import('../src/capability.js');
const { NUM_CTX_FLOOR } = await import('../src/settings.js');

/**
 * Ollama's `POST /api/show`, as its own API reference documents the response.
 * The architecture and the window key are deliberately *not* `llama` here: the
 * key is architecture-prefixed, and a parser that hard-coded one family would
 * pass against the doc example and read a null window on the learner's actual
 * model. `tools` is added to the doc's `capabilities` where a case needs it.
 */
const show = (over: Record<string, unknown> = {}): unknown => ({
  details: { parent_model: '', format: 'gguf', family: 'qwen3moe', families: ['qwen3moe'], parameter_size: '8.0B', quantization_level: 'Q4_0' },
  model_info: { 'general.architecture': 'qwen3moe', 'qwen3moe.context_length': 262_144 },
  capabilities: ['completion', 'tools'],
  ...over,
});

describe('ollama capability metadata', () => {
  it('reads tools from the capabilities array', () => {
    assert.equal(ollamaCapability(show()).tools, 'yes');
  });

  it('is a positive no when the array is there without tools', () => {
    // llama.cpp's defaults make a false meaningful; Ollama's equivalent is a
    // list that was built and simply does not carry the entry.
    assert.equal(ollamaCapability(show({ capabilities: ['completion', 'vision'] })).tools, 'no');
  });

  it('is silence when capabilities is absent', () => {
    const { capabilities, ...withoutCaps } = show() as Record<string, unknown>;
    assert.equal(capabilities !== undefined, true);
    assert.equal(ollamaCapability(withoutCaps).tools, 'unknown');
  });

  it('is silence rather than a throw when capabilities is not an array', () => {
    // An older or patched build sending a string, an object or null is saying
    // nothing Derive can read — which is not the same as saying no.
    for (const bad of ['tools', { tools: true }, null, 7]) {
      assert.equal(ollamaCapability(show({ capabilities: bad })).tools, 'unknown');
    }
  });

  it('reads the window through the architecture prefix', () => {
    assert.equal(ollamaCapability(show()).maxWindow, 262_144);
    // A different architecture is read with no change to the parser.
    const other = show({ model_info: { 'general.architecture': 'gemma3', 'gemma3.context_length': 131_072 } });
    assert.equal(ollamaCapability(other).maxWindow, 131_072);
  });

  it('has no window when general.architecture is absent', () => {
    // The prefixed key may still be in the body; without the architecture
    // there is nothing that says which of the keys is the context length.
    const noArch = show({ model_info: { 'qwen3moe.context_length': 262_144 } });
    assert.equal(ollamaCapability(noArch).maxWindow, null);
  });

  it('has no window when the prefixed key is not a number', () => {
    const notNumber = show({ model_info: { 'general.architecture': 'qwen3moe', 'qwen3moe.context_length': '262144' } });
    assert.equal(ollamaCapability(notNumber).maxWindow, null);
  });

  it('never claims a served window, because derive tells ollama the window', () => {
    // D-05: Ollama is the one local row Derive sends `num_ctx` to rather than
    // reading a served value from.
    assert.equal(ollamaCapability(show()).servedWindow, null);
  });

  it('throws nothing for a body that is not an object at all', () => {
    for (const body of ['<!DOCTYPE html><html lang="en"><head><title>FreqUI</title>', null, undefined, 42]) {
      const cap = ollamaCapability(body);
      assert.deepEqual(cap, { tools: 'unknown', maxWindow: null, servedWindow: null });
    }
  });
});

describe('the capability ladder', () => {
  it('refuses a model whose server says it cannot call tools', () => {
    const v = verdictOf('a-model', { tools: 'no', maxWindow: 262_144, servedWindow: null });
    assert.equal(v.selectable, false);
    assert.equal(v.definitive, true);
    assert.equal(v.refusal, capabilityRefusalFor('a-model'));
  });

  it('uses the approved refusal sentence verbatim, with only the model substituted', () => {
    // 04-UI-SPEC.md §Copywriting Contract → Error state. The one link is Settings.
    assert.equal(
      capabilityRefusalFor('a-model'),
      'a-model does not support tool calling, and the understanding gate, the graph and the quiz all run as tools. Pick a model that supports tool calling, or choose another provider in Settings.',
    );
  });

  it('refuses a tool-capable model whose maximum window is under the floor', () => {
    const v = verdictOf('a-model', { tools: 'yes', maxWindow: NUM_CTX_FLOOR - 1, servedWindow: null });
    assert.equal(v.selectable, false);
    assert.equal(v.definitive, true);
    assert.match(String(v.refusal), /a-model/);
    assert.match(String(v.refusal), new RegExp(String(NUM_CTX_FLOOR)));
    // Not the num_ctx sentence: that one is about a window the learner can
    // raise on the row, and this is a ceiling they cannot.
    assert.doesNotMatch(String(v.refusal), /num_ctx/);
  });

  it('allows a tool-capable model exactly at the floor', () => {
    assert.equal(verdictOf('a-model', { tools: 'yes', maxWindow: NUM_CTX_FLOOR, servedWindow: null }).selectable, true);
  });

  it('allows a tool-capable model whose window the server did not state', () => {
    // A null window is never a refusal at any tier: the per-lesson estimator
    // has the last word, exactly as headroomCheck already abstains.
    const v = verdictOf('a-model', { tools: 'yes', maxWindow: null, servedWindow: null });
    assert.equal(v.selectable, true);
    assert.equal(v.refusal, null);
  });

  it('lets silence through, and says the verdict is not settled yet', () => {
    const v = verdictOf('a-model', { tools: 'unknown', maxWindow: null, servedWindow: null });
    assert.equal(v.selectable, true);
    assert.equal(v.definitive, false);
    assert.equal(v.refusal, null);
  });

  it('does not refuse a small window it only knows about through silence', () => {
    // The window check rides on a positive tools answer. Where tools is
    // silence the whole verdict goes to the round-trip, which settles the tool
    // question and runs this same ladder again with it — so the window is
    // deferred to the tier that can decide, never dropped and never used to
    // refuse a model nothing has been established about.
    const v = verdictOf('a-model', { tools: 'unknown', maxWindow: 4_096, servedWindow: null });
    assert.equal(v.selectable, true);
    assert.equal(v.refusal, null);
  });
});

describe('llama.cpp capability metadata', () => {
  /** /props, as the server emits it. The caps map's nine keys are read from caps.cpp; only supports_tools is read here. */
  const props = (over: Record<string, unknown> = {}): unknown => ({
    default_generation_settings: { n_ctx: 32_768 },
    chat_template_caps: {
      supports_string_content: true,
      supports_typed_content: true,
      supports_tools: true,
      supports_tool_calls: true,
      supports_parallel_tool_calls: true,
      supports_system_role: true,
      supports_preserve_reasoning: false,
      supports_reasoning_effort: false,
      supports_object_arguments: true,
    },
    ...over,
  });
  /** /v1/models, whose id defaults to the model file path unless --alias was passed. */
  const models = (meta: unknown = { n_ctx_train: 262_144 }): unknown => ({ object: 'list', data: [{ id: '/models/a.gguf', meta }] });

  it('reads a positive supports_tools and the served window', () => {
    assert.deepEqual(llamaCppCapability(props(), models(), '/models/a.gguf'), { tools: 'yes', maxWindow: 262_144, servedWindow: 32_768 });
  });

  it('refuses on a false, because a false is a detection and not an absence', () => {
    // caps.h initialises supports_tools to true and the server only turns it
    // off when it has found that the template cannot — so this is the server
    // reporting a finding.
    const cap = llamaCppCapability({ default_generation_settings: { n_ctx: 32_768 }, chat_template_caps: { supports_tools: false } }, undefined);
    assert.equal(cap.tools, 'no');
    assert.equal(cap.servedWindow, 32_768);
    assert.equal(verdictOf('a-model', cap).selectable, false);
  });

  it('is silence when chat_template_caps is absent, and does not refuse', () => {
    // An older build emits no caps map at all. The served window is still read.
    const cap = llamaCppCapability({ default_generation_settings: { n_ctx: 32_768 } }, undefined);
    assert.equal(cap.tools, 'unknown');
    assert.equal(cap.servedWindow, 32_768);
    assert.equal(verdictOf('a-model', cap).refusal, null);
  });

  it('is silence when supports_tools is present but not a boolean', () => {
    assert.equal(llamaCppCapability(props({ chat_template_caps: { supports_tools: 'true' } }), undefined).tools, 'unknown');
  });

  it('produces no verdict at all without a numeric n_ctx', () => {
    // The port-8080 guard, at the parser rather than at the status code: the
    // body has to prove it is llama.cpp's before any field in it is believed.
    // A caps map in a body that cannot be llama.cpp's is not evidence.
    for (const body of [{ chat_template_caps: { supports_tools: false } }, { default_generation_settings: {} }, { default_generation_settings: { n_ctx: '32768' } }]) {
      assert.deepEqual(llamaCppCapability(body, models()), { tools: 'unknown', maxWindow: null, servedWindow: null });
    }
  });

  it('throws nothing on the dashboard that answers HTML on /props', () => {
    // Reproduced live on this machine: 200 text/html on both /health and /props.
    const cap = llamaCppCapability('<!DOCTYPE html><html lang="en"><head><title>FreqUI</title></head></html>', undefined);
    assert.deepEqual(cap, { tools: 'unknown', maxWindow: null, servedWindow: null });
  });

  it('has a null maximum when n_ctx_train is absent, and still does not refuse', () => {
    // Older servers omit sibling fields; the project's own docs tell clients to
    // fall back rather than conclude.
    const cap = llamaCppCapability(props(), models({}), '/models/a.gguf');
    assert.equal(cap.maxWindow, null);
    const v = verdictOf('a-model', cap);
    assert.equal(v.selectable, true);
    assert.equal(v.refusal, null);
  });

  it('has a null maximum when no entry matches the model asked about', () => {
    assert.equal(llamaCppCapability(props(), models(), '/models/something-else.gguf').maxWindow, null);
  });
});

describe('LM Studio capability metadata', () => {
  /** /api/v1/models entry. The identifier here is `key`, not `id`. */
  const v1 = (toolUse: unknown, over: Record<string, unknown> = {}): unknown => ({
    key: 'a-publisher/a-model',
    type: 'llm',
    max_context_length: 131_072,
    capabilities: { vision: false, trained_for_tool_use: toolUse },
    loaded_instances: [{ id: 'a-publisher/a-model', config: { context_length: 32_768 } }],
    ...over,
  });
  /** /api/v0/models entry: a window and no tool-use indicator whatsoever. */
  const v0 = { id: 'a-publisher/a-model', object: 'model', type: 'llm', state: 'loaded', max_context_length: 65_536 };

  it('reads a positive trained_for_tool_use, the maximum and the loaded window', () => {
    assert.deepEqual(lmStudioCapability(v1(true), undefined), { tools: 'yes', maxWindow: 131_072, servedWindow: 32_768 });
  });

  it('reads a negative trained_for_tool_use as a refusal', () => {
    const cap = lmStudioCapability(v1(false), undefined);
    assert.equal(cap.tools, 'no');
    assert.equal(verdictOf('a-model', cap).selectable, false);
  });

  it('is silence when the flag is there but not a boolean', () => {
    assert.equal(lmStudioCapability(v1('yes'), undefined).tools, 'unknown');
  });

  it('falls back to the v0 window when there is no v1 entry at all', () => {
    // The older-build chain: /api/v1/models 404s, /api/v0/models answers.
    const cap = lmStudioCapability(undefined, v0);
    assert.equal(cap.maxWindow, 65_536);
    assert.equal(cap.servedWindow, null);
  });

  it('leaves a v0-only server at silence, so the round-trip is what decides', () => {
    // v0 carries no tool-use indicator, which is exactly the case D-06's
    // round-trip exists for. It must not read as a no.
    const cap = lmStudioCapability(undefined, v0);
    assert.equal(cap.tools, 'unknown');
    const v = verdictOf('a-model', cap);
    assert.equal(v.selectable, true);
    assert.equal(v.definitive, false);
    assert.equal(v.refusal, null);
  });

  it('prefers the v1 maximum over the v0 one when both are there', () => {
    assert.equal(lmStudioCapability(v1(true), v0).maxWindow, 131_072);
  });

  it('has no served window when nothing is loaded', () => {
    assert.equal(lmStudioCapability(v1(true, { loaded_instances: [] }), undefined).servedWindow, null);
  });
});

describe('the remembered verdict, and what it refuses', () => {
  const ROW = 'lmstudio';

  it('answers the approved sentence for a verdict that is positively non-selectable', () => {
    const cap = { tools: 'no' as const, maxWindow: 131_072, servedWindow: 32_768 };
    rememberCapability(ROW, 'a-model', { ...cap, ...verdictOf('a-model', cap) });
    const refusal = capabilityRefusal(ROW, 'a-model');
    assert.equal(refusal, capabilityRefusalFor('a-model'));
    assert.match(String(refusal), /a-model/);
    forgetCapabilities(ROW);
  });

  it('answers null for a pair nothing has been read for', () => {
    forgetCapabilities(ROW);
    assert.equal(knownCapability(ROW, 'never-read'), null);
    assert.equal(capabilityRefusal(ROW, 'never-read'), null);
    // And for no model at all, which is a row with nothing chosen on it.
    assert.equal(capabilityRefusal(ROW, null), null);
  });

  it('answers null for silence and for a null maximum window', () => {
    const quiet = { tools: 'unknown' as const, maxWindow: null, servedWindow: 32_768 };
    rememberCapability(ROW, 'quiet-model', { ...quiet, ...verdictOf('quiet-model', quiet) });
    assert.equal(capabilityRefusal(ROW, 'quiet-model'), null);
    const noMax = { tools: 'yes' as const, maxWindow: null, servedWindow: null };
    rememberCapability(ROW, 'no-max-model', { ...noMax, ...verdictOf('no-max-model', noMax) });
    assert.equal(capabilityRefusal(ROW, 'no-max-model'), null);
    forgetCapabilities(ROW);
  });

  it('keeps the served window where the refusals and the estimator can read it', () => {
    const cap = { tools: 'yes' as const, maxWindow: 131_072, servedWindow: 32_768 };
    rememberCapability(ROW, 'a-model', { ...cap, ...verdictOf('a-model', cap) });
    assert.equal(knownCapability(ROW, 'a-model')?.servedWindow, 32_768);
    forgetCapabilities(ROW);
  });

  it('is replaced by any newer read for the same provider and model', () => {
    const no = { tools: 'no' as const, maxWindow: null, servedWindow: null };
    rememberCapability(ROW, 'a-model', { ...no, ...verdictOf('a-model', no) });
    assert.equal(capabilityRefusal(ROW, 'a-model'), capabilityRefusalFor('a-model'));
    const yes = { tools: 'yes' as const, maxWindow: 131_072, servedWindow: null };
    rememberCapability(ROW, 'a-model', { ...yes, ...verdictOf('a-model', yes) });
    assert.equal(capabilityRefusal(ROW, 'a-model'), null, 'a stale no outlived the read that replaced it');
    forgetCapabilities(ROW);
  });

  it('returns a forgotten row to silence rather than to a no', () => {
    const no = { tools: 'no' as const, maxWindow: null, servedWindow: null };
    rememberCapability(ROW, 'a-model', { ...no, ...verdictOf('a-model', no) });
    rememberCapability('ollama', 'other-model', { ...no, ...verdictOf('other-model', no) });
    forgetCapabilities(ROW);
    assert.equal(knownCapability(ROW, 'a-model'), null, 'forgetting must leave nothing, not a negative');
    assert.equal(capabilityRefusal(ROW, 'a-model'), null);
    // One row at a time: forgetting a row must not forget its neighbours.
    assert.equal(capabilityRefusal('ollama', 'other-model'), capabilityRefusalFor('other-model'));
    forgetCapabilities('ollama');
  });

  it('does not confuse two rows whose model ids are the same', () => {
    const no = { tools: 'no' as const, maxWindow: null, servedWindow: null };
    rememberCapability('lmstudio', 'same-id', { ...no, ...verdictOf('same-id', no) });
    assert.equal(capabilityRefusal('llamacpp', 'same-id'), null);
    forgetCapabilities('lmstudio');
  });
});
