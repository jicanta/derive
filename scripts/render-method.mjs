#!/usr/bin/env node
/**
 * `pnpm method`: renders the teaching method from `method/` into every copy of
 * it that Derive ships — the app's system prompt module, the Claude Code
 * plugin's `teach` skill, and both Codex skills — plus the `allowed-tools`
 * frontmatter of the two plugin commands, which is projected from the tool
 * registry rather than typed out by hand.
 *
 * The method text is the product, so it is written once and every rendered copy
 * is committed to git. That keeps `claude --plugin-dir ./plugin` working from a
 * bare clone with no build step, makes the release tarball correct by
 * construction, and — the reason that matters most — turns any change to what a
 * model is told into a reviewable diff in the pull request. `pnpm method:check`
 * fails when a copy drifts; CI runs the check and never regenerates, because a
 * silent regenerate-and-push would hide exactly the change a reviewer needs to
 * see.
 *
 * One surface-neutral body is shared verbatim by every target. Only the short
 * preambles under `method/surfaces/` differ, so a diff shows at a glance that
 * the method itself is identical everywhere. The body may not name a surface,
 * a tool prefix or a lesson-lifecycle call: it reaches those through the
 * placeholder tokens below, and the render refuses to emit a body that breaks
 * the rule.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** The sections of the method, in reading order. Every target gets all of them, and nothing else. */
const BODY_SECTIONS = [
  'identity',
  'philosophy',
  'tools',
  'quiz-options',
  'discipline',
  'checks',
  'process',
  'material',
  'library',
  'preferences',
  'writing-style',
];

/** The generated span of a Markdown target opens here. */
const BEGIN = '<!-- method:begin -->';
/** ...and closes here. Everything outside the pair is hand-written and left alone. */
const END = '<!-- method:end -->';

/**
 * Text that may appear in a surface preamble and nowhere else: the two plugin
 * tool prefixes, the `claude mcp add` wiring, the field that says where cards
 * are answered, and the lesson lifecycle calls. A sentence in the shared body
 * that needs one of these is a sentence that is not surface-neutral.
 */
const SURFACE_TOKENS = ['mcp__plugin_derive_derive__', 'mcp__derive__', 'claude mcp add', 'answer_in', 'start_lesson', 'end_lesson'];

/** The placeholder tokens the shared body may carry. Anything else is a typo, not a token. */
const BODY_TOKENS = ['{{WEB_TOOLS}}', '{{TOOL_PREFIX}}'];

/**
 * What the body's placeholder tokens mean on each surface. `WEB_TOOLS: null`
 * means "leave the token in place": the app runs on either backend, and
 * `systemPrompt(backend)` in `server/src/prompt.ts` substitutes the right web
 * tools at runtime, exactly as it does today.
 */
const SURFACES = {
  app: { WEB_TOOLS: null, TOOL_PREFIX: '' },
  'claude-code': { WEB_TOOLS: '`WebSearch` / `WebFetch`', TOOL_PREFIX: 'mcp__plugin_derive_derive__' },
  'codex-learn': { WEB_TOOLS: 'Web search (your built-in `web_search`)', TOOL_PREFIX: 'derive__' },
  'codex-review': { WEB_TOOLS: 'Web search (your built-in `web_search`)', TOOL_PREFIX: 'derive__' },
};

/** Every file the render writes, and how. */
const TARGETS = [
  { path: 'server/src/method.generated.ts', kind: 'module', surface: 'app' },
  { path: 'plugin/skills/teach/SKILL.md', kind: 'region', surface: 'claude-code' },
  { path: 'codex/skills/derive-learn/SKILL.md', kind: 'region', surface: 'codex-learn' },
  { path: 'codex/skills/derive-review/SKILL.md', kind: 'region', surface: 'codex-review' },
  { path: 'plugin/commands/learn.md', kind: 'allowed-tools' },
  { path: 'plugin/commands/review.md', kind: 'allowed-tools' },
];

/** The MCP tool prefix Claude Code gives the plugin's server, and the three allowed tools that are not Derive's. */
const COMMAND_PREFIX = 'mcp__plugin_derive_derive__';
const COMMAND_TAIL = ['WebSearch', 'WebFetch', 'Skill'];

/**
 * What each command may NOT call, and why. The allow-list is the registry minus
 * these, so a tool cannot be added to what the plugin may call by accident; an
 * exclusion naming a tool the registry does not have is a hard failure, so a
 * renamed tool cannot leave a stale exclusion behind either.
 */
