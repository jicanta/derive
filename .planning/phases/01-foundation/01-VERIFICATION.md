---
phase: 01-foundation
verified: 2026-09-20T12:10:00Z
status: gaps_found
score: 4/5 must-haves verified
covered_files:
  - .env.example
  - .planning/REQUIREMENTS.md
  - .planning/ROADMAP.md
  - .planning/phases/01-foundation/01-01-PLAN.md
  - .planning/phases/01-foundation/01-01-SUMMARY.md
  - .planning/phases/01-foundation/01-02-PLAN.md
  - .planning/phases/01-foundation/01-02-SUMMARY.md
  - .planning/phases/01-foundation/01-03-PLAN.md
  - .planning/phases/01-foundation/01-03-SUMMARY.md
  - .planning/phases/01-foundation/01-04-PLAN.md
  - .planning/phases/01-foundation/01-04-SUMMARY.md
  - .planning/phases/01-foundation/01-05-PLAN.md
  - .planning/phases/01-foundation/01-05-SUMMARY.md
  - .planning/phases/01-foundation/01-06-PLAN.md
  - .planning/phases/01-foundation/01-06-SUMMARY.md
  - .planning/phases/01-foundation/01-07-PLAN.md
  - .planning/phases/01-foundation/01-07-SUMMARY.md
  - .planning/phases/01-foundation/01-08-PLAN.md
  - .planning/phases/01-foundation/01-08-SUMMARY.md
  - .planning/phases/01-foundation/01-09-PLAN.md
  - .planning/phases/01-foundation/01-09-SUMMARY.md
  - .planning/phases/01-foundation/01-10-PLAN.md
  - .planning/phases/01-foundation/01-10-SUMMARY.md
  - .planning/phases/01-foundation/01-11-PLAN.md
  - .planning/phases/01-foundation/01-11-SUMMARY.md
  - .planning/phases/01-foundation/01-12-PLAN.md
  - .planning/phases/01-foundation/01-12-SUMMARY.md
  - .planning/phases/01-foundation/01-13-PLAN.md
  - .planning/phases/01-foundation/01-13-SUMMARY.md
  - .planning/phases/01-foundation/01-14-PLAN.md
  - .planning/phases/01-foundation/01-14-SUMMARY.md
  - .planning/phases/01-foundation/01-15-PLAN.md
  - .planning/phases/01-foundation/01-15-SUMMARY.md
  - .planning/phases/01-foundation/01-16-PLAN.md
  - .planning/phases/01-foundation/01-16-SUMMARY.md
  - .planning/phases/01-foundation/01-17-PLAN.md
  - .planning/phases/01-foundation/01-17-SUMMARY.md
  - .planning/phases/01-foundation/01-18-PLAN.md
  - .planning/phases/01-foundation/01-18-SUMMARY.md
  - .planning/phases/01-foundation/01-19-PLAN.md
  - .planning/phases/01-foundation/01-19-SUMMARY.md
  - .planning/phases/01-foundation/01-REVIEW.md
  - README.md
  - scripts/doctor.mjs
  - server/src/config.ts
  - server/src/db.ts
  - server/src/driver.ts
  - server/src/index.ts
  - server/src/mcp.ts
  - server/src/migrations.ts
  - server/src/repo.ts
  - server/src/tickets.ts
  - server/test/api.test.ts
  - server/test/guards.test.ts
  - server/test/mcp.test.ts
  - server/test/migrations.test.ts
  - server/test/security.test.ts
  - server/test/spawn.ts
  - server/test/tx.test.ts
  - server/test/usage.test.ts
covered_digest: "v1:sha256:60a55f075a6269988e1094aef2656f49b129b0856f252ce288d2b7623b39dfde"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 3/5
  gaps_closed:
    - "Success Criterion 5 — a repo import executed a command the repository carried through `core.fsmonitor`. Reproduced closed against the built server: a local git repo whose own `.git/config` sets `core.fsmonitor` to a shell script, posted to `POST /api/materials/repo`, imported normally (201, README.md, 1 page) and left the sentinel unwritten, `STOLEN.txt` absent, and `GET /api/materials/:id?text=1` carrying 0 occurrences of the 64-hex install token. The pin is load-bearing: the identical `git ls-files` invocation without `-c core.fsmonitor=false` writes the sentinel (YES), with it does not (no)."
    - "Success Criterion 5 (usage half) — the ledger invariant was false on every upgraded install. Reproduced closed: a database written by `server/src/db.ts` at b8f255c (one lesson, three events, `user_version` 0) opened on HEAD lands at `user_version` 4 with `turns: 1, usage: 1`, the one row all-null with `cost_source 'unknown'`, and `derive.db.bak-v0` written beside it. `server/src/db.ts:658-673` now states the boundary, including the migration-4 case, instead of asserting an invariant the upgrade path broke."
    - "The install token on a process command line — `server/src/mcp.ts` now mints a one-use sixty-second ticket (`POST /api/handoff`) and spawns the opener with `execFile`, no shell, no token in the URL. Driven: handoff is 401 without a credential and 200 with it, the body carries no token, the first `GET /?ticket=` is 302 to `/` with the query dropped and a `Set-Cookie`, the second is 401, and an unminted ticket is 401."
    - "`hostNames` fails closed — `server/src/index.ts:166` is `if (!addr) return new Set<string>();` and the surrounding doc states the consequence plainly."
    - "The suite needed a second run — four consecutive `pnpm test` invocations on this tree each exited 0 with `# pass 196 / # fail 0 / # cancelled 0`. `server/test/spawn.ts` gives each spawned server an OS-confirmed-free port."
  gaps_remaining: []
  regressions:
    - "New this round: the browser credential's advertised revocation mechanism does not work on a running server (01-REVIEW.md CR-01), reproduced end to end. See gaps below."
    - "New this round: `server/src/repo.ts:123`'s security rationale asserts clone-argv pins that the clone argv at :303 does not carry (01-REVIEW.md WR-03)."
