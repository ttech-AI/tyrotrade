import * as React from "react";
import { ArrowRight, Route, Ship } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { BubbleChatIcon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { type Project } from "@/lib/dataverse/entities";
import { useThemeAccent } from "@/components/layout/theme-accent";
import { TYRO_CHAT_TONE } from "@/components/layout/TyroChatButton";

interface ProjectCardProps {
  project: Project;
  selected: boolean;
  onClick: () => void;
  onQuickAsk?: (e: React.MouseEvent, project: Project) => void;
}


const STATUS_TONE: Record<
  string,
  { dot: string; ring: string; label: string }
> = {
  Commenced: {
    dot: "bg-amber-500",
    ring: "ring-amber-500/30",
    label: "text-amber-700",
  },
  Completed: {
    dot: "bg-emerald-500",
    ring: "ring-emerald-500/30",
    label: "text-emerald-700",
  },
  // "Open" comes from the project-level status fallback when no vessel
  // status is set (legacy projects, mock data).
  Open: {
    dot: "bg-sky-500",
    ring: "ring-sky-500/30",
    label: "text-sky-700",
  },
  Closed: {
    dot: "bg-slate-400",
    ring: "ring-slate-400/30",
    label: "text-slate-600",
  },
  // Voyage-level statuses surfaced from F&O when the option-set carries
  // a value (or the option-set code defaults to "To Be Nominated" via
  // composer fallback). Each tone matches the Aktif Pipeline tile's
  // segment palette so the card chip and the dashboard pipeline bar
  // read in the same colour family.
  "To Be Nominated": {
    dot: "bg-violet-500",
    ring: "ring-violet-500/30",
    label: "text-violet-700",
  },
  Nominated: {
    dot: "bg-indigo-500",
    ring: "ring-indigo-500/30",
    label: "text-indigo-700",
  },
  Cancelled: {
    dot: "bg-rose-500",
    ring: "ring-rose-500/30",
    label: "text-rose-700",
  },
};

const FALLBACK_TONE = {
  dot: "bg-slate-400",
  ring: "ring-slate-400/30",
  label: "text-slate-600",
};

export function ProjectCard({ project, selected, onClick, onQuickAsk }: ProjectCardProps) {
  const accent = useThemeAccent();
  // Use vessel voyage status when present; fall back to project Open/Closed.
  const status = project.vesselPlan?.vesselStatus ?? project.status;
  const tone = STATUS_TONE[status] ?? FALLBACK_TONE;
  const lp = project.vesselPlan?.loadingPort.name;
  const dp = project.vesselPlan?.dischargePort.name;
  // Gemi adı — numeric-only RecID sızıntısı (F&O) ve "—" placeholder'ı
  // ele; gerçek gemi adı yoksa satır hiç render edilmez.
  const rawVessel = project.vesselPlan?.vesselName ?? "";
  const vesselName =
    rawVessel && rawVessel !== "—" && !/^\d[\d\s,.]*$/.test(rawVessel.trim())
      ? rawVessel
      : null;

  return (
    <div className="relative group">
    <button
      type="button"
      onClick={onClick}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "group relative w-full min-w-0 max-w-full text-left rounded-xl px-3 py-2.5 transition-colors overflow-hidden",
        "border outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
        selected
          ? "border-transparent"
          : "bg-card/40 border-border/60 hover:bg-card/70 hover:border-border"
      )}
      style={
        selected
          ? {
              boxShadow: `inset 0 0 0 1px ${accent.ring}`,
              backgroundColor: accent.tint,
            }
          : undefined
      }
    >
      {/* Selected — gradient mesh that fades inward from the left edge.
          Stays within ~28px so it doesn't bleed across the card surface. */}
      {selected && (
        <>
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 w-7 pointer-events-none"
            style={{
              background: `linear-gradient(90deg, ${accent.tint}, transparent)`,
            }}
          />
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 w-[3px] pointer-events-none"
            style={{ background: accent.gradient }}
          />
        </>
      )}

      {/* Row 1 — meta: status dot, project no, segment */}
      <div className="relative flex items-center gap-1.5 min-w-0 text-[11.5px]">
        <span
          className={cn(
            "size-2 rounded-full ring-2 shrink-0",
            tone.dot,
            tone.ring
          )}
          aria-hidden
        />
        <span className="font-mono text-muted-foreground tracking-tight truncate min-w-0">
          {project.projectNo}
        </span>
        {project.segment && (
          <>
            <span className="text-muted-foreground/80 shrink-0">·</span>
            <span className="text-muted-foreground/80 truncate min-w-0">
              {project.segment}
            </span>
          </>
        )}
      </div>

      {/* Row 2 — title. Tam wrap: ellipsis YOK, ad sığmazsa aşağı
          satıra kayar (panel genişledi, çok satırlı adlar artık
          tamamen okunur). */}
      <h3 className="relative text-[14.5px] font-semibold leading-snug mt-1 break-words">
        {project.projectName}
      </h3>

      {/* Row 3 — route (kalkış → varış limanı). */}
      <div className="relative mt-1.5 flex items-center gap-1.5 min-w-0 text-[11.5px] text-muted-foreground">
        <Route
          className="size-3 shrink-0 opacity-60 text-muted-foreground"
          strokeWidth={2}
          aria-hidden
        />
        <span className="truncate min-w-0">{lp}</span>
        <ArrowRight className="size-3 shrink-0 opacity-50" />
        <span className="truncate min-w-0">{dp}</span>
        {/* Gemi adı yoksa rota en alt satır olur — chat ikonu (hover)
            altında metin kalmasın diye reserved trailing slot. */}
        {!vesselName && <span className="ml-auto size-6 shrink-0" aria-hidden />}
      </div>

      {/* Row 4 — gemi adı (yalnızca gerçek bir ad varsa). Rotanın
          hemen altında, çapa/gemi ikonuyla. Trailing slot, hover'da
          beliren TYRO Chat ikonunun altına metin kaçmasın diye. */}
      {vesselName && (
        <div className="relative mt-1 flex items-center gap-1.5 min-w-0 text-[11.5px] text-muted-foreground">
          <Ship
            className="size-3 shrink-0 opacity-60 text-muted-foreground"
            strokeWidth={2}
            aria-hidden
          />
          <span className="truncate min-w-0 font-medium text-foreground/70">
            {vesselName}
          </span>
          {/* Reserved trailing slot — chat ikonu boyutunda, hover'da
              metin reflow olmasın. */}
          <span className="ml-auto size-6 shrink-0" aria-hidden />
        </div>
      )}

      {/* Status caption — only shown when selected */}
      {selected && (
        <div className="relative mt-1.5 text-[10.5px] uppercase tracking-wider">
          <span className={cn("font-semibold", tone.label)}>{status}</span>
        </div>
      )}

    </button>

    {onQuickAsk && (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onQuickAsk(e, project); }}
        aria-label="TYRO Chat'te sor"
        // Positioned at the route row's trailing edge — replaces the
        // tonnage display the user retired. Hover-only so the card
        // stays calm by default but the chat affordance is one
        // pixel away when the user mouses in.
        className="absolute bottom-2 right-2 size-6 rounded-lg grid place-items-center text-white shadow-md transition-transform opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95"
        style={{
          background: TYRO_CHAT_TONE.gradient,
          boxShadow: `0 3px 8px -2px ${TYRO_CHAT_TONE.ring}`,
        }}
      >
        <HugeiconsIcon icon={BubbleChatIcon} size={12} strokeWidth={2} />
      </button>
    )}
    </div>
  );
}
