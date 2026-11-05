---
phase: 05-learning-experience
plan: 04
subsystem: ui
tags: [fsrs, retention, sqlite, hono, react, tailwind, atlas, color-mix, sparkline]

# Dependency graph
requires:
  - phase: 05-01
    provides: the `prompts` table and the `PendingPrompt | null` lesson view (untouched here)
  - phase: 05-03
    provides: the React-free `lessonReducer.ts` holding `rowsToNodes`, which stays silent on stability by design
provides:
  - "`retention(learnerId)` in `server/src/db.ts`: estimated knowledge, its denominator, true retention with its sample count, the desired-retention target, a 14-day forecast and the next review ahead, in one call"
  - "`GET /api/retention`, learner-scoped through `learnerOf` only"
  - "`api.retention()` and the hand-mirrored `Retention` / `ForecastDay` types"
  - "`web/src/components/RetentionPanel.tsx`: the Atlas aside's third block, with its own fetch, its own error scope and the 14-bar fortnight"
  - "`REQUEST_RETENTION` exported from `server/src/schedule.ts`, so the desired-retention figure is the scheduler's own constant and not a second copy of 0.9"
  - "`Data.stability` on the graph node plus the logarithmic gold ramp, applied on the Atlas only"
  - "`NodeRow.stability` on the web side (the server already put it on the wire)"
affects: [05-06, 05-07, 05-08, 06-personalization]

# Actuals (#2632) — same instrument as the plan's `estimate.tokens`: chars/4 over
# the full content of the files actually changed (nine files, 257,644 chars).
actuals:
  tokens: 64000
  tasks: 3
  commits: 3
plan_head_before: 8b656613b87cf15ef0f5ab20bac2f6b3f8f9d3c5

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A figure the learner reads is computed once on the server and interpolated in the browser; the browser calculates nothing it could get wrong"
    - "A per-node runtime colour is an inline `style` carrying `color-mix(in oklab, var(--color-*) …)`, never a class — Tailwind v4 resolves arbitrary values at build time, and the token reference is what keeps Phase 6's re-skin working"
    - "An optional field threaded through `layoutGraph` lets one graph component render two surfaces differently without a second component; absence and zero are distinct cases"
    - "A side panel that fetches its own read is scoped by construction: the page it sits in is never blocked on it and never broken by it"

key-files:
  created:
    - web/src/components/RetentionPanel.tsx
    - server/test/retention.test.ts
  modified:
    - server/src/db.ts
    - server/src/index.ts
    - server/src/schedule.ts
    - web/src/lib/api.ts
    - web/src/lib/types.ts
    - web/src/components/Graph.tsx
    - web/src/pages/Atlas.tsx

key-decisions:
  - "True retention is the first `purpose='review'` row per (lesson_id, node_id) inside a 90-day window, and the count of those first rows is the denominator — `quiz_results` carries no attempt ordinal, so the definition is written once in `db.ts` and is also the learner-facing tooltip"
  - "A locked node with no FSRS state leaves estimated knowledge entirely, numerator and denominator both, because `retrievability()` returns a flat 1 for it and counting it would over-report the one figure the panel exists to be honest about"
  - "The thin-figure threshold is 10 and applies to true retention alone; the route returns `trueRetention: null` under it, so the component renders the withholding rather than restating the number"
  - "The desired-retention figure is `REQUEST_RETENTION` exported from the scheduler, so the panel cannot drift from the dates the scheduler hands out"
  - "The stability ramp's floor is 70% gold for contrast, not taste: a fainter fill crosses a band near 60-65% where neither the dark nor the light label text clears 4.5:1"
  - "At t = 1 the ramp reproduces the shipped locked node exactly (100% gold, a 55% glow, a 0.55 ordinal alpha), so a long-held node looks like every locked node looks today and only the newer ones changed"
  - "`stability` absent keeps the shipped class strings and the just-locked animation verbatim; `stability === 0` is the faint end of the ramp. The two are different nodes and render differently"
  - "The Atlas legend row wraps now, because five items measure 318px against 296px of column"

