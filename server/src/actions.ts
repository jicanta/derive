/**
 * The tutor's actions, independent of who is driving: the in-process agent
 * (agent.ts) or a Claude Code session through the HTTP API (index.ts) and
 * the stdio MCP server (mcp.ts). Each action records state, emits events
 * for the browser, and returns what the model should be told.
 *
 * The blocking actions come in two shapes. `quiz`, `ask`, `setPlan` and
 * `explainBack` wait for the learner and return the result. `openQuiz`,
 * `openAsk`, `openPlan` and `openExplain` open the card and return the
 * promise of its result, so a driver that cannot block (a terminal
 * conversation) can show the card, end its turn and settle it later.
 */
import {
  addMemory,
  addMisconception,
  getLesson,
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
import { readMaterial as readMat, searchMaterial as searchMat } from './materials.js';
import { openPrompt, type PromptKind } from './prompts.js';
import { takeNotices } from './notices.js';

/**
 * A blocking action is the tutor's next chance to hear what happened while
 * it waited (material attached or removed), so the notice rides on its result.
 */
const withNotice = <T extends object>(lessonId: string, result: T): T & { notice?: string } => {
  const n = takeNotices(lessonId);
  return n.length ? { ...result, notice: n.join('\n') } : result;
};

const sameSet = (a: number[], b: number[]) =>
  a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i]);

export type QuizArgs = {
  question: string;
  options: string[];
  correct: number[];
  explanation: string;
  node_id?: string | null;
};

type Open<T> = { id: string; done: Promise<T> };
type OpenOpts = { hold?: boolean };

export function openQuiz(lessonId: string, a: QuizArgs, opts: OpenOpts = {}): Open<Record<string, unknown>> {
  const multi = a.correct.length > 1;
  const { id, wait } = openPrompt(lessonId, 'quiz', { question: a.question, options: a.options, multi, node_id: a.node_id ?? null }, opts);
  const done = wait.then((raw) => {
    const ans = raw as { selected?: number[]; idk?: boolean; note?: string; interrupted?: boolean; steer?: string };
    if (ans.interrupted) return { result: 'interrupted', note: 'The learner stopped the turn.' };
    if (ans.steer) {
      // The learner typed in the chat instead of picking an option. Close the
      // card without grading or revealing anything, and hand the message over.
      emit(lessonId, 'quiz_result', { id, selected: [], correct: [], explanation: '', result: 'skipped', note: ans.steer });
      return withNotice(lessonId, {
        result: 'no_answer',
        learner_message: ans.steer,
        instruction: 'The learner wrote a message instead of answering; the card is closed. Respond to the message. If the check still matters, ask it again afterwards with a fresh quiz.',
      });
    }
    const selected = (ans.idk ? [] : (ans.selected ?? [])).filter((i) => Number.isInteger(i) && i >= 0 && i < a.options.length);
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
    return withNotice(lessonId, {
      result,
      selected_options: selected.map((i) => a.options[i]),
      correct_options: a.correct.map((i) => a.options[i]),
      note: ans.note ?? null,
    });
  });
  return { id, done };
}

export const quiz = (lessonId: string, a: QuizArgs) => openQuiz(lessonId, a).done;

export function openAsk(lessonId: string, a: { question: string; options?: string[] }, opts: OpenOpts = {}): Open<Record<string, unknown>> {
  const { id, wait } = openPrompt(lessonId, 'ask', { question: a.question, options: a.options ?? [] }, opts);
  const done = wait.then((raw) => {
    const ans = raw as { text?: string; interrupted?: boolean; steer?: string };
    if (ans.interrupted) return { result: 'interrupted' };
    const answer = ans.steer ?? ans.text ?? '';
    emit(lessonId, 'ask_result', { id, text: answer });
    return withNotice(lessonId, { answer });
  });
  return { id, done };
}

export const ask = (lessonId: string, a: { question: string; options?: string[] }) => openAsk(lessonId, a).done;