gaps:
  - truth: "The browser session is revocable without a code change: deleting or rotating the install token file invalidates every cookie ever issued — stated in four learner-facing places as the justification for a thirty-day persistent credential"
    status: failed
    reason: >-
      Reproduced end to end against the built server on a scratch data
      directory and an OS-allocated port. A browser signed in with
      `GET /?token=<t>` and held `derive_session=<hmac>; Max-Age=2592000`.
      `~/.derive/token` was then deleted — the exact action the product
      instructs the learner to take — and the server was left running.
      `GET /api/lessons` with that cookie: 200. `GET /api/lessons` with the
      old `x-derive-token` header: 200. `GET /` with that cookie: 200.
      Nothing was revoked.

      The mechanism is plain in the source and matches the reproduction:
      `TOKEN = ensureToken()` reads `TOKEN_PATH` exactly once at module
      evaluation (`server/src/index.ts:94`, called at :103), `SESSION` is
      derived from it once at :107, and `TOKEN_BUF`/`SESSION_BUF` are frozen
      module state. `grep -n TOKEN_PATH server/src/index.ts` shows the path
      afterwards only inside error strings — nothing ever re-reads the file.
      Deleting or rotating it changes nothing until the process restarts, and
      because `ensureToken()` then mints a *different* token, the learner gets
      no signal that the revocation they performed was a no-op.

      This is not a stale comment. It is a security control the product tells
      the learner to rely on, in four places, as the stated reason a thirty-day
      persistent cookie is defensible: `.env.example:38`, `server/src/index.ts:1191`
      (the `DERIVE_HOST` widened-bind warning, i.e. precisely the plaintext-LAN
      scenario where a leaked cookie matters), `server/src/index.ts:1113` (the
      `issueSession` rationale), and the thirty-day story `README.md:63` /
      `scripts/doctor.mjs:118` build on it.

      It falsifies plan 01-19's must-have truth — "The session cookie is
      revocable without a code change: its value is derived from the install
      token, so rotating or deleting the token file invalidates every cookie
      ever issued. That is stated where a learner can find it." Only the second
      sentence is true. It also violates the standing prohibition carried
      verbatim by all four plans this round ("Never state an invariant the code
      does not hold — fix the code or qualify the sentence, never neither").
      01-19's own HC-1 sequence knows the difference: its step 5 says "Delete
      `~/.derive/token`, **restart the server**, and reload" — the restart the
      four shipped sentences omit.
    artifacts:
      - path: "server/src/index.ts"
        issue: >-
          Lines 83-117: `TOKEN`/`SESSION`/`TOKEN_BUF`/`SESSION_BUF` are
          boot-time snapshots; the `/api/*` middleware (:260) and the document
          middleware (:1155, :1158) compare against those snapshots, never
          against the file. Line 1113's `issueSession` comment and line 1191's
          widened-bind warning both state revocation that cannot happen while
          the process lives. Line 1118 is where the thirty-day `maxAge` that
          rests on it is set.
      - path: ".env.example"
        issue: 'Line 38: "deleting the token file signs every browser out" — false on a running server.'
      - path: "README.md"
        issue: 'Line 63: the thirty-day sign-in story is told with no mention that a restart is required to end it.'
      - path: "scripts/doctor.mjs"
        issue: 'Line 118: the closing line repeats the thirty-day story built on the same unavailable revocation.'
      - path: "server/test/security.test.ts"
        issue: >-
          Line 584, `it('is revoked by rotating the install token, which is why
          a thirty-day life is defensible')`, passes without driving revocation:
          it starts a *second* server with its own data directory and asserts
          the first refuses the second's cookie. That is install isolation, not
          revocation. No case deletes or rotates the token file of a running
          server, which is why a control that does not work shipped green.
    missing:
      - "Pick one and do it. (a) Make revocation real: read the token file behind a short cache (about one second) and have both credential middlewares compare against that live value rather than the boot snapshot, calling `registerSecret` on each new value so the redaction chokepoint keeps covering the live token. (b) Or correct all four learner-facing sentences plus the `issueSession` comment to say what is actually required — 'delete the token file **and restart derive** to sign every browser out'. Doing neither is what the standing prohibition forbids."
      - "Whichever branch is taken, make `server/test/security.test.ts:584` drive it: delete or rewrite the token file of the running fixture server and assert the outcome the sentences promise. A case named for revocation that never revokes is the shape that let this ship."
      - "This is a judgment call about a security posture, not a mechanical fix. Record the decision (real revocation vs corrected wording) before building, the way 01-18 recorded its ledger-shape branch."
  - truth: "`server/src/repo.ts`'s security rationale describes mitigations that exist"
    status: partial
    reason: >-
      The `gitListFiles` comment added this round (`server/src/repo.ts:123`)
      names six knobs it deliberately does not pin on the listing argv —
      `core.sshCommand`, `credential.helper`, `filter.*.clean`, `diff.external`,
      `uploadpack.packObjectsHook`, `protocol.*` — and ends "they are already
      pinned where they are reachable, on the clone argv below." The clone argv
      at `server/src/repo.ts:303` carries only
      `-c http.followRedirects=false -c protocol.allow=never -c
      protocol.https.allow=always`. Of the six, only `protocol.*` is pinned;
      the other five are pinned nowhere in the file. The clone path also does
      not set `GIT_CONFIG_NOSYSTEM=1`, which the listing path now does.

      No exploit follows from it today — a hostile remote cannot write the
      fresh clone's config and credential helpers are host-scoped — so this is
      a warning, not the blocker. It is recorded because it is the same
      standing prohibition as the gap above, in a load-bearing security comment,
      in the file whose whole module docstring is about confinement, and
      `CLAUDE.md` says comments here exist "so a future change does not undo it
      by accident". This one guarantees the opposite.
    artifacts:
      - path: "server/src/repo.ts"
        issue: 'Line 123 asserts five pins that line 303 does not carry.'
    missing:
      - "Either add the pins to the clone argv (`-c core.sshCommand=false -c credential.helper= -c core.pager=cat -c core.fsmonitor=false -c core.hooksPath=/dev/null` plus `GIT_CONFIG_NOSYSTEM: '1'` in its env), which costs nothing and makes the sentence true, or rewrite the sentence to say the knobs are unreachable on both paths and pinned on neither."
deferred: []
advisory:
  - finding: "`server/src/driver.ts:108-117` and `server/src/index.ts:1033` — `endTurn`'s new transaction is not exception-safe, and the sink raises its idempotency guard before the write."
    category: other
    reason: >-
      01-REVIEW.md WR-01, confirmed by reading the source: `ended = true` is set
      at driver.ts:110 before `endTurnRow(turnId, ...)` at :116, and
      `emit(lessonId, 'turn_end', payload)` is on the line after it. If the
      ledger write throws (SQLITE_BUSY, disk full) both halves roll back, the
      guard is already up so `agent.ts`'s catch/finally retries return
      immediately, the turn row stays `'running'` and `busy()` reports the
      lesson busy for the rest of the process's life with no `turn_end` on the
      SSE stream. The boot sweep repairs it, but only on the next restart. The
      index.ts:1033 call is unguarded in the same way, so a throw becomes a 500
      and skips the `emit` on the next line. 01-18's own must-have truth — the
      pair lands in one transaction — does hold; this is a liveness regression
      beside it, not a falsification of it. Raised rather than counted because I
      could not force a write failure here.
    evidence_status: "mechanism read from source and confirmed line by line; the failing write could not be induced in this sandbox"
  - finding: "`server/src/config.ts:9-16` validates `PORT` in the module body, and `server/src/mcp.ts:40` imports from that module, so an invalid `PORT` kills the stdio MCP server that never reads it."
    category: other
    reason: >-
      01-REVIEW.md WR-09, reproduced: `PORT=abc node server/dist/mcp.js` dies
      with `Error: the PORT setting must be a whole number between 1 and 65535
      (got abc)` before the transport is up. The MCP server addresses Derive by
      `DERIVE_URL` and has no use for `PORT` at all, so a learner with a typo'd
      `PORT` in their shell or `.env` gets the Claude Code plugin and the Codex
      skills failing to start for a reason that has nothing to do with them —
      on the very paths Success Criterion 1 is about. Raised rather than counted
      because it requires an already-invalid setting and the server itself
      refuses the same value. Resolved by making `PORT` a validated getter, or
      by an `assertPort()` that only `index.ts` calls before `serve()`.
    evidence_status: "reproduced — the built stdio MCP server exits at startup on PORT=abc"
  - finding: "`server/src/index.ts:1182` still prints `http://localhost:<port>/?token=<install token>` to stdout on every start."
    category: security
    reason: >-
      Reproduced again this round: the captured stdout of a scratch server
      contains the 64-hex token exactly once, in a stream with ordinary
      permissions, while the token file is 0600. A log is inside Success
      Criterion 5's own enumeration, so this is on the edge of counting;
      it is carried as advisory because it is a stated decision
      (`server/src/index.ts:102` names the startup line as the one place the
      token is written out, with the reason) and because the previous round
      classified it the same way. What changed is that the one-time ticket the
      advisory proposed now exists (`server/src/tickets.ts`) and was wired to
      the MCP browser open but not to the startup line — a sixty-second ticket
      cannot serve a link meant to be usable whenever the learner returns, so
      resolving it needs a decision, not a substitution.
    evidence_status: "reproduced — 1 occurrence of the install token in the captured server stdout"
  - finding: "`server/src/mcp.ts:253` — `start_lesson` still returns a tokenless, ticketless `url`, so with `open_browser: false` or `DRIVER='app'` the model reports a link that 401s (WR-02, explicitly not absorbed by this round)."
    category: other
    reason: >-
      Confirmed by reading: `withTicket` is applied only inside the
      `open_browser !== false && DRIVER !== 'app'` branch; the returned object
      carries `url: l.url`. The default plugin path is unaffected, so this
      rides with the human parity run (HC-2) rather than blocking. It stays a
      live cost against the one-screen-one-next-step rule: the 401 body asks a
      learner mid-lesson to read a 0600 file out of their data directory.
    evidence_status: "code read; the default path is covered by mcp.test.ts, the non-default ones by nothing"
  - finding: "`server/src/index.ts:106-113` — the session cookie's value is one constant for the whole install, so its `Max-Age` bounds only the honest browser (WR-02 in the review)."
    category: security
    reason: >-
      Confirmed by reading and by the reproduction above: every cookie ever
      issued by an install carries the identical `HMAC(TOKEN, 'derive browser
      session v1')`, with no per-browser identity, no issue time and no nonce.
      A `Max-Age` is a client-side hint and places no bound on a captured value;
      moving from a memory-only cookie to `Max-Age=2592000` also moves the value
      into the browser profile's on-disk store. Bundled here rather than in the
      blocker because the blocker is the false revocation claim; this is the
      comment at :112 presenting a convenience bound as a security bound.
    evidence_status: "code read; the constant value was observed directly in the Set-Cookie header of the reproduction"
  - finding: "`server/test/guards.test.ts:129-154` — two of the three 'hostile repository' cases pass without exercising the pin they are named for (WR-08); `server/test/guards.test.ts:94-211` leaks about a dozen temp directories per run, one full of 0755 /bin/sh scripts (WR-07); `server/test/spawn.ts:68-73` lets a caller's `env.PORT` desynchronise the child from the port the helper polls (WR-05)."
    category: other
    reason: >-
      Test-hygiene findings from 01-REVIEW.md, all in files this round modified.
      Independently confirmed for WR-08 by the same experiment that proved the
      `core.fsmonitor` pin load-bearing: `git ls-files` runs no hooks and pages
      nothing into a pipe, so the `core.hooksPath` and `core.pager` cases assert
      the absence of a command that was never going to run. They are
      defence-in-depth pins with no regression test, held in place only by the
      brittle source-text assertion at :156-165. Grouped as advisory because
      none of them falsifies a phase must-have.
    evidence_status: "WR-08 confirmed by direct experiment; WR-05 and WR-07 read from source"
behavior_unverified_items: []
coincidental_reliance_items: []
human_verification:
  - test: >-
      HC-2 — the plugin and Codex parity run (Success Criterion 1's human half,
      FOUND-04). On a machine with a Claude Code login: `pnpm build && pnpm start`,
      then in a second terminal run `/derive:learn` through the plugin and take one
      lesson from the probe through a plan, one taught node, one graded quiz and
      `end_lesson`. Repeat on a ChatGPT login with the `derive-learn` Codex skill.
    expected: >-
      Both complete exactly as before the phase: the graph renders, cards are
      answered from the terminal and mirrored into the browser, the understanding
      gate refuses a lock without an intuition or transfer pass, and `end_lesson`
      closes cleanly. No tool is missing, renamed or reshaped.
    why_human: >-
      Needs a real model, a provider login and a person on two terminals. The
      machine half is already evidence — `server/test/wire-surface.json` is
      byte-identical since 01-02 (`git diff --quiet 239d5f1..HEAD` exits 0) and
      the modelless stdio smoke test walks start_lesson → set_plan → answer →
      node_status → quiz → answer → end_lesson green — but no automated case runs
      a model. `.planning/WINDOWS.md` entry 5.
  - test: >-
      HC-1 — real-browser session smoke. `pnpm build && pnpm start`; open the
      printed `http://localhost:4310/?token=…` link in a real browser; start a
      lesson and answer one card; close the browser entirely, reopen it and go to
      `http://localhost:4310/` with no query string; then delete `~/.derive/token`,
      restart the server, and reload with no query string.
    expected: >-
      302 to `/` with the query gone; the lesson stream connects and cards render
      on the `derive_session` cookie with no `x-derive-token` header sent by the
      page; the reopened browser loads without a query string; and after the token
      file is deleted **and the server restarted** the reload is 401. Note that
      without the restart it is 200 — that is the blocker above, and this check
      should be re-run once it is resolved.
    why_human: >-
      No automated test drives a real browser. curl proves the cookie
      authenticates `/api/lessons` and that the handoff 302 sets it; nothing
      proves the page's own `fetch` and `EventSource` carry it, and no case covers
      the lesson SSE stream on the cookie at all. `.planning/WINDOWS.md` entry 4.
  - test: >-
      An ordinary public URL fetched through `fetchPublic` (`server/src/library.ts`)
      — add a link to the library from a machine with DNS and outbound network.
    expected: >-
      The page is fetched, its text extracted and stored as a resource, with the
      SSRF guard admitting the public host rather than refusing it.
    why_human: >-
      The execution environment has no DNS or outbound network, so only the
      refusal side of `assertPublicHost` is driven by the suite. Carried from
      `.planning/WINDOWS.md` entry 3.
---

# Phase 1: Foundation Verification Report

**Phase Goal:** The tutor's 14 tools and its method text exist once and feed every surface; every driver sits behind one interface and one event sink; every turn's raw usage is recorded; the database migrates transactionally; the local server is hardened before it ever holds a key — and the Claude Code plugin and Codex paths are proven unchanged throughout.
**Verified:** 2026-09-20T12:10:00Z
**Status:** gaps_found
**Re-verification:** Yes — fourth pass, after gap-closure plans 01-16 … 01-19

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP Success Criterion) | Status | Evidence |
|---|---|---|---|
| 1 | Plugin and Codex lessons complete as before; the wire-surface snapshot is unchanged and a modelless stdio MCP smoke test passes | ✓ VERIFIED (machine half) / human (HC-2) | `git diff --quiet 239d5f1..HEAD -- server/test/wire-surface.json` exits 0 — the fixture has not moved since 01-02 (6e3d603), i.e. through every plan from 01-03 to 01-19. `server/test/mcp.test.ts` drives the *built* `server/dist/mcp.js` over stdio: `tools/list` in declaration order against the pre-phase set, then start_lesson → set_plan → answer → set_phase → node_status → quiz → answer → end_lesson with no model. Green on four consecutive full runs. The human half is HC-2, still open. |
| 2 | Editing the single method source updates all five rendered targets together; CI fails on drift | ✓ VERIFIED | `pnpm method:check` → "6 rendered copies match method/", exit 0. Driven the other way in a copied tree (repo untouched): appending one sentence to `method/10-philosophy.md` made the checker report 4 drifted copies (`server/src/method.generated.ts`, `plugin/skills/teach/SKILL.md`, both Codex `SKILL.md`s) and exit 1. `.github/workflows/ci.yml` runs `pnpm method:check` as the first gate, before typecheck, build and test. |
| 3 | A new driver is one `Driver.runTurn(ctx, sink)` with no change to the web UI, the SSE stream or the terminal mirrors | ✓ VERIFIED | `server/src/driver.ts` (136 lines) defines the interface and `sinkFor`; `server/src/drivers/fake.ts` (86 lines) is the proof driver, imported by `server/test/driver.test.ts:18` and `server/test/usage.test.ts:33`. `driver.test.ts` asserts the scripted sequence in call order against a copy of `EVENT_TYPES` taken from `web/src/lib/useLesson.ts`, plus `adding a driver takes one runTurn and nothing else`. `git diff --stat 0f70ebb..HEAD` shows no `web/` file touched this round. |
| 4 | An existing `~/.derive` database migrates forward under a numbered transactional runner; an interrupted `replaceGraph` or `deleteLesson` leaves no partial state | ✓ VERIFIED | Reproduced with real pre-phase code: a database written by `server/src/db.ts` at b8f255c in a detached worktree (one lesson, three events, `PRAGMA user_version` 0, no `turns`/`usage` tables) opened on HEAD → `user_version` 4, rows preserved, `derive.db.bak-v0` written beside it. `withTx`, `replaceGraph`, `deleteLesson`, `deleteLearner` suites all green. |
| 5 | Loopback-only bind with a per-install token, foreign Host and Origin refused, no secret on any error/log/event/export/vault path; every turn stores raw usage with the model id and a cost source | ✗ FAILED | Every enumerated clause holds and was reproduced (table below) — **but** the browser credential ships with an advertised revocation mechanism that does not work, in four learner-facing places, as the stated justification for a thirty-day persistent cookie. Reproduced: token file deleted on a running server, cookie still 200, old header still 200. See Gaps. |

