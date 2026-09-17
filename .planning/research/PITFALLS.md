# Pitfalls Research

**Domain:** Local-first, provider-agnostic agentic AI tutor (Derive) — adding pay-per-use APIs, gateways, local models, more CLI subscriptions, an owned agent loop, cost accounting, a settings page with local keys, per-learner theming, and open-source distribution to an existing Hono + node:sqlite + React 19 app
**Researched:** 2026-09-17
**Confidence:** MEDIUM overall. Provider tool-calling quirks, prompt caching, DNS rebinding and Tailwind 4 theming are corroborated by official docs plus multiple independent issue trackers (MEDIUM-HIGH). Cost/price drift, method-fidelity and docs-drift pitfalls are grounded in this codebase's own map plus community reports (MEDIUM). Anything tagged LOW below is a single web source or my inference from the code.

Phases referenced throughout, in the order PROJECT.md fixes them: **Providers** (owned loop, API/gateway/local/CLI drivers, settings, cost), **Learning UX**, **Personalization** (theme, type, layout, tone), **Adoption** (install, marketplaces, docs).

---

## Critical Pitfalls

Mistakes that cause a rewrite of the provider layer, silently break the method, or leak a learner's key.

### Pitfall 1: One tool schema written for Claude, sent as-is to OpenAI strict mode, Gemini, and llama.cpp

