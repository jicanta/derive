---
phase: 03-owned-loop-api-keys-and-gateways
plan: 07
subsystem: api
tags: [json-schema, zod, tool-registry, wire-surface, openai-strict, gemini, validation, ai-sdk, node-test]

# Dependency graph
requires:
  - phase: 03-owned-loop-api-keys-and-gateways
    provides: "plan 03-06's fourth tool surface (`api`), its sixteen rows in server/test/wire-surface.json, and the bounds assertion deliberately left on the agent surface so this plan could add its own key without touching it"
  - phase: 03-owned-loop-api-keys-and-gateways
    provides: "plan 03-03's adapter table keyed by ProviderId — the one place a provider's own facts live, which is where each row's dialect now goes"
  - phase: 03-owned-loop-api-keys-and-gateways
    provides: "plan 03-01's owned loop (server/src/drivers/api.ts): buildTools over the registry, the per-lesson mutex, and plan 03-04's replay guard that validation has to run after"
  - phase: 01-foundation
    provides: "the one tool registry and its per-surface projection (jsonSchemaOf, shapeFor, descriptionFor), and the frozen wire-surface fixture that turns a contract change into a reviewable diff"
provides:
  - "TOOL_DIALECTS and ToolDialect: the four dialects the one registry projects into — full, openai-strict, gemini, compact"
  - "jsonSchemaOf(spec, surface?, dialect = 'full'): the per-dialect projection built on zod's own `override` hook, with `'full'` byte-identical to the two-argument call it replaces"
  - "descriptionFor(spec, surface, dialect = 'full'): the same widening for the text the model reads, so the compact dialect shortens the tool description as well as the field descriptions"
  - "validateToolInput(spec, surface, input): the full-zod-schema check on every incoming tool call, throwing a lowercase sentence naming the first failing field"
  - "Adapter.dialect on all five teaching rows: gemini on the Gemini row, full on the other four — the strict dialect ships built and CI-validated and selected by nobody"
  - "Three new fixture keys (dialect:openai-strict, dialect:gemini, dialect:compact) over the api surface, 1739 insertions and 0 deletions"
  - "Six outright dialect-rule assertions in wire-surface.test.ts, which is what catches a projection that is stable and wrong"
  - "Three api-driver cases: a schema-violating set_plan that does not run, the same refusal on the dialect that could not express the bound, and the wire schema asserted per dialect"
affects: [03-08 cost and prices UI, 03-09 the settings cards, phase-04 conformance harness and local models]

actuals:
  tokens: 26027   # chars/4 over the realized diff 171f9f5..d04d652; 15747 of it is the regenerated wire-surface.json
  tasks: 2
  commits: 2   # measured from the ledger at SUMMARY write: the two production commits. Close-out commits (this file, STATE/ROADMAP) land after and are not counted — see Self-Check.
  plan_head_before: 171f9f546c1636a1935e294c6e131bdf4273109c

tech-stack:
  added: []
  patterns:
    - "Per-dialect projection on zod's own `override(ctx)` hook rather than a walk over the emitted document: the registry rows are read and never rewritten, which is what keeps one contract and four wire formats from becoming four contracts"
    - "A subtractive dialect for a pass-through provider: the Gemini projection deletes every key outside a six-keyword allow-list, so a keyword a future registry row introduces is dropped automatically rather than becoming a 400 on a learner's lesson"
    - "Validate against the full schema at the boundary that writes, never against the dialect the provider was shown — the dialect governs what the model is told, the registry governs what Derive accepts"
    - "A compact description is always a prefix of the registry's, never a rewrite: the dialect may give a model less of what the registry wrote, never different words"
    - "A keyword walker that skips the keys under `properties`: they are the tutor's own field names, and a rule about schema keywords that counts them is a rule that can never pass"

key-files:
  created: []
  modified:
    - server/src/tools.ts
    - server/src/drivers/adapters.ts
    - server/src/drivers/api.ts
    - server/test/wire-surface.test.ts
    - server/test/wire-surface.json
    - server/test/api-driver.test.ts

