# Phase 03: Owned Loop: API Keys and Gateways - Pattern Map

**Mapped:** 2026-10-01
**Files analyzed:** 28 (10 new, 18 modified)
**Analogs found:** 26 / 28

Every analog path below was checked with `git ls-files` and is tracked source. No gitignored install mirror appears here.

## File Classification

### New files

| New file | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `server/src/drivers/api.ts` | driver | streaming / event-driven | `server/src/agent.ts` (`claudeDriver`, lines 164-225) + `server/src/drivers/fake.ts` | exact |
| `server/src/drivers/adapters.ts` | config table | transform | `server/src/probe.ts` `requestFor` (lines 189-213) | exact |
| `server/src/pricing.ts` | config (pure data) | transform | `server/src/providers.ts` (whole file) | exact |
| `server/src/prices.ts` | service (file-backed, read-live) | file-I/O | `server/src/keys.ts` (whole file) | exact |
| `server/src/cost.ts` | utility (pure) | transform | `server/src/schedule.ts` (lines 1-75) | exact |
| `server/src/context.ts` | utility (pure) | transform | `server/src/schedule.ts` | role-match |
| `server/src/search.ts` | service | request-response | `server/src/probe.ts` `getJson`/`testConnection` + `server/src/library.ts` `fetchPublic` | role-match |
| `web/src/components/WebSearchCard.tsx` | component | CRUD | `web/src/components/ProviderRow.tsx` (the card shell, `BaseUrlField` lines 230-275, `KeyField`) | exact |
| `web/src/components/fields.ts` | utility (shared UI constants + hooks) | transform | the class constants and `useTick`/`blurOnEnter` already at the top of `web/src/components/ProviderRow.tsx` — lifted, not re-derived | exact (in-file origin) |
| `server/test/api-driver.test.ts` | test | event-driven | `server/test/driver.test.ts` (lines 1-60) | exact |
| `server/test/cost.test.ts` (+ pricing/context) | test | transform | `server/test/schedule.test.ts` | exact |
| `method/surfaces/*` owned-loop web-tools text | config (prompt text) | transform | `method/surfaces/app.md`, `server/src/prompt.ts` lines 21-25 | exact |

### Modified files

| Modified file | Role | Data Flow | Pattern source (same file unless named) | Match Quality |
|---|---|---|---|---|
| `server/src/tools.ts` | registry + projection | transform | `jsonSchemaOf`/`shapeFor` lines 445-473 | exact (in-file) |
| `server/src/migrations.ts` | migration | batch | migrations 2 and 3 (lines 181-231) | exact (in-file) |
| `server/src/db.ts` | model / storage | CRUD | `recordUsage`, `cleanPrefs`, `getSetting` | exact (in-file) |
| `server/src/settings.ts` | service | request-response | `chooseModel` lines 171-179 | exact (in-file) |
| `server/src/providers.ts` | config data | transform | rows + `unwired()` line 61 | exact (in-file) |
| `server/src/agent.ts` | orchestration | event-driven | `runTurn` dispatch lines 264-316 | exact (in-file) |
| `server/src/prompt.ts` | config (prompt) | transform | `systemPrompt` lines 21-25 | exact (in-file) |
| `server/src/index.ts` | route | request-response | `PUT /api/settings/:provider` lines 460-490, `lessonView` line 282 | exact (in-file) |
| `server/src/config.ts` | config | transform | `SECRETS_PATH` constant style | exact (in-file) |
| `web/src/pages/Lesson.tsx` | component | request-response | `tutorLabel` line 33 + the pill lines 111-123 | exact (in-file) |
| `web/src/pages/Home.tsx` | component | request-response | the mono stats line (~line 256) | exact (in-file) |
| `web/src/pages/Settings.tsx` | component | CRUD | the group/eyebrow layout lines 12-17 | exact (in-file) |
| `web/src/components/ProviderRow.tsx` | component | CRUD | `BaseUrlField` lines 230-275 | exact |
| `web/src/lib/api.ts` | utility (client) | request-response | the `api` object, `setProvider` line 113 | exact (in-file) |
| `web/src/lib/types.ts` | model (types) | transform | `ProviderView`/`Settings` | exact (in-file) |
| `server/test/wire-surface.{json,test.ts}` | test fixture | transform | the test's own assertions lines 78-170 | exact (in-file) |
| `server/package.json` | config | — | existing exact pins (`ts-fsrs`, `unpdf`, `fflate`) | exact |
| `.env.example`, `scripts/doctor.mjs` | config / script | batch | existing entries | exact |

---

## Pattern Assignments

### `server/src/drivers/api.ts` (driver, streaming)

**Analog:** `server/src/agent.ts` `claudeDriver` (lines 164-225), structure from `server/src/drivers/fake.ts`.

**Module header prose** — copy the voice of `server/src/driver.ts` lines 1-27 and `drivers/fake.ts` lines 1-14: a `/** … */` prose paragraph explaining *why* the module exists, not what it does.

