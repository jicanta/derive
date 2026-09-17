# Phase 1: Foundation - Context

**Gathered:** 2026-09-17
**Status:** Ready for planning

<domain>
## Phase Boundary

The plumbing every later phase stands on: the tutor's tool contract and its method text each defined once and rendered to every surface; every driver behind one `Driver.runTurn(ctx, sink)` interface reporting through one event sink; every model request's raw usage recorded; a numbered transactional migration runner; and the localhost server hardened before it ever holds a key — with the Claude Code plugin and Codex paths proven unchanged throughout.

Requirements: FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, FOUND-06, COST-01.

**This phase adds no screens and changes nothing the learner sees.** The only visible surface is what the tutor already does. Under the simplicity rule, any plan that adds a control, panel or page is out of bounds here.

Out of scope (belongs to later phases): provider selection UI, secrets storage, API-key drivers, cost display, the usage page, method-quality changes, personalization.

</domain>

<decisions>
## Implementation Decisions

### Method text: one source (FOUND-02)

- **D-01:** The canonical method lives in Markdown files (a `method/` directory, split by section — philosophy, tools, discipline, writing quiz options). It renders to four targets: the app system prompt string, `plugin/skills/teach/SKILL.md`, the Codex skills' `SKILL.md`, and the Phase 7 docs site. Markdown is already what two of the four targets are, it diffs and reviews well, and the docs can include the files directly. — **Reversibility:** costly — moving the canonical form later means re-authoring the render pipeline and every downstream target; the text itself is portable.

- **D-02:** Per-surface variation works as **one surface-neutral method body shared verbatim** plus a **short hand-written preamble per surface** carrying only what genuinely differs: MCP tool prefixes (`mcp__plugin_derive_derive__*` vs in-process names), terminal-vs-browser answering, and the `start_lesson`/`end_lesson` lifecycle. Placeholder tokens in the style of the existing `{{WEB_TOOLS}}` in `server/src/prompt.ts` fill in tool naming. Drift can then only occur in the small preambles, and a diff shows at a glance that the method body is identical everywhere. No conditional blocks inside the shared body.

- **D-03:** Where the three existing copies disagree, take the **union with `prompt.ts` as the spine**. Every rule any copy states is kept — nothing in the method is lost. Use `prompt.ts`'s phrasing as the backbone and fold in the rules only `plugin/skills/teach/SKILL.md` names ("Warm-up first", "The cumulative quiz", "Do not let them be lazy") and the operational lines only `plugin/commands/learn.md` has ("a bare sequence of quizzes with one-line remarks between them is a failed lesson"; "never end your turn in the teach phase without a card pending"). **Explicitly rejected:** compressing or rewriting the method to save tokens — that is a method change, and this is a refactor phase. The longer prompt is accepted as the cost. — **Reversibility:** reversible.

- **D-04:** Rendered copies are **committed to git**, and CI **fails** on drift: a `method:check`-style script regenerates into a temp dir and diffs. This keeps `claude --plugin-dir ./plugin` working from a bare clone with no build step, makes the release tarball correct by construction, and surfaces every method change as a reviewable diff in the PR. Not auto-regenerated-and-pushed: FOUND-02 asks for a failure, and a method change must be seen.

### Tool contract: one source (FOUND-01)

- **D-05:** The single registry covers **all 21 tools** — the 14 tutor tools in `server/src/tools.ts` *and* the 7 MCP-only driver tools (`start_lesson`, `attach_material`, `answer`, `answer_in`, `learner_profile`, `learners`, `end_lesson`). Each entry marks which surfaces it appears on. Phase 3's owned loop and Phase 4's local-model description compaction both need to enumerate the whole surface, and the wire-surface snapshot in Success Criterion 1 is only meaningful if it covers everything the plugin sees. — **Reversibility:** costly — every driver, the MCP server and the HTTP route read from it once this lands.

- **D-06:** `POST /api/external/lessons/:id/:action` validates **strictly**: `schema.safeParse` at the top of the switch, replacing the `as` casts; on failure, 400 with the tool name plus zod's issue path and message. Schema validation runs **before** method logic, so existing method refusals (`Teach first`, `{ refused: true }`) and the assertions in `server/test/api.test.ts` are untouched. Strictness is deliberate: Phase 4 records tool rejection rate per provider, and that number only means something if the route rejects honestly. No coercion of sloppy input.