**What goes wrong:**
The 14 tool schemas in `server/src/agent.ts` (`buildTools`) are zod objects with `.optional()` everywhere (`node_id`, `purpose`, `tests`, `depends_on`, `limit`), numeric bounds (`z.number().int().min(1).max(20)`), `.min(2).max(3)` on arrays, and `.describe()` prose. Converted naively to JSON Schema and sent to:
- **OpenAI strict function calling**: 400 at request time. Strict mode requires `additionalProperties: false` on every object and *every* key listed in `required`; optional keys must become `type: ["string","null"]`; `default`, `minimum`/`maximum`, `minItems`/`maxItems`, `format` are rejected.
- **Gemini**: accepts only an OpenAPI subset (`enum`, `required`, `format`); `anyOf` unsupported on 2.0 Flash; 128-declaration cap; nested depth cap. Zod 4's `z.toJSONSchema` emits `anyOf` for nullable unions and `$ref`/`$defs` for the reused `nodeSchema`, both of which Gemini chokes on.
- **llama.cpp / Ollama**: the schema is rendered into a Jinja template as text; long `.describe()` strings (the `quiz` tool's `purpose` description alone is ~500 chars) blow small context windows and some templates crash on tool-role messages.

Non-strict OpenAI mode "works" but then the model sends `correct: "0"` instead of `[0]` or omits `options`, and the server 500s (CONCERNS: no validation layer on the action route).

**Why it happens:**
The schema was tuned for one consumer (Claude via MCP, which is lenient). Each provider has a different JSON Schema dialect and the differences are only discovered at request time, one provider at a time.

**How to avoid:**
- Define the contract once (`server/src/tools.ts` → `{ name, description, schema }`), and derive **per-provider projections** from it: a `toStrictOpenAI()` that makes every key required with `null` unions and strips bounds, a `toGemini()` that inlines `$ref`s and drops `anyOf`, a `toCompact()` for local models that trims descriptions to one sentence. Validate the *incoming* call with the full zod schema on the server regardless of what projection was sent (so bounds still hold).
- Add a build-time test that runs each projection through a JSON Schema validator configured for that dialect (OpenAI's published strict rules, Gemini's subset) and fails CI on unsupported keywords.
- Keep `nodeSchema` flat enough to inline (no recursion) so `set_plan` survives Gemini's depth and `$defs` limits.

**Warning signs:**
`400 invalid_function_parameters` from OpenAI on the very first turn; Gemini `400 INVALID_ARGUMENT` mentioning `parameters`; local models emitting the tool call as plain text JSON instead of a structured call; the server logging zod/constraint errors that never occurred on the Claude path.

**Phase to address:** Providers — this is the first thing the owned loop must get right, and it is why "consolidate the tool contract" belongs at the start of the milestone, not the end.

---

### Pitfall 2: The owned loop drops provider-specific "must round-trip" state and the second tool turn 400s

**What goes wrong:**
Long agentic sessions (hundreds of steps per lesson) require replaying opaque state the provider hands back:
- **Gemini 3**: every `functionCall` part comes with a `thoughtSignature` (moved from inside `functionCall` to the `Part` level between 2.5 and 3). Gemini 3 enforces it strictly: drop it when rebuilding history and the next request fails with `400 missing thought_signature in functionCall parts` — typically only after several tool uses, so it looks like flakiness.
- **OpenAI Responses API with `store: false`** (the right choice for a local-first app): reasoning items carry `encrypted_content` that must be replayed verbatim or the model loses its chain of thought and quality degrades silently; but most OpenAI-*compatible* endpoints (OpenRouter, LM Studio, llama.cpp, vLLM) implement only Chat Completions, so a Responses-only loop cannot serve gateways at all.
- **Anthropic**: a `tool_use` block without a matching `tool_result` in the next user turn is a 400; an interrupted stream (no `message_stop`) leaves a half-built `tool_use` with truncated `input_json_delta` JSON, and a loop that persists that partial block then 400s on every subsequent request for the rest of the lesson.
- **Parallel tool calls**: Gemini and OpenAI emit several calls in one message and expect *all* results back in one turn, in order. Derive's card tools block on the learner; a loop that awaits `quiz` before returning `node_status`'s result deadlocks or returns results out of order.

**Why it happens:**
A "messages array of `{role, content}`" abstraction is too thin. The Claude Agent SDK and Codex SDK hide all of this today; the owned loop inherits it.

**How to avoid:**
- Persist the provider's **native** message objects per lesson (a `turns` table with `provider`, `raw_json`), not a lossy normalized transcript. Rebuild the request from the native record; normalize only for the event log / UI.
- Implement Chat Completions as the common denominator for every OpenAI-shaped endpoint; add the Responses API as an optional path for `api.openai.com` only, gated on a capability flag.
- On stream abort or interrupt: discard the partial assistant block, or synthesize a `tool_result` with `is_error: true, "interrupted by learner"` for every orphaned `tool_use` id before the next request. Make this a unit test with a fixture stream cut mid-`input_json_delta`.
- Set `parallel_tool_calls: false` / `disable_parallel_tool_use: true` / Gemini `FunctionCallingConfig` where supported; where not, run calls sequentially and collect all results before replying. The card tools already serialize on the learner, so parallelism buys nothing here.

**Warning signs:**
Lessons that work for ~10 turns then die with 400; `thought_signature` in any error; `input: {}` tool calls in the event log; a lesson that cannot be resumed after the learner pressed Stop.

**Phase to address:** Providers. Add a per-provider "resume after interrupt" test to the model-free API suite (`server/test/api.test.ts` style, with a recorded fixture per provider).

---

### Pitfall 3: Ollama silently truncates the system prompt and tools; the tutor "forgets the method" and nobody sees an error

**What goes wrong:**
Ollama's `num_ctx` defaults to 4096 (VRAM-dependent on newer versions; docs disagree with each other). Derive's system prompt is the full method text plus up to 24k chars of inlined material, the library section, the learner profile and 14 verbose tool schemas — comfortably over 4k tokens before the first user turn. When the rendered prompt exceeds `num_ctx`, Ollama **drops messages from the front, with no error and no response field**; the only trace is a debug log line. The method text is the first thing to go. The model then teaches without the gate, never calls `node_status`, and the learner sees a chatty, ungated tutor that "works".

The OpenAI-compatible `/v1/chat/completions` cannot set `num_ctx` per request at all; only the native `/api/chat` `options.num_ctx` can. The `/v1` path also has known streaming tool-call bugs (all `tool_calls` chunks arrive with `index: 0`, so multiple calls collapse into one).

**Why it happens:**
Reusing the OpenAI-compatible driver for Ollama looks free. Local users rarely read Ollama debug logs.

**How to avoid:**
- Drive Ollama through its **native** `/api/chat` with an explicit `options.num_ctx` sized from a token estimate of the assembled prompt (and a floor of 16k), and detect at startup that the running model's `context_length` (from `/api/show`) covers it.
- Compute an estimated prompt-token count before every request on local providers and refuse (with a clear card in the UI) rather than let it truncate: "This model's context (8k) is smaller than this lesson needs (11k). Detach material or pick a larger model."
- Keep a compact prompt projection for local models (shorter tool descriptions, material outline only) but never remove the gate instructions; PROJECT.md says a weak model may teach worse, not differently.
- Same check for LM Studio and llama.cpp (`/props` exposes `n_ctx`; verify the loaded `chat_template` supports tools and start with `--jinja`).

**Warning signs:**
Local lessons where `set_phase` is never called, no `node_status` events, or the model answers the quiz itself in prose; `turn_end` with ok but zero tool calls; usage `prompt_eval_count` far below the estimated prompt size.

**Phase to address:** Providers (local-model driver). Also a Learning UX concern: surface "the model cannot hold this lesson" as a first-class message.

---

### Pitfall 4: Method fidelity quietly forks per provider because the prompt was tuned for Claude

**What goes wrong:**
`server/src/prompt.ts` names Claude Code tools by name (`WebSearch` / `WebFetch` vs Codex `web_search`), leans on Claude's tolerance for long imperative sections, and assumes the model reads tool-result `instruction` fields as commands. Weaker or differently-trained models: ignore `refused: true` results and retry the same call in a loop; call `quiz` before teaching (the `teachingGap` gate only fires on the external path); skip `tests:` so derived nodes never lock; write `label`s with formulas; call `node_status(locked)` on every node at once. The fix that tempts is "add a Gemini-specific paragraph", then an "Ollama paragraph", and within a month the method text has forked four ways and drifts exactly like `prompt.ts` vs `plugin/skills/teach/SKILL.md` already has.

**Why it happens:**
Prompts encode model-specific habits invisibly. There is no model-free measurement of "did the tutor follow the method", so drift is only noticed by eye.

**How to avoid:**
- One method text, assembled from sections, with a tiny provider-neutral glossary substituted (`{web_search_tool}`), never per-provider method paragraphs. Treat every provider-specific instruction as a bug report against the *server-side enforcement*: if a model skips `tests`, make the server default or refuse it (`actions.ts`), not the prompt.
- Build a **method-conformance harness** before adding the third provider: replay a fixed lesson script (probe → plan → teach 3 nodes → goal → cumulative) against each provider with a scripted learner, and assert on the event log: phases in order, ≥1 pretest per node, no `locked` without an intuition/transfer pass, cumulative quiz present, no tool call rejected more than N times. Run it nightly, not in CI (it costs money and minutes).
- Record the rejection rate per tool per provider (`refused`/validation errors ÷ calls) as a metric on the usage page; a provider whose rate jumps is the early warning.

**Warning signs:**
Provider-specific `if (backend === 'gemini')` branches in `prompt.ts`; a growing "tips for model X" section; lesson transcripts where the same refused call repeats 3+ times; nodes locked with only `procedure` quizzes.

**Phase to address:** Providers (harness + consolidation), revisited in Learning UX (method quality work must run the harness on every provider, not just Claude).

---

### Pitfall 5: Keys leak through the four exits Derive already has: logs, `turn_end.error`, the Obsidian mirror, and exports

**What goes wrong:**
Adding provider keys to a system that today has none opens leak paths that already exist for error text:
- `agent.ts` / `codex.ts` put raw `err.message` into `turn_end { error }` events, which are **persisted in SQLite**, streamed to the browser, and rendered by `export.ts` into the Obsidian vault. Provider SDK errors can include the request URL with `?key=` (Gemini's REST API puts the key in a query string), `Authorization` headers echoed by misconfigured OpenAI-compatible proxies, or the full request config when a fetch wrapper logs on failure.
- `console.error('[turn]', e)` on a caught SDK error dumps the whole error object, headers included, to the terminal, which users paste into GitHub issues.
- A settings page that round-trips the key through `GET /api/settings` (to show "configured") sends the full key to the browser, where it sits in React state, devtools, and any `window`-level error reporter.
- `.env` at the repo root is gitignored, but `~/.derive` is where users are told their data lives; a "backup your `~/.derive` folder" instruction, a lesson export, or the release tarball's `docs` copy step can carry `derive.db` (with keys) along.
- The `/api/materials/repo` route can ingest `~/.derive` itself or any folder containing `.env`, `credentials`, `auth.json` (CONCERNS lists the missing deny-list), storing keys as course material readable by the model and any page on localhost.

**Why it happens:**
Error paths were designed for subscription logins where nothing secret exists. Keys arrive after the plumbing.

**How to avoid:**
- Introduce a `redact(text)` applied at **one chokepoint**: `endTurn` / `emit` for any `error` field, `console.*` wrappers, and `mcp.ts` `api()` error rethrow. Redact by pattern (`sk-`, `sk-ant-`, `AIza`, `sk-or-`, `ghp_`, `Bearer …`, `key=` query params) *and* by value (every configured key's literal string, and its last-8 fingerprint-only form).
- Store keys outside the lesson database: a separate `~/.derive/secrets.json` with mode 0600 (or the OS keychain when available via an optional dependency; on Linux the fallback is plaintext anyway, so document it plainly). Never return a key from the API; return `{ provider, model, key_hint: "…4f2a", configured: true }`.
- Pass Gemini keys in the `x-goog-api-key` header, never the query string.
- Add `~/.derive`, `.env*`, `credentials*`, `auth.json`, `*.pem`, `*.key`, `.netrc`, `.npmrc` to a deny-list in `repo.ts` `fromDirectory`, and refuse `source` paths inside `DATA_DIR`.
- Never write `turn_end.error` into the vault mirror; render errors as a fixed "the turn failed" line in Markdown.

**Warning signs:**
Any `error` payload in the `events` table longer than ~200 chars; a `grep -r "sk-" ~/.derive` returning hits outside `secrets.json`; screenshots in issues showing `Authorization`.

**Phase to address:** Providers (settings + secrets storage + redaction chokepoint land in the same phase as the first API-key driver; do not ship a key field without the redactor).

---

### Pitfall 6: A localhost server that now holds keys, bound to all interfaces with CORS `*` and no Host check

**What goes wrong:**
Today `index.ts` serves on all interfaces (`serve({ port })`, no `hostname`) with `cors({ origin: '*' })` on `/api/*` and no auth (CONCERNS). That was already an arbitrary-file-read and SSRF problem; with keys it becomes a key-exfiltration and bill-running problem. Two attack shapes:
1. **Any open tab** can `fetch('http://localhost:4310/api/lessons', …)` and start lessons on the learner's paid key, read their whole learning record, or call `/api/settings`. CORS `*` makes the response readable; even without CORS, a POST still executes.
2. **DNS rebinding** makes the browser an unauthenticated proxy for local services even with a strict CORS policy. Ollama shipped CVE-2024-28224 for exactly this; the 2026 NemoClaw advisory shows it still bites when a wrapper binds Ollama to `0.0.0.0`, which disables its loopback Host-header check. A Derive install that tells users to set `OLLAMA_HOST=0.0.0.0` to "make it work from Docker" recreates that CVE on their machine.

Also: `plugin/.mcp.json` and `mcp.ts` default to `http://localhost:4310`; browsers now treat `localhost` and `127.0.0.1` as different origins, so a strict CORS allowlist must include both, plus the Vite dev origin `:5173`.

**Why it happens:**
"It's only on my laptop." The security posture was fine for a single trusted user with no secrets.

**How to avoid:**
- Bind `127.0.0.1` by default; require an explicit `DERIVE_HOST=0.0.0.0` with a startup warning.
- Validate the `Host` header against `{localhost, 127.0.0.1, [::1]}:PORT` on every request (Hono middleware, ~10 lines); reject others with 403. This defeats rebinding regardless of bind address.
- Replace `origin: '*'` with an allowlist: same-origin, `http://localhost:5173`, `http://127.0.0.1:5173`.
- Per-install bearer token in `~/.derive/token`, sent by the web app (fetched once from a same-origin bootstrap endpoint that only the served SPA can read), by `mcp.ts`, and by the plugin hook. Require it on every mutating route and on `/api/settings`.
- Never tell users to bind Ollama/LM Studio/llama.cpp to `0.0.0.0`; Derive talks to them on loopback.

**Warning signs:**
`serve({ port })` without `hostname`; `origin: '*'`; docs that mention `0.0.0.0`; the web app reading a token from `localStorage` set by hand.

**Phase to address:** Providers (must land before the settings page stores its first key). The Host-header and bind change are small and can go first.

---

### Pitfall 7: Cost accounting that is wrong in ways the learner cannot see

**What goes wrong:**
Several independent errors compound into a number the learner trusts:
- **Price-table drift**: a hard-coded `{model: $/Mtok}` map is stale the week a model launches or reprices; Opus 4.7 shipped a new tokenizer that changed effective cost per character even at the same list price. Cached-read, cache-write, reasoning-output and batch tiers each have their own price; forgetting cache-write (1.25× input on Anthropic) or reasoning tokens (billed as output, sometimes invisible in the response) underestimates by 20–40% on an agentic lesson.
- **Usage-shape drift**: Anthropic reports `cache_creation_input_tokens` / `cache_read_input_tokens`; OpenAI reports `prompt_tokens_details.cached_tokens` and `completion_tokens_details.reasoning_tokens`; Gemini reports `promptTokenCount` / `candidatesTokenCount` / `thoughtsTokenCount` / `cachedContentTokenCount`; OpenRouter returns a `cost` field in its native usage object and `cache_write_tokens` only for explicit-cache models (the old `usage: {include: true}` flag is now deprecated and ignored). Mapping all of these to one `{input, output}` pair loses the expensive parts.
- **Subscription paths show a fake cost**: the Claude Agent SDK returns `total_cost_usd` even on a Claude Code login where nothing is billed per token; the UI already stores it as `lastCost` (`useLesson.ts`). A learner on a subscription sees "$1.42" and thinks they were charged.
- **Local models show $0 and hide the real constraint** (time, context), so the usage page tells them nothing useful.
- **Estimation before the turn** uses the wrong tokenizer (tiktoken for Claude, char/4 for Gemini) and is off by 30%+; users then set budgets on it.

**Why it happens:**
Cost is bolted on as a display feature after the loop works. Each provider's usage object is read once, by hand, for the happy path.

**How to avoid:**
- Persist **raw usage per turn** (`turn_usage` table: provider, model, the provider's usage object verbatim, plus normalized columns `input`, `output`, `cache_read`, `cache_write`, `reasoning`). Compute cost at read time from a price table, so a price fix retroactively corrects history.
- Ship the price table as a versioned JSON in the repo, seeded from a maintained public source (LiteLLM's `model_prices_and_context_window.json` or simonw's `llm-prices`), with a `priced_at` date shown on the usage page ("prices as of 2026-09-01; edit `~/.derive/prices.json` to override"). Prefer the provider's own cost when it gives one (OpenRouter `usage.cost`).
- Label every number: **billed** (provider-reported cost), **estimated** (table-derived), **not billed** (subscription and local paths; show tokens and elapsed time instead of dollars). Hide `cost_usd` from `turn_end` on subscription backends.
- Show unknown-price models as "price unknown" rather than $0.

**Warning signs:**
A `PRICES` constant in TypeScript; `cost_usd` on Claude Code lessons; usage page totals that never include a `cache_write` column; totals that disagree with the provider dashboard by more than 10%.

**Phase to address:** Providers (usage capture in the loop from day one) with the page itself in the same phase; Learning UX may later show per-lesson cost in the lesson header.

---

### Pitfall 8: The refactor breaks the Claude Code plugin and Codex path while nobody is running them

**What goes wrong:**
The consolidation touches every file the terminal paths depend on: `mcp.ts` (tool registration), `index.ts` (the action switch the MCP proxy hits), `prompt.ts` (which `SKILL.md` paraphrases), `tools.ts` (`DERIVE_TOOL_NAMES` which the Codex backend feeds to `enabled_tools` and `plugin/commands/*.md` list under `allowed-tools` with the `mcp__plugin_derive_derive__` prefix). Renaming a tool, changing an argument name, or making a field required breaks: the plugin's `allowed-tools` (Claude Code silently prompts for permission or blocks), the Codex `enabled_tools` list, `plugin/hooks/mirror.mjs` (reads `active.held`), the `openai.yaml` dependency declarations. None of these are exercised by `pnpm test`; CONCERNS rates driver coverage "High priority, untested".

Additionally the plugin ships with `server/dist/mcp.js` resolved via `${CLAUDE_PLUGIN_ROOT}/../server/dist/mcp.js` — a relative escape from the plugin root that is valid for a clone but breaks under a marketplace install where the plugin is copied into `~/.claude/plugins/…` alone.

**Why it happens:**
The author runs the app path day to day; terminal paths regress unnoticed until a user reports.

**How to avoid:**
- Before touching the contract, snapshot the current wire surface: dump every MCP tool's name + JSON Schema (`mcp.ts`) and the action route's accepted bodies into a fixture; a test asserts the new shared module reproduces them byte-for-byte (or lists the intentional diffs).
- Generate the four consumer lists from `tools.ts`: `allowed-tools` frontmatter in `plugin/commands/*.md`, `enabled_tools` in `codex.ts`, `openai.yaml` dependencies, and the MCP registrations. A `pnpm gen` step plus a CI check that generated files are unchanged.
- Add a driver smoke test that spawns `server/dist/mcp.js` over stdio, calls `tools/list`, `start_lesson`, `quiz` (held), `answer`, `end_lesson` against the test server. No model needed; ~50 lines with `@modelcontextprotocol/sdk` client.
- Decide the plugin's dependency story before the marketplace phase: either the plugin bundles a built `mcp.js` under its own root, or `.mcp.json` runs `npx derive-mcp@x.y` (see Pitfall 14). `../server/dist` cannot survive a marketplace install.

**Warning signs:**
Claude Code asking permission for a `mcp__plugin_derive_derive__*` tool it never asked about before; Codex "unknown tool" in `enabled_tools`; a `teach` skill that names an argument the schema no longer has.

**Phase to address:** Providers (contract consolidation) with the plugin-root fix in Adoption.

---

### Pitfall 9: SQLite migrations by `ALTER TABLE ... ADD COLUMN` in try/catch cannot express what this milestone needs

**What goes wrong:**
`db.ts` migrates with a list of `ALTER TABLE ADD COLUMN` inside `try {} catch {}` and no version marker. This milestone needs new tables (`settings`, `secrets` or a pointer to them, `turn_usage`, `provider_turns`/native transcripts, `prompts` for restart-safe cards), new columns with backfills (`lessons.provider`, `lessons.model`, `learners.theme`), and at least one shape change (session identity moves from `lessons.session_id` = SDK session to a per-provider conversation handle). Problems with the current pattern:
- `catch {}` swallows *every* error, including "database is locked" and "disk I/O", so a failed migration looks like "column exists" and the app runs against a half-migrated schema.
- No `PRAGMA user_version` means no way to know what a given `derive.db` has; a downgrade (user checks out an older tag) runs against columns it does not know but does not fail loudly.
- `replaceGraph` / `deleteLesson` are already non-transactional; a migration that copies rows is worse.
- `busy_timeout` is unset, so the MCP subprocess (Codex backend spawns `mcp.js` per turn) hitting the DB during a migration gets `SQLITE_BUSY`.
- Existing rows: `cost_usd` was written into `turn_end` payloads as JSON; the new usage table must not double-count those when the usage page sums history.

**Why it happens:**
The additive-column pattern was enough for eight small changes; it has no notion of ordering, atomicity or version.

**How to avoid:**
- Introduce a numbered migration runner now: `PRAGMA user_version`, an array of `{ version, up(db) }`, each run inside `BEGIN IMMEDIATE … COMMIT`, with the existing ALTER list re-expressed as migration 1 that checks `pragma_table_info` instead of catching. Set `PRAGMA busy_timeout = 5000`.
- Refuse to open a database whose `user_version` is *newer* than the code knows, with a message naming the version.
- Back up `derive.db` to `derive.db.bak-<version>` before any migration that touches more than one table; document it.
- Add the `withTx` helper CONCERNS asks for and use it for `replaceGraph`, `deleteLesson`, and every new multi-statement write.
- Test: a fixture `derive.db` from the current release checked into `server/test/fixtures`, migrated in CI, then the API suite runs against it.

**Warning signs:**
Any `catch {}` around DDL; `user_version` still 0 after this milestone; the test suite only ever running against a fresh database.

**Phase to address:** Providers (first phase that adds tables). The runner is a prerequisite, not a cleanup.

---

## Moderate Pitfalls

### Pitfall 10: Prompt caching turned on, then invalidated every turn by the loop itself

**What goes wrong:**
On Anthropic the cache prefix is `tools → system → messages`, and any byte change in tools invalidates everything after. Derive's assembled system prompt already changes per turn: `materialsSection` re-renders outlines, `librarySection` ranks by topic, `learnerProfile` includes memory facts the model just wrote with `remember`, and `notices` are prepended to the user turn. Cache breakpoints placed after the system prompt then miss on every turn, and the learner pays cache-*write* price (1.25×) each time with zero hits, i.e. more than with caching off. The 20-block lookback also silently misses when a single turn adds more than 20 content blocks (a teach turn with several tool calls does).

**How to avoid:**
Split the prompt into a stable prefix (method text + tool definitions, byte-identical across turns; no timestamps, no "today is") and a volatile suffix (material, library, profile, notices) that goes after the breakpoint or into the first user message. Place breakpoints on tools and on the stable system part only. Log `cache_read_input_tokens` per turn; if it is 0 on turn 3+, caching is broken. OpenAI and Gemini cache automatically on prefix match, so the same stable-prefix discipline pays there too.

**Phase to address:** Providers.

---

### Pitfall 11: Rate limits and overloads handled as fatal turn errors

**What goes wrong:**
Today a turn failure ends the turn with `turn_end {ok:false, error}` and the learner sees a red line. On API keys, 429 (with `retry-after`) and Anthropic 529 (`overloaded_error`, capacity not usage) are routine on a long lesson; OpenRouter surfaces upstream 429s/502s from whichever provider it routed to. SDK default retries (a few attempts, ~30 s ceiling) are exhausted on a busy evening, and a lesson dies mid-node. Worse, a retry that re-sends a request after a *partial* stream double-executes side-effecting tools (`remember`, `node_status`) unless the loop is idempotent.

**How to avoid:**
Retry inside the owned loop with honor-`retry-after`-plus-jitter, exponential backoff capped around 60 s, and a visible status card ("Provider busy, retrying in 12 s") via `emitEphemeral('status')`. Retry the *request*, never a turn that already emitted tool calls; make tool execution idempotent by `tool_use_id` (dedupe table). Distinguish 401/403 (bad key: stop, tell the learner to open settings), 429/529/5xx (retry), 400 (schema/state bug: stop, log redacted). Persist enough to resume the turn after restart.

**Phase to address:** Providers.

---

### Pitfall 12: Streaming interruption and the event log's partial-block contract

**What goes wrong:**
`agent.ts` emits an `assistant` block with `partial: true`, deltas as ephemeral events, checkpoints every 1.5 s, and `emitUpdate` at block end. The owned loop must reproduce exactly this contract or the reducer (`useLesson.ts` `applyEvent`) and the vault mirror break: a provider that delivers text whole (Codex-style), one that interleaves text and tool-call deltas (OpenAI), and one that emits `thinking` blocks (Anthropic extended thinking, Gemini thoughts) each need mapping. Known failure: persisting a block whose text later *shrinks* (a retry after a cut stream re-emits from the start) leaves duplicate prose in the lesson and the Obsidian note.

**How to avoid:**
Put the streaming-to-events adapter in one module with a provider-neutral input (`text_delta`, `tool_call_start/delta/end`, `thinking_delta`, `usage`, `done`) and unit-test it with recorded fixtures from each provider (including an abort mid-block). Never expose thinking text as `assistant` prose. On retry after a cut stream, `emitUpdate` the same seq rather than emitting a new block.

**Phase to address:** Providers; a reducer test (`applyEvent` is pure) belongs in Learning UX's "less waiting, clearer cards" work.

---

### Pitfall 13: Web search parity is faked or forgotten on non-CLI providers

**What goes wrong:**
The method text tells the model to "verify the topic's real first principles (use WebSearch if in any doubt)" and the `verified` counter in `agent.ts` feeds `turn_end`. On API keys there is no `WebSearch`; Anthropic has a server-side web search tool (billed per search), OpenAI has `web_search` on the Responses API only, Gemini has grounding, OpenRouter has a `:online` suffix / plugin, local models have nothing. If the owned loop simply omits a search tool, the model either hallucinates a verification ("I've checked…") or calls a tool that does not exist and the turn errors. If Derive adds a `web_search` tool backed by a search API (Brave, Tavily, Exa, SearXNG), that is another key with its own cost and its own leak path, and the "offline local model" promise silently becomes online.

**How to avoid:**
Make web search a declared provider capability: use the native tool where the provider has one, Derive's pluggable `web_search`/`fetch_page` tools (built on the existing `library.ts` fetcher for the fetch half) where it does not, and an explicit `none` mode in which the method text's verification sentence is replaced by "no web access in this session; say so when unsure." Show the mode on the settings page. Count searches per lesson in usage. Keep the SSRF guard from CONCERNS in front of any fetch tool.

**Phase to address:** Providers.

---

### Pitfall 14: An npx runner that fails on Node version, `node:sqlite`, or the vendored Codex binary

**What goes wrong:**
`node:sqlite` needs Node ≥ 22.5 and prints an `ExperimentalWarning`; on Node 20 LTS the import throws before any friendly message. `npx derive` on a machine with a different default Node than the one that populated the npx cache is fine for `node:sqlite` (no ABI) but breaks the moment a native addon (a keychain library, `better-sqlite3` if ever swapped in) enters `dependencies`. `@openai/codex-sdk` pulls a platform-specific vendored binary (`@openai/codex-<os>-<arch>`) that is resolved by path-guessing (`backend.ts`); under npx's flat temporary install that layout is not guaranteed, and Windows needs `codex.exe`. `pnpm.onlyBuiltDependencies` is pnpm-only; npx uses npm and will run postinstall scripts nobody vetted. The server's static serving depends on `process.cwd()` (CONCERNS), so `npx derive` from any directory serves no assets.

**How to avoid:**
Put a plain-JS version gate at the top of the bin (`process.versions.node` compare, print the install link, exit 1) before any `import`. Filter only the sqlite `ExperimentalWarning` by class and message. Make `codex-sdk`, keychain, and any native addon **optional** peer/optional dependencies, resolved lazily with a clear "run `npm i -g @openai/codex` to use the Codex backend" message. Resolve `web/dist` from `import.meta.url`, never cwd. Test the runner in CI on a matrix (Node 22, 24; macOS, Linux, Windows) with `npm exec` from a temp directory, not just `pnpm start` from the repo root. Publish with `files` allow-listed so `.env`, fixtures and `docs/*.png` do not ship.

**Phase to address:** Adoption.

---

### Pitfall 15: Plugin marketplace manifest and layout mistakes

**What goes wrong:**
Claude Code marketplaces need `.claude-plugin/marketplace.json` at the *marketplace repo root* with `name`, `owner`, `plugins[]` (each with `source`); the plugin itself needs `<plugin>/.claude-plugin/plugin.json` and auto-discovers `commands/`, `agents/`, `skills/`, `hooks/hooks.json`, `.mcp.json` relative to the plugin root. Derive's `plugin/.mcp.json` points at `${CLAUDE_PLUGIN_ROOT}/../server/dist/mcp.js`: an escape above the plugin root that a marketplace install (which copies only the plugin directory) cannot satisfy. Version strings are already out of sync in six places (CONCERNS); the marketplace shows `plugin.json`'s `0.4.0` while `package.json` says `0.1.0`. Codex's distribution layer is now plugins (bundling skills, MCP config, connectors) rather than bare skill folders, and `codex/skills/*` have `openai.yaml` but no `SKILL.md`, so the Codex install carries no method text.

**How to avoid:**
Make the plugin self-contained: bundle a built `mcp.js` (single-file esbuild output) inside `plugin/bin/`, or have `.mcp.json` invoke `npx -y derive-mcp@<version>`. One version source (`server/package.json`) stamped into `plugin.json`, `marketplace.json`, `/api/health`, MCP `serverInfo`, and the user-agent at build/release time. Generate `codex/skills/*/SKILL.md` from the same method source as `plugin/skills/teach/SKILL.md`. Validate manifests in CI with `claude plugin validate` (or a JSON-schema check) and test-install from a local marketplace path before tagging.

**Phase to address:** Adoption.

---

### Pitfall 16: Tailwind 4 theming done with `@theme inline` or per-component variables

**What goes wrong:**
`web/src/index.css` defines the palette in a single `@theme {}` block with literal hex values and a hard dark background on `body`. Per-learner theming (light/dark/system + accent palettes) needs runtime switching; the common mistakes:
- Using `@theme inline` for the tokens: values are baked into utilities at build time, so toggling `[data-theme]` changes nothing.
- Tokens that reference other variables (`--color-accent: var(--color-gold-500)`) resolve once; overriding `--color-gold-500` at runtime does not update `--color-accent`.
- Not declaring `@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *))`, so `dark:` utilities follow `prefers-color-scheme` and fight the learner's explicit choice.
- Scoping variables per component or per route instead of on `<html>`, so the graph (`@xyflow/react` uses its own CSS variables), Mermaid (initialised with `themeVariables` literal hex in `Markdown.tsx`) and KaTeX render in the old palette.
- **FOUC**: the theme is read from `localStorage` in React after mount, so every load flashes the default dark palette; system-theme users see a flash on every navigation. Fonts from Google Fonts (`index.html`) add a second flash and mean the "offline local model" install phones Google on every page load.
- Contrast: accent palettes chosen by eye fail WCAG AA for body text on the paper-toned `ink-50`; the teal/gold accents are fine as highlights and fail as text.

**How to avoid:**
Raw values on `:root` and `[data-theme=…]` / `[data-accent=…]` selectors, mapped once through a non-inline `@theme` so utilities reference `var(--color-…)`; an inline `<script>` in `index.html` that sets `data-theme` from `localStorage` before paint; `color-scheme` on `html`; self-host fonts with `font-display: swap` and drop the Google Fonts links. Feed Mermaid and xyflow the same variables via `getComputedStyle`. Automate contrast: a unit test over each palette's (text, bg) pairs with a contrast-ratio function, gate at 4.5:1 for body text.

**Phase to address:** Personalization (fonts self-hosting could move to Adoption's offline install story, but it is one change; do it once).

---

### Pitfall 17: Dyslexia-friendly typography: licensing is fine, the implementation is where it fails

**What goes wrong:**
OpenDyslexic, Atkinson Hyperlegible and Lexend are all SIL OFL 1.1: self-hosting, bundling and commercial use are permitted (LOW: single-source check per font; the OFL itself is unambiguous). The real pitfalls are: OFL forbids selling the fonts *alone* and requires renaming if modified (do not subset-and-rename without the Reserved Font Name rules in mind; subsetting for web is fine if the name is kept); loading a dyslexia font only on `body` while KaTeX, Mermaid labels and the graph nodes keep the default face; letting the font change alter card heights so the pending card jumps; font-size preference implemented as a `zoom` or root `font-size` that breaks the fixed-height graph panel and the voice-mode status bar; and not exposing line-height / letter-spacing / max line length, which matter more for dyslexic readers than the typeface.

**How to avoid:**
Bundle the OFL fonts with their license files in `web/public/fonts`, keep original family names, and apply the choice through the same root variables (`--font-sans`, `--font-serif`, `--font-mono`) so every consumer follows. Expose a small set: family, size step, line-height, measure. Snapshot a lesson page per preset in a browser test to catch layout jumps.

**Phase to address:** Personalization.

---

### Pitfall 18: Voice-mode regressions from theming, tone and provider work

**What goes wrong:**
`voice.ts` picks a `SpeechSynthesisVoice` by `navigator.language` with a name heuristic, caches it, and re-resolves on `voiceschanged`; `useVoiceMode.ts` has a suppressed `exhaustive-deps` lint and zero tests. Changes in this milestone that break it silently:
- Per-learner *language* (tone/preferences) not wired into `voiceLang()`: a Spanish learner hears English TTS; `SpeechRecognition.lang` mis-set means dictation transcribes Spanish as English gibberish.
- Chrome cancels utterances after ~15 s (~200–250 chars); a "chatty" tone preference makes every card longer and every read-aloud truncated.
- `getVoices()` is empty on first call in Chrome; a settings page that lists voices before `voiceschanged` shows nothing.
- Browser `SpeechRecognition` sends audio to Google's servers (Chrome) — the "local model, offline, nothing leaves the machine" claim is false while voice mode is on, and the settings page must say so.
- Streaming adapters that emit prose in different chunk sizes (whole-message vs token) change when `speak()` fires; a provider that emits thinking as text gets read aloud.

**How to avoid:**
Derive `voiceLang()` from learner prefs first, `navigator.language` second; chunk utterances at sentence boundaries under ~200 chars; populate the voice list inside the `voiceschanged` handler; label voice mode's privacy on the settings page and disable it by default on local-model setups until acknowledged; add a `voice.test.ts` for `parseSpokenChoice`/`spokenQuiz` (pure) and a fixture-driven test that the speak queue only sees final `assistant` blocks.

**Phase to address:** Learning UX ("better voice mode") with a regression check in Personalization when tone/language ship.

---

### Pitfall 19: Restart-safe sessions become provider-specific

**What goes wrong:**
`lessons.session_id` today means "Claude Agent SDK session" or "Codex thread". The owned loop has no server-side session; resumption means replaying the native transcript (Pitfall 2). If the new drivers overload `session_id` with different meanings (an OpenAI `previous_response_id`, a Gemini cached-content name, a Copilot SDK session), then switching provider mid-lesson (allowed at the install level in this milestone) or upgrading Derive leaves lessons that cannot resume, and the boot-time "server restarted" patch in `index.ts` marks them dead. Pending/held cards already vanish on restart (CONCERNS); with API keys that also means a paid turn was lost.

**How to avoid:**
Model `provider_session` as `{ provider, kind, handle }` JSON, and make "resume" a provider capability with a fallback: rebuild from the native transcript when the handle is stale. Persist open prompts (`prompts` table) so a held quiz survives restart and the resumed turn can continue instead of re-asking (and re-paying).

**Phase to address:** Providers.

---

### Pitfall 20: CLI-subscription drivers (Gemini CLI, Copilot) treated as if they were the Claude Agent SDK

**What goes wrong:**
Gemini CLI headless mode is `-p`/`--prompt` with `--output-format json` and MCP servers configured from settings files; it does not expose the in-process tool registration or the stream-event shapes the Claude SDK does, and its non-interactive mode auto-approves nothing without `--yolo`. The Copilot SDK (technical preview) talks JSON-RPC to the Copilot CLI in server mode and has a published CLI/SDK compatibility matrix; a mismatched CLI version fails at handshake. Both re-introduce the Codex-style "spawn `mcp.js` per turn, mirror prose from a log" pattern that CONCERNS already flags as fragile (60 s startup timeouts, session-log grepping). Copy-pasting `codex.ts` per CLI multiplies that fragility by three. Also: ToS for some subscription CLIs restrict automated/programmatic use; Gemini CLI's free tier has daily request caps that a 300-step lesson will hit.

**How to avoid:**
One "external CLI driver" abstraction with a per-CLI adapter (spawn args, how to attach the MCP server, how prose is delivered back), sharing the MCP-over-HTTP path that already exists; pin each CLI's minimum version and check at startup; degrade to "not available" with the install command rather than a stack trace. Check quotas: read the CLI's rate-limit error and surface it as a status card. Treat these drivers as lower-priority than API keys and gateways, which the owned loop serves directly.

**Phase to address:** Providers (after the owned loop, since the owned loop plus an OpenAI-compatible endpoint covers most of what these CLIs give).

---

## Minor Pitfalls

### Pitfall 21: OpenRouter's "one endpoint" hides per-upstream tool parsers

The same model id on OpenRouter is served by several upstreams with different quantization and tool-call parsers; tool calls occasionally arrive as raw XML/markup in the text. Pin `provider.order` / `allow_fallbacks: false` in the settings page as an advanced option, detect text that looks like a tool call (`<tool_call>`, `{"name":`) and treat it as a parse failure with one retry, and read `usage.cost` rather than computing it.

**Phase:** Providers.

### Pitfall 22: llama.cpp / LM Studio started without tool support

`llama-server` needs `--jinja` and a tool-capable `chat_template` (check `/props`); `parallel_tool_calls` is off by default (good for Derive); some builds return `arguments` as an object instead of a string. Probe `/props` (llama.cpp) or `/v1/models` (LM Studio) at settings time and show "this server / model does not report tool support" before the first lesson.

**Phase:** Providers.

### Pitfall 23: Token estimates from the wrong tokenizer

Using `tiktoken` for Claude or Gemini overestimates by up to 30%. Use the provider's count endpoint where cheap (Anthropic `count_tokens`, Gemini `countTokens`), `tiktoken` for OpenAI, and a chars/3.5 heuristic for local models labelled "≈".

**Phase:** Providers.

### Pitfall 24: Settings page stores provider config per install but learners are per install too

PROJECT.md leaves "per install or per learner" open. Storing keys per learner multiplies leak surface and confuses the "which learner am I" fallback bug (CONCERNS: unknown learner silently becomes `default`). Store provider+key per **install**, allow an optional per-learner model override, and never a per-learner key.

**Phase:** Providers.

### Pitfall 25: Docs that drift from the code, on day one

README already documents `DERIVE_MODEL` and `.env` settings that the settings page will supersede; `mcp.ts` documents a `pnpm codex:setup` that does not exist; the health endpoint reports a version that matches nothing. A docs site copies these. Prevent with: generate the settings reference from `config.ts` (a `describe` per setting), generate the tool reference from `tools.ts`, run README code blocks in CI where cheap (`pnpm check`, the install one-liner in a container), and keep screenshots out of the docs until the theme work lands (they will all be stale).

**Phase:** Adoption.

### Pitfall 26: `@anthropic-ai/claude-agent-sdk` pinned to `latest`

Any local `pnpm install` can jump majors and change the stream-event shapes the adapter reads. Pin a caret range before writing the adapter tests (they will otherwise pin to whatever version happened to be installed).

**Phase:** Providers (first commit).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Reuse the OpenAI-compatible driver for Ollama / LM Studio / llama.cpp | One driver instead of three | Silent context truncation, streaming tool-call index bugs, no `num_ctx` control | Never for Ollama; acceptable for LM Studio/llama.cpp only with a `/props`/`/v1/models` capability probe |
| Per-provider paragraphs in the method text | Fixes a model's bad habit today | The method forks and drifts; parity claim becomes false | Never; enforce server-side instead |
| Compute cost in the loop and write `cost_usd` into `turn_end` | Zero schema work | Price fixes cannot correct history; subscription paths show fake dollars | Never; persist raw usage, price at read time |
| Store keys in `derive.db` | One file, one backup | Every export/backup/repo-ingest path can carry keys | Never |
| Keep `catch {}` migrations and add more ALTERs | Fast | No version, no atomicity, silent half-migrations | Only for the very next release if the runner ships in the same milestone |
| `.mcp.json` → `../server/dist/mcp.js` | Works from a clone | Marketplace installs cannot find the server | Until the marketplace phase, then never |
| Read theme from `localStorage` in React after mount | Simple | FOUC on every load | Never; inline pre-paint script is 6 lines |
| `origin: '*'` CORS "for the Vite dev server" | Dev convenience | Any tab can drive the tutor on the learner's key | Never once keys exist |
| Hand-maintained `allowed-tools` lists in `plugin/commands/*.md` | No codegen | Every tool rename breaks the plugin silently | Never; generate |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Anthropic Messages API | Placing `cache_control` after a system prompt that changes per turn; sending `tool_use` without `tool_result` after an interrupt | Stable prefix (tools + method) before the breakpoint; synthesize error `tool_result`s for orphans; log `cache_read_input_tokens` |
| OpenAI (api.openai.com) | Building the loop on the Responses API only, or on strict mode with optional fields | Chat Completions as the common path; Responses as an optional capability; strict projection with null-unions and no bounds |
| OpenAI-compatible endpoints | Assuming `/v1/responses`, `parallel_tool_calls`, `stream_options`, `response_format` all exist | Probe `/v1/models`; treat every extra parameter as optional; parse `arguments` as string *or* object |
| Gemini API | Dropping `thoughtSignature` on history rebuild; key in the URL query string; `$ref`/`anyOf` in schemas | Persist native `Part`s and replay them; `x-goog-api-key` header; inline schemas |
| OpenRouter | Computing cost from a local table; ignoring provider routing | Use `usage.cost`; expose `provider.order`/`allow_fallbacks`; detect tool calls leaked as text |
| Ollama | `/v1/chat/completions` with default `num_ctx` | Native `/api/chat` with `options.num_ctx` from a prompt estimate; check `/api/show` context length; keep it on loopback |
| llama.cpp `llama-server` | Starting without `--jinja`; expecting parallel tool calls | Check `/props` for `chat_template` tool support; sequential calls only |
| LM Studio | Assuming every loaded model supports tools | Query `/v1/models`; show capability on settings page |
| Gemini CLI | Treating it like an in-process SDK | Headless `-p --output-format json` with MCP config; pin version; expect quota errors |
| Copilot SDK | Ignoring the CLI/SDK compatibility matrix | Pin both; fail at startup with the install command |
| Claude Agent SDK | `"latest"` in package.json | Caret pin matching the lockfile; fixture tests on stream events |
| Claude Code plugin marketplace | Plugin referencing files above its root; versions out of sync | Self-contained plugin (bundled `mcp.js` or `npx derive-mcp@x`); one version source stamped at release |
| Codex plugins | Skills with `openai.yaml` but no `SKILL.md` | Generate `SKILL.md` from the shared method source; ship as a Codex plugin |
| Obsidian vault mirror | Rendering `turn_end.error` and raw tool errors into notes | Fixed error line; redactor at `emit` |
| Web Speech API | Reading `getVoices()` synchronously; ignoring learner language | `voiceschanged` handler; prefs-driven `lang`; sentence chunking under ~200 chars |
| Google Fonts CDN | Loading fonts from `fonts.googleapis.com` in a "local, offline" app | Self-host OFL fonts in `web/public/fonts` |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Rebuilding the full native transcript from the `events` table on every turn | Turn latency grows with lesson length; SQLite JSON parse per turn | Store native provider messages per turn in their own table with `(lesson_id, seq)`; append, do not rebuild | Lessons past ~150 steps, or any lesson with large `read_material` results |
| Sending the whole material outline + library section + profile every turn to a pay-per-use provider with no cache hit | Cost per turn flat instead of dropping; `cache_read` always 0 | Stable prefix discipline (Pitfall 10); move volatile sections after the breakpoint | Immediately on Anthropic; after ~1k tokens on OpenAI/Gemini automatic caching |
| Token estimation by tokenizing the full prompt in JS on every turn | 100–300 ms per turn on 30k-token prompts | Cache counts per section by content hash; heuristic for local models | Long lessons with material attached |
| Cost/usage page summing `turn_end` payload JSON across all lessons | Home/usage page load time grows with history (same shape as the existing `busy()` scan) | `turn_usage` table with an index on `(learner_id, ts)` and an aggregate query | A learner with hundreds of lessons |
| Vault mirror re-rendering the whole lesson on every streamed block (existing) plus per-turn usage events | Disk writes per second during streaming | Raise debounce during a turn, flush on `turn_end`; do not emit usage as events | Any long streamed turn with the vault configured |
| Local model with a 32k window carrying a 24k inlined material section | Every turn near the context ceiling; truncation or refusal | Material outline only for local providers; `read_material` on demand | First lesson with a PDF attached |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Returning the full key from `GET /api/settings` | Key in browser memory, devtools, screenshots | Return `configured` + last-4 hint only; write-only field |
| Keys in `derive.db` | Backups, exports, and `repo` ingestion carry keys | Separate 0600 `secrets.json` (or keychain), never in the lesson DB |
| `error` payloads with raw SDK messages persisted and mirrored | Key or auth header in SQLite, SSE, Obsidian notes, GitHub issues | `redact()` chokepoint at `endTurn`/`emit`/console; pattern + literal-value redaction |
| Gemini key in query string | Appears in every proxy/log line | `x-goog-api-key` header |
| Server on all interfaces, CORS `*`, no Host check | Any tab or LAN host drives the tutor on the learner's key; DNS rebinding | Bind `127.0.0.1`; Host allowlist; origin allowlist; per-install bearer token |
| Telling users to set `OLLAMA_HOST=0.0.0.0` | Recreates CVE-2024-28224 (rebinding) on their machine | Loopback only; document it |
| `web_search` / `fetch_page` tools without the SSRF guard | Model-driven reads of `169.254.169.254`, RFC1918, loopback | Resolve and refuse private ranges, re-check per redirect (CONCERNS) |
| `repo` ingestion of `~/.derive` or dotfiles | Secrets become course material readable by the model and any local page | Deny-list secret-shaped names; refuse paths under `DATA_DIR` |
| Third-party OpenAI-compatible base URL typed by the learner | Key sent to an attacker-controlled host (typosquat) | Show the resolved host on save; warn on non-HTTPS and on hosts that are not loopback |
| Settings page over plain HTTP on a LAN-bound server | Key sniffed on the wire | Loopback-only enforcement makes this moot; refuse to serve `/api/settings` on non-loopback |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Dollar figure on subscription paths (`total_cost_usd` from the Agent SDK) | Learner believes they were charged | Show tokens + time; "not billed on this plan" label |
| $0.00 for local models | Usage page is meaningless | Show tokens, tokens/s, context used vs available |
| Provider errors as red `turn_end` lines mid-node | Learner loses the thread, retries by hand, pays twice | Status card with retry countdown; auto-resume; idempotent tools |
| "Model does not support tools" discovered on the first lesson | Wasted setup | Capability probe on the settings page with a green/amber/red per capability (tools, streaming, web search, context size) |
| Key pasted, no feedback | Learner does not know if it worked | "Test connection" that runs a 1-token request and reports model, context, cost tier |
| Theme applied after mount | Flash on every navigation | Pre-paint inline script; `color-scheme` |
| Accent palette used for body text | Illegible on light theme | Accents for highlights only; contrast test in CI |
| Font size as root `font-size` | Graph panel and cards overflow | Type scale variables; snapshot test per preset |
| "Chatty" tone + voice mode | Read-aloud truncates at ~15 s in Chrome | Sentence chunking; tone affects prose, not card text |
| Voice mode advertised as offline | Chrome sends audio to Google | Say so on the settings page; off by default with local models |
| Install docs with `pnpm`, `node 22.5`, `claude login` as unstated prerequisites | First-run failure | Version gate in the runner with the exact fix; `pnpm check` output in the README verbatim |

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|----------------|------------|
| Providers: tool contract consolidation | Byte-level drift between the old MCP/agent/HTTP surfaces and the new module (Pitfall 8) | Snapshot fixture of current schemas; generated consumer lists; stdio MCP smoke test |
| Providers: owned loop | Lossy normalized transcript; orphaned `tool_use`; parallel-call deadlock; strict-schema 400s (Pitfalls 1, 2) | Native per-provider transcript table; per-provider schema projections with a dialect validator; sequential tool execution; abort fixtures |
| Providers: local models | Silent `num_ctx` truncation; tools unsupported (Pitfalls 3, 22) | Native Ollama API; prompt-size preflight with a refusal card; `/props` and `/v1/models` probes |
| Providers: settings + keys | Key round-tripped to the browser; keys in `derive.db`; error-path leaks; open localhost (Pitfalls 5, 6) | Write-only key field; `secrets.json` 0600; `redact()` chokepoint; bind loopback + Host allowlist + token |
| Providers: cost tracking | Hard-coded prices; missing cache/reasoning columns; fake cost on subscriptions (Pitfall 7) | Raw usage table; versioned price JSON with `priced_at`; billed/estimated/not-billed labels |
| Providers: caching & retries | Cache invalidated every turn; 429/529 kill the lesson; retries double-execute tools (Pitfalls 10, 11) | Stable prefix; retry-after + jitter; idempotency by `tool_use_id` |
| Providers: DB | ALTER-in-try/catch cannot express new tables; no version; no busy timeout (Pitfall 9) | `user_version` migration runner, transactions, backup before migrate, fixture DB in CI |
| Providers: method fidelity | Provider-specific prompt forks (Pitfall 4) | Conformance harness replaying a scripted lesson per provider; enforcement moved server-side |
| Providers: CLI subscriptions | Copy of `codex.ts` per CLI; version and quota surprises (Pitfall 20) | One external-CLI abstraction; pinned versions; quota errors as status cards; lower priority than API paths |
| Learning UX: voice, faster turns | TTS truncation, wrong language, thinking read aloud (Pitfall 18) | Prefs-driven `lang`; sentence chunking; speak only final `assistant` blocks; reducer and voice unit tests |
| Learning UX: method quality | Tuning quizzes/graphs on Claude only | Run the conformance harness on every provider before and after each method change |
| Personalization: theme | `@theme inline`, variable-of-variable, FOUC, contrast, Mermaid/xyflow/KaTeX ignoring the palette (Pitfall 16) | Root-level raw values + non-inline `@theme`; pre-paint script; contrast test; propagate variables to third-party renderers |
| Personalization: typography | Google Fonts CDN in a local-first app; dyslexia font on `body` only; size as root `font-size` (Pitfall 17) | Self-hosted OFL fonts with license files; root font variables; type-scale tokens; layout snapshots |
| Personalization: tone/language | Tone leaking into the method (longer cards, skipped steps); language not reaching voice mode | Tone changes prose register only, enforced by prompt section boundaries; `voiceLang()` from prefs |
| Adoption: npx runner | Node 20 crash before any message; native addon ABI; cwd-relative static assets; Codex binary resolution (Pitfall 14) | Plain-JS version gate; optional native deps; `import.meta.url` paths; CI matrix with `npm exec` from a temp dir |
| Adoption: marketplaces | Plugin references `../server`; version strings out of sync; Codex skills without `SKILL.md` (Pitfall 15) | Self-contained plugin; single version source; generated `SKILL.md`; manifest validation in CI |
| Adoption: docs | Settings/tool docs hand-written and stale; screenshots from the old theme (Pitfall 25) | Generate references from `config.ts` and `tools.ts`; run install snippets in CI; screenshots after the theme phase |

## Sources

Confidence tags: MEDIUM = official docs or multiple independent issue trackers agree; LOW = single community source or inference from this codebase.

**Tool-calling differences across providers**
- OpenAI function calling and strict mode limits — https://developers.openai.com/api/docs/guides/function-calling (MEDIUM); community summaries: https://dsaiztc.com/blog/posts/navigating-openai-json-structured-outputs.html, https://simonwillison.net/2024/Aug/6/openai-structured-outputs/ (MEDIUM, corroborating)
- Gemini function-calling schema subset, 128-declaration cap, parallel calls — https://docs.cloud.google.com/gemini-enterprise-agent-platform/reference/models/function-calling, https://www.philschmid.de/gemini-function-calling (MEDIUM)
- Gemini thought signatures (strict on Gemini 3; moved to `Part`) — https://ai.google.dev/gemini-api/docs/generate-content/thought-signatures (MEDIUM); failures in the wild: https://github.com/block/goose/issues/5792, https://github.com/google/adk-js/issues/149, https://github.com/mlflow/mlflow/issues/25745 (MEDIUM)
- Ollama `num_ctx` default and silent truncation; `/v1` cannot set it — https://multigrid.ai/learn/ollama-default-context-limit, https://github.com/openclaw/openclaw/issues/4028, https://docs.ollama.com/api/openai-compatibility (MEDIUM); streaming `tool_calls` index bug — https://github.com/ollama/ollama/issues/15457 (MEDIUM)
- llama.cpp tool calling (`--jinja`, `parallel_tool_calls`, template requirements) — https://github.com/ggml-org/llama.cpp/blob/master/docs/function-calling.md (MEDIUM); arguments-as-object regression — https://github.com/ggml-org/llama.cpp/issues/20198 (LOW); template crashes on tool roles — https://github.com/anomalyco/opencode/issues/1890, https://github.com/openclaw/openclaw/issues/27406 (LOW)
- OpenRouter per-provider tool parser variance and reasoning-token accounting — https://openrouter.ai/docs/docs/best-practices/reasoning-tokens, https://mmoustafa.com/blog/so-you-want-to-use-openrouter/, https://medium.com/@fhorvat90/i-tested-reasoning-tokens-on-5-llms-via-openrouter-most-models-silently-drop-them-b8071b5d857d (LOW–MEDIUM)
- OpenRouter usage accounting (`usage.cost`, deprecated `usage.include`, `cache_write_tokens`) — https://openrouter.ai/docs/cookbook/administration/usage-accounting (MEDIUM); cache-write underestimation — https://github.com/anomalyco/opencode/issues/18440 (LOW)
- OpenAI Responses API reasoning items / `encrypted_content` / `store: false`; compatible endpoints only speak Chat Completions — https://developers.openai.com/api/docs/guides/reasoning, https://developers.openai.com/cookbook/examples/responses_api/reasoning_items, https://github.com/GD4AI/obsidian-llm-wiki/issues/735 (MEDIUM)
- Vercel AI SDK loop control and leaked provider differences — https://ai-sdk.dev/docs/agents/loop-control, https://github.com/vercel/ai/issues/7261 (LOW)

**Long sessions, caching, retries, streaming**
- Anthropic prompt caching (prefix order, 4 breakpoints, 20-block lookback, write/read pricing) — https://platform.claude.com/docs/en/build-with-claude/prompt-caching, https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-use-with-prompt-caching (MEDIUM); agentic-loop invalidation write-up — https://www.mager.co/blog/2026-04-29-claude-prompt-caching/, https://github.com/copse-dev/agent-pane/issues/1286 (LOW)
- Anthropic 429 vs 529, `retry-after`, backoff — https://www.respan.ai/articles/anthropic-api-rate-limits, https://devopsboys.com/blog/llm-rate-limiting-retry-production-2026 (LOW–MEDIUM)
- Streaming cut mid-`tool_use`, orphaned `tool_use` 400s — https://github.com/anthropics/anthropic-sdk-typescript/issues/842, https://github.com/langchain-ai/langchainjs/issues/9798, https://github.com/openclaw/openclaw/issues/148257 (MEDIUM, multiple trackers)
- Claude Agent SDK sessions and compaction — https://code.claude.com/docs/en/agent-sdk/sessions, https://platform.claude.com/cookbook/tool-use-automatic-context-compaction (MEDIUM)

**Cost tables**
- LiteLLM `model_prices_and_context_window.json` — https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json (MEDIUM); simonw `llm-prices` — https://github.com/simonw/llm-prices (MEDIUM); Opus 4.7 tokenizer change — https://openrouter.ai/blog/insights/opus-47-tokenizer-analysis/ (LOW)

**Secrets and localhost exposure**
- DNS rebinding against local AI servers: Ollama CVE-2024-28224 — https://www.nccgroup.com/research-blog/technical-advisory-ollama-dns-rebinding-attack-cve-2024-28224/ (MEDIUM); NemoClaw 2026 (`0.0.0.0` disables Host check) — https://thehackernews.com/2026/08/a-malicious-webpage-could-poison-your.html, https://github.com/NVIDIA/NemoClaw/pull/10889 (MEDIUM); Jan `0.0.0.0` + CORS reflection — https://github.com/janhq/jan/issues/8453 (LOW)
- Local key storage (keychain vs plaintext; Linux `basic_text` fallback) — https://www.electronjs.org/docs/latest/api/safe-storage, https://github.com/cli/cli/discussions/12488 (MEDIUM)
- Existing exposure in this codebase — `.planning/codebase/CONCERNS.md` (HIGH: read from source)

**Theming and typography**
- Tailwind v4 `@theme` vs `@theme inline`, runtime override, dark variant — https://github.com/tailwindlabs/tailwindcss/discussions/18560, https://github.com/tailwindlabs/tailwindcss/discussions/15609, https://tailwindcss.com/docs/dark-mode (MEDIUM)
- OpenDyslexic and Atkinson Hyperlegible under SIL OFL 1.1 — https://en.wikipedia.org/wiki/OpenDyslexic, https://github.com/googlefonts/atkinson-hyperlegible (MEDIUM)

**Voice mode**
- Chrome ~15 s utterance cutoff; async `getVoices()`; recognition audio sent to Google — https://dev.to/jankapunkt/cross-browser-speech-synthesis-the-hard-way-and-the-easy-way-353, https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API/Using_the_Web_Speech_API, https://github.com/WebAudio/web-speech-api/blob/main/explainers/on-device-speech-recognition.md (MEDIUM)

**Distribution**
- Claude Code plugin marketplaces (manifest location, required fields, auto-discovery) — https://code.claude.com/docs/en/plugin-marketplaces, https://github.com/anthropics/claude-plugins-official/blob/main/.claude-plugin/marketplace.json (MEDIUM)
- Codex skills/plugins (`SKILL.md` + `openai.yaml`; plugins as the distribution layer) — https://developers.openai.com/codex/skills, https://github.com/openai/skills (MEDIUM)
- Gemini CLI headless mode — https://geminicli.com/docs/cli/headless/ (MEDIUM); Copilot SDK preview and CLI compatibility — https://github.com/github/copilot-sdk, https://docs.github.com/en/copilot/how-tos/copilot-sdk/troubleshooting/sdk-and-cli-compatibility (MEDIUM)
- `node:sqlite` ExperimentalWarning, native-addon ABI under npx — https://github.com/nodejs/node/issues/58611, https://github.com/turnlog/turnlog/pull/13, https://dev.to/hex_tracker/no-sqlite-driver-works-in-both-bun-and-node-here-is-how-i-shipped-one-package-that-runs-on-both-20ol (LOW–MEDIUM)

**This codebase** — `.planning/PROJECT.md`, `.planning/codebase/CONCERNS.md`, `.planning/codebase/ARCHITECTURE.md`, and direct reads of `server/src/{agent,codex,backend,config,db,export,mcp}.ts`, `web/src/index.css`, `web/index.html`, `web/src/lib/{voice,useVoiceMode,useLesson}.ts`, `plugin/.mcp.json`, `plugin/.claude-plugin/plugin.json`, `codex/skills/*/agents/openai.yaml`, `.github/workflows/release.yml` (HIGH: read from source)
