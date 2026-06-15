import { GlassPanel } from "@/components/glass/GlassPanel";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BentoGrid } from "@/components/dashboard/BentoGrid";
import { LeaderboardPanel } from "@/components/dashboard/LeaderboardPanel";
import { LeaderboardSegmentsPanel } from "@/components/dashboard/LeaderboardSegmentsPanel";
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
import { useT } from "@/lib/i18n/LanguageProvider";
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
  const t = useT();
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

  const greeting = t(getGreetingKey());
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
          preposition: t("dash.period.fyPreposition"),
        };
      }
      case "monthly":
        return { label: t("dash.period.last30"), preposition: t("dash.period.within") };
      case "quarterly":
        return { label: t("dash.period.last90"), preposition: t("dash.period.within") };
      case "yearly":
        return { label: t("dash.period.last1y"), preposition: t("dash.period.within") };
      case "all":
      default:
        return { label: t("dash.period.allTime"), preposition: t("dash.period.allScope") };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.period, filters.fyKey, now, t]);

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
                  {totalProjects} {t("dash.greeting.projectsTracked")}
                </span>{" "}
                {t("dash.greeting.tracking")}
                {(inTransit > 0 || loading > 0 || atDischarge > 0) && (
                  <span className="ml-0.5 inline-flex items-baseline flex-wrap gap-x-1.5">
                    <TooltipProvider delayDuration={120}>
                      {inTransit > 0 && (
                        <PipelineCountTooltip
                          count={inTransit}
                          label={t("dash.greeting.inTransit")}
                          projects={pipelineLists.inTransit}
                          t={t}
                        />
                      )}
                      {loading > 0 && (
                        <>
                          {inTransit > 0 && (
                            <span className="text-foreground/40">·</span>
                          )}
                          <PipelineCountTooltip
                            count={loading}
                            label={t("dash.greeting.loading")}
                            projects={pipelineLists.loading}
                            t={t}
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
                            label={t("dash.greeting.atDischarge")}
                            projects={pipelineLists.atDischarge}
                            t={t}
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
                    {t("dash.greeting.filtersActive")}
                  </span>
                )}
                {lastSyncLabel && (
                  <span className="ml-1.5 text-muted-foreground/70">
                    · {t("dash.greeting.lastSync")} {lastSyncLabel}
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

        {/* Kral Projeler + Kral Segmentler yan yana — 12 kolonlu grid'de
            6+6. Olaylar paneli kaldırıldı: aynı içerik zaten topbar
            bildirim merkezinde mevcut, dashboard'da iki kez göstermek
            gereksiz görsel gürültü yaratıyordu. */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          <div className="min-w-0">
            <LeaderboardPanel projects={projects} />
          </div>
          <div className="min-w-0">
            <LeaderboardSegmentsPanel projects={projects} />
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
        title={drawerKpi ? t(KPI_META[drawerKpi].titleKey) : ""}
        subtitle={
          drawerKpi
            ? KPI_META[drawerKpi].subtitleKey
              ? t(KPI_META[drawerKpi].subtitleKey!).replace(
                  "{count}",
                  String(projects.length)
                )
              : undefined
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
                      defaultLabel: t(KPI_META[drawerKpi].sort!.defaultKey),
                      reverseLabel: t(KPI_META[drawerKpi].sort!.reverseKey),
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
  /** i18n key for the drawer header title. */
  titleKey: string;
  /** i18n key for the subtitle template — holds a `{count}` placeholder
   *  resolved against the filtered project count at render time. */
  subtitleKey?: string;
  icon: IconSvgElement;
  tone: IconBadgeTone;
  /** Optional sort flip label keys — when omitted the toolbar's sort
   *  toggle is hidden (Pipeline / Currency keep their canonical order). */
  sort?: { defaultKey: string; reverseKey: string };
}

const KPI_META: Record<KpiId, KpiMeta> = {
  period: {
    titleKey: "dash.kpi.period.title",
    subtitleKey: "dash.kpi.period.subtitle",
    icon: ChartLineData01Icon,
    tone: TONE_FORECAST,
    sort: { defaultKey: "dash.sort.period.default", reverseKey: "dash.sort.period.reverse" },
  },
  pl: {
    titleKey: "dash.kpi.pl.title",
    subtitleKey: "dash.kpi.pl.subtitle",
    icon: Coins02Icon,
    tone: TONE_PL,
    sort: { defaultKey: "dash.sort.pl.default", reverseKey: "dash.sort.pl.reverse" },
  },
  quantity: {
    titleKey: "dash.kpi.quantity.title",
    subtitleKey: "dash.kpi.quantity.subtitle",
    icon: BalanceScaleIcon,
    tone: TONE_CARGO,
    sort: { defaultKey: "dash.sort.quantity.default", reverseKey: "dash.sort.quantity.reverse" },
  },
  expense: {
    titleKey: "dash.kpi.expense.title",
    subtitleKey: "dash.kpi.expense.subtitle",
    icon: Wallet01Icon,
    tone: TONE_EXPENSE,
    sort: { defaultKey: "dash.sort.expense.default", reverseKey: "dash.sort.expense.reverse" },
  },
  pipeline: {
    titleKey: "dash.kpi.pipeline.title",
    subtitleKey: "dash.kpi.pipeline.subtitle",
    icon: ContainerIcon,
    tone: TONE_SEA,
    // Pipeline order is workflow-driven; no flip.
  },
  currency: {
    titleKey: "dash.kpi.currency.title",
    subtitleKey: "dash.kpi.currency.subtitle",
    icon: MoneyExchange01Icon,
    tone: TONE_CURRENCY,
    // Currency order is canonical (USD → EUR → TRY); no flip.
  },
  corridor: {
    titleKey: "dash.kpi.corridor.title",
    subtitleKey: "dash.kpi.corridor.subtitle",
    icon: Route01Icon,
    tone: TONE_CORRIDOR,
    sort: { defaultKey: "dash.sort.corridor.default", reverseKey: "dash.sort.corridor.reverse" },
  },
  velocity: {
    titleKey: "dash.kpi.velocity.title",
    subtitleKey: "dash.kpi.velocity.subtitle",
    icon: Clock01Icon,
    tone: TONE_VELOCITY,
    sort: { defaultKey: "dash.sort.velocity.default", reverseKey: "dash.sort.velocity.reverse" },
  },
  counterparty: {
    titleKey: "dash.kpi.counterparty.title",
    subtitleKey: "dash.kpi.counterparty.subtitle",
    icon: UserGroupIcon,
    tone: TONE_COUNTERPARTY,
    sort: { defaultKey: "dash.sort.counterparty.default", reverseKey: "dash.sort.counterparty.reverse" },
  },
};

/** Returns the greeting i18n key for the current hour. */
function getGreetingKey(): string {
  const h = new Date().getHours();
  if (h < 5) return "dash.greeting.night";
  if (h < 12) return "dash.greeting.morning";
  if (h < 18) return "dash.greeting.day";
  return "dash.greeting.evening";
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
  t,
}: {
  count: number;
  label: string;
  projects: Project[];
  t: (key: string) => string;
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
            {count} {t("dash.greeting.projectsTracked")} · {label}
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
              + {remainder} {t("dash.greeting.moreProjects")}
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
