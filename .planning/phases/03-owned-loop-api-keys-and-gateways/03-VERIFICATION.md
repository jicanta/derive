---
phase: 03-owned-loop-api-keys-and-gateways
verified: 2026-10-12T21:30:00Z
status: human_needed
score: 3/5 success criteria fully verified (7/9 clauses); 2 criteria present-but-behaviour-unverified on their live-key half
covered_files:
  - .env.example
  - .planning/REQUIREMENTS.md
  - .planning/ROADMAP.md
  - .planning/phases/03-owned-loop-api-keys-and-gateways/03-01-PLAN.md
  - .planning/phases/03-owned-loop-api-keys-and-gateways/03-01-SUMMARY.md
  - .planning/phases/03-owned-loop-api-keys-and-gateways/03-02-PLAN.md
  - .planning/phases/03-owned-loop-api-keys-and-gateways/03-02-SUMMARY.md
  - .planning/phases/03-owned-loop-api-keys-and-gateways/03-03-PLAN.md
  - .planning/phases/03-owned-loop-api-keys-and-gateways/03-03-SUMMARY.md
  - .planning/phases/03-owned-loop-api-keys-and-gateways/03-04-PLAN.md
  - .planning/phases/03-owned-loop-api-keys-and-gateways/03-04-SUMMARY.md
  - .planning/phases/03-owned-loop-api-keys-and-gateways/03-05-PLAN.md
  - .planning/phases/03-owned-loop-api-keys-and-gateways/03-05-SUMMARY.md
  - .planning/phases/03-owned-loop-api-keys-and-gateways/03-06-PLAN.md
  - .planning/phases/03-owned-loop-api-keys-and-gateways/03-06-SUMMARY.md
  - .planning/phases/03-owned-loop-api-keys-and-gateways/03-07-PLAN.md
  - .planning/phases/03-owned-loop-api-keys-and-gateways/03-07-SUMMARY.md
  - .planning/phases/03-owned-loop-api-keys-and-gateways/03-08-PLAN.md
  - .planning/phases/03-owned-loop-api-keys-and-gateways/03-08-SUMMARY.md
  - .planning/phases/03-owned-loop-api-keys-and-gateways/03-09-PLAN.md
  - .planning/phases/03-owned-loop-api-keys-and-gateways/03-09-SUMMARY.md
  - scripts/doctor.mjs
  - server/package.json
  - server/src/actions.ts
  - server/src/agent.ts
  - server/src/config.ts
  - server/src/context.ts
  - server/src/cost.ts
  - server/src/db.ts
  - server/src/driver.ts
  - server/src/drivers/adapters.ts
  - server/src/drivers/api.ts
  - server/src/index.ts
  - server/src/library.ts
  - server/src/migrations.ts
  - server/src/prices.ts
  - server/src/pricing.ts
  - server/src/probe.ts
  - server/src/prompt.ts
  - server/src/providers.ts
  - server/src/search.ts
  - server/src/settings.ts
  - server/src/tools.ts
  - server/test/api-driver.test.ts
  - server/test/api.test.ts
  - server/test/cost.test.ts
  - server/test/mcp.test.ts
  - server/test/migrations.test.ts
  - server/test/search.test.ts
  - server/test/settings.test.ts
  - server/test/spawn.ts
  - server/test/tx.test.ts
  - server/test/usage.test.ts
  - server/test/wire-surface.json
  - server/test/wire-surface.test.ts
  - web/src/components/ProviderRow.tsx
  - web/src/components/WebSearchCard.tsx
  - web/src/components/fields.ts
  - web/src/lib/api.ts
  - web/src/lib/types.ts
  - web/src/pages/Home.tsx
  - web/src/pages/Lesson.tsx
  - web/src/pages/Settings.tsx
  - web/src/pages/You.tsx
covered_digest: "v1:sha256:1ace33a92963b9ff3e2f76bab27ecfca184009441e550e85608753a47e2eadba"
behavior_unverified: 2
insufficient_spec: 10
overrides_applied: 0
prohibitions:
  total: 22
  verified: 22
  flagged: 0
  tier: judgment
  disposition: "NON-AUTHORITATIVE LLM verdict: all 22 hold against the codebase at HEAD. Autonomous verification — human review recommended at the phase checkpoint. No prohibition was silently passed; each is evidenced in the Prohibitions section below."
behavior_unverified_items:
  - truth: "Success Criterion 1, live-key half: a learner completes a lesson (graph, warm-up, node teaching, understanding gate, lock, cumulative quiz) on a real Anthropic, OpenAI and Gemini key with the same tools and method as the Claude Code path"
    test: "Put a real key in Settings for each of anthropic, openai and gemini, press `Use this provider`, and take one whole lesson per provider: graph drawn, warm-up if nodes are due, a node taught, the gate passed on a fresh question, the node locked, a cumulative quiz reached. Confirm the header pill names the provider. On Gemini confirm set_plan actually draws the graph (a lesson that talks but never plans is the tool-dropping failure)."
    expected: "Each provider completes the same six stages. The pill reads `<provider> · <model> · about $X.XX estimated|billed`. Gemini draws a graph rather than returning a 400 naming a schema field."
    why_human: "No provider API key and no provider network reachability exist in this environment. The owned loop is proven end-to-end against a stub LanguageModel over the app's real HTTP routes (server/test/api.test.ts), and each of the five teaching rows is driven through the one loop with a stub (server/test/api-driver.test.ts). Neither proves the vendor's own acceptance of the request, nor the warm-up and cumulative-quiz stages through the owned loop specifically — those two stages are exercised today through the shared actions.ts dispatch on the external HTTP surface only."
  - truth: "Success Criterion 2, live-key half: a learner completes a lesson through OpenRouter with exact per-response cost recorded, and through a base URL plus key endpoint entered in Settings"
    test: "With a real OpenRouter key, take a lesson, then read `sqlite3 ~/.derive/derive.db \"select driver, model, cost_source, cost_usd from usage order by id desc limit 5;\"`. Then enter any OpenAI-compatible base URL plus key in Settings and take a lesson as far as one locked node."
    expected: "The OpenRouter rows read `cost_source` = `provider` with a non-null `cost_usd`, and the lesson's pill reads `billed`. The base-URL lesson completes; its cost reads `not reported` if the endpoint sends no usage."
    why_human: "Reading `providerMetadata.openrouter.usage.cost` is proven against a stub that emits it (api-driver.test.ts 'records OpenRouter's own per-response cost as billed'); that OpenRouter actually emits it on a real streaming request when `usage: { include: true }` is sent is a vendor behaviour this environment cannot observe. Same for an endpoint the learner names."
