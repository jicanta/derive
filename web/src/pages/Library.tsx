import { ArrowLeft, Check, ExternalLink, Pencil, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { KIND_LABEL, KindIcon } from '../components/ResourceCard';
import { LearnerMenu } from '../components/LearnerMenu';
import { api } from '../lib/api';
import { RESOURCE_KINDS, type Library, type Resource, type ResourceKind } from '../lib/types';

const looksLikeUrl = (s: string) => /^(https?:\/\/|www\.)\S+$/i.test(s.trim()) || /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(s.trim());

const words = (chars: number) => {
  const w = Math.round(chars / 6);
  return w >= 1000 ? `${Math.round(w / 1000)}k words` : `${w} words`;
};

function timeAgo(ts: number) {
  const d = Math.floor((Date.now() - ts) / 86_400_000);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 30) return `${d}d ago`;
  const m = Math.floor(d / 30);
  return m < 12 ? `${m}mo ago` : `${Math.floor(m / 12)}y ago`;
}

/**
 * The learner's library: an organised shelf of links, videos, books, papers,
 * courses and notes. The tutor reads it, searches it and points back to it
 * mid-lesson, and saves what it finds on the web here too.
 */
export function LibraryPage() {
  const [lib, setLib] = useState<Library | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<ResourceKind | ''>('');
  const [tag, setTag] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => api.library().then(setLib).catch((e) => setErr((e as Error).message));
  useEffect(() => {
    void load();
  }, []);

  const shown = useMemo(() => {
    if (!lib) return [];
    const s = q.trim().toLowerCase();
    return lib.resources.filter((r) => (!kind || r.kind === kind) && (!tag || r.tags.includes(tag)) && (!s || [r.title, r.author, r.note, r.host, r.tags.join(' ')].some((x) => (x ?? '').toLowerCase().includes(s))));
  }, [lib, q, kind, tag]);

  const kindCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of lib?.resources ?? []) m.set(r.kind, (m.get(r.kind) ?? 0) + 1);
    return m;
  }, [lib]);

  const patch = (r: Resource) => setLib((l) => (l ? { ...l, resources: l.resources.map((x) => (x.id === r.id ? r : x)) } : l));

  const remove = async (r: Resource) => {
    if (!confirm(`Remove "${r.title}" from your library?`)) return;
    setLib((l) => (l ? { ...l, resources: l.resources.filter((x) => x.id !== r.id), total: l.total - 1 } : l));
    await api.deleteResource(r.id).catch(() => undefined);
    void load();
  };

  const refetch = async (r: Resource) => {
    setBusy(r.id);
    try {
      patch(await api.refetchResource(r.id));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <header className="flex items-center gap-5 px-5 md:px-6 h-[60px] border-b hairline shrink-0">
        <Link to="/" className="text-ink-400 hover:text-ink-50 transition-colors">
          <ArrowLeft size={18} strokeWidth={1.8} />
        </Link>
        <h1 className="font-serif text-[22px] text-ink-50">
          Library <em className="text-ink-400">· what you read, watch and keep</em>
        </h1>
        <div className="ml-auto flex items-center gap-6">
          {lib && lib.total > 0 && (
            <span className="hidden md:inline font-mono text-[11px] text-ink-400">
              <span className="text-gold-500">{lib.total}</span> {lib.total === 1 ? 'entry' : 'entries'} · the tutor can read every one
            </span>
          )}
          <LearnerMenu onChange={() => void load()} />
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto scroll-thin">
        <div className="mx-auto max-w-[920px] px-5 md:px-8 pt-9 pb-16">
          <AddForm
            onAdded={(r, existing) => {
              setLib((l) => (l ? { ...l, resources: existing ? l.resources.map((x) => (x.id === r.id ? r : x)) : [r, ...l.resources], total: existing ? l.total : l.total + 1 } : l));
              void load();
            }}
          />
          {err && <p className="mt-3 text-sm text-rust-400">{err}</p>}

          {lib && lib.total === 0 && (
            <section className="mt-12 grid sm:grid-cols-3 gap-8 border-t border-ink-100/14 pt-6">
              {[
                ['01', 'Keep', 'A link, a video, a paper, a book, a course, or a plain note. Pages are read once and their text kept, so nothing depends on the site staying up.'],
                ['02', 'Organise', 'Tags and kinds. Search covers titles, notes, authors and the text itself, for you and for the tutor.'],
                ['03', 'Teach from it', 'The tutor sees your shelf in every lesson: it borrows framing and examples, points you to the right chapter or timestamp when a node locks, and saves what it finds on the web here.'],
              ].map(([n, t, d]) => (
                <div key={n}>
                  <div className="flex items-baseline gap-3">
                    <span className="font-serif text-[2rem] text-ink-600 leading-none">{n}</span>
                    <span className="font-serif text-[1.35rem] text-ink-50">{t}</span>
                  </div>
                  <p className="mt-2 text-[14px] leading-relaxed text-ink-400">{d}</p>
                </div>
              ))}
            </section>
          )}

          {lib && lib.total > 0 && (
            <>
              <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-3">
                <label className="flex items-center gap-2 border-b border-ink-100/25 focus-within:border-gold-500 pb-1.5 min-w-[220px]">
                  <Search size={13} className="text-ink-500" />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="search titles, notes, authors" className="bg-transparent outline-none text-[14px] text-ink-100 placeholder:text-ink-500 w-full" />
                </label>
                <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
                  <Chip active={!kind} onClick={() => setKind('')}>
                    all · {lib.total}
                  </Chip>
                  {RESOURCE_KINDS.filter((k) => kindCounts.get(k)).map((k) => (
                    <Chip key={k} active={kind === k} onClick={() => setKind(kind === k ? '' : k)}>
                      {KIND_LABEL[k]}s · {kindCounts.get(k)}
                    </Chip>
                  ))}
                </div>
              </div>
              {lib.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
                  {lib.tags.map((t) => (
                    <button key={t.tag} type="button" onClick={() => setTag(tag === t.tag ? '' : t.tag)} className={`transition-colors ${tag === t.tag ? 'text-gold-500' : 'text-ink-500 hover:text-ink-200'}`}>
                      #{t.tag}
                      <span className="text-ink-600"> {t.count}</span>
                    </button>
                  ))}
                </div>
              )}

              <ul className="mt-6">
                {shown.length === 0 && <li className="py-10 text-center font-mono text-[11px] text-ink-500">nothing matches</li>}
                {shown.map((r) =>
                  editing === r.id ? (
                    <EditRow
                      key={r.id}
                      r={r}
                      onCancel={() => setEditing(null)}
                      onSaved={(x) => {
                        patch(x);
                        setEditing(null);
                        void load();
                      }}
                    />
                  ) : (
                    <li key={r.id} className="group grid grid-cols-[22px_minmax(0,1fr)_auto] gap-x-4 py-4 border-t border-ink-100/10">
                      <span className="text-ink-500 pt-[5px]">
                        <KindIcon kind={r.kind} size={15} />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                          {r.url ? (
                            <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex items-baseline gap-1.5 font-serif text-[1.3rem] leading-snug text-ink-50 hover:text-gold-400 transition-colors">
                              <span className="text-pretty">{r.title}</span>
                              <ExternalLink size={11} strokeWidth={2} className="self-center shrink-0 text-ink-600" />
                            </a>
                          ) : (
                            <span className="font-serif text-[1.3rem] leading-snug text-ink-50 text-pretty">{r.title}</span>
                          )}
                          <span className="font-mono text-[10.5px] text-ink-500 whitespace-nowrap">
                            {KIND_LABEL[r.kind]}
                            {r.author && ` · ${r.author}`}
                            {r.host && ` · ${r.host}`}
                            {' · '}
                            {r.chars ? (
                              <span title="How much of it the tutor can read">{words(r.chars)} kept</span>
                            ) : r.kind === 'note' ? (
                              'note'
                            ) : r.fetch_error ? (
                              <span className="text-rust-400" title={r.fetch_error}>
                                not fetched
                              </span>
                            ) : (
                              'link only'
                            )}
                            {' · '}
                            {timeAgo(r.created_at)}
                            {r.added_by === 'tutor' && <span className="text-gold-500"> · saved by the tutor</span>}
                          </span>
                        </div>
                        {r.note && <p className="mt-1 text-[14px] leading-[1.5] text-ink-300 text-pretty max-w-[72ch] whitespace-pre-wrap">{r.note}</p>}
                        {r.tags.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 font-mono text-[10.5px]">
                            {r.tags.map((t) => (
                              <button key={t} type="button" onClick={() => setTag(tag === t ? '' : t)} className={`transition-colors ${tag === t ? 'text-gold-500' : 'text-ink-500 hover:text-ink-200'}`}>
                                #{t}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-start gap-3 pt-[6px] text-ink-500 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        {r.url && (
                          <button type="button" title={r.fetch_error ? `Fetch again (${r.fetch_error})` : 'Fetch the page again'} onClick={() => void refetch(r)} disabled={busy === r.id} className="hover:text-ink-100 disabled:opacity-40">
                            <RefreshCw size={13} className={busy === r.id ? 'animate-spin' : ''} />
                          </button>
                        )}
                        <button type="button" title="Edit" onClick={() => setEditing(r.id)} className="hover:text-ink-100">
                          <Pencil size={13} />
                        </button>
                        <button type="button" title="Remove" onClick={() => void remove(r)} className="hover:text-rust-400">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </li>
                  ),
                )}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-full border px-2.5 h-6 transition-colors ${active ? 'border-gold-500/60 text-gold-500 bg-gold-500/5' : 'hairline text-ink-400 hover:text-ink-100'}`}>
      {children}
    </button>
  );
}

/** Paste a link (fetched now, kind guessed from the URL) or write a title for a note; a why and tags are optional. */
function AddForm({ onAdded }: { onAdded: (r: Resource, existing: boolean) => void }) {
  const [what, setWhat] = useState('');
  const [note, setNote] = useState('');
  const [tags, setTags] = useState('');
  const [kind, setKind] = useState<ResourceKind | ''>('');
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const isUrl = looksLikeUrl(what);
  const open = what.trim().length > 0;

  const submit = async () => {
    const w = what.trim();
    if (!w || adding) return;
    setAdding(true);
    setMsg(null);
    try {
      const r = await api.addResource({
        ...(isUrl ? { url: w } : { title: w }),
        ...(kind ? { kind } : isUrl ? {} : { kind: 'note' }),
        note: note.trim() || undefined,
        tags: tags.split(/[,\s]+/).map((t) => t.trim()).filter(Boolean),
      });
      const { existing, ...res } = r;
      onAdded(res, existing);
      setMsg(existing ? 'Already on your shelf; note and tags merged.' : res.fetch_error ? `Saved the link, but the page could not be read: ${res.fetch_error}` : res.chars ? `Saved · ${words(res.chars)} kept for the tutor` : 'Saved');
      setWhat('');
      setNote('');
      setTags('');
      setKind('');
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setAdding(false);
      setTimeout(() => setMsg(null), 6000);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="flex items-baseline gap-4 border-b border-ink-100/40 focus-within:border-gold-500 pb-3 transition-colors">
        <span className="font-mono text-xl text-gold-500">
          <Plus size={18} strokeWidth={2} className="translate-y-[3px]" />
        </span>
        <input
          autoFocus
          value={what}
          onChange={(e) => setWhat(e.target.value)}
          disabled={adding}
          placeholder="Paste a link to an article, a video, a paper, a book… or write a note"
          className="flex-1 min-w-0 bg-transparent font-serif text-[1.35rem] md:text-[1.6rem] leading-tight text-ink-50 outline-none placeholder:text-ink-50/70 disabled:opacity-50"
        />
        <button type="submit" disabled={!open || adding} className="font-mono text-[11px] tracking-[0.12em] uppercase text-ink-400 hover:text-gold-500 disabled:hover:text-ink-400 transition-colors">
          {adding ? (isUrl ? 'reading' : 'saving') : 'add ↵'}
        </button>
      </div>
      {open && (
        <div className="mt-2.5 grid sm:grid-cols-[minmax(0,1fr)_200px_130px] gap-2.5 animate-fade-up">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={isUrl ? 'why it is here, in a sentence (optional)' : 'the note itself'} className="rounded-xl border hairline bg-ink-900/70 px-3 h-9 text-[13px] text-ink-100 outline-none focus:border-gold-500/60 placeholder:text-ink-500" />
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="tags, comma separated" className="rounded-xl border hairline bg-ink-900/70 px-3 h-9 font-mono text-[12px] text-ink-100 outline-none focus:border-gold-500/60 placeholder:text-ink-500" />
          <select value={kind} onChange={(e) => setKind(e.target.value as ResourceKind | '')} className="rounded-xl border hairline bg-ink-900/70 px-2.5 h-9 font-mono text-[12px] text-ink-200 outline-none focus:border-gold-500/60">
            <option value="">{isUrl ? 'kind: auto' : 'kind: note'}</option>
            {RESOURCE_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </div>
      )}
      <p className={`mt-2 font-mono text-[11px] ${msg ? 'text-ink-300' : 'text-ink-500'}`}>{msg ?? 'Pages are read once and their text kept, so the tutor can search them, cite them and point you to the right part.'}</p>
    </form>
  );
}

function EditRow({ r, onCancel, onSaved }: { r: Resource; onCancel: () => void; onSaved: (r: Resource) => void }) {
  const [title, setTitle] = useState(r.title);
  const [kind, setKind] = useState<ResourceKind>(r.kind);
  const [author, setAuthor] = useState(r.author ?? '');
  const [note, setNote] = useState(r.note ?? '');
  const [tags, setTags] = useState(r.tags.join(', '));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      onSaved(await api.editResource(r.id, { title: title.trim() || r.title, kind, author: author.trim() || null, note: note.trim() || null, tags: tags.split(/[,\s]+/).map((t) => t.trim()).filter(Boolean) }));
    } catch (e) {
      setErr((e as Error).message);
      setSaving(false);
    }
  };

  const field = 'rounded-xl border hairline bg-ink-900/70 px-3 h-9 text-[13px] text-ink-100 outline-none focus:border-gold-500/60 placeholder:text-ink-500';
  return (
    <li className="py-4 border-t border-ink-100/10">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        onKeyDown={(e) => e.key === 'Escape' && onCancel()}
        className="grid gap-2.5"
      >
        <div className="grid sm:grid-cols-[minmax(0,1fr)_130px] gap-2.5">
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="title" className={`${field} font-serif text-[16px]`} />
          <select value={kind} onChange={(e) => setKind(e.target.value as ResourceKind)} className={`${field} font-mono text-[12px]`}>
            {RESOURCE_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </div>
        <div className="grid sm:grid-cols-2 gap-2.5">
          <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="author" className={field} />
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="tags, comma separated" className={`${field} font-mono text-[12px]`} />
        </div>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="why it is here, what it is good for" rows={3} className={`${field} h-auto py-2 leading-relaxed resize-y`} />
        {r.url && <p className="font-mono text-[10.5px] text-ink-500 truncate">{r.url}</p>}
        {err && <p className="text-sm text-rust-400">{err}</p>}
        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 h-8 rounded-lg bg-ink-100 text-ink-950 px-3 text-[12px] font-medium disabled:opacity-40">
            <Check size={13} /> Save
          </button>
          <button type="button" onClick={onCancel} className="inline-flex items-center gap-1.5 font-mono text-[11px] text-ink-400 hover:text-ink-100">
            <X size={12} /> cancel
          </button>
        </div>
      </form>
    </li>
  );
}
