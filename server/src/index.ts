import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono, type Context } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { cors } from 'hono/cors';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import * as actions from './actions.js';
import { interrupt, isBusy, runTurn } from './agent.js';
import { backend, backendSource } from './backend.js';
import { ensureToken, matchesSession, matchesToken, sessionValue } from './credentials.js';
import { ALLOWED_ORIGINS, DERIVE_ORIGINS, HOST, HOST_IS_LOOPBACK, PORT, TOKEN_PATH, VAULT_DIR, VERSION } from './config.js';
import {
  allNodes,
  bindMaterials,
  buildReviewGraph,
  buildWarmup,
  closeOpenTurns,
  createLearner,
  createLesson,
  DEFAULT_LEARNER_ID,
  deleteLearner,
  deleteLesson,
  deleteMaterial,
  dueNodes,
  endTurn,
  findLearner,
  getLearner,
  getLesson,
  getMaterial,
  lastExternalLesson,
  lastTurn,
  listEvents,
  listLearners,
  listLessons,
  listMaterials,
  listMisconceptions,
  listNodes,
  renameLearner,
  updateLearnerPrefs,
  setAnswerIn,
  startTurn,
  stats,
  sweepOrphanMaterials,
  turnStatusOf,
  type GraphNodeInput,
  type MaterialRow,
} from './db.js';
import { emit, subscribe } from './events.js';
import { exportToVault, renderMarkdown } from './export.js';
import { addResource, deleteResource, editResource, getResource, isKind, librarySection, listResources, publicRow, refetchResource, RESOURCE_KINDS, segmentsOf, tagCounts } from './library.js';
import { ACCEPTED, describe, ingestMaterial, ingestRepo, materialsSection, MAX_FILE_BYTES } from './materials.js';
import { addNotice, takeNotices } from './notices.js';
import { firstTurnPrompt, materialAttachedPrompt, reviewTurnPrompt, warmupBrief } from './prompt.js';
import { answerPrompt, cancelPending, hasPending, pendingId, pendingPrompt, type PromptKind } from './prompts.js';
import { registerSecret, safeMessage } from './secrets.js';
import { shapeFor, toolsFor } from './tools.js';

/**
 * A restart kills in-flight turns without a turn_end. Close them on boot so
 * the page is not stuck on "busy" and a stale card is shown as such. One write
 * over the turns table, rather than a walk of every event of every lesson; the
 * lessons the sweep closed are exactly the ones still owed a turn_end event.
 */
for (const t of closeOpenTurns('interrupted')) {
  if (getLesson(t.lesson_id)?.mode === 'agent') emit(t.lesson_id, 'turn_end', { ok: true, interrupted: true, reason: 'server restarted' });
}

/**
 * What `ensureToken()` returned at start. Not a credential: it is compared
 * against nothing, and no check on any route consults it. It exists for one
 * purpose — the startup line prints the link that signs a browser in, and a
 * browser cannot read the 0600 file. Every credential check reads the file
 * live instead (server/src/credentials.ts), behind a one-second cache, which
 * is what makes deleting or rotating that file a revocation on a running
 * server. Keeping a second, boot-frozen copy of the same value beside the live
 * read is the defect this replaced; this one is kept because it is not that
 * value's comparison, it is a string in a log line.
 */
const BOOT_TOKEN = ensureToken();

/** The cookie the derived credential rides in. */
const SESSION_COOKIE = 'derive_session';

/** How long that cookie stays good for: long enough that a learner coming back after a holiday is not locked out mid-lesson, short enough that a browser profile nobody opens again does not carry a working credential indefinitely. */
const SESSION_MAX_AGE_S = 30 * 24 * 60 * 60;

// Registered before a single route exists, so no request can be served while either value is still able to reach an error, a log line or a lesson note. Every later read registers whatever it newly sees, so a rotated-in token is covered the same way.
registerSecret(BOOT_TOKEN);
registerSecret(sessionValue());

/** The four spellings of loopback a client may legitimately use. */
const LOOPBACK_NAMES = ['localhost', '127.0.0.1', '::1', '[::1]'];

