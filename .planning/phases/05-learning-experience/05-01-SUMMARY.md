---
phase: 05-learning-experience
plan: 01
subsystem: database
tags: [sqlite, migrations, node-sqlite, hono, react, prompts, restart-safety]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: the numbered transactional migration runner, its snapshot-first policy and the withTx re-entrant transaction helper
  - phase: 03-providers
    provides: turn_messages and the tool-call idempotency record, read by the restore path this plan sets up
provides:
  - a `prompts` table (migration 11) holding every open card, its rendered terminal text and its grading context
  - `server/src/prompts.ts` backed by that table, with its six shipped exports unchanged
  - prompt prepared statements and wrappers on `server/src/db.ts`, plus the delete cascade inside `deleteLesson`'s transaction
  - `lessonView.pending` as `{ id, kind, held } | null`, allow-listed away from the answer key
  - `busy` meaning exactly "a turn is running"
  - the one-card-open 409 decided by the table, so it survives a restart
  - `activePromptId` preferring the persisted card, so a restored card renders live
  - `promptPayload` / `settledAnswer`, the server-side readers 05-03's grading branch reads the row back through
affects: [05-03, 05-04, 05-05, 05-06]

actuals:
  tokens: 106438       # chars/4 over the 11 files actually changed — the scale the plan's raw_tokens: 120000 used
  diff_tokens: 14574   # chars/4 over the realized diff alone
  tasks: 2
  commits: 4           # MEASURED: git rev-list --count 0315d039..HEAD — 2 production + 2 docs (SUMMARY, state/roadmap/ledger)
plan_head_before: 0315d039e1ec6439719081d9df2f79c920b685e4

tech-stack:
  added: []
  patterns:
    - "One table answers one question: openness lives in `prompts` and nowhere else; the un-persistable half (a Promise resolver) is held separately and never asked about openness"
    - "The learner-safe half of a card stays in the event log; the grading half goes only into the row, and routes allow-list rather than spread it"
    - "A settled prompt is flagged, not deleted, and swept on the boot pass beside the stale-turn close"

key-files:
  created: []
  modified:
    - server/src/migrations.ts
    - server/src/prompts.ts
    - server/src/db.ts
    - server/src/index.ts
    - server/src/actions.ts
    - web/src/lib/types.ts
    - web/src/lib/useLesson.ts
    - web/src/pages/Lesson.tsx
    - server/test/migrations.test.ts
    - server/test/api.test.ts
    - server/test/tx.test.ts

key-decisions:
  - "Migration 11 `prompts` is a bare CREATE TABLE with `prompts_lesson`; no backfill, because an open prompt from before the table is already lost"
  - "A settled prompt is flagged (`settled = 1`, `answer`, `settled_at`) rather than deleted, because the refusal means 'open and unsettled' and the terminal mirror still needs `card` after the answer; settled rows are swept at boot"
  - "The quiz answer key and the teach-back rubric reach the row through a new `OpenOpts.key`, so `openPrompt`'s `emit` of the learner-safe half is byte-unchanged"
  - "`busy` no longer consults the open card: a restarted companion lesson must not report `Teaching in your terminal` for a terminal that is gone"
  - "`deleteLearner` gets no prompts DELETE of its own — a learner-scoped clear could only run after the lesson loop had removed the lessons a prompt row names, so it would be a no-op claiming to be a guarantee; the counting case in tx.test.ts proves the loop instead"
  - "Both answer paths guard on the live resolver before settling, so a restored card is refused with the shipped sentence rather than settled ungraded; 05-03 replaces the guard with the re-derived grading branch"

patterns-established:
  - "Grading context in a row, learner-safe payload in an event: the same card, split at the trust boundary"
  - "Red before kept: each new gate was observed failing with its subject planted, and the failure line is quoted below"

requirements-completed: [LEARN-12]

