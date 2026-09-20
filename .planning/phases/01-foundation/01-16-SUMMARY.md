---
phase: 01-foundation
plan: 16
subsystem: testing
tags: [node-test, spawn, ports, config, validation, hono]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: the built server (server/dist/index.js), the install-token file, guardLocal's Host-and-port check, the wire-surface fixture and the modelless stdio smoke test
provides:
  - server/test/spawn.ts — one shared, OS-allocated, retrying way to start a Derive server in a test
  - four suites (api, security, mcp, usage) converted to it; no file under server/test/ picks a port by arithmetic on a random number
  - PORT validated at import time, so guardLocal never compares a Host port against the string NaN
  - five consecutive clean `pnpm test` runs as recorded evidence that FOUND-04's machine half is deterministic
affects: [01-17, 01-18, 01-19, phase-verification, any future plan that proves a fix with pnpm test]

actuals:
  tokens: 16330
  tasks: 3
  commits: 3
plan_head_before: 4fefd04ce42f33012736fbbdfed9010f8350e8ae

tech-stack:
  added: []
  patterns:
    - "One test-only helper module (server/test/spawn.ts) owns every server spawn; it is deliberately not named *.test.ts so the runner's test/*.test.ts glob never executes it"
    - "Ports come from the OS (net.listen(0)) and are passed to the child as PORT, never chosen by the child, because guardLocal compares the Host header's port against String(PORT)"
    - "A bounded retry must still fail loudly: the throw carries the attempt count and the child's own error line"

key-files:
  created:
    - server/test/spawn.ts
  modified:
    - server/test/api.test.ts
    - server/test/security.test.ts
    - server/test/mcp.test.ts
    - server/test/usage.test.ts
    - server/src/config.ts

key-decisions:
  - "The port is allocated by the OS in the parent (net.listen(0) on 127.0.0.1) and handed to the child as PORT, rather than spawning with PORT=0 and reading the chosen port off stdout as IN-05 offered: guardLocal compares the Host header's port against String(PORT), the configured value, so a port the child picked for itself would 403 every request"
  - "The spawn retry is bounded at SPAWN_ATTEMPTS=5 and each attempt aborts the moment the child exits, so a genuinely dead server fails in about a second instead of being hidden behind a retry or a 20-second deadline"
  - "The thrown message reports the first stderr line naming an error rather than the literal last line, because Node ends a crash with its own version banner and 'Node.js v22.22.2' is not a diagnosis"
  - "PORT=0 is refused along with everything else: this server is addressed by the port in the Host header, so a port the process did not choose cannot be named by a client"
  - "server/test/usage.test.ts held a fourth copy of the same racy spawn that 01-REVIEW.md IN-05 did not name; it was converted too, because the plan's own verification requires zero Math.random under server/test/"

patterns-established:
  - "Spawn-a-server-in-a-test: import startDeriveServer from ./spawn.js, destructure { child, port, base, dataDir }, read the token from join(dataDir, 'token')"
  - "A case that tests a child exiting at startup spawns directly and says why in a comment, because the shared helper exists to retry exactly that"

requirements-completed: [FOUND-04, FOUND-06]