/** Names that are never how a client addresses a server, whatever the bind. Admitting one is exactly how a literal bind string let a forged Host through. */
const UNSPECIFIED_NAMES = new Set(['', '0.0.0.0', '::', '[::]']);

/** True when an address is loopback, which is 127.0.0.0/8 and ::1 — the case where the browser is on this machine. */
const isLoopback = (addr: string) => addr === '::1' || addr.startsWith('127.');

/**
 * The address this connection was accepted on, which is the only honest
 * answer to "what is this server called here". The Node adapter hands the
 * original IncomingMessage through c.env; a bind of 0.0.0.0 answers on many
 * addresses, and the configured string names none of them. Normalised:
 * lowercased, unbracketed, and with the IPv4-mapped prefix stripped so a
 * dual-stack listener reports an IPv4 connection in its IPv4 form.
 */
function localAddress(c: Context): string | undefined {
  const raw = (c.env as { incoming?: { socket?: { localAddress?: string } } } | undefined)?.incoming?.socket?.localAddress;
  if (!raw) return undefined;
  const addr = raw.trim().toLowerCase().replace(/^\[/, '').replace(/\]$/, '').replace(/^::ffff:/, '');
  return addr || undefined;
}

/**
 * The names this connection may legitimately address this server by: the
 * address it actually arrived on, plus every spelling of loopback when that
 * address is loopback, plus whatever DERIVE_ORIGINS names — the documented
 * way to reach a widened server by a name rather than an address (D-12).
 * Deliberately not the four built-in loopback origins: adding those would
 * put 127.0.0.1 back in the set on a LAN connection, which is the forged
 * loopback Host this is here to refuse.
 *
 * With no address to go on there is no name this connection may legitimately
 * use, so the set is empty and guardLocal refuses. Returning the loopback
 * names there would have been the permissive answer, not the closed one:
 * every spelling of loopback is exactly the forged Host a widened bind exists
 * to reject. The consequence is worth stating plainly — a runtime that does
 * not expose the connection's local address would make this server answer
 * nothing at all. That is the correct failure for a check whose whole purpose
 * is to refuse names it cannot justify, and the suite is the standing signal
 * that the address is there under @hono/node-server: every case in it goes
 * through this function, so an unavailable address turns the whole suite red
 * rather than leaving a hole open.
 */
function hostNames(c: Context): Set<string> {
  const addr = localAddress(c);
  if (!addr) return new Set<string>();
  const names = new Set<string>([addr]);
  if (addr.includes(':')) names.add(`[${addr}]`);
  if (isLoopback(addr)) for (const n of LOOPBACK_NAMES) names.add(n);
  for (const o of DERIVE_ORIGINS) {
    try {
      names.add(new URL(o).hostname.toLowerCase());
    } catch {
      /* not a URL */
    }
  }
  return names;
}

/** The host and the port a Host header names, keeping an IPv6 literal's brackets. Empty parts when it is not a Host header at all. */
function splitHost(raw: string): { host: string; port: string } {
  const m = /^(\[[^\]]+\]|[^:]*)(?::(\d+))?$/.exec(raw.trim());
  return m ? { host: m[1].toLowerCase(), port: m[2] ?? '' } : { host: '', port: '' };
}

/** A credential a request offers, or an empty string when it offered none. Whitespace-only is absent, never something to compare. */
const offered = (raw: string | undefined) => (raw ?? '').trim();

const app = new Hono();
app.use('/api/*', cors({ origin: ALLOWED_ORIGINS, allowHeaders: ['content-type', 'x-derive-learner', 'x-derive-token'] }));

