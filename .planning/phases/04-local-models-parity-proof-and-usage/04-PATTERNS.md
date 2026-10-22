# Phase 4: Local Models, Parity Proof and Usage - Pattern Map

**Mapped:** 2026-10-22
**Files analyzed:** 19 (5 new, 14 modified)
**Analogs found:** 18 / 19

All analog paths below were checked against `git ls-files` (tracked source, no gitignored mirrors).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `server/src/drivers/adapters.ts` (modify: 3 local rows) | config/table | request-response | same file, `case 'openai-compatible'` (lines 356–397) | exact |
| `server/src/capability.ts` (NEW) | service | request-response | `server/src/probe.ts` (`LOCAL_PROBES`, `isLlamaCpp`, `getJson`, `testConnection`) | exact |
| `server/src/probe.ts` (modify: `postJson`) | utility | request-response | same file, `getJson` (lines 306–325) + `probeJson` (65–77) | exact |
| `server/src/context.ts` (modify: `tools` field) | pure logic | transform | same file, `headroomCheck` (47–57) | exact |
| `server/src/settings.ts` (modify: `numCtxKey`) | utility/config | CRUD | same file, `modelKey`/`baseUrlKey` (57, 60), `normaliseBaseUrl` (98–109) | exact |
| `server/src/providers.ts` (modify: `teaches: true`, notes) | config | — | same file, `openai-compatible` row (150–162) | exact |
| `server/src/index.ts` (modify: `num_ctx` on `SettingsWrite`, 3 new routes) | route | request-response | same file, `SettingsWrite` (357–374), `PUT /api/settings/:provider` (549+), `POST /api/settings/search/test` (546) | exact |
| `server/src/materials.ts` (modify: outline-only render, D-09) | service | transform | same file, `materialsSection` (279+) and its char-budget helper (265–276) | exact |
| `server/src/db.ts` (modify: rejection counter, usage read) | model/storage | CRUD | same file, `recordUsage`/`listUsage` (698–760) | exact |
| `server/src/migrations.ts` (modify: migration 8, if a table) | migration | batch | same file, migration 6 `tool_results` (~280–296) and 7 (298–304) | exact |
| `server/src/drivers/api.ts` (modify: pass `tools`, record rejections, `usageTotals` sibling) | service | streaming | same file, `lessonCost` (56–60), `headroomCheck` call (505–522), `validateToolInput` (455) | exact |
| `web/src/components/ProviderRow.tsx` (modify: `NumCtxField`, `TestTeaching`) | component | request-response | same file, `BaseUrlField` (210–263) and the test action (478–497) | exact |
| `web/src/pages/Usage.tsx` (NEW) | component/page | request-response | `web/src/pages/You.tsx` (1–70: load-on-mount, `error` string state) | role-match |
| `web/src/main.tsx` (modify: `/usage` route) | config | — | same file (lines 13–22) | exact |
| `web/src/lib/api.ts` (modify: `usage`, `testTeaching`, `probeCapability`) | utility | request-response | same file, `settings`/`testProvider`/`setProvider` (104–118) | exact |
| `web/src/lib/types.ts` (modify: `num_ctx`, capability, `UsageView`) | model/type | — | same file, `ProviderView` (34–65), `TestResult` (77) | exact |
| `server/test/capability.test.ts` (NEW) | test | transform | `server/test/cost.test.ts` / `server/test/settings.test.ts` (pure, literal-driven) | role-match |
| `scripts/conformance.mjs` (NEW) | script | batch | `scripts/check-method.mjs` (1–40: shebang, prose header, non-zero exit, temp dir) | role-match |
| `.github/workflows/conformance.yml` (NEW) | config/CI | batch | `.github/workflows/ci.yml` (whole file: the four setup steps) | role-match |

## Pattern Assignments

### `server/src/drivers/adapters.ts` — three local rows (adapter table, request-response)

**Analog:** the `openai-compatible` row in the same file. Replace the throwing cases at lines 400–404:

```ts
    case 'ollama':
    case 'lmstudio':
    case 'llamacpp':
      throw new Error(`${labelOf(provider)} has no owned-loop adapter yet`);
```

**Row shape to copy** (lines 356–397) — every field, in this order, each with a `//` comment stating the *why*:

