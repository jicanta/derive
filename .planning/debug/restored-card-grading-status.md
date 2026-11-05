---
status: diagnosed
trigger: "UAT gap G-05-1 (test 1) in .planning/phases/05-learning-experience/05-UAT.md, phase 05-learning-experience of the Derive repo (/home/jicanta/derive)."
created: 2026-11-05T00:00:00Z
updated: 2026-11-05T00:30:00Z
goal: find_root_cause_only
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED — the status line's render gate in web/src/pages/Lesson.tsx:519 is `state.busy && state.status && !waiting`; `busy` means "a turn is running" and is false on the restored path between the answer and the fresh turn's `turn_start`, so the `Grading your answer` ephemeral (which the server does emit) reaches the reducer and is dropped at render; `turn_start` then sets busy=true and overwrites status to `Thinking`.
test: Replayed the exact restored-path event sequence (init busy:false + pending row → quiz_result → status → turn_start) and the live-path sequence (init busy:true → quiz_result → status) through the real `lessonReducer.ts` fold and evaluated the Lesson.tsx gate after every event (scratchpad/replay.ts).
expecting: n/a — done.
next_action: Return ROOT CAUSE FOUND to the orchestrator (diagnose-only mode; no code changes).
bug_class: Bohrbug (deterministic; reproduces every time the sequence is replayed)

reasoning_checkpoint:
  hypothesis: "The `Grading your answer` line never renders after a restart because Lesson.tsx gates the status line on `state.busy`, and on the restored path the status event arrives while busy is false (no turn is active until `runTurn` emits `turn_start`, which then replaces the status with `Thinking`)."
  confirming_evidence:
    - "web/src/pages/Lesson.tsx:519 — `{state.busy && state.status && !waiting && (...)}` is the only render site of the status line; line dates from commit bf06725 (Derive 0.2), before any status was ever emitted outside a turn."
    - "web/src/lib/lessonReducer.ts:125-126 — `case 'status'` sets `status` only; busy is set true only by `turn_start` (101-110), `ready` (99-100), and the card events quiz/ask/explain/plan (156-173); `init` (259-267) takes `busy` from the server view."
    - "server/src/index.ts:312-317 — `busy(id)` is `isBusy(id)` (agent.ts `active` map, empty after a restart) and for non-external lessons returns false otherwise; /api/lessons/:id (337) and the SSE `ready` payload (928) both carry it, so the restored page initialises with busy:false."
    - "server/src/actions.ts:393-397 — `gradeQuiz` emits `quiz_result` then `emitEphemeral(..., 'status', { text: 'Grading your answer' })`; server/src/index.ts:1099-1125 restored branch: `gradeRestored` (996-1012 → graderFor → actions.gradeQuiz) runs first, `runTurn` (1122) — whose `turn_start` is what sets busy — runs after, fire-and-forget."
    - "Reducer replay (scratchpad/replay.ts, run with `node --import tsx` from server/): RESTORED → after quiz_result {busy:false,status:null,rendered:false}; after status {busy:false,status:'Grading your answer',rendered:false}; after turn_start {busy:true,status:'Thinking',rendered:true}. LIVE → after status {busy:true,status:'Grading your answer',rendered:true}. Matches the UAT 40ms sampler (null → 'Thinking')."
  falsification_test: "If the hypothesis were wrong, the replay with busy:false would show rendered:true after the status event, or the live replay would also show rendered:false; neither happened. Equivalently, the DOM sampler would have caught at least one 'Grading your answer' frame on the restored path if the gate ever opened before turn_start."
  fix_rationale: "The `busy` conjunct is a proxy for 'a turn is running' that was always true when a status arrived before plan 05-03; the restored path is the first status emitted outside a turn. `status` is already null whenever no turn runs (init idle → null; turn_end → null; every content/card event → null), so `busy` adds nothing except hiding this one line. Dropping it from the gate addresses the cause (gate keyed on the wrong proxy), not the symptom."
  blind_spots: "Not run against a real two-boot server with a model (would spend subscription); the server-side ordering is read from code plus the tester's observation that quiz_result arrived and a turn started. On a companion (external) lesson's restored card no fresh turn starts, so after the gate change the line would stay until the terminal's next content event nulls status — not tested, worth a glance by the fixer."
  candidate_causes:
    - "code/web: the status-line gate conjunct `state.busy` in Lesson.tsx:519 (shipped in 0.2, never revisited; 05-03 Task 1 'verified, not changed' the gate but only reasoned about the `!waiting` half)"
    - "code/server: the restored answer branch grades (and emits the status) before `runTurn` emits `turn_start` (index.ts:1115 vs 1122) — by design per D-26, and correct; it is simply the first status ever emitted outside a turn"
    - "config/environment/data: none — deterministic, no env variable or data shape involved; eliminated by the replay reproducing it with fixed inputs"
  and_gate: "yes — the failure needs both (a) a status emitted while no turn is active (server, restored path only) and (b) a render gate that requires an active turn (web). Either side could be changed; the web gate is the smaller, more contained change and the one that is actually wrong (its proxy no longer holds)."

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: Submitting the restored card grades it; the gold status line under the timeline reads `Grading your answer`, then `Thinking` once the fresh turn starts.
actual: Headless Chrome against a scratch server (agent lesson, Claude backend, learner 'fresh'): quiz open, server killed and restarted on same data dir, page reloaded, card rendered live, answering with 1+Enter graded it (quiz_result arrived) and a fresh turn started within ~3s. A 40ms DOM sampler of the status element recorded only null -> 'Thinking'; 'Grading your answer' never rendered. In the live (non-restored) path the same line does render after an answer.
errors: None (no console errors, no server errors).
reproduction: Test 1 in .planning/phases/05-learning-experience/05-UAT.md. API recipe: server/test/api.test.ts "grades it with the live card's own code ... and starts a fresh turn" shows the two-boot setup; the browser half needs the Lesson page.
started: Discovered during UAT on 2026-11-05 after phase 05 plans 05-01 and 05-03 shipped the prompts table and the restored-card grading path.

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: The server does not emit `Grading your answer` on the restored path.
  evidence: index.ts:1115 `gradeRestored` → 1003 `graderFor` → case 'quiz' → `actions.gradeQuiz`, the single grading path; actions.ts:397 emits the ephemeral unconditionally after the `quiz_result` emit at 393. The restored path cannot skip it. (And even if it did, the gate would still drop it.)
  timestamp: 2026-11-05T00:20:00Z

