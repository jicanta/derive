---
phase: 01-foundation
reviewed: 2026-09-19T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - server/src/index.ts
  - server/src/repo.ts
  - server/src/library.ts
  - server/src/db.ts
  - server/test/security.test.ts
  - server/test/guards.test.ts
  - server/test/tx.test.ts
  - scripts/doctor.mjs
  - .env.example
  - .claude/CLAUDE.md
  - .planning/codebase/ARCHITECTURE.md
  - .planning/phases/01-foundation/01-12-SUMMARY.md
findings:
  critical: 3
  warning: 10
  info: 5
  total: 18
status: issues_found
---

# Phase 01: Code Review Report (incremental re-review of the gap closure)

**Reviewed:** 2026-09-19
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found
**Diff base:** `239d5f1` → `HEAD` (plans 01-09, 01-10, 01-11, 01-12)

## Summary

This pass re-reviews the gap-closure work only: the `guardLocal` / `hostNames` /
`derive_session` front door (01-09), the clone-path destination guard (01-10),
and the `turns`/`usage` deletion (01-11). 01-12 changed no source.

**What is genuinely fixed.** Three claims I re-verified rather than took on trust:

- The install token is no longer in the markup. `readFileSync(indexPath)` is
  served verbatim (`index.ts:1061`, `index.ts:1071`) and nothing rewrites it.
- The browser credential is `HMAC-SHA256(TOKEN, 'derive browser session v1')`
  (`index.ts:107`), which is not invertible to the token, and both values are
  handed to `registerSecret` before any route exists (`index.ts:113-114`).
  Confirmed against the running server: the cookie is 64 hex and is **not** the
  contents of `~/.derive/token`.
- **Previous finding WR-01 is closed.** `deleteLesson` now issues
  `deleteUsageByLesson` then `deleteTurnsByLesson` inside its existing `withTx`
  (`db.ts:416-417`), and `deleteLearner` adds learner-scoped sweeps for the
  orphaned case (`db.ts:366-368`), in that same order. `tx.test.ts:219-234`
  covers the orphan path — a lesson row deleted out from under the ledger — and
  `tx.test.ts:236-258` counts over the whole table rather than one lesson. This
  is a correct and well-tested closure. It is not re-reported below.

**What is not fixed.** Three defects that the gap closure was specifically
supposed to close, and did not:

- **CR-01** — a repository import follows symlinks out of the cloned tree and
  reads their targets into course material. I reproduced this: a repo
  containing `notes.md -> <outside the repo>` imports the *target's* bytes.
  `isSecretName` is applied to the in-repo path, so it is bypassed entirely by
  naming the link anything ordinary. `~/.derive/token`, `~/.ssh/id_rsa` and
  `~/.codex/auth.json` are all reachable this way through the same
  `attach_material` entry point plan 01-10 hardened.
- **CR-02** — `assertPublicHost` runs on the URL the caller supplied, then
  `git clone` follows the first redirect (git's documented default is
  `http.followRedirects=initial`). The per-hop discipline `fetchPublic` already
  has (`library.ts:332-340`) is exactly what the clone path still lacks.
- **CR-03** — on loopback the document route issues a working full-API
  credential to a request that presented nothing. I reproduced it against the
  live server: `GET /` → `derive_session` → `GET /api/lessons` → 200, with no
  credential at any point. On loopback the reach of this is identical to the
  reach of the token-in-markup defect it replaced; what improved is that page
  script can no longer read it.

