/**
 * What a model request costs, and how much room it has to think in.
 *
 * STUB — the table arrives in the GREEN step of this task.
 */

/** The day the rates below were last checked against each vendor's own pricing page. */
export const PRICES_AS_OF = '';

/** One model's rates. */
export type ModelPrice = {
  input: number;
  output: number;
  cache_read: number | null;
  cache_write: number | null;
  web_search: number | null;
  context: number | null;
};

/** Every rate Derive ships, keyed by catalogue provider id and then by model id. */
export type PriceTable = Readonly<Record<string, Readonly<Record<string, ModelPrice>>>>;

/** The shipped table. */
export const PRICES: PriceTable = {};

/** The rate record for a model, or undefined when the table does not carry it. */
export function priceOf(provider: string, model: string | null): ModelPrice | undefined {
  void provider;
  void model;
  return undefined;
}

/** The model's context window in tokens, or undefined when the table does not carry it. */
export function windowOf(provider: string, model: string | null): number | undefined {
  void provider;
  void model;
  return undefined;
}
