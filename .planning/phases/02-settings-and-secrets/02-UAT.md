---
status: passed
phase: 02-settings-and-secrets
source: [02-VERIFICATION.md]
started: 2026-09-30T23:14:01Z
updated: 2026-10-01T08:45:00Z
updated_was: 2026-10-01T08:35:00Z
reverified: 2026-10-01T08:35:00Z
reverified_against: 02-07-PLAN.md
---

## Current Test

number: 5
name: (all five items driven 2026-09-30; the gaps re-driven 2026-10-01 after plan 02-07 — see Re-verification)
expected: |
  n/a
awaiting: nothing — all five settled

## Tests

### 1. Open http://localhost:4310/settings after `pnpm start` (harvested from 02-06 Task 2 human-check)
expected: Ten rows in three groups (logins · keys · on this machine); on this machine Claude Code and Codex read `logged in`; the active row is gold with `teaching now`; pressing Use this provider on the other login row flips the gold row at once and shows `saved · applies from the next turn of every lesson`; typing a model id and tabbing out shows the saved tick; `rescan` reads `scanning…` briefly; the network tab is quiet afterwards (nothing polls); first paint does not wait on the scan. Then restart Derive and confirm the same provider is active on the page.
result: pass
reported: "Driven in headless Chrome (1440x900) against a scratch server: rows painted at 122 ms with the login/local pills pulsing `checking`, the pass settled at 378 ms; three groups in order; ten rows in catalogue order; Claude Code and Codex `logged in`; a fake Ollama on 11434 read `found on port 11434`; Claude Code gold with `teaching now`; Use this provider on Codex flipped the gold row before the PUT settled and showed `saved · applies from the next turn of every lesson`; a model id tabbed out showed the tick for ~1.8 s; rescan read `scanning…` with rows `checking`; zero /api requests over 6 s idle; after killing and restarting the server Codex was still gold, the header read `codex · default model · from settings`, the model id persisted and /api/health reported `codex/settings`. 22/22 checks. Screenshots: .planning/ui-reviews/02-uat-20260930/t1-*.png"

### 2. On /settings paste a throwaway string into the Anthropic key field and tab out; then exercise remove and replace; then start with OPENAI_API_KEY exported (harvested from 02-02 Task 2 human-check)
expected: Dots plus the last four characters appear with `replace · remove`; pressing `remove` shows `remove the key · keep`, Escape returns; pressing `remove` twice shows `Removed. It stays hidden from logs and events until Derive restarts.` for about five seconds; with OPENAI_API_KEY exported before `pnpm start` the OpenAI row shows `set from environment` and no input; the Ollama row shows a base URL input with the catalogue default as placeholder. The value is never shown again and there is no reveal toggle.
result: pass
reported: "Password input with autocomplete off and the contract placeholder; after Tab `•••• •••• 5678` with `replace · remove` and the gold tick, status `key set`; the typed value absent from the page and from GET /api/settings (`{set:true,hint:'5678',locked:null}`); no reveal control; `remove` showed the inline `remove the key · keep` pair (no dialog, no confirm()); Escape returned; `replace` showed the empty `Paste the new key` input with `keep the current key`; Escape kept the stored key; `remove the key` showed the removed sentence for 4.7 s and the API answered `{set:false}`; Enter also saves; Ollama base URL input placeholder `http://127.0.0.1:11434`. On a second instance started with OPENAI_API_KEY exported the OpenAI row read `set from environment`, named the variable, had no input, and the value appeared nowhere. 30/30 checks. Screenshots: t2-*.png"

### 3. With Ollama or any OpenAI-compatible server on this machine, set its base URL and press `fetch models`; press `test connection` on the Anthropic row with a wrong key; press `test connection` on Claude Code (harvested from 02-03 Task 2 human-check)
expected: The datalist offers the ids and `N models fetched` appears under the field; a 60-character id such as `qwen/qwen3-8b-instruct-q4_k_m:latest-long-tag-for-the-check` scrolls inside the 40 px input without breaking the row; on the wrong Anthropic key the result line reads `401 …` in rust on one line with the refused hint on the next line; at 360 px width the two-line sentence and two-line hint still read as one row; on Claude Code the line reads `Logged in · N ms`.
result: pass
reported: "Ollama (fake on 11434, three ids) `fetch models` → `3 models fetched`, the datalist carried all three including the 59-char id, which scrolled inside the 40 px input without growing the row and saved with the tick; Anthropic `test connection` on a stored wrong key answered in 509 ms with `401 API key is invalid.` in rust on one truncated mono line (full text in title) and the hint `The key was refused. Paste a new key for Anthropic, or unset its environment variable…` beneath in ink-300; at 360 px nothing overflowed, the sentence stayed one line and the hint wrapped to three; Claude Code read `Logged in · 282 ms`; OpenAI with no key showed `401 Missing bearer [redacted] in header` and the field stayed typeable, a typed id saved. 19/19 checks (one harness baseline error corrected). Screenshots: t3-*.png"

