import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  Tooltip,
} from "recharts";
import { RefreshCw } from "lucide-react";
import { ChartBarBigIcon } from "@hugeicons/core-free-icons";
import { BentoTile } from "./BentoTile";
import { TONE_FORECAST } from "@/components/details/AccentIconBadge";
import { useT } from "@/lib/i18n/LanguageProvider";
import { formatCompactCurrency, formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MonthlyPLPoint } from "@/lib/selectors/monthlyPL";

/** Estimated (tahmini) = brand blue · Realized (gerçekleşen) = emerald.
 *  Fixed semantic colours (theme-independent). Blue tracks the tyrotrade
 *  wordmark/logo (sky-navy `#2563eb`); profit reads green. A NEGATIVE
 *  K/Z (zarar) overrides the hue with red/bordo so loss months pop —
 *  estimated-loss = red, realized-loss = bordo, keeping the
 *  tahmini-lighter / gerçekleşen-darker pairing intact below zero too. */
const COLOR_EST = "#2563eb"; // blue-600 — tyrotrade brand
const COLOR_REAL = "#10b981"; // emerald-500
const COLOR_EST_NEG = "#f43f5e"; // rose-500 — estimated loss
const COLOR_REAL_NEG = "#be123c"; // rose-700 (bordo) — realized loss
const FUTURE_OPACITY = 0.22;
const SOLID_OPACITY = 0.92;

const estColor = (v: number | null) => ((v ?? 0) < 0 ? COLOR_EST_NEG : COLOR_EST);
const realColor = (v: number | null) =>
  (v ?? 0) < 0 ? COLOR_REAL_NEG : COLOR_REAL;

interface MonthlyPLChartProps {
  points: MonthlyPLPoint[];
  /** True once the realized-expense rollup covers the filtered set. */
  hasRealizedCoverage: boolean;
  /** Rollup fetch in flight (scoped to the filter). */
  isFetching: boolean;
  /** Trigger a scoped rollup recompute. */
  onRefresh: () => void;
  /** FY short label, e.g. "25-26". */
  fyLabel: string;
  span?: string;
}

/**
 * E.M Bakış "Aylık K/Z Performansı" — one financial-year (Jul→Jun) of
 * estimated vs. realized net P&L, two bars per month. Future months
 * render as faint "buffer" bars (no realized data yet) so past/current
 * vs. forecast read at a glance. Realized bars only appear once the
 * scoped `actualExpenseRollup` has run for the filtered set; until then
 * the card shows a one-tap compute affordance.
 */
