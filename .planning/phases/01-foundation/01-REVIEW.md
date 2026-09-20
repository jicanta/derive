---
phase: 01-foundation
reviewed: 2026-09-20T17:52:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - .env.example
  - README.md
  - server/src/config.ts
  - server/src/credentials.ts
  - server/src/index.ts
  - server/src/repo.ts
  - server/test/credentials.test.ts
  - server/test/guards.test.ts
  - server/test/security.test.ts
findings:
  critical: 2
  warning: 5
  info: 11
  total: 18
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-09-20T17:52:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

The change extracts the install token out of `server/src/index.ts` into `server/src/credentials.ts` and turns every credential check into a live, one-second-cached read of `~/.derive/token`, so that deleting or rotating that file revokes every browser on a running server. The extraction itself is clean: the two comparison sites now go through one module, the boot-frozen `TOKEN_BUF`/`SESSION_BUF` pair is gone, `sameValue` correctly refuses an empty *live* value (the old one did not have to), and a source-reading case guards against the second source of truth coming back.

The defects are not in the extraction. They are in two places the new code inherited or newly asserted and did not drive:

1. **The document middleware's cookie short-circuit runs before both handoffs.** A browser that already holds a valid session cookie — the ordinary case, since the cookie lasts 30 days — is waved through `?token=` and `?ticket=` URLs with a 200 and no redirect. The one-time ticket is therefore *never spent* in the common path, which is half of the two mitigations `server/src/tickets.ts` and `server/src/mcp.ts` explicitly rely on; the install token stays in the address bar and in history, which is the exact exposure `index.ts:1116-1142` says the 302 exists to prevent; and the cookie is not re-issued, so four learner-facing sentences that promise "opening the same link again signs it in for another 30 [days]" are false. All three were reproduced against `server/dist/index.js`.

2. **The one-second window is not a bound.** `credentials()` gates its cache on `now - cache.at < TOKEN_CACHE_MS`, which is true for every negative delta. A backwards system-clock step keeps a *deleted* token authenticating for the whole length of the step — reproduced at one hour — while the module's own doc claims "the window is a bound and not an approximation" and three learner-facing sentences promise "within a second".

Both are the shipped security control failing in a way the new suite is green through, which is the failure mode this codebase's own test comments keep warning about.

The remaining findings are documentation drift the new prose-drift test does not cover (README.md is the one learner-facing file it was not pointed at, in the same change that edited it), a credential-file allowlist in `repo.ts` with demonstrable holes, and test-hygiene items.

## Critical Issues

### CR-01: A one-time handoff ticket is never spent when the browser already holds a session cookie

**File:** `server/src/index.ts:1149-1163`
**Issue:**
The document middleware returns on the cookie before it ever reaches `redeemTicket`:

```ts
const cookie = offered(getCookie(c, SESSION_COOKIE));
if (matchesSession(cookie)) return next();          // <- returns here
...
if (redeemTicket(c.req.query('ticket'))) { ... }    // <- never reached
```

`server/src/tickets.ts` states the threat model this ticket exists for: the MCP server puts the companion-page URL on a browser opener's argv, and `/proc/<pid>/cmdline` is world-readable on Linux, so "the URL carries one of these instead: a random value that is worth a single request and one minute". `server/src/mcp.ts:219` repeats it — "acceptable only because what it now carries expires in sixty seconds **and is spent on first use**". The single-use half does not hold whenever the learner's browser is already signed in, which is the ordinary case for a 30-day cookie.

Reproduced against `server/dist/index.js`:

```
ticket=a3527c9e7388...
--- browser already holding the cookie opens the ticket URL ---
status=200                       <- no 302, no redeem
--- is that ticket still redeemable afterwards? ---
HTTP/1.1 302 Found
set-cookie: derive_session=0b4748483b9f...   <- still live, still buys a full session
```

Any other local account that reads the opener's command line within the remaining TTL gets a session cookie and therefore the whole API: every lesson, the library, and `POST /api/materials/repo` against any readable folder. `server/test/security.test.ts:501` ("is refused the second time") asserts single-use only for a cookie-less `fetch`, so the suite is green through this.

**Fix:** redeem/strip before the cookie short-circuit, so presenting a handoff always consumes it and always ends in the query-dropping 302:

```ts
const ticket = c.req.query('ticket');
const presented = offered(c.req.header('x-derive-token')) || offered(c.req.query('token'));
const handoff = (ticket !== undefined && redeemTicket(ticket)) || matchesToken(presented);
if (handoff) {
  issueSession(c);
  return c.redirect(new URL(c.req.path, 'http://127.0.0.1').pathname, 302);
}
if (matchesSession(offered(getCookie(c, SESSION_COOKIE)))) return next();
return c.json({ error: ... }, 401);
```

Add a case to `server/test/security.test.ts`'s ticket group that mints a ticket, opens it **with a valid session cookie attached**, and asserts the response is a 302 and that the ticket is refused afterwards.

### CR-02: The credential cache serves a revoked token for the whole length of a backwards clock step

**File:** `server/src/credentials.ts:104-105`
**Issue:**

```ts
export function credentials(now = Date.now()): Credentials {
  if (cache && now - cache.at < TOKEN_CACHE_MS) return { token: cache.token, session: cache.session };
```

When `now < cache.at` the difference is negative and therefore always `< TOKEN_CACHE_MS`, so the cached value is served; and because a cache *hit* never advances `cache.at`, it keeps being served until wall-clock time passes `cache.at` again. A backwards step — NTP correction on a laptop, VM suspend/resume, a learner fixing a wrong clock — silently suspends the revocation this whole phase delivers.

Reproduced (`credentials.ts` driven directly, token file deleted after the first read, clock stepped back one hour):

```
after deletion, with a clock stepped back 1h, matchesToken(A) = true
window is 1000 ms
still stale 59 minutes later = true
```

This contradicts the module's own claim at `credentials.ts:98-103` ("at exactly one window the file is read again rather than the cached value served, so the window is a bound and not an approximation") and the three learner-facing sentences `server/test/security.test.ts:737-758` asserts, which promise "within a second". `server/test/credentials.test.ts` only ever moves its pinned clock forward, so nothing catches it.

**Fix:** treat any non-monotonic reading as stale, and prefer a monotonic source:

```ts
if (cache && now >= cache.at && now - cache.at < TOKEN_CACHE_MS) return { token: cache.token, session: cache.session };
```

Better still, gate on `performance.now()` (monotonic across clock steps) and keep the `now` parameter only for the pinned-clock tests. Either way add a case to `server/test/credentials.test.ts` that writes A, reads at `T0`, deletes the file, and asserts `matchesToken(A, T0 - 3_600_000) === false`.

## Warnings

### WR-01: The install token is not dropped from the URL when the browser already holds a cookie

**File:** `server/src/index.ts:1150`
**Issue:** Same root cause as CR-01 for the other credential. `index.ts:1116-1142` says a browser "presents the install token once, in the URL, and is answered with a 302 to the same path with the query string dropped, so the token does not come to rest in the history" — and `index.ts:213-218` gives the reason: "a credential in a URL comes to rest in server logs, browser history and Referer". With a live cookie, the short-circuit skips the 302 and the URL stands.

Reproduced:

```
--- 2nd open of the SAME ?token= link WITH the cookie ---
HTTP/1.1 200 OK        <- the ?token=… URL stays in the address bar and in history
```

`README.md:63` instructs the learner to do exactly this ("to sign in again, or in another browser, open the same link"), as does the startup line at `index.ts:1177`. Because default referrer policy is `strict-origin-when-cross-origin`, every same-origin subresource of that document also carries the full `?token=…` as `Referer`.

**Fix:** the CR-01 fix resolves this too — handle `?token=`/`?ticket=` before the cookie check so a presented credential always produces the stripping 302.

### WR-02: Re-opening the printed link does not extend the 30-day cookie, though four places say it does

**File:** `server/src/index.ts:1150`; `.env.example:37`; `README.md:54,63`; `scripts/doctor.mjs:118`
**Issue:** `issueSession()` is only called on the token and ticket branches. With a live cookie the middleware calls `next()` and sets no cookie, so `Max-Age` is not refreshed. Reproduced: `set-cookie` headers on a cookie-carrying re-open of the `?token=` link: **0**.

