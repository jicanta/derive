---
phase: 05-learning-experience
plan: 08
subsystem: api
tags: [mcp, tool-registry, claude-code-plugin, codex-skills, fsrs, due-count, terminal]

# Dependency graph
requires:
  - phase: 05-04
    provides: "`GET /api/retention` with its `nextReviewAt` field, learner-scoped through `learnerOf` and behind the install token — the read this plan's handler proxies for the nothing-due state"
  - phase: 01
    provides: "the single tool registry in `server/src/tools.ts`, its committed projection `server/test/wire-surface.json`, and the renderer that builds each plugin command's `allowed-tools` line as the registry minus a declared exclusion map"
provides:
  - "the `due` registry entry: MCP surface only, two described fields, no status label"
  - "the `due` handler in `server/src/mcp.ts`, reading `GET /api/review` for the queue and `GET /api/retention` for the next review, both learner-scoped"
  - "`overdueOf` / `relativeOf` in `server/src/mcp.ts`: the Atlas's own floor-of-days vocabulary (`today`, `{d}d overdue`) on the terminal side"
  - "`plugin/commands/due.md` — `/derive:due`, permitted exactly one Derive tool by a hand-written line"
  - "`codex/skills/derive-due/` — the Codex sibling, with no rendered method region"
  - "a `due` exclusion on both shipped command targets in `scripts/render-method.mjs`, holding `learn.md` and `review.md` byte-identical"
  - "the five pinned surface counts and the committed projection moved to 25 / 23 in one reviewed step"
affects: [07-adoption]

# Actuals (#2632) — same instrument as the plan's `estimate.tokens`: chars/4 over the
# full content of the nine files actually changed (267,359 chars). `diff_tokens` is the
# same measure over the realized diff alone, reported beside it as 05-07 did.
actuals:
  tokens: 66839
  diff_tokens: 4869
  tasks: 2
  commits: 2
plan_head_before: 3a6dbbd502a695ac7a579960da8a860f0cc5428a

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A learner-facing read joins the one tool registry as a single entry declared on one surface; the surface list is what keeps it out of the tutor's tool list, the in-process agent and the HTTP action switch"
    - "A rounding rule the learner reads in two places is written once per side with the other side named in the comment, so neither can be changed in ignorance of the other"
    - "A command whose permitted surface must not grow with the registry carries a hand-written `allowed-tools` line and is deliberately left out of the render targets; a rendered line would widen on the next registry entry"
    - "Widening a frozen-surface assertion is an edit to its comment as much as to its list: the reason the guarantee moved lives beside the name that moved it"

key-files:
  created:
    - plugin/commands/due.md
    - codex/skills/derive-due/SKILL.md
    - codex/skills/derive-due/agents/openai.yaml
  modified:
    - server/src/tools.ts
    - server/src/mcp.ts
    - server/test/wire-surface.test.ts
    - server/test/mcp.test.ts
    - server/test/wire-surface.json
    - scripts/render-method.mjs

key-decisions:
  - "`due` is one registry entry declared `surfaces: ['mcp']`, which is the whole of D-05's claim that the four-place tool-set rule does not apply: one surface list keeps it out of `DERIVE_TOOL_NAMES`, `agent.ts` `buildTools` and `index.ts`'s external action switch, with no copy to drift"
  - "No `label`. The registry's status-line map is `TOOL_REGISTRY.filter((s) => s.label)` and the snapshot holds the set of labels added since the registry to the owned loop's two web tools. A learner-facing read is not a tutor action the learner watches run, so the assertion is right to forbid one and nothing was widened to accommodate it"
  - "The entry is appended after `library` rather than inserted among the driver tools, so every existing row keeps its position and the fixture diff is one added object"
  - "The handler returns data, not sentences: `count`, `nodes` (label, topic, overdue), `more`, `next_review`. The three learner-facing shapes live in the two command files, which is what the `node -e` locked-string gate holds — so 'both terminals read the same strings' is checkable rather than asserted"
  - "`overdueOf` and `relativeOf` are computed server-side in `mcp.ts` with the Atlas's own `Math.floor(ms / 86_400_000)` rule and its own words, and the command text passes them through verbatim. One rule, two surfaces, with the Atlas named in the doc comment"
  - "`next_review` is populated only when nothing is due, and is `null` when nothing is scheduled at all — so the two empty states are distinguishable from the payload alone and the model never has to infer which it is in"
  - "`MCP_TOOLS_BEFORE` keeps its name and its assertion message verbatim; the honesty went into its doc comment, which now says the list is the pre-phase set plus every deliberate addition and why `due` is one. Changing the message would have made the plan's own failure signal stale for the next reader"
  - "`/derive:due` carries a hand-written `allowed-tools` line and is not a render target. The rendered form would have needed a 22-key exclusion map to express one tool, and — the reason that decided it — a rendered line silently widens when the next tool lands, where a hand-written one cannot"
  - "The Codex sibling carries no `<!-- method:begin -->` region, so it needs no fifth `method/surfaces/` preamble and the drift gate stays out of it. A one-call read has no method text to render"

