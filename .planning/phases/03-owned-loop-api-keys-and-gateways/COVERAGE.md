# API Coverage — Vercel AI SDK v7 (`ai@7.0.126`) and its five provider adapters

> Full coverage by default. Opt-outs are explicit, reasoned decisions.
> Capability surface enumerated from `node_modules/ai/dist/index.d.ts`'s export list and the
> shipped `docs/` tree, as recorded in `03-RESEARCH.md` §Standard Stack, §Findings 1-11 and
> §State of the Art. A second integration against the same need (the fallback search providers
> below) starts from its own full-coverage baseline rather than inheriting these opt-outs.

| capability | decision | reason |
|---|---|---|
| `streamText` (streaming generation) | INTEGRATE | |
| `tool()` + function tools | INTEGRATE | |
| `jsonSchema()` (pre-projected input schema) | INTEGRATE | |
| `stopWhen` / `isStepCount` (multi-step loop bound) | INTEGRATE | |
| `instructions` as an array of system messages | INTEGRATE | |
| `providerOptions` (per-provider request options) | INTEGRATE | |
| `abortSignal` (Stop) | INTEGRATE | |
| `maxRetries` (set to 0; Derive owns the backoff) | INTEGRATE | |
| `APICallError` narrowing (`statusCode`, `responseHeaders`, `isRetryable`) | INTEGRATE | |
| `fullStream` part handling (`text-*`, `tool-call`, `tool-result`, `finish-step`, `abort`, `error`) | INTEGRATE | |
| `start-step.warnings` / `result.warnings` (`CallWarning`) | INTEGRATE | |
| per-step `usage` + `inputTokenDetails` / `outputTokenDetails` | INTEGRATE | |
| `providerMetadata` (OpenRouter cost, Anthropic raw usage) | INTEGRATE | |
| `ModelMessage` persistence and round-trip | INTEGRATE | |
| `toolOrder` (stable tool order for prefix caching) | INTEGRATE | |
| Anthropic `cacheControl` prompt caching | INTEGRATE | |
| Anthropic `disableParallelToolUse` | INTEGRATE | |
| OpenAI `parallelToolCalls` | INTEGRATE | |
| OpenRouter `parallelToolCalls` + `usage: { include: true }` | INTEGRATE | |
| `createOpenAICompatible` (+ `includeUsage`) | INTEGRATE | |
| provider-native web search (`anthropic.tools.webSearch_*`, `openai.tools.webSearch`, `google.tools.googleSearch`) | INTEGRATE | |
| `fetch:` override on every provider factory (redirect refusal) | INTEGRATE | |
| OpenAI `strict` per-tool mode (projection built and CI-validated) | INTEGRATE | |
| `ai/test` doubles (`MockLanguageModelV4`, `simulateReadableStream`) | INTEGRATE | |
| `generateText` (non-streaming) | OPT-OUT | not needed — every Derive turn streams; a second generation path would be a second loop to keep in parity |
| `generateObject` / `streamObject` (structured output) | OPT-OUT | not needed — Derive's structured results arrive as tool calls, never as `response_format` |
| `embed` / `embedMany` / embedding models | OPT-OUT | not needed — material and library search are lexical (`materials.ts`, `library.ts`); there is no vector index |
| image models / `generateImage` | OPT-OUT | not needed — the tutor teaches in markdown, LaTeX and mermaid |
| `transcribe` / `generateSpeech` (speech models) | OPT-OUT | not needed — voice mode runs on the browser's `speechSynthesis` / `SpeechRecognition` (`web/src/lib/voice.ts`), which keeps audio off the provider |
| `ToolLoopAgent` (`Experimental_Agent`) | OPT-OUT | explicitly out of scope — it hides the per-step usage, per-call serialisation and orphan-patching seams D-05/D-07/D-08/D-12 require (`03-RESEARCH.md` §Alternatives Considered) |
| `pruneMessages` (history compaction) | OPT-OUT | explicitly out of scope — D-24 refuses a lesson that outgrows the window rather than compacting, so the understanding gate never rests on a summary |
| `prepareStep` (per-step model / tool switching) | OPT-OUT | explicitly out of scope — per-lesson model switching and tiered roles are out of scope for this milestone (PROJECT.md) |
| `streamRetries` | OPT-OUT | explicitly out of scope — the SDK's own doc warns partial emitted output cannot be retracted, which would persist half a sentence as an `assistant` event |
| `repairToolCall` | OPT-OUT | not needed yet — a malformed tool call surfaces as a provider sentence; repairing it silently would let a narrower dialect reshape the tool contract |
| tool approval (`tool-approval-request` / `tool-output-denied`) | OPT-OUT | not needed — Derive's cards already block on the learner; a second approval layer would gate the tutor twice |
| provider-executed fetch / URL context (`anthropic.tools.webFetch_*`, Gemini URL context) | OPT-OUT | explicitly out of scope — D-21 rejects provider fetch: it bypasses `assertPublicHost` and would be a second code path for one method sentence |
| `telemetry` (`experimental_telemetry`) | OPT-OUT | not needed — the server logs startup facts and failures only, never per request |
| AI Gateway (`@ai-sdk/gateway`, `gateway()` model strings) | OPT-OUT | explicitly out of scope — nothing in this milestone may require hosted infrastructure the author runs for others (PROJECT.md constraint) |
| MCP client (`experimental_createMCPClient`) | OPT-OUT | not needed — Derive **is** the MCP server (`server/src/mcp.ts`); the owned loop's tools are in-process |
| multimodal input parts (`FilePart`, `ImagePart`) | OPT-OUT | not needed — `materials.ts` extracts PDF/PPTX/DOCX to text before anything reaches a model, and `FilePart.data` is the one `ModelMessage` shape that does not survive the JSON round trip |
| reasoning output exposure (`reasoning-delta` text) | OPT-OUT | explicitly out of scope — D-09: the learner sees a `Thinking` status line and never the reasoning text, so the lesson's durable record stays the tutor's teaching |
| `onStepStart` / `onToolExecutionStart` / `onLanguageModelCall*` callbacks | OPT-OUT | not needed — `fullStream` carries every part this phase reads; a second observation channel would be two places to keep in agreement |

