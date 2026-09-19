---
phase: 01-foundation
plan: 11
subsystem: database
tags: [sqlite, node:sqlite, transactions, data-deletion, usage-ledger, turns]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "withTx and the atomic deleteLesson/deleteLearner from plan 01-05, and the turns (migration 2) and usage (migration 3) tables from plan 01-06"
provides:
  - "q.deleteUsageByLesson / q.deleteTurnsByLesson: the per-lesson deletes for the two tables migrations 2 and 3 added"
  - "q.deleteUsageOfLearner / q.deleteTurnsOfLearner: the learner-scoped deletes that catch rows whose lesson row is already gone"
  - "deleteLesson and deleteLearner clear turns and usage inside the transaction they already open"
  - "doc comments on both functions that list the tables they clear instead of promising 'everything'"
  - "server/test/tx.test.ts: childRows/ledgerOf row-count helpers and a 'the usage ledger' suite (adjacency, empty, orphaned rows, whole-table learner sweep)"
affects: [phase 03 (per-lesson cost display reads this ledger), phase 04 (the usage page), any later plan adding a per-lesson or per-learner table]

actuals:
  tokens: 3414
  tasks: 2
  commits: 2
  plan_head_before: f1c3cce151869d9068e846fa086481af4b923a3b

tech-stack:
  added: []
  patterns:
    - "A new per-lesson or per-learner table is not finished until deleteLesson (or deleteLearner) clears it and a case counts the rows"
    - "Delete order inside the transaction follows the reference direction: a row that names another is cleared first (usage before turns)"
    - "Delete cases compare a whole row-count object rather than field-by-field assertions, so a table nobody remembered shows up as a diff"

key-files:
  created: []
  modified:
    - server/src/db.ts
    - server/test/tx.test.ts

key-decisions:
  - "The learner-scoped deletes are kept even though deleteLearner loops deleteLesson: recordUsage and startTurn denormalise learner_id deliberately, so a row can outlive the lesson row it names, and the loop cannot reach it"
  - "Usage is deleted before turns inside deleteLesson's transaction, because a usage row names the turn it was recorded against"
  - "No migration, no index and no backfill: usage_lesson, usage_learner and turns_lesson already cover every filtered column, and reaching into rows the learner did not ask to remove was explicitly out of scope (T-11-06)"
  - "The orphan case removes only the lessons row directly rather than calling deleteLesson, because deleteLesson now clears the ledger itself — the plan's literal recipe would have passed without the learner-scoped deletes running at all"

patterns-established:
  - "Row-count object comparison: childRows(id) and ledgerOf(learnerId) return whole objects that are deepEqual'd before and after"
  - "Proof by removal: the fix's four call lines are temporarily stubbed out and the suite re-run, so a decorative case cannot pass unnoticed"

requirements-completed: [FOUND-05, COST-01]

coverage:
  - id: D1
    description: "Deleting a lesson removes its turns and usage rows inside the transaction it already opens, alongside its materials, memory, misconceptions, quiz results, nodes and events"
    requirement: FOUND-05
    verification:
      - kind: unit
        ref: "server/test/tx.test.ts#still removes everything when nothing goes wrong"
        status: pass
      - kind: unit
        ref: "server/test/tx.test.ts#leaves the lesson and every child row when a delete fails partway"
        status: pass
      - kind: integration
        ref: "scratch-database drive: createLesson x2, startTurn, recordUsage, deleteLesson — usage and turns for the deleted lesson return 0, the sibling's return 1 and 1"
        status: pass
    human_judgment: false
  - id: D2
    description: "A removed learner leaves behind no model id, no token count and no driver name anywhere in usage or turns, including rows whose lesson row is already gone"
    requirement: COST-01
    verification:
      - kind: unit
        ref: "server/test/tx.test.ts#leaves no row anywhere in usage or turns carrying a removed learner’s id"
        status: pass
      - kind: unit
        ref: "server/test/tx.test.ts#clears rows whose lesson row is already gone"
        status: pass
      - kind: unit
        ref: "server/test/tx.test.ts#removes the learner and both lessons as one write when nothing goes wrong"
        status: pass
    human_judgment: false
  - id: D3
    description: "A delete scoped to one lesson does not reach another lesson's rows, and an empty lesson or an id that never existed deletes without changing any count (T-11-03, edge probe adjacency + empty)"
    requirement: COST-01
    verification:
      - kind: unit
        ref: "server/test/tx.test.ts#takes only the deleted lesson’s rows, not its neighbour’s"
        status: pass
      - kind: unit
        ref: "server/test/tx.test.ts#deletes a lesson that never ran a turn, and an id that never existed"
        status: pass
    human_judgment: false
  - id: D4
    description: "The atomicity guarantee is unchanged: a failure partway through deleteLesson or deleteLearner still leaves every row exactly as it was, now including turns and usage (T-11-04)"
    requirement: FOUND-05
    verification:
      - kind: unit
        ref: "server/test/tx.test.ts#leaves the lesson and every child row when a delete fails partway"
        status: pass
      - kind: unit
        ref: "server/test/tx.test.ts#keeps both lessons when the second deleteLesson throws"
        status: pass
    human_judgment: false
  - id: D5
    description: "Both doc comments state what the code does — deleteLesson's names usage and turns by table name, deleteLearner's names the usage ledger (WR-01's second half, T-11-02)"
    verification:
      - kind: other
        ref: "grep -n 'usage rows and turns' server/src/db.ts (line 402, deleteLesson) and grep -n 'their whole usage ledger' server/src/db.ts (line 355, deleteLearner)"
        status: pass
    human_judgment: false
  - id: D6
    description: "No migration, index or backfill shipped: PRAGMA user_version stays at 3 and no learner's existing rows are touched (T-11-06)"
    verification:
      - kind: integration
        ref: "scratch-database drive reports user_version 3; grep -c 'version: 4' server/src/migrations.ts is 0"
        status: pass
    human_judgment: false
  - id: D7
    description: "Nothing else in the workspace moved: the whole suite and the build are green and the web app is untouched"
    verification:
      - kind: integration
        ref: "pnpm typecheck clean; pnpm build && pnpm test -> 144 pass / 0 fail (up from 140); git diff --quiet -- web/ exits 0"
        status: pass
    human_judgment: false

