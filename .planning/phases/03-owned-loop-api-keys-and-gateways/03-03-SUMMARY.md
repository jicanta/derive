---
phase: 03-owned-loop-api-keys-and-gateways
plan: 03
subsystem: api
tags: [ai-sdk, openai, gemini, openrouter, openai-compatible, adapters, usage-ledger, cost]

# Dependency graph
requires:
  - phase: 03-owned-loop-api-keys-and-gateways
    provides: "plan 03-01's owned loop (server/src/drivers/api.ts), the exhaustive adapter table with no default clause, noRedirectFetch, and actions.runTool as the one tool dispatch"
  - phase: 03-owned-loop-api-keys-and-gateways
    provides: "plan 03-02's price and context-window table (pricing.ts), the learner override (prices.ts) and the one money function (cost.ts costOf)"
  - phase: 02-settings-and-secrets
    provides: "the provider catalogue, chooseModel, effectiveKey, baseUrlKey and normaliseBaseUrl, and probe.ts's per-provider request table"
provides:
  - "All five teaching adapter rows: anthropic, openai, gemini, openrouter and openai-compatible, each with its model factory, provider options, search hook and cost reader"
  - "Adapter.cost: the per-request cost read, per provider — OpenRouter's reported figure as `provider`, the table through cost.ts's costOf as `table`, a learner's own endpoint as `unknown`"
  - "searchCountOf: which provider-executed tool name the loop counts as one native search, declared beside the adapters"
  - "Adapter.search: the model-id-dependent native search hook, declared and returning null everywhere, for plan 03-06 to fill in"
  - "The loop refuses a turn whose model received a search tool instead of Derive's fourteen (the @ai-sdk/google tool-dropping warning)"
  - "Seven teaching catalogue rows: the two logins plus all five keys and gateways, with the OpenRouter default corrected to the dotted slug"
  - "server/test/api-driver.test.ts drives the real streamText loop once per teaching provider with a stub model, no network and no key"
affects: [03-04 turn_messages and resume, 03-06 web search and fetch, 03-07 dialect projection, 03-08 cost in the lesson header, 04 local models and the conformance harness]

actuals:
  tokens: 8382
  tasks: 2
  commits: 3
  plan_head_before: e25f7fea83782cb39317d15f1db1c30158e89198

tech-stack:
  added: []
  patterns:
    - "One adapter row per provider carries that provider's whole difference: model factory, provider options, search hook and cost reader — a limitation never narrows the other rows"
    - "A cost reader prices through cost.ts's costOf rather than re-implementing the arithmetic, so a request's figure cannot disagree with the lesson total printed beside it"
    - "A provider fact that the loop needs (which search tool to count) is exported from the adapter module, not inlined in the loop"
    - "A capability the model silently lost is a refusal, not a status line, when losing it means the tutor cannot teach"

key-files:
  created: []
  modified:
    - server/src/drivers/adapters.ts
    - server/src/drivers/api.ts
    - server/src/providers.ts
    - server/src/probe.ts
    - server/test/api-driver.test.ts
    - server/test/settings.test.ts

key-decisions:
  - "Adapter.cost takes a fourth parameter — the loop's count of provider-executed search tool calls — because the plan's own three-parameter type cannot express the plan's own fallback (`when the metadata count is absent, searches comes from the count the loop keeps`)"
  - "The table fallback prices through cost.ts's costOf with a synthesised ledger row rather than duplicating the per-token arithmetic in the adapter module"
  - "The search charge is folded into the request's own cost_usd (research option 1) because the usage table has no column for a per-call charge and adding one would give cost_source a second meaning"
  - "The catalogue has seven teaching rows, not the six the plan's gate asserted: the plan's arithmetic omitted one of the two logins"
  - "The openai-compatible row refuses with its own sentence when no model id is set, because it is the one teaching row the catalogue carries no default for and an empty id would come back as somebody else's 400"
  - "probe.ts's v1(base) is exported and reused rather than copied, so there is one answer to how a learner's base URL becomes a /v1 endpoint"

