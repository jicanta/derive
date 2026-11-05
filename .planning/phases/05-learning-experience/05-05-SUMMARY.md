---
phase: 05-learning-experience
plan: 05
subsystem: ui
tags: [react, keyboard, accessibility, tailwind, overlay, focus-mode]

# Dependency graph
requires:
  - phase: 05-01
    provides: "the prompts table and `LessonView.pending` as `PendingPrompt | null`, which is what makes `activePromptId` live without a turn in flight — the overlay and the focus filter both read the card it names"
  - phase: 05-03
    provides: "the React-free `lessonReducer.ts` fold, re-exported from `useLesson.ts`, so the timeline items this plan filters are typed the same as before"
provides:
  - "One keydown scheme across QuizCard, AskCard, ExplainCard and PlanCard: the digit and the letter pick the same slot, Enter commits, Shift+Enter is unsure on the quiz and a newline in the teach-back, 0 is the only 'I don't know'"
  - "`?` opens a lesson-level help overlay naming only the keys the open card honours, with dialog semantics, focus move and return, and a trapped Tab"
  - "One documented Esc order, evaluated in a single lesson handler: the overlay, then focus mode, then the turn in flight through the composer's own stop path"
  - "Focus mode: `f` hides the outline rail, the dependency map and the header chrome, collapses the grid to one column, and keeps the card, the one tutor block above it, the composer and the status line"
  - "`data-focus` (document element) and `data-focus-hide` (element marker) as conventions, with `web/src/lib/htmlAttr.ts` as the one seam behind them"
  - "The eight-word teach-back floor moved into `send()`, so no route in — plain Enter, command-Enter or a programmatic call — can bypass it"
affects: [05-06, 05-07, 06-personalisation]

actuals:
  tokens: 18541        # chars/4 over the 8 files actually changed (74,164 chars) — the plan estimated 55,000 on raw_tokens: 110,000
  diff_tokens: 6502    # chars/4 over the realized diff alone (26,009 chars)
  tasks: 3
  commits: 4           # MEASURED: git rev-list --count 4a438e16..HEAD — 3 production + 1 docs (this SUMMARY with state/roadmap/requirements)
plan_head_before: 4a438e1652706e5efb31fa6facaac29285302ba5

tech-stack:
  added: []
  patterns:
    - "Document-element attributes are written through `web/src/lib/htmlAttr.ts`, never inline — the seam Phase 6 extends with theme, accent, font and size"
    - "`data-focus-hide` is a travelling marker: the CSS rule is a descendant selector, so a marked region can move into a shared component without touching the rule"
    - "A view posture that must not outlive the session gets React state plus a document-element attribute and no storage half"

key-files:
  created:
    - web/src/components/KeyHelp.tsx
    - web/src/lib/htmlAttr.ts
  modified:
    - web/src/components/QuizCard.tsx
    - web/src/components/AskCard.tsx
    - web/src/components/ExplainCard.tsx
    - web/src/components/PlanCard.tsx
    - web/src/pages/Lesson.tsx
    - web/src/index.css

key-decisions:
  - "`?` is released to the help overlay and `0` keeps 'I don't know' — the one key that was bound to two meanings is resolved in LEARN-02's favour, so one shipped habit is lost and no capability is"
  - "The eight-word teach-back floor lives inside `send()`, not only on the button's `disabled` prop, because three routes now reach it"
  - "The teach-back needs the Enter commit in two places — a window effect for out-of-field Enter and an in-field branch on the auto-focused textarea, since the shipped guard bails on a TEXTAREA target"
  - "The teach-back's hint row deliberately does not advertise `?`: the auto-focused textarea swallows it, so advertising it there would name a key the card cannot honour in the state it is almost always in"
  - "The quiz keyboard `title` uses the locked copy verbatim (`1, 2, 3 to pick`) while the chips track the actual option count — the copy contract fixes the sentence, the chips carry the per-card truth"
  - "One lesson-level overlay rather than a sibling of each card: the contract gives rows for the nothing-open state, and there is no card to be a sibling of there"
  - "Focus mode needs three mechanisms — state, the document-element attribute, and a className column swap — because `display: none` on a grid child does not collapse a declared track"

