---
status: diagnosed
trigger: "UAT gap G-05-8 (test 8) in .planning/phases/05-learning-experience/05-UAT.md, phase 05-learning-experience of the Derive repo (/home/jicanta/derive)."
created: 2026-11-05T00:00:00Z
updated: 2026-11-05T13:50:00Z
mode: diagnose only (goal: find_root_cause_only), no source edits, no git commit, no real-provider run
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED. `chooseModel()` in scripts/conformance.mjs (lines 424-435) reads `row.model` (the stored install setting) and `row.default_model` (the catalogue default) and skips with 'no model configured' when both are null. For the two login rows both are null by design (providers.ts:74, :88 `defaultModel: null` = "the provider's own default applies"; index.ts:501 `model: getSetting(modelKey(id)) ?? null` over an empty throwaway settings table). The server's own resolver returns `model: null` for these rows and runs on the provider's default (settings.ts:204-205; agent.ts:350 `model: tutor.model ?? undefined`; index.ts boot line prints 'default model'); the harness treats that same null as "unrunnable". Its doc comment ("the one the server's own resolver would use") describes what the code does not do.
bug_class: Bohrbug (deterministic; reproduces on every `--logins` run with no stored model).
known_pattern_candidate: none (no knowledge base exists yet).
candidate_causes:
  - code: harness chooseModel conflates null-means-provider-default with no-model-configured  <-- the defect
  - config: catalogue login rows carry defaultModel null and modelsPath null — correct and deliberate, the harness misreads it
  - environment: throwaway data dir + DERIVE_MODEL stripped (conformance.mjs:640) + no --model flag remove every other way an id could reach row.model — deliberate design, not a defect
  - data: none
and_gate: yes — the skip needs (a) chooseModel's null→skip rule AND (b) no id in row.model. (b) is guaranteed by the harness's own design for login rows, so (a) always fires on them; (a) is the only thing to change.
test: enumerated every path that could give a login row a model; checked git history, CI, committed reports, summaries.
expecting: n/a — diagnosis complete.
next_action: return ROOT CAUSE FOUND (diagnose-only mode); no file under server/, web/, scripts/ touched.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: On a machine with a logged-in Claude Code (or Codex) and `--logins`, the login row is driven through the scripted lesson and reports its four verdicts.
actual: `pnpm conformance --logins --out <scratch>` printed "skipped Claude Code — no model configured", "skipped Codex — no model configured", key rows "no key in the environment", endpoint row "no endpoint configured", local rows "no ... server answered"; "10 providers: 0 passed, 0 failed, 10 skipped."; exit 0; dated .json and .md written. Claude Code is logged in and the app runs lessons on it with model empty ("default model (detected)").
errors: None; exit 0 with an all-skipped report.
reproduction: `pnpm conformance --logins --out /tmp/x` on any machine with a Claude Code login and no API keys.
started: Discovered during UAT 2026-11-05. Harness shipped in phase 04 (plan 04-03); fourth `remediation` verdict added in 05-06 (commit 74059c4).

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: detect reported the login rows as not logged in, so skipReason skipped them
  evidence: skipReason (conformance.mjs:410-422) would have said 'no login found'; the observed reason 'no model configured' is emitted only at line 435 inside chooseModel, which runs only after skipReason returned null (requires opts.logins AND row.status === 'logged in').
  timestamp: 2026-11-05T13:40Z

- hypothesis: setting DERIVE_MODEL (e.g. in .env, which `pnpm conformance` loads via --env-file-if-exists) would let the login rows run
  evidence: conformance.mjs:640 strips DERIVE_BACKEND and DERIVE_MODEL from the child env on purpose; and even if it reached the child, rowView's `model` field (index.ts:501) reads only getSetting(modelKey), never the MODEL env constant, so row.model would still be null.
  timestamp: 2026-11-05T13:40Z

- hypothesis: the models endpoint could supply an id for a login row
  evidence: chooseModel calls it only for row.group === 'local' (line 427); and probe.ts:192-194 throws `${label} has no model list` for claude-code and codex (modelsPath null).
  timestamp: 2026-11-05T13:40Z

