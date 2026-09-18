---
phase: 01-foundation
plan: 04
subsystem: infra
tags: [driver-seam, event-sink, claude-agent-sdk, codex-sdk, sse, node-test]

# Dependency graph
requires:
  - phase: 01-01
    provides: the tool registry (`toolsFor`/`descriptionFor`/`shapeFor`) the Claude driver builds its in-process tools from
  - phase: 01-03
    provides: the generated method text behind `systemPrompt(backend)`, which `runTurn` still assembles into `ctx.instructions`
provides:
  - "`server/src/driver.ts`: the `Driver.runTurn(ctx, sink)` interface, `TurnContext`, `EventSink`, `Active`, `sinkFor` and the test-only driver override"
  - "one idempotent turn-end guard for the whole codebase, living in `sinkFor`"
  - "`claudeDriver` (server/src/agent.ts) and `codexDriver` (server/src/codex.ts): both real paths behind the same interface, with no hidden module state"
  - "`server/src/drivers/fake.ts`: a permanent, SDK-free test fixture that scripts sink calls"
  - "`runTurn` reduced to shared bookkeeping plus one driver dispatch in one try/finally"
  - "`server/test/driver.test.ts`: four model-free cases over a whole turn"
affects: [01-06 usage ledger, 01-08 redaction, Phase 3 owned agent loop, Phase 4 parity harness]

actuals:
  tokens: 8100
  tasks: 3
  commits: 3
plan_head_before: 395f18249ae5b594f3f93645be34b94835ab9d6f

tech-stack:
  added: []
  patterns:
    - "Driver seam: a provider implements `runTurn(ctx, sink)` and reports through one sink; no new event type, no UI change"
    - "Test-only injection through a module-level override that no route, header, env var or config can reach"
    - "A permanent fake driver as the fixture that makes the whole turn path testable with no model, login or network"

key-files:
  created:
    - server/src/driver.ts
    - server/src/drivers/fake.ts
    - server/test/driver.test.ts
  modified:
    - server/src/agent.ts
    - server/src/codex.ts

key-decisions:
  - "The sink owns the idempotent `endTurn`, so the two per-driver copies of the guard became one and no driver can emit a second `turn_end`"
  - "`runTurn`'s finally calls `sink.endTurn` as well, so a driver that reports nothing at all still produces exactly one `turn_start` and one `turn_end`"
  - "The Claude and Codex drivers stay in `agent.ts` and `codex.ts` rather than moving under `drivers/`, because moving them would make `backend.ts` import `agent.ts` and close an import cycle"
  - "`Active` moved to `driver.ts` and is re-exported from `codex.ts`, so no existing import broke"
  - "External lessons (`mode: 'external'`) stay outside the seam — confirmed by reading every `runTurn` call site"

patterns-established:
  - "EventSink: emit / emitUpdate / checkpoint / emitEphemeral, exactly events.ts's vocabulary, plus setSessionId and one idempotent endTurn"
  - "TurnContext carries every input a driver reads, including `isStopping()` and `onActive()`, so a driver has no hidden module state"

requirements-completed: [FOUND-03]

coverage:
  - id: D1
    description: "Every driver runs behind one `Driver.runTurn(ctx, sink)` interface; `runTurn` has a single dispatch and a single try/finally"
    requirement: FOUND-03
    verification:
      - kind: unit
        ref: "server/test/driver.test.ts#persists and fans out the scripted sequence, in call order"
        status: pass
      - kind: other
        ref: "grep -c 'runTurn(ctx, sink)' server/src/agent.ts -> exactly one dispatch call site"
        status: pass
    human_judgment: false
  - id: D2
    description: "The sink is events.ts's existing vocabulary plus a session-id write and one idempotent endTurn; no new event type reaches the stream"
    requirement: FOUND-03
    verification:
      - kind: unit
        ref: "server/test/driver.test.ts#persists and fans out the scripted sequence, in call order (asserts every persisted type is in the EVENT_TYPES list copied from web/src/lib/useLesson.ts)"
        status: pass
      - kind: other
        ref: "git diff --quiet -- web/ (exit 0)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A turn ends exactly once however many times its driver ends it, and a driver that reports nothing still produces one turn_start and one turn_end"
    requirement: FOUND-03
    verification:
      - kind: unit
        ref: "server/test/driver.test.ts#ends the turn once however many times the driver ends it"
        status: pass
      - kind: unit
        ref: "server/test/driver.test.ts#still opens and closes the turn for a driver that reports nothing"
        status: pass
    human_judgment: false
  - id: D4
    description: "A third driver costs one runTurn and nothing else — proved by a driver defined inline in the test and by the permanent fake fixture"
    requirement: FOUND-03
    verification:
      - kind: unit
        ref: "server/test/driver.test.ts#adding a driver takes one runTurn and nothing else"
        status: pass
    human_judgment: false
  - id: D5
    description: "The Claude and Codex paths behave exactly as before behind the seam — same events, same order, same payloads"
    requirement: FOUND-03
    verification:
      - kind: integration
        ref: "pnpm build && pnpm test — 42 pass / 0 fail, including server/test/api.test.ts and server/test/mcp.test.ts"
        status: pass
    human_judgment: true
    rationale: "The automated suite drives the external lesson path with no model, so it proves nothing broke around the drivers but does not run a real Claude or Codex turn. Phase-level parity (a lesson through the plugin and a lesson through Codex both complete as before) is the documented manual run named in 01-CONTEXT.md."