```ts
    case 'openai-compatible':
      return {
        dialect: 'full',
        cacheHook: () => undefined,
        model: (key, base, modelId) => {
          if (!base) throw new Error("Add the endpoint's base URL first");
          if (!modelId) throw new Error('Choose a model for the endpoint first');
          return createOpenAICompatible({ name: 'openai-compatible', apiKey: key, baseURL: v1(base), includeUsage: true, fetch: noRedirectFetch })(modelId);
        },
        search: () => null,
        cost: () => ({ cost_usd: null, cost_source: 'unknown', searches: null }),
      };
```

Copy verbatim for `lmstudio` / `llamacpp` (change `name:`, keep `v1(base)`, `includeUsage: true`, `noRedirectFetch`); for `ollama` substitute `createOllama(...)` per RESEARCH §Pattern 2. All three take `dialect: 'compact'` (D-08) and `cost: () => ({ cost_usd: null, cost_source: 'unknown', searches: null })`.

Module header rule (lines 1–26): the docstring already argues "adding a provider should be one row … not a sixth `if`". Do not add a fallthrough `default`.

---

### `server/src/capability.ts` (NEW — service, request-response)

**Analog:** `server/src/probe.ts`.

**Module header** — copy the prose-paragraph style of `probe.ts` lines 1–46 (what it is for, then the reasoning, then "nothing here runs unasked", then "the environment is read only through `config.ts`").

**Imports pattern** (probe.ts 48–56):
```ts
import { providerOf, type ProviderSpec } from './providers.js';
import { safeMessage } from './secrets.js';
import { effectiveKey, localBase, portOf, type Local } from './settings.js';
```

**Per-server table + shape predicate** — copy `LOCAL_PROBES` (probe.ts 105–110) and the field-reading predicate style (82–94):
```ts
const field = (body: unknown, key: string): unknown => (body && typeof body === 'object' ? (body as Record<string, unknown>)[key] : undefined);

export const isLlamaCpp = (p: Probe): boolean =>
  !!p && ((p.status === 200 && field(p.body, 'status') === 'ok') || (p.status === 503 && field(field(p.body, 'error'), 'type') === 'unavailable_error'));

const LOCAL_PROBES: readonly { id: keyof Local; path: string; shape: (p: Probe) => boolean }[] = [
  { id: 'ollama', path: '/api/tags', shape: isOllama },
  ...
];
```
Every new probe predicate must read a *parsed field*, never only `p.status === 200` (Pitfall 3).

**Result shape** — copy `testConnection`'s "always answer, never throw" contract (probe.ts 352–369):
```ts
  try {
    const ids = await listModels(spec.id);
    return { ok: true, models: ids.length, ms: ms() };
  } catch (e) {
    const error = safeMessage(e);
    const hint = hintFor(spec.label, statusOf(error), error);
    return { ok: false, error, ...(hint ? { hint } : {}), ms: ms() };
  }
```

**Error sentences:** use `providerSentence` / `hintFor` / `unreachable` from `probe.ts`; never a regex over bodies.

---

### `server/src/probe.ts` — add `postJson` (utility, request-response)

**Analog:** `getJson`, same file (306–325). Copy the whole body and add a JSON body; keep both guards:

```ts
export async function getJson(url: string, headers: Record<string, string>, ms: number): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { accept: 'application/json', ...headers }, redirect: 'manual', signal: AbortSignal.timeout(ms) });
  } catch (e) {
    throw new Error(unreachable(url, e));
  }
  if (res.status >= 300 && res.status < 400) throw new Error(`${res.status} the server redirected elsewhere; derive does not follow redirects that could carry a key`);
  const text = await res.text();
  if (!res.ok) throw new Error(providerSentence(res.status, text));
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`${res.status} the response was not JSON`);
  }
}
```
For the Settings-open metadata pass use `probeJson`'s contract instead (65–77: non-JSON → `body: null`, status kept, any throw → `null`).

---

### `server/src/context.ts` — tool-surface-aware headroom (pure logic, transform)

**Analog:** the function itself (47–57). The change is one input field, one `estimateTokens` call, and a second reason string:

