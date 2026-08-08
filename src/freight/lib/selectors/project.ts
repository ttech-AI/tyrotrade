import type { Project, ProjectFull } from "@/freight/lib/dataverse/entities";
import { describeProgress } from "@/freight/lib/routing/progress";

/**
 * Pure single-project selector functions.
 *
 * These replace inline `reduce()` calls scattered across Dashboard tiles and
 * detail panels. Pure → memoizable, testable, reusable across UI surfaces
 * (Dashboard tiles + Data Inspector rollups + future selectors layered on
 * top).
 *
 * Read-only — selectors never mutate `Project`. They only derive numbers.
 */

/* ─────────── Execution date ─────────── */

/**
 * Primary date for FY filtering, period bucketing, and per-row FX
 * conversion. Prefers the F&O `mserp_executionperiod` (Operasyon
 * Periyodu) when set — that's when the project actually executes,
 * which matches accounting expectations better than the signing
 * date (`mserp_contractdate`) for projects that span fiscal years.
 *
 * Falls back to `projectDate` for legacy rows (and projects whose
 * F&O record predates the executionperiod column being added).
 *
 * Returns the ISO `"YYYY-MM-DD"` string, or `""` when neither date
 * is set — keeps callers simple (`new Date(value)` → invalid date,
 * filter helpers skip invalid via `Number.isFinite`).
 */
export function selectExecutionDate(
  p: Pick<Project, "operationPeriod" | "projectDate">
): string {
  return p.operationPeriod || p.projectDate || "";
}

/* ─────────── Ship plan validity ─────────── */

/**
 * True only when a project has a fully-usable vessel plan:
 *  - `vesselPlan` row defined (matched ship-relation row in Dataverse)
 *  - non-placeholder vessel name (raw composer fallback "—" rejected)
 *  - both ports resolved to real coordinates (lat/lon ≠ 0)
 *
 * Used as the default visibility filter for Projects/Dashboard/CommandPalette
 * so old project headers (no ship row) and incomplete records (vessel TBA,
 * port not yet resolved) don't pollute lists or skew aggregates.
 */
export function hasUsableShipPlan(p: Pick<Project, "vesselPlan">): boolean {
  const vp = p.vesselPlan;
  if (!vp) return false;
  const name = (vp.vesselName ?? "").trim();
  if (!name || name === "—") return false;
  const lp = vp.loadingPort;
  const dp = vp.dischargePort;
  if (!lp || !dp) return false;
  if (lp.lat === 0 && lp.lon === 0) return false;
  if (dp.lat === 0 && dp.lon === 0) return false;
  return true;
}

/* ─────────── Tonnage / quantity ─────────── */

/** Sum of all line quantities in kg. */
export function selectTotalKg(p: Pick<Project, "lines">): number {
  return p.lines.reduce((sum, l) => sum + l.quantityKg, 0);
}

/** Sum of all line quantities in tons (kg / 1000). */
export function selectTotalTons(p: Pick<Project, "lines">): number {
  return selectTotalKg(p) / 1000;
}

/* ─────────── Cargo value ─────────── */

/**
 * Cargo value in USD. Prefers `vesselPlan.cargoValueUsd` when present;
 * falls back to summing lines (`quantityKg / 1000 * unitPrice`).
 *
 * Note: line-level fallback assumes `unitPrice` is per-ton. When the line's
 * currency differs from USD this may be inaccurate — but vesselPlan.cargoValueUsd
 * is the authoritative source from D365 F&O once available.
 */
export function selectCargoValueUsd(p: Pick<Project, "vesselPlan" | "lines">): number {
  if (p.vesselPlan?.cargoValueUsd) return p.vesselPlan.cargoValueUsd;
  return p.lines.reduce(
    (sum, l) => sum + (l.quantityKg / 1000) * l.unitPrice,
    0
  );
}

/* ─────────── Budget ─────────── */

export function selectEstimateTotal(p: Pick<Project, "costEstimate">): number {
  return p.costEstimate?.totalUsd ?? 0;
}

export function selectActualBooked(p: Pick<Project, "actualCost">): number {
  return p.actualCost?.bookedUsd ?? 0;
}

