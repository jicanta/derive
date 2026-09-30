# Phase 2: Settings and Secrets - Pattern Map

**Mapped:** 2026-09-30
**Files analyzed:** 22 (5 new server modules, 1 new test, 2 new web files, 14 modified)
**Analogs found:** 20 / 22 (2 files have only a partial analog; see "No Analog Found")

All analog paths below are git-tracked source (verified with `git ls-files`). Line numbers are from the working tree at mapping time.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `server/src/providers.ts` (NEW) | config / catalogue | static data | `server/src/tools.ts` (registry-of-specs module) + `web/src/lib/prefs.ts` (id/label/hint list) | role-match |
| `server/src/keys.ts` (NEW) | service (secrets file) | file-I/O | `server/src/credentials.ts` | exact |
| `server/src/settings.ts` (NEW) | service (table accessors + resolver) | CRUD + resolve | `server/src/db.ts` learners/turns accessors + `server/src/backend.ts` `backend()` | exact (accessors) / role-match (resolver) |
| `server/src/probe.ts` (NEW) | service (outbound HTTP adapters) | request-response | `server/src/library.ts` fetch loop (l.323-348) + `server/src/codex.ts` `friendly` (l.157-172) + `server/src/backend.ts` `claudeLoggedIn` | role-match |
| `server/src/migrations.ts` (MOD, +migration 5) | migration | DDL | same file, `turns` entry (l.180-198) | exact |
| `server/src/config.ts` (MOD, +key env constants) | config | env read | same file (l.32-48) | exact |
| `server/src/backend.ts` (MOD, drop memo) | service | — | same file (l.59-73 is what is removed) | exact |
| `server/src/agent.ts` (MOD, `runTurn`) | orchestration | request-response | same file (l.263-308) | exact |
| `server/src/index.ts` (MOD, `// ---------- settings ----------` routes, `/api/health`, `lessonView`, startup line) | controller | request-response | same file: learners routes (l.286-325), `err` helper (l.568), external `turn_start` (l.704, 728), health (l.278) | exact |
| `server/src/db.ts` (MOD, `clearSessionId`, `LearnerPrefs.model`, `cleanPrefs`) | model | CRUD | same file (l.258-275 `cleanPrefs`, l.422-424 `setSessionId`) | exact |
| `server/src/mcp.ts` (MOD, `start_lesson`) | driver / proxy | request-response | same file (l.220-249) | exact |
| `server/test/settings.test.ts` (NEW) | test | HTTP + module-level | `server/test/api.test.ts` (l.1-60) + `server/test/usage.test.ts` (l.23-53) + `server/test/credentials.test.ts` (l.27-50) | exact |
| `scripts/doctor.mjs` (MOD, secrets file line) | script | file stat | same file token block (l.73-83) | exact |
| `.env.example` (MOD) | config docs | — | same file | exact |
| `web/src/pages/Settings.tsx` (NEW) | page | request-response, per-field save | `web/src/pages/You.tsx` | exact |
| `web/src/components/ProviderRow.tsx` (NEW) | component | request-response | `web/src/pages/You.tsx` (`Section`, `Choices`, save-tick) + `web/src/components/LearnerMenu.tsx` (inline form, error line) | role-match |
| `web/src/pages/You.tsx` (MOD, model override field) | page | request-response | same file (`Section n="06"`, l.127-129) | exact |
| `web/src/pages/Lesson.tsx` (MOD, header pill) | page | event-driven | same file, companion pill (l.114-128) | exact |
| `web/src/pages/Home.tsx` (MOD, nav link) | page | — | same file nav (l.102-108) | exact |
| `web/src/components/LearnerMenu.tsx` (MOD, settings link) | component | — | same file `/you` link (l.176-182) | exact |
| `web/src/main.tsx` (MOD, route) | router | — | same file | exact |
| `web/src/lib/api.ts`, `web/src/lib/types.ts`, `web/src/lib/useLesson.ts`, `web/src/lib/prefs.ts` (MOD) | client / types / store | request-response, event-driven | same files (`api.ts` l.53-64, `useLesson.ts` l.70-71, `prefs.ts` l.17-26) | exact |

## Pattern Assignments

### `server/src/keys.ts` (service, file-I/O)

**Analog:** `server/src/credentials.ts` — the 0600, read-live, cached, `registerSecret`-on-load module. Copy its shape; only the "absent file" semantics differ (absent secrets file = no keys, not an error; RESEARCH.md Pattern 3).

**Module header pattern** (l.1-36): a `/** ... */` prose block explaining *why* the read is live and cached, and what the trust boundary is. Write the same kind of header for `keys.ts` (why 0600 plaintext, why an absent file is the fresh state, why a parse failure is loud and never overwrites).

**Imports pattern** (l.37-40):
```typescript
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { TOKEN_PATH } from './config.js';
import { registerSecret } from './secrets.js';
```
For `keys.ts`: `import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'; import { join } from 'node:path'; import { DATA_DIR } from './config.js'; import { registerSecret } from './secrets.js';`. Add `export const SECRETS_PATH = join(DATA_DIR, 'secrets.json');` (or put it in `config.ts` beside `TOKEN_PATH` l.20 — either is consistent; `TOKEN_PATH` lives in config).

**Cache constant + doc pattern** (l.42-50):
```typescript
export const TOKEN_CACHE_MS = 1_000;
```