duration: 14 min
completed: 2026-09-18
status: complete
---

# Phase 01 Plan 04: The Driver Seam Summary

**Every way of running a lesson turn now implements `Driver.runTurn(ctx, sink)` and reports through one event sink, so a third driver — proved by a fake one that touches no SDK — costs one function and no change to the web app, the SSE stream or the terminal mirrors.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-09-18T11:42:30Z
- **Completed:** 2026-09-18T11:57:00Z
- **Tasks:** 3 of 3
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments

- `server/src/driver.ts` defines the whole seam: `Driver`, `TurnContext`, `EventSink`, `Active`, `sinkFor(lessonId)` and the test-only driver override. The sink is exactly `server/src/events.ts`'s four verbs plus a session-id write and one `endTurn` — no event type was added anywhere, which is what keeps `web/src/lib/useLesson.ts` untouched.
- The idempotent turn-end guard, previously duplicated in `agent.ts` and `codex.ts`, now exists once, inside `sinkFor`. No driver can emit a second `turn_end`, and `runTurn`'s own `finally` closes a turn its driver never closed.
- `claudeDriver` and `codexDriver` are exported `Driver`s reading every input off `ctx` (prompt, instructions, model, effort, resume session id, `isStopping()`, `onActive()`). Neither driver body touches the `active` or `stopping` maps; those stayed in `agent.ts` where the turn bookkeeping lives.
- `runTurn` is now bookkeeping plus one line of dispatch — `driverOverride() ?? (backend() === 'codex' ? codexDriver : claudeDriver)` — awaited in a single try/finally. The duplicated codex teardown is gone.
- `server/src/drivers/fake.ts` is a permanent fixture: a discriminated union of sink calls (block start/grow/end, status, session id, turn end) replayed through the sink, with no SDK import and no I/O.
- `server/test/driver.test.ts` drives four whole turns with no model, no login and no network, asserting the persisted sequence, the live sequence seen through `subscribe`, strictly increasing `seq`, exactly one `turn_start` and one `turn_end`, and membership in an `EVENT_TYPES` list copied verbatim from `web/src/lib/useLesson.ts`.

## Task Commits

Each task was committed atomically:

1. **Task 1: the seam and a fake driver running one whole turn end to end** - `7633d09` (feat)
2. **Task 2: the Claude path becomes a Driver reporting through the sink** - `646451c` (refactor)
3. **Task 3: the Codex path becomes a Driver, and runTurn becomes one dispatch** - `ca954e4` (refactor)

## Files Created/Modified

- `server/src/driver.ts` (new, 112 lines) — the interface, the context, the sink, `sinkFor` with the single turn-end guard, and `setDriverOverride`/`driverOverride`.
- `server/src/drivers/fake.ts` (new, 80 lines) — the `FakeStep` union, `setFakeScript` and `fakeDriver`; imports only types from `../driver.js`.
- `server/test/driver.test.ts` (new, 122 lines) — four cases: the scripted turn, the double end, the silent driver, and the inline driver stating the criterion.
- `server/src/agent.ts` — `claudeDriver` now holds the SDK query, the streaming block state, `flushBlock`, the `SDKMessage` switch and the catch/finally; `runTurn` keeps the echo, `turn_start`, notices, instruction assembly, the maps and `cancelPending`, then dispatches once.
- `server/src/codex.ts` — `runCodexTurn` became `codexDriver.runTurn(ctx, sink)`; `Active` now comes from `driver.ts` and is re-exported here.

