/**
 * Which provider and model teach, chosen over HTTP and honoured by the next
 * turn.
 *
 * Two harnesses. A spawned server proves the learner-facing contract with no
 * model behind it: a choice made through the settings routes persists in the
 * data directory across a restart, the environment locks its fields with a
 * 409 that names the variable, a row with no driver is refused, and no
 * response carries the identity `claude auth status` prints. A module-level
 * suite on the fake driver proves what the spawn cannot see: the very next
 * turn after a change runs on the new value with no restart, a provider
 * change clears the lesson's session while a model change keeps it, and the
 * detection tier's order and memo bound hold at a pinned clock.
 *
 * Every spawn empties PATH and points CODEX_HOME at a scratch folder so the
 * machine's own logins cannot leak in: detection is then the same on every
 * machine. Nothing here may touch ~/.derive.
 */
import assert from 'node:assert/strict';
import { type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { type AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { freePort, startDeriveServer } from './spawn.js';

// db.ts opens the database on import and the resolver may shell out on its
// first detection; pin the data dir, unset the env locks and hide the
// machine's logins before anything under src/ is imported.
const scratch = mkdtempSync(join(tmpdir(), 'derive-settings-'));
const emptyBin = mkdtempSync(join(tmpdir(), 'derive-settings-bin-'));
const codexHome = mkdtempSync(join(tmpdir(), 'derive-settings-codex-'));
process.env.DERIVE_DATA_DIR = scratch;
process.env.DERIVE_BACKEND = '';
process.env.DERIVE_MODEL = '';
process.env.CODEX_HOME = codexHome;
process.env.PATH = emptyBin;
for (const name of ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'OPENROUTER_API_KEY', 'OLLAMA_HOST']) process.env[name] = '';

const { createLesson, deleteSetting, endTurn, getLesson, lastTurn, listEvents, setSessionId, setSetting, startTurn } = await import('../src/db.js');
const { runTurn } = await import('../src/agent.js');
const { setDriverOverride } = await import('../src/driver.js');
const { fakeDriver, setFakeScript } = await import('../src/drivers/fake.js');
const { ACTIVE_PROVIDER, DETECT_MS, backendOf, baseUrlKey, currentDetection, currentTutor, lastDetection, localBase, modelKey, normaliseBaseUrl, portOf, rememberDetection, resetDetection, resolveTutor } = await import('../src/settings.js');
const { PROVIDERS, providerOf, providerOfDriver } = await import('../src/providers.js');
const { hintFor, idsOf, isLlamaCpp, isLmStudio, isLocalUrl, isOllama, probeJson, providerSentence, requestFor } = await import('../src/probe.js');
const { hintOf, keyOf, resetKeyCache, setKey } = await import('../src/keys.js');
const { redact, secretCount } = await import('../src/secrets.js');

const here = dirname(fileURLToPath(import.meta.url));
const entry = resolve(here, '../dist/index.js');

after(() => {
  for (const dir of [scratch, emptyBin, codexHome]) rmSync(dir, { recursive: true, force: true });
});

/** The environment every spawn in this file gets: nothing env-locked, no key in the environment, no login reachable. */
const hermetic = {
  DERIVE_BACKEND: '',
  DERIVE_MODEL: '',
  CODEX_HOME: codexHome,
  PATH: emptyBin,
  ANTHROPIC_API_KEY: '',
  OPENAI_API_KEY: '',
  GEMINI_API_KEY: '',
  GOOGLE_API_KEY: '',
  OPENROUTER_API_KEY: '',
  OLLAMA_HOST: '',
};

type Tutor = { provider: string; model: string | null; source: string; modelSource: string | null };
type KeyView = { set: boolean; hint: string | null; locked: string | null };
type Row = {
  id: string;
  teaches: boolean;
  default_model: string | null;
  model: string | null;
  key: KeyView | null;
  key_optional: boolean;
  base_url: string | null;
  base_url_default: string | null;
  base_url_locked: string | null;
  status: string;
  active: boolean;
};
type SettingsView = { active: Tutor; defaults_as_of: string; provider_locked: string | null; model_locked: string | null; secrets_error: string | null; rows: Row[] };
type TestResult = { ok: boolean; models?: number | null; ms: number; error?: string; hint?: string };

/** A request against one spawned server, with its token. */
const client = (base: string, token: string) => async <T = Record<string, unknown>>(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<{ status: number; json: T; text: string }> => {
  const res = await fetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json', 'x-derive-token': token }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, json: JSON.parse(text) as T, text };
};

describe('settings over HTTP', () => {
  let server: ChildProcess | undefined;
  let base = '';
  let dataDir = '';
  let token = '';
  let api: ReturnType<typeof client>;

  before(async () => {
    assert.ok(existsSync(entry), `build first: ${entry} is missing`);
    ({ child: server, base, dataDir } = await startDeriveServer(entry, hermetic));
    token = readFileSync(join(dataDir, 'token'), 'utf8').trim();
    api = client(base, token);
  });

  after(() => {
    server?.kill();
    if (dataDir) rmSync(dataDir, { recursive: true, force: true });
  });

  it('stores a model on a provider row', async () => {
    const r = await api<{ id: string; model: string | null }>('/api/settings/codex', { model: 'gpt-5.4' }, 'PUT');
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.id, 'codex');
    assert.equal(r.json.model, 'gpt-5.4');
  });

  it('makes a teaching provider active and reports the choice with its sources', async () => {
    const r = await api<Tutor>('/api/settings/active', { provider: 'codex' });
    assert.equal(r.status, 200, r.text);
    assert.deepEqual(r.json, { provider: 'codex', model: 'gpt-5.4', source: 'settings', modelSource: 'settings' });
    const again = await api<Tutor>('/api/settings/active');
    assert.deepEqual(again.json, r.json);
  });

  it('refuses a row whose driver has not arrived, and an id it does not know', async () => {
    const unwired = await api('/api/settings/active', { provider: 'openai' });
    assert.equal(unwired.status, 400);
    assert.equal(unwired.json.error, 'teaching on OpenAI arrives with the next release');
    const unknown = await api('/api/settings/active', { provider: 'nope' });
    assert.equal(unknown.status, 404);
    assert.equal(unknown.json.error, 'unknown provider');
  });

  it('bounds the model id to the characters real ids use', async () => {
    const bad = await api('/api/settings/anthropic', { model: 'bad model!' }, 'PUT');
    assert.equal(bad.status, 400);
    assert.equal(bad.json.error, 'the model id may only contain letters, digits, . _ : / and -');
    const unknown = await api('/api/settings/nope', { model: 'x' }, 'PUT');
    assert.equal(unknown.status, 404);
  });

  it('clears a model with an empty string and leaves the active choice alone', async () => {
    const r = await api<{ model: string | null }>('/api/settings/anthropic', { model: '' }, 'PUT');
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.model, null);
    const active = await api<Tutor>('/api/settings/active');
    assert.deepEqual(active.json, { provider: 'codex', model: 'gpt-5.4', source: 'settings', modelSource: 'settings' });
  });

  it('never carries the identity claude auth status prints', async () => {
    const active = await api('/api/settings/active');
    assert.ok(!active.text.includes('email'), active.text);
  });

  it('paints every row from stored config, in catalogue order, with one active row', async () => {
    const r = await api<SettingsView>('/api/settings');
    assert.equal(r.status, 200, r.text);
    assert.ok(!r.text.includes('email'), r.text);
    assert.deepEqual(
      r.json.rows.map((row) => row.id),
      ['claude-code', 'codex', 'anthropic', 'openai', 'gemini', 'openrouter', 'openai-compatible', 'ollama', 'lmstudio', 'llamacpp'],
    );
    assert.match(r.json.defaults_as_of, /^\d{4}-\d{2}-\d{2}$/);
    assert.deepEqual(r.json.rows.filter((row) => row.teaches).map((row) => row.id), ['claude-code', 'codex']);
    const byId = new Map(r.json.rows.map((row) => [row.id, row]));
    assert.equal(byId.get('anthropic')!.default_model, 'claude-opus-5-5');
    assert.equal(byId.get('openai')!.default_model, 'gpt-6-astra');
    assert.equal(byId.get('gemini')!.default_model, 'gemini-3.8-flash');
    assert.equal(byId.get('openrouter')!.default_model, 'anthropic/claude-opus-5-5');
    assert.deepEqual(r.json.rows.filter((row) => row.active).map((row) => row.id), ['codex']);
    assert.equal(byId.get('codex')!.model, 'gpt-5.4');
    // The boot line observed the logins once; nothing has probed a port yet.
    assert.equal(byId.get('claude-code')!.status, 'not configured');
    assert.equal(byId.get('codex')!.status, 'not configured');
    for (const id of ['ollama', 'lmstudio', 'llamacpp']) assert.equal(byId.get(id)!.status, 'checking', id);
    assert.equal(r.json.provider_locked, null);
    assert.equal(r.json.model_locked, null);
    assert.deepEqual(r.json.active, { provider: 'codex', model: 'gpt-5.4', source: 'settings', modelSource: 'settings' });
  });

  it('answers health from the last pass, with exactly five keys', async () => {
    const r = await api<{ ok: boolean; backend: string; model: string | null; source: string }>('/api/health');
    assert.equal(r.status, 200, r.text);
    assert.deepEqual(Object.keys(r.json).sort(), ['backend', 'model', 'ok', 'source', 'version']);
    assert.ok(!r.text.includes('backend_source'));
    assert.equal(r.json.backend, 'codex');
    assert.equal(r.json.model, 'gpt-5.4');
    assert.equal(r.json.source, 'settings');
  });

  it('answers a settings write with the row as the page paints it', async () => {
    const r = await api<Row>('/api/settings/codex', { model: 'gpt-5.4' }, 'PUT');
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.id, 'codex');
    assert.equal(r.json.model, 'gpt-5.4');
    assert.equal(r.json.status, 'not configured');
    assert.equal(r.json.active, true);
  });

  it('keeps the choice across a restart', async () => {
    const child = server!;
    const exited = new Promise<void>((res) => child.once('exit', () => res()));
    child.kill();
    await exited;
    ({ child: server, base } = await startDeriveServer(entry, hermetic, { dataDir }));
    api = client(base, token);
    const active = await api<Tutor>('/api/settings/active');
    assert.equal(active.status, 200, active.text);
    assert.deepEqual(active.json, { provider: 'codex', model: 'gpt-5.4', source: 'settings', modelSource: 'settings' });
    // A stored provider decides at boot before detection is reached, so the login rows wait for a pass.
    const view = await api<SettingsView>('/api/settings');
    assert.equal(view.json.rows.find((row) => row.id === 'claude-code')!.status, 'checking');
  });
});

