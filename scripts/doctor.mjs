#!/usr/bin/env node
/**
 * `pnpm check`: checks everything Derive needs before the first lesson, and
 * says what to do about each thing it finds missing. Read-only.
 */
import { execFileSync } from 'node:child_process';
import { accessSync, constants, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer } from 'node:net';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT ?? 4310);
const results = [];
const ok = (name, detail) => results.push({ level: 'ok', name, detail });
const warn = (name, detail, fix) => results.push({ level: 'warn', name, detail, fix });
const fail = (name, detail, fix) => results.push({ level: 'fail', name, detail, fix });
const run = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 15000 }).trim();

// Node 22.5+ ships node:sqlite, which the server uses instead of a native module.
const [major, minor] = process.versions.node.split('.').map(Number);
if (major > 22 || (major === 22 && minor >= 5)) {
  try {
    await import('node:sqlite');
    ok('Node', `v${process.versions.node}`);
  } catch {
    fail('Node', `v${process.versions.node} has no node:sqlite`, 'Install Node 22.5 or newer (https://nodejs.org).');
  }
} else fail('Node', `v${process.versions.node}`, 'Derive needs Node 22.5 or newer for the built-in SQLite. Install it from https://nodejs.org or with your version manager.');

try {
  ok('pnpm', `v${run('pnpm', ['--version'])}`);
} catch {
  fail('pnpm', 'not found', 'Run `corepack enable` (ships with Node) or `npm install -g pnpm`.');
}

// The tutor runs through the Claude Agent SDK on your Claude Code login: no API key.
let claudeOk = false;
try {
  const v = run('claude', ['--version']);
  ok('Claude Code', v);
  claudeOk = true;
} catch {
  fail('Claude Code', 'the `claude` command is not on your PATH', 'Install Claude Code: https://claude.com/claude-code (then open a terminal again).');
}
if (claudeOk) {
  try {
    const st = JSON.parse(run('claude', ['auth', 'status']));
    if (st.loggedIn) ok('Claude login', `logged in${st.authMethod ? ` via ${st.authMethod}` : ''}`);
    else fail('Claude login', 'not logged in', 'Run `claude` once and log in; lessons run on that subscription.');
  } catch {
    warn('Claude login', 'could not read `claude auth status`', 'Run `claude` once and make sure you are logged in.');
  }
}

if (!existsSync(join(root, 'node_modules'))) fail('Dependencies', 'node_modules is missing', 'Run `pnpm install` in the derive folder.');
else ok('Dependencies', 'installed');

const built = ['web/dist/index.html', 'server/dist/index.js', 'server/dist/mcp.js'].filter((p) => !existsSync(join(root, p)));
if (built.length) fail('Build', `missing ${built.join(', ')}`, 'Run `pnpm build` (needed for `pnpm start` and for the Claude Code plugin; `pnpm dev` does not need it).');
else ok('Build', 'web and server are built');

const dataDir = resolve(process.env.DERIVE_DATA_DIR ?? join(homedir(), '.derive'));
try {
  mkdirSync(dataDir, { recursive: true });
  accessSync(dataDir, constants.W_OK);
  ok('Data folder', dataDir);
} catch {
  fail('Data folder', `${dataDir} is not writable`, 'Set DERIVE_DATA_DIR in .env to a folder you can write to.');
}

// Every /api request but health carries this; anyone who can read the file can drive your lessons.
const tokenFile = join(dataDir, 'token');
if (!existsSync(tokenFile)) warn('Install token', `${tokenFile} does not exist yet`, 'Start Derive once (`pnpm start`) and it makes one.');
else if (process.platform === 'win32') ok('Install token', tokenFile);
else {
  const mode = (statSync(tokenFile).mode & 0o777).toString(8).padStart(3, '0');
  if (mode === '600') ok('Install token', `${tokenFile} (0600)`);
  else fail('Install token', `${tokenFile} is mode 0${mode}, not 0600`, `Run \`chmod 600 ${tokenFile}\`. Anyone who can read that file can drive your lessons and read anything Derive can read.`);
}

if (process.env.DERIVE_VAULT_DIR) {
  const v = resolve(process.env.DERIVE_VAULT_DIR);
  if (existsSync(v)) ok('Obsidian vault', v);
  else warn('Obsidian vault', `${v} does not exist`, 'Create the folder, or fix DERIVE_VAULT_DIR in .env. Lessons are mirrored there as notes.');
}

// Is Derive already up, or is its port at least free?
const health = await fetch(`http://localhost:${PORT}/api/health`, { signal: AbortSignal.timeout(1500) })
  .then((r) => (r.ok ? r.json() : null))
  .catch(() => null);
if (health?.ok) ok('Server', `running on http://localhost:${PORT} (v${health.version})`);
else {
  const free = await new Promise((res) => {
    const s = createServer();
    s.once('error', () => res(false));
    s.listen(PORT, () => s.close(() => res(true)));
  });
  if (free) ok('Server', `not running; port ${PORT} is free. Start it with \`pnpm start\`.`);
  else fail('Server', `port ${PORT} is taken by something that is not Derive`, 'Stop that program, or set PORT in .env to another port (the plugin then needs DERIVE_URL in plugin/.mcp.json to match).');
}

// Report.
const width = Math.max(...results.map((r) => r.name.length));
for (const r of results) {
  const mark = r.level === 'ok' ? '\x1b[32m✓\x1b[0m' : r.level === 'warn' ? '\x1b[33m!\x1b[0m' : '\x1b[31m✗\x1b[0m';
  console.log(`${mark} ${r.name.padEnd(width)}  ${r.detail}`);
  if (r.fix) console.log(`  ${' '.repeat(width)}  → ${r.fix}`);
}
const fails = results.filter((r) => r.level === 'fail').length;
console.log(fails ? `\n${fails} thing${fails === 1 ? '' : 's'} to fix before the first lesson.` : '\nAll good. Open http://localhost:' + PORT + ' and type what you want to understand.');
process.exitCode = fails ? 1 : 0;
