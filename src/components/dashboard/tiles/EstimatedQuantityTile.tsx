import * as React from "react";
import { BalanceScaleIcon } from "@hugeicons/core-free-icons";
import { Bar, BarChart, Tooltip, XAxis } from "recharts";
import { BentoTile } from "../BentoTile";
import { TONE_CARGO } from "@/components/details/AccentIconBadge";
import {
  ChartContainer,
  type ChartConfig,
} from "@/components/evilcharts/ui/chart";
import {
  GridBarBackground,
  type GridBarProps,
} from "@/components/evilcharts/blocks/grid-bar-chart";
import {
  selectExecutionDate,
  selectTotalKg,
  selectTotalTons,
} from "@/lib/selectors/project";
import { getFinancialYear } from "@/lib/dashboard/financialPeriod";
import { useT } from "@/lib/i18n/LanguageProvider";
import type { Project } from "@/lib/dataverse/entities";

interface EstimatedQuantityTileProps {
  projects: Project[];
  /** Reference date — drives FY anchoring for the monthly chart. */
  now?: Date;
  span?: string;
  rowSpan?: string;
  onClick?: () => void;
}

interface MonthRow {
  month: string;
  tons: number;
  /** Pre-computed amber level (0=light, 1=mid, 2=deep) so the bar shape
   *  callback doesn't need access to the global max. */
  level: 0 | 1 | 2;
}

const TR_MONTHS = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

// Three amber stops, light → deep. None black.
const LEVEL_COLORS = ["#fcd34d", "#f59e0b", "#b45309"];

/* ─────────── Tonnage formatter — handles bin/mn scale ─────────── */

interface FormattedTonnage {
  value: string;
  unit: string;
}

