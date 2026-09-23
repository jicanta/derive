---
phase: quick-260923-bus
plan: 01
subsystem: tooling
tags: [pnpm, corepack, lockfile, ci, gh-10]
requires: []
provides:
  - "package.json pinned to pnpm@12.5.1 with the dead top-level pnpm object removed"
  - "pnpm-workspace.yaml carrying allowBuilds: esbuild: true"
  - "pnpm-lock.yaml with pnpm 12's leading packageManagerDependencies document, so --frozen-lockfile passes in CI"
affects: [ci, contributor-install]
tech-stack:
  added: []
  patterns:
    - "Build-script allowlist lives in pnpm-workspace.yaml allowBuilds (pnpm >= 11), not in package.json"
key-files:
  created: []
  modified:
    - package.json
    - pnpm-workspace.yaml
    - pnpm-lock.yaml
decisions:
  - "Coordinator chose Option A: accept pnpm 12's self-pin lockfile document (packageManagerDependencies pnpm 12.5.1 plus @pnpm/exe.* binaries) because pnpm 12 cannot pass --frozen-lockfile without it and no opt-out setting exists; gate 2 was relaxed for that leading document only and the original lockfile body was re-proven byte-identical"
metrics:
  duration: 12 min
  completed: 2026-09-23
status: complete
actuals:
  tokens: 1700
  tasks: 3
  commits: 1
plan_head_before: 7a70681f143bd38f32ff4ca21fdccc4c7bab4c17
---

# Quick 260923-bus: Update pnpm from 10.33.2 to 12.5.1 (#10) Summary

**One-liner:** pnpm pinned at 12.5.1 via `packageManager`, the esbuild build allowlist moved from the removed `pnpm` package.json field to `allowBuilds` in pnpm-workspace.yaml, and pnpm 12's mandatory self-pin document accepted at the top of the lockfile with the original 5045-line body byte-identical; frozen install, method:check, typecheck, 201 tests and build all pass under 12.5.1.

## Commit

`f041709` — `chore: update pnpm to 12.5.1 (#10)`, three files, `Closes #10` in the body. Nothing under `.gsd/` or `.planning/` staged.

```
 package.json        |   7 +--
 pnpm-lock.yaml      | 158 ++++++++++++++++++++++++++++++++++++++++++++++++++++
 pnpm-workspace.yaml |   3 +
 3 files changed, 162 insertions(+), 6 deletions(-)
```

Verbatim `git diff --stat HEAD~1 -- pnpm-lock.yaml`:

```
 pnpm-lock.yaml | 158 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 1 file changed, 158 insertions(+)
```

## What was done

### Task 1: Pin pnpm 12.5.1 and move the esbuild build allowlist

- `package.json`: `packageManager` changed from `pnpm@10.33.2` to `pnpm@12.5.1` (bare, no `+sha512`); the top-level `pnpm` object (`onlyBuiltDependencies: ["esbuild"]`) deleted. Exact text substitution, no JSON round-trip; `packageManager` is the last key and the file keeps its trailing newline.
- `pnpm-workspace.yaml` is byte-for-byte the five-line content the plan specified: the `packages` list plus `allowBuilds:` / `  esbuild: true`. No `strictDepBuilds`, `dangerouslyAllowAllBuilds` or `minimumReleaseAge`.
- `COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm --version` printed `Downloading the pnpm 12.5.1 binary for linux-x64...` then `12.5.1`. Corepack's signature verification raised no complaint; `COREPACK_INTEGRITY_KEYS` was never touched.
- No `.npmrc` created; `.github/workflows/*`, `README.md`, `scripts/doctor.mjs` are byte-identical (`git diff --quiet` clean).

### Task 2: Let pnpm 12 regenerate the lockfile

`pnpm install` (unfrozen) under 12.5.1 exited 0 and printed `Lockfile is up to date, resolution step is skipped`, preceded by pnpm 12's new informational line `Lockfile passes supply-chain policies (564 entries in 5s)`. No resolution ran, no placeholder was appended to `pnpm-workspace.yaml`, and both esbuild postinstalls ran (`esbuild@0.25.12 ... postinstall: Done`, `esbuild@0.28.2 ... postinstall: Done`), proving the `allowBuilds` move works.

pnpm 12 did rewrite the lockfile, and the plan's original gate 2 (no `version:`/`resolution:`/`integrity:`/package-key line may change) and gate 3 (<= 40 changed lines) fired. The change is a second YAML document prepended to the file (lines 1-158, `---` delimited) that pins pnpm itself:

- importer `.` with `packageManagerDependencies: pnpm: specifier 12.5.1 / version 12.5.1`
- packages `pnpm@12.5.1` and fourteen `@pnpm/exe.<platform>@12.5.1` platform binaries, each with `resolution: {integrity: sha512-...}`, `cpu`, `os` (and `libc` on linux)
- matching `snapshots` entries, all `optional: true`

I restored the lockfile, did not commit, and raised a decision checkpoint. Three experiments informed it:

