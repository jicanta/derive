---
phase: 02-settings-and-secrets
verified: 2026-09-30T23:05:41Z
status: human_needed
score: 50/58 must-haves verified
covered_files:
  - .env.example
  - .planning/REQUIREMENTS.md
  - .planning/ROADMAP.md
  - .planning/phases/02-settings-and-secrets/02-01-PLAN.md
  - .planning/phases/02-settings-and-secrets/02-01-SUMMARY.md
  - .planning/phases/02-settings-and-secrets/02-02-PLAN.md
  - .planning/phases/02-settings-and-secrets/02-02-SUMMARY.md
  - .planning/phases/02-settings-and-secrets/02-03-PLAN.md
  - .planning/phases/02-settings-and-secrets/02-03-SUMMARY.md
  - .planning/phases/02-settings-and-secrets/02-04-PLAN.md
  - .planning/phases/02-settings-and-secrets/02-04-SUMMARY.md
  - .planning/phases/02-settings-and-secrets/02-05-PLAN.md
  - .planning/phases/02-settings-and-secrets/02-05-SUMMARY.md
  - .planning/phases/02-settings-and-secrets/02-06-PLAN.md
  - .planning/phases/02-settings-and-secrets/02-06-SUMMARY.md
  - scripts/doctor.mjs
  - server/src/agent.ts
  - server/src/backend.ts
  - server/src/config.ts
  - server/src/db.ts
  - server/src/driver.ts
  - server/src/index.ts
  - server/src/keys.ts
  - server/src/mcp.ts
  - server/src/migrations.ts
  - server/src/probe.ts
  - server/src/providers.ts
  - server/src/settings.ts
  - server/test/mcp.test.ts
  - server/test/settings.test.ts
  - web/src/components/LearnerMenu.tsx
  - web/src/components/ProviderRow.tsx
  - web/src/lib/api.ts
  - web/src/lib/types.ts
  - web/src/lib/useLesson.ts
  - web/src/main.tsx
  - web/src/pages/Home.tsx
  - web/src/pages/Lesson.tsx
  - web/src/pages/Settings.tsx
  - web/src/pages/You.tsx
covered_digest: "v1:sha256:997a009369442ef69d8fdbf6e0eac8a528ee9b66515b6e96fff5df48532903ea"
behavior_unverified: 4
insufficient_spec: 4
overrides_applied: 0
prohibitions:
  total: 17
  verified: 13
  flagged: 4
  flagged_items:
    - statement: "The header pill must state what the last turn ran on, never what Settings currently says; a pending change must not be shown as already applied"
      plan: 02-04
      tier: test
      disposition: "unverified-prohibition — human review recommended"
      reason: "No wired web test exercises the reducer; the server feeds (turn_start payload, lessonView.tutor off lastTurn) are what a test proves, and only the payload half is asserted (settings.test.ts 'runs the very next turn on a choice made in settings'). The browser-side invariant (turn_start replaces, init seeds, Settings never writes it) is present in web/src/lib/useLesson.ts:81,235 and unexercised."
    - statement: "The lesson screen gains only the header pill of plan 04; no control, panel or page is added outside Settings by this phase"
      plan: 02-01
      tier: judgment
      disposition: "NON-AUTHORITATIVE LLM verdict: holds — unverified-prohibition — human review recommended"
      reason: "git diff 9f92a3a..HEAD -- web/src/pages/Lesson.tsx is +15/-2: the tutorLabel constant, the pill Link, 'codex cli' and the companion suffix; no other lesson-screen file changed"
    - statement: "The browser hard-codes no provider facts: every label, note, default, port and status comes from GET /api/settings, and the page never re-sorts rows"
      plan: 02-06
      tier: judgment
      disposition: "NON-AUTHORITATIVE LLM verdict: holds — unverified-prohibition — human review recommended"
      reason: "Settings.tsx keeps only the three eyebrow words and filters rows by the API's group id in API order (no sort); ProviderRow.tsx reads label, note, default_model, port, status, has_models_endpoint from the row and holds two Derive copy strings only"
    - statement: "On an external lesson nothing may claim Derive chose or can change the terminal's model: the companion pill must not link to Settings and must say 'terminal model'"
      plan: 02-04
      tier: judgment
      disposition: "NON-AUTHORITATIVE LLM verdict: holds — unverified-prohibition — human review recommended"
      reason: "Lesson.tsx:127-142 renders the companion pill as a <span> (no `to=`) with the text `companion · {driver} · terminal model`; the tutor Link renders only when !external"
behavior_unverified_items:
  - truth: "The settings page click is optimistic and a server refusal renders verbatim in rust under the head line and reverts the row (02-06)"
    test: "On /settings, press Use this provider on a logged-in row, then force a refusal (set DERIVE_BACKEND before start and press the button on the other login row, or watch the API return 409)"
    expected: "The gold row flips at once on success with `saved · applies from the next turn of every lesson`; on a refusal the sentence appears in rust under the row head and the gold row returns to where it was"
    why_human: "The optimistic flip and revert live in Settings.tsx onUse (setSettings then catch → setSettings(prev)); there is no web test runner in this repo, so the transition is present and wired but never exercised"
  - truth: "The teaching-now line paints from GET /api/settings at once with the source pill reading 'checking' until detection answers; on a GET failure the rust sentence renders where the line would be with rescan as the retry (02-06)"
    test: "Open /settings with the server up; then stop the server and press rescan (or open the page while it is down)"
    expected: "First paint shows the stored provider and model with a pulsing `checking` pill before the pass answers, then `detected` / `from settings`; with the server down the rust sentence sits where the line would be and `rescan` retries the load"
    why_human: "The loading → loaded and failure → retry transitions are React state in Settings.tsx (scan/load, `scanning ? 'checking' : 'detected'`, `settings ? scan() : load()`); no test renders the page"
  - truth: "The key field states render as specified: unset placeholder, saving line, masked hint with replace and remove, replace with keep the current key and Escape, inline two-step remove with no modal, the five-second removed sentence, the env-lock sentence, the save-failed sentence with the typed value kept (02-02)"
    test: "See Human Verification item 2"
    expected: "Each state reads as the UI contract says; no browser dialog; the typed value stays after a refusal"
    why_human: "KeyField in ProviderRow.tsx is a six-state machine driven by blur, Enter, Escape and two timers; the API halves are tested (set, hint, remove, 409) but the transitions are only observable in a browser"
  - truth: "The pill reads the turn, not the setting: first paint comes from GET /api/lessons/:id tutor and live updates from the turn_start payload, so a change in Settings shows on the next turn, never before (02-04)"
    test: "Open an agent lesson after one turn; note the pill; change the provider or model in Settings; return to the lesson without sending a message; then send one"
    expected: "The pill keeps the old value until the next turn starts, then flips to the new provider · model"
    why_human: "The invariant is a browser-side ordering rule in useLesson.ts (init seeds from lessonView.tutor; only a turn_start payload with a string provider replaces it); the server half is tested (turn_start payload deep-equal), the reducer is not"
insufficient_spec_items:
  - truth: "A 60-character local model id (for example an Ollama tag with a slash and a colon) does not break the 40 px combobox: the value scrolls inside the input and the pill of plan 04 truncates with the full value in title (02-03, verification: backstop)"
    routed_to: "Human Verification item 3"
  - truth: "A multi-line 4xx body from a provider renders as one line under the row: whitespace is collapsed before the 300-character cut, verified against the loopback fake provider's two-line error (02-03, verification: backstop)"
    routed_to: "Human Verification item 3 — the server half is proven (settings.test.ts 'quotes the provider 401 verbatim on one line' asserts the fake's two-line body reads as one line); only the render under the row is unproven"
  - truth: "Model ids and provider names are rendered verbatim in the pill and truncated only by CSS (max-w-[28ch] truncate with the full value in title); no server-side length or equality rule applies to them (02-04, verification: backstop)"
    routed_to: "Human Verification item 4"
  - truth: "A 60-character local model id does not break the h-10 max-w-[320px] mono input on /you (02-05, verification: backstop)"
    routed_to: "Human Verification item 5"
