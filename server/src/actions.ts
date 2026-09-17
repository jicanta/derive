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
  cumulativeStatus,
  dueNodes,
  getLesson,
  getNode,
  hasUnderstandingPass,
  learnerProfile,
  updateLearnerPrefs,
  getLearner,
  listEvents,
  listNodes,
  listMisconceptions,
  listMemory,
  nodeRecord,
  QUIZ_TESTS,
  recordQuiz,
  replaceGraph,
  resolveMisconceptions,
  setGoal,
  setNodeStatus,
  setPhase,
  type GraphNodeInput,
  type QuizPurpose,
  type QuizTests,
} from './db.js';
import type { Confidence } from './schedule.js';
import { emit } from './events.js';
import { addResource, describeResource, readResource as readRes, relatedResources, resolveResource, searchLibrary as searchLib, tagsOf } from './library.js';
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
  /** What the question is for. Default: 'review' on a node copied from an earlier lesson, 'probe' in the probe phase, else 'check'. */
  purpose?: QuizPurpose | null;
  /** What the question tests: intuition (why it must be so), procedure (the steps), transfer (a problem type not seen in the lesson). */
  tests?: QuizTests | null;
};

export const QUIZ_PURPOSES: QuizPurpose[] = ['probe', 'pretest', 'check', 'cumulative', 'review'];
export { QUIZ_TESTS };

/** A question's purpose, defaulted from where the lesson is. */
function purposeOf(lessonId: string, nodeId: string | null | undefined, given?: QuizPurpose | null): QuizPurpose {
  if (given && QUIZ_PURPOSES.includes(given)) return given;
  // A node copied from an earlier lesson (a warm-up, or a review session's graph) is being reviewed whatever the phase says.
  const nodes = listNodes(lessonId);
  if (nodeId && nodes.find((n) => n.node_id === nodeId)?.source_lesson) return 'review';
  if (nodes.length && nodes.every((n) => n.source_lesson)) return 'review';
  const lesson = getLesson(lessonId);
  if (lesson?.phase === 'probe') return 'probe';
  return 'check';
}

/** Sanity: a question's `tests` field, or null when absent or unknown. */
const testsOf = (given?: QuizTests | null): QuizTests | null => (given && QUIZ_TESTS.includes(given) ? given : null);

/**
 * What the tutor should do with the result. Confidence is what makes a
 * check informative: a confident miss is a held belief (and the moment it
 * can be replaced, the hypercorrection effect), an unsure pass is not yet
 * knowledge, a pretest miss is expected and is never held against the
 * learner. Hints come before re-derivations, and answers are never handed
 * over.
 */