coverage:
  - id: D1
    description: "Migration 11 adds the `prompts` table and its `prompts_lesson` index, and an existing database migrates to user_version 11 with `derive.db.bak-v10` beside it"
    requirement: "LEARN-12"
    verification:
      - kind: unit
        ref: "server/test/migrations.test.ts#pins LATEST_VERSION, so a migration that forgets to bump the number is visible"
        status: pass
      - kind: unit
        ref: "server/test/migrations.test.ts (fresh-vs-migrated schema fingerprint; snapshot-before-migrating suite)"
        status: pass
      - kind: other
        ref: "one-off probe: migrate a v10 file, assert user_version 11, derive.db.bak-v10 present, columns id,lesson_id,kind,payload,card,held,settled,answer,opened_at,settled_at, index prompts_lesson"
        status: pass
    human_judgment: false
  - id: D2
    description: "A quiz card opened on a companion lesson is still open after the server is killed and respawned on the same data dir: GET /api/lessons/:id reports the prompt's id and kind"
    requirement: "LEARN-12"
    verification:
      - kind: integration
        ref: "server/test/api.test.ts#is still open, with its id and its kind, after a respawn on the same data dir"
        status: pass
    human_judgment: false
  - id: D3
    description: "The one-card-open 409 is decided by the prompts table, so it fires both while the first card is open and after a restart, with the shipped sentence byte-identical"
    requirement: "LEARN-12"
    verification:
      - kind: integration
        ref: "server/test/api.test.ts#is still open, with its id and its kind, after a respawn on the same data dir (pre-restart half)"
        status: pass
      - kind: integration
        ref: "server/test/api.test.ts#still refuses a second card on that lesson, in the shipped sentence, after the restart"
        status: pass
    human_judgment: false
  - id: D4
    description: "No route response carries `correct`, `explanation` or `rubric` before the learner has committed — the lesson view allow-lists the open card to id, kind and held"
    requirement: "LEARN-12"
    verification:
      - kind: integration
        ref: "server/test/api.test.ts#is still open... (the wire scan for \"correct\"/\"explanation\"/\"rubric\" over the whole lesson-view body)"
        status: pass
    human_judgment: false
  - id: D5
    description: "No prompt row outlives its lesson or its learner; the delete runs inside the existing transaction"
    requirement: "LEARN-12"
    verification:
      - kind: unit
        ref: "server/test/tx.test.ts#leaves no prompt row behind a deleted lesson or a deleted learner"
        status: pass
    human_judgment: false
  - id: D6
    description: "`busy` keeps meaning 'a turn is running', so a restarted companion lesson does not show a live status line for a terminal that is gone"
    requirement: "LEARN-12"
    verification:
      - kind: integration
        ref: "server/test/api.test.ts#is still open... (asserts busy === false after the respawn)"
        status: pass
    human_judgment: false
  - id: D7
    description: "The lesson page renders a restored card as a live card — not disabled, no 'This question is no longer active' — with no turn in flight, and a long restored question reads with unchanged card geometry"
    requirement: "LEARN-12"
    verification: []
    human_judgment: true
    rationale: "There is no browser test in this repo (no web test runner is configured); `activePromptId` now prefers `state.pending` over the `!state.busy` short-circuit and the card components' `disabled` prop is derived from it, which is code-level evidence, not rendered evidence. The empty/long-text/partial render states (E7) need a human looking at the page."

duration: 16 min
completed: 2026-11-04
status: complete
---

# Phase 05 Plan 01: Restart-safe cards Summary

