/**
 * The stdio MCP server, driven with no model behind it.
 *
 * This is the path the Claude Code plugin and the Codex CLI actually take: a
 * terminal agent speaks JSON-RPC to `server/dist/mcp.js`, which proxies every
 * tool to a running Derive server. The test plays that agent. It asks the built
 * binary what tools it serves and holds the answer against the frozen
 * `wire-surface.json`, so a description that moved in the registry but not in
 * the fixture fails here too, on the real wire rather than on the source. Then
 * it walks a whole lesson through the tools — start, plan, teach, check, answer,
 * end — which no model is needed for, because a terminal-answered card returns
 * at once and the test types the learner's reply.
 *
 * Needs `pnpm build` first (it runs server/dist/index.js and server/dist/mcp.js).
 */
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ALL_TOOL_NAMES } from '../src/tools.js';

const here = dirname(fileURLToPath(import.meta.url));
const serverEntry = resolve(here, '../dist/index.js');
const mcpEntry = resolve(here, '../dist/mcp.js');

/** The tools the pre-phase binary served, in the order it happened to register them (git show b8f255ce:server/src/mcp.ts). Order is not part of the MCP contract; the set is. */
const MCP_TOOLS_BEFORE = [
  'start_lesson', 'attach_material', 'read_material', 'search_material', 'search_library', 'read_resource', 'suggest_resource', 'add_resource', 'library', 'quiz', 'ask',
  'set_plan', 'explain_back', 'answer', 'answer_in', 'node_status', 'set_phase', 'remember', 'set_preferences', 'learner_profile', 'learners', 'end_lesson',
];

type WireRow = { name: string; description: string };
const fixture = JSON.parse(readFileSync(join(here, 'wire-surface.json'), 'utf8')) as { mcp: WireRow[] };

let server: ChildProcess | undefined;
let mcp: ChildProcess | undefined;
let base = '';
let dataDir = '';
/** The install token the server wrote into the scratch data dir; the mcp child reads the same file through DERIVE_DATA_DIR. */
let token = '';

/** One JSON-RPC call over the child's stdin/stdout, or a readable failure instead of a hung suite. */
let nextId = 0;
const waiting = new Map<number, (m: { result?: Record<string, unknown>; error?: { message: string } }) => void>();
function rpc<T = Record<string, unknown>>(method: string, params: Record<string, unknown> = {}): Promise<T> {
  const id = ++nextId;
  return new Promise<T>((res, rej) => {
    const timer = setTimeout(() => {
      waiting.delete(id);
      rej(new Error(`the mcp server did not answer ${method} within 20 s`));
    }, 20_000);
    waiting.set(id, (m) => {
      clearTimeout(timer);
      if (m.error) rej(new Error(`the mcp server refused ${method}: ${m.error.message}`));
      else res(m.result as T);
    });
    mcp!.stdin!.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
  });
}

/** A tool call, with its JSON text result already parsed. A tool that failed is a readable assertion, not an unexplained shape. */
async function call<T = Record<string, unknown>>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const r = await rpc<{ content: { text: string }[]; isError?: boolean }>('tools/call', { name, arguments: args });
  assert.ok(!r.isError, `${name} failed: ${r.content?.[0]?.text}`);
  return JSON.parse(r.content[0].text) as T;
}

/** Prose the learner has read, posted the way the plugin's transcript hook posts it, so the teach gate is satisfied. */
const teachProse = (lesson: string, node: string) =>
  fetch(`${base}/api/external/lessons/${lesson}/mirror`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-derive-token': token },
    body: JSON.stringify({ role: 'assistant', text: `Teaching ${node}. `.repeat(30), uid: `${node}-prose` }),
  });

