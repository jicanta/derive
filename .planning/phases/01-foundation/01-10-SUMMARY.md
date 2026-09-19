---
phase: 01-foundation
plan: 10
subsystem: infra
tags: [security, ssrf, git-clone, dns-resolution, import-cycle, node-test]

# Dependency graph
requires:
  - phase: 01-foundation (plan 08)
    provides: assertPublicHost — the resolved-address destination guard, and the repo/import guards it shipped beside
  - phase: 01-foundation (plan 09)
    provides: the authenticated server the route observation in task 2 had to present a credential to
provides:
  - "The last unguarded egress closed: fromGitClone awaits assertPublicHost after the https scheme check and before mkdtempSync"
  - "A model-supplied private git URL comes back to the caller as the guard's own sentence in a 422 { error } body, with no scratch directory made and no process spawned"
  - "guards.test.ts demonstrates what its doc comment states: five cloning cases over a literal loopback address, an RFC-1918 address, the cloud metadata address, IPv6 loopback and a resolving hostname"
  - "The deliberate repo -> library -> materials -> repo import ring, recorded at both ends of itself and in the enumerated Circular imports constraint"
affects: [any future egress added to the server, any edit to library.ts or materials.ts module scope, the codebase map]

actuals:
  tokens: 2807
  tasks: 2
  commits: 2
plan_head_before: ed51c41b703acb2403100e7b3ea58f954907d533

tech-stack:
  added: []
  patterns:
    - "One destination guard, every egress: a new outbound path calls assertPublicHost rather than growing its own check"
    - "A guard runs before the resource it protects exists — the host check precedes mkdtempSync, so a refusal leaves nothing to clean up"
    - "A deliberate import ring is documented at both ends of itself, not only in the plan that created it"

key-files:
  created: []
  modified:
    - server/src/repo.ts
    - server/src/library.ts
    - server/test/guards.test.ts
    - .planning/codebase/ARCHITECTURE.md
    - .claude/CLAUDE.md

key-decisions:
  - "assertPublicHost is imported from library.ts rather than copied into repo.ts, accepting a real import ring: two copies of a destination guard drift apart, and then one egress is weaker than the rest"
  - "The https scheme check stays first, so an ssh, git or git@ URL still fails with its own sentence about the learner's keys rather than with a URL-parse or lookup error"
  - "The host guard runs before mkdtempSync, so a refused clone leaves no clone- scratch directory — which is also what the tests assert to prove the ordering"
  - "The ring is recorded in three places rather than one: repo.ts's new import, library.ts:31 where a module-level use would break it, and the enumerated Circular imports constraint in ARCHITECTURE.md mirrored byte-identically into .claude/CLAUDE.md"

patterns-established:
  - "Import-ring safety condition stated at the line that would break it: the comment lives above library.ts's ./materials.js import, not only in the module that closes the ring"
  - "Cloning cases assert both the rejection and cloneDirs() emptiness, per URL and once at the end, so a leak by one case cannot be masked by the next"

requirements-completed: [FOUND-06]