coverage:
  - id: D1
    description: "A single `pnpm test` exits 0 on its first invocation; five consecutive invocations each report `# fail 0`, `# pass 161` and zero cancelled subtests, so FOUND-04's machine half (the wire-surface snapshot and the modelless stdio smoke test) is evidence rather than a coin flip"
    requirement: FOUND-04
    verification:
      - kind: integration
        ref: "pnpm test (whole suite, run five consecutive times)"
        status: pass
    human_judgment: false
  - id: D2
    description: "No file under server/test/ chooses a server port by arithmetic on a random number; every spawned server is given a port the OS has just confirmed free"
    requirement: FOUND-04
    verification:
      - kind: other
        ref: "grep -rc 'Math.random' server/test/ — 0 for every file"
        status: pass
    human_judgment: false
  - id: D3
    description: "A spawn that fails for a reason other than a busy port still fails, and says so: after its attempts are exhausted the helper throws a lowercase sentence carrying the attempt count and the child's own error line"
    verification:
      - kind: manual_procedural
        ref: "hand-driven startDeriveServer('.../dist/does-not-exist.js') — threw in 1080 ms with 'the derive server did not start in 5 attempts: Error: Cannot find module ...'"
        status: pass
    human_judgment: false
  - id: D4
    description: "A PORT that is not a port number stops the server at import time with a lowercase sentence naming the value, instead of binding and then refusing every request 403 because guardLocal compares against the string NaN (D-12, 01-REVIEW.md IN-06)"
    requirement: FOUND-06
    verification:
      - kind: integration
        ref: "server/test/security.test.ts#a PORT that is not a port > stops the server at startup, naming the value it was given"
        status: pass
      - kind: integration
        ref: "server/test/security.test.ts#a PORT that is not a port > refuses a port out of range and the one the process would not have chosen"
        status: pass
      - kind: manual_procedural
        ref: "PORT=abc|70000|0 node server/dist/index.js — exit 1 with the sentence and no startup line; PORT=4310 still starts and /api/health answers 200"
        status: pass
    human_judgment: false
  - id: D5
    description: "The three suites that spawn a server read their port from one shared helper rather than three copies of the same wait loop (backstop truth)"
    verification:
      - kind: other
        ref: "grep -c 'startDeriveServer' on api.test.ts, security.test.ts, mcp.test.ts, usage.test.ts — each >= 1; no inline health loop remains"
        status: pass
    human_judgment: false
  - id: D6
    description: "HC-2, FOUND-04's human half — one real lesson through the Claude Code plugin and one through the Codex derive-learn skill"
    requirement: FOUND-04
    verification: []
    human_judgment: true
    rationale: "Requires a model and a provider login. mcp.test.ts drives the identical stdio wire with no model and is green, but cannot exercise a model's own tool selection, the transcript hook or the Codex rollout mirror. This plan does not close it and no gate in it may be read as closing it."

# Metrics
duration: 10 min
completed: 2026-09-20
status: complete
---

# Phase 01 Plan 16: A Deterministic Suite, and a PORT That Is a Port Summary

**One OS-allocated, fail-fast spawn helper replaces four copies of a racy 20-second wait loop, and `PORT` is validated at import time so `guardLocal` never compares a Host port against the string `NaN`.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-09-20T11:14:16Z
- **Completed:** 2026-09-20T11:24:56Z
- **Tasks:** 3
- **Files modified:** 6 (1 created, 5 modified)

## Accomplishments

- `server/test/spawn.ts`: `freePort()` takes a port the operating system has just confirmed free (`net.listen(0, '127.0.0.1')`), and `startDeriveServer()` is the one spawn path — it aborts the health poll the moment the child exits and retries on a fresh port, bounded at `SPAWN_ATTEMPTS = 5`.
- Four suites converted (`api`, `security` ×2 sites, `mcp`, `usage`). `grep -rc 'Math.random' server/test/` now reports `0` for every file; it reported `1`, `2`, `1` and `1` on the tree this plan started from.
- The retry does not hide a real failure: with a nonexistent entry the helper threw in **1080 ms** — not 100 s — with `the derive server did not start in 5 attempts: Error: Cannot find module '/home/jicanta/derive/server/dist/does-not-exist.js'`.
- `PORT` is validated in `server/src/config.ts` as a whole number in 1..65535 and throws a lowercase sentence naming the value, so the process refuses to start instead of binding and then 403ing everything (01-REVIEW.md IN-06).
- Two new cases drive that refusal over three values rather than asserting it from the source; the suite went from 159 to 161 passing tests.

## Five consecutive `pnpm test` runs (the evidence for the gap)

Run after all three tasks, on the final tree:

