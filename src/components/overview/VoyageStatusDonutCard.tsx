import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { PieChartIcon } from "@hugeicons/core-free-icons";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { formatNumber } from "@/lib/format";
import type { VoyageStatusAggregate } from "@/lib/selectors/overview";

/**
 * "Sefer Durumuna Göre Gemi Sayıları" — interactive multi-segment SVG
 * donut over the voyage-status distribution (To Be Nominated →
 * Cancelled lifecycle, app-standard status colours).
 *
 * Interactions (legend ↔ chart in sync):
 *   - hover a slice OR its legend row → that slice thickens, the others
 *     dim, and the centre label swaps to the hovered status
 *   - click a slice / legend row → that status becomes THIS PAGE's
 *     voyage-status filter (re-click restores the default trio;
 *     "Diğer" catch-all is informational, not clickable)
 *
 * Hand-rolled SVG (same family as RatioDonut): full control over the
 * draw-in animation, hover geometry and exact status hexes. Legend rows
 * are real <button>s so keyboard users get the same navigation.
 */

const SIZE = 176;
const STROKE = 22;
/** Hovered ring thickness — outer edge stays inside the viewBox:
 *  R + HOVER_STROKE/2 = 72 + 15 = 87 < SIZE/2 = 88. */
const HOVER_STROKE = 30;
const R = (SIZE - 32) / 2;
const C = 2 * Math.PI * R;
/** Breathing room between segments (px of circumference) — works with
 *  strokeLinecap="butt"; round caps would overflow by STROKE/2. */
const GAP = 3;

