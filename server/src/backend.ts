/**
 * Which tutor backend to run, and where its pieces are.
 *
 * Derive runs on a subscription, not an API key: the Claude Agent SDK on a
 * Claude Code login, or the Codex SDK on a ChatGPT login. DERIVE_BACKEND
 * picks one; without it the server takes whichever is logged in, Claude
 * first, and says so at startup.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BACKEND_SETTING, CODEX_BIN, CODEX_HOME, type Backend } from './config.js';

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

let resolved: Backend | undefined;
/** The backend this server runs lessons on. Decided once, at the first call. */
export function backend(): Backend {
  if (resolved) return resolved;
  if (BACKEND_SETTING) resolved = BACKEND_SETTING;
  else if (claudeLoggedIn()) resolved = 'claude';
  else if (codexLoggedIn()) resolved = 'codex';
  else resolved = 'claude';
  return resolved;
}

/** How the backend was chosen, for the startup line and /api/health. */
export function backendSource(): 'DERIVE_BACKEND' | 'auto' {
  return BACKEND_SETTING ? 'DERIVE_BACKEND' : 'auto';
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
