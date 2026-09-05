import { useCallback, useEffect, useReducer, useRef } from 'react';
import { api } from './api';
import type {
  AskPayload,
  GraphNode,
  Lesson,
  NodeRow,
  NodeStatus,
  PlanPayload,
  QuizPayload,
  QuizResultPayload,
  StoredEvent,
  TimelineItem,
} from './types';

export type LessonState = {
  lesson: Lesson | null;
  items: TimelineItem[];
  nodes: GraphNode[];
  phase: string;
  busy: boolean;
  status: string | null;
  connected: boolean;
  error: string | null;
  lastCost: number | null;
};

type Action =
  | { type: 'init'; lesson: Lesson; nodes: NodeRow[]; events: StoredEvent[]; busy: boolean }
  | { type: 'event'; ev: StoredEvent }
  | { type: 'connected'; value: boolean }
  | { type: 'error'; text: string };

const initial: LessonState = {
  lesson: null,
  items: [],
  nodes: [],
  phase: 'probe',
  busy: false,
  status: null,
  connected: false,
  error: null,
  lastCost: null,
};

function rowsToNodes(rows: NodeRow[]): GraphNode[] {
  return rows.map((r) => ({
    id: r.node_id,
    label: r.label,
    kind: r.kind,
    summary: r.summary,
    depends_on: JSON.parse(r.depends_on || '[]'),
    status: r.status,
  }));
}

function applyEvent(s: LessonState, ev: StoredEvent): LessonState {
  const items = s.items;
  switch (ev.type) {
    case 'ready':
      return { ...s, busy: !!ev.payload?.busy, connected: true };
    case 'turn_start':
      return { ...s, busy: true, status: 'Thinking', error: null };
    case 'turn_end': {
      const ok = ev.payload?.ok;
      return {
        ...s,
        busy: false,
        status: null,
        lastCost: typeof ev.payload?.cost_usd === 'number' ? ev.payload.cost_usd : s.lastCost,
        items: ok ? items : [...items, { kind: 'error', seq: ev.seq, text: String(ev.payload?.error ?? 'Turn failed') }],
      };
    }
    case 'status':
      return { ...s, status: String(ev.payload?.text ?? '') };
    case 'user':
      return { ...s, items: [...items, { kind: 'user', seq: ev.seq, text: ev.payload.text }] };
    case 'block_start':
      return {
        ...s,
        status: null,
        items: [...items, { kind: 'assistant', seq: ev.seq, id: ev.payload.id, text: '', streaming: true }],
      };
    case 'delta': {
      const idx = items.findIndex((i) => i.kind === 'assistant' && i.id === ev.payload.id);
      if (idx < 0) return { ...s, items: [...items, { kind: 'assistant', seq: ev.seq, id: ev.payload.id, text: ev.payload.text, streaming: true }] };
      const it = items[idx] as Extract<TimelineItem, { kind: 'assistant' }>;
      const next = items.slice();
      next[idx] = { ...it, text: it.text + ev.payload.text };
      return { ...s, items: next };
    }
    case 'assistant': {
      const idx = items.findIndex((i) => i.kind === 'assistant' && i.id === ev.payload.id);
      const final: TimelineItem = { kind: 'assistant', seq: ev.seq, id: ev.payload.id, text: ev.payload.text, streaming: false };
      if (idx < 0) return { ...s, items: [...items, final] };
      const next = items.slice();
      next[idx] = final;
      return { ...s, items: next };
    }
    case 'quiz':
      return { ...s, status: null, items: [...items, { kind: 'quiz', seq: ev.seq, quiz: ev.payload as QuizPayload }] };
    case 'quiz_result': {
      const r = ev.payload as QuizResultPayload;
      return { ...s, items: items.map((i) => (i.kind === 'quiz' && i.quiz.id === r.id ? { ...i, result: r } : i)) };
    }
    case 'ask':
      return { ...s, status: null, items: [...items, { kind: 'ask', seq: ev.seq, ask: ev.payload as AskPayload }] };
    case 'ask_result':
      return { ...s, items: items.map((i) => (i.kind === 'ask' && i.ask.id === ev.payload.id ? { ...i, answer: ev.payload.text } : i)) };
    case 'plan': {
      const p = ev.payload as PlanPayload;
      const prev = new Map(s.nodes.map((n) => [n.id, n]));
      const nodes: GraphNode[] = p.nodes.map((n) => ({
        ...n,
        depends_on: n.depends_on ?? [],
        status: prev.get(n.id)?.status ?? 'pending',
      }));
      return { ...s, status: null, nodes, items: [...items, { kind: 'plan', seq: ev.seq, plan: p }] };
    }
    case 'plan_result':
      return {
        ...s,
        items: items.map((i) =>
          i.kind === 'plan' && i.plan.id === ev.payload.id ? { ...i, approved: ev.payload.approved, feedback: ev.payload.feedback } : i,
        ),
      };
    case 'phase':
      return { ...s, phase: ev.payload.phase, items: [...items, { kind: 'phase', seq: ev.seq, phase: ev.payload.phase }] };
    case 'node_status': {
      const status = ev.payload.status as NodeStatus;
      const nodes = s.nodes.map((n) => (n.id === ev.payload.id ? { ...n, status } : n));
      const label = nodes.find((n) => n.id === ev.payload.id)?.label ?? ev.payload.id;
      const next: TimelineItem[] = status === 'teaching' ? items : [...items, { kind: 'node', seq: ev.seq, id: ev.payload.id, status, label }];
      return { ...s, nodes, items: next };
    }
    default:
      return s;
  }
}

function reducer(s: LessonState, a: Action): LessonState {
  switch (a.type) {
    case 'init': {
      let st: LessonState = { ...initial, lesson: a.lesson, nodes: rowsToNodes(a.nodes), phase: a.lesson.phase, busy: a.busy };
      for (const ev of a.events) st = applyEvent(st, ev);
      // History replay: nothing is streaming any more.
      st.items = st.items.map((i) => (i.kind === 'assistant' ? { ...i, streaming: false } : i));
      st.status = a.busy ? 'Thinking' : null;
      return st;
    }
    case 'event':
      return applyEvent(s, a.ev);
    case 'connected':
      return { ...s, connected: a.value };
    case 'error':
      return { ...s, error: a.text };
  }
}

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
        dispatch({ type: 'init', lesson: d.lesson, nodes: d.nodes, events: d.events, busy: d.busy });
        es = new EventSource(`/api/lessons/${id}/stream?after=${lastSeq.current}`);
        es.onopen = () => dispatch({ type: 'connected', value: true });
        es.onerror = () => dispatch({ type: 'connected', value: false });
        es.onmessage = () => undefined;
        const types = [
          'ready', 'turn_start', 'turn_end', 'status', 'user', 'block_start', 'delta', 'assistant', 'quiz', 'quiz_result',
          'ask', 'ask_result', 'plan', 'plan_result', 'phase', 'node_status',
        ];
        for (const t of types) {
          es.addEventListener(t, (m) => {
            const ev = JSON.parse((m as MessageEvent).data) as StoredEvent;
            if (ev.seq > 0) {
              if (ev.seq <= lastSeq.current) return;
              lastSeq.current = ev.seq;
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
  const answer = useCallback(
    (promptId: string, a: Record<string, unknown>) => (id ? api.answer(id, promptId, a) : Promise.reject()),
    [id],
  );
  const stop = useCallback(() => (id ? api.interrupt(id) : Promise.reject()), [id]);

  return { state, send, answer, stop };
}