patterns-established:
  - "An MCP-only registry entry: one `surfaces` list, no label, every field described, appended rather than inserted"
  - "The locked-copy gate: the same three strings asserted present in both terminal surfaces by one script, so a divergence fails rather than being noticed later"
  - "A prohibition about tone gets a negative grep over both copies (`streak|daily goal|don.t lose|keep it up|notification`), with the judgment half carried to UAT rather than claimed"

requirements-completed: [LEARN-03]

coverage:
  - id: D1
    description: "A `due` entry in the one tool registry, declared on the MCP surface alone, with both fields described and no status label — so it does not enter the tutor's tool list, the in-process agent's tools or the HTTP action switch"
    requirement: "LEARN-03"
    verification:
      - kind: unit
        ref: "server/test/wire-surface.test.ts#covers the whole surface a driver can see: 25 tools, of which 14 are the tutor tools (17 tests pass) — the driver-tool loop asserts `due` is on the MCP surface and is not one of the fourteen"
        status: pass
      - kind: unit
        ref: "server/test/wire-surface.test.ts#still names the same fourteen tutor tools, in the same order, with the same status lines — the added-label set is still exactly ['fetch_page','web_search'], which a label on `due` would have broken"
        status: pass
      - kind: other
        ref: "test \"$(sed -E 's;//.*$;;' server/src/tools.ts | sed -E '/^[[:space:]]*\\*/d' | grep -c \"name: 'due'\")\" = 1 — exactly one declaration in comment-stripped source"
        status: pass
      - kind: other
        ref: "node -e over server/test/wire-surface.json: 23 mcp tools, `due` present, `due` absent from the `api` surface"
        status: pass
    human_judgment: false
  - id: D2
    description: "The `due` handler proxies a learner-scoped read over HTTP with the install token — `GET /api/review` for the queue and `GET /api/retention` for the next review — with no hand-written registration call, so the registry's loop is what serves it"
    requirement: "LEARN-03"
    verification:
      - kind: e2e
        ref: "server/test/mcp.test.ts#serves the registry in declaration order, and the pre-phase set plus the one deliberate addition (3 tests pass) — the registration loop throws at spawn on a declared tool with no handler, so the stdio suite starting at all is the proof the handler exists"
        status: pass
      - kind: integration
        ref: "live drive of server/dist/mcp.js against a scratch Derive server on a throwaway DERIVE_DATA_DIR: tools/list = 23 including `due`; nothing scheduled → {count:0, next_review:null}; one future review → {count:0, next_review:'in 3 days'}; seven planted due nodes → {count:7, five nodes with '7d overdue'…'3d overdue', more:2}; limit 2 → more:5; limit 0 refused by the shared validator"
        status: pass
      - kind: integration
        ref: "same drive with learner: 'nobody-by-this-name' — the server resolves the unknown name to the default learner rather than selecting an arbitrary one (threat T-05-40)"
        status: pass
      - kind: other
        ref: "grep: exactly one `server.registerTool` call in server/src/mcp.ts (the registry loop); no hand-written registration added"
        status: pass
    human_judgment: false
  - id: D3
    description: "The five pinned surface counts and the committed projection moved in one reviewed step: whole surface 24→25, MCP 22→23 in the fixture test, the stdio count 22→23 and the plugin's committed set widened with its reason, and the renderer's projection pin 22→23"
    requirement: "LEARN-03"
    verification:
      - kind: unit
        ref: "pnpm build && pnpm --filter server exec node --import tsx --test test/wire-surface.test.ts — 17 pass, 0 fail"
        status: pass
      - kind: e2e
        ref: "pnpm build && pnpm --filter server exec node --import tsx --test test/mcp.test.ts — 3 pass, 0 fail"
        status: pass
      - kind: other
        ref: "server/test/wire-surface.json regenerated with DERIVE_WRITE_WIRE_SURFACE=1 and committed in the same change; `git diff --stat` on it = 21 insertions, 0 deletions (one appended object on the mcp surface only)"
        status: pass
      - kind: other
        ref: "pnpm method:check — 6 rendered copies match; the renderer no longer refuses with \"lists 23 mcp tools, not 22\""
        status: pass
    human_judgment: false
  - id: D4
    description: "A `due` exclusion on both shipped command targets, so `/derive:learn` and `/derive:review` may call exactly what they could call before — the plugin's permitted surface did not widen with the registry"
    requirement: "LEARN-03"
    verification:
      - kind: other
        ref: "pnpm method (rewrote all six targets) then `git diff --quiet HEAD -- plugin/commands/learn.md plugin/commands/review.md` — exit 0, byte-identical"
        status: pass
      - kind: other
        ref: "`git diff --quiet 3a6dbbd -- plugin/commands/learn.md plugin/commands/review.md` — exit 0 against the pre-plan commit, so neither file moved at any point in this plan"
        status: pass
      - kind: other
        ref: "grep: a `due:` exclusion with a one-line reason under each of the two command keys in scripts/render-method.mjs"
        status: pass
    human_judgment: false
  - id: D5
    description: "`/derive:due` sits beside the two shipped commands, permitted exactly one Derive tool by a hand-written `allowed-tools` line, and is deliberately absent from the render targets so that line cannot widen when the registry grows"
    requirement: "LEARN-03"
    verification:
      - kind: other
        ref: "test \"$(grep -cE '^allowed-tools: mcp__plugin_derive_derive__due, WebSearch, WebFetch, Skill$' plugin/commands/due.md)\" = 1"
        status: pass
      - kind: other
        ref: "test \"$(grep -c 'due.md' scripts/render-method.mjs)\" = 0 — the new command is not a render target, and the drift gate passes with it present"
        status: pass
    human_judgment: false
  - id: D6
    description: "The Codex sibling exists as a sibling of the review skill — name-and-description frontmatter, the shipped heading form, a tool-mapping note, the same numbered steps — with no rendered method region, and its manifest declaring the same MCP tool dependency"
    requirement: "LEARN-03"
    verification:
      - kind: other
        ref: "test -f codex/skills/derive-due/SKILL.md && test -f codex/skills/derive-due/agents/openai.yaml; test \"$(grep -c 'method:begin' codex/skills/derive-due/SKILL.md)\" = 0"
        status: pass
      - kind: other
        ref: "pnpm method:check still reports 6 rendered copies (no fifth method surface owed); the manifest's `dependencies.tools` is the review skill's `{type: mcp, value: derive}` verbatim"
        status: pass
      - kind: other
        ref: "node -e locked-string check: 'Nothing due today', 'Run /derive:review to start' and 'Lock a node in a lesson and it starts coming back' all present in BOTH plugin/commands/due.md and codex/skills/derive-due/SKILL.md"
        status: pass
    human_judgment: false
  - id: D7
    description: "With nodes due the terminal reads a count sentence, up to five node lines with topic and overdue figure, a truncation line and one next step; with nothing due but a review scheduled it says so and when; with nothing scheduled it says what makes a node come back — and the overdue figure agrees with the Atlas"
    requirement: "LEARN-03"
    verification:
      - kind: integration
        ref: "the live three-state drive under D2 produced exactly the payload each shape consumes, including more:2 at seven due and the two distinguishable empty states"
        status: pass
      - kind: other
        ref: "`overdueOf` in server/src/mcp.ts is `Math.floor((now - ts) / 86_400_000)` with `today` / `{d}d overdue` — the same expression and the same two words as `overdue()` in web/src/pages/Atlas.tsx"
        status: pass
    human_judgment: true
    rationale: "Task 2 carries its own `<human-check>`, deferred by `human_verify_mode: end-of-phase`. The payload is proven and the rounding rule is proven identical by reading both expressions, but nothing here drives a real model through `/derive:due` in Claude Code with the plugin loaded, or through the `derive-due` skill in a Codex terminal, and nothing compares a rendered node line against the Atlas due block side by side. That comparison is the plan's own declared backstop for LEARN-03's precision edge."
  - id: D8
    description: "The terminal due read states a count, names what is due and offers one next step — with no streak, no daily goal, no loss-aversion framing and no notification, all of which are deferred to a later milestone"
    verification:
      - kind: other
        ref: "for both copies: test \"$(grep -ciE 'streak|daily goal|don.t lose|keep it up|notification' \"$f\")\" = 0 — pass on both"
        status: pass
      - kind: other
        ref: "both files instruct the model explicitly: 'no praise, no count of days in a row, no target for the day, no nudge to come back later', and the only next step named is /derive:review"
        status: pass
    human_judgment: true
    rationale: "The plan declares this prohibition `verification: judgment`. The negative grep catches the named vocabulary and the positive instruction is present, but whether the output reads as a read rather than a nudge — once a real model has composed it from the payload — is a judgment only a human reading the rendered output can make. It belongs with D7 in the end-of-phase UAT."