patterns-established:
  - "One guard order for every window keydown handler in the app: bail inside a text field or contenteditable, bail on a modifier, then `preventDefault` in the branch that acts"
  - "Esc precedence is evaluated in exactly one handler per page, top-down, rather than by competing listeners"
  - "A hint row or title never names a key the card does not honour; reassigning a key means rewriting every string that advertised it"

requirements-completed: [LEARN-02, LEARN-08]

coverage:
  - id: D1
    description: "All four cards share one keyboard scheme: the digit and the letter pick the same slot, Enter commits, Shift+Enter is unsure on the quiz, and `0` is the only 'I don't know'"
    requirement: "LEARN-02"
    verification:
      - kind: other
        ref: "for f in QuizCard AskCard ExplainCard PlanCard; do sed -E 's;//.*$;;' $f | grep -c \"? for I don't know\" = 0; done"
        status: pass
      - kind: other
        ref: "sed -E 's;//.*$;;' web/src/components/AskCard.tsx | grep -cE '\\[a-d\\]' >= 1 && grep -c \"e.key === 'Enter'\" >= 1"
        status: pass
      - kind: integration
        ref: "pnpm --filter web typecheck"
        status: pass
    human_judgment: false
  - id: D2
    description: "The retired meaning of `?` is gone from the handler and from every string that advertised it; the quiz title names `0` for 'I don't know' and `?` for help, and the don't-know button names `0`"
    requirement: "LEARN-02"
    verification:
      - kind: other
        ref: "comment-stripped grep for `? for I don't know` across all four cards returns 0"
        status: pass
      - kind: other
        ref: "grep 'I don\\'t know (0)' web/src/components/QuizCard.tsx"
        status: pass
    human_judgment: false
  - id: D3
    description: "The eight-word teach-back floor holds on every route in, because it lives inside `send()` rather than only on the button"
    requirement: "LEARN-02"
    verification:
      - kind: other
        ref: "sed -E 's;//.*$;;' web/src/components/ExplainCard.tsx | grep -A 12 'const send = async' | grep -c 'words' >= 1"
        status: pass
      - kind: other
        ref: "grep -c addEventListener ExplainCard >= 1 && in-field onKeyDown region separates shiftKey"
        status: pass
    human_judgment: true
    rationale: "The static gates prove the floor is inside `send()` and that both Enter routes exist, but that Enter actually submits only at eight words and Shift+Enter actually inserts a newline in the auto-focused field is keystroke behaviour in a real browser — no test drives it, and the plan's own human-check asks for exactly this"
  - id: D4
    description: "`?` opens one overlay per lesson naming only the keys the open card honours, with dialog semantics, focus moved to the panel and returned on close, Tab trapped, and no scroll container"
    requirement: "LEARN-02"
    verification:
      - kind: other
        ref: "grep -c 'export default' KeyHelp.tsx = 0 && grep -cE 'aria-modal|role=\"dialog\"' >= 2"
        status: pass
      - kind: other
        ref: "grep -c '<KeyHelp' web/src/pages/Lesson.tsx = 1"
        status: pass
      - kind: other
        ref: "grep -c '? or Esc to close' && grep -c 'Keys for this card' >= 1 each; grep -cE 'overflow|scroll-thin' KeyHelp.tsx = 0"
        status: pass
      - kind: integration
        ref: "pnpm build"
        status: pass
    human_judgment: true
    rationale: "Mount count, semantics and copy are proven statically, but whether the panel names exactly the keys a given quiz honours, and whether `?` and Esc both dismiss it from the keyboard, is observable only by opening it over a live card"
  - id: D5
    description: "Esc has one documented order in one handler: the overlay, then focus mode, then the turn in flight through the same `stop` the composer's button calls"
    requirement: "LEARN-02"
    verification:
      - kind: other
        ref: "single window keydown effect in web/src/pages/Lesson.tsx evaluating help -> focus -> state.busy, calling the `stop` from useLesson"
        status: pass
    human_judgment: true
    rationale: "The chain's order is readable in one place, but that the third step stops a real turn — and that it is never reached while the overlay or focus is active — needs a turn in flight to observe"
  - id: D6
    description: "`f` toggles focus mode: the rail, the map and the header chrome are hidden, the grid collapses to one column, and the card, the one tutor block above it, the composer and the status line stay"
    requirement: "LEARN-08"
    verification:
      - kind: other
        ref: "grep -c 'data-focus' web/src/index.css >= 1 && grep -c 'data-focus-hide' web/src/pages/Lesson.tsx >= 3"
        status: pass
      - kind: other
        ref: "sed -E 's;//.*$;;' Lesson.tsx | grep 'xl:grid-cols-[232px' | grep -cE 'focus[[:space:]]*\\?' >= 1"
        status: pass
      - kind: automated_ui
        ref: "headless Chrome CDP measurement of the declared-track question (A2): centre child 232px with declared tracks vs 1400px collapsed"
        status: pass
    human_judgment: true
    rationale: "The markers, the rule and the state binding are proven, and A2 was measured directly, but that the focused column reads as one centred card with no empty gutter is a visual judgment the plan's human-check reserves"
  - id: D7
    description: "Focus mode is session-only: no storage key, no endpoint, no migration, and the document-element attribute is removed on unmount"
    requirement: "LEARN-08"
    verification:
      - kind: other
        ref: "sed -E 's;//.*$;;' web/src/lib/htmlAttr.ts | sed -E '/^[[:space:]]*\\*/d' | grep -cE 'localStorage|sessionStorage' = 0"
        status: pass
      - kind: other
        ref: "the focus effect's cleanup calls removeHtmlAttr('data-focus')"
        status: pass
    human_judgment: false
  - id: D8
    description: "Nothing in the method, the server or the scheduler changed: the whole suite, the method render check and both typechecks are green"
    verification:
      - kind: unit
        ref: "pnpm test — 548 pass, 0 fail, 137 suites"
        status: pass
      - kind: other
        ref: "pnpm method:check — 6 rendered copies match method/"
        status: pass
      - kind: integration
        ref: "pnpm typecheck && pnpm build"
        status: pass
    human_judgment: false

