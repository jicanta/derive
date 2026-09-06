import { Background, BackgroundVariant, ReactFlow, ReactFlowProvider, useReactFlow, type Edge, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DeriveNode, layoutGraph } from '../components/Graph';
import { Markdown } from '../components/Markdown';
import { api } from '../lib/api';
import type { Atlas, GraphNode } from '../lib/types';

const nodeTypes = { derive: DeriveNode, label: ClusterLabel };

function ClusterLabel({ data }: { data: { label: string; count: string } }) {
  return (
    <div className="pointer-events-none">
      <div className="font-serif italic text-[22px] text-ink-100/60 whitespace-nowrap">{data.label}</div>
      <div className="font-mono text-[10px] text-ink-500 tracking-[0.14em] uppercase mt-0.5">{data.count}</div>
    </div>
  );
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function buildAtlas(atlas: Atlas): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  let x = 0;
  const byLabel = new Map<string, string[]>();
  for (const lesson of atlas.lessons) {
    const mine = atlas.nodes.filter((n) => n.lesson_id === lesson.id);
    if (!mine.length) continue;
    const gnodes: (GraphNode & { due?: boolean })[] = mine.map((n) => ({
      id: `${lesson.id}:${n.node_id}`,
      label: n.label,
      kind: n.kind,
      summary: n.summary,
      depends_on: n.depends_on.map((d) => `${lesson.id}:${d}`),
      status: n.status,
      due: n.due,
    }));
    const laid = layoutGraph(gnodes, { x, y: 80 });
    nodes.push({
      id: `label:${lesson.id}`,
      type: 'label',
      position: { x: x + 10, y: 0 },
      data: { label: lesson.topic, count: `${mine.filter((n) => n.status === 'locked').length} of ${mine.length} locked` },
      draggable: false,
      selectable: false,
    });
    nodes.push(...laid.nodes);
    edges.push(...laid.edges);
    for (const n of gnodes) {
      const k = norm(n.label);
      if (!byLabel.has(k)) byLabel.set(k, []);
      byLabel.get(k)!.push(n.id);
    }
    x += Math.max(laid.width, 260) + 140;
  }
  // The same truth appearing in two lessons is a shared root: draw it.
  for (const ids of byLabel.values()) {
    for (let i = 1; i < ids.length; i++) edges.push({ id: `shared:${ids[0]}:${ids[i]}`, source: ids[0], target: ids[i], className: 'shared', type: 'straight' });
  }
  return { nodes, edges };
}

function Canvas({ atlas }: { atlas: Atlas }) {
  const { fitView } = useReactFlow();
  const { nodes, edges } = useMemo(() => buildAtlas(atlas), [atlas]);
  useEffect(() => {
    const t = setTimeout(() => fitView({ padding: 0.12, duration: 500 }), 40);
    return () => clearTimeout(t);
  }, [nodes.length, fitView]);
  return (
    <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView minZoom={0.2} maxZoom={1.4} nodesConnectable={false} elementsSelectable={false} panOnScroll zoomOnScroll={false} proOptions={{ hideAttribution: true }}>
      <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#2a2620" />
    </ReactFlow>
  );
}

