import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { streamSSE } from 'hono/streaming';
import { answerPrompt, hasPending, interrupt, isBusy, runTurn } from './agent.js';
import { PORT, VAULT_DIR } from './config.js';
import {
  createLesson,
  deleteLesson,
  dueNodes,
  getLesson,
  listEvents,
  listLessons,
  listNodes,
  replaceGraph,
  stats,
} from './db.js';
import { subscribe } from './events.js';
import { exportToVault, renderMarkdown } from './export.js';
import { firstTurnPrompt, reviewTurnPrompt } from './prompt.js';

const app = new Hono();
app.use('/api/*', cors());

const lessonView = (id: string) => {
  const lesson = getLesson(id);
  if (!lesson) return null;
  return { lesson, nodes: listNodes(id), busy: isBusy(id), pending: hasPending(id) };
};

app.get('/api/health', (c) => c.json({ ok: true }));
app.get('/api/stats', (c) => c.json({ ...stats(), due: dueNodes().length, vault: !!VAULT_DIR }));

app.get('/api/lessons', (c) =>
  c.json(
    listLessons().map((l) => {
      const nodes = listNodes(l.id);
      return { ...l, nodes: nodes.length, locked: nodes.filter((n) => n.status === 'locked').length, busy: isBusy(l.id) };
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

    // Replay history, then subscribe for live events. Small race window is
    // acceptable: the client reconciles by seq.
    for (const ev of listEvents(id)) if (ev.seq > after) await send(ev);
    await send({ seq: -1, type: 'ready', payload: { busy: isBusy(id), pending: hasPending(id) }, ts: Date.now() });

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
  if (!getLesson(id)) return c.json({ error: 'not found' }, 404);
  const body = (await c.req.json().catch(() => ({}))) as { text?: string };
  const text = body.text?.trim();
  if (!text) return c.json({ error: 'text required' }, 400);
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

app.get('/api/review', (c) => c.json(dueNodes()));

app.post('/api/review', async (c) => {
  const due = dueNodes();
  if (!due.length) return c.json({ error: 'nothing due' }, 400);
  const picked = due.slice(0, 6);
  const lesson = createLesson(randomUUID(), `Review · ${picked.map((n) => n.label).join(', ')}`);
  // Copy the reviewed nodes into the review lesson so node_status can reschedule them.
  replaceGraph(
    lesson.id,
    picked.map((n) => ({ id: n.node_id, label: n.label, kind: n.kind as 'truth' | 'derived' | 'goal', summary: n.summary ?? undefined, depends_on: [] })),
  );
  void runTurn(lesson.id, reviewTurnPrompt(picked)).catch((e) => console.error('[turn]', e));
  return c.json(lesson, 201);
});

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
