---
status: diagnosed
trigger: "UAT gap G-05-1b (test 1) in .planning/phases/05-learning-experience/05-UAT.md, phase 05-learning-experience of the Derive repo (/home/jicanta/derive). A fresh turn started without the earlier conversation (provider change under D-04, or any lost session) does not know this lesson's graph, phase and events; the tutor probed an unrelated topic."
created: 2026-11-05T00:00:00Z
updated: 2026-11-05T14:00:00Z
mode: diagnose-only (goal: find_root_cause_only; no edits under server/, web/, plugin/, codex/, scripts/; no git commit; no real model turns)
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

bug_class: bohrbug (deterministic from code; reproduces on every fresh turn of a lesson that already has state)
sbfl: skipped — no failing test exists for this behaviour; nothing to rank
hypothesis: CONFIRMED. No code path carries the current lesson's state (topic, goal, phase, nodes, events, this lesson's misconceptions) into a turn whose provider conversation is gone. The prompt assembly in agent.ts runTurn is method text + materials + library + a learner profile that excludes this lesson by design; every driver's only continuity is `resume`/`turn_messages`, which D-04 drops on a provider change.
test: Falsification grep for listNodes/listEvents/.phase/.goal/misconceptionsOn/renderMarkdown across agent.ts, prompt.ts, drivers/api.ts, codex.ts, materials.ts, library.ts, driver.ts.
expecting: Any hit in a prompt-assembly path would disprove the hypothesis.
result: zero hits. Hypothesis stands.
next_action: return the diagnosis (goal: find_root_cause_only); no fix in this session.

reasoning_checkpoint:
  hypothesis: "A fresh turn (session_id null AND turn_messages empty) knows nothing about the current lesson because agent.ts runTurn builds instructions = systemPrompt + materialsSection + librarySection + learnerProfile(learner, lessonId) and prompt = the caller's text, and learnerProfile deliberately filters out the current lesson (db.ts:1738, 1754); the drivers add nothing of their own (agent.ts:157 resume-or-nothing, codex.ts:75 resume-or-start, api.ts:513/586 prior-or-empty)."
  confirming_evidence:
    - "agent.ts:330-339 — the three volatile sections are the only per-lesson/per-learner input; none reads listNodes, listEvents, lesson.phase or lesson.goal"
    - "db.ts:1738 `allNodes(learnerId).filter((n) => n.lesson_id !== currentLessonId)` and :1754 same filter on misconceptions — the profile is 'earlier lessons' by design (method/90-preferences.md:9)"
    - "library.ts:625 is the ONLY place the lesson's topic string reaches a fresh prompt, and only when the learner has a non-empty library"
    - "Falsification grep over every prompt-assembly module: NO HITS for current-lesson state readers"
    - "The promise is written in three places with no mechanism behind it: agent.ts:304-305 comment, driver.ts:60 TurnContext doc ('and the lesson state'), index.ts:1097 restoredAnswerPrompt sentence; 03-CONTEXT.md:28 D-04 asserts 'exactly as the Claude and Codex paths already do' — those paths only ever resumed"
    - "UAT observation matches exactly: the tutor knew OTHER lessons (profile) and not this one; a message that named the node id proceeded (the learner's text became the only lesson context)"
  falsification_test: "Any read of listNodes/listEvents/getLesson(...).phase in agent.ts runTurn, prompt.ts, drivers/api.ts or codex.ts feeding ctx.prompt or ctx.instructions — or a test asserting the fresh request's prompt names the lesson's nodes. Neither exists."
  fix_rationale: "Not applied (diagnose-only). The direction that addresses the cause rather than the symptom: build a compact lesson brief from the rows the server already serves to the browser and put it into the fresh turn's prompt where the conversation would have been — not into the profile (wrong framing, no phase/goal/pending) and not necessarily into the volatile half (per-turn cost on resumed turns that already hold it in conversation)."
  blind_spots: "No real model turn was run (forbidden). Not verified whether the Claude SDK applies a changed systemPrompt on a resumed session (irrelevant to the fresh case). Not measured actual token counts; estimates below are chars/4."
  candidate_causes:
    - "code: no seam builds current-lesson state into a fresh turn's prompt or instructions (CONFIRMED — the defect)"
    - "code: learnerProfile excludes the current lesson (CONTRIBUTING but correct for its purpose; it is why the one per-learner section is blind to this lesson; un-filtering it is not the fix)"
    - "data: the UAT lesson was built via the external action path and flipped to agent (ELIMINATED as necessary — a real provider change on an agent lesson, or a restored card after a restart, reaches the identical runTurn prompt assembly with session_id null)"
    - "config: DERIVE_BACKEND / driverOverride / active_provider setting (ELIMINATED — all three drivers behave identically on a null session; no setting adds lesson context)"
    - "environment: Claude SDK `resume: undefined` semantics (ELIMINATED as a cause — a new session is the documented and intended behaviour of a null resume)"
  and_gate: "yes — the symptom needs (1) the provider conversation to be absent (session_id null and turn_messages empty: produced by D-04 on a provider change, by a restart that killed the tool call behind a card, or by a lesson whose first agent turn follows state built another way) AND (2) the prompt assembly carrying no current-lesson state. (1) is the designed trigger — D-04 explicitly rejected carrying history across providers — and must stay; (2) is the defect. Both are recorded; the fix addresses (2)."

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: After a provider change mid-lesson (session id and turn_messages dropped), the next turn continues the lesson: it knows the plan, which nodes are locked/shaky/pending, and the current phase. restoredAnswerPrompt() in server/src/index.ts tells the model "The lesson's graph, events and memory are in your context — read them rather than asking the learner to recap"; the D-04 comment in agent.ts runTurn() says "The tutor rebuilds from the lesson's events and nodes instead."
actual: On a scratch server, an agent-mode lesson in phase 'teach' with a three-node approved plan ('terms' locked, 'grouping' shaky with a recorded misconception, 'diverge' pending) was given a turn via POST /api/lessons/:id/message with no session_id and no turn_messages. The tutor replied that there was "a fresh graph to build", called `ask`, set the phase and began probing an unrelated topic (TCP congestion control). It knew the learner's OTHER lessons (learner profile) but nothing about THIS lesson. A second attempt whose message named the node id explicitly did proceed on it.
errors: None. The turn succeeded, on the wrong footing.
reproduction: UAT test 10 first attempt. Deterministic from code: build an agent lesson with a plan via the external action path, flip mode to agent, send /message with no session — or change the active provider between turns on a real lesson and send a message.
started: Discovered during UAT 2026-11-05. D-04 drop of session+messages on provider change shipped in phase 03; phase 05 plan 05-03 relies on it for the restored-card fresh turn and wrote the restoredAnswerPrompt sentence.

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: The UAT repro is an artefact of building the lesson through the external action path and flipping mode to agent (data branch).
  evidence: index.ts:1415 driverOf writes 'claude-code'/'codex' into turns.driver for external lessons while the Claude SDK driver's name is 'claude' (agent.ts:141), so the flip does count as a provider change at agent.ts:307 — but that only reaches the same clear and the same prompt assembly a real provider change reaches; createLesson leaves session_id null either way, and the restored-card path (index.ts:1122) starts a turn through the identical runTurn. The trigger condition is simply "no conversation", not how the lesson got its state.
  timestamp: 2026-11-05

