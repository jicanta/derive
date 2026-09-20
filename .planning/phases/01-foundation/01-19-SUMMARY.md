---
phase: 01-foundation
plan: 19
subsystem: infra
tags: [security, handoff-ticket, session-cookie, host-check, mcp, hono]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "01-09's derived session cookie and the document-route handoff; 01-14's guardLocal / hostNames address check; 01-16's server/test/spawn.ts helper"
  - phase: 01-foundation
    provides: "01-18's tree and test count, which this plan's BASE was measured from"
provides:
  - "POST /api/handoff — a one-use, sixty-second handoff ticket minted only for a caller that already holds the install token"
  - "server/src/tickets.ts — mintTicket/redeemTicket with an injectable `now`, so the expiry is driven rather than waited out"
  - "A shell-free browser open in the MCP server: execFile with an argument vector, carrying a ticket instead of the install token"
  - "hostNames failing closed — an empty name set when the connection's local address is unavailable"
  - "A thirty-day Max-Age on derive_session, revocable by rotating ~/.derive/token"
  - "Five learner-facing sentences that describe what the session actually does"
affects: [02-providers, phase-verification, HC-1, HC-2]

actuals:
  tokens: 39781
  tasks: 3
  commits: 3
plan_head_before: 64d0b4cf2cfa9c6525f778fb6c4d2d06f3ff94c2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A credential that has to travel through a process command line is minted short-lived and single-use rather than reused from a long-lived one"
    - "Time is passed in as `now: number` with a `Date.now()` default (the `schedule.ts` convention) so an expiry can be driven without a test that waits"
    - "A source-read case, with a `//` line saying why, for a fact the sandbox cannot observe"

key-files:
  created:
    - server/src/tickets.ts
  modified:
    - server/src/index.ts
    - server/src/mcp.ts
    - server/test/security.test.ts
    - README.md
    - .env.example
    - scripts/doctor.mjs

key-decisions:
  - "The handoff ticket is not a second token and does not weaken D-09: it is random, one-use, sixty-second, minted only for a caller that already proved it holds the token, and not reversible to it. The token still never leaves the server process."
  - "The cookie got a bounded lifetime rather than the sentences getting narrower — thirty days, HttpOnly, SameSite=Strict, Path=/, over a loopback-only bind by default, revocable without a code change because the value is HMAC-SHA256 of the install token."
  - "The ticket helpers live in a new server/src/tickets.ts rather than inline in index.ts, so `now` can be injected and the sixty-second expiry is proved by five deterministic cases instead of a source read or a minute-long sleep."
  - "The ticket is deliberately NOT passed to registerSecret: the secrets set is a small fixed collection of live long-lived values scanned on every egress, and growing it once per lesson start would slow every redaction for values already worthless. The reason is written in the code rather than left as an apparent oversight."
  - "01-REVIEW.md WR-02 (MCP start_lesson's tokenless `url`) is left open and named, not quietly absorbed — putting a credential into a tool result is a separate decision."

patterns-established:
  - "Credential-on-a-command-line: mint short-lived and single-use, spawn with an argument vector, and never fall back to the long-lived credential on failure — open with nothing and let the 401 body instruct."
  - "Fail-closed address checks: with no address to justify a name, the legitimate-name set is empty, and the consequence (a runtime that hides it answers nothing) is stated in the comment rather than discovered."

requirements-completed: [FOUND-06]

