---
phase: 04-local-models-parity-proof-and-usage
plan: 02
subsystem: providers
tags: [ollama, lmstudio, llamacpp, capability-probe, tool-calling, context-window, local-models, three-valued-verdict]

# Dependency graph
requires:
  - phase: 04-01-local-models-on-the-owned-loop
    provides: the three local adapter rows on the owned loop, NUM_CTX_FLOOR, headroomCheck's caller-resolved window and the one resolver in drivers/api.ts, the num_ctx field and its refusal card
  - phase: 03-owned-loop
    provides: the Driver/Adapter seam, the compact tool dialect and jsonSchemaOf, the tool registry and its api surface, headroomCheck and the pre-request refusal shape
  - phase: 02-settings-and-secrets
    provides: probe.ts's getJson/providerSentence/hintFor/unreachable, localBase and the detection pass, the ProviderRow field vocabulary, safeMessage
provides:
  - "a three-valued tool-calling verdict ('yes' | 'no' | 'unknown') where only a positive 'no' refuses and silence routes to a real round-trip"
  - the three per-server metadata parsers as pure functions — Ollama /api/show, llama.cpp /props + /v1/models, LM Studio /api/v1/models with the v0 fallback
  - "every capability read gated on a parsed field of the expected JSON type, never on a 200 — /props requires default_generation_settings.n_ctx as a number"
  - postJson beside getJson, with the redirect and timeout posture on the call and the three response rules factored into one jsonBody
  - "capabilityList: D-07's whole-list cheap pass on the one detection pass, with no request reaching a completion endpoint"
  - "the remembered verdict as module state in settings.ts's detection posture — forgotten on rescan and on an address change, never persisted"
  - the capability refusal enforced at both places a model becomes the one a lesson runs on (the model write and the activation), plus the lesson-time backstop
  - "modelFor over the existing chooseModel, so the activation asks the same question a turn asks"
  - "the served window of the two read-only rows reaching headroomCheck, so D-05's per-lesson refusal fires on the server's own number instead of abstaining"
affects: [04-03-usage-page, 04-04-conformance-harness, 05-learning-experience]

# Actuals (#2632) — same estimateTokens scale (chars/4) as the plan's estimate.
# Instrument named so a future calibration compares like with like: chars/4 over
# the added lines of the realized diff of server/src, server/test and web/src
# between plan_head_before and HEAD (83,163 chars). NOT a harness token count.
actuals:
  tokens: 20790
  tasks: 3
  commits: 4
plan_head_before: 289a3a38a9dcb0773e3cf14e07a657a47f5bc1f8

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A three-valued verdict where absence is its own value: only a positive negative refuses, and silence routes to the one tier that can settle it"
    - "A probe predicate requires a parsed field of the expected JSON type; a status code is never evidence that a particular server answered"
    - "Two tiers separated by the ENDPOINT they reach, not by request count: the cheap tier never touches a completion endpoint, which is what keeps the expensive one on one model"
    - "A verdict that could become false while nothing is watching lives in module memory, never in settings: memory can only ever go silent, and silence never refuses"
    - "A refusal reads a fact some other function established and remembered, so the row, the write, the activation and the lesson cannot disagree about the same model"

key-files:
  created:
    - server/src/capability.ts
    - server/test/capability.test.ts
  modified:
    - server/src/probe.ts
    - server/src/settings.ts
    - server/src/index.ts
    - server/src/drivers/api.ts
    - server/test/api.test.ts
    - server/test/settings.test.ts
    - server/test/local.test.ts
    - server/test/spawn.ts
    - web/src/lib/types.ts
    - web/src/lib/api.ts
    - web/src/components/ProviderRow.tsx
    - web/src/components/fields.ts

