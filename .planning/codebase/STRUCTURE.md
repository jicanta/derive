---
last_mapped_commit: 7d7db1f8c9352186f02b02ddb34172e66fef5eb5
last_mapped_at: 2026-09-17
---
# Codebase Structure

**Analysis Date:** 2026-09-17

## Directory Layout

```
derive/
├── package.json              # pnpm workspace root: dev/build/start/typecheck/test/check scripts
├── pnpm-workspace.yaml       # packages: server, web
├── pnpm-lock.yaml
├── .env.example              # documented optional settings (PORT, DERIVE_* vars); `.env` is gitignored
├── README.md                 # product + method description; the intended design
├── LICENSE                   # MIT
├── .github/
│   ├── workflows/ci.yml      # typecheck → build → test → doctor on push/PR
│   ├── workflows/release.yml # tag vX.Y.Z → release with plugin + built server
│   └── dependabot.yml
├── scripts/
│   └── doctor.mjs            # `pnpm check`: Node/pnpm/Claude login/build/data dir/port
├── server/                   # Node 22.5+ HTTP API, tutor backends, MCP server (TypeScript, ESM)
│   ├── package.json          # deps: hono, claude-agent-sdk, codex-sdk, mcp sdk, ts-fsrs, unpdf, fflate, zod
│   ├── tsconfig.json         # NodeNext, strict, rootDir src → outDir dist
│   ├── src/
│   │   ├── index.ts          # ENTRY: Hono app, every route, held cards, static web hosting
│   │   ├── agent.ts          # Claude Agent SDK turn runner + in-process MCP tool defs
│   │   ├── codex.ts          # Codex SDK turn runner (app lessons on a ChatGPT login)
│   │   ├── backend.ts        # claude|codex selection, codex binary, mcp command
│   │   ├── config.ts         # env → constants
│   │   ├── actions.ts        # driver-independent tutor actions (learning mechanics)
│   │   ├── prompts.ts        # pending cards registry (ordinary vs held)
│   │   ├── events.ts         # persist + SSE fan-out; ephemeral deltas; checkpoints
│   │   ├── notices.ts        # deferred one-shot messages to the tutor
│   │   ├── tools.ts          # tutor tool names + status labels (shared by both backends)
│   │   ├── prompt.ts         # system prompt text; first/warm-up/material/review turn prompts
│   │   ├── schedule.ts       # FSRS grading, scheduling, retrievability, FIRe credit/lapse
│   │   ├── db.ts             # node:sqlite schema, migrations, queries, warm-up/review builders, profile
│   │   ├── materials.ts      # course material extraction (pdf/pptx/docx/text/repo), read/search
│   │   ├── repo.ts           # folder / GitHub / git URL → file list
│   │   ├── library.ts        # learner's resource shelf: fetch, search, relate, prompt section
│   │   ├── export.ts         # lesson → Markdown (Obsidian callouts), live vault mirror
│   │   ├── mcp.ts            # ENTRY: stdio MCP server proxying to the HTTP API
│   │   └── codex-mirror.ts   # tails ~/.codex/sessions JSONL into a lesson
│   ├── test/
│   │   ├── api.test.ts       # end-to-end over HTTP against dist/index.js, no model
│   │   ├── schedule.test.ts  # FSRS/FIRe unit tests
│   │   └── reply.test.ts     # parseReply (terminal answers) unit tests
│   └── dist/                 # tsc output (gitignored); mcp.js is what the plugin points at
├── web/                      # React 19 + Vite 6 + Tailwind 4 SPA
│   ├── package.json
│   ├── index.html            # fonts, favicon, mounts /src/main.tsx
│   ├── vite.config.ts        # :5173, proxies /api → :4310
│   ├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
│   ├── src/
│   │   ├── main.tsx          # ENTRY: BrowserRouter routes
│   │   ├── index.css         # Tailwind + theme tokens (ink/moss/rust palettes, hairline)
│   │   ├── pages/            # one component per route
│   │   │   ├── Home.tsx      # new lesson composer, lesson list, due count
│   │   │   ├── Lesson.tsx    # timeline + cards + graph + composer + voice + export
│   │   │   ├── Atlas.tsx     # cross-lesson graph (React Flow + dagre)
│   │   │   ├── Library.tsx   # resource shelf CRUD/filter
│   │   │   └── You.tsx       # learner preferences + tutor notes
│   │   ├── components/       # cards and widgets used by pages
│   │   │   ├── QuizCard.tsx, AskCard.tsx, PlanCard.tsx, ExplainCard.tsx, ResourceCard.tsx
│   │   │   ├── Graph.tsx     # layoutGraph (dagre), DeriveNode, Graph
│   │   │   ├── Composer.tsx  # message input, attach, mic, stop
│   │   │   ├── Markdown.tsx  # react-markdown + KaTeX + Mermaid + inline svg
│   │   │   ├── LearnerMenu.tsx, MaterialList.tsx, OutlineRail.tsx, PhaseBar.tsx
│   │   └── lib/
│   │       ├── api.ts        # fetch client; x-derive-learner header; localStorage learner
│   │       ├── types.ts      # client mirrors of server row/event types; TimelineItem union
│   │       ├── useLesson.ts  # reducer + SSE subscription (the lesson state machine)
│   │       ├── useMaterials.ts # upload/import hook, MATERIAL_ACCEPT, looksLikeRepo
│   │       ├── useVoiceMode.ts, voice.ts # speech synthesis/recognition
│   │       ├── prefs.ts      # STYLES/PACES option lists, describePrefs
│   │       └── order.ts      # topoOrder / orderIndex for graph nodes
│   └── dist/                 # vite build (gitignored); served by the server
├── plugin/                   # Claude Code plugin (installed with `claude --plugin-dir ./plugin`)
│   ├── .claude-plugin/plugin.json  # name "derive", version 0.4.0
│   ├── .mcp.json             # runs ../server/dist/mcp.js with DERIVE_URL
│   ├── commands/learn.md     # /derive:learn — allowed-tools list + step-by-step procedure
│   ├── commands/review.md    # /derive:review
│   ├── skills/teach/SKILL.md # the teaching method for Claude Code (tool mapping + discipline)
│   ├── hooks/hooks.json      # Stop / UserPromptSubmit / PreToolUse / PostToolUse → mirror.mjs
│   └── hooks/mirror.mjs      # transcript → /mirror, /end, /collect
├── codex/
│   └── skills/
│       ├── derive-learn/agents/openai.yaml   # Codex skill interface + MCP dependency "derive"
│       └── derive-review/agents/openai.yaml
├── design/                   # Claude Design canvas artboards (*.dc.html, canvas.json); not runtime
│   └── derive-design-system.html (gitignored)
├── docs/                     # logo.svg and README screenshots only
└── .planning/codebase/       # GSD codebase maps (this file)
```