### 4. Open an agent lesson after one turn; change the provider in Settings and return; open a companion lesson started from the Claude Code plugin; look at the Home nav and the learner menu (harvested from 02-04 Task 1 human-check)
expected: The muted pill beside the title reads e.g. `claude code · default model` (or the model set in Settings), links to /settings, and is hidden below 768 px like the companion pill; after a change in Settings the pill still shows the old value until the next turn, then flips; the companion lesson's pill reads `companion · claude code · terminal model` and is not a link; the Home nav shows `settings` after `how you learn`; the learner menu shows the Settings row with the sub-line `which model teaches · for everyone on this install`; a long model id truncates with the full value in the title.
result: pass
reported: "An app lesson's first turn ran on Claude Code; the lesson header showed the pill `claude code · default model` (CSS-uppercased), a Link to /settings with the explanatory title, `max-w-[28ch] truncate` and the full label in the span title, hidden at 375 px; after switching the install to Codex the pill kept the old value; the next message started a turn on Codex and the pill flipped live (no reload) to `codex · default model`; switching back and sending another message flipped it live to `claude code · claude-opus-5-5`; turn_start sequence claude-code → codex → claude-code. A companion lesson (POST /api/external/lessons, driver claude-code) showed the span `companion · claude code · terminal model`, not a link, hidden at 375 px. Home nav: `how you learn` then `settings`; the learner menu's Settings row carries `which model teaches · for everyone on this install`. 9/9 substantive checks. Two observations recorded under Gaps (pill width, Codex default model). Screenshots: t4-*.png"

### 5. On /you, Section 07 Model: read the placeholder, type a model id, press Save; open the learner menu; start a plugin lesson as that learner (harvested from 02-05 Task 2 human-check)
expected: The placeholder reads `install default: …` naming the install-wide model; Save shows `saved · applies from the next message`; the learner menu's sub-line does not mention the model; a 60-character id scrolls inside the input without breaking the row; the plugin start message's `Derive's own tutor is set to` names that id.
expected_amended: 2026-10-01 — "a 60-character id fits the input" became "scrolls inside the input without breaking the row". The original expectation was inconsistent with test 3, which accepted exactly that scrolling behaviour for a 59-char id in the /settings row inputs; /you cannot give the field 520px inside the approved 760px form without re-rhythming all seven sections. Owner accepted the scrolling behaviour on 2026-10-01.
result: pass
reverified: 2026-10-01 — the cap is gone, the input fills its column (464px) and the id scrolls inside a 40px row without breaking it; see Re-verification
reported: "Section 07 Model: placeholder `install default: claude-opus-5-5` (the active provider's install model), Save enabled when dirty, `saved · applies from the next message`; GET /api/settings/active for this learner answered `my-own-model-id` with modelSource `learner` while the install-wide read stayed on the install model; the learner menu's own sub-line still read `tell the tutor, once, in your words` (the model is not described); the plugin start message read `Derive's own tutor is set to claude-code · qwen/qwen3-8b-instruct-q4_k_m:latest-long-tag-for-the-check` for this learner and `Claude Code in this terminal, on its own model`. NOT MET: the 59-char id does not fit the input — it scrolls (scrollWidth 520 px in a 318 px box at max-w-[320px], JetBrains Mono 14 px). Screenshots: t5-*.png"
reverified_reported: "After 02-07 the cap is gone (max-width: none) and the input fills its 464px column; the 59-char id needs 520px so it scrolls inside the field, and the input height stays 40px — the row does not grow. This is the behaviour /settings has and test 3 accepted. Screenshots: .planning/ui-reviews/02-reverify-20261001/d-you-model-long-id.png, g-you-column.png"
severity: resolved

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Re-verification (2026-10-01, after plan 02-07)

Plan 02-07 applied seven one-line fixes for the findings below. All six were then re-driven in
headless Chrome over CDP against a scratch server on 4399 (`DERIVE_DATA_DIR` under `.derive/uat/`,
a fake Ollama on 11434, `web/dist` built 07:50 — newer than every touched source). **27 of 29
checks passed.** Screenshots: `.planning/ui-reviews/02-reverify-20261001/`.

Closed and measured in the browser:

- **Settings `<h1>` at 375px** — one line (33px tall against a 33px line box), header still exactly
  60px, `text-overflow: ellipsis` + `white-space: nowrap` + `min-width: 0` all computed, the title
  genuinely clipped so the ellipsis shows, and no horizontal page scroll. (UI-REVIEW fix 1)
