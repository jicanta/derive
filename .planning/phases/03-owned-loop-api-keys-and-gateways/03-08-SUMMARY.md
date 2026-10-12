---
phase: 03-owned-loop-api-keys-and-gateways
plan: 08
subsystem: ui
tags: [prompt-caching, cost, anthropic-cache-control, lesson-header, home-row, tailwind-4, node-test, cdp]

# Dependency graph
requires:
  - phase: 03-owned-loop-api-keys-and-gateways
    provides: "plan 03-02's price table, costOf/weakestSource and the one money formatter (costLabel) — rebuilt nowhere, called from one new place"
  - phase: 03-owned-loop-api-keys-and-gateways
    provides: "plan 03-01's owned loop with `instructions` already in the array form the cache split needs, and the usage ledger's cache_read_tokens / cache_write_tokens columns"
  - phase: 03-owned-loop-api-keys-and-gateways
    provides: "plan 03-07's adapter table with a per-row dialect, where the per-row cache hook now goes beside it"
  - phase: 02-settings-and-secrets
    provides: "the lesson header pill (D-15) the cost segment joins, and the @theme tokens the new markup names"
provides:
  - "TurnContext.instructionsStable / instructionsVolatile: D-06's cache split, additive so the Claude and Codex drivers are untouched"
  - "Adapter.cacheHook: Anthropic's ephemeral breakpoint on the stable prefix, nothing on the four rows that cache a prefix by themselves"
  - "The owned loop sends two system entries, stable first, with toolOrder still pinned and the prefix's byte stability recorded as load-bearing"
  - "lessonCost(lessonId, extra?) in server/src/drivers/api.ts: one sum behind the lesson view, the Home list and every ending of a turn"
  - "lesson_cost on all seven endings of the owned loop, counting the blank row endTurn is about to write for a turn that reported nothing"
  - "cost: string | null on LessonView and LessonSummary, and a named LessonView type where api.ts had an inline shape"
  - "The cost segment inside the existing header pill, and the same string on the Home row before the locked count"
  - "Ten new cases: four on the cache split, two on the lesson total, six over the HTTP surface with no model"
affects: [03-09 the settings cards and the prices-file error route, 04 the usage page and local models]

actuals:
  tokens: 14647   # chars/4 over the realized diff d33f34e..598a45b (58,588 chars)
  tasks: 3
  commits: 3
  plan_head_before: d33f34e373a32cd1b86094b78b2eca3e0db3c3f0

tech-stack:
  added: []
  patterns:
    - "An additive context split: the concatenated field stays and two halves are added beside it, so a seam three drivers read is widened without migrating any of them"
    - "A per-provider hook that returns undefined as a recorded decision rather than by omission, with the reason on each row"
    - "A ledger read that accounts for the row the write it is about to trigger will add, so an ending and the view it precedes answer one string"
    - "A test helper that lifts one field off a payload and asserts its presence, turning twelve existing exact-shape assertions into twelve assertions that the new field is carried"

key-files:
  created: []
  modified:
    - server/src/driver.ts
    - server/src/agent.ts
    - server/src/drivers/adapters.ts
    - server/src/drivers/api.ts
    - server/src/index.ts
    - server/test/api-driver.test.ts
    - server/test/usage.test.ts
    - web/src/lib/types.ts
    - web/src/lib/api.ts
    - web/src/pages/Lesson.tsx
    - web/src/pages/Home.tsx

key-decisions:
  - "`lessonCost` is exported from server/src/drivers/api.ts and imported by index.ts, not defined in index.ts: the loop needs it too and must not import a module that calls serve(), and cost.ts is pure by design (no SQL, no clock) with a 03-02 gate that says so"
  - "The ending's figure counts the blank `unknown` row `closeUsage` is about to write, because an ending's payload is built before `sink.endTurn` runs — without it a stop before the first response reported `estimated` while both screens said `not reported` a moment later"
  - "The owned loop's `turn_end` carries no per-turn `cost_usd` and none was invented for it: `cost_usd` is the Claude driver's field, and adding a per-turn figure beside the lesson total would be the exact number the plan's prohibition says must never be shown where a total is promised"
  - "The page keeps its own `cost` state and re-reads the lesson view when `busy` goes false, rather than reading the turn_end payload: useLesson.ts must stay byte-identical, so the reducer has no branch to carry the value — the plan's own §6 escape hatch"
  - "The figure is read on load even when a turn is already in flight, so opening a busy lesson shows what it has cost so far rather than nothing"
  - "`cacheHook` returns `Record<string, Record<string, JSONValue>>` rather than the plan's `Record<string, unknown>`, because that is what `SystemModelMessage.providerOptions` is typed as and the loose form does not compile under strict"

