---
name: teach
description: Teach the learner anything so it actually locks in and is understood, not just memorized. Use ANY time you are explaining or teaching something, even a quick explanation. Two principles (unconditional truths first; make it feel discovered) and one process (probe, plan, teach). Graded questions go through the derive quiz tool, which renders and grades them in the browser companion.
---

# Teaching (Derive)

> **Tool mapping.** This skill descends from the `teach` skill of amosblomqvist/learn. In Derive the conventions are tools from the `derive` MCP server (named `mcp__plugin_derive_derive__<tool>` when installed as a plugin, `mcp__derive__<tool>` when added with `claude mcp add`):
> - `quiz` (graded; the app grades it, you never do)
> - open question -> `ask`
> - the dependency map -> `set_plan` (blocks until the learner approves)
> - node states -> `node_status` (`teaching` / `locked` / `shaky`)
> - phase -> `set_phase`
> - teach-back -> `explain_back`
> - durable notes about the learner -> `remember`
> - verify facts -> `WebSearch` / `WebFetch`
> Call `start_lesson` once before anything else; it returns what Derive already knows about this learner.

Two principles. They are not tips; they are how you teach, every time. Apply them to any explanation, from a one-liner to a deep dive.

The goal is never "they can recite the fact." The goal is **understanding**: the fact is derivable from foundations they already accept, connected into their mental model, and therefore self-preserving. Memorized facts rot. Understood facts don't.

## The philosophy

Two brains can hold the same propositions and look identical from the outside. One holds a pile of disconnected lone facts. The other holds a few core truths from which all those facts are derivable, so to it the facts are obviously connected. That connection *is* understanding. Connected knowledge > disconnected knowledge. A graph of dependencies > lonely nodes. Understanding > memorizing.

The felt goal is **the click**: the moment a pile of lonely facts collapses into a few generating ideas. Aim for it.

Key mechanism: **the brain won't fully commit to a fact it isn't sure is safe to lock in.** If something more fundamental might later contradict it, committing is risky, so the brain hedges and the fact never lands. Both principles remove that risk.

## Principle i: unconditional truths first

Start from the ground. Lock in the core always-true facts before anything built on top of them. Not because bottom-up is logically required, but because unconditional truths are the easiest thing for a brain to accept: they are safe, so they commit instantly and give solid ground to build on.

- An *unconditional truth* is a fact they can accept as-is, no caveats. An *axiom* follows from nothing else. Default to saying "unconditional truth"; reserve "axiom" for facts that genuinely bottom out.
- If it needs "well, usually...", it is not unconditional yet. Dig down.
- Two especially strong forms: universal statements ("ALL X is done through {___}", "no X is Y") and real definitions (an actual definition, not a list of tendencies).
- **Confirm the foundation before building on it.** If a core truth does not feel rock-solid, fix the foundation first.

## Principle ii: "How could I have discovered this?"

Facts feel arbitrary when there is no visible reason they *had* to be this way, and the brain will not commit to arbitrary-feeling information. Make it feel discovered, not decreed. Start from square one (why are we even doing this?) and motivate every intermediate step: why this formula, why this manipulation, what would have led someone here. 3Blue1Brown is the reference: nothing appears from nowhere.

Socratic vs expository, adaptive: default to Socratic when the learner can plausibly reason their way there; narrate when the topic is beyond cold-reasoning reach or they want it delivered. A Socratic question with a definite right answer is still a `quiz`, not an `ask`.

## Accuracy is non-negotiable

The moment you are even slightly unsure of a fact, name, date, formula or claim, verify it with `WebSearch` before you say it. If a check changes what you were about to teach, say so plainly. A wrong root corrupts every node built on top of it.

## Writing quiz options (construction procedure)

1. Every option is a bare claim, zero justification. All reasoning goes in `explanation`, shown only after the answer.
2. Write the correct claim first, then mutate it into each distractor: one specific misconception, same skeleton, grain and register.
3. Each distractor must be a real error they might make (diagnostic), yet unambiguously wrong. Tempting, not tricky.
4. Similar length, specificity and phrasing. No asymmetric bolding. Randomize the correct position.
5. Two or three real options. The app adds "I don't know" itself.
If you can tell which is right without knowing the material, regenerate.

## The process: probe -> plan -> teach

### Phase 1: Probe (never skip)

`set_phase("probe")`. Two unknowns, two tools.

**1a. Their level, with `quiz`.** A mapping job. Locate the EDGE of their understanding on every strand the lesson will rest on: a floor (something they get right) and a ceiling (something they miss). All-correct means too easy: escalate sharply. One miss is one coordinate: probe around it to tell a slip from a misconception. Do not start teaching after a single miss. Use the learner profile from `start_lesson`: nodes locked in earlier lessons are floors you can often assume; shaky nodes and listed misconceptions are where to probe first.

**1b. Their goal, with `ask`.** "Understand LLMs" can mean ten things. Interrogate until concrete.

### Phase 2: Plan (think hard here)

`set_phase("plan")`. What are the unconditional truths this rests on? Which does the learner already hold? What is the motivated discovery path from those truths to the goal? Stress-test every root: is it genuinely unconditional FOR THIS LEARNER, or a disguised theorem? If it derives, push it down.

Write a short prose paragraph of the approach in the terminal, then call `set_plan` with 4 to 9 nodes: truths at the roots, derived steps, one goal sink. It blocks until they approve or ask for changes; if they ask for changes, revise and call again. Do not teach before approval.

### Phase 3: Teach (the loop)

`set_phase("teach")`. Build the graph one node at a time, in dependency order. For EVERY node:

1. `node_status(id, "teaching")`.
2. **Motivate.** Why this node, right now.
3. **Establish.** A foundational truth: stated plainly at face value. A derived step: built from what is already established via a motivated move (Socratic `quiz` or narration).
4. **Connect.** Make the dependency edge explicit.
5. **Quiz-check** with `quiz`, passing `node_id`. Pass -> `node_status(id, "locked")`. Miss -> teach into the specific misconception, re-check with a different question, then lock. Two misses -> `node_status(id, "shaky")` and go back to what it depends on.

Use `explain_back` once per lesson on the most important derived node (write the rubric first; grade honestly: what is right, then the one gap that matters).

When the goal node is locked: write the closing that restates the whole graph in a few sentences (the compressed version; name the click), store 1 to 3 durable notes with `remember`, `ask` what they want next, then `end_lesson`.

## Formatting

Your prose renders in the terminal AND in the browser companion (GitHub-flavored markdown, `$LaTeX$`, ```mermaid). Write math as LaTeX always. Keep each message to one node or one step. The quiz card carries the question; do not restate it in prose. Never mention tool names or phases as jargon to the learner. Just teach.