insufficient_spec_items:
  - truth: "The shipped per-token rates match each vendor's own first-party list price for the models in the table on the day recorded in PRICES_AS_OF (03-02, verification: backstop)"
    why_human: "An external fact about five vendors' price pages on 2026-10-06. No code or test can establish it."
  - truth: "OpenRouter populates providerMetadata.openrouter.usage.cost on a real streaming request when usage: { include: true } is sent (03-03, backstop)"
    why_human: "Vendor emission, not Derive's read. Covered by behaviour-unverified item 2."
  - truth: "Anthropic populates server_tool_use.web_search_requests inside message_delta.usage on a streaming request (03-03, backstop)"
    why_human: "Vendor emission. The loop's own providerExecuted tool-call count stands behind it, so the ledger stays correct either way."
  - truth: "A free-tier Gemini or OpenRouter rate limit is survived within the two-minute retry window on a real key, with the countdown visible and Stop responsive throughout (03-05, backstop)"
    why_human: "Needs a real provider to rate-limit. The Derive side is driven in-process against a synthesized 429 APICallError, including the Stop-mid-backoff case."
  - truth: "Anthropic's, OpenAI's and Gemini's native search tools execute server-side alongside the 14 Derive function tools on a real key, and their per-call charge reaches the usage ledger (03-06, backstop)"
    why_human: "Provider-side execution. Derive registers exactly one search source per turn and counts it; what the vendor does with it is unobservable here."
  - truth: "Gemini accepts the projected set_plan schema on a real key, confirming the rejected-keyword set the projection assumes (03-07, backstop)"
    why_human: "03-RESEARCH A3 is LOW confidence because Google's Schema reference would not render. One real Gemini lesson that draws its graph settles it."
  - truth: "At 1024px and 1280px with a ~60-character model id the cost segment in the header pill is fully visible and the model id is what ellipsises; at 375px nothing wraps or overflows the h-[60px] header (03-08, backstop)"
    why_human: "Rendered layout. Verified statically: the model span carries min-w-0 max-w-[40ch] truncate and the cost span shrink-0 whitespace-nowrap; the pill is hidden below md by design."
  - truth: "At 640px and 1280px a Home lesson row with a long topic plus the cost plus the locked count keeps the numbers on one line and truncates the topic (03-08, backstop)"
    why_human: "Rendered layout. Verified statically: grid-cols-[34px_minmax(0,1fr)_auto] with the topic Link as the only min-w-0 column."
  - truth: "A real Anthropic lesson's second and later requests report a non-zero cache_read_tokens (03-08, backstop)"
    why_human: "Anthropic's own cache. Derive's side — two system messages, stable first, the breakpoint only on the stable half, byte-identical across requests — is driven by four named tests."
  - truth: "A 120-character base URL and a long key hint neither widen the web-search card nor push Settings into horizontal scroll at 375px and 1280px (03-09, backstop)"
    why_human: "Rendered layout. Verified statically against the shared field classes in web/src/components/fields.ts."
deferred:
  - truth: "PROV-09's third named fallback search backend, 'Ollama search', is absent: SEARCH_PROVIDERS carries only provider, tavily, searxng"
    addressed_in: "Phase 4"
    evidence: "deferred-items.md: Ollama's catalogue row does not teach until Phase 4 (PROV-06), so an Ollama-search backend today would be a code path no provider can reach. The seam is SEARCH_PROVIDERS in server/src/search.ts, one entry plus one function. ROADMAP Success Criterion 4 names only Tavily and SearXNG, both of which ship."
  - truth: "web/src/pages/You.tsx:18 still declares its own `const field`, a fourth copy of the input class web/src/components/fields.ts now owns"
    addressed_in: "a later plan that touches /you"
    evidence: "deferred-items.md: You.tsx is not in 03-09's files_modified and its string differs by `disabled:opacity-60`, so lifting it would change what /you renders for a disabled input."
