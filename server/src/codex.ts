/**
 * The Codex backend: one lesson turn through the Codex SDK, on the
 * learner's ChatGPT login.
 *
 * Each turn is a `codex exec` run (resumed on the lesson's thread after the
 * first). The tutor's tools reach it as an MCP server: Derive's own
 * server/dist/mcp.js, pointed at this process with the lesson id, so quiz,
 * ask, set_plan and the rest go through the same actions the Claude backend
 * calls in-process. The system prompt is written to a file and installed as
 * the model's instructions, replacing Codex's coding persona.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Codex, type ThreadEvent, type ThreadItem } from '@openai/codex-sdk';
import { codexBinary, mcpCommand } from './backend.js';
import { DATA_DIR, EFFORT, MODEL, PORT } from './config.js';
import { getLesson, setSessionId } from './db.js';
import { type Active } from './driver.js';
import { emit, emitEphemeral } from './events.js';
import { DERIVE_TOOL_NAMES, TOOL_LABELS } from './tools.js';

/** The turn handle now belongs to the driver seam; re-exported here so no existing import breaks. */
export type { Active };

/** A TOML inline value for a `--config` override. */
function toml(v: unknown): string {
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return `[${v.map(toml).join(', ')}]`;
  if (v && typeof v === 'object') return `{${Object.entries(v).map(([k, x]) => `${k}=${toml(x)}`).join(', ')}}`;
  throw new Error(`cannot serialise ${typeof v} to TOML`);
}

export async function runCodexTurn(lessonId: string, prompt: string, systemPrompt: string, active: Map<string, Active>, stopping: Set<string>) {
  const lesson = getLesson(lessonId)!;
  // A folder per lesson: the model's instructions live here and it is the working directory, so Codex finds no AGENTS.md or repo to read.
  const dir = join(DATA_DIR, 'codex', lessonId);
  mkdirSync(dir, { recursive: true });
  const instructions = join(dir, 'instructions.md');
  writeFileSync(instructions, systemPrompt);

  const mcp = mcpCommand();
  const server = {
    command: mcp.command,
    args: mcp.args,
    env: { DERIVE_URL: `http://127.0.0.1:${PORT}`, DERIVE_LESSON_ID: lessonId, DERIVE_DRIVER: 'app' },
    startup_timeout_sec: 60,
    // Cards block until the learner answers; the default per-tool timeout is one minute.
    tool_timeout_sec: 86400,
    default_tools_approval_mode: 'approve',
    enabled_tools: [...DERIVE_TOOL_NAMES],
  };
  const codex = new Codex({
    codexPathOverride: codexBinary(),
    config: {
      model_instructions_file: instructions,
      // A lesson has no use for the learner's other MCP servers, plugins, hooks or sub-agents.
      features: { plugins: false, hooks: false, multi_agent: false },
    },
    // A whole-table override replaces the MCP servers of ~/.codex/config.toml instead of merging into them.
    configOverrides: [`mcp_servers=${toml({ derive: server })}`],
  });
  const opts = {
    model: MODEL,
    modelReasoningEffort: EFFORT,
    sandboxMode: 'read-only' as const,
    approvalPolicy: 'never' as const,
    workingDirectory: dir,
    skipGitRepoCheck: true,
    webSearchMode: 'live' as const,
  };
  const thread = lesson.session_id ? codex.resumeThread(lesson.session_id, opts) : codex.startThread(opts);

  const ac = new AbortController();
  active.set(lessonId, { interrupt: async () => ac.abort() });
  const started = Date.now();
  let verified = 0;
  let ended = false;
  const endTurn = (payload: Record<string, unknown>) => {
    if (ended) return;
    ended = true;
    emit(lessonId, 'turn_end', payload);
  };
  const status = (item: ThreadItem) => {
    switch (item.type) {
      case 'mcp_tool_call':
        return TOOL_LABELS[item.tool] ?? `Using ${item.tool}`;
      case 'web_search':
        return 'Verifying with a web search';
      case 'command_execution':
        return 'Running a command';
      case 'reasoning':
        return 'Thinking';
      default:
        return null;
    }
  };

  try {
    const { events } = await thread.runStreamed(prompt, { signal: ac.signal });
    for await (const ev of events as AsyncGenerator<ThreadEvent>) {
      switch (ev.type) {
        case 'thread.started':
          if (ev.thread_id !== lesson.session_id) setSessionId(lessonId, ev.thread_id);
          break;
        case 'item.started': {
          const s = status(ev.item);
          if (s) emitEphemeral(lessonId, 'status', { text: s });
          if (ev.item.type === 'web_search') verified += 1;
          break;
        }
        case 'item.completed': {
          const item = ev.item;
          if (item.type === 'agent_message') {
            // Codex delivers a message whole, so the learner sees each paragraph block as it lands rather than a stream of tokens.
            if (item.text.trim()) emit(lessonId, 'assistant', { id: item.id, text: item.text });
          } else if (item.type === 'error') {
            // Warnings ride along as error items (a missing model in the cache, a hook notice); they are not turn failures.
            console.warn(`[codex] ${item.message}`);
          }
          break;
        }
        case 'turn.completed':
          endTurn({ ok: true, cost_usd: null, duration_ms: Date.now() - started, verified, tokens: ev.usage });
          break;
        case 'turn.failed':
          endTurn({ ok: false, error: friendly(ev.error.message) });
          break;
        case 'error':
          endTurn({ ok: false, error: friendly(ev.message) });
          break;
        default:
          break;
      }
    }
  } catch (err) {
    if (stopping.has(lessonId) || ac.signal.aborted) endTurn({ ok: true, interrupted: true });
    else endTurn({ ok: false, error: friendly(err instanceof Error ? err.message : String(err)) });
  } finally {
    endTurn({ ok: true, interrupted: true });
  }
}

/** Codex's API errors arrive as JSON; the learner should read the sentence, not the envelope. */
function friendly(message: string): string {
  try {
    const parsed = JSON.parse(message) as { error?: { message?: string } };
    if (parsed?.error?.message) message = parsed.error.message;
  } catch {
    /* plain text */
  }
  if (/not supported when using Codex with a ChatGPT account|model.*not found/i.test(message)) {
    message += ' Set DERIVE_MODEL in .env (for example gpt-5.5), or change `model` in ~/.codex/config.toml.';
  }
  if (/login|unauthori[sz]ed|401|auth/i.test(message) && !/model/i.test(message)) {
    message += ' Run `pnpm exec codex login` in the derive folder and try again.';
  }
  return message.replace(/^Codex Exec exited with code \d+:\s*/, '').trim() || 'the Codex turn failed';
}
