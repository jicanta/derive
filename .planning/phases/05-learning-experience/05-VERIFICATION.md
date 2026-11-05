---
phase: 05-learning-experience
verified: 2026-11-05T12:21:52Z
status: human_needed
score: 151/170 must-haves verified
covered_files:
  - .planning/REQUIREMENTS.md
  - .planning/phases/05-learning-experience/05-01-PLAN.md
  - .planning/phases/05-learning-experience/05-01-SUMMARY.md
  - .planning/phases/05-learning-experience/05-02-PLAN.md
  - .planning/phases/05-learning-experience/05-02-SUMMARY.md
  - .planning/phases/05-learning-experience/05-03-PLAN.md
  - .planning/phases/05-learning-experience/05-03-SUMMARY.md
  - .planning/phases/05-learning-experience/05-04-PLAN.md
  - .planning/phases/05-learning-experience/05-04-SUMMARY.md
  - .planning/phases/05-learning-experience/05-05-PLAN.md
  - .planning/phases/05-learning-experience/05-05-SUMMARY.md
  - .planning/phases/05-learning-experience/05-06-PLAN.md
  - .planning/phases/05-learning-experience/05-06-SUMMARY.md
  - .planning/phases/05-learning-experience/05-07-PLAN.md
  - .planning/phases/05-learning-experience/05-07-SUMMARY.md
  - .planning/phases/05-learning-experience/05-08-PLAN.md
  - .planning/phases/05-learning-experience/05-08-SUMMARY.md
  - codex/skills/derive-due/SKILL.md
  - codex/skills/derive-due/agents/openai.yaml
  - plugin/commands/due.md
  - scripts/conformance.mjs
  - scripts/render-method.mjs
  - server/src/actions.ts
  - server/src/db.ts
  - server/src/index.ts
  - server/src/mcp.ts
  - server/src/migrations.ts
  - server/src/prompt.ts
  - server/src/prompts.ts
  - server/src/schedule.ts
  - server/src/tools.ts
  - server/test/api.test.ts
  - server/test/mcp.test.ts
  - server/test/migrations.test.ts
  - server/test/reducer.test.ts
  - server/test/retention.test.ts
  - server/test/schedule.test.ts
  - server/test/tx.test.ts
  - server/test/voice.test.ts
  - server/test/wire-surface.json
  - server/test/wire-surface.test.ts
  - web/src/components/AskCard.tsx
  - web/src/components/DuePill.tsx
  - web/src/components/ExplainCard.tsx
  - web/src/components/Graph.tsx
  - web/src/components/KeyHelp.tsx
  - web/src/components/NextStep.tsx
  - web/src/components/PageHeader.tsx
  - web/src/components/PlanCard.tsx
  - web/src/components/QuizCard.tsx
  - web/src/components/RetentionPanel.tsx
  - web/src/index.css
  - web/src/lib/api.ts
  - web/src/lib/htmlAttr.ts
  - web/src/lib/lessonReducer.ts
  - web/src/lib/locales.ts
  - web/src/lib/types.ts
  - web/src/lib/useLesson.ts
  - web/src/lib/useVoiceMode.ts
  - web/src/lib/voice.ts
  - web/src/pages/Atlas.tsx
  - web/src/pages/Home.tsx
  - web/src/pages/Lesson.tsx
  - web/src/pages/Library.tsx
  - web/src/pages/Settings.tsx
  - web/src/pages/Usage.tsx
  - web/src/pages/You.tsx
covered_digest: "v1:sha256:81d4889a787ce14692e21500281458738066f9b9c68fa723a77683445716f6c6"
behavior_unverified: 5
overrides_applied: 0
deferred:
  - truth: "Success Criterion 1 — the due count is visible from a literal `derive due` shell command"
    addressed_in: "Phase 7"
    evidence: "Phase 7 SC1: 'A new user runs the published package with `npx` ... and gets a working Derive'. CONTEXT D-05 locks the Phase 5 form as the `due` MCP tool surfaced as `/derive:due` plus the `derive-due` Codex skill, and defers the `derive` bin spelling to Phase 7 ('when Phase 7 adds the `derive` bin the shell spelling comes along for free'). The MCP form is delivered and verified below."
behavior_unverified_items:
  - truth: "SC2 — the learner answers every card from the keyboard (1-4 or A-D, Enter, `?` for help)"
    test: "Open a lesson with a live quiz; press `1`, then `a`; press Enter; press Shift+Enter on a fresh quiz; press `0`; press `?`"
    expected: "Both keys select the first option; Enter commits as sure; Shift+Enter commits as unsure; `0` submits I don't know; `?` opens the help overlay and never submits anything"
    why_human: "All four cards carry the handlers (QuizCard.tsx:66-87, AskCard.tsx:41-53, ExplainCard.tsx:42-57 and 79-87, PlanCard.tsx:38-45) but no test in this repo dispatches a keystroke; web/ has no test runner"
  - truth: "SC2 — the learner can enter a focus mode that shows only the current card"
    test: "In a lesson with an open card press `f`; then Esc; then reload the page"
    expected: "Outline rail, dependency map and the (now shared) page header disappear; one centred column holds the card, the tutor block above it and the composer; the `focus · esc to leave` strip shows; Esc leaves; reload lands in normal mode"
    why_human: "State, document-element attribute (`html[data-focus]`), className grid swap and the timeline filter are all present (Lesson.tsx:162-185, 233-235, 365; index.css:179; PageHeader.tsx root marker) but the rendered collapse is observable only in a browser"
  - truth: "SC5 — voice mode auto-arms the mic after a question and does not open it between sentences of a streaming block"
    test: "With voice on, listen to one long tutor explanation that ends in a question"
    expected: "Speech begins about one sentence in; the mic indicator does not flicker between sentences; the mic opens once after the paragraph's last sentence"
    why_human: "The guard is in code (useVoiceMode.ts:117-124 `streamingRef.current` check, plus the streaming true->false edge effect at 240-250) but `speechSynthesis`/`SpeechRecognition` are absent headless and no test exercises the hook"
  - truth: "05-02 — the tutor starts speaking about a sentence into a streaming block rather than after the whole paragraph"
    test: "Same session as above; note when the first utterance begins relative to the streamed text"
    expected: "First sentence is spoken while the block is still arriving"
    why_human: "Timing of a speech engine; the splitter's idempotence is unit-tested (voice.test.ts 'says each sentence exactly once as a block grows') but latency is not observable without a browser with TTS"
  - truth: "05-02 — the microphone does not open between two sentences of a block that is still streaming"
    test: "Covered by the voice session above"
    expected: "No mic activation between sentences"
    why_human: "Same as above; this is also the 05-02 test-tier prohibition that has no wired test (flagged below)"
