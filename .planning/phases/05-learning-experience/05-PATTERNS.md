# Phase 5: Learning Experience - Pattern Map

**Mapped:** 2026-11-04
**Files analyzed:** 38 (6 new, 32 modified)
**Analogs found:** 36 / 38

File list taken from RESEARCH.md §Recommended Slice Structure (slices A–F) and UI-SPEC §Component
Inventory, which RESEARCH.md §1–2 verified against live source at `dd537fc`. Where CONTEXT.md and
RESEARCH.md disagree, RESEARCH.md wins (migration **11** not 12; `web/` has no test runner so tests go
in `server/test/`; `TOOL_REGISTRY` replaced the four-place rule). Per the orchestrator note, D-17 is
**in-turn pipelining in `server/src/prompt.ts` only** — no prefetch mechanism is mapped.

Every analog path below was checked with `git ls-files`; all are tracked source. No `.gsd/capabilities/`
mirror paths appear.

---

## File Classification

### Slice A — `prompts` table + rehydration (D-25, D-26)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `server/src/migrations.ts` (append v11) | migration | batch | same file, v9 `tool-rejections` entry | exact |
| `server/src/prompts.ts` (rewrite to table-backed) | service | event-driven | same file (in-memory version) + `server/src/db.ts` `q` statements | role-match |
| `server/src/db.ts` (prompt statements, delete cascades) | model | CRUD | same file: `q.listMisconceptions`, `deleteLesson`'s `withTx` list | exact |
| `server/src/actions.ts` (extract `gradeQuiz` from `openQuiz`'s `wait.then`) | service | request-response | same file `openQuiz` lines 198–240 | exact |
| `server/src/index.ts` (`held` removal, 409 from table, `lessonView.pending`, answer second path) | route | request-response | same file `/api/stats` + `/api/lessons/:id/answer` | exact |
| `web/src/lib/types.ts` (`LessonView.pending` → id+kind) | utility | transform | same file `NodeRow`/`AtlasNode` hand-mirrors | exact |
| `web/src/pages/Lesson.tsx` (`activePromptId` prefers persisted id) | component | event-driven | same file lines 78–82 | exact |
| `server/test/api.test.ts` (restart rehydration gate) | test | request-response | same file + `server/test/spawn.ts` `startDeriveServer` | exact |
| `server/test/tx.test.ts` (prompts cascade count) | test | CRUD | same file's before/after row counts | exact |
| `server/test/migrations.test.ts` (`LATEST_VERSION` 10→11) | test | batch | same file line 632 | exact |

### Slice B — `due` MCP command (D-05)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `server/src/tools.ts` (`due` registry entry, `surfaces: ['mcp']`, **no `label`**) | config | request-response | same file `ask` entry (lines 143–157) | exact |
| `server/src/mcp.ts` (`due` handler) | controller | request-response | same file `handlers.library` / `learners` | exact |
| `plugin/commands/due.md` **(new)** | config | request-response | `plugin/commands/review.md` | exact |
| `scripts/render-method.mjs` (new TARGET + exclusions + count 22→23) | utility | transform | same file `TARGETS` / `COMMAND_EXCLUSIONS` | exact |
| `codex/skills/derive-due/SKILL.md` **(new, if sibling)** | config | request-response | `codex/skills/derive-review/SKILL.md` | exact |
| `server/test/wire-surface.json` (regenerate) | test fixture | transform | same file via `DERIVE_WRITE_WIRE_SURFACE=1` | exact |
| `server/test/wire-surface.test.ts` (24→25, 22→23, `driverTool` loop) | test | transform | same file lines 176–200 | exact |
| `server/test/mcp.test.ts` (22→23, widen `MCP_TOOLS_BEFORE`) | test | request-response | same file lines 30–33, 123, 137 | exact |

### Slice C — Home next step + shared header (D-01..D-04)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `web/src/components/PageHeader.tsx` **(new)** | component | static | `web/src/pages/Lesson.tsx:146-150` header shell (the six are byte-identical) | exact |
| `web/src/components/DuePill.tsx` **(new)** | component | static | `web/src/components/fields.ts` `pill` + `Lesson.tsx:155-158` cost pill | exact |
| `web/src/components/NextStep.tsx` **(new)** | component | static | `web/src/pages/Home.tsx:216-221` "Or start from one of these" rows | exact |
| `web/src/pages/{Lesson,Atlas,Library,You,Settings,Usage}.tsx` (adopt `PageHeader`) | component | static | each other — same shell string | exact |
| `web/src/pages/Home.tsx` (mount `NextStep`, nav pill) | component | static | same file, stats footer lines 224–246 | exact |

### Slice D — retention + stability tint (D-06..D-10)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `server/src/db.ts` (`retention(learnerId)` + prepared statements) | model | CRUD | same file `q.stats` / `q.dueNodes` / `stats()` | exact |
| `server/src/index.ts` (`GET /api/retention`) | route | request-response | same file `/api/stats` (lines 313–316) | exact |
| `web/src/lib/api.ts` (`retention` key) | service | request-response | same file `stats` / `atlas` keys | exact |
| `web/src/lib/types.ts` (`Retention` type; `NodeRow.stability`) | utility | transform | same file `NodeRow` / `Stats` | exact |
| `web/src/components/RetentionPanel.tsx` **(new)** | component | static | `web/src/pages/Atlas.tsx:169-191` misconceptions block | exact |
| `web/src/pages/Atlas.tsx` (3rd block, legend item, pass `stability`) | component | static | same file lines 147–199 | exact |
| `web/src/components/Graph.tsx` (`Data.stability`, inline ramp style) | component | static | same file `due` threading (lines 19, 25, 71–76) | exact |

### Slice E — keyboard + help + focus + status (D-11..D-16)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `web/src/components/AskCard.tsx` (letters, `?`, Enter) | component | event-driven | `web/src/components/QuizCard.tsx:60-84` | exact |
| `web/src/components/ExplainCard.tsx` (Enter submit, 8-word floor into `send()`) | component | event-driven | `QuizCard.tsx:60-84` + `ExplainCard.tsx:54-59` | exact |
| `web/src/components/QuizCard.tsx` (`?`→help, `title`, chip count) | component | event-driven | same file lines 60–84, 208–209 | exact |
| `web/src/components/PlanCard.tsx` (verify only, add `? help` chip) | component | event-driven | same file line 38 | exact |
| `web/src/components/KeyHelp.tsx` **(new)** | component | event-driven | `web/src/components/LearnerMenu.tsx:42` window-Escape overlay + `QuizCard` kbd row | role-match |
| `web/src/pages/Lesson.tsx` (focus state, grid swap, `f`/Esc, `data-focus-hide`) | component | event-driven | same file lines 224–227, 403 | exact |
| `web/src/lib/htmlAttr.ts` **(new, recommended)** | utility | transform | `web/src/lib/api.ts` `currentLearner` (try/catch'd DOM-ish accessor) | partial |
| `web/src/index.css` (one `html[data-focus]` rule) | config | static | same file `.glow-gold` (line 94) | exact |
| `server/src/actions.ts` (`Grading your answer` ephemeral) | service | event-driven | `server/src/events.ts:42-46` `emitEphemeral` + `agent.ts:204` `'Thinking'` | exact |
| `server/test/reducer.test.ts` **(new)** + `web/src/lib/lessonReducer.ts` **(extract)** | test / utility | transform | `server/test/schedule.test.ts` (pure-module test) | role-match |

### Slice F — voice + remediation (D-18..D-23)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `web/src/lib/voice.ts` (`setVoiceLang`, cache reset, sentence split) | utility | streaming | same file lines 78–99, 111, 160 | exact |
| `web/src/lib/locales.ts` **(new name→BCP-47 table)** | utility | static | `server/src/pricing.ts` header + table (committed pure data, no I/O) | exact |
| `web/src/lib/useVoiceMode.ts` (streaming chunks, `Map<key,chars>`, mic guard) | hook | streaming | same file lines 107–155 | exact |
| `server/test/voice.test.ts` **(new)** | test | transform | `server/test/schedule.test.ts` + the §1.3 probe | role-match |
| `server/src/schedule.ts` (`weakestFirst` pure ranking) | utility | transform | same file `retrievability()` (lines 78–81) | exact |
| `server/src/actions.ts` (D-20 one-node instruction, refusal, gate exits, D-23 misconceptions) | service | request-response | same file `nodeStatus` refusal (lines 295–301), `dependencyRecord` (187–193) | exact |
| `server/src/db.ts` (per-node misconception query) | model | CRUD | same file `q.listMisconceptions` (lines 149–152) | exact |
| `server/src/prompt.ts` (`reviewTurnPrompt` in-turn pipelining — D-17 as re-read) | config | static | same file's existing turn prompts | role-match |
| `server/test/api.test.ts` (ranking, refusal, two exits) | test | request-response | same file + `server/src/drivers/fake.ts` + `setDriverOverride` | exact |
| `scripts/conformance.mjs` (4th verdict: remediation held) | test | batch | same file lines 468–474, 517 | exact |

---

## Pattern Assignments

### `server/src/migrations.ts` — append migration **11** (migration, batch)

**Analog:** same file, v9 `tool-rejections` (lines 319–350).

**Entry shape — bare `CREATE TABLE`, never `IF NOT EXISTS`** (the module header at lines 22–26 states
this policy; the version number is what catches the mistake `IF NOT EXISTS` would hide):

```ts
  {
    version: 9,
    name: 'tool-rejections',
    up(db) {
      // One row per tool call whose arguments failed the **full** server-side
      // schema — the narrow, unambiguous signal that the model produced a bad
      // call. … [prose paragraphs, not bullets, explaining the design]
      db.exec(`
        CREATE TABLE tool_rejections (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          turn_id TEXT NOT NULL,
          driver TEXT NOT NULL,
          model TEXT,
          tool TEXT NOT NULL,
          ts INTEGER NOT NULL
        );
        CREATE INDEX tool_rejections_turn ON tool_rejections (turn_id);
        CREATE INDEX tool_rejections_provider ON tool_rejections (driver, model);
      `);
    },
  },
```

Copy: the `{ version, name, up(db) }` triple, the multi-paragraph `//` design comment inside `up`, the
template-literal `db.exec` with `CREATE TABLE` + `CREATE INDEX` in one call, and an index on the
column reads will filter by (`lesson_id` for prompts, mirroring `tool_rejections_turn`).

Also move `LATEST_VERSION` 10 → 11 in `server/test/migrations.test.ts:632-633`; every other assertion
in that file reads `LATEST_VERSION` and needs no edit.

---

### `server/src/prompts.ts` — table-backed rewrite (service, event-driven)

**Analog:** the shipped in-memory version of the same file (61 lines, read in full) — the export surface
is the contract to preserve; only the storage changes.

**Exports to keep, signature-for-signature:**

```ts
type Resolver = (answer: Record<string, unknown>) => void;
export type PromptKind = 'quiz' | 'ask' | 'plan' | 'explain';
type Pending = { lessonId: string; kind: PromptKind; resolve: Resolver; openedAt: number; held: boolean };
const pending = new Map<string, Pending>();

export function openPrompt(lessonId: string, kind: PromptKind, payload: Record<string, unknown>, opts: { hold?: boolean } = {}) {
  const id = randomUUID();
  emit(lessonId, kind, { id, ...payload });
  const wait = new Promise<Record<string, unknown>>((resolve) => {
    pending.set(id, { lessonId, kind, resolve, openedAt: Date.now(), held: !!opts.hold });
  });
  return { id, wait };
}
```

Three things this excerpt pins for the rewrite:

1. **`emit(lessonId, kind, { id, ...payload })` is the learner-safe half.** The answer key never goes
   through it. The new table row holds `correct` / `explanation` / `rubric`; the emit stays exactly as
   above, and no route may project those three fields outward.
2. **The resolver is the one thing that cannot be persisted.** Keep the `Map` for the live promise
   resolver *only* (it is not a second source of truth about openness — the table answers
   `hasPending` / `pendingPrompt` / the 409); `answerPrompt` falls through to the restore path when the
   row exists and the resolver does not.
3. `cancelPending`'s `if (p.held && !opts.held) continue;` held/ordinary distinction becomes a column
   predicate, not a map walk.

**Module header pattern** (every server module opens with one; `prompts.ts`'s own is the model):

```ts
/**
 * Prompts are tool calls that wait for the learner: a quiz, an open
 * question, a plan approval, a teach-back. …
 *
 * A prompt is normally answered within the turn that opened it. A *held*
 * prompt outlives its turn: … Ending a turn cancels ordinary prompts and keeps held ones.
 */
```

---

### `server/src/db.ts` — prompt statements, `retention()`, per-node misconceptions (model, CRUD)

**Analog:** same file. Three distinct excerpts.

**Prepared-statement pattern** (lines 145–156) — every statement is a key on the module-level `q`
object, SQL in a template literal when it wraps, and every read that joins `lessons` excludes scratch:

```ts
  resolveMisconceptions: db.prepare('UPDATE misconceptions SET resolved = 1 WHERE lesson_id = ? AND node_id = ?'),
  listMisconceptions: db.prepare(`
    SELECT m.*, l.topic FROM misconceptions m JOIN lessons l ON l.id = m.lesson_id
    WHERE l.learner_id = ? AND l.scratch = 0 ORDER BY m.resolved ASC, m.ts DESC LIMIT 40
  `),
  deleteMisByLesson: db.prepare('DELETE FROM misconceptions WHERE lesson_id = ?'),
```

D-23's per-node query is `listMisconceptions` with `AND m.lesson_id = ? AND m.node_id = ?` and
**without** the `resolved ASC` demotion (a resolved misconception is the best distractor material).
`deletePromptsByLesson` copies `deleteMisByLesson` verbatim in shape.

**Multi-figure aggregate pattern** for `retention()` (lines 278–287) — named `$l` parameters, one
statement with subselects, and a hand-written return type on the wrapper:

```ts
  stats: db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM lessons WHERE learner_id = $l AND scratch = 0) AS lessons,
      (SELECT COUNT(*) FROM nodes n JOIN lessons l ON l.id = n.lesson_id WHERE l.learner_id = $l AND l.scratch = 0 AND n.status = 'locked') AS locked,
      …
  `),
```
```ts
export function stats(learnerId: string) {
  return q.stats.get({ l: learnerId }) as { lessons: number; locked: number; quizzes: number; correct: number };
}
```

**Review copies are already excluded** — carry `n.source_lesson IS NULL` into every retention read, as
`q.allNodes` (lines 154–157) and `q.dueNodes` (lines 273–277) do, or estimated knowledge double-counts.

**Cascade pattern** — add `deletePromptsByLesson` to `deleteLesson`'s single `withTx` list (lines
507–530) and to `deleteLearner`'s transaction (lines 458–470). `withTx` is re-entrant and must be given
a **synchronous** `fn`:

```ts
/**
 * Run `fn` inside one transaction, rolling back and rethrowing the original
 * error unchanged if it throws. Re-entrant: a `withTx()` called from inside
 * another joins it … `fn` must be synchronous: node:sqlite is, and an awaited
 * body would commit before its work finished.
 */
export function withTx<T>(fn: () => T): T {
```

---

### `server/src/index.ts` — `GET /api/retention`, 409 from the table, answer second path (route, request-response)

**Analog:** `/api/stats`, lines 313–316.

**Route pattern** — one expression, `learnerOf(c)` for scope, spread of a db function, no try/catch
(a thrown lowercase `Error` becomes `{ error }` upstream). New `/api/*` routes inherit `guardLocal` and
the token check automatically (lines 191, 254) — no auth work:

```ts
app.get('/api/stats', (c) => {
  const learner = learnerOf(c);
  return c.json({ ...stats(learner), due: dueNodes(learner).length, vault: !!VAULT_DIR, library: listResources(learner).length, learner: getLearner(learner) });
});
```

**Section separator** to place it under (lines ~317): `// ---------- learners ----------` — add
`// ---------- retention ----------` in the same style.

**The 409 being replaced** (lines 1396–1397) — keep the sentence verbatim; only its predicate moves
from `held.get(id)` to the table:

```ts
    if (terminal && (action === 'quiz' || action === 'ask' || action === 'set_plan' || action === 'explain_back') && held.get(id) && !held.get(id)!.settled) {
      return c.json({ error: `A card is already open (${held.get(id)!.kind}). Wait for the learner's reply and pass it to \`answer\` before asking anything else.` }, 409);
```

**The answer path that needs a second branch** (lines 937–944):

```ts
  const ok = answerPrompt(id, prompt_id, answer);
  if (!ok) return c.json({ error: 'no such pending prompt (the turn may have ended; send a message instead)' }, 409);
```
After D-26: no resolver **but a persisted row** → call the extracted `gradeQuiz(...)`, then start a
fresh turn. The 409 sentence survives only for a genuinely absent row.

**`lessonView` must carry id + kind, not a boolean** — `pendingPrompt(id)` already returns
`{ id, kind, held }`; `lessonView`'s `pending: hasPending(id)` (line 303) and
`web/src/lib/types.ts:228` `pending: boolean` both change together.

---

### `server/src/actions.ts` — extract `gradeQuiz`, D-20 refusal, D-23 misconceptions, D-16 status (service, request-response)

**Analog:** same file. Four excerpts.

**The settle block to extract** (lines 198–240, inside `openQuiz`'s `wait.then`). Everything from
`const selected = …` through the `afterQuiz` call becomes
`gradeQuiz(lessonId, promptId, args, answer)` so the live promise **and** the restore path call one
function:

```ts
    const selected = (ans.idk ? [] : (ans.selected ?? [])).filter((i) => Number.isInteger(i) && i >= 0 && i < a.options.length);
    const isCorrect = !ans.idk && sameSet(selected, a.correct);
    const result = ans.idk ? 'dont_know' : isCorrect ? 'correct' : 'incorrect';
    // The learner commits to how sure they are before the reveal. Default is sure: an unsure answer is a deliberate flag.
    const confidence: Confidence | null = ans.idk ? null : ans.sure === false ? 'unsure' : 'sure';
    emit(lessonId, 'quiz_result', { id, selected, correct: a.correct, explanation: a.explanation, result, note: ans.note ?? null, confidence, purpose, tests });
    recordQuiz(lessonId, a.node_id ?? null, isCorrect, { confidence, purpose, tests });
    // A pretest miss is the learner's honest guess before instruction, not a belief they hold.
    if (result === 'incorrect' && purpose !== 'pretest') {
      addMisconception({ lessonId, nodeId: a.node_id ?? null, question: a.question, picked: …, correct: …, explanation: a.explanation, confidence });
    }
    const instruction = afterQuiz(result, confidence, purpose, { lessonId, nodeId: a.node_id ?? null, tests });
```

**D-16's grading line goes immediately after the `quiz_result` emit above, and nowhere else.** The
browser suppresses `status` while a card is unanswered (`Lesson.tsx:367` `!waiting`), and `waiting`
goes false the moment the result lands — so emitting before the verdict drops the line. One call covers
all three drivers, because grading is in `actions.ts`, not a driver:

```ts
// Source: server/src/events.ts:42-46
export function emitEphemeral(lessonId: string, type: string, payload: unknown) {
  const ev: StoredEvent = { seq: -1, type, payload: redactDeep(payload), ts: Date.now() };
  for (const l of listeners.get(lessonId) ?? []) l(ev);
}
```
Call it as `'Thinking'` already is (`server/src/agent.ts:204`, `server/src/drivers/api.ts:727`):
`emitEphemeral(lessonId, 'status', { text: 'Grading your answer' })`.
**Do not add a `TOOL_LABELS` entry** — `wire-surface.test.ts:176` asserts the added label set is exactly
`['fetch_page','web_search']`.

**D-20's refusal shape** (lines 295–301) — `{ ok: false, refused: true, error }`, a lowercase-to-the-
learner sentence, naming the next call, ending with the fixed clause. `index.ts:1480` answers
`r.refused ? 400 : 200` with the sentence intact and `api.ts`'s `j()` throws that exact message, so it
reaches both the model and the learner verbatim:

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

**The instruction the ranking replaces** (`dependencyRecord`, lines 187–193) — note it already walks
`depends_on`, reads each dep's `status` and `nodeRecord(...)`: D-21 adds an ordering over data already
gathered, it does not add a read:

```ts
function dependencyRecord(lessonId: string, nodeId: string): string {
  const node = getNode(lessonId, nodeId);
  const nodes = new Map(listNodes(lessonId).map((n) => [n.node_id, n]));
  const deps = (JSON.parse(node?.depends_on || '[]') as string[]).map((d) => nodes.get(d)).filter((d): d is NonNullable<typeof d> => !!d);
  if (!deps.length) return 'It is a ground truth: nothing below it, so re-state it and ask a fresh question on it directly.';
  return `it rests on ${deps.map((d) => `"${d.label}" [${d.node_id}] (${d.status}; ${nodeRecord(lessonId, d.node_id)})`).join(', ')}.`;
}
```
Two call sites: `afterCumulative` (line 178, instruction at 183) and `nodeStatus`'s shaky branch
(316–318). **`afterQuiz`'s miss branches name no dependency at all** — see the open decision below.

**`afterQuiz`'s instruction-string style** (lines 141–146), the voice D-20's new sentence must match —
second person about the learner, imperative to the model, no hedging:

```ts
  if (result === 'dont_know') {
    return 'They did not know. Do not reveal the derivation yet: give one hint that points at the node this rests on, then a fresh quiz on the same claim. If that misses too, re-derive it from its dependencies step by step and mark the node shaky.';
  }
```

**`extra.instruction` is one key with three writers in `nodeStatus`** (shaky at :316, goal-locked
cumulative at :323, nothing for `teaching`). D-23 adds a `teaching` writer and must **merge** on the
shaky path, which already sets one.

---

### `server/src/schedule.ts` — `weakestFirst` pure ranking (utility, transform)

**Analog:** same file, `retrievability()` (lines 78–81).

```ts
export function retrievability(node: Parameters<typeof cardOf>[0], now = Date.now()): number {
  if (node.stability == null || node.difficulty == null) return 1;
  return scheduler.get_retrievability(cardOf(node, now), new Date(now), false);
}
```
and the desired-retention constant D-07 reads (line 21):
```ts
const scheduler = fsrs(generatorParameters({ request_retention: 0.9, enable_fuzz: false, learning_steps: [], relearning_steps: [] }));
```

Copy: `now = Date.now()` as a defaulted last parameter so tests pin time; the narrowest accepted param
type (`Parameters<typeof cardOf>[0]`, itself a `Pick<NodeRow, …>`); **type-only** import of `NodeRow`
(lines 15–16) so no database is pulled in. `weakestFirst(deps, checks, now = Date.now())` returns an
ordered array and imports nothing from `db.ts` at runtime — that is what lets
`server/test/schedule.test.ts` open no file.

Note the `return 1` fallback: the plan must state whether a null-stability locked node contributes 1.0
to estimated knowledge or is excluded.

---

### `server/src/tools.ts` + `server/src/mcp.ts` — the `due` command (config / controller)

**Analog:** `tools.ts` `ask` entry (lines 143–157) — the smallest complete registry entry:

```ts
  {
    name: 'ask',
    description: 'Ask the learner a question with no right answer (goal, preference, energy, what next). …',
    shape: { question: z.string(), options: z.array(z.string()).max(4).optional().describe('Optional suggested answers.') },
    surfaces: ['agent', 'api', 'mcp', 'http'],
    label: 'Asking',
    per_surface: {
      mcp: { description: '…' + MCP_TERMINAL_NOTE, shape: { options: z.array(z.string()).max(4).optional() } },
    },
  },
```
For `due`: `surfaces: ['mcp']` only, a `.describe()` on every shape field (those strings are the
model-facing docs), and **no `label`** — a label would fail `wire-surface.test.ts:176`.

**Handler pattern** (`mcp.ts` `handlers`, lines ~258–275) — one arrow per tool, proxying over HTTP:

```ts
  learners: async (a) => {
    const create = a.create as string | undefined;
    if (create) await api('/api/learners', { name: create });
    return api('/api/learners');
  },
  library: async (a) => {
    const who = (a.learner as string | undefined) ?? LEARNER;
    const topic = a.topic as string | undefined;
    const qs = new URLSearchParams({ ...(topic ? { topic } : {}), ...(who ? { learner: who } : {}) }).toString();
    return api(`/api/external/library${qs ? `?${qs}` : ''}`);
  },
```
`due` is `library`'s shape exactly: read `?? LEARNER`, build a querystring, `api('/api/retention…')`.
Registration is automatic and must not be hand-written — the loop throws on a missing handler:

```ts
for (const spec of toolsFor('mcp')) {
  const run = handlers[spec.name];
  if (!run) throw new Error(`no handler for tool: ${spec.name}`);
  server.registerTool(spec.name, { description: descriptionFor(spec, 'mcp'), inputSchema: shapeFor(spec, 'mcp') }, async (a) => text(await run(a)));
}
```

**`plugin/commands/due.md`** — analog `plugin/commands/review.md`: three-key frontmatter
(`description`, the generated `allowed-tools:` line, nothing else), then numbered steps in second person
addressed to the model. The `allowed-tools` line is **generated**; the new file must be appended to
`scripts/render-method.mjs` `TARGETS` and given an entry in `COMMAND_EXCLUSIONS` (the renderer hard-fails
on a target with no declared exclusions), and the `names.length !== 22` guard at line 177 becomes 23.

**`codex/skills/derive-due/SKILL.md`** — analog `codex/skills/derive-review/SKILL.md`: `name` +
`description` frontmatter, an `# Derive: …` heading, then `<!-- method:begin -->` if the method region
is rendered into it (if `due` needs no method text, omit the region and leave it out of `TARGETS`).

---

### `web/src/components/PageHeader.tsx` **(new)** (component, static)

**Analog:** `web/src/pages/Lesson.tsx:146-150` — the shell string is byte-identical across all six
pages (`Lesson:146`, `Atlas:111`, `Library:78`, `You:101`, `Settings:97`, `Usage:45`). Keep the shipped
class order so the diff reads as an extraction:

```tsx
      <header className="flex items-center gap-5 px-5 md:px-6 h-[60px] border-b hairline shrink-0">
        <Link to="/" className="text-ink-400 hover:text-ink-50 transition-colors" title="All lessons">
          <ArrowLeft size={18} strokeWidth={1.8} />
        </Link>
        <h1 className="font-serif text-[22px] tracking-[-0.01em] truncate text-ink-50">{state.lesson?.topic ?? '…'}</h1>
```

Per the UI-SPEC the title gains `min-w-[8ch] flex-1 basis-0` (the open `03-UI-REVIEW` finding 1 fix,
genuinely new code) and the checker's non-blocking FLAG asks for an `aria-label` on the icon-only Back
link worded from `to`. Four shipped differences the component must absorb rather than flatten
(RESEARCH §2.5): `LearnerMenu` is in four headers not six (make it an optional child); the right-slot
gap is `gap-6` not `gap-5 md:gap-6`; the lesson header has **two** right groups, the first `hidden
md:block` holding `PhaseBar` — the due pill must go in the second, always-visible group; and only
`You`/`Settings` titles currently carry `min-w-0`.

**Component conventions:** one component per file, PascalCase matching the filename, props destructured
inline with no separate `Props` type, named export, no `export default`.

---

### `web/src/components/DuePill.tsx` **(new)** (component, static)

**Analog:** `web/src/components/fields.ts` `pill` (line 25) plus the lesson header's cost pill
(`Lesson.tsx:155-158`) whose geometry the UI-SPEC says to match byte-for-byte.

```ts
/** A small capsule stating a fact about a row: a status, or where a value came from. */
export const pill = 'inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.16em] uppercase text-ink-400 border hairline rounded-full px-2.5 h-6';
```
```tsx
          <Link
            to="/settings"
            className="hidden md:inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.16em] uppercase text-ink-400 hover:text-ink-50 border hairline rounded-full px-2.5 h-6 transition-colors"
            title="Which model is teaching. Change it in Settings; it applies from the next turn."
          >
```
`fields.ts` has `gap-2`, the cost pill `gap-1.5`; the UI-SPEC picks `gap-1.5`. Compose rather than
restate — `${pill} gap-1.5` — which is the documented way to extend that vocabulary ("A caller that needs
one more utility composes it — `${textButton} gap-1.5` — rather than restating the string"). Drop the
`hidden md:` prefix: the due pill is visible at every width.

---

### `web/src/components/NextStep.tsx` **(new)** (component, static)

**Analog:** `web/src/pages/Home.tsx:216-221`, the "Or start from one of these" rows whose rhythm the
UI-SPEC locks the next-step rows to:

```tsx
            <div className="mt-7">
              <div className="eyebrow mb-1">Or start from one of these</div>
              {TRY.map((t) => (
                <button key={t} type="button" onClick={() => void start(t)} className="block w-full text-left py-2.5 border-t border-ink-100/10 font-serif text-[1.2rem] text-ink-300 hover:text-ink-50 transition-colors">
                  {t}
                </button>
              ))}
            </div>
```

And the quiet/live due treatment already shipped in Home's stats footer (lines 234–240) — the exact
ternary the lead row generalises, teal when live, `ink-500` and non-interactive when not:

```tsx
                {stats.due > 0 ? (
                  <button type="button" onClick={review} className="text-teal-400 hover:underline">
                    {stats.due} due today → review
                  </button>
                ) : (
                  <span className="text-ink-500">nothing due today</span>
                )}
```

---

### `web/src/components/RetentionPanel.tsx` **(new)** (component, static)

**Analog:** `web/src/pages/Atlas.tsx:169-191`, the Misconceptions block — the third block copies this
shell verbatim (`border-t hairline pt-[18px]`, eyebrow + right-aligned serif figure in a baseline flex
row, then `mt-2`/`mt-2.5` content, then an empty-state `<li>`):

```tsx
            <div className="border-t hairline pt-[18px]">
              <div className="flex items-baseline justify-between">
                <span className="eyebrow text-rust-400">Misconceptions caught</span>
                <span className="font-serif text-[22px] text-rust-400">{atlas.misconceptions.filter((m) => !m.resolved).length}</span>
              </div>
              <ul className="mt-2.5 flex flex-col gap-3">
                …
                {open.length === 0 && <li className="text-sm text-ink-500">None outstanding.</li>}
              </ul>
            </div>
```

The legend row to append D-09's fifth item to (lines 192–197) — a 6px dot plus a short label, with the
full sentence in `title`:

```tsx
            <div className="border-t hairline pt-4 flex gap-4 font-mono text-[10px] text-ink-500">
              <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-gold-500" />locked</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full border border-teal-400 box-border" />due</span>
```

Aside shell for reference (line 148): `w-[340px] max-h-[calc(100%-3rem)] overflow-y-auto scroll-thin
rounded-[18px] border hairline bg-ink-900/92 backdrop-blur p-[22px] flex flex-col gap-5` — 296px of
content, which is the width the UI-SPEC's 286px sparkline is fitted to. (UI-SPEC cites `Atlas.tsx:181`
and `:198`; the live lines are 169 and 192–197. Class strings are right, line numbers drifted.)

---

### `web/src/components/Graph.tsx` — `stability` tint (component, static)

**Analog:** the `due` flag already threaded through the same file — D-10 is the same mechanism one field
over.

```ts
type Data = { label: string; kind: GraphNode['kind']; status: GraphNode['status']; summary?: string | null; due?: boolean; index?: number };
export function layoutGraph(nodes: (GraphNode & { due?: boolean })[], offset = { x: 0, y: 0 })
```
```ts
  if (status === 'locked') tone = 'bg-gold-500 border border-gold-400 text-[#17130b] glow-gold animate-glow-in';
  if (status === 'shaky') tone = 'bg-ink-850 border border-dashed border-rust-400 text-rust-400';
  if (status === 'locked' && due) tone = 'bg-ink-850 border border-teal-400 text-ink-50 shadow-[0_0_22px_-6px_rgba(127,196,201,0.6)]';
  const badge = status === 'locked' && !due ? 'text-[#17130b]/55' : status === 'teaching' ? 'text-teal-400' : 'text-ink-500';
```
and the existing `style` prop to extend (line 76): `style={{ width: kind === 'goal' ? W + 16 : W, height: H }}`.

**The ramp cannot be a class** — Tailwind v4 resolves arbitrary values at build time, so the per-node
`color-mix()` is an inline `style` (`backgroundColor`, `borderColor`, `boxShadow`, ordinal `color`),
replacing `glow-gold` and omitting `animate-glow-in`. With `stability` absent, the class strings above
are used **verbatim**; `stability === 0` is the faint end of the ramp, not absence. `Atlas.tsx:32-40`
already passes `due` through `gnodes`, so `stability: n.stability` is one line beside it;
`rowsToNodes` (`useLesson.ts:57-66`) emits six fields and no `stability`, so D-10's in-lesson clause is
true by construction and needs no guard. Tokens exist already (`index.css:22-29`, `.glow-gold` at :94).

---

### The four cards + `KeyHelp` (component, event-driven)

**Analog:** `web/src/components/QuizCard.tsx:60-84` — the reference effect. Copy the guard order, the
`e.preventDefault()`, **and the `eslint-disable-next-line` comment** (ESLint is not installed; the
comment marks the intentional omission of `send` from deps and must survive the copy):

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
Line 77 is D-11's `?` reassignment. Quiz **already** has digits and letters; `AskCard.tsx:36` has
digits only (`/^[1-4]$/`) and no Enter commit; `ExplainCard.tsx:54-59` has no window listener at all,
only the textarea's `⌘↵`; `PlanCard.tsx:38` already commits on plain Enter — verify, do not rebuild.

Two live bugs to fold in rather than discover in review: `ExplainCard.send()` does **not** enforce the
eight-word floor (`if (!text.trim() || sending || answered) return;` at :25, only the button is gated at
:63), so plain Enter would make a one-word submit trivially reachable; and `QuizCard`'s hint chips are a
fixed `1 2 3` with a stale `title` naming `? for I don't know` (:208-209) — both rewrites are mandatory.

**`KeyHelp.tsx`** — closest analog for the window-level `Escape` dismissal is
`web/src/components/LearnerMenu.tsx:42`, the only existing **window** Escape listener. Esc precedence
must be ordered against it (menu closes first, or the lesson handler checks no menu is open); there is
no global Esc→stop today, so UI-SPEC rule 3 is new code. The overlay's chips reuse `.kbd` from
`index.css`; note `ExplainCard`'s textarea is `autoFocus` and every handler bails inside a `TEXTAREA`,
so `?` will not open the overlay mid-teach-back — accept it and do not advertise `?` on the explain row.

---

### Focus mode in `web/src/pages/Lesson.tsx` (component, event-driven)

**Analog:** the shipped grid the toggle must collapse (lines 224–227), plus the right aside at :403:

```tsx
      <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[232px_minmax(0,1fr)_452px] lg:grid-cols-[minmax(0,1fr)_420px]">
        <aside className="hidden xl:block border-r hairline min-h-0 overflow-y-auto scroll-thin">
          <OutlineRail nodes={state.nodes} goal={state.lesson?.goal ?? null} materials={state.materials} uploading={upload.uploading} />
        </aside>
```

**One CSS rule is not sufficient.** `display: none` on the asides does not collapse the explicit `232px`
/ `452px` tracks, so the centre column keeps its width and sits offset. Three mechanisms, honestly named:
React state owns focus (it must, for the timeline filter), the state writes `data-focus` on
`document.documentElement` (establishing the convention Phase 6 extends — Phase 5 is the **first** code
in the repo to touch `documentElement`), and the grid columns swap by className.

**Analog for the CSS rule** (`web/src/index.css:94`) — single rule, `color-mix`/token-based, no new
`@theme` entry: `.glow-gold { box-shadow: 0 0 34px -6px color-mix(in oklab, var(--color-gold-500) 55%, transparent); }`

**Analog for `web/src/lib/htmlAttr.ts`** — `web/src/lib/api.ts`'s `currentLearner` is the nearest
shape for a tiny guarded environment accessor exported as a `const` arrow:

```ts
const LEARNER_KEY = 'derive.learner';
export const currentLearner = (): string => {
  try {
    return localStorage.getItem(LEARNER_KEY) ?? '';
  } catch {
    return '';
  }
};
```
(partial match — there is no existing DOM-attribute helper to copy. D-15 forbids persistence, so the
helper has no storage half.)

---

### `web/src/lib/api.ts` + `web/src/lib/types.ts` (service / utility)

**Analog:** `api.ts` lines 56–95 — a single `api` object of endpoint keys, each a one-line arrow ending
in `.then((r) => j<T>(r))`, with a `/** … */` one-liner where the key's meaning is not obvious. Never
`fetch` in a component:

```ts
export const api = {
  stats: () => get('/api/stats').then((r) => j<Stats>(r)),
  due: () => get('/api/review').then((r) => j<DueNode[]>(r)),
  atlas: () => get('/api/atlas').then((r) => j<Atlas>(r)),
```
`retention: () => get('/api/retention').then((r) => j<Retention>(r)),` is one key beside these.
Types are imported as one whole `import type { … }` statement (line 1) and hand-mirrored in `types.ts`
— `NodeRow` there stops short of `stability` (lines 247–259), so D-10 is a `types.ts` change first; the
data already arrives on `/api/atlas` (`index.ts:1191-1204` spreads the row).

**One fetch, two decisions:** `api.stats()` already returns `learner: getLearner(learner)`, so the call
`Lesson.tsx` needs for D-04's due pill also delivers `prefs.language` for D-19. Do not add two fetches.

---

### `web/src/lib/locales.ts` **(new)** (utility, static)

**Analog:** `server/src/pricing.ts` header + table — the committed pure-data module whose discipline
D-19 names. Copy the header's job: state that it is committed data rather than a runtime lookup, say
why, and say that it has no I/O and no import-time side effect so a test may import it:

```ts
/**
 * What a model request costs, and how much room it has to think in.
 * …
 * The table is committed data rather than a runtime fetch, and that is the whole
 * design. A network call behind a cost figure is a new failure mode in a path
 * that must not have one …
 * A price change should be a reviewable diff with a date on it, not something
 * that happens to Derive overnight. `PRICES_AS_OF` is that date …
 *
 * A model absent from the table is priced as unknown, never as zero. …
 *
 * Pure data with no I/O and no import-time side effect, so anything may import
 * it, including a test with no database behind it.
 */
```
Mirror `PRICES_AS_OF` with an as-of date, and mirror "absent is unknown, never a guess" with D-19's
`navigator.language` fallback. Note this file lives in `web/src/lib/` (its consumer is `voice.ts`) while
the analog is a server module — same discipline, different package, so web import style applies
(extensionless imports, no `.js`).

**Threading the tag in** (`voice.ts`): `voiceLang()` is read at `:86`, `:111`, `:160`, and `pickVoice()`
memoises the chosen voice in a module-level `let voice` invalidated only on `voiceschanged` (`:78-99`) —
so `setVoiceLang(tag)` must also reset that cache or the first-picked voice sticks.

---

### `web/src/lib/useVoiceMode.ts` — streaming sentence chunks (hook, streaming)

**Analog:** the same file's two shipped mechanics D-18 changes.

The skip to remove (lines 150–153):
```ts
        case 'assistant':
          if (it.streaming || !it.text.trim()) continue;
          spoken.current.add(k);
          say(spokenText(it.text));
```
The mic-arming callback that is the likeliest regression (lines 107–113):
```ts
  /** After the tutor has been heard: open the mic if there is something to answer. */
  const afterSpeech = useCallback(() => {
    if (!enabledRef.current || isSpeaking()) return;
    setSpeaking(false);
    const card = activeRef.current;
    const { busy: b, external: ext } = idleRef.current;
    if (card || (!b && !ext)) startListening(card?.kind === 'explain');
  }, [startListening]);
```
`spoken` is a `Set` of item keys, so "already said" is all-or-nothing per block; sentence chunking needs
a `Map<key, charsSpoken>` because deltas merge on a 60 ms flush (`useLesson.ts:289-293`) and `assistant`
blocks are rewritten under their original seq (`:110-120`), so the hook sees the same key with longer
text repeatedly — only text up to the **last complete** boundary may be spoken. And `afterSpeech` fires
whenever the queue drains (`isSpeaking()` is true only while `queue.length > 0`, `voice.ts:139`), so
mid-paragraph gaps would open the mic: D-18 needs an explicit `streaming` guard, not the existing check.

---

### `server/test/*.test.ts` — the three gates (test)

**Analog for the no-model HTTP gates:** `server/test/api.test.ts` — the header states the division of
labour and the `pnpm build` prerequisite, and the file supplies both halves of the conversation:

```ts
/**
 * The learning mechanics, driven over HTTP. Two halves, and the division is
 * the point.
 *
 * The first half drives the built server as a child process with no model
 * behind it at all. … a test can play both the tutor and the learner …
 *
 * What no automated test here can show, stated so that this file is not read
 * as coverage it does not have. …
 *
 * Needs `pnpm build` first (the first half runs server/dist/index.js).
 */
import { fakeServer, freePort, startDeriveServer, startInProcessServer, type InProcessServer } from './spawn.js';
const entry = resolve(here, '../dist/index.js');

const api = async <T = Record<string, unknown>>(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<{ status: number; json: T }> => {
  const res = await fetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json', 'x-derive-token': token }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, json: (await res.json()) as T };
};
const act = (lesson: string, action: string, body: unknown) => api(`/api/external/lessons/${lesson}/${action}`, body);
/** Open a terminal card and answer it in one go, returning the graded result. */
const askAndAnswer = async (lesson: string, quiz: Record<string, unknown>, reply: string) => {
```
D-27's restart gate reuses `startDeriveServer(entry, env, { dataDir })` (`spawn.ts:94` — it owns port
allocation, the `guardLocal` port match, retries and the readiness poll) against the **same** `dataDir`
twice: open a card, kill, respawn, assert the card is active and answering grades. The install token in
`~/.derive` survives on the same data dir, which is what makes this work.

**Analog for `voice.test.ts` and `reducer.test.ts`:** `server/test/schedule.test.ts` — the pure-module
pattern that opens no file. Both new tests go in `server/test/` and import web modules across the
package boundary (`../../web/src/lib/voice`), which RESEARCH §1.3 proved runs under
`node --import tsx --test` with no new dependency; the module header must say in one sentence why a web
module is tested from the server package so a future reader does not "fix" it. Prefer extracting
`applyEvent` + `apply` + `EVENT_TYPES` into a React-free `web/src/lib/lessonReducer.ts` (re-exported into
`useLesson.ts`) over exporting the internals in place — then the reducer test needs no `react`
resolution and `EVENT_TYPES` becomes assertable against the server's emitted set.

**Analog for the conformance assertion:** `scripts/conformance.mjs:468-474`, the three-verdict object,
plus the report header at :517:
```js
  const verdicts = {
    pretest: quizzes.some((r) => r.purpose === 'pretest'),
    gate: db.hasUnderstandingPass(id, GOAL_NODE),
    cumulative: cumulative.done.length > 0 && cumulative.missed.length === 0 && cumulative.pending.length === 0,
  };
```
Add a fourth key and a fourth report column. It imports `server/dist/db.js`, so `pnpm build` first.

---

## Shared Patterns

### Steer the model through the tool result, never the prompt
**Source:** `server/src/actions.ts:295-301` (quoted above), with `server/src/index.ts:1480`
`return c.json(withNotices(id, r), r.refused ? 400 : 200);`
**Apply to:** D-20, D-22, D-23 — every method rule is an `instruction` / `refused` / `notice` field on
what a tool returns. None of them is a prompt change, and none belongs in a driver.

### Transient state is ephemeral and never logged
**Source:** `server/src/events.ts:42-46` `emitEphemeral` (quoted above) — no `appendEvent`, no vault
mirror, `seq: -1`.
**Apply to:** D-16's grading line. `status` is already in `EVENT_TYPES`
(`useLesson.ts:248-251`) with a branch at `:96-97` and is cleared by `block_start` at `:100`, so no new
event type and no reducer branch. A `TOOL_LABELS` entry is forbidden.

### One declaration projected to every surface, frozen by a snapshot
**Source:** `server/src/tools.ts:38,670-676` (`ToolSurface`, `ALL_TOOL_NAMES`, `DERIVE_TOOL_NAMES`,
`TOOL_LABELS`) and `server/src/mcp.ts:283-287` (the registration loop).
**Apply to:** D-05. The sanctioned way to move the fixture, and the rule about it:
```ts
// server/test/wire-surface.test.ts:112
if (process.env.DERIVE_WRITE_WIRE_SURFACE === '1') writeFileSync(FIXTURE, `${JSON.stringify(live, null, 2)}\n`, 'utf8');
```
The file's own header: *"A failing diff means the contract the model reads has changed. That is not a
broken test, it is the review… Never regenerate it merely to make this test go green."*

### Pure logic modules have no I/O, so tests need no database
**Source:** `server/src/schedule.ts:15-16` (type-only `NodeRow` import), `server/src/pricing.ts` header.
**Apply to:** D-21's ranking, D-19's locale table, D-18's sentence splitter.

### Errors are plain lowercase sentences, surfaced verbatim
**Source:** `throw new Error('learner not found')` style in `db.ts`; routes answer `{ error }`;
`api.ts`'s `j<T>()` throws the server's `error` field; components hold `error: string | null`.
**Apply to:** every new route and refusal — the wording reaches both the model and the learner unchanged,
so the refusal sentence is product copy.

### Transactions and cascades
**Source:** `server/src/db.ts:287-298` `withTx` (quoted above) and `deleteLesson`'s single eight-delete
transaction at `:507-530` with its ordering comment.
**Apply to:** the `prompts` table's deletes in `deleteLesson` and `deleteLearner`, plus a
`server/test/tx.test.ts` case (that file counts rows before and after for exactly this class of write).

### Web component conventions
**Source:** `web/src/components/fields.ts` header and exports.
**Apply to:** all five new components — one component per file, PascalCase == filename, props
destructured inline, no separate `Props` type, named exports only, `web/src/lib/api.ts` gains a key
rather than a component gaining a `fetch`, shared class strings composed (`${pill} gap-1.5`) rather than
restated. `fields.ts` is `.ts` with no JSX and is deliberately outside the component count.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `web/src/lib/htmlAttr.ts` (new) | utility | transform | Phase 5 is the **first** code in the repo to touch `document.documentElement`; grep for `documentElement|data-theme|data-focus` over `web/src` and `web/index.html` returns zero matches. `web/index.html:2` is `<html lang="en">` and nothing else. Nearest shape is `api.ts`'s `currentLearner` (guarded const-arrow accessor); the convention itself is this phase's to establish for Phase 6. |
| 14-day forecast query in `server/src/db.ts` | model | CRUD | No forecast/next-review query exists (grep for `nextReview\|next_review\|MIN(review_at)\|forecast` returns one unrelated hit at `actions.ts:312`). The `q.dueNodes` statement is the closest *shape* to copy, but there is no grouped-by-day read to pattern from. |

---

## Open Decisions the Planner Must Make (surfaced by analog reading, not resolvable by pattern)

1. **Does D-20 extend to `afterQuiz`'s miss branches?** `dependencyRecord` has exactly two call sites
   (`afterCumulative:178`, `nodeStatus` shaky `:316-318`); `afterQuiz`'s `incorrect`/`dont_know`
   branches (`:141-146`) name no dependency at all, yet Success Criterion 4 reads "on a failed quiz".
   Three instruction strings rather than two.
2. **Are resolved misconceptions distractor material?** `resolveMisconceptions(lessonId, nodeId)` flips
   `resolved = 1` on every lock (`db.ts:1440-1442`, called from `actions.ts:305`), so by the time a node
   is `teaching` again its prior misconceptions are flagged resolved — and a resolved misconception is
   the *best* distractor. Also: lesson-scoped (simple, correct) or follow `source_node` (speculative)?
3. **Does `recentCards` move into the `prompts` row?** Not named by any decision. If the row stores
   `renderCard(...)` output, the companion path gets mirror de-duplication across restarts; if not, a
   restart shows the learner a duplicated card in the terminal mirror.
4. **Is the `prompts` row redacted on write?** `emit()` runs payloads through `redactDeep`
   (`events.ts:18`); a direct table write bypasses it.
5. **Null-stability locked nodes**: counted as 1.0 (the `retrievability()` fallback) or excluded?
6. **`LearnerMenu` in `PageHeader`**: optional child (conservative) or added to Lesson and Atlas (a new
   control on two surfaces, needing its own simplicity sentence)?
7. **Esc ordering** against `LearnerMenu.tsx:42`'s existing window listener.

---

## Metadata

**Analog search scope:** `server/src/`, `server/test/`, `web/src/{pages,components,lib}`, `scripts/`,
`plugin/commands/`, `codex/skills/`
**Files read this session:** 20 (targeted, non-overlapping ranges; the rest of the excerpts are carried
from RESEARCH.md's verified quotations with their line numbers)
**Pattern extraction date:** 2026-11-04
