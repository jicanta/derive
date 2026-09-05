import { randomUUID } from 'node:crypto';
import { createSdkMcpServer, query, tool, type Query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { DATA_DIR, EFFORT, MODEL } from './config.js';
import {
  getLesson,
  recordQuiz,
  replaceGraph,
  setGoal,
  setNodeStatus,
  setPhase,
  setSessionId,
  type GraphNodeInput,
} from './db.js';
import { emit, emitEphemeral } from './events.js';
import { SYSTEM_PROMPT } from './prompt.js';

// ---------- pending prompts (tool calls that wait for the learner) ----------

type Resolver = (answer: unknown) => void;
const pending = new Map<string, { lessonId: string; resolve: Resolver }>();

function waitForLearner<T>(lessonId: string, promptId: string): Promise<T> {
  return new Promise<T>((resolve) => {
    pending.set(promptId, { lessonId, resolve: resolve as Resolver });
  });
}

export function answerPrompt(lessonId: string, promptId: string, answer: unknown): boolean {
  const p = pending.get(promptId);
  if (!p || p.lessonId !== lessonId) return false;
  pending.delete(promptId);
  p.resolve(answer);
  return true;
}

export function hasPending(lessonId: string) {
  for (const p of pending.values()) if (p.lessonId === lessonId) return true;
  return false;
}

// ---------- active turns ----------

const active = new Map<string, Query>();

export function isBusy(lessonId: string) {
  return active.has(lessonId);
}

export async function interrupt(lessonId: string) {
  const q = active.get(lessonId);
  if (q) await q.interrupt().catch(() => undefined);
  // Unblock any tool that is waiting on the learner so the turn can end.
  for (const [id, p] of pending) {
    if (p.lessonId === lessonId) {
      pending.delete(id);
      p.resolve({ interrupted: true });
    }
  }
}

// ---------- tool definitions ----------

const sameSet = (a: number[], b: number[]) =>
  a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i]);

function text(obj: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(obj) }] };
}

function buildTools(lessonId: string) {
  const quiz = tool(
    'quiz',
    'Ask the learner ONE graded multiple-choice question with a known correct answer. The app renders the options, the learner answers, the app grades it and reveals your explanation. Returns what the learner picked and whether it was correct. Blocks until the learner answers.',
    {
      question: z.string().describe('The question, markdown with $LaTeX$ allowed. Do not restate it in prose.'),
      options: z.array(z.string()).min(2).max(3).describe('2 or 3 bare claims, no justification. The app adds "I don\'t know" itself.'),
      correct: z.array(z.number().int().min(0)).min(1).describe('0-based indices of the correct option(s). Usually exactly one.'),
      explanation: z.string().describe('Why the correct answer is correct, and what each distractor gets wrong. Shown only after answering.'),
      node_id: z.string().optional().describe('The plan node this question checks, if any.'),
    },
    async ({ question, options, correct, explanation, node_id }) => {
      const id = randomUUID();
      const multi = correct.length > 1;
      emit(lessonId, 'quiz', { id, question, options, multi, node_id: node_id ?? null });
      const ans = await waitForLearner<{ selected?: number[]; idk?: boolean; note?: string; interrupted?: boolean }>(lessonId, id);
      if (ans.interrupted) return text({ result: 'interrupted', note: 'The learner stopped the turn.' });
      const selected = ans.idk ? [] : (ans.selected ?? []);
      const isCorrect = !ans.idk && sameSet(selected, correct);
      const result = ans.idk ? 'dont_know' : isCorrect ? 'correct' : 'incorrect';
      emit(lessonId, 'quiz_result', { id, selected, correct, explanation, result, note: ans.note ?? null });
      recordQuiz(lessonId, node_id ?? null, isCorrect);
      return text({
        result,
        selected_options: selected.map((i) => options[i]),
        correct_options: correct.map((i) => options[i]),
        note: ans.note ?? null,
      });
    },
  );

  const ask = tool(
    'ask',
    'Ask the learner a question with no right answer (goal, preference, energy, what next). Optionally offer choices; the learner can always type a free answer. Blocks until they answer.',
    {
      question: z.string(),
      options: z.array(z.string()).max(4).optional().describe('Optional suggested answers.'),
    },
    async ({ question, options }) => {
      const id = randomUUID();
      emit(lessonId, 'ask', { id, question, options: options ?? [] });
      const ans = await waitForLearner<{ text?: string; interrupted?: boolean }>(lessonId, id);
      if (ans.interrupted) return text({ result: 'interrupted' });
      emit(lessonId, 'ask_result', { id, text: ans.text ?? '' });
      return text({ answer: ans.text ?? '' });
    },
  );

  const nodeSchema = z.object({
    id: z.string().describe('Short stable id, e.g. "packets".'),
    label: z.string().describe('Short label, 2 to 6 words.'),
    kind: z.enum(['truth', 'derived', 'goal']),
    summary: z.string().optional().describe('One sentence: the claim this node stands for.'),
    depends_on: z.array(z.string()).optional().describe('Ids of the nodes this one is derived from. Empty for roots.'),
  });

  const set_plan = tool(
    'set_plan',
    'Submit the lesson plan as a dependency DAG: unconditional truths at the roots (kind "truth"), derived steps (kind "derived"), exactly one "goal" sink. The app draws it and asks the learner to approve. Blocks until they approve or request changes; if they request changes, revise and call again.',
    {
      goal: z.string().describe('The learning goal in one sentence, as agreed with the learner.'),
      nodes: z.array(nodeSchema).min(3).max(12),
    },
    async ({ goal, nodes }) => {
      const id = randomUUID();
      replaceGraph(lessonId, nodes as GraphNodeInput[]);
      setGoal(lessonId, goal);
      emit(lessonId, 'plan', { id, goal, nodes });
      const ans = await waitForLearner<{ approved?: boolean; feedback?: string; interrupted?: boolean }>(lessonId, id);
      if (ans.interrupted) return text({ result: 'interrupted' });
      emit(lessonId, 'plan_result', { id, approved: !!ans.approved, feedback: ans.feedback ?? null });
      return text({ approved: !!ans.approved, feedback: ans.feedback ?? null });
    },
  );

  const node_status = tool(
    'node_status',
    'Update the state of a plan node: "teaching" when you start it, "locked" when a quiz confirms it landed, "shaky" when it did not.',
    {
      id: z.string(),
      status: z.enum(['teaching', 'locked', 'shaky']),
    },
    async ({ id, status }) => {
      setNodeStatus(lessonId, id, status);
      emit(lessonId, 'node_status', { id, status });
      return text({ ok: true });
    },
  );

  const set_phase = tool(
    'set_phase',
    'Announce which phase of the lesson you are in.',
    { phase: z.enum(['probe', 'plan', 'teach']) },
    async ({ phase }) => {
      setPhase(lessonId, phase);
      emit(lessonId, 'phase', { phase });
      return text({ ok: true });
    },
  );

  return createSdkMcpServer({
    name: 'derive',
    version: '0.1.0',
    alwaysLoad: true,
    tools: [quiz, ask, set_plan, node_status, set_phase],
  });
}