Below CR-03, the pattern from the first review repeats: a module's own prose
states a guarantee the code does not deliver. `index.ts:1075-1077` says "the
document routes are protected at least as well as the API they unlock";
`security.test.ts:6-8` says the API "used to be open to any process on the
machine... These cases are the proof that it is not". Neither is true as
written, and `doctor.mjs:74-75` — which *was* updated honestly ("or who can
reach the port from this machine") — contradicts both.

No structural pre-pass and no external reviewer evidence were supplied, so
every finding is from direct reading, with CR-01 and CR-03 reproduced on this
machine and CR-02 grounded in `git help config`'s stated default.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: A repository import follows symlinks out of the tree and reads their targets

**Severity:** BLOCKER
**File:** `server/src/repo.ts:139`, `server/src/repo.ts:161-170`, reached from `server/src/repo.ts:286`

**Issue:** `fromDirectory` builds its file list from `git ls-files` (which lists
symlinks as ordinary tracked paths) and then resolves each one with
`statSync(full)` / `readFileSync(full)` — both of which follow symlinks. A link
whose target lives outside the imported tree is read and stored as course
material.

`isSecretName` does not help: it is applied to the *repo-relative path*
(`repo.ts:151`), so a link named `notes.md` or `token.md` passes every filter
while pointing anywhere on disk.

Reproduced on this machine:

```
$ mkdir symrepo && cd symrepo && git init -q
$ echo "SUPER SECRET KEY abc123" > ../outside.txt
$ ln -s ../outside.txt notes.md && echo '# hi' > README.md && git add -A && git commit -qm x

$ node --import tsx -e "fromDirectory('.../symrepo')"
[ { "path": "README.md", "text": "# hi\n" },
  { "path": "notes.md",  "text": "SUPER SECRET KEY abc123\n" } ]
```

The reachable entry point is the one `guards.test.ts:6-9` names: the tutor model
calls `attach_material` with a repo URL, `collectRepo` routes every non-GitHub
URL to `fromGitClone` (`repo.ts:299`), and `fromGitClone` hands the clone to
`fromDirectory` (`repo.ts:286`). A hostile public repository — or a
prompt-injected model choosing one — therefore reads arbitrary learner-readable
files into the material table and into the model's context. `~/.derive/token`
is among them, via `token.md -> ~/.derive/token`: material text goes to the
model through `readMaterial` without passing the `emit` redaction chokepoint, so
the install token leaves the process that way.

Plan 01-10's guard stops the request from *going* somewhere private; nothing
stops the clone from *bringing back* something private.

**Fix:** Refuse links rather than following them, in both the listing and the
read, and confine every read to the import root:

```ts
import { lstatSync, realpathSync } from 'node:fs';

// in walk(), judge the entry itself rather than its target
const st = lstatSync(full);
if (st.isSymbolicLink()) continue;

// in fromDirectory's read loop, replace statSync(full)
const fst = lstatSync(full);
if (!fst.isFile() || fst.size > READ_BYTES) { skipped += 1; continue; }
// and pin the root for the git ls-files path, which does not go through walk()
const rootReal = realpathSync(dir);
const real = realpathSync(full);
if (real !== rootReal && !real.startsWith(rootReal + sep)) { skipped += 1; continue; }
```

Add a case to `guards.test.ts`'s "importing a folder" block that builds the repo
above and asserts `src.files.map((f) => f.path)` is `['README.md']` — the same
shape as the existing secret-name case at `guards.test.ts:195-206`, which
currently passes only because it uses real files rather than links.

---

### CR-02: The clone guard is bypassable by an HTTP redirect

**Severity:** BLOCKER
**File:** `server/src/repo.ts:274-279`

**Issue:** `fromGitClone` checks the scheme, awaits `assertPublicHost(url)`, and
then spawns `git clone` with that same URL. The ordering is correct (the guard
runs before `mkdtempSync` and before the spawn — `guards.test.ts:137-151` proves
it) but the guard judges only the URL the caller supplied. `git help config`:

> `http.followRedirects` — ... If set to `initial`, git will follow redirects
> only for the initial request to a remote ... **The default is `initial`.**

The initial request to the remote is exactly the one that matters. A URL on a
public host that 302s to `http://10.0.0.5/internal.git` or
`http://169.254.169.254/...` is followed by git, and `assertPublicHost` never
sees the second hop. This is the identical bypass `fetchPublic` already defends
against by re-running the guard on every hop (`library.ts:332-340`), with the
module comment at `library.ts:322-324` spelling out why — "a public URL is free
to redirect to 127.0.0.1 and the only honest way to catch that is to check each
hop before taking it". The clone path does not apply its own module's lesson.

Secondary, same call: the guard resolves the host and git resolves it again, so
a short-TTL record can answer public to one and private to the other. That is
harder to close, but `http.followRedirects=false` closes the cheap half outright.

(Submodules are not a vector here: `--depth 1` without `--recurse-submodules`
never fetches them. URL forms are not a vector either — `new URL` puts
`https://evil.com@127.0.0.1/x.git` at hostname `127.0.0.1`, which the guard
refuses.)

**Fix:** Forbid redirects and pin the protocol on the clone itself, so the URL
the guard judged is the only URL git can reach:

```ts
execFileSync(
  'git',
  ['-c', 'http.followRedirects=false', '-c', 'protocol.allow=never', '-c', 'protocol.https.allow=always',
   'clone', '--depth', '1', '--quiet', url, tmp],
  { stdio: ['ignore', 'ignore', 'pipe'], timeout: 120_000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } },
);
```

`GIT_TERMINAL_PROMPT=0` belongs there too: without it a URL needing credentials
blocks on a prompt until the 120s timeout, holding the request open.

Pin it with a case in `guards.test.ts`'s `cloning` block: stand up two loopback
fixture servers, have the first 302 to the second, drive `execFileSync` with the
flags above, and assert the second server logged nothing.

---

### CR-03: The document route hands a full API credential to a request that presented nothing

**Severity:** BLOCKER
**File:** `server/src/index.ts:1087-1104`, `server/src/index.ts:1064-1072`

**Issue:** On a loopback connection the document middleware returns early —
`if (!here || isLoopback(here)) return next();` (`index.ts:1093`) — and
`serveApp` then calls `issueSession(c)` unconditionally (`index.ts:1070`). The
value it sets is accepted by the `/api/*` middleware as a credential
(`index.ts:236`). So one unauthenticated GET converts "can open a TCP socket to
the port" into "can do everything the API can do".

Reproduced against the running server on 4310:

```
$ C=$(curl -s -D - -o /dev/null http://127.0.0.1:4310/ | sed -n 's/.*derive_session=\([0-9a-f]*\).*/\1/p')
cookie len: 64
$ curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4310/api/lessons
401
$ curl -s -o /dev/null -w '%{http_code}\n' -H "Cookie: derive_session=$C" http://127.0.0.1:4310/api/lessons
200
cookie equals token file: NO
```

On loopback this is the same reach as the defect it replaced. The previous
review's CR-01 was rated critical because "any process, any user on the machine
... can read the token and then use it"; that sentence is still true with
`derive_session` substituted for the token. What genuinely improved is that the
credential is `HttpOnly` (a compromised frontend dependency can no longer read
it) and is not the install token (so the token itself stays in-process). What
did not improve is the 0600 file mode's standing as a control:
`security.test.ts:116-119` asserts that mode, and `doctor.mjs:82` tells the
learner to `chmod 600` it, but no attacker needs to read it.

Three claims in the reviewed files are false as written:

- `index.ts:1075-1077` — "The document routes are protected at least as well as
  the API they unlock." They are strictly weaker: the API requires a credential,
  the document route requires none and *issues* one.
- `index.ts:1081-1082` — "On loopback the browser is on this machine and is
  handed its cookie for nothing, which is the default and the only quiet case."
  Accurate about the mechanism; it is the word "browser" that is doing work the
  code cannot do — nothing distinguishes a browser from `curl`.
- `security.test.ts:6-8` — the suite's stated premise. Every case in it that
  touches the document route (`security.test.ts:280-337`) exercises the
  credential-issuing path and asserts it *succeeds*; none asserts a bound on who
  can reach it.

Browser-borne exploitation is blocked (`SameSite=Strict` keeps the cookie out of
third-party frames and cross-site navigations, and `guardLocal`'s Origin check
refuses `fetch` from a foreign page — `index.ts:207`). The exposure is to local
processes, which is precisely the class `doctor.mjs:74-75` names.

**Fix:** Either close it or stop claiming it is closed — but not neither.

To close it, the document route must require the token on loopback too, exactly
as it already does on a widened bind, and the app must be opened once with it:

```ts
app.use('/*', async (c, next) => {
  if (c.req.path.startsWith('/api/')) return next();
  const refusal = guardLocal(c);
  if (refusal) return refusal;

  const cookie = offered(getCookie(c, SESSION_COOKIE));
  if (cookie && sameValue(cookie, SESSION_BUF)) return next();

  const presented = offered(c.req.header('x-derive-token')) || offered(c.req.query('token'));
  if (presented && sameValue(presented, TOKEN_BUF)) {
    issueSession(c);
    return c.redirect(safePath(c.req.path), 302);   // see WR-02 for safePath
  }
  return c.json({ error: `open this page once as ${c.req.path}?token=<the token in ${TOKEN_PATH}>` }, 401);
});
```

and print the one-time URL on the startup line so `pnpm start` stays one step.
(A unix domain socket is the stronger answer and removes the port from the
threat model entirely, but it is a transport change, not a patch.)

If the residual is accepted instead, correct `index.ts:1075-1077`,
`index.ts:1081-1082` and `security.test.ts:6-8` to say what holds — "any client
that can reach the port on this machine is trusted; the token file protects
against a *remote* client and against page script, not against a local process"
— and delete the 0600 assertion's implication at `security.test.ts:116-119`.
Shipping a control whose own test suite states a stronger property than the code
has is how the first review's CR-01 survived a whole phase.

## Warnings

### WR-01: An unknown local address fails open on the document route

**Severity:** WARNING
**File:** `server/src/index.ts:1092-1093`, against `server/src/index.ts:150-152`

**Issue:** `hostNames` treats "no address to go on" as fail-closed — it returns
only the loopback names (`index.ts:152`), and the comment says so. The document
middleware makes the opposite choice for the same condition:
`if (!here || isLoopback(here)) return next();`. With `localAddress()`
undefined (a destroyed socket, an adapter that does not surface
`incoming.socket`), a request from the network that forges `Host: 127.0.0.1:PORT`
passes `guardLocal` — because the loopback names are all that is allowed — and
then takes the `!here` branch, receiving a session cookie for free. The entire
widened-bind protection collapses to the one condition both functions agree is
unknowable.

**Fix:** Require a known loopback address before the free credential, so the two
fallbacks point the same way:

```ts
const here = localAddress(c);
if (here && isLoopback(here)) return next();
```

An unknown address then takes the token path, which is the conservative branch.

---

### WR-02: `c.redirect(c.req.path)` is an open redirect and a 500

**Severity:** WARNING
**File:** `server/src/index.ts:1101`

**Issue:** `c.req.path` is taken verbatim from the request line. Hono's `getPath`
(`hono/dist/utils/url.js:68-85`) slices from the first `/` after the authority,
so a request for `http://host//evil.example?token=...` yields
`c.req.path === '//evil.example'` and the response is
`Location: //evil.example` — a protocol-relative URL the browser resolves to
another host. The same function percent-decodes when a `%` is present, so a path
carrying an encoded CR/LF reaches `setHeader('Location', ...)`, which Node
rejects with `ERR_INVALID_CHAR` — a 500 on the credential-handoff path.

Reachability is limited (this branch runs only when a correct token was
presented, and only on a widened bind), which is why this is a warning and not a
blocker. It is still a redirect primitive on the one route that hands out a
credential.

**Fix:** Redirect to a path this server constructed, never to one it was handed:

```ts
/** A request path safe to put in Location: one leading slash, no scheme, no authority. */
const safePath = (p: string) => '/' + p.replace(/^\/+/, '').replace(/[\r\n]/g, '');
...
return c.redirect(safePath(c.req.path), 302);
```

---

### WR-03: The Host check requires an explicit port, so `PORT=80` refuses every browser

**Severity:** WARNING
**File:** `server/src/index.ts:202`, with `server/src/index.ts:167-170`

**Issue:** `guardLocal` ends its host test with `port !== String(PORT)`.
Browsers omit the port from `Host` for the default port of the scheme, so with
`PORT=80` every browser sends `Host: localhost` (port `''`), `'' !== '80'`, and
every request — document and API — is refused 403. `PORT` is a documented,
first-class knob (`.env.example:4-5`, `config.ts:8`), and nothing warns that two
of its values brick the app. `443` is the same, and the 403 text
("derive answers on ... at port 80, and a request has to name it") sends the
learner looking in the wrong place.

**Fix:** Treat an absent port as the scheme default:

```ts
const DEFAULT_PORT = PORT === 80 ? '80' : PORT === 443 ? '443' : '';
if (UNSPECIFIED_NAMES.has(host) || !hostNames(c).has(host) || (port || DEFAULT_PORT) !== String(PORT)) { ... }
```

Add the case to `security.test.ts`'s Host block: a server on port 80 is awkward
in CI, so assert it at the unit level by exporting `splitHost` and the port
comparison rather than by binding.

---

### WR-04: The GitHub tarball path never applies `isSecretName`

**Severity:** WARNING
**File:** `server/src/repo.ts:255`, against `server/src/repo.ts:55-59`

**Issue:** `isSecretName`'s own doc comment promises it runs "both when the list
is built and when the tree is walked, so a matching file is never even
collected". `fromDirectory` honours that (`repo.ts:139`, `repo.ts:151`).
`fromGitHub` does not — its filter is
`!inSkippedDir(p) && isTextName(p)` with no secret check. `auth.json` (`.json` is
in `TEXT_EXTS`) and `.env.example` (`extname` returns `.example`, which is also
in `TEXT_EXTS`) are collected from a tarball but refused from a folder, for no
reason either function states.

The impact is bounded — a public repo's checked-in files are already public — but
the asymmetry means the guard's stated invariant is false, and the next person
who adds an import path has no way to know which of the two shapes is the rule.

**Fix:** One filter for both paths:

```ts
const paths = orderFiles([...byPath.keys()].filter((p) => !inSkippedDir(p) && !isSecretName(p) && isTextName(p)));
```

---

### WR-05: `walk()` follows directory symlinks with no cycle guard

**Severity:** WARNING
**File:** `server/src/repo.ts:122-143`

**Issue:** `statSync` follows links, so a symlink to a directory reads as
`isDirectory()` and `walk` recurses into it (`repo.ts:137-138`). A link pointing
at its own ancestor recurses forever: the `out.length > MAX_FILES * 4` brake
(`repo.ts:140`) only fires once entries have been *pushed*, and a directory whose
only entry is the loop link pushes nothing. The result is a
`RangeError: Maximum call stack size exceeded` — catchable, so the route returns
422, but it is unbounded recursion in a path a learner can trigger by naming any
folder containing a self-referential link. A link to `/` instead walks the disk
until the brake trips.

This is the same root cause as CR-01; the `lstatSync` fix there closes both, and
is listed separately because the failure mode and the test differ.

**Fix:** As CR-01 — `lstatSync` and `continue` on `isSymbolicLink()`. If
following links is ever wanted, carry a `Set` of `realpathSync` values and skip
one already seen.

---

### WR-06: The `repo → library → materials → repo` ring is enforced by convention only

**Severity:** WARNING
**File:** `server/src/repo.ts:14-15`, `server/src/library.ts:31-32`

**Issue:** The ring resolves today — I traced both entry orders and neither
touches a cyclic binding during evaluation (`library.ts` uses `partsOf`, `SEP`
and `titleOf` only inside function bodies; `materials.ts:183` calls `collectRepo`
only inside `attachRepo`; `repo.ts:276` calls `assertPublicHost` only inside
`fromGitClone`). So this is not a live initialization-order bug.

It is a fragile one. Both comments state the invariant honestly — "move any of
them to module scope and repo.ts's import breaks, with no signal at the line you
edited" — which is an accurate description of a trap, not a mitigation. Nothing
enforces it: no test imports the three modules in each order, and `tsc` will not
complain. A future `const DEFAULT_UA = titleOf(...)` at module scope in
`library.ts` fails at boot, in a different file, with a `undefined is not a
function`.

The comment's stated alternative — "A second copy of assertPublicHost would
avoid the ring and is exactly the wrong answer" — is correct about duplication
but treats duplication and the ring as the only two options. There is a third,
and it is the one the codebase's own module conventions point at (one file per
topic, no barrels).

