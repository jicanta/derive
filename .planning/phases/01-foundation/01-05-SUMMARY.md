---
phase: 01-foundation
plan: 05
subsystem: database
tags: [sqlite, node:sqlite, migrations, user_version, transactions, wal, vacuum-into]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: the established server module conventions (prose module doc, named exports, `.js` import extensions) and the scratch-DERIVE_DATA_DIR test harness that every case here uses
provides:
  - "server/src/migrations.ts: MIGRATIONS / LATEST_VERSION / runMigrations(db), a numbered transactional runner keyed on PRAGMA user_version"
  - "migration 1 'baseline': the schema server/src/db.ts used to run inline, moved verbatim so an upgraded database and a fresh one hold byte-identical DDL"
  - "a VACUUM INTO snapshot written beside the database before the first pending migration, named for the version being left behind"
  - "withTx(fn) in server/src/db.ts: one re-entrant transaction, rollback and rethrow of the original error"
  - "replaceGraph, deleteLesson and deleteLearner are atomic"
  - "q.deleteNode: the per-node DELETE prepared once instead of inside replaceGraph's loop"
affects: [01-06 (turns and usage tables ride on this runner as migrations 2 and 3), 01-07 (data directory hardening covers the snapshot file), phase 03, phase 04]

actuals:
  tokens: 18700
  tasks: 3
  commits: 3
  plan_head_before: 93511729408e8a2e0311b49e7811f2c3fc4c1a66

tech-stack:
  added: []
  patterns:
    - "Numbered migrations: append one { version, name, up } entry to MIGRATIONS; the runner owns the transaction and the version bump"
    - "Verbatim baseline DDL: never re-indent or consolidate shipped schema text, because sqlite_master keeps the text a table was created with"
    - "withTx(fn) for any multi-statement write; re-entrant so callers can compose"

key-files:
  created:
    - server/src/migrations.ts
    - server/test/migrations.test.ts
    - server/test/tx.test.ts
  modified:
    - server/src/db.ts

key-decisions:
  - "The runner's seam for plan 01-06 is a single appended array entry: runMigrations(db, migrations = MIGRATIONS) keeps the one-argument call site in db.ts and gives tests a list that fails on purpose"
  - "Snapshot with VACUUM INTO, not a filesystem copy: the database runs in WAL mode, so a raw copy of the .db file can miss committed pages still in the write-ahead log"
  - "A database is snapshotted when sqlite_master is non-empty, not when the file exists: DatabaseSync creates the file on open, so file existence cannot tell a fresh database from an old one"
  - "PRAGMA user_version is interpolated because SQLite forbids a bound parameter there; the value comes only from a migration record and is re-checked as a non-negative integer immediately before use"
  - "withTx keeps a module-level depth counter and joins rather than nesting, because SQLite has no nested BEGIN and deleteLearner calls deleteLesson in a loop"
  - "Failures partway are forced in tests with a RAISE(ABORT) trigger and a NOT NULL violation — real statement failures inside the transaction, not a simulated throw"

patterns-established:
  - "Migration list as the single source of what schema a file is on: PRAGMA user_version is read, never guessed"
  - "Each migration's up() and its version bump share one transaction, so a crash leaves the previous version rather than a half-migrated file"
  - "Schema equivalence is asserted as deep-equal sqlite_master rows plus pragma_table_info per table, upgraded database against fresh"

requirements-completed: [FOUND-05]

