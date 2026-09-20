---
phase: 01-foundation
reviewed: 2026-09-20T00:00:00Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - .env.example
  - README.md
  - scripts/doctor.mjs
  - server/src/config.ts
  - server/src/db.ts
  - server/src/driver.ts
  - server/src/index.ts
  - server/src/mcp.ts
  - server/src/migrations.ts
  - server/src/repo.ts
  - server/src/tickets.ts
  - server/test/api.test.ts
  - server/test/guards.test.ts
  - server/test/mcp.test.ts
  - server/test/migrations.test.ts
  - server/test/security.test.ts
  - server/test/spawn.ts
  - server/test/tx.test.ts
  - server/test/usage.test.ts
findings:
  critical: 1
  warning: 9
  info: 10
  total: 20
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-09-20
**Depth:** standard (incremental — `git diff 0f70ebb..HEAD`, plans 01-16 … 01-19)
**Files Reviewed:** 19
**Status:** issues_found

## Summary

Four gap-closure plans were reviewed against the diff rather than against their own
summaries. The core security claims mostly hold under adversarial reading:

- **Ticket lifecycle (01-19)** is sound where it counts. `/api/handoff` is registered
  at `index.ts:320`, behind `app.use('/api/*', cors)` (196) and the credential
  middleware (252), so it cannot be reached unauthenticated. Redemption at
  `index.ts:1165` sits behind `guardLocal` and behind both the cookie and the token
  branches, so it bypasses neither. `redeemTicket` deletes whichever way the check
  goes, the 302 drops the query, and `mintTicket` sweeps on every mint so the map's
  steady state is bounded by one minute of authenticated mints. I found no
  auth-bypass path: `grep` confirms no non-`/api` route is registered ahead of the
  document middleware.
- **Argv pinning (01-17)** holds for the reachable case. `core.fsmonitor` is the one
  knob `ls-files --others` genuinely spawns, and it is pinned on the argv where
  command-line `-c` outranks a repository's own `.git/config`. `include.path` /
  `includeIf` in a hostile config cannot re-set it, because file config never
  outranks `-c`.
- **Migration 4 (01-18)** is correct. `NOT EXISTS` prevents double-writes, `<>
  'running'` correctly cedes open turns to `closeOpenTurns`, `COALESCE(ended_at,
  started_at)` can never be null given `started_at NOT NULL`, and the migration runs
  at `db.ts` import time, strictly before `index.ts`'s boot sweep. No double-write
  and no mis-timed row.

What the diff *did* introduce is one shipped security control that does not work as
the product tells the learner it does (CR-01), a set of rationale comments that
assert protections which are not present (WR-03, WR-06), a liveness regression on
the new transaction boundary (WR-01), and several tests that pass without testing
what their names claim (WR-08, IN-01, IN-02, IN-08).

---

## Critical Issues

### CR-01: The advertised revocation mechanism does not work on a running server, and it is the stated justification for a 30-day persistent credential

**File:** `server/src/index.ts:83-117`, `server/src/index.ts:1105-1119`, `server/src/index.ts:1191`, `.env.example:36-38`, `README.md:63`, `scripts/doctor.mjs:118`

**Issue:**
01-19 widens the browser credential from a memory-only session cookie to a
persistent 30-day one (`maxAge: SESSION_MAX_AGE_S`, `index.ts:1118`). The comment
directly above it states what makes that defensible:

> "the value is HMAC-SHA256 of the install token, so deleting or rotating the token
> file invalidates every cookie ever issued, with no code change and no per-session
> bookkeeping."

The same promise is now shipped in three learner-facing places, as security advice:

- `.env.example:37-38` — "deleting the token file signs every browser out"
- `index.ts:1191` (the `DERIVE_HOST` widened-bind warning) — "deleting that file
  signs all of them out"
- `README.md:63` / `scripts/doctor.mjs:118` — the 30-day story built on it

