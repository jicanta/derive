# Phase 3: Owned Loop: API Keys and Gateways - Context

**Gathered:** 2026-10-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Derive stops borrowing somebody else's agent loop. It runs its own tool-calling conversation — the loop the Claude Agent SDK and the Codex SDK currently own — against an Anthropic, OpenAI or Google Gemini API key, through OpenRouter, and against any OpenAI-compatible endpoint entered as a base URL plus key. Parity is the bar: the same 22 tools from the one registry, the same method text, sequential tool execution that is idempotent by call id, resume after an interruption, retries behind a visible "provider busy" status, web search and fetch on every path, and the cost of each lesson visible where the lesson is — priced from a versioned table whose "prices as of" date the learner can override locally. CI validates every per-dialect tool projection and the server validates incoming tool calls against the full schema. Requirements PROV-01, PROV-02, PROV-03, PROV-04, PROV-05, PROV-08, PROV-09, PROV-10, COST-02, COST-04.

Two items beyond the roadmap's literal wording are deliberately folded in, each named in the decisions below: the WR-01 defect from `02-REVIEW.md` (a learner's model override is a bare string resolved against whichever provider is active, which this phase makes reachable by taking teaching providers from two to seven), and the catalogue note rewrite that the Phase 2 rows promised would arrive "with the next release".

Not in this phase: local models and capability probes (Phase 4, PROV-06/07 — though they ride this phase's loop by construction), "test teaching" from Settings (Phase 4, PROV-11), the nightly conformance harness (Phase 4, PROV-13), the usage page with running totals (Phase 4, COST-03), Copilot and Gemini CLI drivers (v2), per-lesson model switching and tiered roles (out of scope, PROJECT.md).

</domain>

<decisions>
## Implementation Decisions

### The loop and its adapters

- **D-01:** Derive's own loop is built on **Vercel AI SDK v7** — one `streamText` loop bounded by `stopWhen`, with `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google`, `@openrouter/ai-sdk-provider` and `createOpenAICompatible` for the base-URL row. The SDK normalises messages, tool calls, streaming and usage, so one loop serves five providers and Phase 4's Ollama, LM Studio and llama.cpp arrive on the same loop rather than beside it. Accepted cost: roughly five new dependencies in a package file that has held nine pinned ones, and a MEDIUM-confidence `providerMetadata` path for OpenRouter's per-response cost. **Explicitly rejected:** native provider SDKs with three message shapes, three tool-call shapes and three stream parsers to maintain; and a hand-rolled fetch layer, which `server/src/probe.ts` shows is viable for a models list but not for a streaming tool-call loop. — **Reversibility:** costly — the adapter table, the message persistence shape and Phase 4's local providers all read the SDK's `LanguageModel` and `ModelMessage` types; replacing it later rewrites the driver and the `turn_messages` codec, though the loop's semantics recorded here are portable.

- **D-02:** **One `api` driver plus a per-provider adapter table.** A single file in `server/src/drivers/` holds one `runTurn` and one loop; a table keyed by `ProviderId` supplies the model factory, the schema dialect, the native-search tool, the cache-control hook and the usage/cost reader. Adding a sixth provider is one table row beside `server/src/providers.ts` — which is the milestone's whole point. Mirrors how `probe.ts` already switches on a `ProviderSpec` rather than on a chain of branches. **Explicitly rejected:** one driver per provider (the loop, the retry policy and the tool dispatch would exist five times, where a fix to one can miss four) and inline `if (provider === …)` branching.

- **D-03:** When OpenRouter's per-response cost is absent from `providerMetadata`, **fall back to the pricing table with `cost_source: 'table'`** and let the learner's label move from `billed` to `estimated`. The roadmap's own stated fallback. **Explicitly rejected:** a second round trip to OpenRouter's `/api/v1/generation` for the authoritative figure — it puts a new failure mode in the hot path of every response; and recording tokens with no money figure at all, which leaves a learner on a paid provider reading a partial total.

- **D-04:** **Phase 2 D-04 still holds now that Derive owns the messages.** `turn_messages` persists provider-neutral AI SDK `ModelMessage`s so resume-after-interrupt works within one provider, and a provider change **drops them**; the tutor rebuilds from the lesson's events and nodes, exactly as the Claude and Codex paths already do. The reason is concrete rather than conservative: carrying history across a switch means replaying Anthropic thinking parts and Gemini thought signatures into a provider that rejects them. **Explicitly rejected:** carrying a sanitised history across the switch (reverses a decision Phase 2 marked costly), and one parked thread per provider (two histories and no answer to which is the lesson's).

