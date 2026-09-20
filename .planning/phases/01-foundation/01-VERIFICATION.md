---
phase: 01-foundation
verified: 2026-09-20T18:40:00Z
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
  - .planning/phases/01-foundation/01-20-PLAN.md
  - .planning/phases/01-foundation/01-20-SUMMARY.md
  - .planning/phases/01-foundation/01-21-PLAN.md
  - .planning/phases/01-foundation/01-21-SUMMARY.md
  - .planning/phases/01-foundation/01-REVIEW.md
  - README.md
  - scripts/doctor.mjs
  - server/src/config.ts
  - server/src/credentials.ts
  - server/src/db.ts
  - server/src/driver.ts
  - server/src/index.ts
  - server/src/mcp.ts
  - server/src/migrations.ts
  - server/src/repo.ts
  - server/src/tickets.ts
  - server/src/tools.ts
  - server/test/api.test.ts
  - server/test/credentials.test.ts
  - server/test/guards.test.ts
  - server/test/mcp.test.ts
  - server/test/migrations.test.ts
  - server/test/security.test.ts
  - server/test/spawn.ts
  - server/test/tx.test.ts
  - server/test/usage.test.ts
covered_digest: "v1:sha256:69f329f840c7d7445998a69f5deefd84dda4c8951d8e40757e06fdde85eb1f3f"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 4/5
  gaps_closed:
    - >-
      "The browser session is revocable without a code change" — closed, and
      driven rather than read. On a running `server/dist/index.js` in a scratch
      data dir: sign-in `GET /?token=<t>` 302 + cookie; baseline cookie and
      header both 200; `rm ~/.derive/token`; 1.1 s later the cookie is 401 on
      `/api/lessons`, the header is 401, `GET /` with the cookie is 401, and
      `/api/health` is still 200 — the process is alive and no restart
      happened. The token file was not recreated by the credential path.
      Rotation is a rotation: pre-rotation cookie 401, pre-rotation header 401,
      new header 200, `GET /?token=<new>` 302 with a fresh cookie that drives
      `/api/lessons` 200. `server/src/credentials.ts` is the single live read;
      `server/test/security.test.ts:631-717` now deletes and rotates the token
      file of its own running fixture instead of comparing two installs.
    - >-
      "`server/src/repo.ts`'s security rationale describes mitigations that
      exist" — closed. The clone argv at `repo.ts:303` now carries all eight
      flags the `gitListFiles` rationale names (`http.followRedirects=false`,
      `protocol.allow=never`, `protocol.https.allow=always`,
      `core.sshCommand=false`, `credential.helper=`, `core.fsmonitor=false`,
      `core.hooksPath=/dev/null`, `core.pager=cat`) plus
      `GIT_CONFIG_NOSYSTEM: '1'`, which both paths now set. The three knobs the
      comment says are pinned on neither argv (`filter.*.clean`,
      `diff.external`, `uploadpack.packObjectsHook`) are on neither.
      `server/test/guards.test.ts:207` holds both directions off the argv text
      with the comment excluded from the slice (`callOf` starts at the call,
      not the declaration), so the prose cannot satisfy the assertion about
      itself.
  gaps_remaining: []
  regressions:
    - >-
      New this round, reproduced end to end: the one-time handoff ticket is
      never spent, and the install token is never dropped from the URL, when
      the browser already holds a session cookie — which is the ordinary case
      for a 30-day cookie. See gap 1.
    - >-
      New this round, reproduced with a pinned clock: the one-second revocation
      window is not a bound. A backwards wall-clock step keeps a deleted token
      authenticating for the whole length of the step. See gap 2.
