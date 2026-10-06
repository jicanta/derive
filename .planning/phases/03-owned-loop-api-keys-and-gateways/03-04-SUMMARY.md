---
phase: 03-owned-loop-api-keys-and-gateways
plan: 04
subsystem: database
tags: [ai-sdk, model-messages, resume, idempotency, migrations, fsrs, learner-prefs]

# Dependency graph
requires:
  - phase: 03-owned-loop-api-keys-and-gateways
    provides: "plan 03-01's owned loop (server/src/drivers/api.ts), its in-memory ModelMessage accumulation, the per-lesson serialise mutex and the abort handling"
  - phase: 03-owned-loop-api-keys-and-gateways
    provides: "plan 03-03's five teaching adapter rows and the stub-model suite that drives the real loop once per provider"
  - phase: 02-settings-and-secrets
    provides: "chooseModel's four-tier resolver, the provider catalogue and its teaches flag, and the per-learner model override WR-01 reported as broken"
  - phase: 01-foundation
    provides: "the numbered transactional migration runner, withTx, the turns/usage ledger and recordUsage's rule that a denormalised column is read off the row it was copied from"
provides:
  - "Migration 6: turn_messages (one provider-neutral ModelMessage history per lesson, with the driver that wrote it) and tool_results (one row per executed tool call), with both indexes and no backfill"
  - "Migration 7: an existing install's bare-string learner model preference converted onto the provider that was active when it was stored"
  - "saveTurnMessages, loadTurnMessages, clearTurnMessages, recordToolResult, recordedToolResult and TurnMessagesRow, with both tables cleared inside deleteLesson's existing transaction"
  - "The owned loop resumes: it loads the lesson's history before the request and saves it after every tool result, every step, on abort, in the catch and in the finally"
  - "patchOrphans: a synthesized error-text tool result for every call an abort left unanswered, so a stopped turn is not the last one the lesson can run"
  - "D-07's replay guard: a call id already recorded returns its recorded result instead of running the tool again, asked by lesson so a restart's new turn still finds it"
  - "LearnerPrefs.model as a per-provider record, validated key by key against the catalogue, read by chooseModel as prefs.model?.[provider] (WR-01 fixed)"
  - "The step cap ends a turn interrupted rather than failed, with setStepCapOverride as the test seam that reaches it"
affects: [03-05 the headroom check that bounds this history, 03-06 web search and the provider-executed call path, 03-08 cost in the lesson header, 04 local models and the conformance harness, 06 personalization reading LearnerPrefs]

actuals:
  tokens: 19886
  tasks: 3
  commits: 3
  plan_head_before: ea3953431f76fc9d5fd759667c73ee5d025141ba

tech-stack:
  added: []
  patterns:
    - "A resumable history lives in one TEXT column of JSON.stringify'd ModelMessages, stored verbatim: the per-block provider signatures ride inside each part's providerOptions and nothing filters or rewrites one"
    - "A drop-on-provider-change is enforced inside the accessor (loadTurnMessages compares the stored driver) rather than at the call site, so it cannot be forgotten"
    - "An idempotency record is read at the grain the failure happens at, not the grain it is written at: the row names the turn, the lookup asks the lesson"
    - "A mutable per-provider preference merges key-wise, so patching the provider in front of the learner cannot drop the ids they stored for the others"
    - "A test-only seam (setStepCapOverride) is the honest way to assert a branch whose production threshold is 400"

key-files:
  created: []
  modified:
    - server/src/migrations.ts
    - server/src/db.ts
    - server/src/settings.ts
    - server/src/driver.ts
    - server/src/agent.ts
    - server/src/drivers/api.ts
    - server/test/tx.test.ts
    - server/test/migrations.test.ts
    - server/test/api-driver.test.ts
    - server/test/settings.test.ts
    - web/src/pages/You.tsx
    - web/src/lib/types.ts
    - web/src/lib/api.ts

