# Phase 1: Foundation - Pattern Map

**Mapped:** 2026-09-17
**Files analyzed:** 22 (9 new, 13 modified)
**Analogs found:** 20 / 22

All analog paths below were verified git-tracked (`git ls-files`). No gitignored mirrors.

## File Classification

| New/Modified File | New? | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|------|-----------|----------------|---------------|
| `server/src/tools.ts` (registry, D-05) | modified | config/registry | transform | `server/src/tools.ts` itself + `server/src/agent.ts` `TOOL_DESCRIPTIONS`/`buildTools` | exact |
| `server/src/agent.ts` (→ claude driver) | modified | service | streaming | itself (`runTurn` + Claude branch) | exact |
| `server/src/codex.ts` (→ codex driver) | modified | service | streaming | itself (`runCodexTurn`) | exact |
| `server/src/driver.ts` (seam, new) | new | service | streaming | `server/src/backend.ts` (module-doc + resolution) + `server/src/events.ts` (sink shape) | role-match |
| `server/src/drivers/fake.ts` (new) | new | test fixture | streaming | `server/src/notices.ts` (tiny documented module) | partial |
| `server/src/migrations.ts` (new) | new | model/schema | batch | `server/src/db.ts` lines 10-137 (inline schema + ALTER list) | exact |
| `server/src/db.ts` (`withTx`, `turns`, `usage`) | modified | model | CRUD | itself (`q` prepared-statement object, `deleteLesson`, `replaceGraph`) | exact |
| `server/src/secrets.ts` + `redact()` (new) | new | utility | transform | `server/src/notices.ts` (module-level Map, documented) | role-match |
| `server/src/index.ts` (bind, Host/Origin, token, strict validation) | modified | route/controller | request-response | itself (`learnerOf`, `busy`, action switch, `serve()`) | exact |
| `server/src/config.ts` (VERSION, DERIVE_HOST, DERIVE_ORIGINS, TOKEN_PATH) | modified | config | request-response | itself | exact |
| `server/src/mcp.ts` (registry-driven `registerTool`, token header) | modified | route/proxy | request-response | itself (`registerTool` + `api()`) | exact |
| `server/src/events.ts` (redaction chokepoint) | modified | utility | pub-sub | itself (`emit`) | exact |
| `server/src/export.ts` (redaction on vault mirror) | modified | service | file-I/O | itself (`mirrorToVault`) | exact |
| `server/src/library.ts` (SSRF guard) | modified | service | request-response | itself (`get()` at line 217) | exact |
| `server/src/repo.ts` (SSRF + secret-file deny-list) | modified | service | file-I/O | itself (`fromDirectory`, `fromGitClone`) | exact |
| `server/src/prompt.ts` (rendered method target) | modified | config/text | transform | itself (`PROMPT` + `{{WEB_TOOLS}}` + `systemPrompt(backend)`) | exact |
| `method/*.md` (canonical source, new) | new | content | transform | `plugin/skills/teach/SKILL.md`, `server/src/prompt.ts` `PROMPT` | role-match |
| `scripts/render-method.mjs` + `scripts/check-method.mjs` (new) | new | script | file-I/O | `scripts/doctor.mjs` | exact |
| `plugin/commands/learn.md` / `review.md` (generated frontmatter) | modified | config | transform | `plugin/commands/learn.md` frontmatter | exact |
| `codex/skills/derive-{learn,review}/SKILL.md` (new) | new | content | transform | `plugin/skills/teach/SKILL.md` | exact |
| `server/test/wire-surface.test.ts` + `wire-surface.json` (new) | new | test | batch | `server/test/reply.test.ts` (import-order trick) | role-match |
| `server/test/mcp.test.ts` (stdio smoke, new) | new | test | streaming | `server/test/api.test.ts` (spawn-server harness) | role-match |
| `web/vite.config.ts` (token header on proxy) | modified | config | request-response | itself | exact |
| `.github/workflows/ci.yml` (drift + snapshot + smoke steps) | modified | config | batch | itself (`Test` / `Doctor script runs` steps) | exact |

---

## Pattern Assignments

### `server/src/tools.ts` — the 22-tool registry (D-05, D-07, D-08)

**Analog:** `server/src/tools.ts` (all 23 lines, read in full) + `server/src/agent.ts` lines 49-120.

