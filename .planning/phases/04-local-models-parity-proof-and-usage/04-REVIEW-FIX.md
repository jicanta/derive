---
phase: 04-local-models-parity-proof-and-usage
fixed_at: 2026-10-22T00:00:00Z
review_path: .planning/phases/04-local-models-parity-proof-and-usage/04-REVIEW.md
iteration: 1
findings_in_scope: 11
fixed: 11
skipped: 0
status: all_fixed
---

# Phase 4: Code Review Fix Report

**Fixed at:** 2026-10-22
**Source review:** `.planning/phases/04-local-models-parity-proof-and-usage/04-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 11 (CR-01..CR-03, WR-01..WR-08; `fix_scope: critical_warning`, so the nine Info findings were not attempted)
- Fixed: 11
- Skipped: 0

**Gate:** `pnpm method:check && pnpm typecheck && pnpm build && pnpm test` is green in the **main checkout** (`/home/jicanta/derive`) after the fast-forward: 500 tests, 116 suites, 0 fail, 0 cancelled, 0 skipped. The suite grew from 494 to 500: six new cases, no assertion removed, no assertion weakened.

**Where verification ran.** Fixes were made and committed in an isolated worktree, but the worktree had the project's `node_modules` linked in so every gate ran there too, per fix. The numbers above are the re-run in the main checkout after the branch fast-forwarded, so they are reproducible from the tree a reader is looking at.

**Seen-failing discipline.** Four of the new cases were run against the pre-fix source to confirm they catch the defect they describe: CR-03's leak case, WR-03's rescan case, WR-05's activation case and WR-07's deadline case each failed with the fix reverted and pass with it in place. The other two (WR-02's bound, WR-04's sentences) assert exact strings that did not exist before the fix.

## Fixed Issues

### CR-01: Switching learner on the Usage page shows the previous learner's spend and lessons

**Files modified:** `web/src/pages/Usage.tsx`
**Commit:** `66ba6ad`
**Applied fix:** `<LearnerMenu onChange={() => void load()} />`, the shape `You.tsx:109` and `Library.tsx:91` already use. `setView(null)` was not added: the render's `loading ? … : err ? … : view …` ternary already takes the loading arm for the whole refetch, so no stale figure is on screen during it.

### CR-02: The `num_ctx` field is writable and "saved" on LM Studio and llama.cpp, where nothing reads it

**Files modified:** `server/src/index.ts`, `server/src/migrations.ts`, `web/src/components/ProviderRow.tsx`, `server/test/api.test.ts`, `server/test/migrations.test.ts`
**Commit:** `d3de3a9`
**Applied fix:** the field now exists exactly where Derive sends a window.

- `rowView`: `num_ctx_default: spec.id === 'ollama' ? NUM_CTX_DEFAULT : null`. `ProviderRow` needed no component change — it already keys off `num_ctx_default !== null`.
- The `PUT /api/settings/:provider` guard widened from `spec.group !== 'local'` to `spec.id !== 'ollama'`. **The sentence is unchanged** (`{label} does not take a context window; it serves whatever the endpoint is configured for`), which reads true of the two rows it now also reaches — no new copy, so no Copywriting Contract change.
- **Migration 10** (`drop-read-only-num-ctx`) deletes `num_ctx:lmstudio` and `num_ctx:llamacpp`, so no learner is left holding a value they believe is active. The keys are literals rather than `numCtxKey(…)` calls, per the file's own rule that a migration records what was in the file at that version.
- `ProviderRow`'s doc comment no longer rationalises the field on the read-only rows ("the learner may raise it") — it says why those rows carry none.
- Tests that pinned the defect were **updated to assert the fixed behaviour**: `api.test.ts`'s "shows the default on every local row" now asserts `num_ctx_default` is 32768 on Ollama and null everywhere else (and still asserts all three local rows teach); the non-local refusal case now also asserts both read-only rows are refused by name and store nothing. `migrations.test.ts`'s `LATEST_VERSION` pin moved to 10 and travelled with the newest migration, as its own comment requires.

**Not applied, deliberately:** the review's closing suggestion that the read-only rows "keep showing the *observed* served window as read-only text". That is a new learner-facing surface and a new string, which the simplicity rule and the locked Copywriting Contract both put with the owner rather than here. It is additive and does not block the fix.

### CR-03: Scratch lessons are hidden from two queries, not from the learner's record

**Files modified:** `server/src/db.ts`, `server/test/api.test.ts`
**Commit:** `1351f98`
**Applied fix:** `scratch = 0` added at the join in all five reads the review names — `listMemory`, `listMisconceptions`, `allNodes`, `dueNodes`, and all four of `stats`'s subqueries. The comment above `listLessons` no longer overclaims: it names every statement the rule covers, and says why the filter belongs at the join rather than in a caller (`learnerProfile` reads three of them and filters only the current lesson; `sweepScratchLessons` runs on the boot pass alone).

The coverage the review called out as insufficient was extended rather than replaced. `counts()` now also reads `stats('default')`, `allNodes`, `listMemory` and `listMisconceptions`, so the two existing "the proof left something behind" assertions got stricter for free. The `sweepScratchLessons` case now builds the full fixture the probe writes (a locked node with a review date, a graded quiz, a remembered fact, a misconception) and asserts every one of those reads is unchanged **while the scratch lesson is deliberately alive**, plus `dueNodes` against a far-future clock. Verified failing without the `db.ts` change.

One figure does move while a crashed proof is alive and is asserted as moving: the ledger row. `usage` is keyed on the learner with no `lessons` join, so a crashed proof's row is removed by the sweep rather than filtered out of the read — which is the remedy migration 8's own comment names. That is stated in the case rather than papered over.

### WR-01: A single non-deterministic generation is remembered as a definitive "cannot call tools"

**Files modified:** `server/src/capability.ts`
**Commit:** `b0ccf49`
**Applied fix:** the review's first option. `roundTrip` split into `oneRoundTrip` (one attempt, unchanged) and `roundTrip`, which asks a second time before believing a `no` and returns anything else from the first attempt untouched. The comment states the invariant it protects — the module header's "the one direction this module must never be wrong in is claiming a `no`" — and names the four observations that produce a single prose answer without meaning the model cannot call tools.

The review's second half ("let the `/capability` route re-ask on demand … bypass the remembered verdict") turned out to be **already true**: `capabilityOf` re-reads metadata and re-runs the round-trip on every call and consults `knownCapability` not at all. The gate that does not re-read is the settings write's (`index.ts`, `!knownCapability(…)`), which is the cheap-tier guard and not the verdict.

### WR-02: `/api/settings/:provider/capability` takes an unvalidated, unbounded model id

**Files modified:** `server/src/index.ts`, `server/test/api.test.ts`
**Commit:** `439f99b`
**Applied fix:** the existing bound was *extracted* rather than copied, so there is one schema and not two. `ModelId` (trim, `max(200)`, `^[A-Za-z0-9._:/-]*$`) is now a named const; `SettingsWrite.model` is `ModelId.optional()`, and the route parses `CapabilityAsk = z.object({ model: ModelId.optional() }).strict()` instead of reading `body.model` by hand. New case asserts the charset sentence, the length sentence and `.strict()` — all three the settings write's own, because there is one schema.

### WR-03: A rescan does not forget verdicts on a row whose server stopped answering

**Files modified:** `server/src/index.ts`, `server/test/api.test.ts`
**Commit:** `bc25228`
**Applied fix:** every local row the pass looks at is forgotten, found or not, then only the found rows are re-read — exactly the review's shape.

The test is worth a note. The obvious fixture (move the row to a dead port, rescan) proves nothing, because a `base_url` write forgets the row's verdicts by itself; the first version of this case passed with the fix reverted for that reason. The committed case keeps the address fixed and **closes the fake server** instead, which is the real scenario, and it fails without the fix.

### WR-04: The `num_ctx` field shows raw zod sentences to the learner

**Files modified:** `server/src/index.ts`, `server/test/api.test.ts`
**Commit:** `d71329b`
**Applied fix:** `.number({ message: … })` and `.int(…)` now carry `the context window is a whole number of tokens`, so neither type error reaches the row's error line as `Invalid input: expected int, received number`. New case asserts both the fraction (`20000.5`, reachable because `type="number"` accepts one) and the string form.

**Not applied, deliberately:** `min={NUM_CTX_FLOOR}` and `step={1024}` on the input. `NUM_CTX_FLOOR` is not on the wire and the component's own contract is that it "renders what the API returns and hard-codes neither number", so `min` would mean either a hard-coded 16384 in the browser or a new wire field; and `step` alone changes which values the browser marks `:invalid` with nothing in the code reading validity. The learner-visible half of the finding — the raw sentences — is fixed.

### WR-05: The activation refusal resolves the install-wide model, not the learner's

**Files modified:** `server/src/index.ts`, `server/test/api.test.ts`
**Commit:** `fad2de8`
**Applied fix:** `capabilityRefusal(spec.id, modelFor(spec.id, learnerOf(c)))`, matching the sibling route's `modelFor(spec.id, learner)`. The comment was corrected as the review asked: it now says `ACTIVE_PROVIDER` is per install while the model is per learner, that one check therefore cannot speak for everyone, and that it speaks for the learner making it — with the lesson-time backstop named as what catches another learner's refused model on their own first turn.

The case lives in the in-process describe rather than a spawned-server one, because `startDeriveServer` sets `DERIVE_BACKEND`, which locks the provider with a 409 before the refusal is reached. It gives one learner a refused per-provider model, leaves the install-wide id unread, and asserts the no-pref learner is allowed while the asking learner is refused by name. Verified failing without the fix.

### WR-06: The conformance harness's fatal path bypasses its own redaction chokepoint

**Files modified:** `scripts/conformance.mjs`
**Commit:** `71b49d3`
**Applied fix:** the review's shape. A module-level `safeOut` starts as the narrowing every catch does and is rebound to `secrets.safeMessage` in `main` the moment the keys are registered; the spawn throw (which embeds a raw line of the child server's stderr) and the entry point's last catch both go through it. `grep -n "e.message\|String(e)\|console.error"` over the file now returns only `safeOut`'s own definition and its one call site.

Verified by `node --check`, by exercising `exitCodeFor` across its three outcomes, and by driving the entry-point fatal path for real (hiding `server/dist/index.js`, which printed Derive's own `run \`pnpm build\` first` sentence through `safeOut`). **Coverage note:** this script has no automated test of any kind — it is not in `server/test/` and nothing imports it — so the redaction wiring is verified by reading and by the manual run above. That gap is pre-existing and is the same ground as `.planning/WINDOWS.md` #27.