key-decisions:
  - "The replay guard is asked by lesson, not by turn: recordedToolResult takes the turn and resolves its lesson, because a turn-scoped read is the per-turn set D-07 explicitly rejected"
  - "LearnerPrefs.model merges per provider in updateLearnerPrefs rather than replacing the field, so switching providers cannot drop an id stored for another"
  - "The /you model field writes and reads under the provider the install runs on, because cleanPrefs now refuses a bare string and the Phase 2 feature would otherwise silently stop saving"
  - "The loop records each tool call id once and keeps assistant prose in the history, so a provider retry cannot leave the history asking for one call twice"
  - "patchOrphans takes the turn's live answered set, so the patch and a tool still returning cannot both answer the same call"
  - "The orphan case is driven with a provider-executed tool call, which is the one orphan shape with no race in it"

patterns-established:
  - "Every new mechanism was seen failing with its mechanism removed before it was kept: the delete cascade, the history load, the provider-change clear, the orphan patch and the replay guard"
  - "An assertion that recorded the old contract is updated in place with a sentence saying why, never deleted: the four settings.test.ts model cases"

requirements-completed: [PROV-08, PROV-01, PROV-02, PROV-03, PROV-04, PROV-05]

coverage:
  - id: D1
    description: "Interrupting a turn and sending the next message continues the lesson: the aborted turn's orphaned tool calls carry a synthesized error tool_result, so the persisted history is one a provider will accept"
    requirement: PROV-08
    verification:
      - kind: integration
        ref: "server/test/api-driver.test.ts#synthesizes an error-text result for the call it orphaned, and the next request is well formed"
        status: pass
      - kind: unit
        ref: "server/test/api-driver.test.ts#answers each unanswered call once and leaves an answered one alone"
        status: pass
    human_judgment: true
    rationale: "The patch, the stored shape and the next request's well-formedness are proven with a stub model; that a real provider accepts the patched history on a real Stop needs a provider key, and none exists in this environment (03-RESEARCH.md §Environment Availability). Recorded as WINDOWS.md entry 16."
  - id: D2
    description: "A Stop ends the turn as interrupted rather than failed, and the lesson stays resumable"
    requirement: PROV-08
    verification:
      - kind: integration
        ref: "server/test/api-driver.test.ts#synthesizes an error-text result for the call it orphaned, and the next request is well formed (asserts turn_end {ok:true,interrupted:true} and turns.status interrupted)"
        status: pass
      - kind: integration
        ref: "server/test/api-driver.test.ts#records one turn_end carrying interrupted rather than an error (03-03's case, still green)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A lesson resumes from its persisted provider-neutral history: the next turn's request carries the previous turn's messages, and no system message is ever persisted"
    requirement: PROV-08
    verification:
      - kind: integration
        ref: "server/test/api-driver.test.ts#carries the first turn's messages into the second request, with no system message among them"
        status: pass
    human_judgment: false
  - id: D4
    description: "A provider change drops the lesson's persisted messages, on the same comparison that already clears the session id"
    requirement: PROV-08
    verification:
      - kind: integration
        ref: "server/test/api-driver.test.ts#drops the history and the session id together when the provider changes"
        status: pass
      - kind: other
        ref: "grep -c clearTurnMessages server/src/agent.ts → 2 (the import and the call on the driver comparison)"
        status: pass
    human_judgment: false
  - id: D5
    description: "A replay returns the recorded result for a tool call id rather than running the tool again, so a crash cannot re-grade a quiz and move an FSRS row the learner already earned"
    requirement: PROV-08
    verification:
      - kind: integration
        ref: "server/test/api-driver.test.ts#runs the action exactly once when the same call id arrives on a later turn"
        status: pass
    human_judgment: true
    rationale: "The guard is proven across two real turns on one lesson with a stub model, counting the action's own events. The quiz_results-count half of the plan's human check (a mid-card Stop on a real key, counted in sqlite3 before and after) needs a provider key; recorded as WINDOWS.md entry 16."
  - id: D6
    description: "A deleted lesson or learner leaves no turn_messages or tool_results rows, and a bystander learner's rows are untouched"
    verification:
      - kind: unit
        ref: "server/test/tx.test.ts#leaves no history and no recorded result behind a deleted lesson"
        status: pass
      - kind: unit
        ref: "server/test/tx.test.ts#leaves none behind a deleted learner, and the bystander keeps theirs"
        status: pass
      - kind: other
        ref: "red-then-green: with the two deleteLesson clears removed, 5 of 18 tx cases fail"
        status: pass
    human_judgment: false
  - id: D7
    description: "A learner's model override is stored and read per provider, each value bounded and each key a catalogue row"
    requirement: PROV-01
    verification:
      - kind: integration
        ref: "server/test/settings.test.ts#keeps a learner-owned model on the provider it was stored under, and hands no other provider that id"
        status: pass
      - kind: integration
        ref: "server/test/settings.test.ts#bounds the learner model id like the install one, refuses a key that is not a provider, and clears it with an empty string"
        status: pass
      - kind: integration
        ref: "server/test/settings.test.ts#runs a learner-owned model on that learner's next turn and keeps it out of the prompt"
        status: pass
      - kind: other
        ref: "grep -c 'prefs.model?.[provider]' server/src/settings.ts → 1"
        status: pass
    human_judgment: false
  - id: D8
    description: "An existing install's bare-string learner model preference is converted onto the provider it was meant for, by a numbered transactional migration"
    requirement: PROV-01
    verification:
      - kind: unit
        ref: "server/test/migrations.test.ts#moves a bare string onto the provider that was active when it was stored"
        status: pass
      - kind: unit
        ref: "server/test/migrations.test.ts#falls back to claude-code with no active provider stored, and leaves every other shape byte-identical"
        status: pass
      - kind: unit
        ref: "server/test/migrations.test.ts#falls back to claude-code when the stored provider is one that cannot teach"
        status: pass
      - kind: unit
        ref: "server/test/migrations.test.ts#pins LATEST_VERSION, so a migration that forgets to bump the number is visible"
        status: pass
    human_judgment: true
    rationale: "The conversion is proven against a database stood on version 5 and migrated forward. The last clause of the plan's human check — that an install which already had an override set in Phase 2 still shows it on /you and now applies it only on that provider — is a browser observation on a real upgraded database, not something a Node suite asserts."
  - id: D9
    description: "The /you page writes and shows the learner's model id under the provider this install runs on, so the Phase 2 feature keeps working on the new shape"
    requirement: PROV-01
    verification:
      - kind: other
        ref: "pnpm typecheck (web, noUnusedLocals + strict) exits 0 with LearnerPrefs.model as Record<string, string>"
        status: pass
    human_judgment: true
    rationale: "No web test exists in this repo (03-PATTERNS: web has no test runner). The field is typed end to end and the server contract it writes is covered by D7, but that the input shows the stored id and saving leaves other providers' ids alone is a browser observation."
  - id: D10
    description: "A turn that runs into the step cap ends continuable rather than as an error card, and the lesson keeps a history to resume from"
    requirement: PROV-08
    verification:
      - kind: integration
        ref: "server/test/api-driver.test.ts#ends a turn that ran into it as interrupted, with the lesson still resumable"
        status: pass
    human_judgment: false

