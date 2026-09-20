/**
 * The front door, driven against the built server.
 *
 * Everything the API can do — read every lesson, import any readable folder
 * as course material, fetch a URL on the learner's behalf — used to be open
 * to any process on the machine and, on a shared network, to anyone on it.
 * These cases are that defect inverted, one clause per case below. They drive
 * the document routes as well as /api/*, because the page is what unlocks the
 * API: an unauthenticated GET / is refused and handed no cookie, whatever
 * address it arrived on; the install token opens the page once in the URL and
 * is dropped by the 302 that hands out the cookie; that 302 cannot be aimed
 * off this server; the browser then drives the whole API on that derived
 * HttpOnly cookie, which is not the token; a foreign Host or a near-miss
 * Origin is refused on / exactly as it is on /api/*, health included; health
 * is the one route exempt from the credential and nothing else is; a token
 * offered in a query string is refused on the lesson stream, because that
 * source is gone now that no browser needs it; and the install token appears
 * in no body and no header of any response these cases make.
 *
 * Needs `pnpm build` first (it runs server/dist/index.js).
 */
import assert from 'node:assert/strict';
import { type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync, rmSync, statSync } from 'node:fs';
import { request } from 'node:http';
import { networkInterfaces } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { startDeriveServer } from './spawn.js';

const here = dirname(fileURLToPath(import.meta.url));
const entry = resolve(here, '../dist/index.js');

const SESSION_COOKIE = 'derive_session';

let server: ChildProcess | undefined;
let base = '';
let port = 0;
let dataDir = '';
let tokenPath = '';
let token = '';

/** One request with exactly the headers a case wants, and nothing added behind its back. */
const req = (path: string, headers: Record<string, string> = {}) => fetch(`${base}${path}`, { headers });

/**
 * One request with a Host header of the case's choosing. `fetch` refuses to
 * set Host — it derives it from the URL — so a rebind has to be spelled out
 * at the socket, which is also exactly what an attacker would do. `at` picks
 * the address and port to connect to, which is how a case can prove the Host
 * check answers for the connection rather than for the name on it.
 */
function raw(path: string, headers: Record<string, string>, at: { host?: string; port?: number } = {}): Promise<{ status: number; body: string; headers: Record<string, string | string[] | undefined> }> {
  return new Promise((res, rej) => {
    const r = request({ host: at.host ?? '127.0.0.1', port: at.port ?? port, path, method: 'GET', headers, setHost: false }, (m) => {
      let body = '';
      m.setEncoding('utf8');
      m.on('data', (chunk: string) => {
        body += chunk;
      });
      m.on('end', () => res({ status: m.statusCode ?? 0, body, headers: m.headers }));
    });
    r.on('error', rej);
    r.end();
  });
}

/** Every header name and value of a response, joined, so a case can assert the token is in none of them. */
const headerText = (res: Response) => [...res.headers.entries()].map(([k, v]) => `${k}: ${v}`).join('\n');

/** The whole Set-Cookie line the server used to hand out the browser's credential, or '' when it handed out none. */
const cookieFrom = (res: Response) => res.headers.getSetCookie().find((c) => c.startsWith(`${SESSION_COOKIE}=`)) ?? '';

/** The value on that line, which is what a case sends back as a cookie. */
const cookieValue = (line: string) => line.slice(`${SESSION_COOKIE}=`.length).split(';')[0];

/** A non-internal IPv4 address of this machine, or undefined when it has none. A machine with none is a real state, and the cases that need one say they were skipped rather than asserting nothing. */
function lanAddress(): string | undefined {
  for (const list of Object.values(networkInterfaces())) {
    for (const i of list ?? []) if (i.family === 'IPv4' && !i.internal) return i.address;
  }
  return undefined;
}

/**
 * A server of this case's own, on its own port with its own scratch data
 * directory. The suite's default server is one of these; the widened-bind
 * cases spawn a second, because DERIVE_HOST is read once at boot.
 */
