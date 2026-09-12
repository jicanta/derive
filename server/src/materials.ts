/**
 * Course material: the slides, PDFs and notes a learner attaches so a lesson
 * prepares them for a specific course rather than the topic in general.
 *
 * Files are reduced to text once, at upload, and stored as a list of
 * segments (pages for a PDF, slides for a deck, heading-delimited parts for
 * continuous text). The tutor sees an outline in its system prompt and pulls
 * ranges on demand with `read_material`, or locates things with
 * `search_material`. Short material is inlined whole.
 */
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { strFromU8, unzipSync } from 'fflate';
import { extractText } from 'unpdf';
import { getMaterial, insertMaterial, listMaterials, type MaterialFull, type MaterialRow } from './db.js';
import { collectRepo, type RepoSource } from './repo.js';

export type MaterialKind = MaterialRow['kind'];

/** Segments are joined with the ASCII record separator, which never survives extraction. */
export const SEP = '';
const SEP_RE = //g;
export const MAX_FILE_BYTES = 40 * 1024 * 1024;
/** Beyond this the tail is dropped; a semester of slides fits well below it. */
const MAX_CHARS = 1_500_000;
/** Material this short goes into the system prompt whole instead of behind the tools. */
export const INLINE_CHARS = 24_000;
const READ_CHARS = 14_000;

const KIND_BY_EXT: Record<string, MaterialKind> = {
  '.pdf': 'pdf',
  '.pptx': 'pptx',
  '.docx': 'docx',
  '.md': 'md',
  '.markdown': 'md',
  '.mdx': 'md',
  '.txt': 'txt',
  '.text': 'txt',
  '.tex': 'txt',
  '.rst': 'txt',
  '.org': 'txt',
};

export function kindOf(name: string): MaterialKind | null {
  return KIND_BY_EXT[extname(name).toLowerCase()] ?? null;
}

export const ACCEPTED = Object.keys(KIND_BY_EXT);

// ---------- extraction ----------

const clean = (s: string) =>
  s
    .replace(/\r\n?/g, '\n')
    .replace(SEP_RE, '')
    .replace(/[ \t ]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const XML_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decodeXml = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return XML_ENTITIES[e.toLowerCase()] ?? m;
  });

/** Paragraph text from an OOXML fragment: `<tag:p>` blocks, `<tag:t>` runs, tabs and breaks. */
function ooxmlParagraphs(xml: string, ns: 'a' | 'w'): string[] {
  const out: string[] = [];
  const paras = xml.split(new RegExp(`</${ns}:p>`));
  for (const p of paras) {
    let t = '';
    const re = new RegExp(`<${ns}:t(?:\\s[^>]*)?>([\\s\\S]*?)</${ns}:t>|<${ns}:tab/>|<${ns}:br/>|<a:br/>`, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(p))) {
      if (m[0].endsWith('tab/>')) t += '\t';
      else if (m[0].endsWith('br/>')) t += '\n';
      else t += decodeXml(m[1] ?? '');
    }
    t = t.replace(/[ \t]+/g, ' ').trim();
    if (t) out.push(t);
  }
  return out;
}

async function fromPdf(buf: Buffer): Promise<string[]> {
  const { text } = await extractText(new Uint8Array(buf), { mergePages: false });
  return (text as string[]).map(clean);
}

function fromPptx(buf: Buffer): string[] {
  const zip = unzipSync(new Uint8Array(buf));
  const slideNums = Object.keys(zip)
    .map((k) => /^ppt\/slides\/slide(\d+)\.xml$/.exec(k))
    .filter((m): m is RegExpExecArray => !!m)
    .map((m) => Number(m[1]))
    .sort((a, b) => a - b);
  if (!slideNums.length) throw new Error('no slides found in this .pptx');
  return slideNums.map((n) => {
    const xml = strFromU8(zip[`ppt/slides/slide${n}.xml`]);
    const body = ooxmlParagraphs(xml, 'a');
    const rels = zip[`ppt/slides/_rels/slide${n}.xml.rels`];
    if (rels) {
      const m = /Target="\.\.\/notesSlides\/(notesSlide\d+\.xml)"/.exec(strFromU8(rels));
      const notes = m && zip[`ppt/notesSlides/${m[1]}`];
      if (notes) {
        // Drop the slide-number placeholder that every notes page carries.
        const lines = ooxmlParagraphs(strFromU8(notes), 'a').filter((l) => !/^\d+$/.test(l));
        if (lines.length) body.push('', 'Speaker notes: ' + lines.join('\n'));
      }
    }
    return clean(body.join('\n'));
  });
}

function fromDocx(buf: Buffer): string[] {
  const zip = unzipSync(new Uint8Array(buf));
  const doc = zip['word/document.xml'];
  if (!doc) throw new Error('no document.xml in this .docx');
  return partsOf(ooxmlParagraphs(strFromU8(doc), 'w').join('\n\n'));
}

