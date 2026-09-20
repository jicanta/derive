/**
 * The credential as a live read behind a cache.
 *
 * A suite of its own, because what makes revocation real is a module with
 * edges a server-spawning case cannot drive cheaply: a cache has a boundary,
 * and a boundary is a clock; a token file can be absent, and proving that a
 * read did not quietly create one takes an assertion about the filesystem
 * rather than about a status code; a file can hold nothing but whitespace,
 * which must not match a credential that is also nothing. Every one of those
 * is driven here with a pinned `now` rather than a sleep, so the suite is
 * fast and says what it means.
 *
 * `server/test/security.test.ts` carries the other half — the same module
 * behind a real HTTP server, deleted and rotated under a running process.
 *
 * Offline and scratch by construction: `DERIVE_DATA_DIR` is pointed at a
 * temporary directory before the module is imported, the way
 * `server/test/guards.test.ts` does, so the learner's real `~/.derive` is
 * never read and never written.
 */
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, beforeEach, describe, it } from 'node:test';

// credentials.ts imports config.ts, which derives TOKEN_PATH from DERIVE_DATA_DIR at import time; point it somewhere scratch before the dynamic import, never after.
const dataDir = mkdtempSync(join(tmpdir(), 'derive-credentials-'));
process.env.DERIVE_DATA_DIR = dataDir;

const { TOKEN_CACHE_MS, credentials, matchesSession, matchesToken, resetCredentialCache, sessionValue } = await import('../src/credentials.js');
const { clearSecrets, secretCount } = await import('../src/secrets.js');

const tokenPath = join(dataDir, 'token');

/** Two tokens of the right shape, distinguishable at a glance in a failure message. */
const A = 'a1'.repeat(32);
const B = 'b2'.repeat(32);

/** A clock the cases own. Pinned rather than slept through: the window under test is one second, and a suite that waited it out four times would cost four seconds to say nothing extra. */
const T0 = 1_700_000_000_000;

const writeToken = (value: string) => writeFileSync(tokenPath, value, { mode: 0o600 });

beforeEach(() => {
  resetCredentialCache();
});

after(() => {
  rmSync(dataDir, { recursive: true, force: true });
});

describe('the cached live read of the install token', () => {
  it('serves the cached value for one window and reads the file again exactly at it', () => {
    writeToken(A);
    assert.equal(credentials(T0).token, A);

    writeToken(B);
    // One millisecond inside the window, then exactly at it. The inclusive boundary is the behaviour under test rather than an accident of the comparison: the window is a bound a learner-facing sentence promises in seconds, and this edge is the one a future refactor gets wrong.
    assert.equal(credentials(T0 + TOKEN_CACHE_MS - 1).token, A, 'the file was re-read inside the window');
    assert.equal(credentials(T0 + TOKEN_CACHE_MS).token, B, 'the file was not re-read at the window');
  });

  it('reads a token the file holds with the trailing newline an editor leaves', () => {
    writeToken(`${A}\n`);
    assert.equal(credentials(T0).token, A);
    assert.equal(matchesToken(A, T0), true);
  });

  it('refuses every credential when the token file is absent, and creates no replacement', () => {
    writeToken(A);
    assert.equal(matchesToken(A, T0), true, 'the token did not match before the file was removed');

    rmSync(tokenPath);
    resetCredentialCache();
    for (const supplied of [A, B, '', '   ']) {
      assert.equal(matchesToken(supplied, T0), false, `an absent token file matched ${JSON.stringify(supplied)} as a token`);
      assert.equal(matchesSession(supplied, T0), false, `an absent token file matched ${JSON.stringify(supplied)} as a session`);
    }
    // The no-create rule, and the reason a deletion stays a deletion: a read that made a token would answer the learner's revocation by re-opening the door under a value they were never shown.
    assert.equal(existsSync(tokenPath), false, 'a credential check created a token file');
  });

  it('refuses every credential when the token file is empty or holds only whitespace', () => {
    for (const held of ['', '   \n\t ']) {
      writeToken(held);
      resetCredentialCache();
      for (const supplied of [A, '', '   ']) {
        assert.equal(matchesToken(supplied, T0), false, `a token file holding ${JSON.stringify(held)} matched ${JSON.stringify(supplied)} as a token`);
        assert.equal(matchesSession(supplied, T0), false, `a token file holding ${JSON.stringify(held)} matched ${JSON.stringify(supplied)} as a session`);
      }
      assert.equal(sessionValue(T0), '', 'an unusable token still derived a session value');
    }
  });

  it('refuses an empty or whitespace-only supplied value even when the file holds a token', () => {
    writeToken(A);
    assert.equal(matchesToken(A, T0), true);
    assert.equal(matchesToken('', T0), false);
    assert.equal(matchesToken('   ', T0), false);

    const session = sessionValue(T0);
    assert.equal(matchesSession(session, T0), true);
    assert.equal(matchesSession('', T0), false);
    assert.equal(matchesSession('  \t ', T0), false);
  });

  it('derives the session from the live token, is never that token, and moves when it moves', () => {
    writeToken(A);
    const first = credentials(T0);
    assert.match(first.session, /^[0-9a-f]{64}$/);
    assert.notEqual(first.session, first.token);

    writeToken(B);
    resetCredentialCache();
    const second = credentials(T0);
    assert.notEqual(second.session, first.session, 'the session survived a change of token');
    assert.equal(matchesSession(first.session, T0), false, 'the pre-rotation session still matched');
    assert.equal(matchesSession(second.session, T0), true);
  });

  it('hands every newly-read token and its session to the redaction registry, and a cached read to neither', () => {
    // What this protects is D-11's claim that the registry holds the live values this process is actually holding. A rotated-in token that never reached registerSecret would be a live secret the redactor had quietly stopped covering — the revocation clause fixed and the redaction clause broken in the same change, which is the failure no status code would show.
    const c = 'c3'.repeat(32);
    const d = 'd4'.repeat(32);
    writeToken(c);
    clearSecrets();
    resetCredentialCache();
    assert.equal(secretCount(), 0);

    credentials(T0);
    assert.equal(secretCount(), 2, 'the token and its session did not both reach the registry');
    credentials(T0);
    assert.equal(secretCount(), 2, 'a cached read registered something');

    writeToken(d);
    assert.equal(credentials(T0 + TOKEN_CACHE_MS).token, d);
    assert.equal(secretCount(), 4, 'a rotated-in token and its session did not reach the registry');
  });
});
