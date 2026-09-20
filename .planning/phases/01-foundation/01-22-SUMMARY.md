---
phase: 01-foundation
plan: 22
subsystem: infra
tags: [auth, security, credentials, session-cookie, hono, mcp, fsrs-unrelated]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "01-09's guardLocal / document middleware / derived session cookie, 01-19's one-time handoff ticket, 01-20's one-second live-read revocation cache"
provides:
  - "The one-time handoff ticket is deleted: no server/src/tickets.ts, no POST /api/handoff, no ?ticket= branch, and no credential of any kind in the URL the MCP server hands a browser opener"
  - "A ?token= in a document URL is decided first and always spent: a match 302s to the bare path with a fresh session cookie even for a browser that already holds one, a non-match is a 401"
  - "The x-derive-token header is a pass-through on document routes, so a non-browser client repeating it cannot be made to loop"
  - "The one-second credential cache is a bound in both directions: an entry of negative age is stale, so a backwards wall-clock step no longer suspends revocation"
  - "The authenticated surface is strictly smaller than it was"
affects: [security, provider-settings, secrets, adoption]

actuals:
  tokens: 6677        # chars/4 over the realized diff (git diff a343bcc..HEAD -- server = 26,707 chars)
  tasks: 3
  commits: 3          # MEASURED: git rev-list --count a343bcc..HEAD at SUMMARY write
  plan_head_before: a343bccaad674bbb704f99d519c8eb199861a540

tech-stack:
  added: []
  patterns:
    - "A credential that arrives in a URL is decided before any other credential kind, because it has to be spent and dropped whatever else the request carries"
    - "Closing an exposure by deleting the mechanism that creates it, rather than by bounding its lifetime"
    - "A deletion gate: a case that asserts a removed route/branch stays removed, so reintroducing it is a decision rather than a drift"

key-files:
  created: []
  modified:
    - server/src/index.ts
    - server/src/mcp.ts
    - server/src/credentials.ts
    - server/test/security.test.ts
    - server/test/credentials.test.ts
  deleted:
    - server/src/tickets.ts

key-decisions:
  - "The /proc/<pid>/cmdline exposure is closed by construction rather than by a sixty-second lifetime: the MCP server now opens the bare lesson URL and lets the 401 page tell the learner to open the link the server printed. That fallback is not new — it is the branch handoffTicket() already took on failure and already documented as acceptable; this plan makes it the only path"
  - "The first-run cost is accepted deliberately: a browser that has never signed in, opened from the terminal, lands on the 401 page instead of being signed in automatically. One extra step, once per browser, in exchange for deleting a credential that travelled on a world-readable command line"
  - "The document middleware's credential order is now ?token= in the URL, then the cookie, then the x-derive-token header. The URL credential goes first because the cookie short-circuit ahead of it was exactly what left the install token in a signed-in browser's address bar"
  - "The header is a pass-through rather than a handoff: there is nothing in a header to strip from a URL, and redirecting it is what would let a header-carrying client loop"
  - "The Host / Origin / health-exemption refusal order is unchanged and still precedes every credential check; only the order of credential kinds within the last step moved"
  - "No new security prose was written anywhere. Every sentence touched was either deleted alongside the mechanism it described, or was already true and the code moved to meet it. .env.example, README.md and scripts/doctor.mjs are byte-identical"

patterns-established:
  - "Delete-or-leave for security prose: a surviving sentence is either already true or the code changes until it is; a new claim is a new blocking condition for the next verification"
  - "A freshness window is written as a two-sided bound (non-negative age AND below the window), because a monotonic-clock assumption is not one the process can make"

requirements-completed: [FOUND-06]

