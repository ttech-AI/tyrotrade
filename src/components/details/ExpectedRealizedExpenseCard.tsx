import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { BalanceScaleIcon } from "@hugeicons/core-free-icons";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { AccentIconBadge, TONE_EXPENSE } from "./AccentIconBadge";
import {
  formatCompactCurrency,
  formatCurrency,
  formatNumber,
} from "@/lib/format";
import { selectEstimateTotal } from "@/lib/selectors/project";
import { useProjectExpenseLines } from "@/hooks/useProjectExpenseLines";
import type { Project } from "@/lib/dataverse/entities";

interface Props {
  project: Project;
}

/**
 * Tahmini × Gerçekleşen Gider — premium comparison card on the Vessel
 * Projects right rail, directly under `CommoditySalesCard` ("Taşınan
 * Ürün"). Two horizontal bars (realized vs expected, shared scale) on
 * the left + a radial ratio donut (realized ÷ expected %) on the right,
 * with a tone-coloured variance pill below.
 *
 *   Expected  ← `selectEstimateTotal(project)` — already USD per the
 *               F&O entity model (`mserp_expamountusdd`).
 *   Realized  ← Σ `mserp_tryaifrtexpenselinedistlineentities` rows for
 *               the project, each converted to USD at its
 *               `mserp_datefinancial` via the historical FX table
 *               (matches the dashboard P&L rollups).
 *
 * Expense semantics — LOWER is better:
 *   realized < expected (ratio < 100%) → under budget (emerald)
 *   realized > expected (ratio > 100%) → over budget  (rose)
 *   on target / unknown                → slate
 */
