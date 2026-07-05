import type { Project } from "@/lib/dataverse/entities";
import { selectExecutionDate, selectTotalTons } from "./project";
import { selectProjectPL } from "./profitLoss";
import { toUsdAtDate } from "@/lib/finance/fxRates";
import {
  getFinancialYear,
  type FinancialYear,
} from "@/lib/dashboard/financialPeriod";
import { budgetForMonth } from "@/lib/dataverse/segmentBudget";
import type { RealizedByMonthMap } from "@/lib/dataverse/realizedByMonth";

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

/** Segments the budget should be summed over: the explicit segment
 *  filter when the user set one, otherwise EVERY segment the budget
 *  entity knows about (the full Emerging-Markets set). */
function budgetScopeSegments(
  budgetMap: Map<string, Map<string, number>>,
  scopeSegments?: Set<string>
): Set<string> {
  if (scopeSegments && scopeSegments.size > 0) return scopeSegments;
  return new Set(budgetMap.keys());
}

export function buildRealizedPLTable(
  projects: Project[],
  realizedExpenseByProject: Map<string, number>,
  budgetMap: Map<string, Map<string, number>>,
  now: Date = new Date(),
  fy: FinancialYear = getFinancialYear(now),
  totalLabel = "Toplam",
  /** Explicit segment selection from the page filter. When non-empty the
   *  budget sums only these segments; when empty it sums the FULL budget
   *  segment set (all Emerging-Markets segments). */
  scopeSegments?: Set<string>,
  /** Optional per-project × month realised (revenue/qty/purchase by
   *  INVOICE date). When present, the realised columns bucket by invoice
   *  month (the Power BI "Live Realized" axis) instead of the project's
   *  single execution month; realised expense is allocated across a
   *  project's revenue months proportional to that month's revenue.
   *  Absent (not yet fetched) → legacy execution-month bucketing. */
  realizedByMonth?: RealizedByMonthMap
): RealizedPLTableData {
  const nowKey = monthKeyOf(now);
  // "Project Budget" is a segment × month planned figure that exists
  // INDEPENDENTLY of whether a project runs that month/trader — exactly
  // like Power BI (which shows e.g. CBOT Hedge's 225,294 budget with zero
  // P&L / no project). So the budget scope is the segment DIMENSION, NOT
  // the filtered projects' segments: an explicit segment filter narrows
  // it, otherwise ALL budget segments are summed. (Tying it to project
  // segments dropped project-less segments like CBOT Hedge → 6,038,904
  // instead of the true 6,264,198.)
  const segments = budgetScopeSegments(budgetMap, scopeSegments);

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

  // When true, realised columns bucket by invoice month from the map;
  // projected always buckets by the project's execution month.
  const useMonthly = !!realizedByMonth && realizedByMonth.size > 0;
  // Distinct projects touching each month row (projected OR realised) —
  // drives the drill-down badge count.
  const rowProjects: Set<string>[] = rows.map(() => new Set<string>());

  for (const p of projects) {
    const exec = new Date(selectExecutionDate(p));
    const execIdx = Number.isNaN(exec.getTime())
      ? undefined
      : indexByKey.get(monthKeyOf(exec));
    const m = computeProjectMetrics(p, realizedExpenseByProject);

    // ── Projected (always by execution month) ──
    if (execIdx !== undefined) {
      const row = rows[execIdx];
      row.projQtyTons += m.projQtyTons;
      row.projRevenueUsd += m.projRevenueUsd;
      row.projPLUsd += m.projPLUsd;
      rowProjects[execIdx].add(p.projectNo);
    }

    // ── Realised ──
    if (useMonthly) {
      const byMonth = realizedByMonth!.get(p.projectNo);
      const expenseTotal = realizedExpenseByProject.get(p.projectNo) ?? 0;
      const totalRev = byMonth
        ? [...byMonth.values()].reduce((s, e) => s + e.revenueUsd, 0)
        : 0;
      let expenseBooked = false;
      if (byMonth && byMonth.size > 0) {
        for (const [mk, e] of byMonth) {
          const idx = indexByKey.get(mk);
          if (idx === undefined) continue; // invoice month outside this FY
          const row = rows[idx];
          // Allocate the project's realised expense across its revenue
          // months proportional to each month's revenue share.
          const expAlloc =
            totalRev > 0 ? expenseTotal * (e.revenueUsd / totalRev) : 0;
          if (expAlloc !== 0) expenseBooked = true;
          row.realQtyTons += e.qtyTons;
          row.realRevenueUsd += e.revenueUsd;
          row.realPLUsd += e.revenueUsd - e.purchaseUsd - expAlloc;
          rowProjects[idx].add(p.projectNo);
        }
      }
      // Expense-only / zero-revenue projects (expense booked but no
      // invoiced revenue in-FY to carry it) → keep the expense on the
      // execution month so realised P&L isn't silently inflated.
      if (!expenseBooked && expenseTotal !== 0 && execIdx !== undefined) {
        rows[execIdx].realPLUsd -= expenseTotal;
        rowProjects[execIdx].add(p.projectNo);
      }
    } else if (execIdx !== undefined) {
      // Legacy: whole-project realised in the execution month.
      const row = rows[execIdx];
      row.realQtyTons += m.realQtyTons;
      row.realRevenueUsd += m.realRevenueUsd;
      row.realPLUsd += m.realPLUsd;
    }
  }

  for (let i = 0; i < rows.length; i++) {
    rows[i].projectCount = rowProjects[i].size;
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
  budgetMap: Map<string, Map<string, number>>,
  scopeSegments?: Set<string>,
  /** Same map as `buildRealizedPLTable`. When present, the realised
   *  table lists projects INVOICED in this month (with that month's
   *  revenue/qty/purchase + revenue-share-allocated expense) instead of
   *  the projects whose execution month falls here. */
  realizedByMonth?: RealizedByMonthMap
): RealizedPLMonthDetail {
  // Projected side: projects whose EXECUTION month is the clicked month.
  const inMonth = projects.filter((p) => {
    const exec = new Date(selectExecutionDate(p));
    return !Number.isNaN(exec.getTime()) && monthKeyOf(exec) === monthKey;
  });

  // Budget MUST equal the clicked table row's "Project Budget" — same
  // segment scope as buildRealizedPLTable (all budget segments, or the
  // explicit segment filter). Jul-25 = 6,264,198.
  const monthBudgetUsd = budgetForMonth(
    budgetMap,
    budgetScopeSegments(budgetMap, scopeSegments),
    monthKey
  );

  const useMonthly = !!realizedByMonth && realizedByMonth.size > 0;
  const byNo = new Map(projects.map((p) => [p.projectNo, p]));
  const baseOf = (p: Project) => ({
    projectNo: p.projectNo,
    projectName: p.projectName,
    vesselName: p.vesselPlan?.vesselName,
    segment: p.segment ?? undefined,
  });

  const projected: RealizedPLProjectRow[] = [];
  for (const p of inMonth) {
    const m = computeProjectMetrics(p, realizedExpenseByProject);
    projected.push({
      ...baseOf(p),
      qtyTons: m.projQtyTons,
      revenueUsd: m.projRevenueUsd,
      plUsd: m.projPLUsd,
      budgetUsd: monthBudgetUsd,
    });
  }

  const realized: RealizedPLProjectRow[] = [];
  if (useMonthly) {
    // Projects with realised invoices in this month → one row each with
    // that month's slice (revenue/qty/purchase) and its share of expense.
    for (const [projectNo, byMonth] of realizedByMonth!) {
      const e = byMonth.get(monthKey);
      if (!e) continue;
      const p = byNo.get(projectNo);
      if (!p) continue; // out of the current filtered set
      const totalRev = [...byMonth.values()].reduce(
        (s, x) => s + x.revenueUsd,
        0
      );
      const expenseTotal = realizedExpenseByProject.get(projectNo) ?? 0;
      const expAlloc =
        totalRev > 0 ? expenseTotal * (e.revenueUsd / totalRev) : 0;
      const plUsd = e.revenueUsd - e.purchaseUsd - expAlloc;
      realized.push({
        ...baseOf(p),
        qtyTons: e.qtyTons,
        revenueUsd: e.revenueUsd,
        plUsd,
        budgetUsd: plUsd,
      });
    }
    realized.sort((a, b) => b.plUsd - a.plUsd);
  } else {
    for (const p of inMonth) {
      const m = computeProjectMetrics(p, realizedExpenseByProject);
      realized.push({
        ...baseOf(p),
        qtyTons: m.realQtyTons,
        revenueUsd: m.realRevenueUsd,
        plUsd: m.realPLUsd,
        budgetUsd: m.realPLUsd,
      });
    }
  }

  // Biggest projected P&L first.
  projected.sort((a, b) => b.plUsd - a.plUsd);
  if (!useMonthly) {
    // Legacy: mirror the projected ordering onto the realised list.
    const order = new Map(projected.map((r, i) => [r.projectNo, i]));
    realized.sort(
      (a, b) => (order.get(a.projectNo) ?? 0) - (order.get(b.projectNo) ?? 0)
    );
  }

  return { monthKey, monthLabel, monthBudgetUsd, projected, realized };
}