- hypothesis: A setting or environment variable (DERIVE_BACKEND, driverOverride, active_provider) decides whether lesson context is included (config/environment branches).
  evidence: agent.ts:294-339 — the provider choice selects the driver and the {{WEB_TOOLS}} phrase only; instructionsVolatile is the same three sections for every driver, and all three drivers treat a null sessionId as "start new" (agent.ts:157, codex.ts:75, api.ts:513/586). No setting is read anywhere in the assembly of lesson context, because there is no such assembly.
  timestamp: 2026-11-05

- hypothesis: The model could recover the lesson on its own from a tool result (e.g. set_phase or node_status returning the graph).
  evidence: actions.ts phase() (line ~576) emits 'phase' and returns nothing about the graph; purposeOf/planLibraryInstruction/libraryHint read listNodes/getLesson for grading and nudges only. The only tool that returns learner state is `learner_profile`, surfaces: ['mcp'] only (tools.ts:455-459), and it returns the same profile that excludes the current lesson. Nothing tells a fresh turn to call anything first.
  timestamp: 2026-11-05

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-11-05 phase 0
  checked: .planning/debug/knowledge-base.md and `mempalace` CLI
  found: Neither exists. No prior resolved sessions to match against.
  implication: Phase 0 skipped; proceed from code.

- timestamp: 2026-11-05 phase 1
  checked: server/src/agent.ts runTurn (lines 275-369)
  found: Lines 306-310 drop session_id and turn_messages when `lastTurn(lessonId).driver !== driver.name` (D-04). Lines 330-339 build the prompt: `instructionsStable = systemPrompt(web)` (method text only) and `instructionsVolatile = materialsSection(lessonId, {outlineOnly}) + librarySection(lesson.learner_id, lesson.topic) + learnerProfile(lesson.learner_id, lessonId)`. The only other input is `prompt` (line 275), which is the caller's text plus any pending notices (lines 314-315). ctx.sessionId (line 352) is read AFTER the instructions are built. Nothing in runTurn reads listNodes, listEvents, lesson.phase, lesson.goal or misconceptionsOn for the current lesson.
  implication: The D-04 comment at lines 304-305 ("The tutor rebuilds from the lesson's events and nodes instead") describes a mechanism that does not exist in this function.

