---
phase: 01-foundation
plan: 18
subsystem: database
tags: [sqlite, migrations, transactions, ledger, usage, node-sqlite]

# Dependency graph
requires:
  - phase: 01-foundation (plan 05)
    provides: the numbered transactional migration runner on PRAGMA user_version, its per-migration transaction and its VACUUM INTO snapshot
  - phase: 01-foundation (plan 14)
    provides: the turns and usage tables, recordUsage as the single write path, and closeUsage's honest blank
  - phase: 01-foundation (plan 15)
    provides: closeOpenTurns sweeping every running turn through closeUsage, and the tx.test.ts ledgerOf harness
provides:
  - migration 4 `usage-backfill`, which gives every turn that ended before the ledger existed the same honest-blank usage row a terminal turn gets today
  - a ledger invariant in server/src/db.ts that names its own boundary, so the code and the sentence agree on an upgraded install
  - endTurn(turnId, status): finishTurn + closeUsage as one write under one transaction, at both sites that ran them separately
  - a reproduction path from pre-phase code at b8f255c proving an upgraded database reconciles
affects: [phase-04-usage-page, cost-accounting, any phase reading the turns/usage ledger]

# Actuals (#2632)
actuals:
  tokens: 5046
  tasks: 3
  commits: 2
plan_head_before: 2f10c9550df6046036a03167524763807758a37a

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A repair to data an earlier migration left incomplete lands as a NEW numbered migration, never as an edit to the applied one"
    - "A backfill writes the same blank the running code writes (nulls + 'unknown'), never a figure reconstructed from a proxy"
    - "A pair of writes whose second half no sweep can reach is one exported function under one withTx"

key-files:
  created: []
  modified:
    - server/src/migrations.ts
    - server/src/db.ts
    - server/src/driver.ts
    - server/src/index.ts
    - server/test/migrations.test.ts
    - server/test/tx.test.ts

key-decisions:
  - "A person answered Task 1's blocking-human checkpoint with `migration-4`: the ledger's stated invariant is made true by backfilling the rows, not by narrowing the claim"
  - "The backfill is migration 4, not a correction to migration 3, because a database already on user_version 3 would never re-run a corrected 3 — and those databases exist"
  - "Migration 4 skips turns still marked 'running': those are exactly the rows closeOpenTurns reaches at the next boot, so filling them here would leave them with two rows"
  - "A backfilled row's ts is COALESCE(ended_at, started_at) from the turn, not the moment of the upgrade, so a historical row sorts on the usage page where the turn actually happened"
  - "finishTurn keeps its own export: a caller that genuinely wants only the status write should have to say so"
  - "driver.ts imports the database function as endTurnRow, because the sink's own property is called endTurn"

patterns-established:
  - "Relative test-count floors: BASE is measured on the starting tree, and each task's floor stands on what the previous task actually recorded"
  - "A migration's acceptance is a reproduction from the real pre-phase commit in a detached worktree against a scratch DERIVE_DATA_DIR, never a fixture"

requirements-completed: [COST-01, FOUND-05]

coverage:
  - id: D1
    description: "Migration 4 `usage-backfill` gives every turn that ended before the ledger existed one honest-blank usage row, skips running turns, and writes nothing on a second run"
    requirement: "COST-01"
    verification:
      - kind: unit
        ref: "server/test/migrations.test.ts#the usage rows backfilled for turns the ledger never saw"
        status: pass
      - kind: manual_procedural
        ref: "detached worktree at b8f255c writes a database with its own server/src/db.ts; HEAD opens it — user_version 0 -> 4, turns: 1, usage: 1, derive.db.bak-v0 present"
        status: pass
    human_judgment: false
  - id: D2
    description: "The ledger invariant in server/src/db.ts states which turns it covers — ended turns, including the pre-ledger ones migration 4 filled; a running turn does not yet owe a row"
    requirement: "COST-01"
    verification: []
    human_judgment: true
    rationale: "The claim under test is a sentence, and on the migration-4 branch the plan asked for no source-read case pinning its wording (that case belonged to the qualify-the-sentence branch). A reader must judge that the prose matches the tree it sits in."
  - id: D3
    description: "endTurn ends a turn and closes its ledger row as one write at both call sites, so a crash between the halves applies neither and a turn closed twice carries one row"
    requirement: "COST-01"
    verification:
      - kind: unit
        ref: "server/test/tx.test.ts#ending a turn"
        status: pass
      - kind: integration
        ref: "server/test/api.test.ts (drives the external `end` action for real)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The repair lands as a new numbered migration at user_version 4 rather than as an edit to an already-applied migration"
    requirement: "FOUND-05"
    verification:
      - kind: unit
        ref: "server/test/migrations.test.ts#lands an existing database on exactly the schema a fresh one gets"
        status: pass
      - kind: other
        ref: "cd server && node --import tsx -e \"import('./src/migrations.ts').then(m => console.log(m.LATEST_VERSION))\" -> 4; git diff on migrations.ts is +40 lines, purely additive"
        status: pass
    human_judgment: false