- hypothesis: The line rendered but too briefly for the 40ms DOM sampler to catch.
  evidence: The gate is structurally false for the whole window: busy stays false from the answer until `turn_start`, and `turn_start` overwrites status to `Thinking` in the same reducer step (lessonReducer.ts:101-110). There is no instant at which `busy && status === 'Grading your answer'` holds. Replay confirms rendered:false at every step before turn_start.
  timestamp: 2026-11-05T00:22:00Z

- hypothesis: The ephemeral `status` event is dropped by the SSE subscription (missing from EVENT_TYPES) or by the reducer.
  evidence: The live path renders the same event (UAT and replay LIVE run), and the replay shows the RESTORED run's state carrying status:'Grading your answer' after the event — it reaches the fold and is lost only at the render gate.
  timestamp: 2026-11-05T00:23:00Z

- hypothesis: Config, environment or data (learner, backend, data dir) influence the outcome.
  evidence: Replay reproduces it with fixed inputs and no server; the gate and reducer read no config. Deterministic Bohrbug.
  timestamp: 2026-11-05T00:24:00Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-11-05T00:00:00Z
  checked: .planning/debug/knowledge-base.md
  found: File does not exist; no prior resolved sessions.
  implication: No known-pattern candidate; proceed with tester's evidence as the leading hypothesis.

- timestamp: 2026-11-05T00:05:00Z
  checked: .planning/phases/05-learning-experience/05-UAT.md test 1 and gap G-05-1; 05-03-PLAN.md lines 31-36, 96-98, 135-139, 271; 05-CONTEXT.md D-16, D-26
  found: The plan promised "E7 loading: between answering a rehydrated card and the new turn's first block, the gold status line reads `Grading your answer`". Its Task 1 chose to "verify, rather than change" the Lesson.tsx gate, asserting only that suppression "keys on the card being open and unanswered" (the `!waiting` half). D-16 says the phase "makes sure the status is not suppressed where the learner is in fact waiting".
  implication: The plan reasoned about `!waiting` and never about `state.busy`; the gate's other conjunct went unexamined.

- timestamp: 2026-11-05T00:08:00Z
  checked: web/src/pages/Lesson.tsx:117-133 (activePromptId/waiting), 519-527 (status line)
  found: Status line renders iff `state.busy && state.status && !waiting`. `activePromptId` reads `state.pending` first (the prompts-table card, live whether or not a turn runs) and only falls back to the timeline when `state.busy`. After `quiz_result` lands, `unanswered(pending.id)` is false, so `waiting` is false — the `!waiting` half of the gate opens correctly.
  implication: On the restored path only `state.busy` blocks the line.

