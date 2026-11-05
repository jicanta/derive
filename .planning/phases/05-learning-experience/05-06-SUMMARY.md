---
phase: 05-learning-experience
plan: 06
subsystem: api
tags: [fsrs, remediation, node-sqlite, hono, prompts, conformance, misconceptions]

# Dependency graph
requires:
  - phase: 05-learning-experience
    provides: "`gradeQuiz` as a standalone export outside the promise closure, reachable by both the live answer route and the restore path (05-03) — the graded exit from the remediation gate lives inside it, which is what makes a restored card lift the gate too"
  - phase: 05-learning-experience
    provides: "`REQUEST_RETENTION` as the scheduler's one exported constant (05-04), so this plan added a ranking to `schedule.ts` without a second copy of 0.9 appearing beside it"
provides:
  - "`weakestFirst(deps, now)` in `server/src/schedule.ts`: a pure ranking of a node's own direct dependencies — lowest retrievability, then a miss ahead of a pass, then status — with both tie-breaks precomputed onto row-shaped inputs, so no database is pulled in"
  - "`DependencyRank`, the input shape, and `STATUS_WEAKNESS`/`weakness` behind it (shaky, pending, teaching, locked; an unknown status ranks with locked)"
  - "One named prerequisite, by label and bracketed id, on all three miss paths: the cumulative miss, the shaky branch of `node_status`, and the after-quiz miss branches, which named none at all"
  - "`remediation` (the module-level open-gate map), `openRemediation`, `clearRemediation`, `remediationRefusal` in `server/src/actions.ts`"
  - "The external action route answers that refusal as a 400 with the sentence intact; `quiz()` returns it to the in-process drivers before any card is opened"
  - "Two exits, both the learner's: a graded fresh quiz on a node the gate holds the tutor to (inside `gradeQuiz`, hence on the restore path too), and anything the learner types (cleared at the top of the message route and on the steer branch)"
  - "`misconceptionsOn(lessonId, nodeId)` in `server/src/db.ts`: lesson- and node-scoped, newest first, resolved rows not demoted"
  - "`misconceptionMaterial` on the tool result that starts a node — the teaching state and the remediation path, merged into the shaky instruction rather than over it"
  - "Review and warm-up turn prompts that ask for the next due question inside the same turn, with nothing between the verdict and that question (D-17 as re-read)"
  - "A fourth `remediation` verdict and report column in `scripts/conformance.mjs`, and an `exitCodeFor` that fails on a false verdict in its own right"
  - "`dependencyRecord` and the phrase it carried are gone"
affects: [05-07, 05-08]

# Actuals (#2632) — same instrument as the plan's `estimate.tokens`, which 05-03
# and 05-04 both used: chars/4 over the full content of the files actually
# changed (eight files, 394,252 chars). The plan estimated 60,000 on
# raw_tokens: 120,000; the miss is in the files, not in the diff.
actuals:
  tokens: 98563
  diff_tokens: 13799   # chars/4 over the realized diff alone (55,195 chars)
  tasks: 3
  commits: 3           # MEASURED at SUMMARY write: git rev-list --count 2ad0d037..HEAD. This SUMMARY's own commit follows this line.
plan_head_before: 2ad0d037db87faf0e38a61e9e3ec3d9955f293a6

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A ranking whose keys the pure module cannot see arrives with those keys precomputed onto its input rows, so the module stays I/O-free and its order is pinned by a test that opens no file"
    - "The sentence that names a node and the gate that enforces it are produced by one function, so the two cannot disagree about which node it is"
    - "A method gate holds against the model and never against the learner: every exit is something the learner does or triggers, and the permitted set is widened rather than narrowed when the method's own next move would otherwise be refused"
    - "A nightly verdict is only real if the exit code fails on it directly, not merely through a status another function happened to derive from it"

key-files:
  created: []
  modified:
    - server/src/schedule.ts
    - server/src/actions.ts
    - server/src/db.ts
    - server/src/index.ts
    - server/src/prompt.ts
    - server/test/schedule.test.ts
    - server/test/api.test.ts
    - scripts/conformance.mjs

key-decisions:
  - "The gate permits the named prerequisite AND the node whose check just missed. A gate holding only the prerequisite would refuse the method's own next move after an ordinary miss — `afterQuiz`'s two miss sentences both prescribe a fresh quiz on the same claim — so it would be refusing the method it exists to enforce. See deviation 1."
  - "A graded quiz on either permitted node lifts the gate, and the instruction built from that grading re-arms it if that answer missed too. The refusal therefore binds the very next question and no more, which is the tightest form that can never trap anyone."
  - "`weakestFirst` went into `server/src/schedule.ts` rather than beside the instruction in `actions.ts` (D-21 discretion), with `missed` and `status` riding in as precomputed fields. The miss flag comes out of `quizzesOn` — the same per-node read `nodeRecord` renders a sentence from — so this added an ordering and no query."
  - "`teaching` is the fourth value of the status union and the plan named three, so it sits between `pending` and `locked`: a node being established now is further along than one never started and not yet held. An unrecognised status ranks with `locked`, because guessing that an unknown state is weak would send the remediation to the wrong node."
  - "The gate's open state is a module-level `Map` keyed by lesson id, documented as module-level state that is the module's purpose. It is lost on a restart on purpose: it is an instruction to a model whose turn did not survive either, and the next miss re-derives it from the same ranking. No migration spent."
  - "Node identity is compared by exact string equality inside the lesson. A named node that has left the graph (a re-plan) clears the gate rather than refusing forever."
  - "The misconception read drops `listMisconceptions`'s `resolved ASC` demotion and keeps the scratch join. Locking a node resolves its misconceptions, so by the time it is taught or remediated again they all carry the flag — and a resolved one is the best distractor material there is."
  - "The material carries its own prohibition in its last sentence ('never quote a past mistake back at them and never name it as theirs'), because the model reads that string and nothing else about it."
  - "`exitCodeFor` now fails on a false verdict directly, and accepts a bare array of rows as well as a finished report. Without that, the plan's own verification of the fourth verdict could not pass and a verdict added without being folded into the row status would be decorative. See deviation 2."
  - "The conformance script's remediation step names the question but deliberately not the node id: the model has to read it out of the reply `node_status` just returned, which is the only thing that makes the verdict a test of a provider rather than of the script."

patterns-established:
  - "Red before kept: all three gate groups were observed failing with their subject planted, and the failure lines are quoted below"
  - "One function produces both the instruction naming a node and the gate enforcing it"

requirements-completed: [LEARN-09, LEARN-11]