export function VoyageStatusDonutCard({
  agg,
  onStatusClick,
  onStatusContext,
}: {
  agg: VoyageStatusAggregate;
  onStatusClick: (status: string) => void;
  /** Right-click → "Detaya git" context menu (Sefer Takibi). */
  onStatusContext?: (status: string, e: React.MouseEvent) => void;
}) {
  const reduceMotion = useReducedMotion();
  const [hovered, setHovered] = React.useState<string | null>(null);
  const total = agg.total;
  const visible = agg.rows.filter((r) => r.count > 0);
  const hoveredRow = hovered
    ? visible.find((r) => r.status === hovered)
    : undefined;

  // Cumulative arc segments (12 o'clock origin via -90° group rotate).
  let cursor = 0;
  const segments = visible.map((row) => {
    const frac = total > 0 ? row.count / total : 0;
    const raw = frac * C;
    const len = visible.length > 1 ? Math.max(0, raw - GAP) : raw;
    const start = cursor + (visible.length > 1 ? GAP / 2 : 0);
    cursor += raw;
    return { row, len, start };
  });

  return (
    <GlassPanel tone="default" className="rounded-2xl h-full flex flex-col">
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <HugeiconsIcon
            icon={PieChartIcon}
            size={16}
            strokeWidth={1.75}
            className="text-muted-foreground"
          />
          <h3 className="text-sm font-bold text-slate-900">
            Sefer Durumuna Göre Gemi Sayıları
          </h3>
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Dilime veya duruma tıkla → sayfayı filtrele (tekrar tıkla → kaldır)
        </p>
      </div>

      <div className="flex-1 px-4 pb-4 flex flex-col items-center justify-center gap-4">
        {/* Donut */}
        <div
          className="relative"
          style={{ width: SIZE, height: SIZE }}
          onMouseLeave={() => setHovered(null)}
        >
          <svg
            width={SIZE}
            height={SIZE}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            role="img"
            aria-label={`Toplam ${total} proje — sefer durumu dağılımı`}
          >
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              fill="none"
              stroke="rgba(15,23,42,0.06)"
              strokeWidth={STROKE}
            />
            <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
              {segments.map(({ row, len, start }) => {
                const isHovered = hovered === row.status;
                const isDimmed = hovered !== null && !isHovered;
                return (
                  <motion.circle
                    key={row.status}
                    cx={SIZE / 2}
                    cy={SIZE / 2}
                    r={R}
                    fill="none"
                    stroke={row.color}
                    strokeLinecap="butt"
                    strokeDashoffset={-start}
                    className={row.clickable ? "cursor-pointer" : undefined}
                    onMouseEnter={() => setHovered(row.status)}
                    onClick={
                      row.clickable
                        ? () => onStatusClick(row.status)
                        : undefined
                    }
                    onContextMenu={
                      row.clickable && onStatusContext
                        ? (e) => onStatusContext(row.status, e)
                        : undefined
                    }
                    initial={
                      reduceMotion
                        ? false
                        : { strokeDasharray: `0 ${C}`, strokeWidth: STROKE }
                    }
                    animate={{
                      strokeDasharray: `${len} ${C - len}`,
                      strokeWidth: isHovered ? HOVER_STROKE : STROKE,
                      opacity: isDimmed ? 0.3 : 1,
                    }}
                    transition={{
                      strokeDasharray: {
                        duration: 0.8,
                        ease: [0.22, 1, 0.36, 1],
                        delay: 0.15,
                      },
                      strokeWidth: { duration: 0.18 },
                      opacity: { duration: 0.18 },
                    }}
                  >
                    <title>{`${row.status}: ${row.count} proje (%${formatNumber(row.pct, 1)})`}</title>
                  </motion.circle>
                );
              })}
            </g>
          </svg>
          {/* Centre label — swaps between total and hovered status */}
          <div className="absolute inset-0 grid place-items-center pointer-events-none">
            <AnimatePresence mode="wait" initial={false}>
              {hoveredRow ? (
                <motion.div
                  key={hoveredRow.status}
                  initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="text-center px-4"
                >
                  <div
                    className="text-[26px] font-semibold leading-none tracking-tight tabular-nums"
                    style={{ color: hoveredRow.color }}
                  >
                    {hoveredRow.count}
                  </div>
                  <div
                    lang="en"
                    className="text-[9.5px] uppercase tracking-wider mt-1 font-semibold leading-tight"
                    style={{ color: hoveredRow.color }}
                  >
                    {hoveredRow.status} · %{formatNumber(hoveredRow.pct, 1)}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="total"
                  initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="text-center"
                >
                  <div className="text-[26px] font-semibold leading-none tracking-tight tabular-nums text-foreground">
                    {total}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
                    Proje
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Legend — buttons, hover-synced with the chart */}
        <div className="w-full space-y-0.5">
          {visible.map((row) => {
            const isDimmed = hovered !== null && hovered !== row.status;
            const inner = (
              <>
                <span
                  aria-hidden
                  className="size-2 rounded-full shrink-0"
                  style={{ background: row.color }}
                />
                <span
                  lang="en"
                  className="text-[12px] font-medium text-foreground/85 truncate min-w-0 flex-1"
                >
                  {row.status}
                </span>
                <span className="text-[12px] font-bold tabular-nums text-foreground">
                  {row.count}
                </span>
                <span
                  className="text-[11px] font-semibold tabular-nums w-[44px] text-right"
                  style={{ color: row.color }}
                >
                  %{formatNumber(row.pct, 1)}
                </span>
              </>
            );
            if (!row.clickable) {
              return (
                <div
                  key={row.status}
                  className="w-full flex items-center gap-2 rounded-lg px-2 py-1 opacity-80"
                  style={{ opacity: isDimmed ? 0.45 : undefined }}
                  onMouseEnter={() => setHovered(row.status)}
                  onMouseLeave={() => setHovered(null)}
                >
                  {inner}
                </div>
              );
            }
            return (
              <button
                key={row.status}
                type="button"
                onClick={() => onStatusClick(row.status)}
                onContextMenu={
                  onStatusContext
                    ? (e) => onStatusContext(row.status, e)
                    : undefined
                }
                onMouseEnter={() => setHovered(row.status)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(row.status)}
                onBlur={() => setHovered(null)}
                title={`${row.status} seferlerine göre filtrele · sağ tık → detaya git`}
                className="group w-full flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-foreground/[0.04] transition-all text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                style={{ opacity: isDimmed ? 0.45 : 1 }}
              >
                {inner}
                <ArrowUpRight
                  aria-hidden
                  className="size-3 shrink-0 text-muted-foreground/50 opacity-0 -translate-x-0.5 group-hover:opacity-100 group-hover:translate-x-0 transition-all"
                  strokeWidth={2.25}
                />
              </button>
            );
          })}
        </div>
      </div>
    </GlassPanel>
  );
}