The learner is told the opposite in four places:
- `.env.example:37` — "opening the same link again signs it in for another 30"
- `scripts/doctor.mjs:118` — "opening the same link again signs it in for another 30"
- `README.md:63` — "to sign in again, or in another browser, open the same link"
- `index.ts:1177` — "To sign in again, or in another browser, open the same link"

A learner who does this every week is still signed out on day 31 from first sign-in.

**Fix:** with the CR-01 ordering in place a presented credential always reaches `issueSession`, which refreshes `Max-Age` and makes all four sentences true. Add a case asserting a second handoff returns a fresh `Max-Age=2592000` even when a valid cookie was attached.

### WR-03: README.md was edited by this change and is exempt from the prose-drift test the change added

**File:** `server/test/security.test.ts:747-751`
**Issue:** The new `describe('the revocation window and the sentences that promise it')` exists because "a security control and the sentence advertising it saying different things ... is what the fourth verification found, and a green suite is what let it ship". Its `places` list is `.env.example` and two slices of `server/src/index.ts`. `README.md:59` carries the same sentence ("deleting it signs every browser out within a second, without restarting derive"), was added in this very diff, and is the most learner-facing of the four — and it is not in the list. `scripts/doctor.mjs`, which also talks to the learner about the token file, is not either.

**Fix:**

```ts
const places: [string, string][] = [
  ['.env.example', readFileSync(new URL('../../.env.example', import.meta.url), 'utf8')],
  ['README.md', readFileSync(new URL('../../README.md', import.meta.url), 'utf8')],
  ["issueSession's doc in server/src/index.ts", issueDoc],
  ['the widened-bind warning in server/src/index.ts', widened],
];
```

(README.md as it stands passes; the point is that nothing stops the next edit from breaking it.)

### WR-04: One session value serves every browser and every device, with no per-browser revocation

**File:** `server/src/credentials.ts:52-53,113`; `server/src/index.ts:1107`
**Issue:** `SESSION_PURPOSE` is a fixed string, so `session = HMAC(token, "derive browser session v1")` is a single value handed to every browser that ever signs in — on this machine and, under `DERIVE_HOST=0.0.0.0`, on every device on the LAN. Consequences that are stated nowhere a learner reads:

- A leaked cookie from any one browser is full API access from anywhere that passes `guardLocal` — there is no binding to the browser, the device, or the sign-in.
- "Sign this one device out" is impossible; the only lever is rotating the token, which by `index.ts:1101-1104`'s own admission also signs out every other browser, the long-running stdio MCP server and the plugin hook until each restarts.

The 30-day lifetime is justified at `index.ts:1090-1096` purely by "what makes that lifetime defensible is revocation" — but the only revocation available is all-or-nothing.

**Fix:** either state the limitation in the learner-facing text alongside the revocation promise, or mint per-browser values — `session = HMAC(token, SESSION_PURPOSE + ':' + randomBytes(16).toString('hex'))` sent as `<salt>.<mac>`, verified by recomputing from the salt. That keeps "deleting the token file signs everyone out within a second" (every value still derives from the live token) while making a single leaked cookie revocable on its own.

### WR-05: `isSecretName` misses credential files a folder import will read and hand to the tutor

**File:** `server/src/repo.ts:68-72`
**Issue:** `fromDirectory` refuses only `/` and `$HOME`; any other readable directory is fair game, and the only content control is this name allowlist. It covers `.pem`, `.key`, `credentials`, `.netrc`, `.npmrc`, `auth.json`, `id_*` and `.env*`, and misses at least:

- `~/.docker/config.json` — `extname` is `.json`, which is in `TEXT_EXTS`, and the name matches nothing in `isSecretName`; holds registry auth.
- `~/.config/gh/hosts.yml` — `.yml` is in `TEXT_EXTS`; holds a GitHub OAuth token.
- `secrets.yaml`, `secrets.yml`, `credentials.json`, `service-account.json`, `*.tfvars`-adjacent `.tf`/`.hcl` files — all in `TEXT_EXTS`.

`SKIP_DIRS` does not contain `.config`, `.docker` or `.ssh`, so none of these directories is pruned either. `collectRepo` is reachable from `attach_material`, which the *tutor model* calls, and the tutor's context routinely contains attacker-influenced text (an imported README, a fetched library resource) — so a prompt-injection payload can name the path. The collected text lands in the materials table and comes back out of `GET /api/materials/:id?text=1`.

