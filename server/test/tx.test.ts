/**
 * The destructive writes, and the guarantee withTx gives them: a failure
 * partway leaves the learner's record exactly as it was.
 *
 * Every case drives the real db.ts functions against a scratch database and
 * counts rows before and after; an assertion that nothing threw would prove
 * nothing. Failures partway are forced with a trigger that RAISEs, which is a
 * real statement failure inside the transaction rather than a simulated one.
 * The same counting is what drives the restart case: a sweep leaves the ledger
 * reconciling, so the turn count and the usage count are compared rather than
 * the sweep merely being observed to return.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';

// db.ts opens the database on import; point it at a scratch directory first.
const scratch = mkdtempSync(join(tmpdir(), 'derive-tx-'));
process.env.DERIVE_DATA_DIR = scratch;

const { addMemory, appendEvent, closeOpenTurns, createLearner, createLesson, db, deleteLearner, deleteLesson, finishTurn, getLesson, listNodes, listUsage, recordQuiz, recordUsage, replaceGraph, setNodeStatus, startTurn, withTx } =
  await import('../src/db.js');

type GraphNodeInput = import('../src/db.js').GraphNodeInput;

after(() => rmSync(scratch, { recursive: true, force: true }));

const GRAPH: GraphNodeInput[] = [
  { id: 'waves', label: 'A wave carries energy', kind: 'truth', depends_on: [] },
  { id: 'superposition', label: 'Waves add', kind: 'derived', depends_on: ['waves'] },
  { id: 'interference', label: 'Waves cancel', kind: 'goal', depends_on: ['superposition'] },
];

/** A lesson with a three-node graph, one locked node, and a child row in every table deleteLesson touches. */
function lessonWithHistory(id: string, learnerId?: string) {
  createLesson(id, `Lesson ${id}`, learnerId ? { learnerId } : {});
  replaceGraph(id, GRAPH);
  setNodeStatus(id, 'waves', 'locked');
  appendEvent(id, 'turn_start', {});
  addMemory('they think in pictures', 'learner', id);
  recordQuiz(id, 'waves', true, { confidence: 'sure', purpose: 'check', tests: 'intuition' });
  // A turn and the usage row hanging off it, so every case built on this helper
  // covers the two tables migrations 2 and 3 added rather than only the ones
  // deleteLesson has always cleared.
  const turn = startTurn(id, 'fake');
  recordUsage(turn, { cost_source: 'unknown' });
  finishTurn(turn, 'ok');
  return id;
}

/** Make a DELETE on `table` fail, the way a constraint or a disk error would, for as long as fn runs. `when` narrows it to one row. */
function breakDeletesOn(table: string, fn: () => void, when = '') {
  db.exec(`CREATE TRIGGER tx_test_boom AFTER DELETE ON ${table} ${when} BEGIN SELECT RAISE(ABORT, 'boom'); END`);
  try {
    fn();
  } finally {
    db.exec('DROP TRIGGER tx_test_boom');
  }
}

const rowsOf = (sql: string, ...args: string[]) => (db.prepare(sql).get(...args) as { n: number }).n;
const statuses = (lessonId: string) => listNodes(lessonId).map((n) => `${n.node_id}:${n.status}`);

/** Every table deleteLesson clears, counted for one lesson. Compared whole, so a table nobody thought about still shows up. */
const childRows = (id: string) => ({
  lessons: rowsOf('SELECT count(*) AS n FROM lessons WHERE id = ?', id),
  nodes: rowsOf('SELECT count(*) AS n FROM nodes WHERE lesson_id = ?', id),
  events: rowsOf('SELECT count(*) AS n FROM events WHERE lesson_id = ?', id),
  memory: rowsOf('SELECT count(*) AS n FROM memory WHERE lesson_id = ?', id),
  quiz: rowsOf('SELECT count(*) AS n FROM quiz_results WHERE lesson_id = ?', id),
  turns: rowsOf('SELECT count(*) AS n FROM turns WHERE lesson_id = ?', id),
  usage: rowsOf('SELECT count(*) AS n FROM usage WHERE lesson_id = ?', id),
});

/** What a learner leaves behind in the ledger, whichever lesson the rows name. */
const ledgerOf = (learnerId: string) => ({
  turns: rowsOf('SELECT count(*) AS n FROM turns WHERE learner_id = ?', learnerId),
  usage: rowsOf('SELECT count(*) AS n FROM usage WHERE learner_id = ?', learnerId),
});

describe('withTx', () => {
  it('returns what the callback returns and rethrows its error unchanged', () => {
    assert.equal(
      withTx(() => 41 + 1),
      42,
    );
    const thrown = new Error('the first learner cannot be removed; rename it instead');
    assert.throws(
      () =>
        withTx(() => {
          throw thrown;
        }),
      (e: unknown) => e === thrown,
    );
  });

  it('does not begin a second transaction when nested', () => {
    withTx(() => {
      withTx(() => {
        createLesson('nested', 'Nesting');
      });
    });
    assert.ok(getLesson('nested'));
  });
});

