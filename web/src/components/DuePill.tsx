/**
 * How many nodes are due for review, in every page header and in Home's nav.
 *
 * A review the learner cannot see is a review they do not do, so the count
 * follows them and the forgetting curve is never out of sight. That is the
 * whole of why this capsule exists, and it is also the whole of what it does:
 * it states a number and links to where a review starts.
 *
 * Grey, not teal, and the reason is worth keeping next to the class string.
 * Teal is bound to the places where the learner is actually *choosing* to
 * review — Home's lead row, the Atlas due block — and a pill that reads as a
 * nudge on six pages at once is a nudge nobody can dismiss. Reminders and
 * notifications are deferred; this informs and never pressures.
 *
 * At zero it renders nothing. A 60px header has no shape to preserve for a
 * dead control, and "nothing due" is said in the two places a learner looks
 * for it: Home's next-step block and the Atlas due block. The count is also
 * absent while it is still unknown — never a dash, a spinner, or a zero that
 * turns into a number under the learner.
 *
 * The shell composes `pill` rather than restating it, so Phase 6 has one place
 * to restyle every capsule in the app. The one thing it drops from the cost
 * pill beside it is the `hidden md:` prefix: visible at every width is the
 * whole point of the requirement.
 */
import { Link } from 'react-router-dom';
import { pill } from './fields';

export function DuePill({ due }: { due: number | null | undefined }) {
  if (!due || due < 1) return null;
  return (
    <Link
      to="/"
      className={`${pill} gap-1.5 shrink-0 whitespace-nowrap hover:text-ink-50 transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-gold-500/60`}
      title={`${due} node${due === 1 ? '' : 's'} due for review — start a review`}
    >
      {due} due
    </Link>
  );
}
