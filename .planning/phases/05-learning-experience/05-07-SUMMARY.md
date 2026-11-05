---
phase: 05-learning-experience
plan: 07
subsystem: ui
tags: [react, tailwind, page-header, due-count, home, accessibility, bcp-47]

# Dependency graph
requires:
  - phase: 05-02
    provides: "`localeOf` and the `lang` option on `useVoiceMode` — the seam this plan connects, by resolving the learner's free-text language where the learner is actually read"
  - phase: 05-04
    provides: "`api.retention`, the `Retention` types and `RetentionPanel` already landed in `api.ts`/`types.ts`/`Atlas.tsx`, which this plan extends rather than clobbers"
  - phase: 05-05
    provides: "the `data-focus` / `data-focus-hide` convention and the one CSS rule behind it, whose marker this plan carries off the lesson page's inline header and onto the shared component"
provides:
  - "`web/src/components/PageHeader.tsx` — one header for Lesson, Atlas, Library, You, Settings and Usage, with the shipped shell string, a title that cannot be starved, an accessible back link named from its target, and the focus-hidden marker"
  - "`web/src/components/DuePill.tsx` — the grey due-count capsule, composed from the shipped `pill` class, visible at every width and absent at zero"
  - "`web/src/components/NextStep.tsx` — Home's three-row next-step block with its two quiet non-control variants"
  - "the due count on all six page headers and Home's masthead nav, from the server's own count on every surface"
  - "one stats read on the lesson page serving the vault flag, the due pill and the learner's spoken language"
  - "the open `03-UI-REVIEW` finding 1 closed in the one component that needed it: the lesson topic holds an 81px floor at 1024px where it measured 0px"
affects: [05-08, 06-personalisation]

actuals:
  tokens: 33337        # chars/4 over the 11 files actually changed (133,350 chars) — the plan estimated 55,000 on raw_tokens: 110,000
  diff_tokens: 10480   # chars/4 over the realized diff alone (41,922 chars)
  tasks: 3
  commits: 4           # MEASURED: git rev-list --count 7d4de964..HEAD — 3 production + 1 docs (this SUMMARY with state/roadmap/requirements)
plan_head_before: 7d4de964119dea1ac8865de4cf3016a02ea1f1fc

tech-stack:
  added: []
  patterns:
    - "A shared page header owns the one rule that must not be repeated six times: the title's `min-w-[8ch] flex-1 basis-0`, with `min-w-0` on every page-specific pill beside it"
    - "An icon-only link derives its accessible name from its target, so the name cannot drift from where the link goes"
    - "A travelling `data-focus-hide` marker: unconditional on the shared header, inert on the five pages that never set the document-element attribute"
    - "A count that follows the learner is read from the server's own figure on every surface — never recomputed, never cached per page"
    - "A block that must not change shape keeps its row and swaps a control for an inert line of the same height, rather than removing the row"

key-files:
  created:
    - web/src/components/PageHeader.tsx
    - web/src/components/DuePill.tsx
    - web/src/components/NextStep.tsx
  modified:
    - web/src/pages/Lesson.tsx
    - web/src/pages/Home.tsx
    - web/src/pages/Atlas.tsx
    - web/src/pages/Library.tsx
    - web/src/pages/You.tsx
    - web/src/pages/Settings.tsx
    - web/src/pages/Usage.tsx
    - web/src/lib/useVoiceMode.ts

key-decisions:
  - "The back link's accessible name is derived from its `to` target through a two-entry table in the component, not passed as a prop — a name that is computed from where the link goes cannot drift from it, and the Usage page's reads as going back to settings by construction"
  - "The lesson page passes no `due` to the shared header and renders its own `<DuePill>` inside the always-visible right-hand group, because the pill has to sit after the locked count there rather than at the head of the right slot"
  - "Atlas reads its count from `atlas.due.length`, which is the server's own `dueNodes` read — the same function `/api/stats` answers with — so it needs no second fetch and still cannot disagree with the review it offers to start"
  - "Home's continue row reads the resumable lesson from the `lessons` payload the block's own mount condition reads, not from `recent`, which needs a second request and would have changed the row's copy under the learner"
  - "The learner's language is resolved to a tag where the learner is read and the voice hook consumes the tag, rather than the hook re-resolving free text — one read, one resolution, and the null-for-unknown fallback is preserved"
  - "The narrow-width overflow the new pill introduced is paid for by the locked count's word, not by the topic's width floor: the floor is the open review finding's fix and dropping a label below `sm` is what voice and export beside it already do"