- **D-05:** A turn is bounded by a **generous step cap of about 400**, matching today's `maxTurns: 400` so no existing lesson behaves differently, and hitting it **ends the turn through the normal `turn_end` with a continuable status** — the same shape as a Stop, never a lost lesson. The cap is a runaway guard, not a teaching limit.

- **D-06:** **Prompt caching ships in v1** as a stable-prefix split: the stable prefix (the rendered method text and the tool contract) carries Anthropic `cache_control`; the volatile tail (material, library, learner profile, lesson state) follows it. OpenAI and Gemini cache automatically and need only the prefix kept byte-stable. The method text alone is ~29KB in `server/src/method.generated.ts` and the loop resends it on every step, so this is the single largest cost saving available — and COST-01 already records cache read and cache write tokens, so the saving is visible in the ledger from the first lesson. — **Reversibility:** reversible.

- **D-07:** **Tool-call idempotency is persisted.** Each executed tool call's id and its result are stored alongside `turn_messages`, so a replay after a crash or a restart returns the recorded result instead of re-running the tool. This is the only version under which PROV-08's "interrupting a turn and resuming continues the lesson" is literally true rather than usually true, and the only one that stops a replay re-grading a quiz and corrupting the learner's FSRS record. **Explicitly rejected:** an in-memory `Set` per turn (covers a provider's retry, not a restart — and the restart case is the one that damages the memory record) and auditing the 22 tools to be naturally idempotent (grading is not, and the guarantee would live in 22 places forever). — **Reversibility:** costly — a table other resume behaviour reads; the grain is chosen now.

- **D-08:** Parallel tool calls are **disabled at the provider where the flag exists and serialised unconditionally in the loop** as the backstop — one call at a time, results returned in the order received. Belt and braces, because Derive's cards block on the learner and a provider that ignores the flag must not be able to open two.

### What the learner sees mid-turn

- **D-09:** The learner **does not see the model's reasoning**. An ephemeral `status` line reading `Thinking` — exactly what `server/src/agent.ts` emits today — and never the reasoning text. It is identical on every provider, which matters because some return only a token count or an encrypted blob and could never show it, and the lesson's durable record stays the tutor's teaching rather than its scratchpad. No new `EVENT_TYPES` entry, no `applyEvent` branch, nothing new in the Obsidian mirror.

- **D-10:** The **"provider busy" state is ephemeral**: a `status` line reading `Provider busy, retrying in Ns` while the backoff runs, and when the retries are exhausted the existing `turn_end` error path carries the provider's own sentence. A transient stall is not part of what the learner learned, so it does not enter the event log, the reducer or their notes. Follows Phase 1 D-14's rule for live cost.

- **D-11:** **Retries are patient, up to roughly two minutes.** Honour the provider's `Retry-After` header when it sends one, exponential backoff with jitter otherwise, with the countdown visible and Stop working throughout. A free-tier Gemini or OpenRouter rate limit can be a full minute, and a lesson that dies on it is a dead lesson; a learner who does not want to wait presses Stop.

- **D-12:** **Stop aborts, patches orphans, and stays resumable.** Abort the request, write a synthesized error `tool_result` for every orphaned tool call so `turn_messages` stays a history a provider will accept, end the turn as **interrupted rather than failed** (the existing `stopping` map already draws that distinction), and let the learner's next message continue from there. The roadmap names the orphan synthesis; this is what makes PROV-08's resume clause hold.

### Cost in the lesson

- **D-13:** The figure goes **into the existing provider pill, after the model**: `anthropic · claude-opus-5-5 · about $0.14 estimated`, in the 60px header of `web/src/pages/Lesson.tsx`. The model id takes the truncation (the pill is already `max-w-[40ch] truncate`); the cost never truncates. One element on the screen rather than two, and the pill already links to `/settings`, which is where a learner who dislikes the number goes.

- **D-14:** The label vocabulary is **four words, not three**: `provider` → `billed`, `table` → `estimated`, `subscription` → `not billed`, `unknown` → **`not reported`**. Phase 1 D-16 introduced `unknown` precisely so an upgraded install's backfilled turns and the plugin/Codex paths could say the honest blank out loud; folding it into another word would assert something the ledger does not know.

