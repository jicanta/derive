---
phase: 04-local-models-parity-proof-and-usage
plan: 03
subsystem: providers
tags: [prov-11, teaching-proof, driver-seam, scratch-lesson, migration, settings, capability]

# Dependency graph
requires:
  - phase: 04-02-the-capability-read
    provides: capability.ts and its two tiers, probe.ts's postJson/field/statusOf, the remembered verdict and its refusals
  - phase: 04-01-local-models-on-the-owned-loop
    provides: every catalogue row teaching, numCtxFor and the caller-resolved window, the three local adapter rows
  - phase: 03-owned-loop
    provides: the Driver/EventSink seam, apiDriverFor, validateToolInput, the turn ledger and deleteLesson's one transaction
provides:
  - "driverFor: the one named per-provider driver resolution, extracted from runTurn's inline expression"
  - "runTurn's per-turn provider-and-model option, which is what lets a turn run on a row that is not the learner's active one"
  - "testTeaching: one scripted turn through the production loop — one node, one quiz the server grades — in a scratch lesson deleted in the same request"
  - "migration 8's lessons.scratch marker, createLesson's scratch option, both listings excluding scratch rows, and sweepScratchLessons on the boot pass"
  - "POST /api/settings/:provider/test-teaching, always a 200 with the result, scoped to learnerOf(c)"
  - "the test teaching control on every row whose teaches is true, the two login rows included, with the approved running/pass/fail readouts"
  - "the vault mirror skipping a scratch lesson, so a proof leaves no note behind"
  - "a dated ## Amendments section on the approved 04-UI-SPEC.md recording the widened placement with no copy change"
affects: [04-04-conformance-harness, 04-05-usage-page, 05-learning-experience]

# Actuals (#2632) — same estimateTokens scale (chars/4) as the plan's estimate.
# Instrument named so a future calibration compares like with like: chars/4 over
# the ADDED lines of the realized diff of server/src, web/src and server/test
# between plan_head_before and HEAD (37,036 chars). NOT a harness token count.
actuals:
  tokens: 9259
  tasks: 3
  commits: 3
plan_head_before: 67b0965717b0838193ea16490930609bf3232487

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A per-provider resolution is a named exported function, so a turn can run on the row that was pressed rather than only on the row that is active"
    - "An ephemeral record is marked with a typed column rather than a sentinel value, so the existing transactional delete already cleans it up and the crash case is findable at boot"
    - "A proof reads its outcome off the lesson's own event log, which is the one observation every driver makes alike"
    - "A one-shot probe asks the learner's own address whether anything is there before spending a model request, so a closed port answers in Derive's own sentence instead of two minutes of provider backoff"
    - "An approved, signed-off contract is amended by appending a dated section, never by editing a reviewed row in place"

key-files:
  created: []
  modified:
    - server/src/migrations.ts
    - server/src/db.ts
    - server/src/agent.ts
    - server/src/capability.ts
    - server/src/index.ts
    - server/src/export.ts
    - server/test/api.test.ts
    - server/test/migrations.test.ts
    - web/src/lib/types.ts
    - web/src/lib/api.ts
    - web/src/components/ProviderRow.tsx
    - .planning/phases/04-local-models-parity-proof-and-usage/04-UI-SPEC.md

key-decisions:
  - "The transport failure is read BEFORE the turn, not out of it: on a row whose address the learner supplied, testConnection runs first. Without it a closed port is two minutes of the owned loop's retry backoff ending in the SDK's own words, which name no address — the approved sentence `nothing answered at {host}:{port}` only exists in probe.ts, and this is how it reaches the learner unduplicated"
  - "The seam is proven by where the model request LANDED, not by the sentence it produced: the pre-flight can answer the closed-port case without the per-turn tutor ever being read, so the routing case points the pressed row at a recording fake and asserts a completion path reached THAT address while another row was active. Removing the seam fails exactly that case"
  - "The probe settles its own cards and answers the quiz by the option's TEXT rather than its position, so a model that reorders its options still has its own key honoured; actions.ts does the grading, as it does for a learner"
  - "set_plan's own schema requires at least three nodes, so the scripted graph is three and the teaching is one node — which is all PROV-11 claims"
  - "The pass is read from a graded quiz_result, and every other outcome falls through an ordered chain of one observable each: nothing answering (before the run), the loop's own refusal sentence, zero tool-trace events, then the ungradable sentence"
  - "driverFor is a function declaration and typed on ProviderId: the declaration because capability.ts/agent.ts/drivers/api.ts now form a ring that is safe only while no module reads another's bindings at module-evaluation time, and the narrow type so no `as` cast is needed"
  - "The vault mirror skips a scratch lesson. Its 600 ms debounce can fire mid-probe and getLesson only guards the already-deleted case, so without this a proof could leave a note in the learner's Obsidian vault that outlives the lesson — a trace, which D-11 forbids"
  - "The scratch sweep runs BEFORE the stale-turn close at boot, so a crash-surviving proof is removed rather than first having a turn_end event written into it"