key-decisions:
  - "The window refusal rides a POSITIVE tools answer, never silence: with tools 'unknown' the whole verdict goes to the round-trip, which settles the tool question and re-runs the same ladder with it. So a small window is deferred to the tier that can decide rather than used to refuse a model nothing has been established about — and the per-lesson estimator remains the backstop"
  - "llamaCppCapability refuses to read ANY field of /props until default_generation_settings.n_ctx is a number. The dashboard on this machine's port 8080 answers 200 text/html on /props, so a caps map arriving in a body that cannot be llama.cpp's is not evidence either"
  - "The round-trip's negative is the one negative in the module not taken from a server's own statement, and it is sound only because of where it sits: the metadata tier already said nothing, and a model handed one tool and asked plainly for one call that answers prose instead cannot run a method that is nothing but tool calls. Any failure of the request is 'unknown', because that is a fact about the request"
  - "The round-trip registers an EXISTING registry tool with no execute, so the call comes back as a call and is read rather than run — no tool is added (the set matches in four places plus the plugin files), and nothing in the learner's record moves because Derive asked a question"
  - "The model write reads the cheap metadata tier only; the definitive round-trip is the probe the page makes immediately AFTER the save. A minute-long generation inside the PUT the learner is waiting on would be the wrong place for it, and D-07's 'one probe per chosen model' is satisfied either way"
  - "rememberMetadata exists as a separate seam from capabilityList because a typed model id may not be in the server's list at all: /api/show on that exact id is the right question, where a whole-list read would simply produce no verdict for it"
  - "fakeServer and jsonAt moved into server/test/spawn.ts: two suites want them now, and two copies are how they would start disagreeing about what an unparseable body or a wrong path does"
  - "A new resultLine constant in fields.ts replaced the hand-rolled mono-truncate string rather than adding a second copy beside it, per that file's own reason for existing"

patterns-established:
  - "Verdict memory is keyed on a unit separator, not a colon or slash: a model id is a learner-typed string that may well carry either (publisher/model:tag), and a separator the id can contain is one two rows can collide on"
  - "A gate is seen failing with its mechanism removed before it is kept — applied to all five new gates in this plan (the lesson backstop, the list pass, the write refusal, the activation refusal, the served-window wiring)"
  - "A pass is proven by what it does NOT ask: one list read, no completion path in the recorded paths, and a following write that needs no re-read"

