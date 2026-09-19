# Phase 01: Foundation - Pattern Map

**Mapped:** 2026-09-19
**Mode:** gap closure (file list derived from `01-VERIFICATION.md` `gaps:` → `artifacts:` + `missing:`)
**Files analyzed:** 6 modified (0 created)
**Analogs found:** 6 / 6 — every gap fix has an in-file or in-repo analog established earlier in this same phase

> All analog paths below were confirmed git-tracked with `git ls-files`. No gitignored mirror paths appear here.

## File Classification

| Modified file | Role | Data flow | Closest analog | Match quality |
|---|---|---|---|---|
| `server/src/index.ts` (document middleware ~1087-1104, `serveApp`/`issueSession` 1064-1072, comments 102 and 1075-1082) | middleware / route | request-response | `server/src/index.ts` `guardLocal` (~195-210) + the `/api/*` credential middleware (~213-243) — **same file, 900 lines above** | exact |
| `server/src/repo.ts` `walk()` 122-143, `fromDirectory()` 145-173 | service (ingest) | file-I/O | `server/src/repo.ts` `isSecretName` 54-64 + `fromDirectory`'s own `parse(dir).root`/`homedir()` refusal at 148 | exact (in-file) |
| `server/src/repo.ts` `fromGitHub` tarball filter 255 | service (ingest) | streaming / transform | `server/src/repo.ts` `fromDirectory` line 151 filter chain | exact (in-file) |
| `server/src/repo.ts` `fromGitClone` 274-286 | service (egress) | request-response (subprocess) | `server/src/library.ts` `fetchPublic` 322-345 — the redirect-re-checking egress guard | role-match (same guard, different transport) |
| `server/test/guards.test.ts` (new symlink-refusal case; doc comment) | test | file-I/O | `guards.test.ts` `describe('importing a folder')` → `it('imports the ordinary file and nothing else')` 195-206 | exact |
| `server/test/security.test.ts` (doc comment 5-8; document-route cases) | test | request-response | `server/test/security.test.ts` `describe('a widened bind')` 222-232 doc comment — the one in this file that states only what its cases drive | exact (in-file) |
| `web/src/lib/api.ts` 24-40 (`deriveToken`, `headers`) | utility (api client) | request-response | `web/src/lib/api.ts` `currentLearner` 3-15 — the neighbouring documented browser-credential helper | exact (in-file) |
| `web/src/lib/useLesson.ts` ~254-256 (EventSource token query branch) | hook | streaming (SSE) | same block, minus the `auth` term | exact (in-file) |

---

## Pattern Assignments

### `server/src/index.ts` — close the loopback fail-open, and make the two comments honest

**Analog A (fail-closed on an unknown local address):** `server/src/index.ts` `hostNames`, ~145-160. This is the pattern the verifier named explicitly: when `localAddress(c)` returns nothing, `hostNames` narrows to loopback rather than widening.

```typescript
/**
 * ...With no address to go on, fail
 * closed to loopback.
 */
function hostNames(c: Context): Set<string> {
  const addr = localAddress(c);
  if (!addr) return new Set(LOOPBACK_NAMES);
  ...
}
```

The document middleware currently does the opposite at ~1093:

```typescript
const here = localAddress(c);
if (!here || isLoopback(here)) return next();   // fail-OPEN on !here
```

Copy `hostNames`' polarity — `if (here && isLoopback(here)) return next();` — so an unknown local address falls through to the token path (`missing:` item 5). The comment above it must state the reason in `hostNames`' own voice ("With no address to go on, fail closed").

**Analog B (a credential check written as an ordered prose comment + a guard chain):** the `/api/*` middleware, ~213-243. This is the shape to imitate if the planner chooses the *close it* branch of `missing:` item 1 (require the token on the document route on loopback too, with a one-time `?token=` handoff):

```typescript
/**
 * Only this machine, and only Derive's own app.
 * ... The checks close that, in order: health is
 * exempt because the doctor and the test harnesses poll it before there is
 * anything to authenticate with; then the shared Host and Origin guard; then
 * a credential. Three credentials are accepted and any one is enough — ...
 * An empty or whitespace-only value is absent, never something to compare.
 */
app.use('/api/*', async (c, next) => {
  if (c.req.path === '/api/health') return next();
  const refusal = guardLocal(c);
  if (refusal) return refusal;
  const header = offered(c.req.header('x-derive-token'));
  ...
  if (!ok) return c.json({ error: `send the x-derive-token header, with the token in ${TOKEN_PATH}` }, 401);
  return next();
});
```

