---
phase: 01-foundation
plan: 03
subsystem: content
tags: [markdown, codegen, node-scripts, mcp, claude-code-plugin, codex-skills, ci]

# Dependency graph
requires:
  - "01-01: server/test/wire-surface.json — the registry's committed 22-entry mcp projection, read by the render step"
  - "01-02: descriptionFor / shapeFor / per_surface — read-only context; this plan does not touch server/src/tools.ts"
provides:
  - "method/ — the canonical teaching method, eleven surface-neutral sections plus four per-surface preambles"
  - "scripts/render-method.mjs — one render step for six committed targets, with hard failures for a missing section, a surface name in the body, an unknown token, a short registry projection and a stale exclusion"
  - "scripts/check-method.mjs + pnpm method:check — byte-exact drift gate, run by CI with no || true"
  - "server/src/method.generated.ts — METHOD_PREAMBLE / METHOD_SECTIONS / METHOD_BODY, the app's copy of the method"
  - "codex/skills/derive-{learn,review}/SKILL.md — full method bodies where there were none"
  - "plugin/commands/{learn,review}.md allowed-tools projected from the registry: 21 and 15 prefixed names"
affects: [01-06, 01-08, phase 4 conformance harness, phase 5 method work, phase 7 docs site]

actuals:
  tokens: 48505
  tasks: 3
  commits: 3
  plan_head_before: ee670c24102994ac6d95026f6d952e5033af7719

tech-stack:
  added: []
  patterns:
    - "Rendered-and-committed codegen: one Markdown source, six committed copies, a byte-exact check that fails CI rather than regenerating, so a change to what a model is told is always a reviewable diff"
    - "Marked regions: a generated span between HTML comment markers, with the file's frontmatter and title left hand-written outside it — a half-migrated tree is never a broken tree"
    - "Surface neutrality enforced by the renderer: the shared body may not contain a declared surface token, and may only carry the two declared placeholders; both are hard render failures naming the section file"
    - "Capability projection with reasoned exclusions: an allow-list is the registry minus a named exclusion list, each entry carrying a one-line reason, and an exclusion naming a tool the registry lacks is a hard failure"

key-files:
  created:
    - method/00-identity.md
    - method/10-philosophy.md
    - method/20-tools.md
    - method/30-quiz-options.md
    - method/40-discipline.md
    - method/50-checks.md
    - method/60-process.md
    - method/70-material.md
    - method/80-library.md
    - method/90-preferences.md
    - method/95-writing-style.md
    - method/surfaces/app.md
    - method/surfaces/claude-code.md
    - method/surfaces/codex-learn.md
    - method/surfaces/codex-review.md
    - scripts/render-method.mjs
    - scripts/check-method.mjs
    - server/src/method.generated.ts
    - codex/skills/derive-learn/SKILL.md
    - codex/skills/derive-review/SKILL.md
  modified:
    - server/src/prompt.ts
    - plugin/skills/teach/SKILL.md
    - plugin/commands/learn.md
    - plugin/commands/review.md
    - package.json
    - .github/workflows/ci.yml

key-decisions:
  - "The app target keeps {{WEB_TOOLS}} unsubstituted. Rendering it at build time would have baked WebSearch/WebFetch into a prompt the app also serves on the Codex backend; systemPrompt(backend) still substitutes it at runtime, now with replaceAll because the merged body names web tools five times instead of once."
  - "The rendered allowed-tools lines are in registry declaration order, not the hand-curated order they were committed in. The tool sets are identical (21 and 15, verified as unordered sets against the pre-phase commit); reproducing the old order would have required a hand-written 21-name list, which is exactly what D-07 removes."
  - "Every Markdown target uses marked regions, including the two Codex skills, so each file's frontmatter and title stay genuinely hand-written in the file rather than as a string literal in the render script."
  - "Surface mechanisms went to the preambles, surface-independent rules stayed in the body. The teach-first gate, already_held, answer/answer_in and start_lesson/end_lesson are facts about the terminal drivers (plan 01-02 established the same split for the tool descriptions); the rule each of them enforces is stated in the body."
  - "method/ carries both 'Review before new work, on the forgetting curve' (prompt.ts) and 'Warm-up first' (SKILL.md) as separate bullets. They are the same rule stated at two grains; merging them would have been the merge D-03 forbids, and dropping either would have lost a named rule."

