---
phase: quick-260923-bus
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - pnpm-workspace.yaml
  - pnpm-lock.yaml
autonomous: true
requirements: [GH-10]

estimate:
  tokens: 25000
  raw_tokens: 25000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "From the repo root, `pnpm --version` prints 12.5.1 through the corepack shim with no manual pnpm install (GH-10 change 1)"
    - "`pnpm install --frozen-lockfile` under pnpm 12.5.1 exits 0 with no unrecognized-workspace-settings error and no ignored or unreviewed build-script notice, and esbuild's postinstall is still allowed to run (GH-10 change 2)"
    - "No dependency version, resolution or integrity line in pnpm-lock.yaml changed; lockfileVersion is still '9.0' (GH-10 change 3)"
    - "`pnpm method:check && pnpm typecheck && pnpm test && pnpm build` pass under pnpm 12.5.1"
    - ".github/workflows/ci.yml, release.yml, README.md and scripts/doctor.mjs are byte-identical to before (pnpm/action-setup@v6 reads packageManager; no doc names a pnpm version)"
  artifacts:
    - "package.json: packageManager is pnpm@12.5.1 and the top-level pnpm object is gone"
    - "pnpm-workspace.yaml: the packages list plus allowBuilds with esbuild: true, and nothing else"
    - "pnpm-lock.yaml: lockfileVersion '9.0', same dependency set, rewritten by pnpm 12 only if it chose to"
  key_links:
    - "packageManager -> corepack fetches pnpm 12.5.1 -> pnpm reads pnpm-workspace.yaml allowBuilds -> esbuild postinstall runs -> vite (esbuild@0.25.12) and tsx (esbuild@0.28.2) work -> build and test pass"
    - "The old package.json pnpm block is not read by pnpm >= 11, so leaving it would be dead config; the workspace yaml is the only place pnpm 12 looks"
---

<objective>
Fix GitHub issue #10 (jicanta/derive): move the repo from pnpm 10.33.2 to pnpm 12.5.1. Three changes, exactly as the issue asks: bump `packageManager`, move the esbuild build-script allowlist from the `pnpm` field of package.json to `allowBuilds` in pnpm-workspace.yaml (pnpm >= 11 removed `onlyBuiltDependencies` and stopped reading the `pnpm` field), and let pnpm 12 regenerate the lockfile while proving no dependency version moved.

Purpose: contributors and CI on current pnpm should install this repo without a settings error or an ignored-build surprise; the migration must not smuggle in a dependency upgrade.
Output: one code commit `chore: update pnpm to 12.5.1 (#10)` touching package.json, pnpm-workspace.yaml and (if pnpm 12 rewrote it) pnpm-lock.yaml.

Land this as ONE commit. Do not commit after Task 1 or Task 2; Task 3 runs the acceptance chain and makes the single commit. Planning docs are committed by the orchestrator, not here.
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@/home/jicanta/derive/package.json
@/home/jicanta/derive/pnpm-workspace.yaml
@/home/jicanta/derive/.github/workflows/ci.yml

