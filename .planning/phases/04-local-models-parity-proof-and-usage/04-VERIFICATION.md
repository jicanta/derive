---
phase: 04-local-models-parity-proof-and-usage
verified: 2026-10-22T23:58:00Z
status: gaps_found
score: 52/59 must-haves verified
covered_files:
  - ".github/workflows/ci.yml"
  - ".github/workflows/conformance.yml"
  - ".planning/REQUIREMENTS.md"
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
covered_digest: "v1:sha256:0438739b4d1eea96352e8a6da712cb2f51560ea71fd63123fcf7b9d90a5b5f56"
behavior_unverified: 5
overrides_applied: 0
gaps:
  - truth: "E2 lesson refusal card / static-content (overflow): the refusal sentence wraps inside max-w-[62ch]; the model id and token estimate wrap and never force a horizontal scroll"
    status: failed
    reason: "The refusal is rendered by the generic `error` timeline item, which carries no max-w-[62ch]. It inherits the timeline's max-w-[680px] container instead. The UI-SPEC row for this state is marked `✅ covered` and names 62ch explicitly; no element in the render path has it."
    artifacts:
      - path: "web/src/pages/Lesson.tsx"
        issue: "Line 361: the error card is `rounded-xl border border-rust-400/40 bg-rust-400/5 px-4 py-3 text-sm text-rust-400` — no max-width of its own. `grep -n '62ch' web/src/pages/Lesson.tsx` returns nothing."
    missing:
      - "max-w-[62ch] on the refusal/error card in Lesson.tsx, or an amended UI-SPEC row recording that the 680px timeline column is the agreed bound instead"
  - truth: "E2 lesson refusal card / static-content (long-text): a long model id inside the refusal sentence wraps to the next line rather than clipping; the sentence is never truncated mid-token"
    status: failed
    reason: "No word-breaking anywhere in the render path and no global overflow-wrap rule, so a long unbroken model id overflows horizontally rather than wrapping. This is reachable in practice: NUM_CTX_REFUSAL interpolates the model id, and headroomCheck fires with a caller-supplied window on llama.cpp / LM Studio rows, whose model ids are file paths (the codebase says so itself in web/src/pages/Usage.tsx)."
    artifacts:
      - path: "web/src/pages/Lesson.tsx"
        issue: "Line 361 card has no break-words / wrap-anywhere / whitespace-pre-wrap"
      - path: "web/src/index.css"
        issue: "No global overflow-wrap, word-break or hyphens rule, so CSS default overflow-wrap: normal applies"
    missing:
      - "break-words (or wrap-anywhere) on the refusal card so an unbroken model id wraps instead of overflowing"
  - truth: "PROV-13 values prohibition: the tool-rejection rate must never be shown to the learner and must never change what Derive does — enforced by a source gate asserting the identifier appears nowhere under web/src"
    status: partial
    reason: "The substantive fact HOLDS today and was independently confirmed: no route, no event type, nothing under web/src, single call site that rethrows unchanged. But the declared test-tier enforcement — the source gate — does not exist. No test in server/test/ reads any file under web/src. Fail-closed: a test-tier prohibition with no wired enforcement is unverified, not green."
    artifacts:
      - path: "server/test/"
        issue: "No source gate exists. `grep -rn 'web/src' server/test/*.ts` returns only three prose comments; no readFileSync of any web source file anywhere in the suite."
    missing:
      - "A source gate test asserting `recordToolRejection` / `tool_rejections` appear nowhere under web/src, so the prohibition survives a future change rather than holding only by current coincidence"
  - truth: "COST-03 prohibition: no number may be formatted anywhere in the browser — enforced by a source gate asserting no numeric formatter appears in the page"
    status: partial
    reason: "The fact HOLDS today: Usage.tsx renders only server-composed strings and contains no toFixed, Intl.NumberFormat or assembled `$`. The other two halves of this prohibition ARE tested (never $0.00 at usage.test.ts:607, `under $0.01` at :623, weakestSource at :587). But the declared source gate for the no-browser-formatter half does not exist."
    artifacts:
      - path: "server/test/usage.test.ts"
        issue: "The three readFileSync calls here read the auth token, not web/src/pages/Usage.tsx. No formatter gate present."
    missing:
      - "A source gate test asserting no numeric formatter appears in web/src/pages/Usage.tsx"