**Score:** 4/5 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `server/src/tools.ts` | One registry for all 22 wire tools | ✓ VERIFIED | 473 lines; imported by `agent.ts`, `codex.ts`, `mcp.ts`, `index.ts` — the four surfaces the criterion names |
| `server/test/wire-surface.json` | Frozen snapshot | ✓ VERIFIED | 1737 lines, byte-identical since 6e3d603 |
| `method/` + `server/src/method.generated.ts` | Single method source, rendered | ✓ VERIFIED | 6 rendered copies; drift driven red in a copied tree |
| `server/src/driver.ts` | `Driver.runTurn(ctx, sink)` + one sink | ✓ VERIFIED | 136 lines, `sinkFor` is the single event path |
| `server/src/drivers/fake.ts` | The proof driver | ✓ VERIFIED | 86 lines, wired into two suites |
| `server/src/migrations.ts` | Numbered transactional runner | ✓ VERIFIED | 422 lines, four migrations, `snapshot()` before applying |
| `server/src/tickets.ts` | One-use handoff ticket | ✓ VERIFIED | 59 lines, `mintTicket`/`redeemTicket`, wired at `index.ts:320` and `:1165` and `mcp.ts:204-263` |
| `server/test/spawn.ts` | One shared OS-allocated-port spawn helper | ✓ VERIFIED | 109 lines; four consecutive green suite runs. `env.PORT` trap noted in Advisory |
| `server/src/index.ts` | Hardened front door | ⚠️ HOLLOW | All enumerated hardening present and driven; the revocation control it advertises is not wired to anything that reads the token file after boot |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `method/*.md` | 6 rendered targets | `scripts/render-method.mjs` → `scripts/check-method.mjs` → CI | ✓ WIRED | drift driven red |
| `server/src/tools.ts` | `mcp.ts`, `index.ts`, `agent.ts`, `codex.ts` | `descriptionFor`/`shapeFor`/`toolsFor` | ✓ WIRED | grep confirms all four import sites |
| hostile `.git/config` | `gitListFiles` spawn | `-c core.fsmonitor=false` on the argv, before the process exists | ✓ WIRED | pin proven load-bearing by control experiment |
| migration 2 `backfillTurns` | migration 4 `backfillUsage` | `turns` → `usage`, `NOT EXISTS`, `status <> 'running'` | ✓ WIRED | was NOT_WIRED last round; reproduced `turns: 1, usage: 1` |
| `db.endTurn` | `finishTurn` + `closeUsage` | one `withTx` | ✓ WIRED | both former call sites (`driver.ts:116`, `index.ts:1033`) now call it |
| `mcp.ts start_lesson` | `POST /api/handoff` → `execFile(opener)` → `GET /?ticket=` → `issueSession` | one-use 60s ticket | ✓ WIRED | full lifecycle driven |
| `~/.derive/token` (the file) | the credential check on a live request | — | ✗ NOT_WIRED | **this is the blocker.** The middlewares compare against boot-time `TOKEN_BUF`/`SESSION_BUF`; nothing re-reads the file, so the advertised revocation reaches nothing |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `usage` table | `input/output/cache_read/cache_write/reasoning_tokens`, `model`, `cost_source` | `recordUsage` from the driver, `closeUsage`'s honest blank, migration 4's backfill | Yes | ✓ FLOWING |
| `turns` table | `status`, `ended_at` | `endTurn` inside `withTx`, boot sweep | Yes | ✓ FLOWING |
| material text | repo file contents | `gitListFiles` → `fromDirectory` → segments → `GET /api/materials/:id?text=1` | Yes, and no longer carries the token | ✓ FLOWING |
| credential check | `TOKEN_BUF` / `SESSION_BUF` | `readFileSync(TOKEN_PATH)` **once, at import** | Stale by design after boot | ⚠️ STATIC |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Build | `pnpm build` | exit 0 | ✓ PASS |
| Suite, first invocation | `pnpm test` | exit 0, `# tests 196 / # pass 196 / # fail 0 / # cancelled 0` | ✓ PASS |
| Suite, three more invocations | `pnpm test` ×3 | exit 0 each, 196/196, 0 cancelled | ✓ PASS |
| Method drift gate, passing | `pnpm method:check` | "6 rendered copies match method/", exit 0 | ✓ PASS |
| Method drift gate, failing | one sentence appended to `method/10-philosophy.md` in a copied tree | 4 drifted copies named, exit 1 | ✓ PASS |
| Loopback bind + token | scratch server, `GET /api/lessons` | no credential 401, token header 200, token file mode 600 | ✓ PASS |
| Foreign Host (raw socket) | `Host: evil.example` and `Host: evil.example:<port>` | 403 on `/api/lessons` and on `/` | ✓ PASS |
| Foreign Origin | `Origin: http://evil.example` | 403 | ✓ PASS |
| Handoff ticket lifecycle | `POST /api/handoff` then `GET /?ticket=` ×2 | 401 unauthed / 200 authed, body carries no token; first use 302 to `/`, second 401, unminted 401 | ✓ PASS |
| No secret on egress | served markup, 404 body | 0 token occurrences, 0 session occurrences, token not in the 404 body | ✓ PASS |
| Hostile repo import | `POST /api/materials/repo` on a repo with `core.fsmonitor` set | 201, sentinel absent, `STOLEN.txt` absent, 0 token occurrences in the material text | ✓ PASS |
| The pin is load-bearing | same `ls-files` argv with and without `-c core.fsmonitor=false` | without: sentinel written; with: not written | ✓ PASS |
| Pre-phase DB upgrade | b8f255c database opened on HEAD | `user_version` 4, `turns: 1, usage: 1`, row all-null `cost_source 'unknown'`, `derive.db.bak-v0` written | ✓ PASS |
| **Advertised revocation** | delete `~/.derive/token` on a running server, reuse the cookie | cookie 200, old token header 200, `GET /` 200 | ✗ FAIL |
| stdio MCP server with a bad PORT | `PORT=abc node server/dist/mcp.js` | dies at startup on a setting it never uses | ✗ FAIL (advisory) |

