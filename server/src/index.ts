import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { streamSSE } from 'hono/streaming';
import * as actions from './actions.js';
import { interrupt, isBusy, runTurn } from './agent.js';
import { PORT, VAULT_DIR } from './config.js';
import {
  allNodes,
  bindMaterials,
  createLesson,
  deleteLesson,
  deleteMaterial,
  dueNodes,
  getLesson,
  getMaterial,
  lastExternalLesson,
  listEvents,
  listLessons,
  listMaterials,
  listMisconceptions,
  listNodes,
  replaceGraph,
  stats,
  sweepOrphanMaterials,
  type GraphNodeInput,
  type MaterialRow,
} from './db.js';
import { emit, subscribe } from './events.js';
import { exportToVault, renderMarkdown } from './export.js';
import { ACCEPTED, describe, ingestMaterial, materialsSection, MAX_FILE_BYTES } from './materials.js';
import { addNotice, takeNotices } from './notices.js';
import { firstTurnPrompt, materialAttachedPrompt, reviewTurnPrompt } from './prompt.js';
import { answerPrompt, cancelPending, hasPending, pendingId } from './prompts.js';

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
app.use('/api/*', cors());

/** External (Claude Code) lessons are "busy" from turn_start until the Stop hook posts turn_end. */
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

app.get('/api/health', (c) => c.json({ ok: true, version: '0.2.0' }));
app.get('/api/stats', (c) => c.json({ ...stats(), due: dueNodes().length, vault: !!VAULT_DIR }));