# Metrics
duration: 8 min
completed: 2026-11-05
status: complete
---

# Phase 05 Plan 05: Keyboard Scheme, `?` Overlay and Focus Mode Summary

**One keydown scheme across all four cards with `?` released to a per-card help overlay and `0` keeping 'I don't know', plus an `f` focus mode that hides the rail, the map and the header chrome through a `data-focus` document-element convention and a className grid swap.**

## Performance

- **Duration:** 8 min (measured from the recorded plan start; the context load preceded it)
- **Started:** 2026-11-05T00:55:19Z
- **Completed:** 2026-11-05T01:03:29Z
- **Tasks:** 3
- **Files modified:** 8 (2 created, 6 modified)

## Accomplishments

- **One scheme on all four cards.** The digit and the letter now pick the same slot on both option cards (`1`–`3`/`A`–`C` on the quiz, `1`–`4`/`A`–`D` on the open question), Enter commits on all four, Shift+Enter is unsure on the quiz and a newline in the teach-back, and `0` is the only 'I don't know'. `AskCard` gained the letter range, an Enter commit and the hint row it never had; `PlanCard` was verified rather than rebuilt and only gained a help chip.
- **The one double-bound key is resolved.** `?` no longer submits 'I don't know' — it opens the overlay — and every string that advertised the old meaning is rewritten: the quiz keyboard `title` now names `0` for 'I don't know' and `?` for help, and the 'I don't know' button carries `title="I don't know (0)"`.
- **The teach-back's eight-word floor now holds on every route in.** It moved from the button's `disabled` prop into `send()` itself, which is the one safety-bearing change here: the shipped command-Enter already bypassed the button, and adding plain Enter would have made a one-word teach-back trivially reachable.
- **The teach-back commits on Enter from both places it has to.** A window effect catches Enter once focus has left the field; an in-field branch on the auto-focused textarea catches the key the learner actually presses while typing, with Shift+Enter falling through to the browser's newline.
- **`?` opens one lesson-level overlay naming only the keys the open card honours.** Rows are derived from the card's kind and option count — a two-option quity shows two digit chips and two letters, a teach-back shows none — with `role="dialog"`, `aria-modal`, focus moved to the panel and returned on close, Tab trapped, and no scroll container, because the panel has a floor of two rows and a ceiling of six.
- **Esc has one documented order in one handler.** Overlay, then focus mode, then the turn in flight — and the third step calls the same `stop` the composer's own button does rather than a second implementation.
- **`f` strips the lesson to what the learner is supposed to be thinking about.** The outline rail, the dependency map and the header chrome are hidden by a travelling `data-focus-hide` marker, the grid collapses to one column, the timeline filters to the open card plus the one tutor block immediately above it, and the composer and the gold status line stay — so focus never hides the fact that the tutor is working.
- **The document-element attribute convention Phase 6 extends now exists** with one guarded helper behind it and no storage half.