## Directory Purposes

**`server/src/`:**

- Purpose: The whole backend in one flat directory; no sub-folders. Files are grouped by responsibility, not by layer.
- Contains: 19 TypeScript modules; largest are `db.ts` (~1000 lines), `index.ts` (~840), `library.ts` (~620), `actions.ts` (~610), `mcp.ts` (~490), `materials.ts` (~420), `agent.ts` (~380).
- Key files: `index.ts` (routes), `actions.ts` (mechanics), `db.ts` (storage + graph logic), `schedule.ts` (FSRS).

**`server/test/`:**

- Purpose: `node --test` suites run by `pnpm test` (root) after `pnpm build`.
- Contains: One HTTP end-to-end file that spawns `dist/index.js` on a random port with a temp `DERIVE_DATA_DIR` and `DERIVE_BACKEND=claude`, plus two pure unit files.

**`web/src/pages/`:**

- Purpose: Route-level components; each fetches its own data through `lib/api.ts`.
- Contains: Five pages; `Lesson.tsx` is the composition root for a lesson.

**`web/src/components/`:**

- Purpose: Presentational and card components. Cards receive a payload + result and an `onAnswer` callback; they do not fetch.
- Contains: `*Card.tsx` per prompt kind (`quiz`, `ask`, `plan`, `explain`) and `ResourceCard` for library suggestions.