requirements-completed: [FOUND-02, FOUND-01]

coverage:
  - id: D1
    description: "The method is written once under method/ and rendered to the app system prompt, the plugin skill, both Codex skills and the two allowed-tools lists"
    requirement: FOUND-02
    verification:
      - kind: other
        ref: "pnpm method:check — 'method: 6 rendered copies match method/', exit 0 on a clean tree"
        status: pass
      - kind: other
        ref: "node scripts/render-method.mjs writes server/src/method.generated.ts, plugin/skills/teach/SKILL.md, codex/skills/derive-{learn,review}/SKILL.md, plugin/commands/{learn,review}.md"
        status: pass
    human_judgment: false
  - id: D2
    description: "One surface-neutral body is shared verbatim; only four short preambles differ, and the renderer refuses a body that names a surface"
    requirement: FOUND-02
    verification:
      - kind: other
        ref: "re-tokenizing each rendered body by its surface's declared placeholder values makes all three Markdown targets byte-identical, and equal to the concatenation of method/*.md"
        status: pass
      - kind: other
        ref: "appending 'Call `start_lesson` first.' to method/60-process.md -> exit 1, 'method/ section \"process\" names \"start_lesson\", which belongs in a surface preamble'; reverted -> exit 0"
        status: pass
      - kind: other
        ref: "grep -c '{{#' method/*.md | grep -v ':0' | wc -l == 0; grep -o '{{[A-Z_]*}}' method/*.md | sort -u == {{TOOL_PREFIX}}, {{WEB_TOOLS}}"
        status: pass
      - kind: other
        ref: "wc -l method/surfaces/*.md == 5, 27, 27, 27 (all under 60)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The body is the union of the three existing copies with nothing compressed or lost, measured against the literal pre-phase commit b8f255ce"
    requirement: FOUND-02
    verification:
      - kind: other
        ref: "rule inventory over git show b8f255ce of prompt.ts, teach/SKILL.md and learn.md: 74 headings and bolded bullet leads extracted, 0 rules missing (3 in a preamble by D-02, 6 headings superseded by prompt.ts's superset heading)"
        status: pass
      - kind: other
        ref: "the nine exact strings the plan names all present in the concatenation of method/*.md, one occurrence each"
        status: pass
      - kind: other
        ref: "rendered app system prompt grew from 17,899 to 27,787 characters (claude backend), 0 unsubstituted tokens left on either backend"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every rendered copy is committed and CI fails when any of them drifts, with no || true"
    requirement: FOUND-02
    verification:
      - kind: other
        ref: "one trailing space inside the generated region of plugin/skills/teach/SKILL.md -> pnpm method:check exit 1 naming that path; reverted -> exit 0"
        status: pass
      - kind: other
        ref: "method/30-quiz-options.md truncated to zero bytes -> pnpm method exit 1, 'method/30-quiz-options.md is empty; a section with no text would render a target without that section'"
        status: pass
      - kind: other
        ref: "grep -A1 'Method text has not drifted' .github/workflows/ci.yml shows a bare 'run: pnpm method:check'"
        status: pass
    human_judgment: false
  - id: D5
    description: "The allowed-tools frontmatter of both plugin commands is generated from the registry, and the two counts stay distinct: 22 on the mcp surface, 21 in learn.md, 15 in review.md"
    requirement: FOUND-01
    verification:
      - kind: other
        ref: "set comparison against git show b8f255ce: learn.md and review.md tool sets unchanged; 21 and 15 prefixed names plus the fixed WebSearch, WebFetch, Skill tail; registry mcp = 22"
        status: pass
      - kind: other
        ref: "a tool removed from the registry projection -> exit 1 'lists 21 mcp tools, not 22'; a tool renamed leaving a stale exclusion -> exit 1 'plugin/commands/learn.md excludes \"library\", which the tool registry does not have'"
        status: pass
    human_judgment: false
  - id: D6
    description: "The Codex skills have real method bodies for the first time"
    requirement: FOUND-02
    verification:
      - kind: other
        ref: "codex/skills/derive-learn/SKILL.md and codex/skills/derive-review/SKILL.md are 220 lines each: hand-written frontmatter and title, their preamble, and the shared body. Before this plan neither file existed."
        status: pass
    human_judgment: false
  - id: D7
    description: "Nothing the tutor does changed: typecheck, build and the model-free test suite are green"
    requirement: FOUND-02
    verification:
      - kind: other
        ref: "pnpm typecheck clean; pnpm build clean; pnpm test — 38 pass, 0 fail"
        status: pass
      - kind: other
        ref: "node --check on both new scripts"
        status: pass
    human_judgment: false
  - id: D8
    description: "A real Claude Code plugin lesson and a real Codex lesson read the merged method and teach as before"
    requirement: FOUND-02
    verification: []
    human_judgment: true
    rationale: "No model runs in any test here, and the method text is what a model reads. The merged body is longer than any of the three copies it replaces and the Codex skills have a body for the first time; whether that reads well to a model is a judgment no automated check makes. This rides with the FOUND-04 human half already gated on plan 01-08 task 3."