patterns-established:
  - "Pre-flip assertions are updated in place with a sentence saying why, never deleted: the two settings.test.ts teaching lists and the unwired-row example moved to a row that genuinely does not teach"
  - "Every new gate in this plan was seen failing with its mechanism removed before being kept (the refusal, the serialisation chain, the dotted slug)"

requirements-completed: [PROV-02, PROV-03, PROV-04, PROV-05, PROV-01]

coverage:
  - id: D1
    description: "A lesson runs through Derive's own loop on an OpenAI key, and the turn and every usage row name `openai`"
    requirement: PROV-02
    verification:
      - kind: integration
        ref: "server/test/api-driver.test.ts#files the turn and every usage row on openai under that provider's own id"
        status: pass
    human_judgment: true
    rationale: "The loop, the dispatch, the catalogue row and the ledger are proven with a stub model; that a real OpenAI key teaches to a locked node needs a key, and none exists in this environment (03-RESEARCH.md §Environment Availability)"
  - id: D2
    description: "A lesson runs through Derive's own loop on a Google Gemini key, and the turn and every usage row name `gemini`"
    requirement: PROV-03
    verification:
      - kind: integration
        ref: "server/test/api-driver.test.ts#files the turn and every usage row on gemini under that provider's own id"
        status: pass
    human_judgment: true
    rationale: "Same as D1, plus the one thing only a real key can show: that the graph is actually drawn rather than the model talking with its function declarations silently discarded"
  - id: D3
    description: "A lesson runs through OpenRouter and its per-response cost is recorded with cost_source `provider`; its absence falls back to a table figure, never a blank"
    requirement: PROV-04
    verification:
      - kind: integration
        ref: "server/test/api-driver.test.ts#records OpenRouter's own per-response cost as billed"
        status: pass
      - kind: integration
        ref: "server/test/api-driver.test.ts#falls back to a table figure, never to a blank, when OpenRouter reports no cost"
        status: pass
      - kind: other
        ref: "grep -c \"usage: { include: true }\" server/src/drivers/adapters.ts → 2 (model settings and per-call provider options)"
        status: pass
    human_judgment: true
    rationale: "Derive's read of providerMetadata.openrouter.usage.cost and its fallback are both proven by the stub pair; that OpenRouter emits the figure on a real streaming request is the vendor's behaviour and is a backstop truth in the plan"
  - id: D4
    description: "A lesson runs against any OpenAI-compatible endpoint on a learner-supplied base URL, with usage asked for and an honest blank when none is given"
    requirement: PROV-05
    verification:
      - kind: integration
        ref: "server/test/api-driver.test.ts#leaves an honest blank, and still leaves a row, when an endpoint reports nothing at all"
        status: pass
      - kind: other
        ref: "grep -c 'includeUsage: true' server/src/drivers/adapters.ts → 1"
        status: pass
    human_judgment: true
    rationale: "The row, the refusals and the honest blank are proven without a network; that a learner's real endpoint answers needs that endpoint"
  - id: D5
    description: "Two tool calls arriving in one step execute one at a time in arrival order on every provider, including the one with no provider flag"
    verification:
      - kind: integration
        ref: "server/test/api-driver.test.ts#runs two same-step tool calls one at a time, in arrival order, on gemini"
        status: pass
      - kind: integration
        ref: "server/test/api-driver.test.ts#runs two tool calls from one step strictly one at a time, in arrival order (03-01's anthropic case, still green)"
        status: pass
    human_judgment: false
  - id: D6
    description: "A model that received a search tool instead of Derive's fourteen is refused with Derive's own sentence, and no prose from it is persisted"
    verification:
      - kind: integration
        ref: "server/test/api-driver.test.ts#ends the turn with derive’s own sentence when the search tool displaced all fourteen"
        status: pass
    human_judgment: false
  - id: D7
    description: "A Stop during a turn on a base-URL endpoint ends the turn exactly once, as interrupted rather than as an error"
    verification:
      - kind: integration
        ref: "server/test/api-driver.test.ts#records one turn_end carrying interrupted rather than an error"
        status: pass
    human_judgment: false
  - id: D8
    description: "Every teaching catalogue row carries a model id its provider will serve, and the OpenRouter default is a slug OpenRouter actually lists"
    verification:
      - kind: unit
        ref: "server/test/settings.test.ts#gives every teaching row a model id its provider will actually serve"
        status: pass
      - kind: other
        ref: "node -e catalogue gate: 7 teaching rows, dotted OpenRouter slug, no flipped row still calling unwired("
        status: pass
    human_judgment: false
  - id: D9
    description: "The Claude Code row still teaches on the Claude Code login through the Agent SDK; only its note changed"
    verification:
      - kind: unit
        ref: "server/test/settings.test.ts#lists ten providers in a fixed order, and only the wired rows teach (claude-code first in the teaching list)"
        status: pass
      - kind: other
        ref: "git diff e25f7fe..HEAD -- server/src/agent.ts → empty (the Claude dispatch branch is untouched)"
        status: pass
    human_judgment: false
  - id: D10
    description: "Every provider's key travels only in that provider's own header, only to its catalogue host or the learner's stored base URL, and never on a redirect"
    verification:
      - kind: other
        ref: "grep -c noRedirectFetch server/src/drivers/adapters.ts → 6 (one definition plus one per teaching factory)"
        status: pass
    human_judgment: true
    rationale: "The grep proves the wrapper is wired into all five factories; that a real provider 3xx is refused in practice needs a provider that issues one"

