import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { errLine, resultLine, textButton } from '../components/fields';
import { LearnerMenu } from '../components/LearnerMenu';
import { api } from '../lib/api';
import type { UsageView } from '../lib/types';

/**
 * What learning has cost, for this learner, on one page.
 *
 * Reached from Settings and from nowhere else: the default UI shows the lesson
 * and the next step, and a running total is not a next step. The one sentence
 * that earns it a page is that a learner who cannot see what learning has cost
 * cannot decide which provider to learn on.
 *
 * Every figure and every label word on this page is a string the server already
 * composed — the same formatter the lesson header calls. There is no `toFixed`,
 * no `Intl.NumberFormat` and no `$` put together here, on purpose: a second
 * formatter in the browser is how two screens start disagreeing about one
 * lesson. The page's whole job is to lay the strings out and let nothing widen.
 */
export function UsagePage() {
  const [view, setView] = useState<UsageView | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setErr(null);
    setLoading(true);
    return api
      .usage()
      .then(setView)
      .catch((e) => setErr((e as Error).message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="h-full flex flex-col">
      <header className="flex items-center gap-5 px-5 md:px-6 h-[60px] border-b hairline shrink-0">
        {/* Back to Settings rather than Home: Settings is the only way in, so it is the only way a learner expects to come out. */}
        <Link to="/settings" className="text-ink-400 hover:text-ink-50 transition-colors" title="Settings">
          <ArrowLeft size={18} strokeWidth={1.8} />
        </Link>
        <h1 className="font-serif text-[22px] tracking-[-0.01em] truncate min-w-0 text-ink-50">
          Usage <em className="text-ink-400">· what learning has cost</em>
        </h1>
        <div className="ml-auto flex items-center gap-6">
          {/* Switching learner has to refetch: the route is scoped to the learner the request resolves to, so without this the page would keep the previous learner's total, lessons and lesson links on screen under the new name. */}
          <LearnerMenu onChange={() => void load()} />
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto scroll-thin">
        <div className="mx-auto max-w-[760px] px-5 md:px-8 pt-9 pb-24">
          {loading ? (
            // One line and nothing else. A skeleton group list or a zeroed
            // total here would be a figure shown before it is known, and a
            // figure a learner is shown is a figure a learner believes. Teal
            // and pulsing, the way every other in-flight readout in this
            // codebase reads, with the reduced-motion companion the pulse
            // always travels with.
            <p role="status" className={`${resultLine} text-teal-400 animate-pulse motion-reduce:animate-none`}>
              adding up what learning has cost
            </p>
          ) : err ? (
            <>
              <p className={errLine}>{err}</p>
              <button type="button" onClick={() => void load()} className={`mt-3 ${textButton}`}>
                try again
              </button>
            </>
          ) : view && view.lessons > 0 ? (
            <>
              {/* The one emphasized figure on the page, and the only gold on
                  it. It keeps its column while the line beside it truncates,
                  so a long provider phrase never pushes the total off-screen. */}
              <div className="flex items-baseline gap-3">
                <span className="shrink-0 truncate font-serif text-[2.1rem] leading-[1.15] text-gold-500" title={view.total ?? ''}>
                  {view.total}
                </span>
                <span className="min-w-0 truncate font-mono text-[10px] text-ink-500" title={view.summary ?? ''}>
                  {view.summary}
                </span>
              </div>

              {view.groups.map((g) => (
                <section key={g.provider} className="mt-8">
                  <p className="truncate text-[14px] leading-relaxed text-ink-100" title={g.line}>
                    {g.line}
                  </p>
                  <div className="mt-3 flex flex-col gap-6">
                    {g.models.map((m) => (
                      <div key={`${g.provider}:${m.model ?? ''}`} className="min-w-0">
                        {/* A llama.cpp model id is a file path unless the
                            server was started with --alias, so the line
                            truncates and the whole value lives in the title. */}
                        <p className="truncate font-mono text-[10px] text-ink-400" title={m.line}>
                          {m.line}
                        </p>
                        <ul className="mt-2 flex flex-col gap-3">
                          {m.rows.map((l) => (
                            <li key={l.id} className="min-w-0">
                              <Link to={`/lesson/${l.id}`} className="block truncate text-[14px] leading-relaxed text-ink-300 hover:text-ink-50 transition-colors" title={l.line}>
                                {l.line}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </>
          ) : (
            <>
              <h2 className="font-serif text-[22px] tracking-[-0.01em] text-ink-50">Nothing spent yet</h2>
              <p className="mt-3 text-[14px] leading-relaxed text-ink-300 max-w-[62ch]">
                Run a lesson and its cost lands here: one line per lesson, grouped by provider and model. Local and subscription turns show tokens only — no dollar figure, because there is none.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