### WR-07: The teaching proof has no deadline

**Files modified:** `server/src/capability.ts`, `server/test/api.test.ts`
**Commit:** `8e469e9`
**Applied fix:** `PROOF_MS = 5 * 60_000`, a `setTimeout` that ends the turn through `interrupt(lessonId)` the way a Stop does (which also cancels a card the turn may be waiting on, so the deadline cannot be outlasted by a prompt nobody will answer), `clearTimeout` in the existing `finally` beside `stop()` and `deleteLesson()`, and the stopped outcome read **before** the three existing ones — a turn Derive cut short would otherwise read as "the model called no tools", which is true of the log and false about the model.

On the fourth sentence. The review offered "a fourth outcome sentence (or reuse `UNGRADABLE`)". `UNGRADABLE` was not reused: "the quiz came back but the grade was unreadable" is false when nothing came back. The sentence that ships arrives through the `{reason}` slot of `Fail · {reason}`, which `04-03-PLAN.md` explicitly blesses for "any other `ok: false` the turn ends with … not a fourth approved string but the `{reason}` slot doing what the UI-SPEC says it does". It names the shipped bound and one next step, in the voice of every other refusal in the phase. No row of §Copywriting Contract was edited and no UI element changed.

The test needed a seam, and it is the fourth of its kind rather than a new idea: `setProofDeadlineOverride` has the same posture and the same doc as `drivers/api.ts`'s `setStepCapOverride` and `setSleepOverride` — no route, header, environment variable or config file can set it, production still runs on `PROOF_MS`, and the only honest way to reach the branch on the real clock is a five-minute test. It moves *when* the stop fires and not what the learner is told, so the case still pins the shipped "5 minutes" wording. Verified failing with the branch disabled.

