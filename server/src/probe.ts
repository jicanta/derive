/**
 * One detection pass: which logins this machine has and which local model
 * servers are answering, found on demand and remembered for the resolver.
 *
 * Detection is a probe of a JSON shape, never a check that a port is open.
 * The default ports the local servers use are the most reused developer
 * ports there are: on the machine this was written on, 8080 is a trading
 * dashboard (FreqUI behind uvicorn) that answers HTTP 200 with HTML on every
 * path, and a pass that read "something answered" as "llama.cpp is here"
 * would have labelled it `found on port 8080`. So each server is asked the
 * one endpoint only it answers, and the row is found only when the body has
 * the shape that server is known to return: Ollama's `/api/tags` carries a
 * `models` array, LM Studio's `/api/v0/models` is an OpenAI-style list, and
 * llama.cpp's `/health` says `status: ok` (or 503 with an `unavailable_error`
 * while a model loads, which is still llama.cpp). Anything else is `not
 * configured`, silently; absence is a fact, not a sentence.
 *
 * The pass is short and parallel so the settings page never waits on it:
 * every probe is bounded by a few hundred milliseconds, `claude auth status`
 * runs through an asynchronous spawn with the same cap the synchronous
 * detector has, and everything goes out in one `Promise.all`. Only the
 * boolean leaves the CLI's answer — its JSON carries the learner's email and
 * organisation, and a settings response is read by the browser and echoed
 * into plugin transcripts. Probes follow no redirect and send no key.
 *
 * The model list and the connection test live here too, because they are the
 * same read the detection pass makes, with the row's key attached: the
 * provider's models endpoint, or a local server's own list. One table builds
 * each request from the catalogue — the URL, the header the key rides in, the
 * shape of the answer — so a key travels only in a header and only to that
 * row's host, or on the OpenAI-compatible row to the address the learner
 * stored. No request follows a redirect: a 3xx is reported as a failure,
 * since following it could carry the key to a third host. A failure is the
 * provider's own sentence after its status code, cut to one line, and
 * Derive's fix hint is a separate field beside it, never folded into the
 * sentence. A host that did not answer at all gets Derive's sentence instead,
 * so a closed port is never quoted as if the provider had spoken. Every
 * sentence a test answers passes through safeMessage, because a provider that
 * echoes the key in its error must not reach the browser.
 *
 * Nothing here runs unasked: the pass is what `POST /api/settings/detect`
 * awaits when the page opens and when the learner presses rescan, and the
 * list and the test run only when the learner presses their buttons. The
 * environment is read only through `config.ts` constants, by way of the
 * modules this one imports.
 */
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { codexLoggedIn } from './backend.js';
import { CODEX_HOME } from './config.js';
import { providerOf, type ProviderSpec } from './providers.js';
import { safeMessage } from './secrets.js';
import { effectiveKey, localBase, portOf, rememberDetection, type Detection, type Local, type Logins } from './settings.js';

const run = promisify(execFile);

/** How long a local probe may take. A server on this machine answers in milliseconds; anything slower is treated as absent. */
export const PROBE_MS = 400;

/** What a probe saw: the status and the parsed body (null when it was not JSON), or null when nothing answered at all. */
export type Probe = { status: number; body: unknown } | null;

/** GET a URL expecting JSON, within `ms`. Refused, closed, timed out or redirected elsewhere all read as null; a non-JSON body reads as `body: null` with its status kept. */
export async function probeJson(url: string, ms = PROBE_MS): Promise<Probe> {
  try {
    const res = await fetch(url, { headers: { accept: 'application/json' }, redirect: 'manual', signal: AbortSignal.timeout(ms) });
    const text = await res.text();
    try {
      return { status: res.status, body: JSON.parse(text) as unknown };
    } catch {
      return { status: res.status, body: null };
    }
  } catch {
    return null;
  }
}

const field = (body: unknown, key: string): unknown => (body && typeof body === 'object' ? (body as Record<string, unknown>)[key] : undefined);

/** Ollama's `/api/tags`: a 200 whose body carries a `models` array. */
export const isOllama = (p: Probe): boolean => !!p && p.status === 200 && Array.isArray(field(p.body, 'models'));

/** LM Studio's `/api/v0/models`: a 200 whose body is an OpenAI-style list. */
export const isLmStudio = (p: Probe): boolean => !!p && p.status === 200 && field(p.body, 'object') === 'list';