**Fix:** Extract the destination guard into its own leaf module that imports
nothing from the ring:

```ts
// server/src/net-guard.ts — where a fetch or a clone is allowed to go.
export function isPrivateAddress(ip: string): boolean { ... }
export async function assertPublicHost(url: string): Promise<void> { ... }
```

`library.ts` and `repo.ts` both import it; the ring disappears; there is still
exactly one guard. `guards.test.ts:30` then imports it directly and no longer
needs `DERIVE_DATA_DIR` set just to reach a pure function (`guards.test.ts:27-28`).

---

### WR-07: Deleting a learner leaves their lessons' pending and held cards alive

**Severity:** WARNING
**File:** `server/src/index.ts:312-322`, `server/src/index.ts:361-368`, `server/src/index.ts:776`

**Issue:** `DELETE /api/lessons/:id` cancels pending prompts and drops the held
card (`index.ts:364-365`). `DELETE /api/learners/:id` does neither: it
interrupts each lesson's turn and calls `deleteLearner` (`index.ts:316-317`),
leaving every entry those lessons own in `pending` (`prompts.ts`) and in `held`
(`index.ts:774`). A card settled afterwards resolves a tool that writes an event
against a lesson row that no longer exists, and `/api/external/active` can still
report `held.get(l.id)?.id` for a deleted lesson (`index.ts:755`).

