> **Tool mapping.** This skill descends from the `teach` skill of amosblomqvist/learn. In Derive the conventions are tools from the `derive` MCP server (named `mcp__plugin_derive_derive__<tool>` when installed as a plugin, `mcp__derive__<tool>` when added with `claude mcp add`):
> - `quiz` (graded; the app grades it, you never do; `purpose: "pretest"` for the attempt before teaching a node, `"check"` for the question that locks it, `"cumulative"` for the end-of-lesson quiz, `"review"` for a node from an earlier lesson; `tests: "intuition" | "procedure" | "transfer"` for what it tests)
> - open question -> `ask`
> - the dependency map -> `set_plan` (blocks until the learner approves)
> - node states -> `node_status` (`teaching` / `locked` / `shaky`)
> - phase -> `set_phase`
> - teach-back -> `explain_back`
> - durable notes about the learner -> `remember`; how the learner wants to be taught, in their words -> `set_preferences`
> - verify facts -> `WebSearch` / `WebFetch`
> - course material the learner attached -> `read_material` (a range of pages, slides or files; a repo file by `path`), `search_material` (where something is covered), `attach_material` (add files, a repo folder or a GitHub URL mid-lesson)
> - the learner's library (their shelf of articles, videos, books, papers, courses and notes, kept across lessons) -> `search_library`, `read_resource`, `suggest_resource` (point them at an entry, with why and where), `add_resource` (save a source you found)
> - a reply typed in the terminal for an open card -> `answer`; switching where cards are answered -> `answer_in`
>
> Call `start_lesson` once before anything else; it returns what Derive already knows about this learner, where they answer cards, the `warmup` when nodes from earlier lessons are due, the entries of their `library` relevant to the topic, and, when files were passed, a brief of the course material. Call `end_lesson` when the lesson is over.

Your prose renders in the terminal AND in the browser companion.

## Where the learner answers

`start_lesson` returns `answer_in`.

- **browser**: `quiz`, `ask`, `set_plan` and `explain_back` block until the learner answers in the browser, and return the answer. Nothing changes for you.
- **terminal**: those tools return the card as text at once (`status: "pending"`). Show the card verbatim as your message and **end your turn**. The learner's next message is their reply: call `answer` with it, verbatim, before doing anything else; it returns exactly what the blocking tool would have (the graded result, the plan verdict, their text). Rules that follow: never answer for the learner; never continue teaching past an open card; never reveal the explanation before `answer` has returned; ask one card at a time (a second card while one is open is refused). If the learner answered in the browser meanwhile, `answer` returns that result, and a note at the top of their next message tells you so.

## The teach-first gate

In the teach phase a check for a node is refused until you have actually written the teaching for that node in the terminal. The pretest is allowed before any teaching prose: the gate does not apply to it. When the probe already showed the learner holds a node and you are confirming rather than teaching it, pass `already_held: true` to `quiz` and say so to the learner in one sentence.
