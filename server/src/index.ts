import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { streamSSE } from 'hono/streaming';
import * as actions from './actions.js';
import { interrupt, isBusy, runTurn } from './agent.js';
import { backend, backendSource } from './backend.js';
import { PORT, VAULT_DIR } from './config.js';
import {
  allNodes,
  bindMaterials,
  buildReviewGraph,
  createLearner,
  createLesson,
  DEFAULT_LEARNER_ID,
  deleteLearner,
  deleteLesson,
  deleteMaterial,
  dueNodes,
  findLearner,
  getLearner,
  getLesson,
  getMaterial,
  lastExternalLesson,
  listEvents,
  listLearners,
  listLessons,
  listMaterials,
  listMisconceptions,
  listNodes,
  renameLearner,
  updateLearnerPrefs,
  setAnswerIn,
  stats,
  sweepOrphanMaterials,
  type GraphNodeInput,
  type MaterialRow,
} from './db.js';
import { emit, subscribe } from './events.js';
import { exportToVault, renderMarkdown } from './export.js';
import { addResource, deleteResource, editResource, getResource, isKind, librarySection, listResources, publicRow, refetchResource, RESOURCE_KINDS, segmentsOf, tagCounts } from './library.js';
import { ACCEPTED, describe, ingestMaterial, ingestRepo, materialsSection, MAX_FILE_BYTES } from './materials.js';
import { addNotice, takeNotices } from './notices.js';
import { firstTurnPrompt, materialAttachedPrompt, reviewTurnPrompt } from './prompt.js';
import { answerPrompt, cancelPending, hasPending, pendingId, pendingPrompt, type PromptKind } from './prompts.js';

/**
 * A restart kills in-flight turns without a turn_end. Close them on boot so
 * the page is not stuck on "busy" and a stale card is shown as such.
 */
for (const l of listLessons()) {
  const events = listEvents(l.id);
  const last = [...events].reverse().find((e) => e.type === 'turn_start' || e.type === 'turn_end');
  if (l.mode === 'agent' && last?.type === 'turn_start') emit(l.id, 'turn_end', { ok: true, interrupted: true, reason: 'server restarted' });
}

const app = new Hono();
app.use('/api/*', cors({ origin: '*', allowHeaders: ['content-type', 'x-derive-learner'] }));

/**
 * Whose request this is. The web app sends the learner it has selected in
 * a header; the plugin passes one by name or id in the body; a request
 * without either is the first learner. An unknown learner falls back to the
 * first one rather than failing, so a stale selection never locks the app.
 */
const learnerOf = (c: Context, fromBody?: unknown): string => {
  const raw = (typeof fromBody === 'string' && fromBody) || c.req.header('x-derive-learner') || c.req.query('learner') || '';
  const l = raw ? findLearner(raw) : undefined;
  return l?.id ?? DEFAULT_LEARNER_ID;
};

/** External (Claude Code) lessons are "busy" from turn_start until the Stop hook posts turn_end, and while a card is open. */
const busy = (id: string) => {
  if (isBusy(id)) return true;
  const lesson = getLesson(id);
  if (lesson?.mode !== 'external') return false;
  if (hasPending(id)) return true;
  const events = listEvents(id);
  const last = [...events].reverse().find((e) => e.type === 'turn_start' || e.type === 'turn_end');
  return last?.type === 'turn_start';
};

const lessonView = (id: string) => {
  const lesson = getLesson(id);
  if (!lesson) return null;
  return { lesson, nodes: listNodes(id), materials: listMaterials(id), busy: busy(id), pending: hasPending(id) };
};

sweepOrphanMaterials();

app.get('/api/health', (c) => c.json({ ok: true, version: '0.4.0', backend: backend(), backend_source: backendSource() }));
app.get('/api/stats', (c) => {
  const learner = learnerOf(c);
  return c.json({ ...stats(learner), due: dueNodes(learner).length, vault: !!VAULT_DIR, library: listResources(learner).length, learner: getLearner(learner), backend: backend() });
});

// ---------- learners ----------

app.get('/api/learners', (c) => {
  const counts = new Map<string, number>();
  for (const l of listLessons()) counts.set(l.learner_id, (counts.get(l.learner_id) ?? 0) + 1);
  return c.json({ learners: listLearners().map((l) => ({ ...l, lessons: counts.get(l.id) ?? 0 })), current: learnerOf(c) });
});

app.post('/api/learners', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { name?: string };
  try {
    return c.json(createLearner(String(body.name ?? '')), 201);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
});

