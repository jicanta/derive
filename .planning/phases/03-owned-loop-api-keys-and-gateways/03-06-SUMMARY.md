---
phase: 03-owned-loop-api-keys-and-gateways
plan: 06
subsystem: api
tags: [web-search, tavily, searxng, ssrf, fetch, tool-registry, wire-surface, prompt, ai-sdk, node-test]

# Dependency graph
requires:
  - phase: 03-owned-loop-api-keys-and-gateways
    provides: "plan 03-01's owned loop (server/src/drivers/api.ts): the streamText call, buildTools over the registry, the per-lesson mutex, the merged abort signal and the tool-call parts the verified counter reads"
  - phase: 03-owned-loop-api-keys-and-gateways
    provides: "plan 03-03's adapter table: the `search(modelId)` member declared but answering null on every row, `searchCountOf`, `noRedirectFetch`, and the unsupported-combination refusal the Gemini predicate leans on as a backstop"
  - phase: 03-owned-loop-api-keys-and-gateways
    provides: "plan 03-05's withRetries and the ephemeral status path the two new status lines ride"
  - phase: 02-settings-and-secrets
    provides: "probe.ts's isLocalUrl / LOCAL_MS / REMOTE_MS timeout posture, providerSentence + hintFor, the TestResult shape the search test reuses; keys.ts's registerSecret-before-write and `{ set, hint }`; the PUT /api/settings/:provider route shape and normaliseBaseUrl"
  - phase: 01-foundation
    provides: "the tool registry and its per-surface projection, server/test/wire-surface.json as the frozen contract, library.ts's fetchPublic + assertPublicHost + htmlToText hardened under D-10, and the {{WEB_TOOLS}} placeholder in method/"
provides:
  - "server/src/search.ts: the pluggable fallback web search behind one searchWeb, with Tavily and SearXNG backends, the local-endpoint timeout posture, redirect refusal, an empty-query refusal that makes no request, and the SearXNG json-disabled sentence"
  - "A fourth tool surface, `api`, carrying the fourteen tutor tools plus Derive's own fetch_page and web_search — and nothing else; the agent, mcp and http surfaces are byte-unchanged"
  - "actions.fetchPage: one guarded fetch tool on library.ts's fetchPublic with assertPublicHost, no second fetcher and no second SSRF guard"
  - "Native server-side search on anthropic and openai unconditionally, on gemini conditional on a Gemini 3 or later model id, and null on openrouter and openai-compatible"
  - "searchMode(provider, modelId): the one three-way decision the loop registers tools from and the prompt renders from, so the method text and the tool set cannot disagree"
  - "systemPrompt(surface: WebSurface): three {{WEB_TOOLS}} renderings — the plugin's two tools, Codex's built-in search, and the owned loop's, which names the provider's own tool, Derive's fallback, or neither with an admission requirement in its place"
  - "PUT /api/settings/search, DELETE /api/settings/search/key, POST /api/settings/search/test, and a `search` block in settingsView() carrying `native` for the active provider"
  - "The verified counter incremented on the search tool and on fetch_page, so Lesson.tsx's `facts verified on the web` footer is a record rather than a promise on the providers this phase adds"
affects: [03-07 strict dialect projection, 03-08 cost and prices UI, 03-09 the settings web-search card, phase-04 conformance harness and offline providers]

actuals:
  tokens: 21933   # chars/4 over the realized diff a5e02a7..436a743; 5765 of it is the regenerated wire-surface.json
  tasks: 3
  commits: 3
  plan_head_before: a5e02a7d0877d1bbc188d29ed6d5dc9fb2eedb94

tech-stack:
  added: []
  patterns:
    - "A fourth tool surface rather than a reuse of `agent`: a tool that must not reach the plugin's wire or the Claude Agent SDK is declared `surfaces: ['api']` and every other surface filters it out structurally, with no edit to agent.ts, mcp.ts or the HTTP action switch"
    - "One three-way decision function (`searchMode`) read by both the prompt and the tool registration, so a capability the method text claims and a capability the model is handed are the same fact"
    - "A suite-only endpoint override (`setTavilyEndpoint`) in the same posture as `setModelOverride`: no route, header, environment variable or config file can set it"
    - "An off-catalogue key id (`search:tavily`) riding keys.ts and envKeyFor through one small table, so a key that has no provider row is still registered for redaction and lockable by an environment variable"