describe('read-only routes never spawn', { skip: process.platform === 'win32' }, () => {
  let server: ChildProcess | undefined;
  let dataDir = '';
  let shimBin = '';
  let marker = '';
  let api: ReturnType<typeof client>;
  const runs = () => (existsSync(marker) ? readFileSync(marker, 'utf8').split('\n').filter(Boolean).length : 0);

  before(async () => {
    // A `claude` that counts its own invocations and reports a login, so a spawn is a line in a file rather than a guess.
    shimBin = mkdtempSync(join(tmpdir(), 'derive-settings-shim-'));
    marker = join(shimBin, 'marker.log');
    writeFileSync(join(shimBin, 'claude'), '#!/bin/sh\necho run >> "$DERIVE_TEST_MARKER"\necho \'{"loggedIn":true}\'\n', { mode: 0o755 });
    const started = await startDeriveServer(entry, { ...hermetic, PATH: shimBin, DERIVE_TEST_MARKER: marker });
    server = started.child;
    dataDir = started.dataDir;
    api = client(started.base, readFileSync(join(dataDir, 'token'), 'utf8').trim());
  });

  after(() => {
    server?.kill();
    if (dataDir) rmSync(dataDir, { recursive: true, force: true });
    if (shimBin) rmSync(shimBin, { recursive: true, force: true });
  });

  it('runs the detectors once at boot and not again for six read-only requests', async () => {
    assert.equal(runs(), 1);
    const bodies: string[] = [];
    for (let i = 0; i < 3; i++) {
      bodies.push((await api('/api/settings')).text);
      bodies.push((await api('/api/health')).text);
    }
    assert.equal(runs(), 1);
    for (const b of bodies) assert.ok(!b.includes('email'), b);
  });

  it('reports the boot observation as the detected provider', async () => {
    const r = await api<Tutor>('/api/settings/active');
    assert.equal(r.json.provider, 'claude-code');
    assert.equal(r.json.source, 'detected');
    assert.ok(!r.text.includes('email'), r.text);
    // The observation is fresh, so even the turn resolver did not look again.
    assert.equal(runs(), 1);
    const view = await api<SettingsView>('/api/settings');
    assert.equal(view.json.rows.find((row) => row.id === 'claude-code')!.status, 'logged in');
  });

  it('spawns the CLI exactly once per detect pass, and not for the reads that follow', async () => {
    const before = runs();
    const r = await api<SettingsView>('/api/settings/detect', {});
    assert.equal(r.status, 200, r.text);
    assert.equal(runs(), before + 1);
    assert.equal(r.json.rows.find((row) => row.id === 'claude-code')!.status, 'logged in');
    for (let i = 0; i < 3; i++) await api('/api/settings');
    assert.equal(runs(), before + 1);
  });
});

/** A loopback server answering one JSON body on one path, and 404 elsewhere; or HTML everywhere, the way a foreign dashboard on a default port does. */
function fakeServer(answer: (url: string) => { status: number; type: string; body: string }): Promise<{ server: Server; port: number }> {
  return new Promise((res) => {
    const server = createServer((req, r) => {
      const a = answer(req.url ?? '/');
      r.statusCode = a.status;
      r.setHeader('content-type', a.type);
      r.end(a.body);
    });
    server.listen(0, '127.0.0.1', () => res({ server, port: (server.address() as AddressInfo).port }));
  });
}

const jsonAt = (path: string, body: unknown) => (url: string) =>
  url === path ? { status: 200, type: 'application/json', body: JSON.stringify(body) } : { status: 404, type: 'application/json', body: '{"error":"not found"}' };

