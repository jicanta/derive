export type Lesson = {
  id: string;
  topic: string;
  goal: string | null;
  session_id: string | null;
  phase: 'probe' | 'plan' | 'teach' | string;
  mode: 'agent' | 'external';
  created_at: number;
  updated_at: number;
};

export type LessonSummary = Lesson & { nodes: number; locked: number; shaky: number; busy: boolean };

export type NodeKind = 'truth' | 'derived' | 'goal';
export type NodeStatus = 'pending' | 'teaching' | 'locked' | 'shaky';

export type GraphNode = {
  id: string;
  label: string;
  kind: NodeKind;
  summary?: string | null;
  depends_on: string[];
  status: NodeStatus;
};

export type NodeRow = {
  lesson_id: string;
  node_id: string;
  label: string;
  kind: NodeKind;
  summary: string | null;
  depends_on: string;
  status: NodeStatus;
  locked_at: number | null;
  review_at: number | null;
  interval_days: number;
  reps: number;
};

export type DueNode = NodeRow & { topic: string };

export type AtlasNode = Omit<NodeRow, 'depends_on'> & { depends_on: string[]; topic: string; goal: string | null; due: boolean };
export type Misconception = {
  id: number;
  lesson_id: string;
  node_id: string | null;
  question: string;
  picked: string;
  correct: string;
  explanation: string;
  resolved: number;
  ts: number;
  topic: string;
};
export type Atlas = {
  nodes: AtlasNode[];
  lessons: { id: string; topic: string; goal: string | null; phase: string; mode: string; created_at: number }[];
  misconceptions: Misconception[];
  due: DueNode[];
};

export type StoredEvent = { seq: number; type: string; payload: any; ts: number };

export type QuizPayload = { id: string; question: string; options: string[]; multi: boolean; node_id: string | null };
export type QuizResultPayload = {
  id: string;
  selected: number[];
  correct: number[];
  explanation: string;
  result: 'correct' | 'incorrect' | 'dont_know';
  note: string | null;
};
export type AskPayload = { id: string; question: string; options: string[] };
export type PlanPayload = { id: string; goal: string; nodes: Omit<GraphNode, 'status'>[] };
export type ExplainPayload = { id: string; prompt: string; node_id: string | null };

export type TimelineItem = TimelineItemBase & { at?: number };

export type TimelineItemBase =
  | { kind: 'user'; seq: number; text: string; source?: string }
  | { kind: 'assistant'; seq: number; id: string; text: string; streaming: boolean; source?: string }
  | { kind: 'quiz'; seq: number; quiz: QuizPayload; result?: QuizResultPayload }
  | { kind: 'ask'; seq: number; ask: AskPayload; answer?: string }
  | { kind: 'plan'; seq: number; plan: PlanPayload; approved?: boolean; feedback?: string | null }
  | { kind: 'explain'; seq: number; explain: ExplainPayload; answer?: string }
  | { kind: 'phase'; seq: number; phase: string }
  | { kind: 'node_start'; seq: number; id: string; label: string; index: number; total: number }
  | { kind: 'node'; seq: number; id: string; status: NodeStatus; label: string }
  | { kind: 'memory'; seq: number; fact: string }
  | { kind: 'complete'; seq: number; goal: string; locked: number; total: number; quizzes: number; correct: number; caught: number; minutes: number; reviewDays: number }
  | { kind: 'error'; seq: number; text: string };

export type Stats = { lessons: number; locked: number; quizzes: number; correct: number; due: number; vault: boolean };
