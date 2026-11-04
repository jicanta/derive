# Phase 5: Learning Experience - Context

**Gathered:** 2026-11-04
**Status:** Ready for planning

<domain>
## Phase Boundary

The tutor carries the workflow instead of the learner. Concretely: Home leads with what to do next (review first), the due count is visible on every page and from a command, every card answers from the keyboard with one scheme and a help key, a focus mode hides everything but the card being answered, the learner sees honest FSRS-derived retention stats and an Atlas whose colour tracks memory stability, remediation names and re-quizzes one weakest prerequisite instead of handing the model a list, quiz distractors draw on the learner's own recorded misconceptions, voice speaks in sentence chunks in the learner's language, and an open card survives a server restart. Requirements LEARN-01, LEARN-02, LEARN-03, LEARN-04, LEARN-07, LEARN-08, LEARN-09, LEARN-10, LEARN-11, LEARN-12.

Not in this phase: theme, accent, font, size, reduced motion, tutor tone and the language picker (Phase 6 — this phase reads `prefs.language` as it exists today and introduces the `<html>` attribute convention Phase 6 extends); packaging, the published `bin`, marketplaces and docs (Phase 7 — `derive due` is delivered through the MCP server and the plugin, and inherits the shell spelling when Phase 7 adds the bin); provider and cost work (Phases 1–4, complete). Deferred to v2 and out of scope per PROJECT.md: graph reuse across lessons (LEARN-13), bounded "I have 10 minutes" sessions (LEARN-14), a per-learner desired-retention slider (LEARN-15 — desired retention stays the fixed 0.9 in `schedule.ts`), streaks and daily goals (LEARN-16), review reminders and notifications (LEARN-17).

**One deviation is deliberate and is recorded as one, not omitted:** LEARN-11's "the next card is prefetched" is implemented only where the next card is knowable without guessing (D-17). Success criterion 2 must be read against that decision.

</domain>

<decisions>
## Implementation Decisions

### Home and the next step (LEARN-01)

- **D-01:** Home gains a **next-step block pinned above the existing hero**, in fixed order: `Review N due →`, `Continue "<topic>" →`, `Start new ↓`. The editorial hero (headline, topic input, example graph, lesson index, stats footer) **stays below it, unchanged**, and a learner with no lessons sees today's Home exactly as it is. Review leads because it leads in the method; the hero stays because it is what makes Derive legible to someone arriving for the first time. **Explicitly rejected:** replacing the hero for returning learners (the strongest reading of "nothing competing", and it discards a deliberate design for a block that is three links), and merely promoting the existing footer due line (does not make Home lead with the next step). — **Reversibility:** reversible.
- **D-02:** With **nothing due**, the review row becomes a **quiet "Nothing due today" line in the same position**, then `Continue` and `Start new`. The block keeps one shape and one reading order every day; the review row earns prominence only when there is something to review. No dead control, no block that appears and disappears. — **Reversibility:** reversible.

### The due count everywhere (LEARN-03)

