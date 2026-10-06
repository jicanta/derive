/**
 * The learner's own prices, laid over the shipped table.
 *
 * `~/.derive/prices.json` is the escape hatch COST-04 promises: a rate in
 * pricing.ts goes stale the day a vendor changes it, and a learner should not
 * have to wait for a Derive release — or watch Derive phone a pricing endpoint —
 * to see a correct figure. The file holds `{ [providerId]: { [modelId]: rates
 * } }` and nothing else; Derive never writes it, so there is no UI to keep in
 * step and no way for the app to overwrite a correction a learner made by hand.
 *
 * It is read live behind a one-second cache, for the reason keys.ts is: a
 * learner who edits the file should see the change without restarting a server
 * that may be in the middle of their lesson, and the event loop is synchronous,
 * so a file read per request would be a stall the whole process shares.
 *
 * An absent file is silent — it is the ordinary case, and no override is a fact
 * rather than a fault. A file that exists but cannot be read as a valid table is
 * loud and merges *nothing*: `priceTable()` returns the shipped table unchanged
 * while the error stands, exactly as keys.ts yields no keys while secrets.json
 * is unreadable. The reason is the one prohibition this whole slice is built
 * around — a half-applied or malformed override is how a paid lesson starts
 * reading as free, and refusing the whole file costs the learner one retry.
 *
 * The merge is per field within a model, not per model and not per provider.
 * Naming one provider must not delete the others, naming one model must not
 * delete its siblings, and naming one model's `input` rate must not silently
 * drop that model's context window — which the headroom check reads, and whose
 * absence would quietly switch the refusal off.
 */
import { existsSync, readFileSync } from 'node:fs';
import { PRICES_PATH } from './config.js';
import { PRICES, type ModelPrice, type PriceTable } from './pricing.js';
import { providerOf } from './providers.js';

/** How stale a read may be, in milliseconds. One second, the same window keys.ts and the token cache keep. */
export const PRICE_CACHE_MS = 1_000;

/** What a read found: the table to price with, and the sentence explaining why it is the shipped one. */
type Loaded = { table: PriceTable; error: string | null };

/** The last read and when it happened. Deliberate module state: the cache the one-second window is about. */
let cache: (Loaded & { at: number }) | null = null;

/** The four fields a learner may leave out or set to null; `input` and `output` are the two a brand-new model must carry. */
const NULLABLE = ['cache_read', 'cache_write', 'web_search', 'context'] as const;

/** A rate is usable only when it is a real, finite, non-negative number: NaN, Infinity, a string and a negative all fail the same way. */
const isRate = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

/** The sentence a bad field is reported with. Names the path, the provider, the model and the field — and nothing else, because the file holds no secret and there is nothing to echo. */
const badField = (provider: string, model: string, field: string): string => `${PRICES_PATH} gives ${provider} ${model} a ${field} that is not a number at or above zero`;

/**
 * Validate the parsed file and lay it over the shipped table.
 *
 * Returns the merged table, or a sentence and the shipped table untouched. The
 * validation is deliberately total: one bad field anywhere refuses the whole
 * file rather than merging the rest, because a learner cannot see which half of
 * their file Derive decided to keep.
 */
function merge(raw: unknown): Loaded {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { table: PRICES, error: `${PRICES_PATH} is not a JSON object` };
  const merged: Record<string, Record<string, ModelPrice>> = {};
  for (const [provider, models] of Object.entries(PRICES)) merged[provider] = { ...models };
  for (const [provider, models] of Object.entries(raw as Record<string, unknown>)) {
    if (!providerOf(provider)) return { table: PRICES, error: `${PRICES_PATH} names ${provider}, which is not one of Derive's providers` };
    if (!models || typeof models !== 'object' || Array.isArray(models)) return { table: PRICES, error: `${PRICES_PATH} gives ${provider} something that is not a JSON object of model ids` };
    for (const [model, entry] of Object.entries(models as Record<string, unknown>)) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return { table: PRICES, error: `${PRICES_PATH} gives ${provider} an entry for ${model} that is not a JSON object` };
      const given = entry as Record<string, unknown>;
      const base = PRICES[provider]?.[model];
      const price: Record<string, number | null> = base ? { ...base } : {};
      for (const field of ['input', 'output'] as const) {
        if (given[field] === undefined) {
          if (base) continue;
          return { table: PRICES, error: `${PRICES_PATH} gives ${provider} ${model} no ${field}, and the shipped table has no ${model} to take one from` };
        }
        if (!isRate(given[field])) return { table: PRICES, error: badField(provider, model, field) };
        price[field] = given[field];
      }
      for (const field of NULLABLE) {
        if (given[field] === undefined) {
          if (!base) price[field] = null;
          continue;
        }
        if (given[field] !== null && !isRate(given[field])) return { table: PRICES, error: badField(provider, model, field) };
        price[field] = given[field] as number | null;
      }
      merged[provider] = { ...merged[provider], [model]: price as unknown as ModelPrice };
    }
  }
  return { table: merged, error: null };
}

/**
 * Read the file, or serve the last read while it is under `PRICE_CACHE_MS` old.
 * An absent file is the shipped table and no error at all. A file that cannot be
 * parsed or validated is the shipped table and a sentence naming the path.
 */
function load(now = Date.now()): Loaded {
  if (cache && now >= cache.at && now - cache.at < PRICE_CACHE_MS) return cache;
  let loaded: Loaded = { table: PRICES, error: null };
  if (existsSync(PRICES_PATH)) {
    try {
      loaded = merge(JSON.parse(readFileSync(PRICES_PATH, 'utf8')) as unknown);
    } catch (e) {
      // A parse error's own message quotes the text it choked on; the reason is named without it, as keys.ts does.
      loaded = { table: PRICES, error: `${PRICES_PATH} could not be read: ${e instanceof SyntaxError ? 'it is not valid JSON' : e instanceof Error ? e.message : String(e)}` };
    }
  }
  cache = { ...loaded, at: now };
  return cache;
}

/** The rates to price with: the shipped table with the learner's corrections laid over it, or the shipped table alone while the file cannot be read. */
export const priceTable = (): PriceTable => load().table;

/** Why the override file yielded nothing, or null when it reads fine or is absent. */
export const pricesFileError = (): string | null => load().error;

/** Forget the cached read, so the next call goes to the file. Tests only — nothing in the server calls it. */
export function resetPriceCache(): void {
  cache = null;
}