coverage:
  - id: D1
    description: "fromGitClone runs assertPublicHost before it makes a directory or spawns git, so a git URL naming loopback, link-local, RFC-1918 or CGNAT is refused"
    requirement: FOUND-06
    verification:
      - kind: unit
        ref: "server/test/guards.test.ts#cloning > refuses a git URL pointing at this machine or this network, before a directory is made"
        status: pass
      - kind: manual_procedural
        ref: "DERIVE_DATA_DIR=$(mktemp -d) node --import tsx -e \"collectRepo('https://127.0.0.1/x.git')\" -> rejects '127.0.0.1 is a private or local address…'; ls $DERIVE_DATA_DIR -> derive.db only, 0 clone- entries"
        status: pass
      - kind: other
        ref: "grep -n 'assertPublicHost\\|mkdtempSync' server/src/repo.ts -> guard at 276, mkdtempSync at 277"
        status: pass
    human_judgment: false
  - id: D2
    description: "The guard resolves the host before it judges, so a name that resolves to a private address is refused as well as a literal"
    requirement: FOUND-06
    verification:
      - kind: unit
        ref: "server/test/guards.test.ts#cloning > refuses a name that resolves to this machine, not only a literal"
        status: pass
    human_judgment: false
  - id: D3
    description: "The existing https-only scheme check still runs first and keeps its own sentence"
    requirement: FOUND-06
    verification:
      - kind: unit
        ref: "server/test/guards.test.ts#cloning > refuses anything that is not https, before git is spawned"
        status: pass
      - kind: manual_procedural
        ref: "collectRepo('ssh://git@github.com/jicanta/derive.git') -> 'derive only clones over https (got ssh://…); an ssh or git URL would use your own keys'"
        status: pass
    human_judgment: false
  - id: D4
    description: "The refusal reaches the caller as a 4xx { error } body carrying the guard's sentence, not as a crash or an unhandled rejection"
    requirement: FOUND-06
    verification:
      - kind: integration
        ref: "POST /api/materials/repo {\"source\":\"https://127.0.0.1/x.git\"} against a spawned server/dist/index.js with x-derive-token -> 422 {\"error\":\"127.0.0.1 is a private or local address, and derive only fetches public ones\"}; stdout/stderr carry no unhandled-rejection trace"
        status: pass
    human_judgment: false
  - id: D5
    description: "The new repo -> library -> materials -> repo import ring resolves at runtime and costs nothing elsewhere"
    requirement: FOUND-06
    verification:
      - kind: other
        ref: "DERIVE_DATA_DIR=$(mktemp -d) node --import tsx -e \"import('./src/repo.ts').then(m => console.log(typeof m.collectRepo))\" -> function"
        status: pass
      - kind: integration
        ref: "pnpm build && pnpm test -> 140 tests, 42 suites, # fail 0 (incl. api.test.ts and mcp.test.ts against the built server and the stdio MCP process)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The ring's safety condition is written where someone about to break it will be reading, and the enumerated list of safe rings names four rather than three"
    requirement: FOUND-06
    verification:
      - kind: other
        ref: "grep 'Circular imports' .planning/codebase/ARCHITECTURE.md | grep -c 'repo.ts' -> 1; same for .claude/CLAUDE.md -> 1; diff of the two lines prints nothing"
        status: pass
    human_judgment: true
    rationale: "A grep proves the line exists and that the source and its generated mirror agree byte-for-byte. Whether the three comments actually warn the next editor — whether they are legible at the moment someone moves partsOf/SEP/titleOf to module scope — is a reading, not an assertion. This plan exists partly because a doc comment overstated what its cases proved, so prose claims are reserved for a human reader."
  - id: D7
    description: "guards.test.ts's doc comment states only what its cases exercise"
    verification: []
    human_judgment: true
    rationale: "The defect being repaired was a suite green over a guarantee it did not test. A grep cannot tell whether the rewritten comment is now honest about its cases; only a reader comparing the comment to the describe blocks can."

# Metrics
duration: 4 min
completed: 2026-09-19
status: complete
---

# Phase 01 Plan 10: The clone path runs the same guard Summary

**`fromGitClone` now awaits `assertPublicHost` between the https scheme check and `mkdtempSync`, so a model-supplied `https://127.0.0.1/x.git` comes back as a 422 carrying the guard's own sentence with no scratch directory made and no git spawned — at the cost of a deliberate `repo -> library -> materials -> repo` import ring, recorded at both ends of itself and in the project's enumerated list of safe rings.**

## Performance