export function ExpectedRealizedExpenseCard({ project }: Props) {
  const reduceMotion = useReducedMotion();
  const expenseLineQuery = useProjectExpenseLines(project.projectNo);
  const isFetching = expenseLineQuery.isFetching;

  const expectedUsd = selectEstimateTotal(project);

  // Realized expense — SAME source + math as BudgetSalesCard's
  // "Gerçekleşen Gider": the 3-step `useProjectExpenseLines` chain,
  // summing the signed `mserp_amountcur_usd` (+ Vendor cost, − Customer
  // reflection; tax / FX-adjustment codes already excluded inside the
  // hook). Guarantees this card's realized total matches the Realized
  // P&L breakdown exactly — the earlier `useProjectActualExpense`
  // (freight dist-line) source double-counted into the millions.
  const realized = React.useMemo(() => {
    let usdTotal = 0;
    let rowCount = 0;
    for (const r of expenseLineQuery.rows) {
      const raw = r["mserp_amountcur_usd"];
      if (raw === undefined || raw === null || !Number.isFinite(Number(raw)))
        continue;
      const amount = Number(raw);
      if (amount === 0) continue;
      usdTotal += amount;
      rowCount++;
    }
    return { usdTotal, rowCount };
  }, [expenseLineQuery.rows]);

  const hasExpected = expectedUsd > 0;
  const hasRealized = realized.rowCount > 0;
  const variance = realized.usdTotal - expectedUsd;
  /** Realized ÷ expected, as a percentage. Null when either side is
   *  missing (no meaningful ratio). The donut centre shows this. */
  const ratioPct = hasExpected ? (realized.usdTotal / expectedUsd) * 100 : null;
  const variancePct =
    hasExpected && hasRealized ? (variance / expectedUsd) * 100 : null;

  /* Shared bar scale — the larger side fills the track, the other is
   * proportional. Guard against /0 so empty projects don't NaN. */
  const scaleMax = Math.max(expectedUsd, realized.usdTotal, 1);
  const realizedW = hasRealized ? (realized.usdTotal / scaleMax) * 100 : 0;
  const expectedW = hasExpected ? (expectedUsd / scaleMax) * 100 : 0;

  const tone = pickTone(hasExpected, hasRealized, variance);
  const VarIcon = tone.Icon;

  return (
    <GlassPanel tone="default" className="rounded-2xl">
      <div className="p-4">
        {/* Header — same iconography pattern as the sibling cards */}
        <div className="flex items-start gap-2.5 mb-3.5">
          <AccentIconBadge size="sm" tone={TONE_EXPENSE}>
            <HugeiconsIcon icon={BalanceScaleIcon} size={16} strokeWidth={2} />
          </AccentIconBadge>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Gider Karşılaştırması
            </div>
            <div className="text-[13px] font-semibold leading-snug">
              Planned × Realized Cost
            </div>
          </div>
          {isFetching && (
            <span
              className="size-2 rounded-full bg-amber-500 animate-pulse mt-1.5"
              title="Gerçekleşen masraf satırları yükleniyor"
            />
          )}
        </div>

        {/* Bars (left) + ratio donut (right) */}
        <div className="flex items-center gap-4">
          <div className="flex-1 min-w-0 space-y-3">
            <BarRow
              label="Realized"
              widthPct={realizedW}
              fill={tone.solid}
              value={
                hasRealized
                  ? formatCompactCurrency(realized.usdTotal, "USD")
                  : isFetching
                    ? "…"
                    : "$0"
              }
              valueTone={tone.text}
              reduceMotion={!!reduceMotion}
              tooltip={
                hasRealized ? formatCurrency(realized.usdTotal, "USD") : undefined
              }
            />
            <BarRow
              label="Planned"
              widthPct={expectedW}
              fill="rgba(100,116,139,0.55)"
              value={hasExpected ? formatCompactCurrency(expectedUsd, "USD") : "—"}
              valueTone="rgb(71 85 105)"
              reduceMotion={!!reduceMotion}
              tooltip={
                hasExpected ? formatCurrency(expectedUsd, "USD") : undefined
              }
            />
          </div>

          <RatioDonut pct={ratioPct} color={tone.solid} textColor={tone.text} />
        </div>

        {/* Variance pill — tone reflects expense direction */}
        <div
          className="mt-3.5 flex items-center justify-between gap-2 px-3 py-2 rounded-xl"
          style={{
            backgroundColor: tone.bg,
            boxShadow: `inset 0 0 0 1px ${tone.ring}`,
            color: tone.text,
          }}
          title={
            hasExpected && hasRealized
              ? `Tahmini ${formatCurrency(expectedUsd, "USD")}, Gerçekleşen ${formatCurrency(realized.usdTotal, "USD")} → fark ${variance >= 0 ? "+" : ""}${formatCurrency(variance, "USD")}`
              : undefined
          }
        >
          <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider">
            <VarIcon className="size-3.5" strokeWidth={2.5} />
            {tone.label}
          </span>
          {hasExpected && hasRealized && (
            <span className="text-[13px] font-bold tabular-nums">
              {variance >= 0 ? "+" : "−"}
              {formatCompactCurrency(Math.abs(variance), "USD")}
              {variancePct != null && (
                <span className="text-[11.5px] font-semibold opacity-80 ml-1.5">
                  ({variance >= 0 ? "+" : "−"}
                  {formatNumber(Math.abs(variancePct), 1)}%)
                </span>
              )}
            </span>
          )}
        </div>

        {realized.rowCount > 0 && (
          <div className="text-[10px] text-muted-foreground mt-2 italic">
            {realized.rowCount} gerçekleşen masraf kaydı
          </div>
        )}
      </div>
    </GlassPanel>
  );
}

/* ─────────── Tone ─────────── */

interface ExpTone {
  solid: string;
  text: string;
  bg: string;
  ring: string;
  Icon: typeof Minus;
  label: string;
}

function pickTone(
  hasExpected: boolean,
  hasRealized: boolean,
  variance: number
): ExpTone {
  const slate: ExpTone = {
    solid: "rgb(100 116 139)",
    text: "rgb(71 85 105)",
    bg: "rgba(100,116,139,0.12)",
    ring: "rgba(100,116,139,0.30)",
    Icon: Minus,
    label: !hasRealized
      ? hasExpected
        ? "Henüz gerçekleşen yok"
        : "Veri yok"
      : "Tahmini gider girilmemiş",
  };
  if (!hasExpected || !hasRealized) return slate;
  if (variance < 0)
    return {
      solid: "rgb(5 150 105)", // emerald-600
      text: "rgb(4 120 87)", // emerald-700
      bg: "rgba(16,185,129,0.12)",
      ring: "rgba(16,185,129,0.30)",
      Icon: TrendingDown,
      label: "Bütçenin altında",
    };
  if (variance > 0)
    return {
      solid: "rgb(225 29 72)", // rose-600
      text: "rgb(159 18 57)", // rose-700
      bg: "rgba(244,63,94,0.12)",
      ring: "rgba(244,63,94,0.30)",
      Icon: TrendingUp,
      label: "Bütçenin üstünde",
    };
  return { ...slate, Icon: Minus, label: "Hedefinde" };
}