```
RUN 1: # tests 161 # pass 161 # fail 0 # cancelled 0 # skipped 0
RUN 2: # tests 161 # pass 161 # fail 0 # cancelled 0 # skipped 0
RUN 3: # tests 161 # pass 161 # fail 0 # cancelled 0 # skipped 0
RUN 4: # tests 161 # pass 161 # fail 0 # cancelled 0 # skipped 0
RUN 5: # tests 161 # pass 161 # fail 0 # cancelled 0 # skipped 0
```

Task 1 additionally recorded five consecutive clean `test/api.test.ts` runs (`# pass 14 # fail 0 # cancelled 0` each), and Task 2 five consecutive clean whole-suite runs at 159 before the two new cases landed.

## Task Commits

1. **Task 1 (tracer): one shared spawn helper, and api.test.ts on it end to end** — `30a2513` (test)
2. **Task 2: the security, MCP and usage suites on the same helper** — `8550d1d` (test)
3. **Task 3: a PORT that is not a port stops the server** — `449d942` (fix)

**Plan metadata:** see the `docs(01-16)` commit that carries this file.

## Files Created/Modified

- `server/test/spawn.ts` — created. `SPAWN_ATTEMPTS`, `freePort()`, `startDeriveServer()`, `SpawnedServer`, and a private `reason()` that picks the child's error line out of stderr. Named exports only; deliberately not `*.test.ts`, so the runner's `test/*.test.ts` glob never runs it (confirmed, not assumed).
- `server/test/api.test.ts` — the `before` hook is three lines; the port arithmetic, the inline `spawn`, the 20-second loop and the `server did not start` throw are gone. Every assertion unchanged.
- `server/test/security.test.ts` — `startServer(env)` keeps its shape and its `tokenPath`/`token` fields and is now one `startDeriveServer` call; the `a widened bind` block names no port at all. Adds the `a PORT that is not a port` describe block.
- `server/test/mcp.test.ts` — server spawn from the helper; the MCP child takes `DERIVE_URL` from the returned `base` and keeps its own `spawn` (it binds nothing).
- `server/test/usage.test.ts` — the fourth spawn site, not named by the review, converted the same way.
- `server/src/config.ts` — `readPort()` plus the validated `PORT` export; `PORT`'s doc now names the coupling to `guardLocal`. Nothing else in the file changed.

## Decisions Made

- **The parent allocates, the child is told.** IN-05 offered `PORT=0` + read the port off stdout. That would have broken `guardLocal`: `server/src/index.ts:206` compares the Host header's port against `String(PORT)`, the *configured* value, so a port the child chose for itself would 403 every request. `freePort()` in the parent keeps the configured value real. A `//` line in `startDeriveServer` records this so the next reader does not "simplify" it back.
- **Abort on exit, not on deadline.** The poll loop is `while (!exited && Date.now() < deadline)`. IN-05's twenty seconds were spent waiting on a child that was already gone; the exit flag is the half of the fix that makes a retry cheap enough to be worth having.
- **`PORT=0` is refused.** A port the process did not choose cannot be named in a Host header, so it is not a usable value for this server even though it is a legal `listen()` argument.
- **The doc says what the code does.** `PORT`'s comment names the `guardLocal` coupling and the reason the range is closed rather than open, per this plan's first prohibition.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] The thrown spawn failure reported Node's version banner instead of the cause**

- **Found during:** Task 1, at the hand-driven acceptance criterion.
- **Issue:** The plan specified "the last non-empty line of the child's stderr". Node ends a crash with its own `Node.js v22.22.2` banner, so the first hand-drive produced `the derive server did not start in 5 attempts: Node.js v22.22.2` — literally compliant and diagnostically worthless. That is precisely the failure this plan's prohibition names ("a retry that hides a server which cannot start is the same failure as a test that stops checking").
- **Fix:** Added a private `reason(stderr)` that drops Node's version banner and blank lines, then reports the first line matching `/error/i`, falling back to the last remaining line and finally to `it wrote nothing to stderr`. Its doc comment states exactly that rule.
- **Files modified:** `server/test/spawn.ts`
- **Verification:** Re-drove the failure path by hand — `elapsed_ms=1080`, `message=the derive server did not start in 5 attempts: Error: Cannot find module '/home/jicanta/derive/server/dist/does-not-exist.js'`.
- **Committed in:** `30a2513` (Task 1 commit)

