import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

/**
 * The field vocabulary the settings cards share: the input, the status pill,
 * the text button, the three note lines under a field, and the two behaviours
 * every save-as-you-go field needs.
 *
 * These lived in `ProviderRow.tsx` while it was the only card on the page.
 * Two cards render them now and the page itself uses two, so they live in one
 * module instead of three copies. The Phase 2 gap-closure finding is the
 * reason it is worth a file: the 32px hit area exists only inside
 * `textButton`, so a button that hand-rolls its class string opts out of it
 * silently, and a second copy of the constant is the same defect one step
 * earlier. A caller that needs one more utility composes it — `${textButton}
 * gap-1.5` — rather than restating the string.
 *
 * Not a component file: no `.tsx`, nothing rendered here, so the one-component
 * -per-file rule and the component count are both untouched.
 */

/** An input a learner types a setting into: full width, so a long value scrolls inside it rather than widening the card. */
export const field = 'w-full rounded-xl border hairline bg-ink-900/70 px-3 text-[14px] leading-relaxed text-ink-100 outline-none focus:border-gold-500/60 placeholder:text-ink-500 disabled:opacity-60';

/** A small capsule stating a fact about a row: a status, or where a value came from. */
export const pill = 'inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.16em] uppercase text-ink-400 border hairline rounded-full px-2.5 h-6';

/** A quiet action beside a field. The 32px hit area lives here and nowhere else. */
export const textButton = 'inline-flex items-center h-8 font-mono text-[10px] text-ink-400 hover:text-ink-50 transition-colors focus-visible:text-ink-50 focus-visible:underline disabled:opacity-40';

/** The line that says a value was stored, shown for 1800 ms by `useTick`. */
export const tickLine = 'mt-2 font-mono text-[10px] text-gold-500';

/** The line a refusal is shown on: the server's own sentence, never Derive's paraphrase of it. */
export const errLine = 'mt-2 text-[14px] leading-relaxed text-rust-400';

/** The line a muted aside is shown on: what the environment locks, what is still missing. */
export const noteLine = 'mt-2 text-[14px] leading-relaxed text-ink-500';

/** Blur the input on Enter so the one save path (onBlur) runs; the form has no submit. */
export const blurOnEnter = (e: KeyboardEvent<HTMLInputElement>) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    e.currentTarget.blur();
  }
};

/** A saved tick that shows for 1800 ms and then goes away; one timer per field, cleared on unmount. */
export function useTick(): [boolean, () => void] {
  const [on, setOn] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );
  const tick = () => {
    setOn(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOn(false), 1800);
  };
  return [on, tick];
}
