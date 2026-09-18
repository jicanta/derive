import { randomUUID } from 'node:crypto';
import { createSdkMcpServer, query, tool, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import * as actions from './actions.js';
import { backend } from './backend.js';
import { runCodexTurn, type Active } from './codex.js';
import { DATA_DIR, EFFORT, MODEL } from './config.js';
import { getLesson, learnerProfile, setSessionId, type GraphNodeInput } from './db.js';
import { checkpoint, emit, emitEphemeral, emitUpdate } from './events.js';
import { librarySection } from './library.js';
import { materialsSection } from './materials.js';
import { takeNotices } from './notices.js';
import { cancelPending } from './prompts.js';
import { systemPrompt } from './prompt.js';
import { DERIVE_TOOL_NAMES, TOOL_LABELS, toolsFor } from './tools.js';

export { DERIVE_TOOL_NAMES } from './tools.js';

export { answerPrompt, hasPending } from './prompts.js';

// ---------- active turns ----------

/** The turn in flight per lesson, whichever backend runs it. */
const active = new Map<string, Active>();
/** Lessons whose current turn the learner stopped; their result is not an error. */
const stopping = new Set<string>();

export function isBusy(lessonId: string) {
  return active.has(lessonId);
}

export async function interrupt(lessonId: string) {
  const turn = active.get(lessonId);
  if (turn) {
    stopping.add(lessonId);
    await turn.interrupt().catch(() => undefined);
  }
  cancelPending(lessonId);
}

export { addNotice, takeNotices } from './notices.js';

// ---------- tool definitions ----------

function text(obj: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(obj) }] };
}

/** The only per-tool code left in this file: each tool's handler calls a different action with a different shape. */
const handlers: Record<string, (lessonId: string, a: Record<string, unknown>) => unknown> = {
  quiz: (l, a) => actions.quiz(l, a as unknown as Parameters<typeof actions.quiz>[1]),
  ask: (l, a) => actions.ask(l, a as unknown as Parameters<typeof actions.ask>[1]),
  set_plan: (l, a) => actions.setPlan(l, { goal: a.goal as string, nodes: a.nodes as GraphNodeInput[] }),
  node_status: (l, a) => actions.nodeStatus(l, a as unknown as Parameters<typeof actions.nodeStatus>[1]),
  set_phase: (l, a) => actions.phase(l, a as unknown as Parameters<typeof actions.phase>[1]),
  explain_back: (l, a) => actions.explainBack(l, a as unknown as Parameters<typeof actions.explainBack>[1]),
  remember: (l, a) => actions.remember(l, a as unknown as Parameters<typeof actions.remember>[1]),
  set_preferences: (l, a) => actions.setPreferences(l, a as unknown as Parameters<typeof actions.setPreferences>[1]),
  read_material: (l, a) => actions.readMaterial(l, a as unknown as Parameters<typeof actions.readMaterial>[1]),
  search_material: (l, a) => actions.searchMaterial(l, a as unknown as Parameters<typeof actions.searchMaterial>[1]),
  search_library: (l, a) => actions.searchLibrary(l, a as unknown as Parameters<typeof actions.searchLibrary>[1]),
  read_resource: (l, a) => actions.readResource(l, a as unknown as Parameters<typeof actions.readResource>[1]),
  suggest_resource: (l, a) => actions.suggestResource(l, a as unknown as Parameters<typeof actions.suggestResource>[1]),
  add_resource: (l, a) => actions.saveResource(l, a as unknown as Parameters<typeof actions.saveResource>[1]),
};

/**
 * Every tool the agent offers, built from the registry: the name, the
 * description the model reads and the input schema all come from the one spec
 * the MCP server and the HTTP route read too, so this file cannot drift from
 * them.
 */
function buildTools(lessonId: string) {
  const tools = toolsFor('agent').map((spec) => {
    const run = handlers[spec.name];
    if (!run) throw new Error(`no handler for tool: ${spec.name}`);
    return tool(spec.name, spec.description, spec.shape, async (a) => text(await run(lessonId, a as Record<string, unknown>)));
  });

  // The material and library tools are always registered: material can be
  // attached while a card is pending, and the tutor should be able to read
  // it in that same turn. Without material they return a clear error.
  return createSdkMcpServer({
    name: 'derive',
    version: '0.2.0',
    alwaysLoad: true,
    tools,
  });
}

// ---------- running a turn ----------