patterns-established:
  - "The stable prefix's byte stability is documented as load-bearing at the call site, so a later change that interpolates a timestamp or a lesson id into it reads as a regression rather than a tidy-up"
  - "Money inherits the surrounding grey: no accent class appears anywhere in the pill region, asserted by a script over the pill's own 1,200 characters"

requirements-completed: [COST-02, PROV-04]

coverage:
  - id: D1
    description: "The method text and the tool contract ship as a byte-stable first system message carrying Anthropic's cache breakpoint, with the material, library and profile uncached behind it"
    requirement: PROV-04
    verification:
      - kind: integration
        ref: "server/test/api-driver.test.ts#sends exactly two system messages, stable first, with the breakpoint only on the half that may be cached"
        status: pass
      - kind: integration
        ref: "server/test/api-driver.test.ts#attaches nothing on a provider that caches a prefix by itself"
        status: pass
      - kind: other
        ref: "grep -c instructionsStable over driver.ts / agent.ts / drivers/api.ts -> 2 / 3 / 2; grep -c cacheControl adapters.ts -> 1; grep -c toolOrder drivers/api.ts -> 2"
        status: pass
    human_judgment: false
  - id: D2
    description: "The prefix does not move between requests: identical across the two steps of one turn and across two turns of one lesson, while the tail carries the change"
    requirement: PROV-04
    verification:
      - kind: integration
        ref: "server/test/api-driver.test.ts#sends a byte-identical prefix on every request of a lesson"
        status: pass
    human_judgment: false
  - id: D3
    description: "Cache reads and cache writes land in their own ledger columns and input_tokens stays the uncached count, so the saving is visible from the first lesson and never double-counted"
    requirement: PROV-04
    verification:
      - kind: integration
        ref: "server/test/api-driver.test.ts#files a cache read and a cache write in their own columns, leaving input_tokens the uncached count"
        status: pass
      - kind: other
        ref: "grep -cE 'input_tokens: reported\\(u\\.inputTokenDetails\\?\\.noCacheTokens\\)' drivers/api.ts -> 1"
        status: pass
    human_judgment: false
  - id: D4
    description: "A real Anthropic lesson's second and later requests actually hit the cache"
    requirement: PROV-04
    verification: []
    human_judgment: true
    rationale: "The plan marks this truth `verification: backstop`. No Anthropic key exists in this environment, so what is proven is that the breakpoint and the byte-stable prefix are on the wire — not that Anthropic's cache returned a non-zero cache_read_tokens for them. Recorded in .planning/WINDOWS.md as an unrun verify."
  - id: D5
    description: "One server-computed string is the lesson's total, carried on the lesson view, on every row of GET /api/lessons, and on every ending of a turn, so the two screens can never disagree"
    requirement: COST-02
    verification:
      - kind: integration
        ref: "server/test/usage.test.ts#sums what the provider billed and says `billed` (asserts the view's string equals the list's for one lesson)"
        status: pass
      - kind: integration
        ref: "server/test/api-driver.test.ts#carries the sum over the lesson, not the cost of the turn that just ended"
        status: pass
      - kind: integration
        ref: "server/test/api-driver.test.ts#keeps a stop and the step cap continuable while the refusal is failed (lesson_cost on all three endings)"
        status: pass
      - kind: other
        ref: "the `ending()` helper asserts lesson_cost on every one of the 12 pre-existing exact-shape ending assertions; grep -c lessonCost index.ts -> 3; grep -c lesson_cost drivers/api.ts -> 9"
        status: pass
    human_judgment: false
  - id: D6
    description: "The figure is a lesson total and never one turn's cost_usd: neither page references lastCost, and the ending's value is the sum over the lesson rather than over the turn that produced it"
    requirement: COST-02
    verification:
      - kind: integration
        ref: "server/test/api-driver.test.ts#carries the sum over the lesson, not the cost of the turn that just ended (asserts whole.usd > thisTurn.usd)"
        status: pass
      - kind: other
        ref: "lastCost in code (comments stripped) -> 0 in both Lesson.tsx and Home.tsx"
        status: pass
    human_judgment: false
  - id: D7
    description: "The four label words are answered honestly over HTTP with no model, and a lesson with no usage rows answers null on both surfaces"
    requirement: COST-02
    verification:
      - kind: integration
        ref: "server/test/usage.test.ts#says nothing at all for a lesson that has not run yet"
        status: pass
      - kind: integration
        ref: "server/test/usage.test.ts#falls to `estimated` for a lesson that is part billed and part priced from the table"
        status: pass
      - kind: integration
        ref: "server/test/usage.test.ts#says `not billed` for a lesson taught entirely on a subscription"
        status: pass
      - kind: integration
        ref: "server/test/usage.test.ts#says `not reported` as soon as one request reported nothing"
        status: pass
      - kind: integration
        ref: "server/test/usage.test.ts#takes the weakest word even when the lesson is mostly metered"
        status: pass
    human_judgment: false
  - id: D8
    description: "The lesson header pill reads `provider · model · about $X.XX <label>` in the pill's own grey, with the model id taking the truncation and the cost never clipped; a lesson with no usage rows shows no third segment"
    requirement: COST-02
    verification:
      - kind: automated_ui
        ref: "headless Chrome over CDP at 375/640/1024/1280px: A1 populated reads `ANTHROPIC · CLAUDE-OPUS-5-5 · ABOUT $0.33 ESTIMATED`, cost colour rgb(141,132,119) identical to the pill's; A1 empty reads `CLAUDE CODE · DEFAULT MODEL` with one span; A1 overflow with a 63-char model id clips the model span (240px, clipped) and leaves the cost span unclipped (137px); at 375px the pill is display:none, the header stays 60px and nothing overflows"
        status: pass
      - kind: other
        ref: "pill markup ok / pill colour ok / tokens declared / 13 components / useLesson untouched / no ticking"
        status: pass
    human_judgment: false
  - id: D9
    description: "The Home row carries the identical string in the right-hand group before the locked count, nothing at all when the lesson has not run, and the numbers stay on one line while the topic absorbs the loss"
    requirement: COST-02
    verification:
      - kind: automated_ui
        ref: "headless Chrome over CDP at 640/1280px: the right-hand group's children read ['about $0.33 estimated', '2/3', delete] in that order; an unrun lesson's group holds only the delete button with no placeholder; both numbers share one baseline and one line height at both widths; no horizontal overflow"
        status: pass
      - kind: other
        ref: "home row ok (font-mono text-[11px] text-ink-400 whitespace-nowrap, not the 10.5px meta span inside the link)"
        status: pass
    human_judgment: false
  - id: D10
    description: "The figure settles at turn_end and never ticks: a turn in flight shows the previous settled total for the whole turn"
    verification:
      - kind: other
        ref: "no setInterval and no cost-related setTimeout in either page (comments stripped) -> 0; the only refetch triggers are mount and `busy` going false, and the value set is always a settled server string"
        status: pass
    human_judgment: true
    rationale: "That the number visibly holds still for the whole of a live turn needs a real metered provider to watch, and no key exists here. The mechanism is proven statically — there is no timer, no poll, and no mid-turn source of a new value — but the observation is owed. Recorded in .planning/WINDOWS.md as an unrun verify."

