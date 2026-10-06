---
phase: 03-owned-loop-api-keys-and-gateways
plan: 01
subsystem: api
tags: [ai-sdk, streamtext, anthropic, driver, tool-dispatch, usage-ledger]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "The driver seam (Driver.runTurn / EventSink / sinkFor), the turns+usage ledger with per-model-request grain, the one tool registry, secrets.safeMessage"
  - phase: 02-settings-and-secrets
    provides: "The provider catalogue, resolveTutor/chooseModel, effectiveKey and baseUrlKey, the 0600 secrets file, the header pill that reads turns.driver"
provides:
  - "Derive's own agent loop: one streamText per turn in server/src/drivers/api.ts, consumed from fullStream into the existing event sink"
  - "The per-provider adapter table in server/src/drivers/adapters.ts, an exhaustive switch over ProviderId with no default"
  - "noRedirectFetch: the key-bearing provider request refuses any 3xx rather than following it"
  - "actions.runTool / TUTOR_TOOL_HANDLERS: the fourteen tutor tools dispatched from one place for every driver"
  - "The third branch of agent.ts runTurn, selecting the owned loop by resolved provider"
  - "The anthropic catalogue row teaching for the first time"
  - "server/test/api-driver.test.ts: the real loop driven by a stub LanguageModel, no network and no key"
affects: [03-03 remaining provider adapters, 03-04 turn_messages and resume, 03-06 web search and fetch, 03-07 dialect projection, 03-08 caching and cost, 04 local models]

actuals:
  tokens: 12196
  tasks: 2
  commits: 2
  plan_head_before: 72eae232d07f1e29ecdf9b05eac37dc4724cb681

tech-stack:
  added:
    - "ai@7.0.126"
    - "@ai-sdk/anthropic@4.0.71"
    - "@ai-sdk/openai@4.0.83"
    - "@ai-sdk/google@4.0.87"
    - "@ai-sdk/openai-compatible@3.0.62"
    - "@openrouter/ai-sdk-provider@3.1.0"
  patterns:
    - "One streamText per turn; the turn's history accumulated from fullStream, never read from result.responseMessages"
    - "Tool execution serialised through a per-lesson promise chain inside execute, because the SDK runs a step's tool calls with Promise.all"
    - "Driver.name is the catalogue ProviderId, so turns.driver and every usage row name the provider"
    - "One adapter table keyed by ProviderId, exhaustive with no default, mirroring probe.ts requestFor"
    - "A projected JSON Schema handed to inputSchema, never a zod schema, so the wire surface cannot drift"

key-files:
  created:
    - server/src/drivers/api.ts
    - server/src/drivers/adapters.ts
    - server/test/api-driver.test.ts
  modified:
    - server/package.json
    - pnpm-lock.yaml
    - server/src/actions.ts
    - server/src/agent.ts
    - server/src/providers.ts
    - server/test/settings.test.ts

key-decisions:
  - "The tool dispatch map moved out of agent.ts into actions.ts as TUTOR_TOOL_HANDLERS + runTool, so the Claude driver and the owned loop share one fourteen"
  - "apiDriverFor(provider) builds a Driver whose name is the catalogue id; apiDriver exposes the same loop with name as a getter over currentTutor().provider, so no code path can file a turn under the generic label 'api'"
  - "input_tokens is mapped from usage.inputTokenDetails.noCacheTokens, never usage.inputTokens, because this repo's column means the uncached part"
  - "The serialisation case was proven by removing the chain and seeing it fail; an earlier version of the same assertion passed either way and was replaced"
  - "The two catalogue assertions in settings.test.ts were updated in place with a sentence saying why, rather than left recording a pre-flip contract"

patterns-established:
  - "Owned-loop driver: resolve provider -> adapter -> model, register the abort before the request, map fullStream onto the sink, end through the same catch/finally discipline as the Claude driver"
  - "A blocking-tool test is how tool serialisation is proven: two ask cards in one step, with the second forbidden to open before the first is answered"

