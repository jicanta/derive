---
phase: 02-settings-and-secrets
plan: 01
subsystem: api
tags: [settings, providers, resolver, sqlite, migration, hono, node:test]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: the driver seam (runTurn / TurnContext / sink), the migration runner, the turns table, the spawned-server test harness
provides:
  - server/src/providers.ts — the ten-row provider catalogue (ProviderSpec, PROVIDERS, providerOf, labelOf, providerOfDriver, DEFAULTS_AS_OF)
  - server/src/settings.ts — resolveTutor() per turn, currentTutor() for read-only routes, the 30 s-bounded detection observation, backendOf, lockedBy
  - migration 5 `settings(key, value, updated_at)` and getSetting/setSetting/deleteSetting/clearSessionId in db.ts
  - GET /api/settings, GET /api/settings/active, PUT /api/settings/:provider (model), POST /api/settings/active
  - /api/health as { ok, version, backend, model, source }; lessonView.tutor; turn_start payload { provider, model }
  - backend() and backendSource() removed from backend.ts
affects: [02-02 keys, 02-03 model lists and tests, 02-04 header pill and plugin message, 02-05 learner override, 02-06 detection pass and settings page, 03 owned loop drivers]

# Actuals (#2632) — chars/4 over the realized diff, measured against the plan ledger
actuals:
  tokens: 13820
  tasks: 2
  commits: 2
plan_head_before: 9f92a3a03311149349e2e9599a2216848f4e2ad6

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two resolver modes on one shared tier helper: resolveTutor() for a turn (may run the login detectors when the observation is older than DETECT_MS) and currentTutor() for read-only routes (reports the last observation, never spawns)"
    - "A per-install key-value settings table read live per call; no process-lifetime memo anywhere in the choice"
    - "Settings routes are per install (no learnerOf); refusals carry the exact learner-facing sentence and env locks answer 409 naming the variable"
    - "Hermetic spawn for detection tests: DERIVE_BACKEND '', DERIVE_MODEL '', scratch CODEX_HOME, and PATH set to an empty dir (or a counting `claude` shim)"

key-files:
  created:
    - server/src/providers.ts
    - server/src/settings.ts
    - server/test/settings.test.ts
  modified:
    - server/src/migrations.ts
    - server/src/db.ts
    - server/src/agent.ts
    - server/src/backend.ts
    - server/src/index.ts
    - server/src/driver.ts

key-decisions:
  - "Two resolver modes rather than one: resolveTutor() for turns may refresh the 30 s-bounded login observation; currentTutor() for GET /api/settings and /api/health reports the last pass and never spawns a child process, so first paint and the doctor's 1500 ms probe never wait on `claude auth status`"
  - "backend() and backendSource() are deleted outright with every caller moved to settings.ts; the Backend type survives only as the dialect the two login drivers and systemPrompt() speak, produced by backendOf(provider)"
  - "A provider change clears the lesson's session_id by comparing lastTurn(id).driver to the new driver's name before startTurn; a same-driver model change keeps it (D-04), with no new column"
  - "The startup line runs the detectors once at boot through resolveTutor(), priming the observation the read-only routes report; when a stored provider decides, boot detects nothing and login rows read `checking` until plan 06's pass"
  - "/api/health drops backend_source (nothing read it) and /api/stats drops backend (no reader in web/src, hot route); the turn_start payload gains provider and model with no new event type"

patterns-established:
  - "Catalogue-as-registry: providers.ts mirrors tools.ts — pure data, one typed spec per row, accessors, no I/O — so the resolver, routes, doctor and page read one list"
  - "Detection observation: rememberDetection / currentDetection(now) / lastDetection / resetDetection with a pinned-clock test, following the credentials.ts cache shape"
  - "Spawn-counting shim: a scratch `claude` script on PATH that appends to a marker file is how 'never spawns' is proven, not inferred"