**Fix:** widen the refusal and add a directory prune, and drive both in `server/test/guards.test.ts`'s `knows a secret-shaped name` case:

```ts
const SECRET_DIRS = new Set(['.ssh', '.aws', '.gnupg', '.docker', '.kube', '.config/gh']);
export const isSecretName = (path: string) => {
  const name = basename(path);
  const ext = extname(name).toLowerCase();
  if (['.pem', '.key', '.p12', '.pfx', '.jks', '.keystore', '.ppk'].includes(ext)) return true;
  if (/^(credentials|auth\.json|hosts\.yml|hosts\.yaml|\.netrc|\.npmrc|\.pypirc|\.git-credentials|\.htpasswd|\.pgpass)$/.test(name)) return true;
  if (/^(secrets?|service[-_]?account)\./i.test(name)) return true;
  return name.startsWith('id_') || name.startsWith('.env');
};
```

and add `.ssh`, `.aws`, `.gnupg`, `.docker`, `.kube` to `SKIP_DIRS`.

## Info

### IN-01: The two boot-time `registerSecret` calls are redundant with the live read

**File:** `server/src/index.ts:94-95`
**Issue:** `registerSecret(sessionValue())` calls `credentials()`, which at `credentials.ts:116-118` already registers both the token and the session on a cold cache. Line 94's `registerSecret(BOOT_TOKEN)` is therefore also covered, and line 95's argument is registered twice. Harmless (the registry is a `Set`), but the comment presents them as the thing that makes the guarantee, when the guarantee now lives in `credentials()`.
**Fix:** keep one line with a comment saying it only forces the first read before any route exists — `credentials();` — or delete both and note that `ensureToken()` on line 85 is followed by a `credentials()` warm-up.

### IN-02: A CORS preflight is answered before `guardLocal` runs

**File:** `server/src/index.ts:168` vs `207-211`
**Issue:** `cors()` is registered ahead of the credential middleware and short-circuits `OPTIONS`, so `index.ts:207-211`'s claim that the guard runs on "every route ... health included" is not true for preflights. Reproduced: `OPTIONS /api/lessons` with `Host: evil.example` and `Origin: http://evil.example` returns `204` with the allow-methods and allow-headers lists, while the same request as `GET` returns `403`. No `access-control-allow-origin` is set, so a browser still blocks the real request — the leak is only the confirmation that the server exists plus its method/header lists to something that reached the port by a rebind.
**Fix:** register `cors()` after the guard, or run `guardLocal(c)` inside a small wrapper in front of it, and soften the "every route" sentence to name the preflight exception.

### IN-03: `registerSecret` is fed whatever bytes the token file held at read time

**File:** `server/src/credentials.ts:107-119`
**Issue:** `writeFileSync` (both `ensureToken`'s and a learner's rotation) truncates before it writes. A credential check that lands mid-write registers a partial value permanently — `clearSecrets` is tests-only — and it is then scanned against every event, export and vault mirror for the life of the process. The comment at line 115 says growth is "bounded, because a rotation is a rare deliberate act", which torn reads weaken.
**Fix:** require the shape before registering (`if (/^[0-9a-f]{64}$/.test(token))`), or document `~/.derive/token` rotation as write-temp-then-`rename` in the learner-facing text.

### IN-04: A non-numeric `?after=` silently drops the whole event backlog

**File:** `server/src/index.ts:392,396`
**Issue:** `Number(c.req.query('after') ?? 0)` yields `NaN` for junk, and `ev.seq > NaN` is false for every event, so the SSE stream replays nothing and the lesson renders as empty rather than erroring.
**Fix:** `const raw = Number(c.req.query('after') ?? 0); const after = Number.isFinite(raw) && raw >= 0 ? raw : 0;`

### IN-05: `recentCards` is not cleared when a lesson is deleted

**File:** `server/src/index.ts:380-387,795`
**Issue:** `DELETE /api/lessons/:id` clears `held` but not `recentCards`, so the map keeps up to five card strings per lesson for the life of the process, including lessons that no longer exist.
**Fix:** add `recentCards.delete(id);` next to `held.delete(id);` at line 384.