export function openPlan(lessonId: string, a: { goal: string; nodes: GraphNodeInput[] }, opts: OpenOpts = {}): Open<Record<string, unknown>> {
  replaceGraph(lessonId, a.nodes);
  setGoal(lessonId, a.goal);
  const { id, wait } = openPrompt(lessonId, 'plan', { goal: a.goal, nodes: a.nodes }, opts);
  const done = wait.then((raw) => {
    const ans = raw as { approved?: boolean; feedback?: string; interrupted?: boolean; steer?: string };
    if (ans.interrupted) return { result: 'interrupted' };
    // A typed message while the plan awaits approval is feedback on it.
    const approved = ans.steer ? false : !!ans.approved;
    const feedback = ans.steer ?? ans.feedback ?? null;
    emit(lessonId, 'plan_result', { id, approved, feedback });
    return withNotice(lessonId, { approved, feedback });
  });
  return { id, done };
}

export const setPlan = (lessonId: string, a: { goal: string; nodes: GraphNodeInput[] }) => openPlan(lessonId, a).done;

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
export function openExplain(lessonId: string, a: { prompt: string; node_id?: string | null; rubric: string }, opts: OpenOpts = {}): Open<Record<string, unknown>> {
  const { id, wait } = openPrompt(lessonId, 'explain', { prompt: a.prompt, node_id: a.node_id ?? null }, opts);
  const done = wait.then((raw) => {
    const ans = raw as { text?: string; interrupted?: boolean; steer?: string };
    if (ans.interrupted) return { result: 'interrupted' };
    const explanation = ans.steer ?? ans.text ?? '';
    emit(lessonId, 'explain_result', { id, text: explanation });
    return withNotice(lessonId, {
      explanation,
      rubric: a.rubric,
      instruction: 'Grade against the rubric. Name what is right first, then the one gap that matters most. Then call node_status.',
    });
  });
  return { id, done };
}

export const explainBack = (lessonId: string, a: { prompt: string; node_id?: string | null; rubric: string }) => openExplain(lessonId, a).done;

export function remember(lessonId: string, a: { fact: string; kind?: 'learner' | 'preference' | 'strength' | 'gap' }) {
  addMemory(a.fact, a.kind ?? 'learner', lessonId);
  emit(lessonId, 'memory', { fact: a.fact, kind: a.kind ?? 'learner' });
  return { ok: true };
}

/** A range of pages, slides or files from the attached course material. */
export function readMaterial(lessonId: string, a: { name?: string | null; path?: string | null; from?: number | null; to?: number | null }) {
  return readMat(lessonId, a);
}

/** Where in the attached material something is covered. */
export function searchMaterial(lessonId: string, a: { query: string; name?: string | null; limit?: number | null }) {
  return searchMat(lessonId, a);
}

export function profile(learnerId: string, lessonId?: string) {
  return {
    profile: learnerProfile(learnerId, lessonId) || 'Nothing yet. This is a new learner.',
    memory: listMemory(learnerId).slice(0, 20).map((m) => m.fact),
    misconceptions: listMisconceptions(learnerId)
      .filter((m) => !m.resolved)
      .slice(0, 10)
      .map((m) => ({ topic: m.topic, picked: m.picked, correct: m.correct })),
  };
}

export const profileOfLesson = (lessonId: string) => {
  const l = getLesson(lessonId);
  return l ? profile(l.learner_id, lessonId) : profile('default');
};

// ---------- terminal replies ----------

const LETTERS = 'ABCDEFG';
const IDK_RE = /^\s*(?:\?+|(?:idk|i\s+don'?t\s+know|don'?t\s+know|no\s+idea|not\s+sure|no\s+s[eé]|no\s+lo\s+s[eé]|ni\s+idea|pass|skip)(?![a-z]))[\s.!,]*/i;
const QUIZ_PICK_RE = new RegExp(
  '^' +
    // "I think", "the answer is", "creo que" ...
    "(?:(?:i\\s+(?:think|say|choose|pick|guess|go\\s+with|would\\s+say)|creo\\s+que|elijo|voy\\s+con|(?:the\\s+|my\\s+)?answer(?:\\s+is)?)\\s+){0,2}" +
    // "it's", "es" ...
    "(?:(?:it'?s|it\\s+is|es|is)\\s+)?" +
    // "option", "the", "la" ...
    '(?:(?:option|opci[oó]n|the|la|el)\\s+)?' +
    // the pick(s): a letter or a number, possibly several joined by "and", "," or "+"
    '([a-g1-9](?:\\s*(?:,|\\+|&|and|y)\\s*[a-g1-9])*)(?![a-z0-9])' +
    // what separates the pick from a note, then the note
    '([\\s).:,\\]-]*)([\\s\\S]*)$',
  'i',
);
const YES_RE = /^\s*(y|yes|yep|yeah|ok|okay|sure|approve[d]?|approved|looks?\s+(good|right|fine)|go|go\s+ahead|teach\s+me|s[ií]|dale|vamos|adelante|perfecto|de\s+acuerdo)\b[\s.!,]*$/i;

