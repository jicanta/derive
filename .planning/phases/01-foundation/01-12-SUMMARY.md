---
phase: 01-foundation
plan: 12
subsystem: testing
tags: [verification, reproduction, curl, security, ssrf, sqlite, uat]

# Dependency graph
requires:
  - phase: 01-foundation (plan 09)
    provides: the token-free document routes, guardLocal on every route, the derive_session cookie and the per-connection Host check
  - phase: 01-foundation (plan 10)
    provides: assertPublicHost awaited in fromGitClone before mkdtempSync
  - phase: 01-foundation (plan 11)
    provides: deleteLesson and deleteLearner clearing the turns and usage tables
provides:
  - "A recorded re-run of all eight ✗ FAIL rows from 01-VERIFICATION.md's behavioural spot-check table, with the verifier's own instrument (raw curl against the built server, a direct drive of collectRepo, a row count on a scratch database) rather than the test suite"
  - "The real-LAN half of the widened-bind reproduction actually run, on 192.168.0.166, rather than recorded as unrunnable"
  - "The model-free gate re-run after the authentication change: 144 tests / 43 suites / 0 fail, wire surface byte-identical, 6 rendered method copies matching, doctor green"
  - "The machine left in the state the human parity run needs: server answering on http://localhost:4310, token at 0600, build current"
  - "Two <human-check> scripts queued for the phase UAT: the browser session-cookie smoke, and the plugin + Codex parity run (FOUND-04's human half)"
affects: [phase 01 re-verification, phase 01 UAT, phase 02 (provider keys land on this authentication boundary)]

actuals:
  tokens: 4200
  tasks: 2
  commits: 0
plan_head_before: 1ea5674047d87978b5e82b534ff2d6b976f56143

tech-stack:
  added: []
  patterns:
    - "A gap closure is proven with the instrument that found the gap, not with the suite that missed it"
    - "An unrunnable check is recorded as unrunnable with its reason, never as a pass"
    - "Evidence records status codes and match counts, never the credential value"

key-files:
  created:
    - .planning/phases/01-foundation/01-12-SUMMARY.md
  modified: []

key-decisions:
  - "Every reproduction ran against the built server/dist/index.js on a scratch DERIVE_DATA_DIR, matching the verifier's method; the learner's real ~/.derive was only read (token mode, doctor, a read-only curl of /), never written or deleted"
  - "The LAN pair was run for real on 192.168.0.166:4988 — the same address the verifier used — so the two rows that could have been recorded as 'no non-loopback interface' are recorded as observed passes instead"
  - "The Netscape cookie jar's #HttpOnly_ prefix defeated the first cookie check and made an empty jar read as a pass; the check was corrected and re-run rather than accepted, which is the same false-green failure mode this plan exists to catch"
  - "No package was installed and no source file was touched: git status --porcelain server/ scripts/ plugin/ method/ web/ is empty after both tasks"
  - "The Claude Code plugin and the Codex skills were NOT installed into the user's agent configuration by this plan; the documented one-line invocation is recorded in the human-check instead, because installing into ~/.claude or $CODEX_HOME is a change outside this repo"

patterns-established:
  - "Reproduction table: one row per verification finding, carrying the command run and the observed result, so a re-verification pass can diff results rather than re-derive them"
  - "Every `grep -c == 0` is paired with a positive assertion on the same response, so a dead server cannot read as a pass (inherited from 01-09 and applied to the curl reproductions here)"

requirements-completed: [FOUND-04, FOUND-06]

