/**
 * When a node comes back for review. FSRS (the scheduler behind modern
 * Anki) models each node as a memory with a difficulty and a stability,
 * and asks for a review when the chance of still recalling it drops to the
 * requested retention. Compared with a fixed multiplier it takes the
 * quality of the answer into account: a confident pass stretches the
 * interval, a hesitant one barely moves it, a miss resets it.
 *
 * The four FSRS grades map onto what Derive can observe about a check:
 *   Again  a miss, or the tutor marking the node shaky
 *   Hard   a pass the learner said they were unsure of
 *   Good   a confident pass
 *   Easy   never chosen automatically; a confident pass is Good
 */
import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card, type Grade as FsrsGrade } from 'ts-fsrs';
import type { NodeRow } from './db.js';

const DAY = 86_400_000;

/** Learning steps are for flashcards seen minutes apart; a node is checked once per lesson, so every grade lands in the review state directly. */
const scheduler = fsrs(generatorParameters({ request_retention: 0.9, enable_fuzz: false, learning_steps: [], relearning_steps: [] }));

export type Confidence = 'sure' | 'unsure';
export type Grade = 'again' | 'hard' | 'good';

/** The grade a check earns: a miss is Again, an unsure pass is Hard, a confident pass is Good. */
export function grade(correct: boolean, confidence: Confidence | null | undefined): Grade {
  if (!correct) return 'again';
  return confidence === 'unsure' ? 'hard' : 'good';
}

const RATING: Record<Grade, FsrsGrade> = { again: Rating.Again, hard: Rating.Hard, good: Rating.Good };

/** The memory state a node row carries, as an FSRS card. A node never reviewed is a new card. */
function cardOf(node: Pick<NodeRow, 'stability' | 'difficulty' | 'reps' | 'lapses' | 'last_review' | 'review_at' | 'interval_days'>, now: number): Card {
  if (node.stability == null || node.difficulty == null) return createEmptyCard(new Date(now));
  return {
    due: new Date(node.review_at ?? now),
    stability: node.stability,
    difficulty: node.difficulty,
    elapsed_days: node.last_review ? Math.max(0, (now - node.last_review) / DAY) : 0,
    scheduled_days: node.interval_days,
    learning_steps: 0,
    reps: node.reps,
    lapses: node.lapses,
    state: State.Review,
    last_review: node.last_review ? new Date(node.last_review) : undefined,
  };
}

export type Scheduled = {
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  interval_days: number;
  review_at: number;
  last_review: number;
};

/** The node's next memory state after a check graded `g` at `now`. */
export function schedule(node: Parameters<typeof cardOf>[0], g: Grade, now = Date.now()): Scheduled {
  const { card } = scheduler.next(cardOf(node, now), new Date(now), RATING[g]);
  // FSRS may schedule a lapsed node for later today; a node is checked at most once per sitting, so tomorrow is the floor.
  const reviewAt = Math.max(card.due.getTime(), now + DAY);
  return {
    stability: card.stability,
    difficulty: card.difficulty,
    reps: card.reps,
    lapses: card.lapses,
    interval_days: Math.max(1, Math.round((reviewAt - now) / DAY)),
    review_at: reviewAt,
    last_review: now,
  };
}

/** The chance (0 to 1) that the learner still recalls the node now; 1 for a node without a schedule. */
export function retrievability(node: Parameters<typeof cardOf>[0], now = Date.now()): number {
  if (node.stability == null || node.difficulty == null) return 1;
  return scheduler.get_retrievability(cardOf(node, now), new Date(now), false);
}

/**
 * Fractional implicit repetition, after Math Academy's FIRe model (Skycak,
 * The Math Academy Way, ch. 18 and 29): using a claim to derive something
 * built on top of it is itself a retrieval of that claim. When a node is
 * locked with a confident check, the nodes it was derived from get part of
 * the credit a full review would have earned, decaying with distance in
 * the graph. `credit` is that fraction (1 would be a full Good review).
 */
export function implicitRepetition(node: Parameters<typeof cardOf>[0], credit: number, now = Date.now()): Scheduled | null {
  if (node.stability == null || node.difficulty == null) return null;
  const c = Math.max(0, Math.min(1, credit));
  const card = cardOf(node, now);
  const full = scheduler.next(card, new Date(now), Rating.Good).card;
  const stability = card.stability + c * (full.stability - card.stability);
  const interval = Math.max(1, scheduler.next_interval(stability, 0));
  const reviewAt = now + interval * DAY;
  return {
    stability,
    difficulty: card.difficulty,
    reps: node.reps,
    lapses: node.lapses,
    interval_days: interval,
    review_at: reviewAt,
    last_review: now,
  };
}

/**
 * The other direction of the same model: a miss on a node built from this
 * one is weak evidence that this one is not held either. The dependency
 * loses part of the stability a lapse would cost it, and its review is
 * pulled forward accordingly; nothing else changes.
 */
export function implicitLapse(node: Parameters<typeof cardOf>[0], credit: number, now = Date.now()): Scheduled | null {
  if (node.stability == null || node.difficulty == null) return null;
  const c = Math.max(0, Math.min(1, credit));
  const card = cardOf(node, now);
  const lapsed = scheduler.next(card, new Date(now), Rating.Again).card;
  const stability = card.stability - c * (card.stability - lapsed.stability);
  const interval = Math.max(1, scheduler.next_interval(stability, card.elapsed_days));
  const reviewAt = Math.min(node.review_at ?? Infinity, (node.last_review ?? now) + interval * DAY, now + interval * DAY);
  return {
    stability,
    difficulty: card.difficulty,
    reps: node.reps,
    lapses: node.lapses,
    interval_days: Math.max(1, Math.round((reviewAt - now) / DAY)),
    review_at: Math.max(reviewAt, now + DAY),
    last_review: node.last_review ?? now,
  };
}
