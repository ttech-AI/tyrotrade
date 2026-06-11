import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { GridTableIcon } from "@hugeicons/core-free-icons";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { cn } from "@/lib/utils";
import {
  GROUP_META,
  GROUP_ORDER,
  type SegmentMatrix,
} from "@/lib/selectors/overview";

/**
 * "Segmentlere Göre Gemi Sayıları" — Segment × Group count matrix,
 * premium edition:
 *   - every segment row carries a thin animated stacked bar (group
 *     colours, width ∝ share) under the name, so the distribution is
 *     readable without scanning the number columns
 *   - the TOPLAM column draws a soft data-bar behind each value
 *     (length ∝ the largest row) — classic BI affordance
 *   - rows are buttons: hover lift + arrow, click applies that segment
 *     to THIS PAGE's filter (re-click toggles off; "Diğer" is
 *     informational, not clickable)
 * Column totals cover ALL segments, not just the visible top-N.
 */
export function SegmentMatrixCard({
  matrix,
  onSegmentClick,
  onSegmentContext,
}: {
  matrix: SegmentMatrix;
  onSegmentClick: (segment: string) => void;
  /** Right-click → "Detaya git" context menu (Sefer Takibi). */
  onSegmentContext?: (segment: string, e: React.MouseEvent) => void;
}) {
  const reduceMotion = useReducedMotion();
  const maxRowTotal = Math.max(
    1,
    ...matrix.rows.map((r) => r.total),
    matrix.other?.total ?? 0
  );

  return (
    <GlassPanel tone="default" className="rounded-2xl h-full flex flex-col">
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <HugeiconsIcon
            icon={GridTableIcon}
            size={16}
            strokeWidth={1.75}
            className="text-muted-foreground"
          />
          <h3 className="text-sm font-bold text-slate-900">
            Segmentlere Göre Gemi Sayıları
          </h3>
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Satıra tıkla → segmente göre filtrele (tekrar tıkla → kaldır)
        </p>
      </div>

      <div className="flex-1 px-2 pb-3 overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse">
          <thead>
            <tr className="bg-foreground/[0.025]">
              <th className="text-left px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground rounded-l-lg">
                Segment
              </th>
              {GROUP_ORDER.map((g) => (
                <th
                  key={g}
                  className="px-2 py-2 text-right whitespace-nowrap"
                  title={GROUP_META[g].label}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      aria-hidden
                      className="size-1.5 rounded-full"
                      style={{ background: GROUP_META[g].solid }}
                    />
                    <span
                      // lang="en": tr-locale CSS uppercase would render
                      // the "Intl" shorthand as "İNTL".
                      lang={g === "International" ? "en" : undefined}
                      className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      {g === "International" ? "Intl" : g}
                    </span>
                  </span>
                </th>
              ))}
              <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-foreground/80 rounded-r-lg">
                Toplam
              </th>
            </tr>
          </thead>
          <tbody>
            {[...matrix.rows, ...(matrix.other ? [matrix.other] : [])].map(
              (row, i) => {
                const isOther = matrix.other != null && row === matrix.other;
                return (
                  <tr
                    key={`${row.segment}-${i}`}
                    onClick={
                      isOther ? undefined : () => onSegmentClick(row.segment)
                    }
                    onContextMenu={
                      isOther || !onSegmentContext
                        ? undefined
                        : (e) => onSegmentContext(row.segment, e)
                    }
                    title={
                      isOther
                        ? undefined
                        : `${row.segment} segmentine göre filtrele · sağ tık → detaya git`
                    }
                    className={cn(
                      "group border-t border-border/30 transition-colors",
                      isOther
                        ? "text-muted-foreground"
                        : "cursor-pointer hover:bg-foreground/[0.035]"
                    )}
                  >
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={cn(
                            "block text-[12.5px] truncate max-w-[150px]",
                            isOther
                              ? "italic"
                              : "font-medium text-foreground/90"
                          )}
                        >
                          {row.segment}
                        </span>
                        {!isOther && (
                          <ArrowUpRight
                            aria-hidden
                            className="size-3 shrink-0 text-muted-foreground/50 opacity-0 -translate-x-0.5 group-hover:opacity-100 group-hover:translate-x-0 transition-all"
                            strokeWidth={2.25}
                          />
                        )}
                      </div>
                      {/* Per-row stacked distribution bar */}
                      <div
                        className="mt-1 h-1 w-full max-w-[150px] rounded-full overflow-hidden flex"
                        style={{ background: "rgba(15,23,42,0.05)" }}
                        aria-hidden
                      >
                        {GROUP_ORDER.map((g) =>
                          row.counts[g] > 0 ? (
                            <motion.span
                              key={g}
                              className="h-full"
                              initial={
                                reduceMotion ? false : { width: "0%" }
                              }
                              animate={{
                                width: `${(row.counts[g] / row.total) * 100}%`,
                              }}
                              transition={{
                                duration: 0.6,
                                ease: [0.22, 1, 0.36, 1],
                                delay: 0.1 + i * 0.04,
                              }}
                              style={{ background: GROUP_META[g].solid }}
                            />
                          ) : null
                        )}
                      </div>
                    </td>
                    {GROUP_ORDER.map((g) => (
                      <td
                        key={g}
                        className="px-2 py-2 text-right text-[12.5px] tabular-nums align-top"
                      >
                        {row.counts[g] > 0 ? (
                          <span
                            className="font-semibold"
                            style={{ color: GROUP_META[g].solid }}
                          >
                            {row.counts[g]}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                    ))}
                    {/* TOPLAM with a soft data-bar behind the value */}
                    <td className="px-2 py-2 align-top">
                      <div className="relative flex items-center justify-end min-w-[52px]">
                        <motion.span
                          aria-hidden
                          className="absolute inset-y-0 right-0 rounded-md"
                          style={{ background: "rgba(15,23,42,0.05)" }}
                          initial={reduceMotion ? false : { width: 0 }}
                          animate={{
                            width: `${(row.total / maxRowTotal) * 100}%`,
                          }}
                          transition={{
                            duration: 0.6,
                            ease: [0.22, 1, 0.36, 1],
                            delay: 0.1 + i * 0.04,
                          }}
                        />
                        <span className="relative text-[12.5px] font-bold tabular-nums text-foreground px-1">
                          {row.total}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              }
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border/60">
              <td className="px-2 py-2 text-[11px] font-bold uppercase tracking-wider text-foreground/80">
                Toplam
              </td>
              {GROUP_ORDER.map((g) => (
                <td
                  key={g}
                  className="px-2 py-2 text-right text-[12.5px] font-bold tabular-nums"
                  style={{ color: GROUP_META[g].solid }}
                >
                  {matrix.columnTotals[g]}
                </td>
              ))}
              <td className="px-2 py-2 text-right text-[13px] font-bold tabular-nums text-foreground">
                {matrix.grandTotal}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </GlassPanel>
  );
}
