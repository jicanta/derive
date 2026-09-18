/**
 * The one place a secret is taken out of anything Derive writes down.
 *
 * A registered secret is a live value this process is actually holding — the
 * install token today, the learner's provider keys from the settings work
 * onwards. Every such value is registered once, at the moment it is read or
 * created, and from then on every egress runs its text through `redact`:
 * the event stream and therefore the database and the SSE fan-out, the
 * Markdown export and therefore the Obsidian vault mirror, every error body
 * the API returns, and every `[tag]` line the server prints. Exact matching
 * is what makes that safe to apply everywhere — it can only ever remove a
 * value the process itself put in the registry, so it cannot touch anything
 * the learner or the tutor wrote.
 *
 * `redactErrors` adds a second layer on top: a pattern for the shapes an API
 * key comes in, for the secret nobody remembered to register. That layer is
 * deliberately confined to errors and logs and must never be applied to a
 * lesson event, an export or the vault mirror. Derive teaches anything,
 * including API security, so a lesson whose prose legitimately contains
 * `sk-ant-...` as an example has to reach the learner's durable record
 * byte-intact. Redaction that corrupts teaching has broken the product in
 * order to protect it.
 */

/** What a removed secret leaves behind. Readable on purpose: the learner should see that something was taken out, not wonder what the blank is. */
export const REDACTED = '[redacted]';

/**
 * How short a value may be and still be worth protecting. A blank or tiny
 * registered value would turn `redact` into a text shredder — register `a`
 * and every letter `a` of every lesson disappears — so anything under this
 * is refused rather than trusted. Every real secret (a 64-character hex
 * token, any provider key) is far longer than this.
 */
const MIN_SECRET_CHARS = 16;

/** The live secret values this process holds. Deliberate module state: written at boot and whenever a key is loaded, read on every egress, never enumerated to a caller. */
const secrets = new Set<string>();

/** The shapes an unregistered key tends to come in. Used by `redactErrors` only — never on lesson content. */
const KEY_PATTERNS: { re: RegExp; to: string }[] = [
  { re: /sk-ant-[A-Za-z0-9_-]{12,}/g, to: REDACTED },
  { re: /sk-[A-Za-z0-9_-]{16,}/g, to: REDACTED },
  { re: /AIza[A-Za-z0-9_-]{16,}/g, to: REDACTED },
  { re: /\b(Bearer)\s+[A-Za-z0-9._~+/=-]{12,}/gi, to: `$1 ${REDACTED}` },
];

/** Protect a value from here on. Empty, whitespace-only and too-short values are ignored, so a missing key cannot quietly turn redaction into a shredder. */
export function registerSecret(value: string | null | undefined): void {
  const v = typeof value === 'string' ? value.trim() : '';
  if (v.length < MIN_SECRET_CHARS) return;
  secrets.add(v);
}

/** How many secrets are registered. For tests and for a future doctor line; never the values themselves. */
export const secretCount = () => secrets.size;

/** Forget every registered secret. Tests only — nothing in the server unregisters a live value. */
export function clearSecrets(): void {
  secrets.clear();
}

/**
 * Remove every registered secret from a piece of text. Longest value first,
 * so when one registered secret contains another no fragment of the longer
 * one survives as the shorter one's leftovers. With nothing registered the
 * input comes back untouched, which matters because this runs on every
 * emitted event.
 */
export function redact(text: string): string {
  if (secrets.size === 0) return text;
  let out = text;
  for (const s of [...secrets].sort((a, b) => b.length - a.length)) out = out.split(s).join(REDACTED);
  return out;
}

/**
 * `redact` over every string inside a JSON-serialisable value, leaving
 * numbers, booleans, nulls and anything else exactly as they are. Event
 * payloads are objects, so this is the form the chokepoint in events.ts
 * needs.
 */
export function redactDeep<T>(value: T): T {
  if (secrets.size === 0) return value;
  return walk(value) as T;
}

function walk(value: unknown): unknown {
  if (typeof value === 'string') return redact(value);
  if (Array.isArray(value)) return value.map(walk);
  if (value && typeof value === 'object' && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = walk(v);
    return out;
  }
  return value;
}

/**
 * `redact` plus the key-shaped backstop. The only function in the codebase
 * that matches on shape rather than on a value it was given, and therefore
 * the only one allowed anywhere near a lesson — which it is not: errors and
 * logs, and nothing else.
 */
export function redactErrors(text: string): string {
  let out = redact(text);
  for (const { re, to } of KEY_PATTERNS) out = out.replace(re, to);
  return out;
}

/** The message of a caught value, with every secret and every key-shaped string taken out. The narrowing every catch in the server already does, plus the redaction. */
export const safeMessage = (e: unknown): string => redactErrors(e instanceof Error ? e.message : String(e));
