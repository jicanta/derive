# Phase 02 — UI Review

**Audited:** 2026-09-30
**Baseline:** `02-UI-SPEC.md` (approved design contract, revision 1)
**Screenshots:** captured — 18 frames from a scratch server (`PORT=43211`, scratch `DERIVE_DATA_DIR`, built `web/dist` at 20:03, newer than every touched source) driven through headless Chrome over CDP; stored in `.planning/ui-reviews/02-20260930-201000/` (gitignored). No dev server was running on 3000/5173/4310; port 8080 answers FreqUI, not Derive.

Frames: `settings-desktop` (1440x900), `settings-tablet` (768x1024), `settings-mobile` (375x812), `settings-tall` (1440x2400, all ten rows), `key-set`, `key-remove-confirm`, `key-replacing`, `rescan-inflight`, `test-claude-and-ollama`, `mobile-ollama-test`, `use-codex`, `you-desktop`, `home-desktop`, `home-menu`, `lesson-external`. Each frame has a sibling `.txt` with the page's `innerText` in the scratchpad.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Every contracted string renders verbatim (intro, pills, notes, ticks, key states, refusals, Section 07, companion pill, menu sub-line); two uncontracted placeholders (`model id`, `https://…`) are harmless additions |
| 2. Visuals | 3/4 | Below `md` the header title wraps to two lines and fills the whole 60px header (`Settings.tsx:102` has no `truncate`, unlike `Lesson.tsx:115`); login and local rows leave an empty left half on desktop |
| 3. Color | 3/4 | Gold is confined to the five reserved uses, moss/rust/ink dots correct; `hover:text-rust-300` on `remove the key` (`ProviderRow.tsx:156`) names a token that does not exist in `index.css`, so the hover is dead |
| 4. Typography | 4/4 | New code uses exactly 10/14/22 px and weights 400/500 (17 × `text-[10px]`, 13 × `text-[14px]`, 1 × `text-[22px]`, 2 × `font-medium`, zero 11/12.5/13/15 px) |
| 5. Spacing | 3/4 | Card padding, 24px row gap, `mt-8` groups, `gap-2`/`md:gap-4` fields all match; `mt-3` (12px) ×4 and `mb-1.5` (6px) ×1 are off the declared 4/8/16/24/32 scale |
| 6. Experience Design | 3/4 | Loading, error, empty, disabled and inline-destructive states all verified in-browser; the seven row text buttons have no `h-8` hit area (spec minimum 32px), only `rescan` does |

**Overall: 20/24**

Registry audit: not applicable — no `components.json`, `Tool: none`, no third-party registry declared.

---

## Top 3 Priority Fixes

1. **Header title overflows the 60px header below `md`** (WARNING) — on a phone the first thing the learner sees is `Settings · which model / teaches` stacked on two lines, touching the top edge and the hairline (`settings-mobile.png`, `mobile-ollama-test.png`). — Add `truncate min-w-0` to the `<h1>` at `web/src/pages/Settings.tsx:102`, matching `Lesson.tsx:115`; `You.tsx:84` shares the defect and takes the same one-word fix.
2. **Row text buttons have no hit area** (WARNING) — `fetch models`, `test connection`, `replace`, `remove`, `keep`, `keep the current key` and `remove the key` are bare 10px mono text (~15px tall); the contract's one exception under 44px is text buttons at `h-8`. Only `rescan` (`Settings.tsx:10`) honours it. — Change `textButton` at `web/src/components/ProviderRow.tsx:7` to `inline-flex items-center h-8 font-mono text-[10px] …` and give the `remove the key` button on `:156` the same class instead of its inline copy.
3. **Dead hover token on the destructive confirm** (WARNING) — `hover:text-rust-300` (`ProviderRow.tsx:156`) generates no CSS because `index.css` defines only `rust-500` and `rust-400`, so `remove the key` has no hover feedback. — Replace with `hover:text-rust-500` (the darker rust already in the theme) or `hover:underline`; do not add a new colour token for one button.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)

Compared every row of the Copywriting Contract against the rendered `innerText` and the source.

