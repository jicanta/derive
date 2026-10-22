---
phase: 04-local-models-parity-proof-and-usage
plan: 04
subsystem: testing
tags: [prov-13, conformance, parity-proof, github-actions, nightly, tool-rejections, migration, redaction, a7]

# Dependency graph
requires:
  - phase: 04-03-the-teaching-proof
    provides: driverFor, runTurn's per-turn provider-and-model option, the scratch-lesson posture a proof leaves no trace by, migration 8
  - phase: 04-02-the-capability-read
    provides: the capability refusal at the model write and the activation, probe.ts's detection pass and testConnection
  - phase: 04-01-local-models-on-the-owned-loop
    provides: every catalogue row teaching, the Ollama adapter's options block (num_ctx, think, reliableToolCalling)
  - phase: 03-owned-loop
    provides: validateToolInput and its single throw site in the owned loop, the replay guard, the turn ledger and deleteLesson's one transaction
  - phase: 02-settings-and-secrets
    provides: registerSecret/redactErrors/safeMessage, the settings table, the install token and the Host/credential guard the harness calls through
provides:
  - "scripts/conformance.mjs: one harness, two environments — a nightly CI run for reachable cloud providers and `pnpm conformance` for this machine's local models"
  - "a complete report: every teachable provider either carries its three verdicts (pretest, understanding gate, cumulative quiz) or an explicit skipped line with its reason"
  - "exitCodeFor: the pure, exported report-to-exit-code decision with a main-guard, so the failing path is checkable with no provider, no key and no model"
  - "a dated JSON document plus a Markdown summary rendered from that same JSON, under --out or <data dir>/conformance"
  - "migration 9's append-only tool_rejections table, with an index for the per-turn read and one for the per-provider-and-model read"
  - "recordToolRejection at the one validateToolInput throw site, re-throwing unchanged: no refusal, no nudge, no retry"
  - "toolRejectionRate: the schema-rejection rate per provider and model, read by the harness and the ledger and by nothing else"
  - "DERIVE_OLLAMA_THINK: `think` as a variable a run can set, which is the detector research assumption A7 has been waiting for"
  - ".github/workflows/conformance.yml: an off-the-hour cron beside a workflow_dispatch, the four pinned actions, the four optional cloud keys and an always-run artifact upload"
affects: [04-05-usage-page, 05-learning-experience]

# Actuals (#2632) — same estimateTokens scale (chars/4) as the plan's estimate,
# and the same instrument waves 2 and 3 named so a calibration compares like
# with like: chars/4 over the ADDED lines of the realized diff of scripts,
# server/src, server/test, .github, package.json and .env.example between
# plan_head_before and HEAD (55,540 chars). NOT a harness token count.
actuals:
  tokens: 13885
  tasks: 3
  commits: 3
plan_head_before: ffb29d5362ebc61f4802cdf1534c63a9a1453188

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A harness that drives real models runs the built server in a throwaway data directory, so a parity proof leaves no lesson, node, FSRS interval or usage row behind"
    - "A standalone script outside the server's egress chokepoints registers every environment key with registerSecret before its first request and routes every recorded sentence through safeMessage"
    - "The exit decision is a pure exported function of the finished report with a main-guard, so the failing path is gated over rows handed in as inputs rather than over a fake provider"
    - "One table is read twice: the scripted prompt and the card answer key are rendered from the same rows, so the two cannot disagree about which option is correct"
    - "A diagnostic measurement records nothing and throws nothing when its turn is unknown — a throw would replace the correctable tool error the model is about to receive"
    - "The `forgets to bump the number` pin on LATEST_VERSION moves to the newest migration's block, which is the only place it keeps catching anything"

key-files:
  created:
    - scripts/conformance.mjs
    - .github/workflows/conformance.yml
    - .planning/phases/04-local-models-parity-proof-and-usage/04-USER-SETUP.md
  modified:
    - server/src/migrations.ts
    - server/src/db.ts
    - server/src/drivers/api.ts
    - server/src/drivers/adapters.ts
    - server/src/config.ts
    - server/test/usage.test.ts
    - server/test/api-driver.test.ts
    - server/test/migrations.test.ts
    - .github/workflows/ci.yml
    - package.json
    - .env.example

