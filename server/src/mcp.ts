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
 * This file declares no tool contract of its own. Every name, description and
 * input schema comes from `./tools.js`, including the places where the MCP
 * surface deliberately reads differently from the in-process agent; all this
 * file contributes is the handler for each tool, which is what actually differs
 * between them. Several handlers do real work here rather than proxying:
 * start_lesson opens the browser and assembles the profile and material brief,
 * attach_material uploads files, and the card tools flush the Codex mirror first.
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
import { RolloutMirror } from './codex-mirror.js';
import { TOKEN_PATH, VERSION } from './config.js';
import { descriptionFor, shapeFor, toolsFor } from './tools.js';

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

/**
 * The install token, read straight off disk: this process runs as the same
 * user as the server, in the learner's own terminal. The message is what the
 * learner sees in Claude Code or Codex when Derive has never been started,
 * so it says what to do rather than naming a header.
 */
const TOKEN = (() => {
  try {
    const t = readFileSync(TOKEN_PATH, 'utf8').trim();
    if (t) return t;
  } catch {
    /* reported when a tool is actually called */
  }
  return '';
})();
const auth = () => {
  if (!TOKEN) throw new Error(`derive server: no token at ${TOKEN_PATH}. Start Derive once (\`pnpm start\` in the derive folder) so it can make one.`);
  return { 'x-derive-token': TOKEN };
};

async function api<T>(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...auth(), ...(LEARNER ? { 'x-derive-learner': LEARNER } : {}) },
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
    const res = await fetch(`${BASE}/api/materials`, { method: 'POST', headers: auth(), body: form });
    const body = (await res.json().catch(() => ({}))) as Partial<Attached> & { error?: string };
    if (!res.ok && !body.materials?.length) out.errors.push({ name: files.map((f) => basename(f)).join(', '), error: body.error ?? res.statusText });
    out.materials.push(...(body.materials ?? []));
    out.errors.push(...(body.errors ?? []));
  }
  for (const source of repos) {
    const res = await fetch(`${BASE}/api/materials/repo`, { method: 'POST', headers: { 'content-type': 'application/json', ...auth() }, body: JSON.stringify({ source, lesson_id: lesson }) });
    const body = (await res.json().catch(() => ({}))) as Partial<Attached> & { error?: string };
    if (!res.ok) out.errors.push({ name: source, error: body.error ?? res.statusText });
    else out.materials.push(...(body.materials ?? []));
  }
  return out;
}

const materialsBrief = (lesson: string) => api<{ materials: Material[]; brief: string }>(`/api/external/lessons/${lesson}/materials`);

/**
 * The companion page's one-time handoff, added here rather than server-side:
 * this process already read the 0600 file, and putting the token in the `url`
 * field of a response would be the server handing it back out. The server
 * answers that URL with a 302 that drops the token and sets the session
 * cookie, so it rides in the address bar for exactly one request.
 */
function withToken(url: string) {
  if (!TOKEN) return url;
  try {
    const u = new URL(url);
    u.searchParams.set('token', TOKEN);
    return u.toString();
  } catch {
    /* not a URL we can extend; let the page ask for the token itself */
    return url;
  }
}

function openBrowser(url: string) {
  const cmd = process.platform === 'darwin' ? `open "${url}"` : process.platform === 'win32' ? `start "" "${url}"` : `xdg-open "${url}"`;
  exec(cmd, () => undefined);
}

const server = new McpServer({ name: 'derive', version: VERSION });

/**
 * The only per-tool code left in this file: each tool's handler talks to a
 * different endpoint, and a few of them do work here that no proxy can do.
 * Contracts live in the registry; this map is handlers and nothing else.
 */