**Module state pattern** (l.92-93):
```typescript
/** The last read and when it happened. Deliberate module state: this is the cache the window is about, and it is the one place a credential value lives between requests. */
let cache: (Credentials & { at: number }) | null = null;
```

**Core live-read + register pattern** (l.104-123):
```typescript
export function credentials(now = Date.now()): Credentials {
  if (cache && now >= cache.at && now - cache.at < TOKEN_CACHE_MS) return { token: cache.token, session: cache.session };

  let token = '';
  try {
    token = readFileSync(TOKEN_PATH, 'utf8').trim();
  } catch {
    /* deleted, or unreadable: every credential is refused until it is back */
  }
  ...
  if (token && (!cache || cache.token !== token)) {
    registerSecret(token);
    registerSecret(session);
  }

  cache = { token, session, at: now };
  return { token, session };
}
```
`keys.ts` `load(now = Date.now())` follows this exactly: `now` parameter with default so tests pin the clock (see `credentials.test.ts` l.41 `T0`), cache check first, read, `registerSecret` on every loaded value, set cache.

**0600 write pattern** (l.70-78):
```typescript
writeFileSync(TOKEN_PATH, randomBytes(32).toString('hex'), { mode: 0o600, flag: 'wx' });
```
For `keys.ts` the write is `writeFileSync(tmp, JSON.stringify(store, null, 2) + '\n', { mode: 0o600 }); renameSync(tmp, SECRETS_PATH); cache = null;` (tmp beside the target, `${SECRETS_PATH}.${process.pid}.tmp`).

**Error message pattern** (l.76, 83, 85): lowercase sentence naming the path and the fix: `` `could not read the derive token at ${TOKEN_PATH}: ${e instanceof Error ? e.message : String(e)}. Delete that file and start derive again to make a new one.` ``. For a parse failure in `keys.ts`, store `error = \`${SECRETS_PATH} could not be read: ...\`` and expose it via `secretsFileError()` for `GET /api/settings`.

**Test-only reset pattern** (l.152-155):
```typescript
/** Forget the cached read, so the next call goes to the file. Tests only — nothing in the server calls it. */
export function resetCredentialCache(): void {
  cache = null;
}
```
Export a `resetKeyCache()` the same way.

---

### `server/src/settings.ts` (service, CRUD + per-turn resolve)

**Analog A (table accessors):** `server/src/db.ts` — prepared statements in the `q` object and verb-vocabulary accessors.

**Prepared statement pattern** (`db.ts` l.90-101, l.139, l.164-170):
```typescript
const q = {
  ...
  getLearner: db.prepare('SELECT * FROM learners WHERE id = ?'),
  ...
  setLearnerPrefs: db.prepare('UPDATE learners SET prefs = ? WHERE id = ?'),
  ...
  setSession: db.prepare('UPDATE lessons SET session_id = ?, updated_at = ? WHERE id = ?'),
  ...
  lastTurn: db.prepare('SELECT * FROM turns WHERE lesson_id = ? ORDER BY started_at DESC, rowid DESC LIMIT 1'),
```
Add `getSetting`, `setSetting` (`INSERT ... ON CONFLICT(key) DO UPDATE`), `deleteSetting` statements. Whether they live in `db.ts`'s `q` (then re-exported by `settings.ts`) or in `settings.ts` importing the `db` handle is planner's call; `db.ts` owns the `db` handle today and every other table's statements, so adding them to `q` in `db.ts` and wrapping them in `settings.ts` is the lowest-friction fit.

**Accessor pattern** (`db.ts` l.422-424 and l.526-528):
```typescript
export function setSessionId(id: string, sessionId: string) {
  q.setSession.run(sessionId, Date.now(), id);
}
/** A lesson's most recent turn, in one indexed query. This is what "is this lesson busy" reads. */
export function lastTurn(lessonId: string): TurnRow | undefined {
  return q.lastTurn.get(lessonId) as TurnRow | undefined;
}
```
`clearSessionId(id)` in `db.ts` is `q.setSession.run(null, Date.now(), id)` — same statement, `null` value (the column is nullable, migrations.ts l.39).

**Transaction pattern** (`db.ts` l.230-240): `withTx(() => { ... })` — synchronous body only. Use when a write touches two settings keys at once (e.g. `active_provider` plus a default model).

**Analog B (resolver):** `server/src/backend.ts` l.59-73 — the memo being replaced. Keep the *decision order* (env, then logged-in Claude, then Codex, then Claude) and the `'claude' | 'codex'` `Backend` type; drop `resolved` module state.
```typescript
let resolved: Backend | undefined;
/** The backend this server runs lessons on. Decided once, at the first call. */
export function backend(): Backend {
  if (resolved) return resolved;
  if (BACKEND_SETTING) resolved = BACKEND_SETTING;
  else if (claudeLoggedIn()) resolved = 'claude';
  else if (codexLoggedIn()) resolved = 'codex';
  else resolved = 'claude';
  return resolved;
}
/** How the backend was chosen, for the startup line and /api/health. */
export function backendSource(): 'DERIVE_BACKEND' | 'auto' {
  return BACKEND_SETTING ? 'DERIVE_BACKEND' : 'auto';
}
```
The bounded detection memo (RESEARCH Pattern 2, 30 s) follows the `credentials.ts` cache pattern above (`{ provider, at }`, compared against `now`), with a `resetDetection()` export the detect route calls.

**Config import pattern** (`backend.ts` l.14): `import { BACKEND_SETTING, CODEX_BIN, CODEX_HOME, type Backend } from './config.js';` — the resolver reads env only through `config.ts` constants.