# Metrics
duration: 48min
completed: 2026-11-05
status: complete
---

# Phase 5 Plan 8: The Due Count Reaches the Terminal Summary

**One `due` entry on the MCP surface alone, a handler proxying the learner-scoped review queue and next-review date, and `/derive:due` with a Codex sibling — so a learner in either terminal can ask what is due without opening the browser, while the two shipped plugin commands may call exactly what they could call before.**

## Performance

- **Duration:** 48 min
- **Started:** 2026-11-05T02:08:30Z
- **Completed:** 2026-11-05T02:56:36Z
- **Tasks:** 2
- **Files modified:** 9 (6 modified, 3 created)

## Accomplishments

- **The read reached the terminal as one registry entry, not four copies.** `due` is declared `surfaces: ['mcp']` and nothing else, which is the entire mechanism behind D-05's claim that the project's "tool set must match in four places" rule does not apply here: one surface list is what keeps it out of `DERIVE_TOOL_NAMES`, out of `agent.ts`'s `buildTools`, and out of `index.ts`'s external action switch. The handler's presence is what completes the entry — the registration loop throws at spawn on a declared tool with no handler, so there was no hand-written registration call to add.
- **Five pinned numbers and one generated fixture moved in one reviewed step.** The whole-surface count went 24→25 and the MCP count 22→23 in `wire-surface.test.ts` (with its arithmetic comment rewritten and `due` added to the driver-tool loop), the stdio count went 22→23 in `mcp.test.ts`, the renderer's hard-fail pin went 22→23, and `wire-surface.json` was regenerated through `DERIVE_WRITE_WIRE_SURFACE=1` — a clean 21-insertion, 0-deletion diff adding one object to the `mcp` surface and nothing anywhere else. None of them was moved to make a test green; each was moved because the contract moved, and the diff is what shows it.
- **The plugin's permitted surface did not widen.** A `due` exclusion on both shipped command targets is the single thing most likely to have been missed, because the symptom is a *passing* render with a quietly wider allow-list. With it, `pnpm method` rewrote all six targets and `plugin/commands/learn.md` and `plugin/commands/review.md` came back byte-identical — verified against the pre-plan commit, not just against the working tree. The new command's own line is hand-written to one tool precisely so it cannot widen when the next registry entry lands.
- **Both terminals say the same thing, and a script holds them to it.** The three output states are fixed copy from the UI-SPEC, present verbatim in both `plugin/commands/due.md` and `codex/skills/derive-due/SKILL.md`; a `node -e` gate fails by name when either drifts. The per-node overdue figure is the Atlas's own `Math.floor(ms / 86_400_000)` with the Atlas's own two words, computed once in `mcp.ts` and passed through verbatim by the command text — so the terminal and the Atlas cannot disagree about how overdue the same node is.
- **It is a read, and the copy says so.** No streak, no goal, no loss-aversion framing, nothing that notifies — asserted by a negative grep over both copies and stated positively in the instructions the model reads.

