---
phase: 05-learning-experience
plan: 03
subsystem: api
tags: [hono, node-sqlite, react, fsrs, prompts, restart-safety, sse, reducer]

# Dependency graph
requires:
  - phase: 05-learning-experience
    provides: "the `prompts` table (migration 11), `promptPayload` / `settledAnswer`, `pendingPrompt`, and the two resolver guards this plan replaces (05-01)"
  - phase: 03-owned-loop-api-keys-and-gateways
    provides: "`turn_messages` and the D-04 drop-on-provider-change rule the resume check mirrors"
provides:
  - "`gradeQuiz` as a standalone export, called by both the live promise and the restore path — the settle logic exists once"
  - "`settleAsk`, `settlePlan`, `settleExplain` lifted out for the same reason, so every kind of card has one settle"
  - "one `emitEphemeral` status `Grading your answer` inside the grading, reaching all three drivers without touching any of them"
  - "the answer route's restore branch: no resolver but an open row means grade from the row, then a fresh turn whose input is that result"
  - "the external `answer` action's restore branch, so the companion path stops refusing a restored card"
  - "a `notice` event type carried end to end: server emit, EVENT_TYPES, reducer branch, Item union member, render case — and nothing in the Obsidian mirror"
  - "`web/src/lib/lessonReducer.ts`, the React-free fold, re-exported into `useLesson`"
  - "`server/test/reducer.test.ts`, which pins EVENT_TYPES against the server's emit sites in both directions"
affects: [05-04, 05-05, 05-06, 05-07, 05-08]

actuals:
  tokens: 74301        # chars/4 over the 8 files actually changed — the scale the plan's raw_tokens: 100000 used
  diff_tokens: 18996   # chars/4 over the realized diff alone
  tasks: 3
  commits: 3           # MEASURED at SUMMARY write: git rev-list --count 2f965a55..HEAD. The SUMMARY and state commits follow this line.
plan_head_before: 2f965a550faa61f7d9a3cc817769b04e5fc15b3b

tech-stack:
  added: []
  patterns:
    - "A settle function per card kind, outside the promise that used to hold it: a card can outlive its process, so grading cannot live in a closure"
    - "The row is read back for grading and the response is the projected result, never anything the row handed over"
    - "A fact about the lesson that is not a failure is a `notice`, in the quiet mono shape — the rust error card is reserved for things that actually broke"
    - "A React-free reducer module so a plain node test can read the browser's fold, with the event vocabulary pinned against the server's emit sites"

key-files:
  created:
    - web/src/lib/lessonReducer.ts
    - server/test/reducer.test.ts
  modified:
    - server/src/actions.ts
    - server/src/index.ts
    - web/src/lib/useLesson.ts
    - web/src/lib/types.ts
    - web/src/pages/Lesson.tsx
    - server/test/api.test.ts

key-decisions:
  - "`gradeQuiz(lessonId, promptId, args, answer)` takes the quiz arguments with `purpose` and `tests` already resolved; `openQuiz` resolves them once at open time and passes them in, so a restored verdict cannot drift from a live one because the lesson moved on in between"
  - "The grading status line is one `emitEphemeral` inside `gradeQuiz`, immediately after the `quiz_result` emit — grading lives in `actions.ts`, not in any driver, so one call reaches all three and none of them is touched"
  - "No `TOOL_LABELS` entry: the registry snapshot fixes the added label set at the owned loop's two web tools, and grading is not a tool"
  - "A companion (external) lesson starts no fresh turn on the restore path — its model is in the terminal, and starting a server-side turn would put two tutors in one lesson. The graded result waits on the row for `answer` or `collect`"
  - "`resumeCarries` asks the same question `runTurn` asks for 03 D-04 — same driver as the last turn, and a session id or a message history for it — so the quiet notice fires exactly when the history will in fact be dropped"
  - "The restore branch is one helper, `gradeRestored`, shared by the browser answer route and the external `answer` action; the grader is built before the row is settled, so a row nobody can read is left open rather than closed ungraded"
  - "`rowsToNodes` moved into `lessonReducer.ts` with the reducer rather than staying in the hook: it is `reducer`'s own dependency and the extraction does not compile without it"
  - "`server/test/reducer.test.ts` compares EVENT_TYPES against the emitted set in both directions, and names `block_start` as the one legacy entry rather than tolerating a dead branch silently"

patterns-established:
  - "Red before kept: both new subjects were observed failing before the gate was kept, and the failure lines are quoted below"
  - "One settle per kind, reachable from outside the promise — the shape that makes restart safety testable with no model"

