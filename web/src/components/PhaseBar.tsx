const PHASES = [
  { id: 'probe', label: 'Probe', hint: 'find the edge of what you know' },
  { id: 'plan', label: 'Plan', hint: 'draw the dependency map' },
  { id: 'teach', label: 'Teach', hint: 'lock in one node at a time' },
];

export function PhaseBar({ phase }: { phase: string }) {
  const idx = Math.max(0, PHASES.findIndex((p) => p.id === phase));
  return (
    <ol className="flex items-center gap-3.5">
      {PHASES.map((p, i) => {
        const state = i < idx ? 'done' : i === idx ? 'active' : 'todo';
        return (
          <li key={p.id} className="flex items-center gap-3.5">
            <span title={p.hint} className="flex items-center gap-2">
              {state === 'active' && <span className="h-1.5 w-1.5 rounded-full bg-gold-500 shadow-[0_0_12px_rgba(232,176,75,0.8)]" />}
              <span className={`eyebrow ${state === 'active' ? 'text-gold-500' : state === 'done' ? 'text-ink-300' : 'text-ink-500'}`}>{p.label}</span>
            </span>
            {i < PHASES.length - 1 && <span className={`h-px w-9 ${i < idx ? 'bg-ink-400' : 'bg-ink-700'}`} />}
          </li>
        );
      })}
    </ol>
  );
}
