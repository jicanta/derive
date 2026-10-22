---
phase: 04-local-models-parity-proof-and-usage
plan: 05
subsystem: ui
tags: [usage, cost, hono, react, sqlite, providers, local-models]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: the usage ledger (one row per model request, denormalised lesson/learner/driver/model, four cost_source values) and the usage_learner (learner_id, ts) index
  - phase: 03-owned-loop-api-keys-and-gateways
    provides: cost.ts — weakestSource, costOf and costLabel, the four-word label vocabulary and the under-half-a-cent boundary; lessonCost as the shape this aggregate mirrors
  - phase: 04-local-models-parity-proof-and-usage
    provides: "local rows reporting cost_source 'subscription' when a request reported counts and 'unknown' when it reported none (plan 04-01), so a local Usage line is tokens-only rather than a fifth cost_source"
provides:
  - "server/src/usage.ts — the learner's running total from one indexed read, grouped by provider then model then lesson"
  - "GET /api/usage, scoped to learnerOf(c) and to nothing the request carried of its own"
  - "every figure and every label word on the wire as a composed string: counts, nouns and money included, so the browser formats no number"
  - "the Usage page (web/src/pages/Usage.tsx), reached from Settings and nowhere else, with the grand total as its one Display-size gold figure"
  - "the /usage route and the one link in from Settings"
  - "nine cases over HTTP covering the six COST-03 boundaries plus zero-one-many and the cross-learner scope"
affects: [05-learning-experience, 06-personalization, 07-adoption]

# Actuals (#2632) — same estimateTokens scale (chars/4) as the plan's estimate.
# Instrument, named so a later calibration compares like with like: chars/4 over
# `git diff 9511a8b..HEAD -- server/src server/test web/src` (39,520 chars).
# NOT a harness token count.
actuals:
  tokens: 9880
  tasks: 2
  commits: 3
plan_head_before: 9511a8b9f7fcd3ee5ad5ac3af79084a587593c67

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "a page-shaped aggregate gets its own module beside cost.ts and drivers/api.ts, not a fourth home inside index.ts"
    - "the server composes whole lines — counts, nouns and money — and the page prints them"

key-files:
  created:
    - server/src/usage.ts
    - web/src/pages/Usage.tsx
  modified:
    - server/src/index.ts
    - server/test/usage.test.ts
    - web/src/lib/types.ts
    - web/src/lib/api.ts
    - web/src/main.tsx
    - web/src/pages/Settings.tsx

key-decisions:
  - "The learner-total aggregate lives in its own server/src/usage.ts rather than extending drivers/api.ts: cost.ts is pure by design and index.ts starts a server, so a page-shaped read needs a third place — and keeping it out of the turn loop's file also kept this plan's files disjoint from 04-04's"
  - "GET /api/usage answers fully composed line strings, counts and nouns included, and never a number for display, so the Usage page and the lesson header cannot fork the four-word vocabulary cost.ts fixes"
  - "A Usage line carries its token count only where it carries no money; a set of rows that reported nothing carries null rather than a zero; reasoning_tokens are excluded from every sum because adapters report them as a component of the output count"
  - "Groups, models and lessons are ordered by most recent activity, so what a learner just ran is at the top; no pagination at this scale"
  - "The one way in is a textButton link on Settings rather than LearnerMenu's 13px nav-link shape, because copying that shape would have introduced a fifth type size against the UI-SPEC's four"

patterns-established:
  - "Composed-line payloads: where a UI contract fixes copy, the server returns the rendered sentence and the client formats nothing — the only numbers on the wire are the counts a test asserts against"
  - "Null-never-zero on the read side: a sum over rows that reported nothing answers null, matching recordUsage's discipline on the write side"