coverage:
  - id: D1
    description: "`weakestFirst` ranks only a node's own direct dependencies — lowest retrievability first, tie-broken by a miss over a pass, then by status — as a pure function that does not mutate its input and pulls no database in"
    requirement: "LEARN-09"
    verification:
      - kind: unit
        ref: "server/test/schedule.test.ts#puts the least likely recalled first"
        status: pass
      - kind: unit
        ref: "server/test/schedule.test.ts#does not mutate its input"
        status: pass
      - kind: unit
        ref: "server/test/schedule.test.ts#breaks a tie in retrievability on what this lesson's checks showed"
        status: pass
      - kind: unit
        ref: "server/test/schedule.test.ts#breaks a tie in both on status, shaky before pending before locked"
        status: pass
      - kind: unit
        ref: "server/test/schedule.test.ts#leaves a dependency with no FSRS state last, where the retrievability fallback puts it"
        status: pass
      - kind: unit
        ref: "server/test/schedule.test.ts#returns the one dependency there is, and an empty order for none"
        status: pass
      - kind: other
        ref: "test \"$(sed -E 's;//.*$;;' server/src/schedule.ts | sed -E '/^[[:space:]]*\\*/d' | grep -cE \"^import \\{[^}]*\\} from './db.js'\")\" = 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "All three miss paths name exactly one prerequisite by label and bracketed id: the cumulative miss, the shaky branch of node_status, and an ordinary failed check, which named none"
    requirement: "LEARN-09"
    verification:
      - kind: integration
        ref: "server/test/api.test.ts#names exactly one prerequisite on an ordinary failed check, which named none"
        status: pass
      - kind: integration
        ref: "server/test/api.test.ts#names one prerequisite when a node is marked shaky, and the learner's own message lifts it"
        status: pass
      - kind: integration
        ref: "server/test/api.test.ts#marks a node shaky on a cumulative miss and pulls the review of what was built on it closer"
        status: pass
      - kind: other
        ref: "test \"$(sed -E 's;//.*$;;' server/src/actions.ts | sed -E '/^[[:space:]]*\\*/d' | grep -c 'the weakest of those')\" = 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "A quiz on a node the gate does not permit is refused in the shipped `{ ok: false, refused: true, error }` shape, answered as a 400 with the sentence intact, ending in the fixed clause about this being the method"
    requirement: "LEARN-09"
    verification:
      - kind: integration
        ref: "server/test/api.test.ts#refuses a quiz on another node in the shipped shape, ending in the fixed clause"
        status: pass
      - kind: other
        ref: "test \"$(sed -E 's;//.*$;;' server/src/actions.ts | sed -E '/^[[:space:]]*\\*/d' | grep -c 'This is the method, not an error to investigate.')\" -ge 2"
        status: pass
    human_judgment: false
  - id: D4
    description: "The gate has two exits and the learner controls or triggers both: a graded fresh quiz on a node it holds the tutor to, and anything the learner types — with the graded exit inside `gradeQuiz`, so a card restored after a restart takes it too"
    requirement: "LEARN-09"
    verification:
      - kind: integration
        ref: "server/test/api.test.ts#accepts a fresh quiz on the node it named, and lets the tutor move on once that is graded"
        status: pass
      - kind: integration
        ref: "server/test/api.test.ts#names one prerequisite when a node is marked shaky, and the learner's own message lifts it (the message half: nothing graded)"
        status: pass
      - kind: integration
        ref: "server/test/api.test.ts#lifts the gate from inside the one grading function, so a restored card lifts it too"
        status: pass
    human_judgment: false
  - id: D5
    description: "A node with no direct dependencies keeps the shipped ground-truth instruction word for word and opens no gate; a node with exactly one names that one"
    requirement: "LEARN-09"
    verification:
      - kind: integration
        ref: "server/test/api.test.ts#keeps the shipped ground-truth instruction for a node with nothing below it, and opens no gate"
        status: pass
      - kind: integration
        ref: "server/test/api.test.ts#marks a node shaky on a cumulative miss... (the single-dependency case: `slope` is `step`'s only dependency and is the node named)"
        status: pass
      - kind: unit
        ref: "server/test/schedule.test.ts#returns the one dependency there is, and an empty order for none"
        status: pass
    human_judgment: false
  - id: D6
    description: "The learner's own recorded wrong claims on a node arrive as candidate distractor material on the tool result that starts the node — the teaching state and the remediation path — merged into the shaky instruction rather than over it, with no method-text change and no new surface"
    requirement: "LEARN-09"
    verification:
      - kind: integration
        ref: "server/test/api.test.ts#hands the learner's own recorded wrong claim over when the node is marked as being taught"
        status: pass
      - kind: integration
        ref: "server/test/api.test.ts#merges the material into the shaky branch's own instruction rather than over it"
        status: pass
      - kind: other
        ref: "git diff --quiet HEAD -- method/ && pnpm method:check (6 rendered copies match method/)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Review and warm-up turns ask the next due node's question inside the same turn, immediately after the verdict on the previous one, with no prose between them"
    requirement: "LEARN-11"
    verification:
      - kind: unit
        ref: "server/test/api.test.ts#asks the next due question inside the same turn, in both the review and the warm-up prompt"
        status: pass
    human_judgment: true
    rationale: "What is proven is that both turn prompts now ask for it. Whether a given model actually pipelines its questions inside one turn is a property of the model, not of the prompt, and nothing in this repo's CI drives a model. The nightly conformance harness is the only thing that would see it, and D-17 as re-read deliberately adds no conformance assertion for it (there is no new mechanism to assert). A human watching one review session on a real provider is the evidence."
  - id: D8
    description: "The nightly conformance harness carries a fourth verdict — the remediation gate held on a real provider — beside its pretest, gate and cumulative verdicts, with its own report column, and still exits non-zero on any false verdict"
    requirement: "LEARN-09"
    verification:
      - kind: other
        ref: "node -e \"...import('./scripts/conformance.mjs')... exitCodeFor([{verdicts:{pretest:true,gate:true,cumulative:true,remediation:false}}]) !== 0\" → ok"
        status: pass
      - kind: other
        ref: "test \"$(grep -c 'remediation' scripts/conformance.mjs)\" -ge 2 → 9"
        status: pass
    human_judgment: true
    rationale: "No provider key and no local model exist in this environment, so the verdict itself cannot be observed holding or failing here — the harness reports every provider as skipped with its reason and exits zero, which is a complete report. The exit decision and the verdict's presence are machine-checked above; whether a real provider takes the node id out of the reply is what the nightly run is for, and the first run with a key is a human reading one report."
  - id: D9
    description: "D-24 verified rather than rebuilt: the warm-up eyebrow with its reason, the cumulative, review and pre-explanation headings, and the three what-it-tests labels are present and unchanged"
    requirement: "LEARN-09"
    verification:
      - kind: unit
        ref: "server/test/api.test.ts#keeps the warm-up eyebrow and its reason"
        status: pass
      - kind: unit
        ref: "server/test/api.test.ts#keeps the cumulative, review and pre-explanation headings and the three what-it-tests labels"
        status: pass
    human_judgment: false
  - id: D10
    description: "T-05-30 and the values prohibition: the misconception material is lesson- and node-scoped, bounded to six rows, and carries its own instruction never to quote a past mistake back at the learner or name it as theirs"
    requirement: "LEARN-09"
    verification:
      - kind: integration
        ref: "server/test/api.test.ts#hands the learner's own recorded wrong claim over... (the `never name it as theirs` assertion)"
        status: pass
      - kind: other
        ref: "the prepared statement filters on `m.lesson_id = ?` and `m.node_id = ?`, keeps `l.scratch = 0`, and has no `resolved ASC` (checked at HEAD)"
        status: pass
    human_judgment: true
    rationale: "Whether a model handed this material actually builds a mutated option out of it rather than writing a line about the learner's past mistake is a judgment about generated copy, which the plan's own prohibition marks `verification: judgment`. The string telling it not to is asserted; the output is not, because no automated test here renders a model's question."