describe('detection over HTTP', () => {
  let server: ChildProcess | undefined;
  let dataDir = '';
  let detectHome = '';
  let api: ReturnType<typeof client>;
  const fakes: Server[] = [];
  const port = { ollama: 0, lmstudio: 0, llamacpp: 0, html: 0, closed: 0 };
  const rows = async () => {
    const r = await api<SettingsView>('/api/settings');
    return new Map(r.json.rows.map((row) => [row.id, row]));
  };
  const detect = async () => {
    const r = await api<SettingsView>('/api/settings/detect', {});
    assert.equal(r.status, 200, r.text);
    return { text: r.text, json: r.json, byId: new Map(r.json.rows.map((row) => [row.id, row])) };
  };

  before(async () => {
    // A private Codex home, so writing an auth.json here signs nothing else in this file in.
    detectHome = mkdtempSync(join(tmpdir(), 'derive-settings-detect-'));
    const ollama = await fakeServer(jsonAt('/api/tags', { models: [] }));
    const lmstudio = await fakeServer(jsonAt('/api/v0/models', { object: 'list', data: [] }));
    const llamacpp = await fakeServer(jsonAt('/health', { status: 'ok' }));
    // The FreqUI case: HTTP 200 text/html on every path, which is what an unrelated dashboard on 8080 answers.
    const html = await fakeServer(() => ({ status: 200, type: 'text/html', body: '<!doctype html><title>FreqUI</title>' }));
    fakes.push(ollama.server, lmstudio.server, llamacpp.server, html.server);
    Object.assign(port, { ollama: ollama.port, lmstudio: lmstudio.port, llamacpp: llamacpp.port, html: html.port, closed: await freePort() });
    const started = await startDeriveServer(entry, { ...hermetic, CODEX_HOME: detectHome });
    server = started.child;
    dataDir = started.dataDir;
    api = client(started.base, readFileSync(join(dataDir, 'token'), 'utf8').trim());
  });

  after(() => {
    server?.kill();
    for (const f of fakes) f.close();
    if (dataDir) rmSync(dataDir, { recursive: true, force: true });
    if (detectHome) rmSync(detectHome, { recursive: true, force: true });
  });

  it('reads checking on the local rows until a pass has looked', async () => {
    const byId = await rows();
    for (const id of ['ollama', 'lmstudio', 'llamacpp']) assert.equal(byId.get(id)!.status, 'checking', id);
    assert.equal(byId.get('codex')!.status, 'not configured');
  });

  it('refuses a base URL on a row with a fixed endpoint', async () => {
    const r = await api('/api/settings/anthropic', { base_url: 'http://x' }, 'PUT');
    assert.equal(r.status, 400);
    assert.equal(r.json.error, 'Anthropic has a fixed endpoint');
  });

  it('refuses a base URL that is not http or https, carries credentials, or has a query', async () => {
    const scheme = await api('/api/settings/openai-compatible', { base_url: 'ftp://x' }, 'PUT');
    assert.equal(scheme.status, 400);
    assert.equal(scheme.json.error, 'the base URL must start with http:// or https://');
    const creds = await api('/api/settings/openai-compatible', { base_url: 'http://u:p@127.0.0.1:9' }, 'PUT');
    assert.equal(creds.status, 400);
    assert.equal(creds.json.error, 'the base URL must not carry a username or password');
    const query = await api('/api/settings/openai-compatible', { base_url: 'http://127.0.0.1:9/v1?x=1' }, 'PUT');
    assert.equal(query.status, 400);
    assert.equal(query.json.error, 'the base URL must not have a query or fragment');
  });

  it('stores a base URL as origin plus path without a trailing slash, and clears it with an empty string', async () => {
    const stored = await api<Row>('/api/settings/openai-compatible', { base_url: 'http://127.0.0.1:9/v1/' }, 'PUT');
    assert.equal(stored.status, 200, stored.text);
    assert.equal(stored.json.base_url, 'http://127.0.0.1:9/v1');
    const cleared = await api<Row>('/api/settings/openai-compatible', { base_url: '' }, 'PUT');
    assert.equal(cleared.status, 200, cleared.text);
    assert.equal(cleared.json.base_url, null);
    assert.equal(cleared.json.base_url_default, null);
  });

  it('finds the Codex login and the three local servers at their stored bases in one pass', async () => {
    writeFileSync(join(detectHome, 'auth.json'), '{}');
    for (const id of ['ollama', 'lmstudio', 'llamacpp'] as const) {
      const r = await api<Row>(`/api/settings/${id}`, { base_url: `http://127.0.0.1:${port[id]}` }, 'PUT');
      assert.equal(r.status, 200, r.text);
      assert.equal(r.json.base_url, `http://127.0.0.1:${port[id]}`);
    }
    const { byId, text } = await detect();
    assert.equal(byId.get('codex')!.status, 'logged in');
    assert.equal(byId.get('claude-code')!.status, 'not configured');
    assert.equal(byId.get('ollama')!.status, `found on port ${port.ollama}`);
    assert.equal(byId.get('lmstudio')!.status, `found on port ${port.lmstudio}`);
    assert.equal(byId.get('llamacpp')!.status, `found on port ${port.llamacpp}`);
    assert.ok(!text.includes('email'), text);
  });

  it('reads an HTML 200 on the llama.cpp base as not configured, never as found', async () => {
    await api('/api/settings/llamacpp', { base_url: `http://127.0.0.1:${port.html}` }, 'PUT');
    const { byId } = await detect();
    assert.equal(byId.get('llamacpp')!.status, 'not configured');
    assert.equal(byId.get('ollama')!.status, `found on port ${port.ollama}`);
  });

  it('answers within two seconds when the llama.cpp base is a closed port', async () => {
    await api('/api/settings/llamacpp', { base_url: `http://127.0.0.1:${port.closed}` }, 'PUT');
    const t0 = Date.now();
    const { byId } = await detect();
    assert.ok(Date.now() - t0 < 2000, `the pass took ${Date.now() - t0} ms`);
    assert.equal(byId.get('llamacpp')!.status, 'not configured');
  });

  it('leaves Codex detected when only Codex is logged in and nothing is stored', async () => {
    const active = await api<Tutor>('/api/settings/active');
    assert.deepEqual(active.json, { provider: 'codex', model: null, source: 'detected', modelSource: null });
    const byId = await rows();
    assert.deepEqual([...byId.values()].filter((row) => row.active).map((row) => row.id), ['codex']);
  });

  it('falls back to Claude Code when nothing is logged in, with every login and local row not configured', async () => {
    rmSync(join(detectHome, 'auth.json'));
    for (const id of ['ollama', 'lmstudio']) await api(`/api/settings/${id}`, { base_url: `http://127.0.0.1:${port.closed}` }, 'PUT');
    const { byId, json } = await detect();
    for (const id of ['claude-code', 'codex', 'ollama', 'lmstudio', 'llamacpp']) assert.equal(byId.get(id)!.status, 'not configured', id);
    assert.deepEqual(json.active, { provider: 'claude-code', model: null, source: 'detected', modelSource: null });
    assert.equal(JSON.stringify(json).includes('email'), false);
    const active = await api<Tutor>('/api/settings/active');
    assert.equal(active.json.provider, 'claude-code');
    assert.equal(active.json.source, 'detected');
  });
});

/**
 * A loopback stand-in for an OpenAI-compatible provider. `/v1/models` lists
 * three ids (one twice) for the good key and answers 401 with a two-line
 * OpenAI-shaped body for any other; `/redirect/v1/models` points elsewhere
 * with a 302; `/html/v1/models` is a 200 that is not JSON. Never a real host.
 */
