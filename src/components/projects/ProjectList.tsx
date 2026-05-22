import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { ProjectCard } from "./ProjectCard";
import { ProjectQuickAsk } from "./ProjectQuickAsk";
import type { Project } from "@/lib/dataverse/entities";
import { useThemeAccent } from "@/components/layout/theme-accent";
import { cn } from "@/lib/utils";

interface ProjectListProps {
  /** Already-filtered project list — Vessel Projects page applies the
   *  unified `applyProjectFilter` upstream and passes the result here. */
  projects: Project[];
  /** Total before filtering — used for the count badge "X / Y" */
  totalCount?: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Slot rendered to the right of the search input — Vessel Projects
   *  passes the AdvancedFilter trigger here. Optional so other callers
   *  can keep the header search-only. */
  filterTrigger?: React.ReactNode;
  /** Slot rendered between the search input and `filterTrigger` —
   *  Vessel Projects uses this for the segment quick-pick so the
   *  most common filter dimension is one click away without
   *  opening the full AdvancedFilter popover. */
  segmentTrigger?: React.ReactNode;
}

/**
 * Stateless search + select list of projects. The categorical /
 * period filtering happens at the page level via the unified
 * `AdvancedFilter` + `PeriodFilter` components, so this component
 * only deals with the free-text search box and the card stack.
 */
export function ProjectList({
  projects,
  totalCount,
  selectedId,
  onSelect,
  filterTrigger,
  segmentTrigger,
}: ProjectListProps) {
  const accent = useThemeAccent();
  const [query, setQuery] = React.useState("");
  const [quickAsk, setQuickAsk] = React.useState<{
    project: Project;
    x: number;
    y: number;
  } | null>(null);

  // Sort already applied by ProjectsPage (segment ASC + projectNo
  // DESC) so `projects[0]` there matches `visible[0]` here — the
  // page-level auto-select effect depends on this parity. Here we
  // only do free-text search narrowing; order is preserved.
  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => {
      const haystack = [
        p.projectNo,
        p.projectName,
        p.projectGroup,
        p.vesselPlan?.vesselName,
        p.vesselPlan?.loadingPort.name,
        p.vesselPlan?.dischargePort.name,
        p.vesselPlan?.supplier,
        p.vesselPlan?.buyer,
        p.segment,
        ...p.lines.map((l) => l.productName),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [projects, query]);

  const total = totalCount ?? projects.length;

  return (
    <GlassPanel
      tone="default"
      className="rounded-2xl flex flex-col h-full overflow-hidden"
    >
      <div className="px-3 pt-3 pb-2 shrink-0">
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            Projeler
            <span
              className="inline-flex items-center gap-0.5 h-5 px-2 rounded-full text-[11px] font-bold tabular-nums"
              style={{
                backgroundColor: accent.tint,
                color: accent.solid,
                boxShadow: `inset 0 0 0 1px ${accent.ring}`,
              }}
            >
              {visible.length}
              {visible.length !== total && (
                <span className="opacity-60">/{total}</span>
              )}
            </span>
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <HugeiconsIcon
              icon={Search01Icon}
              size={15}
              strokeWidth={2.25}
              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-[1]"
              style={{ color: accent.solid }}
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Proje, gemi, liman, tedarikçi..."
              className={cn(
                "w-full h-9 pl-9 pr-7 rounded-full text-[13px] outline-none",
                "bg-white/70 backdrop-blur-xl backdrop-saturate-150",
                "ring-1 ring-foreground/15 hover:ring-foreground/30 focus:ring-2 focus:ring-ring",
                "placeholder:text-muted-foreground/70 transition-shadow"
              )}
              style={{
                boxShadow:
                  "0 4px 12px -4px rgba(15,23,42,0.18), inset 0 1px 0 0 rgba(255,255,255,0.85)",
              }}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Aramayı temizle"
                className="absolute right-2 top-1/2 -translate-y-1/2 size-5 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06] z-[1]"
              >
                <HugeiconsIcon icon={Cancel01Icon} size={11} strokeWidth={2.5} />
              </button>
            )}
          </div>
          {segmentTrigger}
          {filterTrigger}
        </div>
      </div>

      <div className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden px-2 pb-3 space-y-1.5">
        {visible.map((p) => (
          <ProjectCard
            key={p.projectNo}
            project={p}
            selected={selectedId === p.projectNo}
            onClick={() => onSelect(p.projectNo)}
            onQuickAsk={(e, project) =>
              setQuickAsk({ project, x: e.clientX, y: e.clientY })
            }
          />
        ))}
        {visible.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-8">
            Sonuç bulunamadı
          </div>
        )}
      </div>

      {quickAsk && (
        <ProjectQuickAsk
          project={quickAsk.project}
          anchor={{ x: quickAsk.x, y: quickAsk.y }}
          onClose={() => setQuickAsk(null)}
          onSelectProject={() => onSelect(quickAsk.project.projectNo)}
        />
      )}
    </GlassPanel>
  );
}
