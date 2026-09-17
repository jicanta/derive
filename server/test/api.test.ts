/**
 * The learning mechanics, driven over HTTP against the built server with
 * no model behind it. External lessons (the plugin's path) never call a
 * model, and terminal-answered cards return at once, so a test can play
 * both the tutor and the learner: build a graph, teach, check, lock, run
 * the cumulative quiz, then start a second lesson and see the warm-up.
 *
 * Needs `pnpm build` first (it runs server/dist/index.js).
 */
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const entry = resolve(here, '../dist/index.js');
const DAY = 86_400_000;

let server: ChildProcess | undefined;
let base = '';
let dataDir = '';

const api = async <T = Record<string, unknown>>(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<{ status: number; json: T }> => {
  const res = await fetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, json: (await res.json()) as T };
};
const act = (lesson: string, action: string, body: unknown) => api(`/api/external/lessons/${lesson}/${action}`, body);
/** Open a terminal card and answer it in one go, returning the graded result. */
const askAndAnswer = async (lesson: string, quiz: Record<string, unknown>, reply: string) => {
  const opened = await act(lesson, 'quiz', quiz);
  assert.equal(opened.status, 200, JSON.stringify(opened.json));
  assert.equal(opened.json.status, 'pending');
  const answered = await act(lesson, 'answer', { reply });
  assert.equal(answered.status, 200, JSON.stringify(answered.json));
  return answered.json as { result: string; purpose: string; tests: string | null; instruction?: string };
};
const teachProse = (lesson: string, node: string) =>
  act(lesson, 'mirror', { role: 'assistant', text: `Teaching ${node}. `.repeat(30), uid: `${node}-prose` });
const nodes = async (lesson: string) => {
  const r = await api<{ nodes: { node_id: string; status: string; review_at: number | null; source_lesson: string | null; stability: number | null }[] }>(`/api/lessons/${lesson}`);
  return new Map(r.json.nodes.map((n) => [n.node_id, n]));
};

