# Phase 4: Local Models, Parity Proof and Usage - Context

**Gathered:** 2026-10-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Derive teaches free and offline on a local model without the method silently degrading, proves any chosen model can run the method before the learner invests a session, and shows what learning has cost across every provider. Concretely: the three local providers (Ollama on its native API, LM Studio and llama.cpp through the OpenAI-compatible path) teach on the Phase 3 owned loop; the context window is sized so the method is never silently truncated, with a clear refusal instead; a "test teaching" smoke test runs from Settings on any teachable provider; a nightly method-conformance harness replays a scripted lesson per configured provider and reports whether the understanding gate, the pretest and the cumulative quiz held; and a Usage page, reached from Settings, shows a running total per learner by provider, model and lesson, with tokens-only lines for the subscription and local paths. Requirements PROV-06, PROV-07, PROV-11, PROV-13, COST-03.

Not in this phase: new cloud providers or gateways (Phase 3), the learning-experience changes (Phase 5), personalization (Phase 6), adoption and packaging (Phase 7); Copilot and Gemini CLI drivers, per-lesson model switching and tiered roles (v2 / out of scope, PROJECT.md). The Usage page's per-lesson half already shipped in Phase 3 (COST-02); this phase adds only the running total (COST-03).

</domain>

<decisions>
## Implementation Decisions

### Local provider rows (PROV-06, PROV-07)

- **D-01:** The three **dedicated local rows (Ollama, LM Studio, llama.cpp) are the canonical way to teach on a local server** — discovery, capability probe and `num_ctx` all live on them. The Phase 2 generic **OpenAI-compatible row stays remote/proxied-only**. A learner may type a localhost base URL into the generic row, but it gets **no local treatment** (no `num_ctx`, no capability refusal): the generic row is for endpoints someone else runs. — **Reversibility:** reversible.
- **D-02:** Each local row carries an **editable base URL prefilled from detection** (default ports 11434 / 1234 / 8080), so a non-default port, a LAN box or a reverse proxy is reachable through the dedicated row rather than by falling back to the generic row. Matches the approved UI-SPEC, whose error state keeps "the typed base URL and model id in their fields". — **Reversibility:** reversible.

### Context sizing — num_ctx posture (PROV-06)