human_verification:
  - test: "Complete a whole lesson on each of a real Anthropic, OpenAI and Gemini key: graph, warm-up, node teaching, understanding gate, lock, cumulative quiz. Confirm the pill names the provider and that Gemini draws its graph."
    expected: "All six stages complete on all three providers with the same tools and method text as the Claude Code path."
    why_human: "No provider key and no provider network in this environment (WINDOWS.md 14, 15, 19, 20, 23)."
  - test: "Complete a lesson through OpenRouter, then read the usage table. Complete a lesson through a base URL plus key endpoint entered in Settings."
    expected: "OpenRouter rows carry cost_source=provider with a non-null cost_usd and the pill reads `billed`; the base-URL lesson completes and reads `not reported` if the endpoint sends no usage."
    why_human: "Needs a real gateway key and a real endpoint (WINDOWS.md 15, 23)."
  - test: "On a real key, press Stop mid-sentence then send another message; press Stop while a card is opening, then send another message and compare `select count(*) from quiz_results where lesson_id='<id>'` before and after; switch the provider mid-lesson and send another message."
    expected: "Each resume continues without a provider error about an unknown message part; the quiz_results count is unchanged by the mid-card Stop."
    why_human: "The invariants are driven in-process against a stub (orphan patch, replay-by-call-id, provider-change drop), but a real provider's acceptance of the patched history is unobserved (WINDOWS.md 16)."
  - test: "On a free-tier Gemini or OpenRouter key, drive a lesson into a rate limit. Watch the status line, press Stop during the countdown, reload the page, and check the Obsidian note. Then try a deliberately wrong key."
    expected: "`Provider busy, retrying in Ns` counts down by whole seconds and the lesson carries on; Stop ends the turn immediately; the countdown is absent from the note and from the reload; a wrong key fails immediately in the provider's own sentence with Derive's hint on a second line."
    why_human: "Needs a provider that will actually rate-limit (WINDOWS.md 17)."
  - test: "On Anthropic, OpenAI or Gemini ask the tutor to check a fact, then give it a URL to read. On OpenRouter with no search configured ask about a fact outside the model's confident knowledge, then configure a Tavily key and repeat. If you run SearXNG with the JSON format off, press `test search`."
    expected: "`Verifying with a web search` and `Reading a source` appear and the `facts verified on the web` footer rises; the no-search provider admits uncertainty rather than asserting; the Tavily search happens; the SearXNG sentence names settings.yml."
    why_human: "Native search executes provider-side and needs a key; the SearXNG case needs a real instance with json off (WINDOWS.md 18, 24)."
  - test: "Run `pnpm build && pnpm start` and walk 03-08's seven visual checks (A1 populated/empty/loading/overflow, A2 populated/empty/overflow, A1 partial) and 03-09's eight (A3 empty/populated/loading/error/partial/long-text, destructive remove-then-keep, A4 prices sentence and its unreadable-file variant)."
    expected: "As written in each plan's human-check block."
    why_human: "Rendered layout, focus behaviour and the 1800ms save tick. Note from MEMORY: Tailwind v4 gates hover: behind @media (hover:hover), which no headless Chrome mode satisfies — the hover feedback on the card's text buttons must be checked in a real browser (WINDOWS.md 21, 25)."
  - test: "Run one lesson through the Claude Code plugin and one through the Codex skills."
    expected: "Both still work unchanged after this phase."
    why_human: "Needs two terminals with real logins (WINDOWS.md 23). The wire surface is frozen in server/test/wire-surface.json and the plugin's 22-tool MCP set and the agent surface's 14 are byte-unchanged (verified: toolsFor('mcp')=22, DERIVE_TOOL_NAMES=14, toolsFor('api')=16), but no lesson was run."
  - test: "Decide PROV-08's marking in .planning/REQUIREMENTS.md."
    expected: "Either flip PROV-08 to Complete on the strength of the stub-model parity proof, or leave it Pending until the live-key parity run above closes, and say which in the requirement's row."
    why_human: "PROV-08 is the one of this phase's ten requirement IDs still marked `[ ]` / Pending at HEAD, deliberately (commit 38aee8d flipped the other five it touched and left this one). Its substance is implemented and behaviourally tested at stub level; its 'full parity' claim is exactly what the live-key run settles. Which side of that line the marking belongs on is an owner judgement, not a code fact."
---

# Phase 3: Owned Loop: API Keys and Gateways — Verification Report

**Phase Goal:** The learner runs the full Derive method on an Anthropic, OpenAI or Gemini API key, through OpenRouter, or on any OpenAI-compatible endpoint, with Derive running its own agent loop, web search on every path, and the cost of each lesson visible where the lesson is.

**Verified:** 2026-10-12T21:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

**Mode note.** ROADMAP.md marks this phase `mode: mvp`, but its goal is an outcome statement rather than the `As a …, I want to …, so that …` User Story form (`user-story.validate` → `valid: false`). This report therefore uses the five ROADMAP Success Criteria as the contract and replaces the MVP "User Flow Coverage" table with the criterion-by-clause table below. That follows the precedent set by `02-VERIFICATION.md`, which verified the same way against the same goal shape.

---

## Goal Achievement