/**
 * Split continuous text into parts of a few thousand characters, preferring
 * to break at a heading, then at a blank line. Every part starts with the
 * heading it belongs to, so a part read on its own still has its context.
 */
export function partsOf(text: string, soft = 3500, hard = 6500): string[] {
  const lines = clean(text).split('\n');
  const parts: string[] = [];
  let cur: string[] = [];
  let len = 0;
  const flush = () => {
    const t = cur.join('\n').trim();
    if (t) parts.push(t);
    cur = [];
    len = 0;
  };
  for (const line of lines) {
    const heading = /^#{1,3}\s|^\\(section|subsection|chapter)\b/.test(line);
    if ((heading && len >= soft) || (line.trim() === '' && len >= hard)) flush();
    cur.push(line);
    len += line.length + 1;
  }
  flush();
  return parts.length ? parts : [''];
}

export async function extractSegments(name: string, buf: Buffer): Promise<{ kind: MaterialKind; unit: MaterialRow['unit']; segments: string[] }> {
  const kind = kindOf(name);
  if (!kind) throw new Error(`unsupported file type: ${extname(name) || name}. Use ${ACCEPTED.join(', ')}.`);
  if (buf.byteLength > MAX_FILE_BYTES) throw new Error(`${name} is larger than ${MAX_FILE_BYTES / 1024 / 1024} MB`);
  switch (kind) {
    case 'pdf':
      return { kind, unit: 'page', segments: await fromPdf(buf) };
    case 'pptx':
      return { kind, unit: 'slide', segments: fromPptx(buf) };
    case 'docx':
      return { kind, unit: 'part', segments: fromDocx(buf) };
    default:
      return { kind, unit: 'part', segments: partsOf(buf.toString('utf8')) };
  }
}

/** Reduce a file to text and store it. `lessonId` may be null: the lesson often does not exist yet. */
export async function ingestMaterial(name: string, buf: Buffer, lessonId: string | null): Promise<MaterialRow> {
  const { kind, unit, segments } = await extractSegments(name, buf);
  let text = segments.join(SEP);
  const words = text.replace(SEP_RE, ' ').split(/\s+/).filter(Boolean).length;
  if (words < 20) throw new Error(`${name}: no readable text found (a scanned PDF needs OCR first)`);
  if (text.length > MAX_CHARS) text = text.slice(0, MAX_CHARS) + `\n\n[Truncated: this file has more text than Derive keeps (${MAX_CHARS} characters).]`;
  return insertMaterial({ id: randomUUID(), lesson_id: lessonId, name: name.replace(/^.*[\\/]/, '').slice(0, 120), kind, unit, pages: segments.length, chars: text.length, text });
}

/**
 * A repository as material: one segment per file, the path on its first
 * line so the outline, the search hits and the read markers all name files.
 */
export async function ingestRepo(source: string, lessonId: string | null): Promise<MaterialRow> {
  const repo = await collectRepo(source);
  return storeRepo(repo, lessonId);
}

export function storeRepo(repo: RepoSource, lessonId: string | null): MaterialRow {
  if (!repo.files.length) throw new Error(`${repo.name}: no readable source or text files found`);
  const segments: string[] = [];
  let total = 0;
  let dropped = repo.skipped;
  for (const f of repo.files) {
    const seg = clean(`${f.path}\n${f.text}`);
    if (total + seg.length > MAX_CHARS) {
      dropped += 1;
      continue;
    }
    segments.push(seg);
    total += seg.length;
  }
  if (dropped) segments.push(`[${dropped} file${dropped === 1 ? '' : 's'} left out: binary, generated, larger than the limit, or past the ${MAX_CHARS}-character budget.]`);
  const text = segments.join(SEP);
  return insertMaterial({
    id: randomUUID(),
    lesson_id: lessonId,
    name: (repo.ref ? `${repo.name}@${repo.ref}` : repo.name).slice(0, 120),
    kind: 'repo',
    unit: 'file',
    pages: segments.length,
    chars: text.length,
    text,
  });
}

// ---------- what the tutor sees ----------

export const segmentsOf = (m: MaterialFull) => m.text.split(SEP);

const words = (chars: number) => {
  const w = Math.round(chars / 6);
  return w >= 1000 ? `${Math.round(w / 1000)}k words` : `${w} words`;
};

export const describe = (m: MaterialRow) =>
  m.kind === 'repo'
    ? `${m.name} (repository, ${m.pages} file${m.pages === 1 ? '' : 's'}, about ${words(m.chars)})`
    : `${m.name} (${m.kind}, ${m.pages} ${m.unit}${m.pages === 1 ? '' : 's'}, about ${words(m.chars)})`;

