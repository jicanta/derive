---
phase: 03-owned-loop-api-keys-and-gateways
plan: 05
subsystem: api
tags: [ai-sdk, retry, backoff, retry-after, rate-limit, context-window, ephemeral-status, node-test]

# Dependency graph
requires:
  - phase: 03-owned-loop-api-keys-and-gateways
    provides: "plan 03-01's owned loop (server/src/drivers/api.ts): the streamText call, the fullStream consumption, the per-turn abort controller and the STEP_CAP it ends on"
  - phase: 03-owned-loop-api-keys-and-gateways
    provides: "plan 03-02's pure context module: headroomCheck, CHARS_PER_TOKEN, HEADROOM_FRACTION, the verbatim refusal sentence and the abstain-on-unknown-window rule, plus the window column in the price table"
  - phase: 03-owned-loop-api-keys-and-gateways
    provides: "plan 03-04's loaded history (loadTurnMessages), patchOrphans, the continuable step-cap ending and the stub-model suite the new cases are built on"
  - phase: 02-settings-and-secrets
    provides: "probe.ts's providerSentence and hintFor — the provider's own words plus Derive's separate fix hint, already the pair the settings page shows"
  - phase: 01-foundation
    provides: "the idempotent sinkFor endTurn guard, emitEphemeral's fan-out-without-persisting contract, and safeMessage's redaction on every string that reaches the learner"
provides:
  - "withRetries: Derive's own backoff around the whole streamText attempt, patient to two minutes of waiting, with RETRY_WINDOW_MS, RETRY_BASE_MS, retryAfterMs and retryDelay exported beside it"
  - "A visible wait: `Provider busy, retrying in Ns` counted down by whole seconds and `Provider busy, retrying now` while an attempt is in flight, both on the existing ephemeral `status` event, neither persisted"
  - "A provider's Retry-After honoured as given and uncapped (retry-after-ms before retry-after, seconds or an HTTP date), with jittered exponential backoff when it sends none, every delay clamped against the window"
  - "An exhausted retry ends through the existing error path in the provider's own sentence with Derive's fix hint on its own line — providerSentence plus hintFor, never a second error vocabulary"
  - "A non-retryable failure (401, 402) fails on the first attempt, never behind a `Provider busy` line"
  - "The pre-request context refusal: headroomCheck runs after the history load and before streamText, and a refusal ends the turn failed with no request made and nothing compacted"
  - "Three endings, three shapes, written down and asserted side by side: a Stop and the step cap are continuable ({ ok: true, interrupted: true }), the refusal is failed ({ ok: false, error })"
  - "withHomeLink: the existing rust error item renders one optional link, so the refusal's `Home` is a Link to / and there is no button"
  - "STEP_CAP exported, and setSleepOverride as the suite's only seam into the wait"
  - "A stream `error` part now ends the turn as a failure rather than silently as a success"
affects: [03-06 the search tool's provider failures ride this retry controller and this error card, 03-07 the dialect projection sits inside the one attempt withRetries re-runs, 03-08 the cost string sits beside the same status line in the lesson header, 04 the parity harness and the local-model window sizing that turns the abstain into a check, 04 the conformance proof that every provider's rate limit reads the same]

actuals:
  tokens: unknown  # the interrupted executor recorded none; a fabricated figure would corrupt every later projection
  tasks: 3
  commits: 4
  plan_head_before: 0c92a93f

tech-stack:
  added: []
  patterns:
    - "A wait the learner can see is Derive's own: the SDK's retry is turned off (maxRetries: 0) because it cannot show a countdown, cannot honour a Retry-After longer than a minute and cannot be stopped mid-wait"
    - "A retry window is summed from the delays the loop chose, not read off the wall clock: a provider's own latency is slowness, not busyness, and must not be charged against the learner's patience"
    - "A countdown ticks once per whole second of the delay rather than polling the clock, so the number the learner reads and the time actually waited are the same number"
    - "A vendor-supplied header is honoured as given but clamped by Derive's own bound, and a header of zero falls through to the backoff rather than becoming a tight loop"
    - "A failure that cannot be continued is refused before the request rather than recognised after it: one Derive sentence instead of five provider error shapes"
    - "A third use of one existing ephemeral event rather than a fourth event type: Thinking, the tool label and the countdown are all `status` at seq -1"
    - "An error card renders one optional link by splitting its own text once on the literal word, so a sentence that names a next step can reach it without a new component or a new payload field"
    - "A test seam for time is a module-level override in the same posture as setModelOverride: no route, header, environment variable or config file reaches it, and the production path still sleeps for real"

