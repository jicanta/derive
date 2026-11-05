/**
 * The lesson reducer, tested from the server package because `web/` has no
 * test runner — no `test` script, no `tsx` in its dependencies — while
 * `web/src/lib/lessonReducer.ts` imports no React, holds no state and touches
 * no browser API, so the whole fold runs under plain node. Moving this file
 * into `web/` would cost a dependency, a script and a CI step for a cosmetic
 * win: it lives here on purpose, and `node --import tsx --test` resolves the
 * cross-package import for free.
 *
 * The first case is the one that earns the file. The browser subscribes to the
 * event stream *per event name*, so a type the server emits and `EVENT_TYPES`
 * does not list is dropped in silence — no error, no warning, a lesson just
 * missing a line. Nothing in the type system connects the two lists, so this
 * compares them and fails naming the type that went missing.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { apply, EVENT_TYPES, initial, reducer } from '../../web/src/lib/lessonReducer';
import type { LessonState } from '../../web/src/lib/lessonReducer';
import type { StoredEvent } from '../../web/src/lib/types';

/**
 * Every event type the server can put in front of the browser, read off the
 * emit sites rather than guessed:
 *
 * - `emit(lessonId, '<literal>', …)` across `server/src/` — `turn_start`,
 *   `turn_end`, `user`, `assistant`, `status`, `quiz_result`, `ask_result`,
 *   `explain_result`, `plan_result`, `phase`, `warmup`, `node_status`,
 *   `memory`, `notice`, `preferences`, `material`, `material_removed`,
 *   `answer_in`, `resource`.
 * - `server/src/prompts.ts` `emit(lessonId, kind, …)`, where `kind` is the
 *   `PromptKind` union — `quiz`, `ask`, `plan`, `explain`.
 * - the sink in `server/src/driver.ts`, which passes a driver's own type
 *   through — `assistant`, `delta`, `status`.
 * - `server/src/index.ts`'s SSE route, which opens every stream with `ready`.
 *
 * `block_start` is deliberately absent: no driver emits it any more, and
 * `applyEvent` keeps its branch for events already in older lessons' logs.
 */
const EMITTED = [
  'ready',
  'turn_start',
  'turn_end',
  'status',
  'delta',
  'user',
  'assistant',
  'quiz',
  'quiz_result',
  'ask',
  'ask_result',
  'explain',
  'explain_result',
  'plan',
  'plan_result',
  'phase',
  'warmup',
  'node_status',
  'memory',
  'notice',
  'preferences',
  'material',
  'material_removed',
  'answer_in',
  'resource',
];

const ev = (type: string, payload: Record<string, unknown> = {}, seq = 1, ts = 1_700_000_000_000): StoredEvent => ({ seq, type, payload, ts });
const fold = (events: StoredEvent[], from: LessonState = initial) => events.reduce(apply, from);

describe('EVENT_TYPES against what the server emits', () => {
  it('lists every event type the server can send, so none is dropped in silence', () => {
    for (const type of EMITTED) {
      assert.ok(
        EVENT_TYPES.includes(type),
        `the server emits "${type}" and web/src/lib/lessonReducer.ts's EVENT_TYPES does not list it, so the browser ignores it without a word`,
      );
    }
  });

  it('lists nothing the server cannot send, bar the one documented legacy name', () => {
    // The other direction. A name no emit site can produce is a reducer branch
    // nothing reaches, which reads as coverage it does not have. `block_start`
    // is the one exception and it is named here rather than tolerated silently.
    const LEGACY = ['block_start'];
    const dead = EVENT_TYPES.filter((type) => !EMITTED.includes(type) && !LEGACY.includes(type));
    assert.deepEqual(dead, [], 'these listed types are emitted nowhere: either the emit site went away or the entry is a typo');
  });
});

describe('the status line', () => {
  it('is set by a status event', () => {
    const s = fold([ev('status', { text: 'Grading your answer' })]);
    assert.equal(s.status, 'Grading your answer');
  });

  it('is cleared by a block_start', () => {
    const s = fold([ev('status', { text: 'Grading your answer' }), ev('block_start', { id: 'b1' }, 2)]);
    assert.equal(s.status, null);
  });

  it('never lands in the timeline, however many times it changes', () => {
    const s = fold([ev('status', { text: 'Thinking' }, -1), ev('status', { text: 'Grading your answer' }, -1)]);
    assert.equal(s.items.length, 0, 'an ephemeral status became a stored item');
    assert.equal(s.status, 'Grading your answer');
  });
});

