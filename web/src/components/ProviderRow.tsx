import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import type { CapabilityResult, ProviderStatus, ProviderView, TeachingTest, TestResult } from '../lib/types';
import { blurOnEnter, errLine, field, noteLine, pill, resultLine, textButton, tickLine, useTick } from './fields';

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

/** The one line a test answers with: the count and latency in green, or the provider's sentence as it came. A login has no list, so it reads logged in. */
const resultText = (r: TestResult): string => (r.ok ? (r.models === null ? `Logged in · ${r.ms} ms` : `Connected · ${r.models} models · ${r.ms} ms`) : r.error);

/** How many ids the last fetch brought back, as the line under the combobox says it. */
const fetchedText = (n: number): string => (n === 0 ? '0 models fetched · type an id' : n === 1 ? '1 model fetched' : `${n} models fetched`);

/**
 * The one line a capability read answers with. A refusal is the server-side
 * sentence verbatim — the component composes no refusal of its own and carries
 * no list of what a model can do. Silence says so plainly rather than claiming
 * either answer, because a model whose server does not say is still a model
 * the learner may use.
 */
const capabilityText = (r: CapabilityResult): string => {
  if (!r.ok) return r.error;
  if (!r.selectable) return r.refusal ?? `${r.model} cannot run the method`;
  return r.definitive ? `${r.model} can run the method · ${r.ms} ms` : `${r.model} · the server does not say whether it can call tools`;
};

/**
 * The one line the teaching proof answers with. The prefix and the latency are
 * the composition; the reason is the server's sentence verbatim, whether it is
 * one of Derive's three or the learner's own server's words.
 */
const teachingText = (r: TeachingTest): string => (r.ok ? `Pass · taught one node and passed one graded quiz · ${r.ms} ms` : `Fail · ${r.reason}`);

/**
 * The key field of one row. The value goes one way: typed here, sent on blur
 * or Enter, and never seen again — the row comes back as `{ set, hint }` and
 * the field turns into dots plus the last four characters. Replacing is the
 * same input with a way back; removing is a second inline step, no dialog;
 * an environment key locks the field and names its variable. There is no
 * reveal toggle, by decision.
 *
 * Exported, and parameterised on the two writes rather than on a provider row,
 * because the web-search card stores a key the same way and a second copy of
 * this machine would be a second place to lose the `keep` button's
 * mouse-down guard. It is the one exception to one component per file: it
 * belongs beside the row it was written for, and `fields.ts` holds no JSX.
 */
export function KeyField({
  value: key,
  label,
  optional = false,
  save: write,
  remove: forget,
}: {
  /** The key as the API paints it: set or not, the last four characters when it is long enough, and the environment variable that locks the field. The value is never in it. */
  value: { set: boolean; hint: string | null; locked: string | null };
  /** What the field is called, for its label and the sentences about it. */
  label: string;
  /** True where the key is optional: the field carries an `optional key` eyebrow. */
  optional?: boolean;
  /** Store the typed key. A refusal throws the server's sentence, which is shown with the typed value left in the field. */
  save: (key: string) => Promise<void>;
  /** Forget the stored key. */
  remove: () => Promise<void>;
}) {
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
      await write(v);
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
      await forget();
      setConfirming(false);
      setRemoved(true);
      if (removedTimer.current) window.clearTimeout(removedTimer.current);
      removedTimer.current = window.setTimeout(() => setRemoved(false), 5000);
    } catch (e) {
      setConfirming(false);
      setErr((e as Error).message);
    }
  };

  const eyebrow = optional ? <div className="mb-1.5 font-mono text-[10px] tracking-[0.16em] uppercase text-ink-500">optional key</div> : null;

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
              <button type="button" onClick={() => void remove()} className={`${textButton} text-rust-400 hover:text-rust-500`}>
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
          aria-label={`${label} API key`}
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
 * The context window Derive asks a local model for — D-03's learner-editable
 * `num_ctx` field.
 *
 * Empty means the default, which the placeholder shows and which the API
 * returns rather than the browser knowing it; a value the server refuses shows
 * the server's own sentence with the typed value left in the field. It saves on
 * blur like every other field on this page: there is no Save control anywhere
 * on the settings page and this field adds none.
 *
 * It renders only where `num_ctx_default` is non-null, which is the API saying
 * this row has a window to set at all — Ollama and nothing else, because Ollama
 * is the one server Derive tells the window to. D-05 makes LM Studio and
 * llama.cpp read-only, so those rows carry no field: raising a value Derive
 * never sends raises nothing, and a tick saying it applies from the next turn
 * would be false.
 */