key-files:
  created: []
  modified:
    - server/src/drivers/api.ts
    - web/src/pages/Lesson.tsx
    - server/test/api-driver.test.ts

key-decisions:
  - "The retry window bounds the waiting, not the wall clock: `waited` sums the delays the loop chose, so a provider that takes thirty seconds per attempt is treated as slow rather than busy and does not cut the retries short"
  - "A Retry-After of zero falls through to the backoff — 'retry immediately' from a provider that just said it was busy is how a rate limit becomes a tight loop"
  - "withRetries takes a `gate: { label, signal }` rather than reading them off TurnContext, which is why server/src/driver.ts needed no change at all"
  - "The stream's `error` part is thrown so the controller around the attempt sees it, which also fixed a turn that used to end `ok: true` having taught nothing"
  - "The SDK's default onError (console.error) is replaced with a no-op, because an ordinary rate limit would otherwise dump a stack trace per tick into the learner's terminal"
  - "setSleepOverride is the only seam into the wait: the exhaustion branch can only be asserted by reaching it, and reaching it on the real clock would mean a two-minute test"
  - "The refusal is failed, never interrupted: a lesson that no longer fits its window genuinely cannot continue, which is what separates it from a Stop and from the step cap"
  - "No button beside the refusal, and the reason is in the code: api.startReview() builds from the due queue across every lesson, so a button labelled 'start a review lesson on these nodes' would review whatever happens to be due"

patterns-established:
  - "Every new string a learner can read is asserted word for word, not matched loosely: the countdown's three ticks are compared as a list and the refusal is compared byte for byte against the UI-SPEC copy"
  - "A negative is asserted as explicitly as a positive: no status line names an attempt, no `Provider busy` text survives in listEvents, and a 401 makes exactly one request"
  - "A follow-up `fix` commit inside the same plan is kept as its own commit with its own reasoning, rather than amended into the feature it corrects"

requirements-completed: [PROV-08, PROV-01, PROV-02, PROV-03, PROV-04, PROV-05]