behavior_unverified_items:
  - truth: "SC1: Learner completes a lesson on an Ollama model with the network off"
    test: "Install Ollama, pull a model from ollama.com/search?c=tools, point the Ollama row at it, turn the network off, run a lesson"
    expected: "The tutor plans, quizzes and locks a node; the understanding gate refuses to lock on a wrong answer. Then set num_ctx to 16384 with a large attached material: the lesson refuses with 'The method does not fit in this model's context window…' and the word Settings is a link that lands on Settings — not the '… from Home.' sentence"
    why_human: "No Ollama binary and nothing on 11434 on this machine. Whether a given local model sustains the gate is a property of the model, not of Derive's code, and no presence or wiring check can see it"
  - truth: "SC2: LM Studio and llama.cpp work through the OpenAI-compatible path"
    test: "Run LM Studio (port 1234) with a tool-use model and llama-server on port 8081 (8080 is taken by an unrelated dashboard) with --alias; confirm each row reads found, then run a lesson on each"
    expected: "Each row reads 'found on port …' after a rescan, lists models, accepts Use this provider, and a lesson plans/quizzes/locks. A model NOT trained for tool use is refused with the approved sentence and is not stored on the row. An older llama.cpp build with no chat_template_caps still offers a tool-capable model rather than refusing it"
    why_human: "No lms or llama-server binary on this machine. The refusal half is fully covered by pure-parser tests; the 'works' half needs a live server"
  - truth: "SC3: Test teaching reports a PASS on a model that really can teach"
    test: "With a provider configured, press 'test teaching' on the active row, then on the Claude Code and Codex rows while a different row is active"
    expected: "'Pass · taught one node and passed one graded quiz · {ms} ms' in moss on a capable model; the active row never changes. Afterwards Home shows no new lesson, the Atlas no new nodes, and the Usage total is unchanged"
    why_human: "The pass path is deliberately untested by design — the PROV-11 prohibition forbids manufacturing a pass from a stub, so all seven committed tests assert only fail paths. Only a real model can produce the pass line, and that is the correct trade"
  - truth: "SC4: The nightly conformance workflow actually dispatches, and a replay reports verdicts that HELD"
    test: "After this phase merges to main: `gh workflow run conformance.yml`, then `gh run list --workflow conformance.yml --limit 1` and open the uploaded artifact. Separately, run `pnpm conformance` with a valid key or a local model"
    expected: "The run completes and uploads a `conformance` artifact whose conformance.md lists every provider exactly once. A row with a working model reads pretest/gate/cumulative as held rather than as a failure"
    why_human: "GitHub resolves both schedule and workflow_dispatch against the default branch only, so this cannot be exercised before merge — and that split was an explicit owner decision. I verified the harness end to end locally (see Behavioural Spot-Checks), including a real failed row and a non-zero exit, but never a replay whose verdicts held"
  - truth: "E5 Usage header + grand total / static-content (overflow): the header and the grand total stay on one line at 375px, and the serif em phrase truncates before the total does"
    test: "Open /usage with several lessons recorded and narrow the viewport to 375px"
    expected: "'Usage · what learning has cost' and the grand total each stay on one line; the em phrase truncates while the gold Display-size figure keeps its column"
    why_human: "The class contract is right (the total is shrink-0 truncate, the summary is min-w-0 truncate, so the summary gives way first), but whether both actually hold one line at 375px is a rendered-layout fact no static read establishes"
---

# Phase 4: Local Models, Parity Proof and Usage — Verification Report

**Phase Goal:** The learner can run Derive free and offline on a local model without the method silently degrading, can prove any chosen model runs the method before investing a session, and can see what learning has cost across every provider.
**Verified:** 2026-10-22T23:58:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## What I Went Looking For

The brief named one failure mode as the highest-value thing to hunt: a test or a code path that manufactures a live-provider pass from a fake. **I did not find one.** I looked at it from four directions and all four came back clean:

- **`testTeaching`'s pass condition** (`server/src/capability.ts:746`) is a `quiz_result` event with `result === 'correct'`, graded by `actions.ts` from a `quiz` tool call the model itself made. There is no cache, no memoisation, no early return, and no stub branch.
- **All seven committed `test-teaching` tests assert `ok === false`.** Not one asserts a pass. `grep` for a pass assertion in that block returns nothing. The two most interesting of them (`server/test/api.test.ts:739`, `:763`) run with *no override of any kind* and prove the request reached the pressed row's own address while a different row was active.
- **The override seams cannot be reached from outside the process.** `setDriverOverride`, `setModelOverride`, `setStepCapOverride`, `setSleepOverride` and `setProofDeadlineOverride` are exported functions with no route, header, env var or config file behind them — confirmed by grepping every call site in `server/src`, `web/src` and `scripts`.
- **The conformance harness contains no stub.** The only occurrence of the word is its own header explaining why a stub would answer a different question. Its verdicts are read from the real `db.hasUnderstandingPass` and `db.cumulativeStatus`.

The gaps I did find are elsewhere, and they are smaller: two UI-SPEC states on the lesson refusal card that were marked covered but not implemented, and two declared source gates that do not exist.

## Goal Achievement

### Observable Truths