coverage:
  - id: D1
    description: "The MCP server opens the companion page with a single-use, sixty-second ticket; the install token reaches no process command line, and the opener is spawned with an argument vector rather than through a shell"
    requirement: FOUND-06
    verification:
      - kind: integration
        ref: "server/test/security.test.ts#the one-time handoff ticket > is what the MCP server puts on a command line, and the install token is not"
        status: pass
      - kind: other
        ref: "grep -c 'exec(' server/src/mcp.ts -> 0 (was 1); grep -c \"searchParams.set('token'\" server/src/mcp.ts -> 0; grep -c execFile -> 2; grep -c api/handoff -> 1"
        status: pass
    human_judgment: false
  - id: D2
    description: "POST /api/handoff inherits the Host, Origin and credential checks rather than bypassing them, and returns a value that is neither the install token nor the session cookie"
    requirement: FOUND-06
    verification:
      - kind: integration
        ref: "server/test/security.test.ts#the one-time handoff ticket > is not minted for a caller that presented no credential / is not minted for a foreign Host / is minted for a caller holding the token"
        status: pass
      - kind: manual_procedural
        ref: "hand-driven scratch server: POST /api/handoff -> 401 (no credential), 403 (foreign Origin), 200 (token header); ticket !== token, ticket !== session value"
        status: pass
    human_judgment: false
  - id: D3
    description: "A ticket works exactly once: the first GET /?ticket= is a 302 that drops the query and sets the session cookie; a second use, an unminted value and an expired value are all 401"
    requirement: FOUND-06
    verification:
      - kind: integration
        ref: "server/test/security.test.ts#the one-time handoff ticket > opens the page once / is refused the second time / is refused when it was never minted, empty, or blank"
        status: pass
      - kind: unit
        ref: "server/test/security.test.ts#a handoff ticket that has run out of time (5 cases, clock injected)"
        status: pass
    human_judgment: false
  - id: D4
    description: "hostNames returns an empty set when the connection's local address is unavailable, so an unnameable request is refused rather than admitted under a loopback spelling (D-12); every ordinary loopback request is unaffected"
    requirement: FOUND-06
    verification:
      - kind: integration
        ref: "server/test/security.test.ts#the Host check > still lets every ordinary loopback request through / names nothing at all when the connection has no local address"
        status: pass
      - kind: manual_procedural
        ref: "hand-driven scratch server: Host localhost:<port> -> 200, 127.0.0.1:<port> -> 200, evil.com -> 403"
        status: pass
    human_judgment: false
  - id: D5
    description: "The browser session lasts a stated thirty days and is revocable by rotating the install token"
    requirement: FOUND-06
    verification:
      - kind: integration
        ref: "server/test/security.test.ts#the browser session cookie > lasts the thirty days ... / is revoked by rotating the install token"
        status: pass
      - kind: manual_procedural
        ref: "hand-driven two scratch servers: Set-Cookie carries Max-Age=2592000; HttpOnly; SameSite=Strict; Path=/ on both handoffs; server B's cookie is refused 401 by server A on /api/lessons and /"
        status: pass
    human_judgment: false
  - id: D6
    description: "The five learner-facing sentences describe the thirty-day session and name the way back in"
    requirement: FOUND-06
    verification:
      - kind: other
        ref: "grep -rc 'once per browser' README.md .env.example scripts/doctor.mjs server/src/index.ts -> 0,0,0,0 (was 2,0,1,2)"
        status: pass
      - kind: manual_procedural
        ref: "node scripts/doctor.mjs -> exit 0, closing line names the 30 days and the way back in; startup line read in source"
        status: pass
    human_judgment: true
    rationale: "Whether the wording is actually clear to a learner is a judgment no grep makes; the grep only proves the false phrase is gone."
  - id: D7
    description: "HC-1 real-browser session smoke — the five-step sequence a human runs to confirm a closed-and-reopened browser is still signed in and that deleting the token file revokes it"
    verification: []
    human_judgment: true
    rationale: "No automated test drives a real browser. curl proves the cookie authenticates /api/lessons and that both handoffs set it; nothing proves the page's own fetch and EventSource carry it. Carried by this plan, NOT closed by it."
  - id: D8
    description: "HC-2 plugin and Codex parity run — one real lesson through /derive:learn and /derive:review, one through the Codex derive-learn skill"
    verification: []
    human_judgment: true
    rationale: "Requires a model and a provider login. mcp.test.ts drives the identical stdio wire with no model and is green, but cannot exercise a model's own tool selection, the transcript hook or the Codex rollout mirror. Task 1 changes how the plugin opens the companion page, so HC-2 should be run after this plan."