function afterQuiz(
  result: 'correct' | 'incorrect' | 'dont_know',
  confidence: Confidence | null,
  purpose: QuizPurpose,
  ctx: { lessonId: string; nodeId: string | null; tests: QuizTests | null },
): string | undefined {
  if (purpose === 'cumulative') return afterCumulative(result, confidence, ctx);
  if (purpose === 'pretest') {
    return result === 'correct'
      ? 'Pretest: they reached it before being taught. Do not lock the node on this. Say what their reasoning got right, establish the node properly but briefly (they are close), then check it with a fresh quiz.'
      : 'Pretest: a miss here is expected and is the point (a real attempt before instruction makes the correction stick). It is not recorded against them; do not lock or mark anything. Teach the node now, immediately, starting from their guess: name what made it tempting, then derive the correct claim from the nodes below it.';
  }
  if (purpose === 'probe') {
    return result === 'incorrect' && confidence === 'sure'
      ? 'A confident miss in the probe: more likely a misconception than a slip. Probe around it once, and plan to address it explicitly.'
      : undefined;
  }
  if (result === 'correct') {
    if (confidence === 'unsure') {
      return 'Correct, but they said they were unsure, so this is not yet knowledge. Do not lock the node on this alone: have them say why the answer must be so (explain_back with a two-line rubric) or ask one more fresh quiz on the same claim, and lock only after that.';
    }
    if (purpose === 'review') return 'Correct and confident. Call node_status(id, "locked") to reschedule it, then move to the next node with at most one line in between.';
    if (ctx.nodeId && needsUnderstanding(ctx.lessonId, ctx.nodeId)) {
      return (
        `Correct and confident, but so far this node has only been tested on ${ctx.tests === 'procedure' ? 'procedure' : 'recall'} (${nodeRecord(ctx.lessonId, ctx.nodeId)}). ` +
        'Knowing the steps is not understanding them: before you lock it, ask ONE fresh quiz with tests: "intuition" (why this must be so, what breaks if a premise changes, which picture or geometric reading is right, an estimate before any computation) or tests: "transfer" (a problem of a kind this lesson has not shown). Lock only after that passes.'
      );
    }
    return 'Correct and confident. Lock the node if this was its check, then move on.';
  }
  if (result === 'dont_know') {
    return 'They did not know. Do not reveal the derivation yet: give one hint that points at the node this rests on, then a fresh quiz on the same claim. If that misses too, re-derive it from its dependencies step by step and mark the node shaky.';
  }
  return confidence === 'sure'
    ? 'A confident error: they committed to the wrong claim and were sure of it. This is the moment a belief can actually be replaced, so do not just restate the right answer. Name the exact claim they held and why it was tempting, then show what breaks it, from the nodes below. Re-check with a fresh quiz before locking; if that misses too, mark the node shaky and re-derive from its dependencies.'
    : 'A miss, and they knew they were unsure. Give one hint that points at the dependency that decides it (not the answer) and let them try a fresh quiz on the same claim. If that misses too, re-derive it from its dependencies and mark the node shaky.';
}

/** A derived node is locked on understanding, not on steps: it needs a correct intuition or transfer question after the teaching. */
function needsUnderstanding(lessonId: string, nodeId: string): boolean {
  const node = getNode(lessonId, nodeId);
  if (!node || node.kind === 'truth' || node.source_lesson) return false;
  return !hasUnderstandingPass(lessonId, nodeId);
}

/**
 * The end-of-lesson quiz. Every node was locked minutes ago; a miss now is
 * the honest signal that it did not stay locked, so the server marks it
 * shaky at once (a lapse for its schedule) and sends the tutor back to the
 * nodes it rests on, not to the answer.
 */
function afterCumulative(result: 'correct' | 'incorrect' | 'dont_know', confidence: Confidence | null, ctx: { lessonId: string; nodeId: string | null }): string {
  const remaining = () => {
    const { pending, missed } = cumulativeStatus(ctx.lessonId);
    const left = [...pending, ...missed].map((n) => `${n.label} [${n.node_id}]`);
    return left.length ? `Still to cover in this quiz: ${left.join('; ')}.` : 'That was the last one: every node held. Write the closing now (the compressed version of the whole graph, the click named), then store 1 to 3 notes with remember and ask what they want next.';
  };
  if (result === 'correct') {
    if (confidence === 'unsure') return `Correct but unsure. One more fresh question on this node before moving on (a different angle: if this was procedure, ask for the why). ${remaining()}`;
    return `Held. Next question, at most one line between. ${remaining()}`;
  }
  if (!ctx.nodeId) return `A miss. Re-ask the claim with a hint that names the node it rests on. ${remaining()}`;
  const node = getNode(ctx.lessonId, ctx.nodeId);
  if (node && node.status === 'locked') {
    const next = setNodeStatus(ctx.lessonId, ctx.nodeId, 'shaky');
    emit(ctx.lessonId, 'node_status', { id: ctx.nodeId, status: 'shaky', ...(next ? { review_at: next.review_at, interval_days: next.interval_days, implicit: next.implicit } : {}) });
  }
  const deps = dependencyRecord(ctx.lessonId, ctx.nodeId);
  const held = confidence === 'sure' ? 'They were sure of the wrong claim: name the exact claim they held and what breaks it, from the nodes below, before anything else. ' : '';
  return (
    `A miss on the cumulative quiz: "${node?.label ?? ctx.nodeId}" did not stay locked, so it is now marked shaky (its review moved closer). ${held}` +
    `Targeted remediation, not a re-explanation: ${deps} Re-check the weakest of those with one fresh quiz (tests: "intuition"); once it holds, re-derive this node from it in two or three sentences and ask a fresh question on this node again (purpose "cumulative"). It locks again only when that passes. ${remaining()}`
  );
}

