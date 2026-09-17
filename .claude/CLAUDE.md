<!-- GSD:project-start source:PROJECT.md -->

## Project

**Derive**

Derive is a local-first AI tutor that teaches from first principles: every lesson is a dependency graph from unconditional truths to the learner's goal, taught one node at a time, locked only when the learner passes a fresh question, then kept alive with spaced review (FSRS, warm-ups, cumulative quizzes). It runs as a local web app and inside the learner's terminal (Claude Code plugin, Codex skills), sharing one SQLite record per learner.

This milestone opens Derive to any model and any way of paying for it (subscriptions, API keys, OpenRouter-style gateways, local models), makes the learning experience as effective and low-effort as it can be, lets each learner style the app to their taste without changing the method, and lowers the barrier for others to install, adopt and contribute. The goal behind all of it: Derive becomes the standard, widely adopted way to learn in the age of AI.

**Core Value:** A learner can sit down with any model they have access to and be taught the Derive way: the dependency graph, the understanding gate, the review loop, with nothing lost between providers.

**Simplicity rule (binding on every phase):** one screen, one next step. The default UI shows the lesson and what to do next; everything else lives behind Settings. No feature ships without a one-sentence reason tied to learning better. Derive must not become cluttered; its essence, tips and workflow are the product.

### Constraints

- **Tech stack**: TypeScript, Node >= 22.5, pnpm workspace, Hono, React 19, node:sqlite — the codebase is established; new providers are added inside it, not beside it
- **Local-first**: all learner data stays in `~/.derive`; keys are stored locally and never leave the machine except to the provider they belong to
- **Method fidelity**: provider work must not change what the tutor does; parity is measured against the Claude Code path
- **Compatibility**: the Claude Code plugin and Codex skills keep working through the migration; existing SQLite databases migrate forward
- **No hosted infrastructure**: nothing in this milestone requires a server the author runs for others

<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

## Languages

- TypeScript 5.9 (`^5.8.0` in manifests) - All application code: `server/src/**/*.ts` (Node backend, MCP server) and `web/src/**/*.tsx` (React frontend). Both packages compile with `strict: true`.
- JavaScript (ESM, `.mjs`) - Standalone scripts that must run with no build step: `scripts/doctor.mjs` (`pnpm check` preflight), `plugin/hooks/mirror.mjs` (Claude Code hook).
- Markdown - Claude Code plugin commands and skills: `plugin/commands/learn.md`, `plugin/commands/review.md`, `plugin/skills/teach/SKILL.md`.
- YAML - Codex skill manifests: `codex/skills/derive-learn/agents/openai.yaml`, `codex/skills/derive-review/agents/openai.yaml`; CI under `.github/`.
- HTML - Design artboards in `design/*.dc.html` (Claude Design canvas exports, not shipped code).

## Runtime

- Node.js >= 22.5 (`engines.node` in `package.json`; CI pins `node-version: 22` in `.github/workflows/ci.yml`). The floor is hard: the server uses the built-in `node:sqlite` (`DatabaseSync`) in `server/src/db.ts` instead of a native SQLite module, and `--env-file-if-exists` in the `dev`/`start` scripts. `scripts/doctor.mjs` fails loudly on older Node.
- Browser (web app): modern evergreen browser. Voice mode relies on `window.speechSynthesis` and `SpeechRecognition`/`webkitSpeechRecognition` (`web/src/lib/voice.ts`); Chrome has both, others may only speak.
- pnpm 10.33.2 (`packageManager` field in `package.json`; `pnpm/action-setup@v4` reads it in CI). `corepack enable` is the documented install path.
- Lockfile: present (`pnpm-lock.yaml`, installed with `--frozen-lockfile` in CI).
- Workspace: `pnpm-workspace.yaml` lists `server` and `web` only. `plugin/`, `codex/`, `scripts/`, `design/`, `docs/` have no `package.json` and are not workspace packages.
- `pnpm.onlyBuiltDependencies: ["esbuild"]` - only esbuild's postinstall is allowed to run.

## Frameworks

