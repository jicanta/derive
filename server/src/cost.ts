/**
 * What a lesson cost, and the one sentence that says so.
 *
 * A lesson's total is a pure function of its `usage` rows and a price table:
 * no HTTP, no SQL, no clock. The row types come in as types only, so nothing
 * here opens the database and a test can read every case from literals — the
 * same shape schedule.ts has, and for the same reason.
 *
 * The reasoning that must not be undone: **a figure may never claim more
 * firmness than its weakest input.** Three rules follow from it and each of them
 * looks like an over-complication until the day it stops a lie.
 *
 * The label vocabulary is four words rather than three. `unknown` → `not
 * reported` says the honest blank out loud; folding it into `estimated` would
 * assert something the ledger does not know, and every Claude Code and Codex
 * lesson, plus every turn an upgraded install backfilled, lands exactly there.
 *
 * A lesson whose rows disagree takes the weakest word, and `weakestSource` makes
 * that a total, order-independent function rather than whatever the last row
 * happened to say. A subscription lesson that later ran one metered turn reads
 * `about $0.09 estimated`, not `not billed`.
 *
 * A sub-cent total reads `under $0.01` rather than rounding to `$0.00`, because
 * a cheap lesson on a metered key is not a free one. The same instinct runs
 * through `costOf`: a model the table does not carry contributes no money and
 * carries `unknown`, and a request the provider reported nothing for is never
 * priced as zero.
 *
 * The native per-call search charge is folded into the row's own money rather
 * than given a column. D-20 asks that the charge land in the ledger instead of
 * vanishing from the lesson's cost, and the alternative — one extra `usage` row
 * with every token column null — costs a migration and gives `cost_source` a
 * second meaning. Pricing it here keeps the lesson total correct with no schema
 * change; plan 03-06 supplies the count.
 */
import type { CostSource, UsageRow } from './db.js';
import type { PriceTable } from './pricing.js';

/** A lesson's total in US dollars and how firm that total is; `usd` is null when there is no money to show. */
export type Cost = { usd: number | null; source: CostSource };

/** A usage row as the cost path reads it: the ledger row plus the number of native searches that request made, which the ledger has no column for. */
export type CostRow = UsageRow & { searches?: number | null };

/** How firm each source is. `subscription` and `provider` are equally firm and mean different things, which is why a lesson carrying both is handled below rather than by this number alone. */
const RANK: Record<CostSource, number> = { unknown: 0, table: 1, subscription: 2, provider: 2 };

/** The four words, fixed by D-14. */
const LABEL: Record<CostSource, string> = { provider: 'billed', table: 'estimated', subscription: 'not billed', unknown: 'not reported' };

/** A null count or a null rate contributes nothing; it is never read as a zero that was measured. */
const num = (v: number | null | undefined): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/**
 * The least firm source present, as one total function of the multiset.
 *
 * `provider` only when every row is `provider`; `subscription` only when every
 * row is `subscription`; `unknown` as soon as any row is `unknown`; `table`
 * everywhere else. A lesson that is part subscription and part metered is
 * neither word — part of its total is a figure and part of it is not, so it
 * falls to `estimated`, the firmest word that overstates neither half. A Set
 * is what makes the answer independent of the order the rows arrived in.
 */
export function weakestSource(sources: readonly CostSource[]): CostSource {
  const seen = new Set<CostSource>(sources);
  let weakest: CostSource | null = null;
  for (const s of seen) if (weakest === null || RANK[s] < RANK[weakest]) weakest = s;
  if (weakest === null) return 'unknown';
  if (RANK[weakest] === 2 && seen.size > 1) return 'table';
  return weakest;
}

/**
 * A lesson's total, priced from its rows and the merged table.
 *
 * A `provider` row contributes the figure the provider billed and the table is
 * never consulted for it. A `subscription` row contributes nothing and says so.
 * Any other row is priced from `table[row.driver]?.[row.model]` — `driver` is
 * the lookup key because `recordUsage` denormalises the turn's driver onto every
 * row and plan 03-01 made that the catalogue `ProviderId`.
 */
export function costOf(rows: readonly CostRow[], table: PriceTable): Cost {
  if (!rows.length) return { usd: null, source: 'unknown' };
  const sources: CostSource[] = [];
  let usd = 0;
  let priced = false;
  for (const r of rows) {
    if (r.cost_source === 'provider') {
      sources.push('provider');
      if (r.cost_usd != null) {
        usd += r.cost_usd;
        priced = true;
      }
      continue;
    }
    if (r.cost_source === 'subscription') {
      sources.push('subscription');
      continue;
    }
    // A request nobody reported a count for has nothing to price; pricing its nulls at zero would turn a blank into a claim that it was free.
    if (r.input_tokens == null && r.output_tokens == null && r.cache_read_tokens == null && r.cache_write_tokens == null) {
      sources.push('unknown');
      continue;
    }
    const price = table[r.driver]?.[r.model ?? ''];
    if (!price) {
      sources.push('unknown');
      continue;
    }
    usd += num(r.input_tokens) * price.input + num(r.output_tokens) * price.output + num(r.cache_read_tokens) * num(price.cache_read) + num(r.cache_write_tokens) * num(price.cache_write) + num(r.searches) * num(price.web_search);
    priced = true;
    sources.push('table');
  }
  // Nothing contributed money: show the label alone rather than a $0.00 the ledger never measured.
  return { usd: priced ? usd : null, source: weakestSource(sources) };
}

/**
 * The money string, produced here and nowhere else so the lesson header and the
 * Home row can never diverge.
 *
 * A null `source` means the lesson has no usage rows at all and there is nothing
 * to say; the answer is null rather than an empty string, so a caller renders no
 * segment instead of an empty one.
 */
export function costLabel(usd: number | null, source: CostSource | null): string | null {
  if (source === null) return null;
  const label = LABEL[source];
  // A subscription path has no per-request price and an unreported one has no figure at all; neither ever carries money, whatever was passed in.
  if (source === 'subscription' || source === 'unknown') return label;
  if (usd === null || usd <= 0) return label;
  // toFixed(2) renders 0.005 as `0.01`, so the boundary belongs on the `about` side and a learner never sees `$0.00`.
  if (usd < 0.005) return `under $0.01 ${label}`;
  return `about $${usd.toFixed(2)} ${label}`;
}
