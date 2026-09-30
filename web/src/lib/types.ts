export type Lesson = {
  id: string;
  topic: string;
  goal: string | null;
  session_id: string | null;
  phase: 'probe' | 'plan' | 'teach' | string;
  mode: 'agent' | 'external';
  learner_id: string;
  /** Companion lessons: where cards are answered. */
  answer_in: 'browser' | 'terminal';
  /** Companion lessons: the terminal that drives it. */
  driver?: 'claude-code' | 'codex' | null;
  created_at: number;
  updated_at: number;
};

/** How a learner wants to be taught, in their own words. The method never bends to it; the delivery does. */
export type LearnerPrefs = {
  language?: string;
  style?: 'adaptive' | 'socratic' | 'narrated';
  pace?: 'brisk' | 'standard' | 'thorough';
  background?: string;
  how?: string;
  examples?: string;
  /** A model id for you alone, on the active provider; empty means the install setting. */
  model?: string;
};
export type Learner ={ id: string; name: string; created_at: number; prefs: LearnerPrefs; lessons?: number };

/** The status pill of a provider row. `checking` is transient: what a login or local row reads until the detection pass has looked at it. */
export type ProviderStatus = 'logged in' | 'key set' | 'set from environment' | `found on port ${number}` | 'not configured' | 'checking';

/** One provider row as GET /api/settings paints it: the catalogue facts, what is stored, what the environment locks, and the last detection pass. The page renders this and hard-codes none of it. */
export type ProviderView = {
  id: string;
  label: string;
  /** Which eyebrow group the row sits under. */
  group: 'logins' | 'keys' | 'local';
  /** How the provider is reached: a CLI login, a key, a key plus a base URL, or nothing for a local server. */
  auth: 'login' | 'key' | 'key+url' | 'none';
  /** True only where a driver exists today; a row that does not teach cannot be made active. */
  teaches: boolean;
  /** The one sentence the row shows under its head line. */
  note: string;
  /** The curated default model id, or null when the provider's own default applies. */
  default_model: string | null;
  has_models_endpoint: boolean;
  /** The default port a local server listens on. */
  port: number | null;
  /** The stored model id, or null when none is stored. */
  model: string | null;
  /** The environment variable that locks the model, or null when the field is the learner's to set. */
  model_locked: string | null;
  /** The stored key as the page paints it — set or not, the last four characters when the key is long enough, the environment variable that locks it — or null on a row with no key field. The value is never in it. */
  key: { set: boolean; hint: string | null; locked: string | null } | null;
  /** True on the local rows whose server may be started with a bearer token: the key field reads `optional key`. */
  key_optional: boolean;
  /** The stored base URL for a local or OpenAI-compatible row, or null for the catalogue default. When the environment locks it, the address the row is actually probed on. */
  base_url: string | null;
  base_url_default: string | null;
  /** The environment variable that locks the base URL (OLLAMA_HOST on the Ollama row), or null. */
  base_url_locked: string | null;
  status: ProviderStatus;
  active: boolean;
};

/** What the next turn runs on, and why. */
export type TutorChoice = {
  provider: string;
  /** The model asked for, or null to take the provider's own default. */
  model: string | null;
  source: 'environment' | 'settings' | 'detected';
  modelSource: 'environment' | 'settings' | 'default' | null;
};

/** What a connection test answers: the model count and latency, or the provider's own sentence with Derive's fix hint beside it. `models` is null on a login, which has no list to count. */
export type TestResult = { ok: true; models: number | null; ms: number } | { ok: false; error: string; hint?: string; ms: number };