function fakeProvider(goodKey: string, elsewhere: number): Promise<{ server: Server; port: number }> {
  return new Promise((res) => {
    const server = createServer((req, r) => {
      const url = req.url ?? '/';
      if (url === '/redirect/v1/models') {
        r.statusCode = 302;
        r.setHeader('location', `http://127.0.0.1:${elsewhere}/v1/models`);
        r.end();
        return;
      }
      if (url === '/html/v1/models') {
        r.statusCode = 200;
        r.setHeader('content-type', 'text/html');
        r.end('<!doctype html><title>not a list</title>');
        return;
      }
      r.setHeader('content-type', 'application/json');
      if (url !== '/v1/models') {
        r.statusCode = 404;
        r.end('{"error":"not found"}');
        return;
      }
      if (req.headers.authorization === `Bearer ${goodKey}`) {
        r.statusCode = 200;
        r.end(JSON.stringify({ object: 'list', data: [{ id: 'tiny-b' }, { id: 'tiny-a' }, { id: 'tiny-a' }] }));
        return;
      }
      r.statusCode = 401;
      r.end(JSON.stringify({ error: { message: 'Incorrect API key provided: good-***\nsecond line of the body', type: 'invalid_request_error' } }));
    });
    server.listen(0, '127.0.0.1', () => res({ server, port: (server.address() as AddressInfo).port }));
  });
}

describe('model lists and connection tests over HTTP', () => {
  let server: ChildProcess | undefined;
  let dataDir = '';
  let testHome = '';
  let api: ReturnType<typeof client>;
  const fakes: Server[] = [];
  const port = { provider: 0, elsewhere: 0, ollama: 0, lmstudio: 0, llamacpp: 0, closed: 0 };
  const GOOD = 'good-key-good-key-1234';
  const WRONG = 'wrong-key-wrong-key-1234';
  const SENTENCE = '401 Incorrect API key provided: good-*** second line of the body';
  // Every body this suite reads, so the last case can prove neither key was ever echoed.
  const texts: string[] = [];
  const call = async <T = Record<string, unknown>>(path: string, body?: unknown, method?: string) => {
    const r = await api<T>(path, body, method);
    texts.push(r.text);
    return r;
  };
  const compat = (fields: Record<string, string>) => call<Row>('/api/settings/openai-compatible', fields, 'PUT');
  const test = (id: string) => call<TestResult>(`/api/settings/${id}/test`, {});

  before(async () => {
    // A private Codex home: the codex case writes an auth.json and nothing else in this file may see it.
    testHome = mkdtempSync(join(tmpdir(), 'derive-settings-test-'));
    port.elsewhere = await freePort();
    port.closed = await freePort();
    const provider = await fakeProvider(GOOD, port.elsewhere);
    const ollama = await fakeServer(jsonAt('/api/tags', { models: [{ name: 'llama3.2:latest' }, { name: 'qwen/qwen3-8b:latest' }] }));
    const lmstudio = await fakeServer(jsonAt('/api/v0/models', { object: 'list', data: [{ id: 'x', state: 'not-loaded' }, { id: 'y', state: 'loaded' }] }));
    const llamacpp = await fakeServer(jsonAt('/v1/models', { object: 'list', data: [{ id: 'model.gguf', owned_by: 'llamacpp' }] }));
    fakes.push(provider.server, ollama.server, lmstudio.server, llamacpp.server);
    Object.assign(port, { provider: provider.port, ollama: ollama.port, lmstudio: lmstudio.port, llamacpp: llamacpp.port });
    const started = await startDeriveServer(entry, { ...hermetic, CODEX_HOME: testHome });
    server = started.child;
    dataDir = started.dataDir;
    api = client(started.base, readFileSync(join(dataDir, 'token'), 'utf8').trim());
  });

  after(() => {
    server?.kill();
    for (const f of fakes) f.close();
    if (dataDir) rmSync(dataDir, { recursive: true, force: true });
    if (testHome) rmSync(testHome, { recursive: true, force: true });
  });

  it('fetches the models of an OpenAI-compatible endpoint with the stored key, de-duplicated and in the provider order', async () => {
    const stored = await compat({ base_url: `http://127.0.0.1:${port.provider}`, key: GOOD });
    assert.equal(stored.status, 200, stored.text);
    assert.deepEqual(stored.json.key, { set: true, hint: '1234', locked: null });
    const r = await call<{ models: string[] }>('/api/settings/openai-compatible/models', {});
    assert.equal(r.status, 200, r.text);
    assert.deepEqual(r.json, { models: ['tiny-b', 'tiny-a'] });
  });

  it('reports Connected with the model count and a latency', async () => {
    const r = await test('openai-compatible');
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.ok, true);
    assert.equal(r.json.models, 2);
    assert.ok(typeof r.json.ms === 'number' && r.json.ms >= 0, r.text);
    assert.equal(r.json.error, undefined);
  });

  it('quotes the provider 401 verbatim on one line, with the fix hint beside it, on the test and on the list', async () => {
    const stored = await compat({ key: WRONG });
    assert.equal(stored.status, 200, stored.text);
    const r = await test('openai-compatible');
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.ok, false);
    assert.equal(r.json.error, SENTENCE);
    assert.match(String(r.json.hint), /refused/);
    assert.match(String(r.json.hint), /OpenAI-compatible endpoint/);
    const models = await call('/api/settings/openai-compatible/models', {});
    assert.equal(models.status, 502, models.text);
    assert.equal(models.json.error, SENTENCE);
  });

  it('refuses to follow a redirect that could carry the key', async () => {
    await compat({ base_url: `http://127.0.0.1:${port.provider}/redirect` });
    const r = await test('openai-compatible');
    assert.equal(r.json.ok, false);
    assert.ok(String(r.json.error).startsWith('302 '), r.text);
    assert.match(String(r.json.error), /redirect/);
    assert.equal(r.json.hint, undefined);
  });

  it('says when the answer was not JSON, with its status', async () => {
    await compat({ base_url: `http://127.0.0.1:${port.provider}/html` });
    const r = await test('openai-compatible');
    assert.equal(r.json.ok, false);
    assert.match(String(r.json.error), /^200 .*not JSON/);
  });

  it('names the address in its own sentence when nothing answered', async () => {
    await compat({ base_url: `http://127.0.0.1:${port.closed}` });
    const t0 = Date.now();
    const r = await test('openai-compatible');
    assert.ok(Date.now() - t0 < 4000, `the test took ${Date.now() - t0} ms`);
    assert.equal(r.json.ok, false);
    assert.equal(r.json.error, `nothing answered at 127.0.0.1:${port.closed}`);
  });

  it('asks for the base URL first when the OpenAI-compatible row has none', async () => {
    const cleared = await compat({ base_url: '' });
    assert.equal(cleared.status, 200, cleared.text);
    const r = await test('openai-compatible');
    assert.equal(r.json.ok, false);
    assert.equal(r.json.error, "Add the endpoint's base URL first");
    assert.equal(r.json.hint, undefined);
    const models = await call('/api/settings/openai-compatible/models', {});
    assert.equal(models.status, 502);
    assert.equal(models.json.error, "Add the endpoint's base URL first");
  });

  it('lists Ollama tags verbatim, LM Studio loaded models first, and tests llama.cpp on its models route', async () => {
    for (const id of ['ollama', 'lmstudio', 'llamacpp'] as const) {
      const r = await call<Row>(`/api/settings/${id}`, { base_url: `http://127.0.0.1:${port[id]}` }, 'PUT');
      assert.equal(r.status, 200, r.text);
    }
    const ollama = await call<{ models: string[] }>('/api/settings/ollama/models', {});
    assert.deepEqual(ollama.json, { models: ['llama3.2:latest', 'qwen/qwen3-8b:latest'] });
    const lmstudio = await call<{ models: string[] }>('/api/settings/lmstudio/models', {});
    assert.deepEqual(lmstudio.json, { models: ['y', 'x'] });
    const llamacpp = await test('llamacpp');
    assert.equal(llamacpp.json.ok, true, llamacpp.text);
    assert.equal(llamacpp.json.models, 1);
  });

  it('tests the Codex login by its auth file, Claude Code by its CLI, and refuses a list for either', async () => {
    writeFileSync(join(testHome, 'auth.json'), '{}');
    const codex = await test('codex');
    assert.equal(codex.status, 200, codex.text);
    assert.equal(codex.json.ok, true);
    assert.equal(codex.json.models, null);
    assert.ok(typeof codex.json.ms === 'number' && codex.json.ms >= 0);
    rmSync(join(testHome, 'auth.json'));
    const gone = await test('codex');
    assert.equal(gone.json.ok, false);
    assert.match(String(gone.json.error), /no Codex login/);
    // PATH is empty for this spawn, so the CLI is not there to answer.
    const claude = await test('claude-code');
    assert.equal(claude.json.ok, false);
    assert.match(String(claude.json.error), /no Claude Code login/);
    const list = await call('/api/settings/claude-code/models', {});
    assert.equal(list.status, 502);
    assert.match(String(list.json.error), /has no model list/);
    const unknown = await call('/api/settings/nope/models', {});
    assert.equal(unknown.status, 404);
    assert.equal(unknown.json.error, 'unknown provider');
    const unknownTest = await call('/api/settings/nope/test', {});
    assert.equal(unknownTest.status, 404);
  });

  it('never echoes the good key or the wrong one in any response', () => {
    assert.ok(texts.length >= 20, `only ${texts.length} bodies were read`);
    for (const t of texts) {
      assert.ok(!t.includes(GOOD), t);
      assert.ok(!t.includes(WRONG), t);
    }
  });
});

