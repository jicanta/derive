---
phase: 04-local-models-parity-proof-and-usage
verified: 2026-10-23T02:14:00Z
status: passed
score: 54/59 must-haves verified
covered_files:

  - ".github/workflows/ci.yml"
  - ".github/workflows/conformance.yml"
  - ".planning/REQUIREMENTS.md"
  - ".planning/WINDOWS.md"
  - ".planning/phases/04-local-models-parity-proof-and-usage/04-01-PLAN.md"
  - ".planning/phases/04-local-models-parity-proof-and-usage/04-01-SUMMARY.md"
  - ".planning/phases/04-local-models-parity-proof-and-usage/04-02-PLAN.md"
  - ".planning/phases/04-local-models-parity-proof-and-usage/04-02-SUMMARY.md"
  - ".planning/phases/04-local-models-parity-proof-and-usage/04-03-PLAN.md"
  - ".planning/phases/04-local-models-parity-proof-and-usage/04-03-SUMMARY.md"
  - ".planning/phases/04-local-models-parity-proof-and-usage/04-04-PLAN.md"
  - ".planning/phases/04-local-models-parity-proof-and-usage/04-04-SUMMARY.md"
  - ".planning/phases/04-local-models-parity-proof-and-usage/04-05-PLAN.md"
  - ".planning/phases/04-local-models-parity-proof-and-usage/04-05-SUMMARY.md"
  - ".planning/phases/04-local-models-parity-proof-and-usage/04-06-PLAN.md"
  - ".planning/phases/04-local-models-parity-proof-and-usage/04-06-SUMMARY.md"
  - ".planning/phases/04-local-models-parity-proof-and-usage/04-REVIEW-FIX.md"
  - ".planning/phases/04-local-models-parity-proof-and-usage/04-REVIEW.md"
  - ".planning/phases/04-local-models-parity-proof-and-usage/04-UI-SPEC.md"
  - ".planning/phases/04-local-models-parity-proof-and-usage/04-USER-SETUP.md"
  - "package.json"
  - "scripts/conformance.mjs"
  - "server/package.json"
  - "server/src/agent.ts"
  - "server/src/capability.ts"
  - "server/src/config.ts"
  - "server/src/context.ts"
  - "server/src/db.ts"
  - "server/src/drivers/adapters.ts"
  - "server/src/drivers/api.ts"
  - "server/src/export.ts"
  - "server/src/index.ts"
  - "server/src/materials.ts"
  - "server/src/migrations.ts"
  - "server/src/probe.ts"
  - "server/src/providers.ts"
  - "server/src/settings.ts"
  - "server/src/usage.ts"
  - "server/test/api-driver.test.ts"
  - "server/test/api.test.ts"
  - "server/test/capability.test.ts"
  - "server/test/cost.test.ts"
  - "server/test/local.test.ts"
  - "server/test/migrations.test.ts"
  - "server/test/settings.test.ts"
  - "server/test/spawn.ts"
  - "server/test/usage.test.ts"
  - "web/src/components/ProviderRow.tsx"
  - "web/src/components/fields.ts"
  - "web/src/lib/api.ts"
  - "web/src/lib/types.ts"
  - "web/src/main.tsx"
  - "web/src/pages/Lesson.tsx"
  - "web/src/pages/Settings.tsx"
  - "web/src/pages/Usage.tsx"

covered_digest: "v1:sha256:fe7a0c846157cc36e1f2a2c583d640698472a5d35aaabf9afc068006a9157c14"
behavior_unverified: 5
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 2026-10-22T23:58:00Z — 52/59
  gaps_closed:
    - "E2 lesson refusal card / static-content (overflow): the refusal sentence wraps inside max-w-[62ch]"
    - "E2 lesson refusal card / static-content (long-text): a long model id inside the refusal sentence wraps rather than clipping"
    - "PROV-13 values prohibition: the tool-rejection rate never reaches the learner — enforced by a source gate over web/src"
    - "COST-03 prohibition: no number is formatted in the browser — enforced by a source gate over web/src/pages/Usage.tsx"
  gaps_remaining: []
  regressions: []
behavior_unverified_items:

  - truth: "SC1: Learner completes a lesson on an Ollama model with the network off"
    test: "Install Ollama, pull a model from ollama.com/search?c=tools, point the Ollama row at it, turn the network off, run a lesson. Then set num_ctx to 16384 with a large attached material"
    expected: "The tutor plans, quizzes and locks a node; the understanding gate refuses to lock on a wrong answer. The over-window lesson refuses with 'The method does not fit in this model's context window…' and the word Settings is a link that lands on Settings — not the '… from Home.' sentence"
    why_human: "No Ollama binary and nothing on 11434 on this machine. Whether a given local model sustains the gate is a property of the model, not of Derive's code, and no presence or wiring check can see it"
  - truth: "SC2: LM Studio and llama.cpp work through the OpenAI-compatible path"
    test: "Run LM Studio (port 1234) with a tool-use model and llama-server on port 8081 (8080 is taken by an unrelated dashboard) with --alias; confirm each row reads found, then run a lesson on each"
    expected: "Each row reads 'found on port …' after a rescan, lists models, accepts Use this provider, and a lesson plans/quizzes/locks. A model NOT trained for tool use is refused with the approved sentence and is not stored on the row. An older llama.cpp build with no chat_template_caps still offers a tool-capable model rather than refusing it"
    why_human: "No lms or llama-server binary on this machine. The refusal half is fully covered by pure-parser tests; the 'works' half needs a live server"
  - truth: "SC3: Test teaching reports a PASS on a model that really can teach"
    test: "With a provider configured, press 'test teaching' on the active row, then on the Claude Code and Codex rows while a different row is active"
    expected: "'Pass · taught one node and passed one graded quiz · {ms} ms' in moss on a capable model; the active row never changes. Afterwards Home shows no new lesson, the Atlas no new nodes, and the Usage total is unchanged"
    why_human: "The pass path is deliberately untested by design — the PROV-11 prohibition forbids manufacturing a pass from a stub, so all seven committed tests assert only fail paths. Only a real model can produce the pass line, and that is the correct trade. While reading it, also check 04-REVIEW.md CR-02: confirm the model id the Pass line renders beside is the model the proof actually ran on"
  - truth: "SC4: The nightly conformance workflow actually dispatches, and a replay reports verdicts that HELD"
    test: "After this phase merges to main: `gh workflow run conformance.yml`, then `gh run list --workflow conformance.yml --limit 1` and open the uploaded artifact. Separately, run `pnpm conformance` with a valid key or a local model"
    expected: "The run completes and uploads a `conformance` artifact whose conformance.md lists every provider exactly once. A row with a working model reads pretest/gate/cumulative as held rather than as a failure"
    why_human: "GitHub resolves both schedule and workflow_dispatch against the default branch only, so this cannot be exercised before merge — and that split was an explicit owner decision. I ran the harness myself again this round (10/10 rows reported, both files written, exit 0 on all-skipped) but never a replay whose verdicts held"
  - truth: "E5 Usage header + grand total / static-content (overflow): the header and the grand total stay on one line at 375px, and the serif em phrase truncates before the total does"
    test: "Open /usage with several lessons recorded and narrow the viewport to 375px"
    expected: "'Usage · what learning has cost' and the grand total each stay on one line; the em phrase truncates while the gold Display-size figure keeps its column"
    why_human: "The class contract is right (the total is shrink-0 truncate, the summary is min-w-0 truncate, so the summary gives way first), but whether both actually hold one line at 375px is a rendered-layout fact no static read establishes"