Today the contract is spread across four places. The registry keeps the file's existing shape — a flat `as const` list plus a `Record<string, string>` label map — and adds the schema and description per entry.

**What exists now** (`server/src/tools.ts` lines 1-8):
```typescript
/** The tutor's tool names and the status line each one shows the learner while it runs. Shared by both backends. */

export const DERIVE_TOOL_NAMES = [
  'quiz', 'ask', 'set_plan', 'node_status', 'set_phase', 'explain_back', 'remember', 'set_preferences', 'read_material', 'search_material',
  'search_library', 'read_resource', 'suggest_resource', 'add_resource',
] as const;

export const TOOL_LABELS: Record<string, string> = { quiz: 'Writing a question', /* ... */ };
```

**Schema + description pattern to fold in** — `server/src/agent.ts` lines 49-56 (`nodeSchema`) and 84-97 (`quiz`). Note the `.describe()` on every field; these strings are the model-facing docs and go into the D-08 snapshot verbatim:
```typescript
export const nodeSchema = z.object({
  id: z.string().describe('Short stable id, e.g. "packets".'),
  label: z.string().describe('The claim in plain words a learner reads at a glance, 3 to 7 words, ...'),
  kind: z.enum(['truth', 'derived', 'goal']),
  summary: z.string().describe('One full sentence stating the claim this node stands for. ...'),
  depends_on: z.array(z.string()).optional().describe('Ids of the nodes this one is derived from. Empty for roots.'),
});
```
```typescript
  const quiz = tool(
    'quiz',
    TOOL_DESCRIPTIONS.quiz,
    {
      question: z.string().describe('The question, markdown with $LaTeX$ allowed. Do not restate it in prose.'),
      options: z.array(z.string()).min(2).max(3).describe('2 or 3 bare claims, no justification. The app adds "I don\'t know" itself.'),
      correct: z.array(z.number().int().min(0)).min(1).describe('0-based indices of the correct option(s). Usually exactly one.'),
      ...
    },
    async (a) => text(await actions.quiz(lessonId, a)),
  );
```
`agent.ts` uses a **raw shape object** (not `z.object(...)`) as the third arg to `tool()`. `mcp.ts` `registerTool` uses the same raw-shape form under `inputSchema`. A registry entry carrying `shape: z.ZodRawShape` therefore feeds both surfaces unchanged; `z.object(shape)` gives the `safeParse` for D-06 and the JSON-Schema projection for the snapshot.

**MCP-only tool descriptions** — `server/src/mcp.ts` lines 173-196 (`start_lesson`) and 226-238 (`attach_material`); same `description` + `inputSchema` raw shape:
```typescript
server.registerTool(
  'attach_material',
  {
    description: 'Attach course material to the current lesson: local .pdf, .pptx, ...',
    inputSchema: { files: z.array(z.string()).min(1).describe('Paths or URLs. A folder with a .git or a package manifest is imported as a repository.') },
  },
  async ({ files }) => { ... },
);
```

**Surface marking:** follow the `as const` + `typeof` idiom already used for `DERIVE_TOOL_NAMES` and `RESOURCE_KINDS` (`library.ts`) / `QUIZ_TESTS` (`db.ts`) so the surface union is a type, not a string.

**Consumers that must read the registry instead of declaring:** `agent.ts` `buildTools` (line 83), `agent.ts` line ~236 `tools: [quiz, ask, ...]` array, `codex.ts` `enabled_tools: [...DERIVE_TOOL_NAMES]` (line ~50), `mcp.ts` every `registerTool`, `index.ts` `switch (action)` (line 654), `plugin/commands/*.md` frontmatter.

---

### `server/src/index.ts` — strict action validation (D-06)

**Analog:** `server/src/index.ts` lines 643-680, the current hand-rolled checks that the zod `safeParse` replaces.

**Current shape** (lines 643-660) — note the `as unknown as` casts and the manual enum checks:
```typescript
app.post('/api/external/lessons/:id/:action', async (c) => {
  const id = c.req.param('id');
  const action = c.req.param('action');
  const lesson = getLesson(id);
  if (!lesson) return c.json({ error: 'not found' }, 404);
  const a = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const terminal = a.answer_in === 'terminal' || (a.answer_in !== 'browser' && lesson.answer_in === 'terminal');
  try {
    ...
    switch (action) {
      case 'quiz': {
        const args = a as unknown as actions.QuizArgs;
        if (args.purpose != null && !actions.QUIZ_PURPOSES.includes(args.purpose)) return c.json({ error: `purpose must be one of ${actions.QUIZ_PURPOSES.join(', ')}` }, 400);
        if (args.tests != null && !actions.QUIZ_TESTS.includes(args.tests)) return c.json({ error: `tests must be one of ${actions.QUIZ_TESTS.join(', ')}` }, 400);
```

