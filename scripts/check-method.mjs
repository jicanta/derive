#!/usr/bin/env node
/**
 * `pnpm method:check`: renders the method into a throwaway directory and
 * compares every rendered target, byte for byte, with the copy committed to
 * git. It writes nothing into the repository and exits non-zero, naming each
 * file, when any of them has drifted.
 *
 * This is the gate CI runs. It fails rather than regenerating and pushing on
 * the author's behalf, because the whole point of committing the rendered
 * copies is that a change to what a model is told has to be seen in a diff
 * before it lands. The comparison is on raw bytes — UTF-8, LF endings, one
 * trailing newline — so a stray space or a CRLF is drift too.
 */
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderAll } from './render-method.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** A short unified-diff-style report of the first lines that differ, so the reader sees what moved. */
function report(path, expected, actual) {
  const want = expected.split('\n');
  const have = actual.split('\n');
  const lines = [`--- ${path} (committed)`, `+++ ${path} (rendered from method/)`];
  let shown = 0;
  for (let i = 0; i < Math.max(want.length, have.length) && shown < 6; i++) {
    if (want[i] === have[i]) continue;
    if (want[i] !== undefined) lines.push(`-${i + 1}: ${want[i]}`);
    if (have[i] !== undefined) lines.push(`+${i + 1}: ${have[i]}`);
    shown++;
  }
  return lines.join('\n');
}

let dir;
try {
  const rendered = renderAll();
  dir = mkdtempSync(join(tmpdir(), 'derive-method-'));
  const drifted = [];
  for (const { path, content } of rendered) {
    const scratch = join(dir, path);
    mkdirSync(dirname(scratch), { recursive: true });
    writeFileSync(scratch, content, 'utf8');
    const committed = existsSync(join(root, path)) ? readFileSync(join(root, path), 'utf8') : '';
    if (readFileSync(scratch, 'utf8') !== committed) drifted.push({ path, committed, content });
  }
  if (drifted.length) {
    for (const d of drifted) console.error(`${report(d.path, d.committed, d.content)}\n`);
    console.error(`${drifted.length} rendered ${drifted.length === 1 ? 'copy has' : 'copies have'} drifted from method/: ${drifted.map((d) => d.path).join(', ')}`);
    console.error('Run `pnpm method` and commit the result, so the change to what the tutor is told shows up in the diff.');
    process.exit(1);
  }
  console.log(`method: ${rendered.length} rendered copies match method/`);
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
} finally {
  if (dir) rmSync(dir, { recursive: true, force: true });
}