1. With the lockfile at HEAD, `pnpm install --frozen-lockfile` under 12.5.1 exits 1: `ERR_PNPM_FROZEN_LOCKFILE_WITH_OUTDATED_LOCKFILE: Cannot update packageManagerDependencies with "frozen-lockfile" because the lockfile is not up to date`. That is the command `ci.yml` runs.
2. The opt-out does not exist in pnpm 12: `managePackageManagerVersions: false` in `pnpm-workspace.yaml` fails with `ERR_PNPM_UNRECOGNIZED_WORKSPACE_SETTINGS ... "managePackageManagerVersions" (did you mean "initPackageManager"?)`. Probe reverted.
3. The document reappears on every pnpm invocation (`pnpm test`, `pnpm build`), so contributors on pnpm 12 would see the diff until it is committed.

**Decision (coordinator, Option A):** accept the self-pin document. Gate 2 relaxed to ignore a leading document whose only importer entry is `packageManagerDependencies: pnpm 12.5.1` and whose only packages are `pnpm@12.5.1` and `@pnpm/exe.*@12.5.1`; gate 3's 40-line bound lifted for that document alone; everything after it must be byte-identical to HEAD.

Relaxed gate, re-checked after `pnpm install` regenerated the document:

- `git diff pnpm-lock.yaml | grep '^-' | grep -v '^---'` is empty (zero deletions).
- The only hunk header is `@@ -0,0 +1,158 @@` (pure prepend).
- `diff <(tail -n +159 pnpm-lock.yaml) <(git show HEAD:pnpm-lock.yaml)` is empty: lines 159 to the end are the original file, starting with `lockfileVersion: '9.0'` (gate 1 intact).
- The top-level keys in lines 1-158 are exactly `.:` (with `packageManagerDependencies: pnpm:`), `pnpm@12.5.1` and the fourteen `'@pnpm/exe.*@12.5.1'` entries; no project dependency appears.

### Task 3: Acceptance run under pnpm 12.5.1 and the single commit

- `pnpm --version` -> `12.5.1`.
- `pnpm install --frozen-lockfile` -> exit 0. Full log: `Scope: all 3 workspace projects` / `Lockfile passes supply-chain policies (verified 6m ago)` / `Lockfile is up to date, resolution step is skipped` / `Done in 64ms using pnpm v12.5.1`. `grep -E 'WARN|ERR_PNPM|Ignored build|unreviewed|approve-builds|not recognized'` matched nothing.
- Stability: `pnpm test` after the frozen install left `pnpm-lock.yaml` at the same md5 (`7f58da6d96e88d7aece921f31ab9df0e`), so the document is stable once committed.
- `pnpm method:check` -> `method: 6 rendered copies match method/`; `pnpm typecheck` -> server and web `Done`; `pnpm test` -> `# tests 201 / # pass 201 / # fail 0` (run twice, before and after the decision); `pnpm build` -> web `✓ built in 13.19s`, server `tsc` clean. Same sequence `ci.yml` runs.
- `git status --short` before staging listed only `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, the orchestrator's `.gsd/dispatch-isolation-sentinel.json` and `.planning/quick/`. Staged the three manifests individually; the sentinel and `.planning/` untouched.
- Post-commit deletion check: no tracked files deleted. Working tree after commit: only the sentinel and `.planning/quick/` remain.

## Deviations from Plan

**1. [Rule 4 - Architectural/policy decision] pnpm 12 self-pin document accepted into pnpm-lock.yaml**
- **Found during:** Task 2
- **Issue:** The plan assumed pnpm 12 would leave the lockfile alone or touch a few `settings:` lines. Instead pnpm 12 mandatorily prepends a 158-line `packageManagerDependencies` document, which trips the plan's literal gate 2 and gate 3, and without which `--frozen-lockfile` (CI's command) fails.
- **Fix:** Stopped, restored the lockfile, raised a decision checkpoint with both options. Coordinator chose to accept the document with gate 2 relaxed for that document only; the original body was re-proven byte-identical before committing.
- **Files modified:** pnpm-lock.yaml
- **Commit:** f041709

No other deviations. The `managePackageManagerVersions` probe was reverted in place and never committed.

## Known Stubs

None.

## Threat Flags

None new. Corepack signature verification stayed on and accepted 12.5.1 (T-Q10-02). The allowlist is one entry (`esbuild: true`) with `strictDepBuilds` at its strict default (T-Q10-01). No project package was added or re-resolved; the frozen install replays the committed lockfile (T-Q10-03, T-Q10-SC). The accepted lockfile lines add integrity pins for pnpm's own binaries, which tightens rather than loosens supply-chain posture.

## Notes for the next reader

- `node_modules/` on this machine was installed by pnpm 12.5.1 (`reused 0, downloaded 456`; pnpm 12 uses a different store layout from pnpm 10).
- Corepack now caches 12.5.1 and `pnpm` follows whatever `packageManager` says.
- pnpm 12 prints `Lockfile passes supply-chain policies` on every install; it is informational, not a warning.
- STATE.md and ROADMAP.md were not modified, per the orchestrator's constraints for this quick task.

## Self-Check: PASSED

- `package.json` at HEAD has `packageManager: pnpm@12.5.1` and no `pnpm` key: confirmed via `node -e`.
- `pnpm-workspace.yaml` at HEAD equals the plan's five-line content: confirmed via `diff`.
- `pnpm-lock.yaml` lines 159..end equal `HEAD~1:pnpm-lock.yaml`: confirmed via `diff`.
- Commit `f041709` exists with subject `chore: update pnpm to 12.5.1 (#10)`, touching exactly `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`.
- `git rev-list --count 7a70681..HEAD` = 1, matching `commits: 1`.