- **D-03:** One **shared page-header component** (back arrow, title, due pill) is extracted and used by all six page headers — Lesson, Atlas, Library, You, Settings, Usage — and Home's nav row carries the same pill. One element, one place to change, and one place for Phase 6's style attributes to land. **Explicitly rejected:** adding the pill to each of six headers independently (cheapest now, drifts immediately, and the six headers already differ slightly). — **Reversibility:** costly — six shipped page headers are refactored onto one component and Phase 6 styles it; undoing it means re-splitting them.
- **D-04:** The pill **appears in the lesson header too**, grey and small, linking to review. "Everywhere" then has no exception to explain, and a learner mid-lesson reads it as information rather than a nudge. This is accepted knowing the lesson header is the tightest in the app (it already carries the `provider · model · cost` pill, the PhaseBar, the locked count, voice, export and the live dot) — the planner must fit it there, not widen the page. — **Reversibility:** reversible.
- **D-05:** `derive due` is delivered in this phase as a **`due` tool on the existing stdio MCP server**, surfaced as **`/derive:due`** beside `/derive:learn` and `/derive:review`, plus a **matching Codex skill**. It works in both terminals today with no packaging, and when Phase 7 adds the `derive` bin the shell spelling comes along for free. Note for the planner: `due` is a **learner-facing MCP command, not a tutor tool** — it joins `start_lesson` / `answer` / `learners` / `end_lesson` in `server/src/mcp.ts` and does **not** enter `DERIVE_TOOL_NAMES`, `agent.ts` `buildTools` or the external-action switch, so the four-place tool-set rule does not apply. **Explicitly rejected:** a `scripts/due.mjs` (not spelled `derive due` until Phase 7 either) and adding `bin: { derive }` now (takes a slice of Phase 7's packaging decision early). — **Reversibility:** reversible.

### Retention stats (LEARN-04)

- **D-06:** The stats live as a **third block in the Atlas side panel**, beside "Due for review" and "Misconceptions caught". Growth is read where the map of what the learner knows already lives: no new route, no new nav entry, and the Atlas header already shows locked / due / shaky / lessons. **Explicitly rejected:** a new `/progress` page (a page outside Settings needs its own learning reason, and the Atlas already is the progress surface) and burying them behind Settings (honest progress should not be something a learner goes looking for). — **Reversibility:** reversible.
- **D-07:** The four figures are computed as: **estimated knowledge** = the sum of `retrievability()` over the learner's locked nodes, read as "about 23 of 31 nodes held right now"; **true retention** = the share of **review-purpose** quizzes passed first try over the **last 90 days**; **desired retention** = the fixed `request_retention: 0.9` in `server/src/schedule.ts` (there is no slider — LEARN-15 is v2); **forecast** = due counts per day for the **next 14 days** from `review_at`. **Explicitly rejected:** measuring retention over every graded check (probe, pretest, check and cumulative included) — a bigger sample sooner, but it folds first-exposure questions the method *expects* to be missed into a number labelled retention. — **Reversibility:** reversible.
- **D-08:** A figure backed by **fewer than ~10 data points reads "not enough reviews yet"** rather than a number, so the panel is never confidently wrong. **Explicitly rejected:** always printing the figure with its sample ("100% over 1 review") — more transparent, and it still shows a perfect score that means nothing on a learner's first review. — **Reversibility:** reversible.

### The Atlas coloured by stability (LEARN-07)

- **D-09:** **Stability tints the locked fill.** A locked node stays gold; how saturated and bright that gold is tracks the node's FSRS stability, so a freshly locked node reads faint and a node held for months reads solid. Due, shaky and teaching keep **exactly** their current treatment, and one legend line is added. Growth becomes visible as the map warming up over weeks. **Explicitly rejected:** three discrete bands (easier to legend and to assert, less of the continuous "growth" reading the requirement asks for) and replacing status colour with stability outright (costs the learner the at-a-glance "what is due" signal the Atlas gives today). — **Reversibility:** reversible.
- **D-10:** The tint is an **optional `stability` field in `DeriveNode`'s `Data`** that tints only when a value is given. **The Atlas passes it; the in-lesson graph never does**, so in-lesson colouring is byte-identical to today — which matters because in a live lesson every locked node was locked minutes ago and would read as uniformly fragile. Mirrors how `due` is already threaded through `layoutGraph`. **Explicitly rejected:** forking a second `AtlasNode` component (two renderers to keep visually in sync, against the one-component-per-file convention) and tinting both graphs. — **Reversibility:** reversible.

### One keyboard scheme (LEARN-02)

- **D-11:** **One scheme on every card that offers options:** the **digit and the letter both pick the same slot** (quiz has at most three options by `method/30-quiz-options.md`; Ask has up to four), **Enter** commits, **Shift+Enter** commits as unsure, **`0`** stays "I don't know", and **`?` is reassigned to the help overlay**. This resolves the collision in the requirement's favour: `?` currently answers "I don't know" on a quiz, and `0` already does the same job, so nothing is lost but one shipped habit. **Explicitly rejected:** keeping `?` as "I don't know" and putting help on `h` (reads the requirement as "a help key" rather than that character), and per-card schemes behind a help overlay (leaves "answer every card from the keyboard" as four habits instead of one). — **Reversibility:** reversible.
- **D-12:** **`?` opens a small overlay naming only the keys that work for the card that is open** — pick, answer, unsure, don't know, focus, stop — dismissed with `?` or Esc. Nothing to scroll, nothing that can go stale, and it answers the question a learner pressing `?` actually has. **Explicitly rejected:** an overlay that also explains the card type (what a pretest is, why the cumulative quiz comes last, what "not sure" does to the schedule) — teaching the method at the moment of curiosity is attractive, but it is copy to keep true and to translate once Phase 6 adds languages. — **Reversibility:** reversible.
- **D-13:** The two cards with no options get the same habit: **Explain submits on Enter** once past its eight-word floor, with **Shift+Enter inserting a newline** and `⌘↵` still working for anyone who learned it; **Plan approves on Enter** (typing in the composer is already how plan feedback is given). **Explicitly rejected:** leaving Explain on `⌘↵` because a teach-back is prose (defensible — an accidental submit costs the learner their explanation; mitigated by the word floor and by Shift+Enter being the newline), and leaving both cards keyboard-less. — **Reversibility:** reversible.

### Focus mode (LEARN-08)

- **D-14:** Focus mode **hides the outline rail, the dependency map and the header chrome**, and collapses the timeline to **the open card plus the tutor's prose immediately above it**. The **composer stays** — the learner must still be able to type or steer. **`f` toggles, Esc leaves.** Implemented as **`data-focus` on `<html>`**, which is where Phase 6's style attributes will sit. **Explicitly rejected:** the card and literally nothing else (takes away the explanation a learner may be mid-way through, and the escape hatch of typing) and hiding only the side panels (a layout toggle, not a focus mode). — **Reversibility:** reversible.
- **D-15:** Focus is **session-only and not persisted**. It is a posture for right now, `f` makes re-entering free, and it resets when the learner leaves the lesson. No storage key, no migration, no endpoint — and no learner landing in a stripped-down lesson days later wondering where the graph went. **Explicitly rejected:** `localStorage['derive.focus']` mirroring the voice toggle, and per-learner server-side persistence (spends a migration and an endpoint on a view toggle, inside the phase that is about learning; Phase 6 is the phase that owns persisted style). — **Reversibility:** reversible.

### Streaming status and the prefetch clause (LEARN-11)

- **D-16:** The status half is **mostly already shipped and is kept, not rebuilt**: both the Claude driver and the owned loop already emit ephemeral tool-named lines from `TOOL_LABELS` ("Writing a question", "Drawing the plan", "Verifying with a web search") plus "Thinking". This phase **adds the missing grading line** and makes sure the status is not suppressed where the learner is in fact waiting. It stays an **ephemeral `status` event** — no new `EVENT_TYPES` entry, no `applyEvent` branch, nothing new in the Obsidian mirror — per 01 D-14 and 03 D-09/D-10. — **Reversibility:** reversible.
- **D-17:** **Prefetch is implemented only where the next card is knowable without guessing: review and warm-up lessons**, whose sequence is the due queue, so the next node's question can be prepared while the learner reads the current verdict. **In a teaching lesson nothing is prefetched**, because the tutor chooses the next card from the answer that has not been given yet. **This narrows LEARN-11 as written and is recorded as a deviation, with its reason, rather than quietly dropped.** **Explicitly rejected:** speculative generation of the likely-next card after each answer (satisfies the wording everywhere, spends tokens on turns that get discarded — visible in the lesson's own cost figure under COST-02 — and risks showing a card the method would not have chosen) and dropping the clause entirely with nothing in its place. — **Reversibility:** reversible.