## Task Commits

Each task was committed atomically:

1. **Task 1: One registry entry, and the five pinned numbers it moves** — `e3134d7` (feat)
2. **Task 2: `/derive:due` and its Codex sibling, saying the same three things** — `a7e0032` (feat)

**Measured:** `git rev-list --count 3a6dbbd..HEAD` = 2 production commits at SUMMARY time (the plan metadata commits separately).

## Files Created/Modified

- `server/src/tools.ts` — the `due` entry appended after `library`: MCP surface only, an optional `learner` and an optional bounded `limit` each with a description string, and **no** `label`, with a comment beside it saying why a status line would be wrong here. The driver-tools block comment now names the review-queue read alongside the shelf read.
- `server/src/mcp.ts` — the `due` handler in the library handler's shape (learner default, query string, `api()` with the install token), reading `GET /api/review` and `GET /api/retention` in one `Promise.all`; plus `DueNode`, `DAY`, `DUE_LIMIT`, `overdueOf` and `relativeOf`, the last two carrying the Atlas's rule and naming it in the doc comment.
- `server/test/wire-surface.test.ts` — 24→25 and 22→23, the arithmetic comment rewritten to name the third addition and its surface, the test title updated, and `due` in the driver-tool loop.
- `server/test/mcp.test.ts` — 22→23, `due` appended to `MCP_TOOLS_BEFORE`, and a doc comment above that list recording why the frozen plugin-surface guarantee was widened (a read was added; nothing was taken away) and that a future addition owes its own reason. The assertion message is unchanged on purpose.
- `server/test/wire-surface.json` — regenerated through the sanctioned writer; one object added to `mcp`, nothing else touched.
- `scripts/render-method.mjs` — the projection pin 22→23 with its message, and a `due` exclusion with a one-line reason under each of the two shipped command keys.
- `plugin/commands/due.md` — `/derive:due`: description, `argument-hint`, a hand-written one-tool `allowed-tools` line, then numbered steps naming the payload fields and the three output shapes.
- `codex/skills/derive-due/SKILL.md` — the Codex sibling: name-and-description frontmatter, the `# Derive: due` heading, a tool-mapping note for `derive__due`, the same steps and the same three shapes, and no method region.
- `codex/skills/derive-due/agents/openai.yaml` — display name, short description, `$derive-due` default prompt, and the review skill's MCP tool dependency verbatim.

