import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { APICallError } from 'ai';
import { MockLanguageModelV4, simulateReadableStream } from 'ai/test';

// db.ts opens the database on import and keys.ts reads the secrets file beside
// it; pin the scratch directory before anything under src/ is imported. The two
// environment settings are cleared rather than set, because this suite's whole
// point is that the provider and the model come from the settings table.
const scratch = mkdtempSync(join(tmpdir(), 'derive-test-'));
process.env.DERIVE_DATA_DIR = scratch;
delete process.env.DERIVE_BACKEND;
delete process.env.DERIVE_MODEL;
delete process.env.ANTHROPIC_API_KEY;
delete process.env.TAVILY_API_KEY;

const { createLesson, deleteSetting, getLesson, lastTurn, learnerProfile, listEvents, listNodes, listUsage, loadTurnMessages, recordedToolResult, saveTurnMessages, setSessionId, setSetting, toolRejectionRate, toolRejectionsOf } = await import('../src/db.js');
const { librarySection } = await import('../src/library.js');
const { materialsSection } = await import('../src/materials.js');
const { systemPrompt } = await import('../src/prompt.js');
const { interrupt, runTurn } = await import('../src/agent.js');
const { setDriverOverride } = await import('../src/driver.js');
const { subscribe } = await import('../src/events.js');
const { removeKey, setKey } = await import('../src/keys.js');
const { windowOf } = await import('../src/pricing.js');
const { answerPrompt, pendingId } = await import('../src/prompts.js');
const { SEARCH_BASE_URL, SEARCH_SETTING } = await import('../src/search.js');
const { baseUrlKey } = await import('../src/settings.js');
const { RETRY_BASE_MS, RETRY_WINDOW_MS, STEP_CAP, apiDriverFor, lessonCost, patchOrphans, retryAfterMs, retryDelay, setModelOverride, setSleepOverride, setStepCapOverride } = await import('../src/drivers/api.js');
const { costLabel, costOf } = await import('../src/cost.js');
const { priceTable } = await import('../src/prices.js');

// A dynamic import cannot carry types across, and a static one would open the
// database before the scratch directory above is set; these are type positions
// only, so nothing is imported at run time.
type StoredEvent = import('../src/db.js').StoredEvent;
type ProviderId = import('../src/providers.js').ProviderId;

/**
 * Copied verbatim from EVENT_TYPES in web/src/lib/useLesson.ts. The browser
 * ignores any type not on that list, so a driver needing a new one would be a
 * change to the web app — the thing the driver seam exists to make unnecessary.
 */
const EVENT_TYPES = [
  'ready', 'turn_start', 'turn_end', 'status', 'user', 'block_start', 'delta', 'assistant', 'quiz', 'quiz_result', 'ask', 'ask_result',
  'explain', 'explain_result', 'plan', 'plan_result', 'phase', 'warmup', 'node_status', 'memory', 'preferences', 'material', 'material_removed', 'answer_in', 'resource',
];

after(() => {
  setModelOverride(null);
  setDriverOverride(null);
  setStepCapOverride(null);
  setSleepOverride(null);
  rmSync(scratch, { recursive: true, force: true });
});

// The active provider is the real catalogue row and the key is a real stored
// key: everything below the model object is production code.
setSetting('active_provider', 'anthropic');
setKey('anthropic', 'sk-ant-test-0000000000000000');

/**
 * The five key-and-gateway rows the owned loop teaches on, with a model id each
 * one would really be asked for. The whole suite runs with no network and no
 * real key: the only thing standing in for the provider is the model object.
 */
const TEACHING: readonly { id: ProviderId; model: string }[] = [
  { id: 'anthropic', model: 'claude-opus-5-5' },
  { id: 'openai', model: 'gpt-6-astra' },
  { id: 'gemini', model: 'gemini-3.8-flash' },
  { id: 'openrouter', model: 'anthropic/claude-opus-5.5' },
  { id: 'openai-compatible', model: 'some-model-of-my-own' },
];

for (const { id } of TEACHING) setKey(id, `test-key-for-${id}-0000000000`);
// The row whose address the learner supplies: stored through the same key the settings route writes, and pointed at a port nothing listens on, because nothing here may reach a network.
setSetting(baseUrlKey('openai-compatible'), 'http://127.0.0.1:9');

/** Put the install back on the row the rest of the suite assumes between provider cases. */
const backToAnthropic = () => setSetting('active_provider', 'anthropic');

/** The provider-spec usage shape a model emits — nested, not the flat LanguageModelUsage the SDK hands back. */
const USAGE = {
  inputTokens: { total: 120, noCache: 100, cacheRead: 20, cacheWrite: undefined },
  outputTokens: { total: 30, text: 25, reasoning: 5 },
};

const step = (chunks: unknown[]) => ({ stream: simulateReadableStream({ chunks: chunks as never[], initialDelayInMs: 0, chunkDelayInMs: 0 }) });

const toolCall = (id: string, name: string, input: string) => ({ type: 'tool-call', toolCallId: id, toolName: name, input });
const finish = (unified: string, raw: string) => ({ type: 'finish', finishReason: { unified, raw }, usage: USAGE });

/** One lesson, one turn through the real loop on one provider, with a stub model in place of that provider and everything the stream carried. */
async function turnOn(model: MockLanguageModelV4, prompt = 'teach me', provider: ProviderId = 'anthropic') {
  const id = randomUUID();
  createLesson(id, 'The owned loop');
  const live: StoredEvent[] = [];
  const unsubscribe = subscribe(id, (ev) => live.push(ev));
  setModelOverride(() => model);
  setDriverOverride(apiDriverFor(provider));
  try {
    await runTurn(id, prompt);
  } finally {
    setDriverOverride(null);
    setModelOverride(null);
    unsubscribe();
  }
  return { id, live, stored: listEvents(id) };
}

const types = (events: StoredEvent[]) => events.map((e) => e.type);

/**
 * A `turn_end` payload with the lesson total lifted off, so a case can go on
 * asserting the ending's shape exactly.
 *
 * `lesson_cost` rides **every** ending — the success, the stopping, the catch
 * and the refusals — because `sinkFor`'s endTurn is idempotent and only the
 * first call's payload reaches the browser, so an ending that forgot it would
 * leave a stale figure on the screen (T-03-52). Taking it off here asserts it
 * is there on all of them rather than letting one ending quietly drop it.
 */
function ending(payload: unknown): Record<string, unknown> {
  const { lesson_cost, ...rest } = payload as Record<string, unknown>;
  assert.ok(lesson_cost === null || typeof lesson_cost === 'string', `an ending carried no lesson total: ${JSON.stringify(payload)}`);
  return rest;
}

