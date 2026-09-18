---
phase: 01-foundation
plan: 07
subsystem: api
tags: [security, authentication, cors, dns-rebinding, loopback, versioning, hono, vite]

# Dependency graph
requires:
  - phase: 01-02
    provides: server/src/mcp.ts as a registration loop and server/test/mcp.test.ts driving the built stdio binary — both had to keep passing under the token
  - phase: 01-06
    provides: the turns/usage ledger and its server-spawning test, which is the third harness that now carries the header
provides:
  - "server/src/config.ts: VERSION, TOKEN_PATH, HOST, HOST_IS_LOOPBACK, DERIVE_ORIGINS, ALLOWED_ORIGINS"
  - "server/src/index.ts ensureToken(): 32 random bytes, hex, 0600, written with wx on first boot and never overwritten"
  - "the /api/* middleware: /api/health exempt, then Host, then whole-string Origin, then a constant-time x-derive-token check"
  - "the token injected into the served index.html and read back by web/src/lib/api.ts deriveToken() — no endpoint hands it out (D-09)"
  - "DERIVE_HOST as a gated, loud opt-in past loopback, with DERIVE_ORIGINS extending the allowlist (D-12)"
  - "server/test/security.test.ts: 14 cases over health, the token, the Origin allowlist and the Host check"
  - "VERSION as the single version string reaching /api/health, the MCP serverInfo, the SDK client app string and the library user-agent"
affects: [01-08, phase 02 (provider keys land in a process that is no longer open), phase 07 (release and install docs)]

actuals:
  tokens: 47800
  tasks: 3
  commits: 2
  plan_head_before: a53edca05fda6a3a9035db8ca650aff6cf406163

tech-stack:
  added: []
  patterns:
    - "Authentication as one ordered middleware, not per-route guards: path exemption, Host, Origin, token, each with a lowercase sentence the caller can act on"
    - "Injection over an endpoint: a secret the browser needs arrives inside the document the server serves, so there is nothing for a hostile page to call"
    - "A caller-side change lands in the same commit as the enforcement it exists for; a commit that requires a token no caller sends is a broken commit"
    - "One version read once from the manifest, imported as a constant, never restated in a literal"

key-files:
  created:
    - server/test/security.test.ts
  modified:
    - server/src/config.ts
    - server/src/index.ts
    - server/src/mcp.ts
    - server/src/agent.ts
    - server/src/library.ts
    - server/test/api.test.ts
    - server/test/mcp.test.ts
    - server/test/usage.test.ts
    - web/src/lib/api.ts
    - web/src/lib/useLesson.ts
    - web/vite.config.ts
    - plugin/hooks/mirror.mjs
    - scripts/doctor.mjs
    - package.json
    - server/package.json
    - pnpm-lock.yaml
    - .env.example

key-decisions:
  - "Tasks 1 and 2 are one commit. The wave's first care point is explicit that the token must reach every caller in the same commit that starts requiring it; splitting enforcement (task 1) from the browser, the dev proxy, the hook and the doctor (task 2) would have left one commit in history where a fresh clone's app can only say 401."
  - "The lesson stream accepts the token as a `token` query parameter, and only that route does. EventSource cannot set a request header, so a header-only rule would have made the live lesson unreachable in production. The alternative considered was a Set-Cookie on the served HTML with SameSite=Strict; it was rejected because it creates ambient authority on a route that has none today, whereas a query parameter is carried only by the request that means to carry it."
  - "The injected document is registered ahead of serveStatic for `/` and `/index.html`. serveStatic serves the directory index itself, so with the SPA fallback alone the meta tag reached deep links and never reached the page the learner actually opens."
  - "A request with no Host header at all is refused by node's own HTTP parser with 400, before the middleware runs. The test asserts it does not get in rather than asserting 403, because claiming the middleware refused it would be a false statement about where the check lives."
  - "The Host cases are driven with node:http and setHost:false. `fetch` derives Host from the URL and ignores a supplied one, so a rebind can only be spelled at the socket — which is also exactly what an attacker does."
  - "server/src/mcp.ts imports server/src/config.ts rather than re-deriving the data directory and re-reading package.json. config.ts has no side effects, reads process.env exactly once, and is already the file that owns both TOKEN_PATH and VERSION."
  - "The version chosen is 0.4.0 — the highest already in the tree (plugin/.claude-plugin/plugin.json) — so no published artifact appears to go backwards. plugin.json was already at it and did not change."

