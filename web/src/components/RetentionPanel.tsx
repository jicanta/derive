/**
 * The Atlas aside's third block: what the learner is holding. Every figure is
 * read from the FSRS state the scheduler wrote and arrives already computed, so
 * this file interpolates numbers and calculates none of them — a panel that
 * worked out its own decay would eventually disagree with the review dates the
 * learner is being given, and then one of the two would be lying.
 *
 * The retention percentage is neutral at every value. Below-target retention is
 * not a failure: FSRS simply shortens the intervals on its own. Painting the one
 * honest number in the app as an accusation would teach the learner to stop
 * reading it, which is the opposite of why it is here.
 *
 * It fetches its own figures so the map and the two shipped blocks are never
 * blocked on this read, and so a failed read is scoped to this block by
 * construction rather than by remembering to scope it.
 */
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Retention } from '../lib/types';

/** The definition of "first try", where the learner can read it. Written once on the server and repeated here because a tooltip is copy, not logic. */
const FIRST_TRY = "True retention: review questions passed first try over the last 90 days. The target is FSRS's fixed request_retention of 0.9 — there is no slider.";

export function RetentionPanel() {
  const [data, setData] = useState<Retention | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api
      .retention()
      .then(setData)
      .catch((e) => setError((e as Error).message));
  }, []);

  if (error) {
    return (
      <div className="border-t hairline pt-[18px]">
        <div className="flex items-baseline justify-between">
          <span className="eyebrow text-gold-500">Retention</span>
        </div>
        <p className="mt-2 font-mono text-[11px] text-rust-400">Retention stats could not be read — reload the page. The map above is unaffected.</p>
      </div>
    );
  }
  // Nothing to be honest about yet: no locked node carries FSRS state, so there
  // is no numerator and no denominator. Same silence as having nothing locked.
  if (!data || data.locked === 0) return null;

  return (
    <div className="border-t hairline pt-[18px]">
      <div className="flex items-baseline justify-between">
        <span className="eyebrow text-gold-500">Retention</span>
        <span className="font-serif text-[22px] text-gold-500">{data.held}</span>
      </div>
      <p className="mt-2 font-mono text-[10px] text-ink-500">
        about {data.held} of {data.locked} locked nodes held right now
      </p>
      <p className="mt-2.5 font-mono text-[11px]" title={FIRST_TRY}>
        {data.trueRetention !== null && <span className="text-ink-100">{data.trueRetention}% held on first try</span>}
        <span className="text-ink-500">{data.trueRetention !== null ? ' · ' : ''}target {data.desired}%</span>
      </p>
    </div>
  );
}