human_verification:
  - test: "Restart with a card open, then answer it (05-01 E7 partial backstop, 05-03 E7 loading/error). Open a quiz in an app lesson, kill the server, restart on the same data dir, reload the browser, answer the card."
    expected: "The restored card renders live (not disabled, no 'This question is no longer active'), with no restored badge or banner and unchanged card geometry; submitting grades it, the gold status line reads `Grading your answer` and then `Thinking` once the fresh turn starts; after a provider change the line `graded and saved · starting a fresh turn, without the earlier conversation` renders in quiet mono grey, not as a rust error card; a genuinely stale prompt still shows the shipped disabled copy."
    why_human: "Server half is tested end to end (api.test.ts 'is still open ... after a respawn' and 'grades it with the live card's own code ... and starts a fresh turn'); the browser rendering of `activePromptId` (Lesson.tsx:117-132) and the notice treatment (judgment-tier prohibition, 05-03) have no renderer in CI"
  - test: "Voice session (05-02 human-check, 05-07 language). With voice on in Chrome, listen to a long explanation; then set `prefs.language` to `español` on the You page and open a lesson."
    expected: "Speech starts about a sentence in; no mic flicker between sentences; mic opens after the paragraph; the next block is spoken in Spanish and dictation listens in Spanish"
    why_human: "No headless mode has `speechSynthesis` or `SpeechRecognition`; `localeOf` is unit-tested and Lesson.tsx:60 wires it, but the audible result needs a browser with a Spanish voice. Also carries the 05-02 test-tier prohibition (mic must not open while streaming) which has a code guard but no wired test."
  - test: "Keyboard scheme and `?` overlay (05-05 human-check). In a lesson with an open quiz press `?`, close it with `?`, open again and close with Esc; press `1` and `a`; start a teach-back and press Enter at 3 words, then at 8, and Shift+Enter in between."
    expected: "The overlay names exactly the keys that quiz honours (two or three digit chips matching the option count, letters beside them) with heading `Keys for this card` and footer `? or Esc to close`; both keys select the first option; Enter does nothing under eight words and submits at eight; Shift+Enter inserts a newline"
    why_human: "Handlers and copy are present (KeyHelp.tsx; ExplainCard.tsx:24-25 floor inside send()); keystroke behaviour in a real browser is not driven by any test"
  - test: "Focus mode (05-05 human-check, 05-07 marker gate). Press `f` in a lesson; check the header, rail and map; press Esc; reload."
    expected: "Rail, map and the shared PageHeader chrome vanish; the card is centred in one column with no empty gutter on the right (the A2 measurement found the swap is required); the composer and the gold status line still work; Esc leaves; reload clears focus"
    why_human: "The marker now lives on the shared `PageHeader` root three files from the CSS rule; whether the lesson header actually disappears after the 05-07 extraction is observable only in a browser"
  - test: "Atlas stability ramp and retention block (05-04 human-check). Open the Atlas on a learner with nodes locked at different times, then a live lesson."
    expected: "Freshly locked nodes read pale with no halo, months-held nodes solid gold with the full halo, every label readable (claimed 4.83:1 at the faint end); the fifth legend item `held longer` wraps cleanly; the retention block reads as a third sibling in the aside rhythm; the 14-bar strip is legible; forcing the retention read to fail leaves the map, the due block and the misconceptions block rendering; the retention percentage reads neutral (not rust, not a warning) at any value; a live lesson's graph is byte-identical to before"
    why_human: "Ramp math is in code (Graph.tsx:91-97) and the figures are unit-tested (retention.test.ts, 12 cases) but colour, contrast and rhythm are visual; the 05-04 judgment-tier prohibition (true retention never a verdict) needs a human reading"
  - test: "375px lesson header backstop and the pill everywhere (05-07 human-check, E2 overflow backstop). Open a lesson with a long topic and at least one node due at 375px; then check Atlas, Library, You, Settings, Usage and Home's nav; then set the due count to zero."
    expected: "The lesson topic renders at least 64px wide; the due pill is 60px, unclipped, and the export icon and live dot stay inside the viewport; the pill is present on all six headers and Home's nav; at zero the pill disappears everywhere while Home's lead row reads `Nothing due today` at the same height as the live row; no next-step row exceeds 56px at narrow width"
    why_human: "The plan declared this a held-out measurement (backstop). The SUMMARY records a headless-Chrome measurement (81px, 0px overflow) but that is a SUMMARY claim, not evidence this verifier produced"
  - test: "`/derive:due` and the Codex `derive-due` skill (05-08 human-check, LEARN-03 precision backstop). In Claude Code with the plugin loaded, run `/derive:due` on a learner with at least six nodes due; compare one node's overdue figure with the Atlas due block; repeat with nothing due but a future review, and with nothing scheduled; repeat all three in a Codex terminal."
    expected: "`{count} nodes due for review.`, five `· label — topic (Nd overdue)` lines, `+N more.`, `Run /derive:review to start.`; the overdue figure matches the Atlas; `Nothing due today. Next review in N days.`; `Nothing due. Lock a node in a lesson and it starts coming back.`; identical wording in both terminals; the composed output reads as a read, not a nudge (no streak, goal or pressure framing)"
    why_human: "The handler is served (mcp.test.ts spawns the stdio server and lists 23 tools) and `overdueOf` (mcp.ts:197-201) is textually the same floor-of-days rule as `overdue()` (Atlas.tsx:231-235), but the backstop asks for the rendered comparison, and the tone of model-composed output is the 05-07/05-08 judgment-tier prohibition"
  - test: "Conformance harness on a real provider (SC4, 05-06 D8). Run `scripts/conformance.mjs` with at least one provider key or a local model."
    expected: "Every configured provider row carries four verdicts including `remediation`, all true; a false verdict exits non-zero"
    why_human: "No provider key or local model exists in this environment; the harness skips every row and exits 0. `exitCodeFor([{verdicts:{...remediation:false}}])` was run here and returns 1, and the fourth verdict column is present (conformance.mjs:519-577), but 'still passes on every provider' is a runtime claim only a keyed run can make"
  - test: "In-turn pipelining on a real provider (05-06 D7, SC2 narrowed prefetch clause). Run a review session with two or more nodes due."
    expected: "After acting on a verdict the tutor asks the next due node's question in the same turn with no summary, transition or 'shall we continue' between them"
    why_human: "Both turn prompts carry the instruction (prompt.ts:83, 133; api.test.ts 'asks the next due question inside the same turn'), but whether a model obeys it is a property of the model"
  - test: "Misconception distractor material (05-06 judgment-tier prohibition). Teach a node on which the learner has a recorded misconception and read the quiz the tutor writes."
    expected: "One option is a tempting mutation toward the past wrong claim; the question never quotes the mistake back or names it as the learner's"
    why_human: "The material string carries its own instruction (actions.ts:315-322 'Never quote a past mistake back at them and never name it as theirs') and is asserted by test; the generated copy is not observable without a model"
---

# Phase 5: Learning Experience Verification Report

**Phase Goal:** The tutor carries the workflow: the learner opens Derive and is told what to do next, answers from the keyboard, sees honest progress, gets sharper remediation, and never waits on a dead card.
**Verified:** 2026-11-05T12:21:52Z
**Status:** human_needed
**Re-verification:** No — initial verification

## How this was verified

- Started from the five ROADMAP Success Criteria (split into 16 clauses so each half of a compound criterion is judged on its own) and merged the `must_haves.truths` of all eight PLAN files (154 plan truths) and their `prohibitions` (10). Nothing was taken on the word of a SUMMARY: every truth below cites a source line, a named test observed passing in this verifier's own run, or is routed to human verification.
- `pnpm typecheck` exit 0 (server and web). The full server suite was run once from `server/` (`node --import tsx --test test/*.test.ts`): 565 tests, 140 suites, 565 pass, 0 fail, 0 skipped. All 30 named tests cited in the SUMMARYs were found as `ok` lines in that saved output.
- `gsd query verify.artifacts` passed 37/37 artifacts across the eight plans. `verify.key-links` reported 23/25; the two misses are regex artifacts and were traced manually as WIRED (below).
- All 21 task commits named in the SUMMARYs resolve in `git log`. The working tree has no uncommitted source changes.
- No probes are declared or present (`scripts/*/tests/probe-*.sh` absent); Step 7c not applicable.
- `05-REVIEW.md` was not read, per the owner's standing decision that advisory review findings never block verification.

**Mode note (informational, not a gap):** ROADMAP marks this phase `Mode: mvp`, but the goal is not a User Story sentence (`user-story.validate` returns `valid: false`). The orchestrator directed verification against the five concrete Success Criteria, which is what was done. If MVP-mode User-Flow-Coverage reporting is wanted, the goal needs rewriting via `/gsd mvp-phase 5`.

## Goal Achievement