requirements-completed: [COST-03]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "server/src/usage.ts groups the learner's ledger into provider → model → lesson from one indexed read, with every figure and label word produced by costOf/costLabel and the provider word by labelOf"
    requirement: "COST-03"
    verification:
      - kind: integration
        ref: "server/test/usage.test.ts#reports a count of one for a learner with one lesson, so the singular nouns are the server's"
        status: pass
      - kind: integration
        ref: "server/test/usage.test.ts#takes the weakest label for a lesson that is part priced and part subscription"
        status: pass
      - kind: other
        ref: "sed -E 's;//.*$;;' server/src/usage.ts | grep -c 'costLabel' >= 1 && grep -c 'labelOf' >= 1"
        status: pass
    human_judgment: false
  - id: D2
    description: "Subscription and local lines carry tokens and `not billed` with no money figure; an uncounted request reads `not reported`; a sub-cent total reads `under $0.01`; `$0.00` appears nowhere in the payload or the page"
    requirement: "COST-03"
    verification:
      - kind: integration
        ref: "server/test/usage.test.ts#shows tokens and `not billed` for a lesson taught entirely on a subscription, and no figure"
        status: pass
      - kind: integration
        ref: "server/test/usage.test.ts#says `not reported` for a request nobody counted, and never a $0.00"
        status: pass
      - kind: integration
        ref: "server/test/usage.test.ts#reads `under $0.01` for a total below half a cent rather than rounding it away"
        status: pass
    human_judgment: false
  - id: D3
    description: "A local line names its own server — `lm studio`, `llama.cpp`, `ollama` — never the raw catalogue id and never `ollama` for a non-Ollama local lesson; a llama.cpp model id goes through verbatim, path and all"
    requirement: "COST-03"
    verification:
      - kind: integration
        ref: "server/test/usage.test.ts#names a local provider by its own word, so LM Studio and llama.cpp are never read as Ollama"
        status: pass
    human_judgment: false
  - id: D4
    description: "GET /api/usage is scoped to the learner the server resolved: one learner never sees another's rows, and a body naming another learner changes nothing (T-04-07)"
    requirement: "COST-03"
    verification:
      - kind: integration
        ref: "server/test/usage.test.ts#answers the resolved learner's rows and nobody else's"
        status: pass
    human_judgment: false
  - id: D5
    description: "The browser formats no number: neither server/src/usage.ts nor web/src/pages/Usage.tsx contains toFixed, Intl.NumberFormat or a process.env read, and no `$` is composed in the page"
    requirement: "COST-03"
    verification:
      - kind: other
        ref: "for f in server/src/usage.ts web/src/pages/Usage.tsx; do test -f $f && grep -cE 'toFixed|Intl.NumberFormat|process.env' (comments stripped) = 0; done"
        status: pass
    human_judgment: false
  - id: D6
    description: "Zero-one-many is driven by the payload: no rows gives a null total and an empty group list, one row gives counts of 1 and both nouns singular (`across 1 lesson · 1 token`)"
    requirement: "COST-03"
    verification:
      - kind: integration
        ref: "server/test/usage.test.ts#says nothing at all for a learner who has not run a lesson"
        status: pass
      - kind: integration
        ref: "server/test/usage.test.ts#writes both nouns in the singular for a learner whose one request reported one token"
        status: pass
    human_judgment: false
  - id: D7
    description: "The page is reachable only from Settings: /usage is routed exactly once and Settings carries exactly one link to it; nothing in the default UI links there"
    requirement: "COST-03"
    verification:
      - kind: other
        ref: "grep -c 'path=\"/usage\"' web/src/main.tsx = 1 && grep -c '/usage' web/src/pages/Settings.tsx = 1"
        status: pass
    human_judgment: false
  - id: D8
    description: "The nine UI states the approved UI-SPEC judges this page on — empty, in flight, failed, populated, partial, overflow, zero-one-many, and the header and grand total at 375px (E4 seven rows, E5 two rows)"
    verification:
      - kind: other
        ref: "grep gates: 'Nothing spent yet', the empty body verbatim, role=\"status\", motion-reduce:animate-none, max-w-[760px], scroll-thin, truncate >= 2 — all pass; type-size and spacing-utility audit: 4 sizes, 1 weight, no utility absent from Settings.tsx"
        status: pass
    human_judgment: true
    rationale: "The source gates prove the ingredients are present; whether the em phrase truncates before the figure at 375px, whether the group stack reads as one thing, and whether the grand total keeps its column are judgments only a browser at that width can settle. Carried as the plan's <human-check> UAT for ROADMAP Success Criterion 5."
  - id: D9
    description: "A local lesson's line shows tokens rather than `not reported` — i.e. LM Studio and llama.cpp report a usage object on the streaming path (research assumption A2)"
    verification: []
    human_judgment: true
    rationale: "Unverifiable on this machine: no local server is installed, and the only honest proof is a live lesson on one. If they do not report, the line reads `not reported`, which the UI-SPEC covers and which never renders as $0.00 — an honest degradation, not a defect. Recorded in .planning/WINDOWS.md as an open unrun-verify item."