coverage:
  - id: D1
    description: "Schema changes run through a numbered migration runner keyed on PRAGMA user_version; each migration applies inside its own transaction that also carries its version bump"
    requirement: FOUND-05
    verification:
      - kind: unit
        ref: "server/test/migrations.test.ts#starts at migration 1, the baseline"
        status: pass
      - kind: unit
        ref: "server/test/migrations.test.ts#rolls back, leaving the version and the half-built table where they were"
        status: pass
    human_judgment: false
  - id: D2
    description: "An existing ~/.derive/derive.db migrates forward onto exactly the schema a fresh database gets, keeping every row"
    requirement: FOUND-05
    verification:
      - kind: unit
        ref: "server/test/migrations.test.ts#lands an existing database on exactly the schema a fresh one gets"
        status: pass
      - kind: unit
        ref: "server/test/migrations.test.ts#leaves the learner every row they had"
        status: pass
      - kind: integration
        ref: "node check.mjs against a copy of the real 274KB ~/.derive/derive.db (1 lesson, 12 nodes, 46 events, 8 quiz results, 4 materials): user_version 0 -> 1, schema text unchanged, counts unchanged, upgraded schema === fresh schema, original file sha256 unchanged"
        status: pass
    human_judgment: false
  - id: D3
    description: "An existing database is snapshotted before any pending migration runs, with a WAL-correct single-file copy; a fresh database is not, and an existing snapshot is never overwritten"
    verification:
      - kind: unit
        ref: "server/test/migrations.test.ts#is written for an existing database and carries the schema it had"
        status: pass
      - kind: unit
        ref: "server/test/migrations.test.ts#is not written for a database created fresh"
        status: pass
      - kind: unit
        ref: "server/test/migrations.test.ts#is written once, however many times the runner runs"
        status: pass
    human_judgment: false
  - id: D4
    description: "A failing migration rolls back, logs one [migrate] line naming the migration by number and name, and throws a lowercase sentence pointing at the snapshot — which at import time means the server does not start"
    verification:
      - kind: unit
        ref: "server/test/migrations.test.ts#rolls back, leaving the version and the half-built table where they were"
        status: pass
      - kind: unit
        ref: "server/test/migrations.test.ts#says which migration failed, in a lowercase sentence, and logs one [migrate] line"
        status: pass
    human_judgment: false
  - id: D5
    description: "replaceGraph, deleteLesson and deleteLearner are transactional and leave no partial state; withTx is re-entrant so deleteLearner's deleteLesson loop is one write"
    verification:
      - kind: unit
        ref: "server/test/tx.test.ts#leaves the old graph exactly as it was when an upsert fails partway"
        status: pass
      - kind: unit
        ref: "server/test/tx.test.ts#leaves the lesson and every child row when a delete fails partway"
        status: pass
      - kind: unit
        ref: "server/test/tx.test.ts#keeps both lessons when the second deleteLesson throws"
        status: pass
      - kind: unit
        ref: "server/test/tx.test.ts#does not begin a second transaction when nested"
        status: pass
    human_judgment: false
  - id: D6
    description: "Nothing the tutor does or says to the learner changed: the existing model-free lesson harness is untouched and green"
    verification:
      - kind: integration
        ref: "pnpm build && pnpm test (server/test/api.test.ts plan approval, teach, lock, cumulative quiz, warm-up)"
        status: pass
    human_judgment: false

duration: 17 min
completed: 2026-09-18
status: complete
---

# Phase 01 Plan 05: Migration Runner and Atomic Writes Summary

**A numbered `PRAGMA user_version` migration runner whose baseline is the old inline schema verbatim, a `VACUUM INTO` snapshot before every upgrade, and `withTx` making `replaceGraph`, `deleteLesson` and `deleteLearner` atomic.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-09-18T11:58:40Z
- **Completed:** 2026-09-18T12:15:40Z
- **Tasks:** 3
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments

- `server/src/migrations.ts` holds `MIGRATIONS`, `LATEST_VERSION` and `runMigrations(db)`. The runner reads `PRAGMA user_version`, applies each higher-numbered migration inside its own transaction that also sets the new version, and returns the version the file ends on. A database already at the top is left untouched and nothing is written.
- Migration 1, `baseline`, is the block `server/src/db.ts` used to run inline, moved over verbatim: the `CREATE TABLE IF NOT EXISTS` string byte-for-byte (kept as a module-level `BASELINE_SCHEMA` const so its original indentation survives), the `for (const ddl of [...])` try/catch `ALTER TABLE` list with every "why" comment and the `/* column exists */` comment, and the two `CREATE INDEX` statements. That is what makes an upgraded database and a fresh one converge: SQLite stores the text a table was created with, so tidied DDL would have made the two paths permanently different.
- `server/src/db.ts` now calls `runMigrations(db)` on line 13 — after `PRAGMA journal_mode = WAL` on line 12, before the `q` prepared-statement object on line 89 — the exact slot the schema block vacated, because every consumer of the module assumes the schema exists at import.
- Before the first pending migration, an existing database is copied beside itself with `VACUUM INTO` as `derive.db.bak-v<version-left-behind>`. WAL is why it is `VACUUM INTO` and not a file copy. A fresh database (empty `sqlite_master`) is never snapshotted, and an existing snapshot of that version is never overwritten.
- A migration that throws rolls its transaction back, logs one `[migrate]`-tagged line naming the number and name, and rethrows a lowercase sentence naming the migration, the version the database is still on, and where the snapshot is. At import time that makes the server refuse to start rather than serve on a schema nobody can name.
- `withTx(fn)` in `server/src/db.ts`: begin, run, commit, and on a throw roll back and rethrow the original error unchanged. Re-entrant via a module-level depth counter, so `deleteLearner` looping over `deleteLesson` is one transaction rather than a failed nested `BEGIN`. `deleteLesson`, `replaceGraph` and `deleteLearner` are each wrapped, and the per-node `DELETE FROM nodes` is prepared once in `q` as `deleteNode` instead of inside `replaceGraph`'s loop.
- Proven against the real thing: a **copy** of the developer's actual `~/.derive/derive.db` (274 KB, 1 lesson, 12 nodes, 46 events, 8 quiz results, 4 materials) migrated from `user_version` 0 to 1 with its `sqlite_master` text unchanged, every row count unchanged, a `derive.db.bak-v0` written beside it, and its resulting schema deep-equal to a freshly created database. The original file's sha256 was identical before and after; nothing in this plan ever opened it.

