#!/usr/bin/env node
/**
 * Derive as an MCP server (stdio), for Claude Code, Codex, or the app's own
 * Codex backend.
 *
 * Exposes the tutor's tools to a coding-agent session and proxies them to a
 * running Derive server, which renders the cards and the graph in the
 * browser. A lesson is answered either in the browser (the blocking tools
 * wait there) or in the terminal (they return the card at once and the
 * learner's next message settles it through `answer`). Configure with:
 *
 *   claude mcp add derive -- node /path/to/derive/server/dist/mcp.js
 *   pnpm codex:setup            (writes the Codex config, links the skills)
 *
 * or install the Claude Code plugin in ./plugin, which wires this plus the
 * teach skill.
 *
 * Environment: DERIVE_URL (default http://localhost:4310), DERIVE_LEARNER
 * (a learner name or id; default the first learner), DERIVE_ANSWER_IN
 * ("browser" or "terminal"; default browser), DERIVE_DRIVER ("claude-code",
 * the default; "codex", which also mirrors the Codex session log into the
 * lesson, since Codex has no transcript hooks; or "app", the Derive server
 * running a lesson on Codex itself), DERIVE_LESSON_ID (bind to one lesson).
 */
import { exec } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, extname, join, resolve } from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { RolloutMirror } from './codex-mirror.js';

const BASE = (process.env.DERIVE_URL ?? 'http://localhost:4310').replace(/\/$/, '');
const LEARNER = process.env.DERIVE_LEARNER?.trim() || undefined;
const ANSWER_IN = process.env.DERIVE_ANSWER_IN === 'terminal' ? 'terminal' : 'browser';
let lessonId: string | null = process.env.DERIVE_LESSON_ID ?? null;
const DRIVER = process.env.DERIVE_DRIVER === 'codex' ? 'codex' : process.env.DERIVE_DRIVER === 'app' ? 'app' : 'claude-code';
const CODEX_HOME = resolve(process.env.CODEX_HOME ?? join(homedir(), '.codex'));

/**
 * Under Codex the session log is tailed into the lesson (see codex-mirror).
 * Card tools flush it first, so the prose written before a check has reached
 * the server when the server decides whether the check may run.
 */
let mirror: RolloutMirror | null = null;
function watchCodexSession(lesson: string) {
  mirror?.stop();
  if (DRIVER !== 'codex') return;
  mirror = new RolloutMirror(CODEX_HOME, lesson, {
    post: (item) => api(`/api/external/lessons/${lesson}/mirror`, item).then(() => undefined),
    turnEnd: () => api(`/api/external/lessons/${lesson}/end`, {}).then(() => undefined),
  });
  mirror.start();
}
const flushed = async () => {
  await mirror?.flush().catch(() => undefined);
};

async function api<T>(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(LEARNER ? { 'x-derive-learner': LEARNER } : {}) },
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
  if (!l) throw new Error('No active lesson. Call start_lesson first.');
  lessonId = l.id;
  return lessonId;
}

const text = (obj: unknown) => ({ content: [{ type: 'text' as const, text: typeof obj === 'string' ? obj : JSON.stringify(obj) }] });

const MATERIAL_EXTS = new Set(['.pdf', '.pptx', '.docx', '.md', '.markdown', '.mdx', '.txt', '.text', '.tex', '.rst', '.org']);
const REPO_MARKERS = ['.git', 'package.json', 'pyproject.toml', 'Cargo.toml', 'go.mod', 'pom.xml', 'build.gradle', 'Gemfile', 'mix.exs', 'CMakeLists.txt', 'Makefile'];

const expandHome = (raw: string) => resolve(raw.replace(/^~(?=$|[\\/])/, process.env.HOME ?? ''));
const isUrl = (s: string) => /^(https?:\/\/|git@|ssh:\/\/|git:\/\/)/i.test(s.trim());
/** A folder that is a codebase rather than a folder of slides. */
const isRepoDir = (p: string) => REPO_MARKERS.some((m) => existsSync(join(p, m)));

/**
 * Sort what the learner named into files to upload and repositories to
 * import: a URL is a repo; a folder with a .git or a manifest is a repo;
 * any other folder is expanded to the material files in it.
 */