### Probe Execution

| Probe | Command | Result | Status |
|---|---|---|---|
| — | — | No `scripts/*/tests/probe-*.sh` exist and no plan declares one; this phase's proof net is `pnpm test`, `pnpm method:check` and the reproductions above | SKIPPED |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| FOUND-01 | 01-01, 01-02 | 14 tutor tools defined once; every driver, MCP and HTTP validation derive from it | ✓ SATISFIED | `server/src/tools.ts` imported by all four surfaces; wire-surface fixture byte-identical; 12 wire-surface cases green |
| FOUND-02 | 01-03 | Method defined once, rendered everywhere, CI fails on drift | ✓ SATISFIED | 6 rendered copies; drift driven red; CI gate is the first step |
| FOUND-03 | 01-04 | One driver interface and one event sink | ✓ SATISFIED | `driver.ts` + `drivers/fake.ts` + `driver.test.ts`; no `web/` change this round |
| FOUND-04 | 01-01, 01-02, 01-08, 01-16 | Plugin and Codex keep working, proven by snapshot + modelless smoke test | ? NEEDS HUMAN | Machine half fully satisfied and green ×4; human half is HC-2, open (WINDOWS.md entry 5) |
| FOUND-05 | 01-05, 01-18 | Numbered transactional migrations; transactional graph/lesson writes; existing DBs migrate forward | ✓ SATISFIED | 0→4 upgrade reproduced with real pre-phase code; `withTx` suites green |
| FOUND-06 | 01-07, 01-08, 01-09, 01-10, 01-13, 01-14, 01-17, 01-19 | Loopback bind, Host/Origin, per-install token, redaction before any key is stored | ✗ BLOCKED | Every enumerated clause reproduced closed. Blocked on the advertised revocation control that does not work (Gap 1) and the false clone-argv rationale (Gap 2) |
| COST-01 | 01-06, 01-18 | Every turn persists raw usage with the model id and a cost source | ✓ SATISFIED | `usage` schema carries all five counters + `model` + `cost_source`; migration 4 backfill reproduced; `endTurn` transactional; usage and tx suites green |

