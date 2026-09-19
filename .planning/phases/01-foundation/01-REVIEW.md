---
phase: 01-foundation
reviewed: 2026-09-19T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - .env.example
  - README.md
  - scripts/doctor.mjs
  - server/src/db.ts
  - server/src/index.ts
  - server/src/mcp.ts
  - server/src/repo.ts
  - server/test/api.test.ts
  - server/test/guards.test.ts
  - server/test/security.test.ts
  - server/test/tx.test.ts
  - web/src/lib/api.ts
  - web/src/lib/useLesson.ts
findings:
  critical: 2
  warning: 9
  info: 6
  total: 17
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-09-19
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Incremental review of the three gap plans committed since `cc1f818` (01-13 repo confinement, 01-14 install-token on the document route, 01-15 usage row on the restart sweep). Scope was `git diff cc1f818..HEAD` on the thirteen listed files, read in full and traced into `library.ts`, `config.ts`, `secrets.ts`, `driver.ts`, `materials.ts` and `web/vite.config.ts` where the change set reaches them. `pnpm -r typecheck` passes.

Several of the claims the plans make hold up under attack and are worth recording as verified rather than re-litigated:

- The redirect normalisation in `index.ts:1113` does what its comment says. Checked against the WHATWG URL parser: `//evil.example/` collapses to `/`, a raw CR/LF in the path is stripped before it can split a header, a space is percent-encoded, and `%2e%2e` segments resolve to a path that is still on this server. No open redirect, no header splitting.
- The symlink confinement in `fromDirectory` is complete against *path*-level attacks: `lstatSync` rejects every leaf symlink on both the `walk` and the `git ls-files` path, and the `realpathSync` prefix comparison on `sep` catches an ordinary file under a symlinked intermediate directory. The prefix comparison cannot be defeated by a sibling name (`/repo-evil` vs `/repo`).
- `closeOpenTurns` is genuinely atomic and idempotent: `withTx` joins an outer transaction rather than nesting a second `BEGIN`, `closeUsage` short-circuits on an existing row, and the sweep cannot partially apply.
- The credential comparison (`sameValue`) is length-guarded before `timingSafeEqual`, and `offered()` correctly treats whitespace-only as absent.

What does not hold up is the confinement story around the *other* `git` invocation, and the new handoff's treatment of the install token outside the HTTP surface. Two blockers below, one of which I reproduced locally.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: `git ls-files` executes commands from the imported repo's own config (arbitrary code execution)

**File:** `server/src/repo.ts:112-120` (reached from `server/src/repo.ts:152`)
**Issue:** 01-13 hardened the `git clone` argv (`-c protocol.allow=never`, `-c http.followRedirects=false`, `GIT_TERMINAL_PROMPT=0`) but left `gitListFiles` running bare:

```ts
execFileSync('git', ['-C', dir, 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
```

`git ls-files --others` honours `core.fsmonitor` from the target repository's `.git/config`, which is a command git spawns. The whole point of 01-13 is that an imported repo is attacker-controlled data; executing a command it carries is strictly worse than reading a file outside its tree, and none of the `lstat`/`realpath` work downstream ever runs — the process is spawned first.

Reproduced on this machine, git 2.43.0:

```
git init -q . && echo hi > a.txt && git add a.txt
git config core.fsmonitor '/bin/sh -c "touch ./PWNED; exit 1"'
git -C . ls-files -z --cached --others --exclude-standard   # -> a.txt, and ./PWNED now exists
```

Reachable end to end with the install token: `POST /api/materials/repo {"source":"/path/to/repo"}` → `ingestRepo` (`materials.ts:182`) → `collectRepo` → `fromDirectory` → `gitListFiles`. Also reachable from the tutor model through the MCP `attach_material` tool with a folder path, which `guards.test.ts`'s own module doc puts inside the threat model ("The tutor model hands Derive … a repo URL through `attach_material`"). The realistic chain is mundane: the learner clones a hostile repo the ordinary way, then asks Derive to study it.

The clone path (`fromGitClone` → `fromDirectory(tmp)`) is not affected, because `git clone` writes `.git/config` itself; the exposure is the local-folder path.

**Fix:** pin the `ls-files` argv the same way the clone argv was pinned, and neutralise the config that can spawn a process:

```ts
const out = execFileSync(
  'git',
  ['-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null', '-C', dir, 'ls-files', '-z', '--cached', '--others', '--exclude-standard'],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 30_000, env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0' } },
);
```

Add a case to `guards.test.ts` beside the symlink ones: a scratch repo with `core.fsmonitor` set to a command that writes a sentinel file, imported with `fromDirectory`, and the sentinel asserted absent. That is the regression to catch, and it is as cheap to drive offline as the symlink cases already there.