# Metrics
duration: 39 min
completed: 2026-10-06
status: complete
---

# Phase 03 Plan 03: Four More Providers Through the One Owned Loop Summary

**OpenAI on the Responses API, Google Gemini, OpenRouter with usage accounting on, and any OpenAI-compatible endpoint on a learner-supplied base URL all teach through the same `streamText` loop and the same fourteen tools — each with its own cost reader, the OpenRouter slug corrected, and a refusal rather than a silently tool-less Gemini lesson.**

## Performance

- **Duration:** 39 min
- **Started:** 2026-10-06T22:12:39Z
- **Completed:** 2026-10-06T22:51:50Z
- **Tasks:** 2
- **Files modified:** 6 (0 created, 6 modified)

## Accomplishments

- **Five teaching adapter rows instead of one.** `openai` builds on the Responses API with `parallelToolCalls: false` and `store: false`; `gemini` builds with no parallel-tool option at all, because `@ai-sdk/google` has none, which is why the loop's per-lesson mutex is load-bearing there; `openrouter` asks for usage accounting on both the model settings and the per-call provider options; `openai-compatible` is constructed with `includeUsage: true` against the base URL the settings page normalised and stored. All five pass `noRedirectFetch` as their `fetch`, so a learner's key cannot ride a 3xx to a host the catalogue never named.
- **Every row reads its own cost.** OpenRouter's `providerMetadata.openrouter.usage.cost` is read defensively (the streaming path types provider metadata as `Record<string, JSONObject>`) and recorded as `cost_source: 'provider'`; anything else prices through `cost.ts`'s `costOf` against `priceTable()` as `'table'`; a learner's own endpoint stays `'unknown'` with no money, because guessing a rate for a model that is not in the table is the one thing the four-word label vocabulary exists to prevent.
- **A dropped capability that means the tutor cannot teach is now a refusal.** `@ai-sdk/google`'s `prepareTools` discards all fourteen function declarations when a provider-defined tool is present on a model it does not treat as Gemini 3, pushing one `unsupported` warning and nothing else. The loop ends such a turn `ok: false` with `this model cannot use derive's tools and a web search tool together; pick a newer model, or set web search to tavily or searxng in settings`, and persists no prose from it.
- **The catalogue now teaches on seven rows.** The four key-and-gateway rows flip to `teaches: true` with notes saying what they do; the OpenRouter default becomes `anthropic/claude-opus-5.5`, the dotted slug OpenRouter actually serves (the dashed native-Anthropic spelling is absent from its model list); the Claude Code note stops promising that an API key takes over next release and points in-app Claude at the Anthropic row. The three local rows stay `teaches: false` with their `unwired()` notes, so `teaches`'s doc comment is still literally true.
- **The real loop is now driven once per teaching provider, with no network and no key.** `server/test/api-driver.test.ts` grew from 4 cases to 15: a table-driven pass over all five ids asserting the turn row and every usage row carry that provider's own catalogue id, the OpenRouter `provider`/`table` pair, the honest blank on an endpoint that reports nothing, the serialisation proof on the provider with no flag, the refusal, and a Stop that ends the turn exactly once as interrupted. The suite names no real provider host.
- **Every new gate was seen failing before it was kept.** The refusal (with the condition short-circuited), the serialisation chain (with the per-lesson chain removed), and the dotted slug (with the dashed form restored) each went red and then green.

## Task Commits

1. **Task 1: Four more adapter rows and four more catalogue rows that teach** — `8c9271c` (feat)
2. **Task 2: The stub-model suite drives the real loop once per provider, and the catalogue is asserted** — `c7258a6` (test)

**Plan metadata:** the `docs(03-03): …` commit carrying this file, STATE.md, ROADMAP.md and REQUIREMENTS.md.

`git rev-list --count e25f7fe..HEAD` measures **3** commits for this plan: the two above plus this metadata commit.

## Files Created/Modified

- `server/src/drivers/adapters.ts` (78 → 287 lines) — the four new rows, `CostRead`, `Adapter.cost`, `Adapter.search`, `tableCost` and `searchCountOf`
- `server/src/drivers/api.ts` (283 → 329 lines) — the finish-step row takes its money from the adapter; the per-step native-search count; the unsupported-combination refusal
- `server/src/providers.ts` — four rows flipped, the OpenRouter slug corrected, two notes rewritten
- `server/src/probe.ts` — `v1(base)` exported so the adapter joins a learner's base URL the one existing way
- `server/test/api-driver.test.ts` (229 → 510 lines) — the provider table, the cost trio, the gemini serialisation case, the refusal, the Stop
- `server/test/settings.test.ts` — the two pre-flip teaching lists and the unwired-row example updated with the reason; the new teaching-default assertion

## Decisions Made

- **`Adapter.cost` takes four parameters, not the three the plan's type named.** The plan's own step 6 says that when Anthropic's metadata carries no search count, "`searches` comes from the count the loop keeps of provider-executed search `tool-call` parts" — which a three-parameter reader cannot see. The loop keeps the count (`searchCountOf` names the tool), passes it in, and the reader prefers the provider's own figure when there is one. The alternative within three parameters would have been to fold the search charge in `api.ts`, i.e. a second copy of the money arithmetic in the driver.
- **The table fallback prices through `cost.ts`'s `costOf`.** The adapter shapes the request into the ledger row it is about to become (identity columns blank — `costOf` reads only `driver`, `model`, the five counts and `searches`) and asks the one function the lesson header already totals with. Re-implementing the per-token arithmetic in the adapter module would be the second copy that makes a request's figure disagree with the total printed beside it. It also inherits `cost.ts`'s rules for free: a model the table does not carry comes back `unknown` with no money, and a request with four null counts contributes nothing rather than reading as free.
- **Seven teaching rows, not six.** The plan's gate script and acceptance criterion both said six; the four flips plus the three rows that already taught (`claude-code`, `codex`, `anthropic`) is seven. The gate was run with seven and the plan's own instruction to keep `claude-code` teaching was followed.
- **`openai-compatible` refuses rather than sending an empty model id.** It is the only teaching row the catalogue carries no `defaultModel` for, by design — only the learner knows what their endpoint serves. Without a refusal the loop would send `''` as the model and the learner would read somebody else's 400. The sentence (`Choose a model for the endpoint first`) is in the same voice as `probe.ts`'s existing `Add the endpoint's base URL first`.
- **`probe.ts`'s `v1(base)` is exported rather than copied.** The plan asked for the existing helper rather than a second normaliser; the helper was module-private, so a one-word export was the smaller change than duplicating the rule.
- **The unwired example in `settings.test.ts` moved to Ollama.** The case that proves a non-teaching row cannot be activated used `openai`, which now teaches. Rather than delete the case it was pointed at a row that genuinely has no adapter yet.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `Adapter.cost`'s declared three-parameter type cannot express the plan's own fallback**

