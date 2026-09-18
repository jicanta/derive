/**
 * The tutor's tool contract, declared once.
 *
 * Every tool the tutor can call is declared here: the name the model calls, the
 * description it reads to decide when to call it, the zod raw shape of its
 * input, the status line the learner sees while it runs, and the surfaces it is
 * registered on — the in-process Claude agent, the stdio MCP server the terminal
 * drivers talk to, and the HTTP action route those tools proxy through.
 *
 * The same tools used to be written out three times, over `server/src/agent.ts`,
 * `server/src/mcp.ts` and the action switch in `server/src/index.ts`, and the
 * copies had already drifted. A description is what the model actually reads, so
 * a drifting copy is a drifting tutor. `server/test/wire-surface.json` freezes the
 * projection of this registry onto all three surfaces, which turns any change to
 * the contract into a reviewable diff instead of a silent one.
 *
 * This module has no import-time side effect beyond building its own lookup map,
 * so anything may import it, including a test with no database behind it.
 */
import { z } from 'zod';

/** Where a tool is registered: the in-process Claude agent, the stdio MCP server, the HTTP action route. */
export type ToolSurface = 'agent' | 'mcp' | 'http';

/** One tool, declared once for every surface it appears on. */
export type ToolSpec = {
  /** The name the model calls. */
  name: string;
  /** What the model reads to decide when to call it. Changing this changes what the tutor does. */
  description: string;
  /** The raw-shape object form both the Agent SDK's `tool()` and MCP's `inputSchema` take. */
  shape: z.ZodRawShape;
  /** The surfaces this tool is registered on. */
  surfaces: readonly ToolSurface[];
  /** The status line shown to the learner while it runs, for the tools that have one. */
  label?: string;
};

/** One node of a lesson plan, as the model writes it. */
export const nodeSchema = z.object({
  id: z.string().describe('Short stable id, e.g. "packets".'),
  label: z.string().describe('The claim in plain words a learner reads at a glance, 3 to 7 words, e.g. "A line can output any real number". No formulas, symbols, abbreviations or private shorthand: this is what the graph shows.'),
  kind: z.enum(['truth', 'derived', 'goal']),
  summary: z.string().describe('One full sentence stating the claim this node stands for. Shown to the learner next to the label; write it for them.'),
  depends_on: z.array(z.string()).optional().describe('Ids of the nodes this one is derived from. Empty for roots.'),
});

