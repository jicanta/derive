export type Lesson = {
  id: string;
  topic: string;
  goal: string | null;
  session_id: string | null;
  phase: 'probe' | 'plan' | 'teach' | string;
  created_at: number;
  updated_at: number;
};

export type LessonSummary = Lesson & { nodes: number; locked: number; busy: boolean };

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

export type TimelineItem =
  | { kind: 'user'; seq: number; text: string }
  | { kind: 'assistant'; seq: number; id: string; text: string; streaming: boolean }
  | { kind: 'quiz'; seq: number; quiz: QuizPayload; result?: QuizResultPayload }
  | { kind: 'ask'; seq: number; ask: AskPayload; answer?: string }
  | { kind: 'plan'; seq: number; plan: PlanPayload; approved?: boolean; feedback?: string | null }
  | { kind: 'phase'; seq: number; phase: string }
  | { kind: 'node'; seq: number; id: string; status: NodeStatus; label: string }
  | { kind: 'error'; seq: number; text: string };

export type Stats = { lessons: number; locked: number; quizzes: number; correct: number; due: number; vault: boolean };
