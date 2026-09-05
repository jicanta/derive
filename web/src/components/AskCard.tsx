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
    <div className="animate-fade-up rounded-[18px] border border-teal-400/25 bg-ink-900/85 backdrop-blur px-6 py-5 md:px-7 md:py-6">
      <div className="flex items-center gap-2.5 mb-4">
        <span className="h-1.5 w-1.5 rounded-full bg-teal-400" />
        <span className="eyebrow">Your call</span>
      </div>
      <div className="mb-4 [&_.prose]:text-[1.06rem] [&_.prose]:text-ink-100">
        <Markdown text={ask.question} />
      </div>
      {answered ? (
        <p className="font-serif italic text-[1.25rem] leading-snug text-ink-100 border-l border-teal-400/60 pl-4">{answer}</p>
      ) : disabled ? (
        <p className="font-mono text-[11px] text-ink-500">This question is no longer active. Type below to continue.</p>
      ) : (
        <div className="grid gap-2">
          {ask.options.map((o, i) => (
            <button
              key={i}
              type="button"
              disabled={sending}
              onClick={() => send(o)}
              className="text-left rounded-xl border hairline hover:border-teal-400/60 hover:bg-ink-850 bg-ink-850/50 px-4 py-3 transition-colors [&_.prose]:text-[0.98rem] [&_.prose]:text-ink-100"
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
              disabled={sending}
              className="flex-1 rounded-xl bg-ink-850 border hairline px-4 py-2.5 text-[15px] outline-none focus:border-teal-400/60 placeholder:text-ink-500"
            />
            <button type="submit" disabled={!text.trim() || sending} className="rounded-xl bg-ink-100 text-ink-950 px-4 text-sm font-medium hover:bg-white disabled:opacity-40 transition-colors">
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
