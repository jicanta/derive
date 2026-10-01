---
phase: 02-settings-and-secrets
plan: 07
subsystem: web
tags: [settings, ui-review, uat, gap-closure, react, codex]

# Dependency graph
requires:
  - phase: 02-settings-and-secrets
    provides: plan 04's lesson header tutor pill, plan 05's /you Section 07 model input, plan 06's Settings page and ProviderRow (header h1, textButton, the inline destructive confirm)
provides:
  - web/src/pages/Settings.tsx — h1 that truncates inside the 60px header
  - web/src/pages/You.tsx — h1 that truncates; Section 07 model input at column width
  - web/src/pages/Lesson.tsx — tutor pill wide enough to show the model id
  - web/src/components/ProviderRow.tsx — textButton with a 32px hit area; a live hover on the destructive confirm
  - server/src/codex.ts — model-refused hint naming the Codex row in Settings
affects: [03 any page reusing ProviderRow's textButton or the header h1 shape]

# Actuals (#2632) — chars/4 over the realized diff, measured against the plan ledger
actuals:
  tokens: 1311
  tasks: 1
  commits: 1
plan_head_before: 5f24bc600838a3e85d54f1ca071d396fde27c91f

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A header h1 beside a flex-sibling pill carries `truncate min-w-0`, not `truncate` alone: without `min-w-0` the flex item refuses to shrink below its content and the truncate never engages"
    - "The hit-area floor for a text button lives in the one shared `textButton` constant, so a button that hand-rolls its own class string (the destructive confirm did) silently opts out of it; composing `${textButton} <colour overrides>` keeps the floor and the colour in one place"
    - "A Tailwind 4 colour class only exists if `@theme` declares the token: `hover:text-rust-300` compiled to nothing because index.css declares rust-500 and rust-400 only, so the hover was inert with no build error"

key-files:
  created: []
  modified:
    - web/src/pages/Settings.tsx
    - web/src/pages/You.tsx
    - web/src/pages/Lesson.tsx
    - web/src/components/ProviderRow.tsx
    - server/src/codex.ts

key-decisions:
  - "Fix 4 replaces the whole inline class string with `${textButton} text-rust-400 hover:text-rust-500` rather than only swapping rust-300 for rust-500: the button was a hand-rolled copy of textButton, so composing it closes finding 3 and gives it finding 2's hit area in one edit, and the destructive colour stays an override at the call site"
  - "No `items-center` was added to any row container: all eight textButton call sites already sit in `flex items-center` rows, and the two tightest (the masked-hint row at a fixed `h-10`, and the replace row beside an `h-10` input) are taller than the new 32px button, so no row grew"
  - "You.tsx:106 (the language input) keeps `max-w-[320px]` as the plan instructs — a language name is short and that field was never a gap; only Section 07's model input drops the cap"

patterns-established: []

requirements-completed: [SET-01, SET-03]

# Coverage metadata (#1602)
coverage:
  - id: G1
    description: "On a 375px viewport the Settings and /you page titles stay on one line inside the 60px header, truncating with an ellipsis exactly as the lesson header already does (UI-REVIEW fix 1)"
    requirement: SET-01
    verification:
      - kind: other
        ref: "grep -c 'truncate min-w-0' web/src/pages/Settings.tsx web/src/pages/You.tsx (1 each, on the h1); `.truncate` and `.min-w-0` both emitted in the built web/dist CSS"
        status: pass
      - kind: other
        ref: "pnpm build (tsc -b under noUnusedLocals/noUnusedParameters, then vite build)"
        status: pass
    human_judgment: true
    rationale: "That the ellipsis reads correctly at 375px is visual; the class is now the same one Lesson.tsx:115 already proved in the UAT run (test 4 confirmed the lesson header truncates). Not re-driven in headless Chrome for this plan."
  - id: G2
    description: "Every text button in a provider row — fetch models, test connection, replace, remove, keep, keep the current key, remove the key — has a 32px hit area, matching the contract's one exception under 44px that rescan already honours (UI-REVIEW fix 2)"
    requirement: SET-01
    verification:
      - kind: other
        ref: "web/src/components/ProviderRow.tsx:7 textButton leads with 'inline-flex items-center h-8'; all 8 call sites (lines 156, 160, 166, 170, 207, 484, 490 plus the constant) compose it; `.h-8{height:` emitted in the built CSS"
        status: pass
    human_judgment: true
    rationale: "A measured 32px box in the browser is a visual check; the class list now matches Settings.tsx:10 rescan, which the UI review scored as already honouring the contract."
  - id: G3
    description: "The destructive 'remove the key' button has visible hover feedback from a colour token that exists in index.css; no new colour token is added (UI-REVIEW fix 3)"
    requirement: SET-01
    verification:
      - kind: other
        ref: "built CSS carries `hover\\:text-rust-500:hover{color:var(--color-rust-500)}` and zero occurrences of rust-300; web/src/index.css @theme unchanged (no new token)"
        status: pass
    human_judgment: false
  - id: G4
    description: "A 59-character model id entered in /you Section 07 fits the input without scrolling (UAT test 5, the one open issue)"
    requirement: SET-01
    verification:
      - kind: other
        ref: "web/src/pages/You.tsx:141 is `${field} font-mono h-10` with no max-w cap, so the input takes the column width as the /settings row model inputs do (`field` is `w-full`); You.tsx:106 still capped"
        status: pass
    human_judgment: true
    rationale: "The UAT measured scrollWidth 520px in a 318px box. The cap is gone and `field` is `w-full`, but the column it now fills was not re-measured in headless Chrome for this plan; a re-run of UAT test 5 is the closing evidence."
  - id: G5
    description: "A 29-character tutor label such as 'claude code · claude-opus-5-5' renders in the lesson header pill without the model id being cut (UAT test 4 gap 2)"
    requirement: SET-01
    verification:
      - kind: other
        ref: "web/src/pages/Lesson.tsx:122 is `max-w-[40ch] truncate` with the full value still in the span title; `max-w-\\[40ch\\]{max-width:40ch}` emitted in the built CSS; the only remaining 28ch in web/src is Graph.tsx:142, an unrelated empty-state paragraph"
        status: pass
    human_judgment: true
    rationale: "The UAT measured about 24 characters fitting at 28ch on 10px mono with 0.16em tracking; 40ch is the UAT's own 'widen to ~40ch' recommendation, but the rendered character count was not re-measured here."
  - id: G6
    description: "When Codex refuses a model on a ChatGPT login, Derive's hint names the Codex row in Settings as the place to set the model — not DERIVE_MODEL or ~/.codex/config.toml, the mechanism Phase 2 replaced (UAT test 4 gap 3)"
    requirement: SET-01
    verification:
      - kind: other
        ref: "server/src/codex.ts:166 friendly() appends ' Set the model on the Codex row in Settings (which model teaches), or leave it empty to use the Codex default.'; the triggering regex, the login hint below it and the exited-with-code strip are unchanged"
        status: pass
      - kind: integration
        ref: "pnpm test — 280 tests, 0 fail; no test asserts friendly()'s hint (grep over server/test/ for 'friendly', 'not supported when using Codex', 'codex login' found nothing; the DERIVE_MODEL hits in settings.test.ts are the settings-route env-lock 409, a different sentence in index.ts)"
        status: pass
    human_judgment: false

# Metrics
duration: 4min
completed: 2026-10-01
status: complete
---

# Phase 2 Plan 07: Close the Phase 2 UAT and UI-review gaps Summary

**Seven one-line fixes across five files that close all six open Phase 2 findings: two header titles that now truncate instead of filling the 60px header on a phone, seven provider-row text buttons that gain the contract's 32px hit area, a destructive confirm whose hover finally compiles (rust-300 was never a token), the /you model input at column width, the tutor pill widened to show the model id it exists to show, and a Codex model-refused hint that names the Settings row instead of the pre-Settings DERIVE_MODEL path.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-10-01T10:48:44Z
- **Completed:** 2026-10-01T10:52:10Z (code); SUMMARY written after
- **Tasks:** 1
- **Files modified:** 5 (0 created, 5 modified)
- **Commits:** 1 task commit (`95f8dcc`), plus this plan's docs commit. The frontmatter `commits: 1` counts task commits, matching the sibling summaries; `git rev-list --count 5f24bc6..HEAD` reads 2 once the docs commit lands.

## Accomplishments

Each fix, what changed, and what was verified:

1. **`web/src/pages/Settings.tsx:102` — header title overflow.** Added `truncate min-w-0` to the `<h1>` class list (`font-serif text-[22px] tracking-[-0.01em] truncate min-w-0 text-ink-50`); nothing else on the line moved. Verified: the class list matches `Lesson.tsx:115`'s already-working header, and `.truncate` / `.min-w-0` are both emitted in the built CSS.
2. **`web/src/pages/You.tsx:84` — the same defect.** Added `truncate min-w-0` to the `<h1>` (`font-serif text-[22px] truncate min-w-0 text-ink-50`). Same verification.
3. **`web/src/components/ProviderRow.tsx:7` — text buttons had no hit area.** `textButton` now leads with `inline-flex items-center h-8`, keeping its colour, transition, focus-visible and disabled classes byte-identical. Verified: `.h-8{height:` is in the built CSS, and all eight call sites (lines 156, 160, 166, 170, 207, 484, 490) compose the constant. The plan's caveat was checked explicitly — every call site already sits in a `flex items-center` container (`flex items-center gap-3 h-10 flex-wrap` for the masked-hint row, `flex items-center gap-2` beside the `h-10` key input, `mt-3 flex items-center gap-2 flex-wrap` for the actions row), and the two tightest rows are 40px tall, so a 32px button grew nothing. No container needed an `items-center`.
4. **`web/src/components/ProviderRow.tsx:156` — dead hover token.** The hand-rolled inline class string became `className={`${textButton} text-rust-400 hover:text-rust-500`}`, so the button gains fix 3's hit area at the same time. Verified in the built CSS: `hover\:text-rust-500:hover{color:var(--color-rust-500)}` is emitted (the hover is live), and `rust-300` appears zero times in the bundle. `web/src/index.css` was not touched — no new colour token.
5. **`web/src/pages/You.tsx:141` — Section 07 model input too narrow.** Dropped `max-w-[320px]`; the class is now `${field} font-mono h-10`, and `field` is `w-full`, so the input takes the column width exactly as the `/settings` row model inputs do. `You.tsx:106` (the language input) still carries `max-w-[320px]`, per the plan.
6. **`web/src/pages/Lesson.tsx:122` — tutor pill cut the model id.** `max-w-[28ch]` → `max-w-[40ch]`; `truncate` stays and the full value stays in the span `title`. Verified: `max-w-[40ch]{max-width:40ch}` is emitted in the built CSS, and the only remaining `28ch` in `web/src` is `Graph.tsx:142`, an unrelated empty-state paragraph.
7. **`server/src/codex.ts:166` — hint named the retired mechanism.** The appended sentence is now `' Set the model on the Codex row in Settings (which model teaches), or leave it empty to use the Codex default.'`. The `friendly()` structure, the triggering regex, the login hint below it and the `Codex Exec exited with code N` strip are all unchanged. Before editing, `server/test/` was grepped for `friendly`, `not supported when using Codex` and `codex login` — no matches, so no assertion needed updating. The `DERIVE_MODEL` hits in `settings.test.ts` (lines 39, 64, 730, 747, 750, 758) are the settings-route env-lock 409 case, a different sentence that lives in `index.ts`; they are untouched and still pass.

## Verification Results

All three commands were run from `/home/jicanta/derive` after the edits and before the commit. All three passed.

| Command | Result | Output |
|---------|--------|--------|
| `pnpm typecheck` | **pass** (exit 0) | `server typecheck: Done` / `web typecheck: Done` — web runs `tsc -b --noEmit` under `noUnusedLocals`/`noUnusedParameters`, so no orphaned import was left behind |
| `pnpm test` | **pass** (exit 0) | `# tests 280` · `# suites 66` · `# pass 280` · `# fail 0` · `# skipped 0` · `# todo 0` · `duration_ms 10300.85` |
| `pnpm build` | **pass** (exit 0) | `✓ built in 2.23s` then `tsc -p tsconfig.json` for the server; the emitted CSS (`web/dist/assets/index-DneaW6Kw.css`, newer than every edited source) was then grepped to confirm the three new utilities compiled |

## Task Commits

1. **Task 1: Apply the seven fixes** — `95f8dcc` (fix)

## Files Created/Modified

- `web/src/pages/Settings.tsx` — h1 `truncate min-w-0` (fix 1)
- `web/src/pages/You.tsx` — h1 `truncate min-w-0` (fix 2); Section 07 model input loses `max-w-[320px]` (fix 5)
- `web/src/components/ProviderRow.tsx` — `textButton` gains `inline-flex items-center h-8` (fix 3); the destructive confirm composes it with `text-rust-400 hover:text-rust-500` (fix 4)
- `web/src/pages/Lesson.tsx` — tutor pill `max-w-[28ch]` → `max-w-[40ch]` (fix 6)
- `server/src/codex.ts` — `friendly()`'s model-refused hint now names the Codex row in Settings (fix 7)

## Decisions Made

- Fix 4 replaces the whole inline class string rather than only swapping `rust-300` for `rust-500`. The button was a hand-rolled copy of `textButton`, so composing `${textButton} text-rust-400 hover:text-rust-500` closes finding 3 and gives the button finding 2's hit area in the same edit — which is what both the plan and the UI review's fix 2 asked for. The destructive colour stays an override at the call site, so the shared constant keeps one meaning.
- No `items-center` was added to any row container. The plan told me to check and, if a row grew, to fix the container rather than revert the hit area. All eight call sites were already centred, and the masked-hint row is a fixed `h-10` while the replace row sits beside an `h-10` input, so a 32px button is shorter than both rows. Nothing grew; nothing needed adding.
- `web/src/index.css` was not opened. Fix 4 uses `rust-500`, which `@theme` already declares, so the binding "no new colour token" constraint is met by construction rather than by review.

## Deviations from Plan

None - plan executed exactly as written. All seven replacements matched exactly one occurrence each in their target file (checked programmatically before writing, so a silent multi-match or no-match was impossible), and no test asserted the old Codex hint, so the plan's conditional "update the assertion in the same commit" did not apply.

**Total deviations:** 0 auto-fixed.
**Impact on plan:** None.

## Issues Encountered

- None. The `block-no-verify` hook that rejected plan 06's first commit was avoided by keeping the branch/HEAD guards and `git commit` in separate Bash calls, as this repo's memory note records. No `--no-verify` was used; hooks ran on the commit.
- Noted but not acted on: `.gsd/dispatch-isolation-sentinel.json` and five untracked files (`.planning/milestone.lock`, four `.planning/research/.cache/*.json`, `cleanup-root.sh`) were already dirty when this plan started and are out of scope. Only the five plan files were staged.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Deferred Issues

Two findings from `02-UI-REVIEW.md` were **not** in this plan's scope and remain open. Both are explicitly scored as minor/non-blocking by the review, and closing either would change the approved UI contract, which this gap-closure plan is not allowed to do:

- **Empty left half on login and local rows** (Pillar 2, minor) — `ProviderRow.tsx:433` pins the model field to `md:col-start-2`, so rows without a key field show a 40px input floating at the right. The review recommends `md:col-start-1`/`md:col-span-2` when `row.key` is null but asks the owner to confirm first, because `02-UI-SPEC.md` fixes the column.
- **Off-scale spacing** (Pillar 5, minor) — `mt-3` (12px) ×4 and `mb-1.5` (6px) ×1 sit off the declared 4/8/16/24/32 token scale. Fix 3 touched one of those rows' buttons but not its `mt-3`.

Also open and visual-only: `Use this provider` explains its disabled state through `title` alone, which is invisible to keyboard and touch users (Pillar 6, minor).

## Re-verification Needed

Four of the six findings were visual measurements taken in headless Chrome during the UAT run; this plan closed them in source and confirmed the compiled CSS carries each new utility, but did not re-drive the browser. Closing evidence for `02-UAT.md` is a re-run of:

- **UAT test 5** — the 59-character id in `/you` Section 07 should no longer scroll (it was scrollWidth 520px in a 318px box). This is the one `issue` that moved the phase to `partial`.
- **UAT test 4** — `claude code · claude-opus-5-5` should now render whole in the lesson header pill, and a Codex model refusal should name the Settings row.
- **375px frames** — `settings-mobile.png` and `you-desktop.png` at 375px should show one-line titles with an ellipsis, and the seven row text buttons should measure 32px.

## Next Phase Readiness

- Phase 2's one open UAT issue (test 5) and all three UI-review WARNINGs are closed in source; `02-UAT.md` can move from `partial` to `pass` once the three re-verification items above are re-driven.
- `textButton` is now the single place the 32px floor lives, so any phase-3 page reusing `ProviderRow`'s button idiom inherits it.
- The `truncate min-w-0` header idiom is now on all three full-page headers (`Lesson`, `Settings`, `You`); a fourth page should copy it rather than `truncate` alone.
- `friendly()` in `server/src/codex.ts` now points at Settings. If phase 3 adds a curated Codex default model id to the catalogue (the UAT's second suggestion for gap 3), this sentence is where the advice would need rereading.

## Self-Check: PASSED

All five modified files exist on disk; commit `95f8dcc` is in `git log`. Every line number claimed above was re-grepped and matches: `Settings.tsx:102` and `You.tsx:84` carry `truncate min-w-0`, `Lesson.tsx:122` is `max-w-[40ch] truncate`, `You.tsx:106` still carries `max-w-[320px]` (the language input, correctly left alone) while `:141` no longer does, and `codex.ts:166` is the new sentence. `web/src/index.css` is not in the commit — no colour token was added.
