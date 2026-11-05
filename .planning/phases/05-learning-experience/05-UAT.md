---
status: testing
phase: 05-learning-experience
source: [05-VERIFICATION.md]
started: 2026-11-05T12:30:17.968Z
updated: 2026-11-05T12:30:17.968Z
---

## Current Test

number: 1
name: Restart with a card open, then answer it
expected: |
  The restored card renders live (not disabled, no 'This question is no longer active'), with no restored badge or banner and unchanged card geometry; submitting grades it, the gold status line reads `Grading your answer` and then `Thinking` once the fresh turn starts; after a provider change the line `graded and saved · starting a fresh turn, without the earlier conversation` renders in quiet mono grey, not as a rust error card; a genuinely stale prompt still shows the shipped disabled copy.
awaiting: user response

## Tests

### 1. Restart with a card open, then answer it
steps: Restart with a card open, then answer it (05-01 E7 partial backstop, 05-03 E7 loading/error). Open a quiz in an app lesson, kill the server, restart on the same data dir, reload the browser, answer the card.
expected: The restored card renders live (not disabled, no 'This question is no longer active'), with no restored badge or banner and unchanged card geometry; submitting grades it, the gold status line reads `Grading your answer` and then `Thinking` once the fresh turn starts; after a provider change the line `graded and saved · starting a fresh turn, without the earlier conversation` renders in quiet mono grey, not as a rust error card; a genuinely stale prompt still shows the shipped disabled copy.
result: [pending]

### 2. Voice session
steps: Voice session (05-02 human-check, 05-07 language). With voice on in Chrome, listen to a long explanation; then set `prefs.language` to `español` on the You page and open a lesson.
expected: Speech starts about a sentence in; no mic flicker between sentences; mic opens after the paragraph; the next block is spoken in Spanish and dictation listens in Spanish
result: [pending]

### 3. Keyboard scheme and `?` overlay
steps: Keyboard scheme and `?` overlay (05-05 human-check). In a lesson with an open quiz press `?`, close it with `?`, open again and close with Esc; press `1` and `a`; start a teach-back and press Enter at 3 words, then at 8, and Shift+Enter in between.
expected: The overlay names exactly the keys that quiz honours (two or three digit chips matching the option count, letters beside them) with heading `Keys for this card` and footer `? or Esc to close`; both keys select the first option; Enter does nothing under eight words and submits at eight; Shift+Enter inserts a newline
result: [pending]

### 4. Focus mode
steps: Focus mode (05-05 human-check, 05-07 marker gate). Press `f` in a lesson; check the header, rail and map; press Esc; reload.
expected: Rail, map and the shared PageHeader chrome vanish; the card is centred in one column with no empty gutter on the right (the A2 measurement found the swap is required); the composer and the gold status line still work; Esc leaves; reload clears focus
result: [pending]

### 5. Atlas stability ramp and retention block
steps: Atlas stability ramp and retention block (05-04 human-check). Open the Atlas on a learner with nodes locked at different times, then a live lesson.
expected: Freshly locked nodes read pale with no halo, months-held nodes solid gold with the full halo, every label readable (claimed 4.83:1 at the faint end); the fifth legend item `held longer` wraps cleanly; the retention block reads as a third sibling in the aside rhythm; the 14-bar strip is legible; forcing the retention read to fail leaves the map, the due block and the misconceptions block rendering; the retention percentage reads neutral (not rust, not a warning) at any value; a live lesson's graph is byte-identical to before
result: [pending]

### 6. 375px lesson header backstop and the pill everywhere
steps: 375px lesson header backstop and the pill everywhere (05-07 human-check, E2 overflow backstop). Open a lesson with a long topic and at least one node due at 375px; then check Atlas, Library, You, Settings, Usage and Home's nav; then set the due count to zero.
expected: The lesson topic renders at least 64px wide; the due pill is 60px, unclipped, and the export icon and live dot stay inside the viewport; the pill is present on all six headers and Home's nav; at zero the pill disappears everywhere while Home's lead row reads `Nothing due today` at the same height as the live row; no next-step row exceeds 56px at narrow width
result: [pending]

### 7. `/derive:due` and the Codex `derive-due` skill
steps: `/derive:due` and the Codex `derive-due` skill (05-08 human-check, LEARN-03 precision backstop). In Claude Code with the plugin loaded, run `/derive:due` on a learner with at least six nodes due; compare one node's overdue figure with the Atlas due block; repeat with nothing due but a future review, and with nothing scheduled; repeat all three in a Codex terminal.
expected: `{count} nodes due for review.`, five `· label — topic (Nd overdue)` lines, `+N more.`, `Run /derive:review to start.`; the overdue figure matches the Atlas; `Nothing due today. Next review in N days.`; `Nothing due. Lock a node in a lesson and it starts coming back.`; identical wording in both terminals; the composed output reads as a read, not a nudge (no streak, goal or pressure framing)
result: [pending]

### 8. Conformance harness on a real provider
steps: Conformance harness on a real provider (SC4, 05-06 D8). Run `scripts/conformance.mjs` with at least one provider key or a local model.
expected: Every configured provider row carries four verdicts including `remediation`, all true; a false verdict exits non-zero
result: [pending]

### 9. In-turn pipelining on a real provider
steps: In-turn pipelining on a real provider (05-06 D7, SC2 narrowed prefetch clause). Run a review session with two or more nodes due.
expected: After acting on a verdict the tutor asks the next due node's question in the same turn with no summary, transition or 'shall we continue' between them
result: [pending]

### 10. Misconception distractor material
steps: Misconception distractor material (05-06 judgment-tier prohibition). Teach a node on which the learner has a recorded misconception and read the quiz the tutor writes.
expected: One option is a tempting mutation toward the past wrong claim; the question never quotes the mistake back or names it as the learner's
result: [pending]

## Summary

total: 10
passed: 0
issues: 0
pending: 10
skipped: 0
blocked: 0

## Gaps
