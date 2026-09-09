import { FileText, X } from 'lucide-react';
import type { Material } from '../lib/types';
import { describeMaterial } from '../lib/useMaterials';

/** The attached files as quiet rows: name, size in pages, an optional remove. */
export function MaterialList({
  materials,
  uploading = [],
  onRemove,
  compact,
}: {
  materials: Material[];
  uploading?: string[];
  onRemove?: (id: string) => void;
  compact?: boolean;
}) {
  if (!materials.length && !uploading.length) return null;
  return (
    <ul className={compact ? 'flex flex-col gap-2.5' : ''}>
      {materials.map((m) => (
        <li key={m.id} className={`group flex min-w-0 ${compact ? 'items-start gap-2.5' : 'items-baseline gap-3 py-2.5 border-t border-ink-100/10'}`}>
          <FileText size={compact ? 12 : 14} strokeWidth={1.8} className={`text-ink-500 shrink-0 ${compact ? 'mt-[3px]' : 'self-center'}`} />
          {compact ? (
            <span className="min-w-0" title={m.name}>
              <span className="block text-[12.5px] leading-[1.35] text-ink-200 text-pretty line-clamp-2">{m.name}</span>
              <span className="block font-mono text-[10px] text-ink-500 mt-0.5">{describeMaterial(m)}</span>
            </span>
          ) : (
            <>
              <span className="min-w-0 truncate text-[15px] text-ink-100" title={m.name}>
                {m.name}
              </span>
              <span className="font-mono text-[10.5px] text-ink-500 whitespace-nowrap">{describeMaterial(m)}</span>
            </>
          )}
          {onRemove && (
            <button
              type="button"
              title="Remove"
              onClick={() => onRemove(m.id)}
              className="ml-auto opacity-0 group-hover:opacity-100 focus:opacity-100 text-ink-500 hover:text-rust-400 transition-opacity self-center"
            >
              <X size={13} />
            </button>
          )}
        </li>
      ))}
      {uploading.map((name, i) => (
        <li key={`${name}-${i}`} className={`flex items-baseline gap-3 min-w-0 ${compact ? '' : 'py-2.5 border-t border-ink-100/10'}`}>
          <span className="relative flex h-2 w-2 self-center shrink-0">
            <span className="absolute inline-flex h-full w-full rounded-full bg-gold-500 opacity-60 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-gold-500" />
          </span>
          <span className={`min-w-0 truncate ${compact ? 'text-[13px] text-ink-300' : 'text-[15px] text-ink-300'}`}>{name}</span>
          <span className="font-mono text-[10.5px] text-ink-500">reading</span>
        </li>
      ))}
    </ul>
  );
}
