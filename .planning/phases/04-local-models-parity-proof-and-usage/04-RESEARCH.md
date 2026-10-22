# Phase 4: Local Models, Parity Proof and Usage - Research

**Researched:** 2026-10-22
**Domain:** Local inference servers (Ollama native API, LM Studio and llama.cpp over OpenAI-compatible), context-window sizing, tool-capability probing, a scripted method-conformance harness, and a usage aggregate page
**Confidence:** HIGH on the three servers' wire shapes and on the in-repo arithmetic; MEDIUM on LM Studio's `/api/v1` availability and on which small models actually pass the gate; LOW on nothing load-bearing

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Local provider rows (PROV-06, PROV-07)

- **D-01:** The three **dedicated local rows (Ollama, LM Studio, llama.cpp) are the canonical way to teach on a local server** — discovery, capability probe and `num_ctx` all live on them. The Phase 2 generic **OpenAI-compatible row stays remote/proxied-only**. A learner may type a localhost base URL into the generic row, but it gets **no local treatment** (no `num_ctx`, no capability refusal): the generic row is for endpoints someone else runs. — **Reversibility:** reversible.
- **D-02:** Each local row carries an **editable base URL prefilled from detection** (default ports 11434 / 1234 / 8080), so a non-default port, a LAN box or a reverse proxy is reachable through the dedicated row rather than by falling back to the generic row. Matches the approved UI-SPEC, whose error state keeps "the typed base URL and model id in their fields". — **Reversibility:** reversible.

#### Context sizing — num_ctx posture (PROV-06)