# Metrics
duration: 62 min
completed: 2026-09-20
status: complete
---

# Phase 01 Plan 19: Closing the front door's last three findings Summary

**A one-use sixty-second handoff ticket and a shell-free `execFile` browser open replace the install token on the MCP server's command line; `hostNames` now returns an empty set instead of the loopback names it exists to refuse; and `derive_session` carries a stated, revocable thirty-day `Max-Age` that five learner-facing sentences finally describe correctly.**

## Performance

- **Duration:** 62 min
- **Started:** 2026-09-20T12:34:00Z
- **Completed:** 2026-09-20T13:36:00Z
- **Tasks:** 3
- **Files modified:** 7 (1 created, 6 modified)

## Test-count baseline

`BASE` was measured on this tree before the first edit, as `## Test-count baseline` requires — **not** inherited from the plan's "168" or 01-17's "170", both of which this tree has moved past.

| Point | `# pass` | `# fail` | Floor | Met |
|---|---|---|---|---|
| **BASE** (before the first edit) | **179** | 0 | — | — |
| End of Task 1 | 192 | 0 | `BASE + 3` = 182 | yes |
| End of Task 2 | 194 | 0 | `BASE + 5` = 184 | yes |
| End of Task 3 | 196 | 0 | `BASE + 7` = 186 | yes |

17 cases added: 11 for the ticket (6 HTTP + 5 clock), 2 for the Host polarity, 2 for the cookie lifetime and revocation, plus the two source-read backstops counted among them.

## Accomplishments

- **The install token is off every command line.** `server/src/mcp.ts` no longer builds `…?token=<install token>` and no longer calls `exec` (which spawned `/bin/sh -c`). It asks the server for a ticket, appends that, and spawns the platform opener with `execFile` and an argument vector. On any mint failure it opens the page with no credential at all and lets the 401 body instruct — it never falls back to the long-lived token, which is the prohibition this plan turns on.
- **The ticket inherits every check rather than bypassing one.** `POST /api/handoff` sits under the existing `/api/*` middleware, so reaching the handler is itself proof that `guardLocal` ran and a credential was accepted. The redeem branch in the document middleware sits *after* `guardLocal` and *after* the cookie short-circuit. Driven: 401 with no credential, 403 with a foreign Origin/Host, 200 with the token header.
- **`hostNames` fails closed.** The no-address branch returned `new Set(LOOPBACK_NAMES)` — the four spellings of loopback, which is exactly the forged `Host` the check exists to refuse on a widened bind (D-12). It returns an empty set now, so `guardLocal` refuses. Every ordinary loopback request is untouched, on the API and the document routes alike.
- **The session has a stated life and a revocation story.** `Max-Age=2592000` alongside `HttpOnly`, `SameSite=Strict`, `Path=/`. Because the value is `HMAC-SHA256(token, "derive browser session v1")`, deleting or rotating `~/.derive/token` invalidates every cookie ever issued — driven by offering a second server's cookie to the first.
- **Five learner-facing sentences are true.** The `TOKEN` doc block, the startup line, the widened-bind warning, `README.md` ×2, `scripts/doctor.mjs` and `.env.example` all say thirty days and name the way back in. None says "once per browser" any more.

## Task Commits

1. **Task 1 (tracer): a handoff credential worthless by the time anyone reads it off a command line** — `8182d55` (feat)
2. **Task 2: hostNames fails closed, and its comment says what it does** — `a4c8a4b` (fix)
3. **Task 3: a browser session that lasts as long as the sentences say it does** — `435b12f` (feat)

**Commits measured, not narrated:** `git rev-list --count 64d0b4c..HEAD` = **3**, from the ledger base recorded before the first edit.

### Tracer feedback gate (Task 1)

