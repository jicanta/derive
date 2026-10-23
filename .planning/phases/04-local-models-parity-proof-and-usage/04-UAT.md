---
status: testing
phase: 04-local-models-parity-proof-and-usage
source: [04-VERIFICATION.md]
started: 2026-10-23T02:00:16Z
updated: 2026-10-23T02:00:16Z
---

## Current Test

number: 1
name: SC1 — Ollama installed, network off, a lesson that plans/quizzes/locks; then the num_ctx refusal card and its Settings link
expected: |
  A lesson runs end to end on Ollama with the network off — the graph is planned, a quiz is
  asked, a node locks — and the method does not silently degrade. Then the num_ctx refusal
  card appears with its Settings link when the context window is too small.
awaiting: user response

## Tests

### 1. SC1 — Ollama installed, network off, a lesson that plans/quizzes/locks; then the num_ctx refusal card and its Settings link
expected: A lesson runs end to end on Ollama with the network off (plan, quiz, lock) without the method silently degrading; the num_ctx refusal card and its Settings link then render. (why human: no Ollama binary on this machine)
result: [pending]

### 2. SC2 — LM Studio on 1234 and llama-server on 8081; a non-tool-use model refused and not stored; an older llama.cpp build still offered
expected: A non-tool-use model is refused and not stored; an older llama.cpp build is still offered. (why human: no lms or llama-server binary on this machine)
result: [pending]

### 3. SC3 — a real Pass line, including on the Claude Code and Codex rows while another row is active; and whether the model id beside it is the one tested (CR-02)
expected: A real Pass line appears, including on the Claude Code and Codex rows while another row is active. Also confirm the model id printed beside the Pass is the model that was actually tested — this is code-review finding CR-02, and it is the one thing to look at twice. (why human: only a real model can produce the pass line; the PROV-11 prohibition forbids faking it)
result: [pending]

### 4. SC4 — `gh workflow run conformance.yml` after merge, plus a replay whose verdicts actually held
expected: The conformance workflow dispatches after merge and a replay's verdicts hold. (why human: GitHub resolves schedule and workflow_dispatch against the default branch only)
result: [pending]

### 5. E5 — the Usage header and grand total at 375px
expected: The Usage header and grand total read correctly at a 375px viewport. (why human: a rendered-layout fact at a specific viewport)
result: [pending]

### 6. E2 render (new, from 04-06) — trigger the num_ctx refusal on a llama.cpp or LM Studio row whose model id is a long file path and look at the card
expected: The refusal sentence wraps inside roughly 62 characters — noticeably narrower than its neighbouring timeline items, which is the intended result of the locked UI-SPEC E2 contract, not a regression — the long path breaks onto the next line, there is no horizontal scrollbar, and the injected Settings link still renders underlined and still navigates.
result: [pending]

### 7. PROV-11 judgment prohibition (P3) — read `testTeaching`'s pass condition at server/src/capability.ts:794-795 and satisfy yourself that no pass can come from Derive's own plumbing
expected: The pass requires a `quiz_result` event with `result === 'correct'`, graded server-side from a quiz tool call the model itself made; no cache, no early return, no stub branch; the override seams have no route, header, env var or config file. (judgment-tier prohibition — the verifier's verdict is non-authoritative by design: holds)
result: [pending]

### 8. PROV-13 judgment prohibition (P4) — read the harness's completeness posture and satisfy yourself the report cannot read healthy by omission
expected: Every unreached provider gets an explicit skipped line with its reason (10/10 observed this round), `reliable_tool_calling: false` is recorded in the report's own run block, and the rejection counter sits at the single `validateToolInput` throw site with its error rethrown unchanged. (judgment-tier prohibition — the verifier's verdict is non-authoritative by design: holds)
result: [pending]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps
