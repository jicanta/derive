# Phase 2: Settings and Secrets - Context

**Gathered:** 2026-09-30
**Status:** Ready for planning

<domain>
## Phase Boundary

The learner chooses provider and model inside the app, sees what the machine already offers (logged-in CLIs, keys in the environment, local servers on their default ports), stores keys in a 0600 secrets file outside `derive.db` that the API never echoes, fetches a provider's model list or types a model id, tests the connection and reads the provider's real failure sentence, and always sees which provider and model is teaching, in the lesson header and in the plugin start message. Requirements SET-01 through SET-06.

Not in this phase: running a lesson on an API key, a gateway or a local model (Phase 3 and Phase 4 wire those drivers behind the Phase 1 seam), per-lesson model switching, tiered roles, Copilot or Gemini CLI drivers, cost display. Settings rows for those providers exist now so keys, model lists and tests are real; the drivers land later.

</domain>

<decisions>
## Implementation Decisions

### Settings surface

- **D-01:** Provider and model configuration lives on a **new `/settings` page**, its own route beside `/you`, linked from the Home nav and the learner menu. Provider config is per install; `/you` stays per learner and keeps its title. The lesson screen gains only the header pill of D-15. — **Reversibility:** reversible.

- **D-02:** The page is **one row per provider, one row marked active**. Each row carries a status pill (`logged in` / `key set` / `set from environment` / `found on port N` / `not configured`), a write-only key field where the provider takes a key, the model combobox of D-08 and a "Use this" action. Detection results and configuration are the same list; there is no separate "what is available" view. Rows whose driver is not wired yet (D-05) show a sentence that teaching on that provider arrives with the next release and cannot be made active.

- **D-03:** **Save as you go, per field.** Picking a model or pressing "Use this" persists immediately with a small saved tick, the way `/you` already saves preferences. A pasted key saves on blur or Enter and the field turns into its masked hint (D-10). There is no page-level Save button, so "Test connection" always runs on stored values.