key-files:
  created:
    - server/src/search.ts
    - server/test/search.test.ts
  modified:
    - server/src/config.ts
    - server/src/settings.ts
    - server/src/index.ts
    - server/src/tools.ts
    - server/src/actions.ts
    - server/src/library.ts
    - server/src/prompt.ts
    - server/src/agent.ts
    - server/src/drivers/adapters.ts
    - server/src/drivers/api.ts
    - server/test/wire-surface.test.ts
    - server/test/wire-surface.json
    - server/test/api-driver.test.ts
    - server/test/mcp.test.ts

key-decisions:
  - "A fallback the learner selected but did not finish configuring reports `none`, not `fallback`: it has no way to answer a search, so handing the tutor a tool that refuses every call would be the same lie by another route"
  - "The Gemini native-search predicate reads the major version out of the model id and is wrong in the safe direction: an unrecognised id gets Derive's fallback, which teaches correctly, where a wrong yes costs the whole method"
  - "mcp.test.ts's declaration-order assertion now compares the live wire against toolsFor('mcp') rather than ALL_TOOL_NAMES — which is what it always meant; the 22-name pre-phase set assertion is untouched"
  - "The no-search {{WEB_TOOLS}} rendering opens with the one tool there still is and carries its instruction in a parenthesis, because the placeholder is substituted into five method sentences that all read it as a name"
  - "MAX_HTML_BYTES and READ_CHARS are exported from library.ts rather than redeclared in actions.ts, so fetch_page's download bound and extract size are the ones a library read already uses"

patterns-established:
  - "Surface-scoped tools: `surfaces: ['api']` is the whole four-place-rule satisfaction, because each of the four consumers builds from toolsFor(<its own surface>)"
  - "A grep gate that strips `//` comment text before matching, so an explanatory comment about a deliberately-absent guard is free while a real call to it is the regression caught"

requirements-completed: []  # declared: PROV-09, PROV-01..PROV-05 — all six still held, see Deviations