requirements-completed: [LEARN-11, LEARN-12]

coverage:
  - id: D1
    description: "The quiz settle logic exists once: `gradeQuiz` is a standalone export and `openQuiz`'s promise calls it, with the four `afterQuiz` verdicts handing back their shipped sentences unchanged"
    requirement: "LEARN-12"
    verification:
      - kind: integration
        ref: "server/test/api.test.ts#hands back the shipped sentence for a correct and confident answer"
        status: pass
      - kind: integration
        ref: "server/test/api.test.ts#hands back the shipped sentence for a correct but unsure answer"
        status: pass
      - kind: integration
        ref: "server/test/api.test.ts#hands back the shipped sentence for a confident miss"
        status: pass
      - kind: integration
        ref: "server/test/api.test.ts#hands back the shipped sentence for an \"I don't know\""
        status: pass
    human_judgment: false
  - id: D2
    description: "A card restored after a restart is answerable, and answering it does the work the server owns: the verdict event, the quiz row, the FSRS lapse, the misconception row, and a fresh turn carrying the result forward"
    requirement: "LEARN-12"
    verification:
      - kind: integration
        ref: "server/test/api.test.ts#grades it with the live card's own code, writes the schedule and the misconception, and starts a fresh turn"
        status: pass
    human_judgment: false
  - id: D3
    description: "The answer route 409s only for a genuinely absent or already-settled row, in the shipped sentence byte-for-byte, so one question cannot move FSRS twice"
    requirement: "LEARN-12"
    verification:
      - kind: integration
        ref: "server/test/api.test.ts#grades it with the live card's own code... (the second-answer half: 409 plus the exact sentence)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The answer route's response carries none of `correct`, `explanation` or `rubric`, even though the restore branch is the first path that reads the grading half back off the row"
    requirement: "LEARN-12"
    verification:
      - kind: integration
        ref: "server/test/api.test.ts#grades it with the live card's own code... (the wire scan over the answer response body)"
        status: pass
    human_judgment: false
  - id: D5
    description: "`Grading your answer` has exactly one home, inside `gradeQuiz` and after the `quiz_result` emit, with no `TOOL_LABELS` entry and no new event type"
    requirement: "LEARN-11"
    verification:
      - kind: integration
        ref: "server/test/api.test.ts#emits the grading status line from the grading path, and never as a tool label"
        status: pass
      - kind: unit
        ref: "server/test/wire-surface.test.ts (the added-label-set snapshot, unchanged and green)"
        status: pass
      - kind: unit
        ref: "server/test/reducer.test.ts#lists nothing the server cannot send, bar the one documented legacy name"
        status: pass
    human_judgment: false
  - id: D6
    description: "The status line's suppression keys on the open card being unanswered rather than on a card existing, so a submitted answer stops hiding it"
    requirement: "LEARN-11"
    verification:
      - kind: integration
        ref: "server/test/api.test.ts#still hides the status line while a card is open and unanswered"
        status: pass
    human_judgment: false
  - id: D7
    description: "`notice` is carried end to end — the server emit, the EVENT_TYPES entry, the reducer branch, the `Item` union member and one render case in the quiet mono shape — and `server/src/export.ts` has no case for it, so it never reaches the markdown export or the vault mirror"
    requirement: "LEARN-12"
    verification:
      - kind: unit
        ref: "server/test/reducer.test.ts#becomes a notice item carrying its text, and nothing else"
        status: pass
      - kind: other
        ref: "test \"$(sed -E 's;//.*$;;' server/src/export.ts | sed -E '/^[[:space:]]*\\*/d' | grep -c \"case 'notice'\")\" = 0"
        status: pass
      - kind: other
        ref: "grep gate: 'notice' in lessonReducer.ts (3), types.ts (1), case 'notice' in Lesson.tsx (1)"
        status: pass
    human_judgment: false
  - id: D8
    description: "`EVENT_TYPES` is pinned against the set of event types the server emits, by a test that was seen failing first, in a module a node test can import with no react resolution"
    requirement: "LEARN-11"
    verification:
      - kind: unit
        ref: "server/test/reducer.test.ts#lists every event type the server can send, so none is dropped in silence"
        status: pass
      - kind: other
        ref: "test \"$(grep -c \"from 'react'\" web/src/lib/lessonReducer.ts)\" = 0 && test \"$(grep -c \"from './lessonReducer'\" web/src/lib/useLesson.ts)\" -ge 1"
        status: pass
    human_judgment: false
  - id: D9
    description: "E7 loading and error, rendered: between answering a rehydrated card and the new turn's first block the learner is looking at a working screen, not a settled one; the unresumable-history case shows the quiet notice line rather than a rust card; a genuinely stale prompt still shows the shipped disabled copy verbatim"
    requirement: "LEARN-11"
    verification: []
    human_judgment: true
    rationale: "There is no web test runner in this repo, so nothing in CI renders the page. The notice's class string (`font-mono text-[11px] text-ink-500`, matching the shipped memory/preferences lines) and the emit ordering are code-level evidence, not rendered evidence. One substantive sequencing nuance needs a human's eye and is stated under Issues Encountered: on the restore path the gold line reads `Grading your answer` only until the fresh turn's `turn_start` lands, after which it reads `Thinking`; on the live path (the case the UI-SPEC's renderable acceptance names) it is on screen for the whole gap between submitting and the verdict."