function sortSources(paths: string[]): { files: string[]; repos: string[] } {
  const files: string[] = [];
  const repos: string[] = [];
  for (const raw of paths) {
    if (isUrl(raw)) {
      repos.push(raw.trim());
      continue;
    }
    const p = expandHome(raw);
    const st = statSync(p, { throwIfNoEntry: false });
    if (!st) throw new Error(`No such file: ${raw}`);
    if (st.isDirectory()) {
      if (isRepoDir(p)) repos.push(p);
      else {
        const found = readdirSync(p)
          .sort()
          .filter((f) => MATERIAL_EXTS.has(extname(f).toLowerCase()));
        if (!found.length) repos.push(p);
        else for (const f of found) files.push(join(p, f));
      }
    } else files.push(p);
  }
  return { files, repos };
}

type Material = { id: string; name: string; kind: string; unit: string; pages: number; chars: number };
type Attached = { materials: Material[]; errors: { name: string; error: string }[] };

/** Upload local files and import repos to the running Derive server, attached to a lesson. */
async function attach(lesson: string, sources: string[]): Promise<Attached> {
  const { files, repos } = sortSources(sources);
  if (!files.length && !repos.length) throw new Error('Nothing to attach: name .pdf, .pptx, .docx, .md or .txt files, a folder of them, a repository folder, or a GitHub URL.');
  const out: Attached = { materials: [], errors: [] };
  if (files.length) {
    const form = new FormData();
    form.set('lesson_id', lesson);
    for (const p of files) form.append('files', new Blob([readFileSync(p)]), basename(p));
    const res = await fetch(`${BASE}/api/materials`, { method: 'POST', body: form });
    const body = (await res.json().catch(() => ({}))) as Partial<Attached> & { error?: string };
    if (!res.ok && !body.materials?.length) out.errors.push({ name: files.map((f) => basename(f)).join(', '), error: body.error ?? res.statusText });
    out.materials.push(...(body.materials ?? []));
    out.errors.push(...(body.errors ?? []));
  }
  for (const source of repos) {
    const res = await fetch(`${BASE}/api/materials/repo`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ source, lesson_id: lesson }) });
    const body = (await res.json().catch(() => ({}))) as Partial<Attached> & { error?: string };
    if (!res.ok) out.errors.push({ name: source, error: body.error ?? res.statusText });
    else out.materials.push(...(body.materials ?? []));
  }
  return out;
}

const materialsBrief = (lesson: string) => api<{ materials: Material[]; brief: string }>(`/api/external/lessons/${lesson}/materials`);

function openBrowser(url: string) {
  const cmd = process.platform === 'darwin' ? `open "${url}"` : process.platform === 'win32' ? `start "" "${url}"` : `xdg-open "${url}"`;
  exec(cmd, () => undefined);
}

const server = new McpServer({ name: 'derive', version: '0.4.0' });

const nodeSchema = z.object({
  id: z.string().describe('Short stable id, e.g. "packets".'),
  label: z.string().describe('The claim in plain words, 3 to 7 words, no formulas or shorthand. This is what the graph shows.'),
  kind: z.enum(['truth', 'derived', 'goal']),
  summary: z.string().describe('One full sentence stating the claim. Shown to the learner next to the label.'),
  depends_on: z.array(z.string()).optional(),
});

const TERMINAL_NOTE =
  ' In a lesson answered from the terminal (answer_in "terminal") this returns at once with the card as text: show it verbatim, end your turn, and when the learner replies pass their message to `answer`.';

