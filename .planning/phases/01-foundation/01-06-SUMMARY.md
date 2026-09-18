---
phase: 01-foundation
plan: 06
subsystem: database
tags: [sqlite, migrations, usage-ledger, turns, cost, tokens, driver-seam]

# Dependency graph
requires:
  - phase: 01-04
    provides: the Driver/EventSink seam — the usage report is a sink method, and the sink's one idempotent endTurn guard is where D-16's completeness rule is enforced
  - phase: 01-05
    provides: the numbered transactional migration runner — migrations 2 and 3 are appended array entries, and the backfill rides inside migration 2's transaction
provides:
  - "migration 2 'turns': the turns table (id, lesson, learner, driver, model, started_at, ended_at, status) plus an index on (lesson_id, started_at), backfilled from the existing event log"
  - "migration 3 'usage': the usage table — five nullable token columns, model, cost_source, cost_usd — with indexes on turn_id, (learner_id, ts) and lesson_id"
  - "server/src/db.ts: TurnStatus, TURN_STATUSES, TurnRow, turnStatusOf, startTurn, finishTurn, getTurn, lastTurn, openTurns, closeOpenTurns"
  - "server/src/db.ts: CostSource, COST_SOURCES, UsageRow, UsageInput, recordUsage, listUsage, closeUsage"
  - "EventSink.usage(row) in server/src/driver.ts, and a `usage` step in the fake driver"
  - "busy() and the boot restart sweep read the turns table instead of every event of every lesson"
  - "server/test/usage.test.ts: nine cases over the ledger, model-free for the app path and server-driven for the companion path"
affects: [phase 03 (turn_messages resume state foreign-keys to turns.id; the owned loop reports usage per request), phase 04 (the usage page reads usage with no join), 01-07, 01-08]

actuals:
  tokens: 12500
  tasks: 3
  commits: 2
  plan_head_before: 4e09d2b1081276b1ece302625b36333641cc4b5d

tech-stack:
  added: []
  patterns:
    - "One write path per denormalised table: recordUsage takes lesson, learner and driver off the turn row, never from its caller"
    - "A turn is a row and an event at once: the row is what code reads, the event is what the learner's log replays"
    - "Unreported means null plus an explicit source label, never zero and never an estimate"

key-files:
  created:
    - server/test/usage.test.ts
  modified:
    - server/src/migrations.ts
    - server/src/db.ts
    - server/src/driver.ts
    - server/src/drivers/fake.ts
    - server/src/agent.ts
    - server/src/codex.ts
    - server/src/index.ts
    - server/test/migrations.test.ts
    - server/test/driver.test.ts
    - server/test/api.test.ts

key-decisions:
  - "Checkpoint resolved as `as-proposed`: COST-01 asks for the model id at request time, and `normalised` loses it when a turn changes model mid-turn — which Phase 3's owned loop with a retry on a different model can do"
  - "The option's recorded downside is closed at the source: recordUsage is the only way a usage row is written, and it reads lesson_id, learner_id and driver off the turn, so a caller cannot file a request under a lesson its turn does not belong to"
  - "The sink owns the turn's row: sinkFor(lessonId, turnId) closes the row inside the same idempotent guard that emits turn_end, so the row and the narrative cannot disagree and neither can be written twice"
  - "finishTurn only updates a turn still running, so the boot sweep and a late driver call cannot rewrite how a turn ended"
  - "The Claude driver reports one row per entry of the SDK's modelUsage — its per-model breakdown is the only source that carries the model id in effect — falling back to the turn-level usage when it is absent"
  - "cost_source is 'subscription' when no price was reported: the app path runs on a Claude Code or ChatGPT login, not on metered billing, and a zero would read as free"
  - "Backfilled agent turns carry driver 'unknown': which backend ran a turn before this table existed was never written down, and 'unknown' is the honest value"

patterns-established:
  - "Appending a migration: one { version, name, up } entry with a plain CREATE TABLE; a data pass belongs inside the same up(), where the runner's transaction rolls it back with the schema"
  - "A hot read path gets a row, not a scan: busy() and the boot sweep do one indexed query where they walked the whole event log"
  - "Accounting stays out of the event stream: a sink method writes it, so the browser reducer, the SSE stream and the Obsidian mirror never see it"

requirements-completed: [COST-01, FOUND-05]