requirements-completed: [PROV-01, PROV-08]

coverage:
  - id: D1
    description: "A lesson whose active provider is anthropic runs its turn through Derive's own loop: tool calls reach actions.ts, prose arrives as growing assistant events, the turn ends exactly once"
    requirement: "PROV-01"
    verification:
      - kind: integration
        ref: "server/test/api-driver.test.ts#streams the prose as one growing assistant event and ends the turn once"
        status: pass
    human_judgment: false
  - id: D2
    description: "turns.driver and every usage row carry the catalogue provider id, with one row per model request and the uncached input count in input_tokens"
    requirement: "PROV-08"
    verification:
      - kind: integration
        ref: "server/test/api-driver.test.ts#files the turn and every usage row under the provider, with the uncached input count"
        status: pass
    human_judgment: false
  - id: D3
    description: "One turn per lesson holds on the owned loop: a second runTurn throws 'lesson is busy' and makes no second streamText call"
    verification:
      - kind: integration
        ref: "server/test/api-driver.test.ts#refuses a second turn for a lesson already running, and makes no second model call"
        status: pass
    human_judgment: false
  - id: D4
    description: "Two tool calls arriving in one step execute strictly one at a time, in arrival order"
    verification:
      - kind: integration
        ref: "server/test/api-driver.test.ts#runs two tool calls from one step strictly one at a time, in arrival order"
        status: pass
    human_judgment: false
  - id: D5
    description: "The owned loop introduces no new event type and leaves the frozen tool contract untouched"
    verification:
      - kind: integration
        ref: "server/test/api-driver.test.ts (verbatim EVENT_TYPES membership) + git diff --quiet -- server/test/wire-surface.json"
        status: pass
      - kind: integration
        ref: "server/test/wire-surface.test.ts"
        status: pass
    human_judgment: false
  - id: D6
    description: "The fourteen tutor tools are dispatched from one place; agent.ts no longer carries its own handlers record"
    verification:
      - kind: other
        ref: "test \"$(grep -c 'const handlers' server/src/agent.ts)\" = 0 && grep -c runTool server/src/agent.ts server/src/actions.ts server/src/drivers/api.ts"
        status: pass
      - kind: integration
        ref: "server/test/driver.test.ts + the whole suite (284 tests) through the rewritten buildTools"
        status: pass
    human_judgment: false
  - id: D7
    description: "The key-bearing provider request refuses a redirect rather than following one (T-03-01)"
    verification:
      - kind: other
        ref: "grep -c \"redirect: 'manual'\" server/src/drivers/adapters.ts"
        status: pass
    human_judgment: true
    rationale: "The grep proves the wrapper is wired into the factory; that a real provider 3xx is actually refused needs a provider, and no key exists in this environment"
  - id: D8
    description: "A real Anthropic key teaches a lesson as far as one locked node, with a streaming pill, a Thinking status line, no reasoning in the record, and a clean Stop"
    verification: []
    human_judgment: true
    rationale: "No provider key exists in this environment (03-RESEARCH.md Environment Availability), so no automated test can show it; this is the plan's own <human-check>"

duration: 14 min
completed: 2026-10-06
status: complete
---

# Phase 03 Plan 01: Owned Loop — Anthropic Tracer Summary

**Derive runs its own `streamText` agent loop on an Anthropic API key: fourteen tutor tools dispatched from one place in `actions.ts`, prose streamed as growing `assistant` events, tool calls serialised per lesson, and one usage row per model request filed under the provider's own id.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-10-06T21:23:53Z
- **Completed:** 2026-10-06T21:38:07Z
- **Tasks:** 2 (one checkpoint, one tracer)
- **Files modified:** 9 (3 created, 6 modified)

## Accomplishments