**2. [Rule 2 - Missing Critical] A fourth racy spawn site the review did not name**

- **Found during:** Task 2, checking the plan's own `grep -rc 'Math.random' server/test/` criterion.
- **Issue:** `server/test/usage.test.ts:167` held a fourth copy of the same pattern — `4900 + Math.floor(Math.random() * 400)`, an inline `spawn`, and the same 20-second health loop. Its range overlapped `security.test.ts`'s old `4900..4990`, so it was an active contributor to the clash IN-05 describes. `01-REVIEW.md` names only `api.test.ts:53`, `security.test.ts:93`, `security.test.ts:258` and `mcp.test.ts:83`.
- **Fix:** Converted it to `startDeriveServer(entry)` exactly as the three named suites, and removed the imports it no longer needs.
- **Files modified:** `server/test/usage.test.ts`
- **Verification:** `grep -rc 'Math.random' server/test/` now reports `0` for every file, which the plan's own verification requires; `pnpm test` five consecutive clean runs.
- **Committed in:** `8550d1d` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 missing critical)
**Impact on plan:** Both were required for the plan's stated goal rather than additions to it — one makes the loud-failure guarantee real, the other closes the last spawn site the acceptance criteria measure. No scope creep; no production behaviour changed beyond the `PORT` validation Task 3 specifies.

## Issues Encountered

- **HEAD is on `main`, a protected/default branch.** The executor's per-commit assertion would normally refuse. GSD core's own `branching_strategy: none` arm (`execute-phase/steps/protected-branch.md`, #3552) specifies a warning rather than a refusal for exactly this configuration, and this project sets `git.branching_strategy: "none"` with all fifteen prior plans committed to `main`. The warning was printed before each of the three task commits and execution continued. No `git update-ref`, no force-rewind, no self-recovery of any kind.

## Threat Flags

None. No new network endpoint, auth path, file-access pattern or schema change. `server/test/spawn.ts` is test-only, unreachable from any route or from `server/src`, and excluded from the runner's glob (T-16-05, accepted in the plan's register). The plan added no dependency (T-16-SC): `node:net`, `node:child_process`, `node:fs` and `node:os` are built in.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `pnpm test` is now a gate that can be read: a red run means a regression, not a port clash. Plans 01-17, 01-18 and 01-19 each prove a security or data fix with `pnpm test`, and can now rely on it.
- **HC-1 (real-browser session smoke) and HC-2 (plugin + Codex parity run) remain outstanding, unchanged and unclaimed.** HC-2 is FOUND-04's human half; nothing in this plan closes it. `mcp.test.ts` drives the identical stdio wire with no model and is green, but cannot exercise a model's own tool selection, the transcript hook or the Codex rollout mirror.
- FOUND-04's machine half and FOUND-06's `PORT` half are closed; FOUND-06's remaining items (repo import, permissive polarity, credential handoff, cookie expiry) are covered by 01-17 and 01-19.

## Self-Check: PASSED

- `server/test/spawn.ts` exists on disk; the five modified files exist.
- Commits `30a2513`, `8550d1d`, `449d942` found in `git log --oneline --all`.
- `git rev-list --count 4fefd04..HEAD` = 3, matching the three task commits recorded above.
- `pnpm build` exit 0, `pnpm typecheck` exit 0, five consecutive `pnpm test` runs at `# fail 0 # pass 161 # cancelled 0`.

---
*Phase: 01-foundation*
*Completed: 2026-09-20*