/** Every tool, in the order they are emitted on every surface. */
export const TOOL_REGISTRY: readonly ToolSpec[] = [
  {
    name: 'quiz',
    description: 'Ask the learner ONE graded multiple-choice question with a known correct answer. The app renders the options, the learner picks and says whether they are sure, the app grades it and reveals your explanation. Returns what they picked, whether it was correct, how sure they were, and what to do next. Set `purpose`: "pretest" for the attempt you ask for BEFORE teaching a derived node (a miss is expected and is not recorded against them), "check" for the question that locks a node, "cumulative" for the end-of-lesson quiz; the probe phase and reviews of copied nodes are recognised on their own. Set `tests` to what the question tests (intuition, procedure, transfer): a derived node locks only after a correct intuition or transfer question. Blocks until the learner answers.',
    shape: {
      question: z.string().describe('The question, markdown with $LaTeX$ allowed. Do not restate it in prose.'),
      options: z.array(z.string()).min(2).max(3).describe('2 or 3 bare claims, no justification. The app adds "I don\'t know" itself.'),
      correct: z.array(z.number().int().min(0)).min(1).describe('0-based indices of the correct option(s). Usually exactly one.'),
      explanation: z.string().describe('Why the correct answer is correct, and what each distractor gets wrong. Shown only after answering.'),
      node_id: z.string().optional().describe('The plan node this question checks. Always pass it in the teach phase.'),
      purpose: z.enum(['probe', 'pretest', 'check', 'cumulative', 'review']).optional().describe('"pretest": the attempt before teaching a node (not recorded against the learner, never locks). "check": the question that locks a node. "cumulative": the end-of-lesson quiz over every node, after the goal locks. "review": a node from an earlier lesson (the warm-up, or a review session). Default: "review" on a copied node, "probe" in the probe phase, else "check".'),
      tests: z.enum(['intuition', 'procedure', 'transfer']).optional().describe('What the question tests. "intuition": why the claim must be so, what breaks if a premise changes, which picture or geometric reading is right, an estimate before any computation. "procedure": carry out the steps. "transfer": a problem of a kind this lesson has not shown. A derived node locks only after a correct intuition or transfer question; always set this in the teach phase.'),
    },
    surfaces: ['agent', 'mcp', 'http'],
    label: 'Writing a question',
  },
  {
    name: 'ask',
    description: 'Ask the learner a question with no right answer (goal, preference, energy, what next). Optionally offer choices; the learner can always type a free answer. Blocks until they answer.',
    shape: { question: z.string(), options: z.array(z.string()).max(4).optional().describe('Optional suggested answers.') },
    surfaces: ['agent', 'mcp', 'http'],
    label: 'Asking',
  },
  {
    name: 'set_plan',
    description: 'Submit the lesson plan as a dependency DAG: unconditional truths at the roots (kind "truth"), derived steps (kind "derived"), exactly one "goal" sink. The app draws it and asks the learner to approve. Blocks until they approve or request changes; if they request changes, revise and call again.',
    shape: { goal: z.string().describe('The learning goal in one sentence, as agreed with the learner.'), nodes: z.array(nodeSchema).min(3).max(12) },
    surfaces: ['agent', 'mcp', 'http'],
    label: 'Drawing the plan',
  },
  {
    name: 'node_status',
    description: 'Update the state of a plan node: "teaching" when you start it, "locked" when a confident check confirmed it (the node is then scheduled for review by how well the check went; the reply says in how many days, and which nodes below it earned implicit review credit), "shaky" when it did not land after two checks (the reply names the nodes it rests on and what the checks on each showed, for targeted remediation). Locking a derived node is refused until a correct intuition or transfer question on it exists; locking the goal returns the instructions for the cumulative quiz.',
    shape: { id: z.string(), status: z.enum(['teaching', 'locked', 'shaky']) },
    surfaces: ['agent', 'mcp', 'http'],
    label: 'Updating the graph',
  },
  {
    name: 'set_phase',
    description: 'Announce which phase of the lesson you are in.',
    shape: { phase: z.enum(['probe', 'plan', 'teach']) },
    surfaces: ['agent', 'mcp', 'http'],
    label: 'Changing phase',
  },
  {
    name: 'explain_back',
    description: 'Teach-back check: ask the learner to explain a node in their own words (2 to 5 sentences), or to say WHY a claim must be true. Write the rubric first: the 2 or 3 things a correct explanation must contain. Returns their explanation for you to grade. Use it at least once per lesson on the most important derived node, and whenever a pass was unsure. Blocks until they write.',
    shape: {
      prompt: z.string().describe('What to explain, e.g. "Explain in your own words why the step size has to be below 2/L."'),
      rubric: z.string().describe('The 2 or 3 things a correct explanation must contain. Not shown to the learner.'),
      node_id: z.string().optional(),
    },
    surfaces: ['agent', 'mcp', 'http'],
    label: 'Preparing a teach-back',
  },
  {
    name: 'remember',
    description: 'Store one durable fact about this learner for future lessons: a strength, a gap, a preference (Socratic vs narrated), a background detail. One sentence. Use sparingly: 1 to 3 per lesson.',
    shape: { fact: z.string(), kind: z.enum(['learner', 'preference', 'strength', 'gap']).optional() },
    surfaces: ['agent', 'mcp', 'http'],
    label: 'Taking a note',
  },
  {
    name: 'set_preferences',
    description: "Update how this learner wants to be taught, for this and every future lesson: the language to write in, how Socratic (style), how long each step runs (pace), their background, how they learn in their words, and where to take examples from. Call it when the learner TELLS you how they want to be taught (\"en español por favor\", \"just explain it, stop quizzing me through every step\", \"I'm a musician, use music\"), passing only the fields they touched, in their words. Do not infer it from a single reaction; that is what `remember` is for. An empty string clears a field.",
    shape: {
      language: z.string().optional().describe('The language to teach in, e.g. "Spanish". Empty string: the language the learner writes in.'),
      style: z.enum(['adaptive', 'socratic', 'narrated']).optional(),
      pace: z.enum(['brisk', 'standard', 'thorough']).optional(),
      background: z.string().optional().describe('Who they are and what they already know, in their words.'),
      how: z.string().optional().describe('What works for them and what does not, in their words.'),
      examples: z.string().optional().describe('Domains to draw examples and analogies from.'),
    },
    surfaces: ['agent', 'mcp', 'http'],
    label: 'Updating how you learn',
  },
  {
    name: 'read_material',
    description: 'Read a range of the course material the learner attached (pages of a PDF, slides of a deck, parts of a document, files of a repository). Returns the text with a marker before each page, slide or file. For a repository pass `path` to read one file. Read the relevant range before planning and before teaching a node that maps to it. About ten pages per call. Only useful when the lesson has material (listed in your instructions, or announced in a tool result).',
    shape: {
      name: z.string().optional().describe('Which material, by name (or part of it). Optional when only one is attached.'),
      path: z.string().optional().describe('Repository material only: the file to read, by path (exact, or a suffix such as "src/db.ts").'),
      from: z.number().int().min(1).optional().describe('First page, slide or file, 1-based. Default 1.'),
      to: z.number().int().min(1).optional().describe('Last page, slide or file, inclusive. Default: from + 9 (or the one file, with path).'),
    },
    surfaces: ['agent', 'mcp', 'http'],
    label: 'Reading your material',
  },
  {
    name: 'search_material',
    description: 'Find where something is covered in the attached course material. Returns the best-matching pages, slides or files with a snippet each. Use it to locate a definition, an example, a formula or a function before you read the range around it. Only useful when the lesson has material.',
    shape: {
      query: z.string().describe('A few words: the term, symbol or example you are looking for.'),
      name: z.string().optional().describe('Restrict to one file. Default: all attached material.'),
      limit: z.number().int().min(1).max(20).optional(),
    },
    surfaces: ['agent', 'mcp', 'http'],
    label: 'Searching your material',
  },
  {
    name: 'search_library',
    description: "Search the learner's library: the articles, videos, books, papers, courses and notes they keep across lessons (listed in your instructions when there are any). Matches titles, tags, notes and the fetched text. Returns entries with a snippet and the part it was found in. Search it before you plan, and when the learner asks for something to read or watch.",
    shape: {
      query: z.string().describe('A few words: the topic, a term, an author. Empty lists the shelf.'),
      kind: z.enum(['article', 'video', 'book', 'paper', 'course', 'note']).optional().describe('Restrict to one kind.'),
      tag: z.string().optional().describe('Restrict to one tag.'),
      limit: z.number().int().min(1).max(20).optional(),
    },
    surfaces: ['agent', 'mcp', 'http'],
    label: 'Searching your library',
  },
  {
    name: 'read_resource',
    description: "Read a range of parts of one library entry (an article's body, a paper's PDF, a video's description). About ten parts per call, with a marker before each. Pass the entry's id (from the catalog or a search hit) or its title. An entry with nothing fetched returns its URL and note; fetch the URL yourself then.",
    shape: {
      id: z.string().optional().describe('The entry id, or the first characters of it.'),
      title: z.string().optional().describe('Or the entry title (or part of it).'),
      from: z.number().int().min(1).optional().describe('First part, 1-based. Default 1.'),
      to: z.number().int().min(1).optional().describe('Last part, inclusive. Default from + 9.'),
    },
    surfaces: ['agent', 'mcp', 'http'],
    label: 'Reading from your library',
  },
  {
    name: 'suggest_resource',
    description: "Point the learner at one entry of their library, as a card in the lesson: which entry, why it is worth their time now, and where to look (a chapter, a section, a timestamp). Use it when a node locks and the entry deepens it, when the learner wants more, or when a source explains a step better than chat can. One at a time, only when it earns its place. Only entries in the library or ones you just saved with add_resource.",
    shape: {
      id: z.string().optional().describe('The entry id, or the first characters of it.'),
      title: z.string().optional().describe('Or the entry title (or part of it).'),
      why: z.string().describe('One or two sentences, to the learner: what this gives them that the lesson did not.'),
      where: z.string().optional().describe('Where to look: "chapter 3", "from 12:40", "the section on invariants".'),
      node_id: z.string().optional().describe('The plan node it deepens, if any.'),
    },
    surfaces: ['agent', 'mcp', 'http'],
    label: 'Picking a resource for you',
  },
  {
    name: 'add_resource',
    description: "Save a source to the learner's library for later: a URL you found with a web search or read (the page is fetched and its text kept), with a one-sentence note on why and a few tags. Sparingly: one or two per lesson, and only sources you actually read. A URL already on the shelf is not duplicated; your note and tags are merged in.",
    shape: {
      url: z.string().describe('The page, video, paper or book to save.'),
      title: z.string().optional().describe('Override the fetched title.'),
      kind: z.enum(['article', 'video', 'book', 'paper', 'course', 'note']).optional().describe('Guessed from the URL when omitted.'),
      author: z.string().optional(),
      note: z.string().describe('One sentence, to the learner: why this is worth keeping.'),
      tags: z.array(z.string()).max(8).optional().describe('A few lowercase tags, e.g. ["calculus", "visual"].'),
    },
    surfaces: ['agent', 'mcp', 'http'],
    label: 'Saving a source to your library',
  },
];