```ts
export function headroomCheck(
  input: { provider: string; model: string | null; instructions: string; messages: string; prompt: string },
  table: PriceTable,
): { refuse: false } | { refuse: true; reason: string } {
  const window = table[input.provider]?.[input.model ?? '']?.context;
  if (window == null) return { refuse: false };
  const estimate = estimateTokens(input.instructions) + estimateTokens(input.messages) + estimateTokens(input.prompt);
  if (estimate <= window * HEADROOM_FRACTION) return { refuse: false };
  return { refuse: true, reason: REFUSAL };
}
```

Refusal-string pattern to copy for the new `num_ctx` reason (line 36), including the UI-SPEC citation in the doc comment:
```ts
/** The verbatim refusal from 03-UI-SPEC.md §Copywriting Contract → Context-window refusal (A6). `Home` is the only link in the card … */
const REFUSAL = 'This lesson has grown too long to continue. Everything you locked is saved — start a review lesson on these nodes from Home.';
```
Keep the constants' comment style (lines 25, 28) — each constant states why the number is what it is. The stale comment at line 52 ("sizing an unlisted model is Phase 4's /api/show work") is this phase's and should be rewritten, not deleted silently.

**Call site to update:** `server/src/drivers/api.ts:511`
```ts
  const headroom = headroomCheck({ provider, model: ctx.model ?? null, instructions: ctx.instructions, messages: JSON.stringify(prior), prompt: ctx.prompt }, priceTable());
  if (headroom.refuse) {
    sink.endTurn({ ok: false, error: headroom.reason, lesson_cost: endingCost(ctx) });
    return;
  }
```

---

### `server/src/settings.ts` — `numCtxKey` (utility, CRUD)

**Analog:** same file, lines 54–82:
```ts
export const modelKey = (id: string) => `model:${id}`;
export const baseUrlKey = (id: string) => `base_url:${id}`;

export function localBase(spec: Pick<ProviderSpec, 'id' | 'endpoint'>): string | null {
  return getSetting(baseUrlKey(spec.id)) ?? spec.endpoint;
}
```
Add `export const numCtxKey = (id: string) => `num_ctx:${id}`;` plus a `numCtxFor(id)` reader that falls back to the default, mirroring `localBase`'s "stored ?? catalogue default" shape. If an env lock is wanted, extend `lockedBy`'s field union (line 214) — do not read `process.env` here.

**Validation sentence style** — `normaliseBaseUrl` (98–109): each refusal is the sentence the row shows, lowercase, plain `Error`.

---

### `server/src/index.ts` — `num_ctx` field + three routes (route, request-response)

**Zod write schema** (357–374) — add `num_ctx` as a fourth field with `.int().min().max()` and a `.describe()`; keep `.strict()`:
```ts
const SettingsWrite = z
  .object({
    key: z.string().max(4096, 'the key is longer than any provider issues').optional().describe('The API key to store for this provider. Never read back.'),
    model: z.string().trim().max(200, 'the model id is longer than any provider issues').regex(/^[A-Za-z0-9._:/-]*$/, 'the model id may only contain letters, digits, . _ : / and -').optional().describe('…'),
    base_url: z.string().trim().max(500, 'the base URL is longer than any endpoint needs').optional().describe('…'),
  })
  .strict();
```

**Write-route pattern** (549+) — unknown id → 404, parse failure → first issue's message at 400, env lock → 409 naming the variable, success → the row view:
```ts
app.put('/api/settings/:provider', async (c) => {
  const spec = providerOf(c.req.param('provider'));
  if (!spec) return c.json({ error: 'unknown provider' }, 404);
  const parsed = SettingsWrite.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'the settings body could not be read' }, 400);
  ...
  if (base_url !== undefined && spec.auth !== 'key+url' && !spec.port) return c.json({ error: `${spec.label} has a fixed endpoint` }, 400);
```

**Test-style action route** (546) — a POST that always answers 200 with a result object, never throws:
```ts
app.post('/api/settings/search/test', async (c) => c.json(await testSearch()));
```
Copy this for `POST /api/settings/:id/test-teaching` and `POST /api/settings/:id/capability`.

