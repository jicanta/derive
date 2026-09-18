/**
 * The wire surface, frozen.
 *
 * `wire-surface.json` holds what the model actually reads on each of the three
 * surfaces the tutor is exposed on: per tool, its name, its full description
 * text and its input shape projected to JSON Schema. The fixture is regenerated
 * from `server/src/tools.ts` here and compared byte for byte.
 *
 * A failing diff means the contract the model reads has changed. That is not a
 * broken test, it is the review: read the diff and decide whether the change is
 * wanted. Only then regenerate the fixture, by running the suite once with
 * DERIVE_WRITE_WIRE_SURFACE=1, and commit the regenerated file as part of the
 * change so the diff is in the pull request. Never regenerate it merely to make
 * this test go green.
 */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { jsonSchemaOf, toolsFor, TOOL_REGISTRY, type ToolSurface } from '../src/tools.js';

const SURFACES: ToolSurface[] = ['agent', 'mcp', 'http'];
const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), 'wire-surface.json');

type Row = { name: string; description: string; input_schema: unknown };

/** The registry projected onto every surface, in registry declaration order, exactly as the fixture stores it. */
function wireSurface(): Record<string, Row[]> {
  const out: Record<string, Row[]> = {};
  for (const surface of SURFACES) out[surface] = toolsFor(surface).map((t) => ({ name: t.name, description: t.description, input_schema: jsonSchemaOf(t) }));
  return out;
}

/** One tool's row on one surface, or undefined when it is not registered there. */
const rowOf = (surface: Record<string, Row[]>, name: string, on: ToolSurface) => surface[on].find((r) => r.name === name);

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

  it('gives a tool the same description and the same schema on every surface it appears on', () => {
    for (const spec of TOOL_REGISTRY) {
      if (spec.surfaces.length < 2) continue;
      const [first, ...rest] = spec.surfaces;
      const head = rowOf(live, spec.name, first)!;
      for (const other of rest) {
        const row = rowOf(live, spec.name, other)!;
        assert.equal(row.description, head.description, `${spec.name}: the ${first} and ${other} surfaces disagree on the description`);
        assert.deepEqual(row.input_schema, head.input_schema, `${spec.name}: the ${first} and ${other} surfaces disagree on the input schema`);
      }
    }
  });

  it('carries node_status identically on the agent and the MCP surface', () => {
    const agent = rowOf(live, 'node_status', 'agent')!;
    const mcp = rowOf(live, 'node_status', 'mcp')!;
    assert.equal(agent.description, mcp.description);
    assert.deepEqual(agent.input_schema, mcp.input_schema);
  });
});
