---
last_mapped_commit: 7d7db1f8c9352186f02b02ddb34172e66fef5eb5
last_mapped_at: 2026-09-17
---
# Technology Stack

**Analysis Date:** 2026-09-17

## Languages

**Primary:**

- TypeScript 5.9 (`^5.8.0` in manifests) - All application code: `server/src/**/*.ts` (Node backend, MCP server) and `web/src/**/*.tsx` (React frontend). Both packages compile with `strict: true`.

**Secondary:**

- JavaScript (ESM, `.mjs`) - Standalone scripts that must run with no build step: `scripts/doctor.mjs` (`pnpm check` preflight), `plugin/hooks/mirror.mjs` (Claude Code hook).
- Markdown - Claude Code plugin commands and skills: `plugin/commands/learn.md`, `plugin/commands/review.md`, `plugin/skills/teach/SKILL.md`.
- YAML - Codex skill manifests: `codex/skills/derive-learn/agents/openai.yaml`, `codex/skills/derive-review/agents/openai.yaml`; CI under `.github/`.
- HTML - Design artboards in `design/*.dc.html` (Claude Design canvas exports, not shipped code).

## Runtime

**Environment:**

- Node.js >= 22.5 (`engines.node` in `package.json`; CI pins `node-version: 22` in `.github/workflows/ci.yml`). The floor is hard: the server uses the built-in `node:sqlite` (`DatabaseSync`) in `server/src/db.ts` instead of a native SQLite module, and `--env-file-if-exists` in the `dev`/`start` scripts. `scripts/doctor.mjs` fails loudly on older Node.
- Browser (web app): modern evergreen browser. Voice mode relies on `window.speechSynthesis` and `SpeechRecognition`/`webkitSpeechRecognition` (`web/src/lib/voice.ts`); Chrome has both, others may only speak.

**Package Manager:**

- pnpm 10.33.2 (`packageManager` field in `package.json`; `pnpm/action-setup@v4` reads it in CI). `corepack enable` is the documented install path.
- Lockfile: present (`pnpm-lock.yaml`, installed with `--frozen-lockfile` in CI).
- Workspace: `pnpm-workspace.yaml` lists `server` and `web` only. `plugin/`, `codex/`, `scripts/`, `design/`, `docs/` have no `package.json` and are not workspace packages.
- `pnpm.onlyBuiltDependencies: ["esbuild"]` - only esbuild's postinstall is allowed to run.

## Frameworks

**Core:**

- Hono 4.13 (`hono`, `@hono/node-server` 1.19) - HTTP server, REST API under `/api/*`, SSE streaming via `hono/streaming` `streamSSE`, CORS via `hono/cors`, static serving of the built web app via `@hono/node-server/serve-static`. Entry: `server/src/index.ts`.
- React 19.2 + `react-dom` - Web UI. Entry `web/src/main.tsx`, pages in `web/src/pages/`, components in `web/src/components/`.
- React Router DOM 7.18 - Client-side routing (`web/src/main.tsx`).
- Tailwind CSS 4.3 via `@tailwindcss/vite` - Styling; global styles in `web/src/index.css`.

**AI / agent frameworks (the tutor itself):**

- `@anthropic-ai/claude-agent-sdk` 0.3.261 (declared as `latest`, resolved in lockfile) - Runs each lesson turn as an agent `query()` on the learner's Claude Code login. Tools are defined in-process with `tool()` + `createSdkMcpServer()` in `server/src/agent.ts`. Options used: `systemPrompt`, `settingSources: []`, `mcpServers: { derive }`, `tools: ['WebSearch','WebFetch']`, `allowedTools`, `permissionMode: 'dontAsk'`, `maxTurns: 400`, `model`, `effort`, `resume` (session id persisted in SQLite).
- `@openai/codex-sdk` 0.154.0 (pinned; bundles `@openai/codex` platform binaries for linux/darwin x64/arm64) - Alternative backend running lessons as `codex exec` threads on a ChatGPT login. `server/src/codex.ts` starts/resumes threads, installs the system prompt as `model_instructions_file`, and attaches Derive's own MCP server (`server/dist/mcp.js`) through a `mcp_servers` TOML config override. `server/src/backend.ts` resolves the bundled codex binary path.
- `@modelcontextprotocol/sdk` 1.30 - Derive exposed as a stdio MCP server (`server/src/mcp.ts`, `McpServer` + `StdioServerTransport`) for Claude Code, Codex CLI, and the app's own Codex backend. Proxies tool calls over HTTP to the running Derive server.
- `zod` 4.5 - Tool input schemas for both the Agent SDK tools (`server/src/agent.ts`) and the MCP server (`server/src/mcp.ts`).

