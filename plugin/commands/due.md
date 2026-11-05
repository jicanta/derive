---
description: What is due for review in Derive right now — the count, the nodes, and one next step
argument-hint: [--learner <name>]
allowed-tools: mcp__plugin_derive_derive__due, WebSearch, WebFetch, Skill
---

Read out what is due for review in Derive.

1. Call the derive `due` tool. If the argument contains `--learner <name>`, pass that name as `learner`; otherwise pass nothing. The tool counts the whole queue and names the first five of it. There is no lesson to start here and no method to follow: this command is one call and its output.
2. Print the result and nothing else. It carries `count`, `nodes` (each with `label`, `topic` and `overdue`), `more` and `next_review`. Use exactly these three shapes, as written:
   - **`count` above zero.** `{count} node{s} due for review.` — `node` at one, `nodes` above one. Then one line per entry in `nodes`, in the order given: `· {label} — {topic} ({overdue})`. Then, when `more` is above zero, `+{more} more.` on its own line. Then `Run /derive:review to start.`
   - **`count` is zero and `next_review` is a phrase.** `Nothing due today. Next review {next_review}.`
   - **`count` is zero and `next_review` is null.** `Nothing due. Lock a node in a lesson and it starts coming back.`
3. Stop there. The `overdue` and `next_review` figures are already written the way the browser writes them, so pass them through verbatim rather than recomputing or rephrasing them.
4. This is a read, so it offers one next step and nothing more: no praise, no count of days in a row, no target for the day, no nudge to come back later. If the learner then asks to start reviewing, that is `/derive:review`.

If `due` fails because the server is not running, tell the learner to run `pnpm start` (or `pnpm dev`) in the derive repo and stop.