coverage:
  - id: D1
    description: "A turns table exists and carries every turn; busy() and the boot restart sweep read it instead of every event of every lesson (D-15)"
    requirement: FOUND-05
    verification:
      - kind: integration
        ref: "server/test/api.test.ts#is busy while its turn row is running, and idle once the terminal ends it"
        status: pass
      - kind: unit
        ref: "server/test/driver.test.ts#leaves one turn row, closed the way the turn ended"
        status: pass
      - kind: other
        ref: "grep -v comments server/src/index.ts | grep -c listEvents -> 4, down from 6 at b8f255c"
        status: pass
    human_judgment: false
  - id: D2
    description: "An existing database migrates forward with its turn history backfilled from the event log, so a lesson whose last turn never ended is still reported busy after the upgrade"
    requirement: FOUND-05
    verification:
      - kind: unit
        ref: "server/test/migrations.test.ts#opens one row per turn_start and closes the ones the log ended"
        status: pass
      - kind: unit
        ref: "server/test/migrations.test.ts#reads how a turn ended out of its payload"
        status: pass
      - kind: unit
        ref: "server/test/migrations.test.ts#carries the lesson's learner and terminal, and says \"unknown\" where nothing was recorded"
        status: pass
      - kind: integration
        ref: "node check.mjs against a copy of the real ~/.derive/derive.db (1 lesson, 46 events, 12 nodes, 3 turn_start / 0 turn_end): user_version 0 -> 3, every row count unchanged, 3 turns rows (2 interrupted, 1 running), original sha256 identical"
        status: pass
    human_judgment: false
  - id: D3
    description: "Usage is recorded per model request in its own table, with raw counts, the model id at that time and a cost source (COST-01, D-13)"
    requirement: COST-01
    verification:
      - kind: unit
        ref: "server/test/usage.test.ts#writes one row per request, all under the one turn"
        status: pass
      - kind: unit
        ref: "server/test/usage.test.ts#keeps the model each request actually ran on, even when the turn changed model partway"
        status: pass
      - kind: unit
        ref: "server/test/usage.test.ts#reads the rows of a turn back in the order they were made, run after run"
        status: pass
      - kind: unit
        ref: "server/test/usage.test.ts#files every row under one of the four cost sources"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every turn has a usage row regardless of driver; unreported means null and 'unknown', never an estimate (D-16)"
    requirement: COST-01
    verification:
      - kind: unit
        ref: "server/test/usage.test.ts#still leaves exactly one row, blank and honest"
        status: pass
      - kind: unit
        ref: "server/test/usage.test.ts#leaves one row for a turn whose driver said nothing at all"
        status: pass
      - kind: unit
        ref: "server/test/usage.test.ts#does not add a blank row to a turn that did report"
        status: pass
      - kind: integration
        ref: "server/test/usage.test.ts#is still in the ledger, saying its tokens were never reported"
        status: pass
    human_judgment: false
  - id: D5
    description: "Usage never reaches the event stream: no new EVENT_TYPES entry, no applyEvent branch, no cost line in the learner's Obsidian notes (D-14)"
    verification:
      - kind: unit
        ref: "server/test/usage.test.ts#reaches the ledger without reaching the lesson log"
        status: pass
      - kind: other
        ref: "git diff --quiet -- web/ (exit 0)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Both real drivers report what their provider actually said — the Claude SDK's per-model breakdown, and Codex's turn.completed usage"
    requirement: COST-01
    verification:
      - kind: other
        ref: "grep -c 'sink.usage' server/src/agent.ts server/src/codex.ts -> 2 and 1"
        status: pass
      - kind: integration
        ref: "pnpm build && pnpm test — 74 pass / 0 fail"
        status: pass
    human_judgment: true
    rationale: "The automated suite drives every path with no model, so it proves the seam and the ledger but never sees a real provider's usage payload. That a live Claude turn and a live Codex turn write the counts their SDK reports is the documented manual run named in 01-CONTEXT.md, and it needs a real login."
  - id: D7
    description: "Nothing the tutor does or says to the learner changed"
    verification:
      - kind: integration
        ref: "pnpm build && pnpm test — server/test/api.test.ts (plan approval, teach, lock, cumulative quiz, warm-up) green, 74 pass / 0 fail"
        status: pass
    human_judgment: false

# Metrics
duration: 25 min
completed: 2026-09-18
status: complete
---

# Phase 01 Plan 06: The Usage Ledger and the Turns Table Summary