coverage:
  - id: D1
    description: "A rate-limited provider shows an ephemeral status line counting down by whole seconds, says so while the next attempt is in flight, and leaves nothing about the stall in the lesson's durable record"
    requirement: PROV-08
    verification:
      - kind: integration
        ref: "server/test/api-driver.test.ts#counts the backoff down in whole seconds, says so while the attempt is in flight, and persists none of it"
        status: pass
      - kind: other
        ref: "grep -cE \"emitEphemeral\\('status'\" server/src/drivers/api.ts → 5 (Thinking, the tool label, the unsupported-feature notice, and the two countdown lines); no emit or checkpoint carries a status payload"
        status: pass
    human_judgment: false
  - id: D2
    description: "Retries are patient to two minutes of waiting: the provider's Retry-After is honoured as given and uncapped, jittered exponential backoff runs when it sends none, every delay is clamped against the window, and the SDK's own retry never runs"
    requirement: PROV-08
    verification:
      - kind: unit
        ref: "server/test/api-driver.test.ts#reads retry-after-ms before retry-after, takes seconds or an HTTP date, and caps neither"
        status: pass
      - kind: unit
        ref: "server/test/api-driver.test.ts#honours a header delay, jitters its own, grows it, and never lets the cumulative wait pass the window"
        status: pass
      - kind: other
        ref: "sed -E 's;//.*$;;' server/src/drivers/api.ts | grep -cE 'streamRetries|maxRetries: [1-9]' → 0, with maxRetries: 0 on the streamText call"
        status: pass
    human_judgment: false
  - id: D3
    description: "Stop works throughout a backoff: the lesson is still busy so the Composer still renders Stop, and pressing it ends the turn as interrupted rather than waiting out the countdown"
    requirement: PROV-08
    verification:
      - kind: integration
        ref: "server/test/api-driver.test.ts#ends the wait the moment the learner presses Stop, rather than at the end of the countdown"
        status: pass
    human_judgment: false
  - id: D4
    description: "When the window runs out the ephemeral line vanishes and the existing turn_end error path carries the provider's own sentence with Derive's fix hint on its own line — never a Derive paraphrase of the provider's words"
    requirement: PROV-08
    verification:
      - kind: integration
        ref: "server/test/api-driver.test.ts#ends an exhausted retry in the provider's own sentence, with derive's hint on its own line"
        status: pass
      - kind: other
        ref: "web/src/lib/useLesson.ts turn_end case sets status: null, so the countdown line clears with the turn (file byte-identical to its committed state)"
        status: pass
    human_judgment: false
  - id: D5
    description: "A non-retryable failure is not retried: a refused key fails on the first attempt with no `Provider busy` line and no two minutes spent pretending it was a rate limit"
    requirement: PROV-08
    verification:
      - kind: integration
        ref: "server/test/api-driver.test.ts#fails a refused key immediately, without pretending it was a rate limit"
        status: pass
    human_judgment: false
  - id: D6
    description: "A lesson whose prompt would outgrow the model's known window is refused before the request in Derive's own sentence, as the existing turn_end with ok: false, with no request made and nothing compacted; a model the table has no window for is not refused; a learner who retries gets one card per attempt"
    requirement: PROV-08
    verification:
      - kind: integration
        ref: "server/test/api-driver.test.ts#makes no request at all, and ends the turn failed with derive’s own sentence"
        status: pass
      - kind: integration
        ref: "server/test/api-driver.test.ts#does not refuse a model the table has no window for"
        status: pass
      - kind: integration
        ref: "server/test/api-driver.test.ts#gives a learner who retries one card per attempt, with no deduplication and no counter"
        status: pass
      - kind: other
        ref: "sed -E 's;//.*$;;' server/src/drivers/api.ts | grep -cE 'pruneMessages' → 0, so the understanding gate cannot rest on a summary the model wrote about itself"
        status: pass
    human_judgment: false
  - id: D7
    description: "The three endings keep three shapes: a Stop and the step cap are continuable, the refusal is failed, and the distinction is recorded in a comment beside the refusal"
    requirement: PROV-08
    verification:
      - kind: integration
        ref: "server/test/api-driver.test.ts#keeps a stop and the step cap continuable while the refusal is failed"
        status: pass
    human_judgment: false
  - id: D8
    description: "The refusal's `Home` is the card's one link inside the existing rust error box: no new component, no new event type, no new card family, and no button"
    requirement: PROV-08
    verification:
      - kind: other
        ref: "grep -c 'to=\"/\"' web/src/pages/Lesson.tsx → 3; the box classes `rounded-xl border border-rust-400/40 bg-rust-400/5 px-4 py-3 text-sm text-rust-400` unchanged; `--color-rust-400` declared in web/src/index.css @theme; web/src/components/*.tsx still 13 files"
        status: pass
      - kind: integration
        ref: "server/test/api-driver.test.ts#ends an exhausted retry in the provider's own sentence… (asserts the error string carries no `Home`, so every other error renders as plain text)"
        status: pass
      - kind: other
        ref: "pnpm --filter web build (tsc -b with noUnusedLocals/noUnusedParameters) exits 0"
        status: pass
    human_judgment: true
    rationale: "This repo has no web test runner (03-PATTERNS). That the link is reachable, that the sentence wraps inside the rust box at 375px and 1280px, and that there is visibly no button are browser observations rather than Node assertions."
  - id: D9
    description: "The event vocabulary did not grow: no new EVENT_TYPES entry, no new applyEvent branch, and every event any of these paths produced is one the web app already knows"
    requirement: PROV-08
    verification:
      - kind: other
        ref: "git diff --quiet 0c92a93..HEAD -- web/src/lib/useLesson.ts → clean"
        status: pass
      - kind: integration
        ref: "server/test/api-driver.test.ts — the EVENT_TYPES guard, now also walking the countdown, the exhaustion and the refusal runs"
        status: pass
    human_judgment: false
  - id: D10
    description: "A free-tier Gemini or OpenRouter rate limit is survived within the retry window on a real key, with the countdown visible and Stop responsive throughout, and a wrong key failing immediately in the provider's own words"
    requirement: PROV-08
    verification: []
    human_judgment: true
    rationale: "No Anthropic, OpenAI, Gemini or OpenRouter key and no OpenAI-compatible endpoint exist in this environment (03-RESEARCH.md §Environment Availability). The whole mechanism is proven against a stub model that throws a real APICallError with real headers, but a genuine provider rate limit — and that the countdown is absent from the Obsidian note and from a page reload — needs a learner's own key. Recorded as a WINDOWS.md unrun-verify entry and carried into the phase UAT."