- **`/you` `<h1>` at 375px** — same five measurements pass on the longer title
  `How you learn · read by the tutor before every lesson`. (UI-REVIEW fix 1, second site)
- **Row text buttons** — `fetch models`, `test connection`, `replace`, `remove`, `remove the key`
  and `keep` each measure exactly **32px** tall with `display: flex`; at 375px no row breaks and the
  header stays 60px. (UI-REVIEW fix 2)
- **Lesson header pill** — the contracted 29-char label `claude code · claude-opus-5-5` needs 221px
  in the pill's own type (10px mono, 0.16em tracking, uppercase) and `max-w-[40ch]` gives 241px, so
  it renders uncut; `max-w-[28ch]` is gone from the file. (UAT test 4 gap 2)
- **`/you` language input** — still capped at 320px, as intended; it was never a gap.

Closed in source, not confirmable in this harness:

- **`remove the key` hover (UI-REVIEW fix 3)** — the dead `hover:text-rust-300` is gone (zero
  `rust-300` anywhere in the bundle) and the served CSS carries
  `.hover\:text-rust-500:hover{color:var(--color-rust-500)}`, with `--color-rust-500` resolving
  in-browser to `#c9785a` while `--color-rust-300` is **undefined** — which is exactly what made the
  old token dead. The live colour change cannot be observed here: Tailwind v4 gates every `hover:`
  utility behind `@media (hover:hover)`, and headless Chrome 148 reports `(hover: hover) === false`
  in both `--headless=new` and `--headless=old`; `Emulation.setEmulatedMedia` cannot override it and
  no Xvfb is available for a headful run. This blocks **every** hover in the app, not this button, so
  it is a harness limit rather than a finding. A human on a desktop browser can confirm it in a
  second by pointing at `remove the key`.

Settled by amending the expectation (owner decision, 2026-10-01):

- **(test 5) The 59-char model id scrolls rather than fits in `/you` Section 07 — accepted.** The `max-w-[320px]` cap is
  gone and the input now fills its column, but the column is **464px** and the id needs **520px** —
  short by 58px. The `/you` form is `max-w-[760px] px-8` with
  `md:grid-cols-[200px_minmax(0,1fr)]` and `gap-x-8`, so 200 + 32 + 464 = 696px is the whole content
  width; the field column cannot reach 520px without widening the form or shrinking the 200px label
  column, which changes the rhythm of all seven sections on the page. The input height stays 40px, so
  the id **scrolls inside the field without breaking the row** — which is precisely the behaviour
  `/settings` has and which UAT test 3 accepted as correct for a 59-char id. The owner took the second
  of the two routes the gap text offered: accept the scrolling and drop the "fits" expectation, so the
  two pages behave alike and the approved layout is left intact. Test 5 is a pass on the amended
  expectation; nothing further is owed.

## Gaps

- (test 5, minor) **CLOSED by 02-07 + an amended expectation.** The `max-w-[320px]` cap is gone and the input fills its 464px column. A 59-char id needs 520px, so it scrolls inside the field — the row does not grow. The owner accepted that on 2026-10-01 rather than widen the 760px form or shrink its 200px label column, since /settings behaves the same way and test 3 already accepted it there. The "fits" wording in test 5 was amended to "scrolls without breaking the row".
- (test 4, minor, advisory) **CLOSED by 02-07** (`max-w-[40ch]`, re-measured: label needs 221px, cap gives 241px). ~~The header pill's `max-w-[28ch]`~~ is applied to 10 px mono text with 0.16 em tracking, so about 24 characters fit: `claude code · claude-opus-5-5` renders as `CLAUDE CODE · CLAUDE-…` and the model id — the information the pill exists to show — is cut. The full value is in the title as specified. Smallest fix: widen to ~40ch or truncate the provider half first.
- (test 4, advisory, pre-existing) **hint repointed by 02-07** — `friendly()` now names the Codex row in Settings instead of `DERIVE_MODEL`/`config.toml`. Codex's own refusal of its default `gpt-5.4` on a ChatGPT login is unchanged and is not Derive's to fix. ~~Picking Codex with its model left empty~~ — the row's own advice — makes every turn fail on this ChatGPT login: `The 'gpt-5.4' model is not supported when using Codex with a ChatGPT account`, and Derive's hint still says `Set DERIVE_MODEL in .env … or change model in ~/.codex/config.toml`, the pre-Settings mechanism. The turn_start, pill and error rendering all behaved; the failure is Codex's default. Smallest fix: point the hint at the Codex row in Settings; consider a curated Codex default id in the catalogue.