Merged from the 5 ROADMAP Success Criteria (the contract) and the 5 plans' `must_haves.truths`, deduplicated.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | **SC1** Lesson completes on Ollama with the network off; an over-window prompt refuses with a clear card instead of teaching without the gate | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Refusal half fully verified (rows 6–8). The offline-lesson half needs a live Ollama — no binary, nothing on 11434 |
| 2 | **SC2** LM Studio and llama.cpp work through the OpenAI-compatible path; a model that cannot call tools is refused naming the missing capability | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Refusal half fully verified (rows 20–27). The "works" half needs a live server — no `lms`, no `llama-server` |
| 3 | **SC3** From Settings, Test teaching runs one node and one graded quiz and reports pass or fail | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Every fail path verified (rows 29–34). The pass path is untested *by design* — the PROV-11 prohibition forbids faking it |
| 4 | **SC4** A nightly harness replays a scripted lesson on every configured provider and reports whether the gate, pretest and cumulative quiz held | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | I ran the harness twice for real (see spot-checks): 10/10 rows reported, a real failed row against api.anthropic.com, exit 1. Not verified: the nightly firing on `main`, and a replay whose verdicts *held* |
| 5 | **SC5** The Usage page, reached from Settings, shows a running total per learner by provider, model and lesson, tokens-only for subscription and local | ✓ VERIFIED | `/usage` route (`main.tsx:24`), only entry is `Settings.tsx:187`, 9 payload states tested in `usage.test.ts:434-681`, live payload confirmed `{total:null,…,lessons:0,groups:[]}` — null, never zero |
| 6 | A lesson turn on the Ollama row goes out with `options.num_ctx` from the stored setting | ✓ VERIFIED | `adapters.ts:460`; `local.test.ts:130` intercepts the **real adapter's outgoing HTTP body** and asserts `num_ctx` = default, then 65536 after a write. `think: false` asserted too |
| 7 | `headroomCheck` counts the serialised tool surface alongside instructions, history and prompt | ✓ VERIFIED | `context.ts:88` sums four `estimateTokens` calls including `input.tools`; key link `headroomCheck\(\{[^}]*tools` found in `drivers/api.ts` |
| 8 | An over-window local turn is refused before the request leaves, with the num_ctx sentence whose one link is Settings — never the Home sentence | ✓ VERIFIED | Two separate constants in `context.ts` (`REFUSAL` / `NUM_CTX_REFUSAL`), branched on `input.window != null`; `local.test.ts:187` asserts the refusal fires with a `neverAsked` model stub that must never be called; `Lesson.tsx:448` `NEXT_STEPS` checks `Settings` before `Home` |
| 9 | Every local row gets compact tool descriptions and an outline-only material section, and the method's gate text is byte-identical to the cloud rendering | ✓ VERIFIED | `local.test.ts:366` asserts the method prose is **byte-identical** between `materialsSection(id)` and `materialsSection(id,{outlineOnly:true})`; `shortened()` is always a prefix, asserted per tool at `local.test.ts:147`; `pnpm method:check` green |
| 10 | A local lesson that reported counts reads `not billed`; one that reported none reads `not reported`; neither ever shows money | ✓ VERIFIED | `usage.test.ts:567` and `:607`, plus `:623` for `under $0.01` rather than a rounded-away zero |
| 11 | The num_ctx field exists only where Derive sends a window; other rows refuse a num_ctx write naming the row | ✓ VERIFIED | `index.ts:653` refuses with `${spec.label} does not take a context window…`. Note: CR-02 **narrowed** this from "the three local rows" to Ollama only, which is stricter than the must-have and correct — LM Studio and llama.cpp serve whatever they were started with |
| 12 | E1 empty: the row plays the shipped `not configured` pill and its note | ✓ VERIFIED | `ProviderRow.tsx:10` status pill branch |
| 13 | E1 loading: the `checking` pulse pill with `animate-pulse motion-reduce:animate-none`; first paint never blocks on the probe | ✓ VERIFIED | `ProviderRow.tsx:9` |
| 14 | E1 error: a failed probe renders the provider's verbatim sentence on `errLine`; typed base URL and model id stay in their fields | ✓ VERIFIED | `errLine` from `fields.ts`; no `setModel('')`/`setBase('')` on the error path |
| 15 | E1 long-text: a long model id and base URL are mono and truncate inside their lines; neither widens the card | ✓ VERIFIED | `ProviderRow.tsx:273`, `:343`, `:581` — `${field} font-mono h-10` inputs, which scroll their own content |
| 16 | E2 loading: the card renders only after the turn's failure is known; no skeleton of its own | ✓ VERIFIED | `useLesson.ts:94` appends the error item only on `turn_end` with `ok:false` |
| 17 | E2 error: the card is itself the error surface — one sentence + one Settings link, no secondary error state | ✓ VERIFIED | `Lesson.tsx:361` single div; `withNextStepLink` splits once on a literal word or not at all |
| 18 | E2 overflow: the refusal sentence wraps inside `max-w-[62ch]`; the model id and estimate never force a horizontal scroll | ✗ **FAILED** | No `max-w-[62ch]` anywhere in `Lesson.tsx`. The card inherits `max-w-[680px]`. UI-SPEC:238 names 62ch and is marked `✅ covered` |
| 19 | E2 long-text: a long model id inside the refusal sentence wraps rather than clipping | ✗ **FAILED** | No `break-words`/`wrap-anywhere` on the card and no global `overflow-wrap` in `index.css`. An unbroken llama.cpp file-path model id overflows |
| 20 | A model whose server says it cannot call tools is refused at config/probe time and cannot be made active | ✓ VERIFIED | `verdictOf` (`capability.ts:264`) returns `selectable:false` only on a positive `no`; `capability.test.ts:99`, `:106` assert the verbatim sentence |
| 21 | A model whose server says *nothing* about tool calling is NOT refused: the verdict falls through to one real tool-call round-trip | ✓ VERIFIED | `capability.ts:565` routes `'unknown'` to `roundTrip`; `capability.test.ts:137`, `:144`, `:190`, `:266` cover older llama.cpp and v0-only LM Studio. WR-01 added a **second** ask before believing an inferred `no` (`capability.ts:453`) |
| 22 | A model whose maximum window is below 16384 is refused, symmetric with the tool refusal | ✓ VERIFIED | `capability.ts:266`; `capability.test.ts:114` refuses under the floor, `:125` allows exactly at it, `:144` does not refuse a small window known only through silence |
| 23 | Every liveness and capability predicate reads a parsed JSON field, never a 200 status code | ✓ VERIFIED | `capability.test.ts:211` (dashboard answering HTML on /props), `settings.test.ts:445` (HTML 200 reads `not configured`, never `found`) — **and confirmed live**: my harness run skipped llama.cpp on port 8080 with "no llama.cpp server answered" while that dashboard was answering 200 there |
| 24 | Metadata is read for the whole list on open/Rescan — no request reaching a completion endpoint — and the round-trip runs once for the selected model | ✓ VERIFIED | `capabilityList` key link found in `index.ts`; WR-03 made a rescan forget every local row's verdicts, found or not |
| 25 | A non-selectable model is refused by the write *and* the activation, in Derive's own sentence | ✓ VERIFIED | `capabilityRefusal` key link found at both sites in `index.ts`; WR-05 fixed it to resolve the asking learner's model |
| 26 | The capability probe lives only on the three dedicated local rows; the generic row is refused naming it | ✓ VERIFIED | `readCapability` switches on the three ids only; `index.ts` refuses otherwise. WR-02 bound the route's model id by the one `ModelId` schema (`index.ts:774`) |
| 27 | The lesson-time capability refusal card remains the backstop, carrying the approved sentence whose one link is Settings | ✓ VERIFIED | `local.test.ts:233` asserts a turn on a ladder-refused model is refused before the request with the capability sentence |
| 28 | E1 partial: a reachable server exposing no tool-capable model still renders `found` and its usable models, with the capability note | ✓ VERIFIED | `ProviderRow.tsx:651` comment and render — the status pill and model list are untouched by the capability line |
| 29 | The run happens in an ephemeral scratch lesson deleted in the same request, transactionally; nothing appears in Home, the Atlas or the Usage total | ✓ VERIFIED | `deleteLesson` in a `finally` (`capability.ts:783`); every one of the 7 tests ends on `assert.deepEqual(counts(), was)` over lessons, usage, scratch, stats, nodes, memory and misconceptions |
| 30 | The test's tokens never reach the Usage total — `deleteLesson` clears usage rows by construction, with no special case in `recordUsage` | ✓ VERIFIED | `api.test.ts:645` builds a crashed probe *with* a usage row and proves the sweep removes it; `usage.test.ts:223` proves usage rows leave in the lesson's own transaction |
| 31 | A scratch lesson surviving a crash is swept at the next boot | ✓ VERIFIED | `sweepScratchLessons` key link found in `index.ts` boot sequence; `api.test.ts:645` asserts the live row never reaches `allNodes`, `listMemory`, `listMisconceptions` or `dueNodes` in the meantime |
| 32 | The action appears on every teachable row, including the Claude Code and Codex login rows | ✓ VERIFIED | All 10 catalogue rows are `teaches: true` (`providers.ts`), 0 are false; the control keys on `row.teaches` (`ProviderRow.tsx:630`) not an id list; `api.test.ts:775` fails if a non-teaching row is ever added |
| 33 | The probe runs on the row the learner pressed, not on whatever is active; pressing changes nothing about which provider is active | ✓ VERIFIED | `driverFor` extracted and asserted stable across an active-row switch (`api.test.ts:697`); `:739` and `:763` run with **no override** and prove the request hit the pressed row's address while Anthropic was active |
| 34 | The three failure readouts are the approved sentences, each mapped to one observable loop outcome | ✓ VERIFIED | `NO_TOOLS` and `UNGRADABLE` as consts in `capability.ts:595-596`; the third (`nothing answered at {host}:{port}`) comes from `probe.ts` and is never copied. Asserted verbatim at `api.test.ts:571`, `:592`, `:770` |
| 35 | E3 loading: the button reads `testing…` and one mono `role=status` line pulses teal | ✓ VERIFIED | `ProviderRow.tsx:660` with `motion-reduce:animate-none` |
| 36 | E3 error: `Fail · {reason}` in rust on one line with the hint beneath | ✓ VERIFIED | `ProviderRow.tsx:664-669` |
| 37 | E3 overflow: the readout is capped to one line with full text in the title | ✓ VERIFIED | `resultLine` = `min-w-0 max-w-full truncate font-mono text-[10px]` + `title` |
| 38 | E3 long-text: a long fail reason truncates with ellipsis and stays readable in the title | ✓ VERIFIED | same |
| 39 | The harness drives real configured models, not a stub | ✓ VERIFIED | **Proven live**: with a canary key the harness made a real request to api.anthropic.com and recorded `failed … invalid x-api-key`. No mock/stub/fake token anywhere in the script |
| 40 | It exercises every provider in the environment and records an explicit `skipped` line with the reason for each it could not reach | ✓ VERIFIED | **Proven live**: 10 providers, 10 explicit lines, each with a reason (no key / no endpoint / nothing answered / logins need --logins) |
| 41 | It writes JSON and Markdown per run and exits non-zero on any failure; CI uploads the artifact | ✓ VERIFIED | **Proven live**: both files written; one failed row → `exit 1`; `upload-artifact@v7` with `if: always()` in the workflow |
| 42 | The exit code is a pure function of the report, exported, so the failing path is checkable with no provider, key or model | ✓ VERIFIED | **Proven live**: `exitCodeFor` gives failed=1, skipped=0, mixed=1, empty=0; importing the module runs no main body and exports exactly `exitCodeFor` |
| 43 | No learner-facing surface is added by the harness or the telemetry | ✓ VERIFIED | No route in `index.ts`, no event type in `events.ts` or `useLesson.ts`, nothing under `web/src`. (Enforcement gate missing — see gaps) |
| 44 | The rejection rate counts schema-rejected tool calls only, per provider and model, with no runtime effect | ✓ VERIFIED | One call site (`drivers/api.ts:465`) inside the `validateToolInput` catch, error rethrown unchanged, return value unused; `usage.test.ts:170` proves provider and model come off the turn, never the caller |
| 45 | The nightly workflow carries `workflow_dispatch` beside its cron | ✓ VERIFIED | YAML parses; triggers are exactly `['schedule','workflow_dispatch']`; cron `37 3 * * *` deliberately off the hour |
| 46 | No provider key or error body reaches the report un-redacted | ✓ VERIFIED | **Proven live**: a canary key `sk-ant-CANARY-d0n0tl3ak-9f3a2b` in the environment produced a failed row reading `invalid x-api-key` and the string appears **nowhere** in either the JSON or the Markdown. WR-06 routed the two fatal paths through the same chokepoint |
| 47 | Subscription and local lines carry tokens only and no money figure | ✓ VERIFIED | `usage.test.ts:567`, `:607` |
| 48 | Every money string and label word is produced once server-side by `costLabel`; the browser never formats a number | ✓ VERIFIED | `costOf\|costLabel` key link found in `usage.ts`; `Usage.tsx` contains no `toFixed`, `Intl.NumberFormat` or assembled `$` — only the prose comment naming them. (Enforcement gate missing — see gaps) |
| 49 | The page is scoped to the learner the server resolved, never a caller-supplied id | ✓ VERIFIED | `index.ts:1183` is `learnerUsage(learnerOf(c))` and nothing else; `usage.test.ts:662` asserts it answers the resolved learner's rows and nobody else's |
| 50 | A lesson mixing priced and subscription rows takes the weakest label; a tokens-only line still renders | ✓ VERIFIED | `usage.test.ts:587`, and `:400` for the lesson-header twin |
| 51 | E4 empty: the documented `Nothing spent yet` heading and body; no placeholder rows | ✓ VERIFIED | `Usage.tsx:120-125`, gated on `view.lessons > 0`; live payload returns `lessons: 0` with `total: null` |
| 52 | E4 loading: a mono `role=status` line; never a half-drawn list or a zeroed total | ✓ VERIFIED | `Usage.tsx:65` |
| 53 | E4 error: Derive's error line on `errLine` with a retry affordance; no stale or zeroed total shown as truth | ✓ VERIFIED | `Usage.tsx:70-76` |
| 54 | E4 populated: provider groups with model then lesson lines inside `max-w-[760px]` | ✓ VERIFIED | `Usage.tsx:60` |
| 55 | E4 partial: weakest label; tokens-only line still renders | ✓ VERIFIED | `usage.test.ts:587`, `:567` |
| 56 | E4 overflow: the list scrolls in `.scroll-thin`; each line truncates rather than widening | ✓ VERIFIED | `Usage.tsx:59` plus `truncate` + `title` on every line |
| 57 | E4 zero-one-many: 0 gives empty copy; 1 gives singular nouns; many grows without pagination | ✓ VERIFIED | `usage.test.ts:524`, `:535`, `:552` — the singular nouns are the server's |
| 58 | E5 overflow: header and grand total stay on one line at 375px; the serif em truncates before the total | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Class contract is right (total `shrink-0 truncate`, summary `min-w-0 truncate`, so the summary yields first) but a 375px rendered layout is not a static fact |
| 59 | E5 long-text: a long total or provider phrase wraps or truncates without pushing the figure off-screen; the total keeps its column | ✓ VERIFIED | `Usage.tsx:84-89` — `shrink-0` on the gold figure is what keeps the column |