server.registerTool(
  'start_lesson',
  {
    description:
      'Start a Derive lesson for a topic. Opens the companion view in the browser, where quizzes, the plan and the dependency graph are rendered. Call once at the start of a lesson, before any quiz. Returns the lesson id, the URL, where the learner answers cards (browser or terminal), what is already known about this learner, a `warmup` (nodes from earlier lessons that are due, to be retrieved before the probe) when there is one, and, when `files` were given, a brief of the course material (its outline, or its full text when short) with instructions on how to use it.',
    inputSchema: {
      topic: z.string(),
      files: z
        .array(z.string())
        .optional()
        .describe('Course material to prepare for: local paths to .pdf, .pptx, .docx, .md or .txt files, a folder of them, a repository folder, or a GitHub / git URL. Pass everything the learner named.'),
      answer_in: z
        .enum(['browser', 'terminal'])
        .optional()
        .describe('Where the learner answers cards. "terminal": quiz, ask, set_plan and explain_back return at once and the learner replies in this conversation. Default: the DERIVE_ANSWER_IN environment variable, else "browser".'),
      learner: z.string().optional().describe('Which learner profile this lesson belongs to, by name. Default: DERIVE_LEARNER, else the first learner.'),
      open_browser: z.boolean().optional().describe('Default true.'),
      review: z
        .boolean()
        .optional()
        .describe('Start a spaced-repetition review session instead of a lesson: the server picks the nodes due (interleaved across topics, with the nodes they rest on) and returns them with instructions. The topic is then ignored.'),
    },
  },
  async ({ topic, files, answer_in, learner, open_browser, review }) => {
    const where = answer_in ?? ANSWER_IN;
    const l = await api<{ id: string; url: string; learner_id: string; review?: unknown; library?: string; warmup?: string }>('/api/external/lessons', { topic, answer_in: where, learner: learner ?? LEARNER, review: !!review, driver: DRIVER });
    lessonId = l.id;
    watchCodexSession(l.id);
    if (open_browser !== false && DRIVER !== 'app') openBrowser(l.url);
    const profile = await api<{ profile: string; learner?: { name: string } }>(`/api/profile?learner=${encodeURIComponent(l.learner_id)}`).catch(() => ({ profile: '', learner: undefined }));
    let material: (Attached & { brief?: string }) | undefined;
    if (files?.length) {
      material = await attach(l.id, files);
      if (material.materials.length) material.brief = (await materialsBrief(l.id)).brief;
    }
    return text({
      lesson_id: l.id,
      url: l.url,
      learner: profile.learner?.name,
      answer_in: where,
      how_cards_work:
        where === 'terminal'
          ? 'The learner answers in this terminal. Each of quiz, ask, set_plan and explain_back returns the card as text at once: show it verbatim, end your turn, and pass their reply to `answer`. They can also answer in the browser; `answer` returns that result too.'
          : 'The learner answers in the browser. quiz, ask, set_plan and explain_back block until they do and return the result. If they ask to answer here in the terminal instead, call `answer_in` with "terminal".',
      learner_profile: profile.profile,
      ...(l.review ? { review: l.review } : {}),
      ...(l.warmup ? { warmup: l.warmup } : {}),
      ...(material ? { course_material: material } : {}),
      ...(l.library ? { library: l.library } : {}),
    });
  },
);

server.registerTool(
  'attach_material',
  {
    description:
      'Attach course material to the current lesson: local .pdf, .pptx, .docx, .md or .txt files, a folder of them, a repository folder, or a GitHub / git URL. Returns a brief of it: read the relevant pages or files with read_material before changing the plan.',
    inputSchema: { files: z.array(z.string()).min(1).describe('Paths or URLs. A folder with a .git or a package manifest is imported as a repository.') },
  },
  async ({ files }) => {
    const id = await ensureLesson();
    const r = await attach(id, files);
    return text({ ...r, brief: r.materials.length ? (await materialsBrief(id)).brief : undefined });
  },
);

server.registerTool(
  'read_material',
  {
    description:
      'Read a range of the course material attached to this lesson: pages of a PDF, slides of a deck, parts of a document, or files of a repository (pass `path` for one file). About ten per call; the text carries a marker before each page, slide or file. Read before planning and before teaching a node that maps to it.',
    inputSchema: {
      name: z.string().optional().describe('Which material, by name or part of it. Optional when only one is attached.'),
      path: z.string().optional().describe('Repository material only: the file to read, by path (exact, or a suffix such as "src/db.ts").'),
      from: z.number().int().min(1).optional().describe('First page, slide or file, 1-based. Default 1.'),
      to: z.number().int().min(1).optional().describe('Last page, slide or file, inclusive. Default from + 9.'),
    },
  },
  async (a) => text(await api(`/api/external/lessons/${await ensureLesson()}/read_material`, a)),
);

server.registerTool(
  'search_material',
  {
    description: 'Find where something is covered in the attached course material. Returns the best-matching pages, slides or files with a snippet each.',
    inputSchema: { query: z.string(), name: z.string().optional(), limit: z.number().int().min(1).max(20).optional() },
  },
  async (a) => text(await api(`/api/external/lessons/${await ensureLesson()}/search_material`, a)),
);