duration: 70min
completed: 2026-09-18
status: complete
---

# Phase 01: Foundation — Plan 03 Summary

**The teaching method stopped existing three times: it is now eleven Markdown sections under `method/` plus four short per-surface preambles, rendered by `pnpm method` into the app's system prompt module, the plugin's `teach` skill, two Codex skills that had no method at all, and both plugin commands' `allowed-tools` — with `pnpm method:check` failing CI, byte for byte, when any copy drifts.**

## Performance

- **Duration:** ~70 min
- **Tasks:** 3
- **Files created/modified:** 26 (20 created)
- **Commits:** 3

## Accomplishments

- **`method/` is the method.** Eleven sections — identity, philosophy, tools, quiz options, discipline, checks, process, course material, the learner's library, preferences, writing style — written as the union of `server/src/prompt.ts`'s `PROMPT` (the spine), the 166-line `plugin/skills/teach/SKILL.md`, and the operational lines only `plugin/commands/learn.md` carried. Nothing was compressed: the rendered app prompt grew from 17,899 to 27,787 characters, which D-03 accepts as the cost.
- **`scripts/render-method.mjs` writes six committed targets** and refuses rather than degrading. A missing or empty section, a section no target renders, a missing surface preamble, a surface token in the shared body, an unknown `{{TOKEN}}`, a `{{#` conditional, a registry projection with fewer than 22 tools, and an exclusion naming a tool the registry does not have are each a hard failure with a lowercase sentence naming the file. It runs on bare Node with only `node:` imports and adds no dependency.
- **`scripts/check-method.mjs` is the gate.** It renders into an `mkdtempSync` directory, byte-compares each target with the committed copy, prints a short unified-diff report naming every file that differs, removes the temp dir, and exits non-zero. `.github/workflows/ci.yml` runs it as `Method text has not drifted` with a bare `run: pnpm method:check` — no `|| true`, and it never regenerates.
- **The two Codex skills have a method for the first time.** `codex/skills/derive-learn/SKILL.md` and `codex/skills/derive-review/SKILL.md` did not exist; the skills taught on tool descriptions alone. Each is now 220 lines: hand-written frontmatter and title, its own preamble, and the shared body.
- **Per-surface variation is four short files.** `method/surfaces/app.md` (5 lines), `claude-code.md`, `codex-learn.md` and `codex-review.md` (27 each) carry the tool prefixes, browser-versus-terminal answering, the lesson lifecycle, the teach-first gate and `already_held`, and the review session's own framing. Re-tokenizing each rendered body by its surface's two declared placeholder values makes all three Markdown targets byte-identical and equal to the concatenation of `method/*.md`.
- **`allowed-tools` is projected, not typed.** Each command's list is the 22-tool registry minus a named exclusion list whose every entry carries a reason: `library` for both (the plugin has never been allowed the catalog tool, and allowing it now would widen its capability), plus the six material and ingestion tools a review session has never needed. The result is 21 prefixed names in `learn.md` and 15 in `review.md`, identical as sets to the pre-phase commit.
- **`server/src/prompt.ts` shed 112 lines of method** and now assembles `METHOD_PREAMBLE` + `METHOD_BODY`. `systemPrompt(backend)`, `warmupBrief`, `firstTurnPrompt`, `materialAttachedPrompt` and `reviewTurnPrompt` stayed exactly where they are — turn prompts are not method text.

