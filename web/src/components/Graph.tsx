import dagre from '@dagrejs/dagre';
import {
  Background,
  BackgroundVariant,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Check, Sparkles } from 'lucide-react';
import { memo, useEffect, useMemo } from 'react';
import type { GraphNode } from '../lib/types';

type Data = { label: string; kind: GraphNode['kind']; status: GraphNode['status']; summary?: string | null };
type RFNode = Node<Data, 'derive'>;

const W = 176;
const H = 56;

function layout(nodes: GraphNode[]): { nodes: RFNode[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'BT', nodesep: 28, ranksep: 64, marginx: 10, marginy: 10 });
  for (const n of nodes) g.setNode(n.id, { width: W, height: H });
  const ids = new Set(nodes.map((n) => n.id));
  const edges: Edge[] = [];
  for (const n of nodes) {
    for (const d of n.depends_on) {
      if (!ids.has(d)) continue;
      g.setEdge(d, n.id);
      const src = nodes.find((x) => x.id === d)!;
      const cls = n.status === 'teaching' ? 'teaching' : src.status === 'locked' && n.status === 'locked' ? 'locked' : '';
      edges.push({ id: `${d}->${n.id}`, source: d, target: n.id, className: cls, type: 'smoothstep' });
    }
  }
  dagre.layout(g);
  return {
    nodes: nodes.map((n) => {
      const p = g.node(n.id);
      return {
        id: n.id,
        type: 'derive',
        position: { x: p.x - W / 2, y: p.y - H / 2 },
        data: { label: n.label, kind: n.kind, status: n.status, summary: n.summary },
        draggable: false,
        selectable: false,
      } satisfies RFNode;
    }),
    edges,
  };
}

const DeriveNode = memo(function DeriveNode({ data }: NodeProps<RFNode>) {
  const { status, kind, label } = data;
  const base = 'relative flex items-center justify-center text-center px-3 text-[13px] leading-tight font-medium transition-all duration-500';
  const shape = kind === 'goal' ? 'rounded-full' : kind === 'truth' ? 'rounded-lg' : 'rounded-xl';
  let tone = 'bg-ink-850 border border-ink-600 text-ink-300';
  if (status === 'teaching') tone = 'bg-ink-800 border border-teal-400 text-ink-50 animate-pulse-ring';
  if (status === 'locked') tone = 'bg-gold-500 border border-gold-400 text-ink-950 shadow-[0_0_24px_-6px_var(--color-gold-500)]';
  if (status === 'shaky') tone = 'bg-ink-850 border border-dashed border-rust-400 text-rust-400';
  return (
    <div className={`${base} ${shape} ${tone}`} style={{ width: W, height: H }} title={data.summary ?? undefined}>
      <Handle type="target" position={Position.Bottom} />
      <Handle type="source" position={Position.Top} />
      {kind === 'truth' && status !== 'locked' && <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-gold-500" />}
      <span className="line-clamp-2">{label}</span>
      {status === 'locked' && <Check size={14} className="absolute right-2 top-2" />}
      {kind === 'goal' && status !== 'locked' && <Sparkles size={13} className="absolute right-3 top-2 text-teal-400" />}
    </div>
  );
});

const nodeTypes = { derive: DeriveNode };

function Inner({ nodes }: { nodes: GraphNode[] }) {
  const { fitView } = useReactFlow();
  const { nodes: rf, edges } = useMemo(() => layout(nodes), [nodes]);
  useEffect(() => {
    const t = setTimeout(() => fitView({ padding: 0.18, duration: 400 }), 30);
    return () => clearTimeout(t);
  }, [rf.length, fitView]);
  return (
    <ReactFlow
      nodes={rf}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      zoomOnScroll={false}
      panOnScroll
      nodesConnectable={false}
      elementsSelectable={false}
      minZoom={0.4}
      maxZoom={1.4}
    >
      <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#2d2a25" />
    </ReactFlow>
  );
}

export function Graph({ nodes }: { nodes: GraphNode[] }) {
  if (nodes.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-8 text-center">
        <div>
          <div className="mx-auto mb-4 grid grid-cols-3 gap-2 w-28 opacity-40">
            {[...Array(6)].map((_, i) => (
              <span key={i} className={`h-4 rounded-md border border-ink-500 ${i === 1 ? 'col-span-1' : ''}`} />
            ))}
          </div>
          <p className="font-serif text-xl text-ink-300">Your dependency map appears here</p>
          <p className="text-sm text-ink-500 mt-1 max-w-[26ch] mx-auto">Once the probe finds the edge of what you know, the plan is drawn from the ground up.</p>
        </div>
      </div>
    );
  }
  return (
    <ReactFlowProvider>
      <Inner nodes={nodes} />
    </ReactFlowProvider>
  );
}