patterns-established:
  - "Pattern 1: the shared header absorbs the shell and the two layout rules, and nothing page-specific — the phase indicator, the locked count, voice, export, the live dot and the learner menu all stay children"
  - "Pattern 2: a readout is absent while unknown and absent at zero, never a dash, a spinner or a zero that becomes a number"
  - "Pattern 3: a narrow-width fit claim is measured, not inspected — headless Chrome over the built stylesheet with the real webfonts loaded"

requirements-completed: [LEARN-01, LEARN-03, LEARN-10]

coverage:
  - id: D1
    description: "One shared page-header component carries the back arrow, the title and the due pill, and all six page headers use it; no page still declares its own 60px shell"
    requirement: "LEARN-03"
    verification:
      - kind: other
        ref: "test \"$(grep -lc 'h-[60px] border-b hairline shrink-0' web/src/pages/{Lesson,Atlas,Library,You,Settings,Usage}.tsx | wc -l)\" = 0"
        status: pass
      - kind: other
        ref: "for f in the six pages: grep -c '<PageHeader' >= 1"
        status: pass
      - kind: other
        ref: "the shell class string in PageHeader.tsx compared byte for byte against `git show HEAD:` for each of the six pages — identical in all six"
        status: pass
      - kind: integration
        ref: "pnpm typecheck && pnpm build"
        status: pass
    human_judgment: false
  - id: D2
    description: "The title carries a width floor and a zero flex basis and every pill beside it may shrink, so adding the pill does not repeat the open review finding on six pages at once"
    requirement: "LEARN-03"
    verification:
      - kind: other
        ref: "grep -cE 'min-w-\\[8ch\\]' web/src/components/PageHeader.tsx >= 1 && grep -cE 'basis-0' >= 1"
        status: pass
      - kind: automated_ui
        ref: "headless Chrome CDP over the built stylesheet, lesson header at 375/414/640/768/1024/1280 — title width 81.0/114.1/193.3/81.0/81.0/328.5px, floor measured at 80.96px, zero header overflow at every width"
        status: pass
    human_judgment: false
  - id: D3
    description: "The icon-only back link has an accessible name worded from its target, and the usage page's reads as going to settings"
    requirement: "LEARN-03"
    verification:
      - kind: other
        ref: "grep -cE 'aria-label' web/src/components/PageHeader.tsx >= 1; the name is `Back to ${BACK[to]}` over a two-entry table, so Usage's `to=\"/settings\"` yields `Back to settings`"
        status: pass
    human_judgment: false
  - id: D4
    description: "The shared header's root carries the focus-hidden marker 05-05 put on the lesson page's inline header, so D-14 and LEARN-08's hidden header chrome did not regress silently during the extraction"
    requirement: "LEARN-03"
    verification:
      - kind: other
        ref: "grep -c 'data-focus-hide' web/src/components/PageHeader.tsx >= 1 && grep -c 'data-focus-hide' web/src/pages/Lesson.tsx >= 2 (exactly 2: the outline-rail and dependency-map asides)"
        status: pass
    human_judgment: true
    rationale: "The marker's presence on the shared root and the CSS rule's descendant selector are both proven statically, but that the lesson's header chrome actually disappears when `f` is pressed — now that the marked element is a shared component three files away from the rule — is observable only by toggling focus mode in a browser"
  - id: D5
    description: "The due pill renders nothing at zero, a singular title at one and a plural above one, carries no wide-screen-only prefix, and composes the shipped pill class rather than restating it"
    requirement: "LEARN-03"
    verification:
      - kind: other
        ref: "grep -c \"from './fields'\" web/src/components/DuePill.tsx >= 1 && grep -c 'export default' = 0; the early return is `if (!due || due < 1) return null` and the title is `${due} node${due === 1 ? '' : 's'} due for review — start a review`"
        status: pass
      - kind: other
        ref: "no `hidden md:` class in DuePill.tsx (the only textual hit is the prose comment explaining its absence)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The due pill is present at every width on all six headers and Home's nav, and in the lesson header it sits in the always-visible group after the locked count rather than in the md-only group that holds the phase indicator"
    requirement: "LEARN-03"
    verification:
      - kind: other
        ref: "grep -c '<DuePill' web/src/pages/Lesson.tsx >= 1 && grep -c '<DuePill' web/src/pages/Home.tsx >= 1; source order in Lesson.tsx is locked count (292) → DuePill (297) → voice (301) → export (315) → live dot (319), all inside `flex items-center gap-4 sm:gap-5`"
        status: pass
      - kind: automated_ui
        ref: "headless Chrome CDP at 375/414/640/768/1024/1280 — pill 60px wide, unclipped and inside the viewport at every width, and the live dot inside it too"
        status: pass
    human_judgment: true
    rationale: "The five non-lesson headers and Home's nav take the same component through the same prop, and the measurement covers the tightest of the seven surfaces; that the other six look right at 375px with real data behind them is the plan's own end-of-phase human check"
  - id: D7
    description: "Home gains a next-step block pinned above the unchanged hero, in fixed order — review, continue, start new — rendering only for a learner who has a lesson and only once both reads are in hand"
    requirement: "LEARN-01"
    verification:
      - kind: other
        ref: "grep -c '<NextStep' web/src/pages/Home.tsx = 1, mounted between </header> and the hero section under `stats && lessons.length > 0`"
        status: pass
      - kind: other
        ref: "git diff of web/src/pages/Home.tsx is 26 insertions and 0 deletions — the hero, topic form, example graph, lesson index and stats footer are untouched, including the footer's own due line"
        status: pass
      - kind: other
        ref: "grep -c 'Or start from one of these' web/src/pages/Home.tsx >= 1 && grep -c 'nothing due today' >= 1"
        status: pass
    human_judgment: false
  - id: D8
    description: "The block keeps one shape every day: with nothing due the lead row is a quiet non-focusable line in the same box, and with no lesson carrying nodes the second row is the same quiet variant, so three rows render in every state"
    requirement: "LEARN-01"
    verification:
      - kind: other
        ref: "grep -c 'Nothing due today' web/src/components/NextStep.tsx >= 1 && grep -c 'No lesson in progress' >= 1 && grep -c 'Start new' >= 1"
        status: pass
      - kind: other
        ref: "the quiet variants are `<div>` on the shared QUIET class (`cursor-default`, no `group`, no arrow, no focus ring), so neither is focusable; grep -cE 'focus-visible' NextStep.tsx >= 1 for the three interactive rows"
        status: pass
    human_judgment: true
    rationale: "That the quiet row occupies the same height as the live one, that the two rows read as one position rather than as something appearing and disappearing, and that the third row's focus-and-scroll lands the caret in the topic box are all judgments about what the learner sees — the plan reserves them for the end-of-phase check"
  - id: D9
    description: "The lesson page makes exactly one stats call, and it serves the vault flag, the due pill and the learner's spoken language"
    requirement: "LEARN-10"
    verification:
      - kind: other
        ref: "test \"$(grep -c 'api.stats()' web/src/pages/Lesson.tsx)\" = 1 && grep -c 'setVault' >= 1; no second api.stats/api.learners/api.profile read exists on the page"
        status: pass
      - kind: other
        ref: "grep -c 'localeOf' web/src/pages/Lesson.tsx >= 1 && grep -cE 'lang' >= 1 — `setSpokenLang(localeOf(s.learner?.prefs.language ?? ''))` feeding `lang: spokenLang`"
        status: pass
      - kind: unit
        ref: "server/test/voice.test.ts — localeOf's table and folding are under test (565 pass, 0 fail across the suite)"
        status: pass
    human_judgment: true
    rationale: "The wiring and the resolver are proven and `localeOf` itself is unit-tested, but that a learner whose `prefs.language` reads `español` is actually spoken to in Spanish needs a browser with a Spanish voice installed — the plan's own human-check asks for exactly that"
  - id: D10
    description: "Nothing in the method, the server or the scheduler changed: the method render check, both typechecks, the build and the whole suite are green"
    verification:
      - kind: other
        ref: "pnpm method:check — 6 rendered copies match method/"
        status: pass
      - kind: unit
        ref: "pnpm test — 565 pass, 0 fail, 140 suites"
        status: pass
      - kind: integration
        ref: "pnpm typecheck && pnpm build — both projects clean, web/dist emitted"
        status: pass
    human_judgment: false