**Every model request now has a row with its raw counts and the model it ran on, every turn has a row even when its driver reported nothing, and the two hot paths that used to read every event of every lesson do one indexed query instead.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-09-18T12:11:00Z
- **Completed:** 2026-09-18T12:36:00Z
- **Tasks:** 3 of 3 (one checkpoint, two implementation)
- **Files modified:** 11 (1 created, 10 modified)

## Checkpoint Resolved

**Task 0 — "Fix the column set and the primary key of the turns and usage tables" — selected option: `as-proposed`.**

The shape built is exactly the one the plan's context named: `turns(id TEXT PRIMARY KEY, lesson_id, learner_id, driver, model, started_at, ended_at, status)` with status one of `running | ok | interrupted | error`, and `usage(id INTEGER PRIMARY KEY AUTOINCREMENT, turn_id, lesson_id, learner_id, driver, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, reasoning_tokens, cost_source, cost_usd, ts)` with `cost_source` one of `provider | table | subscription | unknown`, every token column nullable, and indexes on `turn_id`, on `(learner_id, ts)` and on `lesson_id`.

**Rationale:** COST-01 asks for the model id at request time, and `normalised` loses it when a turn changes model mid-turn — which Phase 3's owned loop with a retry on a different model can do. No provider request id and no raw provider-usage JSON column were added: if a request id proves necessary later it is an additive nullable column and a cheap migration 4, not the one-way door this checkpoint was about.

**The option's recorded downside is closed at the source.** `as-proposed`'s con is that `usage`'s denormalised `lesson_id` / `learner_id` / `driver` / `model` can drift from the turn row if a later phase writes them carelessly. So there is exactly one function that inserts a usage row — `recordUsage(turnId, row)` — and it reads the lesson, learner and driver off the turn rather than taking them from its caller. A caller cannot supply a different lesson or learner than the turn has. `server/src/db.ts`'s module text says so where the next phase will read it: *"Keep it that way — a second write path is how those columns start disagreeing with `turns`."*

## Accomplishments

- **Migration 2, `turns`.** A plain `CREATE TABLE` (past the baseline the runner guarantees the version, so `IF NOT EXISTS` would hide the mistake the version number exists to catch), an index on `(lesson_id, started_at)`, and a backfill that walks the existing event log once: each `turn_start` opens a turn, the next `turn_end` for that lesson closes it with the status its payload implies, and a start with nothing after it stays `running`. A second start with the first still open closes the first as `interrupted` — a turn that died without reporting, superseded by a later one.
- **Migration 3, `usage`.** Five nullable token columns, the model, `cost_source`, `cost_usd`, and the three indexes Phase 4's page will read on.
- **`server/src/db.ts` gained a turns section and a usage section** in the file's own style: snake_case row types, unions of string literals with an `as const`-style runtime list beside them (`TURN_STATUSES`, `COST_SOURCES`), statements prepared once in `q`, a one-line `/** */` on every export. `finishTurn` updates only a turn still `running`, so the boot sweep and a late driver call cannot rewrite how a turn ended.
- **`busy()` is one indexed read.** It was `listEvents(id)` followed by a reverse scan for the last `turn_start`/`turn_end` — on every lesson of every listing, since `GET /api/lessons` calls it per lesson. It is now `lastTurn(id)?.status === 'running'`. The boot restart sweep was a walk of every event of every lesson; it is now one `closeOpenTurns('interrupted')`, and the rows it closed are exactly the lessons still owed a `turn_end` event. The filtered `listEvents` count in `server/src/index.ts` fell from 6 to 4.
- **`turn_end` is still emitted, unchanged.** Only the reading moved. `web/src/lib/useLesson.ts`, the SSE stream and the Obsidian export are untouched — `git diff --quiet -- web/` exits 0.
- **`EventSink.usage(row)`.** A sink method, not an event, per D-14: an event would put a token count in the lesson's replayable log, in the browser's reducer and in the learner's notes. `sinkFor(lessonId, turnId)` implements it as `recordUsage(turnId, row)`, and both real drivers plus `server/src/drivers/fake.ts` satisfy it.
- **The Claude driver reports one row per entry of the SDK's `modelUsage`** — its per-model breakdown is the only source that carries the model id actually in effect, which a turn that retried on a second model would otherwise lose — falling back to the turn-level `usage` against the model the turn asked for when it is absent. The Codex driver reports from the `usage` object `turn.completed` already carries. Fields the table has no column for are dropped; columns nothing was reported for stay null.
- **D-16's completeness rule lives in one place per path.** `closeUsage(turnId)` writes one row of nulls with `cost_source: 'unknown'` if and only if nothing was recorded for that turn; the sink's `endTurn` guard calls it after `finishTurn`, and so does the external `end` action, which is how a lesson run in the learner's own terminal stays in the ledger saying "tokens not reported" rather than vanishing from it.
- **Nothing is estimated.** No transcript length, character count, word count or any other proxy appears anywhere in the write path. `reported()` in `server/src/agent.ts` turns anything that is not a finite number the provider actually gave into `null`.
- **Proven against the real thing, twice.** A **copy** of the developer's actual `~/.derive/derive.db` (1 lesson, 46 events, 12 nodes, 8 quiz results, 4 materials, still on `user_version` 0) migrated 0 → 2 and then 0 → 3 with every row count unchanged, a `derive.db.bak-v0` snapshot written beside it, and three `turns` rows backfilled from its three `turn_start` events — two `interrupted`, one still `running`, which is what makes the next real server start close that lesson properly instead of leaving the page stuck. The original file's sha256 was identical before and after both runs; nothing in this plan ever opened it.