key-decisions:
  - "`io` stays at zod's default `'output'`: `io: 'input'` is semantically right for a tool input schema but drops `additionalProperties: false` from all 24 tools on all four surfaces — it both moves the frozen fixture and takes away the one keyword OpenAI's strict mode requires"
  - "`descriptionFor` was widened with the same dialect parameter as `jsonSchemaOf`, because the compact dialect's whole purpose is less text for a small context window and the tool description is the longest text there is"
  - "The compact dialect keeps `$schema`; the strict and Gemini dialects drop it. `$schema` is written onto the document after zod's override hook has run, so it is deleted from the emitted object — the one key the seam cannot reach, recorded as such in a comment"
  - "The strict projection applies to nested objects too, not just the root: zod calls `override` for every schema it generates, so `set_plan`'s node object is all-required with `additionalProperties: false` as surely as the root is, which is what OpenAI's rules actually require"
  - "The plan's own Gemini gate script counted property names as schema keywords and could never pass; the walker was corrected rather than the rule relaxed"

patterns-established:
  - "Dialect keys in the frozen fixture sit beside the surface keys with the same row shape, so the existing byte-for-byte comparison, the formatting assertion and the UTF-8/LF/trailing-newline assertion all cover them with no new machinery"
  - "A dialect is a provider's format, so it is projected over the `api` surface only: the plugin's MCP wire and the HTTP action route are Derive's own surfaces and get no dialect key"

requirements-completed: [PROV-10]

coverage:
  - id: D1
    description: "Tool schemas are projected per provider dialect — OpenAI strict, Gemini, and the compact form Phase 4 needs — from the one registry, which is untouched"
    requirement: PROV-10
    verification:
      - kind: unit
        ref: "server/test/wire-surface.test.ts#matches the committed fixture"
        status: pass
      - kind: unit
        ref: "server/test/wire-surface.test.ts#every dialect covers the same tools, in the same order"
        status: pass
      - kind: other
        ref: "git diff -U0 -- server/src/tools.ts | no added or removed line contains .describe( -> `registry descriptions untouched`"
        status: pass
      - kind: other
        ref: "node check: the four surface keys of wire-surface.json are byte-identical to HEAD~2's, added keys are exactly the three dialect keys"
        status: pass
    human_judgment: false
  - id: D2
    description: "The OpenAI strict projection drops the four bounds, puts every property in required, expresses each optional as a nullable union, and keeps additionalProperties: false"
    requirement: PROV-10
    verification:
      - kind: unit
        ref: "server/test/wire-surface.test.ts#strict mode has additionalProperties: false with every key in required"
        status: pass
      - kind: unit
        ref: "server/test/wire-surface.test.ts#strict mode emits no unsupported keyword"
        status: pass
      - kind: unit
        ref: "server/test/wire-surface.test.ts#strict mode expresses an originally-optional field as a nullable union"
        status: pass
    human_judgment: false
  - id: D3
    description: "The Gemini projection emits only type, properties, required, description, enum and items, because Google passes a tool schema through verbatim and a rejected keyword is a 400 rather than a warning"
    requirement: PROV-10
    verification:
      - kind: unit
        ref: "server/test/wire-surface.test.ts#the gemini dialect uses no rejected keyword"
        status: pass
      - kind: integration
        ref: "server/test/api-driver.test.ts#shows gemini a schema with no bounds in it, and anthropic one with them"
        status: pass
    human_judgment: true
    rationale: "No Gemini key exists in this environment. That the six-keyword subset is what Google actually accepts is LOW confidence (03-RESEARCH A3: the Schema reference page would not render), and one real lesson that reaches set_plan and draws its graph is what converts the assumption into a fact. The plan marks this truth `backstop` for exactly that reason; it is recorded in .planning/WINDOWS.md as an unrun verify."
  - id: D4
    description: "The compact projection shortens descriptions and keeps the same keyword set, so Phase 4's local-model work has its hook"
    requirement: PROV-10
    verification:
      - kind: unit
        ref: "server/test/wire-surface.test.ts#the compact dialect shortens descriptions and keeps the keyword set"
        status: pass
    human_judgment: false
  - id: D5
    description: "An incoming tool call whose arguments fail the full zod schema is refused with a lowercase sentence naming the field, and the tool body does not run"
    requirement: PROV-10
    verification:
      - kind: integration
        ref: "server/test/api-driver.test.ts#refuses a set_plan the full schema rejects, without running the tool and without failing the turn"
        status: pass
      - kind: other
        ref: "grep -c validateToolInput server/src/tools.ts -> 2; server/src/drivers/api.ts -> 2"
        status: pass
    human_judgment: false
  - id: D6
    description: "A narrower dialect never narrows what Derive accepts: a bound the Gemini dialect could not express is still enforced server-side"
    requirement: PROV-10
    verification:
      - kind: integration
        ref: "server/test/api-driver.test.ts#enforces a bound on gemini that the gemini dialect could not express"
        status: pass
    human_judgment: false
  - id: D7
    description: "The OpenAI adapter row runs non-strict by default, so the bounds set_plan and quiz rely on survive on every row an adapter selects"
    verification:
      - kind: unit
        ref: "server/test/wire-surface.test.ts#keeps the bounds the model is held to when a shape is projected (agent and api surfaces)"
        status: pass
      - kind: other
        ref: "no `openai-strict` in server/src/drivers/adapters.ts with comment text stripped -> 0"
        status: pass
      - kind: other
        ref: "node check over the committed fixture -> `api bounds kept`"
        status: pass
    human_judgment: true
    rationale: "That a real OpenAI lesson actually plans with three to twelve nodes and quizzes with two or three options needs a real OpenAI key; the non-strict default is asserted on the wire and in the fixture, not in front of a learner. Recorded in .planning/WINDOWS.md as an unrun verify."
  - id: D8
    description: "Each provider is handed a pre-projected JSON Schema through jsonSchema(...), never a zod schema, so the bytes on the wire are the bytes in the fixture"
    verification:
      - kind: other
        ref: "grep -cE 'jsonSchema<.*>\\(jsonSchemaOf\\(' server/src/drivers/api.ts -> 1; grep -cE 'inputSchema: z\\.' -> 0"
        status: pass
      - kind: integration
        ref: "server/test/api-driver.test.ts#shows gemini a schema with no bounds in it, and anthropic one with them"
        status: pass
    human_judgment: false
  - id: D9
    description: "The plugin's MCP wire and the HTTP action surface are byte-unchanged"
    verification:
      - kind: integration
        ref: "server/test/mcp.test.ts + server/test/api.test.ts -> 17 pass, 0 fail"
        status: pass
      - kind: other
        ref: "git diff of wire-surface.json -> 1739 insertions, 0 deletions"
        status: pass
    human_judgment: false