- **D-07:** The `allowed-tools:` frontmatter in `plugin/commands/learn.md` and `review.md` is **generated from the registry** by the same render step, under the same commit-and-CI-fails-on-drift policy as the skills. The prose body of each command file stays hand-written. This is what makes Success Criterion 2 hold by construction rather than by a second mechanism.

- **D-08:** The **wire-surface snapshot** is one committed JSON fixture containing, per surface (agent / MCP / HTTP), each tool's **name, full description text, and JSON-Schema-projected input schema**. Descriptions are included because they are what the model actually reads — a description change *is* a behaviour change and must show as a reviewable diff. Method prose is covered separately by the `method:check` of D-04. — **Reversibility:** reversible.

### Server hardening (FOUND-06)

- **D-09:** The web app gets the per-install token **injected at serve time**: in production the server injects it into the `index.html` it serves; in development `web/vite.config.ts` reads `~/.derive/token` at startup and sets the header on its `/api` proxy. **No endpoint ever hands the token out** — there is deliberately nothing for a hostile page to call. A missing or unreadable token file must fail with a clear message, not silently.

- **D-10:** The SSRF and path-read fixes **ride along in this phase**, beyond FOUND-06's literal wording. Concretely: resolve the host and refuse loopback, link-local and RFC-1918 ranges before every library and repo fetch, re-checking after each redirect; restrict `fromGitClone` to `https://`; deny-list secret-shaped filenames on repo import (`credentials`, `*.pem`, `*.key`, `id_*`, `.netrc`, `.npmrc`, `auth.json`, `.env*`) and refuse `~` or `/` as a repo root. **Reason:** the tutor model itself can call `add_resource` with any URL, Phase 3 gives it web fetch on every provider, and Phase 2 is when keys land — this is the last quiet moment to close it. — **Reversibility:** reversible.

- **D-11:** Secret redaction is **exact-match with a pattern backstop**. A secrets module registers live secret values (the install token now; provider keys from Phase 2); one `redact()` chokepoint replaces exact matches on **every** egress — errors, logs, events, export, vault mirror. Pattern matching (`sk-ant-`, `sk-`, `AIza`, `Bearer …`) runs as a backstop on **errors and logs only, never on lesson events, exports or the vault mirror**. **Reason:** Derive is a tutor; a lesson that teaches about API credentials must survive intact in the learner's durable Obsidian record. — **Reversibility:** reversible.

- **D-12:** Binding is **loopback by default with a gated opt-in**. `DERIVE_HOST=0.0.0.0` binds wider, but only with the token mandatory, the Origin allowlist extended by an explicit `DERIVE_ORIGINS`, and a loud startup warning naming exactly what is now reachable. The home-server / Pi use case stays alive without weakening the default or making it easy to flip carelessly.

### Usage ledger (COST-01)

- **D-13:** Usage is recorded **per model request**, not per turn — one row per call to the provider, tagged with learner, lesson, turn and the model id at that time. Phase 3's owned loop makes many requests inside one turn and Phase 4 wants tool rejection rate per provider; both need the individual calls. Per-turn and per-lesson totals are a `SUM` away, the reverse is a migration. — **Reversibility:** one-way — changing the grain later requires a schema migration of accumulated usage history that cannot reconstruct per-request detail from turn totals.

- **D-14:** Usage lives in its **own `usage` table**, scoped by learner, lesson and turn — never as an event type. Events are the lesson's visible narrative that the browser reducer replays and the Obsidian mirror renders; usage is accounting. Keeping it out means no new `EVENT_TYPES` entry, no `applyEvent` branch, no cost lines in the learner's notes, and proper indexes for Phase 4's usage page. Live cost in the Phase 3 header, if wanted, goes through an ephemeral `status`/delta rather than a persisted event.

- **D-15:** A **`turns` table** is introduced (id, lesson, driver, model, started/ended, status) and usage rows hang off it. This also fixes a named concern: `busy()` and the boot restart-recovery loop currently read every event of every lesson, and `GET /api/lessons` calls `busy()` per lesson. Phase 3's roadmap already plans a `turn_messages` table for resume — it needs this to point at. — **Reversibility:** one-way — a table other phases build resume state on.

