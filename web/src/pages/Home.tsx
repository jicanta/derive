import { ArrowRight, RotateCcw, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { LessonSummary, Stats } from '../lib/types';

const SUGGESTIONS = [
  'Why does gradient descent work?',
  'How does TCP make an unreliable network reliable?',
  'What is a monad, really?',
  'Why does public-key cryptography work?',
  'How do transformers attend?',
  'Why is the sky blue?',
];

export function HomePage() {
  const nav = useNavigate();
  const [topic, setTopic] = useState('');
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [starting, setStarting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const refresh = () => {
    api.lessons().then(setLessons).catch(() => undefined);
    api.stats().then(setStats).catch(() => undefined);
  };
  useEffect(refresh, []);

  const start = async (t: string) => {
    if (!t.trim() || starting) return;
    setStarting(true);
    setErr(null);
    try {
      const l = await api.createLesson(t.trim());
      nav(`/lesson/${l.id}`);
    } catch (e) {
      setErr((e as Error).message);
      setStarting(false);
    }
  };

  const review = async () => {
    try {
      const l = await api.startReview();
      nav(`/lesson/${l.id}`);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const acc = stats && stats.quizzes ? Math.round((100 * stats.correct) / stats.quizzes) : null;

  return (
    <div className="min-h-full overflow-y-auto scroll-thin">
      <div className="mx-auto max-w-[880px] px-5 py-14 md:py-20">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-ink-400 mb-6">
          <Logo /> Derive
        </div>
        <h1 className="font-serif text-[2.6rem] md:text-[3.6rem] leading-[1.05] text-ink-50 tracking-[-0.01em] max-w-[16ch]">
          Understand it from the ground up, <em className="text-gold-400">not memorize it.</em>
        </h1>
        <p className="mt-5 text-ink-300 max-w-[58ch] text-[1.05rem] leading-relaxed">
          Derive finds the edge of what you already know, draws the dependency map from unconditional truths to your goal, then teaches one
          node at a time and won't move on until each one locks.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void start(topic);
          }}
          className="mt-9 flex items-center gap-2 rounded-2xl border border-ink-700 bg-ink-900 p-2 pl-5 focus-within:border-gold-600/60 transition-colors"
        >
          <input
            autoFocus
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="What do you want to actually understand?"
            className="flex-1 bg-transparent py-2.5 text-lg outline-none placeholder:text-ink-500"
          />
          <button
            type="submit"
            disabled={!topic.trim() || starting}
            className="inline-flex items-center gap-2 rounded-xl bg-gold-500 text-ink-950 px-4 py-2.5 font-medium hover:bg-gold-400 disabled:opacity-40 transition-colors"
          >
            {starting ? 'Starting' : 'Start'} <ArrowRight size={16} />
          </button>
        </form>
        {err && <p className="mt-2 text-sm text-rust-400">{err}</p>}

        <div className="mt-4 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" onClick={() => void start(s)} className="rounded-full border border-ink-800 px-3 py-1 text-sm text-ink-300 hover:border-ink-500 hover:text-ink-100 transition-colors">
              {s}
            </button>
          ))}
        </div>

        {stats && (stats.lessons > 0 || stats.due > 0) && (
          <div className="mt-14 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Nodes locked" value={stats.locked} accent />
            <Stat label="Lessons" value={stats.lessons} />
            <Stat label="Quiz accuracy" value={acc === null ? '–' : `${acc}%`} />
            <button
              type="button"
              onClick={review}
              disabled={stats.due === 0}
              className="rounded-2xl border border-ink-800 bg-ink-900/60 p-4 text-left hover:border-teal-500/60 disabled:opacity-50 disabled:hover:border-ink-800 transition-colors group"
            >
              <div className="text-[11px] uppercase tracking-[0.16em] text-ink-400 flex items-center gap-1.5">
                <RotateCcw size={12} /> Due for review
              </div>
              <div className="mt-1 font-serif text-3xl text-teal-400">{stats.due}</div>
              <div className="text-xs text-ink-500 group-hover:text-ink-300">{stats.due ? 'Start a review session' : 'Nothing due today'}</div>
            </button>
          </div>
        )}

        {lessons.length > 0 && (
          <div className="mt-12">
            <div className="text-[11px] uppercase tracking-[0.18em] text-ink-400 mb-3">Your lessons</div>
            <ul className="divide-y divide-ink-800 border-y border-ink-800">
              {lessons.map((l) => (
                <li key={l.id} className="group flex items-center gap-4 py-3">
                  <Link to={`/lesson/${l.id}`} className="flex-1 min-w-0">
                    <div className="font-serif text-xl text-ink-100 truncate group-hover:text-gold-400 transition-colors">{l.topic}</div>
                    <div className="text-xs text-ink-500 mt-0.5 flex items-center gap-2">
                      <span className="capitalize">{l.phase}</span>
                      {l.nodes > 0 && (
                        <>
                          <span>·</span>
                          <span>
                            <span className="text-gold-400">{l.locked}</span>/{l.nodes} locked
                          </span>
                        </>
                      )}
                      <span>·</span>
                      <span>{timeAgo(l.updated_at)}</span>
                      {l.busy && <span className="text-teal-400">· live</span>}
                    </div>
                  </Link>
                  {l.nodes > 0 && <MiniBar total={l.nodes} locked={l.locked} />}
                  <button
                    type="button"
                    title="Delete lesson"
                    onClick={() => {
                      if (confirm(`Delete "${l.topic}"?`)) api.deleteLesson(l.id).then(refresh);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-ink-500 hover:text-rust-400 transition-all"
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <footer className="mt-20 text-xs text-ink-500 flex flex-wrap gap-x-6 gap-y-1">
          <span>Runs locally on your Claude subscription via the Claude Agent SDK.</span>
          <a href="https://github.com/jicanta/derive" className="hover:text-ink-300">
            Source
          </a>
        </footer>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-ink-800 bg-ink-900/60 p-4">
      <div className="text-[11px] uppercase tracking-[0.16em] text-ink-400">{label}</div>
      <div className={`mt-1 font-serif text-3xl ${accent ? 'text-gold-400' : 'text-ink-100'}`}>{value}</div>
    </div>
  );
}

function MiniBar({ total, locked }: { total: number; locked: number }) {
  return (
    <div className="hidden sm:flex gap-0.5">
      {[...Array(total)].map((_, i) => (
        <span key={i} className={`h-4 w-1.5 rounded-sm ${i < locked ? 'bg-gold-500' : 'bg-ink-700'}`} />
      ))}
    </div>
  );
}

function Logo() {
  return (
    <svg width="18" height="18" viewBox="0 0 100 100" aria-hidden>
      <circle cx="50" cy="22" r="12" fill="#f0c674" />
      <circle cx="25" cy="78" r="12" fill="#ece7dd" />
      <circle cx="75" cy="78" r="12" fill="#ece7dd" />
      <path d="M50 34 L25 66 M50 34 L75 66" stroke="#ece7dd" strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