patterns-established:
  - "Server-side figure, browser-side interpolation: `Retention` carries whole percentages, so no arithmetic about the learner's memory happens twice"
  - "One `t` drives every channel of a ramp (fill, border, glow, ordinal alpha), so the signal cannot read inconsistently across them"
  - "A prohibition about honesty gets a test that was seen failing with its subject planted: the sample floor and the null-state exclusion were each watched to fail before being kept"

requirements-completed: [LEARN-04, LEARN-07]

coverage:
  - id: D1
    description: "`retention(learnerId)` returns estimated knowledge over qualifying locked nodes, true retention over first review tries in a 90-day window, the desired-retention target, a 14-day forecast and the next review ahead — with review copies, scratch lessons, other learners and FSRS-stateless nodes all excluded"
    requirement: "LEARN-04"
    verification:
      - kind: unit
        ref: "server/test/retention.test.ts#estimated knowledge / true retention / the fortnight ahead (12 tests)"
        status: pass
      - kind: unit
        ref: "server/test/retention.test.ts#excludes a locked node with no FSRS state from BOTH the numerator and the denominator — watched to fail with `AND n.stability IS NOT NULL AND n.difficulty IS NOT NULL` replaced by `AND 1 = 1`"
        status: pass
    human_judgment: false
  - id: D2
    description: "`GET /api/retention` answers the four figures, the forecast and the next-review timestamp for the learner resolved by `learnerOf`, reading no learner from a request body, and inherits the install-token guard"
    requirement: "LEARN-04"
    verification:
      - kind: integration
        ref: "curl GET /api/retention against the built server on a scratch data dir: 200 with `{held, locked, trueRetention, reviewSample, desired: 90, forecast[14], nextReviewAt}` with the token header; 401 without it"
        status: pass
      - kind: integration
        ref: "server/test/api.test.ts (52 tests — the shipped route surface is unchanged)"
        status: pass
    human_judgment: false
  - id: D3
    description: "`api.retention()` and the hand-mirrored `Retention` / `ForecastDay` types, plus `NodeRow.stability`, so the browser reads the payload through the one `api` object and no component fetches it directly"
    verification:
      - kind: other
        ref: "pnpm typecheck (server + web, strict); grep: no `fetch('/api/retention'` anywhere under web/src"
        status: pass
    human_judgment: false
  - id: D4
    description: "The Atlas aside carries a third block — gold eyebrow, the estimated-knowledge integer right-aligned, the `about {k} of {n} locked nodes held right now` caption and the neutral retention row with the first-try definition in its `title` — in the shipped `border-t hairline pt-[18px]` rhythm, after Misconceptions and before the legend"
    requirement: "LEARN-04"
    verification:
      - kind: other
        ref: "grep: the shipped shell class string, the single named export, no default export, `text-ink-100` on the percentage and exactly one rust occurrence in the file (the error line)"
        status: pass
    human_judgment: true
    rationale: "Whether the block reads as a third sibling in the aside's rhythm — baseline alignment of the eyebrow row, the caption's wrap inside 296px, the overall density — is a visual judgment no assertion in this repo makes. There is no web test harness and no screenshot runner."
  - id: D5
    description: "The fortnight renders as fourteen 13px bars with 8px gaps (286px inside 296px) at every count: today solid teal, later days 70%, a day with nothing scheduled a 2px stub, with the `today · +7d · +14d` axis, a caption singularising at one and `nothing due in the next 14 days` for an empty fortnight"
    requirement: "LEARN-04"
    verification:
      - kind: unit
        ref: "server/test/retention.test.ts#always returns fourteen days, zero-filled / folds everything already overdue into today bar / reports an all-zero fortnight — the route always sends 14 entries, so the strip is always 14 bars"
        status: pass
      - kind: other
        ref: "node arithmetic over the height formula for all-zero, one-review and mixed fortnights: 14 bars, no NaN at busiest = 0, max height exactly the 32px strip; 14x13 + 13x8 = 286"
        status: pass
    human_judgment: true
    rationale: "The bar count, the geometry and the heights are proven, but whether fourteen 13px bars read as a legible fortnight at 10px axis type needs eyes on the rendered strip."
  - id: D6
    description: "A figure backed by fewer first review tries than its threshold is never printed as a confident number: under 10 the route sends `trueRetention: null`, the panel shows `not enough reviews yet` in the muted tone, and the target suffix plus the other three figures keep rendering"
    requirement: "LEARN-07"
    verification:
      - kind: unit
        ref: "server/test/retention.test.ts#withholds the percentage under ten first tries and reports the sample / prints the percentage at ten and above / keeps the other three figures at every sample count — watched to fail with the floor planted at 1"
        status: pass
      - kind: other
        ref: "grep: `not enough reviews yet` present in RetentionPanel.tsx; the threshold constant appears only in db.ts, never in the component"
        status: pass
    human_judgment: false
  - id: D7
    description: "A failed retention read renders `Retention stats could not be read — reload the page. The map above is unaffected.` inside the block only; the Atlas map, the due block and the misconceptions block keep rendering"
    verification:
      - kind: other
        ref: "grep: the exact copy, `text-rust-400`, and `useState<string | null>` for the error; the panel owns its own fetch, so the failure cannot reach its siblings"
        status: pass
    human_judgment: true
    rationale: "Structurally scoped by construction, but nothing here forces the read to fail in a browser and watches the other three surfaces survive it. That belongs in UAT."
  - id: D8
    description: "A locked node's gold deepens with its FSRS stability on the Atlas — fill, border, glow and ordinal alpha from one `t = log1p(days)/log1p(180)` over the 70-100% band — while the in-lesson graph, and the due, shaky, teaching and pending branches, are unchanged"
    requirement: "LEARN-07"
    verification:
      - kind: other
        ref: "node arithmetic against the UI-SPEC ramp table: 0d → 70%/0% glow, 14d → t=0.52/85.6%, 60d → t=0.79/93.7%, >=180d → 100%/55% glow/0.55 ordinal (the shipped values)"
        status: pass
      - kind: other
        ref: "grep over comment-stripped Graph.tsx for `color-mix` and `log1p`; `stability: n.stability` present in Atlas.tsx and absent from useLesson.ts and lessonReducer.ts; the locked class string with no stability is byte-identical to the shipped one, animation included"
        status: pass
      - kind: other
        ref: "pnpm method:check && pnpm typecheck && pnpm build && pnpm test — 548 tests pass"
        status: pass
    human_judgment: true
    rationale: "Task 3 carries its own `<human-check>`, deferred by `human_verify_mode: end-of-phase`: open the Atlas on a learner with nodes locked at different times and confirm the gradient reads, every label stays readable, and a live lesson's graph looks exactly as it did. Tailwind v4 gates `hover:` behind a media query no headless mode satisfies, so hover is read from the class strings rather than driven."
  - id: D9
    description: "A fifth Atlas legend item — two 6px dots at the ramp's ends, the label `held longer`, and the full sentence in its `title` — in the shipped short-label-plus-title shape"
    verification:
      - kind: other
        ref: "grep: `held longer` and the full title sentence in Atlas.tsx"
        status: pass
    human_judgment: true
    rationale: "The row now wraps to a second line (five items measure 318px against 296px). Whether the wrapped legend reads well against the block above it is a visual call."