/**
 * Is this request even addressed to this server, from somewhere allowed?
 *
 * The two checks every route shares, in a fixed order so a request that
 * fails both this and the credential check is refused 403 rather than 401.
 * The Host header must name this server on its own port — the address the
 * connection actually arrived on, never the configured bind string — which
 * is what defeats a DNS rebind that keeps the origin plausible and a forged
 * loopback name arriving from the network. The unspecified addresses are
 * refused as names first, whatever the bind, because no client addresses a
 * server by one. A browser omits the port when it is the scheme's default, so
 * an absent port part is judged as that default — 80, for the plain http this
 * server speaks — rather than refused outright, which would turn PORT=80 into
 * a server no browser can address; a port that is present still has to match
 * exactly. Then an Origin, when the browser sends one, must match the
 * allowlist whole (a same-origin fetch, curl and the stdio MCP proxy send
 * none, so an absent Origin passes). Returns the refusal, or null when both
 * pass.
 */
function guardLocal(c: Context): Response | null {
  const here = localAddress(c);
  const { host, port } = splitHost(c.req.header('host') ?? '');
  if (UNSPECIFIED_NAMES.has(host) || !hostNames(c).has(host) || (port || '80') !== String(PORT)) {
    return c.json({ error: `derive answers on ${here ?? 'this machine'} at port ${PORT}, and a request has to name it` }, 403);
  }

  const origin = c.req.header('origin');
  if (origin && !ALLOWED_ORIGINS.includes(origin)) return c.json({ error: `origin ${origin} is not allowed to call derive` }, 403);

  return null;
}

/**
 * Only this machine, and only Derive's own app.
 *
 * Everything the API can do — read every lesson, import any readable folder
 * as course material, fetch a URL — used to be open to any process or any
 * page that could reach the port. The checks close that, in order: the shared
 * Host and Origin guard, which every route runs, health included, because a
 * page that reached the port by a rebind must not read the version and the
 * backend either; then a credential, which health alone is exempt from,
 * because the doctor and the test harnesses poll it before there is anything
 * to authenticate with. Two credentials are accepted and either is enough —
 * the x-derive-token header, which is how the MCP server, the plugin hook and
 * the Vite dev proxy call in; and the browser's derive_session cookie, which
 * is the derived value and not the token. The token was also accepted as a
 * query parameter on the lesson stream until the browser stopped needing it:
 * a credential in a URL comes to rest in server logs, browser history and
 * Referer, and that term carried one on every reconnect for the life of a
 * lesson. The document handoff keeps its query parameter for the opposite
 * reason — it exists so the credential does not come to rest, and its 302
 * drops it on the first response. An empty or whitespace-only value is
 * absent, never something to compare.
 *
 * Both credentials are compared against the token file as it is now, read
 * live behind a one-second cache (server/src/credentials.ts), not against a
 * value this process read at boot. This middleware and the document one
 * below are the only two places that property is enforced, which is why it
 * is written at both: deleting or rotating that file signs every browser and
 * every header caller out within a second, without restarting derive.
 */
app.use('/api/*', async (c, next) => {
  const refusal = guardLocal(c);
  if (refusal) return refusal;

  if (c.req.path === '/api/health') return next();

  const header = offered(c.req.header('x-derive-token'));
  const cookie = offered(getCookie(c, SESSION_COOKIE));
  const ok = matchesToken(header) || matchesSession(cookie);
  if (!ok) return c.json({ error: `send the x-derive-token header, with the token in ${TOKEN_PATH}` }, 401);

  return next();
});

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

/**
 * External (Claude Code) lessons are "busy" from the moment their turn opens
 * until the Stop hook posts the end of it, and while a card is open. Every
 * lesson of every listing asks this, so it is one indexed read of the lesson's
 * most recent turn rather than a scan of its whole event log.
 */
const busy = (id: string) => {
  if (isBusy(id)) return true;
  const lesson = getLesson(id);
  if (lesson?.mode !== 'external') return false;
  if (hasPending(id)) return true;
  return lastTurn(id)?.status === 'running';
};

const lessonView = (id: string) => {
  const lesson = getLesson(id);
  if (!lesson) return null;
  return { lesson, nodes: listNodes(id), materials: listMaterials(id), busy: busy(id), pending: hasPending(id) };
};

sweepOrphanMaterials();

