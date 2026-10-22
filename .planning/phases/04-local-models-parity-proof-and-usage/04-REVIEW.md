---
phase: 04-local-models-parity-proof-and-usage
reviewed: 2026-10-22T00:00:00Z
depth: standard
files_reviewed: 38
files_reviewed_list:
  - .env.example
  - .github/workflows/ci.yml
  - .github/workflows/conformance.yml
  - package.json
  - scripts/conformance.mjs
  - server/package.json
  - server/src/agent.ts
  - server/src/capability.ts
  - server/src/config.ts
  - server/src/context.ts
  - server/src/db.ts
  - server/src/drivers/adapters.ts
  - server/src/drivers/api.ts
  - server/src/export.ts
  - server/src/index.ts
  - server/src/materials.ts
  - server/src/migrations.ts
  - server/src/probe.ts
  - server/src/providers.ts
  - server/src/settings.ts
  - server/src/usage.ts
  - server/test/api-driver.test.ts
  - server/test/api.test.ts
  - server/test/capability.test.ts
  - server/test/cost.test.ts
  - server/test/local.test.ts
  - server/test/migrations.test.ts
  - server/test/settings.test.ts
  - server/test/spawn.ts
  - server/test/usage.test.ts
  - web/src/components/ProviderRow.tsx
  - web/src/components/fields.ts
  - web/src/lib/api.ts
  - web/src/lib/types.ts
  - web/src/main.tsx
  - web/src/pages/Lesson.tsx
  - web/src/pages/Settings.tsx
  - web/src/pages/Usage.tsx
findings:
  critical: 3
  warning: 8
  info: 9
  total: 20
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-10-22
**Depth:** standard
**Files Reviewed:** 38
**Status:** issues_found

## Summary

Phase 04 adds three local provider rows, a three-tier capability ladder, a `test teaching`
proof, a conformance harness and a Usage page. The server-side reasoning is unusually well
documented and the test suite (`capability.test.ts`, `local.test.ts`, `usage.test.ts`,
`api.test.ts`) is honest — `local.test.ts` even pins a wording it explicitly says it does
not endorse. The parsers, the three-valued verdict, the redaction posture in `probe.ts` and
`capability.ts`, and the "money is formatted once, server-side" discipline in `usage.ts`
all hold up under reading.

What does not hold up are three claims the code makes about itself:

1. The Usage page is **learner-scoped on the server and not on the client** — switching
   learner leaves another learner's spend, lesson topics and lesson links on screen.
2. The `num_ctx` field is offered, validated, persisted and confirmed as applied on two
   rows where **nothing ever reads it**, which puts a learner who hits the num_ctx refusal
   on LM Studio or llama.cpp into a loop they cannot leave from Settings. (This is the
   *other half* of the `.planning/WINDOWS.md` sentence item, not the same defect: that item
   is about which sentence is shown; this one is about a stored setting with no effect and a
   false "saved · applies from the next turn".)
3. The scratch-lesson exclusion claims to cover "Home, the Atlas or a lesson count" but is
   implemented in exactly two of seven lesson-joining reads, so a teaching proof leaks into
   the learner's lesson count, the Atlas graph and — through `learnerProfile` — the system
   prompt of every other turn, permanently if a crash leaves the lesson behind.

Beyond those, the capability ladder's one inferred negative (`roundTrip` → `'no'`) is
remembered as a definitive refusal with no retry and no non-rescan escape, the
`/capability` route is the one place a model id enters unvalidated, and the conformance
harness's fatal path bypasses the `safeMessage` chokepoint its own header promises.

## Critical Issues

### CR-01: Switching learner on the Usage page shows the previous learner's spend and lessons

**File:** `web/src/pages/Usage.tsx:54`
**Issue:** `UsagePage` renders `<LearnerMenu />` with no `onChange` callback. `LearnerMenu.pick()`
writes the new id to `localStorage` and calls `onChange?.()` — which is `undefined` here — so
no refetch happens. `GET /api/usage` is correctly scoped to `learnerOf(c)` server-side, but the
page keeps rendering the *previous* learner's `total`, `summary`, provider groups, model lines,
lesson topics and `/lesson/{id}` links under the newly selected learner's name. Every other
learner-scoped page in the codebase passes the callback (`Home.tsx:109` `onChange={refresh}`,
`You.tsx:109`, `Library.tsx:91`); Usage is the only learner-scoped page that does not.

