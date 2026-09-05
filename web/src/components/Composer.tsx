import { ArrowUp, Square } from 'lucide-react';
import { useState } from 'react';

export function Composer({
  onSend,
  onStop,
  busy,
  waiting,
}: {
  onSend: (text: string) => Promise<unknown>;
  onStop: () => Promise<unknown>;
  busy: boolean;
  waiting: boolean;
}) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const canSend = !!text.trim() && !busy && !sending;

  const submit = async () => {
    if (!canSend) return;
    setSending(true);
    const t = text;
    setText('');
    try {
      await onSend(t);
    } catch {
      setText(t);
    } finally {
      setSending(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="flex items-end gap-2 rounded-2xl border border-ink-700 bg-ink-900/90 backdrop-blur p-2 pl-4 focus-within:border-ink-500 transition-colors"
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void submit();
          }
        }}
        rows={1}
        placeholder={waiting ? 'Answer the card above, or type here to steer' : busy ? 'The tutor is working…' : 'Ask, push back, or say what to do next'}
        disabled={busy && !waiting}
        className="flex-1 resize-none bg-transparent py-2 text-[15px] outline-none placeholder:text-ink-500 max-h-40 disabled:opacity-60"
        style={{ height: 'auto' }}
        onInput={(e) => {
          const el = e.currentTarget;
          el.style.height = 'auto';
          el.style.height = Math.min(el.scrollHeight, 160) + 'px';
        }}
      />
      {busy ? (
        <button type="button" onClick={() => void onStop()} title="Stop" className="h-9 w-9 rounded-xl bg-ink-800 border border-ink-600 grid place-items-center hover:bg-ink-700">
          <Square size={14} />
        </button>
      ) : (
        <button type="submit" disabled={!canSend} className="h-9 w-9 rounded-xl bg-gold-500 text-ink-950 grid place-items-center disabled:opacity-30 hover:bg-gold-400 transition-colors">
          <ArrowUp size={16} />
        </button>
      )}
    </form>
  );
}