requirements-completed: [PROV-07]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "A model whose server positively reports it cannot call tools is refused with Derive's approved sentence naming the missing capability, and the sentence is the UI-SPEC's verbatim"
    requirement: PROV-07
    verification:
      - kind: unit
        ref: "server/test/capability.test.ts#refuses a model whose server says it cannot call tools"
        status: pass
      - kind: unit
        ref: "server/test/capability.test.ts#uses the approved refusal sentence verbatim, with only the model substituted"
        status: pass
      - kind: unit
        ref: "server/test/capability.test.ts#is a positive no when the array is there without tools"
        status: pass
      - kind: unit
        ref: "server/test/capability.test.ts#refuses on a false, because a false is a detection and not an absence"
        status: pass
      - kind: unit
        ref: "server/test/capability.test.ts#reads a negative trained_for_tool_use as a refusal"
        status: pass
      - kind: integration
        ref: "server/test/api.test.ts#refuses a model the server says cannot call tools, in the approved words"
        status: pass
    human_judgment: false
  - id: D2
    description: "A model whose server says nothing about tool calling is NOT refused: the verdict stays 'unknown' and falls through to the round-trip, which is the only thing that can turn silence into a fact (the PROV-07 prohibition)"
    requirement: PROV-07
    verification:
      - kind: unit
        ref: "server/test/capability.test.ts#is silence when capabilities is absent"
        status: pass
      - kind: unit
        ref: "server/test/capability.test.ts#is silence rather than a throw when capabilities is not an array"
        status: pass
      - kind: unit
        ref: "server/test/capability.test.ts#is silence when chat_template_caps is absent, and does not refuse"
        status: pass
      - kind: unit
        ref: "server/test/capability.test.ts#leaves a v0-only server at silence, so the round-trip is what decides"
        status: pass
      - kind: unit
        ref: "server/test/capability.test.ts#lets silence through, and says the verdict is not settled yet"
        status: pass
      - kind: unit
        ref: "server/test/capability.test.ts#answers null for a pair nothing has been read for"
        status: pass
      - kind: integration
        ref: "server/test/settings.test.ts#lets both through on a server that says nothing about tool use at all"
        status: pass
    human_judgment: false
  - id: D3
    description: "A model whose maximum window is below 16384 is refused at config/probe time, symmetric with the tool-calling refusal, with its own sentence (a ceiling, not the raisable num_ctx one); a null maximum never refuses"
    requirement: PROV-07
    verification:
      - kind: unit
        ref: "server/test/capability.test.ts#refuses a tool-capable model whose maximum window is under the floor"
        status: pass
      - kind: unit
        ref: "server/test/capability.test.ts#allows a tool-capable model exactly at the floor"
        status: pass
      - kind: unit
        ref: "server/test/capability.test.ts#allows a tool-capable model whose window the server did not state"
        status: pass
      - kind: unit
        ref: "server/test/capability.test.ts#does not refuse a small window it only knows about through silence"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every liveness and capability predicate reads a parsed JSON field of the expected type, never a 200 status code — the port-8080 dashboard answers 200 text/html on both /health and /props"
    requirement: PROV-07
    verification:
      - kind: unit
        ref: "server/test/capability.test.ts#produces no verdict at all without a numeric n_ctx"
        status: pass
      - kind: unit
        ref: "server/test/capability.test.ts#throws nothing on the dashboard that answers HTML on /props"
        status: pass
      - kind: unit
        ref: "server/test/capability.test.ts#throws nothing for a body that is not an object at all"
        status: pass
      - kind: other
        ref: "grep: zero non-comment lines in server/src/capability.ts match `status === 200`"
        status: pass
    human_judgment: false
  - id: D5
    description: "Metadata is read for the whole list on the one pass the Settings page already makes, one cheap read per found local row with no request reaching a completion endpoint; the row shape on the wire is unchanged"
    requirement: PROV-07
    verification:
      - kind: integration
        ref: "server/test/settings.test.ts#reads every model on a found row in one pass, and asks no completion endpoint"
        status: pass
      - kind: integration
        ref: "server/test/settings.test.ts#row shape is unchanged by the pass — no new field, and no verdict on the wire"
        status: pass
    human_judgment: false
  - id: D6
    description: "A model the ladder marks non-selectable can be neither stored on its row nor made the active provider: both refuse with the approved sentence and neither writes anything"
    requirement: PROV-07
    verification:
      - kind: integration
        ref: "server/test/settings.test.ts#refuses the write for a model the server reports as not tool-capable, and stores nothing"
        status: pass
      - kind: integration
        ref: "server/test/settings.test.ts#refuses the activation for a row whose stored model the ladder refused"
        status: pass
      - kind: integration
        ref: "server/test/settings.test.ts#lets the same write and the same activation through when the server says the model is tool-capable"
        status: pass
      - kind: integration
        ref: "server/test/settings.test.ts#leaves a model write on a row the ladder does not cover alone"
        status: pass
    human_judgment: false
  - id: D7
    description: "The lesson-time capability refusal remains the backstop for a model that slipped through before any verdict existed, carrying the same approved sentence whose one link is Settings; a model nothing is known about is not refused"
    requirement: PROV-07
    verification:
      - kind: integration
        ref: "server/test/local.test.ts#is refused before the request, with the capability sentence whose one link is Settings"
        status: pass
      - kind: integration
        ref: "server/test/local.test.ts#lets a turn through when nothing is known about the model"
        status: pass
    human_judgment: false
  - id: D8
    description: "The capability probe lives only on the three dedicated local rows: POST /api/settings/:provider/capability always answers 200 with a verdict (or ok:false when nothing answers), and the generic OpenAI-compatible row and the key rows are refused by name (D-01)"
    requirement: PROV-07
    verification:
      - kind: integration
        ref: "server/test/api.test.ts#answers 200 with the verdict when the server has metadata"
        status: pass
      - kind: integration
        ref: "server/test/api.test.ts#answers 200 with ok false when nothing answers at all"
        status: pass
      - kind: integration
        ref: "server/test/api.test.ts#keeps the two excluded rows off the local path, naming each"
        status: pass
      - kind: integration
        ref: "server/test/api.test.ts#is a 404 for an id the catalogue does not carry, and a 400 with no model"
        status: pass
      - kind: integration
        ref: "server/test/api.test.ts#falls back to the model stored on the row when the body names none"
        status: pass
    human_judgment: false
  - id: D9
    description: "The window LM Studio and llama.cpp report reaches headroomCheck, so D-05's per-lesson refusal fires on the server's own number instead of abstaining"
    requirement: PROV-07
    verification:
      - kind: integration
        ref: "server/test/local.test.ts#measures a read-only row against the window its server reported, instead of abstaining"
        status: pass
    human_judgment: true
    rationale: "The wiring and the refusal are proven, and the case was seen failing with the wiring removed. What is NOT settled is which sentence should fire: headroomCheck picks on whether the caller supplied the window, so these two rows now get the num_ctx card, whose first fix (raise num_ctx in Settings) does nothing on a row D-05 sends no window to. Neither locked UI-SPEC sentence fits a read-only row and a third is a Copywriting Contract change this plan is not the place for. Recorded as an open entry in .planning/WINDOWS.md and pinned by the assertion above so the fix has a failing case to update."
  - id: D10
    description: "The round-trip tier (D-06): one real tiny tool-call request to the chosen model through that row's adapter, using an existing registry tool with no execute, at the window the real lesson uses"
    requirement: PROV-07
    verification:
      - kind: other
        ref: "pnpm --filter server exec node --import tsx --test test/wire-surface.test.ts — the declared tool set equals the shown set in both directions against the committed snapshot, so the probe added no tool"
        status: pass
    human_judgment: true
    rationale: "No local model server exists on this machine, so the round-trip cannot be driven end to end here: whether a given model answers the one-tool prompt with a tool call is exactly the thing that needs a real model. What IS proven without one is that it adds no tool, that it is reached only from the tools:'unknown' branch, and that every failure of the request reads as 'unknown' rather than as a refusal. Queued as the real-server UAT in Task 2's human-check block (steps 1-3)."
  - id: D11
    description: "E1 Settings local-model row (partial state): a reachable server exposing no tool-capable model still renders its found status and its model list, with the capability verdict beside them — never a half-built row"
    requirement: PROV-07
    verification: []
    human_judgment: true
    rationale: "The verdict line is rendered from what the API returned and gates nothing else on the row — the status pill, the note, the model combobox and the fields are untouched by it, and the two refusals render on the existing errLine. That the line reads correctly beside the test result at every width, truncates without widening the card, and that the colour reads as intended, is a visual judgement no test here makes. No local server exists on this machine; queued as the real-server UAT in Task 2's human-check block (step 1)."
  - id: D12
    description: "E2 the lesson capability-refusal card: the approved sentence whose one link is Settings, rendered as the error surface of the failed turn"
    requirement: PROV-07
    verification:
      - kind: integration
        ref: "server/test/local.test.ts#is refused before the request, with the capability sentence whose one link is Settings"
        status: pass
    human_judgment: true
    rationale: "The sentence, its single Settings link and the absence of the Home wording are asserted, and the card is the pre-existing Phase-3 surface this plan adds no event type to. That the rendered card wraps correctly inside max-w-[62ch] with a long model id in it, and that the Settings link lands on Settings in a browser, is the same visual check 04-01 queued for its own refusal card and is still open."