**Where the new `safeParse` goes:** immediately after the `const a = ...` line and **before** the held-card 409 check and the `teachingGap` gate, so method refusals (`Teach first`, `{ refused: true }`) and `api.test.ts` assertions are untouched (D-06). Error message style must match the rest of the file — lowercase sentence, `c.json({ error }, 400)`:
```typescript
if (gap) return c.json({ error: gap }, 400);
if (!Array.isArray(args.options) || args.options.length < 2 || ...) return c.json({ error: 'quiz needs 2 or 3 options and at least one correct index' }, 400);
```
Keep the `answer_in` / `already_held` keys accepted (they are read off `a` outside the tool schema).

---

### `server/src/index.ts` — hardening (D-09, D-12) and `busy()` (D-15)

**Analog:** the same file.

**CORS today** (line 64) — becomes an Origin allowlist:
```typescript
app.use('/api/*', cors({ origin: '*', allowHeaders: ['content-type', 'x-derive-learner'] }));
```
Add `x-derive-token` to `allowHeaders` when the token lands.

**Serve + startup log today** (lines 835-838) — the hostname arg and the loud `DERIVE_HOST=0.0.0.0` warning go here; keep the two-line startup log format:
```typescript
serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`derive server on http://localhost:${info.port}${existsSync(distDir) ? '' : ' (API only; run the web dev server too)'}`);
  console.log(`tutor runs on ${backend() === 'codex' ? 'Codex (your ChatGPT login)' : 'Claude (your Claude Code login)'}${backendSource() === 'auto' ? ', picked automatically; set DERIVE_BACKEND to choose' : ''}`);
});
```

**Static + index.html today** (lines 828-832) — the token injection point of D-09 is the `c.html(readFileSync(...))` line, which is also where the `process.cwd()` fragility lives:
```typescript
const here = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(here, '../../web/dist');
if (existsSync(distDir)) {
  const relRoot = distDir.startsWith(process.cwd()) ? distDir.slice(process.cwd().length + 1) : distDir;
  app.use('/*', serveStatic({ root: relRoot }));
  app.get('*', (c) => c.html(readFileSync(join(distDir, 'index.html'), 'utf8')));
}
```

**Health route** (line 97) — the `'0.4.0'` literal is one of the six to replace with `VERSION` from `config.ts`; keep the route unauthenticated (doctor + `api.test.ts` poll it):
```typescript
app.get('/api/health', (c) => c.json({ ok: true, version: '0.4.0', backend: backend(), backend_source: backendSource() }));
```

**`busy()` today** (lines 77-85) — this full-event scan per lesson is what the `turns` table replaces:
```typescript
const busy = (id: string) => {
  if (isBusy(id)) return true;
  const lesson = getLesson(id);
  if (lesson?.mode !== 'external') return false;
  if (hasPending(id)) return true;
  const events = listEvents(id);
  const last = [...events].reverse().find((e) => e.type === 'turn_start' || e.type === 'turn_end');
  return last?.type === 'turn_start';
};
```
**Boot restart-recovery loop** (lines 53-61) — same scan across every lesson, same replacement:
```typescript
for (const l of listLessons()) {
  const events = listEvents(l.id);
  const last = [...events].reverse().find((e) => e.type === 'turn_start' || e.type === 'turn_end');
  if (l.mode === 'agent' && last?.type === 'turn_start') emit(l.id, 'turn_end', { ok: true, interrupted: true, reason: 'server restarted' });
}
```
Keep emitting `turn_end` — the browser reducer still needs the event; only the *read* moves to `turns`.

**Auth middleware placement:** register it with the same `app.use('/api/*', ...)` form as `cors`, before the routes. Exempt `/api/health`. `learnerOf` (lines 71-75) is the model for a small documented `const` helper reading a header with a fallback.

---

### `server/src/config.ts` — version + new env (single-source)

**Analog:** the whole file (23 lines, read in full). Every constant is `export const`, env read exactly once, each with a one-line `/** */`:
```typescript
export const PORT = Number(process.env.PORT ?? 4310);
export const DATA_DIR = resolve(process.env.DERIVE_DATA_DIR ?? join(homedir(), '.derive'));
export const DB_PATH = join(DATA_DIR, 'derive.db');
/** Optional model override. Leave unset to use the backend's own default ... */
export const MODEL = process.env.DERIVE_MODEL || undefined;
```
Add `VERSION` (read from `server/package.json` — use `createRequire` as `backend.ts` already does, since `import ... with { type: 'json' }` would change the build output), `DERIVE_HOST`, `DERIVE_ORIGINS`, `TOKEN_PATH = join(DATA_DIR, 'token')`. Six literals to replace: root `package.json` `0.1.0`, `server/package.json` `0.1.0`, `plugin/.claude-plugin/plugin.json` `0.4.0`, `index.ts:97` `'0.4.0'`, `agent.ts` `version: '0.2.0'` + `CLAUDE_AGENT_SDK_CLIENT_APP: 'derive/0.2.0'`, `library.ts` `USER_AGENT` `Derive/0.3`.

---

### `server/src/migrations.ts` (new, model/schema, batch)

**Analog:** `server/src/db.ts` lines 1-137 — the block being folded into migration 1.

**Import-time position is load-bearing** (lines 7-12); the runner must execute in exactly this slot, before the `q` prepared-statement object at line 213:
```typescript
mkdirSync(dirname(DB_PATH), { recursive: true });
mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS lessons ( id TEXT PRIMARY KEY, topic TEXT NOT NULL, ... );
  ...
