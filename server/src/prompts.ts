import { randomUUID } from 'node:crypto';
import {
  insertPrompt,
  openPromptRow,
  promptRow,
  settlePromptRow,
  unsettledPromptRows,
  type PromptRow,
} from './db.js';
import { emit } from './events.js';
import { redactDeep } from './secrets.js';

/**
 * Prompts are tool calls that wait for the learner: a quiz, an open
 * question, a plan approval, a teach-back. Both the in-process agent and
 * the Claude Code plugin (through the HTTP API) open prompts here.
 *
 * A prompt is normally answered within the turn that opened it. A *held*
 * prompt outlives its turn: in a companion lesson answered from the
 * terminal, the tool returns at once, the model shows the card and ends its
 * turn, and the learner's next message (or a click in the browser) settles
 * it. Ending a turn cancels ordinary prompts and keeps held ones.
 *
 * The card itself lives in the `prompts` table, and that table is the only
 * answer to "is a card open on this lesson" — which is what makes a card
 * survive a restart instead of dying with the process that opened it. What
 * cannot be persisted is the other half: the Promise the blocking tool is
 * awaiting, whose resolver is a closure in this process's heap. So the Map
 * below holds resolvers and nothing else. It is never consulted about
 * openness, and after a restart it is empty while the table still knows the
 * card is there; the route that answers a restored card reads the row's
 * grading context back through `promptPayload` rather than reviving a
 * closure that is gone.
 */

type Resolver = (answer: Record<string, unknown>) => void;
export type PromptKind = 'quiz' | 'ask' | 'plan' | 'explain';
/** The un-persistable half of an open prompt: the resolver the blocking tool is parked on. */
const live = new Map<string, Resolver>();

/**
 * Open a card. The event is the learner-safe half and is all the browser
 * ever reads; the row is where the grading half goes — `opts.key` carries a
 * quiz's answer key and explanation, or a teach-back's rubric, and never
 * reaches an event, a route response, an export or the vault mirror.
 */
export function openPrompt(
  lessonId: string,
  kind: PromptKind,
  payload: Record<string, unknown>,
  opts: { hold?: boolean; key?: Record<string, unknown> } = {},
) {
  const id = randomUUID();
  // Written through redactDeep so the table inherits the event log's scrubbing
  // rather than opting out of it; the answer key is not key-shaped, so it survives.
  insertPrompt({ id, lessonId, kind, payload: redactDeep({ ...payload, ...(opts.key ?? {}) }), held: opts.hold });
  emit(lessonId, kind, { id, ...payload });
  const wait = new Promise<Record<string, unknown>>((resolve) => {
    live.set(id, resolve);
  });
  return { id, wait };
}

/** Settle a card. True when there was an open row with that id on that lesson; the live tool, if this process opened it, is released. */
export function answerPrompt(lessonId: string, promptId: string, answer: Record<string, unknown>): boolean {
  const row = promptRow(promptId);
  if (!row || row.lesson_id !== lessonId) return false;
  if (!settlePromptRow(promptId, { answer })) return false;
  resolve(promptId, answer);
  return true;
}

/** Whether a card is open on this lesson. Reads the table, so a restart does not change the answer. */
export function hasPending(lessonId: string) {
  return !!openPromptRow(lessonId);
}

export function pendingId(lessonId: string): string | null {
  return openPromptRow(lessonId)?.id ?? null;
}

export function pendingPrompt(lessonId: string): { id: string; kind: PromptKind; held: boolean } | null {
  const row = openPromptRow(lessonId);
  return row ? { id: row.id, kind: row.kind as PromptKind, held: !!row.held } : null;
}

/** Cancel a lesson's open prompts. Held prompts survive unless asked for — now a column predicate rather than a walk of a map. */
export function cancelPending(lessonId: string, opts: { held?: boolean } = {}) {
  for (const row of unsettledPromptRows(lessonId)) {
    if (row.held && !opts.held) continue;
    if (!settlePromptRow(row.id, { answer: { interrupted: true } })) continue;
    resolve(row.id, { interrupted: true });
  }
}

/**
 * Everything a card was opened with, the answer key included.
 *
 * Server-side only: no route may project this, no event may carry it and no
 * export may mirror it. It exists so the grading path can re-derive what a
 * card asked — including for a card this process did not open, which is the
 * whole point of the row outliving the Promise.
 */
export function promptPayload(promptId: string): Record<string, unknown> | null {
  return parse(promptRow(promptId)?.payload);
}

/**
 * What a settled card recorded: the learner's answer, and once graded, the
 * result the model is owed and whether it has already collected it. Also
 * server-side only — the result names the right option.
 */
export function settledAnswer(promptId: string): { answer?: Record<string, unknown>; result?: Record<string, unknown>; collected?: boolean } | null {
  const row = promptRow(promptId);
  if (!row || !row.settled) return null;
  return parse(row.answer) ?? {};
}

/** Whether this process is the one parked on that card, which is what separates a live card from a restored one. */
export function isLivePrompt(promptId: string): boolean {
  return live.has(promptId);
}

/** The row as stored, for the companion path's one-slot bookkeeping. */
export type { PromptRow };

function resolve(promptId: string, answer: Record<string, unknown>) {
  const r = live.get(promptId);
  if (!r) return;
  live.delete(promptId);
  r(answer);
}

function parse(json: string | null | undefined): Record<string, unknown> | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json) as unknown;
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    /* a row nobody can read is a row with nothing in it */
    return null;
  }
}
