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

const { createLesson, deleteSetting, insertMaterial, lastTurn, listEvents, setSetting } = await import('../src/db.js');
const { runTurn } = await import('../src/agent.js');
const { setDriverOverride } = await import('../src/driver.js');
const { SEP, materialsSection } = await import('../src/materials.js');
const { PROVIDERS, providerOf } = await import('../src/providers.js');
const { NUM_CTX_DEFAULT, NUM_CTX_FLOOR, baseUrlKey, numCtxFor, numCtxKey } = await import('../src/settings.js');
const { capabilityRefusalFor, forgetCapabilities, rememberCapability, verdictOf } = await import('../src/capability.js');
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

describe('a local turn on a model the ladder has refused', () => {
  it('is refused before the request, with the capability sentence whose one link is Settings', async () => {
    // The lesson-time backstop. Settings refuses such a model at the write and
    // at the activation, so what this covers is the one that got onto the row
    // before any verdict existed — stored by an older build, or by the
    // environment. The verdict is seeded directly rather than read off a
    // server, because what is under test is the refusal and not the read.
    setSetting('active_provider', 'ollama');
    setSetting('model:ollama', 'a-model-the-learner-pulled');
    const cap = { tools: 'no' as const, maxWindow: 262_144, servedWindow: null };
    rememberCapability('ollama', 'a-model-the-learner-pulled', { ...cap, ...verdictOf('a-model-the-learner-pulled', cap) });

    const id = randomUUID();
    createLesson(id, 'A lesson on a model that cannot call tools');
    const model = neverAsked();
    setModelOverride(() => model);
    setDriverOverride(apiDriverFor('ollama'));
    try {
      await runTurn(id, 'Teach me this.');
    } finally {
      setDriverOverride(null);
      setModelOverride(null);
    }

    assert.equal(model.doStreamCalls.length, 0, 'the prompt went out to a model that cannot act on it');
    const end = ending(listEvents(id));
    assert.equal(end.ok, false, 'a model that cannot call tools cannot teach, so the turn failed rather than being continuable');
    const reason = end.error ?? '';
    assert.equal(reason, capabilityRefusalFor('a-model-the-learner-pulled'), 'the backstop must carry the same approved sentence the row shows');
    assert.ok(reason.includes('Settings'), 'the capability card’s one link is Settings');
    assert.ok(!reason.includes('Home'), 'this is not the lesson-growth refusal');
    assert.equal(lastTurn(id)!.status, 'error');

    forgetCapabilities('ollama');
    deleteSetting('model:ollama');
    deleteSetting('active_provider');
  });

  it('lets a turn through when nothing is known about the model', async () => {
    // The narrowness, which matters as much as the refusal: silence must never
    // stop a lesson. With the row forgotten, the same setup reaches the model.
    forgetCapabilities('ollama');
    setSetting('active_provider', 'ollama');
    setSetting('model:ollama', 'a-model-the-learner-pulled');
    const id = randomUUID();
    createLesson(id, 'A lesson on a model nothing is known about');
    const model = neverAsked();
    setModelOverride(() => model);
    setDriverOverride(apiDriverFor('ollama'));
    try {
      await runTurn(id, 'Teach me this.');
    } finally {
      setDriverOverride(null);
      setModelOverride(null);
    }
    assert.equal(model.doStreamCalls.length, 1, 'an unread verdict refused a turn, which is the one thing the three-valued verdict exists to prevent');

    deleteSetting('model:ollama');
    deleteSetting('active_provider');
  });

  it('measures a read-only row against the window its server reported, instead of abstaining', async () => {
    // D-05 leaves LM Studio serving whatever it was started with, so Derive
    // sends it no window and the price table has none for it either — before
    // the capability read supplied one, `headroomCheck` abstained here and the
    // turn went out to be truncated silently. Now the observed window is what
    // the estimate is measured against.
    setSetting('active_provider', 'lmstudio');
    setSetting('model:lmstudio', 'a-publisher/a-loaded-model');
    setSetting(baseUrlKey('lmstudio'), 'http://127.0.0.1:1234');
    const cap = { tools: 'yes' as const, maxWindow: 262_144, servedWindow: NUM_CTX_FLOOR };
    rememberCapability('lmstudio', 'a-publisher/a-loaded-model', { ...cap, ...verdictOf('a-publisher/a-loaded-model', cap) });

    const id = randomUUID();
    createLesson(id, 'A lesson on a server-set window that is too small');
    const model = neverAsked();
    setModelOverride(() => model);
    setDriverOverride(apiDriverFor('lmstudio'));
    try {
      await runTurn(id, `Teach me this, and here is what I already tried: ${'x'.repeat(3_000)}`);
    } finally {
      setDriverOverride(null);
      setModelOverride(null);
    }

    assert.equal(model.doStreamCalls.length, 0, 'the turn went out, so the served window never reached the estimate');
    const end = ending(listEvents(id));
    assert.equal(end.ok, false);
    const reason = end.error ?? '';
    assert.ok(reason.includes(String(NUM_CTX_FLOOR)), 'the refusal names the window the server actually serves');
    assert.ok(reason.includes('a-publisher/a-loaded-model'), 'the refusal names the model');
    // Pinning the wording, not endorsing it. `headroomCheck` picks its
    // sentence on whether the caller supplied the window, so a read-only row
    // now gets the num_ctx card — whose first fix ("raise it in Settings") does
    // nothing on a row Derive sends no window to, while its second ("pick a
    // model with room") is the real one. Neither locked sentence fits a
    // read-only row; a third is a Copywriting Contract change. This assertion
    // is the failing case that change will have to update, and the finding is
    // recorded in .planning/WINDOWS.md.
    assert.match(reason, /Raise the model's context window in Settings \(num_ctx\)/);

    deleteSetting(baseUrlKey('lmstudio'));
    deleteSetting('model:lmstudio');
    deleteSetting('active_provider');
    forgetCapabilities('lmstudio');
  });
});

/** The three rows the catalogue groups as `local`, named once. */
const LOCAL = ['ollama', 'lmstudio', 'llamacpp'] as const;

describe('all three local rows', () => {
  it('have an owned-loop adapter, and none of them throws', () => {
    for (const id of LOCAL) assert.doesNotThrow(() => adapterFor(id), `${id} still reaches the throwing case`);
  });

  it('project their tools in the compact dialect', () => {
    // D-08 is keyed on the provider being local, so all three answer the same
    // whatever model the learner loaded: a full tool surface in a small local
    // window is how the method's own text gets squeezed out.
    for (const id of LOCAL) assert.equal(adapterFor(id).dialect, 'compact', `${id} is projecting the full tool surface into a local window`);
  });

  it('are the rows the catalogue groups as local, and all of them teach', () => {
    assert.deepEqual(
      PROVIDERS.filter((p) => p.group === 'local').map((p) => p.id),
      [...LOCAL],
      'the local group is what agent.ts derives the material posture from, so the group and this list must be the same three rows',
    );
    for (const id of LOCAL) assert.equal(providerOf(id)!.teaches, true, `${id} does not teach, so it cannot be made active`);
  });
});

describe('the material section on a local row', () => {
  it('is the outline branch whatever the material measures, with the method text byte-identical', () => {
    const id = randomUUID();
    createLesson(id, 'A lesson with a small attached material');
    // Well under INLINE_CHARS, so the default rendering inlines it. That is
    // what makes the local rendering's outline branch a decision rather than a
    // consequence of the size.
    const body = ['A line is a function of the form y = mx + b.', 'Its slope is m.'].join(SEP);
    insertMaterial({ id: randomUUID(), lesson_id: id, name: 'notes.txt', kind: 'txt', unit: 'part', pages: 2, chars: body.length, text: body });

    const full = materialsSection(id);
    const local = materialsSection(id, { outlineOnly: true });

    assert.ok(!full.includes('## Outline'), 'the default rendering of a small material must still inline it');
    assert.ok(local.includes('## Outline'), 'D-09 takes the outline branch on a local row whatever the size');
    assert.ok(full.includes('A line is a function'), 'the default rendering carries the material’s own text');
    assert.ok(!local.includes('--- section 1 ---'), 'the local rendering must not inline the segments it is replacing with an outline');

    // The assertion that proves compaction never reached the method: everything
    // above the branch is rendered method text, gated byte-for-byte by
    // `pnpm method:check`. If a future change shortened it for a local row —
    // the exact failure PROV-06's prohibition names — this is what catches it.
    const methodText = (text: string) => text.slice(0, text.indexOf('# Course material the learner attached') + text.slice(text.indexOf('# Course material the learner attached')).indexOf('\n- Disagree when needed.'));
    assert.equal(methodText(local), methodText(full), 'the method prose that opens the material section must be byte-identical on every surface');
    for (const sentence of ['Method unchanged.', 'You still derive every node from unconditional truths.', 'Disagree when needed.']) {
      assert.ok(local.includes(sentence), `the local rendering dropped the method sentence "${sentence}"`);
    }
  });
});
