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
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { MockLanguageModelV4, simulateReadableStream } from 'ai/test';
import { startDeriveServer, startInProcessServer, type InProcessServer } from './spawn.js';

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

  it('refuses a window on a row that is not local, naming the row', async () => {
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
  });

  it('shows the default on every local row and nothing on any other, and all three teach', async () => {
    const r = await api<{ rows: { id: string; group: string; teaches: boolean; num_ctx_default: number | null }[] }>('/api/settings');
    for (const row of r.json.rows) {
      if (row.group === 'local') {
        assert.equal(row.num_ctx_default, 32768, `${row.id} does not offer a window field`);
        assert.equal(row.teaches, true, `${row.id} does not teach, so it cannot be made active`);
      } else {
        assert.equal(row.num_ctx_default, null, `${row.id} offers a window field it has no use for`);
      }
    }
    assert.deepEqual(r.json.rows.filter((row) => row.group === 'local').map((row) => row.id), ['ollama', 'lmstudio', 'llamacpp']);
  });
});
