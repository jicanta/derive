import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
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

const { createLesson, lastTurn, listEvents, listUsage, setSetting } = await import('../src/db.js');
const { interrupt, runTurn } = await import('../src/agent.js');
const { setDriverOverride } = await import('../src/driver.js');
const { subscribe } = await import('../src/events.js');
const { setKey } = await import('../src/keys.js');
const { answerPrompt, pendingId } = await import('../src/prompts.js');
const { baseUrlKey } = await import('../src/settings.js');
const { apiDriverFor, setModelOverride } = await import('../src/drivers/api.js');

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
    assert.deepEqual(stored[3].payload, { ok: true, verified: 0 });

    // The live stream carries the status line and the deltas the log does not.
    assert.deepEqual(types(live), ['turn_start', 'status', 'phase', 'assistant', 'delta', 'delta', 'assistant', 'turn_end']);

    // The loop made one model call per step, and the first carried the method text as a system message.
    assert.equal(model.doStreamCalls.length, 2);
    assert.equal(model.doStreamCalls[0].prompt[0].role, 'system');
    assert.equal(model.doStreamCalls[0].prompt[1].role, 'user');

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
      assert.deepEqual(ends[0].payload, {
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
      assert.deepEqual(ends[0].payload, { ok: true, interrupted: true });
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
