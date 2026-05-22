import { GlassPanel } from "@/components/glass/GlassPanel";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BentoGrid } from "@/components/dashboard/BentoGrid";
import { LeaderboardPanel } from "@/components/dashboard/LeaderboardPanel";
import { LeaderboardSegmentsPanel } from "@/components/dashboard/LeaderboardSegmentsPanel";
import { EventsPanel } from "@/components/dashboard/EventsPanel";
import { AdvancedFilter } from "@/components/filters/AdvancedFilter";
import {
  KpiDetailDrawer,
  type KpiId,
} from "@/components/dashboard/KpiDetailDrawer";
import { KpiDrawerToolbar } from "@/components/dashboard/KpiDrawerToolbar";
import {
  ExpenseBreakdown,
  PipelineBreakdown,
  CurrencyBreakdown,
  CorridorBreakdown,
  VelocityBreakdown,
  CounterpartyBreakdown,
  PeriodPerformanceBreakdown,
  EstimatedPLBreakdown,
  QuantityBreakdown,
  filterProject,
} from "@/components/dashboard/kpiBreakdowns";
import {
  TONE_FORECAST,
  TONE_PL,
  TONE_CARGO,
  TONE_EXPENSE,
  TONE_SEA,
  TONE_CURRENCY,
  TONE_CORRIDOR,
  TONE_VELOCITY,
  TONE_COUNTERPARTY,
  type IconBadgeTone,
} from "@/components/details/AccentIconBadge";
import type { IconSvgElement } from "@hugeicons/react";
import {
  ChartLineData01Icon,
  Coins02Icon,
  BalanceScaleIcon,
  Wallet01Icon,
  ContainerIcon,
  MoneyExchange01Icon,
  Route01Icon,
  Clock01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import {
  applyProjectFilter,
  makeEmptyFilters,
  projectFilterCount,
  type ProjectFilterState,
} from "@/lib/filters/projectFilters";
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useMsal } from "@azure/msal-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useProjects } from "@/hooks/useProjects";
import { ProjectsEmptyState } from "@/components/projects/ProjectsEmptyState";
import {
  aggregatePipelineBuckets,
} from "@/lib/selectors/aggregate";
import { selectStage } from "@/lib/selectors/project";
import { useThemeAccent } from "@/components/layout/theme-accent";
import {
  findFyByKey,
  getFinancialYear,
} from "@/lib/dashboard/financialPeriod";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/dataverse/entities";

// Dashboard default = inclusive (all projects flow into KPIs unless
// the user explicitly toggles ship-plan-only). Vessel Projects uses
// the opposite default — both are passed to the unified filter via
// `makeEmptyFilters({ includeWithoutShipPlan })`.
const DASHBOARD_SHIP_PLAN_DEFAULT = true;