**Score:** 52/59 truths verified (5 present, behaviour-unverified; 2 failed)

### Required Artifacts

All 18 declared artifacts across the 5 plans pass Levels 1–3 (exists, substantive, wired). `gsd-tools query verify.artifacts` returns `all_passed: true` for every plan.

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `server/src/settings.ts` | `numCtxKey`, `numCtxFor`, `NUM_CTX_FLOOR`, `NUM_CTX_DEFAULT`, `modelFor` | ✓ VERIFIED | 256 lines. **Owner decision A-01 honoured**: `NUM_CTX_FLOOR = 16_384` (line 71) and `NUM_CTX_DEFAULT = 32_768` (line 79) are two separately-named exports, not collapsed |
| `server/src/drivers/adapters.ts` | the three local adapter rows replacing three throwing cases | ✓ VERIFIED | 529 lines; `case 'ollama'` (422), `'lmstudio'` (484), `'llamacpp'` (512); `local.test.ts:344` asserts none throws |
| `server/src/context.ts` | tool-and-window-aware `headroomCheck` with two distinct refusals | ✓ VERIFIED | 93 lines, pure, no I/O |
| `server/test/local.test.ts` | the no-server proof | ✓ VERIFIED | 393 lines (min 80); 10 tests; header states its own limits honestly |
| `server/src/capability.ts` | three parsers, three-valued `Capability`, two-tier `capabilityOf`, `capabilityList`, `testTeaching` | ✓ VERIFIED | 807 lines |
| `server/src/probe.ts` | `postJson` for Ollama's POST-only `/api/show` | ✓ VERIFIED | 403 lines |
| `server/test/capability.test.ts` | pure parser cases from the research JSON | ✓ VERIFIED | 351 lines (min 90); 36 tests, no server, no database |
| `server/src/migrations.ts` | migration 8 (`lessons.scratch`) and migration 9 (`tool_rejections`) | ✓ VERIFIED | `version: 8` at 306, `version: 9` at 319; table + 2 indexes; `migrations.test.ts:579` and `:606` |
| `server/src/agent.ts` | `driverFor` + `runTurn`'s per-turn provider-and-model option | ✓ VERIFIED | `export function driverFor` present; asserted stable under an active-row switch |
| `server/src/db.ts` | `scratch` on `createLesson`, `listLessons` excluding scratch, `sweepScratchLessons` | ✓ VERIFIED | CR-03 extended `scratch = 0` to **10** lesson-joining reads, not two |
| `scripts/conformance.mjs` | the one harness, both environments, exporting `exitCodeFor` | ✓ VERIFIED | 622 lines (min 150); shebang present; `node --check` clean; ran for real twice |
| `.github/workflows/conformance.yml` | nightly schedule + dispatch + setup + artifact upload | ✓ VERIFIED | YAML parses; no `continue-on-error`, so a harness failure reddens the job |
| `server/src/usage.ts` | the learner's total grouped by provider/model/lesson, strings from `costLabel` | ✓ VERIFIED | 227 lines |
| `web/src/pages/Usage.tsx` | the page that formats no number | ✓ VERIFIED | 133 lines (min 60) |
| `web/src/main.tsx` | the `/usage` route | ✓ VERIFIED | line 24 |