const COMMAND_EXCLUSIONS = {
  'plugin/commands/learn.md': {
    library: 'the catalog of every tool; the command has never allowed it, and allowing it now would widen what the plugin may call',
  },
  'plugin/commands/review.md': {
    library: 'the catalog of every tool; the command has never allowed it, and allowing it now would widen what the plugin may call',
    attach_material: 'a review session attaches no course material',
    read_material: 'a review session has no course material to read',
    search_material: 'a review session has no course material to search',
    read_resource: 'a review points the learner at an entry; it does not read one into the session',
    add_resource: 'a review saves no new sources',
    learners: 'the learner is chosen when the session starts, not during it',
  },
};

const fail = (message) => {
  throw new Error(message);
};

/** Read `method/*.md` into an ordered map of section id to text, and refuse anything missing or empty. */
function readSections() {
  const dir = join(root, 'method');
  if (!existsSync(dir)) fail('method/ does not exist; the method has no source to render from');
  const files = readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
  if (!files.length) fail('method/ has no .md sections; the method has no source to render from');
  const sections = new Map();
  for (const file of files) {
    const id = file.replace(/\.md$/, '').replace(/^\d+-/, '');
    const text = readFileSync(join(dir, file), 'utf8').trim();
    if (!text) fail(`method/${file} is empty; a section with no text would render a target without that section`);
    sections.set(id, text);
  }
  for (const id of BODY_SECTIONS) if (!sections.has(id)) fail(`method/ provides no section "${id}", which every target needs`);
  for (const id of sections.keys()) if (!BODY_SECTIONS.includes(id)) fail(`method/ provides a section "${id}" that no target renders; add it to BODY_SECTIONS in scripts/render-method.mjs or delete it`);
  return sections;
}

/** Read `method/surfaces/*.md`, one short preamble per surface, and refuse a missing or empty one. */
function readPreambles() {
  const dir = join(root, 'method', 'surfaces');
  if (!existsSync(dir)) fail('method/surfaces/ does not exist; every target needs its preamble');
  const preambles = new Map();
  for (const surface of Object.keys(SURFACES)) {
    const file = join(dir, `${surface}.md`);
    if (!existsSync(file)) fail(`method/surfaces/${surface}.md does not exist; the ${surface} target has no preamble`);
    const text = readFileSync(file, 'utf8').trim();
    if (!text) fail(`method/surfaces/${surface}.md is empty; the ${surface} target has no preamble`);
    preambles.set(surface, text);
  }
  return preambles;
}

/** Refuse a body that names a surface, and refuse a placeholder token that is not one of ours. */
function checkNeutral(sections) {
  for (const [id, text] of sections) {
    for (const token of SURFACE_TOKENS) {
      if (text.includes(token)) fail(`method/ section "${id}" names "${token}", which belongs in a surface preamble; the shared body must read the same on every surface`);
    }
    for (const found of text.match(/\{\{[A-Z_]+\}\}/g) ?? []) {
      if (!BODY_TOKENS.includes(found)) fail(`method/ section "${id}" carries the placeholder ${found}, which no surface defines; the body may only use ${BODY_TOKENS.join(' and ')}`);
    }
    if (text.includes('{{#')) fail(`method/ section "${id}" opens a conditional block; the shared body has no conditionals, only placeholder substitution`);
  }
}

/** Substitute the placeholder tokens for one surface. A null value leaves the token in place on purpose. */
function forSurface(text, surface) {
  const values = SURFACES[surface] ?? fail(`no surface named "${surface}"`);
  let out = text;
  for (const [token, value] of Object.entries(values)) {
    if (value === null) continue;
    out = out.split(`{{${token}}}`).join(value);
  }
  return out;
}

/** The ordered tool names of the MCP surface, read from the registry's committed projection. */
function mcpToolNames() {
  const file = join(root, 'server', 'test', 'wire-surface.json');
  if (!existsSync(file)) fail('server/test/wire-surface.json does not exist; the tool registry has no committed projection to read');
  const wire = JSON.parse(readFileSync(file, 'utf8'));
  const names = (wire.mcp ?? []).map((t) => t.name);
  if (names.length !== 22) fail(`server/test/wire-surface.json lists ${names.length} mcp tools, not 22; the registry projection is incomplete and the allowed-tools lines would be short`);
  return names;
}

