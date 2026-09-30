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
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { startDeriveServer } from './spawn.js';

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

const { createLesson, deleteSetting, endTurn, getLesson, lastTurn, listEvents, setSessionId, setSetting, startTurn } = await import('../src/db.js');
const { runTurn } = await import('../src/agent.js');
const { setDriverOverride } = await import('../src/driver.js');
const { fakeDriver, setFakeScript } = await import('../src/drivers/fake.js');
const { ACTIVE_PROVIDER, DETECT_MS, backendOf, currentDetection, lastDetection, modelKey, rememberDetection, resetDetection, resolveTutor } = await import('../src/settings.js');
const { PROVIDERS, providerOfDriver } = await import('../src/providers.js');

const here = dirname(fileURLToPath(import.meta.url));
const entry = resolve(here, '../dist/index.js');

after(() => {
  for (const dir of [scratch, emptyBin, codexHome]) rmSync(dir, { recursive: true, force: true });
});

/** The environment every spawn in this file gets: nothing env-locked, no login reachable. */
const hermetic = { DERIVE_BACKEND: '', DERIVE_MODEL: '', CODEX_HOME: codexHome, PATH: emptyBin };

type Tutor = { provider: string; model: string | null; source: string; modelSource: string | null };

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
});