# Metrics
duration: 42 min
completed: 2026-10-12
status: complete
---

# Phase 03 Plan 08: The Lesson's Cost, Where the Lesson Is Summary

**One server-computed string — `about $0.33 estimated` — reaches the lesson header pill, the Home row and every ending of a turn from a single sum over the lesson's usage rows, and the method text now ships as a byte-stable first system message carrying Anthropic's cache breakpoint so that figure is smaller from the first lesson.**

## Performance

- **Duration:** ~42 min
- **Started:** 2026-10-12T19:35Z (base `d33f34e`)
- **Completed:** 2026-10-12T20:17Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- **D-06's cache split, additive.** `TurnContext` grew `instructionsStable` and `instructionsVolatile` beside the unchanged `instructions`, which is still exactly the two concatenated. `agent.ts` builds all three in the original order, so the Claude driver and the Codex driver receive a byte-identical string and neither file was edited. The split point is where it always was: `systemPrompt(web)` is the method text and the tool contract; the material, the library and the learner profile are everything that changes while a lesson runs.
- **The breakpoint is a per-row fact.** `Adapter.cacheHook` returns Anthropic's `{ anthropic: { cacheControl: { type: 'ephemeral' } } }` and `undefined` on the other four rows — explicitly, with a sentence each, so an empty hook reads as a decision. OpenAI and Gemini cache a prefix automatically and take no breakpoint, so the only thing Derive owes them is a prefix that does not move; a gateway and a learner's own endpoint front something unknowable from here. The stable half is Derive's own published method text with no learner data in it, which is what keeps T-03-54 at `accept`: the material and the profile are the second, uncached message.
- **The prefix is proven not to move.** The suite asserts the first system message is byte-identical across the two steps of one turn *and* across two turns of one lesson, while the tail carries the change. `toolOrder` stays pinned to registry order for the same reason, and the call site says in as many words that the byte stability is load-bearing rather than incidental — a later change that interpolates a timestamp or a lesson id into the prefix would turn every request into a cache miss and roughly double a lesson's cost.
- **The saving is visible in the ledger.** A stub reporting 9,400 total / 400 uncached / 8,000 cache-read / 1,000 cache-write input tokens writes 400 to `input_tokens` and the other two to their own columns — never the total, which would price a well-cached lesson at about twice what it actually cost.
- **One sum, three readers.** `lessonCost(lessonId)` reads `listUsage({ lesson })` (indexed) against `priceTable()` (cached for a second) and formats it with 03-02's `costLabel`, answering `null` for a lesson with no rows. `lessonView` and every row of `GET /api/lessons` call it, and `server/test/usage.test.ts` asserts the two endpoints return a **byte-identical** string for one lesson — the assertion that pins A1 and A2 together.
- **`lesson_cost` on every ending.** All seven `sink.endTurn` calls in the owned loop carry it: the success, the stopping/step-cap branch, the catch, the `finally`, the headroom refusal, the tool-displacement refusal and the exhausted-retry ending. `sinkFor`'s endTurn is idempotent and the first call's payload is the one that reaches the browser, so an ending that forgot it would leave a stale figure on the screen (T-03-52).
- **The ending counts the row it is about to cause.** `closeUsage` writes D-16's blank `unknown` row for a turn that reported nothing, and it runs *inside* `sink.endTurn` — after the payload has been built. Without `endingCost`, a stop before the provider's first response reported `about $0.40 estimated` on the ending while both screens said `not reported` a moment later. The suite caught this on the first run; counting the pending row is what keeps the ending and the views on one string.
- **Four honest words in the pill, one string on the Home row.** The header pill is still one `<Link to="/settings">`; the provider-and-model span gained `min-w-0` so truncation actually absorbs the loss, and the cost rides behind a `text-ink-600` separator in a `shrink-0 whitespace-nowrap` span that inherits the pill's `text-ink-400`. Home renders `font-mono text-[11px] text-ink-400 whitespace-nowrap` in the existing right-hand group, before the locked count and outside the clickable topic. No new component (still 13), no new colour token, no accent on the money, no timer, no poll, no new event type, and `web/src/lib/useLesson.ts` is byte-identical.
- **Ten new cases, 391 passing.** Four on the cache split, two on the lesson total, six over the HTTP surface with no model covering all four label words, the empty lesson and the two-surface byte-identity. The twelve pre-existing exact-shape ending assertions now run through an `ending()` helper that lifts `lesson_cost` off and asserts it is there — so every ending in the suite, not only the new cases, now proves the field is carried.