## Task Commits

Each task was committed atomically:

1. **Task 0: checkpoint — the column set and primary keys** — resolved as `as-proposed` (no commit; a decision, not a change)
2. **Task 1: the turns table, and the read path that stops scanning every event** — `0612d12` (feat)
3. **Task 2: the usage table, per-request reporting, and a row for every turn even when nothing is reported** — `01fbc7b` (feat)

## Files Created/Modified

- `server/src/migrations.ts` — migrations 2 and 3 appended to `MIGRATIONS`, plus `backfillTurns(db)` with a prose block on why the one-time O(events) walk is what buys the removal of the per-request O(events) scan.
- `server/src/db.ts` (+214 lines) — a `// ---------- turns ----------` section and a `// ---------- usage ----------` section; nine prepared statements added to `q`.
- `server/src/driver.ts` — `sinkFor(lessonId, turnId)`; `EventSink.usage`; the end guard now closes the turn row and guarantees its usage row before emitting `turn_end`.
- `server/src/drivers/fake.ts` — a `{ kind: 'usage'; row: UsageInput }` step, so a scripted turn can report provider calls with no SDK.
- `server/src/agent.ts` — `startTurn` beside the `turn_start` emit (the driver is now chosen first, only so the row can name it), `sinkFor(lessonId, turnId)`, and `reportUsage()` for the Claude path.
- `server/src/codex.ts` — `sink.usage` on `turn.completed`.
- `server/src/index.ts` — the boot sweep, `busy()`, the two external `turn_start` sites and the external `end` action.
- `server/test/usage.test.ts` (new, 210 lines) — nine cases: two-request sums under one turn, the model per request, insertion order across runs, the four cost sources, three silent-turn cases, the "no usage event was persisted" assertion, and a spawned-server case for the terminal path.
- `server/test/migrations.test.ts` — four backfill cases, including the plan's three-start/two-end database.
- `server/test/driver.test.ts` — a turn-row case over `ok`, `interrupted`, `error` and a driver that says nothing.
- `server/test/api.test.ts` — busy true while the companion turn is running, false once `end` closes it, driven over HTTP.

## Decisions Made

- **The sink owns the turn's row.** `endTurn` was already the one idempotent guard in the codebase (plan 01-04); closing the row inside it means the row and the lesson's narrative cannot disagree about how a turn ended, and neither can be written twice, whichever driver ended it.
- **`finishTurn` is `WHERE status = 'running'`.** The first ending is the true one. Without the clause, a boot sweep or a late call could overwrite a turn that had already reported.
- **Backfilled agent turns carry `driver` `'unknown'`.** Which backend ran a turn before this table existed was never recorded. `'unknown'` is the honest value, and it is the same stance the ledger takes on unreported tokens.
- **`cost_source` is `'subscription'` when no price was reported.** The app path runs on the learner's Claude Code or ChatGPT login rather than metered billing; a `cost_usd` of zero would read as "this was free".
- **The Claude path prefers `modelUsage` over the turn-level `usage`.** The SDK's own note says `usage` is the main agent loop only and to prefer `modelUsage` for accounting; more to the point, `modelUsage` is keyed by the model id, which is exactly the field COST-01 asks for and the thing the `normalised` option would have lost.
- **`recordUsage` throws when the turn is missing.** A usage row with no turn is not a row worth writing, and every caller has a real turn id; a silent skip would hide a wiring bug behind a missing row.
- **The migration's status mapping is written out twice, deliberately.** `turnStatusOf` lives in `server/src/db.ts`, which imports `migrations.ts` to run at all, so the migration cannot import it back. Both sides carry a comment naming the other.