app.get('/api/health', (c) => c.json({ ok: true, version: VERSION, backend: backend(), backend_source: backendSource() }));
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
    return c.json({ error: safeMessage(e) }, 400);
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
    return c.json({ error: safeMessage(e) }, 400);
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
    return c.json({ error: safeMessage(e) }, 400);
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
  // Review before new work: the due nodes most likely forgotten come first, as copies whose lock reschedules the original.
  const warmup = buildWarmup(lesson.id, lesson.learner_id);
  if (warmup.length) emit(lesson.id, 'warmup', { nodes: warmup.map((n) => ({ id: n.review_id, label: n.label, topic: n.topic })) });
  void runTurn(lesson.id, firstTurnPrompt(topic, materials.map(describe), warmup)).catch((e) => console.error('[turn]', safeMessage(e)));
  return c.json({ ...lesson, materials, warmup: warmup.length }, 201);
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
  void runTurn(id, text, { echoUser: text }).catch((e) => console.error('[turn]', safeMessage(e)));
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
  if (lesson.mode === 'agent' && !isBusy(lesson.id)) void runTurn(lesson.id, prompt).catch((e) => console.error('[turn]', safeMessage(e)));
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
    return c.json({ error: `could not read the upload: ${safeMessage(e)}` }, 400);
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
      errors.push({ name: f.name, error: safeMessage(e) });
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
    return c.json({ error: safeMessage(e) }, 422);
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

const err = (c: Context, e: unknown, status: 400 | 404 | 422 | 500 = 400) => c.json({ error: safeMessage(e) }, status);

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
  void runTurn(started.lesson.id, reviewTurnPrompt(started.graph.due)).catch((e) => console.error('[turn]', safeMessage(e)));
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
    return c.json({ error: safeMessage(e) }, 400);
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
    startTurn(started.lesson.id, driver);
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
  const warmup = buildWarmup(lesson.id, lesson.learner_id);
  if (warmup.length) emit(lesson.id, 'warmup', { nodes: warmup.map((n) => ({ id: n.review_id, label: n.label, topic: n.topic })) });
  startTurn(lesson.id, driver);
  emit(lesson.id, 'turn_start', { source: driver });
  return c.json(
    {
      ...lesson,
      materials,
      url: `${baseUrl(c.req.url)}/lesson/${lesson.id}`,
      library: librarySection(lesson.learner_id, topic),
      ...(warmup.length ? { warmup: warmupBrief(warmup) } : {}),
    },
    201,
  );
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

/**
 * The registry's own shape decides what a valid body is, before any method
 * logic runs: a bad argument is a 400 naming the tool, the field and what was
 * wrong, not a half-applied write. Nothing is repaired on the way in — no
 * default, no coercion, no trimming — because the tool rejection rate per
 * provider is only worth measuring if the route rejects honestly.
 *
 * The parse is not strict-mode rejection: unknown keys are dropped from the
 * validated value rather than refused, so the keys the route reads for itself
 * (answer_in, already_held, prompt_id) still arrive and are read off the raw
 * body, by name, where they are needed.
 */
const ACTION_SCHEMAS = new Map(toolsFor('http').map((s) => [s.name, z.object(shapeFor(s, 'http'))]));

/** The body an action may act on, or the sentence to hand back as a 400. An action with no tool behind it validates to itself. */
function validateAction(action: string, body: Record<string, unknown>): { error: string | null; value: Record<string, unknown> } {
  const schema = ACTION_SCHEMAS.get(action);
  if (!schema) return { error: null, value: body };
  const parsed = schema.safeParse(body);
  if (parsed.success) return { error: null, value: parsed.data as Record<string, unknown> };
  const issue = parsed.error.issues[0];
  return { error: `${action}: ${issue.path.join('.') || '(body)'}: ${issue.message}`, value: body };
}

