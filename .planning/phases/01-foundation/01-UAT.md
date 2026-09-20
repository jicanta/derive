---
status: complete
phase: 01-foundation
source: [01-VERIFICATION.md]
started: 2026-09-20T18:42:34Z
updated: 2026-09-20T18:50:04Z
---

## Current Test

[testing complete]

## Tests

### 1. HC-2 — plugin and Codex parity on a real model
expected: Run `/derive:learn` in one terminal on a real Claude Code login, and a Codex-skills lesson in another on a real ChatGPT login. Both complete as before — graph built, quiz graded, node locked, transcript mirrored. Fold in one repo import by GitHub URL; it returns normally. This is the human half of Success Criterion 1 and of FOUND-04; the machine half (wire-surface snapshot, stdio MCP smoke test, suite) is verified. WINDOWS #5, #11.
result: pass

### 2. HC-1 — the browser sign-in sequence in a real browser
expected: Open the printed `?token=` link in a real browser. The token drops out of the address bar (302), a cookie is set, and the app loads. Re-open the same link while already signed in: it redirects again and renews the cookie. Delete `~/.derive/token` with the server still running; within a second the browser is signed out and the server stays alive. Every step is driven end to end against `fetch` in the verification report — what a human adds is the address bar, the history and a real cookie jar. WINDOWS #4, #10.
result: pass

### 3. Rotation against the long-running stdio MCP server and plugin hook
expected: Rotate `~/.derive/token` while a Claude Code plugin session is live. The stdio MCP server and the plugin hook each read the token once at their own start, so both should stop authenticating until restarted — the documented cost of live revocation. Confirm it behaves as written rather than failing silently. WINDOWS #9.
result: pass

### 4. fetchPublic against an ordinary public URL
expected: With real outbound network, fetch a public URL through the library path. It returns content and the SSRF guard does not refuse a legitimate public address. There is no DNS or outbound network in the verification sandbox, so this has never been driven. WINDOWS #3.
result: pass

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
