# Phase 3: Owned Loop: API Keys and Gateways - Research

**Researched:** 2026-10-01
**Domain:** Vercel AI SDK v7 tool-calling loop across five providers; per-provider JSON Schema dialects; usage/cost accounting; prompt caching; retries, abort and message persistence
**Confidence:** HIGH for the SDK surface (installed `ai@7.0.126` and the five provider packages this session, read their shipped `docs/` and `.d.ts`, and ran four executable probes under `node --import tsx --test`); MEDIUM for vendor-side behaviour that only a real key can show (Anthropic's `server_tool_use` in streaming, Gemini's rejected schema keywords); LOW for search-provider free tiers.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

Copied verbatim from `.planning/phases/03-owned-loop-api-keys-and-gateways/03-CONTEXT.md` `## Implementation Decisions`.

#### The loop and its adapters

- **D-01:** Derive's own loop is built on **Vercel AI SDK v7** — one `streamText` loop bounded by `stopWhen`, with `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google`, `@openrouter/ai-sdk-provider` and `createOpenAICompatible` for the base-URL row. The SDK normalises messages, tool calls, streaming and usage, so one loop serves five providers and Phase 4's Ollama, LM Studio and llama.cpp arrive on the same loop rather than beside it. Accepted cost: roughly five new dependencies in a package file that has held nine pinned ones, and a MEDIUM-confidence `providerMetadata` path for OpenRouter's per-response cost. **Explicitly rejected:** native provider SDKs with three message shapes, three tool-call shapes and three stream parsers to maintain; and a hand-rolled fetch layer, which `server/src/probe.ts` shows is viable for a models list but not for a streaming tool-call loop. — **Reversibility:** costly — the adapter table, the message persistence shape and Phase 4's local providers all read the SDK's `LanguageModel` and `ModelMessage` types; replacing it later rewrites the driver and the `turn_messages` codec, though the loop's semantics recorded here are portable.

- **D-02:** **One `api` driver plus a per-provider adapter table.** A single file in `server/src/drivers/` holds one `runTurn` and one loop; a table keyed by `ProviderId` supplies the model factory, the schema dialect, the native-search tool, the cache-control hook and the usage/cost reader. Adding a sixth provider is one table row beside `server/src/providers.ts` — which is the milestone's whole point. Mirrors how `probe.ts` already switches on a `ProviderSpec` rather than on a chain of branches. **Explicitly rejected:** one driver per provider (the loop, the retry policy and the tool dispatch would exist five times, where a fix to one can miss four) and inline `if (provider === …)` branching.

- **D-03:** When OpenRouter's per-response cost is absent from `providerMetadata`, **fall back to the pricing table with `cost_source: 'table'`** and let the learner's label move from `billed` to `estimated`. The roadmap's own stated fallback. **Explicitly rejected:** a second round trip to OpenRouter's `/api/v1/generation` for the authoritative figure — it puts a new failure mode in the hot path of every response; and recording tokens with no money figure at all, which leaves a learner on a paid provider reading a partial total.

- **D-04:** **Phase 2 D-04 still holds now that Derive owns the messages.** `turn_messages` persists provider-neutral AI SDK `ModelMessage`s so resume-after-interrupt works within one provider, and a provider change **drops them**; the tutor rebuilds from the lesson's events and nodes, exactly as the Claude and Codex paths already do. The reason is concrete rather than conservative: carrying history across a switch means replaying Anthropic thinking parts and Gemini thought signatures into a provider that rejects them. **Explicitly rejected:** carrying a sanitised history across the switch (reverses a decision Phase 2 marked costly), and one parked thread per provider (two histories and no answer to which is the lesson's).

- **D-05:** A turn is bounded by a **generous step cap of about 400**, matching today's `maxTurns: 400` so no existing lesson behaves differently, and hitting it **ends the turn through the normal `turn_end` with a continuable status** — the same shape as a Stop, never a lost lesson. The cap is a runaway guard, not a teaching limit.

- **D-06:** **Prompt caching ships in v1** as a stable-prefix split: the stable prefix (the rendered method text and the tool contract) carries Anthropic `cache_control`; the volatile tail (material, library, learner profile, lesson state) follows it. OpenAI and Gemini cache automatically and need only the prefix kept byte-stable. The method text alone is ~29KB in `server/src/method.generated.ts` and the loop resends it on every step, so this is the single largest cost saving available — and COST-01 already records cache read and cache write tokens, so the saving is visible in the ledger from the first lesson. — **Reversibility:** reversible.

- **D-07:** **Tool-call idempotency is persisted.** Each executed tool call's id and its result are stored alongside `turn_messages`, so a replay after a crash or a restart returns the recorded result instead of re-running the tool. This is the only version under which PROV-08's "interrupting a turn and resuming continues the lesson" is literally true rather than usually true, and the only one that stops a replay re-grading a quiz and corrupting the learner's FSRS record. **Explicitly rejected:** an in-memory `Set` per turn (covers a provider's retry, not a restart — and the restart case is the one that damages the memory record) and auditing the 22 tools to be naturally idempotent (grading is not, and the guarantee would live in 22 places forever). — **Reversibility:** costly — a table other resume behaviour reads; the grain is chosen now.

- **D-08:** Parallel tool calls are **disabled at the provider where the flag exists and serialised unconditionally in the loop** as the backstop — one call at a time, results returned in the order received. Belt and braces, because Derive's cards block on the learner and a provider that ignores the flag must not be able to open two.

#### What the learner sees mid-turn

- **D-09:** The learner **does not see the model's reasoning**. An ephemeral `status` line reading `Thinking` — exactly what `server/src/agent.ts` emits today — and never the reasoning text. It is identical on every provider, which matters because some return only a token count or an encrypted blob and could never show it, and the lesson's durable record stays the tutor's teaching rather than its scratchpad. No new `EVENT_TYPES` entry, no `applyEvent` branch, nothing new in the Obsidian mirror.

- **D-10:** The **"provider busy" state is ephemeral**: a `status` line reading `Provider busy, retrying in Ns` while the backoff runs, and when the retries are exhausted the existing `turn_end` error path carries the provider's own sentence. A transient stall is not part of what the learner learned, so it does not enter the event log, the reducer or their notes. Follows Phase 1 D-14's rule for live cost.

- **D-11:** **Retries are patient, up to roughly two minutes.** Honour the provider's `Retry-After` header when it sends one, exponential backoff with jitter otherwise, with the countdown visible and Stop working throughout. A free-tier Gemini or OpenRouter rate limit can be a full minute, and a lesson that dies on it is a dead lesson; a learner who does not want to wait presses Stop.

- **D-12:** **Stop aborts, patches orphans, and stays resumable.** Abort the request, write a synthesized error `tool_result` for every orphaned tool call so `turn_messages` stays a history a provider will accept, end the turn as **interrupted rather than failed** (the existing `stopping` map already draws that distinction), and let the learner's next message continue from there. The roadmap names the orphan synthesis; this is what makes PROV-08's resume clause hold.

#### Cost in the lesson

- **D-13:** The figure goes **into the existing provider pill, after the model**: `anthropic · claude-opus-5-5 · about $0.14 estimated`, in the 60px header of `web/src/pages/Lesson.tsx`. The model id takes the truncation (the pill is already `max-w-[40ch] truncate`); the cost never truncates. One element on the screen rather than two, and the pill already links to `/settings`, which is where a learner who dislikes the number goes.

- **D-14:** The label vocabulary is **four words, not three**: `provider` → `billed`, `table` → `estimated`, `subscription` → `not billed`, `unknown` → **`not reported`**. Phase 1 D-16 introduced `unknown` precisely so an upgraded install's backfilled turns and the plugin/Codex paths could say the honest blank out loud; folding it into another word would assert something the ledger does not know.

- **D-15:** The pricing table is a **committed pure-data module with a `PRICES_AS_OF` date**, the same shape and the same discipline as `server/src/providers.ts` and its `DEFAULTS_AS_OF`: no I/O, no import-time side effect, readable by a test with no database behind it. A price change is a reviewable diff, it works with the network off, and nothing in the cost path can fail. **Explicitly rejected:** fetching prices at runtime (a network call behind a cost figure, against the local-first constraint) and a shipped-plus-refresh hybrid (two sources of truth for one number).

- **D-16:** The learner overrides prices through **`~/.derive/prices.json`, merged over the shipped table, read live, with no UI** — following the pattern `server/src/keys.ts` and `server/src/credentials.ts` already establish twice: an absent file is silent, an unreadable one is loud and nothing writes while that error stands. `/settings` gains **one sentence** naming the file and the as-of date, and no new control. That is what satisfies COST-04 without putting twenty number inputs on the page whose job is picking a provider. — **Reversibility:** reversible.

- **D-17:** The cost figure **recomputes at `turn_end`**, from the usage rows the turn actually wrote; it does not tick up mid-turn. One settled number, no new ephemeral traffic on the SSE stream while the learner is reading a card, and a long turn shows the previous total until it finishes — the same honesty rule the provider pill already follows under Phase 2 D-15.

- **D-18:** The **Home row carries the lesson's total** in the same wording as the header, summed from that lesson's usage rows — a `SUM` away given Phase 1 D-13's per-request grain. Phase 5 inherits one short string per row rather than a component.

- **D-19:** Money is written to **two decimals with a floor**: `about $0.14`, and anything non-zero below a cent reads `under $0.01` rather than rounding to nothing. Exactly zero keeps its label (`not billed` / `not reported`) instead of a figure. A sub-cent lesson must not read as free on a metered key.

#### Web search and fetch

- **D-20:** **Native search where the provider has one** (Anthropic, OpenAI, Gemini), the pluggable provider otherwise — PROV-09's own wording. Three of the five providers then need no second account, and the fallback runs only where it must. Two things the researcher must settle: that a native server-side search tool coexists with the strict tool-schema projection of D-23, and that its separate per-call charge (Anthropic bills searches apart from tokens) lands in the usage ledger rather than vanishing from the lesson's cost.

