import { useCallback, useEffect, useReducer, useRef } from 'react';
import { api } from './api';
import { apply, applyEvent, EVENT_TYPES, initial, reducer, rowsToNodes, type Action, type LessonState } from './lessonReducer';
import type { StoredEvent } from './types';

// The fold itself lives in ./lessonReducer, which imports no React so a plain
// node test can read it (server/test/reducer.test.ts). It is re-exported here
// because this module is the lesson's public surface: one reducer, one place.
export { apply, applyEvent, EVENT_TYPES, initial, reducer, rowsToNodes };
export type { Action, LessonState };

export function useLesson(id: string | undefined) {
  const [state, dispatch] = useReducer(reducer, initial);
  const lastSeq = useRef(0);

  useEffect(() => {
    if (!id) return;
    let es: EventSource | null = null;
    let cancelled = false;
    api
      .lesson(id)
      .then((d) => {
        if (cancelled) return;
        lastSeq.current = d.events.reduce((m, e) => Math.max(m, e.seq), 0);
        dispatch({ type: 'init', lesson: d.lesson, nodes: d.nodes, materials: d.materials ?? [], events: d.events, busy: d.busy, pending: d.pending ?? null, tutor: d.tutor ?? null });
        // A same-origin EventSource sends the derive_session cookie like any other request, so the stream needs nothing added to its URL.
        es = new EventSource(`/api/lessons/${id}/stream?after=${lastSeq.current}`);
        es.onopen = () => dispatch({ type: 'connected', value: true });
        es.onerror = () => dispatch({ type: 'connected', value: false });
        // Text arrives token by token. Re-rendering the markdown on every
        // token is what makes a long lesson feel sticky, so deltas for the
        // same block are merged and flushed a few times a second. Any other
        // event flushes them first, so ordering is preserved.
        let buffered: { id: string; text: string; ts: number } | null = null;
        let timer: ReturnType<typeof setTimeout> | null = null;
        const flush = () => {
          if (timer) clearTimeout(timer);
          timer = null;
          if (!buffered) return;
          const b = buffered;
          buffered = null;
          dispatch({ type: 'event', ev: { seq: -1, type: 'delta', payload: { id: b.id, text: b.text }, ts: b.ts } });
        };
        for (const t of EVENT_TYPES) {
          es.addEventListener(t, (m) => {
            const ev = JSON.parse((m as MessageEvent).data) as StoredEvent;
            if (ev.type === 'delta') {
              if (buffered && buffered.id !== ev.payload.id) flush();
              buffered = buffered ? { ...buffered, text: buffered.text + ev.payload.text } : { id: ev.payload.id, text: ev.payload.text, ts: ev.ts };
              if (!timer) timer = setTimeout(flush, 60);
              return;
            }
            flush();
            if (ev.seq > 0) {
              // Assistant blocks are rewritten under their original seq; let those through.
              if (ev.seq <= lastSeq.current && ev.type !== 'assistant') return;
              lastSeq.current = Math.max(lastSeq.current, ev.seq);
            }
            dispatch({ type: 'event', ev });
          });
        }
      })
      .catch((e) => dispatch({ type: 'error', text: e.message }));
    return () => {
      cancelled = true;
      es?.close();
    };
  }, [id]);

  const send = useCallback((text: string) => (id ? api.message(id, text) : Promise.reject()), [id]);
  const answer = useCallback((promptId: string, a: Record<string, unknown>) => (id ? api.answer(id, promptId, a) : Promise.reject()), [id]);
  const stop = useCallback(() => (id ? api.interrupt(id) : Promise.reject()), [id]);

  return { state, send, answer, stop };
}
