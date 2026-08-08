import type { Project } from "@/freight/lib/dataverse/entities";
import {
  selectActualBooked,
  selectCargoValueUsd,
  selectEstimateTotal,
  selectExecutionDate,
  selectStage,
  selectTotalKg,
  selectTransitDays,
  type RouteStage,
} from "./project";
import { selectProjectPL } from "./profitLoss";
import { toUsdAtDate } from "@/freight/lib/finance/fxRates";

/**
 * Cross-project aggregations — pure, memoizable, reusable.
 *
 * These power the Dashboard bento tiles (ActivePipeline, TonnageInTransit,
 * CargoValue, BudgetPulse) and the future Data Inspector rollups.
 */

/* ─────────── Stage distribution ─────────── */

export type StageCounts = Record<RouteStage, number> & {
  /** Projects with no vesselPlan at all */
  unscheduled: number;
};

export function aggregateByStage(
  projects: Project[],
  now: Date = new Date()
): StageCounts {
  const counts: StageCounts = {
    "pre-loading": 0,
    "at-loading-port": 0,
    loading: 0,
    "in-transit": 0,
    "at-discharge-port": 0,
    discharged: 0,
    unscheduled: 0,
  };
  for (const p of projects) {
    const stage = selectStage(p, now);
    if (stage === null) counts.unscheduled++;
    else counts[stage]++;
  }
  return counts;
}

/** Bento tile-friendly grouping: loading | in-transit | at-discharge. */
export function aggregatePipelineBuckets(
  projects: Project[],
  now: Date = new Date()
): { loading: number; inTransit: number; atDischarge: number } {
  const c = aggregateByStage(projects, now);
  return {
    loading: c.loading + c["at-loading-port"],
    inTransit: c["in-transit"],
    atDischarge: c["at-discharge-port"],
  };
}

/* ─────────── In-transit tonnage ─────────── */

const IN_TRANSIT_STAGES = new Set<RouteStage>([
  "loading",
  "at-loading-port",
  "in-transit",
  "at-discharge-port",
]);

/** Sum of `lines.quantityKg` for projects whose vessels are actively moving. */
export function aggregateInTransitKg(
  projects: Project[],
  now: Date = new Date()
): { kg: number; projectCount: number } {
  let kg = 0;
  let projectCount = 0;
  for (const p of projects) {
    const stage = selectStage(p, now);
    if (stage && IN_TRANSIT_STAGES.has(stage)) {
      kg += selectTotalKg(p);
      projectCount++;
    }
  }
  return { kg, projectCount };
}

/* ─────────── Cargo value ─────────── */

/** Total cargo value (USD) across all given projects. */
export function aggregateCargoValueUsd(projects: Project[]): number {
  return projects.reduce((sum, p) => sum + selectCargoValueUsd(p), 0);
}

/* ─────────── Budget ─────────── */

export interface BudgetAggregate {
  estimate: number;
  actual: number;
  variance: number;
  variancePct: number;
  /** Projects that have BOTH costEstimate AND actualCost — used to scope */
  contributingCount: number;
}

export function aggregateBudget(projects: Project[]): BudgetAggregate {
  let estimate = 0;
  let actual = 0;
  let contributingCount = 0;
  for (const p of projects) {
    if (p.costEstimate || p.actualCost) {
      estimate += selectEstimateTotal(p);
      actual += selectActualBooked(p);
      contributingCount++;
    }
  }
  const variance = estimate - actual;
  const variancePct = estimate > 0 ? (variance / estimate) * 100 : 0;
  return { estimate, actual, variance, variancePct, contributingCount };
}

/* ─────────── Top by cargo value ─────────── */

/** Top N projects by cargo value (descending). */
export function topByCargoValue<T extends Project>(
  projects: T[],
  n: number
): Array<T & { cargoValueUsd: number }> {
  return projects
    .map((p) => ({ ...p, cargoValueUsd: selectCargoValueUsd(p) }))
    .sort((a, b) => b.cargoValueUsd - a.cargoValueUsd)
    .slice(0, n);
}

/* ─────────── Route corridor ─────────── */

export interface CorridorRow {
  loadingPort: string;
  dischargePort: string;
  count: number;
  totalCargoValueUsd: number;
}