- hypothesis: a learner preference (prefs.model[provider]) or a CLI flag could supply the id
  evidence: the child DB is a fresh mkdtemp dir (conformance.mjs:617-619) so no learner has prefs, and rowView does not read prefs anyway; parseArgs (lines 303-315) and --help accept only --out, --think, --timeout, --logins, --help — no --model.
  timestamp: 2026-11-05T13:40Z

- hypothesis: this regressed in 05-06 (commit 74059c4) when the fourth verdict was added
  evidence: `git show d42aa1b:scripts/conformance.mjs` (phase 04-04, 2026-10-22) has a byte-identical chooseModel and skipReason; `git log -S'no model configured'` and `-S'--logins'` both point only at d42aa1b. The login rows have been unrunnable since the day --logins existed.
  timestamp: 2026-11-05T13:45Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-11-05T13:30Z
  checked: scripts/conformance.mjs skipReason() (lines 384-396)
  found: login row passes the skip check only when `opts.logins` is set AND `row.status === 'logged in'`; otherwise 'no login found'. UAT output said 'no model configured', so the login rows DID pass skipReason, i.e. detect reported them logged in.
  implication: the skip is downstream of skipReason, in chooseModel.

- timestamp: 2026-11-05T13:30Z
  checked: scripts/conformance.mjs chooseModel() (lines 398-410)
  found: order is (1) `row.model` -> use it; (2) local group -> POST /api/settings/:id/models and PUT the first id; (3) `row.default_model` -> use it; (4) `{ skip: 'no model configured' }`. Doc comment: "No model id is named here — a harness that carried its own default would report on a model nobody configured." Login rows are not `local`, so only (1) and (3) apply.
  implication: a login row runs only if the detect view hands it `model` or `default_model`.

- timestamp: 2026-11-05T13:30Z
  checked: server/src/providers.ts lines 68-95
  found: both `claude-code` and `codex` declare `defaultModel: null` (the catalogue field docs say "null when the provider's own default applies"). `modelsPath: null` on both, so step (2)'s models endpoint cannot apply to them either.
  implication: step (3) always misses for login rows; only `row.model` is left.

- timestamp: 2026-11-05T13:30Z
  checked: scripts/conformance.mjs main() (lines 596-640)
  found: `dataDir = mkdtempSync(tmpdir()/derive-conformance-)`; `process.env.DERIVE_DATA_DIR = dataDir`; child env is `{ ...process.env minus DERIVE_BACKEND, DERIVE_MODEL, PORT, DERIVE_DATA_DIR: dataDir }`. Rows come from `POST /api/settings/detect` on that child. The temp dir is `rmSync`'d in finally.
  implication: the settings table the child reads is empty on every run; DERIVE_MODEL cannot reach the child; so `row.model` for a login row can only be non-null if the server's rowView derives it from somewhere other than settings/env.

- timestamp: 2026-11-05T13:30Z
  checked: server/src/settings.ts chooseModel() lines 196-206
  found: tiers are MODEL env -> learner prefs.model[provider] (only when learnerId passed) -> getSetting(model:<id>) -> providerOf(id).defaultModel ?? null. For login rows in the harness every tier is empty, so `{ model: null, modelSource: null }`. The app accepts this: the type doc says "null to take the provider's own default".
  implication: the server itself is fine running a login row with model null; the harness is stricter than the server.

- timestamp: 2026-11-05T13:30Z
  checked: .planning/STATE.md line 238, 05-06-PLAN.md assumptions
  found: Phase 04 decision: "The two subscription-login rows are opt-in behind --logins and otherwise reported skipped with that reason: a login spends the owner's own subscription and no CI runner has one." 05-06 assumption: "No provider key or local model is available in this environment, so the fourth verdict cannot be observed passing here." STATE.md line 275: "the instrument exists, the data does not."
  implication: --logins was designed as the route for an owner to run a real row; the planning record admits no real-provider run has happened.

- timestamp: 2026-11-05T13:40Z
  checked: server/src/index.ts rowView (lines 489-525) and the settings routes
  found: `model: getSetting(modelKey(spec.id)) ?? null` (:501) and `default_model: spec.defaultModel` (:498) are the only two fields the harness reads. PUT /api/settings/:provider (:666-736) would accept a `model` on a login row (only `key` is refused for logins, :695), so the one technically open path is the harness writing an id it would have to invent — which its own principle forbids. GET /api/settings/active returns resolveTutor() → model null for a login row.
  implication: no server path hands a login row a model id; the server's answer is "null, run on the provider's default", and the app does exactly that.