## Second integration — OpenRouter's own HTTP API

Baseline re-decided for this surface, not inherited.

| capability | decision | reason |
|---|---|---|
| `POST /api/v1/chat/completions` (through `@openrouter/ai-sdk-provider`) | INTEGRATE | |
| `GET /api/v1/models` (model list) | INTEGRATE | already wired in Phase 2 as `providers.ts` `openrouter.modelsPath` |
| usage accounting on the response (`usage.cost`) | INTEGRATE | |
| `GET /api/v1/generation` (authoritative post-hoc cost) | OPT-OUT | explicitly out of scope — D-03 rejects a second round trip: it puts a new failure mode in the hot path of every response |
| `plugins` / `web_search_options` (OpenRouter-hosted web search) | OPT-OUT | explicitly out of scope — D-20 assigns OpenRouter to the pluggable fallback search path |
| `GET /api/v1/credits` (balance) | OPT-OUT | not needed — budgets and balance display moved to v2 under the simplicity rule |
| provider routing / `order` / `allow_fallbacks` preferences | OPT-OUT | not needed yet — a learner picks a model slug; routing preferences are a control with no learning reason |

## Third integration — the fallback search providers (D-22)

Baseline re-decided for this surface, not inherited.

| capability | decision | reason |
|---|---|---|
| Tavily `POST /search` | INTEGRATE | |
| Tavily `answer` field | OPT-OUT | explicitly out of scope — the method requires the tutor to verify a fact, not to adopt a search engine's conclusion |
| Tavily `raw_content` / `/extract` | OPT-OUT | not needed — D-21's `fetch_page` reads a page through `library.ts` `fetchPublic`, which carries the SSRF guard and the byte caps |
| Tavily `/crawl`, `/map` | OPT-OUT | not needed — the tutor checks a fact; it does not crawl a site |
| Tavily `usage` (credit consumption) field | OPT-OUT | not needed — there is no credit ledger in this milestone, and `03-RESEARCH.md` A7 says free-tier size must not be quoted anywhere |
| SearXNG `GET`/`POST /search?format=json` | INTEGRATE | |
| SearXNG `/autocompleter` | OPT-OUT | not needed — nothing in Derive types a search query by hand; the tutor writes it |
| SearXNG `/config` | OPT-OUT | not needed — the "JSON format not enabled" case is detected from the search response itself, so no second endpoint is required |
