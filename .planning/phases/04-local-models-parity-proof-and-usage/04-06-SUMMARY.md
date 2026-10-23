---
phase: 04-local-models-parity-proof-and-usage
plan: 06
subsystem: web-ui, test-gates
tags: [gap-closure, ui-spec, prohibition-enforcement, source-gate]
status: complete

requires:
  - "web/src/pages/Lesson.tsx — the `error` timeline item that renders the lesson refusal card (04-01/04-02)"
  - "web/src/pages/Usage.tsx — the page whose browser-formats-nothing rule COST-03 prohibits breaking (04-05)"
  - "server/src/db.ts — the tool-rejection ledger whose identifiers PROV-13 keeps out of the browser (04-04)"
provides:
  - "The lesson refusal card bounded at max-w-[62ch] with break-words, implementing the locked UI-SPEC E2 overflow and long-text rows on the element that actually renders"
  - "Two source gates in server/test/usage.test.ts: the first test in server/test/ ever to read a file under web/src, closing both partial prohibitions"
affects:
  - ".planning/phases/04-local-models-parity-proof-and-usage/04-VERIFICATION.md — all four recorded gaps closed; a re-verification should re-score rows 18, 19, 43 and 48"
  - ".planning/phases/04-local-models-parity-proof-and-usage/04-USER-SETUP.md — one human-check item appended beside the five behavior_unverified ones"

tech-stack:
  added: []
  patterns:
    - "Source gate via `readFileSync(new URL('../../web/src/…', import.meta.url), 'utf8')` — the guards.test.ts idiom extended across the workspace boundary for the first time"
    - "Comment-stripping before a negative source assertion, with a permanent sentinel assertion so an over-eager stripper cannot make the gate pass vacuously"
    - "`readdirSync(dir, { recursive: true })` walk plus a three-named-file membership guard, so an empty walk fails loudly instead of passing silently"

key-files:
  created: []
  modified:
    - "web/src/pages/Lesson.tsx — `max-w-[62ch] break-words` appended to the `error` timeline item's className (line 361)"
    - "server/test/usage.test.ts — one new `describe('what the browser is not allowed to carry')` with two `it` cases; `readdirSync` added to the `node:fs` import"
    - ".planning/phases/04-local-models-parity-proof-and-usage/04-USER-SETUP.md — the E2 render human-check recorded for end-of-phase UAT"
    - ".planning/WINDOWS.md — one `unrun-verify` entry for that same human-check"

key-decisions:
  - "Implemented the locked UI-SPEC rather than amending it: the owner's decision on gap 1's fork was add the class, so 04-UI-SPEC.md is byte-identical and the refusal card is now narrower than its neighbours by design"
  - "`break-words` on the card only, not a global `overflow-wrap` rule in web/src/index.css — the card is the only element with the problem and a global word-break rule would change every screen to fix one"
  - "Gate A strips comments because Usage.tsx's own module doc names two of the three forbidden identifiers in prose on purpose; a gate red on the correct file is a gate the next person deletes"
  - "Gate B does NOT strip comments — none of its four identifiers appears under web/src even in prose today, so raw matching is both stricter and simpler. The binding consequence: do not write a comment under web/src naming them"
  - "The `$`-assembly half of COST-03 stays out of the formatter gate: a raw `$` grep would match the six `${…}` template interpolations in Usage.tsx and be useless, and that half is already covered on the payload at usage.test.ts:607 and :623"

requirements-completed: [PROV-06, PROV-13, COST-03]

