import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { api } from '../lib/api';
import type { ProviderStatus, ProviderView } from '../lib/types';

const field = 'w-full rounded-xl border hairline bg-ink-900/70 px-3 text-[14px] leading-relaxed text-ink-100 outline-none focus:border-gold-500/60 placeholder:text-ink-500 disabled:opacity-60';
const pill = 'inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.16em] uppercase text-ink-400 border hairline rounded-full px-2.5 h-6';
const textButton = 'font-mono text-[10px] text-ink-400 hover:text-ink-50 transition-colors focus-visible:text-ink-50 focus-visible:underline disabled:opacity-40';
const tickLine = 'mt-2 font-mono text-[10px] text-gold-500';
const errLine = 'mt-2 text-[14px] leading-relaxed text-rust-400';
const noteLine = 'mt-2 text-[14px] leading-relaxed text-ink-500';

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
const REMOVED = 'Removed. It stays hidden from logs and events until Derive restarts.';

/** Blur the input on Enter so the one save path (onBlur) runs; the form has no submit. */
const blurOnEnter = (e: KeyboardEvent<HTMLInputElement>) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    e.currentTarget.blur();
  }
};

/** A saved tick that shows for 1800 ms and then goes away; one timer per field, cleared on unmount. */
function useTick(): [boolean, () => void] {
  const [on, setOn] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );
  const tick = () => {
    setOn(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOn(false), 1800);
  };
  return [on, tick];
}

/**
 * The key field of one row. The value goes one way: typed here, sent on blur
 * or Enter, and never seen again — the row comes back as `{ set, hint }` and
 * the field turns into dots plus the last four characters. Replacing is the
 * same input with a way back; removing is a second inline step, no dialog;
 * an environment key locks the field and names its variable. There is no
 * reveal toggle, by decision.
 */
function KeyField({ row, onChange }: { row: ProviderView; onChange: (row: ProviderView) => void }) {
  const key = row.key;
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, tick] = useTick();
  const removedTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (removedTimer.current) window.clearTimeout(removedTimer.current);
    },
    [],
  );

  /** Back to the masked hint with the stored key untouched: the `keep the current key` button and Escape. */
  const keep = () => {
    setReplacing(false);
    setValue('');
    setErr(null);
  };

  const save = async () => {
    const v = value.trim();
    if (!v) return;
    setSaving(true);
    setErr(null);
    try {
      onChange(await api.setProvider(row.id, { key: v }));
      setValue('');
      setReplacing(false);
      setRemoved(false);
      tick();
    } catch (e) {
      // The typed value stays so the learner can fix it, and only the server's sentence says what was wrong.
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setErr(null);
    try {
      await api.removeKey(row.id);
      setConfirming(false);
      onChange({ ...row, key: { set: false, hint: null, locked: null }, status: row.status === 'key set' ? 'not configured' : row.status });
      setRemoved(true);
      if (removedTimer.current) window.clearTimeout(removedTimer.current);
      removedTimer.current = window.setTimeout(() => setRemoved(false), 5000);
    } catch (e) {
      setConfirming(false);
      setErr((e as Error).message);
    }
  };

  if (!key) return null;

  const eyebrow = row.key_optional ? <div className="mb-1.5 font-mono text-[10px] tracking-[0.16em] uppercase text-ink-500">optional key</div> : null;

  if (key.locked) {
    return (
      <div className="min-w-0">
        {eyebrow}
        <div className="flex items-center h-10">
          <span className={pill}>
            <span className="h-1.5 w-1.5 rounded-full bg-ink-400" />
            set from environment
          </span>
        </div>
        <p className={noteLine}>Set by {key.locked} in your environment. Unset it to store a key here.</p>
      </div>
    );
  }

  if (key.set && !replacing) {
    return (
      <div className="min-w-0">
        {eyebrow}
        <div
          className="flex items-center gap-3 h-10 flex-wrap"
          onKeyDown={(e) => {
            if (e.key === 'Escape' && confirming) setConfirming(false);
          }}
        >
          <span className="font-mono text-[10px] text-ink-300">{key.hint ? `•••• •••• ${key.hint}` : '•••• ••••'}</span>
          {confirming ? (
            <span className="flex items-center gap-2 font-mono text-[10px] text-ink-600">
              <button type="button" onClick={() => void remove()} className="font-mono text-[10px] text-rust-400 hover:text-rust-300 transition-colors focus-visible:underline">
                remove the key
              </button>
              ·
              <button type="button" onClick={() => setConfirming(false)} className={textButton}>
                keep
              </button>
            </span>
          ) : (
            <span className="flex items-center gap-2 font-mono text-[10px] text-ink-600">
              <button type="button" onClick={() => setReplacing(true)} className={textButton}>
                replace
              </button>
              ·
              <button type="button" onClick={() => setConfirming(true)} className={`${textButton} hover:text-rust-400 focus-visible:text-rust-400`}>
                remove
              </button>
            </span>
          )}
        </div>
        {err ? <p className={errLine}>{err}</p> : saved ? <p className={tickLine}>saved · applies from the next turn</p> : null}
      </div>
    );
  }

  return (
    <div className="min-w-0">
      {eyebrow}
      <div className="flex items-center gap-2">
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => void save()}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && replacing) {
              e.preventDefault();
              keep();
              return;
            }
            blurOnEnter(e);
          }}
          disabled={saving}
          placeholder={replacing ? 'Paste the new key' : 'Paste a key · saved when you leave the field'}
          aria-label={`${row.label} API key`}
          autoComplete="off"
          spellCheck={false}
          className={`${field} h-10`}
        />
        {replacing && (
          // Mouse-down is swallowed so the input does not blur (and save what was typed) on the way to the button that means "do not save".
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={keep} className={`${textButton} shrink-0`}>
            keep the current key
          </button>
        )}
      </div>
      {err ? (
        <p className={errLine}>{err}</p>
      ) : saving ? (
        <p className="mt-2 font-mono text-[10px] text-ink-500">saving</p>
      ) : removed ? (
        <p className={noteLine}>{REMOVED}</p>
      ) : null}
    </div>
  );
}