- **Found during:** Task 1 (step 1 and step 6)
- **Issue:** Step 1 declares `cost: (pm, usage, model) => …`; step 6 requires the Anthropic reader to fall back to "the count the loop keeps of provider-executed search `tool-call` parts" when the metadata count is absent. With three parameters the reader cannot see that count, and the `usage` table has no column to carry it onward.
- **Fix:** A fourth parameter, `searches: number | null`, supplied by the loop (which counts `tool-call` parts whose `providerExecuted` is true and whose `toolName` matches `searchCountOf(provider)`, reset at each `finish-step`). The reader prefers the provider's own figure and falls back to the loop's. The charge is folded into that request's `cost_usd` through `costOf`'s own `searches` term, which is research option (1) and `cost.ts`'s already-shipped `CostRow.searches`.
- **Files modified:** `server/src/drivers/adapters.ts`, `server/src/drivers/api.ts`
- **Verification:** `pnpm typecheck` clean; `pnpm test` 329/329; `server/test/cost.test.ts`'s existing search-charge cases unchanged
- **Committed in:** `8c9271c`

**2. [Rule 1 - Bug] The plan's catalogue gate asserted six teaching rows where the plan's own instructions produce seven**

- **Found during:** Task 1 (step 8)
- **Issue:** The verify script threw unless `providers.ts` contained exactly six `teaches: true` lines. The plan flips four rows and explicitly keeps `claude-code`, `codex` and `anthropic` teaching — seven.
- **Fix:** The gate was run with `7`. No catalogue row was changed to satisfy the wrong number; in particular `claude-code` was not demoted, which the plan forbids in the same step.
- **Files modified:** none (a gate-script arithmetic correction)
- **Verification:** `node -e` catalogue gate prints `catalogue ok` at seven; `settings.test.ts` asserts the seven ids by name in catalogue order
- **Committed in:** `8c9271c`