## Task Commits

Each task was committed atomically:

1. **Task 1: One scheme on all four cards, and every string that advertised the old one rewritten** — `5717f72` (feat)
2. **Task 2: `?` opens an overlay naming only the keys that work for the card in front of the learner** — `c627cf6` (feat)
3. **Task 3: Focus mode — the card, the prose above it and the composer, and nothing else** — `afb8d24` (feat)

**Plan metadata:** the single `docs(05-05): complete the keyboard, overlay and focus-mode plan` commit, which carries this SUMMARY plus STATE, ROADMAP and REQUIREMENTS. Its hash is deliberately not quoted here — a commit cannot cite its own hash from inside its own content without going stale on the next amend.

## Self-Check: PASSED

- All nine claimed files exist on disk (`KeyHelp.tsx`, `htmlAttr.ts`, the four cards, `Lesson.tsx`, `index.css`, this SUMMARY).
- All three production commits resolve in `git log --oneline --all`: `5717f72`, `c627cf6`, `afb8d24`. The fourth is the docs commit carrying this file.
- `git rev-list --count 4a438e16..HEAD` = 4, matching `actuals.commits`.
- `LEARN-02` and `LEARN-08` read `[x]` and `Complete` in `.planning/REQUIREMENTS.md` (lines 55, 59, 172, 176); `requirements.ready-ids` returned both as ready with nothing blocked.
- `pnpm method:check && pnpm typecheck && pnpm build && pnpm test` green: 6 rendered method copies match, both projects typecheck, `web/dist` emitted, 548 tests pass / 0 fail.

## Files Created/Modified

- `web/src/components/KeyHelp.tsx` (new) — the `?` overlay: scrim, dialog panel, per-card key rows derived from the open card's kind and option count, footer, focus move/return and Tab trap
- `web/src/lib/htmlAttr.ts` (new) — `setHtmlAttr` / `removeHtmlAttr`, the one guarded seam for document-element attributes; no storage half
- `web/src/components/QuizCard.tsx` — `?` released from the handler, digit chips tracking the option count with the letter cluster beside them, rewritten keyboard `title`, `title` on the don't-know button
- `web/src/components/AskCard.tsx` — letter range beside the digits, Enter commit for typed text, new hint row, `isContentEditable` added to the guard
- `web/src/components/ExplainCard.tsx` — the eight-word floor inside `send()`, a window keydown effect, a plain-Enter branch in the field's own `onKeyDown`, and the hint row rewritten to `↵ submit · ⇧↵ newline`
- `web/src/components/PlanCard.tsx` — the help chip only; the Enter handler is untouched
- `web/src/pages/Lesson.tsx` — `help` and `focus` state, the lesson keydown handler owning `?`, `f` and the Esc chain, the overlay mount, three `data-focus-hide` markers, the grid-column swap, the collapsed timeline filter, the focus strip and the quiet line
- `web/src/index.css` — exactly one new rule: `html[data-focus] [data-focus-hide] { display: none; }`

