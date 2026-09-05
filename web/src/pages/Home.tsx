import { ArrowRight, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { LessonSummary, Stats } from '../lib/types';

const SUGGESTIONS = [
  'Why does gradient descent work?',
  'What is a monad, really?',
  'How does TCP make an unreliable network reliable?',
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
  const hasHistory = !!stats && (stats.lessons > 0 || stats.due > 0);

  return (
    <div className="min-h-full overflow-y-auto scroll-thin bg-[radial-gradient(900px_520px_at_12%_10%,rgba(232,176,75,0.09),transparent_62%)]">
      <div className={`mx-auto px-6 md:px-[72px] pt-14 md:pt-16 pb-16 grid gap-x-20 gap-y-14 ${hasHistory ? 'max-w-[1440px] lg:grid-cols-[minmax(0,1fr)_520px]' : 'max-w-[980px]'}`}>
        <div className="flex flex-col min-h-[calc(100vh-8rem)]">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="eyebrow text-ink-300">Derive</span>
            <span className="eyebrow ml-auto hidden sm:inline">Runs on your Claude subscription</span>
          </div>

          <h1 className="font-serif text-[3.2rem] md:text-[5.25rem] leading-[0.98] tracking-[-0.02em] text-ink-50 mt-16 md:mt-24 max-w-[16ch] text-balance">
            Understand it from the ground up, <em className="text-gold-500">not memorize it.</em>
          </h1>
          <p className="mt-7 max-w-[56ch] text-[17px] md:text-lg leading-relaxed text-ink-300">
            Derive finds the edge of what you already know, draws the dependency map from unconditional truths to your goal, and teaches one node at a time. It does not move on until each one locks.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void start(topic);
            }}
            className="mt-12 flex items-center gap-4 h-[66px] pl-5 pr-2.5 rounded-[18px] border border-ink-100/16 bg-ink-900/85 shadow-[0_40px_80px_-50px_rgba(232,176,75,0.35)] focus-within:border-gold-500/50 transition-colors"
          >
            <span className="font-mono text-lg text-gold-500">›</span>
            <input
              autoFocus
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="What do you want to actually understand?"
              className="flex-1 bg-transparent font-serif text-[1.35rem] md:text-2xl outline-none placeholder:text-ink-400 text-ink-50 min-w-0"
            />
            <button
              type="submit"
              disabled={!topic.trim() || starting}
              className="inline-flex items-center gap-2.5 h-[46px] px-[18px] rounded-[13px] bg-gold-500 text-[#17130b] font-semibold text-sm hover:bg-gold-400 disabled:opacity-40 transition-colors"
            >
              {starting ? 'Starting' : 'Start'} <ArrowRight size={14} strokeWidth={2.2} />
            </button>
          </form>
          {err && <p className="mt-2 text-sm text-rust-400">{err}</p>}

          <div className="mt-7 grid sm:grid-cols-2 gap-x-10 max-w-[640px]">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void start(s)}
                className="group flex items-center gap-3 py-2.5 border-b hairline text-left font-serif italic text-[1.15rem] text-ink-300 hover:text-ink-50 hover:border-gold-500/60 transition-colors"
              >
                <span className="flex-1">{s}</span>
                <span className="font-mono not-italic text-[11px] text-ink-500 group-hover:text-gold-500">→</span>
              </button>
            ))}
          </div>

          <div className="mt-auto pt-16 flex flex-wrap gap-x-7 gap-y-1 font-mono text-[11px] text-ink-500">
            <span>probe → plan → teach</span>
            <span>local · sqlite · claude agent sdk</span>
            <Link to="/atlas" className="hover:text-ink-200">atlas ↗</Link>
            <a href="https://github.com/jicanta/derive" className="ml-auto text-gold-600 hover:text-gold-400">github.com/jicanta/derive</a>
          </div>
        </div>

        {hasHistory && stats && (
          <div className="flex flex-col lg:pt-[150px]">
            <div className="grid grid-cols-3 border-y border-ink-100/14">
              <div className="py-[18px] pr-4">
                <div className="eyebrow">Nodes locked</div>
                <div className="font-serif text-[52px] leading-none text-gold-500 mt-2.5">{stats.locked}</div>
              </div>
              <div className="py-[18px] px-5 border-l hairline">
                <div className="eyebrow">Accuracy</div>
                <div className="font-serif text-[52px] leading-none text-ink-50 mt-2.5">
                  {acc === null ? '–' : acc}
                  {acc !== null && <span className="text-[26px] text-ink-400">%</span>}
                </div>
              </div>
              <button type="button" onClick={review} disabled={stats.due === 0} className="py-[18px] pl-5 border-l hairline text-left group disabled:cursor-default">
                <div className={`eyebrow ${stats.due ? 'text-teal-400' : ''}`}>Due today</div>
                <div className="flex items-baseline gap-2.5 mt-2.5">
                  <div className={`font-serif text-[52px] leading-none ${stats.due ? 'text-teal-400' : 'text-ink-500'}`}>{stats.due}</div>
                  {stats.due > 0 && <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-teal-400 group-hover:underline">review ↗</span>}
                </div>
              </button>
            </div>

            <div className="mt-11 flex items-baseline justify-between">
              <span className="eyebrow">Your lessons</span>
              <Link to="/atlas" className="eyebrow hover:text-ink-100">Atlas ↗</Link>
            </div>
            <ul className="mt-2.5">
              {lessons.map((l, i) => (
                <li key={l.id} className="group grid grid-cols-[34px_minmax(0,1fr)_auto_auto] items-center gap-4 h-[62px] border-b hairline">
                  <span className="font-mono text-[11px] text-ink-500">{String(i + 1).padStart(2, '0')}</span>
                  <Link to={`/lesson/${l.id}`} className="min-w-0">
                    <div className="font-serif text-[21px] text-ink-50 truncate group-hover:text-gold-400 transition-colors">{l.topic}</div>
                    <div className="font-mono text-[10.5px] text-ink-500 mt-0.5">
                      {l.phase} · {timeAgo(l.updated_at)}
                      {l.mode === 'external' && <span> · claude code</span>}
                      {l.busy && <span className="text-teal-400"> · live</span>}
                      {l.shaky > 0 && <span className="text-rust-400"> · {l.shaky} shaky</span>}
                    </div>
                  </Link>
                  <div className="hidden sm:flex gap-[3px]">
                    {[...Array(Math.min(l.nodes, 12))].map((_, k) => (
                      <span key={k} className={`h-3.5 w-[5px] rounded-[2px] ${k < l.locked ? 'bg-gold-500' : 'bg-ink-700'}`} />
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    {l.nodes > 0 && (
                      <span className="font-mono text-[11px] text-ink-400 w-10 text-right">
                        <span className="text-gold-500">{l.locked}</span>/{l.nodes}
                      </span>
                    )}
                    <button
                      type="button"
                      title="Delete lesson"
                      onClick={() => {
                        if (confirm(`Delete "${l.topic}"?`)) api.deleteLesson(l.id).then(refresh);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-ink-500 hover:text-rust-400 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export function Logo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <path d="M50 34 L27 66 M50 34 L73 66" stroke="#efe9dc" strokeWidth="6" strokeLinecap="round" />
      <circle cx="50" cy="24" r="11" fill="#e8b04b" />
      <circle cx="27" cy="76" r="11" fill="#efe9dc" />
      <circle cx="73" cy="76" r="11" fill="#efe9dc" />
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
  return `${Math.floor(h / 24)}d ago`;
}