async function startServer(env: Record<string, string> = {}): Promise<{ server: ChildProcess; base: string; port: number; dataDir: string; tokenPath: string; token: string }> {
  assert.ok(existsSync(entry), `build first: ${entry} is missing`);
  const { child, base: url, port: p, dataDir: dir } = await startDeriveServer(entry, env);
  const path = join(dir, 'token');
  return { server: child, base: url, port: p, dataDir: dir, tokenPath: path, token: readFileSync(path, 'utf8').trim() };
}

before(async () => {
  const s = await startServer();
  ({ server, base, port, dataDir, tokenPath, token } = s);
});

after(() => {
  server?.kill();
  if (dataDir) rmSync(dataDir, { recursive: true, force: true });
});

describe('the install token', () => {
  it('is 32 bytes of hex in a file only the learner can read', () => {
    assert.match(token, /^[0-9a-f]{64}$/);
    assert.equal((statSync(tokenPath).mode & 0o777).toString(8), '600');
  });

  it('is not handed back by the one route that needs no token', async () => {
    const res = await req('/api/health');
    assert.equal(res.status, 200);
    const body = await res.text();
    assert.ok(!body.includes(token), 'health returned the token');
    assert.ok(!headerText(res).includes(token), 'health put the token in a header');
  });
});

describe('a request without the right token', () => {
  it('is refused with no token at all', async () => {
    const res = await req('/api/lessons');
    assert.equal(res.status, 401);
    const body = await res.text();
    assert.ok(body.includes('x-derive-token'), body);
    assert.ok(!body.includes(token), 'the refusal leaked the token');
    assert.ok(!headerText(res).includes(token), 'the refusal put the token in a header');
  });

  it('is refused with a wrong token', async () => {
    const res = await req('/api/lessons', { 'x-derive-token': 'f'.repeat(64) });
    assert.equal(res.status, 401);
    assert.ok(!(await res.text()).includes(token));
  });

  it('is refused with a token of a different length', async () => {
    assert.equal((await req('/api/lessons', { 'x-derive-token': 'short' })).status, 401);
  });

  it('treats an empty or blank credential as absent rather than comparing it', async () => {
    assert.equal((await req('/api/lessons', { 'x-derive-token': '' })).status, 401);
    assert.equal((await req('/api/lessons', { 'x-derive-token': '   ' })).status, 401);
    assert.equal((await req('/api/lessons', { cookie: `${SESSION_COOKIE}=` })).status, 401);
  });

  it('is refused on the route that reads local folders', async () => {
    const res = await fetch(`${base}/api/materials/repo`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ source: '/etc' }) });
    assert.equal(res.status, 401);
  });

  it('is refused on the lesson stream when the token rides in the query string', async () => {
    // The one credential source a browser no longer needs, deleted: web/src/lib/useLesson.ts was its only caller.
    assert.equal((await req(`/api/lessons/does-not-matter/stream?after=0&token=${token}`)).status, 401);
  });

  it('is not needed by health, which the doctor and the test harnesses poll before there is one', async () => {
    assert.equal((await req('/api/health')).status, 200);
  });

  it('is let in with the right token', async () => {
    const res = await req('/api/lessons', { 'x-derive-token': token });
    assert.equal(res.status, 200);
    const body = await res.text();
    assert.ok(!body.includes(token), 'a listing returned the token');
    assert.ok(!headerText(res).includes(token), 'a listing put the token in a header');
  });
});