**`web/src/lib/`:**

- Purpose: Non-visual client code: API, types, hooks, voice, ordering.

**`plugin/`:**

- Purpose: Everything Claude Code needs; runtime code is only `hooks/mirror.mjs`, the rest is Markdown/JSON. Depends on `server/dist/mcp.js` existing (relative path in `.mcp.json`).

**`codex/skills/`:**

- Purpose: Codex skill manifests (`agents/openai.yaml` only). The method text for Codex drivers comes from the MCP tool descriptions in `server/src/mcp.ts`; there is no `SKILL.md` here.

**`design/`:**

- Purpose: Design artboards for the UI (Home, Lesson, Atlas, Companion, direction studies). Reference only; not imported by `web/`.

**`docs/`:**

- Purpose: Static assets referenced by `README.md`. Not documentation text.

## Key File Locations

**Entry Points:**

- `server/src/index.ts`: HTTP server (`pnpm start` / `pnpm --filter server dev`)
- `server/src/mcp.ts`: stdio MCP server (`server/dist/mcp.js`, bin `derive-mcp`, `pnpm --filter server mcp`)
- `web/src/main.tsx`: SPA router
- `plugin/hooks/mirror.mjs`: Claude Code hook
- `scripts/doctor.mjs`: `pnpm check`

**Configuration:**

- `server/src/config.ts`: all env-derived settings (`PORT`, `DERIVE_DATA_DIR`, `DERIVE_MODEL`, `DERIVE_EFFORT`, `DERIVE_VAULT_DIR`, `DERIVE_BACKEND`, `DERIVE_CODEX_BIN`, `CODEX_HOME`)
- `.env.example`: documented user-facing settings; `.env` at repo root is read by `node --env-file-if-exists`
- `plugin/.mcp.json`: `DERIVE_URL` for the plugin; `server/src/mcp.ts` reads `DERIVE_URL`, `DERIVE_LEARNER`, `DERIVE_ANSWER_IN`, `DERIVE_DRIVER`, `DERIVE_LESSON_ID`
- `web/vite.config.ts`: dev proxy
- `server/tsconfig.json`, `web/tsconfig.app.json`: compiler settings

**Core Logic:**

- `server/src/actions.ts`: quiz grading, confidence handling, `afterQuiz`/`afterCumulative` instructions, understanding gate, terminal reply parsing, card rendering
- `server/src/db.ts`: `setNodeStatus` (FSRS + forward to source), `propagate` (FIRe), `buildWarmup`, `buildReviewGraph`, `cumulativeStatus`, `hasUnderstandingPass`, `learnerProfile`, `preferencesSection`
- `server/src/schedule.ts`: `grade`, `schedule`, `retrievability`, `implicitRepetition`, `implicitLapse`
- `server/src/prompt.ts`: `systemPrompt`, `firstTurnPrompt`, `warmupBrief`, `materialAttachedPrompt`, `reviewTurnPrompt`
- `server/src/index.ts`: `teachingGap` (teach-first gate), `holdCard`/`withoutCards` (terminal cards), `startReview`, `learnerOf`
- `server/src/library.ts`: `addResource`, `fetchResource`, `searchLibrary`, `readResource`, `relatedResources`, `librarySection`
- `server/src/materials.ts`: `ingestMaterial`, `ingestRepo`, `readMaterial`, `searchMaterial`, `materialsSection`
- `web/src/lib/useLesson.ts`: event replay reducer and SSE wiring

**Testing:**

