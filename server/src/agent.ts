import { randomUUID } from 'node:crypto';
import { createSdkMcpServer, query, tool, type Query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import * as actions from './actions.js';
import { DATA_DIR, EFFORT, MODEL } from './config.js';
import { getLesson, learnerProfile, setSessionId, type GraphNodeInput } from './db.js';
import { checkpoint, emit, emitEphemeral, emitUpdate } from './events.js';
import { librarySection } from './library.js';
import { materialsSection } from './materials.js';
import { takeNotices } from './notices.js';
import { cancelPending } from './prompts.js';
import { SYSTEM_PROMPT } from './prompt.js';

export { answerPrompt, hasPending } from './prompts.js';

// ---------- active turns ----------

const active = new Map<string, Query>();
/** Lessons whose current turn the learner stopped; their result is not an error. */
const stopping = new Set<string>();

export function isBusy(lessonId: string) {
  return active.has(lessonId);
}

export async function interrupt(lessonId: string) {
  const q = active.get(lessonId);
  if (q) {
    stopping.add(lessonId);
    await q.interrupt().catch(() => undefined);
  }
  cancelPending(lessonId);
}

export { addNotice, takeNotices } from './notices.js';

// ---------- tool definitions ----------

function text(obj: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(obj) }] };
}

export const nodeSchema = z.object({
  id: z.string().describe('Short stable id, e.g. "packets".'),
  label: z.string().describe('The claim in plain words a learner reads at a glance, 3 to 7 words, e.g. "A line can output any real number". No formulas, symbols, abbreviations or private shorthand: this is what the graph shows.'),
  kind: z.enum(['truth', 'derived', 'goal']),
  summary: z.string().describe('One full sentence stating the claim this node stands for. Shown to the learner next to the label; write it for them.'),
  depends_on: z.array(z.string()).optional().describe('Ids of the nodes this one is derived from. Empty for roots.'),
});

export const TOOL_DESCRIPTIONS = {
  quiz: 'Ask the learner ONE graded multiple-choice question with a known correct answer. The app renders the options, the learner picks and says whether they are sure, the app grades it and reveals your explanation. Returns what they picked, whether it was correct, how sure they were, and what to do next. Set `purpose`: "pretest" for the attempt you ask for BEFORE teaching a derived node (a miss is expected and is not recorded against them), "check" for the question that locks a node; the probe phase and review sessions are recognised on their own. Blocks until the learner answers.',
  ask: 'Ask the learner a question with no right answer (goal, preference, energy, what next). Optionally offer choices; the learner can always type a free answer. Blocks until they answer.',
  set_plan:
    'Submit the lesson plan as a dependency DAG: unconditional truths at the roots (kind "truth"), derived steps (kind "derived"), exactly one "goal" sink. The app draws it and asks the learner to approve. Blocks until they approve or request changes; if they request changes, revise and call again.',
  node_status: 'Update the state of a plan node: "teaching" when you start it, "locked" when a confident check confirmed it (the node is then scheduled for review by how well the check went; the reply says in how many days), "shaky" when it did not land after two checks.',
  set_phase: 'Announce which phase of the lesson you are in.',
  explain_back:
    'Teach-back check: ask the learner to explain a node in their own words (2 to 5 sentences), or to say WHY a claim must be true. Write the rubric first: the 2 or 3 things a correct explanation must contain. Returns their explanation for you to grade. Use it at least once per lesson on the most important derived node, and whenever a pass was unsure. Blocks until they write.',
  remember:
    'Store one durable fact about this learner for future lessons: a strength, a gap, a preference (Socratic vs narrated), a background detail. One sentence. Use sparingly: 1 to 3 per lesson.',
  set_preferences:
    "Update how this learner wants to be taught, for this and every future lesson: the language to write in, how Socratic (style), how long each step runs (pace), their background, how they learn in their words, and where to take examples from. Call it when the learner TELLS you how they want to be taught (\"en español por favor\", \"just explain it, stop quizzing me through every step\", \"I'm a musician, use music\"), passing only the fields they touched, in their words. Do not infer it from a single reaction; that is what `remember` is for. An empty string clears a field.",
  read_material:
    'Read a range of the course material the learner attached (pages of a PDF, slides of a deck, parts of a document, files of a repository). Returns the text with a marker before each page, slide or file. For a repository pass `path` to read one file. Read the relevant range before planning and before teaching a node that maps to it. About ten pages per call. Only useful when the lesson has material (listed in your instructions, or announced in a tool result).',
  search_material: 'Find where something is covered in the attached course material. Returns the best-matching pages, slides or files with a snippet each. Use it to locate a definition, an example, a formula or a function before you read the range around it. Only useful when the lesson has material.',
  search_library:
    "Search the learner's library: the articles, videos, books, papers, courses and notes they keep across lessons (listed in your instructions when there are any). Matches titles, tags, notes and the fetched text. Returns entries with a snippet and the part it was found in. Search it before you plan, and when the learner asks for something to read or watch.",
  read_resource:
    "Read a range of parts of one library entry (an article's body, a paper's PDF, a video's description). About ten parts per call, with a marker before each. Pass the entry's id (from the catalog or a search hit) or its title. An entry with nothing fetched returns its URL and note; use WebFetch on the URL then.",
  suggest_resource:
    "Point the learner at one entry of their library, as a card in the lesson: which entry, why it is worth their time now, and where to look (a chapter, a section, a timestamp). Use it when a node locks and the entry deepens it, when the learner wants more, or when a source explains a step better than chat can. One at a time, only when it earns its place. Only entries in the library or ones you just saved with add_resource.",
  add_resource:
    "Save a source to the learner's library for later: a URL you found with WebSearch or read with WebFetch (the page is fetched and its text kept), with a one-sentence note on why and a few tags. Sparingly: one or two per lesson, and only sources you actually read. A URL already on the shelf is not duplicated; your note and tags are merged in.",
};

