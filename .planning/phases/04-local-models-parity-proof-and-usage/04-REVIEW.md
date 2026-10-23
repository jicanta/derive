---
phase: 04-local-models-parity-proof-and-usage
reviewed: 2026-10-23T01:46:03Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - web/src/pages/Lesson.tsx
  - server/test/usage.test.ts
  - server/src/capability.ts
  - server/src/db.ts
  - server/src/index.ts
  - server/src/migrations.ts
  - server/test/api.test.ts
  - server/test/migrations.test.ts
  - web/src/components/ProviderRow.tsx
  - web/src/pages/Usage.tsx
  - scripts/conformance.mjs
findings:
  critical: 2
  warning: 7
  info: 4
  total: 13
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-10-23T01:46:03Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Incremental review of `222c6299..HEAD`: the 04-06 gap-closure commits (`62240dd`, `41e9d38`) plus the eleven 04-REVIEW-FIX commits (`66ba6ad` … `13f5908`) that resolved the prior review's 3 Critical and 8 Warning findings and were never themselves reviewed.

Baseline checks pass: `pnpm -r typecheck` clean, `api.test.ts` 43/43, `migrations.test.ts` 26/26, `usage.test.ts` 31/31. The migration-10 addition, the zod `num_ctx` sentences (WR-04, verified against zod 4.6.5 directly), the `scratch = 0` join filters (CR-03), the conformance redaction chokepoint (WR-06) and the Usage learner refetch (CR-01) are sound and complete for what they claim.

The two Critical findings are both **fixes that introduced new defects**, and both land on the same seam — *which model a settings-page action is actually about*:

- **WR-05** (`index.ts:560`) moved the activation refusal onto the asking learner's model. That model is only editable on the You page, and only for the *provider that is currently active* — so a learner whose stored per-provider model the ladder refuses cannot activate that provider and cannot clear the id from any shipped surface. The refusal sentence tells them to do the one thing that does not work.
- **WR-08** (`ProviderRow.tsx:499,518`) keys the teaching proof to `row.model ?? row.default_model`, while the route runs it on `modelFor(spec.id, learnerOf(c))`. Those resolve differently in three reachable cases, so `Pass · …` still renders beside a model that was never tested — the exact failure the fix's own comment calls "the one failure this feature cannot afford."

Three further warnings follow from the CR-02 narrowing (`num_ctx` on Ollama only) and from WR-02's new `ModelId` bound reaching ids a learner never typed.

## Critical Issues

### CR-01: WR-05's per-learner activation refusal is an unrecoverable lockout through the shipped UI

**File:** `server/src/index.ts:560`, with `web/src/pages/You.tsx:15,75`, `server/src/index.ts:341`

**Issue:** The activation refusal now resolves the model through `modelFor(spec.id, learnerOf(c))`, which reads `prefs.model[provider]` *first* (`settings.ts:200`). There is no surface that can clear that entry for a provider that is not currently active:

- The **You page** writes `model: { [provider.current]: model }` where `provider.current` is `api.activeTutor().provider` — the *active* provider only (`You.tsx:33-35,75`).
- The **Settings row's** model field writes the install-wide setting `model:<id>` (`index.ts:685-688`), which `chooseModel` consults only *after* the learner pref — so changing it there does not clear the refusal.
- The MCP `set_preferences` tool's shape does not expose `model` at all (`tools.ts:218-225`).

Reachable sequence, entirely from the shipped UI:

1. Ollama is active; on the You page the learner types a per-learner ollama model that cannot call tools. **No capability check runs on this path** (`index.ts:341`, see WR-01).
2. They switch the active provider to something else. The You page's model field now edits *that* provider's entry; the ollama entry is no longer addressable.
3. They press **Use this provider** on the ollama row → `400` with `capabilityRefusalFor(model)`: *"… Pick a model that supports tool calling, or choose another provider in Settings."*
4. Picking a model in Settings writes the install-wide setting, which the refusal ignores. The learner is locked out of that provider for the life of the process, and the lockout returns the moment Settings is reopened (`/settings/detect` → `capabilityList` re-remembers the verdict).

The sentence is also actively misleading: it names Settings as the fix, and Settings cannot fix it.

**Fix:** Refuse on the model the activation will actually change, and give the learner a way to clear the per-learner id. Minimum:

```ts
// index.ts — name the tier the refusal came from, so the sentence can be true
const learner = learnerOf(c);
const chosen = modelFor(spec.id, learner);
const refusal = capabilityRefusal(spec.id, chosen);
if (refusal) {
  const own = getLearner(learner)?.prefs.model?.[spec.id];
  return c.json({ error: own === chosen ? `${refusal} This id is stored as your own choice for ${spec.label}; clear it on the You page.` : refusal }, 400);
}
```