# Metrics
duration: 21 min
completed: 2026-10-22
status: complete
---

# Phase 4 Plan 5: The Usage Page Summary

**A running total for this learner by provider, model and lesson, from one indexed read, with every money string and label word produced server-side by `costLabel` and tokens-only lines wherever there is no money.**

## Performance

- **Duration:** 21 min
- **Started:** 2026-10-22T22:01:00Z
- **Completed:** 2026-10-22T22:22:00Z
- **Tasks:** 2
- **Files modified:** 8 (2 created, 6 modified)

## Accomplishments

- **The missing half of "what learning has cost."** Phase 3 put a per-lesson figure in the lesson header; this answers the question across every provider on one page, so a learner can decide which provider to learn on without opening eleven lessons.
- **No migration, no new table, no new formatter.** `usage_learner (learner_id, ts)` already indexed the only filter, the row already carried `driver` / `model` / `lesson_id` / `cost_source` denormalised, and `costOf` / `costLabel` / `weakestSource` already produced every string the approved UI-SPEC locks. The whole plan is one new read module, one route, one page.
- **The browser formats nothing.** `/api/usage` returns composed lines — money, counts and nouns — because a second formatter in the browser is how two screens start disagreeing about one lesson. Asserted by a source gate as well as by the tests.
- **Honest blanks all the way through.** A set of rows that reported nothing sums to `null`, not `0`; a sub-cent total reads `under $0.01`; an uncounted request reads `not reported`; and `$0.00` appears nowhere in the payload or the page.
- **A local line names its own server.** `lmstudio` reads `lm studio` and `llamacpp` reads `llama.cpp` through `labelOf`, so non-Ollama local usage is never mislabelled as the one local provider everybody has heard of — and a llama.cpp model id that is a file path truncates with the whole value in `title`.
- **One learner's spending is invisible from another's page.** The read is scoped to `learnerOf(c)` and to nothing the request carried of its own, mirroring `recordUsage`'s write-side rule (T-04-07).

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer): end-to-end "what learning has cost" — the grouped total, server-formatted, on a page reached from Settings** — `3501714` (feat)
2. **Task 2: the nine states the page is judged on** — `694c920` (feat)

**Plan metadata:** see the `docs(04-05)` commit that carries this file.

## Files Created/Modified

- `server/src/usage.ts` — **new.** `learnerUsage(learnerId)`: one `listUsage({ learner })` read, grouped by `providerOfDriver` → `model` → `lesson_id`, every figure through `costOf`/`costLabel` and every provider word through `labelOf`. Carries the composed line for each level plus the counts a test asserts against. Opens with a prose header saying why it is not in `cost.ts` (pure by design) and not in `index.ts` (starts a server).
- `server/src/index.ts` — **modified.** `GET /api/usage` under a new `// ---------- what learning has cost ----------` section, scoped to `learnerOf(c)`, errors as `{ error: safeMessage(e) }`.
- `server/test/usage.test.ts` — **modified.** A ninth describe block: a spawned server, a learner per case, rows written straight into the ledger, and nine assertions over HTTP. Includes a `node:http` helper because `fetch` refuses to send a body on a GET and the scope assertion needs one sent.
- `web/src/lib/types.ts` — **modified.** `UsageView` / `UsageGroup` / `UsageModel` / `UsageLesson`, with a note that every money and label string arrives formatted.
- `web/src/lib/api.ts` — **modified.** One key, `usage()`.
- `web/src/pages/Usage.tsx` — **new.** `UsagePage`: the Settings header shape with a back link to `/settings`, the grand total as the page's one Display-size serif gold figure (`shrink-0`, so the summary line beside it truncates first), then provider sections with model lines and lesson lines, every line truncating with the full text in `title`, inside the `max-w-[760px]` / `.scroll-thin` shell.
- `web/src/main.tsx` — **modified.** `<Route path="/usage" element={<UsagePage />} />`.
- `web/src/pages/Settings.tsx` — **modified.** One `textButton` link to `/usage`, beside the sentence about where the figures come from.

