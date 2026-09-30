# Phase 2: Settings and Secrets - Research

**Researched:** 2026-09-30
**Domain:** Provider/model settings UI, secrets-at-rest, per-turn backend resolution, provider detection and connection tests (TypeScript, Hono, React 19, node:sqlite)
**Confidence:** HIGH on the codebase seams (every file read this session), MEDIUM on provider endpoints (official docs fetched today), LOW on default model ids (they move; the catalogue carries a date for exactly this reason)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Settings surface

- **D-01:** Provider and model configuration lives on a **new `/settings` page**, its own route beside `/you`, linked from the Home nav and the learner menu. Provider config is per install; `/you` stays per learner and keeps its title. The lesson screen gains only the header pill of D-15. — **Reversibility:** reversible.

- **D-02:** The page is **one row per provider, one row marked active**. Each row carries a status pill (`logged in` / `key set` / `set from environment` / `found on port N` / `not configured`), a write-only key field where the provider takes a key, the model combobox of D-08 and a "Use this" action. Detection results and configuration are the same list; there is no separate "what is available" view. Rows whose driver is not wired yet (D-05) show a sentence that teaching on that provider arrives with the next release and cannot be made active.

- **D-03:** **Save as you go, per field.** Picking a model or pressing "Use this" persists immediately with a small saved tick, the way `/you` already saves preferences. A pasted key saves on blur or Enter and the field turns into its masked hint (D-10). There is no page-level Save button, so "Test connection" always runs on stored values.

- **D-04:** A change applies on the **next turn of every lesson**, matching the roadmap rule that settings resolve per turn and replace the boot-time memo in `server/src/backend.ts`. A model change on the same provider resumes the provider conversation; a provider change starts a fresh provider session for that lesson (the lesson's `session_id` is cleared) and the tutor re-reads the lesson from its events and nodes through the existing system prompt. The header pill updates on that next turn. Provider changes are not blocked while a turn is in flight; the running turn finishes on the provider it started with. — **Reversibility:** costly — Phase 3's resume work (`turn_messages`) builds on "one provider session per lesson, replaced on provider change"; moving to per-lesson pinning later means a lesson-level provider column and a migration.

#### Provider catalogue

- **D-05:** Settings lists **all planned providers now**: Claude Code login (the plugin route), Codex login, Anthropic, OpenAI, Google Gemini, OpenRouter, OpenAI-compatible endpoint (base URL plus key), Ollama, LM Studio, llama.cpp. Keys, model fetch and test work for every row in this phase. Each catalogue entry carries a `teaches` flag; only Claude Code login and Codex login are true now, Phase 3 and Phase 4 flip the rest. The Claude Code row never asks for a key: in-app Claude runs on an Anthropic API key, and the login row reads "use the plugin" as PROJECT.md records. Gemini's row defaults to an API key. — **Reversibility:** reversible.

- **D-06:** Curated defaults come from a **server-side providers catalogue module** (one entry per provider: id, label, auth kind, default model id, models endpoint, default port for local servers, `teaches`) with a **"defaults as of" date**. The planner picks the concrete default model ids at implementation time. The default is preselected when a row is first configured and the learner may change it. — **Reversibility:** reversible.

- **D-07:** Provider config is **per install**, stored outside the secrets file, and survives restarts. Never a per-learner key.

- **D-08:** The model field is **one combobox: the fetched list plus free typing, always**. When the fetch fails the list is empty, the provider's failure sentence shows under the field, and typing a model id still works and saves. No second control appears on failure.

- **D-09:** The optional **per-learner model override lives on `/you`** as one optional "model" field in that learner's preferences. It overrides the install-wide model for that learner on the active provider only; empty means the install default. Keys never appear on `/you`.

#### Keys and detection

- **D-10:** Secrets live in **one JSON file, `~/.derive/secrets.json`** (under `DATA_DIR`), keyed by provider id, one key per provider, **mode 0600**, written atomically, read live like `server/src/credentials.ts` reads the token, and every loaded key is passed to `registerSecret` in `server/src/secrets.ts` at load. The API answers a key field with `{ set: true, hint }` and never the value. The hint is the **last four characters**; the UI renders dots plus the hint until the learner chooses Replace. — **Reversibility:** costly — the file's shape is what the doctor script, the redaction registry and Phase 3's drivers read; changing it later needs a converter for existing installs.

- **D-11:** **Precedence is env > file > detection, per turn** (roadmap). When `DERIVE_BACKEND`, `DERIVE_MODEL` or a provider's key variable is set in the environment, the matching field is **read-only** with a `set from environment` pill and a sentence naming the variable to unset. The learner cannot store a competing file value while the environment one is active.

- **D-12:** **Remove** on a file-stored key deletes it from `secrets.json`. The value stays registered for redaction in the running process until restart; nothing unregisters a live secret (Phase 1 D-11), and that is stated in the UI sentence.

- **D-13:** **Detection runs when `/settings` opens, and on a Rescan button.** One pass: `claude auth status` (existing `claudeLoggedIn`), the Codex auth file (existing `codexLoggedIn`), the environment for backend, model and provider keys, and a short-timeout HTTP probe of Ollama on 11434, LM Studio on 1234 and llama.cpp on 8080. Rows fill in as results arrive; nothing probes in the background and nothing polls. Boot no longer decides the backend once for the process.

#### Test and indicator

- **D-14:** **"Test connection" sends the cheapest real request per provider.** Key and gateway providers: the models-list call with the stored key. Local servers: their models or health endpoint. Logins: the auth check. It proves the credential and the endpoint, not that the chosen model answers. Result shows **inline under the row on one line**: success in green with model count and latency; failure in red with the **provider's own error sentence verbatim** (status plus message from its response body) and a one-line fix hint when Derive recognises the case, following the `friendly` helper in `server/src/codex.ts`. No toasts.

- **D-15:** The lesson header shows a **small muted pill `provider · model`** beside the title, inside the existing 60 px header of `web/src/pages/Lesson.tsx`. It states what the last turn ran on and links to `/settings`. Nothing else on the lesson screen changes.

- **D-16:** **Terminal-driven lessons** (`mode: 'external'`) show the driver and that the terminal owns the model: `claude code · terminal model` or `codex cli · terminal model`. The `start_lesson` message in `server/src/mcp.ts` names the driver that is running and adds that the app's own tutor is set to `provider · model`, so the learner knows both. Nothing pretends Derive chose the terminal's model.

### Claude's Discretion

The user did not open these; the planner decides them in the direction recorded here.

- **Where non-secret settings persist:** a per-install `settings` key-value table added through the Phase 1 migration runner, or a small JSON file beside `secrets.json`. Either is fine; keys never enter `derive.db`, and the value read by a turn must be live (no process-lifetime memo).
- **Replacing the backend memo:** `backend()` in `server/src/backend.ts` becomes a per-turn resolver (env, then stored settings, then detection) that returns provider and model; `/api/health` and the startup line report the resolved value and its source (`environment` / `settings` / `detected`).
- **API shape:** a `GET /api/settings` that returns rows with `{ set, hint }` for keys, a per-provider write for key and model, `POST /api/settings/detect`, `POST /api/settings/:provider/models`, `POST /api/settings/:provider/test`, all behind the existing token check. The env-locked fields are reported as locked, not merely ignored.
- **Probe timeouts and the `claude auth status` spawn:** short (hundreds of milliseconds for ports, the existing 15 s cap for the CLI), run in parallel, never blocking the page's first paint.
- **OpenAI-compatible row:** takes a base URL and a key; URL validation follows the SSRF rules from Phase 1 D-10 only for outbound fetches that are not the learner's own configured endpoint (a local base URL is the whole point of this row).
- **Codex model default:** when no model is stored, the row shows that the Codex login's own default applies, as today.
- **`scripts/doctor.mjs`:** may report the secrets file's presence and mode and which provider is active; never a key or hint.
- **Catalogue model ids:** chosen at implementation time with the "as of" date set to that day; the researcher should confirm each provider's models-list endpoint and auth header.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope. Items already placed elsewhere by the roadmap and noted here so nobody re-opens them in Phase 2:

- Running lessons on API keys, gateways and local models — Phase 3 and Phase 4.
- Per-lesson cost in the header and the usage page — Phase 3 and Phase 4.
- Per-lesson model switching and tiered roles — out of scope for this milestone (PROJECT.md).
- Exposing `DERIVE_EFFORT` in Settings — not raised; stays an environment setting unless a later phase gives a learning reason.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SET-01 | Learner can choose provider and model on a settings page in the app; the choice persists across restarts | §Architecture Patterns 1 (settings table via migration 5), Pattern 2 (per-turn resolver replacing `backend()`), Pattern 7 (`/settings` page copies `You.tsx`); Code Examples "Resolver", "Settings routes" |
| SET-02 | One masked key per provider in a 0600 secrets file outside the database, never echoed by the API | Pattern 3 (`keys.ts` copies `credentials.ts`: atomic 0600 write, live read, `registerSecret` on load); Code Examples "secrets.json"; Security Domain V6/V8 |
| SET-03 | Detect logged-in CLIs, keys in the environment, local servers on default ports; environment values labelled "set from environment" | Pattern 4 (parallel detection with `AbortSignal.timeout`, shape-checked probes); Pitfall 1 (port 8080 is FreqUI on this very machine); Environment Availability |
| SET-04 | Fetch a provider's model list, manual model id fallback, curated default | §Provider Endpoint Matrix (verified endpoints, auth headers, response shapes, list normalisation); Pattern 5 (one adapter per provider); Code Examples "Model list adapters" |
| SET-05 | Test a connection and see the actual failure sentence | Pattern 6 (test = cheapest real request; verbatim `status + body.error.message`; `friendly`-style hint); Provider error shapes in the matrix |
| SET-06 | Active provider and model visible in the lesson header and the plugin start message | Pattern 8 (`turn_start` payload carries `provider`/`model`; `lessonView` returns `lastTurn`); `mcp.ts` `start_lesson` extension; Code Examples "Header pill" |
</phase_requirements>

## Summary

Phase 2 is almost entirely an extension of seams Phase 1 already built, and the research confirms every one of them still exists as CONTEXT.md describes: `server/src/credentials.ts` is the 0600, atomic, read-live, fail-loud file pattern to copy for `secrets.json`; `server/src/secrets.ts` `registerSecret` is where every loaded key goes (its 16-character floor and `sk-`/`AIza` backstop patterns already match Anthropic, OpenAI, OpenRouter and Gemini keys); `server/src/migrations.ts` is on `LATEST_VERSION = 4`, so a `settings` table is migration 5; `server/src/agent.ts` `runTurn` is the single place `backend()` and `MODEL` enter a turn (lines 274–289), and `startTurn(lessonId, driver.name, MODEL)` already writes the model to the `turns` row the header pill needs. The work is one catalogue module, one keys module, one settings/resolver module, one detection/test module, five or six routes, one page, one pill, one `start_lesson` sentence, and tests over HTTP with no model.

The provider side is well documented and stable. Every key provider exposes a cheap authenticated models-list `GET` that doubles as the connection test: Anthropic `GET /v1/models` with `x-api-key` + `anthropic-version: 2023-06-01`, OpenAI `GET /v1/models` with `Authorization: Bearer`, Gemini `GET /v1beta/models` with `x-goog-api-key`, OpenRouter `GET /api/v1/models` (Bearer) plus `GET /api/v1/key` as the key check. Local servers answer on their documented default ports with OpenAI-shaped `GET /v1/models` (llama.cpp, LM Studio, Ollama) plus native endpoints (`/api/tags`, `/api/v0/models`, `/health`). Error bodies are `{ error: { message } }` everywhere except Anthropic's `{ type: 'error', error: { type, message } }` and OpenRouter's `{ error: { code, message } }`, so one unwrapping function covers the lot. The two policy questions the roadmap asked to re-read are now unambiguous and stricter than at roadmap time: Anthropic's legal page says third-party developers "may not collect, store, or intermediate Claude.ai credentials or session tokens" and must use API keys for Agent SDK products; Google's Gemini CLI service update names "using Gemini CLI oAuth with third-party software" as a policy violation with account suspensions. Both confirm D-05 exactly: Claude Code login row says "use the plugin", Gemini row takes an API key.

Two local findings the planner must design around. First, port 8080 on the author's machine is not llama.cpp but FreqUI served by uvicorn, returning HTTP 200 HTML at `/`: a probe that treats "port answers" as "found on port N" will lie on real machines, so every probe must check the response shape (`/health` → `{"status":"ok"}`, `/v1/models` → `{"object":"list"}`, `/api/tags` → `{"models":[...]}`). Second, `claude auth status` returns the learner's email, org id and subscription type alongside `loggedIn`; detection must forward only `loggedIn` (and at most `authMethod`), never the whole object, or the settings response leaks identity into the browser and the plugin.

**Primary recommendation:** Build four small server modules (`providers.ts` catalogue, `keys.ts` secrets file, `settings.ts` table + per-turn resolver, `probe.ts` detection/models/test) on the existing `credentials.ts`/`secrets.ts`/`migrations.ts` patterns, drive them from `runTurn` and six `/api/settings*` routes, and prove every behaviour in `server/test/settings.test.ts` against a spawned server plus a local fake provider HTTP server (the OpenAI-compatible row with a loopback base URL is the test double the design already allows).

## Project Constraints (from CLAUDE.md)

Directives extracted from `./.claude/CLAUDE.md` that bind this phase's plans:

- **Simplicity rule (binding):** one screen, one next step; everything else behind Settings; no feature without a one-sentence learning reason. The `/settings` page is the sanctioned "behind Settings" surface; the lesson screen gains only the D-15 pill.
- **Tech stack fixed:** TypeScript, Node ≥ 22.5, pnpm workspace, Hono, React 19, `node:sqlite`. New providers are added inside the codebase, not beside it. No new runtime dependencies are needed for this phase (see Standard Stack).
- **Local-first:** all learner data in `~/.derive`; keys are stored locally and never leave the machine except to the provider they belong to. A key must only ever be sent to its own catalogue entry's host (and, for the OpenAI-compatible row, the learner's own base URL).
- **Method fidelity / compatibility:** the Claude Code plugin and Codex skills keep working; existing SQLite databases migrate forward (migration 5 via `server/src/migrations.ts`).
- **No hosted infrastructure.**
- **Config read once in `server/src/config.ts`** and exported as constants; other modules import them, never `process.env` (exception: `server/src/mcp.ts`, its own process). The resolver reads `BACKEND_SETTING`, `MODEL` and the new provider-key constants from `config.ts`.
- **Conventions:** single quotes, semicolons, 2-space indent, `.js` import extensions on the server, no extension on the web; named exports only; one component per file; `type` aliases not interfaces; lowercase human-sentence `Error` messages; routes return `{ error }`; `e instanceof Error ? e.message : String(e)`; fire-and-forget as `void p.catch(...)`; `[tag]` log prefixes, failures and startup facts only; every server module opens with a `/** ... */` prose block; one-line `/** */` on exports; `.describe()` on zod fields.
- **Tests:** `node:test` via `node --import tsx --test test/*.test.ts`; server tests spawn `server/dist/index.js` through `server/test/spawn.ts` (needs `pnpm build` first); modules that open SQLite are imported dynamically after `DERIVE_DATA_DIR` is set.
- **GSD workflow enforcement:** file changes go through `/gsd-execute-phase` (or `/gsd-quick`), never direct edits.
- **Web tsconfig:** `noUnusedLocals`, `noUnusedParameters` fail the build; keep the `// eslint-disable-next-line react-hooks/exhaustive-deps` comment when copying the keydown-effect pattern.
- **Event types must match in two places:** whatever the server emits and `web/src/lib/useLesson.ts` `EVENT_TYPES`. This phase adds **no** event type; it adds fields to `turn_start`'s payload (Pattern 8).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Provider catalogue (ids, labels, auth kind, default model, endpoints, ports, `teaches`, "as of" date) | API / Backend (`server/src/providers.ts`) | Browser renders it | One source of truth the resolver, the routes, the doctor and the UI all read; the browser must not hard-code provider facts |
| Secrets at rest (`secrets.json`, 0600, atomic, live read, `registerSecret`) | API / Backend (`server/src/keys.ts`) | — | Keys never reach the browser; the file is beside `token`, copying `credentials.ts` |
| Non-secret settings (active provider, per-provider model, base URL) | Database (`settings` table, migration 5) | API reads/writes | Per-install, transactional, read live per turn; `derive.db` is 0644 so nothing secret goes there |
| Per-turn resolution `env > file > detection` | API / Backend (`server/src/settings.ts` resolver) | `agent.ts` `runTurn` consumes | Replaces the `backend()` memo; the turn is the unit the roadmap fixed |
| Detection (CLI logins, env keys, port probes) | API / Backend (`server/src/probe.ts`) | Browser triggers on open + Rescan | Only the server can shell out and probe loopback ports; results are a response, not a log |
| Model list fetch and connection test | API / Backend (`probe.ts` adapters) | Browser renders one-line result | The key must never be in the browser; the server holds it and speaks to the provider |
| Masked key field, per-field save, combobox, status pills | Browser (`web/src/pages/Settings.tsx`) | API answers `{ set, hint }` | UI state only; copies `You.tsx` save-as-you-go |
| Header pill `provider · model` | Browser (`web/src/pages/Lesson.tsx`) | API: `lastTurn` in `lessonView`, `turn_start` payload | Reads what the last turn recorded; never computes the choice itself |
| Plugin start message naming both models | API / Backend (`server/src/mcp.ts` `start_lesson` reads a new `GET /api/settings/active`) | — | The MCP server is its own process and must ask the server; it holds no settings |
| Per-learner model override | Database (`learners.prefs.model`) via existing `updateLearnerPrefs` | `/you` field | Learner-scoped, resolves inside the resolver after the install-wide value; must not enter `preferencesSection` prompt text |

