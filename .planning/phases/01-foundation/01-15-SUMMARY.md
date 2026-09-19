---
phase: 01-foundation
plan: 15
subsystem: usage-ledger, project-records
tags: [ledger, restart, boot-sweep, idempotence, requirements-accuracy, roadmap, human-verification]
status: complete

# Dependency graph
requires:
  - "01-13: the repo-import symlink closure, which is one of the two gap-wave changes the exposure test measures against"
  - "01-14: the loopback credential posture (branch A) and the deletion of the browser's dead token path, which is what makes the ROADMAP's old web/ constraint false"
  - "01-06: the turns and usage tables, closeUsage, and D-16's rule that an unreported turn gets nulls and 'unknown' rather than an estimate"
provides:
  - "A usage ledger that reconciles across a restart: the boot sweep closes turns through closeOpenTurns, which now gives every swept turn the row db.ts's own comment promises it"
  - "A tx.test.ts case that asserts the restart invariant with row counts rather than with an absence of throws, and drives the idempotent path explicitly"
  - "A traceability table and checkbox list stating what the re-verification's own coverage table found, for all seven Phase 1 requirement IDs"
  - "A `Phase 1 status basis` block under the table naming, per requirement, the surface its sentence names, whether this run's diff sits on it, and the gate green afterwards — with the diff range written in so a later reader can re-run the test"
  - "A ROADMAP Phase 1 cross-cutting constraint that is true of the tree this run leaves behind"
affects: [phase UAT harvest, Phase 2 settings and secrets, Phase 4 usage page, 01-VERIFICATION re-run]

actuals:
  tokens: 26933
  tasks: 2
  commits: 2
plan_head_before: 7ad7c707cc5c39b9c7689e93afa887c67596bca9

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "An invariant is enforced at the one place it can be — the function where a turn ends with no driver to report for it — rather than at whichever caller remembers"
    - "A close that may run twice is made safe by the callee's own early return, and the second run is driven by a case rather than assumed"
    - "A requirement's status is promoted only with a gate green on the tree the run leaves behind, and the exposure test that decided which requirements need one is written into the record beside the status, with its diff range, so it can be re-run rather than trusted"

key-files:
  created: []
  modified:
    - server/src/db.ts
    - server/test/tx.test.ts
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md

key-decisions:
  - "The closeUsage call lives inside closeOpenTurns, not at the boot loop in server/src/index.ts: the sweep is the one place a turn ends without a driver, so the invariant is enforced where it can be rather than wherever a future caller remembers"
  - "The call sits inside the withTx block closeOpenTurns already opens, so the sweep and the rows it owes the ledger are one write"
  - "Nothing was estimated: a swept turn that reported nothing gets nulls and cost_source 'unknown' (D-16), and a turn that reported keeps exactly the row it reported (closeUsage's own early return)"
  - "The verification report's Requirements Coverage table was used as the authority over its prose summary, which names only FOUND-01..03 for promotion while its own table records FOUND-05 and COST-01 as satisfied with evidence"
  - "Exposure was recomputed per requirement at execution time from the requirement's own sentence intersected with `git diff --name-only cc1f818..HEAD`, never from a file list; the plan's worked entries were checked against that test and agreed"
  - "FOUND-06 stays unpromoted: the verifier recorded it blocked, and no gate inside the run that wrote the repair can stand in for the verifier on the run's own repair"
  - "`gsd-tools query requirements.mark-complete` was deliberately not run — it would have flipped FOUND-04 and FOUND-06 to Complete, which is the exact false record this plan exists to repair"

patterns-established:
  - "A per-requirement exposure test — the requirement's own sentence against the run's diff range — written into the record with its range, so it is re-runnable rather than a conclusion a later reader has to accept"

requirements-completed: [FOUND-01, FOUND-02, FOUND-03, FOUND-05, COST-01]

