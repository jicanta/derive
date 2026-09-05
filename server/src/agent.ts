import { randomUUID } from 'node:crypto';
import { createSdkMcpServer, query, tool, type Query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import * as actions from './actions.js';
import { DATA_DIR, EFFORT, MODEL } from './config.js';
import { getLesson, learnerProfile, setSessionId, type GraphNodeInput } from './db.js';
import { emit, emitEphemeral } from './events.js';
import { cancelPending } from './prompts.js';
import { SYSTEM_PROMPT } from './prompt.js';

export { answerPrompt, hasPending } from './prompts.js';

// ---------- active turns ----------

const active = new Map<string, Query>();

export function isBusy(lessonId: string) {
  return active.has(lessonId);
}

export async function interrupt(lessonId: string) {
  const q = active.get(lessonId);
  if (q) await q.interrupt().catch(() => undefined);
  cancelPending(lessonId);
}

// ---------- tool definitions ----------

function text(obj: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(obj) }] };
}

export const nodeSchema = z.object({
  id: z.string().describe('Short stable id, e.g. "packets".'),
  label: z.string().describe('Short label, 2 to 6 words.'),
  kind: z.enum(['truth', 'derived', 'goal']),
  summary: z.string().optional().describe('One sentence: the claim this node stands for.'),
  depends_on: z.array(z.string()).optional().describe('Ids of the nodes this one is derived from. Empty for roots.'),
});

export const TOOL_DESCRIPTIONS = {
  quiz: 'Ask the learner ONE graded multiple-choice question with a known correct answer. The app renders the options, the learner answers, the app grades it and reveals your explanation. Returns what the learner picked and whether it was correct. Blocks until the learner answers.',
  ask: 'Ask the learner a question with no right answer (goal, preference, energy, what next). Optionally offer choices; the learner can always type a free answer. Blocks until they answer.',
  set_plan:
    'Submit the lesson plan as a dependency DAG: unconditional truths at the roots (kind "truth"), derived steps (kind "derived"), exactly one "goal" sink. The app draws it and asks the learner to approve. Blocks until they approve or request changes; if they request changes, revise and call again.',
  node_status: 'Update the state of a plan node: "teaching" when you start it, "locked" when a quiz confirms it landed, "shaky" when it did not.',
  set_phase: 'Announce which phase of the lesson you are in.',
  explain_back:
    'Teach-back check: ask the learner to explain a node in their own words (2 to 5 sentences). Write the rubric first: the 2 or 3 things a correct explanation must contain. Returns their explanation for you to grade. Use once per lesson on the most important derived node, or when a quiz pass felt lucky. Blocks until they write.',
  remember:
    'Store one durable fact about this learner for future lessons: a strength, a gap, a preference (Socratic vs narrated), a background detail. One sentence. Use sparingly: 1 to 3 per lesson.',
};

function buildTools(lessonId: string) {
  const quiz = tool(
    'quiz',
    TOOL_DESCRIPTIONS.quiz,
    {
      question: z.string().describe('The question, markdown with $LaTeX$ allowed. Do not restate it in prose.'),
      options: z.array(z.string()).min(2).max(3).describe('2 or 3 bare claims, no justification. The app adds "I don\'t know" itself.'),
      correct: z.array(z.number().int().min(0)).min(1).describe('0-based indices of the correct option(s). Usually exactly one.'),
      explanation: z.string().describe('Why the correct answer is correct, and what each distractor gets wrong. Shown only after answering.'),
      node_id: z.string().optional().describe('The plan node this question checks. Always pass it in the teach phase.'),
    },
    async (a) => text(await actions.quiz(lessonId, a)),
  );

  const ask = tool(
    'ask',
    TOOL_DESCRIPTIONS.ask,
    { question: z.string(), options: z.array(z.string()).max(4).optional().describe('Optional suggested answers.') },
    async (a) => text(await actions.ask(lessonId, a)),
  );

  const set_plan = tool(
    'set_plan',
    TOOL_DESCRIPTIONS.set_plan,
    { goal: z.string().describe('The learning goal in one sentence, as agreed with the learner.'), nodes: z.array(nodeSchema).min(3).max(12) },
    async (a) => text(await actions.setPlan(lessonId, { goal: a.goal, nodes: a.nodes as GraphNodeInput[] })),
  );

  const node_status = tool(
    'node_status',
    TOOL_DESCRIPTIONS.node_status,
    { id: z.string(), status: z.enum(['teaching', 'locked', 'shaky']) },
    async (a) => text(actions.nodeStatus(lessonId, a)),
  );

  const set_phase = tool('set_phase', TOOL_DESCRIPTIONS.set_phase, { phase: z.enum(['probe', 'plan', 'teach']) }, async (a) =>
    text(actions.phase(lessonId, a)),
  );

  const explain_back = tool(
    'explain_back',
    TOOL_DESCRIPTIONS.explain_back,
    {
      prompt: z.string().describe('What to explain, e.g. "Explain in your own words why the step size has to be below 2/L."'),
      rubric: z.string().describe('The 2 or 3 things a correct explanation must contain. Not shown to the learner.'),
      node_id: z.string().optional(),
    },
    async (a) => text(await actions.explainBack(lessonId, a)),
  );

  const remember = tool(
    'remember',
    TOOL_DESCRIPTIONS.remember,
    { fact: z.string(), kind: z.enum(['learner', 'preference', 'strength', 'gap']).optional() },
    async (a) => text(actions.remember(lessonId, a)),
  );

  return createSdkMcpServer({
    name: 'derive',
    version: '0.2.0',
    alwaysLoad: true,
    tools: [quiz, ask, set_plan, node_status, set_phase, explain_back, remember],
  });
}

