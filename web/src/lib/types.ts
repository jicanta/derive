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
  /** A model id for you alone, per provider; a provider with no entry uses the install setting. */
  model?: Record<string, string>;
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
  /** The context window the learner stored for a local row, or null when the default applies. */
  num_ctx: number | null;
  /** The default window a local row's field shows as its placeholder; null on every row that has no window field at all, which is what the component reads to decide whether to render one. */
  num_ctx_default: number | null;
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

/**
 * What a capability read answers for one model on one local row — the same
 * two-armed shape as `TestResult`, because it has the same job: a verdict, or
 * the server's own sentence with Derive's hint beside it.
 */
export type CapabilityResult =
  | {
      ok: true;
      /** The model the verdict is about, which is what the line names. */
      model: string;
      /** Whether the server says the model can call tools. `unknown` is silence — it is never a refusal, and it is what the round-trip resolves. */
      tools: 'yes' | 'no' | 'unknown';
      /** The window the model was trained for: a ceiling, not a setting. Null when the server does not say. */
      max_window: number | null;
      /** The window the server was actually started with, where the server reports one. Null on Ollama, which is told the window rather than asked it. */
      served_window: number | null;
      /** Whether this model may be stored on the row and made the active one. */
      selectable: boolean;
      /** False while the verdict rests on silence, so the line can say the server did not answer the question rather than claim it did. */
      definitive: boolean;
      /** The sentence to show when `selectable` is false; null otherwise. */
      refusal: string | null;
      ms: number;
    }
  | { ok: false; error: string; hint?: string; ms: number };

/**
 * What the teaching proof answers for one row: a pass with its latency, or a
 * fail with the reason to show and Derive's fix hint beside it.
 *
 * Every sentence comes from the server — the three approved fail reasons and,
 * where a provider or a local server said something of its own, its words
 * verbatim. The browser composes the `Pass ·` and `Fail ·` prefix and picks the
 * colour; it never writes a reason or rewrites one.
 */
export type TeachingTest = { ok: true; ms: number } | { ok: false; reason: string; hint?: string; ms: number };

/**
 * The web-search block as GET /api/settings paints it: the learner's choice,
 * the key as the page may know it, the SearXNG address, and whether the
 * provider the next turn would run on searches with its own tool.
 */
export type SearchView = {
  /** Which search the tutor uses where the provider has none of its own. */
  provider: 'provider' | 'tavily' | 'searxng';
  /** The stored Tavily key as the page paints it — set or not, the last four characters when it is long enough. The value is never in it. */
  key: { set: boolean; hint: string | null };
  /** The environment variable that locks the key field, or null when the key is the learner's to store. */
  key_locked: string | null;
  /** Where the learner's SearXNG instance is reached, or null when none is stored. */
  base_url: string | null;
  /** Whether the active provider has a search tool of its own. The server answers it because which providers do is a fact of the adapter table — and on Gemini a fact of the model id too — so a list in a component would be wrong the day a row changes. */
  native: boolean;
};

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
  /** How the tutor searches the web where the provider has no search of its own. */
  search: SearchView;
  /** The day the shipped price table was last checked against each vendor's own page. */
  prices_as_of: string;
  /** Why ~/.derive/prices.json yielded nothing, naming the path, or null when it reads fine or is absent. Derive prices with its shipped table while this is set. */
  prices_error: string | null;
};

/**
 * What learning has cost, as GET /api/usage answers it.
 *
 * Every money string and every label word in here arrives already formatted:
 * the server produces them with the one formatter the lesson header uses, so
 * this page prints them and formats no number of its own. The counts are
 * carried beside the lines for the states that are judged on them — an empty
 * `lessons` is the page's unambiguous empty signal, never inferred from a
 * zeroed total.
 */
export type UsageView = {
  /** The grand total across every provider, or null when this learner has no usage at all. */
  total: string | null;
  /** The one line under the total: how many lessons and how many tokens it covers. Null when there is nothing to say. */
  summary: string | null;
  /** How many distinct lessons have cost anything. Zero is the empty state. */
  lessons: number;
  /** Every token reported across every provider, or null when nothing was reported anywhere. */
  tokens: number | null;
  groups: UsageGroup[];
};

/** One provider's section: the catalogue id it is keyed by, the word a learner reads, and the models beneath it. */
export type UsageGroup = {
  provider: string;
  /** The lowercased provider word — `ollama`, `lm studio`, `llama.cpp` — never the raw id. */
  label: string;
  /** The section's whole line, already composed. */
  line: string;
  cost: string | null;
  tokens: number | null;
  lessons: number;
  models: UsageModel[];
};

/** One model under a provider. `model` is verbatim, which on llama.cpp started without `--alias` is a file path — hence the truncation and the full value in `title`. */
export type UsageModel = {
  model: string | null;
  line: string;
  cost: string | null;
  tokens: number | null;
  lessons: number;
  rows: UsageLesson[];
};

/** One lesson's line under the model it ran on. */
export type UsageLesson = {
  id: string;
  /** What the lesson is about; its id when the lesson itself is gone. */
  topic: string;
  line: string;
  cost: string | null;
  tokens: number | null;
};

export type LessonSummary = Lesson & {
  nodes: number;
  locked: number;
  shaky: number;
  busy: boolean;
  /** The lesson's total as the learner reads it, already formatted server-side, or null when the lesson has no usage rows and there is nothing to show. */
  cost: string | null;
};

/** One lesson in full, as the Lesson page reads it: the row, its graph, its material, the whole event log, and what the last turn ran on. */
export type LessonView = {
  lesson: Lesson;
  nodes: NodeRow[];
  materials: Material[];
  events: StoredEvent[];
  busy: boolean;
  pending: boolean;
  /** What the last turn ran on, for the header pill. Null before any turn. */
  tutor: { provider: string; model: string | null } | null;
  /** The lesson's total as the learner reads it, already formatted server-side, or null when the lesson has no usage rows and there is nothing to show. */
  cost: string | null;
};

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