In a multi-learner install (a household, a classroom) this renders one learner's whole learning
record — topics and all — to another, and the lesson links navigate straight into it. The module
header's own claim ("Scoped to the learner this request resolves to and to nothing it carried of
its own") is true of the route and false of the screen.

**Fix:**
```tsx
// web/src/pages/Usage.tsx
<LearnerMenu onChange={() => void load()} />
```
`load` is already a stable reference to a function that resets `err`, sets `loading` and refetches,
so no other change is needed. Consider also clearing `view` on switch so the stale figures are
never on screen during the refetch (`setView(null)` at the top of `load`).

---

### CR-02: The `num_ctx` field is writable and "saved" on LM Studio and llama.cpp, where nothing reads it

**File:** `server/src/index.ts:464`, `server/src/index.ts:614`, `web/src/components/ProviderRow.tsx:301-347`, `web/src/components/ProviderRow.tsx:594`, `server/src/drivers/api.ts:553`, `server/src/drivers/adapters.ts:460`
**Issue:** Three decisions combine into a field that lies:

- `rowView` sets `num_ctx_default: spec.group === 'local' ? NUM_CTX_DEFAULT : null` — all three local rows.
- `ProviderRow` renders `NumCtxField` wherever `num_ctx_default !== null` — all three local rows.
- The `PUT /api/settings/:provider` guard is `num_ctx !== undefined && spec.group !== 'local'` — so the write is **accepted and persisted** for `lmstudio` and `llamacpp`.
- `numCtxFor` is only ever called with the literal `'ollama'`: `adapters.ts:460` (`options: { num_ctx: numCtxFor('ollama') }`) and `api.ts:553` (`provider === 'ollama' ? numCtxFor(provider) : (served ?? undefined)`).

So `num_ctx:lmstudio` and `num_ctx:llamacpp` are write-only dead rows in the `settings` table, and
the learner is told `saved · applies from the next turn` (`ProviderRow.tsx:343`) when nothing
applies from the next turn or any turn after it.

The code itself states the opposite in three places: the zod `.describe()` on the field says
"LM Studio and llama.cpp serve whatever they were started with and **take no value here**"
(`index.ts:407`), and both rows' catalogue notes say "The context window is whatever
LM Studio / llama-server was started with" (`providers.ts:193`, `providers.ts:207`). The
`ProviderRow` comment rationalises it as "the row still carries one because the learner may
raise it; what differs is that Derive never sends it to those servers" — raising a value Derive
never sends raises nothing.

The user-visible consequence is a dead end, not just clutter. A learner on LM Studio whose turn
is refused gets the `num_ctx` card (`context.ts` `NUM_CTX_REFUSAL`, reached because `api.ts:553`
supplies the *served* window as a caller window), follows its one link to Settings, raises
`num_ctx` on that row, is told it saved and applies next turn, retries, and is refused with the
identical sentence. Nothing in the UI tells them the field they just edited is inert for their row.

This is distinct from the known-open `.planning/WINDOWS.md` item (which is about the refusal
*sentence* being the wrong one of two approved sentences). Fixing the sentence alone leaves a
field that persists a setting and confirms an effect it does not have; fixing this leaves the
sentence wrong. Both halves are needed for the journey to work.

It also fails the binding simplicity rule: a field with no reason tied to learning better,
on two rows out of three.

