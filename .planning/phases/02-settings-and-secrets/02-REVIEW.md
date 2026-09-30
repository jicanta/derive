---
phase: 02-settings-and-secrets
reviewed: 2026-09-30T23:07:19Z
depth: standard
files_reviewed: 26
files_reviewed_list:
  - .env.example
  - scripts/doctor.mjs
  - server/src/agent.ts
  - server/src/backend.ts
  - server/src/config.ts
  - server/src/db.ts
  - server/src/driver.ts
  - server/src/index.ts
  - server/src/keys.ts
  - server/src/mcp.ts
  - server/src/migrations.ts
  - server/src/probe.ts
  - server/src/providers.ts
  - server/src/settings.ts
  - server/test/mcp.test.ts
  - server/test/settings.test.ts
  - web/src/components/LearnerMenu.tsx
  - web/src/components/ProviderRow.tsx
  - web/src/lib/api.ts
  - web/src/lib/types.ts
  - web/src/lib/useLesson.ts
  - web/src/main.tsx
  - web/src/pages/Home.tsx
  - web/src/pages/Lesson.tsx
  - web/src/pages/Settings.tsx
  - web/src/pages/You.tsx
findings:
  critical: 0
  warning: 5
  info: 7
  total: 12
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-09-30T23:07:19Z
**Depth:** standard
**Files Reviewed:** 26
**Status:** issues_found

## Summary

The phase adds a provider catalogue (`providers.ts`), a per-call tutor resolver with three tiers (`settings.ts`), a 0600 `secrets.json` store (`keys.ts`), a detection/model-list/connection-test module (`probe.ts`), seven `/api/settings*` routes, a `settings` table (migration 5), a learner-level `prefs.model`, and a `/settings` page. The security posture is sound where it matters: keys are only ever written, never read back by any route; every route that could echo a provider's error passes it through `safeMessage`; requests follow no redirect; the Anthropic and Gemini keys ride in headers rather than the URL; the settings routes sit behind the existing `/api/*` token middleware; the `claude auth status` JSON never leaves the boolean. The atomic temp-file-plus-rename write and the "refuse to write while the file is unreadable" rule are both correct. I found no blocker.

The warnings are all correctness-of-behaviour rather than security: the learner-level model override is not scoped to a provider and silently breaks that learner's turns when the install switches provider; the read-only-by-contract `GET /api/settings/active` can block the event loop on a synchronous child process; `OLLAMA_HOST` with an explicit scheme is parsed differently from how Ollama itself parses it; a locked model field shows a value the environment outranks; and the You page silently drops an invalid model id while telling the learner it saved.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: A learner's model override is not scoped to a provider, so switching the install's provider breaks that learner's turns with no warning

**File:** `server/src/settings.ts:171-179`, `server/src/db.ts:275-277`, `web/src/pages/You.tsx:135-143`
**Issue:** `chooseModel(provider, learnerId)` returns `getLearner(learnerId)?.prefs.model` before it ever looks at which provider was chosen. The You page says the id is "on the active provider", but the stored value is a bare string with no provider attached. Sequence: the learner stores `claude-opus-5-5` while Claude Code is active; later anyone presses "Use this provider" on Codex; from that turn on `resolveTutor(learnerId)` returns `{ provider: 'codex', model: 'claude-opus-5-5', modelSource: 'learner' }`, the Codex driver is asked for a Claude model id, and every turn of that learner fails with the "model not found" error whose hint still says "Set DERIVE_MODEL in .env". Nothing on the Settings page shows the override (`settingsView` calls `currentTutor()` with no learner), so the install-wide view says the tutor is fine. The reverse also holds: a Codex id stored by a learner is sent to the Claude SDK after the install switches to Claude Code.
**Fix:** Scope the preference to a provider, or clear it on a provider switch. The smallest change is to key the learner value the same way the install one is keyed:

```ts
// db.ts LearnerPrefs
/** A model id for this learner alone, keyed by the provider it was chosen for. */
model?: Record<string, string>;   // { 'claude-code': 'claude-opus-5-5' }

// settings.ts chooseModel
const own = learnerId ? getLearner(learnerId)?.prefs.model?.[provider] : undefined;
```

If a flat string must stay for this release, at least drop it when it cannot apply: in `chooseModel`, ignore `own` when `provider !== getSetting(ACTIVE_PROVIDER_AT_SAVE)` or, simpler, record the provider alongside the model when `cleanPrefs` stores it and compare in `chooseModel`. Either way, `settingsView` should surface the override (e.g. `active.learner_overrides: number`) so the page does not claim one model while a learner runs another.

### WR-02: `GET /api/settings/active` can block the event loop on a synchronous `claude auth status` spawn, on a route the module's own contract calls read-only

**File:** `server/src/index.ts:436`, `server/src/settings.ts:156-160,182-185`, `web/src/pages/You.tsx:45`
**Issue:** `resolveTutor()` falls to `observeLogins()` whenever neither `DERIVE_BACKEND` nor a stored `active_provider` decides and the observation is older than `DETECT_MS` (30 s). `observeLogins()` calls `claudeLoggedIn()`, which is `execFileSync('claude', ['auth','status'], { timeout: 15000 })`. `GET /api/settings/active` calls `resolveTutor(learnerOf(c))` on every request, and the You page calls it on every mount (`api.activeTutor()`), as does the MCP server on every `start_lesson`. On a fresh install where nobody has pressed "Use this provider" (the default state), each You-page open more than 30 s after the last observation stalls the whole process for the CLI's run time (hundreds of milliseconds normally, up to 15 s if the CLI hangs), during which every SSE stream of every running lesson stops delivering deltas. The module header says a read-only route "calls `currentTutor()`, which reports the last observation whatever its age and never spawns anything"; this route is the one exception, and it is the one the browser hits.
**Fix:** Make the GET route non-spawning and keep the per-turn refresh where it is:

```ts
// settings.ts
/** currentTutor, for a named learner: the same tiers, never a spawn. */
export function currentTutorFor(learnerId?: string): TutorChoice {
  const { provider, source } = chooseProvider(() => lastDetection()?.logins);
  return { provider, source, ...chooseModel(provider, learnerId) };
}

// index.ts
app.get('/api/settings/active', (c) => c.json(currentTutorFor(learnerOf(c))));
```

If the route must reflect a fresh observation, use `claudeLoggedInAsync()` from `probe.ts` and `await` it rather than the sync detector.

### WR-03: `ollamaHostBase` forces port 11434 onto an `OLLAMA_HOST` that carries an explicit scheme, which is not how Ollama reads that variable

**File:** `server/src/settings.ts:68-77`
**Issue:** The docstring and `.env.example` both promise the value is read "as Ollama's own CLI reads it". Ollama's `envconfig.Host()` defaults the port to 11434 only when no scheme is given; with `http://` it defaults to 80 and with `https://` to 443. Derive's version does `if (!u.port) u.port = '11434'` unconditionally, so `OLLAMA_HOST=https://ollama.example.com` (a reverse-proxied instance, the common reason to set the variable at all) is probed and listed at `https://ollama.example.com:11434`. The row reads `not configured`, the model list says `nothing answered at ollama.example.com:11434`, and the disabled base-URL input shows that wrong address as where the row "is actually probed" (`rowView` line 402 comment).
**Fix:**

```ts
function ollamaHostBase(raw: string): string {
  const trimmed = raw.trim();
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed);
  const withScheme = hasScheme ? trimmed : `http://${trimmed}`;
  try {
    const u = new URL(withScheme);
    // Ollama defaults the port to 11434 only when no scheme was given; an explicit http/https keeps 80/443.
    if (!u.port && !hasScheme) u.port = '11434';
    return `${u.origin}${u.pathname.replace(/\/+$/, '')}`;
  } catch {
    return withScheme;
  }
}
```

Add a case to the `base URLs and probes` test group for `https://host` staying on 443.

