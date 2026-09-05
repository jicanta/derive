---
description: Spaced-repetition review of Derive nodes that are due, one fresh question each
allowed-tools: mcp__plugin_derive_derive__start_lesson, mcp__plugin_derive_derive__quiz, mcp__plugin_derive_derive__ask, mcp__plugin_derive_derive__set_plan, mcp__plugin_derive_derive__node_status, mcp__plugin_derive_derive__set_phase, mcp__plugin_derive_derive__explain_back, mcp__plugin_derive_derive__remember, mcp__plugin_derive_derive__learner_profile, mcp__plugin_derive_derive__end_lesson, WebSearch, WebFetch, Skill
---

Run a Derive review session.

1. Call `learner_profile` and pick the nodes listed as due or shaky (at most 6).
2. Call the derive `start_lesson` tool with topic "Review · <comma-separated node labels>", then `set_phase("teach")`.
3. For each node, ask ONE fresh `quiz` in a new framing that tests understanding rather than recall. Pass the node id as `node_id`. Pass -> `node_status(id, "locked")`. Miss -> a short re-derivation from its dependencies, then `node_status(id, "shaky")`.
4. Finish with two sentences on what held and what needs work, then `end_lesson`.
