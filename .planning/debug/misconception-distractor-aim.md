---
status: diagnosed
trigger: "UAT gap G-05-10 (test 10) in .planning/phases/05-learning-experience/05-UAT.md, phase 05-learning-experience of the Derive repo (/home/jicanta/derive)."
created: 2026-11-05T14:00:00Z
updated: 2026-11-05T14:25:00Z
mode: diagnose-only (goal: find_root_cause_only; no edits outside this file; no model turns; no git commit)
---

## Current Focus

bug_class: bohrbug (the server side — the string, its handover point and the lookup — is deterministic and identical on every call; the symptom's manifestation is stochastic because the final step is model sampling, so one sample cannot prove or disprove the judgment tier)
known_pattern_candidate: none (no knowledge base exists)
hypothesis: confirmed — see Resolution
test: done
expecting: n/a
next_action: return ROOT CAUSE FOUND to the orchestrator (diagnose-only; no fix)

reasoning_checkpoint:
  hypothesis: "The quiz missed the recorded claim because the only server text that carries it (actions.ts:319-320) acts on the OPTIONS of a question the model has already chosen, and says nothing about choosing a question the recorded claim bears on; when the model picks a question the old claim does not decide (a per-block lower bound), the method's own option rules (same skeleton, unambiguously wrong on the intended reading — method/30-quiz-options.md:4-6) make a mutation toward that claim a bad fit, and the model drops it. The second half is model judgment no server string can guarantee."
  confirming_evidence:
    - "The material reached the model: the UAT verified the node_status reply through the external route, and the model's teaching paragraph restated the correction ('1/n shrinking to zero tells you nothing about Σ1/n') — it read the material and used it as teaching, not as an option."
    - "The material was the LAST tool result before the quiz (the learner's message asked for teach-then-check with no pretest), so distance/handover timing did not cause this sample."
    - "The question chosen ('strongest lower bound this grouping guarantees for a block of ten') has no live 'the sum converges' alternative; every option shares the skeleton 'Each block of ten … / The amount guaranteed per block …', exactly what rule 4 of method/30-quiz-options.md asks for. The correct option C ('falls toward zero') even resembles the old claim's surface, so a mutation toward 'converges because terms vanish' would sit next to the right answer — a model following rule 3 ('unambiguously wrong on the intended reading') would reject it."
    - "The server string never names the shape the UAT truth expects: it says 'mutate the correct claim toward one of these' but not 'ask a question on which someone still holding that claim would answer differently, and make that answer one option'. The project's own review prompt (prompt.ts:128) has that shape ('a case where a tempting near-miss claim would give a different answer'); the material string does not."
  falsification_test: "Re-run the same scratch lesson N times on the same model: if the quiz lands a mutation toward the recorded claim in most runs with the string unchanged, the wording gap is not load-bearing and this is pure sampling variance. Conversely, if a reworded string (question-shaping clause) does not raise the hit rate over N runs, the deterministic half is not where the leverage is. Neither can be run here (no model turns allowed)."
  fix_rationale: "Not applied (diagnose-only). The smallest change that addresses the deterministic half is a wording change inside misconceptionMaterial (actions.ts:319-320): say that the next question should be one the old claim gives a different answer to, and that that answer is one of the options. No new handover site, no method-text change, no new query."
  blind_spots: "One sample, one model, no pretest in the flow. The misconception row in the sample was semantically about the 'terms' claim (question 'The terms 1/n shrink toward zero. What follows for the sum?') but recorded under 'grouping', so the material's fit with the node under check was loose — a sample confound that also exists in production (rows are attributed by whatever node_id the model put on the quiz). The prohibition sentence is the last thing the model reads; over-steer toward distance from the quoted text is plausible but unprovable from one run."
  candidate_causes:
    - "code: the material rides node_status(teaching|shaky) (actions.ts:514-521), not the quiz call; in the standard loop (60-process.md Phase 3: teaching → pretest → establish → check) the pretest card and its own instruction sit between the material and the check — structural weakness, NOT this sample's cause (eliminated below)"
    - "code: the string (actions.ts:319-320) acts on options only and leaves the question choice to the model; no clause names the shape of the wanted question/option — CONFIRMED deterministic contributor"
    - "code: misconceptionsOn is (lesson_id, node_id) scoped (db.ts:198-201, 1724) and review copies live under a new lesson id with a new node id (db.ts:1383-1445 buildReviewGraph, insertNodeCopy) — real limitation, NOT this sample's cause (eliminated below)"
    - "data: the sample's misconception row is attributed to 'grouping' though its question tests the 'terms' claim; the material handed over was about a neighbouring claim — sample confound, unfixable server-side (rows take the model's node_id)"
    - "environment: one model (Claude Code backend, default model), one sample — sampling variance; the model also weighed the method's option rules (30-quiz-options.md:4-6, system prompt) against a tool-result instruction and let the skeleton rule win — judgment tier"
    - "config: none (no env/config value touches this path)"
  and_gate: "yes — the failure needs both: the server string not steering the question choice (always true today) AND the model choosing a question the recorded claim does not decide, then honouring the method's skeleton/ambiguity rules over the tool-result line. Fixing only the string lowers the odds of the second; it cannot remove it. Recording both halves, by tier."

## Symptoms

expected: The node_status(teaching) tool result carries the learner's recorded wrong claims on that node as distractor material, and the model's next quiz on the node has one option mutated toward one of them. The question never quotes the mistake back or names it as the learner's.
actual: Scratch server, Claude Code backend. Lesson 'Why does the harmonic series diverge?', nodes terms (locked), grouping (shaky; misconception row: question 'The terms 1/n shrink toward zero. What follows for the sum?', picked 'The sum converges, because the terms vanish', correct 'Nothing yet: vanishing terms do not decide the sum'), diverge (pending). Message asked the tutor to set grouping to teaching, teach it in one paragraph, then check with one quiz on that node. node_status('grouping','teaching') returned {"ok":true,"instruction":"Distractor material for the next question on this node — wrong claims this learner has actually held on it: \"The sum converges, because the terms vanish\" (the answer was \"Nothing yet: vanishing terms do not decide the sum\"). Mutate the correct claim toward one of these so the tempting option is the one they would pick, rather than inventing a distractor nobody would choose. Never quote a past mistake back at them and never name it as theirs: this is material for building an option, not a line of copy."}. The tutor taught a paragraph (which itself restated '1/n shrinking to zero tells you nothing about Σ1/n'), then quizzed (purpose check, tests intuition, node grouping): 'cut the harmonic series into blocks of ten … strongest lower bound this grouping guarantees for a block?' options (A) 'Each block of ten still sums to at least one half' (B) 'Each block of ten sums to at least one tenth' (C) 'The amount guaranteed per block falls toward zero as the blocks move out' — correct C. Prohibition held. No option is a mutation toward 'vanishing terms decide the sum'; the distractors over-generalise the doubling bound instead. One sample, one model. Also: misconceptionsOn(lessonId, nodeId) is lesson-scoped so the material does not follow a node into a review-session copy (buildReviewGraph copies nodes under a new lesson id).
errors: None.
reproduction: UAT test 10. Code path: server/src/actions.ts nodeStatus() → misconceptionMaterial() attached as `instruction` when status is teaching or shaky; method/30-quiz-options.md distractor rules; quiz tool schema in server/src/tools.ts; prompt text under method/.
started: Discovered 2026-11-05 during UAT; material shipped in 05-06 (commit 74059c4 "the learner's own misconceptions as distractor material").

## Eliminated

- hypothesis: "The material did not reach the model, or reached it on the wrong call (handover on node_status rather than the quiz call is what lost it in this sample)."
  evidence: "The UAT verified the node_status reply carried the material; the model's own paragraph restated the correction, proving it was read. In this sample the material was the immediately preceding tool result (the learner's message skipped the pretest), so no card or instruction sat between it and the quiz. Handover timing remains a structural weakness for the standard loop (pretest between teaching and check, 60-process.md:25-30; and on the shaky path the re-check of the prerequisite comes first, actions.ts:516-519) but it is not what failed here."
  timestamp: 2026-11-05T14:20:00Z
- hypothesis: "The lesson-scoped lookup (misconceptionsOn) dropped the row."
  evidence: "The row was on the same lesson and node; the reply carried it verbatim. The scope limit is real for review sessions (copies get a new lesson id and review id, db.ts:1383-1445; the write side in gradeQuiz records review misses under the copy's ids too, actions.ts:400-410; and resolveMisconceptions on lock resolves only the copy's rows, actions.ts:501) — and in a review the quiz comes before any node_status call, so even a pointer-following lookup would surface nothing before the question is written. Separate limitation, already recorded under UAT Observations; not this gap's cause."
  timestamp: 2026-11-05T14:20:00Z
- hypothesis: "The instruction is overwritten by another instruction on the teaching branch."
  evidence: "actions.ts:514-521 — on 'teaching' no other writer sets extra.instruction, and the merge keeps both on 'shaky'; api.test.ts 'merges the material into the shaky branch's own instruction' passes. The reply observed in the UAT carried only the material."
  timestamp: 2026-11-05T14:20:00Z
- hypothesis: "The tool result is rendered in a way that hides the instruction field from the model."
  evidence: "agent.ts:50 returns the whole object as JSON text in a single text block; the instruction channel is the same one every other steer (afterQuiz, nameWeakest, cumulative) uses and those demonstrably steer the model in the same UAT (the remediation node was taken out of the reply in test 9 / conformance)."
  timestamp: 2026-11-05T14:20:00Z

## Evidence

- timestamp: 2026-11-05T14:00:00Z
  checked: .planning/debug/knowledge-base.md and MemPalace
  found: No knowledge base file exists; MemPalace not queried (nothing to layer on). SBFL skipped: no failing test and no per-test coverage; the symptom is generated copy, not a test.
  implication: Open investigation, no pattern candidate.
- timestamp: 2026-11-05T14:05:00Z
  checked: server/src/actions.ts:299-322 (misconceptionMaterial) and :510-521 (nodeStatus writers)
  found: The material is built from misconceptionsOn(lessonId, nodeId) rows as `"picked" (the answer was "correct")` and one instruction sentence: 'Mutate the correct claim toward one of these so the tempting option is the one they would pick, rather than inventing a distractor nobody would choose. Never quote a past mistake back at them and never name it as theirs: this is material for building an option, not a line of copy.' It is attached only on status 'teaching' or 'shaky', merged after the shaky sentence. The quiz path (openQuiz :345, gradeQuiz :369, quiz :435) does no misconception lookup; the quiz tool description (tools.ts:114-122) and its MCP variant say nothing about recorded misconceptions.
  implication: node_status is the only channel carrying this lesson's misconceptions to the model (learnerProfile excludes the current lesson's rows, db.ts:1754). The instruction operates at the option level and never addresses which question to ask.
