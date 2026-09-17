# Phase 1: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-17
**Phase:** 1-Foundation
**Areas discussed:** Method text: one source, Tool contract reach, Hardening strictness, Usage ledger shape

**Area selection:** four gray areas were offered and all four were selected. Two further areas (driver seam shape, migration runner + proof net) were surfaced but left to Claude's discretion at the close.

---

## Method text: one source

### Q1 — Where should the canonical method text live?

| Option | Description | Selected |
|--------|-------------|----------|
| Markdown files | `method/philosophy.md`, `tools.md`, `discipline.md`; renders to app prompt, plugin SKILL.md, Codex SKILL.md, docs. Markdown is already what two targets are; diffs well; Phase 7 docs can include it directly. | ✓ |
| prompt.ts stays canonical | Keep the TS template literal as source, generate Markdown from it. Smallest change — but skills become build artifacts of a TS string and docs get an awkward source. | |
| Structured data (YAML/JSON) | Sections as data with per-surface rendering rules. Most control, but the method stops reading as prose — and the method is the product. | |

**User's choice:** Markdown files
**Notes:** Recommended option taken.

### Q2 — How should per-surface variation work?

| Option | Description | Selected |
|--------|-------------|----------|
| Neutral body + preamble | One surface-neutral body shared verbatim, plus a short hand-written preamble per surface for MCP prefixes, terminal-vs-browser answering, lifecycle. `{{WEB_TOOLS}}`-style placeholders fill tool names. Drift confined to small preambles. | ✓ |
| Conditional blocks in one file | `{{#if plugin}}…{{/if}}` markers inside the shared body. One place — but the source stops reading as prose and "did the method change?" gets harder to review. | |
| One identical text everywhere | Surface-specific bits move entirely into tool descriptions. Strictest parity — but the plugin loses the terminal-flow instructions `learn.md` relies on. | |

**User's choice:** Neutral body + preamble
**Notes:** Recommended option taken.

### Q3 — Where the three copies disagree, what wins?

Conflicts surfaced before the question: `prompt.ts` has a "Writing quiz options" 5-step procedure and fuller Principle i/ii; `SKILL.md` names three rules `prompt.ts` doesn't ("Warm-up first", "The cumulative quiz", "Do not let them be lazy"); `learn.md` carries operational lines neither has.

| Option | Description | Selected |
|--------|-------------|----------|
| Union, prompt.ts as spine | Keep every rule any copy has; prompt.ts phrasing as backbone. Nothing lost. Longest result, and every provider pays for those tokens every turn. | ✓ |
| Union, then cut hard | Union first, then aggressively delete redundancy for a shorter method. Cheaper per turn, better for Phase 4 local models — but rewrites the method inside a refactor phase. | |
| prompt.ts wins outright | Drop SKILL.md and learn.md extras unless obviously better. Fastest, lowest execution risk — silently deletes rules the plugin path has been teaching under. | |

**User's choice:** Union, prompt.ts as spine
**Notes:** Recommended option taken. Token cost of the longer prompt accepted explicitly; compression rejected for this phase.

### Q4 — Rendered copies committed, or generated at build?

| Option | Description | Selected |
|--------|-------------|----------|
| Commit + CI fails on drift | `pnpm method:check` regenerates into a temp dir and fails CI on any diff. Bare clone works with `--plugin-dir`, release tarball correct by construction, method changes are reviewable diffs. Matches FOUND-02's wording. | ✓ |
| Generate at build only | Gitignored build artifacts; drift structurally impossible — but a fresh clone has no plugin skill until you build. | |
| Commit + CI auto-regenerates | CI pushes the fix instead of failing. Zero friction — but a method change lands without anyone seeing the rendered diff. | |

**User's choice:** Commit + CI fails on drift
**Notes:** Recommended option taken.

