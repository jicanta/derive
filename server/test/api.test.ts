/**
 * The learning mechanics, driven over HTTP. Two halves, and the division is
 * the point.
 *
 * The first half drives the built server as a child process with no model
 * behind it at all. External lessons (the plugin's path) never call a model,
 * and terminal-answered cards return at once, so a test can play both the
 * tutor and the learner: build a graph, teach, check, lock, run the cumulative
 * quiz, then start a second lesson and see the warm-up. That is the terminal
 * path, and this phase's compatibility promise rests on those cases staying
 * exactly as they were.
 *
 * The second half drives Derive's own agent loop — the path an API key, a
 * gateway or a learner's own endpoint takes — through the same routes, with a
 * stub `LanguageModel` where the provider would be. It is the automated half
 * of this milestone's first success criterion: that the same tools and the
 * same method reach the learner on a provider Derive drives itself.
 *
 * What no automated test here can show, stated so that this file is not read
 * as coverage it does not have. This environment has no provider key, so the
 * real-key halves of Success Criteria 1 and 2 — a whole lesson on an
 * Anthropic, an OpenAI and a Gemini key, one through OpenRouter with a billed
 * cost in the usage table, one through a base URL plus key, and one lesson
 * each through the Claude Code plugin and the Codex skills — are carried as
 * human checks in the plans of phase 03 (03-09 Task 3) and nowhere in this
 * suite. A stub model proves the loop; it cannot prove a provider.
 *
 * Needs `pnpm build` first (the first half runs server/dist/index.js).
 */
import assert from 'node:assert/strict';
import { type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { MockLanguageModelV4, simulateReadableStream } from 'ai/test';
import { fakeServer, freePort, startDeriveServer, startInProcessServer, type InProcessServer } from './spawn.js';

const here = dirname(fileURLToPath(import.meta.url));
const entry = resolve(here, '../dist/index.js');
const DAY = 86_400_000;

let server: ChildProcess | undefined;
let base = '';
let dataDir = '';
/** The install token the server wrote into the scratch data dir on its first boot; every /api call but health carries it. */
let token = '';

const api = async <T = Record<string, unknown>>(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<{ status: number; json: T }> => {
  const res = await fetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json', 'x-derive-token': token }, body: body === undefined ? undefined : JSON.stringify(body) });
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
  ({ child: server, base, dataDir } = await startDeriveServer(entry));
  token = readFileSync(join(dataDir, 'token'), 'utf8').trim();
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

    it('is busy while its turn row is running, and idle once the terminal ends it', async () => {
      // The turn opened when the lesson did: the terminal is mid-turn, and the
      // browser must not be told this lesson is idle.
      const before = await api<{ busy: boolean }>(`/api/lessons/${next}`);
      assert.equal(before.json.busy, true);

      const db = new DatabaseSync(join(dataDir, 'derive.db'));
      const open = (db.prepare('SELECT status, driver, ended_at FROM turns WHERE lesson_id = ?').all(next) as { status: string; driver: string; ended_at: number | null }[]).map((r) => ({ ...r }));
      db.close();
      assert.deepEqual(open, [{ status: 'running', driver: 'claude-code', ended_at: null }]);

      const ended = await act(next, 'end', {});
      assert.equal(ended.status, 200);
      const after = await api<{ busy: boolean }>(`/api/lessons/${next}`);
      assert.equal(after.json.busy, false);

      const db2 = new DatabaseSync(join(dataDir, 'derive.db'));
      const closed = db2.prepare('SELECT status, ended_at FROM turns WHERE lesson_id = ?').get(next) as { status: string; ended_at: number | null };
      db2.close();
      assert.equal(closed.status, 'ok');
      assert.ok(closed.ended_at !== null);
    });
  });
});

/**
 * The owned loop, through the app's own HTTP surface.
 *
 * The server runs inside this process (`startInProcessServer`) because
 * `setModelOverride` is reachable from nowhere else: no route, header,
 * environment variable or config file can install a model, which is what keeps
 * the production path honest and what makes a spawned child useless here. The
 * provider, the key, the lesson, the turn and every answered card go through
 * the real routes; the only thing standing in for Anthropic is the model
 * object, so nothing in this block reaches a network.
 */
