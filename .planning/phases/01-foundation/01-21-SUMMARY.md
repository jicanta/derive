---
phase: 01-foundation
plan: 21
subsystem: infra
tags: [security, git, repo-import, confinement, argv-pinning, comment-truthfulness]

requires:
  - phase: 01-foundation
    provides: "01-13's clone pinning (http.followRedirects=false, protocol.allow=never, protocol.https.allow=always) and the https-only scheme check ahead of assertPublicHost"
  - phase: 01-foundation
    provides: "01-17's listing-argv pins, proven load-bearing under a control experiment, and the three hostile-repository cases that drive them"
  - phase: 01-foundation
    provides: "01-20's tree, which set the test-count baseline this plan's floors are relative to"
provides:
  - "server/src/repo.ts — the clone argv now carries the five decided pins (core.sshCommand, credential.helper, core.fsmonitor, core.hooksPath, core.pager) beside the three transport flags it already had, and its environment sets GIT_CONFIG_NOSYSTEM=1"
  - "One machine-config posture across both git invocations in the file rather than two"
  - "A gitListFiles rationale that is accurate in both directions: which knobs ride on which argv, and the three that ride on neither, named as unpinned with the reason"
  - "argvOf/callOf in server/test/guards.test.ts — the -c flags of one function's git invocation, sliced from the call so the comment above it cannot satisfy an assertion about the code"
  - "A case that goes red the next time the sentence and the argument vector disagree, seen red with a pin removed and green with it restored"
affects: [repo-import, provider-hardening, adoption-docs]

actuals:
  tokens: 2624
  tasks: 2
  commits: 2
plan_head_before: 9d1660915ab1cd887d4d51c4dac90deeaf2bf4d2

tech-stack:
  added: []
  patterns:
    - "A security comment names which argument vector carries each mitigation, and names what rides on neither, because a list of only what is handled reads as coverage"
    - "A source-shaped assertion slices from the call, never from the function declaration, so the prose being checked is outside the slice by construction"
    - "A gate is not trusted until it has been seen failing: the discriminating pin is removed, the red recorded, and the pin restored, in the same task"

key-files:
  created: []
  modified:
    - server/src/repo.ts
    - server/test/guards.test.ts

key-decisions:
  - "Gap 2 is closed by adding the pins rather than by narrowing the sentence — a clone is the path that opens a transport and can be asked for a credential, so the transport and credential knobs belong on its argv, and five -c flags on a call that already carries three cost nothing"
  - "The sentence still changed in the other direction: three of the six knobs it named (filter.*.clean, diff.external, uploadpack.packObjectsHook) are pinned on neither argv after this plan, and the comment says so with the reason, because naming six and pinning five is the same defect one knob narrower"
  - "The comment-and-argv agreement is held by a case rather than by care: argvOf slices from the execFileSync call, so the rationale comment is outside the slice and cannot satisfy the assertion it is being checked against"

patterns-established:
  - "Locate every claimed mitigation: a security comment says which argv or which line carries each pin, so an unlocated claim is visibly the shape that drifted"
  - "State the negative space: the knobs a path does not pin are named as unpinned, so the next maintainer who makes one reachable reads that it is unhandled"

requirements-completed: [FOUND-06]