- timestamp: 2026-11-05 phase 1
  checked: server/src/db.ts learnerProfile (lines 1737-1777)
  found: Line 1738 `allNodes(learnerId).filter((n) => n.lesson_id !== currentLessonId)` and line 1754 `.filter((m) => !m.resolved && m.lesson_id !== currentLessonId)` exclude the current lesson's nodes and misconceptions on purpose; the heading is "Locked in earlier lessons". The filter dates to commit bf06725 (Derive 0.2), long before D-04 (phase 03). The profile is memory from OTHER lessons by design (method/90-preferences.md:9 says so).
  implication: The profile is the only per-learner state in the prompt and it is deliberately blind to THIS lesson — correct for a resumed conversation, fatal for a fresh one. This explains why the tutor knew the learner's TCP and gradient-descent lessons but not the one it was in.

- timestamp: 2026-11-05 phase 1
  checked: server/src/agent.ts claudeDriver (line 157), server/src/codex.ts (lines 75, 97), server/src/drivers/api.ts (lines 513, 586, 677-678)
  found: Claude: `resume: ctx.sessionId ?? undefined` — null means a brand-new SDK session whose only user message is ctx.prompt. Codex: `ctx.sessionId ? codex.resumeThread(...) : codex.startThread(opts)` then `thread.runStreamed(ctx.prompt)` — same shape. Owned loop: `prior = loadTurnMessages(ctx.lessonId, provider)` (empty after a provider change, by construction, db.ts:1080), `messages = [...prior, { role: 'user', content: ctx.prompt }]`, two system messages = instructionsStable + instructionsVolatile. No driver reads lesson state of its own.
  implication: All three drivers rely entirely on conversation continuity (session id or persisted messages) for this lesson's state. When that is gone, the model's entire knowledge of this lesson is: the learner's message text.

- timestamp: 2026-11-05 phase 1
  checked: server/src/index.ts restoredAnswerPrompt (1087-1097), resumeCarries (1071-1078), /answer restore branch (1099-1125), /message (944-976)
  found: restoredAnswerPrompt ends with "The lesson's graph, events and memory are in your context — read them rather than asking the learner to recap." resumeCarries() already computes exactly the "fresh" condition (provider changed, or no session_id and no turn_messages) and is used only to decide whether to emit the quiet notice. /message passes the learner's text straight to runTurn (line 976).
  implication: The sentence is a promise the prompt assembly never fulfils. The fresh-turn predicate already exists server-side (resumeCarries) but only drives UI copy, not prompt content.

- timestamp: 2026-11-05 phase 1
  checked: method/surfaces/app.md:5, method/90-preferences.md:9, .planning/phases/03-owned-loop-api-keys-and-gateways/03-CONTEXT.md:28
  found: app.md tells the tutor "What Derive already knows about this learner, the course material they attached and the entries of their library are in the sections below" — three sections, none about the current lesson. 03-CONTEXT D-04 says "the tutor rebuilds from the lesson's events and nodes, exactly as the Claude and Codex paths already do" — asserting the Claude/Codex paths already rebuild. They never did; both only ever `resume`d.
  implication: The gap was baked in as an assumption at decision time (phase 03) and inherited by 05-03's restoredAnswerPrompt sentence.

- timestamp: 2026-11-05 phase 1
  checked: server/test/api-driver.test.ts:712 ("drops the history and the session id together when the provider changes"), server/test/api.test.ts:1529 (restored card fresh turn), server/test/settings.test.ts:1213-1258
  found: The provider-change tests assert that session_id becomes null and turn_messages are dropped; the restored-card test asserts only that a turn row was added (`turnsAfter > turnsBefore`). No test inspects what the fresh turn's prompt or instructions say about the lesson.
  implication: No gate could have caught this: the "rebuild" half of D-04 has no assertion anywhere.

- timestamp: 2026-11-05 phase 3
  checked: server/src/library.ts librarySection (601-628)
  found: Returns '' when the learner has no resources (line 603). When non-empty, line 625 renders `Entries that look relevant to "${topic}"` — the one and only place the current lesson's topic string reaches a fresh turn's prompt, and only incidentally.
  implication: For a learner with an empty library, a fresh turn does not even know the lesson's topic. This matches the UAT reply "there's a fresh graph to build".

- timestamp: 2026-11-05 phase 3
  checked: server/src/driver.ts TurnContext (lines 58-61)
  found: The doc on `instructionsVolatile` reads "the material, the library, the learner profile and the lesson state, which is why it is never the cached half".
  implication: Third place (after agent.ts:304-305 and index.ts:1097) where the type's own contract claims lesson state is in the prompt. The concatenation at agent.ts:338 never adds it.

