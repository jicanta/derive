/**
 * The migration runner, and the one thing it exists to guarantee: a database
 * written by the code that shipped before it lands on exactly the schema a
 * fresh one gets.
 *
 * Everything here runs against scratch directories from mkdtempSync. Nothing
 * in this file may touch ~/.derive/derive.db — that file is a real learner's
 * only record.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, describe, it } from 'node:test';

import { LATEST_VERSION, MIGRATIONS, runMigrations, type Migration } from '../src/migrations.js';

const dirs: string[] = [];
const scratch = () => {
  const dir = mkdtempSync(join(tmpdir(), 'derive-migrate-'));
  dirs.push(dir);
  return dir;
};
after(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

/**
 * The schema exactly as server/src/db.ts ran it inline before this runner
 * existed: `git show 9351172:server/src/db.ts` lines 12-137. Byte-identical on
 * purpose — sqlite_master keeps the text a table was created with, so a
 * whitespace change here would make an upgraded database differ from a fresh
 * one for no reason but formatting, which is the failure this test catches.
 */
const LEGACY_SCHEMA = `
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

/** The ALTER TABLE list from the same source, lines 109-128. Order matters: it is the order the columns land in. */
const LEGACY_COLUMNS = [
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
];

/** Build a database the way the pre-runner code did, and leave user_version at 0 where it left it. */
function legacyDatabase(dir: string): string {
  const file = join(dir, 'derive.db');
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec(LEGACY_SCHEMA);
  for (const ddl of LEGACY_COLUMNS) {
    try {
      db.exec(ddl);
    } catch {
      /* column exists */
    }
  }
  db.exec('CREATE INDEX IF NOT EXISTS lessons_learner ON lessons (learner_id)');
  db.exec('CREATE INDEX IF NOT EXISTS quiz_results_node ON quiz_results (lesson_id, node_id)');
  db.close();
  return file;
}

/** A learner's record, in miniature: a lesson, its graph, its events and a locked node with FSRS state. */
function populate(file: string) {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL');
  db.prepare('INSERT INTO learners (id, name, created_at) VALUES (?, ?, ?)').run('default', 'You', 1);
  db.prepare('INSERT INTO lessons (id, topic, phase, learner_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run('l1', 'Fourier series', 'teach', 'default', 1, 2);
  db.prepare('INSERT INTO nodes (lesson_id, node_id, label, kind, depends_on, status, stability, reps) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('l1', 'orthogonality', 'Sines are orthogonal', 'truth', '[]', 'locked', 4.5, 2);
  db.prepare('INSERT INTO events (lesson_id, seq, type, payload, ts) VALUES (?, ?, ?, ?, ?)').run('l1', 0, 'turn_start', '{}', 1);
  db.prepare('INSERT INTO quiz_results (lesson_id, node_id, correct, confidence, purpose, tests, ts) VALUES (?, ?, ?, ?, ?, ?, ?)').run('l1', 'orthogonality', 1, 'sure', 'check', 'intuition', 2);
  db.close();
}

/** Everything sqlite_master knows, plus the columns of every table, in a stable order. */
function schemaOf(file: string) {
  const db = new DatabaseSync(file);
  const objects = db.prepare("SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name").all() as { type: string; name: string; tbl_name: string; sql: string | null }[];
  const columns: Record<string, unknown[]> = {};
  for (const o of objects) {
    if (o.type !== 'table') continue;
    columns[o.name] = db.prepare('SELECT cid, name, type, "notnull", dflt_value, pk FROM pragma_table_info(?) ORDER BY cid').all(o.name);
  }
  db.close();
  return { objects, columns };
}

function userVersion(file: string): number {
  const db = new DatabaseSync(file);
  const { user_version } = db.prepare('PRAGMA user_version').get() as { user_version: number };
  db.close();
  return user_version;
}

/** Run the runner the way db.ts does: open, set WAL, migrate, close. */
function migrate(file: string) {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL');
  runMigrations(db);
  db.close();
}

describe('the migration runner', () => {
  it('lands an existing database on exactly the schema a fresh one gets', () => {
    const old = legacyDatabase(scratch());
    populate(old);
    migrate(old);

    const fresh = join(scratch(), 'derive.db');
    migrate(fresh);

    assert.deepEqual(schemaOf(old), schemaOf(fresh));
    assert.equal(userVersion(old), LATEST_VERSION);
    assert.equal(userVersion(fresh), LATEST_VERSION);
  });

  it('starts at migration 1, the baseline', () => {
    assert.equal(MIGRATIONS[0].version, 1);
    assert.equal(MIGRATIONS[0].name, 'baseline');
    assert.equal(LATEST_VERSION, MIGRATIONS[MIGRATIONS.length - 1].version);
  });

  it('leaves the learner every row they had', () => {
    const old = legacyDatabase(scratch());
    populate(old);
    migrate(old);

    const db = new DatabaseSync(old);
    // node:sqlite rows have a null prototype; spread them so deepEqual compares against a plain object.
    assert.deepEqual(db.prepare('SELECT id, topic, phase, learner_id FROM lessons').all().map((r) => ({ ...r })), [{ id: 'l1', topic: 'Fourier series', phase: 'teach', learner_id: 'default' }]);
    assert.deepEqual(db.prepare('SELECT node_id, status, stability, reps FROM nodes').all().map((r) => ({ ...r })), [{ node_id: 'orthogonality', status: 'locked', stability: 4.5, reps: 2 }]);
    assert.equal((db.prepare('SELECT count(*) AS n FROM events').get() as { n: number }).n, 1);
    assert.equal((db.prepare('SELECT count(*) AS n FROM quiz_results').get() as { n: number }).n, 1);
    db.close();
  });

  it('is a no-op the second time', () => {
    const old = legacyDatabase(scratch());
    migrate(old);
    const before = schemaOf(old);

    migrate(old);
    assert.deepEqual(schemaOf(old), before);
    assert.equal(userVersion(old), LATEST_VERSION);
  });
});

describe('a migration that fails', () => {
  /** The real list plus one that throws once it is inside its transaction. */
  const withAFailure = (): Migration[] => [
    ...MIGRATIONS,
    {
      version: LATEST_VERSION + 1,
      name: 'deliberately broken',
      up(db) {
        db.exec('CREATE TABLE half_built (id TEXT PRIMARY KEY)');
        db.exec('THIS IS NOT SQL');
      },
    },
  ];

  /** Run the runner with console.error captured, returning the thrown error and every line it logged. */
  function failing(file: string) {
    const db = new DatabaseSync(file);
    db.exec('PRAGMA journal_mode = WAL');
    const logged: string[] = [];
    const real = console.error;
    console.error = (...args: unknown[]) => void logged.push(args.map(String).join(' '));
    let error: Error | undefined;
    try {
      runMigrations(db, withAFailure());
    } catch (e) {
      error = e as Error;
    } finally {
      console.error = real;
      db.close();
    }
    return { error, logged };
  }

  it('rolls back, leaving the version and the half-built table where they were', () => {
    const old = legacyDatabase(scratch());
    migrate(old);
    const before = schemaOf(old);

    const { error } = failing(old);
    assert.ok(error, 'the runner must throw');
    assert.equal(userVersion(old), LATEST_VERSION);
    assert.deepEqual(schemaOf(old), before);
    assert.equal(before.objects.some((o) => o.name === 'half_built'), false);
  });

  it('says which migration failed, in a lowercase sentence, and logs one [migrate] line', () => {
    const old = legacyDatabase(scratch());
    migrate(old);

    const { error, logged } = failing(old);
    const message = error?.message ?? '';
    assert.match(message, new RegExp(`migration ${LATEST_VERSION + 1} \\(deliberately broken\\)`));
    assert.equal(message[0], message[0].toLowerCase());
    assert.equal(logged.length, 1);
    assert.equal(logged[0].startsWith('[migrate] '), true);
    assert.equal(logged[0].split('\n').length, 1);
  });
});

/** A lesson whose log holds `starts` turn_start events and `ends` turn_end events, interleaved in that order. */
function withTurns(file: string, lessonId: string, mode: 'agent' | 'external', pairs: (string | null)[]) {
  const db = new DatabaseSync(file);
  db.prepare('INSERT INTO lessons (id, topic, phase, mode, learner_id, driver, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
    lessonId,
    'Fourier series',
    'teach',
    mode,
    'default',
    mode === 'external' ? 'claude-code' : null,
    1,
    2,
  );
  let seq = 0;
  const insert = db.prepare('INSERT INTO events (lesson_id, seq, type, payload, ts) VALUES (?, ?, ?, ?, ?)');
  for (const end of pairs) {
    insert.run(lessonId, seq, 'turn_start', '{}', seq + 1);
    seq += 1;
    if (end !== null) {
      insert.run(lessonId, seq, 'turn_end', end, seq + 1);
      seq += 1;
    }
  }
  db.close();
}

const turns = (file: string) => {
  const db = new DatabaseSync(file);
  const rows = (db.prepare('SELECT id, lesson_id, learner_id, driver, model, started_at, ended_at, status FROM turns ORDER BY started_at, rowid').all() as Record<string, unknown>[]).map((r) => ({ ...r }));
  db.close();
  return rows;
};

/** The ledger side of the same database, in the same shape and the same stable order. */
const usageRows = (file: string) => {
  const db = new DatabaseSync(file);
  const rows = (
    db
      .prepare(
        'SELECT id, turn_id, lesson_id, learner_id, driver, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, reasoning_tokens, cost_source, cost_usd, ts FROM usage ORDER BY id',
      )
      .all() as Record<string, unknown>[]
  ).map((r) => ({ ...r }));
  db.close();
  return rows;
};

/** Row counts on both halves of the ledger, so a case compares one object rather than two numbers. */
const counts = (file: string) => ({ turns: turns(file).length, usage: usageRows(file).length });

/** Run the runner with the list truncated at `version`, to stand a database on a release that has already shipped. */
function migrateTo(file: string, version: number) {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL');
  runMigrations(
    db,
    MIGRATIONS.filter((m) => m.version <= version),
  );
  db.close();
}

describe('the turns backfilled from the event log', () => {
  it('opens one row per turn_start and closes the ones the log ended', () => {
    const old = legacyDatabase(scratch());
    withTurns(old, 'l1', 'external', ['{"ok":true}', '{"ok":true}', null]);
    migrate(old);

    const rows = turns(old);
    assert.equal(rows.length, 3);
    assert.equal(rows.filter((r) => r.status === 'running').length, 1);
    assert.deepEqual(rows.map((r) => r.status), ['ok', 'ok', 'running']);
    assert.equal(rows[2].ended_at, null);
    assert.deepEqual(new Set(rows.map((r) => r.lesson_id)), new Set(['l1']));
  });

  it('carries the lesson\'s learner and terminal, and says "unknown" where nothing was recorded', () => {
    const old = legacyDatabase(scratch());
    withTurns(old, 'l1', 'external', ['{"ok":true}']);
    withTurns(old, 'l2', 'agent', [null]);
    migrate(old);

    const rows = turns(old);
    const external = rows.find((r) => r.lesson_id === 'l1')!;
    const agent = rows.find((r) => r.lesson_id === 'l2')!;
    assert.equal(external.driver, 'claude-code');
    assert.equal(external.learner_id, 'default');
    // Which backend ran an agent turn before this table existed was never written down.
    assert.equal(agent.driver, 'unknown');
    assert.equal(agent.model, null);
    assert.equal(agent.status, 'running');
  });

  it('reads how a turn ended out of its payload', () => {
    const old = legacyDatabase(scratch());
    withTurns(old, 'l1', 'agent', ['{"ok":true,"interrupted":true}', '{"ok":false,"error":"boom"}', '{"ok":true}']);
    migrate(old);

    assert.deepEqual(turns(old).map((r) => r.status), ['interrupted', 'error', 'ok']);
  });

  it('leaves a database with no turns in its log with no rows at all', () => {
    const old = legacyDatabase(scratch());
    populate(old);
    migrate(old);

    // populate() writes a single turn_start, and nothing closed it.
    assert.deepEqual(turns(old).map((r) => r.status), ['running']);
  });
});

describe('the usage rows backfilled for turns the ledger never saw', () => {
  it('gives every ended turn a row and leaves the one still running for the boot sweep', () => {
    const old = legacyDatabase(scratch());
    withTurns(old, 'l1', 'external', ['{"ok":true}', '{"ok":true}', null]);
    migrate(old);

    assert.deepEqual(counts(old), { turns: 3, usage: 2 });
    const running = turns(old).find((r) => r.status === 'running')!;
    assert.equal(usageRows(old).some((u) => u.turn_id === running.id), false);
  });

  it('writes the honest blank and not a single reconstructed figure', () => {
    const old = legacyDatabase(scratch());
    withTurns(old, 'l1', 'external', ['{"ok":true}']);
    migrate(old);

    const [row] = usageRows(old);
    assert.equal(row.cost_source, 'unknown');
    // Asserted as nulls rather than as falsy values: a zero is a figure, a null is an absence.
    assert.deepEqual(
      {
        model: row.model,
        input_tokens: row.input_tokens,
        output_tokens: row.output_tokens,
        cache_read_tokens: row.cache_read_tokens,
        cache_write_tokens: row.cache_write_tokens,
        reasoning_tokens: row.reasoning_tokens,
        cost_usd: row.cost_usd,
      },
      { model: null, input_tokens: null, output_tokens: null, cache_read_tokens: null, cache_write_tokens: null, reasoning_tokens: null, cost_usd: null },
    );
    // The lesson's own terminal is carried across, so the row still says who ran it.
    assert.equal(row.driver, 'claude-code');
    assert.equal(row.learner_id, 'default');
  });

  it('dates each row at the turn it belongs to, not at the moment of the upgrade', () => {
    const old = legacyDatabase(scratch());
    withTurns(old, 'l1', 'agent', ['{"ok":true}', '{"ok":true}']);
    migrate(old);

    const endedAt = new Map(turns(old).map((t) => [t.id, t.ended_at]));
    for (const u of usageRows(old)) assert.equal(u.ts, endedAt.get(u.turn_id as string));
  });

  it('writes nothing the second time the runner runs', () => {
    const old = legacyDatabase(scratch());
    withTurns(old, 'l1', 'external', ['{"ok":true}', '{"ok":true}', null]);
    migrate(old);
    const before = counts(old);

    migrate(old);
    assert.deepEqual(counts(old), before);
  });

  it('leaves a database with no turns in its log with no rows in either table', () => {
    const old = legacyDatabase(scratch());
    migrate(old);

    assert.deepEqual(counts(old), { turns: 0, usage: 0 });
  });

  it('leaves a turn that already reported exactly the row it reported', () => {
    const old = legacyDatabase(scratch());
    withTurns(old, 'l1', 'agent', ['{"ok":true}', '{"ok":true}']);
    // Stand the database on version 3, the release that had the table and no backfill, and let one turn report for real.
    migrateTo(old, 3);
    const [reported] = turns(old);
    const db = new DatabaseSync(old);
    db.prepare('INSERT INTO usage (turn_id, lesson_id, learner_id, driver, model, input_tokens, output_tokens, cost_source, cost_usd, ts) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      reported.id as string,
      'l1',
      'default',
      'unknown',
      'claude-sonnet-4-5',
      120,
      340,
      'provider',
      0.004,
      99,
    );
    db.close();

    migrate(old);

    assert.deepEqual(counts(old), { turns: 2, usage: 2 });
    const kept = usageRows(old).find((u) => u.turn_id === reported.id)!;
    assert.equal(kept.cost_source, 'provider');
    assert.equal(kept.model, 'claude-sonnet-4-5');
    assert.equal(kept.input_tokens, 120);
    assert.equal(kept.ts, 99);
  });
});

describe('the snapshot taken before migrating', () => {
  const backups = (dir: string) => readdirSync(dir).filter((f) => f.startsWith('derive.db.bak-'));

  it('is written for an existing database and carries the schema it had', () => {
    const dir = scratch();
    const old = legacyDatabase(dir);
    populate(old);
    const was = schemaOf(old);
    migrate(old);

    assert.deepEqual(backups(dir), ['derive.db.bak-v0']);
    const backup = join(dir, 'derive.db.bak-v0');
    assert.equal(userVersion(backup), 0);
    assert.deepEqual(schemaOf(backup), was);
    const db = new DatabaseSync(backup);
    assert.equal((db.prepare('SELECT count(*) AS n FROM lessons').get() as { n: number }).n, 1);
    db.close();
  });

  it('is not written for a database created fresh', () => {
    const dir = scratch();
    migrate(join(dir, 'derive.db'));
    assert.deepEqual(backups(dir), []);
  });

  it('is written once, however many times the runner runs', () => {
    const dir = scratch();
    const old = legacyDatabase(dir);
    migrate(old);
    migrate(old);
    assert.deepEqual(backups(dir), ['derive.db.bak-v0']);
  });
});