coverage:
  - id: D1
    description: "The clone argument vector carries all eight -c flags and drops the machine's system config, so both git invocations in repo.ts have one machine-config posture"
    requirement: FOUND-06
    verification:
      - kind: unit
        ref: "server/test/guards.test.ts#pins the clone argv to everything the listing comment says it pins"
        status: pass
      - kind: other
        ref: "argv() { grep -v '^\\s*//' server/src/repo.ts | grep -v '^\\s*\\*' | grep -F execFileSync | grep -cF \"$1\"; } — core.sshCommand=false 0→1, credential.helper= 0→1, core.fsmonitor/hooksPath/pager 1→2 each, GIT_CONFIG_NOSYSTEM 1→2"
        status: pass
    human_judgment: false
  - id: D2
    description: "The gitListFiles rationale names which knobs ride on which argument vector and names the three that ride on neither — check-in content filters, an external diff driver, the pack-objects hook — with the reason each is unreachable on both paths"
    requirement: FOUND-06
    verification:
      - kind: other
        ref: "grep -c 'already pinned where they are reachable' server/src/repo.ts → 0 (was 1); grep -cF 'filter.*.clean' / 'diff.external' / 'uploadpack.packObjectsHook' → 1 each"
        status: pass
      - kind: unit
        ref: "server/test/guards.test.ts#pins the clone argv to everything the listing comment says it pins — the 'pinned on neither' half, asserted at the argv"
        status: pass
    human_judgment: true
    rationale: "The machine can prove the over-claiming clause is gone and that the three named knobs are pinned on neither argv. Whether the rewritten paragraph actually tells the next maintainer what they need — which is the whole purpose of the fix — is read by a person, not asserted by a grep."
  - id: D3
    description: "A case goes red the next time the comment and the argument vector drift apart, and has been seen failing"
    requirement: FOUND-06
    verification:
      - kind: unit
        ref: "pnpm --filter server exec node --import tsx --test test/guards.test.ts — 33 pass, 0 fail (was 32)"
        status: pass
      - kind: other
        ref: "discrimination run: with '-c', 'core.sshCommand=false' removed from the clone argv the suite exits 1 with \"the clone argv is missing core.sshCommand=false\"; restored, it exits 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "A real git clone over https with the new pins still imports a repository normally"
    requirement: FOUND-06
    verification: []
    human_judgment: true
    rationale: "No machine in this environment has DNS or outbound network, and fromGitClone refuses anything that is not https:// before git is spawned, so no clone-argv pin is reachable end to end here. The honest claim is that the absence of a flag is the regression to catch. Fold one repo import by GitHub URL into HC-2's run. .planning/WINDOWS.md entries 3, 6 and 11."

duration: 9 min
completed: 2026-09-20
status: complete
---

# Phase 01 Plan 21: Clone-argv pins and a rationale that is true in both directions Summary

**`fromGitClone`'s git invocation now carries the five pins its own security comment claimed were already there, drops the machine's system config the way the listing path always did, and the `gitListFiles` rationale names which knobs ride on which argument vector and which ride on neither — held together by a case that slices the argv text with the comment excluded and has been seen going red.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-09-20T17:27:21Z
- **Completed:** 2026-09-20T17:36:30Z
- **Tasks:** 2
- **Files modified:** 2

## Test-count baseline

`BASE` was read off the tree `01-20` left, before the first edit, per the plan's `## Test-count baseline`:

| Point | `# pass` | `# fail` | Floor | Met |
|---|---|---|---|---|
| **`BASE`** (tree this plan starts from, `9d16609`) | **208** | 0 | — | — |
| End of Task 1 | 208 | 0 | `BASE` = 208 | yes |
| End of Task 2 | **209** | 0 | `BASE + 1` = 209 | yes |

`# cancelled 0`, `# skipped 0`, `# todo 0` at every point.

## Accomplishments