### Observable Truths — ROADMAP Success Criteria (the contract)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| SC1a | Home opens on "Review N due / Continue / Start new", review first, nothing else competing | ✓ VERIFIED | `Home.tsx:136` mounts `<NextStep>` between masthead and hero under `stats && lessons.length > 0`; `NextStep.tsx:48-70` renders lead (`Review {due} due` or quiet `Nothing due today`), continue, `Start new` in fixed order. Hero kept below per CONTEXT D-01 (locked by the owner as the reading of "nothing competing"). |
| SC1b | Due count visible on every page | ✓ VERIFIED | `PageHeader.tsx` renders `<DuePill>` in its right slot; all six pages (`Lesson`, `Atlas`, `Library`, `You`, `Settings`, `Usage`) mount `<PageHeader` once and none keeps the old `h-[60px] border-b hairline shrink-0` shell; `Home.tsx:130` puts the pill in the nav. `DuePill.tsx` has no `hidden md:` prefix, returns null only at zero/unknown. Count comes from `/api/stats` (`dueNodes`) or `atlas.due.length` — same server read. |
| SC1c | Due count from `derive due` | ✓ VERIFIED (D-05 form) | `tools.ts:484-492` `due` entry, `surfaces: ['mcp']`, no label; `mcp.ts:302-317` handler reads `/api/review` and `/api/retention`; `mcp.test.ts` spawns the stdio server and asserts 23 tools incl. `due`; `plugin/commands/due.md` and `codex/skills/derive-due/SKILL.md` exist with identical locked strings. Literal shell spelling `derive due` is deferred to Phase 7 (see Deferred). |
| SC2a | Learner answers every card from the keyboard (1-4 or A-D, Enter, `?` help) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Present and wired: `QuizCard.tsx:72` `/^[1-3]$/` and `/^[a-c]$/` to the same index, Enter/Shift+Enter, `0`; `AskCard.tsx:42-46` `/^[1-4]$/`, `/^[a-d]$/`, Enter; `ExplainCard.tsx:49, 83` Enter in and out of field with Shift+Enter falling through; `PlanCard.tsx:38` Enter; `?` owned by `Lesson.tsx:230`. No test dispatches a keystroke. Routed to human. |
| SC2b | Learner can enter a focus mode that shows only the current card | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `Lesson.tsx:37` state, `:162-173` filter to card + one tutor block, `:181-185` `setHtmlAttr('data-focus')` via helper, `:365` grid swap, `:366/:555` and `PageHeader.tsx` root carry `data-focus-hide`; `index.css:179` is the one rule. Rendered collapse unexercised. Routed to human. |
| SC2c | Streaming status (thinking, calling quiz, grading) | ✓ VERIFIED | `Thinking` emitted in `agent.ts:204` and `drivers/api.ts:727`; tool labels from `TOOL_LABELS`; `Grading your answer` emitted once inside `gradeQuiz` after the verdict (`actions.ts:397`); tests `emits the grading status line from the grading path, and never as a tool label` and `still hides the status line while a card is open and unanswered` pass; gate `state.busy && state.status && !waiting` at `Lesson.tsx:519`. |
| SC2d | Next card prefetched (narrowed by ROADMAP Plans paragraph to in-turn pipelining) | ✓ VERIFIED (as narrowed) | `prompt.ts:83` (warm-up) and `:133` (review) both instruct "ask the next due node's question in the same turn, with nothing between the verdict and that question"; test `asks the next due question inside the same turn, in both the review and the warm-up prompt` passes. Model obedience is a human item. |
| SC3a | Honest retention stats from FSRS (estimated knowledge, true vs desired, forecast) | ✓ VERIFIED | `db.ts:1515` `retention()` with `n.stability IS NOT NULL AND n.difficulty IS NOT NULL` (:361), `source_lesson IS NULL`, `scratch = 0`, 90-day window, floor 10; `schedule.ts:27` `REQUEST_RETENTION = 0.9` fed to the scheduler; `index.ts:1393` `GET /api/retention` over `learnerOf(c)`; `api.ts:93`; `RetentionPanel.tsx` renders all four plus the 14-bar forecast; `retention.test.ts` 12 cases incl. `withholds the percentage under ten first tries`, `excludes a locked node with no FSRS state`, `always returns fourteen days`. |
| SC3b | Atlas coloured by memory stability | ✓ VERIFIED | `Graph.tsx:91-97` `stabilityRamp` (`log1p(days)/log1p(180)`, `color-mix` fill/border/glow), applied only when `status === 'locked' && !due && stability != null` (:108); `Atlas.tsx:44` passes `stability: n.stability`; `lessonReducer.ts`/`useLesson.ts` contain no `stability` (in-lesson graph unchanged); legend item `held longer` at `Atlas.tsx:212`. Visual read is a human item. |
| SC4a | On a failed quiz the tutor names and re-quizzes the weakest prerequisite | ✓ VERIFIED | `schedule.ts:135` pure `weakestFirst`; `actions.ts:324-332` `nameWeakest` names one label+id and opens the gate; `:271-289` refusal in the shipped shape ending `This is the method, not an error to investigate.`; gate exits in `gradeQuiz` (:380, :423) and `index.ts:955`. Eight `api.test.ts` cases pass (`names exactly one prerequisite on an ordinary failed check`, `refuses a quiz on another node`, `accepts a fresh quiz on the node it named`, `lifts the gate from inside the one grading function`, `names one prerequisite when a node is marked shaky, and the learner's own message lifts it`, `keeps the shipped ground-truth instruction`...) plus six `schedule.test.ts` cases. `the weakest of those` is gone from comment-stripped source. |
| SC4b | Distractors draw on the learner's recorded misconceptions | ✓ VERIFIED | `db.ts:198/1724` `misconceptionsOn` lesson+node scoped, no `resolved ASC` demotion; `actions.ts:315-322` `misconceptionMaterial` on the `teaching` and `shaky` results (:514-519, merged not overwritten). Tests `hands the learner's own recorded wrong claim over when the node is marked as being taught` and `merges the material into the shaky branch's own instruction rather than over it` pass. `method/` untouched. |
| SC4c | Warm-up and cumulative quiz are named in the UI | ✓ VERIFIED | Tests `keeps the warm-up eyebrow and its reason` and `keeps the cumulative, review and pre-explanation headings and the three what-it-tests labels` pass (D-24 verified, not rebuilt). |
| SC4d | The conformance harness still passes on every provider | ? UNCERTAIN | Fourth verdict present (`conformance.mjs:519-577`, `remediation` column, `remediationStep`); `exitCodeFor` run here returns 1 on a false verdict and 0 when all hold. No provider key or local model is available and no conformance report is committed, so a real-provider pass cannot be observed. Routed to human / nightly. |
| SC5a | Voice auto-arms the mic after a question (not between sentences) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `useVoiceMode.ts:117-124` arms only when `!isSpeaking() && !streamingRef.current`; edge effect at :240-250. No test exercises the hook (headless has no speech APIs). Routed to human. |
| SC5b | Speaks in sentence chunks | ✓ VERIFIED | `voice.ts:107-136` `sentences(text, from)` with the 24-char floor and abbreviation/decimal/initialism suppression; `useVoiceMode.ts:185-189` per-item offset map (`Map<string, number>`) feeds `sentences()`; the `it.streaming` skip is gone. `voice.test.ts` five splitter cases incl. `says each sentence exactly once as a block grows` pass. |
| SC5c | In the learner's language | ✓ VERIFIED | `locales.ts` pure table (no imports, no I/O), `localeOf` tested (`resolves an English name, an endonym, and the same endonym shouted and padded`, `returns null for a name it does not know`); `Lesson.tsx:60` resolves `prefs.language` from the one `api.stats()` call and passes `lang: spokenLang` (:147); `useVoiceMode.ts:148` `setVoiceLang(lang ?? null)`; `voice.ts:170-173` resets the memoised voice; `voiceLang()` read by both `speak` (:186) and `listen` (:238). |
| SC5d | Open cards persisted and rehydrated; no dead card after restart | ✓ VERIFIED | Migration 11 `prompts` (`migrations.ts:373-417`); `prompts.ts` table-backed with `live` Map holding only resolvers (:39); `index.ts:332` `lessonView.pending = {id, kind, held}`; `:1104-1127` answer route grades a restored card from the row and starts a fresh turn (agent lessons only); `Lesson.tsx:124` prefers `state.pending.id`. Tests `is still open, with its id and its kind, after a respawn on the same data dir`, `refuses a second card ... after the restart`, `grades it with the live card's own code, writes the schedule and the misconception, and starts a fresh turn`, `leaves no prompt row behind a deleted lesson or a deleted learner`, `pins LATEST_VERSION` all pass. |