# Metrics
duration: 28 min
completed: 2026-10-06
status: complete
---

# Phase 03 Plan 04: The Owned Loop Resumes Summary

**A lesson's conversation is now persisted state: the loop loads it before every request and saves it after every step, an abort leaves a synthesized `error-text` result for each orphaned tool call so the next request is one a provider accepts, a replayed call id returns its recorded result instead of re-grading a quiz, and a learner's model override is finally keyed by the provider they chose it on.**

## Performance

- **Duration:** 28 min
- **Started:** 2026-10-06T23:02:05Z
- **Completed:** 2026-10-06T23:31:03Z
- **Tasks:** 3
- **Files modified:** 13 (0 created, 13 modified)

## Accomplishments

- **PROV-08's resume clause is literally true rather than usually true.** `turn_messages` holds one provider-neutral `ModelMessage[]` per lesson, keyed by the driver that wrote it. The loop starts a request as `[...prior, { role: 'user', content: ctx.prompt }]` and saves after every tool result, every `finish-step`, on the `abort` part, in the `catch` and in the `finally` — so a crash loses at most the step in flight. The driver comparison lives inside `loadTurnMessages`, which answers an empty array when the stored driver is not the one asking, so D-04's drop on a provider change cannot be forgotten at a call site; `agent.ts` also clears the row on the same comparison that clears the session id, and the comment there now says why the two go together.
- **An abort leaves a history a provider will accept.** `patchOrphans` walks the accumulated history for assistant `tool-call` parts with no matching `tool-result` and appends one synthesized `ToolResultPart` each, with `output: { type: 'error-text', value: 'The learner stopped the turn before this tool ran.' }` — the purpose-built shape every adapter maps to its own error-result encoding. It runs before every save and is idempotent, and it takes the turn's live `answered` set, so a Stop landing while a card is open cannot produce two results for one call whichever of the patch and the still-returning tool gets there first.
- **A replay cannot re-grade.** Each tool's `execute` asks `recordedToolResult` inside the per-lesson mutex before anything else and returns the recorded output when there is one; after the action returns, `recordToolResult` writes the row in the same step as the history entry, so the guard and the history can never disagree. The record is an `INSERT OR IGNORE` on `(turn_id, call_id)`, and the read is by lesson — because a turn resumed after a restart is a *new* turn row, which is exactly the case D-07 rejected an in-memory per-turn set for.
- **WR-01 is fixed.** `LearnerPrefs.model` is `Record<string, string>`; `cleanPrefs` validates each key against the catalogue with `providerOf` and keeps the existing 200-character bound and `/^[A-Za-z0-9._:/-]+$/` test per value, dropping a bad entry rather than refusing the whole patch; `chooseModel` reads `prefs.model?.[provider]` with the four-tier order and the `modelSource` vocabulary untouched. Migration 7 converts an existing bare string onto the provider the install was on when it was stored (`active_provider`, or `claude-code` where that is absent or names a row that cannot teach), and says in prose why that cannot be reverted.
- **The step cap stopped being a cliff.** Reaching `isStepCount(400)` now ends the turn with the same `{ ok: true, interrupted: true }` shape a Stop produces, so a runaway guard costs a turn rather than a lesson. `setStepCapOverride` is the test seam, in the same spirit as `setModelOverride`: no route, header, environment variable or config file reaches it.
- **Every new mechanism was seen failing before it was kept.** Removing the two `deleteLesson` clears turned 5 of 18 `tx.test.ts` cases red; removing the `patchOrphans` calls turned the orphan case red; replacing the replay guard with `null` turned the replay case red; removing the history load and the provider-change clear turned the resume and orphan cases red. Each was restored and re-run green.