### Key Link Verification

All 18 declared key links verified across the 5 plans (`verify.key-links` returns `all_verified: true`, 3+5+4+3+3). The load-bearing ones, re-checked by hand rather than by pattern:

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `drivers/adapters.ts` | `settings.ts` | the Ollama row reads the window through `numCtxFor('ollama')` | ✓ WIRED | Line 460, not a literal — and the captured outgoing body proves it reaches the wire |
| `drivers/api.ts` | `context.ts` | the headroom call passes the tool projection and the local window | ✓ WIRED | Pattern `headroomCheck\(\{[^}]*tools` matched |
| `pages/Lesson.tsx` | `context.ts` | the card links the literal word the sentence carries | ✓ WIRED | `NEXT_STEPS` checks `Settings` before `Home`; order documented as load-bearing |
| `capability.ts` | `agent.ts` | the probe runs one real turn via `runTurn` + `driverFor`, never the global test override | ✓ WIRED | `runTurn(lessonId, PROBE_PROMPT, { tutor: { provider: spec.id, model } })` |
| `capability.ts` | `db.ts` | the scratch lesson goes through transactional `deleteLesson` | ✓ WIRED | In a `finally`, so a throw still takes the lesson and its usage rows |
| `drivers/api.ts` | `db.ts` | the rejection is recorded at the one `validateToolInput` throw site | ✓ WIRED | Line 465; error rethrown unchanged |
| `scripts/conformance.mjs` | `server/src/secrets.ts` | every env key registered, every sentence redacted | ✓ WIRED | Proven live by the canary |
| `pages/Settings.tsx` | `pages/Usage.tsx` | a Settings link is the only way in | ✓ WIRED | `Settings.tsx:187`; nothing in the default UI links to it |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `web/src/pages/Usage.tsx` | `view` (total, summary, groups) | `api.usage()` → `GET /api/usage` → `learnerUsage(learnerOf(c))` → `usage`/`turns`/`lessons` tables via `cost.ts` | Yes — live call returned a real composed payload | ✓ FLOWING |
| `web/src/components/ProviderRow.tsx` | `capability` | `POST /api/settings/:provider/capability` → `capabilityOf` → parsed server metadata | Yes | ✓ FLOWING |
| `web/src/components/ProviderRow.tsx` | `proof` | `POST /api/settings/:provider/test-teaching` → `testTeaching` → real `runTurn` event log | Yes | ✓ FLOWING |
| `web/src/components/ProviderRow.tsx` | `row.num_ctx`, `row.num_ctx_default` | `GET /api/settings` → `getSetting(numCtxKey(id))` / `NUM_CTX_DEFAULT` | Yes — `num_ctx_default` is null on every non-Ollama row, so the field renders only where it means something | ✓ FLOWING |
| `web/src/pages/Lesson.tsx` | refusal `it.text` | `turn_end` payload `error` from `headroomCheck` / `capabilityRefusal` | Yes | ✓ FLOWING |