function NumCtxField({ row, onChange }: { row: ProviderView; onChange: (row: ProviderView) => void }) {
  const stored = row.num_ctx === null ? '' : String(row.num_ctx);
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
      // An emptied field is null, which returns the row to the default — the
      // numeric counterpart of the empty string that clears the model id.
      onChange(await api.setProvider(row.id, { num_ctx: v === '' ? null : Number(v) }));
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
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => void save()}
        onKeyDown={blurOnEnter}
        disabled={saving}
        placeholder={String(row.num_ctx_default)}
        aria-label={`${row.label} context window (num_ctx)`}
        spellCheck={false}
        autoComplete="off"
        className={`${field} font-mono h-10`}
      />
      {err ? <p className={errLine}>{err}</p> : saved ? <p className={tickLine}>saved · applies from the next turn</p> : null}
    </div>
  );
}

/**
 * One provider on the settings page: its status pill, its key field, its
 * model combobox saving on blur or Enter with a saved tick, the base URL
 * where one applies, the fetch and test actions with their one-line result,
 * and the one action that makes it the tutor. Every fact it shows comes from
 * the row the API painted; the row is a quiet card, gold while it is the one
 * teaching.
 *
 * The model field is one control (D-08): a native input with a datalist of
 * whatever the last fetch brought back. Before a fetch the list is empty and
 * the field is exactly a text input; after a failed fetch the provider's
 * sentence shows under it and the field still takes a typed id and saves it.
 * No second control ever appears. The test result renders on one mono line
 * with the full text in its title, the provider's sentence verbatim in rust
 * and Derive's fix hint on its own line beneath (D-14). No toast.
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
  const [models, setModels] = useState<string[]>([]);
  const [fetched, setFetched] = useState<number | null>(null);
  const [fetching, setFetching] = useState(false);
  const [fetchErr, setFetchErr] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [capability, setCapability] = useState<CapabilityResult | null>(null);
  const [teachTesting, setTeachTesting] = useState(false);
  // The result and the model it was run on, never the result alone. The whole
  // value of PROV-11 is that a learner can trust the line before spending a
  // session, so a pass attributed to a model that has never been tested is the
  // one failure this feature cannot afford — and it is one model change away if
  // the line does not say which model it belongs to.
  const [teaching, setTeaching] = useState<{ model: string; result: TeachingTest } | null>(null);

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
    setCapability(null);
    try {
      onChange(await api.setProvider(row.id, { model: value }));
      tick(timer, setState);
    } catch (e) {
      setErr((e as Error).message);
      setState('idle');
      return;
    }
    // D-07's one probe per chosen model: the definitive answer costs a real
    // request, so it is spent here — on the model the learner just picked —
    // and nowhere else. It runs after the write and in its own try, so a
    // capability line that could not be read never reads as a failed save.
    // A refused write never reaches it: that sentence is already on the error
    // line with the typed id left in the field.
    if (row.group !== 'local' || !value) return;
    try {
      setCapability(await api.probeCapability(row.id, value));
    } catch (e) {
      setCapability({ ok: false, error: (e as Error).message, ms: 0 });
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

  const fetchModels = async () => {
    setFetching(true);
    setFetchErr(null);
    try {
      const { models: ids } = await api.providerModels(row.id);
      setModels(ids);
      setFetched(ids.length);
    } catch (e) {
      // The provider's sentence, verbatim; the list empties and the field stays typeable (D-08).
      setModels([]);
      setFetched(null);
      setFetchErr((e as Error).message);
    } finally {
      setFetching(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setResult(null);
    try {
      setResult(await api.testProvider(row.id));
    } catch (e) {
      // The route itself failed to answer; that sentence is Derive's, shown where the provider's would be.
      setResult({ ok: false, error: (e as Error).message, ms: 0 });
    } finally {
      setTesting(false);
    }
  };

  /**
   * PROV-11: one node and one graded quiz on this row's own model, before a
   * session is spent on it. The route always answers, so a fail is a result and
   * not a thrown error; a route that could not answer at all shows Derive's
   * sentence where the server's would be, exactly as the connection test does.
   */
  const testTeaching = async () => {
    // Read before the run, so the result is filed under the model that was
    // actually proved rather than under whatever the row holds by the time it
    // comes back.
    const ran = effective;
    setTeachTesting(true);
    setTeaching(null);
    try {
      setTeaching({ model: ran, result: await api.testTeaching(row.id) });
    } catch (e) {
      setTeaching({ model: ran, result: { ok: false, reason: (e as Error).message, ms: 0 } });
    } finally {
      setTeachTesting(false);
    }
  };

  /**
   * The proof's result, but only while the row still holds the model it was run
   * on. One check rather than a `setTeaching(null)` in every place the model can
   * move: a save, a fetched id picked from the list, a rescan that replaces the
   * row, and a parent refresh through `onChange` all change `effective`, and any
   * of them would otherwise leave `Pass · …` beside a model nothing has tested.
   */
  const proof = teaching && teaching.model === effective ? teaching.result : null;

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
        {row.key && (
          <KeyField
            value={row.key}
            label={row.label}
            optional={row.key_optional}
            save={async (v) => onChange(await api.setProvider(row.id, { key: v }))}
            remove={async () => {
              await api.removeKey(row.id);
              onChange({ ...row, key: { set: false, hint: null, locked: null }, status: row.status === 'key set' ? 'not configured' : row.status });
            }}
          />
        )}
        <div className="min-w-0 md:col-start-2">
          <div className="flex items-center gap-2">
            <input
              list={`models-${row.id}`}
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
            <datalist id={`models-${row.id}`}>
              {models.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
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
          ) : fetchErr ? (
            <p className={errLine}>{fetchErr}</p>
          ) : fetched !== null ? (
            <p className="mt-2 font-mono text-[10px] text-ink-500">{fetchedText(fetched)}</p>
          ) : row.default_model && model.trim() === row.default_model ? (
            <p className="mt-2 font-mono text-[10px] text-ink-500">default as of {defaultsAsOf}</p>
          ) : row.id === 'codex' && model.trim() === '' ? (
            <p className="mt-2 font-mono text-[10px] text-ink-500">Codex's own default applies</p>
          ) : null}
        </div>
        {takesBaseUrl && <BaseUrlField row={row} onChange={onChange} />}
        {row.num_ctx_default !== null && <NumCtxField row={row} onChange={onChange} />}
      </div>

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        {row.has_models_endpoint && (
          <>
            <button type="button" onClick={() => void fetchModels()} disabled={fetching} className={textButton}>
              {fetching ? 'fetching…' : 'fetch models'}
            </button>
            <span className="font-mono text-[10px] text-ink-600">·</span>
          </>
        )}
        <button type="button" onClick={() => void test()} disabled={testing} className={textButton}>
          {testing ? 'testing…' : 'test connection'}
        </button>
        {/* Every row that teaches, the two login rows included (amendment A-03): both login backends run a turn through the same driver seam, so the same one-node-one-graded-quiz proof works on them unchanged, and a learner on a login row must not be left without it. */}
        {row.teaches && (
          <>
            <span className="font-mono text-[10px] text-ink-600">·</span>
            <button
              type="button"
              onClick={() => void testTeaching()}
              disabled={teachTesting || unusable}
              title={unusable ? 'Nothing to test yet: log in or paste a key first' : undefined}
              className={textButton}
            >
              {teachTesting ? 'testing…' : 'test teaching'}
            </button>
          </>
        )}
        {result && (
          <span role="status" title={resultText(result)} className={`ml-auto ${resultLine} ${result.ok ? 'text-moss-400' : 'text-rust-400'}`}>
            {resultText(result)}
          </span>
        )}
      </div>
      {result && !result.ok && result.hint && <p className="mt-2 text-[14px] leading-relaxed text-ink-300">{result.hint}</p>}
      {/* Whether the model this row is set to can run the method. Moss when it can, rust with the server-side refusal when it cannot; the sentence is never clipped away, only truncated, with the whole of it in the title. The row's status pill and its model list are untouched by this line, so a reachable server exposing no tool-capable model still reads `found on port …` and still lists what it has. */}
      {capability && (
        <p role="status" title={capabilityText(capability)} className={`mt-2 ${resultLine} ${capability.ok && capability.selectable ? 'text-moss-400' : 'text-rust-400'}`}>
          {capabilityText(capability)}
        </p>
      )}
      {capability && !capability.ok && capability.hint && <p className="mt-2 text-[14px] leading-relaxed text-ink-300">{capability.hint}</p>}
      {/* The proof's own line: the in-flight sentence while the run is out, then the pass in moss or the fail in rust. One line, truncated, with the whole sentence in the title, so a long reason from a learner's own server never widens the card. */}
      {teachTesting ? (
        <p role="status" className={`mt-2 ${resultLine} text-teal-400 animate-pulse motion-reduce:animate-none`}>
          running one node and a graded quiz
        </p>
      ) : proof ? (
        <p role="status" title={teachingText(proof)} className={`mt-2 ${resultLine} ${proof.ok ? 'text-moss-400' : 'text-rust-400'}`}>
          {teachingText(proof)}
        </p>
      ) : null}
      {proof && !proof.ok && proof.hint && <p className="mt-2 text-[14px] leading-relaxed text-ink-300">{proof.hint}</p>}
    </div>
  );
}