## Standard Stack

### Core

No new packages. Every capability maps to a Node built-in or a dependency already in `server/package.json` / `web/package.json`.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:fs` (`writeFileSync` with `mode: 0o600`, `renameSync`, `readFileSync`, `statSync`) | Node 22.22.2 on this machine | `secrets.json` atomic 0600 write and live read | Verified this session: `writeFileSync(tmp, …, { mode: 0o600 }); renameSync(tmp, path)` leaves mode `600`. Same primitives `credentials.ts` uses. [VERIFIED: local node run] |
| `node:child_process` `execFileSync` | built-in | `claude auth status` (already in `backend.ts` `claudeLoggedIn`) | Existing pattern, 15 s cap; measured 0.30 s on this machine. [VERIFIED: `time claude auth status`] |
| global `fetch` + `AbortSignal.timeout(ms)` | Node 22 built-in | Port probes, model lists, connection tests | `typeof AbortSignal.timeout === 'function'` verified; the test suite already uses `AbortSignal.timeout` (`01-CONTEXT.md` names the precedent). [VERIFIED: local node run] |
| `node:sqlite` `DatabaseSync` | built-in | `settings` table via migration 5 | Existing store; `withTx` and prepared statements in `db.ts`. [VERIFIED: server/src/db.ts:12-14] |
| `hono` | 4.13.8 | `/api/settings*` routes behind the existing `/api/*` guard | Existing HTTP framework. [VERIFIED: server/node_modules/hono/package.json] |
| `zod` | `^4.6.5` (server manifest) | Validate settings bodies (model id charset, base URL scheme, key length caps) | Already used for tool schemas; use it for request bodies here rather than hand-rolled `typeof` chains |
| React 19 + `react-router-dom` 7 + `lucide-react` | web manifest | `/settings` route, page, icons | Existing UI stack; `main.tsx` route table is where `/settings` is added |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:crypto` `timingSafeEqual` | built-in | Not needed for keys (never compared); already used by `credentials.ts` | Only if a future route compares a supplied key to a stored one, which this phase never does |
| Native `<input list="…">` + `<datalist>` | browser | The D-08 combobox: fetched list plus free typing in one control | Zero-dependency; falls back to a plain text input when the list is empty, which is exactly D-08's failure behaviour |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `settings` SQLite table | `~/.derive/settings.json` beside `secrets.json` | JSON needs its own atomic-write/parse-failure code and a second file the doctor must check; the table gets transactions, `withTx`, and the migration runner for free. **Recommend the table.** |
| Native `<datalist>` combobox | A React combobox library (downshift, cmdk, Radix) | New dependency, new legitimacy audit, more UI than D-08 asks for. Native `datalist` renders acceptably in Chrome/Firefox/Safari and is one element. **Recommend native; upgrade only if the UI-SPEC demands keyboard filtering the native control lacks.** |
| Plaintext 0600 `secrets.json` | Encrypt with a key stored… where? | On a single-user machine there is no second secret to encrypt with that is not itself a 0600 file; the token already sets the precedent (`credentials.ts` header comment accepts this deliberately). OS keychains (`keytar`/`@napi-rs/keyring`) add native modules and break `pnpm.onlyBuiltDependencies`. **Plaintext 0600, as D-10 decided.** |
| Bearer for Gemini | `?key=` query param (docs show both) | The query form lands the key in provider logs, proxies and any error message that echoes the URL. **Header `x-goog-api-key` only.** |

**Installation:** none.

**Version verification:** no new packages, so no registry check is needed. Existing versions were read from the manifests and `node_modules` this session.

## Package Legitimacy Audit

This phase installs no external packages. Every recommendation above is a Node built-in or a dependency already present in `pnpm-lock.yaml`.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Provider Endpoint Matrix

The facts the catalogue module (`providers.ts`) and the adapters (`probe.ts`) encode. Confidence tiers come from `gsd_run query classify-confidence`: `webfetch`/`websearch` classify as LOW as providers; where the fetched page is the vendor's own documentation the claim is tagged `[CITED: url]` (MEDIUM). Model ids are the most perishable row and are the reason D-06 carries a "defaults as of" date.

| Provider id | Auth kind | Env variable(s) | Models list | Auth header | Success shape → model id | Error shape | Cheapest test | Default model (as of 2026-09-30) |
|---|---|---|---|---|---|---|---|---|
| `claude-code` (login) | `login` | `DERIVE_BACKEND=claude` | — | — | — | — | `claude auth status` → `loggedIn` [VERIFIED: server/src/backend.ts:19-27] | none; the login's default. Row text: "use the plugin"; **teaches: true** now (existing `claudeDriver`) |
| `codex` (login) | `login` | `DERIVE_BACKEND=codex`, `CODEX_HOME` | — | — | — | — | `existsSync(join(CODEX_HOME, 'auth.json'))` [VERIFIED: server/src/backend.ts:30-32] | none; show "Codex's own default applies" (this machine: `model = "gpt-5.4"` in `~/.codex/config.toml`, readable if wanted) |
| `anthropic` | `key` | `ANTHROPIC_API_KEY` [CITED: platform.claude.com/docs/en/api/models-list curl example] | `GET https://api.anthropic.com/v1/models?limit=1000` [CITED: same] | `x-api-key: <key>`, `anthropic-version: 2023-06-01` [CITED: same] | `{ data: [{ type:'model', id, display_name, created_at }], has_more, first_id, last_id }` → `data[].id` [CITED: same] | `{ type:'error', error:{ type, message }, request_id }`; 401 `authentication_error` [CITED: platform.claude.com/docs/en/api/errors] | models list | `claude-opus-5-5` ("start with Claude Opus 5.5 for most workloads") [CITED: platform.claude.com/docs/en/models/overview]; alternatives `claude-sonnet-5-5`, `claude-fable-5-1`, `claude-haiku-4-5` |
| `openai` | `key` | `OPENAI_API_KEY` [CITED: developers.openai.com/api/reference/resources/models/methods/list] | `GET https://api.openai.com/v1/models` | `Authorization: Bearer <key>` | `{ object:'list', data:[{ id, object:'model', created, owned_by, shutdown_date }] }` → `data[].id` [CITED: same] | `{ error:{ message, type, param, code } }` [ASSUMED — standard OpenAI shape; page did not show it] | models list | `gpt-6-astra` (docs' primary recommendation), alternatives `gpt-6.1-sol` (cost/capability balance), `gpt-6-luna` [CITED: developers.openai.com/api/docs/models] |
| `gemini` | `key` | `GEMINI_API_KEY`, `GOOGLE_API_KEY` (GOOGLE wins when both set) [CITED: ai.google.dev/gemini-api/docs/api-key] | `GET https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000` [CITED: ai.google.dev/api/models] | `x-goog-api-key: <key>` [CITED: api-key page] — never `?key=` | `{ models:[{ name:'models/<id>', displayName, supportedGenerationMethods[] }], nextPageToken }` → strip `models/` prefix; keep only entries whose `supportedGenerationMethods` includes `generateContent` [CITED: ai.google.dev/api/models; the filter is [ASSUMED] but the field is documented] | `{ error:{ code, message, status } }` [ASSUMED — Google API standard] | models list | `gemini-3.8-flash` (stable); `gemini-3.1-pro-preview` is preview-only; 2.5 restricted to prior users [CITED: ai.google.dev/gemini-api/docs/models] |
| `openrouter` | `key` | `OPENROUTER_API_KEY` [ASSUMED — every client library defaults to it; not read from an openrouter.ai page this session] | `GET https://openrouter.ai/api/v1/models` (docs mark it `apiKey` security) [CITED: openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties] | `Authorization: Bearer <key>` | `{ data:[{ id, name, context_length, pricing:{ prompt, completion } }], total_count }` → `data[].id` [CITED: same] | 401 `{ error:{ code:401, message } }` [CITED: openrouter.ai/docs/api/api-reference/api-keys/get-current-api-key] | `GET https://openrouter.ai/api/v1/key` → `{ data:{ label, usage, limit, limit_remaining, is_free_tier } }` proves the key; models list gives the count [CITED: same] | `anthropic/claude-opus-5-5` [ASSUMED slug — OpenRouter ids are `vendor/model`; confirm against the live list at implementation] |
| `openai-compatible` | `key+url` | none (learner's own) | `GET <base_url>/v1/models` (base URL stored without trailing slash; accept a base that already ends in `/v1`) | `Authorization: Bearer <key>` when a key is set | OpenAI shape → `data[].id` | `{ error:{ message } }` or plain text | models list | none |
| `ollama` | `none` | `OLLAMA_HOST` (default `127.0.0.1:11434`) [CITED: docs.ollama.com/faq] | `GET http://127.0.0.1:11434/api/tags` → `{ models:[{ name, model, size, digest, details }] }` → `models[].name` [CITED: github.com/ollama/ollama docs/api.md]; `GET /v1/models` also exists, key ignored [CITED: docs.ollama.com/api/openai-compatibility] | none | as left | `{ error: "<text>" }` [ASSUMED] | `GET /api/tags` (proves server and lists models in one call) | none; preselect first listed model |
| `lmstudio` | `none` (optional key) | none documented; docs' examples show `Authorization: Bearer $LM_API_TOKEN` in 0.4 [CITED: lmstudio.ai/docs/developer/rest/endpoints] | `GET http://127.0.0.1:1234/api/v0/models` → `{ object:'list', data:[{ id, type, publisher, arch, quantization, state:'loaded'\|'not-loaded', max_context_length }] }`; `GET /v1/models` OpenAI-shaped [CITED: same] | optional Bearer | `data[].id`; prefer `state === 'loaded'` first | OpenAI-style | `GET /api/v0/models` | none; preselect the first `loaded` model |
| `llamacpp` | `none` (optional key) | `LLAMA_ARG_HOST`, `LLAMA_ARG_PORT` (default `127.0.0.1:8080`) [CITED: github.com/ggml-org/llama.cpp tools/server/README.md] | `GET http://127.0.0.1:8080/v1/models` → `{ object:'list', data:[{ id, owned_by:'llamacpp', meta }] }` [CITED: same] | `Authorization: Bearer` when `--api-key` is set [CITED: same] | `data[].id` | `/health` 503 `{ error:{ code:503, message:'Loading model', type:'unavailable_error' } }` [CITED: same] | `GET /health` → 200 `{"status":"ok"}` [CITED: same] | none; the single loaded model |

**Detection = probe, not port.** Verified on this machine: `curl http://127.0.0.1:8080/` returns `200 text/html` from `server: uvicorn` titled `FreqUI` — a trading dashboard, not llama.cpp. A probe reports `found on port N` only when the shape-check passes: llama.cpp `/health` → JSON with `status === 'ok'` (or a 503 `unavailable_error`, which is still llama.cpp, "loading"); LM Studio `/api/v0/models` → JSON with `object === 'list'`; Ollama `/api/tags` → JSON with an array `models`. Anything else is `not configured` with no sentence at all.

**Ollama root banner:** "Ollama is running" at `GET /` is folklore this session could not confirm from documentation [ASSUMED]; do not depend on it, `/api/tags` is documented.

## Architecture Patterns

### System Architecture Diagram

```
                       ┌─────────────────────────────────────────────────────────────────┐
                       │                         Browser (web/src)                        │
                       │  /settings ──GET /api/settings──▶ rows  ──POST /detect──▶ rows'  │
                       │      │  PUT /:provider {key|model|base_url}  POST /:provider/models│
                       │      │  POST /:provider/test  POST /active   DELETE /:provider/key │
                       │  /you ── PATCH /api/learners/:id {prefs:{model}}                  │
                       │  /lesson/:id ── header pill ◀── lessonView.turn + turn_start.payload│
                       └───────────────┬─────────────────────────────────────────────────┘
                                       │ x-derive-token / derive_session (existing /api/* guard)
┌──────────────────────────────────────▼──────────────────────────────────────────────────────┐
│ server/src/index.ts  // ---------- settings ----------                                       │
│   validates body (zod) ─▶ settings.ts / keys.ts / probe.ts ─▶ c.json(view)                    │
│   view never contains a key: keys.ts exposes only { set, hint }                                │
└───────┬──────────────────────┬────────────────────────┬───────────────────────────────────────┘
        │                      │                        │
┌───────▼────────┐   ┌─────────▼──────────┐   ┌─────────▼────────────────────────────────────────┐
│ providers.ts   │   │ keys.ts            │   │ probe.ts                                          │
│ CATALOGUE[]    │   │ ~/.derive/         │   │ detect(): Promise.all([claudeLoggedIn, codex,     │
│ id,label,auth, │   │  secrets.json 0600 │   │   envKeys, probe(11434), probe(1234), probe(8080)])│
│ envVars,       │   │ read live (1 s     │   │   each with AbortSignal.timeout(400)              │
│ defaultModel,  │   │  cache), atomic    │   │ listModels(p): adapter per provider ─▶ string[]   │
│ modelsUrl,     │   │  tmp+rename, every │   │ test(p): cheapest GET ─▶ { ok, count, ms } |      │
│ port, teaches, │   │  value registered  │   │   { ok:false, error: `${status} ${msg}`, hint }   │
│ DEFAULTS_AS_OF │   │  with registerSecret│  │ key travels ONLY to its catalogue host / base_url │
└───────┬────────┘   └─────────┬──────────┘   └───────────────────────────────────────────────────┘
        │                      │
┌───────▼──────────────────────▼──────────────────────────────────────────────────────────────┐
│ settings.ts                                                                                   │
│  table `settings` (migration 5): active_provider, model:<provider>, base_url:<provider>         │
│  resolveTutor(learnerId?) : { provider, model, source:'environment'|'settings'|'detected' }     │
│     1. env: BACKEND_SETTING / MODEL (config.ts)                                                 │
│     2. settings rows (+ learners.prefs.model override for the model only)                        │
│     3. detection: claudeLoggedIn() ? 'claude-code' : codexLoggedIn() ? 'codex' : 'claude-code'   │
│  locked(field) : the env var name when 1. applies                                               │
└───────┬──────────────────────────────────────────────────────────────────────────────────────┘
        │ per turn
┌───────▼──────────────────────────────────────────────────────────────────────────────────────┐
│ agent.ts runTurn                                                                              │
│  const t = resolveTutor(lesson.learner_id)                                                     │
│  if (lesson.driver_provider && lesson.driver_provider !== t.provider) clear session_id (D-04)   │
│  driver = driverOverride() ?? driverFor(t.provider)   // 'codex' → codexDriver, else claudeDriver│
│  turnId = startTurn(id, driver.name, t.model)                                                   │
│  emit('turn_start', { provider: t.provider, model: t.model ?? null })   // same event type      │
│  ctx.model = t.model                                                                            │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
        │                                             │
   /api/health, startup line                     mcp.ts start_lesson ──GET /api/settings/active──▶
   { backend, backend_source } ← resolveTutor()  "app tutor is set to <provider · model>"
```

### Recommended Project Structure

```
server/src/
├── providers.ts     # NEW: the catalogue (D-06). Pure data + tiny accessors; no I/O.
├── keys.ts          # NEW: secrets.json (D-10, D-12). Copies credentials.ts: ensure/read live/atomic write/remove; hintOf().
├── settings.ts      # NEW: settings table accessors + resolveTutor() + locked(). Imports config.ts, db.ts, keys.ts, backend.ts, providers.ts.
├── probe.ts         # NEW: detect(), listModels(), testConnection(); per-provider adapters; unwrapError() + hintFor() (the `friendly` idea).
├── migrations.ts    # +migration 5 'settings'
├── backend.ts       # keep claudeLoggedIn/codexLoggedIn/codexBinary/mcpCommand; delete backend()/backendSource() memo (or make them thin wrappers over resolveTutor for one release)
├── agent.ts         # runTurn reads resolveTutor(); turn_start payload gains provider/model
├── index.ts         # // ---------- settings ---------- routes; /api/health uses resolveTutor; lessonView adds turn: lastTurn(id)
├── mcp.ts           # start_lesson adds `tutor` sentence from GET /api/settings/active
└── config.ts        # +ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY/GOOGLE_API_KEY, OPENROUTER_API_KEY, OLLAMA_HOST constants (read once)

server/test/
└── settings.test.ts # NEW: spawned server + local fake provider (node:http) — see Validation notes

web/src/
├── main.tsx                     # +<Route path="/settings" element={<SettingsPage />} />
├── pages/Settings.tsx           # NEW: one row per provider, copies You.tsx field/Section styling
├── components/ProviderRow.tsx   # NEW: status pill, key field (masked/replace/remove), model combobox, Use this, Test line
├── pages/You.tsx                # +Section "Model" (optional override; D-09)
├── pages/Lesson.tsx             # +pill beside <h1> (D-15/D-16)
├── pages/Home.tsx               # +<Link to="/settings">settings</Link> in the nav
├── components/LearnerMenu.tsx   # +Link to /settings
└── lib/api.ts, lib/types.ts     # +settings endpoints and Settings/ProviderView/TutorChoice types
```

Naming follows CLAUDE.md: one-word server modules named for a topic (`keys`, `settings`, `probe`, `providers`).

### Pattern 1: Non-secret settings in a `settings` table (migration 5)

**What:** A per-install key–value table read live by the resolver.
**When to use:** Any per-install, non-secret value (active provider, model per provider, base URL). Never a key.

```typescript
// Source: server/src/migrations.ts:181-199 (the `turns` entry is the shape to copy) [VERIFIED]
{
  version: 5,
  name: 'settings',
  up(db) {
    db.exec(`
      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
  },
},
```

Keys: `active_provider`, `model:<providerId>`, `base_url:<providerId>`. Accessors in `settings.ts` follow the `db.ts` verb vocabulary (`getSetting`, `setSetting`, `deleteSetting`) on prepared statements. `LATEST_VERSION` is computed from the array (`migrations.ts:339`), so nothing else changes. `migrations.test.ts` already asserts a fresh and an upgraded database converge; the new migration rides along.

### Pattern 2: `resolveTutor()` replaces the `backend()` memo

**What:** One function returning `{ provider, model, source }` computed on each call from env, then table, then detection.
**When to use:** Every turn (`runTurn`), `/api/health`, the startup line, `GET /api/settings/active`.

Existing call sites to replace — all of them [VERIFIED: grep this session]:

```
server/src/agent.ts:274  const driver = driverOverride() ?? (backend() === 'codex' ? codexDriver : claudeDriver);
server/src/agent.ts:275  const turnId = startTurn(lessonId, driver.name, MODEL);
server/src/agent.ts:281  const instructions = systemPrompt(backend()) + ...
server/src/agent.ts:289      model: MODEL,
server/src/index.ts:278  app.get('/api/health', (c) => c.json({ ok: true, version: VERSION, backend: backend(), backend_source: backendSource() }));
server/src/index.ts:281  ... backend: backend() });   // /api/stats
server/src/index.ts:1156 console.log(`tutor runs on ${backend() === 'codex' ? ...}${backendSource() === 'auto' ? ...}`);
```

`systemPrompt(backend)` takes `'claude' | 'codex'` (`Backend` type in `config.ts:43`). Map catalogue ids to it: `claude-code → 'claude'`, `codex → 'codex'`; any other provider is unreachable in this phase because `teaches: false` rows cannot be made active (D-02). Keep the `Backend` type; add a `providerToBackend()` helper in `settings.ts`.

**Detection tier cost:** `claudeLoggedIn()` shells out (0.3 s measured, 15 s cap). Per turn that is acceptable only when neither env nor table decides; bound it with a short memo (the `credentials.ts` `TOKEN_CACHE_MS` idea, e.g. 30 s) that `POST /api/settings/detect` resets. This is a bounded cache, not the process-lifetime memo the discretion note forbids.

**Source labels:** `'environment'` when `BACKEND_SETTING` is set; `'settings'` when `active_provider` row exists; `'detected'` otherwise. The model has its own source (`MODEL` env → `'environment'`; `learners.prefs.model` → `'learner'`; `model:<p>` row → `'settings'`; none → `null`, meaning the provider's default). Report both in `GET /api/settings/active`.

### Pattern 3: `keys.ts` copies `credentials.ts`

**What:** `~/.derive/secrets.json` as `{ [providerId]: string }`, mode 0600, written to a sibling temp file then `renameSync`, read live behind a one-second cache, every loaded value passed to `registerSecret`.
**When to use:** All key reads and writes. The API surface of the module is `keyOf(provider): string | undefined`, `keyView(provider): { set: boolean; hint: string | null }`, `setKey(provider, value)`, `removeKey(provider)`.

The pattern to copy, verbatim from the existing module [VERIFIED: server/src/credentials.ts:98-124]:

```typescript
export function credentials(now = Date.now()): Credentials {
  if (cache && now >= cache.at && now - cache.at < TOKEN_CACHE_MS) return { token: cache.token, session: cache.session };

  let token = '';
  try {
    token = readFileSync(TOKEN_PATH, 'utf8').trim();
  } catch {
    /* deleted, or unreadable: every credential is refused until it is back */
  }
  ...
  if (token && (!cache || cache.token !== token)) {
    registerSecret(token);
    registerSecret(session);
  }
  cache = { token, session, at: now };
