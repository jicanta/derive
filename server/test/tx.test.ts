/**
 * The destructive writes, and the guarantee withTx gives them: a failure
 * partway leaves the learner's record exactly as it was.
 *
 * Every case drives the real db.ts functions against a scratch database and
 * counts rows before and after; an assertion that nothing threw would prove
 * nothing. Failures partway are forced with a trigger that RAISEs, which is a
 * real statement failure inside the transaction rather than a simulated one.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';

// db.ts opens the database on import; point it at a scratch directory first.
const scratch = mkdtempSync(join(tmpdir(), 'derive-tx-'));
process.env.DERIVE_DATA_DIR = scratch;

const { addMemory, appendEvent, createLearner, createLesson, db, deleteLearner, deleteLesson, getLesson, listNodes, recordQuiz, replaceGraph, setNodeStatus, withTx } =
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
    const before = {
      lessons: rowsOf('SELECT count(*) AS n FROM lessons WHERE id = ?', id),
      nodes: rowsOf('SELECT count(*) AS n FROM nodes WHERE lesson_id = ?', id),
      events: rowsOf('SELECT count(*) AS n FROM events WHERE lesson_id = ?', id),
      memory: rowsOf('SELECT count(*) AS n FROM memory WHERE lesson_id = ?', id),
      quiz: rowsOf('SELECT count(*) AS n FROM quiz_results WHERE lesson_id = ?', id),
    };
    assert.deepEqual(before, { lessons: 1, nodes: 3, events: 1, memory: 1, quiz: 1 });

    // Memory and quiz rows are deleted before nodes are, so the transaction is
    // already partway through by the time the trigger fires.
    breakDeletesOn('nodes', () => assert.throws(() => deleteLesson(id)));

    assert.deepEqual(
      {
        lessons: rowsOf('SELECT count(*) AS n FROM lessons WHERE id = ?', id),
        nodes: rowsOf('SELECT count(*) AS n FROM nodes WHERE lesson_id = ?', id),
        events: rowsOf('SELECT count(*) AS n FROM events WHERE lesson_id = ?', id),
        memory: rowsOf('SELECT count(*) AS n FROM memory WHERE lesson_id = ?', id),
        quiz: rowsOf('SELECT count(*) AS n FROM quiz_results WHERE lesson_id = ?', id),
      },
      before,
    );
  });

  it('still removes everything when nothing goes wrong', () => {
    const id = lessonWithHistory('delete-ok');
    deleteLesson(id);
    assert.equal(getLesson(id), undefined);
    assert.equal(rowsOf('SELECT count(*) AS n FROM nodes WHERE lesson_id = ?', id), 0);
    assert.equal(rowsOf('SELECT count(*) AS n FROM events WHERE lesson_id = ?', id), 0);
  });
});

describe('deleteLearner', () => {
  it('keeps both lessons when the second deleteLesson throws', () => {
    const learner = createLearner('Rollback');
    lessonWithHistory('learner-l1', learner.id);
    lessonWithHistory('learner-l2', learner.id);

    // Only the second lesson's removal throws: the first one has already run
    // to completion, so both surviving is what proves the loop is one write.
    breakDeletesOn('lessons', () => assert.throws(() => deleteLearner(learner.id)), "WHEN OLD.id = 'learner-l2'");

    assert.ok(getLesson('learner-l1'), 'the first lesson must survive the second one failing');
    assert.ok(getLesson('learner-l2'));
    assert.equal(rowsOf('SELECT count(*) AS n FROM learners WHERE id = ?', learner.id), 1);
    assert.equal(rowsOf('SELECT count(*) AS n FROM nodes WHERE lesson_id = ?', 'learner-l1'), 3);
  });

  it('removes the learner and both lessons as one write when nothing goes wrong', () => {
    const learner = createLearner('Removable');
    lessonWithHistory('gone-l1', learner.id);
    lessonWithHistory('gone-l2', learner.id);

    deleteLearner(learner.id);

    assert.equal(getLesson('gone-l1'), undefined);
    assert.equal(getLesson('gone-l2'), undefined);
    assert.equal(rowsOf('SELECT count(*) AS n FROM learners WHERE id = ?', learner.id), 0);
    assert.equal(rowsOf('SELECT count(*) AS n FROM nodes WHERE lesson_id = ?', 'gone-l1'), 0);
  });
});
