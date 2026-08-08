import * as React from "react";
import {
  Map,
  Source,
  Layer,
  Marker,
  AttributionControl,
  type MapRef,
} from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  Anchor,
  MapPin,
  MapPinOff,
  Ship as ShipIcon,
  Compass,
  Plus,
  Minus,
  Crosshair,
  CalendarClock,
  X,
  Check,
  Clock,
  ArrowDownToLine,
  ArrowUpFromLine,
  Hourglass,
  CircleCheck,
  RefreshCw,
  type LucideIcon,
} from "@/freight/icons";
import { cn } from "@/lib/utils";
import lineSliceAlong from "@turf/line-slice-along";
import along from "@turf/along";
import bearing from "@turf/bearing";
import nearestPointOnLine from "@turf/nearest-point-on-line";
import { point, lineString } from "@turf/helpers";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUp01Icon, ArrowDown01Icon } from "@hugeicons/core-free-icons";
import type { Feature, LineString, Position } from "geojson";

import { GlassPanel } from "@/freight/components/glass/GlassPanel";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DEFAULT_STYLE } from "@/freight/lib/map/style";
import { useRouteGeometry } from "@/freight/hooks/useRouteGeometry";
import { useRouteProgress } from "@/freight/hooks/useRouteProgress";
import { formatDate } from "@/freight/lib/format";
import type { Project, Port } from "@/freight/lib/dataverse/entities";
import { lookupCountry } from "@/freight/lib/routing/countryCoordinates";
import {
  useBrandAccent,
  useResolvedBrandAccent,
  resolveBrandVar,
} from "@/freight/hooks/useBrandAccent";
import { useLocale } from "@/hooks/useLocale";
import { isPositionStale, positionAgeDays } from "@/freight/lib/routing/positionAge";

interface RouteMapProps {
  project: Project | null;
}

/** Stage → i18n key for the human-readable voyage-stage label. Resolved
 *  through `t()` by the consumer; falls back to the raw stage string when
 *  the stage is unknown (so the chip/marker still reads something). */
const STAGE_LABEL_KEY: Record<string, string> = {
  "pre-loading": "proj.map.stage.preLoading",
  "at-loading-port": "proj.map.stage.atLoadingPort",
  loading: "proj.map.stage.loading",
  "in-transit": "proj.map.stage.inTransit",
  "at-discharge-port": "proj.map.stage.atDischargePort",
  discharged: "proj.map.stage.discharged",
};

/** Localised voyage-stage label. `t` comes from the calling component. */
function stageLabel(stage: string, t: (key: string) => string): string {
  const key = STAGE_LABEL_KEY[stage];
  return key ? t(key) : stage;
}

/**
 * Expand one semantic token into the tinted-chip trio (soft bg + coloured
 * label + hairline border) used by the header chips and pills.
 *
 * The label is pulled toward `--foreground` rather than used raw: the token
 * sits on a ~10% tint of itself, so the raw mid-tone would wash out. The
 * source hand-picked a `-700` shade for exactly this reason; mixing toward
 * the page foreground reproduces it and inverts correctly in dark mode.
 *
 * Only for chips that live INSIDE a GlassPanel. Anything drawn on the map
 * itself sits on a permanently light basemap (Carto Voyager) and must not
 * be mixed toward `--foreground`.
 */
function chipTone(token: string, opts?: { bg?: number; border?: number }) {
  return {
    bg: `color-mix(in oklab, ${token} ${opts?.bg ?? 10}%, transparent)`,
    text: `color-mix(in oklab, ${token} 70%, var(--foreground))`,
    border: `color-mix(in oklab, ${token} ${opts?.border ?? 30}%, transparent)`,
  };
}

/** Stage chip palette — semantic but minimal. Soft tinted bg + colored
 *  text + thin border so it reads as a status hint, not a CTA. Each stage
 *  keeps its own token so the six stay mutually distinguishable: neutral →
 *  warning → warm ramp → brand (under way) → success (arrived / done). */
const STAGE_TONE: Record<string, { bg: string; text: string; border: string }> = {
  "pre-loading": chipTone("var(--status-tbn)"),
  "at-loading-port": chipTone("var(--warning)"),
  // Distinct warm step between "waiting at the berth" and "under way" —
  // --chart-3 is the one palette-independent orange in the token set.
  loading: chipTone("var(--chart-3)"),
  "in-transit": chipTone("var(--brand-via)"),
  "at-discharge-port": chipTone("var(--success)"),
  // Terminal stage shares the completed green with "at-discharge-port";
  // the chip's icon and label carry the distinction (as in the source,
  // where the two greens were a single shade apart).
  discharged: chipTone("var(--status-completed)", { border: 35 }),
};
const FALLBACK_STAGE_TONE = STAGE_TONE["in-transit"];

/** A Port is "defined" when it has a usable name AND non-zero
 *  coordinates. The composer's `fallbackPort` helper produces
 *  `{name: "—", country: "—", lat: 0, lon: 0}` when the F&O ship row
 *  has no loading/discharge port string OR the string didn't resolve
 *  through the port dictionary. Drawing a route through (0, 0)
 *  produces a nonsense line off West Africa — gate the map render on
 *  this check and surface a "port info eksik" empty state instead. */
function isPortDefined(p: {
  name?: string;
  lat?: number;
  lon?: number;
} | null | undefined): boolean {
  if (!p) return false;
  const hasName = typeof p.name === "string" && p.name.trim().length > 0 && p.name !== "—";
  const hasCoords =
    typeof p.lat === "number" &&
    typeof p.lon === "number" &&
    (p.lat !== 0 || p.lon !== 0);
  return hasName && hasCoords;
}

/** A best-effort geographic anchor for one side of the voyage, used only
 *  when the full route can't be drawn (port coordinates missing). Falls
 *  back from an exact port to a country-level point so the operator still
 *  sees *roughly* where this leg sits. `precise` distinguishes the two so
 *  the marker can render differently (solid port pin vs. dashed country
 *  pill). */
interface PlaceMarker {
  lon: number;
  lat: number;
  precise: boolean;
  /** Port name when precise, country name when country-level. */
  label: string;
  /** Country line shown under the label (empty when it equals label). */
  country: string;
}

/** Resolve whatever location we can for a port: exact coords if the port
 *  resolved through the dictionary, else the country centroid, else null. */
function resolvePlaceMarker(port: Port | null | undefined): PlaceMarker | null {
  if (!port) return null;
  if (isPortDefined(port)) {
    return {
      lon: port.lon,
      lat: port.lat,
      precise: true,
      label: port.name,
      country: port.country && port.country !== "—" ? port.country : "",
    };
  }
  const c = lookupCountry(port.country);
  if (c) {
    return { lon: c.lon, lat: c.lat, precise: false, label: c.name, country: "" };
  }
  return null;
}

/** Stage-specific glyph for the status chip. Picks the icon that
 *  best signals the voyage's current operational mode at a glance:
 *
 *    pre-loading / at-loading-port → Anchor (sitting in port)
 *    loading                       → ArrowDownToLine (cargo flowing in)
 *    in-transit                    → Ship (under way)
 *    at-discharge-port             → MapPin (arrived at destination)
 *    discharged                    → CircleCheck (voyage closed)
 *
 *  Falls back to Compass when the stage string is unknown — same
 *  neutral cue the topbar's "Rota Haritası" header uses. */
const STAGE_ICON: Record<string, LucideIcon> = {
  "pre-loading": Anchor,
  "at-loading-port": Anchor,
  loading: ArrowDownToLine,
  "in-transit": ShipIcon,
  "at-discharge-port": MapPin,
  discharged: CircleCheck,
};

const VESSEL_WORKER = ((import.meta.env.VITE_VESSEL_WORKER_URL as string | undefined) ?? "").replace(/\/$/, "");

interface AisPosition {
  lat: number;
  lon: number;
  sog: number;
  cog: number;
  status: string | null;
  vesselUrl: string;
  /** Actual AIS report time (UTC). Null when the scrape couldn't parse it. */
  positionReceivedAt: string | null;
}

