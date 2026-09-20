---
phase: 01-foundation
plan: 20
subsystem: infra
tags: [security, authentication, revocation, session-cookie, hmac, redaction, node-crypto]

requires:
  - phase: 01-foundation
    provides: "01-09's derive_session cookie, guardLocal's fixed Host/Origin/credential order, and the 0600 per-install token"
  - phase: 01-foundation
    provides: "01-10's registerSecret/redact chokepoint (D-11) and its sixteen-character floor"
  - phase: 01-foundation
    provides: "01-17's startDeriveServer fixture, which gives each spawned server its own OS-allocated port and scratch data directory"
provides:
  - "server/src/credentials.ts — the install token read live behind a one-second cache, with both constant-time match helpers, the session accessor and the boot-time creator"
  - "Real revocation: deleting or rotating ~/.derive/token signs every browser and every header caller out within a second, on the process that is already running"
  - "One source of truth for the credential, enforced by a source-shaped regression gate over server/src/index.ts"
  - "Five learner-facing places that describe what the code does, window included, with a case that goes red if they drift from the constant"
affects: [provider-settings, secrets-storage, adoption-docs]

actuals:
  tokens: 10957
  tasks: 3
  commits: 4
plan_head_before: 9e453717ccdd7583df34561db22a922ab9271065

tech-stack:
  added: []
  patterns:
    - "A credential is a live read of its file behind a named, exported cache constant — never a value snapshotted at module evaluation"
    - "Every newly-read live secret reaches registerSecret at the moment it is read, so the redaction chokepoint covers rotated-in values (D-11)"
    - "A mint and its check read one source, so a credential issued after a rotation is not refused by the very next request"
    - "A source-shaped regression gate asserts the absence of a second source of truth, which no behavioural case can catch while the snapshot sits unconsulted"
    - "A case asserts learner-facing prose against the constant it describes, with comment markers and line wrapping normalised out"

key-files:
  created:
    - server/src/credentials.ts
    - server/test/credentials.test.ts
  modified:
    - server/src/index.ts
    - server/src/config.ts
    - server/test/security.test.ts
    - .env.example
    - README.md

key-decisions:
  - "Branch (a), recorded before building: make revocation real rather than correct four sentences to demand a restart. The sentence the rejected branch would produce is the one a learner needs in the worst moment the product has; a cached readFileSync is smaller than the documentation change it replaces"
  - "The live value is promoted, not added alongside: TOKEN_BUF, SESSION_BUF and the sameValue helper are deleted from server/src/index.ts rather than left unconsulted, because two sources of truth for one credential drift apart and the one that drifts is the one the learner was told to rely on"
  - "The window is one second, is an exported constant, and every sentence that asserts revocation names it in seconds — revocation behind a cache is not instantaneous, and the standing prohibition forbids describing it as if it were"
  - "Nothing on the credential path creates a token; creation stays in ensureToken, called once at start, so a learner's deletion is never answered by re-opening the door under a value they were never shown"
  - "The cache boundary is inclusive: at exactly TOKEN_CACHE_MS the file is read again rather than the cached value served, so the window is a bound a sentence can promise"
  - "scripts/doctor.mjs was read and deliberately left byte-identical: its closing line makes no revocation claim, only the thirty-day one, which is true"
  - "README carries the revocation fact once, on the line that already names ~/.derive, not inside the first-lesson step — the binding simplicity rule is one screen, one next step, and a security clause there is a second step"

patterns-established:
  - "Live-credential read: exported cache constant, `now = Date.now()` as the last parameter, a test-only cache reset in the register of clearSecrets"
  - "Empty-live-value refusal is its own decision on its own line, never a side effect of a truthiness guard elsewhere"
  - "Prose-drift gate: a case reads the source files off disk, normalises comment markers and wrapping, and asserts the sentences and the constant agree"

requirements-completed: [FOUND-06]