**Row view** (`rowView`, 403–427) — add `num_ctx` / capability keys here; the browser renders what this returns and hard-codes nothing. Note the existing lock comment: *"A locked address shows where the row is actually probed"*.

**Learner scoping for `/api/usage`** — use `learnerOf(c)`, as `GET /api/settings/active` does (line 476); never a client-supplied `learner_id`.

**Error wrapper used by every settings route:**
```ts
  } catch (e) {
    return c.json({ error: safeMessage(e) }, 400);
  }
```

---

### `server/src/materials.ts` — outline-only render (service, transform)

**Analog:** `materialsSection(lessonId)` (279+) plus the char-budget joiner immediately above it (265–276):
```ts
  const out: string[] = [];
  let len = 0;
  for (const e of entries) {
    if (len + e.length > budget) {
      out.push(`… (${entries.length - out.length} more)`);
      break;
    }
    out.push(e);
    len += e.length + 3;
  }
  return out.join(' · ');
```
Add a surface parameter to `materialsSection` and emit titles/keywords on the local surface. The method-body prose inside this function is rendered method text — do **not** fork it; the outline change is a per-surface render (CI gate: `pnpm method:check`).

---

### `server/src/db.ts` — rejection counter and the usage read (model, CRUD)

**Analog:** `recordUsage` / `listUsage` (698–760).

**Write-path pattern** (the docstring is the contract to imitate — "the only way a usage row is ever written … never taken from the caller"):
```ts
export function recordUsage(turnId: string, row: UsageInput): UsageRow {
  const turn = getTurn(turnId);
  if (!turn) throw new Error('turn not found');
  ...
  q.insertUsage.run(turn.id, turn.lesson_id, turn.learner_id, turn.driver, model, count(row.input_tokens), …, ts);
  return listUsage({ turn: turn.id }).at(-1)!;
}
```

**Read pattern — one indexed read per filter, never a scan:**
```ts
export function listUsage(filter: { turn?: string; lesson?: string; learner?: string } = {}): UsageRow[] {
  if (filter.turn) return q.usageOfTurn.all(filter.turn) as UsageRow[];
  if (filter.lesson) return q.usageOfLesson.all(filter.lesson) as UsageRow[];
  if (filter.learner) return q.usageOfLearner.all(filter.learner) as UsageRow[];
  return q.allUsage.all() as UsageRow[];
}
```
`count()` (line ~712) is the "null, never zero, never an estimate" guard — reuse it for any new numeric column.

**Aggregate for COST-03** — copy `lessonCost` from `server/src/drivers/api.ts:56-60` with `{ learner }` and grouping:
```ts
export function lessonCost(lessonId: string, extra: readonly CostRow[] = []): string | null {
  const rows = [...listUsage({ lesson: lessonId }), ...extra];
  const { usd, source } = costOf(rows, priceTable());
  return costLabel(usd, rows.length ? source : null);
}
```

---

### `server/src/migrations.ts` — migration 8 (migration, batch)

**Analog:** migrations 6 and 7 (280–304):
```ts
  {
    version: 7,
    name: 'learner-model-per-provider',
    up(db) {
      convertLearnerModelPrefs(db);
    },
  },
```
A new table goes in an `up(db)` as a single `db.exec(\`CREATE TABLE … ; CREATE INDEX …\`)` like migration 6's `tool_results` + `tool_results_turn` index. The runner is transactional and `PRAGMA user_version`-gated; never add an inline `ALTER TABLE` in `db.ts`.

---

### `web/src/components/ProviderRow.tsx` — `NumCtxField` + `TestTeaching` (component, request-response)

**Analog for the field:** `BaseUrlField` (210–263) — copy it whole (prose doc comment, the five state hooks, `useEffect` resync, save-on-blur with early return when unchanged, the four-way note line):

```tsx
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

  return (
    <div className="min-w-0 md:col-span-2">
      <input value={value} onChange={(e) => setValue(e.target.value)} onBlur={() => void save()} onKeyDown={blurOnEnter}
        disabled={!!row.base_url_locked || saving} placeholder={row.base_url_default ?? 'https://…'}
        aria-label={`${row.label} base URL`} spellCheck={false} autoComplete="off" className={`${field} font-mono h-10`} />
      {row.base_url_locked ? (<p className={noteLine}>…</p>) : err ? (<p className={errLine}>{err}</p>) : saved ? (<p className={tickLine}>saved · applies from the next turn</p>) : null}
    </div>
  );
}
```

