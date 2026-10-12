/**
 * The fallback web search, against a loopback fake and no real host.
 *
 * Three of the five rows the owned loop teaches on search with their own tool;
 * this is the one a learner on OpenRouter or on their own endpoint gets, so what
 * has to hold here is what the tutor is handed and what the learner is told. The
 * order of the hits is the engine's own and nothing re-ranks it; an empty query
 * never leaves the process; a SearXNG instance with the JSON format off says so
 * in its own sentence rather than as a network error; and a learner's instance
 * on `localhost` is reached rather than refused, which is the whole reason the
 * destination guard is deliberately not applied to the configured address.
 *
 * Nothing here may name a real search host. Tavily's endpoint is pointed at the
 * fake through the suite-only override, in the same posture as the owned loop's
 * model override.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { type AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';

// db.ts opens the database on import and keys.ts reads the secrets file beside
// it; pin the scratch directory before anything under src/ is imported. The
// environment key is cleared because this suite's whole point is that the
// stored one is what a search carries.
const scratch = mkdtempSync(join(tmpdir(), 'derive-search-'));
process.env.DERIVE_DATA_DIR = scratch;
process.env.TAVILY_API_KEY = '';

const { deleteSetting, setSetting } = await import('../src/db.js');
const { removeKey, setKey } = await import('../src/keys.js');
const { assertPublicHost } = await import('../src/library.js');
const { SEARCH_BASE_URL, SEARCH_SETTING, searchProvider, searchReady, searchWeb, setTavilyEndpoint, testSearch } = await import('../src/search.js');

type SearchHit = import('../src/search.js').SearchHit;

const KEY = 'tvly-test-key-0000000000';
const WRONG = 'tvly-wrong-key-0000000000';

/**
 * Three hits in an order that is neither alphabetical by title nor descending
 * by score, with two of them ranked equal, so any sort, reverse or
 * deduplication slipped into the mapper changes the sequence and fails the
 * suite rather than passing unnoticed.
 */
const RESULTS = [
  { title: 'Mid', url: 'https://example.com/mid', content: 'the middle one', score: 0.5 },
  { title: 'Also mid', url: 'https://example.com/also-mid', content: 'the equal-ranked one', score: 0.5 },
  { title: 'Best', url: 'https://example.com/best', content: 'the one with the highest score', score: 0.9 },
];

/** The sequence the engine sent, which is the sequence the tutor must see. */
const ORDER = ['https://example.com/mid', 'https://example.com/also-mid', 'https://example.com/best'];

/** Every sentence and every hit this suite read, so the last case can prove no key was ever echoed. */
const seen: string[] = [];

const caught = async (f: () => Promise<unknown>): Promise<string> => {
  try {
    await f();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    seen.push(message);
    return message;
  }
  throw new Error('nothing was thrown');
};

const hits = async (limit?: number): Promise<SearchHit[]> => {
  const out = limit === undefined ? await searchWeb('first principles') : await searchWeb('first principles', limit);
  seen.push(JSON.stringify(out));
  return out;
};

/** How many requests the fake has answered, so a refusal can be shown to have made none. */
let requests = 0;

/**
 * A loopback stand-in for both backends. `POST /tavily` is Tavily's endpoint,
 * answering the three results for the good key and a Tavily-shaped 401 for any
 * other; `GET /search` is a SearXNG instance with the JSON format on, and the
 * three prefixed paths are the same instance with it off in the three shapes an
 * instance actually answers in. Never a real host.
 */
function fakeSearch(): Promise<{ server: Server; port: number }> {
  return new Promise((res) => {
    const server = createServer((req, r) => {
      requests += 1;
      const path = (req.url ?? '/').split('?')[0];
      if (path === '/tavily') {
        r.setHeader('content-type', 'application/json');
        if (req.headers.authorization === `Bearer ${KEY}`) {
          r.statusCode = 200;
          r.end(JSON.stringify({ query: 'first principles', results: RESULTS, response_time: 0.4 }));
          return;
        }
        r.statusCode = 401;
        r.end(JSON.stringify({ error: { message: 'Unauthorized: missing or invalid API key\nsecond line of the body' } }));
        return;
      }
      if (path === '/search') {
        r.statusCode = 200;
        r.setHeader('content-type', 'application/json');
        r.end(JSON.stringify({ query: 'first principles', results: RESULTS, number_of_results: 3 }));
        return;
      }
      if (path === '/html/search') {
        r.statusCode = 200;
        r.setHeader('content-type', 'text/html');
        r.end('<!doctype html><title>SearXNG</title><p>results as a page</p>');
        return;
      }
      if (path === '/noresults/search') {
        r.statusCode = 200;
        r.setHeader('content-type', 'application/json');
        r.end(JSON.stringify({ query: 'first principles' }));
        return;
      }
      if (path === '/forbidden/search') {
        r.statusCode = 403;
        r.setHeader('content-type', 'text/html');
        r.end('<!doctype html><title>Forbidden</title>');
        return;
      }
      r.statusCode = 404;
      r.setHeader('content-type', 'application/json');
      r.end('{"error":"not found"}');
    });
    server.listen(0, '127.0.0.1', () => res({ server, port: (server.address() as AddressInfo).port }));
  });
}

let fake: Server | undefined;
let port = 0;

before(async () => {
  const started = await fakeSearch();
  fake = started.server;
  port = started.port;
  setTavilyEndpoint(`http://127.0.0.1:${port}/tavily`);
});

after(() => {
  setTavilyEndpoint(null);
  fake?.close();
  rmSync(scratch, { recursive: true, force: true });
});

/** Put the install back on the provider's own search, which is what a fresh one reads. */
const reset = () => {
  deleteSetting(SEARCH_SETTING);
  deleteSetting(SEARCH_BASE_URL);
  removeKey('search:tavily');
};