coverage:
  - id: D1
    description: "The one-time handoff ticket is gone from source, wire and prose, and a case holds its absence"
    requirement: FOUND-06
    verification:
      - kind: integration
        ref: "server/test/security.test.ts#the document routes > have no handoff-ticket path at all: the route is gone and a ticket is not a credential"
        status: pass
      - kind: other
        ref: "grep -rn 'mintTicket|redeemTicket|TICKET_TTL_MS|withTicket|handoffTicket' server/src server/test -> no output; test -e server/src/tickets.ts -> exit 1; grep -c 'api/handoff' server/src/index.ts -> 0"
        status: pass
      - kind: manual_procedural
        ref: "scratch server on server/dist/index.js (PORT=4877, scratch DERIVE_DATA_DIR): POST /api/handoff with a valid x-derive-token -> 404; GET /?ticket=<64 hex> with no cookie -> 401"
        status: pass
    human_judgment: false
  - id: D2
    description: "A credential that arrives in a URL is spent and dropped on every request that carries one, including from a browser that already holds a valid session cookie"
    requirement: FOUND-06
    verification:
      - kind: integration
        ref: "server/test/security.test.ts#the document routes > spend the token in the URL even for a browser that already holds a cookie, so it never rests in the address bar"
        status: pass
      - kind: integration
        ref: "server/test/security.test.ts#the document routes > refuse a token in the URL that does not match, even from a browser holding a valid cookie"
        status: pass
      - kind: manual_procedural
        ref: "scratch server (PORT=4878), curl with no redirect following: signed-in browser GET /?token=<valid> with cookie -> 302, Set-Cookie present, Location '/' with no '?'; GET / with cookie only -> 200, no Set-Cookie, no Location; GET /?token=wrong with a valid cookie -> 401; GET / with nothing -> 401"
        status: pass
    human_judgment: false
  - id: D3
    description: "A non-browser client repeating x-derive-token on a document route is served rather than redirected, so it cannot be made to loop"
    requirement: FOUND-06
    verification:
      - kind: integration
        ref: "server/test/security.test.ts#the document routes > let a header client through without a redirect, twice in a row, so it cannot be made to loop"
        status: pass
      - kind: manual_procedural
        ref: "scratch server (PORT=4878): GET / with x-derive-token and no cookie, twice -> 200 both times, no Set-Cookie, no Location either time"
        status: pass
    human_judgment: false
  - id: D4
    description: "The one-second credential window bounds staleness in both directions: a cache entry of negative age is stale, so a backwards wall-clock step does not keep a deleted token authenticating"
    requirement: FOUND-06
    verification:
      - kind: unit
        ref: "server/test/credentials.test.ts#the cached live read of the install token > treats a cache entry of negative age as stale, so a backwards clock step does not suspend revocation"
        status: pass
      - kind: unit
        ref: "discrimination run: guard removed -> that case exits 1 (# fail 1); guard restored -> exits 0 (# pass 8)"
        status: pass
      - kind: manual_procedural
        ref: "pinned-clock drive against server/dist/credentials.js: matchesToken(A, T+999) -> true; credentials(T+1000).token === B -> true; file deleted then matchesToken(A, T-3_600_000) -> false and matchesToken(A, T-1) -> false"
        status: pass
    human_judgment: false
  - id: D5
    description: "The Host / Origin / health-exemption refusal order is unchanged and still precedes every credential check"
    requirement: FOUND-06
    verification:
      - kind: integration
        ref: "server/test/security.test.ts (describe 'the Host check', describe 'the Origin allowlist') — 57 cases green"
        status: pass
      - kind: manual_procedural
        ref: "scratch server (PORT=4878): foreign Host + bad credential -> 403; foreign Origin + bad credential -> 403; good Host, no credential -> 401; foreign Host on /api/health -> 403; good Host on /api/health -> 200"
        status: pass
    human_judgment: false
  - id: D6
    description: "The wire surface and the canonical method text are untouched, and no learner-facing sentence changed"
    verification:
      - kind: other
        ref: "git diff --quiet HEAD -- server/test/wire-surface.json -> exit 0; node scripts/check-method.mjs -> exit 0; git diff --name-only a343bcc..HEAD -- .env.example README.md scripts/doctor.mjs -> empty"
        status: pass
    human_judgment: false

