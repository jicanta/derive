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
import type { ForecastDay, Retention } from '../lib/types';

/** The definition of "first try", where the learner can read it. Written once on the server and repeated here because a tooltip is copy, not logic. */
const FIRST_TRY = "True retention: review questions passed first try over the last 90 days. The target is FSRS's fixed request_retention of 0.9 — there is no slider.";

/** The strip's height in px, which is `h-8`. A bar's height is this scaled by the day's share of the busiest day. */
const STRIP = 32;
/** A day with nothing scheduled still draws, so the strip reads as fourteen days rather than as a gap. */
const STUB = 2;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

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
      {/* The route withholds the percentage under its own sample floor and sends
          null; the threshold is not restated here. The target stays either way —
          it is a constant, not a figure drawn from the same thin sample. */}
      <p className="mt-2.5 font-mono text-[11px]" title={FIRST_TRY}>
        {data.trueRetention === null ? <span className="text-ink-500">not enough reviews yet</span> : <span className="text-ink-100">{data.trueRetention}% held on first try</span>}
        <span className="text-ink-500"> · target {data.desired}%</span>
      </p>
      <Forecast days={data.forecast} />
    </div>
  );
}

/**
 * The fortnight ahead. Fourteen 13px bars plus thirteen 8px gaps is 286px,
 * inside the 296px the shipped 340px aside leaves at `p-[22px]`, so the strip
 * fits at every count and never widens the panel.
 */
function Forecast({ days }: { days: ForecastDay[] }) {
  const total = days.reduce((s, d) => s + d.count, 0);
  const busiest = days.reduce((m, d) => Math.max(m, d.count), 0);
  return (
    <div className="mt-3">
      <div className="flex items-end gap-2 h-8">
        {days.map((d, i) => (
          <span
            key={d.day}
            className={`w-[13px] rounded-[2px] shrink-0 ${d.count === 0 ? 'bg-ink-700' : i === 0 ? 'bg-teal-400' : 'bg-teal-400/70'}`}
            style={{ height: d.count === 0 ? STUB : Math.max(STUB, Math.round((STRIP * d.count) / busiest)) }}
            title={`${dayLabel(d.day)} · ${plural(d.count, 'review')}`}
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[10px] text-ink-500">
        <span>today</span>
        <span>+7d</span>
        <span>+14d</span>
      </div>
      <p className="mt-1 font-mono text-[10px] text-ink-500">{total === 0 ? 'nothing due in the next 14 days' : `${plural(total, 'review')} in the next 14 days`}</p>
    </div>
  );
}

/** `Wed 5 Nov` — the weekday and month names come from the browser's locale, the order from the copy contract. */
function dayLabel(ts: number) {
  const d = new Date(ts);
  return `${d.toLocaleDateString(undefined, { weekday: 'short' })} ${d.getDate()} ${d.toLocaleDateString(undefined, { month: 'short' })}`;
}
