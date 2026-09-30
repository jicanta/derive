---
phase: 02-settings-and-secrets
plan: 06
subsystem: api
tags: [settings, detection, probe, base-url, react, hono, node:test]

# Dependency graph
requires:
  - phase: 02-settings-and-secrets
    provides: plan 01's providers.ts catalogue, settings.ts resolvers and the detection observation (rememberDetection / lastDetection / resetDetection / baseUrlKey), the settings routes, rowView and settingsView
provides:
  - server/src/probe.ts — probeJson (manual redirects, 400 ms bound), isOllama / isLmStudio / isLlamaCpp shape checks, claudeLoggedInAsync reading only loggedIn, detect() as one Promise.all that ends in rememberDetection
  - server/src/settings.ts — localBase, portOf, normaliseBaseUrl with the three refusal sentences
  - POST /api/settings/detect answering settingsView(); base_url on PUT /api/settings/:provider (fixed-endpoint rows refuse it, empty returns to the catalogue default)
  - web: the /settings route, SettingsPage, ProviderRow, types ProviderStatus / ProviderView / TutorChoice / Settings, api keys settings / detectProviders / activeTutor / setProvider / useProvider
  - server/test/settings.test.ts — loopback fake Ollama / LM Studio / llama.cpp servers, the HTML-200 case, the closed-port bound, base URL cases, the detect spawn count (43 cases)
affects: [02-02 key field and base URL input on the rows, 02-03 fetch models and test connection, 02-04 header pill and nav links, 02-05 learner override, 03 owned-loop drivers reading localBase]

# Actuals (#2632) — chars/4 over the realized diff, measured against the plan ledger
actuals:
  tokens: 11840
  tasks: 2
  commits: 2
plan_head_before: 2fadc3e689feea7e286bb98d4232a14ba7d0cd7a

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Detection is a probe of a JSON shape, never an open port: each local server is asked the one endpoint only it answers and found only when the body has that server's shape; a foreign process on a default port reads `not configured` with no sentence"
    - "One awaited pass per POST /api/settings/detect — async CLI spawn plus loopback probes in one Promise.all, bounded per probe — and nothing runs it on a timer; the page calls it on open and on rescan only"
    - "A learner-typed base URL is normalised once at the write (http/https only, no credentials, no query or fragment, origin plus path with no trailing slash) so every later probe and request joins a path onto a clean base"
    - "The settings page renders what GET /api/settings returns and hard-codes no provider fact: labels, notes, defaults, ports, statuses and group ids all come from the row"
    - "Per-field save on the row with the /you state machine (idle → saving → saved → idle, 1800 ms); Use this provider is optimistic and reverts on a refusal, whose sentence renders verbatim"

key-files:
  created:
    - server/src/probe.ts
    - web/src/pages/Settings.tsx
    - web/src/components/ProviderRow.tsx
  modified:
    - server/src/settings.ts
    - server/src/index.ts
    - server/test/settings.test.ts
    - web/src/lib/types.ts
    - web/src/lib/api.ts
    - web/src/main.tsx

key-decisions:
  - "localBase returns string | null rather than the plan's string: the OpenAI-compatible row has no catalogue endpoint, so null is the honest answer where the learner has stored none, and detect() skips a row whose base is null instead of probing an empty string"
  - "The model field compares its value against the effective value (stored, else the catalogue default) rather than the stored value alone, so tabbing through a row whose default is preselected writes nothing and the row stays on the catalogue default; clearing the field still deletes the stored id"
  - "Rescan flips login and local rows to `checking` in the browser before the pass answers, matching the server, which resets the observation before it probes; stored keys and environment locks are facts the pass does not change and keep their pill"
  - "The detect HTTP cases run on their own spawn with a private CODEX_HOME: there is no API that unsets the active provider, and writing an auth.json into the shared scratch home would sign the other spawns and the in-process suite in"
  - "isLlamaCpp is a shape, not a schema: it reads status and error.type and ignores every other key, so a 200 carrying `status: ok` beside extra fields still passes; the test records which way the check goes"

patterns-established:
  - "Fake local servers in the suite: one node:http server per shape on a loopback port from listen(0), plus one answering HTTP 200 text/html on every path (the FreqUI case), and a freePort() nobody listens on for the closed-port bound"
  - "Spawn counting for detection: the plan-01 `claude` shim proves POST /detect spawns exactly once per pass and the reads that follow spawn nothing"