coverage:
  - id: D1
    description: "All eight ✗ FAIL rows from the verification's behavioural spot-check table re-run as passes against the rebuilt tree, with the verifier's own instrument"
    requirement: FOUND-06
    verification:
      - kind: manual_procedural
        ref: "curl against DERIVE_DATA_DIR=$(mktemp -d) PORT=4987 node server/dist/index.js — see the Reproduction table below, rows R1-R4"
        status: pass
      - kind: manual_procedural
        ref: "curl against DERIVE_HOST=0.0.0.0 PORT=4988 node server/dist/index.js, over loopback and over 192.168.0.166 — rows R5-R8"
        status: pass
      - kind: manual_procedural
        ref: "DERIVE_DATA_DIR=$(mktemp -d) node --import tsx -e \"collectRepo('https://127.0.0.1/x.git')\" — row R9"
        status: pass
      - kind: manual_procedural
        ref: "scratch-database drive of createLearner/createLesson/startTurn/recordUsage/deleteLearner with a raw node:sqlite row count — row R10 (review finding WR-01)"
        status: pass
    human_judgment: false
  - id: D2
    description: "FOUND-04's machine half is still green after the authentication change: the wire surface is byte-identical and the stdio MCP smoke test drives server/dist/mcp.js through a whole lesson"
    requirement: FOUND-04
    verification:
      - kind: integration
        ref: "pnpm --filter server exec node --import tsx --test test/wire-surface.test.ts test/mcp.test.ts — 14 tests, 2 suites, 0 fail, no line beginning 'not ok'"
        status: pass
      - kind: other
        ref: "git diff --quiet -- server/test/wire-surface.json — exit 0"
        status: pass
      - kind: unit
        ref: "pnpm test — 144 tests, 43 suites, # fail 0 (baseline before the gap closure: 121 tests, 38 suites)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The whole model-free gate is green after the gap closure: typecheck, build, test, method drift gate, doctor, and the web/ cross-cutting constraint"
    requirement: FOUND-06
    verification:
      - kind: other
        ref: "pnpm typecheck — exit 0, no 'error TS'"
        status: pass
      - kind: other
        ref: "pnpm build — exit 0, server/dist/index.js + server/dist/mcp.js + web/dist/index.html present"
        status: pass
      - kind: other
        ref: "node scripts/check-method.mjs — exit 0, 'method: 6 rendered copies match method/'"
        status: pass
      - kind: other
        ref: "node scripts/doctor.mjs — exit 0, no FAIL line, 'Install token /home/jicanta/.derive/token (0600)'"
        status: pass
      - kind: other
        ref: "git diff --quiet -- web/ — exit 0 across all four gap-closure plans"
        status: pass
    human_judgment: false
  - id: D4
    description: "Browser smoke: the app loads, streams and shows no authorization error, and a derive_session cookie exists whose value is not the contents of ~/.derive/token"
    requirement: FOUND-06
    verification: []
    human_judgment: true
    rationale: "No automated test drives a real browser. The gap closure changed how the browser authenticates (cookie rather than an injected token), and whether a page renders its timeline and graph without a 401 is a reading of a live UI, not an assertion. The automated shadow of this check (status 200, 0 token matches, 1 Set-Cookie: derive_session) was run and passed against the live server, but it does not cover rendering, streaming or the devtools cookie inspection."
  - id: D5
    description: "FOUND-04's human half: one real lesson through the Claude Code plugin (/derive:learn then /derive:review) and one through the Codex derive-learn skill, both completing exactly as before the phase"
    requirement: FOUND-04
    verification: []
    human_judgment: true
    rationale: "Needs a real model and a real provider login on two separate terminals. 01-08-SUMMARY.md:183 records it as not performed and the verification sequences it after the Success Criterion 5 gaps close, because step 1 opens the companion page in a browser — the exact path the token disclosure sat on and the path the session cookie now changes. Nothing in this plan can discharge it; it is recorded, not simulated."
  - id: D6
    description: "The machine is left ready for the human run: the server answers on http://localhost:4310, the token is at 0600, the build is current, and the repository path and invocation commands are written down"
    requirement: FOUND-04
    verification:
      - kind: manual_procedural
        ref: "curl http://127.0.0.1:4310/api/health -> {\"ok\":true,\"version\":\"0.4.0\",\"backend\":\"claude\",\"backend_source\":\"auto\"}; node scripts/doctor.mjs -> 'Server running on http://localhost:4310 (v0.4.0)'"
        status: pass
    human_judgment: false