duration: 14 min
completed: 2026-09-20
status: complete
---

# Phase 01 Plan 22: Delete the handoff ticket, spend the URL credential, bound the window both ways Summary

**One credential path deleted (the one-time `?ticket=` handoff and `POST /api/handoff`), one repaired (a `?token=` in a document URL is now decided before the session cookie, so it is always spent and always dropped), and one comparison fixed (a cache entry of negative age is stale), with no new security prose anywhere.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-09-20T18:12:13Z
- **Completed:** 2026-09-20T18:26:26Z
- **Tasks:** 3
- **Files modified:** 5 modified, 1 deleted

## Test-count baseline and arithmetic

`BASE` was recorded on the tree this plan started from, before the first edit.

| Point | `# pass` | `# fail` | Floor from the plan | Note |
|---|---|---|---|---|
| `BASE` (a343bcc) | **209** | 0 | — | matches the plan's expectation of 209 |
| After Task 1 | **197** | 0 | `BASE - T` = 196 | `T` = **13** ticket cases deleted, 1 deletion gate added |
| After Task 2 | **200** | 0 | `BASE - T + 2` = 198 | 3 cases added, not 2 (see Deviations) |
| After Task 3 | **201** | 0 | `BASE - T + 3` = 199 | 1 case added |

**`T` = 13.** Eight cases in `describe('the one-time handoff ticket', …)` and five in `describe('a handoff ticket that has run out of time', …)`; the second block had to go with the first because every case in it calls `mintTicket`/`redeemTicket`/`TICKET_TTL_MS`, whose import was deleted.

Net: 209 − 13 + 5 = **201**, with `# fail 0` at every step.

## Accomplishments

- **The handoff ticket is gone by construction, not bounded by a lifetime.** `server/src/tickets.ts` is deleted, `POST /api/handoff` returns 404, no branch of the document middleware reads `?ticket=`, and `server/src/mcp.ts` calls `openBrowser(l.url)` with no query parameters. The `/proc/<pid>/cmdline` exposure the ticket was written to mitigate no longer has anything to expose.
- **A `?token=` in a document URL is spent every time.** The middleware now decides on the query parameter first: a match issues the session and 302s to the bare path, a non-match is a 401. A browser that already holds a valid cookie no longer keeps the install token in its address bar — which is what four learner-facing sentences (`.env.example:37`, `README.md:54,63`, `scripts/doctor.mjs:118`, `index.ts` startup line) have claimed all along. None of those four sentences changed; the code moved to meet them.
- **The header cannot loop.** `x-derive-token` on a document route is now a pass-through (`next()`), not a handoff. A machine client repeating it is served 200 twice with no `Set-Cookie` and no `Location`.
- **The one-second window is a bound in both directions.** `credentials()` now requires a non-negative age as well as one below `TOKEN_CACHE_MS`, so a backwards wall-clock step no longer keeps a deleted token authenticating for the length of the step. `TOKEN_CACHE_MS` and the forward boundary are byte-for-byte what they were, and the docstring — which already said the window "is a bound and not an approximation" — is unchanged.
- **Nothing was added.** No new module, no new route, no new credential kind, and no new security sentence. Every prose change was a deletion alongside its mechanism, except the middleware docstring's closing sentence, which was rewritten to name the order the code now has (mandated by the plan's Task 2 action).

## Task Commits

Each task was committed atomically:

1. **Task 1: delete the one-time handoff ticket, and every sentence about it** — `4f9d1e9` (fix)
2. **Task 2: spend the URL credential before the cookie can short-circuit it** — `64d7442` (fix)
3. **Task 3: make the one-second window a bound in both directions** — `4faed3f` (fix)

**Plan metadata:** a separate `docs(01-22)` commit follows this file.

## Files Created/Modified

