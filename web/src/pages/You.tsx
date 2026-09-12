import { ArrowLeft, Check } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { LearnerMenu } from '../components/LearnerMenu';
import { api } from '../lib/api';
import { PACES, STYLES } from '../lib/prefs';
import type { Learner, LearnerPrefs } from '../lib/types';

type Draft = Required<Record<keyof LearnerPrefs, string>>;
const empty: Draft = { language: '', style: 'adaptive', pace: 'standard', background: '', how: '', examples: '' };
const toDraft = (p: LearnerPrefs): Draft => ({ ...empty, ...Object.fromEntries(Object.entries(p).filter(([, v]) => v)) });

const field = 'w-full rounded-xl border hairline bg-ink-900/70 px-3 text-[14px] leading-relaxed text-ink-100 outline-none focus:border-gold-500/60 placeholder:text-ink-500';

/**
 * How this learner wants to be taught, in their own words. The tutor reads
 * it before every lesson. The method stays fixed; the delivery follows this.
 */
export function YouPage() {
  const [me, setMe] = useState<Learner | null>(null);
  const [draft, setDraft] = useState<Draft>(empty);
  const [saved, setSaved] = useState<Draft>(empty);
  const [notes, setNotes] = useState<string[]>([]);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [err, setErr] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  const load = () =>
    api
      .profile()
      .then((r) => {
        if (!r.learner) return;
        setMe(r.learner);
        const d = toDraft(r.learner.prefs);
        setDraft(d);
        setSaved(d);
        setNotes(r.memory);
      })
      .catch((e) => setErr((e as Error).message));
  useEffect(() => {
    void load();
  }, []);

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  const save = async () => {
    if (!me || !dirty) return;
    setState('saving');
    try {
      const l = await api.setPrefs(me.id, draft);
      const d = toDraft(l.prefs);
      setSaved(d);
      setDraft(d);
      setMe(l);
      setState('saved');
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setState('idle'), 1800);
    } catch (e) {
      setErr((e as Error).message);
      setState('error');
    }
  };

  const set = (k: keyof Draft) => (v: string) => setDraft((d) => ({ ...d, [k]: v }));
  const onKey = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      void save();
    }
  };

  const name = me && me.id !== 'default' ? me.name : 'you';

  return (
    <div className="h-full flex flex-col">
      <header className="flex items-center gap-5 px-5 md:px-6 h-[60px] border-b hairline shrink-0">
        <Link to="/" className="text-ink-400 hover:text-ink-50 transition-colors">
          <ArrowLeft size={18} strokeWidth={1.8} />
        </Link>
        <h1 className="font-serif text-[22px] text-ink-50">
          How {name} learn{name === 'you' ? '' : 's'} <em className="text-ink-400">· read by the tutor before every lesson</em>
        </h1>
        <div className="ml-auto flex items-center gap-6">
          <LearnerMenu onChange={() => void load()} />
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto scroll-thin">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
          onKeyDown={onKey}
          className="mx-auto max-w-[760px] px-5 md:px-8 pt-9 pb-24"
        >
          <p className="text-[15px] leading-relaxed text-ink-300 max-w-[62ch]">
            The method is the same for everyone: probe, plan, make you try first, check every node, hint before re-deriving. What changes is how it talks to you. Say it once, here, in your words; you can also tell the tutor mid-lesson and it will save it for you.
          </p>

          <Section n="01" title="Language" hint="Leave it empty to be taught in whatever language you write in.">
            <input value={draft.language} onChange={(e) => set('language')(e.target.value)} placeholder="Spanish, English, Portuguese…" className={`${field} h-10 max-w-[320px]`} />
          </Section>

          <Section n="02" title="Style" hint="How much the tutor leads with questions versus explains.">
            <Choices options={STYLES} value={draft.style} onChange={set('style')} />
          </Section>

          <Section n="03" title="Pace" hint="How much prose each step gets. A check is never skipped, whatever you pick.">
            <Choices options={PACES} value={draft.pace} onChange={set('pace')} />
          </Section>

          <Section n="04" title="Background" hint="Who you are and what you already hold. The probe still checks; this tells it where to start.">
            <textarea value={draft.background} onChange={(e) => set('background')(e.target.value)} rows={3} placeholder="Backend developer, ten years of Python, no formal math since high school. Comfortable reading code, rusty on notation." className={`${field} py-2 resize-y`} />
          </Section>

          <Section n="05" title="How you learn" hint="What works for you and what does not. Be specific; the tutor takes this literally.">
            <textarea
              value={draft.how}
              onChange={(e) => set('how')(e.target.value)}
              rows={5}
              placeholder={'I need the concrete case before the general rule. Formulas only after I can say the idea in words. If I get something wrong, tell me plainly, do not soften it. Long analogies lose me; one sharp example lands.'}
              className={`${field} py-2 resize-y`}
            />
          </Section>

          <Section n="06" title="Examples from" hint="Domains you know well, for examples and analogies when they fit.">
            <input value={draft.examples} onChange={(e) => set('examples')(e.target.value)} placeholder="cooking, distributed systems, football tactics" className={`${field} h-10`} />
          </Section>

          <div className="mt-10 flex items-center gap-4">
            <button type="submit" disabled={!dirty || state === 'saving'} className="inline-flex items-center gap-1.5 h-9 rounded-lg bg-gold-500 text-ink-950 px-3.5 text-[13px] font-medium disabled:opacity-40 transition-opacity">
              <Check size={14} /> {state === 'saving' ? 'Saving' : 'Save'}
            </button>
            <span className="font-mono text-[11px] text-ink-500">
              {state === 'saved' ? <span className="text-gold-500">saved · applies from the next message</span> : dirty ? '⌘↵ to save' : 'up to date'}
            </span>
            {err && <span className="text-sm text-rust-400">{err}</span>}
          </div>

          {notes.length > 0 && (
            <section className="mt-16 border-t border-ink-100/14 pt-6">
              <div className="flex items-baseline gap-3">
                <span className="font-serif text-[1.35rem] text-ink-50">What the tutor has noted</span>
                <span className="font-mono text-[11px] text-ink-500">{notes.length} note{notes.length === 1 ? '' : 's'} · from lessons</span>
              </div>
              <p className="mt-1.5 text-[13px] text-ink-400 max-w-[60ch]">Its own observations, kept between lessons. If one is wrong, say so above: what you write here wins.</p>
              <ul className="mt-4 flex flex-col gap-2">
                {notes.map((n, i) => (
                  <li key={i} className="text-[14px] leading-relaxed text-ink-200 pl-4 border-l border-ink-100/20">
                    {n}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </form>
      </div>
    </div>
  );
}

function Section({ n, title, hint, children }: { n: string; title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 grid md:grid-cols-[200px_minmax(0,1fr)] gap-x-8 gap-y-3">
      <div>
        <div className="flex items-baseline gap-2.5">
          <span className="font-serif text-[1.4rem] text-ink-600 leading-none">{n}</span>
          <span className="font-serif text-[1.2rem] text-ink-50">{title}</span>
        </div>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-500">{hint}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function Choices<T extends string>({ options, value, onChange }: { options: { id: T; label: string; hint: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid sm:grid-cols-3 gap-2">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            aria-pressed={on}
            className={`text-left rounded-xl border px-3 py-2.5 transition-colors ${on ? 'border-gold-500/60 bg-gold-500/5' : 'hairline hover:border-ink-500'}`}
          >
            <span className={`block text-[13.5px] ${on ? 'text-gold-500' : 'text-ink-100'}`}>{o.label}</span>
            <span className="mt-1 block text-[12px] leading-snug text-ink-500">{o.hint}</span>
          </button>
        );
      })}
    </div>
  );
}