# Metrics
duration: 21 min
completed: 2026-11-05
status: complete
---

# Phase 05 Plan 06: One prerequisite, named and enforced Summary

**After a miss the server ranks the failed node's own dependencies with a pure function, names exactly one by label and id on all three miss paths, and refuses a quiz anywhere but that node or the claim that missed until one of them is graded or the learner types a word — and when the tutor starts a node it is handed the learner's own recorded wrong claims as distractor material, at the moment the question is being written.**

## Performance

- **Duration:** 21 min
- **Started:** 2026-11-05T01:12:00Z
- **Completed:** 2026-11-05T01:33:00Z
- **Tasks:** 3
- **Files modified:** 8 (0 created, 8 modified)

## Accomplishments

- **One pure ranking, with no database behind it.** `weakestFirst(deps, now = Date.now())` in `server/src/schedule.ts` orders a node's own direct dependencies: lowest `retrievability()` first, then a miss ahead of a pass, then status (`shaky`, `pending`, `teaching`, `locked`). It does not mutate its input, takes `now` as a defaulted last parameter so a test can pin time, and imports nothing from the database layer at runtime — the type-only `NodeRow` import is still the only link, which is what lets `server/test/schedule.test.ts` keep opening no file. Six cases pin the order: retrievability, both tie-breaks, no-mutation, the documented null-FSRS fallback, single and empty.
- **The two tie-breaks ride in precomputed, and cost no query.** `rankedDependencies` in `actions.ts` does the walk the remediation already did — parse `depends_on`, map to rows — and adds `missed` from `quizzesOn`, the same per-node check record `nodeRecord` renders a sentence from two lines below. Pretest rows are excluded there exactly as they are excluded from `nodeRecord` and from the misconception write.
- **Three instruction strings instead of two.** `afterCumulative`'s miss, `nodeStatus`'s shaky branch, and `afterQuiz`'s `dont_know` and `incorrect` branches — which named no dependency at all — now all read `Re-check "<label>" [<id>] with one fresh quiz, tests "intuition", before any other node: of the nodes this one rests on it is the weakest (<status>; <record>).` One node, by label and id. `dependencyRecord` and the phrase `the weakest of those` are gone from the file.
- **One function names the node and opens the gate.** `nameWeakest` returns the sentence *and* calls `openRemediation`, so the sentence the model reads and the gate the server enforces cannot disagree about which node it is. It returns `null` for a node with nothing below it, and the caller keeps the shipped ground-truth sentence word for word with no gate opened.
- **The refusal is product copy.** `remediationRefusal` returns the understanding gate's own `{ ok: false, refused: true, error }` shape, names the next call with its `node_id`, and ends with `This is the method, not an error to investigate.` The external action route answers it as a 400 with the sentence intact (so the web client throws the server's own words), and `quiz()` returns it to the in-process drivers **before** `openPrompt` runs — a refusal must not put a question on the learner's screen that the method is about to withdraw.
- **Two exits, both the learner's.** `clearRemediation(lessonId, nodeId?)` is one export serving both: with a node it lifts only if the gate was holding the tutor to it, which is the graded exit; with no node it lifts unconditionally, which is the learner's. The graded exit sits inside `gradeQuiz`, so a card restored after a restart takes it from the only copy there is; the learner's exit sits at the top of `POST /api/lessons/:id/message` (all three branches of it are the learner typing) and on `gradeQuiz`'s steer branch, which is the terminal reply and the in-app card steer.
- **The learner's own misconceptions as distractor material.** `misconceptionsOn(lessonId, nodeId)` in `db.ts` is the learner-scoped statement with the lesson and node ids added, the scratch join kept and the `resolved ASC` demotion deliberately dropped — locking a node resolves its misconceptions, so by the time it is being taught again they all carry the flag, and a resolved misconception is the best distractor there is. `misconceptionMaterial` puts them on the tool result that starts the node: the `teaching` state, which set no instruction at all before, and the shaky branch, where it is **merged** into the sentence that is already there. No new tool, no method-text change, nothing new to render.
- **The review and warm-up turns stop pausing between questions.** Both prompts now say: *the moment you have acted on a verdict, ask the next due node's question in the same turn, with nothing between the verdict and that question — no summary of what just happened, no transition, no asking whether to carry on.* Both closing sentences stayed where they were. That is the whole of D-17 as re-read: a turn-prompt change, no new mechanism, no flag on the quiz tool, no held-but-unshown card.
- **A fourth conformance verdict.** `remediation` joins `pretest`, `gate` and `cumulative`, with its own report column and two header cells. A scripted step marks `two-doubles` shaky — which opens the gate through the node-status branch with no planted miss, so the cumulative verdict (which requires nothing missed) is untouched — and then names the re-check question but deliberately **not** its node id: the model has to read that out of the reply. The verdict reads back through `server/dist/db.js` whether a fresh non-pretest check landed on `even`, which is `two-doubles`'s single dependency and therefore the node the ranking names by construction.
- **D-24 asserted rather than rebuilt:** the warm-up eyebrow with its reason, the three quiz-card headings and the three what-it-tests labels.
- **Full suite 559 → 565 tests, 0 fail.** `pnpm method:check && pnpm typecheck && pnpm build && pnpm test` green at HEAD, `method/` untouched (`git diff --quiet HEAD -- method/`).

