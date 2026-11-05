/**
 * The one header six pages wear: Lesson, Atlas, Library, You, Settings and
 * Usage. The shell string below is the one those six each carried a copy of,
 * in the shipped class order, so this reads as an extraction rather than a
 * rewrite — and so there is one place for Phase 6's style attributes to land
 * instead of six.
 *
 * Two things here are genuinely new, and both are the same open UI-review
 * finding: the lesson header starves its own topic at 1024px, measured down to
 * 0px once the cost pill is present. The title's `min-w-[8ch] flex-1 basis-0`
 * is that fix, and it lives here because this is the only place it needs to
 * exist — adding the due pill to six headers without it would repeat the
 * finding on six pages at once. Page-specific pills beside the title take
 * `min-w-0` so the loss lands on them rather than on what the learner came to
 * read.
 *
 * `data-focus-hide` is on the root, unconditionally and with no prop to turn it
 * off. The marker arrived here with the lesson page's inline header, and the
 * CSS rule behind it only fires while the document element carries the focus
 * attribute — which only the lesson page ever sets. So it is inert on the other
 * five pages, and nothing lesson-specific enters a shared component to keep the
 * lesson's chrome disappearing in focus mode.
 *
 * What this component deliberately does *not* absorb: the phase indicator, the
 * locked count, voice, export and the live dot. Five of the six pages have none
 * of them, and absorbing them would turn one header into a lesson component.
 * They stay page-specific children, and so does the learner-switch menu, which
 * is in four of the six headers and is not added to the other two.
 */
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { DuePill } from './DuePill';

/**
 * Where the back arrow goes, named. The link is an icon and nothing else, so
 * its accessible name has to be worded from its target or a screen reader
 * hears an empty link: Usage came in through Settings and goes back there,
 * every other page goes back to the lesson list.
 */
const BACK = { '/': 'all lessons', '/settings': 'settings' } as const;

export function PageHeader({
  to,
  title,
  subtitle,
  due,
  children,
  right,
  menu,
}: {
  to: keyof typeof BACK;
  title: ReactNode;
  /** Rendered as an emphasised fragment inside the heading, after a middle dot. */
  subtitle?: ReactNode;
  /** The due count for the pill. Omit it on a page that places its own pill inside its right-hand group. */
  due?: number | null;
  /** Page-specific content between the title and the right slot: the lesson's cost or companion pill. */
  children?: ReactNode;
  /** Page-specific content inside the right slot, after the due pill. */
  right?: ReactNode;
  /** The learner-switch menu, last in the right slot. Four of the six headers pass it. */
  menu?: ReactNode;
}) {
  const back = `Back to ${BACK[to]}`;
  return (
    <header data-focus-hide className="flex items-center gap-5 px-5 md:px-6 h-[60px] border-b hairline shrink-0">
      <Link to={to} aria-label={back} title={back} className="shrink-0 text-ink-400 hover:text-ink-50 transition-colors">
        <ArrowLeft size={18} strokeWidth={1.8} />
      </Link>
      <h1 className="font-serif text-[22px] tracking-[-0.01em] truncate min-w-[8ch] flex-1 basis-0 text-ink-50">
        {title}
        {subtitle && <em className="text-ink-400"> · {subtitle}</em>}
      </h1>
      {children}
      <div className="ml-auto flex items-center gap-6">
        <DuePill due={due} />
        {right}
        {menu}
      </div>
    </header>
  );
}
