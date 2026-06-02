import * as React from "react";
import type { Project } from "@/lib/dataverse/entities";
import { shouldUseMock } from "@/lib/dataverse";
import { mockPositionReceivedAt } from "@/mocks/vesselPositions";

const WORKER_URL = ((import.meta.env.VITE_VESSEL_WORKER_URL as string | undefined) ?? "").replace(/\/$/, "");

export interface VesselPosition {
  projectNo: string;
  name: string;
  imo: string;
  lat: number;
  lon: number;
  sog: number;
  cog: number;
  status: string | null;
  flag: string | null;
  vesselUrl: string;
  /** Actual AIS report time (UTC) — drives staleness. Null if unparsed. */
  positionReceivedAt: string | null;
  updatedAt: string;
  error?: string;
}

export type FetchStatus = "idle" | "loading" | "done" | "error";

export function useVesselPositions(projects: Project[]) {
  const [positions, setPositions] = React.useState<VesselPosition[]>([]);
  const [status, setStatus] = React.useState<FetchStatus>("idle");
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);

  const refresh = React.useCallback(async () => {
    // Local dev (mock mode): synthesize positions at the LP→DP midpoint with
    // a deterministic fresh/stale age per project, so the map shows live
    // markers AND the "1 aydan eski" stale list without a worker. Mock
    // projects mostly lack real IMOs, so we don't gate on imoNumber here.
    if (shouldUseMock()) {
      setStatus("loading");
      const now = new Date();
      const mock = projects
        .filter((p) => p.vesselPlan?.vesselName)
        .map((p) => {
          const lp = p.vesselPlan!.loadingPort;
          const dp = p.vesselPlan!.dischargePort;
          return {
            projectNo: p.projectNo,
            name: p.vesselPlan!.vesselName,
            imo: p.vesselPlan!.imoNumber ?? "—",
            lat: (lp.lat + dp.lat) / 2,
            lon: (lp.lon + dp.lon) / 2,
            sog: 12.5,
            cog: 60,
            status: "Under way (mock)",
            flag: null,
            vesselUrl: "#",
            positionReceivedAt: mockPositionReceivedAt(p.projectNo, now),
            updatedAt: now.toISOString(),
          } satisfies VesselPosition;
        })
        .filter((p) => !(p.lat === 0 && p.lon === 0));
      await new Promise((r) => setTimeout(r, 500));
      setPositions(mock);
      setLastUpdated(new Date());
      setStatus("done");
      return;
    }

    const candidates = projects.filter(
      (p) => p.vesselPlan?.imoNumber && p.vesselPlan?.vesselName
    );

    if (candidates.length === 0) return;

    setStatus("loading");

    const results = await Promise.allSettled(
      candidates.map(async (p) => {
        const imo = p.vesselPlan!.imoNumber!;
        const name = p.vesselPlan!.vesselName;
        const url = `${WORKER_URL}?name=${encodeURIComponent(name)}&imo=${encodeURIComponent(imo)}`;
        const res = await fetch(url);
        const data = await res.json();

        if (!res.ok || data.error) {
          return {
            projectNo: p.projectNo,
            name,
            imo,
            lat: 0,
            lon: 0,
            sog: 0,
            cog: 0,
            status: null,
            flag: null,
            vesselUrl: "",
            positionReceivedAt: null,
            updatedAt: new Date().toISOString(),
            error: data.error ?? "Bilinmeyen hata",
          } satisfies VesselPosition;
        }

        return {
          projectNo: p.projectNo,
          ...data,
        } satisfies VesselPosition;
      })
    );

    const resolved = results
      .filter((r): r is PromiseFulfilledResult<VesselPosition> => r.status === "fulfilled")
      .map((r) => r.value);

    setPositions(resolved);
    setLastUpdated(new Date());
    setStatus("done");
  }, [projects]);

  return { positions, status, lastUpdated, refresh };
}