# Metrics
duration: 32 min
completed: 2026-10-22
status: complete
---

# Phase 04 Plan 02: The Capability Read Summary

**A three-valued tool-calling verdict read from each local server's own metadata — Ollama's `/api/show`, llama.cpp's `/props`, LM Studio's `/api/v1/models` — where only a positive `no` refuses and an older build's silence falls through to one real tool-call round-trip, enforced at the model write, the activation and as a lesson-time backstop, with every predicate gated on a parsed JSON field because this machine's port 8080 answers 200 `text/html` on `/props`.**

## Performance

- **Duration:** 32 min (first task commit to plan close)
- **Started:** 2026-10-22T20:09:41Z
- **Completed:** 2026-10-22T20:41:51Z
- **Tasks:** 3 (one tracer, two expansion)
- **Files modified:** 14 (2 created, 12 modified)
- **Tests:** 413 → 467 (+54)

## Accomplishments

- **Silence is a third value, and it is the one that never refuses.** This is the whole requirement. An older llama.cpp build emits no `chat_template_caps` and an older LM Studio has no `/api/v1/models` at all, so reading `supports_tools !== true` as a refusal would tell a learner with a perfectly capable model a sentence that is simply false and leave them unable to proceed. `tools` is `'yes' | 'no' | 'unknown'`; only `'no'` refuses; `'unknown'` routes to the round-trip. Seven cases drive that from literals, including the two older-build shapes by name.

- **A `false` from llama.cpp is a finding; an absence is not.** That asymmetry is not a judgement call — `caps.h` initialises `supports_tools`, `supports_tool_calls`, `supports_system_role` and `supports_parallel_tool_calls` to `true`, and the server only turns a field off once it has detected that the template cannot. So a `false` is the server reporting a detection. The comment on the parser records that, because it is the reason a `false` may refuse while an absent map may not, and a future reader "simplifying" the two together would reintroduce exactly the failure the requirement names.

- **Nothing is believed because something answered.** `/props` is not read at all until `default_generation_settings.n_ctx` is a number — not as belt-and-braces, but because port 8080 is llama.cpp's own default and on this machine it is an unrelated dashboard answering 200 `text/html` on both `/health` and `/props`. A status check would read that dashboard as llama.cpp and then parse a web page as capability metadata. A fixture whose `/props` body is `<!DOCTYPE html>…` asserts it, and a non-comment-line grep for `status === 200` in the module returns zero.

- **The two tiers are separated by the endpoint they reach, not by their request count.** Opening Settings reads every model on every found local row — one `/props` plus one list for llama.cpp, one list for LM Studio, one `/api/show` per installed model for Ollama because that is the only place Ollama keeps capabilities — and **no request reaches a completion endpoint**. The test proves that by what the fake was *not* asked for. The distinction is recorded in a comment because a later reader optimising towards "one request per row" could move the round-trip in here and quietly make opening Settings cost a generation on every installed model.