patterns-established:
  - "Adding a consumer of the API means adding the x-derive-token header in the same change: server-side (read TOKEN_PATH), browser-side (the meta tag), or dev-proxy-side (the Vite configure hook)"
  - "A spawn-a-server test harness reads join(dataDir, 'token') right after its /api/health poll succeeds, which doubles as a live assertion that the health exemption works"

requirements-completed: [FOUND-06]

coverage:
  - id: D1
    description: "The server answers only on 127.0.0.1 by default and every /api route but health requires the install token"
    requirement: FOUND-06
    verification:
      - kind: integration
        ref: "server/test/security.test.ts#is refused with no token at all / #is let in with the right token"
        status: pass
      - kind: integration
        ref: "server/test/security.test.ts#is refused on the route that reads local folders (POST /api/materials/repo -> 401)"
        status: pass
      - kind: other
        ref: "scratch server on :4771 — curl /api/lessons 401, with header 200, /api/health 200 with no token"
        status: pass
      - kind: other
        ref: "serve() is called with hostname: HOST (server/src/index.ts), HOST defaults to 127.0.0.1 (server/src/config.ts)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The token file is 32 bytes of hex at mode 0600, written with wx on first boot and never overwritten"
    requirement: FOUND-06
    verification:
      - kind: unit
        ref: "server/test/security.test.ts#is 32 bytes of hex in a file only the learner can read"
        status: pass
      - kind: other
        ref: "scratch server restarted on the same DERIVE_DATA_DIR — token file contents identical before and after"
        status: pass
    human_judgment: false
  - id: D3
    description: "No endpoint hands the token out; the app receives it injected into the HTML it is served as (D-09)"
    requirement: FOUND-06
    verification:
      - kind: integration
        ref: "server/test/security.test.ts — every case asserts the token appears in no response body and no response header (health, the 401 refusal, a 200 listing, the 403s)"
        status: pass
      - kind: other
        ref: "curl / returns a meta name=\"derive-token\" whose content equals the token file; /api/health /api/stats /api/learners /api/lessons /api/review /api/atlas /api/library /api/profile scanned for the token value — none contains it"
        status: pass
      - kind: other
        ref: "grep of server/src/index.ts: the TOKEN constant is referenced at its creation (101), by the comparison buffer (102) and by the HTML injection (971), and nowhere else"
        status: pass
    human_judgment: false
  - id: D4
    description: "A missing or unreadable token file fails with a clear message naming the path and what to do (D-09)"
    requirement: FOUND-06
    verification:
      - kind: other
        ref: "server/src/index.ts ensureToken() throws three named sentences (could not write / could not read / is empty), each carrying TOKEN_PATH; server/src/mcp.ts throws the project's `derive server: ...` shape telling the learner to start Derive once"
        status: pass
    human_judgment: true
    rationale: "The wording is what a learner reads in Claude Code or the terminal when Derive has never run; whether it is clear enough is a judgment, not an assertion."
  - id: D5
    description: "Host must name loopback on this server's port, and Origin, when present, must match the allowlist by exact full-string equality"
    requirement: FOUND-06
    verification:
      - kind: integration
        ref: "server/test/security.test.ts#refuses a name that is not this server / #refuses loopback on a port that is not this one / #accepts both spellings of loopback on this port"
        status: pass
      - kind: integration
        ref: "server/test/security.test.ts#matches whole, so a longer port is a different origin (http://localhost:51730 and http://localhost:5173.evil.example both 403; http://localhost:5173 200)"
        status: pass
      - kind: other
        ref: "scratch server — curl -H 'Host: derive.example.com' 403; -H 'Origin: http://localhost:51730' 403; -H 'Origin: http://localhost:5173' 200"
        status: pass
    human_judgment: false
  - id: D6
    description: "CORS is scoped to ALLOWED_ORIGINS and x-derive-token is an allowed header"
    requirement: FOUND-06
    verification:
      - kind: other
        ref: "server/src/index.ts: cors({ origin: ALLOWED_ORIGINS, allowHeaders: ['content-type', 'x-derive-learner', 'x-derive-token'] }) — the wildcard is gone"
        status: pass
    human_judgment: false
  - id: D7
    description: "Every legitimate consumer carries the token: the browser, the Vite dev proxy, the stdio MCP server, the plugin hook, and the three test harnesses"
    requirement: FOUND-06
    verification:
      - kind: integration
        ref: "server/test/api.test.ts, server/test/mcp.test.ts, server/test/usage.test.ts — 88 pass / 0 fail, all three driving whole lessons through the middleware"
        status: pass
      - kind: other
        ref: "live dev-proxy smoke: server on :4310 and vite on :5173 sharing a scratch DERIVE_DATA_DIR — /api/health, /api/lessons and /api/stats through :5173 all 200 with real JSON"
        status: pass
      - kind: other
        ref: "node server/dist/mcp.js initialize over stdio against the same data dir returns serverInfo, and mcp.test.ts walks a whole lesson through the proxied tools"
        status: pass
    human_judgment: false
  - id: D8
    description: "Widening the bind is a gated, loud opt-in that keeps the token mandatory (D-12)"
    requirement: FOUND-06
    verification:
      - kind: other
        ref: "DERIVE_HOST=0.0.0.0 startup prints one [derive] line naming the port, the token file and the allowed origins; the default loopback start prints no such line"
        status: pass
      - kind: other
        ref: "no check is weakened for the wider bind — the middleware is the same code path; DERIVE_HOST only adds its own name to ALLOWED_HOSTS"
        status: pass
    human_judgment: false
  - id: D9
    description: "Static serving no longer depends on the working directory"
    requirement: FOUND-06
    verification:
      - kind: other
        ref: "node /home/jicanta/derive/server/dist/index.js run with cwd=/tmp — GET /assets/<built asset> returns 200"
        status: pass
    human_judgment: false
  - id: D10
    description: "scripts/doctor.mjs reports the token and fails on any mode but 0600"
    requirement: FOUND-06
    verification:
      - kind: other
        ref: "0600 -> ok line with (0600); chmod 644 -> fail naming mode 0644 with a chmod fix; absent -> warn with 'start Derive once'"
        status: pass
    human_judgment: false
  - id: D11
    description: "One version string reaches every place that reports one, and the agent SDK is pinned to a caret range"
    requirement: FOUND-06
    verification:
      - kind: other
        ref: "GET /api/health -> version 0.4.0 == server/package.json version; MCP initialize -> serverInfo.version 0.4.0"
        status: pass
      - kind: other
        ref: "literal scan of index.ts, mcp.ts, agent.ts, library.ts for 0.4.0 / 0.2.0 / Derive/0.3 outside comments -> 0, 0, 0, 0"
        status: pass
      - kind: other
        ref: "pnpm-lock.yaml resolved @anthropic-ai/claude-agent-sdk 0.3.261 before and after; only the specifier line changed; pnpm install --frozen-lockfile succeeds"
        status: pass
    human_judgment: false