- `server/src/tickets.ts` — **deleted.** The whole module: `TICKET_TTL_MS`, the `tickets` map, `mintTicket`, `redeemTicket`, and the docstring that justified them.
- `server/src/index.ts` — the `tickets.js` import, the `POST /api/handoff` route and its entire docstring, and the `if (redeemTicket(...))` branch with the `//` line above it, all removed. The document middleware's credential step restructured so the `?token=` query is decided before the cookie and the header. Two docstring sentences removed (the one describing the ticket, the one about a browser presenting the token "once") and the closing order sentence rewritten to name the new order and why the URL credential goes first.
- `server/src/mcp.ts` — `withTicket` and `handoffTicket` removed with their docstrings; `start_lesson` now calls `openBrowser(l.url)`. `openBrowser`'s argv comment trimmed to the half that is still true (an argument vector, so no `/bin/sh` is involved); the half that justified the argv by the ticket's lifetime is gone, and nothing replaces it, because there is no credential in that URL left to justify.
- `server/src/credentials.ts` — one condition: `now >= cache.at && now - cache.at < TOKEN_CACHE_MS`. No prose change.
- `server/test/security.test.ts` — the `tickets.js` import, the `ticketHandoff` helper and both ticket `describe` blocks (13 cases) removed; the 30-day-cookie case no longer drives `ticketHandoff`. Four cases added (one deletion gate in Task 1, three credential-ordering cases in Task 2). One existing assertion changed, see Deviations.
- `server/test/credentials.test.ts` — one case: the backwards clock step with the token file deleted.

## Decisions Made

Recorded in full in the frontmatter `key-decisions`. In short: the argv exposure is closed by removing the credential rather than by shortening its life; the first-run cost (a never-signed-in browser opened from the terminal lands on the 401 page) is accepted deliberately, because that page names the token file and the startup line prints the full `?token=` link; the credential order inside the last refusal step is now URL, then cookie, then header, and the header is a pass-through; the Host/Origin/health order is untouched.

## Deviations from Plan

### 1. [Plan-directed, not auto-fixed] A second ticket `describe` block had to go with the first

- **Found during:** Task 1
- **Issue:** The plan named `describe('the one-time handoff ticket', …)` (8 cases). A second block, `describe('a handoff ticket that has run out of time', …)` (5 cases), drives `mintTicket`/`redeemTicket`/`TICKET_TTL_MS` directly and cannot compile once the import is removed.
- **Fix:** Removed both blocks. `T` = 13 rather than 8; the plan's floors are expressed in terms of `T`, so the arithmetic is unaffected.
- **Files modified:** `server/test/security.test.ts`
- **Verification:** `grep -rn "mintTicket\|redeemTicket\|TICKET_TTL_MS\|withTicket\|handoffTicket" server/src server/test` prints nothing; `pnpm typecheck` and `pnpm test` green.
- **Committed in:** `4f9d1e9`

### 2. [Rule 1 — Bug] An existing assertion contradicted Task 2's intended behaviour

- **Found during:** Task 2
- **Issue:** `server/test/security.test.ts`, in `describe('the Host check')`, asserted `raw('/', { 'x-derive-token': token, host })` returns **302**. Under the plan's stated behaviour ("a request carrying a valid `x-derive-token` header and no URL credential passes through with no redirect") that is 200. Left as-is the suite would have gone red on a change the plan explicitly specified.
- **Fix:** Changed that one assertion from 302 to 200. Nothing else in the case moved — its point is the Host polarity, and its failure message ("the document route refused {host}") still reads correctly.
- **Files modified:** `server/test/security.test.ts`
- **Verification:** `pnpm --filter server exec node --import tsx --test test/security.test.ts` — 57 cases, `# fail 0`.
- **Committed in:** `64d7442`

### 3. [Scope] Three cases added in Task 2 rather than two

