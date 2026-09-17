# Architecture Research

**Domain:** Local-first, provider-agnostic AI tutor (Derive) — driver layer, owned tool loop, tool/method contract, web tools, usage accounting, settings, style, distribution
**Researched:** 2026-09-17
**Confidence:** MEDIUM overall (HIGH where verified against installed typings and official docs; LOW for Gemini CLI as a driver and for search-provider comparisons)

This file does not re-describe what exists. `.planning/codebase/ARCHITECTURE.md` is the map of the current system; this file says how the milestone's seven target features fit into it, which existing seams they reuse, and in what order to build them.

## Standard Architecture

### How provider-agnostic agent apps are structured

Every serious multi-provider agent app converges on the same three layers, and Derive already has two of them half-built:

1. **A driver (provider) seam** with one narrow interface: `runTurn(context, sink)`. Drivers that *own* their loop (Claude Agent SDK, Codex SDK, Copilot SDK, Gemini CLI) translate their native event stream into the sink. The app's *own* loop (AI SDK `streamText` over API-key/gateway/local models) is just one more driver behind the same interface. Derive's `agent.ts` `Active` map and `codex.ts` `runCodexTurn(lessonId, prompt, instructions, active, stopping)` are that seam in embryo; what is missing is the sink (the event mapping is inlined in each driver today).
2. **A tool registry** as the single source of truth: `{name, description, schema, handler}` records that adapters turn into whatever each host wants. All three tool APIs Derive touches accept a zod raw shape (verified from installed typings, see Pattern 2), so one record generates all of them.
3. **A model-facing message log separate from the user-facing event log.** The owned loop needs `ModelMessage[]` (tool calls, tool results, reasoning) to resume; the learner needs the event stream. Apps that conflate the two end up either leaking tool JSON into the UI or unable to resume. Derive's `events` table is the learner log; the owned loop needs its own `turn_messages` table.

### System Overview (target)

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│ SURFACES (unchanged contracts)                                                     │
│  web/src (SSE consumer)   plugin/ (Claude Code)   codex/skills   docs/ (generated)  │
└──────────┬──────────────────────┬───────────────────────┬─────────────────────────┘
           │ HTTP + SSE           │ stdio MCP (mcp.ts)    │
┌──────────▼──────────────────────▼───────────────────────▼─────────────────────────┐
│ HTTP API  server/src/index.ts  (+ /api/settings, /api/providers, /api/usage)       │
│   external action route validates with contract schemas, no hand-written checks    │
└──────────┬────────────────────────────────────────────────────────────────────────┘
           │ runTurn(lessonId, prompt)
