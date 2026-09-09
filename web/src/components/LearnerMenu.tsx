import { Check, ChevronDown, Pencil, Plus, Trash2, UserRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api, currentLearner, selectLearner } from '../lib/api';
import type { Learner } from '../lib/types';

/**
 * Who is learning. Each learner has their own lessons, memory,
 * misconceptions and review queue; the choice lives in this browser and
 * rides on every request.
 */
export function LearnerMenu({ onChange }: { onChange?: () => void }) {
  const [learners, setLearners] = useState<Learner[]>([]);
  const [current, setCurrent] = useState<string>('');
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  const load = () =>
    api
      .learners()
      .then((r) => {
        setLearners(r.learners);
        setCurrent(r.current);
        // A selection that no longer exists falls back to the first learner.
        if (currentLearner() && !r.learners.some((l) => l.id === currentLearner())) selectLearner('');
      })
      .catch(() => undefined);
  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pick = (id: string) => {
    selectLearner(id);
    setCurrent(id);
    setOpen(false);
    onChange?.();
  };

  const submit = async () => {
    const n = name.trim();
    if (!n) return;
    setErr(null);
    try {
      if (renaming) await api.renameLearner(renaming, n);
      else {
        const l = await api.createLearner(n);
        selectLearner(l.id);
        onChange?.();
      }
      setName('');
      setAdding(false);
      setRenaming(null);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const remove = async (l: Learner) => {
    if (!confirm(`Remove ${l.name} and ${l.lessons ?? 0} lesson${l.lessons === 1 ? '' : 's'}? This cannot be undone.`)) return;
    try {
      await api.deleteLearner(l.id);
      if (current === l.id) pick('');
      await load();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const me = learners.find((l) => l.id === current) ?? learners[0];

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Who is learning"
        className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.06em] text-ink-400 hover:text-ink-50 transition-colors"
      >
        <UserRound size={12} strokeWidth={2} />
        <span className="max-w-[14ch] truncate">{me?.name ?? '…'}</span>
        <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 z-40 w-[260px] rounded-[14px] border hairline bg-ink-900/95 backdrop-blur shadow-[0_30px_60px_-30px_rgba(0,0,0,0.9)] p-2 animate-fade-up">
          <div className="eyebrow px-2 pt-1 pb-2">Learners</div>
          <ul className="flex flex-col gap-0.5">
            {learners.map((l) => (
              <li key={l.id} className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-ink-850">
                <button type="button" onClick={() => pick(l.id)} className="flex-1 min-w-0 flex items-center gap-2 text-left">
                  <span className={`w-3 shrink-0 ${l.id === (me?.id ?? '') ? 'text-gold-500' : 'text-transparent'}`}>
                    <Check size={12} strokeWidth={2.5} />
                  </span>
                  <span className="flex-1 min-w-0 truncate text-[14px] text-ink-100">{l.name}</span>
                  <span className="font-mono text-[10px] text-ink-500 shrink-0">{l.lessons ?? 0}</span>
                </button>
                <button
                  type="button"
                  title="Rename"
                  onClick={() => {
                    setRenaming(l.id);
                    setAdding(true);
                    setName(l.name);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-ink-500 hover:text-ink-100 transition-opacity"
                >
                  <Pencil size={12} />
                </button>
                {l.id !== 'default' && (
                  <button type="button" title="Remove learner" onClick={() => void remove(l)} className="opacity-0 group-hover:opacity-100 text-ink-500 hover:text-rust-400 transition-opacity">
                    <Trash2 size={12} />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {adding ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
              className="mt-1.5 flex gap-1.5 px-1"
            >
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setAdding(false);
                    setRenaming(null);
                    setName('');
                  }
                }}
                placeholder={renaming ? 'New name' : 'Name'}
                className="flex-1 min-w-0 rounded-lg bg-ink-850 border hairline px-2.5 py-1.5 text-[13px] outline-none focus:border-ink-500 placeholder:text-ink-500"
              />
              <button type="submit" disabled={!name.trim()} className="rounded-lg bg-gold-500 text-ink-950 px-2.5 text-[12px] font-medium disabled:opacity-40">
                {renaming ? 'Save' : 'Add'}
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                setAdding(true);
                setRenaming(null);
                setName('');
              }}
              className="mt-1 w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-ink-300 hover:bg-ink-850 hover:text-ink-50"
            >
              <Plus size={12} /> New learner
            </button>
          )}
          {err && <p className="px-2 pt-1.5 text-[12px] text-rust-400">{err}</p>}
          <p className="px-2 pt-2 pb-1 font-mono text-[10px] leading-relaxed text-ink-500">Each learner has their own lessons, memory and review queue. The tutor never mixes them.</p>
        </div>
      )}
    </div>
  );
}