function formatTonnage(tons: number): FormattedTonnage {
  if (tons >= 1_000_000) {
    return {
      value: (tons / 1_000_000).toLocaleString("tr-TR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
      unit: "mn t",
    };
  }
  if (tons >= 1000) {
    return {
      value: (tons / 1000).toLocaleString("tr-TR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
      unit: "bin t",
    };
  }
  return {
    value: tons.toLocaleString("tr-TR", { maximumFractionDigits: 0 }),
    unit: "t",
  };
}

/**
 * Tahmini Miktar tile — period-scoped tonnage with the
 * `@evilcharts/grid-bar-chart` Total + Peak header pattern. Months are
 * FY-aligned (Jul → Jun). Bars are the amber grid-bar shape, and each
 * column's fill scales by its own tonnage level (light / mid / deep
 * amber) so the heaviest months read as deeper colour without a
 * separate legend.
 *
 * Domain colour: amber / cargo (TONE_CARGO).
 */
export function EstimatedQuantityTile({
  projects,
  now = new Date(),
  span,
  rowSpan,
  onClick,
}: EstimatedQuantityTileProps) {
  const t = useT();
  const totalTons = React.useMemo(
    () => projects.reduce((sum, p) => sum + selectTotalTons(p), 0),
    [projects]
  );

  // FY-aligned monthly tonnage. Each row carries a pre-computed amber
  // `level` (0/1/2) used by the per-bar shape callback below.
  const monthly = React.useMemo<MonthRow[]>(() => {
    const fy = getFinancialYear(now);
    const buckets: Array<{ month: string; tons: number }> = [];
    const indexByKey = new Map<string, number>();
    for (let i = 0; i < 12; i++) {
      const d = new Date(fy.startYear, 6 + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      buckets.push({ month: TR_MONTHS[d.getMonth()], tons: 0 });
      indexByKey.set(key, i);
    }
    for (const p of projects) {
      const t = new Date(selectExecutionDate(p));
      if (Number.isNaN(t.getTime())) continue;
      const key = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`;
      const idx = indexByKey.get(key);
      if (idx !== undefined) buckets[idx].tons += selectTotalKg(p) / 1000;
    }
    const max = buckets.reduce((m, b) => (b.tons > m ? b.tons : m), 0);
    return buckets.map((b) => {
      let level: 0 | 1 | 2 = 0;
      if (max > 0) {
        const r = b.tons / max;
        level = r < 0.34 ? 0 : r < 0.67 ? 1 : 2;
      }
      return { ...b, level };
    });
  }, [projects, now]);

  const peak = React.useMemo(
    () =>
      monthly.reduce(
        (acc, b) => (b.tons > acc.tons ? b : acc),
        { month: monthly[0]?.month ?? "—", tons: 0, level: 0 as 0 | 1 | 2 }
      ),
    [monthly]
  );

  const totalFmt = formatTonnage(totalTons);

  // Single-series chart config — ChartContainer requires it but actual
  // colours come from the per-row `level` via the custom shape callback.
  const chartConfig: ChartConfig = {
    tons: {
      label: t("dash.tile.qty.tonnage"),
      colors: { light: ["#f59e0b"], dark: ["#fbbf24"] },
    },
  };

  return (
    <BentoTile
      title={t("dash.tile.qty.title")}
      subtitle={t("dash.tile.qty.subtitle")}
      icon={BalanceScaleIcon}
      iconTone={TONE_CARGO}
      span={span}
      rowSpan={rowSpan}
      onClick={onClick}
    >
      <div className="flex flex-col h-full min-w-0">
        {/* Total + Peak (Zirve) header strip — labels follow the same
            uppercase eyebrow style as BentoTile titles so the tile reads
            consistently with the rest of the dashboard. */}
        <div className="flex items-stretch gap-3 mb-2">
          <div
            className="flex flex-col gap-1 min-w-0"
            title={t("dash.tile.qty.totalTip")}
          >
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-foreground/70">
              {t("dash.tile.qty.total")}
            </span>
            <span className="text-amber-700 text-[22px] font-bold leading-none tabular-nums">
              {totalFmt.value}
              <span className="text-[12px] ml-1 text-foreground/60 font-semibold">
                {totalFmt.unit}
              </span>
            </span>
          </div>
          <span className="border-l border-dashed border-border/70 self-stretch" />
          <div
            className="flex flex-col gap-1 min-w-0"
            title={
              peak.tons > 0
                ? t("dash.tile.qty.peakTip")
                    .replace("{month}", peak.month)
                    .replace("{value}", formatTonnage(peak.tons).value)
                    .replace("{unit}", formatTonnage(peak.tons).unit)
                : t("dash.tile.qty.peakEmpty")
            }
          >
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-foreground/70">
              {t("dash.tile.qty.peak")}
            </span>
            <span className="text-amber-700 text-[22px] font-bold leading-none tracking-tight truncate">
              {peak.tons > 0 ? peak.month : "—"}
            </span>
          </div>
        </div>
        <hr className="border-t border-dashed border-border/70 mb-2" />

        {/* Grid-bar chart — recharts BarChart with a level-aware shape so
            each column reads its own amber tone. */}
        {peak.tons > 0 ? (
          <ChartContainer config={chartConfig} className="flex-1 min-h-[60px] w-full">
            <BarChart
              accessibilityLayer
              data={monthly}
              margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
            >
              <XAxis
                dataKey="month"
                tickLine={false}
                tickMargin={6}
                axisLine={false}
                tick={{
                  fontSize: 11,
                  fill: "currentColor",
                  opacity: 0.85,
                  fontWeight: 600,
                }}
                // Use the locale's narrow month name (May, Tem, Ağu …) — readable
                // at a glance, fits a 3-col tile width without ellipsis tricks.
                tickFormatter={(v: string) => {
                  // Source labels are the long Turkish names ("Temmuz", "Ağustos").
                  // Use the first 3 characters but special-case "Mayıs" / "Haziran"
                  // so the "ı" + "i" remain legible (Tem/Ağu/Eyl/Eki/Kas/Ara/Oca/Şub/Mar/Nis/May/Haz).
                  if (v === "Mayıs") return "May";
                  if (v === "Haziran") return "Haz";
                  return v.slice(0, 3);
                }}
                interval={0}
              />
              <Tooltip
                cursor={{ fill: "rgba(245,158,11,0.08)" }}
                contentStyle={{
                  background: "rgba(255,255,255,0.96)",
                  border: "1px solid rgba(180,83,9,0.35)",
                  borderRadius: 8,
                  padding: "6px 10px",
                  fontSize: 11,
                  boxShadow: "0 8px 24px -8px rgba(15,23,42,0.18)",
                }}
                labelStyle={{
                  fontWeight: 600,
                  color: "#92400e",
                  marginBottom: 2,
                }}
                formatter={(v) => {
                  const tonsVal = Number(v ?? 0);
                  const fmt = formatTonnage(tonsVal);
                  return [`${fmt.value} ${fmt.unit}`, t("dash.tile.qty.tonnage")];
                }}
                labelFormatter={(l) =>
                  t("dash.tile.qty.month").replace("{month}", String(l))
                }
              />
              <Bar
                dataKey="tons"
                background={GridBarBackground}
                shape={LeveledGridBarShape}
                activeBar={LeveledGridBarShape}
              />
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="flex-1 grid place-items-center text-[10.5px] text-muted-foreground/70">
            {t("dash.tile.qty.noData")}
          </div>
        )}
      </div>
    </BentoTile>
  );
}

/* ─────────── Per-bar amber-graded grid shape ─────────── */

const SQUARE = 10;
const GAP = 2;
const STEP = SQUARE + GAP;

/**
 * Same square-stack pattern as the registry `GridBarShape`, but reads
 * the bar's pre-computed `level` (0/1/2) from `payload` and picks the
 * matching amber stop from `LEVEL_COLORS`. This restores the level-based
 * colour variation that vanished when the tile switched from the inline
 * mini chart to the registry primitives.
 */
const LeveledGridBarShape = (
  props: GridBarProps & { payload?: { level?: 0 | 1 | 2 } }
) => {
  const { x, y, width, height, payload } = props;
  const xPos = Number(x ?? 0);
  const yPos = Number(y ?? 0);
  const w = Number(width ?? 0);
  const h = Number(height ?? 0);
  if (h <= 0) return null;
  const numSquares = Math.max(1, Math.floor(h / STEP));
  const squareSize = Math.min(SQUARE, Math.max(2, w - 2));
  const sx = xPos + Math.floor((w - squareSize) / 2);
  const bottomY = yPos + h;
  const fill = LEVEL_COLORS[payload?.level ?? 0];
  return (
    <>
      {Array.from({ length: numSquares }, (_, i) => {
        const sy = bottomY - (i + 1) * STEP + GAP;
        return (
          <rect
            key={i}
            x={sx}
            y={sy}
            width={squareSize}
            height={squareSize}
            fill={fill}
            rx={1}
          />
        );
      })}
    </>
  );
};
