---
status: diagnosed
trigger: "UAT gap G-05-6 (test 6) in .planning/phases/05-learning-experience/05-UAT.md, phase 05-learning-experience of the Derive repo (/home/jicanta/derive)."
created: 2026-11-05T00:00:00Z
updated: 2026-11-05T00:14:00Z
goal: find_root_cause_only
symptoms_prefilled: true
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

bug_class: Bohrbug (deterministic layout; reproduces every time at 375px with a long topic)
known_pattern_candidate: none (no .planning/debug/knowledge-base.md exists yet)
status_note: diagnose-only (goal: find_root_cause_only). Root cause confirmed; no fix applied. Returning ROOT CAUSE FOUND.

reasoning_checkpoint:
  hypothesis: "The Continue row is 111px at 375px because NextStep.tsx:62 bounds the topic with `max-w-[42ch]` — a cap resolved in the span's own font (0.46em per ch at 19.2px Instrument Serif = 370.7px) that never consults the 327px column — on an atomic `inline-block` that can neither shrink nor break, so it is pushed to its own overflowing line and the trailing arrow to a third (3 x 28.8 + 24 + 1). The lead row is 58px because its 22px font inherits preflight's line-height 1.5 (33px) + py-3 (24) + border-t (1); the plan's 56px bound was computed for the 1.2rem rows (53.8px) and never for the 22px row."
  confirming_evidence:
    - "Static repro with the real fonts: 1ch = 8.826px (0.460em), 42ch = 370.7px, span right edge 394.7, row 111.4px — the tester's 371 / 395 / 111 to the decimal."
    - "Same repro with preflight's button font reset: lead 58.0 (line-height 33px), Start new 53.8 — the tester's 58 / 54 — so nothing beyond the line box, padding and border contributes."
    - "Built CSS: `.text-\[22px\]{font-size:22px}` and `.text-\[1\.2rem\]{font-size:1.2rem}` set no line-height; `.max-w-\[42ch\]{max-width:42ch}`; `.truncate` sets white-space:nowrap + overflow:hidden."
    - "Variant with the row as flex + `min-width:0` on the span: 53.8px one line at 327px (span shrinks to 249.3px) and the 42ch cap still holds at 1440px (370.7px)."
  falsification_test: "If the span measured ≤ 327 - 63 - 15 ≈ 249px at 375px, or the row stayed 111px after the span was allowed to shrink, or the lead row exceeded 58px with preflight applied, the hypothesis would be wrong. None of these happened."
  fix_rationale: "Not applied (diagnose-only). The cause is the unit of the bound (font-relative ch on an unshrinkable atomic inline) — the fix direction is to let the topic shrink to the space the row leaves it while keeping 42ch as the ceiling, not to pick a smaller ch number or a breakpoint."
  blind_spots: "Measured in Chrome only (the tester's tool and mine); Safari/Firefox ch metrics for Instrument Serif are the same glyph advance so the conclusion holds, but the exact pixel values were not re-measured there. Not measured: a topic between ~31 and 42 characters, which should give a two-line (~82px) row by the same mechanism."
  candidate_causes:
    - "code: ch-unit max-width on an atomic inline-block (NextStep.tsx:62) — CONFIRMED cause of the 111px row"
    - "config/theme: Tailwind v4 preflight `html{line-height:1.5}` inherited by arbitrary text sizes — CONFIRMED cause of the 58px lead row (the figure in the plan was wrong, the layout is as designed)"
    - "environment: Instrument Serif not loading, fallback serif widening the span — ELIMINATED (0.46em matches Instrument Serif; every fallback is wider, so it could only worsen, and the repro loaded the font)"
    - "data: topic length — a precondition, not a cause: any topic wider than ~249px (≈ 30 characters) wraps the row; the 42ch cap just fixes the worst case at three lines"
  and_gate: "no for each symptom — the 111px Continue row needs only the ch cap on an unshrinkable inline (any long topic triggers it), and the 58px lead row needs only its own font-size x inherited line-height. The gap's truth (no row over 56px) fails for these two independent reasons, so root_cause lists both; neither depends on the other."

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: At 375px the three rows of Home's next-step block (web/src/components/NextStep.tsx: "Review N due →", "Continue "<topic>" →", "Start new ↓") each fit on one line of at most 56px inside the 327px content column (05-07-PLAN.md line 52; 05-UI-SPEC.md line 593).
actual: Headless Chrome, Emulation 375x812 mobile, learner whose latest lesson topic is 'How does the Fourier transform turn a time signal into frequencies, and why does sampling below the Nyquist rate alias?': row heights 58px ("Review 7 due →", font-size 22px, line-height 33px, py-3), 111px ("Continue ..."), 54px ("Start new ↓", 19.2px, line-height 28.8px). The Continue row's `<span class="inline-block max-w-[42ch] truncate align-bottom">` measured 371px wide with right edge 395px (viewport 375, column 24..351), so it does not fit beside "Continue " and wraps onto its own line; the trailing arrow wraps to a third line: 3 x 28.8 + 24 padding = 110.4 ≈ 111px. At 1440px the same row is 54px. Also observed (pre-existing, not this gap): Home's scroll container `.min-h-full.overflow-y-auto` has 810px of horizontal overflow at 375px (ReactFlow viewport of the hero graph reaches x=1756, hero H1 reaches x=1133), and the autofocused topic input scrolls that container 52px right on load, clipping the left 28px of every row.
errors: None.
reproduction: UAT test 6. Open Home at 375px for a learner whose latest lesson with nodes has a topic longer than ~35 characters.
started: Discovered during UAT on 2026-11-05; the block shipped in 05-07 (commit 3e12ba3 "Home leads with the next step").

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: Instrument Serif failed to load in the tester's headless Chrome and a wider fallback serif (Georgia / Times) inflated the 42ch span
  evidence: 371px / 42 = 8.83px = 0.460em per ch, Instrument Serif's digit advance; Georgia (~0.60em → 484px) and Times/Liberation (0.50em → 403px) would be wider, and the repro with `document.fonts.check` true reproduced 370.7px exactly
  timestamp: 2026-11-05T00:08Z

