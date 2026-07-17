import * as React from "react";
import { Loader2 } from "lucide-react";
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
import {
  selectExecutionDate,
  selectTotalTons,
} from "@/lib/selectors/project";
import { aggregateEstimatedPL } from "@/lib/selectors/aggregate";
import { getFinancialYear, type FinancialYear } from "@/lib/dashboard/financialPeriod";
import { POWERBI_PL_BY_FY } from "@/data/powerbiPL";
import { formatCompactCurrency } from "@/lib/format";
import type { Project } from "@/lib/dataverse/entities";

interface PeriodPerformanceTileProps {
  projects: Project[];
  now?: Date;
  /** Financial year the dashboard is currently scoped to (from the period
   *  filter's fyKey). The sparkline buckets align to THIS year, not the
   *  calendar-current FY — otherwise, once `now` rolls into a new FY with no
   *  data yet, the sparkline anchors to an empty range while the filtered
   *  projects (a past FY) all fall outside it → a flat/blank chart. Defaults
   *  to the FY of `now` when omitted. */
  fy?: FinancialYear;
  span?: string;
  rowSpan?: string;
  onClick?: () => void;
  /** Realized (gerçekleşen) net P&L (USD) for the filtered set — null
   *  until the scoped expense rollup has covered it. */
  realizedPL?: number | null;
  /** Realized margin % (pl / realized sales). null when uncovered. */
  realizedMarginPct?: number | null;
  /** Projects that fed the realized figures (for the tooltip). */
  realizedContributingCount?: number;
  /** Scoped realized-expense rollup fetch in flight. While true AND the
   *  realized P&L hasn't landed yet, the Gerçekleşen P&L value slot shows
   *  a spinner (same "veri geliyor" cue as the Sefer Takibi expense card)
   *  instead of the static "—" placeholder. */
  realizedFetching?: boolean;
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
  fy,
  span,
  rowSpan,
  onClick,
  realizedPL = null,
  realizedContributingCount = 0,
  realizedFetching = false,
}: PeriodPerformanceTileProps) {
  const accent = useThemeAccent();
  const t = useT();

  const totalProjects = projects.length;

  // Power BI export snapshot for the SELECTED financial year (24-25, 25-26, …).
  // When present, the four non-count KPIs + the sparkline read from it instead
  // of the live/project-derived figures (the user asked for these to mirror the
  // PBI export). FYs without an export fall back to the live behaviour below.
  const activeFy = fy ?? getFinancialYear(now);
  const pbi = POWERBI_PL_BY_FY[activeFy.label];
  const usingPbi = !!pbi;
  const pbiTotals = React.useMemo(() => {
    if (!pbi) return null;
    return pbi.rows.reduce(
      (a, r) => ({
        projQtyTons: a.projQtyTons + r.projQtyTons,
        realQtyTons: a.realQtyTons + r.realQtyTons,
        projPLUsd: a.projPLUsd + r.projPLUsd,
        realPLUsd: a.realPLUsd + r.realPLUsd,
      }),
      { projQtyTons: 0, realQtyTons: 0, projPLUsd: 0, realPLUsd: 0 }
    );
  }, [pbi]);

  // ── Live (project-derived) figures — used as-is for FYs without an export ──
  // Estimated tonnage — Σ line quantity (kg → MT).
  const estTonnageLive = React.useMemo(
    () => projects.reduce((sum, p) => sum + selectTotalTons(p), 0),
    [projects]
  );
  // Realized tonnage — invoiced quantity (tons) from customer invoices.
  const realizedTonnageLive = React.useMemo(
    () => projects.reduce((sum, p) => sum + (p.salesActualQtyTons ?? 0), 0),
    [projects]
  );
  // Estimated net P&L (USD) — same rollup the K&Z tile / monthly chart use.
  const estPLLive = React.useMemo(() => aggregateEstimatedPL(projects).pl, [projects]);

  // ── Displayed figures: PBI export when available, else live ──
  const estTonnage = usingPbi ? pbiTotals!.projQtyTons : estTonnageLive;
  const realizedTonnage = usingPbi ? pbiTotals!.realQtyTons : realizedTonnageLive;
  const estPL = usingPbi ? pbiTotals!.projPLUsd : estPLLive;
  // Realized P&L: PBI total in export mode, otherwise the prop the page computes
  // (null until the expense rollup covers the filter). Project count stays live.
  const realizedPLValue = usingPbi ? pbiTotals!.realPLUsd : realizedPL;
  const hasRealizedPL = usingPbi ? true : realizedPL !== null;
  const contributingCount = usingPbi
    ? pbi.rows.filter((r) => r.realPLUsd !== 0).length
    : realizedContributingCount;

  // Financial-year-aligned 12-month sparkline: Jul (start of FY) → Jun
  // (end of FY). Anchored at the SELECTED FY (the period filter's fyKey),
  // falling back to the FY containing `now`. Anchoring on `now` would blank
  // the chart the moment the calendar rolls into a fresh, data-less FY while
  // the user is still viewing a past year's projects.
  const sparkline = React.useMemo<SparkPoint[]>(() => {
    const fyy = fy ?? getFinancialYear(now);
    const pbiYear = POWERBI_PL_BY_FY[fyy.label];
    // PBI export mode → monthly Live Realized P&L straight from the Excel
    // (same monthly-area form as before, P&L instead of project-intake count).
    if (pbiYear) {
      const fmt = new Intl.DateTimeFormat("tr-TR", { month: "short" });
      return pbiYear.rows.map((r) => {
        const [y, m] = r.monthKey.split("-").map(Number);
        return {
          monthKey: r.monthKey,
          monthLabel: fmt.format(new Date(y, m - 1, 1)),
          value: r.realPLUsd,
        };
      });
    }
    // Live fallback → 12-month project-intake distribution.
    const activeFy = fyy;
    const buckets: SparkPoint[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(activeFy.startYear, 6 + i, 1); // Jul = month 6
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
  }, [projects, now, fy]);

  // Profit → emerald, loss → rose, flat → slate (theme-independent semantics).
  const plColor = (v: number) =>
    v > 0 ? "rgb(4 120 87)" : v < 0 ? "rgb(159 18 57)" : "rgb(71 85 105)";

  return (
    <BentoTile
      title={t("dash.tile.period.title")}
      subtitle={
        usingPbi
          ? `${t("dash.tile.period.subtitle")} · Power BI`
          : t("dash.tile.period.subtitle")
      }
      icon={ChartLineData01Icon}
      iconTone={TONE_FORECAST}
      span={span}
      rowSpan={rowSpan}
      onClick={onClick}
    >
      <div className="@container flex flex-col gap-2 h-full">
        {/* 5-up KPI row. Column count follows the CARD's own width (container
            query), not the viewport — so when the TYRO Chat drawer opens and
            the card narrows, it steps 5 → 3 → 2 columns instead of overflowing
            (the $79,8 Mn values used to overlap). */}
        <div className="grid grid-cols-2 @sm:grid-cols-3 @xl:grid-cols-5 gap-2.5">
          <KPI
            label={t("dash.tile.period.projectCount")}
            tooltip={t("dash.tile.period.projectCountTip")}
            value={
              <span className="text-[21px] font-semibold leading-none tracking-tight">
                <AnimatedNumber value={totalProjects} preset="count" />
              </span>
            }
          />
          <KPI
            label={t("dash.tile.period.estTonnage")}
            tooltip={t("dash.tile.period.estTonnageTip")}
            value={
              <span className="text-[21px] font-semibold leading-none tracking-tight">
                <AnimatedNumber value={estTonnage} preset="tons" />
              </span>
            }
          />
          <KPI
            label={t("dash.tile.period.realTonnage")}
            tooltip={t("dash.tile.period.realTonnageTip")}
            value={
              <span className="text-[21px] font-semibold leading-none tracking-tight">
                <AnimatedNumber value={realizedTonnage} preset="tons" />
              </span>
            }
          />
          <KPI
            label={t("dash.tile.period.estPnl")}
            tooltip={t("dash.tile.period.estPnlTip")}
            value={
              <span
                className="text-[21px] font-semibold leading-none tracking-tight"
                style={{ color: plColor(estPL) }}
              >
                <AnimatedNumber value={estPL} preset="currency" currency="USD" />
              </span>
            }
          />
          <KPI
            label={t("dash.tile.period.realPnl")}
            tooltip={t("dash.tile.period.realPnlTip").replace(
              "{count}",
              String(contributingCount)
            )}
            value={
              hasRealizedPL ? (
                <span
                  className="text-[21px] font-semibold leading-none tracking-tight"
                  style={{ color: plColor(realizedPLValue as number) }}
                >
                  <AnimatedNumber
                    value={realizedPLValue as number}
                    preset="currency"
                    currency="USD"
                  />
                </span>
              ) : realizedFetching ? (
                // Rollup hesaplanırken — Sefer Takibi gider kartındaki
                // "veri geliyor" ipucuyla aynı: dönen spinner + kısa etiket.
                // Gerçekleşen taraf uygulama genelinde emerald kodlu.
                // `self-center` — üst KPI kutusu `items-baseline` hizaladığı
                // için spinner başlığa yapışmasın; dikeyde ortalanır.
                <span className="inline-flex items-center gap-2 whitespace-nowrap self-center">
                  <Loader2
                    className="size-5 animate-spin"
                    style={{ color: "#10b981" }}
                  />
                  <span className="text-[11.5px] font-medium text-muted-foreground">
                    {t("dash.monthly.computing")}
                  </span>
                </span>
              ) : (
                <span className="text-[21px] font-semibold leading-none tracking-tight text-muted-foreground/50">
                  —
                </span>
              )
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
                formatter={(v) =>
                  usingPbi
                    ? [
                        formatCompactCurrency(Number(v ?? 0), "USD"),
                        t("dash.tile.period.realPnl"),
                      ]
                    : [
                        t("dash.tile.period.sparkOpened").replace(
                          "{count}",
                          String(Number(v ?? 0))
                        ),
                        t("dash.tile.period.sparkUnit"),
                      ]
                }
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
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground/85 leading-tight">
        {label}
      </div>
      <div className="min-h-[26px] flex items-baseline">{value}</div>
    </div>
  );
}