coverage:
  - id: D1
    description: "The tutor can search the web on every provider: natively on Anthropic, OpenAI and Gemini, through Tavily or SearXNG otherwise"
    requirement: PROV-09
    verification:
      - kind: unit
        ref: "server/test/search.test.ts#maps Tavily's results to hits in the engine's own order, with no sort, re-rank or dedup"
        status: pass
      - kind: unit
        ref: "server/test/search.test.ts#maps SearXNG's results to hits in the same order"
        status: pass
      - kind: integration
        ref: "server/test/api-driver.test.ts#names the provider's own search tool where there is one, and registers that tool and not Derive's"
        status: pass
      - kind: integration
        ref: "server/test/api-driver.test.ts#names Derive's own web_search where the learner configured a fallback"
        status: pass
    human_judgment: true
    rationale: "No provider key exists in this environment, so that a real Anthropic / OpenAI / Gemini key actually executes its server-side search tool alongside the fourteen function tools, and that its per-call charge reaches the usage ledger, cannot be shown by any automated test. The plan marks this truth `backstop` for exactly that reason."
  - id: D2
    description: "One guarded fetch tool on library.ts's existing fetcher: one implementation, one SSRF guard, one status line"
    requirement: PROV-09
    verification:
      - kind: other
        ref: "grep -c 'fetchPublic(' server/src/actions.ts -> 1; grep -cE 'fetchPublic\\(|assertPublicHost' -> 3"
        status: pass
      - kind: unit
        ref: "server/test/wire-surface.test.ts#covers the whole surface a driver can see: 24 tools, of which 14 are the tutor tools"
        status: pass
    human_judgment: false
  - id: D3
    description: "A provider with native search is never also handed Derive's fallback search tool"
    requirement: PROV-09
    verification:
      - kind: integration
        ref: "server/test/api-driver.test.ts#names the provider's own search tool where there is one, and registers that tool and not Derive's"
        status: pass
    human_judgment: false
  - id: D4
    description: "With no search available at all, the method text tells the tutor to admit uncertainty rather than guess, and fetch_page still works"
    requirement: PROV-09
    verification:
      - kind: integration
        ref: "server/test/api-driver.test.ts#tells the tutor to admit uncertainty where there is no search at all, and still gives it fetch_page"
        status: pass
      - kind: other
        ref: "grep -c unsure server/src/prompt.ts -> 3"
        status: pass
    human_judgment: false
  - id: D5
    description: "A learner's SearXNG on localhost is reached rather than refused, and the json-disabled case has its own sentence"
    requirement: PROV-09
    verification:
      - kind: unit
        ref: "server/test/search.test.ts#reaches a learner's SearXNG on localhost, which the destination guard would have refused"
        status: pass
      - kind: unit
        ref: "server/test/search.test.ts#names settings.yml when a SearXNG instance answers HTML rather than JSON"
        status: pass
      - kind: other
        ref: "no assertPublicHost in server/src/search.ts with comments stripped -> 0"
        status: pass
    human_judgment: false
  - id: D6
    description: "The plugin's 22-tool MCP wire, the agent surface's 14 tutor tools and the 16-tool HTTP surface are byte-unchanged"
    verification:
      - kind: other
        ref: "node -e surfaces script -> `surfaces ok`; the fixture diff is 559 insertions and 0 deletions"
        status: pass
      - kind: integration
        ref: "server/test/mcp.test.ts#serves the registry in declaration order, and the same tools the pre-phase binary served"
        status: pass
      - kind: integration
        ref: "server/test/api.test.ts (the whole HTTP action surface suite)"
        status: pass
    human_judgment: false
  - id: D7
    description: "The learner's Tavily key or SearXNG address is stored, described and tested through the existing settings conventions"
    requirement: PROV-09
    verification:
      - kind: manual_procedural
        ref: "scratch server on 127.0.0.1:4399 — PUT /api/settings/search answered the refreshed view with `{set,hint}` and the normalised base URL, an unknown choice was a 400 naming the three, POST .../test answered the TestResult shape, DELETE .../key answered the restart note, and PUT /api/settings/anthropic was unaffected"
        status: pass
    human_judgment: true
    rationale: "The three routes have no committed suite of their own — the plan assigned route coverage to no task, and plan 03-09 builds the card that drives them. The smoke run above is recorded evidence, not a regression test; the card's own UAT is where these routes get held to their copy."
  - id: D8
    description: "The turn's verified counter is incremented on the native search tool and on fetch_page"
    verification:
      - kind: other
        ref: "grep -c verified server/src/drivers/api.ts -> 4 (>= 3 required)"
        status: pass
    human_judgment: true
    rationale: "That the count actually rises in front of a learner needs a provider that actually runs a search, which needs a real key. The increment site is asserted by grep only."

# Metrics
duration: 30 min
completed: 2026-10-12
status: complete
---

# Phase 03 Plan 06: Web Search and Fetch on Every Provider Summary

**A fourth `api` tool surface carrying one guarded `fetch_page` and one fallback `web_search` over Tavily or SearXNG, native server-side search on Anthropic, OpenAI and Gemini-3, and a third `{{WEB_TOOLS}}` rendering that tells a tutor with no search to admit uncertainty rather than assert — with the plugin's 22-tool wire byte-unchanged.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-10-12T18:32Z (base `a5e02a7`)
- **Completed:** 2026-10-12T19:02Z
- **Tasks:** 3
- **Files modified:** 16 (2 created, 14 modified)

## Accomplishments

