import { ArrowLeft, Download, FileText, Terminal, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AskCard } from '../components/AskCard';
import { Composer } from '../components/Composer';
import { ExplainCard } from '../components/ExplainCard';
import { Graph } from '../components/Graph';
import { Markdown } from '../components/Markdown';
import { OutlineRail } from '../components/OutlineRail';
import { topoOrder } from '../lib/order';
import { PhaseBar } from '../components/PhaseBar';
import { PlanCard } from '../components/PlanCard';
import { QuizCard } from '../components/QuizCard';
import { ResourceCard } from '../components/ResourceCard';
import { api } from '../lib/api';
import { describePrefs } from '../lib/prefs';
import { useLesson } from '../lib/useLesson';
import { useMaterials } from '../lib/useMaterials';
import { useVoiceMode } from '../lib/useVoiceMode';

export function LessonPage() {
  const { id } = useParams();
  const { state, send, answer, stop } = useLesson(id);
  const upload = useMaterials(id);
  const scroller = useRef<HTMLDivElement>(null);
  const [stick, setStick] = useState(true);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [vault, setVault] = useState(false);
  const external = state.lesson?.mode === 'external';
  const terminal = external && state.lesson?.answer_in === 'terminal';
  const driver = state.lesson?.driver === 'codex' ? 'codex' : 'claude code';

  useEffect(() => {
    api.stats().then((s) => setVault(s.vault)).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (stick && scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [state.items, state.status, stick]);

  const activePromptId = useMemo(() => {
    if (!state.busy) return null;
    const last = [...state.items].reverse().find((i) => i.kind === 'quiz' || i.kind === 'ask' || i.kind === 'plan' || i.kind === 'explain');
    if (!last) return null;
    if (last.kind === 'quiz') return last.result ? null : last.quiz.id;
    if (last.kind === 'ask') return last.answer === undefined ? last.ask.id : null;
    if (last.kind === 'explain') return last.answer === undefined ? last.explain.id : null;
    return last.approved === undefined ? last.plan.id : null;
  }, [state.items, state.busy]);
  const waiting = activePromptId !== null;

  /** The open card, for voice replies: what kind it is and what its options are. */
  const activeCard = useMemo(() => {
    if (!activePromptId) return null;
    for (const it of state.items) {
      if (it.kind === 'quiz' && it.quiz.id === activePromptId) return { kind: 'quiz' as const, id: it.quiz.id, options: it.quiz.options };
      if (it.kind === 'ask' && it.ask.id === activePromptId) return { kind: 'ask' as const, id: it.ask.id, options: it.ask.options };
      if (it.kind === 'explain' && it.explain.id === activePromptId) return { kind: 'explain' as const, id: it.explain.id, options: [] };
      if (it.kind === 'plan' && it.plan.id === activePromptId) return { kind: 'plan' as const, id: it.plan.id, options: [] };
    }
    return null;
  }, [state.items, activePromptId]);

  const voice = useVoiceMode({ lessonId: id, items: state.items, busy: state.busy, external, activeCard, answer, send });

  const ordered = useMemo(() => topoOrder(state.nodes), [state.nodes]);
  const timeline = useMemo(() => [...state.items].sort((a, b) => (a.at ?? 0) - (b.at ?? 0)), [state.items]);
  const labelOf = (nodeId: string | null | undefined) => (nodeId ? state.nodes.find((n) => n.id === nodeId)?.label ?? null : null);
  const indexOf = (nodeId: string) => ordered.findIndex((n) => n.id === nodeId) + 1;
  const locked = state.nodes.filter((n) => n.status === 'locked').length;
  const nextUp = ordered.filter((n) => n.status === 'pending').slice(0, 2).map((n) => n.label);

  const doExport = async () => {
    if (!id) return;
    try {
      if (vault) {
        const r = await api.exportToVault(id);
        setExportMsg(`Saved to ${r.path}`);
      } else {
        const md = await api.exportMarkdown(id);
        const blob = new Blob([md], { type: 'text/markdown' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${state.lesson?.topic ?? 'lesson'}.md`;
        a.click();
        setExportMsg('Downloaded');
      }
    } catch (e) {
      setExportMsg((e as Error).message);
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
      <header className="flex items-center gap-5 px-5 md:px-6 h-[60px] border-b hairline shrink-0">
        <Link to="/" className="text-ink-400 hover:text-ink-50 transition-colors" title="All lessons">
          <ArrowLeft size={18} strokeWidth={1.8} />
        </Link>
        <h1 className="font-serif text-[22px] tracking-[-0.01em] truncate text-ink-50">{state.lesson?.topic ?? '…'}</h1>
        {external && (
          <span
            className="hidden md:inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.16em] uppercase text-ink-400 border hairline rounded-full px-2.5 h-6"
            title={terminal ? 'Cards are answered in your terminal; answering here works too' : 'Cards are answered here in the browser'}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${state.connected ? 'bg-moss-400' : 'bg-ink-600'}`} />
            companion · {driver}
            {terminal && (
              <>
                <span className="text-ink-600">·</span>
                <Terminal size={11} strokeWidth={2} />
                answers in terminal
              </>
            )}
          </span>
        )}
        <div className="ml-auto hidden md:block">
          <PhaseBar phase={state.phase} />
        </div>
        <div className="flex items-center gap-5 md:ml-4">
          {state.nodes.length > 0 && (
            <span className="flex items-baseline gap-1.5">
              <span className="font-serif text-[26px] leading-none text-gold-500">{locked}</span>
              <span className="font-mono text-[11px] text-ink-500">/ {state.nodes.length} locked</span>
            </span>
          )}
          {voice.supported.speak && (
            <button
              type="button"
              onClick={voice.toggle}
              className={`inline-flex items-center gap-1.5 transition-colors ${voice.enabled ? 'text-gold-500' : 'text-ink-400 hover:text-ink-50'}`}
              title={
                voice.enabled
                  ? 'Voice mode is on: the tutor is read aloud and the microphone opens for your reply. Click to switch off.'
                  : voice.supported.listen
                    ? 'Voice mode: hear the tutor, answer by speaking'
                    : 'Read the tutor aloud (dictation needs Chrome)'
              }
            >
              {voice.enabled ? <Volume2 size={15} strokeWidth={1.8} /> : <VolumeX size={15} strokeWidth={1.8} />}
              <span className="hidden sm:inline font-mono text-[11px]">{voice.enabled ? (voice.listening ? 'listening' : voice.speaking ? 'speaking' : 'voice on') : 'voice'}</span>
            </button>
          )}
          <button type="button" onClick={doExport} className="inline-flex items-center gap-1.5 text-ink-400 hover:text-ink-50 transition-colors" title={vault ? 'Save to Obsidian vault' : 'Download markdown'}>
            {vault ? <FileText size={15} strokeWidth={1.8} /> : <Download size={15} strokeWidth={1.8} />}
            <span className="hidden sm:inline font-mono text-[11px]">{exportMsg ?? (vault ? 'to vault' : 'export')}</span>
          </button>
          <span className={`h-1.5 w-1.5 rounded-full ${state.connected ? 'bg-moss-400' : 'bg-rust-400'}`} title={state.connected ? 'live' : 'reconnecting'} />
        </div>
      </header>

      <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[232px_minmax(0,1fr)_452px] lg:grid-cols-[minmax(0,1fr)_420px]">
        <aside className="hidden xl:block border-r hairline min-h-0 overflow-y-auto scroll-thin">
          <OutlineRail nodes={state.nodes} goal={state.lesson?.goal ?? null} materials={state.materials} uploading={upload.uploading} />
        </aside>

        <section className="relative min-h-0 flex flex-col">
          <div
            ref={scroller}
            onScroll={(e) => {
              const el = e.currentTarget;
              setStick(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
            }}
            className="flex-1 overflow-y-auto scroll-thin px-5 md:px-12 pt-8"
          >
            <div className="mx-auto max-w-[680px] space-y-6">
              {timeline.map((it) => {
                switch (it.kind) {
                  case 'user':
                    return (
                      <div key={it.seq} className="flex justify-end animate-fade-up">
                        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-ink-800 border hairline px-4 py-2.5 text-[15px] whitespace-pre-wrap text-ink-100">
                          {it.text}
                          {it.source === 'terminal' && <span className="block font-mono text-[10px] text-ink-500 mt-1">from your terminal</span>}
                          {it.source === 'browser' && external && <span className="block font-mono text-[10px] text-ink-500 mt-1">from this page · the tutor reads it at its next turn</span>}
                        </div>
                      </div>
                    );
                  case 'assistant':
                    return (
                      <div key={it.id} className={`animate-fade-up ${it.streaming ? 'caret' : ''}`}>
                        <Markdown text={it.text} streaming={it.streaming} />
                      </div>
                    );
                  case 'quiz':
                    return <QuizCard key={it.quiz.id} quiz={it.quiz} result={it.result} nodeLabel={labelOf(it.quiz.node_id)} onAnswer={(a) => answer(it.quiz.id, a)} disabled={it.quiz.id !== activePromptId} />;
                  case 'ask':
                    return <AskCard key={it.ask.id} ask={it.ask} answer={it.answer} onAnswer={(t) => answer(it.ask.id, { text: t })} disabled={it.ask.id !== activePromptId} />;
                  case 'explain':
                    return (
                      <ExplainCard key={it.explain.id} explain={it.explain} answer={it.answer} nodeLabel={labelOf(it.explain.node_id)} onAnswer={(t) => answer(it.explain.id, { text: t })} disabled={it.explain.id !== activePromptId} />
                    );
                  case 'plan':
                    return <PlanCard key={it.plan.id} plan={it.plan} approved={it.approved} feedback={it.feedback} onRespond={(a) => answer(it.plan.id, a)} disabled={it.plan.id !== activePromptId} />;
                  case 'phase':
                    return (
                      <div key={it.seq} className="flex items-center gap-4 py-1">
                        <span className="h-px flex-1 bg-ink-800" />
                        <span className="eyebrow">{it.phase}</span>
                        <span className="h-px flex-1 bg-ink-800" />
                      </div>
                    );
                  case 'node_start': {
                    const summary = state.nodes.find((n) => n.id === it.id)?.summary;
                    return (
                      <div key={it.seq} className="animate-fade-up flex items-start gap-3.5 pt-4">
                        <span className="font-serif text-[40px] leading-none text-ink-600">{String(indexOf(it.id) || it.index).padStart(2, '0')}</span>
                        <span className="min-w-0 pt-1">
                          <span className="eyebrow text-teal-400">now</span>
                          <span className="block font-serif text-[1.35rem] leading-tight text-ink-50 mt-0.5">{it.label}</span>
                          {summary && <span className="block mt-1 text-[13.5px] leading-[1.45] text-ink-400 text-pretty max-w-[56ch]">{summary}</span>}
                        </span>
                      </div>
                    );
                  }
                  case 'node':
                    return (
                      <div key={it.seq} className={`animate-fade-up inline-flex items-center gap-2.5 font-mono text-[11px] tracking-[0.08em] rounded-full px-3 h-7 border ${it.status === 'locked' ? 'border-gold-500/40 text-gold-500 bg-gold-500/5' : 'border-rust-400/40 text-rust-400'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${it.status === 'locked' ? 'bg-gold-500' : 'bg-rust-400'}`} />
                        {it.status === 'locked' ? 'locked' : 'shaky'} · {it.label}
                      </div>
                    );
                  case 'complete':
                    return (
                      <div key={`complete-${it.seq}`} className="animate-fade-up rounded-[18px] border border-gold-500/40 bg-gold-500/[0.04] px-6 py-6 md:px-7 md:py-7 mt-2">
                        <div className="eyebrow text-gold-500 mb-3">The click</div>
                        <p className="font-serif text-[1.9rem] leading-[1.12] tracking-[-0.01em] text-ink-50 text-balance">
                          {it.locked} of {it.total} nodes locked. Every one derived from the ones below it.
                        </p>
                        <p className="mt-3 font-serif italic text-[1.15rem] leading-snug text-ink-300 text-pretty">{it.goal}</p>
                        <dl className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-y-4 gap-x-6">
                          {[
                            [String(it.quizzes), 'questions answered'],
                            [`${it.quizzes ? Math.round((100 * it.correct) / it.quizzes) : 0}%`, 'first try'],
                            [String(it.caught), it.caught === 1 ? 'misconception caught' : 'misconceptions caught'],
                            [`${it.minutes} min`, 'from probe to click'],
                          ].map(([n, l]) => (
                            <div key={l}>
                              <dt className="font-serif text-[1.7rem] leading-none text-gold-500">{n}</dt>
                              <dd className="mt-1 font-mono text-[10.5px] tracking-[0.06em] text-ink-500">{l}</dd>
                            </div>
                          ))}
                        </dl>
                        <p className="mt-5 pt-4 border-t border-gold-500/20 font-mono text-[11px] text-ink-400">
                          first review {it.reviewDays === 1 ? 'tomorrow' : `in ${it.reviewDays} days`}, with new questions · every node now lives in your <Link to="/atlas" className="text-ink-100 hover:text-gold-500">atlas</Link>
                        </p>
                      </div>
                    );
                  case 'memory':
                    return (
                      <div key={it.seq} className="animate-fade-up font-mono text-[11px] text-ink-500">
                        noted · <span className="font-sans text-[13px] text-ink-300">{it.fact}</span>
                      </div>
                    );
                  case 'preferences':
                    return (
                      <div key={`p-${it.seq}`} className="animate-fade-up font-mono text-[11px] text-ink-500">
                        how you learn · <span className="font-sans text-[13px] text-ink-300">{describePrefs(it.prefs)}</span> ·{' '}
                        <Link to="/you" className="text-ink-300 hover:text-gold-500">edit</Link>
                      </div>
                    );
                  case 'material':
                    return (
                      <div key={`m-${it.seq}`} className="animate-fade-up font-mono text-[11px] text-ink-500">
                        {it.removed ? 'removed' : 'attached'} · <span className="font-sans text-[13px] text-ink-300">{it.name}</span>
                        {!it.removed && ` · ${it.pages} ${it.unit}${it.pages === 1 ? '' : 's'}`}
                      </div>
                    );
                  case 'resource':
                    return <ResourceCard key={`r-${it.seq}`} resource={it.resource} nodeLabel={labelOf(it.resource.node_id)} />;
                  case 'error':
                    return (
                      <div key={it.seq} className="rounded-xl border border-rust-400/40 bg-rust-400/5 px-4 py-3 text-sm text-rust-400">
                        {it.text}
                      </div>
                    );
                }
              })}
              {state.busy && state.status && !waiting && (
                <div className="flex items-center gap-2.5 text-sm text-ink-400 animate-fade-up">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-gold-500 opacity-60 animate-ping" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-gold-500" />
                  </span>
                  {state.status}
                </div>
              )}
              <div className="h-6" />
            </div>
          </div>
          <div className="shrink-0 px-5 md:px-12 pb-5 pt-3 bg-gradient-to-t from-ink-950 via-ink-950/95 to-transparent">
            <div className="mx-auto max-w-[680px]">
              {upload.error && <p className="mb-2 text-sm text-rust-400">{upload.error}</p>}
              {voice.error && <p className="mb-2 text-sm text-rust-400">{voice.error}</p>}
              <Composer
                onSend={send}
                onStop={stop}
                onAttach={(f) => void upload.add(f)}
                onAttachRepo={(s) => void upload.addRepo(s)}
                attaching={upload.uploading.length > 0}
                busy={state.busy}
                waiting={waiting}
                external={external}
                terminal={terminal}
                voice={
                  voice.enabled && voice.supported.listen
                    ? { supported: true, listening: voice.listening, speaking: voice.speaking, dictation: voice.dictation, toggleListening: voice.toggleListening }
                    : undefined
                }
              />
            </div>
          </div>
        </section>

        <aside className="hidden lg:flex flex-col min-h-0 border-l hairline bg-ink-900/50">
          <div className="h-[46px] px-5 border-b hairline flex items-center justify-between">
            <span className="eyebrow">Dependency map</span>
            <Legend />
          </div>
          <div className="flex-1 min-h-0">
            <Graph nodes={state.nodes} />
          </div>
          <div className="px-5 py-3.5 border-t hairline flex items-baseline gap-2.5 min-h-[46px]">
            {nextUp.length > 0 ? (
              <>
                <span className="eyebrow">Next</span>
                <span className="text-[13px] text-ink-300 truncate">{nextUp.join(' · then ')}</span>
              </>
            ) : state.lesson?.goal ? (
              <>
                <span className="eyebrow">Goal</span>
                <span className="text-[13px] text-ink-300 truncate">{state.lesson.goal}</span>
              </>
            ) : (
              <span className="font-mono text-[11px] text-ink-500">
                {state.verified > 0 ? `${state.verified} fact${state.verified === 1 ? '' : 's'} verified on the web` : 'facts are verified before they are taught'}
              </span>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-3.5 font-mono text-[10px] text-ink-500">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full border border-ink-600 box-border" /> pending
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full border border-teal-400 box-border" /> teaching
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-gold-500" /> locked
      </span>
    </div>
  );
}