### Observable Truths — the five ROADMAP Success Criteria

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Lesson on an Anthropic, OpenAI and Gemini key with the same tools and method as the Claude Code path; the API suite passes through the owned loop with a stub model | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Second clause VERIFIED: `server/test/api.test.ts:279-478` drives a whole lesson through the owned loop over the app's real HTTP routes against a `MockLanguageModelV4` — nine scripted steps, graph set, node taught, the lock refused with no understanding pass, the lock allowed after an intuition pass, the lesson carrying a cost string. `model.doStreamCalls.length === 9` is the positive evidence the loop ran. First clause present and wired on all three providers (`adapterFor` rows, `api-driver.test.ts:297` drives every teaching row through the one loop) but **no live-key lesson exists**; warm-up and cumulative quiz are exercised through the shared `actions.ts` dispatch on the external HTTP surface, not through the owned loop. |
| 2 | Lesson through OpenRouter with exact per-response cost recorded, and through a base URL plus key endpoint entered in Settings | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Recording path VERIFIED: `adapters.ts:openrouter.cost` reads `providerMetadata.openrouter.usage.cost` → `cost_source: 'provider'`, falls back to the table (never to a blank), and `usage: { include: true }` rides twice (model setting + providerOptions). `api-driver.test.ts:329, 348, 365` drive all three cases. `createOpenAICompatible(… includeUsage: true)` with the stored normalised base URL, refusing with a sentence when base or model is absent. **No live OpenRouter or endpoint lesson exists.** |
| 3 | Interrupting a turn and resuming continues without a provider error; a rate-limited provider shows a "provider busy" status card and retries; tools execute sequentially and idempotently by call id | ✓ VERIFIED | All three invariants are driven, not asserted at the source. Resume: `api-driver.test.ts:743` stops mid-stream with a provider-executed call in flight, asserts the synthesized `{ type: 'error-text', value: 'The learner stopped the turn before this tool ran.' }`, then **runs a second turn** and asserts every call in the next request is answered. Retry: `:973` counts the backoff down in whole seconds and asserts none of it persists; `:1008` lands a Stop inside the first backoff (`doStreamCalls.length === 1`, countdown cut short, ending `{ ok: true, interrupted: true }`); `:1045` ends an exhausted retry in the provider's own sentence with Derive's hint on its own line. Idempotence by call id: `:828` runs the same `remember` call id across two turn rows and asserts the action ran once (`memory` events === 1) and the history carries one result. Serialisation: a per-lesson promise chain in `api.ts serialise()` plus `:230` and `:393` (gemini, the row with no provider flag). |
| 4 | Search and fetch on every provider: natively where the provider has a search tool, otherwise through the configured search provider (Tavily, SearXNG) with a fetch that reuses the library fetcher | ✓ VERIFIED | Behavioural spot-check against the built dist: anthropic→`web_search` native, openai→`web_search` native, gemini-3.8-flash→`google_search` native, gemini-2.5-pro→`none` (model-id condition), openrouter and openai-compatible→`none`/fallback. Exactly one search source per turn: `api.ts` builds `omit = searchMode(…) === 'fallback' ? {} : {'web_search'}` and only then adds the native tool. `fetch_page` → `actions.ts:515` `fetchPublic(url, PAGE_ACCEPT, MAX_HTML_BYTES, assertPublicHost)` — the library fetcher with its SSRF guard, one implementation. `SEARCH_PROVIDERS = ['provider','tavily','searxng']`; empty query refused (`'a search needs a query'`); SearXNG's `format=json`-disabled case has its own sentence naming `settings.yml`. `{{WEB_TOOLS}}` renders three ways from `searchMode`, including the no-search variant that tells the tutor to admit uncertainty. |
| 5 | The lesson header and the Home row show "about $X.XX" labelled billed/estimated/not billed, priced from a versioned pricing table with a "prices as of" date the learner can override locally; CI validates each provider's projected tool schema and incoming calls are validated server-side against the full schema | ✓ VERIFIED | Cost: one formatter, verified behaviourally from `server/dist/cost.js` — `about $0.14 estimated`, `under $0.01 estimated`, `about $0.01 estimated` at exactly $0.005, `not billed`, `not reported`, `null` on no rows. One reader (`lessonCost`) behind both views: `index.ts:290` (lesson view) and `index.ts:645` (lessons list); rendered at `Lesson.tsx:164-169` and `Home.tsx:299`. Table: `pricing.ts PRICES_AS_OF = '2026-10-06'`, `prices.ts` merges `~/.derive/prices.json` live (absent silent, unreadable loud), surfaced as `prices_as_of`/`prices_error` on `GET /api/settings` and rendered as the last element of `/settings` (`Settings.tsx:177-181`), with a doctor line and an `.env.example` paragraph. Dialects: `wire-surface.json` carries `dialect:openai-strict`, `dialect:gemini`, `dialect:compact` beside the four surfaces, and `wire-surface.test.ts` asserts the rules outright (6 subtests, all passing); CI runs `pnpm test`. Server-side validation proven behaviourally: a 2-node `set_plan` is refused `nodes: Too small: expected array to have >=3 items` while the Gemini projection carries no `minItems` at all. |

**Score:** 3/5 success criteria fully verified · 2 present-but-behaviour-unverified on their live-key half

At clause level: **7 of 9 clauses verified**. Everything that is Derive's own behaviour is proven by driven tests; the two unverified clauses are both "a real vendor accepts and answers this request", which this machine cannot produce.

### What rests on a stub-model proof versus a live-key proof

| Criterion | Proven by a stub model, in this repo | Needs a live key |
|---|---|---|
| 1 | The owned loop runs a whole lesson over the real HTTP routes; each of the five teaching rows files its turn and usage under its own provider id; the 14 tutor tools come from one registry and one dispatch | That Anthropic, OpenAI and Google accept the request and complete all six lesson stages |
| 2 | Derive's read of `providerMetadata.openrouter.usage.cost`, the table fallback, `includeUsage: true`, the base-URL refusals | That OpenRouter emits the cost field, and that a learner's endpoint behaves |
| 3 | Orphan synthesis + a driven second turn; the countdown; Stop mid-backoff; exhausted-retry wording; replay-by-call-id; serialisation on the flagless provider | Only that a real provider's 429 carries the headers the code narrows (shape confirmed against `APICallError`) |
| 4 | Native/fallback/none decision per provider and model id; one source per turn; the guarded fetch; the three `{{WEB_TOOLS}}` renderings; the SearXNG sentences | That the provider-side search tool actually executes alongside the 14 function tools |
| 5 | The whole cost and pricing path; the three dialect projections; server-side full-schema validation | Nothing. The viewport and cache-hit backstops are adjacency checks, not SC5 clauses |

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | PROV-09's third named fallback backend, "Ollama search", is absent — `SEARCH_PROVIDERS` carries `provider`, `tavily`, `searxng` | Phase 4 | `deferred-items.md`: Ollama's catalogue row has `teaches: false` until PROV-06, so the backend would be unreachable. ROADMAP SC4 names only Tavily and SearXNG; both ship. |
| 2 | `web/src/pages/You.tsx:18` keeps its own `const field`, a fourth copy of the shared input class | a later plan touching `/you` | `deferred-items.md`: not in 03-09's `files_modified` and the string differs by `disabled:opacity-60`. |

---

### Required Artifacts