/**
 * llama.cpp's `/health`: a 200 saying `status: ok`, or a 503 whose error is
 * `unavailable_error`, which the server answers while a model is still
 * loading. The check reads those fields and nothing else, so a body carrying
 * extra keys beside `status: ok` still passes; it is a shape, not a schema.
 */
export const isLlamaCpp = (p: Probe): boolean =>
  !!p && ((p.status === 200 && field(p.body, 'status') === 'ok') || (p.status === 503 && field(field(p.body, 'error'), 'type') === 'unavailable_error'));

/** The asynchronous twin of `claudeLoggedIn`: same argv, same cap, and only `loggedIn` is read from the CLI's JSON. */
export async function claudeLoggedInAsync(): Promise<boolean> {
  try {
    const { stdout } = await run('claude', ['auth', 'status'], { encoding: 'utf8', timeout: 15000 });
    return !!(JSON.parse(stdout) as { loggedIn?: boolean }).loggedIn;
  } catch {
    return false;
  }
}

/** The endpoint each local server is asked, and the shape that proves it is the one answering. */
const LOCAL_PROBES: readonly { id: keyof Local; path: string; shape: (p: Probe) => boolean }[] = [
  { id: 'ollama', path: '/api/tags', shape: isOllama },
  { id: 'lmstudio', path: '/api/v0/models', shape: isLmStudio },
  { id: 'llamacpp', path: '/health', shape: isLlamaCpp },
];

/** The port a local row is found on when its shape check passes at the stored or default base, else null. */
async function probeLocal(spec: ProviderSpec, path: string, shape: (p: Probe) => boolean): Promise<number | null> {
  const base = localBase(spec);
  if (!base) return null;
  return shape(await probeJson(`${base}${path}`)) ? portOf(base) : null;
}

/** Run the whole pass at once — both logins and the three local probes — and remember what it found for both resolvers and the settings view. */
export async function detect(): Promise<Detection> {
  const [claude, codex, ...found] = await Promise.all([
    claudeLoggedInAsync(),
    codexLoggedIn(),
    ...LOCAL_PROBES.map((probe) => probeLocal(providerOf(probe.id)!, probe.path, probe.shape)),
  ]);
  const logins: Logins = { 'claude-code': claude, codex };
  const local = Object.fromEntries(LOCAL_PROBES.map((probe, i) => [probe.id, found[i] ?? null])) as Local;
  return rememberDetection({ logins, local });
}

// ---------- model lists and connection tests ----------

/** How long a model list or a connection test may take against a host on the internet. */
export const REMOTE_MS = 8_000;

/** The same bound for a host on this machine or the local network, where a slow answer means something is wrong rather than far away. */
export const LOCAL_MS = 4_000;

/** What a connection test answers: the model count and latency, or the provider's sentence with Derive's hint beside it. `models` is null on a login, which has no list to count. */
export type TestResult = { ok: true; models: number | null; ms: number } | { ok: false; error: string; hint?: string; ms: number };

/** The request a row's model list is fetched with: where it goes, and the headers the key rides in. */
export type ModelsRequest = { url: string; headers: Record<string, string> };

/** A base that already ends in /v1 is used as it is; any other has /v1 appended, so both `https://host` and `https://host/v1` reach `/v1/models`. */
const v1 = (base: string): string => (/\/v1$/.test(base) ? base : `${base}/v1`);

/** The bearer header when a key is set, nothing when none is: a local server without a token must not see an empty Authorization line. */
const bearer = (key: string | undefined): Record<string, string> => (key ? { authorization: `Bearer ${key}` } : {});

/**
 * Whether a URL names this machine or a private network, judged on the
 * literal host with no lookup: loopback, link-local, the RFC 1918 ranges,
 * CGNAT, `localhost` and `.local` names, and the IPv6 loopback and
 * unique-local ranges. This decides the timeout and the shape of the
 * unreachable sentence; it decides nothing about whether the request is
 * allowed, because a learner's own local endpoint is the point of that row.
 */
export function isLocalUrl(url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  const h = host.replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h === '::1' || h === '::') return true;
  if (/^f[cd][0-9a-f]{2}:/.test(h) || /^fe[89ab][0-9a-f]:/.test(h)) return true;
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(h);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  return a === 127 || a === 10 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

/** The bound a request to this URL gets. */
const timeoutFor = (url: string): number => (isLocalUrl(url) ? LOCAL_MS : REMOTE_MS);

