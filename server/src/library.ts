/**
 * The learner's library: an organised shelf of links, videos, books, papers,
 * courses and notes that outlives any one lesson. Each entry keeps whatever
 * text could be fetched from it (an article's body, a paper's PDF, a video's
 * description), segmented like course material, so the tutor can search it,
 * read it, cite it, point the learner at the right entry at the right
 * moment, and add to it when a web search turns up something worth keeping.
 *
 * Unlike attached course material, the library is not a syllabus: it is a
 * source of framing, examples and further reading, and the tutor is told so.
 */
import { randomUUID } from 'node:crypto';
import { extractText } from 'unpdf';
import { VERSION } from './config.js';
import {
  deleteResource,
  getResource,
  insertResource,
  listResources,
  resourceByUrl,
  resourceRow,
  RESOURCE_KINDS,
  updateResourceMeta,
  updateResourceText,
  type ResourceFull,
  type ResourceKind,
  type ResourceRow,
} from './db.js';
import { partsOf, SEP, titleOf } from './materials.js';

export { RESOURCE_KINDS };
export type { ResourceKind, ResourceRow };

const FETCH_TIMEOUT_MS = 20_000;
const MAX_HTML_BYTES = 6 * 1024 * 1024;
const MAX_PDF_BYTES = 25 * 1024 * 1024;
/** Text kept per entry. A long paper fits; a whole book by URL does not need to. */
const MAX_CHARS = 400_000;
const READ_CHARS = 14_000;
/** How much of the catalog goes into the system prompt. */
const CATALOG_ENTRIES = 14;
const USER_AGENT = `Mozilla/5.0 (compatible; Derive/${VERSION}; +https://github.com/jicanta/derive)`;

// ---------- urls and kinds ----------

/** Normalised for deduplication: scheme and host lowercased, tracking parameters and fragments dropped, no trailing slash. */
export function normalizeUrl(raw: string): string {
  const s = raw.trim();
  if (!s) throw new Error('url required');
  let u: URL;
  try {
    u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    throw new Error(`not a URL: ${raw}`);
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error(`only http(s) links can be saved (got ${u.protocol})`);
  for (const k of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid|ref$|ref_|si$|feature$)/i.test(k)) u.searchParams.delete(k);
  u.hash = '';
  let out = u.toString();
  if (u.pathname !== '/' && out.endsWith('/')) out = out.slice(0, -1);
  return out;
}

export const hostOf = (url: string | null) => {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
};

const isYouTube = (h: string) => /(^|\.)(youtube\.com|youtu\.be|youtube-nocookie\.com)$/.test(h);
const isVimeo = (h: string) => /(^|\.)vimeo\.com$/.test(h);

/** A guess at the kind from the URL alone; the learner can always override it. */
export function detectKind(url: string): ResourceKind {
  const h = hostOf(url) ?? '';
  const p = (() => {
    try {
      return new URL(url).pathname.toLowerCase();
    } catch {
      return '';
    }
  })();
  if (isYouTube(h) || isVimeo(h) || /(^|\.)(ted\.com|twitch\.tv|loom\.com)$/.test(h)) return 'video';
  if (/(^|\.)(arxiv\.org|doi\.org|semanticscholar\.org|biorxiv\.org|medrxiv\.org|ssrn\.com|acm\.org|ieee\.org|springer\.com|sciencedirect\.com|nature\.com|jstor\.org|openreview\.net|aclanthology\.org|pubmed\.ncbi\.nlm\.nih\.gov)$/.test(h) || p.endsWith('.pdf')) return 'paper';
  if (/(^|\.)(amazon\.[a-z.]+|goodreads\.com|openlibrary\.org|books\.google\.[a-z.]+|oreilly\.com|manning\.com|nostarch\.com|gutenberg\.org|libgen\.[a-z]+|bookshop\.org)$/.test(h)) return 'book';
  if (/(^|\.)(coursera\.org|edx\.org|udemy\.com|udacity\.com|ocw\.mit\.edu|khanacademy\.org|brilliant\.org|pluralsight\.com|skillshare\.com|fast\.ai|deeplearning\.ai)$/.test(h) || /\/(course|courses|class|classes|lecture|lectures)\//.test(p)) return 'course';
  return 'article';
}

export const isKind = (k: unknown): k is ResourceKind => typeof k === 'string' && (RESOURCE_KINDS as string[]).includes(k);

// ---------- fetching ----------

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', copy: '©', laquo: '«', raquo: '»', middot: '·', bull: '•', times: '×', minus: '−' };
const decodeEntities = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });

const tidy = (s: string) => decodeEntities(s).replace(/\s+/g, ' ').trim();

/** `<meta property="og:title" content="...">` in either attribute order. */
function meta(html: string, ...names: string[]): string | null {
  for (const n of names) {
    const re1 = new RegExp(`<meta[^>]+(?:name|property|itemprop)=["']${n}["'][^>]*content=["']([^"']*)["']`, 'i');
    const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property|itemprop)=["']${n}["']`, 'i');
    const m = re1.exec(html) ?? re2.exec(html);
    if (m?.[1]?.trim()) return tidy(m[1]);
  }
  return null;
}

function metaAll(html: string, name: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) if (m[1]?.trim()) out.push(tidy(m[1]));
  return out;
}

const BLOCK_TAGS = 'p|div|section|article|main|header|footer|aside|nav|ul|ol|li|table|thead|tbody|tr|td|th|blockquote|pre|figure|figcaption|dl|dt|dd|details|summary|form|fieldset|hr|address';

/** Class names that mark furniture rather than content: navboxes, sidebars, tables of contents, edit links, share bars, cookie banners. */
const FURNITURE_RE = /\b(navbox|vertical-navbox|sidebar|side-box|infobox|metadata|toc|mw-editsection|mw-jump-link|hatnote|ambox|catlinks|printfooter|mw-indicators|reflist|references|breadcrumb|share|social|cookie|newsletter|subscribe|related-articles|recommend|comments?|advert|ad-slot|promo|skip-link|screen-reader|sr-only|visually-hidden)\b/i;

/**
 * Remove whole elements of one tag whose opening tag matches a test, with
 * nesting of the same tag respected (a navbox table holds tables). Regex
 * alone cannot pair tags, so this walks them.
 */
function dropElements(html: string, tag: string, test: (openTag: string) => boolean): string {
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
  let out = '';
  let pos = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m[1] === '/' || !test(m[0]) || m[0].endsWith('/>')) continue;
    // Find the matching close tag from here.
    let depth = 1;
    const inner = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
    inner.lastIndex = re.lastIndex;
    let end = html.length;
    let n: RegExpExecArray | null;
    while ((n = inner.exec(html))) {
      if (n[0].endsWith('/>')) continue;
      depth += n[1] === '/' ? -1 : 1;
      if (depth === 0) {
        end = inner.lastIndex;
        break;
      }
    }
    out += html.slice(pos, m.index);
    pos = end;
    re.lastIndex = end;
  }
  return out + html.slice(pos);
}

