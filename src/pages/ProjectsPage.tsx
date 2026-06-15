import * as React from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Layers, ChevronLeft } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import { ProjectList } from "@/components/projects/ProjectList";
import { ProjectsEmptyState } from "@/components/projects/ProjectsEmptyState";
import { RouteMap } from "@/components/map/RouteMap";
import { ProjectOverviewCard } from "@/components/details/ProjectOverviewCard";
import { CommoditySalesCard } from "@/components/details/CommoditySalesCard";
import { ExpectedRealizedExpenseCard } from "@/components/details/ExpectedRealizedExpenseCard";
import { BudgetSalesCard } from "@/components/details/BudgetSalesCard";
import { BudgetPLCard } from "@/components/details/BudgetPLCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { AdvancedFilter } from "@/components/filters/AdvancedFilter";
import { MultiSelectCombobox } from "@/components/ui/multi-select-combobox";
import { useThemeAccent } from "@/components/layout/theme-accent";
import { useT } from "@/lib/i18n/LanguageProvider";
import {
  applyProjectFilter,
  extractAvailableOptions,
  makeEmptyFilters,
  type ProjectFilterState,
} from "@/lib/filters/projectFilters";
import { cn } from "@/lib/utils";

type MobileView = "list" | "map" | "details";

// Ship-plan filter retired from the UI — all pages now include
// projects without vessel plans by default (Karayolu projects,
// exception IDs like ORGANIK01, etc. used to silently disappear).
// Kept as a constant for back-compat with `shipPlanDefault` prop.
const PROJECTS_SHIP_PLAN_DEFAULT = true;

/** Vessel Projects landing-page filter defaults. Sefer Takibi page is
 *  operationally focused — the user opens it to triage voyages that
 *  are NOT closed/cancelled. Default scope:
 *   - Period: "all" (every historical FY pulled in)
 *   - Sefer Durumu: To Be Nominated + Nominated + Commenced (active
 *     pipeline only; Completed/Closed/Cancelled hidden until user
 *     toggles them in)
 *  User can override at any time via the popover — these are just
 *  the "fresh visit" starting values. */
const PROJECTS_DEFAULT_VOYAGE_STATUSES = [
  "To Be Nominated",
  "Nominated",
  "Commenced",
] as const;