before(async () => {
  assert.ok(existsSync(entry), `build first: ${entry} is missing`);
  dataDir = mkdtempSync(join(tmpdir(), 'derive-api-'));
  const port = 4400 + Math.floor(Math.random() * 500);
  base = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, [entry], { env: { ...process.env, PORT: String(port), DERIVE_DATA_DIR: dataDir, DERIVE_BACKEND: 'claude' }, stdio: ['ignore', 'pipe', 'pipe'] });
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${base}/api/health`);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('server did not start');
});

after(() => {
  server?.kill();
  if (dataDir) rmSync(dataDir, { recursive: true, force: true });
});

describe('a lesson, end to end', () => {
  let lesson = '';
  const quiz = (node_id: string, extra: Record<string, unknown> = {}) => ({
    question: `About ${node_id}?`,
    options: ['the right claim', 'a tempting wrong claim'],
    correct: [0],
    explanation: 'because',
    node_id,
    purpose: 'check',
    ...extra,
  });

  it('starts a terminal-answered lesson with no warm-up on a fresh learner', async () => {
    const r = await api<{ id: string; warmup?: string }>('/api/external/lessons', { topic: 'why gradient descent works', answer_in: 'terminal' });
    assert.equal(r.status, 201);
    assert.equal(r.json.warmup, undefined);
    lesson = r.json.id;
  });

  it('approves a plan from the terminal', async () => {
    const opened = await act(lesson, 'set_plan', {
      goal: 'Understand why the step size is bounded',
      nodes: [
        { id: 'slope', label: 'A slope points uphill', kind: 'truth', summary: 'The gradient points where the function grows fastest.' },
        { id: 'step', label: 'Stepping against the slope descends', kind: 'derived', summary: 'Moving against the gradient lowers the value for a small enough step.', depends_on: ['slope'] },
        { id: 'goal', label: 'The step must stay below a bound', kind: 'goal', summary: 'Too large a step overshoots and climbs.', depends_on: ['step'] },
      ],
    });
    assert.equal(opened.json.status, 'pending');
    const ok = await act(lesson, 'answer', { reply: 'yes' });
    assert.equal((ok.json as { approved: boolean }).approved, true);
    await act(lesson, 'set_phase', { phase: 'teach' });
  });

  it('refuses a check before any teaching prose, then locks a truth on a plain check', async () => {
    await act(lesson, 'node_status', { id: 'slope', status: 'teaching' });
    const early = await act(lesson, 'quiz', quiz('slope', { tests: 'procedure' }));
    assert.equal(early.status, 400);
    assert.match(String(early.json.error), /Teach first/);
    await teachProse(lesson, 'slope');
    const r = await askAndAnswer(lesson, quiz('slope', { tests: 'procedure' }), 'A');
    assert.equal(r.result, 'correct');
    assert.equal(r.tests, 'procedure');
    const locked = await act(lesson, 'node_status', { id: 'slope', status: 'locked' });
    assert.equal(locked.status, 200, JSON.stringify(locked.json));
    assert.ok(typeof locked.json.next_review_in_days === 'number');
  });

  it('will not lock a derived node on procedure alone', async () => {
    await act(lesson, 'node_status', { id: 'step', status: 'teaching' });
    await teachProse(lesson, 'step');
    const r = await askAndAnswer(lesson, quiz('step', { tests: 'procedure' }), 'A');
    assert.equal(r.result, 'correct');
    assert.match(String(r.instruction), /intuition/);
    const refused = await act(lesson, 'node_status', { id: 'step', status: 'locked' });
    assert.equal(refused.status, 400);
    assert.equal(refused.json.refused, true);
    assert.match(String(refused.json.error), /intuition|transfer/);
    assert.equal((await nodes(lesson)).get('step')!.status, 'teaching');
  });

  it('locks it after an intuition question, crediting the node below', async () => {
    // A claim locked minutes ago has nothing to gain from being used again (FSRS discounts an
    // early review, as Skycak discounts an early repetition), so age the dependency first: it
    // was locked three weeks ago and its review was due yesterday.
    const db = new DatabaseSync(join(dataDir, 'derive.db'));
    db.prepare('UPDATE nodes SET last_review = ?, review_at = ? WHERE lesson_id = ? AND node_id = ?').run(Date.now() - 21 * DAY, Date.now() - DAY, lesson, 'slope');
    db.close();
    const before = (await nodes(lesson)).get('slope')!;
    const r = await askAndAnswer(lesson, quiz('step', { tests: 'intuition' }), 'A');
    assert.equal(r.result, 'correct');
    assert.doesNotMatch(String(r.instruction), /before you lock/);
    const locked = await act(lesson, 'node_status', { id: 'step', status: 'locked' });
    assert.equal(locked.status, 200, JSON.stringify(locked.json));
    assert.match(String(locked.json.implicit_review), /A slope points uphill/);
    const after = (await nodes(lesson)).get('slope')!;
    assert.ok(after.review_at! > Date.now(), 'the dependency is no longer due');
    assert.ok(after.stability! > before.stability!, 'and its stability grew');
    assert.equal(after.status, 'locked');
  });

  it('opens the cumulative quiz when the goal locks', async () => {
    await act(lesson, 'node_status', { id: 'goal', status: 'teaching' });
    await teachProse(lesson, 'goal');
    const r = await askAndAnswer(lesson, quiz('goal', { tests: 'transfer' }), 'A');
    assert.equal(r.result, 'correct');
    const locked = await act(lesson, 'node_status', { id: 'goal', status: 'locked' });
    assert.equal(locked.status, 200);
    assert.match(String(locked.json.instruction), /cumulative quiz/);
    assert.match(String(locked.json.instruction), /\[step\]/);
  });

  it('marks a node shaky on a cumulative miss and pulls the review of what was built on it closer', async () => {
    const goalBefore = (await nodes(lesson)).get('goal')!;
    const r = await askAndAnswer(lesson, quiz('step', { purpose: 'cumulative', tests: 'transfer' }), 'B');
    assert.equal(r.result, 'incorrect');
    assert.equal(r.purpose, 'cumulative');
    assert.match(String(r.instruction), /shaky/);
    assert.match(String(r.instruction), /A slope points uphill/);
    const now = await nodes(lesson);
    assert.equal(now.get('step')!.status, 'shaky');
    assert.ok(now.get('goal')!.review_at! <= goalBefore.review_at!, 'the goal\'s review is no later than before');
    assert.ok(now.get('goal')!.stability! < goalBefore.stability!, 'and its stability dropped');
  });

  it('lets the node lock again once a fresh cumulative question holds, and reports what is left', async () => {
    const r = await askAndAnswer(lesson, quiz('step', { purpose: 'cumulative', tests: 'intuition' }), 'A');
    assert.equal(r.result, 'correct');
    assert.match(String(r.instruction), /\[goal\]/, 'the goal is still to cover');
    const locked = await act(lesson, 'node_status', { id: 'step', status: 'locked' });
    assert.equal(locked.status, 200);
    const last = await askAndAnswer(lesson, quiz('goal', { purpose: 'cumulative', tests: 'transfer' }), 'A');
    assert.match(String(last.instruction), /last one|closing/);
  });

  it('rejects an unknown tests value', async () => {
    const r = await act(lesson, 'quiz', quiz('goal', { tests: 'vibes' }));
    assert.equal(r.status, 400);
  });

  describe('the next lesson', () => {
    let next = '';

    it('opens with a warm-up of the due nodes, most likely forgotten first', async () => {
      // Make two nodes overdue with the same stability but different ages: the older one is the more likely forgotten.
      const db = new DatabaseSync(join(dataDir, 'derive.db'));
      db.prepare('UPDATE nodes SET stability = 5, review_at = ?, last_review = ? WHERE lesson_id = ? AND node_id = ?').run(Date.now() - 30 * DAY, Date.now() - 32 * DAY, lesson, 'slope');
      db.prepare('UPDATE nodes SET stability = 5, review_at = ?, last_review = ? WHERE lesson_id = ? AND node_id = ?').run(Date.now() - 2 * DAY, Date.now() - 4 * DAY, lesson, 'goal');
      db.close();
      const r = await api<{ id: string; warmup?: string }>('/api/external/lessons', { topic: 'momentum', answer_in: 'terminal' });
      assert.equal(r.status, 201);
      next = r.json.id;
      assert.ok(r.json.warmup, 'a warm-up brief comes back');
      assert.match(r.json.warmup!, /Warm-up first/);
      const slopeAt = r.json.warmup!.indexOf('[warmup-slope]');
      const goalAt = r.json.warmup!.indexOf('[warmup-goal]');
      assert.ok(slopeAt >= 0 && goalAt >= 0, r.json.warmup);
      assert.ok(slopeAt < goalAt, 'the older, more forgotten node comes first');
      const copies = [...(await nodes(next)).values()].filter((n) => n.source_lesson);
      assert.equal(copies.length, 2);
    });

    it('treats a question on a warm-up node as a review by default and reschedules the original on lock', async () => {
      const before = (await nodes(lesson)).get('slope')!;
      const r = await askAndAnswer(next, { question: 'Apply it somewhere new?', options: ['yes claim', 'no claim'], correct: [0], explanation: 'x', node_id: 'warmup-slope', tests: 'transfer' }, 'A');
      assert.equal(r.purpose, 'review');
      assert.equal(r.result, 'correct');
      const locked = await act(next, 'node_status', { id: 'warmup-slope', status: 'locked' });
      assert.equal(locked.status, 200, JSON.stringify(locked.json));
      const after = (await nodes(lesson)).get('slope')!;
      assert.ok(after.review_at! > Date.now(), 'the original is no longer due');
      assert.ok(after.review_at! > before.review_at!);
    });

    it('drops the warm-up copies when the plan replaces the graph', async () => {
      const opened = await act(next, 'set_plan', {
        goal: 'g',
        nodes: [
          { id: 'a', label: 'A truth', kind: 'truth', summary: 's' },
          { id: 'b', label: 'A derived claim', kind: 'derived', summary: 's', depends_on: ['a'] },
          { id: 'c', label: 'The goal', kind: 'goal', summary: 's', depends_on: ['b'] },
        ],
      });
      assert.equal(opened.json.status, 'pending');
      await act(next, 'answer', { reply: 'yes' });
      const all = await nodes(next);
      assert.equal(all.size, 3);
      assert.ok(![...all.values()].some((n) => n.source_lesson));
    });
  });
});
