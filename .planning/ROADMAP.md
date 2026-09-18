# Roadmap: Derive

## Overview

Derive already teaches the Derive way on two host-owned agent loops (Claude Code login, ChatGPT login) with one SQLite record per learner. This milestone opens it to any model and any way of paying for it, then makes the learning experience lower-effort, lets each learner style the app without touching the method, and lowers the barrier for others to install and contribute. The provider block has a fixed internal order: consolidate the tool contract and method text, extract the driver seam and event sink with a usage ledger, real migrations and a hardened localhost server; then the settings page and secrets; then Derive's own agent loop on API keys and gateways with per-lesson cost; then local models, the parity harness and the usage page. Learning experience follows the harness so method changes are measured on every provider; personalization is independent of the provider block and can run alongside it; adoption comes last so the package, marketplaces and docs describe the finished thing. Every phase keeps the Claude Code plugin and Codex skills working.

**Simplicity rule (binding on every phase, from PROJECT.md):** one screen, one next step. The default UI shows the lesson and what to do next; everything else lives behind Settings. No feature ships without a one-sentence reason tied to learning better — a plan that adds a control, panel or page outside Settings must state that reason.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - One tool contract, one method text, one driver seam and event sink, per-turn usage ledger, transactional migrations, hardened localhost server; plugin and Codex paths proven unchanged
- [ ] **Phase 2: Settings and Secrets** - Provider and model chosen in the app, availability detected, keys stored in a 0600 file and never echoed, connection tested, active model visible everywhere
- [ ] **Phase 3: Owned Loop: API Keys and Gateways** - Derive's own agent loop on Anthropic, OpenAI and Gemini keys, OpenRouter and any OpenAI-compatible endpoint, with full parity, web search on every path and per-lesson cost in the header
- [ ] **Phase 4: Local Models, Parity Proof and Usage** - Free, offline lessons on Ollama, LM Studio and llama.cpp without silent truncation; "test teaching"; nightly conformance harness; usage page with a running total by provider, model and lesson
- [ ] **Phase 5: Learning Experience** - Home says what to do next, due count everywhere, keyboard-first cards, honest retention stats, stability-coloured Atlas, focus mode, sharper remediation, better voice mode, streaming status, restart-safe cards
- [ ] **Phase 6: Personalization** - Theme, accent, font (dyslexia-friendly, self-hosted), size, reduced motion, tone and language; per learner, behind Settings, applied before first paint, method untouched
- [ ] **Phase 7: Adoption** - One-command install via a published package, Claude Code marketplace and Codex skills listings, docs site, README as landing page, contributor guide, directory submissions

## Phase Details

### Phase 1: Foundation

**Goal**: The tutor's 14 tools and its method text exist once and feed every surface; every driver sits behind one interface and one event sink; every turn's raw usage is recorded; the database migrates transactionally; the local server is hardened before it ever holds a key — and the Claude Code plugin and Codex paths are proven unchanged throughout.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, FOUND-06, COST-01
**Success Criteria** (what must be TRUE):

  1. A lesson run through the Claude Code plugin and one run through the Codex skills both complete exactly as before; the wire-surface snapshot is unchanged and a stdio MCP smoke test (`tools/list`, `start_lesson`, `quiz`, `answer`, `end_lesson`) passes with no model
  2. Editing a tool's schema or a sentence of the method in its single source updates the app system prompt, the plugin skill, the Codex skills, the `allowed-tools` lists and the HTTP action validation together; CI fails when any rendered copy drifts from the source
  3. A new driver is added by implementing one `Driver.runTurn(ctx, sink)` and reporting through the sink, with no change to the web UI, the SSE stream or the terminal mirrors (proven by a fake driver in tests)
  4. An existing `~/.derive` database opens on the new version and migrates forward under a numbered, transactional runner; an interrupted `replaceGraph` or `deleteLesson` leaves no partial state
  5. The server answers only on 127.0.0.1 with a per-install token, rejects foreign Host and Origin, and no secret appears in any error, log, event, export or vault-mirror path; every turn stores raw usage (input, output, cache read, cache write, reasoning tokens) with the model id at that time and a cost source (provider, table, subscription, unknown)

**Plans**: 1/8 plans executed, in 7 waves following the fixed internal order (contract → method → seam → migrations → ledger → hardening)

Plans:
**Wave 1**

