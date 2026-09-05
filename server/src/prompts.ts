import { randomUUID } from 'node:crypto';
import { emit } from './events.js';

/**
 * Prompts are tool calls that wait for the learner: a quiz, an open
 * question, a plan approval, a teach-back. Both the in-process agent and
 * the Claude Code plugin (through the HTTP API) open prompts here.
 */

type Resolver = (answer: Record<string, unknown>) => void;
const pending = new Map<string, { lessonId: string; resolve: Resolver; openedAt: number }>();

export type PromptKind = 'quiz' | 'ask' | 'plan' | 'explain';

export function openPrompt(lessonId: string, kind: PromptKind, payload: Record<string, unknown>) {
  const id = randomUUID();
  emit(lessonId, kind, { id, ...payload });
  const wait = new Promise<Record<string, unknown>>((resolve) => {
    pending.set(id, { lessonId, resolve, openedAt: Date.now() });
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

export function cancelPending(lessonId: string) {
  for (const [id, p] of pending) {
    if (p.lessonId === lessonId) {
      pending.delete(id);
      p.resolve({ interrupted: true });
    }
  }
}
