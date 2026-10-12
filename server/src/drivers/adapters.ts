/**
 * What each provider needs before Derive's own loop can talk to it.
 *
 * The loop in `api.ts` is one `streamText` call and the same fourteen tools
 * whichever provider runs it; the only things that genuinely differ per
 * provider are how its model object is built, which options its SDK takes, and
 * where it reports what a request cost. Those differences live here, in one
 * table keyed by `ProviderId`, for the reason `probe.ts` already switches on a
 * `ProviderSpec` rather than on a chain of branches: adding a provider should
 * be one row that a reader can check against the catalogue, not a sixth `if`
 * buried in the loop. The `switch` below is deliberately exhaustive with no
 * fallthrough clause, so a new catalogue row that nobody taught the loop about
 * fails to compile instead of failing a learner's lesson.
 *
 * A provider's limitation stays in its own row. Where one provider cannot do
 * something the other four can — Gemini has no parallel-tool flag, an
 * OpenAI-compatible endpoint may report no token counts at all — the row
 * carries the difference and the registry, the method text and the other rows
 * are untouched. That is the whole point of a table.
 *
 * This module performs no I/O at import time: the key and the base URL are
 * passed in by the driver, which reads them through `settings.ts`, and the
 * price table is read per request behind `prices.ts`'s own one-second cache. It
 * reads no environment of its own, because `config.ts` is the one module that
 * does.
 */
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { JSONValue, LanguageModel, LanguageModelUsage, ProviderMetadata, Tool } from 'ai';
import { costOf, type CostRow } from '../cost.js';
import type { CostSource } from '../db.js';
import { priceTable } from '../prices.js';
import { v1 } from '../probe.js';
import { labelOf, type ProviderId } from '../providers.js';

/**
 * Global `fetch` with redirects refused, as the key-bearing request to a
 * provider must make them.
 *
 * `@ai-sdk/provider-utils`'s `postToApi` calls `fetch` with no `redirect`
 * option, which means the default `follow`. The fetch spec strips
 * `Authorization` across an origin on a redirect but says nothing about a
 * custom key header — Anthropic's `x-api-key`, Google's `x-goog-api-key` — so
 * a redirected request can carry the learner's key to a host the catalogue
 * never named. On the OpenAI-compatible row the host is one the learner typed,
 * so refusing the hop also covers a same-origin redirect to a path that logs.
 * This is the same posture `probe.ts` `getJson` already takes for the model
 * list, in the one place every provider factory passes through.
 */
export const noRedirectFetch: typeof globalThis.fetch = async (input, init) => {
  const res = await fetch(input, { ...init, redirect: 'manual' });
  if (res.status >= 300 && res.status < 400) throw new Error('the provider answered with a redirect, which derive does not follow because it could carry your key');
  return res;
};

/**
 * What one model request cost and how firm that figure is.
 *
 * `searches` is the number of the provider's own web searches that request
 * made. The `usage` table has no column for it — it is a per-call charge, not a
 * token count — so it is folded into `cost_usd` here through the same `costOf`
 * the lesson header totals with, which is D-20's "lands in the ledger rather
 * than vanishing from the lesson's cost" with no migration and no second
 * meaning for `cost_source`.
 */
export type CostRead = { cost_usd: number | null; cost_source: CostSource; searches: number | null };

/** What one provider contributes to the loop: how to build its model, the options its SDK reads, its own search tool, and how to read what a request cost. */
export type Adapter = {
  /** The model object the loop streams from. `modelId` is the learner's override, or null for the catalogue default. */
  model(key: string | undefined, base: string | undefined, modelId: string | null): LanguageModel;
  /** Passed straight to `streamText` as `providerOptions`; this is where D-08's parallel-tool flag lives. */
  providerOptions?: Record<string, Record<string, JSONValue>>;
  /**
   * The provider's own server-side search tool, or null where it has none or
   * where this model must not be offered one.
   *
   * It takes the model id rather than being a constant because the Gemini row's
   * answer genuinely depends on it — see that row. Every row answers null in
   * this release; plan 03-06 is what fills them in, and the signature is
   * declared now so that plan does not have to widen the type to express the
   * decision it has to make.
   */
  search?: (modelId: string | null) => Tool | null;
  /**
   * What one request cost, read from this provider's own metadata and falling
   * back to the price table.
   *
   * `searches` is the loop's count of provider-executed search tool calls in
   * that step, used where the provider reports no count of its own — the count
   * is kept by the loop because it works identically on every provider, where
   * the metadata path does not.
   */
  cost(pm: ProviderMetadata | undefined, usage: LanguageModelUsage, model: string | null, searches: number | null): CostRead;
};