**Learner pref read for the per-learner override** (`db.ts` l.288-290): `getLearner(id)?.prefs.model`.

---

### `server/src/probe.ts` (service, outbound request-response)

**Analog A (outbound fetch with timeout, manual redirects):** `server/src/library.ts` l.334:
```typescript
const res = await fetch(current, { headers: { 'user-agent': USER_AGENT, accept, 'accept-language': 'en, *;q=0.5' }, redirect: 'manual', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
```
Copy `redirect: 'manual'` + `AbortSignal.timeout(...)` for every provider call (400 ms local probes, ~8 s remote). `library.ts` l.172 shows the error-sentence style for a refused host: `` throw new Error(`${host} is a private or local address, and derive only fetches public ones`) ``. Note: the SSRF check (`isPrivateAddress`, l.122) is deliberately *not* applied to the learner's own `openai-compatible` base URL or local-server ports (CONTEXT discretion note); catalogue hosts are fixed strings so need no check.

**Analog B (unwrap provider JSON error + fix hint):** `server/src/codex.ts` l.157-172:
```typescript
/** Codex's API errors arrive as JSON; the learner should read the sentence, not the envelope. */
function friendly(message: string): string {
  try {
    const parsed = JSON.parse(message) as { error?: { message?: string } };
    if (parsed?.error?.message) message = parsed.error.message;
  } catch {
    /* plain text */
  }
  if (/not supported when using Codex with a ChatGPT account|model.*not found/i.test(message)) {
    message += ' Set DERIVE_MODEL in .env (for example gpt-5.5), or change `model` in ~/.codex/config.toml.';
  }
  if (/login|unauthori[sz]ed|401|auth/i.test(message) && !/model/i.test(message)) {
    message += ' Run `pnpm exec codex login` in the derive folder and try again.';
  }
  return message.replace(/^Codex Exec exited with code \d+:\s*/, '').trim() || 'the Codex turn failed';
}
```
`probe.ts` generalises it into `providerSentence(status, text)` (also handling `error` as a plain string for Ollama, and `type:'error'` Anthropic envelopes) and a separate `hintFor(...)` returning `string | undefined` so the hint is a *separate field*, not appended to the verbatim sentence (D-14).

**Analog C (CLI/file detection):** `server/src/backend.ts` l.18-31:
```typescript
/** True when `claude auth status` says a Claude Code login is present. */
export function claudeLoggedIn(): boolean {
  try {
    const out = execFileSync('claude', ['auth', 'status'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 15000 });
    return !!(JSON.parse(out) as { loggedIn?: boolean }).loggedIn;
  } catch {
    return false;
  }
}
/** True when Codex has stored a login (ChatGPT or API key) in its home folder. */
export function codexLoggedIn(): boolean {
  return existsSync(join(CODEX_HOME, 'auth.json'));
}
```
Reuse both as-is from `backend.ts` (import, do not copy). For the detect route, an async `execFile` twin with the same args/timeout may be added so probes run in parallel (RESEARCH Pitfall 9); return only `loggedIn` (Pitfall 2).

**Redaction chokepoint** (`server/src/secrets.ts` l.111-112): every error leaving `probe.ts` toward a route goes through `safeMessage(e)`:
```typescript
export const safeMessage = (e: unknown): string => redactErrors(e instanceof Error ? e.message : String(e));
```

---

### `server/src/providers.ts` (catalogue, static data)

**Analog:** `server/src/tools.ts` l.1-60 (a typed registry declared once, consumed by several surfaces) and `web/src/lib/prefs.ts` l.3-14 (id/label/hint tuples).

**Module header** (`tools.ts` l.1-28): a prose `/** */` explaining that the registry exists so several consumers cannot drift. Write the same for the catalogue (resolver, routes, doctor, UI all read one list; `DEFAULTS_AS_OF` records when the model ids were last checked).

**Typed spec pattern** (`tools.ts` l.43-56):
```typescript
/** One tool, declared once for every surface it appears on. */
export type ToolSpec = {
  /** The name the model calls. */
  name: string;
  /** What the model reads to decide when to call it. Changing this changes what the tutor does. */
  description: string;
  ...
  /** The surfaces this tool is registered on. */
  surfaces: readonly ToolSurface[];
  /** The status line shown to the learner while it runs, for the tools that have one. */
  label?: string;
};
```
Mirror as `export type ProviderSpec = { id: ProviderId; label: string; auth: 'login' | 'key' | 'key+url' | 'none'; envKeys?: readonly string[]; defaultModel?: string; modelsUrl?: string; port?: number; teaches: boolean; note?: string }` with a one-line `/** */` per field. Export `PROVIDERS: readonly ProviderSpec[]`, `providerOf(id)`, and `DEFAULTS_AS_OF = '2026-09-30'` (set to implementation day).

**Id/label list pattern** (`prefs.ts` l.3-7):
```typescript
export const STYLES: { id: NonNullable<LearnerPrefs['style']>; label: string; hint: string }[] = [
  { id: 'adaptive', label: 'Adaptive', hint: 'Questions where you can reason it out, narration where you cannot. The tutor decides per step.' },
```
Same shape for each catalogue row; the browser must not hard-code provider facts — it renders what `GET /api/settings` returns.

---

### `server/src/migrations.ts` (migration 5)