requirements-completed: [SET-01, SET-03]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "A provider chosen through POST /api/settings/active and a model stored through PUT /api/settings/:provider survive a restart with source 'settings'"
    requirement: SET-01
    verification:
      - kind: integration
        ref: "server/test/settings.test.ts#keeps the choice across a restart"
        status: pass
    human_judgment: false
  - id: D2
    description: "A stored provider and model are what the very next turn runs on with no restart: turns.model and the turn_start payload carry them"
    requirement: SET-01
    verification:
      - kind: unit
        ref: "server/test/settings.test.ts#runs the very next turn on a choice made in settings, with no restart"
        status: pass
      - kind: unit
        ref: "server/test/settings.test.ts#reflects a stored change at once, because nothing is memoised"
        status: pass
    human_judgment: false
  - id: D3
    description: "A provider (driver) change clears the lesson's session_id before the next turn; a model change on the same driver keeps it (D-04)"
    requirement: SET-01
    verification:
      - kind: unit
        ref: "server/test/settings.test.ts#clears the session when the driver changes, so the provider starts fresh"
        status: pass
      - kind: unit
        ref: "server/test/settings.test.ts#keeps the session when only the model changes on the same driver"
        status: pass
    human_judgment: false
  - id: D4
    description: "The catalogue lists ten providers in a fixed order; only Claude Code and Codex teach; activating a teaches:false row is refused with 'teaching on {label} arrives with the next release'; a stored non-teaching id is ignored by the resolver"
    requirement: SET-01
    verification:
      - kind: unit
        ref: "server/test/settings.test.ts#lists ten providers in a fixed order, and only the two logins teach"
        status: pass
      - kind: integration
        ref: "server/test/settings.test.ts#refuses a row whose driver has not arrived, and an id it does not know"
        status: pass
      - kind: unit
        ref: "server/test/settings.test.ts#ignores a stored provider that does not teach and falls to detection"
        status: pass
    human_judgment: false
  - id: D5
    description: "DERIVE_BACKEND locks the provider and DERIVE_MODEL locks the model: write routes answer 409 naming the variable, GET /api/settings/active reports source 'environment'"
    requirement: SET-01
    verification:
      - kind: integration
        ref: "server/test/settings.test.ts#answers 409 naming DERIVE_BACKEND when the provider is set there"
        status: pass
      - kind: integration
        ref: "server/test/settings.test.ts#answers 409 naming DERIVE_MODEL when the model is set there"
        status: pass
      - kind: integration
        ref: "server/test/settings.test.ts#reports both as coming from the environment"
        status: pass
    human_judgment: false
  - id: D6
    description: "The choice is computed on every call; the login observation is kept for DETECT_MS (30 s) and reported regardless of age; the boot-time memo is gone from backend.ts"
    requirement: SET-03
    verification:
      - kind: unit
        ref: "server/test/settings.test.ts#keeps an observation for DETECT_MS and reports it regardless of age"
        status: pass
      - kind: unit
        ref: "server/test/settings.test.ts#keeps what a pass found on the ports when a later pass only refreshed the logins"
        status: pass
      - kind: other
        ref: "! grep -q 'let resolved' server/src/backend.ts && ! grep -q 'backend()' server/src/index.ts"
        status: pass
    human_judgment: false
  - id: D7
    description: "GET /api/settings and GET /api/health never spawn a child process: a counting `claude` shim records one run at boot and none across six read-only requests; currentTutor() observes nothing itself"
    requirement: SET-03
    verification:
      - kind: integration
        ref: "server/test/settings.test.ts#runs the detectors once at boot and not again for six read-only requests"
        status: pass
      - kind: unit
        ref: "server/test/settings.test.ts#answers read-only callers from the last pass and observes nothing itself"
        status: pass
    human_judgment: false
  - id: D8
    description: "GET /api/settings paints every row in catalogue order with its stored model, exactly one active row, 'not configured' on observed logins and 'checking' on unprobed local rows; /api/health has exactly { ok, version, backend, model, source }"
    requirement: SET-03
    verification:
      - kind: integration
        ref: "server/test/settings.test.ts#paints every row from stored config, in catalogue order, with one active row"
        status: pass
      - kind: integration
        ref: "server/test/settings.test.ts#answers health from the last pass, with exactly five keys"
        status: pass
    human_judgment: false
  - id: D9
    description: "The detection tier picks Claude Code when both logins are observed, Codex when only Codex is, Claude Code when neither"
    requirement: SET-03
    verification:
      - kind: unit
        ref: "server/test/settings.test.ts#detects in the order the old memo used: Claude, then Codex, then Claude"
        status: pass
    human_judgment: false
  - id: D10
    description: "The turn_start payload carries { provider, model } so the header pill of plan 04 has a live feed"
    requirement: SET-01
    verification:
      - kind: unit
        ref: "server/test/settings.test.ts#runs the very next turn on a choice made in settings, with no restart"
        status: pass
    human_judgment: false
  - id: D11
    description: "GET /api/lessons/:id carries tutor { provider, model } from the lesson's last turn (or null before any turn) for the header pill's first paint"
    requirement: SET-01
    verification:
      - kind: other
        ref: "grep -q 'tutor: last ?' server/src/index.ts"
        status: pass
    human_judgment: true
    rationale: "Only a source assertion covers lessonView.tutor in this plan; the field's behaviour is exercised end-to-end when plan 04 renders the header pill from it"
  - id: D12
    description: "No settings, active or health body carries the identity `claude auth status` prints (no `email` key)"
    requirement: SET-03
    verification:
      - kind: integration
        ref: "server/test/settings.test.ts#never carries the identity claude auth status prints"
        status: pass
      - kind: integration
        ref: "server/test/settings.test.ts#reports the boot observation as the detected provider"
        status: pass
    human_judgment: false

