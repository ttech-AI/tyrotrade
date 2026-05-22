import * as React from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useProjects } from "@/hooks/useProjects";
import { useVesselPositions, type VesselPosition } from "@/hooks/useVesselPositions";
import { Button } from "@/components/ui/button";
import { RefreshCw, Ship, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// Fix Leaflet default marker icons (webpack/vite asset issue)
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function createShipIcon(cog: number) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <g transform="rotate(${cog}, 16, 16)">
      <polygon points="16,4 22,28 16,24 10,28" fill="#0ea5e9" stroke="white" stroke-width="1.5"/>
    </g>
  </svg>`;
  return L.divIcon({
    html: svg,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    className: "",
  });
}

function VesselMap({ positions }: { positions: VesselPosition[] }) {
  const mapRef = React.useRef<HTMLDivElement>(null);
  const leafletRef = React.useRef<L.Map | null>(null);
  const markersRef = React.useRef<L.Marker[]>([]);

  React.useEffect(() => {
    if (!mapRef.current || leafletRef.current) return;
    leafletRef.current = L.map(mapRef.current).setView([20, 20], 2);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
    }).addTo(leafletRef.current);
  }, []);

  React.useEffect(() => {
    const map = leafletRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const active = positions.filter((p) => !p.error && p.lat !== 0);

    active.forEach((p) => {
      const marker = L.marker([p.lat, p.lon], { icon: createShipIcon(p.cog) })
        .addTo(map)
        .bindPopup(
          `<div style="min-width:180px">
            <strong>${p.name}</strong><br/>
            <span style="color:#64748b;font-size:12px">${p.projectNo}</span><br/><br/>
            <b>Hız:</b> ${p.sog} knot<br/>
            <b>Rota:</b> ${p.cog}°<br/>
            ${p.status ? `<b>Durum:</b> ${p.status}<br/>` : ""}
            ${p.flag ? `<b>Bayrak:</b> ${p.flag}<br/>` : ""}
            <br/>
            <a href="${p.vesselUrl}" target="_blank" style="color:#0ea5e9">myshiptracking.com →</a>
          </div>`
        );
      markersRef.current.push(marker);
    });

    if (active.length > 0) {
      const group = L.featureGroup(markersRef.current);
      map.fitBounds(group.getBounds().pad(0.2));
    }
  }, [positions]);

  return <div ref={mapRef} className="h-full w-full rounded-xl" />;
}

export function VesselMapPage() {
  const { projects } = useProjects();
  const { positions, status, lastUpdated, refresh } = useVesselPositions(projects);

  const activeCount = positions.filter((p) => !p.error).length;
  const errorCount = positions.filter((p) => p.error).length;

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Vessel Map</h1>
          {lastUpdated && (
            <p className="text-sm text-muted-foreground">
              Son güncelleme: {lastUpdated.toLocaleTimeString("tr-TR")}
              {activeCount > 0 && ` · ${activeCount} gemi`}
              {errorCount > 0 && ` · ${errorCount} bulunamadı`}
            </p>
          )}
        </div>
        <Button
          onClick={refresh}
          disabled={status === "loading"}
          className="gap-2"
        >
          <RefreshCw className={cn("size-4", status === "loading" && "animate-spin")} />
          {status === "loading" ? "Güncelleniyor..." : "Veriyi Güncelle"}
        </Button>
      </div>

      {/* Map */}
      <div className="relative flex-1 overflow-hidden rounded-xl border bg-muted/30">
        {status === "idle" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Ship className="size-12 opacity-30" />
            <p className="text-sm">Gemilerin konumunu görmek için &ldquo;Veriyi Güncelle&rdquo; butonuna bas.</p>
          </div>
        )}
        {(status === "done" || status === "loading") && (
          <VesselMap positions={positions} />
        )}
      </div>

      {/* Error list */}
      {errorCount > 0 && status === "done" && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <div className="mb-1 flex items-center gap-2 text-sm font-medium text-destructive">
            <AlertCircle className="size-4" />
            Konum alınamayan gemiler
          </div>
          <ul className="space-y-0.5 text-xs text-muted-foreground">
            {positions
              .filter((p) => p.error)
              .map((p) => (
                <li key={p.imo}>
                  {p.name} ({p.imo}) — {p.error}
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
