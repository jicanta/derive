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
    <div className="animate-fade-up rounded-2xl border border-gold-600/40 bg-ink-900/80 backdrop-blur p-5 md:p-6">
      <div className="flex items-center gap-2 mb-3 text-[11px] uppercase tracking-[0.18em] text-ink-400">
        <span className="h-1.5 w-1.5 rounded-full bg-gold-500" />
        The plan
        {decided && <span className="ml-auto normal-case tracking-normal text-xs text-ink-300">{approved ? 'Approved' : 'Sent back'}</span>}
      </div>
      <h3 className="font-serif text-2xl text-ink-50 leading-tight mb-4">{plan.goal}</h3>

      <div className="grid gap-3 sm:grid-cols-3 text-sm">
        <Column title="Ground truths" items={truths.map((n) => n.label)} dot="bg-gold-500" />
        <Column title="Derived steps" items={derived.map((n) => n.label)} dot="bg-ink-300" />
        <Column title="Goal" items={goal ? [goal.label] : []} dot="bg-teal-400" />
      </div>
      <p className="mt-3 text-xs text-ink-400">The full dependency map is drawn on the right. It fills in as each node locks.</p>

      {!decided && (
        <div className="mt-4 flex flex-wrap gap-2 items-center">
          <button
            type="button"
            disabled={sending || disabled}
            onClick={() => respond(true)}
            className="rounded-full bg-gold-500 text-ink-950 px-4 py-1.5 text-sm font-medium hover:bg-gold-400 disabled:opacity-40 transition-colors"
          >
            Looks right, teach me
          </button>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="rounded-full border border-ink-600 px-4 py-1.5 text-sm text-ink-300 hover:border-ink-400 hover:text-ink-100 transition-colors"
          >
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
                placeholder="What should change? (e.g. I already know X, skip it; go deeper on Y)"
                className="flex-1 rounded-xl bg-ink-850 border border-ink-700 px-4 py-2.5 text-sm outline-none focus:border-gold-600/60 placeholder:text-ink-500"
              />
              <button type="submit" disabled={!text.trim() || sending} className="rounded-xl bg-ink-100 text-ink-950 px-4 text-sm font-medium disabled:opacity-40">
                Send back
              </button>
            </form>
          )}
        </div>
      )}
      {decided && feedback && <p className="mt-3 text-sm text-ink-300 italic font-serif text-lg">"{feedback}"</p>}
    </div>
  );
}

function Column({ title, items, dot }: { title: string; items: string[]; dot: string }) {
  return (
    <div className="rounded-xl bg-ink-850/70 border border-ink-800 p-3">
      <div className="text-[11px] uppercase tracking-[0.16em] text-ink-400 mb-2">{title}</div>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2 text-ink-100">
            <span className={`mt-[7px] h-1.5 w-1.5 rounded-full shrink-0 ${dot}`} />
            <span>{it}</span>
          </li>
        ))}
        {items.length === 0 && <li className="text-ink-500">none</li>}
      </ul>
    </div>
  );
}
