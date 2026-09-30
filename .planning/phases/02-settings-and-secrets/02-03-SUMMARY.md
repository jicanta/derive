---
phase: 02-settings-and-secrets
plan: 03
subsystem: settings
tags: [providers, model-list, connection-test, datalist, redirects, redaction, hono, react, node:test]

# Dependency graph
requires:
  - phase: 02-settings-and-secrets (plan 01)
    provides: the provider catalogue (endpoint, modelsPath, auth, optionalKey per row), settings routes, rowView.has_models_endpoint
  - phase: 02-settings-and-secrets (plan 06)
    provides: probe.ts (probeJson, claudeLoggedInAsync), localBase, portOf, the /settings page and ProviderRow with the model field
  - phase: 02-settings-and-secrets (plan 02)
    provides: effectiveKey (environment over file), the key field and base URL input on the row, safeMessage as the redaction chokepoint
provides:
  - "probe.ts: REMOTE_MS, LOCAL_MS, TestResult, ModelsRequest, isLocalUrl, requestFor, idsOf, providerSentence, hintFor, getJson, listModels, testConnection"
  - "POST /api/settings/:provider/models → { models } or 502 { error }; POST /api/settings/:provider/test → TestResult, always 200; 404 on an unknown row"
  - "web: TestResult type; api.providerModels, api.testProvider; the datalist combobox, fetch models, test connection and the one-line result on ProviderRow"
  - "server/test/settings.test.ts: a loopback fake provider (good key, two-line 401, 302, HTML 200) and pure request/normalisation cases — 75 cases in the file, 276 in the suite"
