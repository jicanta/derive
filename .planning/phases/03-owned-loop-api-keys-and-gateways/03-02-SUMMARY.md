---
phase: 03-owned-loop-api-keys-and-gateways
plan: 02
subsystem: api
tags: [pricing, cost, fsrs-adjacent-pure-modules, context-window, node-test, typescript]

# Dependency graph
requires:
  - phase: 01-provider-contract-and-method
    provides: "the usage ledger (UsageRow, CostSource, recordUsage) and the rule that driver is the catalogue ProviderId denormalised onto every row"
  - phase: 02-settings-and-secrets
    provides: "the provider catalogue (providers.ts) and the file-backed-read-live pattern in keys.ts that prices.ts copies"
provides:
  - "server/src/pricing.ts — the versioned price and context-window table as committed pure data, dated PRICES_AS_OF 2026-10-06 and cross-checked against all three vendors' own pricing pages"
  - "server/src/prices.ts — ~/.derive/prices.json merged over the shipped table, read live behind a one-second cache; absent is silent, invalid is loud and merges nothing"
  - "server/src/cost.ts — costOf, weakestSource and the one money formatter (costLabel) both call sites will share"
  - "server/src/context.ts — estimateTokens, headroomCheck, CHARS_PER_TOKEN and HEADROOM_FRACTION"
  - "PRICES_PATH in server/src/config.ts, beside SECRETS_PATH"
  - "server/test/cost.test.ts — 33 cases with no database, no network and no key"
affects: [03-06 native search counts, 03-08 cost wiring to the lesson header and Home row, 03-09 the prices-file error route, 04 local models and the usage page]

actuals:
  tokens: 11255
  tasks: 3
  commits: 6

plan_head_before: 8d8218b27da6f1ddbf6d8b1c8803c8e7f1897975

tech-stack:
  added: []
  patterns:
    - "A versioned *_AS_OF pure-data table (providers.ts's DEFAULTS_AS_OF convention) extended to money"
    - "File-backed-read-live with no writer: keys.ts's load/cache/reset shape minus persist, setKey, removeKey and the 0600 atomic rename"
    - "Total, order-independent label resolution over a Set rather than a fold over row order"

key-files:
  created:
    - server/src/pricing.ts
    - server/src/prices.ts
    - server/src/cost.ts
    - server/src/context.ts
    - server/test/cost.test.ts
  modified:
    - server/src/config.ts

key-decisions:
  - "PRICES_AS_OF is 2026-10-06 because the five first-party rows were re-checked that day against docs.claude.com, platform.openai.com and ai.google.dev; every per-token rate, every cache rate and every per-search rate agreed with the OpenRouter seed, so no row carries a correction"
  - "The override merge is per field within a model, not per model: naming one rate must not silently drop that model's context window, which the headroom check reads and whose absence would quietly switch the refusal off"
  - "costLabel takes CostSource | null and answers null on a null source — that is how a lesson with no usage rows renders no segment at all, rather than the caller having to know the rule"
  - "A row whose four token columns are all null carries unknown and contributes no money even when its model is in the table, because pricing nulls at zero turns a blank into a claim that the request was free"
  - "The native per-call search charge is folded into the row's own money through an optional searches field on the row shape cost.ts reads (D-20 option 1), so the lesson total stays correct with no migration and no second meaning for cost_source"

patterns-established:
  - "Money prose in the module header: the reason a figure may never claim more firmness than its weakest input is written beside the code that enforces it, in schedule.ts's voice"
  - "A validated learner file is assembled into its target type field by field rather than cast, so the cast cannot become the hole the validation was built to close"

requirements-completed: [COST-04, COST-02, PROV-08]

