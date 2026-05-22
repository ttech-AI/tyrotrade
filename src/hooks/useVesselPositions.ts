import * as React from "react";
import type { Project } from "@/lib/dataverse/entities";

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
  updatedAt: string;
  error?: string;
}

export type FetchStatus = "idle" | "loading" | "done" | "error";

export function useVesselPositions(projects: Project[]) {
  const [positions, setPositions] = React.useState<VesselPosition[]>([]);
  const [status, setStatus] = React.useState<FetchStatus>("idle");
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);

  const refresh = React.useCallback(async () => {
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