```

Differences for keys: (a) an absent file is **not** an error, it means no keys (the token file is fail-loud because nothing can authenticate without it; a missing secrets file is the fresh-install state); (b) an unparseable file **is** loud — return no keys and surface `secrets.json could not be read: <reason>` on `GET /api/settings` so a learner sees why their key vanished, never silently overwrite it; (c) writes go through `writeFileSync(tmp, JSON.stringify(obj, null, 2), { mode: 0o600 })` then `renameSync(tmp, path)` in the same directory (verified to keep 0600); (d) after any write, drop the cache so the next read re-registers new values.

`hintOf(value) = value.slice(-4)`; for values shorter than 8 characters return `''` (a 4-char hint of a 5-char value reveals most of it). `registerSecret` ignores values under 16 characters (`secrets.ts:31` `MIN_SECRET_CHARS = 16`) [VERIFIED], so a very short local-server token is stored but not redacted; state it in the UI sentence only if the planner wants, otherwise accept (local tokens are not credentials that leave the machine).

### Pattern 4: Detection runs in parallel, shape-checked, short-timed

**What:** `detect()` returns per-provider status in one pass; each probe is `fetch(url, { signal: AbortSignal.timeout(400) })` followed by a JSON shape check.
**When to use:** `POST /api/settings/detect` (on page open and Rescan) and, memoised, in the resolver's third tier.

```typescript
// Source: pattern from server/test suite's AbortSignal.timeout precedent; shapes from the Provider Endpoint Matrix
async function probeJson(url: string, ms = 400): Promise<{ status: number; body: unknown } | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(ms), headers: { accept: 'application/json' } });
    const text = await r.text();
    try { return { status: r.status, body: JSON.parse(text) }; } catch { return { status: r.status, body: null }; }
  } catch {
    return null; // closed port, refused, timed out: not found
  }
}
const isLlamaCpp = (p: Awaited<ReturnType<typeof probeJson>>) => !!p && ((p.status === 200 && (p.body as { status?: string })?.status === 'ok') || (p.status === 503 && (p.body as { error?: { type?: string } })?.error?.type === 'unavailable_error'));
const isOllama = (p: Awaited<ReturnType<typeof probeJson>>) => !!p && p.status === 200 && Array.isArray((p.body as { models?: unknown })?.models);
const isLmStudio = (p: Awaited<ReturnType<typeof probeJson>>) => !!p && p.status === 200 && (p.body as { object?: string })?.object === 'list';
```

The `claude auth status` result must be reduced to `{ loggedIn: boolean }` before it leaves `backend.ts`; the raw JSON on this machine carries `email`, `orgId`, `orgName`, `subscriptionType` [VERIFIED: `claude auth status` run this session]. `claudeLoggedIn()` already returns only the boolean — keep it that way and do not add a "details" variant.

Environment detection reads the constants added to `config.ts` (never `process.env` in `probe.ts`). The `set from environment` pill applies to: `DERIVE_BACKEND` (locks the active provider), `DERIVE_MODEL` (locks the model of the active provider), and each provider's key variable (locks that row's key field). `OLLAMA_HOST` is informational: when set, probe that host instead of the default and say so.

### Pattern 5: One adapter per provider for `listModels`

**What:** A `Record<providerId, (p, key, baseUrl) => Promise<string[]>>` that builds the request from the catalogue entry and normalises the response to model ids. Sorted, de-duplicated; local servers put `loaded` models first.
**When to use:** `POST /api/settings/:provider/models`, and inside `testConnection` for the count.

```typescript
// Source: Provider Endpoint Matrix (official docs fetched 2026-09-30)
const adapters: Record<string, (key: string | undefined, base: string | undefined) => Promise<string[]>> = {
  anthropic: async (key) => idsOf(await getJson('https://api.anthropic.com/v1/models?limit=1000', { 'x-api-key': key!, 'anthropic-version': '2023-06-01' }), (b) => (b.data as { id: string }[]).map((m) => m.id)),
  openai:    async (key) => idsOf(await getJson('https://api.openai.com/v1/models', bearer(key)), (b) => (b.data as { id: string }[]).map((m) => m.id)),
  gemini:    async (key) => idsOf(await getJson('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', { 'x-goog-api-key': key! }), (b) => (b.models as { name: string; supportedGenerationMethods?: string[] }[]).filter((m) => m.supportedGenerationMethods?.includes('generateContent') ?? true).map((m) => m.name.replace(/^models\//, ''))),
  openrouter: async (key) => idsOf(await getJson('https://openrouter.ai/api/v1/models', bearer(key)), (b) => (b.data as { id: string }[]).map((m) => m.id)),
  'openai-compatible': async (key, base) => idsOf(await getJson(`${v1(base!)}/models`, key ? bearer(key) : {}), (b) => (b.data as { id: string }[]).map((m) => m.id)),
  ollama:    async (_k, base) => idsOf(await getJson(`${base ?? 'http://127.0.0.1:11434'}/api/tags`, {}), (b) => (b.models as { name: string }[]).map((m) => m.name)),
  lmstudio:  async (key, base) => idsOf(await getJson(`${base ?? 'http://127.0.0.1:1234'}/api/v0/models`, key ? bearer(key) : {}), (b) => (b.data as { id: string; state?: string }[]).sort((a, z) => Number(z.state === 'loaded') - Number(a.state === 'loaded')).map((m) => m.id)),
  llamacpp:  async (key, base) => idsOf(await getJson(`${base ?? 'http://127.0.0.1:8080'}/v1/models`, key ? bearer(key) : {}), (b) => (b.data as { id: string }[]).map((m) => m.id)),
};
```

`getJson` throws a `ProviderError`-shaped plain `Error` whose message is already the verbatim sentence (Pattern 6). Gemini pagination: `pageSize=1000` covers the catalogue today; follow `nextPageToken` only if present. Anthropic: `limit=1000` is the documented maximum [CITED: models-list page].

### Pattern 6: Test connection = cheapest real request, verbatim failure

**What:** `testConnection(provider)` runs the matrix's "cheapest test", times it, and returns `{ ok: true, models: n, ms }` or `{ ok: false, error: '<status> <provider sentence>', hint?: string }`.
**When to use:** `POST /api/settings/:provider/test`. Also reused for the browser's one-line result `Connected · 12 models · 340 ms`.

The unwrapping generalises `friendly` in `codex.ts` [VERIFIED: server/src/codex.ts:157-172]:

```typescript
/** The provider's own sentence out of whatever envelope it came in: Anthropic { type:'error', error:{ type, message } }, OpenAI/OpenRouter/llama.cpp { error:{ message } }, Ollama { error:'...' }, else the raw text. */
function providerSentence(status: number, text: string): string {
  let msg = text.trim();
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string } | string; message?: string };
    if (typeof parsed.error === 'string') msg = parsed.error;
    else if (parsed.error?.message) msg = parsed.error.message;
    else if (parsed.message) msg = parsed.message;
  } catch { /* plain text */ }
  return `${status} ${msg || 'no message'}`.slice(0, 300);
}
/** One line Derive adds when it recognises the case; never replaces the sentence. */
function hintFor(provider: string, status: number, sentence: string): string | undefined {
  if (status === 401 || /invalid.*(api key|x-api-key)|authentication_error|incorrect api key/i.test(sentence)) return `The key was refused. Paste a new key for ${provider}, or unset its environment variable if that is where it came from.`;
  if (status === 402 || /billing|credit|quota/i.test(sentence)) return 'The account has no credit or a spending limit was reached.';
  if (status === 429) return 'Rate limited; wait a moment and test again.';
  return undefined;
}
```

Network-level failures (`fetch` throws: `ECONNREFUSED`, timeout) become `error: 'nothing answered at <host:port>'` for local servers and `error: 'could not reach <host>: <e.message>'` otherwise — that is Derive's sentence, so it is not quoted as the provider's. Every error path goes through `safeMessage`/`redactErrors` before it leaves the route (a key that appears in a provider's echo of the request must not reach the browser).

### Pattern 7: `/settings` page copies `/you`

**What:** Same header (`ArrowLeft` back link, `font-serif text-[22px]` title, `LearnerMenu` at right), same `field` class string, same `Section` layout, same `saved · applies from the next turn` mono line, same `err` as `text-rust-400`. Per-row state rather than one page draft.
**When to use:** All of `Settings.tsx`. The saved-tick behaviour is `state: 'idle' | 'saving' | 'saved' | 'error'` with an 1800 ms timer, exactly `You.tsx:20-60` [VERIFIED].

The key field is a controlled `<input type="password" autoComplete="off">` while editing; once `{ set: true, hint }` comes back it renders as `<span class="font-mono">•••• •••• a1b2</span>` with `Replace` and `Remove` text buttons. Locked fields (`locked: 'ANTHROPIC_API_KEY'`) render the `set from environment` pill and a sentence `set by ANTHROPIC_API_KEY in your environment; unset it to store a key here`, input disabled.

Combobox: `<input list={`models-${id}`} value={model} onChange={…} onBlur={save}/>` plus `<datalist id=…>{models.map(...)}</datalist>`, a `Fetch models` button that calls `POST /models`, and the failure sentence under the field in `text-rust-400 text-[12px]`. Empty list ⇒ the same input, no list — D-08 satisfied without a second control.

Status pill vocabulary (fixed by CONTEXT): `logged in`, `key set`, `set from environment`, `found on port N`, `not configured`. Use the existing pill classes from `Lesson.tsx:115` (`font-mono text-[10px] tracking-[0.16em] uppercase text-ink-400 border hairline rounded-full px-2.5 h-6`) [VERIFIED].

### Pattern 8: The pill reads the turn, not the setting

**What:** `provider · model` in the lesson header shows what the last turn ran on. Two feeds: `lessonView` gains `turn: lastTurn(id)` (a `TurnRow` with `driver` and `model`) for first paint; the `turn_start` event's payload gains `{ provider, model }` for live updates.
**When to use:** `Lesson.tsx` header; `useLesson.ts` reducer stores `tutor: { provider, model } | null` from `init.turn` and from `turn_start` payload.

This is **not** a new event type. `turn_start` is already in `EVENT_TYPES` [VERIFIED: web/src/lib/useLesson.ts:236-238] and the reducer's `case 'turn_start'` ignores the payload today [VERIFIED: useLesson.ts:70-71], so adding fields is backward compatible with stored events (old ones simply have none). External lessons already emit `turn_start` with `{ source: driver }` [VERIFIED: server/src/index.ts:704, 728]; the reducer maps `source: 'claude-code' → 'claude code · terminal model'`, `'codex' → 'codex cli · terminal model'` (D-16). The pill links to `/settings`.

`TurnRow.model` is documented as "The model asked for, or null to take the provider's default" [VERIFIED: server/src/db.ts:478-480]; render `null` as `default model`.

### Pattern 9: Provider change clears the session (D-04)

**What:** When the resolved provider differs from the provider the lesson's `session_id` belongs to, clear `session_id` before the turn so the driver starts a fresh provider conversation.
**When to use:** `runTurn`, before building `TurnContext`.

The `lessons` table has `session_id` but no column recording which provider issued it [VERIFIED: migrations.ts:35-43]. The cheapest honest signal is `lastTurn(lessonId)?.driver`: if it exists and differs from the new driver's name, `setSessionId(lessonId, '')`-equivalent (add `clearSessionId(id)` to `db.ts`; `setSessionId` is `UPDATE lessons SET session_id = ?` [VERIFIED: db.ts:422]). No migration needed. `TurnContext.sessionId` is `string | null` [VERIFIED: server/src/driver.ts:53-54], so pass `null`.

### Anti-Patterns to Avoid

- **Returning the key in any shape** (full, prefix, length): only `{ set, hint }` with the last four characters. Do not add a `GET /api/settings/:provider/key`.
- **Treating an open port as a found server:** shape-check every probe (Pitfall 1).
- **Putting the Gemini key in the query string:** header only.
- **Reading `process.env` in `probe.ts`/`settings.ts`:** add constants to `config.ts`.
- **Letting `learners.prefs.model` reach the prompt:** `preferencesSection()` in `db.ts:312-332` renders every pref it knows; `cleanPrefs` must accept `model` but `preferencesSection` must not print it, and `describePrefs` in `web/src/lib/prefs.ts` must not either (the model is not "how you learn").
- **A page-level Save button or a toast:** D-03 and D-14 forbid both.
- **Sending a key to a host other than its catalogue host:** the `openai-compatible` row is the only one whose host is learner-supplied; never let any other row's `base_url` be set.
- **Process-lifetime memo:** the resolver may cache detection for seconds, never for the process.
- **A new event type:** everything the browser needs rides on `turn_start` and `lessonView`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic file write with mode | Custom fd juggling / fsync dance | `writeFileSync(tmp, data, { mode: 0o600 })` + `renameSync(tmp, path)` (same pattern family as `credentials.ts` `ensureToken` `{ mode: 0o600, flag: 'wx' }`) | Rename is atomic on the same filesystem; verified the mode survives |
| Request timeouts | `setTimeout` + manual `AbortController` per call | `AbortSignal.timeout(ms)` | Built-in, already the suite's precedent |
| Body validation | `typeof` ladders in route handlers | `zod` schemas with `.describe()` | Already a dependency; consistent with tool schemas |
| Transactions for settings writes | Manual `BEGIN/COMMIT` | `withTx` in `db.ts:230` | Re-entrant, one place |
| Secret redaction in errors | Per-route regexes | `safeMessage` / `redactErrors` in `secrets.ts` + `registerSecret` on load | One chokepoint already tested in `secrets.test.ts` |
| Schema change | `ALTER TABLE` in `db.ts` | Migration 5 in `migrations.ts` | Runner snapshots, versions and rolls back |
| Combobox | A React combobox package | `<input list>` + `<datalist>` | No dependency, D-08 behaviour for free |
| Provider error parsing | Per-provider `if` in the route | One `providerSentence()` + `hintFor()` in `probe.ts`, modelled on `codex.ts` `friendly` | Envelopes differ in one field path only |

**Key insight:** every piece of infrastructure this phase needs already exists in the repo or in Node; the risk is not building something hard, it is drifting from the patterns Phase 1 established (0600 + live read + registerSecret, migrations, the `/api/*` guard, the `{ error }` route contract).

## Runtime State Inventory

This phase replaces a boot-time mechanism (`backend()` memo) and adds a data file; the inventory below states what carries the old shape.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `turns.driver` values are `'claude'`, `'codex'`, `'fake'` (app) and `'claude-code'`, `'codex'` (companion) [VERIFIED: db.ts:475-477]. `lessons.session_id` has no provider column. `learners.prefs` JSON gains an optional `model`. | No migration of existing rows: keep driver names `'claude'`/`'codex'` for the two login drivers; map catalogue ids `claude-code → claude`, `codex → codex`. Migration 5 adds `settings` only. |
| Live service config | `~/.codex/config.toml` holds `model = "gpt-5.4"` (this machine) — the Codex login's own default; `~/.claude` login state. Neither is Derive's to edit. | Read-only: optionally display the Codex default; never write. |
| OS-registered state | None — Derive registers nothing with the OS. Verified by inspection of `scripts/`, `plugin/`, `server/src`. | none |
| Secrets / env vars | Existing: `DERIVE_BACKEND`, `DERIVE_MODEL`, `DERIVE_CODEX_BIN`, `CODEX_HOME` (read in `config.ts`). **`.env.example` documents neither `DERIVE_BACKEND` nor `DERIVE_CODEX_BIN` today** [VERIFIED: grep]. New: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`/`GOOGLE_API_KEY`, `OPENROUTER_API_KEY`, `OLLAMA_HOST`. Test harness pins `DERIVE_BACKEND: 'claude'` in `spawn.ts:71`, `security.test.ts:283`, `driver.test.ts:12`, `usage.test.ts:28` [VERIFIED]. | Document all in `.env.example` with the precedence sentence. Settings tests that exercise the file/detection tiers must pass `DERIVE_BACKEND: ''` through `startDeriveServer(entry, env)` (empty string → `undefined` in `config.ts:44` [VERIFIED]). |
| Build artifacts / files | `~/.derive/token` 0600, `~/.derive/derive.db` **0644**, `derive.db.bak-v0` [VERIFIED: `ls -la ~/.derive`]. New `~/.derive/secrets.json` 0600. | Doctor: add a `Secrets file` line (presence + mode, like `Install token`), skip mode on win32 as the token check does [VERIFIED: doctor.mjs token block]. The 0644 database is why keys must not enter it. |

## Common Pitfalls

### Pitfall 1: An open default port is not the server you think
**What goes wrong:** Detection labels a row `found on port 8080` because something answered — on this machine that something is FreqUI (uvicorn) serving HTML with HTTP 200.
**Why it happens:** 8080 and 1234 are the most reused developer ports on earth.
**How to avoid:** Probe a JSON endpoint and check the shape (Pattern 4). llama.cpp `/health` `{status:'ok'}`; LM Studio `/api/v0/models` `{object:'list'}`; Ollama `/api/tags` `{models:[…]}`. A shape mismatch is `not configured`, silently.
**Warning signs:** `found on port N` on a machine with no local model server; a test-connection that "succeeds" with 0 models.

### Pitfall 2: `claude auth status` carries identity
**What goes wrong:** The detection response, and therefore the browser and any plugin transcript, gets the learner's email, org id and subscription type.
**Why it happens:** The CLI's JSON includes `email`, `orgId`, `orgName`, `subscriptionType` (seen this session).
**How to avoid:** Keep `claudeLoggedIn(): boolean`; if the UI wants a subtitle, add at most `authMethod`. Never pass the parsed object through.
**Warning signs:** Any `email` string in `GET /api/settings`.

### Pitfall 3: Env lock collides with the test harness default
**What goes wrong:** Every settings test sees `DERIVE_BACKEND` locked because `spawn.ts` sets `DERIVE_BACKEND: 'claude'`.
**Why it happens:** Phase 1 pinned it so `backend()` would not shell out to `claude` in CI.
**How to avoid:** `startDeriveServer(entry, { DERIVE_BACKEND: '' })` in the settings suite (env merges over defaults; `''` reads as unset). For detection-tier tests, also set `PATH` to a dir without `claude` or accept the 15 s timeout risk — better: set `active_provider` through the API first so the resolver never reaches tier 3, and test tier 3 only through `codexLoggedIn` with `CODEX_HOME` pointed at a scratch dir containing `auth.json`.
**Warning signs:** `set from environment` pills in a fresh scratch server.

### Pitfall 4: Gemini `?key=` lands in URLs and logs
**What goes wrong:** The key appears in provider-side logs, in any proxy, and in Derive's own error text if the URL is echoed.
**Why it happens:** Google's REST examples show the query form.
**How to avoid:** `x-goog-api-key` header only [CITED: ai.google.dev/gemini-api/docs/api-key].

### Pitfall 5: The per-learner model leaks into the prompt
**What goes wrong:** `preferencesSection()` prints every pref, so a `model` pref becomes a line the tutor reads ("Draw examples from: gpt-6-astra").
**Why it happens:** `cleanPrefs` and `preferencesSection` are generic over `LearnerPrefs` fields [VERIFIED: db.ts:258-332].
**How to avoid:** Add `model` to `LearnerPrefs` and `cleanPrefs` (60-char cap, charset `[A-Za-z0-9._:/-]`), but do not add a line in `preferencesSection`; exclude it from `describePrefs` on the web; and do not emit it in the `preferences` event's summary. A test: set the pref, call `learnerProfile()`, assert the model id is absent.

### Pitfall 6: Short secrets are stored but not redacted
**What goes wrong:** A 10-character LM Studio token is saved, but `registerSecret` drops anything under 16 characters, so it would appear in an error body.
**Why it happens:** `MIN_SECRET_CHARS = 16` protects lesson prose from a text-shredding registry [VERIFIED: secrets.ts:26-31].
**How to avoid:** Accept it — local tokens never leave the machine. Do not lower the floor. Cap stored key length (e.g. 4096) and reject whitespace-only values.

### Pitfall 7: A provider change with a warm `session_id`
**What goes wrong:** The Codex driver is handed a Claude session id (or vice versa) and fails to resume.
**Why it happens:** `session_id` is one column with no owner.
**How to avoid:** Pattern 9: compare `lastTurn(id)?.driver` to the new driver name and clear the session when they differ, before `startTurn`.
**Warning signs:** `turn_end` errors mentioning an unknown thread/session right after switching providers.

### Pitfall 8: Windows and 0600
**What goes wrong:** `mode: 0o600` is a no-op on win32; a doctor check would fail every Windows install.
**Why it happens:** POSIX modes.
**How to avoid:** Copy the doctor's token branch: `else if (process.platform === 'win32') ok(...)` [VERIFIED: doctor.mjs].

### Pitfall 9: Blocking first paint on the CLI spawn
**What goes wrong:** `GET /api/settings` waits up to 15 s for `claude auth status`.
**Why it happens:** `execFileSync` blocks the event loop.
**How to avoid:** `GET /api/settings` returns stored config immediately with `status: 'checking'` for login/port rows; `POST /api/settings/detect` runs the pass; the page calls both and fills rows as results arrive (D-13). Use `execFile` (async) for the CLI in the detect route so probes run in parallel with it.

### Pitfall 10: The model list is the wrong currency for local servers
**What goes wrong:** Ollama's `/api/tags` names are `llama3.2:latest`; LM Studio ids are paths like `qwen/qwen3-8b`; llama.cpp returns one id that may be a file path.
**Why it happens:** No shared naming.
**How to avoid:** Store whatever the server reports, verbatim; do not validate local ids against a strict charset (allow `/`, `:`, `.`, `-`, `_`). For key providers the charset can be stricter.

### Pitfall 11: `busy()` and `lessonView` are hot
**What goes wrong:** Adding `lastTurn(id)` to `lessonView` is one indexed query and fine; adding `resolveTutor()` there is not (it may shell out).
**How to avoid:** The pill reads `turns`, not the resolver. Only `runTurn`, `/api/health`, startup and `/api/settings/active` call the resolver.

## Code Examples

### secrets.json read/write (server/src/keys.ts)

```typescript
// Source: pattern of server/src/credentials.ts (read this session); primitives verified locally
import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR } from './config.js';
import { registerSecret } from './secrets.js';

export const SECRETS_PATH = join(DATA_DIR, 'secrets.json');
const CACHE_MS = 1_000;
type Store = Record<string, string>;
let cache: { store: Store; at: number; error: string | null } | null = null;

function load(now = Date.now()): { store: Store; error: string | null } {
  if (cache && now >= cache.at && now - cache.at < CACHE_MS) return cache;
  let store: Store = {};
  let error: string | null = null;
  if (existsSync(SECRETS_PATH)) {
    try {
      const raw = JSON.parse(readFileSync(SECRETS_PATH, 'utf8')) as unknown;
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) for (const [k, v] of Object.entries(raw)) if (typeof v === 'string' && v.trim()) store[k] = v.trim();
      else error = `${SECRETS_PATH} is not a JSON object`;
    } catch (e) {
      error = `${SECRETS_PATH} could not be read: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
  for (const v of Object.values(store)) registerSecret(v); // D-10: every loaded key is protected from here on
  cache = { store, at: now, error };
  return cache;
}

function persist(store: Store) {
  const tmp = `${SECRETS_PATH}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(store, null, 2) + '\n', { mode: 0o600 });
  renameSync(tmp, SECRETS_PATH); // atomic on the same filesystem; the mode rides along
  cache = null;
}

export const keyOf = (provider: string): string | undefined => load().store[provider];
export const hintOf = (v: string): string => (v.length >= 8 ? v.slice(-4) : '');
export const keyView = (provider: string): { set: boolean; hint: string | null } => {
  const v = keyOf(provider);
  return v ? { set: true, hint: hintOf(v) } : { set: false, hint: null };
};
export const secretsFileError = (): string | null => load().error;
export function setKey(provider: string, value: string) {
  const v = value.trim();
  if (!v) throw new Error('the key is empty');
  if (v.length > 4096) throw new Error('the key is longer than any provider issues');
  registerSecret(v);
  persist({ ...load().store, [provider]: v });
}
export function removeKey(provider: string) {
  const { [provider]: _gone, ...rest } = load().store;
  if (Object.keys(rest).length) persist(rest);
  else if (existsSync(SECRETS_PATH)) { unlinkSync(SECRETS_PATH); cache = null; }
}
```

### The resolver (server/src/settings.ts)

```typescript
// Source: replaces server/src/backend.ts:64-77 backend()/backendSource() (read this session)
import { BACKEND_SETTING, MODEL, type Backend } from './config.js';
import { claudeLoggedIn, codexLoggedIn } from './backend.js';
import { getLearner } from './db.js';

export type TutorChoice = {
  provider: string;               // catalogue id: 'claude-code' | 'codex' | ...
  model: string | null;           // null: the provider's own default
  source: 'environment' | 'settings' | 'detected';
  modelSource: 'environment' | 'learner' | 'settings' | null;
};

const DETECT_MS = 30_000;
let detected: { provider: 'claude-code' | 'codex'; at: number } | null = null;
export function resetDetection() { detected = null; }
function detectedProvider(now = Date.now()): 'claude-code' | 'codex' {
  if (detected && now - detected.at < DETECT_MS) return detected.provider;
  const provider = claudeLoggedIn() ? 'claude-code' : codexLoggedIn() ? 'codex' : 'claude-code';
  detected = { provider, at: now };
  return provider;
}

/** What the next turn runs on. Computed on every call: env, then the settings table, then detection. */
export function resolveTutor(learnerId?: string): TutorChoice {
  let provider: string; let source: TutorChoice['source'];
  if (BACKEND_SETTING) { provider = BACKEND_SETTING === 'codex' ? 'codex' : 'claude-code'; source = 'environment'; }
  else { const stored = getSetting('active_provider'); if (stored) { provider = stored; source = 'settings'; } else { provider = detectedProvider(); source = 'detected'; } }

  let model: string | null = null; let modelSource: TutorChoice['modelSource'] = null;
  if (MODEL) { model = MODEL; modelSource = 'environment'; }
  else {
    const mine = learnerId ? getLearner(learnerId)?.prefs.model : undefined;
    if (mine) { model = mine; modelSource = 'learner'; }
    else { const m = getSetting(`model:${provider}`); if (m) { model = m; modelSource = 'settings'; } }
  }
  return { provider, model, source, modelSource };
}

