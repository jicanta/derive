import type { GraphNode } from '../lib/types';

/** Left rail: the plan in dependency order with each node's state. */
export function OutlineRail({ nodes, goal }: { nodes: GraphNode[]; goal: string | null }) {
  const ordered = topoOrder(nodes);
  return (
    <div className="h-full flex flex-col px-3.5 py-5">
      <div className="eyebrow px-2.5 pb-3">Dependency order</div>
      {ordered.length === 0 && <p className="px-2.5 text-sm text-ink-500 leading-relaxed">The plan appears here after the probe.</p>}
      <ol className="flex flex-col gap-1">
        {ordered.map((n, i) => (
          <li
            key={n.id}
            className={`flex items-center gap-3 h-[34px] px-2.5 rounded-lg text-[13px] leading-tight ${
              n.status === 'teaching' ? 'bg-teal-400/8 text-ink-50' : n.status === 'locked' ? 'text-ink-100' : n.status === 'shaky' ? 'text-rust-400' : 'text-ink-400'
            }`}
          >
            <span className="font-mono text-[10px] text-ink-500 w-4 shrink-0">{String(i + 1).padStart(2, '0')}</span>
            <Dot status={n.status} />
            <span className={`truncate ${n.kind === 'goal' ? 'font-serif italic text-[15px]' : ''}`}>{n.label}</span>
          </li>
        ))}
      </ol>
      {goal && (
        <div className="mt-auto pt-4 px-2.5 border-t hairline">
          <div className="eyebrow mb-2">Goal</div>
          <p className="font-serif italic text-[15px] leading-snug text-ink-200 text-pretty">{goal}</p>
        </div>
      )}
    </div>
  );
}

function Dot({ status }: { status: GraphNode['status'] }) {
  if (status === 'locked') return <span className="h-1.5 w-1.5 rounded-full bg-gold-500 shrink-0" />;
  if (status === 'teaching') return <span className="h-1.5 w-1.5 rounded-full border border-teal-400 shrink-0 box-border" />;
  if (status === 'shaky') return <span className="h-1.5 w-1.5 rounded-full border border-dashed border-rust-400 shrink-0 box-border" />;
  return <span className="h-1.5 w-1.5 rounded-full border border-ink-600 shrink-0 box-border" />;
}

/** Roots first, goal last; stable within a rank by plan order. */
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