**SC score:** 12/16 clauses verified (3 present-behaviour-unverified, 1 uncertain).

### Observable Truths — Plan must_haves (grouped by plan)

Evidence column cites what this verifier read or ran. "H" marks an item that also appears in Human Verification.

**05-01 — prompts table and the restored card (10 truths)**

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Card still open after kill/respawn; `GET /api/lessons/:id` returns id and kind | ✓ VERIFIED | Test `is still open, with its id and its kind, after a respawn` (two boots, one dataDir) |
| 2 | Restored card renders active in the browser with no turn in flight | ? UNCERTAIN (H) | `Lesson.tsx:117-132` prefers `state.pending.id` while `unanswered()`; `disabled={id !== activePromptId}`. No renderer in CI |
| 3 | `busy` means a turn is running | ✓ VERIFIED | `index.ts` comment-stripped has no `hasPending`; test asserts `busy === false` after respawn |
| 4 | One-card-open 409 decided by the table | ✓ VERIFIED | `index.ts:1621-1623` reads `pendingPrompt(id)`; test `refuses a second card ... after the restart` |
| 5 | Row holds the key; no response/event/export carries `correct`/`explanation`/`rubric` pre-commit | ✓ VERIFIED | `prompts.ts:56` key goes into the row via `redactDeep`; `openPrompt`'s emit unchanged; wire scan in the restart test |
| 6 | Deleting a lesson/learner deletes prompt rows in the same transaction | ✓ VERIFIED | `db.ts:615` inside `deleteLesson` tx; learner delete loops lessons; `tx.test.ts` `leaves no prompt row behind...` |
| 7 | Existing DB migrates to user_version 11 with snapshot | ✓ VERIFIED | `migrations.ts:373` version 11; `migrations.test.ts:224-225` pins `LATEST_VERSION`; snapshot suite in that file |
| 8 | E7 empty: rehydrated card identical to a fresh one | ? UNCERTAIN (H) | No badge/banner code path exists in `Lesson.tsx`; rendering needs eyes |
| 9 | E7 long-text: card geometry unchanged | ? UNCERTAIN (H) | Card components untouched geometrically; rendering needs eyes |
| 10 | E7 partial (backstop): restored card renders active and submitting it grades | ? UNCERTAIN (H) | Backstop — server half tested (`grades it with the live card's own code...`); browser half abstained per `verification: backstop` |

**05-02 — voice in sentences, in the learner's language (8 truths)**

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Speaking starts about a sentence into a streaming block | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED (H) | Hook reads streaming items (`useVoiceMode.ts:185-189`); timing unobservable headless |
| 2 | Same block never spoken twice | ✓ VERIFIED | Per-item offset `Map<string, number>` (:51); test `says each sentence exactly once as a block grows` |
| 3 | Only up to the last complete boundary is spoken | ✓ VERIFIED | `sentences()` returns `{complete, next}`; test `returns nothing for a trailing fragment, and consumes none of it` |
| 4 | Mic does not open between sentences of a streaming block | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED (H) | Guard `useVoiceMode.ts:124`; no test (also the flagged test-tier prohibition) |
| 5 | `Spanish`/`español`/`Brazilian Portuguese` resolve; unknown falls back to `navigator.language` | ✓ VERIFIED | `locales.ts:42-47`; `voice.ts:35` fallback chain; tests `resolves an English name...`, `keeps a regional variant distinct`, `returns null...` |
| 6 | `locales.ts` is pure data, no I/O, no import-time side effect | ✓ VERIFIED | File has zero `import` lines, no `fetch`/`localStorage`/`navigator`; imported by `voice.test.ts` under plain node |
| 7 | Changing voice language invalidates the memoised voice | ✓ VERIFIED | `voice.ts:170-173` `voice = undefined` inside `setVoiceLang` |
| 8 | `voice.test.ts` runs under the shipped runner, no new dependency | ✓ VERIFIED | Present in the 565-test run; `package.json` unchanged for deps |

**05-03 — a restored card is answerable; grading line; reducer (14 truths)**

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Restored card graded like a live one (quiz_result, quiz row, FSRS write, misconception) | ✓ VERIFIED | `index.ts:996-1016` `gradeRestored` → `actions.gradeQuiz`; test `grades it with the live card's own code, writes the schedule and the misconception, and starts a fresh turn` |
| 2 | A fresh turn starts with the grading result as input, resumed where allowed | ✓ VERIFIED | `index.ts:1118-1123` `runTurn(id, restoredAnswerPrompt(...))` for agent lessons; `resumeCarries` mirrors 03 D-04; same test asserts a turn started |
| 3 | 409 only when genuinely no row | ✓ VERIFIED | `index.ts:1104-1116`; second-answer half of the test asserts 409 with the exact sentence |
| 4 | One grading path for live and restore | ✓ VERIFIED | `actions.ts:354` `openQuiz` → `gradeQuiz`; `index.ts:1025` `graderFor` → `gradeQuiz` |
| 5 | `Grading your answer` on screen between submit and verdict | ✓ VERIFIED | Emit at `actions.ts:397` after `quiz_result`; gate `Lesson.tsx:519`; tests `emits the grading status line...`, `still hides the status line...` (restore-path `Thinking` nuance is item H1) |
| 6 | Ephemeral seq -1; no EVENT_TYPES entry, no reducer branch, no stored event, no mirror | ✓ VERIFIED | `emitEphemeral`; `EVENT_TYPES` has no grading entry; reducer test ephemeral non-persistence; `export.ts` unchanged |
| 7 | Not a `TOOL_LABELS` entry | ✓ VERIFIED | `tools.ts` unchanged for labels; `wire-surface.test.ts` label-set snapshot passes |
| 8 | Unresumable history shows the quiet notice line, not a rust card | ✓ VERIFIED (render H) | `index.ts:1121` emits `notice`; `Lesson.tsx:486` renders in mono grey; reducer test `becomes a notice item carrying its text, and nothing else` |
| 9 | Stale prompt shows the shipped disabled copy verbatim | ✓ VERIFIED | `QuizCard.tsx:181`, `AskCard.tsx:68` `This question is no longer active. Type below to continue.` |
| 10 | E7 loading: learner never looks at a settled screen that is secretly working | ? UNCERTAIN (H) | Sequencing nuance recorded in SUMMARY; needs eyes |
| 11 | E7 error: quiet notice vs rust; stale copy verbatim | ? UNCERTAIN (H) | Judgment-tier prohibition; copy present |
| 12 | E8 overflow: status line is one line from a closed vocabulary | ✓ VERIFIED | Only `TOOL_LABELS`, `Thinking`, `Grading your answer` reach `status` |
| 13 | E8 long-text: no learner/model string reaches the status line | ✓ VERIFIED | Same |
| 14 | `applyEvent`/`apply`/`EVENT_TYPES` React-free; EVENT_TYPES pinned against the server | ✓ VERIFIED | `lessonReducer.ts` has no `react` import; `EVENT_TYPES` (:279-282) includes `notice`; tests `lists every event type the server can send...` and `lists nothing the server cannot send...` |

