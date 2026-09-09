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
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
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

const MATERIAL_EXTS = new Set(['.pdf', '.pptx', '.docx', '.md', '.markdown', '.mdx', '.txt', '.text', '.tex', '.rst', '.org']);

/** Expand paths (files or folders, `~` allowed) to the course-material files in them. */
function materialPaths(paths: string[]): string[] {
  const out: string[] = [];
  for (const raw of paths) {
    const p = resolve(raw.replace(/^~(?=$|[\\/])/, process.env.HOME ?? ''));
    const st = statSync(p, { throwIfNoEntry: false });
    if (!st) throw new Error(`No such file: ${raw}`);
    if (st.isDirectory()) {
      for (const f of readdirSync(p).sort()) if (MATERIAL_EXTS.has(extname(f).toLowerCase())) out.push(join(p, f));
    } else out.push(p);
  }
  if (!out.length) throw new Error('No .pdf, .pptx, .docx, .md or .txt files found at those paths.');
  return out;
}

type Material = { id: string; name: string; kind: string; unit: string; pages: number; chars: number };

/** Upload local files to the running Derive server and attach them to a lesson. */
async function uploadMaterials(lesson: string, paths: string[]): Promise<{ materials: Material[]; errors: { name: string; error: string }[] }> {
  const form = new FormData();
  form.set('lesson_id', lesson);
  for (const p of materialPaths(paths)) form.append('files', new Blob([readFileSync(p)]), basename(p));
  const res = await fetch(`${BASE}/api/materials`, { method: 'POST', body: form });
  const body = (await res.json().catch(() => ({}))) as { materials?: Material[]; errors?: { name: string; error: string }[]; error?: string };
  if (!res.ok) throw new Error(`derive server: ${body.error ?? res.statusText}`);
  return { materials: body.materials ?? [], errors: body.errors ?? [] };
}

const materialsBrief = (lesson: string) => api<{ materials: Material[]; brief: string }>(`/api/external/lessons/${lesson}/materials`);

function openBrowser(url: string) {
  const cmd = process.platform === 'darwin' ? `open "${url}"` : process.platform === 'win32' ? `start "" "${url}"` : `xdg-open "${url}"`;
  exec(cmd, () => undefined);
}

const server = new McpServer({ name: 'derive', version: '0.2.0' });

const nodeSchema = z.object({
  id: z.string().describe('Short stable id, e.g. "packets".'),
  label: z.string().describe('The claim in plain words, 3 to 7 words, no formulas or shorthand. This is what the graph shows.'),
  kind: z.enum(['truth', 'derived', 'goal']),
  summary: z.string().describe('One full sentence stating the claim. Shown to the learner next to the label.'),
  depends_on: z.array(z.string()).optional(),
});

server.registerTool(
  'start_lesson',
  {
    description:
      'Start a Derive lesson for a topic. Opens the companion view in the browser, where quizzes, the plan and the dependency graph are rendered and answered. Call once at the start of /learn, before any quiz. Returns the lesson id, the URL, what is already known about this learner, and, when `files` were given, a brief of the course material (its outline, or its full text when short) with instructions on how to use it.',
    inputSchema: {
      topic: z.string(),
      files: z
        .array(z.string())
        .optional()
        .describe('Course material to prepare for: local paths to .pdf, .pptx, .docx, .md or .txt files, or a folder of them. Pass every file the learner named.'),
      open_browser: z.boolean().optional().describe('Default true.'),
    },
  },
  async ({ topic, files, open_browser }) => {
    const l = await api<{ id: string; url: string }>('/api/external/lessons', { topic });
    lessonId = l.id;
    if (open_browser !== false) openBrowser(l.url);
    const profile = await api<{ profile: string }>('/api/profile').catch(() => ({ profile: '' }));
    let material: { materials: Material[]; errors: { name: string; error: string }[]; brief?: string } | undefined;
    if (files?.length) {
      material = await uploadMaterials(l.id, files);
      if (material.materials.length) material.brief = (await materialsBrief(l.id)).brief;
    }
    return text({ lesson_id: l.id, url: l.url, learner_profile: profile.profile, ...(material ? { course_material: material } : {}) });
  },
);

server.registerTool(
  'attach_material',
  {
    description:
      'Attach course material (local .pdf, .pptx, .docx, .md or .txt files, or a folder) to the current lesson. Returns a brief of it: read the relevant pages with read_material before changing the plan.',
    inputSchema: { files: z.array(z.string()).min(1) },
  },
  async ({ files }) => {
    const id = await ensureLesson();
    const r = await uploadMaterials(id, files);
    return text({ ...r, brief: r.materials.length ? (await materialsBrief(id)).brief : undefined });
  },
);

server.registerTool(
  'read_material',
  {
    description:
      'Read a range of the course material attached to this lesson: pages of a PDF, slides of a deck, parts of a document. About ten per call; the text carries a marker before each page or slide. Read before planning and before teaching a node that maps to it.',
    inputSchema: {
      name: z.string().optional().describe('Which file, by name or part of it. Optional when only one is attached.'),
      from: z.number().int().min(1).optional().describe('First page or slide, 1-based. Default 1.'),
      to: z.number().int().min(1).optional().describe('Last page or slide, inclusive. Default from + 9.'),
    },
  },
  async (a) => text(await api(`/api/external/lessons/${await ensureLesson()}/read_material`, a)),
);

server.registerTool(
  'search_material',
  {
    description: 'Find where something is covered in the attached course material. Returns the best-matching pages or slides with a snippet each.',
    inputSchema: { query: z.string(), name: z.string().optional(), limit: z.number().int().min(1).max(20).optional() },
  },
  async (a) => text(await api(`/api/external/lessons/${await ensureLesson()}/search_material`, a)),
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