**Fix:** Make the window field exist exactly where Derive sends a window. Narrow all three
decisions to the one row:
```ts
// server/src/index.ts — rowView
num_ctx_default: spec.id === 'ollama' ? NUM_CTX_DEFAULT : null,

// server/src/index.ts — PUT guard, replacing the group check
if (num_ctx !== undefined && spec.id !== 'ollama') {
  return c.json({ error: `${spec.label} serves the window it was started with, so derive sends it none` }, 400);
}
```
`ProviderRow` then renders the field only on Ollama with no component change, because it already
keys off `num_ctx_default !== null`. Update `server/test/api.test.ts:767-777` ("shows the default
on every local row"), which currently pins the defect, and delete any stored
`num_ctx:lmstudio` / `num_ctx:llamacpp` keys in a migration so no learner is left with a value
they believe is active. The read-only rows should keep showing the *observed* served window as
read-only text (it is already in `CapabilityResult.served_window`) rather than an editable input.

---

### CR-03: Scratch lessons are hidden from two queries, not from the learner's record

**File:** `server/src/db.ts:153-156`, `server/src/db.ts:264-268`, `server/src/db.ts:141-152`, `server/src/db.ts:269-275`, `server/src/db.ts:160-165`
**Issue:** Migration 8 and the `scratch` column are filtered in exactly two statements —
`listLessons` and `listAllLessons` — and the comment above them claims more than that:

> "Both listings exclude scratch rows: a lesson that exists only to prove a model can teach
> must never reach Home, the Atlas or a lesson count, **not even for the second it is alive**."

Every other read that joins `lessons` has no `scratch = 0` filter:

| statement | line | reached by |
|---|---|---|
| `allNodes` | 153 | `GET /api/atlas` (`nodes`), **`learnerProfile`** |
| `dueNodes` | 264 | `GET /api/atlas` (`due`), `GET /api/review`, `GET /api/stats` |
| `stats` | 269 | `GET /api/stats` → the lesson count on Home |
| `listMemory` | 141 | `learnerProfile` |
| `listMisconceptions` | 149 | `GET /api/atlas`, `learnerProfile` |

So while a proof is running — minutes on a local model — the learner's lesson count on Home is
one too high, and the Atlas renders the probe's three nodes (`even`, `pair`, `even-sum`) attached
to a lesson that is deliberately absent from the same response's `lessons` array.

The consequential one is `learnerProfile`, which is concatenated into `instructionsVolatile` and
therefore into the system prompt of **every turn of every other lesson** (`agent.ts:338`). It
filters only the current lesson (`db.ts:1450`: `allNodes(learnerId).filter(n => n.lesson_id !== currentLessonId)`),
so a real lesson taught while a proof is open is told the learner is working on "An even number is
twice a whole number". If the probe's quiz grades incorrect — which `capability.ts` explicitly
treats as a reachable outcome (`UNGRADABLE`, "a quiz whose own key contradicts the question") —
`addMisconception` also writes a misconception into the learner's record, which `learnerProfile`
and the Atlas both read.

And it is not bounded to the duration of a request. `sweepScratchLessons()` runs **only at boot**
(`index.ts:85`), so the crash case migration 8 exists for leaves the probe's nodes, misconceptions
and lesson count in the learner's record and in every turn's system prompt until the next restart.
This is exactly the trace `capability.ts`'s header promises the proof never leaves.

The existing coverage does not catch it: `api.test.ts`'s `counts()` helper checks `listLessons`,
`listUsage` and `SELECT count(*) ... WHERE scratch = 1` — the two filtered statements and the
column — and nothing else.

**Fix:** Put the filter where the join is, not where a caller remembers it. Add `AND l.scratch = 0`
to every lesson-joining read:
```sql
-- allNodes
SELECT n.*, l.topic, l.goal FROM nodes n JOIN lessons l ON l.id = n.lesson_id
WHERE l.learner_id = ? AND l.scratch = 0 AND n.source_lesson IS NULL ORDER BY l.created_at, n.rowid

-- dueNodes
... WHERE l.learner_id = ? AND l.scratch = 0 AND n.source_lesson IS NULL AND n.status = 'locked' ...

-- stats
(SELECT COUNT(*) FROM lessons WHERE learner_id = $l AND scratch = 0) AS lessons,
(SELECT COUNT(*) FROM nodes n JOIN lessons l ON l.id = n.lesson_id WHERE l.learner_id = $l AND l.scratch = 0 AND n.status = 'locked') AS locked,
(SELECT COUNT(*) FROM quiz_results q JOIN lessons l ON l.id = q.lesson_id WHERE l.learner_id = $l AND l.scratch = 0) AS quizzes,
(SELECT COUNT(*) FROM quiz_results q JOIN lessons l ON l.id = q.lesson_id WHERE l.learner_id = $l AND l.scratch = 0 AND q.correct = 1) AS correct

-- listMemory / listMisconceptions
... JOIN lessons l ON l.id = m.lesson_id WHERE l.learner_id = ? AND l.scratch = 0 ...
```
Then extend `api.test.ts`'s `counts()` to include `stats('default').lessons`,
`allNodes('default').length` and `listMisconceptions('default').length`, with a case that asserts
them while a scratch lesson is deliberately alive — the `sweepScratchLessons` case at
`api.test.ts:586` already builds exactly that fixture.

## Warnings

### WR-01: A single non-deterministic generation is remembered as a definitive "cannot call tools"

**File:** `server/src/capability.ts:409-433`, `server/src/capability.ts:542-544`, `server/src/index.ts:634-637`
**Issue:** `roundTrip` returns `'no'` when one `generateText` call comes back with
`toolCalls.length === 0`. `capabilityOf` then stores `{ tools: 'no', selectable: false, definitive: true,
refusal: capabilityRefusalFor(model) }`, and that verdict refuses the settings write
(`index.ts:636`), the activation (`index.ts:532`) and every turn (`drivers/api.ts:564`).

The module header states the invariant this breaks: "the one direction this module must never be
wrong in is claiming a `no`". A metadata `no` is a server's own statement; this `no` is an
inference from one sampled generation, with no retry, no temperature control and no second
attempt. A sampling fluke, a model mid-load, a chat template that needs a warm-up turn, or a
server busy enough to answer prose once, all produce a permanent (process-lifetime) refusal with
a sentence asserting a capability fact that may be false.

Recovery is also non-obvious. Because the write is refused, the model is never stored, so
`effective` does not change and the component's `saveModel` early-returns on the next attempt;
and the PUT's own cheap-tier read is gated on `!knownCapability(spec.id, model)` (`index.ts:636`),
so the verdict is never re-read. The only escapes are pressing `rescan` on Settings (which
`forgetCapabilities` for found rows) or restarting the server — neither of which the refusal
sentence mentions.

**Fix:** Either do not let an inferred negative be `definitive`, or give it a retry and a visible
re-ask:
```ts
// capability.ts — two attempts before an inference is believed
async function roundTrip(id: string, model: string): Promise<'yes' | 'no' | 'unknown'> {
  const first = await oneRoundTrip(id, model);
  if (first !== 'no') return first;
  return oneRoundTrip(id, model); // a second prose answer is a pattern, not a sample
}
```
and, at minimum, let the `/capability` route re-ask on demand (it already takes an explicit
`model`, so have it bypass the remembered verdict) so the learner has a retry that is not
"rescan everything".

---

### WR-02: `/api/settings/:provider/capability` takes an unvalidated, unbounded model id

**File:** `server/src/index.ts:743-746`
**Issue:** Every other entry point for a model id goes through `SettingsWrite`, which bounds it to
200 characters and `^[A-Za-z0-9._:/-]*$` (`index.ts:374-380`). This route does not:
```ts
const asked = typeof body.model === 'string' ? body.model.trim() : '';
const model = asked || getSetting(modelKey(spec.id)) || '';
```
`asked` is then used as a key in the module-level `observed` map (`capability.ts:330`, via
`rememberCapability`) and interpolated verbatim into `capabilityRefusalFor(model)` /
`windowRefusalFor(model, max)`. An authenticated local caller can grow `observed` without bound
(no eviction, no size cap, keys of arbitrary length) and get arbitrary text echoed back in the
`refusal` field. It is a local, token-guarded API so the blast radius is small, but it is an
unnecessary inconsistency in the one place a model id is not validated.

**Fix:** Reuse the existing bound rather than writing a second one:
```ts
const CapabilityAsk = z.object({ model: z.string().trim().max(200).regex(/^[A-Za-z0-9._:/-]*$/).optional() }).strict();
const parsed = CapabilityAsk.safeParse(await c.req.json().catch(() => ({})));
if (!parsed.success) return c.json({ error: 'the model id may only contain letters, digits, . _ : / and -' }, 400);
const model = parsed.data.model || getSetting(modelKey(spec.id)) || '';
```

---

### WR-03: A rescan does not forget verdicts on a row whose server stopped answering

**File:** `server/src/index.ts:701-703`
**Issue:**
```ts
const found = PROVIDERS.filter((s) => s.group === 'local' && !!seen.local?.[s.id as keyof Local]);
for (const s of found) forgetCapabilities(s.id);
await Promise.all(found.map((s) => capabilityList(s.id)));
```
Only rows the pass *found* are forgotten. A row that was found earlier and is not found now keeps
every verdict it had — including a refusal. `forgetCapabilities`'s own doc says the opposite
("a pass is about to re-read it: either way the old facts are about a server that may no longer be
there, and returning the row to silence is the only safe direction").

The consequence is a refusal that outlives the server it was read from. A learner who stops
llama-server, swaps the model file, and rescans while it is still starting up keeps the old
`tools: 'no'`; the PUT then refuses the new model id (`index.ts:636` reads the remembered verdict
and skips the fresh metadata read because `knownCapability` is non-null), and the activation
refuses too.

**Fix:** Forget every local row the pass looked at, found or not, so an unfound row returns to
silence rather than keeping a fact about a server that is no longer there:
```ts
const local = PROVIDERS.filter((s) => s.group === 'local');
for (const s of local) forgetCapabilities(s.id);
const found = local.filter((s) => !!seen.local?.[s.id as keyof Local]);
await Promise.all(found.map((s) => capabilityList(s.id)));
```

---

### WR-04: The `num_ctx` field shows raw zod sentences to the learner

**File:** `server/src/index.ts:388-390`
**Issue:** `.min()` and `.max()` on `num_ctx` carry learner-voice messages, but `.number()` and
`.int()` do not, so their defaults reach the Settings row error line verbatim (verified against
the installed zod):

- `20000.5` → `Invalid input: expected int, received number`
- `"32768"` → `Invalid input: expected number, received string`

`type="number"` does not prevent a fractional value, so the first case is reachable by typing
`20000.5` and blurring. This breaks the project's error convention ("a lowercase, human-readable
message that can be shown to the learner or the model as-is") in the one field on the page that
has no custom message for its type errors.

**Fix:**
```ts
num_ctx: z
  .number({ message: 'the context window is a whole number of tokens' })
  .int('the context window is a whole number of tokens')
  .min(NUM_CTX_FLOOR, `the method needs at least ${NUM_CTX_FLOOR} tokens of context`)
  ...
```
Also give the input `min={NUM_CTX_FLOOR}` and `step={1024}` so an obvious typo is caught before
the request.

---

### WR-05: The activation refusal resolves the install-wide model, not the learner's

**File:** `server/src/index.ts:532`
**Issue:**
```ts
const refusal = capabilityRefusal(spec.id, modelFor(spec.id));
```
with the comment "The row's model is resolved through the same tiers a turn resolves it through,
so this refusal and the next turn cannot disagree about which model was about to run."

A turn resolves `resolveTutor(lesson.learner_id)` → `chooseModel(provider, learnerId)`, which
consults `getLearner(learnerId)?.prefs.model?.[provider]` **before** the stored install value
(`settings.ts:200-203`). `modelFor(spec.id)` is called with no learner, so it skips that tier.
The two therefore can disagree in both directions:

- the install-wide model is refused while the learner's own model is fine → activation refused
  for everyone, with a sentence naming a model that learner never runs;
- the install-wide model is fine while the learner's own model is refused → activation allowed,
  and the lesson-time backstop fires instead.

The sibling route two sections down gets this right (`index.ts:772`: `modelFor(spec.id, learner)`
with the comment "the same question a turn asks").

**Fix:**
```ts
const refusal = capabilityRefusal(spec.id, modelFor(spec.id, learnerOf(c)));
```
and correct the comment: with a per-install `ACTIVE_PROVIDER` and per-learner model preferences,
one activation check cannot speak for every learner — say which learner it speaks for.

---

### WR-06: The conformance harness's fatal path bypasses its own redaction chokepoint

**File:** `scripts/conformance.mjs:319-320`, `scripts/conformance.mjs:596-598`
**Issue:** The module header is explicit: "every sentence it records — a provider's error body, a
thrown message, a skip reason — goes through `safeMessage` before it reaches the report." Two paths
do not:

```js
const last = stderr.trim().split('\n').filter(Boolean).at(-1) ?? 'it wrote nothing to stderr';
throw new Error(`the derive server did not start in ${SPAWN_ATTEMPTS} attempts: ${last}`);
```
```js
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
}
```
The first embeds a raw line of the **child server's stderr** in a thrown message; the second prints
any thrown message raw. `secrets.registerSecret` has already been called for every key by then, so
the redaction is available and simply not applied. In a public repository the job log is public,
and a child that dies with an unhandled error carrying a credential in its stack puts it there.

**Fix:** Route both through the same function the rest of the script uses. `safe` is already in
scope inside `main`; hoist a module-level `safeOut` that falls back to the identity before
`loadServer` has run:
```js
let safe = (text) => String(text ?? '');     // before the server modules are loaded
// ... in main, after loadServer():
safe = (text) => secrets.safeMessage(text);
// startServer:
throw new Error(safe(`the derive server did not start in ${SPAWN_ATTEMPTS} attempts: ${last}`));
// entry point:
} catch (e) { console.error(safe(e)); process.exit(1); }
```

---

### WR-07: The teaching proof has no deadline

**File:** `server/src/capability.ts:671-718`
**Issue:** `roundTrip` — one tiny generation — is bounded by `ROUND_TRIP_MS = 60_000`. `testTeaching`
— a full scripted turn with four tool calls on a model that may be a 3B on CPU — has no bound at
all: no `AbortSignal`, no deadline, no interrupt. It awaits `runTurn` and relies entirely on the
driver's own caps (`maxTurns: 400` on the Agent SDK, `stepCountIs` in the owned loop), which on a
slow local model is tens of minutes. The HTTP request stays open for the whole of it, the scratch
lesson stays in the database for the whole of it (see CR-03), and the button stays `testing…` with
no way to stop. The route's own docstring argues that the reachability pre-check exists precisely
so "a closed port is [not] two minutes of the loop's own retry backoff" — the same argument applies
to the run itself.

**Fix:** Give the proof a stated bound, as the round-trip has, and end it the way a Stop does:
```ts
const PROOF_MS = 5 * 60_000;
const timer = setTimeout(() => void interrupt(lessonId).catch(() => undefined), PROOF_MS);
try { await runTurn(lessonId, PROBE_PROMPT, { tutor: { provider: spec.id, model } }); }
finally { clearTimeout(timer); stop(); deleteLesson(lessonId); }
```
and add a fourth outcome sentence (or reuse `UNGRADABLE`) for "it did not finish in N seconds",
which the UI already renders verbatim.

---

### WR-08: A stale "Pass" line survives a model change on the provider row

**File:** `web/src/components/ProviderRow.tsx:417`, `web/src/components/ProviderRow.tsx:482-497`
**Issue:** `saveModel` clears the capability line (`setCapability(null)`) but not the teaching
result. `teaching` is only ever reset inside `testTeaching()`. So after a successful proof on model
A, the learner picks model B and the row keeps showing
`Pass · taught one node and passed one graded quiz · 4213 ms` beside a model that has never been
tested. The same is true after `test connection` and after a `rescan` replaces the row.

Given that the whole value of PROV-11 is that a learner can *trust* the line before spending a
session, a pass attributed to the wrong model is the one failure mode this feature cannot afford.

**Fix:** Clear it with the capability line, and key both off the model they describe:
```ts
setCapability(null);
setTeaching(null);
```
Better still, store the model the result belongs to (`{ model, result }`) and render only when it
matches `effective`, so a row refreshed from `onChange` cannot carry a result forward either.

## Info

### IN-01: `capability.ts` claims the proof cannot use the driver override, and it can

**File:** `server/src/capability.ts:61-66`
**Issue:** The header states a pass "cannot come from Derive's own plumbing: no stub, no
process-global driver override (that seam lives in `driver.ts` and is read in `agent.ts`, never
here)". `runTurn` reads it first — `const driver = driverOverride() ?? driverFor(tutor.provider)`
(`agent.ts`) — so whatever `setDriverOverride` holds wins over the pressed row.
`server/test/api.test.ts:548-549` drives exactly that path. Nothing outside the process can set
it, so this is a documentation defect rather than a reachable one, but the sentence as written is
false and is the kind of claim a future reader will rely on.
**Fix:** Say what is true: "the override seam in `driver.ts` still applies, because every turn goes
through `runTurn`; nothing outside this process can set it."

### IN-02: `toolRejectionRate` is asked by catalogue id, but `turns.driver` is `claude` for the Claude Code row

**File:** `scripts/conformance.mjs:480`, `server/src/db.ts:234-237`
**Issue:** `db.toolRejectionRate(row.id, model)` is called with a `ProviderId`, while
`startTurn(lessonId, driver.name, ...)` stores `'claude'` for the Claude Code row (`agent.ts:141`)
— which is exactly why `providerOfDriver` exists. For `--logins` runs the query can never match,
and `rejected()` renders `0/0 calls` rather than `—`, which reads as "no bad calls" when the figure
could not be measured at all. Benign today because only the owned loop writes either table.
**Fix:** Either ask by driver name (`row.id === 'claude-code' ? 'claude' : row.id`) or render `—`
when `rejected + executed === 0`.

### IN-03: `llamaCppCapability`'s "first row" branch is unreachable from production

**File:** `server/src/capability.ts:218`
**Issue:** `model !== undefined ? entryFor(...) : (first data entry)` — both production callers
(`readCapability`, `capabilityList`) always pass a model, so the fallback is exercised only by
tests. It is defensible as a documented single-model-server convenience, but as written it is dead
in the shipped paths.
**Fix:** Either drop the optional parameter and the branch, or note at the signature that the
branch exists for a caller that does not yet exist.

### IN-04: `rowView` reads the same setting twice

**File:** `server/src/index.ts:463`
**Issue:** `getSetting(numCtxKey(spec.id)) ? Number(getSetting(numCtxKey(spec.id))) : null` issues
two synchronous SQLite reads per row, per settings paint.
**Fix:** `const stored = getSetting(numCtxKey(spec.id)); ... num_ctx: stored ? Number(stored) : null`.

### IN-05: Provider sentences are interpolated into a Markdown table cell unescaped

**File:** `scripts/conformance.mjs:504`
**Issue:** `| ... | ${r.reason ?? ''} |` — a provider sentence containing `|` breaks the row's
column alignment in the published report. `providerSentence` collapses whitespace but does not
escape pipes, and `refusalIn` reads a `turn_end` error that has had no such treatment at all.
**Fix:** `const cell = (s) => String(s ?? '').replace(/\|/g, '\\|');` applied to `reason`, `model`
and `label`.

### IN-06: The conformance workflow declares no `permissions`

**File:** `.github/workflows/conformance.yml:33-40`
**Issue:** `release.yml` declares `permissions: contents: write` for the one job that needs it; this
workflow declares none and inherits the repository default. It only needs to read the checkout and
upload an artifact.
**Fix:** Add `permissions: { contents: read }` at the workflow level.

### IN-07: `usage.ts` names an index the statement cannot use for its ordering

**File:** `server/src/usage.ts:16-20`, `server/src/db.ts:238`
**Issue:** The header says "`listUsage({ learner })` goes through the `usage_learner (learner_id, ts)`
index", but the prepared statement is `SELECT * FROM usage WHERE learner_id = ? ORDER BY id` — the
index serves the predicate, not the order, and `usage.ts` then sorts by `ts` in memory anyway
(`latest`). The sentence overstates what the statement does.
**Fix:** Either order by `ts` in the statement (which is what every caller here wants) or correct
the comment to say the index serves the lookup and the ordering is done in memory.

### IN-08: A short local bearer token cannot be redacted

**File:** `server/src/secrets.ts:34`, `server/src/capability.ts:33-36`
**Issue:** `capability.ts` promises "never a raw `e.message`, because a local server started with a
bearer token can echo it in an error" — and every path does go through `safeMessage`. But
`registerSecret` ignores anything under `MIN_SECRET_CHARS = 16`, and `redactErrors`'s `Bearer`
pattern needs 12+ characters, so a short token (`lmstudio`, `dev`, `local`) echoed by LM Studio or
llama.cpp in a 401 body reaches the browser through `providerSentence` intact. Phase 04 is the
phase that introduces the two rows where `optionalKey: true` and a learner-chosen short token is
realistic. The value only travels to the learner's own browser on their own machine, so the impact
is small, but the stated guarantee does not hold for the new rows.
**Fix:** Nothing to change in `secrets.ts` (the floor is load-bearing against shredding). Either
say so at `capability.ts`'s claim, or warn on the `optionalKey` rows' key field that a token under
16 characters cannot be scrubbed from an error.

### IN-09: The Usage page links to lessons that no longer exist

**File:** `server/src/usage.ts:201`, `web/src/pages/Usage.tsx:112-116`
**Issue:** `topic = getLesson(id)?.topic ?? id` correctly refuses to invent a name for a lesson whose
usage rows outlived it, but the page still renders that row as `<Link to={/lesson/${l.id}}>`, so
the one row that is *known* to have no lesson behind it is the one that reads as clickable.
**Fix:** Carry the fact on the wire (`exists: boolean`, or `topic: null`) and render a non-link
`<p>` for a row whose lesson is gone.

---

_Reviewed: 2026-10-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