/** A number the provider actually reported, or null. Anything else — undefined, NaN — is a count nobody gave us, and stays blank. */
const reported = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * What this request's own counts come to in the price table, computed by the
 * one function the lesson header already totals with.
 *
 * `costOf` takes ledger rows, so the counts are shaped into the row this
 * request is about to become; the identity columns `recordUsage` fills in are
 * left blank because `costOf` reads only `driver`, `model`, the five counts and
 * `searches`. Pricing it by hand here instead would be a second copy of the
 * arithmetic, and a second copy is how a figure starts disagreeing with the
 * total printed beside it. A model the table does not carry comes back
 * `unknown` with no money rather than a zero, which is `cost.ts`'s rule and not
 * a decision this module gets to re-make.
 */
function tableCost(provider: ProviderId, usage: LanguageModelUsage, model: string | null, searches: number | null): CostRead {
  const row: CostRow = {
    id: 0,
    turn_id: '',
    lesson_id: '',
    learner_id: '',
    ts: 0,
    driver: provider,
    model,
    input_tokens: reported(usage.inputTokenDetails?.noCacheTokens),
    output_tokens: reported(usage.outputTokens),
    cache_read_tokens: reported(usage.inputTokenDetails?.cacheReadTokens),
    cache_write_tokens: reported(usage.inputTokenDetails?.cacheWriteTokens),
    reasoning_tokens: reported(usage.outputTokenDetails?.reasoningTokens),
    cost_source: 'table',
    cost_usd: null,
    searches,
  };
  const { usd, source } = costOf([row], priceTable());
  return { cost_usd: usd, cost_source: source, searches };
}

/**
 * The name of the provider-executed search tool whose `tool-call` parts the
 * loop counts as one native search each.
 *
 * The counting rule lives beside the adapters rather than inside the loop, so
 * a provider's facts stay in one file. Null where the provider has no search of
 * its own, or where D-20 puts it on the pluggable fallback path instead
 * (OpenRouter's is a plugin, and a learner's own endpoint has none).
 */
const SEARCH_TOOL: Record<ProviderId, string | null> = {
  'claude-code': null,
  codex: null,
  anthropic: 'web_search',
  openai: 'web_search',
  gemini: 'google_search',
  openrouter: null,
  'openai-compatible': null,
  ollama: null,
  lmstudio: null,
  llamacpp: null,
};

export const searchCountOf = (provider: ProviderId): string | null => SEARCH_TOOL[provider];

/**
 * The provider's own server-side search tool for this model, or null.
 *
 * The safe way to ask the question: a row with no search of its own is answered
 * from the table above without building an adapter at all, so a login row or a
 * local row — where `adapterFor` throws on purpose — can be asked as freely as
 * a teaching one. That matters because the settings view asks it about whatever
 * provider happens to be active, and the loop and the method text both ask it
 * about the turn's own.
 */
export function nativeSearch(provider: ProviderId, modelId: string | null): Tool | null {
  if (!SEARCH_TOOL[provider]) return null;
  return adapterFor(provider).search?.(modelId) ?? null;
}

/**
 * The adapter for one catalogue row.
 *
 * Only the rows whose driver exists today answer; every other case throws a
 * lowercase sentence naming the row, so `teaches` in `providers.ts` and this
 * table say the same thing at every point. `claude-code` and `codex` throw
 * permanently: their drivers are the Agent SDK and the Codex SDK, not this one.
 */