app.patch('/api/learners/:id', async (c) => {
  const id = c.req.param('id');
  if (!getLearner(id)) return c.json({ error: 'not found' }, 404);
  const body = (await c.req.json().catch(() => ({}))) as { name?: string; prefs?: Record<string, unknown> };
  try {
    if (body.name !== undefined) renameLearner(id, String(body.name));
    if (body.prefs && typeof body.prefs === 'object') updateLearnerPrefs(id, body.prefs);
    return c.json(getLearner(id));
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
});

app.delete('/api/learners/:id', async (c) => {
  const id = c.req.param('id');
  if (!getLearner(id)) return c.json({ error: 'not found' }, 404);
  try {
    for (const l of listLessons(id)) await interrupt(l.id);
    deleteLearner(id);
    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
});

// ---------- lessons ----------

app.get('/api/lessons', (c) =>
  c.json(
    listLessons(learnerOf(c)).map((l) => {
      const nodes = listNodes(l.id);
      return {
        ...l,
        nodes: nodes.length,
        locked: nodes.filter((n) => n.status === 'locked').length,
        shaky: nodes.filter((n) => n.status === 'shaky').length,
        busy: busy(l.id),
      };
    }),
  ),
);

app.post('/api/lessons', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { topic?: string; materials?: string[]; learner?: string };
  const topic = body.topic?.trim();
  if (!topic) return c.json({ error: 'topic required' }, 400);
  const lesson = createLesson(randomUUID(), topic, { learnerId: learnerOf(c, body.learner) });
  const materials = Array.isArray(body.materials) && body.materials.length ? bindMaterials(lesson.id, body.materials) : [];
  for (const m of materials) emit(lesson.id, 'material', materialEvent(m));
  void runTurn(lesson.id, firstTurnPrompt(topic, materials.map(describe))).catch((e) => console.error('[turn]', e));
  return c.json({ ...lesson, materials }, 201);
});

app.get('/api/lessons/:id', (c) => {
  const v = lessonView(c.req.param('id'));
  if (!v) return c.json({ error: 'not found' }, 404);
  return c.json({ ...v, events: listEvents(v.lesson.id) });
});

app.delete('/api/lessons/:id', async (c) => {
  const id = c.req.param('id');
  await interrupt(id);
  cancelPending(id, { held: true });
  held.delete(id);
  deleteLesson(id);
  return c.json({ ok: true });
});

app.get('/api/lessons/:id/stream', (c) => {
  const id = c.req.param('id');
  if (!getLesson(id)) return c.json({ error: 'not found' }, 404);
  const after = Number(c.req.query('after') ?? 0);
  return streamSSE(c, async (stream) => {
    const send = (ev: { seq: number; type: string; payload: unknown; ts: number }) =>
      stream.writeSSE({ event: ev.type, data: JSON.stringify(ev), id: ev.seq > 0 ? String(ev.seq) : undefined });
    for (const ev of listEvents(id)) if (ev.seq > after) await send(ev);
    await send({ seq: -1, type: 'ready', payload: { busy: busy(id), pending: hasPending(id) }, ts: Date.now() });
    let closed = false;
    const unsub = subscribe(id, (ev) => {
      if (!closed) void send(ev).catch(() => undefined);
    });
    stream.onAbort(() => {
      closed = true;
      unsub();
    });
    while (!closed) {
      await stream.sleep(15000);
      if (!closed) await stream.writeSSE({ event: 'ping', data: '' }).catch(() => undefined);
    }
  });
});

app.post('/api/lessons/:id/message', async (c) => {
  const id = c.req.param('id');
  const lesson = getLesson(id);
  if (!lesson) return c.json({ error: 'not found' }, 404);
  const body = (await c.req.json().catch(() => ({}))) as { text?: string };
  const text = body.text?.trim();
  if (!text) return c.json({ error: 'text required' }, 400);
  if (lesson.mode === 'external') {
    // Companion mode: the conversation lives in the terminal. A message
    // while a card is open answers it the way a typed reply does in the
    // app (the card closes ungraded and the tutor gets the text); otherwise
    // the note is kept in the log so the export and the graph stay one record.
    emit(id, 'user', { text, source: 'browser' });
    const pid = pendingId(id);
    if (pid && answerPrompt(id, pid, { steer: text })) return c.json({ ok: true, note: 'Your message closed the open card; the tutor reads it at its next turn.' });
    return c.json({ ok: true, note: 'This lesson is driven from Claude Code; your note was logged.' });
  }
  if (isBusy(id)) {
    // Mid-turn. With a card pending, the message answers that card (the tool
    // returns it to the tutor in the same turn). Otherwise it is queued for
    // the tutor's next tool result or turn. Either way it is in the log now.
    emit(id, 'user', { text });
    const pid = pendingId(id);
    if (pid && answerPrompt(id, pid, { steer: text })) return c.json({ ok: true });
    addNotice(id, `The learner wrote while you were working: "${text}". Address it at your next chance.`);
    return c.json({ ok: true, note: 'queued for the tutor' });
  }
  void runTurn(id, text, { echoUser: text }).catch((e) => console.error('[turn]', e));
  return c.json({ ok: true });
});

app.post('/api/lessons/:id/answer', async (c) => {
  const id = c.req.param('id');
  const body = (await c.req.json().catch(() => ({}))) as { prompt_id?: string } & Record<string, unknown>;
  if (!body.prompt_id) return c.json({ error: 'prompt_id required' }, 400);
  const { prompt_id, ...answer } = body;
  const ok = answerPrompt(id, prompt_id, answer);
  if (!ok) return c.json({ error: 'no such pending prompt (the turn may have ended; send a message instead)' }, 409);
  return c.json({ ok: true });
});

app.post('/api/lessons/:id/interrupt', async (c) => {
  await interrupt(c.req.param('id'));
  return c.json({ ok: true });
});

/**
 * Voice mode is a browser feature (the page reads the tutor aloud and
 * listens for the answer), but the tutor writes differently for the ear,
 * so it is told when the learner switches it on or off.
 */
app.post('/api/lessons/:id/voice', async (c) => {
  const id = c.req.param('id');
  const lesson = getLesson(id);
  if (!lesson) return c.json({ error: 'not found' }, 404);
  const body = (await c.req.json().catch(() => ({}))) as { on?: boolean };
  addNotice(
    id,
    body.on
      ? 'The learner switched voice mode on: your prose is read aloud to them and they answer by speaking. Write for the ear: short paragraphs, one idea each, no tables, no long code, formulas said in words before (or instead of) notation. Quiz options must be short enough to hold in mind when heard.'
      : 'The learner switched voice mode off; write for the screen again.',
  );
  return c.json({ ok: true });
});

app.get('/api/lessons/:id/export', (c) => {
  const lesson = getLesson(c.req.param('id'));
  if (!lesson) return c.json({ error: 'not found' }, 404);
  return c.text(renderMarkdown(lesson), 200, { 'content-type': 'text/markdown; charset=utf-8' });
});

app.post('/api/lessons/:id/export', (c) => {
  const lesson = getLesson(c.req.param('id'));
  if (!lesson) return c.json({ error: 'not found' }, 404);
  const path = exportToVault(lesson);
  if (!path) return c.json({ error: 'DERIVE_VAULT_DIR is not set' }, 400);
  return c.json({ ok: true, path });
});

// ---------- course material ----------

const materialEvent = (m: MaterialRow) => ({ id: m.id, name: m.name, kind: m.kind, unit: m.unit, pages: m.pages, chars: m.chars });

/** Material arrived mid-lesson: the tutor hears about it now if idle, otherwise on the result of the card it is waiting on. */
function announceMaterials(lessonId: string, materials: MaterialRow[]) {
  const lesson = getLesson(lessonId);
  if (!lesson || !materials.length) return;
  for (const m of materials) emit(lesson.id, 'material', materialEvent(m));
  const prompt = materialAttachedPrompt(materials.map(describe).join('; '));
  if (lesson.mode === 'agent' && !isBusy(lesson.id)) void runTurn(lesson.id, prompt).catch((e) => console.error('[turn]', e));
  else addNotice(lesson.id, prompt);
}

/**
 * Upload one or more files (multipart field `files`). Without `lesson_id`
 * the material is parked until a lesson is created with its id; with one it
 * is attached at once and the tutor is told at its next chance.
 */
app.post('/api/materials', async (c) => {
  let body: Record<string, unknown>;
  try {
    body = await c.req.parseBody({ all: true });
  } catch (e) {
    return c.json({ error: `could not read the upload: ${e instanceof Error ? e.message : String(e)}` }, 400);
  }
  const raw = body.files ?? body.file;
  const files = (Array.isArray(raw) ? raw : raw ? [raw] : []).filter((f): f is File => f instanceof File);
  if (!files.length) return c.json({ error: `no files. Send multipart with a "files" field (${ACCEPTED.join(', ')}).` }, 400);
  if (files.length > 12) return c.json({ error: 'at most 12 files per upload' }, 400);
  const lessonId = typeof body.lesson_id === 'string' && body.lesson_id ? body.lesson_id : c.req.query('lesson_id') || null;
  const lesson = lessonId ? getLesson(lessonId) : undefined;
  if (lessonId && !lesson) return c.json({ error: 'lesson not found' }, 404);

  const materials: MaterialRow[] = [];
  const errors: { name: string; error: string }[] = [];
  for (const f of files) {
    if (f.size > MAX_FILE_BYTES) {
      errors.push({ name: f.name, error: `larger than ${MAX_FILE_BYTES / 1024 / 1024} MB` });
      continue;
    }
    try {
      materials.push(await ingestMaterial(f.name, Buffer.from(await f.arrayBuffer()), lesson?.id ?? null));
    } catch (e) {
      errors.push({ name: f.name, error: e instanceof Error ? e.message : String(e) });
    }
  }
  if (lesson) announceMaterials(lesson.id, materials);
  if (!materials.length) return c.json({ error: errors.map((e) => `${e.name}: ${e.error}`).join('; '), errors }, 422);
  return c.json({ materials, errors }, 201);
});

/**
 * A repository as material: `source` is a folder on this machine, a GitHub
 * URL (optionally /tree/<ref>/<subdir>) or any git URL. Same binding rules
 * as file uploads.
 */
app.post('/api/materials/repo', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { source?: string; lesson_id?: string };
  const source = body.source?.trim();
  if (!source) return c.json({ error: 'source required: a local path, a GitHub URL or a git URL' }, 400);
  const lessonId = body.lesson_id || c.req.query('lesson_id') || null;
  const lesson = lessonId ? getLesson(lessonId) : undefined;
  if (lessonId && !lesson) return c.json({ error: 'lesson not found' }, 404);
  try {
    const m = await ingestRepo(source, lesson?.id ?? null);
    if (lesson) announceMaterials(lesson.id, [m]);
    return c.json({ materials: [m], errors: [] }, 201);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 422);
  }
});

