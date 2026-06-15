import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { HugeiconsIcon } from "@hugeicons/react";
import { ChartHistogramIcon } from "@hugeicons/core-free-icons";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { useThemeAccent } from "@/components/layout/theme-accent";
import { formatFreightRate, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n/LanguageProvider";
import type { FreightMonthlyPoint } from "@/lib/selectors/freight";

const CHART_CONFIG: ChartConfig = {
  avg: { label: "Ortalama" },
};

/**
 * Navlun Trend — monthly average freight rate over time with a min/max
 * band (recharts ComposedChart: a range Area for the band + a Line for the
 * average). Mirrors the indicative Power BI's hero line chart, in the
 * dominant currency of the filtered set.
 */
export function FreightTrendChart({
  points,
  currency,
}: {
  points: FreightMonthlyPoint[];
  currency: string;
}) {
  const t = useT();
  const accent = useThemeAccent();
  const data = points.map((p) => ({
    label: p.label,
    avg: Number(p.avg.toFixed(2)),
    min: Number(p.min.toFixed(2)),
    max: Number(p.max.toFixed(2)),
    range: [Number(p.min.toFixed(2)), Number(p.max.toFixed(2))] as [
      number,
      number,
    ],
    count: p.count,
  }));

  return (
    <GlassPanel tone="default" className="rounded-2xl h-full flex flex-col">
      <Header
        title={t("ft.chart.trend")}
        sub={`${t("ft.chart.trend.subA")} · ${currency}/t · ${t("ft.chart.trend.subB")}`}
        solid={accent.solid}
      />
      <div className="flex-1 min-h-0 px-2 pb-2">
        {data.length < 2 ? (
          <EmptyChart text={t("ft.chart.noTrend")} />
        ) : (
          <ChartContainer config={CHART_CONFIG} className="h-full w-full aspect-auto">
            <ComposedChart
              data={data}
              margin={{ top: 8, right: 12, bottom: 4, left: 4 }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(15,23,42,0.06)" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={16}
                tick={{ fontSize: 10.5 }}
              />
              <YAxis
                width={34}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10.5 }}
                tickFormatter={(v) => formatNumber(Number(v))}
              />
              <RTooltip
                cursor={{ stroke: accent.ring, strokeWidth: 1 }}
                content={<TrendTooltip currency={currency} />}
              />
              <Area
                type="monotone"
                dataKey="range"
                stroke="none"
                fill={accent.stops[0]}
                fillOpacity={0.18}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="avg"
                stroke={accent.solid}
                strokeWidth={2.25}
                dot={{ r: 2, fill: accent.solid, strokeWidth: 0 }}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ChartContainer>
        )}
      </div>
    </GlassPanel>
  );
}

interface TrendDatum {
  label: string;
  avg: number;
  min: number;
  max: number;
  count: number;
}

function TrendTooltip({
  active,
  payload,
  currency,
}: {
  active?: boolean;
  payload?: Array<{ payload: TrendDatum }>;
  currency?: string;
}) {
  const t = useT();
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-border/50 bg-white px-2.5 py-2 text-[11.5px] shadow-xl min-w-36">
      <div className="font-semibold text-foreground mb-1">{d.label}</div>
      <Row label={t("ft.chart.avg")} value={formatFreightRate(d.avg, currency)} bold />
      <Row label={t("ft.chart.min")} value={formatFreightRate(d.min, currency)} />
      <Row label={t("ft.chart.max")} value={formatFreightRate(d.max, currency)} />
      <div className="mt-1 pt-1 border-t border-border/40 text-[10.5px] text-muted-foreground">
        {formatNumber(d.count)} {t("ft.meta.quotes")}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`tabular-nums ${bold ? "font-bold text-foreground" : "font-medium text-foreground/85"}`}
      >
        {value}
      </span>
    </div>
  );
}

export function Header({
  title,
  sub,
  solid,
}: {
  title: string;
  sub: string;
  solid: string;
}) {
  return (
    <div className="px-4 pt-4 pb-2 shrink-0">
      <div className="flex items-center gap-2">
        <HugeiconsIcon
          icon={ChartHistogramIcon}
          size={16}
          strokeWidth={1.75}
          style={{ color: solid }}
        />
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      </div>
      <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>
    </div>
  );
}

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="h-full min-h-[160px] grid place-items-center">
      <p className="text-[12.5px] text-muted-foreground">{text}</p>
    </div>
  );
}