### WR-08: A stale "Pass" line survives a model change on the provider row

**Files modified:** `web/src/components/ProviderRow.tsx`
**Commit:** `13f5908`
**Applied fix:** the review's stronger option. The result is stored as `{ model, result }` and rendered through `const proof = teaching && teaching.model === effective ? teaching.result : null`. One check instead of a `setTeaching(null)` in every place the model can move: a save, an id picked out of the fetched list, a rescan that replaces the row, and a parent refresh through `onChange` all change `effective`, and each of them would otherwise leave `Pass · …` beside a model nothing has tested. The model is read *before* the run, so a result is filed under the model that was actually proved.

## Notes for the owner

Three things a reader of this report should know, none of them a skipped finding:

1. **`.planning/WINDOWS.md` #26 is still open and now describes only its remaining half.** CR-02 removed the inert `num_ctx` field from the two read-only rows; the *refusal sentence* on those rows is still the `num_ctx` one, which is the Copywriting Contract change #26 is open for. Per instruction, WINDOWS.md was not touched. The review's own framing holds: both halves are needed for the journey to work, and only one of them was mine to fix.
2. **`.planning/WINDOWS.md` #27 (the conformance harness's live replay path has no automated coverage) was not touched either**, and WR-06's fix lands inside that uncovered script. See the coverage note under WR-06.
3. **`capability.ts`'s round-trip tier (WR-01) has no automated coverage**, before this fix or after it: it resolves its model through `adapterFor(spec.id).model(…)` directly, with no suite seam, and `drivers/api.ts`'s `modelOverride` cannot be reused from here without putting a real cycle between `capability.ts` and `drivers/api.ts`. Adding a fifth suite-only seam to `capability.ts` for it is a reasonable next step but is more than the finding asked for, so it was not done unilaterally.

Two Info findings were touched incidentally and are recorded here so a later Info pass is not surprised: **IN-04** (`rowView` reading the same setting twice) is unchanged — the double `getSetting(numCtxKey(...))` is still there, deliberately left alone to keep CR-02's diff narrow. **IN-01**'s false claim in `capability.ts`'s header (that the driver override seam "is read in `agent.ts`, never here") is unchanged and is now one line above a file that imports `interrupt` from `agent.js`; still a documentation defect, still out of scope.

---

_Fixed: 2026-10-22_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