# Metrics
duration: 9 min
completed: 2026-10-06
status: complete
---

# Phase 03 Plan 05: The Visible Wait and the Refusal Summary

**A busy provider is now waited out in front of the learner — `Provider busy, retrying in 3s`, counted down by whole seconds on the same ephemeral event `Thinking` rides, Stop honoured mid-wait, and the provider's own sentence with Derive's hint beside it when the two minutes run out — and a lesson that outgrew its model's window is refused before the request in Derive's words, with `Home` as the card's one link.**

## Performance

- **Duration:** 9 min across the four commits (20:44:33 → 20:53:54, 2026-10-06). The run was interrupted after the last task's commit and before this file, so no start timestamp was recorded; the commit span is the honest figure and is reported as such rather than padded into an invented total.
- **Started:** unrecorded
- **Completed:** 2026-10-06T20:53:54-03:00
- **Tasks:** 3
- **Files modified:** 3 (0 created, 3 modified)

## Accomplishments

- **The wait is Derive's own, and visible.** `withRetries` wraps the whole `streamText` attempt rather than a step, and the SDK's retry is off (`maxRetries: 0`) for three reasons written into the function's doc comment: it cannot show a countdown, it caps a `Retry-After` at sixty seconds, and it cannot be stopped mid-wait. What the learner sees is one ephemeral `status` line — `Provider busy, retrying in Ns` ticking down by whole seconds, then `Provider busy, retrying now` while the next attempt is in flight. No attempt counter: `attempt 3 of 6` is machinery the learner cannot act on, and the suite asserts no status text anywhere in a run contains the word `attempt`.
- **Patient, but bounded, and on the learner's terms.** `retryAfterMs` reads `retry-after-ms` before `retry-after`, takes a seconds count or an HTTP date, and honours ninety seconds as ninety seconds — the uncapped value is asserted twice, once for equality and once against the 60 s the SDK would have imposed. With no header, `retryDelay` is exponential from `RETRY_BASE_MS` with jitter over the same interval, so two lessons that hit one provider's limit together do not retry in lockstep and re-trip it. Every delay is clamped against what is left of `RETRY_WINDOW_MS`, and a spent window returns zero, which is the signal to stop.
- **Stop is honoured inside a wait, not after it.** `ctx.isStopping()` is checked before every attempt and on every countdown tick, and `waitOrStop` races the sleep against the turn's abort signal, so a Stop during a backoff is instant rather than up to a second late. The lesson is busy for the whole backoff by construction — the turn started and has not ended — so the Composer keeps rendering Stop with no change to how `busy` is computed. The case drives ten ticks of backoff, presses Stop inside the first one, and asserts the countdown was cut short, exactly one attempt was made and the turn ended `{ ok: true, interrupted: true }`.
- **An exhausted retry speaks in the provider's voice.** The window running out ends the turn through the existing error path with `providerSentence(status, body)` and `hintFor(label, status, sentence)` — the same pair the settings page already shows — joined by a newline. The case asserts the error starts with `429 rate limit exceeded for requests per minute` and that the second line is exactly `Rate limited; wait a moment and test again.`, so nothing of the provider's text is rewritten and nothing of Derive's is attributed to the provider. Everything still passes through `safeMessage` on the way out.
- **A refused key fails at once.** Retry is gated on `isRetryable === true`, or on 429/5xx where the SDK offers no judgement. A 401 makes exactly one request, shows no `Provider busy` line, and ends failed — asserted, because a wrong key spending two minutes behind a "busy provider" line is the wallet-and-patience failure T-03-30 names.
- **An overlong lesson is refused before the request, not after it.** `headroomCheck` runs immediately after the history load, over the instructions, the serialised history and the prompt, against the merged price table's window column. On a refusal the turn ends `{ ok: false, error }` with Derive's verbatim sentence and `doStreamCalls.length === 0` — the request was never made and nothing was paid for. Nothing is compacted, pruned or summarised, and the file contains no reference to `pruneMessages`, because the understanding gate would then rest on a summary the model wrote about itself. A model the table has no window for still abstains, which the sibling case pins on `openai-compatible` with a 2.5-million-character history.
- **Three endings keep three shapes.** A Stop and the step cap are continuable (`{ ok: true, interrupted: true }`: the lesson stays resumable); the refusal is failed. The distinction is written in a comment beside the refusal so a later reader does not fold the three into one, and a single case asserts all three payloads and all three `turns.status` values side by side, with a sentence saying why the distinction matters.
- **The card gained a link, not a component.** `withHomeLink` splits the error item's own text once on the literal `Home` and renders text, `<Link to="/">`, text. The box's classes are byte-for-byte what they were, `web/src/lib/useLesson.ts` is untouched, `web/src/components/` still holds thirteen `.tsx` files, and every other error string reaching the card carries no `Home` — asserted in the exhaustion case rather than assumed, so those render exactly as they did before.