coverage:
  - id: D1
    description: "Deleting ~/.derive/token on a running server refuses the cookie it issued, the pre-deletion x-derive-token header and the document routes with 401, while /api/health stays 200 — no restart"
    requirement: FOUND-06
    verification:
      - kind: integration
        ref: "server/test/security.test.ts#revoking the install token on a running server > is revoked by deleting the install token file, with no restart"
        status: pass
      - kind: manual_procedural
        ref: "hand-driven curl against server/dist/index.js on a scratch DERIVE_DATA_DIR — responses recorded in ## Hand-driven checks below"
        status: pass
    human_judgment: false
  - id: D2
    description: "Rotating the token file is a rotation, not a lockout: the pre-rotation cookie and header are refused 401, the new token authenticates as a header, and a cookie minted after the rotation drives the API and is not the token"
    requirement: FOUND-06
    verification:
      - kind: integration
        ref: "server/test/security.test.ts#revoking the install token on a running server > is rotated rather than merely broken when the token file is replaced"
        status: pass
      - kind: manual_procedural
        ref: "hand-driven curl rotation against a scratch server — responses recorded in ## Hand-driven checks below"
        status: pass
    human_judgment: false
  - id: D3
    description: "Nothing on the credential path creates a token, so a deletion stays a deletion"
    requirement: FOUND-06
    verification:
      - kind: unit
        ref: "server/test/credentials.test.ts#refuses every credential when the token file is absent, and creates no replacement"
        status: pass
      - kind: integration
        ref: "server/test/security.test.ts#is revoked by deleting the install token file, with no restart (asserts existsSync(tokenPath) === false)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every token value the credential path reads reaches the redaction chokepoint together with its derived session, so a rotated-in token is scrubbed exactly as the boot one is (D-11)"
    requirement: FOUND-06
    verification:
      - kind: unit
        ref: "server/test/credentials.test.ts#hands every newly-read token and its session to the redaction registry, and a cached read to neither"
        status: pass
      - kind: integration
        ref: "server/test/security.test.ts#scrubs a rotated-in token out of an error body the way it scrubs the boot one"
        status: pass
    human_judgment: false
  - id: D5
    description: "The cached live read's edges: the inclusive one-second boundary on a pinned clock, a trailing newline, an absent file, an empty and a whitespace-only file, an empty supplied value against a real token, and the session moving with the token"
    requirement: FOUND-06
    verification:
      - kind: unit
        ref: "server/test/credentials.test.ts#the cached live read of the install token (7 cases)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The route file consults no boot-derived comparison buffer and no local constant-time helper, and a case goes red if one comes back"
    requirement: FOUND-06
    verification:
      - kind: unit
        ref: "server/test/security.test.ts#the credential comparison has one source of truth > keeps no boot-time credential buffer and no local comparison helper in the route file"
        status: pass
    human_judgment: false
  - id: D7
    description: "The three places that assert revocation — .env.example's DERIVE_HOST block, issueSession's doc and the widened-bind startup warning — name the one-second window and require no restart, and agree with TOKEN_CACHE_MS"
    requirement: FOUND-06
    verification:
      - kind: unit
        ref: "server/test/security.test.ts#the revocation window and the sentences that promise it > says the same thing in the code and in the sentences a learner reads"
        status: pass
      - kind: manual_procedural
        ref: "discrimination proved: reverting .env.example to the rejected branch's 'and restart derive' wording turns the case red (recorded below)"
        status: pass
    human_judgment: false
  - id: D8
    description: "README carries the revocation fact once and in the right place, and scripts/doctor.mjs's closing next-step line was read and deliberately left unchanged"
    requirement: FOUND-06
    verification:
      - kind: other
        ref: "grep -c 'signs every browser out' README.md == 1; git diff --quiet -- scripts/doctor.mjs exits 0; README first-lesson step unchanged at 395 characters"
        status: pass
    human_judgment: true
    rationale: "Grep proves the fact is present once and that step 1 did not grow; it cannot prove the placement honours the binding simplicity rule, or that leaving the doctor's line was the right call. Both are editorial judgments about the learner's one screen and want a person's eye."
  - id: D9
    description: "HC-1 — real-browser session smoke, with step 5 corrected by this plan to expect 401 after a deletion with the server left running"
    requirement: FOUND-06
    verification: []
    human_judgment: true
    rationale: "No automated case drives a real browser, the page's own fetch/EventSource, or the lesson SSE stream on the cookie. This plan changes HC-1's expected result and deliberately does not run it. Outstanding; .planning/WINDOWS.md entries 4 and 10."

