---
status: partial
phase: 02-settings-and-secrets
source: [02-VERIFICATION.md]
started: 2026-09-30T23:14:01Z
updated: 2026-10-01T00:40:57Z
updated_was: 2026-09-30T23:14:01Z
---

## Current Test

number: 5
name: (all five items driven end to end in headless Chrome over CDP against scratch servers on 2026-09-30; see Gaps)
expected: |
  n/a
awaiting: owner decision on the three minor findings

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
expected: The placeholder reads `install default: …` naming the install-wide model; Save shows `saved · applies from the next message`; the learner menu's sub-line does not mention the model; a 60-character id fits the input; the plugin start message's `Derive's own tutor is set to` names that id.
result: issue
reported: "Section 07 Model: placeholder `install default: claude-opus-5-5` (the active provider's install model), Save enabled when dirty, `saved · applies from the next message`; GET /api/settings/active for this learner answered `my-own-model-id` with modelSource `learner` while the install-wide read stayed on the install model; the learner menu's own sub-line still read `tell the tutor, once, in your words` (the model is not described); the plugin start message read `Derive's own tutor is set to claude-code · qwen/qwen3-8b-instruct-q4_k_m:latest-long-tag-for-the-check` for this learner and `Claude Code in this terminal, on its own model`. NOT MET: the 59-char id does not fit the input — it scrolls (scrollWidth 520 px in a 318 px box at max-w-[320px], JetBrains Mono 14 px). Screenshots: t5-*.png"
severity: minor

## Summary

total: 5
passed: 4
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- (test 5, minor) The `/you` Section 07 input is `max-w-[320px]`; a 59-character mono id needs ~520 px, so it scrolls inside the field instead of fitting. Smallest fix: let the input take the column width (as the row model inputs on /settings do), or accept scrolling and drop the "fits" expectation from the spec.
- (test 4, minor, advisory) The header pill's `max-w-[28ch]` is applied to 10 px mono text with 0.16 em tracking, so about 24 characters fit: `claude code · claude-opus-5-5` renders as `CLAUDE CODE · CLAUDE-…` and the model id — the information the pill exists to show — is cut. The full value is in the title as specified. Smallest fix: widen to ~40ch or truncate the provider half first.
- (test 4, advisory, pre-existing) Picking Codex with its model left empty — the row's own advice — makes every turn fail on this ChatGPT login: `The 'gpt-5.4' model is not supported when using Codex with a ChatGPT account`, and Derive's hint still says `Set DERIVE_MODEL in .env … or change model in ~/.codex/config.toml`, the pre-Settings mechanism. The turn_start, pill and error rendering all behaved; the failure is Codex's default. Smallest fix: point the hint at the Codex row in Settings; consider a curated Codex default id in the catalogue.