# Metrics
duration: 16 min
completed: 2026-11-05
status: complete
---

# Phase 05 Plan 03: A restored card is answerable, not just visible Summary

**`gradeQuiz` is out of the promise closure it lived in, so the answer route can grade a card this process never opened — verdict, quiz row, FSRS lapse, misconception — and start a fresh turn with that result; the learner sees `Grading your answer` in the gap, one quiet `notice` line when the earlier conversation could not come with it, and the whole fold that renders it now lives in a React-free module whose event vocabulary a test pins against the server's.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-11-05T00:13:28Z
- **Completed:** 2026-11-05T00:29:30Z
- **Tasks:** 3
- **Files modified:** 8 (2 created, 6 modified)

## Accomplishments

- **One grading path.** The whole settle block — the selected-index filter, `sameSet`, the result and confidence derivation, the `quiz_result` emit, `recordQuiz`, the pretest-exempt `addMisconception`, `afterQuiz` — is now `export function gradeQuiz(lessonId, promptId, a, raw)` in `server/src/actions.ts`, and `openQuiz`'s `wait.then(...)` is a one-line call to it. `settleAsk`, `settlePlan` and `settleExplain` came out the same way, so every kind of card has exactly one settle reachable from outside its promise.
- **`purpose` and `tests` are resolved once and carried.** `openQuiz` resolves them before the row is written and hands them to `gradeQuiz`; `purposeOf`/`testsOf` are the identity on an already-valid value, so the live verdict and the restored verdict cannot diverge because the lesson's phase or graph moved on between open and answer.
- **One `emitEphemeral(lessonId, 'status', { text: 'Grading your answer' })`**, immediately after the `quiz_result` emit, with an inline comment saying why the ordering is load-bearing. Grading happens in `actions.ts` and not in any driver, so that single call reaches the Claude driver, the owned loop and Codex without touching one of them. No `TOOL_LABELS` entry, no new event type, nothing in the Obsidian mirror.
- **The answer route's second branch.** `POST /api/lessons/:id/answer` now splits on `isLivePrompt`: this process's own card resolves its Promise as before; a card from an earlier boot is graded from its row by `gradeRestored`, which reads `promptPayload`, builds the grader for the row's kind, settles the row and runs it. The 409 sentence is byte-identical and now fires only when there is genuinely no open row — or when a second answer finds a settled one, so one question moves FSRS exactly once.
- **The external `answer` action takes the same branch**, closing the second of the two guards 05-01 flagged. No fresh turn there: a companion lesson's model is in the terminal and the reply *is* its turn, so the graded result is written onto the row where `answer` and `collect` already read it.
- **A fresh turn carries the result forward** on an agent lesson: `restoredAnswerPrompt` hands the model the projected grading result plus the instruction the tool result would have carried, and tells it not to ask the question again or grade it itself.
- **`resumeCarries` asks exactly what `runTurn` asks** for 03 D-04 — same driver as the last turn, plus a session id or a message history written by that driver. When the answer is no, one `notice` event reads `graded and saved · starting a fresh turn, without the earlier conversation`, rendered in the shipped `font-mono text-[11px] text-ink-500` shape, explicitly not the rust error card: nothing failed.
- **`web/src/lib/lessonReducer.ts`** — `applyEvent`, `apply`, `reducer`, `EVENT_TYPES`, `LessonState`, `Action`, `initial` and `rowsToNodes`, moved unchanged, with type-only imports and no `react`. `useLesson.ts` is down to the hook, the SSE subscription and the delta buffer, and re-exports the reducer rather than keeping a copy.
- **`server/test/reducer.test.ts`** — 11 assertions with no browser and no new dependency: EVENT_TYPES against a committed list of the server's emit sites in *both* directions (failing by name), the status set, the `block_start` clear, the ephemeral non-persistence, the delta merge, the quiz/quiz_result collapse, the assistant rewrite under its original seq, the never-shrink rule, the notice item and the `init` replay. Full suite: 518 → 536 tests, 0 fail.

