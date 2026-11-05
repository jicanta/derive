import { useEffect, useState } from 'react';
import type { ExplainPayload } from '../lib/types';
import { Markdown } from './Markdown';

/** Teach-back: the learner explains a node in their own words. */
export function ExplainCard({
  explain,
  answer,
  onAnswer,
  disabled,
  nodeLabel,
}: {
  explain: ExplainPayload;
  answer?: string;
  onAnswer: (text: string) => Promise<unknown>;
  disabled?: boolean;
  nodeLabel?: string | null;
}) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const answered = answer !== undefined;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  const send = async () => {
    if (words < 8) return;
    if (!text.trim() || sending || answered) return;
    setSending(true);
    try {
      await onAnswer(text.trim());
    } finally {
      setSending(false);
    }
  };
  // The eight-word floor lives inside send() and not only on the button's
  // disabled prop, because three routes now reach it — plain Enter in the
  // field, the shipped command-Enter, and the button — and a one-word
  // teach-back submitted by accident is what the floor makes cheap.

  // Enter commits from outside the field: on the button, or anywhere else on
  // the page once focus has left the textarea. The guard bails inside a text
  // field, which is why the textarea carries its own Enter branch below.
  const active = !answered && !disabled && !sending;
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void send();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, text]);

  return (
    <div className="animate-fade-up rounded-[18px] border border-ink-50/20 bg-ink-900/85 backdrop-blur px-6 py-5 md:px-7 md:py-6">
      <div className="flex items-center gap-2.5 mb-4">
        <span className="h-1.5 w-1.5 rounded-full bg-ink-50" />
        <span className="eyebrow">Teach it back{nodeLabel ? ` · ${nodeLabel}` : ''}</span>
      </div>
      <div className="mb-4 [&_.prose]:text-[1.06rem] [&_.prose]:text-ink-100">
        <Markdown text={explain.prompt} />
      </div>
      {answered ? (
        <blockquote className="font-serif text-[1.2rem] leading-snug text-ink-100 border-l border-ink-50/50 pl-4 whitespace-pre-wrap">{answer}</blockquote>
      ) : disabled ? (
        <p className="font-mono text-[11px] text-ink-500">This teach-back is no longer active.</p>
      ) : (
        <div className="flex flex-col gap-2">
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void send();
              } else if (e.key === 'Enter' && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="In your own words. No looking back up. Two to five sentences is plenty."
            className="w-full resize-y rounded-xl bg-ink-850 border hairline px-4 py-3 text-[15px] leading-relaxed outline-none focus:border-ink-400 placeholder:text-ink-500 font-serif text-[1.15rem]"
          />
          <div className="flex items-center gap-3">
            <button type="button" disabled={words < 8 || sending} onClick={send} className="h-9 rounded-full bg-ink-100 text-ink-950 px-4 text-sm font-medium hover:bg-white disabled:opacity-40 transition-colors">
              {sending ? 'Sending' : 'Submit explanation'}
            </button>
            {/* The row tracks what works right now: below the floor nothing submits, so nothing is advertised but the count. `?` is deliberately absent — the textarea is auto-focused and swallows it, so the overlay is reached once focus leaves the field. */}
            <span className="font-mono text-[11px] text-ink-500">
              {words} words{words < 8 ? ' · say a little more' : ''}
              {words >= 8 && (
                <>
                  {' · '}
                  <kbd className="kbd">↵</kbd> submit · <kbd className="kbd">⇧↵</kbd> newline
                </>
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
