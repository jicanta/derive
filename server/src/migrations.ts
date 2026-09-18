/**
 * Numbered, transactional schema migrations for the learner's database.
 *
 * `~/.derive/derive.db` is the learner's only record: every locked node, every
 * FSRS interval, every misconception they worked through. It has to survive
 * every release, so schema changes run as numbered migrations rather than as
 * DDL that hopes for the best. `PRAGMA user_version` says which migration a
 * file has reached; each migration applies inside a transaction that also
 * carries the version bump, so a crash mid-upgrade leaves the database on the
 * version it already had rather than half-way between two.
 *
 * Migration 1 is the schema `server/src/db.ts` used to run inline at import
 * time, moved here verbatim: the `CREATE TABLE IF NOT EXISTS` block, the
 * try/catch `ALTER TABLE` list, and the two indexes. Verbatim is load-bearing
 * rather than fussy. SQLite stores the text of a `CREATE` statement as it was
 * written, and an existing database keeps the text it was created with, so the
 * only way a database created a year ago and one created today can hold the
 * same schema is for this DDL to be identical byte for byte. Do not tidy it,
 * re-indent it, reorder it, or fold the added columns into the `CREATE`
 * statements.
 *
 * Adding migration 2 is one entry appended to `MIGRATIONS`: the next version
 * number, a short name, and an `up` that does the work. Past the baseline the
 * runner guarantees which version a file is on, so a plain `CREATE TABLE` is
 * right there — the `IF NOT EXISTS` idiom would hide the very mistake the
 * version number exists to catch.
 */
import type { DatabaseSync } from 'node:sqlite';

/** The schema as `server/src/db.ts` wrote it before this runner existed. Byte-identical on purpose; see the note above. */
const BASELINE_SCHEMA = `
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
`;

/** One numbered schema change. `up` runs inside a transaction that also sets `PRAGMA user_version` to `version`. */
export type Migration = {
  /** Its number, and the value `PRAGMA user_version` carries once it has applied. Strictly increasing, starting at 1. */
  version: number;
  /** A short name, shown in the log line and in the error if it fails. */
  name: string;
  /** The change itself. Throwing rolls the whole migration back, version bump included. */
  up: (db: DatabaseSync) => void;
};

/** Every schema change this build knows about, oldest first. Append to the end; never renumber or edit one that has shipped. */
export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'baseline',
    up(db) {
      db.exec(BASELINE_SCHEMA);

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
        // Companion lessons: which terminal drives it ('claude-code' or 'codex').
        'ALTER TABLE lessons ADD COLUMN driver TEXT',
        // What a question tests: 'intuition' (why it must be so), 'procedure' (carry out the steps), 'transfer' (a problem type not seen in the lesson).
        'ALTER TABLE quiz_results ADD COLUMN tests TEXT',
      ]) {
        try {
          db.exec(ddl);
        } catch {
          /* column exists */
        }
      }
      db.exec('CREATE INDEX IF NOT EXISTS lessons_learner ON lessons (learner_id)');
      db.exec('CREATE INDEX IF NOT EXISTS quiz_results_node ON quiz_results (lesson_id, node_id)');
    },
  },
];

/** The version a fully migrated database reports. 0 when there are no migrations at all. */
export const LATEST_VERSION = MIGRATIONS.length === 0 ? 0 : MIGRATIONS[MIGRATIONS.length - 1].version;

/** What `PRAGMA user_version` currently says this file is on. */
function currentVersion(db: DatabaseSync): number {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number } | undefined;
  return row?.user_version ?? 0;
}

/**
 * Bring a database up to `LATEST_VERSION` and return the version it ends on.
 *
 * Runs at import time from `server/src/db.ts`, before any statement is
 * prepared: every consumer of that module assumes the schema exists the moment
 * it is imported. A database already at the highest version is left untouched.
 */
export function runMigrations(db: DatabaseSync): number {
  const from = currentVersion(db);
  const pending = MIGRATIONS.filter((m) => m.version > from);
  if (pending.length === 0) return from;

  for (const m of pending) {
    // PRAGMA takes no bound parameter, so the number is interpolated. It comes
    // only from a migration record in the list above and is checked here, so
    // nothing outside this file can ever reach that statement.
    const version = m.version;
    if (!Number.isInteger(version) || version < 0) throw new Error(`migration ${m.name} has an invalid version`);
    db.exec('BEGIN');
    m.up(db);
    db.exec(`PRAGMA user_version = ${version}`);
    db.exec('COMMIT');
  }
  return currentVersion(db);
}