`);
```

**The ALTER list to fold in** (lines 107-135) — the try/catch idiom and the *why* comments must survive into the baseline migration:
```typescript
/** Columns added after the first release; SQLite has no ADD COLUMN IF NOT EXISTS. */
for (const ddl of [
  "ALTER TABLE lessons ADD COLUMN mode TEXT NOT NULL DEFAULT 'agent'",
  "ALTER TABLE lessons ADD COLUMN learner_id TEXT NOT NULL DEFAULT 'default'",
  // Memory state per node (FSRS), and where a review copy comes from.
  'ALTER TABLE nodes ADD COLUMN stability REAL',
  ...
]) {
  try {
    db.exec(ddl);
  } catch {
    /* column exists */
  }
}
db.exec('CREATE INDEX IF NOT EXISTS lessons_learner ON lessons (learner_id)');
db.exec('CREATE INDEX IF NOT EXISTS quiz_results_node ON quiz_results (lesson_id, node_id)');
```
Baseline must land an existing `~/.derive/derive.db` on the same schema as a fresh one: keep `CREATE TABLE IF NOT EXISTS` + the try/catch ALTERs inside migration 1, then `PRAGMA user_version = 1`. New `turns`/`usage` tables are migration 2+, plain `CREATE TABLE` (no `IF NOT EXISTS` needed once versioned).

**Module doc prose** — every server module opens with one; `server/src/backend.ts` lines 1-8 is the model:
```typescript
/**
 * Which tutor backend to run, and where its pieces are.
 *
 * Derive runs on a subscription, not an API key: the Claude Agent SDK on a
 * Claude Code login, or the Codex SDK on a ChatGPT login. ...
 */
```

---

### `server/src/db.ts` — `withTx`, `turns`, `usage` (D-13..D-16)

**Analog:** the same file.

**Prepared-statement pattern** (lines 213-225) — every new query goes in the `q` object, named verb-first:
```typescript
const q = {
  insertLesson: db.prepare('INSERT INTO lessons (id, topic, mode, learner_id, answer_in, driver, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
  lastExternal: db.prepare("SELECT * FROM lessons WHERE mode = 'external' ORDER BY created_at DESC LIMIT 1"),
  setAnswerIn: db.prepare('UPDATE lessons SET answer_in = ?, updated_at = ? WHERE id = ?'),
  ...
};
```