coverage:
  - id: D1
    description: "A turn the boot sweep closes carries a usage row, so turn counts and usage counts reconcile across a restart"
    requirement: COST-01
    verification:
      - kind: unit
        ref: "server/test/tx.test.ts#a restart > leaves the ledger reconciling: every turn the sweep closes carries a usage row"
        status: pass
      - kind: manual_procedural
        ref: "DERIVE_DATA_DIR=$(mktemp -d) node --import tsx: two open turns, one reported, closeOpenTurns('interrupted') => silent turn has one row with cost_source 'unknown' and every token column null"
        status: pass
    human_judgment: false
  - id: D2
    description: "The close is idempotent on the turn id: a turn that already reported keeps exactly the row it reported and is not given a second row of nulls"
    requirement: COST-01
    verification:
      - kind: unit
        ref: "server/test/tx.test.ts#a restart > … (listUsage({turn: reported}).length === 1, input 120 / output 34 / source 'provider' intact)"
        status: pass
      - kind: manual_procedural
        ref: "the same scratch-database drive: reported rows = 1 with input_tokens 9 and cost_source 'provider' after the sweep"
        status: pass
    human_judgment: false
  - id: D3
    description: "The case asserts with row counts rather than with an absence of throws, as the suite's own doc comment demands"
    requirement: COST-01
    verification:
      - kind: other
        ref: "assert.deepEqual(ledgerOf(learner.id), { turns: 2, usage: 2 }) after the sweep, preceded by { turns: 2, usage: 1 } before it; grep -c 'ledgerOf' server/test/tx.test.ts => 10 (baseline 8)"
        status: pass
      - kind: unit
        ref: "control run: git show HEAD:server/src/db.ts restored, tx suite => # fail 1, exactly the new case"
        status: pass
    human_judgment: false
  - id: D4
    description: "The seven Phase 1 traceability rows and the Foundation checkbox list state what the re-verification's own coverage table found"
    requirement: FOUND-01
    verification:
      - kind: other
        ref: "grep -c 'Gaps Found' .planning/REQUIREMENTS.md => 1; grep -c 'Needs Human' => 1; sed -n '13,20p' | grep -c '^- \\[x\\]' => 4; grep -c '^- \\[ \\]' => 2"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every Complete is met, in the same file, by a gate green on the tree this run leaves behind, and by the test a later reader can re-run"
    requirement: FOUND-05
    verification:
      - kind: other
        ref: "the Phase 1 status basis block: ID set => 7, distinct gate names (wire-surface, tx.test.ts, driver.test.ts, migration suite, check-method) => 5, cc1f818 range present => 1"
        status: pass
      - kind: integration
        ref: "pnpm test => # pass 159, # fail 0 (phase floor 144); migration, driver, usage and mcp suites green"
        status: pass
      - kind: other
        ref: "git diff --quiet 239d5f1..HEAD -- server/test/wire-surface.json => exit 0; node scripts/check-method.mjs => '6 rendered copies match'"
        status: pass
    human_judgment: false
  - id: D6
    description: "The ROADMAP's Phase 1 cross-cutting constraint is true of the tree this run leaves behind, and all three gap plans are listed with their waves"
    requirement: FOUND-03
    verification:
      - kind: other
        ref: "grep -c 'git diff --quiet -- web/' .planning/ROADMAP.md => 0; 01-13/01-14/01-15-PLAN.md each => 1; node phase-count check => 'roadmap phase list intact: 7'"
        status: pass
    human_judgment: false
  - id: D7
    description: "The two human-only checks are carried forward with the verifier's own scripts and neither is recorded as performed"
    requirement: FOUND-04
    verification: []
    human_judgment: true
    rationale: "HC-1 and HC-2 need a real browser and a real model on two terminals. Both are recorded below with the verification report's own script text; WINDOWS.md #4 and #5 already carry them as open unrun-verify entries. Nothing here was taken on a summary's word — the verifier confirmed HC-2 unperformed by inspection (~/.codex/skills absent, no derive entry in ~/.claude/plugins/config.json)."

# Metrics
duration: 22 min
completed: 2026-09-19
---

# Phase 01 Plan 15: The Ledger Reconciles Across a Restart, and the Record Says What Holds Summary

**`closeOpenTurns` now calls `closeUsage` for every turn it sweeps, inside the transaction it already opens, so the invariant `server/src/db.ts` states in its own words — "Every turn gets a usage row, whichever driver ran it" — survives a restart; and the traceability table, the ROADMAP's Phase 1 constraint and the two human-only checks now say what actually holds, each promotion met by a gate green on the tree this run leaves behind.**

## Performance

- **Duration:** 22 min
- **Tasks:** 2
- **Files modified:** 4
- **Commits:** 2 (measured: `git rev-list --count 7ad7c70..HEAD`)

## Accomplishments

