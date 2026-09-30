import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import type { ProviderStatus, ProviderView } from '../lib/types';

const field = 'w-full rounded-xl border hairline bg-ink-900/70 px-3 text-[14px] leading-relaxed text-ink-100 outline-none focus:border-gold-500/60 placeholder:text-ink-500';
const pill = 'inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.16em] uppercase text-ink-400 border hairline rounded-full px-2.5 h-6';

/** The dot before a status pill: moss where something is there, ink where nothing is, and a pulse only while the pass is still looking. */
const dotOf = (status: ProviderStatus): string =>
  status === 'checking'
    ? 'bg-ink-500 animate-pulse motion-reduce:animate-none'
    : status === 'not configured'
      ? 'bg-ink-600'
      : status === 'set from environment'
        ? 'bg-ink-400'
        : 'bg-moss-400';

const PROVIDER_LOCK = 'DERIVE_BACKEND is set in your environment, so the provider cannot be changed here. Unset it to choose one.';

/**
 * One provider on the settings page: its status pill, its model field saving
 * on blur or Enter with a saved tick, and the one action that makes it the
 * tutor. Every fact it shows comes from the row the API painted; the row is
 * a quiet card, gold while it is the one teaching.
 */
export function ProviderRow({
  row,
  active,
  providerLocked,
  defaultsAsOf,
  onChange,
  onUse,
}: {
  row: ProviderView;
  active: boolean;
  providerLocked: string | null;
  defaultsAsOf: string;
  onChange: (row: ProviderView) => void;
  onUse: () => Promise<void>;
}) {
  const effective = row.model ?? row.default_model ?? '';
  const [model, setModel] = useState(effective);
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [err, setErr] = useState<string | null>(null);
  const [using, setUsing] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [useErr, setUseErr] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const useTimer = useRef<number | null>(null);

  useEffect(() => setModel(effective), [effective]);
  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
      if (useTimer.current) window.clearTimeout(useTimer.current);
    },
    [],
  );

  const tick = (ref: { current: number | null }, set: (s: 'idle' | 'saved') => void) => {
    set('saved');
    if (ref.current) window.clearTimeout(ref.current);
    ref.current = window.setTimeout(() => set('idle'), 1800);
  };

  const save = async () => {
    const value = model.trim();
    if (value === effective) return;
    setState('saving');
    setErr(null);
    try {
      onChange(await api.setProvider(row.id, { model: value }));
      tick(timer, setState);
    } catch (e) {
      setErr((e as Error).message);
      setState('idle');
    }
  };

  const use = async () => {
    setUsing('saving');
    setUseErr(null);
    try {
      await onUse();
      tick(useTimer, setUsing);
    } catch (e) {
      setUseErr((e as Error).message);
      setUsing('idle');
    }
  };

  const unusable = row.status === 'not configured' || row.status === 'checking';
  const useTitle = providerLocked ? PROVIDER_LOCK : unusable ? 'Nothing to use yet: log in or paste a key first' : undefined;

  return (
    <div className={`rounded-[18px] border px-5 py-4 md:px-6 md:py-5 ${active ? 'border-gold-500/30 bg-gold-500/[0.035]' : 'border-ink-100/12 bg-ink-900/70'}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[14px] font-medium text-ink-100">{row.label}</span>
        <span className={pill}>
          <span className={`h-1.5 w-1.5 rounded-full ${dotOf(row.status)}`} />
          {row.status}
        </span>
        <div className="ml-auto">
          {active ? (
            <span className={pill}>
              <span className="h-1.5 w-1.5 rounded-full bg-gold-500" />
              teaching now
            </span>
          ) : row.teaches ? (
            <button
              type="button"
              onClick={() => void use()}
              disabled={unusable || !!providerLocked || using === 'saving'}
              title={useTitle}
              className="h-9 rounded-lg bg-gold-500 text-ink-950 px-3.5 text-[14px] font-medium disabled:opacity-40 transition-opacity"
            >
              Use this provider
            </button>
          ) : null}
        </div>
      </div>
      <p className="mt-2 text-[14px] leading-relaxed text-ink-500">{row.note}</p>
      {useErr && <p className="mt-2 text-[14px] leading-relaxed text-rust-400">{useErr}</p>}
      {using === 'saved' && <p className="mt-2 font-mono text-[10px] text-gold-500">saved · applies from the next turn of every lesson</p>}

      <div className="mt-3 flex flex-col gap-2 md:grid md:grid-cols-2 md:gap-4">
        <div className="min-w-0 md:col-start-2">
          <div className="flex items-center gap-2">
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              onBlur={() => void save()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
              }}
              disabled={!!row.model_locked || state === 'saving'}
              placeholder="model id"
              aria-label={`${row.label} model`}
              spellCheck={false}
              autoComplete="off"
              className={`${field} font-mono h-10`}
            />
            {row.model_locked && (
              <span className={`${pill} shrink-0`}>
                <span className="h-1.5 w-1.5 rounded-full bg-ink-400" />
                set from environment
              </span>
            )}
          </div>
          {row.model_locked ? (
            <p className="mt-2 text-[14px] leading-relaxed text-ink-500">Set by {row.model_locked} in your environment. Unset it to choose a model here.</p>
          ) : err ? (
            <p className="mt-2 text-[14px] leading-relaxed text-rust-400">{err}</p>
          ) : state === 'saved' ? (
            <p className="mt-2 font-mono text-[10px] text-gold-500">saved · applies from the next turn</p>
          ) : state === 'saving' ? (
            <p className="mt-2 font-mono text-[10px] text-ink-500">saving</p>
          ) : row.default_model && model.trim() === row.default_model ? (
            <p className="mt-2 font-mono text-[10px] text-ink-500">default as of {defaultsAsOf}</p>
          ) : row.id === 'codex' && model.trim() === '' ? (
            <p className="mt-2 font-mono text-[10px] text-ink-500">Codex's own default applies</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
