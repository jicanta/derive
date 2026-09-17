---
last_mapped_commit: 7d7db1f8c9352186f02b02ddb34172e66fef5eb5
last_mapped_at: 2026-09-17
---
# External Integrations

**Analysis Date:** 2026-09-17

## APIs & External Services

**LLM backends (subscription login, no API key):**

- Claude (via Claude Code login) - Default tutor. Each lesson turn is a `query()` from the Claude Agent SDK with Derive's tools mounted as an in-process MCP server; the agent may also call the SDK's built-in `WebSearch` and `WebFetch` (counted as "verified" sources in `server/src/agent.ts:330`).
  - SDK/Client: `@anthropic-ai/claude-agent-sdk` - `server/src/agent.ts`
  - Auth: none in Derive; the SDK uses the local `claude` CLI login. Presence is checked with `claude auth status` in `server/src/backend.ts` `claudeLoggedIn()`.
  - Session continuity: the SDK session id is stored on the lesson (`session_id` column, `setSessionId` in `server/src/db.ts`) and passed back as `resume`.
- OpenAI Codex (via ChatGPT login) - Alternative tutor backend. Each turn is a `codex exec` thread (`startThread`/`resumeThread`) with `sandboxMode: 'read-only'`, `approvalPolicy: 'never'`, `webSearchMode: 'live'`, and Derive's MCP server attached via `mcp_servers` config override.
  - SDK/Client: `@openai/codex-sdk` (bundled `@openai/codex` binary, or `DERIVE_CODEX_BIN`) - `server/src/codex.ts`, binary resolution in `server/src/backend.ts` `codexBinary()`
  - Auth: none in Derive; detected by `~/.codex/auth.json` (`CODEX_HOME`) in `codexLoggedIn()`.
  - Session logs: Codex writes JSONL rollouts under `$CODEX_HOME/sessions`; `server/src/codex-mirror.ts` (`RolloutMirror`) tails them to mirror terminal sessions into a lesson.
- Backend selection: `DERIVE_BACKEND` env, else Claude if logged in, else Codex, else Claude (`server/src/backend.ts` `backend()`); reported on `GET /api/health`.

**Coding-agent hosts (Derive as an MCP server):**

- Claude Code - Plugin in `plugin/` (`/derive:learn`, `/derive:review`, `teach` skill) plus `plugin/.mcp.json` launching `server/dist/mcp.js`. Hooks in `plugin/hooks/hooks.json` run `plugin/hooks/mirror.mjs` on Stop / UserPromptSubmit / Pre+PostToolUse to mirror the transcript into the lesson over HTTP. Also installable with `claude mcp add derive -- node .../server/dist/mcp.js`.
- Codex CLI - Skills in `codex/skills/derive-learn/agents/openai.yaml` and `codex/skills/derive-review/agents/openai.yaml` depending on the `derive` MCP server; `DERIVE_DRIVER=codex` turns on session-log mirroring.
- Transport: stdio MCP (`@modelcontextprotocol/sdk` `StdioServerTransport`) in `server/src/mcp.ts`; every tool proxies to `DERIVE_URL` (default `http://localhost:4310`) under `/api/external/*`.

**Web fetching (library and materials):**

- Generic HTTP(S) page fetch - Library entries and `add_resource` fetch the page text with a Derive user agent, follow redirects, and time out (`server/src/library.ts:218`). Only `http:`/`https:` URLs accepted (`library.ts:55`).
- YouTube / Vimeo oEmbed - Title/author/description for video links (`server/src/library.ts:236`): `https://www.youtube.com/oembed`, `https://vimeo.com/api/oembed.json`. No API key.
- arXiv - `/abs/` links are rewritten to `/pdf/` and the PDF text is extracted (`server/src/library.ts:276-302`). Academic hosts (doi.org, semanticscholar, ieee, springer, nature, pubmed, ...) are classified as `paper` (`library.ts:86`).
- GitHub REST API - Repository materials are downloaded as a tarball from `https://api.github.com/repos/{owner}/{repo}/tarball[/ref]` unauthenticated (`server/src/repo.ts:200`), then gunzipped with `fflate`. Public repos only; subject to GitHub's anonymous rate limit. Local paths are also accepted for repos.

**Browser APIs (client-side, nothing leaves the machine):**

- Web Speech API - `speechSynthesis` for reading the tutor aloud and `SpeechRecognition` for spoken answers (`web/src/lib/voice.ts`, `web/src/lib/useVoiceMode.ts`). The server is only told voice mode toggled (`POST /api/lessons/:id/voice`).
- `localStorage` - Selected learner id under key `derive.learner` (`web/src/lib/api.ts`) and UI prefs (`web/src/lib/prefs.ts`).

## Data Storage

**Databases:**

- SQLite (single file) via Node's built-in `node:sqlite` `DatabaseSync`
  - Connection: path `DB_PATH = $DERIVE_DATA_DIR/derive.db` (default `~/.derive/derive.db`), from `server/src/config.ts`
  - Client: raw SQL, no ORM. Schema created with `CREATE TABLE IF NOT EXISTS` and migrated with a list of `ALTER TABLE ADD COLUMN` statements (tolerating "duplicate column") at module load in `server/src/db.ts`. `PRAGMA journal_mode = WAL`.
  - Tables: `lessons`, `events` (append-only event log per lesson, the source of truth for the transcript and SSE replay), `nodes` (plan DAG + FSRS state), `memory`, `misconceptions`, `quiz_results`, `materials`, `learners`, `resources`.