human_verification:
  - test: "Open http://localhost:4310/settings after `pnpm start` (harvested from 02-06 Task 2 human-check)"
    expected: "Ten rows in three groups (logins · keys · on this machine); on this machine Claude Code and Codex read `logged in`; the active row is gold with `teaching now`; pressing Use this provider on the other login row flips the gold row at once and shows `saved · applies from the next turn of every lesson`; typing a model id and tabbing out shows the saved tick; `rescan` reads `scanning…` briefly; the network tab is quiet afterwards (nothing polls); first paint does not wait on the scan. Then restart Derive and confirm the same provider is active on the page."
    why_human: "No web test runner; the optimistic flip, the saved tick, the pulsing `checking` pill and the quiet network tab are visual and interactive. The API half of persistence is proven by the real-restart case in settings.test.ts."
  - test: "On /settings paste a throwaway string into the Anthropic key field and tab out; then exercise remove and replace; then start with OPENAI_API_KEY exported (harvested from 02-02 Task 2 human-check)"
    expected: "Dots plus the last four characters appear with `replace · remove`; pressing `remove` shows `remove the key · keep`, Escape returns; pressing `remove` twice shows `Removed. It stays hidden from logs and events until Derive restarts.` for about five seconds; with OPENAI_API_KEY exported before `pnpm start` the OpenAI row shows `set from environment` and no input; the Ollama row shows a base URL input with the catalogue default as placeholder. The value is never shown again and there is no reveal toggle."
    why_human: "The key field's six states and the two-step inline remove are browser state; the API halves (set/hint/0600/409/remove) are all tested."
  - test: "With Ollama or any OpenAI-compatible server on this machine, set its base URL and press `fetch models`; press `test connection` on the Anthropic row with a wrong key; press `test connection` on Claude Code (harvested from 02-03 Task 2 human-check)"
    expected: "The datalist offers the ids and `N models fetched` appears under the field; a 60-character id such as `qwen/qwen3-8b-instruct-q4_k_m:latest-long-tag-for-the-check` scrolls inside the 40 px input without breaking the row; on the wrong Anthropic key the result line reads `401 …` in rust on one line with the refused hint on the next line; at 360 px width the two-line sentence and two-line hint still read as one row; on Claude Code the line reads `Logged in · N ms`."
    why_human: "The native datalist popup, the typeable-after-failure behaviour, the one-line truncation and the 360 px layout are visual; the server side of every case is tested against a loopback fake."
  - test: "Open an agent lesson after one turn; change the provider in Settings and return; open a companion lesson started from the Claude Code plugin; look at the Home nav and the learner menu (harvested from 02-04 Task 1 human-check)"
    expected: "The muted pill beside the title reads e.g. `claude code · default model` (or the model set in Settings), links to /settings, and is hidden below 768 px like the companion pill; after a change in Settings the pill still shows the old value until the next turn, then flips; the companion lesson's pill reads `companion · claude code · terminal model` and is not a link; the Home nav shows `settings` after `how you learn`; the learner menu shows the Settings row with the sub-line `which model teaches · for everyone on this install`; a long model id truncates with the full value in the title."
    why_human: "The pill's placement inside the 60 px header, its hidden-below-md behaviour, the flip-only-on-next-turn ordering and the companion pill's reading are visual and multi-step; this item also resolves the four flagged prohibitions above."
  - test: "On /you, Section 07 Model: read the placeholder, type a model id, press Save; open the learner menu; start a plugin lesson as that learner (harvested from 02-05 Task 2 human-check)"
    expected: "The placeholder reads `install default: …` naming the install-wide model; Save shows `saved · applies from the next message`; the learner menu's sub-line does not mention the model; a 60-character id fits the input; the plugin start message's `Derive's own tutor is set to` names that id."
    why_human: "The placeholder text, the saved line, the menu sub-line and the long-id fit are visual; the resolver and the learner-scoped active read are tested."
---

# Phase 2: Settings and Secrets Verification Report

**Phase Goal:** The learner chooses provider and model in the app, sees what the machine already offers, stores keys safely, tests the connection, and always knows which model is teaching.
**Verified:** 2026-09-30T23:05:41Z
**Status:** human_needed
**Re-verification:** No — initial verification

## MVP mode note

ROADMAP marks this phase `mode: mvp`, but its `**Goal:**` line is prose, not a User Story: `gsd_run query user-story.validate` answers `valid: false` on all three slots. Phase 1 was in the same position and was verified with the standard goal-backward structure; the orchestrator dispatched this verification against the five ROADMAP success criteria, so the same is done here. Plan 02-01 restates the goal as a User Story ("As a learner, I want to choose the provider and model that teach me inside the app, see what my machine already offers, store keys safely and test the connection, so that I always know which model is teaching me and nothing about the method changes when I switch") without adding anything; the User Flow Coverage table below is built from that restatement. If a canonical User Story goal is wanted on the roadmap, `/gsd-mvp-phase 2` sets one; nothing in this report depends on it.

## User Flow Coverage

| Step | Expected | Evidence in codebase | Status |
|------|----------|----------------------|--------|
| Learner opens Settings | `/settings` route renders one row per provider from the API | `web/src/main.tsx:22` route; `Settings.tsx` `api.settings()` on mount then one `api.detectProviders()`; `GET /api/settings` → `settingsView()` (`index.ts:422-438`) | ✓ present + API tested (`paints every row from stored config, in catalogue order, with one active row`) |
| Picks a provider and a model | Use this provider → `POST /api/settings/active`; model field → `PUT /api/settings/:provider` | `Settings.tsx onUse` → `api.useProvider`; `ProviderRow.tsx save` → `api.setProvider(id, { model })`; routes at `index.ts:445-490` | ✓ wired; API tested (`makes a teaching provider active…`, `stores a model on a provider row`) |
| Sees what the machine offers | logins, env keys, local servers without typing | `probe.ts detect()` (async `claude auth status`, `auth.json`, three shape-checked probes); `statusOf` in `index.ts:378-388` | ✓ tested over HTTP with real `auth.json` and loopback fakes |
| Stores a key safely | 0600 `secrets.json`, `{ set, hint }` only | `keys.ts` persist (tmp + rename, `mode: 0o600`); `keyOfRow` | ✓ tested (`writes the file 0600…`, `never echoes…`) |
| Tests the connection | success line or the provider's verbatim sentence | `probe.ts testConnection`, `POST /api/settings/:provider/test`; `ProviderRow.tsx resultText` | ✓ tested against a loopback fake (401 verbatim, 302, non-JSON, closed port) |
| Always knows which model is teaching | lesson header pill; plugin start message | `Lesson.tsx:116-125` pill off `state.tutor`; `mcp.ts:229-246` `app_tutor_setting` | ✓ plugin tested (`mcp.test.ts` 3/3); header pill present + wired, render unexercised → Human item 4 |

## Goal Achievement

