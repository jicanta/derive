---
gsd_state_version: "1.0"
current_phase: 01
current_phase_name: Foundation
status: executing
stopped_at: Completed 01-07-PLAN.md
last_updated: "2026-09-18T12:58:50.132Z"
last_activity: 2026-09-18
last_activity_desc: Phase 01 execution resumed (wave continue)
state_head: 3be5f60dcd78336054cf743477274da07e937a21
progress:
  total_phases: 7
  completed_phases: 0
  total_plans: 8
  completed_plans: 7
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
Plan: 7 of 8
Status: Ready to execute
Last activity: 2026-09-18 — Phase 01 execution resumed (wave continue)

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
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P02 | 45 min | 3 tasks | 5 files |
| Phase 01 P03 | 70 min | 3 tasks | 26 files |
| Phase 01 P04 | 14 min | 3 tasks | 5 files |
| Phase 01 P05 | 17 min | 3 tasks | 4 files |
| Phase 01 P06 | 25 min | 3 tasks | 11 files |
| Phase 01 P07 | 18 min | 3 tasks | 17 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: Provider block order is fixed — contract and method, then seam/sink/ledger/migrations/hardening (all Phase 1), then settings and secrets (2), then the owned loop on API keys and gateways (3), then local models with the parity harness (4); cost display follows the ledger (per-lesson in 3, usage page in 4)
- [Roadmap]: Copilot and Gemini CLI drivers deferred to v2; in-app Claude uses an API key through the owned loop, the Claude Code plugin stays the subscription route (verify Anthropic and Google terms at Phase 2)
- [Roadmap]: Personalization (Phase 6) is independent of the provider block and may run in parallel with Phases 3–5; adoption (Phase 7) is last so docs describe the finished thing
- [Roadmap]: Learning-experience method changes (Phase 5) land after the conformance harness (Phase 4) so they are measured on every provider
- [Roadmap revision]: Simplicity rule applied on 2026-09-17 — streaks, daily goals, reminders, budgets, cost-per-node units, cache-savings display, capability badges, density, panel position and the voice picker moved to v2 (COST-08..10, LEARN-16/17, PROV-18, STYLE-07/08); Phase 4 keeps the usage page as a running total only, Phase 5 keeps the due count and a stability-coloured Atlas, Phase 6 keeps theme, font, size, reduced motion, tone and language
- [Phase 01]: Per-surface tool contract differences are declared in server/src/tools.ts under per_surface, and the wire-surface test asserts the declared set equals the shown set in both directions
- [Phase 01]: tools/list now emits registry declaration order; order is not the MCP contract, the tool set and every description are, and both are asserted against the pre-phase binary
- [Phase 01]: Method text: the canonical method is eleven Markdown sections under method/ plus four short per-surface preambles, rendered by pnpm method into six committed copies; pnpm method:check fails CI on any byte of drift
- [Phase 01]: The app surface leaves {{WEB_TOOLS}} unsubstituted at render time because the app runs on either backend; systemPrompt(backend) still substitutes it at runtime, now with replaceAll
- [Phase 01]: plugin/commands allowed-tools are projected from the registry in declaration order; the tool sets are unchanged (21 in learn.md, 15 in review.md, 22 on the mcp wire) and library stays excluded by name and reason
- [Phase 01]: Every driver runs behind Driver.runTurn(ctx, sink); the idempotent turn-end guard lives once in the sink (server/src/driver.ts), and a fake driver in server/src/drivers/fake.ts is the permanent proof that a new provider costs one runTurn and no change to the web app, the SSE stream or the terminal mirrors
- [Phase 01]: External lessons (mode 'external') stay outside the driver seam: they are driven by a terminal through the HTTP action route and the mirrors, and never reach runTurn
- [Phase 01]: Schema changes run through server/src/migrations.ts: numbered { version, name, up } entries on PRAGMA user_version, each applying inside a transaction that carries its own version bump; migration 1 is the old inline schema verbatim so an existing ~/.derive/derive.db and a fresh one converge on byte-identical DDL
- [Phase 01]: An existing database is snapshotted with VACUUM INTO as derive.db.bak-v<version left behind> before the first pending migration (WAL makes a raw file copy unsafe); a fresh database is never snapshotted and an existing snapshot is never overwritten
- [Phase 01]: withTx(fn) in server/src/db.ts is re-entrant via a depth counter, so deleteLearner looping over deleteLesson is one transaction; replaceGraph, deleteLesson and deleteLearner are now atomic
- [Phase 01]: The turns/usage column set was fixed as proposed: usage carries lesson, learner, driver and model denormalised, and recordUsage is the one write path that fills them from the turn
- [Phase 01]: Usage is a sink method, never an event, so the browser reducer, the SSE stream and the Obsidian mirror stay untouched
- [Phase 01]: A turn with no reported counts still gets a row: nulls and cost_source 'unknown', never an estimate
- [Phase 01]: The local server answers on 127.0.0.1 only behind a 0600 per-install token; /api/health is the one exemption, and Host plus a whole-string Origin allowlist close DNS rebinding and hostile pages
- [Phase 01]: Per D-09 the token is injected into the served index.html and read from the file by the MCP server, the plugin hook and the Vite dev proxy; no endpoint hands it out, and the stream route is the only place it may ride in the query string because EventSource cannot set a header
- [Phase 01]: Per D-12 DERIVE_HOST past loopback is an explicit opt-in that prints one loud startup warning and weakens no check; DERIVE_ORIGINS extends the browser allowlist
- [Phase 01]: VERSION is read once from server/package.json in server/src/config.ts and replaces five literals; root and server manifests now match plugin.json at 0.4.0, and @anthropic-ai/claude-agent-sdk is pinned to ^0.3.261 with the resolved version unchanged

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

Last session: 2026-09-18T12:58:37.474Z
Stopped at: Completed 01-07-PLAN.md
Resume file: None
