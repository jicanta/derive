# Project Research Summary

**Project:** Derive — milestone 2 (provider-agnostic tutor: providers, cost, learning UX, personalization, adoption)
**Domain:** Local-first, provider-agnostic agentic AI tutor (mastery learning + spaced repetition) on an existing Hono + node:sqlite + React 19 app
**Researched:** 2026-09-17
**Confidence:** MEDIUM

This is a subsequent milestone on a shipped app. The graph, understanding gate, FSRS review, materials, library, multi-learner record, web UI, Obsidian mirror, Claude Agent SDK and Codex drivers all exist (PROJECT.md "Validated"). Research covered only what the milestone adds. Detail lives in `STACK.md`, `FEATURES.md`, `ARCHITECTURE.md`, `PITFALLS.md`; this file resolves them into one position.

## Executive Summary

Derive today runs lesson turns on two host-owned agent loops (Claude Agent SDK, Codex SDK) with the 14 tutor tools written three times and the method text twice. Every multi-provider agent app that works (OpenCode, Zed, Cline, Open WebUI) converges on the same shape: one narrow driver interface, one tool registry that adapters project into each host's format, and a model-facing message log kept separate from the user-facing event log. Derive has two of those three half-built. The milestone is, at its core, finishing that structure and then adding drivers behind it: an owned loop on the Vercel AI SDK 7 for every API key, gateway and local model; the Copilot SDK and a small ACP client (`gemini --acp`) for the other subscription CLIs.

The recommended approach is strict about order. Consolidate the contract and method first (no behaviour change, existing tests as the net), then extract the driver seam and event sink, add a per-turn usage ledger and a real migration runner, and harden the localhost server (bind loopback, Host/Origin checks, redaction chokepoint) *before* the settings page stores its first key. Only then build the owned loop, starting with Anthropic/OpenAI/Google keys and OpenRouter (which have native or provider-reported search and cost), then local models through Ollama's native API with `num_ctx` control. Cost accounting is a by-product of the ledger: raw usage persisted per turn, priced at read time from a committed models.dev snapshot, labelled billed / estimated / not billed. Learning-experience, personalization and adoption work are largely independent of the provider layer and slot in after it, with adoption last so the docs and marketplaces describe the finished thing.

Three risks dominate. First, a policy finding that changes the plan: Anthropic forbids Claude Pro/Max OAuth tokens in third-party tools including the Agent SDK, so Derive's in-app Claude path should move to an API key through the owned loop, with the Claude Code plugin as the sanctioned subscription route; Gemini's ToS likewise only sanctions ACP/headless, never driving its OAuth. Verify both at phase time; the fix is cheap early and painful after the settings page ships. Second, the owned loop inherits everything the SDKs hide: per-provider JSON Schema dialects, must-round-trip state (Gemini `thoughtSignature`, orphaned `tool_use` after an interrupt), silent context truncation on Ollama, and prompt-cache invalidation from a system prompt that changes every turn. Each has a concrete prevention in PITFALLS and a test shape. Third, the refactor touches every file the terminal paths depend on while nobody is running them; snapshot the current wire surface and generate every consumer list from the contract before changing anything.

## Key Findings

### Recommended Stack