const isFurniture = (openTag: string) => {
  const cls = /\b(?:class|id|role)=["']([^"']*)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = cls.exec(openTag))) if (FURNITURE_RE.test(m[1]) || /^(navigation|banner|contentinfo|complementary|dialog|search|menu)$/i.test(m[1])) return true;
  return /\baria-hidden=["']true["']/i.test(openTag) || /\bhidden\b/i.test(openTag.replace(/=["'][^"']*["']/g, ''));
};

/**
 * Readable text out of a page: the largest <article> (else <main>, else
 * <body>) with navigation, sidebars, scripts and forms removed, headings
 * kept as markdown headings so the parts split at them.
 */
export function htmlToText(html: string): string {
  let s = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|noscript|template|svg|canvas|iframe|object|video|audio|picture|source|select|button|input|textarea)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(script|style|noscript|template|svg)\b[^>]*\/>/gi, '');
  const region = (tag: string) => {
    const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
    let best = '';
    let m: RegExpExecArray | null;
    while ((m = re.exec(s))) if (m[1].length > best.length) best = m[1];
    return best;
  };
  let body = region('article') || region('main') || region('body') || s;
  for (const tag of ['nav', 'aside', 'footer', 'header', 'form', 'dialog', 'menu']) body = dropElements(body, tag, () => true);
  for (const tag of ['table', 'div', 'section', 'ul', 'ol', 'span', 'sup', 'a', 'figure']) body = dropElements(body, tag, isFurniture);
  s = body
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<h([1-6])\b[^>]*>/gi, (_m, n: string) => `\n\n${'#'.repeat(Math.min(3, Number(n)))} `)
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<(?:td|th)\b[^>]*>/gi, ' | ')
    .replace(new RegExp(`<\\/(?:${BLOCK_TAGS})>`, 'gi'), '\n\n')
    .replace(new RegExp(`<(?:${BLOCK_TAGS})\\b[^>]*>`, 'gi'), '\n')
    .replace(/<[^>]+>/g, '');
  return decodeEntities(s)
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((l) => l.trim())
    // Table scaffolding and bare bullets left behind by removed cells.
    .filter((l) => !/^[|\-•·\s]*$/.test(l) || l === '')
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

type Fetched = { title: string | null; author: string | null; description: string | null; segments: string[] | null; error: string | null };