duration: 116min
completed: 2026-09-20
status: complete
---

# Phase 01 Plan 20: Real Install-Token Revocation Summary

**The credential is now a live read of `~/.derive/token` behind a one-second `TOKEN_CACHE_MS` window, so deleting or rotating that file signs every browser and every header caller out on the process that is already running — and five learner-facing places say so, window included.**

## Performance

- **Duration:** 116 min
- **Started:** 2026-09-20T15:23:02Z
- **Completed:** 2026-09-20T17:19:44Z
- **Tasks:** 3
- **Files modified:** 7 (2 created, 5 modified)

## Test-count baseline

Read off this plan's starting tree before the first edit, per `## Test-count baseline`:

| Point | `# pass` | `# fail` | Floor | Met |
|---|---|---|---|---|
| **`BASE`** (pre-plan) | **196** | 0 | — | — |
| End of Task 1 | 197 | 0 | `BASE + 1` = 197 | yes |
| End of Task 2 | 207 | 0 | `BASE + 7` = 203 | yes |
| End of Task 3 | **208** | 0 | `BASE + 8` = 204 | yes |

The fourth verification's recorded 196 was confirmed rather than inherited. Final run: `# tests 208 / # suites 56 / # pass 208 / # fail 0`.

## Accomplishments

- **The blocker is closed.** `server/src/credentials.ts` reads the token file live behind a one-second cache; both credential middlewares and the cookie mint go through it. Driven against a running scratch server: the cookie, the pre-deletion header, `GET /` and the deleted token's handoff all go 401 within two seconds of `rm token`, `/api/health` stays 200, and the process stays up.
- **A rotation is a rotation, not a lockout.** The old cookie and old header are refused, the new token authenticates as a header, and `GET /?token=<new>` hands out a cookie that drives `/api/lessons` to 200 and is not the token — the half a deletion cannot show.
- **The boot snapshot is gone, not merely unused.** `TOKEN_BUF`, `SESSION_BUF` and the local `sameValue` helper are deleted from `server/src/index.ts` (5 non-comment occurrences before, 0 after), and a source-shaped case fails if any of them returns.
- **Redaction keeps up with the live read.** `credentials()` hands each newly-read token and its derived session to `registerSecret` at the moment it reads them; a unit case watches `secretCount()` rise on a first sighting and not on a cached read, and an integration case drives a 422 body that would have carried a rotated-in token and asserts `[redacted]`.
- **The sentences match the code.** `.env.example`, `issueSession`'s doc and the widened-bind startup warning all say "within a second, without restarting derive"; README carries the fact once; `scripts/doctor.mjs` is byte-identical by decision. A case asserts `TOKEN_CACHE_MS === 1_000` and that all three asserting places name the window in seconds and demand no restart.
- **The test defect the verification named is fixed.** The case at `security.test.ts:584` that compared two separate installs is kept for what it actually proves and renamed to `'is scoped to the install that issued it, so another install's cookie is worthless here'`; the name "revoked" now belongs to a case that revokes.

## Task Commits

1. **Task 1 (tracer, tdd) — RED: the failing revocation case** — `0732f49` (test)
2. **Task 1 — GREEN: the live read, wired end to end** — `41c8d8f` (feat)
3. **Task 2 — the cache boundary, the rotation and the one source of truth** — `b589476` (test)
4. **Task 3 — the five learner-facing places** — `05b7eda` (docs)