- **Duration:** 4 min (execution; excludes plan and context reading)
- **Started:** 2026-09-19T14:20:41Z
- **Completed:** 2026-09-19T14:24:39Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- `grep -c assertPublicHost server/src/repo.ts` went from `0` to `3`. The call sits on line 276, one line above the `mkdtempSync` on 277, so a refused destination never gets a directory and never gets a process. `collectRepo` awaits the now-`async` `fromGitClone`.
- The key link `01-VERIFICATION.md` recorded as `✗ NOT WIRED` — `library.ts assertPublicHost` → `repo.ts fromGitClone` — is wired, and the third gap of Success Criterion 5 is closed: every egress this phase added now runs the same resolved-address guard.
- `https://127.0.0.1/x.git`, `https://192.168.0.5/internal.git`, `https://169.254.169.254/x.git` and `https://[::1]/x.git` are each refused with `private or local address` and each leaves `cloneDirs()` empty, checked per URL and once more at the end of the block. `https://localhost/x.git` is refused the same way, which is the case that proves the guard resolves before it judges rather than matching strings.
- `guards.test.ts`'s doc comment no longer claims more than its cases: it now walks each guard in turn and says what is actually driven. The suite went from 17 to 20 cases; the full suite from 138 to 140, 0 failures.
- The route reports the refusal as the method intends: `POST /api/materials/repo` with a private git URL returns `422 {"error":"127.0.0.1 is a private or local address, and derive only fetches public ones"}` against the built server, with no unhandled-rejection trace on stdout or stderr. No line of `server/src/index.ts` or `server/src/materials.ts` was touched — `collectRepo` was already awaited there.
- The `repo -> library -> materials -> repo` ring is written down three times: at `repo.ts`'s new import (why a second copy of the guard would be worse), at `server/src/library.ts:31` where a module-level use of `partsOf`/`SEP`/`titleOf` would break it, and on the **Circular imports** line of `.planning/codebase/ARCHITECTURE.md` mirrored byte-identically into `.claude/CLAUDE.md`. Both grep gates printed `0` on the tree before this plan and print `1` now.

## Task Commits

1. **Task 1 (tracer): a private git URL is refused at the entry point the model actually uses** — `1b01561` (fix)
2. **Task 2: the whole suite stays green with repo.ts on the new import ring** — `bf90448` (test)

## Files Created/Modified

