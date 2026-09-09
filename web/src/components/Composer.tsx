import { ArrowUp, Paperclip, Square } from 'lucide-react';
import { useRef, useState } from 'react';
import { MATERIAL_ACCEPT } from '../lib/useMaterials';

export function Composer({
  onSend,
  onStop,
  onAttach,
  attaching,
  busy,
  waiting,
  external,
}: {
  onSend: (text: string) => Promise<unknown>;
  onStop: () => Promise<unknown>;
  /** Attach course material mid-lesson. */
  onAttach?: (files: FileList | null) => void;
  attaching?: boolean;
  busy: boolean;
  waiting: boolean;
  external?: boolean;
}) {
  const [text, setText] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState(false);
  // Typing is always allowed. Mid-turn, the message answers the pending card
  // or is queued for the tutor's next step; the server sorts that out.
  const canSend = !!text.trim() && !sending;

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

  const placeholder = external
    ? 'This lesson runs in your terminal. Notes typed here are kept in the log.'
    : waiting
      ? 'Answer the card above, or write here instead: a question, a doubt, "skip this"'
      : busy
        ? 'The tutor is writing. A message here reaches it at its next step'
        : 'Ask, push back, or say what to do next';

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="flex items-end gap-3 rounded-2xl border hairline bg-ink-900/90 backdrop-blur pl-4 pr-2 py-2 focus-within:border-ink-500 transition-colors"
    >
      <span className="font-mono text-gold-500 text-[15px] pb-2">›</span>
      {onAttach && (
        <>
          <input
            ref={fileInput}
            type="file"
            multiple
            accept={MATERIAL_ACCEPT}
            className="hidden"
            onChange={(e) => {
              onAttach(e.target.files);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            title="Attach course material (pdf, pptx, docx, md, txt)"
            disabled={attaching}
            onClick={() => fileInput.current?.click()}
            className={`pb-2 transition-colors ${attaching ? 'text-gold-500 animate-pulse' : 'text-ink-500 hover:text-ink-100'}`}
          >
            <Paperclip size={15} strokeWidth={1.8} />
          </button>
        </>
      )}
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
        placeholder={placeholder}
        className="flex-1 resize-none bg-transparent py-2 text-[15px] outline-none placeholder:text-ink-500 max-h-40"
        onInput={(e) => {
          const el = e.currentTarget;
          el.style.height = 'auto';
          el.style.height = Math.min(el.scrollHeight, 160) + 'px';
        }}
      />
      {busy && !external && !text.trim() ? (
        <button type="button" onClick={() => void onStop()} title="Stop the tutor's turn" className="h-9 w-9 rounded-xl bg-ink-800 border border-ink-600 grid place-items-center hover:bg-ink-700">
          <Square size={13} />
        </button>
      ) : (
        <button type="submit" disabled={!canSend} className="h-9 w-9 rounded-xl bg-gold-500 text-ink-950 grid place-items-center disabled:opacity-30 hover:bg-gold-400 transition-colors">
          <ArrowUp size={16} />
        </button>
      )}
    </form>
  );
}