Task 1 produced no REFACTOR commit: nothing needed cleaning up after GREEN, and the TDD reference commits REFACTOR only on change.

## TDD Gate Compliance

| Task | `tdd` | RED | GREEN | REFACTOR | Status |
|---|---|---|---|---|---|
| 1 | true | `0732f49` | `41c8d8f` | — (no change) | Pass |
| 2 | true | n/a — see below | n/a | — | Noted |
| 3 | false | — | — | — | n/a |

**Task 1 RED evidence, verified.** `gsd-tools check tdd-red-evidence` returned **`RED_EVIDENCE_OK` (`target_test_failed`)**: exit 1, `# pass 61 / # fail 1`, target entry `revoking the install token on a running server` failing on the planned assertion —

```
the cookie still worked after the token file was deleted
name: 'AssertionError'   expected: 401   actual: 200   operator: 'strictEqual'
```

That is the fourth verification's gap 1 reproduced by the suite itself. The RED commit adds `server/src/credentials.ts` holding only `TOKEN_CACHE_MS` and its doc, so the wait is bounded by the constant the server compares against rather than by a guess; no credential behaviour is in that commit.

**Task 2 has no RED phase, and this is deliberate rather than a lapse.** It is a test-only task over a module Task 1 already landed — the plan's own `<reversibility>` says "Reverting removes the proof, not the behaviour." Writing a failing test for behaviour that already exists is the "unexpected GREEN" the TDD reference tells you to investigate rather than manufacture. Investigated: the feature exists because Task 1's RED→GREEN cycle put it there, four commits earlier in this same plan. Its ten cases were therefore committed as `test(01-20)` and all passed on first run.

## Files Created/Modified

- `server/src/credentials.ts` **(new, 8 exports)** — the module docstring states why the read is cached, why the cache is short, that `ensureToken` is the only function in the codebase that creates a token, that the credential path deliberately does not call it, and the honest cost to the MCP server and the plugin hook. Exports `TOKEN_CACHE_MS`, `ensureToken`, `credentials(now)`, `matchesToken`, `matchesSession`, `sessionValue`, `resetCredentialCache` and the `Credentials` type.
- `server/test/credentials.test.ts` **(new, 7 cases)** — the cache boundary on a pinned clock, a trailing newline, the absent file plus the no-create assertion, the empty and whitespace-only file, an empty supplied value against a real token, the derived session moving with the token, and the `secretCount` coupling. `DERIVE_DATA_DIR` is pointed at a `mkdtempSync` directory before the dynamic import, in the register of `guards.test.ts`; the learner's real `~/.derive` is never touched.
- `server/src/index.ts` — `ensureToken` moved out; `TOKEN_BUF`/`SESSION_BUF`/`sameValue` deleted; `TOKEN` survives as `BOOT_TOKEN`, documented as not a credential and compared against nothing, existing only so the startup line can print the sign-in link; both middlewares go through `matchesToken`/`matchesSession`; `issueSession` takes its value from `sessionValue()`; three doc blocks and the widened-bind warning rewritten.
- `server/src/config.ts` — `TOKEN_PATH`'s doc now says the server reads the file live on every credential check, and that the dev proxy, MCP server and plugin hook read it once at their own start. D-09's "no endpoint ever hands it out" is kept verbatim.
- `server/test/security.test.ts` — the revocation `describe` with its own fixture server (3 cases), the one-source-of-truth gate, the prose-drift case, and the rename at `:584`.
- `.env.example` — the `DERIVE_HOST` block's closing clause.
- `README.md` — the revocation fact appended once to the `~/.derive` line.

## Hand-driven checks

Every response below was produced by `curl` against `server/dist/index.js` started on its own `DERIVE_DATA_DIR` and an OS-allocated port, with the process **left running** throughout.

**Deletion** (re-run against the final shipped build after Task 3):

