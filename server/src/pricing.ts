/**
 * What a model request costs, and how much room it has to think in.
 *
 * Every figure Derive shows a learner is computed from this table: the per-token
 * rates a request is priced at, the per-call charge a provider's own web search
 * adds, and the context window the pre-request headroom check measures against.
 *
 * The table is committed data rather than a runtime fetch, and that is the whole
 * design. A network call behind a cost figure is a new failure mode in a path
 * that must not have one — a lesson would stop being priceable because a pricing
 * endpoint was slow, and Derive would have to reach a third party to tell a
 * learner what their own lesson cost, which is exactly what local-first forbids.
 * A price change should be a reviewable diff with a date on it, not something
 * that happens to Derive overnight. `PRICES_AS_OF` is that date, and
 * `~/.derive/prices.json` (see prices.ts) is how a learner corrects a figure
 * between releases without waiting for one.
 *
 * A model absent from the table is priced as unknown, never as zero. A zero rate
 * would render as a free lesson on a metered key, which is the one lie this
 * module exists to prevent; `priceOf` and `windowOf` therefore return undefined
 * and the label vocabulary in cost.ts has a word for it.
 *
 * The native rows and the OpenRouter rows are separate keys on purpose. The same
 * underlying model is spelled `claude-opus-5-5` by Anthropic and
 * `anthropic/claude-opus-5.5` by OpenRouter, and a learner may run either; one
 * key could not serve both without a normalising guess, and a guess here reads
 * as money. `openai-compatible` and the three local servers carry no rows at
 * all, because the model behind a learner's own endpoint is not knowable from a
 * table.
 *
 * Pure data with no I/O and no import-time side effect, so anything may import
 * it, including a test with no database behind it.
 */

/**
 * The day the rates below were last checked against each vendor's own pricing
 * page. The figures were seeded from OpenRouter's `/api/v1/models` on 2026-10-01
 * and re-checked on this day against docs.claude.com, platform.openai.com and
 * ai.google.dev; every per-token rate and every search rate agreed.
 */
export const PRICES_AS_OF = '2026-10-06';

/**
 * One model's rates. The token fields are US dollars **per token** and the
 * names mirror the `usage` table's own columns, so a row and its price line up
 * field by field; `web_search` is the odd one out and is per call, not per
 * token.
 */
export type ModelPrice = {
  /** US dollars per uncached input token. Never priced against `usage.inputTokens`, which is a total that already includes the cache. */
  input: number;
  /** US dollars per output token, thinking tokens included wherever the vendor bills them as output. */
  output: number;
  /** US dollars per input token served from the prompt cache; null where the provider publishes no cache rate. */
  cache_read: number | null;
  /** US dollars per input token written into the prompt cache; null where the provider publishes no cache rate. */
  cache_write: number | null;
  /** US dollars per native web-search call — per call, not per token; null where the provider has no search of its own. */
  web_search: number | null;
  /** The model's context window in tokens, or null when it is not known; an unknown window abstains from the headroom check rather than guessing. */
  context: number | null;
};

/** Every rate Derive ships, keyed first by catalogue `ProviderId` and then by the model id that provider answers to. */
export type PriceTable = Readonly<Record<string, Readonly<Record<string, ModelPrice>>>>;

const OPUS_55: ModelPrice = { input: 0.000004, output: 0.00002, cache_read: 0.0000002, cache_write: 0.000005, web_search: 0.01, context: 1_000_000 };
const SONNET_55: ModelPrice = { input: 0.000002, output: 0.00001, cache_read: 0.0000002, cache_write: 0.0000025, web_search: 0.01, context: 1_000_000 };
const GPT_6_ASTRA: ModelPrice = { input: 0.00001, output: 0.00005, cache_read: 0.000001, cache_write: 0.0000125, web_search: 0.01, context: 1_050_000 };
const GPT_6_LUNA: ModelPrice = { input: 0.0000001, output: 0.0000005, cache_read: 0.00000001, cache_write: 0.000000125, web_search: 0.01, context: 1_050_000 };
// Google prices cache storage at $0.50 per million tokens per hour rather than per token written; the per-token figure is OpenRouter's amortisation of that rate, kept because `cache_write_tokens` is a count with no duration attached to it.
const GEMINI_38_FLASH: ModelPrice = { input: 0.00000075, output: 0.00000375, cache_read: 0.000000075, cache_write: 0.0000000416666666666667, web_search: 0.014, context: 1_048_576 };

/**
 * The shipped table.
 *
 * Checked on PRICES_AS_OF against each vendor's own page: Anthropic lists Opus
 * 5.5 at $4/$20 per MTok with $5 five-minute writes and $0.20 hits, Sonnet 5.5
 * at $2/$10 with $2.50 writes, and web search at $10 per 1,000 searches; OpenAI
 * lists gpt-6-astra at $10/$1/$12.50/$50 and gpt-6-luna at
 * $0.10/$0.01/$0.125/$0.50 per MTok with web search at $10 per 1k calls; Google
 * lists Gemini 3.8 Flash at $0.75/$3.75 per MTok with $0.075 caching and
 * grounding at $14 per 1,000 requests. Every figure agreed with OpenRouter's,
 * so no row carries a correction.
 *
 * Two honesty notes that belong with the numbers rather than in a changelog.
 * OpenAI's rates above are the short-context tier: both gpt-6 models cost double
 * above 272,000 prompt tokens, so a very long lesson is under-priced here — which
 * is part of why `cost_source: 'table'` reads `estimated` rather than `billed`.
 * Google's Gemini figures are its promotional rate through 2026-12-31 and double
 * on 2027-01-01, so this table needs a visit then.
 */
export const PRICES: PriceTable = {
  anthropic: {
    'claude-opus-5-5': OPUS_55,
    'claude-sonnet-5-5': SONNET_55,
  },
  openai: {
    'gpt-6-astra': GPT_6_ASTRA,
    'gpt-6-luna': GPT_6_LUNA,
  },
  gemini: {
    'gemini-3.8-flash': GEMINI_38_FLASH,
  },
  openrouter: {
    'anthropic/claude-opus-5.5': OPUS_55,
    'anthropic/claude-sonnet-5.5': SONNET_55,
    'openai/gpt-6-astra': GPT_6_ASTRA,
    'openai/gpt-6-luna': GPT_6_LUNA,
    'google/gemini-3.8-flash': GEMINI_38_FLASH,
  },
};

/**
 * The rate record for a model, or undefined when the table does not carry it.
 * Mirrors `providerOf`: an id the catalogue does not know reads as undefined
 * rather than as an empty row. Never a record of zeros — a zero rate renders as
 * a free lesson on a metered key.
 */
export function priceOf(provider: string, model: string | null): ModelPrice | undefined {
  if (!model) return undefined;
  return PRICES[provider]?.[model];
}

/** The model's context window in tokens, or undefined when the shipped table does not carry one. A caller holding a merged table reads `table[provider]?.[model]?.context` instead, so a learner's override is honoured. */
export function windowOf(provider: string, model: string | null): number | undefined {
  return priceOf(provider, model)?.context ?? undefined;
}