/** Group projects by `loadingPort.name → dischargePort.name`. */
export function aggregateByCorridor(projects: Project[]): CorridorRow[] {
  const map = new Map<string, CorridorRow>();
  for (const p of projects) {
    const lp = p.vesselPlan?.loadingPort.name;
    const dp = p.vesselPlan?.dischargePort.name;
    if (!lp || !dp) continue;
    const key = `${lp}__${dp}`;
    const existing = map.get(key);
    if (existing) {
      existing.count++;
      existing.totalCargoValueUsd += selectCargoValueUsd(p);
    } else {
      map.set(key, {
        loadingPort: lp,
        dischargePort: dp,
        count: 1,
        totalCargoValueUsd: selectCargoValueUsd(p),
      });
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

/* ─────────── Estimated P&L (cross-project) ─────────── */

export interface EstimatedPLAggregate {
  /** USD-denominated rollup — non-USD currencies converted via the
   *  static FX table in `lib/finance/fxRates`. */
  salesTotalUsd: number;
  purchaseTotalUsd: number;
  expenseTotalUsd: number;
  pl: number;
  marginPct: number;
  /** Projects that contributed (have priced lines on either side). */
  contributingCount: number;
  /** Projects whose currency was FX-converted (i.e. not USD). */
  fxConvertedCount: number;
  /** Projects with a currency we don't have an FX rate for — passed
   *  through as-is. UI can warn when this is non-zero. */
  unknownCurrencyCount: number;
}

/**
 * Roll up estimated P&L across projects. EUR / TRY / RUB / GBP figures
 * are FX-converted to USD using the *historical monthly rate* keyed on
 * each project's `projectDate` — so a 2022-09 EUR project converts at
 * that month's rate (≈0.99), not today's. The K&Z and Gider tiles share
 * this scope so they reconcile to the cent.
 */
export function aggregateEstimatedPL(projects: Project[]): EstimatedPLAggregate {
  let salesTotalUsd = 0;
  let purchaseTotalUsd = 0;
  let expenseTotalUsd = 0;
  let contributingCount = 0;
  let fxConvertedCount = 0;
  let unknownCurrencyCount = 0;
  const KNOWN = new Set(["USD", "EUR", "TRY", "RUB", "GBP"]);
  for (const p of projects) {
    const pl = selectProjectPL(p);
    if (pl.salesTotal <= 0 && pl.purchaseTotal <= 0) continue;
    const cur = (pl.currency ?? "USD").toUpperCase();
    // FX-convert at the project's execution date when set, else
    // fall back to the signing date — same precedence the FY filter
    // and other date-keyed dashboard math now use.
    const fxDate = selectExecutionDate(p);
    salesTotalUsd += toUsdAtDate(pl.salesTotal, cur, fxDate);
    purchaseTotalUsd += toUsdAtDate(pl.purchaseTotal, cur, fxDate);
    // Expense lines are always denoted in USD per the entity model
    // (`mserp_expamountusdd`), so no conversion needed.
    expenseTotalUsd += pl.expenseTotal;
    contributingCount++;
    if (cur !== "USD") fxConvertedCount++;
    if (!KNOWN.has(cur)) unknownCurrencyCount++;
  }
  const pl = salesTotalUsd - purchaseTotalUsd - expenseTotalUsd;
  const marginPct = salesTotalUsd > 0 ? (pl / salesTotalUsd) * 100 : 0;
  return {
    salesTotalUsd,
    purchaseTotalUsd,
    expenseTotalUsd,
    pl,
    marginPct,
    contributingCount,
    fxConvertedCount,
    unknownCurrencyCount,
  };
}

/* ─────────── Margin distribution ─────────── */

export interface MarginBuckets {
  /** marginPct > 5% — healthy */
  positive: number;
  /** -5% ≤ marginPct ≤ 5% — borderline */
  marginal: number;
  /** marginPct < -5% — at-risk / loss */
  negative: number;
  /** No margin reference (salesTotal ≤ 0) */
  unknown: number;
}

export function aggregateMarginDistribution(projects: Project[]): MarginBuckets {
  const out: MarginBuckets = {
    positive: 0,
    marginal: 0,
    negative: 0,
    unknown: 0,
  };
  for (const p of projects) {
    const pl = selectProjectPL(p);
    if (pl.marginPct == null) {
      out.unknown++;
      continue;
    }
    if (pl.marginPct > 5) out.positive++;
    else if (pl.marginPct >= -5) out.marginal++;
    else out.negative++;
  }
  return out;
}

/* ─────────── Currency exposure ─────────── */

export type CurrencyCode = "USD" | "EUR" | "TRY" | "OTHER";

export interface CurrencyBreakdown {
  /** Project count in this currency */
  count: number;
  /** Sum of cargo value in the native currency (NOT FX-converted) */
  totalNative: number;
}

export interface CurrencyExposure {
  byCurrency: Record<CurrencyCode, CurrencyBreakdown>;
  /** Currency with the most projects */
  dominant: CurrencyCode;
  /** Concentration index — Σ(share²); 1 = single currency, 1/n = perfect mix */
  hhi: number;
  totalProjects: number;
}

export function aggregateCurrencyExposure(projects: Project[]): CurrencyExposure {
  const byCurrency: Record<CurrencyCode, CurrencyBreakdown> = {
    USD: { count: 0, totalNative: 0 },
    EUR: { count: 0, totalNative: 0 },
    TRY: { count: 0, totalNative: 0 },
    OTHER: { count: 0, totalNative: 0 },
  };
  for (const p of projects) {
    const c = (p.lines[0]?.currency ?? p.currency ?? "OTHER") as string;
    const key: CurrencyCode =
      c === "USD" || c === "EUR" || c === "TRY" ? c : "OTHER";
    byCurrency[key].count++;
    // Native-currency sum: lines × unitPrice
    let total = 0;
    for (const l of p.lines) {
      if (l.unitPrice > 0 && l.quantityKg > 0) {
        total += (l.quantityKg / 1000) * l.unitPrice;
      }
    }
    byCurrency[key].totalNative += total;
  }
  const totalProjects = projects.length;
  let hhi = 0;
  let dominant: CurrencyCode = "USD";
  let dominantCount = -1;
  for (const k of ["USD", "EUR", "TRY", "OTHER"] as CurrencyCode[]) {
    const cnt = byCurrency[k].count;
    if (totalProjects > 0) {
      const share = cnt / totalProjects;
      hhi += share * share;
    }
    if (cnt > dominantCount) {
      dominantCount = cnt;
      dominant = k;
    }
  }
  return { byCurrency, dominant, hhi, totalProjects };
}

/* ─────────── Velocity (transit days) ─────────── */

export interface VelocityStats {
  avgDays: number;
  minDays: number;
  maxDays: number;
  /** Projects that contributed (have both endpoints). */
  sampleSize: number;
}

/**
 * Average transit time, in days. Each per-project value comes from
 * `selectTransitDays(p)` (LP-ED → DP NOR Accepted, strict endpoints,
 * `Math.round`) — the *exact* formula the Vessel Projects map header
 * pill displays for a single project.
 *
 * That alignment is deliberate: the dashboard's "Min / Max / Avg gün"
 * line must equal the shortest / longest / average per-project transit
 * a user sees when they click into the project page. Projects missing
 * `lpEd` or `dpNorAccepted` are skipped (no fallback).
 */
export function aggregateAvgTransitDays(projects: Project[]): VelocityStats {
  const days: number[] = [];
  for (const p of projects) {
    const d = selectTransitDays(p);
    if (d != null) days.push(d);
  }
  if (days.length === 0)
    return { avgDays: 0, minDays: 0, maxDays: 0, sampleSize: 0 };
  const sum = days.reduce((a, b) => a + b, 0);
  let min = days[0];
  let max = days[0];
  for (const d of days) {
    if (d < min) min = d;
    if (d > max) max = d;
  }
  return {
    avgDays: Math.round(sum / days.length),
    minDays: min,
    maxDays: max,
    sampleSize: days.length,
  };
}

/* ─────────── Counterparty mix ─────────── */

export interface CounterpartyRow {
  name: string;
  role: "supplier" | "buyer";
  count: number;
  totalCargoValueUsd: number;
}

export interface CounterpartyMix {
  suppliers: CounterpartyRow[];
  buyers: CounterpartyRow[];
  /** Concentration index: Σ(share²) of supplier counts. Higher = riskier. */
  supplierHHI: number;
  /** Concentration index: Σ(share²) of buyer counts. Higher = riskier. */
  buyerHHI: number;
}

function buildCounterpartyTable(
  projects: Project[],
  pickName: (p: Project) => string | undefined,
  role: "supplier" | "buyer"
): { rows: CounterpartyRow[]; hhi: number } {
  const map = new Map<string, CounterpartyRow>();
  let total = 0;
  for (const p of projects) {
    const name = (pickName(p) ?? "").trim();
    if (!name) continue;
    total++;
    const existing = map.get(name);
    const cv = selectCargoValueUsd(p);
    if (existing) {
      existing.count++;
      existing.totalCargoValueUsd += cv;
    } else {
      map.set(name, { name, role, count: 1, totalCargoValueUsd: cv });
    }
  }
  let hhi = 0;
  if (total > 0) {
    for (const r of map.values()) {
      const share = r.count / total;
      hhi += share * share;
    }
  }
  return {
    rows: [...map.values()].sort((a, b) => b.count - a.count),
    hhi,
  };
}

export function aggregateCounterpartyMix(projects: Project[]): CounterpartyMix {
  const sup = buildCounterpartyTable(
    projects,
    (p) => p.vesselPlan?.supplier,
    "supplier"
  );
  const buy = buildCounterpartyTable(
    projects,
    (p) => p.vesselPlan?.buyer,
    "buyer"
  );
  return {
    suppliers: sup.rows,
    buyers: buy.rows,
    supplierHHI: sup.hhi,
    buyerHHI: buy.hhi,
  };
}

/* ─────────── Top-N by various metrics ─────────── */

/** Top N by `salesActualUsd` (realised invoiced sales). */
export function topBySalesActual<T extends Project>(
  projects: T[],
  n: number
): Array<T & { salesActualUsd: number }> {
  return projects
    .map((p) => ({ ...p, salesActualUsd: p.salesActualUsd ?? 0 }))
    .filter((r) => r.salesActualUsd > 0)
    .sort((a, b) => b.salesActualUsd - a.salesActualUsd)
    .slice(0, n);
}

/** Top N by estimated total expense (highest cost = "El Yakan"). */
export function topByExpense<T extends Project>(
  projects: T[],
  n: number
): Array<T & { expenseTotalUsd: number }> {
  return projects
    .map((p) => ({ ...p, expenseTotalUsd: selectEstimateTotal(p) }))
    .filter((r) => r.expenseTotalUsd > 0)
    .sort((a, b) => b.expenseTotalUsd - a.expenseTotalUsd)
    .slice(0, n);
}

/** Top N by P&L margin %. `dir="asc"` = lowest (worst) first; "desc" = highest. */
export function topByMargin<T extends Project>(
  projects: T[],
  n: number,
  dir: "asc" | "desc"
): Array<T & { marginPct: number; pl: number; salesTotal: number }> {
  const enriched = projects
    .map((p) => {
      const pl = selectProjectPL(p);
      return { ...p, marginPct: pl.marginPct ?? 0, pl: pl.pl, salesTotal: pl.salesTotal };
    })
    // Need a sales reference for margin to be meaningful
    .filter((r) => r.salesTotal > 0);
  enriched.sort((a, b) =>
    dir === "asc" ? a.marginPct - b.marginPct : b.marginPct - a.marginPct
  );
  return enriched.slice(0, n);
}

/* ─────────── Segment rollups ─────────── */

export interface SegmentRollup {
  segment: string;
  projectCount: number;
  /** Realised invoiced sales (sum of `salesActualUsd`). */
  salesActualUsd: number;
  /** USD-equivalent estimated sales (FX-converted). */
  salesEstimateUsd: number;
  /** USD-equivalent estimated purchase (FX-converted). */
  purchaseEstimateUsd: number;
  /** Estimated expense — already USD per F&O entity model. */
  expenseEstimateUsd: number;
  /** Net P&L = salesEstimate − purchaseEstimate − expenseEstimate. */
  pl: number;
  /** Margin % = pl / salesEstimate × 100. Null when sales is zero. */
  marginPct: number | null;
}

/**
 * Group projects by `segment` field and roll up the same metrics the
 * project-level leaderboard ranks on. Projects with no segment are
 * bucketed under "Tanımsız". The rollup uses `selectProjectPL` so
 * EUR/TRY/RUB/GBP get FX-converted via the dated rate table (each
 * project at its own `projectDate`), matching the K&Z and Gider tile
 * scopes.
 */
export function aggregateBySegment(projects: Project[]): SegmentRollup[] {
  const map = new Map<string, SegmentRollup>();
  for (const p of projects) {
    const key = (p.segment ?? "").trim() || "Tanımsız";
    const pl = selectProjectPL(p);
    const cur = (pl.currency ?? "USD").toUpperCase();
    const fxDate = selectExecutionDate(p);
    const salesUsd = toUsdAtDate(pl.salesTotal, cur, fxDate);
    const purchaseUsd = toUsdAtDate(pl.purchaseTotal, cur, fxDate);
    const expenseUsd = pl.expenseTotal;
    const salesActualUsd = p.salesActualUsd ?? 0;
    const existing = map.get(key);
    if (existing) {
      existing.projectCount++;
      existing.salesActualUsd += salesActualUsd;
      existing.salesEstimateUsd += salesUsd;
      existing.purchaseEstimateUsd += purchaseUsd;
      existing.expenseEstimateUsd += expenseUsd;
    } else {
      map.set(key, {
        segment: key,
        projectCount: 1,
        salesActualUsd,
        salesEstimateUsd: salesUsd,
        purchaseEstimateUsd: purchaseUsd,
        expenseEstimateUsd: expenseUsd,
        pl: 0,
        marginPct: null,
      });
    }
  }
  // Compute pl / marginPct after all sums are known
  const out: SegmentRollup[] = [];
  for (const r of map.values()) {
    r.pl = r.salesEstimateUsd - r.purchaseEstimateUsd - r.expenseEstimateUsd;
    r.marginPct = r.salesEstimateUsd > 0 ? (r.pl / r.salesEstimateUsd) * 100 : null;
    out.push(r);
  }
  return out;
}
