/**
 * Mirror a Codex terminal session into a Derive lesson.
 *
 * Codex writes every session to a JSONL log under $CODEX_HOME/sessions as it
 * happens: the user's messages, the model's messages, tool calls and their
 * results. Derive's MCP server, which Codex starts for the session, tails
 * that log and posts the prose to the lesson, so the browser shows the
 * lesson as one record (the Claude Code plugin does the same through hooks).
 *
 * The log for this session is the recent one that contains the lesson id
 * (it is in the result of `start_lesson`, which Codex records verbatim).
 */
import { closeSync, existsSync, openSync, readdirSync, readFileSync, readSync, statSync } from 'node:fs';
import { join } from 'node:path';

export type MirrorItem = { role: 'assistant' | 'user'; text: string; uid?: string; at?: number };

type Hooks = { post: (item: MirrorItem) => Promise<void>; turnEnd: () => Promise<void> };

const RECENT_MS = 30 * 60_000;

export class RolloutMirror {
  private file: string | null = null;
  private offset = 0;
  private buf = '';
  private timer: NodeJS.Timeout | null = null;
  private queue: Promise<void> = Promise.resolve();
  private readonly startedAt = Date.now();
  private readonly seen = new Set<string>();

  constructor(
    private readonly home: string,
    private readonly lessonId: string,
    private readonly hooks: Hooks,
  ) {}

  start() {
    this.timer = setInterval(() => void this.tick(), 300);
    this.timer.unref();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Read whatever the log gained and post it, before a tool result is returned (the server's teach-first gate reads the mirrored prose). */
  async flush() {
    await this.tick();
    await this.queue;
  }

  private async tick() {
    if (!this.file) {
      this.file = this.locate();
      if (!this.file) return;
    }
    let size: number;
    try {
      size = statSync(this.file).size;
    } catch {
      return;
    }
    if (size <= this.offset) return;
    const fd = openSync(this.file, 'r');
    try {
      const chunk = Buffer.alloc(size - this.offset);
      readSync(fd, chunk, 0, chunk.length, this.offset);
      this.buf += chunk.toString('utf8');
    } finally {
      closeSync(fd);
    }
    this.offset = size;
    const lines = this.buf.split('\n');
    this.buf = lines.pop() ?? '';
    for (const line of lines) this.handle(line);
  }

  /** The session log to tail, and where in it the lesson begins. */
  private locate(): string | null {
    const candidates: { file: string; mtime: number }[] = [];
    const root = join(this.home, 'sessions');
    if (!existsSync(root)) return null;
    const cutoff = Date.now() - RECENT_MS;
    // sessions/YYYY/MM/DD/rollout-*.jsonl; only the last two days can hold this session.
    for (const y of safeDir(root).slice(-2)) {
      for (const m of safeDir(join(root, y)).slice(-2)) {
        for (const d of safeDir(join(root, y, m)).slice(-2)) {
          const dir = join(root, y, m, d);
          for (const f of safeDir(dir)) {
            if (!f.startsWith('rollout-') || !f.endsWith('.jsonl')) continue;
            const file = join(dir, f);
            const mtime = statSync(file, { throwIfNoEntry: false })?.mtimeMs ?? 0;
            if (mtime >= cutoff) candidates.push({ file, mtime });
          }
        }
      }
    }
    candidates.sort((a, b) => b.mtime - a.mtime);
    for (const c of candidates) {
      const text = readFileSync(c.file, 'utf8');
      const hit = text.indexOf(this.lessonId);
      if (hit < 0) continue;
      // Begin at the learner's last message before the lesson id appeared: that is the request that started the lesson.
      const head = text.slice(0, hit);
      const lastUser = head.lastIndexOf('"role":"user"');
      const lineStart = lastUser < 0 ? 0 : head.lastIndexOf('\n', lastUser) + 1;
      this.offset = Buffer.byteLength(text.slice(0, lineStart), 'utf8');
      return c.file;
    }
    // After a while with no match, take the newest log started since this server did.
    if (Date.now() - this.startedAt > 20_000) {
      const newest = candidates.find((c) => c.mtime >= this.startedAt - 5_000);
      if (newest) {
        this.offset = 0;
        return newest.file;
      }
    }
    return null;
  }

  private handle(line: string) {
    if (!line.trim()) return;
    let e: { timestamp?: string; type?: string; payload?: Record<string, unknown> };
    try {
      e = JSON.parse(line);
    } catch {
      return;
    }
    const p = e.payload ?? {};
    const at = e.timestamp ? Date.parse(e.timestamp) : undefined;
    if (e.type === 'response_item' && p.type === 'message') {
      const id = typeof p.id === 'string' ? p.id : undefined;
      if (id && this.seen.has(id)) return;
      if (id) this.seen.add(id);
      const content = Array.isArray(p.content) ? (p.content as { type?: string; text?: string }[]) : [];
      if (p.role === 'assistant') {
        const text = content
          .filter((c) => c.type === 'output_text' && c.text)
          .map((c) => c.text!.trim())
          .filter(Boolean)
          .join('\n\n');
        if (text) this.enqueue({ role: 'assistant', text, uid: id, at });
      } else if (p.role === 'user') {
        const text = cleanUser(content.filter((c) => c.type === 'input_text' && c.text).map((c) => c.text!).join('\n'));
        if (text) this.enqueue({ role: 'user', text, uid: id, at });
      }
    } else if (e.type === 'event_msg' && p.type === 'task_complete') {
      this.queue = this.queue.then(() => this.hooks.turnEnd()).catch(() => undefined);
    }
  }

  private enqueue(item: MirrorItem) {
    this.queue = this.queue.then(() => this.hooks.post(item)).catch(() => undefined);
  }
}

const safeDir = (p: string): string[] => {
  try {
    return readdirSync(p).sort();
  } catch {
    return [];
  }
};

/** The learner's own words: without the context Codex and its IDE extension inject around them. */
function cleanUser(text: string): string {
  if (!text) return '';
  const ide = text.indexOf('## My request for Codex:');
  if (ide >= 0) text = text.slice(ide + '## My request for Codex:'.length);
  text = text.replace(/<([a-z_]+)>[\s\S]*?<\/\1>/g, '').trim();
  if (!text || text.startsWith('<')) return '';
  return text;
}