# Metrics
duration: 22 min
completed: 2026-10-12
status: complete
---

# Phase 03 Plan 07: Per-Dialect Tool Schema Projection Summary

**One untouched registry projected into four provider dialects on zod's own `override` seam — OpenAI strict, Gemini's six-keyword subset, the compact form Phase 4 inherits, and the registry's own form every adapter actually selects — with every incoming tool call still checked against the full zod schema before the tool body runs.**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-10-12T19:05Z (base `171f9f5`)
- **Completed:** 2026-10-12T19:27Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- **`TOOL_DIALECTS` and `jsonSchemaOf(spec, surface?, dialect = 'full')`.** `'full'` is produced by the same one line it always was and is byte-identical to the two-argument call — the existing fixture comparison proves it across all 24 tools on all four surfaces. The other three ride `z.toJSONSchema(schema, { override })`, which zod documents as "arbitrary custom logic that can be used to modify the generated JSON Schema". It needs no dependency, and it is what keeps D-28's boundary honest: the registry rows are read, never rewritten.
- **`'openai-strict'`.** Drops `minItems`, `maxItems`, `minimum` and `maximum` wherever they appear, puts **every** property into `required`, turns each originally-optional property into a nullable union (`"type": ["string","null"]`, with `null` appended to any `enum` that gained it), and keeps `additionalProperties: false`. Because zod calls `override` for every schema it generates, this applies to nested objects too: `set_plan`'s node object is all-required with `additionalProperties: false` exactly as the root is, which is what OpenAI's rules actually require and what a root-only rewrite would have missed.
- **`'gemini'`.** Subtractive rather than clever: every key outside `type`, `properties`, `required`, `description`, `enum`, `items` is deleted. Google hands a tool schema to the model verbatim (`parametersJsonSchema: tool.inputSchema`) and runs no sanitiser over it, so a keyword it rejects is a 400 on the learner's lesson rather than a warning Derive could recover from. The allow-list form means a keyword a future registry row introduces is dropped automatically instead of becoming that 400. `target: 'openapi-3.0'` was not taken: it emits OpenAPI nullability (`nullable: true`) rather than JSON Schema unions, which is a different wire shape than this dialect promises.
- **`'compact'`.** Every description shortened to its first sentence, cut at a word boundary when the sentence itself runs past 180 characters, with the keyword set left exactly as `'full'`'s. The abbreviation guard keeps `e.g.` and single initials from being read as sentence ends. `quiz`'s 776-character description becomes 80; `web_search`'s 437 becomes 136; `set_phase`'s 46 is already one sentence and is untouched. Every compact description is a **prefix** of the registry's, asserted outright — the dialect may give a model less of what the registry wrote, never different words.
- **`validateToolInput`, PROV-10's server-side half.** `z.object(shapeFor(spec, surface)).safeParse(input)` against the **full** schema, throwing `set_plan: nodes: Too small: …` in the shape `index.ts`'s own action route already answers a malformed body with. It is the only validation on that path: `jsonSchema(...)` from the SDK carries a `validate` only when the caller supplies one, and Derive does not, so without this a bound the dialect dropped was a bound nobody enforced. Called inside the mutex, **after** the replay guard (a recorded result is returned without re-validating a call that already succeeded) and **before** `actions.runTool`.
- **Each adapter row names its dialect.** `gemini` → `'gemini'`; `anthropic`, `openai`, `openrouter` and `openai-compatible` → `'full'`. The OpenAI row carries the reasoning beside it: strict mode is opt-in per tool and off by default, and turning it on would cost the four bounds `set_plan` (3–12 nodes) and `quiz` (2–3 options) hold the model to — the shape of a Derive lesson. So the strict dialect ships built and CI-validated and selected by nobody, which is what Phase 4's conformance harness can switch on and measure.
- **`io` stays at zod's default `'output'`, with the reason recorded.** A probe over all 24 tools on all four surfaces found `io: 'input'` moves **68** projections, and the move is `additionalProperties: false` disappearing from every one of them. That both shifts the frozen fixture and takes away the single keyword strict mode requires, so the semantically-nicer option is the wrong one here. The plan asked for whichever branch applied to be written down rather than guessed; this is it.
- **The fixture gained three keys and lost nothing.** `dialect:openai-strict`, `dialect:gemini` and `dialect:compact`, each 16 rows in api-surface order, with the same `{ name, description, input_schema }` shape as a surface key — so the byte-for-byte comparison, the 2-space/LF/one-trailing-newline assertion and the key-order pin all cover them with no new machinery. **1739 insertions, 0 deletions**, and a scripted check confirms the `agent`, `api`, `mcp` and `http` keys are byte-identical to what 03-06 committed. There is no `dialect:full`: that is what the `api` key already holds, and the test asserts the absence so nobody adds the same rows twice.
- **Six rules assertions, which is the half a snapshot cannot do.** A snapshot would freeze an invalid schema as happily as a valid one. The new `describe` asserts strict's `additionalProperties`/all-required pair, strict's full 18-keyword unsupported list, strict's nullable unions on `quiz`'s three genuine optionals, Gemini's six-keyword subset, compact's shortened-but-same-keywords (including "at least one is strictly shorter, otherwise the dialect does nothing"), and identical tool coverage across all three dialects.
- **The bounds assertion now covers the surface the owned loop uses.** It ran on `agent` only; it now runs on `agent` and `api`, with a sentence recording that the strict dialect drops all four by design and is asserted separately — so a reader does not take the two assertions as contradictory.
- **Three api-driver cases that pin the behaviour to the wire.** A `set_plan` of one node: no `plan` event, `listNodes(id).length === 0`, exactly one `error-text` tool result matching `/^set_plan: nodes: /`, the correction present in the second request's prompt, and `turn_end` still `{ ok: true, verified: 0 }` — the model gets a chance to fix its own mistake rather than losing the turn. The same refusal for a `quiz` of one option **on the Gemini dialect**, where the schema Gemini was shown carried no `minItems` at all to refuse it with. And the wire itself: the function tools Gemini received contain neither `minItems` nor `additionalProperties`, and the ones Anthropic received contain both.

