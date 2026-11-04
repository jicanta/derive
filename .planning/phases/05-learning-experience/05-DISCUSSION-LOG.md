# Phase 5: Learning Experience - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-04
**Phase:** 05-learning-experience
**Areas discussed:** Home's shape, Due count everywhere, Retention stats home, Atlas by stability, Keyboard scheme, Focus mode, Status and prefetch, Voice chunking, Weakest prerequisite, Misconception distractors, Restart-safe cards, Honest stats math

All twelve gray areas offered were selected for discussion. Every question was answered with the recommended option.

---

## Home's shape

**Q: LEARN-01 wants review-first with nothing competing. Today Home is an editorial hero. What happens to it?**

| Option | Description | Selected |
|--------|-------------|----------|
| Next-step block on top | Review N due / Continue / Start new pinned above the hero; hero, topic input, graph and lesson index all stay; a learner with no lessons sees today's Home | ✓ |
| Hero becomes the next step | The three choices at hero scale for returning learners; topic input below the fold | |
| Promote the due line only | Keep Home's structure; move the due count from the footer stats line to one prominent review row above the topic input | |

**User's choice:** Next-step block on top (with the ASCII layout preview).
**Notes:** The hero is what makes Derive legible to a first-time visitor; the block is three links and should not cost a deliberate design.

**Q: When nothing is due, what does the block show?**

| Option | Description | Selected |
|--------|-------------|----------|
| Quiet line, then continue / new | "Nothing due today" in the review row's position, then Continue and Start new; one shape, one reading order | ✓ |
| Review row always present, greyed | Always three rows so positions never move; a dead control most days | |
| Block collapses when there is nothing to do | Block disappears entirely; Home is the hero with the topic input focused | |

**User's choice:** Quiet line, then continue / new.

---

## Due count everywhere

**Q: How does the due count reach every page? Only Home has a nav row; six pages have their own 60px headers.**

| Option | Description | Selected |
|--------|-------------|----------|
| Shared header component | One component (back arrow + title + due pill) used by all six headers; Home's nav row gets the same pill | ✓ |
| Add the pill to each header | Six independent edits, no new component, drift risk | |
| Nav row on every page | Home's nav row everywhere; adds chrome to the lesson screen | |

**User's choice:** Shared header component.
**Notes:** One place for Phase 6's style attributes to land, at the cost of refactoring six shipped headers that currently differ slightly.

**Q: What is `derive due` in Phase 5, before Phase 7 ships a bin?**

| Option | Description | Selected |
|--------|-------------|----------|
| MCP tool + slash command | A `due` tool on the existing stdio MCP server, `/derive:due` beside `/derive:learn` and `/derive:review`, plus a Codex skill; inherits the shell spelling with Phase 7's bin | ✓ |
| A node script now | `scripts/due.mjs` hitting `/api/stats`, run as `node scripts/due.mjs` | |
| Add the `derive` bin now | `bin: { derive }` with a `due` subcommand; literal but takes a slice of Phase 7 early | |

**User's choice:** MCP tool + slash command.

**Q: Does the due pill appear in the lesson header too?**

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — muted, everywhere | Grey and small in the lesson header like everywhere else; no exception to explain | ✓ |
| Everywhere except an active lesson | Lesson screen untouched; one screen, one next step, and that step is the card | |
| In the lesson only when idle | Shows only when no turn runs and no card is open | |

**User's choice:** Yes — muted, everywhere.
**Notes:** Accepted knowing the lesson header is the tightest in the app.

---

## Retention stats home

**Q: Where do the four retention figures live?**

| Option | Description | Selected |
|--------|-------------|----------|
| Atlas side panel | A third block beside "Due for review" and "Misconceptions caught"; no new route or nav entry | ✓ |
| Its own /progress page | Room for a forecast chart and per-topic breakdown; a new page outside Settings | |
| Behind Settings | A block on Usage or its own page from Settings; keeps the default UI untouched | |

**User's choice:** Atlas side panel.
**Notes:** Growth is read where the map of what the learner knows already lives.

---

## Atlas by stability

**Q: How should stability show, given the Atlas already colours by status and shares `DeriveNode` with the lesson graph?**