## Task Commits

1. **Task 1: Migration 6, migration 7 and the accessors** — `dd663ad` (feat)
2. **Task 2: The loop resumes, replays by call id and patches orphans** — `2052d0c` (feat)
3. **Task 3: The suites cover resume, the drop, the patch, the replay and the conversion** — `0a81617` (test)

**Plan metadata:** the `docs(03-04): …` commit carrying this file, STATE.md and WINDOWS.md.

`git rev-list --count ea3953431f76fc9d5fd759667c73ee5d025141ba..HEAD` measures **3** commits for this plan's production work, plus this metadata commit.

## Files Created/Modified

- `server/src/migrations.ts` (435 → 540 lines) — migration 6 (`turn_messages`, `tool_results`, both indexes, no backfill and a comment saying why) and migration 7 with `convertLearnerModelPrefs`
- `server/src/db.ts` (1228 → 1377 lines) — `TurnMessagesRow`, five prepared statements, the five accessors, the two clears inside `deleteLesson`'s transaction, the per-provider `LearnerPrefs.model` and its `cleanPrefs` validation, and the key-wise merge in `updateLearnerPrefs`
- `server/src/settings.ts` — `chooseModel` reads `prefs.model?.[provider]`
- `server/src/driver.ts` — `TurnContext.turnId`
- `server/src/agent.ts` — `clearTurnMessages` on the driver comparison; `turnId` threaded into the context
- `server/src/drivers/api.ts` (329 → 469 lines) — `STEP_CAP`/`setStepCapOverride`, `answeredIds`, `calledIds`, `patchOrphans`, the load/save/answer path, the replay guard and record inside `execute`, and the continuable step-cap ending
- `server/test/tx.test.ts` (367 → 419 lines) — both tables in `childRows` and in every whole-object comparison, plus two cases
- `server/test/migrations.test.ts` (554 → 609 lines) — `atVersion5`, `prefsOf` and four conversion cases
- `server/test/api-driver.test.ts` (510 → 723 lines) — six new cases and three helpers (`says`, `turnWith`, `callsOf`)
- `server/test/settings.test.ts` — the four model cases updated in place with the reason, plus one new case on the per-provider keying
- `web/src/pages/You.tsx`, `web/src/lib/types.ts`, `web/src/lib/api.ts` — the model field reads and writes under the active provider