/** The Backend the two login drivers and systemPrompt() still speak. Only teaching rows reach here in this phase. */
export const backendOf = (provider: string): Backend => (provider === 'codex' ? 'codex' : 'claude');

/** The variable that locks a field, or null. */
export const lockedBy = (field: 'provider' | 'model' | `key:${string}`): string | null =>
  field === 'provider' ? (BACKEND_SETTING ? 'DERIVE_BACKEND' : null) : field === 'model' ? (MODEL ? 'DERIVE_MODEL' : null) : envKeyVarFor(field.slice(4));
```

### `runTurn` after the change (server/src/agent.ts:268-296 region)

```typescript
// Source: server/src/agent.ts:274-289 today (read this session); the edit is the four lines marked
const tutor = resolveTutor(lesson.learner_id);                                            // NEW
const driver = driverOverride() ?? (backendOf(tutor.provider) === 'codex' ? codexDriver : claudeDriver);
const last = lastTurn(lessonId);
if (last && last.driver !== driver.name && lesson.session_id) clearSessionId(lessonId);  // NEW: D-04, a fresh provider session
const turnId = startTurn(lessonId, driver.name, tutor.model);
emit(lessonId, 'turn_start', { provider: tutor.provider, model: tutor.model });          // CHANGED payload, same type
...
const instructions = systemPrompt(backendOf(tutor.provider)) + ...;
const ctx: TurnContext = { ..., model: tutor.model ?? undefined, sessionId: getLesson(lessonId)!.session_id ?? null, ... };
```

(`TurnContext.model` is `string | undefined` [VERIFIED: driver.ts:49-50]; convert `null → undefined` at the boundary.)

### Settings routes (server/src/index.ts, new `// ---------- settings ----------` section)

