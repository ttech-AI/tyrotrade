import * as React from "react";
import { motion } from "framer-motion";
import { Layers } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { ProjectCard } from "./ProjectCard";
import { ProjectQuickAsk } from "./ProjectQuickAsk";
import type { Project } from "@/lib/dataverse/entities";
import { useThemeAccent } from "@/components/layout/theme-accent";
import { cn } from "@/lib/utils";

/** Width-toggle easing for the search ↔ segment expand/collapse. Short
 *  so any framer `layout` size interpolation reads as a snap-with-ease,
 *  not a slow morph. */
const TOGGLE_TRANSITION = { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const };

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
   *  opening the full AdvancedFilter popover. When provided, the search
   *  box + segment collapse into a mutually-exclusive expand/collapse
   *  toggle (one expanded, the other an icon). */
  segmentTrigger?: React.ReactNode;
  /** How many segments are currently selected — drives the active-value
   *  dot on the segment's collapsed icon so the user sees a filter is
   *  live even while it's collapsed. */
  segmentSelectedCount?: number;
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
  segmentSelectedCount,
}: ProjectListProps) {
  const accent = useThemeAccent();
  const [query, setQuery] = React.useState("");
  // Which of the two quick-fields is expanded. Default "segment" — it's
  // the primary slice for the weekly per-team triage; search starts as
  // a collapsed icon to its left. Only relevant when `segmentTrigger`
  // is supplied; search-only callers ignore it.
  const [activeField, setActiveField] = React.useState<"search" | "segment">(
    "segment"
  );
  const searchRef = React.useRef<HTMLInputElement>(null);
  // Focus the input the moment search expands so the user can type
  // immediately after clicking the collapsed search icon.
  React.useEffect(() => {
    if (activeField === "search") searchRef.current?.focus();
  }, [activeField]);
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

  // Expanded search field — shared by the toggle layout (segment present)
  // and the plain full-width layout (search-only callers).
  const searchInput = (
    <div className="relative w-full min-w-0">
      <HugeiconsIcon
        icon={Search01Icon}
        size={16}
        strokeWidth={2.25}
        className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-[1]"
        style={{ color: accent.solid }}
      />
      <input
        ref={searchRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Proje, gemi, liman, tedarikçi..."
        className={cn(
          // İkon 16px + yazı 14px (best-practice), pl-10 ile ikon↔metin
          // arası ferah boşluk. Segment quick-pick ile aynı dil.
          "w-full h-9 pl-10 pr-7 rounded-full text-[14px] outline-none",
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
  );

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
        {segmentTrigger ? (
          // Search ↔ Segment toggle: only ONE is expanded at a time, the
          // other collapses to an icon. Click a collapsed icon to expand
          // it (and collapse the sibling). Search sits left of segment;
          // the AdvancedFilter trigger stays pinned right. framer `layout`
          // animates the width hand-off.
          <div className="flex items-center gap-1.5">
            <motion.div
              layout
              transition={TOGGLE_TRANSITION}
              className={activeField === "search" ? "flex-1 min-w-0" : "shrink-0"}
            >
              {activeField === "search" ? (
                searchInput
              ) : (
                <CollapsedFieldButton
                  label="Ara"
                  hasValue={query.trim().length > 0}
                  accent={accent}
                  onClick={() => setActiveField("search")}
                  icon={
                    <HugeiconsIcon
                      icon={Search01Icon}
                      size={16}
                      strokeWidth={2.25}
                    />
                  }
                />
              )}
            </motion.div>
            <motion.div
              layout
              transition={TOGGLE_TRANSITION}
              className={
                activeField === "segment" ? "flex-1 min-w-0" : "shrink-0"
              }
            >
              {activeField === "segment" ? (
                <div className="w-full min-w-0">{segmentTrigger}</div>
              ) : (
                <CollapsedFieldButton
                  label="Segment"
                  hasValue={(segmentSelectedCount ?? 0) > 0}
                  accent={accent}
                  onClick={() => setActiveField("segment")}
                  icon={<Layers className="size-4" strokeWidth={2.25} />}
                />
              )}
            </motion.div>
            {filterTrigger}
          </div>
        ) : (
          // Search-only callers: plain full-width search + optional filter.
          <div className="flex items-center gap-1.5">
            <div className="flex-1 min-w-0">{searchInput}</div>
            {filterTrigger}
          </div>
        )}
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

/**
 * Collapsed state of a quick-field (search or segment) — a circular icon
 * button matching the raised/glass aesthetic of the expanded fields.
 * Carries an accent-coloured active dot when the (hidden) field has a
 * live value so the user knows a filter is applied even while collapsed.
 */
function CollapsedFieldButton({
  icon,
  label,
  hasValue,
  onClick,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  hasValue: boolean;
  onClick: () => void;
  accent: ReturnType<typeof useThemeAccent>;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "relative h-9 w-9 grid place-items-center rounded-full shrink-0",
        "bg-white/70 backdrop-blur-xl backdrop-saturate-150",
        "ring-1 ring-foreground/15 hover:ring-foreground/30 transition-shadow"
      )}
      style={{
        boxShadow:
          "0 4px 12px -4px rgba(15,23,42,0.18), inset 0 1px 0 0 rgba(255,255,255,0.85)",
      }}
    >
      <span style={{ color: accent.solid }} className="grid place-items-center">
        {icon}
      </span>
      {hasValue && (
        <span
          aria-hidden
          className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-white"
          style={{ backgroundColor: accent.solid }}
        />
      )}
    </button>
  );
}