Separately, and on both routes: `recentCards` (`index.ts:776`) is written at
`index.ts:805` and never deleted anywhere in the file. It grows for the life of
the process, one entry per external lesson.

**Fix:**

```ts
// in DELETE /api/learners/:id, before deleteLearner
for (const l of listLessons(id)) {
  await interrupt(l.id);
  cancelPending(l.id, { held: true });
  held.delete(l.id);
  recentCards.delete(l.id);
}

// and add the missing line to DELETE /api/lessons/:id
recentCards.delete(id);
```

---

### WR-08: The boot sweep still closes turns without the usage row the ledger promises

**Severity:** WARNING
**File:** `server/src/index.ts:69-71`, against `server/src/db.ts:635-648`

**Issue:** Carried over from the first review (WR-02) and still open;
re-reported because it is now load-bearing for work that *did* land.
`closeUsage`'s contract is "Every turn gets a usage row, whichever driver ran
it... it is why turn counts reconcile across every view" (`db.ts:636-643`). Both
other closing paths honour it — `driver.ts:115` and `index.ts:992`. The restart
sweep does not: `closeOpenTurns` runs the UPDATE only (`db.ts:524-530`) and the
boot loop emits `turn_end` without calling `closeUsage`. `grep -rn closeUsage
server/src/` returns three call sites and this is not one of them.