export function DashboardPage() {
  // Stable `now` reference for the lifetime of the page mount. Time-based
  // selectors (stage classification, period filters) all read this; freezing
  // it prevents downstream memos from invalidating on every render.
  const now = React.useMemo(() => new Date(), []);
  const { accounts, instance } = useMsal();
  const account = accounts[0] ?? instance.getActiveAccount() ?? null;
  const firstName = account?.name?.trim().split(/\s+/)[0] ?? null;
  const [filters, setFilters] = React.useState<ProjectFilterState>(() =>
    makeEmptyFilters({
      includeWithoutShipPlan: DASHBOARD_SHIP_PLAN_DEFAULT,
      // Anasayfa zaman aralığı varsayılanı "Tüm Zamanlar". FY scope'u
      // çok dar geliyordu (yeni FY başlarken proje sayısı sıfıra inip
      // KPI'lar boş görünüyordu). Tüm portföy default → kullanıcı
      // isterse PeriodFilter chip'leriyle daraltır.
      period: "all",
    })
  );
  // Active KPI drawer — `null` when no tile is open. Each click on a
  // BentoGrid tile fires `onSelectKpi(id)` and we render the matching
  // breakdown component inside the shared KpiDetailDrawer chrome.
  const [drawerKpi, setDrawerKpi] = React.useState<KpiId | null>(null);
  const closeDrawer = React.useCallback(() => setDrawerKpi(null), []);

  // Drawer toolbar state (search query + sort flip). Resets every time
  // the user opens a different KPI so each drawer starts from a fresh
  // slate — sticky search across KPIs would be confusing.
  const [drawerQuery, setDrawerQuery] = React.useState("");
  const [drawerSortReversed, setDrawerSortReversed] = React.useState(false);
  React.useEffect(() => {
    setDrawerQuery("");
    setDrawerSortReversed(false);
  }, [drawerKpi]);

  // 🔒 Read-only — composes Project[] from cached Dataverse entities (real
  // mode) or returns mockProjects (mock mode). isEmpty cues the empty state
  // when the user hasn't run "Güncelle" yet.
  const { projects: rawProjects, isEmpty, fetchedAt } = useProjects();
  const allProjects = rawProjects;

  const projects = React.useMemo(
    () => applyProjectFilter(allProjects, filters, now),
    // `now` recomputed every render but stable string-equal so we leave it
    // out of deps to avoid a render thrash.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allProjects, filters]
  );
  const totalAvailable = allProjects.length;
  const activeFilterCount = projectFilterCount(
    filters,
    DASHBOARD_SHIP_PLAN_DEFAULT
  );
  const totalProjects = projects.length;

  const buckets = React.useMemo(
    () => aggregatePipelineBuckets(projects, now),
    [projects, now]
  );
  const inTransit = buckets.inTransit;
  const loading = buckets.loading;
  const atDischarge = buckets.atDischarge;

  // Per-bucket project lists — fed to the greeting subtitle's hover
  // tooltips so the user can see which projects are in each pipeline
  // state without leaving the dashboard. Single pass over `projects`
  // grouping by their resolved stage; we DON'T memoize the result
  // separately because the upstream `projects` memo already gates
  // recomputation on filter changes.
  const pipelineLists = React.useMemo(() => {
    const lists = {
      loading: [] as Project[],
      inTransit: [] as Project[],
      atDischarge: [] as Project[],
    };
    for (const p of projects) {
      const stage = selectStage(p, now);
      if (stage === null) continue;
      if (stage === "loading" || stage === "at-loading-port")
        lists.loading.push(p);
      else if (stage === "in-transit") lists.inTransit.push(p);
      else if (stage === "at-discharge-port") lists.atDischarge.push(p);
    }
    return lists;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects]);

  // Approximate "rows visible after search" — counts projects passing
  // the toolbar's free-text query. Matches the per-breakdown filter so
  // the toolbar's `12/437` counter is honest. Specific breakdowns may
  // drop additional rows (no expense, no transit dates) but the search
  // count is what users care about most when typing.
  const visibleDrawerCount = React.useMemo(() => {
    if (!drawerKpi) return 0;
    if (!drawerQuery.trim()) return projects.length;
    let n = 0;
    for (const p of projects) if (filterProject(p, drawerQuery)) n++;
    return n;
  }, [projects, drawerQuery, drawerKpi]);

  const greeting = getGreeting();
  const lastSyncLabel = fetchedAt ? formatSyncTime(fetchedAt) : null;

  // Subtitle scope label — reflects the active period filter selection
  // so "X dönem içinde Y proje izleniyor" stays accurate when the user
  // flips between FY / quarterly / all-time. Returns two pieces: a
  // bold-rendered scope name (e.g. "25-26" or "Son 90 gün") and the
  // joining preposition that comes after it ("finansal döneminde",
  // "izleme penceresinde", "tüm zamanlarda").
  const periodScope = React.useMemo<{ label: string; preposition: string }>(() => {
    switch (filters.period) {
      case "fy": {
        const fy =
          (filters.fyKey && findFyByKey(filters.fyKey)) ||
          getFinancialYear(now);
        return {
          label: fy.fullLabel.replace(/^FY\s*/, ""),
          preposition: "finansal döneminde",
        };
      }
      case "monthly":
        return { label: "Son 30 gün", preposition: "içinde" };
      case "quarterly":
        return { label: "Son 90 gün", preposition: "içinde" };
      case "yearly":
        return { label: "Son 1 yıl", preposition: "içinde" };
      case "all":
      default:
        return { label: "Tüm zamanlar", preposition: "kapsamında" };
    }
  }, [filters.period, filters.fyKey, now]);

  if (isEmpty) {
    return <ProjectsEmptyState />;
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-3 pb-3">
        <GlassPanel tone="default" className="rounded-2xl">
          <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {new Intl.DateTimeFormat("tr-TR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                }).format(now)}
              </div>
              <h2 className="text-xl font-semibold tracking-tight">
                {greeting}{firstName ? `, ${firstName}` : ""}
              </h2>
              {/* Subtitle: FY context + pipeline state breakdown (loading /
                  in-transit / at-discharge counts), active filter chip, and
                  last sync timestamp when in real mode. Empty stages are
                  skipped — only meaningful counts render so the line stays
                  short and scannable. */}
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {periodScope.label}
                </span>{" "}
                {periodScope.preposition}{" "}
                <span className="font-semibold text-foreground">
                  {totalProjects} proje
                </span>{" "}
                izleniyor.
                {(inTransit > 0 || loading > 0 || atDischarge > 0) && (
                  <span className="ml-0.5 inline-flex items-baseline flex-wrap gap-x-1.5">
                    <TooltipProvider delayDuration={120}>
                      {inTransit > 0 && (
                        <PipelineCountTooltip
                          count={inTransit}
                          label="yolda"
                          projects={pipelineLists.inTransit}
                        />
                      )}
                      {loading > 0 && (
                        <>
                          {inTransit > 0 && (
                            <span className="text-foreground/40">·</span>
                          )}
                          <PipelineCountTooltip
                            count={loading}
                            label="yüklemede"
                            projects={pipelineLists.loading}
                          />
                        </>
                      )}
                      {atDischarge > 0 && (
                        <>
                          {(inTransit > 0 || loading > 0) && (
                            <span className="text-foreground/40">·</span>
                          )}
                          <PipelineCountTooltip
                            count={atDischarge}
                            label="tahliyede"
                            projects={pipelineLists.atDischarge}
                          />
                        </>
                      )}
                    </TooltipProvider>
                    <span>.</span>
                  </span>
                )}
                {activeFilterCount > 0 && (
                  <span className="ml-1.5 text-foreground/70">
                    · <span className="font-medium">{activeFilterCount}</span>{" "}
                    filtre aktif
                  </span>
                )}
                {lastSyncLabel && (
                  <span className="ml-1.5 text-muted-foreground/70">
                    · son senkron {lastSyncLabel}
                  </span>
                )}
              </p>
            </div>
            <AdvancedFilter
              projects={allProjects}
              filters={filters}
              onChange={setFilters}
              shipPlanDefault={DASHBOARD_SHIP_PLAN_DEFAULT}
              periodDefault="all"
              resultCount={projects.length}
              totalCount={totalAvailable}
              collapsible
            />
          </div>
        </GlassPanel>

        <BentoGrid
          projects={projects}
          now={now}
          onSelectKpi={setDrawerKpi}
        />

        {/* Bottom 12-col grid: Kral Projeler + Kral Segmentler stacked
            in the left 9 cols (matches BentoGrid's wider tiles above);
            Olaylar fills the right 3 cols and stretches the full
            stack height — same width as Counterparty in the bento row
            above so columns align vertically across the page. */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
          <div className="xl:col-span-9 flex flex-col gap-3 min-w-0">
            <LeaderboardPanel projects={projects} />
            <LeaderboardSegmentsPanel projects={projects} />
          </div>
          <div className="xl:col-span-3 min-w-0">
            <EventsPanel projects={projects} now={now} />
          </div>
        </div>
      </div>

      {/* KPI detail drawer — renders the breakdown component matching
          the active tile id. Toolbar (search + sort) lives inside the
          drawer chrome between header and body, so it stays pinned
          while rows scroll under it. */}
      <KpiDetailDrawer
        open={drawerKpi !== null}
        onOpenChange={(open) => !open && closeDrawer()}
        title={drawerKpi ? KPI_META[drawerKpi].title : ""}
        subtitle={
          drawerKpi
            ? KPI_META[drawerKpi].subtitle?.(projects)
            : undefined
        }
        icon={drawerKpi ? KPI_META[drawerKpi].icon : undefined}
        iconTone={drawerKpi ? KPI_META[drawerKpi].tone : undefined}
        toolbar={
          drawerKpi ? (
            <KpiDrawerToolbar
              query={drawerQuery}
              onQueryChange={setDrawerQuery}
              resultCount={visibleDrawerCount}
              totalCount={projects.length}
              sort={
                KPI_META[drawerKpi].sort
                  ? {
                      value: drawerSortReversed ? "reverse" : "default",
                      onChange: (v) => setDrawerSortReversed(v === "reverse"),
                      defaultLabel: KPI_META[drawerKpi].sort!.default,
                      reverseLabel: KPI_META[drawerKpi].sort!.reverse,
                    }
                  : undefined
              }
            />
          ) : null
        }
      >
        {drawerKpi === "period" && (
          <PeriodPerformanceBreakdown
            projects={projects}
            onClose={closeDrawer}
            now={now}
            query={drawerQuery}
            sortReversed={drawerSortReversed}
          />
        )}
        {drawerKpi === "pl" && (
          <EstimatedPLBreakdown
            projects={projects}
            onClose={closeDrawer}
            query={drawerQuery}
            sortReversed={drawerSortReversed}
          />
        )}
        {drawerKpi === "quantity" && (
          <QuantityBreakdown
            projects={projects}
            onClose={closeDrawer}
            query={drawerQuery}
            sortReversed={drawerSortReversed}
          />
        )}
        {drawerKpi === "expense" && (
          <ExpenseBreakdown
            projects={projects}
            onClose={closeDrawer}
            query={drawerQuery}
            sortReversed={drawerSortReversed}
          />
        )}
        {drawerKpi === "pipeline" && (
          <PipelineBreakdown
            projects={projects}
            onClose={closeDrawer}
            query={drawerQuery}
          />
        )}
        {drawerKpi === "currency" && (
          <CurrencyBreakdown
            projects={projects}
            onClose={closeDrawer}
            query={drawerQuery}
          />
        )}
        {drawerKpi === "corridor" && (
          <CorridorBreakdown
            projects={projects}
            onClose={closeDrawer}
            query={drawerQuery}
            sortReversed={drawerSortReversed}
          />
        )}
        {drawerKpi === "velocity" && (
          <VelocityBreakdown
            projects={projects}
            onClose={closeDrawer}
            now={now}
            query={drawerQuery}
            sortReversed={drawerSortReversed}
          />
        )}
        {drawerKpi === "counterparty" && (
          <CounterpartyBreakdown
            projects={projects}
            onClose={closeDrawer}
            query={drawerQuery}
            sortReversed={drawerSortReversed}
          />
        )}
      </KpiDetailDrawer>
    </ScrollArea>
  );
}

/* ─────────── KPI metadata ─────────── */

interface KpiMeta {
  title: string;
  /** Subtitle factory — receives the filtered project set so it can
   *  surface a count or context fragment that matches the data the
   *  drawer is about to render. */
  subtitle?: (projects: Project[]) => string;
  icon: IconSvgElement;
  tone: IconBadgeTone;
  /** Optional sort flip labels — when omitted the toolbar's sort
   *  toggle is hidden (Pipeline / Currency keep their canonical order). */
  sort?: { default: string; reverse: string };
}

const KPI_META: Record<KpiId, KpiMeta> = {
  period: {
    title: "Dönem Performansı",
    subtitle: (p) => `${p.length} proje · finansal görünüm`,
    icon: ChartLineData01Icon,
    tone: TONE_FORECAST,
    sort: { default: "En değerliden", reverse: "En düşük değerden" },
  },
  pl: {
    title: "Tahmini Kâr & Zarar",
    subtitle: (p) => `${p.length} proje · USD eşdeğeri`,
    icon: Coins02Icon,
    tone: TONE_PL,
    sort: { default: "En kârlıdan", reverse: "En zararlıdan" },
  },
  quantity: {
    title: "Tahmini Miktar",
    subtitle: (p) => `${p.length} proje · toplam tonaj dağılımı`,
    icon: BalanceScaleIcon,
    tone: TONE_CARGO,
    sort: { default: "En çok tonajdan", reverse: "En az tonajdan" },
  },
  expense: {
    title: "Tahmini Gider",
    subtitle: (p) => `${p.length} proje · USD bazlı kalemler`,
    icon: Wallet01Icon,
    tone: TONE_EXPENSE,
    sort: { default: "En pahalıdan", reverse: "En ucuzdan" },
  },
  pipeline: {
    title: "Aktif Pipeline",
    subtitle: (p) => `${p.length} proje · sefer durumuna göre`,
    icon: ContainerIcon,
    tone: TONE_SEA,
    // Pipeline order is workflow-driven; no flip.
  },
  currency: {
    title: "Para Birimi Maruziyeti",
    subtitle: (p) => `${p.length} proje · USD / EUR / TRY`,
    icon: MoneyExchange01Icon,
    tone: TONE_CURRENCY,
    // Currency order is canonical (USD → EUR → TRY); no flip.
  },
  corridor: {
    title: "Koridor Konsantrasyonu",
    subtitle: (p) => `${p.length} proje · LP → DP dağılımı`,
    icon: Route01Icon,
    tone: TONE_CORRIDOR,
    sort: { default: "En çok projeli koridor", reverse: "En az projeli koridor" },
  },
  velocity: {
    title: "Ortalama Transit",
    subtitle: (p) => `${p.length} proje · LP-(ED) → DP-ETA`,
    icon: Clock01Icon,
    tone: TONE_VELOCITY,
    sort: { default: "En yavaştan", reverse: "En hızlıdan" },
  },
  counterparty: {
    title: "Karşı Taraf Dağılımı",
    subtitle: (p) => `${p.length} proje · tedarikçi & alıcı`,
    icon: UserGroupIcon,
    tone: TONE_COUNTERPARTY,
    sort: { default: "En çok projeli", reverse: "En az projeli" },
  },
};

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "İyi geceler";
  if (h < 12) return "Günaydın";
  if (h < 18) return "İyi günler";
  return "İyi akşamlar";
}

/** Compact "saat:dakika" if today, otherwise "dd.MM HH:mm". Used for the
 *  greeting subtitle's last-sync footnote — dense, scannable. */
function formatSyncTime(iso: string): string {
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
  const dd = String(d.getDate()).padStart(2, "0");
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mo} ${hh}:${mm}`;
}

/* ─────────── Pipeline-count tooltip ─────────── */

/**
 * Hoverable count + label that opens a premium tooltip listing the
 * underlying projects (projectNo + name + segment, capped to 12 rows).
 * Click a row → navigate to the Vessel Projects page with that project
 * pre-selected via `focusProjectNo` state. Used by the dashboard
 * greeting subtitle for `inTransit / loading / atDischarge` chips —
 * NOT applied to the FY label or the total project count, which are
 * top-level numbers without an actionable list behind them.
 */
function PipelineCountTooltip({
  count,
  label,
  projects,
}: {
  count: number;
  label: string;
  projects: Project[];
}) {
  const accent = useThemeAccent();
  const navigate = useNavigate();
  const PREVIEW_CAP = 12;
  const visible = projects.slice(0, PREVIEW_CAP);
  const remainder = projects.length - visible.length;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-baseline gap-1 rounded-md px-1 -mx-1 -my-0.5 py-0.5",
            "transition-colors cursor-default outline-none",
            "hover:bg-foreground/[0.04]",
            "focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-background"
          )}
          style={{ color: accent.solid }}
        >
          <span className="font-bold tabular-nums">{count}</span>
          <span className="font-medium">{label}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        align="start"
        sideOffset={6}
        className={cn(
          "p-0 max-w-[360px] w-[320px]",
          "bg-white/97 backdrop-blur-2xl backdrop-saturate-150",
          "ring-1 ring-foreground/10",
          "shadow-[0_18px_44px_-14px_rgba(15,23,42,0.32)]"
        )}
      >
        <div className="px-3 py-2 border-b border-border/40 flex items-center gap-2">
          <span
            className="size-1.5 rounded-full shrink-0"
            style={{ background: accent.solid }}
          />
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-900">
            {count} proje · {label}
          </span>
        </div>
        <div className="py-1">
          {visible.map((p) => (
            <button
              key={p.projectNo}
              type="button"
              onClick={() =>
                navigate(`/projects/${p.projectNo}`, {
                  state: { focusProjectNo: p.projectNo },
                })
              }
              className="w-full text-left px-3 py-1.5 hover:bg-foreground/[0.04] transition-colors flex flex-col gap-0.5"
            >
              <div className="flex items-baseline gap-1.5 min-w-0">
                <span
                  className="font-mono text-[10.5px] tabular-nums shrink-0"
                  style={{ color: accent.solid, opacity: 0.75 }}
                >
                  {p.projectNo}
                </span>
                <span className="text-[11.5px] font-semibold text-slate-900 truncate">
                  {p.projectName}
                </span>
              </div>
              {p.segment && (
                <span
                  className="text-[10px] uppercase tracking-wider self-start font-semibold px-1.5 py-px rounded"
                  style={{
                    color: accent.solid,
                    background: accent.tint,
                  }}
                >
                  {p.segment}
                </span>
              )}
            </button>
          ))}
          {remainder > 0 && (
            <div className="px-3 py-1.5 text-[10.5px] text-foreground/65 italic">
              + {remainder} proje daha
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