coverage:
  - id: D1
    description: "The versioned price and context-window table ships as committed pure data with a dated PRICES_AS_OF, ten model rows, and no I/O or import-time side effect"
    requirement: COST-04
    verification:
      - kind: unit
        ref: "server/test/cost.test.ts#the price table > records the day the rates were checked"
        status: pass
      - kind: unit
        ref: "server/test/cost.test.ts#the price table > carries a rate for every catalogue model the app can actually teach on"
        status: pass
      - kind: unit
        ref: "server/test/cost.test.ts#the price table > ships no row that would price a lesson at nothing"
        status: pass
      - kind: other
        ref: "for f in server/src/pricing.ts server/src/prices.ts; do grep -cE 'process\\.env|fetch\\(' (comments stripped) = 0; done"
        status: pass
    human_judgment: false
  - id: D2
    description: "A model absent from the table prices as unknown, never as zero; priceOf and windowOf return undefined rather than a record of zeros"
    requirement: COST-04
    verification:
      - kind: unit
        ref: "server/test/cost.test.ts#the price table > returns undefined rather than a record of zeros for anything it does not know"
        status: pass
      - kind: unit
        ref: "server/test/cost.test.ts#the cost arithmetic and the money string > contributes no money and carries unknown for a model the table does not have"
        status: pass
    human_judgment: false
  - id: D3
    description: "A learner's ~/.derive/prices.json merges over the shipped table live — absent is silent, unreadable or invalid is loud and nothing merges while that error stands"
    requirement: COST-04
    verification:
      - kind: unit
        ref: "server/test/cost.test.ts#the override file (9 cases: absent, one-model overlay, invalid JSON, negative, string, infinite, missing rate, unknown provider, non-object entry, array top level, cache window)"
        status: pass
    human_judgment: false
  - id: D4
    description: "One pure formatter produces every money string: four label words, two decimals, the under $0.01 floor at 0.005, the label alone at exactly zero, and null when there is no segment"
    requirement: COST-02
    verification:
      - kind: unit
        ref: "server/test/cost.test.ts#the cost arithmetic and the money string > says the four words and nothing else"
        status: pass
      - kind: unit
        ref: "server/test/cost.test.ts#the cost arithmetic and the money string > floors a sub-cent lesson at under $0.01 rather than rounding it to nothing"
        status: pass
      - kind: unit
        ref: "server/test/cost.test.ts#the cost arithmetic and the money string > returns null rather than an empty string when there is nothing to say"
        status: pass
    human_judgment: false
  - id: D5
    description: "A lesson's cost is a pure function of its usage rows and the price table, and a mixed-source lesson takes the weakest word, independent of row order"
    requirement: COST-02
    verification:
      - kind: unit
        ref: "server/test/cost.test.ts#the cost arithmetic and the money string > lets the weakest source in the lesson decide the word, whatever order the rows arrive in"
        status: pass
      - kind: unit
        ref: "server/test/cost.test.ts#the cost arithmetic and the money string > prices a lesson from the table when the provider reported no figure"
        status: pass
      - kind: other
        ref: "grep -c \"from './db.js'\" equals grep -c \"import type .* from './db.js'\" in cost.ts and context.ts"
        status: pass
    human_judgment: false
  - id: D6
    description: "The native per-call search charge lands in the lesson total rather than vanishing from it, with no schema change (D-20)"
    requirement: COST-02
    verification:
      - kind: unit
        ref: "server/test/cost.test.ts#the cost arithmetic and the money string > folds a native search's per-call charge into the same total"
        status: pass
    human_judgment: false
  - id: D7
    description: "A prompt that would outgrow a known context window is detectable before the request, with a conservative estimate that errs toward refusing early; an unknown window abstains"
    requirement: PROV-08
    verification:
      - kind: unit
        ref: "server/test/cost.test.ts#the estimator (5 cases: over-count, under the headroom, over the headroom, the three texts summed, an unlisted window abstaining at 8M characters)"
        status: pass
    human_judgment: false
  - id: D8
    description: "The shipped per-token rates match each vendor's own first-party list price for the models in the table on PRICES_AS_OF"
    requirement: COST-04
    verification:
      - kind: manual_procedural
        ref: "fetched docs.claude.com/en/docs/about-claude/pricing, platform.openai.com/docs/pricing and ai.google.dev/gemini-api/docs/pricing on 2026-10-06 and compared every rate against the table"
        status: pass
    human_judgment: true
    rationale: "The plan marks this truth `verification: backstop` — no automated gate can assert a third party's published price, and a stale table is only visible to a human who re-reads the vendor pages. The comparison performed this run is recorded in the pricing.ts header; a verifier re-running it would be re-reading the same three pages."

duration: 22 min
completed: 2026-10-06
status: complete
---

# Phase 03 Plan 02: The price table, the cost calculator and the context estimator Summary

