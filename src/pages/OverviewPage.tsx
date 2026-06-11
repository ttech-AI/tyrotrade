import * as React from "react";
import { useProjects } from "@/hooks/useProjects";
import { ProjectsEmptyState } from "@/components/projects/ProjectsEmptyState";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AdvancedFilter } from "@/components/filters/AdvancedFilter";
import {
  applyProjectFilter,
  makeEmptyFilters,
  type ProjectFilterState,
} from "@/lib/filters/projectFilters";
import {
  aggregateGroups,
  aggregateVoyageStatuses,
  buildGroupSegmentColumns,
  buildSegmentMatrix,
  segmentsForGroup,
  selectPendingPayments,
  selectWaitingVessels,
  voyageDisplayLabel,
  GROUP_META,
  type VesselGroup,
} from "@/lib/selectors/overview";
import { OverviewKpis } from "@/components/overview/OverviewKpis";
import {
  OverviewInsights,
  type OverviewInsight,
} from "@/components/overview/OverviewInsights";
import { VoyageStatusDonutCard } from "@/components/overview/VoyageStatusDonutCard";
import { SegmentMatrixCard } from "@/components/overview/SegmentMatrixCard";
import { LongestWaitingCard } from "@/components/overview/LongestWaitingCard";
import { GroupSegmentColumns } from "@/components/overview/GroupSegmentColumns";
import { PendingPaymentsCard } from "@/components/overview/PendingPaymentsCard";
import { formatCurrency, formatNumber } from "@/lib/format";

/** Vessel-overview scope is FIXED to ship-plan projects — the page
 *  counts "gemi projesi"; Karayolu/Konteyner rows without a vessel plan
 *  would inflate the group totals with non-voyage projects. There is NO
 *  UI to widen this (the AdvancedFilter ship-plan toggle was retired
 *  repo-wide); the scope is a deliberate page semantic, mirrored to
 *  AdvancedFilter via `shipPlanDefault` so the filter badge doesn't
 *  count it as a user edit. Note: `PROJECT_ID_EXCEPTIONS` (ORGANIK01)
 *  bypass the ship-plan gate inside `applyProjectFilter` by design, so
 *  the allowlisted project still appears. */
const OVERVIEW_SHIP_PLAN_DEFAULT = false;

/** Fresh-visit voyage-status narrowing — IDENTICAL to Sefer Takibi's
 *  `PROJECTS_DEFAULT_VOYAGE_STATUSES` (ProjectsPage.tsx): the overview
 *  opens on the ACTIVE pipeline (To Be Nominated + Nominated +
 *  Commenced); Completed/Closed/Cancelled stay hidden until the user
 *  widens the filter. Kept as a local mirror instead of an import so
 *  the lazy route chunks don't merge; update BOTH together. */
const OVERVIEW_DEFAULT_VOYAGE_STATUSES = [
  "To Be Nominated",
  "Nominated",
  "Commenced",
] as const;

/**
 * Genel Bakış — vessel-project group & segment overview.
 *
 * Mirrors the reference BI report (KPI row · group donut · segment ×
 * group matrix · longest-waiting vessel · per-group segment columns ·
 * payment-pending list) rebuilt in the app's liquid-glass design
 * language on the unified filter system. Aggregate cards filter
 * IN-PLACE: clicking a group / segment / status applies that filter to
 * this page's own state (toggle on re-click, hero resets); only the
 * single-project rows (longest-waiting, pending payments) deep-link
 * into Sefer Takibi.
 *
 * Grouping rule: segment "Organik*" / "Sunrise*" → Organik · "Tahıl*" /
 * "Danem*" → Anadolu · everything else → International (see
 * selectors/overview.ts).
 */