`verify.artifacts` across all nine plans: **24 of 26 pass**. The two misses are naming deviations, not absent capability.

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `server/src/drivers/api.ts` | the one `streamText` loop | ✓ VERIFIED | 880 lines; `runTurn`, `withRetries`, `serialise`, `patchOrphans`, `buildTools`, `usageOf`, `lessonCost`, `apiDriverFor` |
| `server/src/drivers/adapters.ts` | five teaching adapters | ⚠️ EXPORT RENAMED | All five rows present with model factory, dialect, providerOptions, cacheHook, search and cost reader. The plan declared `exports: [adapterFor, ADAPTERS, …]`; only `adapterFor` exists, as an exhaustive `switch` with no fallthrough — the same shape `probe.ts` already uses, and the module header says so. Nothing imports `ADAPTERS`. The artifact's `provides` is satisfied. |
| `server/src/index.ts` | lessonView and the lessons list each carry one server-computed cost string | ⚠️ PATTERN MOVED | Both carry it (`:290`, `:645`), via `lessonCost` imported from `drivers/api.js` rather than calling `costLabel` in place. The plan's own reasoning is in `api.ts:46-48`: `cost.ts` must stay pure and the loop needs the same reader, so it cannot live in `index.ts`. |
| `server/src/cost.ts` · `pricing.ts` · `prices.ts` · `context.ts` | the cost arithmetic, the table, the override, the estimator | ✓ VERIFIED | Pure, no import-time I/O; `PRICES_PATH` read from `config.ts` |
| `server/src/tools.ts` | one registry, four dialect projections, full-schema validation | ✓ VERIFIED | `TOOL_DIALECTS`, `jsonSchemaOf(spec, surface, dialect)` via zod's `override` hook, `validateToolInput` against the full zod object |
| `server/src/search.ts` | Tavily and SearXNG behind one service | ✓ VERIFIED | 12.5KB; `searchWeb`, `tavilySearch`, `searxngSearch`, `testSearch`, `searchReady`, `NO_JSON` |
| `server/src/prompt.ts` | the third `{{WEB_TOOLS}}` rendering with its no-search variant | ✓ VERIFIED | `webTools(surface)` with `api`/`native`/`fallback`/`none` |
| `server/src/driver.ts` | TurnContext carries the stable prefix and volatile tail | ✓ VERIFIED | `instructionsStable`, `instructionsVolatile`, `instructions` kept byte-identical for the two login drivers |
| `server/src/migrations.ts` | `turn_messages`, `tool_results`, per-provider learner model | ✓ VERIFIED | versions 6 and 7; plain `CREATE TABLE`, index in the same `exec`, data work in `convertLearnerModelPrefs`, `LATEST_VERSION` derived |
| `web/src/components/WebSearchCard.tsx` | one web-search card, three-way native control | ✓ VERIFIED | 208 lines; reuses `KeyField` from `ProviderRow`; `web/src/components/fields.ts` holds the lifted shared classes |
| `web/src/pages/Lesson.tsx` · `Home.tsx` · `Settings.tsx` | the cost segment, the Home row figure, the card and the prices sentence | ✓ VERIFIED | all four rendered, all wired to server strings |
| `server/test/wire-surface.json` | the `api` surface key plus the three dialect keys | ✓ VERIFIED | keys: `agent`, `api`, `mcp`, `http`, `dialect:openai-strict`, `dialect:gemini`, `dialect:compact` |

### Key Link Verification

`verify.key-links` across all nine plans: **33 of 34 verified.**

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `agent.ts` | `drivers/api.ts` | `apiDriverFor(tutor.provider)` in the dispatch | ✓ WIRED | `agent.ts:263` — `driverOverride() ?? (backendOf === 'codex' ? codexDriver : provider === 'claude-code' ? claudeDriver : apiDriverFor(tutor.provider))` |
| `drivers/api.ts` | `actions.ts` | the one tool dispatch both drivers call | ✓ WIRED | `api.ts:457` and `agent.ts:66` both call `actions.runTool` |
| `drivers/api.ts` | `drivers/adapters.ts` | the cost reader on every finish-step, providerOptions on the request | ✓ WIRED | `adapterFor(provider)` at `api.ts:472`; `adapter.cost(...)` at the `finish-step` case |
| `drivers/adapters.ts` | `settings.ts` | the base-URL row reads the learner's stored normalised URL | ✓ WIRED | `baseUrlKey(provider)` read in `runTurn`, passed into `adapter.model` |
| `drivers/api.ts` | `tools.ts` | pre-projected JSON Schema per dialect, never a zod schema | ✓ WIRED | `jsonSchema(jsonSchemaOf(spec, 'api', dialect))` in `buildTools` |
| `drivers/api.ts` | `context.ts` | the pre-request headroom refusal | ✓ WIRED | `headroomCheck(..., priceTable())` before `streamText` |
| `drivers/api.ts` | `db.ts` | `turn_messages` and the executed-call record | ✓ WIRED | `loadTurnMessages`, `saveTurnMessages`, `recordToolResult`, `recordedToolResult` |
| `index.ts` | `cost.ts` | one server-computed cost string on both views | ✓ WIRED (via `drivers/api.ts`) | `lessonCost` → `listUsage` → `costOf` → `costLabel` |
| `WebSearchCard.tsx` | `lib/api.ts` → `/api/settings/search` | the card saves, removes and tests the search config | ✓ WIRED | `api.setSearch`, `api.removeSearchKey`, `api.testSearch` against routes at `index.ts:511, 535, 547` |
| `Lesson.tsx` | `lib/useLesson.ts` | the pill reads the seeded cost and the turn_end replacement from existing state | ⚠️ WIRED DIFFERENTLY | The plan's pattern (`state.cost` / `lesson_cost` in the component) is deliberately absent. `useLesson.ts` is **byte-identical across the whole phase** (`git diff 72eae23..HEAD` is empty), which is the plan's own Hard Prohibition 1; the page instead holds a local `cost` state seeded by `api.lesson(id)` and refetched when `!state.busy` flips — `busy` going false *is* `turn_end`. The behaviour the must-have asked for (seeded on load, replaced once at turn end, no timer, no poll) holds. Recorded in `03-08-SUMMARY.md` as the plan's own §6 fallback. See the override suggestion below. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `Lesson.tsx` | `cost` | `api.lesson(id)` → `GET /api/lessons/:id` → `lessonCost(id)` → `listUsage({lesson})` (indexed SQL) → `costOf` → `costLabel` | Yes | ✓ FLOWING |
| `Home.tsx` | `l.cost` | `api.lessons()` → `index.ts:645` `lessonCost(l.id)` → same chain | Yes | ✓ FLOWING |
| `Settings.tsx` | `settings.prices_as_of` / `prices_error` | `GET /api/settings` → `PRICES_AS_OF` + `pricesFileError()` reading `~/.derive/prices.json` | Yes | ✓ FLOWING |
| `WebSearchCard.tsx` | `search.provider` / `base_url` / key hint | `GET /api/settings` → `settings.ts` → `search.ts` `searchProvider()` + stored setting + `keys.ts` | Yes | ✓ FLOWING |
| `Lesson.tsx` footer | `state.verified` | `turn_end.payload.verified` (incremented in `api.ts` on the native search tool, `web_search` and `fetch_page`) → `useLesson` reducer `:93` | Yes | ✓ FLOWING |
| `usage` rows | `cost_usd`, `cost_source`, `cache_read_tokens` | `finish-step` → `adapter.cost(providerMetadata, usage, …)` → `sink.usage` → `recordUsage` | Yes | ✓ FLOWING |
| `turn_end.payload.lesson_cost` | — | `endingCost(ctx)` on every one of the seven endings | Yes, but no browser consumer | ℹ️ Carried and asserted (`api-driver.test.ts:1242, 1508-1519`); the pages read the same string from `GET /api/lessons/:id`. The must-have asked only that it be carried. |

