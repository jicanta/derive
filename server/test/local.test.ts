/**
 * The three local rows, proven with no local server and no network.
 *
 * Nothing in this file may reach a model on this machine, because the machine
 * that runs CI does not have one and neither does the author's. What can be
 * proven without one is exactly what PROV-06 is about: that the request leaves
 * with the window on it, that the tool surface it carries is the compact
 * projection, that the material section is the outline branch, and that a
 * prompt which will not fit is refused before it goes out. Those are properties
 * of Derive's own code, so they are asserted against Derive's own code.
 *
 * What genuinely needs a server — whether a given model passes the
 * understanding gate, whether `think: false` breaks its tool calling — belongs
 * to plan 04-04's conformance harness and to the human checks the plans carry.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { MockLanguageModelV4, simulateReadableStream } from 'ai/test';

// db.ts opens the database on import and keys.ts reads the secrets file beside
// it; pin the scratch directory before anything under src/ is imported. The
// environment settings are cleared rather than set, because this suite's whole
// point is that the provider, the model and the window come from the settings
// table. OLLAMA_HOST in particular would outrank the stored base URL.
const scratch = mkdtempSync(join(tmpdir(), 'derive-test-'));
process.env.DERIVE_DATA_DIR = scratch;
delete process.env.DERIVE_BACKEND;
delete process.env.DERIVE_MODEL;
delete process.env.OLLAMA_HOST;

const { createLesson, deleteSetting, lastTurn, listEvents, setSetting } = await import('../src/db.js');
const { runTurn } = await import('../src/agent.js');
const { setDriverOverride } = await import('../src/driver.js');
const { NUM_CTX_DEFAULT, NUM_CTX_FLOOR, numCtxFor, numCtxKey } = await import('../src/settings.js');
const { adapterFor } = await import('../src/drivers/adapters.js');
const { apiDriverFor, setModelOverride } = await import('../src/drivers/api.js');
const { descriptionFor, toolSpec, toolsFor } = await import('../src/tools.js');

// A dynamic import cannot carry types across, and a static one would open the
// database before the scratch directory above is set; type positions only.
type StoredEvent = import('../src/db.js').StoredEvent;

const realFetch = globalThis.fetch;

after(() => {
  setModelOverride(null);
  setDriverOverride(null);
  globalThis.fetch = realFetch;
  rmSync(scratch, { recursive: true, force: true });
});

describe('the window Derive asks a local model for', () => {
  it('keeps the refusal floor and the editable default as two different numbers', () => {
    // D-04 checks a model's *maximum* window against the floor; the learner's
    // own field defaults to the second number. Amendment A-01 of 04-01-PLAN.md
    // records why they cannot be the same: 0.8 × 16384 = 13,107 usable against
    // a ~13,096-token prompt floor is eleven tokens of slack, so a default at
    // the floor would refuse nearly every local lesson on sight.
    assert.equal(NUM_CTX_FLOOR, 16_384);
    assert.equal(NUM_CTX_DEFAULT, 32_768);
    assert.notEqual(NUM_CTX_FLOOR, NUM_CTX_DEFAULT, 'the floor and the default must not be collapsed into one constant');

    // And the resolver reads the stored value rather than either literal.
    deleteSetting(numCtxKey('ollama'));
    assert.equal(numCtxFor('ollama'), NUM_CTX_DEFAULT);
    setSetting(numCtxKey('ollama'), '65536');
    assert.equal(numCtxFor('ollama'), 65_536);
    deleteSetting(numCtxKey('ollama'));
  });
});

/**
 * The body of the one request a model object makes, captured by patching the
 * global `fetch` the row's `noRedirectFetch` delegates to.
 *
 * This is the falsification of research assumption A3 — that
 * `createOllama({ fetch })` routes a custom fetch through ollama-js's
 * `Config.fetch`. If it did not, the `OllamaProviderSettings.client` seam would
 * be the fallback, and if neither worked the honest move would be to report it
 * rather than assert something weaker. It does: `createOllama` passes the fetch
 * into `new Ollama({ fetch })`, which keeps it as `this.fetch` and calls it for
 * every request, and `noRedirectFetch` resolves the bare global at call time.
 *
 * The request never reaches a server: the patched fetch answers with a minimal
 * well-formed Ollama chat response and the body is kept.
 */
async function capture(model: unknown): Promise<Record<string, unknown>> {
  let body: Record<string, unknown> | null = null;
  globalThis.fetch = (async (_input: unknown, init?: { body?: unknown }) => {
    body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
    return new Response(
      JSON.stringify({
        model: String((body as { model?: unknown }).model ?? ''),
        created_at: new Date().toISOString(),
        message: { role: 'assistant', content: 'ok' },
        done: true,
        done_reason: 'stop',
        prompt_eval_count: 11,
        eval_count: 2,
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }) as typeof globalThis.fetch;
  try {
    // doStream rather than doGenerate: streaming is the path a lesson takes,
    // so it is the path whose body matters.
    const m = model as { doStream(o: unknown): Promise<{ stream: ReadableStream }> };
    const { stream } = await m.doStream({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'teach me' }] }],
      tools: toolsFor('api')
        .slice(0, 3)
        .map((s) => ({ type: 'function' as const, name: s.name, description: descriptionFor(s, 'api', 'compact'), inputSchema: { type: 'object', properties: {} } })),
    });
    for await (const _ of stream as unknown as AsyncIterable<unknown>) void _;
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.ok(body !== null, 'the row made no request at all, so neither the injected fetch nor the client seam was honoured (research assumption A3 is false)');
  return body;
}