export async function runTurn(lessonId: string, prompt: string, opts: { echoUser?: string } = {}) {
  const lesson = getLesson(lessonId);
  if (!lesson) throw new Error('lesson not found');
  if (active.has(lessonId)) throw new Error('lesson is busy');

  if (opts.echoUser) emit(lessonId, 'user', { text: opts.echoUser });
  emit(lessonId, 'turn_start', {});

  const pendingNotices = takeNotices(lessonId);
  if (pendingNotices.length) prompt = `${pendingNotices.join('\n\n')}\n\nThen, the learner's message:\n${prompt}`;

  const instructions = systemPrompt(backend()) + materialsSection(lessonId) + librarySection(lesson.learner_id, lesson.topic) + learnerProfile(lesson.learner_id, lessonId);
  if (backend() === 'codex') {
    try {
      await runCodexTurn(lessonId, prompt, instructions, active, stopping);
    } finally {
      active.delete(lessonId);
      stopping.delete(lessonId);
      cancelPending(lessonId);
    }
    return;
  }

  const q = query({
    prompt,
    options: {
      systemPrompt: instructions,
      cwd: DATA_DIR,
      settingSources: [],
      mcpServers: { derive: buildTools(lessonId) },
      tools: ['WebSearch', 'WebFetch'],
      allowedTools: ['WebSearch', 'WebFetch', ...DERIVE_TOOL_NAMES.map((n) => `mcp__derive__${n}`)],
      permissionMode: 'dontAsk',
      includePartialMessages: true,
      maxTurns: 400,
      model: MODEL,
      effort: EFFORT,
      resume: lesson.session_id ?? undefined,
      env: { ...process.env, CLAUDE_AGENT_SDK_CLIENT_APP: 'derive/0.2.0' },
    },
  });
  active.set(lessonId, {
    interrupt: async () => {
      await q.interrupt();
    },
  });

  // A text block is persisted the moment it starts and rewritten in place as
  // it grows (checkpointed every ~1.5 s, finalised at block end), so the
  // learner never sees prose that later vanishes: Stop, a dropped connection
  // or a server restart all keep what was written.
  let blockId: string | null = null;
  let blockSeq: number | null = null;
  let blockText = '';
  let lastCheckpoint = 0;
  let verified = 0;
  let ended = false;
  const endTurn = (payload: Record<string, unknown>) => {
    if (ended) return;
    ended = true;
    emit(lessonId, 'turn_end', payload);
  };
  const flushBlock = () => {
    if (blockId && blockSeq !== null) emitUpdate(lessonId, blockSeq, 'assistant', { id: blockId, text: blockText });
    blockId = null;
    blockSeq = null;
    blockText = '';
  };

  try {
    for await (const msg of q as AsyncIterable<SDKMessage>) {
      switch (msg.type) {
        case 'system':
          if (msg.subtype === 'init' && msg.session_id !== lesson.session_id) setSessionId(lessonId, msg.session_id);
          break;
        case 'stream_event': {
          if (msg.parent_tool_use_id) break;
          const ev = msg.event;
          if (ev.type === 'content_block_start') {
            const cb = ev.content_block;
            if (cb.type === 'text') {
              flushBlock();
              blockId = randomUUID();
              blockSeq = emit(lessonId, 'assistant', { id: blockId, text: '', partial: true }).seq;
              lastCheckpoint = Date.now();
            } else if (cb.type === 'tool_use') {
              flushBlock();
              if (cb.name === 'WebSearch' || cb.name === 'WebFetch') verified += 1;
              emitEphemeral(lessonId, 'status', { text: cb.name === 'WebSearch' ? 'Verifying with a web search' : cb.name === 'WebFetch' ? 'Reading a source' : TOOL_LABELS[cb.name.replace(/^mcp__derive__/, '')] ?? `Using ${cb.name}` });
            } else if (cb.type === 'thinking') {
              emitEphemeral(lessonId, 'status', { text: 'Thinking' });
            }
          } else if (ev.type === 'content_block_delta') {
            if (ev.delta.type === 'text_delta' && blockId) {
              blockText += ev.delta.text;
              emitEphemeral(lessonId, 'delta', { id: blockId, text: ev.delta.text });
              if (blockSeq !== null && Date.now() - lastCheckpoint > 1500) {
                checkpoint(lessonId, blockSeq, { id: blockId, text: blockText, partial: true });
                lastCheckpoint = Date.now();
              }
            }
          } else if (ev.type === 'content_block_stop') {
            flushBlock();
          }
          break;
        }
        case 'result': {
          flushBlock();
          if (stopping.has(lessonId)) {
            endTurn({ ok: true, interrupted: true });
          } else if (msg.subtype === 'success') {
            endTurn({ ok: true, cost_usd: msg.total_cost_usd ?? null, duration_ms: msg.duration_ms, verified });
          } else {
            const errs = (msg as { errors?: string[] }).errors;
            endTurn({ ok: false, error: Array.isArray(errs) && errs.length ? errs.join('; ') : msg.subtype });
          }
          break;
        }
        default:
          break;
      }
    }
  } catch (err) {
    flushBlock();
    endTurn({ ok: false, error: err instanceof Error ? err.message : String(err) });
  } finally {
    // The stream can end without a result (Stop, the CLI exiting). The
    // learner still needs the prose kept and the turn marked finished.
    flushBlock();
    endTurn({ ok: true, interrupted: true });
    active.delete(lessonId);
    stopping.delete(lessonId);
    cancelPending(lessonId);
  }
}
