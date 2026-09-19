---
phase: 01-foundation
reviewed: 2026-09-19T00:00:00Z
depth: standard
files_reviewed: 59
files_reviewed_list:
  - .env.example
  - .github/workflows/ci.yml
  - codex/skills/derive-learn/SKILL.md
  - codex/skills/derive-review/SKILL.md
  - method/00-identity.md
  - method/10-philosophy.md
  - method/20-tools.md
  - method/30-quiz-options.md
  - method/40-discipline.md
  - method/50-checks.md
  - method/60-process.md
  - method/70-material.md
  - method/80-library.md
  - method/90-preferences.md
  - method/95-writing-style.md
  - method/surfaces/app.md
  - method/surfaces/claude-code.md
  - method/surfaces/codex-learn.md
  - method/surfaces/codex-review.md
  - package.json
  - plugin/commands/learn.md
  - plugin/commands/review.md
  - plugin/hooks/mirror.mjs
  - plugin/skills/teach/SKILL.md
  - pnpm-lock.yaml
  - scripts/check-method.mjs
  - scripts/doctor.mjs
  - scripts/render-method.mjs
  - server/package.json
  - server/src/agent.ts
  - server/src/codex.ts
  - server/src/config.ts
  - server/src/db.ts
  - server/src/driver.ts
  - server/src/drivers/fake.ts
  - server/src/events.ts
  - server/src/export.ts
  - server/src/index.ts
  - server/src/library.ts
  - server/src/mcp.ts
  - server/src/method.generated.ts
  - server/src/migrations.ts
  - server/src/prompt.ts
  - server/src/repo.ts
  - server/src/secrets.ts
  - server/src/tools.ts
  - server/test/api.test.ts
  - server/test/driver.test.ts
  - server/test/guards.test.ts
  - server/test/mcp.test.ts
  - server/test/migrations.test.ts
  - server/test/secrets.test.ts
  - server/test/security.test.ts
  - server/test/tx.test.ts
  - server/test/usage.test.ts
  - server/test/wire-surface.json
  - server/test/wire-surface.test.ts
  - web/src/lib/api.ts
  - web/src/lib/useLesson.ts
  - web/vite.config.ts
findings:
  critical: 3
  warning: 14
  info: 7
  total: 24
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-09-19
**Depth:** standard
**Files Reviewed:** 59
**Status:** issues_found

## Summary

This phase adds an authentication boundary (a per-install token), a migration
runner with transactional writes, a turns/usage ledger, a driver seam, a
secrets-redaction chokepoint, and a single-source method renderer. The
engineering is careful and the prose in the modules is unusually good, which
makes the defects below easier to miss: several of them are places where a
module's own doc comment states a guarantee the code does not deliver.

The headline finding is CR-01. The whole phase is built on the premise, stated
in `server/src/index.ts:965-971` and in `scripts/doctor.mjs:80`, that the
install token is a secret held in a 0600 file and "never as data from a route".
It is in fact returned in full, in plain text, to **any unauthenticated GET of
any non-`/api` path**. I started the built server against a scratch data
directory and confirmed it: `curl http://127.0.0.1:PORT/` returns
`<meta name="derive-token" content="<the 64 hex chars>">`, and that harvested
value then returns 200 on `/api/lessons`. Every other control added in this
phase — the 0600 mode, the Host check, the Origin allowlist, the constant-time
compare — sits behind a value anyone who can open a TCP connection can read.

CR-02 and CR-03 are the two other places where a control announced in this
phase does not cover the path it names: the documented `DERIVE_HOST=0.0.0.0`
configuration rejects every legitimate remote request while a forged `Host`
header sails through, and the `git clone` egress path never runs the
private-destination guard the rest of the fetch code now runs on every hop.

The warnings are mostly invariant drift: rows the new ledger promises but does
not always write, rows the delete paths do not remove, and a redaction pattern
that corrupts ordinary error text.

No structural pre-pass was supplied and no external reviewer evidence was
provided, so every finding below is from direct reading of the submitted files,
with the three critical ones reproduced against the built server.

