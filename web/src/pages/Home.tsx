import { Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Graph } from '../components/Graph';
import { api } from '../lib/api';
import type { GraphNode, Lesson, LessonSummary, NodeRow, Stats } from '../lib/types';

const TRY = ['Why does gradient descent work?', 'How does TCP make an unreliable network reliable?', 'What is a monad, really?'];

/** Shown to a brand-new learner so the hero is never an empty box. */
const EXAMPLE: GraphNode[] = [
  { id: 'packets', label: 'All communication is packets', kind: 'truth', depends_on: [], status: 'locked' },
  { id: 'loss', label: 'Packets can be lost', kind: 'truth', depends_on: [], status: 'locked' },
  { id: 'seq', label: 'Sequence numbers give order', kind: 'derived', depends_on: ['packets'], status: 'locked' },
  { id: 'ack', label: 'Acks + retransmit recover loss', kind: 'derived', depends_on: ['loss', 'seq'], status: 'teaching' },
  { id: 'window', label: 'A window keeps the pipe full', kind: 'derived', depends_on: ['ack'], status: 'pending' },
  { id: 'goal', label: 'A reliable byte stream', kind: 'goal', depends_on: ['window'], status: 'pending' },
];

export function HomePage() {
  const nav = useNavigate();
  const [topic, setTopic] = useState('');
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<{ lesson: Lesson; nodes: GraphNode[] } | null>(null);
  const [starting, setStarting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const refresh = () => {
    api.stats().then(setStats).catch(() => undefined);
    api
      .lessons()
      .then(async (ls) => {
        setLessons(ls);
        const last = ls.find((l) => l.nodes > 0);
        if (!last) return setRecent(null);
        const d = await api.lesson(last.id);
        setRecent({ lesson: d.lesson, nodes: toGraph(d.nodes) });
      })
      .catch(() => undefined);
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
  const heroNodes = recent?.nodes ?? EXAMPLE;
  const heroLocked = useMemo(() => heroNodes.filter((n) => n.status === 'locked').length, [heroNodes]);

  return (
    <div className="min-h-full overflow-y-auto scroll-thin">
      <div className="mx-auto max-w-[1440px] px-6 md:px-14 pt-7 pb-10 flex flex-col min-h-full">
        {/* Masthead */}
        <header className="flex items-baseline justify-between pb-4 border-b border-ink-100/14">
          <div className="flex items-baseline gap-3.5">
            <span className="font-serif text-[26px] tracking-[-0.01em] text-ink-50">Derive</span>
            <span className="font-mono text-[11px] text-ink-500">v0.2</span>
          </div>
          <nav className="hidden md:flex gap-8 font-mono text-[11px] tracking-[0.06em] text-ink-400">
            <Link to="/atlas" className="hover:text-ink-50">atlas</Link>
            <a href="https://github.com/jicanta/derive#inside-claude-code" className="hover:text-ink-50">claude code plugin</a>
            <a href="https://github.com/jicanta/derive" className="hover:text-ink-50">github</a>
            <span className="text-ink-500">runs on your claude subscription</span>
          </nav>
        </header>

        {/* Hero */}
        <section className="grid lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)] gap-x-[72px] gap-y-14 pt-12 md:pt-14 flex-1">
          <div className="flex flex-col">
            <h1 className="font-serif text-[2.6rem] md:text-[3.9rem] leading-[1.02] tracking-[-0.02em] text-ink-50 text-balance">
              A tutor that finds where your understanding ends, and builds from there.
            </h1>
            <p className="mt-6 max-w-[46ch] text-[17px] leading-[1.6] text-ink-300">
              It probes until it knows what you hold and what you don't. It draws the map from unconditional truths to your goal. Then it teaches one node at a time, and will not move on until each one locks.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void start(topic);
              }}
              className="mt-12 flex items-baseline gap-4 border-b border-ink-100/40 focus-within:border-gold-500 pb-3 transition-colors"
            >
              <span className="font-mono text-xl text-gold-500">›</span>
              <input
                autoFocus
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="What do you want to actually understand?"
                disabled={starting}
                className="flex-1 min-w-0 bg-transparent font-serif text-[1.6rem] md:text-[1.9rem] leading-tight text-ink-50 outline-none placeholder:text-ink-50/90 disabled:opacity-50"
              />
              <button type="submit" disabled={!topic.trim() || starting} className="font-mono text-[11px] tracking-[0.12em] uppercase text-ink-400 hover:text-gold-500 disabled:hover:text-ink-400 transition-colors">
                {starting ? 'starting' : 'enter ↵'}
              </button>
            </form>
            {err && <p className="mt-2 text-sm text-rust-400">{err}</p>}

            <div className="mt-7">
              <div className="eyebrow mb-1">Or start from one of these</div>
              {TRY.map((t) => (
                <button key={t} type="button" onClick={() => void start(t)} className="block w-full text-left py-2.5 border-t border-ink-100/10 font-serif text-[1.2rem] text-ink-300 hover:text-ink-50 transition-colors">
                  {t}
                </button>
              ))}
            </div>

            {stats && stats.lessons > 0 && (
              <div className="mt-auto pt-10 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11px] text-ink-400">
                <span>
                  <span className="text-gold-500">{stats.locked}</span> nodes locked
                </span>
                {acc !== null && (
                  <span>
                    <span className="text-ink-100">{acc}%</span> first-try
                  </span>
                )}
                {stats.due > 0 ? (
                  <button type="button" onClick={review} className="text-teal-400 hover:underline">
                    {stats.due} due today → review
                  </button>
                ) : (
                  <span className="text-ink-500">nothing due today</span>
                )}
              </div>
            )}
          </div>

          <div className="lg:border-l border-ink-100/10 lg:pl-12 flex flex-col min-h-[520px]">
            <div className="flex items-baseline justify-between gap-6">
              <div className="min-w-0">
                <div className="eyebrow">{recent ? 'Where you left off' : 'What a lesson builds'}</div>
                <div className="font-serif text-[1.5rem] text-ink-50 mt-1.5 truncate">{recent ? recent.lesson.topic : 'How does TCP make an unreliable network reliable?'}</div>
              </div>
              <div className="font-mono text-[11px] text-ink-400 whitespace-nowrap">
                <span className="text-gold-500">{heroLocked}</span> / {heroNodes.length} locked
                {recent && (
                  <>
                    {' · '}
                    <Link to={`/lesson/${recent.lesson.id}`} className="text-ink-100 hover:text-gold-500">
                      continue →
                    </Link>
                  </>
                )}
              </div>
            </div>
            <div className="flex-1 min-h-[440px] mt-2 -ml-3">
              <Graph nodes={heroNodes} />
            </div>
            <div className="flex gap-5 font-mono text-[10px] tracking-[0.06em] text-ink-500">
              <span>■ locked</span>
              <span className="text-teal-400">◌ teaching</span>
              <span>□ pending</span>
              {!recent && <span className="ml-auto">example · your own lessons appear here</span>}
            </div>
          </div>
        </section>

        {/* Index */}
        {lessons.length > 0 && (
          <section className="mt-10">
            <div className="eyebrow mb-1.5">Your lessons</div>
            <ul>
              {lessons.map((l, i) => (
                <li key={l.id} className="group grid grid-cols-[34px_minmax(0,1fr)_auto] items-baseline gap-4 py-3.5 border-t border-ink-100/10">
                  <span className="font-mono text-[11px] text-ink-500">{String(i + 1).padStart(2, '0')}</span>
                  <Link to={`/lesson/${l.id}`} className="min-w-0 flex flex-wrap items-baseline gap-x-3">
                    <span className="font-serif text-[1.3rem] text-ink-50 group-hover:text-gold-400 transition-colors">{l.topic}</span>
                    <span className="font-mono text-[10.5px] text-ink-500">
                      {l.phase} · {timeAgo(l.updated_at)}
                      {l.mode === 'external' && ' · claude code'}
                      {l.busy && <span className="text-teal-400"> · live</span>}
                      {l.shaky > 0 && <span className="text-rust-400"> · {l.shaky} shaky</span>}
                    </span>
                  </Link>
                  <span className="flex items-baseline gap-4">
                    {l.nodes > 0 && (
                      <span className="font-mono text-[11px] text-ink-400">
                        <span className="text-gold-500">{l.locked}</span>/{l.nodes}
                      </span>
                    )}
                    <button
                      type="button"
                      title="Delete lesson"
                      onClick={() => {
                        if (confirm(`Delete "${l.topic}"?`)) api.deleteLesson(l.id).then(refresh);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-ink-500 hover:text-rust-400 transition-all self-center"
                    >
                      <Trash2 size={13} />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {lessons.length === 0 && (
          <section className="mt-12 grid sm:grid-cols-3 gap-8 border-t border-ink-100/14 pt-6">
            {[
              ['01', 'Probe', 'Graded questions, escalating until one breaks. It needs a floor and a ceiling on every strand before it plans.'],
              ['02', 'Plan', 'A dependency map: unconditional truths at the roots, your goal at the top. You approve it before anything is taught.'],
              ['03', 'Teach', 'One node at a time. Motivate, establish, connect, check. Miss twice and it backs up to what the node rests on.'],
            ].map(([n, t, d]) => (
              <div key={n}>
                <div className="flex items-baseline gap-3">
                  <span className="font-serif text-[2rem] text-ink-600 leading-none">{n}</span>
                  <span className="font-serif text-[1.35rem] text-ink-50">{t}</span>
                </div>
                <p className="mt-2 text-[14px] leading-relaxed text-ink-400">{d}</p>
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}

function toGraph(rows: NodeRow[]): GraphNode[] {
  return rows.map((r) => ({ id: r.node_id, label: r.label, kind: r.kind, summary: r.summary, depends_on: JSON.parse(r.depends_on || '[]'), status: r.status }));
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