- **D-15:** The pricing table is a **committed pure-data module with a `PRICES_AS_OF` date**, the same shape and the same discipline as `server/src/providers.ts` and its `DEFAULTS_AS_OF`: no I/O, no import-time side effect, readable by a test with no database behind it. A price change is a reviewable diff, it works with the network off, and nothing in the cost path can fail. **Explicitly rejected:** fetching prices at runtime (a network call behind a cost figure, against the local-first constraint) and a shipped-plus-refresh hybrid (two sources of truth for one number).

- **D-16:** The learner overrides prices through **`~/.derive/prices.json`, merged over the shipped table, read live, with no UI** — following the pattern `server/src/keys.ts` and `server/src/credentials.ts` already establish twice: an absent file is silent, an unreadable one is loud and nothing writes while that error stands. `/settings` gains **one sentence** naming the file and the as-of date, and no new control. That is what satisfies COST-04 without putting twenty number inputs on the page whose job is picking a provider. — **Reversibility:** reversible.

- **D-17:** The cost figure **recomputes at `turn_end`**, from the usage rows the turn actually wrote; it does not tick up mid-turn. One settled number, no new ephemeral traffic on the SSE stream while the learner is reading a card, and a long turn shows the previous total until it finishes — the same honesty rule the provider pill already follows under Phase 2 D-15.

- **D-18:** The **Home row carries the lesson's total** in the same wording as the header, summed from that lesson's usage rows — a `SUM` away given Phase 1 D-13's per-request grain. Phase 5 inherits one short string per row rather than a component.

- **D-19:** Money is written to **two decimals with a floor**: `about $0.14`, and anything non-zero below a cent reads `under $0.01` rather than rounding to nothing. Exactly zero keeps its label (`not billed` / `not reported`) instead of a figure. A sub-cent lesson must not read as free on a metered key.

### Web search and fetch

- **D-20:** **Native search where the provider has one** (Anthropic, OpenAI, Gemini), the pluggable provider otherwise — PROV-09's own wording. Three of the five providers then need no second account, and the fallback runs only where it must. Two things the researcher must settle: that a native server-side search tool coexists with the strict tool-schema projection of D-23, and that its separate per-call charge (Anthropic bills searches apart from tokens) lands in the usage ledger rather than vanishing from the lesson's cost.