describe('replaceGraph', () => {
  it('leaves the old graph exactly as it was when an upsert fails partway', () => {
    const id = lessonWithHistory('graph-rollback');
    const before = statuses(id);
    assert.deepEqual(before, ['waves:locked', 'superposition:pending', 'interference:pending']);

    // The second node's label is null against a NOT NULL column: the deletes
    // and the first upsert have already run by the time it throws.
    const broken = [
      { id: 'waves', label: 'A wave carries energy, restated', kind: 'truth', depends_on: [] },
      { id: 'brand-new', label: null as unknown as string, kind: 'derived', depends_on: ['waves'] },
    ] as GraphNodeInput[];
    assert.throws(() => replaceGraph(id, broken));

    assert.equal(listNodes(id).length, 3);
    assert.deepEqual(statuses(id), before);
    assert.equal(listNodes(id).find((n) => n.node_id === 'waves')?.label, 'A wave carries energy');
  });

  it('still replaces the graph when nothing goes wrong', () => {
    const id = lessonWithHistory('graph-ok');
    replaceGraph(id, [{ id: 'waves', label: 'A wave carries energy', kind: 'truth', depends_on: [] }]);
    assert.deepEqual(statuses(id), ['waves:locked']);
  });
});

describe('deleteLesson', () => {
  it('leaves the lesson and every child row when a delete fails partway', () => {
    const id = lessonWithHistory('delete-rollback');
    const before = childRows(id);
    assert.deepEqual(before, { lessons: 1, nodes: 3, events: 1, memory: 1, quiz: 1, turns: 1, usage: 1 });

    // Memory and quiz rows are deleted before nodes are, so the transaction is
    // already partway through by the time the trigger fires.
    breakDeletesOn('nodes', () => assert.throws(() => deleteLesson(id)));

    assert.deepEqual(childRows(id), before);
  });

  it('still removes everything when nothing goes wrong', () => {
    const id = lessonWithHistory('delete-ok');
    deleteLesson(id);
    assert.equal(getLesson(id), undefined);
    assert.deepEqual(childRows(id), { lessons: 0, nodes: 0, events: 0, memory: 0, quiz: 0, turns: 0, usage: 0 });
  });
});

describe('deleteLearner', () => {
  it('keeps both lessons when the second deleteLesson throws', () => {
    const learner = createLearner('Rollback');
    lessonWithHistory('learner-l1', learner.id);
    lessonWithHistory('learner-l2', learner.id);
    const before = childRows('learner-l1');

    // Only the second lesson's removal throws: the first one has already run
    // to completion — its turn and usage rows included — so both surviving is
    // what proves the loop is one write.
    breakDeletesOn('lessons', () => assert.throws(() => deleteLearner(learner.id)), "WHEN OLD.id = 'learner-l2'");

    assert.ok(getLesson('learner-l1'), 'the first lesson must survive the second one failing');
    assert.ok(getLesson('learner-l2'));
    assert.equal(rowsOf('SELECT count(*) AS n FROM learners WHERE id = ?', learner.id), 1);
    assert.deepEqual(childRows('learner-l1'), before);
    assert.deepEqual(ledgerOf(learner.id), { turns: 2, usage: 2 });
  });

  it('removes the learner and both lessons as one write when nothing goes wrong', () => {
    const learner = createLearner('Removable');
    lessonWithHistory('gone-l1', learner.id);
    lessonWithHistory('gone-l2', learner.id);

    deleteLearner(learner.id);

    assert.equal(getLesson('gone-l1'), undefined);
    assert.equal(getLesson('gone-l2'), undefined);
    assert.equal(rowsOf('SELECT count(*) AS n FROM learners WHERE id = ?', learner.id), 0);
    assert.deepEqual(childRows('gone-l1'), { lessons: 0, nodes: 0, events: 0, memory: 0, quiz: 0, turns: 0, usage: 0 });
    assert.deepEqual(ledgerOf(learner.id), { turns: 0, usage: 0 });
  });
});

