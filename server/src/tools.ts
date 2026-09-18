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
 * A few tools genuinely read differently on one surface, because the surface
 * itself differs: the terminal drivers answer cards through `answer` rather than
 * blocking, and only the external path runs the teach gate. Those differences are
 * declared here too, under `per_surface`, so the fact that a tool says two things
 * is visible in one file and shows up in the frozen snapshot. A difference that is
 * not declared here cannot exist: every surface reads its contract from this
 * module, and `server/test/wire-surface.test.ts` fails when the snapshot shows a
 * difference no entry declares.
 *
 * This module has no import-time side effect beyond building its own lookup map,
 * so anything may import it, including a test with no database behind it.
 */
import { z } from 'zod';

/** Where a tool is registered: the in-process Claude agent, the stdio MCP server, the HTTP action route. */
export type ToolSurface = 'agent' | 'mcp' | 'http';

/** How one tool's contract differs on one surface. Absent means the surface reads the registry's own description and shape. */
export type SurfaceContract = {
  /** Replaces the description on this surface, in full. */
  description?: string;
  /** Laid over the registry shape on this surface: a named field replaces its namesake, a new one is appended. */
  shape?: z.ZodRawShape;
};

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
  /** Where this tool deliberately reads differently on a surface. Declared, never inferred. */
  per_surface?: Partial<Record<ToolSurface, SurfaceContract>>;
};

/** One node of a lesson plan, as the model writes it. */
export const nodeSchema = z.object({
  id: z.string().describe('Short stable id, e.g. "packets".'),
  label: z.string().describe('The claim in plain words a learner reads at a glance, 3 to 7 words, e.g. "A line can output any real number". No formulas, symbols, abbreviations or private shorthand: this is what the graph shows.'),
  kind: z.enum(['truth', 'derived', 'goal']),
  summary: z.string().describe('One full sentence stating the claim this node stands for. Shown to the learner next to the label; write it for them.'),
  depends_on: z.array(z.string()).optional().describe('Ids of the nodes this one is derived from. Empty for roots.'),
});

/**
 * Appended to the four card tools on the MCP surface only. A terminal driver
 * does not block on a card: it gets the card back as text and settles it with
 * `answer` on the learner's next message. That is a fact about the surface, not
 * about the method, which is why it is text the MCP surface adds rather than
 * text the registry holds for everyone.
 */
const MCP_TERMINAL_NOTE =
  ' In a lesson answered from the terminal (answer_in "terminal") this returns at once with the card as text: show it verbatim, end your turn, and when the learner replies pass their message to `answer`.';