describe('ephemeral events', () => {
  it('merge into the block they belong to without appending anything', () => {
    const started = fold([ev('assistant', { id: 'b1', text: 'Half', partial: true })]);
    assert.equal(started.items.length, 1);
    const streamed = fold([ev('delta', { id: 'b1', text: ' a thought' }, -1)], started);
    assert.equal(streamed.items.length, 1, 'a seq -1 delta appended a second item');
    assert.equal((streamed.items[0] as { text: string }).text, 'Half a thought');
  });
});

describe('a card and its verdict', () => {
  it('collapse to one settled item under the same id', () => {
    const asked = fold([ev('quiz', { id: 'p1', question: 'Which follows?', options: ['a', 'b'] })]);
    assert.equal(asked.items.length, 1);
    assert.equal((asked.items[0] as { result?: unknown }).result, undefined);
    const graded = fold([ev('quiz_result', { id: 'p1', result: 'correct', selected: [0] }, 2)], asked);
    assert.equal(graded.items.length, 1, 'the verdict was appended beside the card instead of settling it');
    assert.equal((graded.items[0] as { result: { result: string } }).result.result, 'correct');
  });
});

describe('an assistant block', () => {
  it('is replaced under its original seq rather than appended again', () => {
    const partial = fold([ev('assistant', { id: 'b1', text: 'The gradient', partial: true }, 4)]);
    const whole = fold([ev('assistant', { id: 'b1', text: 'The gradient points uphill.' }, 4)], partial);
    assert.equal(whole.items.length, 1, 'the rewrite appended a second copy of the block');
    assert.equal((whole.items[0] as { text: string }).text, 'The gradient points uphill.');
    assert.equal((whole.items[0] as { streaming: boolean }).streaming, false);
  });

  it('keeps streamed text a late checkpoint would shrink', () => {
    const streamed = fold([ev('assistant', { id: 'b1', text: 'The gradient points uphill.', partial: true }, 4)]);
    const behind = fold([ev('assistant', { id: 'b1', text: 'The grad', partial: true }, 4)], streamed);
    assert.equal((behind.items[0] as { text: string }).text, 'The gradient points uphill.');
  });
});

describe('a notice', () => {
  it('becomes a notice item carrying its text, and nothing else', () => {
    const s = fold([ev('notice', { text: 'graded and saved · starting a fresh turn, without the earlier conversation' })]);
    assert.equal(s.items.length, 1);
    assert.deepEqual(
      { ...s.items[0], at: undefined },
      { kind: 'notice', seq: 1, text: 'graded and saved · starting a fresh turn, without the earlier conversation', at: undefined },
    );
    assert.equal(s.error, null, 'a notice is not a failure and must not land in the error field');
  });
});

describe('the init replay', () => {
  it('rebuilds a lesson from its stored events and then lets the server have the last word', () => {
    const lesson = { id: 'l1', topic: 'why the step size is bounded', phase: 'teach', mode: 'agent', answer_in: 'browser' } as never;
    const s = reducer(initial, {
      type: 'init',
      lesson,
      nodes: [{ node_id: 'slope', label: 'A slope points uphill', kind: 'truth', summary: null, depends_on: '["a"]', status: 'locked' } as never],
      materials: [],
      events: [ev('assistant', { id: 'b1', text: 'Teaching the slope.', partial: true }), ev('notice', { text: 'graded and saved' }, 2)],
      busy: false,
      pending: { id: 'p1', kind: 'quiz', held: true },
      tutor: { provider: 'anthropic', model: 'claude-opus-5-5' },
    });
    assert.equal(s.phase, 'teach');
    assert.deepEqual(s.nodes, [{ id: 'slope', label: 'A slope points uphill', kind: 'truth', summary: null, depends_on: ['a'], status: 'locked' }]);
    assert.equal(s.items.filter((i) => i.kind === 'notice').length, 1);
    // A block left streaming by the boot that wrote it is not still streaming.
    assert.equal(s.items.filter((i) => i.kind === 'assistant' && i.streaming).length, 0);
    assert.equal(s.busy, false);
    assert.equal(s.status, null, 'a lesson with no turn running must not show a status line');
    assert.deepEqual(s.pending, { id: 'p1', kind: 'quiz', held: true });
  });
});