patterns-established:
  - "A gate is seen failing with its mechanism removed before it is kept — applied to all five new gates here (the seam, the sweep, the listing exclusion, and each of the two fail sentences separately)"
  - "A structural test of a trust-establishing feature states in the file what it does NOT prove: these cases prove the plumbing and the cleanup and say nothing about any model's competence"

requirements-completed: [PROV-11]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "From Settings, test teaching runs one node and one graded quiz on the chosen model and reports pass or fail before the learner invests a session (PROV-11)"
    requirement: PROV-11
    verification:
      - kind: integration
        ref: "server/test/api.test.ts#answers the no-tools sentence for a model that calls nothing, and leaves the database exactly as it found it"
        status: pass
      - kind: integration
        ref: "server/test/api.test.ts#answers the ungradable sentence when the quiz call does not satisfy the tool’s own schema"
        status: pass
      - kind: integration
        ref: "server/test/api.test.ts#runs on a key row through its own driver, so the action is not a local-row feature"
        status: pass
    human_judgment: true
    rationale: "Every FAIL path is driven end to end over HTTP, and the route, the scripted turn, the card settling and the cleanup are all real. The PASS line is deliberately unreachable from any test here: the plan's own prohibition says a pass must never be produced by a stub, a driver override or Derive's plumbing, so the only thing that can emit it is a real model making a real tool call. No provider key and no local model server exist on this machine. Queued as Task 3's human-check, steps 1 and 3."
  - id: D2
    description: "The run happens in an ephemeral scratch lesson deleted in the same request, transactionally; nothing appears in Home, the Atlas or the Usage total (D-11, D-14)"
    requirement: PROV-11
    verification:
      - kind: integration
        ref: "server/test/api.test.ts#answers the no-tools sentence … (asserts listLessons, listUsage and the scratch-row count are unchanged)"
        status: pass
      - kind: integration
        ref: "server/test/api.test.ts#answers the ungradable sentence … (same three counts, after a turn that ran tools)"
        status: pass
      - kind: integration
        ref: "server/test/api.test.ts#sends the model request to the pressed row’s own address … (same three counts, after a turn that reached a network)"
        status: pass
      - kind: other
        ref: "grep: recordUsage's body is unchanged in server/src/db.ts — the single usage write path carries no scratch special case"
        status: pass
    human_judgment: false
  - id: D3
    description: "A scratch lesson that survives a crash is swept at the next boot, so a crash between the turn and the delete cannot inflate the Usage total (T-04-05)"
    requirement: PROV-11
    verification:
      - kind: integration
        ref: "server/test/api.test.ts#sweeps a scratch lesson a crash left behind, and its usage rows with it"
        status: pass
      - kind: unit
        ref: "server/test/migrations.test.ts#carries a database at the previous version forward onto 8, and every lesson it already had is a real one"
        status: pass
      - kind: other
        ref: "grep: server/src/index.ts calls sweepScratchLessons in the boot sequence, ahead of the stale-turn close"
        status: pass
    human_judgment: false
  - id: D4
    description: "The probe runs on the row the learner pressed, not on whatever is active: one named per-provider seam resolves the driver and the model, runTurn takes them per turn, and pressing the action changes nothing about which provider is active (D-13)"
    requirement: PROV-11
    verification:
      - kind: integration
        ref: "server/test/api.test.ts#sends the model request to the pressed row’s own address while another row is active"
        status: pass
      - kind: integration
        ref: "server/test/api.test.ts#resolves a driver from the row it was handed and from nothing else"
        status: pass
      - kind: integration
        ref: "server/test/api.test.ts#runs on the row it was aimed at rather than on the active one, and choosing nothing"
        status: pass
      - kind: other
        ref: "grep: server/src/agent.ts exports driverFor and calls resolveTutor exactly once; server/src/capability.ts contains no setDriverOverride"
        status: pass
    human_judgment: false
  - id: D5
    description: "The action appears on every teachable provider row, including the Claude Code and Codex login rows, which reach their own drivers through Driver.runTurn (D-13, amendment A-03)"
    requirement: PROV-11
    verification:
      - kind: other
        ref: "grep: the control is gated on row.teaches in web/src/components/ProviderRow.tsx; server/test/api.test.ts#is a 404 for an id the catalogue does not carry asserts no catalogue row has teaches false"
        status: pass
    human_judgment: true
    rationale: "That the two login rows render the control follows from row.teaches, which is true for both, and the server route refuses nothing for them. What no test here can show is that the Agent SDK and Codex drivers actually complete the scripted turn on a real login — that is the point of A-03 and needs a logged-in CLI. Queued as Task 3's human-check, step 2."
  - id: D6
    description: "The three failure readouts are the approved sentences, each mapped to one observable loop outcome: no tool calls, an ungradable quiz, or nothing answering at the address (D-12)"
    requirement: PROV-11
    verification:
      - kind: integration
        ref: "server/test/api.test.ts#answers the no-tools sentence for a model that calls nothing … (asserts the sentence verbatim)"
        status: pass
      - kind: integration
        ref: "server/test/api.test.ts#answers the ungradable sentence when the quiz call does not satisfy the tool’s own schema (asserts the sentence verbatim)"
        status: pass
      - kind: integration
        ref: "server/test/api.test.ts#runs on the row it was aimed at rather than on the active one … (asserts nothing answered at 127.0.0.1:{the closed port})"
        status: pass
    human_judgment: false
  - id: D7
    description: "E3 Test teaching control (loading): the button reads testing… and one mono role=status line reads running one node and a graded quiz, pulsing in teal with a reduced-motion companion"
    requirement: PROV-11
    verification:
      - kind: other
        ref: "grep: web/src/components/ProviderRow.tsx carries the literal running line on a role=\"status\" element with animate-pulse motion-reduce:animate-none, and the button label test teaching / testing…"
        status: pass
    human_judgment: true
    rationale: "The strings, the role, the colour class and the reduced-motion companion are asserted statically and the build is clean. That the line reads correctly beside the connection-test result and the capability line at 375px, and that the teal pulse reads as in-flight rather than as an error, is a visual judgement no test here makes — and Tailwind v4's hover/motion media gating cannot be exercised headlessly on this machine. Queued with the E1 visual check 04-02 left open."
  - id: D8
    description: "E3 Test teaching result (error, overflow, long-text): a fail renders Fail · {reason} in rust on one truncated line with the full text in the title, Derive's hint on its own line beneath, and never widens the row"
    requirement: PROV-11
    verification:
      - kind: other
        ref: "grep: the readout composes fields.ts's resultLine (min-w-0 max-w-full truncate font-mono text-[10px]) with a title holding the same sentence, and the hint renders on its own line"
        status: pass
    human_judgment: true
    rationale: "The shape is the one the shipped connection-test and capability lines already use, so the truncation is the same mechanism rather than a new one. Whether a long reason from a learner's own server truncates where intended at each breakpoint is a visual check; queued with D7."