**Analog:** same file, `turns` entry l.180-198:
```typescript
  {
    version: 2,
    name: 'turns',
    up(db) {
      db.exec(`
        CREATE TABLE turns (
          id TEXT PRIMARY KEY,
          ...
        );
        CREATE INDEX turns_lesson ON turns (lesson_id, started_at);
      `);
      backfillTurns(db);
    },
  },
```
Append `{ version: 5, name: 'settings', up(db) { db.exec(\`CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL);\`); } }` after the `usage-backfill` entry (l.230-236). Plain `CREATE TABLE` (no `IF NOT EXISTS`) past the baseline, per the header note l.22-26. `LATEST_VERSION` (l.339) is derived from the array; nothing else changes. `migrations.test.ts` converges fresh vs upgraded databases automatically.

---

### `server/src/config.ts` (env constants)

**Analog:** same file l.32-36, 45-48:
```typescript
/** Optional model override. Leave unset to use the backend's own default (your Claude Code or Codex default model). */
export const MODEL = process.env.DERIVE_MODEL || undefined;
...
/** A codex binary to use instead of the one bundled with the SDK. */
export const CODEX_BIN = process.env.DERIVE_CODEX_BIN || undefined;
```
Add one `|| undefined` constant per provider key variable with a one-line doc (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`/`GOOGLE_API_KEY` (Google wins), `OPENROUTER_API_KEY`, `OLLAMA_HOST`). `probe.ts`/`settings.ts` import these; they never read `process.env`.

---

### `server/src/agent.ts` (`runTurn`)

**Analog:** same file l.263-308 — the exact seam. Lines to change:
```typescript
  const driver = driverOverride() ?? (backend() === 'codex' ? codexDriver : claudeDriver);   // l.274
  const turnId = startTurn(lessonId, driver.name, MODEL);                                     // l.275
  emit(lessonId, 'turn_start', {});                                                            // l.276
  ...
  const instructions = systemPrompt(backend()) + materialsSection(lessonId) + ...;            // l.281
  ...
    model: MODEL,                                                                              // l.289
    effort: EFFORT,
    sessionId: lesson.session_id ?? null,                                                      // l.291
```
Replace with `const tutor = resolveTutor(lesson.learner_id)`, `backendOf(tutor.provider)`, `startTurn(lessonId, driver.name, tutor.model)`, `emit(lessonId, 'turn_start', { provider: tutor.provider, model: tutor.model })`, `model: tutor.model ?? undefined`, and insert the D-04 session clear before `startTurn`: `const last = lastTurn(lessonId); if (last && last.driver !== driver.name && lesson.session_id) clearSessionId(lessonId);` then read `sessionId: getLesson(lessonId)!.session_id ?? null`. `TurnContext.model` is `string | undefined` (`driver.ts` l.44-46); `sessionId` is `string | null` (l.48).

**Fire-and-forget / error pattern** (l.298-307) is unchanged: `sink.endTurn({ ok: false, error: safeMessage(err) })` in `catch`, idempotent `endTurn` in `finally`.

---

### `server/src/index.ts` (settings routes, health, lessonView, startup line)

**Analog:** same file. Add a `// ---------- settings ----------` section (separator style l.284, l.566).

**Imports pattern** (l.11-16, l.60): `import { z } from 'zod';` is already imported; add `settings.js`, `keys.js`, `probe.js`, `providers.js` named imports alphabetically among the local imports, and drop `backend, backendSource` from l.14 once replaced.

**Body parse + try/catch + `{ error }` pattern** (l.301-312):
```typescript
app.patch('/api/learners/:id', async (c) => {
  const id = c.req.param('id');
  if (!getLearner(id)) return c.json({ error: 'not found' }, 404);
  const body = (await c.req.json().catch(() => ({}))) as { name?: string; prefs?: Record<string, unknown> };
  try {
    if (body.name !== undefined) renameLearner(id, String(body.name));
    if (body.prefs && typeof body.prefs === 'object') updateLearnerPrefs(id, body.prefs);
    return c.json(getLearner(id));
  } catch (e) {
    return c.json({ error: safeMessage(e) }, 400);
  }
});
```
`PUT /api/settings/:provider` follows this: 404 for unknown provider, `.catch(() => ({}))` on the body, per-field `!== undefined` writes, 409 for env-locked fields, `safeMessage(e)` in the catch.

**Zod-on-body pattern** (l.837): `z.object(shapeFor(s, 'http'))` is the one zod body usage today; a `SettingsWrite = z.object({ key: z.string().trim().min(1).max(4096).optional(), model: ..., base_url: ... })` with `.describe()` on each field and `safeParse` is consistent with it.

**`err` helper** (l.568):
```typescript
const err = (c: Context, e: unknown, status: 400 | 404 | 422 | 500 = 400) => c.json({ error: safeMessage(e) }, status);
```
Widen the union to `400 | 404 | 409 | 422 | 500 | 502` for the models/test routes, or inline `c.json({ error: safeMessage(e) }, 502)`.

**Health route** (l.278):
```typescript
app.get('/api/health', (c) => c.json({ ok: true, version: VERSION, backend: backend(), backend_source: backendSource() }));
```
Becomes `const t = resolveTutor(); c.json({ ok: true, version: VERSION, backend: t.provider, model: t.model, source: t.source, backend_source: t.source })` (keep `ok`/`version`; `doctor.mjs` l.95 and `spawn.ts` l.88 read only those). `/api/stats` l.281 has a second `backend()` call to replace.

**`lessonView`** (l.270-274):
```typescript
const lessonView = (id: string) => {
  const lesson = getLesson(id);
  if (!lesson) return null;
  return { lesson, nodes: listNodes(id), materials: listMaterials(id), busy: busy(id), pending: hasPending(id) };
};
```
Add `turn: lastTurn(id) ?? null` (one indexed query; never call the resolver here — Pitfall 11).

**External `turn_start` payload** (l.704, l.728): `emit(lesson.id, 'turn_start', { source: driver });` — already carries the driver; the reducer maps `source` for the D-16 pill text. No server change needed on this path.

**Startup line** (l.1156):
```typescript
console.log(`tutor runs on ${backend() === 'codex' ? 'Codex (your ChatGPT login)' : 'Claude (your Claude Code login)'}${backendSource() === 'auto' ? ', picked automatically; set DERIVE_BACKEND to choose' : ''}`);
```
Rewrite with `resolveTutor()`: name `provider · model` and the source word (`environment` / `settings` / `detected`), and point to `/settings` instead of `DERIVE_BACKEND` when the source is `detected`.

**Learner scoping** (l.257-261): `learnerOf(c)` — use it only on `GET /api/settings/active?learner=` (Open Question 3); every other settings route is per install and takes no learner.

---

### `server/src/db.ts` (`clearSessionId`, `LearnerPrefs.model`)

**Analog:** same file. `cleanPrefs` l.258-272:
```typescript
export function cleanPrefs(input: unknown): LearnerPrefs {
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const str = (k: string) => (typeof o[k] === 'string' ? (o[k] as string).trim().slice(0, PREF_TEXT_MAX) : '');
  const out: LearnerPrefs = {};
  const language = str('language').slice(0, 60);
  if (language) out.language = language;
  ...
```
Add `const model = str('model').slice(0, 200); if (model && /^[A-Za-z0-9._:/-]+$/.test(model)) out.model = model;`. **Do not** add a line to `preferencesSection` (l.312-332) — the model is not a teaching preference (Pitfall 5). `updateLearnerPrefs` l.295-303 already merges arbitrary known keys, so `PATCH /api/learners/:id { prefs: { model } }` works unchanged.

---

### `server/src/mcp.ts` (`start_lesson`)

**Analog:** same file l.220-249. The `api()` proxy helper with `.catch` fallback is the pattern for the extra read (l.227):
```typescript
const profile = await api<{ profile: string; learner?: { name: string } }>(`/api/profile?learner=${encodeURIComponent(l.learner_id)}`).catch(() => ({ profile: '', learner: undefined }));
```
Add `const tutor = await api<{ provider: string; model: string | null }>(\`/api/settings/active?learner=${encodeURIComponent(l.learner_id)}\`).catch(() => null);` and two fields in the returned object (l.233-246) in the existing spread-conditional style: `tutor_running_this_lesson: DRIVER === 'codex' ? '...Codex CLI in this terminal, on its own model' : '...Claude Code in this terminal, on its own model'` and `...(tutor ? { app_tutor_setting: \`Derive's own tutor is set to ${tutor.provider} · ${tutor.model ?? 'default model'}\` } : {})`. `DRIVER` is l.47. `mcp.test.ts` asserts only `lesson_id`/`answer_in`.

---

### `server/test/settings.test.ts` (test, HTTP + module-level)

**Analog A (spawned server over HTTP):** `server/test/api.test.ts` l.10-60:
```typescript
import { startDeriveServer } from './spawn.js';
const here = dirname(fileURLToPath(import.meta.url));
const entry = resolve(here, '../dist/index.js');
let server: ChildProcess | undefined; let base = ''; let dataDir = ''; let token = '';
const api = async <T = Record<string, unknown>>(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<{ status: number; json: T }> => {
  const res = await fetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json', 'x-derive-token': token }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, json: (await res.json()) as T };
};
before(async () => {
  assert.ok(existsSync(entry), `build first: ${entry} is missing`);
  ({ child: server, base, dataDir } = await startDeriveServer(entry));
  token = readFileSync(join(dataDir, 'token'), 'utf8').trim();
});
after(() => { server?.kill(); if (dataDir) rmSync(dataDir, { recursive: true, force: true }); });
```
`startDeriveServer(entry, env, opts)` (`spawn.ts` l.55-59) merges `env` over `DERIVE_BACKEND: 'claude'` (l.71) — pass `{ DERIVE_BACKEND: '' }` so settings are not env-locked (Pitfall 3), and `{ OPENAI_API_KEY: '...' }` for the env-lock case; pass `opts.dataDir` to reuse a dir across a restart (persistence case). Add `PUT`/`DELETE` by widening the `method` parameter.

**Analog B (module-level suite with the fake driver, for the `turn_start` payload / `lastTurn` pill feed):** `server/test/usage.test.ts` l.23-53:
```typescript
const scratch = mkdtempSync(join(tmpdir(), 'derive-usage-'));
process.env.DERIVE_DATA_DIR = scratch;
process.env.DERIVE_BACKEND = 'claude';

const { COST_SOURCES, createLesson, lastTurn, listEvents, listUsage } = await import('../src/db.js');
const { runTurn } = await import('../src/agent.js');
const { setDriverOverride } = await import('../src/driver.js');
const { fakeDriver, setFakeScript } = await import('../src/drivers/fake.js');
...
  setFakeScript(script);
  setDriverOverride(fakeDriver);
  try { await runTurn(id, 'teach me'); } finally { setDriverOverride(null); }
  const turn = lastTurn(id)!;
```

**Analog C (pinned clock, scratch data dir, file-mode assertions):** `server/test/credentials.test.ts` l.27-50 — `process.env.DERIVE_DATA_DIR = dataDir` before `await import('../src/credentials.js')`, `const T0 = 1_700_000_000_000`, `writeFileSync(path, value, { mode: 0o600 })`. For `keys.ts` unit cases: `statSync(join(dataDir, 'secrets.json')).mode & 0o777 === 0o600`, and `secretCount()` from `secrets.ts` (l.56) to prove `registerSecret` ran on load.

**Fake provider on loopback:** `node:http` `createServer` (RESEARCH "Code Examples: The test double") — the `spawn.ts` `freePort()` helper (l.32-41) gives it a port.

---

### `scripts/doctor.mjs` (secrets file line)

**Analog:** same file l.73-83:
```javascript
const tokenFile = join(dataDir, 'token');
if (!existsSync(tokenFile)) warn('Install token', `${tokenFile} does not exist yet`, 'Start Derive once (`pnpm start`) and it makes one.');
else if (process.platform === 'win32') ok('Install token', tokenFile);
else {
  const mode = (statSync(tokenFile).mode & 0o777).toString(8).padStart(3, '0');
  if (mode === '600') ok('Install token', `${tokenFile} (0600)`);
  else fail('Install token', `${tokenFile} is mode 0${mode}, not 0600`, `Run \`chmod 600 ${tokenFile}\`. ...`);
}
```
Copy for `secrets.json`: absent is `ok('Secrets file', 'none yet; add keys in Settings')` (not a warn — fresh installs have none), win32 skip, mode check. Never print a key or hint. The health read l.92-95 may additionally report `health.backend`/`health.model` on the `Server` line.

---

### `web/src/pages/Settings.tsx` (page, per-field save)

**Analog:** `web/src/pages/You.tsx` — copy header, `field` class, `Section`, save-tick state machine.

**Imports pattern** (l.1-7):
```tsx
import { ArrowLeft, Check } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { LearnerMenu } from '../components/LearnerMenu';
import { api } from '../lib/api';
import type { Learner, LearnerPrefs } from '../lib/types';
```

**Field class + doc comment + export** (l.13-19):
```tsx
const field = 'w-full rounded-xl border hairline bg-ink-900/70 px-3 text-[14px] leading-relaxed text-ink-100 outline-none focus:border-gold-500/60 placeholder:text-ink-500';