- hypothesis: Something other than the lead row's own line box adds height (the 11px arrow span, `align-bottom`, a double border, a hover/focus ring)
  evidence: With preflight's `button{font:inherit}` the repro lead row is exactly 33 + 24 + 1 = 58.0px; the arrow's 16.5px line box sits inside the 33px strut; ROW has a single border-top
  timestamp: 2026-11-05T00:12Z

- hypothesis: The pre-existing 810px horizontal overflow on Home at 375px comes from ReactFlow's transformed viewport (x=1756)
  evidence: A static page with the hero grid, the H1 and the `truncate` topic header but no ReactFlow at all yields scrollWidth 1185 = 375 + 810 — the tester's figure exactly — so the viewport is clipped (does not add scrollable overflow) and the 1756px is a consequence of the 1161px-wide pane it was fitted to, not a cause
  timestamp: 2026-11-05T00:12Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-11-05T00:01Z
  checked: web/src/components/NextStep.tsx (full file)
  found: ROW = 'group block w-full text-left py-3 border-t border-ink-100/10 ...' (line 28-29). Lead row (line 50) adds `font-serif text-[22px]`; Continue row (line 59) is a react-router `Link` with `${ROW} font-serif text-[1.2rem]`, whose children are the text node `Continue{' '}`, then `<span className="inline-block max-w-[42ch] truncate align-bottom">"topic"</span>` (line 62), then `<span className={ARROW}>→</span>` with ARROW = 'ml-2 font-mono text-[11px] ...' (line 33). No width/min-width/flex on the Link; the only bound on the topic is `max-w-[42ch]`, in `ch`.
  implication: The topic span is an atomic inline-level box whose cap is expressed in the span's own font unit, not in the container's width. Nothing lets it shrink below 42ch when the container is narrower.

- timestamp: 2026-11-05T00:02Z
  checked: web/src/pages/Home.tsx lines 114-136
  found: NextStep is mounted inside `<div className="mx-auto max-w-[1440px] px-6 md:px-14 ...">` (line 115). At 375px (< md 768px) horizontal padding is px-6 = 24px each side → content column = 375 - 48 = 327px, matching the tester's "column 24..351".
  implication: The 327px column figure is confirmed from the CSS; the span at 371px exceeds it by 44px (and the viewport by 20px: 24 + 371 = 395).

