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

const { capabilityRefusalFor, ollamaCapability, verdictOf } = await import('../src/capability.js');
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