**05-04 — honest retention and the stability-tinted Atlas (24 truths)**

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Third aside block after Misconceptions, before legend; no new route/nav | ✓ VERIFIED | `Atlas.tsx:199` `<RetentionPanel />` before the legend at :202; no router change |
| 2 | Estimated knowledge = sum of retrievability over locked nodes, caption `about {k} of {n}...` | ✓ VERIFIED | `db.ts:1515+`; `RetentionPanel.tsx:62`; retention tests |
| 3 | Locked node with no FSRS state excluded from numerator and denominator | ✓ VERIFIED | `db.ts:361`; test `excludes a locked node with no FSRS state from BOTH...` |
| 4 | True retention = first review-purpose row per (lesson,node) in 90 days | ✓ VERIFIED | `RETENTION_WINDOW_DAYS = 90` (:1458); first-per-key dedup; tests |
| 5 | Desired renders `target 90%` from the scheduler constant | ✓ VERIFIED | `schedule.ts:27,30`; `RetentionPanel.tsx:69` |
| 6 | Review copies excluded from every read | ✓ VERIFIED | `source_lesson IS NULL` on :360, :373, :378 |
| 7 | Scoped to `learnerOf`, never a body learner | ✓ VERIFIED | `index.ts:1393` |
| 8 | True retention never coloured as a verdict | ✓ VERIFIED (judgment H) | `RetentionPanel.tsx:68` `text-ink-100` at every value; rust appears once (:47, error line) |
| 9 | <10 samples → `not enough reviews yet`, target suffix stays | ✓ VERIFIED | `db.ts:1555` null under floor; `RetentionPanel.tsx:68-69`; test `withholds the percentage under ten first tries` |
| 10 | Locked gold deepens with stability; text holds 4.5:1 | ✓ VERIFIED (contrast H) | `Graph.tsx:91-97`; contrast claim is visual |
| 11 | Due/shaky/teaching/pending unchanged; one legend line added | ✓ VERIFIED | Ramp only on `locked && !due` (:108); `held longer` legend (:212) |
| 12 | Optional `stability` on `Data`; Atlas passes, in-lesson never; absent vs 0 distinct | ✓ VERIFIED | `Graph.tsx:27,34,108,115`; `Atlas.tsx:44`; 0 hits for `stability` in `useLesson.ts`/`lessonReducer.ts` |
| 13 | E3 empty: no locked nodes → block absent; all-zero fortnight → 14 stubs + caption | ✓ VERIFIED | `RetentionPanel.tsx:53` `return null` when `locked === 0`; `:90` stub class; `:101` `nothing due in the next 14 days` |
| 14 | E3 loading: map and shipped blocks never blocked on the read | ✓ VERIFIED | Panel owns its fetch (`:34-36`) |
| 15 | E3 error: scoped copy inside the block only | ✓ VERIFIED (render H) | `:47` exact copy; own error state `string | null` |
| 16 | E3 populated: block rhythm | ? UNCERTAIN (H) | Visual |
| 17 | E3 partial: only the percentage is replaced | ✓ VERIFIED | `:68-71` |
| 18 | E3 overflow: 286px strip in 296px | ✓ VERIFIED (visual H) | `w-[13px]` + `gap-2` × 14 = 286 |
| 19 | E3 zero-one-many: singularisation | ✓ VERIFIED | `plural()` helper at `:101` |
| 20 | E3 long-text: fixed templates over numbers | ✓ VERIFIED | No learner strings in the component |
| 21 | E4 empty: absent keeps shipped classes and animation; 0 is the faint end | ✓ VERIFIED | `Graph.tsx:115` ternary; `stability != null` check |
| 22 | E4 populated: all channels from one `t`; 4.83:1 | ? UNCERTAIN (H) | One `t` drives fill/border/glow (:92-97); contrast unmeasured here |
| 23 | E4 overflow: tint changes colour only | ✓ VERIFIED | Inline style only; clamp untouched |
| 24 | E4 long-text: clamp and hover unchanged | ✓ VERIFIED | Same |

**05-05 — keyboard scheme, `?` overlay, focus mode (36 truths)**

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | One scheme: digit and letter same slot, Enter, Shift+Enter unsure, 0 idk, `?` help | ✓ VERIFIED (behaviour H) | `QuizCard.tsx:71-82`; no `?` branch in any card; `Lesson.tsx:230` |
| 2 | Teach-back Enter past 8 words, Shift+Enter newline; plan Enter | ✓ VERIFIED (H) | `ExplainCard.tsx:24-25, 49, 83`; `PlanCard.tsx:38` |
| 3 | `?` overlay names only working keys; closes on `?`/Esc; never submits idk | ✓ VERIFIED (H) | `KeyHelp.tsx:28-45` rows from kind+count; `Lesson.tsx:230-239` |
| 4 | No key bound to two actions | ✓ VERIFIED | Comment-stripped cards have no `? for I don't know`; QuizCard handles `0` only |
| 5 | Digit/letter positional and identical | ✓ VERIFIED | `Number(k)-1` vs `charCodeAt-97` to the same `idx` |
| 6 | Chip count tracks option count | ✓ VERIFIED | `KeyHelp.tsx:28-29`; AskCard comment :103 |
| 7 | Eight-word floor inside `send()` | ✓ VERIFIED | `ExplainCard.tsx:25` first line of `send` |
| 8 | `f` toggles focus hiding rail, map, header chrome; keeps card, prose, composer; one column | ✓ VERIFIED (H) | `Lesson.tsx:233-235, 162-173, 365`; markers :366, :555, `PageHeader` root |
| 9 | Session-only: no storage, endpoint, migration | ✓ VERIFIED | `htmlAttr.ts` has no storage; cleanup removes attribute (`Lesson.tsx:184`) |
| 10 | Valueless `data-focus` via one helper | ✓ VERIFIED | `setHtmlAttr('data-focus')`; `htmlAttr.ts` |
| 11 | Marker travels with the header; three markers while inline, header's moves to PageHeader | ✓ VERIFIED | `index.css:179` descendant selector; `PageHeader.tsx` root carries it; `Lesson.tsx` keeps 2 |
| 12 | Esc order: overlay, then focus, then stop | ✓ VERIFIED | `Lesson.tsx:236-247` single chain calling `stop()` |
| 13 | LEARN-02 adjacency resolved: `?` help, `0` idk | ✓ VERIFIED | QuizCard title `:213` and button title `:206` |
| 14 | LEARN-02 empty: zero-option card commits; no digit chips | ✓ VERIFIED | Ask/Plan/Explain rows show help chip only |
| 15 | LEARN-02 ordering stable | ✓ VERIFIED | Index derivation above |
| 16 | E5 empty: `f`/`Esc` rows, heading `Keys` | ✓ VERIFIED | `KeyHelp.tsx:64` |
| 17 | E5 populated: rows from kind and count | ✓ VERIFIED | `:28-45` |
| 18 | E5 partial: exact digit count mirrored by letters | ✓ VERIFIED | `:28-30` |
| 19 | E5 overflow: at most six rows, no scroll | ✓ VERIFIED | No `overflow`/`scroll` class in `KeyHelp.tsx` |
| 20 | E5 zero-one-many: floor two rows, ceiling six | ✓ VERIFIED | Row tables per kind |
| 21 | E5 long-text: fixed copy only | ✓ VERIFIED | Only `options` (a number) is variable |
| 22 | E6 empty: last tutor block + composer; else quiet line | ✓ VERIFIED | `Lesson.tsx:166-171, 381` |
| 23 | E6 loading: status line still shows in focus | ✓ VERIFIED | Gate at `:519` is inside the surviving column |
| 24 | E6 populated: centred single column | ? UNCERTAIN (H) | Visual (A2 measured by executor, not here) |
| 25 | E6 partial: card alone with no placeholder line | ✓ VERIFIED | `:172` returns `[timeline[at]]`; quiet line only when `focused.length === 0` |
| 26 | E6 overflow: one 680px column | ✓ VERIFIED | Grid swap `:365` |
| 27 | E6 zero-one-many: exactly one card | ✓ VERIFIED | Filter by `activePromptId` |
| 28 | E6 long-text: block scrolls, not clamped | ✓ VERIFIED | No clamp added |
| 29 | E9 empty: no digit chips on option-less card | ✓ VERIFIED | Ask/Plan/Explain rows |
| 30 | E9 error: quiz title rewritten; idk button titled `0` | ✓ VERIFIED | `QuizCard.tsx:206, 213` |
| 31 | E9 populated: chip vocabulary | ✓ VERIFIED | `:222` |
| 32 | E9 partial: word count + `say a little more` | ✓ VERIFIED | `ExplainCard.tsx:97` |
| 33 | E9 overflow: hint rows hidden below `sm` | ✓ VERIFIED | `hidden sm:inline` `:213` |
| 34 | E9 zero-one-many: chip count tracks options | ✓ VERIFIED | Same as 6 |
| 35 | E9 long-text: fixed strings | ✓ VERIFIED | Only the word counter varies |
| 36 | Retained lint-suppression comment on all four cards | ✓ VERIFIED | `exhaustive-deps` present in all four |

