import type { Project } from "@/lib/dataverse/entities";
import { selectExecutionDate } from "./project";
import { selectProjectPL } from "./profitLoss";
import { toUsdAtDate } from "@/lib/finance/fxRates";
import { getFinancialYear, type FinancialYear } from "@/lib/dashboard/financialPeriod";

/**
 * Monthly estimated × realized P&L (P&L) — powers the E.M Bakış
 * "Aylık P&L Performansı" dual-bar chart.
 *
 * One point per financial-year month (Jul → Jun, Tiryaki convention).
 * Each project is bucketed into the month of its execution date
 * (`operationPeriod` → `projectDate` fallback), the same date the rest
 * of the dashboard keys FY/period math on.
 *
 * Estimated P&L (per project, FX-converted at the execution date):
 *   estSalesUsd − estPurchaseUsd − estExpenseUsd
 * mirrors `aggregateEstimatedPL` exactly so the monthly bars sum back to
 * the Dönem Performansı headline.
 *
 * Realized P&L (per project) — matches the project-detail BudgetSalesCard:
 *   realizedSalesUsd − realizedPurchaseUsd − realizedExpenseUsd
 * All three are realized figures: sales from `salesActualUsd`, purchase
 * from `purchaseActualUsd` (both server-aggregated, USD-only), expense
 * from the PBI-calibrated `actualExpenseRollup`. A project contributes to
 * the realized series only when it carries a realized signal (invoiced
 * sales, a vendor invoice, or a realized-expense row); when the rollup
 * hasn't run for the filtered set (`hasRealizedCoverage = false`) the
 * whole realized series is null so the chart hides those bars.
 */

export interface MonthlyPLPoint {
  /** "2025-07" — calendar-year + month key for bucketing. */
  monthKey: string;
  /** Short localized month label, e.g. "Tem". */
  monthLabel: string;
  /** Σ estimated P&L (USD) for projects in this month. */
  estPL: number;
  /** Σ realized P&L (USD); null when the rollup hasn't covered the set. */
  realizedPL: number | null;
  /** Projects with a realized signal that fed `realizedPL`. */
  realizedCount: number;
  /** Month sits after the current calendar month → render as a faint
   *  "buffer" bar so past/current vs. future read at a glance. */
  isFuture: boolean;
}

const KNOWN_CURRENCIES = new Set(["USD", "EUR", "TRY", "RUB", "GBP"]);

export interface RealizedPLAggregate {
  /** Σ realized P&L (USD) across contributing projects. */
  pl: number;
  /** Σ realized invoiced sales (USD) — the margin denominator. */
  salesUsd: number;
  /** pl / salesUsd × 100; 0 when there are no realized sales. */
  marginPct: number;
  /** Projects that carried a realized signal and contributed. */
  contributingCount: number;
}

/**
 * Realized (gerçekleşen) net P&L rollup across a project set — the
 * headline twin of `aggregateEstimatedPL`, matching BudgetSalesCard:
 *   realizedSalesUsd − realizedPurchaseUsd − realizedExpenseUsd
 * A project contributes only when it has a realized signal (invoiced
 * sales, a vendor invoice, or a realized-expense row); the caller gates
 * the whole figure on rollup coverage before showing it.
 */
export function aggregateRealizedPL(
  projects: Project[],
  realizedExpenseByProject: Map<string, number>
): RealizedPLAggregate {
  let pl = 0;
  let salesUsd = 0;
  let contributingCount = 0;
  for (const p of projects) {
    const realizedSalesUsd = p.salesActualUsd ?? 0;
    const realizedPurchaseUsd = p.purchaseActualUsd ?? 0;
    // BOTH sides must have posted for a project to count as realized — a
    // half-done voyage (bought but not sold, e.g. 2646) would otherwise
    // register a phantom −(purchase) loss. See computeProjectMetrics.
    if (!(realizedSalesUsd > 0 && realizedPurchaseUsd > 0)) continue;
    const realizedExpenseUsd = realizedExpenseByProject.get(p.projectNo) ?? 0;
    pl += realizedSalesUsd - realizedPurchaseUsd - realizedExpenseUsd;
    salesUsd += realizedSalesUsd;
    contributingCount++;
  }
  const marginPct = salesUsd > 0 ? (pl / salesUsd) * 100 : 0;
  return { pl, salesUsd, marginPct, contributingCount };
}

function monthKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * @param projects                 filtered project set
 * @param realizedExpenseByProject projectNo → Σ realized expense USD
 *                                  (from `actualExpenseRollup` rows)
 * @param hasRealizedCoverage      true when the rollup covers the set
 * @param now                      stable "today" reference
 * @param fy                       FY to render (defaults to the FY of `now`)
 */
export function aggregateMonthlyPL(
  projects: Project[],
  realizedExpenseByProject: Map<string, number>,
  hasRealizedCoverage: boolean,
  now: Date = new Date(),
  fy: FinancialYear = getFinancialYear(now)
): MonthlyPLPoint[] {
  const nowKey = monthKeyOf(now);

  // Build the 12 FY-month buckets, Jul (month 6) → Jun.
  const points: MonthlyPLPoint[] = [];
  const indexByKey = new Map<string, number>();
  const monthFmt = new Intl.DateTimeFormat("tr-TR", { month: "short" });
  for (let i = 0; i < 12; i++) {
    const d = new Date(fy.startYear, 6 + i, 1);
    const monthKey = monthKeyOf(d);
    indexByKey.set(monthKey, i);
    points.push({
      monthKey,
      monthLabel: monthFmt.format(d),
      estPL: 0,
      realizedPL: hasRealizedCoverage ? 0 : null,
      realizedCount: 0,
      // Future = strictly after the current calendar month.
      isFuture: monthKey > nowKey,
    });
  }

  for (const p of projects) {
    const exec = new Date(selectExecutionDate(p));
    if (Number.isNaN(exec.getTime())) continue;
    const idx = indexByKey.get(monthKeyOf(exec));
    if (idx === undefined) continue;

    const pl = selectProjectPL(p);
    const cur = (pl.currency ?? "USD").toUpperCase();
    const fxDate = selectExecutionDate(p);
    // Estimated purchase doubles as the realized purchase proxy.
    const estPurchaseUsd = KNOWN_CURRENCIES.has(cur)
      ? toUsdAtDate(pl.purchaseTotal, cur, fxDate)
      : pl.purchaseTotal;

    // Estimated P&L — only projects with priced lines contribute
    // (matches aggregateEstimatedPL's gate).
    if (pl.salesTotal > 0 || pl.purchaseTotal > 0) {
      const estSalesUsd = KNOWN_CURRENCIES.has(cur)
        ? toUsdAtDate(pl.salesTotal, cur, fxDate)
        : pl.salesTotal;
      points[idx].estPL += estSalesUsd - estPurchaseUsd - pl.expenseTotal;
    }

    // Realized P&L — realized sales − realized purchase − realized
    // expense (mirrors BudgetSalesCard). BOTH sides must have posted:
    // a half-done voyage (bought but not sold, e.g. 2646 → purchase 20M,
    // sales 0) would otherwise show a phantom −20M realized bar. Same
    // gate as aggregateRealizedPL + the tables.
    if (hasRealizedCoverage) {
      const realizedSalesUsd = p.salesActualUsd ?? 0;
      const realizedPurchaseUsd = p.purchaseActualUsd ?? 0;
      if (realizedSalesUsd > 0 && realizedPurchaseUsd > 0) {
        const realizedExpenseUsd =
          realizedExpenseByProject.get(p.projectNo) ?? 0;
        points[idx].realizedPL =
          (points[idx].realizedPL ?? 0) +
          (realizedSalesUsd - realizedPurchaseUsd - realizedExpenseUsd);
        points[idx].realizedCount += 1;
      }
    }
  }

  return points;
}