- Hono 4.13 (`hono`, `@hono/node-server` 1.19) - HTTP server, REST API under `/api/*`, SSE streaming via `hono/streaming` `streamSSE`, CORS via `hono/cors`, static serving of the built web app via `@hono/node-server/serve-static`. Entry: `server/src/index.ts`.
- React 19.2 + `react-dom` - Web UI. Entry `web/src/main.tsx`, pages in `web/src/pages/`, components in `web/src/components/`.
- React Router DOM 7.18 - Client-side routing (`web/src/main.tsx`).
- Tailwind CSS 4.3 via `@tailwindcss/vite` - Styling; global styles in `web/src/index.css`.
- `@anthropic-ai/claude-agent-sdk` 0.3.261 (declared as `latest`, resolved in lockfile) - Runs each lesson turn as an agent `query()` on the learner's Claude Code login. Tools are defined in-process with `tool()` + `createSdkMcpServer()` in `server/src/agent.ts`. Options used: `systemPrompt`, `settingSources: []`, `mcpServers: { derive }`, `tools: ['WebSearch','WebFetch']`, `allowedTools`, `permissionMode: 'dontAsk'`, `maxTurns: 400`, `model`, `effort`, `resume` (session id persisted in SQLite).
- `@openai/codex-sdk` 0.154.0 (pinned; bundles `@openai/codex` platform binaries for linux/darwin x64/arm64) - Alternative backend running lessons as `codex exec` threads on a ChatGPT login. `server/src/codex.ts` starts/resumes threads, installs the system prompt as `model_instructions_file`, and attaches Derive's own MCP server (`server/dist/mcp.js`) through a `mcp_servers` TOML config override. `server/src/backend.ts` resolves the bundled codex binary path.
- `@modelcontextprotocol/sdk` 1.30 - Derive exposed as a stdio MCP server (`server/src/mcp.ts`, `McpServer` + `StdioServerTransport`) for Claude Code, Codex CLI, and the app's own Codex backend. Proxies tool calls over HTTP to the running Derive server.
- `zod` 4.5 - Tool input schemas for both the Agent SDK tools (`server/src/agent.ts`) and the MCP server (`server/src/mcp.ts`).
- `node:test` (Node built-in runner) via `node --import tsx --test test/*.test.ts` (`server/package.json`). Tests: `server/test/api.test.ts`, `server/test/reply.test.ts`, `server/test/schedule.test.ts`. No test framework dependency; no web tests.
- `tsc` 5.9 - Server build (`server/tsconfig.json`: `module: NodeNext`, `target: ES2022`, `outDir: dist`, `rootDir: src`). Server imports use `.js` extensions.
- `tsx` 4.23 - Dev server (`tsx watch --env-file-if-exists=../.env src/index.ts`), test loader, and MCP dev fallback (`server/src/backend.ts` `mcpCommand()` runs `mcp.ts` through tsx when no `dist/` exists).
- Vite 6.4 + `@vitejs/plugin-react` 4.x - Web build/dev (`web/vite.config.ts`, dev port 5173 proxying `/api` to `http://localhost:4310`, `chunkSizeWarningLimit: 2000`). Web build is `tsc -b && vite build` with project references `web/tsconfig.app.json` / `web/tsconfig.node.json` (`moduleResolution: bundler`, `noUnusedLocals`, `noUnusedParameters`).
- `concurrently` 9.x - Root `pnpm dev` runs server and web side by side.

## Key Dependencies

- `@anthropic-ai/claude-agent-sdk` - The default tutor backend. Everything the lesson does (quiz, plan, lock nodes) is a tool call from this agent (`server/src/agent.ts`). Note: declared as `"latest"` in `server/package.json`, so a fresh install without the lockfile can float.
- `@openai/codex-sdk` - Second backend; chosen by `DERIVE_BACKEND=codex` or automatically when only a Codex login exists (`server/src/backend.ts` `backend()`).
- `ts-fsrs` 5.4.2 (pinned) - FSRS spaced-repetition scheduler behind node review dates, retrievability, and implicit repetition credit (`server/src/schedule.ts`, consumed by `server/src/db.ts`).
- `node:sqlite` (built-in) - Single-file database `~/.derive/derive.db`, WAL mode, schema created and migrated inline in `server/src/db.ts`.
- `unpdf` 1.8.1 (pinned) - PDF text extraction for attached course material and fetched papers (`server/src/materials.ts`, `server/src/library.ts`).
- `fflate` 0.8.3 (pinned) - Unzips PPTX/DOCX-style archives (`server/src/materials.ts` `unzipSync`) and gunzips GitHub tarballs (`server/src/repo.ts`).
- `@xyflow/react` 12.x + `@dagrejs/dagre` 1.1.8 - Dependency-graph rendering and auto-layout (`web/src/components/Graph.tsx`, `web/src/lib/order.ts`).
- `react-markdown` 9 + `remark-gfm` 4 + `remark-math` 6 + `rehype-katex` 7 + `katex` 0.16 - Markdown with LaTeX in lesson prose and cards (`web/src/components/Markdown.tsx`).
- `mermaid` 11 - Diagrams inside markdown (`web/src/components/Markdown.tsx`); the largest chunk, hence the raised chunk warning limit.
- `lucide-react` 0.475 - Icons.

## Configuration

