import * as React from "react";
import { Search, X } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { RefreshIcon } from "@hugeicons/core-free-icons";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { useThemeAccent, type ThemeAccent } from "@/components/layout/theme-accent";
import { useT } from "@/lib/i18n/LanguageProvider";
import { useFreightPrices } from "@/hooks/useFreightPrices";
import {
  applyFreightFilter,
  extractFreightOptions,
  freightFilterCount,
  makeEmptyFreightFilters,
  type FreightFilterState,
  type FreightPeriod,
} from "@/lib/filters/freightFilters";
import {
  buildFreightLanes,
  buildMonthlyTrend,
  computeFreightKpis,
  topLanesByPrice,
} from "@/lib/selectors/freight";
import {
  getCurrentFyKey,
  lastNFinancialYears,
} from "@/lib/dashboard/financialPeriod";
import { formatDate, formatNumber } from "@/lib/format";
import { FreightKpiTiles } from "@/components/freight/FreightKpiTiles";
import { FreightTrendChart } from "@/components/freight/FreightTrendChart";
import { FreightTopLanesChart } from "@/components/freight/FreightTopLanesChart";
import { FreightQuickFilters } from "@/components/freight/FreightQuickFilters";
import { FreightTable } from "@/components/freight/FreightTable";
import { FreightDetailPanel } from "@/components/freight/FreightDetailPanel";
import {
  FreightProgress,
  FreightEmptyState,
  FreightMockState,
  FreightErrorState,
} from "@/components/freight/FreightStates";

/**
 * Fiyat Takibi — indicative freight price tracking.
 *
 * Joins the header (route) + detail (price line) entities into lanes
 * (route + ship-size class), showing each lane's current rate + trend with
 * an expandable quote history. Layout mirrors the Trade Cost report:
 * toolbar → KPIs → charts → table → slide-in detail.
 *
 * Real-Dataverse only (mock mode shows a "needs live data" state). The
 * hook auto-fetches on first visit; "Yenile" re-runs the 2-call pipeline.
 */