# Metrics
duration: 11min
completed: 2026-09-30
status: complete
---

# Phase 2 Plan 01: Settings Foundation Summary

**A per-install provider and model choice, persisted in a `settings` table and resolved on every turn (env, then table, then a 30 s-bounded login observation), with read-only routes that never spawn `claude auth status` and the boot-time backend memo retired.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-09-30T19:05:29Z
- **Completed:** 2026-09-30T19:16:15Z
- **Tasks:** 2
- **Files modified:** 9 (3 created, 6 modified)

## Accomplishments

- `server/src/providers.ts`: the ten-row catalogue in the page's fixed order, with `teaches` true only on Claude Code and Codex, `optionalKey` on LM Studio and llama.cpp, endpoints, models paths, default ports, env key names, the UI-SPEC row sentences, and `DEFAULTS_AS_OF = '2026-09-30'` with the research matrix's default ids.
- `server/src/settings.ts`: `resolveTutor()` computed per call over env, table and detection; the detection observation (`rememberDetection` / `currentDetection(now)` / `lastDetection` / `resetDetection`, `DETECT_MS = 30_000`, `local` preserved across a login-only refresh); `currentTutor()` for read-only routes sharing the env and table tiers through one private helper; `backendOf`, `lockedBy`.
- Migration 5 `settings(key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL)`; `getSetting` / `setSetting` (upsert) / `deleteSetting` and `clearSessionId` in `db.ts`.
- `runTurn` resolves the tutor per turn, clears `session_id` when the driver changed since the last turn (D-04), writes `tutor.model` to the turns row and emits `turn_start` with `{ provider, model }`; `MODEL` and `backend()` no longer enter a turn.
- Routes: `GET /api/settings` (rows with status from one `lastDetection()`, one active row computed once, locks, `defaults_as_of`), `GET /api/settings/active`, `POST /api/settings/active` (404 unknown, 400 non-teaching with the exact sentence, 409 `DERIVE_BACKEND`), `PUT /api/settings/:provider` (zod-bounded model id, 409 `DERIVE_MODEL`, empty string clears, answers the row view). `/api/health` is `{ ok, version, backend, model, source }` from `currentTutor()`; `/api/stats` drops `backend`; `lessonView` gains `tutor` from `lastTurn(id)`; the startup line reads `resolveTutor()` and points to Settings when detected.
- `backend()`, `backendSource()` and the process-lifetime memo are deleted from `backend.ts`; `claudeLoggedIn`, `codexLoggedIn`, `codexBinary`, `mcpCommand` are byte-identical.
- `server/test/settings.test.ts` (405 lines, 27 cases): three hermetic spawns (persistence with a real restart on a reused data dir, env locks, a counting `claude` shim proving one boot run and zero spawns across six read-only requests) plus a module-level fake-driver suite (next-turn honour, no memo, session clearing, detection order, memo bound at a pinned clock).

## Task Commits

1. **Task 1: End-to-end "choose provider and model, restart, the next turn runs on it"** — `aa8814d` (feat)
2. **Task 2: The read-only view on a resolver that never spawns; retire the boot-time memo** — `2b33d86` (feat)

Tracer feedback gate (Task 1 is `type="tracer"`, interactive run, `human_verify_mode: end-of-phase`, automated-only verify): the verify was re-run after the commit — `pnpm build` and `settings.test.ts` at 20/20, `# fail 0` — and expansion proceeded with no checkpoint.

## Files Created/Modified