## Decisions Made

- **No status label, and nothing widened to allow one.** `TOOL_LABELS` is `TOOL_REGISTRY.filter((s) => s.label)`, and the snapshot asserts the labels added since the registry are exactly the owned loop's two web tools. That assertion is right: a status line is the vocabulary of a tool the learner watches the tutor run, and this is a learner-facing read. The entry carries no `label` and the assertion was left alone.
- **Appended, not inserted.** Placing `due` after `library` keeps every existing row's position in the fixture, so the regenerated projection reads as one added object rather than a reshuffle. Declaration order is `tools/list` order, and the suite's own comment records that order is not the MCP contract — the set is.
- **The handler returns data; the command files hold the copy.** The alternative was to render the three sentences server-side and have both commands print one string. The locked-string gate the plan specifies checks the *command files*, and the UI-SPEC's contract is copy, so the sentences belong where a reviewer reads them. The payload is shaped so the model cannot have to guess: `next_review` is populated only when nothing is due, and `null` there means nothing is scheduled at all, which separates the two empty states without a flag.
- **`MCP_TOOLS_BEFORE` keeps its identifier and its failure message.** Its name and its message both read as "nothing has changed", and one entry now contradicts that. The fix went into the doc comment rather than into the message, because the plan's own `<fails_when>` cites that message as the signal the next reader will see, and a reworded message would have made that hint stale. The comment states the list is the pre-phase set plus every deliberate addition, why `due` qualifies, and that nothing was removed — so every tool the plugin could call before this line moved, it still can.
- **The learner-name precedence quirk was left as it is.** `learnerOf` reads the `x-derive-learner` header before `?learner=`, and `api()` sets that header from `DERIVE_LEARNER` when it is set — so on a terminal with that variable exported, a `learner` argument naming someone else is ignored. This is the shipped behaviour of `library`, `learner_profile` and `set_preferences` alike, and changing it for one tool would have put a second learner-resolution rule in a file whose whole point is that there is one. It is not a disclosure risk: both paths resolve through `findLearner` and fall back to the default, so no argument can select an arbitrary learner. Recorded here rather than silently diverged from.
- **The Codex sibling tells its model where review lives without changing what the learner reads.** The locked next-step line is `Run /derive:review to start.` — a Claude Code spelling. The skill prints it verbatim (both terminals must say the same thing) and separately instructs the model that the `derive-review` skill is the Codex route when the learner asks. The instruction is to the model; the printed line is identical on both sides.

