const PHASES = [
  { id: 'probe', label: 'Probe', hint: 'find the edge of what you know' },
  { id: 'plan', label: 'Plan', hint: 'draw the dependency map' },
  { id: 'teach', label: 'Teach', hint: 'lock in one node at a time' },
];

export function PhaseBar({ phase }: { phase: string }) {
  const idx = Math.max(0, PHASES.findIndex((p) => p.id === phase));
  return (
    <ol className="flex items-center gap-1 text-xs">
      {PHASES.map((p, i) => {
        const state = i < idx ? 'done' : i === idx ? 'active' : 'todo';
        return (
          <li key={p.id} className="flex items-center gap-1">
            <span
              title={p.hint}
              className={`px-2.5 py-1 rounded-full border transition-colors ${
                state === 'active'
                  ? 'border-gold-500 text-gold-400 bg-gold-500/10'
                  : state === 'done'
                    ? 'border-ink-600 text-ink-300'
                    : 'border-ink-800 text-ink-500'
              }`}
            >
              {p.label}
            </span>
            {i < PHASES.length - 1 && <span className={`h-px w-4 ${i < idx ? 'bg-ink-500' : 'bg-ink-800'}`} />}
          </li>
        );
      })}
    </ol>
  );
}
