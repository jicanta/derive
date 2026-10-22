/**
 * Whether the next request still fits in the model's window.
 *
 * A lesson that outgrows its model's context window has to be refused with
 * Derive's own sentence and its own next step, before the request goes out.
 * Waiting for the provider to say no means five error shapes to recognise
 * across five providers, a wasted request every time one arrives, and — the
 * case that actually matters — an unrecognised wording reaching the learner
 * raw, at the exact moment they most need a sentence that tells them what to do
 * next.
 *
 * The AI SDK exposes no context window: `ModelInfo` is `{ provider, modelId }`
 * and there is no capability or limits object anywhere in its public types. The
 * table in pricing.ts is therefore unavoidable rather than a convenience, which
 * is also why the window lives beside the rates instead of in a module of its
 * own — one table goes stale, one table gets checked.
 *
 * The estimate is deliberately wrong in one direction. Over-counting refuses a
 * lesson slightly early, which costs the learner one review lesson they were
 * going to need anyway; under-counting lets the request go and loses the turn.
 * Pure, with no I/O: a test reads every case from literals.
 */
import type { PriceTable } from './pricing.js';

// English runs nearer four characters per token, so three over-counts on purpose: the estimate must be wrong in the direction of refusing early.
export const CHARS_PER_TOKEN = 3;

// Eighty per cent leaves a fifth of the window for the model's own output plus the tokenizer variance between three vendors, none of whose counts this estimate can see.
export const HEADROOM_FRACTION = 0.8;

/** A conservative token count for a piece of text. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/** The verbatim refusal from 03-UI-SPEC.md §Copywriting Contract → Context-window refusal (A6). `Home` is the only link in the card and there is no button, because starting a review lesson reviews whatever is due rather than this lesson's nodes. */
const REFUSAL = 'This lesson has grown too long to continue. Everything you locked is saved — start a review lesson on these nodes from Home.';

/**
 * The verbatim refusal from 04-UI-SPEC.md §Copywriting Contract → num_ctx
 * refusal, for a window the learner set rather than a lesson that outgrew one.
 *
 * `Settings` is the only link in this card, exactly as `Home` is the only link
 * in `REFUSAL` above, and the two must never be conflated: this card's fix is
 * the `num_ctx` field on the model's own row in Settings, where the other
 * card's is a review lesson started from Home. A learner sent to Home to raise
 * a context window finds nothing there to raise, and one sent to Settings to
 * salvage an overgrown lesson finds no field that salvages it. That is why
 * there are two constants with one link each, and why a single parameterised
 * sentence would be the wrong simplification.
 */
const NUM_CTX_REFUSAL = (estimate: number, model: string, numCtx: number) =>
  `The method does not fit in this model's context window. This step needs about ${estimate} tokens, but ${model} is set to ${numCtx}. Raise the model's context window in Settings (num_ctx), or pick a model with room.`;

/**
 * Whether the turn should be refused before it is sent.
 *
 * The system prompt, the history, the new message and the serialised tool
 * surface all occupy the same window, so all four are measured. The window is
 * the one the caller resolved when it supplied one — a local row knows the
 * window because it is the one it asked the server for — and otherwise comes
 * from the table the caller passes, which is the merged one, so a learner's
 * `prices.json` can correct a window the same way it corrects a rate. A
 * caller-supplied window takes precedence because it is an observation rather
 * than a listing, and abstaining still applies when neither source has one.
 *
 * `window` is a number rather than a `pricing.ts` row because a price row with
 * `input: 0` would render a metered lesson as free — the one lie that table
 * exists to prevent — and `ModelPrice`'s token fields are not nullable.
 */
export function headroomCheck(
  input: { provider: string; model: string | null; instructions: string; messages: string; prompt: string; tools: string; window?: number },
  table: PriceTable,
): { refuse: false } | { refuse: true; reason: string } {
  const listed = table[input.provider]?.[input.model ?? '']?.context;
  const window = input.window ?? listed;
  // A model neither the caller nor the table has a window for — every
  // openai-compatible endpoint, and a local server whose capability read found
  // nothing — abstains rather than guessing: refusing a learner's perfectly
  // capable endpoint on a guessed window would be worse than letting that
  // endpoint's own error through.
  if (window == null) return { refuse: false };
  // The tool text counts because the request carries it. The sixteen `api`
  // tools serialise to 3,349 estimated tokens in the compact dialect — 20% of
  // a 16,384 window the estimate was previously pretending to measure, which
  // is what made a 16k floor meaningless.
  const estimate = estimateTokens(input.instructions) + estimateTokens(input.messages) + estimateTokens(input.prompt) + estimateTokens(input.tools);
  if (estimate <= window * HEADROOM_FRACTION) return { refuse: false };
  // Which refusal depends on where the window came from, not on how big it is:
  // a window the learner set is raised in Settings, a listed one is not.
  if (input.window != null) return { refuse: true, reason: NUM_CTX_REFUSAL(estimate, input.model ?? 'this model', input.window) };
  return { refuse: true, reason: REFUSAL };
}
