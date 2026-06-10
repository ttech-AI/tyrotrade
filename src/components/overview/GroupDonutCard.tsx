import { motion, useReducedMotion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import { PieChartIcon } from "@hugeicons/core-free-icons";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { formatNumber } from "@/lib/format";
import {
  GROUP_META,
  type OverviewGroupAggregate,
} from "@/lib/selectors/overview";

/**
 * "Gruplara Göre Gemi Sayıları" — multi-segment SVG donut (same
 * hand-rolled stroke-dasharray approach as RatioDonut in
 * ExpectedRealizedExpenseCard, extended to 3 segments) + legend rows
 * with count, share % and a thin per-group bar.
 *
 * Custom SVG instead of a recharts Pie: full control over the animated
 * draw-in, the centre label, and the exact group hex palette — and no
 * new chart-library surface for a single visual.
 */

const SIZE = 168;
const STROKE = 24;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;
/** Visual breathing room between segments (px of circumference).
 *  Works with strokeLinecap="butt" — round caps would extend each dash
 *  end by STROKE/2 (12px), swallowing the gap AND inflating tiny
 *  segments into oversized dots. */
const GAP = 3;

export function GroupDonutCard({ agg }: { agg: OverviewGroupAggregate }) {
  const reduceMotion = useReducedMotion();
  const total = agg.total;
  const visible = agg.rows.filter((r) => r.count > 0);

  // Build cumulative arc segments. Each segment shrinks by GAP so
  // neighbours don't touch; single-segment case draws the full ring.
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
            Gruplara Göre Gemi Sayıları
          </h3>
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Segment ön ekine göre grup dağılımı
        </p>
      </div>

      <div className="flex-1 px-4 pb-4 flex flex-col items-center justify-center gap-4">
        {/* Donut */}
        <div className="relative" style={{ width: SIZE, height: SIZE }}>
          <svg
            width={SIZE}
            height={SIZE}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            role="img"
            aria-label={`Toplam ${total} proje — grup dağılımı`}
          >
            {/* Track */}
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              fill="none"
              stroke="rgba(15,23,42,0.06)"
              strokeWidth={STROKE}
            />
            {/* Segments — rotated -90° so 12 o'clock is the origin */}
            <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
              {segments.map(({ row, len, start }) => (
                <motion.circle
                  key={row.group}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={R}
                  fill="none"
                  stroke={GROUP_META[row.group].solid}
                  strokeWidth={STROKE}
                  strokeLinecap="butt"
                  strokeDasharray={`${len} ${C - len}`}
                  strokeDashoffset={-start}
                  initial={
                    reduceMotion
                      ? false
                      : { strokeDasharray: `0 ${C}` }
                  }
                  animate={{ strokeDasharray: `${len} ${C - len}` }}
                  transition={{
                    duration: 0.8,
                    ease: [0.22, 1, 0.36, 1],
                    delay: 0.15,
                  }}
                />
              ))}
            </g>
          </svg>
          {/* Centre label */}
          <div className="absolute inset-0 grid place-items-center pointer-events-none">
            <div className="text-center">
              <div className="text-[26px] font-semibold leading-none tracking-tight tabular-nums text-foreground">
                {total}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
                Proje
              </div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="w-full space-y-2">
          {agg.rows.map((row) => {
            const meta = GROUP_META[row.group];
            return (
              <div key={row.group} className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="size-2 rounded-full shrink-0"
                  style={{ background: meta.solid }}
                />
                <span className="text-[12px] font-medium text-foreground/85 truncate min-w-0 flex-1">
                  {meta.label}
                </span>
                <span className="text-[12px] font-bold tabular-nums text-foreground">
                  {row.count}
                </span>
                <span
                  className="text-[11px] font-semibold tabular-nums w-[44px] text-right"
                  style={{ color: meta.solid }}
                >
                  %{formatNumber(row.pct, 1)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </GlassPanel>
  );
}