/** The settings page in one read: the active choice, the locks, and every row in catalogue order. */
export type Settings = {
  active: TutorChoice;
  /** The day the catalogue's default model ids were last checked. */
  defaults_as_of: string;
  /** The environment variable that locks the provider, or null. */
  provider_locked: string | null;
  model_locked: string | null;
  /** Why ~/.derive/secrets.json could not be read, naming the path, or null when it is fine or absent. Nothing overwrites the file while this is set. */
  secrets_error: string | null;
  rows: ProviderView[];
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

/** A file the learner attached: slides, a PDF, notes. Text lives on the server. */
export type Material = {
  id: string;
  lesson_id: string | null;
  name: string;
  kind: 'pdf' | 'pptx' | 'docx' | 'md' | 'txt' | 'repo';
  unit: 'page' | 'slide' | 'part' | 'file';
  pages: number;
  chars: number;
  created_at?: number;
};

export type ResourceKind = 'article' | 'video' | 'book' | 'paper' | 'course' | 'note';
export const RESOURCE_KINDS: ResourceKind[] = ['article', 'video', 'book', 'paper', 'course', 'note'];

/** One entry of the learner's library. The fetched text lives on the server. */
export type Resource = {
  id: string;
  learner_id: string;
  kind: ResourceKind;
  title: string;
  url: string | null;
  author: string | null;
  note: string | null;
  tags: string[];
  host: string | null;
  chars: number;
  fetched_at: number | null;
  fetch_error: string | null;
  added_by: 'learner' | 'tutor';
  lesson_id: string | null;
  created_at: number;
  updated_at: number;
};
export type Library = { resources: Resource[]; tags: { tag: string; count: number }[]; kinds: ResourceKind[]; total: number };

/** The tutor pointed at a library entry, or saved one. */
export type ResourceEvent = {
  action: 'suggested' | 'saved' | 'already_saved';
  id: string;
  kind: ResourceKind;
  title: string;
  url: string | null;
  author: string | null;
  tags: string[];
  why: string | null;
  where: string | null;
  node_id: string | null;
};

export type AtlasNode = Omit<NodeRow, 'depends_on'> & { depends_on: string[]; topic: string; goal: string | null; due: boolean };
export type Misconception = {
  id: number;
  lesson_id: string;
  node_id: string | null;
  question: string;
  picked: string;
  correct: string;
  explanation: string;
  /** 'sure': the learner committed to the wrong claim with confidence, a held belief rather than a slip. */
  confidence?: 'sure' | 'unsure' | null;
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

/** What a question is for: 'pretest' is the attempt before teaching (a miss is expected), 'check' locks a node, 'cumulative' is the end-of-lesson quiz, 'review' retrieves a node from an earlier lesson. */
export type QuizPurpose = 'probe' | 'pretest' | 'check' | 'cumulative' | 'review';
/** What a question tests: the reason a claim must be so, the steps that use it, or a problem type the lesson never showed. */
export type QuizTests = 'intuition' | 'procedure' | 'transfer';
export type QuizPayload = { id: string; question: string; options: string[]; multi: boolean; node_id: string | null; purpose?: QuizPurpose; tests?: QuizTests | null };
export type QuizResultPayload = {
  id: string;
  selected: number[];
  correct: number[];
  explanation: string;
  /** 'skipped': the learner typed in the chat instead of answering; nothing was graded or revealed. */
  result: 'correct' | 'incorrect' | 'dont_know' | 'skipped';
  note: string | null;
  /** How sure the learner said they were, committed before the reveal. */
  confidence?: 'sure' | 'unsure' | null;
  purpose?: QuizPurpose;
  tests?: QuizTests | null;
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
  | { kind: 'warmup'; seq: number; nodes: { id: string; label: string; topic: string }[] }
  | { kind: 'node_start'; seq: number; id: string; label: string; index: number; total: number }
  | { kind: 'node'; seq: number; id: string; status: NodeStatus; label: string; reviewDays?: number }
  | { kind: 'memory'; seq: number; fact: string }
  | { kind: 'preferences'; seq: number; prefs: LearnerPrefs }
  | { kind: 'material'; seq: number; id: string; name: string; unit: string; pages: number; removed?: boolean }
  | { kind: 'resource'; seq: number; resource: ResourceEvent }
  | { kind: 'complete'; seq: number; goal: string; locked: number; total: number; quizzes: number; correct: number; caught: number; minutes: number; reviewDays: number }
  | { kind: 'error'; seq: number; text: string };

export type Stats = { lessons: number; locked: number; quizzes: number; correct: number; due: number; vault: boolean; library?: number; learner?: Learner };