## Decisions Made

- **`?` becomes help, `0` keeps 'I don't know'.** LEARN-02's adjacency problem is resolved in the requirement's favour. `0` already did the job, so one shipped habit is lost and no capability is — and both the handler branch and every advertising string are gone, which the plan's prohibition made mandatory rather than optional.
- **The floor goes in `send()`, not in a keydown handler.** Three routes reach it now and a fourth (a programmatic submit) is conceivable; only the submit function sees all of them. The button's `disabled` prop is left as it stands, so nothing visible changed.
- **The teach-back needs two Enter branches, and the reason is the auto-focus.** The shipped window guard bails on a `TEXTAREA` target, so a window-only implementation would leave the card uncommittable in the one state it is almost always in. The in-field branch is kept inline on the textarea's `onKeyDown`, beside the shipped command-Enter, and separates a held Shift so Shift+Enter still inserts the newline D-13 requires.
- **The teach-back's hint row does not advertise `?`** — the auto-focused textarea swallows it, so naming it there would name a key the card cannot honour where the learner is actually looking. The UI contract's row for this card lists `? help`; the plan overrode it with that reason, and the overlay remains reachable the moment focus leaves the field. The `⌘` chip was replaced by `↵ submit · ⇧↵ newline` per the contract's locked 8+ row; command-Enter still works for anyone who learned it, it is simply no longer the advertised route.
- **The quiz keyboard `title` keeps the locked copy verbatim** (`Keyboard: 1, 2, 3 to pick · …`) while the chips track the real option count. The copy contract fixes that sentence; the chips carry the per-card truth, which is where the "never advertise a key the card does not honour" rule actually bites.
- **One lesson-level overlay, not a sibling of each card.** The contract gives a row set for the nothing-open state, and there is no card to be a sibling of there, so the lesson level is the only mount that can serve it.
- **Focus mode is three mechanisms, named honestly.** React state owns it because the timeline collapse is a filter over items carrying no marker CSS could select on; the state writes the document-element attribute, which is what establishes the convention Phase 6 extends; and the grid columns swap by className. The UI contract's "exactly one new rule" was the budget for the hide rule, and exactly one rule is what `index.css` gained.
- **The overlay's `f` row stays live while the overlay is open.** Pressing `f` with the panel up toggles focus underneath. The panel advertises `f` as a working key, so honouring it is the consistent reading; nothing in the contract reserves it.

## Assumption A2 — measured, and the predicted symptom was wrong

The plan recorded A2 as reasoned from the CSS Grid specification but **not** rendered or measured, and asked for what the browser actually did. It was measured, in headless Chrome over a faithful reproduction of the shipped grid (`232px minmax(0,1fr) 452px`, 1400px container, both outer children `display: none`):

| Variant | Centre child width | Centre child offset |
|---|---|---|
| Declared tracks kept, outer children `display: none` | **232px** | 0px |
| Columns collapsed to `minmax(0,1fr)` | **1400px** | 0px |

**The className swap is required, and the failure it prevents is worse than the plan predicted.** The plan expected the centre column to keep its old width and sit offset left with an empty gutter on the right. What actually happens is that a `display: none` child is not a grid item at all, so the remaining `<section>` becomes the *first* grid item and auto-places into the *first* declared track — it collapses to the outline rail's **232px**, at offset 0, with 1168px of empty grid to its right. A1 of the assumption (the declared tracks survive) is confirmed; the predicted symptom is corrected. Nothing in the implementation changes as a result — the swap was already written unconditionally — but the record now says what the browser does rather than what the spec implies.

