import type { Project } from "@/lib/dataverse/entities";
import { selectExecutionDate, selectTotalTons } from "./project";
import { selectProjectPL } from "./profitLoss";
import { toUsdAtDate } from "@/lib/finance/fxRates";
import {
  getFinancialYear,
  type FinancialYear,
} from "@/lib/dashboard/financialPeriod";
import { budgetForMonth } from "@/lib/dataverse/segmentBudget";

/**
 * "Live Realized × Projected P&L" table — the E.M Bakış BI replica.
 *
 * One row per financial-year month (Jul→Jun); projects bucket on their
 * operation/execution month (same key as the chart). Columns:
 *   Projected = tahmini  · Live Realized = gerçekleşen
 *   - Quantity  : projected = project-line tons · realized = invoiced tons
 *   - Revenue   : projected = est. sales (FX USD) · realized = salesActualUsd
 *   - P&L       : sales − purchase − expense (est vs realized)
 *   - Budget    : segment×month budgeted net P&L (distinct segments,
 *                 counted once) — shared by every month row
 *   - P&L→Budget%: realized P&L ÷ budget
 *
 * Realized P&L needs the expense rollup; until it covers the set
 * (`hasRealizedCoverage`) realized columns read 0.
 */

const KNOWN = new Set(["USD", "EUR", "TRY", "RUB", "GBP"]);

export interface ProjectMetrics {
  projQtyTons: number;
  projRevenueUsd: number;
  projPLUsd: number;
  realQtyTons: number;
  realRevenueUsd: number;
  realPLUsd: number;
}

/** Per-project projected + realized figures — shared by the month
 *  rollup and the drill-down detail so they always reconcile. */
export function computeProjectMetrics(
  p: Project,
  realizedExpenseByProject: Map<string, number>
): ProjectMetrics {
  const pl = selectProjectPL(p);
  const cur = (pl.currency ?? "USD").toUpperCase();
  const fxDate = selectExecutionDate(p);
  const toUsd = (v: number) => (KNOWN.has(cur) ? toUsdAtDate(v, cur, fxDate) : v);

  const projRevenueUsd = toUsd(pl.salesTotal);
  const estPurchaseUsd = toUsd(pl.purchaseTotal);
  const projPLUsd =
    pl.salesTotal > 0 || pl.purchaseTotal > 0
      ? projRevenueUsd - estPurchaseUsd - pl.expenseTotal
      : 0;

  const realRevenueUsd = p.salesActualUsd ?? 0;
  const realPurchaseUsd = p.purchaseActualUsd ?? 0;
  const realExpenseUsd = realizedExpenseByProject.get(p.projectNo) ?? 0;
  const realPLUsd = realRevenueUsd - realPurchaseUsd - realExpenseUsd;

  return {
    projQtyTons: selectTotalTons(p),
    projRevenueUsd,
    projPLUsd,
    realQtyTons: p.salesActualQtyTons ?? 0,
    realRevenueUsd,
    realPLUsd,
  };
}

export interface RealizedPLMonthRow {
  /** "YYYY-MM" or "TOTAL" for the footer. */
  monthKey: string;
  /** "Tem-25" style label, or the localized "Toplam". */
  monthLabel: string;
  projQtyTons: number;
  projRevenueUsd: number;
  projPLUsd: number;
  budgetUsd: number;
  realQtyTons: number;
  realRevenueUsd: number;
  realPLUsd: number;
  plToBudgetPct: number | null;
  isFuture: boolean;
  /** Projects bucketed into this month (for the drill-down). */
  projectCount: number;
}

export interface RealizedPLTableData {
  rows: RealizedPLMonthRow[];
  total: RealizedPLMonthRow;
}

