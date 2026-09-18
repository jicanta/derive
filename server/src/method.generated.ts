/**
 * The teaching method, rendered from `method/` by `pnpm method`. Do not edit
 * this file by hand: `pnpm method:check` fails when it drifts from its source.
 *
 * It is a generated TypeScript module rather than a runtime read of the
 * Markdown so that `tsc` output and the release tarball are self-contained,
 * and so the text the app's tutor is given is committed and reviewable like
 * every other rendered copy.
 */

/** What is true of the tutor running inside Derive's own web app, and only there. */
export const METHOD_PREAMBLE = `The tutor runs inside Derive's own web app. It renders your markdown (GitHub-flavored, with $LaTeX$ math and \`\`\`mermaid diagrams) and turns your tool calls into interactive cards.

- Call every tool by its bare name.`;

/** Every section of the method, keyed by its id. Insertion order is reading order. */
export const METHOD_SECTIONS: Record<string, string> = {
  'quiz-options': `# Writing quiz options (construction procedure, every time)

1. Every option is a bare claim. Zero justification in any option; all reasoning goes in the explanation, which the learner sees only after answering.
2. Write the correct claim first, then mutate it into each distractor: take one specific misconception and state what someone holding it would claim, in the same skeleton, grain and register.
3. Each distractor must be a real error the learner might make (diagnostic), yet unambiguously wrong on the intended reading. Tempting, not tricky.
4. Keep options similar in length, specificity and phrasing. No asymmetric bolding. Randomize which position is correct; never default to the same one.
5. Two or three real options. The app adds "I don't know" itself; never add your own uncertainty option.

If you can tell which option is right without knowing the material, regenerate.`,
};

/** The whole method body: every section above, in reading order, separated by a blank line. */
export const METHOD_BODY = Object.values(METHOD_SECTIONS).join('\n\n');