/** The `allowed-tools:` line for one command: the registry minus that command's exclusions, prefixed, plus the fixed tail. */
function allowedTools(path, names) {
  const exclusions = COMMAND_EXCLUSIONS[path] ?? fail(`no tool exclusions declared for ${path}`);
  for (const name of Object.keys(exclusions)) {
    if (!names.includes(name)) fail(`${path} excludes "${name}", which the tool registry does not have; remove the stale exclusion from scripts/render-method.mjs`);
  }
  const allowed = names.filter((n) => !(n in exclusions)).map((n) => COMMAND_PREFIX + n);
  return `allowed-tools: ${[...allowed, ...COMMAND_TAIL].join(', ')}`;
}

/** Escape method prose so it survives inside a TypeScript template literal. */
const literal = (text) => '`' + text.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${') + '`';

/** The whole of `server/src/method.generated.ts`. */
function renderModule(preamble, sections) {
  const entries = BODY_SECTIONS.map((id) => `  '${id}': ${literal(sections.get(id))},`).join('\n');
  return `/**
 * The teaching method, rendered from \`method/\` by \`pnpm method\`. Do not edit
 * this file by hand: \`pnpm method:check\` fails when it drifts from its source.
 *
 * It is a generated TypeScript module rather than a runtime read of the
 * Markdown so that \`tsc\` output and the release tarball are self-contained,
 * and so the text the app's tutor is given is committed and reviewable like
 * every other rendered copy.
 */

/** What is true of the tutor running inside Derive's own web app, and only there. */
export const METHOD_PREAMBLE = ${literal(preamble)};

/** Every section of the method, keyed by its id. Insertion order is reading order. */
export const METHOD_SECTIONS: Record<string, string> = {
${entries}
};

/** The whole method body: every section above, in reading order, separated by a blank line. */
export const METHOD_BODY = Object.values(METHOD_SECTIONS).join('\\n\\n');
`;
}

/** Replace only what sits between the markers, and leave the hand-written remainder of the file alone. */
function renderRegion(path, body) {
  const file = join(root, path);
  if (!existsSync(file)) fail(`${path} does not exist; create it with its hand-written frontmatter and an empty ${BEGIN} / ${END} region`);
  const current = readFileSync(file, 'utf8');
  const open = current.indexOf(BEGIN);
  const close = current.indexOf(END);
  if (open === -1 || close === -1 || close < open) fail(`${path} has no ${BEGIN} / ${END} region for the generated method`);
  return `${current.slice(0, open + BEGIN.length)}\n\n${body}\n\n${current.slice(close)}`;
}

/** Replace the one generated line of a command's frontmatter, and leave its hand-written prose alone. */
function renderAllowedTools(path, names) {
  const file = join(root, path);
  if (!existsSync(file)) fail(`${path} does not exist`);
  const lines = readFileSync(file, 'utf8').split('\n');
  const at = lines.findIndex((l) => l.startsWith('allowed-tools:'));
  if (at === -1) fail(`${path} has no allowed-tools: line in its frontmatter`);
  lines[at] = allowedTools(path, names);
  return lines.join('\n');
}

/** Render every target. Returns the bytes each one should hold, without writing anything. */
export function renderAll() {
  const sections = readSections();
  checkNeutral(sections);
  const preambles = readPreambles();
  const names = mcpToolNames();
  const rendered = [];
  for (const target of TARGETS) {
    if (target.kind === 'allowed-tools') {
      rendered.push({ path: target.path, content: renderAllowedTools(target.path, names) });
      continue;
    }
    const preamble = forSurface(preambles.get(target.surface), target.surface);
    const applied = new Map(BODY_SECTIONS.map((id) => [id, forSurface(sections.get(id), target.surface)]));
    const body = BODY_SECTIONS.map((id) => applied.get(id)).join('\n\n');
    if (target.kind === 'module') rendered.push({ path: target.path, content: renderModule(preamble, applied) });
    else rendered.push({ path: target.path, content: renderRegion(target.path, `${preamble}\n\n${body}`) });
  }
  return rendered;
}

/** Write every rendered target under `dir` (the repository root when run as `pnpm method`). */
export function writeAll(dir) {
  const written = [];
  for (const { path, content } of renderAll()) {
    const file = join(dir, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content, 'utf8');
    written.push(path);
  }
  return written;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    for (const path of writeAll(root)) console.log(`rendered ${path}`);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}