### IN-06: `security.test.ts` imports a `src` module without first scoping `DERIVE_DATA_DIR`

**File:** `server/test/security.test.ts:34`
**Issue:** `credentials.test.ts:27-29` and `guards.test.ts:36-37` both point `DERIVE_DATA_DIR` at a scratch directory before a dynamic import, with a comment explaining why. `security.test.ts` statically imports `../src/credentials.js` (and therefore `../src/config.js`) with no such guard, so in that process `TOKEN_PATH` and `DB_PATH` bind to the learner's real `~/.derive`. Nothing is read or written today — but the module is one import-time `readFileSync` away from touching a real install, and `config.ts:16` also runs `readPort(process.env.PORT)` at that import, so a developer with `PORT` set in their shell to a non-port sees the entire security suite fail to load rather than one targeted message.
**Fix:** set `process.env.DERIVE_DATA_DIR` to a scratch dir at the top of the file and switch to `await import(...)`, matching the two sibling suites, or import only the constant from a module with no config dependency.

### IN-07: The revocation cases are order-coupled through a shared mutated token file

**File:** `server/test/security.test.ts:653,675,702`
**Issue:** Case 2 starts by writing a token back because "the case above left the file absent"; case 3 asserts `live !== own.token`, which only holds because case 2 rotated. Run with `--test-name-pattern` or a `.only`, case 3 asserts on a token the process *did* read at boot and its comment ("this case is meant to run on a token the process did not read at boot") becomes false — or it fails for the wrong reason.
**Fix:** give case 3 its own rotation in a `before`, or rotate in a group-level `beforeEach` so each case is self-contained.

### IN-08: The window-prose test pins a literal rather than deriving it from the constant

**File:** `server/test/security.test.ts:740,754`
**Issue:** The coupling between `TOKEN_CACHE_MS` and the three sentences is `assert.equal(TOKEN_CACHE_MS, 1_000)` plus a hardcoded `/within a second/`. A future change that widens the window to 5 s and updates only the first assertion leaves the regex passing on three now-wrong sentences. The `TOKEN_CACHE_MS` doc at `credentials.ts:46-48` claims "a case asserts they agree", which is stronger than what the case does.
**Fix:** derive the phrase — `const said = TOKEN_CACHE_MS === 1_000 ? 'within a second' : \`within ${TOKEN_CACHE_MS / 1000} seconds\`;` — and match on that.

### IN-09: `ensureToken` never checks the mode of a token file that already exists

**File:** `server/src/credentials.ts:70-87`
**Issue:** The 0600 mode is only applied on creation. A file restored from a backup, copied between machines, or left behind by an older version at 0644 is used silently; only `pnpm check` (`scripts/doctor.mjs:80-82`) notices, and it is not on the start path. `credentials.ts:32-35` rests the whole "an account that can write the token can replace the credential" acceptance on the file being 0600.
**Fix:** `statSync(TOKEN_PATH)` after the read and either `chmodSync(TOKEN_PATH, 0o600)` or refuse loudly when `(mode & 0o077) !== 0` on non-Windows, naming `chmod 600` in the message.

### IN-10: `resetCredentialCache` is an exported production API labelled "Tests only"

**File:** `server/src/credentials.ts:152-155`
**Issue:** Nothing in `server/src` imports it (confirmed by grep); only `credentials.test.ts` does. An exported name that the comment says must not be used is a name that eventually gets used — and calling it from a route would make the revocation window unmeasurable.
**Fix:** acceptable as-is given the project's no-barrel, named-export convention, but mirror `secrets.ts`'s `clearSecrets` wording exactly and consider naming it `__resetCredentialCacheForTests`.

### IN-11: `sweepOrphanMaterials()` is a module-scope side effect in the middle of route registration

**File:** `server/src/index.ts:277`
**Issue:** It sits between `lessonView` and the first `app.get`, so boot-time work is split across the file (the `closeOpenTurns` sweep is at line 70, `ensureToken` at 85, this at 277). `CLAUDE.md` names deliberate import-time side effects as a real pattern here, but they should be findable in one place.
**Fix:** move it up next to the `closeOpenTurns` loop under the same "boot cleanup" comment.

---

_Reviewed: 2026-09-20T17:52:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
