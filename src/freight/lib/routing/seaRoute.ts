import greatCircle from "@turf/great-circle";
import { point as tPoint } from "@turf/helpers";
import type { Feature, LineString, Position } from "geojson";
import type { Port, Waypoint } from "@/freight/lib/dataverse/entities";

const HEMISPHERE_THRESHOLD = 180;

interface BuildOpts {
  /** Number of points to interpolate per segment between consecutive nodes */
  pointsPerSegment?: number;
}

/**
 * Build a sea route LineString from origin → optional waypoints → destination.
 * Each segment is smoothed with great-circle interpolation. Waypoints should be
 * placed in straits, canals, and open-ocean inflection points so the resulting
 * polyline never crosses land. Real shipping-lane data (searoute-ts) can plug
 * into the same signature later.
 */
export function buildSeaRoute(
  origin: Port,
  destination: Port,
  waypoints?: Waypoint[],
  opts: BuildOpts = {}
): Feature<LineString> {
  const { pointsPerSegment = 32 } = opts;
  const nodes: Position[] = [
    [origin.lon, origin.lat],
    ...(waypoints ?? []).map<Position>((w) => [w.lon, w.lat]),
    [destination.lon, destination.lat],
  ];

  if (nodes.length === 2 && (!waypoints || waypoints.length === 0)) {
    // No waypoints supplied — fall back to great-circle for a single arc
    return greatCircleLine(nodes[0], nodes[1], pointsPerSegment * 4);
  }

  const coords: Position[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const seg = greatCircleLine(nodes[i], nodes[i + 1], pointsPerSegment);
    const segCoords = seg.geometry.coordinates;
    if (i === 0) coords.push(...segCoords);
    else coords.push(...segCoords.slice(1));
  }

  return {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: coords },
  };
}

function greatCircleLine(a: Position, b: Position, npoints: number): Feature<LineString> {
  const start = tPoint(a);
  const end = tPoint(b);
  const route = greatCircle(start, end, { npoints });
  if (route.geometry.type === "MultiLineString") {
    const merged: Position[] = [];
    for (const seg of route.geometry.coordinates) merged.push(...seg);
    return {
      type: "Feature",
      properties: route.properties ?? {},
      geometry: { type: "LineString", coordinates: merged },
    };
  }
  return route as Feature<LineString>;
}

/**
 * Bounding box [west, south, east, north] for the entire route (origin,
 * waypoints, destination), padded for visual breathing room.
 */
export function routeBbox(
  origin: Port,
  destination: Port,
  waypoints?: Waypoint[],
  pad = 5
): [number, number, number, number] {
  const lons = [origin.lon, destination.lon, ...(waypoints?.map((w) => w.lon) ?? [])];
  const lats = [origin.lat, destination.lat, ...(waypoints?.map((w) => w.lat) ?? [])];
  let west = Math.min(...lons);
  let east = Math.max(...lons);
  if (east - west > HEMISPHERE_THRESHOLD) {
    [west, east] = [east, west + 360];
  }
  const south = Math.min(...lats);
  const north = Math.max(...lats);
  return [west - pad, south - pad, east + pad, north + pad];
}
