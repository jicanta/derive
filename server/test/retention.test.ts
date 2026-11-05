/**
 * The four retention figures, against a scratch database.
 *
 * The case this file exists for is the thin one: a learner with nine reviews
 * behind them must not be shown a confident percentage. A perfect score over
 * one review is a true statement that means nothing, and the one honest number
 * in the app must never be confidently wrong — so the threshold is asserted on
 * both sides of its edge, with the sample count checked too, because the panel
 * reads the count rather than inferring it.
 *
 * The rest are the exclusions that decide whether the figure is honest at all:
 * a locked node with no FSRS state leaves both the numerator and the
 * denominator (`retrievability()` returns a flat 1 for it, so counting it would
 * over-report the figure); a review session's copy of a node never counts twice;
 * another learner's reviews never enter; and only the *first* `review`-purpose
 * row per (lesson, node) inside the 90-day window is a first try.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';

// db.ts opens the database on import; point it at a scratch directory first.
const scratch = mkdtempSync(join(tmpdir(), 'derive-retention-'));
process.env.DERIVE_DATA_DIR = scratch;

const { createLearner, createLesson, db, replaceGraph, retention, setNodeStatus } = await import('../src/db.js');
const { REQUEST_RETENTION } = await import('../src/schedule.js');

type GraphNodeInput = import('../src/db.js').GraphNodeInput;

after(() => rmSync(scratch, { recursive: true, force: true }));

const DAY = 86_400_000;
let seq = 0;

const insertQuiz = db.prepare('INSERT INTO quiz_results (lesson_id, node_id, correct, confidence, purpose, tests, ts) VALUES (?, ?, ?, ?, ?, ?, ?)');

/** A lesson with `n` locked nodes, owned by `learnerId`. Locking writes the FSRS state, so every node carries a stability. */
function lockedLesson(learnerId: string, n: number, opts: { scratch?: boolean } = {}): string {
  const id = `lesson-${++seq}`;
  createLesson(id, `topic ${id}`, { learnerId, scratch: opts.scratch });
  const nodes: GraphNodeInput[] = Array.from({ length: n }, (_, i) => ({ id: `n${i}`, label: `claim ${i}`, kind: 'truth', depends_on: [] }));
  replaceGraph(id, nodes);
  for (const node of nodes) setNodeStatus(id, node.id, 'locked');
  return id;
}

/** `n` review-purpose rows on distinct nodes of `lessonId`, `passed` of them correct, all inside the window. */
function reviews(lessonId: string, n: number, passed: number, at = Date.now() - DAY) {
  for (let i = 0; i < n; i++) insertQuiz.run(lessonId, `n${i}`, i < passed ? 1 : 0, 'sure', 'review', 'intuition', at);
}

describe('estimated knowledge', () => {
  it('sums retrievability over locked nodes and counts them as the denominator', () => {
    const who = createLearner('Knowledge').id;
    lockedLesson(who, 4);
    const r = retention(who);
    assert.equal(r.locked, 4);
    // Just locked, so every node is held: the rounded sum is the whole count.
    assert.equal(r.held, 4);
  });

  it('excludes a locked node with no FSRS state from BOTH the numerator and the denominator', () => {
    const who = createLearner('No state').id;
    const lesson = lockedLesson(who, 3);
    // An older row, written before the FSRS columns existed. retrievability()
    // returns a flat 1 for it, so counting it would silently over-report.
    db.prepare('UPDATE nodes SET stability = NULL, difficulty = NULL WHERE lesson_id = ? AND node_id = ?').run(lesson, 'n0');
    const r = retention(who);
    assert.equal(r.locked, 2, 'the stateless node must leave the denominator');
    assert.equal(r.held, 2, 'and must not be counted as perfectly held');
  });

  it('does not count a review copy twice, and renders nothing when there is no locked node', () => {
    const who = createLearner('Copies').id;
    const source = lockedLesson(who, 2);
    const review = `lesson-${++seq}`;
    createLesson(review, 'review session', { learnerId: who });
    db.prepare(
      "INSERT INTO nodes (lesson_id, node_id, label, kind, summary, depends_on, status, stability, difficulty, lapses, reps, interval_days, source_lesson, source_node) VALUES (?, ?, ?, 'truth', NULL, '[]', 'locked', 10, 5, 0, 1, 10, ?, 'n0')",
    ).run(review, 'review-n0', 'claim 0', source);
    assert.equal(retention(who).locked, 2, 'the copy stands for a node already counted');

    const empty = createLearner('Empty').id;
    assert.equal(retention(empty).locked, 0);
    assert.equal(retention(empty).held, 0);
  });

  it('ignores a scratch lesson, as every learner-wide read does', () => {
    const who = createLearner('Scratch').id;
    lockedLesson(who, 2);
    lockedLesson(who, 5, { scratch: true });
    assert.equal(retention(who).locked, 2);
  });
});