describe('request building and normalisation, in process', () => {
  const key = 'k1234567890123456';

  it('sends the key in the header each provider reads, and never in the URL', () => {
    const gemini = requestFor(providerOf('gemini')!, key, undefined);
    assert.ok(!gemini.url.includes('key='), gemini.url);
    assert.equal(gemini.headers['x-goog-api-key'], key);
    const anthropic = requestFor(providerOf('anthropic')!, key, undefined);
    assert.equal(anthropic.headers['anthropic-version'], '2023-06-01');
    assert.equal(anthropic.headers['x-api-key'], key);
    assert.ok(anthropic.url.endsWith('/v1/models?limit=1000'), anthropic.url);
    const openai = requestFor(providerOf('openai')!, key, undefined);
    assert.ok(openai.headers.authorization.startsWith('Bearer '), openai.headers.authorization);
    const openrouter = requestFor(providerOf('openrouter')!, key, undefined);
    assert.equal(openrouter.headers.authorization, `Bearer ${key}`);
    assert.ok(openrouter.url.endsWith('/api/v1/models'), openrouter.url);
  });

  it('joins /v1/models onto a base that already ends in /v1, and sends no authorization without a key', () => {
    const compat = requestFor(providerOf('openai-compatible')!, undefined, 'http://127.0.0.1:1/v1');
    assert.equal(compat.url, 'http://127.0.0.1:1/v1/models');
    assert.equal(compat.headers.authorization, undefined);
    assert.equal(requestFor(providerOf('openai-compatible')!, key, 'http://127.0.0.1:1').url, 'http://127.0.0.1:1/v1/models');
    assert.deepEqual(requestFor(providerOf('ollama')!, key, undefined), { url: 'http://127.0.0.1:11434/api/tags', headers: {} });
    assert.deepEqual(requestFor(providerOf('lmstudio')!, key, 'http://127.0.0.1:9'), { url: 'http://127.0.0.1:9/api/v0/models', headers: { authorization: `Bearer ${key}` } });
    assert.deepEqual(requestFor(providerOf('llamacpp')!, undefined, undefined), { url: 'http://127.0.0.1:8080/v1/models', headers: {} });
  });

  it('refuses a list for a login row and for the OpenAI-compatible row without a base URL', () => {
    assert.throws(() => requestFor(providerOf('claude-code')!, undefined, undefined), { message: 'Claude Code has no model list' });
    assert.throws(() => requestFor(providerOf('codex')!, undefined, undefined), { message: 'Codex has no model list' });
    assert.throws(() => requestFor(providerOf('openai-compatible')!, key, undefined), { message: "Add the endpoint's base URL first" });
  });

  it('normalises each provider list to ids in its order, de-duplicated, and reads a strange body as empty', () => {
    const gemini = providerOf('gemini')!;
    assert.deepEqual(
      idsOf(gemini, { models: [{ name: 'models/gemini-3.8-flash', supportedGenerationMethods: ['generateContent'] }, { name: 'models/embedding-001', supportedGenerationMethods: ['embedContent'] }, { name: 'models/unsaid' }] }),
      ['gemini-3.8-flash', 'unsaid'],
    );
    assert.deepEqual(idsOf(providerOf('openai')!, { data: [{ id: 'b' }, { id: 'a' }, { id: 'b' }] }), ['b', 'a']);
    assert.deepEqual(idsOf(providerOf('ollama')!, { models: [{ name: 'llama3.2:latest' }, { name: 'llama3.2:latest' }] }), ['llama3.2:latest']);
    assert.deepEqual(idsOf(providerOf('lmstudio')!, { object: 'list', data: [{ id: 'x', state: 'not-loaded' }, { id: 'y', state: 'loaded' }, { id: 'z' }] }), ['y', 'x', 'z']);
    assert.deepEqual(idsOf(providerOf('anthropic')!, { models: [] }), []);
    assert.deepEqual(idsOf(providerOf('openai')!, '<html>'), []);
    assert.deepEqual(idsOf(providerOf('openai')!, { data: [{ id: 3 }, { id: '' }] }), []);
  });

  it('unwraps every error envelope into status plus the sentence, on one line, cut at 300', () => {
    assert.equal(providerSentence(401, '{"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}'), '401 invalid x-api-key');
    assert.equal(providerSentence(500, '{"error":"model not found"}'), '500 model not found');
    assert.equal(providerSentence(404, '{"message":"no such route"}'), '404 no such route');
    assert.equal(providerSentence(401, '{"error":{"message":"line one\\n  line two"}}'), '401 line one line two');
    assert.equal(providerSentence(503, 'plain\ttext'), '503 plain text');
    assert.equal(providerSentence(502, ''), '502 no message');
    assert.equal(providerSentence(502, 'x'.repeat(400)).length, 300);
  });

  it('adds a hint only for the cases it recognises', () => {
    assert.match(String(hintFor('Anthropic', 401, '401 invalid x-api-key')), /Paste a new key for Anthropic/);
    assert.match(String(hintFor('OpenAI', 400, '400 Incorrect API key provided')), /refused/);
    assert.match(String(hintFor('OpenAI', 402, '402 insufficient funds')), /credit/);
    assert.match(String(hintFor('OpenRouter', 429, '429 slow down')), /Rate limited/);
    assert.equal(hintFor('OpenAI', 200, '200 ok'), undefined);
    assert.equal(hintFor('OpenAI', 0, 'nothing answered at 127.0.0.1:1'), undefined);
  });

  it('tells a local address from a remote one by the literal host alone', () => {
    for (const url of ['http://127.0.0.1:1', 'http://localhost:1234', 'http://10.0.0.5', 'http://192.168.1.20:11434', 'http://172.16.0.1', 'http://[::1]:8080', 'http://box.local']) assert.equal(isLocalUrl(url), true, url);
    for (const url of ['https://example.com/v1', 'http://8.8.8.8', 'http://172.32.0.1', 'not a url']) assert.equal(isLocalUrl(url), false, url);
  });
});