┌──────────▼────────────────────────────────────────────────────────────────────────┐
│ TURN ORCHESTRATOR  server/src/turn.ts   (was the top half of agent.ts)             │
│   busy map · notices · instructions = method(surface) + material + library + profile│
│   picks Driver from settings · builds TurnSink · records usage row · cleanup        │
├──────────────────────────────┬────────────────────────────────────────────────────┤
│ DRIVERS  server/src/drivers/ │ TurnSink  server/src/sink.ts                        │
│  claude-agent-sdk.ts (moved) │  text block writer (emit partial → delta → update)   │
│  codex.ts (moved)            │  status · verified counter · session id · usage     │
│  ai-sdk.ts (owned loop)      │  → events.ts emit/emitUpdate/checkpoint/emitEphemeral│
│  copilot.ts                  │  ONE implementation; the SSE stream does not change  │
│  gemini-cli.ts               │                                                     │
├──────────────────────────────┴────────────────────────────────────────────────────┤
│ CONTRACT  server/src/contract/                                                     │
│  tools.ts  ToolSpec[] {name, description, shape, label, blocking}                  │
│  adapters: toAgentSdk · toMcp · toAiSdk · validate(action, body)                   │
│  method.ts  one method text + renderMethod({surface, toolNames, webToolNames})     │
│  → generates plugin/skills/teach/SKILL.md, codex/skills/*/SKILL.md, docs/method.md │
├───────────────────────────────────────────────────────────────────────────────────┤
│ WEB TOOLS  server/src/web/   search providers (native | brave | tavily | exa |     │
│  searxng) · fetch (library.ts fetchPage reused) · web_cache table · SSRF guard      │
├───────────────────────────────────────────────────────────────────────────────────┤
│ SETTINGS  server/src/settings.ts  ~/.derive/config.json + secrets.json (0600)      │
│  precedence env > file > detection · providers.ts detects logins/keys/local servers │
├───────────────────────────────────────────────────────────────────────────────────┤
│ USAGE  server/src/usage.ts + pricing.ts   usage table per turn · pricing.json      │
│  snapshot (models.dev) · cost_source provider|table|subscription                   │
├───────────────────────────────────────────────────────────────────────────────────┤
│ ACTIONS (unchanged)  actions.ts · prompts.ts · notices.ts · schedule.ts · db.ts    │
│  + tables: usage, turn_messages, web_cache; learners.style column                  │
└───────────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `contract/tools.ts` | The 14 tutor tools as data: name, description, zod raw shape, status label, whether it blocks on the learner | `ToolSpec[]` + `z.object(shape)` cached per tool; exports `DERIVE_TOOL_NAMES`, `TOOL_LABELS` (replaces `tools.ts`) |
| `contract/adapters.ts` | Turn specs into Agent SDK tools, MCP registrations, AI SDK tools, HTTP validators | Three ~20-line functions that take an `invoke(name, args)` callback |
| `contract/method.ts` | The teaching method as one text with named fragments; renders per surface | Template with `{{TOOL:quiz}}`, `{{WEB_TOOLS}}` placeholders (the latter already exists in `prompt.ts`) |
| `turn.ts` | Runs one turn: busy guard, notices, instructions, driver pick, sink, usage record, cleanup | The top half of today's `agent.ts` `runTurn` |
| `sink.ts` | The one event mapping every driver calls | `TextBlockWriter` extracted from `agent.ts` lines 305–347 plus status/usage/session helpers |
| `drivers/*.ts` | Translate a provider's stream to sink calls; expose `available()`, `models()` | One file per provider; no `emit` calls inside drivers |
| `drivers/ai-sdk.ts` | The owned loop | `streamText` + `stopWhen: isStepCount` + `fullStream` iteration + `turn_messages` persistence |
| `web/` | `web_search`/`web_fetch` tools for drivers with no host web tools | Provider interface + cache table; reuses `library.ts` fetch/extract |
| `settings.ts`, `providers.ts` | Config + secrets store, detection, model listing | JSON files under `~/.derive`, env override, per-turn read (no boot-time memo) |
| `usage.ts`, `pricing.ts` | Per-turn usage rows, cost estimation, aggregates for the UI | `usage` table, committed `pricing.json` snapshot |
| `web/src/lib/style.ts` | Apply learner style via `data-*` attributes + CSS variables | Tailwind 4 `@theme` tokens referencing overridable variables |
| `packages/cli` or `server/src/cli.ts` | `npx` entry: start, mcp, doctor, settings | `bin` in a publishable package that bundles `web/dist` |

## Recommended Project Structure

```
server/src/
├── contract/
│   ├── tools.ts          # ToolSpec[] — the only place a tool's name/description/schema lives
│   ├── adapters.ts       # toAgentSdk(invoke), toMcp(server, invoke), toAiSdk(invoke), validate(name, body)
│   └── method.ts         # method text + renderMethod({ surface, tools, web })
├── drivers/
│   ├── types.ts          # Driver, TurnContext, TurnSink, Usage, Availability
│   ├── claude-agent-sdk.ts   # today's agent.ts bottom half
│   ├── codex.ts              # today's codex.ts
│   ├── ai-sdk.ts             # owned loop
│   ├── ai-sdk-models.ts      # modelFor(settings): provider factories
│   ├── copilot.ts
│   └── gemini-cli.ts
├── turn.ts               # orchestrator (exports runTurn, interrupt, isBusy — same names index.ts uses now)
├── sink.ts               # TextBlockWriter + makeSink(lessonId)
├── web/
│   ├── types.ts          # SearchProvider, FetchProvider
│   ├── search/{brave,tavily,exa,searxng}.ts
│   ├── fetch.ts          # wraps library.ts fetchPage/htmlToText
│   ├── cache.ts          # web_cache table
│   └── tools.ts          # web_search / web_fetch ToolSpecs for the owned loop
├── settings.ts           # load/save config + secrets, precedence, redaction
├── providers.ts          # detection: claude, codex, copilot, gemini, ollama, lmstudio, keys
├── usage.ts              # recordUsage, lessonUsage, learnerTotals
├── pricing.ts + pricing.json
├── actions.ts, db.ts, events.ts, prompts.ts, notices.ts, ...   # unchanged
└── mcp.ts                # companion tools (start_lesson, answer, ...) + toMcp(registry) for the 14

scripts/
├── gen-skills.mjs        # renders SKILL.md files and docs/reference/tools.md from the contract
└── doctor.mjs
plugin/                   # unchanged layout; skills/teach/SKILL.md becomes generated
codex/skills/*/SKILL.md   # generated (currently missing)
.claude-plugin/marketplace.json   # repo root; plugins: [{ name: "derive", source: "./plugin" }]
docs/                     # VitePress site; method + tool reference generated
```

### Structure Rationale

- **contract/:** Removes the three-way duplication named in CONCERNS.md by construction: an adapter that iterates `ToolSpec[]` cannot drift. The method lives beside it because the method text names the tools and the placeholders resolve from the same registry.
- **drivers/:** Each file depends only on `drivers/types.ts`, `contract/`, and the provider SDK. The rule "no `emit` in a driver" is what keeps the web UI and terminal mirrors untouched when a provider is added.
- **turn.ts + sink.ts:** Splitting orchestration from event mapping means the mapping is tested once with a fake driver, which CONCERNS.md flags as untested today.
- **web/:** Kept out of `drivers/` because the owned loop is not the only consumer: `add_resource` and the library already fetch pages, and a future Gemini/Copilot driver may prefer Derive's search over the host's.

## Architectural Patterns

### Pattern 1: Driver interface with a shared sink

**What:** Drivers receive a `TurnSink` and call it; they never touch `events.ts`. The sink owns the text-block protocol (`assistant` partial → `delta` ephemeral → checkpoint every 1.5 s → `emitUpdate` at block end) that `web/src/lib/useLesson.ts` and the Obsidian mirror already understand.
**When to use:** Always. It is the condition for "the web UI and terminal mirrors do not change".
**Trade-offs:** Drivers that deliver whole messages (Codex `agent_message`, Gemini `message` events) call `textStart`+`textEnd` back to back; the UI sees one block appear, as today.

```typescript
// server/src/drivers/types.ts
export type Usage = { input: number; output: number; cacheRead?: number; cacheWrite?: number; reasoning?: number; webSearches?: number; costUsd?: number | null; model?: string };

export interface TurnSink {
  session(id: string): void;                 // → setSessionId when it changes
  textStart(): string;                       // returns block id; emits assistant{partial:true}
  textDelta(id: string, text: string): void; // emitEphemeral delta + timed checkpoint
  textEnd(id: string): void;                 // emitUpdate final text
  status(text: string): void;                // emitEphemeral status
  tool(name: string): void;                  // status from TOOL_LABELS; counts web tools as "verified"
  usage(u: Usage): void;                     // accumulated; written by turn.ts
  fail(error: string): void;
}