- timestamp: 2026-11-05T14:08:00Z
  checked: method/30-quiz-options.md (rendered into method.generated.ts:71-72, plugin/skills/teach/SKILL.md:92-93, both codex skills)
  found: Rule 2 'Write the correct claim first, then mutate it into each distractor: take one specific misconception and state what someone holding it would claim, in the same skeleton, grain and register.' Rule 3 'unambiguously wrong on the intended reading. Tempting, not tricky.' Rule 4 'Keep options similar in length, specificity and phrasing.' Nothing in method/ ties the choice of question to a recorded claim; the only such phrasing in the repo is the review turn prompt (prompt.ts:128: 'a case where a tempting near-miss claim would give a different answer').
  implication: The method fixes the question first and derives options from it under a same-skeleton constraint. A recorded claim that does not decide the chosen question cannot satisfy rules 3-4, so the model's drop is the method-consistent outcome, not disobedience.
- timestamp: 2026-11-05T14:10:00Z
  checked: the observed quiz against the recorded claim
  found: Question is about the per-block lower bound under fixed-size grouping; options share the skeleton 'Each block of ten … / The amount guaranteed per block …'. The recorded claim ('the sum converges because the terms vanish') is about the whole sum's fate and does not decide that question. Correct option C ('falls toward zero as the blocks move out') shares surface with the old claim, so a mutation toward it would read as a near-duplicate of the right answer. The teaching paragraph consumed the material as a correction ('1/n shrinking to zero tells you nothing about Σ1/n').
  implication: The model read the material, spent it in the prose, chose a question orthogonal to it, and built options per the method. The missing clause is 'pick a question on which someone still holding this claim answers differently'.