**Every number the phase will show a learner now comes from four pure modules with no I/O: a dated ten-row price and context-window table, a live-merged `~/.derive/prices.json` override, `costOf`/`costLabel` with the four label words and the `under $0.01` floor, and a conservative headroom check that abstains on an unlisted window.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-10-06T21:40:00Z
- **Completed:** 2026-10-06T22:01:23Z
- **Tasks:** 3
- **Files modified:** 6 (5 created, 1 modified)

## Accomplishments

- `server/src/pricing.ts` ships ten rows of committed pure data — five native model ids and the five OpenRouter slugs for the same models, kept as separate keys because the two providers spell them differently — with `PRICES_AS_OF = '2026-10-06'` earned rather than asserted: every rate was re-read that day from Anthropic's, OpenAI's and Google's own pricing pages and every one agreed with the OpenRouter seed, so no row carries a correction.
- `server/src/prices.ts` reads the learner's override live behind a one-second cache, copying `keys.ts`'s shape with the whole write half removed. An absent file is silent; a file that is unparseable, names an unknown provider, carries a quoted, negative or infinite rate, or gives a new model no `input` rate merges **nothing** and reports one sentence naming the path, the model and the field.
- `server/src/cost.ts` prices a lesson from its rows and the merged table with no HTTP and no SQL, and `weakestSource` makes the label a total, order-independent function over the rows' sources rather than whatever the last row said.
- `server/src/context.ts` over-counts tokens on purpose (3 chars/token) and refuses at 80% of a known window with the UI-SPEC's verbatim sentence, while a model whose window is not in the table abstains rather than refusing on a guess.
- `server/test/cost.test.ts` covers all 33 cases with no database, no network and no key: `pnpm typecheck && pnpm build && pnpm test` passes whole-tree at 317/317.

## Task Commits

Each task was committed atomically; Tasks 1 and 2 ran the full TDD cycle.

1. **Task 1: the price table and the learner's override**
   - RED `3db8984` (test) — the suite plus signature-only stubs, so the run failed on assertions rather than on a missing module
   - GREEN `53cb331` (feat) — `pricing.ts`, `prices.ts` and `PRICES_PATH` in `config.ts`
   - REFACTOR `f4dcf04` (refactor) — each merged record built as a `ModelPrice` by construction, removing the `as unknown as` cast
2. **Task 2: the cost calculator, the money formatter and the context estimator**
   - RED `13e29d3` (test)
   - GREEN `ddae504` (feat) — `cost.ts` and `context.ts`
   - *(no REFACTOR commit: the GREEN implementation needed no cleanup, and the TDD reference commits that phase only when changes are made)*
3. **Task 3: close the suite** — `493e42e` (test)

**Plan metadata:** see the `docs(03-02)` commit that follows this file.

## TDD Gate Compliance

| Task | RED | GREEN | REFACTOR | Status |
|------|-----|-------|----------|--------|
| 1 | ✓ `3db8984` | ✓ `53cb331` | ✓ `f4dcf04` | Pass |
| 2 | ✓ `13e29d3` | ✓ `ddae504` | — (optional, none needed) | Pass |

Both RED phases were classified before any production edit:
`gsd-tools check tdd-red-evidence` returned **`RED_EVIDENCE_OK`** for each — Task 1 on target test *"carries a rate for every catalogue model the app can actually teach on"* (12 discovered, 2 pass, 10 fail, exit 1), Task 2 on *"says the four words and nothing else"* (29 discovered, 18 pass, 11 fail, exit 1).

One mechanical note for whoever runs this gate next: `node:test` indents subtest TAP lines under their suite, and the classifier's `tapFailedTestNames` anchors `not ok N - <name>` to column 0, so a nested run reports only the suite name and classifies as `no_target_test_failure`. The run's own output was de-indented before being handed to the classifier — statuses and names unchanged, only the leading whitespace on `ok` / `not ok` / `#` lines removed.

## Files Created/Modified