/**
 * How this learner wants to be taught, in their own words. ...
 */
export function YouPage() {
```
Export `SettingsPage` the same way (page files export `XxxPage`).

**Load + error state pattern** (l.20-42):
```tsx
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [err, setErr] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const load = () => api.profile().then((r) => { ... }).catch((e) => setErr((e as Error).message));
  useEffect(() => { void load(); }, []);
```

**Save with saved-tick timer** (l.46-62):
```tsx
  const save = async () => {
    if (!me || !dirty) return;
    setState('saving');
    try {
      const l = await api.setPrefs(me.id, draft);
      ...
      setState('saved');
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setState('idle'), 1800);
    } catch (e) {
      setErr((e as Error).message);
      setState('error');
    }
  };
```
On `/settings` this state lives per row (in `ProviderRow`), fired on blur/Enter/"Use this" — no page-level Save button (D-03).

**Header pattern** (l.76-86):
```tsx
      <header className="flex items-center gap-5 px-5 md:px-6 h-[60px] border-b hairline shrink-0">
        <Link to="/" className="text-ink-400 hover:text-ink-50 transition-colors">
          <ArrowLeft size={18} strokeWidth={1.8} />
        </Link>
        <h1 className="font-serif text-[22px] text-ink-50">
          How {name} learn{name === 'you' ? '' : 's'} <em className="text-ink-400">· read by the tutor before every lesson</em>
        </h1>
        <div className="ml-auto flex items-center gap-6">
          <LearnerMenu onChange={() => void load()} />
        </div>
      </header>