# Metrics
duration: 16 min
completed: 2026-11-05
status: complete
---

# Phase 05 Plan 07: Shared Page Header, Due Pill and Home's Next Step Summary

**One `PageHeader` for six pages carrying a grey due pill at every width, a three-row next-step block pinned above Home's unchanged hero, and one lesson-page stats read that serves the vault flag, the pill and the learner's spoken language — with the open 1024px header finding closed by measurement rather than by assertion.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-11-05T01:42:46Z
- **Completed:** 2026-11-05T01:58:22Z
- **Tasks:** 3
- **Files modified:** 11 (3 created, 8 modified)

## Accomplishments

- **Six byte-identical header shells became one component.** `PageHeader.tsx` carries the shipped class string in the shipped order — verified byte for byte against `git show HEAD:` for each of the six pages — so the diff reads as an extraction. Each page keeps its own extras as children: the phase indicator, the locked count, voice, export and the live dot stay on the lesson page, the learner menu stays in the same four headers it was in, and it was added to neither Lesson nor Atlas.
- **The open `03-UI-REVIEW` finding 1 is closed, in the one place it needed closing.** The title now flexes from a zero basis behind a `min-w-[8ch]` floor and every page-specific pill beside it takes `min-w-0`. Measured in headless Chrome at 1024px with the cost pill present: the lesson topic renders **81px** where the review measured **0px**.
- **The due count follows the learner.** A grey `DuePill`, composed from the shipped `pill` class rather than restating it, on all six headers and in Home's masthead nav. It drops the cost pill's `md:`-only prefix because visible-everywhere is the whole requirement, renders nothing at zero and nothing while the count is unknown, and produces both a singular and a plural title.
- **Every surface reads the same figure from the same server read.** Atlas uses `atlas.due.length`, which is the same `dueNodes` call `/api/stats` answers with; the four pages that had no stats read gained one; the lesson page widened the read it was already making. No page recomputes or caches a count, so the pill cannot disagree with the review it offers to start.
- **Home leads with the next step.** Three rows in fixed order above the hero. With nothing due the lead row becomes a quiet `Nothing due today` line in the same box at the same height — not a disabled button and not a missing row — and with no lesson carrying nodes the second row is the same quiet variant, so the block keeps three rows and one reading order every day.
- **Home is otherwise untouched.** The diff on `Home.tsx` is 26 insertions and zero deletions: the hero, the headline, the topic form, the attach and import controls, the example graph, the lesson index and the stats footer — including its own due line — are exactly as they were, and a learner with no lessons sees today's Home because the block does not render.
- **The icon-only back link now has a name, and the name is computed from where the link goes.** `Back to all lessons` on five pages, `Back to settings` on Usage, from the `to` prop itself rather than from a second prop that could drift from it. This lands the UI checker's one non-blocking visual FLAG.
- **One read, three decisions on the lesson page.** The shipped mount-once `api.stats()` effect already fetched the whole payload and kept one field of it; it now also keeps the due count and the learner's resolved language. Same single call, same swallowed failure, same vault flag reaching export.
- **The focus-mode marker survived the extraction.** `data-focus-hide` is on the shared header's root, unconditionally, and `Lesson.tsx` is down to exactly the two markers that are its own.