describe('the outgoing ollama request', () => {
  it('carries options.num_ctx from the stored setting and think: false', async () => {
    deleteSetting(numCtxKey('ollama'));
    const body = await capture(adapterFor('ollama').model(undefined, 'http://127.0.0.1:9', 'a-model-the-learner-pulled'));

    // The whole of PROV-06's mechanical half: without this field Ollama serves
    // its silent 4,096-token default and the method's gate text is the first
    // thing it truncates away.
    assert.equal((body.options as { num_ctx?: number } | undefined)?.num_ctx, NUM_CTX_DEFAULT, 'a row with nothing stored must ask for the default window');
    assert.equal(body.think, false, 'reasoning reaches neither the learner nor SQLite, so it must not be paid for out of the window');
    assert.equal(body.model, 'a-model-the-learner-pulled');

    setSetting(numCtxKey('ollama'), '65536');
    const raised = await capture(adapterFor('ollama').model(undefined, 'http://127.0.0.1:9', 'a-model-the-learner-pulled'));
    assert.equal((raised.options as { num_ctx?: number } | undefined)?.num_ctx, 65_536, 'the window is the learner’s stored value, never a literal');
    deleteSetting(numCtxKey('ollama'));
  });

  it('carries the compact tool descriptions rather than the registry’s full ones', async () => {
    const body = await capture(adapterFor('ollama').model(undefined, 'http://127.0.0.1:9', 'a-model-the-learner-pulled'));
    const sent = (body.tools ?? []) as { function?: { name?: string; description?: string } }[];
    assert.ok(sent.length >= 2, 'the request carried no tools to check');

    // `shortened`'s own documented contract: a compact description is always a
    // prefix of the original and never a rewrite, so the model is given less of
    // the registry's words and never different ones.
    let shorter = 0;
    for (const t of sent) {
      const name = t.function?.name ?? '';
      const description = t.function?.description ?? '';
      const full = descriptionFor(toolSpec(name), 'api', 'full');
      assert.ok(full.startsWith(description), `${name}'s compact description is a rewrite rather than a prefix of the registry's`);
      if (description.length < full.length) shorter += 1;
    }
    assert.ok(shorter >= 1, 'no description was actually shortened, so the compact dialect is not reaching the request');
  });
});

const step = (chunks: unknown[]) => ({ stream: simulateReadableStream({ chunks: chunks as never[], initialDelayInMs: 0, chunkDelayInMs: 0 }) });

/** A stub that must never be asked for anything: a refused turn makes no request. */
const neverAsked = () =>
  new MockLanguageModelV4({
    modelId: 'a-model-the-learner-pulled',
    doStream: [
      step([
        { type: 'stream-start', warnings: [] },
        { type: 'text-start', id: 't1' },
        { type: 'text-delta', id: 't1', delta: 'This should never be asked for.' },
        { type: 'text-end', id: 't1' },
        { type: 'finish', finishReason: { unified: 'stop', raw: 'end_turn' }, usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 } } },
      ]),
    ],
  });

const ending = (events: StoredEvent[]) => events.filter((e) => e.type === 'turn_end').at(-1)!.payload as { ok: boolean; error?: string };

describe('a local turn that will not fit the window', () => {
  it('is refused before the request, with the num_ctx sentence whose one link is Settings', async () => {
    // At the floor, and measured rather than padded to a round number: the real
    // offline-local system prompt plus the real compact tool surface comes to
    // ~13,096 estimated tokens against 0.8 × 16384 = 13,107 usable, which is
    // the eleven tokens of slack amendment A-01 measured. So an *empty* lesson
    // at the floor fits by a hair — and it is the learner's own message that
    // pushes it over. That is why A-01 moved the editable default to 32768:
    // at the floor the second sentence of a lesson is already a refusal.
    // The real catalogue row, resolved the way a turn resolves it: the model id
    // in the refusal sentence comes from `resolveTutor`, so the install has to
    // actually be on the Ollama row rather than merely driven by its driver.
    // That it *can* be set active at all is `teaches: true` taking effect.
    setSetting('active_provider', 'ollama');
    setSetting(numCtxKey('ollama'), String(NUM_CTX_FLOOR));
    setSetting('model:ollama', 'a-model-the-learner-pulled');
    const id = randomUUID();
    createLesson(id, 'A lesson on a window that is too small');

    const model = neverAsked();
    setModelOverride(() => model);
    setDriverOverride(apiDriverFor('ollama'));
    try {
      await runTurn(id, `Teach me this, and here is what I already tried: ${'x'.repeat(3_000)}`);
    } finally {
      setDriverOverride(null);
      setModelOverride(null);
    }

    assert.equal(model.doStreamCalls.length, 0, 'the request went out anyway, so the refusal is not before the request');
    const end = ending(listEvents(id));
    assert.equal(end.ok, false, 'a window that cannot hold the method is a failed turn, not a continuable one');
    const reason = end.error ?? '';
    assert.match(reason, /The method does not fit in this model's context window\./);
    assert.ok(reason.includes('Settings'), 'the num_ctx card’s one link is Settings');
    assert.ok(!reason.includes('Home'), 'this is not the lesson-growth refusal, whose one link is Home — the UI-SPEC is explicit that conflating them is wrong');
    assert.ok(reason.includes(String(NUM_CTX_FLOOR)), 'the sentence names the window the learner actually set');
    assert.ok(reason.includes('a-model-the-learner-pulled'), 'the sentence names the model');
    assert.equal(lastTurn(id)!.status, 'error');

    deleteSetting(numCtxKey('ollama'));
    deleteSetting('model:ollama');
    deleteSetting('active_provider');
  });
});