- **D-03:** The default `num_ctx` is a **fixed 16k floor** on every local model, and the local row exposes a **learner-editable `num_ctx` field defaulting to 16384**, saved on blur like every other field. This is what makes the approved UI-SPEC refusal sentence — raising "the model's context window in Settings (num_ctx)" — literally true. — **Reversibility:** reversible.
- **D-04:** A model whose **maximum** window is below the method's 16k floor is **refused at config/probe time** (the row shows the capability refusal and the model cannot be selected), symmetric with the tool-calling refusal of D-06. The learner never starts a lesson the model cannot hold. — **Reversibility:** reversible.
- **D-05:** **Ollama sets `num_ctx` through its native API** (the roadmap's stated reason for using `ai-sdk-ollama` rather than the OpenAI-compatible route). **LM Studio and llama.cpp are read-only**: Derive reads the context the server reports and lets the Phase 3 pre-request estimator (03 D-25) refuse per-lesson when the prompt will not fit. Derive never fights a server's own context configuration. — **Reversibility:** reversible.

#### Capability probe (PROV-07)

- **D-06:** Tool-calling capability is **read from server metadata where available** — Ollama `/api/show` capabilities (including `tools`), llama.cpp `/props` — and **proved with one tiny real tool-call round-trip where metadata is absent** (LM Studio's `/v1/models` returns ids only). Cheap where cheap, definitive where necessary. — **Reversibility:** reversible.
- **D-07:** **Metadata is read for the whole list when Settings opens / on Rescan** (cheap); the **definitive round-trip probe runs for the model the learner selects** — one probe per chosen model, before a lesson. The lesson capability-refusal card (UI-SPEC E2) remains the backstop if a model slips through. — **Reversibility:** reversible.

#### Compact prompt for local providers (PROV-06)

- **D-08:** **Compaction is keyed on the local provider, not the model's window** — every model reached through a local row gets compact tool descriptions and material-outline-only, whatever its size. The **gate text is never removed** (method fidelity): compact tool descriptions reuse the Phase 3 D-28 compact projection and its `ToolSurface`. — **Reversibility:** reversible.
- **D-09:** **"Material-outline-only" means the local prompt's material section carries outlines** (section titles/keywords); the tutor pulls full text on demand through the existing `read_material` / `search_material` tools. Keeps the method's material discipline while keeping a large attachment from blowing the 16k window. — **Reversibility:** reversible.
- **D-10:** Compaction is a **silent implementation detail** — no learner-facing note. The only local-path signals the learner sees are the capability and `num_ctx` refusal cards. — **Reversibility:** reversible.

#### "Test teaching" (PROV-11)

- **D-11:** "Test teaching" runs in an **ephemeral scratch lesson that is deleted (transactionally) after the run** — Phase 1 made `deleteLesson` atomic for exactly this. Nothing appears in Home, the Atlas or the Usage total. — **Reversibility:** reversible.
- **D-12:** It runs a **fixed scripted tool round-trip** — hand the model a trivial topic, require it to call the plan/quiz tools, and let Derive grade the returned quiz. It proves exactly what PROV-11 claims (the model can call the method's tools and its quiz is gradable), not that it teaches well; this matches the UI-SPEC fail strings ("called no tools", "the grade was unreadable"). — **Reversibility:** reversible.
- **D-13:** The action appears on **every teachable provider row**, not only the local rows — PROV-11 says "any chosen model", and local models are merely where failure is most likely. **This deliberately widens beyond `04-UI-SPEC.md`'s local-row placement; the UI-SPEC needs a small update to note the action on cloud rows too.** — **Reversibility:** reversible.
- **D-14:** The test's **token usage is discarded with the deleted lesson** — it never reaches the ledger or the Usage total, keeping "what learning has cost" strictly about lessons. The learner sees only the pass/fail line and latency (per the UI-SPEC copy). — **Reversibility:** reversible.

#### Conformance harness (PROV-13)

- **D-15:** The harness **runs both ways** — a **scheduled GitHub Actions cron** for reachable cloud providers (repository secrets) and a **local `pnpm`/npm script** for the local models only this machine has. One script, two environments; CI never needs a learner's local model. — **Reversibility:** reversible.
- **D-16:** It drives **real configured models**, not a stub — the only thing that proves a specific provider/model follows the method. A weak local model failing the gate is an **expected, useful** finding (the roadmap says to expect small models to fail often). — **Reversibility:** reversible.
- **D-17:** It exercises **every provider available in the environment** and records an explicit **`skipped`** line with the reason (no key, server not found) for the rest, so the report is complete: a reader sees what was proved and what was not. — **Reversibility:** reversible.
- **D-18:** It produces a **JSON report plus a Markdown summary** per run — per provider/model pass/fail on the understanding gate, the pretest and the cumulative quiz, plus the tool-rejection rate (D-19..D-21) — and **exits non-zero on failure**. CI uploads it as an artifact; the local script writes it under `~/.derive`. **No learner-facing surface.** — **Reversibility:** reversible.

#### Tool-rejection telemetry (Phase 1 D-06 / roadmap research note)

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

### Deferred Ideas (OUT OF SCOPE)

None raised outside the phase boundary. Items already placed elsewhere by the roadmap, recorded so nobody re-opens them in Phase 4:

- Copilot and Gemini CLI drivers, per-lesson model switching and tiered roles (strong model plans, cheap model explains) — v2 / out of scope (PROJECT.md).
- The learning-experience changes (Home next step, due count, keyboard cards, focus mode, retention stats) — Phase 5.
- The Atlas coloured by memory stability — Phase 5 (LEARN-07).
- Personalization: theme, accent, font, size, tone, language — Phase 6.
- Adoption: one-command install, marketplaces, docs site, README — Phase 7.
- Native search providers and the fetch tool on every path — shipped Phase 3 (PROV-09); the offline local path uses Phase 3 D-23's no-search rendering rather than adding anything here.
- A learner-visible capability badge or cost analytics — moved to v2 on 2026-09-17 under the simplicity rule; D-21 keeps the rejection rate internal for the same reason.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **PROV-06** | Learner can run the tutor on a local Ollama model, offline, with the context window sized so the method is never silently truncated | §Standard Stack (`ai-sdk-ollama` is the only route that sets `num_ctx`); §The Context-Window Arithmetic (the measured 13,096-token prompt floor, Ollama's **4096-token default** window, the estimator's blind spot); §Architecture Patterns P1/P2/P5 (adapter row, `num_ctx` wiring, compact local surface) |
| **PROV-07** | Learner can run the tutor on LM Studio or llama.cpp, with capability probes that refuse clearly when tool calling is unsupported | §Three Servers, Three Wire Shapes (exact probe endpoints and field names for all three); §Architecture Patterns P3 (the two-tier probe); §Pitfall 2 (absent metadata ≠ unsupported); §Pitfall 3 (the live port-8080 false positive on this machine) |
| **PROV-11** | Learner can run a "test teaching" smoke test from settings: one node, one graded quiz, proving the chosen model can run the method | §Architecture Patterns P6 (scratch lesson, `setDriverOverride`/`setModelOverride` precedent, the three fail reasons the UI-SPEC fixes); §Pitfall 6 (a probe at a different `num_ctx` forces an Ollama model reload) |
| **PROV-13** | A method-conformance harness replays a scripted lesson per provider and asserts the gate, pretest and cumulative quiz held; runs nightly | §Architecture Patterns P7 (one script, two environments); §Conformance Harness Mechanics (cron rules, `workflow_dispatch`, artifact action version, `safeMessage` on every recorded sentence); §Security Domain T-04-01 |
| **COST-03** | Learner sees a usage page with a running total per learner, by provider, model and lesson, and tokens-only lines for subscription and local paths | §Architecture Patterns P8 (`listUsage({learner})` + `costOf`/`costLabel`, no migration needed); §Don't Hand-Roll (never re-format money in the browser); §Pitfall 8 (a llama.cpp model id is a filesystem path) |
</phase_requirements>

---

## Summary

Phase 4 is mostly a **table-row phase with one arithmetic problem hiding in it**. The Phase 3 owned loop (`server/src/drivers/api.ts`) is one `streamText` call with sixteen tools, a per-provider adapter row, and a pre-request headroom check; the three local servers are three more adapter rows plus a metadata probe beside `server/src/probe.ts`. Nothing about the driver seam, the event vocabulary, the tool registry or the cost formatter needs to move. The Usage page (COST-03) needs no new table, no migration and no new formatter — `listUsage({ learner })` is already indexed and `costOf`/`costLabel` already produce every string the UI-SPEC locks.

The arithmetic problem is the whole risk of the phase, and it is measurable rather than speculative. Derive's stable system prompt on the `api` surface with no web search — the exact rendering the offline local path uses — is **29,239 characters ≈ 9,747 tokens** at the repo's own deliberately-pessimistic 3 chars/token. The sixteen `api`-surface tool definitions add **5,074 estimated tokens in the `full` dialect and 3,349 in the `compact` one**. That is a **13,096-token floor before a single word of lesson, material, library, learner profile or history**. The repo's `HEADROOM_FRACTION = 0.8` makes a 16,384-token window worth 13,107 estimated tokens — eleven tokens of slack. And `headroomCheck` does not count the tool schemas at all, so on a 16k local window the estimator is blind to 20–31% of what it is measuring. Meanwhile Ollama's **default context window is 4,096 tokens**, which is precisely the "method silently degrading" the phase exists to prevent: without an explicit `num_ctx`, Ollama truncates the prompt and the understanding gate text is the first thing out the door.

The capability probe is cheaper and better-supported than the roadmap note assumed, with one correction and one upgrade. The correction: llama.cpp's `--jinja` is now **default-enabled** (`--jinja, --no-jinja ... (default: enabled)`), so a refusal must not instruct the learner to add a flag they already have — it should report `chat_template_caps.supports_tools`, whose nine exact keys are now verified. The upgrade: LM Studio has a newer `/api/v1/models` carrying `capabilities.trained_for_tool_use` and `loaded_instances[].config.context_length`, so the "LM Studio returns ids only" premise behind D-06's round-trip probe holds only for older LM Studio builds — the round-trip stays as the fallback it should always have been.

**Primary recommendation:** add `ai-sdk-ollama@4.4.0` (pinned — `4.5.x` demands `ai ^7.0.137` against the repo's `ai@7.0.126`) as one adapter row with `options: { num_ctx }` and `reliableToolCalling: false`; reach LM Studio and llama.cpp through the already-present `@ai-sdk/openai-compatible` with a `local-openai` dialect flag; make `headroomCheck` **tool-surface-aware** before anything else in the phase, because every other local decision rests on an estimate that is currently 3,349 tokens short on the one window where that matters.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Local-server discovery (ports 11434/1234/8080) | API / Backend (`probe.ts` `detect`) | — | Already shipped Phase 2; the browser renders `status` from `/api/settings`. A port probe from the browser would be a CORS-blocked guess. |
| Tool-capability + max-window metadata read | API / Backend (new helpers beside `probe.ts`) | — | Needs POST bodies, non-redirect fetch, per-provider shape checks and `safeMessage`. All server facts. |
| `num_ctx` storage and bounds validation | API / Backend (`settings` table via `setSetting`) | Browser (field + on-blur save) | Follows the shipped `base_url`/`model` pattern exactly; the browser never validates, it shows the server's sentence. |
| Sending `num_ctx` on the request | API / Backend (`drivers/adapters.ts` Ollama row) | — | Only the adapter knows the provider's option shape. |
| Pre-request context refusal | API / Backend (`context.ts` + the loop) | Browser (refusal card render) | The refusal must happen before the request leaves; the card is a render of `turn_end { ok:false, error }`. |
| Compact tool projection + material outline | API / Backend (`tools.ts` dialect, `prompt.ts` render) | — | One registry, per-surface projection; CI-gated. |
| "Test teaching" execution | API / Backend (scratch lesson + the real loop) | Browser (button, `role="status"` line, pass/fail readout) | D-12's grading is `actions.ts`'s, which is server-side by construction. |
| Conformance harness | Build / CI (`scripts/` + a workflow) | — | No learner surface at all (D-18); runs outside the server process. |
| Tool-rejection telemetry | API / Backend (`validateToolInput` call site in the loop) | — | D-21: internal, no runtime effect, never rendered. |
| Usage running total | API / Backend (new `/api/usage` reading `listUsage` + `costOf`) | Browser (`Usage.tsx` renders returned strings) | UI-SPEC forbids re-formatting a number in the browser; the sums and the labels are server-side. |

---

## Project Constraints (from CLAUDE.md)

Extracted from `./.claude/CLAUDE.md`. Treat with the same authority as locked decisions.

| Directive | Where it binds this phase |
|-----------|---------------------------|
| **GSD workflow enforcement** — no direct repo edits outside a GSD workflow | Every plan task; research writes only `.planning/`. |
| **Simplicity rule: one screen, one next step** | The Usage page shows *one thing* (UI-SPEC); the rejection rate stays internal (D-21); compaction is silent (D-10). |
| Named exports only; `export default` appears nowhere in `server/src` or `web/src` | New modules (`usage` route helpers, probe helpers, `Usage.tsx`) export named symbols. |
| Server imports use `.js` extensions (`module: NodeNext`); web imports use no extension | New server files import `'./probe.js'`; `Usage.tsx` imports `'../lib/api'`. |
| Single quotes, semicolons, trailing commas, 2-space indent; long lines accepted; **do not reflow existing lines** | Mechanical; the planner should state it once rather than per task. |
| Every server module opens with a `/** … */` prose paragraph explaining the *why* | The new probe module, the harness script and the local adapter rows each owe one. |
| Inline `//` comments explain a non-obvious *why*, never restate the code | The `num_ctx` arithmetic and the `reliableToolCalling: false` choice both need one. |
| Throw plain lowercase `Error` sentences; routes answer `{ error }`; narrow with `e instanceof Error ? e.message : String(e)` | Every new route and probe helper. |
| Best-effort catches carry a one-word reason comment: `catch { /* not installed */ }` | The metadata probe's per-row failures. |
| No `@ts-ignore` / `@ts-expect-error` anywhere; narrow with type guards or a targeted `as` | Reading `model_info` / `chat_template_caps` as `unknown` then narrowing — never casting blind. |
| `console.error('[tag]', e)` only for failures and startup facts; never per-request | The harness may log; the probe may not. |
| Types are `type` aliases, PascalCase; no interfaces; unions of string literals for enums | `ToolDialect`-style additions. |
| Configuration is read from `process.env` **once**, in `server/src/config.ts` | A harness env var (`DERIVE_CONFORMANCE_*`) belongs in `config.ts`, or in the standalone script which is its own process. |
| `node:sqlite` is synchronous — every DB call blocks the loop | The Usage aggregate must stay one indexed read, not a scan per group. |
| Zod schemas for MCP tools carry `.describe()` on every field | Only if a tool changes — none should. |
| Tool set must match in **four** places (`tools.ts`, `agent.ts buildTools`, `mcp.ts`, `index.ts` switch) + `plugin/commands/*.md` | **This phase must add no tool.** The capability probe and test-teaching reuse the existing sixteen. |
| Event types must match in two places (server `emit` + `useLesson.ts EVENT_TYPES`) | **This phase must add no event type** (CONTEXT.md §Established Patterns confirms). |
| Standalone scripts are `.mjs` with `#!/usr/bin/env node` and are parse-checked in CI | The harness script: either `.mjs` (add to the `node --check` loop in `ci.yml`) or a `tsx`-run `.ts` under `server/`. |
| Method text is one source under `method/`, rendered to six committed copies; `pnpm method:check` fails CI on drift | D-09's outline-only material render is a **per-surface render**, never a fork of the method body. |

**Stale directive to flag, not obey:** CLAUDE.md states `pnpm 10.33.2 (packageManager field)`. The repo's `package.json` now reads `"packageManager": "pnpm@12.5.1"` and the installed pnpm is 12.5.1 `[VERIFIED: package.json:27 — "packageManager": "pnpm@12.5.1"; pnpm --version → 12.5.1]`. CLAUDE.md also says server tests are only `api.test.ts`, `reply.test.ts`, `schedule.test.ts`; there are now eighteen `server/test/*.test.ts` files `[VERIFIED: ls server/test]`. Neither affects the plan, but a task that greps CLAUDE.md for the pnpm pin will be wrong.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ai-sdk-ollama` | **4.4.0 (pin exactly)** | Ollama on its **native** API — the only route that sets `num_ctx` | `OllamaChatSettings.options?: Partial<Options>` where `Options` is ollama-js's own, which types `num_ctx: number`. `4.5.x` peers on `ai ^7.0.137` and the repo pins `ai@7.0.126`; `4.4.0` peers on `ai ^7.0.103`. `[VERIFIED: npm view ai-sdk-ollama@4.4.0 peerDependencies → {"ai":"^7.0.103"}; tarball dist/provider.d.ts:106-110 "export interface OllamaChatSettings extends Pick<ChatRequest, 'keep_alive' \| 'format' \| 'tools' \| 'think'> { options?: Partial<Options>; ...}"; ollama@0.6.4 dist/browser.d.ts:8-10 "interface Options { numa: boolean; num_ctx: number;"]` — **but see §Package Legitimacy Audit: verdict is SUS, so the planner must gate the install behind `checkpoint:human-verify`.** |
| `@ai-sdk/openai-compatible` | **3.0.62 (already installed)** | LM Studio and llama.cpp over `/v1/chat/completions` | Already the generic row's provider (`adapters.ts:388` `createOpenAICompatible({ ... includeUsage: true, fetch: noRedirectFetch })`). Both servers speak OpenAI chat completions with `tools`. No new dependency. `[VERIFIED: server/package.json:20 "@ai-sdk/openai-compatible": "3.0.62"]` |
| `ai` | **7.0.126 (installed) — no bump needed if `ai-sdk-ollama` is pinned to 4.4.0** | The loop | `[VERIFIED: server/package.json:26 "ai": "7.0.126"]`. Registry latest is `7.0.148` `[VERIFIED: npm view ai version → 7.0.148]`; a bump is optional and out of this phase's scope. |
| `zod` | **^4.6.5 (already installed)** | The `num_ctx` field's bounds on `SettingsWrite` | `SettingsWrite` is already a `.strict()` zod object at `server/src/index.ts:357-374`. `[VERIFIED: server/src/index.ts:357-374]` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `actions/upload-artifact` | **v7** | Upload the conformance JSON + Markdown report in CI (D-18) | Latest release is `v7.0.2`, published 2026-10-07 `[VERIFIED: api.github.com/repos/actions/upload-artifact/releases/latest → v7.0.2]`. Matches the repo's existing `@v7` posture on `checkout` and `setup-node`. |
| `actions/checkout` / `actions/setup-node` / `pnpm/action-setup` | **v7 / v7 / v6** | The nightly workflow's setup steps | Copy the four steps verbatim from `.github/workflows/ci.yml`; those are the exact majors already in use `[VERIFIED: .github/workflows/ci.yml]`, and `v7.0.1` / `v7.1.0` / `v6.1.0` are the current releases `[VERIFIED: GitHub releases API]`. |
| `node:test` + `tsx` | built-in / ^4.23.15 | Structural tests for the new probe parsers and the usage aggregate | The repo's only test mechanism: `node --import tsx --test test/*.test.ts` `[VERIFIED: server/package.json:11]`. Pure parsers (`capabilityOf`, `maxWindowOf`) test from literals with no DB, matching `cost.ts`/`schedule.ts` precedent. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `ai-sdk-ollama` | `ollama-ai-provider-v2@4.1.0` (543k weekly downloads, `peer: ai ^7.0.0`) `[VERIFIED: npm view ollama-ai-provider-v2]` | Higher downloads and a looser `ai` peer range, so no pin gymnastics. **Not recommended:** the roadmap note and CONTEXT.md name `ai-sdk-ollama` explicitly, and this research did not open `ollama-ai-provider-v2`'s type declarations to confirm its `num_ctx` surface. Keep it as the documented fallback if `ai-sdk-ollama@4.4.0` fails the human-verify checkpoint. |
| `ai-sdk-ollama` for Ollama | Ollama's own `/v1/chat/completions` through `@ai-sdk/openai-compatible` | Zero new dependency, and it is how LM Studio and llama.cpp are reached. **Refused by D-05's stated reason, and the reason is real:** the OpenAI-compatible route carries no `options` object, so `num_ctx` cannot be sent and Ollama falls back to its **4,096-token default**, which truncates the method. |
| A new local `ToolDialect` | Reuse the existing `'compact'` dialect | **Reuse it.** `TOOL_DIALECTS = ['full','openai-strict','gemini','compact']` already exists and `project()` already shortens every description, and `jsonSchemaOf` already routes it. `[VERIFIED: server/src/tools.ts:53 "export const TOOL_DIALECTS = ['full', 'openai-strict', 'gemini', 'compact'] as const;" and :594-597 "if (dialect === 'compact') { if (typeof node.description === 'string') node.description = shortened(node.description); return; }"]` A fourth dialect would be a second answer to a solved question. |
| A new `tool_rejections` table | A counter column on `usage` | A column on `usage` is per-request and would mean "this request's rejections", which is not what D-19 counts. A small append-only table (migration 8) keyed by provider+model+ts is cleaner and matches Phase 1 D-14's "usage in its own table, never an event" instinct. Planner's call (Claude's Discretion). |
| A new migration for COST-03 | None | **None needed.** `usage_learner (learner_id, ts)` already indexes the Usage page's only filter. `[VERIFIED: server/src/migrations.ts:226-228 "CREATE INDEX usage_turn ON usage (turn_id); CREATE INDEX usage_learner ON usage (learner_id, ts); CREATE INDEX usage_lesson ON usage (lesson_id);"]` |

**Installation:**

```bash
pnpm --filter server add ai-sdk-ollama@4.4.0
```

**Version verification** (run 2026-10-22):

```bash
npm view ai-sdk-ollama@4.4.0 peerDependencies   # { ai: '^7.0.103' }  ✅ satisfies ai@7.0.126
npm view ai-sdk-ollama@4.5.1 peerDependencies   # { ai: '^7.0.137' }  ❌ would force an `ai` bump
```

---

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `ai-sdk-ollama` | npm | first published **2025-08-06**, ~14.5 months | **47,569/wk** | `github.com/jagreehal/ai-sdk-ollama` — 131 stars, MIT, not archived, pushed 2026-10-21 | **[SUS]** (`reasons: ["too-new"]`) | **Flagged — planner must add `checkpoint:human-verify` before install** |
| `ollama-ai-provider-v2` | npm | first published **2025-06-11**, ~16 months | **543,048/wk** | `github.com/nordwestt/ollama-ai-provider-v2` | **[SUS]** (`reasons: ["too-new"]`) | Documented fallback only; not installed this phase |
| `@ai-sdk/openai-compatible` | npm | already in lockfile at 3.0.62 | — | `github.com/vercel/ai` (first-party) | **[OK]** | Approved — no change |
| `actions/upload-artifact@v7` | GitHub Actions | — | — | `github.com/actions/upload-artifact` (GitHub first-party) | **[OK]** | Approved |

**Packages removed due to [SLOP] verdict:** none.

**Packages flagged as suspicious [SUS]:** `ai-sdk-ollama`, `ollama-ai-provider-v2`.

**Reading the SUS verdict honestly.** The seam's `reasons: ["too-new"]` keys on the **latest release's** publish date (`ai-sdk-ollama@4.5.1` shipped 2026-10-17, five days before this research), not on the package's age. The countervailing signals are strong and were each checked directly:

- First publish `2025-08-06` `[VERIFIED: npm view ai-sdk-ollama time --json → "created": "2025-08-06T06:57:24.524Z"]`
- 47,569 downloads in the week 2026-10-12..18 `[VERIFIED: api.npmjs.org/downloads/point/last-week/ai-sdk-ollama → {"downloads":47569,...}]`
- An **SLSA provenance attestation** on the exact version recommended `[VERIFIED: npm view ai-sdk-ollama@4.4.0 dist.attestations --json → {"provenance":{"predicateType":"https://slsa.dev/provenance/v1"}}]`
- No `postinstall` script `[VERIFIED: package-legitimacy signals.postinstall: null]`
- MIT, named author, active repo `[VERIFIED: api.github.com/repos/jagreehal/ai-sdk-ollama → stars 131, license MIT, archived false]`
- Its dependency closure is small and plausible: `@ai-sdk/provider`, `@ai-sdk/provider-utils`, `jsonrepair`, `ollama` `[VERIFIED: tarball package.json dependencies]`

That is not a slopsquat profile. But the gate says `SUS` and the protocol says a `SUS` package keeps its warning and gets a checkpoint, so:

> `ai-sdk-ollama@4.4.0` **[WARNING: flagged as suspicious — verify before using.]** The planner must insert a `checkpoint:human-verify` task immediately before the `pnpm add`, presenting the six signals above so the owner can approve in one read.

---

## The Context-Window Arithmetic

> **This is the single most consequential section for the planner.** Every number below was measured in this repo, this session.

### What the method costs before a lesson starts

Measured by rendering the real prompt and the real tool projections (`node --import tsx` against `server/src/prompt.ts` and `server/src/tools.ts`, 2026-10-22):

| Component | Characters | Estimated tokens (`CHARS_PER_TOKEN = 3`) |
|-----------|-----------:|-----------------------------------------:|
| `systemPrompt({ kind: 'api', search: 'none' })` — the **offline local** rendering | 29,239 | **9,747** |
| `systemPrompt({ kind: 'api', search: 'fallback' })` | 28,239 | 9,413 |
| `systemPrompt({ kind: 'api', search: 'native' })` | 28,404 | 9,468 |
| 16 `api`-surface tools, `full` dialect (name + description + JSON Schema) | 15,221 | **5,074** |
| 16 `api`-surface tools, `compact` dialect | 10,047 | **3,349** |

The constants are the repo's own, read this session:

- `[VERIFIED: server/src/context.ts:26 "export const CHARS_PER_TOKEN = 3;"]`
- `[VERIFIED: server/src/context.ts:29 "export const HEADROOM_FRACTION = 0.8;"]`

So the **prompt floor** — before any lesson prose, material, library section, learner profile, turn prompt or message history — is:

| Dialect | Floor (system + tools) | Usable at `num_ctx = 16384` (×0.8) | Slack |
|---------|-----------------------:|-----------------------------------:|------:|
| `compact` | **13,096** | 13,107 | **11 tokens** |
| `full` | 14,821 | 13,107 | **−1,714 (already over)** |

### Finding 1 — the estimator is blind to the tool surface

`headroomCheck` measures `instructions + messages + prompt` and nothing else:

`[VERIFIED: server/src/context.ts:47-57]`
```ts
export function headroomCheck(
  input: { provider: string; model: string | null; instructions: string; messages: string; prompt: string },
  table: PriceTable,
): { refuse: false } | { refuse: true; reason: string } {
  const window = table[input.provider]?.[input.model ?? '']?.context;
  if (window == null) return { refuse: false };
  const estimate = estimateTokens(input.instructions) + estimateTokens(input.messages) + estimateTokens(input.prompt);
  if (estimate <= window * HEADROOM_FRACTION) return { refuse: false };
  return { refuse: true, reason: REFUSAL };
}
```

and `ctx.instructions` is the prompt only — the tool definitions are never in it:

`[VERIFIED: server/src/agent.ts:298-300]`
```ts
  const instructionsStable = systemPrompt(web);
  const instructionsVolatile = materialsSection(lessonId) + librarySection(lesson.learner_id, lesson.topic) + learnerProfile(lesson.learner_id, lessonId);
  const instructions = instructionsStable + instructionsVolatile;
```

On a 1,000,000-token cloud window a 3,349-token omission is noise. On a 16,384-token local window it is **20% (compact) to 31% (full) of the whole window, unmeasured** — so the per-lesson refusal of D-05 would fire *late*, after the server has already truncated or 400'd. Fixing this is the precondition for D-04 and D-05 meaning anything.

**Recommendation:** widen `headroomCheck`'s input with a `tools: string` field (the serialised projected tool set for the turn's dialect) and have the loop pass it. It is a pure function with no I/O, so the change is one field, one `estimateTokens` call, and a test from literals.

### Finding 2 — a 16k window with the compact surface has eleven tokens for the lesson

D-03 locks the default at 16384 and D-04 locks the refusal floor at 16k. Both remain honoured by the plan. But the arithmetic above means a local lesson at exactly 16,384 will hit the `num_ctx` refusal card almost immediately once Finding 1 is fixed — the volatile section (material + library + profile) and `firstTurnPrompt` alone push it over.

Three readings, all consistent with the locked decisions:

1. **16k is the refusal floor, not a comfortable default.** "Floor" and "default" are different numbers in D-03's own wording ("a fixed 16k floor … defaulting to 16384"). Raising the *default* to 32768 while keeping *16k* as the config-time refusal floor honours D-04 literally and makes a real lesson possible. D-03 is marked reversible.
2. **Keep 16384 and let the card fire.** Success criterion 1 says Derive must "refuse with a clear card instead of teaching without the gate" — an early refusal is the designed behaviour, not a bug. But success criterion 1 *also* says "Learner completes a lesson on an Ollama model with the network off", and a window that refuses on turn two does not complete a lesson.
3. **Compact harder.** The 29,239-character system prompt is 74% of the floor; the tool surface is 26%. There is no compaction of the method body available — D-08 forbids touching the gate text, and `method/` is CI-gated. So option 3 is not available without a method change, which is out of scope.

**Recommendation (needs owner confirmation):** adopt reading 1 — default `num_ctx = 32768`, refusal floor stays 16k — and surface it as a `checkpoint:human-verify` in the plan, since it adjusts a number a locked decision names. Reading 2 is the fallback if the owner prefers the literal 16384.

### Finding 3 — Ollama's silent default is 4,096 tokens

> "By default, Ollama uses a context window size of 4096 tokens. This can be overridden with the `OLLAMA_CONTEXT_LENGTH` environment variable."
> `[CITED: raw.githubusercontent.com/ollama/ollama/main/docs/faq.mdx:25-27]`

A Derive turn needs ≥13,096 estimated tokens of prompt. Sent to a 4,096-token Ollama instance with no `num_ctx`, the prompt is truncated and the method's gate, discipline and checks sections — which sit after the identity and philosophy sections in render order `[VERIFIED: ls method/ → 00-identity.md, 10-philosophy.md, 20-tools.md, 30-quiz-options.md, 40-discipline.md, 50-checks.md, 60-process.md, …]` — are the ones that go. This is the literal mechanism behind "the method silently degrading", and it is why `num_ctx` on the native API is load-bearing rather than a nicety.

Second-order cost the planner must plan for: `OLLAMA_NUM_PARALLEL` × `OLLAMA_CONTEXT_LENGTH` scales required RAM `[CITED: ollama/docs/faq.mdx:335]`, so a 32,768 `num_ctx` on a small machine can fail the model load outright. The refusal for that case is the server's own sentence through `providerSentence`, which is already the right shape.

---

## Three Servers, Three Wire Shapes

Everything in this section was read from the servers' own source or reference docs this session. The field names are what the probe parsers must key on.

### Ollama — native API

| Need | Endpoint | Method | Field |
|------|----------|--------|-------|
| Discovery (shipped) | `/api/tags` | GET | `models[]` array present → it is Ollama `[VERIFIED: server/src/probe.ts:82 "export const isOllama = (p: Probe): boolean => !!p && p.status === 200 && Array.isArray(field(p.body, 'models'));"]` |
| Model list (shipped) | `/api/tags` | GET | `models[].name` `[VERIFIED: server/src/probe.ts:250 "return dedupe(list(body, 'models').map((m) => str(m, 'name')));"]` |
| **Tool capability** | `/api/show` | **POST** `{ "model": "<id>" }` | `capabilities: string[]` — contains `"tools"` |
| **Max window** | `/api/show` | **POST** | `model_info["general.architecture"]` → then `model_info["<arch>.context_length"]` |
| **Set the window** | `/api/chat` | POST | `options: { num_ctx: <n> }` |

Verbatim from the response example:

`[CITED: raw.githubusercontent.com/ollama/ollama/main/docs/api.md:1445-1471]`
```json5
  details: { parent_model: "", format: "gguf", family: "llama", families: ["llama"], parameter_size: "8.0B", quantization_level: "Q4_0" },
  model_info: {
    "general.architecture": "llama",
    ...
    "llama.context_length": 8192,
    ...
  },
  capabilities: ["completion", "vision"],
```

and the typed contract in ollama-js, which `ai-sdk-ollama` depends on:

`[VERIFIED: ollama@0.6.4 dist/browser.d.ts:234-245]`
```ts
interface ShowResponse {
    license: string;
    modelfile: string;
    parameters: string;
    template: string;
    system: string;
    details: ModelDetails;
    messages: Message[];
    modified_at: Date;
    model_info: Map<string, any>;
    capabilities: string[];
    projector_info?: Map<string, any>;
}
```

Two gotchas the parser must handle:

- `/api/show` is **POST with a JSON body**. The repo's `probeJson` and `getJson` are GET-only `[VERIFIED: server/src/probe.ts:65-77 and :308-323 — both call fetch with only `headers`, `redirect: 'manual'`, `signal`]`. A sibling `postJson` is needed; keep `redirect: 'manual'` and `AbortSignal.timeout`.
- The `context_length` key is **architecture-prefixed**, so it must be derived from `general.architecture` and never hard-coded to `llama.context_length`.

The live library's tool-capable models, with their published parameter sizes `[VERIFIED: ollama.com/search?c=tools and each /library/<name> page, fetched 2026-10-22]`:

| Model | Sizes | Also carries |
|-------|-------|--------------|
| `tev1` | 0.8b, 4b | thinking |
| `bonsai-2` | 2b, 4b, 9b, 27b | vision, thinking |
| `nimble`, `nimble-v3` | 9b | thinking |
| `ornith` | 9b, 35b | thinking |
| `ornith-1.5` | 9b, 35b, 122b, 397b | vision, thinking |
| `qwen3.8` | 27b | vision, thinking |
| `muse-glimmer` | 30b | vision, thinking |
| `nemotron-3.5-lightning` | 30b | thinking |
| `flint` | 40b | thinking |
| `nemotron-3.5-super` | 120b | vision, thinking |
| `qwen3.8-flash-next` | 125b | vision, thinking |
| `beam`, `deepseek-v4.1-flash`, `glm-5.3`, `glm-5.3-flash`, `minimax-m3.1-flash`, `mistral-large-4`, `muse-spark-open`, `nemotron-3.5-bolt` | not shown on the index | mixed |

**Every single one also carries `thinking`.** That matters on a 16k window: a thinking model spends window on reasoning the learner never sees (Phase 3 D-09 discards it from SQLite entirely). `OllamaChatSettings` picks `think` from `ChatRequest` `[VERIFIED: ai-sdk-ollama@4.4.0 dist/provider.d.ts:106 "export interface OllamaChatSettings extends Pick<ChatRequest, 'keep_alive' | 'format' | 'tools' | 'think'>"]` and the API documents it as "a boolean or a thinking level (`\"low\"`, `\"medium\"`, `\"high\"`, or `\"max\"`)" `[CITED: ollama/docs/api.md:499]`. **Recommendation: send `think: false` (or `'low'`) on the local path** — it buys back window on the one surface where window is the binding constraint, and the learner never sees reasoning anyway.

Do **not** name specific models in the shipped `providers.ts` row or in prompt text. The catalogue's `defaultModel` for local rows is already `null` `[VERIFIED: server/src/providers.ts:170 "defaultModel: null,"]` and should stay null: the learner's installed model is the only one that exists on their machine.

### llama.cpp — OpenAI-compatible, metadata on `/props`

| Need | Endpoint | Method | Field |
|------|----------|--------|-------|
| Discovery (shipped) | `/health` | GET | `status === 'ok'`, or 503 with `error.type === 'unavailable_error'` while loading `[VERIFIED: server/src/probe.ts:93-94]` |
| Model list (shipped) | `/v1/models` | GET | `data[].id` — **defaults to the model file path** unless `--alias` |
| **Tool capability** | `/props` | GET | `chat_template_caps.supports_tools` and `.supports_tool_calls` |
| **Served window** (D-05 read-only) | `/props` | GET | `default_generation_settings.n_ctx` |
| **Trained max window** (D-04) | `/v1/models` | GET | `data[].meta.n_ctx_train` |

The nine exact `chat_template_caps` keys, read from the emitter rather than from a doc example (the README's example shows `"chat_template_caps": {}`, which is stale):

`[VERIFIED: raw.githubusercontent.com/ggml-org/llama.cpp/master/common/jinja/caps.cpp:106-118]`
```cpp
std::map<std::string, bool> caps::to_map() const {
    return {
        {"supports_string_content", supports_string_content},
        {"supports_typed_content", supports_typed_content},
        {"supports_tools", supports_tools},
        {"supports_tool_calls", supports_tool_calls},
        {"supports_parallel_tool_calls", supports_parallel_tool_calls},
        {"supports_system_role", supports_system_role},
        {"supports_preserve_reasoning", supports_preserve_reasoning},
        {"supports_reasoning_effort", supports_reasoning_effort},
        {"supports_object_arguments", supports_object_arguments},
    };
}
```

with the defaults that make a `false` meaningful:

`[VERIFIED: raw.githubusercontent.com/ggml-org/llama.cpp/master/common/jinja/caps.h:10-13]`
```cpp
    bool supports_tools = true;
    bool supports_tool_calls = true;
    bool supports_system_role = true;
    bool supports_parallel_tool_calls = true;
```

Because the struct defaults to `true` and `caps_get` only turns a field off when it detects the template cannot, **a `false` is a positive finding and an absent `chat_template_caps` is silence** — which is exactly why D-06's round-trip fallback exists.

**Correction to the roadmap research note:** `--jinja` is now **default-enabled**.

`[CITED: ggml-org/llama.cpp tools/server/README.md:234]`
```
| `--jinja, --no-jinja` | whether to use jinja template engine for chat (default: enabled)<br/>(env: LLAMA_ARG_JINJA) |
```

So a capability refusal must **not** read "start llama.cpp with `--jinja`" as universal advice — on a current build that flag is already on and the real cause is the model's template. The honest sentence is the UI-SPEC's locked one (`{model} does not support tool calling …`), with the server's own `chat_template_caps` as the internal evidence. The function-calling section still carries the older sentence (`"OpenAI-style function calling is supported with the --jinja flag (and may require a --chat-template-file override …)"` `[CITED: README.md:1513]`) — that is a `--chat-template-file` hint for a template-less model, not a flag the learner is missing.

Two more verified facts worth the planner's attention:

- **Usage is reported.** llama.cpp returns `usage: { completion_tokens, prompt_tokens, total_tokens, prompt_tokens_details: { cached_tokens } }` `[CITED: README.md:1545-1559]`, so the Usage page's tokens-only local line will actually have numbers on this path.
- **Older builds degrade explicitly.** The docs say of a sibling field: *"Older servers can omit `architecture`. If it is absent, use the legacy behavior of your client."* `[CITED: README.md:1370]` — the same posture should apply to `chat_template_caps` and `meta.n_ctx_train`.
- **Reasoning can be switched off:** `reasoning_effort: 'none'` disables thinking, and `chat_template_kwargs: { enable_thinking: false }` is the template-level route `[CITED: README.md:1444-1446]`. Same window argument as Ollama's `think: false`.

### LM Studio — OpenAI-compatible, with a newer native API

| Need | Endpoint | Field |
|------|----------|-------|
| Discovery (shipped) | `/api/v0/models` | `object === 'list'` `[VERIFIED: server/src/probe.ts:85]` |
| Model list (shipped) | `/api/v0/models` | `data[].id`, with `state === 'loaded'` sorted first `[VERIFIED: server/src/probe.ts:252]` |
| **Tool capability (preferred)** | `/api/v1/models` | `capabilities.trained_for_tool_use` |
| **Max window (preferred)** | `/api/v1/models` | `max_context_length` |
| **Served window (D-05)** | `/api/v1/models` | `loaded_instances[].config.context_length` |
| Max window (older builds) | `/api/v0/models` | `max_context_length` |
| Tool capability (older builds) | — | **none — this is where D-06's round-trip probe is the only answer** |

`/api/v0/models` fields: `id`, `object`, `type`, `publisher`, `arch`, `compatibility_type`, `quantization`, `state`, `max_context_length` — **no `capabilities`, no tool-use indicator** `[CITED: lmstudio.ai/docs/developer/rest/endpoints]`.

`/api/v1/models` fields: `type`, `publisher`, `key`, `display_name`, `architecture`, `quantization`, `size_bytes`, `params_string`, `loaded_instances`, `max_context_length`, `format`, `capabilities`, `description`, `variants`, `selected_variant`; with `capabilities: { vision, trained_for_tool_use, reasoning: { allowed_options, default } }` and `loaded_instances: [{ id, config: { context_length, eval_batch_size, parallel, flash_attention, num_experts, offload_kv_cache_to_gpu } }]` `[CITED: lmstudio.ai/docs/developer/rest/list]`.

Note the **model identifier on v1 is `key`, not `id`** — the existing `idsOf` reads `data[].id` from `/api/v0/models`, so a v1 read needs its own accessor.

**[ASSUMED]** `/api/v1/*` arrived in LM Studio 0.4.0. A WebSearch result asserts it; the official `rest/list` page this research fetched does not state a version. Treat `/api/v1/models` as *best-effort*: try it, and on a 404 fall back to `/api/v0/models` + the round-trip probe. That fallback chain is correct regardless of which version introduced it, which is why the assumption does not need resolving before planning.

---

## Architecture Patterns

### System Architecture Diagram

```
                             ┌─────────────────────────────────────────────┐
  Learner's browser          │  Settings page (web/src/pages/Settings.tsx) │
  ──────────────────         │   ├─ ProviderRow × 10  (group: local × 3)   │
                             │   │    ├─ base URL field  (D-02)            │
                             │   │    ├─ model combobox                    │
                             │   │    ├─ num_ctx field   (D-03) ◀── NEW    │
                             │   │    └─ `test teaching` (D-13) ◀── NEW    │
                             │   └─ link ──▶ /usage  (COST-03) ◀── NEW     │
                             └──────────────────┬──────────────────────────┘
                                                │ fetch, same-origin, HttpOnly cookie
                                                ▼
   ┌────────────────────────────────────────────────────────────────────────────────┐
   │  Hono app — server/src/index.ts  (credential middleware on every route)        │
   │                                                                               │
   │  POST /api/settings/detect ──▶ probe.ts detect()  ── 3 shape-checked GETs ─────┼──▶ :11434 /api/tags
   │  PUT  /api/settings/:id    ──▶ SettingsWrite (+ num_ctx) ──▶ settings table    │    :1234  /api/v0/models
   │  POST /api/settings/:id/capability ◀── NEW (D-06/D-07)                         │    :8080  /health
   │        └─▶ capability.ts  ── metadata first ──────────────────────────────────┼──▶ POST :11434 /api/show
   │                            └─ round-trip fallback ──▶ the real loop           │    GET  :8080  /props
   │  POST /api/settings/:id/test-teaching ◀── NEW (D-11..D-14)                     │    GET  :1234  /api/v1/models
   │        └─▶ createLesson(scratch) ─▶ runTurn ─▶ grade ─▶ deleteLesson (tx)     │
   │  GET  /api/usage ◀── NEW (COST-03) ──▶ listUsage({learner}) + costOf/costLabel │
   └───────────────────────────────┬───────────────────────────────────────────────┘
                                   │ Driver.runTurn(ctx, sink)
                                   ▼
   ┌────────────────────────────────────────────────────────────────────────────────┐
   │  Owned loop — server/src/drivers/api.ts   (unchanged structure)                │
   │                                                                               │
   │   1. adapterFor(provider) ──▶ drivers/adapters.ts                              │
   │        ├─ ollama   ◀── NEW row: createOllama(...)(.., { options:{num_ctx},     │
   │        │                            think:false, reliableToolCalling:false })  │
   │        ├─ lmstudio ◀── NEW row: createOpenAICompatible(v1(base), includeUsage) │
   │        └─ llamacpp ◀── NEW row: same                                           │
   │        dialect: 'compact'  on all three (D-08)                                 │
   │                                                                               │
   │   2. headroomCheck({ instructions, messages, prompt, tools }) ◀── tools: NEW    │
   │        └─ refuse ─▶ sink.endTurn({ ok:false, error: NUM_CTX_REFUSAL })         │
   │                      └──▶ SSE turn_end ──▶ web refusal card (UI-SPEC E2)       │
   │                                                                               │
   │   3. buildTools(.., adapter.dialect) ──▶ jsonSchemaOf(spec,'api','compact')    │
   │        └─ execute: validateToolInput(spec,'api',input)                         │
   │             └─ throw ──▶ recordToolRejection(provider, model) ◀── NEW (D-19)   │
   │                                                                               │
   │   4. streamText({ model, instructions:[stable, volatile], messages, tools })   │
   │        └─ finish-step ──▶ sink.usage(usageOf(..)) ──▶ db recordUsage           │
   └───────────────────────────────┬───────────────────────────────────────────────┘
                                   │ reads the same ledger
                                   ▼
   ┌────────────────────────────────────────────────────────────────────────────────┐
   │  scripts/conformance.mjs  ◀── NEW (D-15..D-18)   no learner surface            │
   │    for each configured provider × model:  replay a scripted lesson over HTTP   │
   │      assert: understanding gate held · pretest ran · cumulative quiz fired     │
   │      record: pass | fail | skipped(reason) · tool-rejection rate               │
   │    write: report.json + report.md   ·  exit non-zero on any fail               │
   │    two environments:  nightly GH Actions cron (cloud secrets)  ·  pnpm script  │
   │                                                       (local models, ~/.derive) │
   └────────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
server/src/
├── drivers/adapters.ts    # + 3 rows: ollama (native), lmstudio, llamacpp
├── probe.ts               # + postJson; keep detect() shape checks as they are
├── capability.ts          # NEW: metadata reads + the round-trip verdict (D-06/D-07)
├── context.ts             # + a `tools` field on headroomCheck's input
├── tools.ts               # unchanged — 'compact' dialect already exists
├── prompt.ts              # + the outline-only material render for the local surface (D-09)
├── settings.ts            # + numCtxKey(id) beside modelKey / baseUrlKey
├── migrations.ts          # + migration 8 if the rejection counter gets its own table
├── index.ts               # + /api/usage, /api/settings/:id/capability,
│                          #   /api/settings/:id/test-teaching; num_ctx on SettingsWrite
└── providers.ts           # flip teaches:false → true on the 3 local rows; rewrite their notes

web/src/
├── components/ProviderRow.tsx   # + NumCtxField, + TestTeaching action (D-13: every teachable row)
├── pages/Usage.tsx              # NEW
├── main.tsx                     # + <Route path="/usage" element={<UsagePage />} />
├── lib/api.ts                   # + usage(), testTeaching(id), probeCapability(id)
└── lib/types.ts                 # + num_ctx / capability on ProviderView; UsageView

scripts/
└── conformance.mjs              # NEW (D-15..D-18); add to ci.yml's node --check loop

.github/workflows/
└── conformance.yml              # NEW: schedule cron + workflow_dispatch
```

### Pattern 1: A local provider is three table rows, not a new loop

`adapterFor` is an exhaustive `switch` with **no fallthrough clause on purpose** — the three local cases currently throw, and replacing a `throw` with a row is the entire mechanical change:

`[VERIFIED: server/src/drivers/adapters.ts:400-404]`
```ts
    case 'ollama':
    case 'lmstudio':
    case 'llamacpp':
      throw new Error(`${labelOf(provider)} has no owned-loop adapter yet`);
```

The module's own docstring states why this is the shape to follow: *"adding a provider should be one row that a reader can check against the catalogue, not a sixth `if` buried in the loop"* and *"A provider's limitation stays in its own row."* `[VERIFIED: server/src/drivers/adapters.ts:8-19]`

### Pattern 2: the Ollama row, with the three settings that matter

```ts
// Source: composed from ai-sdk-ollama@4.4.0 dist/provider.d.ts (read 2026-10-22)
// + the shipped row shape at server/src/drivers/adapters.ts:364-396.
case 'ollama':
  return {
    // Compact on every local row, whatever the model's size (D-08).
    dialect: 'compact',
    // A local server caches nothing and takes no breakpoint.
    cacheHook: () => undefined,
    // Ollama's own cloud web search needs an Ollama key; the offline path has none,
    // so D-20's fallback decision applies and the row offers nothing of its own.
    search: () => null,
    model: (key, base, modelId) => {
      if (!modelId) throw new Error('Choose a model for Ollama first');
      return createOllama({
        // localBase() already resolves OLLAMA_HOST > stored base > catalogue default.
        baseURL: base ?? 'http://127.0.0.1:11434',
        // Ollama takes no key locally; a cloud base may want one.
        ...(key ? { apiKey: key } : {}),
        // The same no-redirect posture every other row takes.
        fetch: noRedirectFetch,
      })(modelId, {
        // THE reason this row is not on the OpenAI-compatible route (D-05).
        // Without it Ollama serves its 4096-token default and truncates the
        // method — the gate text is the first thing it drops.
        options: { num_ctx: numCtxFor('ollama') },
        // Every tool-capable model in Ollama's library also carries `thinking`,
        // and reasoning never reaches the learner or SQLite (03 D-09), so paying
        // for it out of a 16k window buys nothing.
        think: false,
        // Off deliberately: this layer retries and "normalizes" a malformed tool
        // call behind Derive's back, which would make D-19's schema-rejection
        // count measure the wrapper rather than the model.
        reliableToolCalling: false,
      });
    },
    // No table row carries a local model, and guessing a rate reads as money.
    cost: () => ({ cost_usd: null, cost_source: 'unknown', searches: null }),
  };
```

The settings surface this composes against:

`[VERIFIED: ai-sdk-ollama@4.4.0 dist/provider.d.ts:17-33]`
```ts
export interface OllamaProviderSettings extends Pick<Config, 'headers' | 'fetch'> {
    baseURL?: string;
    apiKey?: string;
    client?: OllamaClient;
}
```

`[VERIFIED: ai-sdk-ollama@4.4.0 dist/provider.d.ts:116-120]`
```ts
    /**
     * Enable reliable tool calling with retry and completion mechanisms.
     * Defaults to true whenever function tools are provided; set to false to opt out.
     */
    reliableToolCalling?: boolean;
```

### Pattern 3: the two-tier capability probe (D-06 / D-07)

**What:** metadata for the whole list on Settings-open/Rescan; one real tool round-trip for the model the learner selects.
**When to use:** every local row; the round-trip is also what the `test teaching` action on a cloud row reduces to.

```ts
// Source: field names from the three servers' own docs/source, cited in
// §Three Servers, Three Wire Shapes. Shape mirrors probe.ts's own LOCAL_PROBES table.

/** What a metadata read could establish. `unknown` is silence, never a refusal. */
type Capability = { tools: 'yes' | 'no' | 'unknown'; maxWindow: number | null; servedWindow: number | null };

/** Ollama: POST /api/show. `capabilities` contains 'tools'; the window key is architecture-prefixed. */
function ollamaCapability(show: unknown): Capability {
  const caps = Array.isArray(field(show, 'capabilities')) ? (field(show, 'capabilities') as unknown[]) : null;
  const info = field(show, 'model_info');
  const arch = typeof field(info, 'general.architecture') === 'string' ? (field(info, 'general.architecture') as string) : null;
  const max = arch ? field(info, `${arch}.context_length`) : undefined;
  return {
    tools: caps ? (caps.includes('tools') ? 'yes' : 'no') : 'unknown',
    maxWindow: typeof max === 'number' ? max : null,
    // Ollama is told the window rather than asked it (D-05), so nothing is served yet.
    servedWindow: null,
  };
}

/** llama.cpp: GET /props. A false is a finding; an absent chat_template_caps is silence. */
function llamaCppCapability(props: unknown, models: unknown): Capability {
  const caps = field(props, 'chat_template_caps');
  const supports = field(caps, 'supports_tools');
  const served = field(field(props, 'default_generation_settings'), 'n_ctx');
  const trained = field(field(list(models, 'data')[0], 'meta'), 'n_ctx_train');
  return {
    tools: typeof supports === 'boolean' ? (supports ? 'yes' : 'no') : 'unknown',
    maxWindow: typeof trained === 'number' ? trained : null,
    servedWindow: typeof served === 'number' ? served : null,
  };
}

/** LM Studio: /api/v1/models first, /api/v0/models as the older-build fallback. */
function lmStudioCapability(v1Entry: unknown, v0Entry: unknown): Capability {
  const flag = field(field(v1Entry, 'capabilities'), 'trained_for_tool_use');
  const v1Max = field(v1Entry, 'max_context_length');
  const v0Max = field(v0Entry, 'max_context_length');
  const loaded = field(field(list(v1Entry, 'loaded_instances')[0], 'config'), 'context_length');
  return {
    tools: typeof flag === 'boolean' ? (flag ? 'yes' : 'no') : 'unknown',
    maxWindow: typeof v1Max === 'number' ? v1Max : typeof v0Max === 'number' ? v0Max : null,
    servedWindow: typeof loaded === 'number' ? loaded : null,
  };
}
```

**The three verdicts, and what each triggers:**

| Metadata says | D-04 / D-06 action |
|---------------|--------------------|
| `tools: 'no'` | Refuse at config/probe time; the row shows the UI-SPEC capability refusal; the model cannot be selected. |
| `tools: 'yes'` and `maxWindow >= 16384` | Selectable. The round-trip probe still runs when the learner selects it (D-07). |
| `tools: 'yes'` and `maxWindow < 16384` | Refuse at config/probe time (D-04). |
| `tools: 'unknown'` | **Not a refusal.** Fall through to the round-trip probe (D-06). |
| `maxWindow: null` | **Not a refusal.** Let the per-lesson estimator decide (D-05), exactly as `headroomCheck` already abstains on a null window. |

### Pattern 4: the per-lesson refusal is already built — give it a second sentence

`headroomCheck` has one hard-coded refusal string today:

`[VERIFIED: server/src/context.ts:36-37]`
```ts
/** The verbatim refusal from 03-UI-SPEC.md §Copywriting Contract → Context-window refusal (A6). `Home` is the only link in the card and there is no button, because starting a review lesson reviews whatever is due rather than this lesson's nodes. */
const REFUSAL = 'This lesson has grown too long to continue. Everything you locked is saved — start a review lesson on these nodes from Home.';
```

and the module already names Phase 4 as the owner of the gap:

`[VERIFIED: server/src/context.ts:52]`
```ts
  // A model the table has no window for — every openai-compatible endpoint and every local server — abstains rather than guessing: refusing a learner's perfectly capable endpoint on a guessed window would be worse than letting that endpoint's own error through, and sizing an unlisted model is Phase 4's /api/show work.
```

The UI-SPEC is explicit that these are **two different cards that must not be conflated** — the `num_ctx` one links `Settings`, the lesson-growth one links `Home` `[VERIFIED: 04-UI-SPEC.md:181]`. So `headroomCheck` returns one of two reasons depending on whether the window came from the price table (lesson-growth, `Home`) or from the local row's `num_ctx` (local, `Settings`), and the browser routes the link on the reason.

### Pattern 5: the local prompt's material section is a render, not a fork

D-09 is "outlines in the prompt, full text through the tools." The tools are already there:

`[VERIFIED: server/src/actions.ts imports `readMaterial as readMat, searchMaterial as searchMat` from './materials.js'`]`

So the change is `materialsSection(lessonId)` gaining a surface parameter that emits section titles and keywords instead of segment text, and nothing in `method/` moving. CLAUDE.md's method rule and Phase 1 D-02/D-04 both forbid a method-body fork; `pnpm method:check` enforces it in CI `[VERIFIED: .github/workflows/ci.yml "Method text has not drifted" → pnpm method:check]`.

### Pattern 6: `test teaching` rides the real loop in a scratch lesson

Every piece already exists:

| Piece | Where | Evidence |
|-------|-------|----------|
| Make a lesson | `createLesson(id, topic, opts)` | `[VERIFIED: server/src/db.ts:449-457]` |
| Delete it atomically | `deleteLesson(id)` inside `withTx` | `[VERIFIED: server/src/db.ts:481-500 — "withTx(() => { … q.deleteUsageByLesson.run(id); q.deleteTurnsByLesson.run(id); q.deleteLesson.run(id); });"]` |
| Grade a quiz server-side | `actions.openQuiz` / `afterQuiz` | `[VERIFIED: server/src/actions.ts exports openQuiz, afterQuiz per CONTEXT.md §Layers]` |
| Drive the loop without a route | `setDriverOverride` / `setModelOverride` | `[VERIFIED: server/src/drivers/api.ts:107-111 "export function setModelOverride(factory: ModelFactory | null)"]` |

D-14 says the test's tokens never reach the ledger. `deleteLesson` already clears `usage` by lesson *before* `turns` `[VERIFIED: server/src/db.ts:493-497]`, so deleting the scratch lesson discards its rows by construction — no special-casing in `recordUsage`, which is the one write path and must stay so `[VERIFIED: server/src/db.ts:712-726 docstring: "This is the only way a usage row is ever written … Keep it that way"]`.

The marker that keeps it out of every listing: `listLessons(learnerId)` reads `q.listLessons` / `q.listAllLessons` `[VERIFIED: server/src/db.ts:471-474]`, and Home/Atlas read through those. A sentinel topic is fragile; a dedicated `mode` value would widen a union the whole app switches on. **Recommendation:** since the lesson exists for well under a second and is deleted in the same request, the simplest correct answer is to never let it be concurrent with a page load that matters — but a marker is still worth it for the crash case. Planner's call (Claude's Discretion); prefer the narrowest change that `deleteLesson` already cleans up.

The three fail reasons the UI-SPEC fixes map one-to-one onto observable loop outcomes `[VERIFIED: 04-UI-SPEC.md:180]`:

| UI-SPEC string | Loop observable |
|----------------|-----------------|
| `the model called no tools, so there was no node to grade.` | the turn ended with zero `tool-call` parts |
| `the quiz came back but the grade was unreadable.` | `validateToolInput` threw on the `quiz` call, or `parseReply`/grading found no usable answer |
| `nothing answered at {host}:{port}.` | `probe.ts`'s own `unreachable()` sentence `[VERIFIED: server/src/probe.ts:295 "return \`nothing answered at ${u.hostname}:${portOf(url)}\`;"]` |

### Pattern 7: one harness script, two environments

```yaml
# Source: composed from .github/workflows/ci.yml (the repo's own four setup steps)
# + docs.github.com schedule-event rules cited in §Conformance Harness Mechanics.
name: Conformance
on:
  schedule:
    - cron: '17 4 * * *'   # off the hour: the docs warn the top of every hour is the busy slot
  workflow_dispatch: {}    # the only way to exercise it before it is on the default branch
jobs:
  conformance:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v7
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v7
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: node scripts/conformance.mjs --out conformance
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          GOOGLE_API_KEY: ${{ secrets.GOOGLE_API_KEY }}
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
      - uses: actions/upload-artifact@v7
        if: always()          # the report is most valuable on the run that failed
        with:
          name: conformance
          path: conformance/
```

The local half is the same script with no keys and no `--out`, writing under `~/.derive` (D-18) and finding whatever `detect()` finds.

### Pattern 8: the Usage page is a sum and a formatter, both already written

`[VERIFIED: server/src/drivers/api.ts:56-60]`
```ts
export function lessonCost(lessonId: string, extra: readonly CostRow[] = []): string | null {
  const rows = [...listUsage({ lesson: lessonId }), ...extra];
  const { usd, source } = costOf(rows, priceTable());
  return costLabel(usd, rows.length ? source : null);
}
```

COST-03 is the same three lines with `{ learner }` instead of `{ lesson }`, grouped. `listUsage({ learner })` is an indexed read `[VERIFIED: server/src/db.ts:756 "if (filter.learner) return q.usageOfLearner.all(filter.learner) as UsageRow[];"` and the index at `migrations.ts:227]`, and the row already carries everything a group needs denormalised — `driver`, `model`, `lesson_id`, `cost_source`, the five token counts `[VERIFIED: server/src/db.ts:680-695]`.

The four label words and the money format are produced **once, server-side**:

`[VERIFIED: server/src/cost.ts:49]`
```ts
const LABEL: Record<CostSource, string> = { provider: 'billed', table: 'estimated', subscription: 'not billed', unknown: 'not reported' };
```

`[VERIFIED: server/src/cost.ts:126-135]`
```ts
export function costLabel(usd: number | null, source: CostSource | null): string | null {
  if (source === null) return null;
  const label = LABEL[source];
  if (source === 'subscription' || source === 'unknown') return label;
  if (usd === null || usd <= 0) return label;
  if (usd < 0.005) return `under $0.01 ${label}`;
  return `about $${usd.toFixed(2)} ${label}`;
}
```

The UI-SPEC is explicit: *"Label vocabulary is fixed by `server/src/cost.ts` and must not fork … produced once server-side by `costLabel`. The Usage page must call the same formatter, never re-format a number."* `[VERIFIED: 04-UI-SPEC.md:188-190]` So `/api/usage` returns **strings**, and `Usage.tsx` renders them. The partial-group case the UI-SPEC names (a lesson mixing priced and subscription rows takes the weakest label) is `weakestSource`, which is already total and order-independent `[VERIFIED: server/src/cost.ts:64-71]`.

The UI-SPEC also fixes the local line's provider word: `{provider}` is `ollama` / `lm studio` / `llama.cpp`, *"so non-Ollama local usage is not mislabelled"* `[VERIFIED: 04-UI-SPEC.md:185]`. The ledger's `driver` column is the catalogue `ProviderId` — `lmstudio`, `llamacpp` — and `labelOf` maps those to `LM Studio` / `llama.cpp` `[VERIFIED: server/src/providers.ts:179,194,216]`. The Usage page must lowercase through `labelOf`, not print the raw id.

### Anti-Patterns to Avoid

- **A fourth local-only `ToolDialect`.** `'compact'` exists, is CI-validated, and already shortens every description and every nested schema description. Reuse it (D-08 says so).
- **A new event type for the local refusals.** CONTEXT.md §Established Patterns and Phase 3 D-09/D-10/D-17 keep the vocabulary closed; the refusals are `turn_end { ok:false, error }`. `EVENT_TYPES` in `useLesson.ts` must not grow.
- **A new tool for the capability probe or `test teaching`.** The tool set must match in four places plus `plugin/commands/*.md` (CLAUDE.md). The probe uses the existing sixteen.
- **Reading `process.env` outside `config.ts`.** `settings.ts`'s docstring states the rule and `OLLAMA_HOST` already lives in `config.ts:76` `[VERIFIED: server/src/config.ts:76]`. A new `num_ctx` env lock, if any, goes there and through `lockedBy`.
- **Guessing a price for a local model.** `cost.ts`'s whole argument is that a figure may never claim more firmness than its weakest input; a local row returns `cost_source: 'unknown'` and the Usage page reads `not reported` `[VERIFIED: 04-UI-SPEC.md:186]`.
- **Re-formatting money in the browser.** Explicitly forbidden by the UI-SPEC.
- **Writing a usage row for the `test teaching` run.** D-14. `recordUsage` stays the single write path; `deleteLesson` discards.
- **Telling the learner to pass `--jinja`.** Default-enabled now; the sentence would be wrong and condescending. Use the UI-SPEC's locked refusal.
- **Letting the metadata probe's silence mean "no".** See Pitfall 2.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Setting Ollama's context window | A hand-rolled `fetch` to `/api/chat` | `ai-sdk-ollama` `options: { num_ctx }` | The loop is `streamText` with sixteen `tool()` definitions, resume, retries, replay guards and orphan patching; a bespoke client re-implements all of it for one option. |
| Reaching LM Studio / llama.cpp | A second OpenAI client | `createOpenAICompatible` (already a dependency, already used at `adapters.ts:388`) | Same wire format, same `includeUsage`, same `noRedirectFetch`. |
| Shortening tool descriptions | Hand-written short strings per tool | `descriptionFor(spec,'api','compact')` + `jsonSchemaOf(spec,'api','compact')` | Hand-written strings are a second contract that drifts from the registry; `shortened()` is *always a prefix of the original* by design `[VERIFIED: server/src/tools.ts:510-513 "Always a prefix of the original, never a rewrite"]`. |
| Estimating prompt size | A tokenizer, or a second character heuristic | `estimateTokens` / `headroomCheck` | A client-side tokenizer is explicitly out of scope (REQUIREMENTS.md §Out of Scope: "Client-side tokenizers for cost"). A second heuristic is how two screens start disagreeing. |
| Money and labels on the Usage page | `toFixed`, `Intl.NumberFormat`, a `$0.00` | `costOf` + `costLabel` + `weakestSource` | Four-word vocabulary, the `under $0.01` boundary, and the weakest-source rule are all load-bearing honesty rules the UI-SPEC locks. |
| Deleting the scratch lesson's rows | A sequence of `DELETE`s | `deleteLesson` | Already one transaction over nine tables in dependency order. |
| Schema-validating a tool call | A hand-rolled check for the rejection counter | the existing `validateToolInput` throw site | D-19 counts exactly what that function rejects; a parallel check would count something else. |
| Turning a server's error into a sentence | A regex over response bodies | `providerSentence` + `hintFor` + `unreachable` + `safeMessage` | Four shapes already handled, including Ollama's string `error` and llama.cpp's `error.message` `[VERIFIED: server/src/probe.ts:261-267 docstring names llama.cpp, LM Studio and Ollama]`. |
| Redacting the conformance report | Manual string scrubbing | `safeMessage` / `redactErrors` | The only function allowed to match on key *shape*, with four key patterns plus the registered-value set `[VERIFIED: server/src/secrets.ts:41-46, 105-112]`. |
| Running a migration | Inline `ALTER TABLE` in `db.ts` | `migrations.ts` numbered entry (next is **8**) | Transactional, `PRAGMA user_version`-gated, snapshots the old file with `VACUUM INTO` first `[VERIFIED: migration versions 1–7 at server/src/migrations.ts:141,182,202,233,240,253,299]`. |

**Key insight:** this phase's temptation is to write a small bespoke client "just to send `num_ctx`" and a small bespoke formatter "just for the Usage page." Both would be the second copy of something the repo already argues at length for having exactly one of — and in both cases the existing version encodes an honesty rule (the pessimistic estimate, the four-word label vocabulary) that a reimplementation would quietly drop.

---

## Runtime State Inventory

> Not a rename/refactor/migration phase in the sense this section exists for, but three of the five categories have real content because the phase touches stored settings and a learner's machine. Recorded explicitly rather than omitted.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| **Stored data** | The `settings` table gains `num_ctx:<provider>` keys (new rows, no schema change — `settings` is `key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER` `[VERIFIED: server/src/migrations.ts:244-248]`). The `usage` table is read-only for COST-03 — **no migration, no backfill**. A rejection-telemetry table would be migration **8**. | Code only for `num_ctx`; one numbered migration if the counter gets its own table. No existing row is rewritten. |
| **Live service config** | The learner's **Ollama daemon** holds its own `OLLAMA_CONTEXT_LENGTH` / `OLLAMA_NUM_PARALLEL` and a currently-loaded model instance; **LM Studio** holds a per-instance `loaded_instances[].config.context_length` the learner set in its UI; **llama.cpp** holds `-c` / `--parallel` from its command line. None of this is in git and none of it is Derive's to change (D-05). | None — read-only by decision. But the refusal sentence must be about *Derive's* `num_ctx` field (Ollama) or about the model's room (LM Studio / llama.cpp), never an instruction to reconfigure a server Derive does not own. |
| **OS-registered state** | None. No scheduler entry, no service, no pm2 process. The nightly harness lives in GitHub Actions (D-15), not in cron on the learner's box. | None — verified by `ls .github/workflows` (two files) and the absence of any OS-registration code in `server/src`. |
| **Secrets / env vars** | `OLLAMA_HOST` already locks the Ollama row's base URL through `lockedBy('base_url:ollama')` `[VERIFIED: server/src/settings.ts:218]`. The conformance workflow needs **new repository secrets** for the cloud providers; `gh secret list` returns nothing today. | Add repository secrets before the first nightly run; the harness must record `skipped (no key)` rather than fail when one is absent (D-17). |
| **Build artifacts / installed packages** | `pnpm-lock.yaml` changes with the `ai-sdk-ollama` add. `server/dist/` must be rebuilt for `mcp.js` and the harness's `pnpm build` step. | `pnpm install` + `pnpm build`; CI's `--frozen-lockfile` will fail if the lockfile is not committed with the manifest. |

---

## Common Pitfalls

### Pitfall 1: `num_ctx` not sent → Ollama silently truncates the method

**What goes wrong:** the lesson runs, the tutor talks, and the understanding gate, the discipline rules and the checks simply are not in the prompt. Nothing errors. The learner gets a chatbot that calls a quiz tool occasionally.
**Why it happens:** Ollama's default window is 4,096 tokens `[CITED: ollama/docs/faq.mdx:25]` and Derive's prompt floor is ~13,096 estimated tokens. Ollama truncates rather than refusing.
**How to avoid:** `num_ctx` on every Ollama request (D-05), and a `headroomCheck` that counts the tool surface (Finding 1).
**Warning signs:** the model never calls `set_plan`; `node_status` is never called; the lesson has no graph. The conformance harness's "understanding gate held" assertion is exactly the detector for this.

### Pitfall 2: treating absent metadata as "tools unsupported"

**What goes wrong:** a perfectly tool-capable model on an older llama.cpp build (no `chat_template_caps`) or an older LM Studio (no `/api/v1/models`) is refused with "this model cannot run the method", and the learner cannot proceed.
**Why it happens:** it is tempting to read `chat_template_caps?.supports_tools !== true` as a refusal. But an absent field is silence about *every* value, and llama.cpp's own docs tell clients to fall back when a sibling field is missing: *"Older servers can omit `architecture`. If it is absent, use the legacy behavior of your client."* `[CITED: ggml-org/llama.cpp tools/server/README.md:1370]`
**How to avoid:** three-valued `tools: 'yes' | 'no' | 'unknown'` (Pattern 3). Only `'no'` refuses. `'unknown'` falls through to D-06's round-trip probe, which is the one thing that *can* turn silence into a fact.
**Warning signs:** a plan task whose assertion is `=== true` on a possibly-absent field.

### Pitfall 3: a 200 on port 8080 is not llama.cpp — proven on this machine

**What goes wrong:** the row reads `found on port 8080` and every subsequent probe parses HTML as JSON.
**Why it happens:** 8080 is the most reused developer port there is. `probe.ts`'s own docstring documents this exact machine's case `[VERIFIED: server/src/probe.ts:4-16]`, and it is still true today — **reproduced this session**:

```
$ curl -s http://127.0.0.1:8080/health | head -c 60
<!DOCTYPE html><html lang="en"><head>... <title>FreqUI</title>
$ curl -s -o /dev/null -w "%{http_code} %{content_type}\n" http://127.0.0.1:8080/props
200 text/html; charset=utf-8
```

`/props` answers **200 text/html** from a trading dashboard. A `/props` probe that checks only the status code would read it as llama.cpp.
**How to avoid:** every new probe keeps `probeJson`'s contract — a non-JSON body comes back as `body: null` with its status intact `[VERIFIED: server/src/probe.ts:65-77]` — and the shape check requires a *parsed object field*, the way `isLlamaCpp` already requires `status === 'ok'`. For `/props`, require `default_generation_settings.n_ctx` to be a number.
**Warning signs:** a probe predicate of the form `p.status === 200` with no field read.

### Pitfall 4: `ai-sdk-ollama@4.5.x` breaks the install

**What goes wrong:** `pnpm install` emits a peer-dependency warning (or errors, depending on `strict-peer-dependencies`) because `4.5.x` wants `ai ^7.0.137` and the repo pins `ai@7.0.126`. At runtime a `LanguageModelV4` built against a newer `@ai-sdk/provider` can mismatch the loop's expectations.
**Why it happens:** `pnpm add ai-sdk-ollama` with no version takes `latest`.
**How to avoid:** `pnpm --filter server add ai-sdk-ollama@4.4.0` — an exact pin, matching how `@ai-sdk/anthropic`, `@ai-sdk/google`, `@ai-sdk/openai`, `@openrouter/ai-sdk-provider`, `ai`, `ts-fsrs`, `unpdf` and `fflate` are all already pinned exactly `[VERIFIED: server/package.json:17-28]`.
**Warning signs:** `^` or no version in the install command; a peer warning in CI's `pnpm install --frozen-lockfile` step.

### Pitfall 5: `reliableToolCalling` masks the thing the phase measures

**What goes wrong:** D-19's schema-rejection rate reads near zero on Ollama, and the conformance report says small models are fine when they are not.
**Why it happens:** `ai-sdk-ollama` turns on a retry/normalisation layer **by default whenever function tools are provided** — `maxRetries: 2, forceCompletion: true, normalizeParameters: true, validateResults: true` `[VERIFIED: ai-sdk-ollama@4.4.0 dist/provider.d.ts:116-120 and :121-128]`. It repairs malformed calls before the loop sees them.
**How to avoid:** `reliableToolCalling: false` on the row, with a comment saying why. If the owner later wants the repair layer for a better learner experience, it must be a separate, deliberate decision — and the rejection counter would then have to be read as "rejections the wrapper could not fix."
**Warning signs:** a conformance report where every local model passes.

### Pitfall 6: changing `num_ctx` forces an Ollama model reload

**What goes wrong:** `test teaching` takes 40 seconds, or the first real turn after a passing test takes 40 seconds, because Ollama unloads and reloads the model with a different KV-cache allocation.
**Why it happens:** `num_ctx` is a load-time parameter — required RAM scales with it `[CITED: ollama/docs/faq.mdx:335 "Required RAM will scale by OLLAMA_NUM_PARALLEL * OLLAMA_CONTEXT_LENGTH"]`, so a different value is a different loaded instance.
**How to avoid:** the capability round-trip probe, `test teaching` and the real lesson must all read `num_ctx` from the **same** stored setting. Never probe at a small `num_ctx` "to be quick."
**Warning signs:** two different `num_ctx` literals in the diff.

### Pitfall 7: the nightly workflow cannot be tested from a branch

**What goes wrong:** the conformance workflow is merged, and nobody finds out it is broken until the next night — or the night after, because *"The `schedule` event can be delayed during periods of high loads"* `[CITED: docs.github.com … events-that-trigger-workflows]`.
**Why it happens:** *"Scheduled workflows run on the latest commit on the default branch"* `[CITED: same]`. A PR cannot exercise a `schedule` trigger.
**How to avoid:** always add `workflow_dispatch: {}` beside the cron, and run it manually once from the default branch as the acceptance step. Put the cron minute off the hour (the docs name the start of every hour as a high-load window).
**Also:** *"In a public repository, scheduled workflows are automatically disabled when no repository activity has occurred in 60 days."* `[CITED: same]` — worth one sentence in the workflow's own comment so a future reader is not surprised by a silently dead nightly.

### Pitfall 8: a llama.cpp model id is a filesystem path

**What goes wrong:** the Usage page, the lesson header pill and the Obsidian export all print `/home/learner/models/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf` as the model, which breaks the layout and leaks the learner's home directory into an exported note.
**Why it happens:** *"By default, model `id` field is the path to model file, specified via `-m`. You can set a custom value for model `id` field via `--alias`."* `[CITED: ggml-org/llama.cpp tools/server/README.md:1372]`
**How to avoid:** the UI-SPEC already requires truncation with the full value in `title` for both the Settings row and the Usage line `[VERIFIED: 04-UI-SPEC.md:208, 222]` — honour it. The `SettingsWrite` model regex `/^[A-Za-z0-9._:/-]*$/` accepts a POSIX path `[VERIFIED: server/src/index.ts:364]` but would reject a Windows path with `\`; worth a sentence in the row's note recommending `--alias`.
**Warning signs:** a Usage line rendered without truncation; a Windows learner's base-path model id refused with the regex's sentence and no explanation.

### Pitfall 9: a provider error body in a public CI artifact

**What goes wrong:** a 401 from a cloud provider during the nightly run echoes the key (some providers do), the harness writes it verbatim into `report.json`, and `upload-artifact` publishes it.
**Why it happens:** the harness is a standalone script outside the server's egress chokepoints — it does not get `events.ts`'s `redactDeep` or the route layer's `safeMessage` for free.
**How to avoid:** the harness must `registerSecret` every key it reads from the environment at startup, and route **every** recorded sentence through `safeMessage` before writing it. `registerSecret` ignores values under 16 characters `[VERIFIED: server/src/secrets.ts:35 "const MIN_SECRET_CHARS = 16;" and :49-53]`, so a short placeholder cannot turn redaction into a shredder.
**Warning signs:** a harness that writes `e.message` or a response body directly.

### Pitfall 10: the `test teaching` button on a row that cannot teach

**What goes wrong:** D-13 puts the action on "every teachable provider row," and the two login rows (`claude-code`, `codex`) are `teaches: true` `[VERIFIED: server/src/providers.ts:75, 89]` — but `adapterFor` throws for both on purpose: *"`claude-code` and `codex` throw permanently: their drivers are the Agent SDK and the Codex SDK, not this one."* `[VERIFIED: server/src/drivers/adapters.ts:243-245, 397-399]`
**Why it happens:** `teaches` and "runs through the owned loop" are different predicates and it is easy to conflate them.
**How to avoid:** decide explicitly whether `test teaching` on a login row drives that row's own driver (`agent.ts` / `codex.ts` — it can, since both implement `Driver.runTurn`) or is hidden. Driving them is the honest reading of PROV-11's "any chosen model"; either way the planner must state it, because the UI-SPEC's placement is being widened by D-13 and the SPEC needs the matching edit.
**Warning signs:** a plan task that gates the button on `row.teaches` alone and no note about the two login rows.

---

## Code Examples

### Adding the `num_ctx` field to the settings write

```ts
// Source: extends the shipped schema at server/src/index.ts:357-374 verbatim in style.
const SettingsWrite = z
  .object({
    key: z.string().max(4096, 'the key is longer than any provider issues').optional().describe('The API key to store for this provider. Never read back.'),
    model: z.string().trim().max(200, 'the model id is longer than any provider issues').regex(/^[A-Za-z0-9._:/-]*$/, 'the model id may only contain letters, digits, . _ : / and -').optional().describe('The model id to store for this provider, or an empty string to clear it.'),
    base_url: z.string().trim().max(500, 'the base URL is longer than any endpoint needs').optional().describe('Where a local server or an OpenAI-compatible endpoint is reached, or an empty string to return to the catalogue default.'),
    // The method needs about 13,100 estimated tokens of prompt before a word of
    // lesson, so a window under 16,384 cannot hold it and Ollama's own default of
    // 4,096 would truncate the gate text rather than refuse. Integer-only: Ollama
    // allocates a KV cache of this size at load time.
    num_ctx: z.number().int().min(16_384, 'the method needs at least 16384 tokens of context').max(1_048_576, 'that is larger than any local model serves').optional().describe("The context window Derive asks a local Ollama model for. Only the Ollama row reads it; LM Studio and llama.cpp serve whatever they were started with."),
  })
  .strict();
```

### Reading a POST-bodied metadata endpoint without widening the egress posture

```ts
// Source: mirrors server/src/probe.ts:308-323 `getJson` exactly, with a body.
// Ollama's /api/show is the only metadata read in this phase that is not a GET.
export async function postJson(url: string, headers: Record<string, string>, body: unknown, ms: number): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      // The same two lines every outbound request in this repo carries: a redirect
      // could carry a key to a host the catalogue never named, and a local server
      // that does not answer fast is a server that is wrong rather than far away.
      redirect: 'manual',
      signal: AbortSignal.timeout(ms),
    });
  } catch (e) {
    throw new Error(unreachable(url, e));
  }
  if (res.status >= 300 && res.status < 400) throw new Error(`${res.status} the server redirected elsewhere; derive does not follow redirects that could carry a key`);
  const text = await res.text();
  if (!res.ok) throw new Error(providerSentence(res.status, text));
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`${res.status} the response was not JSON`);
  }
}
```

### Making the headroom check see the tool surface

```ts
// Source: server/src/context.ts:47-57, one field wider.
export function headroomCheck(
  input: { provider: string; model: string | null; instructions: string; messages: string; prompt: string; tools: string },
  table: PriceTable,
): { refuse: false } | { refuse: true; reason: string } {
  const window = table[input.provider]?.[input.model ?? '']?.context;
  if (window == null) return { refuse: false };
  // The tool definitions go out on every request and occupy the same window as
  // the prose. On a million-token cloud model that is noise; on a 16,384-token
  // local one the sixteen `api` tools are 3,349 estimated tokens in the compact
  // dialect — a fifth of the window the estimate was pretending to measure.
  const estimate =
    estimateTokens(input.instructions) + estimateTokens(input.messages) + estimateTokens(input.prompt) + estimateTokens(input.tools);
  if (estimate <= window * HEADROOM_FRACTION) return { refuse: false };
  return { refuse: true, reason: REFUSAL };
}
```

and at the call site `[VERIFIED: server/src/drivers/api.ts:511]`, the serialised set the loop is about to send:

```ts
// `buildTools` already runs per attempt; the projection is deterministic for a
// (surface, dialect) pair, so serialising it here costs one JSON.stringify.
const toolText = JSON.stringify(toolsFor('api').filter((s) => !omit.has(s.name)).map((s) => [s.name, descriptionFor(s, 'api', adapter.dialect), jsonSchemaOf(s, 'api', adapter.dialect)]));
const headroom = headroomCheck({ provider, model: ctx.model ?? null, instructions: ctx.instructions, messages: JSON.stringify(prior), prompt: ctx.prompt, tools: toolText }, priceTable());
```

### Where the local window comes from, given there is no price-table row

`headroomCheck` reads the window from the merged price table, and `pricing.ts` carries **no rows at all** for the local providers, by design:

`[VERIFIED: server/src/pricing.ts:26-29]`
```
 * key could not serve both without a normalising guess, and a guess here reads
 * as money. `openai-compatible` and the three local servers carry no rows at
 * all, because the model behind a learner's own endpoint is not knowable from a
 * table.
```

So the local window must reach `headroomCheck` **without** inventing a price row (a row with `input: 0` would render a metered lesson as free — the exact lie `pricing.ts` exists to prevent). Two clean options:

1. Pass the window in as an optional `window?: number` on the input, taking precedence over the table lookup. Smallest change; keeps `pricing.ts` a pure money table.
2. Build the merged table with a `context`-only entry for the local provider+model. Requires `ModelPrice`'s token fields to be nullable, which they are not (`input: number` `[VERIFIED: server/src/pricing.ts:51]`).

**Recommendation: option 1.** One optional field, no change to the money table's type, and the function stays pure.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| llama.cpp needs `--jinja` for tool calling | `--jinja` is **default: enabled**; `--no-jinja` opts out | before 2026-10 (current `master`) | The roadmap's research note is stale. The refusal sentence must not instruct the learner to add the flag. `[CITED: tools/server/README.md:234]` |
| llama.cpp tool support is only discoverable by trying | `/props` → `chat_template_caps` reports nine `supports_*` booleans | current `master` | A cheap, definitive metadata read for the llama.cpp row. `[VERIFIED: common/jinja/caps.cpp:106-118]` |
| LM Studio's `/v1/models` returns ids only | `/api/v1/models` returns `capabilities.trained_for_tool_use` and `loaded_instances[].config.context_length` | **[ASSUMED]** LM Studio 0.4.0 | D-06's premise ("LM Studio's `/v1/models` returns ids only") holds only for older builds; the round-trip probe becomes a fallback rather than the primary. `[CITED: lmstudio.ai/docs/developer/rest/list]` |
| `ollama-ai-provider` (1.2.0, last published 2025-01) | `ai-sdk-ollama` 4.x / `ollama-ai-provider-v2` 4.x | 2025-06 → 2026-10 | `ollama-ai-provider@1.2.0` peers only on `zod ^3.0.0` and has no `ai` peer at all `[VERIFIED: npm view ollama-ai-provider peerDependencies]` — it predates AI SDK v5, let alone v7. Do not use it. |
| `actions/upload-artifact@v4` | `@v7` | current | Matches the repo's existing `@v7` majors. |

**Deprecated / outdated:**
- `ollama-ai-provider@1.2.0` — unpublished-since-2025-01, no `ai` peer. Dead for a v7 loop.
- LM Studio `/api/v0/*` — *"LM Studio now has a v1 REST API! We recommend using the v1 API for new projects!"* `[CITED: lmstudio.ai/docs/developer/rest/endpoints]`. The repo's `detect()` and `idsOf` use `/api/v0/models` and should **keep** using it for *discovery* (it is the shape check that distinguishes LM Studio from anything else on 1234), while *metadata* reads prefer `/api/v1/models`.
- Model names from training data (`qwen2.5`, `llama3.1`, `mistral-nemo`) do not exist in the current Ollama library. See the verified table in §Three Servers. Do not put any model name in shipped code or prompt text.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js ≥ 22.5 | everything | ✓ | **22.22.2** | — |
| pnpm | install, build, test | ✓ | **12.5.1** (matches `packageManager: pnpm@12.5.1`) | — |
| `gh` CLI, authenticated | adding repository secrets for the nightly harness | ✓ | logged in as `jicanta` | — |
| **Ollama** (port 11434) | PROV-06 — success criterion 1 | **✗** | — | **none.** No `ollama` binary, nothing on 11434. |
| **LM Studio** (port 1234) | PROV-07 — success criterion 2 | **✗** | — | **none.** No `lms` binary, nothing on 1234. |
| **llama.cpp** (port 8080) | PROV-07 — success criterion 2 | **✗** | — | **none.** No `llama-server` binary. Port 8080 is occupied by an unrelated FreqUI dashboard (see Pitfall 3). |
| Cloud provider keys (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`, `OPENROUTER_API_KEY`, `TAVILY_API_KEY`) | D-16's real-model harness runs | **✗** (all unset in this shell) | — | D-17's `skipped (no key)` line — the harness is designed for this. |
| GitHub repository secrets | the nightly CI half (D-15) | **✗** (`gh secret list` → empty) | — | `workflow_dispatch` + `skipped` lines until secrets are added. |

**Missing dependencies with no fallback (these block *verification*, not *planning*):**

- **Ollama, LM Studio and llama.cpp are all absent from this machine.** Success criteria 1 and 2 ("completes a lesson on an Ollama model with the network off"; "LM Studio and llama.cpp work through the OpenAI-compatible path") **cannot be verified here**. The planner must:
  1. Build every parser (`capabilityOf`, `maxWindowOf`, the `/props` and `/api/show` readers) as a **pure function tested from literals** — the `cost.ts` / `schedule.ts` / `probe.ts`-pure-half precedent `[VERIFIED: CONTEXT.md §Established Patterns]` — using the exact JSON quoted in §Three Servers as the fixtures. That is fully testable in CI with no model.
  2. Drive the loop structurally with `setModelOverride` / `setDriverOverride` (the `drivers/fake.ts` precedent `[VERIFIED: server/src/drivers/api.ts:107-111; server/src/drivers/fake.ts exists]`), so the compact dialect, the `num_ctx` refusal and the `test teaching` scratch-lesson lifecycle are all proven with no network.
  3. Put the three real-server checks in **UAT as human-verify items**, with install commands, and expect the owner to run them. Do not let a plan task claim "Ollama lesson completes" from a stub.

**Missing dependencies with fallback:**
- Cloud keys and repository secrets: D-17's explicit `skipped` line is the designed behaviour. The harness's first green run can legitimately report every provider skipped — that is a *complete* report, which is the point.

---

## Security Domain

`security_enforcement: true`, `security_asvs_level: 1`, `security_block_on: high` `[VERIFIED: .planning/config.json workflow block]`.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (nothing new) | The per-install token and derived browser cookie already gate every `/api/*` route (FOUND-06, `credentials.ts`). The three new routes inherit it; none may be exempted. |
| V3 Session Management | no | Unchanged. |
| V4 Access Control | **yes** | `/api/usage` must scope to `learnerOf(c)` — never a client-supplied `learner_id`. The precedent is absolute: `recordUsage` reads the learner off the turn and *"never taken from the caller, so no later phase can file a request under a lesson or a learner its turn does not belong to"* `[VERIFIED: server/src/db.ts:712-721]`. The read side owes the same discipline. |
| V5 Input Validation | **yes** | `num_ctx` through `SettingsWrite`'s zod object (`.int().min().max()`, `.strict()`); base URL through the shipped `normaliseBaseUrl` (http/https only, no credentials, no query, no fragment) `[VERIFIED: server/src/settings.ts:98-109]`; every metadata response read as `unknown` and narrowed field by field, never cast. |
| V6 Cryptography | no | No new secret material. Local rows are `auth: 'none'` with `optionalKey` on two of them `[VERIFIED: server/src/providers.ts:168-204]`; a stored bearer rides `keys.ts` as every other key does. |
| V7 Error Handling & Logging | **yes** | Every new sentence through `providerSentence` / `hintFor` / `safeMessage`. The conformance report is a **new egress path outside the server's chokepoints** — see T-04-01. |
| V12 / SSRF | **yes** | The local rows take a learner-typed base URL and deliberately permit LAN addresses (D-02). See T-04-02. |

### Known Threat Patterns for this phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| **T-04-01 — a provider key reaches a public CI artifact** via a 401 body recorded verbatim in `report.json` and uploaded by `actions/upload-artifact` | Information Disclosure | The harness `registerSecret`s every environment key at startup and routes **every** recorded sentence through `safeMessage`. `redactErrors` adds the four key-shape patterns (`sk-ant-`, `sk-`, `AIza`, `Bearer …`) for a key nobody registered `[VERIFIED: server/src/secrets.ts:41-46]`. A test should assert a known fake key does not survive into the written report. **This is the highest-value new control in the phase.** |
| **T-04-02 — SSRF through a learner-typed local base URL** | Tampering / Information Disclosure | Accepted deliberately and bounded: `normaliseBaseUrl` refuses non-http(s), embedded credentials, query and fragment; `getJson`/`postJson` keep `redirect: 'manual'` and refuse a 3xx because *"following it could carry the key to a third host"* `[VERIFIED: server/src/probe.ts:315]`; a key travels only in a header and only to the address the learner stored; the server binds loopback. D-02's LAN reach is the learner's own deliberate choice on their own machine, which is the local-first posture, not a hole. Record it in the Accepted Risks Log rather than "fixing" it. |
| **T-04-03 — the `num_ctx` field as a resource-exhaustion lever** | Denial of Service | `num_ctx` is a KV-cache allocation on the learner's *own* machine (RAM scales with `OLLAMA_NUM_PARALLEL × context` `[CITED: ollama/docs/faq.mdx:335]`). An absurd value is a failed model load, and the server's own sentence reaches the learner through `providerSentence`. The zod `.max()` is a politeness bound, not a security control; say so in the comment. |
| **T-04-04 — a filesystem path leaking into an exported note** | Information Disclosure | llama.cpp's default model `id` is the model file path, which lands in `usage.model`, the header pill and the Obsidian export. Truncation in the UI is cosmetic; the **export** is the real leak. Note it; recommend `--alias` in the row's note. Low severity (the learner's own vault), worth one Accepted Risks line. |
| **T-04-05 — the scratch lesson surviving a crash** | Integrity (of the ledger and the Usage total) | `deleteLesson` is one transaction, so a crash *mid-delete* leaves nothing partial `[VERIFIED: server/src/db.ts:481-500]`. A crash *between* the turn and the delete leaves a whole scratch lesson with usage rows, which would then appear in the Usage total — contradicting D-14. The marker from §Pattern 6 plus a boot-time sweep (the precedent exists: `index.ts` closes stale `turn_start`s at boot per CLAUDE.md §Module Design) is the mitigation. |
| **T-04-06 — a non-JSON 200 parsed as metadata** | Tampering | Pitfall 3, reproduced live on this machine. `probeJson`'s `body: null`-on-non-JSON contract plus a required-field shape check. |

**No new security prose in learner-facing surfaces.** The gap-closure memory for this project is explicit: *"no new security prose"* and *"trim before adding."* The UI-SPEC's copy is locked and contains no security sentence; keep it that way.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `/api/v1/*` arrived in LM Studio **0.4.0** | §Three Servers (LM Studio) | None material — the plan tries `/api/v1/models`, falls back to `/api/v0/models`, then to the round-trip probe. The version number appears nowhere in shipped code. |
| A2 | llama.cpp and LM Studio report a `usage` object on the **streaming** path when `@ai-sdk/openai-compatible` sends `stream_options: { include_usage: true }` | §Three Servers; §Pattern 8 | The Usage page's local lines read `not reported` instead of tokens. UI-SPEC already covers that state (`not reported`, never `$0.00`), so it degrades honestly. llama.cpp's non-streaming `usage` object is verified; the streaming case is not. Resolve with a live probe during UAT. |
| A3 | `createOllama({ fetch })` routes the custom fetch through ollama-js's `Config.fetch`, so `noRedirectFetch` applies | §Pattern 2 | The Ollama row would follow redirects. Low impact (a local server rarely redirects, and the row usually carries no key), but it breaks the repo's uniform posture. `OllamaProviderSettings extends Pick<Config, 'headers' | 'fetch'>` is verified in the `.d.ts`; that the client actually honours it was not exercised. Resolve by asserting it in the round-trip probe test. |
| A4 | `ai-sdk-ollama@4.4.0`'s `LanguageModelV4` (via `@ai-sdk/provider ^4.0.20`) is wire-compatible with `ai@7.0.126`'s `streamText` | §Standard Stack | The adapter row fails to typecheck or throws at runtime. The peer range `ai ^7.0.103` is the package author's own assertion and is satisfied; a real `pnpm install` + `pnpm typecheck` is the cheap falsification and should be the **first task** of the local-provider plan. |
| A5 | `tev1` and `nimble` (which `ai-sdk-ollama` documents under `evaluationModel` as "decision models") are usable as ordinary chat models for Derive | §Three Servers (the model table) | A recommendation nobody should be making anyway — the plan names no model. The table is context for the harness, not a shipped list. |
| A6 | A 32,768 default `num_ctx` is both sufficient for a real lesson and achievable on a typical learner machine | §Finding 2 | Either the lesson still refuses (window too small) or the model fails to load (RAM too small). This is the one assumption that **needs an owner decision**, because it adjusts a number D-03 names. Flagged as a confirmation checkpoint. |
| A7 | `think: false` is accepted by every tool-capable Ollama model and does not break tool calling | §Pattern 2 | A model that requires its thinking block to produce a tool call would stop calling tools. The parameter is documented and typed; its interaction with tool calling on a specific model was not exercised. The conformance harness is exactly the detector; make `think` a harness variable so a failing model can be re-run with `think: 'low'`. |

---

## Open Questions

1. **Does the 16,384 default `num_ctx` leave room for a lesson?**
   - *What we know:* the measured prompt floor is 13,096 estimated tokens (compact dialect); `0.8 × 16384 = 13,107`. Eleven tokens of slack before material, library, profile, turn prompt or history.
   - *What's unclear:* whether the owner reads D-03's "16k floor" as the refusal floor (allowing a higher default) or as the default itself.
   - *Recommendation:* plan for **default 32768, refusal floor 16384**, and put a `checkpoint:human-verify` on it citing the arithmetic above. If the owner insists on 16384, the phase still ships — the refusal card simply fires early, which satisfies criterion 1's refusal half but not its "completes a lesson" half.

2. **Should `headroomCheck` count the tool surface on every provider, or only on local rows?**
   - *What we know:* the omission is real and is 3,349–5,074 estimated tokens. On cloud windows of ~1M it changes nothing; on 16k it changes everything.
   - *What's unclear:* whether widening it globally shifts any existing Phase 3 test or UAT expectation.
   - *Recommendation:* widen it **globally** — a correct estimate everywhere is simpler than a conditional one, and the only behavioural change on a cloud provider is that a lesson is refused ~0.4% earlier. Grep `server/test/*.test.ts` for `headroomCheck` as the first task.

3. **Does `test teaching` run on the two login rows?**
   - *What we know:* both are `teaches: true` but `adapterFor` throws for both permanently; both implement `Driver.runTurn` through their own drivers.
   - *What's unclear:* whether D-13's "every teachable provider row" means "every row that teaches" (includes the logins) or "every row the owned loop teaches" (excludes them).
   - *Recommendation:* include them — it is PROV-11's plain reading, the drivers exist, and a Claude Code learner benefits from the same proof. State it in the plan and in the UI-SPEC amendment D-13 already requires.

4. **Where does the tool-rejection counter live?**
   - *What we know:* D-19/D-20 want a per-provider+model count of `validateToolInput` failures; D-21 keeps it internal with no runtime effect. Next migration is **8**.
   - *What's unclear:* table vs. column (Claude's Discretion).
   - *Recommendation:* a small append-only table (`turn_id`, `driver`, `model`, `tool`, `ts`), which lets the harness report both a rate and *which* tool a model fails on — far more diagnostic than a bare counter, for the same migration.

5. **Which `ToolSurface` does the local path use?**
   - *What we know:* `ToolSurface = 'agent' | 'api' | 'mcp' | 'http'` `[VERIFIED: server/src/tools.ts:38]`; dialect and surface are **orthogonal** — `jsonSchemaOf(spec, surface, dialect)`. D-08 says to reuse the compact projection and "its `ToolSurface`."
   - *What's unclear:* whether D-08 intends a new surface at all.
   - *Recommendation:* **no new surface.** Stay on `'api'` and change only the `dialect` to `'compact'`. A fifth surface would move `server/test/wire-surface.json` and widen the four-places tool-set rule for no gain. The UI-SPEC and D-08's intent are both satisfied by the dialect alone.

---

## Sources

### Primary (HIGH confidence)

- **In-repo source, read this session** — `server/src/context.ts`, `cost.ts`, `pricing.ts`, `probe.ts`, `providers.ts`, `settings.ts`, `tools.ts` (480-676), `db.ts` (440-509, 660-780), `migrations.ts`, `index.ts` (357-632), `prompt.ts`, `drivers/adapters.ts`, `drivers/api.ts` (40-110, 400-876), `agent.ts` (296-312); `web/src/components/fields.ts`, `web/src/lib/api.ts`, `web/src/lib/types.ts`, `web/src/main.tsx`, `web/src/pages/Settings.tsx`; `.github/workflows/ci.yml`; `server/package.json`, `web/package.json`, `package.json`
- **Measured in-repo this session** — system-prompt and tool-surface token estimates via `node --import tsx` against `prompt.ts` and `tools.ts`
- **`ai-sdk-ollama@4.4.0` tarball** (`npm pack`, extracted) — `dist/provider.d.ts`, `package.json`
- **`ollama@0.6.4` tarball** (`npm pack`, extracted) — `dist/browser.d.ts` (`Options.num_ctx`, `ShowResponse`)
- **`ggml-org/llama.cpp@master`** — `tools/server/README.md`, `common/jinja/caps.h`, `common/jinja/caps.cpp`
- **`ollama/ollama@main`** — `docs/api.md`, `docs/faq.mdx`
- **npm registry** — `npm view` for versions, peer deps, publish times, attestations; `api.npmjs.org/downloads`
- **GitHub API** — releases for `actions/*` and `pnpm/action-setup`; repo metadata for `jagreehal/ai-sdk-ollama`
- **Live `ollama.com`** — `/search?c=tools` and 20 `/library/<model>` pages (capability badges, parameter sizes)
- **Live local probe** — ports 11434 / 1234 / 8080 on this machine, reproducing `probe.ts`'s documented 8080 false positive

### Secondary (MEDIUM confidence)

- `lmstudio.ai/docs/developer/rest/endpoints` and `/rest/list` — the `/api/v0` and `/api/v1` field inventories (official docs, fetched through a summarising reader rather than read verbatim)
- `docs.github.com` events-that-trigger-workflows — the `schedule` event's rules

### Tertiary (LOW confidence)

- WebSearch results on "which small local models support tool calling" (`localaimaster.com`, `betterclaw.io`, `webscraft.org`, `theneuralbase.com`) — **superseded and partly contradicted** by the live `ollama.com` library read. Their model names (`qwen2.5`, `llama3.1`, `mistral-nemo`) do not exist in the current registry. Recorded here only so a later reader knows they were checked and rejected; **do not plan from them.**
- WebSearch claim that `/api/v1` arrived in LM Studio 0.4.0 — logged as assumption A1.

---

## Metadata

**Confidence breakdown:**

- **Standard stack:** HIGH for the decision, with a gate — `ai-sdk-ollama@4.4.0`'s API surface and peer range were read from the published tarball and the registry, not from memory. The `SUS` legitimacy verdict is explained and rebutted signal by signal, but the protocol's checkpoint stands.
- **The context arithmetic:** HIGH. Every number was measured against this repo this session; the two constants and the `headroomCheck` body are quoted verbatim. The *remedy* (which default to pick) is a decision, not a finding.
- **Three servers' wire shapes:** HIGH for Ollama and llama.cpp (read from the projects' own source and reference docs, with the `chat_template_caps` keys taken from the emitter rather than a stale doc example). MEDIUM for LM Studio `/api/v1` (official docs, via a summarising reader; version gating assumed).
- **Architecture patterns:** HIGH. Every pattern is an extension of a shipped mechanism quoted in place, not an invention.
- **Pitfalls:** HIGH. Eight of ten are grounded in quoted source or a live reproduction on this machine; two (5, 7) are grounded in a package's own type documentation and GitHub's own docs.
- **Which models pass the gate:** MEDIUM for the capability/size table (live registry read). LOW for any reliability ranking — deliberately not stated, because the conformance harness is the thing that answers it and the roadmap already expects small models to fail often.
- **Usage page (COST-03):** HIGH. No new table, no migration, no new formatter; the UI-SPEC and `cost.ts` already fix every string.

**Research date:** 2026-10-22
**Valid until:** 2026-11-21 for the in-repo findings (stable unless the phase itself moves them); **2026-10-29** for the three servers' wire shapes and the `ai-sdk-ollama` / `ai` version pairing — all four move weekly, and `ai-sdk-ollama` published twice in the week before this research.