export const DERIVE_TOOL_NAMES = ['quiz', 'ask', 'set_plan', 'node_status', 'set_phase', 'explain_back', 'remember'] as const;

// ---------- running a turn ----------

const TOOL_LABELS: Record<string, string> = {
  WebSearch: 'Verifying with a web search',
  WebFetch: 'Reading a source',
  mcp__derive__quiz: 'Writing a question',
  mcp__derive__ask: 'Asking',
  mcp__derive__set_plan: 'Drawing the plan',
  mcp__derive__node_status: 'Updating the graph',
  mcp__derive__set_phase: 'Changing phase',
  mcp__derive__explain_back: 'Preparing a teach-back',
  mcp__derive__remember: 'Taking a note',
};

export async function runTurn(lessonId: string, prompt: string, opts: { echoUser?: string } = {}) {
  const lesson = getLesson(lessonId);
  if (!lesson) throw new Error('lesson not found');
  if (active.has(lessonId)) throw new Error('lesson is busy');

  if (opts.echoUser) emit(lessonId, 'user', { text: opts.echoUser });
  emit(lessonId, 'turn_start', {});

  const q = query({
    prompt,
    options: {
      systemPrompt: SYSTEM_PROMPT + learnerProfile(lessonId),
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
  active.set(lessonId, q);

  let blockId: string | null = null;
  let blockText = '';
  let verified = 0;
  const flushBlock = () => {
    if (blockId && blockText.trim()) emit(lessonId, 'assistant', { id: blockId, text: blockText });
    blockId = null;
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
              emitEphemeral(lessonId, 'block_start', { id: blockId });
            } else if (cb.type === 'tool_use') {
              flushBlock();
              if (cb.name === 'WebSearch' || cb.name === 'WebFetch') verified += 1;
              emitEphemeral(lessonId, 'status', { text: TOOL_LABELS[cb.name] ?? `Using ${cb.name}` });
            } else if (cb.type === 'thinking') {
              emitEphemeral(lessonId, 'status', { text: 'Thinking' });
            }
          } else if (ev.type === 'content_block_delta') {
            if (ev.delta.type === 'text_delta' && blockId) {
              blockText += ev.delta.text;
              emitEphemeral(lessonId, 'delta', { id: blockId, text: ev.delta.text });
            }
          } else if (ev.type === 'content_block_stop') {
            flushBlock();
          }
          break;
        }
        case 'result': {
          flushBlock();
          if (msg.subtype === 'success') {
            emit(lessonId, 'turn_end', { ok: true, cost_usd: msg.total_cost_usd ?? null, duration_ms: msg.duration_ms, verified });
          } else {
            const errs = (msg as { errors?: string[] }).errors;
            emit(lessonId, 'turn_end', { ok: false, error: Array.isArray(errs) && errs.length ? errs.join('; ') : msg.subtype });
          }
          break;
        }
        default:
          break;
      }
    }
  } catch (err) {
    flushBlock();
    emit(lessonId, 'turn_end', { ok: false, error: err instanceof Error ? err.message : String(err) });
  } finally {
    active.delete(lessonId);
    cancelPending(lessonId);
  }
}