- **Derive owns the loop.** `server/src/drivers/api.ts` is one `streamText` per turn: the abort handle is registered before the request, `fullStream` is mapped onto the existing `EventSink` with `agent.ts`'s growing-block machinery copied verbatim (block start, ~1500 ms checkpoint cadence, flush at end), and the turn ends through the same `isStopping` / `catch` / idempotent-`finally` discipline. No new event type, no reducer branch, no change to the terminal mirrors.
- **One tool dispatch map for every driver.** `TUTOR_TOOL_HANDLERS` and `runTool` moved into `actions.ts`; `agent.ts` `buildTools` now calls `actions.runTool` and its local `handlers` record is gone. The fourteen tools cannot drift between the Claude driver and the owned loop.
- **The adapter table.** `server/src/drivers/adapters.ts` is a `switch (provider)` with **no `default`**, so a catalogue row that gains no adapter fails to compile. `anthropic` is implemented (`createAnthropic` + `disableParallelToolUse`); every other row throws a lowercase sentence naming it.
- **The key cannot ride a redirect.** `noRedirectFetch` is passed as `fetch:` to the provider factory, calls global `fetch` with `redirect: 'manual'` and throws on any 3xx — the mitigation for T-03-01, matching `probe.ts` `getJson`'s posture.
- **The ledger names the provider.** `apiDriverFor(provider)` returns a `Driver` whose `name` is the catalogue `ProviderId`, so `turns.driver`, every denormalised `usage.driver` and the header pill read `anthropic` rather than a generic `api`.
- **One usage row per model request, with honest counts.** `finish-step` writes one row; `input_tokens` comes from `usage.inputTokenDetails.noCacheTokens`, not `usage.inputTokens`, so a cached lesson does not read as roughly twice the input it paid for. A count the provider did not give stays `null`.
- **The proof runs the real loop.** `server/test/api-driver.test.ts` hands a `MockLanguageModelV4` to the production `streamText` path through `setModelOverride`, with the real catalogue row, the real stored key and the real dispatch. No network, no key, four cases.
- **The anthropic catalogue row teaches** and its note says what it does instead of promising it next release.

## Task Commits

1. **Task 1: Confirm the six npm packages before they are installed** — checkpoint, no commit. Resolved by the human with "approved" before this executor started; the six versions were installed exactly as listed.
2. **Task 2: End-to-end "a lesson turn runs on an Anthropic API key through Derive's own loop"** — `fe61e93` (feat)

**Plan metadata:** the `docs(03-01): complete the owned-loop Anthropic tracer plan` commit carrying this file, STATE.md, ROADMAP.md and WINDOWS.md. Measured with `git rev-list --count 72eae23..HEAD`, the plan is two commits: one production, one metadata.

## Files Created/Modified

- `server/src/drivers/api.ts` (new, 283 lines) — the owned loop: `apiDriver`, `apiDriverFor`, `setModelOverride`, `modelOverride`, the per-lesson `serialise` chain, `usageOf`
- `server/src/drivers/adapters.ts` (new, 78 lines) — `Adapter`, `adapterFor`, `noRedirectFetch`
- `server/test/api-driver.test.ts` (new, 229 lines) — the stub-model suite
- `server/package.json` / `pnpm-lock.yaml` — the six AI SDK packages, pinned exactly
- `server/src/actions.ts` — `TUTOR_TOOL_HANDLERS`, `runTool`
- `server/src/agent.ts` — the third dispatch branch; `buildTools` through `runTool`; the local `handlers` record deleted
- `server/src/providers.ts` — the `anthropic` row flips to `teaches: true` with a real note
- `server/test/settings.test.ts` — the two catalogue assertions that recorded "only the two logins teach"

## Decisions Made

