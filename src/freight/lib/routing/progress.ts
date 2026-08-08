import type { VesselMilestones, VesselStatus } from "@/freight/lib/dataverse/entities";

/**
 * Calculate vessel progress along the route as a fraction 0..1.
 *
 * Stages (in order):
 *   0.00 — pre-loading (before lpEta)
 *   0.05 — at loading port awaiting NOR (lpEta passed, lpNorAccepted not)
 *   0.08 — loading in progress (lpSd → lpEd)
 *   0.10 — loaded, BL not yet issued
 *   0.10 → 0.95 — in transit (interpolate by date between blDate/lpEd and dpEta)
 *   0.95 — at discharge port awaiting NOR
 *   1.00 — discharged (dpNorAccepted set or vesselStatus 'Completed' AND dpEta passed)
 */
export function computeRouteProgress(
  ms: VesselMilestones,
  vesselStatus: VesselStatus | undefined,
  now: Date = new Date()
): number {
  const t = (iso: string | null): number | null => {
    if (!iso) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  };

  const lpEta = t(ms.lpEta);
  const lpNor = t(ms.lpNorAccepted);
  const lpSd = t(ms.lpSd);
  const lpEd = t(ms.lpEd);
  const bl = t(ms.blDate);
  const dpEta = t(ms.dpEta);
  const dpNor = t(ms.dpNorAccepted);
  const N = now.getTime();

  // Voyage cancelled — leave at zero, no progress to render.
  if (vesselStatus === "Cancelled") return 0;
  // Pre-loading lifecycle states from F&O option-set.
  if (vesselStatus === "To Be Nominated" || vesselStatus === "Nominated")
    return 0;

  // Discharged — completed delivery
  if (dpNor && N >= dpNor) return 1;
  if (
    (vesselStatus === "Completed" || vesselStatus === "Closed") &&
    dpEta &&
    N >= dpEta
  )
    return 1;
  // No dpEta but voyage explicitly closed in F&O → treat as discharged.
  if (vesselStatus === "Closed") return 1;

  // At discharge port (between dpEta arrival and NOR acceptance)
  if (dpEta && N >= dpEta) return 0.95;

  // In transit — interpolate between departure (bl/lpEd) and dpEta
  const departureTs = bl ?? lpEd;
  if (departureTs && dpEta) {
    if (N <= departureTs) return 0.1;
    if (N >= dpEta) return 0.95;
    const span = dpEta - departureTs;
    const elapsed = N - departureTs;
    const transitFrac = elapsed / span;
    return 0.1 + transitFrac * 0.85;
  }
  // departure date set but no dpEta — assume in transit early
  if (departureTs && N >= departureTs) return 0.15;

  // Loading in progress
  if (lpSd && N >= lpSd && (!lpEd || N < lpEd)) return 0.08;
  if (lpEd && N >= lpEd) return 0.1;

  // NOR accepted, awaiting load start
  if (lpNor && N >= lpNor) return 0.06;

  // At loading port awaiting NOR
  if (lpEta && N >= lpEta) return 0.04;

  // Pre-loading
  return 0;
}

export interface RouteProgressInfo {
  progress: number;
  stage:
    | "pre-loading"
    | "at-loading-port"
    | "loading"
    | "in-transit"
    | "at-discharge-port"
    | "discharged";
}

export function describeProgress(
  ms: VesselMilestones,
  vesselStatus: VesselStatus | undefined,
  now: Date = new Date()
): RouteProgressInfo {
  const progress = computeRouteProgress(ms, vesselStatus, now);
  let stage: RouteProgressInfo["stage"];
  if (progress >= 1) stage = "discharged";
  else if (progress >= 0.95) stage = "at-discharge-port";
  else if (progress > 0.1) stage = "in-transit";
  else if (progress >= 0.08) stage = "loading";
  else if (progress >= 0.04) stage = "at-loading-port";
  else stage = "pre-loading";
  return { progress, stage };
}