- **A restart no longer breaks the ledger.** One `for (const r of rows) closeUsage(r.id);` inside `closeOpenTurns`' existing `withTx` block. The sweep is the one place a turn ends with no driver to report for it, so the invariant is enforced there rather than at the boot loop in `server/src/index.ts`, which needed no edit. The doc comment gained one sentence naming the reason — a turn the sweep closes is still a turn, so it still owes the ledger a row.
- **Nothing is estimated and nothing is omitted.** A swept turn that reported nothing gets one row of nulls with `cost_source` `'unknown'` (D-16, which explicitly rejects estimating from transcript length); a turn that reported before the process died keeps exactly the row it reported, because `closeUsage` returns early when the turn already has usage.
- **The case asserts counts, not the absence of a throw.** `tx.test.ts` creates a learner and a lesson, starts two turns, lets one report and leaves the other silent, and compares the whole `ledgerOf(learner.id)` object with `assert.deepEqual` — `{ turns: 2, usage: 1 }` before the sweep, `{ turns: 2, usage: 2 }` after. It then drives idempotence explicitly (the reported turn still has exactly one row, with its own figures intact) and asserts the created row is nulls and `'unknown'` rather than zeros.
- **The case was confirmed to fail against the pre-fix source.** `git show HEAD:server/src/db.ts` was restored temporarily and the suite re-run: `# fail 1`, naming exactly the new case. It is a regression test, not an assertion that happens to hold.
- **The record now states what the verification found.** FOUND-01, FOUND-02, FOUND-03, FOUND-05 and COST-01 read `Complete`; FOUND-04 reads `Needs Human`; FOUND-06 is untouched at `Gaps Found`. The Foundation checkbox list matches the rows exactly.
- **Every `Complete` is met, in the same file, by the evidence supporting it.** A `Phase 1 status basis (gap run 01-13..01-15)` block sits under the traceability table naming, per requirement, the surface its own sentence names, whether `git diff --name-only cc1f818..HEAD` puts this run on that surface, and which gate supports the status. The diff range is written into the block's opening line, so a later reader re-runs the test rather than trusting today's reading.
- **The ROADMAP no longer asserts a constraint this run makes false.** The Phase 1 cross-cutting bullet now records what held and when: `web/` was untouched through plans 01-01..01-12 and the first gap wave, and 01-14 deliberately ends that on the re-verification's own instruction, with `noUnusedLocals` in `web/tsconfig.app.json` as the check that the deletion is complete.

## Task Commits

1. **Task 1: a restart leaves the ledger reconciling, end to end** — `280bcf0` (fix)
2. **Task 2: the record says what holds — requirement statuses, the ROADMAP constraint, and the two human checks** — `d149509` (docs)

## Files Created/Modified

- `server/src/db.ts` — `closeOpenTurns` calls `closeUsage(r.id)` for every swept row inside its existing `withTx`; its doc comment gained a paragraph naming why the call lives here and not at the caller.
- `server/test/tx.test.ts` — `closeOpenTurns` added to the destructured dynamic import; a new top-level `describe('a restart')` holding the row-count case; the suite doc comment extended with one clause naming what the case drives.
- `.planning/REQUIREMENTS.md` — six traceability statuses updated (FOUND-01, 02, 03, 05, COST-01 → `Complete`; FOUND-04 → `Needs Human`); four checkboxes ticked; the `Phase 1 status basis` block added under the table; the footer's last-updated line corrected.
- `.planning/ROADMAP.md` — the Phase 1 cross-cutting constraint rewritten. The gap-closure plan list, the **Plans** paragraph and the Progress table already carried 01-13, 01-14 and 01-15 with their waves and needed no edit.

## The exposure test, and what it returned

The plan forbids deciding exposure from a file list. Both halves were read fresh
at execution time: each requirement's own sentence from `.planning/REQUIREMENTS.md`
lines 14-19 (and line 47 for COST-01), written down before any diff was opened,
and then `git diff --name-only cc1f818..HEAD`.

**The run's diff since `cc1f818`** (the commit that added `01-VERIFICATION.md`,
and so the tree the verifier's coverage table describes):

```
.env.example                          server/src/db.ts
README.md                             server/src/index.ts
scripts/doctor.mjs                    server/src/mcp.ts
web/src/lib/api.ts                    server/src/repo.ts
web/src/lib/useLesson.ts              server/test/api.test.ts
                                      server/test/guards.test.ts
                                      server/test/security.test.ts
                                      server/test/tx.test.ts
```