advisory:

  - finding: "CR-01 — the per-learner activation refusal (server/src/index.ts:560) is unrecoverable through the shipped UI: no surface clears prefs.model[provider] for a provider that is not currently active, and the refusal sentence names Settings, which cannot fix it"
    category: architectural
    reason: "Raised by the incremental code review in 04-REVIEW.md as a regression from the earlier 04-REVIEW-FIX round. It does not falsify the must-have it touches (row 25 asserts the refusal fires, not that it is recoverable) and no named test runs red against it. Resolved by a fix on the refusal's model resolution plus a way to clear the per-learner id; see 04-REVIEW.md §CR-01"
    evidence_status: "none provided"
  - finding: "CR-02 — the teaching proof line is keyed to `row.model ?? row.default_model` (web/src/components/ProviderRow.tsx:381,518) while the route runs on `modelFor(spec.id, learnerOf(c))`, so a Pass can render beside a model id that was not the one tested"
    category: architectural
    reason: "Raised by the incremental code review as a regression from 04-REVIEW-FIX. It does not falsify row 33 (which asserts the probe runs on the pressed ROW, and it does) but it is material to the PROV-11 judgment prohibition's attribution half, so it is folded into the SC3 human check rather than dropped. No named test runs red against it. Resolved by having the route report the model it ran and keying the UI on that; see 04-REVIEW.md §CR-02"
    evidence_status: "none provided"
  - finding: "WR-03 — on LM Studio and llama.cpp the num_ctx refusal sentence names a Settings field that CR-02's narrowing removed from those rows"
    category: other
    reason: "A Copywriting Contract change awaiting the owner, already carried in .planning/WINDOWS.md#26. Row 8's truth as worded (the num_ctx sentence, one link, Settings, never the Home sentence) holds; the complaint is that the sentence is misleading on the read-only rows. Explicitly out of 04-06's scope"
    evidence_status: "none provided"
human_verification:

  - test: "SC1 — Ollama installed, network off, a lesson that plans/quizzes/locks; then the num_ctx refusal card and its Settings link"
    expected: "See behavior_unverified_items[0]"
    why_human: "No Ollama binary on this machine"
  - test: "SC2 — LM Studio on 1234 and llama-server on 8081; a non-tool-use model refused and not stored; an older llama.cpp build still offered"
    expected: "See behavior_unverified_items[1]"
    why_human: "No lms or llama-server binary on this machine"
  - test: "SC3 — a real Pass line, including on the Claude Code and Codex rows while another row is active; and whether the model id beside it is the one tested (CR-02)"
    expected: "See behavior_unverified_items[2]"
    why_human: "Only a real model can produce the pass line; the PROV-11 prohibition forbids faking it"
  - test: "SC4 — `gh workflow run conformance.yml` after merge, plus a replay whose verdicts actually held"
    expected: "See behavior_unverified_items[3]"
    why_human: "GitHub resolves schedule and workflow_dispatch against the default branch only"
  - test: "E5 — the Usage header and grand total at 375px"
    expected: "See behavior_unverified_items[4]"
    why_human: "A rendered-layout fact at a specific viewport"
  - test: "E2 render (new, from 04-06) — trigger the num_ctx refusal on a llama.cpp or LM Studio row whose model id is a long file path and look at the card"
    expected: "The refusal sentence wraps inside roughly 62 characters — noticeably narrower than its neighbouring timeline items, which is the intended result of the locked UI-SPEC E2 contract, not a regression — the long path breaks onto the next line, there is no horizontal scrollbar, and the injected Settings link still renders underlined and still navigates"
    why_human: "Both utilities are now compiled into the shipped CSS with the correct declarations (max-width:62ch, overflow-wrap:break-word), which is why rows 18 and 19 score VERIFIED; whether the card visibly wraps a file-path model id with no horizontal scroll is still a rendered-layout fact. Recorded at 04-USER-SETUP.md:47 and .planning/WINDOWS.md#29"
  - test: "PROV-11 judgment prohibition (P3) — read `testTeaching`'s pass condition at server/src/capability.ts:794-795 and satisfy yourself that no pass can come from Derive's own plumbing"
    expected: "The pass requires a `quiz_result` event with `result === 'correct'`, graded server-side from a quiz tool call the model itself made; no cache, no early return, no stub branch; the override seams have no route, header, env var or config file"
    why_human: "Judgment-tier prohibition. My verdict is non-authoritative by design: holds"
  - test: "PROV-13 judgment prohibition (P4) — read the harness's completeness posture and satisfy yourself the report cannot read healthy by omission"
    expected: "Every unreached provider gets an explicit skipped line with its reason (I observed 10/10 again this round), `reliable_tool_calling: false` is recorded in the report's own run block, and the rejection counter sits at the single `validateToolInput` throw site with its error rethrown unchanged"
    why_human: "Judgment-tier prohibition. My verdict is non-authoritative by design: holds"
---

# Phase 4: Local Models, Parity Proof and Usage — Verification Report (re-verification)

**Phase Goal:** The learner can run Derive free and offline on a local model without the method silently degrading, can prove any chosen model runs the method before investing a session, and can see what learning has cost across every provider.
**Verified:** 2026-10-23T02:14:00Z
**Status:** human_needed
**Re-verification:** Yes — after `04-06` gap closure. Previous: `gaps_found`, 52/59.

## How I approached this round

The brief asked for two things: re-score the four closed gaps against the actual code, and re-check the rest without assuming it still holds. I did both, and I did not score any of the four on the SUMMARY's say-so.

For the two source gates I did not accept "the test passes" as proof the gate works. A gate that asserts an absence can pass forever while guarding nothing, so I re-ran each gate's own logic in a separate process against a **planted violation** and against the real tree:

- **Gate A (COST-03)** — the comment-stripped source of `Usage.tsx` currently contains none of `toFixed`, `toLocaleString`, `Intl.NumberFormat`; with `const x = (1.5).toFixed(2);` planted in code the gate reports `['toFixed']`; with `toFixed` planted in a `//` comment it correctly stays silent; and the anti-vacuity assertion (`stripped.includes('export function UsagePage')`) holds, so the stripper has not eaten the file.
- **Gate B (PROV-13)** — the walk finds 33 `.ts`/`.tsx`/`.css` files under `web/src`, all three named sentinels are among them, none of the four ledger identifiers appears in any of them, and a planted `recordToolRejection(1)` is detected. I also confirmed all four identifiers really exist server-side (`db.ts:851,866,876`, `migrations.ts:340`), so the gate guards live names rather than dead strings.

For the refusal card I went past the className. `max-w-[62ch] break-words` is on the exact `<div>` that renders the `error` timeline item (`Lesson.tsx:361`, the line carrying the card's own `bg-rust-400/5` signature), **and** both utilities compiled into the shipped bundle with the right declarations — `max-w-\[62ch\]{max-width:62ch}` and `.break-words{overflow-wrap:break-word}` in `web/dist/assets/*.css`. That matters because an arbitrary-value Tailwind utility that never reaches the CSS is a class that does nothing. `overflow-wrap` is an inherited property, so it also governs the two fragments `withNextStepLink` splits the sentence into.

The UI-SPEC was **not** amended to make the rows pass: `04-UI-SPEC.md` has no commit after `523a661` (04-03's amendment), and line 238 still names `max-w-[62ch]`. The owner's fork was decided as "implement the spec", and the spec is what got implemented.

## Goal Achievement

### Observable Truths

Merged from the 5 ROADMAP Success Criteria (the contract) and the 6 plans' `must_haves.truths`, deduplicated. Row numbering is continuous with the previous report. Rows 18, 19, 43 and 48 are the re-scored ones; every other row was re-checked this round rather than carried.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | **SC1** Lesson completes on Ollama with the network off; an over-window prompt refuses with a clear card instead of teaching without the gate | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Refusal half fully verified (rows 6–8). The offline-lesson half needs a live Ollama — no binary, nothing on 11434 |
| 2 | **SC2** LM Studio and llama.cpp work through the OpenAI-compatible path; a model that cannot call tools is refused naming the missing capability | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Refusal half fully verified (rows 20–27). The "works" half needs a live server — no `lms`, no `llama-server` |
| 3 | **SC3** From Settings, Test teaching runs one node and one graded quiz and reports pass or fail | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Every fail path verified (rows 29–34). The pass path is untested *by design* — the PROV-11 prohibition forbids faking it |
| 4 | **SC4** A nightly harness replays a scripted lesson on every configured provider and reports whether the gate, pretest and cumulative quiz held | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Re-ran the harness myself this round: 10 providers, 10 explicit skipped lines, JSON + MD written, exit 0 on all-skipped. Not verified: the nightly firing on `main`, and a replay whose verdicts *held* |
| 5 | **SC5** The Usage page, reached from Settings, shows a running total per learner by provider, model and lesson, tokens-only for subscription and local | ✓ VERIFIED | `/usage` route (`main.tsx:24`), only entry is `Settings.tsx:187`, 9 payload states tested in `usage.test.ts`, `index.ts:1183` is `learnerUsage(learnerOf(c))` and nothing else |
| 6 | A lesson turn on the Ollama row goes out with `options.num_ctx` from the stored setting | ✓ VERIFIED | `adapters.ts:460` is `options: { num_ctx: numCtxFor('ollama') }` — the resolver, not a literal; `local.test.ts` intercepts the real adapter's outgoing HTTP body and asserts the value, then 65536 after a write |
| 7 | `headroomCheck` counts the serialised tool surface alongside instructions, history and prompt | ✓ VERIFIED | `context.ts:87` sums four `estimateTokens` calls including `input.tools`; `drivers/api.ts:570` passes `tools: toolText` and `window` in the same call |
| 8 | An over-window local turn is refused before the request leaves, with the num_ctx sentence whose one link is Settings — never the Home sentence | ✓ VERIFIED | Two separate constants (`REFUSAL` at `context.ts:37`, `NUM_CTX_REFUSAL` at `:52`), branched on `input.window != null` at `:91`; `local.test.ts` asserts the refusal fires against a model stub that must never be called; `NEXT_STEPS` checks `Settings` before `Home`, with the ordering documented as load-bearing. See advisory WR-03 on the sentence's accuracy on read-only rows |
| 9 | Every local row gets compact tool descriptions and an outline-only material section, and the method's gate text is byte-identical to the cloud rendering | ✓ VERIFIED | `local.test.ts` asserts the method prose byte-identical between `materialsSection(id)` and `materialsSection(id,{outlineOnly:true})`; `pnpm method:check` re-run green this round: "method: 6 rendered copies match method/" |
| 10 | A local lesson that reported counts reads `not billed`; one that reported none reads `not reported`; neither ever shows money | ✓ VERIFIED | `usage.test.ts` tokens-only and `under $0.01` cases, both in the 502-test green run |
| 11 | The num_ctx field exists only where Derive sends a window; other rows refuse a num_ctx write naming the row | ✓ VERIFIED | `index.ts:482` `num_ctx_default: spec.id === 'ollama' ? NUM_CTX_DEFAULT : null`; `index.ts:653` refuses with `${spec.label} does not take a context window; it serves whatever the endpoint is configured for`. The Ollama-only narrowing is a subset of "only on the three local rows", so the must-have's ceiling still holds |
| 12 | E1 empty: the row plays the shipped `not configured` pill and its note | ✓ VERIFIED | `ProviderRow.tsx` status pill branch |
| 13 | E1 loading: the `checking` pulse pill with `animate-pulse motion-reduce:animate-none`; first paint never blocks on the probe | ✓ VERIFIED | `ProviderRow.tsx` |
| 14 | E1 error: a failed probe renders the provider's verbatim sentence on `errLine`; typed base URL and model id stay in their fields | ✓ VERIFIED | `errLine` from `fields.ts`; no `setModel('')`/`setBase('')` on the error path |
| 15 | E1 long-text: a long model id and base URL are mono and truncate inside their lines; neither widens the card | ✓ VERIFIED | `${field} font-mono h-10` inputs, which scroll their own content |
| 16 | E2 loading: the card renders only after the turn's failure is known; no skeleton of its own | ✓ VERIFIED | `useLesson.ts` appends the error item only on `turn_end` with `ok:false` |
| 17 | E2 error: the card is itself the error surface — one sentence + one Settings link, no secondary error state | ✓ VERIFIED | `Lesson.tsx:360-363` is a single `<div>` whose only child is `withNextStepLink(it.text)`; that helper splits once on a literal word or not at all |
| 18 | E2 overflow: the refusal sentence wraps inside `max-w-[62ch]`; the model id and estimate never force a horizontal scroll | ✓ **VERIFIED** (was ✗ FAILED) | `max-w-[62ch]` on the card's own className at `Lesson.tsx:361`, the line carrying `bg-rust-400/5`, and compiled: `max-w-\[62ch\]{max-width:62ch}` in `web/dist/assets/*.css`. `04-UI-SPEC.md:238` is unchanged — the spec was implemented, not amended. Rendered confirmation is a human item |
| 19 | E2 long-text: a long model id inside the refusal sentence wraps rather than clipping | ✓ **VERIFIED** (was ✗ FAILED) | `break-words` on the same className, compiled as `.break-words{overflow-wrap:break-word}`. `overflow-wrap` is inherited, so it governs both fragments `withNextStepLink` produces. No global rule was added to `index.css`, which is the right call — one element had the problem |
| 20 | A model whose server says it cannot call tools is refused at config/probe time and cannot be made active | ✓ VERIFIED | `verdictOf` (`capability.ts:264`) returns `selectable:false` only on a positive `no`; `capability.test.ts` asserts the verbatim sentence |
| 21 | A model whose server says *nothing* about tool calling is NOT refused: the verdict falls through to one real tool-call round-trip | ✓ VERIFIED | `capability.ts:565` routes `'unknown'` to `roundTrip`; `silence()` at `:175` is `tools: 'unknown'`; four parser cases cover older llama.cpp and v0-only LM Studio |
| 22 | A model whose maximum window is below 16384 is refused, symmetric with the tool refusal | ✓ VERIFIED | `capability.ts:266` refuses only when `tools === 'yes' && maxWindow !== null && maxWindow < NUM_CTX_FLOOR` — a null window is never a refusal at any tier |
| 23 | Every liveness and capability predicate reads a parsed JSON field, never a 200 status code | ✓ VERIFIED | `capability.test.ts` (dashboard answering HTML on /props), `settings.test.ts` (HTML 200 reads `not configured`) — **and confirmed live again this round**: my harness run reported `skipped llama.cpp — no llama.cpp server answered at http://127.0.0.1:8080` |
| 24 | Metadata is read for the whole list on open/Rescan — no request reaching a completion endpoint — and the round-trip runs once for the selected model | ✓ VERIFIED | `capabilityList` key link verified; a rescan forgets every local row's verdicts |
| 25 | A non-selectable model is refused by the write *and* the activation, in Derive's own sentence | ✓ VERIFIED | `capabilityRefusal` key link found at both sites in `index.ts`. **Scored on its own evidence**: 04-REVIEW.md CR-01 agrees the refusal fires and complains it is unrecoverable from the shipped UI — a different claim from the one this row makes. Carried as an advisory |
| 26 | The capability probe lives only on the three dedicated local rows; the generic row is refused naming it | ✓ VERIFIED | `readCapability` switches on the three ids only; the route's model id is bound by the one `ModelId` schema |
| 27 | The lesson-time capability refusal card remains the backstop, carrying the approved sentence whose one link is Settings | ✓ VERIFIED | `local.test.ts` asserts a turn on a ladder-refused model is refused before the request, with the capability sentence |
| 28 | E1 partial: a reachable server exposing no tool-capable model still renders `found` and its usable models, with the capability note | ✓ VERIFIED | `ProviderRow.tsx` — the status pill and model list are untouched by the capability line |
| 29 | The run happens in an ephemeral scratch lesson deleted in the same request, transactionally; nothing appears in Home, the Atlas or the Usage total | ✓ VERIFIED | `capability.ts:788-792` — `deleteLesson(lessonId)` in a `finally`, so a throw still takes the lesson and its usage rows; every one of the 7 tests ends on a full before/after count equality |
| 30 | The test's tokens never reach the Usage total — `deleteLesson` clears usage rows by construction, with no special case in `recordUsage` | ✓ VERIFIED | `api.test.ts` builds a crashed probe *with* a usage row and proves the sweep removes it; `usage.test.ts` proves usage rows leave in the lesson's own transaction |
| 31 | A scratch lesson surviving a crash is swept at the next boot | ✓ VERIFIED | `sweepScratchLessons` key link found in the `index.ts` boot sequence; the live row never reaches `allNodes`, `listMemory`, `listMisconceptions` or `dueNodes` in the meantime |
| 32 | The action appears on every teachable row, including the Claude Code and Codex login rows | ✓ VERIFIED | All 10 catalogue rows are `teaches: true`; the control keys on `row.teaches`, not an id list; a test fails if a non-teaching row is ever added |
| 33 | The probe runs on the row the learner pressed, not on whatever is active; pressing changes nothing about which provider is active | ✓ VERIFIED | `driverFor` exported and asserted stable across an active-row switch; two tests run with **no override** and prove the request hit the pressed row's own address while Anthropic was active. **Scored on its own evidence**: CR-02 concerns which *model id the browser files the result under*, not which row the probe ran on; folded into the SC3 human check and the advisory list |
| 34 | The three failure readouts are the approved sentences, each mapped to one observable loop outcome | ✓ VERIFIED | `NO_TOOLS` and `UNGRADABLE` as consts in `capability.ts`; the third (`nothing answered at {host}:{port}`) comes from `probe.ts` and is never copied — I saw that same sentence come out of the live harness run |
| 35 | E3 loading: the button reads `testing…` and one mono `role=status` line pulses teal | ✓ VERIFIED | `ProviderRow.tsx` with `motion-reduce:animate-none` |
| 36 | E3 error: `Fail · {reason}` in rust on one line with the hint beneath | ✓ VERIFIED | `ProviderRow.tsx` |
| 37 | E3 overflow: the readout is capped to one line with full text in the title | ✓ VERIFIED | `resultLine` = `min-w-0 max-w-full truncate font-mono text-[10px]` + `title` |
| 38 | E3 long-text: a long fail reason truncates with ellipsis and stays readable in the title | ✓ VERIFIED | same |
| 39 | The harness drives real configured models, not a stub | ✓ VERIFIED | No mock/stub/fake token anywhere in the script; previously proven by a real request to api.anthropic.com. Re-confirmed this round that the script's only export is `exitCodeFor` and importing it runs no main body |
| 40 | It exercises every provider in the environment and records an explicit `skipped` line with the reason for each it could not reach | ✓ VERIFIED | **Re-proven live this round**: `10 providers: 0 passed, 0 failed, 10 skipped`, each with its own reason (no key / no endpoint / nothing answered / logins need `--logins`) |
| 41 | It writes JSON and Markdown per run and exits non-zero on any failure; CI uploads the artifact | ✓ VERIFIED | **Re-proven live**: both files written to the `--out` dir; exit 0 on all-skipped, and `exitCodeFor({rows:[{status:'failed'}]}) === 1`; `upload-artifact@v7` with `if: always()` in the workflow |
| 42 | The exit code is a pure function of the report, exported, so the failing path is checkable with no provider, key or model | ✓ VERIFIED | **Re-proven live**: `exports: ['exitCodeFor']`, `failed=1 skipped=0 empty=0`, with no main body running on import |
| 43 | No learner-facing surface is added by the harness or the telemetry | ✓ **VERIFIED** (enforcement now wired) | No route in `index.ts`, no event type, nothing under `web/src` — and now held by Gate B at `usage.test.ts:710`, which walks `web/src` and asserts all four ledger identifiers are absent. I drove the gate red with a planted reference and confirmed its three sentinels and its 33-file walk |
| 44 | The rejection rate counts schema-rejected tool calls only, per provider and model, with no runtime effect | ✓ VERIFIED | One call site, `drivers/api.ts:465`, inside the `validateToolInput` catch; the error is rethrown unchanged on the very next line and the return value is unused |
| 45 | The nightly workflow carries `workflow_dispatch` beside its cron | ✓ VERIFIED | YAML parses; triggers are exactly `['schedule','workflow_dispatch']`; cron `37 3 * * *` deliberately off the hour |
| 46 | No provider key or error body reaches the report un-redacted | ✓ VERIFIED | Previously proven with a canary key absent from both written files; the two fatal paths route through the same chokepoint |
| 47 | Subscription and local lines carry tokens only and no money figure | ✓ VERIFIED | `usage.test.ts`, in the green 502-test run |
| 48 | Every money string and label word is produced once server-side by `costLabel`; the browser never formats a number | ✓ **VERIFIED** (enforcement now wired) | `costOf\|costLabel` key link in `usage.ts`; `grep -rn 'toFixed\|Intl.NumberFormat\|toLocaleString' web/src/` returns **only the two prose comment lines** in `Usage.tsx` — nothing in code anywhere under `web/src`. Now held by Gate A at `usage.test.ts:695`, which I drove red with a planted `(1.5).toFixed(2)` and confirmed ignores the deliberate prose |
| 49 | The page is scoped to the learner the server resolved, never a caller-supplied id | ✓ VERIFIED | `index.ts:1183` is `learnerUsage(learnerOf(c))` and nothing else |
| 50 | A lesson mixing priced and subscription rows takes the weakest label; a tokens-only line still renders | ✓ VERIFIED | `weakestSource` case plus the lesson-header twin |
| 51 | E4 empty: the documented `Nothing spent yet` heading and body; no placeholder rows | ✓ VERIFIED | `Usage.tsx`, gated on `view.lessons > 0` |
| 52 | E4 loading: a mono `role=status` line; never a half-drawn list or a zeroed total | ✓ VERIFIED | `Usage.tsx` |
| 53 | E4 error: Derive's error line on `errLine` with a retry affordance; no stale or zeroed total shown as truth | ✓ VERIFIED | `Usage.tsx` |
| 54 | E4 populated: provider groups with model then lesson lines inside `max-w-[760px]` | ✓ VERIFIED | `Usage.tsx` |
| 55 | E4 partial: weakest label; tokens-only line still renders | ✓ VERIFIED | `usage.test.ts` |
| 56 | E4 overflow: the list scrolls in `.scroll-thin`; each line truncates rather than widening | ✓ VERIFIED | `Usage.tsx` plus `truncate` + `title` on every line |
| 57 | E4 zero-one-many: 0 gives empty copy; 1 gives singular nouns; many grows without pagination | ✓ VERIFIED | `usage.test.ts` — the singular nouns are the server's |
| 58 | E5 overflow: header and grand total stay on one line at 375px; the serif em truncates before the total | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Class contract is right (total `shrink-0 truncate`, summary `min-w-0 truncate`, so the summary yields first) but a 375px rendered layout is not a static fact |
| 59 | E5 long-text: a long total or provider phrase wraps or truncates without pushing the figure off-screen; the total keeps its column | ✓ VERIFIED | `shrink-0` on the gold figure is what keeps the column |

**Score:** 54/59 truths verified (5 present, behaviour-unverified; **0 failed**). Previous: 52/59 with 2 failed.

### Why rows 18 and 19 are VERIFIED rather than behaviour-unverified

Worth stating plainly, because it is a judgement call. Both rows assert a CSS treatment and its consequence. I have more than class presence: the utilities are on the exact element that renders the card, and both compiled into the shipped CSS with the correct declarations. That is the same standard rows 15, 37, 56 and 59 were scored under, and strictly stronger evidence than those rows had. What is left — whether a file-path model id *visibly* wraps with no horizontal scrollbar — is a rendered-layout judgement, so it goes to the human list as the sixth item, exactly as `04-06`'s own `coverage` block records it (`human_judgment: true`). If the owner prefers to read it as a sixth `behavior_unverified` item instead, nothing in this report changes but the two counters; the check is listed either way.

### Required Artifacts

All 20 declared artifacts across the 6 plans pass Levels 1–4. `verify.artifacts` returns `all_passed: true` for every plan (4+4+4+3+3+2).

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `web/src/pages/Lesson.tsx` | the `error` timeline item carrying its own `max-w-[62ch]` and `break-words` | ✓ VERIFIED | Line 361; both utilities present and compiled into `web/dist/assets/*.css` |
| `server/test/usage.test.ts` | the two source gates, reading files under `web/src` | ✓ VERIFIED | `describe('what the browser is not allowed to carry')` at 692; two `it` cases; `readdirSync` added to the `node:fs` import; both gates driven red against planted violations in a separate process |
| `server/src/settings.ts` | `numCtxKey`, `numCtxFor`, `NUM_CTX_FLOOR`, `NUM_CTX_DEFAULT`, `modelFor` | ✓ VERIFIED | Floor (16384) and default (32768) remain two separately-named exports, per owner decision A-01 |
| `server/src/drivers/adapters.ts` | the three local adapter rows replacing three throwing cases | ✓ VERIFIED | `case 'ollama'` / `'lmstudio'` / `'llamacpp'`; none throws |
| `server/src/context.ts` | tool-and-window-aware `headroomCheck` with two distinct refusals | ✓ VERIFIED | Pure, no I/O; `REFUSAL` and `NUM_CTX_REFUSAL` as separate constants |
| `server/test/local.test.ts` | the no-server proof | ✓ VERIFIED | 10 tests; header states its own limits honestly |
| `server/src/capability.ts` | three parsers, three-valued `Capability`, two-tier `capabilityOf`, `capabilityList`, `testTeaching` | ✓ VERIFIED | 807 lines |
| `server/src/probe.ts` | `postJson` for Ollama's POST-only `/api/show` | ✓ VERIFIED | present |
| `server/test/capability.test.ts` | pure parser cases from the research JSON | ✓ VERIFIED | 36 tests, no server, no database |
| `server/src/migrations.ts` | migration 8 (`lessons.scratch`) and migration 9 (`tool_rejections`) | ✓ VERIFIED | `version: 8`, `version: 9`; table + 2 indexes |
| `server/src/agent.ts` | `driverFor` + `runTurn`'s per-turn provider-and-model option | ✓ VERIFIED | `export function driverFor` present |
| `server/src/db.ts` | `scratch` on `createLesson`, `listLessons` excluding scratch, `sweepScratchLessons` | ✓ VERIFIED | `scratch = 0` on 10 lesson-joining reads |
| `scripts/conformance.mjs` | the one harness, both environments, exporting `exitCodeFor` | ✓ VERIFIED | Ran for real again this round; exports exactly `exitCodeFor` |
| `.github/workflows/conformance.yml` | nightly schedule + dispatch + setup + artifact upload | ✓ VERIFIED | No `continue-on-error`, so a harness failure reddens the job |
| `server/src/usage.ts` | the learner's total grouped by provider/model/lesson, strings from `costLabel` | ✓ VERIFIED | present |
| `web/src/pages/Usage.tsx` | the page that formats no number | ✓ VERIFIED | no formatter in code, only in prose |
| `web/src/main.tsx` | the `/usage` route | ✓ VERIFIED | line 24 |

### Key Link Verification

All 20 declared key links verified across the 6 plans (`verify.key-links` returns `all_verified: true` for each: 3+5+4+3+3+2). The two new ones, re-checked by hand:

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `server/test/usage.test.ts` | `web/src/pages/Usage.tsx` | the COST-03 gate reads the page's own source and asserts no browser-side numeric formatter | ✓ WIRED | `readFileSync(new URL('../../web/src/pages/Usage.tsx', import.meta.url))` at line 696 — the first test in `server/test/` to cross the workspace boundary. Anti-vacuity guard present and holding |
| `server/test/usage.test.ts` | `web/src` | the PROV-13 gate walks every source file the browser bundles and asserts the ledger's four identifiers reach none | ✓ WIRED | `readdirSync(webSrc, { recursive: true })` at 712, filtered to `.ts`/`.tsx`/`.css`; 33 files found; three named sentinels asserted before any absence assertion |
| `drivers/adapters.ts` | `settings.ts` | the Ollama row reads the window through `numCtxFor('ollama')` | ✓ WIRED | Line 460 — the resolver, not a literal |
| `drivers/api.ts` | `context.ts` | the headroom call passes the tool projection and the local window | ✓ WIRED | Line 570 passes both `tools` and `window` |
| `pages/Lesson.tsx` | `context.ts` | the card links the literal word the sentence carries | ✓ WIRED | `NEXT_STEPS` checks `Settings` before `Home` |
| `capability.ts` | `agent.ts` | the probe runs one real turn via `runTurn` + `driverFor`, never the global test override | ✓ WIRED | present |
| `capability.ts` | `db.ts` | the scratch lesson goes through transactional `deleteLesson` | ✓ WIRED | `capability.ts:791`, inside the `finally` |
| `drivers/api.ts` | `db.ts` | the rejection is recorded at the one `validateToolInput` throw site | ✓ WIRED | Line 465; error rethrown unchanged |
| `scripts/conformance.mjs` | `server/src/secrets.ts` | every env key registered, every sentence redacted | ✓ WIRED | previously proven by a canary |
| `pages/Settings.tsx` | `pages/Usage.tsx` | a Settings link is the only way in | ✓ WIRED | `Settings.tsx:187`; nothing in the default UI links to it |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `web/src/pages/Usage.tsx` | `view` (total, summary, groups) | `api.usage()` → `GET /api/usage` → `learnerUsage(learnerOf(c))` → `usage`/`turns`/`lessons` tables via `cost.ts` | Yes | ✓ FLOWING |
| `web/src/components/ProviderRow.tsx` | `capability` | `POST /api/settings/:provider/capability` → `capabilityOf` → parsed server metadata | Yes | ✓ FLOWING |
| `web/src/components/ProviderRow.tsx` | `proof` | `POST /api/settings/:provider/test-teaching` → `testTeaching` → real `runTurn` event log | Yes — see CR-02 advisory on which model id the line is filed under | ✓ FLOWING |
| `web/src/components/ProviderRow.tsx` | `row.num_ctx`, `row.num_ctx_default` | `GET /api/settings` → `getSetting(numCtxKey(id))` / `NUM_CTX_DEFAULT` | Yes — `num_ctx_default` null on every non-Ollama row | ✓ FLOWING |
| `web/src/pages/Lesson.tsx` | refusal `it.text` | `turn_end` payload `error` from `headroomCheck` / `capabilityRefusal`, rendered inside the now-bounded card | Yes | ✓ FLOWING |

No hollow props, no static fallbacks, no hardcoded empties on any rendered path.

### Behavioural Spot-Checks

Every row below I ran myself this round.

| Behaviour | Command | Result | Status |
|-----------|---------|--------|--------|
| Full suite | `pnpm test` | **502 tests, 117 suites, 0 fail** — exactly +2 tests and +1 suite over the previous round's 500/116, which is the two new gates and nothing else | ✓ PASS |
| Both gates, named | `node --test --test-name-pattern "browser is not allowed to carry" test/usage.test.ts` | 2 tests, 2 pass | ✓ PASS |
| Gate A detects a real violation | ran the gate's own strip-and-match logic over `Usage.tsx` with `(1.5).toFixed(2)` planted in code | `planted detected: ['toFixed']`; baseline `[]`; comment-only plant correctly ignored; anti-vacuity assertion holds | ✓ PASS |
| Gate B detects a real violation | ran the gate's own walk-and-match logic with `recordToolRejection(1)` planted | 33 files walked, 3/3 sentinels found, baseline `[]`, `planted detected: ['recordToolRejection']` | ✓ PASS |
| Gate B guards live names | `grep -rn` the four identifiers in `server/src` and `scripts` | all four exist server-side (`db.ts:851,866,876`, `migrations.ts:340`, `conformance.mjs:499`) | ✓ PASS |
| No formatter anywhere under `web/src` | `grep -rn 'toFixed\|Intl.NumberFormat\|toLocaleString' web/src/` | two prose comment lines in `Usage.tsx`; nothing in code | ✓ PASS |
| Typecheck | `pnpm typecheck` | server + web both Done | ✓ PASS |
| Build | `pnpm build` | exit 0 | ✓ PASS |
| Utilities reach the shipped CSS | `grep` the built bundle | `max-w-\[62ch\]{max-width:62ch}` and `.break-words{overflow-wrap:break-word}` | ✓ PASS |
| Method text unchanged | `pnpm method:check` | "method: 6 rendered copies match method/" | ✓ PASS |
| Harness: complete report | `node scripts/conformance.mjs --out …` with keys unset | **10 providers, 10 explicit skipped lines each with a reason, exit 0**, JSON + MD written | ✓ PASS |
| Port-8080 false positive still rejected | same run | `skipped llama.cpp — no llama.cpp server answered at http://127.0.0.1:8080` | ✓ PASS |
| `exitCodeFor` pure, main-guarded | `import('./scripts/conformance.mjs')` | `exports: ['exitCodeFor']`, `failed=1 skipped=0 empty=0`, no main body ran | ✓ PASS |
| UI-SPEC not amended to pass | `git log -- 04-UI-SPEC.md` | no commit after `523a661`; line 238 still names `max-w-[62ch]` | ✓ PASS |
| Live lesson on a local model | — | no `ollama`/`lms`/`llama-server` on this machine | ? SKIP → human |
| Nightly workflow dispatch | — | GitHub resolves `workflow_dispatch` against the default branch only | ? SKIP → human |
| Refusal card rendered at a file-path model id | — | needs a live local server and a pair of eyes | ? SKIP → human |

### Probe Execution

No `scripts/*/tests/probe-*.sh` files exist in this repo (`find` returns 0) and no plan declares one. The phase's runnable check is `scripts/conformance.mjs`, which I executed again this round — results above.

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| n/a — no probe convention in this project | — | — | SKIPPED (none declared, none conventional) |

### Prohibitions

| # | Requirement | Tier | Statement (abbreviated) | Disposition |
|---|-------------|------|--------------------------|-------------|
| P1 | PROV-06 | test | Compaction may never shorten the method's gate/discipline/checks text | ✓ VERIFIED — byte-identical assertion in `local.test.ts` plus `pnpm method:check`, re-run green |
| P2 | PROV-07 | test | Absent capability metadata must never be reported as a refusal | ✓ VERIFIED — `verdictOf` refuses only on a positive `no`; `silence()` is `'unknown'`; four parser cases cover older llama.cpp and v0-only LM Studio |
| P3 | PROV-11 | judgment | Test teaching must never report a pass a real model did not produce | ⚠️ FLAGGED — **unverified-prohibition, human review recommended.** Non-authoritative judge verdict: **holds.** The pass requires a server-graded `quiz_result` with `result === 'correct'` (`capability.ts:794-795`) from a tool call the model made; all 7 tests assert fail paths only (the two `ok: true` assertions in `api.test.ts` are capability-endpoint tests, not teaching passes — I checked); the override seams have no route/env/header. **One thing for the human to weigh:** CR-02 says the Pass line can render beside a model id that is not the one the proof ran on. That is an attribution defect, not a manufactured pass, so it does not flip my verdict — but it is adjacent enough to this prohibition that it belongs in the human's read, and it is folded into the SC3 check |
| P4 | PROV-13 | judgment | The report must never read healthy by omission, nor count a repair layer's correction as the model's own success | ⚠️ FLAGGED — **unverified-prohibition, human review recommended.** Judge verdict: **holds**, re-evidenced this round: 10/10 rows accounted for in a live run, `reliable_tool_calling: false` recorded in the report's own run block, rejection counter at the single `validateToolInput` throw site with the error rethrown unchanged |
| P5 | PROV-13 | test | The tool-rejection rate must never be shown to the learner or change what Derive does | ✓ **VERIFIED** (was ⚠️ UNVERIFIED) — Gate B at `usage.test.ts:710` is the declared source gate: it walks `web/src` recursively, guards against a vacuous walk with three named sentinels, and asserts all four ledger identifiers are absent. I drove it red with a planted reference. The runtime half is unchanged: one call site, error rethrown, return value unused |
| P6 | COST-03 | test | No money figure on a moneyless path including a zero; no number formatted in the browser | ✓ **VERIFIED** (was ⚠️ PARTIAL) — all three halves now tested. Money: `$0.00` never, `under $0.01`, `weakestSource`. Browser formatter: Gate A at `usage.test.ts:695` reads the page's comment-stripped source, guarded by an anti-vacuity assertion, and I drove it red with a planted `toFixed`. The `$`-assembly half stays on the payload rather than in the gate, because a raw `$` grep would match the page's six template interpolations — a deliberate and correct scoping choice, recorded in the SUMMARY |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PROV-06 | 04-01, 04-06 | Run the tutor on a local Ollama model, offline, with the window sized so the method is never silently truncated | ✓ SATISFIED (code) / ? NEEDS HUMAN (offline lesson, card render) | `num_ctx` on the captured outgoing body; tool surface counted; method text byte-identical; the refusal card now carries its UI-SPEC width and wrapping, compiled |
| PROV-07 | 04-02 | LM Studio / llama.cpp with capability probes that refuse clearly when tool calling is unsupported | ✓ SATISFIED (code) / ? NEEDS HUMAN (live servers) | Three parsers, three-valued verdict, floor refusal, write + activation refusals, lesson-time backstop. **No gap was ever recorded against this ID** — the REQUIREMENTS.md `Gaps Found` mark is bookkeeping drift, see Anti-Patterns |
| PROV-11 | 04-03 | A "test teaching" smoke test from Settings: one node, one graded quiz | ✓ SATISFIED (fail paths + routing + cleanup) / ? NEEDS HUMAN (pass path) | 7 tests, all fail paths; pressed-row routing proven without overrides; full DB-invariance after each run. Same bookkeeping note as PROV-07 |
| PROV-13 | 04-04, 04-06 | A conformance harness replaying a scripted lesson per provider, asserting gate/pretest/cumulative; runs nightly | ✓ SATISFIED (harness) / ? NEEDS HUMAN (nightly dispatch, held verdicts) | Ran live again: complete report, exit-code purity, redaction previously proven. Values prohibition now gated |
| COST-03 | 04-05, 04-06 | A usage page with a running total per learner by provider, model and lesson, tokens-only for subscription and local | ✓ SATISFIED | Route, single entry point, 9 payload states tested, no browser formatter — now gated |

**Orphaned requirements:** none. `REQUIREMENTS.md:215` maps exactly PROV-06, PROV-07, PROV-11, PROV-13, COST-03 to Phase 4, and all five are claimed by a plan's `requirements` field.

### Anti-Patterns Found

Scanned all 37 implementation files changed across the phase (`3b3babf..HEAD`), plus the two files `04-06` touched.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | `TBD` / `FIXME` / `XXX` | — | **None.** Zero debt markers in any changed file |
| — | — | `TODO` / `HACK` / `PLACEHOLDER` | — | **None** |
| — | — | stub prose (`coming soon`, `not yet implemented`, `will be here`) | — | **None** |
| `web/src/pages/Lesson.tsx` | 361 | *(previously: refusal card missing the UI-SPEC width and wrapping)* | — | **Resolved.** Both utilities present and compiled |
| `server/test/usage.test.ts` | 692-728 | *(previously: two declared source gates absent)* | — | **Resolved.** Both gates present, substantive, anti-vacuity-guarded, and driven red against planted violations |
| `.planning/REQUIREMENTS.md` | 29, 33, 155, 159 | PROV-07 and PROV-11 carry `Gaps Found` / an unchecked box, but no gap was ever recorded against either ID — all four gaps belonged to PROV-06, PROV-13 and COST-03 | ℹ️ Info | Bookkeeping drift from commit `36e9633`'s blanket revert. The other three IDs now read `Complete` while five live-provider human checks are still open, so the ledger is imprecise in both directions. Worth a pass when the UAT closes |
| `.planning/…/04-UI-SPEC.md` | 108 | one signed-off row edited in place (`Primary CTA`) in commit `523a661` | ℹ️ Info | Carried from the previous report, unchanged. `04-06` did not touch the file at all, which is the right behaviour |
| ROADMAP | — | phase carries `mode: mvp` but the goal is not a User Story | ℹ️ Info | `user-story.validate` returns `valid: false` on all three slots. I verified against the 5 ROADMAP Success Criteria instead — the stronger contract — and omitted the User Flow Coverage section rather than produce a low-quality one. Same call as the previous round |

### Advisory (New Scope, Unevidenced)

Re-verification ran, so this section is present. The three findings below come from `04-REVIEW.md`'s incremental review. Per the re-verification evidence gate, none is a carried-forward gap and none of the flagged files (`server/src/index.ts`, `web/src/components/ProviderRow.tsx`, `server/src/context.ts`) was modified since the previous `verified:` timestamp — so they predate the gap-closure round unflagged and need deterministic evidence to block. None has a named test running red. Code-review findings are advisory here by instruction, and I agree with that handling on the evidence.

| # | Finding | Category | Why Advisory |
|---|---------|----------|--------------|
| 1 | CR-01 — the per-learner activation refusal is unrecoverable through the shipped UI (`index.ts:560`) | architectural | new-scope, no deterministic evidence; does not falsify row 25, which asserts the refusal fires |
| 2 | CR-02 — the teaching proof line can be filed under a model id that was not tested (`ProviderRow.tsx:381,518`) | architectural | new-scope, no deterministic evidence; does not falsify row 33, which asserts the pressed *row*. Folded into the SC3 human check and into P3's disposition rather than dropped |
| 3 | WR-03 — the num_ctx refusal sentence names a field absent on the read-only local rows | other | already ledgered at `WINDOWS.md#26` as an owner-pending copy change; row 8's truth as worded holds |

### Deferred Items

None. No gaps remain to defer. For completeness I re-checked Phases 5 (Learning Experience), 6 (Personalization) and 7 (Adoption) against the open human items; none of them covers a live-local-model UAT or a merged-branch workflow dispatch, so nothing is deferred.

### Human Verification Required

Eight items, all of them the planned state rather than execution failures. Five are the carried `behavior_unverified` Success Criteria, one is the new refusal-card render from `04-06`, and two are the judgment-tier prohibitions that are non-authoritative by design. The first six are the owner's end-of-phase UAT, already written up in `04-USER-SETUP.md` and ledgered as `unrun-verify` entries `#27`, `#28` and `#29` in `.planning/WINDOWS.md`.

1. **SC1** — Ollama installed, network off, a lesson that plans/quizzes/locks; then the num_ctx refusal card and its Settings link.
2. **SC2** — LM Studio on 1234 and `llama-server` on **8081** (not 8080); a non-tool-use model refused and not stored; an older llama.cpp build still offered.
3. **SC3** — a real `Pass` line, including on the Claude Code and Codex rows while another row is active. **While you are there, check CR-02**: is the model id rendered beside the Pass the model the proof actually ran on?
4. **SC4** — `gh workflow run conformance.yml` after merge, plus a replay whose verdicts actually held.
5. **E5** — the Usage header and grand total at 375px.
6. **E2 render (new)** — trigger the num_ctx refusal on a row whose model id is a long file path; the sentence should wrap inside ~62 characters, visibly narrower than its neighbours (intended), with no horizontal scrollbar and the `Settings` link still live.
7. **P3 (PROV-11, judgment)** — read `testTeaching`'s pass condition. My verdict is holds, non-authoritative.
8. **P4 (PROV-13, judgment)** — read the harness's completeness posture. My verdict is holds, non-authoritative.

### Gaps Summary

**No gaps remain.** All four `04-06` was scoped to close are closed, and I did not take any of them on the SUMMARY's word.

The two UI-SPEC rows got the treatment the locked spec named, on the element that actually renders, and — the part worth checking and easy to miss — both utilities reach the shipped CSS with the right declarations. A `max-w-[62ch]` that Tailwind never emits is a class that does nothing, and that is not what happened here. The spec itself is byte-identical to its sign-off; the owner's fork was decided as "implement it", and it was implemented rather than reworded.

The two source gates are the stronger half of this round. Both are real: each reads files across the workspace boundary (the first tests in `server/test/` to do so), each carries an anti-vacuity assertion that runs *before* any absence check, and each went red in my hands against a violation planted in code. That last part is what separates these from the gaps they replace — the facts were already true, and what was missing was anything that keeps them true. Gate B's three-sentinel membership check is the detail I'd single out: an "appears nowhere" assertion over an empty walk is the classic way a gate guards nothing forever, and it is explicitly defended against. The one deliberate narrowing — leaving the `$`-assembly half of COST-03 on the payload rather than in the gate, because a raw `$` grep would match the page's own template interpolations — is correct and is recorded rather than hidden.

Nothing regressed. 502 tests pass where 500 did before, and the delta is exactly the two new gates; typecheck, build and `method:check` are green; all 20 artifacts and all 20 key links verify across the six plans; zero debt markers in 37 changed files; and the live harness run still reports 10 of 10 providers with a reason for each and still refuses to call the unrelated port-8080 dashboard a llama.cpp server.

What stands between this and `passed` is eight human items, and none of them is a defect. Five need a local model server or a merged default branch, one needs eyes on a rendered card, and two are judgment-tier prohibitions that are non-authoritative by design — the PROV-11 one especially, where the whole point is that a pass cannot be manufactured, so there is nothing for me to assert green. I went looking again for a manufactured pass and did not find one: the pass condition is a server-graded `quiz_result`, the only two `ok: true` assertions in the suite belong to the capability endpoint rather than to teaching, and the override seams still have no route, header or env var behind them.

One honest caveat on that last point. `04-REVIEW.md`'s CR-02 says a `Pass` line can render beside a model id that is not the one tested. That is an attribution defect rather than a manufactured pass, so it does not change P3's verdict or row 33's score — row 33 asserts which *row* the probe runs on, and it does run on the pressed one. But it is close enough to PROV-11's spirit that burying it in an advisory table would be the wrong call, so it is also written into the SC3 human check: when the owner reads a real Pass line, they should confirm the model id beside it is the model that earned it.

---

_Verified: 2026-10-23T02:14:00Z_
_Verifier: Claude (gsd-verifier)_
