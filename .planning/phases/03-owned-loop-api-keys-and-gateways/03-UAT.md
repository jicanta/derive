---
status: testing
phase: 03-owned-loop-api-keys-and-gateways
source: [03-VERIFICATION.md]
started: 2026-10-12T21:45:00Z
updated: 2026-10-12T21:45:00Z
---

## Current Test

number: 1
name: A whole lesson on each of a real Anthropic, OpenAI and Gemini key
expected: |
  All six stages complete on all three providers with the same tools and method text as the
  Claude Code path: graph drawn, warm-up if nodes are due, a node taught, the gate passed on a
  fresh question, the node locked, a cumulative quiz reached. The header pill reads
  `<provider> · <model> · about $X.XX estimated|billed`. On Gemini, `set_plan` actually draws
  the graph rather than returning a 400 naming a schema field — a lesson that talks but never
  plans is the tool-dropping failure this test exists to catch.
awaiting: user response

## Tests

### 1. A whole lesson on each of a real Anthropic, OpenAI and Gemini key
expected: All six stages (graph, warm-up, node teaching, understanding gate, lock, cumulative quiz) complete on all three providers with the same tools and method as the Claude Code path; the pill names the provider; Gemini draws its graph.
result: [pending]

### 2. A lesson through OpenRouter, then the usage table; and a lesson through a base URL plus key endpoint
expected: OpenRouter rows read `cost_source` = `provider` with a non-null `cost_usd` and the pill reads `billed`; the base-URL lesson completes and reads `not reported` if the endpoint sends no usage. Read with `sqlite3 ~/.derive/derive.db "select driver, model, cost_source, cost_usd from usage order by id desc limit 5;"`.
result: [pending]

### 3. Stop and resume on a real key, including a mid-card Stop and a provider change
expected: Each resume continues without a provider error about an unknown message part; `select count(*) from quiz_results where lesson_id='<id>'` is unchanged by the mid-card Stop; switching provider mid-lesson drops the history rather than sending it to the wrong provider.
result: [pending]

### 4. A real free-tier rate limit, with the countdown, Stop, a reload, the note, and a wrong key
expected: `Provider busy, retrying in Ns` counts down by whole seconds and the lesson carries on; Stop ends the turn immediately rather than waiting out the countdown; the countdown is absent from the Obsidian note and from the reload; a deliberately wrong key fails immediately in the provider's own sentence with Derive's hint on a second line.
result: [pending]

### 5. Web search and fetch on every path: native, fallback Tavily, and a SearXNG with JSON off
expected: `Verifying with a web search` and `Reading a source` appear and the `facts verified on the web` footer rises; an OpenRouter lesson with no search configured admits uncertainty rather than asserting; once a Tavily key is configured the search happens; `test search` against a SearXNG with the JSON format off names `settings.yml` in its sentence.
result: [pending]

### 6. The fifteen visual checks in a real browser (`pnpm build && pnpm start`)
expected: 03-08's seven (A1 populated/empty/loading/overflow, A2 populated/empty/overflow, A1 partial) and 03-09's eight (A3 empty/populated/loading/error/partial/long-text, destructive remove-then-keep, A4 prices sentence and its unreadable-file variant) all as written in each plan's human-check block. Hover feedback on the card's text buttons must be checked here specifically: Tailwind v4 gates `hover:` behind `@media (hover:hover)`, which no headless Chrome mode satisfies.
result: [pending]

### 7. One lesson through the Claude Code plugin and one through the Codex skills
expected: Both still work unchanged after this phase. The wire surface is frozen in `server/test/wire-surface.json` and the plugin's 22-tool MCP set and the agent surface's 14 are byte-unchanged, but no lesson was actually run.
result: [pending]

### 8. Decide PROV-08's marking in REQUIREMENTS.md
expected: Either flip PROV-08 to Complete on the strength of the stub-model parity proof, or leave it Pending until the live-key parity run in test 1 closes — and say which in the requirement's row. Its substance is implemented and behaviourally tested at stub level; its "full parity" claim is what the live-key run settles. This is an owner judgement, not a code fact.
result: [pending]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps
