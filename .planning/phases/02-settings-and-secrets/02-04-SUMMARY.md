---
phase: 02-settings-and-secrets
plan: 04
subsystem: ui
tags: [settings, header-pill, turn_start, mcp, start_lesson, doctor, env-example, react, node:test]

# Dependency graph
requires:
  - phase: 02-settings-and-secrets (plan 01)
    provides: lessonView.tutor { provider, model } off the turns row; the turn_start payload { provider, model }; GET /api/settings/active; /api/health as { ok, version, backend, model, source }
  - phase: 02-settings-and-secrets (plan 02)
    provides: SECRETS_PATH (secrets.json, 0600), ENV_KEYS, OLLAMA_HOST in config.ts; the five key variables the environment may carry
  - phase: 02-settings-and-secrets (plan 06)
    provides: the /settings page the pill, the nav link and the menu row point at
provides:
  - LessonState.tutor in web/src/lib/useLesson.ts, seeded from the lesson view and replaced by each turn_start payload that carries a provider
  - the muted `provider · model` header pill in web/src/pages/Lesson.tsx, a Link to /settings on agent lessons after their first turn; the companion pill now reads `companion · {driver} · terminal model` and stays a span; the Codex driver label is `codex cli`
  - the `settings` link in the Home nav and the `Settings` row in the learner menu with the static sub-line `which model teaches · for everyone on this install`
  - start_lesson result fields tutor_running_this_lesson and app_tutor_setting in server/src/mcp.ts, asserted in server/test/mcp.test.ts
  - scripts/doctor.mjs: a `Secrets file` line (presence and mode, never opened) and ` · tutor: {backend}[ · {model}] ({source})` on the Server line
  - .env.example: the per-turn precedence rule, DERIVE_BACKEND, DERIVE_CODEX_BIN, ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY / GOOGLE_API_KEY, OPENROUTER_API_KEY, OLLAMA_HOST, and where pasted keys live
affects: [02-05 learner override (scopes the plugin sentence per learner), 03 owned loop drivers (the pill shows whatever provider a turn ran on), 07 adoption docs (.env.example is the reference)]

# Actuals (#2632) — chars/4 over the realized diff, measured against the plan ledger
actuals:
  tokens: 4011
  tasks: 3
  commits: 3
plan_head_before: 45c27fe60ad09f400f890a67e3f9db927ff77c0c

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The pill reads the turn, not the setting: first paint from lessonView.tutor (the turns row), live updates only from a turn_start payload whose provider is a string; a payload without one leaves the pill as it was, so events stored before this phase replay cleanly"
    - "Provider display in the browser is the catalogue id with dashes read as spaces (claude code, codex), so the web app hard-codes no provider table"
    - "The MCP process asks the server for the app's tutor and claims nothing when it cannot: api('/api/settings/active').catch(() => null) and a spread-conditional field"

key-files:
  created: []
  modified:
    - web/src/lib/useLesson.ts
    - web/src/lib/api.ts
    - web/src/pages/Lesson.tsx
    - web/src/pages/Home.tsx
    - web/src/components/LearnerMenu.tsx
    - server/src/mcp.ts
    - server/test/mcp.test.ts
    - scripts/doctor.mjs
    - .env.example

key-decisions:
  - "Per 02-04 the header pill is a record of the turn, never the current setting: LessonState.tutor is seeded from lessonView.tutor after the event replay and replaced only by a turn_start payload carrying a provider string, so a change made in Settings shows on the next turn and never before (D-15, D-04)"
  - "Per 02-04 external lessons get no second pill and no link: the existing companion pill grows to `companion · {driver} · terminal model` and stays a span, with the driver label `codex cli` for Codex (D-16, UI-SPEC A5)"
  - "Per 02-04 the browser renders the provider as the catalogue id with dashes read as spaces while the plugin sentence keeps the raw id (`claude-code`): the pill is prose for the eye, the start_lesson field is data the model reads, and neither side carries a provider table"
  - "Per 02-04 the doctor's Secrets file line copies the token line's shape but treats absence as ok (`none yet; add keys in Settings`), skips the mode on win32, and never opens the file, so no key or fragment of one can reach the terminal"
  - "Per 02-04 .env.example limits itself to what config.ts and settings.ts do: env, then Settings, then detection per turn; a set variable locks its field; GOOGLE_API_KEY is read before GEMINI_API_KEY because the catalogue lists it first"