- **Found during:** Task 2
- **Issue:** The plan's `<action>` names two cases; its `<behavior>` and `<acceptance_criteria>` name a third behaviour — a `?token=` that does not match is a 401 even behind a valid cookie.
- **Fix:** Added the third case so every behaviour the plan states is held by a case rather than only by a one-off hand drive. The floor is `at least BASE - T + 2`; 3 satisfies it.
- **Files modified:** `server/test/security.test.ts`
- **Verification:** `pnpm test` — `# pass 200`, `# fail 0`.
- **Committed in:** `64d7442`

---

**Total deviations:** 3 (1 plan-directed consequence, 1 Rule 1 bug, 1 scope addition of a case the plan's own criteria required)
**Impact on plan:** None on scope or direction. No mechanism was added, no security sentence was written, and the three files the plan declared to be the specification — `.env.example`, `README.md`, `scripts/doctor.mjs` — are byte-identical to `a343bcc`.

## Findings (reported rather than fixed, per the plan's intent)

The plan's `<plan_intent>` directs that an instinct to add a safety mechanism be reported rather than acted on. One such finding:

- **A regression guard was lost with the deleted `describe`.** The case `is what the MCP server puts on a command line, and the install token is not` read `server/src/mcp.ts` as source and asserted (a) no `exec(` shell spawn, (b) no `searchParams.set('token'`, (c) the `execFile(cmd, args, () => undefined)` shape. It also asserted `'/api/handoff'` is present, which is now false — so the case could not survive intact. Deleting the block removed (a), (b) and (c) along with it. **Nothing now goes red if a future change puts the install token back into the browser-opener URL.** The new deletion gate covers reintroducing `/api/handoff` and `?ticket=`; it does not cover reintroducing `?token=` on the opener's argv. Recorded in `.planning/WINDOWS.md` as entry 12 (`kind: deviation`, open). Writing a replacement source-assertion would have been adding a mechanism this plan forbids; it belongs in a decision, not in a gap-closure round whose whole shape is subtraction.

## Issues Encountered

- **A `pkill -f` pattern matched the executing shell** while stopping a scratch server (the pattern appeared in the command text itself), killing the shell with exit 144. Resolved by resolving the pid with `pgrep -af "node server/dist/index.js"` and `kill <pid>`. No repository state was touched.
- **A stray ledger entry** was created by a verification invocation of `gsd-tools windows append`. Removed by reverting `.planning/WINDOWS.md` to `HEAD` and re-appending the single real entry; the file now carries exactly one new row (id 12) and `open_count: 12`.

## Evidence recorded

### Task 1 — the ticket is gone

```
test -e server/src/tickets.ts                                      -> exit 1
grep -rn "mintTicket|redeemTicket|TICKET_TTL_MS|withTicket|handoffTicket" server/src server/test -> no output
grep -c "api/handoff" server/src/index.ts                          -> 0
git diff --quiet HEAD -- server/test/wire-surface.json             -> exit 0
node scripts/check-method.mjs                                      -> exit 0
```

Driven against a freshly built `server/dist/index.js` on a scratch `DERIVE_DATA_DIR` (port 4877):

```
GET  /api/health                                  -> 200
POST /api/handoff   (valid x-derive-token)        -> 404
GET  /?ticket=<64 hex>   (no cookie)              -> 401
GET  /                   (no credential)          -> 401
```

### Task 2 — the URL credential, and the refusal order

Driven against a freshly built `server/dist/index.js` on a scratch `DERIVE_DATA_DIR` (port 4878), curl with no redirect following throughout:

```
sign in:  GET /?token=<valid>                     -> 302  Location: /            Set-Cookie: derive_session=…; Max-Age=2592000; Path=/; HttpOnly; SameSite=Strict
A. GET /?token=<valid>  CARRYING that cookie      -> 302  Location: /  (no '?')  Set-Cookie: derive_session=… present
B. GET /                carrying only the cookie  -> 200  no Location            no Set-Cookie
C. GET /  x-derive-token, no cookie, attempt 1    -> 200  no Location            no Set-Cookie
   GET /  x-derive-token, no cookie, attempt 2    -> 200  no Location            no Set-Cookie
D. GET /?token=wrong    carrying a valid cookie   -> 401
E. GET /                no credential at all      -> 401
```

The Host / Origin order, re-driven and unchanged:

```
foreign Host  + bad credential        -> 403
foreign Origin + bad credential       -> 403
good Host, no credential              -> 401
foreign Host on /api/health           -> 403
good Host on /api/health              -> 200
```

The three specification files were read, not edited:

```
git diff --name-only HEAD -- .env.example README.md scripts/doctor.mjs   -> empty
git diff --name-only a343bcc..HEAD -- .env.example README.md scripts/doctor.mjs -> empty
```

### Task 3 — the window as a two-sided bound

Pinned-clock drive against the freshly built `server/dist/credentials.js` on a scratch data directory:

```
TOKEN_CACHE_MS                            = 1000
read at T                                 -> A
matchesToken(A, T + 999)                  -> true    (cache served; forward boundary unchanged)
credentials(T + 1000).token === B         -> true    (file re-read exactly at the window)
matchesToken(A, T) before delete          -> true
token file deleted, matchesToken(A, T - 3_600_000) -> false
token file deleted, matchesToken(A, T - 1)         -> false
```

Discrimination run, as the plan requires:

```
guard removed  (if (cache && now - cache.at < TOKEN_CACHE_MS))                  -> exit 1
               not ok 2 - treats a cache entry of negative age as stale, …      (# pass 7, # fail 1)
guard restored (if (cache && now >= cache.at && now - cache.at < TOKEN_CACHE_MS)) -> exit 0  (# pass 8, # fail 0)
```

After the discrimination run was reverted:

```
git diff --name-only -- server/src            -> server/src/credentials.ts   (only)
grep -c "TOKEN_CACHE_MS = 1_000" server/src/credentials.ts -> 1
```

## Known Stubs

None. No hardcoded empty value, placeholder string, TODO or unwired component was introduced; this plan is net-subtractive in source (62 insertions, 258 deletions).

## Threat Flags

None. This plan removes a network endpoint (`POST /api/handoff`) and a credential branch (`?ticket=`) and adds none. No new file access pattern, no schema change, no new trust boundary.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- The two findings of the fifth verification (gap 1, the unspent ticket and the un-stripped token; gap 2, the unbounded window) are both closed and driven.
- The authenticated surface is now: the 0600 token file, the `x-derive-token` header, the `?token=` document handoff, and the derived `derive_session` cookie. Four kinds, all of them already driven green, and each one enumerable for Criterion 5's universal claim.
- **Still open from earlier plans, unchanged by this one:** HC-1 (browser session-cookie smoke) and HC-2 (a real lesson through the Claude Code plugin and one through the Codex `derive-learn` skill — FOUND-04's human half), recorded in `01-12-SUMMARY.md` and in the ledger as entries 4 and 5. The phase should not be marked verified until HC-2 runs.
- **New this round:** ledger entry 12 — the MCP-argv source assertion lost with the deleted `describe`. It is a coverage gap, not a defect in shipped behaviour.

## Self-Check

- `server/src/tickets.ts` absent: **confirmed** (`test -e` exit 1).
- All five modified files exist on disk: **confirmed**.
- Commits `4f9d1e9`, `64d7442`, `4faed3f` present in `git log`: **confirmed**.
- `git rev-list --count a343bccaad674bbb704f99d519c8eb199861a540..HEAD` = **3**, matching `actuals.commits`.
- `pnpm typecheck` exit 0, `pnpm build` exit 0, `pnpm test` `# pass 201 / # fail 0`, `node scripts/check-method.mjs` exit 0, `server/test/wire-surface.json` byte-identical.

## Self-Check: PASSED

---
*Phase: 01-foundation*
*Completed: 2026-09-20*