**File Storage:**

- Local filesystem only, under `DERIVE_DATA_DIR`:
  - `~/.derive/codex/<lessonId>/instructions.md` - per-lesson system prompt file and Codex working directory (`server/src/codex.ts`)
  - `~/.derive/mirror/<session>.json` - Claude Code hook mirror state (`plugin/hooks/mirror.mjs`)
  - Attached material text is stored inline in the `materials` table, not as files.
- Obsidian vault export (optional): when `DERIVE_VAULT_DIR` is set, lessons are written as markdown notes with Obsidian callouts, live during the lesson and on demand (`server/src/export.ts` `exportToVault`, routes `GET/POST /api/lessons/:id/export`).

**Caching:**

- None. Fetched library page text is persisted in the `resources` table (`text`, `fetched_at`, `fetch_error`) and can be refreshed with `POST /api/library/:id/refetch`.

## Authentication & Identity

**Auth Provider:**

- None. The server is a local, single-user process bound to a port; there is no login, token, or session for the HTTP API. CORS is `origin: '*'` for `/api/*` (`server/src/index.ts`).
  - Learner identity: a "learner" profile chosen by the client, sent as the `x-derive-learner` header (web), `?learner=` query, or a `learner` body field (plugin/MCP). Unknown values fall back to the first learner (`learnerOf` in `server/src/index.ts`).
  - LLM identity: delegated entirely to the Claude Code / Codex CLI logins on the host machine.

## Monitoring & Observability

**Error Tracking:**

- None.

**Logs:**

- `console` output from the server process (startup line prints port and chosen backend). Lesson-level events are persisted to the `events` table and streamed to the UI; tool activity is surfaced to the learner as ephemeral `status` events (`emitEphemeral` in `server/src/events.ts`).
- `GET /api/health` returns `{ ok, version, backend, backend_source }`.

## CI/CD & Deployment

**Hosting:**

- Self-hosted local process (`pnpm start`), one port serving API + built SPA. No cloud target.

**CI Pipeline:**

- GitHub Actions `.github/workflows/ci.yml` on push to `main` and on PRs: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm build`, `pnpm test` (with `CI=true`; tests drive the built server over HTTP with no model), and `node scripts/doctor.mjs || true`.
- GitHub Actions `.github/workflows/release.yml` on `v*` tags: same checks, then packs `derive-<tag>.tar.gz` and `derive-plugin-<tag>.tar.gz` and publishes a GitHub release (`softprops/action-gh-release@v2`, `contents: write`).
- Dependabot (`.github/dependabot.yml`): monthly updates for `github-actions` and `npm` (dev deps grouped, max 5 open PRs).

## Environment Configuration

**Required env vars:**

- None are required; every variable has a default. Documented in `.env.example`, read in `server/src/config.ts`:
  - `PORT` (4310), `DERIVE_DATA_DIR` (`~/.derive`), `DERIVE_MODEL`, `DERIVE_EFFORT` (`high`), `DERIVE_VAULT_DIR`, `DERIVE_BACKEND`, `DERIVE_CODEX_BIN`, `CODEX_HOME` (`~/.codex`)
- MCP server / plugin side (`server/src/mcp.ts`, `plugin/hooks/mirror.mjs`): `DERIVE_URL`, `DERIVE_LEARNER`, `DERIVE_ANSWER_IN`, `DERIVE_DRIVER`, `DERIVE_LESSON_ID`.
- Loaded with Node's `--env-file-if-exists=.env` from the repo root; no dotenv package.

**Secrets location:**

- Derive holds no secrets of its own. A `.env` file exists at the repo root (gitignored, contents not read). LLM credentials live in the Claude Code CLI keychain and `~/.codex/auth.json`, outside the repo.

## Webhooks & Callbacks

**Incoming:**

- Not webhooks in the public-internet sense; all are local HTTP callbacks from agent hosts on the same machine to the Derive server (`server/src/index.ts`):
  - `POST /api/external/lessons` - start an external (Claude Code / Codex) lesson
  - `POST /api/external/lessons/:id/:action` - tool proxy for quiz, ask, set_plan, node_status, mirror, end, answer, etc.
  - `GET /api/external/active`, `GET /api/external/library`, `GET /api/external/lessons/:id/materials`
  - Called by `server/src/mcp.ts` (MCP tools), `plugin/hooks/mirror.mjs` (transcript mirroring), and `server/src/codex.ts` (the app's own Codex backend, via the MCP server).
- Server-to-browser push: SSE at `GET /api/lessons/:id/stream?after=<seq>` (`streamSSE`, replay from the `events` table); consumed with `EventSource` in `web/src/lib/useLesson.ts:255`.

**Outgoing:**

- None. Outbound traffic is limited to the LLM SDKs, the fetches listed above (pages, oEmbed, arXiv PDFs, GitHub tarballs), and the agents' own web search.

---

*Integration audit: 2026-09-17*
