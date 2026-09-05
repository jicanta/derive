import { appendEvent, type StoredEvent } from './db.js';

type Listener = (ev: StoredEvent) => void;
const listeners = new Map<string, Set<Listener>>();

/** Persist an event for a lesson and fan it out to live subscribers. */
export function emit(lessonId: string, type: string, payload: unknown): StoredEvent {
  const ev = appendEvent(lessonId, type, payload);
  for (const l of listeners.get(lessonId) ?? []) l(ev);
  return ev;
}

/** Fan out without persisting (used for high-frequency text deltas). */
export function emitEphemeral(lessonId: string, type: string, payload: unknown) {
  const ev: StoredEvent = { seq: -1, type, payload, ts: Date.now() };
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
