import type { GraphNode } from './types';

/** Roots first, goal last; stable within a rank by plan order. The same order everywhere: rail, graph badges, "now · 07". */
export function topoOrder(nodes: GraphNode[]): GraphNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const depth = new Map<string, number>();
  const visit = (id: string, seen = new Set<string>()): number => {
    if (depth.has(id)) return depth.get(id)!;
    if (seen.has(id)) return 0;
    seen.add(id);
    const n = byId.get(id);
    const d = n && n.depends_on.length ? 1 + Math.max(...n.depends_on.filter((x) => byId.has(x)).map((x) => visit(x, seen)), -1) : 0;
    depth.set(id, d);
    return d;
  };
  nodes.forEach((n) => visit(n.id));
  return [...nodes].sort((a, b) => (depth.get(a.id)! - depth.get(b.id)!) || nodes.indexOf(a) - nodes.indexOf(b));
}

/** 1-based position of each node in dependency order. */
export function orderIndex(nodes: GraphNode[]): Map<string, number> {
  return new Map(topoOrder(nodes).map((n, i) => [n.id, i + 1]));
}
