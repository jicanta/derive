import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';

// db.ts opens the database on import, and backend() shells out to `claude auth
// status` on its first call; pin both before anything under src/ is imported.
const scratch = mkdtempSync(join(tmpdir(), 'derive-test-'));
process.env.DERIVE_DATA_DIR = scratch;
process.env.DERIVE_BACKEND = 'claude';

const { createLesson, lastTurn, listEvents } = await import('../src/db.js');
const { runTurn } = await import('../src/agent.js');
const { setDriverOverride } = await import('../src/driver.js');
const { subscribe } = await import('../src/events.js');
const { fakeDriver, setFakeScript } = await import('../src/drivers/fake.js');

// A dynamic import cannot carry types across, and a static one would open the
// database before the scratch directory above is set; these are type positions
// only, so nothing is imported at run time.
type Driver = import('../src/driver.js').Driver;
type EventSink = import('../src/driver.js').EventSink;
type TurnContext = import('../src/driver.js').TurnContext;
type FakeStep = import('../src/drivers/fake.js').FakeStep;
type StoredEvent = import('../src/db.js').StoredEvent;

/**
 * Copied verbatim from EVENT_TYPES in web/src/lib/useLesson.ts. The browser
 * ignores any type not on that list, so a driver needing a new one would be a
 * change to the web app — the thing this seam exists to make unnecessary.
 */
const EVENT_TYPES = [
  'ready', 'turn_start', 'turn_end', 'status', 'user', 'block_start', 'delta', 'assistant', 'quiz', 'quiz_result', 'ask', 'ask_result',
  'explain', 'explain_result', 'plan', 'plan_result', 'phase', 'warmup', 'node_status', 'memory', 'preferences', 'material', 'material_removed', 'answer_in', 'resource',
];

after(() => rmSync(scratch, { recursive: true, force: true }));

/** One lesson, one turn on the given driver, with everything the stream carried along the way. */
async function turnOn(driver: Driver, script: FakeStep[] | null, prompt = 'teach me') {
  const id = randomUUID();
  createLesson(id, 'The driver seam');
  const live: StoredEvent[] = [];
  const unsubscribe = subscribe(id, (ev) => live.push(ev));
  if (script) setFakeScript(script);
  setDriverOverride(driver);
  try {
    await runTurn(id, prompt);
  } finally {
    setDriverOverride(null);
    unsubscribe();
  }
  return { id, live, stored: listEvents(id) };
}

const types = (events: StoredEvent[]) => events.map((e) => e.type);

describe('a driver reports a whole turn through the one sink', () => {
  it('persists and fans out the scripted sequence, in call order', async () => {
    const { live, stored } = await turnOn(fakeDriver, [
      { kind: 'session', id: 'thread-1' },
      { kind: 'status', text: 'Thinking' },
      { kind: 'block_start', id: 'block-1' },
      { kind: 'block_delta', text: 'A line ' },
      { kind: 'block_delta', text: 'is a function.' },
      { kind: 'block_end' },
      { kind: 'end', payload: { ok: true, verified: 0 } },
    ]);

    assert.deepEqual(types(stored), ['turn_start', 'assistant', 'turn_end']);
    assert.deepEqual(stored[1].payload, { id: 'block-1', text: 'A line is a function.' });
    assert.deepEqual(stored[2].payload, { ok: true, verified: 0 });

    // The live stream carries the ephemeral status line and the deltas the log does not.
    assert.deepEqual(types(live), ['turn_start', 'status', 'assistant', 'delta', 'delta', 'assistant', 'turn_end']);

    // seq is strictly increasing per lesson; the growing block was rewritten under its own.
    const seqs = stored.map((e) => e.seq);
    assert.deepEqual(seqs, [...seqs].sort((a, b) => a - b));
    assert.equal(new Set(seqs).size, seqs.length);

    for (const ev of stored) assert.ok(EVENT_TYPES.includes(ev.type), `${ev.type} is not a type the web app knows`);
    assert.equal(types(stored).filter((t) => t === 'turn_start').length, 1);
    assert.equal(types(stored).filter((t) => t === 'turn_end').length, 1);
  });

  it('ends the turn once however many times the driver ends it', async () => {
    const { stored } = await turnOn(fakeDriver, [
      { kind: 'end', payload: { ok: true, duration_ms: 10 } },
      { kind: 'end', payload: { ok: false, error: 'a second ending' } },
    ]);

    assert.deepEqual(types(stored), ['turn_start', 'turn_end']);
    assert.deepEqual(stored[1].payload, { ok: true, duration_ms: 10 });
  });

  it('still opens and closes the turn for a driver that reports nothing', async () => {
    const { stored } = await turnOn(fakeDriver, []);

    assert.deepEqual(types(stored), ['turn_start', 'turn_end']);
    assert.deepEqual(stored[1].payload, { ok: true, interrupted: true });
  });

  it('leaves one turn row, closed the way the turn ended', async () => {
    const ok = await turnOn(fakeDriver, [{ kind: 'end', payload: { ok: true, verified: 0 } }]);
    const row = lastTurn(ok.id)!;
    assert.equal(row.status, 'ok');
    assert.equal(row.driver, 'fake');
    assert.ok(row.ended_at !== null && row.ended_at >= row.started_at);

    const stopped = await turnOn(fakeDriver, [{ kind: 'end', payload: { ok: true, interrupted: true } }]);
    assert.equal(lastTurn(stopped.id)!.status, 'interrupted');

    const broken = await turnOn(fakeDriver, [{ kind: 'end', payload: { ok: false, error: 'the provider refused' } }]);
    assert.equal(lastTurn(broken.id)!.status, 'error');

    // A driver that reports nothing is still closed, by runTurn's own finally.
    const silent = await turnOn(fakeDriver, []);
    assert.equal(lastTurn(silent.id)!.status, 'interrupted');
  });

  it('adding a driver takes one runTurn and nothing else', async () => {
    // Everything a new provider has to write, written out here in full.
    const tiny: Driver = {
      name: 'tiny',
      async runTurn(ctx: TurnContext, sink: EventSink) {
        sink.emit('assistant', { id: 'only', text: `Teaching lesson ${ctx.lessonId.slice(0, 8)}.` });
        sink.endTurn({ ok: true });
      },
    };

    const { live, stored } = await turnOn(tiny, null);

    assert.deepEqual(types(stored), ['turn_start', 'assistant', 'turn_end']);
    assert.deepEqual(types(live), ['turn_start', 'assistant', 'turn_end']);
    for (const ev of [...stored, ...live]) assert.ok(EVENT_TYPES.includes(ev.type), `${ev.type} is not a type the web app knows`);
    const seqs = stored.map((e) => e.seq);
    assert.deepEqual(seqs, [...seqs].sort((a, b) => a - b));
  });
});