async function get(url: string, accept: string, maxBytes: number): Promise<{ type: string; buf: Buffer; url: string }> {
  const res = await fetch(url, { headers: { 'user-agent': USER_AGENT, accept, 'accept-language': 'en, *;q=0.5' }, redirect: 'follow', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const len = Number(res.headers.get('content-length') ?? 0);
  if (len > maxBytes) throw new Error(`larger than ${Math.round(maxBytes / 1024 / 1024)} MB`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > maxBytes) throw new Error(`larger than ${Math.round(maxBytes / 1024 / 1024)} MB`);
  return { type: (res.headers.get('content-type') ?? '').toLowerCase(), buf, url: res.url || url };
}

async function pdfSegments(buf: Buffer): Promise<string[]> {
  const { text } = await extractText(new Uint8Array(buf), { mergePages: false });
  return (text as string[]).map((t) => t.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim());
}

/** oEmbed gives a video's title and channel without scraping; YouTube's page carries the description. */
async function fetchVideo(url: string): Promise<Fetched> {
  const h = hostOf(url) ?? '';
  const out: Fetched = { title: null, author: null, description: null, segments: null, error: null };
  const oembed = isYouTube(h) ? `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json` : isVimeo(h) ? `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}` : null;
  if (oembed) {
    try {
      const { buf } = await get(oembed, 'application/json', 512 * 1024);
      const j = JSON.parse(buf.toString('utf8')) as { title?: string; author_name?: string };
      out.title = j.title?.trim() || null;
      out.author = j.author_name?.trim() || null;
    } catch (e) {
      out.error = `oEmbed: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
  try {
    const { buf } = await get(url, 'text/html', MAX_HTML_BYTES);
    const html = buf.toString('utf8');
    out.title ??= meta(html, 'og:title', 'twitter:title') ?? titleTag(html);
    out.author ??= meta(html, 'author', 'og:video:tag');
    let desc = meta(html, 'og:description', 'description');
    const m = /"shortDescription":"((?:[^"\\]|\\.)*)"/.exec(html);
    if (m) {
      try {
        desc = JSON.parse(`"${m[1]}"`) as string;
      } catch {
        /* keep meta description */
      }
    }
    out.description = desc ? desc.slice(0, 600) : null;
    if (desc && desc.trim()) out.segments = partsOf(`# ${out.title ?? 'Video'}\n\n${desc}`);
    out.error = null;
  } catch (e) {
    out.error ??= e instanceof Error ? e.message : String(e);
  }
  return out;
}

const titleTag = (html: string) => {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return m ? tidy(m[1]) || null : null;
};

/** arXiv abstract pages have a PDF next door; read the PDF for the text and the page for the metadata. */
const arxivPdf = (url: string) => {
  const m = /^https?:\/\/(?:www\.)?arxiv\.org\/abs\/([^?#]+)/i.exec(url);
  return m ? `https://arxiv.org/pdf/${m[1]}` : null;
};

async function fetchPage(url: string): Promise<Fetched> {
  const out: Fetched = { title: null, author: null, description: null, segments: null, error: null };
  try {
    const { type, buf, url: finalUrl } = await get(url, 'text/html,application/xhtml+xml,application/pdf;q=0.9,text/plain;q=0.8,*/*;q=0.5', MAX_PDF_BYTES);
    if (type.includes('application/pdf') || (finalUrl.toLowerCase().endsWith('.pdf') && buf.subarray(0, 5).toString() === '%PDF-')) {
      out.segments = await pdfSegments(buf);
      out.title = titleOf(out.segments[0] ?? '') || null;
      return out;
    }
    if (buf.byteLength > MAX_HTML_BYTES) throw new Error(`page larger than ${MAX_HTML_BYTES / 1024 / 1024} MB`);
    const text = buf.toString('utf8');
    if (type.includes('text/plain') || type.includes('text/markdown')) {
      out.segments = partsOf(text);
      out.title = titleOf(out.segments[0] ?? '') || null;
      return out;
    }
    const html = text;
    out.title = meta(html, 'citation_title', 'og:title', 'twitter:title', 'dc.title') ?? titleTag(html);
    const authors = metaAll(html, 'citation_author');
    out.author = authors.length ? authors.slice(0, 3).join(', ') + (authors.length > 3 ? ' et al.' : '') : meta(html, 'author', 'article:author', 'dc.creator', 'twitter:creator', 'byl');
    out.description = meta(html, 'og:description', 'description', 'citation_abstract');
    const pdf = arxivPdf(finalUrl) ?? arxivPdf(url);
    if (pdf) {
      try {
        const p = await get(pdf, 'application/pdf', MAX_PDF_BYTES);
        out.segments = await pdfSegments(p.buf);
        return out;
      } catch {
        /* fall through to the abstract page */
      }
    }
    const body = htmlToText(html);
    if (body.split(/\s+/).length >= 40) out.segments = partsOf(body);
    else if (out.description) out.segments = partsOf(`# ${out.title ?? ''}\n\n${out.description}`);
  } catch (e) {
    out.error = e instanceof Error ? e.message : String(e);
  }
  return out;
}

export async function fetchResource(url: string, kind: ResourceKind): Promise<Fetched> {
  const h = hostOf(url) ?? '';
  const f = kind === 'video' && (isYouTube(h) || isVimeo(h)) ? await fetchVideo(url) : await fetchPage(url);
  if (f.segments) {
    let text = f.segments.join(SEP);
    if (text.length > MAX_CHARS) {
      text = text.slice(0, MAX_CHARS) + `\n\n[Truncated: Derive keeps up to ${MAX_CHARS} characters of a saved page.]`;
      f.segments = text.split(SEP);
    }
  }
  return f;
}

// ---------- the shelf ----------

const cleanTags = (tags: unknown): string[] => {
  const arr = Array.isArray(tags) ? tags : typeof tags === 'string' ? tags.split(/[,;]/) : [];
  return [...new Set(arr.map((t) => String(t).trim().toLowerCase().replace(/^#/, '').replace(/\s+/g, '-')).filter((t) => t && t.length <= 40))].slice(0, 12);
};

export const tagsOf = (r: Pick<ResourceRow, 'tags'>): string[] => {
  try {
    const t = JSON.parse(r.tags || '[]');
    return Array.isArray(t) ? t.map(String) : [];
  } catch {
    return [];
  }
};

export type AddResourceInput = {
  url?: string | null;
  title?: string | null;
  kind?: string | null;
  author?: string | null;
  note?: string | null;
  tags?: unknown;
  /** Skip the network: metadata only (a book, a broken link, a test). */
  fetch?: boolean;
};

/**
 * Save an entry. With a URL the page is fetched now and its text kept; a
 * fetch that fails still saves the link, with the error on the row, so a
 * bad network never loses a bookmark. A URL already on the shelf is not
 * duplicated: the new note and tags are merged into the existing entry.
 */
export async function addResource(learnerId: string, input: AddResourceInput, by: { addedBy: 'learner' | 'tutor'; lessonId?: string | null }): Promise<{ resource: ResourceRow; existing: boolean }> {
  const url = input.url?.trim() ? normalizeUrl(input.url) : null;
  const givenTitle = input.title?.trim().slice(0, 200) || null;
  const note = input.note?.trim().slice(0, 2000) || null;
  const tags = cleanTags(input.tags);
  if (!url && !givenTitle) throw new Error('a url or a title is required');
  if (url) {
    const dup = resourceByUrl(learnerId, url);
    if (dup) {
      const merged = [...new Set([...tagsOf(dup), ...tags])];
      const mergedNote = note && !(dup.note ?? '').includes(note) ? [dup.note, note].filter(Boolean).join('\n') : dup.note;
      const row = updateResourceMeta(dup.id, { kind: isKind(input.kind) ? input.kind : dup.kind, title: givenTitle ?? dup.title, author: input.author?.trim() || dup.author, note: mergedNote, tags: merged });
      return { resource: row, existing: true };
    }
  }
  const kind: ResourceKind = isKind(input.kind) ? input.kind : url ? detectKind(url) : 'note';
  let fetched: Fetched | null = null;
  if (url && input.fetch !== false) fetched = await fetchResource(url, kind);
  const title = givenTitle ?? fetched?.title ?? (url ? `${hostOf(url)}${new URL(url).pathname.replace(/\/$/, '')}`.slice(0, 200) : 'Note');
  const text = fetched?.segments ? fetched.segments.join(SEP) : null;
  const row = insertResource({
    id: randomUUID(),
    learner_id: learnerId,
    kind,
    title,
    url,
    author: input.author?.trim().slice(0, 200) || fetched?.author?.slice(0, 200) || null,
    note: note ?? (kind !== 'note' && fetched?.description && !text ? fetched.description.slice(0, 600) : null),
    tags: JSON.stringify(tags),
    text,
    chars: text?.length ?? 0,
    fetched_at: url && input.fetch !== false ? Date.now() : null,
    fetch_error: fetched?.error && !text ? fetched.error : null,
    added_by: by.addedBy,
    lesson_id: by.lessonId ?? null,
  });
  return { resource: row, existing: false };
}

/** Fetch the URL again (the page changed, or the first fetch failed). */
export async function refetchResource(id: string): Promise<ResourceRow> {
  const r = getResource(id);
  if (!r) throw new Error('not found');
  if (!r.url) throw new Error('this entry has no URL to fetch');
  const f = await fetchResource(r.url, r.kind);
  const text = f.segments ? f.segments.join(SEP) : null;
  updateResourceText(id, { text: text ?? r.text, chars: text?.length ?? r.chars, fetched_at: Date.now(), fetch_error: f.error && !text ? f.error : null });
  if ((!r.title || r.title === hostOf(r.url)) && f.title) updateResourceMeta(id, { kind: r.kind, title: f.title, author: r.author ?? f.author, note: r.note, tags: tagsOf(r) });
  else if (!r.author && f.author) updateResourceMeta(id, { kind: r.kind, title: r.title, author: f.author, note: r.note, tags: tagsOf(r) });
  return resourceRow(getResource(id)!);
}

export function editResource(id: string, patch: { title?: unknown; kind?: unknown; author?: unknown; note?: unknown; tags?: unknown }): ResourceRow {
  const r = getResource(id);
  if (!r) throw new Error('not found');
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) || null : undefined);
  const title = str(patch.title, 200);
  return updateResourceMeta(id, {
    kind: isKind(patch.kind) ? patch.kind : r.kind,
    title: title === undefined ? r.title : (title ?? r.title),
    author: patch.author === undefined ? r.author : str(patch.author, 200) ?? null,
    note: patch.note === undefined ? r.note : str(patch.note, 2000) ?? null,
    tags: patch.tags === undefined ? tagsOf(r) : cleanTags(patch.tags),
  });
}

export { deleteResource, getResource, listResources };

// ---------- what the tutor sees ----------

export const segmentsOf = (r: ResourceFull): string[] => (r.text ? r.text.split(SEP) : []);

const words = (chars: number) => {
  const w = Math.round(chars / 6);
  return w >= 1000 ? `${Math.round(w / 1000)}k words` : `${w} words`;
};

/** One line per entry, as the tutor sees it in the catalog and in search hits. */
export function describeResource(r: ResourceRow): string {
  const bits = [r.author, hostOf(r.url), tagsOf(r).length ? tagsOf(r).map((t) => `#${t}`).join(' ') : null].filter(Boolean);
  const size = r.chars ? `${words(r.chars)} fetched` : r.kind === 'note' ? 'a note' : r.fetch_error ? 'not fetched' : 'metadata only';
  return `[${r.kind}] ${r.title}${bits.length ? ` (${bits.join(' · ')})` : ''} · ${size} · id ${r.id.slice(0, 8)}`;
}

const terms = (s: string) => [...new Set(s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((t) => t.length >= 3))];

/** Metadata relevance: title and tags count most, then the note and the author. */
function metaScore(r: ResourceRow, qs: string[]): number {
  if (!qs.length) return 0;
  const title = r.title.toLowerCase();
  const tags = tagsOf(r).join(' ');
  const note = (r.note ?? '').toLowerCase();
  const author = (r.author ?? '').toLowerCase();
  let score = 0;
  for (const t of qs) {
    if (title.includes(t)) score += 4;
    if (tags.includes(t)) score += 4;
    if (note.includes(t)) score += 2;
    if (author.includes(t)) score += 1;
  }
  return score;
}

/**
 * The library section of the system prompt: how to use it, then the entries
 * most relevant to the topic (by title, tags and note), or the most recent
 * ones when nothing matches. Empty when the shelf is empty.
 */
export function librarySection(learnerId: string, topic: string): string {
  const all = listResources(learnerId);
  if (!all.length) return '';
  const qs = terms(topic);
  const scored = all.map((r) => ({ r, s: metaScore(r, qs) }));
  const relevant = scored.filter((x) => x.s > 0).sort((a, b) => b.s - a.s || b.r.created_at - a.r.created_at);
  const shown = (relevant.length ? relevant : scored).slice(0, CATALOG_ENTRIES).map((x) => x.r);
  const byKind = new Map<string, number>();
  for (const r of all) byKind.set(r.kind, (byKind.get(r.kind) ?? 0) + 1);
  const counts = [...byKind].map(([k, n]) => `${n} ${k}${n === 1 ? '' : 's'}`).join(', ');
  const lines: string[] = [];
  lines.push(`

# The learner's library
The learner keeps a library of resources they trust, want to read, or have read (${all.length} entr${all.length === 1 ? 'y' : 'ies'}: ${counts}). It is theirs and it outlives this lesson. Four rules:
- Lean on it. Before you plan, \`search_library\` for the topic; when an entry covers the lesson, \`read_resource\` the relevant parts and borrow its framing, examples and notation where they are good. It is not a syllabus (attached course material is): the plan is still yours, derived from unconditional truths.
- Point to it. When a node locks, when the learner is curious past the goal, or when a source explains a step better than you can in chat, call \`suggest_resource\` with why and where to look (a chapter, a section, a timestamp). One entry at a time, when it earns its place; never a reading list. Only suggest what is in the library or what you have just saved. An entry that covers the lesson's topic (the list below) is one the learner put there to be used: point to it at least once, at the node where it helps most, and name it in the closing as where to go next. \`node_status\` tells you when a locked node has a related entry that has not been suggested yet.
- Grow it. When a web search or a fetch turns up a source worth keeping (the primary source, a lucid explanation, a good figure), save it with \`add_resource\` and one sentence on why; it is then on the learner's shelf with a note that you saved it. One or two per lesson at most, and only sources you actually read.
- Disagree when needed. A saved source can be wrong or sloppy. Teach the correct version and say so.
`);
  lines.push(relevant.length ? `Entries that look relevant to "${topic}" (of ${all.length}; \`search_library\` finds the rest):` : `The most recent entries (none matched "${topic}" by title or tag; \`search_library\` searches the text too):`);
  for (const r of shown) lines.push(`- ${describeResource(r)}${r.note ? ` — ${r.note.replace(/\s+/g, ' ').slice(0, 160)}` : ''}`);
  return lines.join('\n');
}

/** Resolve an entry by id, id prefix, exact title, or title fragment; the only candidate wins, several is an error. */
export function resolveResource(learnerId: string, ref: string | null | undefined): ResourceFull {
  const rows = listResources(learnerId);
  if (!rows.length) throw new Error('The library is empty.');
  const s = (ref ?? '').trim();
  if (!s) throw new Error('Pass the entry to read: its id (or the first characters of it) or its title.');
  const low = s.toLowerCase();
  const byId = rows.find((r) => r.id === s) ?? rows.filter((r) => r.id.startsWith(low));
  const hit = Array.isArray(byId) ? (byId.length === 1 ? byId[0] : undefined) : byId;
  if (hit) return getResource(hit.id)!;
  const exact = rows.filter((r) => r.title.toLowerCase() === low);
  if (exact.length === 1) return getResource(exact[0].id)!;
  const partial = rows.filter((r) => r.title.toLowerCase().includes(low) || (r.url ?? '').toLowerCase().includes(low));
  if (partial.length === 1) return getResource(partial[0].id)!;
  if (partial.length > 1) throw new Error(`Several entries match "${s}": ${partial.slice(0, 6).map((r) => `${r.title} (id ${r.id.slice(0, 8)})`).join('; ')}. Pass an id.`);
  throw new Error(`No library entry matches "${s}". Use search_library to find it.`);
}

export function readResource(learnerId: string, a: { id?: string | null; title?: string | null; from?: number | null; to?: number | null }) {
  const r = resolveResource(learnerId, a.id ?? a.title);
  const segs = segmentsOf(r);
  const head = { id: r.id, title: r.title, kind: r.kind, url: r.url, author: r.author, note: r.note, tags: tagsOf(r) };
  if (!segs.length) {
    return {
      ...head,
      total: 0,
      text: '',
      note_for_tutor: r.fetch_error
        ? `Nothing was fetched from this entry (${r.fetch_error}). Its URL is ${r.url}; use a fetch of the page to read it, and the learner's note above for what it is good for.`
        : r.kind === 'note'
          ? 'This is a plain note; the note field above is all of it.'
          : `This entry has metadata only (a ${r.kind}); use a fetch of the page on its URL if you need the content, or go by the learner's note.`,
    };
  }
  const from = Math.max(1, Math.min(segs.length, Math.floor(a.from ?? 1)));
  const to = Math.max(from, Math.min(segs.length, Math.floor(a.to ?? from + 9)));
  const chunks: string[] = [];
  let len = 0;
  let last = from - 1;
  for (let i = from; i <= to; i++) {
    const c = `--- part ${i} ---\n${segs[i - 1]}`;
    if (len + c.length > READ_CHARS && chunks.length) break;
    chunks.push(c);
    len += c.length + 2;
    last = i;
  }
  return { ...head, total: segs.length, from, to: last, ...(last < to ? { note_for_tutor: `Stopped at part ${last} to keep the reply short; call again from ${last + 1}.` } : {}), text: chunks.join('\n\n') };
}

export function searchLibrary(learnerId: string, a: { query: string; kind?: string | null; tag?: string | null; limit?: number | null }) {
  const rows = listResources(learnerId).filter((r) => (!a.kind || r.kind === a.kind) && (!a.tag || tagsOf(r).includes(String(a.tag).toLowerCase())));
  if (!rows.length) return { hits: [], total_matches: 0, library_size: listResources(learnerId).length, note: 'Nothing on the shelf matches that filter.' };
  const qs = terms(a.query);
  if (!qs.length) return { hits: rows.slice(0, Math.max(1, Math.min(20, a.limit ?? 8))).map((r) => ({ ...hitOf(r), snippet: r.note ?? '' })), total_matches: rows.length, library_size: rows.length };
  type Hit = ReturnType<typeof hitOf> & { score: number; snippet: string; part?: number; part_title?: string };
  const hits: Hit[] = [];
  for (const row of rows) {
    const r = getResource(row.id)!;
    const ms = metaScore(row, qs);
    let best: { i: number; score: number; snippet: string; title: string } | null = null;
    segmentsOf(r).forEach((seg, i) => {
      const low = seg.toLowerCase();
      let score = 0;
      let firstAt = -1;
      let found = 0;
      for (const t of qs) {
        let at = low.indexOf(t);
        if (at < 0) continue;
        found += 1;
        if (firstAt < 0 || at < firstAt) firstAt = at;
        let count = 0;
        while (at >= 0 && count < 5) {
          count += 1;
          at = low.indexOf(t, at + t.length);
        }
        score += count;
      }
      if (!found) return;
      if (found === qs.length) score += 10;
      if (!best || score > best.score) {
        const start = Math.max(0, firstAt - 140);
        best = { i, score, title: titleOf(seg), snippet: (start > 0 ? '…' : '') + seg.slice(start, start + 380).replace(/\s+/g, ' ').trim() + (start + 380 < seg.length ? '…' : '') };
      }
    });
    const b = best as { i: number; score: number; snippet: string; title: string } | null;
    if (!ms && !b) continue;
    hits.push({ ...hitOf(row), score: ms * 3 + (b?.score ?? 0), snippet: b?.snippet ?? row.note ?? '', ...(b ? { part: b.i + 1, part_title: b.title } : {}) });
  }
  hits.sort((x, y) => y.score - x.score || y.created_at - x.created_at);
  const limit = Math.max(1, Math.min(20, a.limit ?? 8));
  return { hits: hits.slice(0, limit).map(({ score: _s, ...h }) => h), total_matches: hits.length, library_size: rows.length };
}

const hitOf = (r: ResourceRow) => ({ id: r.id, kind: r.kind, title: r.title, url: r.url, author: r.author, tags: tagsOf(r), note: r.note, parts: r.chars ? undefined : 0, fetched: !!r.chars, created_at: r.created_at });

/**
 * Entries related to some text (a node's label and summary, a topic) that
 * have not been suggested in this lesson yet. Used to remind the tutor at
 * the moment a node locks; the tutor still decides whether it fits.
 */
export function relatedResources(learnerId: string, text: string, excludeIds: Iterable<string>, limit = 2): ResourceRow[] {
  const qs = terms(text);
  if (!qs.length) return [];
  const skip = new Set(excludeIds);
  return listResources(learnerId)
    .filter((r) => !skip.has(r.id))
    .map((r) => ({ r, s: metaScore(r, qs) }))
    .filter((x) => x.s >= 4)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.r);
}

/** Tag counts for the library page's filter row. */
export function tagCounts(learnerId: string): { tag: string; count: number }[] {
  const m = new Map<string, number>();
  for (const r of listResources(learnerId)) for (const t of tagsOf(r)) m.set(t, (m.get(t) ?? 0) + 1);
  return [...m].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/** The rows of the library page: metadata plus parsed tags and host. */
export const publicRow = (r: ResourceRow) => ({ ...r, tags: tagsOf(r), host: hostOf(r.url) });
