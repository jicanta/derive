/**
 * The login detectors, and where the pieces of the two subscription backends
 * are.
 *
 * Derive's two login backends are the Claude Agent SDK on a Claude Code login
 * and the Codex SDK on a ChatGPT login. This file only says whether each login
 * is present, and where the codex binary and Derive's own MCP server live.
 * Which backend a turn actually runs on is decided per turn in
 * `server/src/settings.ts` — the environment, then the settings table, then
 * these detectors — so the process-lifetime memo that used to live here is
 * gone, and a choice made on the settings page needs no restart.
 *
 * `claudeLoggedIn` returns only a boolean on purpose. The CLI's JSON carries
 * the learner's email and organisation, and a settings response is read by
 * the browser and echoed into plugin transcripts; nothing but the boolean
 * leaves this module.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CODEX_BIN, CODEX_HOME } from './config.js';

const here = dirname(fileURLToPath(import.meta.url));

/** True when `claude auth status` says a Claude Code login is present. */
export function claudeLoggedIn(): boolean {
  try {
    const out = execFileSync('claude', ['auth', 'status'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 15000 });
    return !!(JSON.parse(out) as { loggedIn?: boolean }).loggedIn;
  } catch {
    return false;
  }
}

/** True when Codex has stored a login (ChatGPT or API key) in its home folder. */
export function codexLoggedIn(): boolean {
  return existsSync(join(CODEX_HOME, 'auth.json'));
}

/**
 * The codex binary: DERIVE_CODEX_BIN, else the one the SDK bundles (pinned
 * to the SDK version, present after `pnpm install`), else `codex` on PATH.
 */
export function codexBinary(): string | undefined {
  if (CODEX_BIN) return CODEX_BIN;
  try {
    // pnpm keeps @openai/codex under the SDK's own node_modules, so resolve it from there. The SDK's
    // exports map only exposes its ESM entry point, so resolve that and step up to the package root.
    const sdkPkg = join(dirname(fileURLToPath(import.meta.resolve('@openai/codex-sdk'))), '..', 'package.json');
    const codexPkg = createRequire(sdkPkg).resolve('@openai/codex/package.json');
    const target = ({ linux: 'linux', darwin: 'darwin', win32: 'win32' } as Record<string, string>)[process.platform];
    const arch = ({ x64: 'x64', arm64: 'arm64' } as Record<string, string>)[process.arch];
    if (target && arch) {
      const cpu = process.arch === 'x64' ? 'x86_64' : 'aarch64';
      const triple = { linux: `${cpu}-unknown-linux-musl`, darwin: `${cpu}-apple-darwin`, win32: `${cpu}-pc-windows-msvc` }[target as 'linux' | 'darwin' | 'win32'];
      const platformPkg = createRequire(codexPkg).resolve(`@openai/codex-${target}-${arch}/package.json`);
      const bin = join(dirname(platformPkg), 'vendor', triple, 'bin', process.platform === 'win32' ? 'codex.exe' : 'codex');
      if (existsSync(bin)) return bin;
    }
  } catch {
    /* not installed */
  }
  return undefined;
}

/**
 * The command that runs Derive's MCP server (server/dist/mcp.js), which the
 * Codex backend attaches to every lesson. Under `pnpm dev` there is no dist,
 * so the TypeScript source runs through tsx instead.
 */
export function mcpCommand(): { command: string; args: string[] } {
  const built = resolve(here, 'mcp.js');
  if (existsSync(built)) return { command: process.execPath, args: [built] };
  const dist = resolve(here, '../dist/mcp.js');
  if (existsSync(dist)) return { command: process.execPath, args: [dist] };
  const tsx = resolve(here, '../node_modules/.bin/tsx');
  return { command: tsx, args: [resolve(here, 'mcp.ts')] };
}