requirements-completed: [SET-03, SET-01]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "POST /api/settings/detect runs both logins and the three local probes in one pass and fills the login and local statuses; GET /api/settings reads the pass without spawning; local rows read `checking` until a pass has looked"
    requirement: SET-03
    verification:
      - kind: integration
        ref: "server/test/settings.test.ts#finds the Codex login and the three local servers at their stored bases in one pass"
        status: pass
      - kind: integration
        ref: "server/test/settings.test.ts#reads checking on the local rows until a pass has looked"
        status: pass
      - kind: integration
        ref: "server/test/settings.test.ts#spawns the CLI exactly once per detect pass, and not for the reads that follow"
        status: pass
    human_judgment: false
  - id: D2
    description: "A port that answers with something other than the expected JSON shape (HTML 200 on the llama.cpp base) reads `not configured`, never `found on port N`; a closed port answers within two seconds"
    requirement: SET-03
    verification:
      - kind: integration
        ref: "server/test/settings.test.ts#reads an HTML 200 on the llama.cpp base as not configured, never as found"
        status: pass
      - kind: integration
        ref: "server/test/settings.test.ts#answers within two seconds when the llama.cpp base is a closed port"
        status: pass
      - kind: unit
        ref: "server/test/settings.test.ts#checks the shape each local server answers with, and nothing else about the body"
        status: pass
    human_judgment: false
  - id: D3
    description: "With nothing stored or set in the environment, the pass leaves Codex detected when only Codex is logged in (real auth.json over HTTP) and Claude Code when nothing is, with every login and local row `not configured`"
    requirement: SET-03
    verification:
      - kind: integration
        ref: "server/test/settings.test.ts#leaves Codex detected when only Codex is logged in and nothing is stored"
        status: pass
      - kind: integration
        ref: "server/test/settings.test.ts#falls back to Claude Code when nothing is logged in, with every login and local row not configured"
        status: pass
    human_judgment: false
  - id: D4
    description: "A local or OpenAI-compatible row stores a base URL through PUT /api/settings/:provider — http or https only, no credentials, no query or fragment, origin plus path without a trailing slash — a fixed-endpoint row refuses it, empty returns to the catalogue default, and the pass probes the stored base"
    requirement: SET-03
    verification:
      - kind: integration
        ref: "server/test/settings.test.ts#refuses a base URL on a row with a fixed endpoint"
        status: pass
      - kind: integration
        ref: "server/test/settings.test.ts#refuses a base URL that is not http or https, carries credentials, or has a query"
        status: pass
      - kind: integration
        ref: "server/test/settings.test.ts#stores a base URL as origin plus path without a trailing slash, and clears it with an empty string"
        status: pass
      - kind: unit
        ref: "server/test/settings.test.ts#normalises a base URL to origin plus path with no trailing slash"
        status: pass
      - kind: unit
        ref: "server/test/settings.test.ts#reads a local base from the table first and the catalogue second, and null where neither names one"
        status: pass
    human_judgment: false
  - id: D5
    description: "Detection never forwards the identity `claude auth status` prints: the detect body carries no `email` key, and probe.ts / settings.ts read the environment only through config.ts"
    requirement: SET-03
    verification:
      - kind: integration
        ref: "server/test/settings.test.ts#falls back to Claude Code when nothing is logged in, with every login and local row not configured"
        status: pass
      - kind: other
        ref: "! grep -q 'process.env' server/src/probe.ts server/src/settings.ts && grep -c \"redirect: 'manual'\" server/src/probe.ts"
        status: pass
    human_judgment: false
  - id: D6
    description: "The /settings page has no page-level Save control and schedules no detection pass of its own; the only requests are mount, rescan and the learner's own actions"
    requirement: SET-01
    verification:
      - kind: other
        ref: "! grep -q 'Save</button>\\|type=\"submit\"' web/src/pages/Settings.tsx && ! grep -q 'setInterval\\|setTimeout(.*detectProviders' web/src/pages/Settings.tsx"
        status: pass
      - kind: other
        ref: "pnpm --filter web build (tsc -b under noUnusedLocals, then vite build)"
        status: pass
    human_judgment: false
  - id: D7
    description: "The learner opens /settings, sees ten rows in three groups with their status pills and one gold `teaching now` row, presses Use this provider on a logged-in row (the gold row flips at once with the saved tick), types a model id that saves on blur with the tick, and presses rescan (`scanning…`, first paint never waits on the pass); after a restart the same provider is active"
    requirement: SET-01
    verification: []
    human_judgment: true
    rationale: "Task 2's <human-check> (end-of-phase mode): the page's look, the optimistic flip, the saved tick and the quiet network tab are visual and interactive; the API half of persistence is proven in plan 01's restart case"
  - id: D8
    description: "Rows render in catalogue order and keep their position; the active row is marked, never moved; every label, note, default, port and status comes from the API"
    requirement: SET-03
    verification: []
    human_judgment: true
    rationale: "The plan classes this prohibition as judgment: Settings.tsx filters rows by the API's group id and never sorts, and ProviderRow reads every fact from the row, but no test renders the page"