/** The plan node as the MCP surface states it: the same five fields, described more briefly for a terminal driver. */
const mcpNodeSchema = z.object({
  id: z.string().describe('Short stable id, e.g. "packets".'),
  label: z.string().describe('The claim in plain words, 3 to 7 words, no formulas or shorthand. This is what the graph shows.'),
  kind: z.enum(['truth', 'derived', 'goal']),
  summary: z.string().describe('One full sentence stating the claim. Shown to the learner next to the label.'),
  depends_on: z.array(z.string()).optional(),
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
    per_surface: {
      // The terminal path is the only one that runs the teach gate (`teachingGap`
      // in server/src/index.ts), so the refusal it can hit is stated here and
      // nowhere else; `already_held` is likewise a terminal-driver field.
      mcp: {
        description:
          'Ask the learner ONE graded multiple-choice question with a known correct answer. The server grades it and returns what they picked, whether it was correct, how sure they were, and what to do next; you never grade it yourself. Never leak the answer in the question or options. Options are 2 or 3 bare claims; the app adds "I don\'t know". Set `purpose`: "pretest" for the attempt you ask for BEFORE teaching a derived node (a miss is expected, not recorded against them, never locks), "check" for the question that locks a node, "cumulative" for the end-of-lesson quiz after the goal locks. Set `tests` to what the question tests: a derived node locks only after a correct "intuition" or "transfer" question on it. In the teach phase a check for a node is refused until you have actually written the teaching for that node in the terminal (several paragraphs: motivate, establish, connect), so teach first, then check; a pretest is allowed before the teaching. In a browser-answered lesson this blocks until they answer.' +
          MCP_TERMINAL_NOTE,
        shape: {
          question: z.string(),
          options: z.array(z.string()).min(2).max(3),
          correct: z.array(z.number().int().min(0)).min(1),
          explanation: z.string(),
          node_id: z.string().optional(),
          purpose: z.enum(['probe', 'pretest', 'check', 'cumulative', 'review']).optional().describe('Default: "review" on a node copied from an earlier lesson (a warm-up node, a review session), "probe" in the probe phase, else "check".'),
          tests: z.enum(['intuition', 'procedure', 'transfer']).optional().describe('"intuition": why the claim must be so, what breaks if a premise changes, which picture is right, an estimate before computing. "procedure": carry out the steps. "transfer": a problem of a kind this lesson has not shown. Always set it in the teach phase.'),
          already_held: z.boolean().optional().describe('Set true only when the probe already showed the learner holds this node and you are confirming rather than teaching it. Say so to the learner in one sentence.'),
        },
      },
    },
  },
  {
    name: 'ask',
    description: 'Ask the learner a question with no right answer (goal, preference, energy, what next). Optionally offer choices; the learner can always type a free answer. Blocks until they answer.',
    shape: { question: z.string(), options: z.array(z.string()).max(4).optional().describe('Optional suggested answers.') },
    surfaces: ['agent', 'mcp', 'http'],
    label: 'Asking',
    per_surface: {
      mcp: {
        description: 'Ask the learner a question with no right answer (goal, preference, what next). Optional suggested answers. In a browser-answered lesson this blocks until they answer.' + MCP_TERMINAL_NOTE,
        shape: { options: z.array(z.string()).max(4).optional() },
      },
    },
  },
  {
    name: 'set_plan',
    description: 'Submit the lesson plan as a dependency DAG: unconditional truths at the roots (kind "truth"), derived steps (kind "derived"), exactly one "goal" sink. The app draws it and asks the learner to approve. Blocks until they approve or request changes; if they request changes, revise and call again.',
    shape: { goal: z.string().describe('The learning goal in one sentence, as agreed with the learner.'), nodes: z.array(nodeSchema).min(3).max(12) },
    surfaces: ['agent', 'mcp', 'http'],
    label: 'Drawing the plan',
    per_surface: {
      mcp: {
        description:
          'Submit the lesson plan as a dependency DAG (truth roots, derived steps, one goal sink). Drawn in the browser; in a browser-answered lesson this blocks until the learner approves or asks for changes.' + MCP_TERMINAL_NOTE,
        shape: { goal: z.string(), nodes: z.array(mcpNodeSchema).min(3).max(12) },
      },
    },
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
    per_surface: { mcp: { description: 'Announce the lesson phase: probe, plan or teach.' } },
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
    per_surface: {
      mcp: {
        description:
          'Teach-back: ask the learner to explain a node in their own words. Write the rubric first (what a correct explanation must contain). Returns their text for you to grade. In a browser-answered lesson this blocks until they write.' + MCP_TERMINAL_NOTE,
        shape: { prompt: z.string(), rubric: z.string() },
      },
    },
  },
  {
    name: 'remember',
    description: 'Store one durable fact about this learner for future lessons: a strength, a gap, a preference (Socratic vs narrated), a background detail. One sentence. Use sparingly: 1 to 3 per lesson.',
    shape: { fact: z.string(), kind: z.enum(['learner', 'preference', 'strength', 'gap']).optional() },
    surfaces: ['agent', 'mcp', 'http'],
    label: 'Taking a note',
    per_surface: { mcp: { description: 'Store one durable fact about this learner for future lessons (strength, gap, preference). One sentence; use sparingly.' } },
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
    per_surface: {
      // The MCP surface can be called outside a lesson, so it takes the learner
      // to act on; the in-process agent always has one.
      mcp: {
        description:
          "Update how this learner wants to be taught, for this and every future lesson: the language to write in, how Socratic (style), how long each step runs (pace), their background, how they learn in their words, and where to take examples from. Call it when the learner TELLS you how they want to be taught (\"en español por favor\", \"just explain it, stop quizzing me through every step\", \"I'm a musician, use music\"), passing only the fields they touched, in their words. Do not infer it from a single reaction; that is what `remember` is for. An empty string clears a field. With no fields it returns the current preferences.",
        shape: { learner: z.string().optional().describe('A learner name or id. Default: the current lesson\'s learner.') },
      },
    },
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
    per_surface: {
      mcp: {
        description:
          'Read a range of the course material attached to this lesson: pages of a PDF, slides of a deck, parts of a document, or files of a repository (pass `path` for one file). About ten per call; the text carries a marker before each page, slide or file. Read before planning and before teaching a node that maps to it.',
        shape: {
          name: z.string().optional().describe('Which material, by name or part of it. Optional when only one is attached.'),
          to: z.number().int().min(1).optional().describe('Last page, slide or file, inclusive. Default from + 9.'),
        },
      },
    },
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
    per_surface: {
      mcp: {
        description: 'Find where something is covered in the attached course material. Returns the best-matching pages, slides or files with a snippet each.',
        shape: { query: z.string(), name: z.string().optional() },
      },
    },
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
    per_surface: {
      mcp: {
        description:
          "Search the learner's library: the articles, videos, books, papers, courses and notes they keep across lessons (start_lesson returns the catalog under `library` when there is one). Matches titles, tags, notes and the fetched text; returns entries with a snippet and the part it was found in. Search it before you plan, and when the learner asks for something to read or watch.",
        shape: { kind: z.enum(['article', 'video', 'book', 'paper', 'course', 'note']).optional(), tag: z.string().optional() },
      },
    },
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
    per_surface: {
      mcp: {
        description:
          "Read a range of parts of one library entry (an article's body, a paper's PDF, a video's description), about ten parts per call with a marker before each. Pass the entry id (from the catalog or a search hit) or its title. An entry with nothing fetched returns its URL and the learner's note; read the URL yourself then.",
        shape: {
          id: z.string().optional().describe('The entry id, or its first characters.'),
          title: z.string().optional().describe('Or the title (or part of it).'),
          from: z.number().int().min(1).optional(),
          to: z.number().int().min(1).optional(),
        },
      },
    },
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
    per_surface: {
      mcp: {
        description:
          "Point the learner at one entry of their library as a card in the companion: which entry, why it is worth their time now, and where to look (a chapter, a section, a timestamp). Use it when a node locks and the entry deepens it, when the learner wants more, or when a source explains a step better than chat can. One at a time, only when it earns its place; only entries in the library or ones you just saved.",
        shape: {
          id: z.string().optional(),
          title: z.string().optional(),
          why: z.string().describe('One or two sentences, to the learner.'),
          where: z.string().optional().describe('"chapter 3", "from 12:40", "the section on invariants".'),
          node_id: z.string().optional(),
        },
      },
    },
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
    per_surface: {
      mcp: {
        description:
          "Save a source to the learner's library: a URL you found with a web search or read (the server fetches it and keeps its text), with a one-sentence note on why and a few tags. Sparingly: one or two per lesson, only sources you actually read. A URL already on the shelf is not duplicated; the note and tags are merged in.",
        shape: {
          url: z.string(),
          title: z.string().optional(),
          kind: z.enum(['article', 'video', 'book', 'paper', 'course', 'note']).optional().describe('Guessed from the URL when omitted.'),
          note: z.string().describe('Why this is worth keeping, to the learner.'),
          tags: z.array(z.string()).max(8).optional(),
        },
      },
    },
  },
  // The driver tools below reach only the terminal drivers: they open and close
  // a lesson, attach material to it, carry a terminal reply back to the card
  // that is open, and read the learner's shelf outside a lesson. They are in the
  // registry because `tools/list` returns them to the Claude Code plugin today,
  // so a snapshot that skipped them would not describe what the plugin sees.
  {
    name: 'start_lesson',
    description: 'Start a Derive lesson for a topic. Opens the companion view in the browser, where quizzes, the plan and the dependency graph are rendered. Call once at the start of a lesson, before any quiz. Returns the lesson id, the URL, where the learner answers cards (browser or terminal), what is already known about this learner, a `warmup` (nodes from earlier lessons that are due, to be retrieved before the probe) when there is one, and, when `files` were given, a brief of the course material (its outline, or its full text when short) with instructions on how to use it.',
    shape: {
      topic: z.string(),
      files: z
        .array(z.string())
        .optional()
        .describe('Course material to prepare for: local paths to .pdf, .pptx, .docx, .md or .txt files, a folder of them, a repository folder, or a GitHub / git URL. Pass everything the learner named.'),
      answer_in: z
        .enum(['browser', 'terminal'])
        .optional()
        .describe('Where the learner answers cards. "terminal": quiz, ask, set_plan and explain_back return at once and the learner replies in this conversation. Default: the DERIVE_ANSWER_IN environment variable, else "browser".'),
      learner: z.string().optional().describe('Which learner profile this lesson belongs to, by name. Default: DERIVE_LEARNER, else the first learner.'),
      open_browser: z.boolean().optional().describe('Default true.'),
      review: z
        .boolean()
        .optional()
        .describe('Start a spaced-repetition review session instead of a lesson: the server picks the nodes due (interleaved across topics, with the nodes they rest on) and returns them with instructions. The topic is then ignored.'),
    },
    surfaces: ['mcp'],
  },
  {
    name: 'attach_material',
    description: 'Attach course material to the current lesson: local .pdf, .pptx, .docx, .md or .txt files, a folder of them, a repository folder, or a GitHub / git URL. Returns a brief of it: read the relevant pages or files with read_material before changing the plan.',
    shape: { files: z.array(z.string()).min(1).describe('Paths or URLs. A folder with a .git or a package manifest is imported as a repository.') },
    surfaces: ['mcp'],
  },
  {
    name: 'answer',
    description: "Terminal-answered lessons only: hand the learner's reply to the card that is open (the last quiz, ask, set_plan or explain_back). Pass their message verbatim as `reply`: a letter or number picks a quiz option (\"B?\", \"B, not sure\" or \"I think B\" picks it as unsure), \"?\" or \"I don't know\" alone is the don't-know option, \"yes\" approves a plan, anything else is feedback or a message. The server parses and grades it and returns exactly what the blocking tool would have returned (result, correct_options, or the learner's text). If the learner answered in the browser instead, returns that result. Call it once per card, right after their reply, before anything else.",
    shape: {
      reply: z.string().describe("The learner's message, verbatim. May be empty to collect an answer they gave in the browser."),
      prompt_id: z.string().optional().describe('The card, from the tool that opened it. Optional: the open card is the default.'),
    },
    surfaces: ['mcp', 'http'],
  },
  {
    name: 'answer_in',
    description: 'Switch where the learner answers cards for the rest of this lesson: "terminal" (cards return at once, replies come through `answer`) or "browser" (cards block until answered there). Use when the learner asks to answer in the other place.',
    shape: { where: z.enum(['browser', 'terminal']) },
    surfaces: ['mcp', 'http'],
  },
  {
    name: 'learner_profile',
    description: 'What Derive already knows about a learner: how they want to be taught (their own preferences), locked nodes by topic, shaky nodes, misconceptions (with whether they were held with confidence), notes, and the nodes due for review. Defaults to the learner of the current lesson.',
    shape: { learner: z.string().optional().describe('A learner name or id. Default: the current lesson\'s learner.') },
    surfaces: ['mcp'],
  },
  {
    name: 'learners',
    description: 'List the learner profiles Derive knows, or create one by name. Each learner has their own lessons, memory, misconceptions and review queue.',
    shape: { create: z.string().optional().describe('A name to create (no-op if it exists).') },
    surfaces: ['mcp'],
  },
  {
    name: 'end_lesson',
    description: 'Mark the current lesson turn as finished in the companion view.',
    shape: {},
    surfaces: ['mcp'],
  },
  {
    name: 'library',
    description: "The learner's library outside a lesson: the whole shelf as a catalog, or the entries matching a topic. Lessons get this automatically from start_lesson.",
    shape: { topic: z.string().optional().describe('Rank entries by relevance to this.'), learner: z.string().optional() },
    surfaces: ['mcp'],
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

/** What a tool says on one surface: the registry's description, unless the tool declares a different one for that surface. */
export function descriptionFor(spec: ToolSpec, surface: ToolSurface): string {
  return spec.per_surface?.[surface]?.description ?? spec.description;
}

/** A tool's raw input shape on one surface, with any declared per-surface fields laid over the registry's. */
export function shapeFor(spec: ToolSpec, surface: ToolSurface): z.ZodRawShape {
  const over = spec.per_surface?.[surface]?.shape;
  return over ? { ...spec.shape, ...over } : spec.shape;
}

/** Whether this tool declares that it reads differently on this surface. The test asserts no undeclared difference exists. */
export function differsOnSurface(spec: ToolSpec, surface: ToolSurface): boolean {
  const over = spec.per_surface?.[surface];
  return !!over && (over.description !== undefined || over.shape !== undefined);
}

/** A tool's input shape projected to JSON Schema: the form every provider's wire format is derived from. */
export function jsonSchemaOf(spec: ToolSpec, surface?: ToolSurface) {
  return z.toJSONSchema(z.object(surface ? shapeFor(spec, surface) : spec.shape));
}

/** Every tool in the registry, in declaration order: the whole surface a driver can see. */
export const ALL_TOOL_NAMES: readonly string[] = TOOL_REGISTRY.map((s) => s.name);

/** The fourteen tutor tools: the ones the in-process agent registers, in declaration order. */
export const DERIVE_TOOL_NAMES: readonly string[] = toolsFor('agent').map((s) => s.name);

/** The status line each tool shows the learner while it runs. */
export const TOOL_LABELS: Record<string, string> = Object.fromEntries(TOOL_REGISTRY.filter((s) => s.label).map((s) => [s.name, s.label as string]));
