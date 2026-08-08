/**
 * Segment budget aggregation — powers the E.M Bakış "Live Realized ×
 * Projected P&L" table's "Project Budget" column.
 *
 * Source entity: `mserp_tryaiprojectbudgetlineentities` — one row per
 * (segment, month, projectexpenseid). It has NO project FK; budget is
 * planned at the segment × calendar-month level. `mserp_year` is an
 * end-of-month date (e.g. "2025-07-31T00:00:00Z").
 *
 * "Project Budget" = budgeted NET P&L per segment × month, calibrated to
 * the Power BI report **to the dollar** (July 2025 = 6,264,198):
 *   Sales − Purchase − Trade − Other Fixed Costs − Finance − Depreciation
 * i.e. Sales Budget is the ONLY positive; every other category (Purchase,
 * Trade, Other Fixed Costs, Finance Income/(Expense), Depreciation) is
 * SUBTRACTED. Verified against the PBI segment matrix: Central America
 * 2,159,945 · Iraq 2,990,000 · Eritrea 572,000 · International −199,041 …
 * (An earlier "+Finance, Trade excluded" reading was wrong — it inflated
 * Jul-25 to 11.4M vs the true 6.26M.) Category labels are matched by
 * prefix because `mserp_projectexpenseid` can arrive truncated
 * (e.g. "Finance Income/(Expe"). "CF" / unknown categories don't count.
 */

export const SEGMENT_BUDGET_BY_MONTH_CACHE = "segmentBudgetByMonth";

/** Compact cache row — one per (segment, monthKey). */
export interface SegmentBudgetMonthRow {
  segment: string;
  /** "YYYY-MM" calendar month derived from `mserp_year`. */
  monthKey: string;
  /** Budgeted net P&L (USD) for the segment in that month. */
  netUsd: number;
}

/** Signed contribution of each budget category to net P&L. Matched by
 *  prefix (case-insensitive) for resilience against truncated labels. */
function categorySign(rawCategory: string): number {
  const c = rawCategory.trim().toLowerCase();
  if (c.startsWith("sales")) return +1; // the only positive
  if (
    c.startsWith("purchase") ||
    c.startsWith("trade") ||
    c.startsWith("other fixed") ||
    c.startsWith("finance") ||
    c.startsWith("depreciation")
  ) {
    return -1;
  }
  // "CF" / unknown categories don't feed the net P&L budget.
  return 0;
}

function monthKeyOf(isoDate: unknown): string | null {
  if (typeof isoDate !== "string" || !isoDate) return null;
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return null;
  // Use UTC parts — `mserp_year` is a midnight-UTC end-of-month stamp;
  // local-time getMonth() could roll back a day in negative offsets.
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Roll raw budget-line rows up to one signed net-P&L figure per
 * (segment, monthKey). Server-side groupby can't help here —
 * Dataverse rejects `groupby` on datetime fields — so the refresh
 * pulls the (small, ~1.3k row) entity raw and we fold it here.
 */
export function aggregateSegmentBudgetByMonth(
  rows: Record<string, unknown>[]
): SegmentBudgetMonthRow[] {
  const map = new Map<string, SegmentBudgetMonthRow>();
  for (const r of rows) {
    const segment = String(r.mserp_segment ?? "").trim();
    if (!segment) continue;
    const monthKey = monthKeyOf(r.mserp_year);
    if (!monthKey) continue;
    const sign = categorySign(String(r.mserp_projectexpenseid ?? ""));
    if (sign === 0) continue;
    const amount = Number(r.mserp_amount) || 0;
    const key = `${segment}::${monthKey}`;
    const existing = map.get(key);
    if (existing) existing.netUsd += sign * amount;
    else map.set(key, { segment, monthKey, netUsd: sign * amount });
  }
  return [...map.values()];
}

/** segment → (monthKey → net budget USD). Built from the cached rows. */
export function buildSegmentBudgetMap(
  rows: SegmentBudgetMonthRow[]
): Map<string, Map<string, number>> {
  const map = new Map<string, Map<string, number>>();
  for (const r of rows) {
    let inner = map.get(r.segment);
    if (!inner) {
      inner = new Map<string, number>();
      map.set(r.segment, inner);
    }
    inner.set(r.monthKey, (inner.get(r.monthKey) ?? 0) + r.netUsd);
  }
  return map;
}

/**
 * Budget for one month across a set of DISTINCT segments — the table's
 * "Project Budget" cell. Each segment's monthly budget is counted once
 * (even when several filtered projects share it).
 */
export function budgetForMonth(
  budgetMap: Map<string, Map<string, number>>,
  segments: Iterable<string>,
  monthKey: string
): number {
  let total = 0;
  const seen = new Set<string>();
  for (const s of segments) {
    if (!s || seen.has(s)) continue;
    seen.add(s);
    total += budgetMap.get(s)?.get(monthKey) ?? 0;
  }
  return total;
}