describe('the environment locks its fields', () => {
  let server: ChildProcess | undefined;
  let dataDir = '';
  let api: ReturnType<typeof client>;

  before(async () => {
    const started = await startDeriveServer(entry, { ...hermetic, DERIVE_BACKEND: 'claude', DERIVE_MODEL: 'pinned-model' });
    server = started.child;
    dataDir = started.dataDir;
    api = client(started.base, readFileSync(join(dataDir, 'token'), 'utf8').trim());
  });

  after(() => {
    server?.kill();
    if (dataDir) rmSync(dataDir, { recursive: true, force: true });
  });

  it('answers 409 naming DERIVE_BACKEND when the provider is set there', async () => {
    const r = await api('/api/settings/active', { provider: 'codex' });
    assert.equal(r.status, 409);
    assert.match(String(r.json.error), /DERIVE_BACKEND/);
  });

  it('answers 409 naming DERIVE_MODEL when the model is set there', async () => {
    const r = await api('/api/settings/claude-code', { model: 'x' }, 'PUT');
    assert.equal(r.status, 409);
    assert.match(String(r.json.error), /DERIVE_MODEL/);
  });

  it('reports both as coming from the environment', async () => {
    const r = await api<Tutor>('/api/settings/active');
    assert.deepEqual(r.json, { provider: 'claude-code', model: 'pinned-model', source: 'environment', modelSource: 'environment' });
  });
});

describe('keys over HTTP', () => {
  let server: ChildProcess | undefined;
  let dataDir = '';
  let api: ReturnType<typeof client>;
  const GOOD = 'good-key-good-key-1234';
  const secretsPath = () => join(dataDir, 'secrets.json');
  const row = async (id: string) => {
    const r = await api<SettingsView>('/api/settings');
    return { text: r.text, row: r.json.rows.find((x) => x.id === id)! };
  };

  before(async () => {
    const started = await startDeriveServer(entry, hermetic);
    server = started.child;
    dataDir = started.dataDir;
    api = client(started.base, readFileSync(join(dataDir, 'token'), 'utf8').trim());
  });

  after(() => {
    server?.kill();
    if (dataDir) rmSync(dataDir, { recursive: true, force: true });
  });

  it('paints a key row as unset with no lock, and no key field on a login or Ollama row', async () => {
    const r = await api<SettingsView>('/api/settings');
    const byId = new Map(r.json.rows.map((x) => [x.id, x]));
    assert.deepEqual(byId.get('openai')!.key, { set: false, hint: null, locked: null });
    assert.equal(byId.get('openai')!.status, 'not configured');
    assert.equal(byId.get('claude-code')!.key, null);
    assert.equal(byId.get('ollama')!.key, null);
    assert.deepEqual(byId.get('lmstudio')!.key, { set: false, hint: null, locked: null });
    assert.equal(byId.get('lmstudio')!.key_optional, true);
    assert.equal(byId.get('openai')!.key_optional, false);
    assert.equal(byId.get('ollama')!.base_url_locked, null);
    assert.equal(r.json.secrets_error, null);
    assert.ok(!existsSync(secretsPath()));
  });

  it('stores a key and answers { set, hint } only, never the value', async () => {
    const r = await api<Row>('/api/settings/openai', { key: GOOD }, 'PUT');
    assert.equal(r.status, 200, r.text);
    assert.deepEqual(r.json.key, { set: true, hint: '1234', locked: null });
    assert.equal(r.json.status, 'key set');
    assert.ok(!r.text.includes(GOOD), r.text);
    const view = await api<SettingsView>('/api/settings');
    assert.ok(!JSON.stringify(view.json).includes(GOOD));
    assert.deepEqual(view.json.rows.find((x) => x.id === 'openai')!.key, { set: true, hint: '1234', locked: null });
  });

  it('writes the file 0600 as { providerId: key }', { skip: process.platform === 'win32' }, () => {
    assert.equal(statSync(secretsPath()).mode & 0o777, 0o600);
    assert.deepEqual(JSON.parse(readFileSync(secretsPath(), 'utf8')), { openai: GOOD });
  });

  it('gives a short key an empty hint, so the hint never reveals most of it', async () => {
    const r = await api<Row>('/api/settings/anthropic', { key: 'abcdefg' }, 'PUT');
    assert.equal(r.status, 200, r.text);
    assert.deepEqual(r.json.key, { set: true, hint: '', locked: null });
    assert.ok(!r.text.includes('abcdefg'));
    assert.deepEqual(JSON.parse(readFileSync(secretsPath(), 'utf8')), { openai: GOOD, anthropic: 'abcdefg' });
  });

  it('refuses an empty, an absurdly long, and a whitespace-bearing key with the row sentence', async () => {
    const empty = await api('/api/settings/openai', { key: '' }, 'PUT');
    assert.equal(empty.status, 400);
    assert.equal(empty.json.error, 'the key is empty');
    const long = await api('/api/settings/openai', { key: 'k'.repeat(5000) }, 'PUT');
    assert.equal(long.status, 400);
    assert.match(String(long.json.error), /longer than any provider issues/);
    const spaced = await api('/api/settings/openai', { key: 'a b' }, 'PUT');
    assert.equal(spaced.status, 400);
    assert.match(String(spaced.json.error), /spaces/);
    // Nothing above touched the file.
    assert.deepEqual(JSON.parse(readFileSync(secretsPath(), 'utf8')), { openai: GOOD, anthropic: 'abcdefg' });
  });

  it('refuses a key on a login row and on the Ollama row', async () => {
    const login = await api('/api/settings/claude-code', { key: GOOD }, 'PUT');
    assert.equal(login.status, 400);
    assert.match(String(login.json.error), /runs on its login/);
    const ollama = await api('/api/settings/ollama', { key: GOOD }, 'PUT');
    assert.equal(ollama.status, 400);
    assert.equal(ollama.json.error, 'Ollama takes no key');
    assert.ok(!login.text.includes(GOOD) && !ollama.text.includes(GOOD));
  });

  it('removes a key, says the process still hides it, and removes the file with the last key', async () => {
    const r = await api<{ ok: boolean; note: string }>('/api/settings/openai/key', undefined, 'DELETE');
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.ok, true);
    assert.match(r.json.note, /until Derive restarts/);
    assert.ok(!r.text.includes(GOOD));
    const openai = await row('openai');
    assert.deepEqual(openai.row.key, { set: false, hint: null, locked: null });
    assert.equal(openai.row.status, 'not configured');
    assert.ok(existsSync(secretsPath()), 'the other key kept the file');
    const again = await api('/api/settings/anthropic/key', undefined, 'DELETE');
    assert.equal(again.status, 200, again.text);
    assert.ok(!existsSync(secretsPath()), 'the last key removed the file');
    const unknown = await api('/api/settings/nope/key', undefined, 'DELETE');
    assert.equal(unknown.status, 404);
  });
});

