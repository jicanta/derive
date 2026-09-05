/**
 * The tutor's actions, independent of who is driving: the in-process agent
 * (agent.ts) or a Claude Code session through the HTTP API (index.ts) and
 * the stdio MCP server (mcp.ts). Each action records state, emits events
 * for the browser, and returns what the model should be told.
 */
import {
  addMemory,
  addMisconception,
  learnerProfile,
  listMisconceptions,
  listMemory,
  recordQuiz,
  replaceGraph,
  resolveMisconceptions,
  setGoal,
  setNodeStatus,
  setPhase,
  type GraphNodeInput,
} from './db.js';
import { emit } from './events.js';
import { openPrompt } from './prompts.js';

const sameSet = (a: number[], b: number[]) =>
  a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i]);

export type QuizArgs = {
  question: string;
  options: string[];
  correct: number[];
  explanation: string;
  node_id?: string | null;
};

export async function quiz(lessonId: string, a: QuizArgs) {
  const multi = a.correct.length > 1;
  const { id, wait } = openPrompt(lessonId, 'quiz', {
    question: a.question,
    options: a.options,
    multi,
    node_id: a.node_id ?? null,
  });
  const ans = (await wait) as { selected?: number[]; idk?: boolean; note?: string; interrupted?: boolean };
  if (ans.interrupted) return { result: 'interrupted', note: 'The learner stopped the turn.' };
  const selected = ans.idk ? [] : (ans.selected ?? []);
  const isCorrect = !ans.idk && sameSet(selected, a.correct);
  const result = ans.idk ? 'dont_know' : isCorrect ? 'correct' : 'incorrect';
  emit(lessonId, 'quiz_result', { id, selected, correct: a.correct, explanation: a.explanation, result, note: ans.note ?? null });
  recordQuiz(lessonId, a.node_id ?? null, isCorrect);
  if (result === 'incorrect') {
    addMisconception({
      lessonId,
      nodeId: a.node_id ?? null,
      question: a.question,
      picked: selected.map((i) => a.options[i]).join(' + '),
      correct: a.correct.map((i) => a.options[i]).join(' + '),
      explanation: a.explanation,
    });
  }
  return {
    result,
    selected_options: selected.map((i) => a.options[i]),
    correct_options: a.correct.map((i) => a.options[i]),
    note: ans.note ?? null,
  };
}

export async function ask(lessonId: string, a: { question: string; options?: string[] }) {
  const { id, wait } = openPrompt(lessonId, 'ask', { question: a.question, options: a.options ?? [] });
  const ans = (await wait) as { text?: string; interrupted?: boolean };
  if (ans.interrupted) return { result: 'interrupted' };
  emit(lessonId, 'ask_result', { id, text: ans.text ?? '' });
  return { answer: ans.text ?? '' };
}

export async function setPlan(lessonId: string, a: { goal: string; nodes: GraphNodeInput[] }) {
  replaceGraph(lessonId, a.nodes);
  setGoal(lessonId, a.goal);
  const { id, wait } = openPrompt(lessonId, 'plan', { goal: a.goal, nodes: a.nodes });
  const ans = (await wait) as { approved?: boolean; feedback?: string; interrupted?: boolean };
  if (ans.interrupted) return { result: 'interrupted' };
  emit(lessonId, 'plan_result', { id, approved: !!ans.approved, feedback: ans.feedback ?? null });
  return { approved: !!ans.approved, feedback: ans.feedback ?? null };
}

export function nodeStatus(lessonId: string, a: { id: string; status: 'teaching' | 'locked' | 'shaky' }) {
  setNodeStatus(lessonId, a.id, a.status);
  if (a.status === 'locked') resolveMisconceptions(lessonId, a.id);
  emit(lessonId, 'node_status', { id: a.id, status: a.status });
  return { ok: true };
}

export function phase(lessonId: string, a: { phase: 'probe' | 'plan' | 'teach' }) {
  setPhase(lessonId, a.phase);
  emit(lessonId, 'phase', { phase: a.phase });
  return { ok: true };
}

/**
 * Teach-back (the Feynman move): the learner explains the node in their own
 * words; the model grades it against the rubric it wrote beforehand.
 */
export async function explainBack(lessonId: string, a: { prompt: string; node_id?: string | null; rubric: string }) {
  const { id, wait } = openPrompt(lessonId, 'explain', { prompt: a.prompt, node_id: a.node_id ?? null });
  const ans = (await wait) as { text?: string; interrupted?: boolean };
  if (ans.interrupted) return { result: 'interrupted' };
  emit(lessonId, 'explain_result', { id, text: ans.text ?? '' });
  return { explanation: ans.text ?? '', rubric: a.rubric, instruction: 'Grade against the rubric. Name what is right first, then the one gap that matters most. Then call node_status.' };
}

export function remember(lessonId: string, a: { fact: string; kind?: 'learner' | 'preference' | 'strength' | 'gap' }) {
  addMemory(a.fact, a.kind ?? 'learner', lessonId);
  emit(lessonId, 'memory', { fact: a.fact, kind: a.kind ?? 'learner' });
  return { ok: true };
}

export function profile(lessonId?: string) {
  return {
    profile: learnerProfile(lessonId) || 'Nothing yet. This is a new learner.',
    memory: listMemory().slice(0, 20).map((m) => m.fact),
    misconceptions: listMisconceptions()
      .filter((m) => !m.resolved)
      .slice(0, 10)
      .map((m) => ({ topic: m.topic, picked: m.picked, correct: m.correct })),
  };
}
