import { GlassPanel } from "@/components/glass/GlassPanel";

/**
 * Compact insight chip strip under the KPI row — 3-5 auto-derived
 * callouts ("En büyük grup: …", "Ödeme bekleyen: …"). Deliberately
 * LIGHTER than the Trade Cost insights ribbon (no gradient chips /
 * tooltips): plain dot + bold lead + muted tail on a subtle glass
 * strip, since these are status facts rather than clickable insights.
 */
export interface OverviewInsight {
  /** Dot colour (hex / rgba). */
  color: string;
  /** Bold lead, e.g. "En büyük grup". */
  lead: string;
  /** Muted tail, e.g. "International · 20 proje (%32,3)". */
  tail: string;
}

export function OverviewInsights({
  insights,
}: {
  insights: OverviewInsight[];
}) {
  if (insights.length === 0) return null;
  return (
    <GlassPanel tone="subtle" className="rounded-xl">
      <div className="px-3.5 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5">
        {insights.map((ins, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1.5 min-w-0 text-[12px]"
          >
            <span
              aria-hidden
              className="size-1.5 rounded-full shrink-0"
              style={{ background: ins.color }}
            />
            <span className="font-semibold text-foreground/90 shrink-0">
              {ins.lead}:
            </span>
            <span className="text-muted-foreground truncate">{ins.tail}</span>
          </span>
        ))}
      </div>
    </GlassPanel>
  );
}