Verbatim matches, verified in the browser:
- Intro paragraph (`Settings.tsx:113`), `teaching now` eyebrow, `claude code · default model`, source pill `detected` → `from settings` after the flip (`use-codex.png`), `rescan`.
- Group eyebrows `logins` · `keys` · `on this machine`; status pills `logged in`, `not configured`, `key set` (`key-set.png`); `teaching now` on the gold row; `Use this provider` on the other login row only, nothing on the eight unwired rows.
- Row notes: Claude Code and Codex sentences, `Teaching on {label} arrives with the next release. Keys, model lists and tests already work.` on every unwired row.
- Model lines: `default as of 2026-09-30` under every prefilled default, `Codex's own default applies` on the empty Codex field.
- Key field: `Paste a key · saved when you leave the field` → `•••• •••• 1234` with `replace · remove` → `remove the key · keep` → `Paste the new key` + `keep the current key` (`key-set.png`, `key-remove-confirm.png`, `key-replacing.png`).
- Ticks: `saved · applies from the next turn of every lesson` after `Use this provider` (`use-codex.png`); `saved · applies from the next turn` on the field paths (`ProviderRow.tsx:176, 273, 465`).
- Results: `Logged in · 181 ms` in moss on Claude Code, `nothing answered at 127.0.0.1:11434` in rust on Ollama (`test-claude-and-ollama.png`).
- Locks and errors present in source with the contract's wording: `DERIVE_BACKEND is set …` (`ProviderRow.tsx:22`, `Settings.tsx:137`), `Set by {VAR} in your environment. Unset it to store a key here.` (`:138`), `Set by DERIVE_MODEL …` (`:461`), `Removed. It stays hidden from logs and events until Derive restarts.` (`:23`), `secrets.json could not be read: … nothing here was overwritten.` (`Settings.tsx:146`), `Nothing to use yet: log in or paste a key first` (`:397`).
- `/you` Section 07: `Model`, hint verbatim, placeholder `install default: provider default` (`you-desktop.png`).
- Lesson header: `companion · claude code · terminal model` on an external lesson (`lesson-external.png`); `codex cli` label at `Lesson.tsx:31`; tutor pill title verbatim at `:120`.
- Home nav `settings` after `how you learn`; learner-menu `Settings` + `which model teaches · for everyone on this install` (`home-menu.png`).

Not in the contract (informational, no deduction): model input placeholder `model id` (`ProviderRow.tsx:442`); base URL placeholder `https://…` on the OpenAI-compatible row (`:262`). Neither contradicts a contracted string. The checker's FLAG on single-word labels (`replace`, `remove`, `rescan`, `keep`) was accepted in the spec and stands as written.

### Pillar 2: Visuals (3/4)

- **Header title wraps below `md`** — `Settings.tsx:102` `<h1 className="font-serif text-[22px] tracking-[-0.01em] text-ink-50">` with the `<em>` subtitle. At 375px the h1 becomes two lines (~60px) inside the `h-[60px]` header: the serif title sits flush against the top edge and the subtitle against the hairline (`settings-mobile.png`, `mobile-ollama-test.png`). `Lesson.tsx:115` solves the same header with `truncate`. Copied from `You.tsx:84`, which has the same defect. WARNING.
- **Empty left half on login and local rows** — the fields grid is `md:grid-cols-2` and the model field is pinned to `md:col-start-2` (`ProviderRow.tsx:433`). Rows without a key field (Claude Code, Codex, Ollama) therefore show a 40px input floating at the right with nothing on the left (`settings-desktop.png`, `settings-tall.png`). This follows the contract's "Left: key field, Right: model combobox" literally, but on the two rows that can actually teach it reads as a missing control. Recommend letting the model field take `md:col-start-1` (or `md:col-span-2`) when `row.key` is null; confirm with the owner since the contract fixes the column. Minor.
- Focal point is clear: one gold filled button per page state, one gold-tinted card, the `teaching now` line above the groups. Hierarchy through size (22/14/10) and colour (ink-100 / ink-300 / ink-500 / ink-400 pills) reads well at all three widths (`settings-tablet.png`).
- Icon-only control: only the back arrow, which carries `title="All lessons"` (`Settings.tsx:99`). `rescan` pairs its icon with text. PASS.
- Active-card tint `bg-gold-500/[0.035]` + `border-gold-500/30` is faint but discernible against the quiet cards in every desktop frame; per contract, not deducted.
- The head line wraps correctly at 375px: label + pill on one line, `Use this provider` drops to its own right-aligned line (`settings-mobile.png`), as the Responsive section specifies.

### Pillar 3: Color (3/4)