app.get('/api/materials/:id', (c) => {
  const m = getMaterial(c.req.param('id'));
  if (!m) return c.json({ error: 'not found' }, 404);
  const { text, ...meta } = m;
  return c.json(c.req.query('text') ? { ...meta, text } : meta);
});

app.delete('/api/materials/:id', (c) => {
  const m = getMaterial(c.req.param('id'));
  if (!m) return c.json({ error: 'not found' }, 404);
  deleteMaterial(m.id);
  if (m.lesson_id) {
    emit(m.lesson_id, 'material_removed', { id: m.id, name: m.name });
    addNotice(m.lesson_id, `The learner removed the material "${m.name}" from this lesson. Do not rely on it any more.`);
  }
  return c.json({ ok: true });
});

// ---------- the library ----------

const err = (c: Context, e: unknown, status: 400 | 404 | 422 | 500 = 400) => c.json({ error: e instanceof Error ? e.message : String(e) }, status);

/** The learner's shelf, filtered by ?q= (title, tags, note, author), ?kind= and ?tag=. */
app.get('/api/library', (c) => {
  const learner = learnerOf(c);
  const q = (c.req.query('q') ?? '').trim().toLowerCase();
  const kind = c.req.query('kind');
  const tag = c.req.query('tag')?.toLowerCase();
  const rows = listResources(learner)
    .map(publicRow)
    .filter((r) => (!kind || r.kind === kind) && (!tag || r.tags.includes(tag)))
    .filter((r) => !q || [r.title, r.author, r.note, r.host, r.tags.join(' ')].some((s) => (s ?? '').toLowerCase().includes(q)));
  return c.json({ resources: rows, tags: tagCounts(learner), kinds: RESOURCE_KINDS, total: listResources(learner).length });
});