- timestamp: 2026-11-05T14:12:00Z
  checked: method/60-process.md Phase 3 (lines 23-35) — the standard teach loop
  found: 1. node_status(teaching) → 2. motivate → 3. pretest quiz → 4. establish → 5. connect → 6. check quiz. 'The next question on this node' after node_status(teaching) is normally the pretest; the check arrives after the pretest's own result instruction (afterQuiz pretest branch, actions.ts:120-124), which says nothing about distractors.
  implication: In the standard loop the material is two cards away from the check it is meant for. Not the sample's cause (the sample had no pretest), but it is where the handover is weakest. On the shaky path the material is also followed by the prerequisite re-check before the fresh question on the node.
- timestamp: 2026-11-05T14:15:00Z
  checked: db.ts:186-201 (misconceptionsOn), :1383-1445 (buildReviewGraph), :327 (insertNodeCopy); actions.ts:400-410 (misconception write), :501 (resolve on lock); prompt.ts:117-135 (reviewTurnPrompt)
  found: Lookup is (lesson_id, node_id). Review copies get the review lesson's id and a review id (`node_id` or `node_id-2`…), with source_lesson/source_node pointers that nodeRecord/propagate already follow (db.ts:1211, 1256). Misconceptions written during a review land on the copy's ids; locking the copy resolves only the copy's rows. The review prompt carries only the generic near-miss sentence. In a review the quiz precedes any node_status call.
  implication: Deterministic limitation, deliberate per plan 05-06 ('scoped to the lesson … a cross-lesson match would be a guess' — true for id matching, though following the explicit source pointer would not be a guess). Out of G-05-10's truth, already in UAT Observations; a fix there needs a different handover (the review prompt's per-node list), not just the lookup.
