---
phase: 01-foundation
verified: 2026-09-20T19:40:00Z
status: human_needed
score: 4/5 must-haves verified
covered_files:
  - .env.example
  - .github/workflows/ci.yml
  - .planning/REQUIREMENTS.md
  - .planning/ROADMAP.md
  - .planning/WINDOWS.md
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
  - .planning/phases/01-foundation/01-22-PLAN.md
  - .planning/phases/01-foundation/01-22-SUMMARY.md
  - .planning/phases/01-foundation/01-REVIEW.md
  - README.md
  - plugin/commands/learn.md
  - plugin/commands/review.md
  - plugin/hooks/mirror.mjs
  - scripts/check-method.mjs
  - scripts/doctor.mjs
  - scripts/render-method.mjs
  - server/src/agent.ts
  - server/src/credentials.ts
  - server/src/db.ts
  - server/src/driver.ts
  - server/src/drivers/fake.ts
  - server/src/events.ts
  - server/src/export.ts
  - server/src/index.ts
  - server/src/mcp.ts
  - server/src/migrations.ts
  - server/src/repo.ts
  - server/src/secrets.ts
  - server/src/tools.ts
  - server/test/credentials.test.ts
  - server/test/driver.test.ts
  - server/test/guards.test.ts
  - server/test/mcp.test.ts
  - server/test/migrations.test.ts
  - server/test/secrets.test.ts
  - server/test/security.test.ts
  - server/test/spawn.ts
  - server/test/tx.test.ts
  - server/test/usage.test.ts
  - server/test/wire-surface.json
  - server/test/wire-surface.test.ts
covered_digest: "v1:sha256:78c8a8e6fb6ef39f398ea9e4f39df9a8af9f1e00806a17234db2e9412b252df0"
behavior_unverified: 1
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 4/5
  gaps_closed:
    - >-
      "A credential handed to a browser opener on a process command line is
      worth a single request, and the install token does not come to rest in
      browser history" — closed by deletion plus reordering, and driven end to
      end rather than read. `server/src/tickets.ts` no longer exists;
      `POST /api/handoff` returns 404; `/?ticket=<64 hex>` returns 401;
      `mintTicket`, `redeemTicket`, `TICKET_TTL_MS`, `withTicket` and
      `handoffTicket` appear nowhere under `server/`; `server/src/mcp.ts:226`
      is `openBrowser(l.url)` and the file contains no `searchParams`, no
      `exec(` and no token outside the `x-derive-token` header at `:86`. The
      `/proc/<pid>/cmdline` exposure is therefore closed by construction, not
      by a sixty-second lifetime. The second half — the token resting in the
      address bar — is closed by the reorder: driven against a rebuilt
      `server/dist/index.js`, a `?token=` open **with a valid session cookie
      attached** is now `302`, `Location: /`, `Set-Cookie ... Max-Age=2592000`
      (the fifth round recorded `200`, no `Set-Cookie`, no `Location` for this
      exact request). The four learner-facing sentences that say re-opening the
      printed link "signs it in for another 30" are now true, and none of them
      was edited to make it so.
    - >-
      "The one-second revocation window is a bound" — closed. `credentials.ts:105`
      is now `if (cache && now >= cache.at && now - cache.at < TOKEN_CACHE_MS)`.
      Driven with a pinned clock against `dist/credentials.js`: file written,
      read at T1, file deleted, then `matchesToken(A, T1 - 3_600_000)` ->
      **false** and `matchesToken(A, T1 - 60_000)` -> **false** (the fifth round
      recorded `true` for both). The forward boundary is unchanged and still
      exact: with the file deleted after the read, `+999 ms` -> true (cached),
      `+1000 ms` -> false (re-read). `server/test/credentials.test.ts:64-71`
      holds both backwards cases.
  gaps_remaining: []
  regressions: []