## Deviations from Plan

None — plan executed exactly as written.

Two implementation details worth naming, neither a deviation under the rules (both are inside the task's stated action):

- `AskCard`'s keydown effect no longer bails on `!ask.options.length`. The plan asked for one scheme across the cards, and the Enter commit has to work on an options-less open question too; with no options the hint row renders the help chip alone rather than an empty digit strip, which is the E9-empty row of the contract.
- `AskCard`'s guard gained `isContentEditable`, which the plan's "same guard order" copy from `QuizCard` requires and the shipped version lacked.

## Issues Encountered

None. All six Task 1 gates, all five Task 2 gates and all five Task 3 gates passed on first run after the edits, as did `pnpm method:check && pnpm typecheck && pnpm build && pnpm test` (548 tests pass, 0 fail).

## Known Stubs

None. Nothing in this plan renders a hardcoded empty value, a placeholder string or a component with no data source: every row the overlay shows is derived from the open card already in client state, and focus mode is a filter over the same timeline items.

## Threat Flags

None. The plan's register is fully mitigated by the implementation, and no new surface was introduced:

- **T-05-23** (a key typed into prose triggering an action) — every new listener copies the shipped guard order: bail inside `TEXTAREA`/`INPUT`/contenteditable, bail on a modifier. `f`, `?` and `0` typed into the composer or a teach-back stay prose.
- **T-05-24** (an accidental teach-back submit) — the floor is inside `send()`; Shift+Enter is the newline on both routes.
- **T-05-25** (a learner stranded in focus) — two keys leave it, the attribute is removed on unmount and on the state going false, and nothing is written to storage, an endpoint or a migration.
- **T-05-26** (the attribute written from several places) — one helper owns the write and the removal.
- **T-05-27** (the overlay rendering learner or model text) — every label is fixed copy; the only variable input is an option count, which is a number.
- **T-05-28** (Esc stopping a turn unintentionally) — accepted as planned; Esc reaches the stop step only when neither the overlay nor focus is active, and it calls the same path the composer's visible button offers.

No package was installed and no icon was added, so no supply-chain row is owed.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **For `05-07` (the shared `PageHeader` extraction):** this page's inline header carries `data-focus-hide`. When the header moves into `web/src/components/PageHeader.tsx`, **the marker must travel with it** — the CSS rule is a descendant selector, so it needs no change, but the marker is not inherited and the header's chrome would stop hiding without it. `05-07` owns the gate that keeps it hidden after the extraction. This plan's assertion of **three** markers in `Lesson.tsx` is the count for as long as the header is inline; do not weaken it in anticipation, and do not read the extraction as a place to drop the marker.
- **For Phase 6 (theme, accent, font, size):** `web/src/lib/htmlAttr.ts` is the one seam. Add attributes through it, not with scattered `document.documentElement` writes. It deliberately has no storage half — Phase 6 will need one for its own persisted settings, and adding it there is correct; what must not happen is focus mode acquiring one.
- **Open, deferred by configuration:** the plan's `<human-check>` (both keys selecting the same slot, the overlay naming only working keys, the focused card centred with no empty gutter, Enter submitting the teach-back only at eight words) is harvested at end-of-phase under `workflow.human_verify_mode: end-of-phase` rather than run here. Five of the eight coverage deliverables are flagged `human_judgment: true` for that reason and will route to UAT.
- Hover states were not driven headless and were not attempted: Tailwind v4 gates `hover:` behind `@media (hover: hover)`, which no headless Chrome mode satisfies. The one new hover-bearing surface is the overlay panel, which declares none.

---
*Phase: 05-learning-experience*
*Completed: 2026-11-05*
