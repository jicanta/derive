import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LearnerMenu } from '../components/LearnerMenu';
import { ProviderRow } from '../components/ProviderRow';
import { api } from '../lib/api';
import type { ProviderView, Settings } from '../lib/types';

const pill = 'inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.16em] uppercase text-ink-400 border hairline rounded-full px-2.5 h-6';
const textButton = 'inline-flex items-center gap-1.5 h-8 font-mono text-[10px] text-ink-400 hover:text-ink-50 transition-colors focus-visible:text-ink-50 focus-visible:underline disabled:opacity-40';

/** The three eyebrows the rows sit under, in page order. The ids are the API's; only the words are the page's. */
const GROUPS: { id: ProviderView['group']; label: string }[] = [
  { id: 'logins', label: 'logins' },
  { id: 'keys', label: 'keys' },
  { id: 'local', label: 'on this machine' },
];

/** The server names the file's path and says what went wrong; the page keeps only the reason, the file's short name already opens the sentence. */
const secretsReason = (error: string): string => {
  const at = error.indexOf(' could not be read: ');
  if (at >= 0) return error.slice(at + ' could not be read: '.length);
  const file = error.indexOf('secrets.json ');
  return file >= 0 ? error.slice(file + 'secrets.json '.length) : error;
};

/** Login and local rows read `checking` while a pass is looking; a stored key or an environment value is a fact the pass does not change. */
const checking = (r: ProviderView): ProviderView => (r.auth === 'login' || r.group === 'local' ? { ...r, status: 'checking' } : r);

/**
 * Which provider and model teach, per install. One row per provider from
 * the API, one row gold; every field saves itself, so there is no Save
 * button. The page paints stored config the moment it loads and asks for
 * one detection pass right after — and again only when the learner presses
 * rescan. Nothing here polls.
 */
export function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const scan = async () => {
    setScanning(true);
    setSettings((s) => s && { ...s, rows: s.rows.map(checking) });
    try {
      setSettings(await api.detectProviders());
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setScanning(false);
    }
  };

  const load = async () => {
    setErr(null);
    try {
      setSettings(await api.settings());
    } catch (e) {
      setErr((e as Error).message);
      return;
    }
    await scan();
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rescan = () => void (settings ? scan() : load());

  const onUse = async (row: ProviderView) => {
    const prev = settings;
    if (!prev) return;
    setSettings({
      ...prev,
      active: { provider: row.id, model: row.model ?? row.default_model, source: 'settings', modelSource: row.model ? 'settings' : row.default_model ? 'default' : null },
      rows: prev.rows.map((r) => ({ ...r, active: r.id === row.id })),
    });
    try {
      const active = await api.useProvider(row.id);
      setSettings((s) => s && { ...s, active });
    } catch (e) {
      setSettings(prev);
      throw e;
    }
  };

  const onRowChange = (row: ProviderView) => setSettings((s) => s && { ...s, rows: s.rows.map((r) => (r.id === row.id ? row : r)) });

  const active = settings?.active;
  const activeLabel = settings && active ? (settings.rows.find((r) => r.id === active.provider)?.label ?? active.provider).toLowerCase() : '';
  const source = !active ? null : active.source === 'environment' ? 'set from environment' : active.source === 'settings' ? 'from settings' : scanning ? 'checking' : 'detected';

  return (
    <div className="h-full flex flex-col">
      <header className="flex items-center gap-5 px-5 md:px-6 h-[60px] border-b hairline shrink-0">
        <Link to="/" className="text-ink-400 hover:text-ink-50 transition-colors" title="All lessons">
          <ArrowLeft size={18} strokeWidth={1.8} />
        </Link>
        <h1 className="font-serif text-[22px] tracking-[-0.01em] truncate min-w-0 text-ink-50">
          Settings <em className="text-ink-400">· which model teaches</em>
        </h1>
        <div className="ml-auto flex items-center gap-6">
          <LearnerMenu />
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto scroll-thin">
        <div className="mx-auto max-w-[760px] px-5 md:px-8 pt-9 pb-24">
          <p className="text-[14px] leading-relaxed text-ink-300 max-w-[62ch]">
            One provider teaches every lesson on this install. Pick it here, paste a key where one is needed, and test it. Changes apply from the next turn of every lesson; the one running now finishes on what it started with.
          </p>

          <div className="mt-6 flex items-center gap-3 flex-wrap">
            {settings && active ? (
              <>
                <span className="eyebrow">teaching now</span>
                <span className="font-mono text-[14px] text-ink-100">
                  {activeLabel} · {active.model ?? 'default model'}
                </span>
                <span className={pill}>
                  <span className={`h-1.5 w-1.5 rounded-full ${source === 'checking' ? 'bg-ink-500 animate-pulse motion-reduce:animate-none' : 'bg-ink-400'}`} />
                  {source}
                </span>
              </>
            ) : err ? (
              <span className="text-[14px] leading-relaxed text-rust-400">{err}</span>
            ) : null}
            <button type="button" onClick={rescan} disabled={scanning} className={`ml-auto ${textButton}`}>
              <RefreshCw size={12} strokeWidth={2} />
              {scanning ? 'scanning…' : 'rescan'}
            </button>
          </div>
          {settings?.provider_locked && (
            <p className="mt-2 text-[14px] leading-relaxed text-ink-500">DERIVE_BACKEND is set in your environment, so the provider cannot be changed here. Unset it to choose one.</p>
          )}
          {settings && err && <p className="mt-2 text-[14px] leading-relaxed text-rust-400">{err}</p>}

          {settings &&
            GROUPS.map((g) => (
              <section key={g.id} className="mt-8">
                <div className="eyebrow">{g.label}</div>
                {g.id === 'keys' && settings.secrets_error && (
                  <p className="mt-3 text-[14px] leading-relaxed text-rust-400">secrets.json could not be read: {secretsReason(settings.secrets_error)}. Fix or move the file; nothing here was overwritten.</p>
                )}
                <div className="mt-3 flex flex-col gap-6">
                  {settings.rows
                    .filter((r) => r.group === g.id)
                    .map((row) => (
                      <ProviderRow
                        key={row.id}
                        row={row}
                        active={row.active}
                        providerLocked={settings.provider_locked}
                        defaultsAsOf={settings.defaults_as_of}
                        onChange={onRowChange}
                        onUse={() => onUse(row)}
                      />
                    ))}
                </div>
              </section>
            ))}
        </div>
      </div>
    </div>
  );
}