# Metrics
duration: 21 min
completed: 2026-09-20
status: complete
---

# Phase 01 Plan 18: The ledger on an upgraded install Summary

**Migration 4 `usage-backfill` gives every pre-ledger turn the same honest blank a terminal turn gets, and `endTurn` makes ending a turn and closing its ledger row one transaction at both sites**

## Task 1 decision — the user's answer, verbatim

The blocking-human checkpoint at Task 1 asked how the ledger's stated invariant is made true on a database that has already been upgraded. The answer recorded before any code was written:

```
migration-4
```

That is option 1: add migration 4, `usage-backfill` — write the honest blank (five null counters, null `model`, `cost_source 'unknown'`) for every ended turn that has no usage row. It was the plan's own recommendation. The user was shown both options with their full trade-offs, including that migration 4 is a forward-only step on real learner databases, and chose this one. The `qualify-the-sentence` half of Task 2 was not executed, and D-16 was **not** narrowed.

## Performance

- **Duration:** 21 min (includes a human pause at the branch-guard halt described under Issues)
- **Started:** 2026-09-20T12:44:00Z (approx — `BASE` measured before the first edit)
- **Completed:** 2026-09-20T13:05:00Z
- **Tasks:** 3 (Task 1 settled by the user's answer; Tasks 2 and 3 executed)
- **Files modified:** 6

## Test-count baseline

`BASE` was **measured**, not assumed, on the tree this plan started from (`2f10c95`), before the first edit:

| Point | `# pass` | `# fail` | Floor | Met |
|---|---|---|---|---|
| `BASE` (starting tree) | **170** | 0 | — | — |
| End of Task 2 | **176** | 0 | `BASE + 6` = 176 | yes |
| End of Task 3 | **179** | 0 | Task 2's count + 3 = 179 | yes |

`01-17-SUMMARY.md`'s closing figure and the plan's "168" were both superseded by the measurement. **`179` is the figure `01-19` should read its own baseline against.**

## Accomplishments

- **The verifier's reproduction now comes back `turns: 1, usage: 1`.** A database written by the real pre-phase code at `b8f255c` and opened with HEAD lands on `user_version 4` with every ended turn carrying exactly one usage row, `derive.db.bak-v0` beside it, every other row kept.
- **Migration 4 invents nothing.** Each backfilled row is `model` null, all five token columns null, `cost_usd` null, `cost_source 'unknown'` — the same blank `closeUsage` already writes — with `ts` taken from the turn's own ending rather than from the moment of the upgrade. D-16's refusal to estimate holds.
- **The repair reaches the databases that need it.** It is a new migration at `user_version` 4, not a correction to migration 3, so an install already on 3 receives it; `migrations.ts`'s diff is purely additive and migration 3 is untouched.
- **A crash between ending a turn and closing its ledger row is no longer a state.** `endTurn` puts `finishTurn` and `closeUsage` in one `withTx`, and both sites that ran them separately — `server/src/index.ts`'s external `end` action and `server/src/driver.ts`'s sink — now make one call.
- **The sentence and the code agree.** `server/src/db.ts`'s ledger doc block now says *which* turns the invariant covers, so a reader does not have to discover an exception on an upgraded install.

## Task Commits

1. **Task 2: an upgraded database whose ledger reconciles** — `3a2ef42` (feat)
2. **Task 3: ending a turn and closing its ledger row are one write** — `199dd82` (refactor)

**Plan metadata:** see the `docs(01-18)` commit that carries this file.

`commits: 2` in the frontmatter is measured: `git rev-list --count 2f10c95..HEAD` at SUMMARY write, with `plan_head_before` recorded beside it.

## Files Created/Modified

- `server/src/migrations.ts` — migration `{ version: 4, name: 'usage-backfill' }` appended to `MIGRATIONS`; `backfillUsage(db)` added beside `backfillTurns` as one `INSERT … SELECT`. `LATEST_VERSION` is computed from the list and needed no edit; it now resolves to `4`.
- `server/src/db.ts` — the ledger invariant doc block rewritten to name its boundary; `endTurn(turnId, status)` exported beside `finishTurn`.
- `server/src/driver.ts` — `sinkFor`'s `endTurn` closure makes one `endTurnRow(...)` call; `finishTurn`/`closeUsage` dropped from the import list.
- `server/src/index.ts` — the external `end` action makes one `endTurn(...)` call; `finishTurn`/`closeUsage` dropped from the `./db.js` import list, `endTurn` added in alphabetical position.
- `server/test/migrations.test.ts` — `usageRows(file)` and `counts(file)` readers, a `migrateTo(file, version)` helper, and the six-case `describe('the usage rows backfilled for turns the ledger never saw')`.
- `server/test/tx.test.ts` — `endTurn`/`getTurn` added to the dynamic import, three cases under `describe('ending a turn')`, and the suite doc extended by one clause.

## Verification evidence

### Gates

| Gate | Result |
|---|---|
| `pnpm typecheck` | exit 0, no `error TS` |
| `pnpm build` | exit 0, `grep -c "error TS"` → 0 |
| `pnpm test` | `# tests 179`, `# pass 179`, `# fail 0` |
| `server/test/migrations.test.ts` | 13 → 19 pass, 0 fail |
| `server/test/usage.test.ts` | 9 pass, 0 fail (unchanged) |
| `server/test/tx.test.ts` | 13 → 16 pass, 0 fail |
| `server/test/driver.test.ts` | 5 pass, 0 fail |
| `server/test/api.test.ts` | 14 pass, 0 fail — the whole-lesson suite that drives the external `end` action for real, unchanged |

### Red-first (Task 2)

With the `version: 4` entry removed from `MIGRATIONS`, `server/test/migrations.test.ts` reported **`# pass 16, # fail 3`** with `not ok 4 - the usage rows backfilled for turns the ledger never saw`, the failures naming the usage count. Restored → **`# pass 19, # fail 0`**. (Three of the six cases fail on the unfixed code; the idempotence and empty-database cases pass vacuously without a migration to be idempotent about, which is honest rather than a gap.)

### Reproduction from pre-phase code, not a fixture

Two detached worktrees (`b8f255c` = pre-phase, `2f10c95` = this plan's starting tree) against scratch `DERIVE_DATA_DIR`s. `~/.derive/derive.db` was never touched. Both worktrees were removed afterwards.

**0 → 4.** `b8f255c`'s own `server/src/db.ts` created a lesson, a two-node graph and a `turn_start`/`turn_end` pair.

| | `user_version` | `turns` | `usage` | backups |
|---|---|---|---|---|
| before (pre-phase code) | 0 | no such table | no such table | — |
| after (HEAD opens it) | **4** | **1** | **1** | `derive.db.bak-v0` |

The row: `model null`, `input_tokens null`, `output_tokens null`, `cache_read_tokens null`, `cache_write_tokens null`, `reasoning_tokens null`, `cost_usd null`, `cost_source 'unknown'`, `driver 'claude-code'`, `ts 1789908814639` — equal to the turn's `ended_at`. Lessons, nodes and events all survived (1 / 2 / 3).

**3 → 4.** The same pre-phase database opened first by the pre-plan code at `2f10c95`, then by HEAD.

| | `user_version` | `turns` | `usage` | backups |
|---|---|---|---|---|
| after pre-plan code | 3 | 1 | **0** | `derive.db.bak-v0` |
| after HEAD | **4** | **1** | **1** | `derive.db.bak-v0`, `derive.db.bak-v3` |

The verifier's recorded defect (`turns: 1, usage: 0`) reproduces as `turns: 1, usage: 1` on both paths, and the snapshot the runner writes before applying is present in both.

### Acceptance greps

| Check | Starting tree | After |
|---|---|---|
| `grep -c "usage-backfill" server/src/migrations.ts` | 0 | **1** |
| `LATEST_VERSION` (from `server/`) | 3 | **4** |
| `grep -vE '^\s*(//\|\*\|/\*)' server/src/index.ts \| grep -c 'finishTurn('` | 1 | **0** |
| same pipeline for `closeUsage(` | 1 | **0** |
| `grep -c "endTurnRow" server/src/driver.ts` | 0 | **2** |
| `grep -c "export function endTurn" server/src/db.ts` | 0 | **1** |

### Hand-driven on a scratch database (Task 3)

```
crash case BEFORE: { status: 'running', usage: 0 }
  threw: killed
crash case AFTER:  { status: 'running', usage: 0 }
twice case BEFORE: { status: 'running', usage: 0 }
  after endTurn:   { status: 'ok', usage: 1 }
twice case AFTER:  { status: 'ok', usage: 1 }
```

A `withTx` that calls `finishTurn` and then throws leaves the turn `running` with zero usage rows — neither half applied. A turn passed to `endTurn` and then reached by `closeOpenTurns('interrupted')` keeps exactly one usage row and the status `endTurn` set (`'ok'`, not `'interrupted'`). The scratch driver script was deleted after the run and never staged.

## Decisions Made

- **`migration-4`**, taken by the user at Task 1's blocking-human checkpoint (recorded verbatim above). D-16 stands unnarrowed: a usage row for every turn regardless of driver, now true of upgraded installs as well as fresh ones, so Phase 4's usage page needs no pre-ledger exception branch in its queries.
- The backfill's `ts` is the turn's own `COALESCE(ended_at, started_at)` rather than the upgrade time, carried by a one-line `//` comment at the statement so a later reader does not "fix" it.
- `finishTurn` keeps its own export even though both production call sites moved off it — `server/test/tx.test.ts` drives it directly to force the between-the-halves failure, and a caller that genuinely wants only the status write should have to say so.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The `LATEST_VERSION` acceptance command cannot run from the repo root**
- **Found during:** Task 2 (acceptance)
- **Issue:** The plan's `node --import tsx -e "import('./server/src/migrations.ts')…"` fails with `ERR_MODULE_NOT_FOUND: Cannot find package 'tsx' imported from /home/jicanta/derive/`. `tsx` is a `server` devDependency, so a bare `tsx` import does not resolve from the workspace root.
- **Fix:** Ran the same check from `server/` with the path adjusted: `cd server && node --import tsx -e "import('./src/migrations.ts').then(m => console.log(m.LATEST_VERSION))"` → `4`.
- **Files modified:** none (instrument only)
- **Verification:** printed `LATEST_VERSION: 4`
- **Committed in:** n/a

**2. [Rule 3 - Blocking] `withTurns` and `turns(file)` were scoped inside one `describe`**
- **Found during:** Task 2
- **Issue:** The new `describe` block needs both the `withTurns` fixture builder and a reader, but both lived inside `describe('the turns backfilled from the event log')` and were unreachable from a sibling block.
- **Fix:** Hoisted `withTurns` and `turns` to module scope beside the other harness helpers and added `usageRows` and `counts` next to them, keeping the readers together as the plan asked. `turns(file)`'s select gained `id` so a usage row can be matched to its turn for the `ts` assertion. No existing case changed behaviour (all still pass).
- **Files modified:** server/test/migrations.test.ts
- **Verification:** `migrations.test.ts` 13 → 19 pass, 0 fail; the pre-existing cases unchanged
- **Committed in:** `3a2ef42`

**3. [Rule 2 - Missing Critical] A test comment quoted the invariant's old wording**
- **Found during:** Task 3
- **Issue:** `server/test/tx.test.ts` quoted `db.ts` verbatim — *"Every turn gets a usage row, whichever driver ran it"* — as the reason its count equality matters. Task 2 rewrote that sentence, so the quotation became a second place stating an invariant the code no longer words that way. This plan's standing prohibition is precisely "never state an invariant the code does not hold".
- **Fix:** Updated the quotation to the rewritten sentence.
- **Files modified:** server/test/tx.test.ts
- **Verification:** `tx.test.ts` 16 pass, 0 fail
- **Committed in:** `199dd82`

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 missing critical)
**Impact on plan:** None on scope. Two were instrument/structure adjustments that the plan's own acceptance could not otherwise be run against; the third was required by the plan's own prohibition. No scope creep, no dependency added (T-18-SC clean), no schema change beyond the row-only migration.

## Issues Encountered

**The pre-commit branch guard halted this plan between Task 2's verification and its commit.** The executor's mandatory Step 0 assertion (#2924/#3819) resolved `main` as the protected/default branch — `gsd-tools query git.base-branch --is-protected main` returned `true` — and `.planning/config.json` did not set `git.allow_default_branch_commits`. The guard's instruction is HALT and never self-recover, and its only sanctioned override is a user decision, so execution stopped with Task 2 complete and verified but uncommitted, and nothing was committed on my own authority.

A human resolved it by setting `"allow_default_branch_commits": true` in the `git` block of `.planning/config.json` — making the existing workflow explicit rather than re-homing the phase onto a branch. The assertion then returned `false` and both task commits proceeded on `main`.

**This is why plan 18's history differs from 16 and 17.** Both of those proceeded on `main` and flagged the condition rather than halting on it; plan 18 halted. The behavioural difference is the guard, not the plans: the repo has `git.branching_strategy: "none"` and every plan in this phase has committed to `main`, but the newer guard treats an unset `allow_default_branch_commits` as a refusal regardless. With the key now set, later plans will not hit this.

No other issues. No test was skipped, no `<verify>` went unrun, and no stub was left behind.

## Known Stubs

None. Every file this plan touched is fully wired: the migration runs at import time through `runMigrations`, `endTurn` is called from both production sites, and each is driven by a case that fails on the unfixed code.

## Human verification carried forward, not closed

- **HC-1** (real-browser session-cookie smoke) and **HC-2** (one lesson through the Claude Code plugin and one through the Codex `derive-learn` skill — FOUND-04's human half) both **remain outstanding, unchanged and unclaimed.** Nothing in this plan touches either, and no gate in it may be read as closing either.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Gap **B** (migration-backfilled turns carry no usage row, BLOCKER) is closed and reproduced from pre-phase code. Gap **C** (`finishTurn` + `closeUsage` outside a transaction, recorded PARTIAL) is closed at both sites.
- **`01-19` should take `179` as its `BASE`**, measured on this tree rather than assumed.
- Phase 4's usage page can now treat "every turn that has ended carries a usage row" as true on fresh and upgraded installs alike, and needs no pre-ledger exception branch.
- `.planning/REQUIREMENTS.md` was **not** written by this executor. COST-01 and FOUND-05 are complete from this plan's side and are listed in `requirements-completed`; marking them is left to the orchestrator's post-wave pass, along with `STATE.md` and `ROADMAP.md`.
- Note for whoever reviews the milestone: `.planning/config.json` now carries `git.allow_default_branch_commits: true`. It is a deliberate human choice recorded above, not an incidental edit, and it is currently uncommitted in the working tree.

---
*Phase: 01-foundation*
*Completed: 2026-09-20*

## Self-Check: PASSED

- Every file listed in `key-files.modified` exists on disk (7/7 checked, including this SUMMARY).
- All three commits resolve: `3a2ef42` (Task 2), `199dd82` (Task 3), `76e94f2` (this SUMMARY).
- `.planning/STATE.md` and `.planning/ROADMAP.md` are untouched in both the working tree and every commit this plan made — the orchestrator owns those writes.
- No gitignored planning artifact was force-staged; `git add -f` was never used.
