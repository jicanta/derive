#!/usr/bin/env node
/**
 * mirror — Claude Code hook that mirrors a /learn session into Derive.
 *
 * Port of the pi/learn `md-log` idea: the terminal is where you type, the
 * rendered view is where you read. Here the rendered view is the Derive
 * companion page, so the lesson prose, the quizzes (which already arrive
 * through the MCP tools) and the graph become one record, exportable to
 * Obsidian.
 *
 * Runs on Stop, UserPromptSubmit and PostToolUse(mcp__derive__*). Reads the
 * session transcript, finds text not yet mirrored (tracked per session in
 * ~/.derive/mirror/<session>.json) and posts it to the active external
 * lesson. Silent when no Derive lesson is active or the server is down.
 */
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const BASE = (process.env.DERIVE_URL ?? 'http://localhost:4310').replace(/\/$/, '');
const STATE_DIR = join(process.env.DERIVE_DATA_DIR ?? join(homedir(), '.derive'), 'mirror');

async function main() {
  let payload = {};
  try {
    payload = JSON.parse(readFileSync(0, 'utf8') || '{}');
  } catch {
    return;
  }
  const sessionId = payload.session_id;
  const transcript = payload.transcript_path;
  if (!sessionId || !transcript || !existsSync(transcript)) return;

  const active = await fetch(`${BASE}/api/external/active`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!active) return;

  mkdirSync(STATE_DIR, { recursive: true });
  const stateFile = join(STATE_DIR, `${sessionId}.json`);
  let state = { lesson: active.id, seen: [] };
  try {
    state = JSON.parse(readFileSync(stateFile, 'utf8'));
  } catch {
    /* fresh */
  }
  // First time this session sees this lesson: mark everything already in the
  // transcript as seen, so earlier session history is not mirrored in. The
  // /learn prompt itself is included by the UserPromptSubmit hook that
  // fires before start_lesson runs, which is what we want.
  const firstSight = state.lesson !== active.id;
  if (firstSight) state = { lesson: active.id, seen: [] };
  const seen = new Set(state.seen);

  const lines = readFileSync(transcript, 'utf8').split('\n');
  const out = [];
  for (const raw of lines) {
    if (!raw.trim()) continue;
    let e;
    try {
      e = JSON.parse(raw);
    } catch {
      continue;
    }
    if (e.isSidechain || e.isMeta) continue;
    const uuid = e.uuid;
    if (!uuid || seen.has(uuid)) continue;
    if (firstSight && (e.timestamp ? Date.parse(e.timestamp) : 0) < (active.created_at ?? 0) - 120_000) {
      seen.add(uuid);
      continue;
    }
    const msg = e.message ?? {};
    const content = msg.content;
    if (e.type === 'user') {
      let text = '';
      if (typeof content === 'string') text = content;
      else if (Array.isArray(content)) text = content.filter((b) => b && b.type === 'text').map((b) => b.text ?? '').join('\n');
      text = cleanUser(text);
      seen.add(uuid);
      if (text) out.push({ role: 'user', text, uid: uuid, at: e.timestamp ? Date.parse(e.timestamp) : undefined });
    } else if (e.type === 'assistant' && Array.isArray(content)) {
      const text = content
        .filter((b) => b && b.type === 'text')
        .map((b) => (b.text ?? '').trim())
        .filter(Boolean)
        .join('\n\n');
      seen.add(uuid);
      if (text) out.push({ role: 'assistant', text, uid: uuid, at: e.timestamp ? Date.parse(e.timestamp) : undefined });
    }
  }

  for (const item of out) {
    await fetch(`${BASE}/api/external/lessons/${active.id}/mirror`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(item),
    }).catch(() => undefined);
  }

  writeFileSync(stateFile, JSON.stringify({ lesson: active.id, seen: [...seen].slice(-5000) }));

  if (payload.hook_event_name === 'Stop') {
    await fetch(`${BASE}/api/external/lessons/${active.id}/end`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).catch(() => undefined);
  }
}

function cleanUser(text) {
  if (!text) return '';
  // Drop system-injected wrappers and slash-command expansions.
  text = text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '');
  text = text.replace(/<command-name>[\s\S]*?<\/command-name>/g, '');
  text = text.replace(/<command-message>[\s\S]*?<\/command-message>/g, '');
  text = text.replace(/<command-args>([\s\S]*?)<\/command-args>/g, '$1');
  text = text.replace(/<local-command-stdout>[\s\S]*?<\/local-command-stdout>/g, '');
  if (/^\s*<task-notification>/.test(text)) return '';
  return text.trim();
}

main().catch(() => undefined);