**A `prompts` table (migration 11) is now the single answer to "is a card open on this lesson" — for the browser, for the Claude Code plugin and for the Codex path — so a quiz opened before a kill is reported open with its id and kind after the respawn, renders live instead of inert, and still refuses a second card.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-11-04T23:30:12Z
- **Completed:** 2026-11-04T23:46:30Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- Migration 11 `prompts` — a bare `CREATE TABLE` with `prompts_lesson`, applied under the existing numbered transactional runner, snapshot (`derive.db.bak-v10`) and all. `LATEST_VERSION` is pinned at 11.
- `server/src/prompts.ts` is table-backed with its six shipped exports unchanged. The `Map` holds nothing but the live Promise resolver, and is never consulted about openness.
- The grading half of a card — a quiz's `correct` and `explanation`, a teach-back's `rubric` — reaches the row through a new `OpenOpts.key`, so `openPrompt`'s learner-safe `emit` is byte-unchanged and the answer key has exactly one home.
- `lessonView.pending` and the SSE `ready` payload project `{ id, kind, held }` or `null`; `busy` now means only "a turn is running".
- `activePromptId` reads the persisted card first and falls back to the timeline scan, so the `!state.busy` short-circuit no longer renders a restored card disabled.
- The held-card bookkeeping in `server/src/index.ts` is gone: no `Held` type, no held map, no recent-cards map. `holdCard` writes the rendered text onto the row, `withoutCards` reads it back, and `answer`/`collect`/`end` all read the same row.
- The one-card-open 409 keeps its sentence byte-for-byte and changes only its predicate, which is why it now holds across a restart.
- `deletePromptsByLesson` runs inside `deleteLesson`'s existing transaction, so no prompt row survives its lesson — or, through the loop, its learner.

## Task Commits

1. **Task 1 (tracer): a card opened before a restart is still open after it** — `b7eb489` (feat)
2. **Task 2: the held bookkeeping and the 409 move onto the table** — `f17134f` (refactor)

**Plan metadata:** `55cac5a` (docs: this SUMMARY) and `ee6144f` (docs: STATE.md, ROADMAP.md, WINDOWS.md).

## Files Created/Modified

- `server/src/migrations.ts` — migration 11 `prompts`, with the multi-paragraph design comment the neighbouring entries use (what the row is for, why it must never reach a response, why there is no backfill)
- `server/src/prompts.ts` — rewritten onto the table; `promptPayload`, `settledAnswer` and `isLivePrompt` added beside the shipped six
- `server/src/db.ts` — `PromptRow`, ten prompt statements on `q`, eleven exported wrappers, and the cascade inside `deleteLesson`
- `server/src/index.ts` — `pending` projection, `busy` narrowed, boot-time settled sweep, the table-backed `heldCard`/`collectCard`/`optionsOf` helpers and the rewritten `answer`/`collect`/`end` actions
- `server/src/actions.ts` — `OpenOpts.key`, passed from `openQuiz` and `openExplain`
- `web/src/lib/types.ts` — `PendingPrompt`; `LessonView.pending` is an object or null
- `web/src/lib/useLesson.ts` — `LessonState.pending`, seeded in the `init` dispatch
- `web/src/pages/Lesson.tsx` — `unanswered()` and the persisted-card-first `activePromptId`
- `server/test/migrations.test.ts` — `LATEST_VERSION` pinned at 11
- `server/test/api.test.ts` — the restart gate (two boots, one data dir) and the 409 before and after it
- `server/test/tx.test.ts` — the prompt-row cascade across a lesson and a learner delete

## Red observed before each gate was kept

Per CONTEXT.md D-27, a gate is kept only after it has been seen failing with its subject planted.

**The restart gate, against the pre-change build** (`pnpm --filter server exec node --import tsx --test test/api.test.ts` at `0315d03`):

```
not ok 1 - is still open, with its id and its kind, after a respawn on the same data dir
      error: 'the card is gone: nothing in the file said one was open'
      name: 'AssertionError'
      expected: true
      actual: false
```

**The 409-after-restart case, same run:**

```
not ok 2 - refuses a second card on the same lesson after the restart, in the shipped sentence
      name: 'AssertionError'
      expected: 409
      actual: 200
```

**The prompt-row cascade, with its subject planted** (`q.deletePromptsByLesson.run(id)` removed from `deleteLesson`, then restored):

```
not ok 1 - leaves no prompt row behind a deleted lesson or a deleted learner
        a card cannot outlive the lesson it was opened against
      name: 'AssertionError'
      expected: 0
      actual: 2
```

## Decisions Made

