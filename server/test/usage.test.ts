/**
 * The usage ledger: one row per model request, and one row for every turn even
 * when the driver reported nothing at all.
 *
 * Two harnesses, because usage is written from two places. The scripted fake
 * driver covers the app path with no model, no login and no network; a spawned
 * server covers the companion path, where the model ran in the learner's own
 * terminal and this process was told nothing about it.
 *
 * Everything here runs against scratch directories. Nothing in this file may
 * touch ~/.derive/derive.db.
 */
import assert from 'node:assert/strict';
import { type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { startDeriveServer } from './spawn.js';

// db.ts opens the database on import, and backend() shells out on its first
// call; pin both before anything under src/ is imported.
const scratch = mkdtempSync(join(tmpdir(), 'derive-usage-'));
process.env.DERIVE_DATA_DIR = scratch;
process.env.DERIVE_BACKEND = 'claude';

const { COST_SOURCES, createLesson, lastTurn, listEvents, listUsage } = await import('../src/db.js');
const { runTurn } = await import('../src/agent.js');
const { setDriverOverride } = await import('../src/driver.js');
const { fakeDriver, setFakeScript } = await import('../src/drivers/fake.js');

type FakeStep = import('../src/drivers/fake.js').FakeStep;
type UsageRow = import('../src/db.js').UsageRow;

after(() => rmSync(scratch, { recursive: true, force: true }));

/** One lesson, one turn on the fake driver, and the usage rows it left behind. */
async function turnWith(script: FakeStep[]) {
  const id = randomUUID();
  createLesson(id, 'What a turn costs');
  setFakeScript(script);
  setDriverOverride(fakeDriver);
  try {
    await runTurn(id, 'teach me');
  } finally {
    setDriverOverride(null);
  }
  const turn = lastTurn(id)!;
  return { id, turn, rows: listUsage({ turn: turn.id }) };
}

const call = (input: number, output: number, extra: Record<string, unknown> = {}): FakeStep => ({
  kind: 'usage',
  row: { model: 'a-model', input_tokens: input, output_tokens: output, cache_read_tokens: 10, cache_write_tokens: 2, reasoning_tokens: 5, cost_usd: 0.01, cost_source: 'provider', ...extra },
});

const sum = (rows: UsageRow[], key: keyof UsageRow) => rows.reduce((n, r) => n + Number(r[key] ?? 0), 0);

describe('a turn that reports what each request cost', () => {
  it('writes one row per request, all under the one turn', async () => {
    const { turn, rows } = await turnWith([call(100, 20), call(300, 40), { kind: 'end', payload: { ok: true } }]);

    assert.equal(rows.length, 2);
    for (const r of rows) {
      assert.equal(r.turn_id, turn.id);
      assert.equal(r.lesson_id, turn.lesson_id);
      assert.equal(r.learner_id, turn.learner_id);
      assert.equal(r.driver, 'fake');
      assert.equal(r.model, 'a-model');
      assert.equal(r.cost_source, 'provider');
    }
    // Per-turn totals are a SUM away, which is the whole reason for the grain.
    assert.equal(sum(rows, 'input_tokens'), 400);
    assert.equal(sum(rows, 'output_tokens'), 60);
    assert.equal(sum(rows, 'cache_read_tokens'), 20);
    assert.equal(sum(rows, 'cache_write_tokens'), 4);
    assert.equal(sum(rows, 'reasoning_tokens'), 10);
  });

  it('keeps the model each request actually ran on, even when the turn changed model partway', async () => {
    const { rows } = await turnWith([call(10, 1, { model: 'the-first-model' }), call(20, 2, { model: 'the-second-model' }), { kind: 'end', payload: { ok: true } }]);

    assert.deepEqual(rows.map((r) => r.model), ['the-first-model', 'the-second-model']);
  });

  it('reads the rows of a turn back in the order they were made, run after run', async () => {
    const first = await turnWith([call(1, 1), call(2, 2), call(3, 3), { kind: 'end', payload: { ok: true } }]);
    const again = listUsage({ turn: first.turn.id });

    const ids = again.map((r) => r.id);
    assert.deepEqual(ids, [...ids].sort((a, b) => a - b));
    assert.deepEqual(again.map((r) => r.input_tokens), [1, 2, 3]);
    assert.deepEqual(again.map((r) => r.id), first.rows.map((r) => r.id));
  });

  it('files every row under one of the four cost sources', async () => {
    const { rows } = await turnWith([
      call(1, 1, { cost_source: 'provider' }),
      call(1, 1, { cost_source: 'table' }),
      call(1, 1, { cost_source: 'subscription' }),
      { kind: 'end', payload: { ok: true } },
    ]);

    for (const r of listUsage().concat(rows)) assert.ok(COST_SOURCES.includes(r.cost_source), `${r.cost_source} is not a cost source`);
  });
});

describe('a turn that reports nothing', () => {
  it('still leaves exactly one row, blank and honest', async () => {
    const { turn, rows } = await turnWith([{ kind: 'end', payload: { ok: true } }]);

    assert.equal(rows.length, 1);
    const [row] = rows;
    // Not zeroes: nobody reported a count, and a zero would read as "it cost nothing".
    assert.equal(row.input_tokens, null);
    assert.equal(row.output_tokens, null);
    assert.equal(row.cache_read_tokens, null);
    assert.equal(row.cache_write_tokens, null);
    assert.equal(row.reasoning_tokens, null);
    assert.equal(row.cost_usd, null);
    assert.equal(row.cost_source, 'unknown');
    assert.equal(row.turn_id, turn.id);
  });

  it('leaves one row for a turn whose driver said nothing at all', async () => {
    const { rows } = await turnWith([]);

    assert.equal(rows.length, 1);
    assert.equal(rows[0].cost_source, 'unknown');
  });

  it('does not add a blank row to a turn that did report', async () => {
    const { rows } = await turnWith([call(5, 5), { kind: 'end', payload: { ok: true } }]);

    assert.equal(rows.length, 1);
    assert.equal(rows[0].cost_source, 'provider');
  });
});

describe('usage is accounting, not narrative', () => {
  it('reaches the ledger without reaching the lesson log', async () => {
    const { id, rows } = await turnWith([call(100, 20), { kind: 'end', payload: { ok: true } }]);

    assert.equal(rows.length, 1);
    // D-14: an event here would land in the browser's reducer and in the
    // learner's Obsidian notes. A turn's log is its narrative, not its bill.
    assert.deepEqual(listEvents(id).map((e) => e.type), ['turn_start', 'turn_end']);
    for (const e of listEvents(id)) assert.ok(!/usage|token|cost/i.test(e.type), `${e.type} is a usage event`);
    assert.ok(!/input_tokens|cost_source/.test(JSON.stringify(listEvents(id))));
  });
});

describe('a lesson driven from a terminal', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const entry = resolve(here, '../dist/index.js');
  let server: ChildProcess | undefined;
  let base = '';
  let dataDir = '';
  /** The install token the server wrote on its first boot; every /api call but health carries it. */
  let token = '';

  before(async () => {
    assert.ok(existsSync(entry), `build first: ${entry} is missing`);
    ({ child: server, base, dataDir } = await startDeriveServer(entry));
    token = readFileSync(join(dataDir, 'token'), 'utf8').trim();
  });

  after(() => {
    server?.kill();
    if (dataDir) rmSync(dataDir, { recursive: true, force: true });
  });

  it('is still in the ledger, saying its tokens were never reported', async () => {
    const created = await fetch(`${base}/api/external/lessons`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-derive-token': token }, body: JSON.stringify({ topic: 'what a companion lesson costs', answer_in: 'terminal' }) });
    const { id } = (await created.json()) as { id: string };
    assert.equal(created.status, 201);

    const ended = await fetch(`${base}/api/external/lessons/${id}/end`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-derive-token': token }, body: '{}' });
    assert.equal(ended.status, 200);

    const db = new DatabaseSync(join(dataDir, 'derive.db'));
    const rows = (db.prepare('SELECT * FROM usage WHERE lesson_id = ? ORDER BY id').all(id) as UsageRow[]).map((r) => ({ ...r }));
    const turns = db.prepare('SELECT id, status, driver FROM turns WHERE lesson_id = ?').all(id) as { id: string; status: string; driver: string }[];
    db.close();

    assert.equal(turns.length, 1);
    assert.equal(turns[0].status, 'ok');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].turn_id, turns[0].id);
    assert.equal(rows[0].driver, 'claude-code');
    assert.equal(rows[0].cost_source, 'unknown');
    assert.deepEqual(
      [rows[0].input_tokens, rows[0].output_tokens, rows[0].cache_read_tokens, rows[0].cache_write_tokens, rows[0].reasoning_tokens, rows[0].cost_usd],
      [null, null, null, null, null, null],
    );
  });
});