Everything new sits inside the existing TypeScript/Hono/node:sqlite/React 19/Tailwind 4 stack. The one decisive addition is the Vercel AI SDK 7 (`ai ^7.0.105`, ESM-only, Node >= 22, matching Derive's floor) as the owned agent loop, with first-party providers for Anthropic, OpenAI, Google, the OpenRouter provider (for exact per-response cost), the OpenAI-compatible provider for LM Studio, llama.cpp, vLLM and any base URL + key, and `ai-sdk-ollama` for Ollama because it is the only route that sets `num_ctx`. The two existing SDKs stay (pin the Claude Agent SDK to a caret range instead of `latest`), plus `@github/copilot-sdk` and `@agentclientprotocol/sdk`. Secrets go in `~/.derive/secrets.json` mode 0600 (what Codex, Claude Code and `gh` do); the OS keychain is deferred because it does not persist on headless Linux. No new theming library: three `data-*` attributes on `<html>` over Tailwind 4 CSS variables.

**Core technologies:**
- `ai@7` + `@ai-sdk/{anthropic,openai,google,openai-compatible}`, `@openrouter/ai-sdk-provider@3`, `ai-sdk-ollama@4`: the owned loop and every non-CLI provider — one message format, one `usage` shape (cache read/write, reasoning tokens) across all of them; zod 4 schemas feed the AI SDK, the Agent SDK, the MCP SDK and HTTP validation from one definition
- `@github/copilot-sdk@1` (GA June 2026) and `@agentclientprotocol/sdk@1.4` (for `gemini --acp` and any ACP agent): the remaining subscription drivers, both fed by the existing stdio MCP server or in-process `defineTool`
- `@tavily/core` (default Derive-executed search, 1k free credits/month) + SearXNG via plain `fetch` + Ollama web search; `defuddle` + `linkedom` for HTML→Markdown (preserves math for KaTeX); provider-native search tools where the provider has one
- models.dev `api.json` snapshot committed as `pricing.json`, refreshed at most weekly at runtime — never a hand-typed price constant, never a client-side tokenizer for cost
- `@fontsource/atkinson-hyperlegible-next`, `@fontsource/opendyslexic`, `@fontsource-variable/lexend`: self-hosted fonts (local-first means no Google Fonts request)
- Published npm package (`derive-tutor` or similar — `derive` is taken; reserve now) with `bin: derive`, bundling `web/dist`; `.claude-plugin/marketplace.json` at repo root; Astro + Starlight for the docs site

**Do not use:** `@google/gemini-cli-core` or any driving of the Gemini OAuth login (ToS), `keytar`, `tokenlens`, `duck-duck-scrape`, `@mozilla/readability`, `next-themes`, per-provider method paragraphs, keys in `derive.db`.

### Expected Features

Surveyed against Open WebUI, LibreChat, Zed, OpenCode, Cline, Roo, Aider (provider/cost) and Math Academy, Anki, Duolingo, Khan, Orbit (learning). The differentiators worth building are the ones only a tutor can offer: a "test teaching" smoke test that proves the model can run a graded quiz before a learner invests a session, and learning-native unit economics (cost per node locked, per review).

**Must have (table stakes):**
- Settings page: one masked key field per provider, OpenAI-compatible base URL + key, local presets (Ollama/LM Studio/llama.cpp) with "offline, $0", model list fetched with manual-id fallback, test connection with the actual failure sentence, default model persisted, env-var fallback shown as "set from environment", which provider/model is running visible in the lesson
- Per-turn tokens (input/output/cache read/cache write/reasoning) and estimated cost persisted with the model id at that time; per-lesson total in the lesson header; "about $0.42" wording; tokens-only on subscription and local paths
- Home leads with what to do next (Review N due / Continue / Start new); keyboard-first cards (1-4 or A-D, Enter, `?`); due count everywhere; honest retention stats from existing FSRS rows (estimated knowledge, true vs desired retention, forecast)
- Theme light/dark/system, accent, font size, font family with dyslexia options, reduced motion, density, tone (plain/warm/dry) on top of existing style/pace/language, voice picker; all per learner, server-side, mirrored to localStorage for first paint
- `npx` runner, `derive doctor`/`due`/`learners` verbs, README first screen with install + demo, marketplace.json + versioned plugin.json, Codex `SKILL.md` generated from the single method source, CONTRIBUTING, docs quickstart with a free path, explicit "no telemetry, keys stay local"

**Should have (competitive):**
- "Test teaching" one-node smoke test on the settings page — nobody in the survey does this
- Capability badges per model (tool calling, context window, price per 1M) from models.dev
- Usage page: running total per learner, by provider/model/lesson; cost per node locked; cost preview before a lesson
- Soft monthly budget that pauses at the turn boundary, never mid-card
- Forgiving streak (weekly freeze, no lost-streak modal), adjustable daily goal in nodes/reviews
- Reminders without a server: due badge, plugin session-start nudge, desktop notification, `.ics` export
- Atlas coloured by stability with a month slider; focus mode; remediation that names and re-quizzes the weakest prerequisite
- Provider parity report / conformance harness (nightly, not CI)

**Defer (v2+):**
- Graph reuse across lessons (locked Atlas nodes as roots) — HIGH complexity method change, needs its own research
- Bounded "I have 10 minutes" sessions; recorded-lesson replay on the landing page; parity badge; per-learner desired-retention slider
- Per-lesson model switching, custom system prompt fields, leagues/XP/hearts, flashcard editor, Docker-first install, hosted demo, Discord at launch — anti-features, out by constraint or by evidence

### Architecture Approach

Split `agent.ts` into `turn.ts` (orchestrator: busy map, notices, instructions, driver pick, usage record, cleanup) and `sink.ts` (the one text-block/status/usage → `events.ts` mapping every driver calls); move the two existing drivers under `drivers/` behind `Driver.runTurn(ctx, sink)`; put the 14 tools in `contract/tools.ts` as `ToolSpec[]` with four ~20-line adapters (Agent SDK, MCP, AI SDK/Copilot, HTTP `validate`) and the method in `contract/method.ts` rendered per surface (app, plugin, codex, docs) by a generator that CI diff-checks. The owned loop persists native `ModelMessage`s in a `turn_messages` table, not the events table. Settings resolve `env > file > detection` per turn (kill the boot-time `backend()` memo). Style is a `learners.style` JSON column applied as `data-*` attributes; only `tone` and `language` reach the prompt.

**Major components:**
1. `contract/` (tools, adapters, method + generator) — the single source; removes the three-way duplication by construction
2. `turn.ts` + `sink.ts` + `drivers/{claude-agent-sdk,codex,ai-sdk,copilot,acp}.ts` — one seam, no `emit` inside a driver, so the web UI and terminal mirrors never change when a provider is added
3. `web/` (SearchProvider: native | tavily | searxng | ollama | brave | exa; fetch reusing `library.ts`; `web_cache` table; SSRF guard) — shared by the owned loop, `add_resource` and the library
4. `settings.ts` + `providers.ts` (config + 0600 secrets, detection of logins/keys/local servers, `/api/settings`, `/api/providers`, `/api/providers/:id/test`)
5. `usage.ts` + `pricing.ts` (per-turn raw usage rows keyed by `turn_start` seq, `cost_source: provider | table | subscription | unknown`, aggregates for the Usage page)
6. `web/src/lib/style.ts` StyleProvider + Tailwind 4 variable layer with pre-paint inline script
7. Distribution: `bin` package bundling `web/dist` (cwd-independent static serving), `marketplace.json`, generated `SKILL.md` and docs reference pages, one version source stamped at release

### Critical Pitfalls

1. **Tool schemas written for Claude break on OpenAI strict mode, Gemini and llama.cpp** (optional fields, numeric bounds, `$ref`/`anyOf`) — derive per-provider projections from the one contract (`toStrictOpenAI`, `toGemini`, `toCompact`), validate incoming calls with the full zod schema server-side, run each projection through a dialect validator in CI
2. **The owned loop drops must-round-trip state and the second tool turn 400s** (Gemini `thoughtSignature`, orphaned `tool_use` after Stop, parallel calls deadlocking on blocking cards) — persist native provider messages per lesson, synthesize error `tool_result`s for orphans on abort, disable parallel tool calls, add a "resume after interrupt" fixture test per provider
3. **Ollama silently truncates the system prompt at `num_ctx` (default 4k); the tutor teaches without the gate and nothing errors** — native `/api/chat` with `num_ctx` sized from a prompt estimate (floor 16k), check `/api/show` context length, refuse with a clear card rather than truncate; same probes for LM Studio and llama.cpp (`/props`, `--jinja`)
4. **Keys leak through exits Derive already has** (raw `err.message` in `turn_end.error` persisted, streamed, mirrored to Obsidian; `console.error` dumps; `GET /api/settings` round-tripping the key; repo ingestion of `~/.derive`) and **the server is bound to all interfaces with CORS `*` and no Host check** (DNS rebinding, any tab drives the tutor on the learner's key) — one `redact()` chokepoint, write-only key fields returning `{ set, hint }`, secrets outside `derive.db`, bind `127.0.0.1`, Host and Origin allowlists, per-install bearer token; all before the first key field ships
5. **Cost accounting wrong in ways the learner cannot see** (stale price constants, missing cache-write/reasoning columns, `total_cost_usd` shown as a bill on Claude Code lessons, $0 on local) — raw usage per turn, price at read time from a versioned table with `priced_at`, labels billed/estimated/not billed, tokens + time on subscription and local paths
6. **The refactor breaks the plugin and Codex paths while nobody runs them** (`allowed-tools` lists, `enabled_tools`, `openai.yaml`, `mirror.mjs`, `.mcp.json` pointing at `../server/dist/mcp.js`) — snapshot the current MCP/HTTP wire surface as a fixture, generate every consumer list, add a stdio MCP smoke test (`tools/list`, `start_lesson`, `quiz`, `answer`, `end_lesson`) that needs no model
7. **SQLite migrations by `ALTER TABLE` in `catch {}`** cannot express new tables and swallow real errors — numbered `PRAGMA user_version` runner in `BEGIN IMMEDIATE` transactions, `busy_timeout`, refuse newer databases, fixture DB migrated in CI
8. **Prompt caching invalidated every turn by the loop itself** (material, library, profile and notices change the system prompt) — stable prefix (tools + method, byte-identical) before the breakpoint, volatile sections after; log `cache_read` and alarm when it is 0 on turn 3+

## Implications for Roadmap

PROJECT.md fixes the macro order (providers → learning UX → personalization → adoption). Research says the provider block has an internal order that cannot be shuffled: contract, then seam, then settings, then the loop. Ten phases, each shippable, each keeping the plugin and Codex paths working.

### Phase 1: One tool contract, one method text
**Rationale:** Everything after this depends on it; every new driver otherwise adds a fourth copy (PROJECT decision). No behaviour change, so the existing API suite is the regression net.
**Delivers:** `contract/tools.ts` (`ToolSpec[]`), `adapters.ts` (Agent SDK, MCP, AI SDK, HTTP `validate`), `contract/method.ts` with `renderMethod({surface})`, `scripts/gen-skills.mjs` producing `plugin/skills/teach/SKILL.md`, `codex/skills/*/SKILL.md`, `allowed-tools` lists, `docs/reference/tools.md`; CI diff check; HTTP action route validates with zod instead of `as` casts; Claude Agent SDK pinned to a caret range; version string from `package.json`.
**Addresses:** "tool contract and method defined once" (Active req); Codex skills that carry method text (Adoption table stakes, done early for free).
**Avoids:** Pitfalls 4 (method forks), 8 (terminal paths break unnoticed — snapshot fixture and stdio MCP smoke test land here), 26 (`latest` pin). Decide deliberately which wording wins where `prompt.ts` and `SKILL.md` disagree; keep the test that the rendered app prompt contains the gate sentences.

### Phase 2: Driver seam, event sink, usage ledger, migrations, localhost hardening
**Rationale:** The seam is what lets a driver be added without touching the UI or mirrors; the ledger has to exist before the loop that fills it; the migration runner is a prerequisite for the tables this milestone adds; the security posture must change before the server holds a key.
**Delivers:** `turn.ts`, `sink.ts` (unit-tested with a fake driver), `drivers/types.ts`, `agent.ts` → `drivers/claude-agent-sdk.ts`, `codex.ts` → `drivers/codex.ts` (client cached per lesson); `usage` table written from `modelUsage` and Codex `turn.completed.usage`, `turn_end` gains `usage` + `cost_source`, cost hidden on subscription paths; `PRAGMA user_version` migration runner with transactions, `busy_timeout`, backup before migrate, fixture DB in CI, `withTx` for `replaceGraph`/`deleteLesson`; bind `127.0.0.1`, Host allowlist, Origin allowlist (`localhost` and `127.0.0.1`, `:5173`), per-install bearer token, `redact()` chokepoint at `endTurn`/`emit`/console/`mcp.ts`, repo-ingest deny-list, fixed error line in the vault mirror.
**Uses:** existing `node:sqlite`, `hono/cors`; no new dependencies.
**Implements:** components 2, 5 (ledger half) and the security half of 4.
**Avoids:** Pitfalls 5, 6, 7 (fake cost on subscriptions), 9, 12, 19 (`provider_session` as `{provider, kind, handle}`), Anti-patterns 1, 2, 6.

### Phase 3: Settings page and provider detection
**Rationale:** The owned loop needs keys to use; the page is also a visible feature on its own (choose Claude vs Codex in the app) and replaces the boot-time memo.
**Delivers:** `settings.ts` (`~/.derive/config.json` + `secrets.json` 0600, atomic writes, `env > file > detection`, read per turn), `providers.ts` (detect Codex, Copilot, Gemini CLI, Ollama `:11434/api/tags`, LM Studio `:1234/v1/models`, keys in env/file), `GET/PUT /api/settings` with `{ set: true, hint }` redaction, `GET /api/providers`, `POST /api/providers/:id/test`, the Settings page (masked key per provider, base URL + key form with endpoint autosuggest and resolved-host display, local presets, model list fetch with manual fallback, curated default list, test connection with the real failure sentence, default model, "set from environment"), provider/model status line in the lesson header and plugin start message. Provider config per install; optional per-learner model override; never a per-learner key.
**Addresses:** "settings page… persisted" (Active req); all provider-layer table stakes except the drivers themselves.
**Avoids:** Pitfalls 5 (write-only key field), 24, Anti-pattern 4. **Decision to bake in here:** in-app Claude asks for an API key; the Claude Code login is offered as "use the plugin"; Gemini's default path is an API key with the CLI route labelled advanced. Verify Anthropic's and Google's current terms at the start of this phase.

### Phase 4: Owned loop — API keys and gateways
**Rationale:** Covers the most learners with the least risk: Anthropic/OpenAI/Google have native search tools and reliable tool calling; OpenRouter reports exact cost. Local models come next once the loop is proven.
**Delivers:** `drivers/ai-sdk.ts` (`streamText`, `stopWhen: isStepCount`, `fullStream` → sink, `abortSignal`, `maxRetries`, per-step `turn_messages` persistence, orphan `tool_result` synthesis on abort, sequential tool execution), `ai-sdk-models.ts` factory (Anthropic, OpenAI, Google, OpenRouter, OpenAI-compatible), per-provider schema projections with a dialect validator test, `web/` (SearchProvider with native-first resolution, Tavily + SearXNG adapters, `fetch.ts` on `library.ts` with the SSRF guard, `web_cache`, explicit `none` mode that rewrites the verification sentence), `pricing.ts` + models.dev snapshot with `priced_at`, stable-prefix prompt split with `cacheControl` on Anthropic, retry with `retry-after` + jitter and a "provider busy" status card, idempotent tool execution by call id, 401/403 vs 429/529 vs 400 handling, Chat Completions as the common path for OpenAI-compatible endpoints, `prepareStep` context guard (first version: clear error + "start a review lesson"), driver-switch mid-lesson seeded from `renderMarkdown`. Parity check: API suite through the owned loop with a stub model plus a manual lesson per provider.
**Uses:** `ai@7`, `@ai-sdk/*`, `@openrouter/ai-sdk-provider`, `@ai-sdk/openai-compatible`, `@tavily/core`, `defuddle` + `linkedom`.
**Implements:** components 2 (ai-sdk driver), 3, 5 (pricing half).
**Avoids:** Pitfalls 1, 2, 10, 11, 12, 13, 21, 23.

### Phase 5: Local models and the parity proof
**Rationale:** The "free, offline" path is the biggest adoption funnel fix, and the one where the method silently degrades unless guarded. The conformance harness must exist before the third driver family.
**Delivers:** `ai-sdk-ollama` driver on the native API with `num_ctx` from a prompt estimate (floor 16k) and `/api/show` check; LM Studio and llama.cpp via OpenAI-compatible with `/v1/models` and `/props` capability probes; prompt-size preflight with a refusal card; compact tool-description projection and material-outline-only for local providers (gate text never removed); `activeTools` per phase via `prepareStep`; Ollama web search; "Test teaching" one-node smoke test on the settings page; capability badges (tools, context, price) from models.dev; the method-conformance harness (scripted lesson replayed per provider, asserts phases in order, pretest per node, no lock without intuition/transfer pass, cumulative quiz present; run nightly); tool rejection rate per provider recorded in usage.
**Uses:** `ai-sdk-ollama@4`, `ollama` web search, models.dev `limit.context`.
**Avoids:** Pitfalls 3, 4, 22, Anti-pattern 3, the "local model with a 24k material section" performance trap.

### Phase 6: Cost and usage transparency
**Rationale:** Small once Phases 2 and 4 exist; PROJECT requires the running-total page, and pay-per-use learners need it the day API keys ship.
**Delivers:** `GET /api/lessons/:id/usage`, `GET /api/usage?range=`, Usage page (per learner, this month, by provider/model/lesson, "included in your subscription" and "local · tokens, tokens/s, context used" lines), per-lesson total on the lesson header and Home row, cost per node locked / per review / per hour, cost preview from the last ten lessons, prompt-cache savings shown, "prices as of <date>; edit `~/.derive/pricing.json`" footer, optional CSV export. Soft monthly budget with 80% warning and pause at the next turn boundary.
**Uses:** the `usage` table with an index on `(learner_id, ts)`.
**Avoids:** Pitfall 7 (all labels), the Usage-page full-scan trap; never a hard stop mid-card.

### Phase 7: CLI subscription drivers — Copilot, then Gemini ACP
**Rationale:** Lower priority than API paths because the owned loop plus an OpenAI-compatible endpoint already covers most of what these give; Copilot first (GA SDK, in-process tools, usage event), Gemini second (riskiest driver).
**Delivers:** `drivers/copilot.ts` (`createSession` with `systemMessage.mode: 'replace'`, `defineTool` from the same `ToolSpec`s, `assistant.usage` → ledger, `resumeSession`, pinned CLI/SDK compatibility check), `drivers/acp.ts` (~150-line client on `@agentclientprotocol/sdk`: `initialize` registers `server/dist/mcp.js` with `DERIVE_DRIVER=app`, `newSession`/`loadSession`/`prompt`/`cancel`), one external-CLI abstraction rather than a `codex.ts` copy per CLI, quota errors as status cards, "not available" with the install command instead of a stack trace, both SDKs as `optionalDependencies` loaded lazily.
**Uses:** `@github/copilot-sdk@1`, `@agentclientprotocol/sdk@1.4`.
**Avoids:** Pitfall 20; Gemini ToS (ACP only, never the OAuth login or `@google/gemini-cli-core`).

### Phase 8: Learning experience — least effort, honest progress
**Rationale:** Not architectural; touches `actions.ts`, `prompt.ts`/`method.ts` and web pages, none of which the provider layer moves. Runs after the harness exists so method changes are measured on every provider, not just Claude.
**Delivers:** Home "what next" (Review N due / Continue / Start new, review first), keyboard-first cards, due badge everywhere plus `derive due`, retention stats page from existing FSRS rows, forgiving streak with weekly freeze, adjustable daily goal, reminders without a server (plugin nudge, desktop notification, browser Notification API, `.ics`), streaming status ("thinking / calling quiz / grading") and next-card prefetch, remediation that names and re-quizzes the weakest prerequisite, warm-up and cumulative quiz named in the UI, quiz distractors from recorded misconceptions, Atlas coloured by stability with a month slider, focus mode (shared toggle with Phase 9), voice mode that auto-arms the mic after a question, sentence-chunked TTS under ~200 chars, `voiceLang()` from learner prefs, `voice.test.ts` and an `applyEvent` reducer test, restart-safe held cards (`prompts` table).
**Avoids:** Pitfall 18, the punitive-streak and XP anti-features; graph reuse across lessons stays deferred.

### Phase 9: Personalization — style, not method
**Rationale:** Independent of Phases 2–7; ordered here so screenshots for the docs phase come from the final theme. Can run in parallel with 4–7 if hands allow.
**Delivers:** `learners.style` column + `PATCH /api/learners/:id { style }` with `cleanStyle`; StyleProvider setting `data-theme/accent/font/size/density/focus` on `<html>`; raw values on `:root`/`[data-theme]`/`[data-accent]` mapped through `@theme inline` for variable-of-variable tokens, `@custom-variant dark`, OKLCH accents with `color-mix()`, pre-paint inline script, `color-scheme`, variables propagated to xyflow, Mermaid and KaTeX; self-hosted OFL fonts with license files (Atkinson Hyperlegible, Lexend, OpenDyslexic, and the existing Instrument/JetBrains faces moved off Google Fonts); type-scale tokens rather than root `font-size`; line-height and measure controls; density; graph panel position; `tone` (plain/warm/dry) as a bounded prompt block; `prefers-reduced-motion`; voice picker populated in `voiceschanged`; voice-mode privacy note, off by default on local-model setups; contrast test at 4.5:1 per palette in CI; layout snapshot per preset.
**Uses:** Tailwind 4 `@theme inline` + `@custom-variant dark`, `@fontsource/*`.
**Avoids:** Pitfalls 16, 17, the tone-into-method leak; no free-text system prompt, no theme editor.

### Phase 10: Adoption — install, marketplaces, docs
**Rationale:** Last, so the package, marketplace entry and docs describe the finished provider layer and the final theme.
**Delivers:** publishable npm package (`derive-tutor` or similar; reserve the name now) with `bin: derive` (`start`, `mcp`, `doctor`, `due`, `learners`, `auth`), plain-JS Node version gate before any import, `ExperimentalWarning` filtered by class, `web/dist` resolved from `import.meta.url`, `files` allow-list, native/binary SDKs optional and lazy, `npm publish --provenance` in the release workflow, CI matrix running `npm exec` from a temp dir on Node 22/24 × macOS/Linux/Windows; `.claude-plugin/marketplace.json` at the repo root with `plugin/.mcp.json` pointing at `npx -y derive-tutor mcp` (not `../server/dist`), one version source stamped into `plugin.json`, `marketplace.json`, `/api/health`, MCP `serverInfo`; `claude plugin validate` in CI; Codex plugin (`.codex-plugin/plugin.json` + generated `SKILL.md`), `npx skills add` compatibility; Astro + Starlight docs site on GitHub Pages with generated method, tool and settings references, quickstart with the free path (Ollama or a free-tier key), one page per provider, FAQ/troubleshooting; README as a landing page (install command, 20-second GIF, "no telemetry, keys stay local"); CONTRIBUTING.md, issue/PR templates, code of conduct, public roadmap, `examples/`; submissions to the official and community plugin directories and skills directories.
**Uses:** `astro@7` + `@astrojs/starlight`.
**Avoids:** Pitfalls 14, 15, 25; Docker-first, desktop app, Discord-at-launch anti-features.

### Phase Ordering Rationale

- **Contract before seam before loop:** ARCHITECTURE's build order and PITFALLS 1, 4, 8 all say the same thing — a driver added before the contract is a fourth copy, and a loop built before the sink is a second copy of the text-block protocol.
- **Security and migrations before the first key:** PITFALLS 5, 6, 9 are cheap in Phase 2 and expensive after the settings page ships; a server that holds keys on `0.0.0.0` with CORS `*` is a different threat model than today's.
- **API keys before local models:** the big three have native search and reliable tool calling, so the loop is proven on the easy path; local models add `num_ctx`, capability probes and the harness on top.
- **Cost after the ledger, page after the loop:** FEATURES' dependency graph — only the owned loop sees per-request usage; totals require per-turn rows persisted with the model id at the time.
- **CLI drivers after the loop:** the loop plus OpenAI-compatible covers most of their value; Copilot and Gemini ACP are each a driver of their own with MEDIUM-confidence SDK details.
- **Learning UX after the harness:** method-quality changes must be measured on every provider (parity is a PROJECT constraint), which needs Phase 5's harness.
- **Style before docs, docs last:** screenshots and the "any model, one command" story should be true before they are written down.

### Research Flags

Phases likely needing `/gsd-plan-phase --research-phase`:
- **Phase 3:** re-read Anthropic's consumer-OAuth policy and Gemini CLI's third-party terms at implementation time; both findings are MEDIUM and wording may have changed
- **Phase 4:** AI SDK 7 API details are MEDIUM (not yet exercised in this repo); exact `providerMetadata` path for OpenRouter's per-response `cost`; per-provider JSON Schema dialect rules; `prepareStep`/`pruneMessages` compaction strategy for long lessons; search-provider free tiers are LOW
- **Phase 5:** which tool-capable local models actually complete a Derive lesson (expect small models to fail the gate often); minimum `num_ctx`; LM Studio/llama.cpp template support
- **Phase 7:** whether Copilot SDK yields per-turn token counts; whether Gemini ACP sessions honour a system-prompt override or the method must ride in the first user message; ACP stdout hygiene (gemini-cli issue #22647)
- **Phase 10:** Codex skills/plugin distribution (`npx skills add` vs `codex plugin marketplace add`); npm name availability; npx behaviour with the vendored Codex binary on Windows

Phases with standard patterns (skip research-phase):
- **Phase 1:** verified against installed typings; zod raw shapes accepted by all three tool APIs
- **Phase 2:** Hono middleware, `PRAGMA user_version`, 0600 files — all well documented and already practised by Codex/Claude Code/`gh`
- **Phase 6:** SQL aggregates over one table plus a page
- **Phase 8:** Anki/Math Academy/Duolingo patterns are documented and the data already exists; only graph reuse (deferred) needs research
- **Phase 9:** Tailwind 4 `@theme inline` and `@custom-variant dark` are quoted from official docs; Fontsource packages are standard

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Versions read from the npm registry on 2026-09-17 (HIGH); AI SDK 7, Copilot SDK and ACP API shapes from official docs but not executed here (MEDIUM); Copilot usage events and search pricing LOW |
| Features | MEDIUM | Official docs of the surveyed products cross-checked with community sources; no hands-on trials; the Anthropic policy finding rests on The Register quoting Anthropic's page, corroborated by OpenCode's removal |
| Architecture | MEDIUM-HIGH | Driver/sink/contract pattern verified against installed typings and the existing seams (HIGH); Gemini as a driver and search comparisons LOW |
| Pitfalls | MEDIUM | Provider tool-calling quirks, caching, DNS rebinding and Tailwind theming corroborated by official docs plus multiple issue trackers; cost drift and docs drift grounded in this codebase's map |

**Overall confidence:** MEDIUM

### Gaps to Address

- **Anthropic consumer-OAuth policy vs the existing in-app Claude driver:** STACK keeps the Agent SDK driver on the Claude Code login; FEATURES says that is forbidden for Pro/Max. Resolution adopted here: keep the driver (it is also valid on an API key and on Claude Code's own harness), but make in-app Claude default to an API key through the owned loop and label the login route per the verified terms. Confirm at Phase 3.
- **Gemini CLI driver route:** STACK says ACP only (ToS); ARCHITECTURE lists headless `-p` as an option; PITFALLS discusses headless. Adopt ACP; treat headless as a fallback only if ACP proves unusable and the terms still permit it.
- **Docs framework:** STACK recommends Astro + Starlight, ARCHITECTURE mentions VitePress. Adopt Starlight (framework-agnostic, offline search); decide finally at Phase 10.
- **OpenRouter cost field path in `@openrouter/ai-sdk-provider@3`:** verify in Phase 4; fall back to the table with `cost_source: 'table'` if absent.
- **Copilot per-turn usage:** ARCHITECTURE cites an `assistant.usage` event (cache fields zero, issue #1073); STACK says none is documented. Record whatever arrives; show "subscription" if nothing does.
- **Context compaction in the owned loop:** no verified strategy; first version refuses with a clear error, real compaction needs Phase 4 research.
- **Local-model parity:** no measurement yet of which models pass the understanding gate; the Phase 5 harness produces the answer.
- **npm package name:** `derive` is taken; `derive-tutor`/`derive-ai`/`derive-learn` were free on 2026-09-17 — reserve before Phase 10.
- **Search free tiers (Tavily 1k credits, Brave paid-only since Feb 2026):** LOW; re-check when writing the free-path quickstart.

## Sources

### Primary (HIGH confidence)
- Installed typings: `@anthropic-ai/claude-agent-sdk` `sdk.d.ts` (`tool()` raw shape, `modelUsage`, `total_cost_usd` cumulative semantics), `@openai/codex-sdk` `index.d.ts` (`Usage`), `@modelcontextprotocol/sdk` `mcp.d.ts` (`registerTool`)
- npm registry `npm view` on 2026-09-17 for every version cited
- https://models.dev/api.json and https://openrouter.ai/api/v1/models — fetched live, schema and pricing fields inspected
- https://tailwindcss.com/docs/theme, https://tailwindcss.com/docs/dark-mode — `@theme inline`, `@custom-variant dark`
- https://code.claude.com/docs/en/plugin-marketplaces — `marketplace.json` schema, relative `source`
- This codebase: `.planning/PROJECT.md`, `.planning/codebase/*`, `server/src/{agent,codex,backend,config,db,export,mcp,prompt,tools}.ts`, `web/src/index.css`, `web/index.html`, `web/src/lib/{voice,useVoiceMode,useLesson}.ts`, `plugin/.mcp.json`, `plugin/.claude-plugin/plugin.json`, `codex/skills/*/agents/openai.yaml`

### Secondary (MEDIUM confidence)
- AI SDK 7 docs: migration guide, agents/loop-control, `streamText` reference, tools-and-tool-calling, provider pages for Anthropic/OpenAI/Google/openai-compatible/Ollama/ACP
- https://github.com/github/copilot-sdk (README, getting-started, MCP and usage docs, issue #1073); https://github.blog/changelog/2026-06-02-copilot-sdk-is-now-generally-available/
- https://github.com/agentclientprotocol/typescript-sdk; https://geminicli.com/docs/cli/acp-mode/, /headless/, /system-prompt/, /resources/tos-privacy/; gemini-cli issue #22647
- Anthropic consumer-OAuth policy: The Register 2026-02-20, corroborated by OpenCode docs
- OpenAI function calling strict mode; Gemini function-calling subset and thought signatures (ai.google.dev + goose/adk-js/mlflow issues); Ollama `num_ctx` and `/v1` streaming bug (issue #15457); llama.cpp function-calling docs
- Anthropic prompt caching and tool-use caching docs; orphaned `tool_use` issues across anthropic-sdk-typescript, langchainjs, openclaw
- Ollama CVE-2024-28224 (NCC Group), NemoClaw 2026 advisory, `gh` secret-storage discussion, keyring-node README
- Product docs: Open WebUI, Cherry Studio, LibreChat, Zed, OpenCode, Obsidian Copilot, Cline, Roo Code, Aider issues; Math Academy how-it-works, Anki stats manual, Expertium on FSRS retention, Khan streaks, Orbit/Quantum Country; OpenDyslexic controlled study (PMC5629233); MDN Web Speech and Notifications APIs
- LiteLLM price map, simonw `llm-prices`, OpenRouter usage-accounting cookbook
- Codex skills/plugins docs (developers.openai.com/codex/skills, learn.chatgpt.com/docs/build-skills); anthropics/claude-plugins-official and -community

### Tertiary (LOW confidence)
- Search-API pricing comparisons (brave.com, toolfreebie, menuagentic, aimultiple) — free tiers and credits
- Local tool-calling reliability of 7B models (theneuralbase, localaimaster)
- Duolingo streak research via secondary write-ups; dyslexia-font comparisons (lexifont, focusflowapp)
- Docs-framework comparisons (pkgpulse, gautamkhorana); defuddle vs Readability (HN thread)
- OpenRouter reasoning-token handling and Opus 4.7 tokenizer change (blog posts)
- `node:sqlite` ExperimentalWarning and native-addon-under-npx reports

---
*Research completed: 2026-09-17*
*Ready for roadmap: yes*