- **D-16:** A usage row is written for **every turn regardless of driver**, with null token fields and `cost_source: 'unknown'` when the driver reports nothing (the Claude Code plugin and Codex terminal paths run the model in the learner's terminal and report no counts). Phase 4's usage page can then honestly say "6 lessons on the Claude Code plugin — tokens not reported" instead of silently omitting them, and turn counts reconcile across every view. **Explicitly rejected:** estimating tokens from transcript length — that is a guess rendered as data, in a product that sells honest stats about what the learner actually knows. `cost_source` values: `provider` | `table` | `subscription` | `unknown`.

### Claude's Discretion

The user chose not to open these; the planner may decide them, following the direction recorded here.

- **Driver seam (FOUND-03):** A `Driver.runTurn(ctx, sink)` interface with `claude`, `codex` and a `fake` implementation (the fake is a permanent test fixture, and is what proves Success Criterion 3). `server/src/agent.ts` and `codex.ts` become driver implementations. External/terminal lessons (`mode: 'external'`) stay **outside** the seam — they are driven by a terminal, not by Derive, and forcing them into `runTurn` would invert the relationship. The sink's event vocabulary is exactly what `server/src/events.ts` already emits; no new event types.
- **Migration runner (FOUND-05):** `PRAGMA user_version` with numbered, transactional migrations. The current inline `CREATE TABLE IF NOT EXISTS` block and the try/catch `ALTER TABLE` list in `server/src/db.ts` (lines ~107-130) fold in as migration 1 / the baseline, so an existing `~/.derive/derive.db` lands on the same schema as a fresh one. A `withTx(fn)` wrapper (node:sqlite has no `transaction()` helper) wraps `replaceGraph`, `deleteLesson` and `deleteLearner`. Whether to back up the DB file before migrating is the planner's call.
- **Proof net (FOUND-04):** The stdio MCP smoke test (`tools/list`, `start_lesson`, `quiz`, `answer`, `end_lesson`, no model) and the wire-surface snapshot are automated and run in CI. The "a lesson through the plugin and a lesson through Codex both complete as before" check is a documented manual run — it needs a real model and a real login.
- **Method text open items:** The Codex skills get full generated `SKILL.md` bodies (FOUND-02 names them, and today they have none — Codex teaches on tool descriptions alone, a real method gap). `plugin/commands/learn.md`'s operational steps fold into the method body per D-03, leaving the command file as a thin invocation.
- **Tool contract open items:** Whether the registry lives in an extended `server/src/tools.ts` or a new module; whether tool descriptions move into the Markdown method source alongside the prose (they are method text too); how the per-surface schema projection will handle zod features the OpenAI-strict and Gemini dialects reject — Phase 3 needs this, Phase 1 only needs the seam for it.
- **Version single-source:** Read the version once from `server/package.json` and export it from `server/src/config.ts`, replacing the six disagreeing literals (`0.1.0`, `0.4.0` ×2, `0.2.0`, `Derive/0.3`). Pin `@anthropic-ai/claude-agent-sdk` to a caret range matching `pnpm-lock.yaml` instead of `latest`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project and milestone
- `.planning/PROJECT.md` — core value, the binding simplicity rule, constraints, and the Key Decisions table (in-app Claude uses an API key; the plugin is the subscription route)
- `.planning/REQUIREMENTS.md` — FOUND-01..06 and COST-01 as written; the traceability table
- `.planning/ROADMAP.md` § "Phase 1: Foundation" — goal, the five success criteria, the fixed internal order, and the research note ("decide deliberately which wording wins where `prompt.ts` and `SKILL.md` disagree")
- `.planning/STATE.md` — accumulated decisions and the open blockers/concerns list

### Codebase map (mapped at commit `7d7db1f`)
- `.planning/codebase/CONCERNS.md` — the source of truth for what this phase repairs. Read in full. Directly in scope: "Two drivers, one method, three copies of the tool contract"; "Version strings scattered and out of sync"; "`replaceGraph` and `deleteLesson` are not transactional"; "No authentication, CORS `*`, and the server listens on all interfaces"; "Arbitrary local directory read via `/api/materials/repo`"; "Server-side request forgery through library fetch and repo import"; "No request validation layer on the HTTP action route"; "Restart-recovery loop reads every event of every lesson at boot"; "`@anthropic-ai/claude-agent-sdk` pinned to `latest`"
- `.planning/codebase/ARCHITECTURE.md` — component responsibilities, the event-stream pattern, the driver/backend abstraction, and the "tool set must match in four places" constraint
- `.planning/codebase/CONVENTIONS.md` — naming, error style (lowercase human sentences), `.js` import extensions, module-design rules. New code must match.
- `.planning/codebase/TESTING.md` — how to add a test; critically, that mechanics tests drive the **external lesson path** (`answer_in: 'terminal'`) so no model is needed, that `pnpm build` must run before `api.test.ts`, and the `teachProse` / 240-char `teachingGap` requirement
- `.planning/codebase/STACK.md`, `.planning/codebase/STRUCTURE.md`, `.planning/codebase/INTEGRATIONS.md` — supporting detail

### Files this phase rewrites or replaces
- `server/src/tools.ts` — 23 lines, names + status labels; the natural home for the registry (D-05)
- `server/src/prompt.ts` — 175 lines; `PROMPT` template with the `{{WEB_TOOLS}}` placeholder, plus `systemPrompt`, `warmupBrief`, `firstTurnPrompt`, `materialAttachedPrompt`, `reviewTurnPrompt`. Spine of the merged method (D-03)
- `plugin/skills/teach/SKILL.md` — 166 lines; the second method copy, source of the three rules `prompt.ts` does not name
- `plugin/commands/learn.md` — 18 lines; the third partial retelling, plus the 21-name `allowed-tools` frontmatter (D-07)
- `plugin/commands/review.md` — 11 lines; same treatment
- `codex/skills/derive-learn/agents/openai.yaml`, `codex/skills/derive-review/agents/openai.yaml` — 8 lines each, no `SKILL.md` body exists yet
- `server/src/agent.ts` — `buildTools`, `TOOL_DESCRIPTIONS`, `nodeSchema`; becomes a driver
- `server/src/codex.ts`, `server/src/backend.ts` — the second driver and backend resolution
- `server/src/mcp.ts` — 493 lines; its own `nodeSchema`, `KINDS`, per-tool `.describe()` strings
- `server/src/index.ts` — the `POST /api/external/lessons/:id/:action` switch (D-06), `cors({ origin: '*' })`, `serve({ port })` with no hostname (D-09, D-12), the boot restart-recovery loop and `busy()` (D-15)
- `server/src/db.ts` — 1012 lines; inline schema + try/catch `ALTER TABLE` list at ~107-130, `replaceGraph`, `deleteLesson`, `deleteLearner`
- `server/src/events.ts`, `server/src/export.ts` — the event sink and the vault mirror (redaction egress points, D-11)
- `server/src/library.ts`, `server/src/repo.ts` — fetch and ingest paths (D-10)
- `web/vite.config.ts` — dev proxy needs the token header (D-09)
- `.github/workflows/ci.yml` — gains the drift check, the snapshot check and the MCP smoke test

No external ADRs or specs exist for this project — the decisions above plus ROADMAP.md and REQUIREMENTS.md are the contract.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `server/src/tools.ts` — `DERIVE_TOOL_NAMES` (14 names, `as const`) and `TOOL_LABELS` already exist and are already shared by both backends. Extend in place rather than creating a parallel module.
- `server/src/prompt.ts` — already has a placeholder mechanism (`{{WEB_TOOLS}}`) and a per-backend entry point `systemPrompt(backend: 'claude' | 'codex')`. The per-surface preamble of D-02 is a generalisation of what is already there.
- `server/test/api.test.ts` — the existing model-free harness. It spawns the built server on a random port with a scratch `DERIVE_DATA_DIR` and drives a whole lesson (plan → teach → lock → cumulative quiz → next lesson warm-up) over `/api/external/lessons/*`. This is the net for "no behaviour change"; every route change must keep it green. Its factory helpers (`quiz`, `act`, `askAndAnswer`, `teachProse`, `nodes`) are the pattern for new tests.
- `server/test/reply.test.ts` — the import-order trick for any test touching a module that opens SQLite at import: set `process.env.DERIVE_DATA_DIR` to a `mkdtempSync` dir *before* a dynamic `await import`.
- `server/src/events.ts` `emit` / `subscribe` — already the single fan-out point; the driver sink of FOUND-03 is this, given an interface.
- `server/src/library.ts` `normalizeUrl` and the existing 20s timeout / 6MB / 25MB caps — the hook point for the D-10 host check.
- `scripts/doctor.mjs` — the existing preflight report; the natural place to report token presence and file mode.

### Established Patterns
- **Errors are lowercase human sentences** thrown as plain `Error`, shown to the model as-is, narrowed with `e instanceof Error ? e.message : String(e)`. Method refusals return `{ ok: false, refused: true, error }` with 400 and say "This is the method, not an error to investigate". D-06's zod messages sit *before* this layer and must not disturb it.
- **`db.ts` opens SQLite and runs its schema at import time.** The migration runner must run in that same import-time position, or every consumer breaks.
- **Server imports use `.js` extensions** (`module: NodeNext`); web imports use none.
- **Named exports only; no `export default` anywhere in `server/src` or `web/src`.** No classes except `RolloutMirror`.
- **Module-level state is deliberate and documented** (`listeners`, `pending`, `notices`, `held`, `active`, `resolved`). The `turns` table of D-15 replaces reads, not these maps.
- **Every server module opens with a `/** ... *\/` block of prose** explaining what it is for and why. New modules (registry, migrations, redaction, driver) need one.
- `web/src/lib/useLesson.ts` `EVENT_TYPES` must list every type the SSE stream can carry. D-14 keeps usage out of the stream precisely so this file is untouched.

### Integration Points
- **`server/src/index.ts` action switch** ← the registry's schemas (D-06). The MCP server proxies every tool through here, so this is where the contract is actually enforced.
- **`server/src/agent.ts` `buildTools` and `server/src/mcp.ts` `registerTool`** ← both iterate the registry instead of declaring schemas (D-05).
- **`plugin/.mcp.json`** runs `${CLAUDE_PLUGIN_ROOT}/../server/dist/mcp.js`; `server/src/mcp.ts` proxies over HTTP using `DERIVE_URL`. It runs as the same user, so it reads `~/.derive/token` from the file directly (D-09).
- **`plugin/hooks/mirror.mjs`** posts to `/mirror` and `/end` — also needs the token, also runs as the same user.
- **`server/src/codex-mirror.ts`** posts to the same endpoints from within the server process.
- **`web/vite.config.ts`** proxies `/api` from :5173 to :4310 in dev — the one place the browser is not same-origin (D-09, D-12).
- **`@hono/node-server` `serveStatic`** resolves its root against `process.cwd()`; the token injection of D-09 changes how `index.html` is served, which is also the moment to fix the cwd fragility flagged in CONCERNS.

</code_context>

<specifics>
## Specific Ideas

- The method text is the product. The union of D-03 is explicitly chosen over a shorter, compressed method even though every provider pays for those tokens on every turn — compressing the method during a refactor phase risks losing a rule, and Phase 4 already plans to compact *tool descriptions* (not method text) for local models.
- Honesty over completeness in the ledger: a usage row that says "not reported" is correct; an estimated token count that looks like data is not. This mirrors the product's existing stance on honest retention stats.
- Redaction must not corrupt teaching. Derive teaches anything, including API security, so pattern-based stripping is confined to errors and logs and never touches the learner's durable record.
- The wire-surface snapshot carrying full description text (not hashes) is deliberate: the reviewer should be able to read what changed in the diff, not go looking for it.

</specifics>

<deferred>
## Deferred Ideas

Nothing was raised outside the phase boundary during discussion. The following were noted in passing as belonging elsewhere:

- **Wildcard `allowed-tools` pattern** (`mcp__plugin_derive_derive__*`) — rejected in favour of generated explicit lists (D-07); revisit only if the generated frontmatter proves unwieldy.
- **Compressing / rewriting the method text** — rejected for this phase (D-03). If prompt length becomes a real constraint for local models, it belongs with Phase 4's compaction work, and only for tool descriptions, never the gate text.
- **`/api/health` authentication and token auto-generation on first boot** — left unopened; the planner should keep `/api/health` usable by `scripts/doctor.mjs` and `server/test/api.test.ts`, and Phase 7 Success Criterion 2 needs it reporting the version.
- **Remaining CONCERNS.md items not named by FOUND-01..06** — the `teachingGap` 600 ms sleep, the Codex per-turn config rebuild, the FTS5 index for `searchLibrary`, the duplicated text helpers between `materials.ts` and `library.ts`, the `propagate` depth-2 credit bug, the missing ESLint config, no graceful shutdown, and orphan `~/.derive/codex/<lesson>` cleanup. None are in this phase's scope; they remain tracked in `.planning/codebase/CONCERNS.md`.

</deferred>

---

*Phase: 1-Foundation*
*Context gathered: 2026-09-17*