**3. [Rule 2 - Missing Critical] The base-URL row would have sent an empty model id**

- **Found during:** Task 2 (step 8, writing the teaching-default assertion)
- **Issue:** The plan's assertion requires every `teaches: true` row to have a non-empty `defaultModel` or be one of the two login rows. `openai-compatible` teaches and has `defaultModel: null`, correctly — the catalogue cannot know what a learner's endpoint serves. But the adapter passed `modelId ?? ''` straight to the factory, so a learner who entered a base URL and a key but no model would get an opaque provider error.
- **Fix:** The row throws `Choose a model for the endpoint first` when no model id is resolved, matching the base-URL refusal beside it. The settings assertion then exempts `openai-compatible` alongside the two logins, asserting its `defaultModel` is `null` and saying in a comment why the adapter, not the catalogue, answers for it.
- **Files modified:** `server/src/drivers/adapters.ts`, `server/test/settings.test.ts`
- **Verification:** `pnpm typecheck`; `pnpm test` 329/329
- **Committed in:** `c7258a6`

**4. [Rule 3 - Blocking] `probe.ts`'s `v1(base)` was module-private**

- **Found during:** Task 1 (step 5)
- **Issue:** The plan says to append `/v1` "the way `probe.ts`'s `v1(base)` helper does rather than writing a second normaliser", but the helper is not exported, and `probe.ts` is not in the plan's `files_modified`.
- **Fix:** Exported it with a sentence saying why, and imported it in the adapter. One rule, one answer.
- **Files modified:** `server/src/probe.ts`, `server/src/drivers/adapters.ts`
- **Verification:** `pnpm typecheck`; `settings.test.ts`'s existing `requestFor` cases over the OpenAI-compatible row unchanged and green
- **Committed in:** `8c9271c`