gaps:
  - truth: >-
      A credential handed to a browser opener on a process command line is
      worth a single request — "spent on first use" — and the install token
      does not come to rest in browser history, because presenting it is
      answered with a 302 that drops the query string
    status: failed
    reason: >-
      Reproduced end to end against `server/dist/index.js` (rebuilt from HEAD)
      on a scratch data directory and an OS-allocated port. Transcript:

        1. first ?token= open            -> 302, Set-Cookie derive_session=53f7…
        2. minted ticket                 -> c8277ca9883ed8d8…
        3. ?ticket= open WITH the cookie -> 200, set-cookie NONE, location none
        4. the SAME ticket, cookie-less  -> 302, Set-Cookie derive_session=53f7…
           that cookie on GET /api/lessons -> 200
        5. re-open ?token= WITH cookie   -> 200, set-cookie NONE
        6. control, cookie-less ticket   -> first 302, second 401

      Line 3 is the defect and line 4 is its consequence: the browser the
      ticket was minted for used it, and the ticket is still live and still
      buys a full API session — every lesson, the library, and
      `POST /api/materials/repo` against any readable folder. The mechanism is
      plain at `server/src/index.ts:1149-1163`: the document middleware does
      `const cookie = offered(getCookie(c, SESSION_COOKIE)); if
      (matchesSession(cookie)) return next();` before it ever reaches
      `matchesToken(presented)` or `redeemTicket(...)`, so a signed-in browser
      short-circuits both handoffs.

      This is not a stale comment; it is the mitigation that made a documented
      exposure acceptable, stated as fact in five places:

      - `server/src/tickets.ts:10-11` — the URL "carries one of these instead:
        a random value that is worth a single request and one minute". The
        threat model that module states is `/proc/<pid>/cmdline` being
        world-readable on Linux.
      - `server/src/mcp.ts:219` — the opener argv is "acceptable only because
        what it now carries expires in sixty seconds **and is spent on first
        use**". The second half is false for the ordinary case.
      - `server/src/index.ts:1116-1142` — "A browser presents the install token
        once, in the URL, and is answered with a 302 to the same path with the
        query string dropped, so the token does not come to rest in the
        history." Line 5 of the transcript shows the `?token=…` URL standing at
        200. `index.ts:213-218` gives the reason this matters: "a credential in
        a URL comes to rest in server logs, browser history and Referer", and
        default `strict-origin-when-cross-origin` sends the full query as
        `Referer` on every same-origin subresource of that document.
      - `.env.example:37` and `scripts/doctor.mjs:118` — "opening the same link
        again signs it in for another 30". `issueSession` is only called on the
        token and ticket branches, so line 5's zero `set-cookie` headers means
        `Max-Age` is never refreshed: a learner who re-opens the link weekly is
        still signed out on day 31 from first sign-in. `README.md:63` and the
        startup line at `index.ts:1177` tell the learner to do exactly this.

      That is the standing prohibition both plans this round carry verbatim —
      "Never state an invariant the code does not hold; fix the code or qualify
      the sentence, never neither" — in the same shape and the same file family
      the fourth verification blocked on.

      The suite is green through it because every ticket case drives a
      cookie-less client: `server/test/security.test.ts:489` ("opens the page
      once…") and `:501` ("is refused the second time…") both `fetch` without a
      cookie, and `:484` only asserts that a cookie-holder can *mint* a ticket,
      never that presenting one spends it.

      Evidence gate: `server/src/index.ts` was modified after the prior
      verification (`41c8d8f`, `05b7eda`, both 2026-09-20T17:xx UTC vs the
      prior `verified: 12:10Z`), and 01-20's own must-have truth 9 re-affirms
      this exact order ("the document middleware still tries the cookie, then
      the install token, then the one-time ticket"). Deterministic
      reproduction recorded above. This blocks.
    artifacts:
      - path: "server/src/index.ts"
        issue: >-
          Lines 1149-1163: the cookie short-circuit returns before both
          handoffs, so a presented `?token=` or `?ticket=` is neither redeemed,
          nor stripped by the 302, nor used to refresh `Max-Age`. Lines
          1116-1142 state the opposite.
      - path: "server/src/tickets.ts"
        issue: 'Lines 10-11: "worth a single request" is false whenever the browser holds a cookie.'
      - path: "server/src/mcp.ts"
        issue: 'Line 219: "spent on first use" is the stated reason the opener argv is acceptable, and it does not hold.'
      - path: ".env.example"
        issue: 'Line 37: "opening the same link again signs it in for another 30" — reproduced false (0 set-cookie headers).'
      - path: "scripts/doctor.mjs"
        issue: 'Line 118: the same sentence, in the closing line the learner reads after `pnpm check`.'
      - path: "server/test/security.test.ts"
        issue: >-
          Lines 484-513: the whole ticket group drives a cookie-less client, so
          single-use is only ever asserted in the path where it happens to
          hold. Nothing opens a handoff URL with a valid cookie attached.
    missing:
      - >-
        Redeem and strip before the cookie short-circuit, so presenting a
        handoff always consumes it and always ends in the query-dropping 302
        that also refreshes `Max-Age`: compute `handoff = (ticket !== undefined
        && redeemTicket(ticket)) || matchesToken(presented)` first, `issueSession`
        + 302 on it, then fall through to `matchesSession(cookie)` -> `next()`,
        then 401. Note this reverses 01-20's must-have truth 9 ("cookie, then
        token, then ticket"), so record the reversal deliberately rather than
        letting it read as drift — the ordering that truth froze is the defect.
      - >-
        Alternatively, qualify all five sentences: the ticket is single-use only
        for a browser that is not already signed in; the token is dropped from
        the URL only on a first sign-in; re-opening the link does not extend the
        cookie. Doing neither is what the standing prohibition forbids.
      - >-
        Whichever branch is taken, add cases to `server/test/security.test.ts`'s
        ticket group that (a) open a minted ticket **with a valid session cookie
        attached** and assert a 302, (b) assert the ticket is refused afterwards,
        and (c) assert a second `?token=` open with a cookie attached returns a
        fresh `Max-Age=2592000`. A group that only ever drives cookie-less
        clients is the shape that let this ship.
  - truth: >-
      The one-second revocation window is a bound: a deleted or rotated install
      token stops authenticating within a second, which is what three
      learner-facing sentences promise
    status: partial
    reason: >-
      Reproduced by driving `server/src/credentials.ts` directly with a pinned
      clock, token file deleted after the first read:

        window ms = 1000
        fresh read at T0, A matches: true
        forward +999ms  (inside window)        -> true
        forward +1000ms (exactly one window)   -> false   <- forward bound holds
        re-primed at T1, A matches: true
        BACKWARD clock step -1h after deletion -> true    <- revoked token still authenticates
        still stale 59 minutes later           -> true
        back to normal (T1+2000)               -> false

      `credentials.ts:105` is `if (cache && now - cache.at < TOKEN_CACHE_MS)
      return …`. For any `now < cache.at` the difference is negative and
      therefore always below the window, and a cache *hit* never advances
      `cache.at` (line 121 runs only on a miss), so the stale entry keeps being
      served until wall-clock time passes `cache.at` again. A backwards step —
      an NTP correction on a laptop, VM suspend/resume, a learner fixing a
      wrong clock — silently suspends the revocation this whole round
      delivered, for the length of the step.

      The forward half of the review's claim was independently checked and the
      *boundary* claim at `credentials.ts:98-103` is accurate in the sense it
      was written in (at exactly one window the file is re-read rather than the
      cached value served — confirmed above). The plain reading of the same
      sentence, "the window is a bound and not an approximation", and the three
      sentences `server/test/security.test.ts:737-758` pins ("within a
      second"), are what a one-hour stale window falsifies.

      Recorded as partial rather than failed because revocation demonstrably
      works under a monotonic clock — the end-to-end run above shows it — and
      because it needs a non-adversarial but non-routine event to break.
      `server/test/credentials.test.ts` only ever steps its pinned clock
      forward, so nothing catches it.
    artifacts:
      - path: "server/src/credentials.ts"
        issue: >-
          Line 105: a negative `now - cache.at` always satisfies the window, and
          a cache hit does not advance `cache.at`. Lines 98-103 claim the window
          is a bound.
      - path: "server/test/credentials.test.ts"
        issue: "Every case moves the pinned clock forward; no case steps it backwards."
    missing:
      - >-
        Treat a non-monotonic reading as stale: `if (cache && now >= cache.at &&
        now - cache.at < TOKEN_CACHE_MS)`. Better, gate on a monotonic source
        (`performance.now()`) and keep the `now` parameter for the pinned-clock
        cases.
      - >-
        Add a case to `server/test/credentials.test.ts` that writes A, reads at
        T0, deletes the file, and asserts `matchesToken(A, T0 - 3_600_000) ===
        false`.
deferred: []
advisory:
  - finding: >-
      `server/src/repo.ts:62-72` — `isSecretName`'s doc says a repository import
      refuses "files that hold credentials rather than code", but the allowlist
      misses several that `TEXT_EXTS` will happily collect: `config.json`
      (`~/.docker`), `hosts.yml` (`~/.config/gh`), `secrets.yaml`,
      `service-account.json`, `.git-credentials`, `.pgpass`. `SKIP_DIRS`
      prunes neither `.docker`, `.config`, `.aws` nor `.ssh`.
    category: security
    reason: >-
      01-REVIEW.md WR-05, confirmed by reading the source. `collectRepo` is
      reachable from `attach_material`, which the tutor model calls, and the
      tutor's context routinely carries attacker-influenced text, so a
      prompt-injection payload can name the path; the collected text lands in
      the materials table and comes back out of `GET /api/materials/:id?text=1`.
      Raised rather than counted as a gap: no phase must-have or success
      criterion states a completeness invariant over this list, and `repo.ts`'s
      change this round (01-21) was confined to the git argv. Worth closing
      with the rest of FOUND-06's confinement story.
    evidence_status: "read from source; not driven — no must-have asserts the list is complete"
  - finding: >-
      `server/src/driver.ts:108-117` and `server/src/index.ts:1033` — `endTurn`'s
      transaction is not exception-safe and the sink raises its idempotency guard
      before the write.
    category: other
    reason: >-
      Carried forward unchanged from the fourth verification (01-REVIEW.md
      WR-01 of that round). `ended = true` is set before `endTurnRow(...)`; if
      the ledger write throws, both halves roll back with the guard already up,
      the turn row stays `'running'` and `busy()` reports the lesson busy for
      the life of the process with no `turn_end` on the stream. The boot sweep
      repairs it on the next restart only. Neither file was touched this round.
    evidence_status: "mechanism read from source; the failing write could not be induced in this sandbox"
  - finding: >-
      `server/src/config.ts:9-16` validates `PORT` in the module body and
      `server/src/mcp.ts` imports from that module, so an invalid `PORT` kills
      the stdio MCP server that never reads it.
    category: other
    reason: >-
      Carried forward from the fourth verification and re-driven this round:
      `PORT=abc node server/dist/mcp.js` dies in `dist/config.js:12` with the
      port message. `config.ts` was edited by 01-20 and this was not addressed.
      Cosmetic in effect (the message is clear), structural in shape.
    evidence_status: "re-driven: PORT=abc node server/dist/mcp.js exits on the config throw"
behavior_unverified_items: []
coincidental_reliance_items: []
human_verification:
  - test: >-
      HC-2 (FOUND-04 human half, Success Criterion 1) — run one real lesson
      through the Claude Code plugin and one through the Codex skills, on a
      real model and login, on two terminals. Fold one repo import by GitHub URL
      into the same run.
    expected: >-
      Both lessons complete exactly as before the refactor: the graph is built,
      a quiz is graded, a node locks, the transcript mirrors. The GitHub import
      returns normally, which is the only way the five clone-argv pins 01-21
      added get exercised at all (WINDOWS #11).
    why_human: >-
      Needs a real model and a real login on two terminals; no automated test
      drives either. The machine half (wire-surface fixture byte-identical,
      `mcp.test.ts` green) is verified and is not a substitute. WINDOWS #5, #11.
  - test: >-
      HC-1 (browser session smoke, corrected expected result) — the six-step
      sequence in 01-20-PLAN.md Task 3. Step 5 now deletes `~/.derive/token`
      with the server left **running**, no restart.
    expected: >-
      The browser is refused within a second without a restart. Note that the
      automated equivalent of steps 1-5 is now driven end to end in this
      report; what a human adds is a real browser (cookie storage, address bar,
      history) rather than a `fetch`.
    why_human: "No automated test drives a real browser. WINDOWS #4, #10."
  - test: >-
      Rotate `~/.derive/token` while a stdio MCP server and the plugin hook are
      running, then call a derive tool from each.
    expected: >-
      Both are refused until they are restarted, which is the cost
      `server/src/credentials.ts:27-30` and `server/src/index.ts:1101-1104`
      write down.
    why_human: >-
      01-20 declares this truth `verification: backstop` — a stdio MCP server's
      credential lifetime cannot be observed from inside the suite. Asserted by
      reading the boot-time reads at `server/src/mcp.ts:75` and
      `plugin/hooks/mirror.mjs:33`. WINDOWS #9.
  - test: "Import an ordinary public URL into the library through `fetchPublic`."
    expected: "The page is fetched, extracted and shelved."
    why_human: "This environment has no DNS or outbound network. WINDOWS #3."
---

# Phase 1: Foundation Verification Report

**Phase Goal:** The tutor's 14 tools and its method text exist once and feed every surface; every driver sits behind one interface and one event sink; every turn's raw usage is recorded; the database migrates transactionally; the local server is hardened before it ever holds a key — and the Claude Code plugin and Codex paths are proven unchanged throughout.
**Verified:** 2026-09-20T18:40:00Z
**Status:** gaps_found
**Re-verification:** Yes — fifth round, after gap-closure plans 01-20 and 01-21

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP Success Criterion) | Status | Evidence |
|---|-----------------------------------|--------|----------|
| 1 | Plugin and Codex lessons complete as before; wire-surface snapshot unchanged; stdio MCP smoke test passes with no model | ✓ VERIFIED (machine half) | `git diff --quiet 239d5f1..HEAD -- server/test/wire-surface.json` exit 0 — byte-identical. Full suite `pnpm --filter server test` on a freshly rebuilt `dist`: **209 pass / 0 fail / 0 cancelled**, including `mcp.test.ts` and `ok 55 - the wire surface` (11 subtests). Human half (HC-2) outstanding — see Human Verification. |
| 2 | Editing the single method/tool source updates every rendered copy; CI fails on drift | ✓ VERIFIED | `node scripts/check-method.mjs` -> `method: 6 rendered copies match method/`, exit 0. `.github/workflows/ci.yml:37` runs `pnpm method:check` ahead of typecheck, build and test. Registry is `server/src/tools.ts` (projection onto three surfaces, per its module doc); `method/` holds 10 numbered source files. |
| 3 | A new driver is one `Driver.runTurn(ctx, sink)`, proven by a fake driver in tests | ✓ VERIFIED (regression) | `server/src/driver.ts` and `server/test/driver.test.ts` present and green in the 209. Neither file changed this round (`git diff --name-only 02b3bbd..HEAD` does not list them). |
| 4 | An existing DB migrates forward under a numbered transactional runner; an interrupted `replaceGraph`/`deleteLesson` leaves no partial state | ✓ VERIFIED (regression) | `server/src/migrations.ts` + `server/test/migrations.test.ts` + `server/test/tx.test.ts`, all green in the 209. Unchanged this round. |
| 5 | Loopback-only with a per-install token, foreign Host and Origin rejected, no secret in any error/log/event/export/vault path, every turn stores raw usage with model id and cost source | ✗ FAILED | Host/Origin/bind/refusal-order and the usage ledger all hold (driven below). The per-install-token half fails: the one-time handoff ticket is not spent and the install token is not stripped from the URL when the browser holds a cookie, reproduced end to end — five places state the contrary. Plus the revocation window is not a bound under a backwards clock step. See Gaps. |

**Score:** 4/5 truths verified (0 present, behavior-unverified)

### Gap-Closure Must-Haves (plans 01-20, 01-21)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 20-1 | Deleting `~/.derive/token` on a **running** server signs every browser out; server stays alive | ✓ VERIFIED | Driven against rebuilt `dist/index.js`: cookie 401, header 401, `GET /` 401, `/api/health` 200 — 1.1 s after `rm`, no restart. |
| 20-2 | Rotating the file is a rotation, not a lockout | ✓ VERIFIED | Driven: old cookie 401, old header 401, new header 200, `?token=<new>` 302 with a fresh cookie that drives `/api/lessons` 200. |
| 20-3 | A deleted token file is not quietly replaced | ✓ VERIFIED | Driven: after `rm`, `existsSync(tokenPath)` false through every subsequent credential check. `ensureToken` is called once, at `index.ts:85`. |
| 20-4 | Every token value read is handed to `registerSecret` with its derived session | ✓ VERIFIED | `credentials.ts:116-119` registers on each newly-read token; `security.test.ts:702` ("scrubs a rotated-in token out of an error body") green. |
| 20-5 | The cookie is derived from the token the file holds **now** | ✓ VERIFIED | `issueSession` reads `sessionValue()` (`index.ts:1107`), not a boot constant. Driven: post-rotation cookie is accepted by the very next request. |
| 20-6 | Five learner-facing places say what the code does about revocation | ✓ VERIFIED (revocation clause only) | `.env.example:37-39`, `README.md:59`, `index.ts:1090-1096`, `index.ts:1185-1190`, `credentials.ts:4-19` all say "within a second, without restarting derive". *Separately*, the "another 30" clause in two of those files is false — counted under gap 1, not here. |
| 20-7 | Boundary driven with a pinned clock; the file is re-read at exactly one window | ⚠ PARTIAL | Forward: +999 ms true, +1000 ms false — the boundary holds. Backwards: a deleted token authenticates for an hour. Gap 2. |
| 20-8 | An absent, empty or whitespace-only file refuses everything; blank supplied credentials refused | ✓ VERIFIED | Driven: with a whitespace-only token file, old token 401, `''` 401, `'   '` 401. `sameValue` refuses an empty *live* value on its own line (`credentials.ts:137`). |
| 20-9 | The fixed refusal order is unchanged (Host, Origin, health exemption, credential) | ✓ VERIFIED | Driven with raw `node:http` Host headers: foreign Host + bad credential **403**; foreign Origin + bad credential **403**; good Host, no credential **401**; foreign Host on `/api/health` **403**; good Host on `/api/health` **200**. |
| 20-B | Rotation also signs out the stdio MCP server and the plugin hook until restarted | ? insufficient_spec | Declared `verification: backstop`. Routed to Human Verification; WINDOWS #9. |
| 21-1 | `repo.ts`'s rationale describes mitigations that exist, in both directions | ✓ VERIFIED | Comment at `repo.ts:123` vs argvs at `:126` and `:303` — all eight named pins present on the clone argv, three named-unpinned knobs on neither, `GIT_CONFIG_NOSYSTEM: '1'` on both. |
| 21-2 | The clone path has the listing path's machine-config posture, as `-c` flags | ✓ VERIFIED | `repo.ts:303` carries `core.sshCommand=false`, `credential.helper=`, `core.fsmonitor=false`, `core.hooksPath=/dev/null`, `core.pager=cat`. |
| 21-3 | Knobs pinned on neither argv are named as unpinned, with the reason | ✓ VERIFIED | `repo.ts:123` names `filter.*.clean`, `diff.external`, `uploadpack.packObjectsHook` and says why each is unreachable today. |
| 21-4 | A case goes red when comment and argv drift apart, with the comment excluded from the slice | ✓ VERIFIED | `guards.test.ts:207`; `callOf` (`:73`) starts the slice at the call, never at the declaration — documented there as the reason. Green in the 209. |
| 21-B | No clone-argv pin can be driven end to end here | ? insufficient_spec | Declared `verification: backstop`; WINDOWS #11. Folded into HC-2. |

### Deferred Items

None. Nothing in gap 1 or gap 2 is covered by a later phase's goal or success criteria: Phase 2 is Settings and Secrets, Phase 3-4 are providers, and FOUND-06 is mapped to Phase 1 alone.

### Advisory (New Scope, Unevidenced)

| # | Finding | Category | Why Advisory |
|---|---------|----------|--------------|
| 1 | `isSecretName` misses `config.json`, `hosts.yml`, `secrets.yaml`, `.git-credentials`, `.pgpass`; `SKIP_DIRS` prunes no credential directories (`repo.ts:62-72`) | security | No must-have or success criterion states a completeness invariant over the list; 01-21's change to this file was confined to the git argv |
| 2 | `endTurn`'s transaction is not exception-safe; the sink's guard rises before the write (`driver.ts:108-117`, `index.ts:1033`) | other | Carried forward; the failing write cannot be induced in this sandbox; neither file changed this round |
| 3 | An invalid `PORT` kills the stdio MCP server that never reads it (`config.ts:9-16`) | other | Re-driven and still present; cosmetic in effect, structural in shape |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `server/src/credentials.ts` | The single live read of the install token | ✓ VERIFIED | 155 lines; `credentials()` re-reads behind a 1 s cache, `matchesToken`/`matchesSession`/`sessionValue` all route through it; imported by `index.ts` and driven by `credentials.test.ts` + `security.test.ts`. Defect is gap 2, not existence. |
| `server/src/index.ts` | Both credential middlewares comparing against the live value | ⚠ PARTIAL | The comparison is live (driven). The document middleware's ordering is gap 1. |
| `server/src/repo.ts` | Clone argv carrying the pins its rationale names | ✓ VERIFIED | `:303` argv + `:123` rationale agree in both directions. |
| `server/test/security.test.ts` | A revocation case that revokes a running server's token | ✓ VERIFIED | `describe('revoking the install token on a running server')` at `:631`; the old install-isolation case at `:586` renamed with a comment explaining the difference. |
| `server/test/credentials.test.ts` | Pinned-clock boundary cases | ⚠ PARTIAL | Exists and is green; no backwards-step case (gap 2). |
| `server/test/guards.test.ts` | A comment↔argv drift gate | ✓ VERIFIED | `:207`, slice excludes the comment. |
| `server/src/tools.ts`, `method/` | Single source for tools and method | ✓ VERIFIED | Unchanged; `method:check` green. |
| `server/src/driver.ts`, `server/src/migrations.ts` | Driver seam, numbered migration runner | ✓ VERIFIED | Unchanged; suites green. |
| `server/test/wire-surface.json` | Frozen wire surface | ✓ VERIFIED | Byte-identical to 239d5f1. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `~/.derive/token` (file) | `/api/*` + document middlewares | cached live read in `credentials.ts` -> `matchesToken`/`matchesSession` | ✓ WIRED | The link the fourth round recorded NOT_WIRED. Driven: deleting the file refuses both credentials on both middlewares within the window. |
| live read | `registerSecret` -> `redact` | `credentials.ts:116-119` | ✓ WIRED | `security.test.ts:702` scrubs a rotated-in token out of an error body. |
| live read | `issueSession` cookie | `sessionValue()` at `index.ts:1107` | ✓ WIRED | Post-rotation cookie accepted by the next request. |
| `mintTicket` (MCP argv) | `redeemTicket` in the document middleware | `?ticket=` query | ✗ NOT_WIRED (conditionally) | Reached only when no valid cookie is present. With a cookie the middleware returns at `:1150` and the ticket is never consumed. **Gap 1.** |
| `?token=` query | the query-dropping 302 | `matchesToken(presented)` at `:1153` | ✗ NOT_WIRED (conditionally) | Same short-circuit; with a cookie the token stands in the URL. **Gap 1.** |
| `gitListFiles` rationale | `fromGitClone` argv | named flags | ✓ WIRED | Eight pins present, three named-unpinned absent, gate at `guards.test.ts:207`. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `credentials.ts` | `cache.token` | `readFileSync(TOKEN_PATH)` on each miss | Yes — driven: deletion and rotation both change the answer within the window | ✓ FLOWING |
| `index.ts` `issueSession` | cookie value | `sessionValue()` -> live `credentials()` | Yes — post-rotation cookie works | ✓ FLOWING |
| `index.ts` document middleware | `redeemTicket(...)` result | `tickets.ts` map | Only on the cookie-less path | ⚠ STATIC (conditionally unreachable) |
| usage ledger | turn usage rows | `server/src/db.ts` turn/usage tables | Yes — `usage.test.ts` green, restart-sweep case in `tx.test.ts` green | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full server suite on a rebuilt `dist` | `pnpm --filter server build && pnpm --filter server test` | `# tests 209 / # pass 209 / # fail 0 / # cancelled 0` | ✓ PASS |
| Method drift gate | `node scripts/check-method.mjs` | `method: 6 rendered copies match method/`, exit 0 | ✓ PASS |
| Wire surface frozen | `git diff --quiet 239d5f1..HEAD -- server/test/wire-surface.json` | exit 0 | ✓ PASS |
| Revocation on a running server | rebuilt `dist/index.js`, scratch data dir, `rm token`, 1.1 s | cookie 401, header 401, `GET /` 401, health 200, file not recreated | ✓ PASS |
| Rotation on a running server | write a new 64-hex token, 1.1 s | old cookie 401, old header 401, new header 200, new `?token=` 302 + working cookie | ✓ PASS |
| Blank / whitespace token file | write `"   \n"`, 1.1 s | old token 401, `''` 401, `'   '` 401 | ✓ PASS |
| Refusal order (raw `node:http` Host) | 5 requests | 403 / 403 / 401 / 403 / 200 as specified | ✓ PASS |
| Cache boundary, pinned clock | drive `matchesToken` at T0+999 and T0+1000 | true, then false | ✓ PASS |
| Cache under a backwards clock step | delete token, `matchesToken(A, T1 - 3_600_000)` | **true** — revoked token still authenticates for an hour | ✗ FAIL (gap 2) |
| Ticket single-use with a cookie held | mint, open `?ticket=` with cookie, re-open cookie-less | 200 / no redeem, then 302 + a working session cookie | ✗ FAIL (gap 1) |
| Token stripped from URL with a cookie held | re-open `?token=` with cookie | 200, no `Set-Cookie`, no `Location` | ✗ FAIL (gap 1) |
| `PORT=abc` on the stdio MCP server | `PORT=abc node server/dist/mcp.js` | dies in `dist/config.js:12` | ℹ Advisory 3 |

### Probe Execution

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| — | `find scripts -path '*/tests/probe-*.sh'` | none | ? SKIP — this project declares no probes; the equivalent gates are `pnpm method:check` and `pnpm test`, both run above |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| FOUND-01 | 01-01..01-06, 01-13..15 | 14 tools defined once; every driver, MCP and HTTP validation derive from it | ✓ SATISFIED | `server/src/tools.ts` registry; wire-surface fixture byte-identical; `ok 55 - the wire surface` (11 subtests) and `mcp.test.ts` green |
| FOUND-02 | 01-02, 01-07 | Method text defined once, rendered everywhere; CI fails on drift | ✓ SATISFIED | `method/` (10 files), `scripts/check-method.mjs` -> "6 rendered copies match", `pnpm method:check` at `ci.yml:37` |
| FOUND-03 | 01-08..01-11 | One driver interface, one event sink | ✓ SATISFIED | `server/src/driver.ts`, `server/test/driver.test.ts` (fake driver) green; unchanged this round |
| FOUND-04 | 01-12, 01-16 | Plugin and Codex keep working; wire snapshot + no-model MCP smoke | ? NEEDS HUMAN | Machine half green (snapshot + `mcp.test.ts`); HC-2 (real plugin and Codex lessons) never performed — WINDOWS #5 |
| FOUND-05 | 01-17, 01-18 | Numbered transactional migration runner; transactional `replaceGraph`/`deleteLesson` | ✓ SATISFIED | `server/src/migrations.ts`, `migrations.test.ts`, `tx.test.ts` green |
| FOUND-06 | 01-12, 01-19, 01-20, 01-21 | Loopback bind, Host + Origin, per-install token, redaction | ✗ BLOCKED | Bind, Host, Origin, redaction and live revocation all verified by driving. The handoff-ticket and URL-stripping halves of the token story do not hold (gap 1); the revocation window is not a bound (gap 2) |
| COST-01 | 01-18 | Every turn persists raw usage with model id and cost source | ✓ SATISFIED | `server/test/usage.test.ts` green; restart-sweep case in `tx.test.ts` green; ledger shape unchanged this round |

No orphaned requirements: `.planning/REQUIREMENTS.md` maps exactly FOUND-01..06 and COST-01 to Phase 1, and every one is claimed by a plan in this phase.

**Note for the REQUIREMENTS.md traceability table:** FOUND-06 currently reads **Complete**. It is not. This report sets it back to blocked; the table should be corrected in the same commit that records this verification.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `server/src/index.ts` | 1149-1163 | Stated invariant the code does not hold (302-strips the token; ticket spent on first use) | 🛑 Blocker | Gap 1 |
| `server/src/tickets.ts` | 10-11 | Same | 🛑 Blocker | Gap 1 |
| `server/src/mcp.ts` | 219 | Same — "spent on first use" is the stated reason the opener argv is acceptable | 🛑 Blocker | Gap 1 |
| `.env.example` | 37 | Learner-facing sentence reproduced false | 🛑 Blocker | Gap 1 |
| `scripts/doctor.mjs` | 118 | Same sentence | 🛑 Blocker | Gap 1 |
| `server/src/credentials.ts` | 98-105 | "the window is a bound and not an approximation" | ⚠️ Warning | Gap 2 |
| `server/src/repo.ts` | 62-67 | Doc claims credential files are "refused outright"; the allowlist has holes | ⚠️ Warning | Advisory 1 |
| `server/test/security.test.ts` | 484-513 | Test group asserts an invariant only on the path where it happens to hold | ⚠️ Warning | Why gap 1 shipped green |

Debt-marker scan (`TBD|FIXME|XXX` and `TODO|HACK|PLACEHOLDER`) over the nine files this round touched: **none found**. `CLAUDE.md`'s "no TODO/FIXME markers are in use" still holds.

### Human Verification Required

#### 1. HC-2 — Claude Code plugin and Codex skills parity run (FOUND-04, Success Criterion 1)

**Test:** Run one real lesson through the Claude Code plugin and one through the Codex skills, on a real model and login, on two terminals. Fold one repo import by GitHub URL into the same run.
**Expected:** Both lessons complete exactly as before the refactor — graph built, a quiz graded, a node locked, transcript mirrored. The GitHub import returns normally.
**Why human:** Needs a real model and a real login on two terminals; no automated test drives either. The machine half (wire-surface fixture byte-identical, `mcp.test.ts` green) is verified and is not a substitute. This is also the only way the five clone-argv pins 01-21 added are exercised at all. WINDOWS #5, #11.

#### 2. HC-1 — browser session smoke, with the corrected expected result

**Test:** The six-step sequence in `01-20-PLAN.md` Task 3. Step 5 deletes `~/.derive/token` with the server left **running** — no restart.
**Expected:** The browser is refused within a second without a restart.
**Why human:** No automated test drives a real browser. The `fetch`-level equivalent of steps 1-5 is driven end to end in this report; what a human adds is real cookie storage, a real address bar and real history — the last of which is what gap 1 is about. WINDOWS #4, #10.

#### 3. Rotation signs out the stdio MCP server and the plugin hook

**Test:** Rotate `~/.derive/token` while a stdio MCP server and the plugin hook are running, then call a derive tool from each.
**Expected:** Both are refused until restarted.
**Why human:** 01-20 declares this `verification: backstop` — a stdio MCP server's credential lifetime cannot be observed from inside the suite. Asserted by reading `server/src/mcp.ts:75` and `plugin/hooks/mirror.mjs:33`. WINDOWS #9.

#### 4. A public URL fetch through `fetchPublic`

**Test:** Import an ordinary public URL into the library.
**Expected:** The page is fetched, extracted and shelved.
**Why human:** No DNS or outbound network in this environment. WINDOWS #3.

### Gaps Summary

The two gaps the fourth round found are genuinely closed, and both were re-driven rather than read: deleting or rotating a running server's install token now revokes every browser within a second with no restart, and `repo.ts`'s security rationale and its clone argv now say the same thing in both directions with a test holding them together. The suite is green at 209/209 on a freshly rebuilt `dist`, the wire surface is byte-identical, and the method gate reports six matching rendered copies.

What blocks is one defect the review named and I independently reproduced end to end. The document middleware short-circuits on the session cookie before it reaches either handoff, so for the ordinary case — a browser holding the 30-day cookie — the one-time ticket is never spent and the install token is never dropped from the URL. The consequence is not theoretical: I minted a ticket, opened it with the cookie attached (200, no redeem), and then redeemed that same ticket from a cookie-less client sixty seconds later for a session cookie that drove `GET /api/lessons` to 200. That is exactly the exposure `server/src/tickets.ts` was written to close — another local account reading the browser opener's `/proc/<pid>/cmdline` — and `server/src/mcp.ts:219` names "spent on first use" as the reason putting anything on that argv is acceptable at all. Five places state invariants the code does not hold, which is the same standing prohibition, in the same file family, that the fourth round blocked on.

Beside it, the one-second revocation window is not a bound. `credentials.ts:105` compares `now - cache.at < TOKEN_CACHE_MS`, which every negative delta satisfies, and a cache hit never advances `cache.at` — so a backwards wall-clock step suspends the revocation this whole round delivered for the length of the step. Driven with a pinned clock: a deleted token still authenticating an hour later. Recorded as partial because revocation demonstrably works under a monotonic clock, and because the fix is one comparison.

Both gaps sit on the same seam and should close together, since the fix for the first reverses the middleware ordering that 01-20's own must-have truth 9 froze. Record that reversal deliberately: the order that truth blessed is the defect.

---

_Verified: 2026-09-20T18:40:00Z_
_Verifier: Claude (gsd-verifier)_