const MONTH_FMT = new Intl.DateTimeFormat("tr-TR", { month: "short" });
function fyMonthLabel(d: Date): string {
  return `${MONTH_FMT.format(d)}-${String(d.getFullYear()).slice(-2)}`;
}
function monthKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function buildRealizedPLTable(
  projects: Project[],
  realizedExpenseByProject: Map<string, number>,
  budgetMap: Map<string, Map<string, number>>,
  now: Date = new Date(),
  fy: FinancialYear = getFinancialYear(now),
  totalLabel = "Toplam"
): RealizedPLTableData {
  const nowKey = monthKeyOf(now);
  // Distinct segments across the WHOLE filtered set drive the budget —
  // a segment's monthly budget is counted once regardless of how many
  // filtered projects share it.
  const segments = new Set<string>();
  for (const p of projects) {
    const s = (p.segment ?? "").trim();
    if (s) segments.add(s);
  }

  const rows: RealizedPLMonthRow[] = [];
  const indexByKey = new Map<string, number>();
  for (let i = 0; i < 12; i++) {
    const d = new Date(fy.startYear, 6 + i, 1);
    const monthKey = monthKeyOf(d);
    indexByKey.set(monthKey, i);
    rows.push({
      monthKey,
      monthLabel: fyMonthLabel(d),
      projQtyTons: 0,
      projRevenueUsd: 0,
      projPLUsd: 0,
      budgetUsd: budgetForMonth(budgetMap, segments, monthKey),
      realQtyTons: 0,
      realRevenueUsd: 0,
      realPLUsd: 0,
      plToBudgetPct: null,
      isFuture: monthKey > nowKey,
      projectCount: 0,
    });
  }

  for (const p of projects) {
    const exec = new Date(selectExecutionDate(p));
    if (Number.isNaN(exec.getTime())) continue;
    const idx = indexByKey.get(monthKeyOf(exec));
    if (idx === undefined) continue;
    const m = computeProjectMetrics(p, realizedExpenseByProject);
    const row = rows[idx];
    row.projQtyTons += m.projQtyTons;
    row.projRevenueUsd += m.projRevenueUsd;
    row.projPLUsd += m.projPLUsd;
    row.realQtyTons += m.realQtyTons;
    row.realRevenueUsd += m.realRevenueUsd;
    row.realPLUsd += m.realPLUsd;
    row.projectCount += 1;
  }

  for (const row of rows) {
    row.plToBudgetPct =
      row.budgetUsd !== 0 ? (row.realPLUsd / row.budgetUsd) * 100 : null;
  }

  const total: RealizedPLMonthRow = {
    monthKey: "TOTAL",
    monthLabel: totalLabel,
    projQtyTons: sum(rows, "projQtyTons"),
    projRevenueUsd: sum(rows, "projRevenueUsd"),
    projPLUsd: sum(rows, "projPLUsd"),
    budgetUsd: sum(rows, "budgetUsd"),
    realQtyTons: sum(rows, "realQtyTons"),
    realRevenueUsd: sum(rows, "realRevenueUsd"),
    realPLUsd: sum(rows, "realPLUsd"),
    plToBudgetPct: null,
    isFuture: false,
    projectCount: sum(rows, "projectCount"),
  };
  total.plToBudgetPct =
    total.budgetUsd !== 0 ? (total.realPLUsd / total.budgetUsd) * 100 : null;

  return { rows, total };
}

function sum(rows: RealizedPLMonthRow[], key: keyof RealizedPLMonthRow): number {
  let s = 0;
  for (const r of rows) s += Number(r[key]) || 0;
  return s;
}

/* ─────────── Drill-down detail (one month) ─────────── */

export interface RealizedPLProjectRow {
  projectNo: string;
  projectName: string;
  vesselName?: string;
  segment?: string;
  qtyTons: number;
  revenueUsd: number;
  plUsd: number;
  /** Projected rows carry the month budget; realized rows mirror P&L
   *  (matches the Power BI "Budget" measure on each side). */
  budgetUsd: number;
}

export interface RealizedPLMonthDetail {
  monthKey: string;
  monthLabel: string;
  monthBudgetUsd: number;
  projected: RealizedPLProjectRow[];
  realized: RealizedPLProjectRow[];
}

/**
 * Build the two per-project tables for a single month's drill-down.
 * `monthBudgetUsd` is the shared month budget (segment-level); each
 * projected row repeats it (BI behaviour), each realized row shows its
 * own realized P&L in the "Budget" slot.
 */
export function buildMonthDetail(
  projects: Project[],
  monthKey: string,
  monthLabel: string,
  realizedExpenseByProject: Map<string, number>,
  budgetMap: Map<string, Map<string, number>>
): RealizedPLMonthDetail {
  const segments = new Set<string>();
  for (const p of projects) {
    const s = (p.segment ?? "").trim();
    if (s) segments.add(s);
  }
  const monthBudgetUsd = budgetForMonth(budgetMap, segments, monthKey);

  const inMonth = projects.filter((p) => {
    const exec = new Date(selectExecutionDate(p));
    return !Number.isNaN(exec.getTime()) && monthKeyOf(exec) === monthKey;
  });

  const projected: RealizedPLProjectRow[] = [];
  const realized: RealizedPLProjectRow[] = [];
  for (const p of inMonth) {
    const m = computeProjectMetrics(p, realizedExpenseByProject);
    const base = {
      projectNo: p.projectNo,
      projectName: p.projectName,
      vesselName: p.vesselPlan?.vesselName,
      segment: p.segment ?? undefined,
    };
    projected.push({
      ...base,
      qtyTons: m.projQtyTons,
      revenueUsd: m.projRevenueUsd,
      plUsd: m.projPLUsd,
      budgetUsd: monthBudgetUsd,
    });
    realized.push({
      ...base,
      qtyTons: m.realQtyTons,
      revenueUsd: m.realRevenueUsd,
      plUsd: m.realPLUsd,
      budgetUsd: m.realPLUsd,
    });
  }
  // Biggest projected P&L first, mirrored ordering on both tables.
  projected.sort((a, b) => b.plUsd - a.plUsd);
  const order = new Map(projected.map((r, i) => [r.projectNo, i]));
  realized.sort(
    (a, b) => (order.get(a.projectNo) ?? 0) - (order.get(b.projectNo) ?? 0)
  );

  return { monthKey, monthLabel, monthBudgetUsd, projected, realized };
}
