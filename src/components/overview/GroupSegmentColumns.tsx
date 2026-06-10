import { HugeiconsIcon } from "@hugeicons/react";
import { Layers01Icon } from "@hugeicons/core-free-icons";
import { GlassPanel } from "@/components/glass/GlassPanel";
import {
  GROUP_META,
  type GroupSegmentColumn,
} from "@/lib/selectors/overview";

/**
 * "Gruplara Göre Segment Dağılımı" — three side-by-side columns (one per
 * group) listing that group's segments by project count, with a folded
 * "Diğer" row beyond the top-N and a TOPLAM footer. Column headers wear
 * the group's fixed semantic colour so the eye can chain this card to
 * the donut + matrix above it.
 */
export function GroupSegmentColumns({
  columns,
}: {
  columns: GroupSegmentColumn[];
}) {
  return (
    <GlassPanel tone="default" className="rounded-2xl h-full flex flex-col">
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <HugeiconsIcon
            icon={Layers01Icon}
            size={16}
            strokeWidth={1.75}
            className="text-muted-foreground"
          />
          <h3 className="text-sm font-bold text-slate-900">
            Gruplara Göre Segment Dağılımı
          </h3>
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Her grubun en yoğun segmentleri
        </p>
      </div>

      <div className="flex-1 px-3 pb-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {columns.map((col) => {
          const meta = GROUP_META[col.group];
          return (
            <div
              key={col.group}
              className="rounded-xl border border-border/40 flex flex-col overflow-hidden"
              style={{ background: meta.tint }}
            >
              {/* Column header */}
              <div
                className="px-3 py-2 flex items-center gap-2 border-b"
                style={{ borderColor: meta.ring }}
              >
                <span
                  aria-hidden
                  className="size-2 rounded-full shrink-0"
                  style={{ background: meta.solid }}
                />
                <span
                  className="text-[11px] font-bold uppercase tracking-wide truncate"
                  style={{ color: meta.solid }}
                >
                  {meta.label}
                </span>
              </div>
              {/* Segment rows */}
              <div className="flex-1 px-3 py-1.5">
                {col.rows.length === 0 ? (
                  <p className="text-[11.5px] text-muted-foreground py-2">
                    Bu grupta proje yok
                  </p>
                ) : (
                  <>
                    {col.rows.map((r) => (
                      <div
                        key={r.segment}
                        className="flex items-center justify-between gap-2 py-1 min-w-0"
                      >
                        <span
                          className="text-[12px] text-foreground/85 truncate min-w-0"
                          title={r.segment}
                        >
                          {r.segment}
                        </span>
                        <span className="text-[12px] font-bold tabular-nums text-foreground shrink-0">
                          {r.count}
                        </span>
                      </div>
                    ))}
                    {col.otherCount > 0 && (
                      <div className="flex items-center justify-between gap-2 py-1 text-muted-foreground">
                        <span className="text-[12px] italic">Diğer</span>
                        <span className="text-[12px] font-semibold tabular-nums">
                          {col.otherCount}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
              {/* TOPLAM footer */}
              <div
                className="px-3 py-1.5 flex items-center justify-between border-t"
                style={{ borderColor: meta.ring }}
              >
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-foreground/70">
                  Toplam
                </span>
                <span
                  className="text-[13px] font-bold tabular-nums"
                  style={{ color: meta.solid }}
                >
                  {col.total}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </GlassPanel>
  );
}