## Task Commits

1. **Task 1: The retry controller, its visible countdown, and the exhausted-retry sentence** — `6b141bf` (feat)
2. **Task 2: The context-window refusal, before the request, with a next step the learner can take** — `1d37e62` (feat)
   - **Follow-up inside Task 2:** `a034555` (fix) — the window is bounded by the waiting the loop chose rather than by the wall clock
3. **Task 3: The suite covers the countdown, the exhaustion sentence, the refusal and the three endings** — `a8910ef` (test)

**Plan metadata:** the `docs(03-05): …` commit carrying this file, STATE.md, ROADMAP.md and WINDOWS.md.

`git rev-list --count 0c92a93f..HEAD` measures **4** commits for this plan's production work, plus that metadata commit.

## Files Created/Modified

- `server/src/drivers/api.ts` (513 → 734 lines) — `RETRY_WINDOW_MS`, `RETRY_BASE_MS`, `setSleepOverride`, `retryAfterMs`, `retryDelay`, `retryable`, `waitOrStop`, `withRetries`; `STEP_CAP` exported; the `headroomCheck` call and the refusal with its three-way-ending comment; the one-attempt closure with its settle-before-escape wrapper; the `error` stream part thrown; `onError` silenced
- `web/src/pages/Lesson.tsx` (402 → 433 lines) — `withHomeLink`, called from the existing `case 'error'` item, with the recorded reason there is no button
- `server/test/api-driver.test.ts` (761 → 1115 lines) — ten new cases in four describes, plus `apiError`, `statuses` and `failsThen`; the suite now runs 352 tests in under thirteen seconds

## Decisions Made

- **The window bounds the waiting, not the wall clock.** `withRetries` sums the delays it chose into `waited` rather than measuring `Date.now() - started`. A provider that takes thirty seconds to answer each attempt is slow, not busy, and charging its own latency against the learner's patience would cut the retries short for the wrong reason. Everything that is not waiting is already bounded by the step cap and by Stop, so the safety property T-03-29 asks for — that no header can hold a turn open indefinitely — still holds on the only quantity a hostile header controls.
- **A `Retry-After` of zero falls through to the backoff.** `retryAfterMs` returns the value a provider sent, including zero, and `retryDelay` only honours a positive one. "Retry immediately" from an endpoint that has just said it is busy is precisely how a rate limit becomes a tight loop hammering the same endpoint.
- **The countdown ticks by the delay, not by the clock.** The loop decrements `left` by 1000 per tick instead of recomputing from a deadline, so the number the learner reads and the time actually waited are the same number however long a tick takes to come back. The test can therefore assert the exact list `['… in 3s', '… in 2s', '… in 1s']` for a three-second `Retry-After`, which a clock-polling loop could never promise.
- **`withRetries` takes a `gate`, not a wider `TurnContext`.** The two things the wait needs and `TurnContext` does not carry — the provider's label for the fix hint, and the turn's abort signal for racing the sleep — are passed as `{ label, signal }` from `runTurn`, which already owns the controller. This is why `server/src/driver.ts` needed no change (see deviation 4).
- **`setSleepOverride` is the one seam into the wait.** The exhaustion branch can only be asserted honestly by reaching it, and reaching it on the real clock means a two-minute test. The override sits in the same documented posture as `setModelOverride` and `setStepCapOverride`: no route, header, environment variable or config file reaches it, and the file contains no environment read at all.
- **The attempt settles before an error escapes.** The closure `withRetries` re-runs flushes the half-written block, patches orphaned tool calls and persists before rethrowing, so the next attempt sends a history a provider will accept. All three are idempotent, which is what makes running them again in the `catch` and the `finally` safe.
- **No button beside the refusal, and the reason lives next to the link.** `api.startReview()` builds a review lesson from the due queue across every lesson rather than from this lesson's nodes, so a button labelled "start a review lesson on these nodes" would review whatever happens to be due — possibly not one node of the lesson that just refused. Naming the step and letting the learner walk to Home is the only version that is literally true today, and the comment says so where a future reader would otherwise "fix" it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A stream `error` part ended the turn `ok: true`, having taught nothing**