## Decisions Made

- **The guard belongs to the sink, not the driver.** Both drivers kept their own `ended` boolean. Hoisting it into `sinkFor` is what makes "exactly one `turn_end`" a property of the seam rather than a convention each driver has to remember.
- **`runTurn`'s finally also ends the turn.** Otherwise the must-have "a driver that reports nothing still produces one `turn_end`" would only hold for drivers that remembered to. The guard makes the extra call free.
- **Where the drivers live.** The planner's recorded assumption held: moving `claudeDriver`/`codexDriver` under `drivers/` would force `backend.ts` to import `agent.ts`, which already imports `backend.ts`. Only the fake is new, so only the fake lives under `drivers/`.
- **`cwd: DATA_DIR` stayed a config constant, not a `ctx` field.** `TurnContext` carries per-turn inputs; `DATA_DIR` is an immutable config constant that `codex.ts` already reads the same way. "No hidden inputs" is about mutable module state (`active`, `stopping`, the lesson row), and none of that is left in either driver body.
- **The `active` map is still only written by a driver's `onActive` call.** `isBusy` therefore reads false during the window between `turn_start` and the driver registering, exactly as before. Closing that window would have changed `interrupt()`'s behaviour, and the plan's must-have says "exactly as before".

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] `buildTools` read the registry off `spec.description` / `spec.shape` instead of through its accessors**

- **Found during:** Task 2 (the Claude path becomes a Driver)
- **Issue:** Wave 2's plan 01-02 made a tool's description and input shape surface-dependent (`ToolSpec.per_surface`) and added `descriptionFor` / `shapeFor`. `server/src/agent.ts` `buildTools` still read the raw fields. No `agent:` entry exists under `per_surface` today, so the projection is currently identical — but the first one declared would be silently ignored on the agent surface, which is exactly the drift the registry exists to prevent. The wave context for this plan states the rule outright: go through the accessors, never off `spec.description` or `spec.shape`.
- **Fix:** `buildTools` now calls `descriptionFor(spec, 'agent')` and `shapeFor(spec, 'agent')`, with the module comment saying why.
- **Files modified:** `server/src/agent.ts`
- **Verification:** `pnpm typecheck` clean; `server/test/wire-surface.test.ts` (11 cases, which freeze the agent-surface projection) still passes; full suite 42 pass / 0 fail.
- **Committed in:** `646451c` (part of the Task 2 commit)

**2. [Rule 2 - Missing critical] A driver throwing before it reported anything left the turn open and the lesson busy**

- **Found during:** Task 1 (the seam)
- **Issue:** In the old code `query()` was called outside the try/finally, so a throw from constructing the SDK query would have left no `turn_end`, no `active.delete` and no `cancelPending` — the lesson would have read busy forever. The same hole existed for any driver-level throw.
- **Fix:** The single dispatch awaits the driver inside a try that ends the turn with `{ ok: false, error }` and rethrows (the call sites in `server/src/index.ts` already log through `.catch`), and a finally that ends the turn and clears the maps.
- **Files modified:** `server/src/agent.ts`
- **Verification:** `server/test/driver.test.ts#still opens and closes the turn for a driver that reports nothing` covers the silent case; the full suite is green.
- **Committed in:** `7633d09` and `ca954e4`

### Process deviation

**3. Committed directly to `main`.** `git.branching_strategy` is `"none"` in `.planning/config.json` and every GSD commit in this repo, including plans 01-01 through 01-03, is on `main`. This is the configured behaviour, recorded here the way plans 01-02 and 01-03 recorded it.

---

**Total deviations:** 2 auto-fixed (2 × Rule 2), plus 1 recorded process deviation.
**Impact on plan:** Both auto-fixes are correctness work inside files the plan already had me rewriting. No scope creep: no dependency was added, no manifest or lockfile changed, no UI control, panel or page was added, and nothing the tutor does or says to the learner changed.

## Threat Model Verification