# Metrics
duration: 33 min
completed: 2026-10-22
status: complete
---

# Phase 04 Plan 03: Prove This Model Teaches Summary

**A Settings action that proves the chosen model can run the method before a session is spent on it: one scripted turn through the production loop on the row the learner pressed — not the active one — teaching one node and asking one quiz the server grades, inside a lesson marked `scratch` by migration 8 and deleted in the same request, so a pass is something only the learner's own model can produce and a fail arrives in one of three approved sentences.**

## Performance

- **Duration:** 33 min (base commit to plan close)
- **Started:** 2026-10-22T20:46:52Z
- **Completed:** 2026-10-22T21:19:36Z
- **Tasks:** 3 (one tracer, two expansion)
- **Files modified:** 12
- **Tests:** 467 → 476 (+9)

## Accomplishments

- **The seam the feature was impossible without, named once.** `runTurn` chose its driver with an unexported inline expression and read the provider from `resolveTutor(lesson.learner_id)` — the learner's *active* row — so there was no way to run a turn on the row a learner pressed. `driverFor(provider)` is that expression extracted, and `runTurn`'s options gained one field (`tutor?: Pick<TutorChoice,'provider'|'model'>`). Nothing else moved: the turn row's driver and model, the `turn_start` payload, the web surface, the context's model and D-04's session comparison all already read that single `tutor` value, which is exactly why naming the seam was the whole change. The production dispatch still reads `driverOverride() ?? driverFor(tutor.provider)` — byte-for-byte the same decision — and `resolveTutor` is still called in exactly one place in the file.