- timestamp: 2026-11-05T00:10:00Z
  checked: web/src/lib/lessonReducer.ts:99-126, 155-173, 256-268
  found: `busy` is set true by `ready` (from server payload), `turn_start`, and the four card events; set false by `turn_end` (unless held). `case 'status'` sets `status` only. `init` takes `busy` from the server view and sets `status` to null when idle.
  implication: Nothing in the restored sequence (quiz_result → status) touches busy; it stays at the server's boot-time value until `turn_start`.

- timestamp: 2026-11-05T00:12:00Z
  checked: server/src/index.ts:312-317 `busy()`, 337 lessonView, 928 SSE `ready`; server/src/agent.ts:28-34 `isBusy`
  found: `busy(id)` = `active.has(id)` (in-memory map, empty after restart) or, for external lessons only, `lastTurn(id).status === 'running'`. Agent lesson after restart → false. Both the GET view and the SSE `ready` carry it.
  implication: The restored page initialises with busy:false and stays so until a new turn starts.

- timestamp: 2026-11-05T00:14:00Z
  checked: server/src/actions.ts:369-397 `gradeQuiz`; server/src/index.ts:996-1012 `gradeRestored`, 1015-1040 `graderFor`, 1099-1125 POST /answer
  found: Restored branch: `gradeRestored` → `graderFor('quiz')` → `actions.gradeQuiz` → emits `quiz_result` (393) then `emitEphemeral('status', 'Grading your answer')` (397), synchronously, before the route reaches `void runTurn(...)` (1122). `runTurn` emits `turn_start` asynchronously afterwards. The inline comment at 394-396 explains the ordering only in terms of the `!waiting` suppression.
  implication: Server emission order is quiz_result → status → (later) turn_start; the status is the first ephemeral ever emitted while no turn is active.

- timestamp: 2026-11-05T00:18:00Z
  checked: Replay of both sequences through the real reducer (scratchpad/replay.ts, `cd server && node --import tsx .../replay.ts`)
  found: RESTORED: init {busy:false, waiting:true, rendered:false} → quiz_result {busy:false, status:null, waiting:false, rendered:false} → status {busy:false, status:'Grading your answer', rendered:false} → turn_start {busy:true, status:'Thinking', rendered:true}. LIVE: init {busy:true, status:'Thinking', waiting:true, rendered:false} → quiz_result {rendered:true, status:'Thinking'} → status {status:'Grading your answer', rendered:true}.
  implication: Direct reproduction of the UAT observation (null → 'Thinking' only) from the browser-side fold alone; the live path shows the identical two events do render the line when busy is already true.

- timestamp: 2026-11-05T00:19:00Z
  checked: git blame / log -S on the gate and the emit
  found: Gate line Lesson.tsx:519 is from bf06725 "Derive 0.2" (2026-09-05). The `Grading your answer` emit is from c2461bf "refactor(05-03): one grading path, and the line the learner waits through" (2026-11-04).
  implication: The gate predates the restore path by two months; it was correct for every status emitted up to 05-03 because all of them came from inside a running turn.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: web/src/pages/Lesson.tsx:519 renders the gold status line only when `state.busy` (a turn is running). On the restored-card path (05-03, D-26) the server grades first (server/src/index.ts:1115 → actions.ts:393-397 emits `quiz_result` then the ephemeral `status: Grading your answer`) and only then starts the fresh turn (index.ts:1122), so the status event reaches the reducer (lessonReducer.ts:125 sets `status` only) while `busy` is still the boot-time false from `busy(id)` (index.ts:312-317; the `active` map is empty after a restart). The gate drops it; the next event, `turn_start`, sets busy=true and replaces status with `Thinking` in the same step (lessonReducer.ts:101-110), so the learner sees null → `Thinking`. The `busy` conjunct was a correct proxy until 05-03 introduced the first status emitted outside a turn; plan 05-03 "verified, not changed" the gate but only examined its `!waiting` half.
fix: (not applied — diagnose-only) Suggested direction: drop the `state.busy &&` conjunct from the status-line gate at Lesson.tsx:519, leaving `state.status && !waiting`; `status` is already null whenever no turn is running (init idle, turn_end, every content/card event), so busy adds nothing but this suppression. No new copy, no new mechanism, one token removed.
verification: (not applied)
files_changed: []
