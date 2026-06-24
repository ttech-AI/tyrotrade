import * as React from "react";
import { ChartLineData01Icon } from "@hugeicons/core-free-icons";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { BentoTile } from "../BentoTile";
import { AnimatedNumber } from "../AnimatedNumber";
import { useThemeAccent } from "@/components/layout/theme-accent";
import { useT } from "@/lib/i18n/LanguageProvider";
import { TONE_FORECAST } from "@/components/details/AccentIconBadge";
import { aggregateEstimatedPL } from "@/lib/selectors/aggregate";
import {
  selectExecutionDate,
  selectTotalTons,
} from "@/lib/selectors/project";
import { getFinancialYear } from "@/lib/dashboard/financialPeriod";
import type { Project } from "@/lib/dataverse/entities";

interface PeriodPerformanceTileProps {
  projects: Project[];
  now?: Date;
  span?: string;
  rowSpan?: string;
  onClick?: () => void;
}

interface SparkPoint {
  monthKey: string;
  monthLabel: string;
  value: number;
}

/**
 * Executive hero tile — period-scoped headline KPIs with a 12-month
 * project-creation sparkline. Shows: total project count, total cargo
 * value (USD-only sum), estimated P&L margin, and an area sparkline
 * derived from `projectDate` distribution.
 *
 * The sparkline uses the project-creation month as its bucketing key —
 * an "intake heatmap" rather than realised cashflow, since realised
 * sales are still partial in our dataset (Phase I.9 caveat).
 */
export function PeriodPerformanceTile({
  projects,
  now = new Date(),
  span,
  rowSpan,
  onClick,
}: PeriodPerformanceTileProps) {
  const accent = useThemeAccent();
  const t = useT();

  const totalProjects = projects.length;
  const totalTons = React.useMemo(
    () => projects.reduce((sum, p) => sum + selectTotalTons(p), 0),
    [projects]
  );
  const pl = React.useMemo(() => aggregateEstimatedPL(projects), [projects]);

  // Financial-year-aligned 12-month sparkline: Jul (start of FY) → Jun
  // (end of FY). Anchored at the FY containing `now` so the timeline
  // always reads in Tiryaki convention regardless of when the user
  // opens the dashboard.
  const sparkline = React.useMemo<SparkPoint[]>(() => {
    const fy = getFinancialYear(now);
    const buckets: SparkPoint[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(fy.startYear, 6 + i, 1); // Jul = month 6
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const monthLabel = new Intl.DateTimeFormat("tr-TR", {
        month: "short",
      }).format(d);
      buckets.push({ monthKey, monthLabel, value: 0 });
    }
    const indexByKey = new Map(buckets.map((b, i) => [b.monthKey, i]));
    for (const p of projects) {
      // Bucket on operasyon periyodu when set, signing date otherwise.
      const t = new Date(selectExecutionDate(p));
      if (Number.isNaN(t.getTime())) continue;
      const key = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`;
      const idx = indexByKey.get(key);
      if (idx !== undefined) buckets[idx].value++;
    }
    return buckets;
  }, [projects, now]);

  const marginColor =
    pl.marginPct > 5
      ? "rgb(4 120 87)"
      : pl.marginPct < -5
        ? "rgb(159 18 57)"
        : "rgb(71 85 105)";
  const marginBg =
    pl.marginPct > 5
      ? "rgba(16,185,129,0.12)"
      : pl.marginPct < -5
        ? "rgba(244,63,94,0.12)"
        : "rgba(100,116,139,0.12)";

  return (
    <BentoTile
      title={t("dash.tile.period.title")}
      subtitle={t("dash.tile.period.subtitle")}
      icon={ChartLineData01Icon}
      iconTone={TONE_FORECAST}
      span={span}
      rowSpan={rowSpan}
      onClick={onClick}
    >
      <div className="flex flex-col gap-2 h-full">
        {/* 4-up KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <KPI
            label={t("dash.tile.period.projectCount")}
            tooltip={t("dash.tile.period.projectCountTip")}
            value={
              <span className="text-[22px] font-semibold leading-none tracking-tight">
                <AnimatedNumber value={totalProjects} preset="count" />
              </span>
            }
          />
          <KPI
            label={t("dash.tile.period.tonnage")}
            tooltip={t("dash.tile.period.tonnageTip")}
            value={
              <span className="text-[22px] font-semibold leading-none tracking-tight">
                <AnimatedNumber value={totalTons} preset="tons" />
              </span>
            }
          />
          <KPI
            label={t("dash.tile.period.estPL")}
            tooltip={t("dash.tile.period.estPLTip").replace(
              "{count}",
              String(pl.contributingCount)
            )}
            value={
              <span
                className="text-[22px] font-semibold leading-none tracking-tight"
                style={{ color: marginColor }}
              >
                <AnimatedNumber value={pl.pl} preset="currency" currency="USD" />
              </span>
            }
          />
          <KPI
            label={t("dash.tile.period.estMargin")}
            tooltip={t("dash.tile.period.estMarginTip")}
            value={
              <span
                className="inline-flex items-center mt-0.5 px-1.5 py-0.5 rounded text-[12px] font-bold tabular-nums"
                style={{ color: marginColor, backgroundColor: marginBg }}
              >
                {pl.marginPct.toFixed(1)}%
              </span>
            }
          />
        </div>

        {/* Sparkline — 12-month project intake distribution */}
        <div className="flex-1 min-h-[56px] relative">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={sparkline}
              margin={{ top: 6, right: 4, bottom: 0, left: 4 }}
            >
              <defs>
                <linearGradient id="ppt-spark" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={accent.solid}
                    stopOpacity={0.45}
                  />
                  <stop
                    offset="100%"
                    stopColor={accent.solid}
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="monthLabel"
                tick={{ fontSize: 9, fill: "currentColor", opacity: 0.55 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis hide />
              <Tooltip
                cursor={{ stroke: accent.solid, strokeOpacity: 0.3 }}
                contentStyle={{
                  background: "rgba(255,255,255,0.96)",
                  border: `1px solid ${accent.ring}`,
                  borderRadius: 8,
                  padding: "6px 10px",
                  fontSize: 11,
                  boxShadow: "0 8px 24px -8px rgba(15,23,42,0.18)",
                }}
                labelStyle={{
                  fontWeight: 600,
                  color: "#0f172a",
                  marginBottom: 2,
                }}
                // recharts' Formatter type widens `value` to `ValueType |
                // undefined`. Coerce to number and return the [value, name]
                // tuple it expects.
                formatter={(v) => [
                  t("dash.tile.period.sparkOpened").replace(
                    "{count}",
                    String(Number(v ?? 0))
                  ),
                  t("dash.tile.period.sparkUnit"),
                ]}
                labelFormatter={(l) =>
                  t("dash.tile.period.sparkMonth").replace("{month}", String(l))
                }
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={accent.solid}
                strokeWidth={1.5}
                fill="url(#ppt-spark)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </BentoTile>
  );
}

function KPI({
  label,
  tooltip,
  value,
}: {
  label: string;
  tooltip?: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 min-w-0" title={tooltip}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground/85 truncate">
        {label}
      </div>
      <div className="min-h-[26px] flex items-baseline">{value}</div>
    </div>
  );
}
