/**
 * The teaching system prompt, and the turn prompts around it. Adapted from the
 * `teach` + `quiz` skills of amosblomqvist/learn, rewritten for a UI where
 * quizzes, plans and node states are first-class tools instead of chat
 * conventions.
 *
 * The method itself is no longer written here: it lives once in `method/` and is
 * rendered into `./method.generated.js`, which the plugin skill and both Codex
 * skills are rendered from too. What stays in this file is the app's own
 * assembly of it and the turn prompts, which are not method text.
 */
import type { WarmupNode } from './db.js';
import { METHOD_BODY, METHOD_PREAMBLE } from './method.generated.js';

/** The teaching method as the app's tutor reads it: the app surface's preamble, then the shared method body, both rendered from `method/` by `pnpm method`. */
const PROMPT = `${METHOD_PREAMBLE}

${METHOD_BODY}
`;

/** The teaching system prompt for a backend: the same method, naming that backend's own web tools. */
export function systemPrompt(backend: 'claude' | 'codex'): string {
  const web = backend === 'codex' ? 'Web search (your built-in `web_search`)' : '`WebSearch` / `WebFetch`';
  return PROMPT.replaceAll('{{WEB_TOOLS}}', web);
}

/**
 * The warm-up of a lesson: the due nodes from earlier lessons most likely
 * forgotten, retrieved before anything new. Sent to the app's tutor inside
 * its first turn and returned to a plugin session from start_lesson.
 */
export function warmupBrief(nodes: WarmupNode[]): string {
  const days = (n: WarmupNode) => Math.max(0, Math.floor((Date.now() - (n.review_at ?? Date.now())) / 86_400_000));
  const list = nodes
    .map((n) => {
      const deps = n.deps.length ? ` Derived from: ${n.deps.map((d) => d.label).join(', ')}.` : ' A ground truth.';
      return `- [${n.review_id}] ${n.label} (from "${n.topic}", due ${days(n) ? `${days(n)} days ago` : 'today'}, about ${Math.round(n.retrievability * 100)}% likely still recalled)${n.summary ? `: ${n.summary}` : ''}.${deps}`;
    })
    .join('\n');
  return `Warm-up first: these nodes from earlier lessons are due, listed with the most likely forgotten first, and they come before the probe. For each, with at most one line of prose before it, ask ONE fresh \`quiz\` (\`purpose: "review"\`, the id in brackets as \`node_id\`, \`tests: "transfer"\` or \`"intuition"\`) that makes them apply the claim in a new setting rather than recognise it. Correct and sure -> \`node_status(id, "locked")\` (this reschedules the original). Correct but unsure -> one more fresh question, then lock. A miss -> one hint that names what it was derived from, then a fresh question; a second miss -> \`node_status(id, "shaky")\` and move on (it comes back in a review session; do not re-teach it now). Say in one sentence that you are starting with what is due, then ask. Keep it short: this is retrieval, not a lesson.
${list}`;
}

export function firstTurnPrompt(topic: string, materials: string[] = [], warmup: WarmupNode[] = []) {
  const mat = materials.length
    ? `\n\nThey attached course material for this: ${materials.join('; ')}. Read the relevant parts (the system prompt has the outline or the full text) before you plan, so the plan covers what the course covers in its own notation, and probe the prerequisites the material assumes rather than the topic in general. Tell the learner in one sentence that you have read it.`
    : '';
  const warm = warmup.length ? `\n\n${warmupBrief(warmup)}\n\nWhen the warm-up is done (every node locked or marked shaky), start the lesson proper.` : '';
  return `The learner wants to learn: "${topic}".${mat}${warm}

${warmup.length ? 'Then begin' : 'Start the lesson. Begin'} with phase 1 (probe): announce the phase, briefly greet in one sentence, then use \`ask\` to pin down their concrete goal, and use \`quiz\` repeatedly to locate the edge of their understanding on the strands the topic rests on: a floor and a ceiling on each, prerequisites included, nothing assumed. Only then plan.`;
}

/** Sent as a turn (or prepended to the next one) when material is attached to a lesson already under way. */
export function materialAttachedPrompt(description: string) {
  return `The learner just attached course material to this lesson: ${description}. Read what it covers (the system prompt now lists it; use read_material or search_material for the details). Then tell them in two or three sentences what changes: which nodes of the plan it covers, what it adds, whether the goal should move. If the plan should change, call set_plan again with the revised map; otherwise carry on where you were, now using the material's notation and examples.`;
}

export type ReviewDue = {
  review_id: string;
  label: string;
  summary: string | null;
  topic: string;
  review_at: number | null;
  deps: { id: string; label: string; status: string }[];
};

/**
 * A review session: retrieval first, hints before re-derivation, topics
 * interleaved. The nodes arrive already interleaved across topics; each
 * carries the nodes it was derived from, which are in this lesson's graph
 * too, so a miss can be rebuilt from the ground instead of re-told.
 */
export function reviewTurnPrompt(nodes: ReviewDue[]) {
  const days = (n: ReviewDue) => Math.max(0, Math.floor((Date.now() - (n.review_at ?? Date.now())) / 86_400_000));
  const list = nodes
    .map((n) => {
      const deps = n.deps.length ? ` Derived from: ${n.deps.map((d) => `${d.label} [${d.id}]`).join(', ')}.` : ' A ground truth (nothing below it).';
      return `- [${n.review_id}] ${n.label} (from "${n.topic}", due ${days(n) ? `${days(n)} days ago` : 'today'})${n.summary ? `: ${n.summary}` : ''}.${deps}`;
    })
    .join('\n');
  return `Spaced-repetition review session. These nodes were locked earlier and are due; they are listed in the order to take them, which mixes topics on purpose (switching frames each time is part of the exercise, so keep the order):
${list}

Call \`set_phase("teach")\`. Retrieval comes first: for each node, with at most one line of prose before it, ask ONE fresh \`quiz\` (\`purpose: "review"\`, the node id as \`node_id\`, \`tests: "transfer"\` or \`"intuition"\`) that makes them apply the claim in a new setting rather than recognise it: a new example, a consequence, a case where a tempting near-miss claim would give a different answer. Never a question used before.
- Correct and sure -> \`node_status(id, "locked")\` (this reschedules it), then straight to the next node.
- Correct but unsure -> one more fresh question, or ask why it must be so (\`explain_back\`), then lock.
- A miss or "I don't know" -> a hint that points at the node it was derived from (named above), then a fresh question. If that misses too, re-derive the claim from those nodes step by step (they are in the graph), then \`node_status(id, "shaky")\`.
- A confident miss -> name the exact claim they held and what breaks it, from the nodes below, before the fresh question.
Keep prose minimal between questions; a review is not a lesson. Finish with two sentences on what held and what needs work, and \`ask\` nothing.`;
}