**Driver shape** (`drivers/fake.ts:180-182`):
```typescript
export const fakeDriver: Driver = {
  name: 'fake',
  async runTurn(_ctx: TurnContext, sink: EventSink) {
```
`Driver.name` is load-bearing: per RESEARCH Pitfall 9, set it to the `ProviderId` (one factory per provider, or one object whose `name` is the resolved provider), never the literal `'api'` — `providerOfDriver` (`providers.ts:219`) is the identity outside `claude`, `lessonView` feeds it to the header pill (`index.ts:282`), and `recordUsage` denormalises `turn.driver` onto every usage row (`db.ts` `recordUsage`).

**The growing-text-block pattern to copy verbatim** (`agent.ts:254-269` + 281-300 region, excerpted):
```typescript
let blockId: string | null = null;
let blockSeq: number | null = null;
let blockText = '';
let lastCheckpoint = 0;
const flushBlock = () => {
  if (blockId && blockSeq !== null) sink.emitUpdate(blockSeq, 'assistant', { id: blockId, text: blockText });
  blockId = null;
  blockSeq = null;
  blockText = '';
};
```
on block start:
```typescript
flushBlock();
blockId = randomUUID();
blockSeq = sink.emit('assistant', { id: blockId, text: '', partial: true }).seq;
lastCheckpoint = Date.now();
```
on delta (the ~1.5 s checkpoint cadence is the pattern, not a detail):
```typescript
blockText += ev.delta.text;
sink.emitEphemeral('delta', { id: blockId, text: ev.delta.text });
if (blockSeq !== null && Date.now() - lastCheckpoint > 1500) {
  sink.checkpoint(blockSeq, { id: blockId, text: blockText, partial: true });
  lastCheckpoint = Date.now();
}
```

**Status lines (D-09, D-10) and the tool-label vocabulary** (`agent.ts:289`):
```typescript
sink.emitEphemeral('status', { text: cb.name === 'WebSearch' ? 'Verifying with a web search' : cb.name === 'WebFetch' ? 'Reading a source' : TOOL_LABELS[cb.name.replace(/^mcp__derive__/, '')] ?? `Using ${cb.name}` });
```
and, for reasoning (`agent.ts:291`):
```typescript
} else if (cb.type === 'thinking') {
  sink.emitEphemeral('status', { text: 'Thinking' });
}
```
On the owned loop: map `reasoning-start` → this exact `'Thinking'` line; map a `tool-call` part to `TOOL_LABELS[name]`; the retry countdown is the same `emitEphemeral('status', …)` call with `Provider busy, retrying in Ns`. No new event type.

**Interrupt handshake** (`agent.ts:248-252`):
```typescript
ctx.onActive({
  interrupt: async () => {
    await q.interrupt();
  },
});
```
For the owned loop the handle aborts the `AbortController` passed as `abortSignal`.

**End-of-turn / error / finally discipline** (`agent.ts:307-332`, excerpted):
```typescript
if (ctx.isStopping()) {
  sink.endTurn({ ok: true, interrupted: true });
} else if (msg.subtype === 'success') {
  sink.endTurn({ ok: true, cost_usd: msg.total_cost_usd ?? null, duration_ms: msg.duration_ms, verified });
} else {
  sink.endTurn({ ok: false, error: … });
}
…
} catch (err) {
  flushBlock();
  sink.endTurn({ ok: false, error: safeMessage(err) });
} finally {
  flushBlock();
  sink.endTurn({ ok: true, interrupted: true });
}
```
`sink.endTurn` is idempotent (`driver.ts:108-117`), which is what makes the `finally` safe. D-12's step-cap end and Stop both take the `{ ok: true, interrupted: true }` branch.

**Usage reporting (one row per `finish-step`)** — the sink call is `sink.usage(row)` typed as `UsageInput` (`db.ts`):
```typescript
export type UsageInput = {
  model?: string | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_tokens?: number | null;
  cache_write_tokens?: number | null;
  reasoning_tokens?: number | null;
  cost_source: CostSource;
  cost_usd?: number | null;
};
```
Keep `agent.ts`'s `reported(v)` discipline: a count the provider did not give stays `null`, never `0`. Map `input_tokens` from `usage.inputTokenDetails.noCacheTokens` (RESEARCH Pitfall 1), not `usage.inputTokens`.

**Error sentences** — do not write a second vocabulary. Use `probe.ts` `providerSentence(status, text)` (lines 268-281) and `hintFor(label, status, sentence)` (lines 283-289), and `secrets.ts` `safeMessage(err)` for anything that reaches `endTurn`.

---

### `server/src/drivers/adapters.ts` (config table, transform)

**Analog:** `server/src/probe.ts` `requestFor` (lines 189-213) — one `switch (spec.id)` fed by catalogue data, no logic duplicated per provider.

