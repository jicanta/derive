/**
 * What a lesson cost, and the one sentence that says so.
 *
 * STUB — the arithmetic and the formatter arrive in the GREEN step of this task.
 */
import type { CostSource, UsageRow } from './db.js';
import type { PriceTable } from './pricing.js';

/** A lesson's total and how firm it is. */
export type Cost = { usd: number | null; source: CostSource };

/** A usage row as the cost path reads it. */
export type CostRow = UsageRow & { searches?: number | null };

/** The least firm source present. */
export function weakestSource(sources: readonly CostSource[]): CostSource {
  void sources;
  return 'unknown';
}

/** A lesson's total, priced from the rows and the table. */
export function costOf(rows: readonly CostRow[], table: PriceTable): Cost {
  void rows;
  void table;
  return { usd: null, source: 'unknown' };
}

/** The money string both call sites share. */
export function costLabel(usd: number | null, source: CostSource | null): string | null {
  void usd;
  void source;
  return null;
}
