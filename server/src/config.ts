import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

/** This build's version, read once from server/package.json so the health route, the MCP server info, the SDK client app string and the library user-agent cannot disagree. createRequire rather than an import attribute, which would change the build output. */
export const VERSION: string = (createRequire(import.meta.url)('../package.json') as { version: string }).version;

export const PORT = Number(process.env.PORT ?? 4310);
export const DATA_DIR = resolve(process.env.DERIVE_DATA_DIR ?? join(homedir(), '.derive'));
export const DB_PATH = join(DATA_DIR, 'derive.db');
/** The per-install token every /api request but health must carry. Written on first boot, read by the app, the dev proxy, the MCP server and the plugin hook; no endpoint ever hands it out. */
export const TOKEN_PATH = join(DATA_DIR, 'token');
/** Which interface the server answers on. Loopback by default; DERIVE_HOST=0.0.0.0 opens it to the network, and the token stays mandatory there. */
export const HOST = process.env.DERIVE_HOST?.trim() || '127.0.0.1';
/** True when HOST is a loopback address, which is the default and the only quiet case. */
export const HOST_IS_LOOPBACK = ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(HOST.toLowerCase());
/** Extra browser origins allowed to call the API, comma-separated. Only needed when the bind is widened. */
export const DERIVE_ORIGINS = (process.env.DERIVE_ORIGINS ?? '')
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean);
/** Every origin a browser may call the API from: this server on either loopback spelling, the Vite dev server, and whatever DERIVE_ORIGINS adds. Matched whole, never by prefix. */
export const ALLOWED_ORIGINS = [...new Set([`http://127.0.0.1:${PORT}`, `http://localhost:${PORT}`, 'http://127.0.0.1:5173', 'http://localhost:5173', ...DERIVE_ORIGINS])];
/** Optional model override. Leave unset to use the backend's own default (your Claude Code or Codex default model). */
export const MODEL = process.env.DERIVE_MODEL || undefined;
export const EFFORT = (process.env.DERIVE_EFFORT as 'low' | 'medium' | 'high' | 'xhigh' | 'max' | undefined) || 'high';
/** Optional Obsidian vault folder to export lessons into. */
export const VAULT_DIR = process.env.DERIVE_VAULT_DIR ? resolve(process.env.DERIVE_VAULT_DIR) : undefined;

/**
 * Which subscription the app's tutor runs on: "claude" (the Claude Agent SDK
 * on your Claude Code login) or "codex" (the Codex SDK on your ChatGPT
 * login). Unset: whichever one is logged in, Claude first.
 */
export type Backend = 'claude' | 'codex';
export const BACKEND_SETTING: Backend | undefined = process.env.DERIVE_BACKEND === 'codex' ? 'codex' : process.env.DERIVE_BACKEND === 'claude' ? 'claude' : undefined;
/** A codex binary to use instead of the one bundled with the SDK. */
export const CODEX_BIN = process.env.DERIVE_CODEX_BIN || undefined;
/** Where Codex keeps its login, config and session logs. */
export const CODEX_HOME = resolve(process.env.CODEX_HOME ?? join(homedir(), '.codex'));