describe("the owned loop, through the app's own routes", () => {
  let server: InProcessServer | undefined;
  let scratch = '';
  let token = '';
  let lesson = '';
  let model: MockLanguageModelV4;
  let revert: () => void = () => undefined;

  const step = (chunks: unknown[]) => ({ stream: simulateReadableStream({ chunks: chunks as never[], initialDelayInMs: 0, chunkDelayInMs: 0 }) });
  const toolCall = (id: string, name: string, input: string) => ({ type: 'tool-call', toolCallId: id, toolName: name, input });
  const finish = (unified: string, raw: string) => ({
    type: 'finish',
    finishReason: { unified, raw },
    usage: { inputTokens: { total: 120, noCache: 100, cacheRead: 20, cacheWrite: undefined }, outputTokens: { total: 30, text: 25, reasoning: 5 } },
  });
  const says = (id: string, text: string) => [{ type: 'text-start', id }, { type: 'text-delta', id, delta: text }, { type: 'text-end', id }];

  const PLAN = JSON.stringify({
    goal: 'Understand why the step size is bounded',
    nodes: [
      { id: 'slope', label: 'A slope points uphill', kind: 'truth', summary: 'The gradient points where the function grows fastest.' },
      { id: 'step', label: 'Stepping against the slope descends', kind: 'derived', summary: 'Moving against the gradient lowers the value for a small enough step.', depends_on: ['slope'] },
      { id: 'goal', label: 'The step must stay below a bound', kind: 'goal', summary: 'Too large a step overshoots and climbs.', depends_on: ['step'] },
    ],
  });
  const quiz = (tests: string) =>
    JSON.stringify({
      question: `About stepping against the slope, ${tests}?`,
      options: ['the right claim', 'a tempting wrong claim'],
      correct: [0],
      explanation: 'because the gradient points uphill',
      node_id: 'step',
      purpose: 'check',
      tests,
    });

  const call = async <T = Record<string, unknown>>(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<{ status: number; json: T }> => {
    const res = await fetch(`${server!.base}${path}`, {
      method,
      headers: { 'content-type': 'application/json', 'x-derive-token': token },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, json: (await res.json()) as T };
  };
  type Event = { seq: number; type: string; payload: Record<string, unknown> };
  const view = () => call<{ busy: boolean; cost: string | null; nodes: { node_id: string; status: string }[]; events: Event[] }>(`/api/lessons/${lesson}`);
  const poll = async <T>(what: string, f: () => Promise<T | null>, tries = 600): Promise<T> => {
    for (let i = 0; i < tries; i += 1) {
      const v = await f();
      if (v !== null) return v;
      await new Promise((r) => setTimeout(r, 25));
    }
    throw new Error(`${what} never happened`);
  };
  /** Answer a card the loop opened, the way the browser does: find the event, post to /answer, and report the seq so the next wait cannot match this card again. */
  const settleCard = async (kind: 'plan' | 'quiz', after: number, answer: Record<string, unknown>): Promise<number> => {
    const card = await poll(`a ${kind} card`, async () => (await view()).json.events.find((e) => e.type === kind && e.seq > after) ?? null);
    const answered = await call(`/api/lessons/${lesson}/answer`, { prompt_id: card.payload.id, ...answer });
    assert.equal(answered.status, 200, JSON.stringify(answered.json));
    return card.seq;
  };
  const idle = () => poll('the turn ending', async () => ((await view()).json.busy ? null : true));
  const events = async () => (await view()).json.events;

  before(async () => {
    scratch = mkdtempSync(join(tmpdir(), 'derive-loop-'));
    process.env.DERIVE_DATA_DIR = scratch;
    // Cleared rather than set: the whole point is that the provider, the model
    // and the key come from the settings this suite writes through the routes.
    // An inherited ANTHROPIC_API_KEY would lock the key field with a 409.
    for (const v of ['DERIVE_BACKEND', 'DERIVE_MODEL', 'ANTHROPIC_API_KEY', 'TAVILY_API_KEY']) delete process.env[v];
    server = await startInProcessServer();
    token = readFileSync(join(scratch, 'token'), 'utf8').trim();

    const keyed = await call(`/api/settings/anthropic`, { key: 'sk-ant-FIXTURE-not-a-real-key-0000', model: 'claude-opus-5-5' }, 'PUT');
    assert.equal(keyed.status, 200, JSON.stringify(keyed.json));
    const active = await call<{ provider: string }>('/api/settings/active', { provider: 'anthropic' });
    assert.equal(active.json.provider, 'anthropic', JSON.stringify(active.json));

    // Nine steps, two turns, in the order the method would take them: plan,
    // teach, check on procedure, try to lock, check on intuition, lock.
    model = new MockLanguageModelV4({
      modelId: 'claude-opus-5-5',
      doStream: [
        step([{ type: 'stream-start', warnings: [] }, toolCall('c1', 'set_plan', PLAN), finish('tool-calls', 'tool_use')]),
        step([{ type: 'stream-start', warnings: [] }, toolCall('c2', 'set_phase', '{"phase":"teach"}'), finish('tool-calls', 'tool_use')]),
        step([{ type: 'stream-start', warnings: [] }, ...says('t1', 'The plan is agreed. Say when to begin.'), finish('stop', 'end_turn')]),
        step([{ type: 'stream-start', warnings: [] }, toolCall('c3', 'node_status', '{"id":"step","status":"teaching"}'), finish('tool-calls', 'tool_use')]),
        step([
          { type: 'stream-start', warnings: [] },
          ...says('t2', `Teaching the second node. ${'The gradient points uphill, so moving against it goes down. '.repeat(5)}`),
          toolCall('c4', 'quiz', quiz('procedure')),
          finish('tool-calls', 'tool_use'),
        ]),
        step([{ type: 'stream-start', warnings: [] }, toolCall('c5', 'node_status', '{"id":"step","status":"locked"}'), finish('tool-calls', 'tool_use')]),
        step([{ type: 'stream-start', warnings: [] }, toolCall('c6', 'quiz', quiz('intuition')), finish('tool-calls', 'tool_use')]),
        step([{ type: 'stream-start', warnings: [] }, toolCall('c7', 'node_status', '{"id":"step","status":"locked"}'), finish('tool-calls', 'tool_use')]),
        step([{ type: 'stream-start', warnings: [] }, ...says('t3', 'That one is locked.'), finish('stop', 'end_turn')]),
      ],
    });
    const { setModelOverride } = await import('../src/drivers/api.js');
    setModelOverride(() => model);
    revert = () => setModelOverride(null);
  });

  after(async () => {
    revert();
    await server?.close();
    if (scratch) rmSync(scratch, { recursive: true, force: true });
  });

  it('creates a lesson over HTTP and runs the first turn on the loop, with the plan approved from the browser', async () => {
    const created = await call<{ id: string }>('/api/lessons', { topic: 'why gradient descent works' });
    assert.equal(created.status, 201, JSON.stringify(created.json));
    lesson = created.json.id;

    await settleCard('plan', 0, { approved: true });
    await idle();

    const types = (await events()).map((e) => e.type);
    assert.deepEqual(types, ['turn_start', 'plan', 'plan_result', 'phase', 'assistant', 'turn_end']);
    // Three model calls for three steps: the plan, the phase, the prose. The
    // positive evidence that the loop ran rather than being skipped.
    assert.equal(model.doStreamCalls.length, 3);
    assert.deepEqual(
      model.doStreamCalls[0].prompt.map((m) => m.role),
      ['system', 'system', 'user'],
      'the first request did not carry the method text and the lesson context as the two system messages of the cache split',
    );
  });

  it('grades the check itself and hands the model a result it was never asked to compute', async () => {
    const started = await call(`/api/lessons/${lesson}/message`, { text: 'teach me the second node' });
    assert.equal(started.status, 200, JSON.stringify(started.json));

    // The card the tutor opened on `procedure`, answered in the browser.
    const first = await settleCard('quiz', 0, { selected: [0], sure: true });
    const graded = await poll('the graded result', async () => (await events()).find((e) => e.type === 'quiz_result' && e.seq > first) ?? null);
    assert.equal(graded.payload.result, 'correct');
    assert.equal(graded.payload.tests, 'procedure');
    assert.deepEqual(graded.payload.correct, [0]);

    // The model asked the question; the server decided the answer and said what
    // to do next. Both reach the model as a tool result it did not write.
    const handed = JSON.stringify(model.doStreamCalls[5].prompt);
    assert.match(handed, /"result":"correct"/);
    assert.match(handed, /intuition/, 'the instruction after a procedure pass did not reach the model');

    // The card it opened after the refusal, on `intuition`, so the turn can finish.
    const second = await settleCard('quiz', first, { selected: [0], sure: true });
    const held = await poll('the second graded result', async () => (await events()).find((e) => e.type === 'quiz_result' && e.seq > second) ?? null);
    assert.equal(held.payload.result, 'correct');
    assert.equal(held.payload.tests, 'intuition');
    await idle();
    assert.equal(model.doStreamCalls.length, 9, 'the loop did not take the nine steps the script scheduled');
  });

  it('refuses the lock with no understanding pass, in the method’s own words, and writes nothing', async () => {
    const refusal = JSON.stringify(model.doStreamCalls[6].prompt);
    assert.match(refusal, /"refused":true/, 'the refusal did not reach the model as a refusal');
    assert.match(refusal, /Not locked\./);
    assert.match(refusal, /is a derived claim/);
    assert.match(refusal, /A node locks on understanding/);
    assert.match(refusal, /tests: \\"intuition\\"/);
    assert.match(refusal, /tests: \\"transfer\\"/);
    assert.match(refusal, /This is the method, not an error to investigate\./);

    // A refused lock leaves no record: two node_status events for this node,
    // the `teaching` and the one that was allowed, never the refused one.
    const statuses = (await events()).filter((e) => e.type === 'node_status').map((e) => e.payload.status);
    assert.deepEqual(statuses, ['teaching', 'locked']);
  });

  it('lets the lock through once an intuition question has passed, so the gate is a gate and not a wall', async () => {
    const allowed = JSON.stringify(model.doStreamCalls[8].prompt);
    assert.match(allowed, /next_review_in_days/, 'the successful lock did not answer with a review date');
    assert.doesNotMatch(allowed.slice(allowed.lastIndexOf('next_review_in_days')), /"refused":true/);

    const v = await view();
    assert.equal(v.json.nodes.find((n) => n.node_id === 'step')!.status, 'locked');
  });

  it('filed the turn in the ledger, so the lesson carries a cost the pages can show', async () => {
    const v = await view();
    assert.ok(typeof v.json.cost === 'string' && v.json.cost.length > 0, `the lesson carries no cost string: ${v.json.cost}`);
    assert.notEqual(v.json.cost, 'not reported', 'the stub reported usage, so the lesson must not read as unreported');
  });

  /**
   * `test teaching` (PROV-11), over the same routes with no real model.
   *
   * What these cases prove is Derive's own plumbing and its cleanup: that each
   * failure reaches the learner as its approved sentence, that the probe runs
   * on the row it was aimed at rather than on whichever row is active, and
   * that nothing it creates survives the request. **None of them says anything
   * about any model's competence, and none of them can produce the pass line.**
   * That line is emitted only from a run in which a real model made a real
   * tool call and the server graded a real quiz — which is the whole value of
   * the action, and the reason the pass path is a human check (Task 3) rather
   * than a case here.
   */
  describe('the teaching proof', () => {
    let database: typeof import('../src/db.js');
    let agent: typeof import('../src/agent.js');
    let apiDrivers: typeof import('../src/drivers/api.js');
    let driverSeam: typeof import('../src/driver.js');
    let capability: typeof import('../src/capability.js');
    let fake: Server | undefined;
    let live = 0;
    let closed = 0;
    /** Every path the pressed row's own address was asked for, which is how a case sees where the model request actually went. */
    let asked: string[] = [];

    const NO_TOOLS = 'the model called no tools, so there was no node to grade.';
    const UNGRADABLE = 'the quiz came back but the grade was unreadable.';

    /** A model that answers prose and calls nothing — the pleasant failure a model with no tool calling produces. */
    const proseOnly = (modelId: string) =>
      new MockLanguageModelV4({
        modelId,
        doStream: [step([{ type: 'stream-start', warnings: [] }, ...says('p1', 'What a nice topic. Even numbers are everywhere.'), finish('stop', 'end_turn')])],
      });

    /**
     * Every read a scratch lesson could reach, as it reads right now; the proof
     * must leave all of them exactly as it found them.
     *
     * The lesson list, the ledger and the `scratch` column are not enough on
     * their own: `stats` is the lesson count and the quiz figures on Home,
     * `allNodes` is the Atlas, and `allNodes`, `listMisconceptions` and
     * `listMemory` are the three reads `learnerProfile` concatenates into the
     * system prompt of every turn of every other lesson.
     */
    const counts = () => ({
      lessons: database.listLessons('default').length,
      usage: database.listUsage({ learner: 'default' }).length,
      scratch: (database.db.prepare('SELECT count(*) AS n FROM lessons WHERE scratch = 1').get() as { n: number }).n,
      stats: database.stats('default'),
      nodes: database.allNodes('default').length,
      memory: database.listMemory('default').length,
      misconceptions: database.listMisconceptions('default').length,
    });

    before(async () => {
      database = await import('../src/db.js');
      agent = await import('../src/agent.js');
      apiDrivers = await import('../src/drivers/api.js');
      driverSeam = await import('../src/driver.js');
      capability = await import('../src/capability.js');
      // Ollama's model list, so the row's own address answers something: the
      // proof asks it before spending a model request, the same cheap read
      // `test connection` makes. The fake stands in for a metadata endpoint and
      // never for a model.
      const tags = await fakeServer((url) => {
        asked.push(url);
        return url === '/api/tags'
          ? { status: 200, type: 'application/json', body: JSON.stringify({ models: [{ name: 'a-local-model' }] }) }
          : { status: 404, type: 'application/json', body: '{"error":"not found"}' };
      });
      fake = tags.server;
      live = tags.port;
      closed = await freePort();
      const pointed = await call('/api/settings/ollama', { base_url: `http://127.0.0.1:${live}`, model: 'a-local-model' }, 'PUT');
      assert.equal(pointed.status, 200, JSON.stringify(pointed.json));
    });

    after(() => {
      fake?.close();
      apiDrivers.setModelOverride(null);
      driverSeam.setDriverOverride(null);
      capability.setProofDeadlineOverride(null);
    });

    it('answers the no-tools sentence for a model that calls nothing, and leaves the database exactly as it found it', async () => {
      const was = counts();
      driverSeam.setDriverOverride(apiDrivers.apiDriverFor('ollama'));
      apiDrivers.setModelOverride(() => proseOnly('a-local-model'));
      const r = await call<{ ok: boolean; reason: string; ms: number }>('/api/settings/ollama/test-teaching', {});

      assert.equal(r.status, 200, JSON.stringify(r.json));
      assert.equal(r.json.ok, false, 'a model that called no tool cannot teach');
      assert.equal(r.json.reason, NO_TOOLS, 'the fail reason must be the approved sentence, not a paraphrase');
      assert.equal(typeof r.json.ms, 'number');
      // D-11 and D-14 together: no lesson in Home, no row in the ledger, and
      // no scratch lesson left in the file.
      assert.deepEqual(counts(), was, 'the proof left something behind');
    });

    it('answers the ungradable sentence when the quiz call does not satisfy the tool’s own schema', async () => {
      const was = counts();
      driverSeam.setDriverOverride(apiDrivers.apiDriverFor('ollama'));
      apiDrivers.setModelOverride(
        () =>
          new MockLanguageModelV4({
            modelId: 'a-local-model',
            doStream: [
              step([{ type: 'stream-start', warnings: [] }, toolCall('q1', 'set_plan', PLAN), finish('tool-calls', 'tool_use')]),
              // One option, no correct indices, no explanation: validateToolInput
              // throws, so no quiz is ever opened and nothing can be graded.
              step([{ type: 'stream-start', warnings: [] }, toolCall('q2', 'quiz', JSON.stringify({ question: 'Is the sum even?', options: ['It is even'] })), finish('tool-calls', 'tool_use')]),
              step([{ type: 'stream-start', warnings: [] }, ...says('q3', 'That is all of it.'), finish('stop', 'end_turn')]),
            ],
          }),
      );
      const r = await call<{ ok: boolean; reason: string }>('/api/settings/ollama/test-teaching', {});

      assert.equal(r.status, 200, JSON.stringify(r.json));
      assert.equal(r.json.ok, false);
      assert.equal(r.json.reason, UNGRADABLE, 'a quiz the server could not grade must not read as "called no tools": the model did call one');
      assert.deepEqual(counts(), was, 'the proof left something behind');
    });

    it('stops a proof that does not finish in its deadline, and says that rather than blaming the model', async () => {
      // Without a deadline the request, the scratch lesson and the `testing…`
      // button stay open for as long as the driver's own runaway guards allow,
      // which on a small model on a CPU is tens of minutes. The deadline is
      // five minutes in production; the override moves when the stop fires and
      // not what the learner is told, which is why the sentence below still
      // names five.
      const pointed = await call('/api/settings/ollama', { base_url: `http://127.0.0.1:${live}` }, 'PUT');
      assert.equal(pointed.status, 200, JSON.stringify(pointed.json));
      const was = counts();
      driverSeam.setDriverOverride(apiDrivers.apiDriverFor('ollama'));
      apiDrivers.setModelOverride(
        () =>
          new MockLanguageModelV4({
            modelId: 'a-local-model',
            doStream: [
              {
                stream: simulateReadableStream({
                  chunks: [{ type: 'stream-start', warnings: [] }, ...says('s1', 'Thinking'), ...says('s2', ' about it'), finish('stop', 'end_turn')] as never[],
                  initialDelayInMs: 10,
                  chunkDelayInMs: 120,
                }),
              },
            ],
          }),
      );
      capability.setProofDeadlineOverride(40);
      try {
        const r = await call<{ ok: boolean; reason: string }>('/api/settings/ollama/test-teaching', {});
        assert.equal(r.status, 200, JSON.stringify(r.json));
        assert.equal(r.json.ok, false, 'a proof that was stopped cannot be a pass');
        // Not the no-tools sentence: the run was cut short, so "the model
        // called no tools" would be true of the log and false about the model.
        assert.match(
          r.json.reason,
          /^the proof did not finish in 5 minutes and was stopped; a model this slow will make a lesson slower still/,
          'a stopped proof must say it was stopped, and name the bound it was given',
        );
      } finally {
        capability.setProofDeadlineOverride(null);
      }
      assert.deepEqual(counts(), was, 'the proof left something behind');
    });

    it('sweeps a scratch lesson a crash left behind, and its usage rows with it, and leaks none of it into the record while it is alive', () => {
      // The one case the delete inside the request cannot cover (T-04-05): a
      // crash between the turn and the delete. Left behind deliberately, with a
      // turn and a usage row, because the row is what would inflate the Usage
      // total if the sweep were not there.
      //
      // And `sweepScratchLessons` runs on the boot pass alone, so between the
      // crash and the next restart this lesson is a live row in the learner's
      // file. Everything the probe itself writes is therefore built here too —
      // a locked node with a review date, a graded quiz, a remembered fact and
      // a misconception — because the assertion that matters is not only that
      // the sweep cleans up but that nothing reads any of it in the meantime.
      const was = counts();
      const everAfter = Date.now() + 365 * 86_400_000;
      const dueBefore = database.dueNodes('default', everAfter).length;

      const id = 'a-proof-that-crashed';
      database.createLesson(id, 'a proof that crashed', { scratch: true });
      const turn = database.startTurn(id, 'ollama', 'a-local-model');
      database.recordUsage(turn, { model: 'a-local-model', input_tokens: 900, output_tokens: 40, cost_source: 'unknown' });
      database.replaceGraph(id, [{ id: 'even', label: 'An even number is twice a whole number', kind: 'truth' }]);
      database.setNodeStatus(id, 'even', 'locked');
      database.recordQuiz(id, 'even', true, { confidence: 'sure', purpose: 'check', tests: 'intuition' });
      database.addMemory('the learner likes worked examples', 'preference', id);
      database.addMisconception({ lessonId: id, nodeId: 'even', question: 'Is 7 even?', picked: 'yes', correct: 'no', explanation: '7 is not twice a whole number.' });

      assert.equal(database.listLessons('default').some((l) => l.id === id), false, 'a scratch lesson must never be listed, not even while it exists');
      assert.equal(database.listUsage({ lesson: id }).length, 1, 'the case has to start from a ledger row, or the sweep proves nothing');
      // The consequential one: `allNodes`, `listMisconceptions` and
      // `listMemory` are what `learnerProfile` concatenates into every other
      // lesson's system prompt, so a leak here tells a real lesson the learner
      // is working on the probe's throwaway node.
      //
      // The two figures that do move are the `scratch` column, which is the
      // marker itself, and the ledger row: `usage` is keyed on the learner
      // directly with no lessons join, so a crashed proof's row is removed by
      // the sweep rather than filtered out of the read — which is the remedy
      // migration 8's own comment names.
      assert.deepEqual(counts(), { ...was, scratch: was.scratch + 1, usage: was.usage + 1 }, 'a live scratch lesson reached the learner’s record');
      assert.equal(database.dueNodes('default', everAfter).length, dueBefore, 'the probe’s node joined the review queue');

      assert.deepEqual(database.sweepScratchLessons(), [id]);
      assert.equal(database.getLesson(id), undefined);
      assert.equal(database.listUsage({ lesson: id }).length, 0, 'the lesson went and its usage rows stayed, so the Usage total would still count the proof');
      assert.equal((database.db.prepare('SELECT count(*) AS n FROM lessons WHERE scratch = 1').get() as { n: number }).n, 0);
      assert.deepEqual(counts(), was, 'the sweep left part of the proof behind');
    });

    it('resolves a driver from the row it was handed and from nothing else', async () => {
      // The pure half of the property the probe rests on. Three rows, three
      // drivers, and the answer for a row does not move when a different row is
      // made active — a probe that read the active provider instead would run
      // the wrong model and report the result as that row's.
      const { driverFor } = agent;
      assert.deepEqual([driverFor('claude-code').name, driverFor('codex').name, driverFor('ollama').name], ['claude', 'codex', 'ollama']);

      const before = [driverFor('anthropic').name, driverFor('ollama').name];
      const switched = await call<{ provider: string }>('/api/settings/active', { provider: 'ollama' });
      assert.equal(switched.json.provider, 'ollama', JSON.stringify(switched.json));
      assert.deepEqual([driverFor('anthropic').name, driverFor('ollama').name], before, 'the resolution moved when the active row did');

      const back = await call<{ provider: string }>('/api/settings/active', { provider: 'anthropic' });
      assert.equal(back.json.provider, 'anthropic', JSON.stringify(back.json));
      assert.deepEqual([driverFor('anthropic').name, driverFor('ollama').name], before);
    });

    it('runs on a key row through its own driver, so the action is not a local-row feature', async () => {
      // Amendment A-03 in the direction the structural tests can reach: the row
      // the learner pressed is the active one here, and it is a key row rather
      // than a local one, so the probe went through `apiDriverFor('anthropic')`
      // with no per-row branch anywhere in the proof.
      driverSeam.setDriverOverride(null);
      apiDrivers.setModelOverride(() => proseOnly('claude-opus-5-5'));
      const r = await call<{ ok: boolean; reason: string }>('/api/settings/anthropic/test-teaching', {});
      assert.equal(r.status, 200, JSON.stringify(r.json));
      assert.equal(r.json.ok, false);
      assert.equal(r.json.reason, NO_TOOLS);
    });

    it('sends the model request to the pressed row’s own address while another row is active', async () => {
      // The seam itself, observed positively: no override of any kind, the
      // active row is Anthropic, and the pressed row is Ollama pointed at a
      // fake that records what it is asked for. A probe that resolved the
      // active provider instead — which is all `runTurn` could do before this
      // plan — would send its request to api.anthropic.com and this fake would
      // never see a completion path at all.
      driverSeam.setDriverOverride(null);
      apiDrivers.setModelOverride(null);
      const pointed = await call('/api/settings/ollama', { base_url: `http://127.0.0.1:${live}` }, 'PUT');
      assert.equal(pointed.status, 200, JSON.stringify(pointed.json));
      const was = counts();
      asked = [];

      const r = await call<{ ok: boolean; reason: string }>('/api/settings/ollama/test-teaching', {});
      assert.equal(r.status, 200, JSON.stringify(r.json));
      assert.equal(r.json.ok, false, 'the fake answers no model, so this cannot be a pass');
      assert.ok(asked.includes('/api/tags'), 'the row was never asked whether anything is there');
      assert.ok(
        asked.some((path) => path !== '/api/tags'),
        `the model request never reached the pressed row's address; it was only asked for ${JSON.stringify(asked)}`,
      );
      assert.equal((await call<{ provider: string }>('/api/settings/active')).json.provider, 'anthropic', 'pressing the action on a row is not choosing that row');
      assert.deepEqual(counts(), was);
    });

    it('runs on the row it was aimed at rather than on the active one, and choosing nothing', async () => {
      // No override of any kind: what answers here is the real resolution. The
      // active row is Anthropic; the pressed row is Ollama, pointed at a port
      // nothing is listening on. The reason must name *that* address.
      driverSeam.setDriverOverride(null);
      apiDrivers.setModelOverride(null);
      const pointed = await call('/api/settings/ollama', { base_url: `http://127.0.0.1:${closed}` }, 'PUT');
      assert.equal(pointed.status, 200, JSON.stringify(pointed.json));
      const activeBefore = await call<{ provider: string }>('/api/settings/active');
      assert.equal(activeBefore.json.provider, 'anthropic');

      const was = counts();
      const r = await call<{ ok: boolean; reason: string }>('/api/settings/ollama/test-teaching', {});
      assert.equal(r.status, 200, JSON.stringify(r.json));
      assert.equal(r.json.ok, false, 'nothing answered, so this cannot be a pass');
      assert.match(r.json.reason, new RegExp(`nothing answered at 127\\.0\\.0\\.1:${closed}`), 'the reason names some other address than the row the learner pressed');
      assert.doesNotMatch(r.json.reason, /anthropic/i, 'the proof ran on the active row instead of the pressed one');

      const activeAfter = await call<{ provider: string }>('/api/settings/active');
      assert.equal(activeAfter.json.provider, 'anthropic', 'pressing the action on a row is not choosing that row');
      assert.deepEqual(counts(), was);
    });

    it('is a 404 for an id the catalogue does not carry', async () => {
      assert.equal((await call('/api/settings/not-a-provider/test-teaching', {})).status, 404);
      // The route's `teaches` guard cannot be driven from the catalogue: every
      // row teaches from plan 04-01 on, so there is no row to point it at. It
      // stays as the defence for a future row that arrives before its driver,
      // which is what the activation route keeps its own guard for. This
      // assertion is what will fail if such a row is ever added without a case.
      const rows = await call<{ rows: { id: string; teaches: boolean }[] }>('/api/settings');
      assert.deepEqual(rows.json.rows.filter((row) => !row.teaches).map((row) => row.id), []);
    });
  });

  /**
   * Which learner the activation's capability refusal speaks for.
   *
   * `ACTIVE_PROVIDER` is per install while the model is per learner, so one
   * activation check cannot speak for everyone — it speaks for the learner
   * making it. Here rather than in the spawned-server suites because those run
   * with `DERIVE_BACKEND` set, which locks the provider with a 409 before the
   * refusal is ever reached.
   */
  describe('the activation refusal', () => {
    it('resolves the model the asking learner would be taught on, not the install-wide one', async () => {
      // The install-wide id is stored while nothing is found on the row, so no
      // metadata is read for it and it keeps no verdict. The learner's own id
      // is the one in the quiet server's model list, so the pass refuses that
      // one and only that one — which is what makes the two answers below
      // distinguishable at all.
      const away = await call('/api/settings/ollama', { base_url: 'http://127.0.0.1:1' }, 'PUT');
      assert.equal(away.status, 200, JSON.stringify(away.json));
      assert.equal((await call('/api/settings/detect', {})).status, 200);
      const stored = await call('/api/settings/ollama', { model: 'an-unread-model' }, 'PUT');
      assert.equal(stored.status, 200, JSON.stringify(stored.json));

      const made = await call<{ id: string }>('/api/learners', { name: 'Quiet' });
      assert.equal(made.status, 201, JSON.stringify(made.json));
      const own = await call(`/api/learners/${made.json.id}`, { prefs: { model: { ollama: 'a-quiet-model' } } }, 'PATCH');
      assert.equal(own.status, 200, JSON.stringify(own.json));

      const quiet = await fakeServer((url) =>
        url === '/api/tags'
          ? { status: 200, type: 'application/json', body: JSON.stringify({ models: [{ name: 'a-quiet-model' }] }) }
          : url === '/api/show'
            ? {
                status: 200,
                type: 'application/json',
                body: JSON.stringify({ model_info: { 'general.architecture': 'qwen3moe', 'qwen3moe.context_length': 262_144 }, capabilities: ['completion', 'vision'] }),
              }
            : { status: 404, type: 'application/json', body: '{"error":"not found"}' },
      );
      try {
        const pointed = await call('/api/settings/ollama', { base_url: `http://127.0.0.1:${quiet.port}` }, 'PUT');
        assert.equal(pointed.status, 200, JSON.stringify(pointed.json));
        assert.equal((await call('/api/settings/detect', {})).status, 200);

        // The learner with no model of their own runs the install-wide id,
        // which nothing was read about, so nothing refuses them.
        const other = await call<{ provider: string }>('/api/settings/active', { provider: 'ollama' });
        assert.equal(other.status, 200, JSON.stringify(other.json));
        assert.equal(other.json.provider, 'ollama');

        const asking = await call<{ error: string }>(`/api/settings/active?learner=${made.json.id}`, { provider: 'ollama' });
        assert.equal(asking.status, 400, JSON.stringify(asking.json));
        assert.match(asking.json.error, /^a-quiet-model does not support tool calling/, 'the refusal named a model this learner never runs');
      } finally {
        quiet.server.close();
        await call('/api/settings/active', { provider: 'anthropic' });
      }
    });
  });
});

describe('a repo import', () => {
  it('returns no byte from outside the folder it was given', async () => {
    // The regression test for the chain the verification report reproduced by hand: import a folder holding notes.md -> DATA_DIR/token, then read the install token back out of GET /api/materials/:id?text=1.
    const dir = mkdtempSync(join(tmpdir(), 'derive-repo-'));
    try {
      writeFileSync(join(dir, 'README.md'), '# a project\n\nwith some words in it.');
      symlinkSync(join(dataDir, 'token'), join(dir, 'notes.md'));
      const created = await api<{ materials: { id: string }[] }>('/api/materials/repo', { source: dir });
      assert.equal(created.status, 201, JSON.stringify(created.json));
      const read = await api<{ text: string }>(`/api/materials/${created.json.materials[0].id}?text=1`);
      assert.equal(read.status, 200, JSON.stringify(read.json));
      // The positive half: a zero below is a real import that skipped the link, not an empty or failed response.
      assert.ok(read.json.text.includes('README.md'));
      assert.equal(read.json.text.split(token).length - 1, 0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('the num_ctx field on a local row, over HTTP with no model', () => {
  /** One row as GET /api/settings paints it. */
  const rowOf = async (id: string) => {
    const r = await api<{ rows: { id: string; teaches: boolean; num_ctx: number | null; num_ctx_default: number | null }[] }>('/api/settings');
    assert.equal(r.status, 200, JSON.stringify(r.json));
    return r.json.rows.find((row) => row.id === id)!;
  };

  it('answers a fraction and a string in the learner’s own words, not zod’s', async () => {
    // These two sentences go straight onto the row's error line, so a zod
    // default ("Invalid input: expected int, received number") would be shown
    // to a learner verbatim. The fraction is reachable: `type="number"` takes
    // one, so typing 20000.5 and blurring is enough.
    const fraction = await api<{ error: string }>('/api/settings/ollama', { num_ctx: 20_000.5 }, 'PUT');
    assert.equal(fraction.status, 400, JSON.stringify(fraction.json));
    assert.equal(fraction.json.error, 'the context window is a whole number of tokens');

    const text = await api<{ error: string }>('/api/settings/ollama', { num_ctx: '32768' }, 'PUT');
    assert.equal(text.status, 400, JSON.stringify(text.json));
    assert.equal(text.json.error, 'the context window is a whole number of tokens');
  });

  it('refuses a window below the floor, and writes nothing', async () => {
    const before = await rowOf('ollama');
    const r = await api<{ error: string }>('/api/settings/ollama', { num_ctx: 8192 }, 'PUT');
    assert.equal(r.status, 400);
    // The zod message, which names the one constant rather than repeating it:
    // below the floor the method does not fit at all, so the field refuses
    // rather than letting the next lesson refuse instead.
    assert.equal(r.json.error, 'the method needs at least 16384 tokens of context');
    assert.deepEqual((await rowOf('ollama')).num_ctx, before.num_ctx, 'a refused write must not land');
  });

  it('round-trips a valid window into the row the page paints', async () => {
    const r = await api<{ num_ctx: number | null }>('/api/settings/ollama', { num_ctx: 32768 }, 'PUT');
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.json.num_ctx, 32768);
    assert.equal((await rowOf('ollama')).num_ctx, 32768, 'the write is not visible to the page that has to render it');
  });

  it('returns a cleared window to the default', async () => {
    assert.equal((await api<{ num_ctx: number | null }>('/api/settings/ollama', { num_ctx: 65536 }, 'PUT')).json.num_ctx, 65536);
    const cleared = await api<{ num_ctx: number | null; num_ctx_default: number | null }>('/api/settings/ollama', { num_ctx: null }, 'PUT');
    assert.equal(cleared.status, 200, JSON.stringify(cleared.json));
    assert.equal(cleared.json.num_ctx, null, 'an emptied field stores nothing rather than storing the default as a value');
    assert.equal(cleared.json.num_ctx_default, 32768, 'the default is what the field then shows as its placeholder');
  });

  it('refuses a window on every row but Ollama, naming the row', async () => {
    const remote = await api<{ error: string }>('/api/settings/anthropic', { num_ctx: 32768 }, 'PUT');
    assert.equal(remote.status, 400);
    assert.match(remote.json.error, /^Anthropic does not take a context window/);

    // D-01 keeps the generic OpenAI-compatible row remote-and-proxied-only: the
    // three dedicated local rows are the canonical way to teach on a local
    // server, so a learner who types a localhost address into this row gets no
    // local treatment at all.
    const generic = await api<{ error: string }>('/api/settings/openai-compatible', { num_ctx: 32768 }, 'PUT');
    assert.equal(generic.status, 400);
    assert.match(generic.json.error, /^OpenAI-compatible endpoint does not take a context window/);

    // D-05: LM Studio and llama.cpp serve the window they were started with and
    // `numCtxFor` is read for `ollama` and nowhere else, so a write here is
    // refused rather than stored — the row must not persist a number no request
    // carries and then answer that it applies from the next turn.
    for (const [id, label] of [
      ['lmstudio', 'LM Studio'],
      ['llamacpp', 'llama.cpp'],
    ]) {
      const readOnly = await api<{ error: string }>(`/api/settings/${id}`, { num_ctx: 32768 }, 'PUT');
      assert.equal(readOnly.status, 400, JSON.stringify(readOnly.json));
      assert.match(readOnly.json.error, new RegExp(`^${label.replace('.', '\\.')} does not take a context window`));
      assert.equal((await rowOf(id)).num_ctx, null, `${id} stored a window Derive never sends`);
    }
  });

  it('shows the default on the Ollama row and nothing on any other, and all three local rows teach', async () => {
    const r = await api<{ rows: { id: string; group: string; teaches: boolean; num_ctx_default: number | null }[] }>('/api/settings');
    for (const row of r.json.rows) {
      // The field exists exactly where Derive sends a window, which is the
      // Ollama row and nothing else (D-05).
      assert.equal(row.num_ctx_default, row.id === 'ollama' ? 32768 : null, `${row.id} offers the wrong window field`);
      if (row.group === 'local') assert.equal(row.teaches, true, `${row.id} does not teach, so it cannot be made active`);
    }
    assert.deepEqual(r.json.rows.filter((row) => row.group === 'local').map((row) => row.id), ['ollama', 'lmstudio', 'llamacpp']);
  });
});

/**
 * The capability route, over HTTP. The fake answers Ollama's `/api/show` and
 * nothing else: it stands in for a metadata endpoint, never for a model, and
 * no case here claims a model can teach. What is asserted is Derive's own
 * behaviour on a server's answer — that it always answers, that the verdict is
 * the ladder's, and that D-01's two excluded rows are refused by name.
 */
describe('the capability route, over HTTP', () => {
  const fakes: Server[] = [];
  const at = { show: 0, closed: 0 };
  /** Ollama's /api/show for whatever model is asked for, tool-capable with a large window. */
  const showBody = { model_info: { 'general.architecture': 'qwen3moe', 'qwen3moe.context_length': 262_144 }, capabilities: ['completion', 'tools'] };

  before(async () => {
    const show = await fakeServer((url) =>
      url === '/api/show' ? { status: 200, type: 'application/json', body: JSON.stringify(showBody) } : { status: 404, type: 'application/json', body: '{"error":"not found"}' },
    );
    fakes.push(show.server);
    at.show = show.port;
    at.closed = await freePort();
  });

  after(() => {
    for (const f of fakes) f.close();
  });

  const point = async (port: number) => {
    const r = await api<{ base_url: string | null }>('/api/settings/ollama', { base_url: `http://127.0.0.1:${port}` }, 'PUT');
    assert.equal(r.status, 200, JSON.stringify(r.json));
  };

  it('answers 200 with the verdict when the server has metadata', async () => {
    await point(at.show);
    const r = await api<{ ok: boolean; tools: string; max_window: number | null; selectable: boolean; definitive: boolean; refusal: string | null }>(
      '/api/settings/ollama/capability',
      { model: 'some-model' },
    );
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.json.ok, true);
    assert.equal(r.json.tools, 'yes');
    assert.equal(r.json.max_window, 262_144);
    assert.equal(r.json.selectable, true);
    assert.equal(r.json.definitive, true);
    assert.equal(r.json.refusal, null);
  });

  it('refuses a model the server says cannot call tools, in the approved words', async () => {
    const quiet = await fakeServer((url) =>
      url === '/api/show'
        ? { status: 200, type: 'application/json', body: JSON.stringify({ ...showBody, capabilities: ['completion', 'vision'] }) }
        : { status: 404, type: 'application/json', body: '{"error":"not found"}' },
    );
    fakes.push(quiet.server);
    await point(quiet.port);
    const r = await api<{ ok: boolean; selectable: boolean; refusal: string | null }>('/api/settings/ollama/capability', { model: 'a-model' });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.json.selectable, false);
    assert.equal(
      r.json.refusal,
      'a-model does not support tool calling, and the understanding gate, the graph and the quiz all run as tools. Pick a model that supports tool calling, or choose another provider in Settings.',
    );
  });

  it('answers 200 with ok false when nothing answers at all', async () => {
    // Never a 5xx: "can this model teach" has an answer even when the answer
    // is that the server could not be reached, and the row shows the sentence.
    await point(at.closed);
    const r = await api<{ ok: boolean; error: string }>('/api/settings/ollama/capability', { model: 'some-model' });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.json.ok, false);
    assert.match(r.json.error, new RegExp(`nothing answered at 127\\.0\\.0\\.1:${at.closed}`));
  });

  it('keeps the two excluded rows off the local path, naming each', async () => {
    // D-01: the three dedicated local rows are the canonical local path, so
    // the generic OpenAI-compatible row gets no capability probe either — it
    // is for endpoints somebody else runs.
    for (const [id, name] of [
      ['anthropic', 'Anthropic'],
      ['openai-compatible', 'OpenAI-compatible endpoint'],
    ]) {
      const r = await api<{ error: string }>(`/api/settings/${id}/capability`, { model: 'a-model' });
      assert.equal(r.status, 400, JSON.stringify(r.json));
      assert.match(r.json.error, new RegExp(`^${name} is reached as a remote endpoint`));
    }
  });

  it('is a 404 for an id the catalogue does not carry, and a 400 with no model', async () => {
    assert.equal((await api<{ error: string }>('/api/settings/not-a-provider/capability', { model: 'a-model' })).status, 404);
    // No model in the body and none stored on the row: there is nothing to ask about.
    const cleared = await api('/api/settings/llamacpp', { model: '' }, 'PUT');
    assert.equal(cleared.status, 200, JSON.stringify(cleared.json));
    const r = await api<{ error: string }>('/api/settings/llamacpp/capability', {});
    assert.equal(r.status, 400, JSON.stringify(r.json));
    assert.match(r.json.error, /^Choose a model on the llama\.cpp row first/);
  });

  it('bounds the model id it is asked about by the same schema the settings write uses', async () => {
    // The id becomes a key in capability.ts's `observed` map and is
    // interpolated into every refusal sentence built from it, so an unbounded
    // one would grow that map without limit and echo arbitrary text back. The
    // sentences are the settings write's own, because there is one schema.
    const charset = await api<{ error: string }>('/api/settings/ollama/capability', { model: 'a model; rm -rf' });
    assert.equal(charset.status, 400, JSON.stringify(charset.json));
    assert.equal(charset.json.error, 'the model id may only contain letters, digits, . _ : / and -');

    const long = await api<{ error: string }>('/api/settings/ollama/capability', { model: 'm'.repeat(201) });
    assert.equal(long.status, 400, JSON.stringify(long.json));
    assert.equal(long.json.error, 'the model id is longer than any provider issues');

    // `.strict()`, like SettingsWrite: a field this route does not have is a
    // caller asking for something it will not get, not something to ignore.
    const extra = await api<{ error: string }>('/api/settings/ollama/capability', { model: 'a-model', learner: 'someone-else' });
    assert.equal(extra.status, 400, JSON.stringify(extra.json));
  });

  it('falls back to the model stored on the row when the body names none', async () => {
    await point(at.show);
    const stored = await api('/api/settings/ollama', { model: 'stored-model' }, 'PUT');
    assert.equal(stored.status, 200, JSON.stringify(stored.json));
    const r = await api<{ ok: boolean; model: string }>('/api/settings/ollama/capability', {});
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.json.model, 'stored-model');
  });

  it('forgets a refusal on a rescan that no longer finds the row', async () => {
    // A refusal must not outlive the server it was read from. The learner who
    // stops their server, swaps the model file behind the same name and
    // rescans while it is still starting up would otherwise keep the old `no`
    // — and both the settings write and the activation read the remembered
    // verdict, so the new model would be refused on a fact about a server that
    // is not running.
    //
    // The address does not change anywhere in this case, on purpose: a base
    // URL write forgets the row's verdicts by itself, so moving the row would
    // hide whether the rescan forgets anything. The server stops answering at
    // the address it was found on, which is the real case.
    const quiet = await fakeServer((url) =>
      url === '/api/tags'
        ? { status: 200, type: 'application/json', body: JSON.stringify({ models: [{ name: 'a-quiet-model' }] }) }
        : url === '/api/show'
          ? { status: 200, type: 'application/json', body: JSON.stringify({ ...showBody, capabilities: ['completion', 'vision'] }) }
          : { status: 404, type: 'application/json', body: '{"error":"not found"}' },
    );
    let open = true;
    try {
      await point(quiet.port);
      assert.equal((await api('/api/settings/detect', {})).status, 200);
      // The positive half: the pass really did remember a refusal, or the
      // forgetting below would prove nothing.
      const refused = await api<{ error: string }>('/api/settings/ollama', { model: 'a-quiet-model' }, 'PUT');
      assert.equal(refused.status, 400, JSON.stringify(refused.json));
      assert.match(refused.json.error, /^a-quiet-model does not support tool calling/);

      quiet.server.close();
      open = false;
      assert.equal((await api('/api/settings/detect', {})).status, 200);
      const allowed = await api<{ model: string | null }>('/api/settings/ollama', { model: 'a-quiet-model' }, 'PUT');
      assert.equal(allowed.status, 200, JSON.stringify(allowed.json));
      assert.equal(allowed.json.model, 'a-quiet-model', 'a row the pass no longer finds must be back at silence, and silence never refuses');
    } finally {
      if (open) quiet.server.close();
    }
  });

});

describe('grading, now that it lives outside the promise that used to hold it', () => {
  /**
   * `gradeQuiz` was lifted out of `openQuiz`'s `wait.then(...)` so a card
   * restored from the prompts table can be graded by the same code as a live
   * one. That is a refactor, so the job of these cases is to pin the
   * behaviour that must not move: the four verdicts `afterQuiz` can reach and
   * the exact sentence each one hands the tutor. No node_id, so the
   * understanding gate is out of the picture and each sentence is the plain
   * one for its verdict.
   */
  let lesson = '';
  const CHECK = {
    question: 'Which of these follows from the claim below it?',
    options: ['the one that follows', 'the tempting one that does not'],
    correct: [0],
    explanation: 'because the step is bounded',
    purpose: 'check',
  };

  before(async () => {
    const r = await api<{ id: string }>('/api/external/lessons', { topic: 'how a check is graded', answer_in: 'terminal' });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    lesson = r.json.id;
  });

  it('hands back the shipped sentence for a correct and confident answer', async () => {
    const r = await askAndAnswer(lesson, CHECK, 'A');
    assert.equal(r.result, 'correct');
    assert.equal(r.instruction, 'Correct and confident. Lock the node if this was its check, then move on.');
  });

  it('hands back the shipped sentence for a correct but unsure answer', async () => {
    const r = await askAndAnswer(lesson, CHECK, 'I think A');
    assert.equal(r.result, 'correct');
    assert.equal(
      r.instruction,
      'Correct, but they said they were unsure, so this is not yet knowledge. Do not lock the node on this alone: have them say why the answer must be so (explain_back with a two-line rubric) or ask one more fresh quiz on the same claim, and lock only after that.',
    );
  });

  it('hands back the shipped sentence for a confident miss', async () => {
    const r = await askAndAnswer(lesson, CHECK, 'B');
    assert.equal(r.result, 'incorrect');
    assert.equal(
      r.instruction,
      'A confident error: they committed to the wrong claim and were sure of it. This is the moment a belief can actually be replaced, so do not just restate the right answer. Name the exact claim they held and why it was tempting, then show what breaks it, from the nodes below. Re-check with a fresh quiz before locking; if that misses too, mark the node shaky and re-derive from its dependencies.',
    );
  });

  it('hands back the shipped sentence for an "I don\'t know"', async () => {
    const r = await askAndAnswer(lesson, CHECK, "I don't know");
    assert.equal(r.result, 'dont_know');
    assert.equal(
      r.instruction,
      'They did not know. Do not reveal the derivation yet: give one hint that points at the node this rests on, then a fresh quiz on the same claim. If that misses too, re-derive it from its dependencies step by step and mark the node shaky.',
    );
  });

  it('emits the grading status line from the grading path, and never as a tool label', () => {
    // `TOOL_LABELS` is `TOOL_REGISTRY.filter(s => s.label)` — a per-tool
    // vocabulary — and the wire-surface snapshot fixes the added label set at
    // the owned loop's two web tools. Grading is not a tool, so the string is
    // emitted directly, as 'Thinking' already is.
    const src = readFileSync(resolve(here, '../src/actions.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    const occurrences = src.split('Grading your answer').length - 1;
    assert.equal(occurrences, 1, 'the grading status string has more than one home in actions.ts');
    assert.match(src, /export function gradeQuiz\(/, 'the settle logic is still trapped inside the promise closure');
    const grading = src.slice(src.indexOf('export function gradeQuiz('));
    assert.match(grading.slice(0, grading.indexOf('\n}\n')), /emitEphemeral\(lessonId, 'status', \{ text: 'Grading your answer' \}\)/);
    assert.doesNotMatch(src, /TOOL_LABELS/, 'grading reached for a tool label, which the registry snapshot forbids');
  });

  it('still hides the status line while a card is open and unanswered', () => {
    // UI-SPEC marks this a contract and the shipped page already satisfies it,
    // so this asserts it rather than rebuilding it: the status is suppressed on
    // "a card is open and unanswered", not on "a card exists", which is what
    // makes emitting the grading line after the verdict enough. There is no web
    // test runner in this repo, so the page is read as source here.
    const page = readFileSync(resolve(here, '../../web/src/pages/Lesson.tsx'), 'utf8');
    assert.match(page, /\{state\.busy && state\.status && !waiting && \(/, 'the status-line gate changed shape');
    assert.match(page, /const waiting = activePromptId !== null;/);
    assert.match(page, /if \(state\.pending && unanswered\(state\.pending\.id\)\) return state\.pending\.id;/, 'the open card no longer has to be unanswered to be active');
  });
});

describe('a card that was open when the server stopped', () => {
  /**
   * The restart gate for LEARN-12. Two boots of the real built server over one
   * data directory, because that is the only place the question lives: a card
   * is open in a *file*, or it is open in a process that has just died. The
   * install token survives with the directory, so the second boot authenticates
   * with the same header the first one wrote.
   */
  const restartDir = mkdtempSync(join(tmpdir(), 'derive-restart-'));
  const boots: ChildProcess[] = [];

  after(() => {
    for (const b of boots) b.kill();
    rmSync(restartDir, { recursive: true, force: true });
  });

  /** One request against a named base, carrying the token the scratch dir holds. */
  const at = async <T = Record<string, unknown>>(host: string, path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<{ status: number; json: T }> => {
    const tok = readFileSync(join(restartDir, 'token'), 'utf8').trim();
    const res = await fetch(`${host}${path}`, { method, headers: { 'content-type': 'application/json', 'x-derive-token': tok }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: res.status, json: (await res.json()) as T };
  };

  const stop = (child: ChildProcess) =>
    new Promise<void>((res) => {
      child.once('exit', () => res());
      child.kill();
    });

  const CARD = {
    question: 'Which claim follows from the one below it?',
    options: ['the one that follows', 'the tempting one that does not'],
    correct: [0],
    explanation: 'because the step is bounded',
    purpose: 'probe',
  };

  let lesson = '';
  let promptId = '';
  let second = '';

  it('is still open, with its id and its kind, after a respawn on the same data dir', async () => {
    const one = await startDeriveServer(entry, {}, { dataDir: restartDir });
    boots.push(one.child);
    const made = await at<{ id: string }>(one.base, '/api/external/lessons', { topic: 'why the step size is bounded', answer_in: 'terminal' });
    assert.equal(made.status, 201, JSON.stringify(made.json));
    lesson = made.json.id;
    const opened = await at<{ status: string; prompt_id: string }>(one.base, `/api/external/lessons/${lesson}/quiz`, CARD);
    assert.equal(opened.status, 200, JSON.stringify(opened.json));
    assert.equal(opened.json.status, 'pending');
    promptId = opened.json.prompt_id;
    assert.ok(promptId, 'the card must have an id to be found again');

    // The refusal while the first card is open, so the half of it that the
    // restart below re-asserts is known to work before the restart.
    const second1 = await at<{ error: string }>(one.base, `/api/external/lessons/${lesson}/quiz`, CARD);
    assert.equal(second1.status, 409, JSON.stringify(second1.json));
    assert.equal(
      second1.json.error,
      "A card is already open (quiz). Wait for the learner's reply and pass it to `answer` before asking anything else.",
    );

    await stop(one.child);

    const two = await startDeriveServer(entry, {}, { dataDir: restartDir });
    boots.push(two.child);
    second = two.base;
    const view = await at<{ busy: boolean; pending: { id: string; kind: string; held: boolean } | null }>(two.base, `/api/lessons/${lesson}`);
    assert.equal(view.status, 200, JSON.stringify(view.json));
    assert.ok(view.json.pending, 'the card is gone: nothing in the file said one was open');
    assert.equal(view.json.pending?.id, promptId);
    assert.equal(view.json.pending?.kind, 'quiz');
    // `busy` keeps meaning "a turn is running". The terminal that opened this
    // card is not running any more, so a live status line would be a lie — the
    // card's own liveness reaches the browser through `pending`.
    assert.equal(view.json.busy, false, 'a restarted companion lesson must not report a terminal that is gone as busy');
    // The row is the only place the answer key is allowed to live.
    const wire = JSON.stringify(view.json);
    for (const key of ['correct', 'explanation', 'rubric']) {
      assert.ok(!new RegExp(`"${key}"\\s*:`).test(wire), `the lesson view carried "${key}" before the learner committed`);
    }
  });

  it('still refuses a second card on that lesson, in the shipped sentence, after the restart', async () => {
    // The one-card-open refusal used to be decided by a Map, so the restart
    // above would have let the model open a second card over the first and
    // leave the learner with two. The table is what answers it now.
    const again = await at<{ error: string }>(second, `/api/external/lessons/${lesson}/quiz`, CARD);
    assert.equal(again.status, 409, JSON.stringify(again.json));
    assert.equal(
      again.json.error,
      "A card is already open (quiz). Wait for the learner's reply and pass it to `answer` before asking anything else.",
    );
  });
});