/**
 * What a lesson has cost, on the two surfaces the learner reads it from.
 *
 * Over HTTP with no model, because the point is not the arithmetic —
 * `cost.test.ts` covers that with literals — but that the lesson view and the
 * Home list answer the *same string* for the same lesson. They are the two
 * places a figure is shown, and a figure that disagrees with itself is worse
 * than no figure at all.
 *
 * The rows are written straight into the ledger rather than earned by running
 * turns: five label outcomes need five cost sources, and a provider that bills
 * cannot be impersonated by a stub without a key.
 */
describe('what a lesson cost, as both screens read it', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const entry = resolve(here, '../dist/index.js');
  let server: ChildProcess | undefined;
  let base = '';
  let dataDir = '';
  let token = '';

  before(async () => {
    assert.ok(existsSync(entry), `build first: ${entry} is missing`);
    ({ child: server, base, dataDir } = await startDeriveServer(entry));
    token = readFileSync(join(dataDir, 'token'), 'utf8').trim();
  });

  after(() => {
    server?.kill();
    if (dataDir) rmSync(dataDir, { recursive: true, force: true });
  });

  /** One lesson on the running server, with no turn behind it. */
  async function lesson(topic: string): Promise<string> {
    const res = await fetch(`${base}/api/lessons`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-derive-token': token }, body: JSON.stringify({ topic }) });
    assert.equal(res.status, 201);
    return ((await res.json()) as { id: string }).id;
  }

  /** Usage rows written straight into the running server's ledger. WAL makes a second connection's write visible to the next read the server makes. */
  function bill(lessonId: string, rows: { driver: string; model: string | null; input?: number; output?: number; source: string; usd?: number | null }[]) {
    const db = new DatabaseSync(join(dataDir, 'derive.db'));
    const learner = (db.prepare('SELECT learner_id FROM lessons WHERE id = ?').get(lessonId) as { learner_id: string }).learner_id;
    const insert = db.prepare(
      'INSERT INTO usage (turn_id, lesson_id, learner_id, driver, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, reasoning_tokens, cost_source, cost_usd, ts) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?)',
    );
    for (const r of rows) insert.run(randomUUID(), lessonId, learner, r.driver, r.model, r.input ?? null, r.output ?? null, r.source, r.usd ?? null, Date.now());
    db.close();
  }

  /** The cost string each surface answers for one lesson: the view, then the same lesson's row in the list. */
  async function costs(id: string): Promise<{ view: string | null; row: string | null }> {
    const headers = { 'x-derive-token': token };
    const view = (await (await fetch(`${base}/api/lessons/${id}`, { headers })).json()) as { cost: string | null };
    const list = (await (await fetch(`${base}/api/lessons`, { headers })).json()) as { id: string; cost: string | null }[];
    const row = list.find((l) => l.id === id);
    assert.ok(row, 'the lesson is missing from the list');
    return { view: view.cost, row: row.cost };
  }

  it('says nothing at all for a lesson that has not run yet', async () => {
    const id = await lesson('A lesson before its first turn');
    // Not `$0.00`, not `not reported`, not an empty string: there is nothing to
    // say, so both surfaces say nothing and neither renders a segment.
    assert.deepEqual(await costs(id), { view: null, row: null });
  });

  it('sums what the provider billed and says `billed`', async () => {
    const id = await lesson('Two metered requests');
    bill(id, [
      { driver: 'openrouter', model: 'anthropic/claude-opus-5.5', source: 'provider', usd: 0.12 },
      { driver: 'openrouter', model: 'anthropic/claude-opus-5.5', source: 'provider', usd: 0.07 },
    ]);

    const { view, row } = await costs(id);
    assert.equal(view, 'about $0.19 billed');
    assert.equal(row, view, 'the header and the Home row must be byte-identical for one lesson');
  });

  it('falls to `estimated` for a lesson that is part billed and part priced from the table', async () => {
    const id = await lesson('Half billed, half estimated');
    bill(id, [
      { driver: 'openrouter', model: 'anthropic/claude-opus-5.5', source: 'provider', usd: 0.1 },
      { driver: 'anthropic', model: 'claude-opus-5-5', input: 1_000_000, output: 0, source: 'table' },
    ]);

    const { view, row } = await costs(id);
    // The firmest word that overstates neither half: part of the total is a
    // figure the provider gave and part of it is Derive's own arithmetic.
    assert.match(String(view), /^about \$\d+\.\d\d estimated$/);
    assert.equal(row, view);
  });

  it('says `not billed` for a lesson taught entirely on a subscription', async () => {
    const id = await lesson('A whole lesson on a login');
    bill(id, [
      { driver: 'claude-code', model: 'claude-opus-5-5', source: 'subscription' },
      { driver: 'claude-code', model: 'claude-opus-5-5', source: 'subscription' },
    ]);

    const { view, row } = await costs(id);
    assert.equal(view, 'not billed');
    assert.equal(row, view);
  });

  it('says `not reported` as soon as one request reported nothing', async () => {
    const id = await lesson('One request nobody counted');
    bill(id, [{ driver: 'claude-code', model: null, source: 'unknown' }]);

    const { view, row } = await costs(id);
    // The honest blank said out loud. Folding it into `estimated` would assert
    // something the ledger does not know.
    assert.equal(view, 'not reported');
    assert.equal(row, view);
  });

  it('takes the weakest word even when the lesson is mostly metered', async () => {
    const id = await lesson('One unreported request among three metered ones');
    bill(id, [
      { driver: 'openrouter', model: 'anthropic/claude-opus-5.5', source: 'provider', usd: 0.2 },
      { driver: 'openrouter', model: 'anthropic/claude-opus-5.5', source: 'provider', usd: 0.2 },
      { driver: 'claude-code', model: null, source: 'unknown' },
    ]);

    const { view, row } = await costs(id);
    // `not reported` alone, with no figure beside it: `costLabel`'s rule is
    // that an unreported source never carries money, because $0.40 printed
    // against a lesson that also made a request nobody counted reads as the
    // whole bill when it is only part of it.
    assert.equal(view, 'not reported', 'a lesson with an unreported request may not show a partial total as if it were the whole');
    assert.equal(row, view);
  });
});