duration: 18 min
completed: 2026-09-18
---

# Phase 01 Plan 07: Server Hardening Summary

The local server now answers on 127.0.0.1 only, behind a 0600 per-install token that
every caller carries and no endpoint hands out, with a Host check that defeats DNS
rebinding and a whole-string Origin allowlist — and one version string instead of six.

## What Shipped

**The front door.** `server/src/index.ts` gained `ensureToken()` (32 bytes from
`randomBytes`, hex, written `0o600` with the `wx` flag so a racing boot cannot clobber a
token the app is already holding) and one `app.use('/api/*', ...)` middleware that runs
four checks in order: `/api/health` is exempt, the `Host` header must name loopback (or
the configured interface) on this server's own port, an `Origin` — when the browser sends
one — must equal a member of `ALLOWED_ORIGINS` whole, and `x-derive-token` must match the
install token under `timingSafeEqual`. `serve()` is now given `hostname: HOST`, default
`127.0.0.1`. `cors({ origin: '*' })` is gone.

`POST /api/materials/repo` — the route that walks any readable directory, and the reason
the objective names this as the last quiet moment — is behind the same gate, asserted
directly in `server/test/security.test.ts`.

**Every caller, in the same commit.** The browser gets the token injected into the
`index.html` the server serves (D-09: there is deliberately nothing to call) and reads it
back through `deriveToken()` in `web/src/lib/api.ts`. The Vite dev proxy reads
`<data dir>/token` lazily on the first proxied request and sets the header — lazily
because `pnpm dev` starts Vite and the server together and the file may not exist yet when
the config is evaluated. `server/src/mcp.ts` and `plugin/hooks/mirror.mjs` read the file
directly; both run as the same user in the learner's own terminal. `scripts/doctor.mjs`
reports it and fails on any mode but 0600.