- timestamp: 2026-11-05T00:03Z
  checked: web/src/index.css @theme (lines 4-7) and grep for line-height
  found: `--font-serif: 'Instrument Serif', Georgia, 'Times New Roman', serif`. No line-height is set on body/html in index.css; `text-[22px]` / `text-[1.2rem]` are arbitrary font-size values, which in Tailwind v4 set only font-size (named sizes like `text-xl` also set line-height; arbitrary ones do not). Tailwind v4 preflight sets `html { line-height: 1.5 }`.
  implication: Every next-step row inherits line-height 1.5: lead row line box 22 * 1.5 = 33px (measured 33), rows 2-3 line box 19.2 * 1.5 = 28.8px (measured 28.8).

- timestamp: 2026-11-05T00:04Z
  checked: Arithmetic of the three measured heights against py-3 (0.75rem = 12px top + 12px bottom = 24px) and border-t (1px) from ROW
  found: Lead: 33 + 24 + 1 = 58 (measured 58). Start new: 28.8 + 24 + 1 = 53.8 (measured 54). Continue: 3 lines * 28.8 = 86.4 + 24 + 1 = 111.4 (measured 111); at 1440px 1 line → 53.8 (measured 54).
  implication: Nothing adds hidden height. The 58px lead row is purely the 22px font's inherited 1.5 line box plus the row's own padding and border; the 56px figure in 05-07-PLAN line 52 / UI-SPEC line 593 is 2px below what the lead row's declared font-size and line-height can ever produce (it matches the 1.2rem rows, 53.8px, with slack, but was never recomputed for the 22px row). The 111px is exactly three 28.8px lines.

- timestamp: 2026-11-05T00:05Z
  checked: The `ch` unit at 1.2rem in the span's font
  found: `ch` = advance width of "0" in the element's own font. Measured 371px / 42 = 8.83px per ch = 0.46em at 19.2px, consistent with Instrument Serif's narrow digit. Any of the declared fallbacks is wider (Times/Liberation Serif "0" = 0.50em → 403px; Georgia ≈ 0.60em → 484px). To fit 42ch inside 327px the "0" advance would have to be ≤ 0.405em, before leaving any room for "Continue " and the arrow.
  implication: 42ch at 1.2rem cannot fit a 327px column in this or any plausible serif; the cap was chosen for the wide layout (where it truncates correctly) and is simply larger than the narrow column. `max-width` in ch does not consult the containing block.

- timestamp: 2026-11-05T00:06Z
  checked: CSS line-breaking behaviour of the shipped markup
  found: Children of the Link are inline content: text "Continue ", an atomic inline-block (the span, white-space: nowrap + overflow hidden via `truncate`), text, and the inline arrow span with ml-2. An atomic inline cannot be broken across lines and its width is fixed at min(content, 42ch) = 371px. Line 1 holds "Continue " (~75px); 75 + 371 > 327 so a soft wrap occurs before the span; line 2 holds the span alone, already overflowing the line box by 44px, so the arrow (8px margin + ~7px glyph) cannot fit and breaks to line 3.
  implication: Three lines is the deterministic result of a 371px atomic inline in a 327px line box followed by one more inline item — not a font-loading race, a hover state or a responsive breakpoint.

- timestamp: 2026-11-05T00:12Z
  checked: Row repro re-run with Tailwind preflight's form-control reset (`button{font:inherit;line-height:inherit}`) so the buttons inherit `html{line-height:1.5}` as in the app
  found: lead: h=58.0 (computed line-height 33px); Start new: h=53.8 (28.8px); shipped Continue at 327px: 111.4; flex variant: 53.8. All four match the tester's 58 / 54 / 111 and the one-line target.
  implication: The 58px lead row is purely 22px x 1.5 + 24 + 1. No row element adds height. The plan's "no row exceeds 56px" (05-07-PLAN.md line 52; 05-UI-SPEC.md line 593) fits the 1.2rem rows (53.8px) and the 2px it is short of 58 is exactly the lead row's larger line box — the figure was never recomputed for the 22px lead row. Coincidentally, without the preflight reset (UA `line-height:normal` on a button) the lead row measures 56.0px, which may be where the figure came from.