/**
 * Build the request for a row's model list from the catalogue and nothing
 * else. The key goes in the header each provider reads — Anthropic's
 * `x-api-key` with its version header, Google's `x-goog-api-key` and never a
 * `key=` query parameter that would land in logs and proxies, a bearer for
 * the rest — and only when one is set. A login has no list. The
 * OpenAI-compatible row needs the address the learner stored before it can
 * be asked anything; a local row falls back to its catalogue default.
 */
export function requestFor(spec: ProviderSpec, key: string | undefined, base: string | undefined): ModelsRequest {
  switch (spec.id) {
    case 'claude-code':
    case 'codex':
      throw new Error(`${spec.label} has no model list`);
    case 'openai-compatible':
      if (!base) throw new Error("Add the endpoint's base URL first");
      return { url: `${v1(base)}/models`, headers: bearer(key) };
    case 'anthropic':
      return { url: `${spec.endpoint}${spec.modelsPath}`, headers: { ...(key ? { 'x-api-key': key } : {}), 'anthropic-version': '2023-06-01' } };
    case 'gemini':
      return { url: `${spec.endpoint}${spec.modelsPath}`, headers: key ? { 'x-goog-api-key': key } : {} };
    case 'openai':
    case 'openrouter':
      return { url: `${spec.endpoint}${spec.modelsPath}`, headers: bearer(key) };
    case 'ollama':
    case 'lmstudio':
    case 'llamacpp': {
      const at = base ?? spec.endpoint;
      if (!at) throw new Error(`${spec.label} has no address to ask`);
      // Ollama takes no key; the other two may have been started with a bearer token.
      return { url: `${at}${spec.modelsPath}`, headers: spec.id === 'ollama' ? {} : bearer(key) };
    }
  }
}

const list = (body: unknown, key: string): unknown[] => {
  const v = field(body, key);
  return Array.isArray(v) ? v : [];
};

const str = (o: unknown, key: string): string | null => {
  const v = field(o, key);
  return typeof v === 'string' && v ? v : null;
};

/** First occurrence kept, order otherwise the provider's; blanks dropped. */
const dedupe = (ids: (string | null)[]): string[] => [...new Set(ids.filter((id): id is string => !!id))];

/**
 * The model ids in a provider's answer, in the provider's order with
 * duplicates removed. OpenAI-shaped lists are `data[].id`; Gemini names
 * models `models/<id>` and says what each can do, so the prefix is dropped
 * and only entries that can `generateContent` are kept (an entry that says
 * nothing is kept too); Ollama's tags are `models[].name`; LM Studio's list
 * carries a `state`, and the loaded models come first so the one that can
 * answer now is the one the combobox offers first. A body without the
 * expected array is an empty list, never an error.
 */