**Testing:**

- `node:test` (Node built-in runner) via `node --import tsx --test test/*.test.ts` (`server/package.json`). Tests: `server/test/api.test.ts`, `server/test/reply.test.ts`, `server/test/schedule.test.ts`. No test framework dependency; no web tests.

**Build/Dev:**

- `tsc` 5.9 - Server build (`server/tsconfig.json`: `module: NodeNext`, `target: ES2022`, `outDir: dist`, `rootDir: src`). Server imports use `.js` extensions.
- `tsx` 4.23 - Dev server (`tsx watch --env-file-if-exists=../.env src/index.ts`), test loader, and MCP dev fallback (`server/src/backend.ts` `mcpCommand()` runs `mcp.ts` through tsx when no `dist/` exists).
- Vite 6.4 + `@vitejs/plugin-react` 4.x - Web build/dev (`web/vite.config.ts`, dev port 5173 proxying `/api` to `http://localhost:4310`, `chunkSizeWarningLimit: 2000`). Web build is `tsc -b && vite build` with project references `web/tsconfig.app.json` / `web/tsconfig.node.json` (`moduleResolution: bundler`, `noUnusedLocals`, `noUnusedParameters`).
- `concurrently` 9.x - Root `pnpm dev` runs server and web side by side.

## Key Dependencies

**Critical:**

- `@anthropic-ai/claude-agent-sdk` - The default tutor backend. Everything the lesson does (quiz, plan, lock nodes) is a tool call from this agent (`server/src/agent.ts`). Note: declared as `"latest"` in `server/package.json`, so a fresh install without the lockfile can float.
- `@openai/codex-sdk` - Second backend; chosen by `DERIVE_BACKEND=codex` or automatically when only a Codex login exists (`server/src/backend.ts` `backend()`).
- `ts-fsrs` 5.4.2 (pinned) - FSRS spaced-repetition scheduler behind node review dates, retrievability, and implicit repetition credit (`server/src/schedule.ts`, consumed by `server/src/db.ts`).
- `node:sqlite` (built-in) - Single-file database `~/.derive/derive.db`, WAL mode, schema created and migrated inline in `server/src/db.ts`.
- `unpdf` 1.8.1 (pinned) - PDF text extraction for attached course material and fetched papers (`server/src/materials.ts`, `server/src/library.ts`).
- `fflate` 0.8.3 (pinned) - Unzips PPTX/DOCX-style archives (`server/src/materials.ts` `unzipSync`) and gunzips GitHub tarballs (`server/src/repo.ts`).

**Web UI:**

- `@xyflow/react` 12.x + `@dagrejs/dagre` 1.1.8 - Dependency-graph rendering and auto-layout (`web/src/components/Graph.tsx`, `web/src/lib/order.ts`).
- `react-markdown` 9 + `remark-gfm` 4 + `remark-math` 6 + `rehype-katex` 7 + `katex` 0.16 - Markdown with LaTeX in lesson prose and cards (`web/src/components/Markdown.tsx`).
- `mermaid` 11 - Diagrams inside markdown (`web/src/components/Markdown.tsx`); the largest chunk, hence the raised chunk warning limit.
- `lucide-react` 0.475 - Icons.