- **`server/src/search.ts`** — the fallback search behind one `searchWeb(query, limit)` with two backends. Tavily posts the key as a bearer to its documented endpoint; SearXNG gets a GET at the learner's own address with no authentication. Both refuse a 3xx rather than follow it, both take `probe.ts`'s timeout posture (`isLocalUrl(url) ? LOCAL_MS : REMOTE_MS`), and a non-OK answer carries the engine's own sentence through `providerSentence`. An empty or whitespace-only query throws `a search needs a query` **before any request**. `results[]` is mapped positionally — no sort, no re-rank, no dedup — so the tutor reads the engine's own ordering.
- **The json-disabled sentence.** A SearXNG instance whose administrator has not enabled `format: json` answers an HTML page, sometimes 200 and sometimes 403. Both get `your searxng instance did not answer with json; enable the json format under search: in its settings.yml` rather than a generic reach error that would send the learner looking at their network for a line in a config file.
- **The deliberate non-guard.** The configured SearXNG address is never run through `assertPublicHost`, because a learner's instance is usually on `localhost` and that is exactly what the guard refuses. The suite asserts the anti-pattern directly: `assertPublicHost('http://localhost:P/search')` rejects, and `searchWeb` on that same base returns its three hits. The guard is applied unchanged to the result URLs the tutor then fetches.
- **The `api` surface.** `ToolSurface` widens to `'agent' | 'api' | 'mcp' | 'http'`; all fourteen tutor rows list `'api'` and **none** declares a `per_surface` entry for it, so parity with the Claude agent surface is structural — the fixture's fourteen `api` rows are byte-identical to its fourteen `agent` rows.
- **`fetch_page` and `web_search`** as registry rows on `'api'` alone, labelled `Reading a source` and `Verifying with a web search` — today's wording lifted from the Claude and Codex drivers, so the learner sees no difference between the plugin and the owned loop. `actions.fetchPage` runs on `library.ts`'s `fetchPublic(url, accept, MAX_HTML_BYTES, assertPublicHost)` plus `htmlToText`: no second fetcher, no second SSRF guard, no second byte cap, every cross-module call inside the function body because `repo -> library -> materials -> repo` is a real import ring.
- **Native search per row.** `anthropic.tools.webSearch_20260318({})`, `openai.tools.webSearch({})`, and `google.tools.googleSearch({})` only on a Gemini 3 or later model id — because on anything older `@ai-sdk/google`'s `prepareTools` silently discards all fourteen function declarations, giving a tutor that talks and never draws a graph. The predicate is narrow and wrong in the safe direction; the loop's unsupported-combination refusal from 03-03 is the backstop.
- **One search per turn, from one decision.** `searchMode(provider, modelId)` answers `native | fallback | none`. The loop registers the provider's own tool **or** Derive's `web_search` row, never both; `agent.ts` renders `{{WEB_TOOLS}}` from the same call. A tutor told to verify with a tool it was not given asserts instead, and a tutor handed two ways to search will use both — one function is what makes neither possible.
- **The third rendering, and its no-search variant.** `systemPrompt` takes a `WebSurface`; the `claude` and `codex` strings are byte-identical to before. `api`/none reads `` `fetch_page` only (there is no web search on this provider: say plainly when you are unsure of a fact rather than guess or assert it, and name what you could not check; `fetch_page` still reads any page you are given a URL for) ``. `method/` and `method.generated.ts` are byte-unchanged and `pnpm method:check` still reports six matching copies.
- **The settings routes 03-09's card will drive.** `PUT /api/settings/search`, `DELETE /api/settings/search/key`, `POST /api/settings/search/test`, each modelled on the provider route's statuses, lock sentence, `safeMessage` and answer-the-view convention — registered **before** `/:provider`, which would otherwise match `search` as a provider id. `settingsView()` gains a `search` block whose `native` boolean is what the card's two different sentences branch on, so the browser hard-codes nothing.
- **The frozen contract moved exactly twice, deliberately.** The fixture diff is **559 insertions and 0 deletions**: the new `api` key and nothing else.

## Task Commits

1. **Task 1: the pluggable fallback search, and the settings routes that configure it** — `809b56f` (feat)
2. **Task 2: the `api` tool surface, the two new tools, and the deliberate move of the frozen contract** — `14e8615` (feat)
3. **Task 3: the third `{{WEB_TOOLS}}` rendering, and its no-search variant** — `436a743` (feat)

**Plan metadata:** this file (docs: complete plan)

## Files Created/Modified