- timestamp: 2026-11-05T00:13Z
  checked: Hero overflow mechanism (pre-existing, out of this gap's scope) with a static page: `display:grid` with no template (Home.tsx:139 below `lg`) holding a flex-col item whose header row (`flex items-baseline justify-between gap-6`) contains `min-w-0 > truncate` topic at 1.5rem (Home.tsx:276-282) beside a `whitespace-nowrap` count; contrast variant `grid-template-columns:minmax(0,1fr)`
  found: Implicit auto track: both hero items 1161.2px wide, H1 right edge 1185.2, topic 971.6px (its natural nowrap width), scroll container scrollWidth 1185 = 810px overflow — the tester's number exactly, with no ReactFlow present. `minmax(0,1fr)`: every item 327px, scrollWidth 375, no overflow. git blame: Home.tsx lines 139 and 276-280 are from b78b7bbb (2026-09-05), two months before 05-07's 3e12ba3 (2026-11-04).
  implication: The hero overflow is a different defect: below `lg` the hero section's single implicit `auto` track floors at the largest item's min-content, and the nowrap `truncate` topic + nowrap count at Home.tsx:280-282 (min-w-0 on their flex item does not lower the flex row's min-content contribution) make that ~1161px; the H1, the topic form and the ReactFlow pane are then laid out 1161px wide, fitView fits the graph to that pane (viewport at 1756), and the autofocused input (Home.tsx:172) scrolls the overflow-y container 52px to bring itself into view. Same class as this gap (a nowrap element whose width is not bounded by the column) but a different element, a different mechanism (grid track sizing, not a ch cap) and pre-existing.

- timestamp: 2026-11-05T00:15Z
  checked: Preflight rules in the built stylesheet web/dist/assets/index-avJu2Cn_.css
  found: `html,:host{-webkit-text-size-adjust:100%;tab-size:4;line-height:1.5;...}` and `button,input,select,optgroup,textarea{font:inherit;...}` are both present.
  implication: Every next-step row — the `<button>` lead row included — inherits line-height 1.5 from the root, which is what makes the lead row's line box 33px (tester's measurement) rather than the UA `normal`.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: (1) web/src/components/NextStep.tsx:62 bounds the quoted topic with `max-w-[42ch]` on an `inline-block truncate` span. `ch` is the advance of "0" in the span's own font — 0.460em at 1.2rem Instrument Serif = 8.826px, so 42ch = 370.7px — and `max-width` in ch never consults the containing block, so at 375px (column 375 - 2 x 24 px-6 = 327px) the span is 44px wider than the row; being an atomic inline it cannot shrink or break, so Chrome wraps before it ("Continue " alone on line 1), lets it overflow line 2 (right edge 395 > 375), and wraps the `ml-2` arrow to line 3: 3 x (19.2 x 1.5 = 28.8) + 24 (py-3) + 1 (border-t) = 111.4px. (2) The lead row (NextStep.tsx:50) is `text-[22px]` with Tailwind's preflight line-height 1.5 inherited (arbitrary text sizes set no line-height): 33 + 24 + 1 = 58px. Nothing else adds height; the plan's 56px ceiling (05-07-PLAN.md:52, 05-UI-SPEC.md:593) was derived for the 1.2rem rows (53.8px) and is 2px below what the 22px row's own declared metrics can produce.; The pre-existing 810px horizontal overflow of Home at 375px is a separate defect (Home.tsx:139 implicit auto grid track below `lg` floored by the nowrap `truncate` topic at Home.tsx:280-282; from b78b7bbb, 2026-09-05).
fix: not applied (diagnose-only). Direction: let the topic span shrink to the space the row leaves it while keeping 42ch as the ceiling — e.g. make the Continue row a baseline flex row and give the span `min-w-0` (keep `max-w-[42ch] truncate`); verified in the static repro at 53.8px / one line at 327px and 42ch-capped at 1440px. For the lead row, either accept 58px and correct the plan/spec figure (the row is as designed) or set `leading-[1.2]` per the UI-SPEC type scale (22px x 1.2 = 26.4 → 51.4px).
verification: n/a (no fix applied)
files_changed: []