/** Variance = estimate − actual booked. Positive = under budget. */
export function selectVariance(
  p: Pick<Project, "costEstimate" | "actualCost">
): number {
  return selectEstimateTotal(p) - selectActualBooked(p);
}

/** Variance as a percentage of estimate. Returns 0 if estimate is 0. */
export function selectVariancePct(
  p: Pick<Project, "costEstimate" | "actualCost">
): number {
  const est = selectEstimateTotal(p);
  if (est <= 0) return 0;
  return (selectVariance(p) / est) * 100;
}

/** Booked / estimate ratio in [0..1]. Useful for progress bars. */
export function selectBudgetUseRatio(
  p: Pick<Project, "costEstimate" | "actualCost">
): number {
  const est = selectEstimateTotal(p);
  if (est <= 0) return 0;
  return Math.min(1, selectActualBooked(p) / est);
}

/* ─────────── Stage / progress ─────────── */

export type RouteStage =
  | "pre-loading"
  | "at-loading-port"
  | "loading"
  | "in-transit"
  | "at-discharge-port"
  | "discharged";

/** Wraps `describeProgress` for projects that may lack a vesselPlan. */
export function selectStage(
  p: Pick<Project, "vesselPlan">,
  now: Date = new Date()
): RouteStage | null {
  const vp = p.vesselPlan;
  if (!vp) return null;
  return describeProgress(vp.milestones, vp.vesselStatus, now).stage;
}

/** Numeric progress (0..1) along the route. `null` if no vesselPlan. */
export function selectProgress(
  p: Pick<Project, "vesselPlan">,
  now: Date = new Date()
): number | null {
  const vp = p.vesselPlan;
  if (!vp) return null;
  return describeProgress(vp.milestones, vp.vesselStatus, now).progress;
}

/* ─────────── Route summary ─────────── */

export interface RouteSummary {
  loadingPortName: string;
  dischargePortName: string;
  vesselName?: string;
}

export function selectRoute(p: Pick<ProjectFull, "vesselPlan">): RouteSummary | null {
  const vp = p.vesselPlan;
  if (!vp) return null;
  return {
    loadingPortName: vp.loadingPort.name,
    dischargePortName: vp.dischargePort.name,
    vesselName: vp.vesselName,
  };
}

/* ─────────── Days to next milestone ─────────── */

/**
 * Days until DP-ETA (negative if already passed). Returns `null` if
 * vesselPlan or dpEta is missing.
 */
export function selectDaysToDischargeEta(
  p: Pick<Project, "vesselPlan">,
  now: Date = new Date()
): number | null {
  const dpEta = p.vesselPlan?.milestones.dpEta;
  if (!dpEta) return null;
  const eta = new Date(dpEta);
  return Math.ceil((eta.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/* ─────────── Transit days ─────────── */

/**
 * Per-project transit days — **Yükleme bitişi (LP-ED) → DP NOR Kabul
 * (dpNorAccepted)**. Returns rounded integer days, or `null` when
 * either endpoint is missing or the interval is non-positive.
 *
 * **Single source of truth** — this is the *exact* formula the Vessel
 * Projects map header's "Transit" pill uses (see `RouteMap.tsx`'s
 * `transitDays`). Both the dashboard's Velocity tile aggregate AND the
 * detail drawer rows go through here so the tile's `Min / Max / Avg`
 * line up bit-for-bit with the per-project number a user sees when
 * they click into the project page.
 *
 * Strict endpoints (no fallback) — when DP NOR Accepted is missing the
 * project is intentionally excluded from the transit aggregate. Use
 * `selectOperationDays` (when added) for a looser fallback chain that
 * surfaces every project including ones still in transit.
 */
export function selectTransitDays(
  p: Pick<Project, "vesselPlan">
): number | null {
  const ms = p.vesselPlan?.milestones;
  if (!ms?.lpEd || !ms.dpNorAccepted) return null;
  const start = new Date(ms.lpEd).getTime();
  const end = new Date(ms.dpNorAccepted).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start)
    return null;
  return Math.round((end - start) / 86_400_000);
}