- `server/src/search.ts` — **new.** `SEARCH_PROVIDERS`, `SearchProvider`, `SearchHit`, `SEARCH_SETTING`, `SEARCH_BASE_URL`, `searchProvider`, `searchReady`, `searchWeb`, `tavilySearch`, `searxngSearch`, `testSearch`, `setTavilyEndpoint` (suite only), `MAX_HITS`.
- `server/test/search.test.ts` — **new.** 15 cases against a loopback fake with a request counter: both backends' ordering against a deliberately unsorted three-result fixture with an equal-ranked pair, the limit clamp, three refusals that make no request, three json-disabled shapes, the engine's own 401 sentence verbatim, localhost reached, `testSearch`'s two shapes, and a final case proving neither key was ever echoed.
- `server/src/config.ts` — `SEARCH_KEY_ID = 'search:tavily'`; `TAVILY_API_KEY` in the `EnvKeyName` union and in `ENV_KEYS`.
- `server/src/settings.ts` — `OFF_CATALOGUE_ENV_KEYS` so `envKeyFor` (and therefore `effectiveKey` and `lockedBy`) answers for a key id with no catalogue row; `backendOf`'s doc comment no longer claims `systemPrompt` reads it.
- `server/src/index.ts` — the `// ---------- web search ----------` section: `SearchWrite`, `searchKeyLock`, the three routes, and `searchView()` folded into `settingsView()`.
- `server/src/tools.ts` — the fourth `ToolSurface` member with the one-sentence reason beside it; `'api'` on all fourteen tutor rows; the `fetch_page` and `web_search` rows.
- `server/src/actions.ts` — `fetchPage` and `webSearch`, both in `TUTOR_TOOL_HANDLERS`; the handler map's doc comment records how the four-place rule is satisfied.
- `server/src/library.ts` — `MAX_HTML_BYTES` and `READ_CHARS` exported, so the fetch tool reuses the bounds a library read already uses.
- `server/src/prompt.ts` — `WebSurface`, `webTools(surface)`, `systemPrompt(surface)`; the single `replaceAll` kept.
- `server/src/agent.ts` — the `WebSurface` computed from the resolved tutor through `searchMode`.
- `server/src/drivers/adapters.ts` — the three native search tools, `geminiKeepsTools`, `nativeSearch`, `SearchMode` and `searchMode`.
- `server/src/drivers/api.ts` — `buildTools` reads `toolsFor('api')` with an `omit` set; the native tool registered under the provider's own name; the `verified` increment and the provider-search status line on the `tool-call` part.
- `server/test/wire-surface.test.ts` — `'api'` in `SURFACES`; `TUTOR_TOOLS_BEFORE` / `TOOL_LABELS_BEFORE` renamed to `_AT_PHASE_1` with both lists byte-identical; the label assertion split into "every old entry unchanged" plus "the only additions are these two"; `ALL_TOOL_NAMES.length` 22 -> 24; `live.api.length === 16` added; a leak check for both new tools on the other three surfaces; the bounds assertion left on the **agent** surface.
- `server/test/wire-surface.json` — regenerated once with `DERIVE_WRITE_WIRE_SURFACE=1`.
- `server/test/api-driver.test.ts` — the three `{{WEB_TOOLS}}` cases read off `doStreamCalls[0].prompt[0].content` and `doStreamCalls[0].tools`.
- `server/test/mcp.test.ts` — the order assertion compares the live wire against `toolsFor('mcp')`, plus an explicit "these two never reach the plugin's wire" check.

## Decisions Made

- **A half-configured fallback is `none`, not `fallback`.** The plan's Task 3 wording was `'fallback' when searchProvider() !== 'provider'`. `03-UI-SPEC.md`'s `partial` state is explicit and reasoned in the other direction — *"It behaves exactly as no search at all… The rejected alternative, recorded: silently falling back to the provider's own search, which would leave the learner's selection not meaning what it says."* `searchReady()` is what makes it so, and it gates the prompt and the tool set through the same `searchMode`, so the two still cannot disagree. A `web_search` tool that answers `add a tavily key in settings` to every call is worse than no tool plus an honest instruction.
- **`setTavilyEndpoint` exists because the suite may never reach a real host.** Tavily's endpoint is a constant, and the plan's own verification greps for the absence of `api.tavily.com` in the test file. A suite-only override in `setModelOverride`'s posture is the one way to assert the mapping and the error sentences against a real HTTP answer.
- **The no-search rendering is a phrase, not a sentence.** `{{WEB_TOOLS}}` is substituted into five method sentences that all read it as a name — *"verify it with X before you say it"*, *"when X turns up a source worth keeping"*. A rendering that replaced the name with a standalone instruction would produce ungrammatical method text in four of the five. Opening with `` `fetch_page` only `` and carrying the instruction in a parenthesis composes correctly everywhere and loses nothing D-23 asks for.
- **`nativeSearch` answers from `SEARCH_TOOL` before building an adapter**, so the settings view can ask it about whatever provider happens to be active — including a login row or a local row, where `adapterFor` throws on purpose.
- **REQUIREMENTS.md left unchanged.** `requirements.ready-ids` was asked (without `--raw`, per the known output quirk) and reported all six of `PROV-09, PROV-01..05` **blocked** — correctly: `03-08` and `03-09` still declare `PROV-01..05`, `03-09` still declares `PROV-09`, and neither has a summary. This follows the precedent `03-04` and `03-05` set; the six stay held until the phase's remaining plans close.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `effectiveKey(SEARCH_KEY_ID)` and `lockedBy('key:search:tavily')` both answered nothing**

