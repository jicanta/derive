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
  CREATE TABLE IF NOT EXISTS materials (
    id TEXT PRIMARY KEY,
    lesson_id TEXT,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    unit TEXT NOT NULL DEFAULT 'part',
    pages INTEGER NOT NULL DEFAULT 0,
    chars INTEGER NOT NULL DEFAULT 0,
    text TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS materials_lesson ON materials (lesson_id);
  CREATE TABLE IF NOT EXISTS learners (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
`);

/** Columns added after the first release; SQLite has no ADD COLUMN IF NOT EXISTS. */
for (const ddl of [
  "ALTER TABLE lessons ADD COLUMN mode TEXT NOT NULL DEFAULT 'agent'",
  "ALTER TABLE lessons ADD COLUMN learner_id TEXT NOT NULL DEFAULT 'default'",
  "ALTER TABLE lessons ADD COLUMN answer_in TEXT NOT NULL DEFAULT 'browser'",
]) {
  try {
    db.exec(ddl);
  } catch {
    /* column exists */
  }
}
db.exec('CREATE INDEX IF NOT EXISTS lessons_learner ON lessons (learner_id)');

/** The first learner. Lessons from before profiles existed belong to it. */
export const DEFAULT_LEARNER_ID = 'default';
db.prepare('INSERT OR IGNORE INTO learners (id, name, created_at) VALUES (?, ?, ?)').run(
  DEFAULT_LEARNER_ID,
  process.env.DERIVE_LEARNER?.trim() || (process.env.USER || process.env.USERNAME || 'You').replace(/^./, (c) => c.toUpperCase()),
  Date.now(),
);

export type Lesson = {
  id: string;
  topic: string;
  goal: string | null;
  session_id: string | null;
  phase: string;
  /** 'agent': the built-in tutor runs it. 'external': a Claude Code session drives it through the API. */
  mode: 'agent' | 'external';
  /** Whose lesson this is. */
  learner_id: string;
  /** Companion lessons only: where the learner answers cards. 'terminal' makes blocking tools return at once. */
  answer_in: 'browser' | 'terminal';
  created_at: number;
  updated_at: number;
};

export type Learner = { id: string; name: string; created_at: number };

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
    'INSERT INTO lessons (id, topic, mode, learner_id, answer_in, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ),
  lastExternal: db.prepare("SELECT * FROM lessons WHERE mode = 'external' ORDER BY created_at DESC LIMIT 1"),
  setAnswerIn: db.prepare('UPDATE lessons SET answer_in = ?, updated_at = ? WHERE id = ?'),
  insertLearner: db.prepare('INSERT INTO learners (id, name, created_at) VALUES (?, ?, ?)'),
  getLearner: db.prepare('SELECT * FROM learners WHERE id = ?'),
  getLearnerByName: db.prepare('SELECT * FROM learners WHERE lower(name) = lower(?)'),
  listLearners: db.prepare('SELECT * FROM learners ORDER BY created_at'),
  renameLearner: db.prepare('UPDATE learners SET name = ? WHERE id = ?'),
  deleteLearner: db.prepare('DELETE FROM learners WHERE id = ?'),
  lessonsOfLearner: db.prepare('SELECT id FROM lessons WHERE learner_id = ?'),
  insertMemory: db.prepare('INSERT INTO memory (fact, kind, lesson_id, ts) VALUES (?, ?, ?, ?)'),
  listMemory: db.prepare(`
    SELECT m.* FROM memory m JOIN lessons l ON l.id = m.lesson_id
    WHERE l.learner_id = ? ORDER BY m.ts DESC LIMIT 60
  `),
  insertMisconception: db.prepare(
    'INSERT INTO misconceptions (lesson_id, node_id, question, picked, correct, explanation, ts) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ),
  resolveMisconceptions: db.prepare('UPDATE misconceptions SET resolved = 1 WHERE lesson_id = ? AND node_id = ?'),
  listMisconceptions: db.prepare(`
    SELECT m.*, l.topic FROM misconceptions m JOIN lessons l ON l.id = m.lesson_id
    WHERE l.learner_id = ? ORDER BY m.resolved ASC, m.ts DESC LIMIT 40
  `),
  allNodes: db.prepare(`
    SELECT n.*, l.topic, l.goal FROM nodes n JOIN lessons l ON l.id = n.lesson_id
    WHERE l.learner_id = ? ORDER BY l.created_at, n.rowid
  `),
  deleteMemoryByLesson: db.prepare('DELETE FROM memory WHERE lesson_id = ?'),
  deleteMisByLesson: db.prepare('DELETE FROM misconceptions WHERE lesson_id = ?'),
  getLesson: db.prepare('SELECT * FROM lessons WHERE id = ?'),
  listLessons: db.prepare('SELECT * FROM lessons WHERE learner_id = ? ORDER BY updated_at DESC'),
  listAllLessons: db.prepare('SELECT * FROM lessons ORDER BY updated_at DESC'),
  touchLesson: db.prepare('UPDATE lessons SET updated_at = ? WHERE id = ?'),
  setSession: db.prepare('UPDATE lessons SET session_id = ?, updated_at = ? WHERE id = ?'),
  setPhase: db.prepare('UPDATE lessons SET phase = ?, updated_at = ? WHERE id = ?'),
  setGoal: db.prepare('UPDATE lessons SET goal = ?, updated_at = ? WHERE id = ?'),
  deleteLesson: db.prepare('DELETE FROM lessons WHERE id = ?'),
  deleteEvents: db.prepare('DELETE FROM events WHERE lesson_id = ?'),
  deleteNodes: db.prepare('DELETE FROM nodes WHERE lesson_id = ?'),
  deleteQuiz: db.prepare('DELETE FROM quiz_results WHERE lesson_id = ?'),
  insertMaterial: db.prepare(
    'INSERT INTO materials (id, lesson_id, name, kind, unit, pages, chars, text, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ),
  getMaterial: db.prepare('SELECT * FROM materials WHERE id = ?'),
  listMaterials: db.prepare('SELECT id, lesson_id, name, kind, unit, pages, chars, created_at FROM materials WHERE lesson_id = ? ORDER BY created_at, rowid'),
  bindMaterial: db.prepare('UPDATE materials SET lesson_id = ? WHERE id = ? AND lesson_id IS NULL'),
  deleteMaterial: db.prepare('DELETE FROM materials WHERE id = ?'),
  deleteMaterialsByLesson: db.prepare('DELETE FROM materials WHERE lesson_id = ?'),
  deleteOrphanMaterials: db.prepare('DELETE FROM materials WHERE lesson_id IS NULL AND created_at < ?'),
  nextSeq: db.prepare('SELECT COALESCE(MAX(seq), 0) + 1 AS n FROM events WHERE lesson_id = ?'),
  insertEvent: db.prepare(
    'INSERT INTO events (lesson_id, seq, type, payload, ts) VALUES (?, ?, ?, ?, ?)',
  ),
  listEvents: db.prepare('SELECT seq, type, payload, ts FROM events WHERE lesson_id = ? ORDER BY seq'),
  updateEvent: db.prepare('UPDATE events SET payload = ? WHERE lesson_id = ? AND seq = ?'),
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
    WHERE l.learner_id = ? AND n.status = 'locked' AND n.review_at IS NOT NULL AND n.review_at <= ?
    ORDER BY n.review_at
  `),
  stats: db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM lessons WHERE learner_id = $l) AS lessons,
      (SELECT COUNT(*) FROM nodes n JOIN lessons l ON l.id = n.lesson_id WHERE l.learner_id = $l AND n.status = 'locked') AS locked,
      (SELECT COUNT(*) FROM quiz_results q JOIN lessons l ON l.id = q.lesson_id WHERE l.learner_id = $l) AS quizzes,
      (SELECT COUNT(*) FROM quiz_results q JOIN lessons l ON l.id = q.lesson_id WHERE l.learner_id = $l AND q.correct = 1) AS correct
  `),
};

// ---------- learners ----------

export function listLearners(): Learner[] {
  return q.listLearners.all() as Learner[];
}

export function getLearner(id: string): Learner | undefined {
  return q.getLearner.get(id) as Learner | undefined;
}

/** A learner by id or (case-insensitive) name. */
export function findLearner(idOrName: string): Learner | undefined {
  return getLearner(idOrName) ?? (q.getLearnerByName.get(idOrName) as Learner | undefined);
}

export function createLearner(name: string): Learner {
  const clean = name.trim().slice(0, 60);
  if (!clean) throw new Error('name required');
  const existing = q.getLearnerByName.get(clean) as Learner | undefined;
  if (existing) return existing;
  const id = clean.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'learner';
  let unique = id;
  for (let n = 2; getLearner(unique); n++) unique = `${id}-${n}`;
  q.insertLearner.run(unique, clean, Date.now());
  return getLearner(unique)!;
}

export function renameLearner(id: string, name: string): Learner {
  const clean = name.trim().slice(0, 60);
  if (!clean) throw new Error('name required');
  q.renameLearner.run(clean, id);
  return getLearner(id)!;
}

/** Removes the learner and everything they learned. The default learner cannot be removed. */
export function deleteLearner(id: string) {
  if (id === DEFAULT_LEARNER_ID) throw new Error('the first learner cannot be removed; rename it instead');
  for (const { id: lessonId } of q.lessonsOfLearner.all(id) as { id: string }[]) deleteLesson(lessonId);
  q.deleteLearner.run(id);
}

export function createLesson(
  id: string,
  topic: string,
  opts: { mode?: 'agent' | 'external'; learnerId?: string; answerIn?: 'browser' | 'terminal' } = {},
): Lesson {
  const now = Date.now();
  q.insertLesson.run(id, topic, opts.mode ?? 'agent', opts.learnerId ?? DEFAULT_LEARNER_ID, opts.answerIn ?? 'browser', now, now);
  return getLesson(id)!;
}

export function setAnswerIn(id: string, where: 'browser' | 'terminal') {
  q.setAnswerIn.run(where, Date.now(), id);
}

export function lastExternalLesson(): Lesson | undefined {
  return q.lastExternal.get() as Lesson | undefined;
}

export function getLesson(id: string): Lesson | undefined {
  return q.getLesson.get(id) as Lesson | undefined;
}

/** A learner's lessons, newest first; every learner's when no id is given. */
export function listLessons(learnerId?: string): Lesson[] {
  return (learnerId ? q.listLessons.all(learnerId) : q.listAllLessons.all()) as Lesson[];
}

export function deleteLesson(id: string) {
  q.deleteMaterialsByLesson.run(id);
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

/** Rewrite a stored event's payload (used to grow a streaming assistant block in place). */
export function updateEvent(lessonId: string, seq: number, payload: unknown) {
  q.updateEvent.run(JSON.stringify(payload ?? null), lessonId, seq);
  q.touchLesson.run(Date.now(), lessonId);
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

export function dueNodes(learnerId: string, now = Date.now()) {
  return q.dueNodes.all(learnerId, now) as (NodeRow & { topic: string })[];
}

export function stats(learnerId: string) {
  return q.stats.get({ l: learnerId }) as { lessons: number; locked: number; quizzes: number; correct: number };
}

// ---------- course material ----------

/** Text extracted from a file the learner attached (slides, a PDF, notes). */
export type MaterialRow = {
  id: string;
  /** Null until the material is bound to a lesson (uploads happen before the lesson exists). */
  lesson_id: string | null;
  name: string;
  kind: 'pdf' | 'pptx' | 'docx' | 'md' | 'txt' | 'repo';
  /** What one segment of the text is: a page (pdf), a slide (pptx), a part (continuous text split at headings), or a file (repo). */
  unit: 'page' | 'slide' | 'part' | 'file';
  pages: number;
  chars: number;
  created_at: number;
};
export type MaterialFull = MaterialRow & { text: string };

export function insertMaterial(m: Omit<MaterialFull, 'created_at'>): MaterialRow {
  q.insertMaterial.run(m.id, m.lesson_id, m.name, m.kind, m.unit, m.pages, m.chars, m.text, Date.now());
  const { text: _t, ...row } = getMaterial(m.id)!;
  return row;
}

export function getMaterial(id: string): MaterialFull | undefined {
  return q.getMaterial.get(id) as MaterialFull | undefined;
}

export function listMaterials(lessonId: string): MaterialRow[] {
  return q.listMaterials.all(lessonId) as MaterialRow[];
}

/** Attach uploaded-but-unbound materials to a lesson. Ignores ids that are missing or already bound. */
export function bindMaterials(lessonId: string, ids: string[]): MaterialRow[] {
  for (const id of ids) q.bindMaterial.run(lessonId, id);
  return listMaterials(lessonId);
}

export function deleteMaterial(id: string) {
  q.deleteMaterial.run(id);
}

/** Uploads that never got attached to a lesson (the tab was closed) are dropped after a day. */
export function sweepOrphanMaterials(olderThanMs = 86_400_000) {
  q.deleteOrphanMaterials.run(Date.now() - olderThanMs);
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

export function listMemory(learnerId: string): MemoryRow[] {
  return q.listMemory.all(learnerId) as MemoryRow[];
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

export function listMisconceptions(learnerId: string): MisconceptionRow[] {
  return q.listMisconceptions.all(learnerId) as MisconceptionRow[];
}

export function allNodes(learnerId: string): (NodeRow & { topic: string; goal: string | null })[] {
  return q.allNodes.all(learnerId) as (NodeRow & { topic: string; goal: string | null })[];
}

/**
 * A compact picture of the learner for the tutor's system prompt: what is
 * locked (by topic), what is shaky or due, misconceptions caught, and facts
 * the tutor chose to remember. Kept short on purpose.
 */
export function learnerProfile(learnerId: string, currentLessonId?: string): string {
  const nodes = allNodes(learnerId).filter((n) => n.lesson_id !== currentLessonId);
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
  const mis = listMisconceptions(learnerId).filter((m) => !m.resolved && m.lesson_id !== currentLessonId).slice(0, 8);
  if (mis.length) {
    lines.push('Misconceptions caught before (unresolved; watch for them resurfacing):');
    for (const m of mis) lines.push(`- In "${m.topic}": picked "${m.picked}" over "${m.correct}".`);
  }
  const mem = listMemory(learnerId).slice(0, 20);
  if (mem.length) {
    lines.push('Notes you kept about this learner:');
    for (const m of mem) lines.push(`- ${m.fact}`);
  }
  const learner = getLearner(learnerId);
  const who = learner && learner.id !== DEFAULT_LEARNER_ID ? `The learner's name is ${learner.name}.` : '';
  if (!lines.length) return who ? `\n\n# About this learner\n${who}\n` : '';
  return `

# What you already know about this learner
${who ? who + '\n' : ''}${lines.join('\n')}
`;
}
