import { randomUUID } from 'node:crypto';
import { emit } from './events.js';

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
 */

type Resolver = (answer: Record<string, unknown>) => void;
export type PromptKind = 'quiz' | 'ask' | 'plan' | 'explain';
type Pending = { lessonId: string; kind: PromptKind; resolve: Resolver; openedAt: number; held: boolean };
const pending = new Map<string, Pending>();

export function openPrompt(lessonId: string, kind: PromptKind, payload: Record<string, unknown>, opts: { hold?: boolean } = {}) {
  const id = randomUUID();
  emit(lessonId, kind, { id, ...payload });
  const wait = new Promise<Record<string, unknown>>((resolve) => {
    pending.set(id, { lessonId, kind, resolve, openedAt: Date.now(), held: !!opts.hold });
  });
  return { id, wait };
}

export function answerPrompt(lessonId: string, promptId: string, answer: Record<string, unknown>): boolean {
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

export function pendingId(lessonId: string): string | null {
  for (const [id, p] of pending) if (p.lessonId === lessonId) return id;
  return null;
}

export function pendingPrompt(lessonId: string): { id: string; kind: PromptKind; held: boolean } | null {
  for (const [id, p] of pending) if (p.lessonId === lessonId) return { id, kind: p.kind, held: p.held };
  return null;
}

/** Cancel a lesson's open prompts. Held prompts survive unless asked for. */
export function cancelPending(lessonId: string, opts: { held?: boolean } = {}) {
  for (const [id, p] of pending) {
    if (p.lessonId !== lessonId) continue;
    if (p.held && !opts.held) continue;
    pending.delete(id);
    p.resolve({ interrupted: true });
  }
}
