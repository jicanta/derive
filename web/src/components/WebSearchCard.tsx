import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { SearchView, TestResult } from '../lib/types';
import { blurOnEnter, errLine, field, noteLine, textButton, tickLine, useTick } from './fields';
import { KeyField } from './ProviderRow';

/** The three choices, in the order the learner reads them: the provider's own first, because it is what most providers already have. */
const CHOICES: readonly { id: SearchView['provider']; label: string }[] = [
  { id: 'provider', label: "the provider's own" },
  { id: 'tavily', label: 'Tavily' },
  { id: 'searxng', label: 'SearXNG' },
];

/** Why this block exists at all, in one sentence: the method, not the mechanism. */
const WHY = 'The tutor verifies a fact before it teaches it. Anthropic, OpenAI and Gemini search with their own tool; every other provider needs one here.';

/** `the provider's own`, on a provider that has one: there is nothing here to do. */
const NATIVE = 'This provider searches with its own tool. Nothing to configure.';

/**
 * `the provider's own`, on a provider that has none. It says what the tutor
 * does instead rather than leaving the learner to find out: with no search the
 * method text tells it to admit uncertainty, which is a worse lesson than one
 * it could check.
 */
const NO_SEARCH = 'OpenRouter and base-URL endpoints have no search of their own. The tutor will say when it is unsure instead of guessing. Pick Tavily or SearXNG to give it a way to check.';

/**
 * A choice made and not finished. The server counts it as no search at all
 * (`searchReady`), so the card says what is missing rather than quietly
 * behaving as though the provider's own tool had been picked — a selection
 * must mean what it says.
 */
const missing = (what: string) => `Add ${what} to turn search on. Until then the tutor has no way to check a fact.`;

/** The one line a search test answers with: the hits and the latency, or the engine's sentence as it came. */
const resultText = (r: TestResult): string => (r.ok ? (r.models === null ? `Connected · ${r.ms} ms` : `Connected · ${r.models} results · ${r.ms} ms`) : r.error);

/**
 * Where a learner's SearXNG instance is reached. `BaseUrlField`'s shape on the
 * search setting instead of a provider row: `onBlur` is the one save path,
 * Enter routes through it, an unchanged value is a no-op, and the `field`
 * class is `w-full`, so a 120-character address scrolls inside the input
 * rather than widening the card. No environment variable sets this address, so
 * there is no lock sentence to show.
 */
function SearxngField({ stored, onSave }: { stored: string; onSave: (base: string) => Promise<void> }) {
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
      await onSave(v);
      tick();
    } catch (e) {
      // The typed value stays so the learner can fix it; only the server's sentence says what was wrong.
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-w-0">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => void save()}
        onKeyDown={blurOnEnter}
        disabled={saving}
        placeholder="http://localhost:8888"
        aria-label="SearXNG base URL"
        spellCheck={false}
        autoComplete="off"
        className={`${field} font-mono h-10`}
      />
      {err ? (
        <p className={errLine}>{err}</p>
      ) : saved ? (
        <p className={tickLine}>saved · applies from the next turn</p>
      ) : stored ? null : (
        <p className={noteLine}>{missing('an address')}</p>
      )}
    </div>
  );
}

/**
 * How the tutor searches the web, as one card: a three-way native choice and
 * the one field that choice needs, saved as you go.
 *
 * A sibling of `ProviderRow`, not a generalisation of it: that component is
 * about a provider that teaches, and `teaches: false` already means something
 * else in the catalogue. What the two share — the field classes, the 1800 ms
 * tick, the masked key machine — is imported rather than re-derived.
 *
 * Only the selected option's field is rendered, and a choice whose key or
 * address is missing says so. Nothing here falls back to the provider's own
 * search on the quiet: the server counts a half-configured choice as no search
 * at all, so a card that implied otherwise would describe something the tutor
 * is not doing.
 */
export function WebSearchCard({ search, onChange }: { search: SearchView; onChange: (search: SearchView) => void }) {
  const [choosing, setChoosing] = useState(false);
  const [choiceErr, setChoiceErr] = useState<string | null>(null);
  const [chosen, tick] = useTick();
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const pick = async (id: SearchView['provider']) => {
    if (id === search.provider) return;
    setChoosing(true);
    setChoiceErr(null);
    // Last turn's result describes a search that is no longer the one selected.
    setResult(null);
    try {
      onChange(await api.setSearch({ provider: id }));
      tick();
    } catch (e) {
      setChoiceErr((e as Error).message);
    } finally {
      setChoosing(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setResult(null);
    try {
      setResult(await api.testSearch());
    } catch (e) {
      // The route itself failed to answer; that sentence is Derive's, shown where the engine's would be.
      setResult({ ok: false, error: (e as Error).message, ms: 0 });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="rounded-[18px] border border-ink-100/12 bg-ink-900/70 px-5 py-4 md:px-6 md:py-5">
      <div className="text-[14px] font-medium text-ink-100">Web search</div>
      <p className="mt-2 text-[14px] leading-relaxed text-ink-500">{WHY}</p>

      <div className="mt-3 flex items-center gap-4 flex-wrap">
        {CHOICES.map((c) => (
          <label key={c.id} className="flex items-center gap-2 text-[14px] leading-relaxed text-ink-300">
            <input
              type="radio"
              name="derive-web-search"
              value={c.id}
              checked={search.provider === c.id}
              onChange={() => void pick(c.id)}
              disabled={choosing}
              className="accent-ink-100"
            />
            {c.label}
          </label>
        ))}
      </div>
      {choiceErr ? <p className={errLine}>{choiceErr}</p> : chosen ? <p className={tickLine}>saved · applies from the next turn</p> : null}

      {search.provider === 'provider' && <p className={noteLine}>{search.native ? NATIVE : NO_SEARCH}</p>}

      {search.provider !== 'provider' && (
        <div className="mt-3 flex flex-col gap-2 md:grid md:grid-cols-2 md:gap-4">
          {search.provider === 'tavily' ? (
            <div className="min-w-0">
              <KeyField
                value={{ ...search.key, locked: search.key_locked }}
                label="Tavily"
                save={async (v) => onChange(await api.setSearch({ key: v }))}
                remove={async () => {
                  await api.removeSearchKey();
                  onChange({ ...search, key: { set: false, hint: null } });
                }}
              />
              {!search.key.set && !search.key_locked && <p className={noteLine}>{missing('a key')}</p>}
            </div>
          ) : (
            <SearxngField stored={search.base_url ?? ''} onSave={async (base) => onChange(await api.setSearch({ base_url: base }))} />
          )}
        </div>
      )}

      {search.provider !== 'provider' && (
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <button type="button" onClick={() => void test()} disabled={testing} className={textButton}>
            {testing ? 'testing…' : 'test search'}
          </button>
          {result && (
            <span role="status" title={resultText(result)} className={`ml-auto min-w-0 max-w-full truncate font-mono text-[10px] ${result.ok ? 'text-moss-400' : 'text-rust-400'}`}>
              {resultText(result)}
            </span>
          )}
        </div>
      )}
      {result && !result.ok && result.hint && <p className="mt-2 text-[14px] leading-relaxed text-ink-300">{result.hint}</p>}
    </div>
  );
}