## Task Commits

Each task was committed atomically:

1. **Task 1: a numbered runner, the existing schema as migration 1, and an old database migrating forward** — `6deb698` (feat)
2. **Task 2: snapshot before migrating, roll back on failure, refuse to start on a half-known schema** — `5c5e768` (feat)
3. **Task 3: withTx, and the three destructive writes made atomic** — `4b08339` (fix)

## Files Created/Modified

- `server/src/migrations.ts` (new, 264 lines) — the prose module doc explaining why verbatim is load-bearing and how to add migration 2, `BASELINE_SCHEMA`, the `Migration` type, `MIGRATIONS`, `LATEST_VERSION`, `currentVersion`, `fileOf`, `snapshot` and `runMigrations`.
- `server/src/db.ts` — schema block replaced by `runMigrations(db)`; `withTx` added after the `q` object; `q.deleteNode` added; `deleteLesson`, `replaceGraph` and `deleteLearner` wrapped.
- `server/test/migrations.test.ts` (new) — the legacy DDL embedded verbatim with `git show 9351172:server/src/db.ts` named as its source, then nine cases across the runner, the failure path and the snapshot.
- `server/test/tx.test.ts` (new) — eight cases driving the real `db.ts` functions against a scratch database, counting rows before and after.

## Decisions Made

- **The seam plan 01-06 rides on is one appended array entry.** `runMigrations(db, migrations = MIGRATIONS)` keeps db.ts's one-argument call site and the plan-01-06 contract intact, while giving tests a list that fails on purpose without touching the exported one. Adding migration 2 is: append `{ version: 2, name: 'turns', up(db) { ... } }`. The module doc says so in as many words, and says to use a plain `CREATE TABLE` past the baseline because `IF NOT EXISTS` would hide the mistake the version number exists to catch.
- **`VACUUM INTO`, not `copyFileSync`.** The database is in WAL mode; a raw copy of the `.db` file alone can miss committed pages still in the `-wal`. A backup that quietly drops the last lesson is worse than none.
- **Snapshot when `sqlite_master` is non-empty, not when the file exists.** `new DatabaseSync(path)` creates the file on open, so by the time the runner sees the handle the file always exists. "Has something to lose" is the honest test, and it is what makes a fresh database produce no `derive.db.bak-*` at all.
- **`PRAGMA user_version` interpolation is fenced** (T-05-01): the value comes only from a `MIGRATIONS` record, is re-validated as a non-negative integer immediately before the statement is built, and nothing else can reach it.
- **The baseline schema string lives as a module-level `const`** rather than inline inside `up()`. Indentation is part of the bytes SQLite stores; keeping the literal at module level preserves the original layout exactly, where inlining it into a function body would either change it or look broken.
- **Failures in tests are real.** A `CREATE TRIGGER ... SELECT RAISE(ABORT, 'boom')` makes a specific `DELETE` fail mid-transaction, and a `NOT NULL` label makes `replaceGraph`'s second upsert fail after the deletes have already run. `deleteLearner`'s trigger is narrowed with `WHEN OLD.id = 'learner-l2'` so the *second* `deleteLesson` is the one that throws — both lessons surviving is then the thing that proves the loop is one write.

## Deviations from Plan

### 1. [Configured behaviour, not a rule deviation] Committed to `main`

