#!/usr/bin/env node
/**
 * Derive as an MCP server for Claude Code (stdio).
 *
 * Exposes the tutor's tools to a Claude Code session and proxies them to a
 * running Derive server, which renders the cards and the graph in the
 * browser and waits for the learner there. Configure with:
 *
 *   claude mcp add derive -- node /path/to/derive/server/dist/mcp.js
 *
 * or install the plugin in ./plugin, which wires this plus the teach skill.
 */
import { exec } from 'node:child_process';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const BASE = (process.env.DERIVE_URL ?? 'http://localhost:4310').replace(/\/$/, '');
let lessonId: string | null = process.env.DERIVE_LESSON_ID ?? null;

async function api<T>(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      msg = ((await res.json()) as { error?: string }).error ?? msg;
    } catch {
      /* ignore */
    }
    throw new Error(`derive server: ${msg}`);
  }
  return (await res.json()) as T;
}

async function ensureLesson(): Promise<string> {
  if (lessonId) return lessonId;
  const l = await api<{ id: string }>('/api/external/active').catch(() => null);
  if (!l) throw new Error('No active lesson. Call start_lesson first (or run /learn <topic>).');
  lessonId = l.id;
  return lessonId;
}

const text = (obj: unknown) => ({ content: [{ type: 'text' as const, text: typeof obj === 'string' ? obj : JSON.stringify(obj) }] });

function openBrowser(url: string) {
  const cmd = process.platform === 'darwin' ? `open "${url}"` : process.platform === 'win32' ? `start "" "${url}"` : `xdg-open "${url}"`;
  exec(cmd, () => undefined);
}

const server = new McpServer({ name: 'derive', version: '0.2.0' });

const nodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.enum(['truth', 'derived', 'goal']),
  summary: z.string().optional(),
  depends_on: z.array(z.string()).optional(),
});

server.registerTool(
  'start_lesson',
  {
    description:
      'Start a Derive lesson for a topic. Opens the companion view in the browser, where quizzes, the plan and the dependency graph are rendered and answered. Call once at the start of /learn, before any quiz. Returns the lesson id, the URL, and what is already known about this learner.',
    inputSchema: { topic: z.string(), open_browser: z.boolean().optional().describe('Default true.') },
  },
  async ({ topic, open_browser }) => {
    const l = await api<{ id: string; url: string }>('/api/external/lessons', { topic });
    lessonId = l.id;
    if (open_browser !== false) openBrowser(l.url);
    const profile = await api<{ profile: string }>('/api/profile').catch(() => ({ profile: '' }));
    return text({ lesson_id: l.id, url: l.url, learner_profile: profile.profile });
  },
);

server.registerTool(
  'quiz',
  {
    description:
      'Ask the learner ONE graded multiple-choice question with a known correct answer. Rendered and graded in the browser companion; returns what they picked and whether it was correct. Blocks until they answer. Never leak the answer in the question or options. Options are 2 or 3 bare claims; the app adds "I don\'t know". In the teach phase, a quiz for a node is refused until you have actually written the teaching for that node in the terminal (several paragraphs: motivate, establish, connect), so teach first, then check.',
    inputSchema: {
      question: z.string(),
      options: z.array(z.string()).min(2).max(3),
      correct: z.array(z.number().int().min(0)).min(1),
      explanation: z.string(),
      node_id: z.string().optional(),
      already_held: z.boolean().optional().describe('Set true only when the probe already showed the learner holds this node and you are confirming rather than teaching it. Say so to the learner in one sentence.'),
    },
  },
  async (a) => text(await api(`/api/external/lessons/${await ensureLesson()}/quiz`, a)),
);

server.registerTool(
  'ask',
  {
    description: 'Ask the learner a question with no right answer (goal, preference, what next). Optional suggested answers. Blocks until they answer in the browser.',
    inputSchema: { question: z.string(), options: z.array(z.string()).max(4).optional() },
  },
  async (a) => text(await api(`/api/external/lessons/${await ensureLesson()}/ask`, a)),
);

server.registerTool(
  'set_plan',
  {
    description:
      'Submit the lesson plan as a dependency DAG (truth roots, derived steps, one goal sink). Drawn in the browser; blocks until the learner approves or asks for changes.',
    inputSchema: { goal: z.string(), nodes: z.array(nodeSchema).min(3).max(12) },
  },
  async (a) => text(await api(`/api/external/lessons/${await ensureLesson()}/set_plan`, a)),
);

server.registerTool(
  'node_status',
  {
    description: 'Mark a plan node "teaching", "locked" (a quiz confirmed it) or "shaky" (it did not land). Lights the graph up.',
    inputSchema: { id: z.string(), status: z.enum(['teaching', 'locked', 'shaky']) },
  },
  async (a) => text(await api(`/api/external/lessons/${await ensureLesson()}/node_status`, a)),
);

server.registerTool(
  'set_phase',
  { description: 'Announce the lesson phase: probe, plan or teach.', inputSchema: { phase: z.enum(['probe', 'plan', 'teach']) } },
  async (a) => text(await api(`/api/external/lessons/${await ensureLesson()}/set_phase`, a)),
);

server.registerTool(
  'explain_back',
  {
    description:
      'Teach-back: ask the learner to explain a node in their own words. Write the rubric first (what a correct explanation must contain). Returns their text for you to grade. Blocks until they write.',
    inputSchema: { prompt: z.string(), rubric: z.string(), node_id: z.string().optional() },
  },
  async (a) => text(await api(`/api/external/lessons/${await ensureLesson()}/explain_back`, a)),
);

server.registerTool(
  'remember',
  {
    description: 'Store one durable fact about this learner for future lessons (strength, gap, preference). One sentence; use sparingly.',
    inputSchema: { fact: z.string(), kind: z.enum(['learner', 'preference', 'strength', 'gap']).optional() },
  },
  async (a) => text(await api(`/api/external/lessons/${await ensureLesson()}/remember`, a)),
);

server.registerTool(
  'learner_profile',
  { description: 'What Derive already knows about this learner: locked nodes by topic, shaky nodes, misconceptions, notes.', inputSchema: {} },
  async () => text(await api('/api/profile')),
);

server.registerTool(
  'end_lesson',
  { description: 'Mark the current lesson turn as finished in the companion view.', inputSchema: {} },
  async () => text(await api(`/api/external/lessons/${await ensureLesson()}/end`, {})),
);

await server.connect(new StdioServerTransport());
