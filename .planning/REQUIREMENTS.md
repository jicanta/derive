# Requirements: Derive

**Defined:** 2026-09-17
**Core Value:** A learner can sit down with any model they have access to and be taught the Derive way: the dependency graph, the understanding gate, the review loop, with nothing lost between providers.

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

**Simplicity rule:** one screen, one next step. The default UI shows the lesson and what to do next; everything else lives behind Settings. No requirement ships without a one-sentence reason tied to learning better. Anything that read as "a feature just because" was moved to v2 on 2026-09-17.

### Foundation (contract, seam, hardening)

- [x] **FOUND-01**: The 14 tutor tools are defined once (name, description, zod schema) and every driver, the MCP server and the HTTP action validation derive from that single definition
- [x] **FOUND-02**: The teaching method text is defined once and rendered for the app system prompt, the Claude Code plugin skill, the Codex skills and the docs; CI fails when a rendered copy drifts from the source
- [x] **FOUND-03**: Every driver runs behind one driver interface and reports through one event sink, so adding a provider changes neither the web UI, the SSE stream, nor the terminal mirrors
- [x] **FOUND-04**: The Claude Code plugin and Codex paths keep working through the refactor, proven by a wire-surface snapshot and a stdio MCP smoke test that needs no model
- [x] **FOUND-05**: SQLite schema changes run through a numbered, transactional migration runner; `replaceGraph` and `deleteLesson` are transactional; existing databases migrate forward
- [x] **FOUND-06**: The local server binds loopback only, checks Host and Origin, requires a per-install token, and redacts secrets from every error, log, event and export path before any key is stored

### Providers

- [ ] **PROV-01**: Learner can run the tutor on an Anthropic API key through Derive's own agent loop; in-app Claude uses the key, the Claude Code plugin remains the subscription route
- [ ] **PROV-02**: Learner can run the tutor on an OpenAI API key
- [ ] **PROV-03**: Learner can run the tutor on a Google Gemini API key
- [ ] **PROV-04**: Learner can run the tutor through OpenRouter, with exact per-response cost recorded
- [ ] **PROV-05**: Learner can run the tutor through any OpenAI-compatible endpoint by entering a base URL and key
- [ ] **PROV-06**: Learner can run the tutor on a local Ollama model, offline, with the context window sized so the method is never silently truncated
- [ ] **PROV-07**: Learner can run the tutor on LM Studio or llama.cpp, with capability probes that refuse clearly when tool calling is unsupported
- [ ] **PROV-08**: The owned loop keeps full parity: same tools, same method, sequential tool execution, resume after interruption, retries with a visible "provider busy" status
- [ ] **PROV-09**: Web search and fetch work on every provider: provider-native tools where they exist, otherwise a pluggable search provider (Tavily, SearXNG, Ollama search) with a fetch that reuses the library fetcher
- [ ] **PROV-10**: Tool schemas are projected per provider dialect (OpenAI strict, Gemini, compact for local) and validated in CI; incoming calls are validated against the full schema server-side
- [ ] **PROV-11**: Learner can run a "test teaching" smoke test from settings: one node, one graded quiz, proving the chosen model can run the method
- [ ] **PROV-13**: A method-conformance harness replays a scripted lesson per provider and asserts the gate, pretest and cumulative quiz held; runs nightly

### Settings

- [ ] **SET-01**: Learner can choose provider and model on a settings page in the app; the choice persists across restarts
- [ ] **SET-02**: Learner can paste one masked key per provider; keys are stored in a 0600 secrets file outside the database and are never echoed back by the API
- [ ] **SET-03**: Settings detect what is available: logged-in CLIs, keys in the environment, local servers on their default ports; environment values show as "set from environment"
- [ ] **SET-04**: Learner can fetch the model list for a provider, with a manual model id fallback and a curated default
- [ ] **SET-05**: Learner can test a connection and see the actual failure sentence when it fails
- [ ] **SET-06**: The active provider and model are visible in the lesson header and in the plugin start message

### Cost

- [x] **COST-01**: Every turn persists raw usage (input, output, cache read, cache write, reasoning tokens) with the model id at that time and a cost source (provider, table, subscription, unknown)
- [ ] **COST-02**: Learner sees the estimated cost of each lesson in the lesson header and on Home, labelled billed, estimated, or not billed
- [ ] **COST-03**: Learner sees a usage page with a running total per learner, by provider, model and lesson, and tokens-only lines for subscription and local paths
- [ ] **COST-04**: Prices come from a versioned pricing table with a "prices as of" date the learner can override locally

