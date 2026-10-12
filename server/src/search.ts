/**
 * The web search a provider does not bring with it.
 *
 * Three of the five rows the owned loop teaches on search with their own
 * server-side tool, and the method is explicit that the tutor verifies a fact
 * before it teaches it: a wrong root corrupts every node built on top of it. A
 * learner on OpenRouter or on their own base-URL endpoint has no way to check
 * anything, and a tutor told to verify with a tool that is not there asserts
 * instead. So those two rows get a search of Derive's own, behind one function
 * with two backends the learner picks between on the settings page: Tavily with
 * a key, or their own SearXNG instance with an address.
 *
 * Nothing here invents a second vocabulary. The timeout posture, the refusal of
 * a redirect, the provider's own sentence and Derive's fix hint beside it all
 * come from `probe.ts`, which is already the one place a remote host's answer is
 * turned into a line a learner reads. The key rides `keys.ts` under one id, so
 * it is registered with the redaction chokepoint before it is written exactly as
 * a provider key is, and `TAVILY_API_KEY` locks it from the environment.
 *
 * One deliberate asymmetry, written here because it looks like an omission: the
 * learner's configured SearXNG address is never run through the destination
 * guard. That guard exists to stop Derive fetching a private address on a
 * model's instruction; a SearXNG instance is very often on localhost, which is
 * exactly what it refuses. It is applied, unchanged, to the result URLs the
 * tutor then hands to `fetch_page`.
 *
 * The environment is read only through `config.ts` constants, by way of the
 * modules this one imports.
 */
import { SEARCH_KEY_ID } from './config.js';
import { getSetting } from './db.js';
import { hintFor, isLocalUrl, LOCAL_MS, providerSentence, REMOTE_MS, type TestResult } from './probe.js';
import { safeMessage } from './secrets.js';
import { effectiveKey } from './settings.js';

/** The three ways a turn can get a web search, in the order the card offers them. Doubles as the type, following the `RESOURCE_KINDS` idiom. */
export const SEARCH_PROVIDERS = ['provider', 'tavily', 'searxng'] as const;

/** Which of them the learner picked. `provider` means the provider's own tool, and no search at all where the provider has none. */
export type SearchProvider = (typeof SEARCH_PROVIDERS)[number];

/** The settings key holding the learner's choice. Named once so the routes and this service cannot disagree about where it lives. */
export const SEARCH_SETTING = 'search_provider';

/** The settings key holding the SearXNG address. */
export const SEARCH_BASE_URL = 'search_base_url';

/** One hit as the tutor reads it. A snippet, never a verdict: the tutor is told to read a result with `fetch_page` before relying on it. */
export type SearchHit = { title: string; url: string; snippet: string };

/** Most hits one call may return, whatever the model asks for. A tutor checking one fact does not need a page of results, and every one of them costs context. */
export const MAX_HITS = 10;

/** The query the connection test runs: one word, so the engine has something real to answer and the test is as cheap as a search can be. */
const TEST_QUERY = 'derive';

/** Tavily's own endpoint. */
const TAVILY_URL = 'https://api.tavily.com/search';

/**
 * Where `tavilySearch` posts, replaced by the suite only.
 *
 * Same posture as `drivers/api.ts`'s `setModelOverride`: no route, header,
 * environment variable or config file can set it, and the production path
 * still posts to Tavily. It exists because the only honest way to assert the
 * mapping and the error sentences is to answer a real request, and the suite
 * may never reach a real host.
 */
let tavilyUrl: string = TAVILY_URL;

export function setTavilyEndpoint(url: string | null): void {
  tavilyUrl = url ?? TAVILY_URL;
}

/** What the learner reads for a choice, for the fix hint that names it. */
const SEARCH_LABELS: Readonly<Record<SearchProvider, string>> = { provider: "the provider's own", tavily: 'Tavily', searxng: 'SearXNG' };

