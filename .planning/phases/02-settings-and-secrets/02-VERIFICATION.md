---
phase: 02-settings-and-secrets
verified: 2026-10-01T11:41:32Z
status: passed
score: 63/63 must-haves verified
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
  - .planning/phases/02-settings-and-secrets/02-07-PLAN.md
  - .planning/phases/02-settings-and-secrets/02-07-SUMMARY.md
  - scripts/doctor.mjs
  - server/src/agent.ts
  - server/src/backend.ts
  - server/src/codex.ts
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
covered_digest: "v1:sha256:736d754b02dda69d6a6d3cb56b16a9e7b758491a066e3048aa43bdbe96a51a48"
behavior_unverified: 0
insufficient_spec: 0
overrides_applied: 1
overrides:
  - must_have: "A 59-character model id entered in /you Section 07 fits the input without scrolling (UAT test 5, the one open issue)"
    reason: "Amended expectation, not a met must-have. 02-07 removed the max-w-[320px] cap and the input now fills its column, but the column is 464px and a 59-character JetBrains Mono 14px id needs 520px. Reaching 520px requires widening the approved max-w-[760px] /you form or shrinking its 200px label column, which re-rhythms all seven sections. The owner took the second route the gap text offered: accept the id scrolling inside a 40px row without breaking it — exactly the behaviour /settings has and which UAT test 3 already accepted for a 59-character id in the provider-row model input. UAT test 5's `expected` was amended in writing (02-UAT.md `expected_amended`) and the test settled as a pass on the amended wording."
    accepted_by: "jicanta (owner)"
    accepted_at: "2026-10-01"
prohibitions:
  total: 17
  verified: 17
  flagged: 0
  resolved_since_previous:
    - statement: "The header pill must state what the last turn ran on, never what Settings currently says; a pending change must not be shown as already applied"
      plan: 02-04
      tier: test
      previous_disposition: "unverified-prohibition — human review recommended"
      disposition: "✓ RESOLVED by the human checkpoint — UAT test 4 (pass): the pill kept the old value after the install switched to Codex, and flipped live on the next turn only; the observed turn_start sequence was claude-code → codex → claude-code"
      residual: "No automated regression guard exists for the browser-side ordering rule (this repo has no web test runner); the server feed stays tested (settings.test.ts turn_start payload deep-equal). Recorded under advisory."
    - statement: "The lesson screen gains only the header pill of plan 04; no control, panel or page is added outside Settings by this phase"
      plan: 02-01
      tier: judgment
      previous_disposition: "NON-AUTHORITATIVE LLM verdict: holds — human review recommended"
      disposition: "✓ RESOLVED by the human checkpoint — UAT test 4 (pass); git diff 9f92a3a..HEAD -- web/src/pages/Lesson.tsx is +15/-2 against the pre-phase baseline (the pill, the companion suffix, and 02-07's 28ch→40ch inside an already-added line), no other lesson-screen file changed"
    - statement: "The browser hard-codes no provider facts: every label, note, default, port and status comes from GET /api/settings, and the page never re-sorts rows"
      plan: 02-06
      tier: judgment
      previous_disposition: "NON-AUTHORITATIVE LLM verdict: holds — human review recommended"
      disposition: "✓ RESOLVED by the human checkpoint — UAT test 1 (pass): ten rows in catalogue order in three groups, every row fact read from the API row; 02-07 changed only class strings in Settings.tsx/ProviderRow.tsx"
    - statement: "On an external lesson nothing may claim Derive chose or can change the terminal's model: the companion pill must not link to Settings and must say 'terminal model'"
      plan: 02-04
      tier: judgment
      previous_disposition: "NON-AUTHORITATIVE LLM verdict: holds — human review recommended"
      disposition: "✓ RESOLVED by the human checkpoint — UAT test 4 (pass): the companion lesson rendered the span `companion · claude code · terminal model`, not a link"
re_verification:
  previous_status: human_needed
  previous_score: 50/58
  previous_verified_at: 2026-09-30T23:05:41Z
  trigger: "Gap-closure plan 02-07 (5f24bc6, 95f8dcc, ae03161) plus the settled human UAT (02-UAT.md status: passed, 5/5; re-driven 201411d, 531912f)"
  covered_files_changed_since:
    - .planning/ROADMAP.md
    - web/src/components/ProviderRow.tsx
    - web/src/pages/Lesson.tsx
    - web/src/pages/Settings.tsx
    - web/src/pages/You.tsx
  covered_files_added:
    - .planning/phases/02-settings-and-secrets/02-07-PLAN.md
    - .planning/phases/02-settings-and-secrets/02-07-SUMMARY.md
    - server/src/codex.ts
  gaps_closed:
    - "Settings `<h1>` overflowed the 60px header below md (UI-REVIEW fix 1) — `truncate min-w-0` at Settings.tsx:102; re-measured at 375px: one 33px line in a 60px header, ellipsis computed, no page scroll"
    - "/you `<h1>` shared the defect (UI-REVIEW fix 1, second site) — `truncate min-w-0` at You.tsx:84; same five measurements pass on the longer title"
    - "Seven provider-row text buttons had no hit area (UI-REVIEW fix 2) — `textButton` leads with `inline-flex items-center h-8`; each of the six re-driven buttons measures exactly 32px, no row broke at 375px"
    - "Dead `hover:text-rust-300` on the destructive confirm (UI-REVIEW fix 3) — now `${textButton} text-rust-400 hover:text-rust-500`; the served CSS carries the rule, `--color-rust-500` resolves, zero `rust-300` in the bundle"
    - "Lesson header pill cut the model id (UAT test 4 gap 2) — `max-w-[28ch]` → `max-w-[40ch]`; the 29-char label needs 221px and the cap gives 241px, so it renders uncut"
    - "Codex model-refused hint named the retired mechanism (UAT test 4 gap 3) — `friendly()` now names the Codex row in Settings; `DERIVE_MODEL` and `~/.codex/config.toml` are gone from codex.ts's hint"
    - "Four behavior-unverified truths (17, 18, 28, 39) and three backstop truths (B1, B2, B3) now carry human-observed behavioural evidence from the settled UAT"
    - "Four flagged prohibitions resolved by the human checkpoint (UAT tests 1 and 4)"
  gaps_remaining: []
  regressions: []
  gate_rerun_at_head:
    - "pnpm typecheck — exit 0 (server + web)"
    - "pnpm test — # tests 280 # pass 280 # fail 0"
    - "pnpm build — exit 0, web then server"
    - "node scripts/doctor.mjs — exit 0, `✓ Secrets file   none yet; add keys in Settings`"
advisory:
  - finding: "No automated regression guard for the browser-side header-pill ordering invariant (`turn_start` replaces `state.tutor`; Settings never writes it). The invariant is present at useLesson.ts:81,235, the server feed is tested, and the human UAT observed the live flip — but nothing in CI would catch a reducer regression."
    category: other
    reason: "This repo has no web test runner (package.json `test` is server-only). Resolving it means adding one, which is outside Phase 2's scope. Raised so the decision is explicit rather than implicit."
    evidence_status: "none provided — no red test; the invariant currently holds (UAT test 4)"
  - finding: "The `remove the key` hover colour change is verified statically, not behaviourally. The rule `.hover\\:text-rust-500:hover{color:var(--color-rust-500)}` is in the served CSS inside an `@media (hover:hover)` block, `--color-rust-500` resolves to #c9785a, `--color-rust-300` is undefined and `rust-300` appears zero times in the bundle. Headless Chrome 148 reports `(hover:hover) === false` in both headless modes and `Emulation.setEmulatedMedia` cannot override it, so no hover anywhere in the app is observable in this harness."
    category: other
    reason: "Harness limit, not a code finding — it blocks every hover in the app equally. A human pointing at `remove the key` in a desktop browser confirms it in one second."
    evidence_status: "deterministic static evidence (compiled CSS + resolved token); the rendered pixel not observed"
  - finding: "02-REVIEW.md WR-01 — a learner's model override is a bare string with no provider attached, so after `Use this provider` switches the install, `chooseModel` still returns that learner's id for the new provider and their turns fail. This sits adjacent to truth 45's clause `on the active provider only`."
    category: architectural
    reason: "Unevidenced new scope under the re-verification evidence gate: not a carried-forward gap, no red test, and server/src/settings.ts has not been modified since the previous verification at 2026-09-30T23:05:41Z. Reported, not blocking, and it does not revert a completed must-have. 02-07 fix 7 improves the surface a learner meets in exactly this sequence (the Codex refusal hint now names the Codex row in Settings) without closing the scoping gap. Review's own smallest fix: key `LearnerPrefs.model` by provider, or drop the override when the provider no longer matches."
    evidence_status: "none provided — a reproducible argument in 02-REVIEW.md, no failing test"
  - finding: "02-REVIEW.md WR-05(b) — `api.activeTutor()` carries the `x-derive-learner` header, so for a learner who already has an override `installModel` is their own id and the /you placeholder reads `install default: <their own id>` once they clear the field without reloading. Adjacent to truth 49's `placeholder names the install default`."
    category: other
    reason: "Same evidence gate: not a carried-forward gap, no red test, web/src/pages/You.tsx changed since only for 02-07's two class edits (neither touches the fetch). UAT test 5 observed the correct placeholder on a learner with no override. Reported, not blocking."
    evidence_status: "none provided"
  - finding: "02-REVIEW.md leaves WR-02, WR-03, WR-04 and IN-01..IN-07 open (0 critical, 5 warning, 7 info). None contradicts a roadmap success criterion or a must-have truth."
    category: other
    reason: "Code-review findings are not verification gates in this project; the owner reviewed 02-REVIEW.md and scoped 02-07 to the UAT and UI-review findings only."
    evidence_status: "none provided"
  - finding: "02-UI-REVIEW.md minors left open by design: the empty left half on login and local rows (Pillar 2, `ProviderRow.tsx:433` pins the model field to `md:col-start-2`), `mt-3` ×4 and `mb-1.5` ×1 off the declared 4/8/16/24/32 spacing scale (Pillar 5), and `Use this provider` explaining its disabled state through `title` alone (Pillar 6)."
    category: other
    reason: "Scored minor/non-blocking by the review; closing the first would change the approved 02-UI-SPEC column, which a gap-closure plan may not do. 02-07's scope was the review's Top 3 only. Overall UI score was 20/24 before the fixes; the three WARNINGs are now closed."
    evidence_status: "none provided"
  - finding: "`setPreferences` (`server/src/actions.ts:484-485`) emits `learner.prefs` as the `preferences` event and returns it in the tool result; since 02-05 that object may carry `model`, and `export.ts:150-154` renders every entry of that payload into the vault note."
    category: other
    reason: "Carried forward unchanged from the previous report. Does not touch any success criterion; the 02-05 prohibition names the system prompt, `describePrefs` and the menu description, and all three hold. Verified still present at HEAD."
    evidence_status: "none provided"