and either (a) make the You page's model field address the row the learner is editing rather than only the active provider, or (b) have `PUT /api/settings/:provider { model }` clear `prefs.model[provider]` for the asking learner when it stores an install-wide id — so the obvious control is also the effective one.

---

### CR-02: WR-08 still attributes the teaching proof to a model that was not tested

**File:** `web/src/components/ProviderRow.tsx:381,499,518`, with `server/src/index.ts:828-829`

**Issue:** The fix reads `const ran = effective` before the run and keys the rendered line on `teaching.model === effective`, where `effective = row.model ?? row.default_model ?? ''` (`ProviderRow.tsx:381`). The route resolves the model independently:

```ts
// index.ts:828-829
const learner = learnerOf(c);
return c.json(await testTeaching(spec.id, modelFor(spec.id, learner), learner));
```

`modelFor` → `chooseModel` orders the tiers `DERIVE_MODEL` → `prefs.model[provider]` → `model:<id>` setting → `spec.defaultModel` (`settings.ts:196-206`). `effective` only knows the last two. The two diverge in three reachable cases:

1. **`DERIVE_MODEL` set.** `rowView.model` is still the stored setting and the field renders it (disabled, with "Set by DERIVE_MODEL in your environment"). The proof runs on the env model; the line is filed under the displayed one.
2. **A per-learner model.** Set from the You page (`You.tsx:75`). The proof runs on it; the line is filed under the install-wide id.
3. **Switching learner on the Settings page itself.** `Settings.tsx:105` renders `<LearnerMenu />` with no `onChange`, so picking a different learner changes `learnerOf(c)` — and therefore the model the proof runs on — while nothing in the row changes. The stale `teaching` state is not even cleared.

So `Pass · 41s` renders beside a model nothing has tested, and `teaching.model === effective` holds, so the guard does not clear it. Symmetrically, a Fail whose `reason` names the learner's real model (`capabilityRefusalFor(model)`) is shown under a different id in the field.

`TeachingTest` has no model field, so the browser has no way to be right about this.

**Fix:** Make the route report what it ran, and key the UI on the answer rather than on a guess.

```ts
// capability.ts
export type TeachingTest =
  | { ok: true; model: string | null; ms: number }
  | { ok: false; model: string | null; reason: string; hint?: string; ms: number };
```

```tsx
// ProviderRow.tsx
setTeaching(await api.testTeaching(row.id));            // the result carries its own model
const proof = teaching && (teaching.model ?? '') === effective ? teaching : null;
```

While CR-01 is open, also render the model the proof ran on when it differs from `effective` — that difference is a fact the learner needs, not noise.

## Warnings

### WR-01: no capability gate on the learner-prefs model write

**File:** `server/src/index.ts:341`

**Issue:** D-04's "cannot be selected" is enforced at the install-wide write (`index.ts:665-669`) and now at the activation (`index.ts:560`), but `PATCH /api/learners/:id` passes `body.prefs` straight into `updateLearnerPrefs` with no `capabilityRefusal`. The You page is a model-*selection* surface — `cleanPrefs` accepts any charset-valid id — so the one place a learner types the model the resolver prefers is the one place the ladder is not consulted. This is what makes CR-01 reachable.

