import { appendEvent, updateEvent, type StoredEvent } from './db.js';
import { mirrorToVault } from './export.js';
import { redactDeep } from './secrets.js';

type Listener = (ev: StoredEvent) => void;
const listeners = new Map<string, Set<Listener>>();

/**
 * Persist an event for a lesson and fan it out to live subscribers.
 *
 * Redaction happens here rather than at each writer, so the database, the SSE
 * stream and the vault mirror all see the same already-clean payload and
 * there is no window downstream where an unredacted one exists. Exact match
 * only: this is lesson content, and the key-shaped backstop would corrupt a
 * lesson that teaches about credentials.
 */
export function emit(lessonId: string, type: string, payload: unknown): StoredEvent {
  const ev = appendEvent(lessonId, type, redactDeep(payload));
  for (const l of listeners.get(lessonId) ?? []) l(ev);
  mirrorToVault(lessonId);
  return ev;
}

/**
 * Rewrite an already persisted event and fan the new payload out under the
 * same seq. Used for assistant text: the block is stored the moment it
 * starts and grows in place, so a stopped turn or a restart keeps the prose.
 */
export function emitUpdate(lessonId: string, seq: number, type: string, payload: unknown): StoredEvent {
  const clean = redactDeep(payload);
  updateEvent(lessonId, seq, clean);
  const ev: StoredEvent = { seq, type, payload: clean, ts: Date.now() };
  for (const l of listeners.get(lessonId) ?? []) l(ev);
  mirrorToVault(lessonId);
  return ev;
}

/** Persist without fanning out (checkpoints of a streaming block). */
export function checkpoint(lessonId: string, seq: number, payload: unknown) {
  updateEvent(lessonId, seq, redactDeep(payload));
}

/** Fan out without persisting (used for high-frequency text deltas). */
export function emitEphemeral(lessonId: string, type: string, payload: unknown) {
  const ev: StoredEvent = { seq: -1, type, payload: redactDeep(payload), ts: Date.now() };
  for (const l of listeners.get(lessonId) ?? []) l(ev);
}

export function subscribe(lessonId: string, l: Listener): () => void {
  let set = listeners.get(lessonId);
  if (!set) listeners.set(lessonId, (set = new Set()));
  set.add(l);
  return () => {
    set!.delete(l);
    if (set!.size === 0) listeners.delete(lessonId);
  };
}
