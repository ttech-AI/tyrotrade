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
import { useMemo } from "react";
import { ChartBarBigIcon } from "@hugeicons/core-free-icons";
import { BentoTile } from "./BentoTile";
import { RefreshButton } from "./RefreshButton";
import { TONE_FORECAST } from "@/freight/components/details/AccentIconBadge";
import {
  useResolvedBrandAccent,
  resolveBrandVar,
} from "@/freight/hooks/useBrandAccent";
import { useLocale } from "@/hooks/useLocale";
import { formatCompactCurrency, formatCurrency } from "@/freight/lib/format";
import type { MonthlyPLPoint } from "@/freight/lib/selectors/monthlyPL";

/** Estimated (tahmini) = brand accent · Realized (gerçekleşen) = P&L green.
 *  The two series must stay mutually distinguishable in every palette, so
 *  they ride the dedicated `--series-*` tokens rather than one brand stop.
 *  A NEGATIVE P&L (zarar) overrides the hue with red/bordo so loss months
 *  pop — estimated-loss = red, realized-loss = bordo, keeping the
 *  tahmini-lighter / gerçekleşen-darker pairing intact below zero too. */
const FUTURE_OPACITY = 0.22;
const SOLID_OPACITY = 0.92;

interface SeriesColors {
  est: string;
  real: string;
  estNeg: string;
  realNeg: string;
}

/**
 * Series colours resolved to literal `rgb()` strings.
 *
 * recharts writes these straight onto SVG `fill`/`stroke` attributes, which
 * accept neither `var()` nor `oklch()`. `useResolvedBrandAccent()` carries the
 * MutationObserver on `data-palette` / `class`, so depending on it re-runs this
 * resolution whenever the palette or theme changes.
 */
function useSeriesColors(): SeriesColors {
  const accent = useResolvedBrandAccent();
  return useMemo(
    () => ({
      est: resolveBrandVar("--series-projected", accent.via),
      real: resolveBrandVar("--series-realized", "#10b981"),
      estNeg: resolveBrandVar("--series-projected-neg", "#f43f5e"),
      realNeg: resolveBrandVar("--series-realized-neg", "#be123c"),
    }),
    [accent]
  );
}

const estColor = (v: number | null, c: SeriesColors) =>
  (v ?? 0) < 0 ? c.estNeg : c.est;
const realColor = (v: number | null, c: SeriesColors) =>
  (v ?? 0) < 0 ? c.realNeg : c.real;

/** Same sign→series mapping for DOM consumers, which can take the raw var. */
const estVar = (v: number | null) =>
  (v ?? 0) < 0 ? "var(--series-projected-neg)" : "var(--series-projected)";
const realVar = (v: number | null) =>
  (v ?? 0) < 0 ? "var(--series-realized-neg)" : "var(--series-realized)";

interface MonthlyPLChartProps {
  points: MonthlyPLPoint[];
  /** True once the realized-expense rollup covers the filtered set. */
  hasRealizedCoverage: boolean;
  /** Rollup fetch in flight (scoped to the filter). */
  isFetching?: boolean;
  /** Trigger a scoped rollup recompute. */
  onRefresh?: () => void;
  /** FY short label, e.g. "25-26". */
  fyLabel: string;
  span?: string;
  /** Hide the refresh button — for the static Power BI export mode, which has
   *  nothing to refetch. */
  hideRefresh?: boolean;
  /** Optional subtitle override (defaults to `fyLabel · <monthly subtitle>`). */
  subtitle?: string;
}

/**
 * E.M Bakış "Aylık P&L Performansı" — one financial-year (Jul→Jun) of
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
  hideRefresh,
  subtitle,
}: MonthlyPLChartProps) {
  const { t } = useLocale();
  const colors = useSeriesColors();

  return (
    <BentoTile
      title={t("dash.monthly.title")}
      subtitle={subtitle ?? `${fyLabel} · ${t("dash.monthly.subtitle")}`}
      icon={ChartBarBigIcon}
      iconTone={TONE_FORECAST}
      interactive={false}
      span={span}
      headerAction={
        hideRefresh || !onRefresh ? undefined : (
          <RefreshButton
            isFetching={isFetching ?? false}
            hasRealizedCoverage={hasRealizedCoverage}
            onRefresh={onRefresh}
          />
        )
      }
    >
      <div className="flex flex-col gap-2 h-full min-h-[260px]">
        {/* Legend */}
        <div className="flex items-center gap-3.5 text-[11px] flex-wrap">
          {/* Legend swatches are plain DOM, so they can take the CSS var
              directly and repaint on palette change with no React work. */}
          <LegendSwatch
            color="var(--series-projected)"
            label={t("dash.monthly.estimated")}
          />
          <LegendSwatch
            color="var(--series-realized)"
            label={t("dash.monthly.realized")}
          />
          <span className="inline-flex items-center gap-1.5 text-muted-foreground/80">
            <span
              aria-hidden
              className="size-2.5 rounded-[3px] border border-dashed"
              style={{ borderColor: "var(--series-projected)", opacity: 0.7 }}
            />
            {t("dash.monthly.future")}
          </span>
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
                  const c = estColor(p.estPL, colors);
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
                    const c = realColor(p.realizedPL, colors);
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

/** Custom tooltip — month header, estimated + realized P&L rows with
 *  USD amounts, and the contributing realized project count. */
function MonthlyTooltip({ active, payload }: TooltipProps) {
  const { t } = useLocale();
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-xl bg-popover/95 text-popover-foreground backdrop-blur-xl ring-1 ring-border shadow-[0_14px_36px_-12px_color-mix(in_oklab,var(--foreground)_30%,transparent)] px-3 py-2 text-[11.5px] min-w-[180px]">
      <div className="font-bold text-popover-foreground mb-1.5 flex items-center justify-between gap-2">
        <span>{point.monthLabel}</span>
        {point.isFuture && (
          <span className="text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            {t("dash.monthly.futureTag")}
          </span>
        )}
      </div>
      <Row
        color={estVar(point.estPL)}
        label={t("dash.monthly.estimated")}
        value={formatCurrency(point.estPL)}
      />
      {point.realizedPL !== null && (
        <Row
          color={realVar(point.realizedPL)}
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
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <span
          aria-hidden
          className="size-2 rounded-[2px]"
          style={{ background: color }}
        />
        {label}
      </span>
      <span className="text-right">
        <span className="font-bold tabular-nums text-popover-foreground">
          {value}
        </span>
        {sub && (
          <span className="block text-[9.5px] text-muted-foreground/70 leading-none mt-0.5">
            {sub}
          </span>
        )}
      </span>
    </div>
  );
}
