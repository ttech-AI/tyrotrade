import { ArrowUpRight } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Layers01Icon } from "@hugeicons/core-free-icons";
import { GlassPanel } from "@/components/glass/GlassPanel";
import {
  GROUP_META,
  type GroupSegmentColumn,
  type VesselGroup,
} from "@/lib/selectors/overview";

/**
 * "Gruplara Göre Segment Dağılımı" — three side-by-side columns (one per
 * group) listing that group's segments by project count, with a folded
 * "Diğer" row beyond the top-N and a TOPLAM footer. Fully interactive:
 * the column header opens Sefer Takibi filtered to the whole group, and
 * each segment row opens it filtered to that single segment.
 */
export function GroupSegmentColumns({
  columns,
  onGroupClick,
  onSegmentClick,
}: {
  columns: GroupSegmentColumn[];
  onGroupClick: (group: VesselGroup) => void;
  onSegmentClick: (segment: string) => void;
}) {
  // Columns ranked by project count (desc) — mirrors the KPI-row order
  // so the biggest book (International) leads here too.
  const sorted = [...columns].sort((a, b) => b.total - a.total);
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
          Grup başlığına veya segmente tıkla → Sefer Takibi'nde filtrele
        </p>
      </div>

      <div className="flex-1 px-3 pb-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {sorted.map((col) => {
          const meta = GROUP_META[col.group];
          return (
            <div
              key={col.group}
              className="rounded-xl border border-border/40 flex flex-col overflow-hidden"
              style={{ background: meta.tint }}
            >
              {/* Column header — whole-group deep link */}
              <button
                type="button"
                onClick={() => onGroupClick(col.group)}
                title={`${meta.label} projelerini Sefer Takibi'nde aç`}
                className="group px-3 py-2 flex items-center gap-2 border-b text-left transition-colors hover:bg-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                style={{ borderColor: meta.ring }}
              >
                <span
                  aria-hidden
                  className="size-2 rounded-full shrink-0"
                  style={{ background: meta.solid }}
                />
                <span
                  // lang="en" on International — CSS `uppercase` under
                  // the tr locale would render "INTERNATİONAL".
                  lang={col.group === "International" ? "en" : undefined}
                  className="text-[11px] font-bold uppercase tracking-wide truncate flex-1"
                  style={{ color: meta.solid }}
                >
                  {meta.label}
                </span>
                <ArrowUpRight
                  aria-hidden
                  className="size-3 shrink-0 opacity-0 -translate-x-0.5 group-hover:opacity-70 group-hover:translate-x-0 transition-all"
                  strokeWidth={2.25}
                  style={{ color: meta.solid }}
                />
              </button>
              {/* Segment rows — per-segment deep links */}
              <div className="flex-1 px-1.5 py-1">
                {col.rows.length === 0 ? (
                  <p className="text-[11.5px] text-muted-foreground py-2 px-1.5">
                    Bu grupta proje yok
                  </p>
                ) : (
                  <>
                    {col.rows.map((r) => (
                      <button
                        key={r.segment}
                        type="button"
                        onClick={() => onSegmentClick(r.segment)}
                        title={`${r.segment} segmentini Sefer Takibi'nde aç`}
                        className="group w-full flex items-center justify-between gap-2 rounded-lg px-1.5 py-1 min-w-0 text-left transition-colors hover:bg-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      >
                        <span
                          className="text-[12px] text-foreground/85 truncate min-w-0"
                          title={r.segment}
                        >
                          {r.segment}
                        </span>
                        <span className="inline-flex items-center gap-1 shrink-0">
                          <span className="text-[12px] font-bold tabular-nums text-foreground">
                            {r.count}
                          </span>
                          <ArrowUpRight
                            aria-hidden
                            className="size-2.5 text-muted-foreground/50 opacity-0 -translate-x-0.5 group-hover:opacity-100 group-hover:translate-x-0 transition-all"
                            strokeWidth={2.25}
                          />
                        </span>
                      </button>
                    ))}
                    {col.otherCount > 0 && (
                      <div className="flex items-center justify-between gap-2 px-1.5 py-1 text-muted-foreground">
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