- timestamp: 2026-11-05T14:18:00Z
  checked: 05-06-PLAN.md D-23 and task 3; 05-06-SUMMARY D6/D10; 05-VERIFICATION.md SC4b and the judgment-tier row; api.test.ts:1337-1357
  found: The plan deliberately chose the tool-result channel and no method-text change; verification classed the distractor outcome as judgment-tier ('generated copy needs a human'). Tests assert only that the string is present on the teaching and shaky results and that it carries the prohibition. The conformance harness's 'remediation' verdict checks that a re-check lands on the named node; nothing machine-reads whether an option mutates toward a recorded claim.
  implication: No gate could have caught this; the aim of the option is a model property. The deterministic half is a wording gap in a string no test reads for meaning.
- timestamp: 2026-11-05T14:20:00Z
  checked: agent.ts:50 (tool result rendering), :338 (learnerProfile in the volatile prompt half)
  found: Tool results are JSON-stringified into one text block; the profile excludes the current lesson's nodes and misconceptions.
  implication: The instruction text reaches the model exactly as the UAT observed; there is no second copy of this lesson's misconceptions anywhere in its context.
- timestamp: 2026-11-05T14:22:00Z
  checked: Phase 1.5 common bug patterns
  found: No null/async/state/import/type/env/regex/error/scope pattern applies. Closest is 'Data Shape / API Contract' read loosely: the contract between the server's instruction and the method's construction procedure leaves the question choice unspecified.
  implication: Proceed with the instruction-design hypotheses above.

## Resolution

root_cause: "Two tiers, AND-gated. (1) Deterministic, server: `misconceptionMaterial` (server/src/actions.ts:315-322, string at :319-320) hands the recorded claim over as option material only — 'mutate the correct claim toward one of these' — and never says that the next question itself must be one on which someone still holding that claim would answer differently, with that answer as one option. The method the model follows (method/30-quiz-options.md:4-6, rendered into the system prompt) fixes the question first and then mutates options under same-skeleton / unambiguously-wrong rules, so when the chosen question is orthogonal to the recorded claim the mutation has no place to go and the model drops it; the repo's own phrasing of the wanted shape exists only in the review prompt (server/src/prompt.ts:128) and not in this string. (2) Judgment, model: which question to ask on the node, and how to weigh a tool-result line against the method's option rules, is the model's; in the observed sample it chose a per-block lower-bound question that the old claim does not decide, spent the material in the teaching prose instead, and built skeleton-matching distractors. No server change guarantees the second tier. Not causes of this sample, but real and adjacent: the handover on node_status (actions.ts:514-521) is two cards from the check in the standard loop (pretest in between); and misconceptionsOn (server/src/db.ts:198-201, 1724) is (lesson, node)-scoped so review-session copies never see the rows, nor would a node_status-borne instruction arrive before a review quiz."
fix: "Not applied (diagnose-only). Suggested direction: a wording change in the one string, no move of the handover, no method-text change — see return."
verification: "n/a (diagnose-only). Any check of the deterministic half is a string assertion in server/test/api.test.ts; the judgment half is only observable on a model, over several samples."
files_changed: []