describe('the environment locks its keys', () => {
  let server: ChildProcess | undefined;
  let dataDir = '';
  let api: ReturnType<typeof client>;
  const values = { OPENAI_API_KEY: 'from-env-from-env-1234', GEMINI_API_KEY: 'gem-key-gem-key-12345', GOOGLE_API_KEY: 'goo-key-goo-key-12345' };
  const texts: string[] = [];

  before(async () => {
    const started = await startDeriveServer(entry, { ...hermetic, ...values, OLLAMA_HOST: '127.0.0.1:19999' });
    server = started.child;
    dataDir = started.dataDir;
    api = client(started.base, readFileSync(join(dataDir, 'token'), 'utf8').trim());
  });

  after(() => {
    server?.kill();
    if (dataDir) rmSync(dataDir, { recursive: true, force: true });
  });

  it('reads set from environment with the variable named, Google before Gemini, and OLLAMA_HOST on the Ollama row', async () => {
    const r = await api<SettingsView>('/api/settings');
    texts.push(r.text);
    const byId = new Map(r.json.rows.map((x) => [x.id, x]));
    assert.deepEqual(byId.get('openai')!.key, { set: true, hint: null, locked: 'OPENAI_API_KEY' });
    assert.equal(byId.get('openai')!.status, 'set from environment');
    assert.deepEqual(byId.get('gemini')!.key, { set: true, hint: null, locked: 'GOOGLE_API_KEY' });
    assert.deepEqual(byId.get('anthropic')!.key, { set: false, hint: null, locked: null });
    assert.equal(byId.get('ollama')!.base_url_locked, 'OLLAMA_HOST');
    assert.equal(byId.get('ollama')!.base_url, 'http://127.0.0.1:19999');
    assert.equal(byId.get('lmstudio')!.base_url_locked, null);
  });

  it('answers 409 naming the variable on a key write and on a key removal', async () => {
    const put = await api('/api/settings/openai', { key: 'x'.repeat(20) }, 'PUT');
    texts.push(put.text);
    assert.equal(put.status, 409);
    assert.match(String(put.json.error), /OPENAI_API_KEY/);
    const del = await api('/api/settings/openai/key', undefined, 'DELETE');
    texts.push(del.text);
    assert.equal(del.status, 409);
    assert.match(String(del.json.error), /OPENAI_API_KEY/);
    const gem = await api('/api/settings/gemini', { key: 'y'.repeat(20) }, 'PUT');
    texts.push(gem.text);
    assert.equal(gem.status, 409);
    assert.match(String(gem.json.error), /GOOGLE_API_KEY/);
  });

  it('answers 409 on the Ollama address while OLLAMA_HOST is set', async () => {
    const r = await api('/api/settings/ollama', { base_url: 'http://127.0.0.1:1' }, 'PUT');
    texts.push(r.text);
    assert.equal(r.status, 409);
    assert.match(String(r.json.error), /OLLAMA_HOST/);
  });

  it('never echoes an environment value and never copies one into the file', async () => {
    texts.push((await api('/api/settings/active')).text, (await api('/api/health')).text);
    for (const t of texts) for (const v of Object.values(values)) assert.ok(!t.includes(v), t);
    assert.ok(!existsSync(join(dataDir, 'secrets.json')));
  });
});

describe('a secrets file that cannot be read', () => {
  let server: ChildProcess | undefined;
  let dataDir = '';
  let api: ReturnType<typeof client>;
  const corrupt = '{oops';

  before(async () => {
    dataDir = mkdtempSync(join(tmpdir(), 'derive-settings-corrupt-'));
    writeFileSync(join(dataDir, 'secrets.json'), corrupt, { mode: 0o600 });
    const started = await startDeriveServer(entry, hermetic, { dataDir });
    server = started.child;
    api = client(started.base, readFileSync(join(dataDir, 'token'), 'utf8').trim());
  });

  after(() => {
    server?.kill();
    if (dataDir) rmSync(dataDir, { recursive: true, force: true });
  });

  it('is loud on the settings view, refuses a key, and leaves the file exactly as it was', async () => {
    const view = await api<SettingsView>('/api/settings');
    assert.equal(view.status, 200, view.text);
    assert.match(String(view.json.secrets_error), /could not be read/);
    assert.ok(!view.text.includes('oops'), 'the error names the reason without quoting the file');
    assert.deepEqual(view.json.rows.find((x) => x.id === 'openai')!.key, { set: false, hint: null, locked: null });
    const put = await api('/api/settings/openai', { key: 'good-key-good-key-1234' }, 'PUT');
    assert.equal(put.status, 400);
    assert.match(String(put.json.error), /could not be read/);
    const del = await api('/api/settings/openai/key', undefined, 'DELETE');
    assert.equal(del.status, 400);
    assert.equal(readFileSync(join(dataDir, 'secrets.json'), 'utf8'), corrupt);
  });
});

describe('keys, in process', () => {
  const secretsPath = join(scratch, 'secrets.json');

  it('registers a key with the redaction chokepoint before it is written', () => {
    setKey('openai', 'module-key-module-key-1');
    assert.equal(redact('a module-key-module-key-1 b'), 'a [redacted] b');
    assert.equal(keyOf('openai'), 'module-key-module-key-1');
  });

  it('registers every key it loads from a file written by hand', () => {
    writeFileSync(secretsPath, '{ "anthropic": "hand-written-key-1234567" }\n', { mode: 0o600 });
    resetKeyCache();
    const before = secretCount();
    assert.equal(keyOf('anthropic'), 'hand-written-key-1234567');
    assert.equal(secretCount(), before + 1);
    assert.equal(keyOf('openai'), undefined);
    assert.equal(redact('hand-written-key-1234567'), '[redacted]');
  });

  it('hints with the last four characters of a key at least eight long, and nothing of a shorter one', () => {
    assert.equal(hintOf('abcdefg'), '');
    assert.equal(hintOf('abcdefgh'), 'efgh');
    assert.equal(hintOf('  abcdefgh  '), 'efgh');
  });
});

/** One lesson, one turn on the fake driver. */
async function fakeTurn(id: string) {
  setFakeScript([{ kind: 'end', payload: { ok: true } }]);
  setDriverOverride(fakeDriver);
  try {
    await runTurn(id, 'teach me');
  } finally {
    setDriverOverride(null);
  }
}

const T0 = 1_700_000_000_000;
const fresh = () => rememberDetection({ logins: { 'claude-code': false, codex: false } });

