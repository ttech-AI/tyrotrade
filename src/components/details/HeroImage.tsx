import { Ship, Truck, Anchor, Hash } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { isSea, type Project } from "@/lib/dataverse/entities";

interface HeroImageProps {
  project: Project;
}

const FALLBACK_SEA =
  "https://images.unsplash.com/photo-1577416412292-747c6607f055?auto=format&fit=crop&w=1200&q=80";
const FALLBACK_ROAD =
  "https://images.unsplash.com/photo-1532330393533-443990a51d10?auto=format&fit=crop&w=1200&q=80";

export function HeroImage({ project }: HeroImageProps) {
  const sea = isSea(project);
  const Icon = sea ? Ship : Truck;
  const url =
    project.vesselPlan?.heroImageUrl ?? (sea ? FALLBACK_SEA : FALLBACK_ROAD);
  // Defensive guard: numeric-only strings (RecID leak from F&O) are
  // not real vessel names — show the em-dash placeholder instead.
  const rawName = project.vesselPlan?.vesselName ?? "";
  const name =
    rawName && rawName !== "—" && !/^\d[\d\s,.]*$/.test(rawName.trim())
      ? rawName
      : "—";
  const fixture = project.vesselPlan?.fixtureId;

  // Voyage status when known, otherwise fall back to project Open/Closed.
  const status = project.vesselPlan?.vesselStatus ?? project.status;
  const statusVariant: Record<string, "warning" | "success" | "info" | "muted"> = {
    "To Be Nominated": "warning",
    Nominated: "info",
    Commenced: "success",
    Completed: "success",
    Open: "info",
    Closed: "muted",
  };

  return (
    <GlassPanel tone="default" className="rounded-2xl overflow-hidden relative">
      <div className="relative h-44">
        <img
          src={url}
          alt={name}
          className="absolute inset-0 size-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-3 flex items-end gap-3 text-white">
          <div
            className={cn(
              "size-10 rounded-2xl bg-white/15 backdrop-blur-md grid place-items-center border border-white/25"
            )}
          >
            <Icon className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-wider text-white/75">
              {sea ? "Vessel" : "Vehicle"}
            </div>
            <div className="text-lg font-semibold leading-tight truncate">
              {name}
            </div>
          </div>
          <Badge variant={statusVariant[status] ?? "muted"} className="shrink-0">
            {status}
          </Badge>
        </div>
      </div>
      <div className="px-3 py-2.5 flex items-center gap-3 text-xs text-muted-foreground border-t border-border/40">
        {fixture && (
          <span className="inline-flex items-center gap-1.5">
            <Hash className="size-3.5" />
            <span className="font-mono">{fixture}</span>
          </span>
        )}
        {project.vesselPlan && (
          <span className="inline-flex items-center gap-1.5 ml-auto">
            <Anchor className="size-3.5" />
            <span>Sefer {project.vesselPlan.voyage}</span>
          </span>
        )}
      </div>
    </GlassPanel>
  );
}