### WR-04: A model field locked by `DERIVE_MODEL` shows the stored or default id, not the id the environment actually runs

**File:** `server/src/index.ts:397,401-403`, `web/src/components/ProviderRow.tsx:310,441`
**Issue:** `rowView` returns `model: getSetting(modelKey(spec.id)) ?? null` regardless of `model_locked`, and `ProviderRow` paints `row.model ?? row.default_model` into the disabled input. With `DERIVE_MODEL=pinned-model` the Anthropic row shows `claude-opus-5-5` greyed out with "Set by DERIVE_MODEL in your environment" under it; the learner reads the wrong id as the one that is set. The base-URL field in the same function does the opposite on purpose (`base_url: baseUrlLocked ? localBase(spec) : ...`, with a comment saying a disabled input must read the environment's value rather than one it outranks). The two fields contradict each other, and the header pill reads `pinned-model` while every row reads something else.
**Fix:** Apply the base-URL rule to the model:

```ts
// index.ts rowView
const modelLocked = lockedBy('model');
...
model: modelLocked ? MODEL ?? null : (getSetting(modelKey(spec.id)) ?? null),
model_locked: modelLocked,
```

(`MODEL` is already exported from `config.ts`; import it or expose a `lockedModel()` from `settings.ts` so `index.ts` keeps reading the environment only through `config.ts`.)

### WR-05: The You page reports "saved" while the server silently drops an invalid model id, and labels the learner's own id as the install default

**File:** `server/src/db.ts:275-277`, `web/src/pages/You.tsx:45,52-60,135-143`
**Issue:** Two related defects on the same field. (a) `cleanPrefs` truncates the model to 200 characters and then drops it entirely when it fails `/^[A-Za-z0-9._:/-]+$/` (a space, a comma, an accidental paste of two ids). `PATCH /api/learners/:id` returns 200 with the learner minus that field, `save()` sets `draft` from the response, the input empties and the button reads "Saved" for 1.8 s. The learner is told their choice was saved when it was thrown away; the install route for the same field returns 400 with the sentence "the model id may only contain letters, digits, . _ : / and -". (b) `api.activeTutor()` sends the `x-derive-learner` header like every other call, so on a learner who already has a model, `installModel` is that learner's own model, and the placeholder that appears when they clear the field reads `install default: <their own id>`. It is not refetched after save, so the wrong "install default" persists after they clear and save.
**Fix:** (a) Validate before storing and throw the same sentence the settings route uses:

```ts
// db.ts cleanPrefs
const model = str('model');
if (model) {
  if (model.length > 200) throw new Error('the model id is longer than any provider issues');
  if (!/^[A-Za-z0-9._:/-]+$/.test(model)) throw new Error('the model id may only contain letters, digits, . _ : / and -');
  out.model = model;
}
```

`PATCH /api/learners/:id` already wraps `updateLearnerPrefs` in try/catch and returns 400, and the You page already renders `err`. Note `toLearner` also calls `cleanPrefs` on read, so wrap that read-side call's throw in the existing `catch { /* unreadable prefs read as none */ }` or split the validation from the cleaning. (b) Fetch the install default without the learner header (add a `withoutLearner` option to `get()` in `api.ts`, or a dedicated `GET /api/settings` read of `active.model`), and refetch after save.

## Info

### IN-01: `PUT /api/settings/:provider` applies fields in sequence, so a refused `base_url` leaves an already-written `key` or `model` in place behind a 400

**File:** `server/src/index.ts:476-490`
**Issue:** `setKey`, then `setSetting(model)`, then `normaliseBaseUrl(base_url)` run in order inside one try. A body carrying `{ model: 'x', base_url: 'ftp://…' }` stores the model and answers 400 "the base URL must start with http:// or https://". The web sends one field per request so it never hits this, but the route accepts all three and the answer reads as "nothing was stored".
**Fix:** Validate everything (`normaliseBaseUrl`, the key's length/whitespace checks) before the first write, or write the settings-table fields inside `transaction()` from `db.ts` and run the key write last.

### IN-02: The web `TutorChoice.modelSource` union omits `'learner'`, which the server returns from `/api/settings/active`

**File:** `web/src/lib/types.ts:74-80`, `server/src/settings.ts:42`
**Issue:** The server's `ModelSource` is `'environment' | 'learner' | 'settings' | 'default' | null`; the web type lacks `'learner'`. Nothing narrows on it today, so it is only a drift in the hand-mirrored types, but the next `switch` on `modelSource` will be wrong for the learner-owned case.
**Fix:** Add `'learner'` to the web union with the same one-line comment the server has.

### IN-03: Keys shorter than 16 characters are stored but never registered for redaction, contrary to what `keys.ts` promises

**File:** `server/src/keys.ts:116-126`, `server/src/secrets.ts:115,129-133`
**Issue:** `setKey` accepts any non-blank, whitespace-free value of 1 to 4096 characters and says "registered before it is written, so no egress between the two can carry it". `registerSecret` silently ignores values under `MIN_SECRET_CHARS` (16). A learner who stores a short bearer token for the LM Studio or llama.cpp row gets a key that neither `redact` nor the `KEY_PATTERNS` backstop will remove from a provider's echoed error. The `secrets.ts` floor is deliberate and right; the `keys.ts` claim is what is wrong.
**Fix:** Either refuse the key in `setKey` (`if (v.length < 16) throw new Error('the key is shorter than any provider issues')`, with the row sentence) or amend the docstring to say values under 16 characters are stored unredacted, and why.

### IN-04: `persist` leaves the 0600 temp file behind when the rename fails

**File:** `server/src/keys.ts:91-96`
**Issue:** If `renameSync` throws (permissions on the data dir, a directory replaced by a file, Windows sharing violation), `${SECRETS_PATH}.<pid>.tmp` stays on disk holding every key in plaintext. It is still 0600, so it is not a disclosure, but it is a second copy nothing tracks and `doctor.mjs` does not look for.
**Fix:**

```ts
try {
  renameSync(tmp, SECRETS_PATH);
} catch (e) {
  try { unlinkSync(tmp); } catch { /* already gone */ }
  throw e;
}
```

### IN-05: `POST /api/settings/detect` clears the observation before the new pass lands, so concurrent readers see a blank window

**File:** `server/src/index.ts:521-525`
**Issue:** `resetDetection()` runs before `await detect()`. For the duration of the pass (bounded by the 15 s CLI cap) `lastDetection()` is null: `/api/health` and `GET /api/settings` answer `claude-code` / `checking` regardless of what the previous pass found, and a `runTurn` that starts inside the window has no fresh observation and spawns its own synchronous `claude auth status` on top of the async one already running.
**Fix:** Drop `resetDetection()` here; `detect()` ends in `rememberDetection(...)`, which replaces the observation atomically. Keep `resetDetection` for tests.

### IN-06: `hasPrefs` counts the model while `describePrefs` does not, so the learner menu reads "nothing set" for a learner whose only preference is a model

**File:** `web/src/lib/prefs.ts:16-27`, `web/src/components/LearnerMenu.tsx:180`
**Issue:** `hasPrefs(p)` is `Object.keys(p).length > 0`, so a learner with only `model` set is "has prefs", and the menu renders `describePrefs(me.prefs)`, which ignores `model` and returns `'nothing set'`. The fallback sentence ("tell the tutor, once, in your words") is the one that should show.
**Fix:** Either `bits.push(\`model ${p.model}\`)` in `describePrefs` or make `hasPrefs` ignore `model` (`Object.keys(p).some((k) => k !== 'model')`), since it is not a teaching preference by the db.ts comment.

### IN-07: Formatting slip in the shared types file

**File:** `web/src/lib/types.ts:28`
**Issue:** `export type Learner ={ id: string; ...` is missing the space before `{`; every other alias in the file has it. Hand-formatted repo, so nothing catches it.
**Fix:** `export type Learner = { ... }`.

---

_Reviewed: 2026-09-30T23:07:19Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