## Decisions Made

- **A third home for the aggregate.** `server/src/usage.ts` rather than extending `drivers/api.ts`. `cost.ts` is pure by design (no SQL, no clock, every case readable from literals) and `index.ts` starts a server, so `lessonCost` already needed a third place; a page-shaped read needs the same one. `04-PATTERNS.md` carries the dated re-decision note; this plan followed it, which also kept its files disjoint from 04-04's.
- **The server composes whole lines.** `{n} lesson(s)` and `{tokens} tokens` are numbers, and a browser that pluralises is a browser that has started composing copy. So the payload carries the rendered sentence and the counts side by side: the page prints the sentence, and the counts exist so the empty and singular cases are assertable from the server rather than inferred in the browser.
- **The tokens segment appears only where there is no money.** A priced line already says what it cost; the raw counts beside the figure are noise. A subscription or local line has no figure at all, and the token count is the only thing it can honestly report — which is exactly the Copywriting Contract's two tokens-only line shapes.
- **`reasoning_tokens` are excluded from every sum.** Every adapter reports them as a component of the output count, so adding them would charge a learner's eye for the same tokens twice. Documented at the helper.
- **Ordering is by recency, not by size.** Groups, models and lessons are sorted by their latest `ts`, so what a learner just ran is at the top. No pagination, which the UI-SPEC's zero-one-many row also assumes.
- **The in-flight line is teal through `resultLine`.** That is the shipped in-flight readout shape (`ProviderRow.tsx:640`, the `running one node and a graded quiz` line) and the UI-SPEC's §Color in-flight tone, rather than a new mono class of this page's own.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Contract fidelity] The Settings link uses `textButton`, not LearnerMenu's nav-link shape**

- **Found during:** Task 1 (the one link in from Settings)
- **Issue:** The plan asked for the link "in `LearnerMenu`'s nav-link shape". That shape is `text-[13px]` (`LearnerMenu.tsx:191`), which is a fifth type size. The approved UI-SPEC's §Typography is explicit — "Exactly four sizes, two weights" — and 13px is not one of them. Copying the shape would have broken a locked contract on the page that contract was written for.
- **Fix:** The link is a `textButton`-composed `<Link to="/usage">` reading `usage · what learning has cost`, placed beside the sentence about where the price figures come from, which is thematically where a learner is already thinking about cost. `textButton` is the Settings page's own quiet-action idiom and carries the project-wide 32px hit area.
- **Files modified:** `web/src/pages/Settings.tsx`
- **Verification:** `grep -c '/usage' web/src/pages/Settings.tsx` = 1; the Usage page and the Settings link together use exactly four type sizes (10px, 14px, 22px, 2.1rem) and one weight.
- **Committed in:** `3501714` (Task 1 commit)

**2. [Rule 2 - Contract fidelity] The grand total sits in the body, not in the header bar**

- **Found during:** Task 2 (the header and the grand total at 375px)
- **Issue:** UI-SPEC row E5 reads "the `Usage · what learning has cost` header and the grand total stay on one line at 375px; the serif em phrase truncates before the total does", which can be read as putting the Display-size figure inside the 60px header bar alongside the 22px `h1` and the LearnerMenu. At 375px that leaves the figure competing with two other elements for ~200px.
- **Fix:** The header is the Settings header verbatim (back link, truncating serif `h1`, LearnerMenu) and the grand total is the first body block, in a row with the summary line: the figure is `shrink-0 truncate` and the summary is `min-w-0 truncate`. Both requirements hold — each stays on one line, the em phrase (at the tail of the truncating `h1`) goes first, and nothing can push the figure off-screen because it never shrinks.
- **Files modified:** `web/src/pages/Usage.tsx`
- **Verification:** `truncate` on the `h1`, the total and the summary; `shrink-0` on the total; type-size and spacing audits pass. The 375px rendering itself is carried as the plan's `<human-check>` UAT (coverage D8).
- **Committed in:** `3501714`, refined in `694c920`