- **Found during:** Task 1
- **Issue:** The plan specifies the Tavily key is read through `effectiveKey(SEARCH_KEY_ID)` "so the environment variable outranks the file exactly as it does for a provider key", and that a write while `TAVILY_API_KEY` is set is a 409 naming the variable through `lockedBy`. Both route through `settings.ts`'s `envKeyFor(id)`, which reads `providerOf(id)?.envKeys ?? []` — and `search:tavily` has no catalogue row, so `envKeyFor` returned `null`, `effectiveKey` fell straight through to the file, and the field could never be locked.
- **Fix:** A one-entry `OFF_CATALOGUE_ENV_KEYS` table in `settings.ts` consulted only when `providerOf` finds nothing. A provider row with an empty `envKeys` array still short-circuits, so no catalogue row's behaviour changes.
- **Files modified:** `server/src/settings.ts`
- **Verification:** The smoke run showed `key_locked: null` with the variable unset; `pnpm test` green.
- **Committed in:** `809b56f`

**2. [Rule 3 - Blocking] `nativeSearch` was needed in Task 1, a task earlier than the one that fills the adapter rows**

- **Found during:** Task 1
- **Issue:** The plan puts `settingsView().search.native` in Task 1 and the adapter `search` implementations in Task 2. `native` has to be truthful at every point — a learner on a pre-Gemini-3 model must not read *"This provider searches with its own tool. Nothing to configure."*
- **Fix:** `nativeSearch(provider, modelId)` added to `drivers/adapters.ts` in Task 1 (where Task 2 then uses it). It answered `false` for every row until Task 2 filled them in, which is the honest answer at that commit.
- **Files modified:** `server/src/drivers/adapters.ts`
- **Verification:** `pnpm typecheck` and `pnpm test` green at `809b56f`.
- **Committed in:** `809b56f`

**3. [Rule 1 - Bug] `mcp.test.ts` asserted the MCP wire equals the *whole* registry**

- **Found during:** Task 2
- **Issue:** `assert.deepEqual(tools.map(t => t.name), [...ALL_TOOL_NAMES])` — "tools/list must serve the registry in declaration order". That was a correct stand-in only while every registry tool happened to be on the MCP surface. With two `surfaces: ['api']` tools in the registry it failed, and it was the plan's own acceptance criterion that `mcp.test.ts` still pass.
- **Fix:** The assertion now compares the live wire against `toolsFor('mcp').map(s => s.name)` — the MCP surface's own projection in registry declaration order, which is what the sentence always meant. The `length === 22` check and the `MCP_TOOLS_BEFORE` pre-phase set assertion are untouched, and an explicit loop now asserts neither new tool reaches that wire.
- **Files modified:** `server/test/mcp.test.ts`
- **Verification:** `pnpm --filter server exec node --import tsx --test test/mcp.test.ts test/api.test.ts test/wire-surface.test.ts` → 28 pass, 0 fail.
- **Committed in:** `14e8615`

**4. [Rule 2 - Missing Critical] A selected-but-unconfigured fallback would have been announced as a working search**

