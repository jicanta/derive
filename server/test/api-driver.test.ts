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

const { createLesson, getLesson, lastTurn, listEvents, listUsage, loadTurnMessages, recordedToolResult, setSessionId, setSetting } = await import('../src/db.js');
const { interrupt, runTurn } = await import('../src/agent.js');
const { setDriverOverride } = await import('../src/driver.js');
const { subscribe } = await import('../src/events.js');
const { setKey } = await import('../src/keys.js');
const { answerPrompt, pendingId } = await import('../src/prompts.js');
const { baseUrlKey } = await import('../src/settings.js');
const { apiDriverFor, patchOrphans, setModelOverride, setStepCapOverride } = await import('../src/drivers/api.js');

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
    assert.deepEqual(roles(second), ['system', 'user', 'assistant', 'user']);
    assert.ok(JSON.stringify(second.doStreamCalls[0].prompt[2]).includes('A line is a function.'), 'the first turn’s prose must be in the second request');
    // Exactly one system message, and it is the one `instructions` supplies:
    // the method text is rebuilt from method/ every turn, so a persisted system
    // message would be stale method text.
    assert.equal(roles(second).filter((r) => r === 'system').length, 1);
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

      assert.deepEqual(roles(second), ['system', 'user'], 'the second request carries none of the first turn’s parts');
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
    assert.deepEqual(ends[0].payload, { ok: true, interrupted: true }, 'a Stop is interrupted, not failed');
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
      assert.deepEqual(ends[0].payload, { ok: true, interrupted: true }, 'the cap is not an error card');
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
