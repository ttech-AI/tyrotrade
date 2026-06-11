import * as React from "react";
import { ArrowUpRight } from "lucide-react";
import { GlassPanel } from "@/components/glass/GlassPanel";

/**
 * Compact insight chip strip under the KPI row — 3-5 auto-derived
 * callouts ("En büyük grup: …", "Ödeme bekleyen: …"). Deliberately
 * LIGHTER than the Trade Cost insights ribbon (no gradient chips /
 * tooltips): plain dot + bold lead + muted tail on a subtle glass
 * strip. Chips with an `onClick` render as buttons that apply the
 * matching filter to the page's own state.
 */
export interface OverviewInsight {
  /** Dot colour (hex / rgba). */
  color: string;
  /** Bold lead, e.g. "En büyük grup". */
  lead: string;
  /** Muted tail, e.g. "International · 20 proje (%32,3)". */
  tail: string;
  /** Optional in-page filter action — chip becomes a button when present. */
  onClick?: () => void;
  /** Right-click → "Detaya git" context menu (Sefer Takibi). */
  onContext?: (e: React.MouseEvent) => void;
}

export function OverviewInsights({
  insights,
}: {
  insights: OverviewInsight[];
}) {
  if (insights.length === 0) return null;
  return (
    <GlassPanel tone="subtle" className="rounded-xl">
      <div className="px-2.5 py-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        {insights.map((ins, i) => {
          const inner = (
            <>
              <span
                aria-hidden
                className="size-1.5 rounded-full shrink-0"
                style={{ background: ins.color }}
              />
              <span className="font-semibold text-foreground/90 shrink-0">
                {ins.lead}:
              </span>
              <span className="text-muted-foreground truncate">
                {ins.tail}
              </span>
            </>
          );
          if (ins.onClick) {
            return (
              <button
                key={i}
                type="button"
                onClick={ins.onClick}
                onContextMenu={ins.onContext}
                title="Sayfayı bu veriye göre filtrele · sağ tık → detaya git"
                className="group inline-flex items-center gap-1.5 min-w-0 text-[12px] rounded-lg px-1.5 py-1 hover:bg-foreground/[0.05] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                {inner}
                <ArrowUpRight
                  aria-hidden
                  className="size-3 shrink-0 text-muted-foreground/50 opacity-0 -translate-x-0.5 group-hover:opacity-100 group-hover:translate-x-0 transition-all"
                  strokeWidth={2.25}
                />
              </button>
            );
          }
          return (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 min-w-0 text-[12px] px-1.5 py-1"
            >
              {inner}
            </span>
          );
        })}
      </div>
    </GlassPanel>
  );
}