export function AtlasPage() {
  const nav = useNavigate();
  const [atlas, setAtlas] = useState<Atlas | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api.atlas().then(setAtlas).catch((e) => setErr(e.message));
  }, []);

  const counts = useMemo(() => {
    if (!atlas) return null;
    return {
      locked: atlas.nodes.filter((n) => n.status === 'locked').length,
      due: atlas.due.length,
      shaky: atlas.nodes.filter((n) => n.status === 'shaky').length,
      lessons: atlas.lessons.filter((l) => atlas.nodes.some((n) => n.lesson_id === l.id)).length,
    };
  }, [atlas]);

  const review = async () => {
    try {
      const l = await api.startReview();
      nav(`/lesson/${l.id}`);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const open = atlas?.misconceptions.filter((m) => !m.resolved).slice(0, 4) ?? [];

  return (
    <div className="h-full flex flex-col">
      <header className="flex items-center gap-5 px-5 md:px-6 h-[60px] border-b hairline shrink-0">
        <Link to="/" className="text-ink-400 hover:text-ink-50 transition-colors">
          <ArrowLeft size={18} strokeWidth={1.8} />
        </Link>
        <h1 className="font-serif text-[22px] text-ink-50">
          Atlas <em className="text-ink-400">· everything you have derived</em>
        </h1>
        {counts && (
          <div className="ml-auto hidden md:flex items-baseline gap-7">
            <Count n={counts.locked} label="locked" tone="text-gold-500" />
            <Count n={counts.due} label="due" tone="text-teal-400" />
            <Count n={counts.shaky} label="shaky" tone="text-rust-400" />
            <Count n={counts.lessons} label="lessons" tone="text-ink-50" />
          </div>
        )}
      </header>

      <div className="relative flex-1 min-h-0">
        {err && <p className="p-6 text-rust-400">{err}</p>}
        {atlas && atlas.nodes.length === 0 && (
          <div className="h-full grid place-items-center text-center px-6">
            <div>
              <p className="font-serif text-[1.6rem] text-ink-200">Nothing derived yet.</p>
              <p className="mt-2 text-ink-500 max-w-[36ch] mx-auto">Every node you lock in a lesson lands here, connected to every other lesson that rests on the same truth.</p>
              <Link to="/" className="inline-flex items-center gap-2 mt-6 h-9 px-4 rounded-full bg-gold-500 text-[#17130b] text-sm font-medium">
                Start a lesson <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        )}
        {atlas && atlas.nodes.length > 0 && (
          <ReactFlowProvider>
            <Canvas atlas={atlas} />
          </ReactFlowProvider>
        )}

        {atlas && atlas.nodes.length > 0 && (
          <aside className="absolute right-6 top-6 w-[340px] max-h-[calc(100%-3rem)] overflow-y-auto scroll-thin rounded-[18px] border hairline bg-ink-900/92 backdrop-blur p-[22px] flex flex-col gap-5 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.9)]">
            <div>
              <div className="flex items-baseline justify-between">
                <span className="eyebrow text-teal-400">Due for review</span>
                <span className="font-serif text-[22px] text-teal-400">{atlas.due.length}</span>
              </div>
              <ul className="mt-2">
                {atlas.due.slice(0, 5).map((d) => (
                  <li key={`${d.lesson_id}:${d.node_id}`} className="flex items-center gap-3 py-2.5 border-b hairline text-[13.5px] text-ink-100">
                    <span className="h-1.5 w-1.5 rounded-full border border-teal-400 box-border shrink-0" />
                    <span className="truncate">{d.label}</span>
                    <span className="ml-auto font-mono text-[10px] text-ink-500 shrink-0">{overdue(d.review_at)}</span>
                  </li>
                ))}
                {atlas.due.length === 0 && <li className="py-2 text-sm text-ink-500">Nothing due. Come back tomorrow.</li>}
              </ul>
              {atlas.due.length > 0 && (
                <button type="button" onClick={review} className="mt-3 inline-flex items-center gap-2.5 h-[38px] px-4 rounded-full bg-teal-400 text-[#0e1a1b] font-semibold text-[13.5px] hover:bg-teal-400/90">
                  Start a review <ArrowRight size={13} strokeWidth={2.2} />
                </button>
              )}
            </div>

            <div className="border-t hairline pt-[18px]">
              <div className="flex items-baseline justify-between">
                <span className="eyebrow text-rust-400">Misconceptions caught</span>
                <span className="font-serif text-[22px] text-rust-400">{atlas.misconceptions.filter((m) => !m.resolved).length}</span>
              </div>
              <ul className="mt-2.5 flex flex-col gap-3">
                {open.map((m) => (
                  <li key={m.id} className="text-[13.5px] leading-relaxed text-ink-200">
                    <span className="font-serif italic text-rust-400 text-[15px] [&_.prose]:inline [&_.prose]:text-[15px] [&_.prose]:text-rust-400 [&_.prose_p]:inline">
                      "<Markdown text={m.picked} />"
                    </span>
                    <br />
                    <span className="text-ink-400 [&_.prose]:inline [&_.prose]:text-[13.5px] [&_.prose]:text-ink-300 [&_.prose_p]:inline">
                      in {m.topic}. Correct: <Markdown text={m.correct} />.
                    </span>
                  </li>
                ))}
                {open.length === 0 && <li className="text-sm text-ink-500">None outstanding.</li>}
              </ul>
            </div>

            <div className="border-t hairline pt-4 flex gap-4 font-mono text-[10px] text-ink-500">
              <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-gold-500" />locked</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full border border-teal-400 box-border" />due</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full border border-dashed border-rust-400 box-border" />shaky</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-px w-3 border-t border-dashed border-ink-200" />shared</span>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function Count({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className={`font-serif text-[24px] leading-none ${tone}`}>{n}</span>
      <span className="font-mono text-[10.5px] text-ink-500">{label}</span>
    </span>
  );
}

function overdue(ts: number | null) {
  if (!ts) return '';
  const d = Math.floor((Date.now() - ts) / 86_400_000);
  if (d <= 0) return 'today';
  return `${d}d overdue`;
}