/** Wait for something a turn in flight is about to do, without racing it. Returns as soon as `f` answers, and throws rather than hanging if it never does. */
async function settle<T>(f: () => T | null, tries = 200): Promise<T> {
  for (let i = 0; i < tries; i += 1) {
    const v = f();
    if (v !== null) return v;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error('nothing settled in time');
}

/** A two-step turn: the tutor calls a tool, then says something and stops. */
const twoStep = (modelId = 'claude-opus-5-5') =>
  new MockLanguageModelV4({
    modelId,
    doStream: [
      step([
        { type: 'stream-start', warnings: [] },
        toolCall('c1', 'set_phase', '{"phase":"plan"}'),
        finish('tool-calls', 'tool_use'),
      ]),
      step([
        { type: 'stream-start', warnings: [] },
        { type: 'text-start', id: 't1' },
        { type: 'text-delta', id: 't1', delta: 'A line ' },
        { type: 'text-delta', id: 't1', delta: 'is a function.' },
        { type: 'text-end', id: 't1' },
        finish('stop', 'end_turn'),
      ]),
    ],
  });

describe("a lesson turn runs on an api key through derive's own loop", () => {
  it('streams the prose as one growing assistant event and ends the turn once', async () => {
    const model = twoStep();
    const { live, stored } = await turnOn(model);

    assert.deepEqual(types(stored), ['turn_start', 'phase', 'assistant', 'turn_end']);
    assert.deepEqual(stored[2].payload, { id: (stored[2].payload as { id: string }).id, text: 'A line is a function.' });
    assert.equal(types(stored).filter((t) => t === 'turn_end').length, 1);
    assert.deepEqual(ending(stored[3].payload), { ok: true, verified: 0 });

    // The live stream carries the status line and the deltas the log does not.
    assert.deepEqual(types(live), ['turn_start', 'status', 'phase', 'assistant', 'delta', 'delta', 'assistant', 'turn_end']);

    // The loop made one model call per step, and the first carried the method
    // text and the lesson's own context as the two system messages of D-06's
    // cache split, with the learner's message after them.
    assert.equal(model.doStreamCalls.length, 2);
    assert.deepEqual(roles(model), ['system', 'system', 'user']);

    for (const ev of [...stored, ...live]) assert.ok(EVENT_TYPES.includes(ev.type), `${ev.type} is not a type the web app knows`);
  });

  it('files the turn and every usage row under the provider, with the uncached input count', async () => {
    const { id } = await turnOn(twoStep());

    const turn = lastTurn(id)!;
    assert.equal(turn.driver, 'anthropic');
    assert.equal(turn.status, 'ok');

    // One row per model request, never one per turn.
    const rows = listUsage({ lesson: id });
    assert.equal(rows.length, 2);
    for (const row of rows) {
      assert.equal(row.driver, 'anthropic');
      assert.equal(row.model, 'claude-opus-5-5');
      // The stub's noCache, not its total: the total already counts the cache read.
      assert.equal(row.input_tokens, 100);
      assert.equal(row.cache_read_tokens, 20);
      assert.equal(row.cache_write_tokens, null);
      assert.equal(row.output_tokens, 30);
      assert.equal(row.reasoning_tokens, 5);
      // The anthropic adapter prices from the table: claude-opus-5-5 carries a rate, so the row is a money figure labelled `estimated`, never a blank.
      assert.equal(row.cost_source, 'table');
      assert.ok(typeof row.cost_usd === 'number' && row.cost_usd > 0, `priced at ${row.cost_usd}`);
    }
  });

  it('refuses a second turn for a lesson already running, and makes no second model call', async () => {
    const id = randomUUID();
    createLesson(id, 'One turn at a time');
    const model = twoStep();
    setModelOverride(() => model);
    setDriverOverride(apiDriverFor('anthropic'));
    try {
      const first = runTurn(id, 'teach me');
      await assert.rejects(() => runTurn(id, 'and again'), /lesson is busy/);
      const calls = model.doStreamCalls.length;
      await first;
      assert.ok(calls <= 2, 'the refused turn must not have opened a third model call');
      assert.equal(model.doStreamCalls.length, 2);
    } finally {
      setDriverOverride(null);
      setModelOverride(null);
    }
  });

  it('runs two tool calls from one step strictly one at a time, in arrival order', async () => {
    // The SDK runs a step's tool calls with Promise.all, so the only thing
    // keeping two cards off the learner's screen is the loop's per-lesson
    // chain. Two blocking tools are what makes that visible: without the chain
    // both `ask` cards open at once and the first assertion below fails.
    const model = new MockLanguageModelV4({
      modelId: 'claude-opus-5-5',
      doStream: [
        step([
          { type: 'stream-start', warnings: [] },
          toolCall('c1', 'ask', '{"question":"first"}'),
          toolCall('c2', 'ask', '{"question":"second"}'),
          finish('tool-calls', 'tool_use'),
        ]),
        step([
          { type: 'stream-start', warnings: [] },
          { type: 'text-start', id: 't1' },
          { type: 'text-delta', id: 't1', delta: 'Done.' },
          { type: 'text-end', id: 't1' },
          finish('stop', 'end_turn'),
        ]),
      ],
    });

    const id = randomUUID();
    createLesson(id, 'One card at a time');
    const live: StoredEvent[] = [];
    const unsubscribe = subscribe(id, (ev) => live.push(ev));
    setModelOverride(() => model);
    setDriverOverride(apiDriverFor('anthropic'));
    try {
      const turn = runTurn(id, 'teach me');
      const asked: string[] = [];
      for (let i = 0; i < 2; i += 1) {
        const promptId = await settle(() => pendingId(id));
        assert.equal(live.filter((e) => e.type === 'ask').length, i + 1, 'a second card opened before the first was answered');
        asked.push((live.filter((e) => e.type === 'ask').at(-1)!.payload as { question: string }).question);
        answerPrompt(id, promptId, { text: 'ok' });
      }
      await turn;

      assert.deepEqual(asked, ['first', 'second'], 'arrival order was not preserved');
      assert.equal(model.doStreamCalls.length, 2);
      for (const ev of live) assert.ok(EVENT_TYPES.includes(ev.type), `${ev.type} is not a type the web app knows`);
    } finally {
      setDriverOverride(null);
      setModelOverride(null);
      unsubscribe();
    }
  });
});

/** A one-step turn that says one thing and stops, carrying whatever the provider attached to its finish part. */
const oneStep = (modelId: string, finishExtra: Record<string, unknown> = {}, usage: unknown = USAGE) =>
  new MockLanguageModelV4({
    modelId,
    doStream: [
      step([
        { type: 'stream-start', warnings: [] },
        { type: 'text-start', id: 't1' },
        { type: 'text-delta', id: 't1', delta: 'Locked.' },
        { type: 'text-end', id: 't1' },
        { type: 'finish', finishReason: { unified: 'stop', raw: 'end_turn' }, usage, ...finishExtra },
      ]),
    ],
  });

describe('every key-and-gateway row teaches through the one loop, under its own name', () => {
  for (const { id, model } of TEACHING) {
    it(`files the turn and every usage row on ${id} under that provider's own id`, async () => {
      setSetting('active_provider', id);
      try {
        const { id: lesson, live, stored } = await turnOn(twoStep(model), 'teach me', id);

        const turn = lastTurn(lesson)!;
        assert.equal(turn.driver, id, 'the turn must name the provider that ran it');
        assert.equal(turn.status, 'ok');

        const rows = listUsage({ lesson });
        assert.equal(rows.length, 2, 'one usage row per model request, never one per turn');
        for (const row of rows) {
          // This is the assertion that keeps the ledger honest: one driver named
          // for the loop rather than the provider would collapse five providers
          // into a single label, in the ledger and in front of the learner, and
          // would make Phase 4's "by provider" totals impossible to compute.
          assert.equal(row.driver, id, 'a usage row filed under a name that is not the provider collapses the ledger');
          assert.equal(row.model, model);
        }

        assert.deepEqual(types(stored), ['turn_start', 'phase', 'assistant', 'turn_end']);
        for (const ev of [...stored, ...live]) assert.ok(EVENT_TYPES.includes(ev.type), `${ev.type} is not a type the web app knows on the ${id} path`);
      } finally {
        backToAnthropic();
      }
    });
  }
});

describe("what a request cost, read from each provider's own answer", () => {
  it("records OpenRouter's own per-response cost as billed", async () => {
    setSetting('active_provider', 'openrouter');
    try {
      // The shape the provider really enqueues on its finish part when
      // `usage: { include: true }` rode on the request. Derive's read of that
      // path is what this proves; that OpenRouter emits it is the vendor's
      // behaviour and is the plan's human check.
      const providerMetadata = { openrouter: { usage: { cost: 0.0123, promptTokens: 100, completionTokens: 30, totalTokens: 130 } } };
      const { id } = await turnOn(oneStep('anthropic/claude-opus-5.5', { providerMetadata }), 'teach me', 'openrouter');

      const rows = listUsage({ lesson: id });
      assert.equal(rows.length, 1);
      assert.equal(rows[0].cost_source, 'provider');
      assert.equal(rows[0].cost_usd, 0.0123);
    } finally {
      backToAnthropic();
    }
  });

  it('falls back to a table figure, never to a blank, when OpenRouter reports no cost', async () => {
    setSetting('active_provider', 'openrouter');
    try {
      const { id } = await turnOn(oneStep('anthropic/claude-opus-5.5'), 'teach me', 'openrouter');

      const rows = listUsage({ lesson: id });
      assert.equal(rows.length, 1);
      // D-03 read literally: the fallback is a money figure from the table, so
      // the learner sees `about $x estimated` rather than a lesson with token
      // counts and no money beside them.
      assert.equal(rows[0].cost_source, 'table');
      assert.ok(typeof rows[0].cost_usd === 'number' && rows[0].cost_usd > 0, `priced at ${rows[0].cost_usd}`);
    } finally {
      backToAnthropic();
    }
  });

  it('leaves an honest blank, and still leaves a row, when an endpoint reports nothing at all', async () => {
    setSetting('active_provider', 'openai-compatible');
    try {
      // An OpenAI-compatible endpoint may simply not send usage, even with
      // includeUsage asked for. The ledger invariant from Phase 1 is that the
      // request still gets a row — nulls and `unknown`, never an estimate.
      const { id } = await turnOn(oneStep('some-model-of-my-own', {}, { inputTokens: {}, outputTokens: {} }), 'teach me', 'openai-compatible');

      const rows = listUsage({ lesson: id });
      assert.equal(rows.length, 1, 'a turn that reported nothing still leaves a row');
      const row = rows[0];
      assert.equal(row.input_tokens, null);
      assert.equal(row.output_tokens, null);
      assert.equal(row.cache_read_tokens, null);
      assert.equal(row.cache_write_tokens, null);
      assert.equal(row.reasoning_tokens, null);
      assert.equal(row.cost_source, 'unknown');
      assert.equal(row.cost_usd, null);
    } finally {
      backToAnthropic();
    }
  });
});

/** What the gemini serialisation case saw, in the order it saw it. Module-scoped so the assertion reads a sequence rather than a snapshot taken at the end. */
const order: string[] = [];

describe('the loop is what serialises tool calls where the provider has no flag', () => {
  it('runs two same-step tool calls one at a time, in arrival order, on gemini', async () => {
    // Gemini is the provider with no parallel-tool option anywhere in its SDK,
    // so here the loop's per-lesson chain is not a belt — it is the only
    // mechanism. Two `ask` cards block on the learner: without the chain both
    // open before either is answered.
    const model = new MockLanguageModelV4({
      modelId: 'gemini-3.8-flash',
      doStream: [
        step([
          { type: 'stream-start', warnings: [] },
          toolCall('c1', 'ask', '{"question":"first"}'),
          toolCall('c2', 'ask', '{"question":"second"}'),
          finish('tool-calls', 'tool_use'),
        ]),
        step([
          { type: 'stream-start', warnings: [] },
          { type: 'text-start', id: 't1' },
          { type: 'text-delta', id: 't1', delta: 'Done.' },
          { type: 'text-end', id: 't1' },
          finish('stop', 'end_turn'),
        ]),
      ],
    });

    const id = randomUUID();
    createLesson(id, 'One card at a time on gemini');
    const live: StoredEvent[] = [];
    const unsubscribe = subscribe(id, (ev) => live.push(ev));
    setSetting('active_provider', 'gemini');
    setModelOverride(() => model);
    setDriverOverride(apiDriverFor('gemini'));
    try {
      const turn = runTurn(id, 'teach me');
      for (let i = 0; i < 2; i += 1) {
        const promptId = await settle(() => pendingId(id));
        const cards = live.filter((e) => e.type === 'ask');
        assert.equal(cards.length, i + 1, 'a second card opened before the first was answered');
        const question = (cards.at(-1)!.payload as { question: string }).question;
        order.push(`open:${question}`);
        answerPrompt(id, promptId, { text: 'ok' });
        order.push(`answered:${question}`);
      }
      await turn;

      // Strictly interleaved: no second `execute` body began before the first returned.
      assert.deepEqual(order, ['open:first', 'answered:first', 'open:second', 'answered:second']);
      assert.equal(lastTurn(id)!.driver, 'gemini');
      for (const ev of live) assert.ok(EVENT_TYPES.includes(ev.type), `${ev.type} is not a type the web app knows`);
    } finally {
      setDriverOverride(null);
      setModelOverride(null);
      unsubscribe();
      backToAnthropic();
    }
  });
});

describe('a lesson the model cannot use derive’s tools in is refused, not taught', () => {
  it('ends the turn with derive’s own sentence when the search tool displaced all fourteen', async () => {
    // @ai-sdk/google drops every function declaration when a provider-defined
    // tool is present on a model it does not treat as Gemini 3, and pushes this
    // one warning instead. A lesson whose tutor can never call set_plan is not
    // a Derive lesson, so it is refused rather than run.
    const model = new MockLanguageModelV4({
      modelId: 'gemini-2.5-flash',
      doStream: [
        step([
          { type: 'stream-start', warnings: [{ type: 'unsupported', feature: 'combination of function and provider-defined tools' }] },
          { type: 'text-start', id: 't1' },
          { type: 'text-delta', id: 't1', delta: 'I will just talk instead.' },
          { type: 'text-end', id: 't1' },
          finish('stop', 'end_turn'),
        ]),
      ],
    });

    setSetting('active_provider', 'gemini');
    try {
      const { stored } = await turnOn(model, 'teach me', 'gemini');

      const ends = stored.filter((e) => e.type === 'turn_end');
      assert.equal(ends.length, 1, 'the turn must end exactly once');
      assert.deepEqual(ending(ends[0].payload), {
        ok: false,
        error: "this model cannot use derive's tools and a web search tool together; pick a newer model, or set web search to tavily or searxng in settings",
      });
      assert.ok(!types(stored).includes('assistant'), 'prose from a tool-less tutor must not be persisted as a lesson');
    } finally {
      backToAnthropic();
    }
  });
});

describe('a stop on a learner-supplied endpoint ends the turn exactly once', () => {
  it('records one turn_end carrying interrupted rather than an error', async () => {
    // Slow enough that Stop lands mid-stream. The driver's catch and its finally
    // both call endTurn, and the bookkeeping around it calls endTurn again, so
    // "exactly one" is what proves the sink's guard is doing its job on this
    // path too.
    const model = new MockLanguageModelV4({
      modelId: 'some-model-of-my-own',
      doStream: [
        {
          stream: simulateReadableStream({
            chunks: [
              { type: 'stream-start', warnings: [] },
              { type: 'text-start', id: 't1' },
              { type: 'text-delta', id: 't1', delta: 'Starting' },
              { type: 'text-delta', id: 't1', delta: ' slowly' },
              { type: 'text-delta', id: 't1', delta: ' indeed' },
              { type: 'text-end', id: 't1' },
              finish('stop', 'end_turn'),
            ] as never[],
            initialDelayInMs: 10,
            chunkDelayInMs: 60,
          }),
        },
      ],
    });

    const id = randomUUID();
    createLesson(id, 'Stop on my own endpoint');
    const live: StoredEvent[] = [];
    const unsubscribe = subscribe(id, (ev) => live.push(ev));
    setSetting('active_provider', 'openai-compatible');
    setModelOverride(() => model);
    setDriverOverride(apiDriverFor('openai-compatible'));
    try {
      const turn = runTurn(id, 'teach me');
      await settle(() => live.find((e) => e.type === 'delta') ?? null);
      await interrupt(id);
      await turn;

      const ends = listEvents(id).filter((e) => e.type === 'turn_end');
      assert.equal(ends.length, 1, 'a stopped turn must end exactly once');
      assert.deepEqual(ending(ends[0].payload), { ok: true, interrupted: true });
      assert.equal(lastTurn(id)!.driver, 'openai-compatible');
      for (const ev of live) assert.ok(EVENT_TYPES.includes(ev.type), `${ev.type} is not a type the web app knows`);
    } finally {
      setDriverOverride(null);
      setModelOverride(null);
      unsubscribe();
      backToAnthropic();
    }
  });
});

/** A one-step turn that says exactly `text` and stops. */
const says = (text: string, modelId = 'claude-opus-5-5') =>
  new MockLanguageModelV4({
    modelId,
    doStream: [
      step([
        { type: 'stream-start', warnings: [] },
        { type: 'text-start', id: 't1' },
        { type: 'text-delta', id: 't1', delta: text },
        { type: 'text-end', id: 't1' },
        finish('stop', 'end_turn'),
      ]),
    ],
  });

/** The roles of a request's messages, which is where a persisted system message would show up. */
const roles = (model: MockLanguageModelV4, call = 0) => model.doStreamCalls[call].prompt.map((m) => m.role);

/** Drive one turn on an already-created lesson with a stub of this test's choosing. */
async function turnWith(id: string, model: MockLanguageModelV4, prompt: string, provider: ProviderId = 'anthropic') {
  setModelOverride(() => model);
  setDriverOverride(apiDriverFor(provider));
  try {
    await runTurn(id, prompt);
  } finally {
    setDriverOverride(null);
    setModelOverride(null);
  }
}

/**
 * Every assistant tool-call id in a request, with whether the same request
 * answers it. A provider refuses a history that asks for a call and never
 * answers it, so this is the shape the orphan patch exists to keep true.
 */
function callsOf(messages: { role: string; content: unknown }[]) {
  const called: string[] = [];
  const answered = new Set<string>();
  for (const m of messages) {
    if (!Array.isArray(m.content)) continue;
    for (const part of m.content as { type: string; toolCallId?: string }[]) {
      if (part.type === 'tool-call' && m.role === 'assistant') called.push(part.toolCallId!);
      if (part.type === 'tool-result') answered.add(part.toolCallId!);
    }
  }
  return called.map((id) => ({ id, answered: answered.has(id) }));
}

/** The system message the model actually received, which is where the method text's web-tool substitution shows up. */
const instructionsOf = (model: MockLanguageModelV4, call = 0) => String(model.doStreamCalls[call].prompt[0].content);

/** The tools the model actually received, by name and by whether the provider executes it itself. */
const toolsOf = (model: MockLanguageModelV4, call = 0) => (model.doStreamCalls[call].tools ?? []).map((t) => ({ name: t.name, provider: t.type !== 'function' }));

/** Put the install back on the provider's own search, which is what a fresh one reads. */
const noFallbackSearch = () => {
  deleteSetting(SEARCH_SETTING);
  deleteSetting(SEARCH_BASE_URL);
};

describe('the method text names the web tools the turn actually has', () => {
  after(() => {
    noFallbackSearch();
    backToAnthropic();
  });

  it("names the provider's own search tool where there is one, and registers that tool and not Derive's", async () => {
    noFallbackSearch();
    backToAnthropic();
    const id = randomUUID();
    createLesson(id, 'Anthropic searches for itself');
    const model = says('Checked.');
    await turnWith(id, model, 'teach me');

    const text = instructionsOf(model);
    assert.match(text, /Web search \(the provider's own search tool\) and `fetch_page`/);
    assert.ok(!text.includes('{{WEB_TOOLS}}'), 'an unsubstituted placeholder reached the model');

    const tools = toolsOf(model);
    // Exactly one search, and it is the provider's: Derive's `web_search` row
    // is omitted, so the tutor is never offered two ways to search in one turn.
    assert.deepEqual(
      tools.filter((t) => t.name === 'web_search'),
      [{ name: 'web_search', provider: true }],
    );
    assert.ok(tools.some((t) => t.name === 'fetch_page' && !t.provider), 'fetch_page is Derive’s own and is registered on every provider');
    assert.equal(tools.length, 16, 'the fourteen tutor tools, fetch_page, and the provider’s search');
  });

  it("names Derive's own web_search where the learner configured a fallback", async () => {
    noFallbackSearch();
    setSetting(SEARCH_SETTING, 'tavily');
    setKey('search:tavily', 'tvly-test-key-00000000');
    setSetting('active_provider', 'openrouter');
    try {
      const id = randomUUID();
      createLesson(id, 'OpenRouter with a key of its own');
      const model = says('Checked.', 'anthropic/claude-opus-5.5');
      await turnWith(id, model, 'teach me', 'openrouter');

      const text = instructionsOf(model);
      assert.match(text, /`web_search` \/ `fetch_page`/);
      assert.ok(!text.includes('{{WEB_TOOLS}}'), 'an unsubstituted placeholder reached the model');

      const tools = toolsOf(model);
      assert.deepEqual(
        tools.filter((t) => t.name === 'web_search'),
        [{ name: 'web_search', provider: false }],
        'the fallback is Derive’s own function tool, not a provider-executed one',
      );
      assert.ok(tools.some((t) => t.name === 'fetch_page'));
      assert.equal(tools.length, 16, 'the fourteen tutor tools plus Derive’s two');
    } finally {
      removeKey('search:tavily');
      noFallbackSearch();
      backToAnthropic();
    }
  });

  it('tells the tutor to admit uncertainty where there is no search at all, and still gives it fetch_page', async () => {
    noFallbackSearch();
    setSetting('active_provider', 'openrouter');
    try {
      const id = randomUUID();
      createLesson(id, 'OpenRouter with nothing configured');
      const model = says('I am not sure.', 'anthropic/claude-opus-5.5');
      await turnWith(id, model, 'teach me', 'openrouter');

      const text = instructionsOf(model);
      assert.match(text, /there is no web search on this provider/);
      assert.match(text, /say plainly when you are unsure of a fact rather than guess or assert it/);
      assert.match(text, /`fetch_page` still reads any page you are given a URL for/);
      // Silent and total: an unsubstituted placeholder would read to the model
      // as the literal characters, which is the failure this rendering exists
      // to prevent.
      assert.ok(!text.includes('{{WEB_TOOLS}}'), 'an unsubstituted placeholder reached the model');

      const tools = toolsOf(model);
      assert.deepEqual(
        tools.filter((t) => /search/.test(t.name)),
        [{ name: 'search_material', provider: false }, { name: 'search_library', provider: false }],
        'no search tool of any kind may be registered when the prompt says there is none',
      );
      assert.ok(tools.some((t) => t.name === 'fetch_page'), 'fetch_page does not depend on a search being available');
      assert.equal(tools.length, 15, 'the fourteen tutor tools plus fetch_page');
    } finally {
      backToAnthropic();
    }
  });
});

describe('a lesson resumes from the history it persisted', () => {
  it("carries the first turn's messages into the second request, with no system message among them", async () => {
    const id = randomUUID();
    createLesson(id, 'Resume on the same provider');

    const first = says('A line is a function.');
    await turnWith(id, first, 'teach me');
    const second = says('And so is a plane.');
    await turnWith(id, second, 'go on');

    // The history was loaded, not rebuilt: the first turn's prose and the
    // learner's first message are both in the second request.
    assert.deepEqual(roles(second), ['system', 'system', 'user', 'assistant', 'user']);
    assert.ok(JSON.stringify(second.doStreamCalls[0].prompt[3]).includes('A line is a function.'), 'the first turn’s prose must be in the second request');
    // Exactly two system messages, and they are the pair `instructions`
    // supplies: the method text is rebuilt from method/ every turn, so a
    // persisted system message would be stale method text.
    assert.equal(roles(second).filter((r) => r === 'system').length, 2);
    assert.deepEqual((loadTurnMessages(id, 'anthropic') as { role: string }[]).map((m) => m.role), ['user', 'assistant', 'user', 'assistant']);
  });

  it('drops the history and the session id together when the provider changes', async () => {
    const id = randomUUID();
    createLesson(id, 'Switched providers mid-lesson');

    setSetting('active_provider', 'anthropic');
    const first = says('On anthropic.');
    await turnWith(id, first, 'teach me');
    // The one comparison, from the other side: nothing is readable under a
    // driver that did not write it, so the drop cannot be forgotten at a call
    // site even before the row is cleared.
    assert.deepEqual(loadTurnMessages(id, 'openai'), []);
    // The owned loop issues no session id, so one is written here: the point of
    // the case is that both die on the same comparison.
    setSessionId(id, 's-anthropic');

    setSetting('active_provider', 'openai');
    try {
      const second = says('On openai.', 'gpt-6-astra');
      await turnWith(id, second, 'go on', 'openai');

      assert.deepEqual(roles(second), ['system', 'system', 'user'], 'the second request carries none of the first turn’s parts');
      assert.ok(!JSON.stringify(second.doStreamCalls[0].prompt).includes('On anthropic.'));
      assert.equal(getLesson(id)!.session_id, null, 'the session id goes with the messages');
      assert.deepEqual(loadTurnMessages(id, 'anthropic'), [], 'the row now belongs to openai');
    } finally {
      backToAnthropic();
    }
  });
});

describe('a stop leaves a history the next turn can be sent', () => {
  it('synthesizes an error-text result for the call it orphaned, and the next request is well formed', async () => {
    // A provider-executed call: the provider ran it and its result never
    // arrived, which is the orphan shape with no race in it. The stream is slow
    // enough that Stop lands after the call and before the stream ends.
    const model = new MockLanguageModelV4({
      modelId: 'claude-opus-5-5',
      doStream: [
        {
          stream: simulateReadableStream({
            chunks: [
              { type: 'stream-start', warnings: [] },
              { type: 'text-start', id: 't1' },
              { type: 'text-delta', id: 't1', delta: 'Checking a source' },
              { type: 'text-end', id: 't1' },
              { type: 'tool-call', toolCallId: 'orphan-1', toolName: 'web_search', input: '{"query":"fourier"}', providerExecuted: true },
              { type: 'text-start', id: 't2' },
              { type: 'text-delta', id: 't2', delta: ' still waiting' },
              { type: 'text-delta', id: 't2', delta: ' on it' },
              { type: 'text-end', id: 't2' },
              finish('stop', 'end_turn'),
            ] as never[],
            initialDelayInMs: 10,
            chunkDelayInMs: 40,
          }),
        },
      ],
    });

    const id = randomUUID();
    createLesson(id, 'Stopped with a call in flight');
    const live: StoredEvent[] = [];
    const unsubscribe = subscribe(id, (ev) => live.push(ev));
    setModelOverride(() => model);
    setDriverOverride(apiDriverFor('anthropic'));
    try {
      const turn = runTurn(id, 'teach me');
      await settle(() => (live.filter((e) => e.type === 'delta').length >= 2 ? true : null));
      await interrupt(id);
      await turn;
    } finally {
      setDriverOverride(null);
      setModelOverride(null);
      unsubscribe();
    }

    const ends = listEvents(id).filter((e) => e.type === 'turn_end');
    assert.equal(ends.length, 1, 'a stopped turn must end exactly once');
    assert.deepEqual(ending(ends[0].payload), { ok: true, interrupted: true }, 'a Stop is interrupted, not failed');
    assert.equal(lastTurn(id)!.status, 'interrupted');

    const stored = loadTurnMessages(id, 'anthropic') as { role: string; content: unknown }[];
    const patched = stored.find((m) => m.role === 'tool')!;
    assert.ok(patched, 'the orphaned call must carry a result');
    assert.deepEqual(patched.content, [
      { type: 'tool-result', toolCallId: 'orphan-1', toolName: 'web_search', output: { type: 'error-text', value: 'The learner stopped the turn before this tool ran.' } },
    ]);

    // And the point of all of it: the next turn's request is a history the
    // provider will accept, with every call answered.
    const next = says('Carrying on.');
    await turnWith(id, next, 'go on');
    const calls = callsOf(next.doStreamCalls[0].prompt as unknown as { role: string; content: unknown }[]);
    assert.deepEqual(calls, [{ id: 'orphan-1', answered: true }]);
  });

  it('answers each unanswered call once and leaves an answered one alone', () => {
    // patchOrphans on its own, so the sentence and the shape are pinned
    // independently of how a turn happens to end.
    const messages = [
      { role: 'assistant' as const, content: [{ type: 'tool-call' as const, toolCallId: 'a', toolName: 'quiz', input: {} }] },
      { role: 'tool' as const, content: [{ type: 'tool-result' as const, toolCallId: 'a', toolName: 'quiz', output: { type: 'json' as const, value: { correct: true } } }] },
      { role: 'assistant' as const, content: [{ type: 'tool-call' as const, toolCallId: 'b', toolName: 'ask', input: {} }] },
    ];
    assert.equal(patchOrphans(messages), 1);
    assert.deepEqual(messages.at(-1), {
      role: 'tool',
      content: [{ type: 'tool-result', toolCallId: 'b', toolName: 'ask', output: { type: 'error-text', value: 'The learner stopped the turn before this tool ran.' } }],
    });
    // Idempotent: it runs on the abort part, in the catch and in the finally.
    assert.equal(patchOrphans(messages), 0);
    assert.equal(messages.length, 4);
  });
});

describe('a replayed tool call returns its recorded result', () => {
  it('runs the action exactly once when the same call id arrives on a later turn', async () => {
    const id = randomUUID();
    createLesson(id, 'A call replayed after a restart');
    const fact = 'they think in pictures';
    const calls = (modelId = 'claude-opus-5-5') =>
      new MockLanguageModelV4({
        modelId,
        doStream: [
          step([{ type: 'stream-start', warnings: [] }, toolCall('replay-1', 'remember', JSON.stringify({ fact })), finish('tool-calls', 'tool_use')]),
          step([
            { type: 'stream-start', warnings: [] },
            { type: 'text-start', id: 't1' },
            { type: 'text-delta', id: 't1', delta: 'Noted.' },
            { type: 'text-end', id: 't1' },
            finish('stop', 'end_turn'),
          ]),
        ],
      });

    await turnWith(id, calls(), 'teach me');
    const firstTurn = lastTurn(id)!.id;
    assert.deepEqual(recordedToolResult(firstTurn, 'replay-1'), { tool: 'remember', output: { ok: true } });
    assert.equal(listEvents(id).filter((e) => e.type === 'memory').length, 1);

    // The second turn is a new turn row, which is exactly the restart case: the
    // guard is asked by lesson, so it still finds what the turn it replaces ran.
    await turnWith(id, calls(), 'go on');

    // The assertion that matters: a replay that re-ran a graded tool would move
    // an FSRS row the learner already earned, so the action must not run twice.
    assert.equal(listEvents(id).filter((e) => e.type === 'memory').length, 1, 'the action ran a second time: a replay must never re-grade');
    const stored = loadTurnMessages(id, 'anthropic') as { role: string; content: unknown }[];
    const results = stored.flatMap((m) => (Array.isArray(m.content) ? (m.content as { type: string; toolCallId?: string; output?: unknown }[]) : [])).filter((p) => p.type === 'tool-result');
    assert.equal(results.length, 1, 'the history carries one result for the call, not two');
    assert.deepEqual(results[0].output, { type: 'json', value: { ok: true } }, 'the replay returned the recorded result');
  });
});

describe('the step cap is a runaway guard, not a failure', () => {
  it('ends a turn that ran into it as interrupted, with the lesson still resumable', async () => {
    setStepCapOverride(2);
    try {
      const model = new MockLanguageModelV4({
        modelId: 'claude-opus-5-5',
        doStream: [
          step([{ type: 'stream-start', warnings: [] }, toolCall('cap-1', 'set_phase', '{"phase":"plan"}'), finish('tool-calls', 'tool_use')]),
          step([{ type: 'stream-start', warnings: [] }, toolCall('cap-2', 'set_phase', '{"phase":"teach"}'), finish('tool-calls', 'tool_use')]),
        ],
      });
      const { id, stored } = await turnOn(model);

      const ends = stored.filter((e) => e.type === 'turn_end');
      assert.equal(ends.length, 1);
      assert.deepEqual(ending(ends[0].payload), { ok: true, interrupted: true }, 'the cap is not an error card');
      assert.equal(lastTurn(id)!.status, 'interrupted');
      assert.equal(model.doStreamCalls.length, 2, 'the cap stopped the loop');
      // Resumable: the next message continues from what this turn persisted.
      assert.ok((loadTurnMessages(id, 'anthropic') as unknown[]).length > 0, 'the lesson must still have a history to resume from');
      for (const ev of stored) assert.ok(EVENT_TYPES.includes(ev.type), `${ev.type} is not a type the web app knows`);
    } finally {
      setStepCapOverride(null);
    }
  });
});

/** An `APICallError` the way a provider's own failure arrives: a status, the headers it carried and the body it sent. */
const apiError = (over: { statusCode?: number; responseHeaders?: Record<string, string>; responseBody?: string; isRetryable?: boolean; message?: string }) =>
  new APICallError({
    message: over.message ?? 'the provider refused the request',
    url: 'https://api.anthropic.com/v1/messages',
    requestBodyValues: {},
    statusCode: over.statusCode,
    responseHeaders: over.responseHeaders,
    responseBody: over.responseBody,
    isRetryable: over.isRetryable,
  });

/** Every status line a run produced, in order. Status is ephemeral, so this only ever reads the live stream. */
const statuses = (events: StoredEvent[]) => events.filter((e) => e.type === 'status').map((e) => String((e.payload as { text?: string }).text ?? ''));

/** A stub that fails `times` times and then teaches one line. The failure is the same object every time, which is what a rate-limited provider behaves like. */
function failsThen(error: unknown, times: number, modelId = 'claude-opus-5-5') {
  let thrown = 0;
  return new MockLanguageModelV4({
    modelId,
    doStream: async () => {
      if (thrown < times) {
        thrown += 1;
        throw error;
      }
      return step([
        { type: 'stream-start', warnings: [] },
        { type: 'text-start', id: 't1' },
        { type: 'text-delta', id: 't1', delta: 'Recovered.' },
        { type: 'text-end', id: 't1' },
        finish('stop', 'end_turn'),
      ]);
    },
  });
}

describe('what the provider asked us to wait, and what the loop waits instead', () => {
  it('reads retry-after-ms before retry-after, takes seconds or an HTTP date, and caps neither', () => {
    assert.equal(retryAfterMs(apiError({ statusCode: 429, responseHeaders: { 'retry-after-ms': '1500' } })), 1500);
    // The precise header wins where both are sent.
    assert.equal(retryAfterMs(apiError({ statusCode: 429, responseHeaders: { 'retry-after-ms': '1500', 'retry-after': '90' } })), 1500);
    // Ninety seconds means ninety seconds. The SDK's own retry caps this at 60 s
    // and shows the learner nothing, which is the whole reason maxRetries is 0.
    assert.equal(retryAfterMs(apiError({ statusCode: 429, responseHeaders: { 'retry-after': '90' } })), 90_000);
    assert.notEqual(retryAfterMs(apiError({ statusCode: 429, responseHeaders: { 'retry-after': '90' } })), 60_000);

    const inThirty = retryAfterMs(apiError({ statusCode: 429, responseHeaders: { 'retry-after': new Date(Date.now() + 30_000).toUTCString() } }));
    assert.ok(typeof inThirty === 'number' && inThirty > 25_000 && inThirty <= 30_000, `an HTTP date read as ${inThirty}`);

    assert.equal(retryAfterMs(apiError({ statusCode: 429 })), null, 'neither header present asks for nothing');
    assert.equal(retryAfterMs(apiError({ statusCode: 429, responseHeaders: { 'retry-after': 'soon' } })), null, 'an unparseable value asks for nothing');
    assert.equal(retryAfterMs(new Error('not a provider failure')), null);
  });

  it('honours a header delay, jitters its own, grows it, and never lets the cumulative wait pass the window', () => {
    assert.equal(retryDelay(0, 2500), 2500, "a header value is taken as given");

    const first = retryDelay(0, null);
    assert.ok(first >= RETRY_BASE_MS && first <= RETRY_BASE_MS * 2, `the first delay was ${first}`);
    const fourth = retryDelay(3, null);
    assert.ok(fourth >= RETRY_BASE_MS * 8 && fourth <= RETRY_BASE_MS * 16, `the fourth delay was ${fourth}`);
    assert.ok(fourth > first, 'the backoff must grow');

    // Jitter, so two lessons hitting one provider's limit together do not retry
    // in lockstep and re-trip it.
    const spread = new Set(Array.from({ length: 24 }, () => retryDelay(3, null)));
    assert.ok(spread.size > 1, 'the delay is not jittered');

    // The clamp, from both sides: no single delay can push the total past the
    // window, and a window already spent asks for no further wait at all.
    for (const spent of [0, 60_000, 119_500, RETRY_WINDOW_MS]) {
      const delay = retryDelay(0, 500_000, spent);
      assert.ok(spent + delay <= RETRY_WINDOW_MS, `${spent} + ${delay} overran the window`);
    }
    assert.equal(retryDelay(0, 500_000, RETRY_WINDOW_MS), 0, 'a spent window asks for no more waiting');
    assert.ok(retryDelay(30, null) <= RETRY_WINDOW_MS, 'an unbounded exponent must still be clamped');
  });
});

describe('a busy provider is waited out, visibly, and nothing about the wait is kept', () => {
  it('counts the backoff down in whole seconds, says so while the attempt is in flight, and persists none of it', async () => {
    // Collapsed so the suite does not sleep: the countdown ticks once per whole
    // second of the delay by construction, not by reading the clock, so the
    // lines below are the ones a learner would really see.
    setSleepOverride(async () => undefined);
    try {
      const model = failsThen(apiError({ statusCode: 429, responseHeaders: { 'retry-after': '3' }, responseBody: '{"error":{"message":"slow down"}}', isRetryable: true }), 1);
      const { id, live, stored } = await turnOn(model);

      const seen = statuses(live);
      assert.ok(seen.some((t) => /^Provider busy, retrying in \d+s$/.test(t)), `no countdown line among ${JSON.stringify(seen)}`);
      assert.ok(seen.includes('Provider busy, retrying now'), 'the countdown reached zero with no line saying the attempt was in flight');
      // Three seconds asked for, three seconds counted: the number read and the
      // time waited are the same number.
      assert.deepEqual(seen.filter((t) => t.startsWith('Provider busy, retrying in')), ['Provider busy, retrying in 3s', 'Provider busy, retrying in 2s', 'Provider busy, retrying in 1s']);
      // No attempt counter: `attempt 3 of 6` is machinery the learner cannot act on.
      for (const t of seen) assert.ok(!/attempt/i.test(t), `a status line named an attempt: ${t}`);

      // A transient stall is not part of what the learner learned, so it reaches
      // neither the event log, the SSE replay nor their Obsidian notes.
      assert.ok(!types(stored).includes('status'), 'a status line was persisted');
      assert.ok(!JSON.stringify(stored).includes('Provider busy'), 'the stall reached the durable record');

      assert.equal(model.doStreamCalls.length, 2, 'the loop retried exactly once');
      const ends = stored.filter((e) => e.type === 'turn_end');
      assert.equal(ends.length, 1);
      assert.deepEqual(ending(ends[0].payload), { ok: true, verified: 0 }, 'a survived rate limit is an ordinary turn');
      assert.ok(JSON.stringify(stored).includes('Recovered.'), 'the lesson carried on after the wait');
      assert.equal(listEvents(id).filter((e) => e.type === 'status').length, 0);
      for (const ev of [...stored, ...live]) assert.ok(EVENT_TYPES.includes(ev.type), `${ev.type} is not a type the web app knows`);
    } finally {
      setSleepOverride(null);
    }
  });

  it('ends the wait the moment the learner presses Stop, rather than at the end of the countdown', async () => {
    // A tick that takes 50 ms rather than a second, so a ten-second backoff is
    // observable inside a test. The wall clock therefore measures ticks, not
    // seconds — which is why the assertions below are about how far the countdown
    // got and how many attempts were made, not about elapsed milliseconds.
    setSleepOverride((ms) => new Promise((r) => setTimeout(r, ms > 0 ? 50 : 0)));
    const model = failsThen(apiError({ statusCode: 429, responseHeaders: { 'retry-after': '10' }, responseBody: '{"error":{"message":"slow down"}}', isRetryable: true }), Number.POSITIVE_INFINITY);
    const id = randomUUID();
    createLesson(id, 'Stopped while the provider was busy');
    const live: StoredEvent[] = [];
    const unsubscribe = subscribe(id, (ev) => live.push(ev));
    setModelOverride(() => model);
    setDriverOverride(apiDriverFor('anthropic'));
    const began = Date.now();
    try {
      const turn = runTurn(id, 'teach me');
      await settle(() => (statuses(live).some((t) => t.startsWith('Provider busy, retrying in')) ? true : null));
      await interrupt(id);
      await turn;
    } finally {
      setDriverOverride(null);
      setModelOverride(null);
      setSleepOverride(null);
      unsubscribe();
    }

    const ticks = statuses(live).filter((t) => t.startsWith('Provider busy, retrying in')).length;
    assert.ok(ticks > 0 && ticks < 10, `the countdown ran to ${ticks} of its ten ticks instead of being cut short`);
    assert.equal(model.doStreamCalls.length, 1, 'the Stop must land inside the first backoff, not after a second attempt');
    assert.ok(Date.now() - began < RETRY_WINDOW_MS, 'the turn waited out the whole window');

    const ends = listEvents(id).filter((e) => e.type === 'turn_end');
    assert.equal(ends.length, 1, 'a stopped turn must end exactly once');
    assert.deepEqual(ending(ends[0].payload), { ok: true, interrupted: true }, 'a Stop during a backoff is interrupted, not failed');
    assert.equal(lastTurn(id)!.status, 'interrupted');
  });

  it("ends an exhausted retry in the provider's own sentence, with derive's hint on its own line", async () => {
    setSleepOverride(async () => undefined);
    try {
      const model = failsThen(
        apiError({ statusCode: 429, responseBody: '{"error":{"message":"rate limit exceeded for requests per minute"}}', isRetryable: true }),
        Number.POSITIVE_INFINITY,
      );
      const { id, live, stored } = await turnOn(model);

      const ends = stored.filter((e) => e.type === 'turn_end');
      assert.equal(ends.length, 1, 'the turn must end exactly once');
      const payload = ends[0].payload as { ok: boolean; error: string };
      assert.equal(payload.ok, false, 'an exhausted retry is a failed turn');
      // The provider's own words, unchanged: providerSentence's `${status} ${message}`.
      assert.ok(payload.error.startsWith('429 rate limit exceeded for requests per minute'), `the provider's sentence is missing from ${JSON.stringify(payload.error)}`);
      // Derive's fix hint beside them, on its own line — never folded into the
      // provider's sentence and never a paraphrase of it.
      assert.ok(payload.error.includes('\n'), "derive's hint must be on its own line");
      assert.equal(payload.error.split('\n')[1], 'Rate limited; wait a moment and test again.');
      // Every other error string reaching the browser's error card carries no
      // `Home`, so the card's one-link split leaves them rendering as plain text.
      assert.ok(!payload.error.includes('Home'), 'an error string carrying Home would be split by the refusal card renderer');

      assert.ok(model.doStreamCalls.length > 1, 'the loop must have been patient before giving up');
      assert.ok(!types(stored).includes('status'), 'the ephemeral countdown must not survive in the record');
      assert.ok(!JSON.stringify(stored).includes('Provider busy'), 'the stall reached the durable record');
      assert.ok(statuses(live).some((t) => t.startsWith('Provider busy, retrying in')), 'the learner was given no visible reason for the wait');
      assert.equal(lastTurn(id)!.status, 'error');
      for (const ev of [...stored, ...live]) assert.ok(EVENT_TYPES.includes(ev.type), `${ev.type} is not a type the web app knows`);
    } finally {
      setSleepOverride(null);
    }
  });

  it('fails a refused key immediately, without pretending it was a rate limit', async () => {
    setSleepOverride(async () => undefined);
    try {
      const model = failsThen(
        apiError({ statusCode: 401, responseBody: '{"error":{"message":"invalid x-api-key"}}', isRetryable: false, message: 'invalid x-api-key' }),
        Number.POSITIVE_INFINITY,
      );
      const { live, stored } = await turnOn(model);

      // A wrong key must not spend two minutes behind a `Provider busy` line.
      assert.equal(model.doStreamCalls.length, 1, 'a non-retryable failure must not be retried');
      assert.ok(!statuses(live).some((t) => t.startsWith('Provider busy')), 'a refused key was shown as a busy provider');
      const ends = stored.filter((e) => e.type === 'turn_end');
      assert.equal(ends.length, 1);
      assert.equal((ends[0].payload as { ok: boolean }).ok, false);
    } finally {
      setSleepOverride(null);
    }
  });
});

/** The verbatim refusal from 03-UI-SPEC.md §Copywriting Contract → Context-window refusal (A6), em dash and full stop included. */
const REFUSAL = 'This lesson has grown too long to continue. Everything you locked is saved — start a review lesson on these nodes from Home.';

/** A history long enough to overrun a one-million-token window at three characters per token with twenty per cent held back. */
const tooLong = () => [{ role: 'user', content: 'x'.repeat(2_500_000) }];

describe('a lesson that outgrew the model’s window is refused before the request', () => {
  it('makes no request at all, and ends the turn failed with derive’s own sentence', async () => {
    assert.equal(windowOf('anthropic', 'claude-opus-5-5'), 1_000_000, 'the case rests on the table carrying a window for this model');

    const id = randomUUID();
    createLesson(id, 'A lesson that grew too long');
    saveTurnMessages(id, 'anthropic', tooLong());

    const model = says('This should never be asked for.');
    await turnWith(id, model, 'go on');

    // The whole point of checking before the request: the learner gets Derive's
    // sentence rather than one of five provider error shapes, and pays for
    // nothing.
    assert.ok(model.doStreamCalls.length === 0, 'the request was made anyway');
    const ends = listEvents(id).filter((e) => e.type === 'turn_end');
    assert.equal(ends.length, 1, 'the refusal must end the turn exactly once');
    assert.deepEqual(ending(ends[0].payload), { ok: false, error: REFUSAL });
    // Failed, not interrupted: a lesson that no longer fits its window cannot
    // continue, which is what separates this from a Stop and from the step cap.
    assert.equal(lastTurn(id)!.status, 'error');
    for (const ev of listEvents(id)) assert.ok(EVENT_TYPES.includes(ev.type), `${ev.type} is not a type the web app knows`);
  });

  it('does not refuse a model the table has no window for', async () => {
    assert.equal(windowOf('openai-compatible', 'some-model-of-my-own'), undefined, 'the abstain case rests on the table carrying no window');

    const id = randomUUID();
    createLesson(id, 'A long lesson on my own endpoint');
    saveTurnMessages(id, 'openai-compatible', tooLong());
    setSetting('active_provider', 'openai-compatible');
    try {
      const model = says('Carrying on regardless.', 'some-model-of-my-own');
      await turnWith(id, model, 'go on', 'openai-compatible');

      // Refusing a learner's perfectly capable endpoint on a guessed window
      // would be worse than letting that endpoint's own error through.
      assert.equal(model.doStreamCalls.length, 1, 'an unlisted window must abstain, not refuse');
      const ends = listEvents(id).filter((e) => e.type === 'turn_end');
      assert.equal((ends.at(-1)!.payload as { ok: boolean }).ok, true);
    } finally {
      backToAnthropic();
    }
  });

  it('gives a learner who retries one card per attempt, with no deduplication and no counter', async () => {
    const id = randomUUID();
    createLesson(id, 'Refused twice');
    saveTurnMessages(id, 'anthropic', tooLong());

    await turnWith(id, says('never asked'), 'go on');
    await turnWith(id, says('never asked'), 'and again');

    const refusals = listEvents(id).filter((e) => e.type === 'turn_end' && (e.payload as { ok: boolean }).ok === false);
    assert.equal(refusals.length, 2, 'two attempts must leave two timeline items');
    for (const r of refusals) assert.deepEqual(ending(r.payload), { ok: false, error: REFUSAL });
  });
});

describe('three endings, three shapes', () => {
  it('keeps a stop and the step cap continuable while the refusal is failed', async () => {
    // Why the distinction matters: a continuable end leaves the lesson
    // resumable, so the learner's next message carries it on; a failed end tells
    // them it cannot continue. Folding the three into one shape would either
    // strand a resumable lesson behind an error card or quietly promise that a
    // lesson which no longer fits its window can be continued.
    assert.equal(STEP_CAP, 400, 'the production cap is the Claude driver’s own maxTurns');

    const stopped = randomUUID();
    createLesson(stopped, 'Ending one: a stop');
    const slow = new MockLanguageModelV4({
      modelId: 'claude-opus-5-5',
      doStream: [
        {
          stream: simulateReadableStream({
            chunks: [
              { type: 'stream-start', warnings: [] },
              { type: 'text-start', id: 't1' },
              { type: 'text-delta', id: 't1', delta: 'Going' },
              { type: 'text-delta', id: 't1', delta: ' slowly' },
              { type: 'text-end', id: 't1' },
              finish('stop', 'end_turn'),
            ] as never[],
            initialDelayInMs: 10,
            chunkDelayInMs: 60,
          }),
        },
      ],
    });
    const liveStop: StoredEvent[] = [];
    const un = subscribe(stopped, (ev) => liveStop.push(ev));
    setModelOverride(() => slow);
    setDriverOverride(apiDriverFor('anthropic'));
    try {
      const turn = runTurn(stopped, 'teach me');
      await settle(() => liveStop.find((e) => e.type === 'delta') ?? null);
      await interrupt(stopped);
      await turn;
    } finally {
      setDriverOverride(null);
      setModelOverride(null);
      un();
    }

    const capped = randomUUID();
    createLesson(capped, 'Ending two: the step cap');
    setStepCapOverride(2);
    try {
      await turnWith(
        capped,
        new MockLanguageModelV4({
          modelId: 'claude-opus-5-5',
          doStream: [
            step([{ type: 'stream-start', warnings: [] }, toolCall('three-1', 'set_phase', '{"phase":"plan"}'), finish('tool-calls', 'tool_use')]),
            step([{ type: 'stream-start', warnings: [] }, toolCall('three-2', 'set_phase', '{"phase":"teach"}'), finish('tool-calls', 'tool_use')]),
          ],
        }),
        'teach me',
      );
    } finally {
      setStepCapOverride(null);
    }

    const refused = randomUUID();
    createLesson(refused, 'Ending three: the refusal');
    saveTurnMessages(refused, 'anthropic', tooLong());
    await turnWith(refused, says('never asked'), 'go on');

    const endOf = (lesson: string) => listEvents(lesson).filter((e) => e.type === 'turn_end').at(-1)!.payload as Record<string, unknown>;
    assert.deepEqual(ending(endOf(stopped)), { ok: true, interrupted: true }, 'a stop stays resumable');
    assert.deepEqual(ending(endOf(capped)), { ok: true, interrupted: true }, 'the cap is a runaway guard, not a failure');
    assert.deepEqual(ending(endOf(refused)), { ok: false, error: REFUSAL }, 'the refusal says the lesson cannot continue');
    // The lesson total rides all three endings, and it is the figure the two
    // screens read. `sinkFor`'s endTurn is idempotent, so an ending that
    // forgot it would leave the header showing the previous total (T-03-52).
    for (const [name, lesson] of [['a stop', stopped], ['the step cap', capped], ['the refusal', refused]] as const) {
      assert.equal((endOf(lesson) as { lesson_cost?: unknown }).lesson_cost, lessonCost(lesson), `${name} carried a lesson total the views do not agree with`);
    }
    assert.equal(lastTurn(stopped)!.status, 'interrupted');
    assert.equal(lastTurn(capped)!.status, 'interrupted');
    assert.equal(lastTurn(refused)!.status, 'error');
  });
});

/** The error text the model was handed back for one tool call, from the turn's own persisted history. */
const toolErrorsOf = (lesson: string, provider: ProviderId = 'anthropic') =>
  (loadTurnMessages(lesson, provider) as { role: string; content: unknown }[])
    .filter((m) => m.role === 'tool' && Array.isArray(m.content))
    .flatMap((m) => m.content as { type: string; output?: { type: string; value?: unknown } }[])
    .filter((p) => p.type === 'tool-result' && p.output?.type === 'error-text')
    .map((p) => String(p.output!.value));

describe('a narrower dialect does not narrow what derive accepts', () => {
  it('refuses a set_plan the full schema rejects, without running the tool and without failing the turn', async () => {
    // A plan of one node: the registry holds the model to 3 to 12, and nothing
    // below this line may write a graph the method does not allow.
    const id = randomUUID();
    createLesson(id, 'One node is not a plan');
    const model = new MockLanguageModelV4({
      modelId: 'claude-opus-5-5',
      doStream: [
        step([
          { type: 'stream-start', warnings: [] },
          toolCall('bad-1', 'set_plan', '{"goal":"Understand lines","nodes":[{"id":"a","label":"A line is a function","kind":"goal","summary":"A line is a function of one variable."}]}'),
          finish('tool-calls', 'tool_use'),
        ]),
        step([
          { type: 'stream-start', warnings: [] },
          { type: 'text-start', id: 't1' },
          { type: 'text-delta', id: 't1', delta: 'Let me try that again with three nodes.' },
          { type: 'text-end', id: 't1' },
          finish('stop', 'end_turn'),
        ]),
      ],
    });
    await turnWith(id, model, 'teach me');

    const stored = listEvents(id);
    // The tool body never ran: no plan was drawn and no node was written. This
    // is the assertion that matters — validation that happens after the action
    // has already written to the learner's record is not validation.
    assert.ok(!types(stored).includes('plan'), 'the tool body ran: a plan the full schema rejects reached the learner');
    assert.equal(listNodes(id).length, 0, 'a graph was written from arguments the registry refuses');

    // The model was told what was wrong, by field, and got another step to fix it.
    const errors = toolErrorsOf(id);
    assert.equal(errors.length, 1, 'the model was not handed exactly one tool error for the one bad call');
    assert.match(errors[0], /^set_plan: nodes: /, 'a tool error must name the tool and the field that failed');
    assert.equal(model.doStreamCalls.length, 2, 'the model was not given a second step to correct itself');
    assert.ok(
      JSON.stringify(model.doStreamCalls[1].prompt).includes('set_plan: nodes'),
      'the correction never reached the model: the next request does not carry the error',
    );

    // A malformed call is the model's mistake to fix, not a turn to fail.
    assert.deepEqual(ending(stored.at(-1)!.payload), { ok: true, verified: 0 }, 'a refused tool call must not fail the turn');
    assert.equal(lastTurn(id)!.status, 'ok');
  });

  it('enforces a bound on gemini that the gemini dialect could not express', async () => {
    // This is the whole point of validating against the full schema rather than
    // the dialect: the schema Gemini was shown carries no minItems at all, so a
    // quiz of one option is a call Gemini had no way to refuse. Derive refuses
    // it anyway, at the boundary that writes to the learner's record.
    setSetting('active_provider', 'gemini');
    try {
      const id = randomUUID();
      createLesson(id, 'One option is not a question');
      const model = new MockLanguageModelV4({
        modelId: 'gemini-3.8-flash',
        doStream: [
          step([
            { type: 'stream-start', warnings: [] },
            toolCall('gem-1', 'quiz', '{"question":"Is a line a function?","options":["Yes"],"correct":[0],"explanation":"It passes the vertical line test."}'),
            finish('tool-calls', 'tool_use'),
          ]),
          step([
            { type: 'stream-start', warnings: [] },
            { type: 'text-start', id: 't1' },
            { type: 'text-delta', id: 't1', delta: 'Two options, then.' },
            { type: 'text-end', id: 't1' },
            finish('stop', 'end_turn'),
          ]),
        ],
      });
      await turnWith(id, model, 'teach me', 'gemini');

      const stored = listEvents(id);
      assert.ok(!types(stored).includes('quiz'), 'a quiz with one option reached the learner');
      const errors = toolErrorsOf(id, 'gemini');
      assert.equal(errors.length, 1);
      assert.match(errors[0], /^quiz: options: /, 'the refusal must name the field the dialect could not bound');
      assert.deepEqual(ending(stored.at(-1)!.payload), { ok: true, verified: 0 });
    } finally {
      backToAnthropic();
    }
  });

  it('shows gemini a schema with no bounds in it, and anthropic one with them', async () => {
    // Pinned to the wire rather than to the fixture alone: this asserts the
    // bytes the provider's own adapter actually received for this turn.
    const onGemini = randomUUID();
    createLesson(onGemini, 'What gemini is shown');
    setSetting('active_provider', 'gemini');
    let gemini: MockLanguageModelV4;
    try {
      gemini = says('Checked.', 'gemini-3.8-flash');
      await turnWith(onGemini, gemini, 'teach me', 'gemini');
    } finally {
      backToAnthropic();
    }

    const onAnthropic = randomUUID();
    createLesson(onAnthropic, 'What anthropic is shown');
    const anthropic = says('Checked.');
    await turnWith(onAnthropic, anthropic, 'teach me');

    const schemasOf = (m: MockLanguageModelV4) => JSON.stringify((m.doStreamCalls[0].tools ?? []).filter((t) => t.type === 'function'));
    assert.ok(!schemasOf(gemini!).includes('minItems'), 'gemini was shown a keyword its own dialect drops, which is a 400 from Google rather than a warning');
    assert.ok(!schemasOf(gemini!).includes('additionalProperties'), 'gemini was shown additionalProperties, which is not in its keyword set');
    assert.ok(schemasOf(anthropic).includes('minItems'), 'anthropic lost the bounds the tutor is held to');
    assert.ok(schemasOf(anthropic).includes('"additionalProperties":false'), 'anthropic lost additionalProperties: false');
  });
});

/**
 * D-06's cache split, on the wire.
 *
 * The saving is invisible from the outside — a cached request looks exactly
 * like an uncached one except in the bill — so everything here asserts the
 * bytes the provider actually received: where the split falls, which half
 * carries the breakpoint, and that the first half does not move between
 * requests. A prefix that moves is a prefix nothing caches.
 */
describe('the system prompt ships as a stable prefix and a volatile tail', () => {
  after(() => {
    noFallbackSearch();
    backToAnthropic();
  });

  it('sends exactly two system messages, stable first, with the breakpoint only on the half that may be cached', async () => {
    noFallbackSearch();
    backToAnthropic();
    const id = randomUUID();
    createLesson(id, 'What the cache split sends');
    const model = says('Split.');
    await turnWith(id, model, 'teach me');
    const lesson = getLesson(id)!;

    const prompt = model.doStreamCalls[0].prompt;
    assert.deepEqual(roles(model), ['system', 'system', 'user']);
    // Byte-equal to the method text and the tool contract, and to nothing
    // else: anything per-turn in here would be a cache miss on every request.
    assert.equal(prompt[0].content, systemPrompt({ kind: 'api', search: 'native' }));
    // The tail is the three sections that change while a lesson runs — the
    // material, the library and the learner profile — which is what keeps the
    // learner's own content out of the cached half (T-03-54).
    assert.equal(prompt[1].content, materialsSection(id) + librarySection(lesson.learner_id, lesson.topic) + learnerProfile(lesson.learner_id, id));
    // Anthropic caches nothing unless a breakpoint says where the reusable
    // prefix ends, so the stable entry carries one and the volatile entry
    // never does.
    assert.deepEqual(prompt[0].providerOptions, { anthropic: { cacheControl: { type: 'ephemeral' } } });
    assert.equal(prompt[1].providerOptions, undefined);
  });

  it('attaches nothing on a provider that caches a prefix by itself', async () => {
    noFallbackSearch();
    setSetting('active_provider', 'openai');
    try {
      const id = randomUUID();
      createLesson(id, 'OpenAI caches on its own');
      const model = says('Split.', 'gpt-6-astra');
      await turnWith(id, model, 'teach me', 'openai');

      const prompt = model.doStreamCalls[0].prompt;
      assert.deepEqual(roles(model), ['system', 'system', 'user']);
      assert.equal(prompt[0].providerOptions, undefined, 'openai takes no breakpoint; keeping the prefix byte-stable is the whole contribution');
      assert.equal(prompt[1].providerOptions, undefined);
    } finally {
      backToAnthropic();
    }
  });

  it('sends a byte-identical prefix on every request of a lesson', async () => {
    noFallbackSearch();
    backToAnthropic();
    const id = randomUUID();
    createLesson(id, 'Two turns, one prefix');

    // Two steps of one turn, and then a second turn resuming the same lesson:
    // the lesson's own state changed in between and the prefix did not, which
    // is the whole optimisation in one assertion.
    const first = twoStep();
    await turnWith(id, first, 'teach me');
    const second = says('And so is a plane.');
    await turnWith(id, second, 'go on');

    const prefix = String(first.doStreamCalls[0].prompt[0].content);
    assert.equal(String(first.doStreamCalls[1].prompt[0].content), prefix, 'the prefix moved between two steps of one turn');
    assert.equal(String(second.doStreamCalls[0].prompt[0].content), prefix, 'the prefix moved between two turns of one lesson');
    // The tail is what carried the change, so the request as a whole did move.
    assert.notEqual(String(second.doStreamCalls[0].prompt[1].content) + JSON.stringify(second.doStreamCalls[0].prompt.slice(2)), String(first.doStreamCalls[0].prompt[1].content) + JSON.stringify(first.doStreamCalls[0].prompt.slice(2)));
  });

  it('files a cache read and a cache write in their own columns, leaving input_tokens the uncached count', async () => {
    noFallbackSearch();
    backToAnthropic();
    const id = randomUUID();
    createLesson(id, 'What a cached request records');
    const model = new MockLanguageModelV4({
      modelId: 'claude-opus-5-5',
      doStream: [
        step([
          { type: 'stream-start', warnings: [] },
          { type: 'text-start', id: 't1' },
          { type: 'text-delta', id: 't1', delta: 'Cached.' },
          { type: 'text-end', id: 't1' },
          {
            type: 'finish',
            finishReason: { unified: 'stop', raw: 'end_turn' },
            // The total already counts the cache read and the cache write. A
            // ledger that stored it as input would price a well-cached lesson
            // at roughly twice what it actually cost.
            usage: { inputTokens: { total: 9_400, noCache: 400, cacheRead: 8_000, cacheWrite: 1_000 }, outputTokens: { total: 50, text: 50, reasoning: undefined } },
          },
        ]),
      ],
    });
    await turnWith(id, model, 'teach me');

    const rows = listUsage({ lesson: id });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].input_tokens, 400, 'the uncached count, never the total that includes the cache read and write');
    assert.equal(rows[0].cache_read_tokens, 8_000);
    assert.equal(rows[0].cache_write_tokens, 1_000);
    assert.equal(rows[0].output_tokens, 50);
    // The saving is visible in the ledger from the first lesson: a cache read
    // is priced at its own rate, so the row costs far less than 9,400 input
    // tokens would have.
    assert.equal(rows[0].cost_source, 'table');
    assert.ok(typeof rows[0].cost_usd === 'number' && rows[0].cost_usd > 0, `priced at ${rows[0].cost_usd}`);
  });
});

/**
 * The figure the header pill and the Home row read.
 *
 * It is a LESSON total, not one turn's `cost_usd`, and the two screens read one
 * server-computed string so they cannot diverge (T-03-51). The byte-identity of
 * the two HTTP endpoints is asserted in `usage.test.ts`; here it is the ending
 * of a turn and the sum behind it.
 */
describe('a turn ends with what the whole lesson has cost', () => {
  after(() => backToAnthropic());

  it('carries the sum over the lesson, not the cost of the turn that just ended', async () => {
    backToAnthropic();
    const id = randomUUID();
    createLesson(id, 'What this lesson has cost');
    await turnWith(id, twoStep(), 'teach me');
    await turnWith(id, says('And so is a plane.'), 'go on');

    const end = listEvents(id).filter((e) => e.type === 'turn_end').at(-1)!.payload as { lesson_cost: string | null };
    const all = listUsage({ lesson: id });
    const thisTurn = listUsage({ turn: lastTurn(id)!.id });
    assert.ok(all.length > thisTurn.length, 'the first turn must have left rows of its own, or this case proves nothing');

    const whole = costOf(all, priceTable());
    const justThisTurn = costOf(thisTurn, priceTable());
    assert.ok(whole.usd !== null && justThisTurn.usd !== null && whole.usd > justThisTurn.usd, 'the lesson total must be more than the last turn alone');
    assert.equal(end.lesson_cost, costLabel(whole.usd, whole.source), 'the ending carried something other than the lesson total');
    assert.equal(end.lesson_cost, lessonCost(id), 'the ending and the views must read the same string');
    // The table is not the invoice, so the word is `estimated` and the figure says `about`.
    assert.match(String(end.lesson_cost), /^(about \$\d+\.\d\d|under \$0\.01) estimated$/);
  });

  it('says nothing at all for a lesson with no usage rows', () => {
    const id = randomUUID();
    createLesson(id, 'A lesson before its first turn');
    // Null rather than `$0.00 estimated`: a lesson that has not run yet has
    // nothing to say, and the caller renders no segment rather than an empty
    // one.
    assert.equal(lessonCost(id), null);
  });
});

/**
 * The tool-rejection count (04 D-19): one row per call whose arguments failed
 * the full server-side schema, and nothing else.
 *
 * It is measured here rather than in `usage.test.ts` — where the rest of the
 * ledger's cases live — because only this file can make a malformed call
 * actually reach the loop: the recording site is inside the owned loop's tool
 * `execute`, and a stub model is the one way to produce a bad call there. The
 * ledger's own rules (where the provider and model come from, the indexed read,
 * the delete) are asserted beside the usage rows.
 */
describe('how often a model produces a call derive cannot accept', () => {
  it('records exactly one row for a schema-rejected call, under the turn\'s own provider and model', async () => {
    const id = randomUUID();
    createLesson(id, 'One node is not a plan, and it is counted');
    const model = new MockLanguageModelV4({
      modelId: 'claude-opus-5-5',
      doStream: [
        step([
          { type: 'stream-start', warnings: [] },
          toolCall('count-1', 'set_plan', '{"goal":"Understand lines","nodes":[{"id":"a","label":"A line is a function","kind":"goal","summary":"A line is a function of one variable."}]}'),
          finish('tool-calls', 'tool_use'),
        ]),
        step([
          { type: 'stream-start', warnings: [] },
          { type: 'text-start', id: 't1' },
          { type: 'text-delta', id: 't1', delta: 'Three nodes, then.' },
          { type: 'text-end', id: 't1' },
          finish('stop', 'end_turn'),
        ]),
      ],
    });
    await turnWith(id, model, 'teach me');

    const turn = lastTurn(id)!;
    const rows = toolRejectionsOf(turn.id);
    assert.equal(rows.length, 1, 'a schema-rejected call was not counted exactly once');
    assert.equal(rows[0].tool, 'set_plan', 'the row must name the tool the model failed on, not just that it failed');
    // Off the turn, never from the caller: the same rule recordUsage states.
    assert.equal(rows[0].driver, turn.driver);
    assert.equal(rows[0].model, turn.model);
    assert.equal(toolRejectionRate(turn.driver, turn.model).by_tool.set_plan >= 1, true);

    // D-21: no runtime effect. The model still received the correctable tool
    // error, and the turn still ended ok.
    assert.match(toolErrorsOf(id)[0], /^set_plan: nodes: /);
    assert.equal(lastTurn(id)!.status, 'ok');
  });

  it('counts nothing for a well-formed call', async () => {
    const id = randomUUID();
    createLesson(id, 'A call the schema accepts');
    const model = new MockLanguageModelV4({
      modelId: 'claude-opus-5-5',
      doStream: [
        step([
          { type: 'stream-start', warnings: [] },
          toolCall('good-1', 'set_phase', '{"phase":"teach"}'),
          finish('tool-calls', 'tool_use'),
        ]),
        step([
          { type: 'stream-start', warnings: [] },
          { type: 'text-start', id: 't1' },
          { type: 'text-delta', id: 't1', delta: 'Teaching now.' },
          { type: 'text-end', id: 't1' },
          finish('stop', 'end_turn'),
        ]),
      ],
    });
    await turnWith(id, model, 'teach me');

    const turn = lastTurn(id)!;
    assert.equal(toolErrorsOf(id).length, 0, 'a well-formed call was refused');
    // The rate counts bad calls, not calls. A count that moved here would make
    // every provider look unreliable in proportion to how much it taught.
    assert.equal(toolRejectionsOf(turn.id).length, 0);
  });

  it('counts nothing for a call the replay guard answers from the record', async () => {
    const id = randomUUID();
    createLesson(id, 'The same call id, twice');
    const model = new MockLanguageModelV4({
      modelId: 'claude-opus-5-5',
      doStream: [
        step([
          { type: 'stream-start', warnings: [] },
          toolCall('replay-1', 'set_phase', '{"phase":"teach"}'),
          finish('tool-calls', 'tool_use'),
        ]),
        // The same call id again, this time with arguments the schema refuses.
        // D-07's guard answers it from the record before validation is reached,
        // which is the point: a call that already succeeded is not re-validated,
        // so a resumed turn cannot inflate the count of a model that got it
        // right the first time.
        step([
          { type: 'stream-start', warnings: [] },
          toolCall('replay-1', 'set_phase', '{"phase":"nonsense"}'),
          finish('tool-calls', 'tool_use'),
        ]),
        step([
          { type: 'stream-start', warnings: [] },
          { type: 'text-start', id: 't1' },
          { type: 'text-delta', id: 't1', delta: 'Done.' },
          { type: 'text-end', id: 't1' },
          finish('stop', 'end_turn'),
        ]),
      ],
    });
    await turnWith(id, model, 'teach me');

    const turn = lastTurn(id)!;
    assert.equal(toolErrorsOf(id).length, 0, 'the replayed call was validated instead of being answered from the record');
    assert.equal(toolRejectionsOf(turn.id).length, 0);
  });
});