Every decision in the plan's `<decisions_resolved_here>` was followed as written: the column list, the flag-not-delete lifecycle with a boot sweep, `recentCards` moving into the `card` column, the insert running through `redactDeep`, `busy` losing its open-card term, and no backfill. Three calls the plan left to the executor:

- **`OpenOpts.key` is how the answer key reaches the row.** The plan fixes `openPrompt`'s `emit` as unchanged and its `payload` as the learner-safe half, so the grading half had to arrive through `opts`. `openQuiz` passes `{ correct, explanation }`; `openExplain` passes `{ rubric }`. Nothing else changed in `actions.ts`.
- **`collected` lives inside the `answer` JSON blob.** The column list is fixed, and the companion path needs three states, not two: open, settled-but-not-yet-handed-to-the-model, and collected. The blob is `{ answer, result?, collected? }`, which keeps the shipped `collect` semantics (the hook collects a browser answer exactly once) without adding a column.
- **`optionsOf(row)` replaced `Held.optionCount`.** The option count `parseReply` needs is read back off the row's payload, so `holdCard` lost that parameter rather than keeping a second copy of a number the row already has.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `server/src/actions.ts` had to change for the answer key to reach the row**

- **Found during:** Task 1
- **Issue:** The must-have "a prompt row holds the quiz answer key and the teach-back rubric" cannot hold while `openPrompt` is given only the learner-safe payload and its `emit` of that payload stays unchanged — and `actions.ts` is where the call sites are, but it is in neither task's `<files>`.
- **Fix:** Added `key?: Record<string, unknown>` to `OpenOpts` with a doc comment saying what it is and where it may not go, and passed `{ correct, explanation }` from `openQuiz` and `{ rubric }` from `openExplain`. The emitted payload is untouched.
- **Files modified:** `server/src/actions.ts`
- **Verification:** the restart case's wire scan asserts no response body carries any of the three fields; `promptPayload` reads them back server-side
- **Committed in:** `b7eb489`

**2. [Rule 1 - Bug] both answer paths guard on the live resolver before settling a restored card**

- **Found during:** Task 1
- **Issue:** The plan specifies `answerPrompt` returning `true` "when the row existed at all". Taken alone, that means answering a card restored from a previous boot settles the row and returns `ok` while nothing grades it — the quiz result, the FSRS update and the misconception record all skipped, and the learner told their answer landed. That is a dead card with extra steps, which is the bug LEARN-12 exists to kill.
- **Fix:** `answerPrompt` keeps the specified contract. `POST /api/lessons/:id/answer` and the external `answer` action both check for the live resolver first (`isLivePrompt`, and the `grading` map respectively) and answer with the shipped 409 sentence when there is none, so the answer is never silently swallowed. `05-03` replaces each guard body with the re-derived grading branch it owns (`gradeQuiz` + `promptPayload`).
- **Files modified:** `server/src/index.ts`, `server/src/prompts.ts`
- **Verification:** full suite green (505 pass / 0 fail); the shipped 409 strings are unchanged
- **Committed in:** `b7eb489`, `f17134f`

**3. [Rule 1 - Bug] `deleteLearner` gets no prompts DELETE of its own**

- **Found during:** Task 1
- **Issue:** Task 1's acceptance criterion asks for a `deletePromptsByLesson` call in `deleteLearner` as well as `deleteLesson`. `prompts` has no `learner_id`; a learner-scoped DELETE would have to run after `deleteLearner`'s lesson loop had already removed the lessons a prompt row names, so it could only ever be a provable no-op claiming to be a guarantee — exactly what the existing ordering comment in that function says about `turn_messages` and `tool_results`.
- **Fix:** Extended that comment to name `prompts` and spell out why a learner-scoped clear is impossible here, and proved the behaviour instead: `server/test/tx.test.ts` counts prompt rows across a learner delete and asserts the whole table is empty afterwards.
- **Files modified:** `server/src/db.ts`, `server/test/tx.test.ts`
- **Verification:** `leaves no prompt row behind a deleted lesson or a deleted learner` — green, and red with the cascade planted out
- **Committed in:** `b7eb489`, `f17134f`