**The two functions that must become transactional** — `deleteLesson` (lines 455-463), seven statements with no transaction:
```typescript
export function deleteLesson(id: string) {
  q.deleteMaterialsByLesson.run(id);
  q.deleteMemoryByLesson.run(id);
  q.deleteMisByLesson.run(id);
  q.deleteQuiz.run(id);
  q.deleteNodes.run(id);
  q.deleteEvents.run(id);
  q.deleteLesson.run(id);
}
```
`replaceGraph` (lines 505-514) — note the ad-hoc `db.prepare(...)` inside the loop, worth hoisting into `q` while wrapping:
```typescript
export function replaceGraph(lessonId: string, nodes: GraphNodeInput[]) {
  const existing = new Map(listNodes(lessonId).map((n) => [n.node_id, n]));
  const keep = new Set(nodes.map((n) => n.id));
  for (const id of existing.keys()) {
    if (!keep.has(id)) db.prepare('DELETE FROM nodes WHERE lesson_id = ? AND node_id = ?').run(lessonId, id);
  }
  for (const n of nodes) {
    q.upsertNode.run(lessonId, n.id, n.label, n.kind, n.summary ?? null, JSON.stringify(n.depends_on ?? []));
  }
}
```
`deleteLearner` (lines 421-426) calls `deleteLesson` in a loop — `withTx` must not nest a second `BEGIN`; guard with a depth counter or a `db.isTransaction`-style check.

**Type and constant conventions for the new tables** — `db.ts` lines 217-224:
```typescript
/**
 * What a question is for. 'probe' maps the learner before the plan, ...
 */
export type QuizPurpose = 'probe' | 'pretest' | 'check' | 'cumulative' | 'review';
export const QUIZ_TESTS: QuizTests[] = ['intuition', 'procedure', 'transfer'];
```
Apply to `type CostSource = 'provider' | 'table' | 'subscription' | 'unknown'` (D-16). Row types are `XxxRow` (`TurnRow`, `UsageRow`) with snake_case columns preserved.

---

### `server/src/driver.ts` + `drivers/fake.ts` (new, service, streaming)

**Analog for the interface + resolution:** `server/src/backend.ts` (module doc above; `backend()` resolution cached in a module-level `resolved`).
**Analog for the sink vocabulary:** `server/src/events.ts` — read in full, 47 lines. The sink is exactly these five functions, no new event types (D-14 depends on this):
```typescript
export function emit(lessonId: string, type: string, payload: unknown): StoredEvent { ... }
export function emitUpdate(lessonId: string, seq: number, type: string, payload: unknown): StoredEvent { ... }
export function checkpoint(lessonId: string, seq: number, payload: unknown) { ... }
export function emitEphemeral(lessonId: string, type: string, payload: unknown) { ... }
export function subscribe(lessonId: string, l: Listener): () => void { ... }
```

**The `Active` handle that both drivers already register** (`server/src/codex.ts` line 21) — this is the existing half of the seam:
```typescript
export type Active = { interrupt: () => Promise<void> };
```

**The dispatch to generalise** (`server/src/agent.ts` lines 241-260) — today an `if (backend() === 'codex')` branch inside `runTurn`; the seam replaces the branch, not the surrounding bookkeeping:
```typescript
export async function runTurn(lessonId: string, prompt: string, opts: { echoUser?: string } = {}) {
  const lesson = getLesson(lessonId);
  if (!lesson) throw new Error('lesson not found');
  if (active.has(lessonId)) throw new Error('lesson is busy');

  if (opts.echoUser) emit(lessonId, 'user', { text: opts.echoUser });
  emit(lessonId, 'turn_start', {});

  const pendingNotices = takeNotices(lessonId);
  if (pendingNotices.length) prompt = `${pendingNotices.join('\n\n')}\n\nThen, the learner's message:\n${prompt}`;

  const instructions = systemPrompt(backend()) + materialsSection(lessonId) + librarySection(lesson.learner_id, lesson.topic) + learnerProfile(lesson.learner_id, lessonId);
  if (backend() === 'codex') {
    try {
      await runCodexTurn(lessonId, prompt, instructions, active, stopping);
    } finally {
      active.delete(lessonId);
      stopping.delete(lessonId);
      cancelPending(lessonId);
    }
    return;
  }
```
`ctx` is the argument set already threaded through: `{ lessonId, prompt, instructions, model, effort, sessionId }`. The `setSessionId` callback and the `endTurn` idempotency guard are per-driver:
```typescript
  let ended = false;
  const endTurn = (payload: Record<string, unknown>) => {
    if (ended) return;
    ended = true;
    emit(lessonId, 'turn_end', payload);
  };