- **The refusal is enforced where the selection happens.** D-04's own words are that the model "cannot be selected", so both places a model becomes the one a lesson runs on now ask: the model write refuses with the approved sentence and stores nothing, and `POST /api/settings/active` refuses before `ACTIVE_PROVIDER` is written, resolving the row's model through a new `modelFor` over the *existing* `chooseModel` — one declaration, three callers, no second copy of the tiers, so Settings cannot refuse one model while the next turn would have run another.

- **The verdict lives in memory on purpose, and the reason is in the module header.** A learner can reload the same model under a different chat template without Derive hearing about it, so a verdict persisted across restarts would come back as a confident claim about a server that has since changed. Memory can only ever go *silent* after a restart, and silence never refuses. It is `settings.ts`'s own detection posture: reported whatever its age, dropped on rescan and on an address change, never on a clock.

- **Five new gates, each seen failing with its mechanism removed before being kept** — the lesson backstop, the whole-list pass, the write refusal, the activation refusal and the served-window wiring. Removing the list pass fails three cases, the write refusal two, the activation one, in a way that distinguishes them, so none of the three is passing on another's behalf.

- **The served window now reaches the estimate on the two read-only rows**, which 04-01 left deliberately unset and shaped `headroomCheck` to receive. One thing that came with it is unresolved by design and recorded rather than hidden — see Issues Encountered.

## Task Commits

1. **Task 1: the Ollama path end to end** (tracer) — `acba138` (feat)
2. **Task 2: llama.cpp and LM Studio, the memory, and the round-trip** — `0251aef` (feat)
3. **Task 3: the whole-list pass and the two Settings refusals** — `f93c53e` (feat)
4. **The served window on the read-only rows, pinned** — `6029295` (test)

**Measured, not narrated:** `git rev-list --count 289a3a38..HEAD` = 4.

## Files Created/Modified

- `server/src/capability.ts` — **new.** The module header carries the reasoning in five paragraphs (why the question is asked before a lesson, why two tiers, why silence must never refuse, why no read trusts a status code, and why the verdict is memory rather than a settings row). Then `Capability`, `CapabilityVerdict`, the approved refusal constant and the window-ceiling one, the three pure parsers, `verdictOf`'s ladder, `readCapability`'s per-row reads, the module memory with `capabilityRefusal`, the `roundTrip` definitive tier, `rememberMetadata` and the whole-list `capabilityList`.
- `server/test/capability.test.ts` — **new.** 38 cases, no server and no network, every fixture built from the JSON quoted in `04-RESEARCH.md` §Three Servers (including the nine real `chat_template_caps` keys) and deliberately *not* using `llama` as the Ollama architecture, so a parser that hard-coded one family fails rather than passing on the doc example.
- `server/src/probe.ts` — `postJson` beside `getJson` with the redirect and timeout posture on its own call; the three response rules (3xx, non-2xx, unparseable) factored into one `jsonBody` both verbs share; `field`, `statusOf` and `bearer` exported so no new predicate carries a second copy.
- `server/src/settings.ts` — `modelFor` over the unexported `chooseModel`.
- `server/src/index.ts` — `POST /api/settings/:provider/capability`; the whole-list pass on `POST /api/settings/detect` (found local rows only, previous verdicts dropped first); the refusal on the model write and on the activation; `forgetCapabilities` on a base-URL write.
- `server/src/drivers/api.ts` — the pre-request capability backstop on the same `endTurn` shape as the headroom refusal, and the served window for the two read-only rows resolved from the capability read.
- `web/src/lib/types.ts`, `web/src/lib/api.ts` — `CapabilityResult` mirroring `TestResult`'s two arms with the wire's snake_case, and exactly one new api key, `probeCapability`.
- `web/src/components/ProviderRow.tsx` — the verdict line on the row and the one `probeCapability` call after a model save; the existing test-result span recomposed onto the new shared constant.
- `web/src/components/fields.ts` — `resultLine`, replacing the hand-rolled mono-truncate string rather than sitting beside it.
- `server/test/api.test.ts`, `server/test/settings.test.ts`, `server/test/local.test.ts`, `server/test/spawn.ts` — the route cases, the pass-and-refusals cases, the two backstop cases plus the served-window case, and `fakeServer`/`jsonAt` lifted into the shared harness.

## Decisions Made

Beyond the `key-decisions` frontmatter, three worth reading in full:

