/**
 * The wire surface, frozen.
 *
 * `wire-surface.json` holds what the model actually reads on each of the four
 * surfaces the tutor is exposed on, and on each provider schema dialect the
 * owned loop's surface is projected into: per tool, its name, its full
 * description text and its input shape projected to JSON Schema. The fixture is
 * regenerated from `server/src/tools.ts` here and compared byte for byte.
 *
 * A failing diff means the contract the model reads has changed. That is not a
 * broken test, it is the review: read the diff and decide whether the change is
 * wanted. Only then regenerate the fixture, by running the suite once with
 * DERIVE_WRITE_WIRE_SURFACE=1, and commit the regenerated file as part of the
 * change so the diff is in the pull request. Never regenerate it merely to make
 * this test go green.
 *
 * A handful of tools genuinely say something different on one surface, because
 * the surface differs: only a terminal driver settles a card through `answer`,
 * and only the external path runs the teach gate. Those differences are declared
 * in the registry under `per_surface`, and the assertion below is two-sided — a
 * surface may differ only where a tool declares it does, and a tool may declare a
 * difference only where the snapshot actually shows one. Undeclared drift between
 * two surfaces therefore still fails, which is the whole point of the registry.
 *
 * A snapshot on its own would freeze an invalid schema as happily as a valid
 * one, so the second `describe` asserts each dialect's rules outright. That is
 * the half that catches a projection which is stable and wrong.
 */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { ALL_TOOL_NAMES, DERIVE_TOOL_NAMES, descriptionFor, differsOnSurface, jsonSchemaOf, TOOL_DIALECTS, TOOL_LABELS, toolsFor, TOOL_REGISTRY, type ToolDialect, type ToolSurface } from '../src/tools.js';

const SURFACES: ToolSurface[] = ['agent', 'api', 'mcp', 'http'];

/**
 * The dialects that get their own fixture key, over the `api` surface only.
 *
 * A dialect is a *provider's* schema format, and the only surface a provider
 * reads is the owned loop's. The plugin's MCP wire and the HTTP action route are
 * Derive's own surfaces, so projecting a dialect onto them would freeze bytes
 * nothing ever sends. `'full'` gets no key of its own either: it is exactly what
 * the `api` key already holds, and a `dialect:full` would be the same rows twice.
 */
const DIALECTS: ToolDialect[] = TOOL_DIALECTS.filter((d) => d !== 'full');

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), 'wire-surface.json');

/** The fourteen tutor tools as they stood before the registry existed, copied from the pre-phase server/src/tools.ts. Renamed rather than edited when the owned loop's two web tools arrived: this list is a record of the pre-registry contract, and the agent surface still names exactly it. */
const TUTOR_TOOLS_AT_PHASE_1 = [
  'quiz', 'ask', 'set_plan', 'node_status', 'set_phase', 'explain_back', 'remember', 'set_preferences', 'read_material', 'search_material',
  'search_library', 'read_resource', 'suggest_resource', 'add_resource',
];

/** The status lines as they stood before the registry existed, copied from the pre-phase server/src/tools.ts. Renamed for the same reason: every entry is still present with the same string. */
const TOOL_LABELS_AT_PHASE_1: Record<string, string> = {
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

type Row = { name: string; description: string; input_schema: unknown };

/** The registry projected onto every surface and, over the `api` surface, into every non-`full` dialect, in registry declaration order, exactly as the fixture stores it. */
function wireSurface(): Record<string, Row[]> {
  const out: Record<string, Row[]> = {};
  for (const surface of SURFACES) out[surface] = toolsFor(surface).map((t) => ({ name: t.name, description: descriptionFor(t, surface), input_schema: jsonSchemaOf(t, surface) }));
  for (const dialect of DIALECTS) out[`dialect:${dialect}`] = toolsFor('api').map((t) => ({ name: t.name, description: descriptionFor(t, 'api', dialect), input_schema: jsonSchemaOf(t, 'api', dialect) }));
  return out;
}

/** One tool's row on one surface, or undefined when it is not registered there. */
const rowOf = (surface: Record<string, Row[]>, name: string, on: ToolSurface) => surface[on].find((r) => r.name === name);

/**
 * Every JSON Schema keyword a projected schema uses, anywhere in it.
 *
 * The keys under `properties` are the tutor's own field names rather than
 * keywords, so they are walked into but never counted — a dialect that allows
 * only six keywords must not be failed by a field called `goal`.
 */
function keywords(node: unknown, acc = new Set<string>()): Set<string> {
  if (!node || typeof node !== 'object') return acc;
  if (Array.isArray(node)) {
    for (const v of node) keywords(v, acc);
    return acc;
  }
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    acc.add(k);
    if (k === 'properties' && v && typeof v === 'object') for (const child of Object.values(v as Record<string, unknown>)) keywords(child, acc);
    else keywords(v, acc);
  }
  return acc;
}