```
Module-level state stays in `agent.ts` (`active`, `stopping`) per CONVENTIONS — it is deliberate and documented (lines 22-26).

**`fake` driver module shape:** `server/src/notices.ts` (17 lines, read in full) is the template for a small, fully documented module with module-level state and two exported functions. The fake scripts a sequence of sink calls and resolves; no SDK import.

---

### `server/src/secrets.ts` / `redact()` (new, utility, transform) — D-11

**Analog:** `server/src/notices.ts` — module-level registry with a prose doc block, two verbs:
```typescript
/**
 * Things that happened while the tutor was mid-turn or idle and that it must
 * hear about at its next chance: material attached while a card was pending, ...
 */
const notices = new Map<string, string[]>();

export function addNotice(lessonId: string, text: string) { ... }
export function takeNotices(lessonId: string): string[] { ... }
```
Mirror as `registerSecret(value)` / `redact(text)` / `redactErrors(text)` (the pattern backstop, errors and logs only).

**Egress chokepoints to wire:**
- `server/src/events.ts` `emit`/`emitUpdate`/`emitEphemeral` — exact-match only, no pattern backstop (a lesson about API keys must survive).
- `server/src/export.ts` `renderMarkdown` (line 69), `exportToVault` (line 180), `mirrorToVault` (line 197) — exact-match only.
- `server/src/index.ts` error responses — the existing `e instanceof Error ? e.message : String(e)` narrowing sites; pattern backstop applies here.
- Console lines — the `[tag]` convention: `console.error('[turn]', e)`, `console.warn('[codex] ...')`.

---

### `server/src/library.ts` + `server/src/repo.ts` — SSRF and path guards (D-10)

**Analog / hook point:** `server/src/library.ts` line 217, the single `get()` through which every library fetch passes. The host check goes at the top and re-runs per redirect (which means replacing `redirect: 'follow'` with a manual loop):
```typescript
async function get(url: string, accept: string, maxBytes: number): Promise<{ type: string; buf: Buffer; url: string }> {
  const res = await fetch(url, { headers: { 'user-agent': USER_AGENT, accept, 'accept-language': 'en, *;q=0.5' }, redirect: 'follow', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const len = Number(res.headers.get('content-length') ?? 0);
  if (len > maxBytes) throw new Error(`larger than ${Math.round(maxBytes / 1024 / 1024)} MB`);
  ...
}
```
Error-message style to match: lowercase, no code, `larger than 6 MB`. `normalizeUrl` (line 46) is where a scheme allowlist belongs. `fetchVideo` (line 233) and `fetchPage` (line 281) both route through `get`, so one guard covers them.

**Repo root check** (`server/src/repo.ts` lines 131-135) — the `~`/`/` refusal and the deny-list go here and in `walk`:
```typescript
export function fromDirectory(rawPath: string): RepoSource {
  const dir = expandHome(rawPath);
  const st = statSync(dir, { throwIfNoEntry: false });
  if (!st?.isDirectory()) throw new Error(`Not a directory: ${rawPath}`);
  const all = (gitListFiles(dir) ?? walk(dir)).filter((p) => !inSkippedDir(p) && isTextName(p));
```
The existing `.filter((p) => !inSkippedDir(p) && isTextName(p))` is the exact slot for a `!isSecretName(p)` conjunct.

**`https://` restriction** (`server/src/repo.ts` lines 232-236) — note `fromGitClone` shells out with the URL, so the scheme check must precede `execFileSync`:
```typescript
function fromGitClone(url: string): RepoSource {
  const tmp = mkdtempSync(join(DATA_DIR, 'clone-'));
  try {
    execFileSync('git', ['clone', '--depth', '1', '--quiet', url, tmp], { stdio: ['ignore', 'ignore', 'pipe'], timeout: 120_000 });
```

---

### `method/*.md` + render script (D-01..D-04)

**Analog for the canonical prose:** `server/src/prompt.ts` — the `PROMPT` template is the spine (D-03). Its structure is already section-per-heading, which is the split the `method/` directory takes:
```
# The philosophy (internalize it)
## Principle i: unconditional truths first
## Principle ii: "How could I have discovered this?"
# Your tools
# Writing quiz options (construction procedure, every time)
```

**The placeholder mechanism to generalise** (`prompt.ts` line 39 and 106-108):
```typescript
- {{WEB_TOOLS}}: verify. Accuracy is non-negotiable; the moment you are even slightly unsure of a fact, formula, name or date, check it before teaching it. ...
```
```typescript
export function systemPrompt(backend: 'claude' | 'codex'): string {
  const web = ...;
  return PROMPT.replace('{{WEB_TOOLS}}', web);
}
```
D-02's per-surface preamble is exactly this, one level up: shared body + `.replace()` of tool-naming tokens. Keep `warmupBrief`, `firstTurnPrompt`, `materialAttachedPrompt`, `reviewTurnPrompt` (lines 116-175) where they are — they are turn prompts, not method text.

**Rules to fold in from the other copies (D-03):** `plugin/skills/teach/SKILL.md` ("Warm-up first", "The cumulative quiz", "Do not let them be lazy"); `plugin/commands/learn.md` steps 4-6 (read above — "A bare sequence of quizzes with one-line remarks between them is a failed lesson", "Never end your turn in the teach phase without a card pending").

**Generated frontmatter target** (`plugin/commands/learn.md` lines 1-5) — the 21-name list the registry emits (21, not 22: `library` is excluded from the command allow-list):
```yaml
---
description: Learn a topic from first principles with Derive (probe -> plan -> teach, rendered live in the browser)
argument-hint: <topic you want to actually understand> [paths to course slides, PDFs, notes, a repo folder or a GitHub URL] [--terminal] [--learner <name>]
allowed-tools: mcp__plugin_derive_derive__start_lesson, mcp__plugin_derive_derive__attach_material, ..., WebSearch, WebFetch, Skill
---
```
`WebSearch, WebFetch, Skill` are not registry tools — the render step appends them as a fixed tail.

**Script pattern:** `scripts/doctor.mjs` lines 1-18 — `.mjs`, shebang, prose doc block, collector functions, no dependencies:
```javascript
#!/usr/bin/env node
/**
 * `pnpm check`: checks everything Derive needs before the first lesson, and
 * says what to do about each thing it finds missing. Read-only.
 */
import { execFileSync } from 'node:child_process';
...
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const results = [];
const ok = (name, detail) => results.push({ level: 'ok', name, detail });
const fail = (name, detail, fix) => results.push({ level: 'fail', name, detail, fix });
```
`scripts/` has no `package.json` and is not a workspace package — scripts must run on bare Node with zero imports outside `node:*`. The render script therefore cannot import `server/src/tools.ts` directly; run it through `tsx` from the `server` package, or render from `server/dist`.

---

### Tests (FOUND-04)

**Analog for the MCP smoke test:** `server/test/api.test.ts` lines 1-70 — the spawn-a-built-server-on-a-random-port harness, read in full above. Key excerpt:
```typescript
before(async () => {
  assert.ok(existsSync(entry), `build first: ${entry} is missing`);
  dataDir = mkdtempSync(join(tmpdir(), 'derive-api-'));
  const port = 4400 + Math.floor(Math.random() * 500);
  base = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, [entry], { env: { ...process.env, PORT: String(port), DERIVE_DATA_DIR: dataDir, DERIVE_BACKEND: 'claude' }, stdio: ['ignore', 'pipe', 'pipe'] });
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${base}/api/health`);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('server did not start');
});