Plan 01-11 has just made `usage` a table the deletion paths are responsible for
keeping consistent. Leaving one writer that skips it means the ledger's own
invariant is broken by the most ordinary event there is — a restart.

**Fix:** Put the call where it cannot be forgotten, inside `closeOpenTurns`:

```ts
export function closeOpenTurns(status: TurnStatus): TurnRow[] {
  return withTx(() => {
    const rows = openTurns();
    if (rows.length) q.closeOpenTurns.run(Date.now(), status);
    for (const r of rows) closeUsage(r.id);
    return rows;
  });
}
```

and assert it in `tx.test.ts` alongside the existing ledger cases: open a turn,
call `closeOpenTurns('interrupted')`, expect `listUsage({ turn }).length === 1`.

---

### WR-09: The web client still reads the `<meta name="derive-token">` the server no longer writes

**Severity:** WARNING
**File:** `web/src/lib/api.ts:26-33`, `web/src/lib/useLesson.ts:255-257` (consequence of `server/src/index.ts:1060-1072`)

**Issue:** 01-09 removed the meta-tag injection; `git diff --quiet -- web/` was
kept as a constraint across all four plans (01-12-SUMMARY, D3), so the reader
was left in place. `deriveToken()` now always returns `''`. Three consequences,
none fatal but all misleading:

- `api.ts:26-30`'s comment — "The install token, put into this document by the
  server that served it" — describes a mechanism that no longer exists.
- `headers()` (`api.ts:35-39`) never adds `x-derive-token`, so every request now
  depends on the cookie or the Vite proxy. That works (same-origin `fetch` sends
  cookies by default; `vite.config.ts` sets the header with
  `changeOrigin: true`, so the proxied `Host` is `localhost:4310` and
  `guardLocal` passes), but it works by accident of defaults rather than by
  anything stated.
- `useLesson.ts:255` — "EventSource cannot set a header, so this is the one
  request that carries the install token in the query string" — describes dead
  code. The query branch is never taken, which also means the `/stream` query
  path in the API middleware (`index.ts:234`) now has no caller in this repo.

**Fix:** Delete `deriveToken()` and its two call sites, replace the comments with
what is now true ("the browser authenticates with the `derive_session` cookie the
document set; in dev the Vite proxy adds the header instead"), and decide
deliberately whether `index.ts:234`'s query-parameter path still earns its place.

---

### WR-10: The "no Host header" case cannot fail for the reason it names

**Severity:** WARNING
**File:** `server/test/security.test.ts:199-202`

**Issue:** The case asserts `status >= 400`. Node's own HTTP parser rejects an
HTTP/1.1 request with no `Host` before Hono sees it, so this assertion holds
whether or not `guardLocal` exists. The comment is honest about it ("node's own
parser turns this away with a 400 before the middleware sees it"), but the case
is still filed under `describe('the Host check')` and counted among its
protections. A test that passes with the code under test deleted is a test that
will be read as coverage the next time someone touches `splitHost`.

Same block, smaller: `startServer` picks `4900 + random(90)` (`security.test.ts:88`)
and the widened server `5000 + random(90)` (`security.test.ts:229`) with no
retry on `EADDRINUSE`, so two concurrent runs — or a stray process on the range
the 01-12 reproductions used (4987, 4988) — fail the suite with
"server did not start".

**Fix:** Either drop the case or make it assert what it actually proves — that
`splitHost('')` yields an empty host and `UNSPECIFIED_NAMES` refuses it — as a
unit test over the exported helper. For the ports, listen on `0` and read the
assigned port back, or retry once on `EADDRINUSE`.

## Info

### IN-01: `/api/health` is exempt from `guardLocal`, not just from the credential

**Severity:** INFO
**File:** `server/src/index.ts:228`

The exemption is `if (c.req.path === '/api/health') return next();`, which skips
the Host and Origin checks as well as the token. The justification at
`index.ts:218-220` covers the credential ("the doctor and the test harnesses
poll it before there is anything to authenticate with") but not the other two,
and `doctor.mjs:92` only needs the credential exemption. A DNS-rebound page can
therefore read `version`, `backend` and `backend_source` from a machine it
cannot otherwise address.

**Fix:** Run `guardLocal` on health too and exempt only the credential:
`if (c.req.path === '/api/health') { const r = guardLocal(c); return r ?? next(); }`.

---

### IN-02: The session value never rotates, and the comment describes only the client half

**Severity:** INFO
**File:** `server/src/index.ts:1063`

"No expiry, so it dies with the tab's session" is true of the *cookie*; the
*value* is a pure function of the install token and is accepted forever. A
captured `Set-Cookie` (plain HTTP over the LAN on a widened bind, a shared
machine, a screenshot) stays valid until the learner deletes `~/.derive/token`,
and there is no way to revoke one browser.

**Fix:** Derive the session from the token plus a per-boot or per-issue nonce
stored alongside it, so deleting one line of state revokes every outstanding
cookie. At minimum, amend the comment to say the server-side value is permanent.

---

### IN-03: `deleteLesson`'s comment invokes a foreign-key relationship SQLite is not enforcing

**Severity:** INFO
**File:** `server/src/db.ts:413-415`

"Usage before turns: a usage row names the turn it was recorded against, so
clearing usage first means no state inside the transaction has a row pointing at
a turn that is already gone." The ordering is right and harmless, but there is no
`REFERENCES` clause on `usage.turn_id` and `PRAGMA foreign_keys` is never turned
on (`db.ts:13` sets only `journal_mode`), so nothing enforces or even observes
it. `tx.test.ts` counts rows but never pins the order, so a future reordering
passes every test.

**Fix:** Either enable the constraint the comment describes (`PRAGMA
foreign_keys = ON` plus `REFERENCES turns(id)` in the migration) — which makes
the ordering load-bearing and self-testing — or reword the comment to say it is
a readability convention.

---

### IN-04: `DERIVE_ORIGINS` can silently re-admit loopback host names on a LAN connection

**Severity:** INFO
**File:** `server/src/index.ts:156-162`, `.env.example:44-46`

`hostNames` adds every `DERIVE_ORIGINS` hostname to the allowed set regardless of
which address the connection arrived on. The comment at `index.ts:145-148`
explains carefully why the four built-in loopback origins are excluded —
"adding those would put 127.0.0.1 back in the set on a LAN connection, which is
the forged loopback Host this is here to refuse" — and then a learner who puts
`http://localhost:5173` in `DERIVE_ORIGINS` (a plausible thing to do while
debugging) undoes exactly that, with no warning. `.env.example:44-46` describes
`DERIVE_ORIGINS` as a browser-origin allowlist and does not mention that it also
widens the Host allowlist.

**Fix:** Say so in `.env.example`, and skip any `DERIVE_ORIGINS` entry whose
hostname is a loopback name when the connection did not arrive on loopback.

---

### IN-05: The credential-issuing document sets no `cache-control` and no framing header

**Severity:** INFO
**File:** `server/src/index.ts:1069-1072`

`serveApp` returns `c.html(rawIndex)` with a `Set-Cookie` and no
`cache-control: no-store` (the previous review's suggested fix included it; it
did not land) and no `X-Frame-Options` / CSP `frame-ancestors`. Neither is
currently exploitable — browsers do not replay `Set-Cookie` from cache, and
`SameSite=Strict` keeps the cookie out of a third-party frame — but both are one
cookie-attribute change away from mattering, and the catch-all (`index.ts:1109`)
answers `200` with a fresh cookie for every path a missing asset resolves to.

**Fix:** `c.header('cache-control', 'no-store')` and
`c.header('x-frame-options', 'DENY')` in `serveApp`.

---

_Reviewed: 2026-09-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