export function idsOf(spec: Pick<ProviderSpec, 'id'>, body: unknown): string[] {
  switch (spec.id) {
    case 'gemini':
      return dedupe(
        list(body, 'models')
          .filter((m) => {
            const methods = field(m, 'supportedGenerationMethods');
            return !Array.isArray(methods) || methods.includes('generateContent');
          })
          .map((m) => str(m, 'name')?.replace(/^models\//, '') ?? null),
      );
    case 'ollama':
      return dedupe(list(body, 'models').map((m) => str(m, 'name')));
    case 'lmstudio':
      return dedupe([...list(body, 'data')].sort((a, z) => Number(field(z, 'state') === 'loaded') - Number(field(a, 'state') === 'loaded')).map((m) => str(m, 'id')));
    default:
      return dedupe(list(body, 'data').map((m) => str(m, 'id')));
  }
}

/** Every run of whitespace, line breaks included, becomes one space: a provider's two-line body reads as one line under the row. */
const oneLine = (s: string): string => s.replace(/\s+/g, ' ').trim();

/**
 * The provider's own sentence out of whatever envelope it came in, after its
 * status: `error.message` (OpenAI, OpenRouter, Gemini, llama.cpp, LM Studio
 * and Anthropic's `{ type: 'error', error: { message } }`), a string `error`
 * (Ollama), a top-level `message`, or the raw text when none of those is
 * there. Collapsed to one line and cut at 300 characters; never rewritten.
 */
export function providerSentence(status: number, text: string): string {
  let msg = text;
  try {
    const parsed = JSON.parse(text) as unknown;
    const error = field(parsed, 'error');
    if (typeof error === 'string') msg = error;
    else if (typeof field(error, 'message') === 'string') msg = field(error, 'message') as string;
    else if (typeof field(parsed, 'message') === 'string') msg = field(parsed, 'message') as string;
  } catch {
    /* plain text */
  }
  return `${status} ${oneLine(msg) || 'no message'}`.slice(0, 300);
}

/** One line Derive adds when it recognises the case, or nothing. A separate field: it sits beside the provider's sentence and never inside it. */
export function hintFor(label: string, status: number, sentence: string): string | undefined {
  if (status === 401 || /invalid.*(api key|x-api-key)|authentication_error|incorrect api key/i.test(sentence)) {
    return `The key was refused. Paste a new key for ${label}, or unset its environment variable if that is where it came from.`;
  }
  if (status === 402 || /billing|credit|quota/i.test(sentence)) return 'The account has no credit or a spending limit was reached.';
  if (status === 429) return 'Rate limited; wait a moment and test again.';
  return undefined;
}

/** Derive's own sentence for a host that never answered: the address for a local one, the host and the reason for a remote one. Never quoted as the provider's. */
function unreachable(url: string, e: unknown): string {
  const u = new URL(url);
  if (isLocalUrl(url)) return `nothing answered at ${u.hostname}:${portOf(url)}`;
  const cause = (e as { cause?: unknown }).cause;
  const reason = cause instanceof Error ? cause.message : e instanceof Error ? e.message : String(e);
  return `could not reach ${u.hostname}: ${reason}`;
}

/**
 * GET a URL expecting JSON, within `ms`, following nothing. A 3xx is a
 * failure with its own sentence, because following it could carry the key
 * to a third host; a non-2xx throws the provider's sentence; a 2xx that is
 * not JSON says so with its status. A host that did not answer throws
 * Derive's unreachable sentence.
 */
export async function getJson(url: string, headers: Record<string, string>, ms: number): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { accept: 'application/json', ...headers }, redirect: 'manual', signal: AbortSignal.timeout(ms) });
  } catch (e) {
    throw new Error(unreachable(url, e));
  }
  if (res.status >= 300 && res.status < 400) throw new Error(`${res.status} the server redirected elsewhere; derive does not follow redirects that could carry a key`);
  const text = await res.text();
  if (!res.ok) throw new Error(providerSentence(res.status, text));
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`${res.status} the response was not JSON`);
  }
}

/** The address a row is asked at: the stored or default base for a local row and the OpenAI-compatible row, nothing for a fixed-endpoint one. */
const baseFor = (spec: ProviderSpec): string | undefined => (spec.group === 'local' || spec.auth === 'key+url' ? (localBase(spec) ?? undefined) : undefined);

/** A row's model ids, fetched now with the key the resolver would send and the address it would send it to. Throws the provider's sentence, or Derive's, as a plain Error. */
export async function listModels(id: string): Promise<string[]> {
  const spec = providerOf(id);
  if (!spec) throw new Error('unknown provider');
  const { url, headers } = requestFor(spec, effectiveKey(spec.id), baseFor(spec));
  return idsOf(spec, await getJson(url, headers, timeoutFor(url)));
}

/** The status a sentence starts with, or 0 when it is one of Derive's. */
const statusOf = (sentence: string): number => {
  const m = /^(\d{3}) /.exec(sentence);
  return m ? Number(m[1]) : 0;
};

/**
 * D-14: the cheapest real request a row can make, timed. A login is its auth
 * check; every other row is its model list, which proves the credential and
 * the endpoint in one call and gives the count for free. The result is
 * always an answer, never a throw: ok with the count and the latency, or the
 * sentence and Derive's hint. Independent of any turn — it reads the stored
 * values and touches nothing.
 */
export async function testConnection(id: string): Promise<TestResult> {
  const spec = providerOf(id);
  if (!spec) throw new Error('unknown provider');
  const t0 = Date.now();
  const ms = () => Date.now() - t0;
  try {
    if (spec.id === 'claude-code') {
      return (await claudeLoggedInAsync()) ? { ok: true, models: null, ms: ms() } : { ok: false, error: 'no Claude Code login found; run `claude` once to sign in', ms: ms() };
    }
    if (spec.id === 'codex') {
      return codexLoggedIn() ? { ok: true, models: null, ms: ms() } : { ok: false, error: `no Codex login found at ${join(CODEX_HOME, 'auth.json')}`, ms: ms() };
    }
    const ids = await listModels(spec.id);
    return { ok: true, models: ids.length, ms: ms() };
  } catch (e) {
    const error = safeMessage(e);
    const hint = hintFor(spec.label, statusOf(error), error);
    return { ok: false, error, ...(hint ? { hint } : {}), ms: ms() };
  }
}