## Task Commits

1. **Task 1: per-dialect projection on the registry's own seam, and the full-schema validator the server keeps** — `14a7a3d` (feat)
2. **Task 2: freeze each dialect in the fixture, and assert the dialect rules outright** — `d04d652` (test)

**Plan metadata:** this file (docs: complete plan)

## Files Created/Modified

- `server/src/tools.ts` — `TOOL_DIALECTS`, `ToolDialect`, `BOUNDS`, `GEMINI_KEYWORDS`, `DROPS_SCHEMA_KEYWORD`, `COMPACT_CHARS`, `ABBREVIATION`, `shortened` (private), `nullable` (private), `project` (private), the widened `descriptionFor(spec, surface, dialect?)` and `jsonSchemaOf(spec, surface?, dialect?)`, and `validateToolInput` with its one-per-tool-and-surface schema cache. **No registry row was edited**: no `.describe(...)` string appears on either side of the diff.
- `server/src/drivers/adapters.ts` — `dialect: ToolDialect` on the `Adapter` type with a doc comment saying why it is a per-row fact, and the member on all five teaching rows with a one-sentence reason each. The OpenAI row's reason is the longest, because it is the one a reviewer will ask about.
- `server/src/drivers/api.ts` — `buildTools` takes the dialect and projects both the description and the schema with it; `validateToolInput(spec, 'api', input)` runs after the replay guard and its parsed value is what reaches `actions.runTool`.
- `server/test/wire-surface.test.ts` — `DIALECTS` derived from `TOOL_DIALECTS` minus `'full'`; the three dialect keys in `wireSurface()`; the `keywords()` walker; the bounds assertion looped over `agent` and `api`; and the second `describe` with its six rules.
- `server/test/wire-surface.json` — regenerated once with `DERIVE_WRITE_WIRE_SURFACE=1`, diff reviewed before committing.
- `server/test/api-driver.test.ts` — `listNodes` added to the dynamic import, `toolErrorsOf(lesson, provider)` reading the error-text tool results out of the turn's persisted history, and the three new cases.