- timestamp: 2026-11-05 phase 3 (falsification)
  checked: `grep -n "listNodes\|listEvents\|\.phase\b\|\.goal\b\|misconceptionsOn\|renderMarkdown" server/src/agent.ts server/src/prompt.ts server/src/drivers/api.ts server/src/codex.ts server/src/materials.ts server/src/library.ts server/src/driver.ts`
  found: NO HITS.
  implication: No prompt-assembly module reads the current lesson's graph, phase, goal, events or misconceptions. The hypothesis survives its falsification test.

- timestamp: 2026-11-05 phase 3
  checked: server/src/export.ts renderMarkdown (76-120); server/src/index.ts lessonView (320-345) and teachingGap (1786-1810); server/src/db.ts NodeRow
  found: The server already renders this lesson's graph with kind/status/depends_on (renderMarkdown mermaid + table), serves `nodes: listNodes(id)` and `lesson.phase/goal` to the browser (lessonView), and walks listEvents for the teaching gate (teachingGap). NodeRow carries node_id, label, kind, summary, depends_on, status, source_lesson.
  implication: Every ingredient of a lesson brief is one existing read away; nothing new needs storing. renderMarkdown's full transcript is too long for a prompt, but its graph block is the right shape.

- timestamp: 2026-11-05 phase 3 (sizing)
  checked: `node -e` over server/src/method.generated.ts
  found: The method text alone is 29,422 chars ≈ 7.4k tokens, sent on every turn as instructionsStable. A brief line per node (`id · label · kind · status · depends_on`) is ~25-40 tokens; a 5-12-node graph ≈ 150-500 tokens; header (topic, goal, phase) ≈ 60-100; this lesson's unresolved misconceptions ≈ 30 each; a 2-3-event tail trimmed to ~300 chars ≈ 200-250.
  implication: A fresh-turn brief costs roughly 300-800 tokens once, against 7.4k of method text already paid every turn. Put in the volatile half instead, it costs that on every turn, all of it in the uncached half.

- timestamp: 2026-11-05 phase 3
  checked: server/test/api-driver.test.ts:712-738 harness (`says`, `roles`, `doStreamCalls[0].prompt`); server/src/drivers/fake.ts (ignores `_ctx`)
  found: The owned-loop test already captures the full request prompt of the post-switch turn and asserts what it must NOT contain ('On anthropic.'). The fake driver records nothing from ctx.
  implication: A recurrence guard fits in the existing provider-change test: assert the post-switch request's prompt names this lesson's nodes and phase. No new harness needed.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: |
  A fresh turn's prompt carries nothing about the current lesson. In server/src/agent.ts runTurn (lines 330-339) the model receives instructionsStable = systemPrompt(web) (method text only, prompt.ts:66-68) plus instructionsVolatile = materialsSection(lessonId) + librarySection(learnerId, topic) + learnerProfile(learnerId, lessonId), plus `prompt` = the caller's text (index.ts:976 the learner's message; index.ts:1087-1097 restoredAnswerPrompt) with pending notices folded in (agent.ts:314-315). Of these: learnerProfile excludes this lesson's nodes and misconceptions by design (db.ts:1738, 1754 — it is memory from earlier lessons, method/90-preferences.md:9); materialsSection is empty without attached material; librarySection is empty without a library and otherwise mentions the topic string only in passing (library.ts:625). The drivers add no state of their own: Claude passes `resume: ctx.sessionId ?? undefined` (agent.ts:157) so a null id is a new SDK session; Codex calls startThread when ctx.sessionId is null (codex.ts:75); the owned loop starts from `prior = loadTurnMessages(...)` which is empty after the D-04 clear (api.ts:513, 586). D-04 (agent.ts:306-310) drops the session id and turn_messages on a provider change and its comment says "The tutor rebuilds from the lesson's events and nodes instead" — but no function anywhere reads listNodes/listEvents/lesson.phase/lesson.goal into ctx.prompt or ctx.instructions (falsification grep: zero hits across every prompt-assembly module). The same unfulfilled promise is written at driver.ts:60 ("and the lesson state") and index.ts:1097 ("The lesson's graph, events and memory are in your context"), and 03-CONTEXT.md:28 D-04 asserted the Claude/Codex paths "already do" this; they only ever resumed. Contributing, by design and not to be changed: the conversation is genuinely absent (AND-gate condition 1) whenever session_id is null and turn_messages are empty — after a provider change, after a restart that killed the tool call behind a card, or on a lesson whose state was built another way.
fix: not applied (diagnose-only). Direction recorded in the returned diagnosis.
verification: none (no fix). Falsification of the hypothesis attempted and failed (grep, see Evidence).
files_changed: []
