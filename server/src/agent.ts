import { randomUUID } from 'node:crypto';
import { createSdkMcpServer, query, tool, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import * as actions from './actions.js';
import { backend } from './backend.js';
import { codexDriver, type Active } from './codex.js';
import { DATA_DIR, EFFORT, MODEL, VERSION } from './config.js';
import { getLesson, learnerProfile, startTurn, type GraphNodeInput } from './db.js';
import { driverOverride, sinkFor, type Driver, type EventSink, type TurnContext } from './driver.js';
import { emit } from './events.js';
import { librarySection } from './library.js';
import { materialsSection } from './materials.js';
import { takeNotices } from './notices.js';
import { cancelPending } from './prompts.js';
import { systemPrompt } from './prompt.js';
import { DERIVE_TOOL_NAMES, TOOL_LABELS, descriptionFor, shapeFor, toolsFor } from './tools.js';

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
 * them. The description and the shape come through the registry's accessors
 * rather than off the spec, so a difference this surface one day declares
 * under `per_surface` is honoured here without another change.
 */
function buildTools(lessonId: string) {
  const tools = toolsFor('agent').map((spec) => {
    const run = handlers[spec.name];
    if (!run) throw new Error(`no handler for tool: ${spec.name}`);
    return tool(spec.name, descriptionFor(spec, 'agent'), shapeFor(spec, 'agent'), async (a) => text(await run(lessonId, a as Record<string, unknown>)));
  });

  // The material and library tools are always registered: material can be
  // attached while a card is pending, and the tutor should be able to read
  // it in that same turn. Without material they return a clear error.
  return createSdkMcpServer({
    name: 'derive',
    version: VERSION,
    alwaysLoad: true,
    tools,
  });
}

// ---------- the claude driver ----------

/** A number the provider actually reported, or null. Anything else — undefined, NaN — is a count nobody gave us, and stays blank. */
const reported = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * What the provider reported for this result, as one usage row per model it
 * ran on.
 *
 * `modelUsage` is the SDK's own per-model breakdown and is what COST-01 asks
 * for: the counts together with the model id in effect, which a turn that
 * retried on a second model would otherwise lose. Where it is missing, the
 * turn-level `usage` is written instead against the model the turn asked for.
 * Fields the table has no column for are dropped; columns nothing was reported
 * for stay null. Nothing here is ever derived from the transcript.
 */
function reportUsage(sink: EventSink, msg: Extract<SDKMessage, { type: 'result' }>, asked: string | undefined) {
  const perModel = msg.modelUsage && typeof msg.modelUsage === 'object' ? Object.entries(msg.modelUsage) : [];
  if (perModel.length) {
    for (const [model, u] of perModel) {
      sink.usage({
        model,
        input_tokens: reported(u.inputTokens),
        output_tokens: reported(u.outputTokens),
        cache_read_tokens: reported(u.cacheReadInputTokens),
        cache_write_tokens: reported(u.cacheCreationInputTokens),
        reasoning_tokens: reported(u.thinkingTokens),
        cost_usd: reported(u.costUSD),
        // The app path runs on the learner's Claude Code login, not on metered
        // billing, so a figure the SDK did not put a price on is subscription
        // usage rather than a cost of zero.
        cost_source: reported(u.costUSD) === null ? 'subscription' : 'provider',
      });
    }
    return;
  }
  const u = msg.usage;
  if (!u) return;
  sink.usage({
    model: asked ?? null,
    input_tokens: reported(u.input_tokens),
    output_tokens: reported(u.output_tokens),
    cache_read_tokens: reported(u.cache_read_input_tokens),
    cache_write_tokens: reported(u.cache_creation_input_tokens),
    reasoning_tokens: null,
    cost_usd: reported(msg.total_cost_usd),
    cost_source: reported(msg.total_cost_usd) === null ? 'subscription' : 'provider',
  });
}

/**
 * One lesson turn through the Claude Agent SDK, on the learner's Claude Code
 * login. The tutor's tools are registered in-process, so quiz, ask, set_plan
 * and the rest run straight through `actions.ts` with no proxy in between.
 *
 * Like every driver it reads its inputs off `ctx` and reports through `sink`:
 * the turn bookkeeping around it — the active and stopping maps, the pending
 * cards — belongs to `runTurn` below, not here.
 */
export const claudeDriver: Driver = {
  name: 'claude',
  async runTurn(ctx: TurnContext, sink: EventSink) {
    const q = query({
      prompt: ctx.prompt,
      options: {
        systemPrompt: ctx.instructions,
        cwd: DATA_DIR,
        settingSources: [],
        mcpServers: { derive: buildTools(ctx.lessonId) },
        tools: ['WebSearch', 'WebFetch'],
        allowedTools: ['WebSearch', 'WebFetch', ...DERIVE_TOOL_NAMES.map((n) => `mcp__derive__${n}`)],
        permissionMode: 'dontAsk',
        includePartialMessages: true,
        maxTurns: 400,
        model: ctx.model,
        effort: ctx.effort,
        resume: ctx.sessionId ?? undefined,
        env: { ...process.env, CLAUDE_AGENT_SDK_CLIENT_APP: `derive/${VERSION}` },
      },
    });
    ctx.onActive({
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
    const flushBlock = () => {
      if (blockId && blockSeq !== null) sink.emitUpdate(blockSeq, 'assistant', { id: blockId, text: blockText });
      blockId = null;
      blockSeq = null;
      blockText = '';
    };

    try {
      for await (const msg of q as AsyncIterable<SDKMessage>) {
        switch (msg.type) {
          case 'system':
            if (msg.subtype === 'init' && msg.session_id !== ctx.sessionId) sink.setSessionId(msg.session_id);
            break;
          case 'stream_event': {
            if (msg.parent_tool_use_id) break;
            const ev = msg.event;
            if (ev.type === 'content_block_start') {
              const cb = ev.content_block;
              if (cb.type === 'text') {
                flushBlock();
                blockId = randomUUID();
                blockSeq = sink.emit('assistant', { id: blockId, text: '', partial: true }).seq;
                lastCheckpoint = Date.now();
              } else if (cb.type === 'tool_use') {
                flushBlock();
                if (cb.name === 'WebSearch' || cb.name === 'WebFetch') verified += 1;
                sink.emitEphemeral('status', { text: cb.name === 'WebSearch' ? 'Verifying with a web search' : cb.name === 'WebFetch' ? 'Reading a source' : TOOL_LABELS[cb.name.replace(/^mcp__derive__/, '')] ?? `Using ${cb.name}` });
              } else if (cb.type === 'thinking') {
                sink.emitEphemeral('status', { text: 'Thinking' });
              }
            } else if (ev.type === 'content_block_delta') {
              if (ev.delta.type === 'text_delta' && blockId) {
                blockText += ev.delta.text;
                sink.emitEphemeral('delta', { id: blockId, text: ev.delta.text });
                if (blockSeq !== null && Date.now() - lastCheckpoint > 1500) {
                  sink.checkpoint(blockSeq, { id: blockId, text: blockText, partial: true });
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
            reportUsage(sink, msg, ctx.model);
            if (ctx.isStopping()) {
              sink.endTurn({ ok: true, interrupted: true });
            } else if (msg.subtype === 'success') {
              sink.endTurn({ ok: true, cost_usd: msg.total_cost_usd ?? null, duration_ms: msg.duration_ms, verified });
            } else {
              const errs = (msg as { errors?: string[] }).errors;
              sink.endTurn({ ok: false, error: Array.isArray(errs) && errs.length ? errs.join('; ') : msg.subtype });
            }
            break;
          }
          default:
            break;
        }
      }
    } catch (err) {
      flushBlock();
      sink.endTurn({ ok: false, error: err instanceof Error ? err.message : String(err) });
    } finally {
      // The stream can end without a result (Stop, the CLI exiting). The
      // learner still needs the prose kept and the turn marked finished.
      flushBlock();
      sink.endTurn({ ok: true, interrupted: true });
    }
  },
};

// ---------- running a turn ----------

export async function runTurn(lessonId: string, prompt: string, opts: { echoUser?: string } = {}) {
  const lesson = getLesson(lessonId);
  if (!lesson) throw new Error('lesson not found');
  if (active.has(lessonId)) throw new Error('lesson is busy');

  if (opts.echoUser) emit(lessonId, 'user', { text: opts.echoUser });

  // A turn begins in two places at once: the row the busy check and the usage
  // ledger read, and the event the browser replays. The driver is chosen first
  // only so the row can say which one ran it.
  const driver = driverOverride() ?? (backend() === 'codex' ? codexDriver : claudeDriver);
  const turnId = startTurn(lessonId, driver.name, MODEL);
  emit(lessonId, 'turn_start', {});

  const pendingNotices = takeNotices(lessonId);
  if (pendingNotices.length) prompt = `${pendingNotices.join('\n\n')}\n\nThen, the learner's message:\n${prompt}`;

  const instructions = systemPrompt(backend()) + materialsSection(lessonId) + librarySection(lesson.learner_id, lesson.topic) + learnerProfile(lesson.learner_id, lessonId);

  // The one dispatch, below: everything around it — the bookkeeping above and
  // the teardown after — is the same whichever driver runs.
  const ctx: TurnContext = {
    lessonId,
    prompt,
    instructions,
    model: MODEL,
    effort: EFFORT,
    sessionId: lesson.session_id ?? null,
    isStopping: () => stopping.has(lessonId),
    onActive: (handle) => active.set(lessonId, handle),
  };
  const sink = sinkFor(lessonId, turnId);
  try {
    await driver.runTurn(ctx, sink);
  } catch (err) {
    sink.endTurn({ ok: false, error: err instanceof Error ? err.message : String(err) });
    throw err;
  } finally {
    // A driver that reported nothing still owes the learner a finished turn.
    sink.endTurn({ ok: true, interrupted: true });
    active.delete(lessonId);
    stopping.delete(lessonId);
    cancelPending(lessonId);
  }
}