**Analog for the action + result line:** the test block (478–497):
```tsx
        <button type="button" onClick={() => void test()} disabled={testing} className={textButton}>
          {testing ? 'testing…' : 'test connection'}
        </button>
        {result && (
          <span role="status" title={resultText(result)} className={`ml-auto min-w-0 max-w-full truncate font-mono text-[10px] ${result.ok ? 'text-moss-400' : 'text-rust-400'}`}>
            {resultText(result)}
          </span>
        )}
```
`test teaching` renders on `row.teaches` (D-13). Result sentences come from the server; the browser only picks the colour.

**Class names come only from `fields.ts`** — `field`, `pill`, `textButton`, `tickLine`, `errLine`, `noteLine`, `blurOnEnter`, `useTick`. The 32px hit area lives only inside `textButton`; never hand-roll the class string (see the module header's Phase 2 gap-closure note).

---

### `web/src/pages/Usage.tsx` (NEW — page, request-response)

**Analog:** `web/src/pages/You.tsx` (1–70).

Patterns to copy:
- Named export `UsagePage`, one component per file, `import { api } from '../lib/api'`, `import type { … } from '../lib/types'` (no extensions).
- Back link in the header: `<Link to="/settings" className="text-ink-400 hover:text-ink-50 transition-colors" title="…">` (the shape at `Settings.tsx:98`).
- Load on mount with the `.catch((e) => setErr((e as Error).message))` tail and `// eslint-disable-next-line react-hooks/exhaustive-deps` on the empty-dep effect:
```tsx
  const load = () => api.profile().then((r) => { … }).catch((e) => setErr((e as Error).message));
  useEffect(() => { void (async () => { … })(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```
- Error as `string | null` in state, rendered; never an `Error` object.
- **Render the server's strings.** No `toFixed`, no `Intl.NumberFormat`. `costLabel` (server/src/cost.ts:126-135) produces `about $x.xx billed` / `under $0.01 estimated` / `not billed` / `not reported`; the page prints them.

---

### `scripts/conformance.mjs` (NEW — script, batch)

**Analog:** `scripts/check-method.mjs` (1–40).
```js
#!/usr/bin/env node
/**
 * `pnpm method:check`: renders the method into a throwaway directory and
 * compares every rendered target, byte for byte, with the copy committed to
 * git. It writes nothing into the repository and exits non-zero, naming each
 * file, when any of them has drifted.
 * …
 */
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
```
Copy: shebang, prose header stating what it gates and why it fails rather than fixing, `root` resolution from `import.meta.url`, a `report()`-style human summary, non-zero exit naming each failure, `try/finally` cleanup of the temp dir. Every recorded sentence goes through `safeMessage` and every env key through `registerSecret` (`server/src/secrets.ts:49,112`) before it reaches the report (T-04-01).

Register it in `ci.yml`'s parse loop (the `Standalone scripts parse` step) alongside the other four `.mjs` files.

---

### `.github/workflows/conformance.yml` (NEW — CI config, batch)

**Analog:** `.github/workflows/ci.yml` — copy the four setup steps verbatim, including the inline comment:
```yaml
    steps:
      - uses: actions/checkout@v7

      - uses: pnpm/action-setup@v6
        # The version comes from packageManager in package.json.

      - uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: pnpm

      - name: Install
        run: pnpm install --frozen-lockfile
```
Also copy: `timeout-minutes`, a `concurrency` group, and the habit of a comment above each non-obvious step explaining *why* it exists.

---

### `server/test/capability.test.ts` (NEW — test, transform)

**Analogs:** `server/test/cost.test.ts` / `settings.test.ts` for pure parsers (literals only, no DB); `server/test/usage.test.ts` (1–40) when a DB is unavoidable:

```ts
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
const scratch = mkdtempSync(join(tmpdir(), 'derive-usage-'));
process.env.DERIVE_DATA_DIR = scratch;
process.env.DERIVE_BACKEND = 'claude';
const { COST_SOURCES, createLesson, lastTurn, listEvents, listUsage } = await import('../src/db.js');
after(() => rmSync(scratch, { recursive: true, force: true }));
```
Rules encoded there and binding here: scratch `DERIVE_DATA_DIR` set **before** any dynamic `await import('../src/…js')`, `after()` cleanup, and the file-header note *"Nothing in this file may touch ~/.derive/derive.db."* `capabilityOf` / `maxWindowOf` parsers need none of this — test them from literals.

## Shared Patterns

### Error sentences (all new server code)
**Source:** `server/src/probe.ts:261-299`, `server/src/index.ts` route tails
**Apply to:** `capability.ts`, every new route, the harness
```ts
export function providerSentence(status: number, text: string): string { … }        // the server's own words, one line, 300 chars
export function hintFor(label: string, status: number, sentence: string): string | undefined { … }  // Derive's fix, a separate field
function unreachable(url: string, e: unknown): string { … }                          // `nothing answered at ${u.hostname}:${portOf(url)}`
```
plus, at every route boundary: `return c.json({ error: safeMessage(e) }, 400);`

### Redaction
**Source:** `server/src/secrets.ts:49,112`
**Apply to:** the harness report (highest-value new control), `capability.ts`, every route
```ts
export function registerSecret(value: string | null | undefined): void { … }
export const safeMessage = (e: unknown): string => redactErrors(e instanceof Error ? e.message : String(e));
```

### Money and labels
**Source:** `server/src/cost.ts:49,126-135`
**Apply to:** `/api/usage`, `Usage.tsx` (render only)
```ts
const LABEL: Record<CostSource, string> = { provider: 'billed', table: 'estimated', subscription: 'not billed', unknown: 'not reported' };

export function costLabel(usd: number | null, source: CostSource | null): string | null {
  if (source === null) return null;
  const label = LABEL[source];
  if (source === 'subscription' || source === 'unknown') return label;
  if (usd === null || usd <= 0) return label;
  if (usd < 0.005) return `under $0.01 ${label}`;
  return `about $${usd.toFixed(2)} ${label}`;
}
```

### Web field vocabulary
**Source:** `web/src/components/fields.ts` (whole file)
**Apply to:** `NumCtxField`, `TestTeaching`, `Usage.tsx`
`field`, `pill`, `textButton`, `tickLine`, `errLine`, `noteLine`, `blurOnEnter`, `useTick` — compose (`${textButton} gap-1.5`), never restate a class string.

### API client
**Source:** `web/src/lib/api.ts:104-124`
**Apply to:** the three new endpoints — one new key on the `api` object, never a `fetch` in a component
```ts
  settings: () => get('/api/settings').then((r) => j<Settings>(r)),
  setProvider: (id: string, body: { key?: string; model?: string; base_url?: string }) => post(`/api/settings/${id}`, body, 'PUT').then((r) => j<ProviderView>(r)),
  testProvider: (id: string) => post(`/api/settings/${id}/test`).then((r) => j<TestResult>(r)),
```

### Types and doc comments
**Source:** `web/src/lib/types.ts:31-77`
**Apply to:** `ProviderView` additions, `UsageView`
PascalCase `type` aliases, unions of string literals (`ProviderStatus`), a discriminated result union (`TestResult = { ok: true … } | { ok: false; error: string; hint?: string; ms: number }`), and a one-sentence `/** … */` on every ambiguous field. Server rows stay snake_case through the wire (`base_url`, `num_ctx`, `cost_source`).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| the ephemeral scratch-lesson lifecycle inside `test-teaching` | service | request-response | No existing code creates a lesson it deletes in the same request. The pieces have analogs (`createLesson` db.ts:449-457, transactional `deleteLesson` db.ts:481-500, `setDriverOverride`/`setModelOverride` drivers/api.ts:107-111, the boot-time stale-`turn_start` sweep in `index.ts`), but their composition is new — follow RESEARCH §Pattern 6. |

## Metadata

**Analog search scope:** `server/src/`, `server/src/drivers/`, `server/test/`, `web/src/pages/`, `web/src/components/`, `web/src/lib/`, `scripts/`, `.github/workflows/`
**Files scanned:** 24 read, ~60 listed
**Pattern extraction date:** 2026-10-22