```typescript
// Source: route conventions from server/src/index.ts (err helper at :568, body parsing .catch(() => ({})) throughout)
app.get('/api/settings', (c) => c.json(settingsView()));                       // rows with { set, hint }, locks, defaults_as_of, active, file error
app.post('/api/settings/detect', async (c) => c.json(await detect()));         // resets the resolver's detection memo, returns statuses
app.get('/api/settings/active', (c) => c.json(resolveTutor(learnerOf(c))));    // for mcp.ts start_lesson and the pill's "set to" sentence
app.put('/api/settings/:provider', async (c) => {                              // { key?, model?, base_url? } — env-locked fields are 409
  const p = providerOf(c.req.param('provider')); if (!p) return c.json({ error: 'unknown provider' }, 404);
  const body = SettingsWrite.safeParse(await c.req.json().catch(() => ({}))); if (!body.success) return c.json({ error: body.error.issues[0].message }, 400);
  if (body.data.key !== undefined) { if (lockedBy(`key:${p.id}`)) return c.json({ error: `the ${p.label} key is set by ${lockedBy(`key:${p.id}`)} in the environment; unset it to store one here` }, 409); if (p.auth === 'login') return c.json({ error: `${p.label} runs on its login and takes no key` }, 400); setKey(p.id, body.data.key); }
  if (body.data.model !== undefined) { if (lockedBy('model')) return c.json({ error: 'the model is set by DERIVE_MODEL in the environment' }, 409); body.data.model ? setSetting(`model:${p.id}`, body.data.model) : deleteSetting(`model:${p.id}`); }
  if (body.data.base_url !== undefined) { if (p.auth !== 'key+url' && !p.port) return c.json({ error: `${p.label} has a fixed endpoint` }, 400); setSetting(`base_url:${p.id}`, normaliseBaseUrl(body.data.base_url)); }
  return c.json(rowView(p.id));
});
app.delete('/api/settings/:provider/key', (c) => { removeKey(c.req.param('provider')); return c.json({ ok: true, note: 'the value stays redacted in this running server until it restarts' }); });
app.post('/api/settings/active', async (c) => { const { provider } = ...; const p = providerOf(provider); if (!p) return c.json({ error: 'unknown provider' }, 404); if (!p.teaches) return c.json({ error: `teaching on ${p.label} arrives with the next release` }, 400); if (lockedBy('provider')) return c.json({ error: 'the provider is set by DERIVE_BACKEND in the environment' }, 409); setSetting('active_provider', p.id); return c.json(resolveTutor()); });
app.post('/api/settings/:provider/models', async (c) => { try { return c.json({ models: await listModels(c.req.param('provider')) }); } catch (e) { return err(c, e, 502); } });
app.post('/api/settings/:provider/test', async (c) => c.json(await testConnection(c.req.param('provider'))));
```