---

**Total deviations:** 2 auto-fixed (both contract fidelity — a plan instruction that would have broken the approved UI-SPEC, resolved in the UI-SPEC's favour)
**Impact on plan:** No scope change. Both are the UI-SPEC taking precedence over a plan sentence that predated the conflict; everything the plan asked the page to show, it shows.

## Flagged Assumptions Carried Forward

- **FA-05 (COST-03), from the plan.** The deterministic edge probe left COST-03 `unclassified`, so the planner recorded an assumption rather than authoring truths: the boundary cases that matter are no rows, exactly one row, an all-`subscription` lesson, a lesson mixing `table` and `subscription`, a row with null counts, and a total under half a cent. All six are now asserted over HTTP, plus a seventh this plan added (both nouns singular at one) and the cross-learner scope case. If a verifier finds another, that is a gap in the assumption, not in the requirement.
- **Research assumption A2, carried and now recorded.** Whether LM Studio and llama.cpp report a `usage` object on the **streaming** path was never exercised — only the non-streaming case is verified, and this machine has no local server. If they do not, a local Usage line reads `not reported` instead of tokens: an honest degradation the UI-SPEC covers and which never renders as `$0.00`. Appended to `.planning/WINDOWS.md` as an open `unrun-verify` item and carried as coverage D9.

## Known Stubs

None. Nothing on this page renders a placeholder, a hardcoded empty value or a "coming soon": the empty state is the approved copy, the in-flight state is one line, and the failed state is the server's own sentence with a retry.

## Issues Encountered

- **A GET cannot carry a body through `fetch`.** The T-04-07 assertion is that a body naming another learner changes nothing, and undici refuses to send a body on a GET — a request that was never sent asserts nothing. Resolved with a small `node:http` helper in the test, with a comment saying why it exists.
- **Apostrophes in test names.** Three new test names and one topic string contain an apostrophe; they are written with double quotes, following the convention already in `server/src/providers.ts`'s `note` fields, rather than escaped inside single quotes.

## Threat Flags

None. This plan adds one read-only route behind the existing per-install token and session-cookie middleware, writes nothing to the ledger, and introduces no new trust boundary beyond the one the threat model already registers. T-04-07's `mitigate` disposition is implemented (`learnerUsage(learnerOf(c))`) and asserted.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Phase 4 is complete.** All five plans have summaries. The three local providers teach through the owned loop (04-01), capability is read before a session is invested (04-02), any row can be proved with one node and one graded quiz (04-03), the conformance harness measures every configured provider against the method (04-04), and what learning has cost is now one page (04-05).
- **Ready for `/gsd-verify-work 04`.** The plan's `<human-check>` block is the UAT for ROADMAP Success Criterion 5 and will be harvested at end-of-phase under `workflow.human_verify_mode: end-of-phase`: the empty state with no lessons, two providers side by side with the total matching the lines, a local line reading tokens and `not billed` with the right provider word, a Claude Code plugin lesson reading tokens-only, the header and total at 375px, and a `test teaching` run having left no line (D-14).
- **Two open items await the owner, neither introduced here.** `.planning/WINDOWS.md` #26 (the `num_ctx` refusal sentence on read-only LM Studio / llama.cpp rows, from 04-02) and #27 (the conformance replay path's live coverage, from 04-04), plus #28 added here (research assumption A2). None blocks the phase; all three need a live local model.

## Self-Check: PASSED

- `server/src/usage.ts` — FOUND
- `web/src/pages/Usage.tsx` — FOUND
- commit `3501714` — FOUND
- commit `694c920` — FOUND
- `pnpm method:check` — 6 rendered copies match `method/`
- `pnpm typecheck` — server and web both clean under `strict`, `noUnusedLocals`, `noUnusedParameters`
- `pnpm build` — web and server both built
- `pnpm test` — 494 pass, 0 fail (485 before this plan, +9)
- every `<verify>` gate in both tasks — re-run and passing

---
*Phase: 04-local-models-parity-proof-and-usage*
*Completed: 2026-10-22*
