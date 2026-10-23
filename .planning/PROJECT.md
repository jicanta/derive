# Derive

## What This Is

Derive is a local-first AI tutor that teaches from first principles: every lesson is a dependency graph from unconditional truths to the learner's goal, taught one node at a time, locked only when the learner passes a fresh question, then kept alive with spaced review (FSRS, warm-ups, cumulative quizzes). It runs as a local web app and inside the learner's terminal (Claude Code plugin, Codex skills), sharing one SQLite record per learner.

This milestone opens Derive to any model and any way of paying for it (subscriptions, API keys, OpenRouter-style gateways, local models), makes the learning experience as effective and low-effort as it can be, lets each learner style the app to their taste without changing the method, and lowers the barrier for others to install, adopt and contribute. The goal behind all of it: Derive becomes the standard, widely adopted way to learn in the age of AI.

## Core Value

A learner can sit down with any model they have access to and be taught the Derive way: the dependency graph, the understanding gate, the review loop, with nothing lost between providers.

**Simplicity rule (binding on every phase):** one screen, one next step. The default UI shows the lesson and what to do next; everything else lives behind Settings. No feature ships without a one-sentence reason tied to learning better. Derive must not become cluttered; its essence, tips and workflow are the product.

## Requirements

### Validated

Inferred from the codebase map (`.planning/codebase/`, mapped at commit 7d7db1f). Shipped and relied upon.

- ✓ Lessons are dependency graphs: roots of unconditional truths, derived nodes, learner goal on top; a node is taught only when its dependencies are locked — existing
- ✓ Understanding gate: a node locks only after a fresh quiz passes; intuition/transfer checks; targeted remediation on failure — existing
- ✓ Spaced review: FSRS scheduling from correctness + confidence, warm-up on the forgetting curve at lesson start, cumulative quiz, implicit repetition and FIRe credit propagation — existing
- ✓ Two drivers share one record: the app runs turns on the Claude Agent SDK (Claude Code login) or the Codex SDK (ChatGPT login); the Claude Code plugin and Codex skills drive the same server over a stdio MCP proxy — existing
- ✓ 14 driver-independent tutor tools (quiz, ask, set_plan, explain_back, node_status, remember, set_preferences, material and library tools) with cards rendered in the browser and answerable from terminal or browser — existing
- ✓ Course materials: PDF/PPTX/DOCX/text extraction, repo and GitHub ingestion, read/search from within a lesson — existing
- ✓ Per-learner library: links, videos, papers, notes; fetch, search, suggest, save — existing
- ✓ Multiple learners per install, each with lessons, memory, preferences and review queue — existing
- ✓ Web UI (React 19, Vite, Tailwind 4): Home, Lesson with live graph, Atlas, Library, You; SSE event stream; voice mode — existing
- ✓ Obsidian vault mirror of lessons as Markdown with callouts — existing
- ✓ Local-only storage in one SQLite file under `~/.derive`; no API key, no per-token bill on the subscription paths — existing
- ✓ `pnpm check` preflight doctor, CI (typecheck, build, test), release workflow — existing
- ✓ The tool contract (schemas, descriptions, HTTP action validation) and the teaching method text are each defined once and shared by every driver — Phase 1
- ✓ Every driver runs behind one driver interface and one event sink, so a new provider changes neither the web UI, the SSE stream, nor the terminal mirrors — Phase 1
- ✓ Schema changes run through a numbered, transactional migration runner; existing databases migrate forward and are snapshotted first — Phase 1
- ✓ A per-turn token/cost ledger (`turns`, `usage`) written by the sink on every driver, never estimated — Phase 1
- ✓ The local server binds loopback, checks Host and Origin, requires a per-install token, and redacts secrets from every error, log, event and export before any key is stored — Phase 1
- ✓ Learner picks provider and model on a settings page in the app: ten rows in three groups, logins and local servers detected on open and on rescan, one masked key per provider in a 0600 file the API never echoes, model list fetched with a manual fallback, connection tested with the provider's real failure sentence, and the active provider visible in the lesson header and the plugin start message — Phase 2 (SET-01..06)
- ✓ Learner can run the tutor on a pay-per-use API key — Anthropic, OpenAI or Google Gemini — through Derive's own agent loop; the Claude Code plugin stays the Anthropic subscription route — Phase 3 (PROV-01..03)
- ✓ Learner can run the tutor through OpenRouter, with the gateway's own per-response cost recorded, or through any OpenAI-compatible endpoint by entering a base URL and key — Phase 3 (PROV-04, PROV-05)
- ✓ Parity on the owned loop: the same tutor tools, the same method text, sequential tool execution, resume after an interruption, retries behind a visible "provider busy" status, web search on every path (provider-native where it exists, else Tavily or SearXNG), and tool schemas projected per provider dialect and validated in CI — Phase 3 (PROV-08..10). The local paths and the nightly conformance harness that *proves* parity are Phase 4 (PROV-06/07, PROV-13)
- ✓ Learner sees what each lesson cost in the lesson header and on Home, labelled billed, estimated or not billed, priced from a dated table the learner can override locally — Phase 3 (COST-02, COST-04)
- ✓ A learner's model override is stored per provider, so switching providers no longer hands one provider's model id to another — Phase 3, closing Phase 2's 02-REVIEW WR-01
- ✓ Learner can run the tutor on a local model — Ollama, LM Studio or llama.cpp — free and offline, with the context window sized so the method is never silently truncated and a capability probe that refuses clearly when tool calling is unsupported — Phase 4 (PROV-06, PROV-07)
- ✓ Learner can prove a chosen model runs the method before investing a session: a "test teaching" press on the provider row teaches one node and grades one real quiz server-side, and a nightly conformance harness replays a scripted lesson per provider and asserts the gate, pretest and cumulative quiz held — Phase 4 (PROV-11, PROV-13)
- ✓ Learner sees a usage page reached from Settings: a running total per learner by provider, model and lesson, with tokens-only lines wherever there is no money — Phase 4 (COST-03), completing the half Phase 3 started