export interface TurnContext {
  lessonId: string; learnerId: string;
  prompt: string; instructions: string;
  sessionId: string | null;
  model?: string; effort?: string;
  invoke: (tool: string, args: unknown) => Promise<unknown>;  // in-process: actions.* via the contract
  signal: AbortSignal;
}

export interface Driver {
  id: 'claude' | 'codex' | 'ai-sdk' | 'copilot' | 'gemini';
  available(): Promise<{ ok: boolean; reason?: string; via?: string }>;
  models?(): Promise<{ id: string; label?: string }[]>;
  runTurn(ctx: TurnContext, sink: TurnSink): Promise<{ ok: boolean; interrupted?: boolean; error?: string }>;
}
```

`turn.ts` keeps the `active`/`stopping` maps, emits `turn_start`/`turn_end` (payload extended with `usage` and `cost_source`; `cost_usd`, `duration_ms`, `verified` stay so `useLesson.ts` needs no change), calls `recordUsage`, and runs the `finally` cleanup (`cancelPending`) exactly as `agent.ts` does now.

### Pattern 2: One `ToolSpec`, four adapters

**What:** Each tool is `{ name, description, shape: ZodRawShape, label, blocking }`. Verified signatures (installed packages):

- Claude Agent SDK 0.3.261: `tool(name, description, shape: AnyZodRawShape, handler)` — takes the raw shape.
- `@modelcontextprotocol/sdk` 1.30.0: `registerTool(name, { description, inputSchema: ZodRawShapeCompat | AnySchema }, cb)` — takes the raw shape or an object schema.
- AI SDK 7.0.x: `tool({ description, inputSchema: z.object(shape), execute })` — takes a schema; peers on `zod ^3.25.76 || ^4.1.8` (Derive has zod 4.5.4).
- HTTP: `z.object(shape).safeParse(body)` at the top of `POST /api/external/lessons/:id/:action`, replacing the `as` casts CONCERNS.md lists.

**When to use:** Now, before any new driver; every driver after this is an adapter, not a fourth copy.
**Trade-offs:** MCP SDK v2 (`@modelcontextprotocol/server` 2.0.0) moves to Standard Schema and `zod/v4`; the adapter is the one place that would change. Stay on 1.x this milestone.

```typescript
// server/src/contract/tools.ts
export type ToolSpec<S extends z.ZodRawShape = z.ZodRawShape> = {
  name: string; description: string; shape: S; label: string;
  blocking: boolean;                      // quiz/ask/set_plan/explain_back wait on the learner
  run: (lessonId: string, args: z.infer<z.ZodObject<S>>) => Promise<unknown>;   // calls actions.*
};
export const TOOLS = [quiz, ask, set_plan, node_status, /* ... */] as const satisfies readonly ToolSpec[];

// server/src/contract/adapters.ts
export const toAgentSdk = (lessonId: string) =>
  createSdkMcpServer({ name: 'derive', version: VERSION, alwaysLoad: true,
    tools: TOOLS.map((t) => tool(t.name, t.description, t.shape, async (a) => text(await t.run(lessonId, a)))) });

export const toAiSdk = (lessonId: string) =>
  Object.fromEntries(TOOLS.map((t) => [t.name, tool({ description: t.description, inputSchema: z.object(t.shape),
    execute: (a) => t.run(lessonId, a) })]));

export const toMcp = (server: McpServer, invoke: (name: string, args: unknown) => Promise<unknown>) =>
  TOOLS.forEach((t) => server.registerTool(t.name, { description: t.description, inputSchema: t.shape },
    async (a) => text(await invoke(t.name, a))));   // mcp.ts keeps proxying over HTTP

