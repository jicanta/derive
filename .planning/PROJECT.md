# Derive

## What This Is

Derive is a local-first AI tutor that teaches from first principles: every lesson is a dependency graph from unconditional truths to the learner's goal, taught one node at a time, locked only when the learner passes a fresh question, then kept alive with spaced review (FSRS, warm-ups, cumulative quizzes). It runs as a local web app and inside the learner's terminal (Claude Code plugin, Codex skills), sharing one SQLite record per learner.

This milestone opens Derive to any model and any way of paying for it (subscriptions, API keys, OpenRouter-style gateways, local models), makes the learning experience as effective and low-effort as it can be, lets each learner style the app to their taste without changing the method, and lowers the barrier for others to install, adopt and contribute. The goal behind all of it: Derive becomes the standard, widely adopted way to learn in the age of AI.

## Core Value

A learner can sit down with any model they have access to and be taught the Derive way: the dependency graph, the understanding gate, the review loop, with nothing lost between providers.

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

### Active

Provider layer

- [ ] Learner can run the tutor on a pay-per-use API key: Anthropic, OpenAI, Google Gemini
- [ ] Learner can run the tutor through OpenRouter or any OpenAI-compatible endpoint (one base URL + key)
- [ ] Learner can run the tutor on a local model (Ollama, LM Studio, llama.cpp) with no cost and offline
- [ ] Learner can run the tutor on additional CLI subscriptions they already pay for (Gemini CLI, GitHub Copilot, other agent CLIs)
- [ ] Learner picks provider and model on a settings page in the app: paste a key or detect a login, choose a model; persisted
- [ ] Full parity across providers: the same tutor tools, the same method, web search via a pluggable search provider, on every path (Derive runs its own agent loop where the provider gives none)
- [ ] Learner sees per-lesson token counts and estimated cost, plus a running total on a usage page, on pay-per-use providers
- [ ] The tool contract (schemas, descriptions, HTTP action validation) and the teaching method text are each defined once and shared by every driver

Learning experience

- [ ] Method quality: better graphs, sharper quizzes, tighter remediation, stronger warm-ups and reviews
- [ ] Less friction in the flow: fewer clicks, faster turns, clearer cards, less waiting, better voice mode
- [ ] Progress and motivation: streaks, retention stats, an atlas that shows growth over time, review reminders
- [ ] The learner learns in the optimal way with the least effort; the tutor carries the workflow, not the learner

Personalization (style only; the method is fixed)

- [ ] Theme: light / dark / system plus accent palettes, per learner
- [ ] Typography: font family and size, including a dyslexia-friendly option
- [ ] Layout and density: card density, graph panel position, a focus mode that hides everything but the current card
- [ ] Tutor voice and tone: terse vs chatty, language, voice-mode voice; the method does not change

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

## Context

- **Existing system**: TypeScript throughout. Hono server (`server/src`) with node:sqlite storage; React web app (`web/src`); Claude Code plugin (`plugin/`); Codex skills (`codex/`). Full map in `.planning/codebase/` (ARCHITECTURE, STACK, STRUCTURE, CONVENTIONS, TESTING, INTEGRATIONS, CONCERNS).
- **How turns run today**: `server/src/agent.ts` runs a lesson turn as an Agent SDK `query()` with the tutor tools registered as an in-process MCP server; `server/src/codex.ts` runs it as a Codex thread with Derive's stdio MCP server attached. Both depend on the host CLI for the agent loop and for web tools. API-key, gateway and local providers need Derive's own loop.
- **Known debt on the path**: the tool contract is written three times (`agent.ts`, `mcp.ts`, the HTTP action switch in `index.ts`) and the method text twice (`prompt.ts`, `plugin/skills/teach/SKILL.md`); pending and held cards vanish on restart; `replaceGraph` and `deleteLesson` are not transactional; no linter. See `.planning/codebase/CONCERNS.md`.
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
| Full parity across providers (Derive owns its agent loop) | The method is the product; degrading it per provider would fork the experience | — Pending |
| Settings page in the app for provider/model choice | Env-only is fine for the author, not for adoption; per-lesson choice is premature | — Pending |
| Per-lesson cost plus running total on pay-per-use | Learners paying per token must see what a lesson costs | — Pending |
| Consolidate the tool contract and method text as part of the provider work | Every new driver would otherwise add a fourth copy | — Pending |
| Clone-and-run install, no desktop app, no hosted version | Author's call: what they can clone is fine for now | — Pending |
| Success = other people using it | Adoption is the measure, not the author's own use | — Pending |

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
*Last updated: 2026-09-17 after initialization*