describe('the Origin allowlist', () => {
  it('lets the app and the dev server in', async () => {
    assert.equal((await req('/api/lessons', { 'x-derive-token': token, origin: 'http://localhost:5173' })).status, 200);
    assert.equal((await req('/api/lessons', { 'x-derive-token': token, origin: base })).status, 200);
  });

  it('refuses a foreign origin', async () => {
    const res = await req('/api/lessons', { 'x-derive-token': token, origin: 'http://evil.example' });
    assert.equal(res.status, 403);
    assert.ok(!(await res.text()).includes(token));
  });

  it('refuses a foreign origin on health too, which is exempt from the credential and not from this', async () => {
    assert.equal((await req('/api/health', { origin: 'http://evil.example' })).status, 403);
  });

  it('matches whole, so a longer port is a different origin', async () => {
    assert.equal((await req('/api/lessons', { 'x-derive-token': token, origin: 'http://localhost:51730' })).status, 403);
    assert.equal((await req('/api/lessons', { 'x-derive-token': token, origin: 'http://localhost:5173.evil.example' })).status, 403);
  });
});

describe('the Host check', () => {
  it('refuses a name that is not this server', async () => {
    const res = await raw('/api/lessons', { 'x-derive-token': token, host: 'derive.example.com' });
    assert.equal(res.status, 403);
    assert.ok(!res.body.includes(token));
  });

  it('judges a Host with no port as the scheme default, which on any port but 80 is not this server', async () => {
    // A browser omits the port only when it is the scheme's default, which is why an absent part is read as 80 rather than refused outright. The case that change exists for — PORT=80 accepting an unported Host — needs a privileged port and is not driven here.
    assert.equal((await raw('/api/lessons', { 'x-derive-token': token, host: '127.0.0.1' })).status, 403);
  });

  it('refuses a foreign Host on health too, so a rebound page cannot read the version and the backend', async () => {
    const res = await raw('/api/health', { host: 'evil.com' });
    assert.equal(res.status, 403);
    assert.ok(!res.body.includes('backend'), res.body);
  });

  it('refuses loopback on a port that is not this one', async () => {
    assert.equal((await raw('/api/lessons', { 'x-derive-token': token, host: `127.0.0.1:${port + 1}` })).status, 403);
  });

  it('refuses a request with no Host header at all', async () => {
    // HTTP/1.1 requires one, so node's own parser turns this away with a 400 before the middleware sees it. Either way it does not get in.
    assert.ok((await raw('/api/lessons', { 'x-derive-token': token })).status >= 400);
  });

  it('accepts both spellings of loopback on this port', async () => {
    assert.equal((await raw('/api/lessons', { 'x-derive-token': token, host: `localhost:${port}` })).status, 200);
    assert.equal((await raw('/api/lessons', { 'x-derive-token': token, host: `127.0.0.1:${port}` })).status, 200);
  });

  it('is checked before the credential, so a bad Host with a bad token is a 403', async () => {
    assert.equal((await raw('/api/lessons', { 'x-derive-token': 'f'.repeat(64), host: 'evil.example' })).status, 403);
  });

  it('refuses the unspecified addresses as names, whatever the bind', async () => {
    assert.equal((await raw('/api/lessons', { 'x-derive-token': token, host: `0.0.0.0:${port}` })).status, 403);
    assert.equal((await raw('/api/lessons', { 'x-derive-token': token, host: `[::]:${port}` })).status, 403);
  });
});

/**
 * DERIVE_HOST is read once at boot, so this needs a server of its own. What
 * it proves is the defect the verification found, inverted: the allowed Host
 * names come from the address the connection landed on, so loopback still
 * works over loopback and a loopback name arriving from the network does not.
 */