```
sign in: GET /?token=<t>            -> 302, location: /, set-cookie: derive_session=…; Max-Age=2592000; Path=/; HttpOnly; SameSite=Strict
control: GET /api/lessons  cookie   -> 200
control: GET /api/lessons  header   -> 200
        rm <dataDir>/token ; sleep 2 ; server still running
GET /api/lessons  cookie            -> 401
GET /api/lessons  x-derive-token    -> 401
GET /             cookie            -> 401   (0 Set-Cookie lines)
GET /?token=<the deleted token>     -> 401   (0 Set-Cookie lines)
GET /api/health                     -> 200
ls <dataDir>                        -> derive.db  derive.db-shm  derive.db-wal  out.log
token present?                      -> no        (no credential check created one)
process alive?                      -> yes
```

**Rotation and the redaction coupling:**

```
sign in with the old token, GET /api/lessons old cookie -> 200
        printf '%s' <fresh 64-hex> > <dataDir>/token ; sleep 2 ; server still running
GET /api/lessons  OLD cookie        -> 401
GET /api/lessons  OLD header        -> 401
GET /api/lessons  NEW header        -> 200
GET /?token=<new>                   -> 302, set-cookie: derive_session=9a9e5a72…; Max-Age=2592000; Path=/; HttpOnly; SameSite=Strict
  new cookie value == new token?    -> no
  new cookie value == old cookie?   -> no
GET /api/lessons  NEW cookie        -> 200
POST /api/materials/repo  source=<the rotated-in token>, header=<the rotated-in token>
                                    -> 422   body: {"error":"Not a directory: [redacted]"}
  body contains the rotated-in token? -> no
  body contains [redacted]?           -> yes
```

## Acceptance criteria, measured

Counts are `before → after` on the tree each task started from, as the criteria require.

| Criterion | Before | After | Need |
|---|---|---|---|
| `grep -c export server/src/credentials.ts` | — | 8 | ≥ 7 |
| `grep -c 'matchesToken\|matchesSession' server/src/index.ts` | 0 | 4 | ≥ 3 |
| `grep -c 'sessionValue()' server/src/index.ts` | 0 | 3 | ≥ 1 |
| Boot buffers, comments filtered out (`TOKEN_BUF\|SESSION_BUF\|sameValue(`) | **5** | **0** | 0 |
| `grep -c readFileSync server/src/credentials.ts` | — | 3 | ≥ 1 |
| `grep -c registerSecret server/src/credentials.ts` | — | 4 | ≥ 1 |
| `grep -c "tokenPath\|'token')" server/test/security.test.ts` | 7 | 9 | increase |
| `grep -c 'is revoked by rotating the install token' server/test/security.test.ts` | 1 | 0 | 0 |
| `git diff --quiet -- server/test/wire-surface.json` | — | exit 0 | exit 0 |
| `credentials.test.ts` own run | — | `# pass 7 / # fail 0` | ≥ 6 |
| `grep -c resetCredentialCache server/test/credentials.test.ts` | — | 6 | ≥ 1 |
| `grep -c TOKEN_CACHE_MS server/test/credentials.test.ts` | — | 4 | ≥ 2 |
| `grep -c secretCount server/test/credentials.test.ts` | — | 5 | ≥ 1 |
| `grep -c 'without restarting' .env.example` | 0 pre-plan, 0 at Task 3 | 1 | ≥ 1 |
| `grep -c 'without restarting' server/src/index.ts` | 0 pre-plan, **3** at Task 3 | 4 | ≥ 2 |
| `grep -c second .env.example` | 0 at Task 3 | 1 | ≥ 1 |
| `grep -c second server/src/index.ts` | 1 pre-plan, **9** at Task 3 | 10 | ≥ 2 |
| `grep -rc 'and restart' .env.example README.md scripts/doctor.mjs` | 0, 0, 0 | 0, 0, 0 | 0 each |
| `grep -c 'signs every browser out' README.md` | 0 | 1 | exactly 1 |
| README first-lesson step (line 63) characters | 395 | 395 | not longer |
| `grep -c TOKEN_CACHE_MS server/test/security.test.ts` | 0 pre-plan, 3 at Task 3 | 4 | ≥ 2 |
| `git diff --stat -- scripts/doctor.mjs` | — | empty | unchanged or justified |
| `node scripts/doctor.mjs` | — | full report, `✓ Install token … (0600)`, exit 0 | no failed token check |