key-decisions:
  - "The replay runs against the built server in a throwaway data directory, not the learner's ~/.derive: a parity harness that drove the learner's own database would put ten conformance lessons in Home, ten sets of FSRS rows in the Atlas and ten usage rows in the Usage total. Keys therefore come from the environment (which is how both CI and a local .env supply them) and never from the learner's secrets file, which also keeps the harness from copying a 0600 file anywhere"
  - "The two subscription-login rows are opt-in behind --logins, and are reported as skipped with that reason otherwise. A login row's model requests spend the owner's own subscription rather than a key configured for this, and no CI runner has a login at all — so the default would have made the plan's own no-keys gate drive two real lessons on this machine. D-17 is satisfied by the letter and the spirit: the rows are named, with the reason, never dropped"
  - "The quizzes are scripted with their own answer key, because the card payload deliberately does not carry `correct` — the browser must not see it. A fixed question, fixed options and a declared correct option are the only way the method's own server-side grading can decide a verdict, and they are also what makes the report comparable: the script is identical on every row, so a difference is a difference in the model"
  - "The opening turn is interrupted rather than used. `POST /api/lessons` always fires firstTurnPrompt, which forces the probe phase, so the harness quiets that turn (interrupt is idempotent and cancels pending cards) and sends the script as the turn after it"
  - "`drive` only looks at events past the seq the lesson had before the script was sent, and treats an idle lesson as finished only once it has seen the scripted turn open. Without that the first poll after POST /message — which returns before the turn opens — reads as a finished lesson with no events, and every verdict fails for a model that was about to do fine"
  - "The verdicts decide a row's status and nothing else does: a turn that errored after the last question still held the method, and its sentence is kept beside the pass. A timeout and a turn that never opened are failures, not skips — a provider that is reachable but cannot finish a lesson has told you something"
  - "`cumulative` holds only when every non-truth node has a passed cumulative question and none was missed, so the script asks one on each. A weaker definition would let a model that quizzed the goal alone report the cumulative quiz as held"
  - "The rejection table is append-only and keyed on the turn rather than a counter column on `usage`: a column would mean `this request's rejections`, which is not what D-19 counts, and the same migration then also answers *which tool* a model fails on"
  - "The denominator of the rate is the executed calls on the same (driver, model) key, joined through tool_results — which the owned loop is the only writer of, and the owned loop is the only place a rejection can happen, so both sides measure the same surface. `rate` is null, never zero, for a pair that has made no call"
  - "DERIVE_OLLAMA_THINK was added so `--think` is real rather than a label: the plan asks for `think` as a variable the run can set, the adapter had it fixed at false, and A7 cannot be settled by a flag that changes nothing. It is read in config.ts only, has no Settings field and no learner surface"
  - "The loop-level rejection cases live in api-driver.test.ts rather than usage.test.ts: only that file's stub-model harness can make a malformed call actually reach the recording site. The ledger's own rules (where the provider and model come from, the indexed read, the delete) stay beside the usage rows"
  - "The workflow's --out is the runner's temp directory, so no step writes into the repository tree, and nothing softens the run step: a nightly that is green whatever the harness said is worse than no nightly, because it is read as evidence"

patterns-established:
  - "A report is complete or it is nothing: every row is tested or named as skipped with its reason, and the exit code treats a complete all-skipped report as success"
  - "A measurement that could flatter the subject names the layer that could have done the work: the run header records reliableToolCalling and think, because a report readable as healthier than it is would be worse than none"
  - "A gate on a non-zero exit path is built by exporting the decision as a pure function, not by faking the thing being measured"

