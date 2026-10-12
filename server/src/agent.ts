import { randomUUID } from 'node:crypto';
import { createSdkMcpServer, query, tool, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import * as actions from './actions.js';
import { codexDriver, type Active } from './codex.js';
import { DATA_DIR, EFFORT, VERSION } from './config.js';
import { clearSessionId, clearTurnMessages, getLesson, lastTurn, learnerProfile, startTurn } from './db.js';
import { driverOverride, sinkFor, type Driver, type EventSink, type TurnContext } from './driver.js';
import { searchMode } from './drivers/adapters.js';
import { apiDriverFor } from './drivers/api.js';
import { emit } from './events.js';
import { librarySection } from './library.js';
import { materialsSection } from './materials.js';
import { takeNotices } from './notices.js';
import { cancelPending } from './prompts.js';
import { systemPrompt, type WebSurface } from './prompt.js';
import { safeMessage } from './secrets.js';
import { backendOf, resolveTutor } from './settings.js';
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

/**
 * Every tool the agent offers, built from the registry: the name, the
 * description the model reads and the input schema all come from the one spec
 * the MCP server and the HTTP route read too, so this file cannot drift from
 * them. The description and the shape come through the registry's accessors
 * rather than off the spec, so a difference this surface one day declares
 * under `per_surface` is honoured here without another change.
 *
 * The dispatch itself lives in `actions.ts` as `runTool`, so this driver and
 * the owned loop in `drivers/api.ts` call the same fourteen handlers; a second
 * copy here is how the tool set starts drifting between two drivers.
 */
function buildTools(lessonId: string) {
  const tools = toolsFor('agent').map((spec) =>
    tool(spec.name, descriptionFor(spec, 'agent'), shapeFor(spec, 'agent'), async (a) => text(await actions.runTool(lessonId, spec.name, a as Record<string, unknown>))),
  );

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
      sink.endTurn({ ok: false, error: safeMessage(err) });
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

  // The provider and model are resolved here, per turn, so a change made on
  // the settings page is what this turn runs on with no restart. A turn begins
  // in two places at once: the row the busy check and the usage ledger read,
  // and the event the browser replays. The driver is chosen first only so the
  // row can say which one ran it.
  const tutor = resolveTutor(lesson.learner_id);
  const driver = driverOverride() ?? (backendOf(tutor.provider) === 'codex' ? codexDriver : tutor.provider === 'claude-code' ? claudeDriver : apiDriverFor(tutor.provider));
  // D-04: a session id belongs to the provider that issued it. When the driver
  // changed since the last turn, the lesson starts a fresh provider
  // conversation; a model change on the same provider keeps resuming. On the
  // owned loop `driver.name` already is the catalogue provider id, so this
  // reads as the comparison of providers D-04 actually means. The persisted
  // messages go with the session id on the same comparison and for the same
  // reason: a provider's reasoning signatures and thought signatures are not
  // portable, so carrying a history across a switch would replay one vendor's
  // opaque blocks into another that rejects them. The tutor rebuilds from the
  // lesson's events and nodes instead.
  const last = lastTurn(lessonId);
  if (last && last.driver !== driver.name) {
    if (lesson.session_id) clearSessionId(lessonId);
    clearTurnMessages(lessonId);
  }
  const turnId = startTurn(lessonId, driver.name, tutor.model);
  emit(lessonId, 'turn_start', { provider: tutor.provider, model: tutor.model });

  const pendingNotices = takeNotices(lessonId);
  if (pendingNotices.length) prompt = `${pendingNotices.join('\n\n')}\n\nThen, the learner's message:\n${prompt}`;

  // The method text names the web tools this turn actually has. The two login
  // rows borrow their host CLI's; every other row is Derive's own loop, where
  // the answer comes from `searchMode` — the same call the loop registers its
  // tools from, so the tutor is never told to verify with a tool it was not
  // given, and never offered two ways to search in one turn.
  const web: WebSurface =
    tutor.provider === 'codex' ? { kind: 'codex' } : tutor.provider === 'claude-code' ? { kind: 'claude' } : { kind: 'api', search: searchMode(tutor.provider, tutor.model) };
  // D-06's split, built here because this is where the whole prompt is
  // assembled. The stable half is the method text and the tool contract, which
  // `systemPrompt` renders from `method/` and nothing per-turn goes into; the
  // volatile half is everything that changes while a lesson runs. The
  // concatenation order is unchanged, so `ctx.instructions` is byte-identical
  // to what the Claude and Codex drivers have always received.
  const instructionsStable = systemPrompt(web);
  const instructionsVolatile = materialsSection(lessonId) + librarySection(lesson.learner_id, lesson.topic) + learnerProfile(lesson.learner_id, lessonId);
  const instructions = instructionsStable + instructionsVolatile;

  // The one dispatch, below: everything around it — the bookkeeping above and
  // the teardown after — is the same whichever driver runs.
  const ctx: TurnContext = {
    lessonId,
    turnId,
    prompt,
    instructions,
    instructionsStable,
    instructionsVolatile,
    model: tutor.model ?? undefined,
    effort: EFFORT,
    sessionId: getLesson(lessonId)!.session_id ?? null,
    isStopping: () => stopping.has(lessonId),
    onActive: (handle) => active.set(lessonId, handle),
  };
  const sink = sinkFor(lessonId, turnId);
  try {
    await driver.runTurn(ctx, sink);
  } catch (err) {
    sink.endTurn({ ok: false, error: safeMessage(err) });
    throw err;
  } finally {
    // A driver that reported nothing still owes the learner a finished turn.
    sink.endTurn({ ok: true, interrupted: true });
    active.delete(lessonId);
    stopping.delete(lessonId);
    cancelPending(lessonId);
  }
}
