import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DATA_DIR, DB_PATH } from './config.js';

mkdirSync(dirname(DB_PATH), { recursive: true });
mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS lessons (
    id TEXT PRIMARY KEY,
    topic TEXT NOT NULL,
    goal TEXT,
    session_id TEXT,
    phase TEXT NOT NULL DEFAULT 'probe',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS events (
    lesson_id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    type TEXT NOT NULL,
    payload TEXT NOT NULL,
    ts INTEGER NOT NULL,
    PRIMARY KEY (lesson_id, seq)
  );
  CREATE TABLE IF NOT EXISTS nodes (
    lesson_id TEXT NOT NULL,
    node_id TEXT NOT NULL,
    label TEXT NOT NULL,
    kind TEXT NOT NULL,
    summary TEXT,
    depends_on TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    locked_at INTEGER,
    review_at INTEGER,
    interval_days REAL NOT NULL DEFAULT 1,
    reps INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (lesson_id, node_id)
  );
  CREATE TABLE IF NOT EXISTS quiz_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lesson_id TEXT NOT NULL,
    node_id TEXT,
    correct INTEGER NOT NULL,
    ts INTEGER NOT NULL
  );
`);

export type Lesson = {
  id: string;
  topic: string;
  goal: string | null;
  session_id: string | null;
  phase: string;
  created_at: number;
  updated_at: number;
};

export type NodeRow = {
  lesson_id: string;
  node_id: string;
  label: string;
  kind: string;
  summary: string | null;
  depends_on: string;
  status: string;
  locked_at: number | null;
  review_at: number | null;
  interval_days: number;
  reps: number;
};

export type StoredEvent = { seq: number; type: string; payload: unknown; ts: number };

const q = {
  insertLesson: db.prepare(
    'INSERT INTO lessons (id, topic, created_at, updated_at) VALUES (?, ?, ?, ?)',
  ),
  getLesson: db.prepare('SELECT * FROM lessons WHERE id = ?'),
  listLessons: db.prepare('SELECT * FROM lessons ORDER BY updated_at DESC'),
  touchLesson: db.prepare('UPDATE lessons SET updated_at = ? WHERE id = ?'),
  setSession: db.prepare('UPDATE lessons SET session_id = ?, updated_at = ? WHERE id = ?'),
  setPhase: db.prepare('UPDATE lessons SET phase = ?, updated_at = ? WHERE id = ?'),
  setGoal: db.prepare('UPDATE lessons SET goal = ?, updated_at = ? WHERE id = ?'),
  deleteLesson: db.prepare('DELETE FROM lessons WHERE id = ?'),
  deleteEvents: db.prepare('DELETE FROM events WHERE lesson_id = ?'),
  deleteNodes: db.prepare('DELETE FROM nodes WHERE lesson_id = ?'),
  deleteQuiz: db.prepare('DELETE FROM quiz_results WHERE lesson_id = ?'),
  nextSeq: db.prepare('SELECT COALESCE(MAX(seq), 0) + 1 AS n FROM events WHERE lesson_id = ?'),
  insertEvent: db.prepare(
    'INSERT INTO events (lesson_id, seq, type, payload, ts) VALUES (?, ?, ?, ?, ?)',
  ),
  listEvents: db.prepare('SELECT seq, type, payload, ts FROM events WHERE lesson_id = ? ORDER BY seq'),
  upsertNode: db.prepare(`
    INSERT INTO nodes (lesson_id, node_id, label, kind, summary, depends_on)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(lesson_id, node_id) DO UPDATE SET
      label = excluded.label, kind = excluded.kind, summary = excluded.summary, depends_on = excluded.depends_on
  `),
  listNodes: db.prepare('SELECT * FROM nodes WHERE lesson_id = ? ORDER BY rowid'),
  getNode: db.prepare('SELECT * FROM nodes WHERE lesson_id = ? AND node_id = ?'),
  setNodeStatus: db.prepare('UPDATE nodes SET status = ? WHERE lesson_id = ? AND node_id = ?'),
  lockNode: db.prepare(
    'UPDATE nodes SET status = ?, locked_at = ?, review_at = ?, interval_days = ?, reps = ? WHERE lesson_id = ? AND node_id = ?',
  ),
  insertQuiz: db.prepare(
    'INSERT INTO quiz_results (lesson_id, node_id, correct, ts) VALUES (?, ?, ?, ?)',
  ),
  dueNodes: db.prepare(`
    SELECT n.*, l.topic FROM nodes n JOIN lessons l ON l.id = n.lesson_id
    WHERE n.status = 'locked' AND n.review_at IS NOT NULL AND n.review_at <= ?
    ORDER BY n.review_at
  `),
  stats: db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM lessons) AS lessons,
      (SELECT COUNT(*) FROM nodes WHERE status = 'locked') AS locked,
      (SELECT COUNT(*) FROM quiz_results) AS quizzes,
      (SELECT COUNT(*) FROM quiz_results WHERE correct = 1) AS correct
  `),
};

