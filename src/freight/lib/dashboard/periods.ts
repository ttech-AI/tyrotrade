import {
  filterByFinancialYear,
  findFyByKey,
  getFinancialYear,
} from "./financialPeriod";

/**
 * Period taxonomy.
 *
 * - `monthly | quarterly | yearly`: rolling-window (last N days from `now`).
 *   Useful for "operasyonel görünürlük" — son N gün ne oldu?
 * - `fy`: Tiryaki financial year (Jul 1 → Jun 30). When selected, an
 *   accompanying `fyKey` (e.g. "25-26") narrows it to a specific year.
 *   Default = current FY. Used for executive reporting.
 * - `all`: no time filter.
 */
export type PeriodKey = "monthly" | "quarterly" | "yearly" | "fy" | "all";

export interface PeriodMeta {
  key: PeriodKey;
  label: string;
  /** Days back from `now`, or null for unbounded / FY-specific. */
  days: number | null;
}

export const PERIODS: PeriodMeta[] = [
  { key: "monthly", label: "Aylık", days: 30 },
  { key: "quarterly", label: "Çeyreklik", days: 90 },
  { key: "yearly", label: "Yıllık", days: 365 },
  { key: "fy", label: "Finansal Dönem", days: null },
  { key: "all", label: "Tüm Zamanlar", days: null },
];

/** Default = "fy" + current financial year. Executive lens. */
export const DEFAULT_PERIOD: PeriodKey = "fy";

/**
 * Return only items whose execution date falls within the rolling
 * window specified by `period`. "all" / "fy" returns the input
 * unchanged — for those, prefer `applyPeriodFilter` which knows how
 * to dispatch.
 *
 * Date priority (2026-05): `operationPeriod` (F&O Operasyon
 * Periyodu) → `projectDate` (signing-date fallback).
 *
 * Kept for backwards compat (King Projects panel still calls this
 * with the legacy 4-key set).
 */
export function filterByPeriod<
  T extends { projectDate: string; operationPeriod?: string | null },
>(items: T[], period: PeriodKey, now: Date = new Date()): T[] {
  const meta = PERIODS.find((p) => p.key === period);
  if (!meta || meta.days == null) return items;
  const cutoff = now.getTime() - meta.days * 24 * 60 * 60 * 1000;
  return items.filter((it) => {
    const t = new Date(it.operationPeriod || it.projectDate).getTime();
    return Number.isFinite(t) && t >= cutoff;
  });
}

/**
 * Universal period filter — supports rolling windows + financial year +
 * "all". When `period === "fy"`, `fyKey` selects which year ("25-26").
 * Falls back to current FY if `fyKey` is null/invalid.
 *
 * This is the function dashboard tiles + leaderboards should call.
 * Both inner helpers (`filterByPeriod`, `filterByFinancialYear`) key
 * on `operationPeriod ?? projectDate`.
 */
export function applyPeriodFilter<
  T extends { projectDate: string; operationPeriod?: string | null },
>(
  items: T[],
  period: PeriodKey,
  fyKey: string | null,
  now: Date = new Date()
): T[] {
  if (period === "all") return items;
  if (period === "fy") {
    const fy = (fyKey && findFyByKey(fyKey)) || getFinancialYear(now);
    return filterByFinancialYear(items, fy);
  }
  return filterByPeriod(items, period, now);
}