### Active

Provider layer

- [ ] Learner can run the tutor on additional CLI subscriptions they already pay for (Gemini CLI, GitHub Copilot, other agent CLIs)

Learning experience

- [ ] Method quality: better graphs, sharper quizzes, tighter remediation, stronger warm-ups and reviews
- [ ] Less friction in the flow: fewer clicks, faster turns, clearer cards, less waiting, better voice mode
- [ ] Progress: a due-review count, honest retention stats, and an atlas coloured by memory stability so growth is visible
- [ ] The learner learns in the optimal way with the least effort; the tutor carries the workflow, not the learner

Personalization (style only; the method is fixed)

- [ ] Theme: light / dark / system plus accent palettes, per learner
- [ ] Typography: font family and size, including a dyslexia-friendly option
- [ ] A focus mode that hides everything but the current card
- [ ] Tutor tone (plain, warm, dry) and language; the method does not change

Adoption

- [ ] One-command install: clone plus one command, or an npx-style runner; no desktop app needed
- [ ] Listed in plugin marketplaces: Claude Code plugin marketplace, Codex skills, others as they exist
- [ ] Docs and community: docs site, landing page, contributor guide, public roadmap, examples

### Out of Scope

- Hosted / SaaS version — learner data stays on the learner's machine; a hosted product is a different business and a later decision
- Desktop app packaging (Electron, Tauri, brew cask) — a clone-and-run install is enough for this milestone
- Changing the teaching method or its workflow to suit weaker models — parity means the method stays; a weak model simply teaches worse
- Per-lesson model switching UI — one provider/model setting per install or learner is enough; tiered roles are a later refinement
- Tiered roles (strong model plans, cheap model explains) — considered; deferred until the single-provider loop is solid
- Copilot and Gemini CLI drivers — deferred to v2; API keys, gateways and local models cover most learners, and both SDKs are medium-confidence
- Streaks, daily goals, reminders, budgets, cost-per-node analytics, capability badges, density and panel-position settings, voice picker — moved to v2 on 2026-09-17 under the simplicity rule; each read as a feature for its own sake

## Context

