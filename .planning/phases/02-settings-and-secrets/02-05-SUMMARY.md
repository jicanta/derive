---
phase: 02-settings-and-secrets
plan: 05
subsystem: settings
tags: [settings, learner-prefs, model-override, resolver, react, you-page, mcp, start_lesson, node:test]

# Dependency graph
requires:
  - phase: 02-settings-and-secrets (plan 01)
    provides: resolveTutor() / currentTutor() on the shared chooseModel tier, the settings table and modelKey, GET /api/settings/active, the turns row and turn_start payload carrying the model
  - phase: 02-settings-and-secrets (plan 04)
    provides: start_lesson's app_tutor_setting sentence read from /api/settings/active through the MCP api() proxy
  - phase: 01-foundation
    provides: the driver seam and fake driver the in-process suite runs a turn on; learnerOf(c) resolving ?learner= and x-derive-learner
provides:
  - "LearnerPrefs.model in server/src/db.ts with its cleanPrefs rule: trimmed, 200 chars, [A-Za-z0-9._:/-] only, dropped otherwise; preferencesSection renders no line for it"
  - "resolveTutor(learnerId?) in server/src/settings.ts: the model tier is env > learner > settings > catalogue default, reported as modelSource 'learner'; currentTutor() is unchanged"
  - "runTurn resolves for lesson.learner_id, so the learner's own model drives their next turn, is written to turns.model and carried by turn_start"
  - "GET /api/settings/active honours ?learner= and the x-derive-learner header via learnerOf(c); every other settings route stays per install"
  - "/you Section 07 Model: a mono h-10 max-w-[320px] input, aria-label 'Your model', placeholder 'install default: {model}' from api.activeTutor() with the bare 'install default' fallback, saved by the page's existing Save and ⌘↵"
  - "start_lesson reads /api/settings/active?learner=<id> so app_tutor_setting names the model that learner would get"
affects: [03 owned loop drivers (they receive ctx.model from the same resolve), 02 verification (human check of Section 07)]

# Actuals (#2632) — chars/4 over the realized diff 9f74888..HEAD across server/ and web/
actuals:
  tokens: 2442
  tasks: 2
  commits: 2
plan_head_before: 9f748886afa400217758464048488586093c6c26

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A preference the tutor must not read: the field lives in LearnerPrefs and cleanPrefs so the existing PATCH path and empty-string clearing work unchanged, but preferencesSection and describePrefs are left without a line for it, and a test asserts the learnerProfile text lacks the value"
    - "Learner-aware resolve by optional argument: resolveTutor(learnerId?) reads getLearner(learnerId)?.prefs.model only when a learner is named, so read-only and install-wide callers keep the same signature and answer"

key-files:
  created: []
  modified:
    - server/src/db.ts
    - server/src/settings.ts
    - server/src/agent.ts
    - server/src/index.ts
    - server/src/mcp.ts
    - server/test/settings.test.ts
    - web/src/lib/types.ts
    - web/src/pages/You.tsx

key-decisions:
  - "The learner tier is inserted inside chooseModel(provider, learnerId?) rather than as a wrapper around resolveTutor, so the environment lock stays first in one place: DERIVE_MODEL outranks the learner's id exactly as it outranks the settings table (D-11), and currentTutor() needs no change"
  - "GET /api/settings/active is the only settings route that takes learnerOf(c); the default learner is what an unnamed request resolves for, so one learner's override never reaches another's answer (T-02-24)"
  - "The /you placeholder reads api.activeTutor() once on mount and keeps null while pending or failed: the input then says 'install default' with no model named, never a stale or invented one"
  - "hasPrefs counts the model (the menu's fallback line disappears once a model is set) while describePrefs still names nothing about it, as the plan accepted; prefs.ts is byte-identical to HEAD"

patterns-established:
  - "Bounded learner-typed ids: the same character class PUT /api/settings/:provider enforces on the install-wide model is applied in cleanPrefs, so a model id is the same shape wherever it is stored"