## Task Commits

Each task was committed atomically:

1. **Task 1: One header for six pages, carrying a grey due pill at every width** — `59f2c9f` (feat)
2. **Task 2: Home leads with the next step, and the hero below it is untouched** — `3e12ba3` (feat)
3. **Task 3: One stats call on the lesson page — the pill at every width, and the learner's language in their ear** — `f5fe987` (feat)

**Plan metadata:** the single `docs(05-07): complete the shared header, due pill and next-step plan` commit carrying this SUMMARY plus STATE, ROADMAP and REQUIREMENTS. Its hash is deliberately not quoted here — a commit cannot cite its own hash from inside its own content.

## The 375px measurement, and the regression it caught

The plan carried E2-overflow as a **backstop**: whether the lesson topic still renders at least 64px at the narrow width with the pill present was specified as a held-out measurement rather than derived. It was measured, in headless Chrome over CDP against the **built stylesheet** with both webfonts confirmed loaded (`document.fonts.check` true for `Instrument Serif` and `JetBrains Mono`), over a fixture reproducing the rendered header markup verbatim.

**The first measurement failed, and it failed in a way no gate in the plan would have caught.**

| | header overflow | lesson topic | due pill | last child (live dot) |
|---|---|---|---|---|
| **375px, before the fix** | **+26px** | 88.0px | 60.1px, unclipped | right edge at **400.8px — off screen** |
| 375px, after | 0px | 81.0px | 60.0px, unclipped | 360.8px |
| 414px, after | 0px | 114.1px | 60.0px | 394.0px |
| 640px, after | 0px | 193.3px | 60.0px | 620.0px |
| 768px, after (cost pill appears) | 0px | 81.0px | 60.0px | 744.0px |
| 1024px, after (cost pill appears) | 0px | **81.0px** (review measured 0px) | 60.0px | 1000.0px |
| 1280px, after | 0px | 328.5px | 60.0px | 1256.0px |