- `server/src/providers.ts` — the catalogue: `ProviderId`, `ProviderAuth`, `ProviderGroup`, `ProviderSpec`, `PROVIDERS`, `DEFAULTS_AS_OF`, `providerOf`, `labelOf`, `providerOfDriver`
- `server/src/settings.ts` — the resolver and the detection observation
- `server/src/migrations.ts` — migration 5 `settings`
- `server/src/db.ts` — `getSetting`, `setSetting`, `deleteSetting`, `clearSessionId`
- `server/src/agent.ts` — `runTurn` on `resolveTutor()`; D-04 session clearing; `turn_start` payload
- `server/src/backend.ts` — memo removed; header rewritten to describe the detectors and binary resolution
- `server/src/index.ts` — settings section (`SettingsWrite`, `statusOf`, `rowView`, `settingsView`, four routes), health, stats, `lessonView.tutor`, startup line
- `server/src/driver.ts` — one comment that still named `backend()` now names `resolveTutor()`
- `server/test/settings.test.ts` — the suite

## Decisions Made

- Two resolver modes on one shared helper, as the plan's assumption-delta decision records: `resolveTutor()` may refresh the observation; `currentTutor()` never spawns. `GET /api/settings/active` and `POST /api/settings/active` read `resolveTutor()` (a fresh observation costs nothing there and the plugin asks once per lesson); everything hot reads `currentTutor()` or the turns row.
- `currentDetection(now)` also treats a clock stepped backwards as stale (`now >= at`), matching the 01-22 decision on `credentials()`; the plan's "only while now - at < DETECT_MS" holds and gains one guard.
- The `PUT` model validator carries its own message on `max(200)` as well as on the regex, so the learner reads a sentence either way; the regex sentence is the one the plan fixes.
- The boot line detects only when neither env nor the table decides (the tier order), exactly as the old memo did. Consequence, asserted in the restart case: after a restart with a stored provider, login rows read `checking` until plan 06's pass runs.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Module header tripped the plan's own `process.env` guard**
- **Found during:** Task 1 verification
- **Issue:** The prose header of `settings.ts` said the module "never touches `process.env`", and the verify is a literal `! grep -q "process.env"` over the file.
- **Fix:** Reworded to "never reads it directly". No code change.
- **Files modified:** server/src/settings.ts
- **Verification:** the grep guard passes; typecheck and tests unchanged
- **Committed in:** aa8814d

**2. [Rule 2 - Stale documentation] A comment in `driver.ts` still named the deleted `backend()`**
- **Found during:** Task 2 (retiring the memo)
- **Issue:** `driver.ts`'s `driverOverride` header said the production dispatch reads `backend()`, which no longer exists.
- **Fix:** The sentence now names `resolveTutor()`. One word; the file's behaviour is untouched.
- **Files modified:** server/src/driver.ts
- **Verification:** `grep -rn "backend()" server/src` reports nothing
- **Committed in:** 2b33d86

---

**Total deviations:** 2 auto-fixed (1 verify-literal fix, 1 stale comment)
**Impact on plan:** None on behaviour. Both keep the plan's own guards and the codebase's comments true.

## Issues Encountered

None. `pnpm method:check`, `pnpm typecheck` (web and server), `pnpm build` and `pnpm test` (228 tests, `# fail 0`) all pass; `server/test/wire-surface.json` is unchanged.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. The status pill for key rows reads `not configured` until plan 02 teaches the view about keys, and `local` in the observation stays absent until plan 06's port probe; both are the plan's declared hand-offs, not stubs, and the rows already carry every catalogue fact.

## Next Phase Readiness

- Plan 02 (keys) can add `key:<id>` to `lockedBy` and a `key` field to `SettingsWrite`, and fill `statusOf` for key rows.
- Plan 06 (detection pass) fills `local` through `rememberDetection({ logins, local })` and the `base_url:<id>` keys already have accessors and a `baseUrlKey` helper.
- Plan 04 (header pill) has both feeds: `lessonView.tutor` on first paint and the `turn_start` payload live. The web reducer's `EVENT_TYPES` is untouched.
- Plan 05 (learner override) slots into `chooseModel` between the environment and the table tiers.
- Existing databases migrate forward to version 5 with the snapshot the runner already takes.

## Self-Check: PASSED

- Created files exist: `server/src/providers.ts`, `server/src/settings.ts`, `server/test/settings.test.ts` — FOUND
- Commits exist: `aa8814d`, `2b33d86` — FOUND
- `commits: 2` measured as `git rev-list --count 9f92a3a..HEAD`
- All acceptance criteria of both tasks re-run and logged PASS; plan-level verification (`pnpm method:check && pnpm typecheck && pnpm build && pnpm test`, wire-surface unchanged) green

---
*Phase: 02-settings-and-secrets*
*Completed: 2026-09-30*