export function PriceTrackingPage() {
  const accent = useThemeAccent();
  const freight = useFreightPrices();
  const t = useT();
  const now = React.useMemo(() => new Date(), []);

  const [filters, setFilters] = React.useState<FreightFilterState>(() =>
    makeEmptyFreightFilters()
  );
  const [searchInput, setSearchInput] = React.useState("");
  const [selectedLaneKey, setSelectedLaneKey] = React.useState<string | null>(
    null
  );

  // Debounce the free-text box into filter state (rebuilding lanes on
  // every keystroke over thousands of rows would feel laggy).
  React.useEffect(() => {
    const timer = setTimeout(
      () => setFilters((f) => ({ ...f, search: searchInput })),
      200
    );
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Options from the FULL row set so picking one value never prunes the
  // others away.
  const options = React.useMemo(
    () => extractFreightOptions(freight.rows),
    [freight.rows]
  );
  const filteredRows = React.useMemo(
    () => applyFreightFilter(freight.rows, filters, now),
    [freight.rows, filters, now]
  );
  const lanes = React.useMemo(
    () => buildFreightLanes(filteredRows, now),
    [filteredRows, now]
  );
  const kpis = React.useMemo(() => computeFreightKpis(lanes), [lanes]);
  const topLanes = React.useMemo(() => topLanesByPrice(lanes, 10), [lanes]);
  const trend = React.useMemo(
    () => buildMonthlyTrend(filteredRows),
    [filteredRows]
  );

  const selectedLane = React.useMemo(
    () => lanes.find((l) => l.laneKey === selectedLaneKey) ?? null,
    [lanes, selectedLaneKey]
  );
  const selectLaneByKey = React.useCallback(
    (key: string) => setSelectedLaneKey(key),
    []
  );

  const activeFilters = freightFilterCount(filters);
  const clearFilters = React.useCallback(() => {
    setSearchInput("");
    setFilters(makeEmptyFreightFilters());
  }, []);

  // ─── Content state machine ───
  let content: React.ReactNode;
  if (freight.isMock) {
    content = <FreightMockState />;
  } else if (freight.error && freight.isEmpty) {
    content = (
      <FreightErrorState error={freight.error} onRetry={freight.refetch} />
    );
  } else if (freight.isFetching && freight.isEmpty) {
    content = <FreightProgress progress={freight.progress} />;
  } else if (freight.isEmpty) {
    content = <FreightEmptyState hasData onLoad={freight.refetch} />;
  } else {
    content = (
      // Desktop fits to viewport (internal table scroll); on < lg the whole
      // content area scrolls so stacked KPIs/charts/cards all reach.
      <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-hidden max-lg:overflow-y-auto">
        <FreightKpiTiles kpis={kpis} />
        {/* Charts: side-by-side on lg (fixed 260px); stacked with real
            height on mobile so they don't squash into one short box. */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 shrink-0 lg:h-[260px]">
          <div className="lg:col-span-7 min-h-0 max-lg:min-h-[240px]">
            <FreightTrendChart points={trend.points} currency={trend.currency} />
          </div>
          <div className="lg:col-span-5 min-h-0 max-lg:min-h-[240px]">
            <FreightTopLanesChart
              lanes={topLanes}
              onSelectLane={selectLaneByKey}
            />
          </div>
        </div>
        <div className="lg:flex-1 min-h-0 overflow-hidden max-lg:min-h-[70vh]">
          <FreightTable
            lanes={lanes}
            selectedLaneKey={selectedLaneKey}
            onSelectLane={(lane) => setSelectedLaneKey(lane.laneKey)}
          />
        </div>
      </div>
    );
  }

  const showToolbar = !freight.isMock && !freight.isEmpty;

  return (
    <div className="h-full flex flex-col gap-3 min-h-0">
      {showToolbar && (
        <GlassPanel
          tone="strong"
          className="rounded-2xl shrink-0"
          aria-label="Fiyat Takibi araç çubuğu"
        >
          <div className="px-4 py-3 flex flex-col gap-2.5">
            <div className="flex items-end gap-3 flex-wrap">
              <SearchBox
                value={searchInput}
                onChange={setSearchInput}
                accent={accent}
              />
              <FreightQuickFilters
                options={options}
                filters={filters}
                onChange={setFilters}
              />
              <span
                aria-hidden
                className="h-9 w-px bg-foreground/10 shrink-0 self-end"
              />
              <div className="flex items-end gap-2.5 shrink-0">
                <PeriodChips
                  period={filters.period}
                  fyKey={filters.fyKey}
                  onChange={(period, fyKey) =>
                    setFilters((f) => ({ ...f, period, fyKey }))
                  }
                  accent={accent}
                  now={now}
                />
                {activeFilters > 0 && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="h-9 px-3 rounded-full inline-flex items-center gap-1.5 text-[12px] font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors shrink-0"
                  >
                    <X className="size-3.5" strokeWidth={2.5} />
                    {t("ft.clear")} ({activeFilters})
                  </button>
                )}
                <RefreshButton
                  onClick={freight.refetch}
                  isFetching={freight.isFetching}
                  accent={accent}
                />
              </div>
            </div>
            {/* Meta strip — result counts + freshness */}
            <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
              <span className="tabular-nums">
                <span className="font-semibold text-foreground">
                  {formatNumber(lanes.length)}
                </span>{" "}
                {t("ft.meta.lanes")} ·{" "}
                <span className="font-semibold text-foreground">
                  {formatNumber(filteredRows.length)}
                </span>{" "}
                {t("ft.meta.quotes")}
                {filteredRows.length !== freight.rows.length && (
                  <span className="text-muted-foreground/70">
                    {" "}
                    ({formatNumber(freight.rows.length)} {t("ft.meta.within")})
                  </span>
                )}
              </span>
              {freight.fetchedAt && (
                <span>
                  {t("ft.meta.updated")}: {formatDate(freight.fetchedAt)}
                </span>
              )}
            </div>
          </div>
        </GlassPanel>
      )}

      {content}

      <FreightDetailPanel
        lane={selectedLane}
        onClose={() => setSelectedLaneKey(null)}
      />
    </div>
  );
}

/* ─────────── toolbar pieces ─────────── */

function SearchBox({
  value,
  onChange,
  accent,
}: {
  value: string;
  onChange: (v: string) => void;
  accent: ThemeAccent;
}) {
  const t = useT();
  return (
    <div className="flex flex-col min-w-[200px] max-w-[280px] flex-1">
      <span className="text-[10.5px] font-bold uppercase tracking-wider leading-none mb-1.5 px-0.5 text-foreground/[0.78]">
        {t("ft.search.label")}
      </span>
      <div
        className="relative h-9 rounded-full bg-white flex items-center"
        style={{
          boxShadow:
            "0 4px 12px -4px rgba(15,23,42,0.18), inset 0 1px 0 0 rgba(255,255,255,0.9)",
        }}
      >
        <Search className="absolute left-3 size-3.5 text-muted-foreground/70" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t("ft.search.placeholder")}
          className="w-full h-full bg-transparent pl-8 pr-8 text-[12.5px] rounded-full outline-none focus-visible:ring-2"
          style={{ ["--tw-ring-color" as never]: accent.ring }}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label={t("ft.search.clear")}
            className="absolute right-2.5 grid place-items-center size-5 rounded-full text-muted-foreground/60 hover:text-foreground hover:bg-foreground/[0.06] transition-colors"
          >
            <X className="size-3.5" strokeWidth={2.5} />
          </button>
        )}
      </div>
    </div>
  );
}