plus `.planning/` artifacts (`ROADMAP.md`, `STATE.md`, `WINDOWS.md`,
`01-PATTERNS.md`, and the 01-13/01-14/01-15 plan and summary files).

| ID | Surface its own sentence names | Intersection with the diff | Result |
|---|---|---|---|
| FOUND-01 | the single tool definition (`tools.ts`), every driver, the MCP server, the HTTP action validation | `server/src/mcp.ts`, `server/src/index.ts` | **exposed** |
| FOUND-02 | the method source under `method/`, its rendered copies, and the CI gate over them | none — no `method/` path, neither render/check script, no rendered copy | **untouched** |
| FOUND-03 | the driver interface, the event sink, the web UI, the SSE stream, the terminal mirrors | `web/src/lib/api.ts`, `web/src/lib/useLesson.ts`, the `/api/*` stream step in `server/src/index.ts` | **exposed** |
| FOUND-04 | the plugin and Codex paths, the wire-surface snapshot, the stdio MCP smoke test | `server/src/mcp.ts` | **exposed** (machine half) |
| FOUND-05 | the numbered migration runner and the transactional writes, both in `server/src/db.ts` | `server/src/db.ts` (task 1) | **exposed** |
| FOUND-06 | the bind, the Host and Origin checks, the per-install token, the redaction paths | `server/src/index.ts`, `server/src/repo.ts`, `server/src/secrets.ts`'s consumers, `scripts/doctor.mjs`, `.env.example`, three test suites | **exposed** (most of the run) |
| COST-01 | the per-turn usage ledger — raw counts, model id, cost source — in `server/src/db.ts` | `server/src/db.ts` (task 1) | **exposed** |

**The test agreed with the plan's worked entries on all seven.** No entry had to
be overridden, and no ID was lifted off or put onto a surface the plan did not
mention. The one place worth naming: `README.md` is in the diff and might look
like FOUND-02's "docs", but `scripts/render-method.mjs`'s `TARGETS` list holds
six entries and `README.md` is not one of them, so the intersection is genuinely
empty and FOUND-02's record rests on `scripts/check-method.mjs` being green
rather than on an absence alone.

**The gate behind each promotion, all measured after this run's edits:**

| ID | Gate |
|---|---|
| FOUND-01 | `git diff --quiet 239d5f1..HEAD -- server/test/wire-surface.json` → exit 0; `test/mcp.test.ts` → `# pass 3, # fail 0` |
| FOUND-02 | `node scripts/check-method.mjs` → exit 0, "6 rendered copies match method/" |
| FOUND-03 | `test/driver.test.ts` → `# pass 5, # fail 0`, and green inside `pnpm test` at `# fail 0` |
| FOUND-05 | `test/migrations.test.ts` → `# pass 13, # fail 0`, green inside the same run |
| COST-01 | `test/tx.test.ts` → `# pass 13, # fail 0` including the restart case; `test/usage.test.ts` → `# pass 9, # fail 0`; `pnpm test` → `# pass 159, # fail 0` |

Task 2's precondition — tx, usage and the full suite all green on this tree
before any status was written — held, and was checked rather than assumed.

## The prose/table discrepancy, and the FOUND-06 asymmetry

**The discrepancy, stated rather than silently resolved.**
`01-VERIFICATION.md`'s prose paragraph ("**REQUIREMENTS.md accuracy:**") names
only FOUND-01, FOUND-02 and FOUND-03 for promotion and omits FOUND-05 and
COST-01; its own Requirements Coverage table records both of those as
✓ SATISFIED with evidence (live DB at `user_version 3` and WR-01 closed for
FOUND-05; the full `usage` column set with nulls rather than estimates for
COST-01). The table was taken as the authority because it is the per-requirement
finding and the prose is a summary of it. Promoting the two the prose omits is
therefore a stated reading of the report's own evidence, not a silent extension
of its instruction.

**Why FOUND-06 is not the same case.** The five promoted rows were already
recorded satisfied by the verifier; what their gates add is only the fact that
this run's changes did not break what was found. FOUND-06 was recorded ✗ BLOCKED,
so any `Complete` for it would be this plan passing its own repair on its own
word, and no gate inside the run that wrote the repair can stand in for the
verifier there.

## Outstanding human verification