## Configuration

**Environment:**

- Loaded by Node's own `--env-file-if-exists=.env` (root `package.json` `check`, `server/package.json` `dev`/`start`). No dotenv library. A `.env` file is present at the repo root (gitignored) and `.env.example` documents every variable; all are optional.
- Read centrally in `server/src/config.ts`: `PORT` (default 4310), `DERIVE_DATA_DIR` (default `~/.derive`), `DERIVE_MODEL` (unset = backend's default model), `DERIVE_EFFORT` (`low|medium|high|xhigh|max`, default `high`), `DERIVE_VAULT_DIR` (Obsidian export), `DERIVE_BACKEND` (`claude|codex`), `DERIVE_CODEX_BIN`, `CODEX_HOME` (default `~/.codex`).
- Read by the MCP server / plugin hook only (`server/src/mcp.ts`, `plugin/hooks/mirror.mjs`): `DERIVE_URL` (default `http://localhost:4310`), `DERIVE_LEARNER`, `DERIVE_ANSWER_IN` (`browser|terminal`), `DERIVE_DRIVER` (`claude-code|codex|app`), `DERIVE_LESSON_ID`.
- `USER`/`USERNAME`/`HOME` are read in `server/src/db.ts` to name the default learner and locate data.
- Learner-level preferences (language, style, pace) live in the database, not env (`updateLearnerPrefs` in `server/src/db.ts`).

**Build:**

- `server/tsconfig.json`, `web/tsconfig.json` (+ `tsconfig.app.json`, `tsconfig.node.json`), `web/vite.config.ts`.
- Root scripts (`package.json`): `dev`, `build` (web then server), `start`, `typecheck` (`pnpm -r typecheck`), `test` (server only), `check` (`scripts/doctor.mjs`).
- No ESLint, Prettier, or Biome config detected anywhere in the repo.

**Plugin / agent packaging:**

- Claude Code plugin manifest `plugin/.claude-plugin/plugin.json` (version 0.4.0), MCP wiring `plugin/.mcp.json` (runs `${CLAUDE_PLUGIN_ROOT}/../server/dist/mcp.js`), hooks `plugin/hooks/hooks.json` (Stop, UserPromptSubmit, PreToolUse/PostToolUse on `mcp__(plugin_derive_)?derive__.*`, all invoking `plugin/hooks/mirror.mjs`).
- Codex skills `codex/skills/derive-learn/` and `codex/skills/derive-review/` declare a dependency on the `derive` MCP tool.
- `server/package.json` exposes a `bin`: `derive-mcp -> dist/mcp.js`.

## Platform Requirements

**Development:**

- Node 22.5+, pnpm 10, and a logged-in Claude Code CLI (`claude auth status` is shelled out to in `server/src/backend.ts` and `scripts/doctor.mjs`) or a Codex login (`~/.codex/auth.json`). No API keys anywhere; the tutor runs on the subscription login.
- `pnpm check` runs `scripts/doctor.mjs` to verify Node, pnpm, Claude login, `node_modules`, built artifacts, and the port.
- Linux, macOS, or Windows (Codex binary resolution in `server/src/backend.ts` handles linux/darwin/win32 on x64/arm64).

**Production:**

- Self-hosted local process: `pnpm build && pnpm start` runs `node --env-file-if-exists=../.env dist/index.js`, which serves the API and the built `web/dist` from one port (4310). Data in `~/.derive` (SQLite DB, per-lesson Codex working dirs under `~/.derive/codex/<lesson>`, hook mirror state under `~/.derive/mirror/`).
- Release artifacts (`.github/workflows/release.yml`, on `v*` tags): `derive-<tag>.tar.gz` (full app) and `derive-plugin-<tag>.tar.gz` (plugin + `server/dist`), attached to a GitHub release via `softprops/action-gh-release@v2`.
- No container, cloud, or PaaS deployment config detected.

---

*Stack analysis: 2026-09-17*