/** Add an entry: a URL (fetched now), or a note with a title. */
app.post('/api/library', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { url?: string; title?: string; kind?: string; author?: string; note?: string; tags?: unknown; fetch?: boolean; learner?: string };
  try {
    const { resource, existing } = await addResource(learnerOf(c, body.learner), body, { addedBy: 'learner' });
    return c.json({ ...publicRow(resource), existing }, existing ? 200 : 201);
  } catch (e) {
    return err(c, e, 422);
  }
});

app.get('/api/library/:id', (c) => {
  const r = getResource(c.req.param('id'));
  if (!r) return c.json({ error: 'not found' }, 404);
  const { text: _t, ...meta } = r;
  return c.json(c.req.query('text') ? { ...publicRow(meta), parts: segmentsOf(r) } : publicRow(meta));
});

app.patch('/api/library/:id', async (c) => {
  const id = c.req.param('id');
  if (!getResource(id)) return c.json({ error: 'not found' }, 404);
  const body = (await c.req.json().catch(() => ({}))) as { title?: unknown; kind?: unknown; author?: unknown; note?: unknown; tags?: unknown };
  if (body.kind !== undefined && !isKind(body.kind)) return c.json({ error: `kind must be one of ${RESOURCE_KINDS.join(', ')}` }, 400);
  try {
    return c.json(publicRow(editResource(id, body)));
  } catch (e) {
    return err(c, e);
  }
});

app.post('/api/library/:id/refetch', async (c) => {
  const id = c.req.param('id');
  if (!getResource(id)) return c.json({ error: 'not found' }, 404);
  try {
    return c.json(publicRow(await refetchResource(id)));
  } catch (e) {
    return err(c, e, 422);
  }
});

app.delete('/api/library/:id', (c) => {
  const id = c.req.param('id');
  if (!getResource(id)) return c.json({ error: 'not found' }, 404);
  deleteResource(id);
  return c.json({ ok: true });
});

// ---------- review ----------

app.get('/api/review', (c) => c.json(dueNodes(learnerOf(c))));

/**
 * A review session is a lesson whose graph is copies of the due nodes and
 * the nodes they rest on; a status change on a copy reschedules the
 * original. The tutor gets the due nodes interleaved across topics and
 * their dependencies, so a miss is re-derived rather than re-told.
 */