## Decisions Made

- **The replay guard is asked by lesson, not by turn.** The plan's signature is `recordedToolResult(turnId, callId)` and it is kept, but the body resolves the turn's lesson and looks the row up by `(lesson_id, call_id)`. A turn-scoped read would be functionally the in-memory per-turn `Set` that D-07 names and rejects: a restart opens a new turn row, so a turn-scoped guard finds nothing in exactly the case D-07 says "is the one that damages the memory record". The `(turn_id, call_id)` primary key stays, because the row's job is also to record *which* turn ran the call.
- **`updateLearnerPrefs` merges the model record key-wise.** The settings page patches the provider the install is on. A whole-field overwrite — the behaviour every other preference field has — would silently drop the ids a learner stored for every other provider the first time they switched, which is a new data-loss bug introduced by the very change that fixes WR-01. An empty value under a key still clears that one provider, because `cleanPrefs` drops it.
- **`/you` keeps one input and takes the provider from the call it already makes.** The page reads `prefs.model?.[provider]` on load and sends `{ [provider]: value }` on save, with the provider taken from the `activeTutor()` request that already fills the placeholder. The alternative — translating the bare string at the HTTP boundary in both directions — would have hidden the real shape from the client and left the input rendering `[object Object]`.
- **Each tool call id is recorded in the history once.** A provider retry re-sends a call id, and a history that asks for one call twice while answering it once is a history a provider may refuse. The loop keeps a `called` set seeded from the loaded history and skips a duplicate push; the replay guard answers the retry from the record.
- **Assistant prose is accumulated into the history on block flush.** Without it a resumed turn would carry the tutor's tool calls and none of what it actually said. Reasoning is still never persisted — D-09 keeps it out of SQLite entirely — so there is none to round-trip, and the code comment says so at the line that would otherwise be the place to add it.
- **The orphan case is driven with a provider-executed tool call.** A blocking Derive tool races: `interrupt()` aborts and then cancels the pending card, so whether the patch or the tool's own return lands first is timing. A `providerExecuted: true` call is not executed by the SDK at all, so the abort leaves a genuine orphan every time. `patchOrphans` is additionally covered as a unit, which is where the exact sentence and shape are pinned.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The per-provider `LearnerPrefs.model` would have silently broken the `/you` model field**