describe('the wire surface', () => {
  const live = wireSurface();
  // The one sanctioned way to move the fixture: deliberate, and it leaves a diff to review.
  if (process.env.DERIVE_WRITE_WIRE_SURFACE === '1') writeFileSync(FIXTURE, `${JSON.stringify(live, null, 2)}\n`, 'utf8');
  const onDisk = readFileSync(FIXTURE, 'utf8');

  it('matches the committed fixture', () => {
    assert.deepEqual(live, JSON.parse(onDisk), 'the tool contract changed; read the diff, then regenerate wire-surface.json deliberately');
  });

  it('is stored as UTF-8 JSON with 2-space indent, LF endings and one trailing newline', () => {
    assert.ok(!onDisk.includes('\r\n'), 'the fixture must use LF line endings');
    assert.ok(onDisk.endsWith('}\n') && !onDisk.endsWith('\n\n'), 'the fixture must end with exactly one trailing newline');
    // Byte-for-byte: this also pins key order and whitespace, so a reordering of
    // the registry or a reformat of the fixture fails rather than passing quietly.
    assert.equal(onDisk, `${JSON.stringify(live, null, 2)}\n`);
  });

  it('gives a tool the same description and the same schema on every surface, except where it declares otherwise', () => {
    for (const spec of TOOL_REGISTRY) {
      for (const surface of spec.surfaces) {
        const row = rowOf(live, spec.name, surface)!;
        const moved = row.description !== spec.description || JSON.stringify(row.input_schema) !== JSON.stringify(jsonSchemaOf(spec));
        if (moved && !differsOnSurface(spec, surface)) {
          assert.fail(`${spec.name}: the ${surface} surface differs from the registry but declares no per_surface entry for it — declare the difference or remove it`);
        }
        if (!moved && differsOnSurface(spec, surface)) {
          assert.fail(`${spec.name}: a per_surface entry is declared for ${surface} but the snapshot shows no difference — delete the dead declaration`);
        }
      }
    }
  });

  it('declares every per-surface difference the snapshot shows, and no others', () => {
    // The two halves above, stated as sets, so a failure names the whole drift
    // rather than the first tool that trips it.
    const shown: string[] = [];
    const declared: string[] = [];
    for (const spec of TOOL_REGISTRY) {
      for (const surface of spec.surfaces) {
        const row = rowOf(live, spec.name, surface)!;
        if (row.description !== spec.description || JSON.stringify(row.input_schema) !== JSON.stringify(jsonSchemaOf(spec))) shown.push(`${spec.name}@${surface}`);
        if (differsOnSurface(spec, surface)) declared.push(`${spec.name}@${surface}`);
      }
    }
    assert.deepEqual(shown.sort(), declared.sort(), 'the tools that read differently on a surface must be exactly the tools that say so in the registry');
  });

  it('carries node_status identically on the agent and the MCP surface', () => {
    const agent = rowOf(live, 'node_status', 'agent')!;
    const mcp = rowOf(live, 'node_status', 'mcp')!;
    assert.equal(agent.description, mcp.description);
    assert.deepEqual(agent.input_schema, mcp.input_schema);
  });

  it('still names the same fourteen tutor tools, in the same order, with the same status lines', () => {
    assert.deepEqual([...DERIVE_TOOL_NAMES], TUTOR_TOOLS_AT_PHASE_1);
    // The label map grew by exactly two: Derive's own loop has no host CLI to
    // borrow web tools from, so `fetch_page` and `web_search` are registry
    // tools and need status lines. Their wording is lifted verbatim from what
    // the Claude and Codex drivers already show for WebFetch and web_search,
    // so the learner sees no difference between the plugin and the owned loop.
    for (const [name, label] of Object.entries(TOOL_LABELS_AT_PHASE_1)) {
      assert.equal(TOOL_LABELS[name], label, `${name}'s status line moved; the learner reads these`);
    }
    const added = Object.keys(TOOL_LABELS).filter((n) => !(n in TOOL_LABELS_AT_PHASE_1));
    assert.deepEqual(added.sort(), ['fetch_page', 'web_search'], 'the only status lines added since the registry are the owned loop’s two web tools');
    assert.equal(TOOL_LABELS.fetch_page, 'Reading a source');
    assert.equal(TOOL_LABELS.web_search, 'Verifying with a web search');
  });

  it('covers the whole surface a driver can see: 24 tools, of which 14 are the tutor tools', () => {
    // 22 at phase 1, plus fetch_page and web_search — the owned loop's own two,
    // registered on the `api` surface and nowhere else.
    assert.equal(ALL_TOOL_NAMES.length, 24);
    assert.equal(DERIVE_TOOL_NAMES.length, 14);
    assert.equal(live.mcp.length, 22, 'the MCP server is what the Claude Code plugin sees; the snapshot must cover all of it');
    assert.equal(live.http.length, 16, 'the fourteen tutor tools plus answer and answer_in');
    assert.equal(live.api.length, 16, "the fourteen tutor tools plus Derive's own fetch_page and web_search");
    for (const ours of ['fetch_page', 'web_search']) {
      assert.ok(rowOf(live, ours, 'api'), `${ours} is missing from the owned loop's surface`);
      for (const elsewhere of ['agent', 'mcp', 'http'] as ToolSurface[]) {
        assert.ok(!rowOf(live, ours, elsewhere), `${ours} leaked onto the ${elsewhere} surface, which must stay byte-unchanged`);
      }
    }
    for (const driverTool of ['start_lesson', 'attach_material', 'answer', 'answer_in', 'learner_profile', 'learners', 'end_lesson', 'library']) {
      assert.ok(rowOf(live, driverTool, 'mcp'), `${driverTool} is missing from the MCP surface`);
      assert.ok(!DERIVE_TOOL_NAMES.includes(driverTool), `${driverTool} is a driver tool, not one of the fourteen tutor tools`);
    }
  });

  it('carries answer_in identically on the MCP and the HTTP surface', () => {
    const mcp = rowOf(live, 'answer_in', 'mcp')!;
    const http = rowOf(live, 'answer_in', 'http')!;
    assert.equal(mcp.description, http.description);
    assert.deepEqual(mcp.input_schema, http.input_schema);
  });

  it('projects a tool that takes no arguments to an empty properties object that parses an empty body', () => {
    const endLesson = TOOL_REGISTRY.find((t) => t.name === 'end_lesson')!;
    const schema = jsonSchemaOf(endLesson) as { properties: Record<string, unknown> };
    assert.deepEqual(schema.properties, {});
    assert.equal(z.object(endLesson.shape).safeParse({}).success, true);
  });

  it('refuses two entries under the same name', () => {
    // The registry builds its lookup map at import time, so a duplicate fails the
    // first test that imports the module rather than the first tool call.
    const names = ALL_TOOL_NAMES;
    assert.equal(new Set(names).size, names.length);
  });

  it('keeps the bounds the model is held to when a shape is projected', () => {
    // On both surfaces a tutor actually runs on: the Claude agent's, and the
    // owned loop's. The strict dialect legitimately drops all four — they are on
    // OpenAI's unsupported list — and is asserted separately below, so the two
    // assertions are not in contradiction: this one is about the projection every
    // adapter row selects, that one about the projection none of them does.
    for (const surface of ['agent', 'api'] as ToolSurface[]) {
      const nodes = (rowOf(live, 'set_plan', surface)!.input_schema as { properties: Record<string, { minItems?: number; maxItems?: number }> }).properties.nodes;
      assert.equal(nodes.minItems, 3, `set_plan lost its lower node bound on the ${surface} surface`);
      assert.equal(nodes.maxItems, 12, `set_plan lost its upper node bound on the ${surface} surface`);
      const options = (rowOf(live, 'quiz', surface)!.input_schema as { properties: Record<string, { minItems?: number; maxItems?: number }> }).properties.options;
      assert.equal(options.minItems, 2, `quiz lost its lower option bound on the ${surface} surface`);
      assert.equal(options.maxItems, 3, `quiz lost its upper option bound on the ${surface} surface`);
    }
  });
});