- `server/src/pricing.ts` — the versioned table: `PRICES_AS_OF`, `PRICES` (10 rows), `priceOf`, `windowOf`, `type ModelPrice`, `type PriceTable`. Pure data, no import-time side effect.
- `server/src/prices.ts` — `priceTable()`, `pricesFileError()`, `resetPriceCache()`, `PRICE_CACHE_MS`. Reads `PRICES_PATH` live, validates as learner-editable input, has no write path.
- `server/src/cost.ts` — `costOf`, `costLabel`, `weakestSource`, `type Cost`, `type CostRow`. Imports `db.ts` and `pricing.ts` as types only.
- `server/src/context.ts` — `estimateTokens`, `headroomCheck`, `CHARS_PER_TOKEN`, `HEADROOM_FRACTION` and the verbatim refusal sentence.
- `server/src/config.ts` — `PRICES_PATH` added beside `SECRETS_PATH`.
- `server/test/cost.test.ts` — four `describe` blocks, 33 cases, `DERIVE_DATA_DIR` pinned to a scratch directory before any dynamic import.

## Decisions Made

- **`PRICES_AS_OF = '2026-10-06'`, earned by a real cross-check.** `03-RESEARCH.md` A5 recorded the figures as *OpenRouter's* and flagged the assumption that they mirror first-party list prices. All three vendor pages were fetched and compared this run: Anthropic lists Opus 5.5 at $4/$20 per MTok with $5 five-minute writes, $0.20 hits and search at $10 per 1,000; OpenAI lists `gpt-6-astra` at $10/$1/$12.50/$50 and `gpt-6-luna` at $0.10/$0.01/$0.125/$0.50 with search at $10 per 1k calls; Google lists Gemini 3.8 Flash at $0.75/$3.75 with $0.075 caching and grounding at $14 per 1,000. Every figure agreed, so A5 is now a dated record rather than an assumption. Two honesty notes are written into the table's own doc comment rather than a changelog: OpenAI's rates are the short-context tier and double above 272,000 prompt tokens, and Google's are promotional through 2026-12-31 and double on 2027-01-01 — both reasons `table` reads `estimated` rather than `billed`.
- **Google's `cache_write` is a derived figure and says so.** Google prices cache *storage* at $0.50 per million tokens per hour, not per token written; OpenRouter's per-token `input_cache_write` is an amortisation of that rate. Kept, with the derivation in a comment beside the row, because `cache_write_tokens` is a count with no duration attached to it.
- **The override merges per field inside a model, not per model.** The plan said "laid over… merged per model rather than per provider"; per-field is strictly finer and satisfies both sibling rules, and it is what stops a learner who corrects one `input` rate from silently dropping that model's `context` — which `headroomCheck` reads, and whose absence would switch the refusal off without a word.
- **`costLabel` takes `CostSource | null`.** The plan asks both that `costOf([])` be `{ usd: null, source: 'unknown' }` *and* that the formatter return `null` for a lesson with no usage rows. A null `source` is the "nothing to say" signal, so the no-segment rule lives in the formatter rather than being re-derived at each of the two call sites plan 03-08 wires.
- **A row with four null token columns stays `unknown` even when its model is in the table.** The plan's prohibition is explicit — "a request the provider reported nothing for must not be priced as zero" — and without this guard a legacy `cost_source: 'unknown'` row with a known model would have been priced at $0.00 and relabelled `estimated`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] A null-count row would have been priced as zero and relabelled `estimated`**
- **Found during:** Task 2 (the cost calculator)
- **Issue:** The plan's `costOf` recipe sends every non-`provider`, non-`subscription` row down the table-pricing branch. A `cost_source: 'unknown'` row — what plan 03-01 writes when a turn reports nothing, and what every backfilled row looks like — has a known model but four null counts, so it would have priced at exactly $0.00 with `source: 'table'`, turning a blank into a claim that the request was free and overstating its firmness. That is the plan's own first prohibition.
- **Fix:** A row whose `input_tokens`, `output_tokens`, `cache_read_tokens` and `cache_write_tokens` are all null carries `unknown` and contributes no money, with the reason in a one-sentence comment.
- **Files modified:** `server/src/cost.ts`
- **Verification:** `server/test/cost.test.ts#never prices a request the provider reported nothing for`
- **Committed in:** `ddae504` (Task 2 GREEN commit)