requirements-completed: [PROV-13]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "One harness replays a fixed scripted lesson per reachable provider and reports, per provider and model, whether the pretest, the understanding gate and the cumulative quiz held"
    requirement: PROV-13
    verification:
      - kind: integration
        ref: "DERIVE_DATA_DIR=$(mktemp -d) node scripts/conformance.mjs --out $(mktemp -d)"
        status: pass
      - kind: other
        ref: "node --check scripts/conformance.mjs"
        status: pass
    human_judgment: true
    rationale: "The all-skipped path, the report shape, the file pair and the exit code are machine-checked here, but no model ran: this machine has no local server and no key, and D-16 forbids standing a stub in for a provider. Whether a real model's replay reaches the three verdicts is the owner's end-of-phase UAT (pnpm conformance with a local model installed, and a dispatched nightly run)."
  - id: D2
    description: "Every provider the environment could not reach is named in the report with an explicit skipped line and its reason, so the report is complete rather than selective"
    requirement: PROV-13
    verification:
      - kind: integration
        ref: "a no-key, no-local-server run: all ten catalogue rows carry status skipped with a non-empty reason, exit 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "The exit code is a pure function of the finished report, exported so the failing path can be exercised with no provider contacted"
    requirement: PROV-13
    verification:
      - kind: unit
        ref: "node --input-type=module -e \"import { exitCodeFor } from './scripts/conformance.mjs'\" — one failed row exits non-zero, an all-skipped report exits 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "A tool call whose arguments fail the full server-side schema is counted once, per provider and model, with the model still receiving the same correctable tool error"
    requirement: PROV-13
    verification:
      - kind: unit
        ref: "server/test/api-driver.test.ts#how often a model produces a call derive cannot accept"
        status: pass
      - kind: unit
        ref: "server/test/usage.test.ts#the tool-rejection ledger"
        status: pass
      - kind: unit
        ref: "server/test/migrations.test.ts#the table the conformance harness counts bad tool calls in"
        status: pass
    human_judgment: false
  - id: D5
    description: "The rejection count has no learner-facing surface and no runtime effect"
    requirement: PROV-13
    verification:
      - kind: other
        ref: "grep -rl 'tool_rejections' web/src/ and grep -rl 'recordToolRejection' web/src/ both return nothing; server/test/wire-surface.test.ts passes and server/test/wire-surface.json is unchanged"
        status: pass
    human_judgment: false
  - id: D6
    description: "A nightly workflow with a dispatch trigger beside an off-the-hour cron, the four pinned actions, the four optional cloud keys in its run step's env, an always-run artifact upload and a job that can fail"
    requirement: PROV-13
    verification:
      - kind: other
        ref: "the conformance.yml content gate (both triggers, four pinned actions, cron minute not 0, if: always(), concurrency, timeout-minutes) and the no-soft-failure gate (no continue-on-error, no || true)"
        status: pass
    human_judgment: true
    rationale: "Everything checkable without pushing to the default branch is machine-checked. GitHub resolves both schedule and workflow_dispatch against the default branch only, so the live `gh workflow run conformance.yml` is the owner's end-of-phase item (owner decision, this planning session: no executor step pushes to main mid-phase)."

# Metrics
duration: 34 min
completed: 2026-10-22
status: complete
---

# Phase 4 Plan 4: The Parity Proof Summary

**A single harness — nightly in CI, `pnpm conformance` locally — replays one fixed scripted lesson per reachable provider and reports, per provider and model, whether the pretest, the understanding gate and the cumulative quiz held, with an explicit skipped line and reason for everything it could not reach and a non-zero exit when a real model actually failed the method.**

## Performance

- **Duration:** 34 min
- **Started:** 2026-10-22T21:24:03Z
- **Completed:** 2026-10-22T21:58:00Z
- **Tasks:** 3 completed
- **Files modified:** 13 (3 created, 10 modified)

## Accomplishments

- `scripts/conformance.mjs` drives real configured models through the production HTTP surface: it starts the built server in a throwaway data directory, runs one detection pass, and for every catalogue row either replays the scripted lesson or records why it could not. The three verdicts are read from the server's own state (`quizzesOn`, `hasUnderstandingPass`, `cumulativeStatus`) rather than from a transcript, because those functions *are* the method.
- The report is complete by construction: ten rows, ten outcomes, nothing silently absent. A no-key, no-local-server run produces ten `skipped` lines with their reasons and exits 0; `exitCodeFor` — pure, exported, main-guarded — is what makes a nightly failure visible, and it is checkable with no provider contacted.
- Migration 9's `tool_rejections` counts exactly what `validateToolInput` rejects, at the one site it is called from, per provider and model, with the model still receiving the identical correctable tool error. No route reads it, no event carries it, nothing in the loop branches on it.
- `.github/workflows/conformance.yml` carries a `workflow_dispatch` beside an off-the-hour cron, the four pinned first-party actions, the four optional cloud keys in the one run step's `env`, and an `if: always()` artifact upload — with nothing that lets a failing harness leave a green job.
- `DERIVE_OLLAMA_THINK` turns research assumption A7 from an open question with no instrument into one a single `--think low` re-run answers.

## Task Commits

1. **Task 1 (tracer): the harness, one row, one report, one exit code** — `d42aa1b` (feat)
2. **Task 2: the narrow rejection rate** — `dcc992d` (feat)
3. **Task 3: the nightly workflow** — `85a1596` (feat)

**Plan metadata:** see the `docs(04-04)` commit that carries this file.

## Files Created/Modified