### Voice mode (LEARN-10)

- **D-18:** Voice **splits at sentence boundaries while the block is still arriving and speaks each sentence as it completes**, so the tutor starts talking about a second in instead of after the whole paragraph; the **mic arms after the block's last sentence**, as it does today. This is the latency win that justifies touching voice at all, and it requires `useVoiceMode` to read **streaming** items, which it deliberately skips today (`if (it.streaming) continue`). **Explicitly rejected:** sentence chunks only once the block has finished (satisfies the wording, smoother prosody, no latency win) and chunking on paragraph boundaries instead. — **Reversibility:** reversible.
- **D-19:** `prefs.language` (free text, max 60 chars — "Spanish", "español", "Brazilian Portuguese") is resolved to a BCP-47 tag through a **committed pure-data name→locale table**, with the same discipline as `server/src/prices.ts` and `server/src/providers.ts`: no I/O, no import-time side effect, readable by a test with no browser. **Unknown text falls back to `navigator.language`** and voice carries on rather than failing. A new language is a reviewable one-line diff. **Explicitly rejected:** matching against `speechSynthesis.getVoices()` (can only pick a voice that exists, but varies by OS and cannot be tested headless — and the roadmap asks for a `voice.test.ts`) and an `Intl.DisplayNames` reverse lookup (no table to maintain, more code, browser-dependent output, still needs a fallback). — **Reversibility:** reversible.

### Sharper remediation (LEARN-09)