Task 1 is `type="tracer"`. Gate evaluated in the order `checkpoints.md` specifies: the task carries no `gate="blocking-human"`; `workflow.auto_advance` and `workflow._auto_chain_active` are both `false`, so auto mode is not active; `workflow.human_verify_mode` is `end-of-phase` and the tracer's `<verify>` carries only `<automated>` blocks. That is row 3 — re-run the verification end to end, HALT on failure, continue on success with no checkpoint. All five commands passed (`pnpm typecheck`, `pnpm build`, `security.test.ts`, `mcp.test.ts`, `pnpm test` at 192/0). ⚡ Tracer verified end-to-end — expanded to Tasks 2 and 3.

## Files Created/Modified

- `server/src/tickets.ts` **(new)** — `TICKET_TTL_MS`, the `tickets` map, `mintTicket(now?)` and `redeemTicket(raw, now?)`. Documents why the map is in memory (the process that minted a ticket is the only one that would honour it) and why the ticket is deliberately not a registered secret (an unbounded secrets set would slow every redaction for values already worthless).
- `server/src/index.ts` — `POST /api/handoff`; the ticket branch in the document middleware; `hostNames` fail-closed with a rewritten doc block; the document middleware's doc block corrected (it claimed the local address "is not consulted at all" on that path, which was false — it runs the same `guardLocal`); `SESSION_MAX_AGE_S`; `issueSession` gains `maxAge` and the revocation note; the `TOKEN` doc block, the startup line and the widened-bind warning rewritten.
- `server/src/mcp.ts` — `withToken` deleted, `withTicket` and `handoffTicket` added; `exec`→`execFile` with an argv; `start_lesson` awaits a ticket before opening the browser. The returned `url` field is **unchanged** (see WR-02 below).
- `server/test/security.test.ts` — `describe('the one-time handoff ticket')` (6 HTTP cases + 2 source reads), `describe('a handoff ticket that has run out of time')` (5 clock-injected cases), two Host-check cases, two session-cookie cases, and a `ticketHandoff()` helper.
- `README.md`, `.env.example`, `scripts/doctor.mjs` — the learner-facing sentences.

## Decisions Made

Beyond the two the plan reasoned out in advance (the ticket is not a second token; the cookie gets a lifetime rather than the sentences getting narrower), one was taken during execution — see Deviations.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The ticket helpers were extracted to `server/src/tickets.ts` instead of living inline in `server/src/index.ts`**

- **Found during:** Task 1, writing the expired-ticket case.
- **Issue:** The plan places `tickets`, `TICKET_TTL_MS`, `mintTicket()` and `redeemTicket()` in `server/src/index.ts`, and requires a case proving "a ticket minted and then redeemed after its TTL is 401". None of the three routes the plan offered was available. Waiting out the TTL means a sixty-second sleep in a 7-second suite — `01-16` bought this suite its determinism and speed, and a gate nobody will wait for is a gate that gets skipped. A "case-local server started with a short TTL" needs the TTL to be settable at boot, i.e. a new environment variable — which this plan's own artifact section forbids, and which the simplicity rule argues against (a knob whose only caller is a test). And `server/src/index.ts` cannot be imported by a unit case at all, because it calls `serve()` at module scope.
- **Fix:** a new `server/src/tickets.ts` exporting `mintTicket(now = Date.now())` and `redeemTicket(raw, now = Date.now())`. This is the project's own documented convention, stated verbatim in CLAUDE.md: *"Time is passed in as `now: number` (ms since epoch) with a `Date.now()` default so callers and tests can pin it"* — which is exactly what `server/src/schedule.ts` does. `index.ts` imports the three names; nothing about the route, the middleware or the on-the-wire behaviour differs from the plan.
- **What it bought:** five deterministic cases instead of one source read — good to the last millisecond (`T0 + TTL - 1` → true), refused exactly on expiry and after it, swept by the next mint (refused even with the clock wound back, because the entry is gone rather than merely old), spent by a *failed* redeem, and never a blank string. The HTTP half is still driven end to end: `redeemTicket` returning false is answered 401, proved by the unminted/empty/blank case.
- **Files modified:** `server/src/tickets.ts` (new), `server/src/index.ts`, `server/test/security.test.ts`
- **Verification:** `pnpm typecheck`, `pnpm build`, the full suite at 196/0, and the hand-driven scratch-server run.
- **Committed in:** `8182d55` (Task 1 commit)

