import { ArrowUp, FolderGit2, Mic, MicOff, Paperclip, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { MATERIAL_ACCEPT } from '../lib/useMaterials';

export function Composer({
  onSend,
  onStop,
  onAttach,
  onAttachRepo,
  attaching,
  busy,
  waiting,
  external,
  terminal,
  voice,
}: {
  onSend: (text: string) => Promise<unknown>;
  onStop: () => Promise<unknown>;
  /** Attach course material mid-lesson. */
  onAttach?: (files: FileList | null) => void;
  /** Import a repository mid-lesson: a folder path, a GitHub URL or a git URL. */
  onAttachRepo?: (source: string) => void;
  attaching?: boolean;
  busy: boolean;
  waiting: boolean;
  external?: boolean;
  /** Companion lesson answered from the terminal. */
  terminal?: boolean;
  /** Voice mode: a microphone in the composer, dictation into the box. */
  voice?: {
    supported: boolean;
    listening: boolean;
    speaking: boolean;
    /** The transcript so far; replaces the box while listening. */
    dictation: string;
    toggleListening: () => void;
  };
}) {
  const [text, setText] = useState('');
  const [repoOpen, setRepoOpen] = useState(false);
  const [repo, setRepo] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState(false);
  // Typing is always allowed. Mid-turn, the message answers the pending card
  // or is queued for the tutor's next step; the server sorts that out.
  const canSend = !!text.trim() && !sending;

  // Dictation writes into the box as it arrives; the page clears it once it has been handled.
  useEffect(() => {
    if (voice?.listening || voice?.dictation) setText(voice?.dictation ?? '');
  }, [voice?.dictation, voice?.listening]);

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

  const placeholder = voice?.listening
    ? 'Listening…'
    : external
      ? terminal
        ? waiting
          ? 'Answer the card above here, or reply in your terminal'
          : 'This lesson runs in your terminal. Notes typed here are kept in the log.'
        : waiting
          ? 'Answer the card above, or write here: it reaches the tutor at its next turn'
          : 'This lesson runs in your terminal. Notes typed here are kept in the log.'
      : waiting
        ? 'Answer the card above, or write here instead: a question, a doubt, "skip this"'
        : busy
          ? 'The tutor is writing. A message here reaches it at its next step'
          : 'Ask, push back, or say what to do next';

  return (
    <div>
      {repoOpen && onAttachRepo && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!repo.trim()) return;
            onAttachRepo(repo.trim());
            setRepo('');
            setRepoOpen(false);
          }}
          className="mb-2 flex items-center gap-2 rounded-xl border hairline bg-ink-900/90 pl-3 pr-1.5 py-1.5"
        >
          <FolderGit2 size={13} className="text-ink-500 shrink-0" />
          <input
            autoFocus
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setRepoOpen(false)}
            placeholder="A folder on this machine, a GitHub URL, or a git URL"
            className="flex-1 min-w-0 bg-transparent font-mono text-[12.5px] outline-none placeholder:text-ink-500"
          />
          <button type="submit" disabled={!repo.trim()} className="h-7 rounded-lg bg-ink-100 text-ink-950 px-3 text-[12px] font-medium disabled:opacity-40">
            Import
          </button>
        </form>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className={`flex items-end gap-3 rounded-2xl border hairline bg-ink-900/90 backdrop-blur pl-4 pr-2 py-2 transition-colors ${voice?.listening ? 'border-rust-400/60' : 'focus-within:border-ink-500'}`}
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
        {onAttachRepo && (
          <button
            type="button"
            title="Import a repository as course material"
            onClick={() => setRepoOpen((v) => !v)}
            className={`pb-2 transition-colors ${repoOpen ? 'text-gold-500' : 'text-ink-500 hover:text-ink-100'}`}
          >
            <FolderGit2 size={15} strokeWidth={1.8} />
          </button>
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
        {voice?.supported && (
          <button
            type="button"
            onClick={voice.toggleListening}
            title={voice.listening ? 'Stop listening' : voice.speaking ? 'Interrupt and speak' : 'Speak your answer'}
            className={`h-9 w-9 rounded-xl grid place-items-center border transition-colors ${
              voice.listening ? 'bg-rust-400/15 border-rust-400 text-rust-400 animate-pulse' : 'bg-ink-800 border-ink-600 text-ink-200 hover:bg-ink-700'
            }`}
          >
            {voice.listening ? <MicOff size={15} /> : <Mic size={15} />}
          </button>
        )}
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
    </div>
  );
}