function buildTools(lessonId: string) {
  const quiz = tool(
    'quiz',
    TOOL_DESCRIPTIONS.quiz,
    {
      question: z.string().describe('The question, markdown with $LaTeX$ allowed. Do not restate it in prose.'),
      options: z.array(z.string()).min(2).max(3).describe('2 or 3 bare claims, no justification. The app adds "I don\'t know" itself.'),
      correct: z.array(z.number().int().min(0)).min(1).describe('0-based indices of the correct option(s). Usually exactly one.'),
      explanation: z.string().describe('Why the correct answer is correct, and what each distractor gets wrong. Shown only after answering.'),
      node_id: z.string().optional().describe('The plan node this question checks. Always pass it in the teach phase.'),
      purpose: z.enum(['probe', 'pretest', 'check', 'review']).optional().describe('"pretest": the attempt before teaching a node (not recorded against the learner, never locks). "check": the question that locks a node. Default: "probe" in the probe phase, "review" in a review session, else "check".'),
    },
    async (a) => text(await actions.quiz(lessonId, a)),
  );

  const ask = tool(
    'ask',
    TOOL_DESCRIPTIONS.ask,
    { question: z.string(), options: z.array(z.string()).max(4).optional().describe('Optional suggested answers.') },
    async (a) => text(await actions.ask(lessonId, a)),
  );

  const set_plan = tool(
    'set_plan',
    TOOL_DESCRIPTIONS.set_plan,
    { goal: z.string().describe('The learning goal in one sentence, as agreed with the learner.'), nodes: z.array(nodeSchema).min(3).max(12) },
    async (a) => text(await actions.setPlan(lessonId, { goal: a.goal, nodes: a.nodes as GraphNodeInput[] })),
  );

  const node_status = tool(
    'node_status',
    TOOL_DESCRIPTIONS.node_status,
    { id: z.string(), status: z.enum(['teaching', 'locked', 'shaky']) },
    async (a) => text(actions.nodeStatus(lessonId, a)),
  );

  const set_phase = tool('set_phase', TOOL_DESCRIPTIONS.set_phase, { phase: z.enum(['probe', 'plan', 'teach']) }, async (a) =>
    text(actions.phase(lessonId, a)),
  );

  const explain_back = tool(
    'explain_back',
    TOOL_DESCRIPTIONS.explain_back,
    {
      prompt: z.string().describe('What to explain, e.g. "Explain in your own words why the step size has to be below 2/L."'),
      rubric: z.string().describe('The 2 or 3 things a correct explanation must contain. Not shown to the learner.'),
      node_id: z.string().optional(),
    },
    async (a) => text(await actions.explainBack(lessonId, a)),
  );

  const remember = tool(
    'remember',
    TOOL_DESCRIPTIONS.remember,
    { fact: z.string(), kind: z.enum(['learner', 'preference', 'strength', 'gap']).optional() },
    async (a) => text(actions.remember(lessonId, a)),
  );

  const set_preferences = tool(
    'set_preferences',
    TOOL_DESCRIPTIONS.set_preferences,
    {
      language: z.string().optional().describe('The language to teach in, e.g. "Spanish". Empty string: the language the learner writes in.'),
      style: z.enum(['adaptive', 'socratic', 'narrated']).optional(),
      pace: z.enum(['brisk', 'standard', 'thorough']).optional(),
      background: z.string().optional().describe('Who they are and what they already know, in their words.'),
      how: z.string().optional().describe('What works for them and what does not, in their words.'),
      examples: z.string().optional().describe('Domains to draw examples and analogies from.'),
    },
    async (a) => text(actions.setPreferences(lessonId, a)),
  );

  const read_material = tool(
    'read_material',
    TOOL_DESCRIPTIONS.read_material,
    {
      name: z.string().optional().describe('Which material, by name (or part of it). Optional when only one is attached.'),
      path: z.string().optional().describe('Repository material only: the file to read, by path (exact, or a suffix such as "src/db.ts").'),
      from: z.number().int().min(1).optional().describe('First page, slide or file, 1-based. Default 1.'),
      to: z.number().int().min(1).optional().describe('Last page, slide or file, inclusive. Default: from + 9 (or the one file, with path).'),
    },
    async (a) => text(actions.readMaterial(lessonId, a)),
  );

  const search_material = tool(
    'search_material',
    TOOL_DESCRIPTIONS.search_material,
    {
      query: z.string().describe('A few words: the term, symbol or example you are looking for.'),
      name: z.string().optional().describe('Restrict to one file. Default: all attached material.'),
      limit: z.number().int().min(1).max(20).optional(),
    },
    async (a) => text(actions.searchMaterial(lessonId, a)),
  );

  const search_library = tool(
    'search_library',
    TOOL_DESCRIPTIONS.search_library,
    {
      query: z.string().describe('A few words: the topic, a term, an author. Empty lists the shelf.'),
      kind: z.enum(['article', 'video', 'book', 'paper', 'course', 'note']).optional().describe('Restrict to one kind.'),
      tag: z.string().optional().describe('Restrict to one tag.'),
      limit: z.number().int().min(1).max(20).optional(),
    },
    async (a) => text(actions.searchLibrary(lessonId, a)),
  );

  const read_resource = tool(
    'read_resource',
    TOOL_DESCRIPTIONS.read_resource,
    {
      id: z.string().optional().describe('The entry id, or the first characters of it.'),
      title: z.string().optional().describe('Or the entry title (or part of it).'),
      from: z.number().int().min(1).optional().describe('First part, 1-based. Default 1.'),
      to: z.number().int().min(1).optional().describe('Last part, inclusive. Default from + 9.'),
    },
    async (a) => text(actions.readResource(lessonId, a)),
  );

  const suggest_resource = tool(
    'suggest_resource',
    TOOL_DESCRIPTIONS.suggest_resource,
    {
      id: z.string().optional().describe('The entry id, or the first characters of it.'),
      title: z.string().optional().describe('Or the entry title (or part of it).'),
      why: z.string().describe('One or two sentences, to the learner: what this gives them that the lesson did not.'),
      where: z.string().optional().describe('Where to look: "chapter 3", "from 12:40", "the section on invariants".'),
      node_id: z.string().optional().describe('The plan node it deepens, if any.'),
    },
    async (a) => text(actions.suggestResource(lessonId, a)),
  );

  const add_resource = tool(
    'add_resource',
    TOOL_DESCRIPTIONS.add_resource,
    {
      url: z.string().describe('The page, video, paper or book to save.'),
      title: z.string().optional().describe('Override the fetched title.'),
      kind: z.enum(['article', 'video', 'book', 'paper', 'course', 'note']).optional().describe('Guessed from the URL when omitted.'),
      author: z.string().optional(),
      note: z.string().describe('One sentence, to the learner: why this is worth keeping.'),
      tags: z.array(z.string()).max(8).optional().describe('A few lowercase tags, e.g. ["calculus", "visual"].'),
    },
    async (a) => text(await actions.saveResource(lessonId, a)),
  );

  // The material and library tools are always registered: material can be
  // attached while a card is pending, and the tutor should be able to read
  // it in that same turn. Without material they return a clear error.
  return createSdkMcpServer({
    name: 'derive',
    version: '0.2.0',
    alwaysLoad: true,
    tools: [quiz, ask, set_plan, node_status, set_phase, explain_back, remember, set_preferences, read_material, search_material, search_library, read_resource, suggest_resource, add_resource],
  });
}

