import { BookOpen, ExternalLink, FileText, GraduationCap, Link2, PlayCircle, ScrollText, StickyNote } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { ResourceEvent, ResourceKind } from '../lib/types';

export const KIND_LABEL: Record<ResourceKind, string> = { article: 'article', video: 'video', book: 'book', paper: 'paper', course: 'course', note: 'note' };

/** The icon for a kind of library entry, shared by the library page and the lesson card. */
export function KindIcon({ kind, size = 14, className = '' }: { kind: ResourceKind; size?: number; className?: string }): ReactNode {
  const p = { size, strokeWidth: 1.8, className };
  switch (kind) {
    case 'video':
      return <PlayCircle {...p} />;
    case 'book':
      return <BookOpen {...p} />;
    case 'paper':
      return <ScrollText {...p} />;
    case 'course':
      return <GraduationCap {...p} />;
    case 'note':
      return <StickyNote {...p} />;
    default:
      return <FileText {...p} />;
  }
}

/**
 * The tutor pointed at something in the learner's library, or saved a
 * source to it: a quiet card with the link, the reason and where to look.
 */
export function ResourceCard({ resource, nodeLabel }: { resource: ResourceEvent; nodeLabel?: string | null }) {
  const r = resource;
  const suggested = r.action === 'suggested';
  const head = suggested ? 'From your library' : r.action === 'saved' ? 'Saved to your library' : 'Already in your library';
  return (
    <div className={`animate-fade-up rounded-[18px] border px-5 py-4 md:px-6 md:py-5 ${suggested ? 'border-gold-500/30 bg-gold-500/[0.035]' : 'border-ink-100/12 bg-ink-900/70'}`}>
      <div className="flex items-center gap-2.5 mb-2.5">
        <span className={`h-1.5 w-1.5 rounded-full ${suggested ? 'bg-gold-500' : 'bg-ink-400'}`} />
        <span className="eyebrow">{head}</span>
        {nodeLabel && <span className="font-mono text-[10px] text-ink-500 truncate">· deepens: {nodeLabel}</span>}
      </div>
      <div className="flex items-start gap-3">
        <span className="text-ink-400 shrink-0 mt-[5px]">
          <KindIcon kind={r.kind} size={15} />
        </span>
        <div className="min-w-0 flex-1">
          {r.url ? (
            <a href={r.url} target="_blank" rel="noreferrer" className="group inline-flex items-baseline gap-2 font-serif text-[1.25rem] leading-snug text-ink-50 hover:text-gold-400 transition-colors">
              <span className="text-pretty">{r.title}</span>
              <ExternalLink size={12} strokeWidth={2} className="shrink-0 self-center text-ink-500 group-hover:text-gold-400" />
            </a>
          ) : (
            <span className="font-serif text-[1.25rem] leading-snug text-ink-50 text-pretty">{r.title}</span>
          )}
          <div className="mt-0.5 font-mono text-[10.5px] text-ink-500 flex flex-wrap gap-x-2">
            <span>{KIND_LABEL[r.kind]}</span>
            {r.author && <span>· {r.author}</span>}
            {r.where && <span className="text-gold-500">· {r.where}</span>}
          </div>
          {r.why && <p className="mt-2 text-[14px] leading-[1.5] text-ink-300 text-pretty">{r.why}</p>}
          {r.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {r.tags.map((t) => (
                <span key={t} className="font-mono text-[10px] text-ink-500">
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      {!suggested && (
        <p className="mt-3 pt-2.5 border-t border-ink-100/8 font-mono text-[10.5px] text-ink-500 inline-flex items-center gap-1.5">
          <Link2 size={10} /> the tutor saved this · <Link to="/library" className="text-ink-300 hover:text-gold-500">open your library</Link>
        </p>
      )}
    </div>
  );
}