- **D-21:** **Fetch is one Derive tool over the library fetcher.** A new entry in the tool registry implemented on `library.ts`'s `fetchPublic(url, accept, maxBytes, guard)` plus `assertPublicHost`, identical on all five providers — one implementation, one SSRF guard already hardened under Phase 1 D-10, one status line, and it appears in the wire-surface snapshot like every other tool. `{{WEB_TOOLS}}` gains a third rendering for the owned-loop surface, which is exactly what that placeholder exists for. **Explicitly rejected:** routing fetch through `add_resource` (it would make every page the tutor glances at a permanent library entry, which the method deliberately limits to one or two per lesson) and using a provider's own URL-context feature where it has one (two code paths for one method sentence, and the provider's fetch bypasses the guard).

- **D-22:** The fallback search is configured in **one small "Web search" block on `/settings`**, under the provider rows: a choice of the provider's own / Tavily / SearXNG, its key stored in `secrets.json` behind D-10's masked `{ set, hint }` shape and its base URL in the settings table, saved as-you-go per D-03. The one-sentence learning reason the simplicity rule asks for: *the method requires the tutor to verify a fact before teaching it, and a learner on OpenRouter has no way to do that without this.* **Explicitly rejected:** environment variables only (a learner who installed Derive to learn rather than to configure it would silently lose the verification discipline with no way to find out why) and catalogue rows beside the providers (`teaches: false` already means something else there).

- **D-23:** When no search is available at all, **`{{WEB_TOOLS}}` renders as an instruction that there is no web search on this provider and that the tutor must say when it is unsure rather than guess.** One render change, no method rule lost, well inside the bounded per-surface variation Phase 1 D-02 allows — and the Settings block states why search is unavailable so the learner can fix it. **Explicitly rejected:** refusing to teach without search (it would block the free OpenRouter path this phase exists to open and Phase 4's entire offline promise) and leaving the prompt unchanged (a model told to verify with a tool that is not there asserts instead).

#### The context-window limit

- **D-24:** A lesson that outgrows the window **refuses with a clear card naming the next step** — the lesson has grown too long, start a review lesson on these nodes. Every locked node, every FSRS row and the graph are already persisted, so nothing is lost and the review path already exists. The roadmap's stated first version, and the only one under which silent truncation can never drop the understanding gate. **Explicitly rejected:** compacting the middle of the history (the gate would then rest on a summary the model wrote about itself) and auto-splitting into a seeded new lesson (lesson-splitting machinery, and a second meaning for "this lesson" that Phase 5's Home would have to explain).

- **D-25:** The limit is detected by **estimating the prompt conservatively against the model's known window and refusing at a headroom threshold, before the request**. The learner gets Derive's own sentence and next step rather than a provider error, it behaves identically on all five providers, and the same estimator is what Phase 4 needs to size Ollama's `num_ctx` and to check a model's window through `/api/show`. **Explicitly rejected:** waiting for the provider's context-length error (five error shapes to recognise, a wasted request each time, and an unrecognised wording reaches the learner raw).

#### Catalogue flip and the WR-01 defect

- **D-26:** **WR-01 is fixed in this phase.** `LearnerPrefs.model` becomes `Record<provider, modelId>`, `chooseModel` reads `prefs.model?.[provider]`, and a migration converts an existing bare string onto the provider that was active when it was stored. This is the fix `02-REVIEW.md` itself proposed. The reason it belongs here rather than in Phase 5: this phase takes the number of teaching providers from two to seven, which is what turns a latent bug into one learners will actually hit — and PROJECT.md already carries it as an Active requirement with no phase assigned. — **Reversibility:** one-way — a migration of a stored learner preference; reverting needs a second migration that cannot recover which provider an id was meant for.

- **D-27:** The **Claude Code row stays `teaches: true`** and keeps running the app's tutor on the Claude Code login through the Agent SDK; its `note` is reworded to point a learner who wants in-app Claude at the Anthropic key row beside it. PROJECT.md's decision was about which route Derive *recommends*, not about deleting a driver that works. The five unwired rows (`anthropic`, `openai`, `gemini`, `openrouter`, `openai-compatible`) flip to `teaches: true` and lose the `unwired()` sentence promising teaching "with the next release" — in the release that delivers it.

#### Tool schema projection (PROV-10)

- **D-28:** **The projection adapts; the registry is untouched.** `jsonSchemaOf(spec, surface)` in `server/src/tools.ts` gains per-dialect projection: an optional becomes required-and-nullable for OpenAI strict mode, unsupported keywords are dropped for Gemini, descriptions are shortened for the compact form Phase 4 needs. The full zod schema remains what the server validates incoming tool calls against, so a provider's narrower dialect never narrows what Derive accepts. **Explicitly rejected:** simplifying the registry's shapes to a common subset — that lets the weakest dialect dictate the tool contract for every provider, and a description is what the model reads, so changing one changes the tutor. — **Reversibility:** reversible.

- **D-29:** CI checks the dialects **two ways**: each dialect's projection is added to `server/test/wire-surface.json` so any change is a reviewable diff per Phase 1 D-08, **and** the dialect rules are asserted outright — strict mode has `additionalProperties: false` with every key in `required`, Gemini uses no rejected keyword. A snapshot alone would happily freeze an invalid schema; the rules check is what catches a projection that is stable and wrong.

### Claude's Discretion

The user did not open these; the planner decides them in the direction recorded here.

- **Where the API driver lives:** one new file under `server/src/drivers/` beside `fake.ts`, with the adapter table either in it or in a sibling module; `server/src/agent.ts` and `codex.ts` stay as they are.
- **The `turn_messages` schema:** a table added through the Phase 1 migration runner, scoped by lesson, holding the serialised `ModelMessage` array plus the executed-call-id/result record of D-07. Whether those are one table or two is the planner's call; the grain of D-07 is not.
- **Exact SDK version and provider package pins:** pin to exact versions in `server/package.json` the way `ts-fsrs`, `unpdf` and `fflate` are, not a caret, and never `latest` — Phase 1 already had to fix that for the Agent SDK.
- **Which models the pricing table covers at launch:** the curated defaults in `providers.ts` plus the common siblings, with `PRICES_AS_OF` set to the implementation day; a model absent from the table prices as `unknown` → `not reported`, never as zero.
- **The step-cap number and the headroom fraction of D-25:** pick concrete values and write the reasoning beside them.
- **Where cost is computed:** a pure function over usage rows plus the pricing table, in its own module with no HTTP or SQL awareness, so it is testable the way `schedule.ts` is.
- **Status-line vocabulary for the new tools:** the native search tool and the fetch tool of D-21 need `label` entries; reuse today's wording — `Verifying with a web search`, `Reading a source` — so the learner sees no change between the plugin and the owned loop.
- **How the API suite drives the owned loop with a stub model (Success Criterion 1):** `setDriverOverride` already exists for exactly this, and `drivers/fake.ts` is the precedent; whether the stub is a fake `LanguageModel` handed to the real loop (which tests the loop) or a fake driver (which does not) is the planner's call — the criterion is better served by the former.
- **`.env.example` and `scripts/doctor.mjs`:** document the search-provider variables and report whether a pricing override file is present; never a key.

### Deferred Ideas (OUT OF SCOPE)

None raised that belong elsewhere — the discussion stayed inside the phase, and two items that could have been deferred were deliberately folded in instead (D-26, D-27) with the reason recorded on each.

Recorded here so nobody re-opens them during Phase 3:

- Local models, `num_ctx` sizing, capability probes and tool-rejection-rate recording — Phase 4 (PROV-06, PROV-07). They ride this phase's loop by construction; D-25's estimator and D-28's compact dialect are the two hooks they need.
- "Test teaching" from Settings — Phase 4 (PROV-11).
- The nightly method-conformance harness — Phase 4 (PROV-13).
- The usage page with running totals by provider, model and lesson — Phase 4 (COST-03). D-13's and D-18's figures are the same sum it will show.
- Live cost ticking during a turn — rejected in D-17, not deferred. Reopening it needs a learning reason, not a preference.
- Showing the model's reasoning to the learner — rejected in D-09 on parity and record-purity grounds.
- Per-lesson model switching and tiered roles (strong model plans, cheap model explains) — out of scope for this milestone (PROJECT.md).
- Copilot and Gemini CLI drivers — v2 (PROJECT.md).
- Budgets, cost-per-node analytics and capability badges — moved to v2 on 2026-09-17 under the simplicity rule; D-19's rounding and D-18's row are the whole of what cost shows.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROV-01 | Learner can run the tutor on an Anthropic API key through Derive's own agent loop; in-app Claude uses the key, the Claude Code plugin remains the subscription route | §Standard Stack (`@ai-sdk/anthropic@4.0.71`), §Pattern 1 (the verified loop skeleton), §Pattern 4 (cache-control prefix), D-27 note in §Decision-vs-API |
| PROV-02 | Learner can run the tutor on an OpenAI API key | §Standard Stack (`@ai-sdk/openai@4.0.83`, Responses API is the default factory), §Pitfall 6 (strict mode is opt-in, not required) |
| PROV-03 | Learner can run the tutor on a Google Gemini API key | §Standard Stack (`@ai-sdk/google@4.0.87`), §Pitfall 2 (function tools are **dropped** when a provider tool is added on a pre-Gemini-3 model), §Pitfall 7 (no parallel-tool flag on Gemini) |
| PROV-04 | Learner can run the tutor through OpenRouter, with exact per-response cost recorded | §Finding 3 — exact path `providerMetadata.openrouter.usage.cost`, requires `usage: { include: true }`; §Pitfall 4 (the catalogue's OpenRouter default model id is not a valid slug) |
| PROV-05 | Learner can run the tutor through any OpenAI-compatible endpoint by entering a base URL and key | §Standard Stack (`createOpenAICompatible` from `@ai-sdk/openai-compatible@3.0.62`), §Pitfall 5 (`includeUsage` defaults off → no usage at all), §Security (redirect-follow key leak) |
| PROV-08 | Owned loop keeps full parity: same tools, same method, sequential tool execution, resume after interruption, retries with a visible "provider busy" status | §Finding 1 (`stopWhen`/`isStepCount`), §Finding 5 (the SDK runs tool calls with `Promise.all` — serialisation is Derive's job), §Finding 6 (abort: `responseMessages` rejects; build history from `fullStream`), §Finding 8 (`maxRetries: 0` to own the backoff) |
| PROV-09 | Web search and fetch on every provider: native tools where they exist, otherwise a pluggable provider with a fetch that reuses the library fetcher | §Finding 4 (all three native search tools verified to coexist with function tools and to typecheck), §Don't Hand-Roll (`fetchPublic`), §Finding 10 (Tavily / SearXNG) |
| PROV-10 | Tool schemas projected per provider dialect and validated in CI; incoming calls validated against the full schema server-side | §Finding 7 (what the registry emits today, keyword inventory, the zod `override`/`target` seam, what each provider normalises for you and what it does not) |
| COST-02 | Learner sees the estimated cost of each lesson in the lesson header and on Home, labelled billed, estimated or not billed | §Finding 2 (per-`finish-step` usage grain = Phase 1 D-13's per-request grain), §Pitfall 1 (`inputTokens` includes cache tokens — do not double-count), §Integration (`turns.driver` collapses five providers into one label) |
| COST-04 | Prices come from a versioned pricing table with a "prices as of" date the learner can override locally | §Finding 9 (a verified, machine-readable price + context-window seed from OpenRouter's `/api/v1/models`, usable at authoring time without violating D-15) |

</phase_requirements>

---

## Summary

The locked decisions survive contact with the real API, with six corrections and one genuine conflict. `ai@7.0.126` with `@ai-sdk/anthropic@4.0.71`, `@ai-sdk/openai@4.0.83`, `@ai-sdk/google@4.0.87`, `@ai-sdk/openai-compatible@3.0.62` and `@openrouter/ai-sdk-provider@3.1.0` are the current, mutually compatible set; all five ship their own documentation inside the package, which is what most of this research is drawn from. A single `streamText` call with `stopWhen: isStepCount(400)`, `instructions` as an array of system messages, a `tools` object mixing Derive's registry tools with one provider-native search tool, `maxRetries: 0`, and an `abortSignal` compiles cleanly under this repo's exact compiler flags (TypeScript 7.0.2, `module: NodeNext`, `strict`) and runs a deterministic multi-step tool loop under `node --import tsx --test` against `MockLanguageModelV4` — both verified by execution this session. OpenRouter's per-response cost is **confirmed**, not MEDIUM: `providerMetadata.openrouter.usage.cost`, present on the streaming `finish-step` part when the request carries `usage: { include: true }`, absent otherwise, which is exactly D-03's fallback condition.

The one real conflict is **D-08**. The SDK executes every tool call of a step with `await Promise.all(...)` and offers no option to serialise them; the provider-level flags exist on Anthropic, OpenAI and OpenRouter but **not on Gemini**. So "serialised unconditionally in the loop" cannot be a loop setting — it has to be a per-lesson promise-chain mutex wrapped around each tool's `execute`, which I verified works and preserves arrival order. The five corrections: `usage.inputTokens` **includes** cache-read and cache-write tokens where the repo's `input_tokens` column means the uncached part (map from `inputTokenDetails.noCacheTokens` or every cached lesson double-counts); OpenAI strict mode is **opt-in per tool** and off by default, so D-28's strict projection is a choice rather than a requirement; adding a provider-native search tool to a **pre-Gemini-3** model silently drops all 14 Derive function declarations; `createOpenAICompatible` reports **no usage at all** unless `includeUsage: true`; and `result.responseMessages` **rejects** after an abort, so D-12's orphan patching must read a history the driver accumulated from `fullStream` itself.

Three repo-side facts will bite the first task that ignores them. `turns.driver` is the only record of what ran a turn — `providerOfDriver(driver)` is the identity function outside `claude`, the header pill reads it, and `usage.driver` is denormalised from it — so a single driver literally named `api` erases the provider from the ledger and from the pill; write `tutor.provider` into that column instead and D-04's provider-change rule becomes correct for free. `server/test/wire-surface.test.ts` asserts `DERIVE_TOOL_NAMES` deep-equals a hard-coded 14-name list, `TOOL_LABELS` deep-equals a hard-coded 14-label map, and `ALL_TOOL_NAMES.length === 22` / `live.mcp.length === 22` / `live.http.length === 16`; D-21's fetch tool breaks all five and the test's own doc comment forbids regenerating the fixture to go green, so moving those numbers is a deliberate, reviewed task. And no provider key exists anywhere in this environment, so Success Criteria 1 and 2 cannot be shown by any automated test — the suite must run on a stub `LanguageModel` and the real-key runs belong behind `checkpoint:human-verify`.

**Primary recommendation:** build one `server/src/drivers/api.ts` around the verified `streamText` skeleton in §Code Examples; keep `Driver.name` equal to the `ProviderId` so the ledger and the pill stay honest; accumulate `ModelMessage`s from `fullStream` as the turn runs (never from `responseMessages`), write one `usage` row per `finish-step`, serialise tool execution with a per-lesson mutex inside `execute`, set `maxRetries: 0` and own the backoff, and hand each provider a `jsonSchema(...)` built by Derive's own per-dialect projection rather than passing zod schemas through.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| The tool-calling loop (one turn) | API / Backend (`server/src/drivers/api.ts`) | — | `Driver.runTurn(ctx, sink)` is the existing seam; the loop reads `TurnContext` and reports through `EventSink` and nothing else |
| Provider selection, key, model | API / Backend (`settings.ts` `resolveTutor`) | — | Resolved per turn in `agent.ts` `runTurn`; the driver must not read `process.env` or the settings table itself |
| Tool execution (the 14 tutor tools + fetch) | API / Backend (`actions.ts`) | — | Phase 1 put every learning-science decision in `actions.ts`; the driver dispatches, it never grades |
| Tool schema projection per dialect | API / Backend (`tools.ts` `jsonSchemaOf`) | — | One registry, many projections; the server still validates incoming calls against the full zod schema |
| Message persistence / resume | Database (`turn_messages` via `migrations.ts`) | API / Backend | Provider-neutral `ModelMessage[]` plus the executed-call record; scoped by lesson |
| Usage recording | Database (`usage` table via `sink.usage`) | API / Backend | Phase 1 D-13/D-14: one row per model request, never an event |
| Cost computation | API / Backend (new pure module) | — | Pure function over usage rows + pricing table; no HTTP, no SQL, testable like `schedule.ts` |
| Price override file | API / Backend (`~/.derive/prices.json`) | — | Same file-backed, read-live, absent-is-silent pattern as `keys.ts` |
| Web search (native) | Provider (server-side tool) | API / Backend | Executed inside the provider; Derive only reads the per-call charge out of `providerMetadata` |
| Web search (fallback) + fetch | API / Backend (`library.ts` `fetchPublic`) | — | One SSRF guard, one implementation, one status line |
| Cost + label rendering | Browser (`Lesson.tsx` header, `Home.tsx` row) | API / Backend | Browser renders what the API returns; no new event type, no new component |
| Context-window refusal | API / Backend (pre-request check in the driver) | — | Derive's own sentence before the request, identical on five providers |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ai` | `7.0.126` | `streamText`, `tool`, `isStepCount`/`stepCountIs`, `jsonSchema`, `pruneMessages`, `ModelMessage`, `APICallError`, `ai/test` doubles | The one loop D-01 names. `engines.node: ">=22"`, peer `zod: ^3.25.76 \|\| ^4.1.8` — satisfied by this repo's Node 22.22.2 and `zod@4.6.5`. `[VERIFIED: npm view ai version → 7.0.126; node_modules/ai/package.json; installed and executed this session]` `[WARNING: flagged as suspicious — verify before using.]` |
| `@ai-sdk/anthropic` | `4.0.71` | Anthropic key row; `anthropic.tools.webSearch_20260318`, `providerOptions.anthropic.cacheControl`, `disableParallelToolUse` | `[VERIFIED: npm view; package docs/05-anthropic.mdx read this session]` `[WARNING: flagged as suspicious — verify before using.]` |
| `@ai-sdk/openai` | `4.0.83` | OpenAI key row; `openai(...)` is the **Responses API** by default, `openai.chat(...)` for Chat Completions; `openai.tools.webSearch`, `parallelToolCalls` | `[VERIFIED: npm view; package docs/03-openai.mdx line 123 "It is the default API that is used by the OpenAI provider (since AI SDK 5)"]` `[WARNING: flagged as suspicious — verify before using.]` |
| `@ai-sdk/google` | `4.0.87` | Gemini key row; `createGoogleGenerativeAI`, `google.tools.googleSearch` | `[VERIFIED: npm view; package docs/15-google.mdx]` `[WARNING: flagged as suspicious — verify before using.]` |
| `@openrouter/ai-sdk-provider` | `3.1.0` | OpenRouter row; `createOpenRouter`, `openrouter.chat(id, { usage: { include: true } })` | The **only** one of the five that declares `peerDependencies: { ai: '^7.0.0' }`, which pins the whole set to AI SDK 7. `[VERIFIED: npm view @openrouter/ai-sdk-provider@3.1.0 peerDependencies]` `[WARNING: flagged as suspicious — verify before using.]` |
| `@ai-sdk/openai-compatible` | `3.0.62` | The base-URL row; exports `createOpenAICompatible` | This is the package that exports `createOpenAICompatible` — it is **not** in `@ai-sdk/openai`. `[VERIFIED: node_modules/@ai-sdk/openai-compatible/dist/index.d.ts:407 `export declare function createOpenAICompatible`]` `[WARNING: flagged as suspicious — verify before using.]` |

All five provider packages depend on `@ai-sdk/provider@4.0.21` and `@ai-sdk/provider-utils@5.0.53`; `ai@7.0.126` depends on the same two plus `@ai-sdk/gateway@4.0.102`. One lockfile resolution, no duplication. `[VERIFIED: npm view <pkg> dependencies for all six]`

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `ai/test` (subpath of `ai`) | ships with `ai@7.0.126` | `MockLanguageModelV4`, `simulateReadableStream`, `mockId`, `mockValues`, `convertReadableStreamToArray` | Success Criterion 1's stub model. No extra dependency. `[VERIFIED: node -e "Object.keys(require('ai/test'))" → MockLanguageModelV4, MockLanguageModelV3, simulateReadableStream, mockId, mockValues, convertArrayToAsyncIterable, convertArrayToReadableStream, convertReadableStreamToArray, …]` |
| `zod` | `4.6.5` (already a dependency) | `z.toJSONSchema(schema, { target, io, override })` is the D-28 projection seam | Already in `server/package.json` as `^4.6.5`. No new dependency for the dialect work. |

**No new dependency is needed** for: the stub model, the schema projection, the token estimator (write a pure function), the pricing table, or the search fallback (`fetch` + `library.ts`).

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `streamText` + Derive's own outer bookkeeping | `ToolLoopAgent` (exported as `Experimental_Agent`) | `ToolLoopAgent` is the ergonomic wrapper with its own default `isStepCount(20)`. It would hide exactly the seams D-05/D-07/D-08/D-12 need (per-step usage, per-call serialisation, orphan patching). Use `streamText`. `[VERIFIED: node_modules/ai/docs/03-agents/04-loop-control.mdx; node_modules/ai/dist/index.d.ts:5663]` |
| `execute`-bearing tools inside one `streamText` | Tools with **no** `execute` and a manual outer loop | A tool without `execute` is simply not run and the loop stops with the call unanswered — verified. That gives perfect serialisation and idempotency control, at the cost of one `streamText` call per step (losing the SDK's own message assembly and step bookkeeping). The mutex-inside-`execute` route keeps one call per turn and was verified to serialise correctly; prefer it. `[VERIFIED: executed probe — `no-execute doStreamCalls 1`, assistant tool-call message present, no tool result]` |
| A tokenizer dependency for D-25 | A pure character-based estimator | `js-tiktoken`/`gpt-tokenizer` would be a sixth dependency, is wrong for Anthropic and Gemini anyway, and D-25 only needs a *conservative* number. A pure `ceil(chars / 3)` floor-style estimate (deliberately over-counting) in its own module is testable with no I/O, matches the repo's `schedule.ts` discipline, and is what Phase 4 reuses for `num_ctx`. `[ASSUMED]` that `chars/3` is conservative enough across all three tokenizers — needs the planner to pick the divisor and write the reasoning beside it, per the discretion note. |

**Installation:**
```bash
pnpm --filter server add ai@7.0.126 @ai-sdk/anthropic@4.0.71 @ai-sdk/openai@4.0.83 @ai-sdk/google@4.0.87 @ai-sdk/openai-compatible@3.0.62 @openrouter/ai-sdk-provider@3.1.0
```
Exact pins, no caret — the discretion note requires it, and it is what `ts-fsrs`, `unpdf` and `fflate` already do. Note `packageManager` in the root `package.json` is `pnpm@12.5.1` and the machine has pnpm 12.5.1; the lockfile must be committed in the same change.

---

## Package Legitimacy Audit

> `gsd-tools query package-legitimacy check --ecosystem npm …` run this session.

| Package | Registry | Latest version published | Weekly downloads | Source Repo | Verdict | Disposition |
|---------|----------|--------------------------|------------------|-------------|---------|-------------|
| `ai` | npm | 2026-09-30 | 32,670,518 | github.com/vercel/ai | **SUS** (`too-new`) | Flagged — planner must add checkpoint |
| `@ai-sdk/anthropic` | npm | 2026-09-30 | 16,178,371 | github.com/vercel/ai | **SUS** (`too-new`) | Flagged — planner must add checkpoint |
| `@ai-sdk/openai` | npm | 2026-09-30 | 16,895,599 | github.com/vercel/ai | **SUS** (`too-new`) | Flagged — planner must add checkpoint |
| `@ai-sdk/google` | npm | 2026-09-30 | 10,378,335 | github.com/vercel/ai | **SUS** (`too-new`) | Flagged — planner must add checkpoint |
| `@ai-sdk/openai-compatible` | npm | 2026-09-30 | 9,807,582 | github.com/vercel/ai | **SUS** (`too-new`) | Flagged — planner must add checkpoint |
| `@openrouter/ai-sdk-provider` | npm | 2026-09-19 | 3,801,582 | github.com/OpenRouterTeam/ai-sdk-provider | **SUS** (`too-new`) | Flagged — planner must add checkpoint |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** all six — the planner must insert a `checkpoint:human-verify` before the install task.

**Why the flag fires, so the checkpoint is cheap:** the single reason returned for every package is `too-new`, which keys on the *latest version's* publish date, not the package's age. The AI SDK publishes several times a day. Every other signal is clean: 3.8M–32.7M weekly downloads, canonical source repos, `deprecated: false`, and `npm view <pkg> scripts.postinstall` returns empty for all six `[VERIFIED: npm view scripts.postinstall, all six → no value]`. I also installed all six into a scratch directory this session, read their shipped `docs/` and `.d.ts`, and compiled and executed code against them. The checkpoint should confirm the six names and versions, nothing more.

---

## Architecture Patterns

### System Architecture Diagram

```
                      POST /api/lessons/:id/message
                                   │
                                   ▼
                  ┌────────────────────────────────────┐
                  │ agent.ts runTurn(lessonId, prompt) │
                  │  • resolveTutor() → provider/model │
                  │  • pick driver                     │
                  │  • startTurn(…, PROVIDER_ID, model)│──▶ turns row
                  │  • emit turn_start                 │──▶ events (SSE)
                  │  • build instructions              │
                  └────────────┬───────────────────────┘
                               │ Driver.runTurn(ctx, sink)
          ┌────────────────────┼─────────────────────┬──────────────┐
          ▼                    ▼                     ▼              ▼
   claudeDriver          codexDriver            apiDriver (new)   fakeDriver
   (Agent SDK)           (Codex SDK)                  │
                                                      ▼
                       ┌──────────────────────────────────────────────────┐
                       │ 1. load turn_messages for this lesson            │
                       │    (dropped if the provider changed — D-04)      │
                       │ 2. pre-request headroom check (D-25)             │
                       │      over ? refuse card, turn_end, stop          │
                       │ 3. adapter table[providerId] →                   │
                       │      model factory · dialect · native search     │
                       │      · cache hook · usage/cost reader            │
                       │ 4. streamText({ model, instructions[2],          │
                       │      messages, tools, stopWhen: isStepCount(400),│
                       │      maxRetries: 0, abortSignal, providerOptions})│
                       └───────────────┬──────────────────────────────────┘
                                       │ for await (part of fullStream)
      ┌────────────────────────────────┼───────────────────────────────────┐
      ▼              ▼                 ▼              ▼            ▼       ▼
 text-start/     tool-call        tool-result    finish-step    error    abort
 text-delta/         │                 │              │           │        │
 text-end            │                 │              │           │        │
      │              │                 │              │           │        │
 sink.emit/          │            append to      sink.usage(row)   │   synthesize
 emitEphemeral/   status line    accumulated      (one per model   │   error tool_result
 emitUpdate       + MUTEX'd      ModelMessage[]    request)        │   for orphans,
 ('assistant')    execute via    + record call id  + read cost     │   turn_end
                  actions.ts     for D-07          from            │   {interrupted}
                       │                           providerMetadata│
                       ▼                                          ▼
                 actions.ts ──▶ prompts.ts (card blocks)   retryable?
                            ──▶ db.ts (FSRS, nodes)        → status 'Provider busy,
                            ──▶ events.ts (quiz/ask/…)       retrying in Ns'
                                                           → own backoff, re-enter 4
                                       │
                                       ▼
                        persist turn_messages + executed calls
                                       │
                                       ▼
                        sink.endTurn({ ok, … }) ──▶ turns row + turn_end event
                                       │
                                       ▼
                    cost = f(usage rows, pricing table)  ──▶ GET /api/lessons/:id
                                                          ──▶ GET /api/lessons
                                                               (header pill, Home row)
```

### Recommended Project Structure

```
server/src/
├── drivers/
│   ├── fake.ts            # unchanged
│   ├── api.ts             # the one runTurn + the one loop (D-02)
│   └── adapters.ts        # Record<ProviderId, Adapter>: model factory, dialect,
│                          #   native search tool, cache hook, cost reader
├── pricing.ts             # pure data + PRICES_AS_OF (D-15), the providers.ts template
├── prices.ts              # ~/.derive/prices.json merge, read live (D-16), keys.ts pattern
├── cost.ts                # pure: (UsageRow[], PriceTable) -> { usd, source } (discretion)
├── context.ts             # pure: conservative token estimate + window table (D-25)
├── search.ts              # Tavily / SearXNG fallback behind one function (D-22)
├── tools.ts               # + ToolDialect projection (D-28), + fetch_page tool (D-21)
├── migrations.ts          # + v6 turn_messages, + v7 prefs.model re-key (D-26)
└── settings.ts            # chooseModel reads prefs.model?.[provider] (D-26)
```

### Pattern 1: One `streamText` per turn, history accumulated from `fullStream`

**What:** The driver owns the `ModelMessage[]` it will persist, building it from stream parts rather than asking the SDK for it at the end.
**When to use:** Always, in this driver. It is the only shape under which D-12 (orphan patching after abort) and D-07 (per-call idempotency record) are implementable.
**Why not `result.responseMessages`:** it is a promise that **rejects** when the stream is aborted, so the one moment you need the history most is the one moment it is unavailable. `[VERIFIED: executed probe — "responseMessages threw learner pressed stop"; onAbort reported steps.length === 0 for the in-flight step]`

### Pattern 2: Serialise tool execution with a per-lesson promise chain inside `execute`

**What:** Each tool's `execute` enters a lesson-scoped mutex before doing anything.
**When to use:** Unconditionally, on every provider — this is D-08's backstop, and on Gemini it is the *only* mechanism.
**Why:** the SDK runs a step's tool calls with `await Promise.all(toolCallsToExecute.map(...))`. There is no `sequential` option. `[VERIFIED: node_modules/ai/dist/index.js:7772 `await Promise.all(toolCallsToExecute.map(async (toolCall) => {`]`

### Pattern 3: `instructions` as an array of system messages for the cache split

**What:** `instructions: [{ role: 'system', content: STABLE, providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } } }, { role: 'system', content: VOLATILE }]`
**When to use:** Every request, on every provider (the second entry is simply uncached where the provider has no breakpoint concept).
**Why this and not `messages`:** `streamText`'s `allowSystemInMessages` defaults to **`false`**, so system messages placed in `messages` are refused; `instructions` is typed `string | SystemModelMessage | Array<SystemModelMessage>` and is the sanctioned place. Verified end to end: the second model call received prompt roles `["system","system","user","assistant","tool"]`. `[VERIFIED: node_modules/ai/dist/index.d.ts type Prompt — "allowSystemInMessages … @default false"; executed probe printed the roles]`

### Pattern 4: Hand each provider a projected JSON Schema, not a zod schema

**What:** `tool({ description, inputSchema: jsonSchema<Input>(projected), strict: dialect.strict, execute })` where `projected` comes from Derive's own `jsonSchemaOf(spec, surface, dialect)`.
**Why:** when `inputSchema` is a zod schema the SDK runs its own zod→JSON-Schema conversion, which emits `"$schema": "http://json-schema.org/draft-07/schema#"` — **draft-07**, where this repo's `jsonSchemaOf` emits draft-2020-12. Passing zod through means the bytes on the wire are not the bytes in `wire-surface.json`, which defeats D-29's whole purpose. `[VERIFIED: executed probe printed the second call's tools — `{"type":"function","name":"quiz","inputSchema":{"$schema":"http://json-schema.org/draft-07/schema#",…}}` for the zod tool, and the exact object passed for the `jsonSchema(...)` tool]`

### Pattern 5: Adapter table keyed by `ProviderId`, mirroring `probe.ts`'s `requestFor`

**What:** `Record<ProviderId, { model(key, base, modelId): LanguageModel; dialect: ToolDialect; search: () => Tool | null; providerOptions: ProviderOptions; cost(pm, usage): { usd: number | null; source: CostSource } }>`
**Why:** `probe.ts` already proves the shape — one `switch (spec.id)` that builds a per-provider request from catalogue data, with no logic duplicated per provider.

### Anti-Patterns to Avoid

- **Naming the driver `api`.** `providerOfDriver(driver) = driver === 'claude' ? 'claude-code' : driver` — the driver name *is* the provider id everywhere else, `lessonView` feeds it straight to the header pill, and `recordUsage` denormalises it onto every usage row. One driver named `api` collapses five providers into one label and makes COST-03's "by provider" impossible later. `[VERIFIED: server/src/providers.ts:219; server/src/index.ts:276-283; server/src/db.ts:654-670]`
- **Letting the SDK retry.** `maxRetries` defaults to **2**, retries only `isRetryable === true` errors, caps any `retry-after` it honours at 60 s, adds no jitter, and shows the learner nothing. D-11 wants ~2 minutes with a visible countdown and a working Stop. Set `maxRetries: 0`. `[VERIFIED: node_modules/ai/dist/index.d.ts type RequestOptions "@default 2"; node_modules/ai/dist/index.js:2551-2568 getRetryDelayInMs — `(ms < 6e4 || ms < exponentialBackoffDelay)`]`
- **Mapping `usage.inputTokens` to the `input_tokens` column.** See Pitfall 1.
- **Emitting a reasoning event.** `fullStream` carries `reasoning-start` / `reasoning-delta` / `reasoning-end`. D-09 says a `status` line reading `Thinking` on `reasoning-start` and nothing else. No `EVENT_TYPES` change.
- **Regenerating `wire-surface.json` to make the suite green.** The test's own doc comment forbids it: "Never regenerate it merely to make this test go green."
- **Routing the SearXNG base URL through `assertPublicHost`.** A learner's SearXNG is very often on `localhost` or a `.local` name; `assertPublicHost` throws for exactly those. Use `probe.ts`'s `isLocalUrl` posture for the configured search endpoint (timeout and sentence shape) and keep `assertPublicHost` for the *result URLs* the tutor then fetches.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-provider message / tool-call / stream shapes | Three parsers | `ai@7` `ModelMessage` + `fullStream` | D-01's entire premise; verified across five provider packages |
| Fetching a page for the tutor | A new fetcher | `library.ts` `fetchPublic(url, accept, maxBytes, guard)` + `assertPublicHost` | Redirect-hop guard, content-length and byte caps, SSRF address check, 8-scheme allow-list, all hardened under Phase 1 D-10 |
| Provider error → learner sentence | A second error vocabulary | `probe.ts` `providerSentence(status, text)` + `hintFor(label, status, sentence)` | Already handles OpenAI/OpenRouter/Gemini/Anthropic/Ollama/llama.cpp envelopes, collapses to one line, caps at 300 chars, and `hintFor` already special-cases 401/402/429 |
| Reading `Retry-After` | A header parser | `APICallError.isInstance(e)` then `e.responseHeaders?.['retry-after']` (and `'retry-after-ms'`) | `APICallError` exposes `statusCode`, `responseHeaders`, `responseBody`, `isRetryable`. `[VERIFIED: @ai-sdk/provider d.ts class APICallError; executed probe asserted both fields]` |
| A key-safe HTTP client | A wrapper | Pass `fetch:` to each provider factory (all five accept it) | See §Security — the SDK's `postToApi` uses default `redirect: 'follow'` |
| A test double for the model | A fake driver | `MockLanguageModelV4` from `ai/test` + `simulateReadableStream` | A fake driver tests the sink, not the loop; the stub model tests the loop. Verified under `node --import tsx --test` |
| Serialising tool calls | A provider flag alone | Provider flag **plus** a per-lesson mutex | Gemini has no flag; the SDK has no option |
| Pruning / compacting history | Your own compactor | `pruneMessages({ messages, reasoning, toolCalls, emptyMessages })` — *for the record only* | D-24 refuses rather than compacts. Noted so a later phase does not reinvent it. `[VERIFIED: node_modules/ai/dist/index.d.ts:6706]` |

**Key insight:** every piece of this phase that looks like plumbing already exists in the repo or in the SDK. The genuinely new code is small: the loop, the adapter table, the dialect projection, the cost function, the estimator, and two strings in the browser.

---

## Findings

### Finding 1 — The `streamText` call shape (D-01, D-05) · HIGH

`streamText({ … })` accepts, among ~50 options: `model`, `tools`, `toolChoice`, `toolOrder`, `activeTools`, `instructions` (`system` is deprecated), `prompt`, `messages`, `allowSystemInMessages`, `maxRetries`, `streamRetries`, `abortSignal`, `timeout`, `headers`, `stopWhen`, `prepareStep`, `providerOptions`, `repairToolCall`, `includeRawChunks`, `onChunk`, `onError`, `onStart`, `onStepStart`, `onStepEnd` (`onStepFinish` deprecated), `onEnd` (`onFinish` deprecated), `onAbort`, `onToolExecutionStart`, `onToolExecutionEnd`, `onLanguageModelCallStart`, `onLanguageModelCallEnd`. `[VERIFIED: node_modules/ai/dist/index.d.ts:3690 — the destructured parameter list]`

- `stopWhen?: Arrayable<StopCondition<TOOLS>>`, **`@default isStepCount(1)`** for `streamText`. D-05's cap is therefore mandatory, not optional: without `stopWhen` the loop makes exactly one model call. `[VERIFIED: index.d.ts, the `stopWhen` doc comment]`
- The step-cap helper is **`isStepCount(n)`**. `stepCountIs` still exists as an alias (`isStepCount as stepCountIs` in the export list) and `assert.equal(stepCountIs, isStepCount)` passed in my probe. Prefer `isStepCount`. Also available: `hasToolCall(...names)`, `isLoopFinished()`, and any `StopCondition = ({ steps }) => boolean`. `[VERIFIED: index.d.ts:1957/1964/1971 and the final export statement; executed probe]`
- The loop stops when: a finish reason other than tool-calls is returned; **a tool that is invoked has no `execute`**; a tool call needs approval; or a `stopWhen` condition is met. `[CITED: node_modules/ai/docs/03-agents/04-loop-control.mdx]`
- `toolOrder` exists specifically "to improve provider-side caching by keeping tool definitions in a stable order" — relevant to D-06, since the tool contract is part of the stable prefix. Tools not listed are appended alphabetically. `[VERIFIED: index.d.ts, the `toolOrder` doc comment]`
- `fullStream` part types (`TextStreamPart`): `start`, `start-step`, `text-start`, `text-delta`, `text-end`, `reasoning-start`, `reasoning-delta`, `reasoning-end`, `tool-input-start`, `tool-input-delta`, `tool-input-end`, `tool-call`, `tool-result`, `tool-error`, `tool-output-denied`, `tool-approval-request`, `tool-approval-response`, `source`, `file`, `reasoning-file`, `custom`, `finish-step`, `finish`, `abort`, `error`, `raw`. My probe observed exactly `start, start-step, tool-call, tool-result, finish-step, text-start, text-delta, text-end, finish` for a two-step tool turn. `[VERIFIED: index.d.ts type TextStreamPart; executed probe]`
- Node/ESM/NodeNext: `engines.node: ">=22"`, and a realistic 60-line driver skeleton exercising all five providers, three native search tools, `strict: true`, `jsonSchema(...)`, `providerOptions`, `usage.inputTokenDetails.*`, `providerMetadata` reads and `APICallError` narrowing compiled with **exit code 0** under `tsc --target ES2022 --module NodeNext --moduleResolution NodeNext --strict --esModuleInterop --skipLibCheck --types node` using TypeScript 7.0.2. `[VERIFIED: executed this session]`

**Manual tool execution.** A tool declared with `outputSchema` and **no** `execute` is not run; the loop stops with the assistant tool-call message present and no tool result, and the model is called exactly once. That is the manual-loop door if the planner wants it. `[VERIFIED: executed probe — `doStreamCalls 1`, `responseMessages [{"role":"assistant","content":[{"type":"tool-call","toolCallId":"c9",…}]}]`; node_modules/ai/dist/index.js:7767 `if (tool.execute != null && chunk.providerExecuted !== true) toolCallsToExecute.push(chunk);`]`

### Finding 2 — Usage, and the per-request grain (COST-01/02) · HIGH

There are **two** usage shapes and confusing them is the most likely cost bug in this phase.

The SDK-facing shape, which is what `finish-step.usage`, `result.usage` and `result.totalUsage` carry:
```ts
type LanguageModelUsage = {
  inputTokens: number | undefined;
  inputTokenDetails: { noCacheTokens, cacheReadTokens, cacheWriteTokens };
  outputTokens: number | undefined;
  outputTokenDetails: { textTokens, reasoningTokens };
  totalTokens: number | undefined;
  raw?: JSONObject;   // the provider's own usage object, verbatim
};
```
`[VERIFIED: node_modules/ai/dist/index.d.ts:332 type LanguageModelUsage]`

The provider-spec shape, which is what a `MockLanguageModelV4` must emit and what the shipped testing doc shows:
```ts
type LanguageModelV4Usage = {
  inputTokens:  { total, noCache, cacheRead, cacheWrite };
  outputTokens: { total, text, reasoning };
  raw?: JSONObject;
};
```
`[VERIFIED: node_modules/@ai-sdk/provider/dist/index.d.ts:675]`

My probe fed `inputTokens: { total: 120, noCache: 100, cacheRead: 20 }` twice and `finish-step.usage` came back as `{"inputTokens":120,"inputTokenDetails":{"noCacheTokens":100,"cacheReadTokens":20},"outputTokens":30,"outputTokenDetails":{"textTokens":25,"reasoningTokens":5},"totalTokens":150}`, with `totalUsage` summing to `inputTokens: 240`. `[VERIFIED: executed probe]`

**The grain.** `finish-step` is emitted once per model call and carries that call's `usage` and `providerMetadata` — exactly Phase 1 D-13's "usage per model request". Write one `sink.usage(row)` per `finish-step`, never one per turn. My probe saw two `finish-step` parts for a two-step turn. `[VERIFIED: index.d.ts type TextStreamFinishStepPart; executed probe]`

**The mapping to `UsageInput`:**

| `UsageInput` field | Read from | Note |
|---|---|---|
| `model` | `finish-step.response.modelId` (fall back to the asked model) | `LanguageModelResponseMetadata.modelId` |
| `input_tokens` | **`usage.inputTokenDetails.noCacheTokens`** | **not** `usage.inputTokens` — see Pitfall 1 |
| `output_tokens` | `usage.outputTokens` | |
| `cache_read_tokens` | `usage.inputTokenDetails.cacheReadTokens` | |
| `cache_write_tokens` | `usage.inputTokenDetails.cacheWriteTokens` | |
| `reasoning_tokens` | `usage.outputTokenDetails.reasoningTokens` | |
| `cost_usd` / `cost_source` | adapter's cost reader (see Finding 3) | |

Keep `agent.ts`'s existing `reported(v)` helper discipline: a count the provider did not give stays `null`, never `0`.

### Finding 3 — OpenRouter's per-response cost (D-03, PROV-04) · HIGH, and no longer MEDIUM

The exact path is **`providerMetadata.openrouter.usage.cost`**, a `number | undefined`, with `providerMetadata.openrouter.usage.costDetails.upstreamInferenceCost` beside it.

```ts
type OpenRouterUsageAccounting = {
  promptTokens: number;
  promptTokensDetails?: { cachedTokens: number };
  completionTokens: number;
  completionTokensDetails?: { reasoningTokens: number };
  totalTokens: number;
  cost?: number;
  costDetails?: { upstreamInferenceCost: number };
};
```
`[VERIFIED: node_modules/@openrouter/ai-sdk-provider/dist/index.d.ts:570-586, and the typed `doGenerate` return at :686-691 — `providerMetadata?: { openrouter: { provider: string; reasoning_details?: …; usage: OpenRouterUsageAccounting } }`]`

**It requires a request option.** The provider sends `usage: this.settings.usage` in the request body, so the figure only appears when `usage: { include: true }` is set. Two equivalent ways, both verified to typecheck:
- model-level: `openrouter.chat('anthropic/claude-opus-5.5', { usage: { include: true } })`
- per-call: `providerOptions: { openrouter: { usage: { include: true } } }` — `providerOptions.openrouter` is spread directly into the request body.

`[VERIFIED: dist/index.js:4315 `usage: this.settings.usage`; dist/index.js:4357-4358 the providerOptions spread; dist/index.d.ts:524-531 `usage?: { include: boolean }` with the doc link to openrouter.ai/docs/use-cases/usage-accounting]`

**On the streaming path** the compiled provider sets `openrouterUsage.cost` only `if (value.usage.cost != null)`, builds `openrouterMetadata = { usage: openrouterUsage }`, sets `usage.raw = rawUsage`, and enqueues `{ type: 'finish', usage, providerMetadata: { openrouter: openrouterMetadata } }`. So the cost rides the stream's finish part, which `streamText` surfaces on `finish-step.providerMetadata` — my probe confirmed a `providerMetadata` injected at the provider's `finish` arrives unchanged on `finish-step.providerMetadata` **and** on the top-level `result.providerMetadata`, and that `usage.raw` passes through verbatim. `[VERIFIED: dist/index.js:4667-4675 and :5018-5042; executed probe printed `pm {"openrouter":{"usage":{"cost":0.0123,…}}}`]`

**Caveat worth planning around:** the typed narrowing of `providerMetadata` exists only on `doGenerate`'s declared return type. `doStream` is declared as the plain `LanguageModelV4['doStream']`, so on the streaming path the read is against `ProviderMetadata = Record<string, JSONObject>` and must be defensive (`(pm?.openrouter as {usage?:{cost?:number}})?.usage?.cost ?? null`). That compiles and is the shape I verified. When it is `null`, D-03's fallback fires: price from the table, `cost_source: 'table'`, label `estimated`.

### Finding 4 — Native web search (D-20) · HIGH for coexistence, MEDIUM for the charge

**(a) Does a native server-side search tool coexist with the function-tool set?**

| Provider | Tool | Coexists with the 14 function tools? |
|---|---|---|
| Anthropic | `anthropic.tools.webSearch_20260318({ maxUses, allowedDomains, blockedDomains, userLocation, responseInclusion })` (also `webSearch_20260209`, `webSearch_20250305`; and `webFetch_20260318`) | **Yes.** All tools go into one `tools` object; Anthropic has no strict-mode interaction. Requires web search enabled in the org's Console privacy settings. `[CITED: @ai-sdk/anthropic/docs/05-anthropic.mdx §Web Search Tool]` |
| OpenAI | `openai.tools.webSearch({ … })` (Responses API) | **Yes.** `prepareResponsesTools` pushes function tools and provider tools into the same `openaiTools` array with no exclusion. `[VERIFIED: @ai-sdk/openai/dist/index.js:5301-5360]` |
| Gemini | `google.tools.googleSearch({})` | **Conditionally.** See Pitfall 2 — on a pre-Gemini-3 model the function declarations are **dropped**. |
| OpenRouter | `plugins` / `web_search_options` on the model settings (`@see openrouter.ai/docs/features/web-search`) | Not researched in depth; D-20 assigns OpenRouter to the fallback path, so this is out of scope. `[ASSUMED]` |
| openai-compatible | none | Fallback path by construction. |

All three native tools, declared alongside two function tools in one `tools` object, typecheck under the repo's exact flags. `[VERIFIED: executed `tsc --noEmit`, exit 0]`

**(b) Where does the separate per-call charge surface?**

For Anthropic, the raw usage object is copied verbatim into two places: `usage.raw` (via `convertAnthropicUsage`'s `raw: rawUsage ?? usage`) and `providerMetadata.anthropic.usage` (the whole `rawUsage` object at `message_stop`). The streaming path merges each `message_delta.usage` with `rawUsage = { ...rawUsage, ...value.usage }`, and the response schema parses usage as `z.looseObject({...})`, so unknown keys survive. Therefore **`providerMetadata.anthropic.usage.server_tool_use.web_search_requests`** is the path, with `usage.raw.server_tool_use.web_search_requests` as the equivalent. `[VERIFIED: @ai-sdk/anthropic/dist/index.js:1874-1913 convertAnthropicUsage; :5065-5067 the rawUsage merge; :5072-5074 `usage: rawUsage ?? null` inside anthropicMetadata; :372 `usage: z.looseObject({`]`. Whether Anthropic actually populates `server_tool_use` in `message_delta.usage` on a streaming request is the vendor's behaviour and I could not exercise it without a key — `[ASSUMED]`, needs a `checkpoint:human-verify`.

The ledger has no column for a search count or a non-token charge. The honest options, in preference order: (1) add the search charge into the `finish-step`'s `cost_usd` when the count is present and the price table carries a per-search rate, leaving `cost_source: 'table'` for that component — the search price is in the table anyway (Finding 9 shows `web_search: $0.01/call` for Anthropic and OpenAI, `$0.014` for Gemini); (2) record it as its own `usage` row with all token columns null. Option (1) keeps the lesson total correct with no schema change and is what I would recommend; option (2) is more auditable and costs a migration. **This is a real decision the planner must make and name**, because D-20 explicitly asks that the charge "lands in the usage ledger rather than vanishing from the lesson's cost".

For OpenAI's native search, no per-call count is exposed through the SDK's provider metadata that I could find — `[ASSUMED]` that it must be inferred from the number of `tool-call` parts with the provider-executed search tool name (`providerExecuted: true` is on `tool-input-start`), which is countable from `fullStream`. That counting approach works identically for all three providers and may be the simpler uniform answer.

### Finding 5 — Serialising tool calls (D-08) — **the one real conflict** · HIGH

The SDK executes a step's tool calls concurrently and offers no option to change it:

```js
case "model-call-end":
  if (!isToolExecutionAllowedFinishReason(chunk.finishReason)) return;
  await Promise.all(toolCallsToExecute.map(async (toolCall) => { … executeToolCall({ … }) … }));
```
`[VERIFIED: node_modules/ai/dist/index.js:7771-7772]`

Provider-level flags, verified in the type declarations:

| Provider | Flag | Path |
|---|---|---|
| Anthropic | `disableParallelToolUse: true` | `providerOptions.anthropic` `[VERIFIED: @ai-sdk/anthropic/dist/index.d.ts:281; docs line 98-102 "Defaults to `false`"]` |
| OpenAI | `parallelToolCalls: false` | `providerOptions.openai` (both chat and responses) `[VERIFIED: @ai-sdk/openai/dist/index.d.ts:9 and :1520; docs line 140]` |
| OpenRouter | `parallelToolCalls: false` | `providerOptions.openrouter` `[VERIFIED: @openrouter/ai-sdk-provider/dist/index.d.ts:87-89 "Default to true"]` |
| **Gemini** | **none** | no `parallel` anywhere in `@ai-sdk/google`'s types or docs `[VERIFIED: grep -n "parallel" over @ai-sdk/google/dist/index.d.ts and docs/15-google.mdx → no matches]` |
| openai-compatible | depends on the endpoint | treat as absent |

So D-08's wording is exactly right about the belt, and the braces are load-bearing on Gemini. The loop-level backstop must be a per-lesson promise chain *inside* each tool's `execute`, not a `streamText` option. I verified a minimal mutex does the job:

```
order: ['start:q1', 'end:q1', 'start:q2', 'end:q2']   // never interleaved
calls: ['q1', 'q2']                                   // arrival order preserved
```
`[VERIFIED: executed probe — two tool calls in one step, each `execute` asserting no overlap, 10 ms of work each]`

### Finding 6 — Abort and orphan patching (D-12) · HIGH

- `abortSignal` is accepted by `streamText` and merged into each tool's `abortSignal` (`mergeAbortSignals(abortSignal, getToolTimeoutMs(...))`), so a Stop cancels the in-flight tool too. `[VERIFIED: node_modules/ai/dist/index.js:3115]`
- `fullStream` **does not throw** on abort — it emits a `{ type: 'abort', reason? }` part and ends. My probe observed `start, start-step, tool-call, abort`. `[VERIFIED: executed probe]`
- `onAbort({ callId, steps, reason })` fires, but `steps` contains only **completed** steps — it reported `0` for a turn aborted during its first step. The in-flight step's tool call is therefore not in `steps`. `[VERIFIED: executed probe — "onAbort steps 0"]`
- **`result.responseMessages` rejects** with the abort reason. `[VERIFIED: executed probe — "responseMessages threw learner pressed stop"]`

Consequence for D-12: the driver must accumulate `ModelMessage`s itself as `fullStream` yields `tool-call` / `tool-result` / `text-end` parts, then, at abort, append one `ToolModelMessage` whose content is a synthesized `ToolResultPart` per unanswered `toolCallId`. The shapes needed:

```ts
interface ToolCallPart   { type: 'tool-call';   toolCallId: string; toolName: string; input: unknown; providerOptions?; providerExecuted? }
interface ToolResultPart { type: 'tool-result'; toolCallId: string; toolName: string; output: ToolResultOutput; providerOptions? }
type ToolResultOutput =
  | { type: 'text';  value: string }
  | { type: 'json';  value: JSONValue }
  | { type: 'error-text'; value: string }
  | { type: 'error-json'; value: JSONValue }
  | { type: 'execution-denied'; reason?: string }
  | …
```
`[VERIFIED: node_modules/@ai-sdk/provider-utils/dist/index.d.ts:328-400]`

Use `{ type: 'error-text', value: 'The learner stopped the turn before this tool ran.' }` — it is the purpose-built shape and every provider adapter maps it to its own error-result encoding.

### Finding 7 — Tool schema dialects (D-28, D-29, PROV-10) · HIGH for what the SDK does, LOW for Gemini's exact rejected set

**What the registry emits today.** `jsonSchemaOf(spec, surface)` is `z.toJSONSchema(z.object(shapeFor(spec, surface)))`. Over all three surfaces of all 22 tools, the frozen snapshot uses exactly these JSON Schema keywords: `$schema`, `additionalProperties`, `description`, `enum`, `items`, `maxItems`, `maximum`, `minItems`, `minimum`, `properties`, `required`, `type`. There are **zero** `$ref` and **zero** `$defs`, `additionalProperties` is already `false`, `$schema` is `https://json-schema.org/draft/2020-12/schema`, and optional fields are simply absent from `required` (e.g. `quiz` has 7 properties and 4 required). `[VERIFIED: server/src/tools.ts:462-465; server/test/wire-surface.json, enumerated by walking every key this session]`

**What that means per dialect:**

| Dialect | What the projection must do |
|---|---|
| OpenAI strict (`strict: true`) | Drop `minItems`, `maxItems`, `minimum`, `maximum` (all four are on OpenAI's unsupported list), put **every** property in `required`, and express each optional as a nullable union (`type: ['string','null']`, with `null` added to any `enum`). `additionalProperties: false` is already satisfied. `$schema` can stay or go — OpenAI's normaliser preserves unknown keys; dropping it is tidier. |
| OpenAI non-strict (the default) | **Nothing.** The schema goes through essentially as-is. |
| Gemini | Drop whatever Gemini rejects. The provider passes your schema through untouched (`parametersJsonSchema: tool.inputSchema`), so a rejected keyword returns a 400 from Google rather than a warning. |
| Compact (Phase 4) | Shorten descriptions; same keyword set. |

**What each provider normalises for you, and what it does not:**
- OpenAI runs `normalizeOpenAIJsonSchema` on every function tool's `inputSchema`: it removes `propertyNames` and regex-lookaround `pattern`s (each with a `compatibility` warning), resolves singleton `$ref`/`allOf`, and recurses. It does **not** touch `minItems`/`maximum`/`required`/nullability. `[VERIFIED: @ai-sdk/openai/dist/index.js, function normalizeOpenAIJsonSchema]`
- **OpenAI strict mode is opt-in per tool and off by default.** Chat Completions sends `strict` only `if (tool.strict != null)`; the Responses API sends `strict: tool.strict ?? false`. The `strictJsonSchema` provider option governs *structured output* (`response_format`), not tool parameters. `[VERIFIED: @ai-sdk/openai/dist/index.js:872 `...tool.strict != null ? { strict: tool.strict } : {}`; :5693 `strict: tool.strict ?? false`; :955 and :5982 where `strictJsonSchema` is read, both inside `response_format` construction]` `[CITED: node_modules/ai/docs/03-ai-sdk-core/15-tools-and-tool-calling.mdx §Strict Mode — "By default, strict mode is disabled. You can enable it per-tool by setting `strict: true`"]`
- Google passes tool parameters through verbatim: `prepareFunctionDeclaration(tool) → { name, description, parametersJsonSchema: tool.inputSchema }`. Its only schema sanitiser (`sanitizeResponseJsonSchema`, which rewrites `const` to a single-value `enum`) applies to `responseJsonSchema` — structured output — not to tool parameters. Setting `strict: true` on any tool flips Gemini's `functionCallingConfig.mode` to `"VALIDATED"`. `[VERIFIED: @ai-sdk/google/dist/index.js:1088-1092, :676-700, :1042-1057]`
- Anthropic does no schema normalisation of note and has no strict mode.

**The zod seam for D-28.** `z.toJSONSchema(schema, opts)` in zod 4.6.5 takes `target: 'draft-04' | 'draft-07' | 'draft-2020-12' | 'openapi-3.0'`, `io: 'input' | 'output'`, `unrepresentable`, `cycles`, `reused`, and — most usefully — `override: (ctx: { zodSchema, jsonSchema, path }) => void`, "Arbitrary custom logic that can be used to modify the generated JSON Schema". That is the per-dialect hook; it needs no new dependency and keeps the registry untouched exactly as D-28 requires. `[VERIFIED: node_modules/.pnpm/zod@4.6.5/node_modules/zod/v4/core/to-json-schema.d.ts, JSONSchemaGeneratorParams]`

Two notes for the planner: `io` defaults to `'output'`, and for a tool *input* schema `'input'` is the semantically correct choice (it matters for `.default()` and transforms) — changing it will move the frozen snapshot, so decide deliberately. And `target: 'openapi-3.0'` is a tempting shortcut for Gemini but produces OpenAPI-3.0 nullability (`nullable: true`) rather than JSON Schema unions; verify against Gemini before relying on it.

**OpenAI's strict-mode rules, from OpenAI's own docs:** unsupported keywords are `minLength, maxLength, pattern, format, minimum, maximum, minItems, maxItems, unevaluatedProperties, propertyNames, patternProperties, contains, dependentSchemas, oneOf, allOf, if/then/else`; all fields must appear in `required`; optional fields are expressed as a nullable union (`"type": ["string", "null"]`); `additionalProperties: false` is required on every object. `[CITED: developers.openai.com/api/docs/guides/structured-outputs#supported-schemas]` Exact numeric limits (property count, nesting depth, enum size, total string length) were not retrievable from the page — `[ASSUMED]` they are not binding for Derive's schemas, whose largest tool is `set_plan` with 2 top-level properties and a 5-property array item.

**Gemini's exact rejected-keyword set** could not be verified from an authoritative page in this session (the function-calling guide documents only `type`, `properties`, `required`, `description`, `enum`, `items` by example and names no exclusions; the Schema reference page I tried did not render the object). `[ASSUMED]`, LOW. The safe projection, given the keyword inventory above, is to emit only `type`, `properties`, `required`, `description`, `enum`, `items` and drop `$schema`, `additionalProperties`, `minItems`, `maxItems`, `minimum`, `maximum`. Plan a small `checkpoint:human-verify` that sends one `set_plan` schema to a real Gemini key and records what it accepts; that converts this from LOW to HIGH for one API call.

**D-29 and the existing test.** `wire-surface.test.ts` has an assertion named "keeps the bounds the model is held to when a shape is projected" that reads `set_plan.nodes.minItems === 3` and `quiz.options.minItems === 2` off the **agent** surface. The strict dialect necessarily drops those bounds. Keep that assertion pointed at the registry projection and add the dialect projections as new top-level keys in the fixture (e.g. `dialect:openai-strict`, `dialect:gemini`, `dialect:compact`), so the existing assertion stays true and the new rules checks of D-29 read the new keys.

### Finding 8 — Retries and rate limits (D-10, D-11) · HIGH

- `maxRetries` default is **2**; `prepareRetries` builds `retryWithExponentialBackoffRespectingRetryHeaders({ maxRetries, abortSignal })` with `initialDelayInMs = 2000`, `backoffFactor = 2`, no jitter. `shouldRetry` is `APICallError.isInstance(error) && error.isRetryable === true` (or `GatewayError`). `[VERIFIED: node_modules/ai/dist/index.js:2574-2593, :2595-2618]`
- It **does** read `retry-after-ms` then `retry-after` (seconds, or an HTTP-date) off `APICallError.responseHeaders`, but only honours the value when `0 <= ms && (ms < 60000 || ms < exponentialBackoffDelay)`. A 90-second `Retry-After` is therefore ignored in favour of the exponential delay. `[VERIFIED: node_modules/ai/dist/index.js:2551-2568 getRetryDelayInMs]`
- `isAbortError(error)` short-circuits retries, so a Stop during a backoff is honoured. `[VERIFIED: @ai-sdk/provider-utils/dist/index.js:3650]`

D-11 wants ~2 minutes, jitter, a visible countdown and a working Stop. None of that is reachable through the SDK's retry. **Set `maxRetries: 0` and own the loop**: catch the throw, narrow with `APICallError.isInstance(e)`, read `e.statusCode` / `e.isRetryable` / `e.responseHeaders?.['retry-after'] ?? e.responseHeaders?.['retry-after-ms']`, emit `sink.emitEphemeral('status', { text: \`Provider busy, retrying in ${n}s\` })` on each tick, honour `ctx.isStopping()`, and on exhaustion end the turn with `providerSentence`/`hintFor`'s words.

Error classes to narrow on: `APICallError` (`statusCode`, `responseHeaders`, `responseBody`, `isRetryable`, `data`, `.isInstance()`), plus `AISDKError`, `InvalidToolInputError`, `NoSuchToolError`, `ToolCallRepairError`, `LoadAPIKeyError`, `NoSuchModelError`, `TypeValidationError`, `JSONParseError`, `InvalidPromptError`. Errors arriving *after* streaming has begun are normalised into `StreamProviderError` instances carrying `type`, `code`, `statusCode`, `isRetryable`, delivered on the `error` part of `fullStream` (and to `onError`). `[VERIFIED: the `ai` export list and @ai-sdk/provider's APICallError class]` `[CITED: node_modules/ai/docs/03-ai-sdk-core/50-error-handling.mdx]`

Do **not** set `streamRetries` — it defaults to 0 (disabled) and the doc warns that "Partial output from a failed attempt that was already emitted cannot be retracted", which would leave half a sentence in a persisted `assistant` event.

### Finding 9 — Context windows and prices without a runtime call (D-15, D-25, COST-04) · HIGH for the data, MEDIUM for whose price it is

**The SDK exposes no context window.** `ModelInfo` is `{ provider: string; modelId: string }` and nothing more; there is no capability or limits object anywhere in `ai@7`'s public types. D-25's own table is unavoidable. `[VERIFIED: node_modules/ai/dist/index.d.ts type ModelInfo]`

**There is one machine-readable source for both numbers**, and it is already wired into this repo: `GET https://openrouter.ai/api/v1/models` (that exact path is `providers.ts`'s `openrouter.modelsPath`) needs no key and returns, per model, `context_length`, `top_provider.context_length`, `top_provider.max_completion_tokens`, and `pricing: { prompt, completion, input_cache_read, input_cache_write, web_search, overrides[] }` in dollars **per token**. Fetched this session (463 models):

| id | context_length | prompt $/tok | completion $/tok | cache read | cache write | web_search $/call |
|---|---|---|---|---|---|---|
| `anthropic/claude-opus-5.5` | 1,000,000 | 0.000004 | 0.00002 | 0.0000002 | 0.000005 | 0.01 |
| `anthropic/claude-sonnet-5.5` | 1,000,000 | 0.000002 | 0.00001 | 0.0000002 | 0.0000025 | 0.01 |
| `openai/gpt-6-astra` | 1,050,000 | 0.00001 | 0.00005 | 0.000001 | 0.0000125 | 0.01 |
| `openai/gpt-6-luna` | 1,050,000 | 0.0000001 | 0.0000005 | 0.00000001 | 0.000000125 | 0.01 |
| `google/gemini-3.8-flash` | 1,048,576 | 0.00000075 | 0.00000375 | 0.000000075 | 0.0000000416666666666667 | 0.014 |

`[VERIFIED: curl https://openrouter.ai/api/v1/models, fetched 2026-10-01; values read with node from the saved response]`

This does **not** violate D-15: use it at *authoring* time to seed the committed pure-data module, with `PRICES_AS_OF` set to the day it was read. Nothing fetches at runtime. It also gives D-25 its window table and §Finding 4 its per-search price.

Two honest caveats. First, these are **OpenRouter's** prices; for the native `anthropic` / `openai` / `gemini` rows the vendor's own pricing page is the authority and the planner should cross-check the five or six models that actually ship in the table — `[ASSUMED]` that OpenRouter mirrors first-party list prices. Second, `pricing.overrides` exists (e.g. `openai/gpt-6.1-sol-pro` prices differently above 272,000 prompt tokens), so a single `$/token` pair is an approximation for very long prompts; D-19's "about $X.XX" wording already carries that honesty, and `cost_source: 'table'` → label `estimated` says it out loud.

**Prompt-caching minimums**, which the headroom estimator and the cache split both need:

| Provider | Minimum cacheable prefix | Mechanism |
|---|---|---|
| Anthropic | 4096 tokens (Opus 4.5, Haiku 4.5), 1024 (Opus 4.1/4, Sonnet 4.5/4/3.7, Opus 3), 2048 (Haiku 3.5/3) | explicit `cacheControl: { type: 'ephemeral' }`, optional `ttl: '1h'` `[CITED: @ai-sdk/anthropic/docs/05-anthropic.mdx §Limitations]` |
| OpenAI | 1024 tokens; automatic, no opt-in. `promptCacheKey` improves hit rate; `promptCacheOptions: { mode: 'implicit'\|'explicit', ttl: '30m' }` on GPT-5.6+ | `[CITED: @ai-sdk/openai/docs/03-openai.mdx §Prompt Caching]` |
| Gemini | 4096 (Gemini 3 series), 2048 (Gemini 2.5 series); implicit, 75% discount on the cached prefix; "keep content at the beginning of requests consistent, add variable content at the end" | `[CITED: @ai-sdk/google/docs/15-google.mdx §Implicit Caching]` |

Derive's stable prefix is the ~29KB method text plus the tool contract — comfortably over every minimum. Cache read/write counts land in `usage.inputTokenDetails.cacheReadTokens` / `cacheWriteTokens` on all three. `[CITED: @ai-sdk/anthropic/docs/05-anthropic.mdx §Cache Control — "Cache read and cache write (creation) token counts are returned on the standard `usage` object for both `generateText` and `streamText`"]`

### Finding 10 — Search providers (D-22) · MEDIUM for the API shape, LOW for free tiers

**Tavily.** `POST https://api.tavily.com/search`, `Authorization: Bearer <key>`, minimal body `{ "query": "…" }`. Response carries `query`, `results[]` (each `title`, `url`, `content`, `score`, optionally `raw_content`, `published_date`, `favicon`, `id`), plus `images`, `response_time`, `answer` (on request), `usage` (credit consumption, on request), `request_id`. `[CITED: docs.tavily.com/documentation/api-reference/endpoint/search]` Free-tier size: `[ASSUMED]` — not verified; the Settings copy should not quote a number.

**SearXNG.** `GET` or `POST` to `/` or `/search` on the learner's own instance; only `q` is required; `format=json` for JSON. The JSON format must be enabled by the instance administrator under `search:` in `settings.yml`, and "many public instances have these formats disabled". No authentication. `[CITED: docs.searxng.org/dev/search_api.html]` Two practical consequences: the Settings row needs a base URL rather than a key, and the connection test should report the "JSON format not enabled" case as its own sentence, because it is the single most likely failure. A SearXNG instance is very often on `localhost` — see the anti-pattern about `assertPublicHost`.

Both are a `fetch` away; neither needs a dependency.

### Finding 11 — `ModelMessage` round-tripping (D-04, D-07) · HIGH

`type ModelMessage = SystemModelMessage | UserModelMessage | AssistantModelMessage | ToolModelMessage`, each `{ role, content, providerOptions? }`. `AssistantContent = string | Array<TextPart | CustomPart | FilePart | ReasoningPart | ReasoningFilePart | ToolCallPart | ToolResultPart | ToolApprovalRequest>`; `ToolContent = Array<ToolResultPart | ToolApprovalResponse>`. `[VERIFIED: @ai-sdk/provider-utils/dist/index.d.ts:1699-1810]`

Every part Derive will ever hold (text, reasoning, tool-call, tool-result) is plain JSON. My probe round-tripped a real three-message history through `JSON.parse(JSON.stringify(...))` and the only difference was keys whose value was `undefined` (`providerExecuted`, `providerOptions`) being dropped — semantically identical. So a `TEXT` column holding `JSON.stringify(messages)` is safe; compare with a structural comparison that treats absent and `undefined` as equal if you ever assert on it. `[VERIFIED: executed probe]` The one shape that would not survive is `FilePart.data` (`Uint8Array` / `URL`) and `ReasoningFilePart`, neither of which Derive produces.

**What must be preserved for a same-provider resume.** Both Anthropic and Google carry an opaque per-block signature on reasoning and tool-call parts, inside `providerOptions` / `providerMetadata` on the part. Google's docs state it explicitly: "**signature** _string_ — Per-block signature hash, set by the SDK on output reasoning and tool-call or agentic video processing parts. Round-tripped automatically on the next turn." `[CITED: @ai-sdk/google/docs/15-google.mdx §Provider Metadata]` Anthropic's compaction signature is at `providerMetadata.anthropic.signature` `[CITED: @ai-sdk/anthropic/docs/05-anthropic.mdx line 821-822]`. The practical rule: **persist the parts verbatim, including `providerOptions`, and never filter or rewrite them.** That is also precisely why D-04's "a provider change drops them" is right — those signatures are not portable.

Two persistence rules worth writing into the code comment: store only `assistant`, `tool` and `user` messages (the system prompt is rebuilt from `method/` every turn and `instructions` is a separate field, so a persisted system message would be stale method text); and store the executed-call record (`toolCallId → ToolResultOutput`) as part of the same write, so D-07's replay guard and the history can never disagree.

---

## Common Pitfalls

### Pitfall 1: Double-counting cached input tokens · HIGH
**What goes wrong:** every cached lesson's cost reads ~2× the input tokens it should.
**Why it happens:** `usage.inputTokens` is a **total that includes** cache reads and writes. The Anthropic adapter computes `inputTokens.total = input_tokens + cache_creation_input_tokens + cache_read_input_tokens` and `noCache = input_tokens`. The repo's existing `input_tokens` column is fed from the Agent SDK's `u.inputTokens`, which is Anthropic's raw `input_tokens` — i.e. the **uncached** part, with cache counted separately in `cache_read_tokens` / `cache_write_tokens`. `[VERIFIED: @ai-sdk/anthropic/dist/index.js:1900-1906; server/src/agent.ts reportUsage]`
**How to avoid:** map `input_tokens` from `usage.inputTokenDetails.noCacheTokens`. Price `noCache` at the input rate, `cacheRead` at the cache-read rate, `cacheWrite` at the cache-write rate, and never price `inputTokens`.
**Warning signs:** a lesson with heavy caching costs *more* than the same lesson without it; `input_tokens ≈ cache_read_tokens + something` in the `usage` table.

### Pitfall 2: Adding `googleSearch` silently deletes all 14 Derive tools on a pre-Gemini-3 model · HIGH
**What goes wrong:** the tutor on Gemini stops being able to call `quiz`, `set_plan`, anything — it just talks. No exception, no 400.
**Why it happens:** `prepareTools` in `@ai-sdk/google` takes a different branch when any provider-defined tool is present. Only when `hasFunctionTools && usesGemini3Features && googleTools.length > 0` does it return `tools: [...googleTools, { functionDeclarations }]`; otherwise it returns `tools: googleTools` — the function declarations are discarded. `usesGemini3Features` is `isGeminiModel && !(isKnownPreGemini2 || isGemini2Model)`. A `warning` of type `unsupported`, feature `"combination of function and provider-defined tools"`, is pushed, and that is the only signal. `[VERIFIED: @ai-sdk/google/dist/index.js:926-1040, :917]`
**How to avoid:** the Gemini adapter row must decide `search: () => Tool | null` from the model id, not statically; and the driver must **read `streamText`'s warnings** on the first `start-step` and refuse (or fall back to the pluggable search) when the combination warning appears. `start-step` carries `warnings: CallWarning[]`; `result.warnings` carries them too.
**Warning signs:** a Gemini lesson where the graph is never drawn.

### Pitfall 3: Reading the history from `result.responseMessages` · HIGH
Covered in Finding 6. It rejects on abort, which is the one case D-12 exists for.

### Pitfall 4: `providers.ts`'s OpenRouter default model id is not a valid OpenRouter slug · HIGH
**What goes wrong:** every fresh OpenRouter lesson fails with a model-not-found error from the gateway, and the pricing table misses too.
**Why it happens:** the catalogue stores `defaultModel: 'anthropic/claude-opus-5-5'` (dashes, the *native Anthropic* spelling). OpenRouter's slugs use dots: `anthropic/claude-opus-5.5`. `anthropic/claude-opus-5-5` is **absent** from OpenRouter's 463-model list; `anthropic/claude-opus-5.5` is present. `[VERIFIED: server/src/providers.ts, the openrouter row; curl https://openrouter.ai/api/v1/models checked both ids this session]`
**How to avoid:** D-27 flips that row to `teaches: true`, which makes the id load-bearing for the first time. Change it to `anthropic/claude-opus-5.5` in the same change, and add an assertion to `settings.test.ts` that every catalogue `defaultModel` is non-empty where `teaches` is true. The native `anthropic` row's `claude-opus-5-5` is correct as it stands — `@ai-sdk/anthropic`'s own docs use `anthropic('claude-opus-5-5')` and `anthropic('claude-sonnet-5-5')`. `[VERIFIED: grep -o "claude-[a-z0-9-]*" over @ai-sdk/anthropic/docs/05-anthropic.mdx]`

### Pitfall 5: the base-URL row reports no usage at all · HIGH
**What goes wrong:** every lesson on an OpenAI-compatible endpoint reads `not reported`, and COST-02 fails on PROV-05.
**Why it happens:** `createOpenAICompatible`'s `includeUsage` option "Include usage information in streaming responses… **Defaults to `undefined` (`false`)**". `[CITED: @ai-sdk/openai-compatible/docs/index.mdx]`
**How to avoid:** `createOpenAICompatible({ name, apiKey, baseURL, includeUsage: true })`. Note the endpoint may still not send it, in which case `unknown` → `not reported` is the correct, honest label.

### Pitfall 6: assuming OpenAI needs the strict dialect · MEDIUM
Strict mode is off by default and opt-in per tool (Finding 7). D-28's strict projection is a *choice* that buys schema-guaranteed tool inputs at the cost of losing `minItems`/`maxItems`/`minimum`/`maximum` — bounds that `wire-surface.test.ts` currently asserts the model is held to, and that `set_plan` (3–12 nodes) and `quiz` (2–3 options) genuinely rely on. **Recommendation:** ship the strict projection and the D-29 rule checks as PROV-10 requires, but default the OpenAI adapter row to `strict: false` so the model still sees the bounds, and treat the strict projection as the thing CI validates and Phase 4's conformance harness can switch on. Record the reasoning either way — this is the sort of thing a reviewer will ask about.

### Pitfall 7: Gemini has no parallel-tool flag · HIGH
Finding 5. The mutex is not belt-and-braces on Gemini; it is the only mechanism.

### Pitfall 8: `D-21`'s new tool breaks five existing assertions · HIGH
`server/test/wire-surface.test.ts` asserts, with hard-coded fixtures: `[...DERIVE_TOOL_NAMES]` deep-equals a 14-name array; `TOOL_LABELS` deep-equals a 14-entry map; `ALL_TOOL_NAMES.length === 22`; `live.mcp.length === 22`; `live.http.length === 16`. Adding `fetch_page` to the registry fails all five, and the suite's doc comment forbids regenerating the fixture to go green. `[VERIFIED: server/test/wire-surface.test.ts]`
**How to avoid:** make moving those numbers an explicit, named task with the reasoning in the commit, and keep the "before" lists as what they are — a record of the pre-registry contract — by renaming them (`TUTOR_TOOLS_AT_PHASE_1`) rather than editing them in place. Also update `plugin/commands/*.md` `allowed-tools`, `server/src/agent.ts` `buildTools` handlers, `server/src/mcp.ts` `registerTool`, and `index.ts`'s external action `switch` — the four-place rule in CLAUDE.md.

### Pitfall 9: a single driver named `api` erases the provider from the ledger · HIGH
Covered in §Anti-Patterns. Call `startTurn(lessonId, tutor.provider, tutor.model)` for the api driver (or make `Driver.name` provider-specific). As a bonus, `agent.ts`'s existing D-04 rule `if (last && last.driver !== driver.name && lesson.session_id) clearSessionId(lessonId)` then compares *providers*, which is what D-04 actually means, and is exactly the condition under which `turn_messages` must be dropped.

### Pitfall 10: `maxTurns: 400` and `isStepCount(400)` are not the same unit · MEDIUM
The Agent SDK's `maxTurns` counts agent turns; `isStepCount` counts model calls (a step = one model call plus its tool executions). They are close enough for D-05's stated purpose ("a runaway guard, not a teaching limit") but the discretion note asks for a concrete number with reasoning — say so rather than implying equivalence. `[ASSUMED]` that the two units are near enough in practice; the guard's only job is to stop an infinite loop.

### Pitfall 11: `instructions` vs `system` vs a system message in `messages` · MEDIUM
`system` is deprecated in favour of `instructions`, and `allowSystemInMessages` defaults to `false`, so a system message inside `messages` is rejected. Build the cache split with `instructions: [stable, volatile]` (Pattern 3) and keep `messages` free of system entries — which is also what makes the persisted `turn_messages` safe to replay after the method text changes.

---

## Code Examples

### The driver skeleton (compiles under this repo's exact flags, exit 0)

```ts
// Source: verified by `tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext
//         --strict --esModuleInterop --skipLibCheck --types node` with typescript@7.0.2 this session.
import { streamText, tool, isStepCount, jsonSchema, APICallError, type ModelMessage, type LanguageModel } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

const anthropic = createAnthropic({ apiKey: key });
const openai = createOpenAI({ apiKey: key });
const google = createGoogleGenerativeAI({ apiKey: key });
const openrouter = createOpenRouter({ apiKey: key });
const compat = createOpenAICompatible({ name: 'custom', apiKey: key, baseURL: base, includeUsage: true });

const models: Record<string, LanguageModel> = {
  anthropic: anthropic('claude-opus-5-5'),
  openai: openai('gpt-6-astra'),                                        // Responses API by default
  gemini: google('gemini-3.8-flash'),
  openrouter: openrouter.chat('anthropic/claude-opus-5.5', { usage: { include: true } }),
  'openai-compatible': compat(modelId),
};

const r = streamText({
  model: models[provider]!,
  maxRetries: 0,                              // Derive owns the backoff (D-10, D-11)
  abortSignal: signal,                        // Stop (D-12)
  stopWhen: isStepCount(400),                 // D-05 — without this the default is isStepCount(1)
  instructions: [                             // D-06 — the stable/volatile split
    { role: 'system', content: STABLE_PREFIX, providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } } },
    { role: 'system', content: VOLATILE_TAIL },
  ],
  messages,                                   // the persisted ModelMessage[] (D-04)
  providerOptions: {                          // D-08's belt
    anthropic: { disableParallelToolUse: true },
    openai: { parallelToolCalls: false },
    openrouter: { parallelToolCalls: false, usage: { include: true } },
  },
  tools: {
    ...deriveTools,                           // 15 registry tools, projected per dialect
    web_search: nativeSearchFor(provider),    // or omitted; see Pitfall 2 for Gemini
  },
});

for await (const part of r.fullStream) {
  if (part.type === 'finish-step') {
    const cost = (part.providerMetadata?.openrouter as { usage?: { cost?: number } } | undefined)?.usage?.cost ?? null;
    const searches = (part.providerMetadata?.anthropic as { usage?: { server_tool_use?: { web_search_requests?: number } } } | undefined)
      ?.usage?.server_tool_use?.web_search_requests ?? null;
    sink.usage({
      model: part.response.modelId,
      input_tokens: part.usage.inputTokenDetails.noCacheTokens ?? null,   // NOT part.usage.inputTokens
      output_tokens: part.usage.outputTokens ?? null,
      cache_read_tokens: part.usage.inputTokenDetails.cacheReadTokens ?? null,
      cache_write_tokens: part.usage.inputTokenDetails.cacheWriteTokens ?? null,
      reasoning_tokens: part.usage.outputTokenDetails.reasoningTokens ?? null,
      ...(cost !== null ? { cost_usd: cost, cost_source: 'provider' as const } : priceFromTable(part.usage, searches)),
    });
  }
  if (part.type === 'abort') { patchOrphans(); break; }
  if (part.type === 'error' && APICallError.isInstance(part.error)) {
    const after = part.error.responseHeaders?.['retry-after'];
    /* … own backoff, ephemeral status line … */
  }
}
```

### Per-lesson serialisation inside `execute` (D-08's braces)

```ts
// Source: executed and asserted this session — two tool calls in one step never overlapped
// and kept arrival order (['start:q1','end:q1','start:q2','end:q2']).
const chains = new Map<string, Promise<unknown>>();
function serialise<T>(lessonId: string, f: () => Promise<T>): Promise<T> {
  const prev = chains.get(lessonId) ?? Promise.resolve();
  const next = prev.then(f);
  chains.set(lessonId, next.catch(() => undefined));
  return next;
}

// ... inside the tool factory, for every registry tool:
tool({
  description: descriptionFor(spec, 'api'),
  inputSchema: jsonSchema<Record<string, unknown>>(jsonSchemaOf(spec, 'api', dialect)),  // Pattern 4
  strict: dialect.strict,
  execute: async (input, { toolCallId }) =>
    serialise(lessonId, async () => {
      const recorded = recordedResult(turnId, toolCallId);        // D-07's replay guard
      if (recorded) return recorded;
      sink.emitEphemeral('status', { text: TOOL_LABELS[spec.name] ?? `Using ${spec.name}` });
      const out = await handlers[spec.name](lessonId, input as Record<string, unknown>);
      recordResult(turnId, toolCallId, out);
      return out;
    }),
})
```

### The stub model for Success Criterion 1 (runs under `node --import tsx --test`)

```ts
// Source: executed this session; 1 pass, 0 fail, 554 ms, under node 22.22.2 + tsx.
import { streamText, tool, isStepCount } from 'ai';
import { MockLanguageModelV4, simulateReadableStream } from 'ai/test';

// NOTE the provider-spec usage shape here — nested, not the flat LanguageModelUsage.
const usage = {
  inputTokens:  { total: 120, noCache: 100, cacheRead: 20, cacheWrite: undefined },
  outputTokens: { total: 30, text: 25, reasoning: 5 },
};
const step = (chunks: unknown[]) => ({
  stream: simulateReadableStream({ chunks: chunks as never[], initialDelayInMs: 0, chunkDelayInMs: 0 }),
});

const model = new MockLanguageModelV4({
  doStream: [                                   // an array = one scripted response per call
    step([
      { type: 'tool-call', toolCallId: 'c1', toolName: 'quiz', input: '{"question":"q1"}' },
      { type: 'finish', finishReason: { unified: 'tool-calls', raw: 'tool_use' }, usage },
    ]),
    step([
      { type: 'text-start', id: 't1' },
      { type: 'text-delta', id: 't1', delta: 'Locked.' },
      { type: 'text-end', id: 't1' },
      { type: 'finish', finishReason: { unified: 'stop', raw: 'end_turn' }, usage },
    ]),
  ],
});
// assertions available: model.doStreamCalls.length, model.doStreamCalls[n].prompt, .tools
```

The stub satisfies the discretion note's preferred shape: a fake `LanguageModel` handed to the **real** loop. Wire it by letting the api driver take its `LanguageModel` from an injectable factory (a module-level override in the same spirit as `setDriverOverride`), so `api.test.ts` drives the genuine `streamText` path with no network. `finishReason` must be the object form `{ unified, raw }` — the v7 spec changed it from a bare string.

### Reading warnings (Pitfall 2's early-warning system)

```ts
if (part.type === 'start-step') {
  for (const w of part.warnings) {
    if (w.type === 'unsupported') sink.emitEphemeral('status', { text: `This model does not support ${w.feature}` });
  }
}
```

---

## State of the Art

| Old approach (AI SDK 5/6 era, and what training data will suggest) | Current (ai@7.0.126) | Impact |
|---|---|---|
| `stepCountIs(n)` | `isStepCount(n)` (`stepCountIs` kept as an alias) | cosmetic; prefer the new name |
| `maxSteps` | `stopWhen` | `maxSteps` is gone |
| `system: '…'` | `instructions` (string, one system message, or an **array** of them) | the array form is what makes D-06's cache split possible |
| flat `usage: { promptTokens, completionTokens }` | `inputTokens` + `inputTokenDetails{noCache,cacheRead,cacheWrite}` + `outputTokens` + `outputTokenDetails{text,reasoning}` + `totalTokens` + `raw` | the whole of Finding 2, and Pitfall 1 |
| `finishReason: 'stop'` | `finishReason: { unified: 'stop', raw: 'end_turn' }` | breaks any hand-written mock copied from an older example |
| `MockLanguageModelV1/V2/V3` | `MockLanguageModelV4` (V3 still exported) | spec version is `'v4'` |
| `onFinish`, `onStepFinish` | `onEnd`, `onStepEnd` (old names deprecated, still work) | |
| `parameters:` on a tool | `inputSchema:` | |
| `experimental_providerMetadata` | `providerMetadata` / `providerOptions` | |
| `createOpenAICompatible` from `@ai-sdk/openai` | `@ai-sdk/openai-compatible` | separate package, separate pin |

**Deprecated / outdated:** `system` (use `instructions`), `onFinish`/`onStepFinish` (use `onEnd`/`onStepEnd`), `includeRawChunks` (use `include.rawChunks`), `experimental_telemetry` (use `telemetry`), `Tool.needsApproval` (tool approval moved to the `streamText` level), `ImagePart` (use `FilePart`).

---

## Decision-vs-API: where a locked decision meets reality

| Decision | Verdict | What the planner must do |
|---|---|---|
| D-01 Vercel AI SDK v7 | **Holds.** Package set confirmed, versions mutually compatible, typechecks under TS 7 + NodeNext, five new exact pins. | Pin exactly; add the legitimacy checkpoint. |
| D-02 One driver + adapter table | **Holds**, with one addition. | `Driver.name` must still carry the provider id (Pitfall 9). |
| D-03 OpenRouter cost fallback | **Holds, and is better than stated.** The path is confirmed, not MEDIUM. | Set `usage: { include: true }`; read defensively on the streaming path. |
| D-04 `ModelMessage` persistence, dropped on provider change | **Holds.** JSON round-trip verified; signatures live in `providerOptions` and must be kept verbatim. | Persist only assistant/tool/user messages; never filter parts. |
| D-05 ~400-step cap, continuable `turn_end` | **Holds**, and is mandatory rather than optional (default is 1). | Pick the number; note the unit difference (Pitfall 10). |
| D-06 Stable-prefix cache split | **Holds.** `instructions` array + `cacheControl` verified; all three minimums are below Derive's prefix size. | Use `instructions`, not `messages`; consider `toolOrder` for prefix stability. |
| D-07 Persisted tool-call idempotency | **Holds.** Each tool's `execute` receives `toolCallId`, so the guard has a natural home. | One write path, alongside `turn_messages`. |
| D-08 Disable parallel + serialise in the loop | **Conflicts.** The SDK runs tool calls with `Promise.all` and has no serialisation option; Gemini has no provider flag. | Implement the mutex inside `execute` (verified recipe above). Reword "serialised unconditionally in the loop" as "serialised unconditionally by the loop's tool dispatch". |
| D-09 No reasoning shown | **Holds.** `reasoning-*` parts are discardable; `status: 'Thinking'` needs no new event type. | — |
| D-10 Ephemeral "provider busy" | **Holds.** `emitEphemeral` already exists. | — |
| D-11 Patient retries, honour `Retry-After` | **Holds**, but only if the SDK's retry is disabled: it caps `Retry-After` at 60 s, adds no jitter, defaults to 2 attempts, and shows nothing. | `maxRetries: 0`; do not set `streamRetries`. |
| D-12 Abort, patch orphans, resumable | **Holds**, with the correction that `responseMessages` rejects after abort. | Accumulate the history from `fullStream`; use `ToolResultOutput` `{ type: 'error-text' }`. |
| D-13..D-19 Cost display, labels, table, override, rounding | **Hold.** No API obstacle. One schema question raised by D-20(b): where the per-search charge goes. | Decide and name the per-search treatment (Finding 4b). |
| D-20 Native search where it exists | **Holds for Anthropic and OpenAI; conditional for Gemini.** Coexistence with function tools is fine except on pre-Gemini-3 models, where the function tools are dropped. The per-call charge is reachable but vendor-dependent. | Gemini adapter must choose its search tool from the model id and read warnings. |
| D-21 One fetch tool on `fetchPublic` | **Holds.** | Budget for Pitfall 8's five assertions. |
| D-22 Tavily / SearXNG in one Settings block | **Holds.** | Do not run the configured SearXNG base URL through `assertPublicHost`. |
| D-23 No-search `{{WEB_TOOLS}}` rendering | **Holds.** `prompt.ts:23-24` is a single `replaceAll`; a third branch is a one-line change plus `pnpm method` regeneration under the drift check. | — |
| D-24 Refuse rather than compact | **Holds.** `pruneMessages` exists and is deliberately unused. | — |
| D-25 Pre-request conservative estimate | **Holds**, and the window table is unavoidable: `ai@7` exposes no context window (`ModelInfo` is `{provider, modelId}`). | Seed the table from OpenRouter's `context_length` (Finding 9); pick the estimator divisor and headroom fraction and write the reasoning. |
| D-26 `prefs.model` becomes per-provider | **Holds.** `cleanPrefs` currently validates `model` as a bounded string (`/^[A-Za-z0-9._:/-]+$/`, 200 chars) — the per-provider map must keep that validation per value and bound the key to known `ProviderId`s. | Migration v7; `chooseModel` at `settings.ts:171-179`. |
| D-27 Flip five rows to `teaches: true` | **Holds**, with one data fix. | Correct the OpenRouter `defaultModel` slug (Pitfall 4). |
| D-28 Projection adapts, registry untouched | **Holds**, and the seam is better than expected: zod 4.6.5's `toJSONSchema(…, { target, io, override })`. | Note that OpenAI strict is opt-in, so "required for OpenAI" is a choice (Pitfall 6). |
| D-29 Snapshot + rules check | **Holds.** | Add dialect keys to the fixture rather than changing the existing bounds assertion. |

---

## Runtime State Inventory

> This phase adds a table and re-keys a stored preference; it is a migration as much as a feature.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `learners.prefs` JSON holds `model` as a **bare string** on every install that set a per-learner override (D-26/WR-01). `turns.driver` holds `'claude'` or `'codex'` on every existing row and is read by `providerOfDriver` for the header pill and denormalised onto every `usage` row. No existing row can name an api provider. | Data migration for `prefs.model` (string → `Record<ProviderId, string>`, mapped onto the provider active when it was stored) **and** the code edit in `cleanPrefs` + `chooseModel`. For `turns.driver`, no backfill: historical rows are honest about what ran them; only new rows carry provider ids. |
| Live service config | None — nothing in this phase registers anything with an external service. Provider accounts are reached per request with a key; no webhooks, no dashboards, no stored server-side state. Verified by reading `probe.ts` and the five provider packages: every call is a stateless `POST /chat/completions`-shaped request. (OpenAI's Responses API `store` option exists and defaults are the provider's; Derive does not set it — worth leaving unset so no transcript is retained server-side.) | None. Consider explicitly setting `providerOptions.openai.store: false` so a Derive lesson is never retained on OpenAI's side; that is a one-line privacy win consistent with the local-first constraint. |
| OS-registered state | None — no scheduler entries, no process managers, no plists involved in this phase. | None. |
| Secrets / env vars | A new search-provider key (D-22) joins `~/.derive/secrets.json` and must `registerSecret` on load like every other, or it will leak through an error sentence. `config.ts`'s `EnvKeyName` union is a closed set of five; a `TAVILY_API_KEY`-style variable would need adding there (and `config.ts` is the only module allowed to read `process.env`). Existing provider keys are untouched by this phase. | Code edit only: extend `EnvKeyName`/`ENV_KEYS` if an env route is offered, register the new secret in `keys.ts`'s load path, add it to `.env.example`. |
| Build artifacts / installed packages | `server/dist/` must be rebuilt (the MCP bin `derive-mcp -> dist/mcp.js` is what the plugin runs, and `backend.ts` `mcpCommand()` falls back to tsx only when no `dist/` exists). `pnpm-lock.yaml` changes with six new packages. `server/src/method.generated.ts` must be regenerated by `pnpm method` for D-23's third `{{WEB_TOOLS}}` rendering, and `pnpm method:check` fails CI if it is not committed. | `pnpm build`; commit the regenerated `method.generated.ts` and the lockfile in the same change. |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything (`node:sqlite`, `ai@7` `engines.node >=22`) | ✓ | v22.22.2 | — |
| pnpm | install, workspace | ✓ | 12.5.1 (matches root `packageManager: pnpm@12.5.1`) | — |
| `tsx` | `pnpm test`, dev server | ✓ | installed | — |
| TypeScript | `pnpm typecheck` | ✓ | 7.0.2 (and 5.9.3 in the tree) | — |
| Internet to npm | installing six packages | ✓ | — | — |
| Internet to provider APIs | real-provider verification | ✓ (`https://api.anthropic.com/v1/models` → 401, i.e. reachable, key refused) | — | — |
| **Anthropic API key** | Success Criterion 1 | ✗ | — | **none** — stub model for the suite, `checkpoint:human-verify` for the real run |
| **OpenAI API key** | Success Criterion 1 | ✗ | — | **none** — same |
| **Gemini API key** | Success Criterion 1, and the Pitfall 2 / Finding 7 Gemini probes | ✗ | — | **none** — same |
| **OpenRouter API key** | Success Criterion 2, and confirming `usage.cost` end to end | ✗ | — | **none** — same |
| Tavily API key | D-22 fallback search | ✗ | — | SearXNG, or "no search" (D-23) |
| SearXNG instance | D-22 fallback search | ✗ (not probed; no local instance expected) | — | Tavily, or "no search" (D-23) |
| Claude Code CLI | the existing `claude` driver keeps working | ✓ | present on PATH | — |
| `~/.derive/secrets.json` | any stored key | ✗ (absent) | — | absent is silent by design |

**Missing dependencies with no fallback:**
- All four teaching provider keys. No environment variable is set and `~/.derive/secrets.json` does not exist. **Success Criteria 1 and 2 cannot be demonstrated by any automated test in this environment.** The plan must (a) make the API suite run the real loop against a stub `LanguageModel` — which is what the criterion's own clause "the API suite passes through the owned loop with a stub model" asks for — and (b) put the real-key runs for Anthropic, OpenAI, Gemini, OpenRouter and a base-URL endpoint behind `checkpoint:human-verify` tasks with explicit, short scripts the owner can follow.

**Missing dependencies with fallback:**
- Tavily / SearXNG: D-23 already specifies the no-search rendering, so the fallback path is designed in. Verifying D-22's Settings block does not need a key (the connection test can be checked against a deliberate failure).

---

## Project Constraints (from CLAUDE.md)

Directives the planner must honour; every one of these is a hard constraint on this phase.

**Entry point / workflow**
- All file-changing work must go through a GSD command (`/gsd-execute-phase` for this phase). No direct edits outside a GSD workflow.

**Stack and runtime**
- TypeScript 5.9+ (`^5.8.0` in manifests), `strict: true` in both packages. Node >= 22.5 (`engines.node`), ESM, `module: NodeNext`. pnpm workspace with `server` and `web` only.
- **Server imports use the `.js` extension** on local files even though the source is `.ts` (`import { emit } from './events.js'`). Tests import source the same way.
- `pnpm.onlyBuiltDependencies: ["esbuild"]` — only esbuild's postinstall may run. None of the six new packages has a postinstall, so no change is needed, but a package that did would be silently blocked.
- No ESLint/Prettier/Biome; formatting is by hand. Single quotes, semicolons, trailing commas in multi-line literals, 2-space indent. **Long lines are accepted — do not reflow existing lines.**
- No `@ts-ignore` / `@ts-expect-error` anywhere. Narrow with type guards or a targeted `as`.
- Web additionally enforces `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `isolatedModules` — an unused import fails the build.

**Naming**
- Server modules lowercase, one word where possible, kebab-case when two; each file is a topic. Web components PascalCase, one per file, file name = component name.
- camelCase, verb-first, short function names; db accessors use the fixed verb vocabulary `create*/get*/find*/list*/update*/set*/delete*/rename*/sweep*`; predicates read as booleans; "of" helpers compute for one input.
- **snake_case is reserved for fields mirroring the SQLite schema or the wire format** (`node_id`, `review_at`, `cost_source`, `input_tokens`). Do not camelCase them in transit.
- Module-level constants UPPER_SNAKE (`PRICES_AS_OF`, `PROBE_MS`). Union-of-string-literal types instead of enums; no interfaces, `type` aliases only; `XxxRow` for SQLite rows, `XxxArgs` for tool arguments, `XxxPayload` for event payloads. `as const` + `typeof` for runtime lists that double as types.

**Errors and logging**
- Throw plain `Error` with a lowercase, human-readable message that can be shown to the learner or the model as-is. No custom error classes, no error codes.
- Always narrow a caught value with `e instanceof Error ? e.message : String(e)` on the server (`safeMessage` already does this with redaction).
- Fire-and-forget promises are `void`-marked with a logging catch. Best-effort operations swallow with an empty catch carrying a one-word comment saying why.
- The server logs almost nothing: startup facts and failures only, prefixed `[tag]`. **Never log per request.** Everything the learner or model should see goes through the event stream or the tool result.

**Comments**
- Every server module opens with a `/** … */` block as **prose paragraphs**, not bullets, explaining what the module is for and the design reasoning. Inline `//` comments explain a non-obvious *why* in one plain-English sentence; they never restate the code. Reference the learning-science reasoning where it drives a decision. One-line `/** … */` on exported functions, constants and ambiguous type fields; no `@param`/`@returns`. No TODO/FIXME.
- Zod schemas for MCP tools carry `.describe(...)` on every field — those strings are the model-facing documentation.

**Module design**
- Named exports only; `export default` appears nowhere in `server/src` or `web/src`. No barrel files — import from the concrete module.
- `process.env` is read **once, in `server/src/config.ts`**, and nowhere else (the standalone `mcp.ts` is the documented exception). Other modules import the exported constants.
- Module-level state is allowed when it *is* the module's purpose and is documented.
- On the web, add a new endpoint as a new key on the single `api` object in `web/src/lib/api.ts`; never `fetch` in a component. Shared web types are hand-mirrored in `web/src/lib/types.ts`; there is no generated client.

**Architectural invariants that this phase touches directly**
- **The tool set must match in four places** (plus the plugin commands): `tools.ts` `DERIVE_TOOL_NAMES`, `agent.ts` `buildTools`, `mcp.ts` `registerTool` calls, `index.ts`'s external-action `switch`, and `plugin/commands/*.md` `allowed-tools`.
- **Event types must match in two places**: whatever the server `emit`s and `web/src/lib/useLesson.ts`'s `EVENT_TYPES` + `applyEvent`. D-09/D-10/D-17 deliberately add none.
- One turn per lesson (`active` map); one held card per external lesson.
- Grading and steering live in `actions.ts`, never in a driver. The driver dispatches; `actions.ts` decides.
- Usage is accounting, not narrative: per model request, its own table, never an event.
- Provider facts live in `providers.ts`; the browser hard-codes none of them.
- The `repo.ts → library.ts → materials.ts → repo.ts` import ring is safe only because no module in it reads another's bindings at module-evaluation time. If the fetch tool of D-21 touches `library.ts`, keep every cross-module call inside a function body.
- Secrets: none in code; `.env` holds only the optional settings listed in `.env.example`.

**Simplicity rule (PROJECT.md, binding on every phase)**
- One screen, one next step. Everything but the lesson and the next step lives behind Settings. No feature ships without a one-sentence reason tied to learning better. D-13 adds one string to an existing pill, D-18 one string to an existing row, D-16 one sentence to Settings, D-22 one row to Settings. Nothing else may appear on screen.

---

## Security Domain

`security_enforcement: true`, `security_asvs_level: 1`.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (unchanged) | The per-install token in `credentials.ts` already gates every `/api` route; this phase adds no auth surface |
| V3 Session Management | no (unchanged) | 30-day cookie / `x-derive-token`, Phase 1 D-06 |
| V4 Access Control | yes | Every new read/write scoped by `learner_id` via `learnerOf(c)`; `turn_messages` scoped by lesson, and a lesson is scoped by learner. Never take `lesson_id`/`learner_id` from a tool argument — `recordUsage`'s comment states the rule and the new tables must follow it |
| V5 Input Validation | yes | PROV-10's server-side half: incoming tool calls validated against the **full zod schema** from `tools.ts`, never the narrowed dialect. `~/.derive/prices.json` is learner-editable input and must be validated the way `keys.ts` validates `secrets.json` — a non-object, a non-numeric rate or a negative rate is an error sentence, not a silent zero |
| V6 Cryptography | yes (nothing hand-rolled) | No new crypto. Keys stay plaintext under 0600 in `secrets.json`, the deliberate posture recorded in `keys.ts`'s module comment |
| V7 Error Handling & Logging | yes | Every provider sentence through `safeMessage`/`redactErrors`; the new search key registered with `registerSecret` on load so it is redacted from the first request that could echo it |
| V12 Secure Communication | yes | HTTPS to every remote provider; see the redirect finding below |
| V13 API & Web Service | yes | SSRF: D-21's fetch tool reuses `assertPublicHost` + `fetchPublic`'s per-hop guard and byte caps unchanged |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| **API key exfiltrated via an HTTP redirect from a learner-supplied base URL** | Information Disclosure | **New in this phase and worth a task of its own.** `@ai-sdk/provider-utils`'s `postToApi` calls `fetch(url, { … })` with no `redirect` option, i.e. the default `redirect: 'follow'`. `probe.ts` deliberately refuses redirects for exactly this reason ("derive does not follow redirects that could carry a key"). The fetch spec strips `Authorization` on a cross-origin redirect, which covers the openai-compatible row's bearer, but **custom key headers are not stripped** — the AI SDK's own source says so: "provider API keys carried in custom headers (e.g. `x-key`) must be dropped here as well". All five provider factories accept a `fetch?: FetchFunction` option. Pass a wrapper that sets `redirect: 'manual'` and throws on a 3xx, matching `probe.ts`'s posture. `[VERIFIED: @ai-sdk/provider-utils/dist/index.js:3461-3463 postToApi; the fetchWithValidatedRedirects doc comment; `fetch?:` present on AnthropicProviderSettings, OpenAI, Google and OpenRouter settings types]` |
| SSRF via a tutor-supplied URL to the fetch tool | Tampering / Info Disclosure | `assertPublicHost` (DNS-resolved private-range check, scheme allow-list) + `fetchPublic`'s per-hop re-guard, content-length and byte caps. Unchanged from Phase 1 D-10 |
| SSRF via the learner-supplied SearXNG base URL | Tampering | **Do not** apply `assertPublicHost` — a local instance is the normal case. Treat it as `probe.ts` treats a local row (`isLocalUrl` decides the timeout and the sentence shape), and apply `assertPublicHost` to the *result* URLs the tutor then fetches |
| Secret leaking into an event, export, log or error | Info Disclosure | `registerSecret` on load for the new search key; every provider sentence through `safeMessage`; `redactDeep` on anything echoed. The `turn_messages` blob is a new export-adjacent surface — it contains the tutor's prose and tool arguments, never a key, but it must go through the same redaction path if it is ever surfaced |
| Prompt injection from a fetched page or a search result steering the tutor | Tampering | Inherent to the method and already present (the library and material tools fetch arbitrary text). The mitigation that matters here is that **grading and node-locking live in `actions.ts`**, server-side, and a tool result cannot change an FSRS row except through the actions that validate it |
| A malicious `prices.json` making a paid lesson read as free | Tampering (low severity, local-only) | Validate rates as finite non-negative numbers; an unreadable or invalid file is loud and nothing merges, per the `keys.ts` pattern. The file is 0600-adjacent and under the learner's own uid, so this is a robustness concern rather than a trust boundary |
| Unbounded provider spend from a runaway loop | Denial of Wallet | D-05's step cap, D-25's pre-request refusal, and D-11's bounded retry window are the three guards; all three must actually be wired, and the step cap is the one that is mandatory because `stopWhen` defaults to one step |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Anthropic populates `server_tool_use.web_search_requests` inside `message_delta.usage` on a **streaming** request, so the search count reaches `providerMetadata.anthropic.usage` | Finding 4b | The native search charge is invisible on Anthropic and D-20's second clause is unmet. Mitigation: count provider-executed search `tool-call` parts from `fullStream` instead, which works on all three providers |
| A2 | OpenAI exposes no per-call native-search count through the AI SDK's provider metadata | Finding 4b | If it does, a simpler read exists than counting stream parts |
| A3 | Gemini's rejected JSON Schema keyword set is approximately "anything beyond `type`, `properties`, `required`, `description`, `enum`, `items`" | Finding 7 | A rejected keyword returns a 400 from Google on every Gemini lesson. Mitigation: one `checkpoint:human-verify` that posts a real `set_plan` schema to a Gemini key and records the answer |
| A4 | OpenAI's strict-mode numeric limits (property count, nesting depth, enum size, total string length) are not binding for Derive's schemas | Finding 7 | A strict-mode 400 on `set_plan`. Low risk: the largest schema is 2 top-level properties and a 5-property array item |
| A5 | OpenRouter's `/api/v1/models` pricing mirrors each vendor's own first-party list price closely enough to seed the `anthropic`/`openai`/`gemini` rows | Finding 9 | Cost figures are systematically off for the native rows. Mitigation: cross-check the five or six shipped models against each vendor's pricing page before committing `PRICES_AS_OF` |
| A6 | A character-based estimate (around `chars / 3`) is conservative across the Anthropic, OpenAI and Gemini tokenizers | Standard Stack / D-25 | Either a lesson is refused too early (annoying) or too late (a provider context error reaches the learner raw, which D-25 exists to prevent). Mitigation: bias the divisor low and the headroom fraction high; both numbers are the planner's to pick with reasoning |
| A7 | Tavily's free tier is large enough to be worth offering as the default fallback | Finding 10 | The Settings copy over-promises. Mitigation: do not quote a number anywhere in the UI |
| A8 | `maxTurns: 400` (Agent SDK turns) and `isStepCount(400)` (model calls) are near enough that "no existing lesson behaves differently" holds | Pitfall 10 | A long lesson hits the cap earlier or later than today. Low impact: D-05 ends the turn continuably, never losing the lesson |
| A9 | The `openai-compatible` row's endpoints generally support tool calling at all | PROV-05 | A learner's endpoint silently cannot teach. This is Phase 4's PROV-07 (capability probes) by design; for this phase, a clear provider error is acceptable |
| A10 | `providerOptions.openai.store` defaults to the provider's own behaviour and setting it to `false` is safe | Runtime State Inventory | Minor; the option is documented and optional |

---

## Open Questions (RESOLVED)

> All five were settled during phase planning on 2026-10-01 and each resolution is landed in
> executable plan content. The resolution marker on each question names the plan that carries it;
> nothing below is still open.

1. **Where does the native-search per-call charge go in the ledger?** — **(RESOLVED: 03-02)**
   - What we know: the charge is real ($0.01/call on Anthropic and OpenAI, $0.014 on Gemini per OpenRouter's table), the count is reachable from the stream, and the `usage` table has no column for it.
   - What's unclear: whether the planner prefers folding it into `cost_usd` (no migration, lesson total stays correct, `cost_source: 'table'` for that component) or recording it as a separate all-nulls usage row (auditable, costs a migration and a `cost_source` semantics discussion).
   - Recommendation: fold it into `cost_usd` and say so in the cost module's doc comment. Raise it in the plan so it is a decision, not an omission — D-20 explicitly asks for it.
   - **Resolution (03-02, Task 3):** the recommendation was taken. `costOf` reads an optional `searches` field on the usage row, prices it at the model's `web_search` rate and folds the result into `cost_usd`; that component carries `cost_source: 'table'`, and the module header records the decision and the rejected all-nulls-row alternative in one sentence. No migration and no new `cost_source` meaning. Plan 03-06 supplies the count.

2. **Does the strict dialect ship as the OpenAI default, or as a CI-validated projection that is off by default?** — **(RESOLVED: 03-07)**
   - What we know: strict mode is opt-in per tool; enabling it costs `minItems`/`maxItems`/`minimum`/`maximum`, which `set_plan` and `quiz` rely on and which `wire-surface.test.ts` currently asserts.
   - What's unclear: whether reliable tool inputs or preserved bounds matter more to the tutor's behaviour.
   - Recommendation: build and CI-validate the projection (PROV-10 and D-29 require it), default the adapter row to `strict: false`, and write the reasoning beside it. Phase 4's conformance harness can flip it and measure.
   - **Resolution (03-07, Tasks 2 and 4):** the recommendation was taken. The `openai-strict` dialect is built and CI-validated two ways (fixture diff plus an outright rules assertion), but the OpenAI adapter row's `dialect` is `'full'`, with a one-sentence comment beside it naming the four bounds strict mode would cost `set_plan` and `quiz`. Phase 4's harness can switch it on.

3. **What are the step-cap number and the headroom fraction?** — **(RESOLVED: 03-01 and 03-02)**
   - Left to the planner by the discretion note. The only hard facts: `stopWhen` has no useful default (1), and there is no SDK source for context windows.
   - Recommendation: `isStepCount(400)` to mirror today, and a headroom fraction high enough that the conservative estimator never under-refuses — write both numbers with their reasoning, as the note asks.
   - **Resolution:** step cap is `isStepCount(400)`, passed explicitly in `drivers/api.ts` (03-01, Task 3) with its reasoning as a one-sentence comment — it mirrors today's `maxTurns: 400`, the unit is model calls rather than agent turns, and it is a runaway guard that ends the turn continuably. Headroom is **0.8**: `headroomCheck` refuses above `window × 0.8` (03-02, Task 4), biased high because the `chars / 3` estimator is deliberately conservative and a model whose window is absent from the table abstains rather than refusing on a guess.

4. **How does the stub `LanguageModel` reach the real loop?** — **(RESOLVED: 03-01 and 03-09)**
   - What we know: `setDriverOverride` installs a *driver*, which would bypass the loop; the criterion is better served by injecting a `LanguageModel`.
   - Recommendation: a module-level `setModelOverride(factory)` in `drivers/api.ts` with the same posture as `setDriverOverride` ("no route, header, environment variable or config file can set it"), so `api.test.ts` drives the genuine `streamText` path with `MockLanguageModelV4`.
   - **Resolution:** the recommendation was taken. `drivers/api.ts` exports `setModelOverride` and `modelOverride` (03-01, Task 3), and 03-09 runs the whole HTTP suite through the real `streamText` loop with a stub `LanguageModel` and no network and no key — Success Criterion 1 is met by exercising the loop, not by replacing it.

5. **Does `jsonSchemaOf` switch from `io: 'output'` to `io: 'input'`?** — **(RESOLVED: 03-07, Task 2)**
   - Semantically `'input'` is right for a tool input schema, but it may move the frozen snapshot.
   - Recommendation: check whether it changes any of the 22 tools' projections; if it does not, switch it and note why; if it does, leave it and note why.
   - **Resolution:** both branches are written out in the plan rather than guessed. 03-07's Task 2 instructs: check whether `io: 'input'` moves any of the 22 tools' `'full'` projections; if it does not, switch and record in a one-sentence comment that the switch moved nothing; if it does, leave the default and record why, because moving the frozen fixture for a semantic preference is not a change this phase needs. The executor cannot land this one silently either way.

---

## Sources

### Primary (HIGH confidence)
- Installed packages read and executed this session: `ai@7.0.126` (`dist/index.d.ts`, `dist/index.js`, `test.d.ts`, and the **shipped `docs/` tree**: `03-agents/04-loop-control.mdx`, `03-ai-sdk-core/15-tools-and-tool-calling.mdx`, `03-ai-sdk-core/50-error-handling.mdx`, `03-ai-sdk-core/55-testing.mdx`, `06-advanced/02-stopping-streams.mdx`), `@ai-sdk/anthropic@4.0.71` (+ `docs/05-anthropic.mdx`), `@ai-sdk/openai@4.0.83` (+ `docs/03-openai.mdx`), `@ai-sdk/google@4.0.87` (+ `docs/15-google.mdx`), `@ai-sdk/openai-compatible@3.0.62` (+ `docs/index.mdx`), `@openrouter/ai-sdk-provider@3.1.0`, `@ai-sdk/provider@4.0.21`, `@ai-sdk/provider-utils@5.0.53`, `zod@4.6.5`
- Four executable probes written and run under `node --import tsx --test`: a two-step tool loop with a serialisation mutex; providerMetadata/usage.raw passthrough; mid-stream abort with an orphaned tool call; a no-`execute` tool. Plus one `tsc --noEmit` compile of a five-provider driver skeleton under the repo's exact flags with `typescript@7.0.2`
- `npm view` for version, `peerDependencies`, `dependencies`, `engines`, `dist-tags` and `scripts.postinstall` on all six packages
- `GET https://openrouter.ai/api/v1/models` (463 models), fetched 2026-10-01 — context windows and per-token pricing including cache-read, cache-write and per-call web-search rates
- This repository, read this session: `server/src/driver.ts`, `drivers/fake.ts`, `agent.ts`, `tools.ts`, `providers.ts`, `settings.ts`, `probe.ts`, `migrations.ts`, `db.ts`, `config.ts`, `keys.ts`, `secrets.ts`, `prompt.ts`, `library.ts`, `index.ts`, `web/src/pages/Lesson.tsx`, `web/src/pages/Home.tsx`, `web/src/lib/useLesson.ts`, `server/test/wire-surface.test.ts`, `server/test/wire-surface.json`, `.env.example`, `.planning/config.json`, `.planning/REQUIREMENTS.md`, `method/` and `method/surfaces/`
- `gsd-tools query package-legitimacy check --ecosystem npm` for all six packages

### Secondary (MEDIUM confidence)
- `developers.openai.com/api/docs/guides/structured-outputs#supported-schemas` — the strict-mode unsupported-keyword list and the all-required / nullable-union rules
- `docs.tavily.com/documentation/api-reference/endpoint/search` — endpoint, auth header, minimal body, response fields
- `docs.searxng.org/dev/search_api.html` — endpoint, `format=json`, the `settings.yml` requirement, no auth

### Tertiary (LOW confidence)
- `ai.google.dev/gemini-api/docs/function-calling` — documents the supported fields by example only and names no exclusions; the Schema reference page did not render. Gemini's exact rejected-keyword set is unresolved (A3) and should be settled by one real-key probe

---

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — six versions confirmed against the registry, peer and dependency graph checked, all six installed and compiled against with the repo's own compiler flags
- The loop, usage grain, abort semantics, message persistence, tool-execution concurrency, retry behaviour: **HIGH** — read in the published type declarations and compiled source, and confirmed by executed probes
- OpenRouter cost path: **HIGH** — typed declaration, compiled streaming source, and a passthrough probe; upgraded from the roadmap's MEDIUM
- Prompt caching, native-search coexistence, OpenAI strict rules, per-dialect normalisation: **HIGH** for the mechanics (in-package docs plus compiled source), **MEDIUM** for the Gemini-3 boundary condition, which I read in the compiled branch but could not exercise
- Pricing and context-window data: **HIGH** as a record of what OpenRouter publishes, **MEDIUM** as a statement of each vendor's own list price (A5)
- Gemini's rejected JSON Schema keywords: **LOW** (A3) — one real-key probe converts it
- Search-provider free tiers: **LOW** (A7) — deliberately not quoted anywhere
- Repo integration facts: **HIGH** — every claim cites a file and was read this session

**Research date:** 2026-10-01
**Valid until:** 2026-10-15 — the AI SDK publishes several times a day (every one of the six packages had a release within 12 days of this research), so re-check the six versions and `npm view ai version` before the install task runs. The repo-side findings and the loop semantics do not expire.
