/**
 * A code repository as course material. Collects the readable text files of
 * a repo, from a local directory (respecting .gitignore through `git
 * ls-files` when git is there), a GitHub URL (the tarball, no git needed)
 * or any other git URL (a shallow clone), in an order that puts the README,
 * the docs and the manifests before the source.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, extname, join, parse, relative, resolve, sep } from 'node:path';
import { gunzipSync } from 'fflate';
import { DATA_DIR } from './config.js';
// This import closes a ring: repo -> library -> materials -> repo. It resolves because nothing in the ring reads another module's bindings while the modules are evaluating -- library.ts uses partsOf/SEP/titleOf only inside function bodies, and materials.ts calls collectRepo only inside attachRepo. A second copy of assertPublicHost would avoid the ring and is exactly the wrong answer: two destination guards drift apart, and then one egress is weaker than the rest.
import { assertPublicHost } from './library.js';

export type RepoFile = { path: string; text: string };
export type RepoSource = { name: string; files: RepoFile[]; skipped: number; ref?: string };

/** Per file; a long file is cut with a note so one generated blob cannot eat the budget. */
export const FILE_CHARS = 60_000;
const READ_BYTES = 400 * 1024;
export const MAX_FILES = 1500;

const SKIP_DIRS = new Set([
  '.git', '.hg', '.svn', 'node_modules', 'bower_components', 'vendor', 'dist', 'build', 'out', 'target', 'bin', 'obj',
  '.next', '.nuxt', '.svelte-kit', '.output', '.turbo', '.cache', '.parcel-cache', 'coverage', '.nyc_output',
  '__pycache__', '.venv', 'venv', 'env', '.tox', '.mypy_cache', '.pytest_cache', '.ruff_cache', 'site-packages',
  '.idea', '.vscode', '.gradle', '.terraform', 'Pods', 'DerivedData', '.dart_tool', 'zig-cache', 'zig-out',
]);
const SKIP_FILES = new Set([
  'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb', 'bun.lock', 'Cargo.lock', 'poetry.lock', 'Pipfile.lock',
  'go.sum', 'composer.lock', 'Gemfile.lock', 'flake.lock', 'mix.lock', 'pubspec.lock', 'packages.lock.json', '.DS_Store',
]);
const TEXT_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts', '.py', '.pyi', '.rb', '.go', '.rs', '.java', '.kt', '.kts', '.scala',
  '.c', '.h', '.cpp', '.hpp', '.cc', '.hh', '.cxx', '.cs', '.swift', '.m', '.mm', '.php', '.pl', '.pm', '.sh', '.bash', '.zsh', '.fish',
  '.ps1', '.sql', '.r', '.jl', '.lua', '.ex', '.exs', '.erl', '.hs', '.ml', '.mli', '.fs', '.fsx', '.clj', '.cljs', '.edn', '.dart',
  '.vue', '.svelte', '.astro', '.html', '.htm', '.css', '.scss', '.sass', '.less', '.md', '.markdown', '.mdx', '.rst', '.txt', '.tex',
  '.org', '.json', '.json5', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf', '.xml', '.proto', '.graphql', '.gql', '.prisma',
  '.cmake', '.gradle', '.bzl', '.bazel', '.nix', '.el', '.vim', '.lisp', '.scm', '.rkt', '.zig', '.v', '.odin', '.nim', '.cr', '.sol',
  '.tf', '.hcl', '.env.example', '.example', '.txt', '.csv', '.ipynb',
]);
const TEXT_NAMES = new Set(['Makefile', 'Dockerfile', 'Rakefile', 'Gemfile', 'Procfile', 'CMakeLists.txt', 'LICENSE', 'LICENCE', 'README', 'NOTICE', 'CHANGELOG', 'AUTHORS', 'CODEOWNERS', 'Justfile', 'justfile', '.gitignore', '.editorconfig']);
const MANIFESTS = new Set(['package.json', 'pyproject.toml', 'setup.py', 'Cargo.toml', 'go.mod', 'pom.xml', 'build.gradle', 'build.gradle.kts', 'Gemfile', 'composer.json', 'mix.exs', 'pubspec.yaml', 'Package.swift', 'CMakeLists.txt', 'Makefile', 'Dockerfile', 'docker-compose.yml', 'compose.yaml', 'tsconfig.json']);