after(() => {
  server?.kill();
  if (dataDir) rmSync(dataDir, { recursive: true, force: true });
});
```
The MCP smoke test spawns `server/dist/mcp.js` the same way with `DERIVE_URL` pointed at the scratch server, and speaks JSON-RPC over stdin/stdout. It must set the token env for the hardened server.

**Helper style to copy** (`api.test.ts` lines 30-46) — short `const` arrows, terminal-answered cards so no model is needed, `teachProse` for the 240-char `teachingGap`:
```typescript
const act = (lesson: string, action: string, body: unknown) => api(`/api/external/lessons/${lesson}/${action}`, body);
/** Open a terminal card and answer it in one go, returning the graded result. */
const askAndAnswer = async (lesson: string, quiz: Record<string, unknown>, reply: string) => {
  const opened = await act(lesson, 'quiz', quiz);
  assert.equal(opened.status, 200, JSON.stringify(opened.json));
  assert.equal(opened.json.status, 'pending');
  const answered = await act(lesson, 'answer', { reply });
  ...
};
const teachProse = (lesson: string, node: string) =>
  act(lesson, 'mirror', { role: 'assistant', text: `Teaching ${node}. `.repeat(30), uid: `${node}-prose` });
```

**Analog for the wire-surface snapshot test:** `server/test/reply.test.ts` — the import-order trick, mandatory for any test that imports a module transitively pulling in `db.ts` (which opens SQLite at import time): set `process.env.DERIVE_DATA_DIR` to a `mkdtempSync` dir *before* a dynamic `await import(...)`. The registry module itself should be import-side-effect-free so the snapshot test can skip this.

**CI step pattern** (`.github/workflows/ci.yml`) — add drift/snapshot/smoke as siblings of these, after Build:
```yaml
      - name: Test
        run: pnpm test
        env:
          CI: 'true'

      - name: Doctor script runs
        run: node scripts/doctor.mjs || true