The widened-bind branch already inside the document middleware (~1095-1103) is the exact `?token=` handoff to reuse verbatim on loopback if that branch is taken — it already issues the cookie and 302s with the query string dropped.

**Analog C (an honest comment that names the residual):** `scripts/doctor.mjs` 73-75 — the verifier singles this out as the one place the residual was stated correctly. Copy its register for the rewrite of `index.ts:1075-1082` and `index.ts:102` (`missing:` item 1, second branch):

```javascript
// How everything on this machine except the browser authenticates: the MCP server, the plugin hook and the Vite dev proxy all read this file.
// The browser never sees it — the server hands the page a separate derived cookie instead. Anyone who can read this file, or who can reach the
// port from this machine, can drive the learner's lessons and read anything Derive can read.
```

Two specific sentences must go or change:
- `index.ts:102` — "never logged, never emitted, and **never returned by any route**". Falsified by `GET /api/materials/:id?text=1` through the symlink read. Either the repo.ts fix makes it true again (preferred, since item 2 closes it) or the sentence narrows to what holds.
- `index.ts:1075-1077` — "The document routes are protected **at least as well as** the API they unlock." Strictly false while the loopback early-return stands. Per CLAUDE.md comment conventions, replace with prose that says *why* the posture is what it is, not a guarantee.

---

### `server/src/repo.ts` — refuse symlinks, filter the tarball, pin the clone

**Analog (in-file, the existing refusal shape):** `fromDirectory` 147-150 — a one-sentence `//` comment giving the *why*, then a lowercase-sentence `throw new Error(...)`:

```typescript
// Importing a whole home directory or a whole disk is never what the learner meant, and both are full of things the tutor should not read.
if (dir === parse(dir).root || dir === homedir()) throw new Error('that is your home folder or the whole disk, not a project: name the project folder instead');
```

**1. `walk()` 122-143 — `statSync` → `lstatSync`.** Current:

```typescript
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (!SKIP_DIRS.has(e)) walk(full, root, out);
    } else if (st.isFile() && !isSecretName(e)) out.push(relative(root, full).split(sep).join('/'));
```

`lstatSync` makes a symlink neither `isDirectory()` nor `isFile()`, so both branches fall through and the entry is silently skipped — no new control flow, and it closes advisory finding 5 (the directory-symlink cycle) in the same edit. Keep the `try/catch { continue }`; keep the `catch { /* ... */ }` empty-catch-with-a-reason convention from CLAUDE.md if a comment is added.

**2. `fromDirectory` read loop 161-170 — same substitution.** The second `statSync(full)` (the one guarding `fst.size > READ_BYTES`) must also be `lstatSync`, because `gitListFiles` can hand back a symlink path that `walk` never saw. The `git ls-files` path additionally needs the `realpathSync` root pin named in `missing:` item 2 — resolve each candidate and require it to stay under `realpathSync(dir)`.

**3. `fromGitHub` 255 — add `isSecretName` to the filter.** The two lines are meant to be twins:

```typescript
// fromDirectory:151
const all = (gitListFiles(dir) ?? walk(dir)).filter((p) => !inSkippedDir(p) && !isSecretName(p) && isTextName(p));
// fromGitHub:255 — missing the middle term
const paths = orderFiles([...byPath.keys()].filter((p) => !inSkippedDir(p) && isTextName(p)));
```

`isSecretName`'s own doc comment at 54-59 already promises "both when the list is built and when the tree is walked", so this makes the comment true rather than needing a new one.

**4. `fromGitClone` 274-279 — pin the clone to the judged URL.** The egress analog is `server/src/library.ts` `fetchPublic` 322-345, whose doc comment states exactly the principle the clone path is missing:

```typescript
/**
 * The one door every library fetch goes through, and therefore the one place
 * the host guard has to hold. Redirects are followed by hand rather than by
 * `fetch`, because a public URL is free to redirect to 127.0.0.1 and the
 * only honest way to catch that is to check each hop before taking it.
 */
export async function fetchPublic(url: string, ...) {
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    await (guard ?? assertPublicHost)(current);
    const res = await fetch(current, { ..., redirect: 'manual', ... });
```

`git` cannot re-check per hop, so the equivalent is to forbid the hop. Extend the existing `execFileSync` call — its current form:

```typescript
execFileSync('git', ['clone', '--depth', '1', '--quiet', url, tmp], { stdio: ['ignore', 'ignore', 'pipe'], timeout: 120_000 });
```