`err` today accepts `400 | 404 | 422 | 500` [VERIFIED: index.ts:568]; widen the union to include `409 | 502` or return `c.json({ error: safeMessage(e) }, 502)` inline. The provider's verbatim sentence flows through `j<T>()` in `web/src/lib/api.ts:38-48` [VERIFIED] into the row unchanged, exactly as CONTEXT expects.

### Header pill (web/src/pages/Lesson.tsx, beside the `<h1>` at line 113)

```tsx
// Source: existing companion pill classes at web/src/pages/Lesson.tsx:115 (read this session)
{state.tutor && (
  <Link to="/settings" title="Which model is teaching. Change it in Settings; it applies from the next turn." className="hidden md:inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.16em] uppercase text-ink-400 hover:text-ink-50 border hairline rounded-full px-2.5 h-6 transition-colors">
    {external ? `${driver} · terminal model` : `${labelOf(state.tutor.provider)} · ${state.tutor.model ?? 'default model'}`}
  </Link>
)}
```

`driver` is already `state.lesson?.driver === 'codex' ? 'codex' : 'claude code'` [VERIFIED: Lesson.tsx:31]; D-16 wants `codex cli` for the Codex terminal — adjust that ternary's string.

### `start_lesson` sentence (server/src/mcp.ts:220-249)