**05-06 — one prerequisite, named and enforced (15 truths)**

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Failed quiz names exactly one prerequisite `re-check "<label>" [<id>] ... tests "intuition"` | ✓ VERIFIED | `actions.ts:329`; test `names exactly one prerequisite on an ordinary failed check, which named none` |
| 2 | All three miss paths name one | ✓ VERIFIED | `:147` (afterQuiz), `:186` (cumulative), `:516` (shaky); three tests |
| 3 | Quiz on another node refused in the shipped shape ending with the fixed clause | ✓ VERIFIED | `:271-289`; `index.ts:1634` returns 400; test `refuses a quiz on another node in the shipped shape, ending in the fixed clause` |
| 4 | Lifts on graded fresh quiz or any learner message | ✓ VERIFIED | `:380` (steer), `:423` (graded), `index.ts:955`; tests `accepts a fresh quiz on the node it named...`, `...the learner's own message lifts it` |
| 5 | `weakestFirst` ranks direct deps: retrievability, miss, status | ✓ VERIFIED | `schedule.ts:114-135`; six `schedule.test.ts` cases |
| 6 | `weakestFirst` is pure, no I/O | ✓ VERIFIED | Only `import type { NodeRow }` from db |
| 7 | No-dependency node keeps ground-truth instruction, opens no gate | ✓ VERIFIED | `GROUND_TRUTH_STEP` (:220); `nameWeakest` returns null; test `keeps the shipped ground-truth instruction...` |
| 8 | Misconceptions on the tool result (teaching and remediation) with the mutate line | ✓ VERIFIED | `:315-322, 514`; tests |
| 9 | Rides the instruction channel; no new tool/method text | ✓ VERIFIED | `method/` untouched; no registry change for it |
| 10 | Merged into an existing instruction, not overwriting | ✓ VERIFIED | Test `merges the material into the shaky branch's own instruction rather than over it` |
| 11 | Review/warm-up ask the next due question in the same turn | ✓ VERIFIED (model H) | `prompt.ts:83, 133`; test |
| 12 | Fourth conformance verdict; non-zero exit on any false verdict | ✓ VERIFIED (real run H) | `conformance.mjs:87-89, 519-577`; `exitCodeFor` false → 1 observed here |
| 13 | Warm-up and cumulative naming verified, not rebuilt | ✓ VERIFIED | Two tests |
| 14 | LEARN-09 empty: no deps → ground truth; one dep → that one | ✓ VERIFIED | Tests incl. `returns the one dependency there is, and an empty order for none` |
| 15 | LEARN-09 encoding: exact string equality within the lesson | ✓ VERIFIED | `:255, :274` `===` comparisons; `getNode(lessonId, ...)` |

**05-07 — shared header, due pill, Home next step (33 truths)**

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | One header component used by all six pages | ✓ VERIFIED | `<PageHeader` once per page; zero old shells |
| 2 | Home's nav carries the same pill | ✓ VERIFIED | `Home.tsx:130` |
| 3 | Pill visible at every width on all seven surfaces | ✓ VERIFIED (375px H) | `DuePill.tsx` no `hidden md:`; `shrink-0 whitespace-nowrap` |
| 4 | Pill grey, not teal | ✓ VERIFIED | `fields.ts:25` `pill` is `text-ink-400` |
| 5 | Title floor + zero basis; pills shrink | ✓ VERIFIED | `PageHeader.tsx` `min-w-[8ch] flex-1 basis-0`; `min-w-0` on cost/companion pills |
| 6 | Lesson pill in the always-visible group | ✓ VERIFIED | `Lesson.tsx:297` inside `flex items-center gap-4 sm:gap-5`, not the `hidden md:block` group |
| 7 | Shared header does not absorb lesson extras | ✓ VERIFIED | PhaseBar, locked count, voice, export, dot are `right` children |
| 8 | Root carries `data-focus-hide` | ✓ VERIFIED | `PageHeader.tsx` `<header data-focus-hide ...>` |
| 9 | Marker unconditional, inert elsewhere | ✓ VERIFIED | No prop; rule keyed on `html[data-focus]` |
| 10 | Learner menu optional, not on Lesson/Atlas | ✓ VERIFIED | 0 `LearnerMenu` in both |
| 11 | Back link accessible name from target | ✓ VERIFIED | `BACK` table; `aria-label={back}` |
| 12 | Next-step block above the hero, fixed order, hero unchanged | ✓ VERIFIED | `Home.tsx:136`; hero section follows; `Or start from one of these` and footer `nothing due today` still present |
| 13 | No lessons → block absent | ✓ VERIFIED | `lessons.length > 0` condition |
| 14 | Nothing due → quiet line, same box, not a control | ✓ VERIFIED | `NextStep.tsx:55` `<div>` on `QUIET` (`cursor-default`, no focus ring) |
| 15 | Review leads every day | ✓ VERIFIED | First row always lead variant |
| 16 | One stats call serves pill and voice language | ✓ VERIFIED | `api.stats()` appears once in `Lesson.tsx` (:56) |
| 17 | `prefs.language` reaches voice as a resolved tag | ✓ VERIFIED | `Lesson.tsx:60`, `:147`; hook consumes tag (`useVoiceMode.ts:34-35, 148`) |
| 18 | LEARN-03 boundary: 0 → absent; 1 singular; >1 plural | ✓ VERIFIED | `DuePill.tsx:30, 34` |
| 19 | E1 empty | ✓ VERIFIED | As 13 |
| 20 | E1 loading: mounts when both reads are in hand | ✓ VERIFIED | `stats && lessons.length > 0` |
| 21 | E1 error: failed read leaves block unrendered, page works | ✓ VERIFIED | `Home.tsx:44` `.catch(() => undefined)` |
| 22 | E1 populated: three rows fixed order | ✓ VERIFIED | `NextStep.tsx:48-71` |
| 23 | E1 partial: `No lesson in progress` quiet variant | ✓ VERIFIED | `:66` |
| 24 | E1 overflow: single column; no row > 56px at narrow width | ? UNCERTAIN (H) | Single column by construction; height unmeasured |
| 25 | E1 zero-one-many | ✓ VERIFIED | `Review {due} due`; second row has no plural |
| 26 | E1 long-text: topic truncates in `max-w-[42ch]` | ✓ VERIFIED | `:62` |
| 27 | E2 empty: nothing at zero; nothing-due said on Home and Atlas | ✓ VERIFIED | `DuePill` null; `NextStep` quiet; `Atlas.tsx:168` |
| 28 | E2 loading: absent until known | ✓ VERIFIED | `!due` → null covers undefined |
| 29 | E2 error: failed count → no pill | ✓ VERIFIED | Pages swallow stats failure; `due` stays null |
| 30 | E2 populated: grey small-caps mono, ~64px | ? UNCERTAIN (H) | Class string verified; width unmeasured here |
| 31 | E2 zero-one-many titles | ✓ VERIFIED | `:34` |
| 32 | E2 long-text: no shrink/wrap; title absorbs | ✓ VERIFIED | `shrink-0 whitespace-nowrap`; title `basis-0` |
| 33 | E2 overflow (backstop): at 375px topic ≥ 64px and pill unclipped | ? UNCERTAIN (H) | Backstop — SUMMARY reports a headless measurement (81px, 0 overflow); not reproduced here |

