import { Check, HelpCircle, X } from 'lucide-react';
import { useState } from 'react';
import type { QuizPayload, QuizResultPayload } from '../lib/types';
import { Markdown } from './Markdown';

const LETTERS = 'ABC';

export function QuizCard({
  quiz,
  result,
  onAnswer,
  disabled,
}: {
  quiz: QuizPayload;
  result?: QuizResultPayload;
  onAnswer: (a: { selected?: number[]; idk?: boolean; note?: string }) => Promise<unknown>;
  disabled?: boolean;
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

  const tone =
    result?.result === 'correct' ? 'border-moss-400/50' : result?.result === 'incorrect' ? 'border-rust-500/50' : answered ? 'border-ink-500' : 'border-gold-600/40';

  return (
    <div className={`animate-fade-up rounded-2xl border ${tone} bg-ink-900/80 backdrop-blur p-5 md:p-6`}>
      <div className="flex items-center gap-2 mb-3 text-[11px] uppercase tracking-[0.18em] text-ink-400">
        <span className="h-1.5 w-1.5 rounded-full bg-gold-500" />
        Quiz
        {result && (
          <span
            className={`ml-auto inline-flex items-center gap-1 normal-case tracking-normal text-xs font-medium ${
              result.result === 'correct' ? 'text-moss-400' : result.result === 'incorrect' ? 'text-rust-400' : 'text-ink-300'
            }`}
          >
            {result.result === 'correct' ? <Check size={14} /> : result.result === 'incorrect' ? <X size={14} /> : <HelpCircle size={14} />}
            {result.result === 'correct' ? 'Correct' : result.result === 'incorrect' ? 'Not quite' : "Didn't know"}
          </span>
        )}
      </div>
      <div className="mb-4">
        <Markdown text={quiz.question} />
      </div>
      <div className="grid gap-2">
        {quiz.options.map((opt, i) => {
          const isPicked = picked.includes(i) || (result?.selected.includes(i) ?? false);
          const isCorrect = result?.correct.includes(i) ?? false;
          let cls = 'border-ink-700 hover:border-ink-500 hover:bg-ink-850';
          if (!answered && isPicked) cls = 'border-gold-500 bg-gold-500/10';
          if (answered) {
            if (isCorrect) cls = 'border-moss-400 bg-moss-400/10';
            else if (isPicked) cls = 'border-rust-500 bg-rust-500/10';
            else cls = 'border-ink-800 opacity-60';
          }
          return (
            <button
              key={i}
              type="button"
              disabled={answered || sending || disabled}
              onClick={() => toggle(i)}
              className={`text-left rounded-xl border px-4 py-3 transition-colors flex gap-3 items-start disabled:cursor-default ${cls}`}
            >
              <span className="font-mono text-xs mt-1.5 text-ink-400 w-4 shrink-0">{LETTERS[i]}</span>
              <span className="flex-1 [&_.prose]:text-[0.98rem] [&_.prose]:leading-relaxed">
                <Markdown text={opt} />
              </span>
              {answered && isCorrect && <Check size={16} className="text-moss-400 mt-1.5 shrink-0" />}
              {answered && !isCorrect && isPicked && <X size={16} className="text-rust-400 mt-1.5 shrink-0" />}
            </button>
          );
        })}
      </div>

      {!answered && disabled && <p className="mt-4 text-xs text-ink-500">This question is no longer active. Type in the box below to continue.</p>}
      {!answered && !disabled && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={picked.length === 0 || sending || disabled}
            onClick={() => submit(false)}
            className="rounded-full bg-gold-500 text-ink-950 px-4 py-1.5 text-sm font-medium hover:bg-gold-400 disabled:opacity-40 disabled:hover:bg-gold-500 transition-colors"
          >
            {sending ? 'Sending' : quiz.multi ? 'Submit selection' : 'Answer'}
          </button>
          <button
            type="button"
            disabled={sending || disabled}
            onClick={() => submit(true)}
            className="rounded-full border border-ink-600 px-4 py-1.5 text-sm text-ink-300 hover:border-ink-400 hover:text-ink-100 transition-colors"
          >
            I don't know
          </button>
          <button type="button" onClick={() => setShowNote((v) => !v)} className="ml-auto text-xs text-ink-400 hover:text-ink-200">
            {showNote ? 'Hide note' : 'Add a note'}
          </button>
          {showNote && (
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why you chose this, or what you're unsure about (optional, the tutor reads it)"
              rows={2}
              className="basis-full mt-1 rounded-xl bg-ink-850 border border-ink-700 px-3 py-2 text-sm outline-none focus:border-ink-500 placeholder:text-ink-500"
            />
          )}
        </div>
      )}

      {result && (
        <div className="mt-4 pt-4 border-t border-ink-800">
          {result.note && (
            <p className="text-xs text-ink-400 mb-2">
              Your note: <span className="text-ink-300">{result.note}</span>
            </p>
          )}
          <div className="[&_.prose]:text-[0.95rem] [&_.prose]:text-ink-200">
            <Markdown text={result.explanation} />
          </div>
        </div>
      )}
    </div>
  );
}