export const validate = (name: string, body: unknown) => z.object(byName(name).shape).safeParse(body);
```

The companion-only tools in `mcp.ts` (`start_lesson`, `attach_material`, `answer`, `answer_in`, `learners`, `end_lesson`) are not tutor tools and stay where they are. `plugin/commands/*.md` `allowed-tools` lists and `docs/reference/tools.md` are generated from `TOOLS` by `scripts/gen-skills.mjs`; CI runs the generator and fails on `git diff --exit-code`.

### Pattern 3: One method text, rendered per surface

**What:** `prompt.ts` already has a `{{WEB_TOOLS}}` placeholder and a `systemPrompt(backend)` renderer. Generalise: `renderMethod({ surface: 'app' | 'plugin' | 'codex' | 'docs', toolPrefix, webTools })`. The plugin skill's front matter and its "Tool mapping" preamble (tool names are `mcp__plugin_derive_derive__quiz` under the plugin, `WebSearch`/`WebFetch` for web) are surface fragments concatenated around the shared body. The first-turn, warm-up, material and review prompts stay in `prompt.ts`.
**When to use:** Same phase as the tool registry; the skills become build outputs.
**Trade-offs:** The plugin's SKILL.md currently paraphrases the "Math Academy" discipline section differently from the app prompt (CONCERNS.md). Consolidating forces a decision on which wording wins; do it deliberately and keep the test in `server/test` that asserts the rendered app prompt still contains the gate sentences the actions rely on.

### Pattern 4: The owned loop (AI SDK v7)

**What:** `streamText` with the contract tools plus `web_search`/`web_fetch`, `stopWhen: isStepCount(MAX_STEPS)`, `abortSignal`, `maxRetries: 2`, and `fullStream` mapped to the sink. Verified `fullStream` parts (AI SDK v7 reference): `start`, `start-step`, `text-delta`, `reasoning-delta`, `tool-call`, `tool-call-streaming-start`, `tool-result`, `source`, `finish-step {response, finishReason}`, `finish {finishReason, totalUsage}`, `error`, `abort`. Usage fields: `inputTokens`, `outputTokens`, `inputTokenDetails.{cacheReadTokens,cacheWriteTokens}`, `outputTokenDetails.reasoningTokens`.
**When to use:** For every provider that does not bring a loop: Anthropic/OpenAI/Google keys, OpenRouter, OpenAI-compatible endpoints, Ollama, LM Studio, llama.cpp.
**Trade-offs:** Derive now owns context management. The Agent SDK and Codex compact for you; here a long lesson (dozens of tool calls, 24 k chars of inlined material) will hit the context window. `prepareStep` is the hook (AI SDK ships `pruneMessages`); the first version can stop with a clear error and a "start a review lesson" suggestion, but Phase-level research on compaction is needed (see Pitfalls).

```typescript
// server/src/drivers/ai-sdk.ts (shape only)
const result = streamText({
  model: modelFor(settings),                       // drivers/ai-sdk-models.ts
  system: ctx.instructions,
  messages: loadTurnMessages(ctx.lessonId).concat({ role: 'user', content: ctx.prompt }),
  tools: { ...toAiSdk(ctx.lessonId), ...webTools(settings) },
  stopWhen: isStepCount(MAX_STEPS),                // 400 today for the Agent SDK; 60 is plenty per turn
  abortSignal: ctx.signal,
  maxRetries: 2,
  onStepFinish: ({ response, usage }) => { appendTurnMessages(ctx.lessonId, response.messages); sink.usage(fromAi(usage)); },
});
let block: string | null = null;
for await (const part of result.fullStream) {
  switch (part.type) {
    case 'text-delta': if (!block) block = sink.textStart(); sink.textDelta(block, part.text); break;
    case 'tool-call': if (block) { sink.textEnd(block); block = null; } sink.tool(part.toolName); break;
    case 'reasoning-delta': sink.status('Thinking'); break;
    case 'finish-step': if (block) { sink.textEnd(block); block = null; } break;
    case 'error': sink.fail(String(part.error)); break;
  }
}
```

Blocking cards work unchanged: `quiz`'s `execute` awaits `actions.quiz`, which awaits the learner; the tool result is returned to the model on the next step. Persisting `response.messages` per step (not per turn) is what makes an interrupted turn resumable and mirrors the "prose is kept" guarantee the text-block writer gives the learner.

**Session persistence.** `turn_messages (lesson_id, seq, message JSON, ts)` holding `ModelMessage`s. `lessons.session_id` stays null for this driver; `lessons.driver` (exists) records `ai-sdk`. Switching provider mid-lesson is a driver switch: `session_id` is driver-specific, so `turn.ts` starts fresh and seeds the new driver with a transcript rendered from events (`export.ts` `renderMarkdown` already produces exactly that) as the first user message.

**Model factory.** `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google` for keys; `@openrouter/ai-sdk-provider` 3.x (peer `ai ^7`) for OpenRouter; `@ai-sdk/openai-compatible` `createOpenAICompatible({ name, baseURL, apiKey })` for LM Studio (`:1234/v1`), llama.cpp (`:8080/v1`) and any custom endpoint; `ai-sdk-ollama` 4.x for Ollama, because it exposes `num_ctx` (Ollama's OpenAI-compatible endpoint defaults to a small context and silently truncates a tutor prompt). One `provider` enum in settings maps to one factory; presets fill base URLs.

### Pattern 5: Provider-native web tools first, Derive's own second

**What:** `web_search`/`web_fetch` in the owned loop resolve to (a) the model provider's own tool when it has one — `anthropic.tools.webSearch_20260318` / `webFetch_20260318`, `openai.tools.webSearch` (Responses API), `google.tools.googleSearch()` / `urlContext()` — and (b) otherwise Derive's `SearchProvider` (Brave, Tavily, Exa, SearXNG) plus `fetch.ts` (reusing `library.ts` `fetchPage`, `htmlToText`, arXiv PDF handling). Provider-native means zero extra keys for the three big API-key paths, which is the parity story for most learners.
**When to use:** Build (b) in the same phase as the owned loop; OpenRouter/local models have no native search, and the method insists on verification.
**Trade-offs:** Native tools appear in `fullStream` as `tool-call`/`tool-result` with the provider's name; the sink maps both native and Derive names to "Verifying with a web search" and the `verified` counter. Results and fetched pages go through a `web_cache` table (query/url hash → body, ttl: 1 day for search, 7 days for pages) so retries and re-reads within a lesson are free. The SSRF guard CONCERNS.md asks for in `library.ts` must land before `web_fetch` is exposed to models on arbitrary URLs.

### Pattern 6: Usage rows per turn, priced from a committed table

**What:** One `usage` row per turn keyed by `(lesson_id, turn_seq)` where `turn_seq` is the `turn_start` event's seq: `driver, provider, model, input, cache_read, cache_write, output, reasoning, web_searches, cost_usd (nullable), cost_source ('provider' | 'table' | 'subscription' | 'unknown')`. Sources, verified:

| Driver | Where tokens come from | Cost |
|--------|------------------------|------|
| Claude Agent SDK | `result.modelUsage[model]` = `{inputTokens, outputTokens, cacheReadInputTokens, cacheCreationInputTokens, webSearchRequests, costUSD}` | `costUSD` per model; `total_cost_usd` is cumulative per `query()` — read the latest result, do not sum |
| Codex SDK | `turn.completed.usage` = `{input_tokens, cached_input_tokens, cache_write_input_tokens, output_tokens}` | none (ChatGPT subscription) → `cost_source: 'subscription'` |
| AI SDK | `finish.totalUsage` (+ per-step `onStepFinish.usage`) | `pricing.ts` lookup → `'table'`; OpenRouter can return `usage.cost` in the response → `'provider'` |
| Copilot SDK | `assistant.usage` event `{model, input_tokens, output_tokens, cost}` (cache fields known to be 0, issue #1073) | `'provider'` when present |
| Gemini CLI | `result.stats` in `--output-format json/stream-json` | `'table'` if API key, `'subscription'` on OAuth |

**Pricing table:** commit `server/src/pricing.json` as a snapshot of models.dev `api.json` (per provider → model → `cost {input, output, cache_read, cache_write, reasoning}` in USD per 1M tokens), filtered to the providers Derive supports; optional bounded refresh (`fetch` with a 5 s timeout, written to `~/.derive/pricing.json`). Unknown model → `cost_usd: null`, `cost_source: 'unknown'`, UI shows tokens only.
**UI:** `turn_end` keeps `cost_usd` (already read by `useLesson.ts`) and gains `usage`; `GET /api/lessons/:id/usage` and `GET /api/usage?range=` feed a Usage page (per lesson, per provider, running total per learner) with a plain "included in your subscription" line for subscription drivers.

### Pattern 7: Settings store with env override, secrets in a 0600 file

**What:** `~/.derive/config.json` (provider, model, effort, search provider, base URLs, vault dir, port) and `~/.derive/secrets.json` (`chmod 600`; keys by provider id). `settings.ts` resolves `env > file > detection` and is read per turn, replacing `backend.ts`'s boot-time memo (a settings change must take effect on the next turn, not the next restart). `providers.ts` detects: Claude (`claude auth status`, exists), Codex (`~/.codex/auth.json`, exists), Copilot (`copilot` binary or bundled runtime + logged-in GitHub user), Gemini (`~/.gemini/oauth_creds.json` or `GEMINI_API_KEY`), Ollama (`GET :11434/api/tags`), LM Studio (`GET :1234/v1/models`), keys present in secrets or env.
**API:** `GET /api/settings` (keys redacted to `{ set: true, last4 }`), `PUT /api/settings`, `GET /api/providers` (detection + model lists), `POST /api/providers/:id/test` (one tiny `generateText`). Settings are per install; a per-learner override column can come later without changing the API shape.
**Trade-offs:** OS keychain via `@napi-rs/keyring` 2.x is the better home for keys but is a native module (install friction, no secret service on headless Linux/WSL). File + env is what `gh`, `codex` (`auth.json`) and Claude Code do; match them and note the keychain as an upgrade.

### Pattern 8: Style as data attributes over Tailwind 4 tokens

**What:** `learners.style` JSON column `{ theme: 'light'|'dark'|'system', accent, font: 'sans'|'serif'|'dyslexic', font_size, density, graph_side, focus_mode, tone: 'terse'|'chatty', voice }` separate from `learners.prefs` (teaching preferences that reach the prompt). Web: a `StyleProvider` sets `data-theme`, `data-accent`, `data-font`, `data-density`, `data-focus` on `<html>` and mirrors the object to `localStorage['derive.style.<learner>']` so first paint is right before `/api/learners/:id` answers. `index.css` `@theme` keeps its tokens but points the semantic ones (`--color-bg`, `--color-fg`, `--color-accent`, `--font-body`) at plain CSS variables that `[data-theme=light]`, `[data-accent=teal]` blocks override; `@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *))` replaces media-query dark mode.
**Prompt:** only `tone` and the existing `language` reach the model, through `db.ts` `preferencesSection`/`learnerProfile` (the same path `prefs` already takes). Nothing else about style touches the server beyond storage. `set_preferences` (a tutor tool) does not write `style`; the You page does.

### Pattern 9: Distribution as one runnable package plus generated artefacts

**What:** A publishable package (`derive` if the npm name is free, else a scoped name) whose `bin` is `derive` with subcommands `start` (server + open browser), `mcp` (today's `derive-mcp`), `doctor` (today's `scripts/doctor.mjs`), `settings`. Its build copies `web/dist` into the package so `npx <pkg>` needs no clone; `serveStatic` must stop depending on `process.cwd()` (CONCERNS.md) for this to work from any directory. Marketplace: `.claude-plugin/marketplace.json` at the repo root with `{ name: 'derive', owner: { name }, plugins: [{ name: 'derive', source: './plugin', description, version }] }` (relative source is the documented same-repo form; users run `/plugin marketplace add jicanta/derive` then `/plugin install derive@derive`). Docs: `docs/` VitePress site on GitHub Pages; `docs/method.md` and `docs/reference/tools.md` are generator outputs from `contract/`, so the site cannot drift from the code either.

## Data Flow

### Request Flow (owned loop, API-key provider)

```
Browser POST /api/lessons/:id/message
    ↓
index.ts → turn.runTurn(lessonId, prompt)
    ↓ settings.load() → driver = drivers[settings.provider.kind]   (ai-sdk)
    ↓ instructions = renderMethod('app', {web: ['web_search','web_fetch']}) + material + library + profile
    ↓ sink = makeSink(lessonId); emit turn_start
drivers/ai-sdk.runTurn(ctx, sink)
    ↓ messages = turn_messages(lesson) + user prompt
    ↓ streamText(model, tools = toAiSdk(lessonId) ∪ webTools)
    │   text-delta ──────────→ sink.textDelta → emitEphemeral('delta') / checkpoint / emitUpdate
    │   tool-call quiz ──────→ sink.tool('quiz') → status "Writing a question"
    │       execute → actions.quiz → prompts.openPrompt → emit('quiz') → SSE → QuizCard
    │       ← POST /answer → answerPrompt → graded → tool-result JSON → next step
    │   tool-call web_search → search provider (or native) → web_cache → tool-result
    │   finish-step ────────→ appendTurnMessages(response.messages); sink.usage(usage)
    ↓ finish → return {ok:true}
turn.ts → recordUsage(row, priced) → emit turn_end {ok, cost_usd, duration_ms, verified, usage, cost_source}
    ↓ finally: active.delete, cancelPending
SSE → useLesson reducer (unchanged) → Lesson.tsx
```

### Request Flow (host-loop driver, e.g. Copilot)

Same up to `driver.runTurn`; the driver starts/reuses a session with `systemMessage: { content: instructions, mode: 'replace' }`, attaches Derive's tools either in-process (`defineTool` from the same `ToolSpec`s, Copilot) or as the stdio MCP server with `DERIVE_DRIVER=app` (Codex today; Gemini), and maps `assistant.message_delta` → `sink.textDelta`, `tool.execution_start` → `sink.tool`, `assistant.usage` → `sink.usage`, `session.idle` → return. The MCP route means tool calls go child process → HTTP → `index.ts` external action → `validate()` → `actions.*`, exactly the Codex path today.

### State Management

```
~/.derive/config.json + secrets.json ──settings.load()──▶ turn.ts (per turn)  ──▶ driver + model + search provider
SQLite lessons.driver / session_id ─────────────────────▶ driver resume (Agent SDK session, Codex thread, Copilot session)
SQLite turn_messages ───────────────────────────────────▶ ai-sdk driver resume
SQLite events ──────────────────────────────────────────▶ SSE replay (unchanged) · renderMarkdown for driver switch
SQLite usage ───────────────────────────────────────────▶ /api/usage, /api/lessons/:id/usage
SQLite learners.style ──▶ /api/learners/:id ──▶ StyleProvider ──▶ <html data-*> + localStorage mirror
```

### Key Data Flows

1. **Tool contract → four hosts:** `contract/tools.ts` → `toAgentSdk` (in-process MCP for the Agent SDK), `toMcp` (stdio server for plugin/Codex/Gemini), `toAiSdk` (owned loop, Copilot `defineTool`), `validate` (HTTP). Generated: SKILL.md files, `allowed-tools`, docs.
2. **Method → three surfaces:** `contract/method.ts` → app system prompt (per turn), `plugin/skills/teach/SKILL.md` and `codex/skills/*/SKILL.md` (build time), `docs/method.md`.
3. **Provider stream → learner log:** driver → `TurnSink` → `events.ts` → SSE + Obsidian mirror. One mapping, five drivers.
4. **Tokens → cost → UI:** driver → `sink.usage` → `turn.ts` → `pricing.ts` → `usage` row → `turn_end` payload and `/api/usage`.
5. **Settings → driver choice:** file/env/detection → `settings.load()` per turn; the settings page writes the file; no restart.

## Scaling Considerations

Single learner, single process, one SQLite file (PROJECT.md: no hosted version). What grows is per-install history, not users.

| Scale | Architecture Adjustments |
|-------|--------------------------|
| A few lessons | Nothing; full-table reads are fine |
| Hundreds of lessons, months of use | `usage` aggregates need an index on `(learner_id, ts)`; `turn_messages` per lesson can reach thousands of rows — prune on lesson end to the last N steps or a summary; `web_cache` needs a size cap and TTL sweep in the boot sweep |
| Long single lessons on the owned loop | Context window is the limit, not the DB: `prepareStep` compaction (summarise older tool results, keep the plan and locked nodes) before hitting `limit.context` from the pricing table |

### Scaling Priorities

1. **First bottleneck:** context growth in the owned loop. Local models with 8–32 k windows will hit it in one lesson. Fix: `prepareStep` pruning plus a settings-visible "context used" figure from `usage_info`-style accounting.
2. **Second bottleneck:** the boot-time and per-request full event scans CONCERNS.md lists (`busy()`, restart loop). Unchanged by this milestone but the Usage page adds one more full read per lesson unless `usage` is its own table (it is, above).

## Anti-Patterns

### Anti-Pattern 1: Letting a driver emit events

**What people do:** Port `agent.ts`'s `emit`/`emitUpdate`/`checkpoint` block into each new driver file.
**Why it's wrong:** Five copies of the text-block protocol; a change to checkpoint timing or a new `status` payload field lands in four places, and the mirror (`export.ts`) sees inconsistent partials. This is the tool-contract duplication again, one layer down.
**Do this instead:** Drivers call `TurnSink` only. `sink.ts` is the single owner of `events.ts` calls for turns; test it with a scripted fake driver.

### Anti-Pattern 2: Storing model messages in the events table

**What people do:** Persist the owned loop's `ModelMessage[]` as `events` rows so "everything is in one log".
**Why it's wrong:** `useLesson.ts` ignores unknown types but `renderMarkdown`, `busy()`, `teachingGap`, and the boot loop scan every event; tool-call JSON bloats every one of them, and a driver switch would replay model-specific content into another provider.
**Do this instead:** `turn_messages` table, keyed by lesson, used only by `drivers/ai-sdk.ts`. Learner-facing prose still goes through the sink into `events`.

### Anti-Pattern 3: Degrading the method for weaker providers

**What people do:** Drop the understanding gate or the cumulative quiz "because small models can't handle 14 tools".
**Why it's wrong:** PROJECT.md is explicit: parity means the method stays; a weak model teaches worse. Forking the method per driver reintroduces the drift the contract work removes.
**Do this instead:** Keep the tool set and the refusals identical. Where a model struggles, adjust `activeTools` per phase via `prepareStep` (probe phase does not need `set_plan`; teach phase does not need `set_plan` after approval) — fewer tools per step, same method.

### Anti-Pattern 4: Memoising provider choice at boot

**What people do:** Keep `backend()`'s "decided once at first call" behaviour and add the new providers to it.
**Why it's wrong:** The settings page becomes a lie; every change needs a restart, and `/api/providers` detection results go stale.
**Do this instead:** `settings.load()` per turn (a JSON read is microseconds); cache only detection probes that spawn processes (`claude auth status`) with a short TTL.

### Anti-Pattern 5: Hand-written HTTP validation next to a zod schema

**What people do:** Keep the `QUIZ_PURPOSES.includes` checks in `index.ts` and add more for new fields.
**Why it's wrong:** CONCERNS.md already lists the 500s this produces (`set_plan` with `nodes: "x"`, `node_status` with an unknown status).
**Do this instead:** `validate(action, body)` from the contract at the top of the route; the switch keeps only the hold/terminal semantics and the `teachingGap` gate.

### Anti-Pattern 6: Summing Agent SDK `total_cost_usd` across results

**What people do:** Add `msg.total_cost_usd` from every `result` message.
**Why it's wrong:** The installed typings say it is cumulative per `query()` in streaming-input sessions and resets on resume/clear; summing double-counts.
**Do this instead:** Record `modelUsage` per model per turn (it has `costUSD`, cache and web-search counts); use `total_cost_usd` only as the turn's display value, as today.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Claude Agent SDK (0.3.x, pinned `latest` today) | Existing driver; `modelUsage` for usage; `tools: ['WebSearch','WebFetch']` stays | Pin to a caret range (CONCERNS.md); the sink boundary makes SDK event-shape changes a one-file fix |
| Codex SDK 0.154.0 | Existing driver; MCP child process per turn | Cache the `Codex` client per lesson (CONCERNS.md); `Usage` has `cache_write_input_tokens` — record it |
| AI SDK `ai` 7.0.x + `@ai-sdk/{anthropic,openai,google,openai-compatible}` 4.x/3.x, `@openrouter/ai-sdk-provider` 3.x, `ai-sdk-ollama` 4.x | Owned loop | All peer on `ai ^7`; zod 4 is supported; verify each provider's tool-calling on the chosen default models in Phase research |
| `@github/copilot-sdk` 1.0.x (GA) | `CopilotClient` over JSON-RPC to the bundled CLI; `createSession({ model, systemMessage: { mode: 'replace' }, tools \| mcpServers, streaming: true })`; `resumeSession(id)`; `session.abort()` | Auth is the logged-in GitHub user; `assistant.usage` gives tokens and cost; MCP config supports stdio servers with `tools: ['*']`, so Derive's `mcp.js` attaches like it does for Codex |
| Gemini CLI 0.60 | Two options: headless `gemini -p --output-format stream-json` per turn with `GEMINI_SYSTEM_MD=<file>` (full system-prompt replacement) and `mcpServers` in a per-lesson `.gemini/settings.json`; or ACP mode (`gemini --acp`, JSON-RPC over stdio: `initialize` registers the client's MCP server, `newSession`/`loadSession`/`prompt`/`cancel`) | Session resume in headless mode and ACP stdout hygiene (issue #22647) are unverified; treat as the riskiest driver and research at phase time |
| Search: Brave (2 k free q/mo), Tavily (`@tavily/core`), Exa (`exa-js`), SearXNG (self-hosted) | `SearchProvider` interface, key in secrets, chosen in settings | Provider-native search (Anthropic/OpenAI/Google tools) is the default when the model provider has it |
| models.dev `api.json` | Committed snapshot → `pricing.json`; optional refresh | Units are USD per 1M tokens; fields `cost.{input,output,cache_read,cache_write,reasoning}`, `limit.{context,output}` (use `limit.context` for compaction thresholds) |
| Claude Code plugin marketplace | `.claude-plugin/marketplace.json` at repo root, `source: './plugin'` | Plugin manifest already exists at `plugin/.claude-plugin/plugin.json`; unify the version string with the release workflow |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `index.ts` ↔ `turn.ts` | Direct calls `runTurn`, `interrupt`, `isBusy` (same names as `agent.ts` exports today) | `index.ts` does not change its imports beyond the module path |
| `turn.ts` ↔ `drivers/*` | `Driver.runTurn(ctx, sink)`; abort via `ctx.signal` | Drivers never import `events.ts`, `db.ts` (except through `ctx`), or `index.ts` |
| `drivers/*` ↔ `contract/` | `toAgentSdk` / `toAiSdk` / `mcp.js` child with `toMcp` | Tool handlers always end in `actions.*`; the ARCHITECTURE anti-pattern "grading in the driver" still applies |
| `index.ts` external action route ↔ `contract/validate` | `safeParse` before the switch | 400 with the zod message; the api test suite gets stable error codes |
| `turn.ts` ↔ `usage.ts` / `pricing.ts` | `recordUsage(lessonId, turnSeq, usage, driver, model)` after the driver returns | Price lookup is pure; `cost_source` says how the number was obtained |
| `settings.ts` ↔ everything | `load()` returns a frozen object; `save()` writes and re-validates | Env variables from `config.ts` become the override layer, not the source |
| Web `StyleProvider` ↔ `/api/learners/:id` | Fetch on learner change; optimistic localStorage | `PATCH /api/learners/:id { style }` reuses the existing prefs route pattern with a `cleanStyle` sibling of `cleanPrefs` |
| `scripts/gen-skills.mjs` ↔ `contract/` | Imports the built `server/dist/contract/*` | Runs in `pnpm build` and in CI with a diff check |

## Suggested Build Order

Dependencies drive the order; each step is shippable on its own and keeps the plugin and Codex paths working (PROJECT.md compatibility constraint).

1. **Contract consolidation** (`contract/tools.ts`, `adapters.ts`, `method.ts`, generator, HTTP `validate`, CI diff check). No behaviour change; the existing api tests are the regression net. Everything after this depends on it. Also fold in the small debts on the same files: version string from `package.json`, `codex/skills/*/SKILL.md` generated.
2. **Driver seam + sink** (`turn.ts`, `sink.ts`, `drivers/types.ts`, move `agent.ts` → `drivers/claude-agent-sdk.ts`, `codex.ts` → `drivers/codex.ts`). Add the `usage` table and write rows from the two existing drivers (Agent SDK `modelUsage`, Codex `usage`). Extend `turn_end` payload. Sink gets a unit test with a fake driver.
3. **Settings + providers** (`settings.ts`, `providers.ts`, `/api/settings`, `/api/providers`, settings page). Replaces `backend()` memo. Needed before the owned loop has keys to use; also a visible feature on its own (choose Claude vs Codex in the app).
4. **Owned loop** (`drivers/ai-sdk.ts`, `ai-sdk-models.ts`, `turn_messages`, `web/` with cache and SSRF guard, `pricing.ts` + snapshot). Ship Anthropic/OpenAI/Google keys and OpenRouter first (native or provider search available), then Ollama/LM Studio/llama.cpp with Derive's search provider. Parity check: the api test suite run through the owned loop with a stub model, plus a manual lesson per provider.
5. **Usage page** (`/api/usage`, Usage route in the web app). Small once 2 and 4 exist.
6. **CLI-subscription drivers**: Copilot SDK first (stable SDK, MCP or in-process tools, usage events), Gemini CLI second (needs phase research: ACP vs headless, resume, system prompt file).
7. **Style preferences** (`learners.style`, `StyleProvider`, CSS variable layer, tone into the prompt). Independent of 2–6; can run in parallel with 4–6 if hands allow.
8. **Distribution** (`bin`, package bundling `web/dist`, cwd-independent static serving, `marketplace.json`, docs site with generated pages, release workflow bumps versions). Last because docs and the marketplace should describe the finished provider layer.

Learning-experience work (method quality, friction, motivation) is not architectural and slots in anywhere after 1; it touches `actions.ts`, `prompt.ts`/`method.ts` and the web pages, none of which the provider layer moves.

## Sources

Verified against installed packages (HIGH):
- `server/node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts` 0.3.261 — `tool(name, description, AnyZodRawShape, handler)`, `ModelUsage`, `total_cost_usd` semantics
- `server/node_modules/@openai/codex-sdk/dist/index.d.ts` 0.154.0 — `Usage {input_tokens, cached_input_tokens, cache_write_input_tokens, output_tokens}`
- `server/node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.d.ts` 1.30.0 — `registerTool` with `ZodRawShapeCompat | AnySchema`
- `server/src/{agent,codex,events,backend,config,prompt,tools}.ts`, `web/src/lib/useLesson.ts`, `web/src/index.css` — existing seams
- npm registry (2026-09-17): `ai` 7.0.105, `@ai-sdk/anthropic` 4.0.56, `@ai-sdk/openai` 4.0.69, `@ai-sdk/google` 4.0.74, `@ai-sdk/openai-compatible` 3.0.51, `@openrouter/ai-sdk-provider` 3.0.0, `ai-sdk-ollama` 4.3.0, `@github/copilot-sdk` 1.0.14, `@google/gemini-cli` 0.60.0, `@modelcontextprotocol/server` 2.0.0, `@napi-rs/keyring` 2.1.0, `@tavily/core` 0.7.12, `exa-js` 2.22.0; `ai` peers `zod ^3.25.76 || ^4.1.8`

Official documentation via WebFetch (MEDIUM):
- https://ai-sdk.dev/docs/agents/loop-control — `stopWhen`, `isStepCount`, `hasToolCall`, `prepareStep`, `pruneMessages`
- https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text — `fullStream` part types, usage fields, `abortSignal`, `maxRetries`
- https://ai-sdk.dev/docs/agents/building-agents — `ToolLoopAgent` options and callbacks
- https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling — `tool()` signature, execute options (`abortSignal`, `toolCallId`, `messages`)
- https://ai-sdk.dev/providers/openai-compatible-providers — `createOpenAICompatible`, `includeUsage`
- https://ai-sdk.dev/providers/ai-sdk-providers/anthropic — `webSearch_20260318`, `webFetch_20260318`, cache token fields
- https://ai-sdk.dev/providers/ai-sdk-providers/openai — `openai.tools.webSearch`, Responses API, `reasoningTokens`
- https://ai-sdk.dev/providers/ai-sdk-providers/google — `googleSearch()`, `urlContext()`, `usageMetadata`
- https://github.com/modelcontextprotocol/typescript-sdk (README, main = v2) — Standard Schema, `zod/v4`
- https://github.com/github/copilot-sdk/blob/main/nodejs/README.md — `CopilotClient`, `createSession`, events, `resumeSession`, auth
- https://docs.github.com/en/copilot/how-tos/copilot-sdk/features/usage-and-billing and https://github.com/github/copilot-sdk/issues/1073 — `assistant.usage`, cache fields zero
- https://geminicli.com/docs/cli/headless/ — `-p`, `--output-format json|stream-json`, event types, exit codes
- https://geminicli.com/docs/cli/acp-mode/ — `gemini --acp`, `initialize`/`newSession`/`loadSession`/`prompt`/`cancel`
- https://geminicli.com/docs/cli/system-prompt/ — `GEMINI_SYSTEM_MD` full replacement
- https://github.com/google-gemini/gemini-cli/issues/22647 — ACP stdout corruption (open risk)
- https://code.claude.com/docs/en/plugin-marketplaces — `marketplace.json` schema and source forms
- https://models.dev/api.json — provider/model/cost structure

Web search summaries (LOW; directional only):
- Search-provider comparisons: https://aimultiple.com/agentic-search, https://lennney.com/en/blog/ai-agent-search-api-guide, https://michaellivs.com/blog/web-search-for-agents-2026/
- Secret storage practice: https://github.com/cli/cli/discussions/12488, https://github.com/Brooooooklyn/keyring-node

---
*Architecture research for: Derive provider layer, owned loop, contract, web tools, usage, settings, style, distribution*
*Researched: 2026-09-17*