/** The learner's choice, or the provider's own search when they have not made one. */
export function searchProvider(): SearchProvider {
  const stored = getSetting(SEARCH_SETTING);
  return (SEARCH_PROVIDERS as readonly string[]).includes(stored ?? '') ? (stored as SearchProvider) : 'provider';
}

/**
 * Whether the chosen fallback has what it needs to run: a key for Tavily, an
 * address for SearXNG. A choice with neither behaves exactly as no search at
 * all — the card says so, and `{{WEB_TOOLS}}` renders the no-search instruction
 * rather than naming a tool that would refuse every call the tutor made to it.
 */
export function searchReady(): boolean {
  switch (searchProvider()) {
    case 'tavily':
      return !!effectiveKey(SEARCH_KEY_ID);
    case 'searxng':
      return !!getSetting(SEARCH_BASE_URL);
    case 'provider':
      return false;
  }
}

/** The bound a request to this URL gets: `probe.ts`'s posture, because a learner's own search server is on this machine and a slow answer there means something is wrong rather than far away. */
const timeoutFor = (url: string): number => (isLocalUrl(url) ? LOCAL_MS : REMOTE_MS);

const field = (body: unknown, key: string): unknown => (body && typeof body === 'object' ? (body as Record<string, unknown>)[key] : undefined);

const str = (o: unknown, key: string): string | null => {
  const v = field(o, key);
  return typeof v === 'string' && v.trim() ? v.trim() : null;
};

const parse = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
};

/** The `results` array of an answer, or null when the body does not carry one. */
const resultsOf = (body: unknown): unknown[] | null => (Array.isArray(field(body, 'results')) ? (field(body, 'results') as unknown[]) : null);

/** The status a sentence starts with, or 0 when it is one of Derive's. */
const statusOf = (sentence: string): number => {
  const m = /^(\d{3}) /.exec(sentence);
  return m ? Number(m[1]) : 0;
};

/** Derive's own sentence for a search host that never answered: the address for a local one, the host and the reason for a remote one. Never quoted as the engine's. */
function unreachable(url: string, e: unknown): string {
  let host = url;
  try {
    host = new URL(url).host;
  } catch {
    /* keep the raw string */
  }
  if (isLocalUrl(url)) return `nothing answered at ${host}`;
  const cause = (e as { cause?: unknown }).cause;
  const reason = cause instanceof Error ? cause.message : e instanceof Error ? e.message : String(e);
  return `could not reach ${host}: ${reason}`;
}

/** The sentence a 3xx gets. Following it could carry the key to a host Derive never named, which is `probe.ts`'s posture in the one place a key-bearing search request is made. */
const redirected = (status: number) => `${status} the search endpoint redirected elsewhere; derive does not follow redirects that could carry a key`;

/**
 * The single most likely SearXNG failure, in its own sentence.
 *
 * The JSON format has to be enabled by the instance administrator under
 * `search:` in `settings.yml`, and many instances have it off — answering
 * either an HTML error page or an HTML results page. Collapsing that into a
 * generic reach error would send the learner looking at their network for a
 * line in a config file.
 */
const NO_JSON = 'your searxng instance did not answer with json; enable the json format under search: in its settings.yml';

/**
 * The engine's `results[]`, mapped positionally.
 *
 * No sort, no re-ranking and no deduplication: two hits the engine ranked equal
 * keep the order they arrived in, because what the tutor is reading is the
 * engine's own judgement and Derive has none of its own to add. An entry with no
 * URL is dropped rather than reordered — there is nothing the tutor could do
 * with it.
 */
function hitsOf(results: unknown[], limit: number): SearchHit[] {
  const out: SearchHit[] = [];
  for (const r of results) {
    const url = str(r, 'url');
    if (!url) continue;
    out.push({ title: str(r, 'title') ?? url, url, snippet: str(r, 'content') ?? '' });
    if (out.length >= limit) break;
  }
  return out;
}