The pill itself was never the thing clipped — the topic held its floor and the pill was fully visible. What fell off the right edge was shipped chrome: the export icon and the live connection dot. The plan's own `<verify>` gates all passed against that state, because every one of them is a grep and the defect was 26 pixels of layout. The title floor is measured at **80.96px** (8ch of Instrument Serif at 22px), so the topic clears the 64px the backstop asked for at every width.

## Files Created/Modified

- `web/src/components/PageHeader.tsx` (new) — the shipped shell string, the back link with its derived accessible name, the flexing title with its width floor, an optional subtitle, page-specific children, a right slot carrying the due pill then page extras then the learner menu, and the unconditional focus-hidden marker
- `web/src/components/DuePill.tsx` (new) — the due-count capsule: `${pill} gap-1.5 shrink-0 whitespace-nowrap` plus hover and an explicit gold focus ring, nothing rendered at zero or while unknown
- `web/src/components/NextStep.tsx` (new) — three rows, two quiet variants, one shared row rhythm, arrows that brighten with their row
- `web/src/pages/Lesson.tsx` — adopts the shared header with its two right-hand groups as children, renders the pill in the always-visible one after the locked count, widens the one stats read, resolves the spoken language, adds `min-w-0` to the cost and companion pills
- `web/src/pages/Home.tsx` — the pill in the nav row, the block between masthead and hero, a ref on the topic input and the focus-and-scroll handler behind the third row; additions only
- `web/src/pages/Atlas.tsx` — shared header, count from `atlas.due.length`, counts group as a right-slot child
- `web/src/pages/Library.tsx`, `web/src/pages/You.tsx`, `web/src/pages/Settings.tsx`, `web/src/pages/Usage.tsx` — shared header, learner menu as a child, and the one stats read each needed for the count
- `web/src/lib/useVoiceMode.ts` — the `lang` option is now a resolved tag rather than free text (deviation 1)

## Decisions Made

- **The back link's name is derived, not passed.** A two-entry table inside the component maps `to` to a phrase, so `Back to settings` on Usage is a consequence of the target rather than a second prop a future edit could leave stale. It is the shape of the checker's recommended fix and removes the failure mode the FLAG was about.
- **The lesson page renders its own pill.** The shared header takes an optional `due` and renders the capsule at the head of its right slot; the lesson page omits the prop and places `<DuePill>` itself, because the contract puts it after the locked count inside the always-visible group. One pill either way, and the lesson's ordering requirement does not leak into the shared component.
- **Atlas needed no new fetch.** `atlas.due` is `dueNodes(learner)` — literally the call `/api/stats` wraps — so reading its length is the same figure from the same read, not a second counter.
- **Home's continue row reads `lessons`, not `recent`.** `recent` resolves one request later; a row that said `No lesson in progress` and then said `Continue "…"` would be the copy-changing-under-the-learner case the contract rules out. `lessons.find((l) => l.nodes > 0)` arrives with the payload the mount condition already waits for.
- **Resolution moved to where the learner is read.** See deviation 1: the hook now consumes a tag. One read, one resolution, and `localeOf`'s null-for-unknown contract is preserved rather than duplicated.
- **The narrow-width budget was paid by a label, not by the floor.** The floor is the open review finding's fix and could not be the thing that yields. Dropping `locked` below `sm` is what the voice and export buttons sitting beside it already do with their own labels, so the figure stays and the word goes — the smallest change that keeps every element's information at every width.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The voice `lang` seam resolved in the wrong layer**