## Critical Issues

### CR-01: The install token is handed to any unauthenticated request

**File:** `server/src/index.ts:975-980`
**Issue:** The built app's `index.html` is rewritten at boot to carry the token
in a `<meta>` tag, and that document is served by three routes — `/`,
`/index.html`, and the catch-all `app.get('*')` — none of which is behind the
`/api/*` middleware that checks Host, Origin and token. Any process, any user
on the machine, and (with CR-02) any device on the network can read the token
and then use it.

Reproduced against `server/dist/index.js` on a scratch data dir:

```
$ curl -s http://127.0.0.1:4987/ | grep -o 'derive-token[^>]*'
derive-token" content="797ca6d9...d7b66f" /

$ curl -s http://127.0.0.1:4987/anything/at/all | grep -c derive-token
1                                   # the catch-all leaks it too

$ curl -s -o /dev/null -w '%{http_code}\n' -H "x-derive-token: 797ca6d9...d7b66f" \
    http://127.0.0.1:4987/api/lessons
200
```

This invalidates three claims made in this phase:

- `server/src/index.ts:965-971` — "never as data from a route, so a hostile
  page has nothing to call (D-09)".
- `server/src/index.ts:101` — "read once at boot, compared on every request,
  and never logged, emitted or returned".
- `scripts/doctor.mjs:80` — "Anyone who can read that file can drive your
  lessons"; the 0600 mode is checked and reported as a control, but the token
  is obtainable without reading the file at all.

`server/test/security.test.ts` opens by asserting "no response anywhere carries
the token back out", but every case in it exercises `/api/*` only. The one
route that does carry it out is the one the suite never requests (see IN-07).

**Fix:** The document that carries the token must be at least as protected as
the API it unlocks, and the token must not be scrapeable by script once
delivered. Concretely:

```ts
// 1. Factor the middleware's Host/Origin check into a function and run it on
//    the document routes too, so a rebound page and a foreign Host cannot even
//    fetch the page that holds the token.
const addressedToUs = (c: Context) => {
  const { host, port } = splitHost(c.req.header('host') ?? '');
  if (!ALLOWED_HOSTS.has(host) || port !== String(PORT)) return false;
  const origin = c.req.header('origin');
  return !origin || ALLOWED_ORIGINS.includes(origin);
};

// 2. Hand the token as an HttpOnly, SameSite=Strict cookie on the document
//    response rather than as readable markup, and accept the cookie in the
//    /api middleware alongside the header. Script on the page (including a
//    compromised dependency) can then no longer read it, and the API can drop
//    the query-string path for SSE because the cookie rides along.
const serveApp = (c: Context) => {
  if (!addressedToUs(c)) return c.text('not found', 404);
  c.header('cache-control', 'no-store');
  c.header('set-cookie', `derive_token=${TOKEN}; Path=/; HttpOnly; SameSite=Strict`);
  return c.html(rawIndex);       // no token in the markup at all
};
app.get('/', serveApp);
app.get('/index.html', serveApp);
app.get('*', serveApp);
```

Note this narrows the exposure to "any client that can connect and pass the
Host check" rather than eliminating it — a same-machine process can still
forge `Host: 127.0.0.1:<port>` and collect the cookie. If the token is meant
to be an authentication boundary against other local users, the transport has
to change (a unix domain socket, or a one-time handoff printed on the console
that the app exchanges for the session cookie). Whichever is chosen, the
comments at `index.ts:101`, `index.ts:965-971` and the `doctor.mjs:80` fix line
must be corrected to state what is actually guaranteed, and
`server/test/security.test.ts` must add a case that fetches `/` and asserts
the token is not in the body.

---

### CR-02: `DERIVE_HOST=0.0.0.0` refuses every legitimate remote request and admits a forged one

