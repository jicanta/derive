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
  createLesson,
  deleteLesson,
  dueNodes,
  getLesson,
  lastExternalLesson,
  listEvents,
  listLessons,
  listMisconceptions,
  listNodes,
  replaceGraph,
  stats,
  type GraphNodeInput,
} from './db.js';
import { emit, subscribe } from './events.js';
import { exportToVault, renderMarkdown } from './export.js';
import { firstTurnPrompt, reviewTurnPrompt } from './prompt.js';
import { answerPrompt, cancelPending, hasPending, pendingId } from './prompts.js';

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
  return { lesson, nodes: listNodes(id), busy: busy(id), pending: hasPending(id) };
};

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
  const body = (await c.req.json().catch(() => ({}))) as { topic?: string };
  const topic = body.topic?.trim();
  if (!topic) return c.json({ error: 'topic required' }, 400);
  const lesson = createLesson(randomUUID(), topic);
  void runTurn(lesson.id, firstTurnPrompt(topic)).catch((e) => console.error('[turn]', e));
  return c.json(lesson, 201);
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
  if (isBusy(id)) return c.json({ error: 'busy' }, 409);
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
  const body = (await c.req.json().catch(() => ({}))) as { topic?: string };
  const topic = body.topic?.trim();
  if (!topic) return c.json({ error: 'topic required' }, 400);
  const lesson = createLesson(randomUUID(), topic, 'external');
  emit(lesson.id, 'turn_start', { source: 'claude-code' });
  return c.json({ ...lesson, url: `${baseUrl(c.req.url)}/lesson/${lesson.id}` }, 201);
});

app.get('/api/external/active', (c) => {
  const l = lastExternalLesson();
  if (!l) return c.json({ error: 'no external lesson' }, 404);
  return c.json({ ...l, url: `${baseUrl(c.req.url)}/lesson/${l.id}`, pending: pendingId(l.id) });
});

/** Run a tutor action for an external lesson. Blocking actions long-poll until the learner answers. */
app.post('/api/external/lessons/:id/:action', async (c) => {
  const id = c.req.param('id');
  const action = c.req.param('action');
  const lesson = getLesson(id);
  if (!lesson) return c.json({ error: 'not found' }, 404);
  const a = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    switch (action) {
      case 'quiz':
        return c.json(await actions.quiz(id, a as unknown as actions.QuizArgs));
      case 'ask':
        return c.json(await actions.ask(id, a as { question: string; options?: string[] }));
      case 'set_plan':
        return c.json(await actions.setPlan(id, a as { goal: string; nodes: GraphNodeInput[] }));
      case 'node_status':
        return c.json(actions.nodeStatus(id, a as { id: string; status: 'teaching' | 'locked' | 'shaky' }));
      case 'set_phase':
        return c.json(actions.phase(id, a as { phase: 'probe' | 'plan' | 'teach' }));
      case 'explain_back':
        return c.json(await actions.explainBack(id, a as { prompt: string; rubric: string; node_id?: string }));
      case 'remember':
        return c.json(actions.remember(id, a as { fact: string; kind?: 'learner' | 'preference' | 'strength' | 'gap' }));
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
