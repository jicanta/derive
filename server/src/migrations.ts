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
 * Adding a migration is one entry appended to `MIGRATIONS`: the next version
 * number, a short name, and an `up` that does the work. Past the baseline the
 * runner guarantees which version a file is on, so a plain `CREATE TABLE` is
 * right there — the `IF NOT EXISTS` idiom would hide the very mistake the
 * version number exists to catch.
 */
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
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
  {
    version: 2,
    name: 'turns',
    up(db) {
      db.exec(`
        CREATE TABLE turns (
          id TEXT PRIMARY KEY,
          lesson_id TEXT NOT NULL,
          learner_id TEXT NOT NULL,
          driver TEXT NOT NULL,
          model TEXT,
          started_at INTEGER NOT NULL,
          ended_at INTEGER,
          status TEXT NOT NULL
        );
        CREATE INDEX turns_lesson ON turns (lesson_id, started_at);
      `);
      backfillTurns(db);
    },
  },
];

/**
 * Every turn the event log already knows about, as a row.
 *
 * The log is the only record of turns from before this table existed, so it is
 * read once here: each `turn_start` opens a turn, the next `turn_end` for that
 * lesson closes it, and a `turn_start` with nothing after it stays `running`.
 * That last case is the point of the pass rather than an edge of it — a
 * companion lesson whose terminal was mid-turn when the upgrade ran would
 * otherwise come back reported idle, and the browser would invite the learner
 * to type into a lesson that is busy.
 *
 * This is the one-time O(events) walk that buys the removal of the O(events)
 * scan `busy()` used to do on every request.
 */
function backfillTurns(db: DatabaseSync) {
  const lessons = db.prepare('SELECT id, learner_id, driver FROM lessons').all() as { id: string; learner_id: string | null; driver: string | null }[];
  if (lessons.length === 0) return;
  const of = new Map(lessons.map((l) => [l.id, l]));
  const insert = db.prepare('INSERT INTO turns (id, lesson_id, learner_id, driver, model, started_at, ended_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const events = db.prepare("SELECT lesson_id, type, payload, ts FROM events WHERE type IN ('turn_start', 'turn_end') ORDER BY lesson_id, seq").all() as {
    lesson_id: string;
    type: string;
    payload: string;
    ts: number;
  }[];

  // The rule `turnStatusOf` applies in server/src/db.ts, written out again for
  // the historical rows: this module cannot import that one, because db.ts
  // imports this one to run the migrations at all.
  const statusOf = (payload: string): string => {
    try {
      const p = JSON.parse(payload) as { ok?: unknown; interrupted?: unknown } | null;
      if (p?.interrupted) return 'interrupted';
      if (p?.ok === false) return 'error';
    } catch {
      /* unreadable payload */
    }
    return 'ok';
  };

  const open = new Map<string, number>();
  const write = (lessonId: string, startedAt: number, endedAt: number | null, status: string) => {
    const lesson = of.get(lessonId)!;
    // Which backend ran an agent-mode turn was never written down, so it is
    // 'unknown' rather than a guess; a companion lesson has always carried the
    // terminal that drives it.
    insert.run(randomUUID(), lessonId, lesson.learner_id ?? 'default', lesson.driver ?? 'unknown', null, startedAt, endedAt, status);
  };

  for (const e of events) {
    if (!of.has(e.lesson_id)) continue;
    const started = open.get(e.lesson_id);
    if (e.type === 'turn_start') {
      // A second start with the first still open is a turn that died without
      // ever reporting: it was interrupted, and the later one supersedes it.
      if (started !== undefined) write(e.lesson_id, started, e.ts, 'interrupted');
      open.set(e.lesson_id, e.ts);
    } else if (started !== undefined) {
      write(e.lesson_id, started, e.ts, statusOf(e.payload));
      open.delete(e.lesson_id);
    }
  }
  for (const [lessonId, startedAt] of open) write(lessonId, startedAt, null, 'running');
}

/** The version a fully migrated database reports. 0 when there are no migrations at all. */
export const LATEST_VERSION = MIGRATIONS.length === 0 ? 0 : MIGRATIONS[MIGRATIONS.length - 1].version;

/** What `PRAGMA user_version` currently says this file is on. */
function currentVersion(db: DatabaseSync): number {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number } | undefined;
  return row?.user_version ?? 0;
}

/** Where this handle's `main` database lives on disk, or undefined when it is in memory. */
function fileOf(db: DatabaseSync): string | undefined {
  const rows = db.prepare('PRAGMA database_list').all() as { name: string; file: string }[];
  const main = rows.find((r) => r.name === 'main');
  return main?.file || undefined;
}

/**
 * Copy the database beside itself before anything is applied to it, named for
 * the version being left behind (`derive.db.bak-v0`).
 *
 * `VACUUM INTO` rather than a filesystem copy: the database runs in WAL mode,
 * so copying the `.db` file alone can miss committed pages still sitting in
 * the write-ahead log, and a backup that quietly loses the last lesson is
 * worse than none. An existing snapshot of the same version is left alone —
 * the older one is the one closer to the learner's last known-good state.
 * Returns the path written, or undefined when nothing was written.
 */
function snapshot(db: DatabaseSync, from: number): string | undefined {
  const file = fileOf(db);
  if (!file) return undefined;
  // A database with nothing in it yet was created by this very process; there
  // is nothing to lose, so nothing to back up.
  const { n } = db.prepare('SELECT count(*) AS n FROM sqlite_master').get() as { n: number };
  if (n === 0) return undefined;
  const path = `${file}.bak-v${from}`;
  if (existsSync(path)) return path;
  db.prepare('VACUUM INTO ?').run(path);
  return path;
}

/**
 * Bring a database up to the highest version in `migrations` and return the
 * version it ends on.
 *
 * Runs at import time from `server/src/db.ts`, before any statement is
 * prepared: every consumer of that module assumes the schema exists the moment
 * it is imported. A database already at the highest version is left untouched
 * and no snapshot is written. A failure rolls its migration back and throws,
 * which at import time means the server refuses to start — the right failure
 * for a local-first app holding the learner's only record, where serving on a
 * schema nobody can name is worse than not serving at all.
 *
 * `migrations` is a seam for the tests, which need a list that fails on
 * purpose; everything else calls this with one argument.
 */
export function runMigrations(db: DatabaseSync, migrations: Migration[] = MIGRATIONS): number {
  const from = currentVersion(db);
  const pending = migrations.filter((m) => m.version > from);
  if (pending.length === 0) return from;

  const backup = snapshot(db, from);

  for (const m of pending) {
    // PRAGMA takes no bound parameter, so the number is interpolated. It comes
    // only from a migration record in the list above and is checked here, so
    // nothing outside this file can ever reach that statement.
    const version = m.version;
    if (!Number.isInteger(version) || version < 0) throw new Error(`migration ${m.name} has an invalid version`);
    db.exec('BEGIN');
    try {
      m.up(db);
      db.exec(`PRAGMA user_version = ${version}`);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      const message = e instanceof Error ? e.message : String(e);
      console.error(`[migrate] migration ${version} (${m.name}) failed and was rolled back: ${message}`);
      throw new Error(
        `migration ${version} (${m.name}) failed and was rolled back: ${message}. the database is still on version ${from}` +
          (backup ? `; a copy of it as it was is at ${backup}` : ''),
      );
    }
  }
  return currentVersion(db);
}
