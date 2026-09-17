---
last_mapped_commit: 7d7db1f8c9352186f02b02ddb34172e66fef5eb5
last_mapped_at: 2026-09-17
---
<!-- refreshed: 2026-09-17 -->

# Architecture

**Analysis Date:** 2026-09-17

## System Overview

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                               DRIVERS (who runs the tutor)                    │
├──────────────────────┬──────────────────────────┬────────────────────────────┤
│  App / in-process    │  Claude Code plugin      │  Codex terminal            │
│  `server/src/agent.ts│  `plugin/` (commands,    │  `codex/skills/*` +        │
│  → claude-agent-sdk  │  teach skill, hooks)     │  `server/src/mcp.ts`       │
│  or `codex.ts` →     │  → `server/src/mcp.ts`   │  (DERIVE_DRIVER=codex)     │
│  @openai/codex-sdk   │  (stdio MCP, proxies     │  + `codex-mirror.ts` tails │
│                      │  HTTP) + `hooks/mirror.mjs`│ ~/.codex/sessions JSONL   │
└──────────┬───────────┴────────────┬─────────────┴──────────────┬─────────────┘
           │ direct calls           │ HTTP /api/external/...     │ HTTP
           ▼                        ▼                            ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                     HTTP API + orchestration  `server/src/index.ts` (Hono)    │
│   /api/lessons, /api/materials, /api/library, /api/review, /api/atlas,        │
│   /api/learners, /api/external/lessons/:id/:action, SSE /api/lessons/:id/stream│
└──────────┬───────────────────────────────────────────────────────────────────┘
           ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│   TUTOR ACTIONS (driver-independent)  `server/src/actions.ts`                 │
│   quiz / ask / set_plan / explain_back (blocking + "open" variants),          │
│   node_status (understanding gate, cumulative quiz, FIRe credit),             │
│   remember, set_preferences, material + library tools, parseReply, renderCard │
├──────────────────┬───────────────────┬───────────────────┬───────────────────┤
│ `prompts.ts`     │ `events.ts`       │ `notices.ts`      │ `prompt.ts`       │
│ pending cards    │ persist + fan-out │ deferred messages │ system prompt +   │
│ (held/ordinary)  │ (SSE listeners)   │ to the tutor      │ turn prompts      │
└──────────────────┴───────────────────┴───────────────────┴───────────────────┘
           ▼                                   ▼
┌───────────────────────────────┐   ┌──────────────────────────────────────────┐
│ DOMAIN MODULES                │   │ STORAGE  `server/src/db.ts` (node:sqlite) │
│ `schedule.ts` FSRS + FIRe     │   │ lessons, events, nodes, quiz_results,     │
│ `materials.ts` + `repo.ts`    │   │ misconceptions, memory, learners,         │
│ `library.ts` (learner shelf)  │   │ materials, resources  → ~/.derive/derive.db│
│ `export.ts` Obsidian mirror   │   │                                          │
└───────────────────────────────┘   └──────────────────────────────────────────┘
           ▲ SSE event stream
┌──────────────────────────────────────────────────────────────────────────────┐
│  WEB (React 19 + Vite, served from `web/dist` by the server in production)    │
│  `web/src/lib/useLesson.ts` reducer replays events → `pages/Lesson.tsx` cards │
│  `pages/Home.tsx`, `Atlas.tsx`, `Library.tsx`, `You.tsx`; `lib/api.ts` client │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| HTTP API + orchestration | All REST/SSE routes; creates lessons, starts turns, wires held cards for terminal-answered lessons, mirrors terminal prose, serves the built web app | `server/src/index.ts` |
| Claude backend (in-process agent) | Runs one lesson turn through `@anthropic-ai/claude-agent-sdk` with the tutor tools registered as an in-process MCP server; streams text blocks into events; tracks active turns | `server/src/agent.ts` |
| Codex backend | Runs one turn through `@openai/codex-sdk`; attaches Derive's own stdio MCP server (`mcp.js`) with `DERIVE_DRIVER=app` so tools round-trip over HTTP | `server/src/codex.ts` |
| Backend selection | Chooses `claude` vs `codex` from `DERIVE_BACKEND` or whichever is logged in; locates the codex binary and the MCP command | `server/src/backend.ts` |
| Tutor actions | The learning-science logic: grading, confidence, purpose defaults, the understanding gate, cumulative quiz, remediation instructions, library nudges, terminal reply parsing, card rendering | `server/src/actions.ts` |
| Pending prompts | Registry of open cards awaiting a learner answer (ordinary vs held), answer/cancel | `server/src/prompts.ts` |
| Event bus | Append/update events in SQLite and fan out to SSE subscribers; ephemeral deltas; vault mirroring trigger | `server/src/events.ts` |
| Notices | One-shot messages queued for the tutor's next prompt or tool result | `server/src/notices.ts` |
| System prompt | The teaching method text plus first-turn, warm-up, material-attached and review-turn prompts | `server/src/prompt.ts` |
| Tool names/labels | Shared list of the 14 tutor tools and their status-line labels | `server/src/tools.ts` |
| Scheduling | FSRS wrapper (`ts-fsrs`): grade from correctness+confidence, `schedule`, `retrievability`, `implicitRepetition`, `implicitLapse` | `server/src/schedule.ts` |
| Storage | Schema, migrations, prepared statements, node status + FIRe propagation, warm-up and review-graph builders, learner profile text | `server/src/db.ts` |
| Course material | PDF/PPTX/DOCX/text extraction, segmenting, `read_material`/`search_material`, prompt section | `server/src/materials.ts` |
| Repo ingestion | Local folder / GitHub / git URL to a file list (tar parsing, notebook flattening) | `server/src/repo.ts` |
| Library | Learner's resource shelf: URL normalisation, fetching (HTML, oEmbed, arXiv PDF), search, related-resource ranking, prompt section | `server/src/library.ts` |
| Export | Lesson to Markdown with Obsidian callouts; live vault mirror (debounced) | `server/src/export.ts` |
| Config | Env-derived constants (`PORT`, `DATA_DIR`, `MODEL`, `EFFORT`, `VAULT_DIR`, backend settings) | `server/src/config.ts` |
| Stdio MCP server | Exposes tutor tools to Claude Code / Codex; proxies each to `/api/external/lessons/:id/:action`; `start_lesson`, `attach_material`, `answer`, `answer_in`, `learners`, `end_lesson` | `server/src/mcp.ts` |
| Codex session mirror | Tails `~/.codex/sessions/**/rollout-*.jsonl` and posts assistant/user prose to `/mirror`, `task_complete` to `/end` | `server/src/codex-mirror.ts` |
| Claude Code plugin | Slash commands `/derive:learn`, `/derive:review`; `teach` skill; hooks that mirror the transcript and collect browser answers | `plugin/commands/*.md`, `plugin/skills/teach/SKILL.md`, `plugin/hooks/mirror.mjs`, `plugin/.mcp.json` |
| Web lesson state | Reducer that replays stored events and live SSE into a timeline + graph; delta buffering | `web/src/lib/useLesson.ts` |
| Web API client | Thin fetch wrapper; sends `x-derive-learner` header from localStorage | `web/src/lib/api.ts` |
| Web pages | Home (new lesson, list), Lesson (timeline + cards + graph), Atlas (cross-lesson graph), Library, You (preferences) | `web/src/pages/*.tsx` |

## Pattern Overview

**Overall:** Event-sourced lesson log behind a single Node HTTP server, with a driver-independent "actions" layer so three different LLM drivers (in-process Claude SDK, in-process Codex SDK, external Claude Code / Codex terminals over MCP) share one set of learning mechanics.

**Key Characteristics:**

- **Every lesson is an append-only event stream** in the `events` table (`server/src/db.ts`), fanned out over SSE (`server/src/events.ts`). The browser rebuilds all state by replaying events (`web/src/lib/useLesson.ts` `reducer` → `applyEvent`); there is no separate "current state" API beyond `nodes`/`materials` rows.
- **Cards are tool calls that block on the learner.** `quiz`, `ask`, `set_plan`, `explain_back` open a prompt (`server/src/prompts.ts` `openPrompt`) and resolve when `POST /api/lessons/:id/answer` or the terminal `answer` action arrives. The model never grades its own question; the server does (`server/src/actions.ts` `openQuiz`).
- **Learning mechanics live server-side, enforced in tool results.** The understanding gate (`needsUnderstanding`), the cumulative quiz (`cumulativeStatus`, `afterCumulative`), targeted remediation (`dependencyRecord`), FIRe credit (`db.ts` `propagate`) and library nudges all return `instruction`/`refused` fields that steer the model. Tests drive them over HTTP with no model (`server/test/api.test.ts`).
- **Driver abstraction by mode.** `lessons.mode` is `agent` (server runs the model) or `external` (a terminal runs it). External lessons are "busy" from `turn_start` until a hook/mirror posts `/end`; agent lessons are busy while `agent.ts` `active` holds an entry.
- **Backend abstraction by `Active`.** `agent.ts` `runTurn` builds the shared system prompt and dispatches to either the Claude SDK path (same file) or `codex.ts` `runCodexTurn`; both register an `{ interrupt }` in the `active` map and emit the same `assistant`/`status`/`turn_end` events.
- **Multi-learner by id.** Every read/write is scoped by `learner_id`, resolved in `index.ts` `learnerOf` from the `x-derive-learner` header, `?learner=`, or a body field; unknown falls back to `DEFAULT_LEARNER_ID`.

## Layers

**Drivers (LLM runners):**

- Purpose: Get a model to call the tutor tools with the teaching method as its instructions.
- Location: `server/src/agent.ts`, `server/src/codex.ts`, `server/src/mcp.ts`, `plugin/`, `codex/skills/`
- Contains: SDK invocations, tool schemas (zod), MCP server registration, hooks, skill text.
- Depends on: actions, prompt, events, db (session ids), tools, backend/config.
- Used by: `index.ts` (calls `runTurn`/`interrupt`); Claude Code and Codex CLIs (spawn `mcp.js`).

**HTTP API:**

- Purpose: Everything the browser, the MCP proxy and the hooks talk to.
- Location: `server/src/index.ts` (single Hono app, ~840 lines, grouped by `// ---------- section ----------` comments).
- Contains: Route handlers, `learnerOf`, `busy`, `lessonView`, `startReview`, held-card bookkeeping (`held`, `holdCard`, `recentCards`, `withoutCards`), the `teachingGap` gate, static serving of `web/dist`.
- Depends on: every server module.
- Used by: `web/src/lib/api.ts`, `server/src/mcp.ts`, `plugin/hooks/mirror.mjs`, `server/test/api.test.ts`.

**Tutor actions:**

- Purpose: Driver-independent semantics of each tool: record state, emit events, return what the model should be told.
- Location: `server/src/actions.ts`
- Contains: `openQuiz`/`quiz`, `openAsk`/`ask`, `openPlan`/`setPlan`, `openExplain`/`explainBack`, `nodeStatus`, `phase`, `remember`, `setPreferences`, material/library wrappers, `profile`, `parseReply`, `renderCard`, and the instruction builders `afterQuiz`, `afterCumulative`, `dependencyRecord`, `planLibraryInstruction`, `libraryHint`.
- Depends on: db, schedule (types), events, prompts, notices, library, materials.
- Used by: `agent.ts` (in-process tools), `index.ts` (external actions).

**Coordination primitives:**

- Purpose: Small single-purpose modules shared by actions and the API.
- Location: `server/src/prompts.ts` (pending cards), `server/src/events.ts` (persist + fan-out), `server/src/notices.ts` (deferred messages), `server/src/tools.ts` (tool names/labels).
- Depends on: db, export (events triggers vault mirror).

**Domain modules:**

- Purpose: The learning-science and content logic with no HTTP or model awareness.
- Location: `server/src/schedule.ts` (FSRS/FIRe math), `server/src/db.ts` (also holds `setNodeStatus`, `propagate`, `buildWarmup`, `buildReviewGraph`, `cumulativeStatus`, `hasUnderstandingPass`, `learnerProfile`), `server/src/materials.ts`, `server/src/repo.ts`, `server/src/library.ts`, `server/src/export.ts`, `server/src/prompt.ts`.
- Depends on: `ts-fsrs`, `unpdf`, `fflate`, `node:sqlite`.

**Storage:**

- Purpose: One SQLite file, WAL mode, prepared statements in a `q` object.
- Location: `server/src/db.ts`; file at `DERIVE_DATA_DIR/derive.db` (default `~/.derive/derive.db`).
- Tables: `lessons`, `events`, `nodes`, `memory`, `misconceptions`, `quiz_results`, `materials`, `learners`, `resources`. Migrations are an `ALTER TABLE ... ADD COLUMN` list wrapped in try/catch (`db.ts` lines 107–130).

**Web client:**

- Purpose: Render the timeline, cards, graph, atlas, library and preferences; answer cards; voice mode.
- Location: `web/src/`
- Contains: `main.tsx` router, `pages/`, `components/`, `lib/` (api, reducer hook, types, voice, prefs, topo order).
- Depends on: server HTTP API only (proxied by Vite in dev, same origin in prod).

## Data Flow

### Primary Request Path (app lesson, Claude backend)

1. Browser `POST /api/lessons {topic, materials}` (`web/src/lib/api.ts` `createLesson`) → `index.ts` line 162: `createLesson` row, `bindMaterials`, `buildWarmup` (copies due nodes into this lesson as `warmup-*` nodes with `source_lesson`/`source_node`), emits `material` and `warmup` events, then `void runTurn(id, firstTurnPrompt(...))`.
2. `agent.ts` `runTurn` (line 243): emits `turn_start`, prepends notices, builds instructions = `systemPrompt(backend()) + materialsSection + librarySection + learnerProfile`, calls `query()` from the Claude Agent SDK with `mcpServers: { derive: buildTools(lessonId) }`, `resume: lesson.session_id`.
3. Streaming: `content_block_start(text)` → `emit('assistant', {partial:true})` gets a `seq`; deltas → `emitEphemeral('delta')` and `checkpoint` every 1.5 s; block stop → `emitUpdate` under the same seq (`agent.ts` lines 318–347).
4. A tool call (e.g. `quiz`) → `actions.quiz` → `openQuiz` → `prompts.openPrompt` emits a `quiz` event and awaits a resolver.
5. Browser receives `quiz` over SSE (`GET /api/lessons/:id/stream`, `index.ts` line 191), renders `QuizCard` (`web/src/components/QuizCard.tsx`), posts `POST /api/lessons/:id/answer {prompt_id, selected, sure}`.
6. `answerPrompt` resolves; `openQuiz`'s `.then` grades (`sameSet`), emits `quiz_result`, `recordQuiz`, `addMisconception` (not for pretests), computes `afterQuiz` instruction, returns JSON text to the model.
7. `node_status(locked)` → `actions.nodeStatus`: refused if `needsUnderstanding` (derived node without an intuition/transfer pass); else `db.setNodeStatus` grades via FSRS (`schedule.ts`), forwards to the source node for review copies, runs `propagate` for FIRe credit/penalty, `resolveMisconceptions`, emits `node_status`; goal lock returns cumulative-quiz instructions.
8. `result` message → `turn_end` with cost/duration; `finally` clears `active`, `cancelPending`.

### External (companion) lesson path — Claude Code plugin

1. `/derive:learn <topic>` (`plugin/commands/learn.md`) loads `plugin/skills/teach/SKILL.md`, calls MCP `start_lesson` (`server/src/mcp.ts` line 173).
2. `mcp.ts` → `POST /api/external/lessons` (`index.ts` line 516): creates a `mode: 'external'` lesson with `answer_in` and `driver`, builds warm-up, emits `turn_start`, returns `url`, `library` brief and `warmup` brief; MCP then uploads `files` via `/api/materials` and `/api/materials/repo`, fetches `/api/profile`, and opens the browser.
3. Each tool call → `POST /api/external/lessons/:id/:action` (`index.ts` line 643). Browser-answered: `actions.quiz` long-polls until the browser answers. Terminal-answered: `actions.openQuiz(..., {hold:true})` + `holdCard` returns `{status:'pending', card, instruction}`; the model prints the card and ends its turn; the learner's next message goes through `answer` → `actions.parseReply` → `answerPrompt` → graded result.
4. `plugin/hooks/mirror.mjs` runs on `Stop`, `UserPromptSubmit`, `PreToolUse`/`PostToolUse(mcp__derive__*)`: reads the Claude Code transcript, posts new assistant/user text to `/mirror` (deduped by uuid in `~/.derive/mirror/<session>.json`), posts `/end` on Stop, and on `UserPromptSubmit` calls `/collect` to hand the model a browser-settled answer.
5. `teachingGap` (`index.ts` line 794) refuses a teach-phase `check` quiz until ≥240 chars of mirrored prose arrived after the node was marked `teaching` (unless `already_held` or `purpose: 'pretest'`).

### External lesson path — Codex terminal

Same as above but `DERIVE_DRIVER=codex`: `mcp.ts` starts `RolloutMirror` (`server/src/codex-mirror.ts`) which tails the Codex session JSONL for the lesson id and posts prose/`task_complete` in place of hooks; card tools call `flushed()` first so the teach-first gate sees the prose. `codex/skills/derive-learn|derive-review/agents/openai.yaml` declare the skills' interface and MCP dependency (no SKILL.md body is present in `codex/`; the method text lives in `plugin/skills/teach/SKILL.md` and `server/src/prompt.ts`).

### App lesson on the Codex backend

`agent.ts` `runTurn` → `codex.ts` `runCodexTurn`: writes the system prompt to `DATA_DIR/codex/<lesson>/instructions.md`, configures `mcp_servers.derive` = `mcpCommand()` with `DERIVE_DRIVER=app` and `DERIVE_LESSON_ID`, runs `thread.runStreamed`. Tool calls therefore go Codex → `mcp.js` (child process) → HTTP → `index.ts` external action → `actions.*`, while prose is emitted whole per `agent_message` item.

### Review session

`POST /api/review` or `start_lesson {review:true}` → `index.ts` `startReview` → `db.buildReviewGraph`: picks up to 6 due nodes interleaved across lessons, copies them and their dependencies (depth 2) into the new lesson with `source_lesson`/`source_node`, returns `due` with `review_id`s; `reviewTurnPrompt` (`prompt.ts`) instructs one fresh quiz per node. Locking a copy reschedules the original (`db.setNodeStatus` `memory` indirection).

**State Management:**

- Server: module-level maps are the only in-memory state: `agent.ts` `active`/`stopping`, `prompts.ts` `pending`, `events.ts` `listeners`, `notices.ts` `notices`, `index.ts` `held`/`recentCards`, `export.ts` `mirrorTimers`, `backend.ts` `resolved`. Everything else is in SQLite. On boot `index.ts` lines 57–61 close stale `turn_start`s.
- Browser: `useReducer` in `web/src/lib/useLesson.ts`; learner selection in `localStorage['derive.learner']`; voice toggle in `localStorage['derive.voice']`.

## Key Abstractions

**Lesson (`lessons` row + event stream):**

- Purpose: One teaching session; `mode` (`agent`|`external`), `phase` (`probe`|`plan`|`teach`), `session_id` (SDK/Codex thread to resume), `answer_in`, `driver`, `learner_id`.
- Examples: `server/src/db.ts` `Lesson` type; `web/src/lib/types.ts` `Lesson`.
- Pattern: Row for identity, events for history.

**Node (dependency-graph vertex with a memory):**

- Purpose: A claim (`truth`|`derived`|`goal`) with `depends_on` (JSON array), `status` (`pending`|`teaching`|`locked`|`shaky`) and FSRS fields (`stability`, `difficulty`, `reps`, `lapses`, `interval_days`, `review_at`, `last_review`). `source_lesson`/`source_node` mark a review/warm-up copy.
- Examples: `server/src/db.ts` `NodeRow`, `GraphNodeInput`, `replaceGraph`, `setNodeStatus`.
- Pattern: Copies forward writes to their source so the Atlas sees one node.

**Prompt / card (`prompts.ts` `Pending`):**

- Purpose: A tool call waiting on the learner; `kind` in `quiz|ask|plan|explain`; `held` when it outlives the turn (terminal answering).
- Examples: `actions.openQuiz` etc. return `{ id, done }`; blocking wrappers are `.done`.

**Event (`StoredEvent {seq,type,payload,ts}`):**

- Purpose: The unit of the lesson log. Types emitted by the server: `turn_start`, `turn_end`, `user`, `assistant` (partial/rewritten), `status`/`delta` (ephemeral, `seq:-1`), `quiz`, `quiz_result`, `ask`, `ask_result`, `plan`, `plan_result`, `explain`, `explain_result`, `phase`, `warmup`, `node_status`, `memory`, `preferences`, `material`, `material_removed`, `resource`, `answer_in`, `ready` (SSE-only).
- Examples: `web/src/lib/useLesson.ts` `EVENT_TYPES` must list every type the SSE stream can carry, or the browser ignores it.

**Instruction-bearing tool result:**

- Purpose: Tool results carry `instruction`, `refused`, `notice` fields; that is how the server steers the model.
- Examples: `actions.afterQuiz`, `actions.nodeStatus`, `index.ts` `withNotices`, `actions.withNotice`.

**Quiz purpose / tests:**

- Purpose: `purpose` in `probe|pretest|check|cumulative|review` (defaulted by `actions.purposeOf`); `tests` in `intuition|procedure|transfer`. `hasUnderstandingPass` requires a non-pretest correct `intuition`/`transfer` row.
- Examples: `server/src/db.ts` `QuizPurpose`, `QuizTests`; mirrored in `web/src/lib/types.ts`.

**Learner:**

- Purpose: Profile with `prefs` (`LearnerPrefs`: language, style, pace, background, how, examples) and everything scoped to it.
- Examples: `db.ts` `cleanPrefs`, `preferencesSection`, `learnerProfile`; `index.ts` `learnerOf`.

**Material / Resource:**

- Purpose: Material = per-lesson course content split into segments joined by ASCII RS (`materials.ts` `SEP`). Resource = per-learner library entry with fetched text in the same segment format.
- Examples: `materials.ts` `readMaterial`/`searchMaterial`; `library.ts` `readResource`/`searchLibrary`/`relatedResources`.

## Entry Points

**Server:**

- Location: `server/src/index.ts` (`pnpm start` → `server/dist/index.js`; `pnpm --filter server dev` → `tsx watch`)
- Triggers: `serve({ fetch: app.fetch, port: PORT })` at the bottom of the file.
- Responsibilities: Boot-time cleanup, route registration, static hosting of `web/dist`, startup log naming the backend.

**Stdio MCP server:**

- Location: `server/src/mcp.ts` (built to `server/dist/mcp.js`; `bin: derive-mcp`)
- Triggers: `plugin/.mcp.json`, `claude mcp add derive -- node .../mcp.js`, or `codex.ts` `mcpCommand()`.
- Responsibilities: Tool registration, HTTP proxying, file attachment, browser opening, Codex session mirroring.

**Web:**

- Location: `web/src/main.tsx` (routes `/`, `/lesson/:id`, `/atlas`, `/library`, `/you`), `web/index.html`.
- Triggers: Vite dev server on :5173 (proxying `/api` to :4310) or served statically by the server.

**Plugin hook:**

- Location: `plugin/hooks/mirror.mjs`; wired in `plugin/hooks/hooks.json`.
- Triggers: Claude Code `Stop`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse` events.

**Doctor:**

- Location: `scripts/doctor.mjs` (`pnpm check`).
- Responsibilities: Verifies Node ≥22.5 with `node:sqlite`, pnpm, Claude login, build outputs, data dir, port.

## Architectural Constraints

- **Threading:** Single Node process, event loop only. `db.ts` uses synchronous `node:sqlite` (`DatabaseSync`); every DB call blocks the loop briefly. Long-running work is the awaited SDK stream and `fetch` for library/repo ingestion.
- **Node version:** `node:sqlite` requires Node ≥22.5 (`package.json` `engines`, `scripts/doctor.mjs`).
- **Global state:** Module-level singletons listed under State Management; the server is therefore single-instance (no horizontal scaling, no multi-process). Pending prompts are lost on restart; `index.ts` boot loop and `answer` action's 409 handle that.
- **One turn per lesson:** `agent.ts` `runTurn` throws `lesson is busy` if `active` has the lesson; `index.ts` `/message` queues a notice or answers the open card instead.
- **One held card per external lesson:** `index.ts` line 651 returns 409 for a second card while one is unsettled.
- **Circular imports:** `events.ts` → `export.ts` → `db.ts`, and `actions.ts` ↔ `index.ts` are acyclic; `agent.ts` re-exports from `prompts.ts`/`notices.ts`/`tools.ts` for `index.ts`. `db.ts` imports `schedule.ts` and `schedule.ts` imports only a type from `db.ts` (type-only, safe).
- **ESM + NodeNext:** All server imports use `.js` extensions (`server/tsconfig.json` `module: NodeNext`).
- **Tool set must match in four places:** `server/src/tools.ts` `DERIVE_TOOL_NAMES`, `agent.ts` `buildTools`, `mcp.ts` `registerTool` calls, `index.ts` external action `switch`, plus `plugin/commands/*.md` `allowed-tools`.
- **Event types must match in two places:** whatever the server `emit`s and `web/src/lib/useLesson.ts` `EVENT_TYPES` + `applyEvent`.
- **Secrets:** None in code; `.env` (present, gitignored) only holds optional settings listed in `.env.example`. Auth is delegated to the Claude Code / Codex logins.

## Anti-Patterns

### Grading or steering in the driver instead of `actions.ts`

**What happens:** Adding quiz-result logic, lock rules or remediation text inside `agent.ts` tool handlers, `mcp.ts` or `index.ts` route bodies.
**Why it's wrong:** Three drivers share the mechanics; logic placed in one driver silently diverges for the others and escapes the model-free API tests.
**Do this instead:** Put the rule in `server/src/actions.ts` (or `db.ts` if it is a persistence rule) and let every driver call it. `index.ts` external actions should only validate shape, choose blocking vs held, and call `actions.*`.

### Emitting an event type the browser does not know

**What happens:** A new `emit(lessonId, 'foo', …)` on the server without adding `'foo'` to `EVENT_TYPES` and a case in `applyEvent` in `web/src/lib/useLesson.ts`.
**Why it's wrong:** The SSE listener is registered per named event type; unknown types never reach the reducer, and the replay on page load ignores them too.
**Do this instead:** Add the type to `EVENT_TYPES`, a `TimelineItem` variant in `web/src/lib/types.ts`, a reducer case, and a renderer in `web/src/pages/Lesson.tsx`; consider `server/src/export.ts` `renderMarkdown` as well.

### Persisting high-frequency deltas

**What happens:** Calling `emit` (which writes a row) for every streamed token.
**Why it's wrong:** The events table would bloat and the SSE `seq` ordering breaks.
**Do this instead:** Follow `agent.ts`: `emit` the block once with `partial:true`, `emitEphemeral('delta')` for tokens, `checkpoint` every ~1.5 s, `emitUpdate` at block end.

### Writing node memory on the copy only

**What happens:** Updating `review_at`/`stability` on a warm-up or review node without forwarding to `source_lesson`/`source_node`.
**Why it's wrong:** The Atlas and the due queue read the original; the review would never reschedule it.
**Do this instead:** Go through `db.setNodeStatus` / `propagate`, which resolve `memory = getNode(source_lesson, source_node) ?? node` and write both.

### Bypassing `learnerOf`

**What happens:** Reading `learner_id` from a query parameter directly in a new route.
**Why it's wrong:** Header/body/query precedence and the fallback to `DEFAULT_LEARNER_ID` would differ from every other route.
**Do this instead:** Call `learnerOf(c, body.learner)` in `server/src/index.ts`.

## Error Handling

**Strategy:** Fail soft toward the learner; surface errors to the model as tool-result text and to the browser as `turn_end {ok:false,error}` or JSON `{error}` with a 4xx/5xx status.

**Patterns:**

- Route handlers wrap JSON parsing with `.catch(() => ({}))` and return `c.json({ error }, 400|404|409|422|500)`; a shared `err(c, e, status)` helper exists for library routes (`index.ts` line 387).
- Refusals that are part of the method return `{ ok:false, refused:true, error }` with status 400 (`actions.nodeStatus`) and say "This is the method, not an error to investigate" so the model does not debug the server.
- Turn failures: `agent.ts` and `codex.ts` both use an idempotent `endTurn` guard and always emit `turn_end` in `finally`; `stopping` marks user-initiated interrupts as `interrupted: true` rather than errors.
- Codex API errors are unwrapped from JSON and given fix hints (`codex.ts` `friendly`).
- Background fire-and-forget: `void runTurn(...).catch((e) => console.error('[turn]', e))`.
- MCP proxy: `mcp.ts` `api()` throws `derive server: <message>` so Claude Code shows the server's sentence.
- Browser: `api.ts` `j()` throws `Error(res.json().error ?? statusText)`; pages show inline messages.

## Cross-Cutting Concerns

**Logging:** `console.log` at startup, `console.error('[turn]'|'[vault]', …)`, `console.warn('[codex]', …)`. No logging framework; hooks and MCP are silent on failure by design.
**Validation:** Zod schemas on tool inputs (`agent.ts`, `mcp.ts`); hand-written checks in `index.ts` external actions (`QUIZ_PURPOSES`, `QUIZ_TESTS`, option counts); `db.cleanPrefs` sanitises preference fields; `library.ts` `isKind`, `normalizeUrl`.
**Authentication:** None on the HTTP API (localhost trust; CORS `*` on `/api/*`). Model access is the user's Claude Code or Codex login (`backend.ts` `claudeLoggedIn`/`codexLoggedIn`). Learner identity is a client-chosen header.
**Prompt assembly:** Always `systemPrompt(backend) + materialsSection(lesson) + librarySection(learner, topic) + learnerProfile(learner, lesson)` in `agent.ts`; external drivers get the same sections piecemeal from `/api/external/lessons` (`library`, `warmup`), `/api/external/lessons/:id/materials` and `/api/profile`.
**Obsidian mirror:** Every `emit`/`emitUpdate` calls `mirrorToVault` (debounced 600 ms) when `DERIVE_VAULT_DIR` is set.

---

*Architecture analysis: 2026-09-17*