const KINDS = z.enum(['article', 'video', 'book', 'paper', 'course', 'note']);

server.registerTool(
  'search_library',
  {
    description:
      "Search the learner's library: the articles, videos, books, papers, courses and notes they keep across lessons (start_lesson returns the catalog under `library` when there is one). Matches titles, tags, notes and the fetched text; returns entries with a snippet and the part it was found in. Search it before you plan, and when the learner asks for something to read or watch.",
    inputSchema: {
      query: z.string().describe('A few words: the topic, a term, an author. Empty lists the shelf.'),
      kind: KINDS.optional(),
      tag: z.string().optional(),
      limit: z.number().int().min(1).max(20).optional(),
    },
  },
  async (a) => text(await api(`/api/external/lessons/${await ensureLesson()}/search_library`, a)),
);

server.registerTool(
  'read_resource',
  {
    description:
      "Read a range of parts of one library entry (an article's body, a paper's PDF, a video's description), about ten parts per call with a marker before each. Pass the entry id (from the catalog or a search hit) or its title. An entry with nothing fetched returns its URL and the learner's note; read the URL yourself then.",
    inputSchema: {
      id: z.string().optional().describe('The entry id, or its first characters.'),
      title: z.string().optional().describe('Or the title (or part of it).'),
      from: z.number().int().min(1).optional(),
      to: z.number().int().min(1).optional(),
    },
  },
  async (a) => text(await api(`/api/external/lessons/${await ensureLesson()}/read_resource`, a)),
);

server.registerTool(
  'suggest_resource',
  {
    description:
      "Point the learner at one entry of their library as a card in the companion: which entry, why it is worth their time now, and where to look (a chapter, a section, a timestamp). Use it when a node locks and the entry deepens it, when the learner wants more, or when a source explains a step better than chat can. One at a time, only when it earns its place; only entries in the library or ones you just saved.",
    inputSchema: {
      id: z.string().optional(),
      title: z.string().optional(),
      why: z.string().describe('One or two sentences, to the learner.'),
      where: z.string().optional().describe('"chapter 3", "from 12:40", "the section on invariants".'),
      node_id: z.string().optional(),
    },
  },
  async (a) => text(await api(`/api/external/lessons/${await ensureLesson()}/suggest_resource`, a)),
);

server.registerTool(
  'add_resource',
  {
    description:
      "Save a source to the learner's library: a URL you found with a web search or read (the server fetches it and keeps its text), with a one-sentence note on why and a few tags. Sparingly: one or two per lesson, only sources you actually read. A URL already on the shelf is not duplicated; the note and tags are merged in.",
    inputSchema: {
      url: z.string(),
      title: z.string().optional(),
      kind: KINDS.optional().describe('Guessed from the URL when omitted.'),
      author: z.string().optional(),
      note: z.string().describe('Why this is worth keeping, to the learner.'),
      tags: z.array(z.string()).max(8).optional(),
    },
  },
  async (a) => text(await api(`/api/external/lessons/${await ensureLesson()}/add_resource`, a)),
);

server.registerTool(
  'library',
  {
    description: "The learner's library outside a lesson: the whole shelf as a catalog, or the entries matching a topic. Lessons get this automatically from start_lesson.",
    inputSchema: { topic: z.string().optional().describe('Rank entries by relevance to this.'), learner: z.string().optional() },
  },
  async ({ topic, learner }) => {
    const who = learner ?? LEARNER;
    const qs = new URLSearchParams({ ...(topic ? { topic } : {}), ...(who ? { learner: who } : {}) }).toString();
    return text(await api(`/api/external/library${qs ? `?${qs}` : ''}`));
  },
);

