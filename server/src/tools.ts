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

/** Every tool, in the order they are emitted on every surface. */
export const TOOL_REGISTRY: readonly ToolSpec[] = [
  {
    name: 'node_status',
    description: 'Update the state of a plan node: "teaching" when you start it, "locked" when a confident check confirmed it (the node is then scheduled for review by how well the check went; the reply says in how many days, and which nodes below it earned implicit review credit), "shaky" when it did not land after two checks (the reply names the nodes it rests on and what the checks on each showed, for targeted remediation). Locking a derived node is refused until a correct intuition or transfer question on it exists; locking the goal returns the instructions for the cumulative quiz.',
    shape: { id: z.string(), status: z.enum(['teaching', 'locked', 'shaky']) },
    surfaces: ['agent', 'mcp', 'http'],
    label: 'Updating the graph',
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

export const DERIVE_TOOL_NAMES = [
  'quiz', 'ask', 'set_plan', 'node_status', 'set_phase', 'explain_back', 'remember', 'set_preferences', 'read_material', 'search_material',
  'search_library', 'read_resource', 'suggest_resource', 'add_resource',
] as const;

export const TOOL_LABELS: Record<string, string> = {
  quiz: 'Writing a question',
  ask: 'Asking',
  set_plan: 'Drawing the plan',
  node_status: 'Updating the graph',
  set_phase: 'Changing phase',
  explain_back: 'Preparing a teach-back',
  remember: 'Taking a note',
  set_preferences: 'Updating how you learn',
  read_material: 'Reading your material',
  search_material: 'Searching your material',
  search_library: 'Searching your library',
  read_resource: 'Reading from your library',
  suggest_resource: 'Picking a resource for you',
  add_resource: 'Saving a source to your library',
};
