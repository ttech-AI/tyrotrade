import * as React from "react";
import length from "@turf/length";
import along from "@turf/along";
import bbox from "@turf/bbox";
import type { Feature, LineString, Position } from "geojson";
import { buildSeaRoute } from "@/lib/routing/seaRoute";
import type { Project, Waypoint } from "@/lib/dataverse/entities";

export interface RouteGeometry {
  line: Feature<LineString>;
  totalKm: number;
  bbox: [number, number, number, number];
  positionAt: (progress: number) => Position;
}

/**
 * Compute and cache route geometry for a project.
 *
 * Two-stage strategy:
 *
 * 1. **Initial render** — synchronously build a fallback line from the
 *    corridor waypoints in `vesselPlan.waypoints` (computed by the composer
 *    via `selectCorridor`). The map shows immediately, no flicker.
 *
 * 2. **Background upgrade** — lazy-import `searoute-ts` on first call and
 *    compute the proper Dijkstra-shortest sea route over a maritime network
 *    graph. When it resolves, replace the line with the accurate one. The
 *    library bundles a ~few-MB graph so dynamic-import keeps it out of the
 *    initial chunk.
 *
 * Results are cached in a module-level Map keyed by the port-pair string
 * so switching between projects with the same loading/discharge ports is
 * instant after the first compute.
 */

type SeaRouteFn = (
  origin: Feature<{ type: "Point"; coordinates: Position }>,
  destination: Feature<{ type: "Point"; coordinates: Position }>,
  units?: "kilometers" | "miles" | "nauticalmiles" | "degrees" | "radians"
) => Feature<LineString>;

let searouteFn: SeaRouteFn | null = null;
let searouteLoadPromise: Promise<SeaRouteFn> | null = null;

async function loadSearoute(): Promise<SeaRouteFn> {
  if (searouteFn) return searouteFn;
  if (searouteLoadPromise) return searouteLoadPromise;
  searouteLoadPromise = import("searoute-ts").then((m) => {
    // Module export shape: `seaRoute` named export OR default export.
    // Cast through `unknown` because searoute-ts upstream types don't
    // line up with the runtime function signature (returns geojson
    // Feature, but its types claim something else).
    const mod = m as unknown as {
      seaRoute?: SeaRouteFn;
      default?: SeaRouteFn;
    };
    const fn = mod.seaRoute ?? mod.default;
    if (!fn) throw new Error("searoute-ts: seaRoute export not found");
    searouteFn = fn;
    return fn;
  });
  return searouteLoadPromise;
}

const lineCache: Map<string, Feature<LineString>> = new Map();

function makeKey(
  lpLon: number,
  lpLat: number,
  dpLon: number,
  dpLat: number,
  viaLon?: number,
  viaLat?: number
): string {
  const r = (n: number) => n.toFixed(4);
  const base = `${r(lpLon)},${r(lpLat)}|${r(dpLon)},${r(dpLat)}`;
  if (viaLon !== undefined && viaLat !== undefined) {
    return `${base}|via:${r(viaLon)},${r(viaLat)}`;
  }
  return base;
}

function makePoint(
  lon: number,
  lat: number
): Feature<{ type: "Point"; coordinates: Position }> {
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Point", coordinates: [lon, lat] },
  };
}

function deriveGeometry(line: Feature<LineString>): RouteGeometry {
  const totalKm = length(line, { units: "kilometers" });
  const bb = bbox(line) as [number, number, number, number];
  // Pad the bbox a bit for visual breathing room.
  const pad = 5;
  const padded: [number, number, number, number] = [
    bb[0] - pad,
    bb[1] - pad,
    bb[2] + pad,
    bb[3] + pad,
  ];
  return {
    line,
    totalKm,
    bbox: padded,
    positionAt: (progress: number): Position => {
      const clamped = Math.max(0, Math.min(1, progress));
      const km = totalKm * clamped;
      const pt = along(line, km, { units: "kilometers" });
      return pt.geometry.coordinates;
    },
  };
}

export function useRouteGeometry(
  project: Project | null,
  viaPoint?: { lon: number; lat: number } | null
): RouteGeometry | null {
  const lp = project?.vesselPlan?.loadingPort;
  const dp = project?.vesselPlan?.dischargePort;
  const waypoints = project?.vesselPlan?.waypoints;

  const portsValid =
    !!lp &&
    !!dp &&
    !(lp.lat === 0 && lp.lon === 0) &&
    !(dp.lat === 0 && dp.lon === 0);

  const cacheKey = portsValid
    ? makeKey(lp.lon, lp.lat, dp.lon, dp.lat, viaPoint?.lon, viaPoint?.lat)
    : null;

  // When AIS via-point is present, splice it into the corridor waypoints so
  // the fallback line passes through the live position even before
  // searoute-ts loads. Without this the first paint shows a static corridor
  // route that visibly misses the AIS marker.
  const initialWaypoints = React.useMemo(() => {
    if (!viaPoint) return waypoints;
    const via: Waypoint = { lon: viaPoint.lon, lat: viaPoint.lat, name: "AIS" };
    return [...(waypoints ?? []), via];
  }, [waypoints, viaPoint?.lon, viaPoint?.lat]);

  const [line, setLine] = React.useState<Feature<LineString> | null>(() => {
    if (!portsValid || !cacheKey) return null;
    const cached = lineCache.get(cacheKey);
    if (cached) return cached;
    return buildSeaRoute(lp, dp, initialWaypoints);
  });

  React.useEffect(() => {
    if (!portsValid || !cacheKey) {
      setLine(null);
      return;
    }
    const cached = lineCache.get(cacheKey);
    if (cached) {
      setLine(cached);
      return;
    }
    setLine(buildSeaRoute(lp, dp, initialWaypoints));

    let cancelled = false;
    loadSearoute()
      .then((seaRoute) => {
        if (cancelled) return;
        try {
          if (viaPoint) {
            // Two-segment route: LP → viaPoint → DP
            const seg1 = seaRoute(makePoint(lp.lon, lp.lat), makePoint(viaPoint.lon, viaPoint.lat), "kilometers");
            const seg2 = seaRoute(makePoint(viaPoint.lon, viaPoint.lat), makePoint(dp.lon, dp.lat), "kilometers");
            const c1 = seg1?.geometry?.coordinates;
            const c2 = seg2?.geometry?.coordinates;
            if (!c1?.length || !c2?.length) return;
            // Merge: drop the duplicate via-point at the junction
            const merged: Feature<LineString> = {
              type: "Feature",
              properties: {},
              geometry: { type: "LineString", coordinates: [...c1, ...c2.slice(1)] },
            };
            lineCache.set(cacheKey, merged);
            setLine(merged);
          } else {
            const route = seaRoute(makePoint(lp.lon, lp.lat), makePoint(dp.lon, dp.lat), "kilometers");
            const coords = route?.geometry?.coordinates;
            if (!coords || coords.length < 2) return;
            lineCache.set(cacheKey, route);
            setLine(route);
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn(`[useRouteGeometry] searoute-ts failed for ${cacheKey}, using corridor fallback:`, err);
        }
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.warn("[useRouteGeometry] searoute-ts module load failed:", err);
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  return React.useMemo(() => {
    if (!line) return null;
    return deriveGeometry(line);
  }, [line]);
}