# Metrics
duration: 12min
completed: 2026-11-05
status: complete
---

# Phase 5 Plan 4: Honest Retention and the Stability-Tinted Atlas Summary

**`retention(learnerId)` reads FSRS state once and `GET /api/retention` serves four figures plus a 14-day forecast; the Atlas aside gains a third block that withholds a percentage under ten reviews rather than printing a confident one, and the Atlas map's locked gold now ramps logarithmically with each node's memory stability.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-11-05T00:36:30Z
- **Completed:** 2026-11-05T00:48:19Z
- **Tasks:** 3
- **Files modified:** 9 (7 modified, 2 created)

## Accomplishments

- **Growth became visible without becoming a scoreboard.** One learner-scoped route serves estimated knowledge (the sum of `retrievability()` over qualifying locked nodes), true retention over first review tries, FSRS's own `request_retention` as the target, and the fortnight ahead. Nothing models decay a second time: every figure reads the state the scheduler wrote, so the panel cannot disagree with the dates the learner is being given.
- **The honest number stays honest.** Under ten first review tries the route sends `trueRetention: null` and the panel says `not enough reviews yet` — a perfect score over one review is a true statement that means nothing. The percentage is `text-ink-100` at every value, with the target in grey beside it; rust appears exactly once in the file, on the read-error line. A locked node carrying no FSRS state leaves both the numerator and the denominator, because `retrievability()` would otherwise count it as perfectly held.
- **The map warms up over weeks.** A locked node's fill, border, glow and ordinal alpha all ramp from one `t = log1p(stabilityDays)/log1p(180)` across the 70-100% gold band. A freshly locked node reads pale with no halo; a node held for months is exactly the solid gold with the full glow that every locked node shows today. The in-lesson graph passes no stability and is byte-identical to before — in a live lesson every locked node was locked minutes ago, and a ramp there would read as uniformly fragile.
- **Both honesty prohibitions got a gate that was seen failing.** The ten-sample floor was watched to fail with the floor planted at 1; the null-state exclusion was watched to fail with its `IS NOT NULL` filter replaced by `AND 1 = 1`. Twelve tests in `server/test/retention.test.ts` now hold them.