export function createLesson(id: string, topic: string): Lesson {
  const now = Date.now();
  q.insertLesson.run(id, topic, now, now);
  return getLesson(id)!;
}

export function getLesson(id: string): Lesson | undefined {
  return q.getLesson.get(id) as Lesson | undefined;
}

export function listLessons(): Lesson[] {
  return q.listLessons.all() as Lesson[];
}

export function deleteLesson(id: string) {
  q.deleteQuiz.run(id);
  q.deleteNodes.run(id);
  q.deleteEvents.run(id);
  q.deleteLesson.run(id);
}

export function setSessionId(id: string, sessionId: string) {
  q.setSession.run(sessionId, Date.now(), id);
}

export function setPhase(id: string, phase: string) {
  q.setPhase.run(phase, Date.now(), id);
}

export function setGoal(id: string, goal: string) {
  q.setGoal.run(goal, Date.now(), id);
}

export function appendEvent(lessonId: string, type: string, payload: unknown): StoredEvent {
  const { n } = q.nextSeq.get(lessonId) as { n: number };
  const ts = Date.now();
  q.insertEvent.run(lessonId, n, type, JSON.stringify(payload ?? null), ts);
  q.touchLesson.run(ts, lessonId);
  return { seq: n, type, payload, ts };
}

export function listEvents(lessonId: string): StoredEvent[] {
  return (q.listEvents.all(lessonId) as { seq: number; type: string; payload: string; ts: number }[]).map(
    (r) => ({ ...r, payload: JSON.parse(r.payload) }),
  );
}

export type GraphNodeInput = {
  id: string;
  label: string;
  kind: 'truth' | 'derived' | 'goal';
  summary?: string;
  depends_on?: string[];
};

export function replaceGraph(lessonId: string, nodes: GraphNodeInput[]) {
  const existing = new Map(listNodes(lessonId).map((n) => [n.node_id, n]));
  const keep = new Set(nodes.map((n) => n.id));
  for (const id of existing.keys()) {
    if (!keep.has(id)) db.prepare('DELETE FROM nodes WHERE lesson_id = ? AND node_id = ?').run(lessonId, id);
  }
  for (const n of nodes) {
    q.upsertNode.run(lessonId, n.id, n.label, n.kind, n.summary ?? null, JSON.stringify(n.depends_on ?? []));
  }
}

export function listNodes(lessonId: string): NodeRow[] {
  return q.listNodes.all(lessonId) as NodeRow[];
}

export function getNode(lessonId: string, nodeId: string): NodeRow | undefined {
  return q.getNode.get(lessonId, nodeId) as NodeRow | undefined;
}

const DAY = 86_400_000;

export function setNodeStatus(lessonId: string, nodeId: string, status: string) {
  const node = getNode(lessonId, nodeId);
  if (!node) return;
  if (status === 'locked') {
    // Simple spaced-repetition schedule: 1d, 3d, 7d, 16d, 35d ...
    const reps = node.reps + 1;
    const interval = node.reps === 0 ? 1 : Math.round(node.interval_days * 2.2);
    const now = Date.now();
    q.lockNode.run('locked', now, now + interval * DAY, interval, reps, lessonId, nodeId);
  } else if (status === 'shaky') {
    q.lockNode.run('shaky', node.locked_at, Date.now() + DAY, 1, 0, lessonId, nodeId);
  } else {
    q.setNodeStatus.run(status, lessonId, nodeId);
  }
}

export function recordQuiz(lessonId: string, nodeId: string | null, correct: boolean) {
  q.insertQuiz.run(lessonId, nodeId, correct ? 1 : 0, Date.now());
}

export function dueNodes(now = Date.now()) {
  return q.dueNodes.all(now) as (NodeRow & { topic: string })[];
}

export function stats() {
  return q.stats.get() as { lessons: number; locked: number; quizzes: number; correct: number };
}