// ---------- running a turn ----------

const TOOL_LABELS: Record<string, string> = {
  WebSearch: 'Verifying with a web search',
  WebFetch: 'Reading a source',
  mcp__derive__quiz: 'Writing a question',
  mcp__derive__ask: 'Asking',
  mcp__derive__set_plan: 'Drawing the plan',
  mcp__derive__node_status: 'Updating the graph',
  mcp__derive__set_phase: 'Changing phase',
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
      systemPrompt: SYSTEM_PROMPT,
      cwd: DATA_DIR,
      settingSources: [],
      mcpServers: { derive: buildTools(lessonId) },
      tools: ['WebSearch', 'WebFetch'],
      allowedTools: [
        'WebSearch',
        'WebFetch',
        'mcp__derive__quiz',
        'mcp__derive__ask',
        'mcp__derive__set_plan',
        'mcp__derive__node_status',
        'mcp__derive__set_phase',
      ],
      permissionMode: 'dontAsk',
      includePartialMessages: true,
      maxTurns: 400,
      model: MODEL,
      effort: EFFORT,
      resume: lesson.session_id ?? undefined,
      env: { ...process.env, CLAUDE_AGENT_SDK_CLIENT_APP: 'derive/0.1.0' },
    },
  });
  active.set(lessonId, q);

  // Streaming state for the current text block.
  let blockId: string | null = null;
  let blockText = '';
  const flushBlock = () => {
    if (blockId && blockText.trim()) emit(lessonId, 'assistant', { id: blockId, text: blockText });
    blockId = null;
    blockText = '';
  };

  try {
    for await (const msg of q as AsyncIterable<SDKMessage>) {
      switch (msg.type) {
        case 'system':
          if (msg.subtype === 'init' && msg.session_id !== lesson.session_id) {
            setSessionId(lessonId, msg.session_id);
          }
          break;
        case 'stream_event': {
          if (msg.parent_tool_use_id) break; // ignore subagent streams
          const ev = msg.event;
          if (ev.type === 'content_block_start') {
            const cb = ev.content_block;
            if (cb.type === 'text') {
              flushBlock();
              blockId = randomUUID();
              blockText = '';
              emitEphemeral(lessonId, 'block_start', { id: blockId });
            } else if (cb.type === 'tool_use') {
              flushBlock();
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
            emit(lessonId, 'turn_end', { ok: true, cost_usd: msg.total_cost_usd ?? null, duration_ms: msg.duration_ms });
          } else {
            const errText = 'errors' in msg && Array.isArray((msg as { errors?: string[] }).errors)
              ? (msg as { errors: string[] }).errors.join('; ')
              : msg.subtype;
            emit(lessonId, 'turn_end', { ok: false, error: errText });
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
    for (const [id, p] of pending) if (p.lessonId === lessonId) pending.delete(id) && p.resolve({ interrupted: true });
  }
}