- `scripts/conformance.mjs` — the harness: the scripted lesson and its answer key, reachability per row, the replay over HTTP, the three verdicts, the JSON and Markdown writers, and `exitCodeFor`
- `.github/workflows/conformance.yml` — the nightly `Conformance` workflow
- `.planning/phases/.../04-USER-SETUP.md` — the four optional repository secrets and the post-merge dispatch
- `server/src/migrations.ts` — migration 9: the append-only `tool_rejections` table and its two indexes
- `server/src/db.ts` — `recordToolRejection`, `toolRejectionRate`, `toolRejectionsOf`, the four prepared statements, and `deleteLesson` clearing rejections before turns
- `server/src/drivers/api.ts` — the recording at the one `validateToolInput` throw site, re-throwing unchanged
- `server/src/config.ts` / `server/src/drivers/adapters.ts` — `OLLAMA_THINK`, so `think` is a variable a run can set
- `server/test/usage.test.ts` — the ledger's own rules (provider and model off the turn, the unknown turn, the per-model rate, the indexed read, the delete), plus `turnWith`'s optional `tutor`
- `server/test/api-driver.test.ts` — one row for a schema-rejected call, none for a well-formed one, none for one the replay guard answered
- `server/test/migrations.test.ts` — migration 9's columns and both indexes; the `LATEST_VERSION` pin moved to the newest migration's block
- `.github/workflows/ci.yml`, `package.json`, `.env.example` — the parse loop, `pnpm conformance`, and the new variable documented

## Decisions Made

See `key-decisions` in the frontmatter. The two that shaped the most code:

**The replay runs in a throwaway data directory.** A parity harness that drove the learner's own `~/.derive` would leave one conformance lesson per provider in Home, its nodes in the Atlas and its usage rows in the Usage total — the footprint plan 04-03 built the scratch-lesson marker to avoid for a single proof. Keys therefore come from the environment, which is how CI and a local `.env` both supply them, and the learner's `secrets.json` is never read or copied.

**The quizzes are scripted with their own answer key.** The `quiz` card payload deliberately omits `correct` — the browser must not see it — so a harness cannot answer a model-authored question correctly on purpose. One table in the script renders both the prompt and the answer key, which is what keeps the two from disagreeing, and `actions.ts` grades every answer exactly as it does for a learner. The side effect is the property the report needs: the script is identical on every row, so a difference in the report is a difference in the model.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] `--think` needed server support to be more than a label**

- **Found during:** Task 1
- **Issue:** The plan requires `think` to be "a variable the run can set", because this harness is the only detector for research assumption A7 (whether a tool-capable Ollama model keeps calling tools with thinking off). The Ollama adapter had `think: false` as a literal, and nothing over HTTP, in Settings or in the environment could change it. A `--think low` flag that changed nothing would have been a lie in the run header and would have left A7 with no instrument at all.
- **Fix:** `OLLAMA_THINK` in `server/src/config.ts` (the one place the environment is read), used by the Ollama adapter, documented in `.env.example`, and passed by the harness as `DERIVE_OLLAMA_THINK` for its own child server. Default `false` — every existing lesson runs exactly as before. No Settings field, no learner surface, no route.
- **Files modified:** `server/src/config.ts`, `server/src/drivers/adapters.ts`, `.env.example`, `scripts/conformance.mjs`
- **Verification:** `pnpm typecheck && pnpm build && pnpm test` (485 pass); `--think` rejects anything but `false|low|medium|high`; the run header records the value.
- **Committed in:** `d42aa1b`

**2. [Rule 3 - Blocking] the two login rows had to become opt-in**

- **Found during:** Task 1
- **Issue:** The plan's own acceptance gate — "running it with no keys and no local server produces a report in which every teachable row carries `status: skipped`, and the process exits 0" — cannot hold on any machine with a Claude Code or Codex login, and this machine has both. With login rows treated as reachable, that gate command would have driven two full real lessons on the owner's subscriptions inside an executor verification step, and a GitHub runner has no login to drive at all.
- **Fix:** `--logins` opts the two rows in; without it each is reported `skipped` with the reason in the report, in the Markdown table and on stdout. No row is dropped, which is what D-17 actually forbids.
- **Files modified:** `scripts/conformance.mjs`
- **Verification:** the no-key run reports ten rows, ten skip reasons, exit 0; `--help` names the flag and its reason.
- **Committed in:** `d42aa1b`

**3. [Rule 1 - Bug] the first poll after `POST /message` read as a finished lesson**

- **Found during:** Task 1 (found by reading the route, before any model had run)
- **Issue:** `POST /api/lessons/:id/message` fires the turn with `void runTurn(...)` and answers immediately, so a poll that arrives before the turn opens sees `busy: false, pending: false`. The drive loop would have returned at once with no events, and every verdict would have failed for a model that was about to do fine — the worst possible failure for a harness whose whole output is verdicts.
- **Fix:** `drive` takes the lesson's seq before the script is sent, considers only events past it, and treats an idle lesson as finished only once it has seen the scripted turn's own `turn_start`. A turn that never opens within 90 seconds is a named failure rather than a silent pass.
- **Files modified:** `scripts/conformance.mjs`
- **Verification:** reviewed against `server/src/index.ts`'s message route and `agent.ts`'s `runTurn`; the start bound is reported in the row's reason. The live path is the owner's UAT (see below).
- **Committed in:** `d42aa1b`