```

**Saved line / error line** (l.135-138):
```tsx
            <span className="font-mono text-[11px] text-ink-500">
              {state === 'saved' ? <span className="text-gold-500">saved · applies from the next message</span> : dirty ? '⌘↵ to save' : 'up to date'}
            </span>
            {err && <span className="text-sm text-rust-400">{err}</span>}
```
Use `saved · applies from the next turn` for settings.

**`Section` layout** (l.163-176) — reuse verbatim (copy the helper into `Settings.tsx` or lift it to `web/src/components/Section.tsx`; one component per file rule favours lifting if both pages use it):
```tsx
function Section({ n, title, hint, children }: { n: string; title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 grid md:grid-cols-[200px_minmax(0,1fr)] gap-x-8 gap-y-3">
      <div>
        <div className="flex items-baseline gap-2.5">
          <span className="font-serif text-[1.4rem] text-ink-600 leading-none">{n}</span>
          <span className="font-serif text-[1.2rem] text-ink-50">{title}</span>
        </div>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-500">{hint}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}
```

**Selected-choice button style for "Use this" / active row** (l.184-190, `Choices`): `aria-pressed={on}` and `${on ? 'border-gold-500/60 bg-gold-500/5' : 'hairline hover:border-ink-500'}`.

---

### `web/src/components/ProviderRow.tsx` (component, per-row state)

**Analog A:** `web/src/pages/You.tsx` save-tick (above). **Analog B:** `web/src/components/LearnerMenu.tsx` for an inline text input + submit + error line inside a component.

**Inline input + submit pattern** (`LearnerMenu.tsx` l.137-161):
```tsx
            <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="mt-1.5 flex gap-1.5 px-1">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') { ... } }}
                placeholder={renaming ? 'New name' : 'Name'}
                className="flex-1 min-w-0 rounded-lg bg-ink-850 border hairline px-2.5 py-1.5 text-[13px] outline-none focus:border-ink-500 placeholder:text-ink-500"
              />
              <button type="submit" disabled={!name.trim()} className="rounded-lg bg-gold-500 text-ink-950 px-2.5 text-[12px] font-medium disabled:opacity-40">
                {renaming ? 'Save' : 'Add'}
              </button>
            </form>
```
The key field is `<input type="password" autoComplete="off">` saving on blur or Enter; once `{ set: true, hint }` returns it renders `<span className="font-mono">•••• •••• {hint}</span>` with `Replace`/`Remove` text buttons.

**Error line pattern** (`LearnerMenu.tsx` l.175): `{err && <p className="px-2 pt-1.5 text-[12px] text-rust-400">{err}</p>}` — the test-connection failure and the model-fetch failure use this class; success uses `text-moss-400`.

**Status pill classes** (`web/src/pages/Lesson.tsx` l.115): `font-mono text-[10px] tracking-[0.16em] uppercase text-ink-400 border hairline rounded-full px-2.5 h-6` — for `logged in` / `key set` / `set from environment` / `found on port N` / `not configured`.

**Combobox:** no analog; native `<input list={id}>` + `<datalist>` (RESEARCH Pattern 7).

**Component signature pattern** (CLAUDE.md, `LearnerMenu.tsx` l.13): single destructured inline-typed props, e.g. `export function ProviderRow({ row, active, onChange }: { row: ProviderView; active: boolean; onChange: () => void })`.

---

### `web/src/pages/Lesson.tsx` (header pill)

**Analog:** same file l.114-128, the companion pill:
```tsx
        {external && (
          <span
            className="hidden md:inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.16em] uppercase text-ink-400 border hairline rounded-full px-2.5 h-6"
            title={terminal ? 'Cards are answered in your terminal; answering here works too' : 'Cards are answered here in the browser'}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${state.connected ? 'bg-moss-400' : 'bg-ink-600'}`} />
            companion · {driver}
```
Add a `<Link to="/settings" ...>` with the same classes plus `hover:text-ink-50 transition-colors` after the `<h1>` (l.113). Text: `${state.tutor.provider} · ${state.tutor.model ?? 'default model'}` for agent lessons, `${driver} · terminal model` for external. `driver` is l.31: `state.lesson?.driver === 'codex' ? 'codex' : 'claude code'` — change `'codex'` to `'codex cli'` for D-16.

---

### `web/src/lib/useLesson.ts` (reducer field)

**Analog:** same file l.70-71:
```typescript
    case 'turn_start':
      return { ...s, busy: true, status: s.lesson?.mode === 'external' ? 'Teaching in your terminal' : 'Thinking', error: null };
```
Add `tutor: ev.payload?.provider ? { provider: ev.payload.provider, model: ev.payload.model ?? null } : s.tutor`. Add `tutor: { provider: string; model: string | null } | null` to `LessonState` (l.20-30) and seed it in the `init` action from `d.turn` (`api.lesson` response). `turn_start` is already in `EVENT_TYPES` (l.236-238); no new event type.

---

### `web/src/lib/api.ts`, `web/src/lib/types.ts`, `web/src/lib/prefs.ts`

**`api.ts` endpoint pattern** (l.53-64):
```typescript
const post = (url: string, body?: unknown, method = 'POST') =>
  fetch(url, { method, headers: headers({ 'content-type': 'application/json' }), body: body ? JSON.stringify(body) : undefined });

export const api = {
  ...
  renameLearner: (id: string, name: string) => post(`/api/learners/${id}`, { name }, 'PATCH').then((r) => j<Learner>(r)),
  /** How this learner wants to be taught. Fields merge; an empty string clears one. */
  setPrefs: (id: string, prefs: Partial<Record<keyof LearnerPrefs, string>>) => post(`/api/learners/${id}`, { prefs }, 'PATCH').then((r) => j<Learner>(r)),
```
Add keys: `settings: () => get('/api/settings').then((r) => j<Settings>(r))`, `detectProviders: () => post('/api/settings/detect')...`, `setProvider: (id, body) => post(\`/api/settings/${id}\`, body, 'PUT')...`, `removeKey: (id) => del(\`/api/settings/${id}/key\`)...`, `useProvider: (id) => post('/api/settings/active', { provider: id })...`, `providerModels: (id) => post(\`/api/settings/${id}/models\`)...`, `testProvider: (id) => post(\`/api/settings/${id}/test\`)...`. `j<T>()` (l.40-51) throws the server's `error` sentence, so the provider's verbatim message reaches the row unchanged. Extend `lesson:` (l.67-70) return type with `turn: TurnRow | null`.

**`types.ts` pattern** (l.17-26): PascalCase `type` aliases with one-line `/** */` on ambiguous fields; add `model?: string` to `LearnerPrefs`, and new `ProviderView`, `Settings`, `TutorChoice`, `TestResult`, `TurnRow` types mirroring the server by hand.

**`prefs.ts` `describePrefs`** (l.17-26): do **not** add a `model` bit (Pitfall 5); `hasPrefs` (l.27) will count it — acceptable, or filter it out if the menu subtitle should ignore it.

---

### `web/src/main.tsx`, `web/src/pages/Home.tsx`, `web/src/components/LearnerMenu.tsx` (links + route)

**Route** (`main.tsx` l.9, l.20): `import { YouPage } from './pages/You';` / `<Route path="/you" element={<YouPage />} />` — add `SettingsPage` and `<Route path="/settings" element={<SettingsPage />} />`.

**Nav link** (`Home.tsx` l.105): `<Link to="/you" className="hidden md:inline hover:text-ink-50">how you learn</Link>` — add `<Link to="/settings" className="hidden md:inline hover:text-ink-50">settings</Link>`.

**Menu link** (`LearnerMenu.tsx` l.176-182):
```tsx
          <Link to="/you" onClick={() => setOpen(false)} className="mt-1 flex items-start gap-2 rounded-lg px-2 py-1.5 text-[13px] text-ink-300 hover:bg-ink-850 hover:text-ink-50">
            <SlidersHorizontal size={12} className="mt-[3px] shrink-0" />
            <span className="min-w-0">
              How {me?.id === 'default' ? 'you' : (me?.name ?? 'you')} learn{me && me.id !== 'default' ? 's' : ''}
              <span className="block font-mono text-[10px] text-ink-500 truncate">{...}</span>
            </span>
          </Link>
```
Add a sibling `<Link to="/settings">` with a `Settings`/`Cpu` lucide icon and subtitle `provider · model`.

---

## Shared Patterns

### Redaction of every outbound error
**Source:** `server/src/secrets.ts` l.49-53, l.105-112
**Apply to:** every settings route catch, `probe.ts` error construction, `keys.ts` load/set
```typescript
export function registerSecret(value: string | null | undefined): void {
  const v = typeof value === 'string' ? value.trim() : '';
  if (v.length < MIN_SECRET_CHARS) return;
  secrets.add(v);
}
export const safeMessage = (e: unknown): string => redactErrors(e instanceof Error ? e.message : String(e));
```
`MIN_SECRET_CHARS = 16` (l.35): short local tokens are stored but not redacted — accepted (Pitfall 6).

### Route error contract
**Source:** `server/src/index.ts` l.301-312, l.568
**Apply to:** all `/api/settings*` routes
`.catch(() => ({}))` on JSON bodies; 404 `{ error: 'not found' }`-style lowercase sentences; `c.json({ error: safeMessage(e) }, 400)` in catch; 409 for env-locked, 400 for `teaches: false` made active, 502 for provider failures on `/models`.

### Config read once
**Source:** `server/src/config.ts` l.32-48; consumer `server/src/backend.ts` l.14
**Apply to:** `settings.ts`, `probe.ts`, `keys.ts`
Every env value is a `config.ts` constant with a `/** */` line; modules import constants, never `process.env` (`mcp.ts` is the sole exception as its own process).

### Live-read-with-bounded-cache
**Source:** `server/src/credentials.ts` l.50, l.93, l.104-123
**Apply to:** `keys.ts` (1 s file cache), `settings.ts` detection memo (30 s, reset by `POST /api/settings/detect`)
`now = Date.now()` parameter, `{ ..., at }` module state, test-only reset export.

### Module header prose + one-line export docs
**Source:** `server/src/credentials.ts` l.1-36, `server/src/tools.ts` l.1-28, `server/src/db.ts` l.526
**Apply to:** all four new server modules
Opening `/** */` paragraph(s) with the design reasoning; one-sentence `/** */` on each export; no `@param`.

### Per-field save with saved tick
**Source:** `web/src/pages/You.tsx` l.24-26, l.46-62, l.135-138
**Apply to:** `Settings.tsx`, `ProviderRow.tsx`, the `/you` model field
`state: 'idle' | 'saving' | 'saved' | 'error'`, 1800 ms timer, `text-gold-500` saved line, `text-rust-400` error.

### Spawned-server test harness
**Source:** `server/test/spawn.ts` l.55-100; `server/test/api.test.ts` l.29-60
**Apply to:** `server/test/settings.test.ts`
`startDeriveServer(entry, { DERIVE_BACKEND: '' , ...env }, { dataDir? })`; token from `join(dataDir, 'token')`; `x-derive-token` header on every call; `after(() => { server?.kill(); rmSync(dataDir, ...) })`.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `web/src/components/ProviderRow.tsx` combobox portion | component | user input | No `<datalist>`/combobox exists in `web/src`; use the native `<input list>` + `<datalist>` from RESEARCH Pattern 7 with the `field` class from `You.tsx` l.13 |
| `server/src/probe.ts` parallel detection (`Promise.all` of shape-checked probes) | service | fan-out request-response | No existing module fans out several HTTP probes; compose from `library.ts` l.334 (fetch options) + RESEARCH Pattern 4 (`probeJson`, `isLlamaCpp`/`isOllama`/`isLmStudio`) |

## Metadata

**Analog search scope:** `server/src/**` (credentials, secrets, config, backend, migrations, driver, agent, index, db, mcp, codex, library, tools), `server/test/**` (spawn, api, usage, credentials), `web/src/pages/**`, `web/src/components/LearnerMenu.tsx`, `web/src/lib/**`, `scripts/doctor.mjs`, `.env.example`
**Files scanned:** 27
**Tracked-source gate:** all analog paths confirmed by `git ls-files`; no `.gsd/capabilities` mirror paths referenced
**Pattern extraction date:** 2026-09-30