- **D-20:** **The server names exactly one prerequisite and enforces it.** Where `dependencyRecord()` today hands the model every direct dependency and says "re-check the weakest of those", the instruction now names one: *re-check "<label>" [id] with one fresh quiz, tests "intuition"*. A `quiz` call on a different node while that remediation is open is **refused**, in the same `{ ok: false, refused: true, error }` shape and with the same "This is the method, not an error to investigate" wording `nodeStatus` already uses. Deterministic, testable with no model, and it holds on a weak local model — the one most likely to wander. **Explicitly rejected:** naming one without refusing anything (the nightly harness would be the only thing that noticed drift, after the fact) and keeping the list with more insistent wording (leaves "Derive names the weakest" something the model does or does not do, which is what the requirement exists to fix). — **Reversibility:** reversible.
- **D-21:** "Weakest" ranks **the node's own `depends_on` only**: **lowest `retrievability()` first**, tie-broken by **what this lesson's checks showed on each** (a miss beats a pass), then by **status** (shaky before pending before locked). Bounded, reads what `dependencyRecord()` already reads, and keeps the method's one-step-down discipline — remediation drops one level, not into a graph search. **Explicitly rejected:** recursing to the weakest node anywhere in the subgraph (finds the true root cause when the gap is two levels down, and can send a learner who missed the goal all the way to a ground truth) and ranking on this lesson's checks alone (blind to a dependency locked weeks ago in another lesson and since decayed, which is exactly what FSRS is there to see). — **Reversibility:** reversible.
- **D-22:** The refusal **lifts when a fresh quiz on the named node is graded, or the moment the learner types a message** (the existing steer path, which already closes an open card and hands the text over). **The method holds against the model, never against the learner** — nobody is trapped by a model that keeps failing to ask the right question. **Explicitly rejected:** also lifting after two misses on the named node (handles the case where the named prerequisite was not the problem, at the cost of per-remediation counting state and a second exit to keep correct) and lifting only on a pass (strictest fidelity, and a learner who wants to move on has no way to say so). — **Reversibility:** reversible.
- **D-23:** Recorded misconceptions reach quiz construction **on the tool result that starts the node** — when the tutor marks a node `teaching`, and again on the remediation path, the result carries **that node's recorded misconceptions verbatim as candidate distractor material**, with one line telling the tutor to mutate the correct claim toward them. It rides the existing `instruction` channel (the project's stated way to steer the model), needs no new tool and no method-text change, and arrives exactly when the question is being written. **Explicitly rejected:** a per-node section in the prompt (sits in the cached stable prefix per 03 D-06, grows through the lesson, and is as far from the moment of writing as today's flat profile list) and a method-text rule alone (a one-line diff to the single method source, weakest enforcement, and nothing proves it happened). — **Reversibility:** reversible.
- **D-24:** **"Warm-up and cumulative quiz are named in the UI" is already shipped and is not rebuilt:** the warm-up card reads "warm-up · due from earlier lessons" with its reason, and `QuizCard` already headings "Cumulative quiz · <node>", "Review · <node>", "Before the explanation · <node>" and the `intuition` / `transfer` / `procedure` label. The planner verifies this against LEARN-09 and spends its effort on D-20..D-23 instead. — **Reversibility:** reversible.

### Restart-safe cards (LEARN-12)

- **D-25:** Open cards move into a **`prompts` table** through the Phase 1 numbered transactional migration runner, and **that table becomes the source of truth for both ordinary and held cards** — replacing `index.ts`'s in-memory `held` map, including the 409 "a card is already open" check. The Claude Code plugin and Codex paths therefore get restart safety for free. This is the real fix to the debt PROJECT.md names ("pending and held cards vanish on restart"), and it is accepted knowing it touches the companion path that must keep working through the migration. **Explicitly rejected:** persisting alongside the maps and keeping them as a cache (two places that can disagree about whether a card is open — the exact bug class this requirement exists to kill) and persisting app lessons only (LEARN-12 says open cards, not app cards). — **Reversibility:** one-way — a numbered migration adds the table and the 409 check and the companion held-card flow are rewritten to read it; reverting needs a second migration and restores the in-memory map the plugin path has by then stopped relying on.
- **D-26:** On boot the persisted card is **restored so the browser shows a live card**, and **answering it grades it server-side as normal** (quiz result, FSRS schedule, misconception record — all work the server already owns) and **starts a fresh turn whose input is that result**, resumed from `turn_messages` where the provider allows it (03 D-04, D-07). The learner never meets a dead card and never loses a graded answer. The in-memory Promise resolver cannot be revived, so a new turn is what "rehydrated" has to mean. **Explicitly rejected:** restoring it read-only with a next step (honest and small, and the learner loses the question they were part-way through — most of what LEARN-12 complains about) and sending the answer as a plain message (skips grading, the FSRS update and the misconception record, which is precisely the work the server exists to do rather than the model). — **Reversibility:** costly — the resume path reads `turn_messages` and the tool-call idempotency record from Phase 3; changing the grain later touches both.

### What proves these hold

- **D-27:** Three gates, each **seen failing with its subject planted before it is kept**, per PROJECT.md's rule that a prohibition with no source gate is a claim with nothing behind it: (1) **no-model HTTP tests** for the weakest-prerequisite ranking, the remediation refusal and its two exits, and the restart rehydration — the `server/test/api.test.ts` / `setDriverOverride` + `drivers/fake.ts` pattern; (2) **one new assertion in the nightly conformance harness** that the remediation gate held on a real provider, beside its existing gate / pretest / cumulative assertions, so a provider quietly ignoring the named-node instruction is caught; (3) the **`voice.test.ts` and `applyEvent` reducer test** the roadmap research note already asks for. **Explicitly rejected:** no-model tests alone (the harness is the only thing that sees a real provider drift) and the harness alone (needs keys or a local model, so a regression would be invisible in ordinary CI). — **Reversibility:** reversible.

### Claude's Discretion

The user did not open these; the planner decides them in the direction recorded here.

- **The stability ramp's endpoints and curve** (D-09): which stability values map to the faintest and the most solid gold, and whether the ramp is linear in stability or in `log` days. Use `color-mix()` against `--color-gold-500` as the existing node tones already do.
- **The exact thin-figure threshold** (D-08): "~10 data points" is the intent; the concrete number, and whether it differs per figure.
- **The forecast's rendering**: a 14-bar sparkline, a short list, or a sentence. The UI-SPEC locks the look; the planner picks the shape it proposes.
- **The `prompts` table's columns and lifecycle** (D-25): the payload encoding, how a settled prompt is retired (deleted vs flagged), and how the sweep on boot relates to the existing stale-turn close in `index.ts`.
- **Where the ranking helper lives** (D-21): `actions.ts` beside `dependencyRecord`, or a pure function in `schedule.ts` that takes rows and returns an order (the latter is testable with no database, like the rest of `schedule.ts`).
- **How the remediation gate's open state is held** (D-20/D-22): a column on the node, a row in the new `prompts` table, or a module-level map — with the restart behaviour stated either way.
- **The `due` tool's output shape and the `/derive:due` copy** (D-05), and whether the Codex skill is a sibling of `derive-review` or a flag on it.
- **The sentence-splitting rule** (D-18): abbreviation and decimal handling, and the minimum chunk length below which a fragment waits for the next one.
- **The name→locale table's initial entries** (D-19) — English names plus endonyms for the languages the method already mentions is enough to start.
- **Whether the next-step block is its own component or inline in `Home.tsx`** (D-01), and whether the shared header (D-03) absorbs the lesson header's PhaseBar and locked count or leaves them as page-specific children.
- **Where the `?` overlay is mounted** (D-12): a sibling of the card, or one lesson-level overlay reading the active card.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap and requirements
- `.planning/ROADMAP.md` §"Phase 5: Learning Experience" — the goal, the five success criteria, and the research note that fixes: no research needed (Anki, Math Academy and Duolingo patterns are documented and the FSRS data already exists); **held cards live in a `prompts` table via the Phase 1 migration runner**; **focus mode is a `data-focus` attribute on `<html>` next to the Phase 6 style attributes**; **add `voice.test.ts` and an `applyEvent` reducer test**; graph reuse across lessons stays deferred to v2.
- `.planning/REQUIREMENTS.md` §"Learning experience" — LEARN-01..04, LEARN-07..12, the requirement→phase map, and the v2 list that bounds this phase (LEARN-13..17: graph reuse, 10-minute sessions, the retention slider, streaks and daily goals, reminders).
- `.planning/PROJECT.md` §Core Value, §Context, §Constraints, §Out of Scope, §Key Decisions — the binding **simplicity rule** (one screen, one next step; a control outside Settings needs a one-sentence learning reason); the named debt this phase clears ("pending and held cards vanish on restart"); the rule that **a prohibition with no source gate is a claim with nothing behind it** (D-27); the eight requirements moved to v2 on 2026-09-17 under the simplicity rule.

### UI design contract
- `.planning/phases/05-learning-experience/05-UI-SPEC.md` — **does not exist yet.** Phase 5 is `UI hint: yes`; run `/gsd-ui-phase 5` to produce it. It locks copy, colour, typography, spacing and component reuse for the next-step block (D-01, D-02), the shared header and due pill (D-03, D-04), the Atlas retention block (D-06..D-08), the stability tint (D-09), the help overlay (D-12), focus mode (D-14) and the rehydrated card (D-26). Frontend plans must read it first.
- `.planning/phases/03-owned-loop-api-keys-and-gateways/03-UI-REVIEW.md` — **open advisory, 15/24**, and two of its findings land exactly where this phase builds: the cost segment squeezing the lesson topic in the header (D-04 adds a pill to that same header) and **Home's rows overlapping at 375px** (D-01 adds a block to Home). Read before planning either.
- `.planning/phases/04-local-models-parity-proof-and-usage/04-UI-SPEC.md` and `02-UI-SPEC.md` — the shipped page-header and row shapes the shared header of D-03 must not contradict.

### Prior-phase decisions this phase builds on
- `.planning/phases/01-foundation/01-CONTEXT.md` — the numbered transactional migration runner (D-25's table), D-06 (strict server-side action validation — the refusal shape D-20 reuses), D-14 (transient state is ephemeral and never enters the event log, the reducer or the Obsidian mirror — binding on D-16), D-02/D-04 (one method source rendered to targets, CI fails on drift — binding on anything that touches `method/`).
- `.planning/phases/03-owned-loop-api-keys-and-gateways/03-CONTEXT.md` — D-04 (`turn_messages` persists provider-neutral messages; a provider change drops them) and D-07 (tool-call idempotency is persisted) — together the resume path D-26 starts a fresh turn through; D-06 (the cached stable prefix, which is why D-23 uses a tool result rather than the prompt); D-09/D-10/D-17 (ephemeral `status`, no new event type, cost recomputed at `turn_end`); D-13 (the one header pill D-04 must fit beside).
- `.planning/phases/04-local-models-parity-proof-and-usage/04-CONTEXT.md` — D-15..D-18 (the nightly conformance harness, its two run environments, its JSON + Markdown report and non-zero exit — where D-27's new assertion lands); D-21 (internal diagnostics stay internal rather than becoming a learner-facing badge).
- `.planning/codebase/CONCERNS.md` — the known debt list, including the non-transactional `replaceGraph`/`deleteLesson` and the absent linter. Note the maps in `.planning/codebase/` were written at commit `7d7db1f` (2026-09-17) and predate Phases 1–4; the live source is authoritative.

### Code that defines the contracts this phase extends
- `server/src/prompts.ts` — `openPrompt`, `answerPrompt`, `hasPending`, `pendingPrompt`, `cancelPending`, the `pending` Map and the held-prompt doc comment. The whole module is what D-25 persists.
- `server/src/index.ts` — the `held` / `recentCards` maps, `holdCard`, the one-held-card 409, the boot-time stale-turn close, `/api/stats`, `/api/review`, `startReview`, `lessonView`, `learnerOf`. D-25 rewrites the held bookkeeping here; D-07's figures are served from here.
- `server/src/actions.ts` — `afterQuiz`, `afterCumulative`, `dependencyRecord`, `nodeStatus`, `needsUnderstanding`, `openQuiz` (grading, `recordQuiz`, `addMisconception`), `profile`, `withNotice`. D-20..D-23 all land in this file.
- `server/src/schedule.ts` — `retrievability()`, `schedule()`, `grade()`, `implicitRepetition`, `implicitLapse`, and `request_retention: 0.9` (D-07's desired retention, and the reason there is no slider). Pure, no I/O: the right home for D-21's ranking if the planner puts it here.
- `server/src/db.ts` — `dueNodes`, `stats`, `listMisconceptions`, `addMisconception`, `resolveMisconceptions`, `recordQuiz`, `hasUnderstandingPass`, `cumulativeStatus`, `buildWarmup`, `buildReviewGraph`, `learnerProfile`, `LearnerPrefs` (`language`, max 60 chars, free text — D-19's input), `cleanPrefs`.
- `server/src/migrations.ts` — the numbered transactional runner and its eleven existing migrations; the `prompts` table is the next one (D-25).
- `server/src/tools.ts` — `TOOL_REGISTRY`, `TOOL_LABELS` (the shipped status vocabulary D-16 keeps), `DERIVE_TOOL_NAMES`, `jsonSchemaOf(spec, surface)`.
- `server/src/mcp.ts` — the learner-facing MCP commands (`start_lesson`, `attach_material`, `answer`, `answer_in`, `learners`, `end_lesson`) that `due` joins (D-05), and the `api()` proxy.
- `plugin/commands/learn.md`, `plugin/commands/review.md`, `codex/skills/derive-learn/`, `codex/skills/derive-review/` — where `/derive:due` and its Codex sibling go (D-05).
- `server/src/drivers/api.ts` and `server/src/agent.ts` — the two places `status` is emitted via `TOOL_LABELS` (D-16).
- `method/30-quiz-options.md` — "Two or three real options", distractors mutated from a specific misconception, "the app adds *I don't know* itself". Bounds D-11's key range and is the method text D-23 deliberately does **not** change.
- `method/40-discipline.md` §"Targeted remediation, not re-explanation" and `method/20-tools.md` §`node_status` — the method sentences D-20..D-22 make literally true.
- `web/src/pages/Home.tsx` — the hero, the topic form, `EXAMPLE`, the stats footer line carrying today's due count, and the lesson index (D-01, D-02).
- `web/src/pages/Lesson.tsx` — the 60px header, the three-column grid, the timeline switch, `activePromptId` / `waiting`, the status line's `!waiting` suppression, `Legend` (D-03, D-04, D-14, D-16).
- `web/src/pages/Atlas.tsx` — `buildAtlas`, the aside with its two blocks, the header counts and the legend (D-06, D-09).
- `web/src/components/Graph.tsx` — `layoutGraph`, `DeriveNode`, its `Data` type and the `due` prop already threaded through it (D-10).
- `web/src/components/QuizCard.tsx`, `AskCard.tsx`, `ExplainCard.tsx`, `PlanCard.tsx` — the four keydown effects, the shipped `kbd` hint rows, and the `eslint-disable-next-line react-hooks/exhaustive-deps` comment that must be kept when copying the pattern (D-11..D-13).
- `web/src/lib/useLesson.ts` — the reducer, `applyEvent`, `EVENT_TYPES`, the delta buffer (60ms flush) and the `streaming` flag (D-16, D-18, D-26, and D-27's reducer test).
- `web/src/lib/useVoiceMode.ts` and `web/src/lib/voice.ts` — `say`/`afterSpeech`/`startListening`, the `if (it.streaming) continue` skip D-18 removes, `spokenText`, `spokenQuiz`, `parseSpokenChoice`, `voiceLang()` (D-18, D-19).
- `web/src/index.css` — `@theme` tokens, `.kbd`, `.hairline`, the `color-mix()` node glows (D-09's ramp, D-12's overlay).
- `web/src/lib/api.ts`, `web/src/lib/types.ts` — the single `api` object every new endpoint is added to as a key, and the hand-mirrored row/payload types.
- `server/test/api.test.ts`, `server/src/drivers/fake.ts`, `server/src/driver.ts` (`setDriverOverride`) — the no-model HTTP pattern D-27 uses.
- `scripts/conformance.mjs` and `.github/workflows/ci.yml` — the harness D-27 adds one assertion to, and its two run environments.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `server/src/schedule.ts` `retrievability()` already returns the chance the learner still recalls a node — D-07's "estimated knowledge" is a sum over locked nodes and D-21's ranking key is the same call. Nothing new to model.
- `server/src/db.ts` `dueNodes()` and `stats()` already back Home's footer line and the Atlas counts; D-01 and D-03 read the same figures through the same path rather than adding a counter.
- `server/src/actions.ts` `dependencyRecord()` already walks `depends_on` and reads each dependency's status and check record — D-21 adds an ordering to data it already gathers.
- `server/src/actions.ts` `nodeStatus()`'s `{ ok: false, refused: true, error: '… This is the method, not an error to investigate.' }` is the exact shape D-20's refusal copies; the understanding gate is the precedent for a server-side refusal that steers the model.
- `web/src/components/Graph.tsx` already threads an optional `due` flag from `layoutGraph` into `DeriveNode`'s `Data` and branches on it — D-10's `stability` is the same mechanism, one field over.
- `web/src/components/QuizCard.tsx` has a working `window.keydown` effect with the textarea/input/modifier guards, `e.preventDefault()` and the kept `exhaustive-deps` comment — the template for D-11..D-13 on the other three cards.
- `web/src/components/QuizCard.tsx`'s `kbd` hint row and `web/src/index.css`'s `.kbd` class are the existing keyboard-affordance vocabulary D-12's overlay should read like.
- `server/src/migrations.ts` has eleven numbered transactional migrations and a snapshot-first policy — D-25's `prompts` table is migration twelve with no new machinery.
- `server/src/drivers/fake.ts` + `setDriverOverride` + `server/test/api.test.ts` drive the whole server over HTTP with no model — D-27's gates for the ranking, the refusal and the rehydration need nothing else.
- `server/src/prices.ts` / `server/src/providers.ts` are committed pure-data modules with an as-of date, no I/O and no import-time side effect — the shape D-19's name→locale table copies.
- `web/src/pages/Atlas.tsx`'s aside is already a column of bordered blocks each with an eyebrow, a count and a list — D-06 is a third block in a settled pattern.

### Established Patterns
- **Learning mechanics live server-side and are enforced in tool results** (`instruction` / `refused` / `notice`), never in the driver. D-20, D-22 and D-23 all steer the model this way; none of them is a prompt change.
- **Transient state is ephemeral and never persisted** — a `status` with `seq: -1`, no `EVENT_TYPES` entry, nothing in the Obsidian mirror (01 D-14, 03 D-09/D-10). Binding on D-16; and a new event type must be added in both the server `emit` and `useLesson.ts`'s `EVENT_TYPES` + `applyEvent` or the browser silently ignores it.
- **The browser rebuilds all state by replaying events**; there is no "current state" API beyond the `nodes` / `materials` rows. D-26's rehydrated card must arrive as something `applyEvent` already understands or the reducer needs a matching branch.
- **Method text is one source rendered to targets and committed, with CI failing on drift** (01 D-02/D-04, `scripts/check-method.mjs`). D-23 deliberately stays out of `method/`; anything that does touch it must regenerate and commit.
- **Errors are plain lowercase `Error` sentences; routes answer `{ error }`; the web client throws that message** — so a refusal's wording reaches the model and the learner verbatim.
- **Pure logic modules have no I/O so tests read them with no database** (`schedule.ts`, `providers.ts`, `cost.ts`). The reason D-21's ranking is a candidate for `schedule.ts` and D-19's table is pure data.
- **One component per file, PascalCase, props destructured inline, no separate `Props` type**; `web/src/lib/api.ts` gains a new key rather than a `fetch` in a component; shared types are hand-mirrored in `web/src/lib/types.ts`.
- Single quotes, semicolons, trailing commas, 2-space indent, `.js` extensions on server imports, long lines accepted and not reflowed, `/** … */` prose module headers.
- **The simplicity rule is enforced in review**: every new control, panel or page outside Settings needs a one-sentence learning reason in the plan. D-01, D-03, D-04, D-06, D-12 and D-14 each add surface and each need that sentence written.

### Integration Points
- `web/src/pages/Home.tsx` — the next-step block above the hero, and the due pill in the existing nav row (D-01, D-02, D-03).
- A new shared header component under `web/src/components/` consumed by `Lesson.tsx`, `Atlas.tsx`, `Library.tsx`, `You.tsx`, `Settings.tsx`, `Usage.tsx` (D-03, D-04).
- `web/src/pages/Atlas.tsx` aside + `web/src/components/Graph.tsx` `DeriveNode` (D-06..D-10), with a new `/api/stats`-adjacent endpoint for the retention figures in `server/src/index.ts` and a key in `web/src/lib/api.ts`.
- The four card components plus one lesson-level overlay and a `data-focus` toggle on `document.documentElement` (D-11..D-15).
- `server/src/actions.ts` + `server/src/db.ts` for the ranking, the gate and the misconception payload; `server/src/schedule.ts` if the ranking lands there (D-20..D-23).
- `server/src/prompts.ts` + `server/src/migrations.ts` + `server/src/index.ts`'s held bookkeeping, and the resume path in `server/src/drivers/api.ts` / `agent.ts` (D-25, D-26).
- `server/src/mcp.ts` + `plugin/commands/` + `codex/skills/` for `due` and `/derive:due` (D-05).
- `web/src/lib/useVoiceMode.ts` + `web/src/lib/voice.ts` + the learner prefs read (D-18, D-19).
- `server/test/` for the no-model suites and the two named unit tests; `scripts/conformance.mjs` and `.github/workflows/ci.yml` for the harness assertion (D-27).

</code_context>

<specifics>
## Specific Ideas

- Home's next-step block sits **above** the hero in the order `Review N due → / Continue "<topic>" → / Start new ↓`; the hero, topic input, example graph and lesson index are untouched, and a learner with no lessons sees today's Home.
- With nothing due the review row becomes a quiet "Nothing due today" line **in the same position**, so the block never changes shape.
- One due pill in one shared header on all six pages **and** in the lesson header, grey and small.
- `derive due` ships as a `due` MCP command plus `/derive:due` and a Codex skill — not as a bin, and not as a tutor tool in `DERIVE_TOOL_NAMES`.
- Retention is a **third block in the Atlas aside**: estimated knowledge as a retrievability sum, true-vs-desired against the fixed 0.9, a 14-day forecast, and "not enough reviews yet" below ~10 data points.
- Stability **tints the locked gold**; due, shaky and teaching are unchanged; the in-lesson graph never receives the value.
- `?` becomes help and `0` keeps "I don't know"; digit and letter pick the same slot; Enter commits on all four cards.
- Focus mode is `data-focus` on `<html>`, keeps the card, the prose above it and the composer, `f` / Esc, and does not persist.
- **Nothing is prefetched in a teaching lesson.** Prefetch exists only for review and warm-up lessons, whose queue is known.
- Voice speaks sentence by sentence **while the block is still streaming**; `prefs.language` goes through a committed name→BCP-47 table with a `navigator.language` fallback.
- Remediation names **one** prerequisite and refuses quizzes elsewhere until it passes or the learner types.
- A rehydrated card is **live**: answering it grades normally and starts a fresh turn.
- Every new gate is seen failing with its subject planted before it is kept.

</specifics>

<deferred>
## Deferred Ideas

No ideas were raised outside the phase boundary. Recorded so nobody re-opens them inside Phase 5:

- Graph reuse across lessons — locked Atlas nodes as roots of new lessons (LEARN-13, v2; a method change needing its own research, and the roadmap research note repeats the deferral).
- Bounded "I have 10 minutes" sessions (LEARN-14, v2).
- A per-learner desired-retention slider (LEARN-15, v2) — this is why D-07's desired retention is the fixed `request_retention: 0.9` and why no control is added for it.
- A forgiving streak, weekly freeze and adjustable daily goal (LEARN-16, v2).
- Review reminders without a server — due badge nudge at plugin session start, desktop or browser notification, `.ics` export (LEARN-17, v2). D-03's due pill and D-05's `due` command are the visibility this phase delivers; nothing notifies.
- Theme, accent, font family and size, reduced motion, tutor tone and the language **picker** (STYLE-01/02/04/06, Phase 6). Phase 5 reads `prefs.language` as it stands and establishes the `<html>` attribute convention Phase 6 extends with `data-theme` / `data-accent` / `data-font` / `data-size`.
- The published package, its `bin`, marketplaces, docs site, README landing page and contributor guide (ADOPT-01..08, Phase 7). D-05 is explicitly the pre-packaging form of `derive due`.
- A learner-facing capability badge or cost-per-node analytics (v2, 2026-09-17 under the simplicity rule; 04 D-21 keeps the tool-rejection rate internal for the same reason).
- Making `replaceGraph` and `deleteLesson` transactional, and adding a linter — standing debt in `.planning/codebase/CONCERNS.md`, unassigned, and not opened by any decision here.
- The two open advisory reports `03-REVIEW.md` and `03-UI-REVIEW.md` (15/24) — not this phase's to close, but D-01 and D-04 build on the two surfaces the UI review flagged (Home at 375px, the crowded lesson header), so their plans should not make either worse.

</deferred>

---

*Phase: 05-learning-experience*
*Context gathered: 2026-11-04*