- **Existing system**: TypeScript throughout. Hono server (`server/src`) with node:sqlite storage; React web app (`web/src`); Claude Code plugin (`plugin/`); Codex skills (`codex/`). Full map in `.planning/codebase/` (ARCHITECTURE, STACK, STRUCTURE, CONVENTIONS, TESTING, INTEGRATIONS, CONCERNS).
- **How turns run today**: three paths behind one driver seam. `server/src/agent.ts` runs a turn as an Agent SDK `query()` on a Claude Code login; `server/src/codex.ts` runs it as a Codex thread on a ChatGPT login; and since Phase 3 `server/src/drivers/api.ts` runs Derive's *own* agent loop over the AI SDK for API keys and gateways (Anthropic, OpenAI, Gemini, OpenRouter, any OpenAI-compatible base URL), with per-dialect tool schemas, retries, orphan-patched resume and a cost ledger. Local models reuse that same loop in Phase 4.
- **Known debt on the path**: pending and held cards vanish on restart (Phase 5); `replaceGraph` and `deleteLesson` are not transactional; no linter. The tool contract and method text were consolidated in Phase 1 and are each defined once. Phase 3 left two advisory reports open — `03-REVIEW.md` (`issues_found`) and `03-UI-REVIEW.md` (15/24, chiefly the cost segment squeezing the lesson topic in the header and Home's rows overlapping at 375px). See `.planning/codebase/CONCERNS.md`.
- **Learning science**: the Math Academy-style mechanics (warm-up on the forgetting curve, understanding gate, cumulative quiz, FIRe credit, targeted remediation) live in `server/src/actions.ts`, `schedule.ts`, `db.ts` and are covered by the pnpm test suite.
- **Who it is for**: learners beyond the author, on providers the author does not use, in the browser and in the terminal. The essence, tips and workflow Derive has now must survive every change.

## Constraints

- **Tech stack**: TypeScript, Node >= 22.5, pnpm workspace, Hono, React 19, node:sqlite — the codebase is established; new providers are added inside it, not beside it
- **Local-first**: all learner data stays in `~/.derive`; keys are stored locally and never leave the machine except to the provider they belong to
- **Method fidelity**: provider work must not change what the tutor does; parity is measured against the Claude Code path
- **Compatibility**: the Claude Code plugin and Codex skills keep working through the migration; existing SQLite databases migrate forward
- **No hosted infrastructure**: nothing in this milestone requires a server the author runs for others

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Providers first, then learning UX, then style, then adoption | More providers unlocks more users immediately; the rest lands on a stable layer | — Pending |
| Full parity across providers (Derive owns its agent loop) | The method is the product; degrading it per provider would fork the experience | ✓ Shipped Phase 3 on the API-key and gateway paths; ✓ proven Phase 4 — the nightly conformance harness replays a scripted lesson per provider and asserts the gate, pretest and cumulative quiz held, reporting every unreached provider with its reason rather than reading healthy by omission |
| Settings page in the app for provider/model choice | Env-only is fine for the author, not for adoption; per-lesson choice is premature | ✓ Shipped Phase 2 — one page, ten rows, install-wide with a per-learner model override on /you |
| Per-lesson cost plus running total on pay-per-use | Learners paying per token must see what a lesson costs | ✓ Shipped — the per-lesson figure Phase 3 (header, Home), the running total Phase 4 (Usage page, by provider/model/lesson, tokens-only where there is no money) |
| Consolidate the tool contract and method text as part of the provider work | Every new driver would otherwise add a fourth copy | — Pending |
| Clone-and-run install, no desktop app, no hosted version | Author's call: what they can clone is fine for now | — Pending |
| Success = other people using it | Adoption is the measure, not the author's own use | — Pending |
| In-app Claude runs on an API key; the plugin is the subscription route | Anthropic's terms forbid Pro/Max login tokens in third-party tools including the Agent SDK | ✓ Shipped Phase 3 — the `anthropic` row teaches on a key, `claude-code` still teaches on the login |
| Copilot and Gemini CLI drivers deferred to v2 | Riskiest drivers; the owned loop plus OpenAI-compatible covers most of their value | — Pending |
| Simplicity rule: one screen, one next step; eight "just because" requirements moved to v2 | Owner's call on 2026-09-17: Derive must stay simple to use and understand | — Pending |
| A long model id scrolls inside its field rather than widening the page | Owner's call on 2026-10-01 closing Phase 2 UAT: /settings already behaved this way and was accepted there, so /you matches it instead of re-rhythming the form | ✓ Applied Phase 2 |
| Prices come from a dated table, and a table-priced lesson reads `estimated`, never `billed` | The five vendors' list prices were cross-checked against their own pages on 2026-10-06, but two of them are tiered or promotional, so a table figure is an estimate by construction; only a gateway's own per-response cost earns `billed` | ✓ Applied Phase 3 (COST-04) |
| A half-configured search fallback behaves as no search at all, not as the provider's own | A learner who picked Tavily and left the key empty must not be silently served a different search; the selection has to mean what it says | ✓ Applied Phase 3 (PROV-09) |
| PROV-08 ("full parity") earns its checkbox on the live-key run, not on the stub proof | Owner's call on 2026-10-12 closing Phase 3 UAT: the substance was stub-tested all through the phase, but "full parity" is a claim about real providers, so the marking waited for the three live-key lessons in UAT test 1 | ✓ Decided Phase 3 — flipped to Complete |
| Derive never fights the learner's own server configuration | A local server's context window, adapters and loaded model are the learner's settings; Derive reads them, tells Ollama the window it needs, and refuses clearly when a model cannot run the method — it does not rewrite the learner's setup | ✓ Applied Phase 4 (04-CONTEXT.md D-05) |
| The lesson refusal card is bounded at 62ch rather than inheriting the timeline column | Owner's call on 2026-10-22 closing Phase 4's gap 1: the locked UI-SPEC E2 row named the bound, so implement the spec rather than reword it. The card renders noticeably narrower than its neighbours, and that is the intended result | ✓ Applied Phase 4 (04-06) |
| A prohibition with no source gate is a claim with nothing behind it | Two Phase 4 prohibitions (the tool-rejection ledger must never reach the learner; no number may be formatted in the browser) held by inspection but nothing kept them true through the next edit. Each now has a gate that was seen failing with its subject planted before it was kept | ✓ Applied Phase 4 (04-06), per Rule 01-21 |
| A model id can be a file path, so Derive advises `--alias` rather than renaming what the server reports | Truncating or rewriting the id would make the lesson header, Usage page and exported note disagree with the learner's own server | ✓ Accepted risk R-04-04, Phase 4 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-10-22 after Phase 4*
