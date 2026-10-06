/**
 * Whether the next request still fits in the model's window.
 *
 * STUB — the estimator and the headroom decision arrive in the GREEN step.
 */
import type { PriceTable } from './pricing.js';

/** Characters per token. */
export const CHARS_PER_TOKEN = 3;

/** How much of a window a prompt may fill. */
export const HEADROOM_FRACTION = 0.8;

/** A conservative token count for a piece of text. */
export function estimateTokens(text: string): number {
  void text;
  return 0;
}

/** Whether the turn should be refused before it is sent. */
export function headroomCheck(
  input: { provider: string; model: string | null; instructions: string; messages: string; prompt: string },
  table: PriceTable,
): { refuse: false } | { refuse: true; reason: string } {
  void input;
  void table;
  return { refuse: false };
}