describe('the usage ledger', () => {
  it('takes only the deleted lesson’s rows, not its neighbour’s', () => {
    const learner = createLearner('Two Lessons');
    lessonWithHistory('ledger-l1', learner.id);
    lessonWithHistory('ledger-l2', learner.id);
    const neighbour = childRows('ledger-l2');
    assert.deepEqual(neighbour.turns, 1);
    assert.deepEqual(neighbour.usage, 1);

    deleteLesson('ledger-l1');

    assert.deepEqual(childRows('ledger-l1'), { lessons: 0, nodes: 0, events: 0, memory: 0, quiz: 0, turns: 0, usage: 0 });
    assert.deepEqual(childRows('ledger-l2'), neighbour);
    assert.deepEqual(ledgerOf(learner.id), { turns: 1, usage: 1 });
  });

  it('deletes a lesson that never ran a turn, and an id that never existed', () => {
    const learner = createLearner('Never Ran');
    createLesson('ledger-bare', 'Never taught', { learnerId: learner.id });
    lessonWithHistory('ledger-bystander', learner.id);
    const bystander = childRows('ledger-bystander');

    deleteLesson('ledger-bare');
    assert.equal(getLesson('ledger-bare'), undefined);
    assert.deepEqual(childRows('ledger-bystander'), bystander);

    // An id nobody ever created: no throw, and nothing else moves either.
    assert.doesNotThrow(() => deleteLesson('ledger-never-created'));
    assert.deepEqual(childRows('ledger-bystander'), bystander);
    assert.deepEqual(ledgerOf(learner.id), { turns: 1, usage: 1 });
  });

  it('clears rows whose lesson row is already gone', () => {
    const learner = createLearner('Orphaned Rows');
    const id = 'ledger-orphan';
    lessonWithHistory(id, learner.id);

    // The state a denormalised learner_id makes possible: the lessons row is
    // gone, so lessonsOfLearner cannot see it and deleteLearner's loop can
    // never reach these rows. Only the learner-scoped deletes can.
    db.prepare('DELETE FROM lessons WHERE id = ?').run(id);
    assert.deepEqual(ledgerOf(learner.id), { turns: 1, usage: 1 });

    deleteLearner(learner.id);

    assert.deepEqual(ledgerOf(learner.id), { turns: 0, usage: 0 });
    assert.equal(listUsage({ learner: learner.id }).length, 0);
  });

  it('leaves no row anywhere in usage or turns carrying a removed learner’s id', () => {
    const learner = createLearner('Wholly Gone');
    lessonWithHistory('ledger-whole-1', learner.id);
    lessonWithHistory('ledger-whole-2', learner.id);
    const others = {
      turns: rowsOf('SELECT count(*) AS n FROM turns WHERE learner_id != ?', learner.id),
      usage: rowsOf('SELECT count(*) AS n FROM usage WHERE learner_id != ?', learner.id),
    };

    deleteLearner(learner.id);

    // Counted over the whole table rather than filtered to one lesson: a model
    // id or a token count surviving under any lesson id is the defect.
    assert.deepEqual(ledgerOf(learner.id), { turns: 0, usage: 0 });
    assert.deepEqual(
      {
        turns: rowsOf('SELECT count(*) AS n FROM turns WHERE learner_id != ?', learner.id),
        usage: rowsOf('SELECT count(*) AS n FROM usage WHERE learner_id != ?', learner.id),
      },
      others,
      'every other learner’s ledger is untouched',
    );
  });
});

describe('a restart', () => {
  it('leaves the ledger reconciling: every turn the sweep closes carries a usage row', () => {
    const learner = createLearner('Restarted');
    createLesson('sweep-l1', 'Killed mid-turn', { learnerId: learner.id });
    const reported = startTurn('sweep-l1', 'claude', 'claude-sonnet-4');
    recordUsage(reported, { input_tokens: 120, output_tokens: 34, cost_source: 'provider' });
    const silent = startTurn('sweep-l1', 'fake');

    // Two turns still running and one usage row: the state a killed process
    // leaves behind, before the boot sweep has touched anything.
    assert.deepEqual(ledgerOf(learner.id), { turns: 2, usage: 1 });

    closeOpenTurns('interrupted');

    // The count equality is the assertion. db.ts states the invariant in its
    // own words — "Every turn gets a usage row, whichever driver ran it" — and
    // it is false after a restart unless this holds.
    assert.deepEqual(ledgerOf(learner.id), { turns: 2, usage: 2 });

    // Idempotent on the turn id: the turn that already reported keeps exactly
    // the row it reported rather than gaining a second one of nulls.
    const kept = listUsage({ turn: reported });
    assert.equal(kept.length, 1);
    assert.deepEqual({ input: kept[0].input_tokens, output: kept[0].output_tokens, source: kept[0].cost_source }, { input: 120, output: 34, source: 'provider' });

    // The swept turn that reported nothing gets nulls and 'unknown' — D-16:
    // never an estimate, and never zeros, which would read as "ran and used
    // nothing" instead of "ran and reported nothing".
    const made = listUsage({ turn: silent });
    assert.equal(made.length, 1);
    assert.deepEqual(
      {
        cost_source: made[0].cost_source,
        input_tokens: made[0].input_tokens,
        output_tokens: made[0].output_tokens,
        cache_read_tokens: made[0].cache_read_tokens,
        cache_write_tokens: made[0].cache_write_tokens,
        reasoning_tokens: made[0].reasoning_tokens,
        cost_usd: made[0].cost_usd,
      },
      {
        cost_source: 'unknown',
        input_tokens: null,
        output_tokens: null,
        cache_read_tokens: null,
        cache_write_tokens: null,
        reasoning_tokens: null,
        cost_usd: null,
      },
    );
  });
});