```typescript
// Source: server/src/mcp.ts start_lesson (read this session); add one field to the returned object
const tutor = await api<{ provider: string; model: string | null }>('/api/settings/active').catch(() => null);
...
tutor_running_this_lesson: DRIVER === 'codex' ? 'the Codex CLI in this terminal, on its own model' : 'Claude Code in this terminal, on its own model',
app_tutor_setting: tutor ? `Derive's own tutor is set to ${tutor.provider} · ${tutor.model ?? 'default model'}` : undefined,
```

`mcp.test.ts` asserts only `lesson_id` and `answer_in` from `start_lesson` [VERIFIED: mcp.test.ts:138-139], so new fields do not break the smoke test; the wire-surface snapshot covers `tools/list`, not results.

### The test double: a fake provider on loopback (server/test/settings.test.ts)

```typescript
// Source: spawn.ts startDeriveServer(entry, env) signature (read this session); node:http built-in
import { createServer } from 'node:http';
const fake = createServer((req, res) => {
  if (req.url === '/v1/models' && req.headers.authorization === 'Bearer good-key-good-key-1234') { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ object: 'list', data: [{ id: 'tiny-a' }, { id: 'tiny-b' }] })); return; }
  res.statusCode = 401; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ error: { message: 'Incorrect API key provided: good-***', type: 'invalid_request_error' } }));
});
// then: PUT /api/settings/openai-compatible { base_url: `http://127.0.0.1:${port}`, key: 'good-key-good-key-1234' } → { key: { set: true, hint: '1234' } }
//        POST .../models → { models: ['tiny-a','tiny-b'] }; POST .../test → { ok: true, models: 2, ms: <number> }
//        PUT wrong key → POST .../test → { ok: false, error: '401 Incorrect API key provided: good-***', hint: 'The key was refused…' }
//        GET /api/settings → no response text contains 'good-key-good-key-1234'; statSync(secrets.json).mode & 0o777 === 0o600
//        env lock: startDeriveServer(entry, { DERIVE_BACKEND: '', OPENAI_API_KEY: 'from-env-from-env-1234' }) → row openai key.locked === 'OPENAI_API_KEY', PUT key → 409
//        restart persistence: kill child, startDeriveServer(entry, { DERIVE_BACKEND: '' }, { dataDir }) → GET /api/settings/active.provider unchanged
//        pill feed: create an agent lesson, run a fake-driver turn via setDriverOverride in a module-level suite (usage.test.ts pattern) → lastTurn(id).model, turn_start payload has provider/model
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Third-party apps running on a Claude Pro/Max OAuth login (incl. Agent SDK) | Not permitted; API keys via Claude Console or a cloud provider; end users may sign in only to the unmodified Claude Code binary | Enforcement Jan 9 2026; docs clarified Feb 19 2026; blocked for third-party agentic tools Apr 4 2026 [CITED: code.claude.com/docs/en/legal-and-compliance; WebSearch Register/GitHub issue #82266 for dates] | Confirms D-05: the Claude Code login row says "use the plugin"; in-app Claude (Phase 3) is on `ANTHROPIC_API_KEY`. The existing `claudeDriver` on the login is the pre-existing app path CONTEXT keeps `teaches: true` for now — see Open Question 1 |
| Third-party tools piggybacking on Gemini CLI OAuth | Detected and suspended; "use Gemini CLI with your own paid API key from AI Studio or Vertex AI" | Service update Mar 18 2026; detection from Mar 25 2026 [CITED: github.com/google-gemini/gemini-cli/discussions/22970] | Confirms D-05: Gemini row is API-key only; no Gemini CLI driver |
| `backend()` decided once per process | `resolveTutor()` per turn, env > settings > detection | This phase | `/api/health` `backend_source` values change from `'DERIVE_BACKEND' \| 'auto'` to `'environment' \| 'settings' \| 'detected'` — update `doctor.mjs` if it ever reads it (today it reads only `ok`/`version`) |
| Anthropic docs at `docs.anthropic.com` | 301 → `platform.claude.com/docs` | observed this session | Cite the new host in comments |
| Anthropic model ids dated (`…-20250514`) | Dateless pinned ids from 4.6 on (`claude-opus-5-5`) | 2026 | Curated defaults can be dateless |

**Deprecated/outdated:**
- `docs.anthropic.com/en/api/models-list` — redirects; use `platform.claude.com/docs/en/api/models-list`.
- `.env.example`'s `DERIVE_MODEL=claude-opus-5` example — still a valid legacy id but no longer the recommended default; update to `claude-opus-5-5` when the file is touched.
- `codex.ts` `friendly` hint "for example gpt-5.5" — verify against Codex's current model list at implementation; not this phase's job beyond reuse of the pattern.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `OPENROUTER_API_KEY` is the conventional env var name | Provider Endpoint Matrix | Wrong variable name in detection; learner's env key not shown as "set from environment" |
| A2 | OpenRouter model slugs are `vendor/model`, e.g. `anthropic/claude-opus-5-5` | Matrix (default) | Default preselect fails the test; learner picks from the fetched list instead — low harm |
| A3 | OpenAI error bodies are `{ error: { message, type, param, code } }` | Matrix | `providerSentence` falls back to raw text — sentence still verbatim, just less tidy |
| A4 | Gemini error bodies are `{ error: { code, message, status } }` | Matrix | Same fallback |
| A5 | Ollama error bodies are `{ error: "<text>" }` | Matrix | Same fallback |
| A6 | Filtering Gemini models to `supportedGenerationMethods` includes `generateContent` yields the chat-capable set | Pattern 5 | Over/under-filtering the list; learner can still type an id |
| A7 | `GET /` on Ollama returns "Ollama is running" | Matrix | Not relied upon (`/api/tags` used) |
| A8 | Native `<datalist>` is acceptable UX for the combobox across the browsers the UI-SPEC targets | Standard Stack | UI-SPEC may require a custom combobox; swap is contained to `ProviderRow.tsx` |
| A9 | A 30 s bounded memo on the detection tier satisfies "no process-lifetime memo" | Pattern 2 | If the user wants zero caching, drop the memo and accept a 0.3 s spawn per turn when nothing is stored |
| A10 | Default model ids as of 2026-09-30: `claude-opus-5-5`, `gpt-6-astra`, `gemini-3.8-flash` | Matrix | They are cited from vendor docs today, but they move; that is what `DEFAULTS_AS_OF` records. The planner sets the date to implementation day and re-checks |

## Open Questions (RESOLVED)

All four questions were dispositioned during planning; each entry names the plan and task that decided it.

1. **Does the Claude Code login row stay `teaches: true` in Phase 2 given the verbatim policy?** — RESOLVED: 02-01 Task 1 (catalogue) keeps `teaches: true` on `claude-code` and `codex` per CONTEXT D-05; the row's sentence is the UI-SPEC Copywriting Contract text chosen under UI-SPEC Assumption A7 ("Runs the app's tutor on your Claude Code login. The plugin is the supported subscription route; an Anthropic API key takes over from the next release."); COVERAGE.md opts out of Claude.ai OAuth for in-app use.
   - What we know: CONTEXT D-05 says only the two login rows teach now, and the existing `claudeDriver` runs on the Claude Code login through the Agent SDK. Anthropic's legal page (fetched today) says developers "including those using the Agent SDK, should use API key authentication" and may not "route requests through Free, Pro, or Max plan credentials on behalf of their users", while an end user signing in to the unmodified Claude Code binary is allowed.
   - What's unclear: whether Derive-as-a-local-app-run-by-the-same-person is "on behalf of their users". The roadmap already resolved the product direction (plugin = subscription route; in-app Claude = API key in Phase 3).
   - Recommendation (adopted): keep the row as CONTEXT decided (it is the pre-existing path, removing it is Phase 3's flip), but make the row's sentence honest. The user confirmed the sentence in the UI-SPEC (A7).

2. **Where does `base_url` for local servers live when `OLLAMA_HOST` is set?** — RESOLVED: 02-02 Task 1 adds `OLLAMA_HOST` to `config.ts`, `lockedBy('base_url:ollama')` names it, `localBase(spec)` in `settings.ts` probes that host ahead of the stored value and the catalogue default, the row reads `set from environment`, and `PUT base_url` on the Ollama row answers 409 while it is set. Without the variable, the learner stores `base_url:ollama` through `PUT /api/settings/ollama` (02-06 Task 1).
   - What we know: `OLLAMA_HOST` changes the bind address [CITED]; the catalogue has a default port.
   - Recommendation (adopted): env var → informational lock on the Ollama row's base URL (`set from environment`), probe that host; otherwise the learner may store `base_url:ollama` for a non-default port.

3. **Does `GET /api/settings/active` need learner scoping for the plugin?** — RESOLVED: 02-05 Task 1 makes `GET /api/settings/active` call `resolveTutor(learnerOf(c))` (the one learner-aware settings route; every other settings route stays per install), and 02-05 Task 2 makes `mcp.ts` `start_lesson` read `/api/settings/active?learner=<id>` so `app_tutor_setting` names the model that learner would get. Until 02-05, 02-04 Task 2 reads the install-wide value.
   - What we know: `mcp.ts` calls with `learner` by name in other routes; the per-learner override changes the model only.
   - Recommendation (adopted): accept `?learner=` via `learnerOf(c)` so the plugin sentence names the model that learner would get.

4. **Should `/api/health` keep the field names `backend`/`backend_source`?** — RESOLVED: 02-01 Task 2 changes `/api/health` to `{ ok, version, backend: <catalogue id>, model, source }` from one `currentTutor()` call (a non-spawning read; Pitfall 9); `backend_source` is dropped because nothing reads it (`doctor.mjs` and `spawn.ts` read only `ok`/`version`), and 02-04 Task 3 teaches the doctor to print `backend`, `model` and `source` on its Server line.
   - What we know: `doctor.mjs` reads only `ok` and `version`; `spawn.ts` reads only `ok`.
   - Recommendation (adopted): keep `backend` (now the catalogue id) and add `model` and `source`; rename `backend_source` → `source` since nothing else reads it.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | ✓ | v22.22.2 | — |
| pnpm | build/test | ✓ | 12.5.1 | — |
| `claude` CLI | `claudeLoggedIn`, detection row | ✓ | 2.1.258, logged in (`authMethod: claude.ai`, `subscriptionType: max`) | Row shows `not configured` when absent |
| Codex login | `codexLoggedIn` | ✓ | `~/.codex/auth.json` present (0600); `config.toml` `model = "gpt-5.4"` | Row shows `not configured` |
| Ollama on 11434 | detection test | ✗ | — | Row `not configured`; tests use a loopback fake server |
| LM Studio on 1234 | detection test | ✗ | — | same |
| llama.cpp on 8080 | detection test | ✗ (port taken by FreqUI/uvicorn, HTTP 200 HTML) | — | Shape-check makes this `not configured`; it is the live regression case for Pitfall 1 |
| Provider API keys in env | env-lock detection | none set (`ANTHROPIC_*`, `OPENAI_*`, `GEMINI_*`, `GOOGLE_*`, `OPENROUTER_*`, `DERIVE_*` all absent) | — | Tests inject via `startDeriveServer(entry, env)` |
| Outbound HTTPS to provider hosts | real model lists/tests | ✓ (docs fetched this session) | — | CI tests must not depend on it; use the loopback fake |
| `~/.derive` | data dir | ✓ | `token` 0600, `derive.db` 0644, `derive.db.bak-v0` present | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** local model servers (fake loopback server in tests; rows simply read `not configured` here).

## Validation Architecture

`workflow.nyquist_validation` is explicitly `false` in `.planning/config.json` — section skipped per instructions. For the planner's convenience, the existing harness facts: framework `node:test` (`node --import tsx --test test/*.test.ts`, `server/package.json`), spawn helper `server/test/spawn.ts` `startDeriveServer(entry, env, opts)` (needs `pnpm build`), module-level suites set `DERIVE_DATA_DIR` and `DERIVE_BACKEND` before a dynamic `await import` (`driver.test.ts:8-12`), CI runs `pnpm method:check`, `pnpm typecheck`, `pnpm build`, `pnpm test` (`.github/workflows/ci.yml:37-49`). No web tests exist. The Code Examples section sketches `server/test/settings.test.ts`.

## Security Domain

`security_enforcement: true`, ASVS level 1.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (to Derive's API) | Existing `/api/*` guard: `x-derive-token` or `derive_session` cookie, Host + Origin checks (`index.ts:188-243`). Settings routes sit under `/api/*` and inherit it; `/api/health` stays the only exemption |
| V3 Session Management | no new | Unchanged cookie mechanism |
| V4 Access Control | yes | Provider config is per install: no `learnerOf` scoping on `/api/settings*` except `GET /api/settings/active?learner=`; `teaches: false` rows refused as active (400); env-locked fields refused (409) |
| V5 Input Validation | yes | `zod` on `PUT /api/settings/:provider`: `key` string 1–4096 trimmed; `model` ≤ 200 chars, charset `[A-Za-z0-9._:/-]` (local servers need `/` and `:`); `base_url` must parse with `new URL`, scheme `http:` or `https:`, no `username`/`password`, no query/hash; provider id must be in the catalogue |
| V6 Cryptography | no | No encryption at rest (D-10 chose 0600 plaintext, matching the token); no key comparison, so no `timingSafeEqual` needed |
| V7 Error Handling & Logging | yes | Every route error through `safeMessage`/`redactErrors`; provider sentences truncated to 300 chars; no key in any log line; `[settings]` tag on the rare failure log |
| V8 Data Protection | yes | `secrets.json` 0600 atomic; `{ set, hint }` only; `registerSecret` on load and on set; hint is 4 chars of ≥ 8; doctor never prints hint; keys never in `derive.db` (0644) |
| V10 Malicious Code / SSRF | yes | A key is sent only to its catalogue host; `openai-compatible` base URL is learner-set through an authenticated route (the model has no tool to set it), loopback/LAN allowed by design (discretion note); `redirect: 'manual'` on provider fetches so a redirect cannot carry the key to a third host |
| V12 Files | yes | Temp file written beside the target with `mode: 0o600`, renamed; parse failure never overwrites the file |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Key echoed in a provider error (`Incorrect API key provided: sk-…`) reaching the browser | Information disclosure | `registerSecret` on load/set + `redactErrors` backstop on the route; truncate sentences; test asserts the key string is absent from every response body |
| Key in URL (Gemini `?key=`) | Information disclosure | Header `x-goog-api-key` only |
| `claude auth status` identity fields forwarded | Information disclosure | `claudeLoggedIn(): boolean` only |
| Open-port misdetection (FreqUI on 8080) | Spoofing | JSON shape checks per server |
| Redirect exfiltration of a Bearer key via `openai-compatible` base URL | Information disclosure | `fetch(..., { redirect: 'manual' })`; treat 3xx as an error sentence |
| Settings write from a hostile page | Tampering | Existing Origin allowlist + credential guard; settings routes are `/api/*` |
| Secrets file replaced by a same-uid process | Tampering | Accepted deliberately, as `credentials.ts` header documents for the token (same trust boundary as `derive.db`) |
| Hint too revealing for short keys | Information disclosure | `hintOf` returns `''` under 8 characters |
| Model id used to inject into the system prompt via `preferencesSection` | Tampering | `model` pref never rendered into prompt text (Pitfall 5) |
| DoS via slow provider on `test`/`models` | Denial of service | `AbortSignal.timeout(8_000)` on remote calls, 400 ms on local probes; detection async so the page never blocks |

## Sources

### Primary (HIGH confidence — read this session)
- `server/src/credentials.ts`, `server/src/secrets.ts`, `server/src/config.ts`, `server/src/backend.ts`, `server/src/driver.ts`, `server/src/agent.ts`, `server/src/codex.ts`, `server/src/migrations.ts` (1–60, 175–240, 339–422), `server/src/db.ts` (24–64, 255–335, 454–560, 1162–1198), `server/src/index.ts` (180–290, 568, 670–740, 1140–1166), `server/src/mcp.ts` (40–60, 215–260), `server/src/drivers/fake.ts`, `server/src/events.ts`, `server/test/spawn.ts`, `server/test/api.test.ts` (1–80), `server/test/credentials.test.ts` (1–50), `server/test/driver.test.ts` (1–60), `server/test/usage.test.ts`, `server/test/mcp.test.ts` (grep), `web/src/pages/You.tsx`, `web/src/pages/Lesson.tsx` (109–163), `web/src/pages/Home.tsx` (97–110), `web/src/components/LearnerMenu.tsx`, `web/src/main.tsx`, `web/src/lib/api.ts`, `web/src/lib/types.ts`, `web/src/lib/prefs.ts`, `web/src/lib/useLesson.ts` (68–86, 236–256), `web/vite.config.ts`, `scripts/doctor.mjs`, `.env.example`, `package.json`, `server/package.json`, `web/package.json`, `.planning/phases/01-foundation/01-CONTEXT.md`, `.planning/ROADMAP.md` §Phase 2, `.planning/REQUIREMENTS.md` §Settings, `.planning/PROJECT.md` §Key Decisions, `.planning/STATE.md`.
- Local probes: `node --version`, `pnpm --version`, `claude --version`, `claude auth status` (JSON shape and 0.30 s timing), `ls -la ~/.derive`, `curl` to 127.0.0.1:{11434,1234,8080}, Node one-liner for `writeFileSync{mode}`+`renameSync` and `AbortSignal.timeout`.

### Secondary (MEDIUM confidence — vendor documentation fetched 2026-09-30)
- https://platform.claude.com/docs/en/api/models-list — endpoint, headers, response, `limit` 1–1000
- https://platform.claude.com/docs/en/api/errors — error envelope and status → type table
- https://platform.claude.com/docs/en/models/overview — current ids and the "start with Claude Opus 5.5" recommendation
- https://code.claude.com/docs/en/legal-and-compliance — "Authentication and credential use" (quoted verbatim in cache digest)
- https://developers.openai.com/api/reference/resources/models/methods/list — endpoint, Bearer, response shape
- https://developers.openai.com/api/docs/models — current ids (`gpt-6-astra`, `gpt-6.1-sol`, `gpt-6-luna`)
- https://ai.google.dev/api/models — `models.list`, response, pagination
- https://ai.google.dev/gemini-api/docs/api-key — `x-goog-api-key`, `GEMINI_API_KEY`/`GOOGLE_API_KEY`
- https://ai.google.dev/gemini-api/docs/models — current ids (`gemini-3.8-flash`, `gemini-3.1-pro-preview`)
- https://openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties — models endpoint, apiKey security, response
- https://openrouter.ai/docs/api/api-reference/api-keys/get-current-api-key — `GET /api/v1/key`, 401 shape
- https://github.com/ollama/ollama/blob/main/docs/api.md — `/api/tags`
- https://docs.ollama.com/faq — `OLLAMA_HOST`, default bind
- https://docs.ollama.com/api/openai-compatibility — `/v1/models`, key ignored
- https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md — `/health`, `/v1/models`, `--api-key`, `LLAMA_ARG_HOST/PORT`, default 8080
- https://lmstudio.ai/docs/developer/rest/endpoints — `/api/v0/models` shape, `LM_API_TOKEN` example
- https://github.com/google-gemini/gemini-cli/discussions/22970 — Gemini CLI service update (2026-03-18)

### Tertiary (LOW confidence — WebSearch summaries only)
- Anthropic enforcement timeline (Jan 9 / Feb 19 / Apr 4 2026): The Register, GitHub `anthropics/claude-code#82266`, winbuzzer — dates not independently verified against an Anthropic page
- LM Studio default port 1234 / `lms server start` — lmstudio.ai quickstart via search snippet
- `OPENROUTER_API_KEY` convention — client library docs via search

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; every primitive verified locally or already in the repo
- Architecture: HIGH — every seam (`credentials.ts`, `secrets.ts`, `migrations.ts`, `runTurn`, `lessonView`, `turn_start`, `start_lesson`) read this session with line references; the design is an extension, not an invention
- Provider endpoints: MEDIUM — official docs fetched today; error envelopes for OpenAI/Gemini/Ollama are assumed and only affect message tidiness
- Default model ids: LOW-by-nature — correct today per vendor docs, perishable by design (`DEFAULTS_AS_OF`)
- Pitfalls: HIGH — the two sharpest ones (FreqUI on 8080, identity in `claude auth status`) were observed on the target machine

**Research date:** 2026-09-30
**Valid until:** 2026-10-30 for the codebase and endpoint facts; model ids should be re-checked on the implementation day (D-06)