## Task Commits

1. **Task 1: the stable prefix carries the cache breakpoint; the volatile tail follows it** — `bfaa5b3` (feat)
2. **Task 2: the lesson total, computed server-side and carried on both views and on `turn_end`** — `4f3b1e4` (feat)
3. **Task 3: the cost segment in the pill and the string on the Home row** — `598a45b` (feat)

**Plan metadata:** this file (docs: complete plan)

## Files Created/Modified

- `server/src/driver.ts` — `TurnContext.instructionsStable` and `.instructionsVolatile`, and a doc comment on `instructions` recording that it is the two concatenated and why that makes the change additive rather than a migration of three drivers.
- `server/src/agent.ts` — the three consts, concatenation order unchanged, all three on `ctx`.
- `server/src/drivers/adapters.ts` — `Adapter.cacheHook`, Anthropic's breakpoint, and four explicit `() => undefined` rows each with its reason.
- `server/src/drivers/api.ts` — `lessonCost(lessonId, extra?)`, the `UNREPORTED` row, `endingCost(ctx)`, `cacheOptions` resolved once per turn, the two-entry `instructions` with the load-bearing-stability comment, and `lesson_cost` on all seven endings.
- `server/src/index.ts` — `lessonCost` imported; `cost` on `lessonView` and on every `GET /api/lessons` row.
- `server/test/api-driver.test.ts` — the `ending()` helper; three existing system-message assertions updated to the two-entry shape; a new `describe` for the cache split (4 cases) and one for the lesson total (2 cases); `lesson_cost` asserted on the stop, the cap and the refusal.
- `server/test/usage.test.ts` — a new spawned-server `describe` with 6 cases over both HTTP surfaces, writing usage rows straight into the running server's ledger because five label outcomes need five cost sources and a provider that bills cannot be impersonated without a key.
- `web/src/lib/types.ts` — `cost: string | null` on `LessonSummary` and on a new named `LessonView`.
- `web/src/lib/api.ts` — `api.lesson` returns `LessonView` instead of an inline shape; two imports that the move made unused were dropped.
- `web/src/pages/Lesson.tsx` — the cost segment, `min-w-0` on the model span, the narrow-viewport comment, and the page-local `cost` state read on load and when the turn settles.
- `web/src/pages/Home.tsx` — one span in the right-hand group, before the locked count.