coverage:
  - deliverable: "The lesson refusal card carries max-w-[62ch] and break-words on its own className"
    human_judgment: true
    rationale: "The class contract is proven statically (both utilities on the line carrying the card's signature `bg-rust-400/5`, typecheck and build green), but whether the rendered card wraps a file-path model id with no horizontal scrollbar is a layout fact no static read establishes. Carried to 04-USER-SETUP.md beside the five existing behavior_unverified items."
    verification:
      - kind: command
        ref: "grep -n 'bg-rust-400/5' web/src/pages/Lesson.tsx | grep -q 'max-w-\\[62ch\\]' && … 'break-words' && echo CARD_OK"
        status: pass
      - kind: command
        ref: "pnpm typecheck && pnpm build"
        status: pass
  - deliverable: "Gate A — COST-03: no numeric formatter appears in the comment-stripped source of web/src/pages/Usage.tsx"
    human_judgment: false
    verification:
      - kind: test
        ref: "server/test/usage.test.ts#keeps every numeric formatter out of the Usage page"
        status: pass
      - kind: command
        ref: "mutation check — a real `(1.5).toFixed(2)` planted in code inside UsagePage turned the gate red, then reverted green"
        status: pass
  - deliverable: "Gate B — PROV-13: the tool-rejection ledger's four identifiers appear in no .ts/.tsx/.css file under web/src"
    human_judgment: false
    verification:
      - kind: test
        ref: "server/test/usage.test.ts#keeps the tool-rejection ledger out of every file under web/src"
        status: pass
      - kind: command
        ref: "mutation check — a real `recordToolRejection(turn, 'quiz')` reference planted in code in web/src/lib/api.ts turned the gate red, then reverted green"
        status: pass
  - deliverable: "Both gates carry a permanent anti-vacuity guard that runs before any absence assertion"
    human_judgment: false
    verification:
      - kind: command
        ref: "grep -q \"includes('export function UsagePage')\" … && grep -q 'pages/Usage.tsx' … && grep -q 'lib/useLesson.ts' … && grep -q 'components/ProviderRow.tsx' server/test/usage.test.ts && echo ANTI_VACUITY_OK"
        status: pass

metrics:
  duration: "5 min"
  completed: 2026-10-23

actuals:
  tokens: 1125
  tasks: 2
  commits: 2
plan_head_before: c29984ea0429b93b14ed9982b1b311f1d434e654
---

# Phase 4 Plan 06: Gap Closure Summary

Closed all four gaps `04-VERIFICATION.md` recorded: `max-w-[62ch] break-words` on the lesson refusal card so the locked UI-SPEC E2 rows describe the element that actually renders, and two source gates in `server/test/usage.test.ts` — the first tests in `server/test/` ever to read a file under `web/src` — so the PROV-13 values prohibition and the COST-03 browser-formats-nothing prohibition are enforced by the suite rather than held by coincidence.

**Duration:** 5 min (2026-10-23T01:20:51Z → 2026-10-23T01:25:34Z)
**Tasks:** 2 of 2
**Files changed:** 2 source files (plus 2 planning artifacts)

## Gap → change, one line each

| Gap | Status before | What closed it |
|---|---|---|
| 1 — E2 overflow: refusal sentence wraps inside `max-w-[62ch]` | `failed` — no `62ch` anywhere in `Lesson.tsx`; the card inherited the timeline's `max-w-[680px]` | `max-w-[62ch]` appended to the `error` timeline item's own `className` at `web/src/pages/Lesson.tsx:361` |
| 2 — E2 long-text: a long model id wraps rather than clipping | `failed` — no `break-words`/`wrap-anywhere` on the card and no global `overflow-wrap` in `index.css` | `break-words` on the same `className`; `overflow-wrap` is inherited, so it also governs the two fragments `withNextStepLink` splits the sentence into |
| 3 — PROV-13 values: the tool-rejection rate never reaches the learner | `partial` — the fact held, the declared source gate did not exist | Gate B: walks `web/src` recursively and asserts `recordToolRejection`, `toolRejectionRate`, `toolRejectionsOf` and `tool_rejections` appear in no `.ts`/`.tsx`/`.css` file |
| 4 — COST-03: no number may be formatted anywhere in the browser | `partial` — the fact held and the other two halves were tested; the formatter gate did not exist | Gate A: strips comments from `web/src/pages/Usage.tsx` and asserts the result contains none of `toFixed`, `toLocaleString`, `Intl.NumberFormat` |

## Rule 01-21: both gates seen red with their subject violated

Neither gate was kept on the strength of a green run. Each was driven red by planting a real violation **in code** (not in a comment), the red message recorded verbatim, then the plant reverted and the green re-confirmed.