- **The clone argument vector carries what the comment says it carries.** `fromGitClone`'s `execFileSync('git', …)` gained `-c core.sshCommand=false`, `-c credential.helper=`, `-c core.fsmonitor=false`, `-c core.hooksPath=/dev/null` and `-c core.pager=cat` before the `clone` subcommand, beside the three transport flags it already had, and `GIT_CONFIG_NOSYSTEM: '1'` joined `GIT_TERMINAL_PROMPT: '0'` in its environment. Command-line `-c` is the one layer of git's config precedence a repository's own file cannot outrank, which is why the pins ride on the argv rather than in a check after the spawn.
- **The two git invocations in the file now have one machine-config posture rather than two.** The listing path already dropped the system config and pinned the three spawn knobs; the clone path did neither. It does both now, and the listing argument vector is byte-identical to what it was (verified by hashing the line before and after).
- **The rationale is accurate in both directions.** The clause "they are already pinned where they are reachable, on the clone argv below" is gone. In its place: the transport and credential knobs are named as riding on the clone argv in `fromGitClone`, with the reason (a listing opens no transport and is never asked for a credential); and the three knobs that ride on **neither** argument vector — `filter.*.clean`, `diff.external`, `uploadpack.packObjectsHook` — are named as unpinned, with the reason each is unreachable on both paths, explicitly so that silence cannot read as coverage.
- **A gate that has been seen failing.** `argvOf(source, fnName)` returns the `-c` flag values of one named function's git invocation, sliced from the `execFileSync` call rather than from the function declaration so the rationale comment is outside the slice by construction. One new case asserts the clone's eight flags, the listing's three, that both invocations drop the system config, and that neither pins a check-in content filter, an external diff driver or a pack-objects hook. With one of the five new pins removed the suite exits 1 and names the missing flag; restored, it exits 0.

## Task Commits

1. **Task 1 (tracer): the clone argv carries what the comment says it carries, and the comment says what the argv does not** — `621d358` (fix)
2. **Task 2: a case that goes red the next time the comment and the argv drift apart** — `1a0c868` (test)

**Plan metadata:** see the `docs(01-21)` commit that follows this file.

## Files Created/Modified

- `server/src/repo.ts` — exactly three lines changed: the `gitListFiles` rationale comment, the `fromGitClone` rationale comment (one clause appended, pointing at where the rest of its argv is accounted for), and the clone argument vector. The listing argument vector, the scheme check, `assertPublicHost`, the scratch directory, the timeout, the depth, the quiet flag and the refusal path are untouched.
- `server/test/guards.test.ts` — `callOf`/`argvOf` beside the other module-private helpers, and one case at the end of the `cloning` describe. 34 lines added, none removed.

## Decisions Made

- **Add the pins rather than narrow the sentence.** The plan recorded this decision before execution and execution did not re-open it. A clone is the path on which the transport and credential knobs are genuinely reachable, so pinning them there is where they belong, and five `-c` flags on a call that already carries three cost nothing.
- **And change the sentence anyway, in the other direction.** Three of the six knobs the comment named are not in the decided pin list. A sentence that names six and pins five is the same defect as one that names six and pins one, so the comment now says which knobs ride on which argument vector and names the three that ride on neither, with the reason.
- **`fromGitClone`'s own leading comment got one appended clause, not a rewrite.** Nothing in it went stale — its account of why both checks run before the spawn and why the argv forbids the redirect hop is still exactly right. But it ended by enumerating what the argv does, and the argv now does more, so a reader could have taken the enumeration for a full account. One clause points at where the rest is accounted for. This is the same "silence reads as coverage" shape the plan exists to close, applied to the second comment rather than only the first.
- **`callOf` is a second, tiny helper under `argvOf`.** The plan's artifact table names `argvOf`; the slice logic is shared by the flag assertions and the `GIT_CONFIG_NOSYSTEM` assertion, so extracting it avoids writing the slice twice, which is the shape that drifts.

## Deviations from Plan

None — plan executed exactly as written. Every acceptance criterion was measured, and every "on the tree this task starts from" figure the plan predicted was reproduced exactly before the first edit.

### Acceptance-criteria ledger (Task 1)

Measured with the plan's own argv-scoped helper, `argv() { grep -v '^\s*//' server/src/repo.ts | grep -v '^\s*\*' | grep -F execFileSync | grep -cF "$1"; }`:

| Check | Plan's predicted "before" | Measured before | After | Criterion |
|---|---|---|---|---|
| `argv core.sshCommand=false` | 0 | 0 | 1 | 1 — met |
| `argv credential.helper=` | 0 | 0 | 1 | 1 — met |
| `argv core.fsmonitor=false` | 1 | 1 | 2 | 2 — met |
| `argv core.hooksPath=/dev/null` | 1 | 1 | 2 | 2 — met |
| `argv core.pager=cat` | 1 | 1 | 2 | 2 — met |
| `argv "GIT_CONFIG_NOSYSTEM: '1'"` | 1 | 1 | 2 | 2 — met |
| `argv http.followRedirects=false` | 1 | 1 | 1 | unchanged — met |
| `argv protocol.allow=never` | 1 | 1 | 1 | unchanged — met |
| `argv protocol.https.allow=always` | 1 | 1 | 1 | unchanged — met |
| `argv filter.` | 0 | 0 | 0 | 0 — met |
| `argv diff.external` | 0 | 0 | 0 | 0 — met |
| `argv uploadpack.` | 0 | 0 | 0 | 0 — met |
| `grep -c "timeout: 120_000"` | 1 | 1 | 1 | 1 — met |
| `grep -c "'--depth', '1'"` | 1 | 1 | 1 | 1 — met |
| `grep -c "already pinned where they are reachable"` | 1 | 1 | **0** | 0 — met |
| `grep -cF "filter.*.clean"` | 1 | 1 | 1 | ≥1 — met |
| `grep -c "diff.external"` | 1 | 1 | 1 | ≥1 — met |
| `grep -c "uploadpack.packObjectsHook"` | 1 | 1 | 1 | ≥1 — met |
| `git diff --name-only -- server/src` | — | — | `server/src/repo.ts` only | met |

### Acceptance-criteria ledger (Task 2)

| Check | Before | After | Criterion |
|---|---|---|---|
| `grep -c "execFileSync" server/test/guards.test.ts` | 6 | 8 | ≥7 — met |
| `grep -c "core.sshCommand=false"` | 0 | 1 | ≥1 — met |
| `grep -c "credential.helper="` | 0 | 1 | ≥1 — met |
| `grep -c "GIT_CONFIG_NOSYSTEM"` | 1 | 2 | ≥2 — met |
| `grep -cF "filter.*.clean"` | 0 | 1 | ≥1 — met |
| `grep -c "diff.external"` | 0 | 1 | ≥1 — met |
| `grep -c "uploadpack.packObjectsHook"` | 0 | 1 | ≥1 — met |
| `git diff --name-only -- server/src` at end of task | — | empty | met |

## The discrimination run

Required by Task 2's acceptance criteria and recorded here in full.

- **Flag chosen:** `'-c', 'core.sshCommand=false'`, removed from the clone argument vector in `server/src/repo.ts` — one of the two pins the file did not carry at all before Task 1.
- **With it removed:** `pnpm --filter server exec node --import tsx --test test/guards.test.ts` exited **1**. TAP output: `not ok 5 - cloning`, with the subtest error `the clone argv is missing core.sshCommand=false`.
- **Restored** with `git checkout -- server/src/repo.ts` (Task 1 was already committed, so the restore is exact): the same command exited **0**, `# pass 33`, `# fail 0`, and `git diff --name-only -- server/src` is empty.

A gate that has not been seen failing is not known to be a gate. This one has.

## Verification (plan-level)

| Check | Result |
|---|---|
| `pnpm typecheck` | exit 0, no `error TS` |
| `pnpm build` | exit 0, no `error TS` |
| `pnpm --filter server exec node --import tsx --test test/guards.test.ts` | exit 0, 33 pass, 0 fail |
| `pnpm --filter server exec node --import tsx --test test/security.test.ts` | exit 0, 66 pass, 0 fail |
| `pnpm test` | exit 0, **209 pass, 0 fail**, 0 cancelled, 0 skipped |
| Clone argv carries all eight flags + `GIT_CONFIG_NOSYSTEM=1` alongside `GIT_TERMINAL_PROMPT=0` | yes |
| Listing argv unchanged | byte-identical — the `ls-files` `execFileSync` line hashes the same at `9d16609` and at `HEAD` |
| Rationale names which knobs ride on which argv and names the three that ride on neither, with the reason | yes |
| A case compares both argv flag sets against the claim set with the comment excluded from the slice, seen red and green | yes (above) |
| Only `server/src/repo.ts` and `server/test/guards.test.ts` changed; no `web/` file edited | yes |
| `server/test/wire-surface.json` byte-identical | yes — absent from `git diff --name-only` across the whole plan |
| `server/test/mcp.test.ts` passes | yes — green inside the 209 |