- **D-03:** The default `num_ctx` is a **fixed 16k floor** on every local model, and the local row exposes a **learner-editable `num_ctx` field defaulting to 16384**, saved on blur like every other field. This is what makes the approved UI-SPEC refusal sentence — raising "the model's context window in Settings (num_ctx)" — literally true. — **Reversibility:** reversible.
- **D-04:** A model whose **maximum** window is below the method's 16k floor is **refused at config/probe time** (the row shows the capability refusal and the model cannot be selected), symmetric with the tool-calling refusal of D-06. The learner never starts a lesson the model cannot hold. — **Reversibility:** reversible.
- **D-05:** **Ollama sets `num_ctx` through its native API** (the roadmap's stated reason for using `ai-sdk-ollama` rather than the OpenAI-compatible route). **LM Studio and llama.cpp are read-only**: Derive reads the context the server reports and lets the Phase 3 pre-request estimator (03 D-25) refuse per-lesson when the prompt will not fit. Derive never fights a server's own context configuration. — **Reversibility:** reversible.

### Capability probe (PROV-07)

- **D-06:** Tool-calling capability is **read from server metadata where available** — Ollama `/api/show` capabilities (including `tools`), llama.cpp `/props` — and **proved with one tiny real tool-call round-trip where metadata is absent** (LM Studio's `/v1/models` returns ids only). Cheap where cheap, definitive where necessary. — **Reversibility:** reversible.
- **D-07:** **Metadata is read for the whole list when Settings opens / on Rescan** (cheap); the **definitive round-trip probe runs for the model the learner selects** — one probe per chosen model, before a lesson. The lesson capability-refusal card (UI-SPEC E2) remains the backstop if a model slips through. — **Reversibility:** reversible.

### Compact prompt for local providers (PROV-06)

- **D-08:** **Compaction is keyed on the local provider, not the model's window** — every model reached through a local row gets compact tool descriptions and material-outline-only, whatever its size. The **gate text is never removed** (method fidelity): compact tool descriptions reuse the Phase 3 D-28 compact projection and its `ToolSurface`. — **Reversibility:** reversible.
- **D-09:** **"Material-outline-only" means the local prompt's material section carries outlines** (section titles/keywords); the tutor pulls full text on demand through the existing `read_material` / `search_material` tools. Keeps the method's material discipline while keeping a large attachment from blowing the 16k window. — **Reversibility:** reversible.
- **D-10:** Compaction is a **silent implementation detail** — no learner-facing note. The only local-path signals the learner sees are the capability and `num_ctx` refusal cards. — **Reversibility:** reversible.

### "Test teaching" (PROV-11)

- **D-11:** "Test teaching" runs in an **ephemeral scratch lesson that is deleted (transactionally) after the run** — Phase 1 made `deleteLesson` atomic for exactly this. Nothing appears in Home, the Atlas or the Usage total. — **Reversibility:** reversible.
- **D-12:** It runs a **fixed scripted tool round-trip** — hand the model a trivial topic, require it to call the plan/quiz tools, and let Derive grade the returned quiz. It proves exactly what PROV-11 claims (the model can call the method's tools and its quiz is gradable), not that it teaches well; this matches the UI-SPEC fail strings ("called no tools", "the grade was unreadable"). — **Reversibility:** reversible.
- **D-13:** The action appears on **every teachable provider row**, not only the local rows — PROV-11 says "any chosen model", and local models are merely where failure is most likely. **This deliberately widens beyond `04-UI-SPEC.md`'s local-row placement; the UI-SPEC needs a small update to note the action on cloud rows too.** — **Reversibility:** reversible.
- **D-14:** The test's **token usage is discarded with the deleted lesson** — it never reaches the ledger or the Usage total, keeping "what learning has cost" strictly about lessons. The learner sees only the pass/fail line and latency (per the UI-SPEC copy). — **Reversibility:** reversible.

### Conformance harness (PROV-13)

- **D-15:** The harness **runs both ways** — a **scheduled GitHub Actions cron** for reachable cloud providers (repository secrets) and a **local `pnpm`/npm script** for the local models only this machine has. One script, two environments; CI never needs a learner's local model. — **Reversibility:** reversible.
- **D-16:** It drives **real configured models**, not a stub — the only thing that proves a specific provider/model follows the method. A weak local model failing the gate is an **expected, useful** finding (the roadmap says to expect small models to fail often). — **Reversibility:** reversible.
- **D-17:** It exercises **every provider available in the environment** and records an explicit **`skipped`** line with the reason (no key, server not found) for the rest, so the report is complete: a reader sees what was proved and what was not. — **Reversibility:** reversible.
- **D-18:** It produces a **JSON report plus a Markdown summary** per run — per provider/model pass/fail on the understanding gate, the pretest and the cumulative quiz, plus the tool-rejection rate (D-19..D-21) — and **exits non-zero on failure**. CI uploads it as an artifact; the local script writes it under `~/.derive`. **No learner-facing surface.** — **Reversibility:** reversible.

### Tool-rejection telemetry (Phase 1 D-06 / roadmap research note)

- **D-19:** The recorded rate counts **schema-rejected calls only** — a call whose arguments fail the full server-side zod schema (Phase 1 D-06). Not missing-tool-calls, not other non-ok outcomes; the narrow, unambiguous signal that the model produced a bad call. — **Reversibility:** reversible.
- **D-20:** It is recorded **per provider + model** (the model is the unit of tool-calling reliability; a provider figure is the sum). Satisfies the roadmap's "per provider" while keeping the diagnostic value. — **Reversibility:** reversible.
- **D-21:** It is **internal only** — in the usage ledger and the conformance report, never shown in the app, with **no runtime effect** (it does not refuse or nudge). The Usage page and Settings stay exactly as the UI-SPEC locked. — **Reversibility:** reversible.

### Claude's Discretion

The user did not open these; the planner decides them in the direction recorded here.

- **Where the local wiring lives:** adapter rows in the Phase 3 D-02 table (`server/src/drivers/adapters.ts`) for Ollama native and the OpenAI-compatible local servers; the metadata/capability probe helpers beside `server/src/probe.ts`.
- **The scripted-lesson script and its assertions:** the exact script the conformance harness and, if shared, the tool round-trip replay; the report JSON schema; the report's filename under `~/.derive`.
- **`num_ctx` field shape and bounds:** the concrete default, minimum and maximum, and whether it reuses the model-combobox row shape.
- **The compact/local `ToolSurface` name** and where the material-outline rendering is produced (`server/src/prompt.ts` + `method/`).
- **The ephemeral scratch lesson's creation and cleanup:** reuse `createLesson` + transactional `deleteLesson`, with a marker so it never appears in any listing, sum or the Atlas.
- **Whether the local rows extend `ProviderRow` verbatim or use a sibling component** — the UI-SPEC says extend `ProviderRow` and reuse `fields.ts`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap and requirements
- `.planning/ROADMAP.md` §"Phase 4: Local Models, Parity Proof and Usage" — the goal, the five success criteria, and the research note that fixes: `ai-sdk-ollama` on the native API (the only route that sets `num_ctx`); compact tool descriptions and material-outline-only for local providers with gate text never removed; record tool-rejection rate per provider in usage; minimum `num_ctx` floor 16k from a prompt estimate, checked against `/api/show`; LM Studio and llama.cpp template support (`/v1/models`, `/props`, `--jinja`); the usage page needs no research.
- `.planning/REQUIREMENTS.md` §Providers, §Cost — PROV-06, PROV-07, PROV-11, PROV-13, COST-03, and the requirement→phase map.
- `.planning/PROJECT.md` §Core Value, §Constraints, §Key Decisions, §Out of Scope — the binding simplicity rule (one screen, one next step); method fidelity (parity; a weak model teaches worse, it does not change the method); no per-lesson model switching or tiered roles.

### UI design contract (LOCKED)
- `.planning/phases/04-local-models-parity-proof-and-usage/04-UI-SPEC.md` — **approved** UI copy, color, typography, spacing and component reuse for the local-model row, the `Test teaching` control, the capability/`num_ctx` refusal cards, and the Usage page. Its strings, tokens and component choices are fixed — read before any frontend plan. **Note:** D-13 widens `test teaching` beyond this file's local-row placement, so the file needs a small update.

### Prior-phase decisions this phase builds on
- `.planning/phases/01-foundation/01-CONTEXT.md` — D-06 (strict server-side action validation — the source of D-19's rejection count), D-13 (usage recorded per model request), D-14 (usage in its own table, never an event), D-16 (a usage row every turn regardless of driver; four `cost_source` values; the Usage page can honestly say "not reported").
- `.planning/phases/03-owned-loop-api-keys-and-gateways/03-CONTEXT.md` — D-01 (AI SDK v7 loop), D-02 (one `api` driver + adapter table — local providers ride it), D-25 (the conservative prompt estimator + headroom refusal → num_ctx sizing and the per-lesson refusal of D-05), D-28 (the compact schema dialect/projection for local → D-08), D-24 (the context refusal card shape), D-20/D-23 (`{{WEB_TOOLS}}` renderings and the no-search variant the offline local path uses), D-13 (the cost-in-header pill and label vocabulary the Usage page reuses).
- `.planning/phases/02-settings-and-secrets/02-CONTEXT.md` — D-05/D-06 (the provider catalogue, the `teaches` flag, `DEFAULTS_AS_OF`), D-13 (detection on Settings open / Rescan; ports 11434, 1234, 8080), D-14 (the "test connection" result pattern the local row follows), D-15 (the lesson header pill).

### Code that defines the contracts this phase extends
- `server/src/drivers/api.ts` and `server/src/drivers/adapters.ts` — the Phase 3 owned loop and its per-provider adapter table; the three local providers are added here.
- `server/src/driver.ts` — `Driver.runTurn(ctx, sink)`, `TurnContext`, `EventSink`, `sinkFor`, `setDriverOverride`; the seam the local loop reports through.
- `server/src/providers.ts` — `PROVIDERS`, `ProviderSpec`, `teaches`, `DEFAULTS_AS_OF`, `providerOfDriver`; the local rows live here.
- `server/src/settings.ts` — `resolveTutor` / `currentTutor`, `chooseModel`, `effectiveKey`, `normaliseBaseUrl`, `backendOf`.
- `server/src/probe.ts` — `requestFor`, `providerSentence`, `hintFor`, `getJson`, `isLocalUrl`, `REMOTE_MS`; the metadata/capability probe helpers (D-06/D-07) land beside this.
- `server/src/context.ts` — the Phase 3 prompt estimator behind the headroom/`num_ctx` refusal (D-04, D-05).
- `server/src/tools.ts` — `TOOL_REGISTRY`, `jsonSchemaOf(spec, surface)`, `ToolSurface`; the compact local projection (D-08).
- `server/src/prompt.ts` and `method/` — `{{WEB_TOOLS}}` renderings, the material section (D-09's outline-only local render), and the stable/volatile split; authored under the Phase 1 D-04 commit-and-CI-fails-on-drift policy.
- `server/src/materials.ts` — `readMaterial` / `searchMaterial`; the tools D-09 pulls full text through.
- `server/src/library.ts` — `fetchPublic`, `assertPublicHost`, `htmlToText`.
- `server/src/db.ts` — `recordUsage`, `UsageInput`, `endTurn`, `LearnerPrefs`, `cleanPrefs`; where the rejection counter and the Usage-page sums land.
- `server/src/migrations.ts` — the numbered transactional runner any new table/column (rejection telemetry) arrives through; `deleteLesson` is transactional (D-11).
- `server/src/cost.ts`, `server/src/pricing.ts`, `server/src/prices.ts` — `costLabel`, the four-value label vocabulary and `weakestSource`; the Usage page must call the same formatter (UI-SPEC is explicit).
- `server/src/drivers/fake.ts` and `server/src/driver.ts` (`setDriverOverride`) — the stub precedent for the no-model HTTP test of the loop.
- `web/src/pages/Settings.tsx`, `web/src/components/ProviderRow.tsx`, `web/src/components/fields.ts` — the local row, the `num_ctx` field and the `Test teaching` action (D-02, D-03, D-13).
- `web/src/pages/` — the new `Usage` page, reached from Settings.
- `web/src/lib/api.ts`, `web/src/lib/types.ts` — the settings/usage endpoints and types.
- `server/test/api.test.ts`, `server/test/wire-surface.json`, `server/test/api-driver.test.ts` — the no-model HTTP suite, the schema snapshot, and the owned-loop test that local providers extend.
- `.github/workflows/ci.yml` — where the nightly conformance cron (or a sibling workflow) is added (D-15).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `server/src/drivers/adapters.ts`: the per-provider adapter table (Phase 3 D-02) already switches on a `ProviderSpec` — adding Ollama (native) and the two OpenAI-compatible local servers is table rows, not a new loop.
- `server/src/context.ts`: the Phase 3 estimator already computes a conservative prompt size; D-03/D-04/D-05 reuse it to size `num_ctx` and to refuse, rather than writing a second estimator.
- `server/src/probe.ts`: `requestFor` builds a per-provider authenticated request and `providerSentence`/`hintFor` turn a server's error into a verbatim sentence plus a fix hint — the metadata/capability probe and the local row's error state reuse both.
- `server/src/tools.ts`: `jsonSchemaOf(spec, surface)` and the declared `ToolSurface` mechanism are already the projection seam; the compact local form (Phase 3 D-28) is where D-08's short descriptions live.
- `server/src/db.ts` + `server/src/migrations.ts`: `recordUsage`/`UsageInput` and the numbered transactional runner are where the Usage-page sums (COST-03) and any rejection-counter table land; `deleteLesson` is already transactional for D-11.
- `server/src/cost.ts`: `costLabel`, the `billed`/`estimated`/`not billed`/`not reported` vocabulary and `weakestSource` are the one formatter the Usage page reuses (UI-SPEC forbids re-formatting numbers).
- `server/src/drivers/fake.ts` + `setDriverOverride`: the stub precedent for driving the loop with no model (Phase 3 Success Criterion 1) — the model for any structural test this phase adds.
- `web/src/components/ProviderRow.tsx` + `fields.ts`: the shipped Settings provider card (status pill, key field, model combobox, test) that the local rows and the `Test teaching` action extend; `WebSearchCard.tsx` is the "reason + one field + test" sibling shape.

### Established Patterns
- A driver says everything through the sink and reads everything from `TurnContext`; no new event type — Phase 3 D-09/D-10/D-17 deliberately stay under the event vocabulary, and this phase adds no event type either.
- Usage is accounting, not narrative: per model request, its own table, never an event (Phase 1 D-13/D-14). The Usage page reads sums; it does not emit rows.
- Provider facts live in `providers.ts`; the browser renders what the API returns (Phase 2). A local provider is a row, not a component.
- Errors are plain lowercase `Error` sentences; routes answer `{ error }`; the web client throws that message, so a local server's own words reach the learner verbatim (UI-SPEC's error state).
- Pure logic modules (`schedule.ts`, `providers.ts`, `probe.ts`'s pure half, `cost.ts`) have no I/O so tests read them with no database.
- Method text is one source rendered to targets and committed; CI fails on drift (Phase 1 D-02/D-04). D-09's outline-only material render is a per-surface render, not a fork of the method body.
- Single quotes, semicolons, trailing commas, 2-space indent, `.js` extensions on server imports, one component per file, `/** … */` prose module headers.

### Integration Points
- `server/src/drivers/adapters.ts` / `api.ts`: the rows and any native-Ollama `num_ctx` parameter.
- `server/src/providers.ts`: the three local rows' specs (base URL, default port, `teaches`).
- `server/src/probe.ts` + `/api/settings` (`web/src/lib/api.ts`): the capability/metadata probe and the local-row read/write routes, behind the existing credential middleware.
- `server/src/tools.ts` + `server/src/prompt.ts` + `method/`: the compact local projection and the material-outline render, regenerated and committed under the CI drift check.
- `server/src/db.ts` + `server/src/migrations.ts`: the rejection telemetry and the Usage-page aggregate queries.
- `web/src/pages/Settings.tsx` + `ProviderRow.tsx`: the local rows, the `num_ctx` field and the `Test teaching` control (all teachable rows).
- `web/src/pages/Usage.tsx` (new) + `web/src/main.tsx`: the Usage route, reached from Settings.
- `.github/workflows/ci.yml` + a local `scripts/` entry: the conformance harness's two run environments.

</code_context>

<specifics>
## Specific Ideas

- `num_ctx` default is **16384**, learner-editable on the local row; a model whose maximum is under it is refused before a lesson.
- Ollama sizes the window itself; LM Studio and llama.cpp are read-only and refused per-lesson when the prompt will not fit.
- Capability is metadata first (Ollama `/api/show`, llama.cpp `/props`), one real tool round-trip only where metadata is missing.
- "Test teaching" is a fixed scripted tool round-trip in an ephemeral scratch lesson that is deleted; its tokens never enter the Usage total; the action sits on every teachable provider row.
- The conformance harness runs nightly in CI (cloud) and locally (local models), drives real models, exercises everything available with explicit `skipped` lines, and writes a JSON + Markdown report with a non-zero exit on failure.
- The tool-rejection rate counts **schema-rejected calls only**, per provider + model, internal to the ledger and report, with no runtime effect.
- Compact local prompt = short tool descriptions + material outlines (full text on demand); gate text never removed; no learner-facing note.

</specifics>

<deferred>
## Deferred Ideas

None raised outside the phase boundary. Items already placed elsewhere by the roadmap, recorded so nobody re-opens them in Phase 4:

- Copilot and Gemini CLI drivers, per-lesson model switching and tiered roles (strong model plans, cheap model explains) — v2 / out of scope (PROJECT.md).
- The learning-experience changes (Home next step, due count, keyboard cards, focus mode, retention stats) — Phase 5.
- The Atlas coloured by memory stability — Phase 5 (LEARN-07).
- Personalization: theme, accent, font, size, tone, language — Phase 6.
- Adoption: one-command install, marketplaces, docs site, README — Phase 7.
- Native search providers and the fetch tool on every path — shipped Phase 3 (PROV-09); the offline local path uses Phase 3 D-23's no-search rendering rather than adding anything here.
- A learner-visible capability badge or cost analytics — moved to v2 on 2026-09-17 under the simplicity rule; D-21 keeps the rejection rate internal for the same reason.

</deferred>

---

*Phase: 04-local-models-parity-proof-and-usage*
*Context gathered: 2026-10-16*