- **Found during:** Task 3
- **Issue:** Following the plan's literal `searchProvider() !== 'provider'` test, a learner who picked Tavily and had not yet pasted a key would get `web_search` registered and the method text naming it. Every call would then throw `add a tavily key in settings to turn on web search` — a tutor that thinks it can verify and cannot, which is precisely the failure D-23 exists to prevent.
- **Fix:** `searchReady()` in `search.ts` (a key for Tavily, an address for SearXNG) gates `searchMode`, so the half-configured case is `none` on both the prompt side and the tool side. This is what `03-UI-SPEC.md`'s `partial` state specifies.
- **Files modified:** `server/src/search.ts`, `server/src/drivers/adapters.ts`
- **Verification:** `server/test/search.test.ts` asserts `searchReady()` is `false` for both half-configured shapes; the api-driver no-search case asserts 15 tools and no search of any kind.
- **Committed in:** `809b56f` (the predicate) and `14e8615` (the gate)

**5. [Rule 3 - Blocking] `MAX_HTML_BYTES` and `READ_CHARS` were private to `library.ts`**

- **Found during:** Task 2
- **Issue:** The plan says `fetchPage` passes "the same byte cap library.ts already uses for a resource" and bounds its extract "to a readable extract". Both numbers existed, both were module-private, and redeclaring either in `actions.ts` is how two bounds start disagreeing.
- **Fix:** Both exported with a one-line doc comment saying why. No value changed.
- **Files modified:** `server/src/library.ts`
- **Committed in:** `14e8615`

**6. [Rule 1 - Bug] `backendOf`'s doc comment named a caller that no longer exists**

- **Found during:** Task 3
- **Issue:** *"The dialect the two login drivers and systemPrompt() speak."* `systemPrompt` now takes a `WebSurface`, so the comment would have sent a future reader looking for a call that is not there.
- **Fix:** Rewritten to say what reads it now and why the two values could not express the owned loop's answer.
- **Files modified:** `server/src/settings.ts`
- **Committed in:** `436a743`

---

**Total deviations:** 6 auto-fixed (3 blocking, 2 bugs, 1 missing critical)
**Impact on plan:** No scope creep. Four were blockers the plan's own acceptance criteria could not be met without; one is the UI-SPEC's explicitly-resolved `partial` state applied to the server; one is a stale comment. Nothing was added that the plan did not ask for, and no task's `<done>` was weakened.

## Issues Encountered