## Decisions Made

- **`descriptionFor` was widened too, not just `jsonSchemaOf`.** The plan's artifacts list names only `jsonSchemaOf`, `validateToolInput`, `TOOL_DIALECTS` and `ToolDialect`, but Task 2 asks the suite to assert that "every `dialect:compact` row's description length is less than or equal to the `api` row's … and that at least one is strictly shorter". A row's `description` is the **tool** description, which `jsonSchemaOf` does not produce. Widening `descriptionFor` with the identical dialect parameter is the honest shape: the compact dialect exists to give a small-context model less text, and the tool description is the longest text there is. `drivers/api.ts` projects both with the same dialect, so a compact provider would get short descriptions on the wire as well as in the fixture. No adapter selects `'compact'` today, so nothing in production moved.
- **`$schema` is deleted from the emitted document, and the comment says why.** zod writes it on after the `override` hook has run, so it is the one key the seam cannot reach. The strict and Gemini dialects drop it (an unknown key to both providers); the compact dialect keeps it, because the compact rule is that its keyword set equals `'full'`'s exactly.
- **The Gemini dialect is an allow-list, not a deny-list.** The research marks Gemini's exact rejected set LOW confidence, so a deny-list would be a guess that silently stops covering a keyword a later registry row introduces. An allow-list of the six keywords Google's own guide documents by example is wrong only in the safe direction: it can emit less than Gemini would accept, never more.
- **`validateToolInput` caches one zod object per tool and surface.** It is on the path of every tool call, and `index.ts` already builds its `ACTION_SCHEMAS` map once for the same reason. The cache is lazy rather than module-load so `tools.ts` keeps its "no import-time side effect beyond building its own lookup map" promise.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The plan's Gemini keyword gate counted property names as schema keywords and could never pass**

