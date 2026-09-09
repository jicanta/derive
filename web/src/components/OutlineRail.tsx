import { topoOrder } from '../lib/order';
import type { GraphNode, Material } from '../lib/types';
import { MaterialList } from './MaterialList';

export { topoOrder };

/** Left rail: the plan in dependency order with each node's state, and the course material it prepares for. */
export function OutlineRail({ nodes, goal, materials = [], uploading = [] }: { nodes: GraphNode[]; goal: string | null; materials?: Material[]; uploading?: string[] }) {
  const ordered = topoOrder(nodes);
  return (
    <div className="h-full flex flex-col px-3.5 py-5">
      <div className="eyebrow px-2.5 pb-3">Dependency order</div>
      {ordered.length === 0 && <p className="px-2.5 text-sm text-ink-500 leading-relaxed">The plan appears here after the probe.</p>}
      <ol className="flex flex-col gap-0.5">
        {ordered.map((n, i) => (
          <li
            key={n.id}
            title={n.summary ?? undefined}
            className={`flex items-start gap-3 py-[7px] px-2.5 rounded-lg text-[13px] leading-[1.3] ${
              n.status === 'teaching' ? 'bg-teal-400/8 text-ink-50' : n.status === 'locked' ? 'text-ink-100' : n.status === 'shaky' ? 'text-rust-400' : 'text-ink-400'
            }`}
          >
            <span className="font-mono text-[10px] text-ink-500 w-4 shrink-0 pt-[3px]">{String(i + 1).padStart(2, '0')}</span>
            <span className="pt-[5px]">
              <Dot status={n.status} />
            </span>
            <span className="min-w-0">
              <span className={`block text-pretty ${n.kind === 'goal' ? 'font-serif italic text-[15px]' : ''}`}>{n.label}</span>
              {n.status === 'teaching' && n.summary && <span className="block mt-1 text-[12px] leading-[1.4] text-ink-400 text-pretty">{n.summary}</span>}
            </span>
          </li>
        ))}
      </ol>
      {(materials.length > 0 || uploading.length > 0) && (
        <div className="mt-5 px-2.5">
          <div className="eyebrow mb-2">Course material</div>
          <MaterialList materials={materials} uploading={uploading} compact />
        </div>
      )}
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