No hollow props, no static fallbacks, no hardcoded empties on any rendered path.

### Behavioural Spot-Checks

I ran these myself rather than reading the recorded commands.

| Behaviour | Command | Result | Status |
|-----------|---------|--------|--------|
| Full phase gate | `pnpm method:check && pnpm typecheck && pnpm test` | **500 tests, 116 suites, 0 fail, exit 0** | ✓ PASS |
| Build | `pnpm build` | exit 0 | ✓ PASS |
| `exitCodeFor` is pure and correct | `node -e "import {exitCodeFor}…"` | `failed=1 skipped=0 mixed=1 empty=0` | ✓ PASS |
| Main-guard: importing runs no main | `await import('./scripts/conformance.mjs')` | imported cleanly; exports exactly `exitCodeFor` | ✓ PASS |
| Harness: complete all-skipped report | `node scripts/conformance.mjs --out …` (no keys) | **10 providers, 10 explicit skipped lines each with a reason, exit 0**, JSON + MD written | ✓ PASS |
| Port-8080 false positive rejected live | same run | `skipped llama.cpp — no llama.cpp server answered at http://127.0.0.1:8080` **while the unrelated dashboard was answering 200 text/html there** | ✓ PASS |
| Harness drives a real provider | same, with a canary `ANTHROPIC_API_KEY` | `failed Anthropic · claude-opus-5-5 — invalid x-api-key (pretest, gate, cumulative did not hold)` — a real request left the machine | ✓ PASS |
| Non-zero exit on a real failed row | same | **exit 1** | ✓ PASS |
| Secret redaction in the written report | `grep -rn 'CANARY\|d0n0tl3ak\|sk-ant'` over both reports | **no match** — key absent from JSON and Markdown | ✓ PASS |
| Run block records what it ran under | inspect report JSON | `reliable_tool_calling: false`, `think: false`, `logins_included: false`, `timeout_ms` | ✓ PASS |
| Verdicts reported per row | inspect report JSON | `verdicts: {pretest:false, gate:false, cumulative:false}` + `rejections` + `cumulative_nodes` | ✓ PASS |
| `GET /api/usage` on an empty learner | live scratch server on 4398 | `{"total":null,"summary":null,"lessons":0,"tokens":null,"groups":[]}` — **null, never 0** | ✓ PASS |
| Workflow YAML is valid | `yaml.safe_load` | triggers `['schedule','workflow_dispatch']` | ✓ PASS |
| Live lesson on a local model | — | no `ollama`/`lms`/`llama-server` on this machine | ? SKIP → human |
| Nightly workflow dispatch | — | GitHub resolves `workflow_dispatch` against the default branch only; requires merge | ? SKIP → human |