## Issues Encountered

- **The repository's `block-no-verify` pre-commit guard pattern-matches the Bash command text, not the git arguments.** Two commit attempts were rejected — first as "`--no-verify` flag is not allowed", then as "Overriding `core.hooksPath` is not allowed" — because the *commit message* quoted git config flag literals (`-c core.sshCommand=false`, `-c core.hooksPath=/dev/null`) that the guard reads as an attempt to bypass hooks. No bypass was attempted and `--no-verify` was never used. Resolved by passing the message with `git commit -F <file>` and wording it with the flag names spelled out in prose rather than as literals. Both commits ran their hooks normally. Recording it because the next plan that touches git config flags in this file will hit the same thing.

## Known Stubs

None. The diff across both commits contains no `TODO`, `FIXME`, placeholder text, skipped test or unwired data path.

## Broken-windows ledger

- **Entry 11 appended** (`unrun-verify`, `server/test/guards.test.ts`): the five clone-argv pins this plan added are asserted at the source, not driven — `fromGitClone` refuses anything that is not `https://` before git is spawned, and there is no DNS or outbound network here. Fold one repo import by GitHub URL into HC-2's run.
- Entries 3 and 6 are the pre-existing records of the same class and are **extended, not closed**, by this plan.

## Left open on purpose

- **WR-08** — two of the three hostile-repository cases in `server/test/guards.test.ts` assert against a command `git ls-files` never runs. The developer scoped the test-hygiene advisory out of this run; the case added here proves a different thing and touches none of those three. Named rather than quietly absorbed, as the plan's success criteria require.
- **HC-2** (plugin and Codex parity run, FOUND-04's human half) — unchanged by this plan, still outstanding. `.planning/WINDOWS.md` entry 5.
- **HC-1** (real-browser session smoke) — unchanged by this plan; its corrected sequence is in `01-20-PLAN.md` Task 3. `.planning/WINDOWS.md` entries 4 and 10.
- **A real `git clone` over https with the new pins** — not exercisable here; see D4 and ledger entry 11.

## User Setup Required

None — no external service configuration required. This plan adds no dependency, no environment variable in the product's own configuration, no migration, no table and no event type.

## Next Phase Readiness

- **FOUND-06's Gap 2 is closed.** Every mitigation `server/src/repo.ts`'s rationale names as pinned is pinned on the argument vector it names, every knob it does not pin is named as unpinned with the reason, and a case fails the next time the two disagree.
- FOUND-06's other blocker, Gap 1 (the advertised revocation control), was closed by `01-20`. The requirement's remaining open item is the human half already tracked as HC-2, not a machine gap.
- Repo import by URL is unchanged in behaviour: the scheme check and `assertPublicHost` still run before the spawn, the refusal path still leaves no scratch directory, and every added flag is a documented git config key with an inert value. The one thing this environment cannot show is a successful clone with the pins on, which is folded into HC-2.

---
*Phase: 01-foundation*
*Completed: 2026-09-20*

## Self-Check: PASSED

- `server/src/repo.ts` and `server/test/guards.test.ts` exist on disk with the changes described above.
- Both task commits (`621d358`, `1a0c868`) are reachable from `git log --oneline --all`.
- `git rev-list --count 9d16609..HEAD` reports **2**, matching the `commits: 2` recorded in the frontmatter and measured from the plan ledger rather than narrated.