/* ─────────── Bar row ─────────── */

function BarRow({
  label,
  widthPct,
  fill,
  value,
  valueTone,
  tooltip,
  reduceMotion,
}: {
  label: string;
  widthPct: number;
  fill: string;
  value: string;
  valueTone: string;
  tooltip?: string;
  reduceMotion: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5 min-w-0" title={tooltip}>
      <span
        // lang="en": bar labels are English ("Realized"/"Planned"). CSS
        // `uppercase` in the page's tr locale turned "Realized" into
        // "REALİZED" (i→İ); lang="en" forces "REALIZED".
        lang="en"
        className="w-[74px] shrink-0 text-[9.5px] uppercase tracking-wider text-muted-foreground"
      >
        {label}
      </span>
      <div
        className="flex-1 h-2.5 rounded-full overflow-hidden"
        style={{
          background: "rgba(15,23,42,0.06)",
          boxShadow:
            "inset 0 1px 1px 0 rgba(15,23,42,0.08), inset 0 -1px 0 0 rgba(255,255,255,0.6)",
        }}
      >
        <motion.div
          className="h-full rounded-full"
          initial={reduceMotion ? false : { width: 0 }}
          animate={{ width: `${Math.max(0, Math.min(100, widthPct))}%` }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          style={{
            background: `linear-gradient(90deg, ${fill} 0%, color-mix(in oklab, ${fill} 80%, white 20%) 100%)`,
            boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.35)",
          }}
        />
      </div>
      <span
        className="w-[56px] shrink-0 text-right text-[12.5px] font-bold tabular-nums"
        style={{ color: valueTone }}
      >
        {value}
      </span>
    </div>
  );
}

/* ─────────── Ratio donut ─────────── */

/** Compact donut-centre label. Caps at ±999% so a tiny-planned-cost
 *  blow-up (e.g. 155.000%) can't overflow the ring. */
function ratioLabel(pct: number | null): string {
  if (pct == null) return "—";
  if (Math.abs(pct) >= 1000) return `${pct < 0 ? "−" : ""}%999+`;
  return `%${Math.round(pct)}`;
}

/**
 * Radial ratio donut — realized ÷ expected %. The arc fills over a
 * 0-150% domain (so 100% sits ~2/3 round and "over budget" reads as a
 * fuller, redder ring); the centre prints the % (capped via
 * `ratioLabel`). A 100% tick is not drawn — the colour already says
 * under/over.
 */
function RatioDonut({
  pct,
  color,
  textColor,
}: {
  pct: number | null;
  color: string;
  textColor: string;
}) {
  const SIZE = 78;
  const R = 30;
  const STROKE = 9;
  const C = 2 * Math.PI * R;
  const DOMAIN = 150;
  const frac = pct == null ? 0 : Math.max(0, Math.min(1, pct / DOMAIN));
  const dash = frac * C;

  return (
    <div
      className="relative shrink-0 grid place-items-center"
      style={{ width: SIZE, height: SIZE }}
      title={pct != null ? `Gerçekleşen / Tahmini = %${formatNumber(pct, 1)}` : undefined}
    >
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {/* Track */}
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke="rgba(15,23,42,0.08)"
          strokeWidth={STROKE}
        />
        {/* Value arc — starts at 12 o'clock, clockwise */}
        {pct != null && (
          <motion.circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            strokeDasharray={`${dash} ${C}`}
            initial={{ strokeDasharray: `0 ${C}` }}
            animate={{ strokeDasharray: `${dash} ${C}` }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          />
        )}
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span
          className="text-[13px] font-bold tabular-nums leading-none px-1 text-center"
          style={{ color: pct != null ? textColor : "rgb(148 163 184)" }}
        >
          {ratioLabel(pct)}
        </span>
      </div>
    </div>
  );
}
