import { useEffect, useMemo, useState } from 'react';
import { orderIndex } from '../lib/order';
import type { PlanPayload } from '../lib/types';

export function PlanCard({
  plan,
  approved,
  feedback,
  onRespond,
  disabled,
}: {
  plan: PlanPayload;
  approved?: boolean;
  feedback?: string | null;
  onRespond: (a: { approved: boolean; feedback?: string }) => Promise<unknown>;
  disabled?: boolean;
}) {
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(false);
  const [sending, setSending] = useState(false);
  const decided = approved !== undefined;

  const respond = async (ok: boolean) => {
    if (sending || decided) return;
    setSending(true);
    try {
      await onRespond({ approved: ok, feedback: text.trim() || undefined });
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (decided || disabled || editing) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT')) return;
      if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        void respond(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decided, disabled, editing, sending]);

  const order = useMemo(() => orderIndex(plan.nodes.map((n) => ({ ...n, depends_on: n.depends_on ?? [], status: 'pending' as const }))), [plan.nodes]);
  const withIndex = plan.nodes.map((n) => ({ ...n, index: order.get(n.id) ?? 0 })).sort((a, b) => a.index - b.index);
  const truths = withIndex.filter((n) => n.kind === 'truth');
  const derived = withIndex.filter((n) => n.kind === 'derived');
  const goal = withIndex.find((n) => n.kind === 'goal');

  return (
    <div className="animate-fade-up rounded-[18px] border border-gold-500/30 bg-ink-900/85 backdrop-blur px-6 py-5 md:px-7 md:py-6 shadow-[0_30px_60px_-40px_rgba(0,0,0,0.9)]">
      <div className="flex items-center gap-2.5 mb-4">
        <span className="h-1.5 w-1.5 rounded-full bg-gold-500" />
        <span className="eyebrow">The plan</span>
        {decided && <span className="ml-auto font-mono text-[10px] tracking-[0.16em] uppercase text-ink-300">{approved ? 'Approved' : 'Sent back'}</span>}
      </div>
      <h3 className="font-serif text-[1.7rem] leading-[1.15] text-ink-50 mb-5 text-balance">{plan.goal}</h3>

      <div className="grid gap-3 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Column title="Ground truths" hint="accepted as-is, no caveats" items={truths} dot="bg-gold-500" />
        <Column title="Derived steps" hint="each built from the ones below it" items={goal ? [...derived, goal] : derived} dot="bg-ink-300" />
      </div>
      <p className="mt-3 font-mono text-[11px] text-ink-500">Numbered in the order they will be taught. The map on the right lights up as each one locks.</p>

      {!decided && disabled && <p className="mt-4 font-mono text-[11px] text-ink-500">This plan is no longer awaiting approval.</p>}
      {!decided && !disabled && (
        <div className="mt-4 flex flex-wrap gap-2.5 items-center">
          <button type="button" disabled={sending} onClick={() => respond(true)} className="h-9 rounded-full bg-gold-500 text-ink-950 px-4 text-sm font-medium hover:bg-gold-400 disabled:opacity-40 transition-colors">
            Looks right, teach me <kbd className="kbd ml-1.5 !text-ink-950/70 !border-ink-950/30">↵</kbd>
          </button>
          <button type="button" onClick={() => setEditing((v) => !v)} className="h-9 rounded-full border border-ink-600 px-4 text-sm text-ink-200 hover:border-ink-400 hover:text-ink-50 transition-colors">
            Change something
          </button>
          {editing && (
            <form
              className="basis-full flex gap-2 mt-1"
              onSubmit={(e) => {
                e.preventDefault();
                void respond(false);
              }}
            >
              <input
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="What should change? e.g. I already know X, skip it; go deeper on Y"
                className="flex-1 rounded-xl bg-ink-850 border hairline px-4 py-2.5 text-[15px] outline-none focus:border-gold-500/60 placeholder:text-ink-500"
              />
              <button type="submit" disabled={!text.trim() || sending} className="rounded-xl bg-ink-100 text-ink-950 px-4 text-sm font-medium disabled:opacity-40">
                Send back
              </button>
            </form>
          )}
        </div>
      )}
      {decided && feedback && <p className="mt-3 font-serif italic text-[1.15rem] text-ink-200">"{feedback}"</p>}
    </div>
  );
}

function Column({ title, hint, items, dot }: { title: string; hint: string; items: (PlanPayload['nodes'][number] & { index: number })[]; dot: string }) {
  return (
    <div className="rounded-xl bg-ink-850/70 border hairline p-3.5">
      <div className="flex items-baseline gap-2 mb-2.5">
        <span className="eyebrow">{title}</span>
        <span className="font-mono text-[10px] text-ink-600">{hint}</span>
      </div>
      <ul className="space-y-2.5">
        {items.map((n) => (
          <li key={n.id} className="flex items-start gap-2.5">
            <span className="font-mono text-[10px] text-ink-500 w-4 shrink-0 pt-[4px]">{String(n.index).padStart(2, '0')}</span>
            <span className={`mt-[7px] h-1.5 w-1.5 rounded-full shrink-0 ${n.kind === 'goal' ? 'bg-teal-400' : dot}`} />
            <span className="min-w-0">
              <span className={`block text-[14.5px] leading-snug ${n.kind === 'goal' ? 'font-serif italic text-[16px] text-ink-50' : 'text-ink-50'}`}>{n.label}</span>
              {n.summary && <span className="block mt-0.5 text-[12.5px] leading-[1.45] text-ink-400 text-pretty">{n.summary}</span>}
            </span>
          </li>
        ))}
        {items.length === 0 && <li className="text-ink-500 text-sm">none</li>}
      </ul>
    </div>
  );
}