patterns-established:
  - "Turn-record fields on the lesson state: a payload-fed field that ignores payloads without the key, so old stored events replay without special cases"
  - "Doctor lines about secret files report presence and mode only; the fix sentence names the file's role, not its contents"

requirements-completed: [SET-06, SET-02, SET-03]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "The lesson header shows a muted `provider · model` pill beside the title on agent lessons after a turn, reading the last turn and linking to /settings; absent before any turn; `claude code · default model` when the model is null"
    requirement: SET-06
    verification:
      - kind: other
        ref: "pnpm --filter web build (tsc -b && vite build, exit 0)"
        status: pass
      - kind: other
        ref: "grep -c 'to=\"/settings\"' web/src/pages/Lesson.tsx → 1; grep -c 'default model' web/src/pages/Lesson.tsx → 1"
        status: pass
    human_judgment: true
    rationale: "The pill's placement inside the 60 px header, its hidden-below-md behaviour and that it flips only on the next turn after a Settings change are visual and multi-step facts no web test asserts; the plan schedules the human check at end of phase"
  - id: D2
    description: "A terminal-driven lesson's companion pill reads `companion · claude code · terminal model` or `companion · codex cli · terminal model`, stays a span and does not link to Settings"
    requirement: SET-06
    verification:
      - kind: other
        ref: "grep -c 'terminal model' web/src/pages/Lesson.tsx → 1; the pill element is unchanged (a span, no `to=`)"
        status: pass
    human_judgment: true
    rationale: "The plan's prohibition (nothing may claim Derive chose the terminal's model) is marked verification: judgment; a plugin lesson must be opened to read the pill"
  - id: D3
    description: "start_lesson answers tutor_running_this_lesson (naming the terminal driver, on its own model) and app_tutor_setting (`Derive's own tutor is set to {provider} · {model}`), the latter omitted when the server cannot be asked"
    requirement: SET-06
    verification:
      - kind: integration
        ref: "server/test/mcp.test.ts#walks a whole lesson with no model: start, plan, teach, check, answer, end"
        status: pass
      - kind: other
        ref: "git diff --quiet -- server/test/wire-surface.json (tools/list unchanged)"
        status: pass
    human_judgment: false
  - id: D4
    description: "/settings is linked from the Home nav (`settings` after `how you learn`) and from the learner menu (`Settings` with the sub-line `which model teaches · for everyone on this install`)"
    requirement: SET-06
    verification:
      - kind: other
        ref: "grep -c '>settings</Link>' web/src/pages/Home.tsx → 1; grep -c 'which model teaches · for everyone on this install' web/src/components/LearnerMenu.tsx → 1; pnpm --filter web build exit 0"
        status: pass
    human_judgment: true
    rationale: "Link placement and the menu row's reading are UX adequacy; the greps prove presence, not that the entry points read well"
  - id: D5
    description: "`pnpm check` reports the secrets file's presence and mode (never a key or a hint) and the active tutor on the Server line"
    requirement: SET-02
    verification:
      - kind: other
        ref: "node --check scripts/doctor.mjs && node scripts/doctor.mjs → `✓ Secrets file   none yet; add keys in Settings`; ! grep -q hint scripts/doctor.mjs"
        status: pass
      - kind: other
        ref: "scratch server on PORT=43197 with DERIVE_BACKEND=claude, then PORT=43197 node scripts/doctor.mjs → `Server  running on http://localhost:43197 (v0.4.0) · tutor: claude-code (environment)`"
        status: pass
    human_judgment: false
  - id: D6
    description: ".env.example documents DERIVE_BACKEND, DERIVE_CODEX_BIN, the five provider key variables, OLLAMA_HOST, the per-turn precedence rule and where pasted keys live; the DERIVE_MODEL example is current"
    requirement: SET-03
    verification:
      - kind: other
        ref: "grep for each of `# DERIVE_BACKEND=`, `# ANTHROPIC_API_KEY=`, `# OPENAI_API_KEY=`, `# GEMINI_API_KEY=`, `# GOOGLE_API_KEY=`, `# OPENROUTER_API_KEY=`, `# OLLAMA_HOST=`, `DERIVE_MODEL=claude-opus-5-5` in .env.example → all present"
        status: pass
    human_judgment: false