**D-12.** `DERIVE_HOST` other than loopback prints one `[derive]` line naming the port,
the token file and the allowed origins, and adds nothing but its own host name to the
allowlist. `DERIVE_ORIGINS` extends the browser allowlist. No check is weakened.

**One version.** `VERSION` in `server/src/config.ts`, read once from `server/package.json`
with `createRequire` (the mechanism `server/src/backend.ts` already uses; an import
attribute would change the build output). It replaced five literals: the health route,
the `McpServer` serverInfo, the `createSdkMcpServer` version, `CLAUDE_AGENT_SDK_CLIENT_APP`
and the library user-agent. The root and server manifests moved `0.1.0 -> 0.4.0`, matching
`plugin/.claude-plugin/plugin.json`, which was already there.

**The SDK pin.** `@anthropic-ai/claude-agent-sdk` moved from `latest` to `^0.3.261`. The
lockfile's resolved version is `0.3.261` before and after — only the `specifier:` line
changed — and `pnpm install --frozen-lockfile` succeeds.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] Tasks 1 and 2 committed as one commit**

- **Found during:** Task 1, before committing
- **Issue:** The plan commits task 1 (enforcement, the MCP server, the test harnesses)
  separately from task 2 (the browser, the dev proxy, the plugin hook, the doctor). The
  wave brief's first care point is explicit that the token must reach every caller in the
  same commit that starts requiring it, and that a commit adding enforcement without a
  caller's token is a broken commit even if a later one fixes it.
- **Fix:** Both tasks were implemented and verified, then committed together as
  `feat(01-07): answer on loopback only, behind a per-install token`. No intermediate
  commit exists in which a fresh clone's app can only say 401.
- **Files modified:** all of tasks 1 and 2
- **Verification:** `pnpm build && pnpm test` green at the commit; the acceptance criteria
  of both tasks were run against a scratch server before it.
- **Commit:** 50fd58b

**2. [Rule 3 - Blocker] EventSource cannot set a header, so the lesson stream accepts the token in the query string**

- **Found during:** Task 1
- **Issue:** `web/src/lib/useLesson.ts` subscribes to `/api/lessons/:id/stream` with
  `EventSource`, which has no way to set a request header. A header-only rule would have
  made every live lesson unreachable in production.
- **Fix:** The middleware falls back to a `token` query parameter, and only for a path
  ending in `/stream`; `useLesson.ts` appends it when the meta tag is present (in dev it
  is absent and the Vite proxy sets the header instead). A `Set-Cookie` on the served HTML
  with `SameSite=Strict` was the alternative and was rejected: it creates ambient
  authority on requests that carry none today.