- **`apiDriver`'s name is a getter over `currentTutor().provider`.** The acceptance criteria ask for both `apiDriverFor` (what the dispatch uses) and a `Driver`-shaped `apiDriver`. A static `name` on the latter would have had to be either a hard-coded provider or the banned generic `api`; a getter keeps the invariant "`Driver.name` is always the catalogue id" true for every export without inventing a sixth label. The production dispatch never reads it.
- **The history is accumulated into the same `messages` array the request was built from.** `tool-call`, `tool-result` and `tool-error` parts are appended as `ModelMessage`s as they arrive, because `result.responseMessages` rejects after an abort — the one moment the history matters most. Plan 03-04 persists this array; plan 03-05's orphan patching appends to it.
- **The serialisation test was rewritten after it was seen passing with the mechanism removed.** The first version asserted the interleaving of `status` and `phase` events for two `set_phase` calls. Removing `serialise` left it green, because every tutor action is synchronous and so cannot interleave regardless — the assertion was not a gate. It was replaced with two `ask` cards, which block on the learner: without the chain both open before either is answered. Seen red with the chain removed, green with it restored.
- **`inputSchema: jsonSchema<Record<string, unknown>>(...)` carries an explicit type argument.** The acceptance criterion names `inputSchema: jsonSchema(`; the generic form is the one `03-RESEARCH.md`'s compiled skeleton uses and is what types `execute`'s `input` as `Record<string, unknown>` under `strict`. The substantive requirement — a pre-projected JSON Schema rather than a zod schema — holds.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `@ai-sdk/provider-utils` is not a direct dependency**

- **Found during:** Task 2 (step 3, the adapter table)
- **Issue:** The plan's `noRedirectFetch` is typed as `FetchFunction` from `@ai-sdk/provider-utils`. Under pnpm's strict `node_modules` that package is transitive, not declared, so the import failed to resolve.
- **Fix:** Typed the wrapper as `typeof globalThis.fetch`, which is exactly what `FetchFunction` is declared to be (`provider-utils/dist/index.d.ts:811`). No seventh dependency was added for a type alias.
- **Files modified:** `server/src/drivers/adapters.ts`
- **Verification:** `pnpm typecheck` clean; the `redirect: 'manual'` gate still passes
- **Committed in:** `fe61e93`

**2. [Rule 3 - Blocking] `Adapter.providerOptions` typed as `Record<string, unknown>` does not satisfy `streamText`**

- **Found during:** Task 2 (step 4, the loop)
- **Issue:** The plan's `providerOptions?: Record<string, unknown>` is not assignable to the SDK's `SharedV4ProviderOptions = Record<string, JSONObject>`; `unknown` is not a `JSONValue`.
- **Fix:** Narrowed to `Record<string, Record<string, JSONValue>>` using `ai`'s own `JSONValue`.
- **Files modified:** `server/src/drivers/adapters.ts`
- **Verification:** `pnpm typecheck` clean
- **Committed in:** `fe61e93`

**3. [Rule 1 - Bug] Two catalogue assertions recorded "only the two logins teach"**

- **Found during:** Task 2 (step 6, the catalogue flip)
- **Issue:** `server/test/settings.test.ts` asserted `['claude-code', 'codex']` for the teaching rows in two places — once over the HTTP settings view, once over `PROVIDERS` directly. Flipping `anthropic` to `teaches: true` is what this plan ships, so both assertions were describing the contract before it.
- **Fix:** Both updated to `['claude-code', 'codex', 'anthropic']`, the suite title changed from "only the two logins teach" to "only the wired rows teach", and a one-line comment added at the HTTP assertion saying the anthropic row joined when the owned loop shipped and that the other key rows flip with their own adapters. The assertions were not deleted or loosened.
- **Files modified:** `server/test/settings.test.ts`
- **Verification:** `pnpm test` — 284 tests, 284 pass, 0 fail
- **Committed in:** `fe61e93`

**4. [Rule 1 - Bug] The serialisation assertion was not a gate**