- **D-21:** **Fetch is one Derive tool over the library fetcher.** A new entry in the tool registry implemented on `library.ts`'s `fetchPublic(url, accept, maxBytes, guard)` plus `assertPublicHost`, identical on all five providers — one implementation, one SSRF guard already hardened under Phase 1 D-10, one status line, and it appears in the wire-surface snapshot like every other tool. `{{WEB_TOOLS}}` gains a third rendering for the owned-loop surface, which is exactly what that placeholder exists for. **Explicitly rejected:** routing fetch through `add_resource` (it would make every page the tutor glances at a permanent library entry, which the method deliberately limits to one or two per lesson) and using a provider's own URL-context feature where it has one (two code paths for one method sentence, and the provider's fetch bypasses the guard).

- **D-22:** The fallback search is configured in **one small "Web search" block on `/settings`**, under the provider rows: a choice of the provider's own / Tavily / SearXNG, its key stored in `secrets.json` behind D-10's masked `{ set, hint }` shape and its base URL in the settings table, saved as-you-go per D-03. The one-sentence learning reason the simplicity rule asks for: *the method requires the tutor to verify a fact before teaching it, and a learner on OpenRouter has no way to do that without this.* **Explicitly rejected:** environment variables only (a learner who installed Derive to learn rather than to configure it would silently lose the verification discipline with no way to find out why) and catalogue rows beside the providers (`teaches: false` already means something else there).

- **D-23:** When no search is available at all, **`{{WEB_TOOLS}}` renders as an instruction that there is no web search on this provider and that the tutor must say when it is unsure rather than guess.** One render change, no method rule lost, well inside the bounded per-surface variation Phase 1 D-02 allows — and the Settings block states why search is unavailable so the learner can fix it. **Explicitly rejected:** refusing to teach without search (it would block the free OpenRouter path this phase exists to open and Phase 4's entire offline promise) and leaving the prompt unchanged (a model told to verify with a tool that is not there asserts instead).

### The context-window limit

- **D-24:** A lesson that outgrows the window **refuses with a clear card naming the next step** — the lesson has grown too long, start a review lesson on these nodes. Every locked node, every FSRS row and the graph are already persisted, so nothing is lost and the review path already exists. The roadmap's stated first version, and the only one under which silent truncation can never drop the understanding gate. **Explicitly rejected:** compacting the middle of the history (the gate would then rest on a summary the model wrote about itself) and auto-splitting into a seeded new lesson (lesson-splitting machinery, and a second meaning for "this lesson" that Phase 5's Home would have to explain).

- **D-25:** The limit is detected by **estimating the prompt conservatively against the model's known window and refusing at a headroom threshold, before the request**. The learner gets Derive's own sentence and next step rather than a provider error, it behaves identically on all five providers, and the same estimator is what Phase 4 needs to size Ollama's `num_ctx` and to check a model's window through `/api/show`. **Explicitly rejected:** waiting for the provider's context-length error (five error shapes to recognise, a wasted request each time, and an unrecognised wording reaches the learner raw).

### Catalogue flip and the WR-01 defect

- **D-26:** **WR-01 is fixed in this phase.** `LearnerPrefs.model` becomes `Record<provider, modelId>`, `chooseModel` reads `prefs.model?.[provider]`, and a migration converts an existing bare string onto the provider that was active when it was stored. This is the fix `02-REVIEW.md` itself proposed. The reason it belongs here rather than in Phase 5: this phase takes the number of teaching providers from two to seven, which is what turns a latent bug into one learners will actually hit — and PROJECT.md already carries it as an Active requirement with no phase assigned. — **Reversibility:** one-way — a migration of a stored learner preference; reverting needs a second migration that cannot recover which provider an id was meant for.

- **D-27:** The **Claude Code row stays `teaches: true`** and keeps running the app's tutor on the Claude Code login through the Agent SDK; its `note` is reworded to point a learner who wants in-app Claude at the Anthropic key row beside it. PROJECT.md's decision was about which route Derive *recommends*, not about deleting a driver that works. The five unwired rows (`anthropic`, `openai`, `gemini`, `openrouter`, `openai-compatible`) flip to `teaches: true` and lose the `unwired()` sentence promising teaching "with the next release" — in the release that delivers it.

### Tool schema projection (PROV-10)

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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap and requirements
- `.planning/ROADMAP.md` §"Phase 3: Owned Loop: API Keys and Gateways" — the goal, the five success criteria, and the research note that names AI SDK 7, the OpenRouter `providerMetadata` cost path, per-provider JSON Schema dialect rules, `prepareStep`/`pruneMessages`, `turn_messages`, orphan `tool_result` synthesis on abort, and the stable-prefix cache split.
- `.planning/REQUIREMENTS.md` §"Provider layer" and §"Cost" — PROV-01..05, PROV-08..10, COST-02, COST-04, and the requirement→phase map.
- `.planning/PROJECT.md` §Key Decisions, §Active, §Out of Scope — "Full parity across providers (Derive owns its agent loop)"; "in-app Claude runs on an API key; the plugin is the subscription route"; the unassigned Active requirement behind D-26; the simplicity rule; no per-lesson model switching, no tiered roles.

### Prior-phase decisions this phase builds on
- `.planning/phases/01-foundation/01-CONTEXT.md` — D-05 (one registry for all 22 tools, which D-28 projects), D-08 (the wire-surface snapshot that D-29 extends), D-10 (SSRF and path guards that D-21 reuses), D-11 (exact-match redaction, keys registered at load), D-13 (usage per **model request**, not per turn), D-14 (usage is its own table, never an event; live cost is ephemeral), D-15 (the `turns` table `turn_messages` points at), D-16 (the four `cost_source` values behind D-14, and the explicit rejection of estimated tokens).
- `.planning/phases/02-settings-and-secrets/02-CONTEXT.md` — D-04 (settings apply on the next turn; a provider change starts a fresh session — upheld by D-04 here), D-05/D-06 (the catalogue and `teaches` flag that D-27 flips, `DEFAULTS_AS_OF` that D-15 copies), D-08/D-09 (the model combobox and the per-learner override that D-26 re-keys), D-10 (`secrets.json`, `{ set, hint }`, the pattern D-22 reuses for a search key), D-11 (env > file > detection per turn), D-14 (`friendly`-style provider sentence plus fix hint, which D-10/D-11 here reuse for provider errors), D-15 (the header pill that D-13 extends and the rule that it records the turn, not Settings).
- `.planning/phases/02-settings-and-secrets/02-REVIEW.md` §WR-01 — the defect text and the proposed fix that D-26 adopts.
- `.planning/phases/02-settings-and-secrets/02-LEARNINGS.md` — the resolver's two modes (`resolveTutor` may spawn, `currentTutor` never does); `requestFor` omitting the Authorization header entirely when no key is set; local-vs-remote judged on the literal host with no lookup.

### Code that defines the contracts this phase extends
- `server/src/driver.ts` — `Driver.runTurn(ctx, sink)`, `TurnContext`, `EventSink`, `sinkFor`, `setDriverOverride`. The new driver implements this and nothing else; the sink's vocabulary is the ceiling on what the learner can be shown.
- `server/src/drivers/fake.ts` — the only existing file in `drivers/`; the precedent for a driver and for the stub of Success Criterion 1.
- `server/src/agent.ts` — the Claude driver, and lines ~190-225 for the exact `assistant` / `delta` / `status` emission pattern D-09 and D-10 keep.
- `server/src/providers.ts` — `PROVIDERS`, `ProviderSpec`, `teaches`, `DEFAULTS_AS_OF`, `providerOfDriver`. D-27 edits six rows; D-02's adapter table is keyed by `ProviderId`.
- `server/src/settings.ts` — `resolveTutor` / `currentTutor`, `chooseModel` (the function D-26 changes), `effectiveKey`, `lockedBy`, `normaliseBaseUrl`, `backendOf`. The driver reads its provider, model and key through here.
- `server/src/tools.ts` — `TOOL_REGISTRY`, `shapeFor`, `descriptionFor`, `jsonSchemaOf(spec, surface)`, `ToolSurface`. D-28 extends the projection; D-21 adds a tool.
- `server/src/probe.ts` — `requestFor`, `providerSentence`, `hintFor`, `getJson`, `isLocalUrl`, `REMOTE_MS`. The provider-error-to-sentence path D-10/D-11 reuse, and the precedent for switching on a `ProviderSpec`.
- `server/src/library.ts` — `fetchPublic`, `assertPublicHost`, `isPrivateAddress`, `htmlToText`. D-21's fetch tool is built on these.
- `server/src/keys.ts` and `server/src/credentials.ts` — the 0600, atomic, read-live-behind-a-1s-cache, absent-is-silent / unreadable-is-loud file pattern that D-16's `prices.json` and D-22's search key follow.
- `server/src/migrations.ts` — the numbered transactional runner every new table and D-26's preference conversion arrive through.
- `server/src/db.ts` — `recordUsage`, `UsageInput`, `endTurn`, `turnStatusOf`, `LearnerPrefs`, `cleanPrefs`. Where D-26 and the cost sum land.
- `server/src/prompt.ts` and `method/` — `{{WEB_TOOLS}}` substitution (`prompt.ts:23-24`), `method/20-tools.md`, `method/60-process.md`, `method/70-material.md`, `method/80-library.md` and `method/surfaces/`. D-23's third rendering and D-06's stable prefix are authored here, under the Phase 1 D-04 commit-and-CI-fails-on-drift policy.
- `server/src/secrets.ts` — `registerSecret`, `redact`; the search key registers here on load like every other.
- `web/src/pages/Lesson.tsx` (header, ~line 111-123, `tutorLabel` at line 33) — where D-13's cost joins the pill.
- `web/src/pages/Home.tsx` (~line 254) — the lesson row D-18 extends.
- `web/src/pages/Settings.tsx` and `web/src/components/ProviderRow.tsx` — where D-22's block and D-16's sentence go.
- `web/src/lib/api.ts`, `web/src/lib/types.ts`, `web/src/lib/useLesson.ts` — endpoints and types go in the first two; `EVENT_TYPES` and `applyEvent` in the third are deliberately **not** extended by any decision here (D-09, D-10, D-17).
- `server/test/wire-surface.json` and `server/test/wire-surface.test.ts` — the fixture and test D-29 extends.
- `server/test/api.test.ts` — the no-model HTTP suite Success Criterion 1 runs through the owned loop.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `server/src/driver.ts`: the seam is built and still unused by anything but `fake.ts`. `sinkFor(lessonId, turnId)` already carries the idempotent `endTurn`, the per-request `usage` call and the `setSessionId` write — the new driver adds no plumbing.
- `server/src/drivers/fake.ts`: a working driver in ~3.5KB, and the model for the stub of Success Criterion 1.
- `server/src/probe.ts`: `requestFor` already builds a per-provider authenticated request from a `ProviderSpec`, and `providerSentence` / `hintFor` already turn a provider's JSON error into a verbatim sentence plus a fix hint — reuse both for D-10's busy status and D-11's exhausted-retry message rather than writing a second error vocabulary.
- `server/src/library.ts`: `fetchPublic` + `assertPublicHost` + `htmlToText` is a complete, SSRF-guarded fetch-and-extract path. D-21 wraps it; it does not reimplement it.
- `server/src/keys.ts` / `credentials.ts`: the file-backed-secret pattern, twice. `prices.json` is a third instance, minus the secret.
- `server/src/providers.ts`: pure data, no I/O, no import-time side effect — the exact template for the pricing module of D-15, including the `*_AS_OF` convention.
- `server/src/tools.ts`: `jsonSchemaOf(spec, surface)` and the declared `per_surface` mechanism are already the projection seam; D-28 widens `ToolSurface` rather than inventing a parallel system.
- `server/src/migrations.ts` + `withTx`: every new table and D-26's preference conversion ride these.
- `server/test/`: 16 suites including `wire-surface.test.ts`, `usage.test.ts`, `tx.test.ts` and `spawn.ts` (the OS-allocated-port spawn helper all three server-spawning suites share).

### Established Patterns
- A driver says everything through the sink and reads everything from `TurnContext`; no hidden state, no new event type. The event vocabulary is the ceiling, and three decisions here (D-09, D-10, D-17) deliberately stay under it.
- Usage is accounting, not narrative: per model request, in its own table, never an event — Phase 1 D-13/D-14. Cost display reads rows; it does not emit them.
- `process.env` is read once in `server/src/config.ts` and nowhere else (the one module that says otherwise in prose had its own wording fixed in Phase 2 after a grep guard caught it).
- Provider facts live in `providers.ts`; the browser renders what the API returns and hard-codes none of it. A new provider is a row, not a component.
- Errors are plain lowercase `Error` sentences; routes answer `{ error }`; the web client throws that message, so a provider's own words reach the learner unchanged.
- Pure logic modules (`schedule.ts`, `providers.ts`, `probe.ts`'s pure half) have no I/O so tests can read them with no database. The cost calculator belongs in that set.
- Single quotes, semicolons, trailing commas, 2-space indent, long lines accepted, `.js` extensions on server imports, one component per file, `/** … */` module headers written as prose that explain the *why*.

### Integration Points
- `server/src/agent.ts` `runTurn` dispatch: where the new `api` driver is selected from `resolveTutor()`'s provider, alongside the existing claude/codex branches and `driverOverride()`.
- `server/src/migrations.ts`: the next numbered migrations — `turn_messages` plus the executed-call record (D-07), and the `LearnerPrefs.model` conversion (D-26).
- `server/src/tools.ts`: one new tool (D-21) and a widened dialect projection (D-28); both land in `wire-surface.json`.
- `method/` + `server/src/prompt.ts`: the third `{{WEB_TOOLS}}` rendering (D-23) and the stable/volatile prompt split (D-06), regenerated and committed under the CI drift check.
- `/api/settings`: the web-search block's read and write routes (D-22), behind the existing credential middleware.
- `web/src/pages/Lesson.tsx` and `Home.tsx`: the two cost strings (D-13, D-18) — no new component, no new event type.
- `server/package.json`: five new exact-pinned dependencies (D-01), the first additions since Phase 1 pinned the Agent SDK off `latest`.

</code_context>

<specifics>
## Specific Ideas

- The header pill reads `anthropic · claude-opus-5-5 · about $0.14 estimated`; the model id is what truncates, never the cost.
- The label vocabulary is fixed at four words: `billed`, `estimated`, `not billed`, `not reported`.
- A sub-cent lesson reads `under $0.01`. Exactly zero shows its label and no figure.
- The retry status line reads `Provider busy, retrying in Ns` and disappears; it is never written to the lesson log.
- The context refusal card tells the learner the lesson has grown too long and names the next step: start a review lesson on these nodes.
- `{{WEB_TOOLS}}` has three renderings after this phase: Claude Code's `WebSearch` / `WebFetch`, Codex's built-in web search, and the owned loop's — which itself has a no-search variant telling the tutor to say when it is unsure rather than guess.
- The `/settings` web-search block is one row: a choice of the provider's own / Tavily / SearXNG, plus the key or URL that choice needs.
- `/settings` carries one sentence naming `~/.derive/prices.json` and the `PRICES_AS_OF` date. No price inputs.
- The five unwired catalogue rows lose the `unwired()` sentence; the Claude Code row's note points in-app Claude at the Anthropic row.

</specifics>

<deferred>
## Deferred Ideas

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

</deferred>

---

*Phase: 03-owned-loop-api-keys-and-gateways*
*Context gathered: 2026-10-01*