| Threat ID | Disposition | Outcome |
|-----------|-------------|---------|
| T-04-01 | mitigate | `setDriverOverride` is referenced from exactly one place outside `driver.ts` and `agent.ts`: `server/test/driver.test.ts`. No route, header, environment variable or config file can set it; the production dispatch still reads `backend()`. Verified by `grep -rn "setDriverOverride\|driverOverride" server/src server/test plugin web scripts`. |
| T-04-02 | mitigate | The only idempotent turn-end guard in `server/src` is in `driver.ts` (`grep -rn "let ended" server/src` returns one hit). `sink.endTurn` appears 7× in `agent.ts` and 6× in `codex.ts`; no bare `emit(..., 'turn_end', ...)` remains in either driver. |
| T-04-03 | transfer | Every driver's output now passes through `sinkFor`, which is the single chokepoint plan 01-08 wires redaction into. Nothing else to do here. |
| T-04-04 | accept | Unchanged: the SDK timeouts and the learner's Stop are still the controls, and `interrupt()` still works through the handle a driver registers with `ctx.onActive`. |
| T-04-05 | mitigate | `runTurn`'s finally plus the sink's guard make exactly one `turn_end` unconditional; asserted for a driver that reports nothing at all. |
| T-04-SC | mitigate | No dependency added. `git diff --stat 395f1824..HEAD -- package.json server/package.json web/package.json pnpm-lock.yaml` is empty. |

## Verification Results

| Check | Result |
|-------|--------|
| `pnpm typecheck` | clean, no `error TS` |
| `pnpm build && pnpm test` | **42 pass / 0 fail** (was 38 before this plan; +4 new cases) |
| `git diff --quiet -- web/` | exit 0 after every task — `EVENT_TYPES` and `applyEvent` needed no change |
| `grep -c "sink.endTurn" server/src/agent.ts server/src/codex.ts` | 7 and 6 — neither driver ends a turn by hand |
| One idempotent turn-end guard, in `driver.ts` | confirmed (`grep -rn "let ended" server/src` → 1 hit) |
| One `await driver.runTurn(ctx, sink)` in `runTurn` | confirmed (`server/src/agent.ts:243`) |
| `fake.ts` imports no SDK | confirmed (`grep -v` comment lines then `grep -c "sdk"` → 0) |

### `runTurn` call sites (the external-lesson check)

A lesson with `mode: 'external'` never reaches `runTurn`. All four call sites are in `server/src/index.ts`:

1. **`:174`** `POST /api/lessons` — the lesson was just created by `createLesson(...)` with no `mode`, which defaults to `'agent'`.
2. **`:244`** `POST /api/lessons/:id/message` — guarded: the handler returns at `:223-231` when `lesson.mode === 'external'` (the note is logged or answers the open card, and the terminal keeps the conversation).
3. **`:306`** `announceMaterials` — guarded explicitly: `if (lesson.mode === 'agent' && !isBusy(lesson.id))`, else the prompt becomes a notice.
4. **`:473`** `POST /api/review` — calls `startReview(learnerOf(c))` with no options, so the review lesson is created in `'agent'` mode. The external review at `:522` passes `{ mode: 'external', ... }` and deliberately does **not** call `runTurn`.

## Issues Encountered

None. The suite was green at 38 pass before the plan and green at 42 pass after every task.

## Self-Check: PASSED

- `server/src/driver.ts` — FOUND
- `server/src/drivers/fake.ts` — FOUND
- `server/test/driver.test.ts` — FOUND
- commit `7633d09` — FOUND
- commit `646451c` — FOUND
- commit `ca954e4` — FOUND

## Known Stubs

None. `server/src/drivers/fake.ts` is a scripted test driver, not a stub: it is a permanent, documented fixture that exists to prove the seam, and it is never reachable from a production code path (nothing outside `server/test/` calls `setDriverOverride`).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **01-06 (usage ledger)** has the anchor it needs: one dispatch and one sink per turn, so a `turns` row can be opened where `turn_start` is emitted and a usage row written per model request from inside each driver.
- **01-08 (redaction)** has its chokepoint: `sinkFor` in `server/src/driver.ts` is the single place every driver's text crosses into the event log, the export and the vault mirror.
- **Phase 3 (the owned agent loop)** plugs in as a third `Driver` with no change to the web app, the SSE stream or the terminal mirrors; `server/src/drivers/fake.ts` is the worked example of what that costs.
- **Concern for the phase verifier:** the parity check that needs a real model and a real login — a lesson through the Claude Code plugin and a lesson through Codex both completing as before — remains the documented manual run named in `01-CONTEXT.md`. Nothing automated in this plan can stand in for it.

---
*Phase: 01-foundation*
*Completed: 2026-09-18*