## Task Commits

1. **Task 1: the weakest prerequisite, ranked by a pure function** — `005fb52` (feat)
2. **Task 2: the server names one prerequisite and enforces it** — `db37b63` (feat)
3. **Task 3: misconceptions as distractor material, in-turn pipelining, the fourth verdict** — `74059c4` (feat)

## Files Created/Modified

- `server/src/schedule.ts` — `weakestFirst`, `DependencyRank`, `STATUS_WEAKNESS` and `weakness`; still no runtime import of the database layer
- `server/src/actions.ts` — `rankedDependencies`, `GROUND_TRUTH_STEP`, the `remediation` map with `openRemediation`/`clearRemediation`/`remediationRefusal`, `nameWeakest`, `misconceptionMaterial`; the three rewritten miss instructions; the two gate exits in `gradeQuiz`; `quiz()` turned into a function that checks the gate before opening a card; `dependencyRecord` removed
- `server/src/db.ts` — `q.misconceptionsOn` and the exported `misconceptionsOn`, with the design paragraph saying why resolved rows are not demoted and why the read is lesson-scoped
- `server/src/index.ts` — the refusal returned as a 400 from the external `quiz` action before the teaching gate; `clearRemediation` at the top of the message route
- `server/src/prompt.ts` — the in-turn sequencing sentence in `reviewTurnPrompt` and `warmupBrief`
- `server/test/schedule.test.ts` — the `weakestFirst` describe: six cases, still opening no file
- `server/test/api.test.ts` — the `one prerequisite, named and enforced` describe (eight cases) and the `warm-up and the cumulative quiz are named where the learner reads them` describe (three cases); the existing cumulative-miss assertion tightened to the new one-node shape
- `scripts/conformance.mjs` — `REMEDIATION_NODE`, the fifth scripted quiz, `remediationStep`, the `remediation` verdict, the report column, the hardened `exitCodeFor`

## Red observed before each gate was kept

Per CONTEXT.md D-27, a gate is kept only after it has been seen failing with its subject planted.

**Task 1 — `weakestFirst` against the pre-change tree** (`2ad0d037`):

```
# SyntaxError: The requested module '../src/schedule.js' does not provide an export named 'weakestFirst'
not ok 1 - test/_red_weakest.test.ts
# pass 0
# fail 1
```

**Task 2 — the one-node instruction on an ordinary failed check** (against the Task-1 build, which already ranked the list but still handed it over):

```
not ok 1 - names exactly one prerequisite on an ordinary failed check, which named none
      operator: 'match'
      actual: 'A confident error: they committed to the wrong claim and were sure of it. … Re-check with a fresh quiz before locking; if that misses too, mark the node shaky and re-derive from its dependencies.'
```

**Task 2 — the refusal:**