const byName = new Map<string, ToolSpec>();
for (const spec of TOOL_REGISTRY) {
  if (byName.has(spec.name)) throw new Error(`duplicate tool in the registry: ${spec.name}`);
  byName.set(spec.name, spec);
}

/** The spec for one tool. Throws when the name is not in the registry. */
export function toolSpec(name: string): ToolSpec {
  const spec = byName.get(name);
  if (!spec) throw new Error(`unknown tool: ${name}`);
  return spec;
}

/** Whether a name is a tool in the registry. */
export const isTool = (name: string) => byName.has(name);

/** The tools registered on one surface, in registry declaration order. */
export function toolsFor(surface: ToolSurface): ToolSpec[] {
  return TOOL_REGISTRY.filter((s) => s.surfaces.includes(surface));
}

/** A tool's input shape projected to JSON Schema: the form every provider's wire format is derived from. */
export function jsonSchemaOf(spec: ToolSpec) {
  return z.toJSONSchema(z.object(spec.shape));
}

/** The fourteen tutor tools: the ones the in-process agent registers, in declaration order. */
export const DERIVE_TOOL_NAMES: readonly string[] = toolsFor('agent').map((s) => s.name);

/** The status line each tool shows the learner while it runs. */
export const TOOL_LABELS: Record<string, string> = Object.fromEntries(TOOL_REGISTRY.filter((s) => s.label).map((s) => [s.name, s.label as string]));