export function adapterFor(provider: ProviderId): Adapter {
  switch (provider) {
    case 'anthropic':
      return {
        model: (key, _base, modelId) => createAnthropic({ apiKey: key, fetch: noRedirectFetch })(modelId ?? 'claude-opus-5-5'),
        // D-08's belt: Anthropic is told not to open two tool calls at once.
        // The braces are the loop's own per-lesson serialisation in api.ts.
        providerOptions: { anthropic: { disableParallelToolUse: true } },
        search: () => null,
        cost: (pm, usage, model, searches) => {
          // Anthropic copies its raw usage object verbatim into
          // providerMetadata.anthropic.usage, so a native search count rides
          // there when the vendor sends one. Whether it populates the key on a
          // streaming request could not be exercised without a key, which is
          // why the loop's own count stands behind it: that path works the same
          // on all three native-search providers.
          const counted = reported((pm?.anthropic as { usage?: { server_tool_use?: { web_search_requests?: number } } } | undefined)?.usage?.server_tool_use?.web_search_requests);
          return tableCost('anthropic', usage, model, counted ?? searches);
        },
      };
    case 'openai':
      return {
        // openai(...) is the Responses API by default since AI SDK 5; that
        // default is kept rather than reaching for openai.chat(...).
        model: (key, _base, modelId) => createOpenAI({ apiKey: key, fetch: noRedirectFetch })(modelId ?? 'gpt-6-astra'),
        // parallelToolCalls is D-08's belt. store: false keeps a Derive lesson
        // from being retained on OpenAI's side, which is the local-first
        // constraint applied to the one provider that would otherwise keep it.
        //
        // Note what is deliberately NOT set here: the strict dialect. Strict
        // mode is opt-in per tool and off by default, and turning it on costs
        // the minItems/maxItems/minimum/maximum bounds that set_plan (3-12
        // nodes) and quiz (2-3 options) rely on and that wire-surface.test.ts
        // asserts the model is held to; the strict projection is still built and
        // CI-validated in plan 03-07, and Phase 4's conformance harness can
        // switch it on and measure what it costs.
        providerOptions: { openai: { parallelToolCalls: false, store: false } },
        search: () => null,
        cost: (_pm, usage, model, searches) => tableCost('openai', usage, model, searches),
      };
    case 'gemini':
      return {
        model: (key, _base, modelId) => createGoogleGenerativeAI({ apiKey: key, fetch: noRedirectFetch })(modelId ?? 'gemini-3.8-flash'),
        // No parallel-tool option: @ai-sdk/google has no such flag anywhere in
        // its types or its docs. That absence is why the loop's per-lesson
        // mutex is load-bearing here rather than belt-and-braces — on Gemini it
        // is the only thing keeping two cards off the learner's screen.
        search: () => {
          // Null, and plan 03-06 is what makes this a decision. @ai-sdk/google's
          // prepareTools returns `tools: googleTools` alone — discarding all 14
          // function declarations — unless the model is a Gemini 3 series model,
          // and the only signal is a pushed warning of type `unsupported` with
          // feature "combination of function and provider-defined tools". So the
          // answer must come from the model id, and the loop refuses the turn
          // when that warning appears, because a lesson taught with no tools is
          // not a Derive lesson.
          return null;
        },
        cost: (_pm, usage, model, searches) => tableCost('gemini', usage, model, searches),
      };
    case 'openrouter':
      return {
        // The option rides twice on purpose: the model-level setting is what the
        // provider reads into the request body, and providerOptions.openrouter
        // is spread into that body too, so a change to either path still carries
        // it. Without it providerMetadata.openrouter.usage.cost is simply absent.
        model: (key, _base, modelId) => createOpenRouter({ apiKey: key, fetch: noRedirectFetch }).chat(modelId ?? 'anthropic/claude-opus-5.5', { usage: { include: true } }),
        providerOptions: { openrouter: { parallelToolCalls: false, usage: { include: true } } },
        search: () => null,
        cost: (pm, usage, model) => {
          // Read defensively: the typed narrowing of providerMetadata exists
          // only on doGenerate's declared return type, and the streaming path
          // types it as Record<string, JSONObject>. A malformed figure therefore
          // falls through to the table and downgrades the label rather than
          // producing a wrong number.
          const billed = reported((pm?.openrouter as { usage?: { cost?: number } } | undefined)?.usage?.cost);
          if (billed !== null) return { cost_usd: billed, cost_source: 'provider', searches: null };
          // D-03 read literally: the fallback is a money figure from the table,
          // never a token count with no figure at all. OpenRouter's own search
          // is a plugin on the fallback path (D-20), so no count rides here.
          return tableCost('openrouter', usage, model, null);
        },
      };
    case 'openai-compatible':
      return {
        model: (key, base, modelId) => {
          // The same base URL the settings page normalised and stored under
          // baseUrlKey('openai-compatible'), handed down by the loop, and the
          // same refusal sentence probe.ts already answers the learner with
          // when there is none.
          if (!base) throw new Error("Add the endpoint's base URL first");
          // This is the one teaching row the catalogue carries no default model
          // for, because only the learner knows what their endpoint serves. An
          // empty id would go out as one and come back as somebody else's 400,
          // so it is refused here with a sentence in the same voice as the one
          // above.
          if (!modelId) throw new Error('Choose a model for the endpoint first');
          // includeUsage defaults to undefined (false): without it the endpoint
          // reports no usage at all and every lesson on this row would read
          // `not reported`. An endpoint that still reports nothing is the honest
          // blank, not a bug.
          return createOpenAICompatible({ name: 'openai-compatible', apiKey: key, baseURL: v1(base), includeUsage: true, fetch: noRedirectFetch })(modelId);
        },
        search: () => null,
        // The model behind a learner's own endpoint is not in the table, and
        // guessing a rate for it is the one thing the four-word label vocabulary
        // exists to prevent.
        cost: () => ({ cost_usd: null, cost_source: 'unknown', searches: null }),
      };
    case 'claude-code':
    case 'codex':
      throw new Error(`${labelOf(provider)} runs on its own CLI and never through this loop`);
    case 'ollama':
    case 'lmstudio':
    case 'llamacpp':
      throw new Error(`${labelOf(provider)} has no owned-loop adapter yet`);
  }
}