- **Found during:** Task 1 (step 5)
- **Issue:** `web/src/pages/You.tsx` sends and renders `prefs.model` as a bare string. With `cleanPrefs` accepting only a record, a learner typing an id would have had it dropped on the way in and `[object Object]` rendered on the way back — the Phase 2 feature failing silently. The plan's own human check (step 5) requires `/you` to still show a stored override, and the plan's `files_modified` lists no web file.
- **Fix:** `web/src/lib/types.ts` declares `model?: Record<string, string>`; `web/src/lib/api.ts` widens `setPrefs`; `You.tsx` keeps one text input, reads `prefs.model?.[provider]` and writes `{ [provider]: value }`, with the provider taken from the `activeTutor()` call the page already makes before turning the profile into a draft.
- **Files modified:** `web/src/lib/types.ts`, `web/src/lib/api.ts`, `web/src/pages/You.tsx`
- **Verification:** `pnpm typecheck` clean under the web project's `strict` + `noUnusedLocals`; the server half is covered by the three settings cases
- **Committed in:** `dd663ad`

**2. [Rule 1 - Bug] Replacing the whole `model` field on a patch would drop other providers' ids**

- **Found during:** Task 1 (step 5)
- **Issue:** `updateLearnerPrefs` merges at the top level, so a patch naming one provider replaced the entire record. A learner with an id on Anthropic who then set one on OpenAI would lose the first.
- **Fix:** `model` merges key-wise inside `updateLearnerPrefs`, with a comment saying why it is the one field that does.
- **Files modified:** `server/src/db.ts`
- **Verification:** `server/test/settings.test.ts#keeps a learner-owned model on the provider it was stored under…` asserts the record holds both after two patches
- **Committed in:** `dd663ad`

**3. [Rule 2 - Missing Critical] A turn-scoped replay read is the per-turn set D-07 rejected**

- **Found during:** Task 2 (step 3)
- **Issue:** The plan specifies `recordedToolResult(turnId, callId)`. Read literally against the `(turn_id, call_id)` key, a turn resumed after a restart — which opens a new turn row — finds nothing, so the guard covers a provider retry and not a crash. D-07's own text rejects that scope by name, and the plan's Task 3 case ("drives a second turn whose stub replays the same `toolCallId`") cannot pass under it.
- **Fix:** The signature is kept; the body resolves the turn's lesson and reads `(lesson_id, call_id)`. A call id is the provider's own, made for one request, so the lesson is the honest scope. Written into the statement's comment and the function's doc.
- **Files modified:** `server/src/db.ts`
- **Verification:** `server/test/api-driver.test.ts#runs the action exactly once when the same call id arrives on a later turn` is red with the guard replaced by `null` and green with it
- **Committed in:** `2052d0c` (the read), `0a81617` (the case)

**4. [Rule 1 - Bug] The orphan patch and a still-returning tool could both answer one call**

- **Found during:** Task 2 (step 4)
- **Issue:** `interrupt()` aborts the request and then cancels the lesson's pending card, which resolves the blocking tool. With `patchOrphans` recomputing its own answered set, the patch and the tool's own result could both append a `tool-result` for the same `toolCallId`, leaving the history with two results for one call.
- **Fix:** `patchOrphans(messages, answered = answeredIds(messages))` takes the turn's live set and adds to it; every call site inside the loop passes it. The default keeps the function standalone, which is how it is unit-tested.
- **Files modified:** `server/src/drivers/api.ts`
- **Verification:** the orphan case asserts exactly one `tool` message for the orphaned id and the next request's walk shows every call answered; the unit case asserts the second `patchOrphans` call adds nothing
- **Committed in:** `2052d0c`, `0a81617`

**5. [Rule 3 - Blocking] `ToolResultOutput` is not exported by `ai`**