- **Found during:** Task 1
- **Issue:** The AI SDK delivers a request failure as an `error` part on `fullStream` and then closes the stream normally. The `switch (part.type)` as plan 03-01 left it had no `error` case, so the failure fell through to `default: break`, the loop exited the `for await` cleanly and the turn ended `{ ok: true, verified }`. A 429 or a 500 therefore looked to the learner like a turn that simply said nothing — and the retry controller this plan adds would never have seen a single retryable failure.
- **Fix:** `case 'error': throw part.error;` with a comment naming both halves of the reason: the SDK's delivery shape, and the fact that the throw is what puts the failure in front of the controller wrapped around the attempt.
- **Files modified:** `server/src/drivers/api.ts`
- **Verification:** every retry case in the suite rests on it — the countdown case asserts two `doStream` calls, the exhaustion case asserts `ok: false`, and the 401 case asserts exactly one call
- **Committed in:** `6b141bf`

**2. [Rule 1 - Bug] The retry window measured the wall clock, so a slow provider ate the learner's patience**

- **Found during:** Task 2, reviewing Task 1's controller before building on it
- **Issue:** Three faults in one branch. `retryDelay(attempt, afterMs, Date.now() - started)` charged the provider's own response time against the window, so a provider taking thirty seconds per attempt would exhaust two minutes in four attempts it never actually waited for. `afterMs ?? …` honoured a `Retry-After: 0` literally, turning a busy provider into a tight loop. And the countdown recomputed `left` from a deadline, so a slow tick could skip a number and leave the line the learner read disagreeing with the time waited.
- **Fix:** `waited` accumulates the delays the loop chose; `afterMs !== null && afterMs > 0` falls a zero through to the jittered backoff; the countdown decrements by whole seconds. Each has a comment giving the reason rather than the mechanism.
- **Files modified:** `server/src/drivers/api.ts`
- **Verification:** `#honours a header delay, jitters its own, grows it, and never lets the cumulative wait pass the window` asserts the clamp from both sides and that a spent window asks for no more waiting; `#counts the backoff down in whole seconds…` asserts the exact three-tick list, which only holds under the decrementing loop
- **Committed in:** `a034555` — kept as its own commit with its own reasoning rather than amended into `6b141bf`

**3. [Rule 2 - Missing Critical] The SDK's default `onError` would dump a stack trace per retry tick**

- **Found during:** Task 3, watching the suite's output
- **Issue:** `streamText`'s default `onError` is `console.error(error)`. With the `error` part now a real failure path, an ordinary rate limit printed a full `APICallError` stack into the learner's terminal on every attempt — against this repo's logging convention (a tagged line for a startup fact or a failure, never per request) and useless noise beside the countdown that already explains the wait.
- **Fix:** `onError: () => undefined`, with a comment saying the failure already reaches the learner through the `error` part and that the loop is the one place it is reported.
- **Files modified:** `server/src/drivers/api.ts`
- **Verification:** `pnpm test` output carries no `APICallError` stack from the retry cases; the exhaustion case still asserts the provider's sentence reaches the learner
- **Committed in:** `a8910ef`

### Plan drift recorded rather than fixed

**4. `server/src/drivers/api.ts`'s `files_modified` listed `server/src/driver.ts`, and no commit touched it — correctly.**

The plan's `files_modified` and its `artifacts_this_phase_produces` table both name `server/src/driver.ts`, the latter for `TurnContext.turnId`. That member already exists: plan 03-04 added it (commit `2052d0c`, listed in `03-04-SUMMARY.md`'s `key-files.modified`), and `git log -- server/src/driver.ts` shows no commit on the file since. The listing is a stale carry-over from the sibling plan this one was written beside, not a missing piece of work.