Two "before" numbers are worth reading twice, because the plan predicted both and both were measured rather than assumed: the boot-derived buffers stood at exactly **5** non-comment occurrences on the starting tree, and `grep -c second server/src/index.ts` was **1** pre-plan — the phrase "a second boot" inside `ensureToken`'s doc, which left the file with that function in Task 1, which is why the Task-3 baseline was read off the tree (9) rather than inherited.

## Decisions Made

Recorded in frontmatter `key-decisions`. Two are worth expanding here.

**Why `scripts/doctor.mjs` was left byte-identical.** Its closing line reads: "All good. Open the `http://localhost:4310/?token=…` link the server prints when it starts — once; that browser stays signed in for 30 days, and opening the same link again signs it in for another 30 — and type what you want to understand." It makes no revocation claim. Both halves are true, and it is the learner's next-step line on the one screen the simplicity rule protects. The token-mode check above it was also re-read and still reads correctly after this plan: the file is still how the MCP server, the plugin hook, the dev proxy and the browser's first request authenticate. Leaving a true sentence alone is a decision; this one was examined.

**Why the README fact went on the `~/.derive` line.** The first-lesson step at line 63 is already the longest sentence on the page at 395 characters. The simplicity rule is binding and says one screen, one next step; a security clause inside step 1 is a second step. The line that already names `~/.derive` as where everything is stored is the natural home for a fact about a file in that folder, and it now reads: "Everything is stored in one SQLite file under `~/.derive`. Alongside it is `~/.derive/token`, the credential this install authenticates with; deleting it signs every browser out within a second, without restarting derive."

## Deviations from Plan

None — plan executed exactly as written. The plan's own contingency (Task 3 as the slice boundary if Task 1 overran the context budget) was not needed; all three tasks ran in one pass.

Two things done beyond the literal instruction, both inside the plan's stated intent rather than additions to it:

1. **The prose-drift case was proved load-bearing.** Reverting `.env.example` to the rejected branch's "and restart derive" wording turned it red with `.env.example does not name the window in seconds`, and the file was restored immediately. The whole finding this plan closes is a green case that proved nothing, so a new prose case shipping unexercised would have repeated the shape.
2. **The drift case normalises comment markers and line wrapping** before matching. Without it the case would have passed on `server/src/index.ts` and silently failed to see `.env.example`'s wrapped `# without restarting` / `# derive.` — a gate that reads three files and can only really check two.

## Issues Encountered

None. Every verification command passed on first run after its task's edits.

One thing worth recording for whoever writes the next TDD plan in this repo: `gsd-tools check tdd-red-evidence` matches `targetTest` against **top-level** TAP entries. `node --test` reports a `describe` at top level and its `it`s as indented subtests, so the target name in the evidence record must be the suite name (`revoking the install token on a running server`), with the failing subtest and its assertion carried in the record's `failing_subtest` / `expected` / `actual` fields. Naming the `it` alone classifies as `INVALID_RED (no_target_test_failure)`.

## Not claimed by this plan