Facts observed at planning time (2026-09-23) that scope this plan:
- Root package.json: `"packageManager": "pnpm@10.33.2"` and a top-level `"pnpm": { "onlyBuiltDependencies": ["esbuild"] }` object. pnpm-workspace.yaml is exactly `packages:` / `  - server` / `  - web`. No `.npmrc` at the root, in server/ or in web/.
- Local pnpm is the corepack shim: pnpm 10.33.2, corepack 0.34.6, Node v22.22.2. Bumping `packageManager` makes corepack download and run 12.5.1 on the next `pnpm` invocation (npm dist-tag `latest` is 12.5.1).
- pnpm-lock.yaml: `lockfileVersion: '9.0'`, 5045 lines, `settings:` has `autoInstallPeers: true` and `excludeLinksFromLockfile: false`, no build-allowlist key anywhere in the file. Under pnpm 10.33.2, `pnpm install --frozen-lockfile` printed "Lockfile is up to date, resolution step is skipped" and no warning of any kind.
- A scan of every package.json in node_modules/.pnpm found exactly two packages with preinstall/install/postinstall scripts: esbuild@0.25.12 (vite's) and esbuild@0.28.2 (tsx's), both `postinstall: node install.js`. Nothing else in the tree has a build script, so the allowlist needs one entry and no `false` entries.
- pnpm 12 docs (pnpm.io/settings/build): `allowBuilds` is a map of package matcher -> boolean declared in pnpm-workspace.yaml; a bare name matches every version; unlisted packages with build scripts are treated as unreviewed and, with `strictDepBuilds` at its default of true, fail the install. `onlyBuiltDependencies`, `neverBuiltDependencies`, `ignoredBuiltDependencies` were removed in v11. pnpm 12 also rejects unknown keys in pnpm-workspace.yaml with an unrecognized-workspace-settings error.
- CI (`.github/workflows/ci.yml`, `release.yml`) uses `pnpm/action-setup@v6` with no `version:` input, so it reads `packageManager`; no CI edit is needed. release.yml already ships pnpm-workspace.yaml in the tarball. README.md and scripts/doctor.mjs mention pnpm and `corepack enable` but no version.
- Working tree at planning time: `.gsd/dispatch-isolation-sentinel.json` is modified. That file belongs to the orchestrator's planning state. Never stage it.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Pin pnpm 12.5.1 and move the esbuild build allowlist to pnpm-workspace.yaml</name>
  <files>package.json, pnpm-workspace.yaml</files>
  <precondition>Network access to registry.npmjs.org so corepack can fetch pnpm 12.5.1 (check: `curl -sI https://registry.npmjs.org/pnpm/12.5.1 | head -1` returns HTTP 200).</precondition>
  <action>
In the root /home/jicanta/derive/package.json make two targeted edits and nothing else. Change the `packageManager` value from `pnpm@10.33.2` to `pnpm@12.5.1` (plain, no `+sha512` suffix; the issue asks for the bare version and pnpm/action-setup@v6 reads it as-is). Delete the entire top-level `pnpm` object that follows it, including its trailing comma handling so the file stays valid JSON with `packageManager` as the last key. pnpm >= 11 does not read that field, so leaving it would be dead configuration that misleads the next reader into thinking esbuild is still allowlisted there. Edit the text in place (Edit tool or sed on the exact lines); do not round-trip through JSON.parse/JSON.stringify, which would reorder or reflow the file. Preserve 2-space indentation and the trailing newline.

Rewrite /home/jicanta/derive/pnpm-workspace.yaml to exactly this content (a blank line between the two maps, 2-space indent, trailing newline):

packages:
  - server
  - web

allowBuilds:
  esbuild: true

Why this shape: `allowBuilds` is the pnpm >= 11 replacement for the removed build allowlist settings, a map of package matcher to boolean. The bare matcher `esbuild` covers both esbuild versions in the lockfile (0.25.12 under vite, 0.28.2 under tsx), which both run `node install.js` on postinstall. The planning-time scan found those are the only two packages in the tree with install lifecycle scripts, so no `: false` entries are needed and the strict default has nothing left to reject. Do not add `strictDepBuilds`, `dangerouslyAllowAllBuilds`, `minimumReleaseAge` or any other key: this repo never set them, pnpm 12 fails on unknown keys, and the allowlist should stay as narrow as it was.