affects: [02-04 header pill and doctor, 03 owned-loop drivers reading requestFor's headers and listModels, 04 local-model drivers]

# Actuals (#2632) — chars/4 over the realized diff ca36d35..HEAD across server/ and web/
actuals:
  tokens: 11158
  tasks: 2
  commits: 2
plan_head_before: ca36d35a63445a6151a80f78993f3c5124e3f80a

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One adapter table for every provider call: requestFor reads the catalogue (endpoint, modelsPath, auth) and puts the key in the header that provider reads — never in a URL — and only when one is set; idsOf normalises by spec.id; nothing else in the codebase names a provider host"
    - "A provider's failure is `${status} ${sentence}` verbatim, collapsed to one line and cut at 300, and Derive's fix hint is a separate field: the two are never merged"
    - "Outbound provider fetches use redirect: 'manual' and treat any 3xx as a failure sentence, so a learner-set base URL cannot forward the key to a third host"
    - "Local versus remote is judged on the literal host of the URL (isLocalUrl, no lookup): it picks the 4 s / 8 s bound and whether an unreachable host reads `nothing answered at host:port` or `could not reach host: reason`"
    - "Every sentence a test answers passes through safeMessage; the suite proves neither the good nor the wrong key appears in any body"
    - "The native <input list> + <datalist> combobox: one control whose list is empty until a fetch, so D-08's failure behaviour costs no second control"

key-files:
  created: []
  modified:
    - server/src/probe.ts
    - server/src/index.ts
    - server/test/settings.test.ts
    - web/src/lib/types.ts
    - web/src/lib/api.ts
    - web/src/components/ProviderRow.tsx

key-decisions:
  - "Per 02-03 local versus remote (the timeout and the unreachable sentence) is decided by the literal host of the request URL, not by the row: an OpenAI-compatible row pointed at loopback or a private range gets the 4 s bound and `nothing answered at host:port`, which is what the suite's closed-port case asserts; no DNS lookup is made, because the question is which sentence to write, not whether the request is allowed"
  - "Per 02-03 requestFor sends no authorization header at all when no key is set, rather than an empty one: a key row tested without a key reaches the provider unauthenticated and reads its real 401 plus Derive's hint, and a local server started without a token never sees an Authorization line"
  - "Per 02-03 the models and test HTTP cases run on their own spawn with their own fakes rather than being interleaved into plan 06's detection suite, whose later cases repoint Ollama and LM Studio at a closed port; the fakes carry the richer bodies the plan asked for (Ollama tag names, LM Studio states, a llama.cpp /v1/models route)"
  - "Per 02-03 the line under the combobox keeps the save states first — lock, save error, saved tick, saving — then the fetch failure sentence, then the fetched count, then the default lines, so a typed id still gets its tick after a fetch"
  - "Per 02-03 a failure of Derive's own test route (not the provider's answer) renders on the same result line as `{ ok: false, error, ms: 0 }`; the route itself never throws for a provider failure"

patterns-established:
  - "fakeProvider(goodKey, elsewhere) in settings.test.ts: one node:http server that is a whole OpenAI-compatible provider on loopback — good-key list with a duplicate, two-line 401 for any other key, a 302 to a port nobody listens on, an HTML 200 — so every network case in the suite is hermetic"
  - "Pure request assertions for the remote rows: requestFor and idsOf are checked as data (header names, URL suffixes, no `key=`) and the test file names no real provider host"

requirements-completed: [SET-04, SET-05]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "POST /api/settings/:provider/models fetches the OpenAI-compatible row's list with the stored key and base URL and answers the ids de-duplicated in the provider's order"
    requirement: SET-04
    verification:
      - kind: integration
        ref: "server/test/settings.test.ts#fetches the models of an OpenAI-compatible endpoint with the stored key, de-duplicated and in the provider order"
        status: pass
    human_judgment: false
  - id: D2
    description: "idsOf normalises every provider shape: data[].id, Gemini's models[].name with the prefix stripped and filtered to generateContent, Ollama's tag names verbatim, LM Studio's loaded models first (stable), duplicates dropped, a strange body read as empty"
    requirement: SET-04
    verification:
      - kind: unit
        ref: "server/test/settings.test.ts#normalises each provider list to ids in its order, de-duplicated, and reads a strange body as empty"
        status: pass
      - kind: integration
        ref: "server/test/settings.test.ts#lists Ollama tags verbatim, LM Studio loaded models first, and tests llama.cpp on its models route"
        status: pass
    human_judgment: false
  - id: D3
    description: "requestFor puts the key in the header each provider reads (x-api-key + anthropic-version, x-goog-api-key, Bearer) and never in the URL, joins /v1/models onto a base with or without /v1, sends no authorization without a key, refuses a list for a login row, and asks for the base URL first on the OpenAI-compatible row"
    requirement: SET-04
    verification:
      - kind: unit
        ref: "server/test/settings.test.ts#sends the key in the header each provider reads, and never in the URL"
        status: pass
      - kind: unit
        ref: "server/test/settings.test.ts#joins /v1/models onto a base that already ends in /v1, and sends no authorization without a key"
        status: pass
      - kind: unit
        ref: "server/test/settings.test.ts#refuses a list for a login row and for the OpenAI-compatible row without a base URL"
        status: pass
      - kind: integration
        ref: "server/test/settings.test.ts#asks for the base URL first when the OpenAI-compatible row has none"
        status: pass
    human_judgment: false
  - id: D4
    description: "POST /api/settings/:provider/test answers ok with the model count and a non-negative latency for a key or local row, ok with models null for a login (Codex by its auth file, Claude Code by its CLI), and a failure sentence when the login is absent"
    requirement: SET-05
    verification:
      - kind: integration
        ref: "server/test/settings.test.ts#reports Connected with the model count and a latency"
        status: pass
      - kind: integration
        ref: "server/test/settings.test.ts#tests the Codex login by its auth file, Claude Code by its CLI, and refuses a list for either"
        status: pass
    human_judgment: false
  - id: D5
    description: "A provider's 401 is quoted verbatim after its status, its two-line body collapsed to one line, with Derive's hint as a separate field; the models route answers the same sentence as a 502; every envelope shape unwraps and the sentence is cut at 300"
    requirement: SET-05
    verification:
      - kind: integration
        ref: "server/test/settings.test.ts#quotes the provider 401 verbatim on one line, with the fix hint beside it, on the test and on the list"
        status: pass
      - kind: unit
        ref: "server/test/settings.test.ts#unwraps every error envelope into status plus the sentence, on one line, cut at 300"
        status: pass
      - kind: unit
        ref: "server/test/settings.test.ts#adds a hint only for the cases it recognises"
        status: pass
    human_judgment: false
  - id: D6
    description: "A 3xx from the endpoint is refused with a 302 sentence and never followed; a 200 that is not JSON says so; a closed port reads `nothing answered at 127.0.0.1:port` within the local bound; remote hosts get 8 s and local ones 4 s"
    requirement: SET-05
    verification:
      - kind: integration
        ref: "server/test/settings.test.ts#refuses to follow a redirect that could carry the key"
        status: pass
      - kind: integration
        ref: "server/test/settings.test.ts#says when the answer was not JSON, with its status"
        status: pass
      - kind: integration
        ref: "server/test/settings.test.ts#names the address in its own sentence when nothing answered"
        status: pass
      - kind: unit
        ref: "server/test/settings.test.ts#tells a local address from a remote one by the literal host alone"
        status: pass
      - kind: other
        ref: "grep -c \"REMOTE_MS = 8_000\\|LOCAL_MS = 4_000\\|redirect: 'manual'\" server/src/probe.ts"
        status: pass
    human_judgment: false
  - id: D7
    description: "Neither the good key nor the wrong key appears in any of the 29 response bodies the suite reads, including the provider's echo of it; every test sentence passes through safeMessage"
    requirement: SET-05
    verification:
      - kind: integration
        ref: "server/test/settings.test.ts#never echoes the good key or the wrong one in any response"
        status: pass
      - kind: other
        ref: "grep -c 'safeMessage(' server/src/probe.ts"
        status: pass
    human_judgment: false
  - id: D8
    description: "The suite never calls a real provider host: every network case runs against loopback fakes and the test file names no catalogue host"
    requirement: SET-05
    verification:
      - kind: other
        ref: "! grep -q 'api.anthropic.com\\|api.openai.com\\|openrouter.ai\\|googleapis.com' server/test/settings.test.ts"
        status: pass
    human_judgment: false
  - id: D9
    description: "The model field is one native combobox: the datalist fills on fetch models (`fetching…` while in flight), the line under it reads `N models fetched` / `1 model fetched` / `0 models fetched · type an id` or the provider's sentence in rust, and a typed id still saves; no second control, no fetch button on rows without a models endpoint; a 60-character local id scrolls inside the 40 px input"
    requirement: SET-04
    verification:
      - kind: other
        ref: "pnpm --filter web build (tsc -b under noUnusedLocals) + acceptance greps for list={`models-${row.id}`}, <datalist, fetching…, models fetched, 0 models fetched · type an id, and ! grep <select"
        status: pass
    human_judgment: true
    rationale: "No web test runner exists; the native datalist popup, the typeable-after-failure behaviour and the long-id backstop are seen only in a browser (Task 2 <human-check>, harvested at end of phase)"
  - id: D10
    description: "test connection reads `testing…`, clears the previous line, and renders one mono line with role=status, truncated with the full text in title: `Connected · N models · ms` / `Logged in · ms` in moss, or the provider's sentence in rust with the hint on the next line in 14 px ink-300; at 360 px a two-line sentence and a two-line hint still read as one row"
    requirement: SET-05
    verification:
      - kind: other
        ref: "pnpm --filter web build + acceptance greps for testing…, Connected · , Logged in · , role=\"status\", truncate"
        status: pass
    human_judgment: true
    rationale: "The one-line truncation, the hint placement and the UI-SPEC's unresolved 360 px consideration are visual (Task 2 <human-check>)"

# Metrics
duration: 11min
completed: 2026-09-30
status: complete
---

# Phase 2 Plan 03: Model lists and connection tests through one adapter table Summary

**Every one of the ten rows now fetches its model list and tests its connection through one adapter table in `probe.ts` that sends the key only in a header to that row's own host, refuses redirects, quotes the provider's sentence verbatim with Derive's hint as a separate field, and never quotes a closed port as if the provider had spoken; the row's model field is one native datalist combobox with `fetch models`, `test connection` and a one-line result.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-09-30T22:28:14Z
- **Completed:** 2026-09-30T22:39:26Z
- **Tasks:** 2
- **Files modified:** 6 (0 created)

## Accomplishments

- `server/src/probe.ts` gains the adapter table: `requestFor(spec, key, base)` builds the URL and headers from the catalogue (Anthropic `x-api-key` + `anthropic-version: 2023-06-01`, Google `x-goog-api-key` and never `key=`, Bearer for OpenAI, OpenRouter, the OpenAI-compatible row and the two local servers that may carry a token, nothing for Ollama; logins throw `has no model list`; the OpenAI-compatible row throws `Add the endpoint's base URL first`); `idsOf(spec, body)` normalises every answer to ids in the provider's order with duplicates dropped, Gemini filtered to `generateContent`, LM Studio's loaded models first; `providerSentence(status, text)` unwraps `error.message`, a string `error`, Anthropic's envelope or a top-level `message` into `status sentence` collapsed to one line and cut at 300; `hintFor` answers the refused-key, credit and rate-limit cases as a separate string; `getJson` uses `redirect: 'manual'`, treats a 3xx as a failure sentence, bounds at `REMOTE_MS = 8_000` or `LOCAL_MS = 4_000` by the literal host (`isLocalUrl`), and turns a host that never answered into `nothing answered at host:port` or `could not reach host: reason`; `listModels(id)` and `testConnection(id)` are the two entry points, the test always answering `TestResult` through `safeMessage`.
- `server/src/index.ts`: `POST /api/settings/:provider/models` (404 unknown, `{ models }`, 502 with the sentence on any failure) and `POST /api/settings/:provider/test` (404 unknown, always 200 with the result); the `err` helper's union now includes `409 | 502`.
- `server/test/settings.test.ts` grows from 59 to 75 cases: a `fakeProvider` on loopback (good key lists `tiny-b, tiny-a, tiny-a`; any other key gets a two-line OpenAI 401; `/redirect` answers a 302 to a port nobody listens on; `/html` answers a text/html 200), the ten HTTP cases the plan listed on their own hermetic spawn with a private `CODEX_HOME`, and seven pure cases over `requestFor`, `idsOf`, `providerSentence`, `hintFor` and `isLocalUrl`. The last HTTP case walks every body the suite read and proves neither key appears. The file names no real provider host.
- `web/src/lib/types.ts` `TestResult`; `web/src/lib/api.ts` `providerModels`, `testProvider`.
- `web/src/components/ProviderRow.tsx`: the model input carries `list="models-{id}"` with a `<datalist>` of the last fetched ids (empty before a fetch, so the field renders exactly as before); the line under it now reads the fetch failure sentence in rust or `{N} models fetched` / `1 model fetched` / `0 models fetched · type an id` ahead of the plan-06 default lines; an actions line with `fetch models` (only where `has_models_endpoint`) → `fetching…` and `test connection` → `testing…`, both disabled in flight; the result `ml-auto` on one mono line with `role="status"`, `truncate` and the full text in `title` — `Connected · N models · ms` or `Logged in · ms` in moss-400, the sentence in rust-400 with the hint beneath in 14 px ink-300. No toast, no second control.

## Task Commits

1. **Task 1: One adapter table — model lists, the cheapest real test, the provider's verbatim sentence** — `5ec86b3` (feat)
2. **Task 2: The combobox, fetch models, test connection and the one-line result** — `dd52ec9` (feat)

**Plan metadata:** the docs commit carrying this file.

## Files Created/Modified

- `server/src/probe.ts` — `REMOTE_MS`, `LOCAL_MS`, `TestResult`, `ModelsRequest`, `isLocalUrl`, `requestFor`, `idsOf`, `providerSentence`, `hintFor`, `getJson`, `listModels`, `testConnection`; header extended to describe the two entry points
- `server/src/index.ts` — the two routes; `err` union widened
- `server/test/settings.test.ts` — `fakeProvider`, the models/test HTTP suite, the pure suite
- `web/src/lib/types.ts` — `TestResult`
- `web/src/lib/api.ts` — `providerModels`, `testProvider`
- `web/src/components/ProviderRow.tsx` — datalist combobox, `fetchModels`, `test`, the actions line and result

## Decisions Made

- Local versus remote (timeout and unreachable sentence) is judged on the literal host of the request URL with no lookup: loopback, link-local, RFC 1918, CGNAT, `localhost`, `.local`, `::1`, `fc00::/7`, `fe80::/10`. An OpenAI-compatible row on loopback therefore gets `nothing answered at 127.0.0.1:port` and the 4 s bound, which is what the suite's closed-port case asserts. This decides which sentence to write, never whether the request is allowed (T-02-17 is accepted as the plan records).
- `requestFor` omits the authorization header entirely when no key is set rather than sending an empty one, so a key row tested before a key is pasted reads the provider's own 401 plus the hint, and a local server without a token never sees an `Authorization` line.
- The models/test HTTP cases run on their own spawn and their own fakes instead of being threaded into plan 06's detection suite: its later cases repoint Ollama and LM Studio at a closed port, and interleaving would have coupled the cases to their order. The new fakes carry the bodies the plan asked for (Ollama tag names, LM Studio `state`, a llama.cpp `/v1/models`).
- The line under the combobox keeps the save states first (lock, save error, saved tick, saving), then the fetch failure, then the fetched count, then the default lines, so a typed id still shows its tick after a fetch.
- A failure of Derive's own test route renders on the result line as `{ ok: false, error, ms: 0 }`; provider failures never throw from the route.

## Deviations from Plan

None - plan executed exactly as written.

**Total deviations:** 0 auto-fixed.
**Impact on plan:** None.

## Issues Encountered

- The first run of the pure `providerSentence` case failed on my own fixture: a raw newline inside a single-quoted TypeScript string is not valid JSON, so the function correctly fell back to the raw text. The fixture now carries a JSON `\n` escape, as the fake provider's `JSON.stringify` does over HTTP; the production code was unchanged.
- The repo's PreToolUse hook rejects a Bash call that pairs the gsd guard command with `git commit`; guards and commits ran as separate calls, hooks on, no `--no-verify`.

## Verification

- Task 1: `pnpm build && pnpm --filter server exec node --import tsx --test test/settings.test.ts` → 75 tests, `# fail 0`; `! grep -q "api.anthropic.com\|api.openai.com\|openrouter.ai\|googleapis.com" server/test/settings.test.ts` → no real host named; `grep -c "safeMessage(" server/src/probe.ts` → 1. All 16 acceptance greps PASS.
- Task 2: `pnpm --filter web build` → exit 0, no `error TS`; `grep -c "<datalist"` → 1; `! grep -q "<select"` → PASS; `pnpm method:check && pnpm typecheck && pnpm build && pnpm test` → 6 copies match, both typechecks Done, 276 tests `# fail 0`; `git diff --quiet -- server/test/wire-surface.json` → unchanged. All 15 acceptance greps PASS.

## Human check (harvested at end of phase)

With Ollama or any OpenAI-compatible server on this machine, set the base URL on its row and press `fetch models`: the datalist offers the ids, `N models fetched` appears under the field, and a 60-character id such as `qwen/qwen3-8b-instruct-q4_k_m:latest-long-tag-for-the-check` scrolls inside the 40 px input without breaking the row. Press `test connection` on the Anthropic row with a wrong key: `401 …` in rust on one line with the refused hint on the next; at 360 px width the two-line sentence and two-line hint still read as one row (the UI-SPEC's one unresolved consideration). Press `test connection` on Claude Code: `Logged in · N ms`. The multi-line-body backstop is already proven server-side (the fake's two-line 401 reads as one line in the suite).

## Threat Flags

None beyond the plan's register. The four boundaries it names are the ones touched: keys travel only in headers to the catalogue host or the learner's stored base URL (T-02-16 pure case), redirects are refused (T-02-15 case), every sentence passes `safeMessage` and the suite asserts both keys absent (T-02-14), the bounds are `AbortSignal.timeout` at 8 s / 4 s and the routes touch no turn (T-02-18), fetched ids are datalist suggestions and a stored model still passes the PUT charset (T-02-19). T-02-17 stays accepted as the plan records.

## Known Stubs

None. The datalist starts empty by design (D-08: no list until a fetch), and every line and button on the row is wired to the two routes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 04 (header pill, doctor, `.env.example`, nav links) has nothing to wait for here; the row is complete.
- Phase 3's drivers can read `requestFor` for the header each provider takes and `listModels` for a model check before a turn; `isLocalUrl` gives them the same local/remote bound.
- Phase 4's local-model drivers get `idsOf`'s loaded-first order for LM Studio and the verbatim Ollama tags.
- The end-of-phase human check for this plan is recorded above.

## Self-Check: PASSED

- Modified files exist: `server/src/probe.ts`, `server/src/index.ts`, `server/test/settings.test.ts`, `web/src/lib/types.ts`, `web/src/lib/api.ts`, `web/src/components/ProviderRow.tsx` — FOUND
- Commits exist: `5ec86b3`, `dd52ec9` — FOUND in `git log`
- `commits: 2` measured as `git rev-list --count ca36d35..HEAD`; `plan_head_before` is the ledger the first commit was taken against
- All acceptance criteria of both tasks re-run and logged PASS; plan-level verification green; wire surface unchanged

---
*Phase: 02-settings-and-secrets*
*Completed: 2026-09-30*