| Option | Description | Selected |
|--------|-------------|----------|
| Stability tints the locked fill | Locked stays gold; saturation/brightness tracks stability; due, shaky, teaching unchanged; one legend line | ✓ |
| Three stability bands | Fragile / holding / durable as discrete tones; easier to legend and to test | |
| Stability replaces status colour | Status moves to the hover card and side panel; costs the at-a-glance "what's due" signal | |

**User's choice:** Stability tints the locked fill.

**Q: Where does the tint live in code?**

| Option | Description | Selected |
|--------|-------------|----------|
| Optional prop, Atlas passes it | Optional `stability` in `DeriveNode`'s `Data`, tinting only when given; the lesson graph never passes it; mirrors how `due` is threaded | ✓ |
| A separate AtlasNode | Second component; lesson graph frozen by construction, two renderers to keep in sync | |
| Both graphs tint | Honest, and every node in a live lesson would read as fragile | |

**User's choice:** Optional prop, Atlas passes it.

---

## Keyboard scheme

**Q: LEARN-02 wants 1-4/A-D, Enter and `?` for help. `?` already means "I don't know" on a quiz; Ask uses 1-4; Explain uses ⌘↵; the method caps quiz options at three.**

| Option | Description | Selected |
|--------|-------------|----------|
| One scheme; `?` becomes help | Digit and letter pick the same slot, Enter commits, Shift+Enter unsure, `0` keeps don't-know, `?` opens a help overlay | ✓ |
| One scheme; help on another key | Same picking keys; `?` keeps don't-know and help opens on `h` | |
| Per-card schemes plus a help overlay | Each card keeps its own keys; overlay documents whichever is open | |

**User's choice:** One scheme; `?` becomes help.
**Notes:** `0` already covers "I don't know", so the collision costs one shipped habit and nothing else.

**Q: What does `?` open?**

| Option | Description | Selected |
|--------|-------------|----------|
| Keys for the open card | Small overlay naming only the keys that work right now; `?` or Esc dismisses | ✓ |
| Keys plus what the card is for | Also explains pretest / cumulative / "not sure"; more copy to keep true and translate | |
| No overlay — inline hints on every card | Extend the shipped `kbd` row; leaves `?` doing nothing | |

**User's choice:** Keys for the open card.

**Q: What do the two cards with no options get (Explain, Plan)?**

| Option | Description | Selected |
|--------|-------------|----------|
| Enter commits on both | Explain submits on Enter past the word floor, Shift+Enter newlines, ⌘↵ still works; Plan approves on Enter | ✓ |
| Plan gets Enter, Explain keeps ⌘↵ | A teach-back is prose where Enter should stay a newline | |
| Only cards with options get keys | "Every card" becomes "every card with options" | |

**User's choice:** Enter commits on both.

---

## Focus mode

**Q: What does focus mode hide, and how do you enter and leave?**

| Option | Description | Selected |
|--------|-------------|----------|
| Card + the words above it | Hides rail, graph and header chrome; timeline collapses to the card plus the prose above it; composer stays; `f` / Esc; `data-focus` on `<html>` | ✓ |
| The card and nothing else | No prose, no composer until you leave; purest reading | |
| Hide the side panels only | Keep header and timeline, widen the reading column; arguably a layout toggle | |

**User's choice:** Card + the words above it.

**Q: Does it persist?**

| Option | Description | Selected |
|--------|-------------|----------|
| Session only, not persisted | Resets on leaving the lesson; no storage, no migration, no endpoint | ✓ |
| localStorage, like the voice toggle | A `derive.focus` key surviving reloads in that browser | |
| Per learner, server-side | Follows the learner across browsers; spends a migration on a view toggle | |

**User's choice:** Session only, not persisted.

---

## Status and prefetch

**Q: The status half is largely shipped. What can "the next card is prefetched" honestly mean when every card blocks on the learner?**