### Probe Execution

No `scripts/*/tests/probe-*.sh` files exist in this repo and no plan declares one. The phase's runnable check is `scripts/conformance.mjs`, which I executed three times — results in the table above.

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| n/a — no probe convention in this project | — | — | SKIPPED (none declared, none conventional) |

### Prohibitions

| # | Requirement | Tier | Statement (abbreviated) | Disposition |
|---|-------------|------|--------------------------|-------------|
| P1 | PROV-06 | test | Compaction may never shorten the method's gate/discipline/checks text | ✓ VERIFIED — enforced by the byte-identical assertion at `local.test.ts:386` plus `pnpm method:check`; `shortened()` reaches tool descriptions only and is asserted to be a prefix |
| P2 | PROV-07 | test | Absent capability metadata must never be reported as a refusal | ✓ VERIFIED — `verdictOf` refuses only on a positive `no`; four tests cover older llama.cpp and v0-only LM Studio; WR-01 added a second ask before an *inferred* no |
| P3 | PROV-11 | judgment | Test teaching must never report a pass a real model did not produce | ⚠️ FLAGGED — **unverified-prohibition, human review recommended.** My non-authoritative judge verdict: **holds.** The pass requires a server-graded `quiz_result` from a tool call the model made; all 7 tests assert fail paths only; the override seams have no route/env/header. See "What I Went Looking For" |
| P4 | PROV-13 | judgment | The report must never read healthy by omission, nor count a repair layer's correction as the model's own success | ⚠️ FLAGGED — **unverified-prohibition, human review recommended.** Judge verdict: **holds**, and unusually well-evidenced: I observed 10/10 rows accounted for, `reliable_tool_calling: false` recorded in the report's own run block, and the rejection counter at the single `validateToolInput` throw site |
| P5 | PROV-13 | test | The tool-rejection rate must never be shown to the learner or change what Derive does | ⚠️ UNVERIFIED (gap) — the *fact* holds and I confirmed it, but the declared source gate does not exist. Fail-closed |
| P6 | COST-03 | test | No money figure on a moneyless path including a zero; no number formatted in the browser | ⚠️ PARTIAL (gap) — the money half is genuinely tested (`$0.00` never, `under $0.01`, `weakestSource`); the no-browser-formatter half has no source gate |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PROV-06 | 04-01 | Run the tutor on a local Ollama model, offline, with the window sized so the method is never silently truncated | ✓ SATISFIED (code) / ? NEEDS HUMAN (offline lesson) | `num_ctx` on the captured outgoing body; tool surface counted; method text byte-identical. The offline lesson itself needs Ollama |
| PROV-07 | 04-02 | LM Studio / llama.cpp with capability probes that refuse clearly when tool calling is unsupported | ✓ SATISFIED (code) / ? NEEDS HUMAN (live servers) | Three parsers, three-valued verdict, floor refusal, write + activation refusals, lesson-time backstop |
| PROV-11 | 04-03 | A "test teaching" smoke test from Settings: one node, one graded quiz | ✓ SATISFIED (fail paths + routing + cleanup) / ? NEEDS HUMAN (pass path) | 7 tests, all fail paths; pressed-row routing proven without overrides; full DB-invariance after each run |
| PROV-13 | 04-04 | A conformance harness replaying a scripted lesson per provider, asserting gate/pretest/cumulative; runs nightly | ✓ SATISFIED (harness) / ? NEEDS HUMAN (nightly dispatch, held verdicts) | Ran live: complete report, real provider contacted, exit 1 on failure, redaction proven |
| COST-03 | 04-05 | A usage page with a running total per learner by provider, model and lesson, tokens-only for subscription and local | ✓ SATISFIED | Route, single entry point, 9 payload states tested, live payload confirmed, no browser formatter |

