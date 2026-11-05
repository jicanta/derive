import { Fragment, useEffect, useRef } from 'react';

/**
 * The keys that work right now, named at the moment the learner asks.
 *
 * Answering from the keyboard only helps if the learner knows the keys for the
 * card in front of them, so the rows are derived from the open card's kind and
 * its option count rather than being a fixed list: a two-option quiz shows 1
 * and 2, never a third key that does nothing. Nothing here explains what a
 * card type *is* — that was explicitly rejected, because it is copy to keep
 * true and to translate once Phase 6 adds languages.
 *
 * There is no scroll container and that is deliberate: `f` and `Esc` are
 * always present, so the panel has a floor of two rows and a ceiling of six.
 */
export function KeyHelp({ kind, options, onClose }: { kind: 'quiz' | 'ask' | 'explain' | 'plan' | null; options: number; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);

  // Focus moves to the panel on open and back to whatever had it on close, so
  // a keyboard learner is never left with focus on an element they can no
  // longer see.
  useEffect(() => {
    const was = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    return () => was?.focus?.();
  }, []);

  const digits = Array.from({ length: options }, (_, i) => String(i + 1));
  const letters = Array.from({ length: options }, (_, i) => String.fromCharCode(65 + i));
  const pick = options > 0 ? [{ keys: digits, alt: letters, label: 'pick an option' }] : [];
  // Always the last two rows, which is why no panel is ever empty: an open
  // card of a kind this table does not name falls to these alone.
  const tail = [
    { keys: ['f'], label: 'focus mode' },
    { keys: ['Esc'], label: 'stop the tutor' },
  ];
  const rows: { keys: string[]; alt?: string[]; label: string }[] =
    kind === 'quiz'
      ? [...pick, { keys: ['↵'], label: 'answer' }, { keys: ['⇧↵'], label: 'answer, not sure' }, { keys: ['0'], label: "I don't know" }, ...tail]
      : kind === 'ask'
        ? [...pick, ...tail]
        : kind === 'explain'
          ? [{ keys: ['↵'], label: 'submit' }, { keys: ['⇧↵'], label: 'new line' }, ...tail]
          : kind === 'plan'
            ? [{ keys: ['↵'], label: 'approve the plan' }, ...tail]
            : tail;

  return (
    <div className="fixed inset-0 z-[60] bg-ink-950/70 backdrop-blur-sm grid place-items-center px-5" onClick={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Keys for this card"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        // Tab is trapped: there is nothing focusable inside, so the panel keeps
        // focus and the page behind it cannot be reached by tabbing.
        onKeyDown={(e) => {
          if (e.key === 'Tab') e.preventDefault();
        }}
        className="animate-fade-up w-full max-w-[380px] rounded-[18px] border hairline bg-ink-900/95 px-6 py-5 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.9)] outline-none"
      >
        <div className="eyebrow">{kind ? 'Keys for this card' : 'Keys'}</div>
        <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2">
          {rows.map((r) => (
            <Fragment key={r.label}>
              <span className="whitespace-nowrap">
                {r.keys.map((k) => (
                  <kbd key={k} className="kbd">{k}</kbd>
                ))}
                {r.alt && (
                  <>
                    {' / '}
                    {r.alt.map((k) => (
                      <kbd key={k} className="kbd">{k}</kbd>
                    ))}
                  </>
                )}
              </span>
              <span className="font-mono text-[11px] text-ink-300">{r.label}</span>
            </Fragment>
          ))}
        </div>
        <div className="mt-4 pt-3 border-t hairline font-mono text-[10px] text-ink-500">? or Esc to close</div>
      </div>
    </div>
  );
}