It is not true of a running server. `TOKEN` is read exactly once, at module
evaluation (`index.ts:103`, via `ensureToken()`), `SESSION` is derived once from it
(`index.ts:107`), and both are then frozen in module state. `grep` confirms nothing
else ever re-reads `TOKEN_PATH` — it appears afterwards only inside error strings.
Deleting or rotating `~/.derive/token` therefore changes nothing until the process
restarts: every previously-issued `derive_session` cookie keeps working, and the old
`x-derive-token` header keeps working too.

The failure window is exactly the one that matters. A learner who believes a cookie
or the token has leaked — on a widened `DERIVE_HOST=0.0.0.0` bind over plain HTTP,
which this very warning line is about — follows the instruction the server printed,
deletes the file, and believes they have cut access off. They have not. Worse, the
delete also means `ensureToken()` will mint a *different* token on the next restart,
so the learner has no signal that the revocation they performed was a no-op; the app
simply keeps working for the attacker until an unrelated restart happens.

This is not a stale comment: it is a security control that the product instructs the
user to rely on, in four places, and it does not do what it says.

**Fix:** either make revocation real, or stop claiming it. Making it real is a few
lines — compare against the file rather than a boot-time snapshot:

```ts
/** The install token as it is on disk right now. Cached for one second so a credential check is not a stat+read per request, but short enough that deleting or rotating the file signs every browser out while the server is still up — which is what .env.example, the startup warning and the doctor all promise. */
let cached: { token: string; session: Buffer; tokenBuf: Buffer; at: number } | null = null;
function credentials() {
  const now = Date.now();
  if (cached && now - cached.at < 1_000) return cached;
  let token = '';
  try {
    token = readFileSync(TOKEN_PATH, 'utf8').trim();
  } catch {
    /* rotated out from under us; every credential is refused until it is back */
  }
  const session = createHmac('sha256', token).update('derive browser session v1').digest('hex');
  cached = { token, session: Buffer.from(session), tokenBuf: Buffer.from(token), at: now };
  return cached;
}
```

…and have the `/api/*` middleware and the document middleware compare against
`credentials()` rather than the module-level `TOKEN_BUF`/`SESSION_BUF`. Note that
`registerSecret` must then be called on each new value as it is loaded, or the
redaction chokepoint silently stops covering the live token.

If that is judged too much machinery, the minimum acceptable fix is to correct all
four learner-facing sentences to say what is actually required — "delete the token
file **and restart derive** to sign every browser out" — and to correct the
`issueSession` comment, so a future maintainer does not build on a property that
does not exist.

---

## Warnings

### WR-01: `endTurn`'s new transaction makes the `turn_end` event unreachable on failure, and the idempotency guard prevents any retry

**File:** `server/src/driver.ts:108-117`, `server/src/index.ts:1027-1035`

**Issue:** 01-18 folds `finishTurn` + `closeUsage` into one `withTx`. The atomicity
is right, but neither call site is exception-safe, and the sink sets its guard
*before* the write:

```ts
endTurn: (payload) => {
  if (ended) return;
  ended = true;                             // guard raised first
  endTurnRow(turnId, turnStatusOf(payload)); // can throw (SQLITE_BUSY, disk full)
  emit(lessonId, 'turn_end', payload);       // never reached if it does
},
```

`closeUsage` → `recordUsage` → `q.insertUsage.run(...)` is a real write and can fail.
Before the change, `finishTurn` had already committed, so the turn at least read as
finished. Now both halves roll back *and* `ended` is already `true`, so
`agent.ts:299-303`'s `catch`/`finally` pair calls `sink.endTurn` twice more and both
return immediately. Net result: the turn row stays `'running'`, `busy()`
(`index.ts:284-290`) reports the lesson busy for the rest of the process's life, and
no `turn_end` ever reaches the SSE stream, so the browser sits on an in-flight turn.
The boot sweep repairs the row, but only on the next restart.

The same shape is at `index.ts:1033`: `endTurn(turn.id, ...)` is unguarded, so a
throw propagates out of the external-action route as a 500 and `emit(id, 'turn_end',
payload)` on the next line never runs.

**Fix:** raise the guard only after the write lands, and never let a ledger failure
cost the learner the event:

```ts
endTurn: (payload) => {
  if (ended) return;
  try {
    endTurnRow(turnId, turnStatusOf(payload));
  } catch (e) {
    // The ledger row is the boot sweep's to repair; the learner's turn is not.
    console.error('[turn]', e);
  }
  ended = true;
  emit(lessonId, 'turn_end', payload);
},
```

and wrap the `index.ts:1033` call the same way so `emit` and the 200 still happen.

### WR-02: The browser credential is a constant that never rotates, so `Max-Age` bounds only the honest browser

**File:** `server/src/index.ts:106-113`, `server/src/index.ts:1105-1119`

**Issue:** `SESSION = HMAC-SHA256(TOKEN, 'derive browser session v1')` is one fixed
value for the whole install — it is not per-browser, carries no identity, no issue
time and no nonce, and is identical in every cookie ever handed out. The comment at
`index.ts:112` justifies the new lifetime as "short enough that a browser profile
nobody opens again does not carry a working credential indefinitely." That is only
true of the honest browser's copy. A `Max-Age` is a client-side hint; it places no
bound whatsoever on a value that has been captured. Anyone who reads one
`derive_session` cookie — over the plaintext LAN traffic that `DERIVE_HOST=0.0.0.0`
explicitly enables — holds a credential that is valid forever, subject only to
CR-01's non-functioning revocation.

Separately, moving from a memory-only cookie to `Max-Age=2592000` moves the value
from browser memory into the profile's on-disk cookie store, where it now survives
browser restarts and backups. That is a deliberate UX trade, but the comment
presents the change as a security bound when it is a convenience bound.