### Gate A — COST-03

**Violation planted in** `web/src/pages/Usage.tsx`, inside `UsagePage`:

```ts
const planted = (1.5).toFixed(2);
void planted;
```

**Command:** `pnpm --filter server exec node --import tsx --test test/usage.test.ts`

**Red message, verbatim:**

```
not ok 1 - keeps every numeric formatter out of the Usage page
      error: |-
        a numeric formatter reached the browser: toFixed. Every figure on this page is a string the server already composed.
        + actual - expected

        + [
        +   'toFixed'
        + ]
        - []

      code: 'ERR_ASSERTION'
      operator: 'deepStrictEqual'
```

Suite summary with the plant in place: `# pass 30`, `# fail 1`. Reverted with `git checkout -- web/src/pages/Usage.tsx`; back to `# pass 31`, `# fail 0`.

### Gate B — PROV-13

**Violation planted in** `web/src/lib/api.ts`:

```ts
const plantedRejection = (turn: string) => recordToolRejection(turn, 'quiz');
void plantedRejection;
```

**Command:** `pnpm --filter server exec node --import tsx --test test/usage.test.ts`

**Red message, verbatim:**

```
not ok 2 - keeps the tool-rejection ledger out of every file under web/src
      error: 'web/src/lib/api.ts names recordToolRejection; the tool-rejection ledger must never reach the learner'
      code: 'ERR_ASSERTION'
      expected: true
      actual: false
      operator: '=='
```

Suite summary with the plant in place: `# pass 30`, `# fail 1`. Reverted with `git checkout -- web/src/lib/api.ts`; back to `# pass 31`, `# fail 0`.

Both plant files are byte-identical to the plan's base commit: `git diff --name-only 36e9633 -- web/src/pages/Usage.tsx web/src/lib/api.ts` is empty.

## The anti-vacuity guards, and why each is there

Both are permanent assertions in the file, not one-time checks, and both run **before** any absence assertion in their test.

- **Gate A** asserts `stripped.includes('export function UsagePage')`. The gate must strip comments — `Usage.tsx:18-19` names `toFixed` and `Intl.NumberFormat` in prose on purpose — and a stripper that returned an empty string would make every following assertion pass forever. The block strip uses `[\s\S]*?` rather than `.*?` because both load-bearing comments in the page span several lines (the module doc at `:9-22`, the JSX comment at `:80-82`); a dot-only pattern would leave both in place and turn the gate red on the correct file.
- **Gate B** asserts its walked list contains `pages/Usage.tsx`, `lib/useLesson.ts` and `components/ProviderRow.tsx` — three files in three different subdirectories. A walk that silently returns an empty list is the exact way an "appears nowhere" gate reads green while guarding nothing. A rename turns this red and a human re-points it, which is the correct outcome.

## Full gate: before and after

The phase's proven full gate, `pnpm method:check && pnpm typecheck && pnpm build && pnpm test`, run on the working tree after both commits.

| | At `36e9633` (plan baseline) | After 04-06 |
|---|---|---|
| tests | 500 | **502** (+2, exactly the two new gates) |
| suites | 116 | **117** (+1, the one new describe) |
| failures | 0 | **0** |
| `method:check` | green — 6 rendered copies match `method/` | green — unchanged |
| `typecheck` | green (server + web) | green |
| `build` | green | green |

`server/test/usage.test.ts` alone went from 29 passing in 7 suites to 31 passing in 8 suites.

## Scope: nothing moved that was not supposed to

```
git diff --name-only 36e9633 -- web/ server/ scripts/ plugin/ codex/ method/ .github/ \
  package.json pnpm-lock.yaml pnpm-workspace.yaml
→ server/test/usage.test.ts
  web/src/pages/Lesson.tsx
```

Exactly the two files `files_modified` names, and no more. In particular `web/src/index.css` and `server/src/context.ts` are untouched — the refusal sentence itself (`NUM_CTX_REFUSAL` / `REFUSAL`) is correct and locked, and this plan changed how it wraps, not what it says.

