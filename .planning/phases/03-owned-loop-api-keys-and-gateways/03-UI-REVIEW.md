# Phase 3 — UI Review

**Audited:** 2026-10-12
**Baseline:** `03-UI-SPEC.md` (approved design contract, surfaces A1–A6)
**Screenshots:** captured — `.planning/ui-reviews/03-20261012-231519/` (gitignored). No dev server was running; the app was driven from `web/dist` plus a mock API for Home/Lesson, and from the real `server/dist/index.js` on a scratch `DERIVE_DATA_DIR` for Settings. Geometry was measured in headless Chrome over CDP, not eyeballed.
**Registry audit:** not applicable — no `components.json`, no shadcn, no third-party registry (UI-SPEC § Registry Safety).

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 2/4 | Every contract string is verbatim, but the new card tells a default (Claude Code) install that its tutor has no web search — which is false |
| 2. Visuals | 1/4 | The cost segment pushes the lesson's own topic to **0px** in the header at 1024px, and makes Home's rows overlap and run 219px tall at 375px |
| 3. Color | 4/4 | No new token, no hardcoded colour, cost measured at `#8d8477` (pill grey), gold confined to the reserved list |
| 4. Typography | 3/4 | No new size or weight added; card prose runs 69ch against the page's own 62ch rule, and the status line now admits unbounded provider text |
| 5. Spacing | 3/4 | Spacing vocabulary identical to `ProviderRow`; the new radio control's hit area is 23px, below the 32px rule `fields.ts` exists to enforce |
| 6. Experience Design | 2/4 | Save-as-you-go, ticks, two-step destructive and only-selected-field all correct; `native` resolves wrong on the default install, and one field lost its declared `saving` line |

**Overall: 15/24**

---

## Top 3 Priority Fixes

1. **BLOCKER — the lesson topic disappears from its own header at 1024px.** `web/src/pages/Lesson.tsx:150-170`. The h1 carries `truncate` (so `min-width:auto` resolves to 0 in the flex header) while the pill's cost span is `shrink-0 whitespace-nowrap`; the title therefore collapses to nothing before the pill yields a pixel. Measured with a *short, realistic* model id (`anthropic · claude-opus-5-5`): at 1024px the topic goes **144px → 0px** and at 1280px **374px → 221px**. A learner on a 1024px laptop sees `← ANTHROPIC · CLAUDE-OPUS-5-5 · ABOUT $0.33 ESTIMATED  PROBE—PLAN—TEACH  2/4 locked` and no lesson title at all (`lesson-header-1024.png`). This inverts the binding simplicity rule — the default UI must show the lesson. **Fix:** give the title a floor and let the model id keep absorbing the loss — `h1` gets `min-w-[8ch] flex-1 basis-0`, the pill `Link` gets `min-w-0`, so the already-truncating model span shortens before the topic reaches zero. Acceptance: at 1024px the topic renders ≥144px (its pre-phase width) with the cost still fully visible.

2. **BLOCKER — Home's lesson rows collide and bloat at 375px, the one width the phase's own argument depends on.** `web/src/pages/Home.tsx:286-301`. The cost string is 139px of a 327px content width, so the topic column drops from 212px to 58px. Measured A/B at 375px: row 1 goes 78px → **219px** tall (the topic breaks to six one-word lines); row 2's `Thermodynamics` is 125px wide in a 77px column and **overlaps the cost string by 32px** — visibly printed over `under $0.01 billed` (`home-375-list.png`). At 640px the cost still costs a row an extra line (31px → 78px). A1 is `hidden md:inline-flex` precisely because "Home is the only place a phone learner reads it" (UI-SPEC A1), and the A2 overflow check was written for 640px and 1280px only — so the designated phone surface was never checked at phone width. **Fix:** stop competing for one line below `sm`. Make the row `grid-cols-[34px_minmax(0,1fr)] sm:grid-cols-[34px_minmax(0,1fr)_auto]` and give the numbers group `col-span-2 sm:col-span-1`, so on a phone the cost and the locked count sit on their own mono line under the topic. Acceptance: at 375px no row exceeds ~90px, and no element's right edge crosses the numbers group's left edge.

