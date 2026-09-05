import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

export const PORT = Number(process.env.PORT ?? 4310);
export const DATA_DIR = resolve(process.env.DERIVE_DATA_DIR ?? join(homedir(), '.derive'));
export const DB_PATH = join(DATA_DIR, 'derive.db');
/** Optional model override. Leave unset to use your Claude Code default. */
export const MODEL = process.env.DERIVE_MODEL || undefined;
export const EFFORT = (process.env.DERIVE_EFFORT as 'low' | 'medium' | 'high' | 'xhigh' | 'max' | undefined) || 'high';
/** Optional Obsidian vault folder to export lessons into. */
export const VAULT_DIR = process.env.DERIVE_VAULT_DIR ? resolve(process.env.DERIVE_VAULT_DIR) : undefined;
