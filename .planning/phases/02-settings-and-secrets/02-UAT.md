---
status: testing
phase: 02-settings-and-secrets
source: [02-VERIFICATION.md]
started: 2026-09-30T23:14:01Z
updated: 2026-09-30T23:14:01Z
---

## Current Test

number: 1
name: Open http://localhost:4310/settings after `pnpm start` (harvested from 02-06 Task 2 human-check)
expected: |
  Ten rows in three groups (logins · keys · on this machine); on this machine Claude Code and Codex read `logged in`; the active row is gold with `teaching now`; pressing Use this provider on the other login row flips the gold row at once and shows `saved · applies from the next turn of every lesson`; typing a model id and tabbing out shows the saved tick; `rescan` reads `scanning…` briefly; the network tab is quiet afterwards (nothing polls); first paint does not wait on the scan. Then restart Derive and confirm the same provider is active on the page.
awaiting: user response

## Tests

### 1. Open http://localhost:4310/settings after `pnpm start` (harvested from 02-06 Task 2 human-check)
expected: Ten rows in three groups (logins · keys · on this machine); on this machine Claude Code and Codex read `logged in`; the active row is gold with `teaching now`; pressing Use this provider on the other login row flips the gold row at once and shows `saved · applies from the next turn of every lesson`; typing a model id and tabbing out shows the saved tick; `rescan` reads `scanning…` briefly; the network tab is quiet afterwards (nothing polls); first paint does not wait on the scan. Then restart Derive and confirm the same provider is active on the page.
result: [pending]

### 2. On /settings paste a throwaway string into the Anthropic key field and tab out; then exercise remove and replace; then start with OPENAI_API_KEY exported (harvested from 02-02 Task 2 human-check)
expected: Dots plus the last four characters appear with `replace · remove`; pressing `remove` shows `remove the key · keep`, Escape returns; pressing `remove` twice shows `Removed. It stays hidden from logs and events until Derive restarts.` for about five seconds; with OPENAI_API_KEY exported before `pnpm start` the OpenAI row shows `set from environment` and no input; the Ollama row shows a base URL input with the catalogue default as placeholder. The value is never shown again and there is no reveal toggle.
result: [pending]

### 3. With Ollama or any OpenAI-compatible server on this machine, set its base URL and press `fetch models`; press `test connection` on the Anthropic row with a wrong key; press `test connection` on Claude Code (harvested from 02-03 Task 2 human-check)
expected: The datalist offers the ids and `N models fetched` appears under the field; a 60-character id such as `qwen/qwen3-8b-instruct-q4_k_m:latest-long-tag-for-the-check` scrolls inside the 40 px input without breaking the row; on the wrong Anthropic key the result line reads `401 …` in rust on one line with the refused hint on the next line; at 360 px width the two-line sentence and two-line hint still read as one row; on Claude Code the line reads `Logged in · N ms`.
result: [pending]

### 4. Open an agent lesson after one turn; change the provider in Settings and return; open a companion lesson started from the Claude Code plugin; look at the Home nav and the learner menu (harvested from 02-04 Task 1 human-check)
expected: The muted pill beside the title reads e.g. `claude code · default model` (or the model set in Settings), links to /settings, and is hidden below 768 px like the companion pill; after a change in Settings the pill still shows the old value until the next turn, then flips; the companion lesson's pill reads `companion · claude code · terminal model` and is not a link; the Home nav shows `settings` after `how you learn`; the learner menu shows the Settings row with the sub-line `which model teaches · for everyone on this install`; a long model id truncates with the full value in the title.
result: [pending]

### 5. On /you, Section 07 Model: read the placeholder, type a model id, press Save; open the learner menu; start a plugin lesson as that learner (harvested from 02-05 Task 2 human-check)
expected: The placeholder reads `install default: …` naming the install-wide model; Save shows `saved · applies from the next message`; the learner menu's sub-line does not mention the model; a 60-character id fits the input; the plugin start message's `Derive's own tutor is set to` names that id.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
