import { Download, FileText, Terminal, Volume2, VolumeX } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AskCard } from '../components/AskCard';
import { Composer } from '../components/Composer';
import { ExplainCard } from '../components/ExplainCard';
import { Graph } from '../components/Graph';
import { KeyHelp } from '../components/KeyHelp';
import { Markdown } from '../components/Markdown';
import { OutlineRail } from '../components/OutlineRail';
import { PageHeader } from '../components/PageHeader';
import { topoOrder } from '../lib/order';
import { PhaseBar } from '../components/PhaseBar';
import { PlanCard } from '../components/PlanCard';
import { QuizCard } from '../components/QuizCard';
import { ResourceCard } from '../components/ResourceCard';
import { api } from '../lib/api';
import { removeHtmlAttr, setHtmlAttr } from '../lib/htmlAttr';
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
  const [help, setHelp] = useState(false);
  const [focus, setFocus] = useState(false);
  const external = state.lesson?.mode === 'external';
  const terminal = external && state.lesson?.answer_in === 'terminal';
  const driver = state.lesson?.driver === 'codex' ? 'codex cli' : 'claude code';
  // What the last turn ran on, never what Settings currently says; the catalogue id reads as words.
  const tutorLabel = state.tutor ? `${state.tutor.provider.replace(/-/g, ' ')} · ${state.tutor.model ?? 'default model'}` : '';

  useEffect(() => {
    api.stats().then((s) => setVault(s.vault)).catch(() => undefined);
  }, []);

  /**
   * What this lesson has cost, for the pill: the server's own string, seeded on
   * load and replaced when a turn settles.
   *
   * It is kept here rather than on `useLesson`'s state on purpose. A cost value
   * in the reducer needs an `EVENT_TYPES` entry to arrive, and from there it
   * would reach the SQLite event log, the SSE replay and the learner's Obsidian
   * notes — none of which is a record of what they know. `state.lastCost` is
   * one turn's figure and is deliberately not read here: rendering it where a
   * lesson total is promised would read `about $0.03` on a lesson that has cost
   * $0.40.
   *
   * There is no timer and no poll: it is read once on load — including when a
   * turn is already in flight, so opening a busy lesson still shows what it has
   * cost so far — and again when `busy` goes false, which *is* the turn ending.
   * A turn in flight therefore shows the previous settled total and holds still
   * until it finishes, and a failed turn leaves that total standing: the failure
   * is carried by the error card, not by the pill.
   */
  const [cost, setCost] = useState<string | null>(null);
  const settled = !state.busy;
  useEffect(() => {
    if (!id) return;
    let live = true;
    api
      .lesson(id)
      .then((d) => {
        if (live) setCost(d.cost);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [id, settled]);

  useEffect(() => {
    if (stick && scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [state.items, state.status, stick]);

  /** Whether the timeline still shows that card as unanswered. */
  const unanswered = useCallback(
    (promptId: string) =>
      state.items.some(
        (i) =>
          (i.kind === 'quiz' && i.quiz.id === promptId && !i.result) ||
          (i.kind === 'ask' && i.ask.id === promptId && i.answer === undefined) ||
          (i.kind === 'explain' && i.explain.id === promptId && i.answer === undefined) ||
          (i.kind === 'plan' && i.plan.id === promptId && i.approved === undefined),
      ),
    [state.items],
  );

  const activePromptId = useMemo(() => {
    // The server's prompts table is where openness lives, so the card it names
    // is read first and is live whether or not a turn is running. That is a
    // card restored after a restart: the `!state.busy` fall-back below is the
    // line that used to render it inert, and it is the one LEARN-12 turns on.
    // The timeline still has the last word on whether it was answered, so a
    // seeded card the learner has since settled does not linger.
    if (state.pending && unanswered(state.pending.id)) return state.pending.id;
    if (!state.busy) return null;
    const last = [...state.items].reverse().find((i) => i.kind === 'quiz' || i.kind === 'ask' || i.kind === 'plan' || i.kind === 'explain');
    if (!last) return null;
    if (last.kind === 'quiz') return last.result ? null : last.quiz.id;
    if (last.kind === 'ask') return last.answer === undefined ? last.ask.id : null;
    if (last.kind === 'explain') return last.answer === undefined ? last.explain.id : null;
    return last.approved === undefined ? last.plan.id : null;
  }, [state.items, state.busy, state.pending, unanswered]);
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

  /**
   * What focus mode leaves of the timeline: the open card plus the one tutor
   * block immediately above it, which is the whole of what the learner is
   * supposed to be thinking about. With no card open it is the last tutor
   * block alone; with neither, nothing, and the quiet line renders instead.
   *
   * It is a filter over the same items, rendered by the same switch, so every
   * card keeps its React key across the toggle and `animate-fade-up` is not
   * re-triggered — the card must not flash on entering focus.
   */
  const focused = useMemo(() => {
    if (!focus) return timeline;
    const idOf = (it: (typeof timeline)[number]) =>
      it.kind === 'quiz' ? it.quiz.id : it.kind === 'ask' ? it.ask.id : it.kind === 'explain' ? it.explain.id : it.kind === 'plan' ? it.plan.id : null;
    const at = activePromptId ? timeline.findIndex((it) => idOf(it) === activePromptId) : -1;
    if (at < 0) {
      const last = [...timeline].reverse().find((it) => it.kind === 'assistant');
      return last ? [last] : [];
    }
    const above = [...timeline.slice(0, at)].reverse().find((it) => it.kind === 'assistant');
    return above ? [above, timeline[at]] : [timeline[at]];
  }, [focus, timeline, activePromptId]);

  /**
   * The posture itself, written through the one helper rather than inline, so
   * Phase 6's theme, accent, font and size extend a single seam. Removed when
   * focus goes off and again on unmount, so leaving the lesson clears it —
   * and because nothing is persisted, so does a reload.
   */
  useEffect(() => {
    if (focus) setHtmlAttr('data-focus');
    else removeHtmlAttr('data-focus');
    return () => removeHtmlAttr('data-focus');
  }, [focus]);
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

  /**
   * The lesson's own keys, and the one place Escape is decided.
   *
   * The guard order is the one every keydown handler in this codebase uses —
   * bail inside a text field or a contenteditable, bail on a modifier — so a
   * question mark typed into the composer or a teach-back stays prose.
   *
   * Escape has one documented order, evaluated top-down: the help overlay if
   * it is open, else focus mode if it is on, else the turn in flight. The last
   * step calls the same `stop` the composer's own button does rather than a
   * second implementation of stopping, so Escape is never more destructive
   * than the visible control.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '?') {
        e.preventDefault();
        setHelp((v) => !v);
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setFocus((v) => !v);
      } else if (e.key === 'Escape') {
        if (help) {
          e.preventDefault();
          setHelp(false);
        } else if (focus) {
          e.preventDefault();
          setFocus(false);
        } else if (state.busy) {
          e.preventDefault();
          void stop().catch(() => undefined);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [help, focus, state.busy]);

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
      {/* The strip that replaces the hidden header, so focus always says how to leave. */}
      {focus && (
        <div role="status" className="h-7 shrink-0 grid place-items-center font-mono text-[10px] tracking-[0.16em] uppercase text-ink-500">
          focus · esc to leave
        </div>
      )}
      {/* The header's own focus-hidden marker now lives on the shared component, unconditionally; the two asides below keep theirs. */}
      <PageHeader
        to="/"
        title={state.lesson?.topic ?? '…'}
        right={
          <>
            <div className="hidden md:block min-w-0">
              <PhaseBar phase={state.phase} />
            </div>
            <div className="flex items-center gap-5">
              {state.nodes.length > 0 && (
                <span className="flex items-baseline gap-1.5 min-w-0">
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
          </>
        }
      >
        {!external && state.tutor && (
          // Still md-only, deliberately: below 768px the lesson header carries
          // no cost figure at all and Home is where a phone learner reads it.
          // A second, narrower pill would put two elements on the screen where
          // the decision asked for one, so this is accepted rather than fixed.
          <Link
            to="/settings"
            className="hidden md:inline-flex min-w-0 items-center gap-1.5 font-mono text-[10px] tracking-[0.16em] uppercase text-ink-400 hover:text-ink-50 border hairline rounded-full px-2.5 h-6 transition-colors"
            title="Which model is teaching. Change it in Settings; it applies from the next turn."
          >
            <span className="min-w-0 max-w-[40ch] truncate" title={tutorLabel}>
              {tutorLabel}
            </span>
            {cost && (
              <>
                <span className="text-ink-600">·</span>
                {/* The model id absorbs every pixel lost and the cost never truncates: four honest words about money are worth more than the tail of a slug. It inherits the pill's grey — gold is for what the learner achieved, not for a price. */}
                <span className="shrink-0 whitespace-nowrap">{cost}</span>
              </>
            )}
          </Link>
        )}
        {external && (
          <span
            className="hidden md:inline-flex min-w-0 items-center gap-2 font-mono text-[10px] tracking-[0.16em] uppercase text-ink-400 border hairline rounded-full px-2.5 h-6"
            title={terminal ? 'Cards are answered in your terminal; answering here works too' : 'Cards are answered here in the browser'}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${state.connected ? 'bg-moss-400' : 'bg-ink-600'}`} />
            companion · {driver} · terminal model
            {terminal && (
              <>
                <span className="text-ink-600">·</span>
                <Terminal size={11} strokeWidth={2} />
                answers in terminal
              </>
            )}
          </span>
        )}
      </PageHeader>

      {/* The columns are swapped from state, not just hidden: display:none on a child does not collapse a declared track, so without this the focused card would keep its old width and sit offset left with an empty gutter on the right. */}
      <div className={`flex-1 min-h-0 grid ${focus ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-[232px_minmax(0,1fr)_452px] lg:grid-cols-[minmax(0,1fr)_420px]'}`}>
        <aside data-focus-hide className="hidden xl:block border-r hairline min-h-0 overflow-y-auto scroll-thin">
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
              {/* Reserved for the neither-present case, so it never appears above a card the learner can answer. */}
              {focus && focused.length === 0 && <p className="font-mono text-[11px] text-ink-500">Nothing to focus on yet. Esc to leave.</p>}
              {focused.map((it) => {
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
                  case 'warmup':
                    return (
                      <div key={it.seq} className="animate-fade-up rounded-[14px] border border-teal-400/25 bg-teal-400/5 px-5 py-4">
                        <span className="eyebrow text-teal-400">warm-up · due from earlier lessons</span>
                        <p className="mt-1.5 text-[13.5px] leading-[1.5] text-ink-300 text-pretty max-w-[60ch]">
                          Retrieval first, on the forgetting curve: {it.nodes.length === 1 ? 'one node is' : `${it.nodes.length} nodes are`} due and get a fresh question each before anything new.
                        </p>
                        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-ink-400">
                          {it.nodes.map((n) => (
                            <li key={n.id}>
                              <span className="text-ink-100">{n.label}</span> <span className="text-ink-500">· {n.topic}</span>
                            </li>
                          ))}
                        </ul>
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
                  case 'notice':
                    // The quiet mono shape the memory and preferences lines
                    // use, deliberately not the rust error card: a notice is a
                    // fact about the lesson, and nothing failed.
                    return (
                      <div key={`n-${it.seq}`} className="animate-fade-up font-mono text-[11px] text-ink-500">
                        {it.text}
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
                      <div key={it.seq} className="rounded-xl border border-rust-400/40 bg-rust-400/5 px-4 py-3 text-sm text-rust-400 max-w-[62ch] break-words">
                        {withNextStepLink(it.text)}
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

        <aside data-focus-hide className="hidden lg:flex flex-col min-h-0 border-l hairline bg-ink-900/50">
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

      {/* One overlay for the page, reading whichever card is open. There is no
          card to be a sibling of in the nothing-open state, which the contract
          still gives rows for, so the lesson level is the only mount that can
          serve it. */}
      {help && <KeyHelp kind={activeCard?.kind ?? null} options={activeCard?.options.length ?? 0} onClose={() => setHelp(false)} />}
    </div>
  );
}

/**
 * The two words an error sentence may carry as its one next step, in the order
 * they are checked, with where each leads.
 *
 * `Settings` is checked first and the order is load-bearing, not incidental.
 * The two refusals have different fixes and the UI-SPEC is explicit that
 * conflating them is wrong: the num_ctx refusal is fixed on the model's own row
 * in Settings (`… Raise the model's context window in Settings (num_ctx) …`),
 * and the lesson-growth refusal is fixed by a review lesson started from Home
 * (`… start a review lesson on these nodes from Home.`). A learner sent to Home
 * to raise a context window finds nothing there to raise. Checking `Settings`
 * first also means a sentence that somehow named both would link the one whose
 * fix is on this turn rather than the one whose fix is next session.
 */
const NEXT_STEPS = [
  { word: 'Settings', to: '/settings' },
  { word: 'Home', to: '/' },
] as const;

/**
 * An error sentence with its one next step made reachable: whichever of the two
 * words above the sentence actually carries becomes the card's only link, once.
 *
 * There is deliberately no button, and the reason is recorded here so a future
 * reader does not "fix" it by adding one: `api.startReview()` builds a review
 * lesson from the due queue across every lesson, not from this lesson's nodes,
 * so a button labelled "start a review lesson on these nodes" would review
 * whatever happens to be due — which may not include a single node of the lesson
 * that just refused. Naming the step and letting the learner go there is the
 * only version that is literally true today. The num_ctx card is the same
 * shape for the same kind of reason: Derive cannot raise the window itself.
 *
 * Every other error string reaching this card — an exhausted retry's provider
 * sentence, a tool-dropping refusal — carries neither word, so it renders
 * exactly as it did before: the split is once, on a literal word, or not at all.
 */
function withNextStepLink(text: string) {
  for (const { word, to } of NEXT_STEPS) {
    const at = text.indexOf(word);
    if (at < 0) continue;
    return (
      <>
        {text.slice(0, at)}
        <Link to={to} className="underline">
          {word}
        </Link>
        {text.slice(at + word.length)}
      </>
    );
  }
  return text;
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