Gold usage in phase files (grep over `Settings.tsx` + `ProviderRow.tsx`): 6 occurrences, all on the reserved list —
`border-gold-500/30 bg-gold-500/[0.035]` active card (`:401`), `bg-gold-500` dot before `teaching now` (`:411`), `bg-gold-500 text-ink-950` on `Use this provider` (`:420`), `text-gold-500` tick line (`:8`), `focus:border-gold-500/60` inherited by the `field` class (`:5`). `Settings.tsx` adds no gold of its own; the tutor pill in `Lesson.tsx:118` is `text-ink-400 hover:text-ink-50` with no gold (the plan's own guard). `teal` appears nowhere in the new files. No hard-coded hex or `rgb(` in any touched file.

Dots and lines: moss for `logged in` / `key set` / `found on port N` and the `Connected` / `Logged in` results; ink-400 for `set from environment`; ink-600 for `not configured`; ink-500 with `animate-pulse motion-reduce:animate-none` for `checking` (`ProviderRow.tsx:13-20`, `Settings.tsx:124`); rust-400 for every failure sentence and the secrets-file line. Verified `Logged in · 181 ms` in moss and `nothing answered …` in rust in `test-claude-and-ollama.png`.

- **Undefined token** — `hover:text-rust-300` on the `remove the key` button (`ProviderRow.tsx:156`). `index.css` `@theme` declares `--color-rust-500` and `--color-rust-400` only, so Tailwind 4 emits nothing for this class and the hover is silently inert. WARNING (one-token fix).
- `remove` correctly turns rust on hover/focus (`hover:text-rust-400 focus-visible:text-rust-400`, `:170`); `keep` stays ink-400. PASS.

60/30/10: ink-950 page, ink-900/70 cards and inputs, hairline borders, gold on two elements per page state. The distribution holds in `settings-tall.png`: one tinted card and one filled button across ten rows.

### Pillar 4: Typography (4/4)

Sizes in `Settings.tsx` + `ProviderRow.tsx`: `text-[10px]` ×17, `text-[14px]` ×13, `text-[22px]` ×1; no `text-xs/sm/base/lg`, no 11/12.5/13/15px. Weights: `font-medium` ×2 (provider label `:403`, `Use this provider` `:420`); everything else inherits 400; the serif title is 400 with `tracking-[-0.01em]`. Mono is used exactly where the contract says: pills, eyebrows, text buttons, ticks, result lines, key hint, model and base URL inputs (`font-mono` on `:266, :446`), the teaching-now value (`Settings.tsx:120`). Inherited sizes are left alone: Home nav link takes the parent `<nav>`'s 11px (`Home.tsx:105`), the learner-menu row keeps its siblings' 13px label and 10px sub-line, Section 07 uses the existing `Section` component (`You.tsx:177-189`) with its 12.5px hint, and the `/you` input is `font-mono h-10 max-w-[320px]` as contracted (`you-desktop.png`).

Nit, not deducted: the `optional key` label (`ProviderRow.tsx:126`) is hand-rolled mono 10px `tracking-[0.16em] text-ink-500` rather than the `.eyebrow` class (0.2em, ink-400). Both are contracted meta styles; if the intent is "an eyebrow", reuse `.eyebrow`.

### Pillar 5: Spacing (3/4)

Matches the contract: card `px-5 py-4 md:px-6 md:py-5` (`ProviderRow.tsx:401`); rows `gap-6` = 24px (`Settings.tsx:148`); groups `mt-8` (`:143`); teaching-now line `mt-6 … gap-3` as written in Screen 1; fields `gap-2 md:gap-4` (`ProviderRow.tsx:431`); head line `gap-2`; pill `gap-2 px-2.5 h-6`; filled button `h-9 px-3.5`; inputs `h-10`; column `max-w-[760px] px-5 md:px-8 pt-9 pb-24`; `mt-2` (8px) under every field for its sentence ×12. Pill/button micro-spacings (`gap-1.5`, `px-2.5`, `px-3.5`) are the listed exceptions. No arbitrary `[Npx]`/`[Nrem]` spacing values in the new files.

Off the declared scale:
- `mt-3` (12px) ×4 — eyebrow-to-secrets-line and eyebrow-to-first-row (`Settings.tsx:146, 148`), head-to-fields and fields-to-actions inside the card (`ProviderRow.tsx:431, 481`). 12px is not in the token table (xs 4 · sm 8 · md 16 · lg 24 · xl 32); the contract mentions `gap-3` only for the teaching-now line. Either `mt-2` or `mt-4` is on the scale; `mt-4` reads better between head and fields.
- `mb-1.5` (6px) under `optional key` (`ProviderRow.tsx:126`); `gap-3` on the masked-hint row (`:148`). Both are inside the card and small; listed for completeness.
WARNING (minor, consistency).

### Pillar 6: Experience Design (3/4)

State coverage, verified in the browser unless noted:
- Loading: `checking` pulse on login/local rows during the pass (`Settings.tsx:28, 44`), source pill `checking` while scanning (`:94`); `rescan` → `scanning…` disabled (`:131-133`); `fetching…` / `testing…` disabled (`ProviderRow.tsx:484, 490`); key `saving` line with the input disabled (`:198, 215`); page paints stored config before the pass (`api.settings()` then `detectProviders()`, `:55-64`). The scan finished under the 700ms between click and frame, so `rescan-inflight.png` shows the settled state; the code path is straightforward.
- Error: load failure renders where the teaching-now line would be with `rescan` as retry (`Settings.tsx:128-130, 139`); secrets-file line above `keys` (`:145-147`); every field keeps the typed value and shows the server sentence (`ProviderRow.tsx:102-103, 212, 270, 462`); `Use this provider` refusal reverts optimistically-flipped rows (`Settings.tsx:81-87`) and renders under the head (`ProviderRow.tsx:428`); a route failure on test lands on the result line (`:389-390`).
- Empty: all-`not configured` fresh install reads `claude code · default model` + `detected` (`settings-desktop.png`); datalist empty until a fetch; `0 models fetched · type an id` (`:29`).
- Disabled: `Use this provider` disabled with `opacity-40` while `not configured`/`checking`, locked, or saving (`:418`); inputs disabled while saving or env-locked.
- Destructive: two-step inline `remove` → `remove the key · keep` with Escape (`:149-151, 154-163`), no `confirm()`, then the five-second `Removed.` sentence (`:115-117`). Verified in `key-remove-confirm.png`.
- Optimistic flip on `Use this provider` verified: gold card, `teaching now` pill and the teaching-now line all move to Codex before the response lands (`use-codex.png`).
- Accessibility: every input has an `aria-label` naming the provider (`:200, 263, 443`; `You.tsx:139`); result line `role="status"` + `title` + `truncate` (`:494`); text buttons `focus-visible:text-ink-50 focus-visible:underline`; `motion-reduce:animate-none` on the only animation; the `keep the current key` button swallows `mousedown` so blur-save cannot fire on the way to "do not save" (`:207`).

Gaps:
- **Text-button hit area** — the contract's exception allows text buttons at `h-8` (32px) as the floor. `Settings.tsx:10` honours it (`inline-flex items-center h-8`); `ProviderRow.tsx:7` does not, so seven buttons per page render at line height (~15px). WARNING.
- `Use this provider` explains its disabled state only through `title` (`:397, 419`); a disabled button gives no tooltip to keyboard or touch users. A one-line ink-500 note when `unusable` (or `aria-describedby` to the row's note) would cover them. Minor.
- The 360px unresolved consideration (two-line failure sentence + two-line hint on one row) could not be reproduced without sending a bad key to a real provider; the only local failure (`nothing answered …`) carries no hint. `mobile-ollama-test.png` shows the single-line case wrapping cleanly onto its own line under the buttons. Left open for the human check.

Simplicity rule: the lesson screen gained only the header pill (`Lesson.tsx:116-125`) and the companion pill's suffix; everything else is behind `/settings`. No toasts, no modals, no page-level Save on `/settings`. PASS.

---

## Files Audited

- `web/src/pages/Settings.tsx` (169 lines)
- `web/src/components/ProviderRow.tsx` (502 lines)
- `web/src/pages/You.tsx` (Section 07, `installModel`, `field` class)
- `web/src/pages/Lesson.tsx` (lines 29-33, 109-165: `driver`, `tutorLabel`, tutor pill, companion pill)
- `web/src/pages/Home.tsx` (nav, lines 102-110)
- `web/src/components/LearnerMenu.tsx` (Settings row, lines 188-195)
- `web/src/main.tsx` (`/settings` route)
- `web/src/index.css` (`@theme` tokens, `.eyebrow`, `.hairline`)
- `server/src/index.ts` (browser handoff, lines 1290-1360, to drive the capture)
- `.planning/phases/02-settings-and-secrets/02-UI-SPEC.md`, `02-CONTEXT.md`, `02-0[1-6]-PLAN.md`, `02-0[1-6]-SUMMARY.md`
