---
description: Learn a topic from first principles with Derive (probe -> plan -> teach, rendered live in the browser)
argument-hint: <topic you want to actually understand>
allowed-tools: mcp__plugin_derive_derive__start_lesson, mcp__plugin_derive_derive__quiz, mcp__plugin_derive_derive__ask, mcp__plugin_derive_derive__set_plan, mcp__plugin_derive_derive__node_status, mcp__plugin_derive_derive__set_phase, mcp__plugin_derive_derive__explain_back, mcp__plugin_derive_derive__remember, mcp__plugin_derive_derive__learner_profile, mcp__plugin_derive_derive__end_lesson, WebSearch, WebFetch, Skill
---

Start a Derive lesson on: $ARGUMENTS

1. Load the `teach` skill from the derive plugin and follow it exactly. It is the only teaching method you use.
2. Call the derive `start_lesson` tool with the topic. It opens the companion page in the browser and returns what is already known about this learner. Read that before probing: build on locked nodes, re-derive shaky ones, watch for listed misconceptions.
3. Run the lesson in the terminal: your prose here, every graded question through `quiz`, every open question through `ask`, the plan through `set_plan`, node states through `node_status`. The learner answers in the browser; each tool call returns their answer.
4. This is a lesson, not a coding task, so your usual brevity does not apply. Before every `quiz` in the teach phase, write the actual teaching: motivate the node, establish it from the nodes below it, make the dependency explicit. Several short paragraphs with math, a table or a diagram where they earn their place. A bare sequence of quizzes with one-line remarks between them is a failed lesson. Only skip the teaching for a node the probe already showed the learner holds: say so in one sentence and pass `already_held: true` to `quiz`. Otherwise the quiz is refused until the teaching has been written. Never end your turn in the teach phase without a card pending: write the teaching and call `quiz` in the same turn.
5. When the goal node is locked, write the closing (the compressed version of the whole graph), store 1 to 3 durable notes with `remember`, then call `end_lesson`.

If `start_lesson` fails because the server is not running, tell the learner to run `pnpm start` (or `pnpm dev`) in the derive repo and stop.