const onTavily = (key = KEY) => {
  reset();
  setSetting(SEARCH_SETTING, 'tavily');
  setKey('search:tavily', key);
};

const onSearxng = (base: string) => {
  reset();
  setSetting(SEARCH_SETTING, 'searxng');
  setSetting(SEARCH_BASE_URL, base);
};

describe('the fallback web search', () => {
  it("defaults to the provider's own search, and refuses a search it was never configured for", async () => {
    reset();
    assert.equal(searchProvider(), 'provider');
    assert.equal(searchReady(), false);
    assert.equal(await caught(() => searchWeb('anything')), 'there is no web search configured for this provider');
  });

  it("maps Tavily's results to hits in the engine's own order, with no sort, re-rank or dedup", async () => {
    onTavily();
    assert.equal(searchReady(), true);
    const out = await hits();
    assert.deepEqual(
      out.map((h) => h.url),
      ORDER,
    );
    assert.deepEqual(out[0], { title: 'Mid', url: 'https://example.com/mid', snippet: 'the middle one' });
    assert.equal(out.length, 3);
  });

  it("maps SearXNG's results to hits in the same order", async () => {
    onSearxng(`http://127.0.0.1:${port}`);
    const out = await hits();
    assert.deepEqual(
      out.map((h) => h.url),
      ORDER,
    );
    assert.deepEqual(out[2], { title: 'Best', url: 'https://example.com/best', snippet: 'the one with the highest score' });
  });

  it('clamps the limit to what was asked for, taking the first hits rather than the best', async () => {
    onTavily();
    const out = await hits(2);
    assert.deepEqual(
      out.map((h) => h.url),
      ORDER.slice(0, 2),
    );
  });

  it('refuses an empty or whitespace-only query before any request', async () => {
    onTavily();
    const before = requests;
    for (const query of ['', '   ', '\n\t']) assert.equal(await caught(() => searchWeb(query)), 'a search needs a query');
    assert.equal(requests, before, 'an empty query reached the engine');
  });

  it('refuses a Tavily search with no key, before any request', async () => {
    reset();
    setSetting(SEARCH_SETTING, 'tavily');
    assert.equal(searchReady(), false);
    const before = requests;
    assert.equal(await caught(() => searchWeb('first principles')), 'add a tavily key in settings to turn on web search');
    assert.equal(requests, before, 'a search with no key reached the engine');
  });

  it('refuses a SearXNG search with no address, before any request', async () => {
    reset();
    setSetting(SEARCH_SETTING, 'searxng');
    assert.equal(searchReady(), false);
    const before = requests;
    assert.equal(await caught(() => searchWeb('first principles')), 'add your searxng address in settings to turn on web search');
    assert.equal(requests, before, 'a search with no address reached the engine');
  });

  it("carries the engine's own sentence verbatim when it refuses the key", async () => {
    onTavily(WRONG);
    assert.equal(await caught(() => searchWeb('first principles')), '401 Unauthorized: missing or invalid API key second line of the body');
  });

  it('names settings.yml when a SearXNG instance answers HTML rather than JSON', async () => {
    onSearxng(`http://127.0.0.1:${port}/html`);
    const message = await caught(() => searchWeb('first principles'));
    assert.equal(message, 'your searxng instance did not answer with json; enable the json format under search: in its settings.yml');
  });

  it('names settings.yml when a SearXNG instance answers JSON with no results array', async () => {
    onSearxng(`http://127.0.0.1:${port}/noresults`);
    assert.match(await caught(() => searchWeb('first principles')), /settings\.yml$/);
  });

  it('names settings.yml for the 403 an instance with the format off also answers with', async () => {
    onSearxng(`http://127.0.0.1:${port}/forbidden`);
    assert.match(await caught(() => searchWeb('first principles')), /settings\.yml$/);
  });

  it("reaches a learner's SearXNG on localhost, which the destination guard would have refused", async () => {
    // The anti-pattern, asserted directly: the guard that stops derive fetching
    // a private address on a model's instruction refuses exactly the address a
    // learner's own instance is usually on, so it is not applied here.
    await assert.rejects(() => assertPublicHost(`http://localhost:${port}/search`), /private or local address/);
    onSearxng(`http://localhost:${port}`);
    const out = await hits();
    assert.deepEqual(
      out.map((h) => h.url),
      ORDER,
    );
  });

  it("answers the connection test in probe.ts's own shape, with the hit count in models", async () => {
    onTavily();
    const ok = await testSearch();
    assert.equal(ok.ok, true);
    assert.equal(ok.ok && ok.models, 3);
    assert.ok(ok.ms >= 0);

    onTavily(WRONG);
    const bad = await testSearch();
    assert.equal(bad.ok, false);
    assert.equal(bad.ok === false && bad.error, '401 Unauthorized: missing or invalid API key second line of the body');
    // Derive's fix hint is a separate field beside the engine's sentence, never folded into it.
    assert.equal(bad.ok === false && bad.hint, 'The key was refused. Paste a new key for Tavily, or unset its environment variable if that is where it came from.');
    seen.push(JSON.stringify(bad));
  });

  it("answers the test with nothing tested on the provider's own search", async () => {
    reset();
    assert.deepEqual(await testSearch(), { ok: true, models: null, ms: 0 });
  });

  it('never echoed either key in a hit, a sentence or a test result', () => {
    assert.ok(seen.length > 8, `only ${seen.length} bodies were read`);
    for (const text of seen) {
      for (const key of [KEY, WRONG, 'tvly-']) assert.ok(!text.includes(key), `a key fragment reached the learner: ${text}`);
    }
  });
});