## Decisions Made

- **`lessonCost` lives in `server/src/drivers/api.ts` and `index.ts` imports it.** The plan asked for both "a `const lessonCost` beside `lessonView`" and "export the helper from a module both `index.ts` and the driver can import without a cycle (… a small exported function in the driver's own module …)". Those cannot both be literal. The shared placement wins: `cost.ts` is pure by design and carries a 03-02 gate asserting it imports `db.ts` as types only, and `index.ts` calls `serve()` at module scope so no driver may import it. `index.ts` already imports `./drivers/adapters.js` and already reaches `drivers/api.js` through `agent.ts`, so nothing new was pulled in and the graph stays acyclic. The `grep -c lessonCost index.ts >= 3` gate passes on the import plus the two call sites.
- **The ending's figure counts the blank row that `endTurn` is about to write.** See Deviations — this is the one behavioural correction the suite forced.
- **No per-turn `cost_usd` was added to the owned loop's `turn_end`.** The plan's wording ("beside the existing `cost_usd`") presupposes a field the Claude driver has and this loop never had. Inventing one would have put the exact number the plan's own prohibition forbids rendering right next to the total that replaces it, for no reader. The separation the prohibition asks for is recorded in the code comment beside `lesson_cost` instead, and the suite proves the value is a lesson sum rather than a turn sum (`whole.usd > thisTurn.usd`).
- **The page re-reads the lesson view when the turn settles, rather than reading `turn_end.payload.lesson_cost`.** `useLesson.ts` must stay byte-identical (Hard Prohibition 1, gated by `git diff --quiet`), and the hook neither threads `cost` through `init` nor keeps the `turn_end` payload — so there is no way for the page to see the field without a reducer change. The plan's §6 names this exact fallback: "carry it in the page from the two sources it already has". `busy` going false *is* `turn_end`, so the behaviour the contract asks for is unchanged: seeded on load, replaced once when the turn ends, no timer and no poll. `lesson_cost` on the wire is still what the terminal drivers, the MCP surface and Phase 4's usage page will read, and what the suite asserts.
- **The figure is read on load even while a turn is in flight.** First written as "fetch only when settled", which meant opening a busy lesson showed no cost at all until the turn ended, even though the server already knew it. Dropping that guard costs one extra indexed read at turn start and returns the same settled number, so the figure still never moves mid-turn.
- **`cacheHook`'s return type is `Record<string, Record<string, JSONValue>>`.** The plan wrote `Record<string, unknown>`, which does not assign to `SystemModelMessage.providerOptions` (`ProviderOptions`) under `strict`. The narrower type is the same shape `Adapter.providerOptions` already uses one line above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] An ending reported a firmer figure than the views would a moment later**