- `server/test/api.test.ts`: warm-up, understanding gate, cumulative quiz, implicit repetition, terminal cards, mirror gate
- `server/test/schedule.test.ts`: scheduling math
- `server/test/reply.test.ts`: `parseReply`

## Naming Conventions

**Files:**

- Server modules: lowercase single word or kebab-case, by responsibility: `actions.ts`, `codex-mirror.ts`. Compiled output keeps the name (`dist/mcp.js`).
- Web pages: `PascalCase.tsx` named after the route (`Lesson.tsx` → `/lesson/:id`), exporting `XxxPage`.
- Web components: `PascalCase.tsx`, one exported component matching the file name (`QuizCard.tsx` → `QuizCard`); cards end in `Card`.
- Web hooks: `useXxx.ts` in `lib/` (`useLesson.ts`, `useMaterials.ts`, `useVoiceMode.ts`).
- Tests: `server/test/<area>.test.ts`.
- Plugin commands: `plugin/commands/<name>.md` → `/derive:<name>`.
- Scripts: `*.mjs` plain ESM, executable with `node` directly.

**Directories:**

- Packages are workspace roots named by role (`server`, `web`); non-package top-level folders are also role-named (`plugin`, `codex`, `design`, `docs`, `scripts`).
- Web uses exactly three source folders: `pages/`, `components/`, `lib/`.

**Identifiers (relevant to placement):**

- Tool names are `snake_case` (`set_plan`, `read_material`) and appear as `mcp__derive__<tool>` (SDK) or `mcp__plugin_derive_derive__<tool>` (plugin).
- Event types are `snake_case` strings (`quiz_result`, `node_status`, `turn_end`).
- SQLite columns are `snake_case`; TS types mirror them 1:1 (`NodeRow`, `ResourceRow`); the web `types.ts` copies the same names.
- API routes: `/api/<collection>`, `/api/<collection>/:id`, `/api/lessons/:id/<verb>`, `/api/external/lessons/:id/:action` (action name = tool name).

## Where to Add New Code

**New tutor tool (something the model can call):**

1. Semantics: add an exported function in `server/src/actions.ts` (return an object the model reads; add `instruction` when the model should act on it).
2. Persistence: add prepared statements/tables in `server/src/db.ts` (append to the `ALTER TABLE` migration list for new columns).
3. Name + label: add to `DERIVE_TOOL_NAMES` and `TOOL_LABELS` in `server/src/tools.ts`.
4. Claude backend: add a `tool(...)` with a zod schema in `buildTools` in `server/src/agent.ts` and a description in `TOOL_DESCRIPTIONS`.
5. External drivers: add a `case '<tool>'` in the external action `switch` in `server/src/index.ts`, and `server.registerTool('<tool>', …)` in `server/src/mcp.ts`.
6. Plugin: add `mcp__plugin_derive_derive__<tool>` to `allowed-tools` in `plugin/commands/learn.md` (and `review.md` if used there), and describe it in `plugin/skills/teach/SKILL.md` and in the prompt text in `server/src/prompt.ts`.
7. If it opens a card: emit an event in `openXxx`, add a `PromptKind` in `server/src/prompts.ts`, handle it in `holdCard`/`renderCard`/`parseReply`, and add a card component (see below).
8. Test it in `server/test/api.test.ts` through `/api/external/lessons/:id/<tool>`.

**New lesson event / timeline item:**

- Server: `emit(lessonId, '<type>', payload)` from `actions.ts` or `index.ts`.
- Web: add to `EVENT_TYPES` and `applyEvent` in `web/src/lib/useLesson.ts`; add a `TimelineItem` variant in `web/src/lib/types.ts`; render in `web/src/pages/Lesson.tsx` (`timeline.map` switch); optionally in `server/src/export.ts` `renderMarkdown`.

**New card component:**

- Implementation: `web/src/components/<Kind>Card.tsx`, props `{ payload, result?, onAnswer, active }` following `QuizCard.tsx`; markdown through `components/Markdown.tsx`.
- Wire keyboard shortcuts inside the card as `QuizCard` does; voice replies go through `web/src/lib/useVoiceMode.ts` `activeCard`.