before(async () => {
  assert.ok(existsSync(serverEntry), `build first: ${serverEntry} is missing`);
  assert.ok(existsSync(mcpEntry), `build first: ${mcpEntry} is missing`);
  dataDir = mkdtempSync(join(tmpdir(), 'derive-mcp-'));
  const port = 4400 + Math.floor(Math.random() * 500);
  base = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, [serverEntry], { env: { ...process.env, PORT: String(port), DERIVE_DATA_DIR: dataDir, DERIVE_BACKEND: 'claude' }, stdio: ['ignore', 'pipe', 'pipe'] });
  const deadline = Date.now() + 20_000;
  let up = false;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${base}/api/health`);
      if (r.ok) {
        token = readFileSync(join(dataDir, 'token'), 'utf8').trim();
        up = true;
        break;
      }
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  if (!up) throw new Error('server did not start');

  mcp = spawn(process.execPath, [mcpEntry], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, DERIVE_URL: base, DERIVE_ANSWER_IN: 'terminal', DERIVE_DRIVER: 'claude-code', DERIVE_DATA_DIR: dataDir },
  });
  let buffer = '';
  mcp.stdout!.on('data', (chunk: Buffer) => {
    buffer += chunk.toString();
    let cut = buffer.indexOf('\n');
    while (cut >= 0) {
      const line = buffer.slice(0, cut).trim();
      buffer = buffer.slice(cut + 1);
      cut = buffer.indexOf('\n');
      if (!line) continue;
      const msg = JSON.parse(line) as { id?: number; result?: Record<string, unknown>; error?: { message: string } };
      // Notifications carry no id and no one is waiting on them.
      const settle = msg.id == null ? undefined : waiting.get(msg.id);
      if (settle) {
        waiting.delete(msg.id!);
        settle(msg);
      }
    }
  });
  await rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'derive-test', version: '0' } });
  mcp.stdin!.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
});

after(() => {
  mcp?.kill();
  server?.kill();
  if (dataDir) rmSync(dataDir, { recursive: true, force: true });
});

describe('the built mcp server over stdio', () => {
  let tools: WireRow[] = [];

  it('serves the registry in declaration order, and the same tools the pre-phase binary served', async () => {
    tools = (await rpc<{ tools: WireRow[] }>('tools/list')).tools;
    assert.equal(tools.length, 22);
    assert.deepEqual(
      tools.map((t) => t.name),
      [...ALL_TOOL_NAMES],
      'tools/list must serve the registry in declaration order',
    );
    assert.deepEqual([...tools.map((t) => t.name)].sort(), [...MCP_TOOLS_BEFORE].sort(), 'the set of tools the plugin sees must not have changed');
  });

  it('serves the descriptions frozen in wire-surface.json, on the real wire and not just in the source', () => {
    const frozen = new Map(fixture.mcp.map((r) => [r.name, r.description]));
    for (const tool of tools) assert.equal(tool.description, frozen.get(tool.name), `${tool.name}: the built binary serves a description the fixture does not`);
  });

  it('walks a whole lesson with no model: start, plan, teach, check, answer, end', async () => {
    const started = await call<{ lesson_id: string; answer_in: string }>('start_lesson', { topic: 'why gradient descent works', open_browser: false });
    assert.ok(started.lesson_id, 'start_lesson must return a lesson id');
    assert.equal(started.answer_in, 'terminal');
    const lesson = started.lesson_id;

    const plan = await call<{ status: string }>('set_plan', {
      goal: 'Understand why the step size is bounded',
      nodes: [
        { id: 'slope', label: 'A slope points uphill', kind: 'truth', summary: 'The gradient points where the function grows fastest.' },
        { id: 'step', label: 'Stepping against the slope descends', kind: 'derived', summary: 'Moving against the gradient lowers the value for a small enough step.', depends_on: ['slope'] },
        { id: 'goal', label: 'The step must stay below a bound', kind: 'goal', summary: 'Too large a step overshoots and climbs.', depends_on: ['step'] },
      ],
    });
    assert.equal(plan.status, 'pending', 'a terminal-answered card returns at once');
    assert.equal((await call<{ approved: boolean }>('answer', { reply: 'yes' })).approved, true);

    await call('set_phase', { phase: 'teach' });
    await call('node_status', { id: 'slope', status: 'teaching' });
    await teachProse(lesson, 'slope');

    const card = await call<{ status: string; prompt_id: string }>('quiz', {
      question: 'Which way does the gradient point?',
      options: ['uphill, where the function grows fastest', 'downhill, where the function falls fastest'],
      correct: [0],
      explanation: 'The gradient is the direction of steepest increase.',
      node_id: 'slope',
      purpose: 'check',
      tests: 'intuition',
    });
    assert.equal(card.status, 'pending');
    assert.ok(card.prompt_id, 'a held card must come back with the prompt_id that settles it');

    const graded = await call<{ result: string; correct_options: string[]; instruction?: string }>('answer', { reply: 'A' });
    assert.equal(graded.result, 'correct');
    assert.deepEqual(graded.correct_options, ['uphill, where the function grows fastest']);
    assert.ok(graded.instruction && graded.instruction.length > 0, 'the server tells the tutor what to do next');

    assert.equal((await call<{ ok: boolean }>('end_lesson')).ok, true);
  });
});
