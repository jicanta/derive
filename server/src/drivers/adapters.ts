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
import { anthropic, createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI, google } from '@ai-sdk/google';
import { createOpenAI, openai } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { JSONValue, LanguageModel, LanguageModelUsage, ProviderMetadata, Tool } from 'ai';
import { createOllama } from 'ai-sdk-ollama';
import { costOf, type CostRow } from '../cost.js';
import type { CostSource } from '../db.js';
import { priceTable } from '../prices.js';
import { v1 } from '../probe.js';
import { labelOf, type ProviderId } from '../providers.js';
import { searchReady } from '../search.js';
import { numCtxFor } from '../settings.js';
import type { ToolDialect } from '../tools.js';

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
  /**
   * The schema dialect this provider's tools are projected into.
   *
   * It is a per-row fact because only the row knows what its provider does with
   * a tool schema: Google passes one through verbatim and 400s on a keyword it
   * does not know, OpenAI normalises a few things and ignores the rest,
   * Anthropic touches nothing. The registry is identical on all of them; only
   * the projection adapts.
   */
  dialect: ToolDialect;
  /** Passed straight to `streamText` as `providerOptions`; this is where D-08's parallel-tool flag lives. */
  providerOptions?: Record<string, Record<string, JSONValue>>;
  /**
   * The `providerOptions` to attach to the **stable** system message, or
   * undefined where there is nothing to attach.
   *
   * D-06 splits the system prompt into a byte-stable prefix and a volatile
   * tail; this is the per-provider half of making the prefix cacheable.
   * Anthropic needs an explicit breakpoint on it, so its row returns one.
   * Every other row returns undefined — see each one for why. It takes the
   * content because a provider that priced or sized a breakpoint would need
   * it, and passing it now keeps that from widening the type later.
   */
  cacheHook?: (content: string) => Record<string, Record<string, JSONValue>> | undefined;
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
 * What a turn on the learner's own machine cost: nothing, and how firmly
 * Derive knows that.
 *
 * Amendment A-02 of `04-01-PLAN.md`, resolving a conflict the research notes
 * and the approved UI-SPEC disagreed on. A local turn is free, so the figure is
 * never a number. The *label* is the whole decision: a request that reported
 * any token count reads `not billed` (`cost_source: 'subscription'` in
 * `cost.ts`'s locked vocabulary) because Derive knows exactly what it cost;
 * one that reported none reads `not reported` (`'unknown'`), because then it
 * genuinely does not. Saying `not reported` on a turn that did report counts
 * would claim ignorance Derive does not have.
 */
function localCost(usage: LanguageModelUsage): CostRead {
  const counted =
    reported(usage.inputTokenDetails?.noCacheTokens) ?? reported(usage.inputTokens) ?? reported(usage.outputTokens) ?? reported(usage.totalTokens);
  return { cost_usd: null, cost_source: counted === null ? 'unknown' : 'subscription', searches: null };
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
 * Whether a Gemini model id names the Gemini 3 series or later.
 *
 * That is the only case where `@ai-sdk/google` keeps Derive's fourteen function
 * declarations beside a provider-defined search tool; on anything older
 * `prepareTools` returns the provider tool alone and discards all of them,
 * giving a tutor that talks and never draws a graph. The predicate is
 * deliberately narrow, and wrong in the safe direction: an id it does not
 * recognise is answered no and gets Derive's own fallback search, which teaches
 * correctly, where a yes it got wrong would cost the learner the whole method.
 * The loop's unsupported-combination refusal is the backstop for anything this
 * still misses. A null id is the catalogue default, which is a Gemini 3 model.
 */
const geminiKeepsTools = (modelId: string | null): boolean => {
  const m = /^(?:models\/)?gemini-(\d+)/.exec((modelId ?? 'gemini-3.8-flash').trim().toLowerCase());
  return !!m && Number(m[1]) >= 3;
};

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

/** Which of the three web-search situations a turn is in: the provider's own tool, Derive's configured fallback, or nothing at all. */
export type SearchMode = 'native' | 'fallback' | 'none';

/**
 * The one three-way decision, made in one place.
 *
 * The loop reads it to decide which search tool to register and the prompt
 * reads it to decide how `{{WEB_TOOLS}}` renders, and those two must never
 * disagree: a tutor told to verify with a tool it was not given asserts
 * instead, and a tutor handed two ways to search in one turn will use both. A
 * fallback the learner selected but did not finish configuring is `none`, not
 * `fallback` — it has no way to answer a search, so saying it has one would be
 * the same lie by a different route.
 */
export function searchMode(provider: ProviderId, modelId: string | null): SearchMode {
  if (nativeSearch(provider, modelId)) return 'native';
  return searchReady() ? 'fallback' : 'none';
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
        // Anthropic does no schema normalisation of note and has no strict mode, so it reads the registry's own projection.
        dialect: 'full',
        // D-08's belt: Anthropic is told not to open two tool calls at once.
        // The braces are the loop's own per-lesson serialisation in api.ts.
        providerOptions: { anthropic: { disableParallelToolUse: true } },
        // The one row that has to ask. Anthropic caches nothing unless a
        // breakpoint says where the reusable prefix ends, and the method text
        // is ~29KB — far above the 1,024-token minimum — so the breakpoint
        // goes on the stable system message and the material, library and
        // profile that follow it are never cached.
        cacheHook: () => ({ anthropic: { cacheControl: { type: 'ephemeral' } } }),
        // Anthropic's own server-side search, which coexists with all fourteen
        // function tools in one `tools` object. It needs web search enabled in
        // the organisation's console privacy settings; where it is not, the
        // provider's own sentence is what the learner reads.
        search: () => anthropic.tools.webSearch_20260318({}),
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
        // Deliberately the registry's own projection, not the strict dialect:
        // strict mode is opt-in per tool and off by default, and turning it on
        // would cost the four bounds `set_plan` (3-12 nodes) and `quiz` (2-3
        // options) hold the model to, which is the shape of a Derive lesson.
        // The strict dialect is still built and CI-validated in `tools.ts`, so
        // Phase 4's conformance harness can switch it on and measure what it
        // costs rather than having to invent it.
        dialect: 'full',
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
        // OpenAI caches a prompt prefix automatically above 1,024 tokens and takes no breakpoint, so the only thing Derive owes it is a prefix that does not move — which the split already guarantees. Nothing to attach is a decision, not an omission.
        cacheHook: () => undefined,
        // The Responses API pushes function tools and provider tools into one
        // array with no exclusion, so this sits beside the fourteen.
        search: () => openai.tools.webSearch({}),
        cost: (_pm, usage, model, searches) => tableCost('openai', usage, model, searches),
      };
    case 'gemini':
      return {
        model: (key, _base, modelId) => createGoogleGenerativeAI({ apiKey: key, fetch: noRedirectFetch })(modelId ?? 'gemini-3.8-flash'),
        // The one row that needs a narrower dialect: `prepareFunctionDeclaration`
        // hands the schema to Google verbatim, so a keyword Google rejects is a
        // 400 on the learner's lesson rather than a warning.
        dialect: 'gemini',
        // Gemini's implicit caching works the same way: it matches a prefix on its own above the model's minimum and has no breakpoint to set, so keeping the prefix byte-stable is the whole contribution. Nothing to attach is a decision, not an omission.
        cacheHook: () => undefined,
        // No parallel-tool option: @ai-sdk/google has no such flag anywhere in
        // its types or its docs. That absence is why the loop's per-lesson
        // mutex is load-bearing here rather than belt-and-braces — on Gemini it
        // is the only thing keeping two cards off the learner's screen.
        // The one row whose answer genuinely depends on the model id.
        // @ai-sdk/google's prepareTools returns `tools: googleTools` alone —
        // discarding all 14 function declarations — unless the model is a
        // Gemini 3 series model, and the only signal is a pushed warning of
        // type `unsupported` with feature "combination of function and
        // provider-defined tools". So the answer comes from the model id, and
        // the loop's refusal on that warning is the backstop, because a lesson
        // taught with no tools is not a Derive lesson.
        search: (modelId) => (geminiKeepsTools(modelId) ? google.tools.googleSearch({}) : null),
        cost: (_pm, usage, model, searches) => tableCost('gemini', usage, model, searches),
      };
    case 'openrouter':
      return {
        // The option rides twice on purpose: the model-level setting is what the
        // provider reads into the request body, and providerOptions.openrouter
        // is spread into that body too, so a change to either path still carries
        // it. Without it providerMetadata.openrouter.usage.cost is simply absent.
        model: (key, _base, modelId) => createOpenRouter({ apiKey: key, fetch: noRedirectFetch }).chat(modelId ?? 'anthropic/claude-opus-5.5', { usage: { include: true } }),
        // A gateway fronting many models normalises nothing of note of its own, so the registry's own projection is what goes out.
        dialect: 'full',
        providerOptions: { openrouter: { parallelToolCalls: false, usage: { include: true } } },
        // What a gateway fronts is not knowable from here: an Anthropic model behind it would want a breakpoint and an OpenAI one would refuse it, so Derive sends the stable prefix and lets the gateway decide.
        cacheHook: () => undefined,
        // D-20 puts OpenRouter on the fallback path: its search is a plugin
        // rather than a tool, and one search implementation the loop can reason
        // about beats a sixth shape.
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
        // Only the learner knows what their endpoint serves, so the honest
        // default is the full contract: a dialect guessed on their behalf would
        // narrow what the model is told for no evidence at all.
        dialect: 'full',
        // Same reason as the gateway row: only the learner knows what their endpoint serves, and a breakpoint it does not understand is a key it may reject the request over.
        cacheHook: () => undefined,
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
        // A learner's own endpoint has no search of its own to offer; D-20 puts it on the fallback path by construction.
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
      return {
        // D-08: compaction is keyed on the provider being local, never on the
        // model's own size. A learner's 70B on a 128k window and their 3B on a
        // 16k one are the same row, and asking the row rather than the model
        // keeps the decision in one place.
        dialect: 'compact',
        // A local server caches nothing across requests and takes no
        // breakpoint, so there is nothing to attach. A decision, not an
        // omission.
        cacheHook: () => undefined,
        // Ollama's own web search needs an Ollama account key, which the
        // offline path by definition has none of, so 03 D-20 puts this row on
        // the pluggable fallback path. This is also the explicit resolution of
        // the Phase-3 deferred Ollama-search backend: the row answers null, and
        // `04-CONTEXT.md` §Deferred places the backend itself outside this
        // phase.
        search: () => null,
        model: (key, base, modelId) => {
          // Only the learner knows which model they pulled onto their own
          // machine, so the catalogue carries no default for this row and an
          // empty id is refused here rather than going out as one. Same voice
          // as the openai-compatible row above.
          if (!modelId) throw new Error('Choose a model for Ollama first');
          return createOllama({
            baseURL: base ?? 'http://127.0.0.1:11434',
            // A locally-started Ollama usually wants no key at all; one is sent
            // only when the learner stored it, and only to the address they
            // stored it against.
            ...(key ? { apiKey: key } : {}),
            fetch: noRedirectFetch,
          })(modelId, {
            // The whole reason this row is not on the OpenAI-compatible route.
            // Ollama's OpenAI-compatible endpoint carries no `options` object,
            // so that route silently gets Ollama's 4,096-token default — and
            // the first thing a 4k window drops is the method's gate,
            // discipline and checks text, with nothing erroring. This is the
            // failure PROV-06 exists to prevent.
            options: { num_ctx: numCtxFor('ollama') },
            // Every tool-capable model in Ollama's library also carries
            // `thinking`, and reasoning reaches neither the learner nor SQLite
            // (03 D-09) — so paying for it out of a 16k window buys nothing.
            think: false,
            // That layer retries and normalises a malformed tool call behind
            // Derive's back. Plan 04-04's schema-rejection count would then
            // measure the wrapper rather than the model, which is the one thing
            // a conformance harness must not do.
            reliableToolCalling: false,
          });
        },
        // Amendment A-02: a free turn that reported counts is `not billed`,
        // because Derive knows exactly what it cost — nothing. `not reported`
        // is reserved for a turn that reported no counts at all, which is a
        // different claim. Never a `cost_usd` figure: there is no money here to
        // report, and no fifth `cost_source` value (Phase 1 D-16 fixes the
        // union at four).
        cost: (_pm, usage) => localCost(usage),
      };
    case 'lmstudio':
      return {
        // D-08, the same as the Ollama row: keyed on the provider being local.
        dialect: 'compact',
        // A local server caches nothing across requests and takes no breakpoint.
        cacheHook: () => undefined,
        // No search of its own, so D-20 puts it on the pluggable fallback path
        // by construction.
        search: () => null,
        model: (key, base, modelId) => {
          // D-05: Derive sends LM Studio no window. The window it serves is the
          // one it was started with, and Derive never fights a server's own
          // configuration on the learner's machine. Plan 04-02's capability read
          // is what supplies that window to `headroomCheck`, so the per-lesson
          // refusal still fires — it just fires on the server's number rather
          // than on one Derive invented.
          if (!base) throw new Error("Add LM Studio's base URL first");
          // Only the learner knows which model they loaded; an empty id would
          // come back as somebody else's 400.
          if (!modelId) throw new Error('Choose a model for LM Studio first');
          // includeUsage is load-bearing: without it this endpoint reports no
          // usage at all and every local lesson would read `not reported` when
          // the honest label is `not billed`.
          return createOpenAICompatible({ name: 'lmstudio', apiKey: key, baseURL: v1(base), includeUsage: true, fetch: noRedirectFetch })(modelId);
        },
        // Amendment A-02, as on the Ollama row.
        cost: (_pm, usage) => localCost(usage),
      };
    case 'llamacpp':
      return {
        // D-08, the same as the two rows above.
        dialect: 'compact',
        cacheHook: () => undefined,
        search: () => null,
        model: (key, base, modelId) => {
          // D-05 again: llama.cpp serves the window `llama-server` was started
          // with, and Derive sends none. Plan 04-02's capability read supplies
          // it to `headroomCheck`.
          if (!base) throw new Error("Add llama.cpp's base URL first");
          if (!modelId) throw new Error('Choose a model for llama.cpp first');
          return createOpenAICompatible({ name: 'llamacpp', apiKey: key, baseURL: v1(base), includeUsage: true, fetch: noRedirectFetch })(modelId);
        },
        cost: (_pm, usage) => localCost(usage),
      };
  }
}