# Metrics
duration: 6 min
completed: 2026-09-19
status: complete
---

# Phase 01 Plan 11: Deleting the Usage Ledger With What It Belongs To Summary

**`deleteLesson` and `deleteLearner` now clear the `turns` and `usage` rows inside the transaction they already open, learner-scoped as well as lesson-scoped, and every delete case in `tx.test.ts` counts those rows before and after.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-09-19T14:28:43Z
- **Completed:** 2026-09-19T14:34:09Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- **Review finding WR-01 is closed.** Four prepared statements on the `q` object — `deleteUsageByLesson`, `deleteTurnsByLesson`, `deleteUsageOfLearner`, `deleteTurnsOfLearner` — and four call lines inside the two `withTx` callbacks that were already there. `grep -c 'DELETE FROM usage' server/src/db.ts` and `grep -c 'DELETE FROM turns'` both print `2`.
- **A removed learner leaves nothing of what they did.** The learner-scoped pair is not redundant with `deleteLearner`'s `deleteLesson` loop: `recordUsage` and `startTurn` denormalise `learner_id` onto every row on purpose, so a usage row or a turn can outlive the lesson row it names, and the loop reads `lessonsOfLearner` — which cannot see a lesson that is already gone. The `clears rows whose lesson row is already gone` case builds exactly that state and proves the loop alone would miss it.
- **Usage is deleted before turns**, with an inline comment saying why: a usage row names the turn it was recorded against, so clearing usage first means no state inside the transaction has a row pointing at a turn that is already gone.
- **Both doc comments now list the tables they clear.** `deleteLesson`'s names materials, memory, misconceptions, quiz results, nodes, events, usage rows and turns; `deleteLearner`'s names the lessons, the resources and the whole usage ledger, turns included. A general promise is what the last pair got wrong, so neither keeps one.
- **`tx.test.ts` went from 8 cases to 12.** `lessonWithHistory` now builds a turn and a usage row alongside its other child rows, so both success cases and both failure-partway cases cover the new tables without a new case being written. A `the usage ledger` suite adds the four the gap itself is about: adjacency (a sibling lesson's counts are untouched), empty (a lesson that never ran a turn, and an id that never existed), the orphan (a row whose lesson row is gone), and a whole-table sweep asserting no row anywhere carries the removed learner's id while every other learner's ledger is unchanged.
- **The cases were proven non-decorative by removal.** Stubbing out only the four call lines (leaving the statements) and re-running the suite produced **5 failing cases** — `still removes everything`, `removes the learner and both lessons as one write`, and three of the four new ones. `server/src/db.ts` was restored with a file-scoped `git checkout --` immediately afterwards and verified clean.
- **Nothing else moved.** `pnpm typecheck` clean; `pnpm build && pnpm test` reports **144 pass / 0 fail**, up from the 140 this phase had at the start of the plan, with no existing case changed in meaning. `git diff --quiet -- web/` exits 0. `PRAGMA user_version` on a freshly opened scratch database is still `3` and `grep -c 'version: 4' server/src/migrations.ts` is `0` — no migration, no index and no backfill shipped.

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer): a deleted lesson takes its turns and its usage rows with it** — `bc46193` (fix)
2. **Task 2: the cases count rows, including the ones that fail partway** — `0afe282` (test)

**Plan metadata:** see the `docs(01-11)` commit that follows this file.

## Files Created/Modified

- `server/src/db.ts` — four prepared statements (two beside the per-lesson deletes, two beside `deleteResourcesOfLearner`), four call lines inside the existing `withTx` callbacks, two inline why-comments, and both doc comments rewritten to list the tables.
- `server/test/tx.test.ts` — `finishTurn`, `listUsage`, `recordUsage` and `startTurn` added to the destructured import; `lessonWithHistory` builds a turn and a usage row; `childRows(id)` and `ledgerOf(learnerId)` row-count helpers; the four existing delete cases now compare whole row-count objects; a new `describe('the usage ledger')` with four cases.