```typescript
/**
 * Build the request for a row's model list from the catalogue and nothing
 * else. The key goes in the header each provider reads — Anthropic's
 * `x-api-key` with its version header, Google's `x-goog-api-key` …
 */
export function requestFor(spec: ProviderSpec, key: string | undefined, base: string | undefined): ModelsRequest {
  switch (spec.id) {
    case 'claude-code':
    case 'codex':
      throw new Error(`${spec.label} has no model list`);
    case 'openai-compatible':
      if (!base) throw new Error("Add the endpoint's base URL first");
      return { url: `${v1(base)}/models`, headers: bearer(key) };
    case 'anthropic':
      return { url: `${spec.endpoint}${spec.modelsPath}`, headers: { ...(key ? { 'x-api-key': key } : {}), 'anthropic-version': '2023-06-01' } };
    …
  }
}
```
Copy: the exhaustive `switch` over `ProviderId` (no `default`, so TypeScript flags a new row), the lowercase thrown `Error` sentences, the `spec`-driven URL construction, and the one-sentence `//` comment where a provider is special (`// Ollama takes no key; the other two may have been started with a bearer token.`). The adapter record is `Record<ProviderId, Adapter>` with the fields D-02 names (model factory, dialect, native search, providerOptions, cost reader).

---

### `server/src/pricing.ts` (config, pure data)

**Analog:** `server/src/providers.ts` — exact template, including the `*_AS_OF` convention.

**Header prose** (`providers.ts:1-21`, tail):
```typescript
/**
 * …
 * Pure data with no I/O and no import-time side effect, so anything may import
 * it, including a test with no database behind it.
 */
```

**The as-of constant and the row type** (`providers.ts:33-64`):
```typescript
/** The day the default model ids below were last checked against the vendors' documentation. */
export const DEFAULTS_AS_OF = '2026-09-30';

export const PROVIDERS: readonly ProviderSpec[] = [ … ];

const byId = new Map<string, ProviderSpec>(PROVIDERS.map((p) => [p.id, p]));

/** The catalogue row for an id, or undefined when the id is not one of ours. */
export function providerOf(id: string): ProviderSpec | undefined {
  return byId.get(id);
}
```
`PRICES_AS_OF` mirrors `DEFAULTS_AS_OF`; the lookup mirrors the `byId` Map plus a `priceOf(provider, model)` returning `undefined` for an unknown model (never zero — D-15 discretion note).

---

### `server/src/prices.ts` (service, file-I/O)

**Analog:** `server/src/keys.ts` — the whole file is the pattern, minus the secret.

**Cache + loaded shape** (`keys.ts:41-88`):
```typescript
/** How stale a read may be, in milliseconds. One second, said in seconds where a sentence promises it, as TOKEN_CACHE_MS is. */
export const KEY_CACHE_MS = 1_000;

type Store = Record<string, string>;
type Loaded = { store: Store; error: string | null };

let cache: (Loaded & { at: number }) | null = null;

function load(now = Date.now()): Loaded {
  if (cache && now >= cache.at && now - cache.at < KEY_CACHE_MS) return cache;
  const store: Store = {};
  let error: string | null = null;
  if (existsSync(SECRETS_PATH)) {
    try {
      const raw = JSON.parse(readFileSync(SECRETS_PATH, 'utf8')) as unknown;
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        for (const [k, v] of Object.entries(raw)) if (typeof v === 'string' && v.trim()) store[k] = v.trim();
      } else {
        error = `${SECRETS_PATH} is not a JSON object`;
      }
    } catch (e) {
      error = `${SECRETS_PATH} could not be read: ${e instanceof SyntaxError ? 'it is not valid JSON' : e instanceof Error ? e.message : String(e)}`;
    }
  }
  cache = { store, error, at: now };
  return cache;
}
```
Copy exactly: absent file is silent (`existsSync` guard, no error), unreadable file is loud and the path is named, the one-second cache, the `resetKeyCache()`-style test-only cache reset (`keys.ts:143`), and the error accessor:
```typescript
/** Why the file yields no keys, or null when it reads fine or is absent. */
export const secretsFileError = (): string | null => load().error;
```
`prices.json` has **no writer** (D-16 has no UI), so omit `persist`/`setKey`/`removeKey` and the 0600 atomic-rename half. The path constant belongs in `server/src/config.ts` beside `SECRETS_PATH`.

---

### `server/src/cost.ts` and `server/src/context.ts` (pure utilities)

**Analog:** `server/src/schedule.ts` — the repo's reference pure module.

**Header prose and the explicit-`now` convention** (`schedule.ts:1-14`, 62):
```typescript
/**
 * When a node comes back for review. FSRS (the scheduler behind modern
 * Anki) models each node as a memory with a difficulty and a stability, …
 */

/** The node's next memory state after a check graded `g` at `now`. */
export function schedule(node: Parameters<typeof cardOf>[0], g: Grade, now = Date.now()): Scheduled {
```
Copy: the explanatory prose header that records the *reasoning* so a later change does not undo it by accident; `Pick<…>`-narrow or `Parameters<typeof …>` input types so a test can pass a literal with no database; a `Record<Union, X>` lookup constant for a mapping (`const RATING: Record<Grade, FsrsGrade> = { … }`); named exported types for the return shape (`export type Scheduled = { … }`); a one-sentence `//` comment beside a non-obvious floor:
```typescript
// FSRS may schedule a lapsed node for later today; a node is checked at most once per sitting, so tomorrow is the floor.
const reviewAt = Math.max(card.due.getTime(), now + DAY);
```
Write the step-cap number, the headroom fraction and the chars-per-token divisor beside the same kind of comment.