```
not ok 2 - refuses a quiz on another node in the shipped shape, ending in the fixed clause
      expected: 400
      actual: 200
```

**Task 2 — the shaky branch:**

```
not ok 4 - names one prerequisite when a node is marked shaky, …
      actual: 'Shaky. Targeted remediation, not a re-explanation: it rests on "The first rule" [ground] (locked; pass (intuition)), "The second rule" [other] (locked; pass (intuition)). Re-check the weakest of those with one fresh quiz (tests: "intuition"); …'
```

That line is worth keeping: the ranking from Task 1 had already put `ground` first, and the instruction still handed both over and asked the model to pick. The ordering was never the missing half — the naming was.

**Task 2 — the cumulative miss, in the shipped end-to-end lesson:**

```
not ok 7 - marks a node shaky on a cumulative miss and pulls the review of what was built on it closer
      operator: 'match'
      actual: '… Targeted remediation, not a re-explanation: it rests on "A slope points uphill" [slope] (locked; pass (procedure)). Re-check the weakest of those with one fresh quiz (tests: "intuition"); …'
```

**Task 3 — the misconception material** (against the Task-2 build):

```
not ok 7 - hands the learner's own recorded wrong claim over when the node is marked as being taught
      operator: 'match'
      actual: 'undefined'

not ok 8 - merges the material into the shaky branch's own instruction rather than over it
      operator: 'match'
      actual: 'Shaky. Targeted remediation, not a re-explanation. Re-check "The second rule" [other] with one fresh quiz, tests "intuition", before any other node: … Lock it only when that passes.'
```

The first is the exact gap D-23 names: the `teaching` branch set no `instruction` key at all, so there was nowhere for the material to be. The second shows the merge was a real risk — the sentence was there and carried no material.

**Task 3 — the in-turn sequencing**, checked against the committed pre-change file rather than by stashing (`git stash` is shared across worktrees and is not used here):

```
$ node -e "… git show HEAD:server/src/prompt.ts …"
pre-change matches: 0
post-change matches: 2
```

## Decisions Made

Every decision in the plan's `<decisions_resolved_here>` was followed: three instruction strings rather than two, the ranking in `schedule.ts` as a pure function over row-shaped inputs, the gate held in a module-level map that does not survive a restart, resolved misconceptions kept as distractor material with the read scoped to the lesson, D-17 as a turn-prompt change only, and D-24 asserted rather than rebuilt. Four calls the plan left to the executor:

- **The gate permits two nodes, not one.** See deviation 1 — this is the substantive one.
- **`teaching` is given a place in the status ordering.** The plan named shaky, pending and locked; `teaching` is the fourth value of the union and had to rank somewhere. It sits between `pending` and `locked`: a node being established right now is further along than one never started and not yet held. A status the table does not know ranks with `locked`, because guessing that an unrecognised state is weak would send the remediation to the wrong node — and the whole tier is only reached when retrievability and the miss flag are both tied, which is the all-unscheduled case.
- **The route checks the gate itself rather than reading a refusal back off `quiz()`.** `actions.remediationRefusal(id, args.node_id)` is called in the external `quiz` action before the teaching gate and before `openQuiz`, so the status code is a 400 by construction on both the browser-answered and the terminal-answered branch. `quiz()` carries the same check for the in-process drivers, which reach it through `runTool` and never through a route. Two call sites, one function, and neither path can open a card the method is about to withdraw.
- **A named node that has left the graph clears the gate.** `remediationRefusal` looks the named node up to build its sentence; if a re-plan has removed it there is nothing left to hold the tutor to, so the gate is deleted and the call proceeds rather than being refused with a label nobody can read. That is the T-05-33 spoofing row's own logic read from the other side.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] the gate permits the node that just missed as well as the prerequisite it named**