## Task Commits

Each task was committed atomically:

1. **Task 1: Estimated knowledge, true retention and the target** — `14f88c5` (feat)
2. **Task 2: The fortnight ahead, the thin-figure rule, and a scoped failure** — `8157889` (feat)
3. **Task 3: Locked gold deepens with memory stability, on the Atlas only** — `1bef812` (feat)

**Measured:** `git rev-list --count 8b65661..HEAD` = 3 production commits (plan metadata commits separately).

## Files Created/Modified

- `server/src/schedule.ts` — exports `REQUEST_RETENTION = 0.9` and feeds it to `generatorParameters`, so the desired-retention figure is the scheduler's own constant rather than a second copy of it
- `server/src/db.ts` — four `q.retention*` prepared statements (each carrying `l.scratch = 0`, and the node reads `n.source_lesson IS NULL`, so a review copy never counts alongside its source), plus `retention(learnerId)`, the `Retention` / `ForecastDay` types and the `RETENTION_WINDOW_DAYS` / `RETENTION_SAMPLE_FLOOR` / `FORECAST_DAYS` constants
- `server/src/index.ts` — `GET /api/retention` under a `// ---------- retention ----------` separator, as one expression over `retention(learnerOf(c))`
- `server/test/retention.test.ts` — the thin-sample floor on both sides of its edge, and the exclusions that decide whether the figure is honest at all
- `web/src/lib/api.ts` — the `retention` endpoint key beside `atlas`
- `web/src/lib/types.ts` — `Retention` and `ForecastDay` hand-mirrored beside `Stats`; `NodeRow.stability`
- `web/src/components/RetentionPanel.tsx` — the third aside block: its own fetch, the figures, the caption, the neutral retention row, the 14-bar fortnight, the thin-figure state and the scoped error line
- `web/src/components/Graph.tsx` — `Data.stability`, `layoutGraph`'s optional input, and `stabilityRamp()` applied through the node's existing inline `style`
- `web/src/pages/Atlas.tsx` — `stability: n.stability` in `gnodes`, `<RetentionPanel />` between Misconceptions and the legend, and the fifth legend item