/**
 * What a learner types in a terminal in reply to a card, turned into the
 * same answer shape the browser sends. A quiz reply is a letter or a number
 * ("B", "2", "a and c"), optionally followed by a note; "?" or "I don't
 * know" is the don't-know option; anything else is a message to the tutor
 * rather than an answer, and closes the card ungraded as the browser does.
 */
export function parseReply(kind: PromptKind, reply: string, optionCount: number): Record<string, unknown> {
  const text = reply.trim();
  switch (kind) {
    case 'quiz': {
      if (IDK_RE.test(text)) return { idk: true, note: text.replace(IDK_RE, '').trim() || undefined };
      // "B", "b)", "2.", "A and C", "1, 3", "option b", "I think it's B", "B because ..."
      const head = QUIZ_PICK_RE.exec(text);
      if (head) {
        const picks = head[1]
          .split(/\s*(?:,|\+|&|and|y)\s*/i)
          .map((t) => t.trim().toLowerCase())
          .map((t) => (/^[a-g]$/.test(t) ? t.charCodeAt(0) - 97 : Number(t) - 1));
        const sep = head[2];
        const note = head[3].trim();
        // A bare letter followed by a sentence ("a car is not a fruit") is a message, not a pick;
        // "B, because ..." and "B) it has to" are picks with a note.
        const ambiguous = picks.length === 1 && /^[a-g]$/i.test(head[1]) && !/[).:,\]-]/.test(sep) && /^[a-z]/i.test(note) && !/^(because|since|as|porque|ya que)\b/i.test(note);
        if (!ambiguous && picks.every((i) => Number.isInteger(i) && i >= 0 && i < optionCount)) {
          return { selected: [...new Set(picks)].sort((x, y) => x - y), note: note || undefined };
        }
      }
      return { steer: text };
    }
    case 'plan':
      return YES_RE.test(text) ? { approved: true } : { approved: false, feedback: text };
    default:
      return { text };
  }
}

/** The card as text, for a driver that shows it in a terminal. */
export function renderCard(kind: PromptKind, payload: Record<string, unknown>, nodeLabel?: string | null): string {
  switch (kind) {
    case 'quiz': {
      const p = payload as { question: string; options: string[]; multi: boolean };
      const opts = p.options.map((o, i) => `${LETTERS[i]}. ${o}`).join('\n');
      const letters = p.options.map((_, i) => LETTERS[i]);
      const how = p.multi
        ? `Reply with every letter that applies (${letters.join(', ')}), or ? if you don't know.`
        : `Reply with ${letters.slice(0, -1).join(', ')} or ${letters.at(-1)}, or ? if you don't know.`;
      return `**Quiz${nodeLabel ? ` · checks: ${nodeLabel}` : ''}**\n\n${p.question}\n\n${opts}\n\n_${how}_`;
    }
    case 'ask': {
      const p = payload as { question: string; options: string[] };
      const opts = p.options.length ? '\n\n' + p.options.map((o, i) => `${i + 1}. ${o}`).join('\n') + '\n\n_Reply with a number or in your own words._' : '';
      return `**Your call**\n\n${p.question}${opts}`;
    }
    case 'plan': {
      const p = payload as { goal: string; nodes: GraphNodeInput[] };
      const truths = p.nodes.filter((n) => n.kind === 'truth');
      const rest = p.nodes.filter((n) => n.kind !== 'truth');
      const line = (n: GraphNodeInput) => `- ${n.kind === 'goal' ? 'Goal: ' : ''}${n.label}${n.summary ? ` — ${n.summary}` : ''}`;
      return `**The plan**\n\nGoal: ${p.goal}\n\nGround truths (accepted as-is):\n${truths.map(line).join('\n')}\n\nDerived steps (each built from the ones below it):\n${rest.map(line).join('\n')}\n\n_Reply "yes" to approve, or say what should change._`;
    }
    case 'explain': {
      const p = payload as { prompt: string };
      return `**Teach it back${nodeLabel ? ` · ${nodeLabel}` : ''}**\n\n${p.prompt}\n\n_Reply in your own words, two to five sentences._`;
    }
  }
}