**The window check rides a positive tools answer, not silence.** The plan's ladder scopes the sub-floor refusal to `tools: 'yes'`, and Task 2's own criterion requires `capabilityRefusal` to answer null for `tools: 'unknown'`. Those two together mean a server that reports a small window while saying nothing about tool calling — an older llama.cpp with `n_ctx_train` but no caps map, or a v0-only LM Studio — is *not* refused on the window alone. That is the right call rather than a gap: the verdict goes to the round-trip, which settles the tool question and then re-runs the same ladder with it, so the window is deferred to the tier that can decide rather than dropped. `verdictOf` is written to be re-runnable for exactly that reason, and a case asserts the deferral explicitly.

**The write reads metadata; the page's probe does the round-trip.** The plan calls the model write "the moment D-07 calls the model the learner selects" and also says the write's read is "bounded by `LOCAL_MS`". A round-trip is a real generation on local hardware, bounded at 60 s because refusing a capable model for being slow would be worse than waiting — which is not something to run inside a `PUT` the learner is watching. So the write uses a metadata-only seam (`rememberMetadata`) and the browser's `probeCapability` call immediately after a successful save runs the definitive tier. D-07's "one probe per chosen model" holds, and the refusal still lands before anything is stored.

**The round-trip reuses a registry tool with no `execute`.** `set_phase` has the smallest schema in the registry — one enum field — and registering it without an `execute` means the model's call comes back as a *call* and is read rather than run: nothing in the learner's record moves because Derive asked a question about a model. No tool was added, which `wire-surface.test.ts` confirms against the committed snapshot in both directions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task 1's own `--jinja` criterion failed on Task 1's own comment**

- **Found during:** Task 1 acceptance-criteria gate
- **Issue:** The criterion is a file-count grep — `grep -rl -- '--jinja' server/src/ | wc -l` must be `0` — and the doc comment I wrote on the refusal constant named the flag in order to explain why no sentence instructs the learner to pass it. A comment explaining the absence still fails a gate that counts files.
- **Fix:** The comment states the fact without the flag's name ("llama.cpp's template engine, which an older note suggested the learner might have to switch on, is enabled by default on current builds") and says plainly why no sentence under `server/src` carries that name at all.
- **Files modified:** `server/src/capability.ts`
- **Verification:** `test "$(grep -rl -- '--jinja' server/src/ | wc -l)" = 0` passes.
- **Committed in:** `acba138`

**2. [Rule 2 - Missing Critical] A shared test helper would have been a second copy**