server.registerTool(
  'quiz',
  {
    description:
      'Ask the learner ONE graded multiple-choice question with a known correct answer. The server grades it and returns what they picked, whether it was correct, how sure they were, and what to do next; you never grade it yourself. Never leak the answer in the question or options. Options are 2 or 3 bare claims; the app adds "I don\'t know". Set `purpose`: "pretest" for the attempt you ask for BEFORE teaching a derived node (a miss is expected, not recorded against them, never locks), "check" for the question that locks a node, "cumulative" for the end-of-lesson quiz after the goal locks. Set `tests` to what the question tests: a derived node locks only after a correct "intuition" or "transfer" question on it. In the teach phase a check for a node is refused until you have actually written the teaching for that node in the terminal (several paragraphs: motivate, establish, connect), so teach first, then check; a pretest is allowed before the teaching. In a browser-answered lesson this blocks until they answer.' +
      TERMINAL_NOTE,
    inputSchema: {
      question: z.string(),
      options: z.array(z.string()).min(2).max(3),
      correct: z.array(z.number().int().min(0)).min(1),
      explanation: z.string(),
      node_id: z.string().optional(),
      purpose: z.enum(['probe', 'pretest', 'check', 'cumulative', 'review']).optional().describe('Default: "review" on a node copied from an earlier lesson (a warm-up node, a review session), "probe" in the probe phase, else "check".'),
      tests: z.enum(['intuition', 'procedure', 'transfer']).optional().describe('"intuition": why the claim must be so, what breaks if a premise changes, which picture is right, an estimate before computing. "procedure": carry out the steps. "transfer": a problem of a kind this lesson has not shown. Always set it in the teach phase.'),
      already_held: z.boolean().optional().describe('Set true only when the probe already showed the learner holds this node and you are confirming rather than teaching it. Say so to the learner in one sentence.'),
    },
  },
  async (a) => (await flushed(), text(await api(`/api/external/lessons/${await ensureLesson()}/quiz`, a))),
);

server.registerTool(
  'ask',
  {
    description: 'Ask the learner a question with no right answer (goal, preference, what next). Optional suggested answers. In a browser-answered lesson this blocks until they answer.' + TERMINAL_NOTE,
    inputSchema: { question: z.string(), options: z.array(z.string()).max(4).optional() },
  },
  async (a) => (await flushed(), text(await api(`/api/external/lessons/${await ensureLesson()}/ask`, a))),
);

server.registerTool(
  'set_plan',
  {
    description:
      'Submit the lesson plan as a dependency DAG (truth roots, derived steps, one goal sink). Drawn in the browser; in a browser-answered lesson this blocks until the learner approves or asks for changes.' + TERMINAL_NOTE,
    inputSchema: { goal: z.string(), nodes: z.array(nodeSchema).min(3).max(12) },
  },
  async (a) => (await flushed(), text(await api(`/api/external/lessons/${await ensureLesson()}/set_plan`, a))),
);

server.registerTool(
  'explain_back',
  {
    description:
      'Teach-back: ask the learner to explain a node in their own words. Write the rubric first (what a correct explanation must contain). Returns their text for you to grade. In a browser-answered lesson this blocks until they write.' + TERMINAL_NOTE,
    inputSchema: { prompt: z.string(), rubric: z.string(), node_id: z.string().optional() },
  },
  async (a) => (await flushed(), text(await api(`/api/external/lessons/${await ensureLesson()}/explain_back`, a))),
);

server.registerTool(
  'answer',
  {
    description:
      "Terminal-answered lessons only: hand the learner's reply to the card that is open (the last quiz, ask, set_plan or explain_back). Pass their message verbatim as `reply`: a letter or number picks a quiz option (\"B?\", \"B, not sure\" or \"I think B\" picks it as unsure), \"?\" or \"I don't know\" alone is the don't-know option, \"yes\" approves a plan, anything else is feedback or a message. The server parses and grades it and returns exactly what the blocking tool would have returned (result, correct_options, or the learner's text). If the learner answered in the browser instead, returns that result. Call it once per card, right after their reply, before anything else.",
    inputSchema: {
      reply: z.string().describe("The learner's message, verbatim. May be empty to collect an answer they gave in the browser."),
      prompt_id: z.string().optional().describe('The card, from the tool that opened it. Optional: the open card is the default.'),
    },
  },
  async (a) => (await flushed(), text(await api(`/api/external/lessons/${await ensureLesson()}/answer`, a))),
);

server.registerTool(
  'answer_in',
  {
    description: 'Switch where the learner answers cards for the rest of this lesson: "terminal" (cards return at once, replies come through `answer`) or "browser" (cards block until answered there). Use when the learner asks to answer in the other place.',
    inputSchema: { where: z.enum(['browser', 'terminal']) },
  },
  async (a) => text(await api(`/api/external/lessons/${await ensureLesson()}/answer_in`, a)),
);