| Option | Description | Selected |
|--------|-------------|----------|
| Prefetch only where the queue is known | Status gains the grading line; prefetch exists only in review and warm-up lessons, whose sequence is the due queue; nothing prefetched in a teaching lesson, recorded as a narrowing | ✓ |
| Speculative generation after each answer | Generate the likely-next card and discard it if the branch differs; extra tokens on discarded turns, risks a card the method would not have chosen | |
| No prefetch; spend it on perceived latency | Drop the clause; leaves half of LEARN-11 explicitly unmet | |

**User's choice:** Prefetch only where the queue is known.
**Notes:** Flagged to the user before writing CONTEXT.md that this is a deliberate narrowing of LEARN-11 and will be checked against success criterion 2; it is recorded in CONTEXT.md as a named deviation with its reason.

---

## Voice chunking

**Q: Where does sentence chunking happen? Today a whole block is one utterance, spoken only once it has finished streaming.**

| Option | Description | Selected |
|--------|-------------|----------|
| Speak sentences as they stream | Split while the block is arriving; mic arms after the last sentence; needs the voice hook to read streaming items it skips today | ✓ |
| Sentences, but only once the block is done | Literal, smoother prosody, interruptible mid-block, no latency win | |
| Stream, but chunk on paragraphs | Fewer seams, most of the latency win, not what the requirement says | |

**User's choice:** Speak sentences as they stream.

**Q: How does free-text `prefs.language` become a speech locale?**

| Option | Description | Selected |
|--------|-------------|----------|
| Committed name→locale table | Pure-data module like `prices.ts` / `providers.ts`, no I/O, testable with no browser; falls back to `navigator.language` | ✓ |
| Match the browser's installed voices | No table, only picks voices that exist; varies by OS, untestable headless | |
| Intl.DisplayNames reverse lookup | Covers endonyms for free; more code, browser-dependent, still needs a fallback | |

**User's choice:** Committed name→locale table.
**Notes:** The roadmap asks for a `voice.test.ts`, which the other two options would not support.

---

## Weakest prerequisite

**Q: `dependencyRecord()` hands the model every dependency and says "re-check the weakest". LEARN-09 says Derive names it. Who picks it?**

| Option | Description | Selected |
|--------|-------------|----------|
| Server picks one and enforces it | Ranks dependencies, names exactly one, and refuses a quiz elsewhere in the shape `nodeStatus` already uses | ✓ |
| Server names one, no refusal | Same ranking; the tutor may still choose differently; only the nightly harness would notice drift | |
| Keep the list, sharpen the wording | No ranking; leaves "Derive names the weakest" untrue | |

**User's choice:** Server picks one and enforces it.

**Q: How does the server rank "weakest"?**

| Option | Description | Selected |
|--------|-------------|----------|
| Direct deps, retrievability then checks | Node's own `depends_on`, lowest `retrievability()` first, tie-broken by this lesson's checks then status; keeps the one-step-down discipline | ✓ |
| Walk down to the weakest anywhere below | Finds the true root cause; can jump a learner from the goal to a ground truth | |
| Direct deps, this lesson's checks only | Simplest; blind to a dependency locked weeks ago and since decayed | |

**User's choice:** Direct deps, retrievability then checks.

**Q: What lifts the refusal?**

| Option | Description | Selected |
|--------|-------------|----------|
| A pass on the named node, or the learner types | Method holds against the model, never against the learner; nobody is trapped | ✓ |
| Also lifts after two misses on the named node | Handles a wrongly-named prerequisite; per-remediation counting state | |
| Only a pass on the named node | Strictest; a learner who wants to move on has no way to say so | |

**User's choice:** A pass on the named node, or the learner types.

---

## Misconception distractors

**Q: Recorded misconceptions reach the tutor only as a profile list it is told not to recite. How do they reach the moment a question is written?**

| Option | Description | Selected |
|--------|-------------|----------|
| On the tool result that starts the node | The `teaching` result (and the remediation path) carries that node's misconceptions verbatim as candidate distractors; rides the existing `instruction` channel | ✓ |
| A per-node section in the prompt | One place to look; sits in the cached stable prefix and grows through the lesson | |
| A method-text rule only | One-line diff to the single method source; weakest enforcement, nothing proves it happened | |

**User's choice:** On the tool result that starts the node.

---

## Restart-safe cards

**Q: An open prompt is a Promise resolver in memory, so a persisted card cannot resume its `await`. What happens when the learner answers a rehydrated card?**