describe('a widened bind', () => {
  let wide: Awaited<ReturnType<typeof startServer>> | undefined;

  before(async () => {
    wide = await startServer({ DERIVE_HOST: '0.0.0.0' });
  });

  after(() => {
    wide?.server.kill();
    if (wide) rmSync(wide.dataDir, { recursive: true, force: true });
  });

  it('still answers to loopback over loopback', async () => {
    const w = wide!;
    assert.equal((await raw('/api/lessons', { 'x-derive-token': w.token, host: `127.0.0.1:${w.port}` }, { port: w.port })).status, 200);
  });

  it('refuses a name the connection did not arrive on', async () => {
    const w = wide!;
    assert.equal((await raw('/api/lessons', { 'x-derive-token': w.token, host: `10.255.255.1:${w.port}` }, { port: w.port })).status, 403);
  });

  it('answers to the LAN address a LAN request arrived on, and refuses a forged loopback name there', { skip: lanAddress() ? false : 'no non-loopback interface on this machine' }, async () => {
    const w = wide!;
    const lan = lanAddress()!;
    assert.equal((await raw('/api/lessons', { 'x-derive-token': w.token, host: `${lan}:${w.port}` }, { host: lan, port: w.port })).status, 200);
    assert.equal((await raw('/api/lessons', { 'x-derive-token': w.token, host: `127.0.0.1:${w.port}` }, { host: lan, port: w.port })).status, 403);
  });

  it('holds a loopback browser to the same one-time handoff as a device on the network', async () => {
    const w = wide!;
    const bare = await fetch(`${w.base}/`);
    assert.equal(bare.status, 401);
    assert.equal(cookieFrom(bare), '', 'loopback was handed a session cookie for nothing');
    const res = await fetch(`${w.base}/?token=${w.token}`, { redirect: 'manual' });
    assert.equal(res.status, 302);
    assert.ok(cookieFrom(res), 'the loopback handoff handed out no cookie');
  });

  it('hands a device on the network nothing until it presents the token', { skip: lanAddress() ? false : 'no non-loopback interface on this machine' }, async () => {
    const w = wide!;
    const lan = lanAddress()!;
    const res = await raw('/', { host: `${lan}:${w.port}` }, { host: lan, port: w.port });
    assert.equal(res.status, 401);
    assert.equal(res.headers['set-cookie'], undefined);
  });

  it('lets a device on the network in once, on a redirect that drops the token from the URL', { skip: lanAddress() ? false : 'no non-loopback interface on this machine' }, async () => {
    const w = wide!;
    const lan = lanAddress()!;
    const res = await raw(`/?token=${w.token}`, { host: `${lan}:${w.port}` }, { host: lan, port: w.port });
    assert.equal(res.status, 302);
    assert.ok(!String(res.headers.location).includes('?'), `the token stayed in the URL: ${res.headers.location}`);
    assert.ok(String(res.headers['set-cookie']).includes(`${SESSION_COOKIE}=`), 'the redirect handed out no cookie');
    assert.ok(!String(res.headers['set-cookie']).includes(w.token), 'the redirect handed out the install token');
  });
});

/** The one-time handoff: the install token in the URL, answered with the 302 that sets the cookie. `redirect: 'manual'` so a case sees that response rather than what it points at. */
const handoff = (path = '/') => fetch(`${base}${path}${path.includes('?') ? '&' : '?'}token=${token}`, { redirect: 'manual' });

/** The session cookie value a fresh handoff hands out, which is how a case gets a credentialled browser. */
const sessionValue = async () => cookieValue(cookieFrom(await handoff()));

