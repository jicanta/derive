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
 * Whether the turn should be refused before it is sent.
 *
 * The system prompt, the history and the new message all occupy the same
 * window, so all three are measured. The window is read from the table the
 * caller passes, which is the merged one, so a learner's `prices.json` can
 * correct a window the same way it corrects a rate.
 */
export function headroomCheck(
  input: { provider: string; model: string | null; instructions: string; messages: string; prompt: string },
  table: PriceTable,
): { refuse: false } | { refuse: true; reason: string } {
  const window = table[input.provider]?.[input.model ?? '']?.context;
  // A model the table has no window for — every openai-compatible endpoint and every local server — abstains rather than guessing: refusing a learner's perfectly capable endpoint on a guessed window would be worse than letting that endpoint's own error through, and sizing an unlisted model is Phase 4's /api/show work.
  if (window == null) return { refuse: false };
  const estimate = estimateTokens(input.instructions) + estimateTokens(input.messages) + estimateTokens(input.prompt);
  if (estimate <= window * HEADROOM_FRACTION) return { refuse: false };
  return { refuse: true, reason: REFUSAL };
}
