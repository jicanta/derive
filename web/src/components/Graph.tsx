import dagre from '@dagrejs/dagre';
import {
  Background,
  BackgroundVariant,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { memo, useEffect, useMemo, useRef } from 'react';
import { orderIndex } from '../lib/order';
import type { GraphNode } from '../lib/types';

type Data = { label: string; kind: GraphNode['kind']; status: GraphNode['status']; summary?: string | null; due?: boolean; index?: number };
type RFNode = Node<Data, 'derive'>;

const W = 196;
const H = 64;

export function layoutGraph(nodes: (GraphNode & { due?: boolean })[], offset = { x: 0, y: 0 }): { nodes: RFNode[]; edges: Edge[]; width: number; height: number } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'BT', nodesep: 34, ranksep: 70, marginx: 10, marginy: 10 });
  for (const n of nodes) g.setNode(n.id, { width: W, height: H });
  const order = orderIndex(nodes);
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
  const gg = g.graph();
  return {
    nodes: nodes.map((n) => {
      const p = g.node(n.id);
      return {
        id: n.id,
        type: 'derive',
        position: { x: p.x - W / 2 + offset.x, y: p.y - H / 2 + offset.y },
        data: { label: n.label, kind: n.kind, status: n.status, summary: n.summary, due: n.due, index: order.get(n.id) },
        draggable: false,
        selectable: false,
      } satisfies RFNode;
    }),
    edges,
    width: gg.width ?? 0,
    height: gg.height ?? 0,
  };
}

const STATUS_WORD: Record<GraphNode['status'], string> = { pending: 'not yet taught', teaching: 'teaching now', locked: 'locked', shaky: 'shaky' };
const KIND_WORD: Record<GraphNode['kind'], string> = { truth: 'ground truth', derived: 'derived step', goal: 'goal' };

export const DeriveNode = memo(function DeriveNode({ data }: NodeProps<RFNode>) {
  const { status, kind, label, due, summary, index } = data;
  const base = 'group relative flex items-center justify-center text-center px-4 text-[13.5px] leading-[1.25] font-medium transition-all duration-500 box-border';
  const shape = kind === 'goal' ? 'rounded-full' : kind === 'truth' ? 'rounded-md' : 'rounded-[10px]';
  let tone = 'bg-ink-850 border border-ink-100/20 text-ink-200';
  if (status === 'teaching') tone = 'bg-[#171a19] border border-teal-400 text-ink-50 animate-pulse-ring';
  if (status === 'locked') tone = 'bg-gold-500 border border-gold-400 text-[#17130b] glow-gold animate-glow-in';
  if (status === 'shaky') tone = 'bg-ink-850 border border-dashed border-rust-400 text-rust-400';
  if (status === 'locked' && due) tone = 'bg-ink-850 border border-teal-400 text-ink-50 shadow-[0_0_22px_-6px_rgba(127,196,201,0.6)]';
  const badge = status === 'locked' && !due ? 'text-[#17130b]/55' : status === 'teaching' ? 'text-teal-400' : 'text-ink-500';
  return (
    <div className={`${base} ${shape} ${tone}`} style={{ width: kind === 'goal' ? W + 16 : W, height: H }}>
      <Handle type="target" position={Position.Bottom} />
      <Handle type="source" position={Position.Top} />
      {kind === 'truth' && status !== 'locked' && <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-gold-500" />}
      {index !== undefined && kind !== 'goal' && <span className={`absolute left-2 top-1.5 font-mono text-[9.5px] tracking-[0.06em] ${badge}`}>{String(index).padStart(2, '0')}</span>}
      <span className="line-clamp-3 text-pretty">{label}</span>
      {/* What this node claims, on hover: the label is a handle, the summary is the meaning. */}
      <div className="node-pop pointer-events-none absolute left-1/2 bottom-[calc(100%+10px)] w-[280px] rounded-xl border border-ink-100/15 bg-ink-900/97 backdrop-blur px-4 py-3 text-left shadow-[0_24px_50px_-20px_rgba(0,0,0,0.9)]">
        <div className="font-mono text-[9.5px] tracking-[0.16em] uppercase text-ink-500">
          {index !== undefined && `${String(index).padStart(2, '0')} · `}
          {KIND_WORD[kind]} · <span className={status === 'locked' ? 'text-gold-500' : status === 'teaching' ? 'text-teal-400' : status === 'shaky' ? 'text-rust-400' : ''}>{STATUS_WORD[status]}</span>
        </div>
        <div className="mt-1 font-serif text-[16px] leading-snug text-ink-50">{label}</div>
        {summary && <div className="mt-1.5 text-[13px] leading-[1.45] font-normal text-ink-300">{summary}</div>}
      </div>
    </div>
  );
});

const nodeTypes = { derive: DeriveNode };

function Inner({ nodes }: { nodes: GraphNode[] }) {
  const { fitView } = useReactFlow();
  const wrap = useRef<HTMLDivElement>(null);
  const { nodes: rf, edges } = useMemo(() => layoutGraph(nodes), [nodes]);
  useEffect(() => {
    const t = setTimeout(() => fitView({ padding: 0.16, duration: 400 }), 30);
    return () => clearTimeout(t);
  }, [rf.length, fitView]);
  // The panel changes size after mount (fonts, the window, the rail): keep the whole map in view.
  useEffect(() => {
    const el = wrap.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let first = true;
    const ro = new ResizeObserver(() => {
      if (first) {
        first = false;
        return;
      }
      void fitView({ padding: 0.16, duration: 200 });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitView]);
  return (
    <div ref={wrap} className="h-full w-full">
      <ReactFlow nodes={rf} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.16 }} zoomOnScroll={false} panOnScroll nodesConnectable={false} elementsSelectable={false} minZoom={0.3} maxZoom={1.4} proOptions={{ hideAttribution: true }}>
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#2a2620" />
      </ReactFlow>
    </div>
  );
}

export function Graph({ nodes }: { nodes: GraphNode[] }) {
  if (nodes.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-8 text-center">
        <div>
          <svg width="88" height="72" viewBox="0 0 88 72" className="mx-auto mb-5 opacity-50" fill="none" stroke="#6a6257" strokeWidth="1.2">
            <rect x="30" y="2" width="28" height="14" rx="7" />
            <rect x="6" y="30" width="28" height="14" rx="3" />
            <rect x="54" y="30" width="28" height="14" rx="3" />
            <rect x="30" y="56" width="28" height="14" rx="3" />
            <path d="M44 16v14M20 44v6q0 6 6 6h18M68 44v6q0 6-6 6H44" />
          </svg>
          <p className="font-serif text-[1.35rem] text-ink-300">Your dependency map appears here</p>
          <p className="mt-1.5 text-sm text-ink-500 max-w-[28ch] mx-auto leading-relaxed">Once the probe finds the edge of what you know, the plan is drawn from the ground up.</p>
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