describe('the document routes', () => {
  it('refuse a request that presented nothing, and hand it no cookie, on loopback as anywhere else', async () => {
    const res = await req('/');
    assert.equal(res.status, 401);
    assert.equal(cookieFrom(res), '', 'an unauthenticated document response handed out a session cookie');
    const body = await res.text();
    assert.ok(body.includes('?token='), body);
    assert.ok(!body.includes(token), 'the refusal shipped the install token');
    assert.ok(!headerText(res).includes(token), 'a header shipped the install token');
  });

  it('refuse a session cookie of the right shape that this server did not issue', async () => {
    assert.equal((await req('/', { cookie: `${SESSION_COOKIE}=${'a'.repeat(64)}` })).status, 401);
  });

  it('let the install token in once, on a 302 that drops it from the URL', async () => {
    const res = await handoff();
    assert.equal(res.status, 302);
    const location = res.headers.get('location') ?? '';
    assert.ok(!location.includes('?'), `the token stayed in the URL: ${location}`);
    const line = cookieFrom(res);
    assert.ok(line, 'the handoff handed out no session cookie');
    assert.ok(!line.includes(token), 'the handoff handed out the install token');
  });

  it('cannot be turned into a redirect off this server', async () => {
    const res = await fetch(`${base}//evil.example?token=${token}`, { redirect: 'manual' });
    assert.equal(res.status, 302);
    const location = res.headers.get('location') ?? '';
    assert.ok(!location.startsWith('//'), `a caller-supplied path became an off-site Location: ${location}`);
  });

  it('serve the app to a browser holding the cookie, with no token in the markup and none in a header', async () => {
    const res = await req('/', { cookie: `${SESSION_COOKIE}=${await sessionValue()}` });
    assert.equal(res.status, 200);
    const body = await res.text();
    assert.ok(body.includes('<div id="root"'), 'that was not the app');
    assert.ok(!body.includes(token), 'the page shipped the install token');
    assert.ok(!headerText(res).includes(token), 'a header shipped the install token');
  });

  it('hold the catch-all to the same credential, and serve it on the cookie with no token either', async () => {
    assert.equal((await req('/anything/at/all')).status, 401);
    const res = await req('/anything/at/all', { cookie: `${SESSION_COOKIE}=${await sessionValue()}` });
    assert.equal(res.status, 200);
    const body = await res.text();
    assert.ok(body.includes('<div id="root"'), 'that was not the app');
    assert.ok(!body.includes(token), 'the catch-all shipped the install token');
    assert.ok(!headerText(res).includes(token), 'a header shipped the install token');
  });

  it('refuse a foreign Host before any HTML is written', async () => {
    const res = await raw('/', { host: 'evil.com' });
    assert.equal(res.status, 403);
    assert.ok(!res.body.includes(token));
  });

  it('refuse a foreign Origin', async () => {
    assert.equal((await req('/', { origin: 'http://evil.com' })).status, 403);
  });
});

describe('the browser session cookie', () => {
  it('is issued only against the install token, is not that token, and cannot be read by script or sent cross-site', async () => {
    const line = cookieFrom(await handoff());
    assert.ok(line, 'the handoff handed out no session cookie');
    assert.match(cookieValue(line), /^[0-9a-f]{64}$/);
    assert.notEqual(cookieValue(line), token);
    assert.ok(/HttpOnly/i.test(line), line);
    assert.ok(/SameSite=Strict/i.test(line), line);
  });

  it('drives the whole API on its own', async () => {
    const res = await req('/api/lessons', { cookie: `${SESSION_COOKIE}=${await sessionValue()}` });
    assert.equal(res.status, 200);
    const body = await res.text();
    assert.ok(!body.includes(token), 'a listing returned the install token');
    assert.ok(!headerText(res).includes(token), 'a listing put the install token in a header');
  });

  it('is refused when it is empty or is a value the server did not issue', async () => {
    assert.equal((await req('/api/lessons', { cookie: `${SESSION_COOKIE}=` })).status, 401);
    assert.equal((await req('/api/lessons', { cookie: `${SESSION_COOKIE}=${'a'.repeat(64)}` })).status, 401);
  });

  it('did not replace the header path the MCP server, the plugin hook and the dev proxy use', async () => {
    assert.equal((await req('/api/lessons', { 'x-derive-token': token })).status, 200);
  });
});

describe('an error body that would have carried the token', () => {
  it('says [redacted] instead', async () => {
    // The repo importer echoes the path it was handed; hand it the token, and the message is the token.
    const res = await fetch(`${base}/api/materials/repo`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-derive-token': token },
      body: JSON.stringify({ source: token }),
    });
    assert.equal(res.status, 422);
    const body = await res.text();
    assert.ok(!body.includes(token), `the token reached an error body: ${body}`);
    assert.ok(body.includes('[redacted]'), body);
  });
});