deferred: []
advisory:
  - finding: >-
      WINDOWS #12 — deleting the ticket `describe` block also deleted its
      source-assertion that `server/src/mcp.ts` contains no `exec(` shell spawn
      and no `searchParams.set('token')`. The property itself holds (read and
      grepped this round: `openBrowser(l.url)`, `execFile` only, no
      `searchParams` anywhere in the file), but nothing goes red if a future
      change puts a credential back into the browser-opener URL.
    category: security
    reason: >-
      Raised, not counted. 01-22's must-have truth 1 asserts the *property*,
      which is verified; no must-have or success criterion requires a
      regression guard over it. The phase's own standing prohibition ("never
      add a credential path") is exactly what such a guard would protect, so it
      is worth one line in a later plan — three lines of `readFileSync` +
      `assert.ok(!src.includes(...))` in `server/test/security.test.ts`.
      Recording it as a gap would repeat the pattern this round was called to
      stop.
    evidence_status: "property driven/read and holding; the absent guard is the finding"
  - finding: >-
      `server/src/repo.ts:62-72` — `isSecretName`'s allowlist misses
      `config.json` (`~/.docker`), `hosts.yml` (`~/.config/gh`),
      `secrets.yaml`, `service-account.json`, `.git-credentials`, `.pgpass`;
      `SKIP_DIRS` prunes neither `.docker`, `.config`, `.aws` nor `.ssh`.
    category: security
    reason: >-
      Carried forward unchanged from the fifth verification (01-REVIEW.md
      WR-05). `repo.ts` was not touched this round. No phase must-have or
      success criterion states a completeness invariant over that list.
    evidence_status: "read from source; not driven — no must-have asserts the list is complete"
  - finding: >-
      `server/src/driver.ts:108-117` and `server/src/index.ts:1033` — `endTurn`
      sets its idempotency guard before the ledger write, so a throwing write
      rolls back with the guard already up and the turn row stays `'running'`
      until the next boot sweep.
    category: other
    reason: >-
      Carried forward from the fourth and fifth verifications. `driver.ts` was
      not touched this round.
    evidence_status: "mechanism read from source; the failing write could not be induced in this sandbox"
  - finding: >-
      `server/src/config.ts:9-16` validates `PORT` in the module body and
      `server/src/mcp.ts` imports from that module, so an invalid `PORT` kills
      the stdio MCP server that never reads it.
    category: other
    reason: "Carried forward from the fourth and fifth verifications. `config.ts` was not touched this round."
    evidence_status: "previously driven: PORT=abc node server/dist/mcp.js exits on the config throw"
  - finding: >-
      `.planning/REQUIREMENTS.md` lines 143-167 still carry FOUND-01, FOUND-02,
      FOUND-03, FOUND-05 and COST-01 as "Gaps Found" and FOUND-06 as
      "Complete". Nothing about the first five ever failed a verification; they
      were marked down wholesale by commit `c931392` when Criterion 5 blocked,
      and FOUND-06 is the one line that reads the other way round from how the
      fifth verification recorded it.
    category: other
    reason: >-
      Bookkeeping drift in a planning document, not a defect in the phase's
      deliverable. All seven requirement IDs are SATISFIED in the codebase this
      round (see Requirements Coverage). Recorded so whoever closes the phase
      corrects the matrix rather than inheriting it.
    evidence_status: "read from .planning/REQUIREMENTS.md; contradicted by the driven evidence in this report"