No orphaned requirements: `.planning/REQUIREMENTS.md` maps exactly FOUND-01..06 and COST-01 to Phase 1, and every one is claimed by at least one plan's `requirements` field.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `server/src/index.ts` | 1113, 1191 | Comment and learner-facing warning assert a security property the code does not have | 🛑 Blocker | Gap 1 — reproduced |
| `.env.example` | 38 | Same claim, as security advice | 🛑 Blocker | Gap 1 |
| `server/test/security.test.ts` | 584 | Test named for revocation that never revokes anything | 🛑 Blocker | Gap 1 — this is why it shipped green |
| `server/src/repo.ts` | 123 | Security rationale names pins that do not exist on the argv it points at | ⚠️ Warning | Gap 2 |
| `server/src/driver.ts` | 110-117 | Idempotency guard raised before the write it guards; `turn_end` unreachable on failure | ⚠️ Warning | Advisory — lesson reads busy until restart |
| `server/src/config.ts` | 9-16 | Throwing side effect on import of a module the stdio MCP server also imports | ⚠️ Warning | Advisory — reproduced; kills the plugin path on a setting it never uses |
| `server/test/guards.test.ts` | 129-154, 94-211 | Two cases assert against a command that never runs; ~12 temp dirs leaked per run, one with 0755 `/bin/sh` scripts | ⚠️ Warning | Advisory — WR-07, WR-08 |
| `server/test/spawn.ts` | 68-73 | Caller `env` spread after `PORT`, so a caller can desynchronise the child from the polled port | ⚠️ Warning | Advisory — WR-05 |
| `server/src/mcp.ts` | 219-221 | "no shell is involved" is false on win32 (`cmd /c start`) | ℹ️ Info | WR-06; no metacharacter reaches the URL today |
| repo-wide | — | `TODO`/`FIXME`/`TBD`/`XXX` markers in files this phase modified | ℹ️ Info | None found |