/** Tavily: one POST carrying the key as a bearer, the minimal body the API documents, and `results[]` mapped in the order it sent them. */
export async function tavilySearch(query: string, limit: number): Promise<SearchHit[]> {
  const key = effectiveKey(SEARCH_KEY_ID);
  if (!key) throw new Error('add a tavily key in settings to turn on web search');
  let res: Response;
  try {
    res = await fetch(tavilyUrl, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ query }),
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutFor(tavilyUrl)),
    });
  } catch (e) {
    throw new Error(unreachable(tavilyUrl, e));
  }
  if (res.status >= 300 && res.status < 400) throw new Error(redirected(res.status));
  const text = await res.text();
  if (!res.ok) throw new Error(providerSentence(res.status, text));
  return hitsOf(resultsOf(parse(text)) ?? [], limit);
}

/** SearXNG: one GET at the learner's own instance, no authentication, and the same positional mapping. */
export async function searxngSearch(query: string, limit: number): Promise<SearchHit[]> {
  const base = getSetting(SEARCH_BASE_URL);
  if (!base) throw new Error('add your searxng address in settings to turn on web search');
  const url = `${base}/search?q=${encodeURIComponent(query)}&format=json`;
  let res: Response;
  try {
    // Deliberately not guarded against private addresses: a learner's searxng is very often on localhost or a .local name, and the destination guard exists to stop derive fetching those on a model's instruction, not to stop a learner naming their own server. It is applied to the result urls the tutor then fetches.
    res = await fetch(url, { headers: { accept: 'application/json' }, redirect: 'manual', signal: AbortSignal.timeout(timeoutFor(url)) });
  } catch (e) {
    throw new Error(unreachable(url, e));
  }
  if (res.status >= 300 && res.status < 400) throw new Error(redirected(res.status));
  const text = await res.text();
  const results = resultsOf(parse(text));
  // Whatever status it came with: an instance with the format off answers an HTML page, sometimes 200 and sometimes 403, and both have the same one-line fix.
  if (!results) throw new Error(NO_JSON);
  if (!res.ok) throw new Error(providerSentence(res.status, text));
  return hitsOf(results, limit);
}

/**
 * Search the web through whichever fallback the learner configured.
 *
 * An empty query never leaves the process: a model that calls a search tool
 * with nothing in it has made a mistake, and sending it would spend a credit to
 * be told so. The `provider` case throws because the loop never registers a
 * search tool in it — that branch guards a future caller, not a learner.
 */
export async function searchWeb(query: string, limit = 5): Promise<SearchHit[]> {
  const q = query.trim();
  if (!q) throw new Error('a search needs a query');
  const n = Math.max(1, Math.min(Math.round(limit) || 1, MAX_HITS));
  switch (searchProvider()) {
    case 'tavily':
      return await tavilySearch(q, n);
    case 'searxng':
      return await searxngSearch(q, n);
    case 'provider':
      throw new Error('there is no web search configured for this provider');
  }
}

/**
 * The cheapest real request the configured search can make, timed.
 *
 * The result shape is `probe.ts`'s `TestResult` unchanged, so the page renders
 * it with the component the provider rows already use: the hit count goes in
 * `models`, which is what makes `Connected · {n} results · {ms} ms` renderable
 * with no second shape. The `provider` choice answers ok with nothing tested,
 * because there is nothing of Derive's to test — the provider's own key is what
 * its own test proves.
 */
export async function testSearch(): Promise<TestResult> {
  const choice = searchProvider();
  if (choice === 'provider') return { ok: true, models: null, ms: 0 };
  const t0 = Date.now();
  const ms = () => Date.now() - t0;
  try {
    return { ok: true, models: (await searchWeb(TEST_QUERY, 5)).length, ms: ms() };
  } catch (e) {
    const error = safeMessage(e);
    const hint = hintFor(SEARCH_LABELS[choice], statusOf(error), error);
    return { ok: false, error, ...(hint ? { hint } : {}), ms: ms() };
  }
}