# Metrics
duration: 10min
completed: 2026-09-30
status: complete
---

# Phase 2 Plan 06: Detection and the Settings Page Summary

**One on-demand detection pass — an async `claude auth status`, the Codex auth file and shape-checked loopback probes of Ollama, LM Studio and llama.cpp at their stored or default base — behind `POST /api/settings/detect`, normalised base URLs on the PUT, and a `/settings` page that renders every provider row from the API, saves the model per field with a tick, and makes a logged-in row the tutor with one optimistic click.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-09-30T19:22:59Z
- **Completed:** 2026-09-30T19:32:27Z (code); SUMMARY written after
- **Tasks:** 2
- **Files modified:** 9 (3 created, 6 modified)

## Accomplishments

- `server/src/probe.ts`: `probeJson` (accept JSON, `redirect: 'manual'`, `AbortSignal.timeout(400)`, null on anything that did not answer, `body: null` on non-JSON), `isOllama` / `isLmStudio` / `isLlamaCpp` reading exactly the field each server is known for (llama.cpp's 503 `unavailable_error` still counts while a model loads), `claudeLoggedInAsync` through a promisified `execFile` with the sync detector's argv and 15 s cap reading only `loggedIn`, and `detect()` as one `Promise.all` that ends in `rememberDetection({ logins, local })`.
- `server/src/settings.ts`: `localBase(spec)` (stored `base_url:<id>` else the catalogue endpoint), `portOf(base)` (named port or the scheme default), `normaliseBaseUrl(raw)` with the three refusal sentences and origin-plus-path storage.
- `server/src/index.ts`: `base_url` on `SettingsWrite` (≤ 500 chars), refused with `{label} has a fixed endpoint` on any row that is neither `key+url` nor local, stored normalised or deleted on an empty string; `POST /api/settings/detect` resets the observation, awaits the pass and answers `settingsView()` so the page repaints from one shape.
- `server/test/settings.test.ts` grows from 27 to 43 cases: a `detection over HTTP` spawn with a private `CODEX_HOME`, three fake local servers plus the HTML-everywhere FreqUI server on loopback ports, the closed-port bound, the four base URL refusals and the stored form, the codex-only and nobody-logged-in detection orders proven with a real `auth.json`, the no-`email` assertion on the detect body, the exactly-one-spawn-per-pass case on the plan-01 `claude` shim, and module cases for the pure helpers.
- `web/src/pages/Settings.tsx`: the `/you` header shape with `Settings · which model teaches`, the intro paragraph verbatim, the teaching-now line (`{label} · {model or default model}`, source pill `from settings` / `detected` / `set from environment`, `checking` with the pulsing dot while the pass is in flight, the D-11 sentence under a locked provider, `rescan` → `scanning…`), three eyebrow groups at `mt-8` with rows at `gap-6` in API order; `api.settings()` on mount then one `api.detectProviders()`, rescan the only other pass, a load failure rendered in rust where the line would be with rescan as the retry; optimistic `onUse` that reverts and rethrows on a refusal.
- `web/src/components/ProviderRow.tsx`: the quiet card and its gold active variant, the status pill with moss / ink-400 / ink-600 / pulsing ink-500 dots, `teaching now` on the active row, the filled `Use this provider` on non-active teaching rows (disabled with `Nothing to use yet: log in or paste a key first` while `not configured` or `checking`, and with the D-11 sentence while locked), nothing on unwired rows; the model field (`field` class, mono, `aria-label="{label} model"`, prefilled with the stored id else the default) saving on blur or Enter only when the value changed, with `saved · applies from the next turn`, `default as of {date}`, `Codex's own default applies`, the server's sentence in rust on failure keeping the typed value, and the `DERIVE_MODEL` lock rendering.
- `web/src/lib/types.ts` and `api.ts`: `ProviderStatus`, `ProviderView`, `TutorChoice`, `Settings`; `settings`, `detectProviders`, `activeTutor`, `setProvider`, `useProvider`. `web/src/main.tsx`: the `/settings` route.

## Task Commits

1. **Task 1: Detection — logins and local servers, on demand, shape-checked; base URLs stored and normalised** — `c9dee7c` (feat)
2. **Task 2: The /settings page — rows, status pills, model field, Use this provider, rescan** — `9845b8d` (feat)

## Files Created/Modified

- `server/src/probe.ts` — the detection pass and its probes
- `server/src/settings.ts` — `localBase`, `portOf`, `normaliseBaseUrl`
- `server/src/index.ts` — `base_url` on the PUT, `POST /api/settings/detect`
- `server/test/settings.test.ts` — the fake local servers, the HTML-200 case, base URL cases, the detect spawn count, module cases
- `web/src/pages/Settings.tsx` — `SettingsPage`
- `web/src/components/ProviderRow.tsx` — `ProviderRow`
- `web/src/lib/types.ts` — the four settings types
- `web/src/lib/api.ts` — the five settings keys
- `web/src/main.tsx` — the `/settings` route

## Decisions Made

- `localBase` returns `string | null`: the OpenAI-compatible row has no catalogue endpoint, and `detect()` skips a null base rather than probing an empty string. The plan wrote `string`; the acceptance criterion (`export function localBase(`) holds either way.
- The model field's "only when the value differs from what is stored" compares against the effective value (stored, else the catalogue default), so a tab-through of the preselected default writes nothing and the row's `modelSource` stays `default`; clearing the field still deletes the stored id.
- Rescan flips login and local rows to `checking` in the browser as the request goes out, matching the server's `resetDetection()` before the pass; key rows keep their pill because a stored key or environment lock is not something the pass changes.
- The detect HTTP cases get their own spawn and a private `CODEX_HOME`: there is no route that unsets the active provider (the plan's "with nothing stored" needs a fresh spawn), and an `auth.json` in the shared scratch home would sign the other spawns and the in-process suite in.
- `isLlamaCpp` reads `status` and `error.type` only; the test records that `{ status: 'ok', extra: [] }` is accepted, as the plan asked ("document which").

## Deviations from Plan

None - plan executed exactly as written. The `localBase` return type and the effective-value comparison above are the two places the implementation chose a narrower reading of a sentence; both are recorded as decisions rather than deviations because every acceptance criterion and truth holds as stated.

**Total deviations:** 0 auto-fixed.
**Impact on plan:** None.

## Issues Encountered

- The repo's `block-no-verify` PreToolUse hook rejected the first Task 1 commit command, which combined a `gsd_run query git.base-branch` guard and `git commit` in one Bash call (the hook pattern-matches the pair, as the memory note on this repo records). Re-run as two calls: the guards alone, then a plain `git commit -F -`. No `--no-verify` was ever used; hooks ran on both task commits.
- Whole-tree gate at the end: `pnpm method:check` (6 copies match), `pnpm typecheck` (server and web), `pnpm build`, `pnpm test` (244 tests, `# fail 0`), `server/test/wire-surface.json` unchanged.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. The left column of key rows is empty by the plan's instruction (the key field, base URL input, fetch models, test connection and the datalist arrive in plans 02 and 03); the row already carries `base_url`, `base_url_default` and `has_models_endpoint` for them. A `DERIVE_MODEL`-locked field shows the stored or default id disabled with the lock sentence; the environment's value is reported on the teaching-now line, which is where the resolver's answer lives.

## Next Phase Readiness

- Plan 02 (keys) adds the key field and the base URL input to `ProviderRow`'s left column and under the pair; `PUT base_url` and its refusal sentences are already live, and `localBase` is where `OLLAMA_HOST` slots in ahead of the table.
- Plan 03 (model lists and tests) has `has_models_endpoint`, `localBase` and `portOf` to build the `models` and `test` routes on, and the row's under-field line to render `{N} models fetched` in.
- Plan 04 (header pill, nav links, plugin message) links to `/settings`, which exists; the Home nav and learner-menu links are its to add.
- The end-of-phase human check for this plan is Task 2's `<human-check>`: ten rows in three groups on `http://localhost:4310/settings`, the gold row flipping on Use this provider with the tick, the saved tick on a typed model, `rescan` → `scanning…`, a quiet network tab afterwards, first paint before the scan.

## Self-Check: PASSED

- Created files exist: `server/src/probe.ts`, `web/src/pages/Settings.tsx`, `web/src/components/ProviderRow.tsx` — FOUND
- Commits exist: `c9dee7c`, `9845b8d` — FOUND
- `commits: 2` measured as `git rev-list --count 2fadc3e..HEAD`; `plan_head_before` is the ledger the first commit was taken against
- All acceptance criteria of both tasks re-run and logged PASS (17 for Task 1, 24 greps plus the three verify checks for Task 2); plan-level verification green

---
*Phase: 02-settings-and-secrets*
*Completed: 2026-09-30*