### Behavioural Spot-Checks

| Behaviour | Command | Result | Status |
|---|---|---|---|
| The money vocabulary | `node -e` on `server/dist/cost.js` `costLabel` | `about $0.14 estimated` · `under $0.01 estimated` · `about $0.01 estimated` ($0.005) · `not billed` · `not reported` · `null` | ✓ PASS |
| OpenAI strict projection drops the bounds, requires everything, keeps `additionalProperties: false` | `node -e` on `dist/tools.js` `jsonSchemaOf('set_plan','api','openai-strict')` | no `minItems` anywhere; `additionalProperties === false`; `required = ["goal","nodes"]` | ✓ PASS |
| Gemini projection emits only the documented keywords | same, dialect `gemini` | root keys `type,properties,required`; no `minItems`, no `additionalProperties`, no `$schema` | ✓ PASS |
| Compact projection keeps `full`'s keyword set | same, dialect `compact` | keyword sets identical to `full` | ✓ PASS |
| The full schema is what the server accepts | `validateToolInput('set_plan','api', {goal, nodes:[2 nodes]})` | refused: `set_plan: nodes: Too small: expected array to have >=3 items`; 3 nodes accepted | ✓ PASS |
| Tool surfaces are unchanged for the plugin | `toolsFor('api').length` / `DERIVE_TOOL_NAMES.length` / `toolsFor('mcp').length` | 16 / 14 / 22 | ✓ PASS |
| Search mode per provider and model id | `node -e` on `dist/drivers/adapters.js` | anthropic native · openai native · gemini-3.8 native (`google_search`) · gemini-2.5 none · openrouter none · openai-compatible none | ✓ PASS |
| An empty search query is refused, not sent | `searchWeb('   ')` | `a search needs a query` | ✓ PASS |
| `SEARCH_PROVIDERS` content | `node -e` on `dist/search.js` | `provider,tavily,searxng` (no Ollama — deferred) | ✓ PASS (deferred item recorded) |
| Method text has not drifted | `pnpm method:check` | `method: 6 rendered copies match method/` | ✓ PASS |
| Whole suite | `pnpm test` (run once) | **396 tests, 396 pass, 0 fail**, 94 suites, 13.2s | ✓ PASS |
| Typecheck | `pnpm typecheck` | web Done, server Done | ✓ PASS |
| Build | `pnpm build` | exit 0, web + server dist emitted | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` exists in this repo and no plan or SUMMARY declares a probe. **Step 7c: SKIPPED (no probes declared or discoverable).** The project's equivalent gates — `pnpm method:check`, `pnpm typecheck`, `pnpm build`, `pnpm test` — were each run in this process and are recorded above.

### Requirements Coverage

| Requirement | Source Plans | Status | Evidence |
|---|---|---|---|
| **PROV-01** Anthropic key through Derive's own loop; plugin stays the subscription route | 03-01, 03-03, 03-04, 03-05, 03-06, 03-08, 03-09 | ✓ SATISFIED (code) / ? live-key half | `adapterFor('anthropic')`; `api.test.ts` whole lesson on a stub; `claude-code` row still `teaches: true` and still runs through `claudeDriver` |
| **PROV-02** OpenAI key | 03-03, 03-04, 03-05, 03-06, 03-09 | ✓ SATISFIED (code) / ? live-key half | `createOpenAI(...)`, Responses API default, `parallelToolCalls: false`, `store: false` |
| **PROV-03** Gemini key | 03-03, 03-04, 03-05, 03-06, 03-09 | ✓ SATISFIED (code) / ? live-key half | `createGoogleGenerativeAI`, `dialect: 'gemini'`, model-id search condition, the tool-dropping refusal as backstop |
| **PROV-04** OpenRouter with exact per-response cost | 03-03, 03-04, 03-05, 03-06, 03-08 | ✓ SATISFIED (code) / ? live-key half | `usage: { include: true }` twice, `cost_source: 'provider'` on a reported figure, table fallback otherwise |
| **PROV-05** any OpenAI-compatible endpoint by base URL plus key | 03-03, 03-04, 03-05, 03-06, 03-09 | ✓ SATISFIED (code) / ? live-key half | `createOpenAICompatible(… includeUsage: true)`, `v1(base)`, two refusal sentences, `cost_source: 'unknown'` |
| **PROV-08** full parity: same tools, same method, sequential execution, resume after interruption, retries with a visible "provider busy" | 03-01, 03-02, 03-04, 03-05 | ⚠️ **MARKED PENDING at HEAD** — substance satisfied in code and driven by tests | One registry → one `runTool` dispatch on both drivers; per-lesson mutex; orphan patch + driven resume; replay by call id; the two-minute visible countdown with working Stop. `REQUIREMENTS.md:30` still reads `- [ ]` and `:156` reads `Pending`. See the human-verification item on this row. |
| **PROV-09** search and fetch on every provider; pluggable fallback (Tavily, SearXNG, Ollama search); fetch reuses the library fetcher | 03-06, 03-09 | ✓ SATISFIED on the phase contract (SC4) / partial on the literal text | Tavily and SearXNG ship; native where it exists; `fetchPublic` + `assertPublicHost`. The third named backend, **Ollama search, is absent** — recorded in `deferred-items.md` with its Phase 4 seam. SC4 names only Tavily and SearXNG, so the ROADMAP contract is met; the requirement's own parenthetical is not yet fully honoured. |
| **PROV-10** dialect projections validated in CI; incoming calls validated server-side against the full schema | 03-07 | ✓ SATISFIED | Three dialect keys in `wire-surface.json`, six outright rule subtests, `pnpm test` in CI; `validateToolInput` proven behaviourally to enforce a bound the Gemini dialect cannot express |
| **COST-02** cost of each lesson in the lesson header and on Home, labelled | 03-02, 03-08 | ✓ SATISFIED | One formatter, one reader, both views, four labels, `weakestSource` ordering |
| **COST-04** versioned pricing table with a "prices as of" date the learner can override locally | 03-02, 03-08, 03-09 | ✓ SATISFIED | `PRICES_AS_OF`, `~/.derive/prices.json` merge (silent absent, loud unreadable), the `/settings` sentence, the doctor line, the `.env.example` paragraph |

**Orphaned requirements:** none. `REQUIREMENTS.md:214` maps exactly ten IDs to Phase 3 and all ten appear in at least one plan's `requirements` frontmatter.

**Correction to the verification brief.** The brief states "REQUIREMENTS.md now marks all ten complete". It does not: **PROV-08 is `[ ]` / Pending at HEAD**, deliberately — commit `38aee8d` flipped PROV-01, 02, 03, 05, 09 and COST-04 and left PROV-08 alone. Nine of ten are marked Complete; of those nine, eight are earned outright and PROV-09's is earned on substance with one named backend deferred.

### Prohibitions

22 prohibitions across the nine plans, all judgment-tier (no plan declares `verification:` on a prohibition). Autonomous verification, so the verdict below is a **NON-AUTHORITATIVE LLM judgement recorded for human review at the phase checkpoint** — not a silent pass, and not a halt.

| Plan | Prohibition (abridged) | Verdict | Evidence |
|---|---|---|---|
| 03-01 | The method must not be degraded per provider | holds | One registry; `descriptionFor` reads it on every surface; the Gemini dialect keeps `description` in its keyword set; no adapter row selects `compact` |
| 03-01 | The durable record must stay the tutor's teaching, never its scratchpad | holds | `reasoning-start` → `emitEphemeral('status', 'Thinking')` only; `reasoning-delta`/`-end` hit `default: break` before any sink call; no reasoning reaches `messages`, SQLite or the vault |
| 03-02 | A cost figure must never claim more firmness than its weakest input | holds | `weakestSource` + `costLabel`; verified behaviourally including the $0.005 boundary and the no-rows null |
| 03-02 | Prices must never be fetched at runtime | holds | `prices.ts` reads one local file; no `fetch` in the module |
| 03-03 | A provider's limitation must not narrow the tutor for the others | holds | Per-row differences only; registry, method text and other rows untouched |
| 03-03 | A learner's key must never reach a host the learner did not name | holds | `noRedirectFetch` passed to all five provider factories; a 3xx throws rather than following |
| 03-04 | A replay must never re-grade | holds | Driven: `api-driver.test.ts:828` — same call id across two turn rows, action ran once |
| 03-04 | A persisted part must never be filtered or rewritten | holds | `persist()` filters by role only (`PERSISTED_ROLES`); parts, including `providerOptions`, pushed verbatim |
| 03-05 | The gate must never be reached through a truncated or summarised history | holds | `headroomCheck` refuses before the request; `pruneMessages` and `prepareStep` opted out in COVERAGE.md |
| 03-05 | A provider's own words must reach the learner unchanged | holds | `providerSentence(status, body)` + `hintFor(...)` on separate lines; asserted at `:1045` |
| 03-05 | A transient stall must not enter the durable record | holds | `emitEphemeral` only; `:973` asserts none of the countdown persists |
| 03-06 | The tutor must never assert a fact it could not verify | holds | The `none` branch of `webTools` renders the admit-uncertainty instruction; `:659` asserts it |
| 03-06 | A fetch on the tutor's instruction must never reach a private address | holds | `fetchPublic(url, PAGE_ACCEPT, MAX_HTML_BYTES, assertPublicHost)` — one path, one guard |
| 03-06 | A learner's own search server must not be refused for being local | holds | `searxngSearch` deliberately does not call `assertPublicHost` on the base URL, with the reason in a comment; the guard applies to result URLs the tutor then fetches |
| 03-07 | The registry must not be simplified to a dialect's common subset | holds | `jsonSchemaOf` projects through zod's `override` hook; `full` is produced by the same one line as before and the fixture's `agent`/`mcp`/`http` arrays did not move |
| 03-07 | A narrower dialect must never narrow what the server accepts | holds | Proven behaviourally: 2-node `set_plan` refused server-side while the Gemini projection carries no `minItems` |
| 03-08 | A per-turn figure must never be shown where a lesson total is promised | holds | `lesson_cost` is a separate field from `cost_usd`; `lastCost` appears in the pages only inside a comment |
| 03-08 | The cost must not tick | holds | No timer and no poll in the cost path; the only `setTimeout` in `Lesson.tsx` is the export message |
| 03-08 | Money must not be shown in the accent colour | holds | The cost span inherits the pill's `text-ink-400`; no `gold` class on it |
| 03-09 | A learner's selection must mean what it says | holds | `WebSearchCard` renders a muted "what is missing" line for a chosen-but-unconfigured provider; `searchReady()` returns false, so the loop registers no search tool |
| 03-09 | No price editor and no number inputs | holds | `grep 'type="number"' web/src/pages/Settings.tsx` → none; one sentence, no control beside it |
| 03-09 | A key or any fragment of one must never reach the terminal | holds | `doctor.mjs` reports the price file's presence only and never opens it; no line reports a search key, with the reason in a comment |

### Anti-Patterns Found

Scanned all 42 non-lockfile files changed between `72eae23` (phase plan) and HEAD.

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| — | — | `TBD` / `FIXME` / `XXX` | — | **None found.** The debt-marker gate passes. |
| — | — | `TODO` / `HACK` / `PLACEHOLDER` / "not yet implemented" / "coming soon" | — | **None found.** |

`CLAUDE.md` records that this project does not use debt markers and that unfinished work is not left in comments. That convention holds across every file this phase touched. `03-03-SUMMARY.md`'s "Known Stubs" entry — every adapter row's `search` returning `null` — was closed by 03-06 and is no longer true at HEAD (verified: three rows return real search tools).

### Override Suggestion

One key link is wired differently from its declared pattern, for a reason the plan itself states. **This looks intentional.** To accept it, add to this file's frontmatter:

```yaml
overrides:
  - must_have: "Lesson.tsx -> useLesson.ts: the pill reads the seeded lesson cost and the turn_end replacement from existing state (pattern state\\.cost|lesson_cost)"
    reason: "The plan's own Hard Prohibition 1 requires web/src/lib/useLesson.ts to stay byte-identical, which forbids the reducer branch the pattern would need. 03-08 took its own §6 fallback: the page holds a local cost state, seeded by api.lesson(id) and refetched when state.busy flips false — and busy going false IS turn_end. The observable behaviour the must-have specifies (seeded on load, replaced once at turn end, no timer, no poll) holds, and git diff 72eae23..HEAD -- web/src/lib/useLesson.ts is empty. Recorded as a deviation in 03-08-SUMMARY.md."
    accepted_by: "<owner>"
    accepted_at: "<ISO timestamp>"