## Decisions Made

- **"Passed first try" is the earliest `purpose='review'` row per `(lesson_id, node_id)` inside the 90-day window.** `quiz_results` has no attempt ordinal and no `learner_id`, so this had to be defined rather than read. The learner scope is the `JOIN lessons l … WHERE l.learner_id = $l AND l.scratch = 0` the shipped aggregate already uses. The denominator is the count of those first rows, which is also what the threshold is measured against. A review session copies a node, so the same claim reviewed in three sessions is three legitimate first tries — intended, and stated in the `title` so the learner can read it.
- **The ordering rule is `ORDER BY ts, id` in SQL and first-per-key in JS**, rather than a correlated subquery. `quizzesOn` already reads rows in that order, so it is the same rule, and keeping the dedup in JS left the SQL to carry only the learner scope, the purpose and the window.
- **Forecast days are stepped with `setDate`, not by adding 86,400,000.** A clock change inside the fortnight would otherwise slide every boundary by an hour and mis-bucket a review. Index 0 carries everything already overdue, because that is what the learner can actually do now, and anything beyond the fourteenth midnight is left out rather than piled onto the last bar.
- **Percentages are whole numbers on the wire.** `trueRetention` and `desired` arrive as integers, so the browser interpolates figures and computes none of them — the same split Phase 4 settled for cost.
- **The ramp's 70% floor is a contrast decision.** A fainter fill crosses a band near 60-65% where neither `#17130b` (3.77:1) nor `ink-50` (4.36:1) clears 4.5:1 on the 13.5px label. The glow carries the full 0-55% range instead, since a shadow cannot make text fail. At `t = 1` the ramp lands on 100% gold, a 55% glow and a 0.55 ordinal alpha — precisely the shipped node, so only the newer nodes changed appearance.
- **`animate-glow-in` is withheld when a stability value is given.** Its end state is the full halo; on the Atlas it would animate every node to a glow the ramp says it has not earned.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The scoped error line landed in Task 1's commit rather than Task 2's**

- **Found during:** Task 1 (the `RetentionPanel` shell)
- **Issue:** The plan assigns the error line to Task 2 but has Task 1 create the component. `web/tsconfig.app.json` sets `noUnusedLocals`, so holding `error` in state through Task 1 without rendering it would either fail `pnpm --filter web typecheck` or force a silent swallow of a failed read — committing a known-wrong intermediate.
- **Fix:** Shipped the UI-SPEC-fixed error line with Task 1. Task 2 then added the forecast strip, the `not enough reviews yet` copy and the singularisation, as planned. No copy, class or behaviour differs from what Task 2 specified; only the commit it rode in.
- **Files modified:** `web/src/components/RetentionPanel.tsx`
- **Verification:** `pnpm --filter web typecheck` clean at both commits; Task 2's three state-string greps and its `string | null` error-state criterion all pass.
- **Committed in:** `14f88c5`

**2. [Rule 2 - Missing Critical] The Atlas legend row wraps**

- **Found during:** Task 3 (the fifth legend item)
- **Issue:** The plan says "one legend line is added" but does not name a wrap. JetBrains Mono advances 0.6em, so at 10px the five labels measure 186px; add four single-dot items at 12px each, the new two-dot item at 20px, and four 16px `gap-4` separators, and the row is 318px against the 296px the 340px aside leaves at `p-[22px]`. Without `flex-wrap` the fifth item would have overflowed the panel it was added to.
- **Fix:** Added `flex-wrap` to the legend row's shipped class string — the smallest change that keeps the item inside the column. `gap-4` is unchanged, so the second line sits on the 16px scale step.
- **Files modified:** `web/src/pages/Atlas.tsx`
- **Verification:** Arithmetic above; `pnpm build` clean. Whether the wrapped row reads well is carried as human judgment under coverage D9.
- **Committed in:** `1bef812`