### Learning experience

- [ ] **LEARN-01**: Home leads with what to do next: review N due, continue the open lesson, or start new, with review first
- [ ] **LEARN-02**: Learner can answer every card from the keyboard (1-4 or A-D, Enter, `?` for help)
- [ ] **LEARN-03**: The due-review count is visible everywhere, including a `derive due` command
- [ ] **LEARN-04**: Learner sees honest retention stats from FSRS data: estimated knowledge, true versus desired retention, forecast
- [ ] **LEARN-07**: The Atlas is coloured by memory stability so growth is visible at a glance
- [ ] **LEARN-08**: Learner can enter a focus mode that hides everything but the current card
- [ ] **LEARN-09**: Remediation names and re-quizzes the weakest prerequisite; quiz distractors draw on the learner's recorded misconceptions; warm-up and cumulative quiz are named in the UI
- [ ] **LEARN-10**: Voice mode auto-arms the mic after a question, speaks in sentence chunks, and uses the learner's language
- [ ] **LEARN-11**: Learner sees streaming status (thinking, calling quiz, grading) while waiting, and the next card is prefetched
- [ ] **LEARN-12**: Open cards survive a server restart: open prompts are persisted and rehydrated, so no dead card is left in the browser

### Personalization (style, not method)

- [ ] **STYLE-01**: Learner can choose light, dark or system theme plus an accent palette; applied before first paint with no flash; reduced motion is honoured
- [ ] **STYLE-02**: Learner can choose font family (including self-hosted Atkinson Hyperlegible, Lexend and OpenDyslexic) and font size; no Google Fonts request
- [ ] **STYLE-04**: Learner can choose tutor tone (plain, warm, dry) and language; only tone and language reach the prompt, the method text does not change
- [ ] **STYLE-06**: Style preferences are stored per learner server-side and mirrored to the browser for first paint; every palette passes 4.5:1 contrast in CI

### Adoption

- [ ] **ADOPT-01**: A user can install and start Derive with one command via a published npm package with a `bin`, or clone and run one command; the package bundles the built web app
- [ ] **ADOPT-02**: The runner checks the Node version in plain JS before any import and fails with a clear message
- [ ] **ADOPT-03**: Derive is listed in the Claude Code plugin marketplace with a repo-root `marketplace.json`, a self-contained plugin, and one version source stamped everywhere
- [ ] **ADOPT-04**: Codex skills ship with `SKILL.md` bodies generated from the single method source and install through the standard skills mechanism
- [ ] **ADOPT-05**: A docs site (Astro Starlight) is published with a quickstart that includes a free path, one page per provider, generated method/tool/settings references, and troubleshooting
- [ ] **ADOPT-06**: The README works as a landing page: install command, short demo, and an explicit "no telemetry, keys stay local" statement
- [ ] **ADOPT-07**: The repo has a contributor guide, issue and PR templates, a code of conduct, a public roadmap and an `examples/` directory
- [ ] **ADOPT-08**: Derive is submitted to the official and community plugin and skills directories

## v2 Requirements

Deferred to a future milestone. Tracked but not in the current roadmap.

### Providers

- **PROV-14**: Learner can run the tutor on a GitHub Copilot subscription through the Copilot SDK
- **PROV-15**: Learner can run the tutor on Gemini CLI through ACP (never its login)
- **PROV-16**: Tiered roles: a strong model plans and grades, a cheap or local model explains
- **PROV-17**: Per-lesson model choice
- **PROV-18**: Each model shows capability badges (tool calling, context window, price per million tokens) from a committed models.dev snapshot

### Learning experience

- **LEARN-13**: Graph reuse across lessons: locked Atlas nodes become roots of new lessons (method change, needs its own research)
- **LEARN-14**: Bounded "I have 10 minutes" sessions
- **LEARN-15**: Per-learner desired-retention slider
- **LEARN-16**: Learner has a forgiving streak with a weekly freeze and no lost-streak modal, and an adjustable daily goal in nodes or reviews
- **LEARN-17**: Learner gets review reminders without a server: due badge, plugin session-start nudge, desktop or browser notification, `.ics` export