- **Found during:** Task 1 (running the plan's own `<verify>` script)
- **Issue:** The gate's walker (`keys(o)` recursing into every value and adding every key) collects the keys under `properties` — which are the tutor's own field names. Run against a correct Gemini projection it threw `gemini dialect emits rejected keyword goal`. The identical walker appears in Task 2's standalone fixture check and in the `it` Task 2 asks for, so the rule was unsatisfiable in three places.
- **Fix:** The walker skips the keys of a `properties` object while still recursing into their values, with a comment saying why. It is `keywords()` in `wire-surface.test.ts` and the same shape in both standalone gate scripts. The rule itself was not relaxed — the strict dialect's 18-keyword check and Gemini's six-keyword allow-list are asserted exactly as specified, now over 16 rows rather than one.
- **Files modified:** `server/test/wire-surface.test.ts`
- **Verification:** `dialect rules ok` over all 16 api tools; `dialect rules frozen ok` over the committed fixture; the two `it`s pass.
- **Committed in:** `d04d652`

**2. [Rule 1 - Bug] Two of the plan's `<verify>` commands could not run in this environment as written**

- **Found during:** Task 1
- **Issue:** (a) `node --import tsx -e "import('./server/src/tools.ts')…"` from the repo root fails with `Cannot find package 'tsx' imported from /home/jicanta/derive/` — `tsx` is a `server` devDependency and the workspace root does not resolve it. (b) `grep -c "jsonSchema(jsonSchemaOf(" server/src/drivers/api.ts` returns 0 because the call has carried an explicit type argument since 03-01: `jsonSchema<Record<string, unknown>>(jsonSchemaOf(…))`. The gate was already unsatisfiable against the code 03-06 left.
- **Fix:** (a) run from `server/` so `tsx` resolves, with the import path adjusted to `./src/tools.ts` — same assertions, same code under test. (b) assert the gate's actual intent with `grep -cE 'jsonSchema<.*>\(jsonSchemaOf\('` → **1**, plus `grep -cE 'inputSchema: z\.'` → **0**, which is the thing that matters: a pre-projected JSON Schema reaches the provider and a zod schema never does. The code was not weakened to match the literal; the type argument is load-bearing for the `ToolSet` typing.
- **Files modified:** none (verification only)
- **Verification:** both commands run clean; the `shows gemini a schema with no bounds in it` case asserts the same fact against the bytes the model actually received.
- **Committed in:** n/a (gates, not code)

**3. [Rule 2 - Missing Critical] The strict dialect had to apply to nested objects, not only the root**

- **Found during:** Task 1
- **Issue:** The plan states the strict rules in the singular ("put **every** property name into `required`"), and Task 2's assertion reads only the top-level `schema.properties` / `schema.required`. OpenAI's own rules are per object: `additionalProperties: false` is required on **every** object and all fields of every object must be in `required`. `set_plan.nodes.items` is an object with five properties, one of them optional — a root-only projection would have shipped a schema OpenAI's strict mode rejects, and the plan's own assertion would have passed on it.
- **Fix:** `project()` handles any node whose `type` is `'object'`, which zod's `override` reaches for every schema it generates. `set_plan`'s node object comes out all-required with `depends_on` as `["array","null"]` and `additionalProperties: false`, visible in the committed fixture.
- **Files modified:** `server/src/tools.ts`
- **Verification:** the `strict mode has additionalProperties: false with every key in required` and `strict mode emits no unsupported keyword` assertions walk recursively; the fixture shows the nested object's `required` carrying all five names.
- **Committed in:** `14a7a3d`

---

**Total deviations:** 3 auto-fixed (2 bugs in the plan's own verification, 1 missing critical in the projection)
**Impact on plan:** No scope creep and no task's `<done>` weakened. Two were gates that could not pass as written — one would have failed a correct projection, one was already failing against 03-06's code — and the third is a correctness requirement OpenAI's published rules impose that the plan stated only in the singular. One API was widened beyond the plan's artifact list (`descriptionFor`), without which Task 2's compact assertion has nothing to assert.

## Issues Encountered

- **`io: 'input'` turned out to be a real decision rather than a formality.** The plan wrote both branches out so the executor could not land it silently; the probe answered 68 moved projections, all of them the loss of `additionalProperties: false`. That makes the semantically-correct option actively harmful here, since it removes the keyword OpenAI's strict mode requires on every object. Recorded in `jsonSchemaOf`'s doc comment so the next reader does not re-litigate it.
- **Nothing validates a tool call but Derive.** Confirmed by reading `@ai-sdk/provider-utils`'s `jsonSchema(jsonSchema, { validate } = {})`: `validate` is whatever the caller passed, and the loop passes none. So before this plan the registry's bounds were documentation on the `api` surface, not enforcement — which is why `validateToolInput` is a correctness fix as much as it is PROV-10's second half.

## User Setup Required

None — no external service configuration is required. A learner on Gemini gets the narrower schema automatically from their provider's own adapter row.

## Next Phase Readiness

- **Ready for 03-08** (cost and prices UI) and **03-09** (the settings cards). Neither reads the dialect seam; `wire-surface.json`'s four surface keys are byte-unchanged, so nothing either plan asserts about the tool contract has moved.
- **Ready for Phase 4.** The two hooks that phase was promised are in place and CI-validated: `'compact'` for a local model with little room to read, and `'openai-strict'` built and asserted but selected by no adapter row, so the conformance harness can switch it on and measure what the lost bounds cost rather than having to invent the projection first.
- **Unrun human checks** (plan Task 2, both recorded in `.planning/WINDOWS.md`): no provider key exists in this environment, so two things are unconfirmed on a real key — that Google accepts the six-keyword `set_plan` projection and draws its graph rather than answering a 400 naming a schema field (the `backstop` truth; `03-RESEARCH.md` A3 stays LOW confidence until one real call settles it), and that a real OpenAI lesson still plans with three to twelve nodes and quizzes with two or three options on the non-strict default. If the Gemini call does fail, the field Google names is the one keyword to drop, and the allow-list is a one-line change.

## Self-Check: PASSED

- Files claimed modified — all six **FOUND** on disk; no file was created or deleted (`git diff --diff-filter=D` empty on both commits)
- Commits `14a7a3d`, `d04d652` — both **FOUND** in `git log`; `git rev-list --count 171f9f546c1636a1935e294c6e131bdf4273109c..HEAD` read **2** at the moment this file was written, which is `actuals.commits`, and `git rev-parse 14a7a3d^` → `171f9f5`, matching `plan_head_before`. **Re-running that count later reads more than 2**, and by design: the close-out commits (this SUMMARY, then STATE/ROADMAP) can only land after the figure is written. `git log --oneline 171f9f5..HEAD --grep '03-07'` → **2** is the form that reproduces; the same convention is recorded in `03-04`, `03-05` and `03-06`.
- `pnpm method:check` → `method: 6 rendered copies match method/`; `pnpm typecheck` clean in both packages; `pnpm build` exit 0; `pnpm test` → **379 tests, 379 pass, 0 fail** (up from 370 at the dispatch base: 6 new `wire-surface` cases and 3 new `api-driver` cases)
- Task 1 gates: the dialect-rules script prints `dialect rules ok` over **all 16** api tools (strict emits none of the four bounds, keeps `additionalProperties: false`, lists every property in `required`; gemini emits only the six allowed keywords; `'full'` is identical to the two-argument call; the full `set_plan` projection still carries `minItems`); `validateToolInput` → 2 in `tools.ts` and 2 in `drivers/api.ts`; `jsonSchema<…>(jsonSchemaOf(` → 1 and `inputSchema: z\.` → 0 in `drivers/api.ts`; no `openapi-3.0` in `tools.ts` with comment text stripped → **0**; no `openai-strict` in `drivers/adapters.ts` with comment text stripped → **0**; the `.describe(` diff check prints `registry descriptions untouched`
- Task 2 gates: `test/wire-surface.test.ts` → **17 pass, 0 fail**; the fixture-coverage script prints `dialect fixture ok` (three dialect keys, 16 rows each in api order, `agent=14 api=16 mcp=22 http=16`); the frozen-rules script prints `dialect rules frozen ok`; the bounds script prints `api bounds kept`; `test/api-driver.test.ts` → **37 pass, 0 fail**; the validation-cases script prints `validation cases present`; `test/mcp.test.ts` + `test/api.test.ts` → **17 pass, 0 fail**
- Fixture move reviewed before committing: `git diff --stat server/test/wire-surface.json` → **1739 insertions, 0 deletions**; a scripted comparison against `HEAD:server/test/wire-surface.json` confirms `agent`, `api`, `mcp` and `http` are byte-identical and the added keys are exactly `dialect:openai-strict`, `dialect:gemini`, `dialect:compact`
- Key links: `drivers/adapters.ts`→`tools.ts` (`ToolDialect|dialect`) present on the type and on all five teaching rows; `drivers/api.ts`→`tools.ts` (`validateToolInput\(`) → 1 call site, inside the mutex, after the replay guard; `wire-surface.test.ts`→`tools.ts` (`jsonSchemaOf\(`) → regenerated across every surface and every dialect
- Stub scan over the plan's own diff: no `TODO`, `FIXME`, `XXX`, `HACK`, "coming soon" or "not available" on any added line. **No `## Known Stubs` section is owed.**
- Threat surface: T-03-45 through T-03-50 are all mitigated as the plan's `<threat_model>` specifies, and this plan opens no surface the register does not name. **No `## Threat Flags` section is owed.**

---
*Phase: 03-owned-loop-api-keys-and-gateways*
*Completed: 2026-10-12*