const isTextName = (path: string) => {
  const name = basename(path);
  if (SKIP_FILES.has(name) || /\.min\.(js|css)$/.test(name) || /\.(map|snap|lock)$/.test(name)) return false;
  const ext = extname(name).toLowerCase();
  return TEXT_EXTS.has(ext) || TEXT_NAMES.has(name) || (!ext && /^(readme|license|licence|changelog|dockerfile|makefile)/i.test(name));
};

/**
 * Files that hold credentials rather than code. A repository import puts
 * everything it collects where the tutor and the API can read it, so these
 * are refused outright — both when the list is built and when the tree is
 * walked, so a matching file is never even collected.
 */
export const isSecretName = (path: string) => {
  const name = basename(path);
  const ext = extname(name).toLowerCase();
  return ext === '.pem' || ext === '.key' || name === 'credentials' || name === '.netrc' || name === '.npmrc' || name === 'auth.json' || name.startsWith('id_') || name.startsWith('.env');
};

const inSkippedDir = (path: string) => path.split('/').slice(0, -1).some((d) => SKIP_DIRS.has(d));

/** README first, then docs, then manifests, then source by path; tests and fixtures last. */
function rank(path: string): number {
  const name = basename(path).toLowerCase();
  const depth = path.split('/').length - 1;
  if (/^readme/.test(name)) return depth === 0 ? 0 : 1;
  if (/^(docs?|documentation|guide|wiki)\//i.test(path) && /\.(md|mdx|rst|txt)$/i.test(name)) return 2;
  if (MANIFESTS.has(basename(path)) && depth === 0) return 3;
  if (/(^|\/)(tests?|__tests__|spec|specs|fixtures?|testdata|examples?|samples?)\//i.test(path) || /\.(test|spec)\.[a-z]+$/i.test(name)) return 6;
  if (/\.(md|mdx|rst|txt)$/i.test(name)) return 4;
  return 5;
}

const orderFiles = (paths: string[]) => paths.sort((a, b) => rank(a) - rank(b) || a.split('/').length - b.split('/').length || a.localeCompare(b));

const looksBinary = (buf: Buffer) => buf.subarray(0, 8000).includes(0);

function readText(buf: Buffer, path: string): string | null {
  if (looksBinary(buf)) return null;
  let text = buf.toString('utf8').replace(/\r\n?/g, '\n');
  if (path.endsWith('.ipynb')) text = notebookText(text) ?? text;
  if (text.length > FILE_CHARS) text = text.slice(0, FILE_CHARS) + `\n\n[cut: ${path} continues for ${text.length - FILE_CHARS} more characters]`;
  return text;
}

/** A notebook's cells as text, outputs dropped. */
function notebookText(raw: string): string | null {
  try {
    const nb = JSON.parse(raw) as { cells?: { cell_type: string; source: string | string[] }[] };
    if (!Array.isArray(nb.cells)) return null;
    return nb.cells
      .map((c) => {
        const src = Array.isArray(c.source) ? c.source.join('') : c.source;
        return c.cell_type === 'markdown' ? src : '```\n' + src + '\n```';
      })
      .join('\n\n');
  } catch {
    return null;
  }
}

// ---------- local directory ----------

export const expandHome = (p: string) => resolve(p.replace(/^~(?=$|[\\/])/, homedir()));

function gitListFiles(dir: string): string[] | null {
  if (!existsSync(join(dir, '.git'))) return null;
  try {
    const out = execFileSync('git', ['-C', dir, 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    return out.split('\0').filter(Boolean);
  } catch {
    return null;
  }
}

function walk(dir: string, root = dir, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries.sort()) {
    const full = join(dir, e);
    let st;
    try {
      // The link, never what it points at: a repo is attacker-controlled data, so a link inside it can name the learner's install token or ssh key, and a link to a directory can name one of its own ancestors and walk forever.
      st = lstatSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (!SKIP_DIRS.has(e)) walk(full, root, out);
    } else if (st.isFile() && !isSecretName(e)) out.push(relative(root, full).split(sep).join('/'));
    if (out.length > MAX_FILES * 4) break;
  }
  return out;
}

export function fromDirectory(rawPath: string): RepoSource {
  const dir = expandHome(rawPath);
  // Importing a whole home directory or a whole disk is never what the learner meant, and both are full of things the tutor should not read.
  if (dir === parse(dir).root || dir === homedir()) throw new Error('that is your home folder or the whole disk, not a project: name the project folder instead');
  const st = statSync(dir, { throwIfNoEntry: false });
  if (!st?.isDirectory()) throw new Error(`Not a directory: ${rawPath}`);
  const all = (gitListFiles(dir) ?? walk(dir)).filter((p) => !inSkippedDir(p) && !isSecretName(p) && isTextName(p));
  // git ls-files reports a path, not where it lands: an ordinary file under a symlinked intermediate directory is outside this tree, and no check on the leaf can see that.
  const rootReal = realpathSync(dir);
  const files: RepoFile[] = [];
  let skipped = 0;
  for (const path of orderFiles(all)) {
    if (files.length >= MAX_FILES) {
      skipped += 1;
      continue;
    }
    const full = join(dir, path);
    let real;
    try {
      real = realpathSync(full);
    } catch {
      continue;
    }
    // Compared on the separator, so a sibling folder whose name merely begins with this one's is not admitted.
    if (real !== rootReal && !real.startsWith(rootReal + sep)) {
      skipped += 1;
      continue;
    }
    let fst;
    try {
      fst = lstatSync(full);
    } catch {
      continue;
    }
    if (!fst.isFile() || fst.size > READ_BYTES) {
      skipped += 1;
      continue;
    }
    const text = readText(readFileSync(full), path);
    if (text === null) {
      skipped += 1;
      continue;
    }
    files.push({ path, text });
  }
  return { name: basename(dir), files, skipped };
}

// ---------- remote ----------

const GITHUB_RE = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/(?:tree|blob)\/([^/]+)(?:\/(.*))?)?\/?$/i;

export const isRepoUrl = (s: string) => /^(https?:\/\/|git@|ssh:\/\/|git:\/\/)/i.test(s.trim());

/** A ustar/GNU tar stream as (path, bytes) pairs; only regular files. */
function* untar(buf: Uint8Array): Generator<{ path: string; data: Uint8Array }> {
  let off = 0;
  let longName: string | null = null;
  const str = (a: number, n: number) => {
    const end = buf.indexOf(0, off + a);
    return new TextDecoder().decode(buf.subarray(off + a, Math.min(off + a + n, end < 0 ? off + a + n : end)));
  };
  while (off + 512 <= buf.length) {
    if (buf[off] === 0) break;
    const size = parseInt(str(124, 12).trim() || '0', 8);
    const type = String.fromCharCode(buf[off + 156] || 48);
    const prefix = str(345, 155);
    let name = str(0, 100);
    if (prefix) name = `${prefix}/${name}`;
    const data = buf.subarray(off + 512, off + 512 + size);
    off += 512 + Math.ceil(size / 512) * 512;
    if (type === 'L') {
      longName = new TextDecoder().decode(data).replace(/\0+$/, '');
      continue;
    }
    if (longName) {
      name = longName;
      longName = null;
    }
    if (type === '0' || type === '\0' || type === '') yield { path: name, data };
  }
}

/** A repository archive is buffered and then decompressed in memory, so the cap here is what bounds both. */
export const MAX_TARBALL_BYTES = 60 * 1024 * 1024;
const TARBALL_TIMEOUT_MS = 60_000;
const tooBig = (maxBytes: number) => new Error(`that repository's archive is larger than ${Math.round(maxBytes / 1024 / 1024)} MB; clone it and point derive at the folder instead`);

/** The body, refused on a declared length over the cap and bounded while reading so a server that declares nothing cannot grow the buffer without limit. */
export async function readCapped(res: Response, maxBytes: number): Promise<Uint8Array> {
  if (Number(res.headers.get('content-length') ?? 0) > maxBytes) throw tooBig(maxBytes);
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array(0);
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw tooBig(maxBytes);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

async function fromGitHub(owner: string, repo: string, ref?: string, subdir?: string): Promise<RepoSource> {
  const url = `https://api.github.com/repos/${owner}/${repo}/tarball${ref ? `/${ref}` : ''}`;
  const res = await fetch(url, { headers: { 'user-agent': 'derive', accept: 'application/vnd.github+json' }, redirect: 'follow', signal: AbortSignal.timeout(TARBALL_TIMEOUT_MS) });
  if (!res.ok) throw new Error(res.status === 404 ? `GitHub has no repository ${owner}/${repo}${ref ? ` at ${ref}` : ''} (or it is private)` : `GitHub returned ${res.status} for ${owner}/${repo}`);
  const tar = gunzipSync(await readCapped(res, MAX_TARBALL_BYTES));
  const files: RepoFile[] = [];
  const raw: { path: string; data: Uint8Array }[] = [];
  const sub = subdir ? subdir.replace(/\/+$/, '') + '/' : '';
  for (const f of untar(tar)) {
    // The tarball wraps everything in "<owner>-<repo>-<sha>/".
    const path = f.path.split('/').slice(1).join('/');
    if (!path || (sub && !path.startsWith(sub))) continue;
    raw.push({ path: sub ? path.slice(sub.length) : path, data: f.data });
  }
  const byPath = new Map(raw.map((f) => [f.path, f]));
  const paths = orderFiles([...byPath.keys()].filter((p) => !inSkippedDir(p) && isTextName(p)));
  let skipped = 0;
  for (const path of paths) {
    const f = byPath.get(path)!;
    if (files.length >= MAX_FILES || f.data.byteLength > READ_BYTES) {
      skipped += 1;
      continue;
    }
    const text = readText(Buffer.from(f.data), path);
    if (text === null) {
      skipped += 1;
      continue;
    }
    files.push({ path, text });
  }
  return { name: `${owner}/${repo}${subdir ? `/${subdir.replace(/\/+$/, '')}` : ''}`, files, skipped, ref };
}

async function fromGitClone(url: string): Promise<RepoSource> {
  // Both checks run before the process is spawned, not inside a try around it: git over ssh would hand the learner's own keys to whatever the URL names, and a URL pointing at this machine or this network would read an internal host through git instead of through fetch. The scheme check stays first so an ssh or git URL still gets its own sentence rather than a lookup error; the host guard runs before the scratch directory exists, so a refusal leaves nothing behind.
  if (!/^https:\/\//i.test(url.trim())) throw new Error(`derive only clones over https (got ${url.trim()}); an ssh or git URL would use your own keys`);
  await assertPublicHost(url.trim());
  const tmp = mkdtempSync(join(DATA_DIR, 'clone-'));
  try {
    execFileSync('git', ['clone', '--depth', '1', '--quiet', url, tmp], { stdio: ['ignore', 'ignore', 'pipe'], timeout: 120_000 });
  } catch (e) {
    rmSync(tmp, { recursive: true, force: true });
    const msg = e instanceof Error && 'stderr' in e ? String((e as { stderr?: Buffer }).stderr ?? '').trim() : '';
    throw new Error(`git clone failed for ${url}${msg ? `: ${msg.split('\n').at(-1)}` : ' (is git installed?)'}`);
  }
  try {
    const src = fromDirectory(tmp);
    return { ...src, name: basename(url.replace(/\/+$/, '')).replace(/\.git$/, '') || src.name };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/** A repo from wherever the learner pointed: a folder on this machine, a GitHub page, or a git URL. */
export async function collectRepo(source: string): Promise<RepoSource> {
  const s = source.trim();
  if (!s) throw new Error('repo path or URL required');
  const gh = GITHUB_RE.exec(s);
  if (gh) return fromGitHub(gh[1], gh[2], gh[3] ? decodeURIComponent(gh[3]) : undefined, gh[4] ? decodeURIComponent(gh[4]) : undefined);
  if (isRepoUrl(s)) return await fromGitClone(s);
  return fromDirectory(s);
}