```

### Human Verification Required

Eight items, all in the frontmatter `human_verification` block. Seven of them need something this machine does not have — a provider API key, provider network reachability, a real SearXNG instance, a real browser with a hover-capable pointer, or two terminals with CLI logins. They correspond one-to-one with `WINDOWS.md` entries 14-25 (twelve `unrun-verify` rows, no `deviation` rows for this phase) and with the nine `<human-check>` blocks harvested from the plans. The eighth is the owner's call on PROV-08's marking.

Per the standing rule the brief restates: an item the executors explicitly logged as needing a real key is **not a gap they failed to close**, and it is also **not something this report may mark verified**. None of the eight is recorded as a gap.

### Gaps Summary

**No gaps.** Nothing a must-have asserted is missing, stubbed, unwired or disconnected from real data. Every artifact exists and is substantive; 33 of 34 key links verify on their declared pattern and the 34th verifies on a better route the plan itself named; every rendered value traces to a real query; no debt marker exists in any file the phase touched; and the whole workspace is green on `method:check`, `typecheck`, `build` and a 396/396 test run.

What is open is honest distance, not incompleteness:

1. **Two of the five success criteria rest half on a vendor's behaviour.** SC1 and SC2 each have a clause that reads "a learner completes a lesson on a real key". Derive's side of both is proven by driven tests over its own HTTP routes against a stub `LanguageModel`; the provider's side is unobservable here. They are recorded as present-but-behaviour-unverified and routed to human verification, which is what keeps the headline score at 3/5 rather than reading a clean 5/5 on symbol presence.
2. **Warm-up and the cumulative quiz are not exercised through the owned loop.** They are driven through the shared `actions.ts` dispatch on the external HTTP surface (`api.test.ts:164-220`), and that dispatch is the same `runTool` the owned loop calls — but no test takes an owned-loop lesson through either stage. The live-key run in human item 1 covers it.
3. **Ten backstop statements across seven plans are, by construction, not inferable from the code.** Five vendors' list prices on a date, two vendors' metadata emission, Google's rejected-keyword set, Anthropic's cache behaviour, and three rendered-layout facts. They are listed individually under `insufficient_spec_items` rather than absorbed.
4. **PROV-08's marking is unresolved.** Its substance is implemented and tested; the requirement text says "full parity", and whether a stub-model parity proof earns the checkbox before the live-key run is an owner judgement. Flagged rather than decided.
5. **PROV-09 ships two of the three fallback backends its own text names.** Deferred to Phase 4 with the seam named, and SC4 — the phase's actual contract — asks only for the two that ship.

The phase goal is achieved in the codebase to the limit of what this environment can observe. Nothing in this report asserts an invariant the code does not hold.

---

_Verified: 2026-10-12T21:30:00Z_
_Verifier: Claude (gsd-verifier)_