- **The routing property is proven by where the request LANDED, not by the sentence it produced.** This is the finding worth reading. The closed-port case passes without the seam, because the reachability read short-circuits on the pressed row's address before any turn runs — so asserting the sentence proves the sentence, not the routing. The case that pins it instead points the pressed row at a *recording* fake, presses it while a different row is active, and asserts that a completion path reached **that** address. With the per-turn tutor removed, the request goes to `api.anthropic.com` and that one case — and only it — fails.

- **A transport failure is read before the turn, and that is what makes the approved sentence reachable at all.** A closed port inside the owned loop is an `APICallError` the SDK marks retryable, so the loop waits out its full two-minute window and ends with *Cannot connect to API: fetch failed* — which names no address and tells a learner nothing. On a row whose address the learner supplied, `testTeaching` therefore asks that address first, with the same cheap read `test connection` makes, and `probe.ts`'s own `nothing answered at {host}:{port}` comes back unduplicated. One loopback GET, and the action stays about a second rather than two minutes.

- **The proof settles its own cards and never grades its own question.** The scripted prompt fixes the graph, the node and the question's answer; when the card opens, the probe answers it through `answerPrompt` — deferred by a microtask, because `openPrompt` emits the card's event *before* it registers the pending prompt — and `actions.ts` grades it exactly as it grades a learner's answer. The answer is chosen by the option's **text**, not its position, so a model that reorders its options still has its own key honoured. All four card kinds are settled, not just the two the script asks for: a card the script did not ask for would otherwise leave the turn waiting on a learner who does not exist.

- **Nothing the proof creates survives the request, and the crash case is findable.** Migration 8 adds `lessons.scratch`; `createLesson` takes the flag; both prepared listings exclude those rows, so Home, the Atlas and every lesson count never see one even while it is alive; and the lesson is removed in a `finally` through the existing transactional `deleteLesson`, which already clears usage before turns. That is why D-14 needs no special case anywhere else — `recordUsage` is untouched and stays the single usage write path. `sweepScratchLessons()` on the boot pass covers the one case the delete cannot: a crash *between* the turn and the delete, asserted by a case that leaves a scratch lesson and a usage row behind deliberately.

- **One trace the plan did not name, closed.** `emit` triggers the vault mirror, whose 600 ms debounce can fire *during* a probe turn; its only guard is `getLesson`, which cannot help because at that moment the lesson still exists. With an Obsidian vault configured, a proof would have written a note that outlives the lesson it mirrored. The timer now also skips a scratch lesson.