Do not create an `.npmrc`. Do not touch .github/workflows/*, README.md or scripts/doctor.mjs; none of them names a pnpm version and the CI action reads `packageManager`.

Then trigger the corepack fetch once: run `COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm --version` from the repo root. Corepack downloads pnpm 12.5.1 from the registry and verifies its signature. If corepack refuses for a signature or integrity reason, STOP and report the exact message; do not disable corepack's integrity keys to get past it. Do not commit at the end of this task.
  </action>
  <verify>
    <automated>cd /home/jicanta/derive && node -e 'const p=require("./package.json"); if (p.packageManager!=="pnpm@12.5.1") throw new Error("packageManager is "+p.packageManager); if ("pnpm" in p) throw new Error("top-level pnpm object still present"); console.log("package.json ok")' && printf 'packages:\n  - server\n  - web\n\nallowBuilds:\n  esbuild: true\n' | diff - pnpm-workspace.yaml && echo "workspace yaml ok" && COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm --version | grep -xF '12.5.1' && git diff --quiet -- .github README.md scripts/doctor.mjs && echo "ci and docs untouched"</automated>
  </verify>
  <done>package.json declares pnpm@12.5.1 with no top-level pnpm object; pnpm-workspace.yaml is byte-for-byte the five-line content above; `pnpm --version` from the repo root prints 12.5.1 via corepack; .github/, README.md and scripts/doctor.mjs are unchanged. Nothing committed yet.</done>
</task>

<task type="auto">
  <name>Task 2: Let pnpm 12 regenerate the lockfile and prove no dependency version moved</name>
  <files>pnpm-lock.yaml (only if pnpm 12 rewrites it; an unchanged file is an acceptable outcome)</files>
  <action>
From /home/jicanta/derive run `pnpm install` WITHOUT `--frozen-lockfile`, so pnpm 12.5.1 is allowed to rewrite the lockfile header with its own settings if it wants to. Save the output to a log in the scratchpad directory and read it. Expected: the same "Lockfile is up to date, resolution step is skipped" line pnpm 10 printed at planning time, because every manifest specifier is already satisfied by the lockfile and pnpm 12 does not re-resolve a satisfied lockfile. pnpm 11's new default `minimumReleaseAge` only applies during fresh resolution and must therefore not appear in the output. If the log shows a resolution step running, packages being fetched at new versions, or pnpm editing pnpm-workspace.yaml to add build placeholders, treat that as a signal to inspect before going further.

Then run the lockfile gates, in this order, and put the `git diff --stat pnpm-lock.yaml` line verbatim in the SUMMARY:

1. lockfileVersion must still be `'9.0'` (the issue states the format does not change).
2. Hard gate, no dependency moved: collect every added or removed line of `git diff -U0 pnpm-lock.yaml` (excluding the `+++`/`---` file headers). None of them may contain `version:`, `resolution:`, `integrity:`, `specifier:` or `tarball:`, and none may be a package key (a line of the form two spaces, optional quote, `name@digit`). If any does, STOP: run `git checkout -- pnpm-lock.yaml`, do not commit, and report the offending lines. A dependency upgrade is out of scope for #10 and must be a deliberate separate change.
3. Size bound: if `git diff --numstat pnpm-lock.yaml` shows more than 40 changed lines in total, STOP and report the diff for the user to judge instead of committing. Forty is a judgement bound, not a measured baseline: the only legitimate changes are a handful of `settings:` header lines and package metadata lines, and a bigger rewrite deserves a human look even if gate 2 passed.
4. An empty diff (pnpm 12 kept the file byte-identical) passes every gate; note in the SUMMARY that the issue's "regenerate lockfile" step was a no-op on this tree.

Also confirm `git diff pnpm-workspace.yaml` still shows only the two-map content from Task 1 (pnpm 12 auto-appends placeholder entries when it finds unlisted build scripts; with esbuild the only scripted package there should be none). Do not commit at the end of this task.
  </action>
  <verify>
    <automated>cd /home/jicanta/derive &&
grep -qxF "lockfileVersion: '9.0'" pnpm-lock.yaml &&
DIFF="$(git diff -U0 pnpm-lock.yaml)" &&
CHANGED="$(printf '%s\n' "$DIFF" | grep -E '^[+-]' | grep -vE '^(\+\+\+|---) ' || true)" &&
test -z "$(printf '%s\n' "$CHANGED" | grep -E "(version|resolution|integrity|specifier|tarball):|^[+-]  '?[@A-Za-z0-9._/-]+@[0-9]")" &&
NUMSTAT="$(git diff --numstat pnpm-lock.yaml)" &&
NUM="$(printf '%s\n' "$NUMSTAT" | awk 'NF {print $1+$2}')" &&
test "${NUM:-0}" -le 40 &&
printf 'packages:\n  - server\n  - web\n\nallowBuilds:\n  esbuild: true\n' | diff - pnpm-workspace.yaml &&
STAT="$(git diff --stat pnpm-lock.yaml)" &&
echo "${STAT:-pnpm-lock.yaml unchanged}" &&
echo "lockfile gates ok (changed lines: ${NUM:-0})"</automated>
  </verify>
  <done>`pnpm install` under 12.5.1 completed; lockfileVersion is '9.0'; zero changed lockfile lines carry a version, resolution, integrity, specifier, tarball or package key; total changed lockfile lines <= 40 (or the diff is empty); pnpm-workspace.yaml is still exactly the Task 1 content. The `--stat` line is recorded for the SUMMARY. Nothing committed yet.</done>
</task>

<task type="auto">
  <name>Task 3: Acceptance run under pnpm 12.5.1 and the single commit</name>
  <files>package.json, pnpm-workspace.yaml, pnpm-lock.yaml</files>
  <action>
From /home/jicanta/derive run the acceptance chain the issue and CI care about, in this order, each from the repo root:

1. `COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm --version` prints 12.5.1.
2. `pnpm install --frozen-lockfile`, output saved to a log file in the scratchpad directory. It must exit 0 and the log must be free of any pnpm warning line, any pnpm error code, any unrecognized-workspace-settings error, and any notice about build scripts being skipped or awaiting review. Read the log yourself as well as running the grep; the point is that a contributor on pnpm 12 sees a clean install.
3. `pnpm method:check && pnpm typecheck && pnpm test && pnpm build`. These are the exact commands ci.yml runs. `pnpm test` runs the server node:test suite (api.test.ts starts a scratch server on a free port and uses a scratch DERIVE_DATA_DIR; it needs no login). `pnpm build` exercises esbuild through vite and tsc through the server build, which is the proof that the allowlist move kept esbuild's postinstall working.

Then check `git status --short`. It must list only package.json, pnpm-workspace.yaml, possibly pnpm-lock.yaml, and the pre-existing `.gsd/dispatch-isolation-sentinel.json`. That last file is the orchestrator's planning state: do not stage it, do not revert it. If anything else shows up (for example pnpm rewrote pnpm-workspace.yaml or created a file), stop and report before committing.

Make ONE commit with exactly these paths staged: `git add package.json pnpm-workspace.yaml pnpm-lock.yaml` (git add of an unchanged pnpm-lock.yaml is a harmless no-op). Subject line: `chore: update pnpm to 12.5.1 (#10)`. Body, in plain sentences: pnpm >= 11 removed the build allowlist settings and stopped reading the pnpm field of package.json, so the esbuild allowlist moves to allowBuilds in pnpm-workspace.yaml; the lockfile was regenerated by pnpm 12 with no dependency version change (or was unchanged, whichever Task 2 found); CI needs no edit because pnpm/action-setup@v6 reads packageManager. End the body with `Closes #10`.
  </action>
  <verify>
    <automated>cd /home/jicanta/derive &&
COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm --version | grep -xF '12.5.1' &&
LOG=/tmp/claude-1000/-home-jicanta-derive/a8cb5de1-2d9b-4cf7-9811-f7b6df0495a1/scratchpad/pnpm-install-frozen.log &&
pnpm install --frozen-lockfile > "$LOG" 2>&1 &&
! grep -E 'WARN|ERR_PNPM|Ignored build|unreviewed|approve-builds' "$LOG" &&
pnpm method:check && pnpm typecheck && pnpm test && pnpm build &&
SUBJ="$(git log -1 --format=%s)" &&
test "$SUBJ" = 'chore: update pnpm to 12.5.1 (#10)' &&
SHOWN="$(git show --stat --format= HEAD)" &&
printf '%s\n' "$SHOWN" | grep -qF 'package.json' &&
printf '%s\n' "$SHOWN" | grep -qF 'pnpm-workspace.yaml' &&
! printf '%s\n' "$SHOWN" | grep -qF '.gsd/' &&
STATUS="$(git status --short)" &&
test -z "$(printf '%s\n' "$STATUS" | grep -vF '.gsd/dispatch-isolation-sentinel.json' | grep .)" &&
echo "acceptance ok: $SUBJ"</automated>
  </verify>
  <done>`pnpm --version` is 12.5.1; frozen install under 12.5.1 exits 0 with a log free of warnings, pnpm error codes and build-script notices; method:check, typecheck, test and build all pass; HEAD is the single commit `chore: update pnpm to 12.5.1 (#10)` containing package.json and pnpm-workspace.yaml (plus pnpm-lock.yaml if it changed) and nothing under .gsd/; the working tree has no changes other than the orchestrator's sentinel file.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| registry.npmjs.org -> corepack | corepack downloads the pnpm 12.5.1 tarball named by `packageManager` |
| lockfile -> node_modules | `pnpm install` materialises third-party code and may run its install scripts |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-Q10-01 | Tampering | pnpm-workspace.yaml allowBuilds | medium | mitigate | Allowlist stays exactly one entry (`esbuild: true`), the same scope as before; `dangerouslyAllowAllBuilds` is never set and `strictDepBuilds` keeps its strict default, so any future dependency that grows a build script fails the install instead of running silently (Task 1). |
| T-Q10-02 | Tampering | corepack download of pnpm 12.5.1 | medium | mitigate | corepack signature verification stays enabled; Task 1 stops on any signature or integrity refusal rather than disabling `COREPACK_INTEGRITY_KEYS`. 12.5.1 is the registry's `latest` dist-tag as verified by the orchestrator. |
| T-Q10-03 | Tampering | pnpm-lock.yaml regeneration | high | mitigate | Task 2's hard gate rejects any changed line carrying a version, resolution, integrity, specifier, tarball or package key, and the executor reverts and reports instead of committing a surprise upgrade. Task 3 re-installs with `--frozen-lockfile`. |
| T-Q10-SC | Tampering | npm/pip/cargo installs | low | accept | No package is added, removed or re-resolved by this plan; the install is a frozen replay of the committed lockfile, so the package legitimacy gate has nothing new to review. |
</threat_model>

<verification>
- `pnpm --version` from the repo root prints 12.5.1 with no manual install step.
- `pnpm install --frozen-lockfile` under 12.5.1 exits 0 with a clean log.
- `pnpm method:check && pnpm typecheck && pnpm test && pnpm build` pass, matching the ci.yml sequence.
- pnpm-lock.yaml keeps lockfileVersion '9.0' and no dependency version line changed.
- .github/workflows, README.md and scripts/doctor.mjs are untouched.
- Exactly one code commit, `chore: update pnpm to 12.5.1 (#10)`, containing only the three manifest/lock files.
</verification>

<success_criteria>
GitHub issue #10 is resolved as requested: packageManager is pnpm@12.5.1, the esbuild build allowlist lives in pnpm-workspace.yaml `allowBuilds`, the dead `pnpm` field is gone from package.json, and the lockfile was regenerated (or proven unchanged) by pnpm 12 with zero dependency version drift. A contributor running `corepack enable && pnpm install --frozen-lockfile` on this commit gets a clean install, and CI passes unchanged.
</success_criteria>

<output>
Create `/home/jicanta/derive/.planning/quick/260923-bus-fix-github-issue-10-update-pnpm-from-10-/260923-bus-SUMMARY.md` when done. Record the verbatim `git diff --stat pnpm-lock.yaml` line, whether the lockfile changed at all, the commit hash, and the exact pnpm version corepack reported.
</output>
