import { GlassPanel } from "@/components/glass/GlassPanel";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PeriodPerformanceTile } from "@/components/dashboard/tiles/PeriodPerformanceTile";
import { MonthlyPLChart } from "@/components/dashboard/MonthlyPLChart";
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
import { aggregateMonthlyPL, aggregateRealizedPL } from "@/lib/selectors/monthlyPL";
import { useActualExpenseRollup } from "@/hooks/useActualExpenseRollup";
import { useRealizedByMonth } from "@/hooks/useRealizedByMonth";
import { useSegmentBudgetMap } from "@/hooks/useSegmentBudgetMap";
import { RealizedPLTable } from "@/components/dashboard/RealizedPLTable";
import { RealizedPLDetailSheet } from "@/components/dashboard/RealizedPLDetailSheet";
import {
  PowerBIPLDetailSheet,
  type PowerBIPLDetail,
} from "@/components/dashboard/PowerBIPLDetailSheet";
import { PendingPaymentsCard } from "@/components/overview/PendingPaymentsCard";
import { selectPendingPayments } from "@/lib/selectors/overview";
import {
  buildRealizedPLTable,
  buildMonthDetail,
  type RealizedPLMonthRow,
  type RealizedPLMonthDetail,
} from "@/lib/selectors/realizedPLTable";
import {
  buildPowerBIPLTable,
  getPowerBISegments,
  POWERBI_PL_FY,
} from "@/lib/selectors/powerbiPLTable";
import { useThemeAccent } from "@/components/layout/theme-accent";
import {
  findFyByKey,
  getCurrentFyKey,
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

// E.M Bakış (Emerging Markets) default lead trader — the page opens
// pre-filtered to this main trader's current-FY book.
const EM_DEFAULT_MAIN_TRADER = "TRD-FTB";
// …and only OPEN projects. Verified live: the tenant returns the
// mserp_status FormattedValue as "Open" (English) — NOT "Açık" — so the
// default must match that exact value or it would filter to nothing.
const EM_DEFAULT_STATUS = "Open";


export function DashboardPage() {
  // Stable `now` reference for the lifetime of the page mount. Time-based
  // selectors (stage classification, period filters) all read this; freezing
  // it prevents downstream memos from invalidating on every render.
  const now = React.useMemo(() => new Date(), []);
  const t = useT();
  const { accounts, instance } = useMsal();
  const account = accounts[0] ?? instance.getActiveAccount() ?? null;
  // Tam ad-soyad (sadece ad değil) — selamlama başlığında gösterilir.
  const fullName = account?.name?.trim() || null;
  const [filters, setFilters] = React.useState<ProjectFilterState>(() => {
    // E.M Bakış varsayılanları: mevcut finansal dönem (FY) + ana trader
    // TRD-FTB. Bu sayfa Emerging Markets KPI ekranı — açılışta doğrudan
    // güncel dönemin TRD-FTB portföyüne odaklanır; kullanıcı filtre
    // barından genişletebilir.
    const base = makeEmptyFilters({
      includeWithoutShipPlan: DASHBOARD_SHIP_PLAN_DEFAULT,
      period: "fy",
      // Arasa-Trabzon/Satınalma seferleri varsayılan HARİÇ (PBI gibi);
      // kullanıcı gelişmiş filtredeki checkbox ile dahil edebilir.
      includeArasaPurchase: false,
    });
    base.fyKey = getCurrentFyKey();
    base.mainTraders = new Set([EM_DEFAULT_MAIN_TRADER]);
    // Yalnızca açık projeler (kapalı/iptal hariç) — TRD-FTB'ye ek varsayılan.
    base.statuses = new Set([EM_DEFAULT_STATUS]);
    return base;
  });
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
    // Arasa-Trabzon/Satınalma exclusion now lives in applyProjectFilter,
    // gated by the `includeArasaPurchase` toggle (default false here).
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

  // ─── Realized-expense rollup (scoped to the filtered E.M set) ───
  // The global "Verileri Güncelle" already captures realized SALES
  // (salesActualUsd). The heavier, PBI-calibrated realized EXPENSE is
  // deliberately kept out of that chain (it'd slow the tenant-wide
  // refresh for everyone) — here it's computed scoped to exactly the
  // filtered projects, which is fast for the E.M subset.
  const rollup = useActualExpenseRollup();
  // Month-resolved realised sales + purchase (INVOICE-date buckets) — feeds
  // the SECOND "Fatura Tarihi" table (PBI LIVE_PL card = 174,5M for Aug).
  // The first table stays project-period (Realized Project List = ~117M).
  const realizedMonthly = useRealizedByMonth();

  const filteredProjids = React.useMemo(
    () => projects.map((p) => p.projectNo).filter(Boolean),
    [projects]
  );

  // True only when the cached rollup covers every filtered project; a
  // widened filter falls back to "uncovered" so realized bars are never
  // shown partial.
  const realizedCoversFilter = React.useMemo(() => {
    if (filteredProjids.length === 0) return false;
    const computed = new Set(rollup.computedProjids);
    return filteredProjids.every((id) => computed.has(id));
  }, [filteredProjids, rollup.computedProjids]);

  // Coverage for the invoice-date aggregate → gates the SECOND table.
  const monthlyCoversFilter = React.useMemo(() => {
    if (filteredProjids.length === 0) return false;
    const computed = new Set(realizedMonthly.computedProjids);
    return filteredProjids.every((id) => computed.has(id));
  }, [filteredProjids, realizedMonthly.computedProjids]);

  const realizedByMonthMap = monthlyCoversFilter
    ? realizedMonthly.byProjectMonth
    : undefined;

  // projectNo → Σ realized expense USD (from the rollup rows).
  const realizedExpenseByProject = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rollup.rows) {
      m.set(r.projectNo, (m.get(r.projectNo) ?? 0) + r.totalUsd);
    }
    return m;
  }, [rollup.rows]);

  const monthlyPL = React.useMemo(
    () =>
      aggregateMonthlyPL(
        projects,
        realizedExpenseByProject,
        realizedCoversFilter,
        now,
        (filters.fyKey && findFyByKey(filters.fyKey)) || getFinancialYear(now)
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projects, realizedExpenseByProject, realizedCoversFilter, filters.fyKey]
  );

  // Realized headline K/Z + margin for the Dönem Performansı card —
  // only meaningful once the rollup covers the filtered set.
  const realizedAgg = React.useMemo(
    () => aggregateRealizedPL(projects, realizedExpenseByProject),
    [projects, realizedExpenseByProject]
  );

  // FY the dashboard is scoped to — the period filter's fyKey, or the FY of
  // `now` when unset. Shared by the sparkline tile, the FY label, etc. so the
  // whole page reads one selected year (not the calendar-current one).
  const selectedFy = React.useMemo(
    () => (filters.fyKey && findFyByKey(filters.fyKey)) || getFinancialYear(now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filters.fyKey]
  );
  const fyShortLabel = selectedFy.label;

  // Auto-compute the realized series once per "coverage gap" (non-blocking):
  // estimated bars render immediately; realized fills in when the scoped
  // rollup completes.
  //
  // Guard design (learned the hard way): fire exactly ONCE each time
  // coverage is lost, and reset the latch the moment coverage returns OR
  // the filtered set changes. This recomputes after a data refresh wiped
  // the rollup cache (coverage flips back to false — see the
  // `computedProjids` note in useActualExpenseRollup) WITHOUT looping on a
  // failed fetch (a failure leaves coverage false but the latch stays set,
  // so we don't hammer the API).
  const didRequestRef = React.useRef(false);
  const lastSigRef = React.useRef("");
  React.useEffect(() => {
    const sig = [...filteredProjids].sort().join("|");
    if (lastSigRef.current !== sig) {
      lastSigRef.current = sig;
      didRequestRef.current = false; // new set → allow one fetch
    }
    if (realizedCoversFilter) {
      didRequestRef.current = false; // covered → re-arm for the next gap
      return;
    }
    if (filteredProjids.length === 0 || rollup.isFetching) return;
    if (didRequestRef.current) return; // already attempted this gap
    didRequestRef.current = true;
    rollup.refresh(filteredProjids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredProjids, realizedCoversFilter, rollup.isFetching]);

  const handleRealizedRefresh = React.useCallback(() => {
    if (!rollup.isFetching) {
      didRequestRef.current = true;
      rollup.refresh(filteredProjids);
    }
    // Also refresh the invoice-date aggregate (second table).
    if (!realizedMonthly.isFetching) {
      realizedMonthly.refresh(filteredProjids);
    }
  }, [rollup, realizedMonthly, filteredProjids]);

  // Auto-fetch the invoice-date aggregate once per coverage gap (same
  // latch pattern as the expense rollup above).
  const didRequestMonthlyRef = React.useRef(false);
  const lastMonthlySigRef = React.useRef("");
  React.useEffect(() => {
    const sig = [...filteredProjids].sort().join("|");
    if (lastMonthlySigRef.current !== sig) {
      lastMonthlySigRef.current = sig;
      didRequestMonthlyRef.current = false;
    }
    if (monthlyCoversFilter) {
      didRequestMonthlyRef.current = false;
      return;
    }
    if (filteredProjids.length === 0 || realizedMonthly.isFetching) return;
    if (didRequestMonthlyRef.current) return;
    didRequestMonthlyRef.current = true;
    realizedMonthly.refresh(filteredProjids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredProjids, monthlyCoversFilter, realizedMonthly.isFetching]);

  // Realized × Projected P&L monthly table (BI replica) — segment×month
  // budget from the dedicated cache, everything else from the same
  // selectors the chart/card use.
  const budgetMap = useSegmentBudgetMap();
  const realizedTable = React.useMemo(
    () =>
      buildRealizedPLTable(
        projects,
        realizedExpenseByProject,
        budgetMap,
        now,
        (filters.fyKey && findFyByKey(filters.fyKey)) || getFinancialYear(now),
        t("dash.rpl.total"),
        filters.segments
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projects, realizedExpenseByProject, budgetMap, filters.fyKey, filters.segments, t]
  );
  // SECOND table — same builder but realised bucketed by INVOICE DATE
  // (PBI "Live Realized" axis). Falls back to project-period until the
  // invoice aggregate covers the filtered set.
  const realizedTableInvoice = React.useMemo(
    () =>
      buildRealizedPLTable(
        projects,
        realizedExpenseByProject,
        budgetMap,
        now,
        (filters.fyKey && findFyByKey(filters.fyKey)) || getFinancialYear(now),
        t("dash.rpl.total"),
        filters.segments,
        realizedByMonthMap
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      projects,
      realizedExpenseByProject,
      budgetMap,
      filters.fyKey,
      filters.segments,
      realizedByMonthMap,
      t,
    ]
  );
  // Genel Bakış'tan kopyalanan "Ödeme Bekleyen Gemiler" kartı — aynı
  // selektör, filtrelenmiş proje setiyle (E.M Bakış'ın sağ rayında).
  const pending = React.useMemo(
    () => selectPendingPayments(projects, now, 200),
    [projects, now]
  );

  const [detailMonth, setDetailMonth] =
    React.useState<RealizedPLMonthDetail | null>(null);
  const openMonthDetail = React.useCallback(
    (row: RealizedPLMonthRow) => {
      setDetailMonth(
        buildMonthDetail(
          projects,
          row.monthKey,
          row.monthLabel,
          realizedExpenseByProject,
          budgetMap,
          filters.segments
        )
      );
    },
    [projects, realizedExpenseByProject, budgetMap, filters.segments]
  );
  // Invoice-date drill-down — same sheet, but realised split by invoice
  // month (projects invoiced in the clicked month).
  const openMonthDetailInvoice = React.useCallback(
    (row: RealizedPLMonthRow) => {
      setDetailMonth(
        buildMonthDetail(
          projects,
          row.monthKey,
          row.monthLabel,
          realizedExpenseByProject,
          budgetMap,
          filters.segments,
          realizedByMonthMap
        )
      );
    },
    [projects, realizedExpenseByProject, budgetMap, filters.segments, realizedByMonthMap]
  );

  // "Power BI Version" table — a FIXED snapshot straight from the PBI Excel
  // export (src/data/powerbiPL.ts). Filter/FY-independent; only the localized
  // "Toplam" footer label varies. Row drill-down = per-segment matrix.
  const powerbiTable = React.useMemo(
    () => buildPowerBIPLTable(t("dash.rpl.total")),
    [t]
  );
  const [pbiDetail, setPbiDetail] = React.useState<PowerBIPLDetail | null>(null);
  const openPowerbiDetail = React.useCallback((row: RealizedPLMonthRow) => {
    setPbiDetail({
      monthKey: row.monthKey,
      monthLabel: row.monthLabel,
      segments: getPowerBISegments(row.monthKey),
    });
  }, []);

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
                {greeting}{fullName ? `, ${fullName}` : ""}
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
              arasaDefault={false}
              periodDefault="fy"
              resultCount={projects.length}
              totalCount={totalAvailable}
              collapsible
            />
          </div>
        </GlassPanel>

        {/* 1. satır — sadece iki kart: Dönem Performansı + Aylık K/Z. */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-stretch">
          <PeriodPerformanceTile
            projects={projects}
            now={now}
            fy={selectedFy}
            onClick={() => setDrawerKpi("period")}
            realizedPL={realizedCoversFilter ? realizedAgg.pl : null}
            realizedMarginPct={
              realizedCoversFilter ? realizedAgg.marginPct : null
            }
            realizedContributingCount={realizedAgg.contributingCount}
            realizedFetching={rollup.isFetching}
          />
          <MonthlyPLChart
            points={monthlyPL}
            hasRealizedCoverage={realizedCoversFilter}
            isFetching={rollup.isFetching}
            onRefresh={handleRealizedRefresh}
            fyLabel={fyShortLabel}
          />
        </div>

        {/* 2. satır — aylık Tahmini × Gerçekleşen K/Z tablosu (geniş, ay
            satırına tıklayınca proje kırılımı sağ panelde) + sağda Ödeme
            Bekleyen Gemiler. Sağ ray mutlak konumlu kart ile tablonun
            yüksekliğine sabitlenir — alt hizası tabloyla aynı (taşmaz). */}
        <div className="grid grid-cols-12 gap-3 items-stretch">
          <div className="col-span-12 xl:col-span-9 min-w-0">
            <RealizedPLTable
              data={realizedTable}
              hasRealizedCoverage={realizedCoversFilter}
              isFetching={rollup.isFetching}
              onRefresh={handleRealizedRefresh}
              onSelectMonth={openMonthDetail}
              fyLabel={fyShortLabel}
            />
          </div>
          <div className="col-span-12 xl:col-span-3 min-w-0 relative">
            <div className="xl:absolute xl:inset-0">
              <PendingPaymentsCard pending={pending} />
            </div>
          </div>
        </div>

        {/* 3. satır — aynı tablonun FATURA TARİHİ versiyonu (PBI LIVE_PL
            kartı = realized işlem tarihine göre; Ağu ~174,5M). Üstteki tablo
            proje-dönem eksenli (Realized Project List = ~117M) kalır. */}
        <RealizedPLTable
          data={realizedTableInvoice}
          hasRealizedCoverage={monthlyCoversFilter && realizedCoversFilter}
          isFetching={rollup.isFetching || realizedMonthly.isFetching}
          onRefresh={handleRealizedRefresh}
          onSelectMonth={openMonthDetailInvoice}
          fyLabel={fyShortLabel}
          title={t("dash.rpl.titleInvoice")}
          subtitle={`${fyShortLabel} · ${t("dash.rpl.subtitleInvoice")}`}
        />

        {/* 4. satır — POWER BI VERSION: PBI Excel export'unun sabit anlık
            görüntüsü. Yalnızca FY 25-26 seçiliyken gösterilir (başka bir mali
            yıl filtresinde anlamsız olurdu); ay satırına tıklayınca segment
            kırılımı sağ panelde. */}
        {selectedFy.label === POWERBI_PL_FY && (
          <RealizedPLTable
            data={powerbiTable}
            hasRealizedCoverage
            hideRefresh
            onSelectMonth={openPowerbiDetail}
            fyLabel={POWERBI_PL_FY}
            title={t("dash.pbi.title")}
            subtitle={t("dash.pbi.subtitle")}
          />
        )}
      </div>

      <RealizedPLDetailSheet
        open={detailMonth !== null}
        onOpenChange={(o) => !o && setDetailMonth(null)}
        detail={detailMonth}
      />

      <PowerBIPLDetailSheet
        open={pbiDetail !== null && selectedFy.label === POWERBI_PL_FY}
        onOpenChange={(o) => !o && setPbiDetail(null)}
        detail={pbiDetail}
      />

      {/* KPI detail drawer — renders the breakdown component matching
          the active tile id. Toolbar (search + sort) lives inside the
          drawer chrome between header and body, so it stays pinned
          while rows scroll under it. */}
      <KpiDetailDrawer
        open={drawerKpi !== null}
        onOpenChange={(open) => !open && closeDrawer()}
        widthClass="sm:max-w-[640px]"
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
            realizedExpenseByProject={realizedExpenseByProject}
            hasRealizedCoverage={realizedCoversFilter}
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