**05-08 — `derive due` in both terminals (14 truths)**

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | A learner in Claude Code or Codex can ask what is due | ✓ VERIFIED (terminal H) | Tool served (`mcp.test.ts` 23 tools, `due` in `MCP_TOOLS_BEFORE`); command and skill files exist |
| 2 | `due` is one MCP-only registry entry | ✓ VERIFIED | `tools.ts:491` `surfaces: ['mcp']`; `wire-surface.json` api surface lacks `due` |
| 3 | No status label | ✓ VERIFIED | No `label` on the entry; label-set snapshot test passes |
| 4 | Projection regenerated and committed | ✓ VERIFIED | `wire-surface.json` lists 23 mcp tools incl. `due` |
| 5 | learn/review allowed-tools byte-identical; `due` excluded | ✓ VERIFIED | `render-method.mjs:98, 102`; 0 hits for `derive__due` in both files |
| 6 | Renderer pin moved with the registry | ✓ VERIFIED | `render-method.mjs:179` `names.length !== 23` |
| 7 | Plugin-set assertion widened deliberately with reason | ✓ VERIFIED | `mcp.test.ts:36-47` comment and `'due'` entry |
| 8 | `/derive:due` one hand-written tool; not a render target | ✓ VERIFIED | `due.md` `allowed-tools: mcp__plugin_derive_derive__due, WebSearch, WebFetch, Skill`; 0 hits for `due.md` in the renderer |
| 9 | Codex sibling has no method region | ✓ VERIFIED | No `method:begin` in `SKILL.md`; `openai.yaml` declares the `derive` MCP dependency |
| 10 | Due state: count, ≤5 lines, truncation, next step | ✓ VERIFIED (H) | Strings in both files; handler returns `count/nodes/more/next_review` (`mcp.ts:311-317`) |
| 11 | Nothing-due states distinguished | ✓ VERIFIED | `next_review` null vs phrase (`mcp.ts:316`) |
| 12 | Both terminals say the same thing | ✓ VERIFIED | Three locked strings present verbatim in both files |
| 13 | Read scoped to the server-resolved learner; unknown falls back to default | ✓ VERIFIED | `index.ts:293-297` `learnerOf` → `findLearner` → `DEFAULT_LEARNER_ID` |
| 14 | LEARN-03 precision (backstop): overdue/next-review are floored whole days matching the Atlas | ? UNCERTAIN (H) | `mcp.ts:197-201` and `Atlas.tsx:231-235` are textually the same rule (`Math.floor(ms / 86_400_000)`, `today` / `{d}d overdue`); backstop asks for the rendered comparison |

**Score:** 151/170 truths verified (5 present, behaviour-unverified; 14 uncertain, routed to human). No truth FAILED.

### Prohibitions (must-NOT)

| Plan | Statement (abridged) | Tier | Disposition |
| --- | --- | --- | --- |
| 05-01 | Answer key / rubric must not reach any response, event, export or mirror before commit | test | ✓ VERIFIED — enforced by the wire scan in `api.test.ts` restart case; `openPrompt`'s emit unchanged; key lives only in the row |
| 05-02 | Voice must not open the mic while the block is still streaming | test | **unverified-prohibition — human review recommended.** Code guard present (`useVoiceMode.ts:124`) but no wired test exercises it (headless has no speech APIs). Fail-closed per the test-tier rule; carried in Human Verification item 2 |
| 05-03 | A fresh turn from a restored card must not be presented as an error | judgment | Non-authoritative LLM-judge: `notice` renders in `font-mono text-[11px] text-ink-500`, not the rust card — holds. Human resolution in item 1 |
| 05-04 | True retention must not be a pass/fail verdict | judgment | Non-authoritative LLM-judge: `text-ink-100` at every value, no corrective copy — holds. Human resolution in item 5 |
| 05-04 | A figure under its sample threshold must not print as a confident number | test | ✓ VERIFIED — `retention.test.ts` `withholds the percentage under ten first tries...` |
| 05-05 | No hint row, title or overlay may advertise a key the card no longer honours | test | ✓ VERIFIED by direct inspection — comment-stripped cards contain no `? for I don't know`; QuizCard title names `0` and `?`; the teach-back row omits `?` deliberately. Note: enforcement is the plan's grep gate, not a committed regression test (informational) |
| 05-06 | The remediation gate must not block the learner | test | ✓ VERIFIED — `api.test.ts` `...the learner's own message lifts it` (message exit with nothing graded) |
| 05-06 | A misconception-derived distractor must not quote the mistake back | judgment | Non-authoritative LLM-judge: the material string instructs exactly this (`actions.ts:320`) — holds at the instruction level; generated copy needs a human (item 10) |
| 05-07 | Due count and next-step block must not nag or use streak/guilt framing | judgment | Non-authoritative LLM-judge: pill is grey and informational; NextStep copy is `Review N due` / `Nothing due today` — holds. Human resolution in item 7 |
| 05-08 | Terminal due read must not nag or pressure | judgment | Non-authoritative LLM-judge: negative grep (`streak|daily goal|don.t lose|keep it up|notification`) is 0 in both files and both carry an explicit no-nudge instruction — holds. Human resolution in item 7 |

### Deferred Items

| # | Item | Addressed In | Evidence |
| --- | --- | --- | --- |
| 1 | The literal `derive due` shell spelling (SC1, LEARN-03) | Phase 7 | Phase 7 SC1 delivers the published `npx` package; CONTEXT D-05 explicitly defers the `derive` bin to Phase 7 and locks `/derive:due` + the Codex skill as the Phase 5 form, which is delivered and verified |

### Required Artifacts

`gsd query verify.artifacts` returned `all_passed: true` for all eight plans (37/37). Level 2/3/4 checks on the new files:

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `server/src/migrations.ts` | Migration 11 `prompts` + index | ✓ VERIFIED | `version: 11` (:373), bare `CREATE TABLE prompts` (:405), `CREATE INDEX prompts_lesson` (:417) |
| `server/src/prompts.ts` | Table-backed registry, six shipped exports | ✓ VERIFIED | Exports intact; `live` Map holds resolvers only; `promptPayload`/`settledAnswer`/`isLivePrompt` added |
| `server/src/db.ts` | Prompt statements, cascade, `retention`, `misconceptionsOn` | ✓ VERIFIED | All present and called from `index.ts`/`actions.ts` |
| `web/src/lib/lessonReducer.ts` | React-free reducer | ✓ VERIFIED | No `react` import; re-exported by `useLesson.ts`; imported by `reducer.test.ts` |
| `web/src/lib/locales.ts` | Pure data + `localeOf` | ✓ VERIFIED | 106 lines, 21 languages, zero imports; used by `Lesson.tsx` |
| `web/src/components/RetentionPanel.tsx` | Third Atlas block | ✓ VERIFIED, data FLOWING | Fetches `api.retention()`; mounted in `Atlas.tsx:199`; renders server figures only |
| `web/src/components/KeyHelp.tsx` | `?` overlay | ✓ VERIFIED | Dialog semantics, focus move/return (:18-26), Tab trap, rows from kind+count; mounted once (`Lesson.tsx:587`) |
| `web/src/lib/htmlAttr.ts` | Guarded document-element seam | ✓ VERIFIED | `setHtmlAttr`/`removeHtmlAttr`, no storage; used by `Lesson.tsx` |
| `web/src/components/PageHeader.tsx` | Shared header | ✓ VERIFIED | Used by six pages; root marker; title floor; derived back-link name |
| `web/src/components/DuePill.tsx` | Due capsule | ✓ VERIFIED, data FLOWING | Composes `pill` from `fields.ts`; fed by `/api/stats` on every page |
| `web/src/components/NextStep.tsx` | Three-row block | ✓ VERIFIED, data FLOWING | Fed by `stats.due` and `lessons` on Home |
| `server/src/tools.ts` / `server/src/mcp.ts` | `due` entry + handler | ✓ VERIFIED | Registration loop serves it; handler proxies two learner-scoped routes |
| `plugin/commands/due.md`, `codex/skills/derive-due/*` | Terminal surfaces | ✓ VERIFIED | Present, locked strings identical |
| `server/test/{voice,reducer,retention}.test.ts` | New gates | ✓ VERIFIED | All in the 565-test run |

### Key Link Verification

`verify.key-links`: 23/25 matched by pattern. The two misses, traced manually:

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `web/src/components/RetentionPanel.tsx` | `web/src/lib/api.ts` | `api.retention()` | WIRED | Call is split across lines (`api` at :35, `.retention()` at :36); `api.ts:93` defines the key; no raw `fetch` of `/api/retention` anywhere under `web/src` |
| `server/src/mcp.ts` | `server/src/index.ts` | handler proxies `/api/retention` | WIRED | `mcp.ts:309` `api<{ nextReviewAt }>(\`/api/retention${qs}\`)` — a template literal, so the literal `api('/api/retention` pattern cannot match |
| All other 23 links | | | WIRED | Pattern found in source |

