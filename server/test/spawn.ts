/**
 * One way to start a Derive server in a test, because three ways raced.
 *
 * `01-REVIEW.md` IN-05: `api.test.ts`, `security.test.ts` (twice) and
 * `mcp.test.ts` each picked a port by arithmetic on a random number and then
 * waited twenty seconds for a health route that was never going to answer.
 * Node's runner executes test files concurrently, so two files drawing from
 * the same small range is not unlikely, it is expected — and a clash read as
 * `server did not start`, a product failure by appearance and a port
 * collision in fact. The suite is FOUND-04's machine half; a gate that fails
 * one run in N is a gate nobody trusts.
 *
 * So the port comes from the operating system, and a child that dies is
 * retried at once on a fresh one. The retry is bounded at `SPAWN_ATTEMPTS`
 * and the final throw carries the last line the child wrote to stderr: a
 * server that genuinely cannot start must still fail the suite, or this
 * helper would have traded a flaky gate for a blind one.
 *
 * Not named `*.test.ts` on purpose — the runner's glob in `server/package.json`
 * is `test/*.test.ts`, so this file is imported by suites and never run as one.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer, type AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** How many times a spawn is retried on a fresh port before the failure is reported as real. */
export const SPAWN_ATTEMPTS = 5;

/** A port the operating system has just confirmed free. Not the same as picking a number: the OS will not hand the same ephemeral port to two listeners that are up at once, and the window between this close() and the child's own listen is microseconds rather than the whole test run. */
export function freePort(): Promise<number> {
  return new Promise((res, rej) => {
    const probe = createServer();
    probe.on('error', rej);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as AddressInfo;
      probe.close(() => res(port));
    });
  });
}

/** What a spawned server gives a suite: the child to kill, the port a raw socket case dials, the base URL, and the scratch data dir holding its token file. */
export type SpawnedServer = { child: ChildProcess; port: number; base: string; dataDir: string };

/**
 * Start `server/dist/index.js` (or any entry a caller names) on a free port,
 * in a scratch data directory, and resolve once `/api/health` answers.
 *
 * `env` is merged over the defaults, so a case can widen the bind or change
 * the backend without restating the rest. Pass `opts.dataDir` to reuse a
 * directory the caller owns; anything this function creates, it also removes
 * before retrying.
 */
export async function startDeriveServer(
  entry: string,
  env: Record<string, string> = {},
  opts: { dataDir?: string; deadlineMs?: number; attempts?: number } = {},
): Promise<SpawnedServer> {
  const attempts = opts.attempts ?? SPAWN_ATTEMPTS;
  const deadlineMs = opts.deadlineMs ?? 10_000;
  let stderr = '';

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const owned = opts.dataDir === undefined;
    const dataDir = opts.dataDir ?? mkdtempSync(join(tmpdir(), 'derive-server-'));
    // The port is allocated here and handed to the child rather than letting it bind an ephemeral one: guardLocal (server/src/index.ts:206) compares the Host header's port against String(PORT), the configured value, so a port the child chose for itself would 403 every request.
    const port = await freePort();
    const base = `http://127.0.0.1:${port}`;
    const child = spawn(process.execPath, [entry], {
      env: { ...process.env, PORT: String(port), DERIVE_DATA_DIR: dataDir, DERIVE_BACKEND: 'claude', ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    stderr = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    let exited = false;
    child.once('exit', () => {
      exited = true;
    });

    const deadline = Date.now() + deadlineMs;
    // A child that has already exited will never answer, so the poll stops on the exit flag instead of spending the whole deadline on a corpse — the second half of IN-05's twenty seconds.
    while (!exited && Date.now() < deadline) {
      try {
        const r = await fetch(`${base}/api/health`);
        if (r.ok) return { child, port, base, dataDir };
      } catch {
        /* not up yet */
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    child.kill();
    if (owned) rmSync(dataDir, { recursive: true, force: true });
  }

  throw new Error(`the derive server did not start in ${attempts} attempts: ${reason(stderr)}`);
}

/** The line of the child's stderr worth reporting. Node ends a crash with its own version banner, so the last line is usually `Node.js v22.x` and says nothing; the first line naming an error is the one that does. Falls back to the last real line, and says so when there was none. */
function reason(stderr: string): string {
  const lines = stderr
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !/^Node\.js v/.test(l));
  return lines.find((l) => /error/i.test(l)) ?? lines.at(-1) ?? 'it wrote nothing to stderr';
}