- **Found during:** Task 2
- **Issue:** `sinkFor.endTurn` calls `db.ts`'s `closeUsage` — D-16's rule that a turn which reported nothing still leaves a row of nulls and `unknown` — and it calls it *inside* the ending, after the caller has already built the payload. So a turn that made no request (a stop before the provider answered, the headroom refusal, the tool-displacement refusal, an exhausted retry) computed its `lesson_cost` one row short. On a lesson that had already cost $0.40 the ending read `about $0.40 estimated` while both screens read `not reported` seconds later: exactly the divergence T-03-51 and T-03-52 exist to prevent. The suite caught it on the stop branch.
- **Fix:** `lessonCost` takes an optional `extra` row list, and `endingCost(ctx)` passes the blank `UNREPORTED` row when `listUsage({ turn: ctx.turnId })` is empty — the ledger as it will read once this turn's own row exists. `UNREPORTED` is built field by field rather than cast, the way `adapters.ts` builds its own `CostRow`.
- **Files modified:** `server/src/drivers/api.ts`
- **Verification:** `server/test/api-driver.test.ts#keeps a stop and the step cap continuable while the refusal is failed` asserts each of the three endings equals `lessonCost(lesson)`; it failed with `null !== 'not reported'` before the fix and passes after.
- **Committed in:** `4f3b1e4`

**2. [Rule 1 - Bug] Three of the plan's `<verify>` greps could not pass against the code they were written for**

- **Found during:** Tasks 1 and 3
- **Issue:** (a) `grep -c "inputTokenDetails.noCacheTokens" server/src/drivers/api.ts` returns **0**: the mapping 03-01 wrote is `u.inputTokenDetails?.noCacheTokens`, and the optional chain puts two characters where the gate's `.` matches one. The gate was already unsatisfiable before this plan touched the file. (b) `! grep -nE "lastCost" web/src/pages/Lesson.tsx web/src/pages/Home.tsx` fails on the doc comment that explains *why* `state.lastCost` must not be wired into the pill — the sibling gate in the same `<verify>` block strips comments before grepping for exactly this reason, and Task 1's `allowSystemInMessages` gate says so outright ("an explanatory comment in the source cannot trip it; only real code can"). (c) `assert.deepEqual` on twelve existing `turn_end` payloads could not survive a new field by construction.
- **Fix:** (a) asserted the gate's intent instead — `grep -cE 'input_tokens: reported\(u\.inputTokenDetails\?\.noCacheTokens\)'` → **1** — with no change to the code, which already does the right thing. (b) ran the `lastCost` gate in the plan's own comment-stripping form: **0** in both pages; the identifier survives only in the comment that warns against it, which is load-bearing documentation. (c) added an `ending()` helper that lifts `lesson_cost` off and asserts it is present, which turns all twelve into assertions that the new field is carried rather than weakening any of them.
- **Files modified:** `server/test/api-driver.test.ts` (the helper); none for (a) or (b)
- **Verification:** every gate in all three `<verify>` blocks runs clean; see Self-Check.
- **Committed in:** `bfaa5b3`, `4f3b1e4`

**3. [Rule 3 - Blocking] `api.lesson`'s inline return shape had to become a named type**

- **Found during:** Task 2
- **Issue:** The plan's gate requires `cost: string | null` twice in `web/src/lib/types.ts`, and its artifacts table names `LessonView.cost` as a member of that file — but the lesson-view shape was an inline object literal inside `web/src/lib/api.ts`, so there was no type in `types.ts` to add the field to.
- **Fix:** The shape moved to `types.ts` as `export type LessonView`, with `cost` and a doc comment on `tutor`; `api.ts` now reads `j<LessonView>(r)`. Two imports the move left unused (`NodeRow`, `StoredEvent`) were dropped, which `noUnusedLocals` makes fatal in the web build.
- **Files modified:** `web/src/lib/types.ts`, `web/src/lib/api.ts`
- **Verification:** `grep -c "cost: string | null" web/src/lib/types.ts` → **2**; `pnpm --filter web build` exits 0.
- **Committed in:** `4f3b1e4`