function startReview(learner: string, opts: { mode?: 'agent' | 'external'; answerIn?: 'browser' | 'terminal'; driver?: string } = {}) {
  if (!dueNodes(learner).length) return null;
  const id = randomUUID();
  const graph = buildReviewGraph(id, learner);
  // The topic names the due nodes, so the graph is built before the lesson row (no key constraint between them).
  const lesson = createLesson(id, `Review · ${graph.due.map((n) => n.label).join(', ')}`, { learnerId: learner, mode: opts.mode, answerIn: opts.answerIn, driver: opts.driver ?? null });
  return { lesson, graph };
}

app.post('/api/review', async (c) => {
  const started = startReview(learnerOf(c));
  if (!started) return c.json({ error: 'nothing due' }, 400);
  void runTurn(started.lesson.id, reviewTurnPrompt(started.graph.due)).catch((e) => console.error('[turn]', e));
  return c.json(started.lesson, 201);
});

// ---------- atlas + learner profile ----------

app.get('/api/atlas', (c) => {
  const learner = learnerOf(c);
  const now = Date.now();
  return c.json({
    nodes: allNodes(learner).map((n) => ({
      ...n,
      depends_on: JSON.parse(n.depends_on || '[]') as string[],
      due: n.status === 'locked' && !!n.review_at && n.review_at <= now,
    })),
    lessons: listLessons(learner).map((l) => ({ id: l.id, topic: l.topic, goal: l.goal, phase: l.phase, mode: l.mode, created_at: l.created_at })),
    misconceptions: listMisconceptions(learner),
    due: dueNodes(learner),
  });
});

app.get('/api/profile', (c) => c.json({ ...actions.profile(learnerOf(c)), learner: getLearner(learnerOf(c)) }));

/** How a learner wants to be taught, for the plugin (the web app patches the learner directly). */
app.get('/api/preferences', (c) => {
  const l = getLearner(learnerOf(c))!;
  return c.json({ learner: l.name, preferences: l.prefs });
});
app.patch('/api/preferences', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown> & { learner?: string };
  const id = learnerOf(c, body.learner);
  const { learner: _who, ...patch } = body;
  try {
    const l = updateLearnerPrefs(id, patch);
    return c.json({ learner: l.name, preferences: l.prefs });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
});

// ---------- external lessons (the Claude Code plugin, the Codex skills) ----------

/** Which terminal drives a companion lesson, from the MCP server's DERIVE_DRIVER. */
const driverOf = (raw: unknown): 'claude-code' | 'codex' => (raw === 'codex' ? 'codex' : 'claude-code');

app.post('/api/external/lessons', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { topic?: string; materials?: string[]; learner?: string; answer_in?: string; review?: boolean; driver?: string };
  const driver = driverOf(body.driver);
  if (body.review) {
    const started = startReview(learnerOf(c, body.learner), { mode: 'external', answerIn: body.answer_in === 'terminal' ? 'terminal' : 'browser', driver });
    if (!started) return c.json({ error: 'Nothing is due for review for this learner.' }, 400);
    emit(started.lesson.id, 'turn_start', { source: driver });
    const due = started.graph.due.map((n) => ({
      id: n.review_id,
      label: n.label,
      summary: n.summary,
      topic: n.topic,
      overdue_days: Math.max(0, Math.floor((Date.now() - (n.review_at ?? Date.now())) / 86_400_000)),
      derived_from: n.deps.map((d) => `${d.label} [${d.id}]`),
    }));
    return c.json({ ...started.lesson, url: `${baseUrl(c.req.url)}/lesson/${started.lesson.id}`, review: { due, instructions: reviewTurnPrompt(started.graph.due) } }, 201);
  }
  const topic = body.topic?.trim();
  if (!topic) return c.json({ error: 'topic required' }, 400);
  const lesson = createLesson(randomUUID(), topic, {
    mode: 'external',
    learnerId: learnerOf(c, body.learner),
    answerIn: body.answer_in === 'terminal' ? 'terminal' : 'browser',
    driver,
  });
  const materials = Array.isArray(body.materials) && body.materials.length ? bindMaterials(lesson.id, body.materials) : [];
  for (const m of materials) emit(lesson.id, 'material', materialEvent(m));
  emit(lesson.id, 'turn_start', { source: driver });
  return c.json({ ...lesson, materials, url: `${baseUrl(c.req.url)}/lesson/${lesson.id}`, library: librarySection(lesson.learner_id, topic) }, 201);
});

/** The system-prompt section about a learner's library, for a driver that builds its own context (the plugin). */
app.get('/api/external/library', (c) => {
  const learner = learnerOf(c);
  return c.json({ size: listResources(learner).length, brief: librarySection(learner, c.req.query('topic') ?? '') });
});