**Orphaned requirements:** none. REQUIREMENTS.md:215 maps exactly PROV-06, PROV-07, PROV-11, PROV-13, COST-03 to Phase 4, and all five are claimed by a plan's `requirements` field.

### Anti-Patterns Found

Scanned all 37 implementation files changed between `3b3babf` and `b145e9f`.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | `TBD` / `FIXME` / `XXX` | — | **None.** Zero debt markers in any changed file |
| — | — | `TODO` / `HACK` / `PLACEHOLDER` | — | **None** |
| — | — | stub prose (`coming soon`, `not yet implemented`) | — | **None.** All `placeholder` hits are legitimate HTML input placeholders or prose comments |
| `web/src/pages/Lesson.tsx` | 361 | refusal card missing the UI-SPEC's width and wrapping treatment | ⚠️ Warning | Gaps 1 and 2 |
| `server/test/` | — | two declared source gates absent | ⚠️ Warning | Gaps 3 and 4 |
| `.planning/…/04-UI-SPEC.md` | 108 | one signed-off row edited in place (`Primary CTA`) in commit `523a661`, alongside the correctly appended `## Amendments` section | ℹ️ Info | Owner decision A-03 said "never by rewriting a signed-off row", and the appended note repeats that rule. The edit only redirects the parenthetical to `see §Amendments` — substance unchanged, discipline technically broken |
| ROADMAP | — | phase carries `mode: mvp` but the goal is not a User Story | ℹ️ Info | `user-story.validate` returns `valid: false` on all three slots. I verified against the 5 ROADMAP Success Criteria instead, which is the stronger contract, and omitted the User Flow Coverage section rather than produce a low-quality one |
| `.planning/REQUIREMENTS.md` | 28-49, 154-169 | all five IDs already marked `[x]` / `Complete` | ℹ️ Info | Four of them (PROV-06/07/11/13) still depend on live-server human checks. The mark is slightly ahead of the evidence |

### Deferred Items

None. I checked Phases 5 (Learning Experience), 6 (Personalization) and 7 (Adoption) against each gap. Phase 6 is the nearest match in subject matter (theme, type, tone) but nothing in its goal covers the lesson refusal card's overflow treatment or a test-suite source gate, so — being conservative — no gap is deferred.

### Human Verification Required

See `behavior_unverified_items` in the frontmatter for the five routed items, and `04-USER-SETUP.md` for the owner's optional GitHub-secret work. In short:

1. **SC1** — Ollama installed, network off, a lesson that plans/quizzes/locks; then the num_ctx refusal card and its Settings link.
2. **SC2** — LM Studio on 1234 and `llama-server` on **8081** (not 8080); a non-tool-use model refused and not stored; an older llama.cpp build still offered.
3. **SC3** — a real `Pass` line, including on the Claude Code and Codex rows while another row is active.
4. **SC4** — `gh workflow run conformance.yml` after merge, plus a replay whose verdicts actually held.
5. **E5** — the Usage header and grand total at 375px.

Also recommended (judgment-tier prohibitions P3 and P4): a human read of `testTeaching`'s pass condition and of the harness's completeness posture. My verdicts on both are **holds**, but they are non-authoritative by design.

### Gaps Summary

The phase goal is substantially achieved and the honesty posture the brief asked me to attack held up under all four attacks I could mount. The phase ships a real `num_ctx` on a real outgoing request, a genuinely three-valued capability verdict that never reads silence as a refusal, a teaching proof whose pass can only come from a server-graded quiz on the pressed row's own adapter, a conformance harness I watched contact a real provider and exit non-zero with its secret redacted, and a Usage page that formats nothing in the browser. 500 tests pass. Zero debt markers.

Four gaps stand between that and a clean verdict, and they group into two concerns:

**Concern A — the lesson refusal card never got its UI-SPEC treatment (gaps 1, 2).** The refusal reuses the generic `error` timeline item rather than a dedicated card. That reuse is defensible under the simplicity rule and I would not ask for a new component, but it means two states the UI-SPEC marks `✅ covered` are not implemented: there is no `max-w-[62ch]`, and there is no word-breaking at all. The second one is not theoretical — `NUM_CTX_REFUSAL` interpolates the model id, `headroomCheck` fires with a caller-supplied window on the read-only llama.cpp and LM Studio rows, and those rows' model ids are file paths (the codebase says so in `Usage.tsx`'s own comment). A long unbroken path in that sentence overflows horizontally today. Two classes on one div close both, or an amended UI-SPEC row records the 680px column as the agreed bound.

**Concern B — two declared source gates do not exist (gaps 3, 4).** Both the PROV-13 values prohibition and the COST-03 prohibition name "a source gate" in their `resolution`. No test in `server/test/` reads any file under `web/src`. The facts both gates were meant to lock in are true right now — I verified each by hand — so nothing is broken for a learner today. What is missing is the thing that keeps them true: the tool-rejection identifier could drift into the UI, or a `toFixed` into the Usage page, and nothing would catch it. These are the cheapest two gaps in the list: two `readFileSync` assertions.

Neither concern defeats the phase goal, and neither touches the live-provider proofs. Those five items are correctly parked for a human with a local model and a merged branch, exactly as the plans intended — and I want to be explicit that their absence here is the planned state, not an execution failure.

---

_Verified: 2026-10-22T23:58:00Z_
_Verifier: Claude (gsd-verifier)_