export function ProjectsPage() {
  const t = useT();
  const { projectId } = useParams<{ projectId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const { projects: rawProjects, isEmpty } = useProjects();
  const now = new Date();

  // Filter state lifted from ProjectList so the AdvancedFilter (rendered
  // inside ProjectList's header) can still drive a unified state shape
  // shared with Dashboard / Veri Yönetimi. The page-level layout is
  // unchanged — the trigger sits next to the search input as before.
  const [filters, setFilters] = React.useState<ProjectFilterState>(() => {
    const base = makeEmptyFilters({
      includeWithoutShipPlan: PROJECTS_SHIP_PLAN_DEFAULT,
      period: "all",
    });
    return {
      ...base,
      voyageStatuses: new Set(PROJECTS_DEFAULT_VOYAGE_STATUSES),
    };
  });

  // Deep-link from another page — supports three focus payloads:
  //   focusProjectNo      → single-project pin (KPI drawer, Trade Cost,
  //                         Genel Bakış list rows)
  //   focusSegments       → pre-filter to a segment set (Genel Bakış
  //                         group/segment cards)
  //   focusVoyageStatuses → pre-filter to specific voyage statuses
  //                         (Genel Bakış "bekleyen" insight)
  // focusPeriod/focusFyKey optionally carry the source page's period so
  // landing counts match what the user clicked. The state is consumed
  // once and wiped via `window.history.replaceState` so back-button /
  // hot reload doesn't re-apply; every chip stays user-clearable.
  React.useEffect(() => {
    const st = location.state as {
      focusProjectNo?: string;
      focusSegments?: string[];
      focusVoyageStatuses?: string[];
      /** "Show me everything" — clears the default voyage-status
       *  narrowing without pinning anything (Genel Bakış hero card). */
      focusAll?: boolean;
      focusPeriod?: ProjectFilterState["period"];
      focusFyKey?: string | null;
    } | null;
    const focusNo = st?.focusProjectNo;
    const focusSegments = st?.focusSegments?.filter(Boolean) ?? [];
    const focusVoyage = st?.focusVoyageStatuses?.filter(Boolean) ?? [];
    if (
      !focusNo &&
      focusSegments.length === 0 &&
      focusVoyage.length === 0 &&
      !st?.focusAll
    )
      return;
    // The default voyage-status narrowing is replaced wholesale: either
    // by the explicit focus set, or cleared entirely — deep links can
    // point at Completed/Closed voyages (payment-pending rows, Trade
    // Cost drill-downs) which the default active-status set would hide,
    // leaving an EMPTY left rail.
    setFilters((f) => ({
      ...f,
      ...(focusNo ? { projectNos: new Set([focusNo]) } : {}),
      ...(focusSegments.length > 0
        ? { segments: new Set(focusSegments) }
        : {}),
      voyageStatuses: new Set(focusVoyage),
      ...(st?.focusPeriod
        ? { period: st.focusPeriod, fyKey: st.focusFyKey ?? null }
        : {}),
    }));
    // Drop the navigation state so a back-button round trip / hot reload
    // doesn't re-trigger this effect. `replaceState` preserves the URL
    // (including the hash for HashRouter) and clears the state slot.
    window.history.replaceState({}, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  // Filtered + sorted in the same shape ProjectList renders so that
  // `projects[0]` (used by the auto-select effect below) always points
  // at the row the user sees on top of the left rail. Sort: segment
  // ASC (empty bucketed last) → projectNo ASC inside each segment.
  // The free-text search filter still lives inside ProjectList (it
  // narrows `projects` further without changing the order).
  const projects = React.useMemo(() => {
    const filtered = applyProjectFilter(rawProjects, filters, now);
    return [...filtered].sort((a, b) => {
      const segA = (a.segment ?? "").trim();
      const segB = (b.segment ?? "").trim();
      if (segA === "" && segB !== "") return 1;
      if (segA !== "" && segB === "") return -1;
      if (segA !== segB) return segA.localeCompare(segB, "tr");
      return a.projectNo.localeCompare(b.projectNo);
    });
    // `now` recomputes per render but is string-equal stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawProjects, filters]);

  const initialId = projectId ?? projects[0]?.projectNo ?? null;
  const [selectedId, setSelectedId] = React.useState<string | null>(initialId);

  React.useEffect(() => {
    if (projectId && projectId !== selectedId) {
      setSelectedId(projectId);
    }
  }, [projectId, selectedId]);

  // Initial selection: when `selectedId` is null AND projects arrive
  // (cache hydration after mount), pick the first project. Stops there
  // — does NOT re-fire on filter changes that exclude the current
  // selection, because that path tripped React error #185 ("Maximum
  // update depth exceeded") under fast combobox toggles. The previous
  // selection survives a filter change; if the user wants the next
  // visible row, they click it explicitly.
  React.useEffect(() => {
    if (selectedId !== null) return;
    if (projects.length === 0) return;
    const firstId = projects[0].projectNo;
    setSelectedId(firstId);
    navigate(`/projects/${firstId}`, { replace: true });
  }, [projects, selectedId, navigate]);

  // Sync initial selection into URL when projects were already loaded on mount
  // (e.g. mock mode) — useState initialiser sets selectedId but URL stays at
  // /projects, so useMatch in TopBar never fires.
  const didSyncUrl = React.useRef(false);
  React.useEffect(() => {
    if (!didSyncUrl.current) {
      didSyncUrl.current = true;
      if (!projectId && selectedId) {
        navigate(`/projects/${selectedId}`, { replace: true });
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [mobileView, setMobileView] = React.useState<MobileView>("list");

  if (isEmpty) {
    return <ProjectsEmptyState />;
  }

  // Look the selected project up in the UNFILTERED rawProjects so the
  // right panel + map keep working when the user lands here via an
  // EventsPanel / NotificationButton click — the deep-linked project
  // might be outside the current filter scope (different FY, different
  // status), and we don't want a blank right rail when the URL
  // explicitly asked for that project.
  const selected =
    rawProjects.find((p) => p.projectNo === selectedId) ?? null;

  const handleSelect = (id: string) => {
    setSelectedId(id);
    navigate(`/projects/${id}`, { replace: true });
    if (isMobile) setMobileView("details");
  };

  // Filter trigger node — passed as a slot into ProjectList so it
  // renders in the list header next to the search input. Icon-only
  // trigger keeps the list header tight; the popover surface is the
  // same as Dashboard / Veri Yönetimi.
  const filterTrigger = (
    <AdvancedFilter
      projects={rawProjects}
      filters={filters}
      onChange={setFilters}
      shipPlanDefault={PROJECTS_SHIP_PLAN_DEFAULT}
      // Page defaults to "all" period — match here so the active-
      // filter badge doesn't count the period chip as user-selected.
      periodDefault="all"
      resultCount={projects.length}
      totalCount={rawProjects.length}
      iconOnly
    />
  );

  // Segment quick-pick — the most common filter dimension for vessel
  // projects, surfaced as a compact pill between the search input
  // and the AdvancedFilter trigger so users don't have to open the
  // full popover to slice by segment.
  const accent = useThemeAccent();
  // Segment seçenekleri = mevcut filtrede (dönem, sefer durumu, grup,
  // şirket, vs.) görünen kayıtlardaki segmentler — TÜM segmentler değil.
  // Segment seçiminin KENDİSİ hariç tutulur (`segments: empty`), aksi
  // halde bir segment seçince diğerleri dropdown'dan kaybolurdu. Sonuç:
  // her ekip yalnızca scope'unda gerçekten projesi olan segmentleri
  // görür — perşembe toplantısında "boş segment" tıklamak yok.
  const segmentOptions = React.useMemo(() => {
    const scoped = applyProjectFilter(
      rawProjects,
      { ...filters, segments: new Set<string>() },
      now
    );
    return extractAvailableOptions(scoped).segments;
    // `now` her render'da yenilenir ama string-eşit stabil — `projects`
    // memosuyla aynı pattern.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawProjects, filters]);
  const segmentTrigger = (
    <MultiSelectCombobox
      options={segmentOptions}
      selected={filters.segments}
      onChange={(next) => setFilters({ ...filters, segments: next })}
      placeholder={t("proj.list.segmentSelect")}
      searchPlaceholder={t("proj.list.segmentSearch")}
      accent={accent}
      compact
      raised
      leadingIcon={
        <Layers
          className="size-4"
          strokeWidth={2.25}
          style={{ color: accent.solid }}
          aria-hidden
        />
      }
      // Ferah iç: px-3.5 + gap-2 (ikon↔placeholder nefes alır) + 14px
      // yazı (best-practice okunur boyut), search input ile aynı dil.
      triggerClassName="w-full px-3.5 gap-2 text-[14px]"
    />
  );

  if (isMobile) {
    return (
      <div className="h-full flex flex-col gap-2">
        <MobileTabs view={mobileView} setView={setMobileView} hasSelection={!!selected} />
        <div className="flex-1 overflow-hidden">
          {mobileView === "list" && (
            <ProjectList
              projects={projects}
              totalCount={rawProjects.length}
              selectedId={selectedId}
              onSelect={handleSelect}
              segmentTrigger={segmentTrigger}
              segmentSelectedCount={filters.segments.size}
              filterTrigger={filterTrigger}
            />
          )}
          {mobileView === "map" && (
            <div className="h-full flex flex-col gap-2">
              {selected && (
                <Button
                  variant="glass"
                  size="sm"
                  onClick={() => setMobileView("list")}
                  className="self-start"
                >
                  <ChevronLeft className="size-3.5" />
                  {t("proj.mobile.backToProjects")}
                </Button>
              )}
              <div className="flex-1">
                <RouteMap project={selected} />
              </div>
            </div>
          )}
          {mobileView === "details" && selected && (
            <ScrollArea className="h-full">
              <div className="space-y-3 pb-4">
                <ProjectOverviewCard project={selected} />
                <CommoditySalesCard project={selected} />
                <ExpectedRealizedExpenseCard project={selected} />
                <BudgetSalesCard project={selected} />
                <BudgetPLCard project={selected} />
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full grid grid-cols-[280px_minmax(0,1fr)_320px] xl:grid-cols-[324px_minmax(0,1fr)_360px] 2xl:grid-cols-[364px_minmax(0,1fr)_400px] gap-3">
      <div className="min-h-0 min-w-0 overflow-hidden">
        <ProjectList
          projects={projects}
          totalCount={rawProjects.length}
          selectedId={selectedId}
          onSelect={handleSelect}
          segmentTrigger={segmentTrigger}
          segmentSelectedCount={filters.segments.size}
          filterTrigger={filterTrigger}
        />
      </div>

      <div className="min-h-0 min-w-0 overflow-hidden">
        <RouteMap project={selected} />
      </div>

      <div className="min-h-0 min-w-0 overflow-hidden">
        {selected ? (
          <ScrollArea className="h-full pr-1">
            <div className="space-y-3">
              <ProjectOverviewCard project={selected} />
              <CommoditySalesCard project={selected} />
              <ExpectedRealizedExpenseCard project={selected} />
              <BudgetSalesCard project={selected} />
              <BudgetPLCard project={selected} />
            </div>
          </ScrollArea>
        ) : (
          <div className="h-full grid place-items-center text-muted-foreground text-sm">
            {t("proj.detailPlaceholder")}
          </div>
        )}
      </div>
    </div>
  );
}

function MobileTabs({
  view,
  setView,
  hasSelection,
}: {
  view: MobileView;
  setView: (v: MobileView) => void;
  hasSelection: boolean;
}) {
  const t = useT();
  const items: Array<{ key: MobileView; label: string }> = [
    { key: "list", label: t("proj.tabs.list") },
    { key: "map", label: t("proj.tabs.map") },
    { key: "details", label: t("proj.tabs.details") },
  ];
  return (
    <div className="glass rounded-2xl p-1 flex items-center gap-1">
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          onClick={() => setView(it.key)}
          disabled={it.key !== "list" && !hasSelection}
          className={cn(
            "flex-1 px-3 py-1.5 rounded-xl text-xs font-medium transition-all relative z-[3]",
            view === it.key
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground disabled:opacity-40 hover:text-foreground"
          )}
        >
          {it.key === "map" && <Layers className="inline size-3 mr-1" />}
          {it.label}
        </button>
      ))}
    </div>
  );
}