- `server/src/repo.ts` — `import { assertPublicHost } from './library.js'` with the ring comment above it; `fromGitClone` is `async (url: string): Promise<RepoSource>` and awaits the guard after the scheme check; the pre-existing one-line comment above that check now covers both reasons it precedes the spawn (the learner's keys, and the destination); `collectRepo` returns `await fromGitClone(s)`.
- `server/src/library.ts` — one added `//` line above `import { partsOf, SEP, titleOf } from './materials.js';`. No executable line changed; `git diff` shows a single added comment line.
- `server/test/guards.test.ts` — rewritten module doc comment; two new cases in `describe('cloning')`.
- `.planning/codebase/ARCHITECTURE.md` — the **Circular imports** bullet now enumerates four rings and states the module-evaluation-time condition that keeps the new one safe.
- `.claude/CLAUDE.md` — the same sentence, byte-identical, inside the `GSD:architecture` markers, so the next codebase map regenerates it rather than reverting it.

## Decisions Made

- **Import the guard, do not copy it.** `repo.ts` importing `library.ts` creates a genuine cycle, and the alternative — a second private-address check inside `repo.ts` — is how two destination guards drift apart until one egress is weaker than the rest. The cycle resolves because no module in it reads another's bindings while the modules are evaluating, and that condition is now written at the line where breaking it would be invisible.
- **Scheme check first, host guard second.** Reversing them would turn `git@github.com:jicanta/derive.git` into a URL-parse error instead of the sentence about the learner's own keys, and would make `ssh://…` fail a DNS lookup rather than the policy it actually violates.
- **`cloneDirs()` is asserted per URL, not only once.** A directory left by the first case would otherwise be indistinguishable from one left by the fourth; the per-URL assertion names which URL leaked.
- **The route was observed, not edited.** Plan 01-09 owns `server/src/index.ts`; `ingestRepo` was already awaited inside the route's `try`, so the rejection already lands as `c.json({ error: safeMessage(e) }, 422)`. `safeMessage` only redacts registered secrets, so the guard's sentence survives intact.

## Deviations from Plan

None - plan executed exactly as written.

The plan's Task 2 warned that the scratch server would need a credential after 01-09 changed how the server authenticates; the `x-derive-token` header read from `DERIVE_DATA_DIR/token` was used, exactly as the plan anticipated, so this was a prepared-for condition rather than a deviation.

## Verification Results

| Check | Result |
|---|---|
| `pnpm typecheck` | exit 0, 0 lines containing `error TS` |
| `pnpm --filter server exec node --import tsx --test test/guards.test.ts` | 20 pass, **0 fail**, 0 skipped (was 17) |
| import-cycle smoke (`import('./src/repo.ts')` under a scratch `DERIVE_DATA_DIR`) | last line `function`; no `Cannot access` / `before initialization` |
| `grep 'Circular imports' .planning/codebase/ARCHITECTURE.md \| grep -c 'repo.ts'` | `1` (printed `0` before this plan) |
| `grep 'Circular imports' .claude/CLAUDE.md \| grep -c 'repo.ts'` | `1` (printed `0` before this plan) |
| `diff <(grep 'Circular imports' ARCHITECTURE.md) <(grep 'Circular imports' CLAUDE.md)` | prints nothing — byte-identical |
| `pnpm build` | exit 0; `server/dist/index.js` and `web/dist/index.html` present |
| `pnpm test` | 140 tests, 42 suites, **# fail 0** (phase baseline 121; 138 after 01-09) |
| `pnpm --filter server exec node --import tsx --test test/guards.test.ts test/api.test.ts` | 33 pass, 0 fail, no `not ok` |
| `POST /api/materials/repo` with `https://127.0.0.1/x.git` (built server, valid token) | `422 {"error":"127.0.0.1 is a private or local address, and derive only fetches public ones"}`; 0 `clone-` entries in the data dir; no unhandled-rejection trace |
| `collectRepo('ssh://git@github.com/jicanta/derive.git')` | rejects with `derive only clones over https (…); an ssh or git URL would use your own keys` |
| `git diff -- server/src/library.ts` | one added line, beginning `//`; nothing removed or changed |
| `git diff --quiet -- web/` | exit 0 |

## Known Stubs

None. No placeholder values, no TODO/FIXME markers, no skipped tests, and no case that asserts less than its name claims.

## Accepted Risk (from the plan's threat register)

**T-10-06, medium, disposition `accept`:** a DNS-rebinding window remains between `assertPublicHost`'s lookup and git's own resolution of the same name. This is the same time-of-check-to-time-of-use gap plan 01-08 already recorded for the library fetch, and it is inherent to any userland guard in Node; closing it needs a socket-level lookup `git clone` does not expose. The literal-address cases are unaffected — there is no lookup to race.

**T-10-07, low, disposition `accept`:** the existing 120-second `execFileSync` timeout still bounds a clone that never finishes; unchanged by this plan.

## Issues Encountered

- **Committed on `main`.** The executor's pre-commit guard reports `main` as a protected branch and `git.allow_default_branch_commits` is not set, but `.planning/config.json` has `git.branching_strategy: "none"` and all nine prior plans of this phase committed directly to `main`. The dispatching prompt explicitly instructed continuing on `main` rather than branching, which would split the phase across two refs. No destructive git operation was used. As 01-09 noted: if the guard is meant to bind here, set `git.allow_default_branch_commits: true` to record the decision the config already implies.
- Four files were untracked in the working tree before this plan began (`.gsd/`, `.planning/milestone.lock`, `.planning/phases/01-foundation/01-VERIFICATION.md`, `.planning/state.json`) and one was modified (`.planning/config.json`). None were produced by this plan's tasks, so they were left alone rather than swept into a task commit.

## User Setup Required

None — no external service configuration required. No new dependency, no new environment variable, no migration.

## Next Phase Readiness

- Success Criterion 5's third gap is closed. Every egress the phase added — the library fetch, the redirect loop, the repo tarball and now `git clone` — runs `assertPublicHost` on resolved addresses.
- FOUND-06 is also declared by `01-09-PLAN.md` (done) and `01-12-PLAN.md`, so under the shared-ID gate it stays open until 01-12 finishes; this plan's contribution is complete.
- `01-11` (WR-01, deleting `turns`/`usage` rows) is the remaining gap-closure plan from `01-VERIFICATION.md` and is untouched by this work. It runs the same whole-tree `pnpm build` / `pnpm test` gate, which is why it waited for this plan.
- The import ring is now a documented constraint rather than a latent one. The next contributor tempted to move `partsOf`, `SEP` or `titleOf` to module scope in `library.ts` gets the warning at the line they are editing.

## Self-Check: PASSED

All five modified files exist on disk. Both task commits are present in `git log`: `1b01561`, `bf90448`.

---
*Phase: 01-foundation*
*Completed: 2026-09-19*