export function OverviewPage() {
  const { projects: rawProjects, isEmpty, fetchedAt } = useProjects();
  const [filters, setFilters] = React.useState<ProjectFilterState>(() => {
    const base = makeEmptyFilters({
      includeWithoutShipPlan: OVERVIEW_SHIP_PLAN_DEFAULT,
      period: "all",
    });
    return {
      ...base,
      voyageStatuses: new Set(OVERVIEW_DEFAULT_VOYAGE_STATUSES),
    };
  });
  const now = React.useMemo(() => new Date(), []);

  const projects = React.useMemo(
    () => applyProjectFilter(rawProjects, filters, now),
    [rawProjects, filters, now]
  );

  const agg = React.useMemo(() => aggregateGroups(projects), [projects]);
  const statusAgg = React.useMemo(
    () => aggregateVoyageStatuses(projects),
    [projects]
  );
  const matrix = React.useMemo(
    () => buildSegmentMatrix(projects, 6),
    [projects]
  );
  const groupColumns = React.useMemo(
    () => buildGroupSegmentColumns(projects, 5),
    [projects]
  );
  const waiting = React.useMemo(
    () => selectWaitingVessels(projects, now),
    [projects, now]
  );
  // High maxRows — the card itself collapses to 5 with a "Daha fazla
  // göster" toggle, so we hand it the full list.
  const pending = React.useMemo(
    () => selectPendingPayments(projects, now, 200),
    [projects, now]
  );

  /* ─── In-page filter handlers — clicking a group / segment / status
     applies the filter ON THIS PAGE (no navigation): every card, the
     donut and the matrix instantly recompute for the clicked slice.
     Clicking the same selection again TOGGLES it back off, and the
     hero card resets everything to the fresh-visit defaults. Project
     rows (longest-waiting, pending payments) still deep-link into
     Sefer Takibi — those are single-project detail jumps. */
  const sameSet = (current: Set<string>, target: string[]) =>
    current.size === target.length && target.every((t) => current.has(t));
  const applySegments = React.useCallback(
    (segments: string[]) => {
      if (segments.length === 0) return;
      setFilters((f) => ({
        ...f,
        segments: sameSet(f.segments, segments)
          ? new Set<string>()
          : new Set(segments),
      }));
    },
    []
  );
  const openAllProjects = React.useCallback(() => {
    // Hero = "show everything" → reset to the fresh-visit defaults.
    setFilters(() => {
      const base = makeEmptyFilters({
        includeWithoutShipPlan: OVERVIEW_SHIP_PLAN_DEFAULT,
        period: "all",
      });
      return {
        ...base,
        voyageStatuses: new Set(OVERVIEW_DEFAULT_VOYAGE_STATUSES),
      };
    });
  }, []);
  const openGroup = React.useCallback(
    (group: VesselGroup) => {
      // Group → its segment set, derived from the RAW project list so a
      // group click works even while another group's filter is active.
      applySegments(segmentsForGroup(rawProjects, group));
    },
    [applySegments, rawProjects]
  );
  const openSegment = React.useCallback(
    (segment: string) => applySegments([segment]),
    [applySegments]
  );
  const openWaiting = React.useCallback(() => {
    setFilters((f) => ({
      ...f,
      voyageStatuses: sameSet(f.voyageStatuses, [
        "To Be Nominated",
        "Nominated",
      ])
        ? new Set(OVERVIEW_DEFAULT_VOYAGE_STATUSES)
        : new Set(["To Be Nominated", "Nominated"]),
    }));
  }, []);
  const openStatus = React.useCallback((status: string) => {
    // Slice click narrows to that single status; clicking it again
    // restores the default active-pipeline trio.
    setFilters((f) => ({
      ...f,
      voyageStatuses: sameSet(f.voyageStatuses, [status])
        ? new Set(OVERVIEW_DEFAULT_VOYAGE_STATUSES)
        : new Set([status]),
    }));
  }, []);

  const insights = React.useMemo<OverviewInsight[]>(() => {
    const out: OverviewInsight[] = [];
    const topGroup = [...agg.rows].sort((a, b) => b.count - a.count)[0];
    if (topGroup && topGroup.count > 0) {
      out.push({
        color: GROUP_META[topGroup.group].solid,
        lead: "En büyük grup",
        tail: `${GROUP_META[topGroup.group].label} · ${topGroup.count} proje (%${formatNumber(topGroup.pct, 1)})`,
        onClick: () => openGroup(topGroup.group),
      });
    }
    const topSegment = matrix.rows[0];
    if (topSegment) {
      out.push({
        color: "#0284c7",
        lead: "En yoğun segment",
        tail: `${topSegment.segment} · ${topSegment.total} proje`,
        onClick: () => openSegment(topSegment.segment),
      });
    }
    if (waiting.length > 0) {
      out.push({
        color: "#f59e0b",
        lead: "Bekleyen sefer",
        tail: `${waiting.length} gemi atama/yükleme bekliyor · en uzun ${waiting[0].days} gün (${voyageDisplayLabel(waiting[0].project)})`,
        onClick: openWaiting,
      });
    }
    if (pending.count > 0) {
      out.push({
        color: "#e11d48",
        lead: "Ödeme bekleyen",
        tail: `${pending.count} sefer · ${formatCurrency(pending.totalUsd, "USD", { maximumFractionDigits: 0 })}`,
      });
    }
    return out;
  }, [agg.rows, matrix.rows, waiting, pending, openGroup, openSegment, openWaiting]);

  if (isEmpty) {
    return <ProjectsEmptyState />;
  }

  return (
    // AppShell's content slot is overflow-hidden — pages own their
    // scroll. Same ScrollArea pattern DashboardPage uses; without it
    // the lower cards were clipped with no way to scroll. The right
    // padding reserves a lane for the overlay scrollbar so it never
    // sits on top of the filter button / card edges.
    <ScrollArea className="h-full">
      <div className="space-y-3 pb-3 pr-3">
        {/* ─── Toolbar: sync stamp + result count + filter ─── */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <p className="text-[12px] text-muted-foreground truncate">
              <span className="font-semibold text-foreground/80 tabular-nums">
                {projects.length}
              </span>{" "}
              gemi projesi
              {fetchedAt && (
                <>
                  {" "}
                  · son güncelleme{" "}
                  <span className="tabular-nums">{formatSync(fetchedAt)}</span>
                </>
              )}
            </p>
          </div>
          <AdvancedFilter
            projects={rawProjects}
            filters={filters}
            onChange={setFilters}
            shipPlanDefault={OVERVIEW_SHIP_PLAN_DEFAULT}
            periodDefault="all"
            resultCount={projects.length}
            totalCount={rawProjects.length}
            collapsible
          />
        </div>

        {/* ─── KPI row ─── */}
        <OverviewKpis
          agg={agg}
          onHeroClick={openAllProjects}
          onGroupClick={openGroup}
        />

        {/* ─── Insights ribbon ─── */}
        <OverviewInsights insights={insights} />

        {/* ─── Status donut · Matrix · Longest waiting ───
            Breakpoint ladder: phones stack (12), tablets pair the donut
            with the matrix (md 5/7), laptops widen the matrix (lg 4/8),
            large monitors fit all three in one row (xl 3/5/4). */}
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-12 md:col-span-5 lg:col-span-4 xl:col-span-3">
            <VoyageStatusDonutCard agg={statusAgg} onStatusClick={openStatus} />
          </div>
          <div className="col-span-12 md:col-span-7 lg:col-span-8 xl:col-span-5">
            <SegmentMatrixCard matrix={matrix} onSegmentClick={openSegment} />
          </div>
          <div className="col-span-12 xl:col-span-4">
            <LongestWaitingCard waiting={waiting} />
          </div>
        </div>

        {/* ─── Group segment columns · Pending payments ─── */}
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-12 lg:col-span-7">
            <GroupSegmentColumns
              columns={groupColumns}
              onGroupClick={openGroup}
              onSegmentClick={openSegment}
            />
          </div>
          <div className="col-span-12 lg:col-span-5">
            <PendingPaymentsCard pending={pending} />
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

/** "dd.MM.yyyy HH:mm" (today → just "HH:mm") sync stamp. */
function formatSync(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  if (sameDay) return `${hh}:${mm}`;
  return `${d.toLocaleDateString("tr-TR")} ${hh}:${mm}`;
}
