---
status: diagnosed
phase: 05-learning-experience
source: [05-VERIFICATION.md]
started: 2026-11-05T12:30:17.968Z
updated: 2026-11-05T17:08:13Z
---

## Current Test

[testing paused — 1 item outstanding: test 7's Codex half needs a Codex login that accepts a model]

## Tests

### 1. Restart with a card open, then answer it
steps: Restart with a card open, then answer it (05-01 E7 partial backstop, 05-03 E7 loading/error). Open a quiz in an app lesson, kill the server, restart on the same data dir, reload the browser, answer the card.
expected: The restored card renders live (not disabled, no 'This question is no longer active'), with no restored badge or banner and unchanged card geometry; submitting grades it, the gold status line reads `Grading your answer` and then `Thinking` once the fresh turn starts; after a provider change the line `graded and saved · starting a fresh turn, without the earlier conversation` renders in quiet mono grey, not as a rust error card; a genuinely stale prompt still shows the shipped disabled copy.
result: issue
reported: "Tested in headless Chrome against a scratch server (learner 'fresh', Claude Code backend). Restored card after kill+restart: live, 3 enabled options, no 'no longer active' copy, no badge, identical rect (280,355 660x408) and class list. Answering with 1+Enter graded it and a fresh turn started within 3s; the status line read only 'Thinking' — 'Grading your answer' never rendered, because the line is gated on state.busy and no turn is running until the fresh one starts (lessonReducer 'status' case does not set busy; Lesson.tsx renders the line only when busy). Provider change (claude-code -> codex) before answering: the line 'graded and saved · starting a fresh turn, without the earlier conversation' rendered as font-mono text-[11px] text-ink-500 (rgb 106,98,87), outside any rust card; the Codex turn then failed with the pre-existing 'gpt-5.4 not supported with a ChatGPT account' refusal (not phase 05). Escape on a live open card left the shipped 'This question is no longer active. Type below to continue.' copy."
severity: minor

### 2. Voice session
steps: Voice session (05-02 human-check, 05-07 language). With voice on in Chrome, listen to a long explanation; then set `prefs.language` to `español` on the You page and open a lesson.
expected: Speech starts about a sentence in; no mic flicker between sentences; mic opens after the paragraph; the next block is spoken in Spanish and dictation listens in Spanish
result: pass

### 3. Keyboard scheme and `?` overlay
steps: Keyboard scheme and `?` overlay (05-05 human-check). In a lesson with an open quiz press `?`, close it with `?`, open again and close with Esc; press `1` and `a`; start a teach-back and press Enter at 3 words, then at 8, and Shift+Enter in between.
expected: The overlay names exactly the keys that quiz honours (two or three digit chips matching the option count, letters beside them) with heading `Keys for this card` and footer `? or Esc to close`; both keys select the first option; Enter does nothing under eight words and submits at eight; Shift+Enter inserts a newline
result: pass

### 4. Focus mode
steps: Focus mode (05-05 human-check, 05-07 marker gate). Press `f` in a lesson; check the header, rail and map; press Esc; reload.
expected: Rail, map and the shared PageHeader chrome vanish; the card is centred in one column with no empty gutter on the right (the A2 measurement found the swap is required); the composer and the gold status line still work; Esc leaves; reload clears focus
result: pass

### 5. Atlas stability ramp and retention block
steps: Atlas stability ramp and retention block (05-04 human-check). Open the Atlas on a learner with nodes locked at different times, then a live lesson.
expected: Freshly locked nodes read pale with no halo, months-held nodes solid gold with the full halo, every label readable (claimed 4.83:1 at the faint end); the fifth legend item `held longer` wraps cleanly; the retention block reads as a third sibling in the aside rhythm; the 14-bar strip is legible; forcing the retention read to fail leaves the map, the due block and the misconceptions block rendering; the retention percentage reads neutral (not rust, not a warning) at any value; a live lesson's graph is byte-identical to before
result: pass

### 6. 375px lesson header backstop and the pill everywhere
steps: 375px lesson header backstop and the pill everywhere (05-07 human-check, E2 overflow backstop). Open a lesson with a long topic and at least one node due at 375px; then check Atlas, Library, You, Settings, Usage and Home's nav; then set the due count to zero.
expected: The lesson topic renders at least 64px wide; the due pill is 60px, unclipped, and the export icon and live dot stay inside the viewport; the pill is present on all six headers and Home's nav; at zero the pill disappears everywhere while Home's lead row reads `Nothing due today` at the same height as the live row; no next-step row exceeds 56px at narrow width
result: issue
reported: "At 375px (headless Chrome, mobile emulation): lesson topic 81px wide, due pill 60x24 unclipped (right edge 273), export icon right 335 and live dot right 357 inside the viewport, header and document overflow 0. Pill present on Atlas, Library, You, Settings, Usage and Home's nav as '7 due'; at zero it disappears everywhere and Home's lead row reads 'Nothing due today' at 58px, the same as the live 'Review 7 due' row. But the E1 backstop fails: the 'Continue \"<topic>\"' row is 111px tall at 375px (the inline-block max-w-[42ch] topic span is 371px wide in a 327px column, right edge 395 > 375, so 'Continue', the topic and the arrow stack on three lines); the lead row is 58px (>56). Also observed, pre-existing: Home's scroll container has 810px of horizontal overflow at 375px (hero H1 and the ReactFlow viewport) and the autofocused topic input scrolls it 52px right on load, clipping the left edge of every row."
severity: minor

### 7. `/derive:due` and the Codex `derive-due` skill
steps: `/derive:due` and the Codex `derive-due` skill (05-08 human-check, LEARN-03 precision backstop). In Claude Code with the plugin loaded, run `/derive:due` on a learner with at least six nodes due; compare one node's overdue figure with the Atlas due block; repeat with nothing due but a future review, and with nothing scheduled; repeat all three in a Codex terminal.
expected: `{count} nodes due for review.`, five `· label — topic (Nd overdue)` lines, `+N more.`, `Run /derive:review to start.`; the overdue figure matches the Atlas; `Nothing due today. Next review in N days.`; `Nothing due. Lock a node in a lesson and it starts coming back.`; identical wording in both terminals; the composed output reads as a read, not a nudge (no streak, goal or pressure framing)
result: blocked
blocked_by: third-party
reason: "Claude Code half passed in full (claude --plugin-dir ./plugin -p against a scratch server on 4310): with 7 due the output was exactly '7 nodes due for review.', five '· label — topic (Nd overdue)' lines, '+2 more.', 'Run /derive:review to start.', and every overdue figure (20d/13d/9d/6d/4d) matched the Atlas due block rendered from the same data; the 'future' learner gave 'Nothing due today. Next review in 3 days.' and the 'empty' learner 'Nothing due. Lock a node in a lesson and it starts coming back.'; no streak, goal or pressure framing (the model prefaces the call with one line such as 'Calling the derive due tool now.'). The Codex half could not run: the bundled codex 0.155.1 binary with the learner's own ChatGPT login refuses the configured 'gpt-5.4' ('not supported when using Codex with a ChatGPT account') and every override tried (gpt-5.1-codex, gpt-5-codex, gpt-5.1, gpt-5.1-codex-mini, gpt-5) fails before the derive-due skill is reached. The skill text itself carries the same three fixed shapes as plugin/commands/due.md."

### 8. Conformance harness on a real provider
steps: Conformance harness on a real provider (SC4, 05-06 D8). Run `scripts/conformance.mjs` with at least one provider key or a local model.
expected: Every configured provider row carries four verdicts including `remediation`, all true; a false verdict exits non-zero
result: issue
reported: "Ran `pnpm conformance --logins --out <scratch>`: 10 providers, 0 passed, 0 failed, 10 skipped, exit 0. Both login rows were skipped as 'no model configured' even with --logins: chooseModel() in scripts/conformance.mjs needs row.model or row.default_model, login rows declare defaultModel null, the harness runs in a throwaway data dir so no learner setting exists, and DERIVE_MODEL is deliberately stripped — so the documented login route can never drive a row, while the app itself runs claude-code on its default model. No API key or local model exists in this environment (every key row 'no key in the environment', Ollama/LM Studio/llama.cpp not answering), so no real-provider verdicts could be observed. exitCodeFor on a false remediation verdict was already shown to return 1 by the verifier."
severity: major

### 9. In-turn pipelining on a real provider
steps: In-turn pipelining on a real provider (05-06 D7, SC2 narrowed prefetch clause). Run a review session with two or more nodes due.
expected: After acting on a verdict the tutor asks the next due node's question in the same turn with no summary, transition or 'shall we continue' between them
result: pass

### 10. Misconception distractor material
steps: Misconception distractor material (05-06 judgment-tier prohibition). Teach a node on which the learner has a recorded misconception and read the quiz the tutor writes.
expected: One option is a tempting mutation toward the past wrong claim; the question never quotes the mistake back or names it as the learner's
result: issue
reported: "Lesson with a recorded misconception on node 'grouping' ('The sum converges, because the terms vanish'), node shaky, agent mode on the Claude Code backend. Asked to teach that node, the tutor called node_status(teaching) — the server's reply carries the distractor material verbatim, verified through the external route — taught it, and wrote a check quiz on it: 'cut the harmonic series into blocks of ten consecutive terms … strongest lower bound?' with options 'Each block of ten still sums to at least one half' / 'Each block of ten sums to at least one tenth' / 'The amount guaranteed per block falls toward zero as the blocks move out' (correct). The prohibition held: nothing quoted the mistake back or named it as the learner's ('the claim that didn't land is the grouping move' is the closest). But no option is a mutation toward the recorded wrong claim (vanishing terms deciding the sum); the distractors over-generalise the doubling bound instead. One sample, one model. An earlier attempt with a generic 'teach me the next node' message had the tutor treat the lesson as new and start probing another topic — see gap G-05-1b."
severity: minor

## Summary

total: 10
passed: 5
issues: 4
pending: 0
skipped: 0
blocked: 1

## Observations

Not gaps for this phase, recorded for the owner:

- Voice, pre-existing (same effect at the phase's base commit 0315d03): with voice on, every reload of a lesson re-reads the whole prior transcript aloud (25 utterances on a two-block lesson) before the mic opens. The switch-on effect in `web/src/lib/useVoiceMode.ts` marks what is on screen as already spoken only when `enabled` changes, which at mount is before the lesson's events have loaded, so the catch-up effect then speaks everything. Worth a one-line fix in a later phase.
- Provider, pre-existing: with the Codex row active and the model left empty, a turn fails with "The 'gpt-5.4' model is not supported when using Codex with a ChatGPT account", and the hint still says "or leave it empty to use the Codex default" — the empty default is the refused model.
- `/derive:due` on the Claude Code plugin costs the subscription about $0.57–$1.02 per read in print mode (3 turns: a ToolSearch to load the tool, the call, the answer), reported by the SDK result line.
- Review-session copies rescheduled the originals as designed, so after the T9 review the due count fell from 7 to 1; the T7 run restored the dates to observe the five-line shape.
- The misconception material is looked up by (lesson, node), so it does not follow a node into a review copy; the review prompt's own 'a tempting near-miss claim' instruction is what carries there.
- Home, pre-existing (b78b7bb, 2026-09-05): below `lg` the hero section's single implicit `auto` grid track (Home.tsx:139) floors at the nowrap topic + count pair (~1161px), giving 810px of horizontal overflow at 375px; the autofocused topic input then scrolls the page 52px right. `minmax(0,1fr)` is the whole fix. Diagnosed alongside G-05-6, not part of it.
- Phase 04 record: the conformance nightly workflow (85a1596) has never been on origin/main and never run (`gh run list` 404), no report is committed, yet 04-UAT.md test 4 reads `pass`. Found while diagnosing G-05-8.

## Gaps

- gap_id: G-05-1
  truth: "After a restart, answering the restored card shows the gold status line 'Grading your answer' and then 'Thinking' once the fresh turn starts"
  status: failed
  reason: "User reported: 'Grading your answer' never renders in the restored path — Lesson.tsx renders the status line only while state.busy, the reducer's 'status' case does not set busy, and no turn is running between the answer and the fresh turn's turn_start; the learner sees the verdict and then 'Thinking'. Every other clause of the test held."
  severity: minor
  test: 1
  root_cause: "Lesson.tsx:519 renders the status line only while state.busy. On the restored path POST /api/lessons/:id/answer calls gradeRestored(), which emits quiz_result and then the ephemeral 'Grading your answer' (actions.ts:393-397) before runTurn() exists; after a restart busy() reads the empty in-memory active map so the browser holds busy:false, the reducer's case 'status' (lessonReducer.ts:125-126) sets status without touching busy, and the next event, turn_start, sets busy:true and overwrites status with 'Thinking' in the same step. Replayed through the real reducer fold: restored path renders null -> 'Thinking'; live path renders the same status event. The busy conjunct dates from Derive 0.2 and 05-03 was the first plan to emit a status outside a running turn."
  artifacts:
    - path: "web/src/pages/Lesson.tsx"
      issue: "status-line gate at :519 requires state.busy, false on the restored path until the fresh turn starts"
    - path: "web/src/lib/lessonReducer.ts"
      issue: "case 'status' (:125-126) sets status only; correct in itself, why the gate's busy conjunct decides"
    - path: "server/src/index.ts"
      issue: "restored branch (:1099-1125) grades and emits before runTurn — by design (D-26), first status ever emitted outside a turn"
  missing:
    - "Drop the `state.busy &&` conjunct from the gate at Lesson.tsx:519, leaving `state.status && !waiting` — status is already null whenever no turn runs (idle init, turn_end, every content and card event), so busy adds only this suppression"
    - "Glance at a companion (external) lesson's restored card, where no fresh turn follows: the line would then stay until the terminal's next content event nulls status"
  debug_session: .planning/debug/restored-card-grading-status.md

- gap_id: G-05-1b
  truth: "A fresh turn started without the earlier conversation (provider change, or any lost session) still knows this lesson's graph, phase and events, as restoredAnswerPrompt promises ('The lesson's graph, events and memory are in your context')"
  status: failed
  reason: "User reported: an agent lesson in teach phase with a three-node plan (one locked, one shaky) given a turn with no session and no turn_messages — the state D-04 creates on a provider change — had the tutor say 'there's a fresh graph to build' and begin probing an unrelated topic. learnerProfile() filters out the current lesson's nodes on purpose, no driver seeds a fresh session from the lesson's events, and the system prompt's volatile half is materials + library + profile only, so nothing tells a fresh turn what this lesson already is."
  severity: major
  test: 1
  root_cause: "A fresh turn's prompt carries nothing about the current lesson. The stable half is the method text; the volatile half (agent.ts:338) is materialsSection + librarySection + learnerProfile, and learnerProfile (db.ts:1738, :1754) excludes this lesson's nodes and misconceptions by design (heading 'Locked in earlier lessons'); the turn prompt is the learner's text (index.ts:976) or restoredAnswerPrompt (:1087-1097) plus notices; the Claude driver passes resume: sessionId (null = brand-new session, agent.ts:157), Codex startThread (codex.ts:75), the owned loop replays loadTurnMessages which D-04 clears (drivers/api.ts:513, 586). No function anywhere reads listNodes/listEvents/phase/goal into a prompt, so after a provider change (or any lost session) the model's only knowledge of this lesson is the learner's message — hence 'there's a fresh graph to build'. The promise is written in three places (agent.ts:304-305, driver.ts:60, index.ts:1097) and in 03-CONTEXT.md:28; those paths only ever resumed, never rebuilt."
  artifacts:
    - path: "server/src/agent.ts"
      issue: "runTurn (:275-352) builds no lesson brief; the D-04 comment at :304-305 describes a mechanism that does not exist"
    - path: "server/src/db.ts"
      issue: "learnerProfile (:1737-1777) is the only per-learner section and filters out the current lesson at :1738 and :1754"
    - path: "server/src/index.ts"
      issue: "restoredAnswerPrompt (:1097) asserts context that is not there; resumeCarries (:1071-1078) holds the fresh-turn predicate but only drives the notice copy"
    - path: "server/src/driver.ts"
      issue: "TurnContext.instructionsVolatile doc (:60) claims \"the lesson state\""
  missing:
    - "One lessonBrief(lessonId) — topic, goal, phase, one line per node (id · label · kind · status · depends_on), this lesson's unresolved misconceptions, optionally the last two or three assistant/user events trimmed — prepended to `prompt` in runTurn exactly as pending notices already are (agent.ts:314-315), only when the turn is fresh (session id null after the D-04 clear and loadTurnMessages empty) and the lesson has state; move resumeCarries next to runTurn and share it"
    - "Keep it in the turn prompt: not the profile filter (would mislabel this lesson's nodes as earlier lessons and carry no phase/goal), not the volatile half (charged every turn, uncached, when a resumed conversation already holds it); cost zero on resumed turns, ~300-800 tokens on a fresh one for a 5-12-node graph"
    - "Extend api-driver.test.ts:712 to assert the post-switch request's prompt names the lesson's nodes and phase, so the three comments become true rather than reworded"
  debug_session: .planning/debug/fresh-turn-lesson-context.md

- gap_id: G-05-6
  truth: "No next-step row on Home exceeds 56px at 375px"
  status: failed
  reason: "User reported: the 'Continue \"<topic>\"' row is 111px tall at 375px because its max-w-[42ch] inline-block topic span (371px) is wider than the 327px column, overflowing it by 20px and pushing the topic and the arrow onto further lines; the lead row is 58px. Pre-existing and out of scope but noted: Home's hero overflows horizontally at 375px and the autofocused topic input scrolls the page 52px right on load."
  severity: minor
  test: 6
  root_cause: "Two causes. Continue row: NextStep.tsx:62 bounds the quoted topic with max-w-[42ch] on an inline-block truncate span; ch is the advance width of '0' in the span's own font (Instrument Serif at 19.2px: 0.460em = 8.826px, so 42ch = 370.7px) and never consults the containing block, which at 375px is 375 - 2x24 (px-6, Home.tsx:115) = 327px; the atomic inline cannot shrink or break, so 'Continue ' sits alone on line 1, the span overflows line 2 (right edge 395 > 375) and the ml-2 arrow wraps to line 3: 3 x 28.8 + 24 (py-3) + 1 (border-t) = 111.4px. Lead row: text-[22px] emits only font-size, so the row inherits preflight's line-height 1.5 through button{font:inherit}: 33 + 24 + 1 = 58px exactly — the plan's 56px figure (05-07-PLAN.md:52, 05-UI-SPEC.md:593) fits the 1.2rem rows (53.8px) and was never recomputed for the 22px row. Reproduced statically in headless Chrome with the real faces to the decimal (371 / 395 / 111 / 58 / 54). Separately, the pre-existing 810px horizontal overflow of Home at 375px is a different defect of the same class: below lg the hero section (Home.tsx:139) has a single implicit auto track floored at the nowrap topic + count (~1161px); minmax(0,1fr) brings scrollWidth to 375; dates to b78b7bb (2026-09-05)."
  artifacts:
    - path: "web/src/components/NextStep.tsx"
      issue: ":62 max-w-[42ch] in a font-relative unit on an unshrinkable inline-block; nothing bounds it by the column"
    - path: "web/src/components/NextStep.tsx"
      issue: ":28-29, :50 ROW (block py-3 border-t) and the text-[22px] lead row whose inherited 1.5 line-height makes 58px its designed height"
    - path: ".planning/phases/05-learning-experience/05-07-PLAN.md"
      issue: ":52 (and 05-UI-SPEC.md:593) the 56px bound that does not hold for the lead row"
  missing:
    - "Let the topic shrink to the space the row leaves it while keeping 42ch as the ceiling: make the Continue Link a baseline flex row and give the span min-w-0 (keep max-w-[42ch] truncate; drop inline-block align-bottom; a flex container drops the {' '} text node, so the Continue label needs its own span or a gap) — falsification variant measured 53.8px on one line at 327px and still capped at 370.7px at 1440px"
    - "For the lead row either correct the plan/spec figure to 58px (the row is as designed) or set leading-[1.2] per the UI-SPEC type scale (~51px); no new breakpoint or component"
    - "The Home hero overflow (Home.tsx:139 implicit auto track; Home.tsx:280/:282 nowrap pair) is pre-existing and out of this gap; if taken, grid-template-columns minmax(0,1fr) below lg is the whole change"
  debug_session: .planning/debug/home-continue-row-375.md

- gap_id: G-05-8
  truth: "The conformance harness can be run on a real provider and every configured row carries four verdicts including remediation"
  status: failed
  reason: "User reported: with --logins both login rows skip as 'no model configured' (chooseModel requires row.model or default_model; login rows have neither in the harness's throwaway data dir and DERIVE_MODEL is stripped), so the only real providers available here could not be driven; no API key or local model exists in this environment either. Report: 10 providers, 0 passed, 0 failed, 10 skipped."
  severity: major
  test: 8
  root_cause: "scripts/conformance.mjs chooseModel() (:424-435) treats a null model as 'no model configured' and skips the row, but for the two login rows null is the configured state: providers.ts:74/:88 declare defaultModel null ('the provider's own default applies'), index.ts:501 fills row.model only from the install settings table, which the harness's throwaway data dir (conformance.mjs:617-619) guarantees is empty; DERIVE_MODEL is stripped (:640), there is no --model flag, prefs are unreachable, and the models endpoint refuses login rows (probe.ts:192-194). The server's own resolver (settings.ts:204-205) returns model null for exactly these rows and both login drivers run on the login's default (agent.ts:350/:155, codex.ts:67; boot line 'default model (detected)'), so the harness refuses the one state the app itself runs in. Unchanged since d42aa1b (04-04, the commit that introduced --logins) and never exercised: no committed report, no ~/.derive/conformance, the nightly workflow commit 85a1596 was never on origin/main (gh run list 404), 04/05 verifications both record no held verdict, and 04-UAT.md test 4's 'pass' has no artifact behind it. The harness's own principle ('a harness that carried its own default would report on a model nobody configured') forbids inventing an id, not running on the default the owner configured by leaving the field empty — the comment's first clause ('the one the server's own resolver would use') already describes the fix; the code reads the stored setting instead of the resolver's answer."
  artifacts:
    - path: "scripts/conformance.mjs"
      issue: "chooseModel (:424-435) skips a null model; for login rows null means the provider default"
    - path: "server/src/providers.ts"
      issue: ":74 and :88 defaultModel null on both login rows, by the catalogue's own definition"
    - path: "server/src/index.ts"
      issue: "rowView (:489-525) model comes from the settings table only (:501), empty in a throwaway data dir"
    - path: "server/src/settings.ts"
      issue: "chooseModel (:196-206) returns model null and the app runs on it — the harness is stricter than the product it measures"
  missing:
    - "In chooseModel, let a logged-in login row run with model null and report the model as the server's own answer (e.g. 'default'), which names no id and keeps the principle; keep the skip for key rows without a key and local rows with no listed model"
    - "db.ts:302/:306 already use `model IS ?` so a null-model row is findable in the rejections cell (reads '—' for login drivers)"
    - "Observation for the owner, outside this gap: 04-UAT.md test 4 recorded `pass` for a nightly that has never run"
  debug_session: .planning/debug/conformance-login-rows-skip.md

- gap_id: G-05-10
  truth: "When the tutor quizzes a node the learner holds a recorded misconception on, one option is a tempting mutation toward that past wrong claim"
  status: failed
  reason: "User reported: the server handed the material ('wrong claims this learner has actually held on it: … Mutate the correct claim toward one of these'), the prohibition held, but the quiz the tutor wrote mutated the correct claim in other directions (over-generalising the doubling bound) and no option pointed at 'vanishing terms decide the sum'. One sample on the Claude Code backend; the instruction may need to name the shape of the option it wants."
  severity: minor
  test: 10
  root_cause: "Two tiers, and the failure needs both. Deterministic (wording gap): misconceptionMaterial (actions.ts:315-322, string at :319-320) hands the recorded claim over as option material only ('Mutate the correct claim toward one of these so the tempting option is the one they would pick') and never says the next question must be one on which someone still holding that claim would answer differently, with that answer among the options; the method the model follows (method/30-quiz-options.md:4-6) fixes the question first and then mutates options under 'same skeleton' and 'unambiguously wrong', so when the chosen question is orthogonal to the claim, dropping the mutation is the method-consistent outcome. The repo already has the right sentence shape, only in the review prompt (prompt.ts:128 'a case where a tempting near-miss claim would give a different answer'), not reused here. Judgment: which question to ask and how to weigh a tool-result line against the method's option rules is the model's; in the sample it read the material (its paragraph restated the correction), spent it in prose, and chose a per-block lower-bound question the old claim does not decide. Adjacent, eliminated as causes here: the handover rides node_status(teaching|shaky) (actions.ts:514-521), two cards before the check in the standard loop; misconceptionsOn is lesson-scoped (db.ts:198-201, :1724) and buildReviewGraph copies nodes under the review lesson id, so review sessions never see the rows (and record misses under the copy's ids)."
  artifacts:
    - path: "server/src/actions.ts"
      issue: ":315-322 misconceptionMaterial acts on options and leaves the question choice unaddressed; :514-521 attached on teaching/shaky only"
    - path: "server/src/prompt.ts"
      issue: ":128 the existing phrasing of the wanted shape (review prompt), not reused in the material string"
    - path: "method/30-quiz-options.md"
      issue: ":4-6 the option rules the model honoured over the tool-result line — unchanged, per 05-06 D-23"
    - path: "server/src/db.ts"
      issue: ":198-201, :1724, :1383-1445 lesson-scoped lookup and review copies — adjacent limitation, not this gap's cause"
  missing:
    - "Reword the one string at actions.ts:319-320 only: ask a question on which someone still holding one of these claims would give a different answer, and make that answer one of the options; then the mutate-toward sentence and the unchanged prohibition"
    - "Do not move the handover (a second copy on the pretest result adds a site), do not touch method/ (D-23 keeps the rendered copies byte-stable), leave the review-scope limitation as the recorded observation"
    - "Re-read the UAT truth as 'the instruction names the shape' (verifiable by string in api.test.ts:1337-1357) plus 'the model honours it' (judgment, several samples)"
  debug_session: .planning/debug/misconception-distractor-aim.md
