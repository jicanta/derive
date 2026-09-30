/**
 * The learner's provider keys, in one file the API can only ever describe.
 *
 * `~/.derive/secrets.json` holds `{ [providerId]: key }`, mode 0600, beside
 * the install token and never inside `derive.db`, which is 0644 and copied
 * into backups. Plaintext under 0600 is the deliberate posture, the same one
 * `credentials.ts` records for the token: an account that can read the file
 * is the learner's own uid or root, and that account already reads the
 * database and every lesson in it. Encrypting at rest would need a key that
 * lives on the same disk under the same uid, which is a longer road to the
 * same place.
 *
 * The file is read live behind a one-second cache, for the reason the token
 * is: a learner who edits or removes the file should see the change without
 * restarting a server that may be in the middle of their lesson, and the
 * event loop is synchronous, so a file read per request would be a stall
 * the whole process shares. An absent file is silent — it is the fresh
 * install, and no keys is a fact, not a fault. A file that exists but cannot
 * be read as a JSON object is loud: `load` reports no keys and a sentence
 * naming the path and the reason, the settings view carries it, and nothing
 * here writes while that error stands. Overwriting a file the learner may be
 * able to repair, in order to store one new key, would destroy every key
 * they had; refusing costs them one retry.
 *
 * A value is registered with the redaction chokepoint the moment it is
 * known — on every load and in `setKey` before the write — so from the
 * first request that could echo it, every event, export, error and log has
 * already had it taken out. Removing a key deletes it from the file and
 * nothing more: the running process keeps redacting it until restart, which
 * the learner is told in the same sentence.
 *
 * Writes go to a sibling temp file created 0600 and renamed over the target,
 * so an interruption leaves either the previous file or the complete new one.
 * Two writers race on the whole file and the last rename wins; each does a
 * full read-modify-write, so a race loses at most the other writer's one key.
 */
import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { SECRETS_PATH } from './config.js';
import { registerSecret } from './secrets.js';

/** How stale a read may be, in milliseconds. One second, said in seconds where a sentence promises it, as TOKEN_CACHE_MS is. */
export const KEY_CACHE_MS = 1_000;

/** The file's shape: one key per catalogue id. */
type Store = Record<string, string>;

/** What a read found: the keys, and the sentence explaining why there are none when the file could not be read. */
type Loaded = { store: Store; error: string | null };

/** The last read and when it happened. Deliberate module state: the cache the one-second window is about, and the one place key values live between requests. */
let cache: (Loaded & { at: number }) | null = null;

/** The sentence a write is refused with while the file cannot be read. */
const unreadable = () => `${SECRETS_PATH} could not be read; fix or move it before storing a key`;

/**
 * Read the file, or serve the last read while it is under `KEY_CACHE_MS` old.
 * An absent file is no keys and no error. A file that is not a JSON object
 * of strings is no keys and an error sentence; blank entries are dropped.
 * Every value read is registered before it is returned.
 */
function load(now = Date.now()): Loaded {
  if (cache && now >= cache.at && now - cache.at < KEY_CACHE_MS) return cache;
  const store: Store = {};
  let error: string | null = null;
  if (existsSync(SECRETS_PATH)) {
    try {
      const raw = JSON.parse(readFileSync(SECRETS_PATH, 'utf8')) as unknown;
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        for (const [k, v] of Object.entries(raw)) if (typeof v === 'string' && v.trim()) store[k] = v.trim();
      } else {
        error = `${SECRETS_PATH} is not a JSON object`;
      }
    } catch (e) {
      // A parse error's own message quotes the text it choked on, which in a truncated file is a slice of a key; the reason is named without it.
      error = `${SECRETS_PATH} could not be read: ${e instanceof SyntaxError ? 'it is not valid JSON' : e instanceof Error ? e.message : String(e)}`;
    }
  }
  for (const v of Object.values(store)) registerSecret(v);
  cache = { store, error, at: now };
  return cache;
}

/** A read that goes to the file whatever the cache holds, so a write modifies what is there now and not what was there a second ago. */
function fresh(): Loaded {
  cache = null;
  return load();
}

/** Serialise the store into a sibling temp file created 0600 and rename it over the target: atomic on one filesystem, and the mode rides along. The cache is dropped so the next read re-registers what was written. */
function persist(store: Store): void {
  const tmp = `${SECRETS_PATH}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });
  renameSync(tmp, SECRETS_PATH);
  cache = null;
}

/** The stored key for a provider, or undefined. The only reader of a value; everything a route answers goes through keyView. */
export const keyOf = (provider: string): string | undefined => load().store[provider];

/** What the page may show of a key: its last four characters when it is at least eight long, else nothing at all, since four of seven would be most of it. */
export const hintOf = (value: string): string => {
  const v = value.trim();
  return v.length >= 8 ? v.slice(-4) : '';
};

/** A key as the API describes it: whether one is stored, and the hint. Never the value. */
export const keyView = (provider: string): { set: boolean; hint: string | null } => {
  const v = keyOf(provider);
  return v ? { set: true, hint: hintOf(v) } : { set: false, hint: null };
};

/** Why the file yields no keys, or null when it reads fine or is absent. */
export const secretsFileError = (): string | null => load().error;

/** Store one provider's key. Trimmed; refused with the sentence the row shows when it is empty, absurdly long, has whitespace inside, or the file cannot be read. Registered before it is written, so no egress between the two can carry it. */
export function setKey(provider: string, value: string): void {
  const v = value.trim();
  if (!v) throw new Error('the key is empty');
  if (v.length > 4096) throw new Error('the key is longer than any provider issues');
  if (/\s/.test(v)) throw new Error('the key has spaces or line breaks in it');
  const { store, error } = fresh();
  if (error) throw new Error(unreadable());
  registerSecret(v);
  persist({ ...store, [provider]: v });
}

/** Forget one provider's key in the file. The last key gone removes the file itself; the running process keeps redacting the value until restart. A file that cannot be read is left exactly as it is. */
export function removeKey(provider: string): void {
  const { store, error } = fresh();
  if (error) throw new Error(unreadable());
  if (!(provider in store)) return;
  const { [provider]: _gone, ...rest } = store;
  if (Object.keys(rest).length) {
    persist(rest);
  } else {
    unlinkSync(SECRETS_PATH);
    cache = null;
  }
}

/** Forget the cached read, so the next call goes to the file. Tests only — nothing in the server calls it. */
export function resetKeyCache(): void {
  cache = null;
}