---

**Total deviations:** 3 auto-fixed (1 real correctness bug in the ordering of the ledger read, 1 class of unsatisfiable gate, 1 blocking type move)
**Impact on plan:** No task's `<done>` was weakened and nothing was added beyond the plan's `files_modified`. The first deviation is the plan's own threat register enforced rather than asserted; the second is the 03-07 pattern repeating (a grep written against code that uses optional chaining, and a gate the plan forgot to comment-strip); the third is a two-line move the plan's own artifacts table implies.

## Issues Encountered

- **The `turn_end` payload could not be read by the page.** `useLesson.ts` is gated byte-identical, and it neither threads the view's `cost` through `init` nor retains the `turn_end` payload, so the field the plan put on the wire is invisible to the component that renders it. Resolved through the plan's own §6 fallback rather than by adding a reducer branch; the observable behaviour (seeded on load, replaced once when the turn ends, never ticking) is what the contract asked for, and the wire field still serves the terminal drivers and Phase 4.
- **An honest consequence worth knowing about, not a defect.** Every lesson created through `POST /api/lessons` opens a probe turn, and any turn that reports nothing leaves an `unknown` row. `weakestSource` makes `unknown` win, so a lesson whose first turn ran on a login — or failed before reporting — reads `not reported` for the rest of its life even after metered turns. That is 03-02's deliberate rule ("`unknown` as soon as any row is `unknown`", and an unreported source never carries money) and it is the honest answer, since part of such a lesson's total genuinely is not known. It is recorded here because it will look like a bug to whoever first sees `not reported` on a lesson they know cost money.
- **A long Home topic wraps rather than ellipsises.** The topic `<Link>` is `flex flex-wrap`, so at 640px a 118-character topic takes two or three lines while the numbers stay on one. The contract's requirement — the numbers hold one line and the topic is the only thing that gives way — is met; that it gives way by wrapping rather than truncating is pre-existing Home behaviour this plan did not introduce or change.

## Known Stubs

None. No `TODO`, `FIXME`, `XXX`, `HACK`, "coming soon" or "not available" appears on any line this plan added; the single grep hit is a comment stating that the empty Home slot renders *no* placeholder.

## Threat Flags

None. This plan opens no endpoint, adds no auth path and changes no schema; the two trust boundaries it crosses (usage rows becoming a money claim, and the method text entering a provider's cache) are T-03-51 through T-03-57 in the plan's own register, and each is mitigated or accepted as that register specifies.

## User Setup Required

None — no external service configuration is required. A learner who wants to correct a rate still writes `~/.derive/prices.json` by hand (03-02); Derive never creates it.

## Next Phase Readiness

- **Ready for 03-09** (the settings cards and the prices-file error route). Nothing 03-09 reads has moved: `pricesFileError()` is untouched, the catalogue and the adapter table gained one optional member each, and the four surface keys of `wire-surface.json` are byte-unchanged.
- **Ready for Phase 4's usage page.** The lesson total is one exported function over the ledger, so a running total by provider, model and lesson is a different aggregation of the same rows rather than a second copy of the arithmetic. Deliberately *not* built here: no aggregate appears anywhere on Home, and the zero-lessons section is untouched.
- **Two unrun checks, both recorded in `.planning/WINDOWS.md`.** No provider key exists in this environment, so two things are proven on the wire and not against a provider: that Anthropic's cache actually returns a non-zero `cache_read_tokens` for the marked prefix (the plan's `backstop` truth), and that the figure visibly holds still for the whole of a live metered turn. The second is proven statically — no timer, no poll, and no mid-turn source of a new value — but the observation is owed.
- **One dated obligation carried forward from 03-02, unchanged:** Google's Gemini rates in `PRICES` are promotional through 2026-12-31 and double on 2027-01-01. `PRICES_AS_OF` says so; nothing automated will notice. This is why COST-04 stays open — 03-09 also declares it.

## Self-Check: PASSED