**4. [Rule 3 - Blocking] 04-03's `LATEST_VERSION` pin and the loop-level test placement**

- **Found during:** Task 2
- **Issue:** `migrations.test.ts` pinned `LATEST_VERSION === 8` inside plan 04-03's own describe block, so migration 9 failed two cases. Separately, the plan asks for the loop-level rejection cases in `usage.test.ts`, which drives the *fake* driver — a driver that never calls `validateToolInput`, so a malformed call cannot reach the recording site from there.
- **Fix:** the "forgets to bump the number" pin moved to the newest migration's block (where it keeps catching something), and 04-03's case now asserts the scratch column's default against `LATEST_VERSION` instead of a frozen 8. The loop-level cases went to `api-driver.test.ts`, beside the stub-model harness that can produce a bad call; `usage.test.ts` gained the ledger's own rules. Both files are named in the plan's verify block and both pass.
- **Files modified:** `server/test/migrations.test.ts`, `server/test/usage.test.ts`, `server/test/api-driver.test.ts`
- **Verification:** `pnpm test` — 485 pass, 0 fail.
- **Committed in:** `dcc992d`

---

**Total deviations:** 4 auto-fixed (1 × Rule 1, 1 × Rule 2, 2 × Rule 3)
**Impact on plan:** No scope creep. Three of the four exist because the plan's own stated intent could not be met as literally written (a `think` flag with no wiring, a no-keys gate on a machine with two logins, a rejection test in a file whose driver cannot reject). The fourth is a race the harness would have failed every row on. One product-surface addition (`DERIVE_OLLAMA_THINK`), defaulted off, with its one-sentence reason: a model that stops calling tools with thinking off cannot teach, and nothing else can tell the difference.

## Issues Encountered

**The replay path itself has no automated coverage, and cannot have any here.** This machine has no local model server and no provider key, and D-16 forbids standing a fake provider in for a real one — the whole point of the harness is that only a real model answers the question. So `quiet → script → drive → verdicts` is proven by code review against the routes it calls, and by the owner's end-of-phase UAT (`pnpm conformance` with a local model, and a dispatched nightly run). Recorded in `.planning/WINDOWS.md` as an `unrun-verify` so it is visible at ship time rather than only here.

**Research assumption A7 is still open, as planned.** It is carried as a harness variable, not settled: `--think low` versus the default `false` on a real Ollama server is the comparison, and no verdict about any model has been written into the repo ahead of a real run.

## User Setup Required

**Optional, and the nightly is correct without it.** See [04-USER-SETUP.md](./04-USER-SETUP.md) for the four cloud keys as GitHub repository secrets, and for the post-merge `gh workflow run conformance.yml` that proves ROADMAP Success Criterion 4. Every key is optional by D-17: a run that reports every cloud provider skipped is a complete report.

## Next Phase Readiness

Ready for 04-05 (the Usage page). Nothing in this plan touched the usage ledger's shape, the wire surface or any web file; `tool_rejections` is internal and has no read path outside the harness.

Two items for the owner, both already in the plan:

1. Dispatch `conformance.yml` once after this phase merges — the earliest moment GitHub can resolve either trigger.
2. Run `pnpm conformance` on a machine with a local model, and confirm a weak model failing the gate exits non-zero. That failure is the expected, useful finding the roadmap predicts.

---
*Phase: 04-local-models-parity-proof-and-usage*
*Completed: 2026-10-22*

## Self-Check: PASSED

- Created files on disk: `scripts/conformance.mjs`, `.github/workflows/conformance.yml`, `04-04-SUMMARY.md`, `04-USER-SETUP.md` — all FOUND.
- Commits in history: `d42aa1b`, `dcc992d`, `85a1596` (tasks) and the metadata commit carrying this file — all FOUND.
- Every task `<acceptance_criteria>` and every plan-level `<verification>` command re-run after the last commit: all pass. `pnpm method:check && pnpm typecheck && pnpm build && pnpm test` — 485 tests, 0 failures.
- The one item not machine-checked is the live replay against a real model, which is the owner's end-of-phase UAT by design (D-16 forbids a fake provider) and is recorded in `.planning/WINDOWS.md`.
