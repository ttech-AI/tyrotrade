import * as React from "react";
import length from "@turf/length";
import along from "@turf/along";
import bbox from "@turf/bbox";
import type { Feature, LineString, Position } from "geojson";
import { buildSeaRoute } from "@/lib/routing/seaRoute";
import type { Port, Project } from "@/lib/dataverse/entities";

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
 *
 * **The live AIS position deliberately does NOT shape this line.** An
 * earlier version threaded the AIS fix through as a `viaPoint` and built a
 * two-segment `LP → AIS → DP` searoute. That doubled the endpoint-snapping
 * at the AIS junction (each segment connects the AIS point to its nearest
 * marine-graph node with a *straight* connector that ignores land), so a
 * fix sitting in a strait / near a coast / between islands produced a route
 * that visibly crossed land. The hand-tuned corridor waypoints are already
 * land-safe, so the route is always `LP → corridor → DP`; the AIS fix only
 * drives the vessel marker + progress snap in `RouteMap` (`aisSnapped`).
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
  dpLat: number
): string {
  const r = (n: number) => n.toFixed(4);
  return `${r(lpLon)},${r(lpLat)}|${r(dpLon)},${r(dpLat)}`;
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

/**
 * Compute the proper sea route across an ordered list of nodes
 * (loading port → discharge stop 1 → … → final stop) by running
 * searoute-ts per consecutive leg and concatenating. Each leg avoids
 * land on its own (so e.g. a Morehead → New Orleans hop rounds Florida
 * instead of cutting straight across it). Returns null if any leg fails,
 * so the caller keeps the land-safe corridor fallback.
 */
function chainSeaRoute(
  seaRoute: SeaRouteFn,
  nodes: Port[]
): Feature<LineString> | null {
  const coords: Position[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const leg = seaRoute(
      makePoint(nodes[i].lon, nodes[i].lat),
      makePoint(nodes[i + 1].lon, nodes[i + 1].lat),
      "kilometers"
    );
    const c = leg?.geometry?.coordinates;
    if (!c || c.length < 2) return null;
    // Drop the duplicated junction vertex on every leg after the first.
    if (i === 0) coords.push(...c);
    else coords.push(...c.slice(1));
  }
  if (coords.length < 2) return null;
  return { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } };
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
  project: Project | null
): RouteGeometry | null {
  const lp = project?.vesselPlan?.loadingPort;
  const dp = project?.vesselPlan?.dischargePort;
  const waypoints = project?.vesselPlan?.waypoints;

  // Ordered discharge sequence. Multi-stop voyages ("Morehead, New
  // Orleans") carry `dischargeStops`; the common single-port case falls
  // back to `[dischargePort]`. The route visits each stop in order and
  // terminates at the last (which `dischargePort` already mirrors).
  const stops: Port[] = React.useMemo(
    () =>
      project?.vesselPlan?.dischargeStops &&
      project.vesselPlan.dischargeStops.length > 0
        ? project.vesselPlan.dischargeStops
        : dp
          ? [dp]
          : [],
    [project?.vesselPlan?.dischargeStops, dp]
  );

  const portsValid =
    !!lp &&
    stops.length > 0 &&
    !(lp.lat === 0 && lp.lon === 0) &&
    stops.every((s) => !(s.lat === 0 && s.lon === 0));

  // Cache key spans the full LP + every stop, so a route is recomputed
  // when any leg endpoint changes (not just the final destination).
  const cacheKey =
    portsValid && lp
      ? [makeKey(lp.lon, lp.lat, stops[stops.length - 1].lon, stops[stops.length - 1].lat)]
          .concat(stops.map((s) => `${s.lon.toFixed(4)},${s.lat.toFixed(4)}`))
          .join("#")
      : null;

  // Corridor fallback line: LP → corridor waypoints → intermediate stops
  // → final stop. Intermediate stops ride along as ordered waypoints.
  const buildFallback = React.useCallback((): Feature<LineString> | null => {
    if (!lp || stops.length === 0) return null;
    const inner = [...(waypoints ?? []), ...stops.slice(0, -1)];
    return buildSeaRoute(lp, stops[stops.length - 1], inner);
  }, [lp, stops, waypoints]);

  const [line, setLine] = React.useState<Feature<LineString> | null>(() => {
    if (!portsValid || !cacheKey) return null;
    const cached = lineCache.get(cacheKey);
    if (cached) return cached;
    return buildFallback();
  });

  React.useEffect(() => {
    if (!portsValid || !cacheKey || !lp) {
      setLine(null);
      return;
    }
    const cached = lineCache.get(cacheKey);
    if (cached) {
      setLine(cached);
      return;
    }
    setLine(buildFallback());

    let cancelled = false;
    loadSearoute()
      .then((seaRoute) => {
        if (cancelled) return;
        try {
          const route = chainSeaRoute(seaRoute, [lp, ...stops]);
          if (!route) return;
          lineCache.set(cacheKey, route);
          setLine(route);
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
