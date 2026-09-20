/**
 * The browser's one-time handoff ticket.
 *
 * The MCP server has to hand the companion page's URL to a browser opener,
 * and an opener is a process: on Linux `/proc/<pid>/cmdline` is world-readable,
 * so whatever is in that URL is published to every other account on the
 * machine for as long as the browser runs. Putting the install token there
 * defeated everything the rest of the code does to keep it in one process —
 * the 0600 file, the mode check in the doctor, the redaction chokepoint. So
 * the URL carries one of these instead: a random value that is worth a single
 * request and one minute, minted only for a caller that already proved it
 * holds the token, and not reversible to it. D-09 still holds; the token never
 * leaves the server process.
 *
 * A topic of its own rather than three more lines in the route file, because
 * an expiry is a clock and a clock has to be pinnable: `redeemTicket` takes
 * `now` with a `Date.now()` default, the same way `schedule.ts` does, so the
 * one-minute life can be driven in a test without a test that waits a minute.
 */
import { randomBytes } from 'node:crypto';

/** How long a handoff ticket is worth anything: longer than a browser takes to launch, shorter than a person reading it off a command line can act on it. */
export const TICKET_TTL_MS = 60_000;

/**
 * The tickets currently outstanding, each mapped to the epoch millisecond at
 * which it stops being one. Deliberate module state, and deliberately in
 * memory rather than on disk: the process that minted a ticket is the only one
 * that would honour it, so a ticket that does not survive a restart is correct
 * rather than lossy — and losing the whole map costs a learner nothing,
 * because a fresh link is printed every time the server starts.
 */
const tickets = new Map<string, number>();

/**
 * A one-use, one-minute stand-in for the install token.
 *
 * Deliberately not handed to `registerSecret`. That set is a small fixed
 * collection of live long-lived values which every egress is scanned against;
 * growing it once per lesson start would make every redaction walk an
 * unbounded list of values that are already worthless. What keeps a ticket out
 * of an error body is its lifetime, not the redactor.
 */
export function mintTicket(now = Date.now()): string {
  for (const [value, expires] of tickets) if (expires <= now) tickets.delete(value);
  const ticket = randomBytes(32).toString('hex');
  tickets.set(ticket, now + TICKET_TTL_MS);
  return ticket;
}

/** Spend a ticket, which works exactly once. An absent or whitespace-only value is not a ticket and is never looked up. */
export function redeemTicket(raw: string | undefined, now = Date.now()): boolean {
  const value = (raw ?? '').trim();
  if (!value) return false;
  const expires = tickets.get(value);
  // Deleted whichever way the check goes: a ticket that has been guessed at once is spent.
  tickets.delete(value);
  return expires !== undefined && expires > now;
}