**2. [Rule 1 - Bug] The RED-evidence classifier could not see nested `node:test` subtests**
- **Found during:** Task 1 (RED gate)
- **Issue:** `gsd-tools check tdd-red-evidence` returned `INVALID_RED (no_target_test_failure)` on a run where the target test genuinely failed on its assertion. `tapFailedTestNames` anchors `^not ok \d+ - (.+)$` to column 0, and `node:test` indents every subtest line under its `describe`, so only the suite name was ever visible to the classifier.
- **Fix:** The captured run output is de-indented (leading whitespace stripped from `ok` / `not ok` / `#` lines only) before being handed to the classifier. Names and statuses are untouched; this is a reporter-format normalisation, not a change to the evidence. Both RED gates then classified `RED_EVIDENCE_OK`.
- **Files modified:** none in this repo — the workaround lives in the gate invocation. Recorded here because the next `type: tdd` plan in this repo will hit it.
- **Verification:** `gsd-tools check tdd-red-evidence --pick verdict` → `RED_EVIDENCE_OK` on both records.
- **Committed in:** n/a (tooling invocation, no repo file changed)

### Scope boundary observed

**Task structure.** The plan marks Tasks 1 and 2 `tdd="true"` while putting the suite in Task 3, and Task 1's `<verify>` acknowledges this ("the suite arrives in Task 3 of this plan; run this gate after it exists"). Executing that literally would have meant writing both implementations before a single test. The suite was therefore built incrementally — each TDD task's RED commit adds its own `describe` blocks and signature-only stubs — and Task 3 closed the remaining behaviour bullets and ran the whole-tree gate. Every Task 3 acceptance criterion holds on the finished file.

**`plugin/commands/*.md` and `providers.ts`'s OpenRouter default.** `03-RESEARCH.md` Pitfall 4 records that the `openrouter` catalogue row's `defaultModel` is the dash-spelled `anthropic/claude-opus-5-5`, which is not a valid OpenRouter slug. That row is `teaches: false`, so the catalogue-coverage assertion does not reach it and no lesson can run on it; fixing it belongs with D-27 in the plan that flips the row. Left alone.

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking-tooling)
**Impact on plan:** Both were required for correctness — the first by the plan's own prohibition, the second to clear the TDD gate honestly rather than by lowering it. No scope creep: six files touched, all named in the plan's `files_modified`.

## Issues Encountered

None. The whole-tree gate (`pnpm typecheck && pnpm build && pnpm test`) passed first time at 317/317 after Task 3.

## Known Stubs

None. The signature-only stubs committed in each RED phase were fully replaced in the matching GREEN commit; no `STUB`, `TODO` or `FIXME` marker survives in any of the five files.

## Threat Flags

None. This plan opens no endpoint, adds no auth path and changes no schema. The one new trust boundary — `~/.derive/prices.json` crossing into the cost path — is already T-03-09 in the plan's own register, and its mitigation shipped: the file is validated as learner-editable input (top-level object, known provider ids, every rate a finite number at or above zero) and a single bad field refuses the whole file rather than merging half of it.

## User Setup Required

None - no external service configuration required. A learner who wants to correct a rate writes `~/.derive/prices.json` by hand; Derive never creates it and never writes to it.

## Next Phase Readiness

- Plan **03-08** has everything it needs to wire the figure to the lesson header pill (A1) and the Home row (A2): `costOf(rows, priceTable())` then `costLabel(cost.usd, rows.length ? cost.source : null)`. The null-source call is how a brand-new lesson renders no third segment.
- Plan **03-06** supplies the native-search count; it lands on the row shape `cost.ts` already reads (`CostRow.searches`), so no change here is needed when it arrives.
- Plan **03-09** can surface `pricesFileError()` through the existing `{ error }` route shape; the sentence names the path, the model and the field and carries no secret.
- The driver work can start recording `cost_source: 'table'` with real counts the moment it wants to: the table is live and `costOf` is already total over every source.
- **One dated obligation:** Google's Gemini rates in `PRICES` are promotional through 2026-12-31 and double on 2027-01-01. The table's doc comment says so; nothing automated will notice.

---
*Phase: 03-owned-loop-api-keys-and-gateways*
*Completed: 2026-10-06*

## Self-Check: PASSED

All five created files and the modified `server/src/config.ts` exist on disk; all six task commits (`3db8984`, `53cb331`, `f4dcf04`, `13e29d3`, `ddae504`, `493e42e`) are present in the git log. Plan-level verification re-run at close: `pnpm --filter server exec node --import tsx --test test/cost.test.ts` → 33/33; `pnpm typecheck && pnpm build && pnpm test` → exit 0, 317/317; the `process.env` / `fetch(` negative greps and the `import type`-only db.ts gate pass on all four modules.