function PeriodChips({
  period,
  fyKey,
  onChange,
  accent,
  now,
}: {
  period: FreightPeriod;
  fyKey: string | null;
  onChange: (period: FreightPeriod, fyKey: string | null) => void;
  accent: ThemeAccent;
  now: Date;
}) {
  const fys = React.useMemo(() => lastNFinancialYears(now, 3), [now]);
  const currentKey = React.useMemo(() => getCurrentFyKey(now), [now]);
  const t = useT();

  const Chip = ({
    active,
    label,
    onClick,
    title,
  }: {
    active: boolean;
    label: string;
    onClick: () => void;
    title: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="h-7 px-2.5 rounded-full text-[12px] font-semibold transition-all whitespace-nowrap"
      style={{
        background: active ? "white" : "transparent",
        color: active ? accent.solid : "rgba(71, 85, 105, 0.85)",
        boxShadow: active
          ? "0 1px 2px 0 rgba(15,23,42,0.10), 0 2px 6px -2px rgba(15,23,42,0.14)"
          : undefined,
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="inline-flex items-center h-9 rounded-full bg-slate-100 ring-1 ring-slate-200/70 p-1 gap-1">
      <Chip
        active={period === "all"}
        label={t("ft.period.all")}
        title={t("ft.period.allTitle")}
        onClick={() => onChange("all", null)}
      />
      {fys.map((fy) => (
        <Chip
          key={fy.key}
          active={period === "fy" && fyKey === fy.key}
          label={fy.label}
          title={`${t("ft.period.fy")} ${fy.fullLabel}${fy.key === currentKey ? ` ${t("ft.period.thisYear")}` : ""}`}
          onClick={() => onChange("fy", fy.key)}
        />
      ))}
    </div>
  );
}

function RefreshButton({
  onClick,
  isFetching,
  accent,
}: {
  onClick: () => void;
  isFetching: boolean;
  accent: ThemeAccent;
}) {
  const t = useT();
  return (
    <TooltipProvider delayDuration={120}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onClick}
            disabled={isFetching}
            aria-label={isFetching ? t("ft.refreshing") : t("ft.refresh")}
            aria-busy={isFetching}
            className="size-9 rounded-full grid place-items-center shrink-0 shadow-sm transition-all hover:scale-[1.04] active:scale-95 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            style={{
              background: isFetching ? accent.gradient : "white",
              color: isFetching ? "white" : accent.solid,
              boxShadow: isFetching
                ? `0 4px 12px -4px ${accent.ring}, inset 0 1px 0 0 rgba(255,255,255,0.25)`
                : "0 1px 2px 0 rgba(15,23,42,0.08), 0 4px 12px -4px rgba(15,23,42,0.18), inset 0 0 0 1px rgba(15,23,42,0.10)",
              ["--tw-ring-color" as never]: accent.ring,
            }}
          >
            <HugeiconsIcon
              icon={RefreshIcon}
              size={16}
              strokeWidth={2}
              className={isFetching ? "animate-spin" : undefined}
            />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          sideOffset={8}
          className="bg-white shadow-[0_12px_28px_-8px_rgba(15,23,42,0.24)] ring-1 ring-foreground/10 backdrop-blur-none px-3 py-1.5"
        >
          <div
            className="text-[11.5px] font-bold uppercase tracking-wider"
            style={{ color: accent.solid }}
          >
            {isFetching ? t("ft.refreshing") : t("ft.refresh")}
          </div>
          {!isFetching && (
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {t("ft.refresh.sub")}
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