/** The system-prompt section about a lesson's material, for a driver that builds its own context (the plugin). */
app.get('/api/external/lessons/:id/materials', (c) => {
  const id = c.req.param('id');
  if (!getLesson(id)) return c.json({ error: 'not found' }, 404);
  return c.json({ materials: listMaterials(id), brief: materialsSection(id) });
});

app.get('/api/external/active', (c) => {
  const l = lastExternalLesson();
  if (!l) return c.json({ error: 'no external lesson' }, 404);
  return c.json({ ...l, url: `${baseUrl(c.req.url)}/lesson/${l.id}`, pending: pendingId(l.id), held: held.get(l.id)?.id ?? null });
});

/** External lessons have no prompt of ours to prepend notices to, so they ride along on the next tool result. */
const withNotices = <T>(lessonId: string, result: T): T => {
  const n = takeNotices(lessonId);
  return n.length && result && typeof result === 'object' ? { ...result, notice: n.join('\n') } : result;
};

/**
 * Cards answered from the terminal. In a lesson with answer_in = terminal a
 * blocking tool opens the card, records it here and returns at once; the
 * model shows the card and ends its turn. The learner's next message comes
 * back through the `answer` action, which settles the card and returns the
 * graded result, exactly what the blocking tool would have returned. A
 * click in the browser settles it too; the result then waits here until
 * the model collects it (through `answer`, or the hook on the next prompt).
 */
type Held = { id: string; kind: PromptKind; optionCount: number; done: Promise<Record<string, unknown>>; settled: Record<string, unknown> | null; openedAt: number };
const held = new Map<string, Held>();
/** The text of the last few cards shown in a terminal, so the mirror can drop the model's copy of them. */
const recentCards = new Map<string, string[]>();

const flat = (s: string) => s.replace(/[*_`>#]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * In a terminal-answered lesson the model prints each card as its message,
 * and the hook mirrors that message here, where the same card is already an
 * interactive element. Paragraphs of the prose that are part of a recent
 * card are dropped so the learner does not read every question twice.
 */
function withoutCards(lessonId: string, text: string): string {
  const cards = (recentCards.get(lessonId) ?? []).map(flat);
  if (!cards.length) return text;
  const kept = text
    .split(/\n\s*\n/)
    .filter((para) => {
      const f = flat(para);
      if (!f) return false;
      // A short paragraph is kept unless it is a card's header line ("Quiz", "The plan").
      if (f.length < 8) return !cards.some((c) => c === f || c.startsWith(f + ' '));
      return !cards.some((c) => c.includes(f));
    });
  return kept.join('\n\n').trim();
}

function holdCard(lessonId: string, kind: PromptKind, open: { id: string; done: Promise<Record<string, unknown>> }, payload: Record<string, unknown>, optionCount: number, nodeLabel?: string | null) {
  const h: Held = { id: open.id, kind, optionCount, done: open.done, settled: null, openedAt: Date.now() };
  held.set(lessonId, h);
  const card = actions.renderCard(kind, payload, nodeLabel);
  recentCards.set(lessonId, [...(recentCards.get(lessonId) ?? []).slice(-5), card]);
  void open.done.then((r) => {
    if (held.get(lessonId) === h) h.settled = r;
  });
  const what = kind === 'quiz' ? 'the letter they reply with' : kind === 'plan' ? '"yes" or their requested changes' : 'their reply';
  return {
    status: 'pending',
    prompt_id: open.id,
    card,
    instruction:
      `Show the card to the learner as your message, verbatim (they answer in this terminal, or in the browser). Then END YOUR TURN and wait: do not answer for them, do not continue teaching, and do not reveal the explanation. ` +
      `When their reply arrives, call the \`answer\` tool with it as \`reply\` (${what}, or the whole message when it is not a pick); it returns the graded result exactly as this tool would have. ` +
      'If they answered in the browser instead, the same call returns that result.',
  };
}

const nodeLabelOf = (lessonId: string, nodeId?: string | null) => (nodeId ? listNodes(lessonId).find((n) => n.node_id === nodeId)?.label ?? null : null);