**4. [Rule 3 - Blocking] more prompt statements than the six the plan names**

- **Found during:** Task 2
- **Issue:** The companion path the table replaces reads more than openness: the rendered card text (the mirror's de-duplication), the graded result (`answer` and `collect` hand it to the model) and whether the model has already collected it.
- **Fix:** Added `unsettledPromptsOf`, `heldPromptOf`, `setPromptAnswer`, `setPromptCard` and `promptCardsOf` beside the named insert / open-row read / read-by-id / settle / sweep / delete, each with the one-line doc the file's other exports carry.
- **Files modified:** `server/src/db.ts`
- **Verification:** `pnpm typecheck && pnpm build && pnpm test` green
- **Committed in:** `b7eb489`, `f17134f`

**5. [Rule 3 - Blocking] the SSE `ready` payload's `pending` changed shape too**

- **Found during:** Task 1
- **Issue:** The acceptance criterion greps `hasPending` to zero over the whole of `server/src/index.ts`, and the stream's `ready` event was its second caller.
- **Fix:** `ready` projects the same allow-listed `{ id, kind, held } | null`. The browser reducer's `ready` branch reads only `busy`, so nothing downstream changed.
- **Files modified:** `server/src/index.ts`
- **Verification:** `grep -c hasPending` over comment-stripped `index.ts` is 0; full suite green
- **Committed in:** `b7eb489`

---

**Total deviations:** 5 auto-fixed (2 bugs, 3 blocking). **Impact on plan:** no scope creep — four of the five are the minimum needed for a must-have or an acceptance criterion to be true, and the fifth (deviation 3) replaces a dead write with a test. The plan's shape, column list and export surface are as written.

## Issues Encountered

- `activePromptId` cannot simply prefer `state.pending.id`: that field is seeded once on `init` and never updated, so after the learner answers in-session it would point at a settled card forever. The persisted id is preferred only while the timeline still shows that exact card unanswered (`unanswered(promptId)`), which is both staleness-proof and the "read the persisted id before falling back to the scan" the criterion asks for.
- Answering a card restored from a previous boot is refused (the shipped 409 sentence) rather than graded. That is deviation 2 above and it is 05-03's task by design — `promptPayload` and `settledAnswer` exist here precisely so that branch has a row to read.

## Threat Flags

None. No new endpoint, auth path or file-access pattern; migration 11 at the SQLite trust boundary is already T-05-05 in the plan's register, and T-05-01 through T-05-06 are each mitigated as planned (allow-listed projection, unchanged `emit`, `redactDeep` on insert, `learnerOf`-scoped routes, the numbered runner's transaction and snapshot, the cascade with its counting case).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **05-03 (wave 2) is unblocked and is the plan that closes the last gap here.** It extracts `gradeQuiz` out of `openQuiz`'s closure and adds the answer route's restore branch; `promptPayload(promptId)` and `settledAnswer(promptId)` are waiting for it, and the two guards marked in deviation 2 are the exact lines it replaces.
- **05-04 / 05-05 (wave 3)** can read `LessonView.pending` as `PendingPrompt | null` — note the shape change from `boolean`, which any new consumer of the lesson view must honour.
- **One human check carries to end-of-phase UAT (coverage D7):** that the lesson page renders a restored card as live rather than disabled, with unchanged card geometry for a long question, and that an unanswered rehydrated card looks identical to a fresh one (no badge, no banner). There is no web test runner in this repo, so nothing in CI renders it.

---
*Phase: 05-learning-experience*
*Completed: 2026-11-04*

## Self-Check: PASSED

Every file named in `key-files.modified` exists on disk, and all three commits
(`b7eb489`, `f17134f`, `55cac5a`) are in the log. The plan-level verification
was re-run whole: `pnpm method:check` (6 rendered copies match `method/`),
`pnpm typecheck`, `pnpm build` and `pnpm test` (505 pass / 0 fail).