**5. [Rule 1 - Bug] Three existing suites recorded the pre-flip catalogue as assertions**

- **Found during:** Task 1 (step 8) — 11 failing cases
- **Issue:** `settings.test.ts` asserted the teaching list was `['claude-code', 'codex', 'anthropic']` in two places, used `openai` as its example of a row that cannot be activated (which cascaded into eight further failures, because the write now succeeded and changed the active provider), and asserted the dashed OpenRouter default. `api-driver.test.ts` asserted `cost_source: 'unknown'` with a null cost for an Anthropic turn, which is exactly what this plan replaces.
- **Fix:** Every one updated in place with a sentence saying why, none deleted or loosened. The unwired example moved to `ollama`; the teaching lists name all seven ids; the OpenRouter assertion carries the dotted-versus-dashed reason; the Anthropic usage row now asserts `table` with a positive figure.
- **Files modified:** `server/test/settings.test.ts`, `server/test/api-driver.test.ts`
- **Verification:** `pnpm test` 317/317 at the end of Task 1, 329/329 at the end of Task 2
- **Committed in:** `8c9271c`

**6. [Rule 2 - Missing Critical] A stub that reports no usage at all would have thrown**

- **Found during:** Task 2 (step 3)
- **Issue:** `usageOf` read `u.inputTokenDetails.noCacheTokens` unguarded. An endpoint — or a stub standing in for one — that reports no usage object leaves those details undefined, and the loop would have thrown inside the stream instead of writing the honest blank the ledger invariant requires.
- **Fix:** Optional chaining on both detail objects in `usageOf` and in `tableCost`, so an absent object produces nulls through the existing `reported()` guard.
- **Files modified:** `server/src/drivers/api.ts`, `server/src/drivers/adapters.ts`
- **Verification:** the `openai-compatible` honest-blank case asserts all five token columns null, `cost_source: 'unknown'`, and that the row still exists
- **Committed in:** `8c9271c` (the guard) and `c7258a6` (the case)

---

**Total deviations:** 6 auto-fixed (2 blocking, 2 bugs, 2 missing critical)
**Impact on plan:** No scope change. Two were corrections to the plan's own arithmetic and type (deviations 1 and 2) where the plan's prose and its gate disagreed; two closed holes the plan's own assertions pointed at (3 and 6); one was the catalogue flip's necessary consequence in the existing suite (5); one was a one-word export the plan's "rather than writing a second normaliser" instruction required (4).

## Known Stubs

No stub returns fake data to a learner. Two deliberate, documented placeholders:

| File | What | Why it is not a stub | Resolved by |
|---|---|---|---|
| `server/src/drivers/adapters.ts` | every row's `search` member returns `null` | No native search tool is offered to any provider in this release, so nothing silently degrades: the loop simply never sends one, and the Gemini row's comment records the exact condition (`usesGemini3Features`) and the exact warning that plan 03-06 has to decide on. The refusal in `api.ts` is already in place for the day a tool does get offered. | Plan 03-06 |
| `server/src/drivers/adapters.ts` | five of the ten `switch` arms still throw a named sentence | Those rows carry `teaches: false`, so the settings API refuses to activate them and the resolver ignores a stored id that does not teach. The `switch` has no fallthrough clause, so a new catalogue row without an adapter is a compile error. | Phase 4 (the three local rows); `claude-code` and `codex` throw permanently by design |

