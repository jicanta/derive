# Technology Stack

**Project:** Derive — provider-agnostic milestone (providers, cost accounting, settings, theming, adoption)
**Researched:** 2026-09-17
**Scope:** Only what this milestone adds. The existing stack (Hono 4.13, node:sqlite, React 19 + Vite 6 + Tailwind 4, Claude Agent SDK, Codex SDK, MCP SDK, zod 4, ts-fsrs) is documented in `.planning/codebase/STACK.md` and is not re-litigated here.

Versions below were read from the npm registry on 2026-09-17 (`npm view`), and APIs from the current official docs. Where a claim rests on blog posts or community sources it is marked LOW/MEDIUM.

## Recommended Stack

### The one-line answer

Use the **Vercel AI SDK 7** (`ai` + `@ai-sdk/*` providers) as Derive's own agent loop for every pay-per-use, gateway and local provider; keep the **Claude Agent SDK** and **Codex SDK** as they are for the two subscription logins; add the **Copilot SDK** and a small **ACP client** (`gemini --acp`) for the other subscription CLIs, both fed by Derive's existing stdio MCP server. Everything else in this document exists to make those five drivers share one tool contract, one method text, one usage ledger and one search abstraction.

### Provider layer (Derive's own agent loop)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `ai` | `^7.0.105` | The tool loop: `ToolLoopAgent`, `tool()`, `stopWhen: isStepCount(n)`, `onStepEnd`, streaming | One loop, one message format, one `usage` shape across Anthropic, OpenAI, Google and every OpenAI-compatible endpoint. v7 (June 2026) is ESM-only and Node >= 22, which matches Derive's floor exactly. `result.usage` now accumulates across steps and exposes `inputTokenDetails.cacheReadTokens / cacheWriteTokens` and `outputTokenDetails.reasoningTokens` — precisely what the cost ledger needs, with no per-vendor parsing. Confidence: HIGH on versions, MEDIUM on API details (official docs, not yet exercised in this repo). |
| `@ai-sdk/anthropic` | `^4.0.56` | Anthropic API key | Native tool use, prompt caching via `providerOptions.anthropic.cacheControl` (Derive's system prompt is long and identical every turn: cache it), provider-executed `anthropic.tools.webSearch_20260318()` and `webFetch_20260318()`. |
| `@ai-sdk/openai` | `^4.0.69` | OpenAI API key | Responses API by default; `openai.tools.webSearch()` provider-executed search; reasoning models supported. |
| `@ai-sdk/google` | `^4.0.74` | Gemini API key (`GOOGLE_GENERATIVE_AI_API_KEY`) | Tool calling; `google.tools.googleSearch({})` grounding and `google.tools.urlContext({})`. This is also the **only sanctioned way to run Derive on Gemini** (see Gemini CLI below). |
| `@openrouter/ai-sdk-provider` | `^3.0.0` | OpenRouter | Targets `ai ^7`. Prefer it over the generic OpenAI-compatible provider for OpenRouter specifically because OpenRouter returns the **exact USD cost in every response** (usage accounting is always on now); the dedicated provider surfaces it, so OpenRouter lessons get billed-cost, not estimated-cost. Confidence: HIGH that the API returns cost; MEDIUM on the exact `providerMetadata` field name — verify in the phase. |
| `@ai-sdk/openai-compatible` | `^3.0.51` | Any `baseURL + key`: LM Studio (`http://127.0.0.1:1234/v1`), llama.cpp server (`http://127.0.0.1:8080/v1`), vLLM, Groq, Together, GitHub Models, a corporate proxy | `createOpenAICompatible({ name, baseURL, apiKey, headers })`; streaming tool calls supported; `metadataExtractor` hook if an endpoint returns usage in a non-standard place. This is the "one base URL + key" requirement in one dependency. |
| `ai-sdk-ollama` | `^4.3.0` | Ollama (native API) | Built on the official `ollama` JS client; 4.x tracks `ai ^7.0.95`. Chosen over `ollama-ai-provider-v2` and over Ollama's `/v1` shim for one decisive reason: it exposes `num_ctx`. Ollama's default context is 4k tokens, which silently truncates Derive's system prompt + material sections; Derive must set `num_ctx` (32k+) per request, which the OpenAI-compatible shim cannot. It also ships tool-call repair (`jsonrepair`) for small models that emit almost-JSON. Confidence: MEDIUM (listed on ai-sdk.dev; not yet run here). |
| `zod` | `^4.6` (already `^4`) | Tool input schemas | `ai@7` accepts zod 4 natively; the same schema objects feed the AI SDK `tool()`, the Claude Agent SDK `tool()`, the MCP SDK `registerTool()` and the HTTP action validator. This is how the "contract defined once" requirement is met. |

**Provider-executed search vs Derive-executed search.** On Anthropic, OpenAI and Google the model can search via a provider-executed tool with no extra key. On OpenRouter, OpenAI-compatible endpoints and local models there is no such tool, so Derive registers its own `web_search` / `web_fetch` tools backed by the search provider below. The tutor prompt already says "use WebSearch if in any doubt"; the shared method text should name a single abstract `web_search` tool and let the driver bind it.

### Subscription drivers (kept, and two added)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@anthropic-ai/claude-agent-sdk` | pin `^0.3.274` (stop declaring `latest`) | Claude Code login (existing) | Unchanged. Its `result` already carries `total_cost_usd` and per-model `modelUsage` (with `cache_read_input_tokens`, `cache_creation_input_tokens`); feed those into the same usage ledger as the AI SDK loop. Note it can also run on `ANTHROPIC_API_KEY` via `env`, but route API-key users through the AI SDK loop instead so cost, model choice and search are uniform. |
| `@openai/codex-sdk` | `0.154.0` (existing pin) | ChatGPT login (existing) | Unchanged. `turn.completed` carries `usage: { input_tokens, cached_input_tokens, cache_write_input_tokens, output_tokens }` — record it even though the subscription has no per-token price. |
| `@github/copilot-sdk` | `^1.0.14` | GitHub Copilot subscription (incl. free tier) | GA since 2026-06-02, MIT, Node `^20.19 || >=22.12`. Bundles the Copilot CLI runtime as platform packages (no runtime download; `COPILOT_CLI_PATH` to reuse an installed CLI). `createSession({ model, tools: [defineTool(...zod)], mcpServers: { derive: { type: 'local', command, args } }, systemMessage: { mode: 'replace', content } })`. `mode: 'replace'` matters: it strips the coding-assistant persona and guardrails so the Derive method text is the whole prompt, as it is on the other drivers. Tools can be in-process (`defineTool`) or the existing stdio MCP server; use `defineTool` so this driver looks like `agent.ts`, not like `codex.ts`. No per-turn token event is documented (billing is per premium request), so the usage page shows "subscription" for it. Confidence: MEDIUM. |
| `@agentclientprotocol/sdk` | `^1.4.0` | Generic ACP client: Gemini CLI (`gemini --acp`) today, any ACP agent tomorrow | Official TypeScript SDK (Apache-2.0). ACP is JSON-RPC over stdio; at `initialize` the client hands the agent its MCP servers, so Derive attaches `server/dist/mcp.js` with `DERIVE_DRIVER=app` exactly as `codex.ts` does today. This single driver covers "other agent CLIs" (Claude Code has `@agentclientprotocol/claude-agent-acp`, Codex has an ACP adapter) without a dependency per CLI. Do not depend on `@mcpc-tech/acp-ai-provider` (0.3.8, community, requires tools as MCP anyway); a 150-line client on the official SDK is less risk. Confidence: MEDIUM. |

**Gemini CLI: read the policy before building.** Google's terms (geminicli.com/docs/resources/tos-privacy, restated by the Gemini CLI team in March 2026) say that using the Gemini CLI OAuth login from third-party software is a violation, and that the supported routes for third parties are ACP, A2A and headless `-p` mode; for direct integration, an API key. Consequences for Derive: (1) never drive or embed the Google login — the learner logs in with `gemini` themselves; (2) talk to it only through `gemini --acp` as a subprocess, the way Zed does; (3) `@google/gemini-cli-core` is not a supported SDK and must not be imported; (4) the default Gemini path for the settings page should be an API key via `@ai-sdk/google`, with the CLI route labelled "advanced". Flag this phase for a fresh read of the terms at implementation time. Confidence: MEDIUM.

### Web search and page reading (pluggable)

Define one `SearchProvider` interface in `server/src/search/` (`search(query, n) → {title,url,snippet,content?}[]`, `fetch(url) → markdown`) and implement it with plain `fetch` wherever an SDK adds nothing.

| Technology | Version | Purpose | When to use |
|------------|---------|---------|-------------|
| Provider-native tools (`anthropic.tools.webSearch_*`, `openai.tools.webSearch()`, `google.tools.googleSearch()`) | with the providers above | Search on Anthropic/OpenAI/Google API keys | Default when the active provider has one: no extra key, cost appears in the provider's own usage. |
| `@tavily/core` | `^0.7.12` | Default Derive-executed search | 1,000 free credits/month with no card (consistent across several 2026 sources), returns extracted page content in the search response (one call instead of search+fetch), official JS SDK. Best fit for a learner on OpenRouter or a local model who needs verification searches a few times per lesson. Confidence: MEDIUM on pricing (vendor and blog sources). |
| SearXNG (no library; `GET {base}/search?q=…&format=json`) | n/a | Zero-cost, self-hosted search for local-model users | Pairs with the "offline and free" story; the learner points Derive at their instance. Ten lines of `fetch`; the `searxng` npm package (0.0.5, 2024) is dead — do not use it. |
| Ollama web search (`ollama.webSearch` / `ollama.webFetch`) | via `ollama` `^0.6.3` (already a dependency of `ai-sdk-ollama`) | Search for Ollama users | Free ollama.com API key; natural pairing when the model provider is Ollama. |
| `exa-js` | `^2.22.0` | Optional neural search | Only if learners ask for it; $10/month free allowance. Not in the default install. |
| Brave Search API (plain `fetch` to `api.search.brave.com/res/v1/web/search`) | n/a | Optional | Free plan was removed in Feb 2026; $5/month credit needs a card; no official npm SDK. Support as a base-URL+key option, no dependency. |
| `defuddle` | `^0.19.3` | HTML → Markdown for `web_fetch`, `add_resource`, library fetching | Built for Obsidian Web Clipper; outputs Markdown with standardised code blocks, footnotes and math (Derive renders KaTeX, so preserving math matters), extracts schema.org metadata, has per-site extractors (Wikipedia, YouTube, arXiv pages, Substack). Replace the hand-rolled HTML handling in `library.ts` with it. Accepts a `linkedom` document. |
| `linkedom` | `^0.18.13` | DOM for defuddle in Node | Light, no native deps, unlike jsdom. |

**Do not use** `@mozilla/readability` (0.6.0, last release March 2025, HTML output, needs jsdom) or `duck-duck-scrape` (unofficial HTML scraping of DuckDuckGo, last release January 2025; breaks silently and violates DDG's terms).

### Token and cost accounting

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| models.dev `https://models.dev/api.json` (data, not a library) | live | Price table and model catalogue | Open-source, 221 providers on 2026-09-17, keyed by provider id with `cost: { input, output, cache_read, cache_write }` in USD per million tokens, `limit: { context, output }`, `tool_call`, `reasoning`, and even an `npm` field naming the AI SDK package for each provider. Covers `anthropic`, `openai`, `google`, `openrouter` (369 models), `lmstudio`, `github-copilot`. Ship a snapshot in the repo (`server/data/models.json`, refreshed by a script at release), and refresh it into `~/.derive/models.json` at most weekly at runtime — never block a lesson on the network. Confidence: HIGH (fetched and inspected). |
| OpenRouter `GET /api/v1/models` + per-response `usage.cost` | live | Exact cost on OpenRouter | Per-token pricing strings (`prompt`, `completion`, `input_cache_read`, `input_cache_write`, `web_search`) and `supported_parameters` (filter the model picker to entries containing `"tools"`). Prefer the cost OpenRouter reports in the response over any table. |
| Provider-reported usage (AI SDK `usage`, Claude Agent SDK `modelUsage` / `total_cost_usd`, Codex `turn.completed.usage`) | n/a | Token counts | Never count tokens client-side. There is no correct local tokenizer for Claude or Gemini, and providers already return native counts including cache reads and reasoning tokens. |
| `node:sqlite` (existing) | built-in | `usage` table: `lesson_id, turn_seq, driver, provider, model, input, cache_read, cache_write, output, reasoning, cost_usd, cost_source ('provider'|'table'|'none'), ts` | Per-lesson totals and the running total are two `SUM` queries; `cost_source` lets the UI say "billed" vs "estimated" vs "subscription". |

**Do not use** `tokenlens` (1.3.1, last published October 2025 — the model table is a year stale), `tiktoken`/`gpt-tokenizer` for cost (wrong tokenizer for two of three vendors), or LiteLLM's price JSON (Python-centric naming; models.dev already maps to AI SDK ids).

### Settings and local key storage

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `~/.derive/secrets.json`, mode `0600`, dir `0700`, written atomically (`node:fs` `writeFileSync` to temp + `renameSync`) | built-in | API keys and endpoint tokens | This is what Codex (`~/.codex/auth.json`), Claude Code on Linux and `gh` do. It works on every platform Derive supports today, including WSL, containers and headless Linux, with zero native dependencies. Keys live outside `derive.db` so exporting, copying or debugging the database never leaks them. Environment variables (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `OPENROUTER_API_KEY`, `TAVILY_API_KEY`) override the file, so the author's `.env` workflow keeps working. |
| `settings` table in SQLite (existing `db.ts`) | built-in | Non-secret provider config: driver, provider id, model id, base URL, search provider, effort | Small key/value table; per-install now, `learner_id` column present from day one so per-learner choice is a query change later. |
| `@napi-rs/keyring` | `^2.1.0` — **defer, not in this milestone** | OS keychain | Good library (keyring-rs binding, maintained, prebuilt for 12 targets), but its Linux story is the problem: secret-service needs a running D-Bus keyring, and its `keyutils` fallback does not survive a reboot. A tutor that loses its key after every restart on a headless box is worse than a 0600 file. Revisit for macOS/Windows once there is demand. `keytar` is archived (2022); never use it. |

**Settings page security is not optional.** `index.ts` serves `/api/*` with CORS `*` and no auth. Once the server holds keys, a malicious web page can `fetch('http://localhost:4310/api/settings')` from the learner's browser. Before shipping the settings routes: bind to `127.0.0.1`, check the `Origin`/`Host` header on mutating routes, and never return a stored key to the browser (return `{ set: true, hint: '…1234' }`). No new dependency needed; Hono has `hono/cors` and middleware for this.

### Theming and typography (web)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Tailwind CSS 4 (existing, `^4.3`) CSS-first tokens | existing | Light/dark/system, accent palettes | Raw values in `:root` and `[data-theme="dark"]` / `[data-accent="teal"]`; semantic names mapped with `@theme inline { --color-bg: var(--bg); --color-accent: var(--accent); }`; `@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));`. `inline` is required when a theme variable references another variable (Tailwind docs), otherwise utilities resolve at `:root` and the swap never reaches them. "System" is resolved in JS with `matchMedia('(prefers-color-scheme: dark)')` and written to `data-theme`; an inline `<script>` in `index.html` sets the attribute from `localStorage` before first paint (no flash), and the server-side learner prefs are the source of truth after load. Accents in OKLCH with `color-mix()` so one hue generates the 400/500/600 steps the current `index.css` hand-codes. |
| `@fontsource/atkinson-hyperlegible-next` | `^5.3.0` | Dyslexia/low-vision option (Braille Institute) | Self-hosted woff2 — local-first, no Google Fonts request. Atkinson Hyperlegible is the evidence-backed accessible choice; OpenDyslexic is the one learners ask for by name. |
| `@fontsource/opendyslexic` | `^5.3.0` | Dyslexia option by request | Same packaging. |
| `@fontsource-variable/lexend` | `^5.3.0` | Readability option | Variable font, one file. |
| Existing Instrument Sans / Instrument Serif / JetBrains Mono | — | Default | Self-host them through `@fontsource` too if they are currently loaded from Google Fonts (check `web/index.html`); the "local-first" promise should include fonts. |
| Font size / density | — | `[data-size]` on `<html>` sets `font-size`; Tailwind's `rem` units scale everything | No library. |

**Do not use** `next-themes` (Next.js-shaped, 0.4.6 from March 2025), CSS-in-JS, or a runtime theme engine. Three data attributes on `<html>` and one `useTheme()` hook (30 lines) cover every requirement in PROJECT.md.

### Distribution, docs, marketplaces

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Published npm package `derive-tutor` with `bin: { derive, derive-mcp }` | n/a | `npx derive-tutor` one-command run | `derive` is taken on npm (an unrelated 2.x package); `derive-tutor`, `derive-ai`, `derive-learn` were free on 2026-09-17 — reserve one now. Build copies `web/dist` into `server/public`, `files` whitelists `dist` + `public` + `data/models.json`; `pnpm publish` rewrites `workspace:` references. `derive` starts the server and opens the browser; `derive mcp` replaces the current `derive-mcp` entry point. Publish from GitHub Actions with `npm publish --provenance` (OIDC trusted publishing) in the existing release workflow. Contributors keep `git clone && pnpm install && pnpm dev`. |
| `.claude-plugin/marketplace.json` at repo root | n/a | Claude Code marketplace listing | Schema (official docs): `name` (kebab), `owner: { name }`, `plugins: [{ name, source, description, version }]`; sources may be a relative path (`"./plugin"`), `github`, `url`, `git-subdir`, `npm`, `archive`. Users run `/plugin marketplace add jicanta/derive`; validate with `claude plugin validate .`. **Pitfall:** `plugin/.mcp.json` currently runs `${CLAUDE_PLUGIN_ROOT}/../server/dist/mcp.js`; a marketplace install copies only `plugin/`, so that path breaks. Point it at `npx -y derive-tutor mcp` (hence the npm package must land first). |
| Codex skills (`codex/skills/*`) | n/a | Codex listing | `codex/` has `openai.yaml` manifests but no `SKILL.md` bodies; the shared method text must be rendered into them at build time (the "defined once" requirement). Distribution: copy into `$CODEX_HOME/skills`; the `npx skills add` route from the open agent-skills ecosystem is worth checking in the phase (unverified here). |
| `astro` + `@astrojs/starlight` | `^7.3.3` + `^0.42.1` | Docs site + landing page (`docs/` workspace) | Framework-agnostic (Derive has no Vue), Pagefind search offline, MDX, i18n, sidebar from content collections, GitHub Pages via `withastro/action`. VitePress 1.6 is Vue-native; Fumadocs needs Next.js. Astro 7 requires Node >= 22.12 for the docs workspace only (CI already runs Node 22). Confidence: MEDIUM (comparison from secondary sources; versions HIGH). |

## Architecture note: how the pieces line up

```
settings (sqlite) + secrets.json
        │
        ▼
server/src/drivers/               one Driver interface: runTurn(lesson, prompt, sink) → { usage, cost }
  claude-agent.ts   (existing agent.ts)            tools in-process via Agent SDK tool()
  codex.ts          (existing)                     tools via stdio MCP (mcp.js)
  ai-sdk.ts         NEW  ToolLoopAgent             tools in-process via ai tool(); provider from settings
  copilot.ts        NEW  @github/copilot-sdk       tools in-process via defineTool()
  acp.ts            NEW  @agentclientprotocol/sdk  tools via stdio MCP (mcp.js), agent = `gemini --acp` | any
        │
        ▼
server/src/tools/contract.ts      zod schemas + descriptions, defined once; consumed by all five drivers,
                                  mcp.ts, and the /api/external action validator
server/src/search/                SearchProvider: native | tavily | searxng | ollama | brave | exa
server/src/usage.ts               ledger: normalise usage from any driver → usage table; price via models.json
```

The AI SDK driver is the only one that needs a `web_search`/`web_fetch` tool of its own; the others bring their host's search. The method text should refer to "your web search tool" generically and the driver injects the concrete tool name.

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Agent loop | Vercel AI SDK 7 | Hand-rolled loop over `@anthropic-ai/sdk` 0.126, `openai` 7.17, `@google/genai` 2.23 | Three streaming formats, three tool-call shapes, three usage shapes, plus every OpenAI-compatible quirk (Ollama, LM Studio, llama.cpp, OpenRouter each differ on `usage`, `tool_calls` streaming and reasoning fields). The AI SDK maintains those adapters; Derive would be maintaining them alone. |
| Agent loop | Vercel AI SDK 7 | OpenRouter only | No local models, no offline, no subscriptions, one company in the path of every lesson, and OpenRouter's markup on top. OpenRouter is one provider in the list, not the list. |
| Agent loop | Vercel AI SDK 7 | LangChain.js / Mastra / OpenAI Agents SDK | Frameworks with opinions about memory, graphs and tracing that Derive already has in `actions.ts` and SQLite. The AI SDK is a library: a loop and providers, nothing else. |
| Ollama | `ai-sdk-ollama` | `@ai-sdk/openai-compatible` on `localhost:11434/v1` | No `num_ctx` control (4k default truncates the prompt), no native tool-call repair. |
| Ollama | `ai-sdk-ollama` | `ollama-ai-provider-v2` 4.0.1 | Also targets `ai ^7`, but lacks the tool-call reliability layer and the official-client base. Either would work; pick one and move on. |
| OpenRouter | `@openrouter/ai-sdk-provider` | `@ai-sdk/openai-compatible` | Works, but loses the exact cost OpenRouter puts in each response. |
| Gemini subscription | `gemini --acp` via official ACP SDK | `@google/gemini-cli-core` import / driving OAuth | Explicit terms violation; account suspension risk for learners. |
| Gemini subscription | ACP | `@headless-coder-sdk/*` | Community wrapper, unclear auth posture, adds a layer over what ACP already gives. |
| Search | Tavily default + SearXNG/Ollama free | Brave as default | Free tier gone (Feb 2026), card required, no official SDK. |
| Search | Tavily / SearXNG | DuckDuckGo scraping | Unofficial, stale, brittle. |
| Readability | `defuddle` + `linkedom` | `@mozilla/readability` + `jsdom` | Readability is HTML-out and lightly maintained; jsdom is heavy. |
| Pricing | models.dev snapshot | `tokenlens` | Last published Oct 2025; would ship stale prices. |
| Key storage | 0600 file | `@napi-rs/keyring` | Linux persistence and headless issues; add later for macOS/Windows if wanted. |
| Theming | Tailwind data attributes | `next-themes` | Next.js-oriented, tiny gain over a 30-line hook. |
| Docs | Starlight | VitePress / Fumadocs | Vue-native / Next.js-bound respectively. |
| Install | npm package + `npx` | Electron/Tauri/brew | Out of scope per PROJECT.md. |

## Installation

```bash
# server: own agent loop + providers
pnpm --filter server add ai@^7.0.105 @ai-sdk/anthropic@^4.0.56 @ai-sdk/openai@^4.0.69 \
  @ai-sdk/google@^4.0.74 @ai-sdk/openai-compatible@^3.0.51 @openrouter/ai-sdk-provider@^3.0.0 \
  ai-sdk-ollama@^4.3.0

# server: subscription CLIs
pnpm --filter server add @github/copilot-sdk@^1.0.14 @agentclientprotocol/sdk@^1.4.0

# server: search + reading
pnpm --filter server add @tavily/core@^0.7.12 defuddle@^0.19.3 linkedom@^0.18.13

# server: pin what is currently floating
pnpm --filter server add @anthropic-ai/claude-agent-sdk@^0.3.274

# web: fonts (self-hosted)
pnpm --filter web add @fontsource/atkinson-hyperlegible-next@^5.3.0 @fontsource/opendyslexic@^5.3.0 \
  @fontsource-variable/lexend@^5.3.0

# docs workspace (new: docs/package.json, add to pnpm-workspace.yaml)
pnpm --filter docs add astro@^7.3.3 @astrojs/starlight@^0.42.1

# optional, only if a learner wants it
# pnpm --filter server add exa-js@^2.22.0
```

`ai@7` is ESM-only and requires Node >= 22 — the server is already `"type": "module"` on Node >= 22.5, so no change. `zod ^4` is already installed and accepted by every package above.

**Install weight warning:** `@openai/codex-sdk` and `@github/copilot-sdk` both pull platform binary packages. For the `npx derive-tutor` path, make both `optionalDependencies` and load them lazily in their drivers so a learner on an API key does not download two coding-agent runtimes.

## Confidence per recommendation

| Recommendation | Confidence | Basis |
|---|---|---|
| `ai@7` + `@ai-sdk/*` versions and v7 API (`ToolLoopAgent`, `isStepCount`, `instructions`, usage details) | HIGH (versions) / MEDIUM (API) | npm registry + official migration guide and reference pages; not yet executed in this repo |
| `@ai-sdk/openai-compatible` covers LM Studio / llama.cpp / gateways | HIGH | Official provider docs; models.dev maps lmstudio to it |
| `ai-sdk-ollama` over the `/v1` shim | MEDIUM | ai-sdk.dev community page + package metadata; `num_ctx` rationale from Ollama behaviour |
| `@openrouter/ai-sdk-provider` cost in response | MEDIUM | OpenRouter docs say cost is always included; provider field path unverified |
| Copilot SDK shape (`defineTool`, `systemMessage.mode`, `mcpServers`) | MEDIUM | Package README on npm + GitHub docs |
| Copilot has no per-turn usage event | LOW | Absence in docs, not a confirmed statement |
| Gemini CLI policy and ACP as the only sanctioned subscription route | MEDIUM | Official ToS page + team statement; wording may change |
| ACP official SDK is stable enough to build on | MEDIUM | 1.4.0, Apache-2.0, adopted by Zed/Gemini/Claude adapters |
| models.dev schema and coverage | HIGH | Fetched and inspected live |
| Search pricing/free tiers | LOW | Vendor pages and 2026 blog comparisons; verify at phase time |
| `defuddle` + `linkedom` | MEDIUM | npm metadata + Hacker News/README claims; not benchmarked here |
| 0600 secrets file over keyring | HIGH | Matches what Codex/Claude Code/gh do; keyring Linux limits from its README |
| Tailwind `@theme inline` + `@custom-variant dark` | HIGH | Official Tailwind docs quoted |
| Fontsource packages | HIGH | npm registry |
| Starlight over VitePress/Fumadocs | MEDIUM | Secondary comparisons; version/engine facts HIGH |
| Marketplace schema and `.mcp.json` pitfall | HIGH | Official Claude Code docs + the repo's own `plugin/.mcp.json` |
| npm name availability | MEDIUM | True on 2026-09-17; reserve immediately |

## Open questions for phase research

- Exact `providerMetadata` path for OpenRouter's per-response `cost` in `@openrouter/ai-sdk-provider@3`.
- Whether Gemini CLI ACP sessions honour an `instructions`-style system prompt override, or whether Derive's method must ride in the first user message (as with Codex `model_instructions_file`).
- Copilot SDK: whether `session.compaction_complete` or any event yields per-turn token counts usable in the ledger.
- Ollama: minimum `num_ctx` and which tool-capable local models actually complete a Derive lesson (parity is measured against the Claude Code path; expect small models to fail the understanding gate often).
- Codex skills distribution (`npx skills add` vs manual copy) and whether Codex now reads `SKILL.md` from a repo-relative path.

## Sources

Official docs / registry (HIGH–MEDIUM):
- npm registry `npm view` for every version above (2026-09-17)
- https://ai-sdk.dev/docs/migration-guides/migration-guide-7-0 — v7 renames, usage shape, Node/ESM requirements
- https://ai-sdk.dev/docs/agents/building-agents — `ToolLoopAgent`, `isStepCount`, `onStepEnd`
- https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text — `LanguageModelUsage` fields
- https://ai-sdk.dev/providers/ai-sdk-providers/anthropic — `webSearch_20260318`, `webFetch_20260318`, cache tokens
- https://ai-sdk.dev/providers/ai-sdk-providers/openai — `openai.tools.webSearch()`, Responses API default
- https://ai-sdk.dev/providers/ai-sdk-providers/google — `googleSearch`, `urlContext`, `GOOGLE_GENERATIVE_AI_API_KEY`
- https://ai-sdk.dev/providers/openai-compatible-providers — `createOpenAICompatible`
- https://ai-sdk.dev/providers/community-providers/ollama — the two Ollama providers
- https://ai-sdk.dev/providers/community-providers/acp — `@mcpc-tech/acp-ai-provider`
- https://models.dev/api.json — fetched live; schema and provider coverage
- https://openrouter.ai/api/v1/models — fetched live; pricing fields
- https://openrouter.ai/docs/cookbook/administration/usage-accounting — cost in every response
- https://geminicli.com/docs/resources/tos-privacy/ and https://geminicli.com/docs/cli/acp-mode/ — third-party policy, `gemini --acp`
- https://x.com/geminicli/status/2036898579290480908 — team statement on ACP/A2A/headless vs OAuth
- https://github.com/github/copilot-sdk (README, docs/getting-started.md) and https://github.blog/changelog/2026-06-02-copilot-sdk-is-now-generally-available/
- https://docs.github.com/en/copilot/how-tos/copilot-sdk/features/mcp — `mcpServers` config
- https://github.com/agentclientprotocol/typescript-sdk — ACP SDK 1.4.0
- https://github.com/Brooooooklyn/keyring-node — backends, keyutils persistence caveat
- https://tailwindcss.com/docs/theme and https://tailwindcss.com/docs/dark-mode — `@theme inline`, `@custom-variant dark`
- https://code.claude.com/docs/en/plugin-marketplaces — marketplace.json schema
- Installed type definitions: `@anthropic-ai/claude-agent-sdk` `sdk.d.ts` (`total_cost_usd`, `modelUsage`), `@openai/codex-sdk` `index.d.ts` (`Usage`, `turn.completed`)

Secondary (LOW–MEDIUM):
- https://brave.com/learn/best-search-api-2026/, https://toolfreebie.com/tavily-vs-brave-vs-exa-search/, https://menuagentic.com/blogs/brave-vs-exa-vs-tavily-vs-parallel-search-apis — search pricing and free tiers
- https://github.com/kepano/defuddle and https://news.ycombinator.com/item?id=44067409 — defuddle vs Readability
- https://www.pkgpulse.com/guides/fumadocs-vs-nextra-v4-vs-starlight-documentation-sites-2026, https://gautamkhorana.com/static-site-generators/compare/starlight-vs-vitepress/ — docs frameworks
- https://github.com/tailwindlabs/tailwindcss/discussions/18560 — `@theme` vs `@theme inline` in practice