### Human Verification Required

#### 1. HC-2 — the plugin and Codex parity run (FOUND-04's human half)

**Test:** With a Claude Code login: `pnpm build && pnpm start`, then `/derive:learn` in a second terminal — probe, plan, one taught node, one graded quiz, `end_lesson`. Repeat on a ChatGPT login with the `derive-learn` Codex skill.
**Expected:** Both complete exactly as before the phase; no tool missing, renamed or reshaped; the understanding gate still refuses a lock without an intuition or transfer pass.
**Why human:** Needs a real model, a provider login and a person on two terminals. The machine half is already evidence and is green; nothing automated runs a model. `.planning/WINDOWS.md` entry 5.

#### 2. HC-1 — real-browser session smoke

**Test:** Open the printed `?token=…` link in a real browser; take a lesson; close the browser entirely and reopen at `/` with no query; then delete `~/.derive/token`, **restart the server**, and reload.
**Expected:** 302 with the query dropped; the SSE stream and cards run on the `derive_session` cookie with no `x-derive-token` header from the page; the reopened browser loads; and after the delete **plus restart** the reload is 401.
**Why human:** No automated case drives a real browser, the page's own `fetch`/`EventSource`, or the lesson SSE stream on the cookie. `.planning/WINDOWS.md` entry 4. Re-run this once Gap 1 is resolved, since its step 5 is exactly the control that is broken.