**Left open at area close (rolled into Claude's Discretion):** whether the Codex skills get full generated SKILL.md bodies; whether `learn.md`'s operational steps fold into the method body.

---

## Tool contract reach

### Q1 — How wide should the single tool contract be?

| Option | Description | Selected |
|--------|-------------|----------|
| All of it — tutor + driver tools | One registry over the 14 tutor tools and the 7 MCP-only driver tools, each entry marking its surfaces. Phase 3's owned loop and Phase 4's compaction both enumerate the whole surface; the snapshot is only meaningful if it covers what the plugin sees. | ✓ |
| Tutor tools only (14) | Consolidate what both drivers share; leave `start_lesson`/`answer`/`end_lesson` hand-written in `mcp.ts`. Smaller change — but the plugin's lifecycle tools stay a hand-maintained second surface. | |

**User's choice:** All of it — tutor + driver tools
**Notes:** Recommended option taken.

### Q2 — What should the HTTP action route do on a bad body?

| Option | Description | Selected |
|--------|-------------|----------|
| Strict, zod message | `safeParse` at the top of the switch; 400 with tool name + zod issue path and message. Runs before method logic, so existing refusals and api.test.ts assertions are untouched. Makes Phase 4's tool rejection rate meaningful. | ✓ |
| Strict, hand-written sentence | Same rejection, mapped to plain lowercase sentences in the repo's error voice. Warmer for the model — but a second thing to sync with the schema, which is the debt this phase kills. | |
| Lenient — coerce first | Coerce the coercible, reject only the unusable. Fewer retries from sloppy providers — but hides real contract violations and weakens Phase 4's capability probe. | |

**User's choice:** Strict, zod message
**Notes:** Recommended option taken.

### Q3 — How should `allowed-tools` frontmatter stay in sync?

| Option | Description | Selected |
|--------|-------------|----------|
| Generate the frontmatter | Render step writes the `allowed-tools:` line from the registry; prose body stays hand-written. Same commit + CI-fails-on-drift policy. Criterion 2 holds by construction. | ✓ |
| Hand-written + CI assertion | File stays fully hand-authored; a test fails when it doesn't match, naming what's missing. Simpler generator — but drift is fixed by hand each time. | |
| Wildcard pattern | `mcp__plugin_derive_derive__*`, nothing to sync. Cleanest if Claude Code honours it — needs verifying, and gives up the explicit record. | |

**User's choice:** Generate the frontmatter
**Notes:** Recommended option taken. Wildcard noted as a fallback in Deferred Ideas.

### Q4 — What goes in the wire-surface snapshot?

| Option | Description | Selected |
|--------|-------------|----------|
| Name + description + schema | One committed JSON fixture per surface (agent / MCP / HTTP) with each tool's name, full description text and JSON-Schema-projected input schema. A description change IS a behaviour change and shows as a reviewable diff. | ✓ |
| Schemas only | Descriptions excluded so wording tweaks don't churn the fixture. Quieter — but a description rewrite that changes model behaviour passes silently. | |
| Schemas + description hashes | Compact; you see *that* a description changed but can't read the change in the diff. | |

**User's choice:** Name + description + schema
**Notes:** Recommended option taken.

**Left open at area close:** where the registry module lives; whether tool descriptions move into the Markdown method source; per-surface schema projection for OpenAI-strict / Gemini dialects (a Phase 3 need).

---

## Hardening strictness

### Q1 — How does the web app authenticate to the server?

| Option | Description | Selected |
|--------|-------------|----------|
| Injected at serve time | Prod: server injects the token into the `index.html` it serves. Dev: `vite.config.ts` reads `~/.derive/token` and sets the header on its `/api` proxy. No endpoint ever hands the token out. | ✓ |
| Loopback-gated `/api/token` | Web app fetches the token on boot from a loopback + Host + Origin gated endpoint. One code path — but you've added an endpoint whose job is handing out the secret. | |
| Browser by Origin, token for the rest | No token in the web app; browser authorised by loopback + Host + Origin. Zero plumbing, and Origin is what stops the malicious-page attack — but a hostile local process sets a valid Origin and walks in. | |

**User's choice:** Injected at serve time
**Notes:** Recommended option taken.

### Q2 — Do the SSRF and path fixes ride along?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, ride along | Refuse loopback/link-local/RFC-1918 before library and repo fetches (re-check after redirects), restrict `fromGitClone` to https, deny-list secret-shaped filenames on repo import. The injection surface grows in Phase 3; keys land in Phase 2. | ✓ |
| Partial — cheap fixes only | Deny-list and repo-root refusal now; DNS + redirect-recheck guard later. | |
| No — keep the phase tight | Ship exactly what FOUND-06 names; SSRF becomes its own pass. | |

**User's choice:** Yes, ride along
**Notes:** Recommended option taken. Scope expansion beyond FOUND-06's literal wording accepted deliberately.

### Q3 — How should secret redaction work?

| Option | Description | Selected |
|--------|-------------|----------|
| Exact-match + pattern backstop | Secrets module registers live values; one `redact()` chokepoint replaces exact matches on every egress. Patterns run as a backstop on errors and logs only — never on lesson events, exports or the vault mirror. | ✓ |
| Exact-match only, everywhere | Zero false positives; notes never mangled — but a pasted key or a provider-echoed key goes through. | |
| Patterns everywhere | Highest catch rate — and it will eventually corrupt a lesson about credentials, silently, in the learner's durable record. | |

**User's choice:** Exact-match + pattern backstop
**Notes:** Recommended option taken. The framing that mattered: Derive teaches anything, including API security.

### Q4 — Escape hatch for non-loopback binding?

| Option | Description | Selected |
|--------|-------------|----------|
| Opt-in LAN bind | Loopback default; `DERIVE_HOST=0.0.0.0` only with token mandatory, explicit `DERIVE_ORIGINS`, and a loud startup warning naming what's reachable. | ✓ |
| Loopback only, no escape hatch | 127.0.0.1 full stop, exactly as FOUND-06 says; remote users tunnel over SSH. One fewer path to test and document. | |
| Opt-in LAN bind, no extra gates | `DERIVE_HOST` binds wider under the normal rules. Simplest — and the setting most likely to be flipped by someone who won't read what it exposes. | |

**User's choice:** Opt-in LAN bind
**Notes:** Recommended option taken.

**Left open at area close:** whether `/api/health` stays unauthenticated; whether the token auto-generates on first boot.

---

## Usage ledger shape

### Q1 — At what grain should usage be recorded?

| Option | Description | Selected |
|--------|-------------|----------|
| Per model request | One row per provider call, tagged with lesson, turn and model. Phase 3's loop makes many per turn; Phase 4 wants tool rejection rate per provider. Totals are a SUM away; the reverse isn't. | ✓ |
| Per turn | One row per turn. Matches COST-01 literally, far fewer rows — but a retry loop is invisible and splitting later needs a migration. | |
| Per turn, with a raw blob | Per-turn row plus verbatim provider payloads in JSON. Cheap now, nothing lost — but querying means parsing JSON in SQL. | |

**User's choice:** Per model request
**Notes:** Recommended option taken. Rated one-way in CONTEXT.md.

### Q2 — Where does usage live?

| Option | Description | Selected |
|--------|-------------|----------|
| Its own table | `usage` scoped by learner, lesson, turn. Events are the lesson's visible narrative the browser replays and Obsidian renders; usage is accounting. No `EVENT_TYPES` change, no `applyEvent` branch, no cost lines in notes, and proper indexes for Phase 4. | ✓ |
| A `usage` event type | Reuses the append-only log and SSE fan-out; live cost in the header comes free — but it enters the narrative, the reducer and the vault mirror, all of which must learn to ignore it. | |
| Columns on the lesson row | Running totals, trivially cheap to read — but no per-model or per-request breakdown for Phase 4 to group by. | |

**User's choice:** Its own table
**Notes:** Recommended option taken.

### Q3 — What identifies a turn?

| Option | Description | Selected |
|--------|-------------|----------|
| A `turns` table | id, lesson, driver, model, started/ended, status. Also fixes the boot restart-recovery loop and `busy()` reading every event of every lesson. Phase 3's planned `turn_messages` table needs something to point at. | ✓ |
| Generated id in the `turn_start` payload | Smallest change; events stay the record of turns — but the boot scan and `busy()` stay slow and Phase 3 introduces turn identity anyway. | |
| Composite (lesson_id, turn_start seq) | Zero new fields — but accounting is coupled to the event log's numbering and every query needs the composite key. | |

**User's choice:** A `turns` table
**Notes:** Recommended option taken. Rated one-way in CONTEXT.md.

### Q4 — What gets written when the driver reports nothing?

| Option | Description | Selected |
|--------|-------------|----------|
| A row with nulls, source `unknown` | Every turn gets a row regardless of driver. Phase 4's usage page can honestly say "tokens not reported" instead of silently omitting them, and turn counts reconcile everywhere. | ✓ |
| Only rows with real data | Clean table, no nulls — but the usage page under-reports and looks complete when it isn't. | |
| Row always, estimate the missing | Always a number — and it's a guess rendered as data, in a product that sells honest stats. | |

**User's choice:** A row with nulls, source `unknown`
**Notes:** Recommended option taken. Estimation explicitly rejected on product-honesty grounds.

---

## Claude's Discretion

Deferred to Claude at the close, with direction recorded in CONTEXT.md:

- **Driver seam (FOUND-03)** — `Driver.runTurn(ctx, sink)` with claude / codex / fake implementations; external terminal lessons stay outside the seam; no new event types.
- **Migration runner (FOUND-05)** — `PRAGMA user_version`, current inline schema folded in as the baseline, a `withTx(fn)` wrapper for `replaceGraph` / `deleteLesson` / `deleteLearner`; backup-before-migrate is the planner's call.
- **Proof net (FOUND-04)** — MCP smoke test and wire-surface snapshot automated in CI; the real plugin and Codex lesson runs stay a documented manual check (they need a model and a login).
- **Method text open items** — Codex skills get generated SKILL.md bodies; `learn.md`'s operational steps fold into the method body.
- **Tool contract open items** — registry module location; whether tool descriptions live in the Markdown method source; per-surface schema projection for OpenAI-strict / Gemini (a Phase 3 need).
- **Version single-source** — read from `server/package.json`, export from `config.ts`, replacing six disagreeing literals; pin `@anthropic-ai/claude-agent-sdk` to a caret range.
- **`/api/health`** — keep it usable by `scripts/doctor.mjs` and `api.test.ts`; Phase 7 needs it reporting the version.

## Deferred Ideas

- Wildcard `allowed-tools` pattern — rejected in favour of generated explicit lists; revisit only if generation proves unwieldy.
- Compressing / rewriting the method text — rejected for this phase; if prompt length becomes a real constraint it belongs with Phase 4's compaction, and only for tool descriptions, never the gate text.
- Remaining `CONCERNS.md` items not named by FOUND-01..06: the `teachingGap` 600 ms sleep, the Codex per-turn config rebuild, an FTS5 index for `searchLibrary`, the duplicated text helpers between `materials.ts` and `library.ts`, the `propagate` depth-2 credit bug, the missing ESLint config, no graceful shutdown, and orphan `~/.derive/codex/<lesson>` cleanup.

No scope creep was raised during discussion — every area stayed inside the phase boundary.
