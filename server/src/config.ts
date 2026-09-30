import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

/** This build's version, read once from server/package.json so the health route, the MCP server info, the SDK client app string and the library user-agent cannot disagree. createRequire rather than an import attribute, which would change the build output. */
export const VERSION: string = (createRequire(import.meta.url)('../package.json') as { version: string }).version;

/** Refuse an unusable PORT here rather than at every request. 0 is refused with the rest: this server is addressed by the port in the Host header and guardLocal compares that against the configured value, so a port the process did not choose cannot be named by a client. */
function readPort(raw: string | undefined): number {
  if (raw === undefined) return 4310;
  const n = Number(raw.trim());
  if (!Number.isInteger(n) || n < 1 || n > 65535) throw new Error(`the PORT setting must be a whole number between 1 and 65535 (got ${raw})`);
  return n;
}
/** The port this server answers on. Validated at import time, because guardLocal compares the Host header's port against String(PORT): a value that is not a port makes that comparison false for every request, so the server would bind and then refuse everything 403 with no bind error to read. */
export const PORT = readPort(process.env.PORT);
export const DATA_DIR = resolve(process.env.DERIVE_DATA_DIR ?? join(homedir(), '.derive'));
export const DB_PATH = join(DATA_DIR, 'derive.db');
/** The per-install token every /api request but health must carry. Written on first boot and read live by the server on every credential check, so deleting or rotating it signs every browser and every header caller out; read once at its own start by the dev proxy, the MCP server and the plugin hook, which is why a rotation signs those out until each restarts. No endpoint ever hands it out. */
export const TOKEN_PATH = join(DATA_DIR, 'token');
/** One key per provider, keyed by catalogue id, in a 0600 file beside the token and never inside derive.db, which is 0644. Written atomically and read live by keys.ts. */
export const SECRETS_PATH = join(DATA_DIR, 'secrets.json');
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

/** The five variables a provider key may arrive in. */
export type EnvKeyName = 'ANTHROPIC_API_KEY' | 'OPENAI_API_KEY' | 'GEMINI_API_KEY' | 'GOOGLE_API_KEY' | 'OPENROUTER_API_KEY';
/**
 * The provider keys the environment carries, each read once. A set variable
 * outranks and locks the file value for its row: the row reads `set from
 * environment`, names the variable to unset, and the page cannot store a
 * competing key while it is set. The catalogue decides which variable a row
 * reads first (Google before Gemini on the Gemini row).
 */
export const ENV_KEYS: Readonly<Record<EnvKeyName, string | undefined>> = {
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || undefined,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || undefined,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || undefined,
  GOOGLE_API_KEY: process.env.GOOGLE_API_KEY || undefined,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || undefined,
};
/** Where Ollama listens when not on its default port, in the form Ollama's own CLI reads (a host, host:port or URL). Locks the Ollama row's address: the row is probed there and reads `set from environment`. */
export const OLLAMA_HOST = process.env.OLLAMA_HOST || undefined;
