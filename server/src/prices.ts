/**
 * The learner's own prices, laid over the shipped table.
 *
 * STUB — the loader arrives in the GREEN step of this task.
 */
import { PRICES, type PriceTable } from './pricing.js';

/** How stale a read may be, in milliseconds. */
export const PRICE_CACHE_MS = 1_000;

/** The shipped table with the learner's overrides laid over it. */
export function priceTable(): PriceTable {
  return PRICES;
}

/** Why the override file yielded nothing, or null when it reads fine or is absent. */
export function pricesFileError(): string | null {
  return null;
}

/** Forget the cached read. Tests only. */
export function resetPriceCache(): void {}