`cost.ts` signature follows the discretion note: `(rows: UsageRow[], prices: PriceTable) => { usd: number | null; source: CostSource }` — no HTTP, no SQL. The money formatter (D-19, `about $0.14` / `under $0.01`) belongs with it as a pure string function, so the header pill and the Home row cannot diverge.

---

### `server/src/search.ts` (service, request-response)

**Analogs:** `server/src/probe.ts` for the outbound-JSON posture, `server/src/library.ts` for the fetch guard.

**Timeout + sentence posture** (`probe.ts:135-178`, 308-320):
```typescript
export const REMOTE_MS = 8_000;
export const LOCAL_MS = 4_000;
const timeoutFor = (url: string): number => (isLocalUrl(url) ? LOCAL_MS : REMOTE_MS);
…
if (!res.ok) throw new Error(providerSentence(res.status, text));
```
Per RESEARCH anti-pattern: use `isLocalUrl` for the *configured* SearXNG/Tavily endpoint (a learner's SearXNG is often `localhost`), and keep `assertPublicHost` for the result URLs the tutor then fetches.

**The guarded fetch the `fetch_page` tool wraps** (`library.ts:330-350`):
```typescript
export async function fetchPublic(url: string, accept: string, maxBytes: number, guard?: (u: string) => Promise<void>): Promise<{ type: string; buf: Buffer; url: string }> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    await (guard ?? assertPublicHost)(current);
    const res = await fetch(current, { headers: { 'user-agent': USER_AGENT, accept, 'accept-language': 'en, *;q=0.5' }, redirect: 'manual', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    …
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const len = Number(res.headers.get('content-length') ?? 0);
    if (len > maxBytes) throw new Error(`larger than ${Math.round(maxBytes / 1024 / 1024)} MB`);
```
D-21's tool calls this and `htmlToText` (`library.ts:280`); it must not reimplement either.

The search key goes through `keys.ts` `setKey`/`keyView`, so it registers with `secrets.ts` `registerSecret` on load like every other value — no new secret path.

---

### `server/src/tools.ts` (registry + per-dialect projection, D-21/D-28)

**Analog:** the file's own seam (lines 445-473):
```typescript
/** What a tool says on one surface: the registry's description, unless the tool declares a different one for that surface. */
export function descriptionFor(spec: ToolSpec, surface: ToolSurface): string {
  return spec.per_surface?.[surface]?.description ?? spec.description;
}

/** A tool's raw input shape on one surface, with any declared per-surface fields laid over the registry's. */
export function shapeFor(spec: ToolSpec, surface: ToolSurface): z.ZodRawShape {
  const over = spec.per_surface?.[surface]?.shape;
  return over ? { ...spec.shape, ...over } : spec.shape;
}

/** A tool's input shape projected to JSON Schema: the form every provider's wire format is derived from. */
export function jsonSchemaOf(spec: ToolSpec, surface?: ToolSurface) {
  return z.toJSONSchema(z.object(surface ? shapeFor(spec, surface) : spec.shape));
}
```
Widen this, do not fork it: add the dialect parameter to `jsonSchemaOf` and use zod's own `target`/`override` seam (RESEARCH Finding 7). The derived lists stay derived:
```typescript
export const ALL_TOOL_NAMES: readonly string[] = TOOL_REGISTRY.map((s) => s.name);
export const DERIVE_TOOL_NAMES: readonly string[] = toolsFor('agent').map((s) => s.name);
export const TOOL_LABELS: Record<string, string> = Object.fromEntries(TOOL_REGISTRY.filter((s) => s.label).map((s) => [s.name, s.label as string]));
```
**New tool row pattern** — copy the shape of the `ask` row (`tools.ts:124-131`): `name`, a model-facing `description`, a `shape` of zod fields each carrying `.describe('…')`, `surfaces: [...]`, a `label` in today's wording (`Reading a source`), and a `per_surface` entry only if the surface genuinely differs (the wire-surface test asserts both directions).

---

### `server/src/migrations.ts` (migration, batch)

**Analog:** migrations 2 and 3 in the same file.

**Header rule to obey** (`migrations.ts:22-26`):
```
 * Adding a migration is one entry appended to `MIGRATIONS`: the next version
 * number, a short name, and an `up` that does the work. Past the baseline the
 * runner guarantees which version a file is on, so a plain `CREATE TABLE` is
 * right there — the `IF NOT EXISTS` idiom would hide the very mistake the
 * version number exists to catch.
```

**The entry shape** (`migrations.ts:180-199`):
```typescript
  {
    version: 2,
    name: 'turns',
    up(db) {
      db.exec(`
        CREATE TABLE turns (
          id TEXT PRIMARY KEY,
          lesson_id TEXT NOT NULL,
          learner_id TEXT NOT NULL,
          driver TEXT NOT NULL,
          model TEXT,
          started_at INTEGER NOT NULL,
          ended_at INTEGER,
          status TEXT NOT NULL
        );
        CREATE INDEX turns_lesson ON turns (lesson_id, started_at);
      `);
      backfillTurns(db);
    },
  },
```
Copy: plain `CREATE TABLE` (no `IF NOT EXISTS`), the index created in the same `exec`, data work factored into a named helper function below with a prose `/** … */` explaining the honesty rule (see `backfillUsage`, `migrations.ts:330-349`, for the "no figure is reconstructed by estimating" voice D-26's conversion needs too). `LATEST_VERSION` is derived and needs no edit. The runner's own transaction/snapshot machinery is untouched.

---

### `server/src/db.ts` (storage, CRUD) — `turn_messages` accessors, `LearnerPrefs.model` re-key, lesson cost sum

**Analogs in the same file.**

`recordUsage` is the template for a turn-scoped write that reads the turn row for its denormalised columns:
```typescript
export function recordUsage(turnId: string, row: UsageInput): UsageRow {
  const turn = getTurn(turnId);
  if (!turn) throw new Error('turn not found');
  …
  q.insertUsage.run(turn.id, turn.lesson_id, turn.learner_id, turn.driver, model, count(row.input_tokens), …);
  return listUsage({ turn: turn.id }).at(-1)!;
}
```
Copy: prepared statements live in the module-level `q` object; `count(…)` normalises a missing number to `null`; a lowercase `Error` sentence for not-found; the verb vocabulary (`create*`/`get*`/`list*`/`set*`/`delete*`).

**D-26's `LearnerPrefs.model` change** — the field and its validator are both here:
```typescript
  /** A model id for this learner alone, on the active provider. Not a teaching preference: never rendered into the prompt. */
  model?: string;
```
```typescript
  // The model id is bounded to the characters real ids use, as PUT /api/settings/:provider bounds the install-wide one; it is stored here and read by the resolver only, never by preferencesSection.
  const model = str('model').slice(0, 200);
  if (model && /^[A-Za-z0-9._:/-]+$/.test(model)) out.model = model;
```
The record form keeps the same 200-char bound and the same `/^[A-Za-z0-9._:/-]+$/` test per entry, keys validated against `providerOf(id)`, and the doc comment is rewritten to say "per provider".

---

### `server/src/settings.ts` (service) — `chooseModel`

**Analog:** the function itself (lines 171-179):
```typescript
function chooseModel(provider: ProviderId, learnerId?: string): { model: string | null; modelSource: ModelSource } {
  if (MODEL) return { model: MODEL, modelSource: 'environment' };
  const own = learnerId ? getLearner(learnerId)?.prefs.model : undefined;
  if (own) return { model: own, modelSource: 'learner' };
  const stored = getSetting(modelKey(provider));
  if (stored) return { model: stored, modelSource: 'settings' };
  const fallback = providerOf(provider)?.defaultModel ?? null;
  return { model: fallback, modelSource: 'default' : null };
}
```
The one-line change is `prefs.model?.[provider]`. The tier order (environment > learner > settings > catalogue default) and the `modelSource` vocabulary stay exactly as they are — both `resolveTutor` and `currentTutor` spread the result.

---

### `server/src/providers.ts` (config data) — D-27 row flips

**Analog:** the rows themselves. `unwired()` (line 61) is the helper five rows lose:
```typescript
const unwired = (label: string) => `Teaching on ${label} arrives with the next release. Keys, model lists and tests already work.`;
```
and the Claude Code `note` (line 77) is the sentence being reworded:
```typescript
note: "Runs the app's tutor on your Claude Code login. The plugin is the supported subscription route; an Anthropic API key takes over from the next release.",
```
Keep `teaches`'s doc comment honest — it currently reads "True only where a driver exists today"; five rows gaining a driver is the change, not an exception to it.

---

### `server/src/agent.ts` (orchestration) — the dispatch

**Analog:** `runTurn`, lines 276-284:
```typescript
  const tutor = resolveTutor(lesson.learner_id);
  const driver = driverOverride() ?? (backendOf(tutor.provider) === 'codex' ? codexDriver : claudeDriver);
  // D-04: a session id belongs to the provider that issued it. When the driver
  // changed since the last turn, the lesson starts a fresh provider
  // conversation; a model change on the same provider keeps resuming.
  const last = lastTurn(lessonId);
  if (last && last.driver !== driver.name && lesson.session_id) clearSessionId(lessonId);
  const turnId = startTurn(lessonId, driver.name, tutor.model);
  emit(lessonId, 'turn_start', { provider: tutor.provider, model: tutor.model });
```
Add the third branch here and nowhere else. Note the existing `last.driver !== driver.name` comparison already implements D-04's drop-on-provider-change *for free* once `driver.name` is the provider id — the same comparison is what `turn_messages` should be dropped on.

`instructions` is built on line 290 and passed whole:
```typescript
const instructions = systemPrompt(backendOf(tutor.provider)) + materialsSection(lessonId) + librarySection(lesson.learner_id, lesson.topic) + learnerProfile(lesson.learner_id, lessonId);
```
D-06's stable/volatile split follows this exact concatenation order — `systemPrompt(...)` is already the stable prefix and the three sections already the volatile tail; the split is where the `+` chain is, and `TurnContext.instructions` grows a second field rather than the driver re-deriving anything.

---

### `server/src/prompt.ts` (prompt text) — D-23's third `{{WEB_TOOLS}}` rendering

**Analog:** the function itself (lines 21-25):
```typescript
/** The teaching system prompt for a backend: the same method, naming that backend's own web tools. */
export function systemPrompt(backend: 'claude' | 'codex'): string {
  const web = backend === 'codex' ? 'Web search (your built-in `web_search`)' : '`WebSearch` / `WebFetch`';
  return PROMPT.replaceAll('{{WEB_TOOLS}}', web);
}
```
Widen the parameter rather than adding a function. `{{WEB_TOOLS}}` appears in `method/20-tools.md` (×2), `method/60-process.md`, `method/80-library.md` — all rendered into `server/src/method.generated.ts` by `pnpm method`, committed, with CI failing on drift. The method text itself is authored in `method/`, never edited in `method.generated.ts`.

---

### `server/src/index.ts` (routes) — web-search settings block, cost in the two views

**Analog for the write route** (lines 460-490):
```typescript
/** Store one provider's fields. A field the environment sets is refused with the variable's name rather than silently outranked. */
app.put('/api/settings/:provider', async (c) => {
  const spec = providerOf(c.req.param('provider'));
  if (!spec) return c.json({ error: 'unknown provider' }, 404);
  const parsed = SettingsWrite.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'the settings body could not be read' }, 400);
  …
  const lock = lockedBy(`key:${spec.id}`);
  if (lock) return c.json({ error: keyLockSentence(spec, lock) }, 409);
  try {
    if (key !== undefined) setKey(spec.id, key);
    if (model !== undefined) {
      if (model) setSetting(modelKey(spec.id), model);
      else deleteSetting(modelKey(spec.id));
    }
    return c.json(rowView(spec, currentTutor().provider));
  } catch (e) {
    return c.json({ error: safeMessage(e) }, 400);
  }
});
```
Copy: a zod `safeParse` over `c.req.json().catch(() => ({}))`; a 404 for an unknown id, 400 for a bad body, 409 for an environment lock with the variable named; `setSetting`/`deleteSetting` for empty-means-unset; `safeMessage(e)` on the way out; the route answers the refreshed view, not `{ ok: true }`.

**Analog for the cost figures** (line 282):
```typescript
const lessonView = (id: string) => {
  const lesson = getLesson(id);
  if (!lesson) return null;
  // What the last turn ran on, read off its turns row: the header pill needs
  // it on first paint, and this view is hot, so it never asks a resolver.
  const last = lastTurn(id);
  return { lesson, nodes: listNodes(id), materials: listMaterials(id), busy: busy(id), pending: hasPending(id), tutor: last ? { provider: providerOfDriver(last.driver), model: last.model } : null };
};
```
The lesson's cost joins this object as one more field, computed through `cost.ts` from a `SUM` over the lesson's usage rows — the same "this view is hot" rule applies, so it is one indexed query, not a scan. The Home list route gets the same field.

---

### `web/src/pages/Lesson.tsx` (component) — D-13's pill

**Analog:** the same file.
```typescript
  // What the last turn ran on, never what Settings currently says; the catalogue id reads as words.
  const tutorLabel = state.tutor ? `${state.tutor.provider.replace(/-/g, ' ')} · ${state.tutor.model ?? 'default model'}` : '';
```
```tsx
        {!external && state.tutor && (
          <Link
            to="/settings"
            className="hidden md:inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.16em] uppercase text-ink-400 hover:text-ink-50 border hairline rounded-full px-2.5 h-6 transition-colors"
            title="Which model is teaching. Change it in Settings; it applies from the next turn."
          >
            <span className="max-w-[40ch] truncate" title={tutorLabel}>
              {tutorLabel}
            </span>
          </Link>
        )}
```
D-13 is one more `·` segment inside this `<Link>`: the model id keeps `max-w-[40ch] truncate`, the cost sits in a sibling `<span>` with no truncate class. The money string comes from the API/shared formatter, not from arithmetic in the component.

---

### `web/src/pages/Home.tsx` (component) — D-18's row total

**Analog:** the mono stats line in the same file (~line 256):
```tsx
              <div className="font-mono text-[11px] text-ink-400 whitespace-nowrap">
                <span className="text-gold-500">{heroLocked}</span> / {heroNodes.length} locked
                {recent && (
                  <>
                    {' · '}
                    <Link to={`/lesson/${recent.lesson.id}`} className="text-ink-100 hover:text-gold-500">
                      continue →
                    </Link>
```
Copy the `{' · '}` separator idiom, `font-mono text-[11px] text-ink-400`, and the conditional-render-with-fragment form. One short string per row, no new component.

---

### `web/src/pages/Settings.tsx` + `ProviderRow.tsx` (components) — D-22's block, D-16's sentence

**Analog for the page section** (`Settings.tsx:12-17`):
```typescript
/** The three eyebrows the rows sit under, in page order. The ids are the API's; only the words are the page's. */
const GROUPS: { id: ProviderView['group']; label: string }[] = [
  { id: 'logins', label: 'logins' },
  { id: 'keys', label: 'keys' },
  { id: 'local', label: 'on this machine' },
];
```
plus the shared class constants at the top of the file (`pill`, `textButton`) — reuse them, do not redefine.

**Analog for a save-as-you-go field** (`ProviderRow.tsx:230-275`, `BaseUrlField`):
```typescript
function BaseUrlField({ row, onChange }: { row: ProviderView; onChange: (row: ProviderView) => void }) {
  const stored = row.base_url ?? '';
  const [value, setValue] = useState(stored);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, tick] = useTick();

  useEffect(() => setValue(stored), [stored]);

  const save = async () => {
    const v = value.trim();
    if (v === stored) return;
    setSaving(true);
    setErr(null);
    try {
      onChange(await api.setProvider(row.id, { base_url: v }));
      tick();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  …
      <input … onBlur={() => void save()} onKeyDown={blurOnEnter} disabled={… || saving} className={`${field} font-mono h-10`} />
      {row.base_url_locked ? (
        <p className={noteLine}>Set by {row.base_url_locked} in your environment. Unset it to change the address here.</p>
      ) : err ? (
        <p className={errLine}>{err}</p>
      ) : saved ? (
        <p className={tickLine}>saved · applies from the next turn</p>
      ) : null}
```
Copy wholesale for the search key and search base URL: `onBlur` as the single save path, `blurOnEnter` (`ProviderRow.tsx:31-37`) so Enter routes through it, the no-op when the value is unchanged, `useTick()` for the 1800 ms `saved` line, errors as `string | null` state rendered inline, and the lock sentence naming the environment variable. D-16's prices sentence is a `<p className={noteLine}>` and nothing else — no input.

**Masked-key shape** on the API side is `keys.ts` `keyView` (lines 108-111):
```typescript
export const keyView = (provider: string): { set: boolean; hint: string | null } => {
  const v = keyOf(provider);
  return v ? { set: true, hint: hintOf(v) } : { set: false, hint: null };
};
```

---

### `web/src/lib/api.ts` and `types.ts`

New endpoints are new keys on the single `api` object (`api.ts:107-121`), e.g.:
```typescript
  settings: () => get('/api/settings').then((r) => j<Settings>(r)),
  setProvider: (id: string, body: { key?: string; model?: string; base_url?: string }) => post(`/api/settings/${id}`, body, 'PUT').then((r) => j<ProviderView>(r)),
```
Never `fetch` from a component; `j<T>` already turns the server's `{ error }` into a thrown `Error` whose message the page renders. Types are hand-mirrored in `types.ts`; `EVENT_TYPES` and `applyEvent` in `useLesson.ts` are deliberately **not** touched (D-09, D-10, D-17).

---

### `server/test/api-driver.test.ts` (test)

**Analog:** `server/test/driver.test.ts` (lines 1-56).
```typescript
// db.ts opens the database on import, and backend() shells out to `claude auth
// status` on its first call; pin both before anything under src/ is imported.
const scratch = mkdtempSync(join(tmpdir(), 'derive-test-'));
process.env.DERIVE_DATA_DIR = scratch;
process.env.DERIVE_BACKEND = 'claude';

const { createLesson, lastTurn, listEvents } = await import('../src/db.js');
const { runTurn } = await import('../src/agent.js');
const { setDriverOverride } = await import('../src/driver.js');

// A dynamic import cannot carry types across, and a static one would open the
// database before the scratch directory above is set; these are type positions
// only, so nothing is imported at run time.
type Driver = import('../src/driver.js').Driver;

after(() => rmSync(scratch, { recursive: true, force: true }));

async function turnOn(driver: Driver, script: FakeStep[] | null, prompt = 'teach me') {
  const id = randomUUID();
  createLesson(id, 'The driver seam');
  const live: StoredEvent[] = [];
  const unsubscribe = subscribe(id, (ev) => live.push(ev));
  if (script) setFakeScript(script);
  setDriverOverride(driver);
  try {
    await runTurn(id, prompt);
  } finally {
    setDriverOverride(null);
    unsubscribe();
  }
  return { id, live, stored: listEvents(id) };
}
```
Copy: the scratch-dir-then-dynamic-import preamble with its comment, the `type X = import('…')` trick, `after(() => rmSync(…))`, the `setDriverOverride` try/finally harness, `subscribe` to capture the live stream alongside `listEvents`. Per the discretion note the stub is a fake `LanguageModel` (`MockLanguageModelV4` from `ai/test`) handed to the **real** `api.ts` loop — so this harness drives `runTurn` with `setDriverOverride(apiDriverWithStubModel)`, not a second fake driver. `usage.test.ts` (lines 1-40) is the analog for asserting the usage rows a turn leaves behind, and `server/test/spawn.ts` for anything needing a live server.

The EVENT_TYPES copy at `driver.test.ts:34-37` is the guard that the new driver introduces no event type; the new suite should assert against it too.

---

### `server/test/wire-surface.json` / `wire-surface.test.ts`

**Analog:** the test's own assertions.
```typescript
assert.deepEqual(live, JSON.parse(onDisk), 'the tool contract changed; read the diff, then regenerate wire-surface.json deliberately');
…
assert.deepEqual([...DERIVE_TOOL_NAMES], TUTOR_TOOLS_BEFORE);
assert.deepEqual(TOOL_LABELS, TOOL_LABELS_BEFORE);
assert.equal(ALL_TOOL_NAMES.length, 22);
assert.equal(DERIVE_TOOL_NAMES.length, 14);
assert.equal(live.mcp.length, 22, 'the MCP server is what the Claude Code plugin sees; the snapshot must cover all of it');
assert.equal(live.http.length, 16, 'the fourteen tutor tools plus answer and answer_in');
```
RESEARCH Pitfall 8: D-21's new tool breaks five of these, and the file's own header forbids regenerating to go green:
```
 * A failing diff means the contract the model reads has changed. That is not a
 * broken test, it is the review: … Only then regenerate the fixture, by running
 * the suite once with DERIVE_WRITE_WIRE_SURFACE=1 … Never regenerate it merely
 * to make this test go green.
```
So moving those numbers and the two `*_BEFORE` lists is a deliberate, named task with the regenerated fixture in the same diff. D-29's dialect-rules assertions follow the existing style: `assert.equal(schema.additionalProperties, false)` / `assert.deepEqual(Object.keys(props).sort(), required.sort())` with a sentence as the third argument.

---

## Shared Patterns

### Errors
**Sources:** `server/src/db.ts`, `server/src/probe.ts:268-289`, `server/src/secrets.ts` `safeMessage`
**Apply to:** every new server module
```typescript
throw new Error('turn not found');                      // plain, lowercase, learner-readable
const msg = e instanceof Error ? e.message : String(e); // always narrow on the server
return c.json({ error: safeMessage(e) }, 400);          // routes answer { error }
void runTurn(id, text).catch((e) => console.error('[turn]', e)); // fire-and-forget
catch { /* not installed */ }                            // best-effort, one-word why
```
Provider errors go through `providerSentence(status, text)` + `hintFor(label, status, sentence)` — never a second vocabulary.

### Secrets
**Source:** `server/src/keys.ts:124-125`, `server/src/secrets.ts`
**Apply to:** the search key, anything reaching a log, event or export
```typescript
registerSecret(v);
persist({ ...store, [provider]: v });   // registered before it is written
```
A value is registered the moment it is known; `safeMessage`/`redactErrors` wrap anything on the way out.

### Config
**Source:** `server/src/config.ts`
**Apply to:** `PRICES_PATH`, the search-provider variables
`process.env` is read exactly once, in `config.ts`, and exported as UPPER_SNAKE constants. No new module reads `process.env` (the standalone `mcp.ts` is the only exception and is not touched here).

### Module headers and comments
**Source:** `server/src/driver.ts:1-27`, `server/src/migrations.ts:1-27`, `server/src/schedule.ts:1-14`
**Apply to:** all seven new server modules
A `/** … */` prose header per module explaining the *why* and the reasoning that must not be undone by accident; one-line `/** … */` on every export; inline `//` comments only for a non-obvious why, one sentence, plain English. No TODO/FIXME, no `@ts-expect-error`, no `@param`.

### Style
Single quotes, semicolons, trailing commas, 2-space indent, long lines accepted (do not reflow), `.js` extensions on every server import, named exports only (no `export default`, no barrels), `for (const x of xs)` on the server, nullish coalescing and optional chaining by default, numeric separators (`1_000`, `86_400_000`), `const` arrows for small helpers and `function` declarations for anything documented.

### Tests
**Source:** `server/test/driver.test.ts`, `server/test/usage.test.ts`, `server/test/spawn.ts`
`node:test` + `node:assert/strict`, scratch `DERIVE_DATA_DIR` set before dynamic imports, `after(() => rmSync(scratch, …))`, `spawn.ts` for OS-allocated ports. Nothing may touch `~/.derive/derive.db`.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| the `turn_messages` codec inside `server/src/drivers/api.ts` | serialisation | transform | Nothing in the repo persists a provider-neutral message array; `lessons.session_id` is the only existing resume state and it is an opaque id. Follow RESEARCH Finding 11 and Pattern 1 (accumulate from `fullStream`, never `responseMessages`). |
| the retry/backoff controller in `server/src/drivers/api.ts` | control flow | event-driven | No retry loop exists anywhere in the repo (`probe.ts` is single-shot with a timeout). Shape it from RESEARCH Finding 8 (`maxRetries: 0`, `APICallError.responseHeaders['retry-after']`) and emit the countdown through the `emitEphemeral('status', …)` pattern above. |

Partial-analog note: `server/src/drivers/adapters.ts` has a strong *structural* analog in `probe.ts` `requestFor`, but no analog for the AI SDK model-factory and `providerOptions` payloads themselves — those come from RESEARCH §Code Examples (the skeleton that compiled under this repo's flags).

---

## Metadata

**Analog search scope:** `server/src/`, `server/src/drivers/`, `server/test/`, `web/src/pages/`, `web/src/components/`, `web/src/lib/`, `method/`
**Files scanned:** 45; read in detail: 18
**Tracked-source check:** `git ls-files` confirmed all 23 named analog paths are tracked
**Pattern extraction date:** 2026-10-01