/** The first meaningful line of a segment: the slide title, the page's running head, the section heading. */
export function titleOf(seg: string) {
  const line = seg.split('\n').map((l) => l.replace(/^#+\s*/, '').trim()).find((l) => l.length >= 3) ?? '';
  return line.length > 64 ? line.slice(0, 61).trimEnd() + '…' : line;
}

/** A repo outline is its tree: one line per directory with the files in it, numbered so read_material can address them. */
function repoOutline(m: MaterialFull, budget = 7000) {
  const segs = segmentsOf(m);
  const byDir = new Map<string, string[]>();
  segs.forEach((s, i) => {
    const path = s.split('\n', 1)[0];
    if (path.startsWith('[')) return;
    const slash = path.lastIndexOf('/');
    const dir = slash < 0 ? '.' : path.slice(0, slash);
    if (!byDir.has(dir)) byDir.set(dir, []);
    byDir.get(dir)!.push(`${path.slice(slash + 1)} (${i + 1})`);
  });
  const lines: string[] = [];
  let len = 0;
  for (const [dir, files] of byDir) {
    const line = `${dir}/: ${files.join(', ')}`;
    if (len + line.length > budget) {
      lines.push(`… ${byDir.size - lines.length} more directories; use search_material or read_material by path`);
      break;
    }
    lines.push(line);
    len += line.length + 1;
  }
  return lines.join('\n  ');
}

function outlineOf(m: MaterialFull, budget = 2600) {
  if (m.kind === 'repo') return repoOutline(m);
  const segs = segmentsOf(m);
  const entries = segs.map((s, i) => `${i + 1} ${titleOf(s)}`);
  const out: string[] = [];
  let len = 0;
  for (const e of entries) {
    if (len + e.length > budget) {
      out.push(`… (${entries.length - out.length} more)`);
      break;
    }
    out.push(e);
    len += e.length + 3;
  }
  return out.join(' · ');
}

/** Everything the tutor is told about the material, appended to the system prompt. Empty when there is none. */
export function materialsSection(lessonId: string): string {
  const rows = listMaterials(lessonId);
  if (!rows.length) return '';
  const full = rows.map((r) => getMaterial(r.id)!);
  const total = full.reduce((n, m) => n + m.chars, 0);
  const lines: string[] = [];
  lines.push(`

# Course material the learner attached
The learner is preparing for a specific course and attached its material. It is the syllabus, not the authority:
- Scope. The goal and the plan must cover what this material covers, at the depth it goes to, in its notation and terminology. When the learner's stated goal is vaguer than the material, the material decides. Probe the prerequisites the material assumes, not the topic in general.
- Method unchanged. You still derive every node from unconditional truths. Slides state results; you make the learner discover them. Never walk through the slides in order.
- Cite. When a node corresponds to a place in the material, name it ("slides 12 to 15", "page 4") so the learner can go back to it. Use the course's own examples, symbols and edge cases in your questions: that is what their exam will use.
- Disagree when needed. If the material is wrong, sloppy, or skips a step, say so plainly, verify with WebSearch, and teach the correct version. Do not smooth it over.`);
  if (full.some((m) => m.kind === 'repo')) {
    lines.push(`
A repository is attached. Treat it as the course: the lesson teaches how this codebase works and the ideas it is built on.
- Read the README, the manifests and the entry points before you plan, then the files a node rests on before you teach it. Cite files by path ("see src/events.ts"). Quote the exact lines when a claim depends on them.
- The unconditional truths are the constraints the code cannot escape (the runtime, the protocol, the data model, the invariants the tests pin down); the derived nodes are the design decisions that follow from them. Make the learner discover why the code had to be shaped this way, not just what it does.
- Quiz with the code's own names, types and edge cases. A good question asks what a change would break, or which invariant a line protects.
- Never paste large stretches of code back to the learner: a few lines, then the reasoning.`);
  }
  if (total <= INLINE_CHARS) {
    lines.push('\nThe material is short, so here it is in full.\n');
    for (const m of full) {
      lines.push(`## ${describe(m)}`);
      segmentsOf(m).forEach((s, i) => lines.push(`\n--- ${m.unit} ${i + 1} ---\n${s}`));
      lines.push('');
    }
  } else {
    lines.push(
      '- Tools. `read_material` returns a range of pages, slides or files (a repo file can be read by `path`); `search_material` finds where something is covered. The outline below is titles only: read the relevant range BEFORE you plan, and again before you teach a node that maps to it.\n',
    );
    lines.push('## Outline');
    for (const m of full) lines.push(m.kind === 'repo' ? `- ${describe(m)}:\n  ${outlineOf(m)}` : `- ${describe(m)}: ${outlineOf(m)}`);
  }
  return lines.join('\n');
}

/** Resolve a material by id or by (partial) name; the only material when there is one. */
function resolve(lessonId: string, name?: string | null): MaterialFull {
  const rows = listMaterials(lessonId);
  if (!rows.length) throw new Error('This lesson has no attached material.');
  if (!name?.trim()) {
    if (rows.length === 1) return getMaterial(rows[0].id)!;
    throw new Error(`Several materials are attached; pass a name: ${rows.map((r) => r.name).join(', ')}`);
  }
  const n = name.trim().toLowerCase();
  const hit = rows.find((r) => r.id === name) ?? rows.find((r) => r.name.toLowerCase() === n) ?? rows.find((r) => r.name.toLowerCase().includes(n));
  if (!hit) throw new Error(`No material named "${name}". Attached: ${rows.map((r) => r.name).join(', ')}`);
  return getMaterial(hit.id)!;
}

/** The segment index of a repo file, by exact path, then by path suffix, then by file name. */
function fileIndex(segs: string[], path: string): number {
  const want = path.trim().replace(/^\.?\//, '').toLowerCase();
  const paths = segs.map((s) => s.split('\n', 1)[0].toLowerCase());
  const exact = paths.indexOf(want);
  if (exact >= 0) return exact;
  const suffix = paths.findIndex((p) => p.endsWith('/' + want));
  if (suffix >= 0) return suffix;
  const name = want.split('/').pop()!;
  const byName = paths.findIndex((p) => p === name || p.endsWith('/' + name));
  if (byName >= 0) return byName;
  throw new Error(`No file matching "${path}" in this repository. Use search_material, or the outline in your instructions.`);
}

export function readMaterial(lessonId: string, a: { name?: string | null; path?: string | null; from?: number | null; to?: number | null }) {
  const rows = listMaterials(lessonId);
  // A path selects the repo (the only one, or the one holding that path) and the file in it.
  const m = a.path?.trim() && !a.name?.trim() && rows.filter((r) => r.kind === 'repo').length === 1 ? getMaterial(rows.find((r) => r.kind === 'repo')!.id)! : resolve(lessonId, a.name);
  const segs = segmentsOf(m);
  let from = Math.max(1, Math.min(segs.length, Math.floor(a.from ?? 1)));
  let to = Math.max(from, Math.min(segs.length, Math.floor(a.to ?? from + 9)));
  if (a.path?.trim()) {
    if (m.kind !== 'repo') throw new Error(`"${m.name}" is not a repository; pass from/to instead of path.`);
    from = fileIndex(segs, a.path) + 1;
    to = Math.max(from, Math.min(segs.length, Math.floor(a.to ?? from)));
  }
  const chunks: string[] = [];
  let len = 0;
  let last = from - 1;
  for (let i = from; i <= to; i++) {
    const c = `--- ${m.unit} ${i} ---\n${segs[i - 1]}`;
    if (len + c.length > READ_CHARS && chunks.length) break;
    chunks.push(c);
    len += c.length + 2;
    last = i;
  }
  return {
    name: m.name,
    unit: m.unit,
    total: segs.length,
    from,
    to: last,
    ...(last < to ? { note: `Stopped at ${m.unit} ${last} to keep the reply short; call again from ${last + 1}.` } : {}),
    text: chunks.join('\n\n'),
  };
}

export function searchMaterial(lessonId: string, a: { query: string; name?: string | null; limit?: number | null }) {
  const rows = listMaterials(lessonId);
  const targets = a.name?.trim() ? [resolve(lessonId, a.name)] : rows.map((r) => getMaterial(r.id)!);
  const terms = [...new Set(a.query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((t) => t.length >= 2))];
  if (!terms.length) return { hits: [], note: 'Empty query.' };
  type Hit = { name: string; unit: string; index: number; title: string; score: number; snippet: string };
  const hits: Hit[] = [];
  for (const m of targets) {
    segmentsOf(m).forEach((seg, i) => {
      const low = seg.toLowerCase();
      let score = 0;
      let firstAt = -1;
      let found = 0;
      for (const t of terms) {
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
      if (found === terms.length) score += 10;
      const start = Math.max(0, firstAt - 160);
      const snippet = (start > 0 ? '…' : '') + seg.slice(start, start + 420).replace(/\s+/g, ' ').trim() + (start + 420 < seg.length ? '…' : '');
      hits.push({ name: m.name, unit: m.unit, index: i + 1, title: titleOf(seg), score, snippet });
    });
  }
  hits.sort((x, y) => y.score - x.score || x.index - y.index);
  const limit = Math.max(1, Math.min(20, a.limit ?? 8));
  return { hits: hits.slice(0, limit).map(({ score: _s, ...h }) => h), total_matches: hits.length };
}

export { listMaterials };