**2. [Rule 1 - Bug] Task 2's first acceptance grep does not discriminate as written, because the phrase it hunts was line-wrapped**

- **Found during:** Task 2, running the acceptance criteria.
- **Issue:** The criterion is `grep -c "fail closed to loopback" server/src/index.ts` printing `0`, and states it prints `1` on the starting tree. It printed `0` on *both* trees. The phrase existed as `fail\n * closed to loopback` — split across a JSDoc line wrap — so a line-oriented grep never matched it. Taken at face value the criterion would have "passed" without proving anything.
- **Fix:** re-ran wrap-aware. On `8182d55` (the tree Task 2 started from): `git show 8182d55:server/src/index.ts | tr '\n' ' ' | grep -o 'fail[^.]*closed[^.]*loopback'` → `fail  * closed to loopback`, one hit. On the tree after Task 2: no hit. The criterion's intent — the phrase that described the permissive branch is gone — is met and discriminating. The `new Set(LOOPBACK_NAMES)` criterion beside it was fine as written: **1 → 0**. The suite pins both: `names nothing at all when the connection has no local address to be judged by` asserts the absence of the phrase *and* of the permissive return.
- **Files modified:** none (a measurement correction, not a code change)
- **Verification:** both greps recorded above and in the Acceptance section.
- **Committed in:** n/a

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug in a plan-supplied check).
**Impact on plan:** No scope creep. Deviation 1 adds one small module whose only reason to exist is that an expiry is a clock and a clock has to be pinnable; the shipped behaviour matches the plan exactly. Deviation 2 changed no code.

## Acceptance criteria — recorded values

### Task 1

| Criterion | Before | After |
|---|---|---|
| `grep -c "exec(" server/src/mcp.ts` | 1 | **0** |
| `grep -c "searchParams.set('token'" server/src/mcp.ts` | 1 | **0** |
| `grep -c "execFile" server/src/mcp.ts` | 0 | **2** |
| `grep -c "api/handoff" server/src/mcp.ts` | 0 | **1** |
| `grep -c "console" server/src/index.ts` (must not increase) | 7 | **7** |

Hand-driven against a scratch build on its own port and data directory:

```
1. POST /api/handoff (no credential)       -> 401 {"error":"send the x-derive-token header, with the token in …/token"}
2. POST /api/handoff (foreign Origin)      -> 403 {"error":"origin http://evil.example is not allowed to call derive"}
3. POST /api/handoff (x-derive-token)      -> 200 {"ticket":"48f5e2…21ac","expires_in":60}
   ticket === token?                       -> false
   ticket === session cookie value?        -> false
4. GET /?ticket=<t>                        -> 302 Location: /
   Set-Cookie                              -> derive_session=…; Path=/; HttpOnly; SameSite=Strict
5. GET /?ticket=<same t> again             -> 401 Set-Cookie: ""
6. GET /?ticket=<never minted>             -> 401
7. GET /api/lessons on the ticket's cookie -> 200 []
```

(The `Set-Cookie` above has no `Max-Age` because it was recorded at the end of Task 1; Task 3 adds it — see below.)

Stdio wire unchanged: `git diff --quiet -- server/test/wire-surface.json` exits 0, `git diff --quiet -- server/test/mcp.test.ts` exits 0, and `mcp.test.ts` passes 3/3 including `start_lesson` with `open_browser: false`.

### Task 2