/**
 * Where a local server or an OpenAI-compatible endpoint is reached. Empty
 * means the catalogue default, which the placeholder shows; a bad address is
 * refused with the server's own sentence and the typed value stays. When
 * OLLAMA_HOST locks the address the input shows where the row is probed and
 * cannot be edited.
 */
function BaseUrlField({ row, onChange }: { row: ProviderView; onChange: (row: ProviderView) => void }) {
  const stored = row.base_url ?? '';
  const [value, setValue] = useState(stored);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, tick] = useTick();

  useEffect(() => setValue(stored), [stored]);

  const save = async () => {
    const v = value.trim();
    if (v === stored) return;
    setSaving(true);
    setErr(null);
    try {
      onChange(await api.setProvider(row.id, { base_url: v }));
      tick();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-w-0 md:col-span-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => void save()}
        onKeyDown={blurOnEnter}
        disabled={!!row.base_url_locked || saving}
        placeholder={row.base_url_default ?? 'https://…'}
        aria-label={`${row.label} base URL`}
        spellCheck={false}
        autoComplete="off"
        className={`${field} font-mono h-10`}
      />
      {row.base_url_locked ? (
        <p className={noteLine}>Set by {row.base_url_locked} in your environment. Unset it to change the address here.</p>
      ) : err ? (
        <p className={errLine}>{err}</p>
      ) : saved ? (
        <p className={tickLine}>saved · applies from the next turn</p>
      ) : null}
    </div>
  );
}

/**
 * One provider on the settings page: its status pill, its key field, its
 * model field saving on blur or Enter with a saved tick, the base URL where
 * one applies, and the one action that makes it the tutor. Every fact it
 * shows comes from the row the API painted; the row is a quiet card, gold
 * while it is the one teaching.
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
  const takesBaseUrl = row.auth === 'key+url' || row.port !== null;

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
      {useErr && <p className={errLine}>{useErr}</p>}
      {using === 'saved' && <p className={tickLine}>saved · applies from the next turn of every lesson</p>}

      <div className="mt-3 flex flex-col gap-2 md:grid md:grid-cols-2 md:gap-4">
        {row.key && <KeyField row={row} onChange={onChange} />}
        <div className="min-w-0 md:col-start-2">
          <div className="flex items-center gap-2">
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              onBlur={() => void save()}
              onKeyDown={blurOnEnter}
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
            <p className={noteLine}>Set by {row.model_locked} in your environment. Unset it to choose a model here.</p>
          ) : err ? (
            <p className={errLine}>{err}</p>
          ) : state === 'saved' ? (
            <p className={tickLine}>saved · applies from the next turn</p>
          ) : state === 'saving' ? (
            <p className="mt-2 font-mono text-[10px] text-ink-500">saving</p>
          ) : row.default_model && model.trim() === row.default_model ? (
            <p className="mt-2 font-mono text-[10px] text-ink-500">default as of {defaultsAsOf}</p>
          ) : row.id === 'codex' && model.trim() === '' ? (
            <p className="mt-2 font-mono text-[10px] text-ink-500">Codex's own default applies</p>
          ) : null}
        </div>
        {takesBaseUrl && <BaseUrlField row={row} onChange={onChange} />}
      </div>
    </div>
  );
}