behavior_unverified_items: []
coincidental_reliance_items: []
---

# Phase 2: Settings and Secrets Verification Report

**Phase Goal:** The learner chooses provider and model in the app, sees what the machine already offers, stores keys safely, tests the connection, and always knows which model is teaching.
**Verified:** 2026-10-01T11:41:32Z
**Status:** passed
**Score:** 63/63 must-haves verified (1 by owner-accepted override)
**Re-verification:** Yes — second pass, after gap-closure plan 02-07 and the settled human UAT. Previous pass: 2026-09-30T23:05:41Z, `human_needed`, 50/58.

## What changed since the previous report

Two things, and both are the reason the status moves off `human_needed`:

1. **Gap-closure plan 02-07** (`5f24bc6` plan, `95f8dcc` fix, `ae03161` docs) applied seven one-line
   edits across five files — 7 insertions, 7 deletions, verified in the diff — closing the three
   WARNINGs in `02-UI-REVIEW.md`'s Top 3 and the three findings in `02-UAT.md`'s Gaps. Every edit is
   confirmed present at HEAD (`531912f`) by reading the five files, and the three compiled utilities
   (`truncate`/`min-w-0`, `h-8`, `max-w-[40ch]`, `hover:text-rust-500`) are confirmed in the built
   `web/dist` CSS. `pnpm typecheck`, `pnpm test` (280/280) and `pnpm build` were re-run here at HEAD
   and all pass.

2. **The human UAT is settled** — `02-UAT.md` reads `status: passed`, 5/5, 0 issues. All five items
   were driven in headless Chrome on 2026-09-30; the six gap fixes were re-driven on 2026-10-01 with
   **27 of 29 checks passing**. The two that did not pass behaviourally are recorded as such below
   and in the frontmatter, not rounded up:
   - the `remove the key` hover could not be observed at all (Tailwind v4 gates every `hover:` utility
     behind `@media (hover:hover)` and headless Chrome reports that false) — verified statically
     instead, and recorded as an advisory;
   - UAT test 5's "a 60-character id fits the input" was **amended** by an explicit owner decision to
     "scrolls inside the input without breaking the row" — recorded as an **override**, not as a met
     must-have.

The previous report's 8 unverified must-haves (4 behavior-unverified truths, 4 backstop abstentions)
are all resolved: 7 by the human UAT's behavioural evidence, 1 by the override.

## MVP mode note

ROADMAP marks this phase `mode: mvp`, but its `**Goal:**` line is prose, not a User Story
(`gsd_run query user-story.validate` answers `valid: false` on all three slots). As in the previous
pass and in Phase 1, the standard goal-backward structure is used against the five ROADMAP success
criteria. The User Flow Coverage table below is built from plan 02-01's restatement of the goal as a
User Story, which adds nothing to it. `/gsd-mvp-phase 2` would set a canonical User Story goal on the
roadmap; nothing in this report depends on it.

## User Flow Coverage

| Step | Expected | Evidence in codebase | Status |
|------|----------|----------------------|--------|
| Learner opens Settings | `/settings` renders one row per provider from the API | `web/src/main.tsx` route; `Settings.tsx` `api.settings()` (`:58`) then one `api.detectProviders()` (`:46`); `GET /api/settings` → `settingsView()` | ✓ VERIFIED — API tested (`paints every row from stored config, in catalogue order, with one active row`) + UAT test 1 (ten rows, three groups, catalogue order, rows painted at 122 ms before the pass settled at 378 ms) |
| Learner sees what the machine already offers | logins, env keys, local ports without typing | `probe.ts detect()` one `Promise.all`; `keyView`/`envKeyFor`; shape-checked probes of 11434/1234/8080 | ✓ VERIFIED — hermetic tests + UAT tests 1 and 2 (Claude Code and Codex `logged in`, fake Ollama `found on port 11434`, `set from environment` with `OPENAI_API_KEY` exported) |
| Learner stores a key | pasted once, masked after, 0600 file, never echoed | `keys.ts` tmp+`renameSync` at `mode: 0o600`; `{ set, hint }` only | ✓ VERIFIED — tests + UAT test 2 (`•••• •••• 5678`, value absent from the page and from `GET /api/settings`, no reveal control, 30/30 checks) |
| Learner picks a model | fetched list or free typing, curated default preselected | `<input list="models-{id}">` + `<datalist>`; `listModels`; catalogue defaults | ✓ VERIFIED — tests + UAT test 3 (`3 models fetched`, datalist carried all three ids) |
| Learner tests the connection | success, or the provider's own sentence | `testConnection`, `providerSentence`, `hintFor` | ✓ VERIFIED — tests + UAT test 3 (`401 API key is invalid.` in rust on one line with the refused hint beneath; `Logged in · 282 ms` on Claude Code) |
| Learner always knows which model is teaching | lesson header pill + plugin start message | `Lesson.tsx:116-125` pill from `state.tutor`; `mcp.ts:229-246` | ✓ VERIFIED — `mcp.test.ts` + UAT test 4 (pill read `claude code · default model`, kept the old value after a Settings change, flipped live on the next turn) |
| The choice survives a restart | same provider active after restart | `settings` table (migration 5), `resolveTutor()` per call | ✓ VERIFIED — `keeps the choice across a restart` (real kill + respawn) + UAT test 1 (Codex still gold after a real restart, `/api/health` `codex/settings`) |

## Goal Achievement

### Observable Truths — ROADMAP success criteria (the contract)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC1 | Learner opens Settings, picks a provider and a model, restarts Derive, and the same choice is active | ✓ VERIFIED | `settings.test.ts` `keeps the choice across a restart` kills the spawned server and respawns it on the same data dir, then asserts `GET /api/settings/active` is still `{ provider: 'codex', model: 'gpt-5.4', source: 'settings', modelSource: 'settings' }` — a real restart, not a source assertion. Stored in the `settings` table of migration 5 (`migrations.ts:243`, `db.ts:179-181,470-481`), read live per call by `resolveTutor()` (`settings.ts:170-173`). **Now also driven end to end:** UAT test 1 pressed `Use this provider` on Codex, killed and restarted the server, and found Codex still gold with `from settings` and the typed model id intact. |
| SC2 | Learner pastes a key once; it is masked afterwards, lives in a 0600 secrets file outside `derive.db`, and no API response ever returns it (write-only field answering `{ set, hint }`) | ✓ VERIFIED | `stores a key and answers { set, hint } only, never the value`; `writes the file 0600 as { providerId: key }` (`statSync(...).mode & 0o777 === 0o600`, file exactly `{ openai: GOOD }`); `gives a short key an empty hint`; `never echoes the good key or the wrong one in any response` sweeps 20+ bodies. **Now also driven:** UAT test 2 confirmed the masked hint, the absence of the typed value from the DOM and from `GET /api/settings`, and the absence of any reveal control. |
| SC3 | Settings show what is already available without typing: logged-in Claude Code and Codex CLIs, keys in the environment labelled "set from environment", and local servers found on their default ports | ✓ VERIFIED | `finds the Codex login and the three local servers at their stored bases in one pass` (real `auth.json` in a scratch `CODEX_HOME`); `leaves Codex detected when only Codex is logged in…`; `falls back to Claude Code when nothing is logged in…`; `spawns the CLI exactly once per detect pass, and not for the reads that follow` (counting `claude` shim); `reads set from environment with the variable named…`. **Now also driven:** UAT tests 1 and 2. |
| SC4 | Learner fetches a provider's model list, or types a model id when the fetch fails, with a curated default preselected | ✓ VERIFIED | `fetches the models of an OpenAI-compatible endpoint with the stored key, de-duplicated and in the provider order`; `lists Ollama tags verbatim, LM Studio loaded models first…`; `normalises each provider list to ids in its order…`; a failed fetch is a 502 carrying the provider's sentence. Curated defaults in `providers.ts:99,113,128,142` with `DEFAULTS_AS_OF = '2026-09-30'`. **Now also driven:** UAT test 3 (`3 models fetched`, the datalist, and a typeable field after a failure — `OpenAI with no key showed 401 … and the field stayed typeable, a typed id saved`). |
| SC5 | "Test connection" reports success or the provider's actual failure sentence; the active provider and model are shown in the lesson header and in the plugin start message | ✓ VERIFIED | `reports Connected with the model count and a latency`; `quotes the provider 401 verbatim on one line, with the fix hint beside it`; `refuses to follow a redirect…`; `says when the answer was not JSON…`; `names the address in its own sentence when nothing answered`. Header and plugin message: `mcp.test.ts` 3/3 on the built stdio server. **Now also driven:** UAT test 3 (the rust one-line sentence, the hint beneath, `Logged in · 282 ms`) and UAT test 4 (the pill present, correct and flipping only on the next turn) — the one piece the previous report could not close. |