/** Run a tutor action for an external lesson. Blocking actions long-poll until the learner answers, or return at once in terminal mode. */
app.post('/api/external/lessons/:id/:action', async (c) => {
  const id = c.req.param('id');
  const action = c.req.param('action');
  const lesson = getLesson(id);
  if (!lesson) return c.json({ error: 'not found' }, 404);
  const a = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const terminal = a.answer_in === 'terminal' || (a.answer_in !== 'browser' && lesson.answer_in === 'terminal');
  try {
    if (terminal && (action === 'quiz' || action === 'ask' || action === 'set_plan' || action === 'explain_back') && held.get(id) && !held.get(id)!.settled) {
      return c.json({ error: `A card is already open (${held.get(id)!.kind}). Wait for the learner's reply and pass it to \`answer\` before asking anything else.` }, 409);
    }
    switch (action) {
      case 'quiz': {
        const args = a as unknown as actions.QuizArgs;
        if (args.purpose != null && !actions.QUIZ_PURPOSES.includes(args.purpose)) return c.json({ error: `purpose must be one of ${actions.QUIZ_PURPOSES.join(', ')}` }, 400);
        // A pretest comes before the teaching by design; only the check that locks a node needs prose before it.
        let gap = args.purpose === 'pretest' ? null : teachingGap(id, a as { node_id?: string; already_held?: boolean });
        if (gap) {
          // The prose that precedes this call may still be in flight (Codex mirrors messages whole, and the tool call can arrive first). One short grace period.
          await new Promise((r) => setTimeout(r, 600));
          gap = teachingGap(id, a as { node_id?: string; already_held?: boolean });
        }
        if (gap) return c.json({ error: gap }, 400);
        if (!Array.isArray(args.options) || args.options.length < 2 || !Array.isArray(args.correct) || !args.correct.length) return c.json({ error: 'quiz needs 2 or 3 options and at least one correct index' }, 400);
        if (terminal) {
          const open = actions.openQuiz(id, args, { hold: true });
          return c.json(withNotices(id, holdCard(id, 'quiz', open, { question: args.question, options: args.options, multi: args.correct.length > 1, purpose: args.purpose ?? undefined }, args.options.length, nodeLabelOf(id, args.node_id))));
        }
        return c.json(withNotices(id, await actions.quiz(id, args)));
      }
      case 'ask': {
        const args = a as { question: string; options?: string[] };
        if (terminal) {
          const open = actions.openAsk(id, args, { hold: true });
          return c.json(withNotices(id, holdCard(id, 'ask', open, { question: args.question, options: args.options ?? [] }, args.options?.length ?? 0)));
        }
        return c.json(withNotices(id, await actions.ask(id, args)));
      }
      case 'set_plan': {
        const args = a as { goal: string; nodes: GraphNodeInput[] };
        if (terminal) {
          const open = actions.openPlan(id, args, { hold: true });
          return c.json(withNotices(id, holdCard(id, 'plan', open, { goal: args.goal, nodes: args.nodes }, 0)));
        }
        return c.json(withNotices(id, await actions.setPlan(id, args)));
      }
      case 'explain_back': {
        const args = a as { prompt: string; rubric: string; node_id?: string };
        if (terminal) {
          const open = actions.openExplain(id, args, { hold: true });
          return c.json(withNotices(id, holdCard(id, 'explain', open, { prompt: args.prompt }, 0, nodeLabelOf(id, args.node_id))));
        }
        return c.json(withNotices(id, await actions.explainBack(id, args)));
      }
      case 'answer': {
        // The learner's terminal reply for the open card (or the result of a browser answer, once).
        const h = held.get(id);
        const reply = String(a.reply ?? '').trim();
        if (!h || (a.prompt_id && a.prompt_id !== h.id)) {
          return c.json({ error: 'No card is waiting for a reply in this lesson (the server may have restarted). Ask again with a fresh quiz, ask, set_plan or explain_back.' }, 409);
        }
        if (h.settled) {
          held.delete(id);
          return c.json(withNotices(id, { ...h.settled, answered_in: 'browser' }));
        }
        if (!reply) return c.json({ error: 'The card is still open and the learner has not answered in the browser. Pass their reply, or wait for their next message.' }, 409);
        const parsed = actions.parseReply(h.kind, reply, h.optionCount);
        if (!answerPrompt(id, h.id, parsed)) {
          held.delete(id);
          return c.json({ error: 'The card was closed before the reply arrived. Ask again.' }, 409);
        }
        const result = await h.done;
        held.delete(id);
        return c.json(withNotices(id, { ...result, answered_in: 'terminal' }));
      }
      case 'collect': {
        // The UserPromptSubmit hook asks whether a held card was answered in the browser since the model last looked.
        const h = held.get(id);
        if (!h?.settled) return c.json({ settled: null });
        held.delete(id);
        return c.json({ settled: { kind: h.kind, ...h.settled } });
      }
      case 'answer_in': {
        const where = a.where === 'terminal' ? 'terminal' : a.where === 'browser' ? 'browser' : null;
        if (!where) return c.json({ error: 'where must be "terminal" or "browser"' }, 400);
        setAnswerIn(id, where);
        emit(id, 'answer_in', { where });
        return c.json({ ok: true, answer_in: where });
      }
      case 'node_status':
        return c.json(withNotices(id, actions.nodeStatus(id, a as { id: string; status: 'teaching' | 'locked' | 'shaky' })));
      case 'set_phase':
        return c.json(withNotices(id, actions.phase(id, a as { phase: 'probe' | 'plan' | 'teach' })));
      case 'remember':
        return c.json(actions.remember(id, a as { fact: string; kind?: 'learner' | 'preference' | 'strength' | 'gap' }));
      case 'set_preferences':
        return c.json(actions.setPreferences(id, a as Parameters<typeof actions.setPreferences>[1]));
      case 'read_material':
        return c.json(actions.readMaterial(id, a as { name?: string; path?: string; from?: number; to?: number }));
      case 'search_material':
        return c.json(actions.searchMaterial(id, a as { query: string; name?: string; limit?: number }));
      case 'search_library':
        return c.json(actions.searchLibrary(id, a as { query: string; kind?: string; tag?: string; limit?: number }));
      case 'read_resource':
        return c.json(actions.readResource(id, a as { id?: string; title?: string; from?: number; to?: number }));
      case 'suggest_resource':
        return c.json(withNotices(id, actions.suggestResource(id, a as { id?: string; title?: string; why: string; where?: string; node_id?: string })));
      case 'add_resource':
        return c.json(withNotices(id, await actions.saveResource(id, a as { url?: string; title?: string; kind?: string; author?: string; note?: string; tags?: unknown })));
      case 'mirror': {
        // The plugin's hooks post transcript text here.
        const { role, text, uid, at } = a as { role: 'assistant' | 'user'; text: string; uid?: string; at?: number };
        if (!text?.trim()) return c.json({ ok: true, skipped: true });
        // `at` is the transcript timestamp: the UI orders by it, so prose that
        // preceded a quiz in the terminal renders before the card even when the
        // hook delivered it later.
        if (role === 'user') emit(id, 'user', { text, source: 'terminal', at });
        else {
          const prose = withoutCards(id, text);
          if (!prose) return c.json({ ok: true, skipped: true });
          emit(id, 'assistant', { id: uid ?? randomUUID(), text: prose, source: 'terminal', at });
        }
        return c.json({ ok: true });
      }
      case 'end': {
        // The turn is over. Cards the model was blocking on are cancelled;
        // a held card stays open for the learner's next message.
        cancelPending(id);
        const h = held.get(id);
        emit(id, 'turn_end', { ok: true, source: lesson.driver ?? 'claude-code', held: h && !h.settled ? h.id : null });
        return c.json({ ok: true });
      }
      default:
        return c.json({ error: `unknown action ${action}` }, 400);
    }
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

/**
 * Companion mode runs under Claude Code's own system prompt, which pushes the
 * model toward brevity. Left alone it marks a node "teaching" and fires the
 * quiz with no teaching in between. So a teach-phase quiz for a node is
 * refused until real prose has been mirrored since that node was marked,
 * unless the model says the probe already showed the learner holds it.
 */
const MIN_TEACHING_CHARS = 240;
function teachingGap(lessonId: string, a: { node_id?: string; already_held?: boolean }): string | null {
  if (!a.node_id || a.already_held) return null;
  const lesson = getLesson(lessonId);
  if (lesson?.phase !== 'teach') return null;
  const events = listEvents(lessonId);
  let start = -1;
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.type === 'node_status' && (e.payload as { id: string; status: string }).id === a.node_id && (e.payload as { status: string }).status === 'teaching') {
      start = i;
      break;
    }
  }
  if (start < 0) return null;
  const chars = events
    .slice(start + 1)
    .filter((e) => e.type === 'assistant')
    .reduce((n, e) => n + String((e.payload as { text?: string }).text ?? '').trim().length, 0);
  if (chars >= MIN_TEACHING_CHARS) return null;
  return (
    `Teach first. Node "${a.node_id}" was marked "teaching" but only ${chars} characters of your prose have reached the learner since then, and a check needs a real explanation before it. ` +
    'This is expected behaviour, not a bug: do not investigate the server or the hooks. ' +
    'Write the teaching now as ordinary assistant text in this conversation (that is what the learner reads): motivate the node, establish it from the nodes it depends on, make the dependency explicit, with math or a small figure where it helps. Several short paragraphs. Then, in this same turn and without stopping, call quiz again: the learner cannot reply to prose, only to cards. ' +
    'If the probe already showed the learner holds this node and you are only confirming it, say so in one sentence and call quiz with already_held: true.'
  );
}

function baseUrl(reqUrl: string) {
  const u = new URL(reqUrl);
  return `${u.protocol}//${u.host}`;
}

// ---------- static frontend (production) ----------
const here = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(here, '../../web/dist');
if (existsSync(distDir)) {
  const relRoot = distDir.startsWith(process.cwd()) ? distDir.slice(process.cwd().length + 1) : distDir;
  app.use('/*', serveStatic({ root: relRoot }));
  app.get('*', (c) => c.html(readFileSync(join(distDir, 'index.html'), 'utf8')));
}

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`derive server on http://localhost:${info.port}${existsSync(distDir) ? '' : ' (API only; run the web dev server too)'}`);
  console.log(`tutor runs on ${backend() === 'codex' ? 'Codex (your ChatGPT login)' : 'Claude (your Claude Code login)'}${backendSource() === 'auto' ? ', picked automatically; set DERIVE_BACKEND to choose' : ''}`);
});