- **Found during:** Task 2 (step 7, the proof)
- **Issue:** The first version of "two tool calls execute one at a time" asserted the order of `status` / `phase` events for two `set_phase` calls. It passed with `serialise` removed, because every tutor action is synchronous and emits its event before yielding — so no interleaving was possible either way, and the test asserted nothing.
- **Fix:** Rewritten against two blocking `ask` tools, which is the property D-08 exists for: the test answers each card and asserts that no second card opened before the first was answered, with arrival order preserved. Seen failing (`a second card opened before the first was answered`) with the chain removed, and passing with it restored.
- **Files modified:** `server/test/api-driver.test.ts`
- **Verification:** red-then-green, both runs recorded above
- **Committed in:** `fe61e93`

---

**Total deviations:** 4 auto-fixed (2 blocking, 2 bugs)
**Impact on plan:** No scope change. Two were type corrections the plan's prose could not have known about without the installed packages; one was the catalogue flip's necessary consequence in the existing suite; one made the plan's own acceptance criterion honest rather than nominal.

## Known Stubs

None that return fake data. One deliberate, documented refusal:

| File | What | Why it is not a stub | Resolved by |
|---|---|---|---|
| `server/src/drivers/adapters.ts` | Nine of the ten `switch` arms throw a named lowercase sentence instead of returning an adapter | Those rows carry `teaches: false` in `providers.ts`, so the settings API refuses to activate them and the resolver ignores a stored id that does not teach — no learner can reach the throw. The `switch` has no `default`, so adding a catalogue row without an adapter is a compile error, not a runtime surprise. | Plan 03-03 (the four key rows and the base-URL row), Phase 4 (the three local rows); `claude-code` and `codex` throw permanently by design |

## Issues Encountered

- `pnpm test` failed twice after the catalogue flip, both in `server/test/settings.test.ts`. Both were the pre-flip contract recorded as assertions, and both were updated deliberately with the reason in the diff (deviation 3).
- The plan's `<human-check>` could not be run: no Anthropic key exists in this environment (`03-RESEARCH.md` §Environment Availability). It is carried into the phase UAT as D8 in the coverage block.

## User Setup Required

None — no external service configuration is required by this plan. The real-provider confirmation needs a learner's own Anthropic key, which is the human check, not a setup step.

## Next Phase Readiness

- Plan 03-03 inherits the adapter table and `noRedirectFetch`; adding a provider is one `switch` arm plus the catalogue flip.
- Plan 03-04 inherits the accumulated `messages` array in `api.ts` `runTurn` — that is the `ModelMessage[]` it persists as `turn_messages`.
- Plan 03-06's `verified` counter is initialised to 0 in the loop and already rides on the `turn_end` payload.
- Plan 03-07 widens `inputSchema`'s projection; the loop already passes a pre-projected JSON Schema, so nothing in the driver changes shape.
- Plan 03-08 fills `cost_usd` / `cost_source`, which this plan writes as `null` / `'unknown'` — the honest blank, never a zero.

**Open question carried forward:** the human check (one real Anthropic-key lesson to a locked node, streaming prose, a `Thinking` line with no reasoning in the record or the vault, and a clean Stop) is queued for the phase UAT.

## Self-Check: PASSED

- `server/src/drivers/api.ts` — FOUND (283 lines, min 150)
- `server/src/drivers/adapters.ts` — FOUND (78 lines, min 60)
- `server/test/api-driver.test.ts` — FOUND (229 lines, min 80)
- commit `fe61e93` — FOUND
- `git rev-list --count 72eae23..HEAD` → 2 (the production commit and this metadata commit)
- `pnpm method:check && pnpm typecheck && pnpm build && pnpm test` — all exit 0; 284 tests, 284 pass, 0 fail
- `server/test/wire-surface.json` — byte-identical (`git diff --quiet` exit 0)
- six exact pins present, no `^` or `~`; `pnpm-lock.yaml` committed in the same change
- `grep -c "redirect: 'manual'" server/src/drivers/adapters.ts` → 1
- no `process.env` read in either driver module; no `streamRetries`; no `name: 'api'`
- `grep -c 'const handlers' server/src/agent.ts` → 0; `runTool` present in all three files

---
*Phase: 03-owned-loop-api-keys-and-gateways*
*Completed: 2026-10-06*
