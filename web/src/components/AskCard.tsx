import { useState } from 'react';
import type { AskPayload } from '../lib/types';
import { Markdown } from './Markdown';

export function AskCard({
  ask,
  answer,
  onAnswer,
  disabled,
}: {
  ask: AskPayload;
  answer?: string;
  onAnswer: (text: string) => Promise<unknown>;
  disabled?: boolean;
}) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const answered = answer !== undefined;

  const send = async (t: string) => {
    if (!t.trim() || sending || answered) return;
    setSending(true);
    try {
      await onAnswer(t.trim());
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="animate-fade-up rounded-2xl border border-teal-500/30 bg-ink-900/80 backdrop-blur p-5 md:p-6">
      <div className="flex items-center gap-2 mb-3 text-[11px] uppercase tracking-[0.18em] text-ink-400">
        <span className="h-1.5 w-1.5 rounded-full bg-teal-400" />
        Your call
      </div>
      <div className="mb-4">
        <Markdown text={ask.question} />
      </div>
      {answered ? (
        <p className="text-ink-200 border-l-2 border-teal-500/60 pl-3 italic font-serif text-lg">{answer}</p>
      ) : (
        <div className="grid gap-2">
          {ask.options.map((o, i) => (
            <button
              key={i}
              type="button"
              disabled={sending || disabled}
              onClick={() => send(o)}
              className="text-left rounded-xl border border-ink-700 hover:border-teal-500/60 hover:bg-ink-850 px-4 py-3 transition-colors [&_.prose]:text-[0.98rem]"
            >
              <Markdown text={o} />
            </button>
          ))}
          <form
            className="flex gap-2 mt-1"
            onSubmit={(e) => {
              e.preventDefault();
              void send(text);
            }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={ask.options.length ? 'Or say it in your own words' : 'Type your answer'}
              disabled={sending || disabled}
              className="flex-1 rounded-xl bg-ink-850 border border-ink-700 px-4 py-2.5 text-sm outline-none focus:border-teal-500/60 placeholder:text-ink-500"
            />
            <button
              type="submit"
              disabled={!text.trim() || sending || disabled}
              className="rounded-xl bg-ink-100 text-ink-950 px-4 text-sm font-medium hover:bg-white disabled:opacity-40 transition-colors"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