with `-c http.followRedirects=false -c protocol.allow=never -c protocol.https.allow=always` and `env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }` (`missing:` item 4). The existing comment at 274 is already the right shape (one long `//` sentence explaining why both checks run before the spawn) — extend it with the redirect reason, citing `fetchPublic`'s per-hop check as the thing being matched.

---

### `server/test/guards.test.ts` — the symlink-refusal case

**Analog:** the last case of `describe('importing a folder')`, 195-206. Copy its structure exactly — `mkdtempSync` into `tmpdir()`, write fixtures, assert on `src.files.map((f) => f.path)` with `assert.deepEqual`:

```typescript
  it('imports the ordinary file and nothing else', () => {
    const dir = mkdtempSync(join(tmpdir(), 'derive-repo-'));
    mkdirSync(join(dir, 'config'));
    for (const [name, body] of [['credentials', 'aws_secret_access_key = hunter2'], ..., ['README.md', '# a project\n\nwith some words in it.']] as const) {
      writeFileSync(join(dir, name), body);
    }
    const src = fromDirectory(dir);
    assert.deepEqual(
      src.files.map((f) => f.path),
      ['README.md'],
    );
  });
```

The new case builds a repo holding `README.md` plus `notes.md -> <a file outside the tree>` (use `symlinkSync`, added to the `node:fs` import list at line 24) and asserts the same `['README.md']`. `missing:` item 2 specifies this assertion verbatim. A companion case for the directory-symlink cycle (`link -> dir` pointing at its own ancestor) closes advisory 5 and must not hang.

**Doc-comment analog:** this suite's own header 1-19 was already rewritten in the gap closure to enumerate only what its cases drive ("What these cases exercise, one guard at a time: ..."). Extend that enumeration with the symlink clause rather than adding a new paragraph — and do not add a redirect clause unless a case actually drives one (git has no outbound HTTP in this environment; the honest form is the `readFileSync`-the-source assertion already used at guards.test.ts:174-177 for `AbortSignal.timeout`, which is the established pattern for "the absence of this flag is exactly the regression to catch").

---

### `server/test/security.test.ts` — the suite doc comment and the document-route cases

**Analog (an honest doc comment in this same file):** the `describe('a widened bind')` block comment, 222-232:

```typescript
/**
 * DERIVE_HOST is read once at boot, so this needs a server of its own. What
 * it proves is the defect the verification found, inverted: the allowed Host
 * names come from the address the connection landed on, so loopback still
 * works over loopback and a loopback name arriving from the network does not.
 */
```

That is the register: *what this proves*, stated as the inverse of a specific defect, with nothing claimed beyond the cases below it.

**What must change at 5-8:** "used to be open to any process on the machine … These cases are the proof that it is not." Every document-route case (280-337) exercises the credential-issuing path and asserts it *succeeds*; none bounds who may reach it. Two acceptable outcomes, matching `missing:` item 1:
- If the planner closes the loopback hole, add the bounding case first (an unauthenticated `GET /` on loopback is 401 / issues no cookie), then the sentence becomes true.
- If a local process is accepted as trusted, rewrite 5-8 to say what `doctor.mjs:74-75` says — open to any process on *this machine*, closed to the network and to any page.

Either way, plan 01-09's standing prohibition applies: **never make a test pass by narrowing what it asserts.** Narrow the *claim*, not the assertion.

Also in this file, per the anti-pattern table: the 199-202 "no Host header" case passes because node's parser rejects it (comment already says so — consider moving it out of `describe('the Host check')`), and the 4900+/5000+ fixed port ranges have no `EADDRINUSE` retry.

**Case-writing analog** (for any new document-route case) — 280-296:

```typescript
  it('refuse a foreign Host before any HTML is written', async () => {
    const res = await raw('/', { host: 'evil.com' });
    assert.equal(res.status, 403);
    assert.ok(!res.body.includes(token));
  });
```

`raw()` for header control, `req()` for the ordinary path, `cookieFrom`/`cookieValue` for the cookie, and every negative assertion carries a message string.

---

### `web/src/lib/api.ts` and `web/src/lib/useLesson.ts` — delete the dead token path

**Analog:** `web/src/lib/api.ts` 3-15, the neighbouring credential helper — a `/** */` block explaining what the value is and where it comes from, then a small `const` arrow with a `try/catch { /* private mode */ }`:

```typescript
/**
 * The selected learner profile, kept in this browser. Sent on every request
 * so lessons, the atlas and the review queue are theirs. Empty means the
 * first learner.
 */
const LEARNER_KEY = 'derive.learner';
export const currentLearner = (): string => { ... };
```