| Criterion | Before | After |
|---|---|---|
| `grep -c "fail closed to loopback" server/src/index.ts` | 0 (line-wrapped — see Deviation 2) | **0** |
| wrap-aware: `tr '\n' ' ' \| grep -o 'fail[^.]*closed[^.]*loopback'` | `fail  * closed to loopback` (1) | **0** |
| `grep -c "new Set(LOOPBACK_NAMES)" server/src/index.ts` | 1 | **0** |

Hand-driven:

```
GET /api/lessons  Host: localhost:42051  -> 200 []
GET /api/lessons  Host: 127.0.0.1:42051  -> 200 []
GET /api/lessons  Host: evil.com         -> 403 {"error":"derive answers on 127.0.0.1 at port 42051, …"}
```

**What the green suite proves here:** every request in the suite passes through `guardLocal` → `hostNames`. If the connection's local address were *not* available under `@hono/node-server`, the new empty-set branch would refuse every one of them and the whole suite would go red. It is green at 196/0, so the address is available on this runtime — a red run here would have meant the address is missing, **not** that failing closed is the wrong polarity. The widened-bind cases, `refuses a name the connection did not arrive on` included, still pass.

**`01-14-PLAN.md` truth #2** asserted that where an address is consulted at all the check fails closed. That was **false when written** — `hostNames` returned the loopback name set — and is **true as of `a4c8a4b`**. The historical plan file is left exactly as written: it is a record of what was planned, not a document to correct after the fact.

### Task 3

| Criterion | Before | After |
|---|---|---|
| `grep -rc "once per browser"` — `README.md` | 2 | **0** |
| — `.env.example` | 0 | **0** |
| — `scripts/doctor.mjs` | 1 | **0** |
| — `server/src/index.ts` | 2 | **0** |
| `grep -c "30 \* 24 \* 60 \* 60" server/src/index.ts` | 0 | **1** (with a doc line giving the reasoning, not the arithmetic) |

Hand-driven against two scratch servers with separate data directories:

```
Set-Cookie on the ?token= handoff  -> derive_session=fa7abb…27; Max-Age=2592000; Path=/; HttpOnly; SameSite=Strict
  value === install token?         -> false
Set-Cookie on the ?ticket= handoff -> derive_session=fa7abb…27; Max-Age=2592000; Path=/; HttpOnly; SameSite=Strict
  value === install token?         -> false
server B's cookie === server A's?  -> false
A: GET /api/lessons with B's cookie-> 401
A: GET / with B's cookie           -> 401
```

`node scripts/doctor.mjs` runs to completion (exit 0, all nine checks green, the token-mode check still reading `0600` correctly) and its closing line matches the startup line on both facts: *"once; that browser stays signed in for 30 days, and opening the same link again signs it in for another 30"*.

## Issues Encountered

None beyond the two deviations above. `pnpm test` was green at every gate; no fix attempt was needed on any task.

## Not claimed by this plan

- **`01-REVIEW.md` WR-02** — MCP `start_lesson` still returns a tokenless `url` that 401s when the browser is not opened automatically (`open_browser: false`, `DRIVER === 'app'`, or the learner copying the link into another browser). The ticket built here is used for the browser-open path **only**; the `url` field is byte-for-byte what it was. Putting a credential — even a sixty-second one — into a model-visible tool result is a separate decision the verifier recorded as riding with the human parity check. **Open and named.**
- **The eleven flagged edge-probe assumptions** carried in `01-16-PLAN.md` and `01-18-PLAN.md`. This plan resolves none of the seventeen probe rows and drops none; the accounting stays in `01-16-PLAN.md`'s audit.

## Human verification carried forward — NOT closed

Recorded as outstanding in the broken-windows ledger (entries 4 and 5, both still `open`; two new source-read backstop entries were appended this plan).

