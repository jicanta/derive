import { useState } from 'react';
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

  const truths = plan.nodes.filter((n) => n.kind === 'truth');
  const derived = plan.nodes.filter((n) => n.kind === 'derived');
  const goal = plan.nodes.find((n) => n.kind === 'goal');

  return (
    <div className="animate-fade-up rounded-[18px] border border-gold-500/30 bg-ink-900/85 backdrop-blur px-6 py-5 md:px-7 md:py-6 shadow-[0_30px_60px_-40px_rgba(0,0,0,0.9)]">
      <div className="flex items-center gap-2.5 mb-4">
        <span className="h-1.5 w-1.5 rounded-full bg-gold-500" />
        <span className="eyebrow">The plan</span>
        {decided && <span className="ml-auto font-mono text-[10px] tracking-[0.16em] uppercase text-ink-300">{approved ? 'Approved' : 'Sent back'}</span>}
      </div>
      <h3 className="font-serif text-[1.7rem] leading-[1.15] text-ink-50 mb-5 text-balance">{plan.goal}</h3>

      <div className="grid gap-3 sm:grid-cols-3">
        <Column title="Ground truths" items={truths.map((n) => n.label)} dot="bg-gold-500" />
        <Column title="Derived steps" items={derived.map((n) => n.label)} dot="bg-ink-300" />
        <Column title="Goal" items={goal ? [goal.label] : []} dot="bg-teal-400" />
      </div>
      <p className="mt-3 font-mono text-[11px] text-ink-500">The full dependency map is drawn on the right. It fills in as each node locks.</p>

      {!decided && disabled && <p className="mt-4 font-mono text-[11px] text-ink-500">This plan is no longer awaiting approval.</p>}
      {!decided && !disabled && (
        <div className="mt-4 flex flex-wrap gap-2.5 items-center">
          <button type="button" disabled={sending} onClick={() => respond(true)} className="h-9 rounded-full bg-gold-500 text-ink-950 px-4 text-sm font-medium hover:bg-gold-400 disabled:opacity-40 transition-colors">
            Looks right, teach me
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

function Column({ title, items, dot }: { title: string; items: string[]; dot: string }) {
  return (
    <div className="rounded-xl bg-ink-850/70 border hairline p-3.5">
      <div className="eyebrow mb-2.5">{title}</div>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2.5 text-[14px] text-ink-100">
            <span className={`mt-[7px] h-1.5 w-1.5 rounded-full shrink-0 ${dot}`} />
            <span>{it}</span>
          </li>
        ))}
        {items.length === 0 && <li className="text-ink-500 text-sm">none</li>}
      </ul>
    </div>
  );
}