describe('the resolver, in process', () => {
  it('runs the very next turn on a choice made in settings, with no restart', async () => {
    setSetting(ACTIVE_PROVIDER, 'codex');
    setSetting(modelKey('codex'), 'gpt-5.4');
    const id = randomUUID();
    createLesson(id, 'Which model teaches');
    await fakeTurn(id);
    assert.equal(lastTurn(id)!.model, 'gpt-5.4');
    const start = listEvents(id).find((e) => e.type === 'turn_start');
    assert.deepEqual(start?.payload, { provider: 'codex', model: 'gpt-5.4' });
  });

  it('reflects a stored change at once, because nothing is memoised', () => {
    setSetting(ACTIVE_PROVIDER, 'codex');
    setSetting(modelKey('codex'), 'gpt-5.4');
    assert.equal(resolveTutor().model, 'gpt-5.4');
    setSetting(modelKey('codex'), 'gpt-5.5');
    assert.deepEqual(resolveTutor(), { provider: 'codex', model: 'gpt-5.5', source: 'settings', modelSource: 'settings' });
    deleteSetting(modelKey('codex'));
    assert.deepEqual(resolveTutor(), { provider: 'codex', model: null, source: 'settings', modelSource: null });
  });

  it('ignores a stored provider that does not teach and falls to detection', () => {
    fresh();
    setSetting(ACTIVE_PROVIDER, 'openai');
    const t = resolveTutor();
    assert.equal(t.source, 'detected');
    assert.equal(t.provider, 'claude-code');
    deleteSetting(ACTIVE_PROVIDER);
  });

  it('clears the session when the driver changes, so the provider starts fresh', async () => {
    setSetting(ACTIVE_PROVIDER, 'codex');
    const id = randomUUID();
    createLesson(id, 'A provider change');
    endTurn(startTurn(id, 'claude', null), 'ok');
    setSessionId(id, 's1');
    assert.equal(getLesson(id)!.session_id, 's1');
    await fakeTurn(id);
    assert.equal(getLesson(id)!.session_id, null);
  });

  it('keeps the session when only the model changes on the same driver', async () => {
    setSetting(ACTIVE_PROVIDER, 'codex');
    const id = randomUUID();
    createLesson(id, 'A model change');
    await fakeTurn(id);
    setSessionId(id, 's2');
    setSetting(modelKey('codex'), 'gpt-5.5');
    await fakeTurn(id);
    assert.equal(getLesson(id)!.session_id, 's2');
    assert.equal(lastTurn(id)!.model, 'gpt-5.5');
    deleteSetting(modelKey('codex'));
  });

  it('maps catalogue ids to the dialect the drivers speak, and driver names back', () => {
    assert.equal(backendOf('codex'), 'codex');
    assert.equal(backendOf('anthropic'), 'claude');
    assert.equal(backendOf('claude-code'), 'claude');
    assert.equal(providerOfDriver('claude'), 'claude-code');
    assert.equal(providerOfDriver('codex'), 'codex');
    assert.equal(providerOfDriver('fake'), 'fake');
  });

  it('lists ten providers in a fixed order, and only the two logins teach', () => {
    assert.deepEqual(
      PROVIDERS.map((p) => p.id),
      ['claude-code', 'codex', 'anthropic', 'openai', 'gemini', 'openrouter', 'openai-compatible', 'ollama', 'lmstudio', 'llamacpp'],
    );
    assert.deepEqual(PROVIDERS.filter((p) => p.teaches).map((p) => p.id), ['claude-code', 'codex']);
    assert.deepEqual(PROVIDERS.filter((p) => p.optionalKey).map((p) => p.id), ['lmstudio', 'llamacpp']);
  });

  it('detects in the order the old memo used: Claude, then Codex, then Claude', () => {
    deleteSetting(ACTIVE_PROVIDER);
    rememberDetection({ logins: { 'claude-code': true, codex: true } });
    assert.deepEqual(resolveTutor(), { provider: 'claude-code', model: null, source: 'detected', modelSource: null });
    rememberDetection({ logins: { 'claude-code': false, codex: true } });
    assert.equal(resolveTutor().provider, 'codex');
    rememberDetection({ logins: { 'claude-code': false, codex: false } });
    assert.equal(resolveTutor().provider, 'claude-code');
  });

  it('keeps an observation for DETECT_MS and reports it regardless of age', () => {
    resetDetection();
    const logins = { 'claude-code': false, codex: true };
    rememberDetection({ logins }, T0);
    assert.deepEqual(currentDetection(T0 + DETECT_MS - 1), { at: T0, logins });
    assert.equal(currentDetection(T0 + DETECT_MS), null);
    assert.deepEqual(lastDetection(), { at: T0, logins });
  });

  it('keeps what a pass found on the ports when a later pass only refreshed the logins', () => {
    resetDetection();
    const local = { ollama: 11434, lmstudio: null, llamacpp: null };
    rememberDetection({ logins: { 'claude-code': false, codex: false }, local }, T0);
    rememberDetection({ logins: { 'claude-code': true, codex: false } }, T0 + 1);
    assert.deepEqual(lastDetection(), { at: T0 + 1, logins: { 'claude-code': true, codex: false }, local });
    fresh();
  });

  it('answers read-only callers from the last pass and observes nothing itself', () => {
    resetDetection();
    deleteSetting(ACTIVE_PROVIDER);
    assert.deepEqual(currentTutor(), { provider: 'claude-code', model: null, source: 'detected', modelSource: null });
    assert.equal(lastDetection(), null);
  });

  it('reports a stale pass where a turn would look again', () => {
    rememberDetection({ logins: { 'claude-code': false, codex: true } }, T0);
    assert.equal(currentTutor().provider, 'codex');
    assert.equal(currentDetection(T0 + DETECT_MS), null);
    fresh();
  });
});

describe('base URLs and probes, in process', () => {
  it('normalises a base URL to origin plus path with no trailing slash', () => {
    assert.equal(normaliseBaseUrl('http://127.0.0.1:9/v1/'), 'http://127.0.0.1:9/v1');
    assert.equal(normaliseBaseUrl('HTTPS://Host.example/'), 'https://host.example');
    assert.equal(normaliseBaseUrl('  http://127.0.0.1:11434  '), 'http://127.0.0.1:11434');
  });

  it('refuses a scheme that is not http or https, credentials, and a query or fragment, each with its own sentence', () => {
    assert.throws(() => normaliseBaseUrl('ftp://x'), { message: 'the base URL must start with http:// or https://' });
    assert.throws(() => normaliseBaseUrl('not a url'), { message: 'the base URL must start with http:// or https://' });
    assert.throws(() => normaliseBaseUrl('http://u:p@h'), { message: 'the base URL must not carry a username or password' });
    assert.throws(() => normaliseBaseUrl('http://h/?q'), { message: 'the base URL must not have a query or fragment' });
    assert.throws(() => normaliseBaseUrl('http://h/#f'), { message: 'the base URL must not have a query or fragment' });
  });

  it('reads the port a base names, or the scheme default', () => {
    assert.equal(portOf('http://127.0.0.1:11434'), 11434);
    assert.equal(portOf('https://host.example'), 443);
    assert.equal(portOf('http://host.example/v1'), 80);
  });

  it('reads a local base from the table first and the catalogue second, and null where neither names one', () => {
    const ollama = providerOf('ollama')!;
    setSetting(baseUrlKey('ollama'), 'http://127.0.0.1:9');
    assert.equal(localBase(ollama), 'http://127.0.0.1:9');
    deleteSetting(baseUrlKey('ollama'));
    assert.equal(localBase(ollama), 'http://127.0.0.1:11434');
    assert.equal(localBase(providerOf('openai-compatible')!), null);
  });

  it('checks the shape each local server answers with, and nothing else about the body', () => {
    assert.equal(isOllama({ status: 200, body: { models: [] } }), true);
    assert.equal(isOllama({ status: 200, body: {} }), false);
    assert.equal(isOllama({ status: 200, body: null }), false);
    assert.equal(isOllama(null), false);
    assert.equal(isLmStudio({ status: 200, body: { object: 'list', data: [] } }), true);
    assert.equal(isLmStudio({ status: 200, body: { object: 'model' } }), false);
    assert.equal(isLlamaCpp({ status: 200, body: { status: 'ok' } }), true);
    // Still llama.cpp while a model loads.
    assert.equal(isLlamaCpp({ status: 503, body: { error: { code: 503, message: 'Loading model', type: 'unavailable_error' } } }), true);
    // The check is a shape, not a schema: extra keys beside status: ok are ignored.
    assert.equal(isLlamaCpp({ status: 200, body: { status: 'ok', extra: [] } }), true);
    assert.equal(isLlamaCpp({ status: 200, body: '<html>' }), false);
    assert.equal(isLlamaCpp({ status: 503, body: { error: 'busy' } }), false);
  });

  it('probes JSON within its bound and reads a closed port as nothing', async () => {
    const { server, port } = await fakeServer(jsonAt('/health', { status: 'ok' }));
    try {
      assert.deepEqual(await probeJson(`http://127.0.0.1:${port}/health`), { status: 200, body: { status: 'ok' } });
      assert.deepEqual(await probeJson(`http://127.0.0.1:${port}/nope`), { status: 404, body: { error: 'not found' } });
    } finally {
      server.close();
    }
    assert.equal(await probeJson(`http://127.0.0.1:${await freePort()}/health`), null);
  });
});