- **Found during:** Task 3
- **Issue:** `05-02` shipped `useVoiceMode`'s `lang` option as the learner's **free text**, resolving it internally with `setVoiceLang(localeOf(lang ?? ''))`. This plan's `key_links`, its must-have truth ("`prefs.language` reaches voice as a **resolved locale tag** from that same call") and its gate (`localeOf\(` must appear in `Lesson.tsx`) all require the page to resolve. Passing a resolved tag into the shipped hook would have had it call `localeOf('es')`, which the table answers `null` for — voice would have silently fallen back to the browser's language and the plan's own human-check ("with `prefs.language` set to `español`, confirm the tutor is spoken in Spanish") would have failed. The two plans' seams disagreed about which layer owns the resolution, and only one of the two readings is correct behaviour.
- **Fix:** `Lesson.tsx` resolves once, in the same `api.stats()` callback that reads the learner, and the hook's option became the resolved tag: `setVoiceLang(lang ?? null)`, with its doc comment and the inline reason rewritten to say so and the now-unused `localeOf` import removed. Resolution belongs where learner state is read; the hook has no learner state and should not have had a resolver.
- **Files modified:** `web/src/lib/useVoiceMode.ts`, `web/src/pages/Lesson.tsx`
- **Verification:** `pnpm typecheck && pnpm build` clean; `pnpm test` 565 pass / 0 fail, including `server/test/voice.test.ts`, which tests `localeOf` and `sentences` directly and never imports the hook — so `05-02`'s own gates are untouched by the move. The `localeOf` and `lang` gates on `Lesson.tsx` pass.
- **Committed in:** `f5fe987` (Task 3 commit)

**2. [Rule 1 - Bug] The new pill overflowed the lesson header at 375px and pushed the live dot off screen**