### Cost

- **COST-08**: Learner sees learning-native units: cost per node locked, per review, per hour, and a cost preview before a lesson from the last ten
- **COST-09**: Learner can set a soft monthly budget that warns at 80% and pauses at the next turn boundary, never mid-card
- **COST-10**: Learner sees what prompt caching saved, and Derive alarms when cache reads drop to zero on a cached provider

### Personalization

- **STYLE-07**: Learner can choose card density and graph panel position; reduced motion is honoured
- **STYLE-08**: Learner can pick the voice-mode voice; voice mode is off by default on local-model setups with a privacy note

### Adoption

- **ADOPT-09**: CLI verbs `derive doctor`, `learners`, `auth` beyond `start`, `mcp`, `due`
- **ADOPT-10**: Cross-platform CI matrix running the npx runner on Node 22 and 24 across macOS, Linux and Windows
- **ADOPT-11**: Recorded-lesson replay on the landing page; provider parity badge

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Hosted / SaaS version | Learner data stays local; a hosted product is a different business |
| Desktop app packaging (Electron, Tauri, brew cask) | Clone-and-run or npx is enough for this milestone |
| Driving the Claude Pro/Max login from the app (Agent SDK) | Anthropic's terms forbid it in third-party tools; the plugin is the subscription route |
| Driving the Gemini CLI login or importing `@google/gemini-cli-core` | Google's terms only sanction ACP or headless use |
| Degrading the method per provider | Parity is the constraint; a weak model simply teaches worse |
| Free-text custom system prompt or theme editor | Tone and style are bounded choices; the method must not fork |
| Leagues, XP economies, hearts, escalating notifications | Evidence says they hurt learning; anti-features for a local install |
| Client-side tokenizers for cost | Provider-reported usage only; local counts are wrong for cost |
| OS keychain for secrets | Does not persist on headless Linux; complicates the npx runner; 0600 file instead |
| Docker-first install, hosted demo, Discord at launch | Adoption anti-patterns for a local tool at this stage |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1 | Complete |
| FOUND-02 | Phase 1 | Complete |
| FOUND-03 | Phase 1 | Complete |
| FOUND-04 | Phase 1 | Complete |
| FOUND-05 | Phase 1 | Complete |
| FOUND-06 | Phase 1 | Complete |
| PROV-01 | Phase 3 | Pending |
| PROV-02 | Phase 3 | Pending |
| PROV-03 | Phase 3 | Pending |
| PROV-04 | Phase 3 | Pending |
| PROV-05 | Phase 3 | Pending |
| PROV-06 | Phase 4 | Pending |
| PROV-07 | Phase 4 | Pending |
| PROV-08 | Phase 3 | Pending |
| PROV-09 | Phase 3 | Pending |
| PROV-10 | Phase 3 | Pending |
| PROV-11 | Phase 4 | Pending |
| PROV-13 | Phase 4 | Pending |
| SET-01 | Phase 2 | Pending |
| SET-02 | Phase 2 | Pending |
| SET-03 | Phase 2 | Pending |
| SET-04 | Phase 2 | Pending |
| SET-05 | Phase 2 | Pending |
| SET-06 | Phase 2 | Pending |
| COST-01 | Phase 1 | Complete |
| COST-02 | Phase 3 | Pending |
| COST-03 | Phase 4 | Pending |
| COST-04 | Phase 3 | Pending |
| LEARN-01 | Phase 5 | Pending |
| LEARN-02 | Phase 5 | Pending |
| LEARN-03 | Phase 5 | Pending |
| LEARN-04 | Phase 5 | Pending |
| LEARN-07 | Phase 5 | Pending |
| LEARN-08 | Phase 5 | Pending |
| LEARN-09 | Phase 5 | Pending |
| LEARN-10 | Phase 5 | Pending |
| LEARN-11 | Phase 5 | Pending |
| LEARN-12 | Phase 5 | Pending |
| STYLE-01 | Phase 6 | Pending |
| STYLE-02 | Phase 6 | Pending |
| STYLE-04 | Phase 6 | Pending |
| STYLE-06 | Phase 6 | Pending |
| ADOPT-01 | Phase 7 | Pending |
| ADOPT-02 | Phase 7 | Pending |
| ADOPT-03 | Phase 7 | Pending |
| ADOPT-04 | Phase 7 | Pending |
| ADOPT-05 | Phase 7 | Pending |
| ADOPT-06 | Phase 7 | Pending |
| ADOPT-07 | Phase 7 | Pending |
| ADOPT-08 | Phase 7 | Pending |