Neither of these is recorded as performed. Both are carried forward for the
phase UAT harvest, with the verification report's own text rather than a
paraphrase. `WINDOWS.md` #4 and #5 already hold them as open `unrun-verify`
entries.

### HC-1 — browser session-cookie smoke (`01-VERIFICATION.md` § "Human Verification Required" item 2, WINDOWS.md #4)

**Test:** Open `http://localhost:4310` in a real browser, start a lesson, answer
a card, watch the graph update, and check DevTools' Network tab.

**Expected:** The page loads, the SSE stream connects, cards render and answers
land — all carried by the `derive_session` cookie, with no `x-derive-token`
header sent by the page.

**Why human:** No automated test drives a real browser. `curl` proves the cookie
authenticates both `/api/lessons` and the SSE stream; it cannot prove the page's
own `fetch` and `EventSource` send it.

**Note added by this run:** `01-14` changed how the browser gets that cookie —
`http://localhost:4310` on its own now answers 401, and the entry point is the
tokenised link the server prints on its first startup line. HC-1 should be run
against that link.

### HC-2 — plugin and Codex parity run (FOUND-04, Success Criterion 1; `01-VERIFICATION.md` item 1, WINDOWS.md #5)

**Test:**
1. In a Claude Code session with the plugin installed from this repo, run
   `/derive:learn` on any small topic. Confirm: the companion page opens; the
   tutor probes before planning; `set_plan` renders a graph and waits for your
   approval; a check question renders as a card and grades; locking a node lights
   the graph; `/derive:review` on a later run offers the nodes that are due.
2. In a Codex session with the Derive skills installed, run `derive-learn` on any
   small topic and confirm the same sequence. This is the first run where the
   Codex skill has a real method body rather than tool descriptions alone —
   confirm the tutor teaches rather than only quizzing.
3. Confirm nothing the learner sees has changed: same cards, same graph, same
   phases, same wording of the refusal when you try to lock a node on a procedure
   question alone.

**Expected:** Both lessons complete exactly as before; report anything that
behaves differently, however small.

**Why human:** Needs a real model and a real login on two terminals. The verifier
confirmed it unperformed **by inspection rather than on any summary's word**:
`~/.codex/skills` does not exist and `~/.claude/plugins/config.json` has no
`derive` entry. It is not to be recorded as done on a summary's word now either.

**When:** after this gap run lands, because step 1 opens the browser companion
page whose credential path `01-14` changed.

## Advisory findings from 01-VERIFICATION.md — all six accounted for

| # | Finding | Disposition |
|---|---|---|
| 1 | Boot sweep closes turns without `closeUsage`, breaking the ledger invariant on every restart (`index.ts:69-71`, invariant at `db.ts:637-648`) | **Closed by 01-15 task 1** — the call moved inside `closeOpenTurns`, asserted by the new `tx.test.ts` case |
| 2 | Host check requires an explicit port, so `PORT=80`/`443` refuses every browser (`index.ts:202`) | **Closed by 01-14** — an absent port is judged as the scheme default; a present port must still match exactly |
| 3 | `c.redirect(c.req.path)` is a protocol-relative open redirect and a CRLF 500 (`index.ts:1101`) | **Closed by 01-14** — the `Location` is normalised through `new URL(path, 'http://127.0.0.1').pathname`, with a case asserting `//evil.example` collapses to `/` |
| 4 | `/api/health` is exempt from `guardLocal` entirely, not only from the credential (`index.ts:228`) | **Closed by 01-14** — `guardLocal` runs before the health exemption, so only the credential is skipped; foreign Host and foreign Origin are both 403 on health |
| 5 | `walk()` follows directory symlinks with no cycle guard (`repo.ts:122-143`) | **Closed by 01-13** — the `lstatSync` substitution makes a directory link neither a file nor a directory, so there is nothing to recurse into; asserted by the ancestor-link case |
| 6 | `DELETE /api/learners/:id` leaves pending prompts, held cards and `recentCards` alive (`index.ts:312-322`) | **Left open, deliberately.** It is an in-memory lifecycle concern spanning `server/src/prompts.ts` and the `held` / `recentCards` maps in `server/src/index.ts`, not a front-door or ledger defect; the verifier rated it code-read-only with no reproduction; and folding it into a security gap-closure run would put two unrelated changes in one diff. Carried into STATE.md as a concern rather than recorded closed. |

