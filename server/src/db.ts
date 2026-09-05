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
  CREATE TABLE IF NOT EXISTS memory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fact TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'learner',
    lesson_id TEXT,
    ts INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS misconceptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lesson_id TEXT NOT NULL,
    node_id TEXT,
    question TEXT NOT NULL,
    picked TEXT NOT NULL,
    correct TEXT NOT NULL,
    explanation TEXT NOT NULL,
    resolved INTEGER NOT NULL DEFAULT 0,
    ts INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS quiz_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lesson_id TEXT NOT NULL,
    node_id TEXT,
    correct INTEGER NOT NULL,
    ts INTEGER NOT NULL
  );
`);

try {
  db.exec("ALTER TABLE lessons ADD COLUMN mode TEXT NOT NULL DEFAULT 'agent'");
} catch {
  /* column exists */
}

export type Lesson = {
  id: string;
  topic: string;
  goal: string | null;
  session_id: string | null;
  phase: string;
  /** 'agent': the built-in tutor runs it. 'external': a Claude Code session drives it through the API. */
  mode: 'agent' | 'external';
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
    'INSERT INTO lessons (id, topic, mode, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
  ),
  lastExternal: db.prepare("SELECT * FROM lessons WHERE mode = 'external' ORDER BY created_at DESC LIMIT 1"),
  insertMemory: db.prepare('INSERT INTO memory (fact, kind, lesson_id, ts) VALUES (?, ?, ?, ?)'),
  listMemory: db.prepare('SELECT * FROM memory ORDER BY ts DESC LIMIT 60'),
  insertMisconception: db.prepare(
    'INSERT INTO misconceptions (lesson_id, node_id, question, picked, correct, explanation, ts) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ),
  resolveMisconceptions: db.prepare('UPDATE misconceptions SET resolved = 1 WHERE lesson_id = ? AND node_id = ?'),
  listMisconceptions: db.prepare(`
    SELECT m.*, l.topic FROM misconceptions m JOIN lessons l ON l.id = m.lesson_id
    ORDER BY m.resolved ASC, m.ts DESC LIMIT 40
  `),
  allNodes: db.prepare(`
    SELECT n.*, l.topic, l.goal FROM nodes n JOIN lessons l ON l.id = n.lesson_id
    ORDER BY l.created_at, n.rowid
  `),
  deleteMemoryByLesson: db.prepare('DELETE FROM memory WHERE lesson_id = ?'),
  deleteMisByLesson: db.prepare('DELETE FROM misconceptions WHERE lesson_id = ?'),
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

export function createLesson(id: string, topic: string, mode: 'agent' | 'external' = 'agent'): Lesson {
  const now = Date.now();
  q.insertLesson.run(id, topic, mode, now, now);
  return getLesson(id)!;
}

export function lastExternalLesson(): Lesson | undefined {
  return q.lastExternal.get() as Lesson | undefined;
}

export function getLesson(id: string): Lesson | undefined {
  return q.getLesson.get(id) as Lesson | undefined;
}

export function listLessons(): Lesson[] {
  return q.listLessons.all() as Lesson[];
}

export function deleteLesson(id: string) {
  q.deleteMemoryByLesson.run(id);
  q.deleteMisByLesson.run(id);
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

export type MemoryRow = { id: number; fact: string; kind: string; lesson_id: string | null; ts: number };
export type MisconceptionRow = {
  id: number;
  lesson_id: string;
  node_id: string | null;
  question: string;
  picked: string;
  correct: string;
  explanation: string;
  resolved: number;
  ts: number;
  topic: string;
};

export function addMemory(fact: string, kind: string, lessonId: string | null) {
  q.insertMemory.run(fact, kind, lessonId, Date.now());
}

export function listMemory(): MemoryRow[] {
  return q.listMemory.all() as MemoryRow[];
}

export function addMisconception(m: {
  lessonId: string;
  nodeId: string | null;
  question: string;
  picked: string;
  correct: string;
  explanation: string;
}) {
  q.insertMisconception.run(m.lessonId, m.nodeId, m.question, m.picked, m.correct, m.explanation, Date.now());
}

export function resolveMisconceptions(lessonId: string, nodeId: string) {
  q.resolveMisconceptions.run(lessonId, nodeId);
}

export function listMisconceptions(): MisconceptionRow[] {
  return q.listMisconceptions.all() as MisconceptionRow[];
}

export function allNodes(): (NodeRow & { topic: string; goal: string | null })[] {
  return q.allNodes.all() as (NodeRow & { topic: string; goal: string | null })[];
}

/**
 * A compact picture of the learner for the tutor's system prompt: what is
 * locked (by topic), what is shaky or due, misconceptions caught, and facts
 * the tutor chose to remember. Kept short on purpose.
 */
export function learnerProfile(currentLessonId?: string): string {
  const nodes = allNodes().filter((n) => n.lesson_id !== currentLessonId);
  const byTopic = new Map<string, { locked: string[]; shaky: string[] }>();
  for (const n of nodes) {
    if (!byTopic.has(n.topic)) byTopic.set(n.topic, { locked: [], shaky: [] });
    const t = byTopic.get(n.topic)!;
    if (n.status === 'locked') t.locked.push(n.label);
    if (n.status === 'shaky') t.shaky.push(n.label);
  }
  const lines: string[] = [];
  if (byTopic.size) {
    lines.push('Locked in earlier lessons (you may build on these, but confirm they still hold if the lesson depends on them):');
    for (const [topic, t] of byTopic) {
      if (t.locked.length) lines.push(`- ${topic}: ${t.locked.join('; ')}`);
      if (t.shaky.length) lines.push(`- ${topic} (SHAKY, re-derive before relying on): ${t.shaky.join('; ')}`);
    }
  }
  const mis = listMisconceptions().filter((m) => !m.resolved && m.lesson_id !== currentLessonId).slice(0, 8);
  if (mis.length) {
    lines.push('Misconceptions caught before (unresolved; watch for them resurfacing):');
    for (const m of mis) lines.push(`- In "${m.topic}": picked "${m.picked}" over "${m.correct}".`);
  }
  const mem = listMemory().slice(0, 20);
  if (mem.length) {
    lines.push('Notes you kept about this learner:');
    for (const m of mem) lines.push(`- ${m.fact}`);
  }
  if (!lines.length) return '';
  return `

# What you already know about this learner
${lines.join('\n')}
`;
}