- **Files claimed modified** — all eleven **FOUND** on disk; nothing created and nothing deleted (`git diff --diff-filter=D` empty on all three commits).
- **Commits** `bfaa5b3`, `4f3b1e4`, `598a45b` — all three **FOUND** in `git log`. `git rev-list --count d33f34e373a32cd1b86094b78b2eca3e0db3c3f0..HEAD` read **3** at the moment this file was written, which is `actuals.commits`, and `git rev-parse bfaa5b3^` → `d33f34e`, matching `plan_head_before`. Re-running that count later reads more than 3, by design: the close-out commits (this file, then STATE/ROADMAP) can only land after the figure is written. `git log --oneline d33f34e..HEAD --grep '03-08'` → **3** is the form that reproduces; the same convention is recorded in 03-04 through 03-07.
- **Whole-tree gate** — `pnpm method:check` → `method: 6 rendered copies match method/`; `pnpm typecheck` clean in both packages; `pnpm build` exit 0; `pnpm test` → **391 tests, 391 pass, 0 fail** (up from 379 at the dispatch base: 6 new `api-driver` cases and 6 new `usage` cases); `pnpm --filter web build` exit 0.
- **Task 1 gates** — `instructionsStable` → 2 / 3 / 2 in `driver.ts` / `agent.ts` / `drivers/api.ts`; `cacheControl` in `adapters.ts` → 1; `toolOrder` in `drivers/api.ts` → 2; `allowSystemInMessages` in code (comments stripped) → **0**; the `noCacheTokens` mapping asserted in its real optional-chain form → 1; `test/api-driver.test.ts` → **43 pass, 0 fail**; `test/driver.test.ts` passes unchanged, proving the Claude driver's `ctx.instructions` did not move.
- **Task 2 gates** — `lessonCost` in `index.ts` → **3** (the import plus both call sites); `lesson_cost` in `drivers/api.ts` → **9** (seven endings plus the helper's doc comment), against a floor of 4; `git diff --quiet -- web/src/lib/useLesson.ts` → clean; `lastCost` in both pages with comments stripped → **0**; `cost: string | null` in `web/src/lib/types.ts` → **2**; `test/usage.test.ts` → **15 pass, 0 fail**.
- **Task 3 gates** — `pill markup ok`, `pill colour ok`, `tokens declared`, `home row ok` all printed; `ls web/src/components/*.tsx | wc -l` → **13**; no `setInterval` and no cost-related `setTimeout` in either page with comments stripped → 0.
- **Human-check states observed in headless Chrome** (scratch server on a free port, a scratch data dir, usage rows seeded directly, four viewport widths): **A1 populated** `ANTHROPIC · CLAUDE-OPUS-5-5 · ABOUT $0.33 ESTIMATED` with the cost span's colour `rgb(141, 132, 119)` byte-equal to the pill's own and no accent class anywhere in the region; **A1 empty** `CLAUDE CODE · DEFAULT MODEL`, one span, no third segment and no `not reported`; **A1 overflow** with a 63-character `openai-compatible` model id at 1024px and 1280px — the model span is clipped at 240px and the 137px cost span is not, the pill stays inside the header, the header stays 60px and there is no horizontal overflow; **375px** the pill is `display: none`, header 60px, nothing overflows; **A2 populated and empty** the right-hand group reads `['about $0.33 estimated', '2/3', delete]` in that order and an unrun lesson's group holds only the delete button with no gap artefact; **A2 overflow** at 640px and 1280px both numbers share one baseline and one line height while the topic takes the loss; **A1/A2 agreement** `GET /api/lessons/:id` and `GET /api/lessons` returned the identical string for every seeded lesson; **A1 partial** a lesson with one `subscription` row and one `table` row reads `about $0.22 estimated`, not `not billed`. The two states that need a real metered provider — the cache actually being hit, and the figure holding still through a live turn — are recorded in `.planning/WINDOWS.md` as unrun.
- **Key links** — `index.ts` → `cost.ts` via `drivers/api.ts`'s `costOf(`/`costLabel(`; `drivers/api.ts` → `cost.ts` with `lesson_cost` on every ending; `Lesson.tsx` reads the seeded view value and the settled replacement with no reducer change; `agent.ts` → `prompt.ts` via `systemPrompt(` as the stable prefix.
- **Scratch cleanup** — the scratch server and every headless Chrome instance this run started are stopped; `git status --short` shows no file this plan did not intend, and the four pre-existing untracked paths from the dispatch base were left alone.

---
*Phase: 03-owned-loop-api-keys-and-gateways*
*Completed: 2026-10-12*