- **Found during:** Task 2
- **Issue:** The plan says to refuse "a quiz on any other node while a gate is open", relative to the named prerequisite alone. Applied literally to all three miss paths, that gate refuses the method's own next move. `afterQuiz`'s `dont_know` sentence says *"give one hint that points at the node this rests on, then a fresh quiz on the same claim"*, and both `incorrect` sentences say *"re-check with a fresh quiz before locking"* — a fresh question on the node that just missed. A gate holding only the prerequisite returns a 400 to exactly that call, in the voice of the method, for doing what the method just told it to do. The shipped end-to-end suite demonstrates it: after a cumulative miss on `step`, the very next thing the lesson does is a fresh cumulative question on `step`.
- **Fix:** `remediation` holds a pair — `{ node, dependency }` — and the refusal fires for any `node_id` that is neither. A graded quiz on **either** lifts the gate, and the instruction built from that grading re-arms it if that answer missed too. The refusal therefore binds the very next question and no further, which is the tightest form that cannot trap anyone: both must-have exits remain true (a graded fresh quiz on the named node lifts it; so does anything the learner types), and the third lift is a strict widening in the learner's favour, which is what T-05-29's disposition asks for. The instruction and the refusal both say so in plain words, so the model is not guessing.
- **Files modified:** `server/src/actions.ts`
- **Verification:** `names exactly one prerequisite on an ordinary failed check` (the gate opens and names one node), `refuses a quiz on another node…` (a third node is refused), `accepts a fresh quiz on the node it named, and lets the tutor move on once that is graded`, and the shipped `lets the node lock again once a fresh cumulative question holds` — which passes unchanged, and would not have under the literal gate. Full suite 565 pass / 0 fail.
- **Committed in:** `db37b63`

**2. [Rule 3 - Blocking] `exitCodeFor` fails on a false verdict directly, and accepts a bare array of rows**

- **Found during:** Task 3
- **Issue:** The plan states that "the exit-code helper already fails on any false verdict and needs no change", but it fails on `r.status === 'failed'`, which `runRow` derives from the verdicts — it never reads a verdict itself. The plan's own verification command calls `exitCodeFor([{verdicts:{pretest:true,gate:true,cumulative:true,remediation:false}}])`: a bare array with no `status`, which the shipped helper reads as `report.rows === undefined` → no rows → exit 0. The command would have thrown `a false remediation verdict did not fail the harness` against any implementation, including a correct one, so the fourth verdict had no gate at all.
- **Fix:** `exitCodeFor` accepts either a finished report or a bare array of rows, and fails when a row's `status` is `failed` **or** any of its verdicts is literally `false`. The two always agree today and that is the point of writing it this way: a verdict added in a future phase without being folded into the status cannot be decorative, which is the one thing a nightly assertion must not be. The doc comment says so.
- **Files modified:** `scripts/conformance.mjs`
- **Verification:** the plan's own command now prints `ok`; `grep -c 'remediation' scripts/conformance.mjs` is 9; the harness's own skip-everything path still exits 0 because a skipped row has no `verdicts` key.
- **Committed in:** `74059c4`

**3. [Rule 1 - Bug] the shipped cumulative-miss assertion was tightened rather than left matching by accident**

- **Found during:** Task 2
- **Issue:** `marks a node shaky on a cumulative miss…` asserted `/A slope points uphill/`, which the new one-node instruction still satisfies — so the test would have gone green over the change without ever checking that one node is named instead of a list. That is a gate that stops asking the question it exists for.
- **Fix:** the assertion is now `/Re-check "A slope points uphill" \[slope\] with one fresh quiz, tests "intuition"/`, with a comment saying this is the second of the three miss paths. It was observed failing against the pre-change build (quoted above).
- **Files modified:** `server/test/api.test.ts`
- **Verification:** red before, green after; it is the only automated coverage of the cumulative miss path's naming.
- **Committed in:** `db37b63`

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocking). **Impact on plan:** no scope creep and no file outside `files_modified` touched. Deviation 1 is the only behavioural change against the plan's letter and it is recorded above with its reasoning and its evidence; deviation 2 is what makes the plan's own fourth-verdict verification able to pass at all; deviation 3 tightens one shipped assertion the change would otherwise have slipped past. Every shipped sentence the plan said to keep — the ground-truth instruction, the four `afterQuiz` verdict sentences for a node-less check, the understanding-gate refusal, the two turn-prompt closings — is byte-identical.

## Issues Encountered

- **A lapse resets the forgetting curve, so which prerequisite is weakest legitimately changes mid-test.** In the new HTTP block, marking `ground` shaky writes an FSRS lapse with `last_review = now`, which lifts its retrievability back to ~1 and makes `other` the weaker of the two from then on. The first four cases pin `ground` by name; the later ones use a regex over either prerequisite plus an assertion that exactly one bracketed id appears. That is the honest shape of the assertion — the ranking is a function of the schedule, and the schedule moved — and it is noted here so a future reader does not read the looser regex as a weaker test.
- **The in-turn pipelining of D-17 cannot be proven by anything in this repo's CI.** What is asserted is that both turn prompts ask for it, in both files, with the sequencing sentence appearing exactly twice. Whether a model obeys it is a property of the model, and D-17 as re-read deliberately adds no conformance assertion because there is no new mechanism to assert — no tool, no flag, no held card. It is carried as the human check in coverage D7.
- **The fourth conformance verdict cannot be observed holding here.** No provider key and no local model exist in this environment, so the harness reports every row as skipped with its reason and exits zero, which is a complete report rather than a failure. What is machine-checked is the exit decision (deviation 2) and the verdict's presence; the verdict itself is carried as the human check in coverage D8.
- **One pre-existing untracked file pair is left alone:** `.planning/milestone.lock` and `cleanup-root.sh` were already untracked before this plan started and are outside its scope.