| Option | Description | Selected |
|--------|-------------|----------|
| Answering starts a fresh turn | Card restored live; answering grades normally and starts a new turn with that result, resumed from `turn_messages` where allowed | ✓ |
| Rehydrate read-only with a next step | Comes back visibly interrupted using the existing `disabled` state; the learner loses the question | |
| Answer is sent as a message | Simplest resume; skips grading, FSRS and the misconception record | |

**User's choice:** Answering starts a fresh turn.

**Q: How far does the `prompts` table go, given terminal lessons keep in-memory `held` / `recentCards` maps?**

| Option | Description | Selected |
|--------|-------------|----------|
| Table replaces the in-memory held map | One persisted record per open card; the 409 check reads the table; plugin and Codex paths get restart safety for free | ✓ |
| Persist both, keep the maps as a cache | Lower risk to the companion flow; two places that can disagree | |
| App lessons only | Narrowest; LEARN-12 says open cards, not app cards | |

**User's choice:** Table replaces the in-memory held map.
**Notes:** Rated one-way in CONTEXT.md — a migration plus a rewrite of the companion held-card flow.

---

## Honest stats math

**Q: What are the retention numbers computed from?**

| Option | Description | Selected |
|--------|-------------|----------|
| Retrievability sum, measured retention, 14-day forecast; hide thin figures | Knowledge = `retrievability()` summed over locked nodes; retention = review-purpose first-try rate over 90 days vs the fixed 0.9; forecast = 14 days of due counts; "not enough reviews yet" below ~10 data points | ✓ |
| Same numbers, always shown with their n | Maximum transparency; a first review shows a meaningless 100% | |
| Retention over every graded check | Bigger sample sooner; folds first-exposure questions into a number labelled retention | |

**User's choice:** Retrievability sum, measured retention, 14-day forecast; hide thin figures.

---

## What proves these hold

**Q: What gates the new behaviour?**

| Option | Description | Selected |
|--------|-------------|----------|
| No-model HTTP tests + one harness assertion + the two unit tests | API-suite tests for the ranking, the gate and the rehydration; one conformance assertion on a real provider; `voice.test.ts` and the reducer test the roadmap asks for | ✓ |
| No-model tests + the two unit tests; harness unchanged | Cheaper; the harness is the only thing that sees a real provider drift | |
| Harness assertion only | Closest to a learner's experience; invisible in ordinary CI | |

**User's choice:** No-model HTTP tests + one harness assertion + the two unit tests.

---

## Claude's Discretion

The user did not open these; they are recorded in CONTEXT.md with the direction the planner should take.

- The stability ramp's endpoints and curve; the exact thin-figure threshold; the forecast's rendering shape.
- The `prompts` table's columns and lifecycle, and how its boot sweep relates to the existing stale-turn close.
- Where the ranking helper lives (`actions.ts` vs a pure function in `schedule.ts`) and how the remediation gate's open state is held.
- The `due` tool's output shape and the `/derive:due` copy; whether the Codex skill is a sibling of `derive-review` or a flag on it.
- The sentence-splitting rule and the name→locale table's initial entries.
- Whether the next-step block is its own component, and whether the shared header absorbs the lesson header's PhaseBar and locked count.
- Where the `?` overlay is mounted.

## Deferred Ideas

No ideas were raised outside the phase boundary. Items already placed elsewhere by the roadmap are recorded in CONTEXT.md's `<deferred>` section so nobody re-opens them inside Phase 5: LEARN-13..17 (graph reuse, 10-minute sessions, the retention slider, streaks, reminders), Phase 6's style and language pickers, Phase 7's packaging and docs, learner-facing capability badges and cost analytics, and the standing debt in `.planning/codebase/CONCERNS.md`.

When "Explore more gray areas" was offered at the end, three candidates were named and declined: Home's rows at 375px (the open `03-UI-REVIEW` finding), whether the shared header absorbs the lesson header's PhaseBar and locked count, and what the review-lesson prefetch does to per-lesson cost. The first two are noted in CONTEXT.md as canonical refs and discretion items; the third follows from D-17.