- **The provider-defined tool type is `'provider'`, not `'provider-defined'`.** The first draft of the native-search assertion compared `t.type === 'provider-defined'` and failed with a confusing `provider: false`. A throwaway probe inside `server/test/` (deleted after) printed `web_search:provider` beside `quiz:function`; the assertion now reads `t.type !== 'function'`, which is the honest question anyway.
- **A probe written into the scratchpad could not run.** `node --import tsx --test` on a file outside the workspace has no `"type": "module"` above it and esbuild refuses top-level await under the CJS output format. Probes have to live inside `server/test/`.
- **`providerSentence` does not unwrap Tavily's `{ detail: { error } }` envelope.** The live smoke run's 401 read `401 {"detail":{"error":"Unauthorized: missing or invalid API key."}}`. That is still the provider's own words and `hintFor` still recognised the 401, which is the contract; extending the envelope list was explicitly not this plan's job (the plan asks for `probe.ts`'s vocabulary reused, not widened). Worth a line in a later plan if the raw JSON reads badly on the card.

## User Setup Required

None — no external service configuration is required. A learner who wants the fallback search pastes a Tavily key or a SearXNG address on the settings page (the card is plan 03-09; the routes are live now), or sets `TAVILY_API_KEY`.

## Next Phase Readiness

- **Ready for 03-07** (the strict dialect projection). The `api` surface key now exists in `wire-surface.json`, which is where 03-07's per-dialect projections hang; the bounds assertion was deliberately left on the **agent** surface so 03-07 can assert the strict dialect's loss of `minItems`/`maxItems` on its own key without touching this one.
- **Ready for 03-09** (the settings web-search card). Everything the card reads is on `GET /api/settings` under `search`: the choice, the key as `{ set, hint }`, `key_locked`, the base URL, and `native` for the active provider. Everything it writes is the three routes, which answer the refreshed view rather than `{ ok: true }`.
- **Unrun human check** (plan Task 3, recorded in `.planning/WINDOWS.md`): no provider key exists in this environment, so five things are unconfirmed on a real key — that a native search status line appears and the right-rail `facts verified on the web` count rises; that `Reading a source` appears for a fetch and the count rises; that an OpenRouter tutor with no search admits uncertainty rather than asserting; that an OpenRouter tutor with a Tavily key actually searches; and that a real SearXNG instance with the json format off produces the `settings.yml` sentence. The plan's `backstop` truth — that the three native tools execute server-side beside the fourteen function tools on a real key and that their per-call charge reaches the ledger — abstains rather than passing silently.

## Self-Check: PASSED

- Files claimed created — `server/src/search.ts` **FOUND**, `server/test/search.test.ts` **FOUND**
- Commits `809b56f`, `14e8615`, `436a743` — all **FOUND** in `git log`; `git rev-list --count a5e02a7d0877d1bbc188d29ed6d5dc9fb2eedb94..HEAD` → **3**, matching `actuals.commits`, and `git rev-parse 809b56f^` → `a5e02a7`, matching `plan_head_before`
- `pnpm method:check` → `method: 6 rendered copies match method/`; `pnpm typecheck` clean in both packages; `pnpm build` exit 0; `pnpm test` → **370 tests, 370 pass, 0 fail** (up from 352 at the dispatch base)
- Task 1 gates: no `assertPublicHost` in `server/src/search.ts` with comments stripped → **0**; no environment read there → **0**; `settings.yml` → 2; `redirect: 'manual'` → 2 (≥2 required); `providerSentence|hintFor|isLocalUrl` → 6 (≥3 required); `SEARCH_KEY_ID|TAVILY_API_KEY` in `config.ts` → 3 (≥3 required); no `api.tavily.com` in the suite → **no match**; `test/search.test.ts` → **15 pass, 0 fail**
- Task 2 gates: the `node -e` surfaces script prints `surfaces ok`; the agent-vs-api parity script prints `parity structural` (the fourteen `api` rows are byte-identical to the fourteen `agent` rows); `toolsFor('api')` in `drivers/api.ts` → 2; `Reading a source` in `tools.ts` → 1; `Verifying with a web search` → 1 in `tools.ts` and 1 in `drivers/api.ts`; `fetchPublic(` in `actions.ts` → 1; `verified` in `drivers/api.ts` → 4 (≥3 required); no `fetch_page|web_search` in `mcp.ts` or `agent.ts` with comments stripped → **0**, and none in either `plugin/commands/*.md`; `test/mcp.test.ts` + `test/api.test.ts` + `test/wire-surface.test.ts` → **28 pass, 0 fail**
- Task 3 gates: `git diff --quiet -- server/src/method.generated.ts method/` → **clean**; the `node -e` prompt script prints `prompt surface ok`; `unsure` in `prompt.ts` → 3; the `node -e` placeholder-guard script prints `placeholder guard present`; `test/api-driver.test.ts` → **34 pass, 0 fail**
- Fixture move reviewed before committing: `git diff --stat server/test/wire-surface.json` → **559 insertions, 0 deletions**; `agent=14 api=16 mcp=22 http=16`; the two new tools appear on **0** surfaces outside `api`
- Key links: `actions.ts`→`library.ts` (`fetchPublic\(|assertPublicHost`) → 3; `actions.ts`→`search.ts` (`searchWeb\(`) → 1; `drivers/api.ts`→`tools.ts` (`toolsFor\('api'\)`) → 2; `prompt.ts`→`method.generated.js` (`replaceAll\('\{\{WEB_TOOLS\}\}'`) → 1; `index.ts`→`keys.ts` (`setKey\(|keyView\(`) → 5
- Stub scan over the plan's own diff: no `TODO`, `FIXME`, "coming soon" or "not available"; the only `placeholder` matches are three assertion messages about the `{{WEB_TOOLS}}` template placeholder. **No `## Known Stubs` section is owed.**
- Threat surface: every new surface this plan opens is already in the plan's `<threat_model>` (T-03-36..T-03-44). **No `## Threat Flags` section is owed.**

---
*Phase: 03-owned-loop-api-keys-and-gateways*
*Completed: 2026-10-12*