- **Found during:** Task 1
- **Issue:** The route cases need a loopback fake, and `fakeServer`/`jsonAt` existed only as local definitions inside `settings.test.ts`. Copying them into `api.test.ts` is how two fakes start disagreeing about what an unparseable body or a wrong path does — the same defect this repo's own rule about duplicated destination guards names.
- **Fix:** Both moved into the existing shared harness `server/test/spawn.ts` (not in the plan's `files_modified`, which lists no harness file) and imported from there; `settings.test.ts`'s local copies were deleted in Task 3, which is the task that touches that file.
- **Files modified:** `server/test/spawn.ts`, `server/test/api.test.ts`, `server/test/settings.test.ts`
- **Verification:** `pnpm test` — 467 pass; `settings.test.ts` 88 pass on the shared helper.
- **Committed in:** `acba138`, `f93c53e`

**3. [Rule 2 - Missing Critical] A verdict line nothing populated**

- **Found during:** Task 1
- **Issue:** Task 1 renders the verdict on the row and Task 3 was to "add the one missing trigger". Shipping Task 1 with a rendered line that nothing could ever fill would make the tracer's own `<done>` ("shows the verdict on the row") untrue and leave dead UI at the commit — which is precisely what a tracer is supposed to avoid.
- **Fix:** The `probeCapability` call after a successful model save landed in Task 1 rather than Task 3. It is the trigger D-07 names and the one Task 3 specifies; Task 3's criterion for the component ("calls `probeCapability` once for the model it just saved and adds no new element") therefore verified as already true.
- **Files modified:** `web/src/components/ProviderRow.tsx`
- **Verification:** Task 3's criterion re-run — one `api.probeCapability` call site, no new element, both refusals on the existing `errLine`.
- **Committed in:** `acba138`

**4. [Rule 1 - Bug] A capability probe failure read as a failed model save**

- **Found during:** Task 1
- **Issue:** The first version put the probe inside the model field's existing `save()` try, so a probe that threw would set the field's error state and revert the saved tick — telling the learner their save failed when it had succeeded.
- **Fix:** The write keeps its own try and returns on failure; the probe runs after it in its own try, and a probe that cannot be read renders on the capability line as `{ ok: false }` rather than on the field's error line.
- **Files modified:** `web/src/components/ProviderRow.tsx`
- **Verification:** `pnpm typecheck`; the two paths are now separate statements with separate catches.
- **Committed in:** `acba138`

**5. [Rule 2 - Missing Critical] A raw control character as a map separator**

- **Found during:** Task 2
- **Issue:** The verdict key joined provider and model on a literal `U+001F` typed into the source, which is invisible in a diff and in most editors — a separator a future edit could delete without noticing.
- **Fix:** A named `SEP = ''` constant with the reason for choosing a control character (a model id is learner-typed and may carry `/` or `:`, so a separator the id can contain is one two rows can collide on). A case asserts two rows with the same model id do not collide.
- **Files modified:** `server/src/capability.ts`, `server/test/capability.test.ts`
- **Verification:** `capability.test.ts#does not confuse two rows whose model ids are the same`.
- **Committed in:** `0251aef`

**6. [Rule 2 - Missing Critical] The lesson backstop had no case**

- **Found during:** Task 2
- **Issue:** Task 2's criterion for the backstop is a code-shape claim, and the plan's human-check covers the Settings refusals rather than the lesson one. An untested refusal in the turn path is exactly the kind of thing that silently stops working.
- **Fix:** Two cases in `local.test.ts` (04-01's file, which already holds the num_ctx pre-request refusal and its harness): one asserting the refusal with the approved sentence and no request going out, and one asserting that a model nothing is known about is *not* refused — the narrowness matters as much as the refusal. Seen failing with the backstop disabled.
- **Files modified:** `server/test/local.test.ts`
- **Verification:** `local.test.ts` 11 pass; with the backstop stubbed out, 1 fail.
- **Committed in:** `0251aef`

---

**Total deviations:** 6 auto-fixed (1 bug, 4 missing critical, 1 blocking)
**Impact on plan:** No scope creep. Two are the plan's own criteria colliding with their own prose (the `--jinja` comment, the tracer's dead line), three add tests or a name the plan's criteria implied but did not spell out, and one is a real UI bug in code this plan wrote. No mechanism was deleted to make a test pass and no assertion was softened into one its mechanism's absence could satisfy — the opposite: all five new gates were seen failing first.

## Issues Encountered

**The served window makes the wrong refusal sentence fire on the two read-only rows, and that is recorded rather than quietly shipped.** `headroomCheck` chooses between its two refusal constants on whether the *caller* supplied the window, and the caller-supplied branch is the `num_ctx` sentence, whose stated fix is the `num_ctx` field on the model's own row. That was exactly right while Ollama was the only row reaching that branch. Passing LM Studio's and llama.cpp's served window — which the plan requires, so that D-05's per-lesson refusal fires on the server's own number instead of abstaining — now sends a learner on those rows to raise a field that D-05 makes Derive ignore. Only the sentence's second half ("or pick a model with room") is actionable there.

Neither of the two locked sentences fits a read-only row, and inventing a third is a change to `04-UI-SPEC.md`'s Copywriting Contract, which the plan explicitly says to leave untouched ("the locked UI contract is untouched") and which is a decision for the owner rather than for this plan. So three things were done instead of one silent choice: the wrinkle is commented at the line in `drivers/api.ts` that causes it, the current wording is **pinned by an assertion** in `local.test.ts` so the eventual fix has a failing case to update, and it is filed as an open `unmet-truth` entry in `.planning/WINDOWS.md` so the ship gate sees it. Worth noting that the underlying oddity is older than this plan: 04-01 renders a `num_ctx` field on all three local rows while only Ollama's adapter reads it.

**`capability.test.ts` cannot be run with no `DERIVE_DATA_DIR`, and the plan's own action text says why.** Task 1's criterion asks for the suite to run "with no `DERIVE_DATA_DIR` and no database file created", while the same task's action says to follow `cost.test.ts`'s header — which pins a scratch `DERIVE_DATA_DIR`. The two cannot both hold: `capability.ts` needs the learner's server address, that comes from `localBase` in `settings.ts`, and `settings.ts` imports `db.ts`, which opens the SQLite file at import time. Importing the module at all therefore creates a database. The suite does what the action text says and what every other pure suite in this repo does — pins a scratch directory, so the file created is a scratch one and the developer's own `~/.derive` is never touched — and the header states that reason in place of repeating the criterion. The criterion's *intent* (no server, no network, no model, no row read or written) holds: not one case in the file opens a socket or touches a table. Satisfying it literally would mean moving `NUM_CTX_FLOOR` out of `settings.ts` or injecting the base URL into the module, both of which are larger changes than the criterion is worth.

**Two suites spawn the built server**, so a stale `server/dist` reports behaviour from code already changed. The plan's verify chain puts `pnpm build` ahead of `pnpm test` for exactly this reason; the red-gate checks above each rebuilt before running.

## Known Stubs

None. Every file this plan touched was scanned for hardcoded empty values flowing to the UI, placeholder prose (`TODO`, `FIXME`, "coming soon", "not available") and skipped or todo tests; the only `placeholder` matches are pre-existing HTML attributes on input fields. The `default: return silence()` arm in `readCapability` is not a stub — it is the deliberate answer for a row the ladder does not cover, and silence is the verdict that never refuses.

## Threat Flags

None beyond the plan's own `<threat_model>`. Every new surface is already registered there: the three metadata reads and the round-trip are T-04-02 (`accept`, same bounded posture as 04-01 — `redirect: 'manual'` with a 3xx refused, `AbortSignal.timeout`, a key only in a header and only to the stored address); the parsers are T-04-06 (`mitigate`, and the HTML fixture is the test it asks for); the whole-list pass is T-04-15 (`accept`, bounded to found local rows with no completion endpoint); the verdict's error field is T-04-08 (`mitigate` — `capabilityOf` answers rather than throws so every sentence passes through `safeMessage`, and `capabilityList`/`rememberMetadata` swallow failures entirely so no sentence reaches anyone). The one new route is behind the same per-install token and session cookie as every other `/api/*` route, with no exemption. No new fetcher, no new SSRF guard, no new secret store, and no dependency added.

## User Setup Required

None by this plan's own doing — no `user_setup` in the frontmatter, and nothing here needs a key or an account. Exercising the local rows at all needs a local server on the learner's machine, which is what Task 2's human-check block asks for.

## Next Phase Readiness

**Ready for 04-03.** This plan adds no tool, no event type and no field to `rowView`, so the Usage page's surface is exactly as 04-01 left it. `knownCapability` is the seam if a later plan wants the served window anywhere else.

**Open, and owed to the end-of-phase UAT:**

- **Four real-server human checks** (D9, D10, D11, D12 in `coverage`): the round-trip against a tool-capable and a non-tool-capable model, the older-build case where silence must not refuse, the port-8080 case where an HTML 200 must not read as `found on port 8080`, and the two rendered surfaces (the row's verdict line beside the test result, and the lesson card's wrap and its Settings link landing). No local server exists on this machine; Task 2's human-check block carries all of them, including the note that llama.cpp must be probed on 8081 here because 8080 is occupied by an unrelated dashboard.
- **One open `WINDOWS.md` entry** — the read-only rows' refusal sentence, above. It needs an owner decision on `04-UI-SPEC.md`'s Copywriting Contract, not more code.
- **FA-02 stands as written.** The five shape edges the planner assumed are the ones that matter for PROV-07 are all now tested from literals: a field present and `true`, present and `false`, absent entirely, present with the wrong JSON type, and a 200 whose body is not JSON at all. A sixth a verifier finds is a gap in that assumption, not in the requirement.
- **Research assumption A1 is settled as immaterial, as predicted.** The LM Studio version that introduced `/api/v1/*` appears nowhere in shipped code; the fallback chain `/api/v1/models` → `/api/v0/models` → round-trip is correct whichever version it was, and all three legs are tested.
- **Carried forward, not closed here:** the Ollama *search* backend stays out of scope (the adapter row answers `search: () => null`), and lifting `/you`'s field strings onto the shared `fields.ts` vocabulary is still owed from Phase 3.

---
*Phase: 04-local-models-parity-proof-and-usage*
*Completed: 2026-10-22*

## Self-Check: PASSED

Both files in `key-files.created` exist on disk and all four task commit hashes resolve in `git log`. Every task's `<acceptance_criteria>` was re-run and passes, with the one documented exception recorded under Issues Encountered (the `no DERIVE_DATA_DIR` half of Task 1's purity criterion, which the same task's action text contradicts). The plan-level `<verification>` block was re-run end to end: `pnpm method:check && pnpm typecheck && pnpm build && pnpm test` passes (467 tests, 0 failures, up from 413), `capability.test.ts` passes 38 cases with every fixture from the research JSON, no non-comment line in `capability.ts` gates a read on `status === 200`, one `POST /api/settings/detect` leaves a verdict for every model on a found row with no completion path in the recorded requests, a non-selectable model is refused by both the write and the activation while a model nothing is known about is refused by neither, `server/test/wire-surface.json` and `web/src/lib/useLesson.ts` are byte-unchanged from `289a3a38`, and `--jinja` appears nowhere under `server/src/`. All five new gates were additionally seen failing with their mechanisms removed and green with them restored.