- **Every one of the five new gates was seen failing with its mechanism removed** — the per-turn tutor (the routing case, and only it), `sweepScratchLessons` (the sweep case), the listing exclusion (the sweep case's first assertion), and the two fail sentences separately, so neither is passing on the other's behalf.

- **The approved UI-SPEC records the widened placement without a rewrite.** A dated `## Amendments` section, two entries: the action is on every row whose `teaches` is true — the three local rows, the four key and gateway rows and the `claude-code` and `codex` login rows — citing D-13 for the widening past the local rows and amendment A-03 for the two login rows; and no string moved, only which rows render them. `status: approved` and every §Checker Sign-Off line are byte-identical.

## Task Commits

1. **Task 1: end-to-end "prove this model teaches"** (tracer) — `99c39d4` (feat)
2. **Task 2: the control on every teachable row, with its approved readouts** — `5e55007` (feat)
3. **Task 3: amend the locked UI-SPEC** — `523a661` (docs)

**Measured, not narrated:** `git rev-list --count 67b0965..HEAD` = 3.

## Files Created/Modified

- `server/src/migrations.ts` — migration 8, `scratch-lesson`: one `ALTER TABLE lessons ADD COLUMN scratch INTEGER NOT NULL DEFAULT 0`, with the comment naming the one case the column exists for.
- `server/src/db.ts` — `Lesson.scratch`; `createLesson`'s `scratch` option written on insert; both listings excluding scratch rows with the reason on them; `sweepScratchLessons()` returning the ids it removed, each through `deleteLesson`. `recordUsage` untouched.
- `server/src/agent.ts` — `driverFor` (a `function` declaration, with the comment recording why the ring it closes is safe) and `runTurn`'s per-turn `tutor` option.
- `server/src/capability.ts` — a fifth paragraph in the module header stating the posture (no stub, no process-global override, no cached verdict), then the `teaching proof` section: `TeachingTest`, the two Derive-authored fail sentences, `NOT_A_TOOL`, the scripted topic/node/options/prompt, `correctIndex`, `settle` and `testTeaching`.
- `server/src/index.ts` — `POST /api/settings/:provider/test-teaching` (404 unknown, 400 for a row that does not teach, otherwise always 200), the model resolved with `modelFor(spec.id, learner)` so the proof runs on what *this* learner would be taught on, and the boot sweep ahead of the stale-turn close.
- `server/src/export.ts` — the vault mirror skips a scratch lesson.
- `server/test/api.test.ts` — eight cases in a nested block inside the owned-loop in-process suite (the only place `setModelOverride` reaches the routes), with a header stating what they do *not* prove.
- `server/test/migrations.test.ts` — the forward case onto 8, and the `LATEST_VERSION` pin moved with it.
- `web/src/lib/types.ts`, `web/src/lib/api.ts` — `TeachingTest`, and exactly one new api key, `testTeaching`.
- `web/src/components/ProviderRow.tsx` — the `test teaching` action on the existing action row gated on `row.teaches`, its in-flight `role="status"` teal line and its one-line pass/fail readout with the hint beneath.
- `.planning/phases/.../04-UI-SPEC.md` — the `## Amendments` section and the one in-place CTA parenthetical.

## Decisions Made

Beyond the `key-decisions` frontmatter, three worth reading in full:

**The failure chain is ordered, and the order is the design.** Each branch has exactly one observable, and each sits where it does for a reason: *nothing answered* is read before the run, because it is the reason there were no tool calls rather than a fact about the model; the loop's own `ok: false` sentence comes next, because a turn the loop itself refused (a model the ladder refused, a window too small, a key the provider rejected) has a sentence that names the real problem better than any of the three approved ones could — this is the `{reason}` slot carrying the server's own words, exactly as the UI-SPEC says it does; then zero tool-trace events is the no-tools sentence; and anything else that produced no graded pass is the ungradable one. The last branch deliberately includes a quiz whose own key contradicts the question the script asked it to write: a quiz Derive cannot read a pass out of cannot gate anything, and that is the closest approved sentence rather than a fourth invented one.

**The outcome is read off the lesson's event log, not off the loop.** That is the one observation all three drivers make alike — the Agent SDK path, the Codex path and the owned loop all report through the same `EventSink` — so a probe that works on the login rows needs no second code path. The tool-call reading is the *complement* of a small set of non-tool event types (`turn_start`, `turn_end`, `user`, `assistant`, `status`, `delta`, `ready`) rather than a list of the tools, so a tool added later counts without an edit here. The known edge is recorded at the line: a model whose every tool call was *refused* by the server emits no event and reads as "called no tools", which is a slightly wrong sentence about a lesson that was in fact ungradable either way.

**`set_plan`'s own schema decided the script's shape.** The plan says "one node"; the registry requires `nodes` to be at least three with exactly one goal sink. A one-node plan would have failed validation on every provider, making the proof always fail. So the scripted graph is three nodes and the teaching, the `node_status` and the quiz are one of them — which is what the pass line claims and all PROV-11 claims.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] A proof could leave a note in the learner's Obsidian vault**