# Metrics
duration: 5min
completed: 2026-09-30
status: complete
---

# Phase 02 Plan 04: Header pill, plugin start message, doctor and .env.example Summary

**The learner always sees which model is teaching: a muted `provider · model` pill in the lesson header that records the last turn and links to /settings, the companion pill saying the terminal owns its model, `start_lesson` naming both the terminal tutor and the app's setting, two entry points to /settings, and a doctor and `.env.example` that know about the secrets file and every provider variable**

## Performance

- **Duration:** 5 min
- **Started:** 2026-09-30T22:44:57Z
- **Completed:** 2026-09-30T22:49:45Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- `LessonState.tutor` reads the turn, not the setting: seeded from `lessonView.tutor` (the turns row) on init and replaced by each `turn_start` payload that carries a provider string; payloads without one (stored events from before this phase, external lessons' `{ source }`) leave it untouched. `EVENT_TYPES` is unchanged.
- The header pill on agent lessons: `<Link to="/settings">` with the companion pill's classes plus `hover:text-ink-50 transition-colors`, title `Which model is teaching. Change it in Settings; it applies from the next turn.`, the value in a `max-w-[28ch] truncate` span with the full text in its `title`; absent before any turn; `claude code · default model` when the model is null. The provider is the catalogue id with dashes read as spaces.
- The companion pill on external lessons reads `companion · {driver} · terminal model`, stays a span, and the Codex driver label is now `codex cli` (D-16, A5). Nothing else on the lesson screen changed.
- Home nav gains `settings` after `how you learn`; the learner menu gains a `Settings` row (lucide `Settings` at 12 px) with the static sub-line `which model teaches · for everyone on this install` (A6: no request from the menu).
- `start_lesson` asks `GET /api/settings/active` through the `api()` proxy (null when the server cannot be asked) and returns `tutor_running_this_lesson` (`Claude Code in this terminal, on its own model` / `the Codex CLI in this terminal, on its own model`) and, when known, `app_tutor_setting` (`Derive's own tutor is set to {provider} · {model ?? 'default model'}`). Built from provider and model only; the tools/list wire surface is byte-identical.
- `scripts/doctor.mjs` reports `Secrets file` (absent → ok `none yet; add keys in Settings`; win32 → path; 0600 → ok; else fail with the `chmod 600` sentence) without opening the file, and appends ` · tutor: {backend}[ · {model}] ({source})` to the Server line from `/api/health`.
- `.env.example` documents the precedence rule (environment, then Settings, then detection, per turn; a set variable locks its field), `DERIVE_BACKEND`, `DERIVE_CODEX_BIN`, the five key variables (Google read before Gemini), `OLLAMA_HOST`, and that pasted keys live in `<data dir>/secrets.json` (0600); the `DERIVE_MODEL` example is `claude-opus-5-5`.

## Task Commits

Each task was committed atomically:

1. **Task 1: The header pill reads the turn; the companion pill names the terminal's model; two links to /settings** - `f163fc6` (feat)
2. **Task 2: The plugin start message names both tutors** - `2ffb1cb` (feat)
3. **Task 3: doctor and .env.example know about the secrets file and the variables; whole-tree gate** - `00b272b` (chore)

## Files Created/Modified

- `web/src/lib/useLesson.ts` - `LessonState.tutor`, the `init` action's `tutor`, the `turn_start` case's payload read
- `web/src/lib/api.ts` - the `lesson` key's return type gains `tutor`
- `web/src/pages/Lesson.tsx` - the tutor pill Link; `codex cli`; the companion pill's `terminal model` suffix
- `web/src/pages/Home.tsx` - the `settings` nav link
- `web/src/components/LearnerMenu.tsx` - the `Settings` row and its sub-line
- `server/src/mcp.ts` - `start_lesson` reads `/api/settings/active` and answers the two fields
- `server/test/mcp.test.ts` - asserts both fields
- `scripts/doctor.mjs` - the `Secrets file` line; the tutor suffix on `Server`
- `.env.example` - the precedence note and eight entries

## Decisions Made

- The pill is a record of the turn: `st.tutor = a.tutor` after the event replay so the turns row is what paints first, and the `turn_start` case only replaces it when `typeof ev.payload?.provider === 'string'`. A change in Settings therefore shows on the next turn, never before (D-15, D-04).
- The browser renders the provider as the catalogue id with dashes read as spaces (`claude code`); the plugin sentence keeps the raw id (`claude-code`) as the plan's template literal specifies. Neither side carries a provider table.
- The doctor's fail sentence for a wrongly-moded `secrets.json` names the file's role ("holds the provider keys pasted in Settings; anyone who can read it can spend on those accounts") and nothing of its contents; the script contains no `hint`.
- `.env.example` states only what `config.ts` and `settings.ts` do; no new security claims (project memory: trim before adding).

## Deviations from Plan

None - plan executed exactly as written. The one detail not spelled out by the plan is that the pill's text is computed once as `tutorLabel` above the JSX so the span's `title` and its content are the same string; the `useEffect` dispatch passes `d.tutor ?? null` so a server without the field still initialises the state.

## Issues Encountered

- The repo's `block-no-verify` PreToolUse hook rejected the first Task 1 commit command, which was a compound shell line with a heredoc message and a `gsd_run` call. Splitting the safety check from a plain `git commit -m` passed. No code effect.

## Verification

- `pnpm --filter web build` exit 0; `grep -c 'to="/settings"'` is 1 in each of `Lesson.tsx`, `Home.tsx`, `LearnerMenu.tsx`; `terminal model` present; `EVENT_TYPES` line untouched in the diff; no `gold-500` added to `Lesson.tsx`.
- `pnpm build && node --import tsx --test --test-name-pattern="mcp" test/mcp.test.ts` → `# pass 3 # fail 0`; `server/test/wire-surface.json` unchanged.
- `node --check scripts/doctor.mjs && node scripts/doctor.mjs` → `✓ Secrets file   none yet; add keys in Settings`; against a scratch server on 43197: `✓ Server  running on http://localhost:43197 (v0.4.0) · tutor: claude-code (environment)`; `! grep -q hint scripts/doctor.mjs` passes; `node --check plugin/hooks/mirror.mjs` passes.
- Whole-tree gate: `pnpm method:check` (6 rendered copies match), `pnpm typecheck`, `pnpm build`, `pnpm test` → `# tests 276 # pass 276 # fail 0`.
- Human check (end of phase, per plan): open an agent lesson after one turn and read the pill; change the provider in Settings and confirm the pill flips only on the next turn; open a plugin lesson and read `companion · claude code · terminal model` as a non-link; the Home nav and the learner menu show the two entry points.

## Known Stubs

None. Every value the pill, the plugin sentence and the doctor render comes from the turns row, the `turn_start` payload, `/api/settings/active` or `/api/health`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 02-05 (per-learner model override) can scope `app_tutor_setting` to the learner once the override exists; the pill needs no change because it reads the turn.
- Phase 3's owned-loop drivers show up in the pill automatically: whatever provider id `runTurn` writes into `turn_start` is what the pill renders, dashes read as spaces.

---
*Phase: 02-settings-and-secrets*
*Completed: 2026-09-30*

## Self-Check: PASSED