- Loaded by Node's own `--env-file-if-exists=.env` (root `package.json` `check`, `server/package.json` `dev`/`start`). No dotenv library. A `.env` file is present at the repo root (gitignored) and `.env.example` documents every variable; all are optional.
- Read centrally in `server/src/config.ts`: `PORT` (default 4310), `DERIVE_DATA_DIR` (default `~/.derive`), `DERIVE_MODEL` (unset = backend's default model), `DERIVE_EFFORT` (`low|medium|high|xhigh|max`, default `high`), `DERIVE_VAULT_DIR` (Obsidian export), `DERIVE_BACKEND` (`claude|codex`), `DERIVE_CODEX_BIN`, `CODEX_HOME` (default `~/.codex`).
- Read by the MCP server / plugin hook only (`server/src/mcp.ts`, `plugin/hooks/mirror.mjs`): `DERIVE_URL` (default `http://localhost:4310`), `DERIVE_LEARNER`, `DERIVE_ANSWER_IN` (`browser|terminal`), `DERIVE_DRIVER` (`claude-code|codex|app`), `DERIVE_LESSON_ID`.
- `USER`/`USERNAME`/`HOME` are read in `server/src/db.ts` to name the default learner and locate data.
- Learner-level preferences (language, style, pace) live in the database, not env (`updateLearnerPrefs` in `server/src/db.ts`).
- `server/tsconfig.json`, `web/tsconfig.json` (+ `tsconfig.app.json`, `tsconfig.node.json`), `web/vite.config.ts`.
- Root scripts (`package.json`): `dev`, `build` (web then server), `start`, `typecheck` (`pnpm -r typecheck`), `test` (server only), `check` (`scripts/doctor.mjs`).
- No ESLint, Prettier, or Biome config detected anywhere in the repo.
- Claude Code plugin manifest `plugin/.claude-plugin/plugin.json` (version 0.4.0), MCP wiring `plugin/.mcp.json` (runs `${CLAUDE_PLUGIN_ROOT}/../server/dist/mcp.js`), hooks `plugin/hooks/hooks.json` (Stop, UserPromptSubmit, PreToolUse/PostToolUse on `mcp__(plugin_derive_)?derive__.*`, all invoking `plugin/hooks/mirror.mjs`).
- Codex skills `codex/skills/derive-learn/` and `codex/skills/derive-review/` declare a dependency on the `derive` MCP tool.
- `server/package.json` exposes a `bin`: `derive-mcp -> dist/mcp.js`.

## Platform Requirements

- Node 22.5+, pnpm 10, and a logged-in Claude Code CLI (`claude auth status` is shelled out to in `server/src/backend.ts` and `scripts/doctor.mjs`) or a Codex login (`~/.codex/auth.json`). No API keys anywhere; the tutor runs on the subscription login.
- `pnpm check` runs `scripts/doctor.mjs` to verify Node, pnpm, Claude login, `node_modules`, built artifacts, and the port.
- Linux, macOS, or Windows (Codex binary resolution in `server/src/backend.ts` handles linux/darwin/win32 on x64/arm64).
- Self-hosted local process: `pnpm build && pnpm start` runs `node --env-file-if-exists=../.env dist/index.js`, which serves the API and the built `web/dist` from one port (4310). Data in `~/.derive` (SQLite DB, per-lesson Codex working dirs under `~/.derive/codex/<lesson>`, hook mirror state under `~/.derive/mirror/`).
- Release artifacts (`.github/workflows/release.yml`, on `v*` tags): `derive-<tag>.tar.gz` (full app) and `derive-plugin-<tag>.tar.gz` (plugin + `server/dist`), attached to a GitHub release via `softprops/action-gh-release@v2`.
- No container, cloud, or PaaS deployment config detected.

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## Naming Patterns

- Server modules: lowercase, one word where possible, kebab-case when two: `server/src/db.ts`, `server/src/schedule.ts`, `server/src/codex-mirror.ts`. Each file is a topic (the database, the scheduler, the prompts), not a layer.
- Web components: PascalCase `.tsx`, one exported component per file, file name equals component name: `web/src/components/QuizCard.tsx` exports `QuizCard`.
- Web pages: PascalCase `.tsx` in `web/src/pages/`, exported as `XxxPage` (`web/src/pages/Home.tsx` exports `HomePage`).
- Web hooks and helpers: camelCase `.ts` in `web/src/lib/`; hooks are `useXxx.ts` (`web/src/lib/useLesson.ts`, `web/src/lib/useMaterials.ts`, `web/src/lib/useVoiceMode.ts`).
- Tests: `server/test/<module>.test.ts`, named after the module or feature under test (`schedule.test.ts`, `reply.test.ts`, `api.test.ts`).
- Standalone scripts: `.mjs` with a `#!/usr/bin/env node` shebang (`scripts/doctor.mjs`, `plugin/hooks/mirror.mjs`).
- camelCase, verb-first, short: `getLesson`, `listNodes`, `replaceGraph`, `setNodeStatus`, `emit`, `subscribe`, `parseReply`.
- Database accessors in `server/src/db.ts` follow a fixed verb vocabulary: `create*`, `get*`, `find*`, `list*`, `update*`, `set*`, `delete*`, `rename*`, `sweep*`.
- Predicates read as booleans: `isBusy`, `hasPending`, `hasUnderstandingPass`, `claudeLoggedIn`, `codexLoggedIn`, `isKind`.
- "Of" helpers compute something for one input: `learnerOf(c)`, `purposeOf(lessonId, nodeId)`, `cardOf(node, now)`, `tagsOf`, `segmentsOf`.
- When importing a name that would collide, alias with a short suffix: `import { readMaterial as readMat, searchMaterial as searchMat } from './materials.js'` (`server/src/actions.ts`).
- Small helpers are `const` arrow functions; anything with a doc comment and more than a few lines is a `function` declaration.
- camelCase for locals and parameters; snake_case is reserved for fields that mirror the SQLite schema or the wire format (`node_id`, `review_at`, `depends_on`, `learner_id`, `answer_in`). Do not rename those to camelCase when passing through; `rowsToNodes` in `web/src/lib/useLesson.ts` is the one place a row is reshaped.
- Module-level constants are UPPER_SNAKE: `PORT`, `DATA_DIR`, `DB_PATH`, `DEFAULT_LEARNER_ID`, `DERIVE_TOOL_NAMES`, `TOOL_LABELS`, `QUIZ_PURPOSES`, `MATERIAL_ACCEPT`, `LEARNER_KEY`. A shared time constant is `const DAY = 86_400_000;` (used in `server/src/schedule.ts` and the tests).
- Single-letter names are fine in tight scopes: `c` for a Hono `Context`, `e` for a caught error or DOM event, `l` for a lesson/learner in a loop, `r` for a response, `n` for a node.
- PascalCase `type` aliases; interfaces are not used. Union-of-string-literal types for enums: `type NodeKind = 'truth' | 'derived' | 'goal'`, `type Backend = 'claude' | 'codex'`, `type Grade = 'again' | 'hard' | 'good'`.
- Rows from SQLite are `XxxRow` (`NodeRow`, `MaterialRow`, `StoredEvent`); tool argument shapes are `XxxArgs` (`QuizArgs`); event payloads on the web are `XxxPayload` (`AskPayload`, `QuizResultPayload`).
- Types are exported alongside functions with inline `type` modifiers: `import { appendEvent, type StoredEvent } from './db.js'`.
- Runtime lists that double as types use `as const` and `typeof`: `DERIVE_TOOL_NAMES` in `server/src/tools.ts`, `RESOURCE_KINDS` in `server/src/library.ts`, `QUIZ_TESTS` in `server/src/db.ts`.

## Code Style

- No Prettier, ESLint, Biome or `.editorconfig` in the repo. Formatting is by hand and consistent; match the surrounding file.
- Single quotes everywhere (zero double-quoted strings in `web/src/lib/api.ts`); semicolons always; trailing commas in multi-line literals and argument lists; 2-space indent.
- Long lines are accepted. Nearly 500 lines exceed 140 columns; a single-statement route handler or a `assert.deepEqual` call stays on one line rather than wrapping. Do not reflow existing lines to a narrower width.
- Prefer the ternary chain over `if/else` for value selection: `const state = i < idx ? 'done' : i === idx ? 'active' : 'todo';` (`web/src/components/PhaseBar.tsx`).
- Single-statement `if` bodies stay on the same line without braces: `if (!lesson) return c.json({ error: 'lesson not found' }, 404);`.
- `for (const x of xs)` over `forEach` in server code; array methods (`map`, `filter`, `some`) for expressions.
- Nullish coalescing and optional chaining are the default: `process.env.PORT ?? 4310`, `listeners.get(lessonId) ?? []`, `lesson?.mode`.
- Numeric literals with underscores for readability: `86_400_000`, `20_000`.
- TypeScript `strict: true` in both `server/tsconfig.json` and `web/tsconfig.app.json` is the only enforced check (`pnpm typecheck` runs in CI, `.github/workflows/ci.yml`).
- Web additionally sets `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `isolatedModules` (`web/tsconfig.app.json`). Unused imports fail the build.
- Four `// eslint-disable-next-line react-hooks/exhaustive-deps` comments exist in `web/src/components/{AskCard,PlanCard,QuizCard}.tsx` and `web/src/lib/useVoiceMode.ts` even though ESLint is not installed; they mark keydown effects that intentionally omit `send` from deps. Keep the comment when copying that pattern.
- No `@ts-ignore` or `@ts-expect-error` anywhere. Narrow with type guards (`(f): f is File => f instanceof File`) or a targeted `as` cast instead.

## Import Organization

- None. Relative paths only.
- Server (`module: NodeNext`) imports local files with the `.js` extension even though the source is `.ts`: `import { emit } from './events.js'`. Tests import source the same way: `from '../src/schedule.js'`.
- Web (`moduleResolution: bundler`) imports without an extension: `import { api } from './api'`, `import type { Material } from '../lib/types'`.
- A web file that only needs types uses `import type { ... }` as a whole statement (`web/src/lib/api.ts` line 1).

## Error Handling

- Throw plain `Error` with a lowercase, human-readable message that can be shown to the learner or the model as-is: `throw new Error('learner not found')`, `throw new Error('the first learner cannot be removed; rename it instead')` (`server/src/db.ts`), `throw new Error('No active lesson. Call start_lesson first.')` (`server/src/mcp.ts`). No custom error classes, no error codes.
- HTTP routes in `server/src/index.ts` translate a thrown error into `{ error: message }` with a 4xx status:
- Always narrow the caught value with `e instanceof Error ? e.message : String(e)`; never assume `e` is an `Error` on the server. On the web, `(e as Error).message` is accepted inside hooks (`web/src/lib/useMaterials.ts`).
- Fire-and-forget promises are marked `void` and given a logging catch: `void runTurn(id, text).catch((e) => console.error('[turn]', e));`.
- Best-effort operations swallow with an empty catch that carries a one-word comment saying why: `catch { /* not installed */ }` (`server/src/backend.ts`), `catch { /* private mode */ }` (`web/src/lib/api.ts`), `catch { /* not up yet */ }` (`server/test/api.test.ts`). Use `.catch(() => undefined)` or `.catch(() => null)` for the promise form.
- The web API client (`web/src/lib/api.ts`, function `j<T>`) turns a non-OK response into a thrown `Error` whose message is the server's `error` field, so components only need `try { await api.x() } catch (e) { setError(...) }`.
- Component state carries errors as `error: string | null` (`LessonState` in `web/src/lib/useLesson.ts`, `useMaterials`), never as an `Error` object.

## Logging

- The server logs almost nothing. Two startup lines in `server/src/index.ts` (`derive server on http://localhost:...`, `tutor runs on ...`) and error lines with a bracketed subsystem tag: `console.error('[turn]', e)`, `console.error('[vault]', ...)`, `console.warn('[codex] ...')`.
- When adding a log line, prefix it with a `[tag]` naming the subsystem and log only failures or startup facts. Do not log per-request.
- Everything the learner or the model should see goes through the event stream (`emit` in `server/src/events.ts`) or the tool result, not the console.
- `scripts/doctor.mjs` is the exception: it is a report and prints with `console.log` through `ok/warn/fail` collectors.
- The web has no console output outside error boundaries; surface problems in state (`error` fields) and render them.

## Comments

- Every server module opens with a `/** ... */` block explaining what the module is for and, where relevant, the design reasoning (see `server/src/actions.ts`, `server/src/schedule.ts`, `server/src/backend.ts`, `server/src/mcp.ts`, `server/src/notices.ts`). Write these as prose paragraphs, not bullet lists.
- Inline `//` comments explain a non-obvious *why*, usually in one sentence and in plain English: `// pnpm keeps @openai/codex under the SDK's own node_modules, so resolve it from there.` They never restate what the code does.
- Comments reference the learning-science reasoning when it drives a decision (FSRS discounting early reviews, Skycak's implicit repetition) so a future change does not undo it by accident.
- Section separators in long route files: `// ---------- learners ----------` (`server/src/index.ts`).
- No TODO/FIXME markers are in use; unfinished work is not left in comments.
- One-line `/** ... */` on most exported functions, constants and type fields, written as a sentence fragment describing the value or the effect: `/** Persist an event for a lesson and fan it out to live subscribers. */`, `/** Optional Obsidian vault folder to export lessons into. */`.
- No `@param`/`@returns` tags. Parameter meaning goes into the sentence or into the type.
- Type fields get the same one-liners where the name alone is ambiguous: `/** Companion lessons: where cards are answered. */ answer_in: 'browser' | 'terminal';` (`web/src/lib/types.ts`).
- Zod schemas for MCP tools carry `.describe('...')` on every field; those strings are the model-facing documentation (`server/src/mcp.ts`).

## Function Design

- Positional for one to three arguments; an options object for anything optional (`runTurn(id, text, { echoUser: text })`, `schedule(node, 'good', now)`).
- Time is passed in as `now: number` (ms since epoch) with a `Date.now()` default so callers and tests can pin it: `schedule(node, grade, now = Date.now())` in `server/src/schedule.ts`.
- React components take a single destructured props object typed inline, not a separate `Props` type:
- Accept the narrowest type that works: `cardOf(node: Pick<NodeRow, 'stability' | 'difficulty' | ...>)`.
- Return plain object literals; the result of a tutor action is what the model is told, and often includes an `instruction` string the model should follow next (`server/src/actions.ts`).
- `null` for "not found" on lookups (`getLesson(id)` returns `undefined`, `lessonView` returns `null`); `undefined` for "not configured" (`MODEL`, `VAULT_DIR`, `codexBinary()`).
- Scheduler functions return the delta to spread onto the row (`Scheduled`), and `null` when nothing applies (`implicitRepetition(fresh, 0.5) === null`).
- Subscribe-style functions return their own unsubscribe: `subscribe(lessonId, l): () => void` (`server/src/events.ts`); effects in React return the cleanup from `useEffect`.

## Module Design

- Named exports only. `export default` appears nowhere in `server/src` or `web/src` (the only default is `vite.config.ts`'s `defineConfig`).
- Modules export a flat set of functions and constants; `server/src/db.ts` exports 82 names, `server/src/actions.ts` 25. No classes except `RolloutMirror` in `server/src/codex-mirror.ts`, which wraps a long-lived watcher.
- Module-level state is allowed when it is the module's purpose and is documented: `notices` Map in `server/src/notices.ts`, `listeners` in `server/src/events.ts`, `resolved` backend cache in `server/src/backend.ts`, the `db` handle in `server/src/db.ts`.
- Side effects on import are real and deliberate: `server/src/db.ts` opens the SQLite file and runs `CREATE TABLE IF NOT EXISTS` at import time; `server/src/index.ts` closes stale turns on boot. Tests that touch `actions.ts` set `DERIVE_DATA_DIR` before a dynamic `await import(...)` for this reason (`server/test/reply.test.ts`).
- Configuration is read from `process.env` exactly once, in `server/src/config.ts`, and exported as constants. Other modules import those constants; they do not read `process.env` themselves (exception: the standalone `server/src/mcp.ts`, which runs as its own process).
- On the web, `web/src/lib/api.ts` exports a single `api` object whose keys are the endpoints; add a new endpoint as a new key there rather than calling `fetch` in a component.
- Shared web types live in `web/src/lib/types.ts` and mirror the server's row and payload shapes by hand; there is no generated client.
- None. Import from the concrete module (`'./db.js'`, `'../lib/types'`), never from an `index.ts`.
- `server/src/index.ts` is the HTTP entry point, not a barrel; `web/src/main.tsx` is the React entry point.

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## System Overview

```text

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

- **Every lesson is an append-only event stream** in the `events` table (`server/src/db.ts`), fanned out over SSE (`server/src/events.ts`). The browser rebuilds all state by replaying events (`web/src/lib/useLesson.ts` `reducer` → `applyEvent`); there is no separate "current state" API beyond `nodes`/`materials` rows.
- **Cards are tool calls that block on the learner.** `quiz`, `ask`, `set_plan`, `explain_back` open a prompt (`server/src/prompts.ts` `openPrompt`) and resolve when `POST /api/lessons/:id/answer` or the terminal `answer` action arrives. The model never grades its own question; the server does (`server/src/actions.ts` `openQuiz`).
- **Learning mechanics live server-side, enforced in tool results.** The understanding gate (`needsUnderstanding`), the cumulative quiz (`cumulativeStatus`, `afterCumulative`), targeted remediation (`dependencyRecord`), FIRe credit (`db.ts` `propagate`) and library nudges all return `instruction`/`refused` fields that steer the model. Tests drive them over HTTP with no model (`server/test/api.test.ts`).
- **Driver abstraction by mode.** `lessons.mode` is `agent` (server runs the model) or `external` (a terminal runs it). External lessons are "busy" from `turn_start` until a hook/mirror posts `/end`; agent lessons are busy while `agent.ts` `active` holds an entry.
- **Backend abstraction by `Active`.** `agent.ts` `runTurn` builds the shared system prompt and dispatches to either the Claude SDK path (same file) or `codex.ts` `runCodexTurn`; both register an `{ interrupt }` in the `active` map and emit the same `assistant`/`status`/`turn_end` events.
- **Multi-learner by id.** Every read/write is scoped by `learner_id`, resolved in `index.ts` `learnerOf` from the `x-derive-learner` header, `?learner=`, or a body field; unknown falls back to `DEFAULT_LEARNER_ID`.

## Layers

- Purpose: Get a model to call the tutor tools with the teaching method as its instructions.
- Location: `server/src/agent.ts`, `server/src/codex.ts`, `server/src/mcp.ts`, `plugin/`, `codex/skills/`
- Contains: SDK invocations, tool schemas (zod), MCP server registration, hooks, skill text.
- Depends on: actions, prompt, events, db (session ids), tools, backend/config.
- Used by: `index.ts` (calls `runTurn`/`interrupt`); Claude Code and Codex CLIs (spawn `mcp.js`).
- Purpose: Everything the browser, the MCP proxy and the hooks talk to.
- Location: `server/src/index.ts` (single Hono app, ~840 lines, grouped by `// ---------- section ----------` comments).
- Contains: Route handlers, `learnerOf`, `busy`, `lessonView`, `startReview`, held-card bookkeeping (`held`, `holdCard`, `recentCards`, `withoutCards`), the `teachingGap` gate, static serving of `web/dist`.
- Depends on: every server module.
- Used by: `web/src/lib/api.ts`, `server/src/mcp.ts`, `plugin/hooks/mirror.mjs`, `server/test/api.test.ts`.
- Purpose: Driver-independent semantics of each tool: record state, emit events, return what the model should be told.
- Location: `server/src/actions.ts`
- Contains: `openQuiz`/`quiz`, `openAsk`/`ask`, `openPlan`/`setPlan`, `openExplain`/`explainBack`, `nodeStatus`, `phase`, `remember`, `setPreferences`, material/library wrappers, `profile`, `parseReply`, `renderCard`, and the instruction builders `afterQuiz`, `afterCumulative`, `dependencyRecord`, `planLibraryInstruction`, `libraryHint`.
- Depends on: db, schedule (types), events, prompts, notices, library, materials.
- Used by: `agent.ts` (in-process tools), `index.ts` (external actions).
- Purpose: Small single-purpose modules shared by actions and the API.
- Location: `server/src/prompts.ts` (pending cards), `server/src/events.ts` (persist + fan-out), `server/src/notices.ts` (deferred messages), `server/src/tools.ts` (tool names/labels).
- Depends on: db, export (events triggers vault mirror).
- Purpose: The learning-science and content logic with no HTTP or model awareness.
- Location: `server/src/schedule.ts` (FSRS/FIRe math), `server/src/db.ts` (also holds `setNodeStatus`, `propagate`, `buildWarmup`, `buildReviewGraph`, `cumulativeStatus`, `hasUnderstandingPass`, `learnerProfile`), `server/src/materials.ts`, `server/src/repo.ts`, `server/src/library.ts`, `server/src/export.ts`, `server/src/prompt.ts`.
- Depends on: `ts-fsrs`, `unpdf`, `fflate`, `node:sqlite`.
- Purpose: One SQLite file, WAL mode, prepared statements in a `q` object.
- Location: `server/src/db.ts`; file at `DERIVE_DATA_DIR/derive.db` (default `~/.derive/derive.db`).
- Tables: `lessons`, `events`, `nodes`, `memory`, `misconceptions`, `quiz_results`, `materials`, `learners`, `resources`. Migrations are an `ALTER TABLE ... ADD COLUMN` list wrapped in try/catch (`db.ts` lines 107–130).
- Purpose: Render the timeline, cards, graph, atlas, library and preferences; answer cards; voice mode.
- Location: `web/src/`
- Contains: `main.tsx` router, `pages/`, `components/`, `lib/` (api, reducer hook, types, voice, prefs, topo order).
- Depends on: server HTTP API only (proxied by Vite in dev, same origin in prod).

## Data Flow

### Primary Request Path (app lesson, Claude backend)

### External (companion) lesson path — Claude Code plugin

### External lesson path — Codex terminal

### App lesson on the Codex backend

### Review session

- Server: module-level maps are the only in-memory state: `agent.ts` `active`/`stopping`, `prompts.ts` `pending`, `events.ts` `listeners`, `notices.ts` `notices`, `index.ts` `held`/`recentCards`, `export.ts` `mirrorTimers`, `backend.ts` `resolved`. Everything else is in SQLite. On boot `index.ts` lines 57–61 close stale `turn_start`s.
- Browser: `useReducer` in `web/src/lib/useLesson.ts`; learner selection in `localStorage['derive.learner']`; voice toggle in `localStorage['derive.voice']`.

## Key Abstractions

- Purpose: One teaching session; `mode` (`agent`|`external`), `phase` (`probe`|`plan`|`teach`), `session_id` (SDK/Codex thread to resume), `answer_in`, `driver`, `learner_id`.
- Examples: `server/src/db.ts` `Lesson` type; `web/src/lib/types.ts` `Lesson`.
- Pattern: Row for identity, events for history.
- Purpose: A claim (`truth`|`derived`|`goal`) with `depends_on` (JSON array), `status` (`pending`|`teaching`|`locked`|`shaky`) and FSRS fields (`stability`, `difficulty`, `reps`, `lapses`, `interval_days`, `review_at`, `last_review`). `source_lesson`/`source_node` mark a review/warm-up copy.
- Examples: `server/src/db.ts` `NodeRow`, `GraphNodeInput`, `replaceGraph`, `setNodeStatus`.
- Pattern: Copies forward writes to their source so the Atlas sees one node.
- Purpose: A tool call waiting on the learner; `kind` in `quiz|ask|plan|explain`; `held` when it outlives the turn (terminal answering).
- Examples: `actions.openQuiz` etc. return `{ id, done }`; blocking wrappers are `.done`.
- Purpose: The unit of the lesson log. Types emitted by the server: `turn_start`, `turn_end`, `user`, `assistant` (partial/rewritten), `status`/`delta` (ephemeral, `seq:-1`), `quiz`, `quiz_result`, `ask`, `ask_result`, `plan`, `plan_result`, `explain`, `explain_result`, `phase`, `warmup`, `node_status`, `memory`, `preferences`, `material`, `material_removed`, `resource`, `answer_in`, `ready` (SSE-only).
- Examples: `web/src/lib/useLesson.ts` `EVENT_TYPES` must list every type the SSE stream can carry, or the browser ignores it.
- Purpose: Tool results carry `instruction`, `refused`, `notice` fields; that is how the server steers the model.
- Examples: `actions.afterQuiz`, `actions.nodeStatus`, `index.ts` `withNotices`, `actions.withNotice`.
- Purpose: `purpose` in `probe|pretest|check|cumulative|review` (defaulted by `actions.purposeOf`); `tests` in `intuition|procedure|transfer`. `hasUnderstandingPass` requires a non-pretest correct `intuition`/`transfer` row.
- Examples: `server/src/db.ts` `QuizPurpose`, `QuizTests`; mirrored in `web/src/lib/types.ts`.
- Purpose: Profile with `prefs` (`LearnerPrefs`: language, style, pace, background, how, examples) and everything scoped to it.
- Examples: `db.ts` `cleanPrefs`, `preferencesSection`, `learnerProfile`; `index.ts` `learnerOf`.
- Purpose: Material = per-lesson course content split into segments joined by ASCII RS (`materials.ts` `SEP`). Resource = per-learner library entry with fetched text in the same segment format.
- Examples: `materials.ts` `readMaterial`/`searchMaterial`; `library.ts` `readResource`/`searchLibrary`/`relatedResources`.

## Entry Points

- Location: `server/src/index.ts` (`pnpm start` → `server/dist/index.js`; `pnpm --filter server dev` → `tsx watch`)
- Triggers: `serve({ fetch: app.fetch, port: PORT })` at the bottom of the file.
- Responsibilities: Boot-time cleanup, route registration, static hosting of `web/dist`, startup log naming the backend.
- Location: `server/src/mcp.ts` (built to `server/dist/mcp.js`; `bin: derive-mcp`)
- Triggers: `plugin/.mcp.json`, `claude mcp add derive -- node .../mcp.js`, or `codex.ts` `mcpCommand()`.
- Responsibilities: Tool registration, HTTP proxying, file attachment, browser opening, Codex session mirroring.
- Location: `web/src/main.tsx` (routes `/`, `/lesson/:id`, `/atlas`, `/library`, `/you`), `web/index.html`.
- Triggers: Vite dev server on :5173 (proxying `/api` to :4310) or served statically by the server.
- Location: `plugin/hooks/mirror.mjs`; wired in `plugin/hooks/hooks.json`.
- Triggers: Claude Code `Stop`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse` events.
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

### Emitting an event type the browser does not know

### Persisting high-frequency deltas

### Writing node memory on the copy only

### Bypassing `learnerOf`

## Error Handling

- Route handlers wrap JSON parsing with `.catch(() => ({}))` and return `c.json({ error }, 400|404|409|422|500)`; a shared `err(c, e, status)` helper exists for library routes (`index.ts` line 387).
- Refusals that are part of the method return `{ ok:false, refused:true, error }` with status 400 (`actions.nodeStatus`) and say "This is the method, not an error to investigate" so the model does not debug the server.
- Turn failures: `agent.ts` and `codex.ts` both use an idempotent `endTurn` guard and always emit `turn_end` in `finally`; `stopping` marks user-initiated interrupts as `interrupted: true` rather than errors.
- Codex API errors are unwrapped from JSON and given fix hints (`codex.ts` `friendly`).
- Background fire-and-forget: `void runTurn(...).catch((e) => console.error('[turn]', e))`.
- MCP proxy: `mcp.ts` `api()` throws `derive server: <message>` so Claude Code shows the server's sentence.
- Browser: `api.ts` `j()` throws `Error(res.json().error ?? statusText)`; pages show inline messages.

## Cross-Cutting Concerns

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