# Metrics
duration: 8 min
completed: 2026-09-19
status: complete
---

# Phase 01 Plan 12: Prove the gaps closed with the instrument that found them

**All eight ✗ FAIL rows from the verification's behavioural spot-check table re-run as passes against the rebuilt tree using raw `curl`, a direct `collectRepo` drive and a scratch-database row count — plus a 144-test model-free gate and two human checks queued for the phase UAT.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-09-19T14:36:30Z
- **Completed:** 2026-09-19T14:44:10Z
- **Tasks:** 2
- **Files modified:** 0 source files (this plan's only artifact is this summary)

## Accomplishments

- Re-ran every behavioural check the verification recorded as FAIL, with the instrument the verifier used rather than the test suite, and recorded each command and its observed result.
- Ran the real-LAN half of the widened-bind reproduction for real, on `192.168.0.166:4988` — the same address the verification used — so no row had to be recorded as unrunnable.
- Confirmed FOUND-04's machine half survived the authentication change: the tool wire surface is byte-identical to the committed fixture and the stdio MCP smoke test still drives `server/dist/mcp.js` through a whole lesson on the unchanged `x-derive-token` header.
- Left the machine ready for the human run and queued both `<human-check>` scripts for the phase UAT.

## Reproduction table

Every row below was run against `server/dist/index.js` built from this tree, on a
scratch `DERIVE_DATA_DIR`, with the loopback server on port 4987 and the widened
server on port 4988. `$TOK` is `$DERIVE_DATA_DIR/token`; no command prints it.

### Token disclosure — `01-VERIFICATION.md` behavioural spot-checks

| # | Verification row | Command run | Observed | Status |
|---|---|---|---|---|
| R1 | **`/` unauthenticated** — returned `<meta name="derive-token" content="{64 hex}">` | `curl -s http://127.0.0.1:4987/ \| grep -c 'name="derive-token"'`, then `\| grep -c '<div id="root"'`, then `\| grep -c "$TOK"` | `0` meta matches, `1` root-div match, `0` token matches, status `200` | ✓ PASS |
| R2 | **catch-all unauthenticated** — token present (1 match) | the same three greps against `http://127.0.0.1:4987/anything/at/all` | `0` meta, `1` root div, `0` token, status `200` | ✓ PASS |
| R2b | *(data-flow row)* served `index.html` → `derive-token` meta → `TOKEN` — "leaks to unauthenticated callers" | `curl -s -D - -o /dev/null http://127.0.0.1:4987/ \| grep -c "$TOK"` (headers, both routes) | `0` on `/` and on the catch-all | ✓ PASS |
| R3 | **`/` with foreign Host + Origin** — 200, token present | `curl -s -o /dev/null -w '%{http_code}' -H 'Host: evil.com' -H 'Origin: http://evil.com' http://127.0.0.1:4987/` | `403`, body `{"error":"derive answers on 127.0.0.1 at port 4987, and a request has to name it"}`, `0` token matches | ✓ PASS |
| R4 | **harvested token unlocks API** — scraped token → `/api/lessons` 200 | no value to harvest (R1-R3); then `/api/lessons` with no credential, with the file token, and with the cookie the document response set | no credential `401`; `x-derive-token` from the file `200`; `derive_session` cookie `200`; forged 64-char cookie `401`; the cookie value replayed as `x-derive-token` `401`; cookie value ≠ token file contents; `Set-Cookie: derive_session=…; Path=/; HttpOnly; SameSite=Strict` | ✓ PASS |

### Widened bind, `DERIVE_HOST=0.0.0.0` on port 4988

| # | Verification row | Command run | Observed | Status |
|---|---|---|---|---|
| R5 | **LAN request, `DERIVE_HOST=0.0.0.0`** — valid token, `Host: 192.168.0.166:4988` was 403 | `curl -H "x-derive-token: $TOK" -H 'Host: 192.168.0.166:4988' http://192.168.0.166:4988/api/lessons` | `200` | ✓ PASS |
| R6 | **forged loopback Host over LAN** — valid token, `Host: 127.0.0.1:4988` to `192.168.0.166:4988` was 200 | the same request with `Host: 127.0.0.1:4988` | `403`, body `"derive answers on 192.168.0.166 at port 4988, and a request has to name it"` | ✓ PASS |
| R7 | **token harvestable over LAN** — `curl http://192.168.0.166:4988/` returned 64 hex chars | `curl -s http://192.168.0.166:4988/` and `\| grep -c "$TOK"` | `401`, `0` token matches, body `"open this page once as /?token=<the token in …> to let this device in"`; `/?token=$TOK` → `302` `Location: http://192.168.0.166:4988/` with a `derive_session` cookie; that cookie then gets `200` | ✓ PASS |
| R8 | *(plan-added)* a correct-token request naming an address the connection did not arrive on, and `0.0.0.0` as a name | over loopback: `Host: 192.168.0.166:4988` and `Host: 0.0.0.0:4988`, both with the token | both `403`; `Host: 127.0.0.1:4988` `200` and `Host: localhost:4988` `200` on the same connection | ✓ PASS |

The LAN pair (R5, R6, R7) **was run**, on the interface `wlp0s20f3` at
`192.168.0.166/24`. It is not recorded as a pass by inference.

### Clone guard and deletion

| # | Finding | Command run | Observed | Status |
|---|---|---|---|---|
| R9 | Gaps Summary: `assertPublicHost` appears zero times in `server/src/repo.ts`; `collectRepo` routes every non-GitHub URL to `fromGitClone` | `cd server && DERIVE_DATA_DIR=$(mktemp -d) node --import tsx -e "collectRepo('https://127.0.0.1/x.git')"` | rejected with `127.0.0.1 is a private or local address, and derive only fetches public ones`; the scratch directory afterwards holds `derive.db` only — `0` entries beginning `clone-` | ✓ PASS |
| R10 | Review finding **WR-01**: `deleteLesson`/`deleteLearner` promise "everything hanging off it" but issue no `DELETE FROM turns` or `DELETE FROM usage` | scratch DB: `createLearner` → `createLesson` → `startTurn` → `recordUsage` → `deleteLearner`, then a raw `node:sqlite` `SELECT COUNT(*) … WHERE learner_id = ?` over both tables | before: `turns 1`, `usage 1`; after: `turns 0`, `usage 0`, `lessons 0` | ✓ PASS |

### Rows that could not be run

**None.** Every check in this plan ran on this machine, including both LAN rows.

### Hygiene

- `grep -c "$TOK" serverA.log` → `0`; the same on the widened server's log → `0`.
- Both spawned servers were killed at the end of their reproduction; `ss -ltn` reports `0` listeners on 4987 and `0` on 4988.
- Both scratch `DERIVE_DATA_DIR`s were removed. The learner's real `~/.derive/derive.db` was never written to or deleted from by any reproduction.
- No credential value appears in this summary; the startup banner and every `Set-Cookie` line quoted above are redacted.

## Model-free gate (Task 2)

| Check | Result |
|---|---|
| `pnpm typecheck` | exit 0, no `error TS` |
| `pnpm build` | exit 0; `server/dist/index.js`, `server/dist/mcp.js`, `web/dist/index.html` all present |
| `pnpm test` | **144 tests, 43 suites, `# fail 0`** (phase baseline before the gap closure: 121 tests, 38 suites — 23 tests and 5 suites added by plans 01-09/10/11) |
| `pnpm --filter server exec node --import tsx --test test/wire-surface.test.ts test/mcp.test.ts` | exit 0, 14 tests, 2 suites, 0 fail, no `not ok` line |
| `git diff --quiet -- server/test/wire-surface.json` | exit 0 — the wire surface is byte-identical across the whole gap closure |
| `node scripts/check-method.mjs` | exit 0, `method: 6 rendered copies match method/` |
| `node scripts/doctor.mjs` | exit 0, no FAIL line, `Install token /home/jicanta/.derive/token (0600)` |
| `git diff --quiet -- web/` | exit 0 |
| `git status --porcelain server/ scripts/ plugin/ method/ web/` | empty — this plan changed no source |

`wire-surface.test.ts` and `mcp.test.ts` are the direct proof that the
`x-derive-token` header path the plugin hook and the Codex skills use still
authenticates after 01-09 changed how the browser authenticates: the second
drives the built `server/dist/mcp.js` over stdio through `tools/list`,
`start_lesson`, `set_plan`, `quiz`, `answer` and `end_lesson`.

## Machine state for the human run

| Fact | Value |
|---|---|
| Repository path | `/home/jicanta/derive` |
| Server URL | `http://localhost:4310` (bound to `127.0.0.1` only) |
| `/api/health` | `{"ok":true,"version":"0.4.0","backend":"claude","backend_source":"auto"}` |
| Install token | `~/.derive/token`, mode `0600` |
| Build | current as of this plan (`pnpm build` exit 0) |
| `node scripts/doctor.mjs` | exit 0, all ✓, `Server running on http://localhost:4310 (v0.4.0)` |
| Backend | Claude, picked automatically; logged in via claude.ai |

**Two setup facts the human run needs, recorded rather than performed.** This
plan did not write into `~/.claude` or `$CODEX_HOME` — installing into the
learner's agent configuration is a change outside this repository:

- **Claude Code plugin:** not currently registered in `~/.claude/plugins/config.json`. The documented invocation (README:164) is `claude --plugin-dir ./plugin`, run from `/home/jicanta/derive` in a separate terminal while the server keeps running. `pnpm build` has already been run, which is what `plugin/.mcp.json` points at.
- **Codex skills:** `~/.codex/skills` does not exist. The skills live at `codex/skills/derive-learn/` and `codex/skills/derive-review/` in this repository and must be made visible to Codex (copy or symlink into `$CODEX_HOME/skills`) before step 2 of the parity run.

## Human checks queued for the phase UAT

### HC-1 — Browser session-cookie smoke (from Task 1)

A two-minute browser smoke, because the gap closure changed how the browser
authenticates and no automated test drives a real browser.

With the Derive server running (it is — `http://localhost:4310`), open
`http://localhost:4310/` in your normal browser and confirm:

1. The Home page loads with your lessons listed rather than an error.
2. Opening a lesson shows its timeline and its graph.
3. The page does not show a 401 or an "unauthorized" message anywhere.
4. If a lesson is mid-turn, text still streams in rather than stalling.
5. In the browser's developer tools, Application or Storage panel: a `derive_session` cookie exists for this origin, and its value is **not** the contents of `~/.derive/token`.

Report anything that shows an error, or any page that loads empty where it used
to have content.

*Automated shadow already run and passing against the live server:* `GET /`
returns `200`, `0` matches for the real token in the body, `0` matches for
`name="derive-token"`, and exactly `1` `Set-Cookie: derive_session=…` header.
That covers the credential, not the rendering.

### HC-2 — Plugin and Codex parity run (FOUND-04's human half, from Task 2)

Run one real lesson through each terminal path and confirm both complete exactly
as before. The server is running and the token is in place; see
"Machine state for the human run" above for the two one-line setup steps.

1. **Claude Code plugin.** In a Claude Code session with the plugin installed from this repo (`claude --plugin-dir ./plugin`, from `/home/jicanta/derive`), run `/derive:learn` on any small topic. Confirm: the companion page opens in the browser and loads without an authorization error; the tutor probes before planning; `set_plan` renders a graph and waits for your approval; a check question renders as a card and grades; locking a node lights the graph; and `/derive:review` on a later run offers the nodes that are due.
2. **Codex skills.** In a Codex session with the Derive skills installed, run the `derive-learn` skill on any small topic and confirm the same sequence. This is the first run where the Codex skill has a real method body rather than tool descriptions alone — confirm the tutor **teaches** rather than only quizzing.
3. **Parity.** Confirm nothing the learner sees has changed from before this phase: same cards, same graph, same phases, same wording of the refusal when you try to lock a node on a procedure question alone.

Report anything that behaves differently from the pre-phase build, however small
— and in particular anything that looks like an authentication failure in the
companion page, since that is the one thing this gap closure changed underneath
these two paths.

**Why it runs here:** the verification sequences it after the Success Criterion 5
gaps close, because step 1 opens the companion page in a browser — the exact path
the token disclosure sat on.

## Flagged assumptions carried forward

Both are recorded from the plan unchanged; neither is auto-resolved.

- **FOUND-04 — `unclassified — review manually`.** "Keep working" is taken to mean a learner reports no behavioural difference between a lesson run before this phase and one run after it, judged by HC-2's three steps. There is no machine definition of it.
- **FOUND-05 — `unclassified — review manually`.** "Migrates forward" was settled behaviourally at verification time by the real `~/.derive/derive.db` reaching `user_version 3` with `turns` and `usage` present. Plan 01-11 adds no migration, so nothing in this gap closure changes it. Recorded rather than re-verified.

## Task Commits

This plan modifies no source file (`files_modified: []`). Its only artifact is
this summary, so there are no per-task code commits; `git rev-list --count
1ea5674..HEAD` is `0` at the moment this summary was written, with a clean
`git status --porcelain server/ scripts/ plugin/ method/ web/`. That is the
docs-only case, not uncommitted work.

1. **Task 1: re-run the verifier's own failed checks against the rebuilt tree** — no commit (no file changed); evidence is the Reproduction table above.
2. **Task 2: the model-free gate, then the plugin and Codex parity run** — no commit (no file changed); evidence is the Model-free gate table above.

**Plan metadata:** the `docs(01-12)` commit carrying this summary.

## Files Created/Modified

- `.planning/phases/01-foundation/01-12-SUMMARY.md` — this summary: the reproduction table, the gate results, the machine state and the two queued human checks.

No file under `server/`, `scripts/`, `plugin/`, `method/` or `web/` was touched.

## Decisions Made

- Every reproduction ran against the built `server/dist/index.js` on a scratch `DERIVE_DATA_DIR`, matching the verifier's method rather than the suite's. The learner's real `~/.derive` was only read.
- The LAN pair was run for real on `192.168.0.166` rather than recorded as unrunnable, so the two rows the verification found most damning are observed passes.
- The first cookie check read an empty Netscape jar as a pass because curl writes HttpOnly cookies behind a `#HttpOnly_` prefix that the `grep -v '^#'` filter dropped. It was corrected and re-run rather than accepted — the same false-green shape this plan exists to catch.
- The plugin and the Codex skills were not installed into the user's agent configuration; the documented invocations are recorded in HC-2 instead.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The cookie reproduction's first form could have passed with no cookie at all**

- **Found during:** Task 1 (the R4 harvested-token row)
- **Issue:** The check parsed curl's cookie jar with `awk '!/^#/'`, but curl writes an HttpOnly cookie as `#HttpOnly_127.0.0.1 …`. The filter dropped the only line that mattered, so "cookie jar names" printed empty while the paired request still returned `200` — a reading that would have been recorded as "an empty jar unlocks the API" or, worse, as a pass with no evidence behind it.
- **Fix:** The jar parse strips the `#HttpOnly_` prefix before filtering comments, and the row now asserts four things on the same server: the cookie's name and length, that its value is **not** the token file's contents, that it gets `200`, that a forged 64-character cookie gets `401`, and that replaying the cookie value as `x-derive-token` gets `401`.
- **Files modified:** none — the reproduction script is a scratch file, not a repository artifact.
- **Verification:** re-run; `Set-Cookie: derive_session=<64 hex>; Path=/; HttpOnly; SameSite=Strict`, cookie `200`, forged cookie `401`, replayed value `401`, `cookie value == token: NO`.
- **Committed in:** no commit — no repository file changed.

**2. [Rule 4 deferred to the verifier] FOUND-04 and FOUND-06 left at `Gaps Found` rather than marked `Complete`**

- **Found during:** plan close-out (the `update_requirements` step)
- **Issue:** This plan declares `requirements: [FOUND-04, FOUND-06]`, and the mechanical close-out step would flip both to `Complete` in `.planning/REQUIREMENTS.md`. Both currently read `Gaps Found` — a state the *verifier* set, and commit `16b9c37` ("revert premature Complete requirements after gaps found") is this phase's record of what happens when an executor overwrites it. FOUND-04's human half (HC-2) is explicitly still unperformed.
- **Fix:** Both requirement rows were left untouched. The evidence that closes them is in this summary's Reproduction table and Model-free gate table; `/gsd-verify-work 01` is the pass that should flip them, because it is the instrument that marked them `Gaps Found`.
- **Files modified:** none (`.planning/REQUIREMENTS.md` deliberately unchanged).
- **Verification:** `grep -n 'FOUND-04\|FOUND-06' .planning/REQUIREMENTS.md` still shows `Gaps Found` and unchecked boxes.
- **Committed in:** no commit — no file changed.

---

**Total deviations:** 2 (1 auto-fixed bug in this plan's own evidence-gathering; 1 deliberate non-action on requirement bookkeeping, deferred to the re-verification pass).
**Impact on plan:** None on scope. Neither touches a source file, and neither weakens an acceptance criterion.

## Issues Encountered

- `node --import tsx` cannot be run from the repository root: pnpm keeps `tsx` under `server/node_modules`, so `collectRepo`'s direct drive is run with `cd server` first. Noted here because the plan's prose does not say it and a re-verification pass will hit the same `ERR_MODULE_NOT_FOUND`.
- The Claude Code plugin is not registered in `~/.claude/plugins/config.json` and `~/.codex/skills` does not exist, so HC-2 needs the two one-line setup steps recorded above. This is recorded rather than fixed — see Decisions.

## User Setup Required

None from this plan. The two agent-side setup steps HC-2 needs are recorded under
"Machine state for the human run" and are the documented, ordinary way to run the
plugin and the skills.

## Next Phase Readiness

- **Success Criterion 5 (FOUND-06) is demonstrated, not merely tested.** All eight ✗ FAIL rows reproduce as passes with the verifier's own instrument. Phase 2 puts provider keys in this process; the boundary they land on now holds against the three attacks the verification actually ran.
- **Success Criterion 1 (FOUND-04)'s machine half is green** after the authentication change: byte-identical wire surface, stdio MCP smoke through a whole lesson.
- **Open:** HC-1 and HC-2 above. HC-2 is the phase's last open question and needs a real model and a real login on two terminals. The phase should not be marked verified until it runs.
- **Ready for:** `/gsd-verify-work 01` (re-verification), with this summary's Reproduction table as the evidence to diff against `01-VERIFICATION.md`.

---
*Phase: 01-foundation*
*Completed: 2026-09-19*

## Self-Check: PASSED

- `.planning/phases/01-foundation/01-12-SUMMARY.md` exists on disk.
- `git rev-list --count 1ea5674..HEAD` = `0`, with `git status --porcelain server/ scripts/ plugin/ method/ web/` empty — the docs-only case, matching `files_modified: []`. No production commit is expected or missing.
- Plan-level verification re-run at close: `git diff --quiet -- web/` exit 0, `git diff --quiet -- server/test/wire-surface.json` exit 0, `node scripts/check-method.mjs` exit 0, `node scripts/doctor.mjs` exit 0.