app.get('/api/lessons', (c) =>
  c.json(
    listLessons().map((l) => {
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
  const body = (await c.req.json().catch(() => ({}))) as { topic?: string; materials?: string[] };
  const topic = body.topic?.trim();
  if (!topic) return c.json({ error: 'topic required' }, 400);
  const lesson = createLesson(randomUUID(), topic);
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
    // Companion mode: the conversation lives in the terminal. Keep the note
    // in the log so the export and the graph stay one record.
    emit(id, 'user', { text, source: 'browser' });
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
  if (lesson && materials.length) {
    for (const m of materials) emit(lesson.id, 'material', materialEvent(m));
    const prompt = materialAttachedPrompt(materials.map(describe).join('; '));
    // Mid-lesson: tell the tutor now if it is idle, otherwise on the result of the card it is waiting on.
    if (lesson.mode === 'agent' && !isBusy(lesson.id)) void runTurn(lesson.id, prompt).catch((e) => console.error('[turn]', e));
    else addNotice(lesson.id, prompt);
  }
  if (!materials.length) return c.json({ error: errors.map((e) => `${e.name}: ${e.error}`).join('; '), errors }, 422);
  return c.json({ materials, errors }, 201);
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

// ---------- review ----------

app.get('/api/review', (c) => c.json(dueNodes()));

app.post('/api/review', async (c) => {
  const due = dueNodes();
  if (!due.length) return c.json({ error: 'nothing due' }, 400);
  const picked = due.slice(0, 6);
  const lesson = createLesson(randomUUID(), `Review · ${picked.map((n) => n.label).join(', ')}`);
  replaceGraph(
    lesson.id,
    picked.map((n) => ({ id: n.node_id, label: n.label, kind: n.kind as 'truth' | 'derived' | 'goal', summary: n.summary ?? undefined, depends_on: [] })),
  );
  void runTurn(lesson.id, reviewTurnPrompt(picked)).catch((e) => console.error('[turn]', e));
  return c.json(lesson, 201);
});

// ---------- atlas + learner profile ----------

app.get('/api/atlas', (c) => {
  const now = Date.now();
  return c.json({
    nodes: allNodes().map((n) => ({
      ...n,
      depends_on: JSON.parse(n.depends_on || '[]') as string[],
      due: n.status === 'locked' && !!n.review_at && n.review_at <= now,
    })),
    lessons: listLessons().map((l) => ({ id: l.id, topic: l.topic, goal: l.goal, phase: l.phase, mode: l.mode, created_at: l.created_at })),
    misconceptions: listMisconceptions(),
    due: dueNodes(),
  });
});

app.get('/api/profile', (c) => c.json(actions.profile()));

// ---------- external lessons (Claude Code plugin) ----------

app.post('/api/external/lessons', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { topic?: string; materials?: string[] };
  const topic = body.topic?.trim();
  if (!topic) return c.json({ error: 'topic required' }, 400);
  const lesson = createLesson(randomUUID(), topic, 'external');
  const materials = Array.isArray(body.materials) && body.materials.length ? bindMaterials(lesson.id, body.materials) : [];
  for (const m of materials) emit(lesson.id, 'material', materialEvent(m));
  emit(lesson.id, 'turn_start', { source: 'claude-code' });
  return c.json({ ...lesson, materials, url: `${baseUrl(c.req.url)}/lesson/${lesson.id}` }, 201);
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
  return c.json({ ...l, url: `${baseUrl(c.req.url)}/lesson/${l.id}`, pending: pendingId(l.id) });
});

/** External lessons have no prompt of ours to prepend notices to, so they ride along on the next tool result. */
const withNotices = <T>(lessonId: string, result: T): T => {
  const n = takeNotices(lessonId);
  return n.length && result && typeof result === 'object' ? { ...result, notice: n.join('\n') } : result;
};

/** Run a tutor action for an external lesson. Blocking actions long-poll until the learner answers. */
app.post('/api/external/lessons/:id/:action', async (c) => {
  const id = c.req.param('id');
  const action = c.req.param('action');
  const lesson = getLesson(id);
  if (!lesson) return c.json({ error: 'not found' }, 404);
  const a = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    switch (action) {
      case 'quiz': {
        const gap = teachingGap(id, a as { node_id?: string; already_held?: boolean });
        if (gap) return c.json({ error: gap }, 400);
        return c.json(withNotices(id, await actions.quiz(id, a as unknown as actions.QuizArgs)));
      }
      case 'ask':
        return c.json(withNotices(id, await actions.ask(id, a as { question: string; options?: string[] })));
      case 'set_plan':
        return c.json(withNotices(id, await actions.setPlan(id, a as { goal: string; nodes: GraphNodeInput[] })));
      case 'node_status':
        return c.json(withNotices(id, actions.nodeStatus(id, a as { id: string; status: 'teaching' | 'locked' | 'shaky' })));
      case 'set_phase':
        return c.json(withNotices(id, actions.phase(id, a as { phase: 'probe' | 'plan' | 'teach' })));
      case 'explain_back':
        return c.json(withNotices(id, await actions.explainBack(id, a as { prompt: string; rubric: string; node_id?: string })));
      case 'remember':
        return c.json(actions.remember(id, a as { fact: string; kind?: 'learner' | 'preference' | 'strength' | 'gap' }));
      case 'read_material':
        return c.json(actions.readMaterial(id, a as { name?: string; from?: number; to?: number }));
      case 'search_material':
        return c.json(actions.searchMaterial(id, a as { query: string; name?: string; limit?: number }));
      case 'mirror': {
        // The plugin's hooks post transcript text here.
        const { role, text, uid, at } = a as { role: 'assistant' | 'user'; text: string; uid?: string; at?: number };
        if (!text?.trim()) return c.json({ ok: true, skipped: true });
        // `at` is the transcript timestamp: the UI orders by it, so prose that
        // preceded a quiz in the terminal renders before the card even when the
        // hook delivered it later.
        if (role === 'user') emit(id, 'user', { text, source: 'terminal', at });
        else emit(id, 'assistant', { id: uid ?? randomUUID(), text, source: 'terminal', at });
        return c.json({ ok: true });
      }
      case 'end':
        cancelPending(id);
        emit(id, 'turn_end', { ok: true, source: 'claude-code' });
        return c.json({ ok: true });
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
});
