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
const { runTurn } = await import('../src/agent.js');
const { setDriverOverride } = await import('../src/driver.js');
const { subscribe } = await import('../src/events.js');
const { setKey } = await import('../src/keys.js');
const { answerPrompt, pendingId } = await import('../src/prompts.js');
const { apiDriverFor, setModelOverride } = await import('../src/drivers/api.js');

// A dynamic import cannot carry types across, and a static one would open the
// database before the scratch directory above is set; these are type positions
// only, so nothing is imported at run time.
type StoredEvent = import('../src/db.js').StoredEvent;

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

/** The provider-spec usage shape a model emits — nested, not the flat LanguageModelUsage the SDK hands back. */
const USAGE = {
  inputTokens: { total: 120, noCache: 100, cacheRead: 20, cacheWrite: undefined },
  outputTokens: { total: 30, text: 25, reasoning: 5 },
};

const step = (chunks: unknown[]) => ({ stream: simulateReadableStream({ chunks: chunks as never[], initialDelayInMs: 0, chunkDelayInMs: 0 }) });

const toolCall = (id: string, name: string, input: string) => ({ type: 'tool-call', toolCallId: id, toolName: name, input });
const finish = (unified: string, raw: string) => ({ type: 'finish', finishReason: { unified, raw }, usage: USAGE });

/** One lesson, one turn through the real loop, with a stub model in place of the provider and everything the stream carried. */
async function turnOn(model: MockLanguageModelV4, prompt = 'teach me') {
  const id = randomUUID();
  createLesson(id, 'The owned loop');
  const live: StoredEvent[] = [];
  const unsubscribe = subscribe(id, (ev) => live.push(ev));
  setModelOverride(() => model);
  setDriverOverride(apiDriverFor('anthropic'));
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
const twoStep = () =>
  new MockLanguageModelV4({
    modelId: 'claude-opus-5-5',
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
