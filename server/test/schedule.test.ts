import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { grade, implicitLapse, implicitRepetition, retrievability, schedule, weakestFirst } from '../src/schedule.js';

const DAY = 86_400_000;
const fresh = { stability: null, difficulty: null, reps: 0, lapses: 0, last_review: null, review_at: null, interval_days: 1 };

describe('grade', () => {
  it('maps a check to an FSRS rating', () => {
    assert.equal(grade(false, 'sure'), 'again');
    assert.equal(grade(true, 'unsure'), 'hard');
    assert.equal(grade(true, 'sure'), 'good');
    assert.equal(grade(true, null), 'good');
  });
});

describe('schedule', () => {
  it('gives a confident pass a longer first interval than an unsure one', () => {
    const now = Date.now();
    const good = schedule(fresh, 'good', now);
    const hard = schedule(fresh, 'hard', now);
    assert.ok(good.interval_days >= hard.interval_days, `${good.interval_days} >= ${hard.interval_days}`);
    assert.ok(good.review_at >= now + DAY, 'never due before tomorrow');
  });

  it('resets on a lapse', () => {
    const now = Date.now();
    let node = { ...fresh, ...schedule(fresh, 'good', now) };
    for (let i = 0; i < 3; i++) node = { ...node, ...schedule(node, 'good', node.review_at) };
    const lapsed = schedule(node, 'again', node.review_at);
    assert.ok(lapsed.stability < node.stability, 'stability drops');
    assert.equal(lapsed.lapses, node.lapses + 1);
  });
});

describe('fractional implicit repetition', () => {
  const locked = (now: number) => ({ ...fresh, ...schedule(fresh, 'good', now) });

  it('is a no-op on a node that was never scheduled', () => {
    assert.equal(implicitRepetition(fresh, 0.5), null);
    assert.equal(implicitLapse(fresh, 0.5), null);
  });

  it('credit grows stability and pushes the review out, by the fraction given', () => {
    const now = Date.now();
    const node = locked(now);
    const later = now + 2 * DAY;
    const half = implicitRepetition(node, 0.5, later)!;
    const full = implicitRepetition(node, 1, later)!;
    const none = implicitRepetition(node, 0, later)!;
    assert.ok(half.stability > node.stability, 'half credit raises stability');
    assert.ok(full.stability > half.stability, 'full credit raises it more');
    assert.ok(Math.abs(none.stability - node.stability) < 1e-9, 'zero credit leaves stability alone');
    assert.ok(half.review_at > node.review_at, 'review moves later');
    assert.equal(half.reps, node.reps, 'not counted as an explicit repetition');
    assert.equal(half.last_review, later);
  });

  it('penalty shrinks stability and brings the review closer, without counting a lapse', () => {
    const now = Date.now();
    let node = locked(now);
    for (let i = 0; i < 4; i++) node = { ...node, ...schedule(node, 'good', node.review_at) };
    const at = node.last_review + DAY;
    const hit = implicitLapse(node, 0.5, at)!;
    assert.ok(hit.stability < node.stability, 'stability drops');
    assert.ok(hit.review_at <= node.review_at, 'review is no later than before');
    assert.ok(hit.review_at >= at + DAY, 'but never before tomorrow');
    assert.equal(hit.lapses, node.lapses, 'not counted as a lapse');
    assert.equal(hit.last_review, node.last_review, 'the forgetting curve keeps its origin');
  });

  it('retrievability falls with time and rises with credit', () => {
    const now = Date.now();
    const node = locked(now);
    const r0 = retrievability(node, now);
    const r7 = retrievability(node, now + 7 * DAY);
    assert.ok(r0 > r7, 'memory decays');
    const credited = { ...node, ...implicitRepetition(node, 0.5, now + 7 * DAY)! };
    assert.ok(retrievability(credited, now + 7 * DAY) > r7, 'credit restores it');
    assert.equal(retrievability(fresh), 1, 'an unscheduled node is not forgotten');
  });
});

describe('weakestFirst', () => {
  const now = Date.UTC(2026, 0, 15);
  /** A dependency reviewed `days` ago with the stability a first confident pass earns, plus the two precomputed tie-break fields. */
  const dep = (id: string, days: number, extra: { missed?: boolean; status?: string } = {}) => ({
    id,
    ...fresh,
    ...schedule(fresh, 'good', now - days * DAY),
    missed: extra.missed ?? false,
    status: extra.status ?? 'locked',
  });

  it('puts the least likely recalled first', () => {
    const order = weakestFirst([dep('recent', 1), dep('oldest', 40), dep('middle', 10)], now).map((d) => d.id);
    assert.deepEqual(order, ['oldest', 'middle', 'recent']);
  });

  it('does not mutate its input', () => {
    const input = [dep('recent', 1), dep('oldest', 40)];
    const copy = [...input];
    weakestFirst(input, now);
    assert.deepEqual(input, copy, 'the caller\'s array was reordered under it');
  });

  it('breaks a tie in retrievability on what this lesson\'s checks showed', () => {
    const [first, second] = weakestFirst([dep('passed', 10), dep('missed', 10, { missed: true })], now);
    assert.equal(first.id, 'missed', 'a miss beats a pass at equal retrievability');
    assert.equal(second.id, 'passed');
    assert.ok(Math.abs(retrievability(first, now) - retrievability(second, now)) < 1e-12, 'the two really were tied');
  });

  it('breaks a tie in both on status, shaky before pending before locked', () => {
    const unscheduled = (id: string, status: string) => ({ id, ...fresh, missed: false, status });
    const order = weakestFirst([unscheduled('c', 'locked'), unscheduled('a', 'shaky'), unscheduled('b', 'pending')], now).map((d) => d.id);
    assert.deepEqual(order, ['a', 'b', 'c']);
  });

  it('leaves a dependency with no FSRS state last, where the retrievability fallback puts it', () => {
    // `retrievability()` returns a flat 1 for a node with no memory state: never
    // scheduled is not the same as forgotten, so a decayed locked dependency is
    // the weaker of the two and the remediation goes there.
    const none = { id: 'never-scheduled', ...fresh, missed: false, status: 'pending' };
    assert.equal(retrievability(none, now), 1);
    assert.deepEqual(weakestFirst([none, dep('decayed', 30)], now).map((d) => d.id), ['decayed', 'never-scheduled']);
  });

  it('returns the one dependency there is, and an empty order for none', () => {
    assert.deepEqual(weakestFirst([dep('only', 3)], now).map((d) => d.id), ['only']);
    assert.deepEqual(weakestFirst([], now), []);
  });
});
