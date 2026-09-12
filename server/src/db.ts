import { grade, schedule, type Confidence, type Grade, type Scheduled } from './schedule.js';
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
  CREATE TABLE IF NOT EXISTS resources (
    id TEXT PRIMARY KEY,
    learner_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    url TEXT,
    author TEXT,
    note TEXT,
    tags TEXT NOT NULL DEFAULT '[]',
    text TEXT,
    chars INTEGER NOT NULL DEFAULT 0,
    fetched_at INTEGER,
    fetch_error TEXT,
    added_by TEXT NOT NULL DEFAULT 'learner',
    lesson_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS resources_learner ON resources (learner_id);
`);

/** Columns added after the first release; SQLite has no ADD COLUMN IF NOT EXISTS. */
for (const ddl of [
  "ALTER TABLE lessons ADD COLUMN mode TEXT NOT NULL DEFAULT 'agent'",
  "ALTER TABLE lessons ADD COLUMN learner_id TEXT NOT NULL DEFAULT 'default'",
  "ALTER TABLE lessons ADD COLUMN answer_in TEXT NOT NULL DEFAULT 'browser'",
  // Memory state per node (FSRS), and where a review copy comes from.
  'ALTER TABLE nodes ADD COLUMN stability REAL',
  'ALTER TABLE nodes ADD COLUMN difficulty REAL',
  'ALTER TABLE nodes ADD COLUMN lapses INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE nodes ADD COLUMN last_review INTEGER',
  'ALTER TABLE nodes ADD COLUMN source_lesson TEXT',
  'ALTER TABLE nodes ADD COLUMN source_node TEXT',
  // How sure the learner was, and what the question was for (probe, pretest, check, review).
  'ALTER TABLE quiz_results ADD COLUMN confidence TEXT',
  'ALTER TABLE quiz_results ADD COLUMN purpose TEXT',
  'ALTER TABLE misconceptions ADD COLUMN confidence TEXT',
  // How the learner wants to be taught, in their own words (JSON, see LearnerPrefs).
  'ALTER TABLE learners ADD COLUMN prefs TEXT',
]) {
  try {
    db.exec(ddl);
  } catch {
    /* column exists */
  }
}
db.exec('CREATE INDEX IF NOT EXISTS lessons_learner ON lessons (learner_id)');
db.exec('CREATE INDEX IF NOT EXISTS quiz_results_node ON quiz_results (lesson_id, node_id)');

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

/**
 * How a learner wants to be taught, set by the learner. The method (probe,
 * plan, pretest, check, hint before re-deriving) never bends to these; the
 * delivery does: language, how Socratic, how long, where examples come from.
 */
export type LearnerPrefs = {
  /** The language the tutor writes in. Empty: the language the learner writes in. */
  language?: string;
  /** How much to lead with questions versus narrate. */
  style?: 'adaptive' | 'socratic' | 'narrated';
  /** How much prose per step. */
  pace?: 'brisk' | 'standard' | 'thorough';
  /** Who they are and what they already know. */
  background?: string;
  /** What works for them and what does not, in their words. */
  how?: string;
  /** Domains to draw examples and analogies from. */
  examples?: string;
};
export const PREF_STYLES = ['adaptive', 'socratic', 'narrated'] as const;
export const PREF_PACES = ['brisk', 'standard', 'thorough'] as const;
export type Learner = { id: string; name: string; created_at: number; prefs: LearnerPrefs };
type LearnerRow = { id: string; name: string; created_at: number; prefs: string | null };

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
  /** FSRS memory state; null until the node is first locked. */
  stability: number | null;
  difficulty: number | null;
  lapses: number;
  last_review: number | null;
  /** Set on a review lesson's copy of a node: the lesson and node it stands for. Status changes propagate there. */
  source_lesson: string | null;
  source_node: string | null;
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
  setLearnerPrefs: db.prepare('UPDATE learners SET prefs = ? WHERE id = ?'),
  deleteLearner: db.prepare('DELETE FROM learners WHERE id = ?'),
  lessonsOfLearner: db.prepare('SELECT id FROM lessons WHERE learner_id = ?'),
  insertResource: db.prepare(
    'INSERT INTO resources (id, learner_id, kind, title, url, author, note, tags, text, chars, fetched_at, fetch_error, added_by, lesson_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ),
  getResource: db.prepare('SELECT * FROM resources WHERE id = ?'),
  listResources: db.prepare('SELECT id, learner_id, kind, title, url, author, note, tags, chars, fetched_at, fetch_error, added_by, lesson_id, created_at, updated_at FROM resources WHERE learner_id = ? ORDER BY created_at DESC'),
  resourceByUrl: db.prepare('SELECT * FROM resources WHERE learner_id = ? AND url = ?'),
  updateResourceMeta: db.prepare('UPDATE resources SET kind = ?, title = ?, author = ?, note = ?, tags = ?, updated_at = ? WHERE id = ?'),
  updateResourceText: db.prepare('UPDATE resources SET text = ?, chars = ?, fetched_at = ?, fetch_error = ?, updated_at = ? WHERE id = ?'),
  deleteResource: db.prepare('DELETE FROM resources WHERE id = ?'),
  deleteResourcesOfLearner: db.prepare('DELETE FROM resources WHERE learner_id = ?'),
  insertMemory: db.prepare('INSERT INTO memory (fact, kind, lesson_id, ts) VALUES (?, ?, ?, ?)'),
  listMemory: db.prepare(`
    SELECT m.* FROM memory m JOIN lessons l ON l.id = m.lesson_id
    WHERE l.learner_id = ? ORDER BY m.ts DESC LIMIT 60
  `),
  insertMisconception: db.prepare(
    'INSERT INTO misconceptions (lesson_id, node_id, question, picked, correct, explanation, confidence, ts) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ),
  resolveMisconceptions: db.prepare('UPDATE misconceptions SET resolved = 1 WHERE lesson_id = ? AND node_id = ?'),
  listMisconceptions: db.prepare(`
    SELECT m.*, l.topic FROM misconceptions m JOIN lessons l ON l.id = m.lesson_id
    WHERE l.learner_id = ? ORDER BY m.resolved ASC, m.ts DESC LIMIT 40
  `),
  allNodes: db.prepare(`
    SELECT n.*, l.topic, l.goal FROM nodes n JOIN lessons l ON l.id = n.lesson_id
    WHERE l.learner_id = ? AND n.source_lesson IS NULL ORDER BY l.created_at, n.rowid
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
  scheduleNode: db.prepare(`
    UPDATE nodes SET status = ?, locked_at = ?, review_at = ?, interval_days = ?, reps = ?,
      stability = ?, difficulty = ?, lapses = ?, last_review = ?
    WHERE lesson_id = ? AND node_id = ?
  `),
  insertNodeCopy: db.prepare(`
    INSERT INTO nodes (lesson_id, node_id, label, kind, summary, depends_on, status, locked_at, review_at, interval_days, reps,
      stability, difficulty, lapses, last_review, source_lesson, source_node)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  insertQuiz: db.prepare(
    'INSERT INTO quiz_results (lesson_id, node_id, correct, confidence, purpose, ts) VALUES (?, ?, ?, ?, ?, ?)',
  ),
  lastQuiz: db.prepare('SELECT * FROM quiz_results WHERE lesson_id = ? AND node_id = ? ORDER BY ts DESC, id DESC LIMIT 1'),
  dueNodes: db.prepare(`
    SELECT n.*, l.topic FROM nodes n JOIN lessons l ON l.id = n.lesson_id
    WHERE l.learner_id = ? AND n.source_lesson IS NULL AND n.status = 'locked' AND n.review_at IS NOT NULL AND n.review_at <= ?
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

const PREF_TEXT_MAX = 1500;

/** Keeps only known fields, trimmed and capped; unknown enum values fall back to the default. */
export function cleanPrefs(input: unknown): LearnerPrefs {
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const str = (k: string) => (typeof o[k] === 'string' ? (o[k] as string).trim().slice(0, PREF_TEXT_MAX) : '');
  const out: LearnerPrefs = {};
  const language = str('language').slice(0, 60);
  if (language) out.language = language;
  if ((PREF_STYLES as readonly string[]).includes(o.style as string) && o.style !== 'adaptive') out.style = o.style as LearnerPrefs['style'];
  if ((PREF_PACES as readonly string[]).includes(o.pace as string) && o.pace !== 'standard') out.pace = o.pace as LearnerPrefs['pace'];
  for (const k of ['background', 'how', 'examples'] as const) {
    const v = str(k);
    if (v) out[k] = v;
  }
  return out;
}

const toLearner = (r: LearnerRow | undefined): Learner | undefined => {
  if (!r) return undefined;
  let prefs: LearnerPrefs = {};
  try {
    prefs = cleanPrefs(r.prefs ? JSON.parse(r.prefs) : {});
  } catch {
    /* unreadable prefs read as none */
  }
  return { id: r.id, name: r.name, created_at: r.created_at, prefs };
};

export function listLearners(): Learner[] {
  return (q.listLearners.all() as LearnerRow[]).map((r) => toLearner(r)!);
}

export function getLearner(id: string): Learner | undefined {
  return toLearner(q.getLearner.get(id) as LearnerRow | undefined);
}

/** A learner by id or (case-insensitive) name. */
export function findLearner(idOrName: string): Learner | undefined {
  return getLearner(idOrName) ?? toLearner(q.getLearnerByName.get(idOrName) as LearnerRow | undefined);
}

/** Merges the given fields into the learner's preferences; an empty string clears a field. */
export function updateLearnerPrefs(id: string, patch: Partial<Record<keyof LearnerPrefs, unknown>>): Learner {
  const current = getLearner(id);
  if (!current) throw new Error('learner not found');
  const merged: Record<string, unknown> = { ...current.prefs };
  for (const [k, v] of Object.entries(patch)) if (v !== undefined) merged[k] = v;
  const prefs = cleanPrefs(merged);
  q.setLearnerPrefs.run(Object.keys(prefs).length ? JSON.stringify(prefs) : null, id);
  return getLearner(id)!;
}

/**
 * The learner's preferences as a section of the tutor's system prompt.
 * Empty when they have set nothing.
 */
export function preferencesSection(learnerId: string): string {
  const learner = getLearner(learnerId);
  if (!learner) return '';
  const p = learner.prefs;
  const lines: string[] = [];
  if (p.language) lines.push(`- Write in ${p.language}: your prose, the quiz questions and options, the plan's labels and summaries, the cards. Keep standard technical terms in the form the field uses.`);
  if (p.style === 'socratic') lines.push('- Lean Socratic. Where a step can be reasoned out, pose it as a question and let them try, even when narrating would be faster. Narrate only what is genuinely out of reach.');
  if (p.style === 'narrated') lines.push('- Lean narrated. Establish each step in prose, cleanly and with the motivation, and keep the questions for the pretest and the check. They would rather be told and then tested than led question by question.');
  if (p.pace === 'brisk') lines.push('- Keep it brisk. Shorter teaching prose, one example not three, and no lingering once a check passes. Depth over length; never skip the pretest or the check.');
  if (p.pace === 'thorough') lines.push('- Take it slowly. Work the first example fully, one step at a time, prefer two small nodes over one large one, and pause on the connections between nodes.');
  if (p.background) lines.push(`- Background, in their words: ${p.background}`);
  if (p.how) lines.push(`- How they learn, in their words: ${p.how}`);
  if (p.examples) lines.push(`- Draw examples and analogies from: ${p.examples}. Use those domains when they fit; do not force them.`);
  if (!lines.length) return '';
  return `

# How this learner wants to be taught
Written by the learner${learner.id !== DEFAULT_LEARNER_ID ? ` (${learner.name})` : ''}; they can change it any time. Follow it in how you deliver. The method does not bend to it: still probe, still plan, still pretest and check every node, still hint before re-deriving, still grade honestly.
${lines.join('\n')}
`;
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
  q.deleteResourcesOfLearner.run(id);
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

export type QuizPurpose = 'probe' | 'pretest' | 'check' | 'review';
export type QuizResultRow = { id: number; lesson_id: string; node_id: string | null; correct: number; confidence: Confidence | null; purpose: QuizPurpose | null; ts: number };

/**
 * A node's state change, with its memory schedule. Locking grades the node
 * by the last check on it in this lesson (a confident pass stretches the
 * interval, an unsure one barely moves it); shaky is a lapse. A review
 * lesson's copy of a node forwards the change to the node it stands for,
 * so reviewing reschedules the original and the Atlas sees one node.
 */
export function setNodeStatus(lessonId: string, nodeId: string, status: string): Scheduled | null {
  const node = getNode(lessonId, nodeId);
  if (!node) return null;
  if (status !== 'locked' && status !== 'shaky') {
    q.setNodeStatus.run(status, lessonId, nodeId);
    return null;
  }
  const last = lastQuizFor(lessonId, nodeId);
  const g: Grade = status === 'shaky' ? 'again' : grade(true, last?.purpose === 'pretest' ? null : last?.confidence);
  const memory = node.source_lesson && node.source_node ? (getNode(node.source_lesson, node.source_node) ?? node) : node;
  const now = Date.now();
  const next = schedule(memory, g, now);
  const apply = (l: string, n: string, lockedAt: number | null) =>
    q.scheduleNode.run(status, lockedAt, next.review_at, next.interval_days, next.reps, next.stability, next.difficulty, next.lapses, next.last_review, l, n);
  const lockedAt = status === 'locked' ? now : memory.locked_at;
  apply(lessonId, nodeId, lockedAt);
  if (memory !== node) apply(memory.lesson_id, memory.node_id, lockedAt);
  return next;
}

export function recordQuiz(lessonId: string, nodeId: string | null, correct: boolean, opts: { confidence?: Confidence | null; purpose?: QuizPurpose | null } = {}) {
  q.insertQuiz.run(lessonId, nodeId, correct ? 1 : 0, opts.confidence ?? null, opts.purpose ?? null, Date.now());
}

export function lastQuizFor(lessonId: string, nodeId: string): QuizResultRow | undefined {
  return q.lastQuiz.get(lessonId, nodeId) as QuizResultRow | undefined;
}

export function dueNodes(learnerId: string, now = Date.now()) {
  return q.dueNodes.all(learnerId, now) as (NodeRow & { topic: string })[];
}

export type ReviewNode = NodeRow & { topic: string };
export type ReviewGraph = {
  /** The nodes to check, interleaved across topics, with their ids in the review lesson. */
  due: (ReviewNode & { review_id: string; deps: { id: string; label: string; status: string }[] })[];
  /** Everything placed in the review lesson's graph, due nodes and the dependencies they rest on. */
  nodes: GraphNodeInput[];
};

/**
 * The graph of a review session. Due nodes are taken in order of how
 * overdue they are, then interleaved so two from the same topic are never
 * adjacent when it can be helped (mixing topics forces the learner to
 * retrieve the right frame each time). Each comes with the nodes it was
 * derived from, so a miss can be re-derived instead of re-told. Every
 * node is a copy that points back at its source; status changes made on
 * the copy are forwarded there.
 */
export function buildReviewGraph(lessonId: string, learnerId: string, limit = 6): ReviewGraph {
  const due = dueNodes(learnerId);
  const byLesson = new Map<string, ReviewNode[]>();
  for (const n of due) byLesson.set(n.lesson_id, [...(byLesson.get(n.lesson_id) ?? []), n]);
  const picked: ReviewNode[] = [];
  const queues = [...byLesson.values()];
  while (picked.length < limit && queues.some((qq) => qq.length)) {
    for (const qq of queues) {
      if (picked.length >= limit) break;
      const n = qq.shift();
      if (n) picked.push(n);
    }
  }
  const idOf = new Map<string, string>(); // `${lesson}/${node}` -> id in the review lesson
  const taken = new Set<string>();
  const assign = (n: NodeRow) => {
    const key = `${n.lesson_id}/${n.node_id}`;
    if (idOf.has(key)) return idOf.get(key)!;
    let id = n.node_id;
    for (let i = 2; taken.has(id); i++) id = `${n.node_id}-${i}`;
    taken.add(id);
    idOf.set(key, id);
    return id;
  };
  // Dependencies come along, to depth 2, so a re-derivation has something to stand on.
  const rows = new Map<string, NodeRow>();
  const lessonNodes = new Map<string, Map<string, NodeRow>>();
  const nodesOf = (l: string) => {
    if (!lessonNodes.has(l)) lessonNodes.set(l, new Map(listNodes(l).map((n) => [n.node_id, n])));
    return lessonNodes.get(l)!;
  };
  const add = (n: NodeRow, depth: number) => {
    const key = `${n.lesson_id}/${n.node_id}`;
    if (rows.has(key)) return;
    rows.set(key, n);
    assign(n);
    if (depth === 0) return;
    for (const d of JSON.parse(n.depends_on || '[]') as string[]) {
      const dep = nodesOf(n.lesson_id).get(d);
      if (dep) add(dep, depth - 1);
    }
  };
  for (const n of picked) add(n, 2);
  const nodes: GraphNodeInput[] = [];
  for (const n of rows.values()) {
    const deps = (JSON.parse(n.depends_on || '[]') as string[]).map((d) => idOf.get(`${n.lesson_id}/${d}`)).filter((x): x is string => !!x);
    const id = assign(n);
    const isDue = picked.some((p) => p.lesson_id === n.lesson_id && p.node_id === n.node_id);
    q.insertNodeCopy.run(
      lessonId, id, n.label, n.kind, n.summary, JSON.stringify(deps),
      isDue ? 'pending' : n.status, n.locked_at, n.review_at, n.interval_days, n.reps,
      n.stability, n.difficulty, n.lapses, n.last_review, n.lesson_id, n.node_id,
    );
    nodes.push({ id, label: n.label, kind: n.kind as GraphNodeInput['kind'], summary: n.summary ?? undefined, depends_on: deps });
  }
  return {
    due: picked.map((n) => ({
      ...n,
      review_id: assign(n),
      deps: (JSON.parse(n.depends_on || '[]') as string[])
        .map((d) => nodesOf(n.lesson_id).get(d))
        .filter((d): d is NodeRow => !!d)
        .map((d) => ({ id: assign(d), label: d.label, status: d.status })),
    })),
    nodes,
  };
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

// ---------- the library ----------

export type ResourceKind = 'article' | 'video' | 'book' | 'paper' | 'course' | 'note';
export const RESOURCE_KINDS: ResourceKind[] = ['article', 'video', 'book', 'paper', 'course', 'note'];

/**
 * One entry of a learner's library: a link, a video, a book, a paper, a
 * course or a plain note, with whatever text could be fetched from it so
 * the tutor can read and cite it. The text is segmented like course
 * material (the record separator between parts); `chars` is its length.
 */
export type ResourceRow = {
  id: string;
  learner_id: string;
  kind: ResourceKind;
  title: string;
  url: string | null;
  author: string | null;
  /** The learner's (or the tutor's) note: what this is good for. */
  note: string | null;
  /** JSON array of tags. */
  tags: string;
  chars: number;
  /** When the URL was last fetched; null for a note or a resource with nothing to fetch. */
  fetched_at: number | null;
  fetch_error: string | null;
  added_by: 'learner' | 'tutor';
  /** The lesson it was saved from, when the tutor saved it. */
  lesson_id: string | null;
  created_at: number;
  updated_at: number;
};
export type ResourceFull = ResourceRow & { text: string | null };

export function insertResource(r: Omit<ResourceFull, 'created_at' | 'updated_at'>): ResourceRow {
  const now = Date.now();
  q.insertResource.run(r.id, r.learner_id, r.kind, r.title, r.url, r.author, r.note, r.tags, r.text, r.chars, r.fetched_at, r.fetch_error, r.added_by, r.lesson_id, now, now);
  return resourceRow(getResource(r.id)!);
}

export const resourceRow = (r: ResourceFull): ResourceRow => {
  const { text: _t, ...row } = r;
  return row;
};

export function getResource(id: string): ResourceFull | undefined {
  return q.getResource.get(id) as ResourceFull | undefined;
}

export function listResources(learnerId: string): ResourceRow[] {
  return q.listResources.all(learnerId) as ResourceRow[];
}

export function resourceByUrl(learnerId: string, url: string): ResourceFull | undefined {
  return q.resourceByUrl.get(learnerId, url) as ResourceFull | undefined;
}

export function updateResourceMeta(id: string, m: { kind: ResourceKind; title: string; author: string | null; note: string | null; tags: string[] }): ResourceRow {
  q.updateResourceMeta.run(m.kind, m.title, m.author, m.note, JSON.stringify(m.tags), Date.now(), id);
  return resourceRow(getResource(id)!);
}

export function updateResourceText(id: string, t: { text: string | null; chars: number; fetched_at: number | null; fetch_error: string | null }) {
  q.updateResourceText.run(t.text, t.chars, t.fetched_at, t.fetch_error, Date.now(), id);
}

export function deleteResource(id: string) {
  q.deleteResource.run(id);
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
  /** 'sure' when the learner committed to the wrong claim with confidence: a held belief, not a slip. */
  confidence: Confidence | null;
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
  confidence?: Confidence | null;
}) {
  q.insertMisconception.run(m.lessonId, m.nodeId, m.question, m.picked, m.correct, m.explanation, m.confidence ?? null, Date.now());
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
    for (const m of mis) lines.push(`- In "${m.topic}": picked "${m.picked}" over "${m.correct}"${m.confidence === 'sure' ? ' (and was sure of it: a held belief, not a slip)' : ''}.`);
  }
  const mem = listMemory(learnerId).slice(0, 20);
  if (mem.length) {
    lines.push('Notes you kept about this learner:');
    for (const m of mem) lines.push(`- ${m.fact}`);
  }
  const learner = getLearner(learnerId);
  const who = learner && learner.id !== DEFAULT_LEARNER_ID ? `The learner's name is ${learner.name}.` : '';
  const prefs = preferencesSection(learnerId);
  if (!lines.length) return prefs + (who ? `\n\n# About this learner\n${who}\n` : '');
  return `${prefs}

# What you already know about this learner
${who ? who + '\n' : ''}${lines.join('\n')}
`;
}