/**
 * The half a snapshot cannot do.
 *
 * The fixture comparison above freezes each dialect so a change to one is a
 * reviewable diff — but a snapshot will happily freeze a schema that is stable
 * and wrong. These assert each dialect's rules outright, which is what catches
 * a projection nobody meant to write and everybody then committed.
 */
describe('each dialect obeys its own rules, not just the fixture', () => {
  const live = wireSurface();

  /** Every keyword OpenAI's strict mode does not support, from OpenAI's own structured-outputs page. */
  const UNSUPPORTED_BY_STRICT = [
    'minItems', 'maxItems', 'minimum', 'maximum', 'minLength', 'maxLength', 'pattern', 'format', 'oneOf', 'allOf',
    'if', 'then', 'else', 'propertyNames', 'patternProperties', 'contains', 'dependentSchemas', 'unevaluatedProperties',
  ];

  /** Every keyword the Gemini dialect is allowed to emit: the six Google's function-calling guide documents by example. */
  const ALLOWED_BY_GEMINI = ['type', 'properties', 'required', 'description', 'enum', 'items'];

  const schemaOf = (row: Row) => row.input_schema as { type?: string; properties?: Record<string, { type?: unknown; enum?: unknown[] }>; required?: string[]; additionalProperties?: unknown };

  it('strict mode has additionalProperties: false with every key in required', () => {
    for (const row of live['dialect:openai-strict']) {
      const schema = schemaOf(row);
      assert.equal(schema.additionalProperties, false, `${row.name}: strict mode requires additionalProperties: false on every object`);
      assert.deepEqual(Object.keys(schema.properties ?? {}).sort(), [...(schema.required ?? [])].sort(), `${row.name}: strict mode requires every property to be listed in required`);
    }
  });

  it('strict mode emits no unsupported keyword', () => {
    for (const row of live['dialect:openai-strict']) {
      const used = keywords(row.input_schema);
      for (const bad of UNSUPPORTED_BY_STRICT) {
        assert.ok(!used.has(bad), `${row.name}: the strict dialect emits ${bad}, which OpenAI's strict mode does not support`);
      }
      assert.ok(!used.has('$schema'), `${row.name}: the strict dialect keeps $schema, which it drops as an unknown key`);
    }
  });

  it('strict mode expresses an originally-optional field as a nullable union', () => {
    // quiz has seven properties and four required on the registry's own
    // projection, so its three optionals are what strict mode has to flatten.
    const api = schemaOf(rowOf(live, 'quiz', 'api')!);
    const strict = schemaOf(live['dialect:openai-strict'].find((r) => r.name === 'quiz')!);
    const optional = Object.keys(api.properties ?? {}).filter((k) => !(api.required ?? []).includes(k));
    assert.deepEqual(optional.sort(), ['node_id', 'purpose', 'tests'], 'quiz no longer has the three optionals this rule is asserted on');
    for (const name of optional) {
      const field = strict.properties![name];
      assert.ok(Array.isArray(field.type) && field.type.includes('null'), `${name}: strict mode must express an optional as a nullable union, not as an absent required entry`);
      if (field.enum) assert.ok(field.enum.includes(null), `${name}: an enum that gained null in its type must carry null as a value too`);
    }
  });

  it('the gemini dialect uses no rejected keyword', () => {
    const allowed = new Set(ALLOWED_BY_GEMINI);
    for (const row of live['dialect:gemini']) {
      for (const used of keywords(row.input_schema)) {
        assert.ok(allowed.has(used), `${row.name}: the gemini dialect emits ${used}, and Google answers a keyword it rejects with a 400 rather than a warning`);
      }
    }
  });

  it('the compact dialect shortens descriptions and keeps the keyword set', () => {
    let anyShorter = false;
    for (const row of live['dialect:compact']) {
      const api = rowOf(live, row.name, 'api')!;
      assert.ok(row.description.length <= api.description.length, `${row.name}: the compact dialect made a description longer`);
      assert.ok(api.description.startsWith(row.description), `${row.name}: a compact description must be a prefix of the registry's, never a rewrite of it`);
      if (row.description.length < api.description.length) anyShorter = true;
      assert.deepEqual([...keywords(row.input_schema)].sort(), [...keywords(api.input_schema)].sort(), `${row.name}: the compact dialect changed the keyword set, which it must not`);
    }
    assert.ok(anyShorter, 'the compact dialect shortened nothing at all, which means it does nothing');
  });

  it('every dialect covers the same tools, in the same order', () => {
    const names = live.api.map((r) => r.name);
    assert.equal(names.length, 16);
    for (const dialect of DIALECTS) {
      assert.deepEqual(live[`dialect:${dialect}`].map((r) => r.name), names, `the ${dialect} dialect does not carry the api surface's tools in the same order — a dialect must not silently drop one`);
    }
    assert.ok(!('dialect:full' in live), "the full dialect is what the api key already holds; a dialect:full key would be the same rows twice");
  });
});