**Fix:** Apply the same check the settings write applies, per provider key, in the same shape (refuse with the ladder's sentence; silence lets it through):

```ts
for (const [id, value] of Object.entries((body.prefs?.model ?? {}) as Record<string, string>)) {
  const refusal = value ? capabilityRefusal(id, value) : null;
  if (refusal) return c.json({ error: refusal }, 400);
}
```

### WR-02: the proof line survives a base-URL change, and the fix's own comment misstates when it clears

**File:** `web/src/components/ProviderRow.tsx:511-518`

**Issue:** The guard keys on the model alone. A `base_url` save (`BaseUrlField.save` → `onChange(await api.setProvider(...))`) replaces the row object but leaves `row.model` untouched, so `effective` is unchanged and a `Pass` read from the *previous* server stays on screen attributed to the new address. The server itself treats that write as a different server entirely — `index.ts:693-697` calls `forgetCapabilities(spec.id)` for exactly this reason — so the browser and the server now disagree about whether anything is still known.

The comment at `:511-517` also claims "a rescan that replaces the row … change[s] `effective`". It does not: `/settings/detect` returns `settingsView()`, in which `rowView.model` is still the stored setting, so the proof line persists across a rescan too.

**Fix:** Key the proof on the identity the verdict belongs to, not just the model:

```tsx
const ran = `${effective}${row.base_url ?? ''}`;           // same discipline as capability.ts's verdictKey
const proof = teaching && teaching.key === ran ? teaching.result : null;
```

and correct the comment to name the writes that actually move it (a model save, a learner switch, a base-URL save).

### WR-03: CR-02 leaves the `num_ctx` refusal naming a field that no longer exists

**File:** `server/src/context.ts:51-52,91`, with `server/src/index.ts:482` and `server/src/drivers/api.ts:553`

**Issue:** `headroomCheck` picks between its two locked sentences on whether the *caller* supplied the window, and the caller-supplied branch is the `num_ctx` sentence: *"Raise the model's context window in Settings (num_ctx), or pick a model with room."* On LM Studio and llama.cpp the caller supplies `served` — the window read off the learner's own server (`drivers/api.ts:553`) — so that branch fires there. Before CR-02 the field existed on those rows and did nothing; after `num_ctx_default: spec.id === 'ollama' ? … : null` (`index.ts:482`) the field is gone, so the sentence now sends the learner to a control that is not on the page at all.

Ledger item `.planning/WINDOWS.md#26` records the weaker form of this ("raising the field will not move it"). CR-02 escalated it from *inert* to *absent*, which the ledger wording no longer describes.

**Fix:** Decide the sentence on whether the window is one the learner can raise, not on who passed it — e.g. thread the provenance through:

```ts
headroomCheck({ …, window, windowIsEditable: provider === 'ollama' }, priceTable());
…
if (input.windowIsEditable && input.window != null) return { refuse: true, reason: NUM_CTX_REFUSAL(…) };
```

and update ledger #26 to say the field is absent, so the deferred fix is scoped correctly.

### WR-04: `ModelId`'s charset rejects ids the row's own model list returns

**File:** `server/src/index.ts:373-377`, with `server/src/index.ts:795-796`

**Issue:** `^[A-Za-z0-9._:/-]*$` excludes spaces, parentheses, `@`, `+` and `~`. The llama.cpp row's own catalogue note says the id reads as *a file path* unless the server was started with `--alias` (`providers.ts:207`), and the Usage page repeats it (`Usage.tsx:97-99`) — so `/home/u/My Models/Llama-3.1-8B (Q4).gguf` is an id Derive's own `fetch models` will hand the learner and Derive's own schema will then refuse. LM Studio keys with a quantization suffix (`…@q4_k_m`) fail the same way.

The settings write already had this bound (pre-existing), but WR-02 extended it to the capability ask, where previously any string was accepted. The learner now gets *"the model id may only contain letters, digits, . _ : / and -"* for an id they picked out of the list — a sentence about Derive's schema, for something they cannot change.

**Fix:** Widen the class to the characters local servers actually emit and keep the length bound, which is the part that is load-bearing:

```ts
.regex(/^[^\x00-\x1f"'`$;|&<>\\]*$/, 'the model id contains characters no provider issues')
```

If the narrow class is deliberate, the refusal must say what to do: *"Start llama-server with --alias so the model has a name Derive can store."*

### WR-05: a third copy of the model-id bound, with different semantics

**File:** `server/src/db.ts:353-354`

**Issue:** `ModelId`'s doc comment says "One schema rather than one per route, because a second copy is how the settings write and the capability ask would start disagreeing about what a model id may be" — while `cleanPrefs` carries a third copy that disagrees in two ways: it uses `+` rather than `*` (so an empty string is dropped rather than parsed as a clear) and it **truncates** at 200 with `.slice(0, 200)` rather than rejecting. A 250-character pref id is silently stored as its first 200 characters and then returned by `modelFor` and sent to the provider as if the learner had chosen it.

**Fix:** Have `cleanPrefs` validate against the one schema instead of restating it — export `ModelId` from a module `db.ts` can import (it cannot import `index.ts`; `settings.ts` already holds `modelKey` and is the natural home) and drop entries that fail rather than reshaping them:

```ts
if (ModelId.safeParse(value).success && value.trim()) model[key] = value.trim();
```

### WR-06: WR-01's second round-trip doubles a wait that has no in-flight indicator

**File:** `server/src/capability.ts:453-456,381`, with `web/src/components/ProviderRow.tsx:420-443,648-655`

**Issue:** `roundTrip` now issues a second `oneRoundTrip` before believing a `no`, each bounded at `ROUND_TRIP_MS = 60_000`, so the capability probe's worst case is ~120 s. That probe is awaited inside `ProviderRow.save()` after the model write, and there is no in-flight state for it: `capability` is set to `null` and the row renders *nothing* until it resolves (the `{capability && …}` branch at `:648`). The `test connection` and `test teaching` controls both have an in-flight line; this one does not, and the wait it hides just doubled.

**Fix:** Give the probe the in-flight line its siblings have:

```tsx
const [probing, setProbing] = useState(false);
…
{probing ? <p role="status" className={`mt-2 ${resultLine} text-teal-400 animate-pulse motion-reduce:animate-none`}>reading what this model can do</p> : capability ? …}
```

### WR-07: the test's own ordering is load-bearing and unstated

**File:** `server/test/api.test.ts:786-843`

**Issue:** The new activation-refusal test mutates install state the whole `describe("the owned loop…")` suite shares and restores only part of it: it leaves `base_url:ollama` pointing at the closed port of the `quiet` fake server, leaves a `Quiet` learner in the database, and restores only the active provider (`finally` → `active: anthropic`). It passes today because it happens to be the last test in its suite; nothing says so, and inserting a test after it would break on state it does not create.

**Fix:** Restore what it changed, in the same `finally`:

```ts
} finally {
  quiet.server.close();
  await call('/api/settings/active', { provider: 'anthropic' });
  await call('/api/settings/ollama', { base_url: '', model: '' }, 'PUT');
  await call(`/api/learners/${made.json.id}`, undefined, 'DELETE');
}
```

## Info

### IN-01: the capability test's stated reason for bounding the id is wrong

**File:** `server/test/api.test.ts:1051-1055`

**Issue:** *"an unbounded one would grow that map without limit"* — a charset and a 200-character cap bound each key's *size*, not the *number* of keys. `observed` still grows one entry per distinct id asked about (`capability.ts:330,339`), and nothing evicts. The real justification is the second half of the comment (the id is interpolated into refusal sentences), which stands on its own.

**Fix:** Drop the cardinality claim from the comment, or add the bound it describes (an LRU cap, or `observed.delete` of the oldest key past N entries).

### IN-02: `TIMED_OUT` states a bound the run was not given

**File:** `server/src/capability.ts:641`

**Issue:** The sentence interpolates `PROOF_MS / 60_000` while the deadline that fired is `proofMs()`. Under `setProofDeadlineOverride(40)` the learner-facing sentence says "5 minutes" about a 40 ms deadline, and `api.test.ts:614-618` asserts that false sentence as the contract. The docstring calls this deliberate (the shipped bound is the one a learner's proof gets), which is defensible for production — but the test then proves the string, not the behaviour.

**Fix:** Keep the production sentence and assert the *shape* in the test (`/^the proof did not finish in \d+ minutes and was stopped/`), so the assertion stops depending on a number the run did not use.

### IN-03: the conformance harness's one credential is outside its redaction chokepoint

**File:** `scripts/conformance.mjs:328,562`

**Issue:** WR-06 routed the two fatal paths through `safeOut`, and `main` registers every provider key from `keyNames(providers)`. The install token the harness reads out of the throwaway data dir (`readFileSync(join(dataDir, 'token'))`) and sends on every call is never `registerSecret`'d, so it is the one credential this script handles that redaction does not cover. Low impact (throwaway dir, process killed in `finally`), but it is the gap the fix was about.

**Fix:** `secrets.registerSecret(token)` immediately after `startServer` resolves.

### IN-04: `capability.ts`'s header overstates what keeps a proof out of the Usage total

**File:** `server/src/capability.ts:719-722`, with `server/src/db.ts:247`

**Issue:** *"which is why the token counts of a proof can never reach the Usage total"* — `usageOfLearner` selects on `learner_id` with no `lessons` join, so it is not covered by CR-03's `scratch = 0` filters. A proof's usage row is visible to `/api/usage` while the proof runs, and after a crash between the turn and the delete it stays visible until the next boot sweep. `api.test.ts:661-666` records this honestly ("the two figures that do move are the `scratch` column … and the ledger row"); only the module header claims otherwise.

**Fix:** Soften the header to say the rows go with the lesson *in the same request, and on the boot sweep otherwise*, or filter the read:

```sql
SELECT u.* FROM usage u LEFT JOIN lessons l ON l.id = u.lesson_id
WHERE u.learner_id = ? AND COALESCE(l.scratch, 0) = 0 ORDER BY u.id
```

(the `LEFT JOIN` keeps rows whose lesson was deleted, which `usage.ts:201` relies on).

---

_Reviewed: 2026-10-23T01:46:03Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