## Deviations from Plan

### 1. [Configured behaviour, not a rule deviation] Committed to `main`

`git.branching_strategy` is `"none"` in `.planning/config.json`, and every GSD commit in this repository — plans 01-01 through 01-05 included — is on `main`. Recorded here the way the earlier plans recorded it; no branch was created.

### 2. [Necessary for the task's own acceptance criteria] Task 1 touched three test files its `<files>` list did not name

- **Found during:** Task 1
- **Issue:** Task 1's `<files>` names only source files, but its acceptance criteria require a migration-backfill test ("three `turn_start` events and two matching `turn_end` events → three rows, exactly one `running`"), a driver-level turn-row test ("a turn the test interrupts ends as `interrupted`") and an HTTP test ("a test drives both through the API").
- **Fix:** Added the backfill cases to `server/test/migrations.test.ts`, the turn-row case to `server/test/driver.test.ts` and the busy case to `server/test/api.test.ts` — extending the existing harnesses rather than inventing new ones, as the wave context asks.
- **Files modified:** `server/test/migrations.test.ts`, `server/test/driver.test.ts`, `server/test/api.test.ts`
- **Verification:** `pnpm build && pnpm test` — 65 pass / 0 fail at that commit.
- **Committed in:** `0612d12`

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] The fake driver needed a `usage` step**

- **Found during:** Task 2
- **Issue:** The plan's first usage case is "a scripted fake-driver turn reporting two provider calls", but `FakeStep` had no way to report usage, so the case could not be written and no test could exercise `EventSink.usage` without an SDK.
- **Fix:** Added `{ kind: 'usage'; row: UsageInput }` to the `FakeStep` union and its branch in `fakeDriver.runTurn`. The fixture is permanent by design (plan 01-04), so the step belongs in it rather than in a test-local driver.
- **Files modified:** `server/src/drivers/fake.ts`
- **Verification:** `server/test/usage.test.ts` "a turn that reports what each request cost" passes; `pnpm typecheck` clean.
- **Committed in:** `01fbc7b`

**Total deviations:** 1 auto-fixed (Rule 2), 1 scope note, 1 configured-behaviour note.
**Impact:** None on the plan's shape. No dependency was added, no manifest or `pnpm-lock.yaml` was touched, and no UI control, panel or page was added — the usage page is Phase 4.

## Verification

| Check | Result |
|-------|--------|
| `pnpm typecheck` | clean, no `error TS` |
| `pnpm build && pnpm test` | 74 pass / 0 fail (was 59 at the plan's start commit) |
| `git diff --quiet -- web/` | exit 0 |
| `grep -v comments server/src/index.ts \| grep -c listEvents` | 4, strictly lower than the 6 at `b8f255c` (verified with `git show`) |
| `grep -c "sink.usage" server/src/agent.ts server/src/codex.ts` | 2 and 1 |
| `PRAGMA user_version` after migrating | 3 |
| `turns` / `usage` columns and indexes | exactly the set the checkpoint settled, including `turns_lesson`, `usage_turn`, `usage_learner`, `usage_lesson` |
| Copy of the real `~/.derive/derive.db`, 0 → 3 | every row count unchanged; 3 `turns` rows from 3 `turn_start` events (2 `interrupted`, 1 `running`); snapshot `derive.db.bak-v0` written; original sha256 identical before and after |

## Known Stubs

None. No placeholder value, no unreachable branch and no skipped test was left behind; nothing in the write path is estimated or defaulted to a stand-in.

## Issues Encountered

None.

## Next Phase Readiness

Plan 01-06 is complete. `turns.id` is the key Phase 3's `turn_messages` resume table can point at, and the usage grain is per model request, so Phase 3's owned loop reports each call and Phase 4's page reads `usage` with no join. The one thing still owed the milestone is the documented manual run named in `01-CONTEXT.md`: a live Claude turn and a live Codex turn, to see a real provider's usage payload land in the ledger (coverage entry D6).

## Self-Check: PASSED

- `server/test/usage.test.ts` — FOUND
- `.planning/phases/01-foundation/01-06-SUMMARY.md` — FOUND
- commit `0612d12` — FOUND
- commit `01fbc7b` — FOUND
- `git rev-list --count 4e09d2b..HEAD` before this commit — 2, matching `actuals.commits`