- timestamp: 2026-11-05T13:40Z
  checked: server/src/agent.ts:275-350, :150-156; server/src/codex.ts:67; index.ts:1934-1935
  found: runTurn stores `tutor.model` (null) on the turn row and passes `model: tutor.model ?? undefined` to the drivers; the Claude SDK query gets `model: undefined` → SDK default; Codex gets undefined → Codex default. Boot line: `tutor runs on claude code · default model (detected)`.
  implication: a null model is a first-class, working state for both login drivers. The harness is stricter than the product it measures.

- timestamp: 2026-11-05T13:42Z
  checked: server/src/db.ts:302, :306, :1032-1039 (toolRejectionRate)
  found: both prepared statements use `model IS ?`, with a comment saying this is what makes "the row whose model nobody reported findable at all"; the function signature already accepts `model: string | null`.
  implication: a login row run with model null would not break the rejections cell; it reads 0/0 → rate null → '—' (login drivers never pass through the owned loop's validateToolInput anyway).

- timestamp: 2026-11-05T13:45Z
  checked: was a login or any real-provider run ever exercised? git ls-files, ~/.derive, origin/main, gh, phase summaries/verifications
  found: (1) no conformance report is committed (`git ls-files | grep conformance` → only the workflow and the script); (2) ~/.derive has no conformance/ dir (mirror/, server.log, token only); (3) the nightly workflow commit 85a1596 (2026-10-22) is NOT on origin/main — local main is 176 commits ahead, `gh workflow list` shows only CI, Release, Dependabot, and `gh run list --workflow conformance.yml` is a 404 — so the nightly has never been dispatched; (4) 04-VERIFICATION.md:94 "never a replay whose verdicts held", :172 SC4 PRESENT_BEHAVIOR_UNVERIFIED; 05-VERIFICATION.md:171 SC4d UNCERTAIN "no conformance report is committed"; STATE.md:275 "the instrument exists, the data does not"; WINDOWS.md #27 unrun-verify on scripts/conformance.mjs still open; 04-04-SUMMARY.md:223-229 records --logins as a Rule-3 deviation whose stated verification was only "the no-key run reports ten rows, ten skip reasons, exit 0"; (5) 04-UAT.md test 4 (SC4) says `result: pass` with no narrative and no artifact — contradicted by (3), since the workflow could not have been dispatched on GitHub.
  implication: no login row, no keyed row and no nightly run has ever produced a verdict. The harness's replay path has only ever been exercised on its all-skipped branch.

- timestamp: 2026-11-05T13:46Z
  checked: 04-04-PLAN.md:271 and the chooseModel doc comment (conformance.mjs:424)
  found: plan: "The script names no specific model id as a default — the model comes from the configured settings or the detected list". Comment: "the one the server's own resolver would use, else the first id the server itself lists. No model id is named here — a harness that carried its own default would report on a model nobody configured."
  implication: the principle forbids the harness *inventing* an id. Running a login row on the provider's own default — the thing the owner configured by leaving the field empty, and what the resolver actually returns — names no id and does not contradict it. The comment's first clause ("the one the server's own resolver would use") already describes the fix; the code reads the stored setting instead of the resolver's answer.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: scripts/conformance.mjs chooseModel() (lines 424-435) treats a null model as "no model configured" and skips the row, but for the two login rows null is the configured state: providers.ts:74/:88 declare `defaultModel: null` ("the provider's own default applies") and index.ts:501 gives `row.model` only from the install settings table, which the harness's throwaway data dir (conformance.mjs:617-619) guarantees is empty; DERIVE_MODEL is stripped (:640), there is no --model flag, prefs are unreachable, and the models endpoint refuses login rows (probe.ts:192-194). The server's own resolver (settings.ts:204-205) returns `model: null` for exactly these rows and the drivers run on the login's default (agent.ts:350, :155; codex.ts:67), so the harness refuses the one state the app itself runs in. Unchanged since d42aa1b (phase 04-04), the same commit that introduced --logins; never exercised: no committed report, no ~/.derive/conformance, nightly workflow never on origin/main (gh: 404), 04/05 verifications both record no held verdict.
fix: (not applied — diagnose only) see Suggested Fix Direction in the return block.
verification: n/a
files_changed: []