- **Found during:** Task 2 (step 4)
- **Issue:** The research names the type and `@ai-sdk/provider-utils` declares it, but that package is not a direct dependency of `server`, and `ai` re-exports `ToolResultPart` and not `ToolResultOutput`.
- **Fix:** Derived locally from `ModelMessage` (`Extract<Extract<ModelMessage, { role: 'tool' }>['content'][number], { type: 'tool-result' }>['output']`) rather than adding a dependency for one type, with a comment saying why.
- **Files modified:** `server/src/drivers/api.ts`
- **Verification:** `pnpm typecheck` clean
- **Committed in:** `2052d0c`

**6. [Rule 1 - Bug] Four settings cases recorded the bare-string model as an assertion**

- **Found during:** Task 1 (step 6)
- **Issue:** `server/test/settings.test.ts` asserted `prefs.model === 'my-own-model'` in four places (three over HTTP against the built server, one in process). Those are the pre-WR-01 contract.
- **Fix:** Each updated in place with a sentence saying why, none deleted or loosened; two of the HTTP cases also needed their own learner names, because `createLearner` is name-deduped and the new key-wise merge made them inherit each other's stored ids. One new case was added for the per-provider keying itself.
- **Files modified:** `server/test/settings.test.ts`
- **Verification:** `pnpm test` 330/330 at the end of Task 1
- **Committed in:** `dd663ad`

**7. [Rule 2 - Missing Critical] A duplicated tool call id in the history**

- **Found during:** Task 3 (step 6)
- **Issue:** A resumed turn whose provider re-sent an already-recorded call id pushed a second assistant `tool-call` part for it while the replay guard correctly declined to add a second result — leaving a history that asks for one call twice and answers it once, which a provider may refuse.
- **Fix:** A `called` set, seeded from the loaded history, so a tool-call part is recorded once per id.
- **Files modified:** `server/src/drivers/api.ts`
- **Verification:** the replay case asserts the stored history holds exactly one result and the next request's walk asserts every call is answered
- **Committed in:** `0a81617`

---

**Total deviations:** 7 auto-fixed (3 bugs, 3 missing critical, 1 blocking)
**Impact on plan:** No scope change to the plan's objective. Three (1, 2, 6) are the necessary consequence of the `LearnerPrefs.model` reshape the plan asked for, and the first of those is the only work outside the plan's `files_modified` — three web files, required because the plan's own human check expects `/you` to keep working. Two (3, 4) close holes where the plan's literal instruction would not have satisfied the decision it cites. One (7) is a correctness hole the plan's own "well-formed history" assertion pointed at. One (5) is a one-line type derivation.

## Known Stubs

None. No value a learner is shown comes from a placeholder in this plan, and the diff adds no `TODO`, `FIXME`, skipped test or hardcoded empty that reaches the UI.

`setStepCapOverride` is a test seam rather than a stub, in the same documented family as `setModelOverride` and `setDriverOverride`: it is reachable from no route, header, environment variable or config file, and the production path reads `STEP_CAP`.

## Threat Flags

None. Every surface this plan adds — the stored history crossing back into a request body, a stored result returned as though the tool had just run, and migration 7 rewriting a stored preference — is already in the plan's `<threat_model>` as T-03-22 through T-03-28, and each mitigation is in place: the replay guard is consulted inside the mutex and the record is `INSERT OR IGNORE` (T-03-22); `loadTurnMessages` compares the driver and `agent.ts` clears the rows on the same comparison as the session id (T-03-23); nothing surfaces the blob to the browser, the SSE stream or the vault mirror (T-03-24); `learner_id` is read off the lesson row and the lesson off the turn row, never from a caller (T-03-25); the conversion runs inside the runner's transaction after its `VACUUM INTO` snapshot, with both shapes asserted (T-03-26); the rows are one per lesson and are cleared with the lesson, and plan 03-05's headroom check is what bounds the history's size (T-03-27); `sinkFor`'s `endTurn` guard is untouched and the aborted-turn case asserts exactly one `turn_end` (T-03-28).

## Issues Encountered