export function MonthlyPLChart({
  points,
  hasRealizedCoverage,
  isFetching,
  onRefresh,
  fyLabel,
  span,
}: MonthlyPLChartProps) {
  const t = useT();

  return (
    <BentoTile
      title={t("dash.monthly.title")}
      subtitle={`${fyLabel} · ${t("dash.monthly.subtitle")}`}
      icon={ChartBarBigIcon}
      iconTone={TONE_FORECAST}
      interactive={false}
      span={span}
    >
      <div className="flex flex-col gap-2 h-full min-h-[260px]">
        {/* Legend + controls */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3.5 text-[11px]">
            <LegendSwatch color={COLOR_EST} label={t("dash.monthly.estimated")} />
            <LegendSwatch
              color={COLOR_REAL}
              label={t("dash.monthly.realized")}
            />
            <span className="inline-flex items-center gap-1.5 text-muted-foreground/80">
              <span
                aria-hidden
                className="size-2.5 rounded-[3px] border border-dashed"
                style={{ borderColor: COLOR_EST, opacity: 0.7 }}
              />
              {t("dash.monthly.future")}
            </span>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={isFetching}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
              "border border-border/60 bg-foreground/[0.03] hover:bg-foreground/[0.06]",
              "transition-colors disabled:opacity-60 disabled:cursor-default"
            )}
            style={{ color: COLOR_REAL }}
          >
            <RefreshCw
              className={cn("size-3.5", isFetching && "animate-spin")}
              strokeWidth={2.25}
            />
            {isFetching
              ? t("dash.monthly.computing")
              : hasRealizedCoverage
                ? t("dash.monthly.refresh")
                : t("dash.monthly.compute")}
          </button>
        </div>

        {/* Chart */}
        <div className="flex-1 min-h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={points}
              margin={{ top: 8, right: 4, bottom: 0, left: 0 }}
              barGap={2}
            >
              <CartesianGrid
                vertical={false}
                stroke="currentColor"
                strokeOpacity={0.08}
              />
              <XAxis
                dataKey="monthLabel"
                tick={{ fontSize: 10, fill: "currentColor", opacity: 0.6 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                width={48}
                tick={{ fontSize: 9, fill: "currentColor", opacity: 0.55 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => formatCompactCurrency(Number(v))}
              />
              <ReferenceLine y={0} stroke="currentColor" strokeOpacity={0.25} />
              <Tooltip
                cursor={{ fill: "currentColor", fillOpacity: 0.04 }}
                content={<MonthlyTooltip />}
              />
              <Bar dataKey="estPL" maxBarSize={16} radius={[3, 3, 0, 0]}>
                {points.map((p, i) => {
                  const c = estColor(p.estPL);
                  return (
                    <Cell
                      key={`est-${i}`}
                      fill={c}
                      fillOpacity={p.isFuture ? FUTURE_OPACITY : SOLID_OPACITY}
                      stroke={p.isFuture ? c : "none"}
                      strokeOpacity={p.isFuture ? 0.6 : 0}
                      strokeDasharray={p.isFuture ? "3 2" : undefined}
                    />
                  );
                })}
              </Bar>
              {hasRealizedCoverage && (
                <Bar dataKey="realizedPL" maxBarSize={16} radius={[3, 3, 0, 0]}>
                  {points.map((p, i) => {
                    const c = realColor(p.realizedPL);
                    return (
                      <Cell
                        key={`real-${i}`}
                        fill={c}
                        fillOpacity={p.isFuture ? FUTURE_OPACITY : SOLID_OPACITY}
                        stroke={p.isFuture ? c : "none"}
                        strokeOpacity={p.isFuture ? 0.6 : 0}
                        strokeDasharray={p.isFuture ? "3 2" : undefined}
                      />
                    );
                  })}
                </Bar>
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </BentoTile>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-foreground/80 font-medium">
      <span
        aria-hidden
        className="size-2.5 rounded-[3px]"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}

interface TooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: Array<{ payload: MonthlyPLPoint }>;
}

/** Custom tooltip — month header, estimated + realized K/Z rows with
 *  USD amounts, and the contributing realized project count. */
function MonthlyTooltip({ active, payload }: TooltipProps) {
  const t = useT();
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-xl bg-white/97 backdrop-blur-xl ring-1 ring-foreground/10 shadow-[0_14px_36px_-12px_rgba(15,23,42,0.3)] px-3 py-2 text-[11.5px] min-w-[180px]">
      <div className="font-bold text-slate-900 mb-1.5 flex items-center justify-between gap-2">
        <span>{point.monthLabel}</span>
        {point.isFuture && (
          <span className="text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            {t("dash.monthly.futureTag")}
          </span>
        )}
      </div>
      <Row
        color={estColor(point.estPL)}
        label={t("dash.monthly.estimated")}
        value={formatCurrency(point.estPL)}
      />
      {point.realizedPL !== null && (
        <Row
          color={realColor(point.realizedPL)}
          label={t("dash.monthly.realized")}
          value={formatCurrency(point.realizedPL)}
          sub={
            point.realizedCount > 0
              ? t("dash.monthly.projects").replace(
                  "{count}",
                  String(point.realizedCount)
                )
              : undefined
          }
        />
      )}
    </div>
  );
}

function Row({
  color,
  label,
  value,
  sub,
}: {
  color: string;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-0.5">
      <span className="inline-flex items-center gap-1.5 text-slate-600">
        <span
          aria-hidden
          className="size-2 rounded-[2px]"
          style={{ background: color }}
        />
        {label}
      </span>
      <span className="text-right">
        <span className="font-bold tabular-nums text-slate-900">{value}</span>
        {sub && (
          <span className="block text-[9.5px] text-muted-foreground/70 leading-none mt-0.5">
            {sub}
          </span>
        )}
      </span>
    </div>
  );
}