- **D-04:** A change applies on the **next turn of every lesson**, matching the roadmap rule that settings resolve per turn and replace the boot-time memo in `server/src/backend.ts`. A model change on the same provider resumes the provider conversation; a provider change starts a fresh provider session for that lesson (the lesson's `session_id` is cleared) and the tutor re-reads the lesson from its events and nodes through the existing system prompt. The header pill updates on that next turn. Provider changes are not blocked while a turn is in flight; the running turn finishes on the provider it started with. — **Reversibility:** costly — Phase 3's resume work (`turn_messages`) builds on "one provider session per lesson, replaced on provider change"; moving to per-lesson pinning later means a lesson-level provider column and a migration.

### Provider catalogue

- **D-05:** Settings lists **all planned providers now**: Claude Code login (the plugin route), Codex login, Anthropic, OpenAI, Google Gemini, OpenRouter, OpenAI-compatible endpoint (base URL plus key), Ollama, LM Studio, llama.cpp. Keys, model fetch and test work for every row in this phase. Each catalogue entry carries a `teaches` flag; only Claude Code login and Codex login are true now, Phase 3 and Phase 4 flip the rest. The Claude Code row never asks for a key: in-app Claude runs on an Anthropic API key, and the login row reads "use the plugin" as PROJECT.md records. Gemini's row defaults to an API key. — **Reversibility:** reversible.

- **D-06:** Curated defaults come from a **server-side providers catalogue module** (one entry per provider: id, label, auth kind, default model id, models endpoint, default port for local servers, `teaches`) with a **"defaults as of" date**. The planner picks the concrete default model ids at implementation time. The default is preselected when a row is first configured and the learner may change it. — **Reversibility:** reversible.

- **D-07:** Provider config is **per install**, stored outside the secrets file, and survives restarts. Never a per-learner key.

- **D-08:** The model field is **one combobox: the fetched list plus free typing, always**. When the fetch fails the list is empty, the provider's failure sentence shows under the field, and typing a model id still works and saves. No second control appears on failure.

- **D-09:** The optional **per-learner model override lives on `/you`** as one optional "model" field in that learner's preferences. It overrides the install-wide model for that learner on the active provider only; empty means the install default. Keys never appear on `/you`.

### Keys and detection

- **D-10:** Secrets live in **one JSON file, `~/.derive/secrets.json`** (under `DATA_DIR`), keyed by provider id, one key per provider, **mode 0600**, written atomically, read live like `server/src/credentials.ts` reads the token, and every loaded key is passed to `registerSecret` in `server/src/secrets.ts` at load. The API answers a key field with `{ set: true, hint }` and never the value. The hint is the **last four characters**; the UI renders dots plus the hint until the learner chooses Replace. — **Reversibility:** costly — the file's shape is what the doctor script, the redaction registry and Phase 3's drivers read; changing it later needs a converter for existing installs.

- **D-11:** **Precedence is env > file > detection, per turn** (roadmap). When `DERIVE_BACKEND`, `DERIVE_MODEL` or a provider's key variable is set in the environment, the matching field is **read-only** with a `set from environment` pill and a sentence naming the variable to unset. The learner cannot store a competing file value while the environment one is active.

- **D-12:** **Remove** on a file-stored key deletes it from `secrets.json`. The value stays registered for redaction in the running process until restart; nothing unregisters a live secret (Phase 1 D-11), and that is stated in the UI sentence.

- **D-13:** **Detection runs when `/settings` opens, and on a Rescan button.** One pass: `claude auth status` (existing `claudeLoggedIn`), the Codex auth file (existing `codexLoggedIn`), the environment for backend, model and provider keys, and a short-timeout HTTP probe of Ollama on 11434, LM Studio on 1234 and llama.cpp on 8080. Rows fill in as results arrive; nothing probes in the background and nothing polls. Boot no longer decides the backend once for the process.

### Test and indicator

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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap and requirements
- `.planning/ROADMAP.md` §"Phase 2: Settings and Secrets" — goal, success criteria, and the research note that fixes env > file > detection per turn, per-install provider config, in-app Claude on an API key, Gemini on an API key.
- `.planning/REQUIREMENTS.md` §Settings — SET-01 to SET-06, the phase's requirement ids.
- `.planning/PROJECT.md` §Key Decisions and §Out of Scope — "in-app Claude runs on an API key; the plugin is the subscription route"; no per-lesson model switching; simplicity rule.

### Phase 1 decisions this phase builds on
- `.planning/phases/01-foundation/01-CONTEXT.md` — D-09 (no endpoint hands the token out; the browser holds a derived cookie), D-10 (SSRF and secret-shaped filename rules), D-11 (exact-match redaction, keys register on load, pattern backstop on errors and logs only), D-12 (loopback bind, env-gated widening), D-13 to D-16 (per-request usage rows and the `turns` table that a turn's provider and model are written to), and the driver seam under Claude's Discretion.

### Code that defines the contracts this phase extends
- `server/src/secrets.ts` — `registerSecret`, `redact`, `redactErrors`; every loaded key goes through `registerSecret`.
- `server/src/credentials.ts` — the 0600, read-live, fail-loud token file pattern to copy for `secrets.json`.
- `server/src/config.ts` — `DATA_DIR`, `MODEL`, `EFFORT`, `BACKEND_SETTING`, `CODEX_HOME`; the environment values that outrank stored settings.
- `server/src/backend.ts` — `claudeLoggedIn`, `codexLoggedIn`, `codexBinary`, the `backend()` memo this phase replaces with a per-turn resolver.
- `server/src/driver.ts` — `TurnContext.model`, `sessionId`; how a driver receives the resolved model and how a fresh session is started.
- `server/src/agent.ts` (around `startTurn` and the `TurnContext` build) — where the resolved provider and model enter a turn and the `turns` row.
- `server/src/mcp.ts` (`start_lesson`) — the plugin start message to extend per D-16.
- `server/src/codex.ts` (`friendly`) — the existing error-to-fix-hint pattern for test results.
- `web/src/pages/You.tsx` — the save-as-you-go preference page whose pattern `/settings` follows, and where the per-learner model override field goes.
- `web/src/pages/Lesson.tsx` (header) — where the pill of D-15 goes.
- `web/src/lib/api.ts`, `web/src/lib/types.ts` — add settings endpoints and types there, not in components.
- `.env.example` — document the provider key variables and the precedence rule.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `server/src/credentials.ts`: atomic 0600 write, live read with a one-second cache, loud failure on a missing file. The secrets file reuses this shape.
- `server/src/secrets.ts`: the redaction registry. Keys register at load and are then removed from every error, log, event, export and vault line.
- `server/src/backend.ts`: `claudeLoggedIn` and `codexLoggedIn` are the login detectors; `codexBinary` resolution stays.
- `server/src/codex.ts` `friendly`: unwraps provider JSON errors into a sentence plus a fix hint; the test-connection result reuses the idea.
- `web/src/pages/You.tsx`: per-field save with a saved tick, `api.profile` and `api.setPrefs`; the `/settings` page copies its interaction and styling (`field` class, hairline borders, gold focus).
- `web/src/components/LearnerMenu.tsx` and the Home nav links: where the `/settings` link is added.
- Phase 1 migration runner (`server/src/migrations.ts`): any settings table arrives as a numbered migration.
- `server/test/api.test.ts`: the HTTP-level suite that settings routes, masked key responses and env locking are tested in, with no model.

### Established Patterns
- Config is read from `process.env` once in `server/src/config.ts`; the resolver reads those constants, never `process.env` directly.
- Errors are plain `Error` with a lowercase sentence; routes return `{ error }`; the web client throws that message, so the provider's verbatim sentence flows to the row unchanged.
- Everything the learner sees goes through the API, never the console; detection results are a response, not a log line.
- `learnerOf(c)` scopes per-learner reads; provider config is per install and must not be scoped by learner, while the override on `/you` is.
- Single-quote, semicolon, `.js` extensions on server imports, one component per file.

### Integration Points
- `runTurn` in `server/src/agent.ts`: the per-turn resolver replaces `MODEL` and `backend()` when building `TurnContext` and the `turns` row.
- `GET /api/health` and the startup line: report resolved provider, model and source.
- `web/src/main.tsx`: new `/settings` route.
- `server/src/mcp.ts` `start_lesson`: extended start message.
- `.env.example` and `scripts/doctor.mjs`: documentation and preflight for the secrets file.

</code_context>

<specifics>
## Specific Ideas

- The status pill vocabulary is fixed: `logged in`, `key set`, `set from environment`, `found on port N`, `not configured`.
- The masked field renders dots plus the last four characters, with a Replace action; the API's shape is `{ set: true, hint: 'a1b2' }`.
- The test result line reads like `Connected · 12 models · 340 ms` on success and shows the provider's sentence on failure.
- The header pill reads like `anthropic · claude-opus-5`, or `claude code · terminal model` on an external lesson.
- Unwired rows say teaching on this provider arrives with the next release; they are configurable but not selectable.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. Items already placed elsewhere by the roadmap and noted here so nobody re-opens them in Phase 2:

- Running lessons on API keys, gateways and local models — Phase 3 and Phase 4.
- Per-lesson cost in the header and the usage page — Phase 3 and Phase 4.
- Per-lesson model switching and tiered roles — out of scope for this milestone (PROJECT.md).
- Exposing `DERIVE_EFFORT` in Settings — not raised; stays an environment setting unless a later phase gives a learning reason.

</deferred>

---

*Phase: 02-settings-and-secrets*
*Context gathered: 2026-09-30*