## Task Commits

1. **Task 1: one grading path, and the line the learner waits through** — `c2461bf` (refactor)
2. **Task 2: the answer route's second path** — `d6efba7` (feat)
3. **Task 3: the reducer becomes a React-free module** — `160602f` (refactor)

## Files Created/Modified

- `web/src/lib/lessonReducer.ts` (new) — the React-free fold, with a prose header saying what it is, why it has no React, and that an event type the server emits and this file does not list is ignored by the browser in silence
- `server/test/reducer.test.ts` (new) — the vocabulary gate and the reducer's branches, matching `voice.test.ts`'s header sentence about why a web module is tested from the server package
- `server/src/actions.ts` — `gradeQuiz`, `settleAsk`, `settlePlan`, `settleExplain`; the grading ephemeral; `emitEphemeral` imported
- `server/src/index.ts` — `gradeRestored`, `graderFor`, `quizArgsOf`, `resumeCarries`, `restoredAnswerPrompt`; the answer route's two branches; the external `answer` action's restore branch; `loadTurnMessages`, `driverFor` and `driverOverride` imported
- `web/src/lib/useLesson.ts` — reduced to the hook and its subscription; re-exports the reducer
- `web/src/lib/types.ts` — `TimelineItemBase` gains `{ kind: 'notice'; seq: number; text: string }` with a one-line doc saying it is never the rust treatment
- `web/src/pages/Lesson.tsx` — the `notice` render case in the memory/preferences mono shape
- `server/test/api.test.ts` — the four `afterQuiz` sentences, the single-home gate for the status string, the Lesson.tsx suppression gate, and the restore-and-answer case (two boots, one data dir)

## Red observed before each gate was kept

Per CONTEXT.md D-27, a gate is kept only after it has been seen failing with its subject planted.

**The restore-and-answer case, against the pre-change build** (`pnpm --filter server exec node --import tsx --test` at `2f965a55`):

```
not ok 1 - grades it, writes the schedule and the misconception, and starts a fresh turn
      error: |-
        {"error":"no such pending prompt (the turn may have ended; send a message instead)"}

        409 !== 200
      name: 'AssertionError'
      expected: 200
      actual: 409
```

That is the shipped 409 firing on a row that was open — 05-01's deviation 2, exactly the line this plan replaces.

**The reducer test, against the pre-extraction tree** (same commit):

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/home/jicanta/derive/web/src/lib/lessonReducer'
  imported from /home/jicanta/derive/server/test/_red_reducer.test.ts