The five advisories the developer scoped out of this run are left open and named, not quietly absorbed: `endTurn`'s exception-safety (`server/src/driver.ts:110-117`), the `PORT`-on-import problem (`server/src/config.ts:9-16`), the install token on the startup line (`server/src/index.ts`, now `BOOT_TOKEN`), `start_lesson`'s tokenless `url` (`server/src/mcp.ts:253`), and the test-hygiene findings WR-05, WR-07 and WR-08. Gap 2 of the fourth verification (`server/src/repo.ts:123`'s clone-argv rationale) is also untouched and still open.

## Backstop, not driven

`must_haves.truths` carries one statement marked `verification: backstop`: rotating the token also signs out the long-running stdio MCP server and the plugin hook until each is restarted. Checked by reading the code rather than driven, because a stdio MCP server's credential lifetime cannot be observed from inside this suite:

- `server/src/mcp.ts:75-86` — `const TOKEN = (() => { … readFileSync(TOKEN_PATH, 'utf8').trim() … })()` at module evaluation, folded once into the `x-derive-token` header object.
- `plugin/hooks/mirror.mjs:33-39` — `token` read once at start into a frozen `HEADERS` constant.

Both are stated honestly in `issueSession`'s doc and in `server/src/config.ts`'s `TOKEN_PATH` doc rather than left for a reader to infer. Recorded in `.planning/WINDOWS.md`.

## Human verification carried forward, not closed

- **HC-1 (real-browser session smoke)** — the corrected six-step sequence is in Task 3's `<human-check>`. **Step 5 changed with this plan:** delete `~/.derive/token`, wait two seconds and reload with the server **left running**; expect 401. Before this plan that step required a restart and returned 200 without one, which was the blocker. A person runs it or it stays open. `.planning/WINDOWS.md` entries 4 and 10. **Outstanding.**
- **HC-2 (plugin and Codex parity run, FOUND-04's human half)** — untouched by this plan's stdio wire (`server/test/wire-surface.json` byte-identical, `mcp.test.ts` green), but a rotation now signs the plugin hook and the MCP server out until each restarts, which is worth confirming during that run. `.planning/WINDOWS.md` entry 5. **Outstanding.**
- **A public URL through `fetchPublic`** — unchanged and untouched. `.planning/WINDOWS.md` entry 3. **Outstanding.**

`01-VERIFICATION.md`'s HC-1 text and `01-19-PLAN.md` Task 3's `<human-check>` step 5 both still say "restart the server" and were left as written: a shipped planning artifact is a record of what was planned, not a document to keep current. `.planning/WINDOWS.md` entry 4's description names no restart and does not go stale; entry 10 records the changed expectation.

## Plan verification

| Check | Result |
|---|---|
| `pnpm typecheck` | exit 0, no `error TS` |
| `pnpm build` | exit 0, no `error TS` |
| `pnpm method:check` | `method: 6 rendered copies match method/` |
| `pnpm test` | `# tests 208 / # pass 208 / # fail 0` (floor `BASE + 8` = 204) |
| `node scripts/doctor.mjs` | full report, every check ✓, exit 0 |
| Deletion on a running server | driven, all six responses as promised, token file still absent |
| Rotation on a running server | driven, old refused, new admitted as header and as a fresh cookie |
| Rotated-in token in an error body | `422 {"error":"Not a directory: [redacted]"}`, token absent from the body |
| One source of truth in `server/src/index.ts` | 0 non-comment occurrences, plus a case that asserts it |
| `server/test/credentials.test.ts` | 7 cases, all on a pinned clock, `# fail 0` |
| Three asserting places name the window, none says restart | case green; proved red when reverted |
| `server/test/wire-surface.json` byte-identical, `mcp.test.ts` passes | yes / `# pass 3 / # fail 0` |
| No `web/` file edited | `git diff --name-only <base>..HEAD -- web/` is empty |

## User Setup Required

None — no external service configuration, no new environment variable, no new dependency, no migration.

## Next Phase Readiness

- **FOUND-06's blocker is closed.** The clause the fourth verification recorded `NOT_WIRED` — the token file through to the credential check — is now the only path either middleware takes.
- Ready for a fifth verification of phase 01. Gap 2 (`server/src/repo.ts:123`) and the five scoped-out advisories remain open and are named above.
- The phase should still not be marked verified until **HC-2** runs; **HC-1** now has a runnable sequence whose step 5 this plan made meaningful.
- `server/src/credentials.ts` is where Phase 2's provider keys should land: it already establishes the live-read-plus-`registerSecret` pattern that D-11 requires of any secret this process holds.

---
*Phase: 01-foundation*
*Completed: 2026-09-20*