**Phase 1 status basis (gap run 01-13..01-15):** exposure was decided per requirement, not from a file list: the surface each requirement's own sentence above names was written down first, then intersected with `git diff --name-only cc1f818..HEAD` — every path this gap run changed since the tree the re-verification report describes. A later reader should re-run that diff against the tree they have rather than trust the reading below, which was taken on 2026-09-19.

- **FOUND-01** — its sentence names the registry, every driver, the MCP server and the HTTP action validation. The run is on `server/src/mcp.ts` and `server/src/index.ts`, so it is exposed, and the status rests on the wire-surface fixture staying byte-identical (`git diff --quiet 239d5f1..HEAD -- server/test/wire-surface.json`, exit 0) with `mcp.test.ts` green, both measured after those edits.
- **FOUND-02** — its sentence names the method source, its six rendered copies and the CI gate over them. Nothing under `method/`, neither render script and no rendered copy appears in the diff, so the run did not touch it; `scripts/check-method.mjs` ("6 rendered copies match") is run regardless, so the record rests on a gate rather than on an absence alone.
- **FOUND-03** — its sentence names the driver interface, the event sink, the web UI, the SSE stream and the terminal mirrors. The run is on `web/src/lib/api.ts`, `web/src/lib/useLesson.ts` and the `/api/*` stream step in `server/src/index.ts`, so it is exposed, and the status rests on `driver.test.ts`, which carries a copy of `EVENT_TYPES` taken from `web/src/lib/useLesson.ts` and asserts a whole turn's event types against it — a browser-side change that moved the seam's vocabulary is what it fails on.
- **FOUND-04** — its machine half sits on the same surface as FOUND-01 and rides the same wire-surface and `mcp.test.ts` gates, both green after this run. Its human half is one real lesson through the Claude Code plugin and one through the Codex skills; a person runs that or it stays outstanding, and no summary's word substitutes for it. **Closed 2026-09-20:** the human half ran as UAT test 1 (HC-2) in `01-UAT.md` and passed — one lesson through the Claude Code plugin and one through the Codex skills, with a GitHub-URL repo import folded in.
- **FOUND-05** — its sentence names the numbered migration runner and the transactional writes, both in `server/src/db.ts`, which this run edits, so it is exposed. The status rests on the migration suite green under `pnpm test` (`# fail 0`) after that edit.
- **FOUND-06** — its sentence names the bind, the Host and Origin checks, the per-install token and the redaction paths, which is most of what this run changes. It is deliberately not promoted: the verifier recorded it blocked, and the run repairing it has not itself been re-verified, so no gate inside that run can stand in for the verifier.
- **COST-01** — its sentence names the per-turn usage ledger in `server/src/db.ts`, which this run edits, so it is exposed. The status rests on the restart-sweep case in `tx.test.ts`, on `usage.test.ts`, and on `pnpm test` at `# fail 0`, all measured after `closeOpenTurns` gained its `closeUsage` call.

**Coverage:**

- v1 requirements: 50 total
- Mapped to phases: 50
- Unmapped: 0 ✓

**By phase:**

- Phase 1 (Foundation): FOUND-01..06, COST-01 — 7
- Phase 2 (Settings and Secrets): SET-01..06 — 6
- Phase 3 (Owned Loop: API Keys and Gateways): PROV-01..05, PROV-08..10, COST-02, COST-04 — 10
- Phase 4 (Local Models, Parity Proof and Usage): PROV-06, PROV-07, PROV-11, PROV-13, COST-03 — 5
- Phase 5 (Learning Experience): LEARN-01..04, LEARN-07..12 — 10
- Phase 6 (Personalization): STYLE-01, STYLE-02, STYLE-04, STYLE-06 — 4
- Phase 7 (Adoption): ADOPT-01..08 — 8

---
*Requirements defined: 2026-09-17*
*Last updated: 2026-09-20 — FOUND-04 promoted to Complete on the passing human check (HC-2) in `01-UAT.md`; every other Phase 1 status unchanged from the 2026-09-19 reading*
