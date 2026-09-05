import { ArrowLeft, Download, FileText, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AskCard } from '../components/AskCard';
import { Composer } from '../components/Composer';
import { Graph } from '../components/Graph';
import { Markdown } from '../components/Markdown';
import { PhaseBar } from '../components/PhaseBar';
import { PlanCard } from '../components/PlanCard';
import { QuizCard } from '../components/QuizCard';
import { api } from '../lib/api';
import { useLesson } from '../lib/useLesson';

export function LessonPage() {
  const { id } = useParams();
  const { state, send, answer, stop } = useLesson(id);
  const scroller = useRef<HTMLDivElement>(null);
  const [stick, setStick] = useState(true);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [vault, setVault] = useState(false);

  useEffect(() => {
    api.stats().then((s) => setVault(s.vault)).catch(() => undefined);
  }, []);

  // Auto-scroll while the user is at the bottom.
  useEffect(() => {
    if (stick && scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [state.items, state.status, stick]);

  const waiting = useMemo(() => {
    const last = [...state.items].reverse().find((i) => i.kind === 'quiz' || i.kind === 'ask' || i.kind === 'plan');
    if (!last) return false;
    if (last.kind === 'quiz') return !last.result;
    if (last.kind === 'ask') return last.answer === undefined;
    return last.approved === undefined;
  }, [state.items]);

  const locked = state.nodes.filter((n) => n.status === 'locked').length;

  const doExport = async () => {
    if (!id) return;
    if (vault) {
      try {
        const r = await api.exportToVault(id);
        setExportMsg(`Saved to ${r.path}`);
      } catch (e) {
        setExportMsg((e as Error).message);
      }
    } else {
      const md = await api.exportMarkdown(id);
      const blob = new Blob([md], { type: 'text/markdown' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${state.lesson?.topic ?? 'lesson'}.md`;
      a.click();
      setExportMsg('Downloaded');
    }
    setTimeout(() => setExportMsg(null), 3000);
  };

  if (state.error) {
    return (
      <div className="h-full grid place-items-center">
        <div className="text-center">
          <p className="text-rust-400">{state.error}</p>
          <Link to="/" className="text-ink-300 underline mt-2 inline-block">
            Back home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <header className="flex items-center gap-4 px-4 md:px-6 h-14 border-b border-ink-800 shrink-0">
        <Link to="/" className="text-ink-400 hover:text-ink-100 transition-colors" title="All lessons">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="font-serif text-xl truncate text-ink-50">{state.lesson?.topic ?? '…'}</h1>
        <div className="ml-auto hidden md:block">
          <PhaseBar phase={state.phase} />
        </div>
        <div className="flex items-center gap-3 text-xs text-ink-400">
          {state.nodes.length > 0 && (
            <span className="tabular-nums">
              <span className="text-gold-400">{locked}</span>/{state.nodes.length} locked
            </span>
          )}
          <button type="button" onClick={doExport} className="inline-flex items-center gap-1.5 hover:text-ink-100 transition-colors" title={vault ? 'Save to Obsidian vault' : 'Download markdown'}>
            {vault ? <FileText size={14} /> : <Download size={14} />}
            <span className="hidden sm:inline">{exportMsg ?? (vault ? 'To vault' : 'Export')}</span>
          </button>
          {state.connected ? <Wifi size={14} className="text-moss-400" /> : <WifiOff size={14} className="text-rust-400" />}
        </div>
      </header>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(320px,38%)]">
        <section className="relative min-h-0 flex flex-col">
          <div
            ref={scroller}
            onScroll={(e) => {
              const el = e.currentTarget;
              setStick(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
            }}
            className="flex-1 overflow-y-auto scroll-thin px-4 md:px-8 py-6"
          >
            <div className="mx-auto max-w-[720px] space-y-5">
              {state.items.map((it) => {
                switch (it.kind) {
                  case 'user':
                    return (
                      <div key={it.seq} className="flex justify-end animate-fade-up">
                        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-ink-800 border border-ink-700 px-4 py-2.5 text-[15px] whitespace-pre-wrap">{it.text}</div>
                      </div>
                    );
                  case 'assistant':
                    return (
                      <div key={it.id} className={`animate-fade-up ${it.streaming ? 'caret' : ''}`}>
                        <Markdown text={it.text} streaming={it.streaming} />
                      </div>
                    );
                  case 'quiz':
                    return <QuizCard key={it.quiz.id} quiz={it.quiz} result={it.result} onAnswer={(a) => answer(it.quiz.id, a)} disabled={!state.busy} />;
                  case 'ask':
                    return <AskCard key={it.ask.id} ask={it.ask} answer={it.answer} onAnswer={(t) => answer(it.ask.id, { text: t })} disabled={!state.busy} />;
                  case 'plan':
                    return (
                      <PlanCard key={it.plan.id} plan={it.plan} approved={it.approved} feedback={it.feedback} onRespond={(a) => answer(it.plan.id, a)} disabled={!state.busy} />
                    );
                  case 'phase':
                    return (
                      <div key={it.seq} className="flex items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-ink-500 py-1">
                        <span className="h-px flex-1 bg-ink-800" />
                        {it.phase}
                        <span className="h-px flex-1 bg-ink-800" />
                      </div>
                    );
                  case 'node':
                    return (
                      <div key={it.seq} className={`animate-fade-up inline-flex items-center gap-2 text-xs rounded-full px-3 py-1 border ${it.status === 'locked' ? 'border-gold-600/50 text-gold-400 bg-gold-500/5' : 'border-rust-500/50 text-rust-400'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${it.status === 'locked' ? 'bg-gold-500' : 'bg-rust-400'}`} />
                        {it.status === 'locked' ? 'Locked in' : 'Shaky'} · {it.label}
                      </div>
                    );
                  case 'error':
                    return (
                      <div key={it.seq} className="rounded-xl border border-rust-500/40 bg-rust-500/5 px-4 py-3 text-sm text-rust-400">
                        {it.text}
                      </div>
                    );
                }
              })}
              {state.busy && state.status && (
                <div className="flex items-center gap-2 text-sm text-ink-400 animate-fade-up">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-gold-500 opacity-60 animate-ping" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-gold-500" />
                  </span>
                  {state.status}
                </div>
              )}
              <div className="h-4" />
            </div>
          </div>
          <div className="shrink-0 px-4 md:px-8 pb-4 pt-2 bg-gradient-to-t from-ink-950 via-ink-950 to-transparent">
            <div className="mx-auto max-w-[720px]">
              <Composer onSend={send} onStop={stop} busy={state.busy} waiting={waiting} />
            </div>
          </div>
        </section>

        <aside className="hidden lg:flex flex-col min-h-0 border-l border-ink-800 bg-ink-900/40">
          <div className="px-5 py-3 border-b border-ink-800 flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Dependency map</span>
            <Legend />
          </div>
          <div className="flex-1 min-h-0">
            <Graph nodes={state.nodes} />
          </div>
          {state.lesson?.goal && (
            <div className="px-5 py-3 border-t border-ink-800 text-sm text-ink-300">
              <span className="text-ink-500">Goal · </span>
              {state.lesson.goal}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-3 text-[11px] text-ink-400">
      <span className="inline-flex items-center gap-1">
        <span className="h-2 w-2 rounded-sm border border-ink-500" /> pending
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="h-2 w-2 rounded-sm border border-teal-400" /> teaching
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="h-2 w-2 rounded-sm bg-gold-500" /> locked
      </span>
    </div>
  );
}