```
Do **not** copy the `|| true` — the method drift check must fail CI (D-04).

---

### `web/vite.config.ts` — dev proxy token header (D-09)

**Analog:** the file itself (12 lines, read in full). The `proxy` object gains `headers`; the token is read at config-evaluation time from `~/.derive/token`:
```typescript
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:4310', changeOrigin: true } },
  },
  build: { chunkSizeWarningLimit: 2000 },
});
```
Note: this is the one file in the repo with `export default` (`defineConfig`) — the named-exports-only rule does not apply here.

---

## Shared Patterns

### Module doc block
**Source:** `server/src/backend.ts` lines 1-8; `server/src/notices.ts` lines 1-6; `server/src/codex.ts` lines 1-11.
**Apply to:** every new server module (`driver.ts`, `migrations.ts`, `secrets.ts`, `drivers/fake.ts`).
Prose paragraphs, what it is for *and why*, never bullet lists.
```typescript
/**
 * The Codex backend: one lesson turn through the Codex SDK, on the
 * learner's ChatGPT login.
 *
 * Each turn is a `codex exec` run (resumed on the lesson's thread after the
 * first). The tutor's tools reach it as an MCP server: ...
 */
```

### Error handling
**Source:** `server/src/db.ts:422`, `server/src/index.ts` route handlers, `server/src/mcp.ts` `api()`.
**Apply to:** every new module.
Plain `Error`, lowercase human sentence the model or learner can read as-is:
```typescript
if (id === DEFAULT_LEARNER_ID) throw new Error('the first learner cannot be removed; rename it instead');
```
```typescript
if (!lesson) return c.json({ error: 'not found' }, 404);
```
Narrow every catch with `e instanceof Error ? e.message : String(e)`. Best-effort catches carry a one-word reason: `catch { /* column exists */ }`, `catch { /* not up yet */ }`.

### Import conventions
**Source:** `server/src/agent.ts` lines 1-15, `server/src/codex.ts` lines 12-19.
**Apply to:** all new server files.
`node:` builtins first, then packages, then local with the `.js` extension, alphabetical:
```typescript
import { randomUUID } from 'node:crypto';
import { createSdkMcpServer, query, tool, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import * as actions from './actions.js';
import { backend } from './backend.js';
import { DATA_DIR, EFFORT, MODEL } from './config.js';
import { getLesson, learnerProfile, setSessionId, type GraphNodeInput } from './db.js';
```
Inline `type` modifiers, never a separate `import type` line on the server.

### Logging
**Source:** `server/src/index.ts:836-837`, `agent.ts` `console.error('[turn]', e)`.
**Apply to:** the startup warning of D-12, migration failures, token-file failures.
`[tag]`-prefixed, failures and startup facts only, never per-request.

### Config constants
**Source:** `server/src/config.ts` (whole file).
**Apply to:** every new env variable. Read `process.env` only here, one `/** */` line each, `resolve()` paths, `|| undefined` for optional strings.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `server/test/wire-surface.json` | fixture | batch | No committed JSON fixture exists in the repo; the three test files assert inline. Shape is defined by D-08 (name, description, JSON-Schema input) rather than by precedent. |
| `codex/skills/derive-{learn,review}/SKILL.md` | content | transform | No `SKILL.md` body exists under `codex/` today (only the 8-line `agents/openai.yaml` manifests). Structure comes from `plugin/skills/teach/SKILL.md` as the nearest template, but the Codex skill frontmatter has no precedent in-repo. |

## Metadata

**Analog search scope:** `server/src/` (19 files), `server/test/` (3 files), `scripts/`, `plugin/`, `codex/`, `web/`, `.github/workflows/`
**Files scanned:** 24; read or targeted-read: 20
**Pattern extraction date:** 2026-09-17