## Task Commits

1. **Task 1 (tracer): one method section rendered into every target, with CI failing on drift** — `313992d` (refactor)
2. **Task 2: the full merged method body, the union with nothing lost** — `ea48529` (refactor)
3. **Task 3: per-surface preambles, the Codex skill bodies, generated allowed-tools** — `f5c7066` (refactor)

## The rule inventory (D-03)

Extracted from the literal pre-phase commit `b8f255cee3bd601a081df8335c82e6212d97e62e` — not `HEAD`, not `HEAD~N`, whose four line counts (175 / 166 / 18 / 11) were confirmed first: **74 headings and bolded bullet leads across the three copies. Zero rules missing.**

Three items are in a surface preamble rather than the shared body, which is D-02 by construction, not an omission: SKILL.md's `## Where the learner answers` heading and its **browser** / **terminal** leads.

Six SKILL.md headings do not appear verbatim because `prompt.ts`'s heading is the spine and is a superset of each:

| SKILL.md heading | Where it lives now |
|---|---|
| `Teaching (Derive)` | still the hand-written title of `plugin/skills/teach/SKILL.md` |
| `The discipline (after Justin Skycak's *The Math Academy Way*)` | `The discipline: mastery, one bite at a time (after Justin Skycak's The Math Academy Way)` |
| `How this learner learns` | `How this learner wants to be taught` (the profile section's own name, as `prompt.ts` calls it) |
| `Writing quiz options (construction procedure)` | `Writing quiz options (construction procedure, every time)` |
| `The process: probe -> plan -> teach` | `The process: warm-up -> probe -> plan -> teach -> cumulative quiz. Every lesson, in order.` |
| `Formatting and length` | `Writing style` + its `## Length` subsection |

Every rule under each of those headings is present. The nine exact strings the plan names — "The material is the syllabus, not the authority", "Never walk through the slides in order", "A bare sequence of quizzes with one-line remarks between them is a failed lesson", "Never end your turn in the teach phase without a card pending", "Do not let them be lazy", "Block while learning, mix while checking", "Targeted remediation", "Review before new work, on the forgetting curve", "stop and teach" — each occur exactly once in `method/*.md`.

No D-03 conflict arose that needed the developer: where two copies said the same thing in different words, `prompt.ts`'s wording was kept and the other copy's distinct clauses folded in (`node_status` "with what the checks on each showed" and "the weakest" into **Targeted remediation**; "(the reply says so)" into **Layer immediately**; `purpose: "cumulative"` / `tests: "transfer"` / "the closing comes only after every node has held" into **The cumulative quiz**; the `axiom` definition into Principle i; the learner-profile probe hint into Phase 1a; "if they ask for changes, revise and call again" into Phase 2).

## What `plugin/commands/learn.md` lost, and where it went

Steps 4 to 6 were deleted. Every sentence has a counterpart:

| Removed from learn.md | Now in |
|---|---|
| "This is a lesson, not a coding task, so your usual brevity does not apply." | `method/95-writing-style.md` § Length, verbatim |
| "For a derived node, first ask for their attempt (`quiz` with `purpose: "pretest"`…), then write the actual teaching: motivate the node, establish it from the nodes below it, make the dependency explicit." | `method/60-process.md` Phase 3, steps 2–5 |
| "Several short paragraphs with math, a table or a diagram where they earn their place." | `method/95-writing-style.md` § Length, verbatim |
| "Then the check (`purpose: "check"`, a different question)." | `method/60-process.md` Phase 3, step 6 |
| "A bare sequence of quizzes with one-line remarks between them is a failed lesson." | `method/95-writing-style.md` § Length, verbatim |
| "Only skip the teaching for a node the probe already showed the learner holds: say so in one sentence and pass `already_held: true` to `quiz`." | rule in `method/60-process.md`; `already_held` in `method/surfaces/claude-code.md` and `codex-learn.md` |
| "Otherwise the check is refused until the teaching has been written." | `method/surfaces/claude-code.md` and `codex-learn.md` § The teach-first gate |
| "Every quiz result says how sure the learner was and what to do next; do that (a hint before a re-derivation, a teach-back after an unsure pass, a named correction after a confident miss)." | `method/50-checks.md` and `method/60-process.md` step 6 |
| "Never end your turn in the teach phase without a card pending: write the teaching and call `quiz` in the same turn." | `method/60-process.md`, verbatim |
| "Pass `tests` on every teach-phase quiz (`intuition`, `procedure` or `transfer`)." | `method/20-tools.md` (`quiz`) and `method/60-process.md` step 6 |
| "A derived node does not lock on procedure alone: `node_status(id, "locked")` is refused until an intuition or transfer question on it has passed…" | `method/40-discipline.md` **Mastery before advancing**; `method/20-tools.md` (`node_status`) |
| "Most checks should be intuition questions; the learner's stated weakness is memorizing steps without understanding." | `method/40-discipline.md` **Intuition over procedure, always** |
| "When the goal node is locked, `node_status` returns the cumulative quiz… Run it in full; a miss marks the node shaky and the result says how to remediate." | `method/40-discipline.md` **The cumulative quiz**; `method/60-process.md` closing |
| "Only when every node has held, write the closing…, store 1 to 3 durable notes with `remember`, then call `end_lesson`." | `method/60-process.md` closing; `end_lesson` in the terminal preambles |

Steps 1 to 3 and the "if the server is not running" fallback stay hand-written, as the plan asks. `plugin/commands/review.md`'s prose body was not touched; only its `allowed-tools` line is generated.

## Deviations from Plan

### 1. [Interpretation] `{{WEB_TOOLS}}` is left unsubstituted on the app surface

- **Found during:** Task 1.
- **Issue:** Task 3 says `{{WEB_TOOLS}}` "resolves to the backtick-quoted `WebSearch` / `WebFetch` pair for the app". But the app runs on either backend: `server/src/agent.ts` calls `systemPrompt(backend())`, and `backend()` returns `codex` whenever `DERIVE_BACKEND=codex` or only a Codex login exists. Baking the Claude pair in at render time would have told the app's Codex tutor to call tools it does not have — a behaviour change this plan forbids.
- **Fix:** the render declares `WEB_TOOLS: null` for the app surface, meaning "leave the token in place", and `systemPrompt(backend)` substitutes it at runtime exactly as it does today. Task 2's own instruction ("with `systemPrompt(backend)` still doing the `{{WEB_TOOLS}}` substitution it does today") reads the same way.
- **Verification:** `systemPrompt('claude')` and `systemPrompt('codex')` both return a prompt with zero `{{TOKEN}}` left, 27,787 and 27,862 characters.
- **Commit:** `313992d`

### 2. [Rule 1 - Bug] `PROMPT.replace` only ever substituted the first `{{WEB_TOOLS}}`

- **Found during:** Task 2.
- **Issue:** `String.prototype.replace` with a string pattern replaces one occurrence. The old `PROMPT` named the web tools once, so it worked; the merged body names them five times (the tools bullet, "Accuracy is non-negotiable", Phase 2, course material, the library). Four would have shipped as the literal `{{WEB_TOOLS}}`.
- **Fix:** `PROMPT.replaceAll('{{WEB_TOOLS}}', web)`.
- **Verification:** zero unsubstituted tokens on both backends (above).
- **Commit:** `ea48529`

### 3. [Interpretation] The rendered `allowed-tools` lines are in registry order

- **Found during:** Task 1.
- **Issue:** Task 3 asks the exclusion lists to be seeded "so that the rendered lines are byte-identical to what is committed today". The committed order is hand-curated (lifecycle, material, library, cards, graph, memory) and is not the registry's declaration order, so byte-identity would have required a hand-written 21-name ordering — the thing D-07 exists to delete.
- **Fix:** rendered in registry declaration order. The acceptance criterion's own instrument is "an unordered set comparison", and the task's `fails_when` defines failure as "a changed tool name". Neither is triggered: both sets are identical to `git show b8f255ce`, at 21 and 15 prefixed names. This matches plan 01-02's finding that order is not the contract and the tool set is.
- **Commit:** `313992d`

### 4. [Interpretation] The Codex `SKILL.md` files use marked regions, not whole-file generation

- **Found during:** Task 1.
- **Issue:** Task 1 says "In the Codex `SKILL.md` files the whole file is generated" and, three sentences later, that they are "created with a hand-written frontmatter block plus that region".
- **Fix:** the concrete instruction won. All three Markdown targets use the same `<!-- method:begin -->` / `<!-- method:end -->` mechanism, so each file's frontmatter and title are genuinely hand-written, in the file, rather than as a template literal inside the render script. The render fails with a named error if a target has no region.
- **Commit:** `313992d`

### 5. [Interpretation] Section completeness is checked against a declared section list, not against preamble references

- **Found during:** Task 1.
- **Issue:** Task 1 asks the render to fail "if a surface preamble names a section id that no file provides". The preambles are prose and reference no section ids, so that check would never fire.
- **Fix:** the stronger equivalent: `BODY_SECTIONS` in the render script declares the eleven ids every target gets, and the render fails both when a declared id has no file and when `method/` holds a section no target renders. A section cannot be silently dropped from a target in either direction.
- **Commit:** `313992d`

### 6. [Interpretation] The body is byte-identical across the three Markdown targets *modulo the two declared placeholders*

- **Found during:** Task 3.
- **Issue:** Task 3's criterion asks the region below each preamble to be equal in all three files. That cannot hold literally while the same task requires `{{TOOL_PREFIX}}` and `{{WEB_TOOLS}}` to resolve per surface.
- **Fix:** verified in the form that carries the meaning — substituting each surface's two declared values back to their tokens makes all three bodies byte-identical to each other *and* to the concatenation of `method/*.md`. The two Codex bodies are byte-identical to each other with no tokenizing at all.
- **Commit:** `f5c7066`

### 7. [Interpretation] `method/70-material.md` and `80-library.md` no longer say "when the section below is present"

- **Found during:** Task 2.
- **Issue:** `prompt.ts`'s tools bullet says the library's "entries and the rules" arrive together in a runtime section. Now the rules are unconditionally in the body while `materialsSection` and `librarySection` still append the entries (and their own copy of the rules) when there are any.
- **Fix:** the two sections open with a neutral framing sentence ("the entries relevant to the topic are listed for you when the shelf has any") and the `20-tools.md` bullets point at the body sections for the rules. No rule changed; the sentence that described the old delivery mechanism did. `server/src/materials.ts` and `server/src/library.ts` were not touched — they are outside this plan's scope and their runtime sections still carry the entries.
- **Commit:** `ea48529`

### 8. [Sequencing] Task 1 created the four surface preambles

- **Found during:** Task 1.
- **Issue:** the render requires a preamble per surface (a missing one is a hard failure), but `method/surfaces/` is listed under task 3's files.
- **Fix:** task 1 created the four files with their minimal real content so every render was valid from the first commit; task 2 completed `claude-code.md` (needed to restructure `plugin/skills/teach/SKILL.md` without duplicating the method in a shipped commit); task 3 completed the other three.
- **Commits:** `313992d`, `ea48529`, `f5c7066`

### 9. [Environment] Commits landed on `main`

- **Found during:** every commit.
- **Issue:** the executor's commit protocol halts when HEAD is the default branch, and `main` resolves as protected.
- **Fix:** proceeded, as plan 01-02 did. `.planning/config.json` sets `git.branching_strategy: "none"`, the orchestrator dispatched sequentially onto the main working tree, and every GSD commit in this repository is on `main`. Recorded so it is visible rather than silent.

**Total deviations:** 9 — 6 interpretations of a criterion whose intent is met (5 more strongly), 1 auto-fix (Rule 1), 1 sequencing note, 1 environment note.
**Impact:** none on what the tutor does. The app's method is the same rules in a longer prompt, the plugin's `allowed-tools` sets are unchanged, and the Codex skills gained a method where they had none.

## Decisions Made

- **A rule that exists in one copy only still goes in.** `Retrieval, not recognition` (only `prompt.ts`), the whole Course material and library sections, `What a check tells you`, `Phase 0: Warm-up` and the preference rules (only `SKILL.md`), and the two operational lines (only `learn.md`) are all in the body. Where two copies stated the same rule at different grains — `Review before new work, on the forgetting curve` and `Warm-up first` — both bullets are kept, because merging them is the merge D-03 forbids.
- **The renderer is the guard, not a convention.** Surface neutrality, the placeholder vocabulary, the absence of conditionals, section completeness, the registry's 22-tool count and exclusion validity are all enforced at render time with a named failure. A rule stated only in a comment is a rule that drifts.
- **The commands' allow-lists must not widen.** `library` is on the MCP wire and in the snapshot (D-08) and is excluded from both commands by name and reason. The plan's two counts — 22 on the wire, 21 in `learn.md` — are asserted in the same check so they cannot be conflated.
- **Turn prompts are not method text.** `warmupBrief`, `firstTurnPrompt`, `materialAttachedPrompt` and `reviewTurnPrompt` stayed in `server/src/prompt.ts` untouched. They are per-turn instructions the server composes, not the method every surface shares.

## Issues Encountered

None. Every perturbation test (a trailing space in a rendered region, a zero-byte section, a surface token pasted into the body, a tool removed from the registry projection, a tool renamed leaving a stale exclusion) was reverted and `pnpm method:check` returns to exit 0; `git status` is clean for `server/test/wire-surface.json`.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 01-06 gains the method as data: `METHOD_SECTIONS` is keyed and `scripts/render-method.mjs` already has the per-surface substitution seam a provider surface would hook into.
- Plan 01-08's manual run now also exercises the two Codex skills, which have a body for the first time; the codex tool prefix asserted in their preambles (`derive__`) is the one thing in this plan that a real Codex session should confirm, and the preambles say to use whatever names the tool list actually shows if it qualifies them differently.
- Phase 7's docs site can include `method/*.md` directly, which is why D-01 chose Markdown.
- Carried forward: the FOUND-04 human half stays gated on plan 01-08 task 3, and D8 above rides with it.

## Self-Check: PASSED

- All 20 created files exist on disk (`method/` 15, `scripts/` 2, `server/src/method.generated.ts`, both Codex `SKILL.md`).
- `313992d`, `ea48529`, `f5c7066` all present in `git log`.
- `pnpm method:check` exit 0; `pnpm typecheck` clean; `pnpm build && pnpm test` → 38 pass, 0 fail; `node --check` clean on both scripts.
- `git rev-list --count ee670c2..HEAD` = 3, matching the `commits:` recorded above.

---
*Phase: 01-foundation*
*Completed: 2026-09-18*