## Verification Results

| Check | Result |
|---|---|
| `pnpm typecheck` | exit 0, no `error TS` |
| `pnpm --filter server exec node --import tsx --test test/tx.test.ts` | `# pass 13`, `# fail 0`; TAP names `a restart` → `leaves the ledger reconciling…` |
| `pnpm --filter server exec node --import tsx --test test/usage.test.ts` | `# pass 9`, `# fail 0` |
| `pnpm test` | `# pass 159`, `# fail 0` (phase floor 144; tree at dispatch 158) |
| Control run (`HEAD:server/src/db.ts` restored) | `# fail 1` — exactly the new case |
| Hand-driven sweep on a scratch database | silent turn → 1 row, `cost_source` `unknown`, all five token columns and `cost_usd` null; reported turn → 1 row with its own figures intact |
| `grep -c 'ledgerOf' server/test/tx.test.ts` | `10` (baseline `8`) |
| `grep -c 'closeUsage' server/src/db.ts` | `3` (definition, doc-comment reference, new call) |
| `grep -c 'Gaps Found' .planning/REQUIREMENTS.md` | `1` |
| `grep -c 'Needs Human' .planning/REQUIREMENTS.md` | `1` |
| `grep -c 'Phase 1 status basis' .planning/REQUIREMENTS.md` | `1` |
| basis block ID set (`grep -o 'FOUND-0[1-6]\|COST-01' \| sort -u \| wc -l`) | `7` |
| basis block gate names (`grep -o` alternation `\| sort -u \| wc -l`) | `5` |
| basis block diff range (`grep -c 'cc1f818'`) | `1` |
| `sed -n '13,20p' … \| grep -c '^- \[x\]'` / `'^- \[ \]'` | `4` / `2` |
| `grep -c 'git diff --quiet -- web/' .planning/ROADMAP.md` | `0` |
| `grep -c '01-13-PLAN.md' / '01-14-PLAN.md' / '01-15-PLAN.md'` in ROADMAP | `1` / `1` / `1` |
| node phase-list check | `roadmap phase list intact: 7` |
| `git diff --stat -- .planning/ROADMAP.md .planning/REQUIREMENTS.md` | both files named, nothing else |
| `git diff --quiet 239d5f1..HEAD -- server/test/wire-surface.json` | exit 0 |
| `node scripts/check-method.mjs` | exit 0, "6 rendered copies match method/" |

## Flagged Assumptions Resolved

The plan carried thirteen `unresolved` edge-probe rows. Three are now asserted
rather than assumed; the rest are unchanged by this run and stay flagged as the
plan recorded them.

| Requirement | Category | Where it now stands |
|---|---|---|
| COST-01 | adjacency | **Asserted.** Two closes of the same turn id do not merge into two rows — the new case sweeps a turn that already reported and asserts `listUsage({turn}).length === 1` with the original figures intact |
| COST-01 | empty | **Asserted.** A turn with no reported counts gets a row of nulls with `cost_source` `'unknown'`, driven in the swept-turn form and confirmed by hand on a scratch database |
| FOUND-05 | unclassified | **Adjacent invariant asserted.** The probe derived no predicate; what this run drives is that a restart leaves `turns` and `usage` consistent. The migration runner itself is untouched and its suite is green |
| FOUND-01 ×4, FOUND-02 ×2, FOUND-03 ×3, COST-01 (ordering) | various | Unchanged and unexercised by this run; carried forward exactly as the plan recorded them |

## Decisions Made