**New HTTP route:**

- Add to `server/src/index.ts` under the matching `// ---------- section ----------`; resolve the learner with `learnerOf(c)`; return `c.json({ error }, status)` on failure. Add a client method to `web/src/lib/api.ts` and types to `web/src/lib/types.ts`.

**New page:**

- `web/src/pages/<Name>.tsx` exporting `<Name>Page`; add a `<Route>` in `web/src/main.tsx`; link from `pages/Home.tsx` header or `components/LearnerMenu.tsx`.

**New scheduling rule:**

- Pure math in `server/src/schedule.ts` (unit-test in `server/test/schedule.test.ts`); how it applies to a graph in `server/src/db.ts` (`setNodeStatus`, `propagate`, `buildWarmup`, `buildReviewGraph`); the instruction the tutor receives in `server/src/actions.ts`.

**New material format:**

- Extend `KIND_BY_EXT`/`extractSegments` in `server/src/materials.ts`; mirror the extension in `MATERIAL_EXTS` in `server/src/mcp.ts` and `MATERIAL_ACCEPT` in `web/src/lib/useMaterials.ts`.

**New library source type (fetch strategy):**

- `server/src/library.ts` `fetchResource` and `detectKind`; kinds are in `RESOURCE_KINDS` (db.ts) and copied in `web/src/lib/types.ts`.

**New backend (another model provider):**

- Add `run<Provider>Turn(lessonId, prompt, systemPrompt, active, stopping)` in a new `server/src/<provider>.ts` returning via `emit('turn_end', …)`; extend the `Backend` union in `server/src/config.ts`, detection in `server/src/backend.ts`, and the dispatch in `agent.ts` `runTurn`. Reuse `mcpCommand()` + `DERIVE_DRIVER=app` if the provider speaks MCP.

**New env setting:**

- Read it once in `server/src/config.ts`; document in `.env.example` and the README settings table; check it in `scripts/doctor.mjs` if a wrong value blocks startup.

**Utilities:**

- Server: keep helpers next to their only caller; only cross-module constants go in `tools.ts`/`config.ts`. There is no `utils.ts`.
- Web: `web/src/lib/` for shared non-visual helpers (`order.ts`, `prefs.ts`).

**Tests:**

- `server/test/<area>.test.ts`, `node:test` + `node:assert/strict`. HTTP tests use the helpers in `api.test.ts` (`api`, `act`, `askAndAnswer`, `teachProse`, `nodes`) and run against the built server; run `pnpm build` first. There are no web tests.

## Special Directories

**`server/dist/`, `web/dist/`:**

- Purpose: Build outputs (`tsc`, `vite build`). The server serves `web/dist` when present; the plugin and Codex backend run `server/dist/mcp.js`.
- Generated: Yes
- Committed: No (`.gitignore`)

**`~/.derive/` (`DERIVE_DATA_DIR`):**

- Purpose: Runtime data outside the repo: `derive.db` (SQLite, WAL), `mirror/<session>.json` (plugin hook dedupe state), `codex/<lesson>/instructions.md` (Codex backend system prompts). Also the `cwd` for Claude SDK turns.
- Generated: Yes
- Committed: No (outside repo; `.derive/` also gitignored)

**`node_modules/`:**

- Generated: Yes (pnpm, `onlyBuiltDependencies: [esbuild]`)
- Committed: No

**`design/`:**

- Purpose: Claude Design canvas (`canvas.json` + `*.dc.html`); `derive-design-system.html` is gitignored.
- Generated: Partly (editor output)
- Committed: Yes, except the design-system file

**`.planning/`:**

- Purpose: GSD planning artefacts and codebase maps.
- Generated: By GSD commands
- Committed: Per project policy

---

*Structure analysis: 2026-09-17*