behavior_unverified_items:
  - truth: >-
      Criterion 1 — "A lesson run through the Claude Code plugin and one run
      through the Codex skills both complete exactly as before."
    test: >-
      HC-2. Run one real lesson through the Claude Code plugin (`/derive:learn`)
      and one through the Codex skills, on a real model and login, on two
      terminals. Fold one repo import by GitHub URL into the same run.
    expected: >-
      Both lessons complete as before the refactor: the graph is built, a quiz
      is graded, a node locks, the transcript mirrors. The GitHub import returns
      normally, which is the only thing that exercises the five clone-argv pins
      01-21 added (WINDOWS #11).
    why_human: >-
      The criterion asserts end-to-end runtime behaviour on a real model and a
      real login on two terminals. The machine half is fully verified and is
      not a substitute: the wire-surface fixture is byte-identical, the stdio
      MCP smoke test walks a whole lesson with no model, and the suite is 201/0.
      WINDOWS #5, #11.
coincidental_reliance_items: []
human_verification:
  - test: >-
      HC-2 (FOUND-04 human half, Criterion 1) — one real lesson through the
      Claude Code plugin and one through the Codex skills, two terminals, real
      logins. Fold one repo import by GitHub URL into the run.
    expected: >-
      Both complete exactly as before: graph built, quiz graded, node locked,
      transcript mirrored. The GitHub import returns normally.
    why_human: >-
      Needs a real model and a real login on two terminals; no automated test
      drives either. **This is the only thing standing between this phase and
      `passed`.** WINDOWS #5, #11.
  - test: >-
      HC-1 (browser session smoke, in a real browser) — open the printed
      `?token=` link, confirm the address bar drops the query; open the same
      link again in the same browser; then `rm ~/.derive/token` with the server
      left **running**, no restart, and reload.
    expected: >-
      First open signs in and the token leaves the address bar. The second open
      also 302s and renews the cookie for another 30 days. After the delete the
      browser is refused within a second, without a restart.
    why_human: >-
      Every step is driven end to end in this report against `fetch`; what a
      human adds is a real browser — address bar, history, cookie jar.
      WINDOWS #4, #10.
  - test: >-
      Rotate `~/.derive/token` while a stdio MCP server and the plugin hook are
      running, then call a derive tool from each.
    expected: "Both are refused until they are restarted."
    why_human: >-
      Declared `verification: backstop` in 01-20. A stdio MCP server's
      credential lifetime cannot be observed from inside the suite. Asserted by
      reading the boot-time reads at `server/src/mcp.ts:75` and
      `plugin/hooks/mirror.mjs:33`, both confirmed present this round.
      WINDOWS #9.
  - test: "Import an ordinary public URL into the library through `fetchPublic`."
    expected: "The page is fetched, extracted and shelved."
    why_human: "This environment has no DNS or outbound network. WINDOWS #3."
  - test: >-
      Judgment-tier prohibitions from 01-22 (`verification: flagged`, status
      `unverified`) — confirm the four standing prohibitions were honoured.
    expected: >-
      (1) No credential path added — the diff is net −258/+62 across five files
      and adds no module, no route and no new credential kind. (2) No new
      security sentence written — `.env.example`, `README.md` and
      `scripts/doctor.mjs` are byte-unchanged; the one docstring sentence that
      did change is *shorter* than what it replaced and every clause of it was
      driven (see Behavioural Spot-Checks). (3) No invariant stated that the
      code does not hold — driven clause by clause. (4) The Host/Origin/health
      refusal order unchanged — driven 403/403/401/403/200.
    why_human: >-
      Non-authoritative LLM-judge verdict: all four read as honoured. Flagged
      as `unverified-prohibition — human review recommended` because they are
      judgment-tier, not because anything contradicts them.
---

# Phase 1: Foundation Verification Report

**Phase Goal:** The tutor's 14 tools and its method text exist once and feed every surface; every driver sits behind one interface and one event sink; every turn's raw usage is recorded; the database migrates transactionally; the local server is hardened before it ever holds a key — and the Claude Code plugin and Codex paths are proven unchanged throughout.
**Verified:** 2026-09-20T19:40:00Z
**Status:** human_needed
**Re-verification:** Yes — sixth round, after gap-closure plan 01-22 (a deletion, not an addition)

## The one-line answer

**Both of the fifth round's findings are closed, and nothing replaced them.** Every
automated gate in this phase is green and I drove the security surface end to end
rather than reading it. The only thing between Phase 1 and `passed` is **HC-2** —
one real lesson through the Claude Code plugin and one through the Codex skills, on
a real model, on two terminals. That is a human action outstanding, not a defect to
plan against, so the status is `human_needed` and there is no `gaps:` block.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Plugin and Codex lessons complete exactly as before; wire-surface snapshot unchanged; stdio MCP smoke test (`tools/list`, `start_lesson`, `quiz`, `answer`, `end_lesson`) passes with no model | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | **Machine half fully verified.** `git diff --quiet 239d5f1..HEAD -- server/test/wire-surface.json` exit 0; in fact `git log -- server/test/wire-surface.json` shows the fixture last changed in `6e3d603` (01-02) — every plan from 01-03 through 01-22 left it byte-identical. `node --import tsx --test test/mcp.test.ts` -> 3/3 pass, including "walks a whole lesson with no model: start, plan, teach, check, answer, end" and "serves the registry in declaration order, and the same tools the pre-phase binary served" (22 MCP tools). Full suite 201 pass / 0 fail; `pnpm typecheck` exit 0. `plugin/` and `codex/` were last touched in 01-07 and are untouched by 01-22. **Human half (HC-2) has never been run** — that is what leaves this ⚠️ rather than ✓. |
| 2 | Editing a tool's schema or a sentence of the method in its single source updates the app system prompt, the plugin skill, the Codex skills, the `allowed-tools` lists and the HTTP action validation together; CI fails when any rendered copy drifts | ✓ VERIFIED | **Both halves driven, not read.** *Method:* appended one sentence to `method/00-identity.md`; `node scripts/check-method.mjs` exit **1**, naming 4 drifted copies (`server/src/method.generated.ts`, `plugin/skills/teach/SKILL.md`, `codex/skills/derive-learn/SKILL.md`, `codex/skills/derive-review/SKILL.md`); restored -> "6 rendered copies match method/", exit 0, tree clean. *Schema:* added `probe_field` to `remember`'s shape in `server/src/tools.ts`; `wire-surface.test.ts` went **red** (2 failures); restored, tree clean. *Wiring:* `allowed-tools` is generated by `scripts/render-method.mjs:181-188` from the registry projection; HTTP validation is `ACTION_SCHEMAS = new Map(toolsFor('http').map(...))` at `server/src/index.ts:837`; agent tools at `agent.ts:77-80`; MCP tools at `mcp.ts:279-282`. `.github/workflows/ci.yml:35-37` runs `pnpm method:check` ahead of typecheck, build and test. |
| 3 | A new driver is one `Driver.runTurn(ctx, sink)`, no change to the web UI, the SSE stream or the terminal mirrors, proven by a fake driver in tests | ✓ VERIFIED | `server/src/driver.ts` declares the `TurnContext`/`EventSink` seam; `server/src/drivers/fake.ts` is the fake; `server/test/driver.test.ts:124` is literally "adding a driver takes one runTurn and nothing else", and the file carries a copy of `EVENT_TYPES` taken from `web/src/lib/useLesson.ts` and asserts a whole turn's event types against it. `node --import tsx --test test/driver.test.ts ...` -> 49/49 pass. Unchanged this round (`git diff --name-only 4361cfa..HEAD` does not list it). |
| 4 | An existing `~/.derive` database migrates forward under a numbered, transactional runner; an interrupted `replaceGraph` or `deleteLesson` leaves no partial state | ✓ VERIFIED | `server/test/migrations.test.ts` drives the real invariants, not their shape: "lands an existing database on exactly the schema a fresh one gets", "is a no-op the second time", "rolls back, leaving the version and the half-built table where they were". `server/test/tx.test.ts` drives "leaves the old graph exactly as it was when an upsert fails partway" and "leaves the lesson and every child row when a delete fails partway", plus `deleteLearner` and the usage ledger. All green in the 49. Unchanged this round. |
| 5 | Loopback-only with a per-install token, foreign Host and Origin rejected, no secret in any error/log/event/export/vault path, every turn stores raw usage (input, output, cache read, cache write, reasoning) with the model id and a cost source | ✓ VERIFIED | **Driven end to end against a rebuilt `server/dist/index.js` on a scratch data dir.** Both fifth-round findings reproduce as fixed (full transcript in Behavioural Spot-Checks). Refusal order 403/403/401/403/200 unchanged. Revocation on a *running* server: after `rm`, cookie 401, header 401, `GET /` 401, `/api/health` 200, token file not recreated. Rotation is a rotation. Window is a bound in both directions. Redaction chokepoint covers all five named paths — `redactDeep` at all four `events.ts` entry points, `redact(out.join('\n'))` at `export.ts:176`, `safeMessage` at `export.ts:216` (vault), `agent.ts:252,299`, `codex.ts:116,150`; `secrets.test.ts`'s "every egress" group drives an event and the rendered vault Markdown. Usage ledger: `db.ts:174` inserts all five raw counts plus `model` and `cost_source`; `CostSource = 'provider' \| 'table' \| 'subscription' \| 'unknown'` (`db.ts:564`); `recordUsage` is the single write path and reads lesson/learner/driver off the turn; `closeUsage` (`db.ts:675`) gives every ended turn a row, blanks and `'unknown'` where nothing was reported. `usage.test.ts` green. |

**Score:** 4/5 truths verified (1 present, behavior-unverified)

### 01-22 Gap-Closure Must-Haves

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 22-1 | There is no one-time handoff ticket; `mcp.ts` puts no credential into the opener URL | ✓ VERIFIED | `server/src/tickets.ts` absent. `POST /api/handoff` -> **404** (driven). `/?ticket=<64 hex>` -> **401** (driven). `grep -rn "mintTicket\|redeemTicket\|TICKET_TTL_MS\|withTicket\|handoffTicket" server/` -> no matches. `mcp.ts:226` is `openBrowser(l.url)`; the whole file's `token` hits are the `x-derive-token` header at `:86` and the "no token at …" message at `:85`; no `searchParams`, no `exec(` (only `execFile` with an argv). See Advisory on WINDOWS #12 for the regression guard that went with the block. |
| 22-2 | `?token=<valid>` is always answered with a 302 to the bare path and a fresh cookie, whether or not a cookie is already held | ✓ VERIFIED | Driven both ways. Cookie-less: `302`, `Location: /`, `Set-Cookie derive_session=…; Max-Age=2592000; Path=/; HttpOnly; SameSite=Strict`. **With a valid cookie attached: `302`, `Location: /`, same `Max-Age=2592000`** — the fifth round recorded `200` / no `Set-Cookie` / no `Location` for this exact request. That refreshed cookie drives `GET /api/lessons` -> 200. Held by `security.test.ts:415` ("spend the token in the URL even for a browser that already holds a cookie…"). |
| 22-3 | `x-derive-token` with no URL credential passes through with no redirect; a header client cannot loop | ✓ VERIFIED | Driven: `GET /` with the header -> `200`, `Location` none, `Set-Cookie` none. `security.test.ts:427` repeats it twice in a row and asserts all three on each attempt. |
| 22-4 | The one-second window is a bound in both directions; a negative cache age is stale | ✓ VERIFIED | `credentials.ts:105` now reads `if (cache && now >= cache.at && now - cache.at < TOKEN_CACHE_MS)`. Driven against `dist/credentials.js` with a pinned clock and the file deleted after the read: `-3_600_000` -> **false**, `-60_000` -> **false**, `+2000` -> false. Forward boundary re-driven and still exact: `+999` true (cached), `+1000` false (re-read). `credentials.test.ts:64-71` holds both backwards cases. The docstring sentence "the window is a bound and not an approximation" is now true as written. |
| 22-5 | The fixed refusal order (Host, Origin, health exemption, credential) is unchanged; only the order of credential *kinds* moves | ✓ VERIFIED | Driven with raw `node:http` Host headers: foreign Host + bad credential **403**; foreign Origin + bad credential **403**; good Host, no credential **401**; foreign Host on `/api/health` **403**; good Host on `/api/health` **200**. Identical to the fourth and fifth rounds. `git diff 4361cfa..HEAD` shows `guardLocal` untouched. |
| 22-6 | No prose added by this plan asserts anything the code does not do | ✓ VERIFIED (judgment, flagged) | `.env.example`, `README.md` and `scripts/doctor.mjs` are **byte-unchanged** (`git diff --name-only 4361cfa..HEAD` lists neither). The `index.ts` middleware docstring is net *shorter*: 11 lines of ticket prose deleted, and the one replaced sentence is the order clause, which had to change because the order did. Every clause of the replacement was driven — see the clause-by-clause table in Behavioural Spot-Checks. |

### Deferred Items

None.

### Advisory (New Scope, Unevidenced)

| # | Finding | Category | Why Advisory |
|---|---------|----------|--------------|
| 1 | WINDOWS #12 — the source-assertion that `mcp.ts` puts no credential in the opener URL was deleted with the ticket block; the property holds, the guard does not exist | security | 01-22's truth 1 asserts the property (verified this round); no must-have or criterion requires a guard over it. Promoting it would manufacture exactly the round-N+1 blocker the scope rule was written to stop. Worth three lines in a later plan. |
| 2 | `repo.ts:62-72` — `isSecretName`'s allowlist and `SKIP_DIRS` miss several credential files/dirs | security | Carried forward unchanged; `repo.ts` untouched this round; no must-have states a completeness invariant. |
| 3 | `driver.ts:108-117` — `endTurn` raises its idempotency guard before the ledger write | other | Carried forward from rounds 4 and 5; `driver.ts` untouched this round. |
| 4 | `config.ts:9-16` — module-body `PORT` validation kills the stdio MCP server that never reads `PORT` | other | Carried forward from rounds 4 and 5; `config.ts` untouched this round. |
| 5 | `.planning/REQUIREMENTS.md` matrix carries five never-failed requirements as "Gaps Found" and FOUND-06 as "Complete" | other | Planning-document bookkeeping, not a codebase defect. All seven IDs are SATISFIED this round. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `server/src/tickets.ts` | **absent** | ✓ VERIFIED (deleted) | `ls` -> no such file; no identifier from it survives anywhere under `server/`. |
| `server/src/index.ts` | Reordered document middleware; `/api/handoff` gone | ✓ VERIFIED | `:1128-1142` — `guardLocal`, then `?token=` (401 on mismatch, 302 + cookie on match), then cookie, then header, then 401. Route absent; driven 404. |
| `server/src/mcp.ts` | `openBrowser(l.url)`, no credential in the URL | ✓ VERIFIED | `:184-188` `execFile` with an argv; `:226` call site; no `searchParams`, no `exec(`. |
| `server/src/credentials.ts` | Non-negative cache age required | ✓ VERIFIED | `:105`. Driven with a pinned clock stepped backwards. |
| `server/src/tools.ts` | One registry, three surfaces | ✓ VERIFIED | `DERIVE_TOOL_NAMES.length === 14` (the tutor tools); `toolsFor('mcp')` 22, `toolsFor('http')` 16 — driven through `dist/tools.js`. |
| `server/src/driver.ts` + `server/src/drivers/fake.ts` | One seam, one fake | ✓ VERIFIED | Present, wired into `agent.ts` via `setDriverOverride`, green. |
| `server/src/migrations.ts` | Numbered transactional runner | ✓ VERIFIED | Present, green, exercised on an existing DB and a failing migration. |
| `server/test/wire-surface.json` | Byte-identical across the phase | ✓ VERIFIED | Last changed `6e3d603` (01-02); untouched by 01-03…01-22. |
| `server/test/security.test.ts` | Ticket group gone; cookie-holding clients driven | ✓ VERIFIED | `:399` deletion gate (404 + 401); `:415` cookie-attached `?token=`; `:427` header no-loop ×2; `:436` mismatched `?token=` with a valid cookie -> 401. |
| `server/test/credentials.test.ts` | Backwards-clock case | ✓ VERIFIED | `:64-71`, both `-3_600_000` and `-1`. |
| `.env.example`, `README.md`, `scripts/doctor.mjs` | **unchanged** | ✓ VERIFIED | Not in `git diff --name-only 4361cfa..HEAD`. Their existing sentences were the specification and the code moved to meet them. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `server/src/tools.ts` | `agent.ts`, `mcp.ts`, `index.ts` | `toolsFor` / `shapeFor` / `descriptionFor` | ✓ WIRED | `agent.ts:77-80`, `mcp.ts:279-282`, `index.ts:837` — all three surfaces read the one registry; a schema edit turned `wire-surface.test.ts` red. |
| `method/` | 6 rendered copies | `scripts/render-method.mjs` / `check-method.mjs` | ✓ WIRED | One-sentence edit drifted 4 copies and exited 1. |
| `check-method.mjs` | CI | `pnpm method:check` | ✓ WIRED | `.github/workflows/ci.yml:36-37`, ahead of typecheck/build/test. |
| registry | `plugin/commands/*.md` `allowed-tools` | `render-method.mjs:181-188` + the 22-name assertion at `:177` | ✓ WIRED | Both command files carry the generated line. |
| `driver.ts` sink | `events.ts` -> SSE -> `web/src/lib/useLesson.ts` | `emit`/`emitUpdate`/`emitEphemeral` | ✓ WIRED | `driver.test.ts` asserts a whole turn's event types against a copy of the web's `EVENT_TYPES`. |
| `credentials.ts` | both middlewares | `matchesToken` / `matchesSession` | ✓ WIRED | Live read behind the window; driven: deleting the file refuses the API middleware *and* the document middleware within a second. |
| `credentials.ts` | `secrets.ts` | `registerSecret(token)`, `registerSecret(session)` | ✓ WIRED | `:117-118`, on every newly-read token; `security.test.ts` "scrubs a rotated-in token out of an error body" green. |
| `mcp.ts` / `plugin/hooks/mirror.mjs` | server `/api/*` | `x-derive-token` read once at boot | ✓ WIRED | `mcp.ts:75-86`, `mirror.mjs:32-39`. The once-at-boot read is the documented cost and is the subject of a human check. |
| `recordUsage` | `usage` table | single write path, lesson/learner/driver read off the turn | ✓ WIRED | `db.ts:624-641`; `closeUsage` at `:675` closes every ended turn. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| document middleware | `sessionValue()` | `credentials()` -> live `readFileSync(TOKEN_PATH)` behind the window | Yes — rotation is accepted by the very next request (driven) | ✓ FLOWING |
| `ACTION_SCHEMAS` | tool shapes | `toolsFor('http')` + `shapeFor` on the registry | Yes — registry edit changed the frozen projection | ✓ FLOWING |
| `allowed-tools` lines | tool names | registry projection in `wire-surface.json` via `render-method.mjs` | Yes — 22-name guard at `render-method.mjs:177` | ✓ FLOWING |
| `usage` rows | five raw counts + model + cost source | `recordUsage` reading the turn row, not the caller | Yes — `usage.test.ts` green; `closeUsage` writes the honest blank rather than omitting | ✓ FLOWING |
| rendered method copies | section bodies | `method/*.md` | Yes — edit propagated to 4 copies | ✓ FLOWING |

### Behavioural Spot-Checks

All run against a freshly built `server/dist/index.js` on a scratch `DERIVE_DATA_DIR`
and an OS-allocated port (`server/test/spawn.ts`), then the scratch drivers removed
(`git status --porcelain` clean for all source paths).

| # | Behaviour | Result | Status |
|---|-----------|--------|--------|
| 1 | cookie-less `?token=<valid>` | `302`, `Location: /`, `Set-Cookie derive_session=…; Max-Age=2592000; Path=/; HttpOnly; SameSite=Strict` | ✓ PASS |
| 2 | **`?token=<valid>` WITH a valid cookie** (the fifth round's defect) | `302`, `Location: /`, `Max-Age=2592000` — cookie renewed, query dropped | ✓ PASS |
| 2b | that refreshed cookie on `GET /api/lessons` | `200` | ✓ PASS |
| 3 | `?token=wrong` WITH a valid cookie | `401` | ✓ PASS |
| 4 | `x-derive-token`, no URL credential, `GET /` | `200`, no `Location`, no `Set-Cookie` — no loop | ✓ PASS |
| 5 | cookie only, `GET /` | `200`, no `Location` | ✓ PASS |
| 6 | no credential, `GET /` | `401` | ✓ PASS |
| 7 | `POST /api/handoff` (with a valid header) | `404` | ✓ PASS |
| 7b | `/?ticket=<64 hex>` | `401` | ✓ PASS |
| 8 | foreign Host + bad credential on `/api/lessons` | `403` | ✓ PASS |
| 8b | foreign Origin + bad credential | `403` | ✓ PASS |
| 8c | good Host, no credential | `401` | ✓ PASS |
| 8d | foreign Host on `/api/health` | `403` | ✓ PASS |
| 8e | good Host on `/api/health` | `200` | ✓ PASS |
| 9 | `rm ~/.derive/token` on a **running** server, +1.1 s: cookie / header / `GET /` / `/api/health` / old `?token=` | `401` / `401` / `401` / `200` / `401`; token file **not** recreated | ✓ PASS |
| 10 | rotate the file, +1.1 s: old cookie / old header / new header / new `?token=` / new cookie on API | `401` / `401` / `200` / `302` / `200` | ✓ PASS |
| 11 | any token value in any response body (`/`, `/api/lessons`, `/?token=bad`) | none | ✓ PASS |
| 12 | credentials window, pinned clock, file deleted after read: `+999` / `+1000` / `-3_600_000` / `-60_000` | `true` / `false` / **`false`** / **`false`** | ✓ PASS |
| 13 | method drift: append one sentence to `method/00-identity.md` | `check-method.mjs` exit **1**, 4 copies named; restored -> exit 0 | ✓ PASS |
| 14 | schema drift: add `probe_field` to `remember`'s registry shape | `wire-surface.test.ts` **2 failures**; restored -> clean | ✓ PASS |
| 15 | stdio MCP smoke test, no model | `mcp.test.ts` 3/3, walking start -> plan -> teach -> check -> answer -> end | ✓ PASS |
| 16 | full suite / typecheck / build / method check | `201 pass / 0 fail`; `pnpm typecheck` exit 0; `pnpm --filter server build` exit 0; "6 rendered copies match method/" | ✓ PASS |

**Clause-by-clause check of the one replaced docstring sentence** (`index.ts:1117-1122`),
against the transcript above — this is the standing prohibition "never state an
invariant the code does not hold", tested rather than assumed:

| Clause | Driven by | Holds |
|--------|-----------|-------|
| "the `?token=` in the URL, then the cookie, then the x-derive-token header" | code order at `:1128-1142`; #4 and #5 pass through, #1 redirects | ✓ |
| "a URL credential goes first because it has to be spent and dropped even for a browser that already holds a cookie" | #2 | ✓ |
| "a match is answered with a 302 to the same path with the query gone" | #1, #2 (`Location: /`) | ✓ |
| "a `?token=` that does not match is a 401 rather than something to ignore" | #3 | ✓ |
| "the cookie and the header pass straight through, because there is nothing in either to strip from a URL" | #4, #5 (200, no `Location`, no `Set-Cookie`) | ✓ |

**Test-count arithmetic** (01-22-SUMMARY claims `209 − 13 + 5 = 201`): independently
measured **201 pass / 0 fail**. The claim reconciles.

### Probe Execution

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| — | — | No `scripts/*/tests/probe-*.sh` exists and no PLAN or SUMMARY in this phase declares a probe path | N/A — SKIPPED |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| FOUND-01 | 01-01, 01-02 | 14 tutor tools defined once; every driver, the MCP server and HTTP action validation derive from it | ✓ SATISFIED | `DERIVE_TOOL_NAMES.length === 14` driven through `dist/tools.js`; `agent.ts:77`, `mcp.ts:279`, `index.ts:837` all read `toolsFor`/`shapeFor`; a registry schema edit turned the frozen projection red. |
| FOUND-02 | 01-03 | Method text defined once, rendered everywhere; CI fails on drift | ✓ SATISFIED | Drift driven both ways; `pnpm method:check` in CI ahead of everything else. |
| FOUND-03 | 01-04, 01-05 | One driver interface, one event sink; adding a provider changes neither UI, SSE nor mirrors | ✓ SATISFIED | `driver.ts` seam + `drivers/fake.ts` + `driver.test.ts:124`; event vocabulary held against a copy of the web's `EVENT_TYPES`. |
| FOUND-04 | 01-01…01-22 | Plugin and Codex paths keep working, proven by a wire-surface snapshot and a no-model stdio MCP smoke test | ? NEEDS HUMAN | Both named proofs are green (fixture byte-identical since 01-02; `mcp.test.ts` 3/3). The requirement's *subject* — the plugin and Codex paths working — needs HC-2. |
| FOUND-05 | 01-06, 01-09 | Numbered transactional migration runner; `replaceGraph`/`deleteLesson` transactional; existing DBs migrate forward | ✓ SATISFIED | `migrations.test.ts` + `tx.test.ts`, 49/49 with the driver and usage suites; cases drive an existing DB, a failing migration's rollback, and both interrupted writes. |
| FOUND-06 | 01-07, 01-13…01-22 | Loopback only, Host and Origin checked, per-install token, secrets redacted from every error/log/event/export path | ✓ SATISFIED | Driven end to end (#1-#12 above). Both fifth-round findings closed. Redaction chokepoint covers all five paths with `secrets.test.ts`'s "every egress" group behind it. |
| COST-01 | 01-08, 01-09 | Every turn persists raw usage with the model id and a cost source | ✓ SATISFIED | `db.ts:174` insert; `UsageInput` carries all five counts; `CostSource` is exactly the four-value union; `recordUsage` is the sole write path; `closeUsage` writes the honest blank for terminal-driven turns so turn counts reconcile. |

No orphaned requirements: `grep -E "Phase 1" .planning/REQUIREMENTS.md` maps exactly
FOUND-01…FOUND-06 and COST-01 to this phase, and all seven appear in plan
frontmatter. See Advisory #5 on the stale status column.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | `grep -rnE "\bTBD\b\|\bFIXME\b\|\bXXX\b" server/src/ server/test/ scripts/` -> no matches; the five files 01-22 changed carry no `TODO`, `HACK`, `PLACEHOLDER`, "coming soon" or "not yet implemented" | — | None |

The debt-marker gate is clean. The project's own convention ("No TODO/FIXME markers
are in use; unfinished work is not left in comments") holds.

### Human Verification Required

See the `human_verification` block in the frontmatter. In priority order:

#### 1. HC-2 — the only thing between this phase and `passed`

**Test:** Run one real lesson through the Claude Code plugin (`/derive:learn`) and one
through the Codex skills, on a real model and login, on two terminals. Fold one repo
import by GitHub URL into the same run.
**Expected:** Both complete exactly as before the refactor — graph built, quiz graded,
node locked, transcript mirrored. The GitHub import returns normally.
**Why human:** Needs a real model and a real login on two terminals. No automated test
drives either, and the machine half — which *is* verified — is not a substitute.
WINDOWS #5, #11.

#### 2. HC-1 — the same browser sequence, in a real browser

Every step is now driven end to end in this report against `fetch`, including the two
that were broken last round. What a human adds is the address bar, the history and a
real cookie jar. WINDOWS #4, #10.

#### 3. Rotation vs. the long-running stdio MCP server and plugin hook

Declared `verification: backstop`; the boot-time reads at `mcp.ts:75` and
`mirror.mjs:33` were re-read and are present. WINDOWS #9.

#### 4. `fetchPublic` against an ordinary public URL

No DNS or outbound network here. WINDOWS #3.

#### 5. Judgment-tier prohibitions from 01-22 — `unverified-prohibition, human review recommended`

Non-authoritative LLM-judge verdict: **all four read as honoured.** "No credential
path added" — the diff is net −258/+62 across five files and introduces no module,
route or credential kind. "No new security sentence" — the three learner-facing files
are byte-unchanged and the single docstring sentence that moved is shorter than what
it replaced. "Never state an invariant the code does not hold" — driven clause by
clause (table above). "Never change the refusal order" — driven 403/403/401/403/200.
Flagged because they are judgment-tier, not because anything contradicts them.

### Gaps Summary

**There are none.** Both findings from the fifth verification are closed, and
this round I reproduced each one as *fixed* rather than reading a summary that
said so:

- The handoff ticket is gone — the module, the route, the branch and the identifiers.
  The `/proc/<pid>/cmdline` exposure is closed by construction: `mcp.ts` now hands the
  opener a bare URL. A `?token=` presented by a browser that already holds a cookie is
  now spent, dropped from the URL and answered with a renewed 30-day cookie — the
  exact request that returned `200` with no `Set-Cookie` last round.
- A cache entry of negative age is stale, so a backwards wall-clock step no longer
  suspends revocation. Both directions of the one-second window are now driven.

01-22 achieved this by making the authenticated surface *smaller*. It deleted 59 lines
of `tickets.ts`, 16 lines of route and docstring, 41 lines of `mcp.ts`, and 11 lines of
middleware prose, and it did not write a single new learner-facing sentence — the three
documents whose sentences were falsified last round were not edited at all; the code
moved to meet them. That is the first round of this phase that closed its gaps without
adding a mechanism, and it is the reason there is nothing new here to block on.

What remains is HC-2: one real lesson through the plugin and one through the Codex
skills. That is a human action outstanding, not a defect. There is nothing to plan
against and nothing for `/gsd-plan-phase --gaps` to consume.

---

_Verified: 2026-09-20T19:40:00Z_
_Verifier: Claude (gsd-verifier)_
