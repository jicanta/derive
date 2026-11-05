/**
 * How the browser rebuilds a lesson: replay its events.
 *
 * There is no "current state" endpoint beyond the nodes and materials rows.
 * Everything the page shows — the timeline, the graph's statuses, the phase,
 * the status line, whether a turn is running — is derived here by folding the
 * lesson's append-only event stream, first from the stored events on load and
 * then from each event the SSE stream delivers.
 *
 * The file is deliberately free of React. Nothing in it imports `react`, it
 * holds no state of its own and it touches no browser API, so `useLesson.ts`
 * can own the hook, the subscription and the delta buffer while a plain node
 * test reads the fold. That is what `server/test/reducer.test.ts` is for.
 *
 * `EVENT_TYPES` is the other half of a contract the server holds: the stream
 * is subscribed to per event name, so an event type the server emits and this
 * list does not carry is ignored by the browser in silence — no error, no
 * warning, just a lesson missing a line. Adding one to the server means adding
 * it here and giving `applyEvent` a branch. The companion test exists to fail
 * by name when the two drift apart.
 */
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
  PendingPrompt,
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
  /** What the last turn ran on, for the header pill: seeded from the lesson view, updated by each turn_start. Null before any turn. */
  tutor: { provider: string; model: string | null } | null;
  /**
   * The card the server says is open, from its prompts table. Seeded on init
   * and left alone afterwards: within a session the timeline already says
   * which card is unanswered, and this is what tells the page a card restored
   * from before a restart is live rather than inert.
   */
  pending: PendingPrompt | null;
};

export type Action =
  | { type: 'init'; lesson: Lesson; nodes: NodeRow[]; materials: Material[]; events: StoredEvent[]; busy: boolean; pending: PendingPrompt | null; tutor: { provider: string; model: string | null } | null }
  | { type: 'event'; ev: StoredEvent }
  | { type: 'connected'; value: boolean }
  | { type: 'error'; text: string };

export const initial: LessonState = {
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
  tutor: null,
  pending: null,
};

export function rowsToNodes(rows: NodeRow[]): GraphNode[] {
  return rows.map((r) => ({
    id: r.node_id,
    label: r.label,
    kind: r.kind,
    summary: r.summary,
    depends_on: JSON.parse(r.depends_on || '[]'),
    status: r.status,
  }));
}

export function applyEvent(s: LessonState, ev: StoredEvent): LessonState {
  const items = s.items;
  switch (ev.type) {
    case 'ready':
      return { ...s, busy: !!ev.payload?.busy, connected: true };
    case 'turn_start':
      // The pill reads the turn, not the setting: a turn_start written before
      // this field existed carries no provider and leaves the pill as it was.
      return {
        ...s,
        busy: true,
        status: s.lesson?.mode === 'external' ? 'Teaching in your terminal' : 'Thinking',
        error: null,
        tutor: typeof ev.payload?.provider === 'string' ? { provider: ev.payload.provider, model: ev.payload.model ?? null } : s.tutor,
      };
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
    case 'notice':
      return { ...s, items: [...items, { kind: 'notice', seq: ev.seq, text: String(ev.payload?.text ?? '') }] };
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
export function apply(s: LessonState, ev: StoredEvent): LessonState {
  const next = applyEvent(s, ev);
  if (next.items.length > s.items.length) {
    const at: number = typeof ev.payload?.at === 'number' ? ev.payload.at : ev.ts;
    const items = next.items.slice();
    for (let i = s.items.length; i < items.length; i++) items[i] = { ...items[i], at };
    return { ...next, items };
  }
  return next;
}

export function reducer(s: LessonState, a: Action): LessonState {
  switch (a.type) {
    case 'init': {
      let st: LessonState = { ...initial, lesson: a.lesson, nodes: rowsToNodes(a.nodes), phase: a.lesson.phase, busy: a.busy };
      for (const ev of a.events) st = apply(st, ev);
      // The server's list is the truth; the replay only adds the timeline items.
      st.materials = a.materials ?? st.materials;
      st.items = st.items.map((i) => (i.kind === 'assistant' ? { ...i, streaming: false } : i));
      st.busy = a.busy;
      st.tutor = a.tutor;
      st.pending = a.pending;
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

export const EVENT_TYPES = [
  'ready', 'turn_start', 'turn_end', 'status', 'user', 'block_start', 'delta', 'assistant', 'quiz', 'quiz_result', 'ask', 'ask_result',
  'explain', 'explain_result', 'plan', 'plan_result', 'phase', 'warmup', 'node_status', 'memory', 'notice', 'preferences', 'material', 'material_removed', 'answer_in', 'resource',
];