### CR-02: the MCP browser handoff puts the install token on a process command line

**File:** `server/src/mcp.ts:191-206`, `server/src/mcp.ts:244`
**Issue:** `openBrowser(withToken(l.url))` builds `http://localhost:4310/lesson/<id>?token=<TOKEN>` and hands it to:

```ts
const cmd = process.platform === 'darwin' ? `open "${url}"` : process.platform === 'win32' ? `start "" "${url}"` : `xdg-open "${url}"`;
exec(cmd, () => undefined);
```

`exec` spawns `/bin/sh -c '<cmd>'`, so the install token lands in that process's `argv`. On Linux `/proc/<pid>/cmdline` is world-readable by default, so any other local account can read it with `ps` — and `xdg-open` execs the handler, which execs the browser, so the token stays in the browser process's `argv` for as long as that browser runs, not for the instant `xdg-open` lives.

That directly defeats the property the rest of the code treats as load-bearing: the token file is written `0o600` (`index.ts:86`), `doctor.mjs:82` **fails** the check if the mode is anything else, and its own comment says "anyone who can read it can drive your lessons and read anything Derive can read". `registerSecret(TOKEN)` and `safeMessage` scrub the token out of every error body and log line; this path routes around all of it.

`withToken`'s doc comment justifies the location ("this process already read the 0600 file") but only reasons about the *server* not handing the token back out. It does not reason about the command line it is about to be written to.

**Fix:** keep the token off every argv. The handoff already only needs to be good for one request, so mint a single-use, short-TTL ticket instead of sending the long-lived credential:

```ts
// server: POST /api/handoff (token-authenticated) -> { ticket }  — random, single-use, ~60s TTL,
// accepted by the document middleware exactly once in place of ?token=.
const { ticket } = await api<{ ticket: string }>('/api/handoff', {});
if (open_browser !== false && DRIVER !== 'app') openBrowser(withTicket(l.url, ticket));
```

At minimum, switch `openBrowser` to `execFile('xdg-open', [url])` so no shell is involved — but note that alone does **not** fix this finding, because the URL is still an argv element on both `xdg-open` and the browser it launches. Only removing the long-lived token from the URL does.

## Warnings

### WR-01: the install token is printed to stdout on every start, by the same argument used to remove it from the stream URL

**File:** `server/src/index.ts:1126`
**Issue:** The `/api/*` middleware comment (`index.ts:230-234`) removes the `?token=` credential from the lesson stream because "a credential in a URL comes to rest in server logs, browser history and Referer". Thirty lines later the same credential is written to stdout as a URL:

```ts
console.log(`derive server on http://localhost:${info.port}/?token=${TOKEN} — open that link once per browser; …`);
```

Nothing patches `console`, and `redact`/`safeMessage` are never applied to it (confirmed: no `console.log =` anywhere in `server/src`). Under `pnpm start` in a terminal that is the intended UX; under systemd/journald, pm2, or `nohup … > out.log` it is a durable copy of the token in a file that is not `0600`. The browser half is real too: Chrome records an omnibox-typed URL in its URL database whether or not the navigation 302s, and syncs it when sync is on — for a value the project says never leaves the machine. (The Referer half is fine: the 302 fires before `index.html` requests the Google Fonts subresources, so the query never reaches `fonts.googleapis.com`.)

**Fix:** print the path, not the value — `open http://localhost:4310/ and paste the token from ~/.derive/token when asked`, or the one-time ticket from CR-02's fix, which is safe to print because it expires. If the link is kept, say so explicitly in the comment on `TOKEN` and in the security notes, so the contradiction with the stream-URL reasoning is a recorded decision rather than an oversight.

### WR-02: MCP `start_lesson` returns a `url` that now 401s, with no recoverable next step

**File:** `server/src/mcp.ts:253`, `server/src/index.ts:721`, `server/src/index.ts:741`, `server/src/index.ts:765`
**Issue:** 01-14 deleted the loopback early return, so `GET /lesson/<id>` with no cookie is a 401 everywhere. `withToken` was added to the *browser-open* call only; the `url` field returned to the model is still `l.url`, tokenless, and so are the `url` fields on `POST /api/external/lessons` and `GET /api/external/active`. Three ordinary paths therefore hand the learner a dead link:

- `open_browser: false` (a documented tool argument) — nothing is opened and the printed URL 401s.
- `DRIVER === 'app'` — the app's own Codex backend never opens a browser.
- The learner copies the URL the model printed into a second browser, or a different profile.

The 401 body says "open this page once as `/lesson/<id>?token=<the token in …/token>`", which is at least actionable, but it asks a learner mid-lesson to go read a `0600` file out of their data directory. This is a live regression of the "one screen, one next step" rule, not a theoretical one.

**Fix:** with CR-02's ticket in place, put the ticketed URL in the `url` field the model reports too (a one-use, 60-second ticket is safe to print; the long-lived token is not). Until then, at minimum extend the `how_cards_work` string so the model tells the learner what to do when the page says 401.

### WR-03: "once per browser" is wrong — the cookie dies with the browser session, and the link is only printed at server start

**File:** `server/src/index.ts:1074-1077`, `README.md:54`, `README.md:63`, `.env.example:34-36`, `scripts/doctor.mjs:115`
**Issue:** `issueSession` sets no `Max-Age` and no `Expires`:

```ts
setCookie(c, SESSION_COOKIE, SESSION, { httpOnly: true, sameSite: 'Strict', path: '/' });
```

which is a session cookie: it is discarded when the browser closes. The code comment states this deliberately ("no expiry, so it dies with the tab's session"), but four learner-facing strings then claim the handoff is needed *once per browser* — README, `.env.example`, the startup line and `doctor.mjs`. It is once per browser *session*. Because the handoff link is only printed when the server starts, a learner who closes their browser on a long-running server has no printed link to go back to and must `cat ~/.derive/token` by hand.

**Fix:** pick one and make the strings match it. Either give the cookie a `maxAge` (a month is defensible for a local-first app whose credential is already file-system-bound) and keep the "once per browser" wording, or keep it a session cookie and change all four strings to "once per browser session" plus tell the learner where to get the link again.

### WR-04: `hostNames` fails **open**, not closed, when the connection's local address is unavailable

**File:** `server/src/index.ts:150-164` (comment at 148-149)
**Issue:**

```ts
const addr = localAddress(c);
if (!addr) return new Set(LOOPBACK_NAMES);
```

The comment says "With no address to go on, fail closed to loopback." That is the permissive direction, not the restrictive one: the returned set admits `localhost`, `127.0.0.1`, `::1` and `[::1]`, which is precisely the forged-loopback `Host` the check exists to refuse on a widened bind. `localAddress` returns `undefined` whenever `c.env.incoming.socket.localAddress` is missing — a destroyed socket on an aborted request, or any adapter other than `@hono/node-server`. Failing closed would be an empty set (every `Host` refused with the 403 the function already builds).

Impact is bounded — the credential check still stands behind it — but this is the one check specifically advertised as surviving a rebind, and its stated polarity is the opposite of its behaviour.

**Fix:**

```ts
const addr = localAddress(c);
// No address to judge against is not a reason to admit the names this check exists to refuse.
if (!addr) return new Set<string>();
```

and correct the doc comment.

### WR-05: the clone guard still loses to DNS rebinding; `http.followRedirects=false` closes the redirect hop, not re-resolution

**File:** `server/src/repo.ts:288-293`
**Issue:** The new comment is precise about redirects and silent about the other TOCTOU. `assertPublicHost(url)` (`library.ts:152-173`) resolves the hostname and judges the addresses it got, then `execFileSync('git', … url …)` hands git the *name*, which git resolves again. An attacker-controlled domain answering a public address on the guard's lookup and `169.254.169.254` (or `10.0.0.5`) on git's lookup walks straight past the check. The same residual exists in `fetchPublic` (`library.ts:330-335`), which re-guards every hop but also re-resolves on every hop.

`guards.test.ts:150-154` asserts a *name* that resolves to loopback is refused, which is the static case; nothing covers a name whose answer changes between the two resolutions.

**Fix:** pin the address the guard approved and let git connect to that, rather than to the name:

```ts
const { hostname } = new URL(url.trim());
const [approved] = await resolvedPublicAddresses(url.trim()); // assertPublicHost, returning what it judged
// curl-style pinning: git passes this through to libcurl, so the connection goes to the address the guard approved.
execFileSync('git', ['-c', `http.curloptResolve=${hostname}:443:${approved}`, '-c', 'http.followRedirects=false', …]);
```

If pinning is judged out of scope for this milestone, record the residual in the comment beside the redirect reasoning so the next reader does not conclude the destination is confined.

### WR-06: `fromDirectory` re-opens by name after validating by name (TOCTOU)

**File:** `server/src/repo.ts:162-184`
**Issue:** The sequence is check-by-path, check-by-path, then use-by-path:

```ts
real = realpathSync(full);          // confinement check
if (real !== rootReal && !real.startsWith(rootReal + sep)) { … }
fst = lstatSync(full);              // symlink/regular-file check
if (!fst.isFile() || fst.size > READ_BYTES) { … }
const text = readText(readFileSync(full), path);   // follows symlinks
```

Anything that can replace `full` with a symlink between `lstatSync` and `readFileSync` defeats both checks, because `readFileSync` resolves the name afresh. The window is small and the attacker needs write access to the tree already, but the module's stated premise is that the tree is hostile, and the fix is not expensive.

**Fix:** resolve once and read through the handle:

```ts
import { constants, openSync, fstatSync, readFileSync as readFd, closeSync } from 'node:fs';
let fd;
try { fd = openSync(full, constants.O_RDONLY | constants.O_NOFOLLOW); } catch { skipped += 1; continue; }
try {
  const st = fstatSync(fd);
  if (!st.isFile() || st.size > READ_BYTES) { skipped += 1; continue; }
  const text = readText(readFd(fd), path);
  …
} finally { closeSync(fd); }
```

`O_NOFOLLOW` also makes the leaf-symlink refusal a property of the open rather than of a preceding stat, which removes the `lstatSync` check entirely rather than racing it.

### WR-07: `fromGitHub` interpolates a decoded `ref` into the api.github.com URL without re-encoding

**File:** `server/src/repo.ts:196`, `server/src/repo.ts:254-255`, `server/src/repo.ts:312`
**Issue:** `collectRepo` does `decodeURIComponent(gh[3])` and `fromGitHub` splices the result straight into the path:

```ts
const url = `https://api.github.com/repos/${owner}/${repo}/tarball${ref ? `/${ref}` : ''}`;
```

`GITHUB_RE`'s ref group is `([^/]+)`, so a literal `/` cannot appear — but `%2F` can, and `decodeURIComponent` turns it into one. `https://github.com/o/r/tree/..%2F..%2F..%2Fuser` becomes `https://api.github.com/repos/o/r/tarball/../../../user`, which `fetch` normalises to `https://api.github.com/user`. `owner` and `repo` are `([\w.-]+)`, which also admits `..`. Impact is limited (same host, no credentials attached, and the response then fails `gunzipSync`), but it is a caller-steered path injection in a URL the code treats as fixed, and the error the learner sees will be a gunzip failure rather than anything true.

**Fix:** encode each segment at the point of use, and refuse the dot segments outright:

```ts
const seg = (s: string) => { if (s === '.' || s === '..') throw new Error(`not a repository path: ${s}`); return encodeURIComponent(s); };
const url = `https://api.github.com/repos/${seg(owner)}/${seg(repo)}/tarball${ref ? `/${ref.split('/').map(seg).join('/')}` : ''}`;
```

### WR-08: `finishTurn` + `closeUsage` on the external `end` action are not one write

**File:** `server/src/index.ts:996-1003` (same shape at `server/src/driver.ts:111-115`)
**Issue:** 01-15's stated goal is that the sweep "cannot partially apply", and `closeOpenTurns` achieves it. The sibling call site does not:

```ts
const turn = lastTurn(id);
if (turn) {
  finishTurn(turn.id, turnStatusOf(payload));
  closeUsage(turn.id);
}
```

A crash between the two statements leaves a turn with `status = 'ok'` and no usage row — and that state is *unrecoverable*, because `closeOpenTurns` only selects `WHERE status = 'running'`. The invariant db.ts states in its own words ("Every turn gets a usage row, whichever driver ran it") is then permanently false for that turn, which is exactly the reconciliation failure 01-15 set out to prevent. `tx.test.ts`'s restart case only covers the sweep, so nothing catches this.

**Fix:** wrap both call sites the way `closeOpenTurns` wraps its own:

```ts
withTx(() => {
  finishTurn(turn.id, turnStatusOf(payload));
  closeUsage(turn.id);
});
```

Better still, fold the pair into one exported `endTurn(turnId, status)` in `db.ts` so there is one place that can be got wrong instead of three.

### WR-09: nothing exercises the lesson stream on the credential that replaced the one that was deleted

**File:** `server/test/security.test.ts:166-169`, `web/src/lib/useLesson.ts:255-256`
**Issue:** `useLesson.ts` dropped `?token=` from the `EventSource` URL and now relies entirely on the `derive_session` cookie riding along with a same-origin `EventSource`. `security.test.ts` proves the *removed* credential is refused:

```ts
assert.equal((await req(`/api/lessons/does-not-matter/stream?after=0&token=${token}`)).status, 401);
```

but no case proves the replacement works. The cookie is exercised only against `GET /api/lessons` (line 391). The lesson stream is the one long-lived request in the app; if `SameSite=Strict`, the `path`, or the middleware ordering ever stopped carrying the cookie onto it, the whole lesson UI would go dark and this suite would stay green. The behaviour is correct today — I traced it: a same-origin `EventSource` sends cookies regardless of `withCredentials`, and in dev the Vite proxy adds the header instead — but "correct and untested" is what the next change breaks.

**Fix:** add one case against a real lesson id:

```ts
it('drives the lesson stream on the cookie, which is the only credential a browser has for it', async () => {
  const lesson = await (await fetch(`${base}/api/lessons`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-derive-token': token }, body: JSON.stringify({ topic: 'x' }) })).json();
  const res = await req(`/api/lessons/${lesson.id}/stream?after=0`, { cookie: `${SESSION_COOKIE}=${await sessionValue()}`, accept: 'text/event-stream' });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') ?? '', /text\/event-stream/);
  await res.body?.cancel();
});
```

## Info

### IN-01: unreachable branches in the tar type check

**File:** `server/src/repo.ts:211`, `server/src/repo.ts:225`
**Issue:** `const type = String.fromCharCode(buf[off + 156] || 48);` already maps a NUL typeflag to `'0'`, so `type === '\0'` and `type === ''` at line 225 can never be true. Dead conditions that read as if they were handling a case.
**Fix:** `if (type === '0') yield { path: name, data };`, and let the `|| 48` carry the NUL convention with a one-line comment saying so.

### IN-02: dead entries in `TEXT_EXTS`

**File:** `server/src/repo.ts:42`
**Issue:** `'.txt'` appears twice in the set (also at line 39), and `'.env.example'` can never be produced by `extname()`, which only ever returns the last dot segment (`extname('.env.example') === '.example'`). `.env.example` is refused by `isSecretName` anyway, so the entry is doubly dead.
**Fix:** drop the duplicate `.txt` and `'.env.example'`.

### IN-03: `http.followRedirects=false` has no coverage for the legitimate-redirect case, and the failure message is raw git stderr

**File:** `server/src/repo.ts:293-297`
**Issue:** `false` is the right security answer (git's default `initial` is exactly the hop that would carry the fetch past `assertPublicHost`), but hosts that 301 repo URLs — vanity domains, `https://host/repo` → `https://host/repo.git`, self-hosted mirrors — now fail, and the learner gets `git clone failed for <url>: <last line of git stderr>`, which for a blocked redirect says nothing about redirects.
**Fix:** detect the shape in the catch and add a sentence: `… (derive does not follow redirects when cloning; use the URL the host redirects to)`. `guards.test.ts:156-163` already reads the flags off the source, so the flags themselves are covered.

### IN-04: `recordUsage`'s non-null assertion can hand back `undefined` typed as `UsageRow`

**File:** `server/src/db.ts:627`
**Issue:** `return listUsage({ turn: turn.id }).at(-1)!;` — if the insert did not land, `.at(-1)` is `undefined` and the `!` makes the type system claim otherwise. `closeUsage` ignores the return so the sweep is unaffected, but `driver.ts:107` (`usage: (row) => recordUsage(turnId, row)`) exposes it to callers.
**Fix:** `const row = listUsage({ turn: turn.id }).at(-1); if (!row) throw new Error('usage row not written'); return row;`

### IN-05: random test ports with no collision retry

**File:** `server/test/security.test.ts:93`, `server/test/security.test.ts:258`, `server/test/api.test.ts:53`
**Issue:** `4900 + Math.floor(Math.random() * 90)` and `5000 + Math.floor(Math.random() * 90)` pick a port with no retry. Node's test runner runs files concurrently by default; a port already in use makes the child exit, `startServer` burns its full 20-second deadline and throws `server did not start`, which reads as a product failure rather than a port clash.
**Fix:** let the OS pick — spawn with `PORT=0` and read the port off the child's first stdout line — or retry the spawn on a fresh port before giving up.

### IN-06: `PORT` is unvalidated, and `guardLocal` now compares against the string `'NaN'`

**File:** `server/src/config.ts:8`, `server/src/index.ts:206`
**Issue:** `export const PORT = Number(process.env.PORT ?? 4310);` accepts anything. With `PORT=abc`, `String(PORT)` is `'NaN'`, so `(port || '80') !== String(PORT)` is true for every request and the server 403s everything while `serve()` still binds somewhere. Pre-existing, but the port comparison in `guardLocal` is what makes the failure silent and total rather than a bind error.
**Fix:** `const p = Number(process.env.PORT ?? 4310); if (!Number.isInteger(p) || p < 0 || p > 65535) throw new Error(\`PORT must be a port number (got ${process.env.PORT})\`);`

---

_Reviewed: 2026-09-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
