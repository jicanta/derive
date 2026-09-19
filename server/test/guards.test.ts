/**
 * Where a fetch or a clone is actually going, and what an import is allowed
 * to read.
 *
 * The tutor model hands Derive a URL through `add_resource` and a repo URL
 * through `attach_material`, and the repo importer walks a folder the
 * learner names and puts every readable file where the model can read it.
 * What these cases exercise, one guard at a time: the host guard judges
 * resolved addresses rather than names and runs again on every redirect
 * hop; `collectRepo` refuses a scheme that is not https and then runs that
 * same host guard before it makes its scratch directory, so a refused clone
 * leaves none behind; the archive reader is capped with and without a
 * declared length; and a folder import refuses a home directory and skips
 * the files that hold credentials.
 *
 * Offline by construction: the guards are driven directly, no private
 * address is ever connected to, and the one case that needs a server uses a
 * fixture on this machine.
 */
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';

// library.ts and repo.ts reach db.ts, which opens the database on import; point it at a scratch directory first.
process.env.DERIVE_DATA_DIR = mkdtempSync(join(tmpdir(), 'derive-guards-'));

const { assertPublicHost, fetchPublic, isPrivateAddress, normalizeUrl } = await import('../src/library.js');
const { MAX_TARBALL_BYTES, collectRepo, fromDirectory, isSecretName, readCapped } = await import('../src/repo.js');

/** Any clone- scratch directory the importer left behind in the data dir; the temp dir is made immediately before the spawn. */
const cloneDirs = () => readdirSync(process.env.DERIVE_DATA_DIR!).filter((n) => n.startsWith('clone-'));

const refused = async (url: string) => {
  await assert.rejects(() => assertPublicHost(url), (e: Error) => /private or local address|could not look up|only http\(s\)|not a URL/.test(e.message));
};

describe('normalizeUrl', () => {
  it('refuses a scheme that is not http(s)', () => {
    assert.throws(() => normalizeUrl('file:///etc/passwd'), /only http\(s\)/);
    assert.throws(() => normalizeUrl('data:text/html,hi'), /only http\(s\)/);
    assert.throws(() => normalizeUrl('ftp://example.com/x'), /only http\(s\)/);
  });
});

describe('isPrivateAddress', () => {
  it('knows every range a fetch must not reach', () => {
    for (const ip of ['127.0.0.1', '127.1.2.3', '0.0.0.0', '169.254.169.254', '10.0.0.1', '192.168.1.1', '172.16.0.1', '172.31.255.255', '100.64.0.1', '::1', 'fd00::1', 'fc00::abcd', 'fe80::1', '::', '::ffff:127.0.0.1', '::ffff:10.0.0.1']) {
      assert.equal(isPrivateAddress(ip), true, `${ip} should be refused`);
    }
  });

  it('lets an ordinary public address through', () => {
    for (const ip of ['93.184.216.34', '8.8.8.8', '1.1.1.1', '172.32.0.1', '100.128.0.1', '2606:2800:220:1:248:1893:25c8:1946']) {
      assert.equal(isPrivateAddress(ip), false, `${ip} should be allowed`);
    }
  });

  it('refuses anything that is not an address at all', () => {
    assert.equal(isPrivateAddress('not-an-address'), true);
    assert.equal(isPrivateAddress(''), true);
  });
});

describe('assertPublicHost', () => {
  it('refuses a literal on this machine or this network', async () => {
    for (const host of ['127.0.0.1', '169.254.169.254', '10.0.0.1', '192.168.1.1', '172.16.0.1', '100.64.0.1', '[::1]', '[fd00::1]']) {
      await refused(`http://${host}/x`);
    }
  });

  it('refuses a hostname that resolves to loopback', async () => {
    await refused('http://localhost:4310/api/lessons');
  });

  it('refuses a scheme that is not http(s)', async () => {
    await assert.rejects(() => assertPublicHost('file:///etc/passwd'), /only http\(s\)/);
  });

  it('accepts an ordinary public literal', async () => {
    await assertPublicHost('https://93.184.216.34/');
    await assertPublicHost('https://8.8.8.8/');
  });
});

describe('the redirect loop', () => {
  let fixture: Server;
  let base = '';

  before(async () => {
    fixture = createServer((req, res) => {
      if (req.url === '/away') {
        res.writeHead(302, { location: `${base}/target` });
        res.end();
        return;
      }
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('should never be read');
    });
    await new Promise<void>((done) => fixture.listen(0, '127.0.0.1', done));
    const addr = fixture.address();
    base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
  });

  after(() => fixture.close());

  it('checks the second hop, not only the first', async () => {
    // The fixture is on this machine, so hop one is waved through by hand; every later hop gets the real guard.
    let first = true;
    const guard = async (u: string) => {
      if (first) {
        first = false;
        return;
      }
      await assertPublicHost(u);
    };
    await assert.rejects(() => fetchPublic(`${base}/away`, 'text/plain', 1024, guard), /private or local address/);
  });

  it('reads the body when no hop goes anywhere private', async () => {
    const { buf } = await fetchPublic(`${base}/target`, 'text/plain', 1024, async () => undefined);
    assert.equal(buf.toString('utf8'), 'should never be read');
  });
});