**Delete** `api.ts` 24-33 (the `deriveToken` doc block, the `token` module variable and the getter) and the `t` term in `headers()` 34-39, leaving:

```typescript
const headers = (extra: Record<string, string> = {}) => {
  const l = currentLearner();
  return { ...extra, ...(l ? { 'x-derive-learner': l } : {}) };
};
```

In its place put a short block in `currentLearner`'s register saying the browser authenticates with the HttpOnly `derive_session` cookie the document response set, which the page cannot read and does not need to send by hand (`missing:` item 6). Dev is unchanged: `web/vite.config.ts` adds `x-derive-token` on the proxy.

**Delete** `useLesson.ts` ~254-256 — the comment and the `auth` term:

```typescript
        // EventSource cannot set a header, so this is the one request that carries the install token in the query string.
        const auth = deriveToken() ? `&token=${encodeURIComponent(deriveToken())}` : '';
        es = new EventSource(`/api/lessons/${id}/stream?after=${lastSeq.current}${auth}`);
```

becomes the bare URL, with a one-line comment noting the cookie rides along because `EventSource` is same-origin. Drop `deriveToken` from the import at the top of the file (`noUnusedLocals` is on in `web/tsconfig.app.json`, so a stale import fails the build — that is the build's own check that the deletion is complete).

**Server side:** `index.ts:234`'s `/stream` query-token branch is now callerless. Removing it is in scope of the same edit; if it is kept for curl and the test harness, say so — `security.test.ts` drives the SSE stream with `?token=` today, so deleting it breaks a real case.

---

## Shared Patterns

### Fail closed on an unknown address
**Source:** `server/src/index.ts` `hostNames` ~145-160
**Apply to:** `index.ts:1092-1093` (the document middleware)
The one file already contains both polarities; the fix is to make the second match the first.

### One destination guard, re-checked on every hop
**Source:** `server/src/library.ts` `fetchPublic` 322-345 and `assertPublicHost` 152-175
**Apply to:** `repo.ts fromGitClone`
`repo.ts:14-15` already carries the comment explaining why a second copy of `assertPublicHost` is "exactly the wrong answer: two destination guards drift apart, and then one egress is weaker than the rest." That reasoning is why the clone fix is flags-on-git, not a new guard.

### Errors are lowercase human sentences on plain `Error`
**Source:** `repo.ts:148`, `repo.ts:275`, `index.ts:95-98`
**Apply to:** every new refusal in `repo.ts` and `index.ts`
No custom error classes, no codes. Narrow a caught value with `e instanceof Error ? e.message : String(e)`.

### A comment states the mechanism, never a guarantee the code does not deliver
**Source:** `scripts/doctor.mjs` 73-75; `server/test/guards.test.ts` 1-19 (both corrected in the last gap closure)
**Apply to:** `index.ts:102`, `index.ts:1075-1082`, `security.test.ts:5-8`
This is the single recurring defect of the phase — three green suites and two comments have now stated guarantees the code did not have. Every comment touched by this run must be checkable against a case or a line.

### Secrets never reach an egress
**Source:** `server/src/secrets.ts` `registerSecret`/`redact`/`redactDeep`, wired at `events.ts:18,30,40,45` and `export.ts:176`; registration at `index.ts:113-114`
**Apply to:** context only, not a change
The chokepoint is correct and correctly kept off lesson content (D-11). It cannot catch the material-text path (`materialEvent` at `index.ts:475` carries metadata only), which is precisely why the `repo.ts` symlink fix is the real closure and not a redaction change. Do **not** solve the token leak by extending pattern redaction onto material text — D-11 forbids it and it would corrupt a lesson that teaches about credentials.

### Test fixtures are offline and scratch-scoped
**Source:** `server/test/guards.test.ts` 28-29 (`DERIVE_DATA_DIR` set to a `mkdtempSync` dir *before* a dynamic `await import`), `server/test/security.test.ts` `startServer`
**Apply to:** the new `guards.test.ts` case
db.ts opens SQLite at import time; the env var must be set first. Never touch the learner's real `~/.derive`.

## No Analog Found

None. Every file in this gap-closure run is a modification of code this phase already wrote, and each fix has a sibling in the same file or in `library.ts`.

## Metadata

**Analog search scope:** `server/src/`, `server/test/`, `web/src/lib/`, `scripts/`
**Files read:** 9 (`index.ts`, `repo.ts`, `library.ts`, `guards.test.ts`, `security.test.ts`, `api.ts`, `useLesson.ts`, `doctor.mjs`, plus the two upstream planning docs)
**Pattern extraction date:** 2026-09-19