3. **BLOCKER — the web-search card tells a default install something untrue.** `server/src/index.ts:444` (`native: !!nativeSearch(active.provider, active.model)`) and `server/src/drivers/adapters.ts:171-182`, where `SEARCH_TOOL['claude-code']` and `['codex']` are `null`. Observed against the real server with no keys (`active.provider = claude-code`): the card renders `OpenRouter and base-URL endpoints have no search of their own. The tutor will say when it is unsure instead of guessing. Pick Tavily or SearXNG to give it a way to check.` The Claude Code driver runs `tools: ['WebSearch', 'WebFetch']` (`server/src/agent.ts:149`) and emits the very same `Verifying with a web search` line — `server/src/tools.ts:375-379` says so outright ("a built-in `web_search` on Codex … on those surfaces the method text names those"). So the stock install is told its tutor cannot check a fact, is told the wrong providers are to blame, and is invited to paste a Tavily key that driver will never use. **Fix:** resolve `native` from whether the *active surface* supplies search (true for `claude-code` and `codex`, not only for the owned-loop rows), and make the no-search sentence name the active provider rather than hard-coding two others.

---

## Further Findings (not in the top 3, all real)

4. **WARNING — a contract-declared loading state is missing on one field.** UI-SPEC A3 `loading`: "`saving` as a mono line under a field". `KeyField` renders it (`ProviderRow.tsx:202`), `SearxngField` does not (`WebSearchCard.tsx:47-90`) — a slow save of the SearXNG address shows only `disabled:opacity-60` and no words. Two fields in one card behave differently. Fix: the same `<p className="mt-2 font-mono text-[10px] text-ink-500">saving</p>` under the branch that already tracks `saving`.
5. **WARNING — a fifth, undeclared status string carrying unbounded provider text.** `server/src/drivers/api.ts:733` emits `This model does not support ${w.feature}`. UI-SPEC A5 declares the vocabulary closed ("No learner text and no model text can ever enter a status line … there is nothing unbounded to truncate") and sizes the renderer on a 31-character maximum; `w.feature` is a free-form SDK/provider string. It is also machinery a learner cannot act on — the same reason `attempt 3 of 6` was rejected. Fix: delete it (the tool-dropping case already refuses loudly two lines above), or bound it to a mapped phrase.
6. **WARNING — `test search` is enabled with nothing to test.** `WebSearchCard.tsx:188-190`. Picking Tavily shows `Add a key to turn search on…` *and* an enabled `test search` whose only possible outcome is the server's failure sentence. Fix: `disabled={testing || !ready}` where `ready` is the same condition the missing-value note already computes.
7. **WARNING — the new control opts out of the project's own hit-area rule.** Measured: each radio input is 13×13px and its wrapping `<label>` is 23px tall. `fields.ts:28` states "The 32px hit area lives here and nowhere else", and `test search` beside it measures 32px. 23px is also under WCAG 2.2 AA target size (24px). Fix: `min-h-8 items-center` on the label — no new element, no new chrome.
8. **WARNING — two prose measures on one page.** Measured at 1280px: the page intro and the A4 prices sentence are 578px (`max-w-[62ch]`), the card's `WHY` and `NO_SEARCH` paragraphs are 646px (≈69ch). Same page, same role, two line lengths. Fix: `max-w-[62ch]` on the card's two sentences, or accept and record the card idiom.
9. **MINOR — `withHomeLink` links on any literal `Home`.** `Lesson.tsx:450-463` splits every error string on the first `Home`, so a provider's or a learner's endpoint's sentence containing that word silently becomes a link to `/`. Fix: match the refusal's trailing `from Home.` rather than the bare word.
10. **MINOR — casing drift in a refusal.** `drivers/api.ts:394` says "set web search to tavily or searxng in settings"; the card labels them `Tavily` and `SearXNG` under a `web search` eyebrow. Match the card's own words.

**Pre-existing, out of scope, recorded so a verifier is not misled:** `/lesson/:id` overflows horizontally at 768px and 1024px (`scrollWidth` 1070 vs 1024) — measured identical with and without the cost segment; the cause is the dependency-map rail, not this phase. Home's per-row delete button is hover-only (`opacity-0 group-hover:opacity-100`) with no focus-visible variant — also pre-existing.

---

## Detailed Findings

### Pillar 1: Copywriting (2/4)

Every string the contract fixes was implemented verbatim, which is unusual and worth saying:

| Contract item | Where | Verdict |
|---|---|---|
| Four label words, two-decimal floor, `under $0.01`, zero shows the label alone | `server/src/cost.ts` `LABEL`/`costLabel` | verbatim |
| Weakest-source-wins across mixed rows | `cost.ts` `weakestSource` | implemented as a total function |
| `Thinking`, `Provider busy, retrying in Ns`, `…retrying now`, no attempt counter | `drivers/api.ts:288,293,668` | verbatim |
| `Verifying with a web search`, `Reading a source` | `tools.ts:391,403`, `drivers/api.ts:685` | lifted unchanged, as required |
| Context-window refusal, em dash and all | `server/src/context.ts:37` | byte-identical to the spec |
| A3 card title, why-sentence, three labels, both provider-own sentences, placeholders, tick, `test search`, removal note | `WebSearchCard.tsx:14-35`, observed in-browser | verbatim |
| A4 prices sentence, error variant | `Settings.tsx:177-186`, observed (`2026-10-06`) | verbatim |

The score is 2 because the words being right does not make the sentence true. On a stock install the card asserts a falsehood about the learner's own tutor (finding 3), the loop added a status string the contract's vocabulary does not contain (finding 5), and one refusal names the search engines in a casing the card never uses (finding 10). A contract that fixes strings cannot catch a string shown in the wrong state; that is exactly what happened.

### Pillar 2: Visuals (1/4)

A3, A4 and A6 are visually sound — the card matches `ProviderRow`'s shell exactly (`rounded-[18px] border-ink-100/12 bg-ink-900/70 px-5 py-4 md:px-6 md:py-5`), `web search` is the fourth eyebrow after `on this machine` (observed order: `teaching now, logins, keys, on this machine, web search`), the empty state renders 0 inputs and 0 buttons, and the prices sentence is the last element with no control beside it.

A1 and A2 are where it fails, and both failures are of the same kind: a money string was given absolute priority over the thing the learner came for.

**A1, lesson header — measured, short model id `anthropic · claude-opus-5-5`:**

| viewport | pill width (no cost → cost) | lesson topic width (no cost → cost) |
|---|---|---|
| 768px | 227 → 406 | 0 → 0 (pill is `md:` and the title was already 0 here) |
| 1024px | 227 → 406 | **144px → 0px** |
| 1280px | 227 → 406 | 374px → 221px (−41%) |

With a 63-character model id the same 1024px row keeps the model span at 240px clipped and the 160px cost span unclipped — the contract's own A1 overflow clause passes — while the title is still 0. The contract reasoned about the pill's interior and never about what the pill's new 179px takes from the page. Screenshot: `lesson-header-1024.png`.

**A2, Home row — measured A/B at 375px (same data, `cost` nulled vs present):**

| row | topic column (no cost → cost) | row height | overlap |
|---|---|---|---|
| `How does TCP make an unreliable network reliable?` | 212 → 58px | 78 → 219px | topic right edge 94px vs numbers left 96px (2px clear) |
| `Thermodynamics` | 212 → 77px | 47 → 78px | topic right 147px vs numbers left 115px — **32px overlap** |
| `Why does the central limit theorem hold…` | 206 → 110px | 109 → 219px | 132px vs 148px (16px clear) |

At 640px the effect is milder but present (row 1: 31px → 78px). At 414px row 2 clears by 7px. Screenshot: `home-375-list.png`.

### Pillar 3: Color (4/4)

Nothing to fault, verified in computed styles rather than in class strings:

- Cost span colour `rgb(141,132,119)` = `--color-ink-400`, byte-equal to the pill's own; separator `rgb(61,55,48)` = `ink-600`. The prohibition on accent money holds.
- Prices sentence `rgb(106,98,87)` = `ink-500`, the declared muted-aside role; the error variant is `rust-400`.
- Saved tick `rgb(232,176,75)` = `gold-500` — on the contract's reserved-for list.
- Test result uses `moss-400` / `rust-400` exactly as `ProviderRow` does.
- `accent-ink-100` on the radios resolves to `rgb(239,233,220)`, a declared `@theme` token, so the Phase 2 "a class naming an undeclared token compiles to nothing" trap is avoided; gold stays reserved.
- Zero hardcoded hex or `rgb()` across `WebSearchCard.tsx`, `fields.ts`, `Settings.tsx`, `Lesson.tsx`, `Home.tsx`; zero new `@theme` entries.

### Pillar 4: Typography (3/4)

This phase introduced no new size and no new weight on its surfaces: only `text-[14px]`, `text-[11px]`, `text-[10px]` and the inherited `text-[22px]` serif title appear, and the only weight above 400 is `font-medium` (twice — the two card titles). `font-semibold` appears nowhere in the touched files. The pill's cost inherits `10px` mono with `letter-spacing: 1.6px` uppercase, confirmed in computed style.