## Deviations from Plan

### Auto-fixed Issues

None.

### Files touched beyond the plan's `files_modified`

None — all nine files are named in the plan's `files_modified`.

---

**Total deviations:** 0
**Impact on plan:** The plan executed as written. Every pinned number it predicted would fail did fail when the entry landed, and each was moved deliberately rather than regenerated to go green.

## Issues Encountered

None in the production path. Two incidents in the throwaway smoke harness only, both fixed in the scratch script and neither touching shipped code:

1. The planted lesson row omitted `updated_at`, which is `NOT NULL` — `NOT NULL constraint failed: lessons.updated_at`. Added the column to the insert.
2. The first run's scratch server survived a `pkill` and held port 4877, so the second run never got a token. Killed by pid and re-ran on the freed port. (This is the known scratch-server gotcha, not a product behaviour.)

The scratch harness lived under the gitignored `.derive/` and was removed after the run; the recipe is in coverage D2 so the three-state drive can be reproduced.

## Known Stubs

None. Every figure the terminal prints is read from live FSRS state through two shipped learner-scoped routes; no placeholder, mock or hardcoded value was introduced.

## Threat Flags

None. The two reads are the boundaries `05-04` already registered, the proxy adds no transport, no credential and no environment variable, and the one surface that genuinely widened — the plugin's visible tool set — is the boundary the plan registered as T-05-41 and the one the byte-identical gate on the two shipped commands holds.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

**Verification run:** `pnpm method:check` (6 rendered copies match), `pnpm typecheck` (server + web, strict), `pnpm build`, `pnpm test` (565 pass, 0 fail — 548 at `05-04`, so the suite grew with the phase and nothing regressed). Plus the plan's own gates: the byte-identical check on both shipped commands, the projection gate over `wire-surface.json`, the comment-stripped single-declaration grep, the one-tool `allowed-tools` grep, the no-render-target grep, the no-method-region grep, the negative pressure-framing grep over both copies, and the locked-string check across both terminals.

**Phase 5 is complete** — eight plans, eight summaries. `LEARN-03` was the one requirement this plan declares and the one `05-07` shared with it; with this SUMMARY on disk, `requirements.ready-ids` reports it ready and it is marked complete.

**Carried to end-of-phase UAT** (`human_verify_mode: end-of-phase`), neither item blocking:

1. Task 2's `<human-check>`, which is also the plan's declared backstop for LEARN-03's precision edge: run `/derive:due` in Claude Code with the plugin loaded on a learner with at least six nodes due, and confirm the count sentence, five node lines with topic and overdue figure, the truncation line and the one next step; compare one node's overdue figure against the Atlas due block and confirm they agree; then the nothing-due-with-a-future-review state and the nothing-scheduled state; then repeat in a Codex terminal with the `derive-due` skill and confirm the wording is identical. Note the project's own `01-12` rule: a plan does not install the plugin or the skills into the user's agent configuration, so the documented invocations (`claude --plugin-dir ./plugin`, `codex/skills/*` into `$CODEX_HOME/skills`) are part of the check.
2. Whether the composed output reads as a read rather than a nudge (coverage D8) — the named vocabulary is excluded by grep, the tone is a judgment.

**For Phase 7 (adoption/packaging):** this is deliberately D-05's pre-packaging form. When the published `derive` bin lands, the shell spelling `derive due` can read the same two routes with the same two formatting helpers; nothing here added a package entry point, a bin or a standalone script, so that decision is untaken and unconstrained.

---
*Phase: 05-learning-experience*
*Completed: 2026-11-05*

## Self-Check: PASSED

- `plugin/commands/due.md` — present on disk
- `codex/skills/derive-due/SKILL.md` — present on disk
- `codex/skills/derive-due/agents/openai.yaml` — present on disk
- `.planning/phases/05-learning-experience/05-08-SUMMARY.md` — present on disk
- Commits `e3134d7`, `a7e0032` (production) and `fbfea20` (SUMMARY) all reachable from HEAD
- `git rev-list --count 3a6dbbd..HEAD` = 3 at this point: the 2 production commits recorded in `actuals.commits` plus the SUMMARY commit