/** Run a tutor action for an external lesson. Blocking actions long-poll until the learner answers, or return at once in terminal mode. */
app.post('/api/external/lessons/:id/:action', async (c) => {
  const id = c.req.param('id');
  const action = c.req.param('action');
  const lesson = getLesson(id);
  if (!lesson) return c.json({ error: 'not found' }, 404);
  const a = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  // Before the held-card 409 and before the teach gate: a malformed body is not
  // a method refusal and must not be dressed up as one. `v` is what the tool
  // shape proved; `a` is still the place to read the route's own keys from.
  const { error: invalid, value: v } = validateAction(action, a);
  if (invalid) return c.json({ error: invalid }, 400);
  const terminal = a.answer_in === 'terminal' || (a.answer_in !== 'browser' && lesson.answer_in === 'terminal');
  try {
    if (terminal && (action === 'quiz' || action === 'ask' || action === 'set_plan' || action === 'explain_back') && held.get(id) && !held.get(id)!.settled) {
      return c.json({ error: `A card is already open (${held.get(id)!.kind}). Wait for the learner's reply and pass it to \`answer\` before asking anything else.` }, 409);
    }
    switch (action) {
      case 'quiz': {
        // The cast names what the shape already proved; the enum, option-count
        // and correct-index checks that used to live here are the schema's now.
        const args = v as unknown as actions.QuizArgs;
        const gate = { node_id: args.node_id ?? undefined, already_held: a.already_held === true };
        // A pretest comes before the teaching by design; only the check that locks a node needs prose before it.
        let gap = args.purpose === 'pretest' ? null : teachingGap(id, gate);
        if (gap) {
          // The prose that precedes this call may still be in flight (Codex mirrors messages whole, and the tool call can arrive first). One short grace period.
          await new Promise((r) => setTimeout(r, 600));
          gap = teachingGap(id, gate);
        }
        if (gap) return c.json({ error: gap }, 400);
        if (terminal) {
          const open = actions.openQuiz(id, args, { hold: true });
          return c.json(withNotices(id, holdCard(id, 'quiz', open, { question: args.question, options: args.options, multi: args.correct.length > 1, purpose: args.purpose ?? undefined, tests: args.tests ?? undefined }, args.options.length, nodeLabelOf(id, args.node_id))));
        }
        return c.json(withNotices(id, await actions.quiz(id, args)));
      }
      case 'ask': {
        const args = v as { question: string; options?: string[] };
        if (terminal) {
          const open = actions.openAsk(id, args, { hold: true });
          return c.json(withNotices(id, holdCard(id, 'ask', open, { question: args.question, options: args.options ?? [] }, args.options?.length ?? 0)));
        }
        return c.json(withNotices(id, await actions.ask(id, args)));
      }
      case 'set_plan': {
        const args = v as unknown as { goal: string; nodes: GraphNodeInput[] };
        if (terminal) {
          const open = actions.openPlan(id, args, { hold: true });
          return c.json(withNotices(id, holdCard(id, 'plan', open, { goal: args.goal, nodes: args.nodes }, 0)));
        }
        return c.json(withNotices(id, await actions.setPlan(id, args)));
      }
      case 'explain_back': {
        const args = v as { prompt: string; rubric: string; node_id?: string };
        if (terminal) {
          const open = actions.openExplain(id, args, { hold: true });
          return c.json(withNotices(id, holdCard(id, 'explain', open, { prompt: args.prompt }, 0, nodeLabelOf(id, args.node_id))));
        }
        return c.json(withNotices(id, await actions.explainBack(id, args)));
      }
      case 'answer': {
        // The learner's terminal reply for the open card (or the result of a browser answer, once).
        const h = held.get(id);
        const reply = String(v.reply ?? '').trim();
        if (!h || (v.prompt_id && v.prompt_id !== h.id)) {
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
        // The enum in the tool's own shape is what rejects anything else, above.
        const where = v.where as 'browser' | 'terminal';
        setAnswerIn(id, where);
        emit(id, 'answer_in', { where });
        return c.json({ ok: true, answer_in: where });
      }
      case 'node_status': {
        const r = actions.nodeStatus(id, v as { id: string; status: 'teaching' | 'locked' | 'shaky' });
        return c.json(withNotices(id, r), r.refused ? 400 : 200);
      }
      case 'set_phase':
        return c.json(withNotices(id, actions.phase(id, v as { phase: 'probe' | 'plan' | 'teach' })));
      case 'remember':
        return c.json(actions.remember(id, v as { fact: string; kind?: 'learner' | 'preference' | 'strength' | 'gap' }));
      case 'set_preferences':
        return c.json(actions.setPreferences(id, v as Parameters<typeof actions.setPreferences>[1]));
      case 'read_material':
        return c.json(actions.readMaterial(id, v as { name?: string; path?: string; from?: number; to?: number }));
      case 'search_material':
        return c.json(actions.searchMaterial(id, v as { query: string; name?: string; limit?: number }));
      case 'search_library':
        return c.json(actions.searchLibrary(id, v as { query: string; kind?: string; tag?: string; limit?: number }));
      case 'read_resource':
        return c.json(actions.readResource(id, v as { id?: string; title?: string; from?: number; to?: number }));
      case 'suggest_resource':
        return c.json(withNotices(id, actions.suggestResource(id, v as { id?: string; title?: string; why: string; where?: string; node_id?: string })));
      case 'add_resource':
        return c.json(withNotices(id, await actions.saveResource(id, v as { url?: string; title?: string; kind?: string; author?: string; note?: string; tags?: unknown })));
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
        const payload = { ok: true, source: lesson.driver ?? 'claude-code', held: h && !h.settled ? h.id : null };
        const turn = lastTurn(id);
        if (turn) {
          // The terminal ran the model; nothing about the requests it made
          // reaches this process. The turn is closed with an honest blank —
          // null counts, cost_source 'unknown' — rather than a guess. Both
          // halves land in one transaction, so a crash between them is not a
          // state the sweep would have to reach and could not.
          endTurn(turn.id, turnStatusOf(payload));
        }
        emit(id, 'turn_end', payload);
        return c.json({ ok: true });
      }
      default:
        return c.json({ error: `unknown action ${action}` }, 400);
    }
  } catch (e) {
    return c.json({ error: safeMessage(e) }, 500);
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
  // serveStatic resolves its root against process.cwd(), so this is the path from wherever the server was started, whatever that is.
  const relRoot = relative(process.cwd(), distDir).split(sep).join('/') || '.';
  /**
   * The app is handed its credential in one place and nowhere else: the
   * one-time handoff in the document middleware below, as an HttpOnly,
   * SameSite=Strict cookie on the 302 that drops the token from the URL. The
   * value is derived from the install token and is never the token. It is
   * never written into the markup, because markup that can be fetched is a
   * secret that can be scraped — which is exactly what the injection this
   * replaces turned out to be. A hostile page has nothing to call and
   * nothing to read.
   */
  const indexPath = join(distDir, 'index.html');
  const rawIndex = readFileSync(indexPath, 'utf8');

  /**
   * Hand this browser the derived credential. No `secure`, or the browser
   * drops a cookie delivered over plain http on loopback; a stated lifetime
   * rather than none, so the learner-facing sentences about opening the link
   * once are true and a closed browser is not a lockout.
   *
   * What makes that lifetime defensible is revocation, and it is worth
   * writing down because no learner could infer it: the value is
   * HMAC-SHA256 of the install token, and every check reads that file live
   * behind a one-second cache, so deleting or rotating it invalidates every
   * cookie ever issued within a second, without restarting derive — no code
   * change and no per-session bookkeeping.
   *
   * The value is taken from `sessionValue()` rather than from a constant read
   * at boot, so the mint and the check have one source: a browser signing in
   * a second after a rotation is handed a cookie the next request accepts
   * rather than one it refuses.
   *
   * The honest cost: a rotation also signs out the long-running stdio MCP
   * server and the plugin hook until each is restarted, because each reads
   * the token file once at its own start.
   */
  function issueSession(c: Context) {
    setCookie(c, SESSION_COOKIE, sessionValue(), { httpOnly: true, sameSite: 'Strict', path: '/', maxAge: SESSION_MAX_AGE_S });
  }

  /** The app, exactly as it is on disk. The cookie that lets it call the API was set by the handoff that let this request past the middleware, so serving is only serving. */
  function serveApp(c: Context) {
    return c.html(rawIndex);
  }

  /**
   * Reaching the port is not a credential. The token in the 0600 file is.
   *
   * One place covers both document routes, serveStatic and the catch-all;
   * /api/* has its own middleware with its own credential step and passes
   * straight through here. A browser presents the install token once, in the
   * URL, and is answered with a 302 to the same path with the query string
   * dropped, so the token does not come to rest in the history; afterwards it
   * holds only the HttpOnly cookie, which is what the whole API runs on. A
   * browser cannot read the token file, so the learner opens the app from the
   * link the startup line prints.
   *
   * Loopback and a widened bind take the identical path, which is why there
   * is no branch left here to get the polarity of wrong: the document routes
   * and /api/* run the same guardLocal, so the Host and Origin check has one
   * implementation and one polarity rather than two to keep in step. A
   * request that arrived on an address this process cannot name is refused by
   * that guard, and one that passes it still has to present a credential.
   *
   * The cookie and the token are both compared against the token file as it
   * is now, read live behind a one-second cache, so deleting or rotating that
   * file refuses every browser here within a second, without restarting
   * derive. The order is unchanged and is what a reader should be able to
   * rely on: the cookie, then the install token, then the one-time ticket.
   */
  app.use('/*', async (c, next) => {
    if (c.req.path.startsWith('/api/')) return next();
    const refusal = guardLocal(c);
    if (refusal) return refusal;

    const cookie = offered(getCookie(c, SESSION_COOKIE));
    if (matchesSession(cookie)) return next();

    const presented = offered(c.req.header('x-derive-token')) || offered(c.req.query('token'));
    if (matchesToken(presented)) {
      issueSession(c);
      // A caller-supplied path is not a Location: resolving it against a fixed base collapses a protocol-relative "//elsewhere" to a path on this server and percent-encodes a control character that would otherwise split the header.
      return c.redirect(new URL(c.req.path, 'http://127.0.0.1').pathname, 302);
    }

    return c.json({ error: `open this page once as ${c.req.path}?token=<the token in ${TOKEN_PATH}> to let this browser in` }, 401);
  });
  // Ahead of serveStatic, which resolves "/" against the folder rather than the index this server holds in memory.
  app.get('/', serveApp);
  app.get('/index.html', serveApp);
  app.use('/*', serveStatic({ root: relRoot }));
  app.get('*', serveApp);
}

serve({ fetch: app.fetch, port: PORT, hostname: HOST }, (info) => {
  // The learner's next step is a link, not a lookup: a browser cannot read the 0600 token file, so the one-time handoff URL is printed where they already are.
  console.log(
    existsSync(distDir)
      ? `derive server on http://localhost:${info.port}/?token=${BOOT_TOKEN} — open that link once; the token drops out of the URL and a cookie keeps that browser signed in for 30 days. To sign in again, or in another browser, open the same link: it is printed every time the server starts, and the token in it is the one in ${TOKEN_PATH}`
      : `derive server on http://localhost:${info.port} (API only; run the web dev server too)`,
  );
  console.log(`tutor runs on ${backend() === 'codex' ? 'Codex (your ChatGPT login)' : 'Claude (your Claude Code login)'}${backendSource() === 'auto' ? ', picked automatically; set DERIVE_BACKEND to choose' : ''}`);
  // D-12: binding wider than loopback is a deliberate choice, and it says exactly what it opened and what still holds.
  if (!HOST_IS_LOOPBACK) {
    console.warn(
      `[derive] DERIVE_HOST=${HOST}: every device that can reach this machine on port ${info.port} can reach your lessons, your library and the folders derive can read. ` +
        `Host is checked against the address each request actually arrived on, so a request from the network naming 127.0.0.1 is refused. ` +
        `Every browser, on this machine or another device, opens the page once with ?token=<the token in ${TOKEN_PATH}> and holds a cookie for 30 days afterwards; deleting or rotating that file signs all of them out within a second, without restarting derive. ` +
        `Everything else sends that token as the x-derive-token header. Browser origins allowed: ${ALLOWED_ORIGINS.join(', ')} (add more with DERIVE_ORIGINS).`,
    );
  }
});