server.registerTool(
  'node_status',
  {
    description: 'Mark a plan node "teaching", "locked" (a confident check confirmed it; the node is scheduled for review by how well the check went, the reply says in how many days and which nodes below it earned implicit review credit) or "shaky" (it did not land after two checks; the reply names the nodes it rests on and what the checks on each showed, for targeted remediation). Locking a derived node is refused until a correct intuition or transfer question on it exists; locking the goal returns the instructions for the cumulative quiz. Lights the graph up.',
    inputSchema: { id: z.string(), status: z.enum(['teaching', 'locked', 'shaky']) },
  },
  async (a) => (await flushed(), text(await api(`/api/external/lessons/${await ensureLesson()}/node_status`, a))),
);

server.registerTool(
  'set_phase',
  { description: 'Announce the lesson phase: probe, plan or teach.', inputSchema: { phase: z.enum(['probe', 'plan', 'teach']) } },
  async (a) => text(await api(`/api/external/lessons/${await ensureLesson()}/set_phase`, a)),
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
  'set_preferences',
  {
    description:
      "Update how this learner wants to be taught, for this and every future lesson: the language to write in, how Socratic (style), how long each step runs (pace), their background, how they learn in their words, and where to take examples from. Call it when the learner TELLS you how they want to be taught (\"en español por favor\", \"just explain it, stop quizzing me through every step\", \"I'm a musician, use music\"), passing only the fields they touched, in their words. Do not infer it from a single reaction; that is what `remember` is for. An empty string clears a field. With no fields it returns the current preferences.",
    inputSchema: {
      language: z.string().optional().describe('The language to teach in, e.g. "Spanish". Empty string: the language the learner writes in.'),
      style: z.enum(['adaptive', 'socratic', 'narrated']).optional(),
      pace: z.enum(['brisk', 'standard', 'thorough']).optional(),
      background: z.string().optional().describe('Who they are and what they already know, in their words.'),
      how: z.string().optional().describe('What works for them and what does not, in their words.'),
      examples: z.string().optional().describe('Domains to draw examples and analogies from.'),
      learner: z.string().optional().describe('A learner name or id. Default: the current lesson\'s learner.'),
    },
  },
  async ({ learner, ...fields }) => {
    if (lessonId && !learner && Object.keys(fields).length) return text(await api(`/api/external/lessons/${lessonId}/set_preferences`, fields));
    let who = learner ?? LEARNER;
    if (!who && lessonId) who = (await api<{ learner_id?: string }>('/api/external/active').catch(() => ({}) as { learner_id?: string })).learner_id;
    const qs = who ? `?learner=${encodeURIComponent(who)}` : '';
    if (!Object.keys(fields).length) return text(await api(`/api/preferences${qs}`));
    return text(await api(`/api/preferences${qs}`, { ...fields, learner: who }, 'PATCH'));
  },
);

server.registerTool(
  'learner_profile',
  {
    description: 'What Derive already knows about a learner: how they want to be taught (their own preferences), locked nodes by topic, shaky nodes, misconceptions (with whether they were held with confidence), notes, and the nodes due for review. Defaults to the learner of the current lesson.',
    inputSchema: { learner: z.string().optional().describe('A learner name or id. Default: the current lesson\'s learner.') },
  },
  async ({ learner }) => {
    let who = learner ?? LEARNER;
    if (!who && lessonId) who = (await api<{ learner_id?: string }>('/api/external/active').catch(() => ({}) as { learner_id?: string })).learner_id;
    return text(await api(`/api/profile${who ? `?learner=${encodeURIComponent(who)}` : ''}`));
  },
);

server.registerTool(
  'learners',
  {
    description: 'List the learner profiles Derive knows, or create one by name. Each learner has their own lessons, memory, misconceptions and review queue.',
    inputSchema: { create: z.string().optional().describe('A name to create (no-op if it exists).') },
  },
  async ({ create }) => {
    if (create) await api('/api/learners', { name: create });
    return text(await api('/api/learners'));
  },
);

server.registerTool(
  'end_lesson',
  { description: 'Mark the current lesson turn as finished in the companion view.', inputSchema: {} },
  async () => (await flushed(), text(await api(`/api/external/lessons/${await ensureLesson()}/end`, {}))),
);

await server.connect(new StdioServerTransport());