#### 3. A public URL through `fetchPublic`

**Test:** Add a link to the library from a machine with DNS and outbound network.
**Expected:** Fetched, extracted and stored; the SSRF guard admits the public host.
**Why human:** This environment has no DNS or outbound network, so only the refusal side of `assertPublicHost` is driven. `.planning/WINDOWS.md` entry 3.

### Gaps Summary

Three of the four things this round set out to close are genuinely closed, and I reproduced each one rather than reading a summary. The repo importer no longer runs code the repository carries — a repo whose own `.git/config` names a command imports normally and leaves the command unexecuted, and the pin that does it is load-bearing under a control experiment. The ledger reconciles on an upgraded install — a database written by the real pre-phase code comes forward to `user_version` 4 with `turns: 1, usage: 1` and an honest all-null row rather than the `usage: 0` the last round found. The install token is off the browser opener's command line, replaced by a one-use sixty-second ticket whose whole lifecycle drives correctly, and `hostNames` now fails closed. The suite passes on its first invocation and on three more after it: 196/196, zero cancelled, four times running.

What stops the phase is the fourth. 01-19 widened the browser credential from a memory-only cookie to a thirty-day persistent one, and wrote the justification into four learner-facing places: deleting the token file signs every browser out. It does not. `TOKEN` is read once at module evaluation and frozen; nothing re-reads the file. I signed a browser in, deleted `~/.derive/token` on the running server, and the cookie still answered 200 — as did the old `x-derive-token` header. The failure window is the one the sentence is printed for: the `DERIVE_HOST=0.0.0.0` warning, plaintext over a LAN, a learner who believes a credential has leaked, does what the server told them, and is not told it did nothing. The test named for this control passes by comparing two separate installs' cookies, which is isolation, not revocation — which is how a control that does not work shipped green. The plan's own HC-1 script knows the difference: its step 5 says delete the file *and restart the server*. The four shipped sentences omit the restart.

The second gap is the same standing prohibition in a smaller place: `repo.ts`'s new rationale says five git knobs "are already pinned where they are reachable, on the clone argv below", and the clone argv pins one of them. No exploit follows today; the defect is a load-bearing security comment, in the file whose entire docstring is about confinement, telling the next maintainer that something is handled when it is not.

Both are the same shape, and it is the shape every one of these four plans carried as its first prohibition: never state an invariant the code does not hold — fix the code or qualify the sentence, never neither. Gap 1 needs a decision (make revocation real behind a one-second cache of the token file, or correct all four sentences to say "and restart derive") recorded before it is built, and either way a test that actually revokes. Gap 2 is a one-line choice: add the pins, or say they are pinned nowhere.

HC-1 and HC-2 remain outstanding and unclaimed, as every round has said. Nothing in 01-16 … 01-19 closes them, and nothing in this report does either.

---

_Verified: 2026-09-20T12:10:00Z_
_Verifier: Claude (gsd-verifier)_
