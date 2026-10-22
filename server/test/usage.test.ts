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
import { request as httpRequest } from 'node:http';
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

const { COST_SOURCES, createLesson, db, deleteLesson, lastTurn, listEvents, listUsage, recordToolRejection, toolRejectionRate, toolRejectionsOf } = await import('../src/db.js');
const { runTurn } = await import('../src/agent.js');
const { setDriverOverride } = await import('../src/driver.js');
const { fakeDriver, setFakeScript } = await import('../src/drivers/fake.js');

type FakeStep = import('../src/drivers/fake.js').FakeStep;
type UsageRow = import('../src/db.js').UsageRow;
type ProviderId = import('../src/providers.js').ProviderId;

after(() => rmSync(scratch, { recursive: true, force: true }));

/** One lesson, one turn on the fake driver, and the usage rows it left behind. `tutor` names what the turn row records as its model, the way the Settings teaching proof names the row it pressed. */
async function turnWith(script: FakeStep[], tutor?: { provider: ProviderId; model: string | null }) {
  const id = randomUUID();
  createLesson(id, 'What a turn costs');
  setFakeScript(script);
  setDriverOverride(fakeDriver);
  try {
    await runTurn(id, 'teach me', tutor ? { tutor } : {});
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

/**
 * The tool-rejection ledger: how often one model produces a call Derive cannot
 * accept, and which tool it fails on.
 *
 * The cases that the recording happens at the one schema-rejection site, once
 * per bad call and never for a well-formed or a replayed one, live in
 * `api-driver.test.ts` beside the stub-model harness that can actually make a
 * malformed call reach the loop. These are the ledger's own rules: where the
 * provider and the model come from, that the read is one indexed query, and
 * that the rows leave with their lesson.
 */
describe('the tool-rejection ledger', () => {
  it('takes the provider and the model off the turn, never from the caller', async () => {
    const { turn } = await turnWith([call(10, 2), { kind: 'end', payload: { ok: true } }]);

    recordToolRejection(turn.id, 'quiz');
    const rows = toolRejectionsOf(turn.id);

    assert.equal(rows.length, 1);
    assert.equal(rows[0].tool, 'quiz');
    // The same rule recordUsage states: no caller can file a rejection under a
    // provider or a model its turn does not belong to.
    assert.equal(rows[0].driver, turn.driver);
    assert.equal(rows[0].model, turn.model);
  });

  it('records nothing, and throws nothing, for a turn this process does not know', () => {
    const before = toolRejectionsOf('no-such-turn').length;

    // D-21: no runtime effect. A throw here would replace the correctable tool
    // error the model is about to receive with an error about Derive's own
    // bookkeeping.
    assert.doesNotThrow(() => recordToolRejection('no-such-turn', 'quiz'));
    assert.equal(toolRejectionsOf('no-such-turn').length, before);
  });

  it('answers the rate per provider and model, with the model as the unit', async () => {
    const weakTurn = await turnWith([call(1, 1), { kind: 'end', payload: { ok: true } }], { provider: 'ollama', model: 'a-weak-model' });
    const carefulTurn = await turnWith([call(1, 1), { kind: 'end', payload: { ok: true } }], { provider: 'ollama', model: 'a-careful-model' });
    recordToolRejection(weakTurn.turn.id, 'quiz');
    recordToolRejection(weakTurn.turn.id, 'quiz');
    recordToolRejection(weakTurn.turn.id, 'set_plan');

    const weak = toolRejectionRate(weakTurn.turn.driver, 'a-weak-model');
    const careful = toolRejectionRate(carefulTurn.turn.driver, 'a-careful-model');

    assert.equal(weak.rejected, 3);
    assert.deepEqual(weak.by_tool, { quiz: 2, set_plan: 1 });
    // D-20: one model's figure says nothing about another on the same provider.
    assert.equal(careful.rejected, 0);
    // Null rather than zero for a pair that has made no call at all: a zero
    // there would read as a model that never got one wrong.
    assert.equal(careful.rate, null);
  });

  it('reads the rate through an index rather than scanning the table', () => {
    const plan = (db.prepare('EXPLAIN QUERY PLAN SELECT tool, COUNT(*) AS n FROM tool_rejections WHERE driver = ? AND model IS ? GROUP BY tool ORDER BY tool').all('ollama', 'a-weak-model') as { detail: string }[])
      .map((r) => r.detail)
      .join(' ');

    // The report asks this once per provider and model; a scan per group is how
    // a diagnostic starts costing more than the thing it diagnoses.
    assert.match(plan, /USING .*INDEX tool_rejections_provider/, `the per-provider read does not use its index: ${plan}`);
  });

  it('leaves with its lesson, in the same transaction the usage rows leave in', async () => {
    const { id, turn } = await turnWith([call(3, 3), { kind: 'end', payload: { ok: true } }]);
    recordToolRejection(turn.id, 'quiz');
    assert.equal(toolRejectionsOf(turn.id).length, 1);

    deleteLesson(id);

    // A row naming a turn that no longer exists would keep counting a model's
    // mistakes after the lesson they happened in was removed — including plan
    // 04-03's scratch proof lesson, which is deleted in the request that made it.
    assert.equal(toolRejectionsOf(turn.id).length, 0);
    assert.equal(listUsage({ turn: turn.id }).length, 0);
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

/**
 * What learning has cost, across every provider, as the Usage page reads it.
 *
 * Over HTTP and against the route rather than the function, because two of the
 * things that must hold are properties of the request and not of the
 * arithmetic: the read is scoped to the learner the server resolved, and the
 * payload the browser receives carries no number it has to format. The six
 * boundary cases this plan names — no rows, one row, an all-subscription
 * lesson, a mixed lesson, a row with no counts, and a total under half a cent
 * — are asserted on the strings the page actually prints, so a change that
 * forked the label vocabulary would fail here rather than at a learner's eye.
 *
 * Rows are written straight into the ledger, as the lesson-cost suite above
 * does and for the same reason: five label outcomes need five cost sources,
 * and a provider that bills cannot be impersonated by a stub without a key.
 */
describe('what learning has cost, as the Usage page reads it', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const entry = resolve(here, '../dist/index.js');
  let server: ChildProcess | undefined;
  let base = '';
  let dataDir = '';
  let token = '';

  type UsageView = import('../src/usage.js').UsageView;

  before(async () => {
    assert.ok(existsSync(entry), `build first: ${entry} is missing`);
    ({ child: server, base, dataDir } = await startDeriveServer(entry));
    token = readFileSync(join(dataDir, 'token'), 'utf8').trim();
  });

  after(() => {
    server?.kill();
    if (dataDir) rmSync(dataDir, { recursive: true, force: true });
  });

  /** A learner of their own per case, so one case's rows never land in another's grand total. */
  async function learner(name: string): Promise<string> {
    const res = await fetch(`${base}/api/learners`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-derive-token': token }, body: JSON.stringify({ name }) });
    assert.equal(res.status, 201);
    return ((await res.json()) as { id: string }).id;
  }

  /** One lesson belonging to that learner, with no turn behind it. */
  async function lesson(learnerId: string, topic: string): Promise<string> {
    const res = await fetch(`${base}/api/lessons`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-derive-token': token, 'x-derive-learner': learnerId }, body: JSON.stringify({ topic }) });
    assert.equal(res.status, 201);
    return ((await res.json()) as { id: string }).id;
  }

  /** Usage rows written straight into the running server's ledger. WAL makes a second connection's write visible to the next read the server makes. */
  function bill(lessonId: string, rows: { driver: string; model: string | null; input?: number | null; output?: number | null; source: string; usd?: number | null }[]) {
    const db = new DatabaseSync(join(dataDir, 'derive.db'));
    const owner = (db.prepare('SELECT learner_id FROM lessons WHERE id = ?').get(lessonId) as { learner_id: string }).learner_id;
    const insert = db.prepare(
      'INSERT INTO usage (turn_id, lesson_id, learner_id, driver, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, reasoning_tokens, cost_source, cost_usd, ts) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?)',
    );
    for (const r of rows) insert.run(randomUUID(), lessonId, owner, r.driver, r.model, r.input ?? null, r.output ?? null, r.source, r.usd ?? null, Date.now());
    db.close();
  }

  /** The page's own read, scoped by the header the browser sends. */
  async function usage(learnerId: string): Promise<UsageView> {
    const res = await fetch(`${base}/api/usage`, { headers: { 'x-derive-token': token, 'x-derive-learner': learnerId } });
    assert.equal(res.status, 200);
    return (await res.json()) as UsageView;
  }

  /**
   * The same read with a body naming somebody else.
   *
   * `fetch` refuses to send a body on a GET, which is the whole reason this
   * goes through `node:http`: the assertion is that a body cannot redirect the
   * scope, and a request that was never sent asserts nothing.
   */
  function usageWithBody(learnerId: string, body: unknown): Promise<UsageView> {
    const payload = JSON.stringify(body);
    const url = new URL(`${base}/api/usage`);
    return new Promise((done, fail) => {
      const req = httpRequest(
        {
          hostname: url.hostname,
          port: url.port,
          path: url.pathname,
          method: 'GET',
          headers: { 'x-derive-token': token, 'x-derive-learner': learnerId, 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) },
        },
        (res) => {
          let text = '';
          res.setEncoding('utf8');
          res.on('data', (d: string) => (text += d));
          res.on('end', () => {
            assert.equal(res.statusCode, 200);
            done(JSON.parse(text) as UsageView);
          });
        },
      );
      req.on('error', fail);
      req.end(payload);
    });
  }

  /** Every line the page would print, so an assertion can say what does and does not appear anywhere on it. */
  const lines = (v: UsageView): string[] => [v.total ?? '', v.summary ?? '', ...v.groups.flatMap((g) => [g.line, ...g.models.flatMap((m) => [m.line, ...m.rows.map((r) => r.line)])])];

  it('says nothing at all for a learner who has not run a lesson', async () => {
    const me = await learner('A learner before their first lesson');

    const v = await usage(me);

    // Null, not zero, and an empty list rather than a placeholder row: the page
    // needs an unambiguous empty signal, and a `$0.00` would claim the ledger
    // measured nothing and found nothing when it measured nothing at all.
    assert.deepEqual(v, { total: null, summary: null, lessons: 0, tokens: null, groups: [] });
  });

  it("reports a count of one for a learner with one lesson, so the singular nouns are the server's", async () => {
    const me = await learner('A learner with exactly one lesson');
    const id = await lesson(me, 'One metered lesson');
    bill(id, [{ driver: 'openrouter', model: 'anthropic/claude-opus-5.5', input: 1, output: 1, source: 'provider', usd: 0.12 }]);

    const v = await usage(me);

    assert.equal(v.lessons, 1);
    assert.equal(v.groups.length, 1);
    assert.equal(v.groups[0].lessons, 1);
    assert.equal(v.groups[0].models[0].lessons, 1);
    // The noun is the server's, not a browser-side guess at it.
    assert.match(v.summary ?? '', /\bacross 1 lesson\b/);
    assert.match(v.groups[0].line, /\b1 lesson\b/);
    assert.equal(v.total, 'about $0.12 billed');
  });

  it('shows tokens and `not billed` for a lesson taught entirely on a subscription, and no figure', async () => {
    const me = await learner('A learner on a login');
    const id = await lesson(me, 'A whole lesson on a login');
    bill(id, [
      { driver: 'claude-code', model: 'claude-opus-5-5', input: 900, output: 100, source: 'subscription' },
      { driver: 'claude-code', model: 'claude-opus-5-5', input: 400, output: 100, source: 'subscription' },
    ]);

    const v = await usage(me);

    assert.equal(v.total, 'not billed');
    assert.equal(v.tokens, 1500);
    assert.equal(v.groups[0].label, 'claude code');
    // Tokens are the only thing a subscription line can honestly report, so
    // they are what it reports — and there is no money anywhere on it.
    assert.match(v.groups[0].line, /1,500 tokens · not billed$/);
    assert.ok(!v.groups[0].line.includes('$'), `a subscription line may carry no money: ${v.groups[0].line}`);
    assert.match(v.groups[0].models[0].rows[0].line, /A whole lesson on a login · 1,500 tokens · not billed/);
  });

  it('takes the weakest label for a lesson that is part priced and part subscription', async () => {
    const me = await learner('A learner whose lesson is part metered');
    const id = await lesson(me, 'Half on a key, half on a login');
    bill(id, [
      { driver: 'anthropic', model: 'claude-opus-5-5', input: 1_000_000, output: 0, source: 'table' },
      { driver: 'claude-code', model: 'claude-opus-5-5', input: 500, output: 100, source: 'subscription' },
    ]);

    const v = await usage(me);

    // Part of the total is Derive's own arithmetic and part of it is not a
    // figure at all; `estimated` is the firmest word that overstates neither.
    assert.match(String(v.total), /^about \$\d+\.\d\d estimated$/);
    // The page does not re-decide it: the subscription half still renders its
    // own tokens-only line under its own provider.
    const login = v.groups.find((g) => g.provider === 'claude-code');
    assert.ok(login, 'the subscription half has no group of its own');
    assert.match(login.line, /600 tokens · not billed$/);
  });

  it('says `not reported` for a request nobody counted, and never a $0.00', async () => {
    const me = await learner('A learner with an uncounted request');
    const id = await lesson(me, 'One request nobody counted');
    bill(id, [{ driver: 'claude-code', model: null, source: 'unknown' }]);

    const v = await usage(me);

    assert.equal(v.total, 'not reported');
    assert.equal(v.tokens, null);
    assert.match(v.groups[0].line, /not reported$/);
    // The honest blank said out loud. A zero here would be a measurement
    // nobody made, which is the one thing this vocabulary exists to refuse.
    for (const l of lines(v)) assert.ok(!l.includes('$0.00'), `$0.00 reached the payload: ${l}`);
    assert.ok(!JSON.stringify(v).includes('$0.00'));
  });

  it('reads `under $0.01` for a total below half a cent rather than rounding it away', async () => {
    const me = await learner('A learner with a very cheap lesson');
    const id = await lesson(me, 'A lesson that cost almost nothing');
    bill(id, [{ driver: 'openrouter', model: 'anthropic/claude-opus-5.5', input: 3, output: 1, source: 'provider', usd: 0.002 }]);

    const v = await usage(me);

    // A cheap lesson on a metered key is not a free one.
    assert.equal(v.total, 'under $0.01 billed');
    assert.ok(!JSON.stringify(v).includes('$0.00'));
  });

  it('names a local provider by its own word, so LM Studio and llama.cpp are never read as Ollama', async () => {
    const me = await learner('A learner running three local servers');
    const studio = await lesson(me, 'A lesson on LM Studio');
    const cpp = await lesson(me, 'A lesson on llama.cpp');
    const olla = await lesson(me, 'A lesson on Ollama');
    bill(studio, [{ driver: 'lmstudio', model: 'qwen3-30b', input: 800, output: 200, source: 'unknown' }]);
    bill(cpp, [{ driver: 'llamacpp', model: '/home/someone/models/a-very-long-file-name.gguf', input: 700, output: 300, source: 'unknown' }]);
    bill(olla, [{ driver: 'ollama', model: 'qwen3:30b', input: 600, output: 400, source: 'unknown' }]);

    const v = await usage(me);
    const labels = v.groups.map((g) => g.label).sort();

    assert.deepEqual(labels, ['llama.cpp', 'lm studio', 'ollama']);
    // The raw catalogue id is never the word on the line: a learner reading
    // `lmstudio` would not know whether Derive had understood which server ran.
    for (const l of lines(v)) {
      assert.ok(!/\blmstudio\b/.test(l), `a raw id reached the page: ${l}`);
      assert.ok(!/\bllamacpp\b/.test(l), `a raw id reached the page: ${l}`);
    }
    const studioGroup = v.groups.find((g) => g.label === 'lm studio')!;
    assert.ok(!studioGroup.line.includes('ollama'), 'a non-Ollama local lesson is labelled ollama');
    // The model id goes through verbatim, path and all, because the page
    // truncates it with the whole value in the title.
    const cppGroup = v.groups.find((g) => g.label === 'llama.cpp')!;
    assert.equal(cppGroup.models[0].model, '/home/someone/models/a-very-long-file-name.gguf');
  });

  it("answers the resolved learner's rows and nobody else's", async () => {
    const a = await learner('Learner A, who has spent something');
    const b = await learner('Learner B, who has not');
    const mine = await lesson(a, "A lesson of A's");
    bill(mine, [{ driver: 'openrouter', model: 'anthropic/claude-opus-5.5', input: 10, output: 10, source: 'provider', usd: 0.5 }]);

    const seenByA = await usage(a);
    const seenByB = await usage(b);

    assert.equal(seenByA.lessons, 1);
    assert.equal(seenByA.total, 'about $0.50 billed');
    // T-04-07: the ledger is denormalised per learner precisely so that one
    // learner's spending is never visible from another's page.
    assert.deepEqual(seenByB, { total: null, summary: null, lessons: 0, tokens: null, groups: [] });

    // And a body naming A changes nothing about what B is shown. The write
    // side takes the learner off the turn for exactly this reason; the read
    // side takes it off the resolved request and from nowhere else.
    assert.deepEqual(await usageWithBody(b, { learner: a }), seenByB);
  });
});