requirements-completed: [SET-01]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "A learner's own model id, set through PATCH /api/learners/:id { prefs: { model } }, is what GET /api/settings/active?learner= (and the x-derive-learner header) reports with modelSource 'learner', while the default learner keeps the install setting"
    requirement: SET-01
    verification:
      - kind: integration
        ref: "server/test/settings.test.ts#resolves a learner-owned model for that learner alone, by query and by header, and leaves the default learner on the install setting"
        status: pass
    human_judgment: false
  - id: D2
    description: "The learner model id is bounded to [A-Za-z0-9._:/-] and cleared by an empty string, through the unchanged PATCH path"
    requirement: SET-01
    verification:
      - kind: integration
        ref: "server/test/settings.test.ts#bounds the learner model id like the install one, and clears it with an empty string"
        status: pass
    human_judgment: false
  - id: D3
    description: "DERIVE_MODEL outranks a learner-owned model: the resolve answers the environment value with modelSource 'environment'"
    requirement: SET-01
    verification:
      - kind: integration
        ref: "server/test/settings.test.ts#outranks a learner-owned model while DERIVE_MODEL is set"
        status: pass
    human_judgment: false
  - id: D4
    description: "The learner's next turn runs on their own model (turns.model and the turn_start payload carry it), another learner's turn on the same install does not, and the learnerProfile text runTurn hands the driver contains the teaching preference but not the model id"
    requirement: SET-01
    verification:
      - kind: unit
        ref: "server/test/settings.test.ts#runs a learner-owned model on that learner's next turn and keeps it out of the prompt"
        status: pass
    human_judgment: false
  - id: D5
    description: "start_lesson's app_tutor_setting is read for the lesson's learner (/api/settings/active?learner=<id>)"
    requirement: SET-01
    verification:
      - kind: integration
        ref: "server/test/mcp.test.ts#start_lesson (app_tutor_setting present and shaped `Derive's own tutor is set to … · …`)"
        status: pass
      - kind: other
        ref: "grep -c '/api/settings/active?learner=' server/src/mcp.ts → 1"
        status: pass
    human_judgment: false
  - id: D6
    description: "/you Section 07 Model: placeholder `install default: …`, mono input, saves with the page's Save and ⌘↵ showing `saved · applies from the next message`, the learner menu's sub-line does not name the model, and a 60-character id fits the h-10 max-w-[320px] input"
    requirement: SET-01
    verification:
      - kind: other
        ref: "pnpm --filter web build (no error TS); grep for n=\"07\", title=\"Model\", aria-label=\"Your model\", install default, api.activeTutor() in web/src/pages/You.tsx; git diff --quiet -- web/src/lib/prefs.ts"
        status: pass
    human_judgment: true
    rationale: "The placeholder text, the saved line, the menu sub-line and the long-id fit are visual; the plan's <human-check> covers them at end of phase"

# Metrics
duration: 3min
completed: 2026-09-30
status: complete
---

# Phase 02 Plan 05: Per-learner model override Summary

**One optional model id per learner on /you, resolved between DERIVE_MODEL and the install-wide setting for the active provider only, driving that learner's next turn and the plugin start sentence while never reaching the tutor's prompt**

## Performance

- **Duration:** 3 min
- **Started:** 2026-09-30T22:55:01Z
- **Completed:** 2026-09-30T22:58:29Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- `LearnerPrefs.model` with a `cleanPrefs` rule (trim, 200 chars, `[A-Za-z0-9._:/-]`), stored through the unchanged `PATCH /api/learners/:id { prefs }` path; `preferencesSection` gets no line for it and the suite asserts the `learnerProfile` text `runTurn` hands the driver lacks the id (T-02-23, RESEARCH Pitfall 5).
- `resolveTutor(learnerId?)`: the model tier is now environment → learner → settings → catalogue default, reported as `modelSource: 'learner'`; `runTurn` resolves for `lesson.learner_id`, so the override is on `turns.model` and the `turn_start` payload of that learner's next turn and nobody else's.
- `GET /api/settings/active` honours `?learner=` and the `x-derive-learner` header through `learnerOf(c)`; every other settings route stays per install (RESEARCH Q3, T-02-24). `start_lesson` asks it with the lesson's learner so `app_tutor_setting` names the model that learner would get.
- `/you` Section 07 `Model`: a mono `h-10 max-w-[320px]` input with `aria-label="Your model"`, placeholder `install default: {model}` read once from `api.activeTutor()` (falling back to `install default` while pending or failed), saved by the page's existing Save button and ⌘↵. `describePrefs` is untouched, so the learner menu never names the model; no key reaches the page (T-02-25).

