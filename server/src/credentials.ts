/**
 * The install token, and the browser credential derived from it.
 *
 * The token is created once, at start, and read live on every check. That
 * split is the whole module: deleting or rotating `~/.derive/token` is then a
 * revocation on the server that is already running, rather than a promise
 * that waits for a restart. It is stated as security advice in three
 * learner-facing places, and a learner follows it in the one moment that
 * matters — a widened bind, plaintext over a LAN, a credential they believe
 * has leaked. Telling them instead to restart a server that is in the middle
 * of their lesson, on the strength of a file they cannot read, is a worse
 * product than a cached read.
 *
 * The read is cached because a credential check runs on every request and
 * this server's event loop is synchronous: `node:sqlite` is `DatabaseSync`,
 * so a filesystem read per request is a stall the whole process shares. The
 * cache is short because revocation behind it is not instantaneous, and the
 * window is a promise the sentences have to be able to state — one second,
 * said in seconds, in every place that asserts the control.
 *
 * Nothing here creates a token except `ensureToken`, which runs once at
 * start. A read that created one would turn a learner's deletion into a
 * silently re-opened door under a value they were never shown, so the live
 * path refuses instead: an absent, empty or unreadable file means no
 * credential authenticates at all. A deletion stays a deletion.
 *
 * A note on who else is signed out. The long-running stdio MCP server and the
 * plugin hook each read the file once at their own start, so a rotation signs
 * them out too until each is restarted. That is a real cost of making this
 * work, and it is written down here rather than discovered.
 *
 * An account that can write `~/.derive/token` can therefore replace the
 * credential this process trusts, within a window. Accepted deliberately: the
 * file is 0600, so that is the learner's own uid or root, and such an account
 * already reads `~/.derive/derive.db` and every lesson in it.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { TOKEN_PATH } from './config.js';
import { registerSecret } from './secrets.js';

/**
 * How stale a credential check is allowed to be. Short enough that the
 * revocation the learner was promised happens while they are still looking at
 * the screen, long enough that a credential check is not a filesystem read per
 * request on a synchronous event loop. If this ever changes, the three
 * sentences that name the window change in the same commit — a case asserts
 * they agree.
 */
export const TOKEN_CACHE_MS = 1_000;

/** What the browser's credential is an HMAC of the token over. A fixed string, so one token derives exactly one session value. */
const SESSION_PURPOSE = 'derive browser session v1';

/**
 * The install token: read it, or make one the first time Derive runs.
 *
 * 32 bytes of randomness in a 0600 file next to the database, written with
 * "wx" so a second boot racing the first cannot clobber a token the app is
 * already holding. Nothing hands it out — everything on this machine except
 * the browser reads the file, and the browser is handed a separate derived
 * value instead — so a failure here has to be loud, or the learner is left
 * with an app that says 401 and no idea why.
 *
 * This is the only function in the codebase that creates a token, and it is
 * called exactly once, at start. The credential path below deliberately does
 * not call it: a read that created a token would answer a learner's deletion
 * by re-opening the door under a value they were never shown.
 */
export function ensureToken(): string {
  if (!existsSync(TOKEN_PATH)) {
    try {
      writeFileSync(TOKEN_PATH, randomBytes(32).toString('hex'), { mode: 0o600, flag: 'wx' });
    } catch (e) {
      // Losing the "wx" race to a concurrent boot is fine; that file is just as good.
      if (!existsSync(TOKEN_PATH)) throw new Error(`could not write the derive token at ${TOKEN_PATH}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  let token: string;
  try {
    token = readFileSync(TOKEN_PATH, 'utf8').trim();
  } catch (e) {
    throw new Error(`could not read the derive token at ${TOKEN_PATH}: ${e instanceof Error ? e.message : String(e)}. Delete that file and start derive again to make a new one.`);
  }
  if (!token) throw new Error(`the derive token at ${TOKEN_PATH} is empty. Delete that file and start derive again to make a new one.`);
  return token;
}

/** What the token file holds, and the browser credential derived from it. Both are the empty string when there is no usable token, which is refused rather than matched. */
export type Credentials = { token: string; session: string };

/** The last read and when it happened. Deliberate module state: this is the cache the window is about, and it is the one place a credential value lives between requests. */
let cache: (Credentials & { at: number }) | null = null;

/**
 * The token the file holds now, and the session value derived from it.
 *
 * Re-read whenever the cached entry is at least `TOKEN_CACHE_MS` old — at
 * exactly one window the file is read again rather than the cached value
 * served, so the window is a bound and not an approximation. A missing or
 * unreadable file yields the empty string, which every comparison below
 * refuses.
 */
export function credentials(now = Date.now()): Credentials {
  if (cache && now - cache.at < TOKEN_CACHE_MS) return { token: cache.token, session: cache.session };

  let token = '';
  try {
    token = readFileSync(TOKEN_PATH, 'utf8').trim();
  } catch {
    /* deleted, or unreadable: every credential is refused until it is back */
  }
  const session = token ? createHmac('sha256', token).update(SESSION_PURPOSE).digest('hex') : '';

  // Load-bearing rather than tidy. D-11's claim is that the registry holds the live values this process is actually holding, so a rotated-in token that never reached it would be a secret the redaction chokepoint had quietly stopped covering — the revocation clause fixed and the redaction clause broken in the same change. registerSecret ignores anything under its sixteen-character floor, so the empty string a deleted file yields can never be registered and turn redaction into a text shredder. The old token stays registered, which is wanted — it keeps being scrubbed out of anything already written — and is bounded, because a rotation is a rare deliberate act.
  if (token && (!cache || cache.token !== token)) {
    registerSecret(token);
    registerSecret(session);
  }

  cache = { token, session, at: now };
  return { token, session };
}

/**
 * Constant-time equality against a live value.
 *
 * An empty or whitespace-only supplied value is absent, never something to
 * compare. An empty *live* value is refused on its own line and on purpose:
 * that is the state a deleted token file leaves behind, and refusing has to be
 * a decision made here rather than a side effect of a truthiness guard
 * somewhere else — without it an absent file would match an absent credential,
 * and a deletion would open the door instead of closing it.
 */
function sameValue(supplied: string, live: string): boolean {
  const offered = (supplied ?? '').trim();
  if (!offered || !live) return false;
  const a = Buffer.from(offered);
  const b = Buffer.from(live);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Whether a supplied credential is the install token as the file holds it now. */
export const matchesToken = (supplied: string, now = Date.now()): boolean => sameValue(supplied, credentials(now).token);

/** Whether a supplied credential is the browser session value derived from the token as the file holds it now. */
export const matchesSession = (supplied: string, now = Date.now()): boolean => sameValue(supplied, credentials(now).session);

/** The value the session cookie carries. The mint and the check read one source, so a browser signing in a second after a rotation is handed a cookie the next request accepts rather than one it refuses. */
export const sessionValue = (now = Date.now()): string => credentials(now).session;

/** Forget the cached read, so the next call goes to the file. Tests only — nothing in the server calls it. */
export function resetCredentialCache(): void {
  cache = null;
}
