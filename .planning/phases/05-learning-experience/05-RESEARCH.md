# Phase 5: Learning Experience - Research

**Researched:** 2026-11-04
**Domain:** In-repo verification of a settled design — Derive's own TypeScript/Hono/React 19 codebase at HEAD (`dd537fc`)
**Confidence:** HIGH (every finding below was read out of the live source this session, or produced by a probe whose output is pasted)

## Summary

The ROADMAP says `**Research**: Not needed` for this phase and it is right about the *domain*: Anki/Math Academy/Duolingo patterns are settled, FSRS data exists, and CONTEXT.md D-01..D-27 plus 05-UI-SPEC.md have already decided what to build. So this file does not re-derive any of that. It answers the only remaining question: **what is actually in the repo at the landing points those documents name, and where do they describe code that is not there.**

The headline: of the four research hints the roadmap gives, **one is accurate, two are forward-looking rather than descriptive, and one has no infrastructure behind it at all.** There is no `prompts` table (migration 11 is the next number, not 12 — CONTEXT.md D-25's "eleven existing migrations" is off by one). There are no Phase 6 style attributes on `<html>` to land `data-focus` "next to" — Phase 5 is the first code in the repo to touch `document.documentElement` at all. `server/test/voice.test.ts` and an `applyEvent` reducer test do not exist, and `web/` has **no test runner, no test script and no `tsx` dependency** — but a probe run this session proves both tests can live in `server/test/` with zero new infrastructure.

Beyond that, the phase's real cost is concentrated in four places the planning documents under-describe: (1) adding one MCP tool trips **four hard-coded counts** across two test files and the method renderer, including one assertion whose message is "the set of tools the plugin sees must not have changed"; (2) D-17's prefetch is blocked by the `lesson is busy` guard and has no mechanism to generate a card without showing it; (3) focus mode cannot be one CSS rule because the lesson layout is a CSS grid with fixed column tracks; (4) the `prompts` table has to hold **answer keys and grading rubrics** — the one class of data in Derive that must never reach the browser.

**Primary recommendation:** Plan this phase as **six independent slices** (Home + due pill; retention + stability tint; keyboard + help + focus; voice; remediation; restart-safe cards + `due` command) and sequence the two that carry shared-surface risk first: the `prompts` table migration (because it rewrites `prompts.ts`, `index.ts`'s held bookkeeping and the companion path at once) and the `due` registry entry (because it moves five pinned counts and the method render, and CI fails on all of them). Everything else is additive and parallelisable.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Next-step block, due pill (D-01..D-04) | Browser / Client | API (read `/api/stats`) | Pure presentation over two figures `stats()` and `dueNodes()` already return |
| `derive due` (D-05) | API / Backend (stdio MCP) | — | `mcp.ts` is a separate process proxying HTTP; the registry is the single declaration |
| Retention figures (D-06..D-08) | API / Backend | Browser (render only) | `retrievability()`, `quiz_results` and `review_at` live server-side; the browser formats nothing it can compute wrongly |
| Atlas stability tint (D-09, D-10) | Browser / Client | API (field already sent) | `/api/atlas` already spreads `NodeRow`, so `stability` is on the wire today |
| Keyboard scheme, `?` overlay (D-11..D-13) | Browser / Client | — | Four `window.keydown` effects and one overlay; no server involvement |
| Focus mode (D-14, D-15) | Browser / Client | — | `data-focus` + a timeline filter; D-15 forbids persistence, so no tier below |
| Streaming status + grading line (D-16) | API / Backend | Browser (existing `status` branch) | `emitEphemeral` is in `events.ts` and reaches all three drivers at once |
| Prefetch (D-17) | API / Backend | — | The review queue is server-side (`buildReviewGraph`); **see Open Question 1 — no mechanism exists** |
| Sentence-chunked voice (D-18) | Browser / Client | — | `speechSynthesis` is a browser API; the chunking is a pure function |
| `prefs.language` → BCP-47 (D-19) | Browser / Client | API (prefs read) | D-19 locks a committed pure-data table; `voice.ts` is the only consumer |
| Remediation gate (D-20..D-23) | API / Backend | — | "Learning mechanics live server-side and are enforced in tool results" is the project's binding pattern |
| Restart-safe cards (D-25, D-26) | Database / Storage | API, Browser | SQLite is the only thing that survives a restart; `index.ts` and the reducer both read it |
| Gates (D-27) | API / Backend | CI | `server/test/` + `scripts/conformance.mjs` + `.github/workflows/` |

## Project Constraints (from CLAUDE.md)

Extracted so the planner can check compliance. Two of these are **stale against the live source** and are corrected below.

| Directive | Status | Note |
|---|---|---|
| TypeScript, Node >= 22.5, pnpm workspace, Hono, React 19, `node:sqlite` | binding | No new runtime |
| All learner data in `~/.derive`; keys never leave the machine | binding | Phase 5 adds no egress |
| Method fidelity: provider work must not change what the tutor does | binding | D-23 deliberately stays out of `method/` |
| Claude Code plugin + Codex skills keep working; existing DBs migrate forward | binding | D-25 touches the companion path; D-05 touches the plugin's visible tool set — see Pitfall 1 |
| No hosted infrastructure | binding | — |
| Named exports only; `export default` appears nowhere in `server/src` or `web/src` | binding | `[VERIFIED: web/src/components/fields.ts:22-51]` — all `export const`/`export function` |
| One component per file, PascalCase, props destructured inline, no separate `Props` type | binding | Five new components (UI-SPEC §Component Inventory) |
| `web/src/lib/api.ts` gains a key; never `fetch` in a component | binding | `[VERIFIED: web/src/lib/api.ts:56-95]` — one `api` object of endpoint keys |
| Server imports carry `.js`; web imports are extensionless | binding | `[VERIFIED: server/tsconfig.json]` `"module": "NodeNext"` vs `[VERIFIED: web/tsconfig.app.json]` `"moduleResolution": "bundler"` |
| Single quotes, semicolons, trailing commas, 2-space indent, long lines accepted and not reflowed | binding | — |
| Throw plain lowercase `Error`; routes answer `{ error }`; narrow with `e instanceof Error` | binding | — |
| Log only failures/startup, prefixed `[tag]` | binding | — |
| `/** … */` prose module headers on every server module | binding | Any new server module needs one |
| Keep the `// eslint-disable-next-line react-hooks/exhaustive-deps` comment when copying the keydown pattern | binding | `[VERIFIED: web/src/components/QuizCard.tsx:83]` |
| **"Tool set must match in four places"** | **STALE** | Phase 1 replaced this with one `TOOL_REGISTRY` projected onto four surfaces and frozen by a snapshot. See §Four-Places Rule, Corrected |
| **"`lucide-react` 0.475"** | **STALE** | `[VERIFIED: web/package.json]` `"lucide-react": "^1.47.0"`. UI-SPEC's note about this is correct; do not "fix" the spec toward CLAUDE.md |

Also binding, from PROJECT.md via CONTEXT.md: the **simplicity rule** (every new control/panel outside Settings needs a one-sentence learning reason — UI-SPEC §Simplicity Rule already writes all six, the planner lifts them) and **a prohibition with no source gate is a claim with nothing behind it** (D-27).

---

## 1. The Roadmap's Research Hints, Verified

### 1.1 "Held cards live in a `prompts` table via the Phase 1 migration runner" — **the table does not exist; it is migration 11, not 12**

No `prompts` table exists anywhere in the schema. A grep for `prompts` across `server/src/**/*.ts` returns only `prompts.ts` itself, `prompt.ts` (the system prompt, unrelated), and four import lines. `[VERIFIED: grep over server/src, this session]`

The migration list runs **1 through 10**, verbatim: `[VERIFIED: server/src/migrations.ts:141-372]`

| version | name |
|---|---|
| 1 | `baseline` |
| 2 | `turns` |
| 3 | `usage` |
| 4 | `usage-backfill` |
| 5 | `settings` |
| 6 | `turn-messages` |
| 7 | `learner-model-per-provider` |
| 8 | `scratch-lesson` |
| 9 | `tool-rejections` |
| 10 | `drop-read-only-num-ctx` |

So **`prompts` is migration 11**. CONTEXT.md D-25 and §Reusable Assets say "eleven existing migrations … migration twelve" — off by one. The planner must write `version: 11`.

The runner is exactly as D-25 assumes: `[VERIFIED: server/src/migrations.ts:572-603]` — `runMigrations(db, migrations = MIGRATIONS)`, one `BEGIN` / `m.up(db)` / `PRAGMA user_version = ${version}` / `COMMIT` per migration, `ROLLBACK` + throw on failure, and a `VACUUM INTO` snapshot named `${file}.bak-v${from}` written once before anything applies `[VERIFIED: server/src/migrations.ts:545-556]`. The module header states the policy for new entries verbatim: *"Adding a migration is one entry appended to `MIGRATIONS`: the next version number, a short name, and an `up` that does the work. Past the baseline the runner guarantees which version a file is on, so a plain `CREATE TABLE` is right there — the `IF NOT EXISTS` idiom would hide the very mistake the version number exists to catch."* `[VERIFIED: server/src/migrations.ts:22-26]` — **so the `prompts` DDL must be a bare `CREATE TABLE`, not `CREATE TABLE IF NOT EXISTS`.**

**One test moves with it.** `[VERIFIED: server/test/migrations.test.ts:632-633]`:

```ts
  it('pins LATEST_VERSION, so a migration that forgets to bump the number is visible', () => {
    assert.equal(LATEST_VERSION, 10);
```

`10` → `11`. Nothing else in that file hard-codes a number (every other assertion reads `LATEST_VERSION`).

### 1.2 "`data-focus` on `<html>` next to the Phase 6 style attributes" — **there are no Phase 6 attributes yet; Phase 5 is the first**

`[VERIFIED: grep for `documentElement|data-theme|data-accent|data-font|data-size|data-focus` over `web/src` and `web/index.html`, this session — zero matches]`

`web/index.html` carries `<html lang="en">` and nothing else. `[VERIFIED: web/index.html:2]`

So the roadmap hint is *forward-looking*: Phase 5 **establishes** the convention Phase 6 extends (CONTEXT.md §Deferred Ideas says exactly this; the roadmap's phrasing reads as if the attributes were already there). Practical consequence: the planner owns the convention — where the attribute is set and removed, and whether a tiny `web/src/lib/htmlAttr.ts` helper is worth it so Phase 6 has one seam rather than four `document.documentElement.setAttribute` calls scattered across pages. Recommend the helper; it is three lines and it is the whole reason D-14 chose an attribute over a class.

### 1.3 "add `voice.test.ts` and an `applyEvent` reducer test" — **neither exists, and `web/` has no test runner**

Files present in `server/test/`: `api-driver api capability cost credentials driver guards local mcp migrations reply schedule search secrets security settings tx usage wire-surface` (`.test.ts`) plus `spawn.ts` and `wire-surface.json`. **No `voice.test.ts`.** `[VERIFIED: ls server/test, this session]`

`web/` has **no test script at all**: `[VERIFIED: web/package.json]`
```json
  "scripts": { "dev": "vite", "build": "tsc -b && vite build", "preview": "vite preview", "typecheck": "tsc -b --noEmit" },
```
and `tsx` is **not** in its dependencies or devDependencies. Root `"test": "pnpm --filter server test"` `[VERIFIED: package.json]`, and CI runs exactly that one step `[VERIFIED: .github/workflows/ci.yml:43-46]`.

**`applyEvent` is not exported.** `[VERIFIED: web/src/lib/useLesson.ts:68,215,226,248,253]` — `function applyEvent`, `function apply`, `function reducer` and `const EVENT_TYPES` are all module-private; the file's only export besides types is `export function useLesson`.

**Probe run this session — both web modules load and run under `node --import tsx --test` from the `server` package, with no browser and no new dependency.** Output pasted:

```
$ pnpm --filter server exec node --import tsx --test _probe.test.ts
TAP version 13
# spokenText: "Hi. there"
# Subtest: voice.ts loads under tsx in node
ok 1 - voice.ts loads under tsx in node
1..1
# pass 1
# fail 0
```
That test asserted `voiceSupport.speak === false`, `parseSpokenChoice('option B', 3)` deep-equals `{ index: 1 }`, and `typeof voiceLang() === 'string'`, importing `'../web/src/lib/voice'` (extensionless, resolved by tsx).

```
$ pnpm --filter server exec node --import tsx --test _probe2.test.ts
TAP version 13
# exports: [ 'useLesson' ]
# Subtest: useLesson loads under node
ok 1 - useLesson loads under node
# pass 1
```

Why it works, so the planner can rely on it rather than hope: `voice.ts` guards every browser touch — `const w = typeof window === 'undefined' ? ({} as Record<string, unknown>) : ...` `[VERIFIED: web/src/lib/voice.ts:23]`, `export const voiceLang = () => (typeof navigator !== 'undefined' && navigator.language) || 'en-US'` `[VERIFIED: web/src/lib/voice.ts:31]`, and the `voiceschanged` listener sits behind `if (voiceSupport.speak)` `[VERIFIED: web/src/lib/voice.ts:98]`. And `react` lives only in `web/node_modules/react` `[VERIFIED: ls, this session]` — Node ESM resolves from the **importer's** directory, so `web/src/lib/useLesson.ts` finds it there regardless of which package ran the test.

Also worth knowing: **`server/test/` is already outside `pnpm typecheck`.** `[VERIFIED: server/tsconfig.json]` `"include": ["src"]`. So a web test placed there is typechecked exactly as much as every existing test — not at all. That is the shipped, accepted situation, not a new gap.

**Recommended placement, cheapest first:**

1. **`server/test/voice.test.ts`** importing `../../web/src/lib/voice` — zero new deps, zero script changes, zero CI changes, proven above. The file's module header should say in one sentence why a web module is tested from the server package (so a future reader does not "fix" it).
2. **Extract the reducer.** `applyEvent` + `apply` + `EVENT_TYPES` move to a new React-free `web/src/lib/lessonReducer.ts` (types-only imports), re-exported into `useLesson.ts`. Then `server/test/reducer.test.ts` needs no `react` resolution at all, and `EVENT_TYPES` becomes assertable against the server's emitted set — which is the drift this phase's own §Established Patterns warns about. Prefer this over `export`ing the internals in place.
3. Only if the planner wants web tests to live in `web/`: add `tsx` as a `web` devDependency, a `"test"` script, change root `test` to `pnpm -r test`, and keep tests inside `web/src/**` (not `web/test/`) so `tsconfig.app.json`'s `"include": ["src"]` still typechecks them. Three extra moving parts for a cosmetic win.

### 1.4 "Graph reuse across lessons stays deferred to v2" — **accurate, nothing to do**

LEARN-13 is in the v2 list `[VERIFIED: .planning/REQUIREMENTS.md:97]` and CONTEXT.md §Deferred Ideas repeats it. No code in this phase should read `source_lesson`/`source_node` for reuse.

---

## 2. Concrete Landing Points

### 2.1 The four-places rule, corrected

**CLAUDE.md's "Tool set must match in four places" no longer describes the code.** Phase 1 replaced the three hand-written copies with one declaration. `server/src/tools.ts` opens: *"Every tool the tutor can call is declared here… The same tools used to be written out three times, over `server/src/agent.ts`, `server/src/mcp.ts` and the action switch in `server/src/index.ts`, and the copies had already drifted."* `[VERIFIED: server/src/tools.ts:1-15]`

Surfaces are a declared union: `export type ToolSurface = 'agent' | 'api' | 'mcp' | 'http';` `[VERIFIED: server/src/tools.ts:38]`, and the derived lists are:

```ts
export const ALL_TOOL_NAMES: readonly string[] = TOOL_REGISTRY.map((s) => s.name);
export const DERIVE_TOOL_NAMES: readonly string[] = toolsFor('agent').map((s) => s.name);
export const TOOL_LABELS: Record<string, string> = Object.fromEntries(TOOL_REGISTRY.filter((s) => s.label).map((s) => [s.name, s.label as string]));
```
`[VERIFIED: server/src/tools.ts:670-676]`

`mcp.ts` registers **only** from the registry, and throws on a missing handler: `[VERIFIED: server/src/mcp.ts:283-287]`
```ts
for (const spec of toolsFor('mcp')) {
  const run = handlers[spec.name];
  if (!run) throw new Error(`no handler for tool: ${spec.name}`);
  server.registerTool(spec.name, { description: descriptionFor(spec, 'mcp'), inputSchema: shapeFor(spec, 'mcp') }, async (a) => text(await run(a)));
}
```

**So D-05's `due` cannot be registered outside the registry.** D-05's claim that "the four-place tool-set rule does not apply" is right in *effect* (`due` with `surfaces: ['mcp']` stays out of `DERIVE_TOOL_NAMES`, `agent.ts` and the HTTP action switch), but adding it still moves **five pinned numbers and one generated file**. See Pitfall 1.

### 2.2 Event types and the `status` channel

`EVENT_TYPES` verbatim, `[VERIFIED: web/src/lib/useLesson.ts:248-251]`:
```ts
const EVENT_TYPES = [
  'ready', 'turn_start', 'turn_end', 'status', 'user', 'block_start', 'delta', 'assistant', 'quiz', 'quiz_result', 'ask', 'ask_result',
  'explain', 'explain_result', 'plan', 'plan_result', 'phase', 'warmup', 'node_status', 'memory', 'preferences', 'material', 'material_removed', 'answer_in', 'resource',
];
```
`status` is already there, with a branch: `case 'status': return { ...s, status: String(ev.payload?.text ?? '') };` `[VERIFIED: web/src/lib/useLesson.ts:96-97]`. `block_start` clears it: `case 'block_start': return { ...s, status: null, ... }` `[VERIFIED: web/src/lib/useLesson.ts:100]`. **D-16 therefore adds no event type and no reducer branch, exactly as it says.**

`emitEphemeral` is a plain export of `events.ts`, which `actions.ts` already imports from: `[VERIFIED: server/src/events.ts:42-46]`
```ts
export function emitEphemeral(lessonId: string, type: string, payload: unknown) {
  const ev: StoredEvent = { seq: -1, type, payload: redactDeep(payload), ts: Date.now() };
  for (const l of listeners.get(lessonId) ?? []) l(ev);
}
```
**This is a much cheaper route to the grading line than CONTEXT.md D-16 implies.** D-16 says the status half is emitted in "both the Claude driver and the owned loop" — it is actually **three** drivers: `server/src/agent.ts:202-204`, `server/src/drivers/api.ts:468,727`, and `server/src/codex.ts:81-105` all call `sink.emitEphemeral('status', …)` with `TOOL_LABELS` `[VERIFIED: grep, this session]`. But grading happens in `actions.ts`, not in any driver, so **one `emitEphemeral(lessonId, 'status', { text: 'Grading your answer' })` inside `openQuiz`'s settle handler covers all three drivers at once.**

**Ordering matters.** `openQuiz` emits the verdict *before* it grades: `[VERIFIED: server/src/actions.ts:221-222]`
```ts
    emit(lessonId, 'quiz_result', { id, selected, correct: a.correct, explanation: a.explanation, result, note: ans.note ?? null, confidence, purpose, tests });
    recordQuiz(lessonId, a.node_id ?? null, isCorrect, { confidence, purpose, tests });
```
And the status line is suppressed while a card is unanswered: `{state.busy && state.status && !waiting && (` `[VERIFIED: web/src/pages/Lesson.tsx:367]`, where `waiting` goes false the moment the result lands (`if (last.kind === 'quiz') return last.result ? null : last.quiz.id;` `[VERIFIED: web/src/pages/Lesson.tsx:82]`). So the status must be emitted **after** the `quiz_result` emit, or it is dropped by the existing gate. Emitting it there needs **no change to `Lesson.tsx:367` at all** — which makes UI-SPEC §Streaming status line's second bullet ("suppression keys on 'a card is open and unanswered', not on 'a card exists'") already true of the shipped code. Worth verifying rather than rebuilding.

### 2.3 FSRS data available for the retention figures

`[VERIFIED: server/src/schedule.ts:21]` — the desired-retention constant, verbatim:
```ts
const scheduler = fsrs(generatorParameters({ request_retention: 0.9, enable_fuzz: false, learning_steps: [], relearning_steps: [] }));
```
`[VERIFIED: server/src/schedule.ts:78-81]`:
```ts
export function retrievability(node: Parameters<typeof cardOf>[0], now = Date.now()): number {
  if (node.stability == null || node.difficulty == null) return 1;
  return scheduler.get_retrievability(cardOf(node, now), new Date(now), false);
}
```
Note the `return 1` fallback: a locked node with no FSRS state contributes a full 1.0 to D-07's "estimated knowledge". In practice `setNodeStatus` writes `stability` on every path that reaches `locked` or `shaky` `[VERIFIED: server/src/db.ts:1043-1052]`, so the fallback is rare — but the planner should state whether a null-stability locked node counts as 1.0 or is excluded.

`nodes` columns, verbatim from migration 1's added-column list `[VERIFIED: server/src/migrations.ts:154-159]`:
```
'ALTER TABLE nodes ADD COLUMN stability REAL',
'ALTER TABLE nodes ADD COLUMN difficulty REAL',
'ALTER TABLE nodes ADD COLUMN lapses INTEGER NOT NULL DEFAULT 0',
'ALTER TABLE nodes ADD COLUMN last_review INTEGER',
'ALTER TABLE nodes ADD COLUMN source_lesson TEXT',
'ALTER TABLE nodes ADD COLUMN source_node TEXT',
```
and `quiz_results` `[VERIFIED: server/src/migrations.ts:161-169]`:
```
'ALTER TABLE quiz_results ADD COLUMN confidence TEXT',
'ALTER TABLE quiz_results ADD COLUMN purpose TEXT',
'ALTER TABLE quiz_results ADD COLUMN tests TEXT',
```

**Review copies are already excluded from both learner-wide reads**, so "estimated knowledge" cannot double-count: `[VERIFIED: server/src/db.ts:153-156]`
```sql
SELECT n.*, l.topic, l.goal FROM nodes n JOIN lessons l ON l.id = n.lesson_id
WHERE l.learner_id = ? AND l.scratch = 0 AND n.source_lesson IS NULL ORDER BY l.created_at, n.rowid
```
`[VERIFIED: server/src/db.ts:273-277]` — `dueNodes` carries the same `n.source_lesson IS NULL` and adds `n.status = 'locked' AND n.review_at IS NOT NULL AND n.review_at <= ?`.

**Three of D-07's four figures have a data source; one does not.**

| Figure | Source today | Gap |
|---|---|---|
| Estimated knowledge | `allNodes(learner).filter(status === 'locked')` + `retrievability()` | none |
| True retention | `quiz_results` has `purpose`, `correct`, `ts`; `q.stats` already joins through `lessons.learner_id` `[VERIFIED: server/src/db.ts:278-284]` | `quiz_results` has **no `learner_id`** and no attempt ordinal — "passed first try" must be *defined*, see Open Question 2 |
| Desired retention | the `0.9` quoted above | none |
| 14-day forecast | `nodes.review_at` | **no query exists.** A grep for `nextReview|next_review|MIN(review_at)|forecast` over `server/src/*.ts` returns one unrelated hit (`actions.ts:312` `extra.next_review_in_days`) `[VERIFIED: grep, this session]` |

`stats()` returns exactly four numbers, and the `/api/stats` route adds three: `[VERIFIED: server/src/db.ts:1285-1287]` `{ lessons: number; locked: number; quizzes: number; correct: number }`; `[VERIFIED: server/src/index.ts:313-316]` `{ ...stats(learner), due: dueNodes(learner).length, vault: !!VAULT_DIR, library: listResources(learner).length, learner: getLearner(learner) }`.

So the retention block needs **one new db query + one new route + one new `api.ts` key**. The same query answers D-05's `Nothing due today. Next review {relative}.` case, which otherwise has no source either. Recommend one `retention(learnerId)` function in `db.ts` returning all four figures plus the next-review timestamp, one `GET /api/retention`, one `api.retention()` key. New `/api/*` routes inherit `guardLocal` + the token check automatically `[VERIFIED: server/src/index.ts:191,254]` — no auth work.

### 2.4 Atlas and the stability tint

`/api/atlas` already puts `stability` on the wire: `[VERIFIED: server/src/index.ts:1191-1204]`
```ts
nodes: allNodes(learner).map((n) => ({ ...n, depends_on: JSON.parse(n.depends_on || '[]') as string[], due: n.status === 'locked' && !!n.review_at && n.review_at <= now })),
```
The spread of `NodeRow` carries `stability`, which is declared `stability: number | null;` `[VERIFIED: server/src/db.ts:83-84]` under the comment *"FSRS memory state; null until the node is first locked."*

But the **web type is a hand-mirrored partial that stops short of it** `[VERIFIED: web/src/lib/types.ts:247-259]`:
```ts
export type NodeRow = {
  lesson_id: string; node_id: string; label: string; kind: NodeKind; summary: string | null;
  depends_on: string; status: NodeStatus; locked_at: number | null; review_at: number | null;
  interval_days: number; reps: number;
};
```
No `stability`, `difficulty`, `lapses`, `last_review`, `source_lesson`, `source_node`. And `AtlasNode = Omit<NodeRow, 'depends_on'> & { depends_on: string[]; topic: string; goal: string | null; due: boolean }` `[VERIFIED: web/src/lib/types.ts:313]`. So D-10 is a **types.ts change** first; the data already arrives.

`Graph.tsx`'s `Data` type and the `due` precedent D-10 mirrors `[VERIFIED: web/src/components/Graph.tsx:19]`:
```ts
type Data = { label: string; kind: GraphNode['kind']; status: GraphNode['status']; summary?: string | null; due?: boolean; index?: number };
```
and `[VERIFIED: web/src/components/Graph.tsx:25]` `export function layoutGraph(nodes: (GraphNode & { due?: boolean })[], offset = { x: 0, y: 0 })`. `Atlas.tsx` already passes `due` through `gnodes` `[VERIFIED: web/src/pages/Atlas.tsx:32-40]`, so `stability: n.stability` is one line beside `due: n.due`. `Lesson.tsx` builds its nodes with `rowsToNodes`, which emits six fields and no `stability` `[VERIFIED: web/src/lib/useLesson.ts:57-66]` — **D-10's "the in-lesson graph never passes it" is already true by construction and needs no guard.**

**The one real implementation constraint:** the locked tone is a static Tailwind class string, `[VERIFIED: web/src/components/Graph.tsx:71-74]`
```ts
  if (status === 'locked') tone = 'bg-gold-500 border border-gold-400 text-[#17130b] glow-gold animate-glow-in';
  if (status === 'shaky') tone = 'bg-ink-850 border border-dashed border-rust-400 text-rust-400';
  if (status === 'locked' && due) tone = 'bg-ink-850 border border-teal-400 text-ink-50 shadow-[0_0_22px_-6px_rgba(127,196,201,0.6)]';
  const badge = status === 'locked' && !due ? 'text-[#17130b]/55' : status === 'teaching' ? 'text-teal-400' : 'text-ink-500';
```
Tailwind v4 arbitrary values are resolved at build time, so UI-SPEC's per-node `color-mix(… {70 + 30*t}% …)` **cannot be a class**. It must be an inline `style` (`backgroundColor`, `borderColor`, `boxShadow`, and the ordinal's `color`), replacing `glow-gold` and omitting `animate-glow-in`. The node already has a `style` prop to extend: `style={{ width: kind === 'goal' ? W + 16 : W, height: H }}` `[VERIFIED: web/src/components/Graph.tsx:76]`. All tokens UI-SPEC's ramp references exist `[VERIFIED: web/src/index.css:22-29]`: `--color-gold-500: #e8b04b`, `--color-gold-400: #f1c46b`, `--color-ink-850: #15130f`, `--color-ink-700: #2a2620`, and `.glow-gold { box-shadow: 0 0 34px -6px color-mix(in oklab, var(--color-gold-500) 55%, transparent); }` `[VERIFIED: web/src/index.css:94]` — the 55% end-state UI-SPEC's `55*t` reproduces at `t=1`.

Aside geometry, for the retention block: `[VERIFIED: web/src/pages/Atlas.tsx:148]`
```
w-[340px] max-h-[calc(100%-3rem)] overflow-y-auto scroll-thin rounded-[18px] border hairline bg-ink-900/92 backdrop-blur p-[22px] flex flex-col gap-5
```
and the sibling block's shell `className="border-t hairline pt-[18px]"` `[VERIFIED: web/src/pages/Atlas.tsx:169]`. **UI-SPEC cites this as `Atlas.tsx:181` and the legend as `Atlas.tsx:198`; the actual lines are 169 and 192-197.** The class strings UI-SPEC quotes are correct; only the line numbers drifted. The legend's shell is `border-t hairline pt-4 flex gap-4 font-mono text-[10px] text-ink-500` with four `<span>` items `[VERIFIED: web/src/pages/Atlas.tsx:192-197]` — D-09's fifth item is an append.

### 2.5 The six page headers

All six carry a byte-identical shell. `[VERIFIED: grep `h-\[60px\]` across the six pages, this session]`
```
className="flex items-center gap-5 px-5 md:px-6 h-[60px] border-b hairline shrink-0"
```
at `Lesson.tsx:146`, `Atlas.tsx:111`, `Library.tsx:78`, `You.tsx:101`, `Settings.tsx:97`, `Usage.tsx:45`. UI-SPEC writes the same classes in a different order — harmless, but the executor should keep the shipped order so the diff reads as an extraction.

**Four differences UI-SPEC's `PageHeader` spec does not account for:**

1. **`LearnerMenu` is in four headers, not six.** Present in `Library.tsx:91`, `You.tsx:109`, `Settings.tsx:105`, `Usage.tsx:55`. **Absent from `Lesson.tsx` and `Atlas.tsx`** `[VERIFIED: grep `LearnerMenu` across the six pages]`. UI-SPEC's Right-slot spec reads "`DuePill`, then page extras, then `LearnerMenu`" as if it were universal. Adding it to Lesson and Atlas is a new control on two surfaces and would need its own simplicity sentence; making it an optional child is the conservative read. **Planner must decide.**
2. **The right-slot gap is `gap-6`, not `gap-5 md:gap-6`.** `[VERIFIED: Library.tsx:85, You.tsx:108, Settings.tsx:104, Usage.tsx:53]` all `className="ml-auto flex items-center gap-6"`.
3. **The lesson header has two right-side groups, not one.** `[VERIFIED: web/src/pages/Lesson.tsx:189-191]` — `<div className="ml-auto hidden md:block">` holds `PhaseBar`, then a separate `<div className="flex items-center gap-5 md:ml-4">` holds the locked count, voice, export and the live dot. **The first group is `hidden md:block`; the second is always visible.** So the due pill must go in the *second* group to honour "visible at every width" — it cannot sit in a single `ml-auto` right slot that does not exist.
4. **The title has `truncate` but no min-width floor.** `[VERIFIED: web/src/pages/Lesson.tsx:150]` `<h1 className="font-serif text-[22px] tracking-[-0.01em] truncate text-ink-50">`. UI-SPEC's `min-w-[8ch] flex-1 basis-0` is the open `03-UI-REVIEW` finding-1 fix and is genuinely new code, not a reuse. Note `You.tsx:105` and `Settings.tsx:101` already add `min-w-0` to their titles; `Lesson.tsx`, `Atlas.tsx`, `Library.tsx` do not — so the extraction also normalises three titles.

**A shipped `pill` class already exists and is what `DuePill` should reuse** `[VERIFIED: web/src/components/fields.ts:25]`:
```ts
export const pill = 'inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.16em] uppercase text-ink-400 border hairline rounded-full px-2.5 h-6';
```
UI-SPEC specifies `gap-1.5` (matching the lesson header's cost pill at `Lesson.tsx:155-158`) where `fields.ts` has `gap-2`. One of the two wins; recommend `pill` + a `gap-1.5` override so Phase 6 has one place to restyle. *(Note: STATE.md's Phase-5 blocker list says "no `fields.ts` exists" — that is stale; the file is on disk, dated Oct 22, with eight exports.)*

### 2.6 The four cards and the keyboard scheme

`QuizCard` is the reference effect, verbatim `[VERIFIED: web/src/components/QuizCard.tsx:60-84]`:
```ts
  // Keyboard: 1-3 / A-C pick, Enter answers, Shift+Enter answers as unsure, ? or 0 is "I don't know".
  const active = !answered && !disabled && !sending;
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      const idx = /^[1-3]$/.test(k) ? Number(k) - 1 : /^[a-c]$/.test(k) ? k.charCodeAt(0) - 97 : -1;
      if (idx >= 0 && idx < quiz.options.length) { e.preventDefault(); toggle(idx); }
      else if (e.key === 'Enter' && picked.length > 0) { e.preventDefault(); void submit(e.shiftKey ? 'unsure' : 'sure'); }
      else if (k === '?' || k === '0') { e.preventDefault(); void submit('idk'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, picked, quiz.options.length, quiz.multi]);
```
D-11's `?` reassignment is line 77. **Quiz already has digits AND letters** — CONTEXT.md D-11 reads as if letters were new for quiz; they are not. The option bound is real: `options: z.array(z.string()).min(2).max(3)` `[VERIFIED: server/src/tools.ts:117]`, which is why the regex is `[1-3]`/`[a-c]`.

State of the other three:

| Card | Today | D-11..D-13 delta |
|---|---|---|
| `AskCard` | window keydown, **digits 1-4 only**, no letters, no `?`, no Enter commit — `const i = /^[1-4]$/.test(e.key) ? Number(e.key) - 1 : -1;` `[VERIFIED: web/src/components/AskCard.tsx:36]`; bound is `options: z.array(z.string()).max(4).optional()` `[VERIFIED: server/src/tools.ts:150]` | add `[a-d]`, `?`, Enter |
| `ExplainCard` | **no window keydown at all** — only the textarea's own handler: `if (e.key === 'Enter' && (e.metaKey \|\| e.ctrlKey)) { e.preventDefault(); void send(); }` `[VERIFIED: web/src/components/ExplainCard.tsx:54-59]` | add plain Enter, Shift+Enter newline |
| `PlanCard` | already `if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey)` on a window listener `[VERIFIED: web/src/components/PlanCard.tsx:38]` | **no-op — verify, do not rebuild** (UI-SPEC is right) |

**Two live bugs the planner must fold into D-13 rather than discover in review:**

- `ExplainCard.send()` does **not** enforce the eight-word floor: `if (!text.trim() \|\| sending \|\| answered) return;` `[VERIFIED: web/src/components/ExplainCard.tsx:25]`, while the button alone is gated (`disabled={words < 8 \|\| sending}` `[VERIFIED: web/src/components/ExplainCard.tsx:63]`). `⌘↵` already bypasses the floor today; adding plain Enter makes a one-word submit trivially reachable. UI-SPEC's "once past its eight-word floor" requires moving the check into `send()`.
- `QuizCard`'s hint chips are a **fixed** `1 2 3`, not option-count-tracking: `<kbd className="kbd">1</kbd><kbd className="kbd">2</kbd><kbd className="kbd">3</kbd> pick · …` `[VERIFIED: web/src/components/QuizCard.tsx:209]`, and the stale `title` is `"Keyboard: 1, 2, 3 to pick · Enter to answer · Shift+Enter if unsure · ? for I don't know"` `[VERIFIED: web/src/components/QuizCard.tsx:208]`. UI-SPEC's §UI Considerations marks the `title` rewrite mandatory and the chip count as tracking the option count — both are changes, not verifications.

**`ExplainCard`'s textarea is `autoFocus`** `[VERIFIED: web/src/components/ExplainCard.tsx:48]`, and every keydown handler in the codebase bails inside a `TEXTAREA`/`INPUT`. So `?` will **not** open the help overlay while a teach-back is being typed — correct behaviour (a `?` belongs in the prose), but it means the explain card's `? help` chip advertises a key that does nothing unless focus has left the textarea. The planner should either accept and document that, or mount the overlay listener to also accept `Shift+/` when the active element is the explain textarea and the field is empty. Recommend accepting it and not advertising `?` on the explain hint row.

**There is no global `Escape` → stop-the-turn today.** `Escape` appears seven times in `web/src`, all local: `Home.tsx:199`, `Library.tsx:354`, `Composer.tsx:101`, `LearnerMenu.tsx:42` (a **window** listener closing the menu) and `:149`, `ProviderRow.tsx:157,198` `[VERIFIED: grep, this session]`. The Composer's stop is a **button**, `onClick={() => void onStop()}` `[VERIFIED: web/src/components/Composer.tsx:183]`, not a key. So UI-SPEC's Esc precedence rule 3 ("the Composer's existing stop action") describes a new global handler, and it will fire alongside `LearnerMenu`'s window listener. The planner must order them (menu closes first, or the lesson handler checks that no menu is open).

### 2.7 Focus mode and the lesson layout

`[VERIFIED: web/src/pages/Lesson.tsx:224-227]`:
```tsx
      <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[232px_minmax(0,1fr)_452px] lg:grid-cols-[minmax(0,1fr)_420px]">
        <aside className="hidden xl:block border-r hairline min-h-0 overflow-y-auto scroll-thin">
          <OutlineRail nodes={state.nodes} goal={state.lesson?.goal ?? null} materials={state.materials} uploading={upload.uploading} />
        </aside>
```
plus the right `<aside className="hidden lg:flex flex-col min-h-0 border-l hairline bg-ink-900/50">` `[VERIFIED: web/src/pages/Lesson.tsx:403]` and the timeline column `<div className="mx-auto max-w-[680px] space-y-6">` `[VERIFIED: web/src/pages/Lesson.tsx:238]`.

**UI-SPEC's "exactly one new rule" (`html[data-focus] [data-focus-hide] { display: none; }`) is not sufficient.** `display: none` on the two asides does **not** collapse the explicit `232px` and `452px` grid tracks — the centre column keeps its old width and sits offset. Making the grid one column needs either a second CSS rule overriding `grid-template-columns` (and it must beat Tailwind's `xl:`/`lg:` variants, so `!important` or a higher-specificity selector) or a conditional className on the grid div. And the timeline collapse to "the open card plus the prose immediately above it" is a **React filter over `timeline`** — items carry no marker CSS could select on. UI-SPEC acknowledges the filter in passing ("The timeline collapse is a filter") without reconciling it with the one-rule claim.

Recommend: React state owns focus (it has to, for the filter), the state writes `data-focus` on `<html>` for the chrome and establishes the Phase 6 convention, and the grid columns swap by className. Two mechanisms, honestly named, instead of one that cannot work alone.

### 2.8 Voice: what D-18 and D-19 actually touch

The skip D-18 removes, verbatim `[VERIFIED: web/src/lib/useVoiceMode.ts:150-153]`:
```ts
        case 'assistant':
          if (it.streaming || !it.text.trim()) continue;
          spoken.current.add(k);
          say(spokenText(it.text));
```
Two mechanics make this harder than one line:

- **`spoken` is a `Set` of item keys**, so "already said" is all-or-nothing per block. Sentence chunking needs a `Map<key, charsSpoken>` (or sentence count) because the same block's `it.text` grows across renders — deltas are merged and flushed on a 60 ms timer `[VERIFIED: web/src/lib/useLesson.ts:289-293]` and `assistant` blocks are rewritten under their original seq `[VERIFIED: web/src/lib/useLesson.ts:110-120]`, so the hook sees the same key with longer text repeatedly. Only text up to the **last complete** sentence boundary may be spoken.
- **`afterSpeech` arms the mic whenever the queue drains** `[VERIFIED: web/src/lib/useVoiceMode.ts:107-113]`, guarded by `isSpeaking()`, which is true while `queue.length > 0` `[VERIFIED: web/src/lib/voice.ts:139]`. With one utterance per sentence, there will be moments mid-paragraph where the queue is empty and the next sentence has not arrived — and `afterSpeech` would open the mic there. D-18's "the mic arms after the block's last sentence, as it does today" therefore needs an explicit `streaming` guard, not just the existing `isSpeaking()` check. **This is the single likeliest regression in the voice slice.**

For D-19, `voiceLang()` is read in three places inside `voice.ts` — `u.lang = voiceLang()` `[VERIFIED: web/src/lib/voice.ts:111]`, `rec.lang = voiceLang()` `[VERIFIED: web/src/lib/voice.ts:160]`, and `pickVoice()`'s `const lang = voiceLang().toLowerCase()` `[VERIFIED: web/src/lib/voice.ts:86]` — and `pickVoice` **memoises the chosen voice** in a module-level `let voice` that is only invalidated on `voiceschanged` `[VERIFIED: web/src/lib/voice.ts:78-99]`. So threading the learner's language in needs a `setVoiceLang(tag)` that also resets that cache, or the first-picked voice sticks across a language change. `voice.ts` has no access to learner state, so the tag must be pushed in.

Where the language comes from: `prefs.language` is read today only in `You.tsx` (the editor, `placeholder="Spanish, English, Portuguese…"` `[VERIFIED: web/src/pages/You.tsx:127]`) and `describePrefs` `[VERIFIED: web/src/lib/prefs.ts:18]`. `Lesson.tsx` does **not** fetch the learner. But `api.stats()` already returns `learner: getLearner(learner)` `[VERIFIED: server/src/index.ts:315]` typed as `Stats = { …; learner?: Learner }` with `Learner = { id; name; created_at; prefs: LearnerPrefs; lessons? }` `[VERIFIED: web/src/lib/types.ts:379,28]`. **So the one `api.stats()` call `Lesson.tsx` needs anyway for D-04's due pill also delivers `prefs.language` for D-19.** One fetch, two decisions — worth saying in the plan so two tasks do not add two fetches.

### 2.9 Remediation: where D-20..D-23 land, and one gap

`dependencyRecord` verbatim `[VERIFIED: server/src/actions.ts:187-193]`:
```ts
function dependencyRecord(lessonId: string, nodeId: string): string {
  const node = getNode(lessonId, nodeId);
  const nodes = new Map(listNodes(lessonId).map((n) => [n.node_id, n]));
  const deps = (JSON.parse(node?.depends_on || '[]') as string[]).map((d) => nodes.get(d)).filter((d): d is NonNullable<typeof d> => !!d);
  if (!deps.length) return 'It is a ground truth: nothing below it, so re-state it and ask a fresh question on it directly.';
  return `it rests on ${deps.map((d) => `"${d.label}" [${d.node_id}] (${d.status}; ${nodeRecord(lessonId, d.node_id)})`).join(', ')}.`;
}
```
It has **exactly two call sites** `[VERIFIED: grep `dependencyRecord` over server/src/actions.ts, this session]`:
- `afterCumulative`, `server/src/actions.ts:178`, whose instruction ends *"Re-check the weakest of those with one fresh quiz (tests: \"intuition\")…"* `[VERIFIED: server/src/actions.ts:183]`
- `nodeStatus`'s shaky branch, `server/src/actions.ts:316-318`: *"`Shaky. Targeted remediation, not a re-explanation: ${dependencyRecord(lessonId, a.id)} ` + 'Re-check the weakest of those with one fresh quiz (tests: \"intuition\")…'"*

**The gap: an ordinary failed quiz names no dependency at all.** `afterQuiz`'s miss branches do not call `dependencyRecord`; they say *"give one hint that points at the node this rests on"* and *"re-derive it from its dependencies"* without naming one `[VERIFIED: server/src/actions.ts:141-146]`. Success Criterion 4 reads "**On a failed quiz** the tutor names and re-quizzes the weakest prerequisite", and LEARN-09 is worded the same way. CONTEXT.md D-20 describes only the `dependencyRecord` sites. **So the planner must decide whether D-20 extends to `afterQuiz`'s `incorrect`/`dont_know` branches too** — three instruction strings rather than two, and a gate that can open on a plain check rather than only on a cumulative miss or a shaky mark. Flag it in the plan rather than letting it surface in verification.

The refusal shape D-20 copies, verbatim `[VERIFIED: server/src/actions.ts:295-301]`:
```ts
  if (!node) return { ok: false, refused: true, error: `No node "${a.id}" in this lesson's graph.` };
  if (a.status === 'locked' && needsUnderstanding(lessonId, a.id)) {
    return {
      ok: false,
      refused: true,
      error:
        `Not locked. "${node.label}" is a derived claim and the checks on it so far (${nodeRecord(lessonId, a.id)}) only show recall or procedure. ` +
        'A node locks on understanding: ask one fresh quiz … Then call node_status again. This is the method, not an error to investigate.',
    };
  }
```
and the HTTP translation `return c.json(withNotices(id, r), r.refused ? 400 : 200);` `[VERIFIED: server/src/index.ts:1480]`.

**`extra.instruction` is a single key with three existing writers in `nodeStatus`** — the shaky branch (`:316`), the goal-locked cumulative branch (`:323`), and nothing for `teaching`. D-23 adds a `teaching` writer; it must **merge** rather than overwrite where a path already sets one (the remediation path sets `instruction` on shaky, and D-23 wants misconception material on that same path).

**D-23 needs a new per-node misconception query.** `listMisconceptions` is learner-scoped only `[VERIFIED: server/src/db.ts:149-152]`:
```sql
SELECT m.*, l.topic FROM misconceptions m JOIN lessons l ON l.id = m.lesson_id
WHERE l.learner_id = ? AND l.scratch = 0 ORDER BY m.resolved ASC, m.ts DESC LIMIT 40
```
Two wrinkles: `misconceptions.node_id` is only unique **within a lesson** (no cross-lesson identity), and `resolveMisconceptions(lessonId, nodeId)` flips `resolved = 1` on every lock `[VERIFIED: server/src/db.ts:1440-1442, called from server/src/actions.ts:305]` — so by the time a node is marked `teaching` again, its prior misconceptions are flagged resolved. The planner must say whether resolved misconceptions are still distractor material (they are the *best* distractor material; a resolved misconception is a known-tempting wrong claim) and whether the query is lesson-scoped (simple, correct) or follows `source_node` (cross-lesson, speculative).

D-21's ranking inputs all exist: `retrievability()` is pure and takes a row-shaped `Pick<NodeRow, …>` `[VERIFIED: server/src/schedule.ts:35,78]`, `depends_on` is the JSON column `dependencyRecord` already parses, and the per-dependency check record comes from `nodeRecord(lessonId, nodeId)` which reads `q.quizzesOn` `[VERIFIED: server/src/db.ts:272]` — `'SELECT * FROM quiz_results WHERE lesson_id = ? AND node_id = ? ORDER BY ts, id'`. Putting the ranking in `schedule.ts` as a pure row-ordering function is the right call (CONTEXT.md discretion): `schedule.ts` has no I/O and imports only a *type* from `db.ts`, which is why `server/test/schedule.test.ts` runs with no database.

**D-24 is confirmed shipped and must not be rebuilt** `[VERIFIED: web/src/components/QuizCard.tsx:35-42,124]`:
```ts
  const pretest = quiz.purpose === 'pretest';
  … quiz.purpose === 'cumulative' ? `Cumulative quiz${nodeLabel ? ` · ${nodeLabel}` : ''}` : quiz.purpose === 'review' ? …
  const testsLabel = quiz.tests === 'intuition' ? 'why, not how' : quiz.tests === 'transfer' ? 'new kind of problem' : quiz.tests === 'procedure' ? 'the steps' : null;
  … {pretest ? `Before the explanation${nodeLabel ? ` · ${nodeLabel}` : ''}` : heading}
```
and `[VERIFIED: web/src/pages/Lesson.tsx:278]` `<span className="eyebrow text-teal-400">warm-up · due from earlier lessons</span>`.

### 2.10 Restart-safe cards: the exact state that has to move

`prompts.ts` is 61 lines and the whole of it is in-memory `[VERIFIED: server/src/prompts.ts:16-19]`:
```ts
type Resolver = (answer: Record<string, unknown>) => void;
export type PromptKind = 'quiz' | 'ask' | 'plan' | 'explain';
type Pending = { lessonId: string; kind: PromptKind; resolve: Resolver; openedAt: number; held: boolean };
const pending = new Map<string, Pending>();
```
Exports: `openPrompt` (`:21`), `answerPrompt` (`:30`), `hasPending` (`:38`), `pendingId` (`:43`), `pendingPrompt` (`:48`), `cancelPending` (`:53`).

`index.ts`'s parallel map `[VERIFIED: server/src/index.ts:1308-1311]`:
```ts
type Held = { id: string; kind: PromptKind; optionCount: number; done: Promise<Record<string, unknown>>; settled: Record<string, unknown> | null; openedAt: number };
const held = new Map<string, Held>();
/** The text of the last few cards shown in a terminal, so the mirror can drop the model's copy of them. */
const recentCards = new Map<string, string[]>();
```
and the 409 D-25 replaces `[VERIFIED: server/src/index.ts:1396-1397]`:
```ts
    if (terminal && (action === 'quiz' || action === 'ask' || action === 'set_plan' || action === 'explain_back') && held.get(id) && !held.get(id)!.settled) {
      return c.json({ error: `A card is already open (${held.get(id)!.kind}). Wait for the learner's reply and pass it to \`answer\` before asking anything else.` }, 409);
```

**The dead-card mechanism, proven line by line.** On boot, open turns are closed `[VERIFIED: server/src/index.ts:93-95]`:
```ts
for (const t of closeOpenTurns('interrupted')) {
  if (getLesson(t.lesson_id)?.mode === 'agent') emit(t.lesson_id, 'turn_end', { ok: true, interrupted: true, reason: 'server restarted' });
}
```
`busy()` then returns false, because `isBusy` is false, `hasPending` is false (the map is empty) and `lastTurn().status` is `'interrupted'` `[VERIFIED: server/src/index.ts:286-292]`. `lessonView` reports `busy: busy(id), pending: hasPending(id)` — note **`pending` is a boolean, not an id** `[VERIFIED: server/src/index.ts:303]`, and `LessonView.pending: boolean` `[VERIFIED: web/src/lib/types.ts:228]`. The browser's `init` dispatch ignores `pending` entirely `[VERIFIED: web/src/lib/useLesson.ts:262]`. And `activePromptId` short-circuits on `busy` `[VERIFIED: web/src/pages/Lesson.tsx:78-79]`:
```ts
  const activePromptId = useMemo(() => {
    if (!state.busy) return null;
```
so every card renders `disabled` and `QuizCard`'s own `const active = !answered && !disabled && !sending;` kills the keyboard too `[VERIFIED: web/src/components/QuizCard.tsx:61]`. **UI-SPEC's "contract that matters" is exactly right, and this is the chain.**

**The fix needs three changes, not one:** `lessonView` must carry the prompt id *and kind* (`pendingPrompt(id)` already returns `{ id, kind, held }`); `LessonState` must gain a field seeded from it in `init`; and `activePromptId` must prefer that id over the `busy`-derived one.

**The hard part: the `prompts` row has to hold secrets.** `openPrompt` emits only the learner-safe half — `emit(lessonId, kind, { id, ...payload })` `[VERIFIED: server/src/prompts.ts:23]` — and `openQuiz` passes it only `{ question, options, multi, node_id, purpose, tests }` `[VERIFIED: server/src/actions.ts:202]`. The answer key lives in the **closure**: `a.correct` and `a.explanation` reach the event log only in `quiz_result`, *after* the learner has committed `[VERIFIED: server/src/actions.ts:221]`. Same for `explain_back`, whose `rubric` is declared `'The 2 or 3 things a correct explanation must contain. Not shown to the learner.'` `[VERIFIED: server/src/tools.ts:194]` and is likewise closure-only `[VERIFIED: server/src/actions.ts:387,395]`.

So the `prompts` table is **primarily an answer-key and grading-context store**, not a card store: the card payload is already recoverable from the `events` table. Two consequences the planner must plan for:
- The restore path must **not** put `correct`, `explanation` or `rubric` into any event or any route response. A new route that returns the open prompt must project.
- `emit()` runs payloads through `redactDeep` `[VERIFIED: server/src/events.ts:18]`; a direct write to `prompts` bypasses that. Decide whether the row is redacted on write.

**And the resolver cannot be revived, so `/api/lessons/:id/answer` needs a second path.** Today `[VERIFIED: server/src/index.ts:937-944]`:
```ts
  const ok = answerPrompt(id, prompt_id, answer);
  if (!ok) return c.json({ error: 'no such pending prompt (the turn may have ended; send a message instead)' }, 409);
```
D-26 means: no in-memory resolver but a persisted row exists → grade directly, then start a fresh turn. That requires **factoring `openQuiz`'s settle block out of its `wait.then(...)` closure** into a standalone `gradeQuiz(lessonId, promptId, payload, answer)` that both the live promise and the restore path call. That refactor is the real shape of D-26, and it is what makes D-27's rehydration gate testable with no model.

**Cascades to extend.** A `prompts` row names a lesson, so it must be deleted with one. `deleteLesson` is a single `withTx` listing eight deletes `[VERIFIED: server/src/db.ts:507-530]` with the ordering comment *"The owned loop's two tables before turns, for the same reason usage is: a tool_results row names the turn it was recorded against."* `[VERIFIED: server/src/db.ts:515-516]`. Add a `deletePromptsByLesson` there, in `deleteLearner`'s transaction (`:458-470`), and a case in `server/test/tx.test.ts`, which counts rows before and after for exactly this class of write `[VERIFIED: server/test/tx.test.ts:1-14]`. `withTx` is `export function withTx<T>(fn: () => T): T` and is re-entrant `[VERIFIED: server/src/db.ts:287-298]`.

**`recentCards` is a separate concern.** It feeds `withoutCards`, which strips the model's prose copy of a card from the mirrored terminal transcript `[VERIFIED: server/src/index.ts:1318-1333]`, and `holdCard` writes it as rendered text `[VERIFIED: server/src/index.ts:1340]`. D-25 does not mention it. If the prompts row also stores `actions.renderCard(...)`'s output, the companion path gets de-duplication across restarts for free; if not, a restart will show the learner a duplicated card in the mirror. **Planner should decide explicitly** — it is a one-column decision with a visible consequence.

### 2.11 The conformance harness

Run as `pnpm conformance` → `node --env-file-if-exists=.env scripts/conformance.mjs` `[VERIFIED: package.json]`, and from `.github/workflows/conformance.yml` on `cron: '37 3 * * *'` plus `workflow_dispatch`, invoked as `node scripts/conformance.mjs --out "${{ runner.temp }}/conformance"` `[VERIFIED: .github/workflows/conformance.yml:17-20,63]`. 622 lines. It spawns the **built** server in a throwaway data dir and imports `server/dist/db.js` for its verdicts `[VERIFIED: scripts/conformance.mjs:279-285]`.

The three verdicts, verbatim `[VERIFIED: scripts/conformance.mjs:468-474]`:
```js
  const quizzes = db.quizzesOn(id, GOAL_NODE);
  const cumulative = db.cumulativeStatus(id);
  const verdicts = {
    pretest: quizzes.some((r) => r.purpose === 'pretest'),
    gate: db.hasUnderstandingPass(id, GOAL_NODE),
    cumulative: cumulative.done.length > 0 && cumulative.missed.length === 0 && cumulative.pending.length === 0,
  };
```
and the report header `'| Provider | Model | Result | Pretest | Gate | Cumulative | Rejected | Detail |'` `[VERIFIED: scripts/conformance.mjs:517]`.

**The blocker for D-27's fourth assertion: the harness never answers anything wrong.** `correctIndex(payload)` returns the scripted correct index, falling back to the first option `[VERIFIED: scripts/conformance.mjs:201-211]`, and `answerFor` returns `{ selected: [correctIndex(payload)], sure: true }` for every quiz `[VERIFIED: scripts/conformance.mjs:214-219]`. The remediation gate only opens on a **miss**. So the harness must plant one.

**And the planted miss must not be on a cumulative question**, because `cumulative` requires `missed.length === 0` — a deliberate cumulative miss would fail the existing verdict. The four scripted questions are: pretest on `GOAL_NODE`, `check`/`intuition` on `GOAL_NODE`, `cumulative`/`transfer` on `STEP_NODE`, `cumulative`/`transfer` on `GOAL_NODE` `[VERIFIED: scripts/conformance.mjs:110-148]`, where `const GOAL_NODE = 'sum-even'` and `const STEP_NODE = 'two-doubles'` `[VERIFIED: scripts/conformance.mjs:87,90]`. The only non-cumulative graded check is step 4. Options for the planner, in order of cost: plant the miss on step 4 (the `check` quiz) and add a step 5′ re-check so the `gate` verdict can still hold; or add a fifth scripted node + quiz whose miss is outside the cumulative set; or add a `shaky` `node_status` step, which also opens the remediation instruction via `nodeStatus`'s shaky branch without any quiz miss at all. **The third is cheapest and is the one to recommend** — `node_status(id,'shaky')` is a scripted step, `extra.instruction` is what D-20 rewrites, and the verdict can read `db.quizzesOn(id, <the node the server named>)` to confirm the model obeyed.

Changes a fourth verdict costs: one key in the `verdicts` object, one `cell()` in the Markdown row, two header cells, and nothing in `exitCodeFor` (it already fails on any false verdict, `[VERIFIED: scripts/conformance.mjs:79-81]`, and is exported for exactly that reason).

### 2.12 The no-model HTTP test pattern, and restart testability

`server/test/api.test.ts` (1119 lines) drives the built server as a child process with the plugin's external path, playing both tutor and learner; its header says *"Needs `pnpm build` first (the first half runs server/dist/index.js)."* `[VERIFIED: server/test/api.test.ts:1-28]`. The helper is `const act = (lesson, action, body) => api(`/api/external/lessons/${lesson}/${action}`, body);` `[VERIFIED: server/test/api.test.ts:56]`.

**Restart is directly supportable**: `startDeriveServer(entry, env, opts)` takes `opts.dataDir` and reuses it rather than minting one `[VERIFIED: server/test/spawn.ts:94-110]`:
```ts
    const owned = opts.dataDir === undefined;
    const dataDir = opts.dataDir ?? mkdtempSync(join(tmpdir(), 'derive-server-'));
```
So D-27's rehydration gate is: start on a scratch dir → open a terminal card → kill → restart on the same dir → `GET /api/lessons/:id` shows the prompt open → `POST .../answer` grades. The install token is read from the same data dir on the second boot, so auth carries over.

**`fakeDriver` cannot help with the remediation gate.** Its `FakeStep` union is `block_start | block_delta | block_end | status | session | usage | end` `[VERIFIED: server/src/drivers/fake.ts:19-33]` — there is no "call a tool" step. The gate's no-model tests belong on the external HTTP path (`act(...)`), which is where the mechanics already are.

---

## 3. Standard Stack

**This phase adds no package.** Everything it needs is already a dependency.

### Core (already installed, versions as resolved)
| Library | Version | Purpose | Why standard here |
|---------|---------|---------|-------------------|
| `ts-fsrs` | `5.4.2` (pinned) | `retrievability()`, `schedule()`, `request_retention: 0.9` | `[VERIFIED: server/package.json]`; D-07's four figures and D-09's ramp read its output |
| `node:sqlite` | built-in (Node ≥ 22.5) | the `prompts` table | `[VERIFIED: package.json]` `"engines": { "node": ">=22.5" }` |
| `zod` | `^4.6.5` | registry shapes for a `due` tool | `[VERIFIED: server/package.json]` |
| `@xyflow/react` | `^12.4.0` | the Atlas nodes the tint colours | `[VERIFIED: web/package.json]` |
| `lucide-react` | `^1.47.0` | `ArrowLeft`, `ArrowRight` — no new icon | `[VERIFIED: web/package.json]`; CLAUDE.md's `0.475` is stale |
| `tailwindcss` / `@tailwindcss/vite` | `^4.0.0` | `data-focus` rule, `@theme` tokens | `[VERIFIED: web/package.json]`; v4 is CSS-first, no `tailwind.config.*` |
| `tsx` | `^4.23.15` (server devDep) | runs the two new tests | `[VERIFIED: server/package.json]`; **not present in `web`** |

### Alternatives Considered
| Instead of | Could use | Tradeoff |
|---|---|---|
| tests in `server/test/` | `tsx` + a `test` script in `web/` | Cleaner home; costs a devDep, a script, a root-script change and a CI change. Probe above shows `server/test/` works today |
| inline `style` for the stability ramp | a fixed set of Tailwind classes per band | Buildable as classes, but D-09 explicitly rejected discrete bands |
| `color-mix()` at runtime | precomputed hex per node in JS | `color-mix` keeps Phase 6's token swap working; hex would hard-code gold |

**Installation:** none.

## Package Legitimacy Audit

**Not applicable — this phase installs no external package.** Nothing was added to `server/package.json` or `web/package.json`, so no registry lookup, no `[SLOP]`/`[SUS]` verdict and no `checkpoint:human-verify` install gate is owed. Every library named above is already in the committed lockfile.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
                     ┌──────────────── the learner ────────────────┐
                     │                                             │
        browser (React 19)                            terminal (Claude Code / Codex)
                     │                                             │
     ┌───────────────┴───────────────┐                 ┌───────────┴────────────┐
     │  Home: next-step block (D-01) │                 │ /derive:learn /review  │
     │  + due pill in nav (D-03)     │                 │ + NEW /derive:due (D-05)│
     │  Atlas: retention block (D-06)│                 └───────────┬────────────┘
     │  + stability tint (D-09)      │                             │ stdio MCP
     │  Lesson: cards, ? overlay,    │                  server/src/mcp.ts
     │  data-focus, voice            │                  registers toolsFor('mcp')
     └───────────────┬───────────────┘                             │
          fetch /api/*  ·  EventSource /api/lessons/:id/stream     │ HTTP /api/external/*
                     │                                             │
     ════════════════╪═════════════════════════════════════════════╪═════════════
                     ▼                                             ▼
              server/src/index.ts  (one Hono app, guardLocal + token on /api/*)
                     │
         ┌───────────┼───────────────────────────┬──────────────────────────┐
         ▼           ▼                           ▼                          ▼
   NEW /api/retention   /api/stats /api/review   /api/lessons/:id/answer   /api/external/:action
   (4 figures +         /api/atlas (stability     ── resolver present? ──┐  (held-card 409 →
    next review)         already on the wire)        │              │    │   reads prompts table)
         │                      │                    │ yes          │ no  │
         ▼                      ▼                    ▼              ▼    │
   db.ts: retrievability   db.ts: allNodes/     prompts.ts       NEW restore path:
   over locked nodes,      dueNodes/stats       answerPrompt()   gradeQuiz() + fresh turn
   quiz_results(purpose),  (source_lesson        (in-memory           │
   review_at forecast       IS NULL)              resolver)           │
         │                                             │              │
         └──────────────────────┬──────────────────────┴──────────────┘
                                ▼
                    actions.ts  — the method, enforced in tool results
                    openQuiz → grade → recordQuiz → addMisconception
                    NEW: emitEphemeral('status','Grading your answer')  (D-16)
                    NEW: rank depends_on by retrievability, name ONE   (D-20/D-21)
                    NEW: refuse a quiz on another node while open      (D-20/D-22)
                    NEW: carry that node's misconceptions on the       (D-23)
                         teaching / remediation tool result
                                │
         ┌──────────────────────┼───────────────────────────────┐
         ▼                      ▼                               ▼
   schedule.ts (pure)     events.ts emit/emitEphemeral     db.ts + NEW prompts table
   retrievability 0.9     → SQLite events + SSE fan-out    (answer keys, rubrics —
   NEW weakest-first      (status is seq:-1, never stored) never leave the server)
   ranking helper                │
                                 ▼
                      three drivers, one sink
                 agent.ts · drivers/api.ts · codex.ts
                 (all three read TOOL_LABELS; the grading
                  line is emitted above them, so one edit
                  covers all three)
```

### Recommended Slice Structure

Six slices, two of which must land before the rest can be reviewed cleanly:

```
A. prompts table + rehydration      ← FIRST: migration 11, rewrites prompts.ts,
   (D-25, D-26, part of D-27)          index.ts held bookkeeping, companion path
B. due MCP tool + /derive:due       ← SECOND: moves 5 pinned counts + method render
   (D-05)
C. Home next-step + shared header   ← touches 6 shipped page headers
   (D-01..D-04)
D. retention + stability tint       ← new db query, route, api key, types.ts
   (D-06..D-10)
E. keyboard + help + focus          ← 4 cards, 1 overlay, 1 CSS rule + grid swap
   (D-11..D-15, part of D-16)
F. voice + remediation              ← independent of each other; F can split
   (D-18, D-19 | D-20..D-23)
```
C, D, E and F touch disjoint files and can run in parallel. A and B each move a shared surface and should not share a wave with anything that also edits `server/src/index.ts` or `server/test/`.

### Pattern 1: steer the model through the tool result, never the prompt
**What:** every method rule is an `instruction` / `refused` / `notice` field on what a tool returns.
**When:** D-20, D-22, D-23 — all three.
**Example (the shape D-20 copies):**
```ts
// Source: server/src/actions.ts:295 (read this session)
if (!node) return { ok: false, refused: true, error: `No node "${a.id}" in this lesson's graph.` };
// …and the understanding gate's full refusal ends with:
// 'Then call node_status again. This is the method, not an error to investigate.'
```
Why it matters here: the refusal reaches the model **and** the learner verbatim, because `index.ts:1480` answers `r.refused ? 400 : 200` with the sentence intact and `web/src/lib/api.ts`'s `j()` throws that exact message.

### Pattern 2: pure logic modules have no I/O, so tests need no database
**What:** `schedule.ts`, `providers.ts`, `prices.ts`, `cost.ts` import no database and run no side effect at import.
**When:** D-21's ranking helper, D-19's name→locale table, D-18's sentence splitter.
**Example:** `schedule.ts` imports `ts-fsrs` and `import type { NodeRow } from './db.js'` — a *type-only* import `[VERIFIED: server/src/schedule.ts:15-16]`, which is why `server/test/schedule.test.ts` opens no file.

### Pattern 3: one declaration, projected to every surface, frozen by a snapshot
**What:** `TOOL_REGISTRY` → `toolsFor(surface)` → `wire-surface.json`.
**When:** D-05's `due`.
**Example (the sanctioned way to move the fixture):**
```ts
// Source: server/test/wire-surface.test.ts:112 (read this session)
if (process.env.DERIVE_WRITE_WIRE_SURFACE === '1') writeFileSync(FIXTURE, `${JSON.stringify(live, null, 2)}\n`, 'utf8');
```
The file's own header: *"A failing diff means the contract the model reads has changed. That is not a broken test, it is the review… Never regenerate it merely to make this test go green."*

### Pattern 4: transient state is ephemeral, and never enters the log
**What:** `seq: -1`, no `EVENT_TYPES` entry needed for an existing type, nothing in the Obsidian mirror.
**When:** D-16's grading line, D-14's focus posture (D-15 forbids persistence).
**Example:** `emitEphemeral` quoted in §2.2 — note it calls no `appendEvent` and no `mirrorToVault`, unlike `emit` `[VERIFIED: server/src/events.ts:17-21]`.

### Anti-Patterns to Avoid
- **Grading or steering in the driver.** All three drivers must stay ignorant of the method. D-16's grading line goes in `actions.ts`, not in `agent.ts`/`drivers/api.ts`/`codex.ts`.
- **A second place that knows whether a card is open.** D-25 explicitly rejects "persist alongside the maps and keep them as a cache". After migration 11 the table is the only answer to `hasPending`.
- **Putting an answer key where the browser can reach it.** `correct`, `explanation` and `rubric` are the only secrets in Derive's data model; the restore path is the first code that reads them outside a closure.
- **A new Tailwind class per stability value.** v4 resolves arbitrary values at build time; a runtime ramp is inline `style`.
- **Regenerating `wire-surface.json` or `pnpm method` to make CI green.** Both gates exist so the change shows in the diff.
- **Adding a `TOOL_LABELS` entry for grading.** It would fail `wire-surface.test.ts:176`; see Pitfall 2.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---|---|---|---|
| Transactional schema change | ad-hoc `ALTER TABLE` in `db.ts` | append entry 11 to `MIGRATIONS` | the runner owns the version bump, the rollback and the `VACUUM INTO` snapshot `[VERIFIED: server/src/migrations.ts:572-603]` |
| Multi-statement write safety | manual `BEGIN`/`COMMIT` | `withTx()` | re-entrant, and `tx.test.ts` already proves the class `[VERIFIED: server/src/db.ts:298]` |
| Retention / retrievability maths | a decay formula | `retrievability()` | FSRS state is already on the row; a second model would disagree with the schedule |
| A due counter | a cached count | `dueNodes(learner).length` | `/api/stats` already returns it; a counter can drift from the schedule |
| Registering an MCP tool | a `server.registerTool` call beside the loop | a `TOOL_REGISTRY` entry with `surfaces: ['mcp']` | the loop throws on any name without a handler and serves nothing outside the registry `[VERIFIED: server/src/mcp.ts:283-287]` |
| A plugin `allowed-tools` line | hand-editing the frontmatter | `pnpm method` | `pnpm method:check` fails CI on drift `[VERIFIED: .github/workflows/ci.yml:31-33]` |
| An ephemeral status channel | a new event type | `emitEphemeral(id, 'status', …)` | the type, the reducer branch and the SSE listener all exist |
| Spawning a server for a restart test | a bespoke child process | `startDeriveServer(entry, env, { dataDir })` | handles port allocation, the `guardLocal` port match, retries and the readiness poll |
| A per-locale voice lookup | `speechSynthesis.getVoices()` matching | the committed name→BCP-47 table (D-19) | D-19 rejected `getVoices()` precisely because it cannot be tested headless — and the probe in §1.3 shows why a pure table can |

**Key insight:** this phase has almost no greenfield. Nearly every line is an extension of a shipped seam, and the expensive mistakes are all *coordination* mistakes — a count in a test file, a generated frontmatter, a grid track that does not collapse — not design mistakes.

## Runtime State Inventory

D-25 replaces live in-memory state with a table, so this section applies.

| Category | Items found | Action required |
|---|---|---|
| **Stored data** | `nodes.stability/difficulty/lapses/last_review` already populated for every locked node `[VERIFIED: server/src/db.ts:1043-1052]`; `quiz_results.purpose/confidence/tests` populated since migration 1. **No `prompts` table.** No `learner_id` on `quiz_results`. No forecast or next-review query. | Migration 11 creates `prompts`. Retention needs a new read-only query — **no data migration**, nothing to backfill: an open prompt that existed before the table is already lost (that is the debt being paid, not data to recover). |
| **In-memory state that must move** (the real content of this row for this phase) | `prompts.ts` `const pending = new Map<string, Pending>()` `[VERIFIED: server/src/prompts.ts:19]`; `index.ts` `const held = new Map<string, Held>()` `[:1309]`; `index.ts` `const recentCards = new Map<string, string[]>()` `[:1311]` | `pending` and `held` become reads of the table (D-25). `recentCards` is **not named by any decision** — planner must say whether it moves, with the duplicate-mirror-card consequence stated either way. |
| **Live service config** | None. Derive runs no external service in this phase. The Claude Code plugin's `.mcp.json` points at `${CLAUDE_PLUGIN_ROOT}/../server/dist/mcp.js` and needs no change for a new tool (the registry is read at spawn). | None — verified by reading `plugin/.mcp.json` is unaffected by registry contents. |
| **OS-registered state** | None. No Task Scheduler, launchd, systemd or pm2 registration anywhere in the repo. `[VERIFIED: grep of scripts/ and .github/ — only `pnpm` scripts and two workflows]` | None. |
| **Secrets / env vars** | No new env var. `voice.ts` reads no env. The install token in `~/.derive` is unchanged and survives a restart on the same data dir (which is what makes the D-27 restart test work). | None. |
| **Build artifacts** | `server/dist/` must be rebuilt before `api.test.ts`, `mcp.test.ts` and `conformance.mjs` run — all three load `server/dist/*.js` `[VERIFIED: server/test/api.test.ts:28,43; server/test/mcp.test.ts:26-27; scripts/conformance.mjs:283-285]`. Adding `due` changes `dist/mcp.js`. | `pnpm build` before the suite, as CI already does `[VERIFIED: .github/workflows/ci.yml:35-46]` — build runs before test. |
| **Generated-and-committed files** | `server/test/wire-surface.json`, `server/src/method.generated.ts`, `plugin/skills/teach/SKILL.md`, `codex/skills/derive-{learn,review}/SKILL.md`, `plugin/commands/{learn,review}.md` `[VERIFIED: scripts/render-method.mjs:76-83]` | A `due` registry entry forces regeneration of `wire-surface.json` **and** the two `allowed-tools` lines. Both must be committed in the same change. |

## Common Pitfalls

### Pitfall 1: adding one MCP tool trips four hard-coded counts and one "must not have changed" assertion
**What goes wrong:** `due` lands in the registry and five things fail at once, two of them with messages that read like a compatibility breach.
**The exact sites, verbatim:**
```ts
// server/test/wire-surface.test.ts:184,186
assert.equal(ALL_TOOL_NAMES.length, 24);
assert.equal(live.mcp.length, 22, 'the MCP server is what the Claude Code plugin sees; the snapshot must cover all of it');
// server/test/mcp.test.ts:123,137
assert.equal(tools.length, 22);
assert.deepEqual([...tools.map((t) => t.name)].sort(), [...MCP_TOOLS_BEFORE].sort(), 'the set of tools the plugin sees must not have changed');
// scripts/render-method.mjs:177  — a HARD FAIL, not a test
if (names.length !== 22) fail(`server/test/wire-surface.json lists ${names.length} mcp tools, not 22; the registry projection is incomplete and the allowed-tools lines would be short`);
```
`MCP_TOOLS_BEFORE` is the 22-name list at `server/test/mcp.test.ts:30-33`, documented as *"The tools the pre-phase binary served… Order is not part of the MCP contract; the set is."*
**Why it happens:** Phase 1 deliberately froze the plugin's visible surface, and Phase 3 added `fetch_page`/`web_search` to the `api` surface only *so that this list would not move*. `due` is the first tool to widen the plugin's wire since.
**How to avoid:** make it one deliberate task, not a side effect. Amend each count (`24→25`, `22→23` in three places), add `due` to `mcp.test.ts`'s expected set with a comment saying why the plugin-unchanged guarantee is being widened, add `due` to `wire-surface.test.ts:200`'s `driverTool` loop, regenerate `wire-surface.json` with `DERIVE_WRITE_WIRE_SURFACE=1`, and run `pnpm method` so the two `allowed-tools` lines are regenerated and committed. **Then** confirm `pnpm method:check` and `pnpm test` are green.
**Warning signs:** `pnpm method:check` failing with "lists 23 mcp tools, not 22" — that is the renderer refusing, before any test runs.

### Pitfall 2: a `TOOL_LABELS` entry for "Grading your answer" fails a test by design
**What goes wrong:** the obvious place to put a new status label is `TOOL_LABELS`, and `[VERIFIED: server/test/wire-surface.test.ts:176]` forbids it:
```ts
assert.deepEqual(added.sort(), ['fetch_page', 'web_search'], 'the only status lines added since the registry are the owned loop’s two web tools');
```
**Why it happens:** `TOOL_LABELS` is `TOOL_REGISTRY.filter((s) => s.label)` — it is a *per-tool* vocabulary, and grading is not a tool.
**How to avoid:** emit the string directly, as `'Thinking'` already is (`sink.emitEphemeral('status', { text: 'Thinking' })` at `server/src/agent.ts:204` and `server/src/drivers/api.ts:727`). One `emitEphemeral(lessonId, 'status', { text: 'Grading your answer' })` in `actions.ts`, **after** the `quiz_result` emit (§2.2). Corollary: if `due` is given a `label`, that same assertion fails — `due` must have **no** label.
**Warning signs:** "the only status lines added since the registry are…" in the test output.

### Pitfall 3: `display: none` does not collapse a grid track
**What goes wrong:** focus mode hides both asides and the lesson still renders in a three-column grid, centre column at its old width, offset left.
**Why it happens:** `grid-cols-[232px_minmax(0,1fr)_452px]` declares the tracks on the parent `[VERIFIED: web/src/pages/Lesson.tsx:224]`; hiding children leaves the tracks.
**How to avoid:** swap the grid classes from React state as well as hiding the chrome (§2.7). UI-SPEC's "exactly one new rule" should be read as a budget for the *hide* rule, not as the whole mechanism.
**Warning signs:** the focused card not centred; a wide empty gutter on the right.

### Pitfall 4: sentence chunking arms the microphone mid-paragraph
**What goes wrong:** `afterSpeech` fires after every chunk, and `isSpeaking()` is false between a sentence finishing and the next arriving over SSE, so the mic opens while the tutor is still talking.
**Why it happens:** `isSpeaking = () => voiceSupport.speak && (speechSynthesis.speaking || queue.length > 0)` `[VERIFIED: web/src/lib/voice.ts:139]` has no notion of "more text is coming".
**How to avoid:** gate `afterSpeech` on the block no longer streaming, in addition to `isSpeaking()`.
**Warning signs:** the mic indicator flickering during a long explanation; dictation capturing the tutor's own voice.

### Pitfall 5: the restored prompt leaks the answer key
**What goes wrong:** the natural implementation — a route that returns the open prompt row so the browser can rehydrate — ships `correct`, `explanation` and `rubric` to the client.
**Why it happens:** today those three never leave a closure (§2.10); the table is the first durable copy.
**How to avoid:** the card payload for the browser comes from the **event log**, which never held them. The table's secret half is read only by the server-side grading path. Any route projecting the row must allow-list fields, not omit them.
**Warning signs:** a quiz's correct index visible in DevTools' network tab before the learner answers.

### Pitfall 6: `hasPending` backed by the table makes a restarted external lesson "busy"
**What goes wrong:** `busy()` returns true for an external lesson when `hasPending(id)` is true `[VERIFIED: server/src/index.ts:290]`. Once `hasPending` reads the table, a companion lesson with a persisted card is `busy` again on boot — and the browser shows `'Teaching in your terminal'` `[VERIFIED: web/src/lib/useLesson.ts:79]` for a terminal that is no longer running.
**Why it happens:** `busy` conflates "a turn is running" with "a card is open", which was safe while both lived in memory and both died on restart.
**How to avoid:** decide explicitly what `busy` means after a restart. For D-26 the card must be **active** without `busy` being true (that is the whole point of the new `LessonState` field), so `busy` should probably keep meaning "a turn is running" and the card's liveness should come from the prompt field alone.
**Warning signs:** a restarted companion lesson showing a live status line with nothing behind it.

### Pitfall 7: UI-SPEC's line citations have drifted; its class strings have not
**What goes wrong:** an executor follows `Atlas.tsx:181` or `Atlas.tsx:198` and edits the wrong block.
**Verified actuals:** the second aside block's `border-t hairline pt-[18px]` is at `Atlas.tsx:169`; the legend row is `Atlas.tsx:192-197`. The cost pill UI-SPEC cites as `Lesson.tsx:158` is the `className` at `Lesson.tsx:157`, inside a `Link` opening at `:155`. `QuizCard.tsx:214`'s `title` is at `:208`; the chips at `:209`. The status line UI-SPEC cites as `Lesson.tsx:390` is at `:367-374`.
**How to avoid:** match on the quoted class string, not the line number. Every class string UI-SPEC quotes was confirmed present this session.

### Pitfall 8: a plugin command file with no declared exclusions hard-fails the renderer
**What goes wrong:** `plugin/commands/due.md` is added to `TARGETS` and `pnpm method` dies.
**Verbatim** `[VERIFIED: scripts/render-method.mjs:183]`:
```js
  const exclusions = COMMAND_EXCLUSIONS[path] ?? fail(`no tool exclusions declared for ${path}`);
```
and the line is the registry **minus** exclusions, so an empty exclusion object would give `/derive:due` permission to call all 23 tools `[VERIFIED: scripts/render-method.mjs:181-188]`.
**How to avoid:** either keep `due.md` out of `TARGETS` and hand-write a one-tool `allowed-tools` line (simplest, and nothing then gates it), or declare a 22-key `COMMAND_EXCLUSIONS` entry (faithful to the mechanism, verbose). State the choice in the plan.
**Note on the Codex sibling:** a `derive-due` skill needs **no** render target as long as its `SKILL.md` carries no `<!-- method:begin -->` region — `method/surfaces/` holds exactly `app.md claude-code.md codex-learn.md codex-review.md` `[VERIFIED: ls method/surfaces, this session]` and the renderer fails on a surface with no preamble `[VERIFIED: scripts/render-method.mjs:139-141]`. Keeping `derive-due` out of the pipeline avoids inventing a fifth preamble for a one-call read.

## Code Examples

### The migration-11 skeleton (shape only; columns are the planner's call)
```ts
// Source: the policy stated in server/src/migrations.ts:22-26 and the shape of entry 9 (:319-352)
{
  version: 11,
  name: 'prompts',
  up(db) {
    // Bare CREATE TABLE, not IF NOT EXISTS: past the baseline the runner
    // guarantees the version, so IF NOT EXISTS would hide the mistake the
    // version number exists to catch (migrations.ts module header).
    db.exec(`
      CREATE TABLE prompts (
        id TEXT PRIMARY KEY,
        lesson_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        /* The learner-safe half is already in the events table; this is the
           grading context, including the answer key and the teach-back rubric,
           and it must never reach a route response. */
        payload TEXT NOT NULL,
        held INTEGER NOT NULL DEFAULT 0,
        opened_at INTEGER NOT NULL
      );
      CREATE INDEX prompts_lesson ON prompts (lesson_id);
    `);
    // No backfill: an open prompt from before this table is already lost, which
    // is the debt being paid rather than data to recover.
  },
},
```

### The refusal D-20 copies, byte-for-byte on shape
```ts
// Source: server/src/actions.ts:295-301 (read this session)
return {
  ok: false,
  refused: true,
  error:
    `Re-check "${dep.label}" [${dep.node_id}] with one fresh quiz, tests "intuition", before any other node. ` +
    'This is the method, not an error to investigate.',
};
```
The trailing sentence is load-bearing: it is what stops a model from debugging the server, and it is the only reason the existing understanding gate holds on weak models.

### The ranking key, as a pure function in `schedule.ts`
```ts
// Source: server/src/schedule.ts:35,78 — cardOf takes a Pick<NodeRow, …>, so the
// ranking can take rows and return an order with no database behind it, exactly
// as the rest of this module does (which is why schedule.test.ts opens no file).
export function weakestFirst<T extends Parameters<typeof retrievability>[0]>(deps: T[], now = Date.now()): T[] {
  return [...deps].sort((a, b) => retrievability(a, now) - retrievability(b, now));
}
```
D-21's two tie-breaks (this lesson's check record, then status `shaky` → `pending` → `locked`) need data `schedule.ts` cannot see, so either they ride in as a precomputed field on the row, or the whole ranking lives in `actions.ts` beside `dependencyRecord`. CONTEXT.md leaves this to the planner; the `Pick<>` signature is what makes the `schedule.ts` option viable.

### The grading status line, emitted where all three drivers inherit it
```ts
// Source: server/src/events.ts:42 (emitEphemeral) + server/src/actions.ts:221-222 (ordering)
emit(lessonId, 'quiz_result', { id, selected, correct: a.correct, explanation: a.explanation, result, note: ans.note ?? null, confidence, purpose, tests });
// AFTER the verdict, so Lesson.tsx:367's existing `!waiting` gate does not drop it.
emitEphemeral(lessonId, 'status', { text: 'Grading your answer' });
recordQuiz(lessonId, a.node_id ?? null, isCorrect, { confidence, purpose, tests });
```

### The restart gate, with the spawn seam that makes it possible
```ts
// Source: server/test/spawn.ts:94-110 (dataDir is reused when supplied)
const dir = mkdtempSync(join(tmpdir(), 'derive-restart-'));
let s = await startDeriveServer(entry, {}, { dataDir: dir });
// … create an external terminal lesson, open a quiz card via /api/external/lessons/:id/quiz …
s.child.kill();
s = await startDeriveServer(entry, {}, { dataDir: dir });   // same file, same install token
const v = await api(`/api/lessons/${id}`);                   // the prompt must come back open
// … POST /api/lessons/:id/answer must grade, not 409 …
```
Seen failing first, with the card planted and the restore path absent — that is D-27's rule.

### The `voice.test.ts` import that was proven to work this session
```ts
// server/test/voice.test.ts — a web module tested from the server package because
// web/ has no test runner and voice.ts guards every browser touch (voice.ts:23,31,98).
import { parseSpokenChoice, spokenText, voiceSupport } from '../../web/src/lib/voice';
// Probe output, this session:  ok 1 - voice.ts loads under tsx in node
// voiceSupport.speak === false, spokenText('# Hi\n\n**there**') === 'Hi. there',
// parseSpokenChoice('option B', 3) deep-equals { index: 1 }
```

## State of the Art

Only one entry matters, and it is internal to this repo rather than ecosystem news:

| Old approach | Current approach | When changed | Impact on this phase |
|---|---|---|---|
| The tutor's tool set written out three times (`agent.ts`, `mcp.ts`, `index.ts`'s switch) | One `TOOL_REGISTRY` in `server/src/tools.ts`, projected onto four surfaces, frozen in `server/test/wire-surface.json` | Phase 1 | CLAUDE.md's "four places" directive is stale; D-05 is one registry entry plus five count edits, not four parallel edits |
| Inline `CREATE TABLE IF NOT EXISTS` at `db.ts` import time | Numbered transactional migrations with `PRAGMA user_version` and a `VACUUM INTO` snapshot | Phase 1 | D-25 is migration 11 with no new machinery |
| Two drivers (`agent.ts` Claude SDK, `codex.ts`) | Three (`drivers/api.ts` owned loop) plus a `fakeDriver` fixture | Phase 3 | D-16's status work must not be written per-driver; `actions.ts` is the one place that reaches all three |

**Deprecated / outdated in the planning documents themselves** (so the planner trusts the source over the prose):
- CONTEXT.md: "eleven existing migrations", "migration twelve" → ten, and eleven.
- CONTEXT.md D-16: "both the Claude driver and the owned loop" → three drivers; and the grading line need touch none of them.
- CONTEXT.md §Canonical References: "`05-UI-SPEC.md` — **does not exist yet**" → it exists and is approved.
- CLAUDE.md Key Dependencies: `lucide-react 0.475`, `pnpm 10.33.2`, `node-sqlite`-era architecture notes → `^1.47.0`, `pnpm@12.5.1` `[VERIFIED: package.json]`.
- STATE.md Phase-5 blockers: "no `fields.ts` exists" → `web/src/components/fields.ts` is on disk with eight exports.
- UI-SPEC: "identical to the five shipped headers it replaces" → six.

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | A locked node always has non-null `stability`, so `retrievability()`'s `return 1` fallback is not load-bearing for D-07's estimated-knowledge sum | §2.3 | Estimated knowledge over-reports on any locked node whose FSRS state is null. `setNodeStatus` writes it on every `locked`/`shaky` path `[VERIFIED: db.ts:1043-1052]`, but an older row written before migration 1's columns existed is untested. The planner should decide the null behaviour rather than inherit it |
| A2 | Hiding the two lesson asides with `display: none` leaves the `232px`/`452px` grid tracks in place | §2.7, Pitfall 3 | This follows from the CSS Grid spec (tracks are declared on the parent) but was **not** rendered and measured this session. If wrong, focus mode is simpler than described — cheap to check in a browser before planning the slice |
| A3 | `node_status(id, 'shaky')` is the cheapest way to open the remediation gate inside the conformance script without breaking the `cumulative` verdict | §2.11 | If the planner's D-20 design keys the gate on a graded quiz miss rather than on `nodeStatus`'s shaky branch, a `shaky` step would not exercise it and the harness needs a planted wrong answer after all — which then collides with `cumulative.missed.length === 0` |
| A4 | A `derive-due` Codex skill can carry no rendered method region, so it needs no `method/surfaces/codex-due.md` | Pitfall 8 | If the planner decides `/derive:due` should carry method text, a fifth preamble and a fifth `SURFACES` entry are owed, and `check-method.mjs` gates both |
| A5 | `/derive:due` should be a slash command driving one MCP tool call, as D-05 says, rather than a direct read | §2.1 | A command means a whole model turn (and its cost) to print a due count. D-05 locked the shape; this notes that the cost is real and visible in the lesson's own cost figure if it ever runs inside a lesson |
| A6 | `recentCards` can stay in memory without a visible regression | Runtime State Inventory | A restart would then re-show the model's prose copy of the open card in a mirrored terminal transcript. Low severity, but it is a learner-visible duplicate and nobody has decided it |

Everything else in this document is `[VERIFIED: …]` against a file read or a probe whose output is pasted.

## Open Questions

1. **D-17's prefetch has no mechanism, and the one-turn-per-lesson guard blocks the obvious one.** `runTurn` opens with `if (active.has(lessonId)) throw new Error('lesson is busy');` `[VERIFIED: server/src/agent.ts:278]`, and CLAUDE.md names "One turn per lesson" as an architectural constraint. Every tool that could produce a question *shows* it: `openQuiz` calls `openPrompt`, which calls `emit(lessonId, kind, { id, ...payload })` immediately `[VERIFIED: server/src/prompts.ts:23]`. There is no "prepare a card without showing it" path.
   - *What we know:* the review/warm-up queue **is** fully known server-side — `buildReviewGraph` returns `{ due }` and `reviewTurnPrompt(nodes)` already lists the nodes "in the order to take them" `[VERIFIED: server/src/prompt.ts:117-128]`. So D-17's premise (the next card is knowable without guessing) holds.
   - *What's unclear:* what "prefetched" is allowed to mean. Three readings, none free: (a) a second concurrent turn — blocked by the guard; (b) a new tool or a `defer` flag on `quiz` that returns a prepared card the server holds until the verdict is read — a method-surface change, and the `prompts` table of D-25 is exactly where a held-but-unshown card would live; (c) pipelining instead of prefetching — strengthen `reviewTurnPrompt` so the tutor asks the next question in the same turn with no prose in between, which is a prompt change with no new mechanism and no new tool.
   - *Recommendation:* **(c), and record it as a further narrowing of LEARN-11 in the plan.** D-17 already narrows the requirement and says deviations are recorded rather than dropped; this is the same discipline one level down. (b) is the only reading that is genuinely a prefetch, and it spends a method-surface change and a conformance-harness assertion on a latency win that (c) mostly delivers. **The planner must not leave this to the executor** — "prefetch the next card" is not implementable against this codebase as a task line.

2. **"Passed first try" is undefined against the schema.** D-07 wants "the share of review-purpose quizzes passed first try over the last 90 days". `quiz_results` has `(lesson_id, node_id, correct, confidence, purpose, tests, ts)` and an autoincrement `id` `[VERIFIED: server/src/migrations.ts:84-90,161-169]` — one row per graded attempt, **no attempt ordinal and no `learner_id`**.
   - *What we know:* the learner scope is a join, and `q.stats` already shows the exact idiom: `FROM quiz_results q JOIN lessons l ON l.id = q.lesson_id WHERE l.learner_id = $l AND l.scratch = 0` `[VERIFIED: server/src/db.ts:278-284]`. `q.quizzesOn` returns a node's attempts in order (`ORDER BY ts, id`) `[VERIFIED: server/src/db.ts:272]`.
   - *What's unclear:* "first try" per what? Per `(lesson_id, node_id)` the first `purpose='review'` row is unambiguous and cheap — but a review lesson creates **copies**, so the same underlying node reviewed in three sessions yields three distinct `lesson_id`s and three legitimate "first tries". That is probably the intent ("did this review pass on the first question?"), and it is worth stating rather than inferring.
   - *Recommendation:* define it as **the first `purpose='review'` row per `(lesson_id, node_id)` within the window**, state the definition in the `title` tooltip UI-SPEC already specifies, and count the denominator as the number of such first rows — which is also the number D-08's ≥10 threshold is measured against.

3. **Does D-20 extend to an ordinary failed quiz?** §2.9 shows `afterQuiz`'s miss branches name no dependency, while Success Criterion 4 and LEARN-09 both say "on a failed quiz". CONTEXT.md D-20 describes only the two `dependencyRecord` sites.
   - *Recommendation:* extend it. The verification question "does the tutor name the weakest prerequisite when I get a question wrong?" will be asked of a plain check, not of a cumulative miss. Three instruction strings instead of two.

4. **Is `LearnerMenu` added to the Lesson and Atlas headers?** §2.5. It is absent from both today, and UI-SPEC's `PageHeader` spec reads as if it were universal. Adding it is a new control on two surfaces and owes a simplicity sentence; leaving it optional keeps the extraction behaviour-neutral.
   - *Recommendation:* optional child. The extraction should change no behaviour beyond the pill and the title's min-width floor.

5. **What does `busy` mean after a restart?** Pitfall 6. The answer changes the moment `hasPending` reads a table. The planner should state it once, in the D-25/D-26 plan, rather than let `index.ts:290` decide by accident.

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---|---|---|
| Node | everything | ✓ | `v22.22.2` (probe output, this session) | — |
| `pnpm` | build, test | ✓ | pinned `pnpm@12.5.1` `[VERIFIED: package.json]` | — |
| `tsx` (server) | the two new tests | ✓ | `server/node_modules/.bin/tsx` present | — |
| `tsx` (web, importable by name) | web-local tests | ✗ | only a hoisted bin shim: `Cannot find package 'tsx' imported from /home/jicanta/derive/web/` (probe output) | place tests in `server/test/` (proven) or add `tsx` to `web` devDeps |
| `react` resolvable from a server-run test | an in-place reducer test | ✓ | `web/node_modules/react` — Node resolves from the importer, proven by probe | extract the reducer into a React-free module (recommended regardless) |
| `server/dist/` | `api.test.ts`, `mcp.test.ts`, `conformance.mjs` | build-dependent | — | `pnpm build` first, as CI does |
| A provider key or local model | the nightly conformance assertion | ✗ in this environment | — | D-27's no-model HTTP gates carry it in ordinary CI; the harness reports every provider `skipped` with its reason and exits 0 `[VERIFIED: scripts/conformance.mjs:14-22]` |
| A browser with `speechSynthesis` / `SpeechRecognition` | D-18/D-19 end-to-end | ✗ headless | — | the pure halves (`spokenText`, the sentence splitter, the locale table) are node-testable; the arming behaviour is a human check |
| Headless Chrome for `hover:` states | UI verification | ✗ by design | — | Tailwind v4 gates `hover:` behind `@media (hover: hover)`, which no headless mode satisfies; UI-SPEC §Interaction States already records this. Verify hover by reading class strings |

**Missing dependencies with no fallback:** none — nothing in this phase is blocked on an unavailable tool.

**Missing dependencies with fallback:** web-local `tsx` (place the tests in `server/test/`); a real provider for the harness assertion (the no-model gates cover ordinary CI); a speech-capable browser (pure functions are tested, the arming is a human check).

## Security Domain

`security_enforcement: true`, `security_asvs_level: 1` `[VERIFIED: .planning/config.json]`. This phase introduces **one new data-sensitivity class** and no new network surface.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard control in this codebase |
|---|---|---|
| V2 Authentication | no | No credential work. Auth is the install token + `guardLocal`, both unchanged |
| V3 Session Management | no | No session change. The `derive_session` cookie path is untouched |
| V4 Access Control | **yes** | Every new `/api/*` route inherits `guardLocal` + the token check from `app.use('/api/*', …)` `[VERIFIED: server/src/index.ts:191,254]`, and must scope its read through `learnerOf(c)` `[VERIFIED: server/src/index.ts:274-278]` — never through a body field. The retention route and the `due` read are both learner-scoped |
| V5 Input Validation | **yes** | `zod` through the registry. A `due` tool's shape goes in `TOOL_REGISTRY` and is checked by `validateToolInput(spec, surface, input)` against the **full** schema, not the provider's dialect `[VERIFIED: server/src/tools.ts:655-666]`. The 409/400 shapes for the remediation refusal reuse `{ error }` |
| V6 Cryptography | no | Nothing cryptographic is added |
| V8 Data Protection | **yes** | **The one real item.** The `prompts` table is the first durable store of quiz answer keys (`correct`, `explanation`) and teach-back rubrics (`rubric`, declared *"Not shown to the learner."* `[VERIFIED: server/src/tools.ts:194]`). Today these exist only inside a promise closure |
| V7 Error Handling / Logging | yes (inherited) | `emit` runs every payload through `redactDeep` `[VERIFIED: server/src/events.ts:18]`; a direct `prompts` write bypasses it. Routes answer `safeMessage(e)` |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard mitigation |
|---|---|---|
| **Answer-key disclosure via the rehydration route** — a route returning the open prompt row ships `correct`/`explanation`/`rubric` to the browser before the learner commits | Information Disclosure | Allow-list the projection. Source the card payload from the `events` table (which never held the key) and read the table's secret half only on the server-side grading path. **Add a gate** that asserts the rehydration response body contains neither `correct` nor `explanation` nor `rubric` — this is the cheapest and most valuable new assertion in the phase |
| **Answer-key disclosure via the event log or the Obsidian mirror** — a `prompt_restored` event carrying the full row | Information Disclosure | Reuse an existing event type (the card events already exist and are safe) rather than inventing one that carries the row. If a new payload is emitted, it goes through `emit`, hence `redactDeep` |
| **Cross-learner read on the new retention route** | Information Disclosure | `learnerOf(c)` only; the SQL joins `lessons.learner_id` and filters `l.scratch = 0`, exactly as `q.stats` and `q.allNodes` do |
| **The `due` MCP tool reading another learner's schedule** | Information Disclosure | `mcp.ts` passes `?learner=` through to `learnerOf`, which resolves via `findLearner` and falls back to `DEFAULT_LEARNER_ID` on an unknown value `[VERIFIED: server/src/index.ts:274-278]` — an unknown name cannot select an arbitrary learner |
| **Migration failure leaving the learner's only record half-upgraded** | Denial of Service / data loss | The runner's own guarantee: one transaction carrying the `PRAGMA user_version` bump, `ROLLBACK` + throw on failure, and a `VACUUM INTO` snapshot named for the version left behind `[VERIFIED: server/src/migrations.ts:545-603]`. Migration 11 inherits all of it by being an entry in the list |
| **Orphaned prompt rows after a lesson or learner delete** | — (integrity) | Add `deletePromptsByLesson` to `deleteLesson`'s and `deleteLearner`'s `withTx` blocks and a counting case in `server/test/tx.test.ts` |
| **A refusal sentence echoing model-authored text into a learner-visible error** | Information Disclosure (low) | The refusal names a node label and id, both already learner-visible in the graph. No new exposure |

**Not a threat in this phase:** no new egress, no new env var, no new credential, no new file write outside `~/.derive`, no new third-party package.

## Sources

### Primary (HIGH confidence — read with `Read`/`cat`/`sed` this session, cited with line ranges)
- `server/src/migrations.ts` — baseline schema, entries 1-10, `LATEST_VERSION`, `snapshot`, `runMigrations`
- `server/src/prompts.ts` (all 61 lines), `server/src/events.ts` (all 57 lines), `server/src/schedule.ts` (all 131 lines)
- `server/src/index.ts` — boot sweeps, middleware, `learnerOf`, `busy`, `lessonView`, `/api/stats`, `/api/review`, `startReview`, `/api/atlas`, `/api/lessons/:id/{message,answer}`, `held`/`recentCards`/`holdCard`, the one-held-card 409, the external action route
- `server/src/actions.ts` — `afterQuiz`, `afterCumulative`, `dependencyRecord`, `needsUnderstanding`, `nodeStatus`, `openQuiz`/`openAsk`/`openPlan`/`openExplain`
- `server/src/db.ts` — `NodeRow`, `LearnerPrefs`, the `q` prepared statements (`allNodes`, `dueNodes`, `stats`, `quizzesOn`, `listMisconceptions`, `resolveMisconceptions`, the delete set), `withTx`, `setNodeStatus`, `propagate`, `deleteLesson`
- `server/src/tools.ts` — module header, `ToolSurface`, quiz/ask/explain_back shapes, `validateToolInput`, `ALL_TOOL_NAMES`, `DERIVE_TOOL_NAMES`, `TOOL_LABELS`
- `server/src/mcp.ts` — the `handlers` map and the registration loop
- `server/src/drivers/api.ts`, `server/src/agent.ts`, `server/src/codex.ts` — the three `emitEphemeral('status', …)` sites and `runTurn`'s busy guard
- `server/src/drivers/fake.ts`, `server/src/driver.ts`
- `server/test/wire-surface.test.ts`, `server/test/mcp.test.ts`, `server/test/migrations.test.ts`, `server/test/api.test.ts`, `server/test/spawn.ts`, `server/test/tx.test.ts`
- `scripts/conformance.mjs`, `scripts/render-method.mjs`, `scripts/check-method.mjs`
- `web/src/lib/useLesson.ts`, `web/src/lib/voice.ts`, `web/src/lib/useVoiceMode.ts`, `web/src/lib/types.ts`, `web/src/lib/api.ts`, `web/src/lib/prefs.ts`
- `web/src/pages/{Home,Lesson,Atlas,Library,You,Settings,Usage}.tsx`
- `web/src/components/{Graph,QuizCard,AskCard,ExplainCard,PlanCard,Composer,LearnerMenu,fields}.tsx|.ts`
- `web/src/index.css`, `web/index.html`, `web/tsconfig.json`, `web/tsconfig.app.json`, `server/tsconfig.json`
- `package.json`, `server/package.json`, `web/package.json`
- `.github/workflows/ci.yml`, `.github/workflows/conformance.yml`
- `method/30-quiz-options.md`, `method/surfaces/` listing
- `plugin/commands/{learn,review}.md`, `codex/skills/derive-review/{SKILL.md,agents/openai.yaml}`
- `.planning/{REQUIREMENTS.md,STATE.md,config.json}`, `.planning/phases/05-learning-experience/{05-CONTEXT.md,05-UI-SPEC.md}`

### Probes executed this session (HIGH confidence — output pasted in §1.3 and §Environment Availability)
- `pnpm --filter server exec node --import tsx --test` against a test importing `../web/src/lib/voice` → `pass 1`, with `voiceSupport.speak === false` and `spokenText('# Hi\n\n**there**') === 'Hi. there'`
- the same against `../web/src/lib/useLesson` → `pass 1`, `exports: [ 'useLesson' ]`
- `pnpm --filter web exec node --import tsx --test` → `Cannot find package 'tsx' imported from /home/jicanta/derive/web/`
- `ls -d node_modules/react server/node_modules/react web/node_modules/react` → only `web/node_modules/react`
- `ls node_modules/.bin/tsx server/node_modules/.bin/tsx web/node_modules/.bin/tsx` → server and web bins present, root absent

### Secondary (MEDIUM confidence)
- None. No web search or external documentation was consulted: the ROADMAP declares the domain settled and every open question was answerable from the repository.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Roadmap hint verification (§1): **HIGH** — four hints, each checked against the file or the filesystem, two probes run to settle the test-infrastructure question rather than reason about it
- Landing points (§2): **HIGH** — every path, symbol, column, class string and count quoted from a file opened this session, with line ranges
- Pitfalls: **HIGH** for 1, 2, 5, 6, 7, 8 (each is a quoted assertion or a quoted mechanism); **MEDIUM** for 3 (CSS Grid behaviour reasoned from the spec, not rendered — assumption A2) and 4 (follows from two quoted functions, not observed in a browser)
- Open Question 1 (prefetch): **HIGH** on the blocker (the guard and the emit are both quoted), **MEDIUM** on the recommendation — it narrows a requirement and is the owner's call, not research's
- Security domain: **HIGH** on the one new exposure (the closure-only answer key is quoted at three sites); **HIGH** on the inherited controls (middleware and `learnerOf` quoted)
- Stack: **HIGH** — no package is added, so nothing needs registry verification

**Not covered, stated so this file is not read as coverage it does not have:**
- No UI was rendered or measured. Every visual claim is a class string read from source; UI-SPEC's measured contrast figures were not re-measured.
- `pnpm build`, `pnpm typecheck`, `pnpm test` and `pnpm method:check` were **not** run — the pinned counts in §Pitfall 1 are read from the test sources, not observed failing. The planner should expect to see them fail when `due` lands, which is the point.
- The conformance harness was not run (no provider key in this environment).

**Research date:** 2026-11-04
**Valid until:** 2026-12-04 for the ecosystem facts (nothing external moves this phase); **invalid the moment any of the quoted files changes** — the line numbers and counts are the whole value of this document, so re-verify §1 and §2.1 against HEAD if the phase does not start from `dd537fc`.