/** The nodes a node rests on and what the checks on each have shown, for a remediation instruction. */
function dependencyRecord(lessonId: string, nodeId: string): string {
  const node = getNode(lessonId, nodeId);
  const nodes = new Map(listNodes(lessonId).map((n) => [n.node_id, n]));
  const deps = (JSON.parse(node?.depends_on || '[]') as string[]).map((d) => nodes.get(d)).filter((d): d is NonNullable<typeof d> => !!d);
  if (!deps.length) return 'It is a ground truth: nothing below it, so re-state it and ask a fresh question on it directly.';
  return `it rests on ${deps.map((d) => `"${d.label}" [${d.node_id}] (${d.status}; ${nodeRecord(lessonId, d.node_id)})`).join(', ')}.`;
}

type Open<T> = { id: string; done: Promise<T> };
type OpenOpts = { hold?: boolean };

export function openQuiz(lessonId: string, a: QuizArgs, opts: OpenOpts = {}): Open<Record<string, unknown>> {
  const multi = a.correct.length > 1;
  const purpose = purposeOf(lessonId, a.node_id, a.purpose);
  const tests = testsOf(a.tests);
  const { id, wait } = openPrompt(lessonId, 'quiz', { question: a.question, options: a.options, multi, node_id: a.node_id ?? null, purpose, tests }, opts);
  const done = wait.then((raw) => {
    const ans = raw as { selected?: number[]; idk?: boolean; sure?: boolean; note?: string; interrupted?: boolean; steer?: string };
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
    // The learner commits to how sure they are before the reveal. Default is sure: an unsure answer is a deliberate flag.
    const confidence: Confidence | null = ans.idk ? null : ans.sure === false ? 'unsure' : 'sure';
    emit(lessonId, 'quiz_result', { id, selected, correct: a.correct, explanation: a.explanation, result, note: ans.note ?? null, confidence, purpose, tests });
    recordQuiz(lessonId, a.node_id ?? null, isCorrect, { confidence, purpose, tests });
    // A pretest miss is the learner's honest guess before instruction, not a belief they hold.
    if (result === 'incorrect' && purpose !== 'pretest') {
      addMisconception({
        lessonId,
        nodeId: a.node_id ?? null,
        question: a.question,
        picked: selected.map((i) => a.options[i]).join(' + '),
        correct: a.correct.map((i) => a.options[i]).join(' + '),
        explanation: a.explanation,
        confidence,
      });
    }
    const instruction = afterQuiz(result, confidence, purpose, { lessonId, nodeId: a.node_id ?? null, tests });
    return withNotice(lessonId, {
      result,
      confidence,
      purpose,
      tests,
      selected_options: selected.map((i) => a.options[i]),
      correct_options: a.correct.map((i) => a.options[i]),
      note: ans.note ?? null,
      ...(instruction ? { instruction } : {}),
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
    return withNotice(lessonId, { approved, feedback, ...(approved ? planLibraryInstruction(lessonId, a) : {}) });
  });
  return { id, done };
}

export const setPlan = (lessonId: string, a: { goal: string; nodes: GraphNodeInput[] }) => openPlan(lessonId, a).done;

/**
 * A node's state change. Locking is refused for a derived node that has
 * only ever been tested on its steps: mastery here means the learner can
 * say why the claim must be so or use it where the lesson did not show it,
 * so the tutor is sent back for one intuition or transfer question first.
 * Locking the goal opens the cumulative quiz; marking a node shaky names
 * the nodes below it and what the checks on each have shown, so the
 * remediation is targeted at the weakest one instead of re-telling.
 */
export function nodeStatus(lessonId: string, a: { id: string; status: 'teaching' | 'locked' | 'shaky' }) {
  const node = getNode(lessonId, a.id);
  if (!node) return { ok: false, refused: true, error: `No node "${a.id}" in this lesson's graph.` };
  if (a.status === 'locked' && needsUnderstanding(lessonId, a.id)) {
    return {
      ok: false,
      refused: true,
      error:
        `Not locked. "${node.label}" is a derived claim and the checks on it so far (${nodeRecord(lessonId, a.id)}) only show recall or procedure. ` +
        'A node locks on understanding: ask one fresh quiz on it with tests: "intuition" (why it must be so, what breaks if a premise changes, the right picture, an estimate before computing) or tests: "transfer" (a problem of a kind this lesson has not shown), passing node_id and purpose "check". Then call node_status again. This is the method, not an error to investigate.',
    };
  }
  const next = setNodeStatus(lessonId, a.id, a.status);
  if (a.status === 'locked') resolveMisconceptions(lessonId, a.id);
  const when = next ? { review_at: next.review_at, interval_days: next.interval_days, implicit: next.implicit } : {};
  emit(lessonId, 'node_status', { id: a.id, status: a.status, ...when });
  const credited = next?.implicit.filter((c) => c.kind === 'credit') ?? [];
  const extra: Record<string, unknown> = {};
  if (a.status === 'locked' && next) {
    extra.next_review_in_days = next.interval_days;
    if (credited.length) extra.implicit_review = `Locking this counted as a partial review of ${credited.map((c) => `"${c.label}" (now due in ${c.interval_days} days)`).join(', ')}.`;
  }
  if (a.status === 'shaky') {
    extra.instruction =
      `Shaky. Targeted remediation, not a re-explanation: ${dependencyRecord(lessonId, a.id)} ` +
      'Re-check the weakest of those with one fresh quiz (tests: "intuition"); once it holds, re-derive this node from it, one step at a time, and check this node again with a fresh question. Lock it only when that passes.';
  }
  if (a.status === 'locked' && node.kind === 'goal') {
    const { pending } = cumulativeStatus(lessonId);
    const left = pending.filter((n) => n.node_id !== a.id);
    if (left.length) {
      extra.instruction =
        `The goal is locked, and the lesson is not over: run the cumulative quiz now. One fresh quiz per node, purpose "cumulative", each with its node_id, in a mixed order (never the order they were taught, never two neighbours in the graph back to back), at least half of them tests: "transfer" (a problem of a kind the lesson has not shown) and the rest tests: "intuition". Nodes to cover: ${left.map((n) => `${n.label} [${n.node_id}]`).join('; ')}; then the goal itself [${a.id}]. ` +
        'Say in one sentence that this is the last pass over everything, then ask the first question. Keep prose between questions to one line. A miss there is handled by the result you get back. The closing (the compressed version of the whole graph) comes only after every node has held.';
    }
  }
  return { ok: true, ...extra, ...libraryHint(lessonId, a) };
}

const suggestedIds = (lessonId: string) =>
  listEvents(lessonId)
    .filter((e) => e.type === 'resource')
    .map((e) => (e.payload as { id?: string }).id ?? '');

/**
 * The plan just got approved: if the shelf holds entries on this topic, the
 * tutor is told to read the best one before teaching and to point to it
 * when the node it fits locks. A tool result is where the model actually
 * reads instructions, so this is where the library rule gets its teeth.
 */
function planLibraryInstruction(lessonId: string, a: { goal: string; nodes: GraphNodeInput[] }): { instruction?: string } {
  const lesson = getLesson(lessonId);
  if (!lesson) return {};
  const text = `${lesson.topic} ${a.goal} ${a.nodes.map((n) => n.label).join(' ')}`;
  const related = relatedResources(lesson.learner_id, text, suggestedIds(lessonId), 3);
  if (!related.length) return {};
  return {
    instruction:
      `The plan is approved. The learner's library has entries on this topic: ${related.map(describeResource).join('; ')}. ` +
      'Before you teach the first node, read the most relevant one (read_resource, by id) and borrow its examples and framing where they are good. ' +
      'Then, when the node it fits best locks, point the learner to it with suggest_resource (why, and where to look). The learner put it there to be used; not pointing to it at all is the failure mode.',
  };
}

/**
 * A locked node is the moment a library entry earns its place. If the shelf
 * holds an entry related to the node (or the topic) that has not been
 * suggested in this lesson, the reply tells the tutor to suggest it now.
 */
function libraryHint(lessonId: string, a: { id: string; status: string }): { instruction?: string } {
  if (a.status !== 'locked') return {};
  const lesson = getLesson(lessonId);
  const node = getNode(lessonId, a.id);
  if (!lesson || !node) return {};
  const related = relatedResources(lesson.learner_id, `${node.label} ${node.summary ?? ''} ${lesson.topic}`, suggestedIds(lessonId), 1);
  if (!related.length) return {};
  return {
    instruction:
      `Locked. The learner's library has ${describeResource(related[0])}, related to this node and not yet pointed to in this lesson. ` +
      'Call suggest_resource for it now, before the next node: one or two sentences on what it adds to what just locked, and where to look (a section, a timestamp). Skip only if it clearly does not bear on this node.',
  };
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

// ---------- the library ----------

const learnerOfLesson = (lessonId: string) => {
  const l = getLesson(lessonId);
  if (!l) throw new Error('lesson not found');
  return l.learner_id;
};

/** Entries of the learner's library that match, by title, tags, note and fetched text. */
export function searchLibrary(lessonId: string, a: { query: string; kind?: string | null; tag?: string | null; limit?: number | null }) {
  return searchLib(learnerOfLesson(lessonId), a);
}

/** A range of parts of one library entry. */
export function readResource(lessonId: string, a: { id?: string | null; title?: string | null; from?: number | null; to?: number | null }) {
  return readRes(learnerOfLesson(lessonId), a);
}

/**
 * Point the learner at an entry of their library (or one the tutor just
 * saved): a card in the timeline with the tutor's reason and where to look.
 */
export function suggestResource(lessonId: string, a: { id?: string | null; title?: string | null; why: string; where?: string | null; node_id?: string | null }) {
  const r = resolveResource(learnerOfLesson(lessonId), a.id ?? a.title);
  const why = String(a.why ?? '').trim();
  if (!why) throw new Error('Say why this entry is worth their time (one or two sentences).');
  emit(lessonId, 'resource', {
    action: 'suggested',
    id: r.id,
    kind: r.kind,
    title: r.title,
    url: r.url,
    author: r.author,
    tags: tagsOf(r),
    why: why.slice(0, 600),
    where: a.where?.trim().slice(0, 200) || null,
    node_id: a.node_id ?? null,
  });
  return { ok: true, id: r.id, title: r.title, url: r.url, instruction: 'The card is shown. One sentence of prose about it at most; do not repeat the reason.' };
}

/** The tutor saves a source it found to the learner's library; the timeline shows it was saved. */
export async function saveResource(lessonId: string, a: { url?: string | null; title?: string | null; kind?: string | null; author?: string | null; note?: string | null; tags?: unknown }) {
  const learnerId = learnerOfLesson(lessonId);
  const { resource, existing } = await addResource(learnerId, a, { addedBy: 'tutor', lessonId });
  emit(lessonId, 'resource', {
    action: existing ? 'already_saved' : 'saved',
    id: resource.id,
    kind: resource.kind,
    title: resource.title,
    url: resource.url,
    author: resource.author,
    tags: tagsOf(resource),
    why: resource.note,
    where: null,
    node_id: null,
  });
  return {
    ok: true,
    existing,
    id: resource.id,
    title: resource.title,
    kind: resource.kind,
    url: resource.url,
    fetched_words: Math.round(resource.chars / 6),
    ...(resource.fetch_error ? { fetch_error: resource.fetch_error } : {}),
    instruction: existing ? 'This was already on the shelf; your note and tags were merged into it.' : 'Saved. Mention it in one sentence if it matters now; the learner sees it in their library.',
  };
}

/**
 * The learner's own account of how they want to be taught. Theirs, not the
 * tutor's: the tutor writes here only what the learner said, in their words.
 */
export function setPreferences(lessonId: string, a: { language?: string; style?: string; pace?: string; background?: string; how?: string; examples?: string }) {
  const lesson = getLesson(lessonId);
  if (!lesson) throw new Error('lesson not found');
  const learner = updateLearnerPrefs(lesson.learner_id, a);
  emit(lessonId, 'preferences', learner.prefs);
  return { ok: true, preferences: learner.prefs, instruction: 'Saved for every lesson from now on. Apply it from your next message; no need to announce it beyond one short sentence.' };
}

const getLearnerPrefs = (learnerId: string) => getLearner(learnerId)?.prefs ?? {};

export function profile(learnerId: string, lessonId?: string) {
  return {
    profile: learnerProfile(learnerId, lessonId) || 'Nothing yet. This is a new learner.',
    preferences: getLearnerPrefs(learnerId),
    memory: listMemory(learnerId).slice(0, 20).map((m) => m.fact),
    misconceptions: listMisconceptions(learnerId)
      .filter((m) => !m.resolved)
      .slice(0, 10)
      .map((m) => ({ topic: m.topic, picked: m.picked, correct: m.correct, held_with_confidence: m.confidence === 'sure' })),
    due: dueNodes(learnerId).map((n) => ({ label: n.label, topic: n.topic, overdue_days: Math.max(0, Math.floor((Date.now() - (n.review_at ?? Date.now())) / 86_400_000)) })),
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
/** "not sure", "guessing", "?" after a pick, "creo que": the learner flagging an answer as unsure. */
const UNSURE_PREFIX_RE = /^\s*(?:i\s+(?:think|guess|believe)|i'?m\s+not\s+sure(?:\s+but)?|not\s+sure(?:\s+but)?|creo\s+que|me\s+parece(?:\s+que)?|probably|maybe|quiz[aá]s?|tal\s+vez)(?![a-z])/i;
const UNSURE_NOTE_RE = /^(?:\?+|not\s+(?:so\s+|too\s+|really\s+)?sure|unsure|(?:just\s+)?(?:a\s+)?(?:wild\s+)?guess(?:ing)?|maybe|probably|i\s+think|(?:no\s+)?(?:estoy\s+)?(?:muy\s+)?segur[oa]|creo|quiz[aá]s?|tal\s+vez|puede\s+ser|dudo|adivin(?:o|ando))(?![a-z])[\s.!,:;-]*(?:(?:but|pero|and|y)(?![a-z])[\s.!,:;-]*)?/i;

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
          // "B?", "B, not sure", "I think B", "b guess": a pick the learner is unsure of.
          let rest = note;
          let unsure = UNSURE_PREFIX_RE.test(text);
          if (UNSURE_NOTE_RE.test(rest)) {
            unsure = true;
            rest = rest.replace(UNSURE_NOTE_RE, '').trim();
          }
          return { selected: [...new Set(picks)].sort((x, y) => x - y), sure: !unsure, note: rest || undefined };
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
      const p = payload as { question: string; options: string[]; multi: boolean; purpose?: QuizPurpose };
      const opts = p.options.map((o, i) => `${LETTERS[i]}. ${o}`).join('\n');
      const letters = p.options.map((_, i) => LETTERS[i]);
      const last = letters.at(-1);
      const how = p.multi
        ? `Reply with every letter that applies (${letters.join(', ')}); add ? after them if you're unsure, or ? alone if you don't know.`
        : `Reply with ${letters.slice(0, -1).join(', ')} or ${last} (${last}? if you're unsure), or ? alone if you don't know.`;
      const head = p.purpose === 'pretest' ? `**Before I explain · your best guess${nodeLabel ? `: ${nodeLabel}` : ''}**\n\n_A miss is fine here; try, then I explain._` : `**Quiz${nodeLabel ? ` · checks: ${nodeLabel}` : ''}**`;
      return `${head}\n\n${p.question}\n\n${opts}\n\n_${how}_`;
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
