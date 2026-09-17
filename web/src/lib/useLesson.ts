import { useCallback, useEffect, useReducer, useRef } from 'react';
import { api } from './api';
import type {
  AskPayload,
  ExplainPayload,
  GraphNode,
  LearnerPrefs,
  Lesson,
  Material,
  NodeRow,
  NodeStatus,
  PlanPayload,
  QuizPayload,
  QuizResultPayload,
  ResourceEvent,
  StoredEvent,
  TimelineItem,
} from './types';

export type LessonState = {
  lesson: Lesson | null;
  items: TimelineItem[];
  nodes: GraphNode[];
  materials: Material[];
  phase: string;
  busy: boolean;
  status: string | null;
  connected: boolean;
  error: string | null;
  lastCost: number | null;
  verified: number;
};

type Action =
  | { type: 'init'; lesson: Lesson; nodes: NodeRow[]; materials: Material[]; events: StoredEvent[]; busy: boolean }
  | { type: 'event'; ev: StoredEvent }
  | { type: 'connected'; value: boolean }
  | { type: 'error'; text: string };

const initial: LessonState = {
  lesson: null,
  items: [],
  nodes: [],
  materials: [],
  phase: 'probe',
  busy: false,
  status: null,
  connected: false,
  error: null,
  lastCost: null,
  verified: 0,
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
      return { ...s, busy: true, status: s.lesson?.mode === 'external' ? 'Teaching in your terminal' : 'Thinking', error: null };
    case 'turn_end': {
      const ok = ev.payload?.ok;
      // A companion lesson answered from the terminal ends its turn with the
      // card still open; the card stays answerable here until it is settled.
      const heldOpen = !!ev.payload?.held;
      return {
        ...s,
        busy: heldOpen,
        status: null,
        lastCost: typeof ev.payload?.cost_usd === 'number' ? ev.payload.cost_usd : s.lastCost,
        verified: s.verified + (typeof ev.payload?.verified === 'number' ? ev.payload.verified : 0),
        items: ok ? items : [...items, { kind: 'error', seq: ev.seq, text: String(ev.payload?.error ?? 'Turn failed') }],
      };
    }
    case 'status':
      return { ...s, status: String(ev.payload?.text ?? '') };
    case 'user':
      return { ...s, items: [...items, { kind: 'user', seq: ev.seq, text: ev.payload.text, source: ev.payload.source }] };
    case 'block_start':
      return { ...s, status: null, items: [...items, { kind: 'assistant', seq: ev.seq, id: ev.payload.id, text: '', streaming: true }] };
    case 'delta': {
      const idx = items.findIndex((i) => i.kind === 'assistant' && i.id === ev.payload.id);
      if (idx < 0) return { ...s, items: [...items, { kind: 'assistant', seq: ev.seq, id: ev.payload.id, text: ev.payload.text, streaming: true }] };
      const it = items[idx] as Extract<TimelineItem, { kind: 'assistant' }>;
      const next = items.slice();
      next[idx] = { ...it, text: it.text + ev.payload.text };
      return { ...s, items: next };
    }
    case 'assistant': {
      // Persisted the moment the block starts (partial, empty) and rewritten
      // under the same seq as it grows and when it ends.
      const idx = items.findIndex((i) => i.kind === 'assistant' && i.id === ev.payload.id);
      const partial = !!ev.payload.partial;
      const text: string = ev.payload.text ?? '';
      if (!partial && !text.trim()) return idx < 0 ? s : { ...s, items: items.filter((_, i) => i !== idx) };
      const cur = idx >= 0 ? (items[idx] as Extract<TimelineItem, { kind: 'assistant' }>) : null;
      // Deltas may have run ahead of a checkpoint: never shrink streamed text.
      const merged = partial && cur && cur.text.length > text.length ? cur.text : text;
      const item: TimelineItem = { kind: 'assistant', seq: ev.seq, id: ev.payload.id, text: merged, streaming: partial, source: ev.payload.source };
      if (idx < 0) return { ...s, status: null, items: [...items, item] };
      const next = items.slice();
      next[idx] = item;
      return { ...s, status: partial ? null : s.status, items: next };
    }
    case 'quiz':
      return { ...s, status: null, busy: true, items: [...items, { kind: 'quiz', seq: ev.seq, quiz: ev.payload as QuizPayload }] };
    case 'quiz_result': {
      const r = ev.payload as QuizResultPayload;
      return { ...s, items: items.map((i) => (i.kind === 'quiz' && i.quiz.id === r.id ? { ...i, result: r } : i)) };
    }
    case 'ask':
      return { ...s, status: null, busy: true, items: [...items, { kind: 'ask', seq: ev.seq, ask: ev.payload as AskPayload }] };
    case 'ask_result':
      return { ...s, items: items.map((i) => (i.kind === 'ask' && i.ask.id === ev.payload.id ? { ...i, answer: ev.payload.text } : i)) };
    case 'explain':
      return { ...s, status: null, busy: true, items: [...items, { kind: 'explain', seq: ev.seq, explain: ev.payload as ExplainPayload }] };
    case 'explain_result':
      return { ...s, items: items.map((i) => (i.kind === 'explain' && i.explain.id === ev.payload.id ? { ...i, answer: ev.payload.text } : i)) };
    case 'plan': {
      const p = ev.payload as PlanPayload;
      const prev = new Map(s.nodes.map((n) => [n.id, n]));
      const nodes: GraphNode[] = p.nodes.map((n) => ({ ...n, depends_on: n.depends_on ?? [], status: prev.get(n.id)?.status ?? 'pending' }));
      return { ...s, status: null, busy: true, nodes, items: [...items, { kind: 'plan', seq: ev.seq, plan: p }] };
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
    case 'warmup':
      return { ...s, items: [...items, { kind: 'warmup', seq: ev.seq, nodes: ev.payload.nodes ?? [] }] };
    case 'node_status': {
      const status = ev.payload.status as NodeStatus;
      const nodes = s.nodes.map((n) => (n.id === ev.payload.id ? { ...n, status } : n));
      const idx = nodes.findIndex((n) => n.id === ev.payload.id);
      const label = nodes[idx]?.label ?? ev.payload.id;
      const item: TimelineItem =
        status === 'teaching'
          ? { kind: 'node_start', seq: ev.seq, id: ev.payload.id, label, index: idx + 1, total: nodes.length }
          : { kind: 'node', seq: ev.seq, id: ev.payload.id, status, label, reviewDays: typeof ev.payload.interval_days === 'number' ? ev.payload.interval_days : undefined };
      const out = [...items, item];
      // The goal locked: the whole graph is built. Add the receipt.
      if (status === 'locked' && nodes[idx]?.kind === 'goal' && !items.some((i) => i.kind === 'complete')) {
        const quizzes = items.filter((i) => i.kind === 'quiz' && i.result);
        const correct = quizzes.filter((i) => i.kind === 'quiz' && i.result?.result === 'correct').length;
        const first = items.find((i) => typeof i.at === 'number')?.at ?? ev.ts;
        out.push({
          kind: 'complete',
          seq: ev.seq,
          goal: s.lesson?.goal ?? label,
          locked: nodes.filter((n) => n.status === 'locked').length,
          total: nodes.length,
          quizzes: quizzes.length,
          correct,
          caught: quizzes.length - correct,
          minutes: Math.max(1, Math.round((ev.ts - first) / 60_000)),
          reviewDays: typeof ev.payload.interval_days === 'number' ? ev.payload.interval_days : 1,
        });
      }
      return { ...s, nodes, items: out };
    }
    case 'memory':
      return { ...s, items: [...items, { kind: 'memory', seq: ev.seq, fact: ev.payload.fact }] };
    case 'preferences':
      return { ...s, items: [...items, { kind: 'preferences', seq: ev.seq, prefs: ev.payload as LearnerPrefs }] };
    case 'material': {
      const m = ev.payload as Material;
      const materials = s.materials.some((x) => x.id === m.id) ? s.materials : [...s.materials, m];
      return { ...s, materials, items: [...items, { kind: 'material', seq: ev.seq, id: m.id, name: m.name, unit: m.unit, pages: m.pages }] };
    }
    case 'resource':
      return { ...s, items: [...items, { kind: 'resource', seq: ev.seq, resource: ev.payload as ResourceEvent }] };
    case 'answer_in':
      return s.lesson ? { ...s, lesson: { ...s.lesson, answer_in: ev.payload.where } } : s;
    case 'material_removed':
      return {
        ...s,
        materials: s.materials.filter((m) => m.id !== ev.payload.id),
        items: [...items, { kind: 'material', seq: ev.seq, id: ev.payload.id, name: ev.payload.name, unit: 'part', pages: 0, removed: true }],
      };
    default:
      return s;
  }
}