### Files touched beyond the plan's `files_modified` (both implied by the plan's own text, not scope creep)

- `server/src/schedule.ts` — Task 1's action requires the target figure to be "imported rather than restated", which means `request_retention` had to stop being an inline literal. Exported as `REQUEST_RETENTION` and fed back into `generatorParameters`, so there is still exactly one `0.9` in the codebase.
- `server/test/retention.test.ts` — the plan's second prohibition carries `verification: test`, so a test was owed. It also covers the first-try definition, the null-state exclusion, the review-copy and scratch exclusions, cross-learner isolation and the forecast's edges.

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** Neither changes what the plan delivers. The first moves one UI-SPEC-fixed line between two commits of the same plan to avoid committing a knowingly broken intermediate; the second is required for the item the plan asked for to fit the panel it was added to. No scope creep.

## Issues Encountered

None. Every acceptance criterion passed on its first run, and the two honesty gates were each confirmed to fail with their subject planted before being kept (floor planted at 1 → 2 failures; `IS NOT NULL` replaced by `AND 1 = 1` → 1 failure), then restored.

## Known Stubs

None. Every figure the panel renders is read from live FSRS state; no component receives placeholder or mock data.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

**Verification run:** `pnpm method:check` (6 rendered copies match), `pnpm typecheck` (server + web), `pnpm build`, `pnpm test` (548 pass, 0 fail). Live smoke: `GET /api/retention` → 200 with all four figures, a 14-entry forecast and `nextReviewAt`; 401 without the install token.

**Ready for wave 4.** All three wave-4 plans depend on this one:

- `05-06` (LEARN-09, LEARN-11) and `05-07` (LEARN-01, LEARN-03, LEARN-10) depend on `05-04` and have what they need.
- `05-08` (LEARN-03) proxies `/api/retention` from `server/src/mcp.ts` for the `derive due` terminal command and reads `nextReviewAt` for its `Nothing due today. Next review {relative}.` line. Both the route and that field are in place and learner-scoped; an unknown learner name still falls back to the default on the server, as `05-08` expects.

**Carried to end-of-phase UAT** (`human_verify_mode: end-of-phase`), none of it blocking:

1. Task 3's `<human-check>`: open the Atlas on a learner with nodes locked at different times — freshly locked nodes pale with no halo, months-held nodes solid gold with the full halo, every label readable — then open a live lesson and confirm its graph is unchanged.
2. The retention block's rhythm as a third sibling in the aside, the 14-bar strip's legibility, and the wrapped legend row (coverage D4, D5, D9).
3. A forced retention-read failure in the browser, confirming the map and the two shipped blocks survive it (coverage D7).

**One accepted risk, unchanged from the plan:** the 9.5px ordinal badge sits near 3.0:1 at the faint end of the ramp (threat T-05-22, disposition `accept`). It is decorative and its value is repeated at full contrast in the `.node-pop` hover panel, so nothing is reachable only through it — and this is the shipped situation on solid gold today, not a regression introduced here.

**No new threat surface.** `GET /api/retention` is the boundary the plan's threat model already registered (T-05-18): the learner comes from `learnerOf(c)` alone, never from a request body; every statement joins `lessons.learner_id` and filters `l.scratch = 0`; the forecast carries dates and counts, never labels; and the route inherits the loopback guard and the install-token check from the existing `/api/*` middleware, which the 401 smoke check confirms.

---
*Phase: 05-learning-experience*
*Completed: 2026-11-05*

## Self-Check: PASSED

- `web/src/components/RetentionPanel.tsx` — present on disk
- `server/test/retention.test.ts` — present on disk
- `.planning/phases/05-learning-experience/05-04-SUMMARY.md` — present on disk
- Commits `14f88c5`, `8157889`, `1bef812` (production) and `90c872b` (plan metadata) all reachable from HEAD
- `git rev-list --count 8b65661..HEAD~1` = 3, matching `actuals.commits`
