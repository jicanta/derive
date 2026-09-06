import { Check, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { QuizPayload, QuizResultPayload } from '../lib/types';
import { Markdown } from './Markdown';

const LETTERS = 'ABC';

export function QuizCard({
  quiz,
  result,
  onAnswer,
  disabled,
  nodeLabel,
}: {
  quiz: QuizPayload;
  result?: QuizResultPayload;
  onAnswer: (a: { selected?: number[]; idk?: boolean; note?: string }) => Promise<unknown>;
  disabled?: boolean;
  nodeLabel?: string | null;
}) {
  const [picked, setPicked] = useState<number[]>([]);
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);
  const [sending, setSending] = useState(false);
  const answered = !!result;

  const toggle = (i: number) => {
    if (answered || sending) return;
    if (quiz.multi) setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));
    else setPicked([i]);
  };

  const submit = async (idk = false) => {
    if (sending || answered) return;
    setSending(true);
    try {
      await onAnswer(idk ? { idk: true, note: note || undefined } : { selected: picked, note: note || undefined });
    } finally {
      setSending(false);
    }
  };

  // Keyboard: 1-3 / A-C pick, Enter answers, ? or 0 is "I don't know".
  const active = !answered && !disabled && !sending;
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      const idx = /^[1-3]$/.test(k) ? Number(k) - 1 : /^[a-c]$/.test(k) ? k.charCodeAt(0) - 97 : -1;
      if (idx >= 0 && idx < quiz.options.length) {
        e.preventDefault();
        toggle(idx);
      } else if (e.key === 'Enter' && picked.length > 0) {
        e.preventDefault();
        void submit(false);
      } else if (k === '?' || k === '0') {
        e.preventDefault();
        void submit(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, picked, quiz.options.length, quiz.multi]);

  const tone =
    result?.result === 'correct'
      ? 'border-moss-400/40'
      : result?.result === 'incorrect'
        ? 'border-rust-400/40'
        : answered
          ? 'border-ink-600'
          : 'border-gold-500/30 shadow-[0_30px_60px_-40px_rgba(0,0,0,0.9)]';

  return (
    <div className={`animate-fade-up rounded-[18px] border ${tone} bg-ink-900/85 backdrop-blur px-6 py-5 md:px-7 md:py-6`}>
      <div className="flex items-center gap-2.5 mb-4">
        <span className="h-1.5 w-1.5 rounded-full bg-gold-500" />
        <span className="eyebrow">Quiz{nodeLabel ? ` · checks ${nodeLabel}` : ''}</span>
        {result && (
          <span
            className={`ml-auto inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.16em] uppercase ${
              result.result === 'correct' ? 'text-moss-400' : result.result === 'incorrect' ? 'text-rust-400' : 'text-ink-300'
            }`}
          >
            {result.result === 'correct' ? <Check size={12} /> : result.result === 'incorrect' ? <X size={12} /> : null}
            {result.result === 'correct' ? 'Correct' : result.result === 'incorrect' ? 'Not quite' : "Didn't know"}
          </span>
        )}
      </div>
      <div className="mb-4 [&_.prose]:text-[1.06rem] [&_.prose]:text-ink-100">
        <Markdown text={quiz.question} />
      </div>
      <div className="grid gap-2">
        {quiz.options.map((opt, i) => {
          const isPicked = picked.includes(i) || (result?.selected.includes(i) ?? false);
          const isCorrect = result?.correct.includes(i) ?? false;
          let cls = 'hairline hover:border-ink-500 hover:bg-ink-850';
          if (!answered && isPicked) cls = 'border-gold-500 bg-gold-500/8';
          if (answered) {
            if (isCorrect) cls = 'border-moss-400/70 bg-moss-400/8';
            else if (isPicked) cls = 'border-rust-400/70 bg-rust-400/8';
            else cls = 'border-ink-800 opacity-55';
          }
          return (
            <button
              key={i}
              type="button"
              disabled={answered || sending || disabled}
              onClick={() => toggle(i)}
              className={`text-left rounded-xl border px-4 py-3 transition-colors flex gap-3.5 items-start disabled:cursor-default bg-ink-850/50 ${cls}`}
            >
              <span className={`font-mono text-[11px] mt-[7px] w-3 shrink-0 ${!answered && isPicked ? 'text-gold-500' : 'text-ink-500'}`}>{LETTERS[i]}</span>
              <span className="flex-1 [&_.prose]:text-[0.98rem] [&_.prose]:leading-relaxed [&_.prose]:text-ink-100">
                <Markdown text={opt} />
              </span>
              {answered && isCorrect && <Check size={15} className="text-moss-400 mt-1.5 shrink-0" />}
              {answered && !isCorrect && isPicked && <X size={15} className="text-rust-400 mt-1.5 shrink-0" />}
            </button>
          );
        })}
      </div>

      {!answered && disabled && <p className="mt-4 font-mono text-[11px] text-ink-500">This question is no longer active. Type below to continue.</p>}
      {!answered && !disabled && (
        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={picked.length === 0 || sending}
            onClick={() => submit(false)}
            className="h-9 rounded-full bg-gold-500 text-ink-950 px-4 text-sm font-medium hover:bg-gold-400 disabled:opacity-40 disabled:hover:bg-gold-500 transition-colors"
          >
            {sending ? 'Sending' : quiz.multi ? 'Submit selection' : 'Answer'}
          </button>
          <button
            type="button"
            disabled={sending}
            onClick={() => submit(true)}
            className="h-9 rounded-full border border-ink-600 px-4 text-sm text-ink-200 hover:border-ink-400 hover:text-ink-50 transition-colors"
          >
            I don't know
          </button>
          <span className="ml-auto flex items-center gap-4 font-mono text-[11px] text-ink-500">
            <span className="hidden sm:inline" title="Keyboard: 1, 2, 3 to pick · Enter to answer · ? for I don't know">
              <kbd className="kbd">1</kbd><kbd className="kbd">2</kbd><kbd className="kbd">3</kbd> pick · <kbd className="kbd">↵</kbd> answer
            </span>
            <button type="button" onClick={() => setShowNote((v) => !v)} className="hover:text-ink-200">
              {showNote ? 'hide note' : 'add a note'}
            </button>
          </span>
          {showNote && (
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why you chose this, or what you're unsure about. The tutor reads it."
              rows={2}
              className="basis-full mt-1 rounded-xl bg-ink-850 border hairline px-3 py-2 text-sm outline-none focus:border-ink-500 placeholder:text-ink-500"
            />
          )}
        </div>
      )}

      {result && (
        <div className="mt-5 pt-4 border-t hairline">
          {result.note && (
            <p className="font-mono text-[11px] text-ink-500 mb-2">
              your note · <span className="text-ink-300 font-sans text-sm">{result.note}</span>
            </p>
          )}
          <div className="[&_.prose]:text-[0.96rem] [&_.prose]:text-ink-200">
            <Markdown text={result.explanation} />
          </div>
        </div>
      )}
    </div>
  );
}
