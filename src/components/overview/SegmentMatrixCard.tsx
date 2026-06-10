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
 * "Segmentlere Göre Gemi Sayıları" — Segment × Group count matrix.
 * Top-N segments by total + a folded "Diğer" row + a TOPLAM footer
 * whose column sums cover ALL segments (not just the visible rows).
 * Group columns are headed by their fixed semantic colour dots.
 */
export function SegmentMatrixCard({ matrix }: { matrix: SegmentMatrix }) {
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
          Segment × grup kırılımı · projeye göre
        </p>
      </div>

      <div className="flex-1 px-2 pb-3 overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-left px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Segment
              </th>
              {GROUP_ORDER.map((g) => (
                <th
                  key={g}
                  className="px-2 py-1.5 text-right whitespace-nowrap"
                  title={GROUP_META[g].label}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      aria-hidden
                      className="size-1.5 rounded-full"
                      style={{ background: GROUP_META[g].solid }}
                    />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {g === "International" ? "Intl" : g}
                    </span>
                  </span>
                </th>
              ))}
              <th className="px-2 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wider text-foreground/80">
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
                    className={cn(
                      "border-t border-border/30 hover:bg-foreground/[0.025] transition-colors",
                      isOther && "text-muted-foreground"
                    )}
                  >
                    <td className="px-2 py-1.5" title={row.segment}>
                      {/* truncate lives on an inner block — max-width on a
                          <td> under auto table layout is unreliable
                          (ignored by Firefox), so the cell would stretch
                          instead of ellipsizing. */}
                      <span
                        className={cn(
                          "block text-[12.5px] truncate max-w-[160px]",
                          isOther
                            ? "italic"
                            : "font-medium text-foreground/90"
                        )}
                      >
                        {row.segment}
                      </span>
                    </td>
                    {GROUP_ORDER.map((g) => (
                      <td
                        key={g}
                        className="px-2 py-1.5 text-right text-[12.5px] tabular-nums"
                      >
                        {row.counts[g] > 0 ? (
                          <span style={{ color: GROUP_META[g].solid }}>
                            {row.counts[g]}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-right text-[12.5px] font-bold tabular-nums text-foreground">
                      {row.total}
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