- **HC-1 — real-browser session smoke. This plan makes it cheap to run; it does not close it.** Exact sequence:
  1. `pnpm build && pnpm start`
  2. Copy the `http://localhost:4310/?token=…` link the startup line prints and open it in a real browser. Expect a 302 to `/` with the query gone from the address bar.
  3. Start a lesson, answer one card, watch the graph update. Expect the SSE stream to connect, cards to render and answers to land — all on the `derive_session` cookie, with **no** `x-derive-token` header sent by the page (confirm in the network panel).
  4. Close the browser **entirely**, reopen it, go to `http://localhost:4310/` with no query string. **After this plan the page is expected to load** (the cookie now carries `Max-Age=2592000`); before it, this step 401'd. Confirm the lesson is still there and the stream reconnects.
  5. Delete `~/.derive/token`, restart the server, reload with no query string. Expect **401** — the revocation path, and the reason the thirty-day lifetime is defensible.

  *Why a human:* no automated test drives a real browser. curl proves the cookie authenticates `/api/lessons` and that both handoffs set it; nothing proves the page's own `fetch` and `EventSource` carry it, and no case covers the lesson stream on the cookie at all (`01-REVIEW.md` WR-09).

- **HC-2 — plugin and Codex parity run.** One real lesson through the Claude Code plugin (`/derive:learn`, then `/derive:review`) and one through the Codex `derive-learn` skill. Expected: both complete exactly as before the phase, and the Codex skill teaches rather than only quizzing. Requires a model and a provider login. **Because Task 1 changed how the plugin opens the companion page, HC-2 should be run after this plan rather than before it.** Still outstanding.

## Known Stubs

None. No placeholder values, no TODO/FIXME markers, and no skipped tests were introduced. Two facts are asserted by reading source rather than driven — both are the plan's own declared `verification: backstop` truths, each carries a `//` line saying why, and both were appended to `.planning/WINDOWS.md` this plan:

- the absence of the install token and of the shell from the MCP browser open (the exposure is `/proc/<pid>/cmdline`, which a sandboxed test cannot observe);
- the fail-closed polarity of `hostNames` (a connection's local address cannot be made `undefined` from outside the process).

## Threat Flags

None. The new surface — `POST /api/handoff` and the document middleware's ticket branch — is exactly what `<threat_model>` T-19-01 through T-19-04 registered as `mitigate`, and each mitigation is in place and driven. No network endpoint, auth path, file access pattern or schema change beyond the register.

## User Setup Required

None — no external service configuration required. No new dependency, no new environment variable, no migration, no new table, no new event type (`EVENT_TYPES` in `web/src/lib/useLesson.ts` is untouched).

## Next Phase Readiness

FOUND-06's machine half is closed: the per-install token, the `Host` check and the sentences about them. Phase 01's automated gate is green at **196 pass / 0 fail** across 52 suites, and the plugin/Codex stdio wire (`wire-surface.json`, `mcp.test.ts`) is byte-identical to before this plan.

Two things gate the phase, and neither is a code change: **HC-1** and **HC-2**, both carried with exact runnable scripts and both still open in the ledger. **WR-02** is a named open decision for whoever picks it up — Phase 02's provider work touches the same tool-result surface, so it is a natural place to settle it.

## Self-Check: PASSED

- `server/src/tickets.ts` — FOUND
- `server/src/index.ts`, `server/src/mcp.ts`, `server/test/security.test.ts`, `README.md`, `.env.example`, `scripts/doctor.mjs` — FOUND
- Commits `8182d55`, `a4c8a4b`, `435b12f` — all FOUND in `git log --oneline --all`
- `git rev-list --count 64d0b4c..HEAD` = 3, matching the three task commits
- All task `<acceptance_criteria>` re-run and recorded above; all plan-level `<verification>` bullets re-run green
- `pnpm typecheck`, `pnpm build`, `pnpm test` (196/0), `node scripts/doctor.mjs` (exit 0) — all pass on the final tree

---
*Phase: 01-foundation*
*Completed: 2026-09-20*
