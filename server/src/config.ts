import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

export const PORT = Number(process.env.PORT ?? 4310);
export const DATA_DIR = resolve(process.env.DERIVE_DATA_DIR ?? join(homedir(), '.derive'));
export const DB_PATH = join(DATA_DIR, 'derive.db');
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