- [x] 01-01-PLAN.md — One registry for all 22 tools on the MCP wire, plus the committed wire-surface snapshot (wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 01-02-PLAN.md — MCP server and HTTP action validation driven by the registry; stdio smoke test (wave 2)
- [ ] 01-03-PLAN.md — The method text written once under `method/`, rendered to five targets, CI failing on drift (wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 01-04-PLAN.md — `Driver.runTurn(ctx, sink)`, one event sink, and a fake driver as the proof (wave 3)

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 01-05-PLAN.md — Numbered transactional migrations on `PRAGMA user_version`, and `withTx` (wave 4)

**Wave 5** *(blocked on Wave 4 completion)*

- [ ] 01-06-PLAN.md — The `turns` and `usage` tables: honest per-request usage for every turn (wave 5)

**Wave 6** *(blocked on Wave 5 completion)*

- [ ] 01-07-PLAN.md — Loopback bind, Host and Origin checks, per-install token, one version string (wave 6)

**Wave 7** *(blocked on Wave 6 completion)*

- [ ] 01-08-PLAN.md — Redaction chokepoint, SSRF and path guards, and the plugin/Codex parity run (wave 7)

**Cross-cutting constraints:**

- web/src/lib/useLesson.ts is untouched by this plan: git diff --quiet -- web/ exits 0.

**Research**: Not needed — standard patterns (zod raw shapes accepted by all three tool APIs, Hono middleware, `PRAGMA user_version`, 0600 files). Internal order matters: contract and method first with no behaviour change (existing API suite, snapshot fixture and MCP smoke test as the net), then seam, sink, migrations, ledger and hardening. (Migrations before ledger: the `turns` and `usage` tables of 01-06 are authored as migrations under 01-05's runner, so the runner has to exist first. This matches the Plans list above; an earlier draft of this note had the two transposed.) Pin the Claude Agent SDK to a caret range; version string from `package.json`; decide deliberately which wording wins where `prompt.ts` and `SKILL.md` disagree.

### Phase 2: Settings and Secrets

**Goal**: The learner chooses provider and model in the app, sees what the machine already offers, stores keys safely, tests the connection, and always knows which model is teaching.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: SET-01, SET-02, SET-03, SET-04, SET-05, SET-06
**Success Criteria** (what must be TRUE):

  1. Learner opens Settings, picks a provider and a model, restarts Derive, and the same choice is active
  2. Learner pastes a key once; it is masked afterwards, lives in a 0600 secrets file outside `derive.db`, and no API response ever returns it (write-only field answering `{ set, hint }`)
  3. Settings show what is already available without typing: logged-in Claude Code and Codex CLIs, keys in the environment labelled "set from environment", and local servers found on their default ports
  4. Learner fetches a provider's model list, or types a model id when the fetch fails, with a curated default preselected
  5. "Test connection" reports success or the provider's actual failure sentence; the active provider and model are shown in the lesson header and in the plugin start message

**Plans**: TBD
**UI hint**: yes
**Research**: `--research-phase` recommended — re-read Anthropic's consumer-OAuth policy and Gemini CLI's third-party terms at implementation time (both MEDIUM; wording may have changed). Bake in: in-app Claude asks for an API key and the Claude Code login is offered as "use the plugin"; Gemini defaults to an API key. Settings resolve `env > file > detection` per turn, replacing the boot-time backend memo; provider config per install, optional per-learner model override, never a per-learner key.

### Phase 3: Owned Loop: API Keys and Gateways

**Goal**: The learner runs the full Derive method on an Anthropic, OpenAI or Gemini API key, through OpenRouter, or on any OpenAI-compatible endpoint, with Derive running its own agent loop, web search on every path, and the cost of each lesson visible where the lesson is.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: PROV-01, PROV-02, PROV-03, PROV-04, PROV-05, PROV-08, PROV-09, PROV-10, COST-02, COST-04
**Success Criteria** (what must be TRUE):

  1. Learner completes a lesson (graph, warm-up, node teaching, understanding gate, lock, cumulative quiz) on an Anthropic key, an OpenAI key and a Gemini key with the same tools and method as the Claude Code path; the API suite passes through the owned loop with a stub model
  2. Learner completes a lesson through OpenRouter with exact per-response cost recorded, and through a base URL plus key endpoint entered in Settings
  3. Interrupting a turn and resuming continues the lesson without a provider error; a rate-limited provider shows a "provider busy" status card and retries; tools execute sequentially and idempotently by call id
  4. The tutor can search the web and fetch a page on every provider: natively where the provider has a search tool, otherwise through the configured search provider (Tavily, SearXNG) with a fetch that reuses the library fetcher
  5. The lesson header and the Home row show "about $X.XX" labelled billed, estimated or not billed, priced from a versioned pricing table with a "prices as of" date the learner can override locally; CI validates each provider's projected tool schema (OpenAI strict, Gemini, compact) and incoming calls are validated server-side against the full schema

**Plans**: TBD
**UI hint**: yes
**Research**: `--research-phase` recommended — AI SDK 7 API details are MEDIUM and not yet exercised in this repo; exact `providerMetadata` path for OpenRouter's per-response `cost` (fall back to `cost_source: 'table'` if absent); per-provider JSON Schema dialect rules; `prepareStep`/`pruneMessages` compaction for long lessons (first version refuses with a clear error and "start a review lesson"); search-provider free tiers are LOW. Persist native provider messages per lesson in `turn_messages`; synthesize error `tool_result`s for orphans on abort; stable-prefix prompt split with cache control on Anthropic.

### Phase 4: Local Models, Parity Proof and Usage

**Goal**: The learner can run Derive free and offline on a local model without the method silently degrading, can prove any chosen model runs the method before investing a session, and can see what learning has cost across every provider.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: PROV-06, PROV-07, PROV-11, PROV-13, COST-03
**Success Criteria** (what must be TRUE):

  1. Learner completes a lesson on an Ollama model with the network off; when the prompt would exceed the model's context window Derive refuses with a clear card instead of teaching without the gate
  2. LM Studio and llama.cpp work through the OpenAI-compatible path; a model that cannot call tools is refused with a plain message naming the missing capability, not a broken lesson
  3. From Settings, "Test teaching" runs one node and one graded quiz on the chosen model and reports pass or fail before the learner invests a session
  4. A nightly conformance harness replays a scripted lesson on every configured provider and reports whether the understanding gate, the pretest and the cumulative quiz held
  5. The Usage page, reached from Settings, shows one thing: a running total per learner by provider, model and lesson, with tokens-only lines for subscription and local paths

**Plans**: TBD
**UI hint**: yes
**Research**: `--research-phase` recommended — which tool-capable local models actually complete a Derive lesson (expect small models to fail the gate often); minimum `num_ctx` (floor 16k from a prompt estimate, checked against `/api/show`); LM Studio and llama.cpp template support (`/v1/models`, `/props`, `--jinja`). Use `ai-sdk-ollama` on the native API because it is the only route that sets `num_ctx`; compact tool descriptions and material-outline-only for local providers, gate text never removed; record tool rejection rate per provider in usage; the usage page needs no research.

### Phase 5: Learning Experience

**Goal**: The tutor carries the workflow: the learner opens Derive and is told what to do next, answers from the keyboard, sees honest progress, gets sharper remediation, and never waits on a dead card.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: LEARN-01, LEARN-02, LEARN-03, LEARN-04, LEARN-07, LEARN-08, LEARN-09, LEARN-10, LEARN-11, LEARN-12
**Success Criteria** (what must be TRUE):

  1. Home opens on "Review N due / Continue / Start new" with review first and nothing else competing for the screen; the due count is visible on every page and from `derive due`
  2. Learner answers every card from the keyboard (1-4 or A-D, Enter, `?` for help), can enter a focus mode that shows only the current card, and sees streaming status (thinking, calling quiz, grading) while the next card is prefetched
  3. Learner sees honest retention stats from FSRS data (estimated knowledge, true versus desired retention, forecast) and an Atlas coloured by memory stability, so growth is visible at a glance
  4. On a failed quiz the tutor names and re-quizzes the weakest prerequisite, distractors draw on the learner's recorded misconceptions, warm-up and cumulative quiz are named in the UI — and the conformance harness still passes on every provider
  5. Voice mode auto-arms the mic after a question and speaks in sentence chunks in the learner's language; open cards are persisted and rehydrated so a server restart leaves no dead card in the browser

**Plans**: TBD
**UI hint**: yes
**Research**: Not needed — Anki, Math Academy and Duolingo patterns are documented and the FSRS data already exists. Held cards live in a `prompts` table via the Phase 1 migration runner; focus mode is a `data-focus` attribute on `<html>` next to the Phase 6 style attributes; add `voice.test.ts` and an `applyEvent` reducer test. Graph reuse across lessons stays deferred to v2.

### Phase 6: Personalization

**Goal**: Each learner styles Derive to their taste — theme, type, tone, language — from Settings, with the style present before first paint and the teaching method byte-identical underneath.
**Mode:** mvp
**Depends on**: Phase 2
**Parallelizable with**: Phases 3, 4 and 5 (independent of the provider block; needs only the Phase 1 migration runner and method renderer, and the Phase 2 Settings page to live behind)
**Requirements**: STYLE-01, STYLE-02, STYLE-04, STYLE-06
**Success Criteria** (what must be TRUE):

  1. Learner picks light, dark or system and an accent palette in Settings; a reload shows the chosen theme with no flash of the wrong one, and a reduced-motion preference is honoured throughout
  2. Learner picks a font family (including self-hosted Atkinson Hyperlegible, Lexend and OpenDyslexic) and a font size, and no request for fonts leaves the machine
  3. Learner picks tutor tone (plain, warm, dry) and language; the rendered prompt differs only in the bounded tone and language block and a test proves the method text is unchanged
  4. Style is stored per learner server-side and mirrored to the browser for first paint, and every palette passes 4.5:1 contrast in CI

**Plans**: TBD
**UI hint**: yes
**Research**: Not needed — Tailwind 4 `@theme inline` and `@custom-variant dark` are quoted from official docs; Fontsource packages are standard. `learners.style` JSON column with `cleanStyle`; `data-theme/accent/font/size/focus` on `<html>`; OKLCH accents with `color-mix()`; variables propagated to xyflow, Mermaid and KaTeX; move the existing Instrument and JetBrains faces off Google Fonts. No free-text system prompt, no theme editor.

### Phase 7: Adoption

**Goal**: Anyone can install Derive with one command, find it in the plugin marketplaces and skills directories, read docs that describe the finished provider layer and final theme, and contribute.
**Mode:** mvp
**Depends on**: Phase 6
**Requirements**: ADOPT-01, ADOPT-02, ADOPT-03, ADOPT-04, ADOPT-05, ADOPT-06, ADOPT-07, ADOPT-08
**Success Criteria** (what must be TRUE):

  1. A new user runs the published package with `npx` (or clones and runs one command) and gets a working Derive with the bundled web app; on a Node older than 22.5 it stops with a plain message before any import
  2. `claude plugin marketplace add` on the repo installs a self-contained plugin from the repo-root `marketplace.json`; `plugin.json`, `marketplace.json`, `/api/health` and the MCP `serverInfo` all report one and the same version
  3. Codex skills install through the standard skills mechanism with `SKILL.md` bodies generated from the single method source
  4. The docs site is live with a quickstart that includes a free path, one page per provider, generated method, tool and settings references and troubleshooting; the README opens with the install command, a short demo and an explicit "no telemetry, keys stay local" statement
  5. The repo carries a contributor guide, issue and PR templates, a code of conduct, a public roadmap and an `examples/` directory, and submissions are filed to the official and community plugin and skills directories

**Plans**: TBD
**UI hint**: yes
**Research**: `--research-phase` recommended — Codex skills and plugin distribution (`npx skills add` versus `codex plugin marketplace add`); npm name availability (`derive` is taken; `derive-tutor`, `derive-ai`, `derive-learn` were free on 2026-09-17 — reserve early); npx behaviour with the vendored Codex binary on Windows; Starlight versus VitePress decided here (Starlight recommended). `plugin/.mcp.json` must point at the published runner, not `../server/dist`; `web/dist` resolved from `import.meta.url`; native SDKs optional and lazy.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7. Phase 6 may run in parallel with Phases 3–5.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 1/8 | In Progress|  |
| 2. Settings and Secrets | 0/TBD | Not started | - |
| 3. Owned Loop: API Keys and Gateways | 0/TBD | Not started | - |
| 4. Local Models, Parity Proof and Usage | 0/TBD | Not started | - |
| 5. Learning Experience | 0/TBD | Not started | - |
| 6. Personalization | 0/TBD | Not started | - |
| 7. Adoption | 0/TBD | Not started | - |