- **Found during:** Task 3 (found by running the plan's own backstop measurement rather than deferring it)
- **Issue:** Adding a 60px pill plus a 20px gap to the always-visible group, while the title now holds an 88px floor it previously did not, made the header's scroll width exceed its client width by **26px** at 375px. The export icon and the live connection dot rendered past the right edge. Before this plan the row fitted only because the title collapsed to near zero — which is the very finding the floor exists to fix — so the overflow is a direct consequence of this task's own change, not a pre-existing condition.
- **Fix:** the locked count's word moves to `hidden sm:inline` and the figure stays (the pattern the voice and export buttons beside it already use for their labels), and the group's gap tightens to `gap-4 sm:gap-5`. Both carry inline comments naming the measurement so neither is simplified away.
- **Files modified:** `web/src/pages/Lesson.tsx`
- **Verification:** re-measured at 375/414/640/768/1024/1280 — header overflow 0px at every width, the topic at or above its 80.96px floor, the pill 60px and unclipped, the live dot inside the viewport. Table above.
- **Committed in:** `f5fe987` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both were necessary for the plan's own stated truths to hold — deviation 1 for "a learner who asked to be taught in their language is spoken to in it", deviation 2 for "the pill is fully visible and unclipped" without breaking shipped chrome beside it. No scope creep: nothing was added, one label was made responsive and one resolver moved one layer out. Both are recorded in `.planning/WINDOWS.md` so they surface at ship time.

## Issues Encountered

- **One transient `pnpm test` failure, not a real one.** The first full-chain run after the measurement reported `ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL` while the TAP output read `# pass 565 / # fail 0`. Re-run in isolation the server suite exits 0, and the full chain re-run exits 0 with the same 565/0. The cause was almost certainly a port or process left behind by the headless-Chrome measurement running alongside `server/test/api.test.ts`, which spawns its own server; the lesson is the one already in the project's testing notes — do not run a browser harness and the API suite at the same time.
- The measurement fixture and its CDP driver were written inside `web/dist` (gitignored, and wiped by every build) because the session's write guard refuses paths outside the repo. Both were deleted afterwards; `web/dist` holds only `assets/` and `index.html`.

## Known Stubs

None. Nothing in this plan renders a hardcoded empty value, a placeholder string or a component with no data source. The one "absent" state — the due pill at an unknown or zero count — is a deliberate contract (`if (!due || due < 1) return null`), not a stub: "nothing due" is said in Home's next-step block and the Atlas due block instead.

## Threat Flags

None. The plan's register is fully mitigated by the implementation and no new surface was introduced:

- **T-05-35** (information disclosure through the pill) — the pill renders one integer from the shipped learner-scoped stats read. No node label, topic or schedule detail reaches it.
- **T-05-36** (a count drifting from the schedule) — every surface reads the server's own `dueNodes` figure: Atlas through `atlas.due`, the other five pages and Home through `/api/stats`. No client-side recomputation and no cache was introduced.
- **T-05-37** (a long learner-authored string in the header or the row) — the header title truncates behind its new floor, the next-step topic truncates inside `max-w-[42ch]`, and React escapes both. No learner string reaches an attribute that changes an element's behaviour; the pill's `title` interpolates only an integer.
- **T-05-38** (a failed stats read blocking a page) — every new consumer swallows the failure in the shipped style. The pill is unrendered, the next-step block does not mount, and each page's own content keeps working.
- **T-05-39** (free-text language reaching a speech API) — the text is matched against the committed table and resolves to a known tag or to null; the null case is the browser-language fallback. No learner text is interpolated into a tag, and after deviation 1 the resolution happens exactly once.

No package was installed and no icon was added, so no supply-chain row is owed.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **For `05-08` (`derive due` / the MCP command):** LEARN-03 is declared by both this plan and `05-08` and is therefore still **blocked** in REQUIREMENTS.md — `requirements.ready-ids` marked LEARN-01 and LEARN-10 and held LEARN-03 until `05-08` produces its SUMMARY. The terminal copy in UI-SPEC §`derive due` is untouched by this plan; the browser half of the requirement is done.
- **For Phase 6 (theme, accent, font, size):** `web/src/components/PageHeader.tsx` is the one place a header style attribute now lands, and `web/src/components/DuePill.tsx` composes `pill` from `fields.ts` rather than restating it, so a capsule restyle is one string. Neither file holds a literal hex.
- **Open, deferred by configuration:** the plan's `<human-check>` is harvested at end-of-phase under `workflow.human_verify_mode: end-of-phase` rather than run here. Its measurable half — the topic width and the pill's clipping at 375px, the surface the open UI review flagged — **was** measured and is recorded above; what remains for UAT is that the other six surfaces read right at that width with real data, that a zero count makes the pill disappear everywhere while Home's lead row says so, that focus mode still hides the now-shared header, and that a learner whose language is `español` is spoken to in Spanish. Four of the ten coverage deliverables are flagged `human_judgment: true` for that reason.
- Hover states were not driven headless and were not attempted: Tailwind v4 gates `hover:` behind `@media (hover: hover)`, which no headless Chrome mode satisfies. The three new hover-bearing surfaces (the pill, the back link, the next-step rows) were verified by reading their class strings.

## Self-Check: PASSED

- All three created files exist on disk (`PageHeader.tsx`, `DuePill.tsx`, `NextStep.tsx`), as does this SUMMARY.
- All three production commits resolve in `git log --oneline --all`: `59f2c9f`, `3e12ba3`, `f5fe987`. The fourth is the docs commit carrying this file.
- `git rev-list --count 7d4de964..HEAD` = 3 at SUMMARY-write time and 4 once the docs commit lands, matching `actuals.commits`.
- `LEARN-01` and `LEARN-10` read `[x]` and `Complete` in `.planning/REQUIREMENTS.md` (lines 54, 61, 171, 178). `LEARN-03` is correctly still `Pending` — `requirements.ready-ids` blocked it because `05-08` also declares it and has no SUMMARY yet.
- Every task gate re-ran green after the final edit, and `pnpm method:check && pnpm typecheck && pnpm build && pnpm test` exits 0: 6 rendered method copies match, both projects typecheck, `web/dist` emitted, 565 tests pass / 0 fail.
- The six header shells are gone from the pages and present once in `PageHeader.tsx`, byte-identical to what each page carried.

---
*Phase: 05-learning-experience*
*Completed: 2026-11-05*
