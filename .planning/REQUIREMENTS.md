# Requirements: Derive

**Defined:** 2026-09-17
**Core Value:** A learner can sit down with any model they have access to and be taught the Derive way: the dependency graph, the understanding gate, the review loop, with nothing lost between providers.

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Foundation (contract, seam, hardening)

- [ ] **FOUND-01**: The 14 tutor tools are defined once (name, description, zod schema) and every driver, the MCP server and the HTTP action validation derive from that single definition
- [ ] **FOUND-02**: The teaching method text is defined once and rendered for the app system prompt, the Claude Code plugin skill, the Codex skills and the docs; CI fails when a rendered copy drifts from the source
- [ ] **FOUND-03**: Every driver runs behind one driver interface and reports through one event sink, so adding a provider changes neither the web UI, the SSE stream, nor the terminal mirrors
- [ ] **FOUND-04**: The Claude Code plugin and Codex paths keep working through the refactor, proven by a wire-surface snapshot and a stdio MCP smoke test that needs no model
- [ ] **FOUND-05**: SQLite schema changes run through a numbered, transactional migration runner; `replaceGraph` and `deleteLesson` are transactional; existing databases migrate forward
- [ ] **FOUND-06**: The local server binds loopback only, checks Host and Origin, requires a per-install token, and redacts secrets from every error, log, event and export path before any key is stored

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
- [ ] **PROV-12**: Each model shows capability badges (tool calling, context window, price per million tokens) from a committed models.dev snapshot
- [ ] **PROV-13**: A method-conformance harness replays a scripted lesson per provider and asserts the gate, pretest and cumulative quiz held; runs nightly

### Settings

- [ ] **SET-01**: Learner can choose provider and model on a settings page in the app; the choice persists across restarts
- [ ] **SET-02**: Learner can paste one masked key per provider; keys are stored in a 0600 secrets file outside the database and are never echoed back by the API
- [ ] **SET-03**: Settings detect what is available: logged-in CLIs, keys in the environment, local servers on their default ports; environment values show as "set from environment"
- [ ] **SET-04**: Learner can fetch the model list for a provider, with a manual model id fallback and a curated default
- [ ] **SET-05**: Learner can test a connection and see the actual failure sentence when it fails
- [ ] **SET-06**: The active provider and model are visible in the lesson header and in the plugin start message

### Cost

- [ ] **COST-01**: Every turn persists raw usage (input, output, cache read, cache write, reasoning tokens) with the model id at that time and a cost source (provider, table, subscription, unknown)
- [ ] **COST-02**: Learner sees the estimated cost of each lesson in the lesson header and on Home, labelled billed, estimated, or not billed
- [ ] **COST-03**: Learner sees a usage page with a running total per learner, by provider, model and lesson, and tokens-only lines for subscription and local paths
- [ ] **COST-04**: Prices come from a versioned pricing table with a "prices as of" date the learner can override locally
- [ ] **COST-05**: Learner sees learning-native units: cost per node locked, per review, per hour, and a cost preview before a lesson from the last ten
- [ ] **COST-06**: Learner can set a soft monthly budget that warns at 80% and pauses at the next turn boundary, never mid-card
- [ ] **COST-07**: Learner sees what prompt caching saved, and Derive alarms when cache reads drop to zero on a cached provider

### Learning experience

- [ ] **LEARN-01**: Home leads with what to do next: review N due, continue the open lesson, or start new, with review first
- [ ] **LEARN-02**: Learner can answer every card from the keyboard (1-4 or A-D, Enter, `?` for help)
- [ ] **LEARN-03**: The due-review count is visible everywhere, including a `derive due` command
- [ ] **LEARN-04**: Learner sees honest retention stats from FSRS data: estimated knowledge, true versus desired retention, forecast
- [ ] **LEARN-05**: Learner has a forgiving streak with a weekly freeze and no lost-streak modal, and an adjustable daily goal in nodes or reviews
- [ ] **LEARN-06**: Learner gets review reminders without a server: due badge, plugin session-start nudge, desktop or browser notification, `.ics` export
- [ ] **LEARN-07**: The Atlas is coloured by memory stability with a month slider showing growth over time
- [ ] **LEARN-08**: Learner can enter a focus mode that hides everything but the current card
- [ ] **LEARN-09**: Remediation names and re-quizzes the weakest prerequisite; quiz distractors draw on the learner's recorded misconceptions; warm-up and cumulative quiz are named in the UI
- [ ] **LEARN-10**: Voice mode auto-arms the mic after a question, speaks in sentence chunks, and uses the learner's language
- [ ] **LEARN-11**: Learner sees streaming status (thinking, calling quiz, grading) while waiting, and the next card is prefetched
- [ ] **LEARN-12**: Open cards survive a server restart: open prompts are persisted and rehydrated, so no dead card is left in the browser

### Personalization (style, not method)

- [ ] **STYLE-01**: Learner can choose light, dark or system theme plus an accent palette; applied before first paint with no flash
- [ ] **STYLE-02**: Learner can choose font family (including self-hosted Atkinson Hyperlegible, Lexend and OpenDyslexic) and font size; no Google Fonts request
- [ ] **STYLE-03**: Learner can choose card density and graph panel position; reduced motion is honoured
- [ ] **STYLE-04**: Learner can choose tutor tone (plain, warm, dry) and language; only tone and language reach the prompt, the method text does not change
- [ ] **STYLE-05**: Learner can pick the voice-mode voice; voice mode is off by default on local-model setups with a privacy note
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

### Learning experience

- **LEARN-13**: Graph reuse across lessons: locked Atlas nodes become roots of new lessons (method change, needs its own research)
- **LEARN-14**: Bounded "I have 10 minutes" sessions
- **LEARN-15**: Per-learner desired-retention slider

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
| (filled by roadmap) | | |

**Coverage:**
- v1 requirements: 58 total
- Mapped to phases: 0
- Unmapped: 58 ⚠️

---
*Requirements defined: 2026-09-17*
*Last updated: 2026-09-17 after initial definition*