### Observable Truths — ROADMAP success criteria (the contract)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC1 | Learner opens Settings, picks a provider and a model, restarts Derive, and the same choice is active | ✓ VERIFIED | `settings.test.ts` `keeps the choice across a restart` kills the spawned server and respawns it on the same data dir, then asserts `GET /api/settings/active` is still `{ provider: 'codex', model: 'gpt-5.4', source: 'settings', modelSource: 'settings' }` (real restart, not a source assertion). The choice is stored in the `settings` table of migration 5 (`migrations.ts:243`, `db.ts:179-181,470-481`) and read live per call by `resolveTutor()` (`settings.ts:170-173`); the next turn runs on it with no restart (`runs the very next turn on a choice made in settings` asserts `lastTurn(id).model === 'gpt-5.4'` and the `turn_start` payload). The page path is wired: `Settings.tsx onUse` → `api.useProvider` → `POST /api/settings/active`; `ProviderRow.tsx save` → `api.setProvider` → `PUT`. The click itself is Human item 1. |
| SC2 | Learner pastes a key once; it is masked afterwards, lives in a 0600 secrets file outside `derive.db`, and no API response ever returns it (write-only field answering `{ set, hint }`) | ✓ VERIFIED | `stores a key and answers { set, hint } only, never the value` asserts the PUT answers `key: { set: true, hint: '1234', locked: null }` and that neither the PUT body nor a following `GET /api/settings` contains the key; `writes the file 0600 as { providerId: key }` asserts `statSync(secrets.json).mode & 0o777 === 0o600` and the file is exactly `{ openai: GOOD }`; `gives a short key an empty hint` (`hint: ''` under 8 chars); `never echoes the good key or the wrong one in any response` walks ≥ 20 bodies including the provider's own echo of the key in its 401; `never echoes an environment value and never copies one into the file`. `keys.ts` has no read-back export beyond `keyView` (`{ set, hint }`), `SECRETS_PATH = join(DATA_DIR, 'secrets.json')` is a sibling of `derive.db`, and every loaded or set value goes through `registerSecret` (`registers a key with the redaction chokepoint before it is written`, `registers every key it loads from a file written by hand`). UI: `KeyField` renders `•••• •••• {hint}` after save with `type="password"` input and no reveal toggle (Human item 2 for the states). |
| SC3 | Settings show what is already available without typing: logged-in Claude Code and Codex CLIs, keys in the environment labelled "set from environment", and local servers found on their default ports | ✓ VERIFIED | Logins: `finds the Codex login and the three local servers at their stored bases in one pass` (real `auth.json` in a scratch `CODEX_HOME`), `leaves Codex detected when only Codex is logged in…`, `falls back to Claude Code when nothing is logged in…` (all login and local rows `not configured`), `spawns the CLI exactly once per detect pass, and not for the reads that follow` (a counting `claude` shim on PATH). Environment: `reads set from environment with the variable named, Google before Gemini, and OLLAMA_HOST on the Ollama row` asserts `key: { set: true, hint: null, locked: 'OPENAI_API_KEY' }` and `status: 'set from environment'`; `answers 409 naming the variable on a key write and on a key removal`. Local servers: three loopback fakes with the Ollama / LM Studio / llama.cpp shapes read `found on port N`; `reads an HTML 200 on the llama.cpp base as not configured, never as found` (the FreqUI case); `answers within two seconds when the llama.cpp base is a closed port`. The default-port path is the same code (`localBase` → `spec.endpoint` when nothing is stored, `reads a local base from the table first and the catalogue second`). `statusOf` at `index.ts:378-388` is the single source of the pill text. |
| SC4 | Learner fetches a provider's model list, or types a model id when the fetch fails, with a curated default preselected | ✓ VERIFIED | `fetches the models of an OpenAI-compatible endpoint with the stored key, de-duplicated and in the provider order` → `{ models: ['tiny-b', 'tiny-a'] }`; `lists Ollama tags verbatim, LM Studio loaded models first…`; `normalises each provider list to ids in its order…` covers every `idsOf` branch; a failed fetch is a 502 carrying the provider's sentence (`quotes the provider 401 verbatim… on the test and on the list`). Curated defaults live in the catalogue (`providers.ts:99,113,128,142`, `DEFAULTS_AS_OF = '2026-09-30'`) and `paints every row…` asserts key rows report `default_model`. UI: one `<input list="models-{id}">` plus `<datalist>` (no `<select>` in the file), the input is prefilled with `row.model ?? row.default_model` and shows `default as of {date}`, `fetchModels` on failure empties the list and shows the sentence while the input stays enabled and saves (`disabled` depends only on `model_locked`/`saving`). The datalist popup is Human item 3. |
| SC5 | "Test connection" reports success or the provider's actual failure sentence; the active provider and model are shown in the lesson header and in the plugin start message | ✓ VERIFIED | Test: `reports Connected with the model count and a latency` (`ok: true, models: 2, ms ≥ 0`); `quotes the provider 401 verbatim on one line, with the fix hint beside it` asserts `error === '401 Incorrect API key provided: good-*** second line of the body'` and `hint` matching /refused/ as a separate field; `refuses to follow a redirect…` (302 sentence), `says when the answer was not JSON…`, `names the address in its own sentence when nothing answered` (`nothing answered at 127.0.0.1:`), `tests the Codex login by its auth file, Claude Code by its CLI…`; every sentence passes `safeMessage` (`probe.ts:364`). Plugin: `mcp.test.ts` (3/3 on the built stdio server) asserts `tutor_running_this_lesson` matches /in this terminal, on its own model$/ and `app_tutor_setting` matches /^Derive's own tutor is set to \S+ · /; `mcp.ts:229` reads `/api/settings/active?learner=<id>`. Header: `Lesson.tsx:116-125` renders `<Link to="/settings">` with `{provider} · {model ?? 'default model'}` from `state.tutor`, seeded by `lessonView.tutor` (`index.ts:282`, off `lastTurn(id)`) and replaced by the `turn_start` payload (`useLesson.ts:81`); the payload is tested, the render is Human item 4. |

**Roadmap score:** 5/5 success criteria verified (the header-pill render and every page interaction are routed to human verification, which is why the phase is `human_needed` rather than `passed`).

### Observable Truths — PLAN must_haves (detail; restatements of a roadmap SC are deduplicated into the row above)