## Task Commits

Each task was committed atomically:

1. **Task 1: The learner tier of the resolver, kept out of the prompt** - `4d17f66` (feat)
2. **Task 2: Section 07 on /you and the learner-scoped plugin sentence** - `e79edd7` (feat)

**Plan metadata:** see the final docs commit.

## Files Created/Modified

- `server/src/db.ts` - `LearnerPrefs.model` and its `cleanPrefs` rule; no change to `preferencesSection`
- `server/src/settings.ts` - `ModelSource` gains `'learner'`; `chooseModel(provider, learnerId?)`; `resolveTutor(learnerId?)`; header comment names the learner tier
- `server/src/agent.ts` - `resolveTutor(lesson.learner_id)`
- `server/src/index.ts` - `GET /api/settings/active` → `resolveTutor(learnerOf(c))`
- `server/src/mcp.ts` - `start_lesson` reads `/api/settings/active?learner=<id>`
- `server/test/settings.test.ts` - four new cases (three over HTTP, one in process) and the widened db import
- `web/src/lib/types.ts` - `LearnerPrefs.model`
- `web/src/pages/You.tsx` - `empty.model`, the `installModel` state and its one-shot fetch, Section 07

## Decisions Made

- The learner tier sits inside `chooseModel` so `DERIVE_MODEL` stays first in one place and `currentTutor()` is untouched; the read-only routes keep answering the install setting.
- `GET /api/settings/active` is the single learner-aware settings route; an unnamed request resolves for the default learner, so one learner's override cannot leak into another's answer.
- The `/you` placeholder holds `null` until `api.activeTutor()` answers and shows the bare `install default` on pending or failure rather than a guessed model.
- `hasPrefs` now counts the model; `describePrefs` still ignores it (plan's stated acceptable assumption). `web/src/lib/prefs.ts` is byte-identical to HEAD.

## Deviations from Plan

None - plan executed exactly as written. The one detail the plan did not spell out: the in-process case also sets `examples: 'cooking'` on the same learner and asserts the profile text contains it, so the "lacks the model id" assertion is proven against a prompt that does render the learner's other preferences rather than against an empty section.

## Issues Encountered

- The first draft of the `/you` fetch split `api.activeTutor()` across lines in the file's existing `.then` chain style, which the plan's literal `api.activeTutor()` grep (and the must_haves key_link pattern) could not see; collapsed onto one line before the Task 2 commit.

## Verification

- `pnpm build && pnpm --filter server exec node --import tsx --test test/settings.test.ts` → 79 tests, `# fail 0`
- `pnpm --filter server exec node --import tsx --test test/api.test.ts test/reply.test.ts` → 19 tests, `# fail 0`
- `grep -c "resolveTutor(lesson.learner_id)" server/src/agent.ts` → 1; `grep -c "resolveTutor(learnerOf(c))" server/src/index.ts` → 1
- `pnpm method:check && pnpm typecheck && pnpm build && pnpm test` → 6 rendered copies match; both typechecks Done; 280 tests, `# fail 0`
- `git diff --quiet -- web/src/lib/prefs.ts` and `git diff --quiet -- server/test/wire-surface.json` → both unchanged
- Human check (end of phase): Section 07 placeholder, the saved line, the menu sub-line, the 60-character fit, and the plugin start sentence naming the learner's id.

## Known Stubs

None. The field is wired end to end: stored by `cleanPrefs`, read by `resolveTutor`, written to the turns row, painted from `api.profile()`.

## Threat Flags

None. `?learner=` on `GET /api/settings/active` is the surface the plan's register already covers (T-02-24); no new endpoint, auth path or file access was added.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 2 is fully planned and executed; the phase verifier's human check covers Section 07 visually.
- Phase 3's owned-loop drivers inherit the override for free: `ctx.model` comes from the same `resolveTutor(lesson.learner_id)` call.

---
*Phase: 02-settings-and-secrets*
*Completed: 2026-09-30*

## Self-Check: PASSED

All 8 modified files exist; commits 4d17f66 and e79edd7 are in the log.
