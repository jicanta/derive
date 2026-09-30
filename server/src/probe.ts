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
 * Nothing here runs unasked: the pass is what `POST /api/settings/detect`
 * awaits when the page opens and when the learner presses rescan. The
 * environment is read only through `config.ts` constants, by way of the
 * modules this one imports.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { codexLoggedIn } from './backend.js';
import { providerOf, type ProviderSpec } from './providers.js';
import { localBase, portOf, rememberDetection, type Detection, type Local, type Logins } from './settings.js';

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