- **The plan's Task 3 orphan case could not be driven deterministically with a blocking Derive tool.** `interrupt()` aborts and then calls `cancelPending`, which resolves the open card, so whether the orphan patch or the tool's own result lands first is a timing race. The case is driven with a `providerExecuted: true` call instead — the SDK does not execute those, so the abort leaves a real orphan every run — and `patchOrphans` is additionally covered as a unit for the exact sentence and shape. The race itself is now harmless either way (deviation 4).
- **The plan's `<human-check>` could not be run.** No Anthropic, OpenAI, Gemini or OpenRouter key and no OpenAI-compatible endpoint exist in this environment (`03-RESEARCH.md` §Environment Availability). Recorded in `.planning/WINDOWS.md` as open `unrun-verify` entry 16 and carried into the phase UAT as D1, D5, D8 and D9 in the coverage block.
- **`requirements.ready-ids` returned none of the six ids.** Every requirement this plan declares is also declared by a sibling plan in this phase that has no SUMMARY yet, so the shared-ID gate correctly holds them all; `REQUIREMENTS.md` is unchanged by this plan.

## User Setup Required

None — no external service configuration is required. The real-provider confirmation needs a learner's own key, which is the human check, not a setup step.

## Next Phase Readiness

- **Plan 03-05 inherits the thing it bounds.** `turn_messages` is now the growing input its pre-request headroom check has to measure; the row is one per lesson and `loadTurnMessages` is the single read, so the check has one place to hook into.
- **Plan 03-06 inherits the provider-executed path already exercised.** The loop records a `providerExecuted: true` tool call verbatim into the history and the orphan case drives one end to end, so wiring a real native search tool is a matter of `Adapter.search` returning one.
- **Plan 03-08 is unaffected:** no usage column, no `cost_source` value and no ledger write changed.
- **Phase 4's conformance harness** gains two tables it can assert parity over: a resumed lesson on any provider should produce the same event vocabulary, and the replay guard is provider-independent by construction.
- **Phase 6** reads `LearnerPrefs` for theme and typography; the field it will extend now has one shape that is validated key by key, and the migration runner is the established route for any further reshape.

**Open question carried forward:** a real Stop-and-continue, a mid-card Stop with the `quiz_results` count unchanged, a provider switch mid-lesson, and an upgraded install's `/you` override are queued for the phase UAT.

## Self-Check: PASSED

- All 13 modified files — FOUND on disk
- commits `dd663ad`, `2052d0c`, `0a81617` — FOUND in `git log --all`
- `git rev-list --count ea3953431f76fc9d5fd759667c73ee5d025141ba..HEAD` → 3, matching `actuals.commits`
- `pnpm method:check && pnpm typecheck && pnpm build && pnpm test` — all exit 0; **342 tests, 342 pass, 0 fail** (up from 329)
- Task 1 gates: `node -e` migration script prints `migrations ok` (versions 6 and 7 present, no `IF NOT EXISTS` in 6); `grep -c "prefs.model?.[provider]" server/src/settings.ts` → 1; `grep -c "deleteTurnMessagesByLesson\|deleteToolResultsByLesson" server/src/db.ts` → 5 (≥4 required)
- Task 2 gates: no `responseMessages` in code with `//` comments stripped → 0; `grep -c error-text server/src/drivers/api.ts` → 3; `grep -c recordedToolResult …/api.ts` → 2; `grep -c clearTurnMessages server/src/agent.ts` → 2
- Task 3 gates: `grep -c turn_messages server/test/tx.test.ts` → 8; `grep -c tool_results …` → 8; `node -e` migrations-suite script prints `migration cases present`
- Red-then-green recorded for the delete cascade (5 fail), the orphan patch (1 fail), the replay guard (1 fail), and the history load plus provider-change clear (2 fail); each restored and re-run green
- `.planning/WINDOWS.md` entry 16 records the unrun human check

---
*Phase: 03-owned-loop-api-keys-and-gateways*
*Completed: 2026-10-06*
