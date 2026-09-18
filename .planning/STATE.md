---
gsd_state_version: "1.0"
current_phase: 01
current_phase_name: Foundation
status: executing
stopped_at: Phase 1 context gathered
last_updated: "2026-09-17T23:58:25.027Z"
last_activity: 2026-09-17
last_activity_desc: Phase 01 execution started
state_head: d4e37d42c162e4492f659aae78b426e82dfccd6d
progress:
  total_phases: 7
  completed_phases: 0
  total_plans: 8
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-17)

**Core value:** A learner can sit down with any model they have access to and be taught the Derive way: the dependency graph, the understanding gate, the review loop, with nothing lost between providers.
**Simplicity rule (binding):** one screen, one next step. The default UI shows the lesson and what to do next; everything else lives behind Settings. No feature ships without a one-sentence reason tied to learning better.
**Current focus:** Phase 01 — Foundation

## Current Position

Phase: 01 (Foundation) — EXECUTING
Plan: 1 of 8
Status: Executing Phase 01
Last activity: 2026-09-17 — Phase 01 execution started

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: -
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: Provider block order is fixed — contract and method, then seam/sink/ledger/migrations/hardening (all Phase 1), then settings and secrets (2), then the owned loop on API keys and gateways (3), then local models with the parity harness (4); cost display follows the ledger (per-lesson in 3, usage page in 4)
- [Roadmap]: Copilot and Gemini CLI drivers deferred to v2; in-app Claude uses an API key through the owned loop, the Claude Code plugin stays the subscription route (verify Anthropic and Google terms at Phase 2)
- [Roadmap]: Personalization (Phase 6) is independent of the provider block and may run in parallel with Phases 3–5; adoption (Phase 7) is last so docs describe the finished thing
- [Roadmap]: Learning-experience method changes (Phase 5) land after the conformance harness (Phase 4) so they are measured on every provider
- [Roadmap revision]: Simplicity rule applied on 2026-09-17 — streaks, daily goals, reminders, budgets, cost-per-node units, cache-savings display, capability badges, density, panel position and the voice picker moved to v2 (COST-08..10, LEARN-16/17, PROV-18, STYLE-07/08); Phase 4 keeps the usage page as a running total only, Phase 5 keeps the due count and a stability-coloured Atlas, Phase 6 keeps theme, font, size, reduced motion, tone and language

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 2]: Anthropic consumer-OAuth policy and Gemini CLI third-party terms are MEDIUM confidence; re-verify before the settings page ships
- [Phase 3]: AI SDK 7 API shapes, OpenRouter per-response cost field path, and context compaction strategy are unverified in this repo
- [Phase 4]: No measurement yet of which local models pass the understanding gate; the harness produces the answer
- [Phase 7]: npm package name not yet reserved (`derive` is taken)

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-09-17T22:50:08.779Z
Stopped at: Phase 1 context gathered
Resume file: .planning/phases/01-foundation/01-CONTEXT.md