describe('cloning', () => {
  it('refuses anything that is not https, before git is spawned', async () => {
    await assert.rejects(() => collectRepo('ssh://git@github.com/jicanta/derive.git'), /only clones over https/);
    await assert.rejects(() => collectRepo('git@github.com:jicanta/derive.git'), /only clones over https/);
    await assert.rejects(() => collectRepo('git://github.com/jicanta/derive.git'), /only clones over https/);
    // No scratch clone directory means the guard threw before mkdtempSync, and therefore before git.
    assert.deepEqual(cloneDirs(), []);
  });

  it('refuses a git URL pointing at this machine or this network, before a directory is made', async () => {
    // The entry point the model reaches: attach_material hands collectRepo a URL, and every non-GitHub one is cloned.
    for (const url of ['https://127.0.0.1/x.git', 'https://192.168.0.5/internal.git', 'https://169.254.169.254/x.git', 'https://[::1]/x.git']) {
      await assert.rejects(() => collectRepo(url), /private or local address/, `${url} should be refused`);
      assert.deepEqual(cloneDirs(), [], `${url} left a scratch directory behind`);
    }
    // Once more at the end, so a directory left by any one of them fails here rather than being masked by the next.
    assert.deepEqual(cloneDirs(), []);
  });

  it('refuses a name that resolves to this machine, not only a literal', async () => {
    // The difference between this guard and a string blocklist: the host is resolved first, and every address it answers with is judged.
    await assert.rejects(() => collectRepo('https://localhost/x.git'), /private or local address/);
    assert.deepEqual(cloneDirs(), []);
  });
});

describe('the repository archive', () => {
  it('refuses a declared length over the cap before a byte is buffered', async () => {
    const res = new Response('x', { headers: { 'content-length': String(MAX_TARBALL_BYTES + 1) } });
    await assert.rejects(() => readCapped(res, MAX_TARBALL_BYTES), /larger than 60 MB/);
  });

  it('bounds the read when nothing is declared', async () => {
    // A server that declares no length can otherwise stream until the process runs out of memory.
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array(1024 * 1024));
      },
    });
    await assert.rejects(() => readCapped(new Response(body), MAX_TARBALL_BYTES), /larger than 60 MB/);
  });

  it('reads a small body whole', async () => {
    assert.equal((await readCapped(new Response('hello'), 1024)).byteLength, 5);
  });

  it('carries a timeout', () => {
    // Read off the source: a hung GitHub is not something this suite can stand up offline, but the absence of the signal is exactly the regression to catch.
    assert.match(readFileSync(new URL('../src/repo.ts', import.meta.url), 'utf8'), /signal: AbortSignal\.timeout\(TARBALL_TIMEOUT_MS\)/);
  });
});

describe('importing a folder', () => {
  it('refuses the whole disk and the whole home folder', () => {
    assert.throws(() => fromDirectory('/'), /home folder or the whole disk/);
    assert.throws(() => fromDirectory('~'), /home folder or the whole disk/);
  });

  it('knows a secret-shaped name', () => {
    for (const n of ['credentials', 'id_rsa', 'id_ed25519.pub', '.netrc', '.npmrc', 'auth.json', '.env', '.env.local', '.env.example', 'server.pem', 'private.key', 'deep/path/credentials']) {
      assert.equal(isSecretName(n), true, `${n} should be refused`);
    }
    for (const n of ['README.md', 'index.ts', 'environment.ts', 'package.json', 'identity.ts']) {
      assert.equal(isSecretName(n), false, `${n} should be allowed`);
    }
  });

  it('imports the ordinary file and nothing else', () => {
    const dir = mkdtempSync(join(tmpdir(), 'derive-repo-'));
    mkdirSync(join(dir, 'config'));
    for (const [name, body] of [['credentials', 'aws_secret_access_key = hunter2'], ['id_rsa', '-----BEGIN OPENSSH PRIVATE KEY-----'], ['.env', 'API_KEY=sk-real'], ['.env.example', 'API_KEY='], ['README.md', '# a project\n\nwith some words in it.'], ['config/auth.json', '{"token":"x"}']] as const) {
      writeFileSync(join(dir, name), body);
    }
    const src = fromDirectory(dir);
    assert.deepEqual(
      src.files.map((f) => f.path),
      ['README.md'],
    );
  });
});