Fallback wiring checks: `Lesson.tsx` → `/api/lessons/:id/answer` (`answer` from `useLesson`) → `gradeRestored`/`gradeQuiz` → `recordQuiz`/`addMisconception`/`setNodeStatus` (real DB writes, asserted by test). `RetentionPanel` → `/api/retention` → `retention(learnerOf(c))` → prepared statements over `nodes`/`quiz_results` (no static return). `NextStep`/`DuePill` → `/api/stats` → `dueNodes`.

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `RetentionPanel.tsx` | `data` | `GET /api/retention` → `db.retention()` SQL | Yes | ✓ FLOWING |
| `DuePill.tsx` (7 surfaces) | `due` | `GET /api/stats` → `dueNodes`; Atlas uses `atlas.due.length` (same read) | Yes | ✓ FLOWING |
| `NextStep.tsx` | `due`, `resume` | `/api/stats`, `/api/lessons` | Yes | ✓ FLOWING |
| `Graph.tsx` ramp | `stability` | `/api/atlas` node spread → `Atlas.tsx:44` | Yes | ✓ FLOWING |
| `Lesson.tsx` restored card | `state.pending` | `lessonView.pending` → `pendingPrompt(id)` → `prompts` table | Yes | ✓ FLOWING |
| `mcp.ts` `due` | `due`, `retention` | `/api/review`, `/api/retention` | Yes | ✓ FLOWING |
| `KeyHelp.tsx` rows | `kind`, `options` | `activeCard` derived from timeline items | Yes | ✓ FLOWING |

No HOLLOW or STATIC values found. The two `return null` sites (`DuePill` at zero, `RetentionPanel` at zero locked nodes) are specified contracts, not stubs.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Typecheck both packages | `pnpm typecheck` | exit 0 | ✓ PASS |
| Full suite (run once, output saved) | `cd server && node --import tsx --test test/*.test.ts` | 565 pass / 0 fail / 140 suites | ✓ PASS |
| 30 named tests from the SUMMARYs exist and passed | grep of saved TAP output | 30/30 `ok` lines, 0 `not ok` | ✓ PASS |
| Conformance exit decision | `exitCodeFor([{verdicts:{...remediation:false}}])` / all true | 1 / 0 | ✓ PASS |
| Wire-surface projection | `node -e` over `wire-surface.json` | 23 mcp tools, `due` present, absent from api surface | ✓ PASS |
| Plugin commands unwidened | `grep -c derive__due plugin/commands/{learn,review}.md` | 0 / 0 | ✓ PASS |
| Locked terminal strings in both files | grep | all three present in both | ✓ PASS |
| 21 task commits resolve | `git log -1` per hash | all present | ✓ PASS |
| Conformance on a real provider | — | no key / model available | ? SKIP → human |
| Browser keyboard / focus / voice | — | no web test runner, no speech APIs headless | ? SKIP → human |

### Probe Execution

| Probe | Command | Result | Status |
| --- | --- | --- | --- |
| (none declared or present) | `find scripts -path '*/tests/probe-*.sh'` | no files | N/A |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| LEARN-01 | 05-07 | Home leads with what to do next, review first | ✓ SATISFIED | SC1a |
| LEARN-02 | 05-05 | Every card answerable from the keyboard (1-4/A-D, Enter, `?`) | ? NEEDS HUMAN | Code complete on all four cards (SC2a); keystroke behaviour needs a browser |
| LEARN-03 | 05-07, 05-08 | Due count visible everywhere, incl. `derive due` | ✓ SATISFIED | SC1b, SC1c; literal bin spelling deferred to Phase 7 (D-05) |
| LEARN-04 | 05-04 | Honest retention stats from FSRS | ✓ SATISFIED | SC3a |
| LEARN-07 | 05-04 | Atlas coloured by stability | ✓ SATISFIED | SC3b (visual confirmation in human items) |
| LEARN-08 | 05-05 | Focus mode hides everything but the current card | ? NEEDS HUMAN | Code complete (SC2b); rendered collapse needs a browser |
| LEARN-09 | 05-06 | Remediation names the weakest prerequisite; misconception distractors; warm-up/cumulative named | ✓ SATISFIED | SC4a-c |
| LEARN-10 | 05-02, 05-07 | Voice auto-arms mic, sentence chunks, learner's language | ? NEEDS HUMAN | SC5b/5c verified; SC5a mic arming needs a speech-capable browser |
| LEARN-11 | 05-03, 05-06 | Streaming status; next card prefetched | ✓ SATISFIED (narrowed) | SC2c; prefetch narrowed to in-turn pipelining per ROADMAP Plans paragraph and CONTEXT D-17 — recorded, not silently matched |
| LEARN-12 | 05-01, 05-03 | Open cards survive a server restart | ✓ SATISFIED | SC5d |

**Orphaned requirements:** none. REQUIREMENTS.md maps exactly LEARN-01..04 and LEARN-07..12 to Phase 5 (line 216), and the union of the eight plans' `requirements` fields is exactly that set.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| (all 50 changed files) | — | `TBD` / `FIXME` / `XXX` | none found | No debt markers; the debt-marker gate passes |
| (all 50 changed files) | — | `TODO` / `HACK` / `PLACEHOLDER` / `not yet implemented` | none found | Only CSS `placeholder:` utilities and prose uses of the word |
| `web/src/pages/Lesson.tsx` | 233 | `e.key.toLowerCase() === 'f'` also fires on Shift+F | ℹ️ Info | Shift is not in the modifier bail list; harmless, but a learner typing a capital F outside a field toggles focus |
| ROADMAP Phase 5 | — | `Mode: mvp` with a non-User-Story goal | ℹ️ Info | MVP-mode verification format could not apply; verified against the five SCs as directed |
| `web/src/components/*Card.tsx` | — | 05-05 test-tier prohibition enforced by plan-time grep, not a committed test | ℹ️ Info | Holds today by direct inspection; a regression would not fail CI |

No 🛑 Blockers. No stubs: every `return null` is a specified empty state with a sibling surface that says "nothing due".

### Human Verification Required

Ten items, listed in the frontmatter `human_verification` block with test, expected and why-human. In short:

1. Restart with a card open and answer it — live card, grading line, quiet notice (05-01/05-03; backstop E7 partial).
2. Voice session — sentence-in start, no mic flicker, Spanish when `prefs.language` is `español` (05-02 human-check; flagged test-tier prohibition).
3. Keyboard scheme and `?` overlay in a browser (05-05 human-check).
4. Focus mode after the header extraction — rail, map and shared header vanish, single centred column (05-05/05-07).
5. Atlas ramp, retention block rhythm, scoped failure, neutral percentage (05-04 human-check; judgment prohibition).
6. 375px lesson header backstop and the pill on all seven surfaces; zero-due behaviour (05-07 human-check).
7. `/derive:due` and `derive-due` in both terminals; overdue parity with the Atlas; tone (05-08 human-check; two judgment prohibitions).
8. Conformance harness on a real provider — four verdicts hold (SC4d).
9. In-turn pipelining on a real provider (05-06 D7; the narrowed SC2 prefetch clause).
10. Misconception distractor copy on a real provider (05-06 judgment prohibition).

### Gaps Summary

No gaps. Every must-have resolved to VERIFIED, PRESENT_BEHAVIOR_UNVERIFIED or UNCERTAIN; nothing FAILED, no artifact is missing or a stub, every key link is wired, and the working tree, typecheck and 565-test suite are clean. The phase goal is achieved in code; what remains is the class of evidence this repository cannot produce in CI — browser keystrokes and rendering, speech-engine timing, terminal runs with the plugin loaded, and a real provider behind the conformance harness — plus explicit human resolution of five judgment-tier prohibitions and one test-tier prohibition that has a code guard but no wired test. The one documented narrowing (prefetch → in-turn pipelining) and the one deferral (literal `derive due` bin → Phase 7) are both recorded in ROADMAP/CONTEXT rather than silently matched.

---

_Verified: 2026-11-05T12:21:52Z_
_Verifier: Claude (gsd-verifier)_