**Roadmap score:** 5/5 success criteria verified, and all five now carry browser-observed evidence in
addition to the hermetic suite.

### Observable Truths — PLAN must_haves (detail; restatements of a roadmap SC are deduplicated into the row above)

Rows whose status changed since the previous report are marked **(was ⚠️)**. Rows 1-16, 19-27,
29-38, 40-49 are unchanged ✓ VERIFIED and carry the previous report's evidence verbatim; the whole-tree
gate was re-run at HEAD (280/280) and none regressed.

| # | Truth (plan) | Status | Evidence |
|---|--------------|--------|----------|
| 1 | A stored model is what the next turn of every lesson runs on, with no restart (02-01) | ✓ VERIFIED | `runs the very next turn on a choice made in settings, with no restart`: `lastTurn(id).model === 'gpt-5.4'`, `turn_start` payload `{ provider: 'codex', model: 'gpt-5.4' }`; `reflects a stored change at once, because nothing is memoised` |
| 2 | A provider change clears `session_id` before the next turn; a model change on the same provider keeps it (02-01) | ✓ VERIFIED | `clears the session when the driver changes…`; `keeps the session when only the model changes on the same driver`; `agent.ts:281-282` |
| 3 | Ten providers in a fixed order, `teaches` true only on the two logins; `POST /api/settings/active` on a `teaches:false` row refused with the sentence (02-01) | ✓ VERIFIED | `lists ten providers in a fixed order, and only the two logins teach`; `refuses a row whose driver has not arrived, and an id it does not know` (400/404); `providers.ts` has exactly ten entries |
| 4 | `DERIVE_BACKEND` locks the provider and `DERIVE_MODEL` the model; write routes answer 409 naming the variable (02-01) | ✓ VERIFIED | `answers 409 naming DERIVE_BACKEND…`, `answers 409 naming DERIVE_MODEL…`, `reports both as coming from the environment`; `lockedBy` at `settings.ts:206-212` |
| 5 | `resolveTutor()` computed per call; detectors re-run only when the memo is older than 30 s; `backend.ts` holds no process-lifetime memo (02-01) | ✓ VERIFIED | `keeps an observation for DETECT_MS and reports it regardless of age`, `reports a stale pass where a turn would look again`; `grep 'let resolved' server/src/backend.ts` empty |
| 6 | `GET /api/settings` and `/api/health` never spawn: they read `currentTutor()` (02-01) | ✓ VERIFIED | `runs the detectors once at boot and not again for six read-only requests` (marker-file shim); `answers read-only callers from the last pass and observes nothing itself`. Also observed in UAT test 1: zero `/api` requests over 6 s idle |
| 7 | `GET /api/settings` paints every row in catalogue order with its stored model, exactly one active row, `checking` on unobserved rows (02-01) | ✓ VERIFIED | `paints every row from stored config, in catalogue order, with one active row`; `reads checking on the local rows until a pass has looked`; UAT test 1 saw the pulsing `checking` pills before the pass settled |
| 8 | Detection tier: Claude when both logins, Codex when only Codex, Claude when neither (02-01) | ✓ VERIFIED | `detects in the order the old memo used: Claude, then Codex, then Claude`; `settings.ts:134-138` |
| 9 | `GET /api/lessons/:id` carries `tutor { provider, model }` from the last turn and `turn_start` carries `{ provider, model }` (02-01) | ✓ VERIFIED | `turn_start` payload deep-equal; `lessonView` at `index.ts:282` builds `tutor` from `lastTurn(id)`. The previous report left the HTTP read of `lessonView.tutor` unexercised; UAT test 4 observed the first paint of the pill from that field on an existing lesson |
| 10 | Detection runs on page open and Rescan via `POST /api/settings/detect`, logins plus shape-checked probes of 11434/1234/8080 in one parallel pass; stored config paints at once (02-06) | ✓ VERIFIED | `finds the Codex login and the three local servers at their stored bases in one pass`; `probe.ts detect()` is one `Promise.all` ending in `rememberDetection`; `Settings.tsx` calls `api.settings()` then `api.detectProviders()` on mount and on `rescan` only; UAT test 1 timed first paint at 122 ms against a 378 ms pass |
| 11 | A port answering something other than the expected JSON shape reads `not configured` (02-06) | ✓ VERIFIED | `reads an HTML 200 on the llama.cpp base as not configured, never as found`; `checks the shape each local server answers with, and nothing else about the body` |
| 12 | Both logins → Claude Code detected; only Codex → Codex, proven over HTTP with a real `auth.json` (02-06) | ✓ VERIFIED | `leaves Codex detected when only Codex is logged in and nothing is stored`; `falls back to Claude Code when nothing is logged in…` |
| 13 | Nothing detected → every login and local row `not configured`; teaching-now line `claude code · default model` with the `detected` pill (02-06) | ✓ VERIFIED | `falls back to Claude Code when nothing is logged in, with every login and local row not configured`; `Settings.tsx` renders `{activeLabel} · {active.model ?? 'default model'}` with the `detected` pill; UAT test 1 read `codex · default model · from settings` after the flip |
| 14 | Base URL stored through PUT: http/https only, no credentials, no query/fragment, origin plus path without trailing slash; fixed-endpoint rows refuse it; empty means default; the pass probes the stored base (02-06) | ✓ VERIFIED | Five dedicated refusal/normalisation cases, each with its own sentence; the detect cases point every local row at its fake through the stored base |
| 15 | A model typed into a row saves on blur or Enter with a saved tick and is what `GET /api/settings` reports (02-06) | ✓ VERIFIED | `stores a model on a provider row`; `answers a settings write with the row as the page paints it`; `ProviderRow.tsx save` on `onBlur` with `blurOnEnter`. UAT test 1 observed the tick for ~1.8 s; UAT test 2 confirmed Enter also saves |
| 16 | Rows render in catalogue order and keep their position; the active row is marked, never moved (02-06) | ✓ VERIFIED | `paints every row… in catalogue order`; `Settings.tsx:139-141` filters `settings.rows` by group and never sorts; UAT test 1 saw ten rows in catalogue order with the active one marked in place |
| 17 | The page is one row per provider in three eyebrow groups with one gold row, a filled Use this provider on non-active teaching rows, `teaching now` on the active row, nothing on unwired rows; the click is optimistic and a refusal renders verbatim and reverts the row (02-06) | ✓ VERIFIED **(was ⚠️ PRESENT_BEHAVIOR_UNVERIFIED)** | Code unchanged and present (`GROUPS`, gold variant, `row.teaches ? <button …> : null`, `onUse` optimistic `setSettings` then `setSettings(prev)` on catch, `useErr` in rust). The transition is now **observed**: UAT test 1 — "Use this provider on Codex flipped the gold row **before the PUT settled** and showed `saved · applies from the next turn of every lesson`" (22/22 checks). The optimistic flip is the half a browser can show; the revert path's server half is the tested 400/409 refusal |
| 18 | The teaching-now line paints at once with the source pill `checking` until detection answers; on a GET failure the rust sentence renders with rescan as the retry (02-06) | ✓ VERIFIED **(was ⚠️)** | Present (`scanning ? 'checking' : 'detected'`, `err` rendered where the line would be, `rescan = () => void (settings ? scan() : load())`). Now observed: UAT test 1 — rows painted at 122 ms with login/local pills pulsing `checking`, the pass settled at 378 ms, then `detected` / `from settings`; `rescan` read `scanning…` with rows back to `checking` |
| 19 | Every in-flight button reads its progressive form and is disabled; `checking` is the only loading indicator, a pulsing dot, never a spinner or skeleton (02-06) | ✓ VERIFIED | `scanning…`, `fetching…`, `testing…` with `disabled`; `dotOf('checking')` → `animate-pulse motion-reduce:animate-none`; no spinner/skeleton in either file; UAT tests 1 and 3 saw each progressive form |
| 20 | Keys live in `~/.derive/secrets.json` keyed by provider id, 0600, sibling temp + rename, one-second cache, every loaded value registered (02-02) | ✓ VERIFIED | `keys.ts persist()` writes `${SECRETS_PATH}.${pid}.tmp` at `mode: 0o600` then `renameSync`; `KEY_CACHE_MS = 1_000`; `registers every key it loads from a file written by hand` |
| 21 | An interrupted write leaves the previous or the complete new file; a concurrent write does a full read-modify-write and the last rename wins (02-02) | ✓ VERIFIED | Structural: `setKey`/`removeKey` call `fresh()` before `persist()`, and `persist()` is write-tmp-then-`renameSync`, whose atomicity is the filesystem's guarantee. A crash-mid-write test is not meaningfully automatable or human-verifiable; recorded as code-structural evidence |
| 22 | An environment key locks the row: `set from environment`, variable named, PUT and DELETE 409 (02-02) | ✓ VERIFIED | `reads set from environment with the variable named, Google before Gemini, and OLLAMA_HOST on the Ollama row`; `answers 409 naming the variable on a key write and on a key removal`; UAT test 2 drove the `OPENAI_API_KEY` case on a second instance |
| 23 | With the same provider in the environment and the file, the environment one is used and shown; the file value is neither returned nor deleted (02-02) | ✓ VERIFIED | `effectiveKey = envKeyFor(id)?.value ?? keyOf(id)`; `keyOfRow` returns `{ set: true, hint: null, locked: VAR }`; `never echoes an environment value and never copies one into the file` |
| 24 | Remove deletes the key from `secrets.json`; the value stays registered until restart and the UI says so (02-02) | ✓ VERIFIED | `removes a key, says the process still hides it, and removes the file with the last key`; UAT test 2 saw the removed sentence for 4.7 s and `{set:false}` from the API |
| 25 | A key under 8 characters gets an empty hint; a key under 16 is stored but not redacted, by the Phase 1 floor (02-02) | ✓ VERIFIED | `gives a short key an empty hint…`; `hints with the last four characters of a key at least eight long, and nothing of a shorter one` |
| 26 | An unreadable secrets.json is loud, never overwritten: `secrets_error` on GET, the keys group shows the line, a key PUT is refused (02-02) | ✓ VERIFIED | `is loud on the settings view, refuses a key, and leaves the file exactly as it was`; `Settings.tsx` renders the line above the keys group with `nothing here was overwritten` |
| 27 | `OLLAMA_HOST` locks the Ollama base URL, is where the row is probed, reads `set from environment` (02-02) | ✓ VERIFIED | `answers 409 on the Ollama address while OLLAMA_HOST is set`; `localBase` returns `ollamaHostBase(OLLAMA_HOST)` first and `probeLocal` reads `localBase` |
| 28 | The key field states render as specified: unset placeholder, saving line, masked hint with replace and remove, replace with keep the current key and Escape, inline two-step remove with no modal, the five-second removed sentence, the env-lock sentence, the save-failed sentence with the typed value kept (02-02) | ✓ VERIFIED **(was ⚠️)** | Every state's copy present in `KeyField`, no `confirm(`. Now observed state by state: UAT test 2, 30/30 checks — password input with the contract placeholder → `•••• •••• 5678` + `replace · remove` + gold tick → inline `remove the key · keep` (no dialog) → Escape returns → `replace` shows the empty `Paste the new key` with `keep the current key` → Escape keeps the stored key → `remove the key` shows the removed sentence for 4.7 s. 02-07 gave each of these buttons a 32px hit area without changing any copy |
| 29 | Local rows and the OpenAI-compatible row show a full-width base URL input; empty means default, a bad scheme is refused with the server's sentence, a base URL without a key is valid (02-02) | ✓ VERIFIED | `BaseUrlField` rendered when `row.auth === 'key+url' \|\| row.port !== null`; server refusals tested; `asks for the base URL first when the OpenAI-compatible row has none`; UAT test 2 saw the Ollama placeholder `http://127.0.0.1:11434` |
| 30 | The model field is one combobox: fetched list plus free typing, always; on failure the list is empty, the sentence shows under the field, typing still saves; no second control (02-03) | ✓ VERIFIED | `grep -c '<select' ProviderRow.tsx` → 0; `<input list="models-{id}">` + `<datalist>`; `fetchModels` catch → `setModels([])`, `setFetchErr(sentence)`; UAT test 3 confirmed the field stays typeable after a 401 and a typed id saved |
| 31 | `listModels` de-duplicates keeping provider order, LM Studio loaded first; zero models reads `0 models fetched · type an id` (02-03) | ✓ VERIFIED | `normalises each provider list to ids in its order, de-duplicated…`; `lists Ollama tags verbatim, LM Studio loaded models first…`; `fetchedText(0)` |
| 32 | Every provider call carries the key only in a header, only to the row's catalogue host or the learner's own base URL; redirects not followed and reported (02-03) | ✓ VERIFIED | `sends the key in the header each provider reads, and never in the URL`; `requestFor` builds the URL from `spec.endpoint`/`base` only; `getJson` uses `redirect: 'manual'`; `refuses to follow a redirect that could carry the key` |
| 33 | A provider echoing the key in its error body cannot leak it: every failure sentence passes `safeMessage`; the suite asserts neither key appears (02-03) | ✓ VERIFIED | `testConnection` catch → `safeMessage(e)`; the models route answers `err(c, e, 502)` which redacts; the 20+-body echo sweep. UAT test 3 independently saw `401 Missing bearer [redacted] in header` |
| 34 | An unreachable endpoint gets Derive's own sentence, never quoted as the provider's (02-03) | ✓ VERIFIED | `names the address in its own sentence when nothing answered`; `tells a local address from a remote one by the literal host alone` |
| 35 | A connection test never blocks or alters a running turn; times out at 8 s remote / 4 s local; a second test replaces the previous line (02-03) | ✓ VERIFIED | `REMOTE_MS = 8_000`, `LOCAL_MS = 4_000`, `timeoutFor` by `isLocalUrl`; `probe.ts` imports nothing from `agent.ts`/`prompts.ts`; `ProviderRow.test()` sets `setResult(null)` before the request |
| 36 | While a fetch or test runs the button reads `fetching…`/`testing…`, disabled, previous result cleared; results on one mono line with `role=status`, `truncate`, full text in `title`; sentences collapsed and cut at 300 server-side (02-03) | ✓ VERIFIED | All present at `ProviderRow.tsx:484-494`; `unwraps every error envelope into status plus the sentence, on one line, cut at 300`. UAT test 3 measured one truncated mono line with the full text in `title`. (The two buttons now also carry 02-07's `h-8`.) |
| 37 | A key without a base URL on the OpenAI-compatible row yields `Add the endpoint's base URL first` when tested (02-03) | ✓ VERIFIED | `asks for the base URL first when the OpenAI-compatible row has none`; `refuses a list for a login row and for the OpenAI-compatible row without a base URL` |
| 38 | The lesson header shows a small muted `provider · model` pill beside the title inside the 60 px header, linking to /settings; nothing else on the lesson screen changes (02-04) | ✓ VERIFIED | `Lesson.tsx:116-125`: `<Link to="/settings" className="hidden md:inline-flex … h-6 …">` directly after the `<h1>` inside the `h-[60px]` header. UAT test 4 observed it in place, as a Link with the explanatory title, hidden at 375 px. The phase diff of `Lesson.tsx` is +15/-2 — the pill, the companion suffix, and 02-07's `28ch`→`40ch` (a rewrite of an already-added line, so the net count is unchanged); nothing else |
| 39 | The pill reads the turn, not the setting: first paint from `GET /api/lessons/:id` tutor, live from `turn_start`; a Settings change shows on the next turn, never before (02-04) | ✓ VERIFIED **(was ⚠️)** | `useLesson.ts:235` `st.tutor = a.tutor` on init; `:81` replaces only when `typeof ev.payload?.provider === 'string'`; `EVENT_TYPES` untouched. The ordering invariant is now **observed**: UAT test 4 — "after switching the install to Codex the pill **kept the old value**; the next message started a turn on Codex and the pill flipped **live** (no reload); switching back and sending another message flipped it to `claude code · claude-opus-5-5`; turn_start sequence claude-code → codex → claude-code". See advisory: no automated regression guard exists for this reducer rule |
| 40 | Before any turn the pill is absent; a turn with model null reads `claude code · default model` (02-04) | ✓ VERIFIED | `{!external && state.tutor && (…)}`; `tutorLabel = provider.replace(/-/g, ' ') · (model ?? 'default model')`; `lessonView.tutor` is null before any turn; UAT test 4 read `claude code · default model` |
| 41 | A terminal-driven lesson's companion pill reads `companion · claude code · terminal model` / `companion · codex cli · terminal model`, stays a span, no link (02-04) | ✓ VERIFIED | `Lesson.tsx:31` `driver = … 'codex cli' : 'claude code'`; `:127-142` is a `<span>` with that text and no `to=`; UAT test 4 drove a real external lesson and confirmed the span, not a link, hidden at 375 px |
| 42 | The plugin start message names the driver running the lesson and adds Derive's own tutor setting, omitted only when the server cannot be asked (02-04) | ✓ VERIFIED | `mcp.ts:229` `api(…'/api/settings/active?learner=…').catch(() => null)`; `:245-246` both fields with the spread-conditional; `mcp.test.ts` 3/3 on the built stdio server; UAT test 5 read the real message naming the learner's own id |
| 43 | /settings is linked from the Home nav (`settings` after `how you learn`) and the learner menu (`Settings` with the sub-line) (02-04) | ✓ VERIFIED | `Home.tsx:105-106`; `LearnerMenu.tsx:183-187` with `which model teaches · for everyone on this install`; both read in UAT test 4 |
| 44 | `pnpm check` reports the secrets file's presence and mode and the active tutor, never a key or hint; `.env.example` documents every provider variable and the precedence rule (02-04) | ✓ VERIFIED | `node scripts/doctor.mjs` re-run here at HEAD: `✓ Secrets file   none yet; add keys in Settings`, exit 0; `doctor.mjs:86-94` never opens the file; `:106` appends the tutor suffix from `/api/health`; `grep hint scripts/doctor.mjs` empty. `.env.example` carries the precedence paragraph and every provider variable, Google before Gemini |
| 45 | A learner sets one optional model id on /you overriding the install-wide model for that learner alone, on the active provider only; empty means install default; keys never appear on /you (02-05) | ✓ VERIFIED | `resolves a learner-owned model for that learner alone, by query and by header…`; `bounds the learner model id like the install one, and clears it with an empty string`; `You.tsx:45` reads `api.activeTutor()` and `api.profile()` only; no settings row reaches the page. UAT test 5 drove it end to end (`modelSource: 'learner'` for that learner while the install-wide read stayed on the install model). **See advisory WR-01** on the `on the active provider only` clause — raised, not blocking, under the re-verification evidence gate |
| 46 | The override sits between the environment and the settings table (env > learner > settings > default), reported as `modelSource 'learner'`; the next turn of that learner runs on it; other learners unaffected (02-05) | ✓ VERIFIED | `chooseModel` at `settings.ts:158-166`; `outranks a learner-owned model while DERIVE_MODEL is set`; `runs a learner-owned model on that learner's next turn and keeps it out of the prompt`; `agent.ts:276` `resolveTutor(lesson.learner_id)` |
| 47 | The per-learner model id never reaches the tutor: `preferencesSection` does not render it, `learnerProfile()` lacks it, `describePrefs` ignores it (02-05) | ✓ VERIFIED | `preferencesSection` (`db.ts:320-343`) has no `model` line; the in-process case asserts the `learnerProfile` text contains the learner's `examples` but not the model id; `web/src/lib/prefs.ts` has no phase commit. The adjacent `preferences`-event/vault path is carried forward as an advisory, outside the three surfaces the prohibition names |
| 48 | `GET /api/settings/active` honours `?learner=` and `x-derive-learner` (02-05) | ✓ VERIFIED | `index.ts:442` `resolveTutor(learnerOf(c))`; the HTTP case asserts both the query and the header |
| 49 | The /you field inherits Save and ⌘↵; its placeholder names the install default and falls back to `install default` while pending or failed (02-05) | ✓ VERIFIED | `You.tsx:135-143`: Section `n="07"` `title="Model"`, `aria-label="Your model"`, `placeholder={installModel ? \`install default: ${installModel}\` : 'install default'}`; the field is part of `draft` saved by the page's existing Save. UAT test 5 read `install default: claude-opus-5-5` and `saved · applies from the next message`. **See advisory WR-05(b)** for the narrow clear-without-reload path |
| B1 | A 60-character local model id does not break the 40 px combobox: the value scrolls inside the input and the pill of plan 04 truncates with the full value in title (02-03, backstop) | ✓ VERIFIED **(was ⚠️ insufficient_spec)** | Resolved by the explicit evidence a `backstop` truth requires: UAT test 3 drove a 59-character id into the provider-row model input — "scrolled inside the 40 px input without growing the row and saved with the tick"; the pill half is B3 |
| B2 | A multi-line 4xx body from a provider renders as one line under the row: whitespace is collapsed before the 300-character cut (02-03, backstop) | ✓ VERIFIED **(was ⚠️)** | Server half already proven (`quotes the provider 401 verbatim on one line` asserts the fake's two-line body reads as one). Render half now observed: UAT test 3 — the 401 sentence rendered "in rust on one truncated mono line (full text in title)", and at 360 px "the sentence stayed one line and the hint wrapped to three" with nothing overflowing |
| B3 | Model ids and provider names are rendered verbatim in the pill and truncated only by CSS; no server-side length or equality rule applies to them (02-04, backstop) | ✓ VERIFIED **(was ⚠️)** | UAT test 4 confirmed CSS-only truncation with the full label in the span `title`. 02-07 then widened the cap and the re-verification **measured** it: the 29-char label `claude code · claude-opus-5-5` needs 221 px in the pill's own type (10 px mono, 0.16 em tracking, uppercase) and `max-w-[40ch]` gives 241 px, so it renders uncut; `max-w-[28ch]` is gone from `Lesson.tsx` (the only remaining `28ch` in `web/src` is `Graph.tsx:142`, an unrelated empty-state paragraph) |
| B4 / G4 | A ~60-character model id in /you Section 07 does not break the mono input (02-05 backstop B4, restated as 02-07 truth G4 "fits the input without scrolling") | ⚖️ **PASSED (override)** | **Not met as written, and not recorded as met.** 02-07 removed `max-w-[320px]`; `You.tsx:141` is now `${field} font-mono h-10` and `field` is `w-full`, so the input fills its column — re-measured at **464 px**, while a 59-character JetBrains Mono 14 px id needs **520 px**. Short by 58 px: the /you form is `max-w-[760px] px-8` with `md:grid-cols-[200px_minmax(0,1fr)]` and `gap-x-8`, so 200 + 32 + 464 = 696 px is the entire content width. The id therefore **scrolls inside a 40 px row without breaking it** — the same behaviour `/settings` has and which UAT test 3 accepted. Owner decision 2026-10-01: amend the expectation rather than re-rhythm the approved layout. Override recorded in frontmatter; counted toward the score as an accepted deviation, not as a satisfied must-have |
| G1 | On a 375 px viewport the Settings and /you page titles stay on one line inside the 60 px header, truncating with an ellipsis exactly as the lesson header already does (02-07, UI-REVIEW fix 1) | ✓ VERIFIED (new) | `Settings.tsx:102` and `You.tsx:84` both carry `truncate min-w-0`, and each `<h1>` is a direct child of a `flex items-center … h-[60px]` header, which is what makes `min-w-0` load-bearing. **Measured in the browser** at 375 px on both pages: one line (33 px against a 33 px line box), header still exactly 60 px, `text-overflow: ellipsis` + `white-space: nowrap` + `min-width: 0` all computed, the title genuinely clipped so the ellipsis shows, and no horizontal page scroll |
| G2 | Every text button in a provider row has a 32 px hit area, matching the contract's one exception under 44 px that `rescan` already honours (02-07, UI-REVIEW fix 2) | ✓ VERIFIED (new) | `ProviderRow.tsx:7` — `const textButton = 'inline-flex items-center h-8 font-mono text-[10px] …'`; all eight call sites (`:156,160,166,170,207,484,490`) compose the constant, including the formerly hand-rolled destructive confirm. **Measured:** `fetch models`, `test connection`, `replace`, `remove`, `remove the key` and `keep` each exactly 32 px tall with `display: flex`; at 375 px no row broke and the header stayed 60 px |
| G3 | The destructive `remove the key` button has visible hover feedback from a colour token that exists in index.css; no new colour token is added (02-07, UI-REVIEW fix 3) | ✓ VERIFIED (new) — static evidence only, see advisory | `ProviderRow.tsx:156` is `className={`${textButton} text-rust-400 hover:text-rust-500`}`. Deterministic evidence in the artefact actually served: the built CSS carries `.hover\:text-rust-500:hover{color:var(--color-rust-500)}` with `--color-rust-500:#c9785a`, `rust-300` appears **zero** times anywhere in `web/src`, `server/src` or the bundle, and `web/src/index.css` `@theme` declares only `rust-500` and `rust-400` — unchanged, so no new token. The rule's specificity (class + `:hover`) and source order both beat `.text-rust-400`. **What was not observed:** the rendered colour change. Tailwind v4 nests every `hover:` utility inside `@media (hover:hover)` (confirmed in the built CSS) and headless Chrome 148 reports that false in both headless modes, so no hover in the app is observable in this harness. Recorded as an advisory, not rounded into a behavioural claim |
| G5 | A 29-character tutor label such as `claude code · claude-opus-5-5` renders in the lesson header pill without the model id being cut (02-07, UAT test 4 gap 2) | ✓ VERIFIED (new) | Same measurement as B3: 221 px needed, 241 px given by `max-w-[40ch]`, `truncate` and the full value in `title` both kept |
| G6 | When Codex refuses a model on a ChatGPT login, Derive's hint names the Codex row in Settings — not `DERIVE_MODEL` or `~/.codex/config.toml`, the mechanism Phase 2 replaced (02-07, UAT test 4 gap 3) | ✓ VERIFIED (new) | `server/src/codex.ts:166` `friendly()` appends `' Set the model on the Codex row in Settings (which model teaches), or leave it empty to use the Codex default.'`; the triggering regex, the login hint below it and the `Codex Exec exited with code N` strip are byte-unchanged. `grep DERIVE_MODEL server/src/codex.ts` is empty and the only `config.toml` left in the file is the unrelated MCP-override comment at `:63`. No test asserted the old sentence (the `DERIVE_MODEL` hits in `settings.test.ts` are the settings-route env-lock 409, a different sentence owned by `index.ts`), and `pnpm test` is 280/280 at HEAD |

**Score:** 63/63 truths verified — 62 ✓ VERIFIED + 1 PASSED (override). 0 behavior-unverified, 0
insufficient_spec. Five restated roadmap criteria (02-01 #1, 02-06 #6, 02-02 #1, 02-03 #1, 02-03 #4)
are counted once, in the roadmap table; 02-07's G4 is deduplicated into 02-05's B4, the same
concern in different words.

Previous score was 50/58. The 5 new must-haves from 02-07 (G1, G2, G3, G5, G6) raise the
denominator to 63 after the G4/B4 merge; the 8 previously unresolved items all close:

| Previously | Now | Why |
|-----------|-----|-----|
| 17, 18 ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | ✓ VERIFIED | UAT test 1 observed the optimistic flip before the PUT settled, and the `checking` → `detected` paint sequence with timings |
| 28 ⚠️ | ✓ VERIFIED | UAT test 2 drove all six key-field states, 30/30 checks, no dialog |
| 39 ⚠️ | ✓ VERIFIED | UAT test 4 observed the pill holding the old value across a Settings change and flipping live only on the next turn |
| B1, B2, B3 ⚠️ insufficient_spec | ✓ VERIFIED | The explicit observed evidence a `backstop` truth requires, from UAT tests 3 and 4 |
| B4 ⚠️ insufficient_spec | ⚖️ PASSED (override) | Measured as not met (464 px column vs 520 px need); expectation amended by owner decision |

### Prohibitions (must-NOT)

| Plan | Statement (abridged) | Tier | Disposition | Evidence |
|------|----------------------|------|-------------|----------|
| 02-01 | Never forward `claude auth status` identity; no `email` key in settings/health bodies | test | ✓ VERIFIED | `never carries the identity claude auth status prints`; `claudeLoggedIn`/`claudeLoggedInAsync` parse only `loggedIn` |
| 02-01 | Nothing detects in the background; read-only routes never spawn | test | ✓ VERIFIED | Marker-shim case: one boot run, zero across six reads; UAT test 1 saw zero `/api` requests over 6 s idle |
| 02-01 | A non-teaching provider never becomes active by any route | test | ✓ VERIFIED | 400 refusal case; `ignores a stored provider that does not teach and falls to detection` |
| 02-01 | Lesson screen gains only the header pill | judgment | ✓ RESOLVED by the human checkpoint **(was flagged)** | UAT test 4 (pass); the phase diff of `Lesson.tsx` is +15/-2 — pill, companion suffix, and 02-07's cap widening inside an already-added line — and no other lesson-screen file changed |
| 02-06 | Detect body carries no identity | test | ✓ VERIFIED | `falls back to Claude Code…` asserts no `email` on the detect body |
| 02-06 | Nothing probes or polls in the background | test | ✓ VERIFIED | Spawn-count case; no `setInterval`/scheduled `detectProviders` in `Settings.tsx`; UAT test 1's quiet network tab |
| 02-06 | No Use this provider on `teaches:false` rows; API refuses them | test | ✓ VERIFIED | `row.teaches ? <button> : null`; 400 case; UAT test 1 saw the button on the other login row only |
| 02-06 | Browser hard-codes no provider facts; never re-sorts | judgment | ✓ RESOLVED by the human checkpoint **(was flagged)** | UAT test 1: ten rows in catalogue order in three API groups, every fact from the row; 02-07 changed only class strings in these two files |
| 02-02 | API never returns a key beyond the last four of ≥ 8 chars; no read-back route | test | ✓ VERIFIED | `{ set, hint }` cases; 20+-body echo sweep; UAT test 2 found the typed value in neither the DOM nor `GET /api/settings` |
| 02-02 | Key only to its own host or the stored base; never in a URL; never on a redirect | test | ✓ VERIFIED | `sends the key in the header…never in the URL`; redirect case |
| 02-02 | Env key never written to the file, never shown with a hint | test | ✓ VERIFIED | `never echoes an environment value and never copies one into the file`; `hint: null` on env rows |
| 02-03 | Provider sentence never rewritten; hint a separate field | test | ✓ VERIFIED | `quotes the provider 401 verbatim…`; `adds a hint only for the cases it recognises`; UAT test 3 saw sentence and hint as two lines |
| 02-03 | Models/test request only to the row's endpoint or stored base; never key in URL | test | ✓ VERIFIED | Pure `requestFor` cases; `requestFor` reads `spec.endpoint` only |
| 02-03 | Suite never calls a real provider host | test | ✓ VERIFIED | `grep` for the four catalogue hosts in `settings.test.ts` is empty; every network case is a loopback fake |
| 02-04 | Pill states what the last turn ran on, never the setting | test | ✓ RESOLVED by the human checkpoint **(was ⚠️ UNVERIFIED, fail-closed)** | UAT test 4 observed the exact invariant: old value held across a Settings change, flip only on the next turn, `turn_start` sequence claude-code → codex → claude-code. The fail-closed flag existed because no wired test exercises the reducer; the human review it recommended has now happened and passed. **Residual, recorded as advisory:** no automated regression guard (no web test runner in this repo); the server feed stays tested |
| 02-04 | Companion pill no link, says `terminal model` | judgment | ✓ RESOLVED by the human checkpoint **(was flagged)** | UAT test 4 drove a real external lesson: the span `companion · claude code · terminal model`, not a link |
| 02-05 | Per-learner model never in the system prompt, the preferences event summary, or the menu description | test | ✓ VERIFIED | `learnerProfile` text lacks the id; `describePrefs` untouched; `preferencesSection` has no line; UAT test 5 confirmed the menu sub-line still reads `tell the tutor, once, in your words`. See advisory for the adjacent vault-note path |

**17 of 17 verified; 0 flagged.** The four items the previous report flagged (1 test-tier
fail-closed, 3 judgment-tier non-authoritative) were routed to Human items 1 and 4; both items are
now `pass` in the settled UAT, so each flag is resolved by the human checkpoint rather than silently
absorbed. The one residual — the absence of an automated guard for the reducer invariant — is
recorded as an advisory and not as a resolved-by-assertion.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `server/src/providers.ts` | catalogue: `PROVIDERS`, `ProviderSpec`, `providerOf`, `providerOfDriver`, `labelOf`, `DEFAULTS_AS_OF` | ✓ VERIFIED | Ten entries in the fixed order; `teaches` on two; imported by settings, probe, index |
| `server/src/settings.ts` | `resolveTutor`, `currentTutor`, `backendOf`, `lockedBy`, detection observation, `localBase`, `portOf`, `normaliseBaseUrl`, `envKeyFor`, `effectiveKey` | ✓ VERIFIED | All exports present and used by `index.ts`, `agent.ts`, `probe.ts`; no `process.env` |
| `server/src/keys.ts` | `keyOf`, `hintOf`, `keyView`, `setKey`, `removeKey`, `secretsFileError`, `resetKeyCache` | ✓ VERIFIED | `renameSync` ×2, `mode: 0o600`; used by `index.ts` and `settings.ts` |
| `server/src/probe.ts` | `detect`, `probeJson`, shape checks, `claudeLoggedInAsync`, `requestFor`, `idsOf`, `providerSentence`, `hintFor`, `getJson`, `listModels`, `testConnection` | ✓ VERIFIED | `redirect: 'manual'` ×2; `safeMessage(` ×1; used by `index.ts`'s three routes |
| `server/src/config.ts` | `SECRETS_PATH`, `ENV_KEYS`, `OLLAMA_HOST` | ✓ VERIFIED | Present; the phase's only new environment reads |
| `server/src/migrations.ts` | migration 5 `settings` | ✓ VERIFIED | `version: 5, name: 'settings'` creating `settings(key, value, updated_at)` |
| `server/src/index.ts` | `// ---------- settings ----------`, seven routes, health from `currentTutor()`, `lessonView.tutor` | ✓ VERIFIED | `GET /api/settings`, `GET/POST /api/settings/active`, `PUT /api/settings/:provider`, `DELETE …/key`, `POST …/detect`, `POST …/models`, `POST …/test`; `err` union includes 502 |
| `server/src/agent.ts` | `runTurn` on `resolveTutor(lesson.learner_id)`, session clearing, `turn_start` payload | ✓ VERIFIED | `:15` imports `resolveTutor`; `:276` calls it with the learner id |
| `server/src/codex.ts` | model-refused hint pointing at Settings (02-07) | ✓ VERIFIED (newly covered) | `:166` names the Codex row in Settings; `friendly()`'s structure, regex and login hint unchanged; no `DERIVE_MODEL` left in the file. Added to `covered_files` this pass — it is a changed implementation file of the phase and was missing from the previous list |
| `server/src/db.ts` | `getSetting`/`setSetting`/`deleteSetting`, `clearSessionId`, `LearnerPrefs.model` + `cleanPrefs` rule | ✓ VERIFIED | Lines 61, 179-181, 275-278, 435, 470-481 |
| `server/test/settings.test.ts` | HTTP + module cases | ✓ VERIFIED | 1205 lines, 79 cases, 0 fail inside the 280-test run at HEAD |
| `web/src/pages/Settings.tsx` | `SettingsPage`; `<h1>` that truncates inside the header (02-07) | ✓ VERIFIED | Routed at `/settings`; no `Save</button>`/`type="submit"`; `:102` `<h1 … truncate min-w-0 …>` inside the `flex items-center … h-[60px]` header |
| `web/src/components/ProviderRow.tsx` | `ProviderRow`, key field, base URL, datalist, fetch/test; `textButton` with a 32 px hit area; live hover on the destructive confirm (02-07) | ✓ VERIFIED | `<datalist` ×1, `<select` ×0, `keep the current key` present; `:7` `inline-flex items-center h-8 …`; `:156` `${textButton} text-rust-400 hover:text-rust-500` |
| `web/src/pages/Lesson.tsx` | tutor pill Link at a width that shows the model id (02-07); companion `terminal model` | ✓ VERIFIED | `:116-125` the pill with `max-w-[40ch] truncate` and `title={tutorLabel}`; `:127-142` the companion span |
| `web/src/lib/useLesson.ts` | `LessonState.tutor` seeded on init, updated on `turn_start` | ✓ VERIFIED | `:81` guarded replace, `:235` init seed; no phase commit since the previous report |
| `web/src/pages/You.tsx` | Section 07 Model at column width (02-07); `<h1>` that truncates | ✓ VERIFIED | `:84` `truncate min-w-0`; `:135-143` Section 07 with `${field} font-mono h-10` and no `max-w` cap; `:106` (language) still capped at 320 px as the plan instructs |
| `web/src/pages/Home.tsx`, `web/src/components/LearnerMenu.tsx` | the two /settings entry points | ✓ VERIFIED | `Home.tsx:105-106`; `LearnerMenu.tsx:183-187` with the sub-line |
| `web/src/lib/api.ts`, `web/src/lib/types.ts` | eight settings keys; `ProviderView`, `TutorChoice`, `Settings`, `ProviderStatus`, `TestResult`, `LearnerPrefs.model`, `lesson.tutor` | ✓ VERIFIED | Unchanged since the previous report |
| `scripts/doctor.mjs`, `.env.example` | Secrets file line, tutor suffix; the variables and precedence | ✓ VERIFIED | `node scripts/doctor.mjs` re-run at HEAD, exit 0 |

`gsd_run query verify.artifacts` on `02-07-PLAN.md`: `all_passed: true, 5/5`.

### Key Link Verification

Re-checked at HEAD; 02-07 touched only class strings and one hint string, so no link moved.

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `agent.ts` | `settings.ts` | `resolveTutor(lesson.learner_id)` before `startTurn`; `turn_start { provider, model }` | ✓ WIRED | `agent.ts:15,276`; tested |
| `settings.ts` | `db.ts` | `getSetting('active_provider')`, `getSetting('model:<id>')`, `getLearner(learnerId)?.prefs.model` | ✓ WIRED | `settings.ts:150-166` |
| `index.ts` | `settings.ts` | `currentTutor()` in `settingsView`/health; `resolveTutor()` on active routes | ✓ WIRED | `index.ts:289,423,442,453` |
| `index.ts` | `db.ts` | `lessonView.tutor` from `lastTurn(id)` | ✓ WIRED | `index.ts:282`; first paint of the pill observed in UAT test 4 |
| `probe.ts` | `settings.ts` | `detect()` ends in `rememberDetection({ logins, local })`; `effectiveKey`, `localBase` | ✓ WIRED | `probe.ts:136,325,329` |
| `index.ts` | `probe.ts` | `await detect()`, `listModels`, `testConnection` | ✓ WIRED | `index.ts:518,527,537` |
| `keys.ts` | `secrets.ts` | `registerSecret` on load and before persist | ✓ WIRED | `keys.ts:76,116`; tested |
| `index.ts` | `keys.ts` | `setKey`, `removeKey`, `keyView` | ✓ WIRED | `index.ts:384,392,477,503` |
| `settings.ts` | `config.ts` | `ENV_KEYS` in `envKeyFor`; `lockedBy('key:<id>')` | ✓ WIRED | `settings.ts:29-34,194-200` |
| `probe.ts` | `providers.ts` | `requestFor`/`idsOf` from the spec | ✓ WIRED | `probe.ts:176-206,223-244` |
| `Settings.tsx` | `index.ts` | `api.settings()`, `api.detectProviders()`, `api.useProvider()` | ✓ WIRED | `Settings.tsx:46,58,82` |
| `ProviderRow.tsx` | `index.ts` | `api.setProvider` (model, key, base_url), `api.removeKey`, `api.providerModels`, `api.testProvider` | ✓ WIRED | `ProviderRow.tsx:96,112,245,346,370,387` |
| `useLesson.ts` | `index.ts` | init reads `d.tutor`; `turn_start` reads `payload.provider/model` | ✓ WIRED | `useLesson.ts:81,235` |
| `mcp.ts` | `index.ts` | `/api/settings/active?learner=` with null fallback | ✓ WIRED | `mcp.ts:229`; tested and read in UAT test 5 |
| `You.tsx` | `index.ts` | `api.setPrefs` with `model`; `api.activeTutor()` | ✓ WIRED | `You.tsx:45` and the page's existing Save |
| `codex.ts` | `Settings` (copy) | `friendly()`'s model-refused hint names the Codex row in Settings | ✓ WIRED (new) | `codex.ts:166`; the sentence and the page it names agree (`Settings · which model teaches`) |

### Data-Flow Trace (Level 4)

Unchanged from the previous pass — 02-07 added no data path — and each row is now additionally
confirmed by a browser run against a real scratch server.

| Artifact | Data variable | Source | Produces real data | Status |
|----------|---------------|--------|--------------------|--------|
| `/settings` rows | `settings.rows[*].model/base_url/key/status/active` | `settingsView()` ← `getSetting` (SQLite), `keyView` (`secrets.json`), `envKeyFor` (`ENV_KEYS`), `lastDetection()` | Yes — every field read live per request, no static fallback; UAT test 1 saw a fake Ollama read `found on port 11434` | ✓ FLOWING |
| Teaching-now line | `settings.active` | `currentTutor()` ← env / table / last pass | Yes; UAT test 1 read `codex · default model · from settings` after a real restart | ✓ FLOWING |
| Model datalist | `models` | `POST …/models` ← `listModels` ← provider host or stored base | Yes — empty before a fetch by design (D-08), filled by a real request; UAT test 3 got three real ids | ✓ FLOWING |
| Test result line | `result` | `POST …/test` ← `testConnection` ← real request | Yes; UAT test 3 got a real 401 and a real `Logged in · 282 ms` | ✓ FLOWING |
| Header pill | `state.tutor` | `lessonView.tutor` ← `lastTurn(id)`; `turn_start` payload ← `resolveTutor` | Yes; UAT test 4 watched it change across three real turns | ✓ FLOWING |
| Plugin start message | `app_tutor_setting` | `GET /api/settings/active?learner=` ← `resolveTutor(learner)` | Yes; UAT test 5 read the learner's own id in the real message | ✓ FLOWING |
| /you placeholder | `installModel` | `GET /api/settings/active` | Yes (see advisory WR-05(b) on the learner-header nuance) | ✓ FLOWING |
| Doctor Server line | `health.backend/model/source` | `/api/health` ← `currentTutor()` | Yes (only when a server is up; `not running` in this run) | ✓ FLOWING |

### Behavioral Spot-Checks

All run here, at HEAD (`531912f`). The whole-tree test command was run once.

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Both packages typecheck | `pnpm typecheck` | `server typecheck: Done` / `web typecheck: Done`, exit 0 | ✓ PASS |
| Whole-tree suite (run once) | `pnpm test` | `# tests 280 # suites 66 # pass 280 # fail 0 # skipped 0` | ✓ PASS |
| Web + server build | `pnpm build` | `✓ built in 2.14s` then `tsc -p tsconfig.json`, exit 0 | ✓ PASS |
| Doctor reports the secrets file | `node scripts/doctor.mjs` | `✓ Secrets file   none yet; add keys in Settings`, exit 0, `All good.` | ✓ PASS |
| 02-07 fix 1+2 landed | `grep -n '<h1' web/src/pages/Settings.tsx web/src/pages/You.tsx` | both carry `truncate min-w-0` | ✓ PASS |
| 02-07 fix 3 landed | `grep -n 'textButton' web/src/components/ProviderRow.tsx` | `:7` leads with `inline-flex items-center h-8`; 7 call sites compose it | ✓ PASS |
| 02-07 fix 4 landed; no dead token | `grep -rn 'rust-300' web/src server/src` | empty (zero occurrences) | ✓ PASS |
| 02-07 fix 4 compiles | `grep -o 'hover\\:text-rust-500:hover{[^}]*}' web/dist/assets/*.css` | `hover\:text-rust-500:hover{color:var(--color-rust-500)}` | ✓ PASS |
| …and its token resolves | `grep -o -- '--color-rust-500:[^;]*' web/dist/assets/*.css` | `--color-rust-500:#c9785a` | ✓ PASS |
| Hover observability (harness limit) | built CSS nests the rule in `@media (hover:hover)`; headless Chrome reports `(hover:hover) === false` | rule present; rendered colour change not observable | ? SKIP → advisory |
| 02-07 fix 5 landed | `sed -n '135,143p' web/src/pages/You.tsx` | Section 07 input is `${field} font-mono h-10`, no `max-w`; `:106` still `max-w-[320px]` | ✓ PASS |
| 02-07 fix 6 landed | `grep -n 'max-w-\[40ch\]' web/src/pages/Lesson.tsx`; `grep -rn 28ch web/src` | pill is `max-w-[40ch] truncate`; only `28ch` left is `Graph.tsx:142` | ✓ PASS |
| 02-07 fix 7 landed | `sed -n '163,168p' server/src/codex.ts`; `grep -n DERIVE_MODEL server/src/codex.ts` | hint names the Codex row in Settings; zero `DERIVE_MODEL` | ✓ PASS |
| 02-07 diff is seven one-liners | `git show --stat 95f8dcc` | 5 files, 7 insertions, 7 deletions | ✓ PASS |
| Documented commits exist | `verify.commits 5f24bc6 95f8dcc ae03161 201411d 531912f` | `all_valid: true` | ✓ PASS |
| 02-07 artifacts pass | `verify.artifacts 02-07-PLAN.md` | `all_passed: true, 5/5` | ✓ PASS |
| Working tree clean for phase source | `git status --porcelain -- server web scripts .env.example plugin codex` | empty | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` exists in this repository and no PLAN or SUMMARY names one.
Step 7c: not applicable.

### Requirements Coverage

Every requirement ID declared across the seven plans' `requirements:` fields was cross-referenced
against `.planning/REQUIREMENTS.md`. Declared: 02-01 `[SET-01, SET-03]`, 02-02 `[SET-02, SET-03]`,
02-03 `[SET-04, SET-05]`, 02-04 `[SET-06, SET-02, SET-03]`, 02-05 `[SET-01]`,
02-06 `[SET-03, SET-01]`, 02-07 `[SET-01, SET-03]` — the union is exactly SET-01..06.

| Requirement | Source plans | Description | Status | Evidence |
|-------------|--------------|-------------|--------|----------|
| SET-01 | 02-01, 02-05, 02-06, 02-07 | Choose provider and model on a settings page; the choice persists across restarts | ✓ SATISFIED | SC1 (real-restart test) + UAT test 1 (real restart in the browser); truths 1-9, 15-17, 45-49; 02-07's G1/G2/G5 and the overridden G4 |
| SET-02 | 02-02, 02-04 | One masked key per provider in a 0600 secrets file outside the database, never echoed by the API | ✓ SATISFIED | SC2; truths 20-28, 44; UAT test 2 (30/30) |
| SET-03 | 02-01, 02-02, 02-04, 02-06, 02-07 | Detect logged-in CLIs, environment keys ("set from environment"), local servers on default ports | ✓ SATISFIED | SC3; truths 6-8, 10-14, 18, 22-23, 27; UAT tests 1-2; 02-07's G3/G6 on the same surface |
| SET-04 | 02-03 | Fetch a provider's model list, manual id fallback, curated default | ✓ SATISFIED | SC4; truths 30-31, 37, B1; UAT test 3 |
| SET-05 | 02-03 | Test a connection and see the actual failure sentence | ✓ SATISFIED | SC5 (test half); truths 32-36, B2; UAT test 3 |
| SET-06 | 02-04 | The active provider and model are visible in the lesson header and in the plugin start message | ✓ SATISFIED **(was ? NEEDS HUMAN on the header render)** | `mcp.test.ts` for the message; the header pill driven in UAT test 4 — present, correct, flipping only on the next turn, hidden below 768 px — and widened by 02-07 so the model id is no longer cut (truths 38-41, B3, G5) |

Orphaned requirements: none. `REQUIREMENTS.md` maps exactly SET-01..06 to Phase 2 (lines 38-43,
161-166, 213) and every one is claimed by at least one plan and satisfied here. SET-06 is the one
status that changed: it was the single partially-human requirement in the previous report.

### Anti-Patterns Found

Scanned all 27 phase-modified source files (`git diff --name-only 9f92a3a..HEAD -- server web scripts .env.example plugin codex`),
with the five 02-07 files read in full.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | `TBD` / `FIXME` / `XXX` across all 27 phase-modified files | none found | Debt-marker gate clean |
| — | — | `TODO` / `HACK` / `PLACEHOLDER` across all 27 | none found | — |
| — | — | `console.log`, `dangerouslySetInnerHTML`, `confirm(` in the new server modules and the two new pages | none found | The two-step remove stays inline, as the contract requires (confirmed in UAT test 2) |
| `server/src/actions.ts` | 484-485 | `setPreferences` emits `learner.prefs` as the `preferences` event and returns it in the tool result; since 02-05 that object may carry `model`, and `export.ts:150-154` renders every entry into the vault note | ℹ️ Info (advisory) | Verified still present at HEAD. Touches no success criterion; the 02-05 prohibition names the system prompt, `describePrefs` and the menu description, and all three hold |

### Human Verification Required

**None outstanding.** All five items the previous report raised are settled in
`02-UAT.md` (`status: passed`, 5/5, 0 issues), and the six gap fixes were re-driven on 2026-10-01
with 27 of 29 checks passing. The two residues are recorded where they belong rather than reopened:

1. The `remove the key` hover is verified from the compiled CSS, not from a rendered pixel — a
   harness limit that blocks every hover in the app (advisory 2). A human on a desktop browser
   confirms it in one second if wanted; nothing in the phase depends on it.
2. UAT test 5's long-id expectation was amended by owner decision and is recorded as an **override**,
   not as a met must-have (frontmatter `overrides`, truth row B4/G4).

### Gaps Summary

**No gaps.** Every roadmap success criterion is achieved in the codebase with two independent kinds
of evidence: a hermetic 79-case settings suite inside a green 280-test tree (real restart, real
`auth.json`, loopback fakes, a spawn-counting `claude` shim, a 20+-body key-echo sweep), and a
complete human UAT driven in headless Chrome against scratch servers. The previous report's eight
open must-haves close — seven on observed behaviour, one on a written owner decision.

What is honestly still unproven, and recorded as such rather than as a pass:

- **The hover pixel.** `remove the key` darkens from rust-400 to rust-500 on hover by a rule that is
  demonstrably in the served CSS with a resolving token; the colour change itself was never seen,
  because Tailwind v4 gates every `hover:` utility behind `@media (hover:hover)` and headless Chrome
  reports that false. Static, deterministic evidence; not a behavioural observation.
- **A 59-character id in /you Section 07 scrolls; it does not fit.** 464 px of column against 520 px
  of text. The expectation was amended, with the owner's reasoning written into `02-UAT.md`, because
  closing the 58 px would re-rhythm the approved 760 px form and because `/settings` already behaves
  — and was already accepted — the same way.
- **No automated guard for the browser-side pill-ordering invariant.** It holds today (observed), the
  server feed is tested, and nothing in CI would catch a reducer regression because this repo has no
  web test runner.
- **Four open review findings touch must-have wording** (WR-01 on truth 45's `on the active provider
  only`, WR-05(b) on truth 49's placeholder). Both are unevidenced new scope under the
  re-verification evidence gate — no red test, and neither file changed since the previous pass — so
  they are reported as advisories rather than used to revert a completed must-have. WR-01 is the more
  substantive of the two and worth a decision before Phase 3 puts real API keys behind the same
  resolver.

### Covered-input fingerprint (#4155)

The previous report's digest was genuinely stale, for three reasons, all now fixed:

- four covered implementation files changed after it was written (`web/src/components/ProviderRow.tsx`,
  `web/src/pages/Lesson.tsx`, `web/src/pages/Settings.tsx`, `web/src/pages/You.tsx`), plus
  `.planning/ROADMAP.md`;
- two new phase artifacts existed that `covered_files` did not list — `02-07-PLAN.md` and
  `02-07-SUMMARY.md` — which alone forces `stale` through `allCurrentArtifactsCovered`, since that
  check re-scans the live phase directory rather than the declared list;
- one changed implementation file was never covered at all: `server/src/codex.ts`, which 02-07 edits.

`covered_files` is now 43 entries (40 + those 3). The digest was re-stamped with the tool's own
parser — `extractFrontmatter` from `gsd-core/bin/lib/frontmatter.cjs` to read the previous list and
`computeCoveredDigest` (through `gsd_run query verification.fingerprint`) to hash it — never a
hand-rolled scrape of `^  - `, which would also swallow entries from sibling frontmatter keys such as
`gaps_closed` and yield a wrong digest. The returned value is non-null, which under
`computeCoveredDigest`'s fail-closed contract means every declared path resolved to a real,
root-contained file; a `null` would have meant a bad path list, not real drift.

---

_Verified: 2026-10-01T11:41:32Z_
_Verifier: Claude (gsd-verifier) — re-verification after plan 02-07 and the settled UAT_