describe('true retention', () => {
  it('withholds the percentage under ten first tries and reports the sample', () => {
    const who = createLearner('Thin').id;
    const lesson = lockedLesson(who, 9);
    reviews(lesson, 9, 9);
    const r = retention(who);
    assert.equal(r.reviewSample, 9);
    assert.equal(r.trueRetention, null, 'nine out of nine is a true statement that means nothing');
  });

  it('prints the percentage at ten and above', () => {
    const who = createLearner('Enough').id;
    const lesson = lockedLesson(who, 10);
    reviews(lesson, 10, 8);
    const r = retention(who);
    assert.equal(r.reviewSample, 10);
    assert.equal(r.trueRetention, 80);
  });

  it('keeps the other three figures at every sample count', () => {
    const who = createLearner('Three others').id;
    const lesson = lockedLesson(who, 3);
    reviews(lesson, 2, 2);
    const r = retention(who);
    assert.equal(r.trueRetention, null);
    assert.equal(r.locked, 3, 'estimated knowledge has no threshold');
    assert.equal(r.desired, Math.round(REQUEST_RETENTION * 100), "the target is the scheduler's own constant");
    assert.equal(r.forecast.length, 14, 'the fortnight has no threshold either');
  });

  it('counts only the first review row per node, and only review-purpose rows inside the window', () => {
    const who = createLearner('First try').id;
    const lesson = lockedLesson(who, 10);
    reviews(lesson, 10, 10);
    // A second, failed try on every node must not move the figure.
    for (let i = 0; i < 10; i++) insertQuiz.run(lesson, `n${i}`, 0, 'sure', 'review', 'intuition', Date.now() - 1_000);
    assert.equal(retention(who).trueRetention, 100, 'the first try is the one that counts');
    assert.equal(retention(who).reviewSample, 10);

    // Checks and cumulative questions are not reviews.
    for (let i = 0; i < 10; i++) insertQuiz.run(lesson, `n${i}`, 0, 'sure', 'check', 'intuition', Date.now() - 2_000);
    for (let i = 0; i < 10; i++) insertQuiz.run(lesson, `n${i}`, 0, 'sure', 'cumulative', 'intuition', Date.now() - 2_000);
    assert.equal(retention(who).trueRetention, 100);

    // And a review from four months ago is outside the 90-day window.
    const old = createLearner('Old reviews').id;
    const stale = lockedLesson(old, 12);
    reviews(stale, 12, 12, Date.now() - 120 * DAY);
    const r = retention(old);
    assert.equal(r.reviewSample, 0);
    assert.equal(r.trueRetention, null);
  });

  it('never reads another learner rows', () => {
    const mine = createLearner('Mine').id;
    const theirs = createLearner('Theirs').id;
    const lesson = lockedLesson(theirs, 10);
    reviews(lesson, 10, 10);
    const r = retention(mine);
    assert.equal(r.reviewSample, 0);
    assert.equal(r.locked, 0);
  });
});

describe('the fortnight ahead', () => {
  it('always returns fourteen days, zero-filled, with local midnights ascending', () => {
    const who = createLearner('Fortnight').id;
    lockedLesson(who, 1);
    // That one node is scheduled a day out; everything else in the strip is zero.
    const r = retention(who);
    assert.equal(r.forecast.length, 14);
    assert.ok(
      r.forecast.every((d, i) => i === 0 || d.day > r.forecast[i - 1].day),
      'days ascend',
    );
    assert.equal(r.forecast.reduce((s, d) => s + d.count, 0), 1);
  });

  it('folds everything already overdue into today bar and leaves later dates out', () => {
    const who = createLearner('Overdue').id;
    const lesson = lockedLesson(who, 3);
    const set = db.prepare('UPDATE nodes SET review_at = ? WHERE lesson_id = ? AND node_id = ?');
    set.run(Date.now() - 30 * DAY, lesson, 'n0');
    set.run(Date.now() - 2 * DAY, lesson, 'n1');
    set.run(Date.now() + 60 * DAY, lesson, 'n2');
    const r = retention(who);
    assert.equal(r.forecast[0].count, 2, 'what is overdue is what the learner can do now');
    assert.equal(r.forecast.reduce((s, d) => s + d.count, 0), 2, 'a review two months out is not in the fortnight');
  });

  it('reports an all-zero fortnight rather than hiding it, and the next review ahead', () => {
    const who = createLearner('Nothing due').id;
    const lesson = lockedLesson(who, 2);
    const far = Date.now() + 40 * DAY;
    db.prepare('UPDATE nodes SET review_at = ? WHERE lesson_id = ?').run(far, lesson);
    const r = retention(who);
    assert.equal(r.forecast.length, 14);
    assert.equal(r.forecast.reduce((s, d) => s + d.count, 0), 0);
    assert.equal(r.nextReviewAt, far);
  });
});