Both are recorded in `.planning/WINDOWS.md` only as far as the unrun human check goes (entry 15); neither placeholder blocks this plan's goal, which is that five providers teach through one loop.

## Issues Encountered

- `pnpm test` failed 11 cases after the catalogue flip, all of them the pre-flip contract recorded as assertions. Every one was updated deliberately with the reason in the diff (deviation 5).
- The plan's `<human-check>` could not be run: no OpenAI, Gemini or OpenRouter key and no OpenAI-compatible endpoint exist in this environment (`03-RESEARCH.md` §Environment Availability). It is recorded in `.planning/WINDOWS.md` as an open `unrun-verify` (entry 15) and carried into the phase UAT as D1–D4 and D10 in the coverage block.
- `git commit` was refused twice by the `block-no-verify` pre-tool hook on commands that contained no such flag; the identical command succeeded when issued alone. Noted as a harness quirk, not a repo issue — no commit was made with `--no-verify`.

## User Setup Required

None — no external service configuration is required by this plan. The real-provider confirmation needs a learner's own keys, which is the human check, not a setup step.

## Next Phase Readiness

- Plan 03-04 inherits the same accumulated `messages` array; nothing in this plan changed its shape.
- Plan 03-06 inherits `Adapter.search` with the Gemini condition written at the line that has to implement it, the `searchCountOf` counting rule, the refusal already wired into `start-step`, and the search charge already folded into `cost_usd` through `costOf` — so supplying a real count is the only work left.
- Plan 03-07 widens the projection handed to `inputSchema`; no adapter row sets `strict: true`, and the OpenAI row carries the sentence saying why, so the strict dialect stays a measurable choice rather than a silent default.
- Plan 03-08 can read `cost_usd` and `cost_source` straight off the ledger for every provider: `provider` on OpenRouter, `table` on the three with rates, `unknown` on a learner's own endpoint.
- Phase 4's conformance harness is what finally *measures* PROV-08 parity; this plan asserts it structurally (one registry, one method text, one event vocabulary, one driver per provider id) and claims nothing more.

**Open question carried forward:** one real lesson on each of OpenAI, Gemini, OpenRouter and a base-URL endpoint, plus a Stop-and-resume on one of them, is queued for the phase UAT.

## Self-Check: PASSED

- `server/src/drivers/adapters.ts` — FOUND (287 lines), implements all five teaching rows
- `server/src/drivers/api.ts` — FOUND (329 lines)
- `server/src/providers.ts` — FOUND, 7 `teaches: true`, OpenRouter default `anthropic/claude-opus-5.5`, no flipped row calls `unwired(`
- `server/test/api-driver.test.ts` — FOUND (510 lines), 15 cases, names all five providers, names no real provider host
- `server/test/settings.test.ts` — FOUND (1229 lines), 80 cases
- commit `8c9271c` — FOUND; commit `c7258a6` — FOUND
- `git rev-list --count e25f7fea83782cb39317d15f1db1c30158e89198..HEAD` → 3 (two production, one metadata)
- `pnpm method:check && pnpm typecheck && pnpm build && pnpm test` — all exit 0; 329 tests, 329 pass, 0 fail
- static gates: `grep -c 'default:' adapters.ts` → 0; `grep -c noRedirectFetch` → 6; `grep -c 'includeUsage: true'` → 1; `grep -c 'usage: { include: true }'` → 2; `strict: true` in code (comments stripped) → 0; `grep -c cost_source api-driver.test.ts` → 4
- red-then-green recorded for the refusal, the serialisation chain and the dotted slug

---
*Phase: 03-owned-loop-api-keys-and-gateways*
*Completed: 2026-10-06*
