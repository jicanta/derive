/**
 * The front door, driven against the built server.
 *
 * Everything the API can do — read every lesson, import any readable folder
 * as course material, fetch a URL on the learner's behalf — used to be open
 * to any process on the machine and, on a shared network, to anyone on it.
 * These cases are the proof that it is not: health answers without a token,
 * nothing else does, a foreign Host or a near-miss Origin is refused, and no
 * response anywhere carries the token back out.
 *
 * Needs `pnpm build` first (it runs server/dist/index.js).
 */
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const entry = resolve(here, '../dist/index.js');

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
 * at the socket, which is also exactly what an attacker would do.
 */
function raw(path: string, headers: Record<string, string>): Promise<{ status: number; body: string }> {
  return new Promise((res, rej) => {
    const r = request({ host: '127.0.0.1', port, path, method: 'GET', headers, setHost: false }, (m) => {
      let body = '';
      m.setEncoding('utf8');
      m.on('data', (chunk: string) => {
        body += chunk;
      });
      m.on('end', () => res({ status: m.statusCode ?? 0, body }));
    });
    r.on('error', rej);
    r.end();
  });
}

/** Every header name and value of a response, joined, so a case can assert the token is in none of them. */
const headerText = (res: Response) => [...res.headers.entries()].map(([k, v]) => `${k}: ${v}`).join('\n');

before(async () => {
  assert.ok(existsSync(entry), `build first: ${entry} is missing`);
  dataDir = mkdtempSync(join(tmpdir(), 'derive-sec-'));
  tokenPath = join(dataDir, 'token');
  port = 4900 + Math.floor(Math.random() * 90);
  base = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, [entry], { env: { ...process.env, PORT: String(port), DERIVE_DATA_DIR: dataDir, DERIVE_BACKEND: 'claude' }, stdio: ['ignore', 'pipe', 'pipe'] });
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${base}/api/health`);
      if (r.ok) {
        token = readFileSync(tokenPath, 'utf8').trim();
        return;
      }
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('server did not start');
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

  it('is refused on the route that reads local folders', async () => {
    const res = await fetch(`${base}/api/materials/repo`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ source: '/etc' }) });
    assert.equal(res.status, 401);
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