/** Apply an event and stamp every newly appended item with its time, so the
 *  timeline can be ordered by when things happened rather than when they
 *  arrived (mirrored terminal prose can arrive after the quiz it preceded). */
function apply(s: LessonState, ev: StoredEvent): LessonState {
  const next = applyEvent(s, ev);
  if (next.items.length > s.items.length) {
    const at: number = typeof ev.payload?.at === 'number' ? ev.payload.at : ev.ts;
    const items = next.items.slice();
    for (let i = s.items.length; i < items.length; i++) items[i] = { ...items[i], at };
    return { ...next, items };
  }
  return next;
}

function reducer(s: LessonState, a: Action): LessonState {
  switch (a.type) {
    case 'init': {
      let st: LessonState = { ...initial, lesson: a.lesson, nodes: rowsToNodes(a.nodes), phase: a.lesson.phase, busy: a.busy };
      for (const ev of a.events) st = apply(st, ev);
      // The server's list is the truth; the replay only adds the timeline items.
      st.materials = a.materials ?? st.materials;
      st.items = st.items.map((i) => (i.kind === 'assistant' ? { ...i, streaming: false } : i));
      st.busy = a.busy;
      st.status = a.busy ? (a.lesson.mode === 'external' ? 'Teaching in your terminal' : 'Thinking') : null;
      return st;
    }
    case 'event':
      return apply(s, a.ev);
    case 'connected':
      return { ...s, connected: a.value };
    case 'error':
      return { ...s, error: a.text };
  }
}

const EVENT_TYPES = [
  'ready', 'turn_start', 'turn_end', 'status', 'user', 'block_start', 'delta', 'assistant', 'quiz', 'quiz_result', 'ask', 'ask_result',
  'explain', 'explain_result', 'plan', 'plan_result', 'phase', 'warmup', 'node_status', 'memory', 'preferences', 'material', 'material_removed', 'answer_in', 'resource',
];

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
        dispatch({ type: 'init', lesson: d.lesson, nodes: d.nodes, materials: d.materials ?? [], events: d.events, busy: d.busy });
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