## Decisions Made

- **The orphan case removes the `lessons` row directly rather than calling `deleteLesson`.** The plan's literal recipe was "create the lesson, its turn and its usage row, delete the lesson, then delete the learner" — but after task 1, `deleteLesson` clears the ledger itself, so by the time `deleteLearner` runs there is nothing left for the learner-scoped deletes to catch and the assertion would pass with those two lines removed. Deleting only the `lessons` row with a direct statement builds the state a denormalised `learner_id` actually makes possible, and the case asserts the rows are still present (`{ turns: 1, usage: 1 }`) *before* `deleteLearner` runs, so the learner-scoped deletes are what the `0` afterwards proves. The removal experiment confirms it: this case is one of the three new ones that fail without the fix.
- **Whole row-count objects, not field-by-field assertions.** `childRows(id)` returns every table `deleteLesson` clears. A future plan that adds a per-lesson table and forgets the delete sees a `deepEqual` diff naming the table, which is the failure mode WR-01 itself was.
- **No migration, no index, no sweep.** `usage_lesson`, `usage_learner` and `turns_lesson` already index every column these four statements filter on, and nothing reaches into rows that already exist — T-11-06 in the plan's own threat register, and the learner's ownership of their record.

## Deviations from Plan

### 1. [Configured behaviour, not a rule deviation] Committed to `main`

`git.branching_strategy` is `"none"` in `.planning/config.json`, and every GSD commit in this phase — plans 01-01 through 01-10 — is on `main`. The dispatch context instructed continuing on `main` rather than branching, so the phase stays on one ref. Recorded here the way plan 01-05 recorded it; no branch was created and `git.allow_default_branch_commits` was not written into the user's config.

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] The orphan case as written would have proven nothing**

- **Found during:** Task 2 (`the usage ledger`)
- **Issue:** The plan's recipe for the "a usage row whose lesson row has already been removed" case routes the removal through `deleteLesson`, which task 1 had just taught to clear the ledger. The case would have passed with the two learner-scoped call lines deleted — exactly the shape of failure the plan's own prohibition names ("an assertion that nothing threw would prove nothing").
- **Fix:** The case removes only the `lessons` row with a direct `DELETE FROM lessons WHERE id = ?`, asserts `{ turns: 1, usage: 1 }` still stand (so `lessonsOfLearner` demonstrably cannot reach them), then calls `deleteLearner` and asserts `{ turns: 0, usage: 0 }`.
- **Files modified:** `server/test/tx.test.ts`
- **Verification:** The removal experiment lists `clears rows whose lesson row is already gone` among the failing cases when the four call lines are stubbed out.
- **Committed in:** `0afe282`

---

**Total deviations:** 1 auto-fixed (1 missing critical) plus the configured `main` branch note.
**Impact on plan:** None on scope. The auto-fix strengthens one of the plan's own four required cases rather than adding work; no dependency was added (T-11-SC holds — this is four SQL statements and test cases on built-in `node:sqlite` and `node:test`).

## Issues Encountered

One tooling friction, no code impact: the repository's `block-no-verify` pre-tool hook rejected a `git commit -m "$(cat <<'EOF' ... )"` heredoc invocation for task 2. Re-issued with two `-m` flags; the commit ran with hooks enabled and `--no-verify` was never used.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **WR-01 is closed and its verification row can be re-checked.** `01-VERIFICATION.md`'s anti-pattern table entry for `server/src/db.ts:349-357, 386-397` and `01-REVIEW.md`'s WR-01 are both resolved by this plan; the sixth `missing:` item in the verification document is the same finding.
- **The pattern to keep:** a per-lesson or per-learner table is not finished until `deleteLesson`/`deleteLearner` clears it and a case counts the rows. Phase 03's per-lesson cost display and Phase 04's usage page read this ledger and inherit the guarantee that a removed learner leaves nothing in it.
- The review's suggested assertion in `server/test/usage.test.ts` (both tables empty after `DELETE /api/lessons/:id`) was placed in `tx.test.ts` instead, where the plan directed it and where the row-counting helpers live; `usage.test.ts` is unchanged and green.
- No blockers.

---
*Phase: 01-foundation*
*Completed: 2026-09-19*

## Self-Check: PASSED

- Both modified files exist on disk: `server/src/db.ts`, `server/test/tx.test.ts`; `.planning/phases/01-foundation/01-11-SUMMARY.md` written.
- Both task commits exist in history: `bc46193` (fix), `0afe282` (test).
- Plan-level verification re-run at close: `pnpm typecheck` clean; `pnpm --filter server exec node --import tsx --test test/tx.test.ts test/migrations.test.ts test/usage.test.ts` 30 pass / 0 fail; `pnpm build && pnpm test` 144 pass / 0 fail; `PRAGMA user_version` 3 on a fresh scratch database; `grep -c 'version: 4' server/src/migrations.ts` 0; `git diff --quiet -- web/` exits 0; the removal experiment produced 5 failing cases and `server/src/db.ts` was restored clean.
