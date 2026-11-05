/**
 * The first thing a returning learner reads on Home: what to do next.
 *
 * Retrieval beats re-reading, so the review that is due leads — not a blank
 * topic box. That is the one sentence this block is allowed, and the order of
 * the three rows is the whole of the design: review, continue, start new, every
 * day, in that order.
 *
 * The block keeps **one shape every day**. With nothing due, the lead row does
 * not disappear and is not replaced by a disabled control: it becomes a quiet
 * line in the same box at the same height, saying so. A row that comes and goes
 * teaches the learner to re-read the page to find out where things are, and a
 * dead control teaches them to click something that does nothing. Neither is
 * worth the pixels it would save.
 *
 * Nothing here nags. There is no streak, no daily goal, no loss framing and no
 * notification: the count informs, and a learner who skips a day is told what is
 * waiting, not what they broke.
 *
 * It renders only when the learner has at least one lesson — Home's own hero is
 * the empty state, unchanged — and only once both of Home's reads are in hand,
 * so no row shows a placeholder and no row's copy changes under someone who is
 * already reading it.
 */
import { Link } from 'react-router-dom';

/** An interactive row: the rhythm of the "Or start from one of these" rows already on the page, plus the explicit focus ring this phase is about. */
const ROW =
  'group block w-full text-left py-3 border-t border-ink-100/10 transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-gold-500/60';
/** The same box, inert: a statement of fact in the row's own place. Not a button, not focusable, no arrow. */
const QUIET = 'block w-full text-left py-3 border-t border-ink-100/10 cursor-default';
/** Trailing, quiet, and it brightens with the row rather than on its own. */
const ARROW = 'ml-2 font-mono text-[11px] text-ink-500 group-hover:text-ink-300';

export function NextStep({
  due,
  resume,
  onReview,
  onStartNew,
}: {
  due: number;
  /** The most recent lesson that has a graph, or null when no lesson has one yet. */
  resume: { id: string; topic: string } | null;
  onReview: () => void;
  onStartNew: () => void;
}) {
  return (
    <div className="pt-5">
      {due > 0 ? (
        <button type="button" onClick={onReview} className={`${ROW} font-serif text-[22px] text-ink-50 hover:text-gold-400`}>
          Review <span className="text-teal-400">{due}</span> due
          <span className={ARROW}>→</span>
        </button>
      ) : (
        <div className={`${QUIET} font-serif text-[22px] text-ink-500`}>Nothing due today</div>
      )}

      {resume ? (
        <Link to={`/lesson/${resume.id}`} className={`${ROW} font-serif text-[1.2rem] text-ink-300 hover:text-ink-50`}>
          Continue{' '}
          {/* Bounded in characters rather than in pixels, so the quoted topic truncates inside the row instead of wrapping it to a second line. */}
          <span className="inline-block max-w-[42ch] truncate align-bottom">{`"${resume.topic}"`}</span>
          <span className={ARROW}>→</span>
        </Link>
      ) : (
        <div className={`${QUIET} font-serif text-[1.2rem] text-ink-500`}>No lesson in progress</div>
      )}

      <button type="button" onClick={onStartNew} className={`${ROW} font-serif text-[1.2rem] text-ink-300 hover:text-ink-50`}>
        Start new
        <span className={ARROW}>↓</span>
      </button>
    </div>
  );
}