Deductions: the card's two prose paragraphs render at 646px ≈ 69ch where the page's own prose rule is `max-w-[62ch]` = 578px (finding 8), and the A5 status renderer — sized by the contract against a 31-character maximum — now receives an unbounded provider string (finding 5). The status row is `flex items-center gap-2.5` with a non-`shrink-0` dot, so a long line wraps under the pulse rather than beside it.

### Pillar 5: Spacing (3/4)

The lifted vocabulary did its job. `WebSearchCard`'s spacing multiset (`mt-2` ×2, `mt-3` ×3, `gap-2` ×3, `gap-4` ×2, `px-5 py-4 md:px-6 md:py-5`) is drawn entirely from `ProviderRow`'s own (`mt-2` ×7, `mt-3` ×2, `gap-2` ×7, `gap-4`, same shell) — no parallel scale, no new arbitrary spacing value, sections at `mt-8` and cards at `gap-6` as declared. At 375px the card's three choices wrap cleanly via `flex-wrap` and the page reports no horizontal overflow (`scrollWidth === clientWidth === 375`). A 111-character address scrolls inside its field (`scrollWidth` 1217 vs `clientWidth` 313) with the card width unchanged at 696px.

One deduction: the card's primary control is a 13×13px radio in a 23px-tall label (finding 7), against the 32px floor that `fields.ts`'s own header calls the reason the module exists. The one new interactive element in the phase is the one that skipped the rule.

### Pillar 6: Experience Design (2/4)

Correct and worth keeping: save-on-blur with Enter routed through it; the 1800ms `saved · applies from the next turn` tick on both the choice and the fields; the server's sentence in `rust-400` with the typed value retained; `testing…` on a disabled 32px button; only the selected option's field rendered (observed: exactly one input per choice, zero for `the provider's own`); `KeyField` reused rather than re-derived, including the `onMouseDown`-swallowing `keep`; no new `EVENT_TYPES` entry (`useLesson.ts` byte-identical); Stop still mounted through a backoff because a retry stays `busy`; the A6 refusal reusing the existing error item with `Home` as its only affordance and no button.

Against that: `native` resolves wrong for the default driver, so the card's state machine shows the wrong branch to most installs (finding 3); the SearXNG field silently dropped the `saving` line the contract declares (finding 4); `test search` is offered when it cannot succeed (finding 6); and a status string was added outside the declared vocabulary (finding 5). One further note, informational rather than a defect: the pill's figure is read with a second `GET /api/lessons/:id` when `busy` goes false instead of from `turn_end.payload.lesson_cost`, because `useLesson.ts` was gated byte-identical. Observable behaviour matches the contract (seeded on load, replaced once, never ticking), and the wire field still exists for the terminal drivers — but the browser is now the one reader that ignores it.

---

## How This Was Verified

- `.planning/ui-reviews/.gitignore` was present and confirmed effective — `git status` shows no screenshot after capture.
- No dev server was listening (3000/5173/4310 dead; 8080 is an unrelated app). Rather than fall back to a code-only audit, `web/dist` was served with a mock API for Home and Lesson, and the real `server/dist/index.js` was run on a scratch `DERIVE_DATA_DIR` for Settings. All scratch servers and every Chrome instance started during this audit were stopped; `~/.derive` was never touched and `git status` is unchanged from the session start.
- Geometry came from `Element.getBoundingClientRect()` and computed styles over CDP at 375 / 414 / 640 / 768 / 1024 / 1280px, with A/B runs where the only difference was the `cost` field being null.
- Hover states were **not** verified: Tailwind v4 gates `hover:` behind `@media (hover:hover)` and no headless mode satisfies it. Reviewed statically instead — every `hover:` class in the touched files names a declared `@theme` token.

## Files Audited

- `web/src/components/WebSearchCard.tsx` (new)
- `web/src/components/fields.ts` (new)
- `web/src/components/ProviderRow.tsx` (`KeyField` export, lifted constants)
- `web/src/pages/Settings.tsx`
- `web/src/pages/Lesson.tsx` (pill, cost state, error card, `withHomeLink`)
- `web/src/pages/Home.tsx` (lesson row)
- `web/src/index.css` (`@theme` token check)
- `web/src/lib/types.ts`, `web/src/lib/api.ts`
- `server/src/cost.ts`, `server/src/context.ts`, `server/src/tools.ts`
- `server/src/drivers/api.ts`, `server/src/drivers/adapters.ts`, `server/src/index.ts` (`settingsView`, `searchView`, `rowView`)
- `server/src/agent.ts` (status lines, Claude Code tool set)