- **The call lives in `closeOpenTurns`, not at the boot loop.** `server/src/index.ts` needed no edit. Putting it at the caller would leave the next caller of `closeOpenTurns` free to forget, which is how the invariant was broken in the first place.
- **Nothing was narrowed to make a claim pass.** The suite doc comment gained one clause naming what the new case drives — a sweep leaves the ledger reconciling — and claims nothing beyond it. `db.ts`'s invariant paragraph was extended with the reason, not with a restatement of the call.
- **The verifier's table beat its prose, and the reading is on the record.** See the discrepancy section above.
- **`requirements.mark-complete` was not run.** See Deviations.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] The workflow's `update_requirements` step would have flipped FOUND-04 and FOUND-06 to `Complete`**
- **Found during:** Task 2 close-out
- **Issue:** `01-15-PLAN.md`'s frontmatter declares `requirements: [FOUND-01..FOUND-06, COST-01]`, and the executor's standard close-out runs `gsd-tools query requirements.mark-complete` over that array. Running it would have overwritten the statuses task 2 had just authored deliberately — flipping FOUND-04 off `Needs Human` and FOUND-06 off `Gaps Found` — breaking this plan's own `grep -c 'Gaps Found' == 1` and `grep -c 'Needs Human' == 1` gates and committing, in the file that exists to repair exactly this, a status no evidence supports.
- **Fix:** The command was not run. The traceability table stands as task 2 wrote it, with the basis block underneath. `requirements-completed` in this summary's frontmatter lists the five IDs that are actually complete rather than copying the plan's seven-ID array verbatim; listing FOUND-06 there would be the same false record in a second file.
- **Files modified:** none (a write that was deliberately not made)
- **Verification:** `grep -c 'Gaps Found'` → `1`, `grep -c 'Needs Human'` → `1`, and the seven rows read `Complete ×5 / Needs Human / Gaps Found`.
- **Committed in:** `d149509` (the state the commit preserves)

**2. [Rule 2 - Missing critical] `REQUIREMENTS.md`'s footer still claimed it was last updated on 2026-09-17**
- **Found during:** Task 2
- **Issue:** The plan scoped the edit to the traceability rows, the checkbox list and the new block. The file's closing line — "Last updated: 2026-09-17 after the simplicity trim" — became false the moment six statuses changed, and a stale last-updated line in the accuracy repair is the same shape of defect the plan is repairing.
- **Fix:** One line, naming the date and what changed. No other line outside Phase 1's rows was touched; every requirement row for another phase is byte-identical.
- **Files modified:** `.planning/REQUIREMENTS.md`
- **Verification:** `git diff --stat` names only the two planned documents; the six REQUIREMENTS gates all pass.
- **Committed in:** `d149509`

---

**Total deviations:** 2 auto-fixed (2 × Rule 2 — missing critical accuracy work).
**Impact on plan:** None on scope. Both protect the plan's own purpose: one
prevents an automated step from writing the false status the plan exists to
remove, the other removes a false sentence in the same file.

## Issues Encountered

**Committed on `main`.** The executor's pre-commit guard reports `main` as a
protected branch and `git.allow_default_branch_commits` is not set.
`.planning/config.json` has `git.branching_strategy: "none"`, the dispatch
context put this run on the main working tree in sequential mode, and every GSD
commit of this phase — plans 01-01 through 01-14 — is on `main`. Branching now
would split the phase across two refs. Recorded the way plans 01-09 through
01-14 recorded it; no destructive git operation was used, and
`git.allow_default_branch_commits: true` was not written into the user's config.

**Advisory finding 6 stays open** and is carried into STATE.md as a concern —
`DELETE /api/learners/:id` leaves pending prompts, held cards and `recentCards`
entries alive for the lessons it deletes.

Otherwise none.

## Known Stubs

None. No `TODO`/`FIXME` marker was introduced, no test is skipped or `todo`, and
no `<verify>` command was left unrun — all four of task 1's and all eight of
task 2's ran, plus task 1's hand-driven scratch-database acceptance criterion
and the pre-fix control run.

## Threat Flags

None. The change introduces no network endpoint, auth path, file-access pattern
or schema change; it adds one row to an existing table through an existing write
path, inside a transaction that already existed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

All six of `01-VERIFICATION.md`'s `missing:` items are now closed across
`01-13`, `01-14` and `01-15`, and five of its six advisory findings with them.
What remains before Phase 1 can be called verified is not executor work:

1. **A verification re-run.** FOUND-06 is deliberately still `Gaps Found`; the
   gap run that repairs it cannot pass its own repair.
2. **HC-2**, FOUND-04's human half, which the verifier confirmed unperformed by
   inspection. Run it after this gap run lands.
3. **HC-1**, the browser smoke — now against the tokenised startup link rather
   than a bare `http://localhost:4310`.

Advisory finding 6 is carried as a concern, not as work this phase owes.

## Self-Check

- `server/src/db.ts` — FOUND
- `server/test/tx.test.ts` — FOUND
- `.planning/REQUIREMENTS.md` — FOUND
- `.planning/ROADMAP.md` — FOUND
- commit `280bcf0` — FOUND
- commit `d149509` — FOUND

## Self-Check: PASSED