**File:** `server/src/index.ts:109` and `server/src/index.ts:144-145`
**Issue:** `ALLOWED_HOSTS` is built from the literal `HOST` value, not from the
addresses the server is reachable at. With `DERIVE_HOST=0.0.0.0` — the exact
value `.env.example:31` documents for "open it to the network" — the set
becomes `{127.0.0.1, localhost, [::1], 0.0.0.0}`. A second device addresses the
server by its LAN address, so its `Host` header is `192.168.0.166:4988`, which
is in none of them.

Reproduced:

```
$ DERIVE_HOST=0.0.0.0 node server/dist/index.js       # port 4988

$ curl -s -H "x-derive-token: $T" http://192.168.0.166:4988/api/lessons
{"error":"derive answers on 127.0.0.1, localhost, [::1], 0.0.0.0 at port 4988 only"}   # 403

$ curl -s -o /dev/null -w '%{http_code}\n' -H "x-derive-token: $T" \
       -H "Host: 127.0.0.1:4988" http://192.168.0.166:4988/api/lessons
200
```

So the documented configuration is broken for its stated purpose, and the
startup banner at `index.ts:987-992` ("every device that can reach this machine
on port N can reach your lessons") describes behaviour the code does not have.
Worse, combined with CR-01 the same remote device can read the token off `/`
over the LAN (confirmed) and then forge the loopback `Host` to get in: the Host
check stops only browsers, which is the one class of client that cannot reach
the token this way anyway.

**Fix:** Derive the allowlist from the addresses the server actually answers on
rather than from the literal bind string, and reject the wildcard as a host
name:

```ts
import { networkInterfaces } from 'node:os';

const localAddresses = () =>
  Object.values(networkInterfaces())
    .flat()
    .filter((i): i is NonNullable<typeof i> => !!i)
    .map((i) => (i.family === 'IPv6' ? `[${i.address.split('%')[0]}]` : i.address));

const ALLOWED_HOSTS = new Set(
  ['127.0.0.1', 'localhost', '[::1]', ...(HOST_IS_LOOPBACK ? [] : ['0.0.0.0', '::'].includes(HOST) ? localAddresses() : [HOST.toLowerCase()])].map((h) => h.toLowerCase()),
);
```

and document in `.env.example` that on a widened bind the `Host` check is not a
security control against non-browser clients, only a DNS-rebinding defence for
browsers.

---

### CR-03: `git clone` bypasses the private-destination guard this phase added

**File:** `server/src/repo.ts:271-289`
**Issue:** `fromGitClone` refuses non-https URLs (good) but never calls
`assertPublicHost`. Every other egress in the phase — `fetchPublic` in
`server/src/library.ts:329-347`, checked on every redirect hop — refuses
loopback, RFC-1918, link-local and CGNAT destinations. `collectRepo`
(`repo.ts:291-298`) routes any non-GitHub repo URL straight to `fromGitClone`,
so:

```
POST /api/materials/repo  {"source": "https://192.168.0.5/internal.git"}
POST /api/materials/repo  {"source": "https://127.0.0.1:8443/private.git"}
```

both clone from an internal host, and every readable text file in that
repository is then ingested as course material and readable by the model
through `read_material`/`search_material`. This is not only reachable from the
API: the MCP `attach_material` tool takes "a GitHub / git URL" straight from
the model (`server/src/tools.ts:377-381`, `server/src/mcp.ts:248-252`), which is
exactly the model-steered path the guard's own doc comment
(`library.ts:143-150`, "because the tutor model itself can hand Derive a URL")
says the guard exists for. `server/test/guards.test.ts:123-131` tests the
scheme check on this path and nothing else.

**Fix:** Run the same guard before the spawn:

```ts
async function fromGitClone(url: string): Promise<RepoSource> {
  if (!/^https:\/\//i.test(url.trim())) throw new Error(`derive only clones over https (got ${url.trim()}); an ssh or git URL would use your own keys`);
  await assertPublicHost(url.trim());   // same rule as every other egress
  const tmp = mkdtempSync(join(DATA_DIR, 'clone-'));
  ...
}
```

`collectRepo` is already `async`, so `return await fromGitClone(s)` is the only
call-site change. Add a case to `guards.test.ts` alongside the scheme cases:
`await assert.rejects(() => collectRepo('https://127.0.0.1/x.git'), /private or local address/)`,
and assert `cloneDirs()` is still empty so the guard is proven to run before
`mkdtempSync`.

## Warnings

### WR-01: Deleting a lesson or a learner leaves their `turns` and `usage` rows behind

**File:** `server/src/db.ts:386-397` and `server/src/db.ts:349-357`
**Issue:** Migrations 2 and 3 add the `turns` and `usage` tables, but
`deleteLesson` deletes from `materials`, `memory`, `misconceptions`,
`quiz_results`, `nodes`, `events` and `lessons` only — `grep -n "DELETE FROM"
server/src/db.ts` shows no statement for either new table. `deleteLesson`'s new
doc comment says "Removes a lesson and everything hanging off it" and
`deleteLearner`'s says "Removes the learner and everything they learned"; both
are now false. A deleted learner's per-request token counts, models and driver
names survive the deletion of the learner, which for a local-first product whose
promise is that the learner owns their record is a data-deletion defect, not
just untidiness. The tables also grow without bound.

**Fix:**

```ts
// with the other prepared statements
deleteTurnsByLesson: db.prepare('DELETE FROM turns WHERE lesson_id = ?'),
deleteUsageByLesson: db.prepare('DELETE FROM usage WHERE lesson_id = ?'),

// in deleteLesson, inside the same withTx
q.deleteUsageByLesson.run(id);   // usage first: it points at turns
q.deleteTurnsByLesson.run(id);
```

`deleteLearner` already loops `deleteLesson`, so it is covered once this lands;
add an assertion to `server/test/usage.test.ts` that both tables are empty for
a lesson after `DELETE /api/lessons/:id`.

---

### WR-02: The boot sweep closes turns without writing the usage row the ledger promises

**File:** `server/src/index.ts:68-70`, against `server/src/db.ts:614-624`
**Issue:** `closeUsage`'s contract is explicit: "Every turn gets a usage row,
whichever driver ran it... it is why turn counts reconcile across every view."
Both other closing paths honour it — `sinkFor`'s `endTurn`
(`server/src/driver.ts:110-117`) and the external `end` action
(`server/src/index.ts:900-907`). The restart sweep does not: `closeOpenTurns`
(`db.ts:501-507`) only runs the UPDATE, and the boot loop in `index.ts` emits
`turn_end` without calling `closeUsage`. Every turn killed by a restart is
therefore a turn with no usage row, and totals stop reconciling exactly when a
crash makes them most interesting.

**Fix:**

```ts
for (const t of closeOpenTurns('interrupted')) {
  closeUsage(t.id);
  if (getLesson(t.lesson_id)?.mode === 'agent') emit(t.lesson_id, 'turn_end', { ok: true, interrupted: true, reason: 'server restarted' });
}
```

Better still, move the call inside `closeOpenTurns` so the invariant cannot be
missed by a future caller, and add the case to `server/test/usage.test.ts`.

---

### WR-03: The `sk-` backstop mangles ordinary words in error messages and logs

**File:** `server/src/secrets.ts:43`
**Issue:** `/sk-[A-Za-z0-9_-]{16,}/g` matches inside a longer word, and
`safeMessage` runs it over every API error body and every `[tag]` log line.
Confirmed:

```
'could not read /home/me/Desktop/risk-assessment-notes-2024.pdf'
  -> 'could not read /home/me/Desktop/ri[redacted].pdf'

'task-scheduler-configuration failed'
  -> 'ta[redacted] failed'
```

A learner whose file is named `risk-...` gets an unusable message from the
upload route, and the log line that would have named the problem is destroyed.
The module's own thesis — "Redaction that corrupts teaching has broken the
product in order to protect it" — applies to diagnostics too.

**Fix:** Anchor the pattern so it can only start a token:

```ts
{ re: /(^|[^A-Za-z0-9_-])(sk-[A-Za-z0-9_-]{16,})/g, to: `$1${REDACTED}` },
```

and do the same for `sk-ant-` and `AIza`. Add the two strings above to
`server/test/secrets.test.ts` as must-survive cases.

---

### WR-04: `fetchPublic` buffers an undeclared-length body without a cap

**File:** `server/src/library.ts:340-345`
**Issue:** The size check is `Number(res.headers.get('content-length') ?? 0) >
maxBytes`, then `Buffer.from(await res.arrayBuffer())`, then a second check on
`buf.byteLength`. A server that sends no `content-length` (chunked, which is
common) passes the first check with `0` and the whole body is materialised in
memory before the second one can fire — the after-the-fact check cannot
prevent the allocation it is checking. `server/src/repo.ts:220-238` added
`readCapped` in this very phase for exactly this reason, with a test
(`guards.test.ts:141-149`) that streams an undeclared body; `library.ts` does
not use it, so the fetch path the model can drive through `add_resource` is
the unprotected one.

**Fix:** Export `readCapped` from a shared place (or move it beside
`fetchPublic`) and use it:

```ts
if (!res.ok) throw new Error(`HTTP ${res.status}`);
const buf = Buffer.from(await readCapped(res, maxBytes));
return { type: (res.headers.get('content-type') ?? '').toLowerCase(), buf, url: res.url || current };
```

---

### WR-05: `assertPublicHost` is resolve-then-connect, so a rebinding name passes it

**File:** `server/src/library.ts:151-170`
**Issue:** The guard calls `lookup(host)` and judges the answers, then hands
the *name* to `fetch`, which resolves it again independently. A name whose
authoritative server returns a public address with TTL 0 on the first query and
`127.0.0.1` on the second passes the check and connects to loopback. The doc
comment claims "the destination that matters is the one the request actually
reaches", which is precisely what this construction cannot guarantee. The
redirect-per-hop work is real and valuable, but it does not close this.

**Fix:** Pin the address that was judged. Resolve once, pick an allowed
address, and connect to it with the original host in the `Host` header and SNI:

```ts
import { Agent } from 'undici';
const pinned = (ip: string) => new Agent({ connect: { lookup: (_h, _o, cb) => cb(null, ip, isIP(ip)) } });
// assertPublicHost returns the address it approved; fetchPublic passes
// { dispatcher: pinned(addr) } so the socket goes where the guard looked.
```

If pinning is judged too costly for this phase, change the comment to say what
the guard does and does not cover, and record the residual risk, rather than
leaving a claim the code cannot back.

---

### WR-06: A failing `ROLLBACK` replaces the real error and drops the recovery message

**File:** `server/src/db.ts:226-245` and `server/src/migrations.ts:366-379`
**Issue:** Both handlers do `db.exec('ROLLBACK')` as the first statement of the
catch. If SQLite has already aborted the transaction (which it does for some
errors), `ROLLBACK` throws "cannot rollback - no transaction is active"; that
throw escapes the catch block, so in `migrations.ts` the carefully worded
message — which names the version the file is still on and where the backup
copy is — is never constructed, and the learner sees an unrelated SQLite
string. The original error is lost in both files.

**Fix:**

```ts
} catch (e) {
  try { db.exec('ROLLBACK'); } catch { /* already rolled back */ }
  ...
}
```

---

### WR-07: `openBrowser` builds a shell string and runs it through `exec`

**File:** `server/src/mcp.ts:184-187`
**Issue:** `exec(\`xdg-open "${url}"\`)` passes the URL through `/bin/sh`. The
URL comes from `baseUrl(c.req.url)` on the server, which is derived from the
`Host` header of the MCP proxy's own request, itself derived from `DERIVE_URL`
— all learner-controlled environment. A `"` or `$(...)` in that value becomes
shell. There is no reason to involve a shell here at all.

**Fix:**

```ts
import { execFile } from 'node:child_process';
function openBrowser(url: string) {
  const [cmd, args] = process.platform === 'darwin' ? ['open', [url]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : ['xdg-open', [url]];
  execFile(cmd, args, () => undefined);
}
```

---

### WR-08: The mirror hook writes to a path built from an unvalidated `session_id`

**File:** `plugin/hooks/mirror.mjs:56` and `plugin/hooks/mirror.mjs:116`
**Issue:** `session_id` is read from the hook's stdin JSON and used unchecked as
a filename: `join(STATE_DIR, \`${sessionId}.json\`)`, then `writeFileSync`. A
value containing `../` escapes `~/.derive/mirror` and overwrites an arbitrary
file the user can write — including `~/.derive/token` or `~/.derive/derive.db`.
The payload is Claude Code's today, but this is a hook that runs on every
prompt with no validation on a value used as a path.

**Fix:**

```js
if (!/^[A-Za-z0-9._-]+$/.test(sessionId)) return;
```

next to the existing `if (!sessionId || !transcript ...) return;` guard at
line 50.

---

### WR-09: `isSecretName` is a narrow denylist doing work an allowlist should do

**File:** `server/src/repo.ts:58-62`
**Issue:** The list covers `.pem`, `.key`, `credentials`, `.netrc`, `.npmrc`,
`auth.json`, `id_*` and `.env*`. It misses `.git-credentials`, `.pgpass`,
`.htpasswd`, `*.p12`, `*.pfx`, `*.jks`, `*.keystore`, and — the common case in
a real repository — `secrets.yml` / `secrets.yaml` / `secrets.json`, which pass
`isTextName` and are imported whole into the lesson where the model reads them.
A denylist of names is the wrong shape for "things the tutor must not read".

**Fix:** Keep the denylist as defence in depth, but add the obvious names and a
content heuristic for the gap that matters:

```ts
const SECRET_NAMES = new Set(['credentials', '.netrc', '.npmrc', '.pgpass', '.htpasswd', '.git-credentials', 'auth.json', 'secrets.json', 'secrets.yml', 'secrets.yaml']);
const SECRET_EXTS = new Set(['.pem', '.key', '.p12', '.pfx', '.jks', '.keystore', '.ppk']);
export const isSecretName = (path: string) => {
  const name = basename(path);
  return SECRET_EXTS.has(extname(name).toLowerCase()) || SECRET_NAMES.has(name.toLowerCase()) || name.startsWith('id_') || name.startsWith('.env');
};
```

and extend the `knows a secret-shaped name` case in `guards.test.ts:166-173`.

---

### WR-10: The renderer hard-codes the tool count and fails with the wrong explanation

**File:** `scripts/render-method.mjs:177`
**Issue:** `if (names.length !== 22) fail(...'the registry projection is
incomplete...')`. Adding a legitimate fifteenth tutor tool — which is the
stated direction of the milestone — makes `pnpm method:check` fail in CI with a
message that blames the projection for being incomplete when it is in fact
correct and the constant is stale. A magic number that must be edited in a
second file whenever the registry changes is exactly the drift this module
exists to prevent.

**Fix:** Assert the relationship rather than the number:

```js
const names = (wire.mcp ?? []).map((t) => t.name);
if (!names.length) fail('server/test/wire-surface.json lists no mcp tools; the registry projection is empty and the allowed-tools lines would be blank');
```

`server/test/wire-surface.test.ts` already fails when the snapshot and the
registry disagree, which is the check that actually protects this.

---

### WR-11: `DELETE /api/lessons/:id` does not 404 and leaves a running turn row open

**File:** `server/src/index.ts:275-282`
**Issue:** Unlike every other `:id` route in the file, this one never looks the
lesson up: deleting an id that does not exist returns `{ok: true}` 200. It also
never closes the lesson's turn row — `interrupt()` only reaches an in-process
agent turn, so an external lesson deleted mid-turn leaves a `turns` row stuck
at `status='running'` until the next boot sweep finds it (and, per WR-01, the
row is never deleted at all).

**Fix:**

```ts
app.delete('/api/lessons/:id', async (c) => {
  const id = c.req.param('id');
  if (!getLesson(id)) return c.json({ error: 'not found' }, 404);
  await interrupt(id);
  const turn = lastTurn(id);
  if (turn?.status === 'running') { finishTurn(turn.id, 'interrupted'); closeUsage(turn.id); }
  cancelPending(id, { held: true });
  held.delete(id);
  recentCards.delete(id);        // see IN-01
  deleteLesson(id);
  return c.json({ ok: true });
});
```

---

### WR-12: `GET /api/preferences` asserts a learner row exists and 500s when it does not

**File:** `server/src/index.ts:588-591`
**Issue:** `const l = getLearner(learnerOf(c))!;` — `learnerOf` falls back to
`DEFAULT_LEARNER_ID` for an unknown learner, but nothing guarantees that row is
present (a database restored from an older snapshot, or a `derive.db` where the
default learner was renamed away). The non-null assertion turns that into a
`TypeError` on `l.name` and a bare 500, in a file whose every other lookup
returns a 404 with a sentence. `server/src/index.ts:585` has the same shape via
`getLearner(learnerOf(c))` but tolerates `undefined` because it only spreads it.

**Fix:**

```ts
app.get('/api/preferences', (c) => {
  const l = getLearner(learnerOf(c));
  if (!l) return c.json({ error: 'learner not found' }, 404);
  return c.json({ learner: l.name, preferences: l.prefs });
});
```

---

### WR-13: The `mirror` action reads four unvalidated fields straight into a persisted event

**File:** `server/src/index.ts:879-893`
**Issue:** `validateAction` is the phase's answer to "a malformed body is not a
method refusal" — but `mirror` has no tool behind it, so it takes the
`{ role, text, uid, at }` cast path with no schema at all. `at` in particular
is written unchecked into a persisted event payload that the browser sorts the
timeline by (`web/src/lib/useLesson.ts`), and `uid` becomes an event id. A
string, object or `NaN` in `at` silently reorders or corrupts a lesson's
record, which is the learner's durable artefact. `end` and `collect` are in the
same position, though they read nothing.

**Fix:** Give the route's own actions shapes in the same map, so validation is
uniform:

```ts
const ROUTE_SCHEMAS = new Map<string, z.ZodType>([
  ['mirror', z.object({ role: z.enum(['assistant', 'user']), text: z.string(), uid: z.string().optional(), at: z.number().int().positive().optional() })],
  ['collect', z.object({})],
  ['end', z.object({})],
]);
// in validateAction: const schema = ACTION_SCHEMAS.get(action) ?? ROUTE_SCHEMAS.get(action);
```

---

### WR-14: The one-turn-per-lesson guard is not atomic with the registration that enforces it

**File:** `server/src/agent.ts:267` and `server/src/agent.ts:293`
**Issue:** `runTurn` throws `lesson is busy` when `active.has(lessonId)`, but
the map is only written when the driver calls `ctx.onActive(...)` — which for
`claudeDriver` is after `query(...)` is constructed and for `codexDriver` is
after `codex.resumeThread(...)`. Everything between the check and the
registration is an `await`-free window in this function, but the two callers
(`POST /api/lessons` and `announceMaterials`) both fire `runTurn` as a
fire-and-forget `void`, and `startTurn` + `emit` run before the dispatch. Two
turns for one lesson would both open a turn row and both emit `turn_start`,
which the architecture notes list as a hard constraint ("One turn per lesson").

**Fix:** Claim the slot before dispatching, and let `onActive` upgrade the
placeholder:

```ts
if (active.has(lessonId)) throw new Error('lesson is busy');
active.set(lessonId, { interrupt: async () => undefined });   // claimed
...
onActive: (handle) => active.set(lessonId, handle),
```

The existing `finally { active.delete(lessonId); }` already releases it on
every path, including the throw from `startTurn`.

## Info

### IN-01: `recentCards` keeps six entries and is never pruned on delete

**File:** `server/src/index.ts:690` and `server/src/index.ts:719`
**Issue:** `[...(recentCards.get(lessonId) ?? []).slice(-5), card]` keeps five
old entries plus the new one, so the map holds six despite the comment saying
"the last few". Neither `recentCards` nor `held` is cleared in
`app.delete('/api/lessons/:id')` — `held.delete(id)` is there,
`recentCards.delete(id)` is not — so every deleted lesson leaves card text in
memory for the life of the process.
**Fix:** `slice(-4)` if five is intended, and add `recentCards.delete(id)`
alongside `held.delete(id)` (folded into the WR-11 fix above).

### IN-02: The install token travels in the SSE query string

**File:** `web/src/lib/useLesson.ts:255-257`, `server/src/index.ts:150`
**Issue:** `EventSource` cannot set headers, so the token rides in
`?token=`. Query strings reach access logs, `ps` output of any proxy in the
path, and `Referer` on some navigations. The comment acknowledges the
constraint but not the exposure.
**Fix:** The `HttpOnly` cookie proposed in CR-01 removes the need for this
entirely — `EventSource` sends cookies on same-origin requests — and the
query-string branch of the middleware can then be deleted.

### IN-03: A registered secret split across two stream deltas is visible live

**File:** `server/src/events.ts:47-50`
**Issue:** `emitEphemeral` redacts each delta in isolation. A registered value
straddling a delta boundary matches neither half, so it reaches the browser in
the live stream; only the checkpoint and the final `emitUpdate`, which carry
the accumulated text, are clean. The persisted record is correct, so this is a
momentary display leak, but the module's claim is "there is no window
downstream where an unredacted one exists".
**Fix:** Either redact the accumulated text and send a diff, or note the
boundary case in the comment so it is not mistaken for a guarantee.

### IN-04: `/api/health` answers without Host, Origin or token checks

**File:** `server/src/index.ts:142`, `server/src/index.ts:190`
**Issue:** The exemption is justified (the doctor and test harnesses poll it
first), but the response carries `version`, `backend` and `backend_source`,
which lets any page or process fingerprint the install and confirm Derive is
listening. The Host check could apply to it without breaking either caller.
**Fix:** Keep the token exemption, drop the Host exemption, and trim the body
to `{ok: true}` unless the caller already authenticated.

### IN-05: `check-method.mjs` round-trips through a temp file for no benefit

**File:** `scripts/check-method.mjs:40-48`
**Issue:** Each rendered string is written to a scratch file and read back
before being compared to the committed copy. The round-trip cannot change the
value, so the temp directory, the `mkdirSync`/`rmSync` and the `finally` exist
only to support a comparison `content !== committed` already makes. The header
also says the comparison is "on raw bytes", but both sides are decoded as UTF-8
strings.
**Fix:** Compare `content` to `readFileSync(join(root, path), 'utf8')` directly
and delete the temp-directory machinery; or, to honour the "raw bytes" claim,
read both sides as `Buffer` and use `Buffer.compare`.

### IN-06: `renderAllowedTools` rewrites the first matching line in the whole file

**File:** `scripts/render-method.mjs:236`
**Issue:** `lines.findIndex((l) => l.startsWith('allowed-tools:'))` is not
scoped to the frontmatter block, so prose or an example that begins a line with
`allowed-tools:` would be silently overwritten with the generated list.
**Fix:** Bound the search to the lines between the first two `---` delimiters.

### IN-07: The security suite's stated guarantee is not the one it tests

**File:** `server/test/security.test.ts:6-9`
**Issue:** The header says "no response anywhere carries the token back out",
and the `headerText` helper exists to prove it — but every case requests an
`/api/*` path. The route that does carry the token out (CR-01) is never
requested, so the suite reads as proof of a property the code does not have.
**Fix:** Add, alongside the existing cases:

```ts
it('does not put the token in the page it serves', async () => {
  const res = await req('/');
  assert.ok(!(await res.text()).includes(token), 'the app document carried the token');
});
```

This case fails against the current build, which is the point.

---

_Reviewed: 2026-09-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