## Threat Flags

None. No new endpoint, no new auth path, no new file access, nothing installed. The register's six rows are each handled as planned:

- **T-05-29 (denial of service against the learner):** two exits, both unconditional, with no counting state and no third condition — and widened in the learner's favour by deviation 1, so the method's own fresh question on the same claim is never refused either. `names one prerequisite when a node is marked shaky, and the learner's own message lifts it` asserts the message exit with nothing graded.
- **T-05-30 (information disclosure, misconceptions on the tool result):** the read filters on `m.lesson_id = ?` and `m.node_id = ?`, keeps the `l.scratch = 0` join, is bounded to six rows, and is never followed across lessons through `source_node`, so one lesson cannot pull another learner's rows.
- **T-05-31 (the refusal sentence reaching the learner):** accepted as planned — it names a node label and id already visible to that learner in their own graph.
- **T-05-32 (a model clearing the gate by naming a node itself):** the gate clears only when a quiz on a node it is holding the tutor to is **graded**, the comparison is exact string equality, and the refusal is returned before `openPrompt` runs, so no card is opened for the wrong node.
- **T-05-33 (a node id from another lesson):** the lookup is lesson-scoped; an id from elsewhere finds no node in this graph and takes the shipped not-in-this-graph refusal. A named node that has left the graph clears the gate rather than refusing forever.
- **T-05-34 (a provider silently ignoring the named-node instruction):** the fourth verdict, with the node id withheld from the scripted step so the model has to read it out of the reply, and an `exitCodeFor` that fails on the verdict directly.

No new security-relevant surface was introduced beyond the register.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **05-07 and 05-08 are unblocked.** Three shapes to honour: `actions.quiz` is now an `async function` returning either a graded result or `{ ok: false, refused: true, error }`, so any new caller must treat a refusal as a refusal rather than a result; `actions.remediationRefusal` must be called before a card is opened on any new quiz surface, as the external route and `quiz()` both do; and `actions.clearRemediation(lessonId)` is the learner's exit, so any new path through which a learner's own words reach the server should take it.
- **`dependencyRecord` no longer exists.** A later plan wanting the full dependency list for some other purpose should call `rankedDependencies` and render it, not resurrect the old helper — the phrase it carried is what LEARN-09 exists to remove, and an acceptance grep in this plan keeps it out.
- **The conformance script's scripted lesson has five quizzes and eight steps.** `run.script.quizzes` reports it, and a plan adding a sixth must keep the shaky step before the two cumulative questions: the gate it opens has to be cleared by the `even` re-check, or the cumulative questions are refused and two verdicts fail at once.
- **Two human checks carry to end-of-phase UAT:** coverage D7 (a review session on a real provider actually asking its next question inside the same turn) and coverage D8 (the first nightly conformance run with a key, reading whether the remediation column holds). Coverage D10 is a third, narrower one: that a model handed the distractor material builds a mutated option out of it rather than a line about the learner's past mistake.

---
*Phase: 05-learning-experience*
*Completed: 2026-11-05*

## Self-Check: PASSED

Every file in `key-files.modified` exists on disk and all three task commits
(`005fb52`, `db37b63`, `74059c4`) are in the log. The plan-level verification was
re-run whole at `74059c4`: `pnpm method:check` (6 rendered copies match
`method/`), `git diff --quiet HEAD -- method/`, `pnpm typecheck`, `pnpm build`
and `pnpm test` (565 pass / 0 fail), plus `test/schedule.test.ts` on its own (13
pass / 0 fail), the comment-stripped greps for the absent `the weakest of
those` (0), the two homes of `This is the method, not an error to
investigate.` (2), `weakestFirst` in `actions.ts` (2), `misconceptionsOn` in
`db.ts` (3), `remediation` in `scripts/conformance.mjs` (9), the scheduler's
still-absent value import of the database layer (0), and the `exitCodeFor`
false-verdict gate (`ok`). `commits: 3` is measured with
`git rev-list --count 2ad0d037..HEAD`; this SUMMARY's own commit is the fourth
and follows it.