**Fix:** at minimum, correct the comment so it states the real property ("a `Max-Age`
bounds the honest browser's copy; the value itself is constant and is revoked only by
rotating the token file"). If a real bound is wanted, make the cookie carry its own
expiry and verify it server-side, e.g. `value = ts + '.' + HMAC(TOKEN, 'derive
browser session v1|' + ts)` with a server-side `ts + SESSION_MAX_AGE_S*1000 >
Date.now()` check — which also gives per-issue revocation for free.

### WR-03: `repo.ts`'s security rationale claims clone-argv pins that do not exist

**File:** `server/src/repo.ts:123` (comment), `server/src/repo.ts:303` (the clone argv it points at)

**Issue:** The `gitListFiles` comment explains why five knobs are *not* pinned on the
listing argv, and ends:

> "…and they are already pinned where they are reachable, on the clone argv below."

The clone argv below is:

```ts
['-c', 'http.followRedirects=false', '-c', 'protocol.allow=never', '-c', 'protocol.https.allow=always', 'clone', ...]
```

Of the five knobs the comment names — `core.sshCommand`, `credential.helper`,
`filter.*.clean`, `diff.external`, `uploadpack.packObjectsHook`, `protocol.*` — only
`protocol.*` is actually pinned. The other four are not pinned anywhere in this file.
Nor does the clone path set `GIT_CONFIG_NOSYSTEM=1`, which the listing path does.

I could not construct an exploit from this today (a hostile *remote* cannot write the
fresh clone's config, and credential helpers are host-scoped), so the practical risk
is low. The defect is that a load-bearing security comment in a file whose module
docstring is entirely about confinement asserts a mitigation that is absent. Per
`CLAUDE.md`, comments here exist "so a future change does not undo it by accident" —
this one guarantees the opposite: the next maintainer who makes one of those knobs
reachable will read that it is already handled.

**Fix:** either pin them, which costs nothing and makes the comment true —

```ts
execFileSync('git', ['-c', 'http.followRedirects=false', '-c', 'protocol.allow=never', '-c', 'protocol.https.allow=always', '-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null', '-c', 'core.pager=cat', '-c', 'credential.helper=', '-c', 'core.sshCommand=false', 'clone', '--depth', '1', '--quiet', url, tmp], { stdio: ['ignore', 'ignore', 'pipe'], timeout: 120_000, env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0', GIT_ASKPASS: '', SSH_ASKPASS: '' } });
```

— or rewrite the sentence to say they are unreachable on both paths and are pinned on
neither.

### WR-04: `pnpm check` still has no PORT validation, so the preflight either crashes or disagrees with the server it is checking

**File:** `scripts/doctor.mjs:14`, `scripts/doctor.mjs:97-103`

**Issue:** 01-16 added `readPort` to `config.ts` so the server refuses an unusable
`PORT` loudly at startup. `scripts/doctor.mjs` — the preflight whose entire job is to
name what is wrong before the first lesson — was not updated:

```js
const PORT = Number(process.env.PORT ?? 4310);
```

With `PORT=abc` this is `NaN`; with `PORT=70000` it is out of range. Either value
reaches `s.listen(PORT, ...)` at line 100, where Node throws `ERR_SOCKET_BAD_PORT`
synchronously inside the `new Promise` executor. The promise rejects, the top-level
`await` on line 97 throws, and the doctor dies on an unhandled rejection — no report,
no `✗ Server` line, no fix hint, just a Node stack trace. Meanwhile the server has a
clear sentence for exactly the same input. The one script that exists to translate
failures into English is the one that does not.

**Fix:** reuse the same rule and report it as a finding rather than a crash:

```js
const rawPort = process.env.PORT;
const PORT = Number((rawPort ?? '4310').trim());
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  fail('Port', `PORT=${rawPort} is not a port`, 'Set PORT in .env to a whole number between 1 and 65535, or leave it unset for 4310.');
}
```

and guard the `listen` probe on that so the report still prints.

### WR-05: `startDeriveServer` lets a caller's `env.PORT` silently desynchronise the child's port from the `base` the helper returns

**File:** `server/test/spawn.ts:68-73`

**Issue:** The env is built as `{ ...process.env, PORT: String(port), ..., ...env }` —
the caller's `env` is spread **last**, so a caller passing `PORT` overrides the
OS-confirmed port while `base` and the returned `port` (lines 69, 88) still hold the
helper's value. The child then binds a port nothing polls, `/api/health` never
answers on `base`, the deadline expires five times over, and the suite fails with
"the derive server did not start in 5 attempts" — the exact misdiagnosis IN-05 and
this helper exist to eliminate.

This is live today: `security.test.ts:110` forwards an arbitrary caller `env` into the
helper, and its own old `startServer` explicitly supported `env.PORT`
(`Number(env.PORT ?? ...)`). 01-16 removed the one call site that used it
(`security.test.ts:323`) but left the trap armed, with a docstring that invites it
("`env` is merged over the defaults, so a case can widen the bind or change the
backend without restating the rest").

**Fix:** make the invariant unbreakable rather than documented:

```ts
const { PORT: _ignored, ...rest } = env;
const child = spawn(process.execPath, [entry], {
  env: { ...process.env, DERIVE_DATA_DIR: dataDir, DERIVE_BACKEND: 'claude', ...rest, PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe'],
});
```

or throw on `'PORT' in env` with a sentence saying the helper owns the port.

### WR-06: On Windows the "shell-free" browser open spawns `cmd.exe`, which is a shell

**File:** `server/src/mcp.ts:219-221`

**Issue:** The comment asserts the property the change was made for:

> "An argument vector, not a command string: no /bin/sh is involved, so the URL is one
> argv element of the opener rather than a fragment of a shell command."

True on darwin and linux. On win32 the vector is `['cmd', ['/c', 'start', '', url]]`,
and `cmd.exe` re-parses its command line with its own rules — `&`, `|`, `^`, `<`,
`>`, `%VAR%` are metacharacters that CRT-style argv quoting does not neutralise. This
is the `BatBadBut`/CVE-2024-27980 class: `execFile` gives no protection when the
executable being spawned *is* the shell.

Today the URL is `http://<host>/lesson/<uuid>?ticket=<hex>` — `host` comes from
`baseUrl(c.req.url)` (`index.ts:1081-1084`), i.e. a Host header `guardLocal` already
validated, and the path components are a UUID and hex — so no metacharacter reaches
it and I cannot demonstrate injection. The defect is that the comment records a
guarantee the win32 branch does not provide, on a line whose only reason to exist is
that guarantee.

**Fix:** skip the shell on Windows too, using the ShellExecute-equivalent rather than
`cmd`:

```ts
const [cmd, args]: [string, string[]] =
  process.platform === 'darwin' ? ['open', [url]]
  : process.platform === 'win32' ? ['rundll32', ['url.dll,FileProtocolHandler', url]]
  : ['xdg-open', [url]];
```

If `cmd /c start` must stay, say so in the comment: "on win32 this is cmd.exe, which
re-parses its command line; the URL is safe only because its host is one guardLocal
already accepted and the rest is a UUID and hex."

### WR-07: `guards.test.ts` leaks a temp directory per case, including one full of executable hook scripts, with no cleanup

**File:** `server/test/guards.test.ts:94-104`, `:114-211`

**Issue:** `hostileRepo()` and `sentinelPath()` each `mkdtempSync` into `tmpdir()`,
and the new `describe('a repository that carries a command')` block calls them across
seven cases plus three more inline `mkdtempSync` calls (`derive-hooks-`,
`derive-empty-`, `derive-plain-`). Nothing removes any of them; the file's only
`after` (`:140`) closes an HTTP fixture. A full run leaves roughly a dozen scratch
directories behind, one of which (`derive-hooks-`) contains three `chmod 0755`
`/bin/sh` scripts.

The sibling suite gets this right — `security.test.ts:504` keeps a `scratch: string[]`
and removes every entry in its `after` (`:549`). The new code in `guards.test.ts` was
written against the same pattern and skipped it.

**Fix:** mirror `security.test.ts`:

```ts
const scratch: string[] = [];
const scratchDir = (prefix: string) => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  scratch.push(dir);
  return dir;
};
after(() => {
  for (const dir of scratch) rmSync(dir, { recursive: true, force: true });
});
```

and route `hostileRepo`, `sentinelPath` and the three inline calls through it. The
`derive-guards-` data dir set at `:37` should go in the same sweep.

### WR-08: Two of the three "hostile repository" cases pass without exercising the pin they are named for

**File:** `server/test/guards.test.ts:129-154`

**Issue:** The `core.fsmonitor` case (`:117`) is real — `ls-files --others` genuinely
spawns that command, and removing `-c core.fsmonitor=false` from `repo.ts:124` would
turn it red. The other two do not have that property:

- `core.hooksPath` (`:129`): `git ls-files` runs no hooks at all. None of
  `pre-commit`, `post-index-change` or `fsmonitor-watchman` is invoked by a
  `ls-files -z --cached --others --exclude-standard` — `fsmonitor-watchman` is only
  reached through `core.fsmonitor`, which the preceding case already pins. Delete
  `-c core.hooksPath=/dev/null` from the argv and this case still passes.
- `core.pager` (`:145`): git pages only when stdout is a TTY. `execFileSync` gives it
  a pipe, so the pager is never consulted. Delete `-c core.pager=cat` and this case
  still passes.

Both assert `existsSync(sentinel) === false` against a command that was never going to
run, so they read as coverage for pins that have no regression test. The only thing
actually holding those two pins in place is the source-text assertion at `:156-165`,
which is brittle (see IN-01).

**Fix:** state the real claim in the case name and comment — these are
defence-in-depth pins for knobs `ls-files` does not reach, asserted by the argv case
below rather than driven — or make them drive something, e.g. run the pager case with
`stdio: 'inherit'` on a pty so the pager is genuinely consulted. Leaving them named
"does not run the command its config names in core.pager" implies a reproduction that
does not exist.

### WR-09: `config.ts`'s import-time PORT throw also kills the stdio MCP server, which never uses PORT

**File:** `server/src/config.ts:9-16`, `server/src/mcp.ts:40`

**Issue:** `readPort` runs in `config.ts`'s module body, and `mcp.ts:40` imports
`{ TOKEN_PATH, VERSION }` from it. The MCP server addresses Derive through
`DERIVE_URL` (`mcp.ts:43`) and has no use for `PORT` at all — but a learner with
`PORT=abc` exported in their shell now gets the stdio MCP server dying at startup with
`the PORT setting must be a whole number…`, surfaced inside Claude Code or Codex as an
MCP server that failed to start for a reason that has nothing to do with it. Side
effects on import are deliberate in this codebase, but a *throwing* one in a shared
config module reaches every process that imports it.

**Fix:** keep validation eager for the server and lazy for everyone else — either
export a `assertPort()` that `index.ts` calls before `serve()`, or make `PORT` a
getter so the throw happens at first use:

```ts
let port: number | undefined;
/** The port this server answers on. Validated on first read rather than at import, so the stdio MCP server — which addresses Derive by DERIVE_URL and never reads this — is not killed by a PORT it does not use. */
export const portOf = () => (port ??= readPort(process.env.PORT));
```

---

## Info

### IN-01: Source-text assertions are brittle against hand formatting

**File:** `server/test/security.test.ts:566-572`, `server/test/security.test.ts:707-714`, `server/test/guards.test.ts:156-165`

**Issue:** Several cases assert on the *text* of a source file, including exact
whitespace (`/const addr = localAddress\(c\);\n {2}if \(!addr\) return new
Set<string>\(\);/`), an exact call spelling (`/execFile\(cmd, args, \(\) =>
undefined\)/`), a numeric literal's underscore (`/timeout: 30_000/`), and the presence
or absence of a *comment* (`!source.includes('fail closed to loopback')`). `CLAUDE.md`
records that this repo has no formatter and formatting is by hand, so any reindent,
rename or comment edit fails these without a behaviour change.

**Fix:** where the property genuinely cannot be driven (the `hostNames` no-address
branch, a `/proc/<pid>/cmdline` read), keep the source assertion but loosen it to the
one token that is the regression — e.g. `assert.ok(!/if \(!addr\) return new
Set\(LOOPBACK_NAMES\)/.test(source))` — and drop the comment-text assertions entirely.

### IN-02: `\bexec\(` will false-positive on any future `RE.exec(` in `mcp.ts`

**File:** `server/test/security.test.ts:710`

**Issue:** `assert.ok(!/\bexec\(/.test(source), 'the MCP server still spawns a shell to
open the browser')` matches any `.exec(` call, not just `child_process.exec`.
`mcp.ts` happens to contain none today, but the sibling module `repo.ts` uses
`GITHUB_RE.exec(s)`; the first regex match added to `mcp.ts` fails this case with a
message accusing the author of spawning a shell.

**Fix:** anchor on the import instead: `assert.ok(!/^import \{[^}]*\bexec\b[^}]*\} from
'node:child_process'/m.test(source))`.

### IN-03: `server/test/` is outside `tsconfig.include`, so the new shared helper is never typechecked

**File:** `server/tsconfig.json:13`, `server/package.json` (`typecheck`, `test`)

**Issue:** `"include": ["src"]` and `typecheck` is `tsc -p tsconfig.json --noEmit`, so
nothing under `test/` is ever typechecked; `pnpm test` runs it through `tsx`, which is
transpile-only. That was tolerable for `*.test.ts`, but `spawn.ts` is now shared
production-ish infrastructure that four suites depend on, with an exported type and a
public signature, and no compiler ever looks at it.

**Fix:** add a `server/tsconfig.test.json` extending the base with `"include":
["src", "test"]` and `"noEmit": true`, and run it as a second step of `typecheck`.

### IN-04: `startDeriveServer`'s `opts` object is entirely unused, and one of its branches is dead

**File:** `server/test/spawn.ts:29-32`, `:58`, `:65`, `:96`

**Issue:** No caller passes `opts` (all four call sites pass at most `entry, env`), so
`dataDir`, `deadlineMs` and `attempts` are speculative API. In particular `const owned
= opts.dataDir === undefined` (`:65`) is always `true`, making the `if (owned)` guard
at `:96` dead. `SPAWN_ATTEMPTS` and `freePort` are exported but referenced only inside
this file. The loop counter `attempt` (`:64`) is never read.

**Fix:** drop `opts` and the `owned` branch until a caller needs them, un-export
`SPAWN_ATTEMPTS`/`freePort`, and write the loop as `for (let i = 0; i < attempts;
i++)`.

### IN-05: A `freePort()` rejection leaks the temp dir it was created after, and aborts the retry loop

**File:** `server/test/spawn.ts:66-68`

**Issue:** `mkdtempSync` runs at `:66`, `await freePort()` at `:68`. If the probe's
`listen` errors, the promise rejects, the rejection propagates straight out of
`startDeriveServer` — past the retry loop it was supposed to be retried by, and past
the `rmSync` at `:96` — leaving a `derive-server-` directory behind and reporting a
raw `EADDRINUSE`/`EACCES` rather than the helper's own sentence.

**Fix:** allocate the port first, or wrap the body in `try`/`catch` that cleans up and
continues to the next attempt.

### IN-06: `redeemTicket` compares by Map lookup where the rest of the credential path uses `timingSafeEqual`

**File:** `server/src/tickets.ts:55`

**Issue:** `tickets.get(value)` is a hash lookup with data-dependent timing, while
`index.ts:187-190` deliberately uses `timingSafeEqual` for the token and the session
value. With 256 bits of entropy and a 60-second life the practical risk is nil, and
the asymmetry is probably correct — but it is undocumented, so it reads as an
oversight rather than a decision.

**Fix:** one sentence on `redeemTicket` saying why the timing-safe comparison the rest
of the credential path uses is not needed here (32 random bytes, one use, one minute).

### IN-07: `readPort` silently accepts hex and exponent spellings

**File:** `server/src/config.ts:9-14`

**Issue:** `Number('0x10')` is `16` and `Number('1e3')` is `1000`, both integers in
range, so `PORT=0x10` starts the server on port 16. Nothing breaks — `String(PORT)` is
`'16'`, so `guardLocal`'s comparison stays consistent — but the error message promises
"a whole number between 1 and 65535" and these are not the spellings a learner meant.

**Fix:** `if (!/^\d+$/.test(raw.trim())) throw ...` before the `Number` conversion.

### IN-08: The migration-4 idempotency case does not reach `backfillUsage`

**File:** `server/test/migrations.test.ts:414-422`

**Issue:** `it('writes nothing the second time the runner runs')` calls `migrate(old)`
twice, but the second call returns at `runMigrations`'s `if (pending.length === 0)
return from` (`migrations.ts:396`) because `user_version` is already 4 —
`backfillUsage` is never entered. The case therefore asserts that the version guard
works, not that the `NOT EXISTS` clause does. (The `NOT EXISTS` clause *is* covered, by
'leaves a turn that already reported exactly the row it reported' at `:431`.)

**Fix:** call `backfillUsage` directly, or re-run with `MIGRATIONS.filter(m =>
m.version === 4)` against a database stood on version 3, so the statement itself runs
twice.

### IN-09: `finishTurn` now has no production caller

**File:** `server/src/db.ts:500-502`

**Issue:** `grep` across `server/src` finds `finishTurn` referenced only inside `db.ts`
(by `endTurn`) — both former call sites moved to `endTurn`. It survives as a
deliberately-retained export with a comment explaining why ("a caller that genuinely
wants only the status write should have to say so"), plus one test use at
`tx.test.ts:1006`. Noted so the structural pass does not read it as an oversight.

**Fix:** none required; the comment already carries the reason.

### IN-10: `canBuildRepo()` names a `/bin/sh` precondition it never checks

**File:** `server/test/guards.test.ts:45-54`

**Issue:** The docstring and the skip message say "a machine without git, **or one
where a /bin/sh command means nothing**", but the function only probes `git
--version` and `process.platform !== 'win32'`. On a POSIX machine without `/bin/sh`
the cases would run and pass vacuously (the command cannot run, so the sentinel is
absent either way) while claiming to have proven the pin.

**Fix:** `if (!existsSync('/bin/sh')) return false;`, or trim the message to what is
actually checked.

---

_Reviewed: 2026-09-20_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