`git.branching_strategy` is `"none"` in `.planning/config.json`, and every GSD commit in this repository — plans 01-01 through 01-04 included — is on `main`. Recorded here the way the earlier plans recorded it; no branch was created.

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `runMigrations` needed an optional migration list**

- **Found during:** Task 2 (the failing-migration cases)
- **Issue:** The plan requires a test that appends a deliberately failing migration "to a copy of the list inside the test rather than to the exported one", but `runMigrations(db)` read `MIGRATIONS` directly, so no copy could reach it.
- **Fix:** `runMigrations(db, migrations: Migration[] = MIGRATIONS)`. The one-argument call site in `db.ts` and plan 01-06's contract are unchanged; the parameter is documented as a test seam.
- **Files modified:** `server/src/migrations.ts`
- **Verification:** `server/test/migrations.test.ts` "a migration that fails" suite passes; `pnpm typecheck` and `pnpm build && pnpm test` green.
- **Committed in:** `5c5e768`

**2. [Rule 2 - Missing Critical] Proved the upgrade on a populated database, not only an empty one**

- **Found during:** Task 1
- **Issue:** The plan's cases built a legacy database with no rows in it. A migration runner whose only proof is on empty tables proves nothing about the learner's actual record.
- **Fix:** Added `populate()` to the test (a lesson, a three-node graph with a locked node carrying FSRS state, an event, a quiz result) and a case asserting every row survives the upgrade. Separately ran the runner against a **copy** of the developer's real `~/.derive/derive.db` and checked the original's sha256 before and after.
- **Files modified:** `server/test/migrations.test.ts`
- **Verification:** "leaves the learner every row they had" passes; the real-database run reported `user_version 0 -> 1`, schema text unchanged, counts unchanged, upgraded schema deep-equal to fresh, original sha256 unchanged.
- **Committed in:** `6deb698`

**3. [Rule 1 - Bug] `assert.deepEqual` against node:sqlite rows**

- **Found during:** Task 1
- **Issue:** `node:sqlite` returns rows with a null prototype, so `assert/strict`'s `deepEqual` failed against plain object literals even when every field matched.
- **Fix:** Spread the rows (`.map((r) => ({ ...r }))`) where they are compared to literals, with a one-line comment saying why.
- **Files modified:** `server/test/migrations.test.ts`
- **Verification:** the case passes.
- **Committed in:** `6deb698`

---

**Total deviations:** 3 auto-fixed (1 blocking, 1 missing critical, 1 bug) plus the configured `main` branch note.
**Impact on plan:** None on scope. Two of the three exist to make the plan's own acceptance criteria testable at all; the third is a test-harness fix. No dependency was added — the runner uses only `node:sqlite` and `node:fs`, both built in (T-05-SC holds).

## Issues Encountered

None. `pnpm typecheck` is clean and `pnpm build && pnpm test` reports **59 pass / 0 fail** (up from 42 at the commit this plan started from; +17 new cases and no existing case changed). The existing `server/test/api.test.ts` lesson — plan approval, teaching, locking, cumulative quiz, next-lesson warm-up — is green, which is the net for "the schema an existing lesson relies on did not move".

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Plan 01-06 is unblocked and the runner's shape is what it needs.** Migrations 2 (`turns`, with its backfill from the event log) and 3 (`usage`) are two appended entries in `MIGRATIONS`; the runner supplies the transaction, the version bump, the rollback and the snapshot. The backfill pass named in 01-06's T-06-05 runs inside migration 2's transaction and rolls back with it for free.
- `withTx` is available for any multi-statement write 01-06 adds, and is re-entrant, so a write inside an existing transaction composes.
- **One thing worth knowing at 01-07:** the snapshot file `derive.db.bak-v<n>` is written into `DATA_DIR` beside the database and inherits the directory's mode. Plan 01-07's data-directory hardening should cover it (T-05-04 assumed exactly this).
- No blockers.

---
*Phase: 01-foundation*
*Completed: 2026-09-18*

## Self-Check: PASSED

- All created files exist on disk: `server/src/migrations.ts`, `server/test/migrations.test.ts`, `server/test/tx.test.ts`, and the modified `server/src/db.ts`.
- All three task commits exist in history: `6deb698`, `5c5e768`, `4b08339`.
- Plan-level verification re-run at close: `pnpm typecheck` clean, `pnpm build && pnpm test` 59 pass / 0 fail, `grep -c "withTx(" server/src/db.ts` = 4.