Nothing in this plan needed the file. The countdown rides `EventSink.emitEphemeral`, which `driver.ts` has exposed since Phase 1 with the doc comment the plan quotes ("Fan out without persisting, for status lines and high-frequency text deltas") — a third caller needs no change to the interface. The Stop checks use `TurnContext.isStopping`, also pre-existing. The one genuinely new need was the turn's abort signal inside the wait, and that was met by passing `{ label, signal }` from `runTurn`, which already owns the controller, rather than by widening `TurnContext` for one consumer. `server/src/driver.ts` is byte-identical to its state at `0c92a93`, and the plan's own Task 1 `read_first` treats it as read-only.

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 missing critical) plus 1 plan-drift note
**Impact on plan:** No scope change to the plan's objective, and no file outside its `files_modified`. Two of the three auto-fixes are faults in this plan's own first commit, found before the plan closed and fixed in the open; the third is a log-hygiene consequence of making the `error` part a real failure path. The drift note is the inverse of a deviation: a file the plan listed and the work correctly did not need.

## Known Stubs

None. No value a learner is shown in this plan comes from a placeholder, and the diff adds no `TODO`, `FIXME`, skipped test or hardcoded empty that reaches the UI. Every string in the retry and refusal vocabulary is a fixed literal from the UI-SPEC's Copywriting Contract plus one integer.

`setSleepOverride` is a test seam rather than a stub, in the same documented family as `setModelOverride`, `setStepCapOverride` and `setDriverOverride`: reachable from no route, header, environment variable or config file, with the production path sleeping for real through `realSleep`.

## Threat Flags

None. Every surface this plan adds is already in its `<threat_model>` as T-03-29 through T-03-35, and each mitigation is in place and asserted:

- **T-03-29** (a vendor `Retry-After` of hours): `retryDelay` clamps every delay against what is left of `RETRY_WINDOW_MS`, asserted at four spent values plus an unbounded exponent; `isStopping` is checked on every tick and the sleep races the abort signal. Recorded refinement: the bound is on the *waiting*, which is the only quantity the header controls — a slow provider's own latency is bounded by the step cap and by Stop instead.
- **T-03-30** (retrying a non-retryable failure): gated on `isRetryable === true` or 429/5xx; the 401 case pins `doStreamCalls.length === 1`.
- **T-03-31** (an unbounded prompt reaching the provider): `headroomCheck` runs before the request at 80% of the known window with an over-counting estimate; the refusal case pins `doStreamCalls.length === 0`.
- **T-03-32** (the provider's error body rendered to the learner): `providerSentence` collapses and cuts at 300 characters, `safeMessage` wraps the string that reaches `endTurn`, and the hint is Derive's own on its own line.
- **T-03-33** (the countdown entering the durable record): `emitEphemeral` only, with the case asserting no `status` type and no `Provider busy` substring anywhere in `listEvents`, and `useLesson.ts` byte-identical.
- **T-03-34** (a prompt exceeding an unlisted model's window): accepted as planned; the abstain is covered by its own case.
- **T-03-35** (a failed turn mistaken for an interrupted one): three shapes asserted side by side, including the `turns.status` each writes.

## Issues Encountered

- **The plan's `<human-check>` could not be run.** No Anthropic, OpenAI, Gemini or OpenRouter key and no OpenAI-compatible endpoint exist in this environment (`03-RESEARCH.md` §Environment Availability), so a real free-tier rate limit, the countdown's absence from an Obsidian note, and the refusal card read at 375px and 1280px are all unobservable here. The mechanism is driven instead by a stub that throws a genuine `APICallError` with real `responseHeaders`, `responseBody` and `isRetryable`. Recorded as an open `unrun-verify` entry in `.planning/WINDOWS.md` and carried into the phase UAT as coverage D8 and D10.
- **This plan's run was interrupted between its last commit and this file.** The four production commits had all landed and the tree was green; the close-out was reconstructed from the commits and the code at `a8910ef` rather than re-executed, and no commit was amended, reverted or rewritten. `tokens` in `actuals` is reported as `unknown` for the same reason: the interrupted executor recorded none, and a plausible-looking figure would quietly corrupt every estimate calibrated against it.
- **`requirements.ready-ids` could not be trusted to gate this plan's six ids.** Asked for the six, it reported `PROV-01..05` ready and silently dropped `PROV-08`; asked for `PROV-08` alone it reported nothing; asked with a `--phase 03` flag it echoed `03` back as a ready requirement id. Meanwhile `03-06`, `03-08` and `03-09` all still declare `PROV-01..05` and have no summaries, so those ids are plainly not ready. `REQUIREMENTS.md` is therefore left unchanged by this plan, as it was by `03-04`, and the six ids stay held until the phase's remaining plans close.

## User Setup Required

None — no external service configuration is required. The real-key confirmation needs a learner's own provider key, which is the human check rather than a setup step.

## Next Phase Readiness

- **Plan 03-06 inherits the failure path it needs.** The search service's own rate limits and outages arrive as the same `error` part through the same controller, and whatever sentence it ends a turn with lands in the same one-link error card. Nothing about adding a tool changes the retry or the refusal.
- **Plan 03-07 sits inside the attempt.** The per-dialect projection changes how tools are registered on the `streamText` call that `withRetries` re-runs; because the attempt is a closure over the turn's accumulated state and settles before any error escapes, a dialect change needs no retry-aware code of its own.
- **Plan 03-08 shares the lesson header's one status line.** The cost string and the countdown both reach the header through the same ephemeral `status` event, so the simplicity rule's "one screen, one next step" is already the constraint they are designed against rather than something to reconcile later.
- **Phase 4 turns the abstain into a check.** `headroomCheck` already refuses at 80% of a known window and abstains where the table has none; sizing an Ollama or LM Studio model through `/api/show` (PROV-06) makes the local path refuse too, with no change to the caller.
- **Phase 4's parity harness gains a provider-independent failure vocabulary.** Every provider's rate limit now produces the same two status strings, the same `turn_end` shapes and the same error card, so "the same tutor on every provider" is assertable on the failure paths and not just the happy one.

**Open question carried forward:** a genuine free-tier rate limit survived with the countdown visible and Stop responsive, a wrong key failing immediately in the provider's own words, and the refusal card read at 375px and 1280px are queued for the phase UAT.

## Self-Check: PASSED

- All 3 modified files — FOUND on disk (`server/src/drivers/api.ts`, `web/src/pages/Lesson.tsx`, `server/test/api-driver.test.ts`)
- Commits `6b141bf`, `1d37e62`, `a034555`, `a8910ef` — FOUND in `git log`; `git rev-list --count 0c92a93f..HEAD` → **4**, matching `actuals.commits`, and `git rev-parse 6b141bf^` → `0c92a93`, matching `plan_head_before`
- `pnpm method:check` → `method: 6 rendered copies match method/`; `pnpm test` → **352 tests, 352 pass, 0 fail** (up from 342); `pnpm typecheck` clean in both packages (verified at `a8910ef`)
- Task 1 gates: `Provider busy, retrying in` → 2; `Provider busy, retrying now` → 2; `providerSentence|hintFor` → 3 (≥2 required); `RETRY_WINDOW_MS = 120_000` → 1; `emitEphemeral('status'` → 5 (≥3 required); `streamRetries|maxRetries: [1-9]` with comments stripped → 0; `git diff --quiet -- web/src/lib/useLesson.ts` → clean
- Task 2 gates: `headroomCheck(` → 1; `pruneMessages` with comments stripped → 0; the `node -e` refusal-copy script prints `refusal copy ok`; `to="/"` in `Lesson.tsx` → 3; the `node -e` error-box script prints `error box ok` (classes unchanged, `--color-rust-400` declared in `@theme`); `ls web/src/components/*.tsx | wc -l` → 13
- Task 3 gates: the `node -e` case-presence script prints `retry and refusal cases present`; `interrupted: true` in the suite → 6 (≥2 required); the refusal sentence asserted byte-for-byte → 1; no environment read in `server/src/drivers/api.ts` with comments stripped → 0
- Every must-have truth checked against the code at `a8910ef`; all hold, including the two the plan phrased as bounds — the longest string the vocabulary can produce is `Provider busy, retrying in 120s` (the clamp caps `left` at `RETRY_WINDOW_MS`), and the ephemeral line clears on `turn_end` because the reducer sets `status: null` there
- `server/src/driver.ts` byte-identical to `0c92a93` — the plan's `files_modified` entry was stale, recorded as deviation 4 rather than papered over

---
*Phase: 03-owned-loop-api-keys-and-gateways*
*Completed: 2026-10-06*