- **Found during:** Task 1
- **Issue:** `emit` calls `mirrorToVault` for every event, whose 600 ms debounced timer guards only against an already-deleted lesson. During a probe turn the lesson still exists, so with `DERIVE_VAULT_DIR` set the timer would write a note for a lesson that is deleted moments later — a trace that outlives the request, which is exactly what D-11 forbids.
- **Fix:** the timer now returns for a scratch lesson as well as a missing one, with the reason at the line. `server/src/export.ts` is not in the plan's `files_modified`; this is one line in the place the write happens.
- **Files modified:** `server/src/export.ts`
- **Verification:** `pnpm test` (476 pass); the guard is the same `getLesson` read the timer already did.
- **Committed in:** `99c39d4`

**2. [Rule 3 - Blocking] A closed port would have taken two minutes and named no address**

- **Found during:** Task 1
- **Issue:** The plan maps a transport failure to `probe.ts`'s `nothing answered at {host}:{port}` and the routing case asserts that address. But a connection failure inside the owned loop is an `APICallError` with `isRetryable: true`, so `withRetries` waits out `RETRY_WINDOW_MS` (two minutes) and then ends the turn with `providerSentence(0, 'Cannot connect to API: fetch failed')`. That sentence contains no host and no port, the approved one was unreachable, and the HTTP case would have taken two minutes to fail.
- **Fix:** on a row whose address the learner supplied (`group === 'local'` or `auth === 'key+url'`), `testTeaching` runs `testConnection(spec.id)` first and returns its sentence and hint when nothing answers. It is the same single cheap read the shipped `test connection` action makes, no model request is spent, and the approved sentence stays written once in `probe.ts` rather than copied into `capability.ts`.
- **Files modified:** `server/src/capability.ts`
- **Verification:** `api.test.ts#runs on the row it was aimed at …` asserts `nothing answered at 127.0.0.1:{the closed port}` and returns in milliseconds.
- **Committed in:** `99c39d4`

**3. [Rule 1 - Bug] The plan's routing assertion could pass with the seam removed**

- **Found during:** Task 1's red-gate check
- **Issue:** With deviation 2 in place, the plan's own HTTP routing criterion (the reason names the pressed row's address) is satisfied by the pre-flight alone — I removed the per-turn `tutor` option and the case still passed. An assertion that cannot see the mechanism it exists for is not a gate.
- **Fix:** a second case that observes the seam positively: the pressed row points at a *recording* fake, no override of any kind is installed, and the case asserts a non-metadata path was asked for at **that** address while another row was active. Re-run with the seam removed: that case fails and only it.
- **Files modified:** `server/test/api.test.ts`
- **Verification:** seen failing (`not ok 6 - sends the model request to the pressed row’s own address …`) with `opts.tutor` removed from the `runTurn` call; passing with it.
- **Committed in:** `99c39d4`

**4. [Rule 3 - Blocking] The scripted plan would have failed every provider's schema**

- **Found during:** Task 1
- **Issue:** The plan's script asks for one node. `set_plan`'s registry shape is `z.array(nodeSchema).min(3)`, so a one-node plan is refused by `validateToolInput` before it reaches `actions.ts` — the proof would have failed on every model, for Derive's own reason.
- **Fix:** the scripted graph is three nodes (a truth, a derived step and the goal) and the teaching, the `node_status` and the quiz are one of them. The comment on the prompt records that the registry's own minimum is what fixed the number.
- **Files modified:** `server/src/capability.ts`
- **Verification:** `api.test.ts#answers the ungradable sentence …` drives `set_plan` with the suite's own three-node fixture and the plan card is approved by the probe.
- **Committed in:** `99c39d4`

**5. [Rule 3 - Blocking] A criterion no catalogue row can satisfy**