- **Files modified:** `server/src/index.ts`, `web/src/lib/useLesson.ts` (the latter is not
  in the plan's `files_modified`)
- **Verification:** scratch server — `/api/lessons/nope/stream?after=0&token=<t>` returns
  404 (past auth, lesson not found); the same URL without the token returns 401.
- **Commit:** 50fd58b

**3. [Rule 1 - Bug] serveStatic served the un-injected index.html for `/`**

- **Found during:** Task 2 acceptance check
- **Issue:** `app.use('/*', serveStatic(...))` serves the directory index itself, so the
  injected document only reached deep links through the SPA fallback. `curl /` returned
  HTML with no `derive-token` meta tag — the page the learner actually opens would have
  had no token.
- **Fix:** The injected document is registered for `/` and `/index.html` ahead of
  `serveStatic`; the SPA fallback is unchanged.
- **Files modified:** `server/src/index.ts`
- **Verification:** `curl /` and `curl /atlas` both contain a meta tag whose content
  equals the token file; `/assets/<built asset>` still 200.
- **Commit:** 50fd58b

**4. [Rule 3 - Blocker] server/test/usage.test.ts also spawns a server**

- **Found during:** Task 1
- **Issue:** The plan names `api.test.ts` and `mcp.test.ts` as the harnesses to update.
  `server/test/usage.test.ts` (from plan 01-06) spawns its own server too and failed with
  401.
- **Fix:** Same treatment — read `join(dataDir, 'token')` after the health poll and send
  the header on its two calls.
- **Files modified:** `server/test/usage.test.ts` (not in the plan's `files_modified`)
- **Verification:** 88 pass / 0 fail.
- **Commit:** 50fd58b

**5. [Rule 1 - Bug] `fetch` ignores a supplied Host header, so the Host cases use node:http**

- **Found during:** Task 1
- **Issue:** The first draft of the Host cases used `fetch` and got 200s: undici derives
  `Host` from the URL and drops a supplied one, so the case was not testing anything.
- **Fix:** A small `raw()` helper in `server/test/security.test.ts` issues the request
  through `node:http` with `setHost: false`, which is also exactly how a rebind would
  arrive.
- **Files modified:** `server/test/security.test.ts`
- **Verification:** `derive.example.com` and `127.0.0.1:<other port>` both 403;
  `localhost:<port>` and `127.0.0.1:<port>` both 200.
- **Commit:** 50fd58b

**6. [Rule 1 - Bug] a request with no Host header is refused with 400, not 403**

- **Found during:** Task 1
- **Issue:** A case asserting 403 for a missing `Host` failed with 400 — HTTP/1.1 requires
  the header and node's own parser turns the request away before Hono sees it.
- **Fix:** The case asserts the request does not get in (`status >= 400`) and says in a
  comment where the refusal comes from. Claiming the middleware refused it would have been
  a false statement about where the check lives.
- **Files modified:** `server/test/security.test.ts`
- **Commit:** 50fd58b

### Process deviations

**7. Committed on `main`.** `git.branching_strategy` for this project is `"none"` and every
GSD commit in this repo, including plans 01-01 through 01-06, is on `main`. Recorded here
the way the earlier plans did.

**8. `plugin/.claude-plugin/plugin.json` is in `files_modified` but was not changed.** It
already carried `0.4.0`, which is the version the other two manifests were raised to, so
touching it would have been a no-op diff.

**Total deviations:** 6 auto-fixed (1 blocker-ordering, 3 blockers, 3 bugs — items 5 and 6
are both in the same test file), 2 process notes. **Impact:** none on scope. Every
deviation is either a caller the plan's file list did not enumerate or a place where the
runtime disagreed with the plan's assumption about how a header behaves.

## Authentication Gates

None.

## Known Stubs

None.

## Threat Flags

None. The plan's `<threat_model>` covers the surface this plan touches; T-07-01 through
T-07-05 and T-07-SC are all mitigated as written, T-07-06 and T-07-07 are accepted as
written. The one addition to the mitigation surface is the stream route's query-parameter
fallback (deviation 2), which carries the same secret as the header and no ambient
authority; it is noted here so plan 01-08's redaction chokepoint can see it.

## Verification

| Check | Result |
|-------|--------|
| `pnpm typecheck` | clean, no `error TS` |
| `pnpm build && pnpm test` | 88 pass / 0 fail |
| `pnpm method:check` | 6 rendered copies match `method/` (untouched by this plan) |
| `pnpm install --frozen-lockfile` | succeeds, no `ERR_PNPM_OUTDATED_LOCKFILE` |
| `node --check scripts/doctor.mjs`, `node --check plugin/hooks/mirror.mjs` | both clean |
| version literal scan of the four source files | 0, 0, 0, 0 |

The suite was at 74 pass / 0 fail entering this plan and is at 88 pass / 0 fail leaving it;
the 14 new cases are `server/test/security.test.ts`.

## Issues Encountered

None outstanding.

## Next

Ready for 01-08 — the SSRF and path-read hardening of D-10, and the redaction chokepoint of
D-11, which registers this plan's install token as its first live secret.

## Self-Check: PASSED

- `server/test/security.test.ts` exists on disk.
- `.planning/phases/01-foundation/01-07-SUMMARY.md` exists on disk.
- Commits `50fd58b` and `3be5f60` exist in `git log`.
- `commits: 2` is measured: `git rev-list --count a53edca..HEAD` before the docs commit.