export const DERIVE_TOOL_NAMES = [
  'quiz', 'ask', 'set_plan', 'node_status', 'set_phase', 'explain_back', 'remember', 'set_preferences', 'read_material', 'search_material',
  'search_library', 'read_resource', 'suggest_resource', 'add_resource',
] as const;

// ---------- running a turn ----------

const TOOL_LABELS: Record<string, string> = {
  WebSearch: 'Verifying with a web search',
  WebFetch: 'Reading a source',
  mcp__derive__quiz: 'Writing a question',
  mcp__derive__ask: 'Asking',
  mcp__derive__set_plan: 'Drawing the plan',
  mcp__derive__node_status: 'Updating the graph',
  mcp__derive__set_phase: 'Changing phase',
  mcp__derive__explain_back: 'Preparing a teach-back',
  mcp__derive__remember: 'Taking a note',
  mcp__derive__set_preferences: 'Updating how you learn',
  mcp__derive__read_material: 'Reading your material',
  mcp__derive__search_material: 'Searching your material',
  mcp__derive__search_library: 'Searching your library',
  mcp__derive__read_resource: 'Reading from your library',
  mcp__derive__suggest_resource: 'Picking a resource for you',
  mcp__derive__add_resource: 'Saving a source to your library',
};

export async function runTurn(lessonId: string, prompt: string, opts: { echoUser?: string } = {}) {
  const lesson = getLesson(lessonId);
  if (!lesson) throw new Error('lesson not found');
  if (active.has(lessonId)) throw new Error('lesson is busy');

  if (opts.echoUser) emit(lessonId, 'user', { text: opts.echoUser });
  emit(lessonId, 'turn_start', {});

  const pendingNotices = takeNotices(lessonId);
  if (pendingNotices.length) prompt = `${pendingNotices.join('\n\n')}\n\nThen, the learner's message:\n${prompt}`;

  const q = query({
    prompt,
    options: {
      systemPrompt: SYSTEM_PROMPT + materialsSection(lessonId) + librarySection(lesson.learner_id, lesson.topic) + learnerProfile(lesson.learner_id, lessonId),
      cwd: DATA_DIR,
      settingSources: [],
      mcpServers: { derive: buildTools(lessonId) },
      tools: ['WebSearch', 'WebFetch'],
      allowedTools: ['WebSearch', 'WebFetch', ...DERIVE_TOOL_NAMES.map((n) => `mcp__derive__${n}`)],
      permissionMode: 'dontAsk',
      includePartialMessages: true,
      maxTurns: 400,
      model: MODEL,
      effort: EFFORT,
      resume: lesson.session_id ?? undefined,
      env: { ...process.env, CLAUDE_AGENT_SDK_CLIENT_APP: 'derive/0.2.0' },
    },
  });
  active.set(lessonId, q);

  // A text block is persisted the moment it starts and rewritten in place as
  // it grows (checkpointed every ~1.5 s, finalised at block end), so the
  // learner never sees prose that later vanishes: Stop, a dropped connection
  // or a server restart all keep what was written.
  let blockId: string | null = null;
  let blockSeq: number | null = null;
  let blockText = '';
  let lastCheckpoint = 0;
  let verified = 0;
  let ended = false;
  const endTurn = (payload: Record<string, unknown>) => {
    if (ended) return;
    ended = true;
    emit(lessonId, 'turn_end', payload);
  };
  const flushBlock = () => {
    if (blockId && blockSeq !== null) emitUpdate(lessonId, blockSeq, 'assistant', { id: blockId, text: blockText });
    blockId = null;
    blockSeq = null;
    blockText = '';
  };

  try {
    for await (const msg of q as AsyncIterable<SDKMessage>) {
      switch (msg.type) {
        case 'system':
          if (msg.subtype === 'init' && msg.session_id !== lesson.session_id) setSessionId(lessonId, msg.session_id);
          break;
        case 'stream_event': {
          if (msg.parent_tool_use_id) break;
          const ev = msg.event;
          if (ev.type === 'content_block_start') {
            const cb = ev.content_block;
            if (cb.type === 'text') {
              flushBlock();
              blockId = randomUUID();
              blockSeq = emit(lessonId, 'assistant', { id: blockId, text: '', partial: true }).seq;
              lastCheckpoint = Date.now();
            } else if (cb.type === 'tool_use') {
              flushBlock();
              if (cb.name === 'WebSearch' || cb.name === 'WebFetch') verified += 1;
              emitEphemeral(lessonId, 'status', { text: TOOL_LABELS[cb.name] ?? `Using ${cb.name}` });
            } else if (cb.type === 'thinking') {
              emitEphemeral(lessonId, 'status', { text: 'Thinking' });
            }
          } else if (ev.type === 'content_block_delta') {
            if (ev.delta.type === 'text_delta' && blockId) {
              blockText += ev.delta.text;
              emitEphemeral(lessonId, 'delta', { id: blockId, text: ev.delta.text });
              if (blockSeq !== null && Date.now() - lastCheckpoint > 1500) {
                checkpoint(lessonId, blockSeq, { id: blockId, text: blockText, partial: true });
                lastCheckpoint = Date.now();
              }
            }
          } else if (ev.type === 'content_block_stop') {
            flushBlock();
          }
          break;
        }
        case 'result': {
          flushBlock();
          if (stopping.has(lessonId)) {
            endTurn({ ok: true, interrupted: true });
          } else if (msg.subtype === 'success') {
            endTurn({ ok: true, cost_usd: msg.total_cost_usd ?? null, duration_ms: msg.duration_ms, verified });
          } else {
            const errs = (msg as { errors?: string[] }).errors;
            endTurn({ ok: false, error: Array.isArray(errs) && errs.length ? errs.join('; ') : msg.subtype });
          }
          break;
        }
        default:
          break;
      }
    }
  } catch (err) {
    flushBlock();
    endTurn({ ok: false, error: err instanceof Error ? err.message : String(err) });
  } finally {
    // The stream can end without a result (Stop, the CLI exiting). The
    // learner still needs the prose kept and the turn marked finished.
    flushBlock();
    endTurn({ ok: true, interrupted: true });
    active.delete(lessonId);
    stopping.delete(lessonId);
    cancelPending(lessonId);
  }
}