const handlers: Record<string, (a: Record<string, unknown>) => Promise<unknown>> = {
  quiz: async (a) => (await flushed(), api(`/api/external/lessons/${await ensureLesson()}/quiz`, a)),
  ask: async (a) => (await flushed(), api(`/api/external/lessons/${await ensureLesson()}/ask`, a)),
  set_plan: async (a) => (await flushed(), api(`/api/external/lessons/${await ensureLesson()}/set_plan`, a)),
  node_status: async (a) => (await flushed(), api(`/api/external/lessons/${await ensureLesson()}/node_status`, a)),
  set_phase: async (a) => api(`/api/external/lessons/${await ensureLesson()}/set_phase`, a),
  explain_back: async (a) => (await flushed(), api(`/api/external/lessons/${await ensureLesson()}/explain_back`, a)),
  remember: async (a) => api(`/api/external/lessons/${await ensureLesson()}/remember`, a),
  set_preferences: async (a) => {
    const { learner, ...fields } = a as { learner?: string } & Record<string, unknown>;
    if (lessonId && !learner && Object.keys(fields).length) return api(`/api/external/lessons/${lessonId}/set_preferences`, fields);
    let who = learner ?? LEARNER;
    if (!who && lessonId) who = (await api<{ learner_id?: string }>('/api/external/active').catch(() => ({}) as { learner_id?: string })).learner_id;
    const qs = who ? `?learner=${encodeURIComponent(who)}` : '';
    if (!Object.keys(fields).length) return api(`/api/preferences${qs}`);
    return api(`/api/preferences${qs}`, { ...fields, learner: who }, 'PATCH');
  },
  read_material: async (a) => api(`/api/external/lessons/${await ensureLesson()}/read_material`, a),
  search_material: async (a) => api(`/api/external/lessons/${await ensureLesson()}/search_material`, a),
  search_library: async (a) => api(`/api/external/lessons/${await ensureLesson()}/search_library`, a),
  read_resource: async (a) => api(`/api/external/lessons/${await ensureLesson()}/read_resource`, a),
  suggest_resource: async (a) => api(`/api/external/lessons/${await ensureLesson()}/suggest_resource`, a),
  add_resource: async (a) => api(`/api/external/lessons/${await ensureLesson()}/add_resource`, a),
  start_lesson: async (a) => {
    const { topic, files, answer_in, learner, open_browser, review } = a as { topic: string; files?: string[]; answer_in?: 'browser' | 'terminal'; learner?: string; open_browser?: boolean; review?: boolean };
    const where = answer_in ?? ANSWER_IN;
    const l = await api<{ id: string; url: string; learner_id: string; review?: unknown; library?: string; warmup?: string }>('/api/external/lessons', { topic, answer_in: where, learner: learner ?? LEARNER, review: !!review, driver: DRIVER });
    lessonId = l.id;
    watchCodexSession(l.id);
    if (open_browser !== false && DRIVER !== 'app') openBrowser(withToken(l.url));
    const profile = await api<{ profile: string; learner?: { name: string } }>(`/api/profile?learner=${encodeURIComponent(l.learner_id)}`).catch(() => ({ profile: '', learner: undefined }));
    let material: (Attached & { brief?: string }) | undefined;
    if (files?.length) {
      material = await attach(l.id, files);
      if (material.materials.length) material.brief = (await materialsBrief(l.id)).brief;
    }
    return {
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
    };
  },
  attach_material: async (a) => {
    const id = await ensureLesson();
    const r = await attach(id, a.files as string[]);
    return { ...r, brief: r.materials.length ? (await materialsBrief(id)).brief : undefined };
  },
  answer: async (a) => (await flushed(), api(`/api/external/lessons/${await ensureLesson()}/answer`, a)),
  answer_in: async (a) => api(`/api/external/lessons/${await ensureLesson()}/answer_in`, a),
  learner_profile: async (a) => {
    let who = (a.learner as string | undefined) ?? LEARNER;
    if (!who && lessonId) who = (await api<{ learner_id?: string }>('/api/external/active').catch(() => ({}) as { learner_id?: string })).learner_id;
    return api(`/api/profile${who ? `?learner=${encodeURIComponent(who)}` : ''}`);
  },
  learners: async (a) => {
    const create = a.create as string | undefined;
    if (create) await api('/api/learners', { name: create });
    return api('/api/learners');
  },
  end_lesson: async () => (await flushed(), api(`/api/external/lessons/${await ensureLesson()}/end`, {})),
  library: async (a) => {
    const who = (a.learner as string | undefined) ?? LEARNER;
    const topic = a.topic as string | undefined;
    const qs = new URLSearchParams({ ...(topic ? { topic } : {}), ...(who ? { learner: who } : {}) }).toString();
    return api(`/api/external/library${qs ? `?${qs}` : ''}`);
  },
};

// One registration per registry entry, in registry declaration order. The
// description and the input schema are whatever the registry says this surface
// reads, including the four card tools' terminal note and the two fields only a
// terminal driver has (quiz's already_held, set_preferences' learner).
for (const spec of toolsFor('mcp')) {
  const run = handlers[spec.name];
  if (!run) throw new Error(`no handler for tool: ${spec.name}`);
  server.registerTool(spec.name, { description: descriptionFor(spec, 'mcp'), inputSchema: shapeFor(spec, 'mcp') }, async (a: Record<string, unknown>) => text(await run(a)));
}

await server.connect(new StdioServerTransport());