export function RouteMap({ project }: RouteMapProps) {
  const { t } = useLocale();
  const mapRef = React.useRef<MapRef>(null);
  const [mapReady, setMapReady] = React.useState(false);
  // Timeline open by default — every project landing has the strip
  // visible. User can dismiss with the toggle (X icon when open),
  // and switching projects re-opens it so the new project's milestone
  // history is the first thing they see on the map.
  const [timelineOpen, setTimelineOpen] = React.useState(true);
  const [aisPos, setAisPos] = React.useState<AisPosition | null>(null);
  const [aisFetching, setAisFetching] = React.useState(false);
  const [aisError, setAisError] = React.useState<string | null>(null);
  // Stale-position lock: when the fetched position is older than the
  // staleness threshold we don't use it (no marker, progress stays
  // date-based) and lock the refresh control with the position's age.
  // Stays set for the current project (re-fetching returns the same old
  // date); cleared on project change by the reset effect below.
  const [aisStale, setAisStale] = React.useState<{ ageDays: number } | null>(
    null
  );
  const accent = useBrandAccent();
  // MapLibre's paint validator rejects both `var()` and `oklch()`, so the
  // route colours have to be concrete strings. `useResolvedBrandAccent()`
  // re-resolves on every palette / dark-mode change, and its identity change
  // is what re-runs this memo so the route repaints with it.
  const resolvedAccent = useResolvedBrandAccent();
  const routeColor = React.useMemo(
    () => ({
      done: resolveBrandVar("--route-done", resolvedAccent.deep),
      remain: resolveBrandVar("--route-remain", "rgb(128, 128, 128)"),
    }),
    [resolvedAccent]
  );
  // Route geometry follows the land-safe corridor (LP → corridor → DP) only.
  // The AIS fix is intentionally NOT fed in as a via-point — see the note in
  // useRouteGeometry. AIS still drives the marker position + progress snap
  // below (`aisSnapped`).
  const geom = useRouteGeometry(project);
  const { progress, stage } = useRouteProgress(project);

  const fetchAisPosition = React.useCallback(async () => {
    const imo = project?.vesselPlan?.imoNumber;
    const name = project?.vesselPlan?.vesselName;
    setAisFetching(true);
    setAisError(null);


    if (!imo || !name) {
      setAisFetching(false);
      return;
    }
    try {
      const res = await fetch(
        `${VESSEL_WORKER}?name=${encodeURIComponent(name)}&imo=${encodeURIComponent(imo)}`
      );
      const data = await res.json();
      if (data.error) {
        setAisError(data.error);
      } else if (isPositionStale(data.positionReceivedAt)) {
        // Older than MAX_POSITION_AGE_DAYS — drop it entirely. Marker
        // isn't placed, progress falls back to the milestone estimate,
        // and the control locks with the age so the operator knows why.
        setAisStale({ ageDays: positionAgeDays(data.positionReceivedAt) ?? 0 });
        setAisPos(null);
      } else {
        setAisPos({
          lat: data.lat,
          lon: data.lon,
          sog: data.sog,
          cog: data.cog,
          status: data.status,
          vesselUrl: data.vesselUrl,
          positionReceivedAt: data.positionReceivedAt ?? null,
        });
        setAisStale(null);
      }
    } catch {
      setAisError(t("proj.map.connectionError"));
    } finally {
      setAisFetching(false);
    }
  }, [project, geom, t]);

  // Reset AIS state when project changes — don't auto-fetch
  React.useEffect(() => {
    setAisPos(null);
    setAisError(null);
    setAisStale(null);
  }, [project?.projectNo]);

  // Re-open timeline when project changes — fresh project, fresh
  // milestone view.
  React.useEffect(() => {
    setTimelineOpen(true);
  }, [project?.projectNo]);

  // Fit padding is asymmetric so the route never sits under the
  // floating overlays:
  //   - top: leaves room for the "Rota Haritası" status pill (top-left)
  //   - right: clears the zoom controls column (top-right)
  //   - left: clears the loading PortChip
  //   - bottom: depends on the timeline strip — when open it's
  //     PortChips (52) + toggle pill (44) + MilestoneStrip (~74) +
  //     gaps; when closed only the chip row.
  const fitToRoute = React.useCallback(
    (animate: boolean) => {
      const map = mapRef.current;
      if (!map || !geom) return;
      const [west, south, east, north] = geom.bbox;
      const bottomPad = timelineOpen ? 200 : 110;
      map.fitBounds(
        [
          [west, south],
          [east, north],
        ],
        {
          padding: { top: 80, right: 80, bottom: bottomPad, left: 80 },
          duration: animate ? 900 : 0,
          maxZoom: 4.5,
        }
      );
    },
    [geom, timelineOpen]
  );

  React.useEffect(() => {
    if (!mapReady) return;
    fitToRoute(true);
  }, [mapReady, fitToRoute]);

  // Force the MapLibre attribution control into its collapsed (i)
  // state on mount — CSS overrides alone weren't enough because
  // newer maplibre versions pre-apply `maplibregl-compact-show` to
  // satisfy attribution-on-first-paint requirements. Strip the class
  // ourselves so the control reads as a single icon at rest;
  // attribution is still one click away (the user toggles the (i)).
  React.useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current?.getMap?.();
    if (!map) return;
    const container = map.getContainer();
    const attrib = container.querySelector<HTMLElement>(
      ".maplibregl-ctrl-attrib"
    );
    if (!attrib) return;
    attrib.classList.remove("maplibregl-compact-show");
    attrib.classList.add("maplibregl-compact");
  }, [mapReady]);

  // When AIS position is available, snap it to the nearest point on the route
  // and derive progress from that — overrides the date-based progress estimate.
  const aisSnapped = React.useMemo(() => {
    if (!aisPos || !geom) return null;
    const line = lineString(geom.line.geometry.coordinates);
    const nearest = nearestPointOnLine(line, point([aisPos.lon, aisPos.lat]), { units: "kilometers" });
    const distAlongKm = nearest.properties.location ?? 0;
    const snappedProgress = Math.min(0.999, Math.max(0.001, distAlongKm / geom.totalKm));
    const snappedPos = nearest.geometry.coordinates as Position;
    return { progress: snappedProgress, position: snappedPos };
  }, [aisPos, geom]);

  const effectiveProgress = aisSnapped?.progress ?? progress;

  const { completedLine, position, headingDeg } = React.useMemo(() => {
    if (!geom) {
      return { completedLine: null, position: null as Position | null, headingDeg: 0 };
    }
    const { line, totalKm } = geom;
    const km = Math.max(0.001, totalKm * Math.max(0.0001, Math.min(0.9999, effectiveProgress)));
    const completed: Feature<LineString> | null =
      effectiveProgress > 0
        ? (lineSliceAlong(line, 0, km, { units: "kilometers" }) as Feature<LineString>)
        : null;
    // When AIS is available, place the marker at the raw AIS coordinates so
    // the user sees the vessel's actual reported position. The route line
    // may not pass through this point exactly (it's a static corridor
    // approximation), but the marker truth wins over visual alignment.
    const position = aisPos
      ? [aisPos.lon, aisPos.lat] as Position
      : geom.positionAt(effectiveProgress);
    let headingDeg = aisPos?.cog ?? 0;
    if (!aisPos) {
      if (completed && completed.geometry.coordinates.length >= 2) {
        const coords = completed.geometry.coordinates;
        headingDeg = bearing(point(coords[coords.length - 2]), point(coords[coords.length - 1]));
      } else if (line.geometry.coordinates.length >= 2) {
        const coords = line.geometry.coordinates;
        headingDeg = bearing(point(coords[0]), point(coords[1]));
      }
    }
    return { completedLine: completed, position, headingDeg };
  }, [geom, effectiveProgress, aisSnapped, aisPos]);

  /**
   * Direction arrows placed at evenly-spaced intervals along the
   * route, rotated to follow the local direction of travel. Arrows
   * before the vessel's `progress` use the active theme accent
   * (bright); arrows after stay muted. Skips the 8% nearest each
   * port so they don't collide with the pins / vessel marker.
   *
   * Bearing is sampled from a centred backward+forward pair so the
   * tangent stays accurate on tight great-circle curves (single
   * forward step drifted off-line on long ocean legs).
   */
  const chevrons = React.useMemo(() => {
    if (!geom) return [] as Array<{
      lon: number;
      lat: number;
      bearingDeg: number;
      done: boolean;
    }>;
    const { line, totalKm } = geom;
    const COUNT = 6;
    const out: Array<{
      lon: number;
      lat: number;
      bearingDeg: number;
      done: boolean;
    }> = [];
    for (let i = 0; i < COUNT; i++) {
      const t = 0.08 + (i / (COUNT - 1)) * 0.84;
      const km = totalKm * t;
      const here = along(line, km, { units: "kilometers" }).geometry
        .coordinates as [number, number];
      // Centred bearing — sample equally before and after, average via
      // a vector from `back` to `ahead`. Stays on the rendered
      // polyline even on curved sea-route great circles.
      const halfStep = Math.max(0.5, totalKm * 0.005);
      const ahead = along(
        line,
        Math.min(totalKm, km + halfStep),
        { units: "kilometers" }
      ).geometry.coordinates as [number, number];
      const back = along(
        line,
        Math.max(0, km - halfStep),
        { units: "kilometers" }
      ).geometry.coordinates as [number, number];
      out.push({
        lon: here[0],
        lat: here[1],
        bearingDeg: bearing(point(back), point(ahead)),
        done: t < effectiveProgress,
      });
    }
    return out;
  }, [geom, effectiveProgress]);

  const lp = project?.vesselPlan?.loadingPort;
  const dp = project?.vesselPlan?.dischargePort;
  const ms = project?.vesselPlan?.milestones;
  // Ordered discharge sequence — multi-stop voyages ("Morehead, New
  // Orleans") carry `dischargeStops`; single-port voyages fall back to
  // the lone `dischargePort`. Each stop gets its own pin, in order.
  const dischargeStops =
    project?.vesselPlan?.dischargeStops &&
    project.vesselPlan.dischargeStops.length > 0
      ? project.vesselPlan.dischargeStops
      : dp
        ? [dp]
        : [];

  // Port-validity check — gate the map render on the loading AND
  // discharge ports both being defined. Composer's fallback ports
  // produce (0,0) coords + "—" sentinel name; drawing a route from
  // those produces a wrong line. See `isPortDefined` definition above.
  const lpDefined = isPortDefined(project?.vesselPlan?.loadingPort);
  const dpDefined = isPortDefined(project?.vesselPlan?.dischargePort);
  const portsDefined = lpDefined && dpDefined;
  const missingPortKind: "both" | "loading" | "discharge" | null =
    project?.vesselPlan && !portsDefined
      ? !lpDefined && !dpDefined
        ? "both"
        : !lpDefined
          ? "loading"
          : "discharge"
      : null;

  // Fallback anchors for when the route can't be drawn: pin whatever we
  // DO have (a resolved port, or failing that the country). The route
  // line stays off; this is purely "show me where this leg roughly is".
  const lpMarker = resolvePlaceMarker(project?.vesselPlan?.loadingPort);
  const dpMarker = resolvePlaceMarker(project?.vesselPlan?.dischargePort);
  const placeMode =
    !!project?.vesselPlan && !portsDefined && !!(lpMarker || dpMarker);

  return (
    <TooltipProvider delayDuration={200} disableHoverableContent>
      <div className="relative h-full rounded-3xl overflow-hidden glass">
        <div className="absolute inset-0 z-[1]">
          {project && geom && portsDefined ? (
            <Map
              ref={mapRef}
              mapStyle={DEFAULT_STYLE}
              initialViewState={{
                longitude: (geom.bbox[0] + geom.bbox[2]) / 2,
                latitude: (geom.bbox[1] + geom.bbox[3]) / 2,
                zoom: 2,
              }}
              attributionControl={false}
              cooperativeGestures={false}
              onLoad={() => setMapReady(true)}
            >
              <Source id="route-full" type="geojson" data={geom.line}>
                {/* Alpha that used to be baked into the rgba() literal now
                    rides `line-opacity`, since the token carries its own. */}
                <Layer
                  id="route-remaining-glow"
                  type="line"
                  paint={{
                    "line-color": routeColor.remain,
                    "line-width": 7,
                    "line-blur": 6,
                    "line-opacity": 0.35,
                  }}
                />
                <Layer
                  id="route-remaining"
                  type="line"
                  paint={{
                    "line-color": routeColor.remain,
                    "line-width": 2.5,
                    "line-dasharray": [1.6, 2],
                    "line-opacity": 0.9,
                  }}
                />
              </Source>

              {completedLine && (
                <Source id="route-completed" type="geojson" data={completedLine}>
                  <Layer
                    id="route-completed-glow"
                    type="line"
                    paint={{
                      "line-color": routeColor.done,
                      "line-width": 9,
                      "line-blur": 6,
                      "line-opacity": 0.45,
                    }}
                  />
                  <Layer
                    id="route-completed-line"
                    type="line"
                    paint={{
                      "line-color": routeColor.done,
                      "line-width": 3.2,
                      "line-opacity": 1,
                    }}
                  />
                </Source>
              )}

              {lp && ms && (
                <Marker longitude={lp.lon} latitude={lp.lat} anchor="center">
                  <div title={`${lp.name} · ${lp.country}\nLP-ETA: ${formatDate(ms.lpEta)}`}>
                    <PortPin kind="loading" />
                  </div>
                </Marker>
              )}

              {ms &&
                dischargeStops.map((stop, i) => {
                  const isFinal = i === dischargeStops.length - 1;
                  const multi = dischargeStops.length > 1;
                  const title =
                    `${multi ? `${i + 1}. ` : ""}${stop.name} · ${stop.country}` +
                    (isFinal ? `\nDP-ETA: ${formatDate(ms.dpEta)}` : "");
                  return (
                    <Marker
                      key={`dp-${i}-${stop.lon.toFixed(3)},${stop.lat.toFixed(3)}`}
                      longitude={stop.lon}
                      latitude={stop.lat}
                      anchor="center"
                    >
                      <div title={title}>
                        <PortPin
                          kind="discharge"
                          seq={multi ? i + 1 : undefined}
                        />
                      </div>
                    </Marker>
                  );
                })}

              {/* Direction chevrons along the route — convey LP→DP
                  flow at a glance. Rendered before the vessel so the
                  vessel marker stays on top. */}
              {chevrons.map((c, i) => (
                <Marker
                  key={`chev-${i}`}
                  longitude={c.lon}
                  latitude={c.lat}
                  anchor="center"
                >
                  <DirectionChevron
                    bearingDeg={c.bearingDeg}
                    done={c.done}
                  />
                </Marker>
              ))}

              {!aisPos && position && effectiveProgress > 0.02 && effectiveProgress < 0.98 && project && (
                <Marker
                  longitude={position[0]}
                  latitude={position[1]}
                  anchor="center"
                >
                  <div
                    title={`${project.vesselPlan!.vesselName} · ${
                      stageLabel(stage, t)
                    } · %${(effectiveProgress * 100).toFixed(0)}`}
                  >
                    <VesselMarker heading={headingDeg} accent={accent} />
                  </div>
                </Marker>
              )}

              {aisPos && project?.vesselPlan && (
                <Marker
                  longitude={aisPos.lon}
                  latitude={aisPos.lat}
                  anchor="center"
                >
                  <AisMarker
                    heading={aisPos.cog}
                    sog={aisPos.sog}
                    status={aisPos.status}
                    vesselName={project.vesselPlan.vesselName}
                    vesselUrl={aisPos.vesselUrl}
                  />
                </Marker>
              )}

              {/* Attribution must stay (Carto + OSM licence). Forced
                  collapsed-(i) state via the useEffect above + the
                  globals.css override; we anchor it flush to the
                  bottom-right corner so the (i) icon sits in dead
                  space below the discharge PortChip — no overlap with
                  the chip row or the timeline strip. */}
              <AttributionControl
                compact
                position="bottom-right"
                style={{
                  marginRight: 4,
                  marginBottom: 4,
                }}
              />
            </Map>
          ) : placeMode ? (
            // Route can't be drawn (port coordinates missing) but we have
            // at least one anchor — show a no-route map with whatever
            // port/country pins we could resolve.
            <PlaceMarkersMap loading={lpMarker} discharge={dpMarker} />
          ) : (
            <EmptyState
              kind={
                !project
                  ? "no-selection"
                  : !project.vesselPlan
                    ? "no-vessel-plan"
                    : missingPortKind
                      ? "missing-port"
                      : "no-route"
              }
              projectNo={project?.projectNo}
              missingPortKind={missingPortKind}
              loadingPortName={
                project?.vesselPlan?.loadingPort?.name
              }
              dischargePortName={
                project?.vesselPlan?.dischargePort?.name
              }
            />
          )}
        </div>

        <div className="absolute top-3 left-3 z-[3] pointer-events-none max-w-[calc(100%-5rem)] flex flex-col items-start gap-2">
          <GlassPanel
            tone="strong"
            className="rounded-xl pointer-events-auto"
            style={{
              boxShadow: `0 6px 18px -4px ${accent.ring}, inset 0 1px 0 0 var(--spec-highlight)`,
            }}
          >
            <div className="px-3 py-2 flex flex-wrap items-center gap-x-2 gap-y-1">
              <Compass
                className="size-3.5"
                style={{ color: accent.solid }}
                strokeWidth={2.5}
              />
              <span className="text-[13px] font-semibold tracking-tight">
                {t("proj.map.title")}
              </span>
              {project &&
                (() => {
                  const stageTone = STAGE_TONE[stage] ?? FALLBACK_STAGE_TONE;
                  // Compass is the neutral fallback — it's already the
                  // header glyph next to "Rota Haritası", so an unknown
                  // stage just degrades to the same cue rather than
                  // forcing an arbitrary mismatched icon.
                  const StageIcon = STAGE_ICON[stage] ?? Compass;
                  return (
                    <span
                      className="ml-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-medium tracking-tight"
                      style={{
                        backgroundColor: stageTone.bg,
                        color: stageTone.text,
                        boxShadow: `inset 0 0 0 1px ${stageTone.border}`,
                      }}
                    >
                      <StageIcon
                        className="size-2.5 mr-1"
                        strokeWidth={2.5}
                      />
                      {stageLabel(stage, t)} · %
                      {(effectiveProgress * 100).toFixed(0)}{aisPos ? " ·  AIS" : ""}
                    </span>
                  );
                })()}
              {project && <DurationPills project={project} />}
            </div>
          </GlassPanel>

          {/* Stale-position note — the last reported AIS position is older
              than the threshold, so the live fix was dropped and the vessel
              is drawn at its date-based estimate. Lives under the title (not
              in the top-right control stack) so it can never collide with the
              controls on narrow / mobile layouts — the left column already
              reserves a 5rem gutter for them and the note wraps within it. */}
          {aisStale && (
            <GlassPanel
              tone="strong"
              className="rounded-lg pointer-events-auto"
            >
              <div className="flex items-center gap-1.5 px-2 py-1 text-[10.5px] font-medium text-[color-mix(in_oklab,var(--warning)_70%,var(--foreground))]">
                <Clock className="size-3 shrink-0" strokeWidth={2.5} />
                <span>
                  {t("proj.map.staleNote").replace(
                    "{days}",
                    String(aisStale.ageDays)
                  )}
                </span>
              </div>
            </GlassPanel>
          )}
        </div>

        {/* Place-mode note — route couldn't be drawn, pins are approximate. */}
        {placeMode && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[3] pointer-events-none">
            <GlassPanel tone="strong" className="rounded-full pointer-events-auto">
              <div className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-[color-mix(in_oklab,var(--warning)_70%,var(--foreground))]">
                <MapPinOff className="size-3.5 shrink-0" strokeWidth={2.25} />
                <span className="whitespace-nowrap">
                  {t("proj.map.placeModeNote")}
                </span>
              </div>
            </GlassPanel>
          </div>
        )}

        {project && geom && portsDefined && (
          <div className="absolute top-3 right-3 z-[3] flex flex-col items-end gap-2 pointer-events-none">
            <GlassPanel tone="strong" className="rounded-xl pointer-events-auto">
              <div className="flex flex-col p-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => mapRef.current?.zoomIn({ duration: 250 })}
                      aria-label={t("proj.map.zoomIn")}
                    >
                      <Plus className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">{t("proj.map.zoomIn")}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => mapRef.current?.zoomOut({ duration: 250 })}
                      aria-label={t("proj.map.zoomOut")}
                    >
                      <Minus className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">{t("proj.map.zoomOut")}</TooltipContent>
                </Tooltip>
                <div className="h-px bg-border my-0.5" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => fitToRoute(true)}
                      aria-label={t("proj.map.fitRoute")}
                    >
                      <Crosshair className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">{t("proj.map.fitRoute")}</TooltipContent>
                </Tooltip>
                <div className="h-px bg-border my-0.5" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={fetchAisPosition}
                      disabled={
                        aisFetching ||
                        !project?.vesselPlan?.imoNumber ||
                        stage === "discharged" ||
                        aisStale !== null
                      }
                      aria-label={t("proj.map.livePosition")}
                    >
                      <RefreshCw className={cn("size-4", aisFetching && "animate-spin")} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    {!project?.vesselPlan?.imoNumber
                      ? t("proj.map.noImo")
                      : stage === "discharged"
                      ? t("proj.map.voyageDone")
                      : aisStale
                      ? t("proj.map.staleTooltip").replace(
                          "{days}",
                          String(aisStale.ageDays)
                        )
                      : aisError
                      ? aisError
                      : aisPos
                      ? t("proj.map.updatePosition")
                      : t("proj.map.livePosition")}
                  </TooltipContent>
                </Tooltip>
              </div>
            </GlassPanel>
          </div>
        )}

        {project?.vesselPlan && (
          <div className="absolute bottom-3 left-3 right-3 z-[3] flex flex-col gap-2 pointer-events-none">
            {timelineOpen && (
              <MilestoneStrip
                ms={project.vesselPlan.milestones}
                progress={effectiveProgress}
                stage={stage}
                onClose={() => setTimelineOpen(false)}
              />
            )}
            <div className="flex items-stretch gap-2">
              <PortChip
                kind="loading"
                name={project.vesselPlan.loadingPort.name}
                country={project.vesselPlan.loadingPort.country}
                date={project.vesselPlan.milestones.lpEta}
                dateLabel="LP-ETA"
              />
              <button
                type="button"
                onClick={() => setTimelineOpen((v) => !v)}
                aria-label={
                  timelineOpen
                    ? t("proj.map.timeline.toggleClose")
                    : t("proj.map.timeline.toggleOpen")
                }
                className={cn(
                  "pointer-events-auto shrink-0 self-center size-11 rounded-full grid place-items-center transition-all",
                  // ring-card cuts the pill out of the map the way the
                  // literal white rim did, but follows the theme.
                  "text-white shadow-lg ring-2 ring-card/80 backdrop-blur-sm",
                  "hover:scale-110 active:scale-95"
                )}
                style={{
                  background: accent.gradient,
                  // Inset white line is gloss on the brand fill — stays literal.
                  boxShadow: timelineOpen
                    ? `0 0 0 4px ${accent.ring}, 0 8px 20px -6px ${accent.ring}`
                    : `0 8px 20px -6px ${accent.ring}, inset 0 1px 0 0 rgba(255,255,255,0.2)`,
                }}
              >
                {timelineOpen ? (
                  // Arrow-down on open = "tuck the strip away". More
                  // natural than an X close glyph for a panel that's
                  // always available — it's collapsing, not dismissing.
                  // HugeIcons ArrowDown01 mirrors the ArrowUp01 used on
                  // the symmetric "open" affordance elsewhere on the map.
                  <HugeiconsIcon
                    icon={ArrowDown01Icon}
                    size={16}
                    strokeWidth={2}
                  />
                ) : (
                  // CalendarClock = "open timeline". Reads as a date /
                  // schedule trigger, which is exactly what the strip
                  // shows (LP-ETA → DP-ED milestone dates).
                  <CalendarClock className="size-4" />
                )}
              </button>
              {(() => {
                // Show the most-recent populated DP milestone instead
                // of always pinning the chip to DP-ETA — once the
                // vessel reaches the discharge port the chip should
                // advance to DP-NOR / DP-SD / DP-ED.
                const dp = pickLatestDpMilestone(
                  project.vesselPlan.milestones
                );
                // Multi-stop discharge ("Morehead, New Orleans") renders
                // every stop joined with arrows, in sequence; the country
                // line collapses to the distinct countries touched.
                const stops = project.vesselPlan.dischargeStops;
                const multi = !!stops && stops.length > 1;
                const name = multi
                  ? stops!.map((s) => s.name).join(" → ")
                  : project.vesselPlan.dischargePort.name;
                const country = multi
                  ? Array.from(new Set(stops!.map((s) => s.country))).join(" · ")
                  : project.vesselPlan.dischargePort.country;
                return (
                  <PortChip
                    kind="discharge"
                    name={name}
                    country={country}
                    date={dp.date}
                    dateLabel={dp.label}
                  />
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

/* ─────────── Duration pills (Yükleme + Tahliye + Transit + Operasyon) ─────────── */

/** Calendar-day count strictly BETWEEN two ISO date strings — excludes
 *  both the start and the end day from the result. Used for the
 *  "Operasyon" pill: the voyage's first milestone (LP-ETA) and last
 *  milestone (DP-ED) are NOT counted as operation days; only the
 *  full days strictly in between are. Returns 0 for adjacent or
 *  same-day pairs and null when either side is missing.
 *
 * Examples:
 *   2026-01-01 → 2026-01-10 → 8  (days 2-9 inclusive)
 *   2026-01-01 → 2026-01-02 → 0  (no full day in between)
 *   2026-01-01 → 2026-01-01 → 0  (clamped, never negative) */
function daysBetweenExclusive(
  startIso: string | null | undefined,
  endIso: string | null | undefined
): number | null {
  if (!startIso || !endIso) return null;
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  const span = Math.round((end - start) / 86_400_000);
  return Math.max(0, span - 1);
}

/** Operasyon Süresi — full-day count between LP-ETA and DP-ED on the
 *  voyage timeline, exclusive of both endpoints (per user spec). The
 *  start and end milestones themselves don't count as operation
 *  days, only what's strictly in between. */
function operationDays(p: Project): number | null {
  const ms = p.vesselPlan?.milestones;
  if (!ms) return null;
  return daysBetweenExclusive(ms.lpEta, ms.dpEd);
}

/** Pill colour palette per metric — four distinct token families so no two
 *  pills sit in the same colour territory, and all four follow the palette:
 *
 *   Yükleme   → --warning    (the amber the loading pin/chip already uses)
 *   Transit   → --brand-via  (the accent — the source's sky)
 *   Tahliye   → --success    (the green the discharge pin/chip already uses,
 *                             which also makes load/discharge read the same
 *                             way everywhere on the map — the source's rose
 *                             clashed with its own emerald discharge pin)
 *   Operasyon → --brand-deep (deepest brand stop — keeps the original
 *                             "summary" weight of indigo)
 *
 *  `label` and `value` are mixed toward --foreground at two strengths,
 *  reproducing the source's -700 / -900 pairing in both themes. */
function pillTone(token: string, bg: number, ring: number) {
  return {
    bg: `color-mix(in oklab, ${token} ${bg}%, transparent)`,
    ring: `color-mix(in oklab, ${token} ${ring}%, transparent)`,
    label: `color-mix(in oklab, ${token} 62%, var(--foreground))`,
    value: `color-mix(in oklab, ${token} 38%, var(--foreground))`,
  };
}

const PILL_TONES = {
  loading: pillTone("var(--warning)", 13, 34),
  discharge: pillTone("var(--success)", 13, 34),
  transit: pillTone("var(--brand-via)", 14, 35),
  operation: pillTone("var(--brand-deep)", 13, 32),
} as const;

/** Compact day-count pill shared by all four metrics. Renders only
 *  when `value` is a finite number — null collapses to nothing. The
 *  leading `Icon` is metric-specific (caller decides) so the four
 *  pills can be told apart at a glance even before the eye reaches
 *  the label text. */
function DurationPill({
  value,
  label,
  daySuffix,
  tone,
  title,
  Icon,
}: {
  value: number | null;
  label: string;
  /** Localised single-letter day suffix shown after the count (g / d). */
  daySuffix: string;
  tone: (typeof PILL_TONES)[keyof typeof PILL_TONES];
  title: string;
  Icon: LucideIcon;
}) {
  if (value == null) return null;
  return (
    <span
      className="ml-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-medium tracking-tight"
      style={{
        backgroundColor: tone.bg,
        boxShadow: `inset 0 0 0 1px ${tone.ring}`,
      }}
      title={title}
    >
      <Icon
        className="size-2.5 mr-1"
        strokeWidth={2.5}
        style={{ color: tone.label }}
      />
      <span
        className="uppercase tracking-wider"
        style={{ color: tone.label }}
      >
        {label}
      </span>
      <span aria-hidden className="mx-1" style={{ color: tone.label, opacity: 0.4 }}>
        ·
      </span>
      <span
        className="font-semibold tabular-nums"
        style={{ color: tone.value }}
      >
        {value}{daySuffix}
      </span>
    </span>
  );
}

/** Four duration pills shown next to the stage chip in the map
 *  header — chronological voyage order (load → sail → discharge →
 *  total operation):
 *
 *    Yükleme   ← `mserp_loadingtime`
 *    Transit   ← `mserp_transfertime`     (between load + discharge)
 *    Tahliye   ← `mserp_evacuationtime`
 *    Operasyon ← derived: full days between LP-ETA and DP-ED
 *                 (endpoints excluded; milestone days don't count
 *                 against the operation span).
 *
 *  Each pill self-hides when its source value is missing/zero, so
 *  voyages with partial data still render whatever's available. */
function DurationPills({ project }: { project: Project }) {
  const { t } = useLocale();
  const vp = project.vesselPlan;
  const loading = vp?.loadingDays ?? null;
  const transit = vp?.transferDays ?? null;
  const discharge = vp?.evacuationDays ?? null;
  const operation = operationDays(project);
  if (
    loading == null &&
    transit == null &&
    discharge == null &&
    operation == null
  ) {
    return null;
  }
  return (
    <>
      {/* Yükleme = cargo flowing INTO the vessel — down-arrow.
          Transit = under way — Ship.
          Tahliye = cargo flowing OUT of the vessel — up-arrow.
          Operasyon = total elapsed time — Hourglass (the only
                     one that's a duration metric vs. a verb). */}
      <DurationPill
        value={loading}
        label={t("proj.map.pill.loading")}
        daySuffix={t("proj.map.pill.daySuffix")}
        tone={PILL_TONES.loading}
        Icon={ArrowDownToLine}
        title={t("proj.map.pill.loadingTitle").replace("{days}", String(loading))}
      />
      <DurationPill
        value={transit}
        label={t("proj.map.pill.transit")}
        daySuffix={t("proj.map.pill.daySuffix")}
        tone={PILL_TONES.transit}
        Icon={ShipIcon}
        title={t("proj.map.pill.transitTitle").replace("{days}", String(transit))}
      />
      <DurationPill
        value={discharge}
        label={t("proj.map.pill.discharge")}
        daySuffix={t("proj.map.pill.daySuffix")}
        tone={PILL_TONES.discharge}
        Icon={ArrowUpFromLine}
        title={t("proj.map.pill.dischargeTitle").replace("{days}", String(discharge))}
      />
      <DurationPill
        value={operation}
        label={t("proj.map.pill.operation")}
        daySuffix={t("proj.map.pill.daySuffix")}
        tone={PILL_TONES.operation}
        Icon={Hourglass}
        title={
          operation != null
            ? t("proj.map.pill.operationTitle").replace(
                "{days}",
                String(operation)
              )
            : ""
        }
      />
    </>
  );
}

function EmptyState({
  kind,
  projectNo,
  missingPortKind,
  loadingPortName,
  dischargePortName,
}: {
  kind: "no-selection" | "no-vessel-plan" | "no-route" | "missing-port";
  projectNo?: string;
  /** When `kind === "missing-port"`, which side is missing — both,
   *  loading, or discharge. Drives the visual port-slot layout below. */
  missingPortKind?: "both" | "loading" | "discharge" | null;
  loadingPortName?: string;
  dischargePortName?: string;
}) {
  const { t } = useLocale();
  // Dedicated rich layout for the missing-port case — operators see
  // exactly which side of the journey is missing, with a clear "veri
  // girilmeli" cue instead of a misleading map.
  if (kind === "missing-port") {
    return (
      <MissingPortEmptyState
        kind={missingPortKind ?? "both"}
        loadingPortName={loadingPortName}
        dischargePortName={dischargePortName}
        projectNo={projectNo}
      />
    );
  }
  const message =
    kind === "no-selection"
      ? t("proj.map.empty.selectProject")
      : kind === "no-vessel-plan"
        ? t("proj.map.empty.noVesselPlan")
        : t("proj.map.empty.noRoute");
  const sublabel =
    kind === "no-vessel-plan"
      ? t("proj.map.empty.noVesselPlanSub")
      : kind === "no-route"
        ? t("proj.map.empty.noRouteSub")
        : null;
  return (
    <div className="h-full grid place-items-center text-muted-foreground">
      <div className="text-center px-6 max-w-sm">
        <Compass className="size-10 mx-auto mb-2 opacity-50" />
        <p className="text-sm font-medium">{message}</p>
        {sublabel && (
          <p className="text-[11px] text-muted-foreground/80 mt-1.5 leading-relaxed">
            {sublabel}
          </p>
        )}
        {projectNo && (
          <p className="text-[10px] font-mono text-muted-foreground/60 mt-2">
            {projectNo}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Missing-port empty state — visual layout shows two port "slots"
 * (loading → discharge) with the missing side(s) drawn as an empty
 * outlined card with `MapPinOff` icon. Defined sides render the
 * actual port name. A subtle amber tint reads as "veri girişi
 * eksik", not a system error.
 */
function MissingPortEmptyState({
  kind,
  loadingPortName,
  dischargePortName,
  projectNo,
}: {
  kind: "both" | "loading" | "discharge";
  loadingPortName?: string;
  dischargePortName?: string;
  projectNo?: string;
}) {
  const { t } = useLocale();
  const loadingMissing = kind === "both" || kind === "loading";
  const dischargeMissing = kind === "both" || kind === "discharge";
  const headline =
    kind === "both"
      ? t("proj.map.missing.both")
      : kind === "loading"
        ? t("proj.map.missing.loading")
        : t("proj.map.missing.discharge");
  return (
    <div className="h-full grid place-items-center px-6">
      <div className="w-full max-w-md text-center">
        <div className="inline-flex items-center justify-center size-12 rounded-2xl bg-warning/10 border border-warning/30 mb-3">
          <MapPinOff
            className="size-6 text-[color-mix(in_oklab,var(--warning)_70%,var(--foreground))]"
            strokeWidth={1.75}
          />
        </div>
        <p className="text-sm font-semibold text-foreground">{headline}</p>
        <p className="text-[11.5px] text-muted-foreground mt-1.5 leading-relaxed">
          {t("proj.map.missing.body")}
        </p>

        {/* Port slots — loading on the left, discharge on the right.
            Each slot shows the defined port name with anchor icon, or
            an "—" placeholder + MapPinOff when missing. */}
        <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-stretch gap-2">
          <PortSlot
            label={t("proj.map.slot.loading")}
            name={loadingPortName}
            missing={loadingMissing}
          />
          <div className="flex items-center justify-center text-muted-foreground/40 text-[11px]">
            <span className="-mx-1">→</span>
          </div>
          <PortSlot
            label={t("proj.map.slot.discharge")}
            name={dischargePortName}
            missing={dischargeMissing}
          />
        </div>

        {projectNo && (
          <p className="text-[10px] font-mono text-muted-foreground/60 mt-4">
            {projectNo}
          </p>
        )}
      </div>
    </div>
  );
}

/** One port "slot" — label on top, then either the port name (defined)
 *  or a MapPinOff placeholder (missing). Used in pairs by
 *  `MissingPortEmptyState`. */
function PortSlot({
  label,
  name,
  missing,
}: {
  label: string;
  name?: string;
  missing: boolean;
}) {
  const { t } = useLocale();
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2.5 text-left",
        missing
          ? "border-warning/30 bg-warning/[0.04]"
          : "border-foreground/15 bg-foreground/[0.025]"
      )}
    >
      <div
        className={cn(
          "text-[9.5px] font-semibold uppercase tracking-wider mb-1",
          missing
            ? "text-[color-mix(in_oklab,var(--warning)_70%,var(--foreground))]/80"
            : "text-muted-foreground"
        )}
      >
        {label}
      </div>
      <div className="flex items-center gap-1.5">
        {missing ? (
          <>
            <MapPinOff
              className="size-3.5 text-[color-mix(in_oklab,var(--warning)_70%,var(--foreground))]/70 shrink-0"
              strokeWidth={2}
            />
            <span className="text-[12px] text-[color-mix(in_oklab,var(--warning)_70%,var(--foreground))]/85 font-medium italic">
              {t("proj.map.slot.missing")}
            </span>
          </>
        ) : (
          <>
            <MapPin
              className="size-3.5 text-foreground/60 shrink-0"
              strokeWidth={2}
            />
            <span className="text-[12px] text-foreground/85 truncate">
              {name && name.length > 0 ? name : "—"}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Tiny chevron arrow placed along the route to convey LP→DP direction
 * at a glance. Rotated so the tip points along the local route
 * tangent. Carries the same two colours as the route line itself —
 * `--route-done` on the completed segment, `--route-remain` ahead of
 * the vessel — so arrows and line always read as one object.
 *
 *  - `bearingDeg` is in compass degrees (0=N, 90=E…). We translate to
 *    SVG rotation by subtracting 90° so a default east-pointing
 *    chevron lines up with bearing=90.
 *  - `pointer-events: none` so chevrons don't steal hover from the
 *    underlying line / port pins.
 */
function DirectionChevron({
  bearingDeg,
  done,
}: {
  bearingDeg: number;
  done: boolean;
}) {
  // HugeIcons ArrowUp01Icon points up by default; we add 180° to make
  // it point along the bearing (icon "down" → travel direction).
  // Active arrows take the completed-route colour; pending arrows fade
  // into the remaining-route grey.
  //
  // The white halo stays a literal white: the Carto Voyager basemap is
  // light in BOTH themes, so this is a legibility shim against the map
  // tiles, not a surface colour.
  return (
    <div
      className="pointer-events-none"
      style={{
        transform: `rotate(${bearingDeg}deg)`,
        transformOrigin: "center",
        filter: done
          ? "drop-shadow(0 0 5px color-mix(in oklab, var(--brand-from) 55%, transparent)) drop-shadow(0 0 1px rgba(255,255,255,0.7))"
          : "drop-shadow(0 0 2px rgba(255,255,255,0.45))",
        color: done ? "var(--route-done)" : "var(--route-remain)",
      }}
    >
      <HugeiconsIcon
        icon={ArrowUp01Icon}
        size={done ? 16 : 14}
        strokeWidth={done ? 3 : 2.4}
      />
    </div>
  );
}

function PortPin({
  kind,
  seq,
}: {
  kind: "loading" | "discharge";
  /** When set (multi-stop discharge), the pin shows this 1-based stop
   *  number instead of the map-pin glyph so the discharge sequence reads
   *  at a glance. */
  seq?: number;
}) {
  const Icon = kind === "loading" ? Anchor : MapPin;
  // Loading = --warning, discharge = --success — the same two tokens the
  // PortChip and duration pills use, so a leg keeps one colour everywhere.
  // The rim is that token lifted toward white (the source's -300 shade);
  // both sit on the permanently-light basemap, so no theme mixing here.
  const legToken = kind === "loading" ? "var(--warning)" : "var(--success)";
  return (
    <div className="relative">
      <span
        className="absolute inset-0 -m-2 rounded-full animate-ping"
        style={{
          backgroundColor: `color-mix(in oklab, ${legToken} 25%, transparent)`,
        }}
        aria-hidden
      />
      <div
        className="relative size-7 rounded-full grid place-items-center text-white border-2 shadow-md"
        style={{
          backgroundColor: legToken,
          borderColor: `color-mix(in oklab, ${legToken} 55%, white)`,
        }}
      >
        {typeof seq === "number" ? (
          <span className="text-[12px] font-bold leading-none">{seq}</span>
        ) : (
          <Icon className="size-3.5" />
        )}
      </div>
    </div>
  );
}

/** Country-level approximate pin — a dashed pill with the country name,
 *  colour-coded by leg (--warning = loading, --success = discharge). The
 *  dashed border + small foot dot signal "this is a rough country anchor,
 *  not an exact port", distinguishing it from the solid `PortPin`. */
function CountryPin({
  kind,
  label,
}: {
  kind: "loading" | "discharge";
  label: string;
}) {
  const isLoad = kind === "loading";
  const legToken = isLoad ? "var(--warning)" : "var(--success)";
  const ring = legToken;
  const bg = `color-mix(in oklab, ${legToken} 14%, transparent)`;
  // Deepened toward black, NOT toward --foreground: this pill floats on
  // the basemap, which stays light in dark mode too.
  const text = `color-mix(in oklab, ${legToken} 60%, black)`;
  const Icon = isLoad ? Anchor : MapPin;
  return (
    <div
      className="flex flex-col items-center"
      style={{ transform: "translate(0, -50%)" }}
    >
      <div
        className="flex items-center gap-1 rounded-full px-2 py-1 shadow-md backdrop-blur-sm"
        style={{ background: bg, border: `1.5px dashed ${ring}`, color: text }}
      >
        <Icon className="size-3 shrink-0" strokeWidth={2.5} />
        <span className="text-[10px] font-semibold whitespace-nowrap leading-none">
          {label}
        </span>
      </div>
      <div
        className="size-1.5 rounded-full mt-0.5"
        style={{ background: ring }}
        aria-hidden
      />
    </div>
  );
}

/** One fallback anchor on the place-markers map — a solid port pin when
 *  coordinates are exact, a dashed country pill when only the country is
 *  known. */
function PlacePin({
  marker,
  kind,
}: {
  marker: PlaceMarker;
  kind: "loading" | "discharge";
}) {
  const { t } = useLocale();
  const title = marker.precise
    ? `${marker.label}${marker.country ? ` · ${marker.country}` : ""}`
    : `${marker.label}\n${t("proj.map.marker.countryApprox")}`;
  return (
    <Marker
      longitude={marker.lon}
      latitude={marker.lat}
      anchor="center"
    >
      <div title={title}>
        {marker.precise ? (
          <PortPin kind={kind} />
        ) : (
          <CountryPin kind={kind} label={marker.label} />
        )}
      </div>
    </Marker>
  );
}

/** No-route map: renders only the anchors we could resolve (port and/or
 *  country pins) when the full sea-route can't be built. No route line,
 *  no chevrons, no vessel marker — just "here's roughly where this is".
 *  Self-contained (own map ref + fit) so it doesn't depend on the
 *  full-route map's controls. */
function PlaceMarkersMap({
  loading,
  discharge,
}: {
  loading: PlaceMarker | null;
  discharge: PlaceMarker | null;
}) {
  const mapRef = React.useRef<MapRef>(null);
  const [ready, setReady] = React.useState(false);

  // Stable coord keys so the fit effect only re-runs when an anchor
  // actually moves (project change), not on every render — otherwise it
  // would fight the user's pan/zoom.
  const lpKey = loading ? `${loading.lon},${loading.lat}` : "";
  const dpKey = discharge ? `${discharge.lon},${discharge.lat}` : "";

  const pts = [loading, discharge].filter(Boolean) as PlaceMarker[];
  const centerLon =
    pts.length > 0 ? pts.reduce((s, p) => s + p.lon, 0) / pts.length : 0;
  const centerLat =
    pts.length > 0 ? pts.reduce((s, p) => s + p.lat, 0) / pts.length : 0;

  const fit = React.useCallback(
    (animate: boolean) => {
      const map = mapRef.current;
      if (!map) return;
      const ms = [loading, discharge].filter(Boolean) as PlaceMarker[];
      if (ms.length >= 2) {
        const lons = ms.map((m) => m.lon);
        const lats = ms.map((m) => m.lat);
        map.fitBounds(
          [
            [Math.min(...lons), Math.min(...lats)],
            [Math.max(...lons), Math.max(...lats)],
          ],
          {
            padding: { top: 90, right: 70, bottom: 130, left: 70 },
            duration: animate ? 800 : 0,
            maxZoom: 5,
          }
        );
      } else if (ms.length === 1) {
        map.easeTo({
          center: [ms[0].lon, ms[0].lat],
          zoom: 4,
          duration: animate ? 800 : 0,
        });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [lpKey, dpKey]
  );

  React.useEffect(() => {
    if (ready) fit(false);
  }, [ready, fit]);

  return (
    <Map
      ref={mapRef}
      mapStyle={DEFAULT_STYLE}
      initialViewState={{ longitude: centerLon, latitude: centerLat, zoom: 3 }}
      attributionControl={false}
      cooperativeGestures={false}
      onLoad={() => setReady(true)}
    >
      {loading && <PlacePin marker={loading} kind="loading" />}
      {discharge && <PlacePin marker={discharge} kind="discharge" />}
      <AttributionControl
        compact
        position="bottom-right"
        style={{ marginRight: 4, marginBottom: 4 }}
      />
    </Map>
  );
}

function VesselMarker({
  heading,
  accent,
}: {
  heading: number;
  accent: ReturnType<typeof useBrandAccent>;
}) {
  return (
    <div className="relative" style={{ transform: "translate(-50%, -50%)" }}>
      {/* Pulsing halo — uses the live sidebar accent ring for the glow. */}
      <span
        className="absolute inset-0 -m-3 rounded-full blur-md animate-pulse"
        style={{ backgroundColor: accent.ring }}
      />
      <div
        className="relative size-9 rounded-full grid place-items-center text-white shadow-lg"
        style={{
          background: accent.gradient,
          boxShadow: `0 0 0 2px ${accent.ringStrong}, 0 6px 14px -4px ${accent.ring}, inset 0 1px 0 0 rgba(255,255,255,0.18)`,
          transform: `rotate(${heading}deg)`,
        }}
      >
        <ShipIcon
          className="size-4"
          style={{ transform: `rotate(${-heading}deg)` }}
        />
      </div>
    </div>
  );
}

function AisMarker({
  heading,
  sog,
  status,
  vesselName,
  vesselUrl,
}: {
  heading: number;
  sog: number;
  status: string | null;
  vesselName: string;
  vesselUrl: string;
}) {
  const { t } = useLocale();
  const title = [vesselName, status, `${sog} ${t("proj.map.marker.knots")}`]
    .filter(Boolean)
    .join(" · ");
  return (
    <div
      className="relative cursor-pointer"
      style={{ transform: "translate(-50%, -50%)" }}
      onClick={() => window.open(vesselUrl, "_blank")}
      title={title}
    >
      {/* --success, not the brand: this is the LIVE reported fix, and it has
          to stay separable at a glance from the brand-coloured planned
          position marker in every one of the ~14 palettes. Green also reads
          as "live / confirmed", which is exactly what an AIS fix is. */}
      <span
        className="absolute inset-0 -m-3 rounded-full blur-md animate-pulse"
        style={{ backgroundColor: "color-mix(in oklab, var(--success) 40%, transparent)" }}
      />
      <div
        className="relative size-9 rounded-full grid place-items-center text-white shadow-lg border-2"
        style={{
          transform: `rotate(${heading}deg)`,
          backgroundColor: "var(--success)",
          borderColor: "color-mix(in oklab, var(--success) 55%, white)",
        }}
      >
        <ShipIcon className="size-4" style={{ transform: `rotate(${-heading}deg)` }} />
      </div>
      <span
        className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded px-1 py-0.5 text-[9px] font-semibold text-white shadow"
        style={{ backgroundColor: "var(--success)" }}
      >
        AIS
      </span>
    </div>
  );
}

/** Pick the most recent populated discharge-port milestone for the
 *  varış-limanı chip. Once the vessel passes a stage we want the chip
 *  to reflect that — DP-ETA only stays visible while the voyage is
 *  still en route. Priority chain (most recent first):
 *    DP-ED > DP-SD > DP-NOR > DP-ETA.
 *  When all are null we still fall back to DP-ETA's slot (label +
 *  null date) so the layout doesn't shift. */
function pickLatestDpMilestone(
  ms: NonNullable<Project["vesselPlan"]>["milestones"]
): { date: string | null; label: string } {
  if (ms.dpEd) return { date: ms.dpEd, label: "DP-ED" };
  if (ms.dpSd) return { date: ms.dpSd, label: "DP-SD" };
  if (ms.dpNorAccepted) return { date: ms.dpNorAccepted, label: "DP-NOR" };
  return { date: ms.dpEta, label: "DP-ETA" };
}

function PortChip({
  kind,
  name,
  country,
  date,
  dateLabel,
}: {
  kind: "loading" | "discharge";
  name: string;
  country: string;
  date: string | null;
  dateLabel: string;
}) {
  const { t } = useLocale();
  const Icon = kind === "loading" ? Anchor : MapPin;
  // Same leg tokens as PortPin / the duration pills. This chip lives in a
  // GlassPanel (card surface), so the glyph deepens toward --foreground.
  const legToken = kind === "loading" ? "var(--warning)" : "var(--success)";
  return (
    <GlassPanel tone="strong" className="@container rounded-2xl flex-1 min-w-0 pointer-events-auto">
      <div className="px-2.5 py-2 flex items-center gap-2">
        <div
          className="size-7 @[140px]:size-9 rounded-xl grid place-items-center shrink-0"
          style={{
            backgroundColor: `color-mix(in oklab, ${legToken} 15%, transparent)`,
            color: `color-mix(in oklab, ${legToken} 70%, var(--foreground))`,
          }}
        >
          <Icon className="size-3.5 @[140px]:size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {kind === "loading" ? t("proj.map.chip.departure") : t("proj.map.chip.arrival")}
          </div>
          <div className="text-[12px] font-semibold break-words line-clamp-2 leading-tight">{name}</div>
          <div className="text-[10px] text-muted-foreground truncate">{country}</div>
        </div>
        <div className="text-right shrink-0 hidden @[160px]:block">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {dateLabel}
          </div>
          <div className="text-xs font-medium">{formatDate(date)}</div>
        </div>
      </div>
    </GlassPanel>
  );
}

interface MilestoneStripProps {
  ms: Project["vesselPlan"] extends infer V
    ? V extends { milestones: infer M }
      ? M
      : never
    : never;
  progress: number;
  /** Authoritative stage label, computed from milestone dates in the
   *  parent (`useRouteProgress`). The strip must use this rather than
   *  re-deriving from `progress` alone — otherwise the strip says "Yolda"
   *  while the header chip says "Varış limanında" once DP-ETA passes. */
  stage: string;
  onClose: () => void;
}

function MilestoneStrip({ ms, progress, stage, onClose }: MilestoneStripProps) {
  const { t } = useLocale();
  // Production-aligned 9-step voyage timeline. Order matches the D365
  // F&O screen (LP loading → BL → DP discharge) so the chip strip
  // reads the same as the source system.
  //
  // `tooltipTitle` + `tooltipBody` feed the Radix Tooltip that shows
  // when the user hovers on a step — abbreviations like "LP-ETA"
  // are operationally familiar but not self-explanatory, so each
  // chip explains itself in plain language (TR/EN via i18n).
  const steps: Array<{
    key: string;
    label: string;
    date: string | null;
    tooltipTitle: string;
    tooltipBody: string;
  }> = [
    {
      key: "lpEta",
      label: "LP-ETA",
      date: ms.lpEta,
      tooltipTitle: t("proj.map.ms.lpEta.title"),
      tooltipBody: t("proj.map.ms.lpEta.body"),
    },
    {
      key: "lpNor",
      label: "LP-NOR",
      date: ms.lpNorAccepted,
      tooltipTitle: t("proj.map.ms.lpNor.title"),
      tooltipBody: t("proj.map.ms.lpNor.body"),
    },
    {
      key: "lpSd",
      label: "LP-SD",
      date: ms.lpSd,
      tooltipTitle: t("proj.map.ms.lpSd.title"),
      tooltipBody: t("proj.map.ms.lpSd.body"),
    },
    {
      key: "lpEd",
      label: "LP-ED",
      date: ms.lpEd,
      tooltipTitle: t("proj.map.ms.lpEd.title"),
      tooltipBody: t("proj.map.ms.lpEd.body"),
    },
    {
      key: "bl",
      label: "BL",
      date: ms.blDate,
      tooltipTitle: t("proj.map.ms.bl.title"),
      tooltipBody: t("proj.map.ms.bl.body"),
    },
    {
      key: "dpEta",
      label: "DP-ETA",
      date: ms.dpEta,
      tooltipTitle: t("proj.map.ms.dpEta.title"),
      tooltipBody: t("proj.map.ms.dpEta.body"),
    },
    {
      key: "dpNor",
      label: "DP-NOR",
      date: ms.dpNorAccepted,
      tooltipTitle: t("proj.map.ms.dpNor.title"),
      tooltipBody: t("proj.map.ms.dpNor.body"),
    },
    {
      key: "dpSd",
      label: "DP-SD",
      date: ms.dpSd,
      tooltipTitle: t("proj.map.ms.dpSd.title"),
      tooltipBody: t("proj.map.ms.dpSd.body"),
    },
    {
      key: "dpEd",
      label: "DP-ED",
      date: ms.dpEd,
      tooltipTitle: t("proj.map.ms.dpEd.title"),
      tooltipBody: t("proj.map.ms.dpEd.body"),
    },
  ];
  const completedCount = steps.filter((s) => s.date).length;
  const pct = Math.round(progress * 100);

  return (
    <GlassPanel
      tone="strong"
      className="rounded-2xl pointer-events-auto animate-in fade-in-0 slide-in-from-bottom-2 duration-300"
    >
      <div className="px-3 pt-2.5 pb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {t("proj.map.timeline.title")}
            </span>
            <span className="text-[10px] font-semibold text-foreground/80 tabular-nums">
              {completedCount} / {steps.length}
            </span>
            <span className="text-[10px] text-muted-foreground">·</span>
            <span className="text-[10px] font-semibold text-[color-mix(in_oklab,var(--success)_70%,var(--foreground))] tabular-nums">
              %{pct} · {stageLabel(stage, t)}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("proj.map.timeline.close")}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="size-3.5" />
          </button>
        </div>

        {/* Tooltip provider — local instance keeps the strip's
            tooltips independent from the marker tooltips above
            (markers use the native `title` attribute per CLAUDE.md
            because Radix portals collide with react-map-gl's
            <Marker> portal). The strip is a regular DOM child of
            the glass panel, so Radix works fine here. */}
        <TooltipProvider delayDuration={150}>
          <div className="flex items-stretch gap-1">
            {steps.map((s, i) => {
              const done = !!s.date;
              const nextDone = i < steps.length - 1 && !!steps[i + 1].date;
              const isCurrent = done && !nextDone;
              return (
                <Tooltip key={s.key}>
                  <TooltipTrigger asChild>
                    <div
                      className="flex-1 min-w-0 flex flex-col items-center gap-1.5 cursor-help focus:outline-none rounded-md focus-visible:ring-2 focus-visible:ring-ring"
                      tabIndex={0}
                      aria-label={`${s.label} — ${s.tooltipTitle}`}
                    >
                      <div className="relative w-full flex items-center">
                        <div
                          className={cn(
                            "h-1.5 flex-1 rounded-full transition-colors",
                            done
                              ? isCurrent
                                ? "bg-gradient-to-r from-success to-success/70"
                                : "bg-success"
                              : "bg-muted"
                          )}
                        />
                        <div
                          className={cn(
                            "ml-1 size-4 shrink-0 rounded-full grid place-items-center transition-colors",
                            done
                              ? "bg-success text-[var(--success-foreground)]"
                              : "bg-muted text-muted-foreground/60 border border-border"
                          )}
                        >
                          {done ? (
                            <Check className="size-2.5" strokeWidth={3} />
                          ) : (
                            <Clock className="size-2.5" strokeWidth={2.5} />
                          )}
                        </div>
                      </div>
                      <div className="text-center min-w-0 w-full">
                        <div
                          className={cn(
                            "text-[9px] font-semibold uppercase tracking-wider truncate",
                            done ? "text-foreground" : "text-muted-foreground"
                          )}
                        >
                          {s.label}
                        </div>
                        <div
                          className={cn(
                            "text-[9px] tabular-nums truncate",
                            done
                              ? "text-muted-foreground"
                              : "text-muted-foreground/60"
                          )}
                        >
                          {s.date ? formatDate(s.date) : "—"}
                        </div>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    sideOffset={8}
                    className="max-w-[280px] px-3 py-2"
                  >
                    {/* Two-line tooltip: bold abbreviation + Turkish
                        title on top, full description below in a
                        muted tone. Date echoed at the bottom for
                        quick reference (so the user doesn't have to
                        re-read the chip). */}
                    <div className="flex items-center gap-1.5 text-[11.5px] font-semibold leading-tight">
                      <span className="font-mono text-[10.5px] text-muted-foreground/85 tracking-tight">
                        {s.label}
                      </span>
                      <span className="text-foreground">
                        · {s.tooltipTitle}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground leading-snug mt-1">
                      {s.tooltipBody}
                    </div>
                    <div className="text-[10.5px] tabular-nums text-foreground/80 mt-1.5 pt-1.5 border-t border-border/40">
                      {s.date
                        ? `${t("proj.map.timeline.dateLabel")}: ${formatDate(s.date)}`
                        : t("proj.map.timeline.dateMissing")}
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>
      </div>
    </GlassPanel>
  );
}
