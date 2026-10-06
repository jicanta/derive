/**
 * What each provider needs before Derive's own loop can talk to it.
 *
 * The loop in `api.ts` is one `streamText` call and the same fourteen tools
 * whichever provider runs it; the only things that genuinely differ per
 * provider are how its model object is built and which options its SDK takes.
 * Those differences live here, in one table keyed by `ProviderId`, for the
 * reason `probe.ts` already switches on a `ProviderSpec` rather than on a
 * chain of branches: adding a provider should be one row that a reader can
 * check against the catalogue, not a sixth `if` buried in the loop. The
 * `switch` below is deliberately exhaustive with no `default`, so a new
 * catalogue row that nobody taught the loop about fails to compile instead of
 * failing a learner's lesson.
 *
 * This module performs no I/O at import time and reads no environment: the key
 * and the base URL are passed in by the driver, which read them through
 * `settings.ts`.
 */
import { createAnthropic } from '@ai-sdk/anthropic';
import type { JSONValue, LanguageModel } from 'ai';
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
 * never named. This is the same posture `probe.ts` `getJson` already takes for
 * the model list, in the one place every provider factory passes through.
 */
export const noRedirectFetch: typeof globalThis.fetch = async (input, init) => {
  const res = await fetch(input, { ...init, redirect: 'manual' });
  if (res.status >= 300 && res.status < 400) throw new Error('the provider answered with a redirect, which derive does not follow because it could carry your key');
  return res;
};

/** What one provider contributes to the loop: how to build its model, and the options its SDK reads. */
export type Adapter = {
  /** The model object the loop streams from. `modelId` is the learner's override, or null for the catalogue default. */
  model(key: string | undefined, base: string | undefined, modelId: string | null): LanguageModel;
  /** Passed straight to `streamText` as `providerOptions`; this is where D-08's parallel-tool flag lives. */
  providerOptions?: Record<string, Record<string, JSONValue>>;
};

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
      };
    case 'claude-code':
    case 'codex':
      throw new Error(`${labelOf(provider)} runs on its own CLI and never through this loop`);
    case 'openai':
    case 'gemini':
    case 'openrouter':
    case 'openai-compatible':
    case 'ollama':
    case 'lmstudio':
    case 'llamacpp':
      throw new Error(`${labelOf(provider)} has no owned-loop adapter yet`);
  }
}