- **Found during:** Task 1's acceptance-criteria gate
- **Issue:** The criterion asks that "a POST to a row whose `teaches` is false answers 400 naming the row". No such row exists: plan 04-01 removed the last of them and the `unwired` helper with it. The same collision cost plan 04-02 two tests.
- **Fix:** the route's `teaches` guard is kept (it is the defence for a future row that arrives before its driver, which is what the activation route keeps its own for) and the case asserts what *is* true and load-bearing: the 404 for an unknown id, plus that no catalogue row carries `teaches: false` — the assertion that will fail, visibly, if such a row is ever added without a case for it.
- **Files modified:** `server/test/api.test.ts`
- **Verification:** `api.test.ts#is a 404 for an id the catalogue does not carry` passes; the 400 branch is unreachable from the catalogue by construction.
- **Committed in:** `99c39d4`

---

**Total deviations:** 5 auto-fixed (1 bug, 1 missing critical, 3 blocking)
**Impact on plan:** No scope creep. Two are the plan's own text colliding with the shipped code's own schemas and retry posture (the one-node plan, the two-minute backoff), one is the plan's criterion colliding with 04-01's result (no row has `teaches: false`), one is a gap the plan did not name (the vault note), and one is a weakness in the plan's own routing assertion that the red-gate check exposed. No mechanism was deleted to make a test pass and no assertion was softened: the opposite — the routing property gained a case it did not have.

## Issues Encountered

**The in-process server can only be started once per test file, so the new cases live inside the existing owned-loop block.** `startInProcessServer` captures `http.createServer` while importing `src/index.js`; a second call finds the module cached, nothing calls `createServer`, and it throws. The new cases need `setModelOverride`, which by design is reachable from nowhere but the process that runs the loop — so they are a nested `describe` at the end of that block, reusing its server, token and model-scripting helpers, and they restore both overrides in their own `after`. The plan named `api.test.ts` for them and its verify chain runs that file, so a new suite file was not an option either.

**The pass line is not reachable from any automated test, by design rather than by omission.** The plan's own prohibition says a pass must never come from a stub, a driver override, a cached verdict or a repaired tool call — which leaves a real model as the only thing that can produce one. This machine has no provider key and no local model server, so what is automated here is every fail path, the routing, the cleanup and the sweep; the pass is Task 3's human-check, steps 1-3. The suite's header says this out loud, so the file is not read as coverage it does not have.

**The 04-02 `num_ctx`-sentence finding is still open and was deliberately not touched.** `.planning/WINDOWS.md`'s `unmet-truth` entry for the LM Studio / llama.cpp refusal wording needs an owner decision on the Copywriting Contract; the pinned assertion in `local.test.ts` is untouched.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `driverFor` and `runTurn`'s per-turn provider-and-model option are the seam plan 04-04's conformance harness needs to run the same scripted turn across several rows without making any of them active.
- The `scratch` marker, `sweepScratchLessons` and the vault-mirror guard are the pattern any later ephemeral lesson should reuse rather than reinvent; `recordUsage` remains the single usage write path, so 04-05's Usage page inherits D-14 for free.
- Open for the phase verifier: the real-server UAT in Task 3's human-check (the pass line on a configured row, the two login rows while another row is active, a weak local model's fail, Home/Atlas/Usage untouched afterwards, and the stopped-server sentence), plus the E1/E3 visual checks carried over from 04-02.

## Self-Check: PASSED

- Every file in `key-files.modified` exists on disk (`[ -f ]`, 12 of 12), and so does this summary.
- All three task commits are reachable: `99c39d4`, `5e55007`, `523a661`.
- `commits` is measured, not narrated: `git rev-list --count 67b0965..HEAD` = 3, matching the frontmatter.
- Re-ran every task's acceptance criteria and the plan-level `<verification>`: `pnpm method:check` (6 rendered copies match), `pnpm typecheck` (server + web), `pnpm build`, `pnpm test` (476 pass, 0 fail), `test/wire-surface.test.ts` (17 pass, `wire-surface.json` unchanged), and each structural grep — `driverFor` exported, `resolveTutor` called once in `agent.ts`, no `setDriverOverride` in `capability.ts`, `version: 8` present, `sweepScratchLessons` defined and called, no `ALTER TABLE` in `db.ts`, the UI-SPEC's amendments heading, login rows, `status: approved` and sign-off lines intact.
- No stubs, TODOs or skipped tests introduced; no new entry owed to `.planning/WINDOWS.md`.

---
*Phase: 04-local-models-parity-proof-and-usage*
*Completed: 2026-10-22*