not ok 1 - test/_red_reducer.test.ts
```

The import alone fails before the extraction, which is what makes the extraction the thing the test depends on rather than a tidy-up beside it.

## Decisions Made

Every decision in the plan's `<decisions_resolved_here>` was followed as written: the grading line's single home immediately after the `quiz_result` emit, no `TOOL_LABELS` entry, the suppression rule asserted rather than rebuilt, the resume-not-possible line as a durable `notice` event carried end to end in one task, and the reducer extracted to its own module rather than exported in place. Four calls the plan left to the executor:

- **`gradeQuiz` takes already-resolved `purpose` and `tests`.** The plan fixes the signature as `(lessonId, promptId, args, answer)`, and `QuizArgs` carries both fields, so `openQuiz` resolves them once and passes `{ ...a, purpose, tests }`. Re-resolving inside `gradeQuiz` is then the identity on both paths. Had the restore path re-derived them from the lesson, a card opened in the probe phase and answered after `set_phase('teach')` would have graded under a different purpose than it was asked under.
- **One helper, `gradeRestored`, serves both answer paths**, and the grader is built *before* the row is settled. A row whose question cannot be read back is left open and answered with the 409 rather than closed ungraded — which is the same failure mode 05-01's deviation 2 refused to ship.
- **A companion lesson starts no fresh turn.** `runTurn` on an `external` lesson would run a server-side driver inside a lesson whose model is in the terminal: two tutors, one record. The branch is guarded on `lesson.mode === 'agent' && !isBusy(id)`, and the graded result is written onto the row for `answer`/`collect` instead. See deviation 1.
- **`restoredAnswerPrompt` lives in `index.ts`, not `prompt.ts`.** It is the turn prompt for one route's edge case rather than a phase of the method, and `index.ts` already builds a turn prompt inline for the voice switch; `prompt.ts` holds the method's own four.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] the fresh turn is started only for an agent lesson**

- **Found during:** Task 2
- **Issue:** The plan says a restored grading is followed by a fresh turn, with no mode condition. On a companion lesson (`mode: 'external'`) that would call `runTurn`, which starts a server-side driver turn on a lesson whose model is running in the learner's terminal — two tutors writing into one record, and a turn billed against a provider the learner did not ask to teach this lesson.
- **Fix:** The branch is guarded on `lesson?.mode === 'agent' && !isBusy(id)`. For a companion lesson the graded result is written onto the prompts row (the same write `holdCard` makes for a live card) and the terminal collects it through `answer` or `collect`, which is the shipped contract for that path. D-26's resume clause reads `turn_messages`, which only the agent paths have, so this is the mode the decision was about.
- **Files modified:** `server/src/index.ts`
- **Verification:** the restore case runs on an agent lesson and asserts a turn was started; the external `answer` action's restore branch is exercised by the companion half of the suite, and the full suite is green (536 pass / 0 fail)
- **Committed in:** `d6efba7`

**2. [Rule 3 - Blocking] three settle functions beyond `gradeQuiz`**

- **Found during:** Task 2
- **Issue:** The plan's Task 2 asks for "the matching settle for the other three kinds", but Task 1 extracts only the quiz. Those three were still trapped in their own `wait.then(...)` closures, so the restore branch could grade a quiz and nothing else — and `ask`, `plan` and `explain` cards are held across restarts by the same table.
- **Fix:** `settleAsk`, `settlePlan` and `settleExplain` lifted out in Task 1 alongside `gradeQuiz`, each with the one-line doc the file's other exports carry and each called by its `open*` function. `graderFor` in `index.ts` dispatches on the row's kind.
- **Files modified:** `server/src/actions.ts`, `server/src/index.ts`
- **Verification:** `pnpm typecheck && pnpm build && pnpm test` green; the plan-approval and teach-back paths are covered by the existing suite and unchanged
- **Committed in:** `c2461bf`, `d6efba7`

**3. [Rule 3 - Blocking] `rowsToNodes`, `LessonState`, `Action` and `initial` moved with the reducer**

- **Found during:** Task 3
- **Issue:** The plan says `useLesson.ts` keeps `rowsToNodes`, but `reducer`'s `init` case is its only caller, so the extraction does not compile with it left behind. `LessonState`, `Action` and `initial` are likewise the reducer's own types and seed.
- **Fix:** All four moved into `lessonReducer.ts` and re-exported from `useLesson.ts`, so every existing import path still resolves and the hook's public surface is unchanged. `web`'s `noUnusedLocals` is satisfied by the re-export rather than by a dead binding.
- **Files modified:** `web/src/lib/lessonReducer.ts`, `web/src/lib/useLesson.ts`
- **Verification:** `pnpm --filter web typecheck` green, so the extraction is type-identical; `pnpm build` green
- **Committed in:** `160602f`

**4. [Rule 2 - Missing Critical] the reducer test compares the vocabulary in both directions**

- **Found during:** Task 3
- **Issue:** The plan asks only that `EVENT_TYPES` contain every type the server emits. The reverse gap is just as silent: a listed name no emit site produces is a reducer branch nothing reaches, which reads as coverage the browser does not have — and it is how a renamed server event leaves two half-wired names behind instead of one error.
- **Fix:** A second case asserts that every `EVENT_TYPES` entry is either in the committed emitted set or in a one-element `LEGACY` list naming `block_start`, which no driver emits any more and whose branch is kept for events already in older lessons' logs.
- **Files modified:** `server/test/reducer.test.ts`
- **Verification:** both directions green; the case was confirmed to fail by listing the dead name while the emitted list was incomplete during authoring
- **Committed in:** `160602f`

---

**Total deviations:** 4 auto-fixed (1 bug, 2 blocking, 1 missing critical). **Impact on plan:** no scope creep. Deviations 2 and 3 are the minimum the extraction needs to compile and to serve all four card kinds; deviation 1 prevents a second tutor from being started inside a companion lesson; deviation 4 is one extra assertion in a file the plan was already creating. The plan's shape, signatures and copy strings are as written.

## Issues Encountered

- **The grading line's visibility differs between the live path and the restore path, and the difference is in the sequencing rather than in the code.** The browser's shipped gate is `state.busy && state.status && !waiting`. On the live path the turn is running, so when the `quiz_result` clears `waiting` the line is on screen for the whole gap between submitting and the verdict — which is exactly the renderable acceptance UI-SPEC §Streaming status line names. On the restore path `busy` is false until the fresh turn's `turn_start` arrives, and that event also sets the status to `Thinking`, so the learner sees a gold working line but reads `Thinking` rather than `Grading your answer` for most of the wait. Making it read otherwise would mean either a second home for the string (the plan's acceptance criterion fixes it at one, inside `gradeQuiz`) or changing the suppression rule the plan says to verify rather than rebuild. Left as the plan specifies and recorded here; it is carried as the human check in coverage D9.
- **Task 2's acceptance criterion about `useLesson.ts` is superseded by Task 3, by the plan's own sequencing.** `EVENT_TYPES` and the `applyEvent` branch for `notice` were added to `useLesson.ts` in Task 2 and its grep gate was green there (`'notice'` ×2, the `Item` member, the render case); Task 3 then moved both into `lessonReducer.ts`, where the same three-way gate is green (`'notice'` ×3 in `lessonReducer.ts`, 1 in `types.ts`, 1 `case 'notice'` in `Lesson.tsx`). Nothing was lost — the file the gate should read after Task 3 is `lessonReducer.ts`.
- **"The node's FSRS fields written" needed a cumulative miss to be true.** Answering a quiz writes a `quiz_results` row and nothing on the node; the FSRS write happens through `setNodeStatus`. So the restore case locks `slope` first, then opens a `cumulative`/`transfer` question on it and answers it wrong and sure after the restart — `afterCumulative` marks the node shaky, which is the lapse. Asserting stability dropped and `review_at` moved closer is therefore an assertion about the real mechanism rather than about a field that a quiz never touches.

## Threat Flags

None. No new endpoint, no new auth path, no new file access. T-05-12 through T-05-17 are each handled as planned: the restore branch reads the row through `promptPayload` (server-side only) and returns the projected grading result, with the response body scanned for `correct`/`explanation`/`rubric` in the test; the `notice` payload is one fixed string from the copy contract and goes through `emit`, hence `redactDeep`; the row read is keyed by lesson and prompt id behind `learnerOf`/`guardLocal`/the install token; the settle write is conditional on the row still being open, and the second-answer 409 is asserted; the grading status line is a fixed constant with `seq: -1` and is never persisted.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Wave 3 (05-04, 05-05) is unblocked.** Two shape changes to honour: the browser's fold now lives in `web/src/lib/lessonReducer.ts` (a new event type means an entry there, a branch in `applyEvent`, an `Item` union member in `types.ts` and a render case — the same four places, one file further out), and `LessonState`/`Action`/`initial`/`rowsToNodes` are exported from that module and re-exported by `useLesson.ts`, so existing import paths are unaffected.
- **`server/test/reducer.test.ts` will fail by name** if a later plan adds a server `emit` without listing the type. Its `EMITTED` list is a committed copy of the emit sites and has to grow with them — that is the point of it, not an inconvenience.
- **One human check carries to end-of-phase UAT (coverage D9):** the rehydrated-card loading and error states on screen — that the learner never looks at a settled page that is secretly working, that the unresumable-history line reads as a quiet notice rather than a failure, and that a genuinely stale prompt still shows the shipped disabled copy. The `Grading your answer` / `Thinking` sequencing nuance under Issues Encountered is the one substantive thing for a human to judge there.

---
*Phase: 05-learning-experience*
*Completed: 2026-11-05*

## Self-Check: PASSED

Every file named in `key-files` exists on disk, and all three task commits
(`c2461bf`, `d6efba7`, `160602f`) are in the log. The plan-level verification
was re-run whole at `160602f`: `pnpm method:check` (6 rendered copies match
`method/`), `pnpm typecheck`, `pnpm build` and `pnpm test` (536 pass / 0 fail),
plus `test/wire-surface.test.ts` on its own (17 pass / 0 fail) and the
comment-stripped greps for the single status-string home, the absent
`TOOL_LABELS` key, the untouched `server/src/tools.ts`, the react-free
`lessonReducer.ts`, the hook's re-export and the exporter's missing
`case 'notice'`.