```
git diff --name-only 36e9633 -- .../04-UI-SPEC.md .../COVERAGE.md   → empty
git diff --name-only HEAD   -- .../04-0[1-5]-{PLAN,SUMMARY}.md      → empty
```

The signed-off UI-SPEC is byte-identical, per the owner's decision on gap 1's fork. `COVERAGE.md` is carried forward unchanged. Plans `04-01` … `04-05` and their SUMMARYs are untouched.

No new component, route, event type, tool, config key, migration, dependency, npm script or workflow. Nothing was installed; `pnpm-lock.yaml` did not move.

## Verification results

Every command from the plan's `<verification>` block, run from the repo root in order.

| # | Check | Result |
|---|---|---|
| 1 | Card carries both classes (scoped to `bg-rust-400/5`) | ✓ `CARD_OK`; each `grep -c` returns `1` |
| 2 | A test now reads `web/src` | ✓ `grep -c "web/src" server/test/usage.test.ts` → `5` (baseline was `0` — that absence was literally what both `partial` gaps recorded) |
| 3 | Both anti-vacuity guards present | ✓ `ANTI_VACUITY_OK`; the first grep matches the membership call `includes('export function UsagePage')`, not the bare sentinel, so the sentinel in a comment cannot satisfy it |
| 4 | The two gates pass | ✓ `# pass 31`, `# fail 0`, `# suites 8` |
| 5 | Whole tree green | ✓ `method:check` + `typecheck` + `build` green; `# tests 502`, `# pass 502`, `# fail 0` |
| 6 | Nothing out of scope moved | ✓ both path-scoped diffs as shown above |

Task 1's diffstat criterion also holds: `git diff --stat 36e9633 -- web/src/pages/Lesson.tsx` → `1 file changed, 1 insertion(+), 1 deletion(-)` — one `className` line, nothing else.

## Deviations from Plan

None — plan executed exactly as written.

The one addition the plan itself instructed: Task 1's `<human-check>` says to record the rendered half of the E2 rows "with the five existing `behavior_unverified` items in `04-USER-SETUP.md`". That item is now a checkbox under that file's `## Verification` section, and a matching `unrun-verify` entry is in `.planning/WINDOWS.md`. Neither is a source change and neither affects the two-files-changed criterion.

## Authentication Gates

None. This plan ran no authenticated command, installed nothing, and reached no network.

## Known Stubs

None. Nothing was stubbed, skipped or left placeholder. The one unverified item is a rendered-layout fact that no static read can establish (see below), not a stub.

## Deferred / carried items

- **The E2 render human-check.** Both classes are asserted statically and the build is green, but whether the rendered card wraps a file-path model id with no horizontal scrollbar needs a browser and a triggered `num_ctx` refusal on a read-only local row. Recorded in `04-USER-SETUP.md` beside the five `behavior_unverified` items and in `.planning/WINDOWS.md` as `unrun-verify`.
- **Untouched by design**, per the plan's out-of-scope list: the five `behavior_unverified` items (SC1–SC4 and the Usage header at 375px), the open items in `.planning/WINDOWS.md` (the `num_ctx` refusal sentence on read-only rows awaiting a Copywriting Contract decision, the conformance harness's live replay coverage, research assumption A2), and the 9 INFO findings in `04-REVIEW.md`.

## Issues Encountered

None.

## Next Phase Readiness

All six plans in Phase 4 now have SUMMARYs, and all four gaps `04-VERIFICATION.md` recorded are closed. Phase complete and ready for re-verification — a re-run should re-score rows 18 and 19 from `✗ FAILED` to verified, and rows 43 and 48 from `partial` (enforcement gate missing) to verified. The five `behavior_unverified` items plus the one appended here remain the owner's end-of-phase UAT and need either a live local model server or a merge to `main`; their absence is the planned state.

## Self-Check: PASSED

- `web/src/pages/Lesson.tsx` — FOUND on disk
- `server/test/usage.test.ts` — FOUND on disk
- commit `62240dd` — FOUND in `git log --all`
- commit `41e9d38` — FOUND in `git log --all`
- `commits: 2` MEASURED from the persisted ledger: `git rev-list --count c29984e..HEAD` → `2`