| # | Truth (plan) | Status | Evidence |
|---|--------------|--------|----------|
| 1 | A stored model is what the next turn of every lesson runs on, with no restart (02-01) | ✓ VERIFIED | `runs the very next turn on a choice made in settings, with no restart`: `lastTurn(id).model === 'gpt-5.4'`, `turn_start` payload `{ provider: 'codex', model: 'gpt-5.4' }`; `reflects a stored change at once, because nothing is memoised` |
| 2 | A provider change clears `session_id` before the next turn; a model change on the same provider keeps it (02-01) | ✓ VERIFIED | `clears the session when the driver changes…` (`s1` → null after a fake turn following a `claude` turn); `keeps the session when only the model changes on the same driver` (`s2` kept, `lastTurn.model === 'gpt-5.5'`); `agent.ts:281-282` |
| 3 | Ten providers in a fixed order, `teaches` true only on the two logins; `POST /api/settings/active` on a `teaches:false` row refused with the sentence (02-01) | ✓ VERIFIED | `lists ten providers in a fixed order, and only the two logins teach`; `refuses a row whose driver has not arrived, and an id it does not know` (400 `teaching on OpenAI arrives with the next release`, 404); `providers.ts` has exactly ten entries, `teaches: true` on `claude-code` and `codex` only |
| 4 | `DERIVE_BACKEND` locks the provider and `DERIVE_MODEL` the model; write routes answer 409 naming the variable (02-01) | ✓ VERIFIED | `answers 409 naming DERIVE_BACKEND…`, `answers 409 naming DERIVE_MODEL…`, `reports both as coming from the environment`; `lockedBy` at `settings.ts:206-212` |
| 5 | `resolveTutor()` computed per call; detectors re-run only when the memo is older than 30 s; `backend.ts` holds no process-lifetime memo (02-01) | ✓ VERIFIED | `keeps an observation for DETECT_MS and reports it regardless of age` (pinned clock), `reports a stale pass where a turn would look again`; `grep 'let resolved' server/src/backend.ts` and `grep 'backend()' server/src/index.ts` both empty; `backend.ts` is 80 lines of detectors and binary resolution |
| 6 | `GET /api/settings` and `/api/health` never spawn: they read `currentTutor()` (02-01) | ✓ VERIFIED | `runs the detectors once at boot and not again for six read-only requests` counts real invocations of a `claude` shim via a marker file; `answers read-only callers from the last pass and observes nothing itself`; `settings.ts:176-179` `currentTutor` reads `lastDetection()` only |
| 7 | `GET /api/settings` paints every row in catalogue order with its stored model, exactly one active row, `checking` on unobserved rows (02-01) | ✓ VERIFIED | `paints every row from stored config, in catalogue order, with one active row`; `reads checking on the local rows until a pass has looked`; `answers health from the last pass, with exactly five keys` |
| 8 | Detection tier: Claude when both logins, Codex when only Codex, Claude when neither (02-01) | ✓ VERIFIED | `detects in the order the old memo used: Claude, then Codex, then Claude`; `detectedProvider` at `settings.ts:134-138` |
| 9 | `GET /api/lessons/:id` carries `tutor { provider, model }` from the last turn and `turn_start` carries `{ provider, model }` (02-01) | ✓ VERIFIED | `turn_start` payload deep-equal in `runs the very next turn…`; `lessonView` at `index.ts:282` builds `tutor` from `lastTurn(id)` with `providerOfDriver` (`maps catalogue ids to the dialect the drivers speak, and driver names back`). No test reads `lessonView.tutor` over HTTP (the 02-01 SUMMARY records this as `human_judgment: true`); the field is a one-line projection of a tested row, and its rendering is Human item 4. |
| 10 | Detection runs on page open and Rescan via `POST /api/settings/detect`, logins plus shape-checked probes of 11434/1234/8080 in one parallel pass; stored config paints at once (02-06) | ✓ VERIFIED | `finds the Codex login and the three local servers at their stored bases in one pass`; `spawns the CLI exactly once per detect pass…`; `probe.ts detect()` is one `Promise.all` ending in `rememberDetection`; `Settings.tsx` calls `api.settings()` then `api.detectProviders()` on mount and on `rescan` only (no `setInterval`, no `setTimeout(…detectProviders`) |
| 11 | A port answering something other than the expected JSON shape reads `not configured` (02-06) | ✓ VERIFIED | `reads an HTML 200 on the llama.cpp base as not configured, never as found`; `checks the shape each local server answers with, and nothing else about the body` |
| 12 | Both logins → Claude Code detected; only Codex → Codex, proven over HTTP with a real `auth.json` (02-06) | ✓ VERIFIED | `leaves Codex detected when only Codex is logged in and nothing is stored` (`GET /api/settings/active` → `{ provider: 'codex', source: 'detected' }`), `falls back to Claude Code when nothing is logged in…`; the both-logins order is the module case in row 8 |
| 13 | Nothing detected → every login and local row `not configured`; teaching-now line `claude code · default model` with the `detected` pill (02-06) | ✓ VERIFIED | `falls back to Claude Code when nothing is logged in, with every login and local row not configured`; `Settings.tsx:88-104` renders `{activeLabel} · {active.model ?? 'default model'}` and the `detected` pill |
| 14 | Base URL stored through PUT: http/https only, no credentials, no query/fragment, origin plus path without trailing slash; fixed-endpoint rows refuse it; empty means default; the pass probes the stored base (02-06) | ✓ VERIFIED | `refuses a base URL on a row with a fixed endpoint`, `refuses a base URL that is not http or https, carries credentials, or has a query`, `stores a base URL as origin plus path without a trailing slash, and clears it with an empty string`, `normalises a base URL…`, `refuses a scheme…each with its own sentence`; the detect cases point every local row at its fake through the stored base |
| 15 | A model typed into a row saves on blur or Enter with a saved tick and is what `GET /api/settings` reports (02-06) | ✓ VERIFIED | `stores a model on a provider row`, `answers a settings write with the row as the page paints it`; `ProviderRow.tsx save` on `onBlur` with `blurOnEnter`, tick 1800 ms (the tick itself is Human item 1) |
| 16 | Rows render in catalogue order and keep their position; the active row is marked, never moved (02-06) | ✓ VERIFIED | `paints every row… in catalogue order`; `Settings.tsx:139-141` filters `settings.rows` by group and never sorts; `ProviderRow` marks `active` with the gold variant and `teaching now` |
| 17 | The page is one row per provider in three eyebrow groups with one gold row, a filled Use this provider on non-active teaching rows, `teaching now` on the active row, nothing on unwired rows; the click is optimistic and a refusal renders verbatim and reverts the row (02-06) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | All present: `GROUPS` (logins · keys · on this machine), gold variant, `row.teaches ? <button …>Use this provider</button> : null`, `onUse` optimistic `setSettings` then `setSettings(prev)` on catch, `useErr` rendered in rust. The optimistic flip and revert are a browser state transition no test exercises → Human item 1 |
| 18 | The teaching-now line paints at once with the source pill `checking` until detection answers; on a GET failure the rust sentence renders with rescan as the retry (02-06) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Present: `source === … scanning ? 'checking' : 'detected'`, `err` rendered where the line would be, `rescan = () => void (settings ? scan() : load())`. Loading and failure transitions unexercised → Human item 1 |
| 19 | Every in-flight button reads its progressive form and is disabled; `checking` is the only loading indicator, a pulsing dot, never a spinner or skeleton (02-06) | ✓ VERIFIED | `scanning…`, `fetching…`, `testing…` with `disabled` in `Settings.tsx`/`ProviderRow.tsx`; `dotOf('checking')` → `animate-pulse motion-reduce:animate-none`; no spinner/skeleton component in either file |
| 20 | Keys live in `~/.derive/secrets.json` keyed by provider id, 0600, sibling temp + rename, one-second cache, every loaded value registered (02-02) | ✓ VERIFIED | `keys.ts` `persist()` writes `${SECRETS_PATH}.${pid}.tmp` with `mode: 0o600` then `renameSync`; `KEY_CACHE_MS = 1_000`; `load()` registers every value; tests `writes the file 0600 as { providerId: key }`, `registers every key it loads from a file written by hand` (`secretCount()` grows) |
| 21 | An interrupted write leaves the previous or the complete new file; a concurrent write does a full read-modify-write and the last rename wins (02-02) | ✓ VERIFIED | Structural: `setKey`/`removeKey` call `fresh()` (cache dropped, file re-read) before `persist()`, and `persist()` is write-tmp-then-`renameSync`, whose atomicity is the filesystem's guarantee; the rename path is exercised by the 0600/content assertions above. A crash-mid-write test is not meaningfully automatable or human-verifiable; recorded as code-structural evidence. |
| 22 | An environment key locks the row: `set from environment`, variable named, PUT and DELETE 409 (02-02) | ✓ VERIFIED | `reads set from environment with the variable named, Google before Gemini, and OLLAMA_HOST on the Ollama row`; `answers 409 naming the variable on a key write and on a key removal` |
| 23 | With the same provider in the environment and the file, the environment one is used and shown; the file value is neither returned nor deleted (02-02) | ✓ VERIFIED | `effectiveKey = envKeyFor(id)?.value ?? keyOf(id)` (`settings.ts:203`); `keyOfRow` returns `{ set: true, hint: null, locked: VAR }` for an env row (file hint never returned); DELETE answers 409 while locked so the file entry is never touched; `never echoes an environment value and never copies one into the file` |
| 24 | Remove deletes the key from `secrets.json`; the value stays registered until restart and the UI says so (02-02) | ✓ VERIFIED | `removes a key, says the process still hides it, and removes the file with the last key` (note matches /until Derive restarts/, `existsSync` false); `REMOVED` constant in `ProviderRow.tsx` |
| 25 | A key under 8 characters gets an empty hint; a key under 16 is stored but not redacted, by the Phase 1 floor (02-02) | ✓ VERIFIED | `gives a short key an empty hint…`; `hints with the last four characters of a key at least eight long, and nothing of a shorter one`; `hintOf` at `keys.ts:96-99` |
| 26 | An unreadable secrets.json is loud, never overwritten: `secrets_error` on GET, the keys group shows the line, a key PUT is refused (02-02) | ✓ VERIFIED | `is loud on the settings view, refuses a key, and leaves the file exactly as it was`; `Settings.tsx:128-130` renders the line above the keys group with `nothing here was overwritten` |
| 27 | `OLLAMA_HOST` locks the Ollama base URL, is where the row is probed, reads `set from environment` (02-02) | ✓ VERIFIED | `answers 409 on the Ollama address while OLLAMA_HOST is set`; `localBase` returns `ollamaHostBase(OLLAMA_HOST)` first for the Ollama row (`settings.ts:81-84`) and `probeLocal` reads `localBase`; `rowView.base_url` shows the locked address |
| 28 | The key field states render as specified (02-02) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `KeyField` carries every state's copy (`Paste a key · saved when you leave the field`, `saving`, `•••• ••••`, `replace`/`remove`, `Paste the new key`, `keep the current key` with Escape, `remove the key · keep`, `Removed. …`, `Set by {VAR} in your environment. Unset it to store a key here.`, `err` with the typed value kept); no `confirm(`. Transitions unexercised → Human item 2 |
| 29 | Local rows and the OpenAI-compatible row show a full-width base URL input; empty means default, a bad scheme is refused with the server's sentence, a base URL without a key is valid (02-02) | ✓ VERIFIED | `BaseUrlField` rendered when `row.auth === 'key+url' \|\| row.port !== null`, placeholder `row.base_url_default ?? 'https://…'`, disabled with the OLLAMA_HOST sentence when locked; server refusals tested (row 14); `asks for the base URL first when the OpenAI-compatible row has none` (a base without a key is stored, `PUT { base_url: '' }` clears) |
| 30 | The model field is one combobox: fetched list plus free typing, always; on failure the list is empty, the sentence shows under the field, typing still saves; no second control (02-03) | ✓ VERIFIED | `grep -c '<select' ProviderRow.tsx` → 0; `<input list="models-{id}">` + `<datalist>`; `fetchModels` catch → `setModels([])`, `setFetchErr(sentence)`; `disabled` does not depend on `fetchErr`; the 502 sentence is tested (`… on the test and on the list`) |
| 31 | `listModels` de-duplicates keeping provider order, LM Studio loaded first; zero models reads `0 models fetched · type an id` (02-03) | ✓ VERIFIED | `normalises each provider list to ids in its order, de-duplicated…`; `lists Ollama tags verbatim, LM Studio loaded models first…` (`['y', 'x']`); `fetchedText(0)` |
| 32 | Every provider call carries the key only in a header, only to the row's catalogue host or the learner's own base URL; redirects not followed and reported (02-03) | ✓ VERIFIED | `sends the key in the header each provider reads, and never in the URL` (no `key=`, `x-goog-api-key`, `x-api-key` + `anthropic-version`, Bearer); `requestFor` builds the URL from `spec.endpoint`/`base` only; `getJson` uses `redirect: 'manual'` and `refuses to follow a redirect that could carry the key` asserts a 302 sentence |
| 33 | A provider echoing the key in its error body cannot leak it: every failure sentence passes `safeMessage`; the suite asserts neither key appears (02-03) | ✓ VERIFIED | `testConnection` catch → `safeMessage(e)` (`probe.ts:364`); the models route answers `err(c, e, 502)` which redacts; `never echoes the good key or the wrong one in any response` over ≥ 20 bodies, the fake's 401 body quoting `good-***` |
| 34 | An unreachable endpoint gets Derive's own sentence, never quoted as the provider's (02-03) | ✓ VERIFIED | `names the address in its own sentence when nothing answered` (`nothing answered at 127.0.0.1:`); `tells a local address from a remote one by the literal host alone`; `unreachable()` at `probe.ts:296-302` |
| 35 | A connection test never blocks or alters a running turn; times out at 8 s remote / 4 s local; a second test replaces the previous line (02-03) | ✓ VERIFIED | `REMOTE_MS = 8_000`, `LOCAL_MS = 4_000`, `timeoutFor` by `isLocalUrl`; `probe.ts` imports nothing from `agent.ts`/`prompts.ts` and the routes touch no turn state; `ProviderRow.test()` sets `setResult(null)` before the request |
| 36 | While a fetch or test runs the button reads `fetching…`/`testing…`, disabled, previous result cleared; results on one mono line with `role=status`, `truncate`, full text in `title`; sentences collapsed and cut at 300 server-side (02-03) | ✓ VERIFIED | All present in `ProviderRow.tsx:452-470`; `unwraps every error envelope into status plus the sentence, on one line, cut at 300` (`providerSentence(502, 'x'.repeat(400)).length === 300`) |
| 37 | A key without a base URL on the OpenAI-compatible row yields `Add the endpoint's base URL first` when tested (02-03) | ✓ VERIFIED | `asks for the base URL first when the OpenAI-compatible row has none`; `refuses a list for a login row and for the OpenAI-compatible row without a base URL` |
| 38 | The lesson header shows a small muted `provider · model` pill beside the title inside the 60 px header, linking to /settings; nothing else on the lesson screen changes (02-04) | ✓ VERIFIED | `Lesson.tsx:116-125`: `<Link to="/settings" className="hidden md:inline-flex … text-ink-400 hover:text-ink-50 …">` directly after the `<h1>` inside the `h-[60px]` header; the phase diff of `Lesson.tsx` is +15/-2 and touches only the pill and the companion suffix; no `gold-500` added. Visual placement is Human item 4 |
| 39 | The pill reads the turn, not the setting: first paint from `GET /api/lessons/:id` tutor, live from `turn_start`; a Settings change shows on the next turn, never before (02-04) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `useLesson.ts:235` `st.tutor = a.tutor` on init; `:81` replaces only when `typeof ev.payload?.provider === 'string'`; `EVENT_TYPES` untouched in the phase diff. The ordering invariant is browser-side and unexercised; the server feed is tested → Human item 4 |
| 40 | Before any turn the pill is absent; a turn with model null reads `claude code · default model` (02-04) | ✓ VERIFIED | `{!external && state.tutor && (…)}`; `tutorLabel = provider.replace(/-/g, ' ') · (model ?? 'default model')`; `lessonView.tutor` is null before any turn (`last ? … : null`) |
| 41 | A terminal-driven lesson's companion pill reads `companion · claude code · terminal model` / `companion · codex cli · terminal model`, stays a span, no link (02-04) | ✓ VERIFIED | `Lesson.tsx:31` `driver = … 'codex cli' : 'claude code'`; `:127-142` is a `<span>` with `companion · {driver} · terminal model` and no `to=`; the tutor Link renders only when `!external` |
| 42 | The plugin start message names the driver running the lesson and adds Derive's own tutor setting, omitted only when the server cannot be asked (02-04) | ✓ VERIFIED | `mcp.ts:229` `api(…'/api/settings/active?learner=…').catch(() => null)`; `:245-246` both fields with the spread-conditional; `mcp.test.ts` asserts both (3/3 pass on the built stdio server); `server/test/wire-surface.json` has no commit in `9f92a3a..HEAD` |
| 43 | /settings is linked from the Home nav (`settings` after `how you learn`) and the learner menu (`Settings` with the sub-line) (02-04) | ✓ VERIFIED | `Home.tsx:105-106` the `settings` Link immediately after `how you learn`; `LearnerMenu.tsx:183-187` the `Settings` row with `which model teaches · for everyone on this install` and the lucide `Settings` icon |
| 44 | `pnpm check` reports the secrets file's presence and mode and the active tutor, never a key or hint; `.env.example` documents every provider variable and the precedence rule (02-04) | ✓ VERIFIED | `node scripts/doctor.mjs` run here prints `✓ Secrets file   none yet; add keys in Settings` and exits 0; `doctor.mjs:86-94` never opens the file; `:106` appends ` · tutor: {backend}[ · {model}] ({source})` from `/api/health`; `grep hint scripts/doctor.mjs` empty. `.env.example` carries the precedence paragraph, `# DERIVE_BACKEND=`, `# DERIVE_CODEX_BIN=`, `# ANTHROPIC_API_KEY=`, `# OPENAI_API_KEY=`, `# GEMINI_API_KEY=`, `# GOOGLE_API_KEY=` (Google first), `# OPENROUTER_API_KEY=`, `# OLLAMA_HOST=127.0.0.1:11434`, `DERIVE_MODEL=claude-opus-5-5`, and `<data dir>/secrets.json (mode 0600)` |
| 45 | A learner sets one optional model id on /you overriding the install-wide model for that learner alone, on the active provider only; empty means install default; keys never appear on /you (02-05) | ✓ VERIFIED | `resolves a learner-owned model for that learner alone, by query and by header, and leaves the default learner on the install setting`; `bounds the learner model id like the install one, and clears it with an empty string`; `You.tsx:45` reads `api.activeTutor()` only (provider and model) and `api.profile()`; no settings row reaches the page |
| 46 | The override sits between the environment and the settings table (env > learner > settings > default), reported as `modelSource 'learner'`; the next turn of that learner runs on it; other learners unaffected (02-05) | ✓ VERIFIED | `chooseModel` at `settings.ts:158-166`; `outranks a learner-owned model while DERIVE_MODEL is set`; `runs a learner-owned model on that learner's next turn and keeps it out of the prompt` (`lastTurn(id).model === 'my-own-model'`, another learner's turn does not); `agent.ts:276` `resolveTutor(lesson.learner_id)` |
| 47 | The per-learner model id never reaches the tutor: `preferencesSection` does not render it, `learnerProfile()` lacks it, `describePrefs` ignores it (02-05) | ✓ VERIFIED | `preferencesSection` (`db.ts:320-343`) has no `model` line; the in-process case asserts the `learnerProfile` text contains the learner's `examples` but not the model id; `web/src/lib/prefs.ts` has no phase commit and `describePrefs` names no model. See Anti-Patterns ℹ️ for a tool-result/vault path outside the three surfaces the prohibition names |
| 48 | `GET /api/settings/active` honours `?learner=` and `x-derive-learner` (02-05) | ✓ VERIFIED | `index.ts:442` `resolveTutor(learnerOf(c))`; the HTTP case asserts both the query and the header |
| 49 | The /you field inherits Save and ⌘↵; its placeholder names the install default and falls back to `install default` while pending or failed (02-05) | ✓ VERIFIED | `You.tsx:135-140`: Section `n="07"` `title="Model"`, `aria-label="Your model"`, `placeholder={installModel ? \`install default: ${installModel}\` : 'install default'}`, `installModel` null until `api.activeTutor()` answers; the field is part of `draft` saved by the page's existing Save. Visual is Human item 5 |
| B1 | 60-character local model id does not break the 40 px combobox (02-03, backstop) | ⚠️ insufficient_spec | Abstained per `verification: backstop`; routed to Human item 3 |
| B2 | Multi-line 4xx body renders as one line under the row (02-03, backstop) | ⚠️ insufficient_spec | Server half proven (`quotes the provider 401 verbatim on one line` — the fake's two-line body reads as one); the render under the row is routed to Human item 3 |
| B3 | Model ids and provider names rendered verbatim in the pill, truncated only by CSS (02-04, backstop) | ⚠️ insufficient_spec | `max-w-[28ch] truncate` with `title={tutorLabel}` present; abstained; Human item 4 |
| B4 | 60-character id fits the /you input (02-05, backstop) | ⚠️ insufficient_spec | `font-mono h-10 max-w-[320px]` present; abstained; Human item 5 |

**Score:** 50/58 truths verified (4 present, behavior-unverified; 4 backstop truths abstained → human). Five restated roadmap criteria (02-01 #1, 02-06 #6, 02-02 #1, 02-03 #1, 02-03 #4) are counted once, in the roadmap table.

### Prohibitions (must-NOT)

| Plan | Statement (abridged) | Tier | Disposition | Evidence |
|------|----------------------|------|-------------|----------|
| 02-01 | Never forward `claude auth status` identity; no `email` key in settings/health bodies | test | ✓ VERIFIED | `never carries the identity claude auth status prints`; `reports the boot observation as the detected provider`; `claudeLoggedIn`/`claudeLoggedInAsync` parse only `loggedIn` |
| 02-01 | Nothing detects in the background; read-only routes never spawn | test | ✓ VERIFIED | Marker-shim case: one boot run, zero across six reads; `POST /detect` exactly one |
| 02-01 | A non-teaching provider never becomes active by any route | test | ✓ VERIFIED | 400 refusal case; `ignores a stored provider that does not teach and falls to detection` |
| 02-01 | Lesson screen gains only the header pill | judgment | ⚠️ NON-AUTHORITATIVE holds — flagged | Phase diff of `Lesson.tsx` is the pill + companion suffix only |
| 02-06 | Detect body carries no identity | test | ✓ VERIFIED | `falls back to Claude Code…` asserts no `email` on the detect body |
| 02-06 | Nothing probes or polls in the background | test | ✓ VERIFIED | Spawn-count case; `Settings.tsx` has no `setInterval`/scheduled `detectProviders` |
| 02-06 | No Use this provider on `teaches:false` rows; API refuses them | test | ✓ VERIFIED | `row.teaches ? <button> : null`; 400 case |
| 02-06 | Browser hard-codes no provider facts; never re-sorts | judgment | ⚠️ NON-AUTHORITATIVE holds — flagged | `Settings.tsx` filters by API group, no sort; every row fact read from `row` |
| 02-02 | API never returns a key beyond the last four of ≥ 8 chars; no read-back route | test | ✓ VERIFIED | `{ set, hint }` cases; `keys.ts` exports no value reader beyond `keyOf` (server-internal); 20+-body echo sweep |
| 02-02 | Key only to its own host or the stored base; never in a URL; never on a redirect | test | ✓ VERIFIED | `sends the key in the header…never in the URL`; redirect case |
| 02-02 | Env key never written to the file, never shown with a hint | test | ✓ VERIFIED | `never echoes an environment value and never copies one into the file`; `hint: null` on env rows |
| 02-03 | Provider sentence never rewritten; hint a separate field | test | ✓ VERIFIED | `quotes the provider 401 verbatim…`; `adds a hint only for the cases it recognises` |
| 02-03 | Models/test request only to the row's endpoint or stored base; never key in URL | test | ✓ VERIFIED | Pure `requestFor` cases; `requestFor` reads `spec.endpoint` only |
| 02-03 | Suite never calls a real provider host | test | ✓ VERIFIED | `grep` for the four catalogue hosts in `settings.test.ts` is empty; every network case is a loopback fake |
| 02-04 | Pill states what the last turn ran on, never the setting | test | ⚠️ UNVERIFIED — flagged (fail-closed) | No wired web test; server feed tested; reducer present at `useLesson.ts:81,235` → Human item 4 |
| 02-04 | Companion pill no link, says `terminal model` | judgment | ⚠️ NON-AUTHORITATIVE holds — flagged | `Lesson.tsx:127-142` span, text present |
| 02-05 | Per-learner model never in the system prompt, the preferences event summary, or the menu description | test | ✓ VERIFIED | `learnerProfile` text lacks the id (in-process case); `describePrefs` untouched; `preferencesSection` has no line. See ℹ️ below for the adjacent tool-result path |

13 of 17 verified; 4 flagged (1 test-tier unverified, 3 judgment-tier non-authoritative). All four are absorbed into Human Verification item 4; none is a gap.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `server/src/providers.ts` | catalogue: `PROVIDERS`, `ProviderSpec`, `providerOf`, `providerOfDriver`, `labelOf`, `DEFAULTS_AS_OF` | ✓ VERIFIED | 219 lines; ten entries in the fixed order; `teaches` on two; `optionalKey` on two; imported by settings, probe, index, agent (via settings) |
| `server/src/settings.ts` | `resolveTutor`, `currentTutor`, `backendOf`, `lockedBy`, detection observation, `localBase`, `portOf`, `normaliseBaseUrl`, `envKeyFor`, `effectiveKey` | ✓ VERIFIED | 215 lines; all exports present and used by `index.ts`, `agent.ts`, `probe.ts`; no `process.env` |
| `server/src/keys.ts` | `keyOf`, `hintOf`, `keyView`, `setKey`, `removeKey`, `secretsFileError`, `resetKeyCache` | ✓ VERIFIED | 145 lines; `renameSync` ×2, `mode: 0o600`; used by `index.ts` and `settings.ts` |
| `server/src/probe.ts` | `detect`, `probeJson`, shape checks, `claudeLoggedInAsync`, `requestFor`, `idsOf`, `providerSentence`, `hintFor`, `getJson`, `listModels`, `testConnection` | ✓ VERIFIED | 369 lines; `redirect: 'manual'` ×2; `safeMessage(` ×1; used by `index.ts` (three routes) |
| `server/src/config.ts` | `SECRETS_PATH`, `ENV_KEYS`, `OLLAMA_HOST` | ✓ VERIFIED | Present; the phase's only new environment reads |
| `server/src/migrations.ts` | migration 5 `settings` | ✓ VERIFIED | `version: 5, name: 'settings'` creating `settings(key, value, updated_at)` |
| `server/src/index.ts` | `// ---------- settings ----------`, seven routes, health from `currentTutor()`, `lessonView.tutor` | ✓ VERIFIED | Lines 339-538; `GET /api/settings`, `GET/POST /api/settings/active`, `PUT /api/settings/:provider`, `DELETE …/key`, `POST /detect`, `POST …/models`, `POST …/test`; `err` union includes 502 |
| `server/src/agent.ts` | `runTurn` on `resolveTutor(lesson.learner_id)`, session clearing, `turn_start` payload | ✓ VERIFIED | Lines 276-297 |
| `server/src/mcp.ts` | `tutor_running_this_lesson`, `app_tutor_setting` | ✓ VERIFIED | Lines 229-246 |
| `server/src/db.ts` | `getSetting`/`setSetting`/`deleteSetting`, `clearSessionId`, `LearnerPrefs.model` + `cleanPrefs` rule | ✓ VERIFIED | Lines 61, 179-181, 275-278, 435, 470-481 |
| `server/test/settings.test.ts` | HTTP + module cases (min 120 lines) | ✓ VERIFIED | 1205 lines, 79 cases, `# fail 0`; contains `Incorrect API key provided` and an "HTML" case |
| `web/src/pages/Settings.tsx` | `SettingsPage` | ✓ VERIFIED | 169 lines; routed at `/settings`; no `Save</button>`/`type="submit"` |
| `web/src/components/ProviderRow.tsx` | `ProviderRow`, key field, base URL, datalist, fetch/test | ✓ VERIFIED | 502 lines; `<datalist` ×1, `<select` ×0, `keep the current key` present |
| `web/src/pages/Lesson.tsx` | tutor pill Link; companion `terminal model` | ✓ VERIFIED | Lines 31-33, 116-142 |
| `web/src/lib/useLesson.ts` | `LessonState.tutor` seeded on init, updated on `turn_start` | ✓ VERIFIED | Lines 33, 54, 81, 235, 266 |
| `web/src/pages/Home.tsx`, `web/src/components/LearnerMenu.tsx` | the two /settings entry points | ✓ VERIFIED | `Home.tsx:106`; `LearnerMenu.tsx:183-187` |
| `web/src/pages/You.tsx` | Section 07 Model | ✓ VERIFIED | Lines 10, 26-27, 45, 135-140 |
| `web/src/lib/api.ts`, `web/src/lib/types.ts` | eight settings keys; `ProviderView`, `TutorChoice`, `Settings`, `ProviderStatus`, `TestResult`, `LearnerPrefs.model`, `lesson.tutor` | ✓ VERIFIED | `api.ts:69,107-121`; `types.ts:26,31-89` |
| `scripts/doctor.mjs`, `.env.example` | Secrets file line, tutor suffix; the variables and precedence | ✓ VERIFIED | Ran; see truth 44 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `agent.ts` | `settings.ts` | `resolveTutor(lesson.learner_id)` before `startTurn`; `turn_start { provider, model }` | ✓ WIRED | `agent.ts:276-284`; tested (`runs the very next turn…`) |
| `settings.ts` | `db.ts` | `getSetting('active_provider')`, `getSetting('model:<id>')`, `getLearner(learnerId)?.prefs.model` | ✓ WIRED | `settings.ts:150-166` |
| `index.ts` | `settings.ts` | `currentTutor()` in `settingsView`/health; `resolveTutor()` on active routes | ✓ WIRED | `index.ts:289,423,442,453` |
| `index.ts` | `db.ts` | `lessonView.tutor` from `lastTurn(id)` | ✓ WIRED | `index.ts:282` |
| `probe.ts` | `settings.ts` | `detect()` ends in `rememberDetection({ logins, local })`; `effectiveKey`, `localBase` | ✓ WIRED | `probe.ts:136,325,329` |
| `index.ts` | `probe.ts` | `await detect()`, `listModels`, `testConnection` | ✓ WIRED | `index.ts:518,527,537` |
| `keys.ts` | `secrets.ts` | `registerSecret` on load and before persist | ✓ WIRED | `keys.ts:76,116`; tested |
| `index.ts` | `keys.ts` | `setKey`, `removeKey`, `keyView` | ✓ WIRED | `index.ts:384,392,477,503` |
| `settings.ts` | `config.ts` | `ENV_KEYS` in `envKeyFor`; `lockedBy('key:<id>')` | ✓ WIRED | `settings.ts:29-34,194-200` |
| `probe.ts` | `providers.ts` | `requestFor`/`idsOf` from the spec | ✓ WIRED | `probe.ts:176-206,223-244` |
| `Settings.tsx` | `index.ts` | `api.settings()`, `api.detectProviders()`, `api.useProvider()` | ✓ WIRED | `Settings.tsx:44,57,76` |
| `ProviderRow.tsx` | `index.ts` | `api.setProvider` (model, key, base_url), `api.removeKey`, `api.providerModels`, `api.testProvider` | ✓ WIRED | `ProviderRow.tsx:93,111,230,318,340,356` |
| `useLesson.ts` | `index.ts` | init reads `d.tutor`; `turn_start` reads `payload.provider/model` | ✓ WIRED | `useLesson.ts:81,266` |
| `mcp.ts` | `index.ts` | `/api/settings/active?learner=` with null fallback | ✓ WIRED | `mcp.ts:229`; tested |
| `You.tsx` | `index.ts` | `api.setPrefs` with `model`; `api.activeTutor()` | ✓ WIRED | `You.tsx:45` and the page's existing save |

### Data-Flow Trace (Level 4)

| Artifact | Data variable | Source | Produces real data | Status |
|----------|---------------|--------|--------------------|--------|
| `/settings` rows | `settings.rows[*].model/base_url/key/status/active` | `settingsView()` ← `getSetting` (SQLite `settings`), `keyView` (`secrets.json`), `envKeyFor` (`ENV_KEYS`), `lastDetection()` (the pass) | Yes — every field read live per request; no static fallback | ✓ FLOWING |
| Teaching-now line | `settings.active` | `currentTutor()` ← env / table / last pass | Yes | ✓ FLOWING |
| Model datalist | `models` | `POST …/models` ← `listModels` ← provider host (or stored base) | Yes — empty before a fetch by design (D-08), filled by a real request | ✓ FLOWING |
| Test result line | `result` | `POST …/test` ← `testConnection` ← real request | Yes | ✓ FLOWING |
| Header pill | `state.tutor` | `lessonView.tutor` ← `lastTurn(id)` (turns row); `turn_start` payload ← `resolveTutor` | Yes | ✓ FLOWING |
| Plugin start message | `app_tutor_setting` | `GET /api/settings/active?learner=` ← `resolveTutor(learner)` | Yes | ✓ FLOWING |
| /you placeholder | `installModel` | `GET /api/settings/active` | Yes | ✓ FLOWING |
| Doctor Server line | `health.backend/model/source` | `/api/health` ← `currentTutor()` | Yes (only when a server is up; shown as `not running` here) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Server and web build | `pnpm build` | exit 0 | ✓ PASS |
| Settings suite | `pnpm --filter server exec node --import tsx --test test/settings.test.ts` | `# tests 79 # pass 79 # fail 0` | ✓ PASS |
| MCP stdio suite (plugin start message) | `pnpm --filter server exec node --import tsx --test test/mcp.test.ts` | `# tests 3 # pass 3 # fail 0` | ✓ PASS |
| Whole-tree gate (run once) | `pnpm method:check && pnpm typecheck && pnpm build && pnpm test` | exit 0; `method: 6 rendered copies match`; both typechecks; `# tests 280 # pass 280 # fail 0` | ✓ PASS |
| Doctor reports the secrets file | `node scripts/doctor.mjs` | `✓ Secrets file   none yet; add keys in Settings`, exit 0 | ✓ PASS |
| No real provider host in the suite | `grep "api.anthropic.com\|api.openai.com\|openrouter.ai\|googleapis.com" server/test/settings.test.ts` | empty | ✓ PASS |
| No direct env reads outside config | `grep process.env server/src/{settings,keys,probe,providers}.ts` | empty | ✓ PASS |
| One combobox, no second control | `grep -c "<select" web/src/components/ProviderRow.tsx` | 0 | ✓ PASS |
| `EVENT_TYPES` untouched | `git diff -U0 9f92a3a..HEAD -- web/src/lib/useLesson.ts \| grep "'turn_start', 'turn_end'"` | empty | ✓ PASS |
| `prefs.ts` untouched; wire surface untouched | `git diff --stat 9f92a3a..HEAD -- web/src/lib/prefs.ts server/test/wire-surface.json` | empty | ✓ PASS |
| No `gold-500` on the pill | `git diff -U0 9f92a3a..HEAD -- web/src/pages/Lesson.tsx \| grep "^+.*gold-500"` | empty | ✓ PASS |
| Documented commits exist | `verify.commits` on the 13 task hashes | `all_valid: true` | ✓ PASS |
| Working tree clean for phase source | `git status --porcelain -- server web scripts .env.example plugin codex` | empty | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` exists in this repository and no PLAN or SUMMARY names one. Step 7c: not applicable.

### Requirements Coverage

| Requirement | Source plans | Description | Status | Evidence |
|-------------|--------------|-------------|--------|----------|
| SET-01 | 02-01, 02-06, 02-05 | Choose provider and model on a settings page; the choice persists across restarts | ✓ SATISFIED | SC1 (real-restart case), truths 1-9, 15-16, 45-49; page wired |
| SET-02 | 02-02, 02-04 | One masked key per provider in a 0600 secrets file outside the database, never echoed by the API | ✓ SATISFIED | SC2, truths 20-26, 44 |
| SET-03 | 02-01, 02-06, 02-02, 02-04 | Detect logged-in CLIs, environment keys ("set from environment"), local servers on default ports | ✓ SATISFIED | SC3, truths 6-8, 10-14, 22-23, 27 |
| SET-04 | 02-03 | Fetch a provider's model list, manual id fallback, curated default | ✓ SATISFIED | SC4, truths 30-31, 37 |
| SET-05 | 02-03 | Test a connection and see the actual failure sentence | ✓ SATISFIED | SC5 (test half), truths 32-36 |
| SET-06 | 02-04 | Active provider and model visible in the lesson header and the plugin start message | ✓ SATISFIED (plugin) / ? NEEDS HUMAN (header render) | `mcp.test.ts` asserts the message; the header pill is present and wired (truths 38-41) but no test renders it → Human item 4 |

Orphaned requirements: none. REQUIREMENTS.md maps exactly SET-01..06 to Phase 2 and every one is claimed by at least one plan's `requirements:` field.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | `TBD` / `FIXME` / `XXX` / `TODO` / `HACK` / `PLACEHOLDER` across the 26 phase-modified files | none found | — |
| — | — | `console.log`, `dangerouslySetInnerHTML`, `confirm(` in the new server modules and the two new pages | none found | — |
| `server/src/actions.ts` | 484-485 | `setPreferences` emits `learner.prefs` as the `preferences` event and returns it in the tool result; since 02-05 that object may carry `model` when the learner set one on /you, and `export.ts:150-154` renders every entry of that payload into the vault note | ℹ️ Info | Does not touch any success criterion. The 02-05 prohibition names the system prompt, the web preferences summary (`describePrefs`, unchanged) and the menu description — all hold, and the `set_preferences` tool schema cannot write `model`. But a tutor that calls `set_preferences` reads `model: <id>` in its result, and an Obsidian note can carry it. A one-line filter of `model` from the emitted payload and the returned `preferences` would close it. Advisory only; recorded, not a gap. |
| `.planning/ui-reviews/.gitignore` | — | An untracked directory appeared during this verification run (mtime 20:03 local) that was not in the starting `git status` | ℹ️ Info | Not a phase artifact and not source; most likely a hook side effect of the gate run. Nothing under `server/`, `web/`, `scripts/` changed. |

### Human Verification Required

All five items are harvested from the plans' `<verify><human-check>` blocks (`workflow.human_verify_mode = end-of-phase`; the SUMMARY coverage blocks record them as `human_judgment: true`) and merged with this report's own findings. They are listed in full in the frontmatter `human_verification` block; in short:

1. **The /settings page** (02-06): ten rows in three groups, gold `teaching now`, Use this provider flips at once with the tick, model tick on blur, `rescan` → `scanning…`, quiet network tab, first paint before the scan, same provider after a restart. Resolves ⚠️ truths 17-18 and the 02-06 judgment prohibition.
2. **The key field states** (02-02): paste → dots + last four with `replace · remove`, two-step inline remove with Escape, the five-second removed sentence, `set from environment` with `OPENAI_API_KEY` exported, the Ollama base URL input. Resolves ⚠️ truth 28.
3. **Fetch models and test connection** (02-03): the datalist and `N models fetched`, a 60-character id scrolling inside the input, `401 …` in rust with the hint beneath on a wrong Anthropic key, the 360 px layout, `Logged in · N ms` on Claude Code. Resolves backstops B1-B2.
4. **The header pill and the entry points** (02-04): the pill after one turn, its flip only on the next turn after a Settings change, the companion pill as a non-link reading `terminal model`, the Home nav link and the learner-menu row, CSS-only truncation. Resolves ⚠️ truth 39, backstop B3, and all four flagged prohibitions.
5. **/you Section 07** (02-05): the `install default: …` placeholder, the saved line, the menu sub-line not naming the model, a 60-character id fitting, and the plugin start message naming that learner's id. Resolves backstop B4.

### Gaps Summary

No gaps. Every roadmap success criterion is achieved in the codebase with behavioral evidence from a hermetic 79-case settings suite (real restart, real `auth.json`, loopback fakes, a spawn-counting `claude` shim, a 20+-body key-echo sweep), the 3-case stdio MCP suite, and a green whole-tree gate (280/280). What remains is visual and interactive: this repository has no web test runner, so the settings page, the key field state machine, the datalist, the header pill's flip-on-next-turn ordering and Section 07 are present and wired but exercised only in a browser. Those are the five human items above; four plan truths are therefore `PRESENT_BEHAVIOR_UNVERIFIED`, four `backstop` truths are abstained, and four prohibitions (one test-tier with no wired web test, three judgment-tier) are flagged for the same human pass. The status is `human_needed`, not `gaps_found`.

One advisory note (not a gap, outside the phase's must-haves): the `preferences` event and the `set_preferences` tool result now carry the learner's `model` id when one is set on /you; see Anti-Patterns.

---

_Verified: 2026-09-30T23:05:41Z_
_Verifier: Claude (gsd-verifier)_
