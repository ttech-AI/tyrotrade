import { HugeiconsIcon } from "@hugeicons/react";
import { Calendar03Icon } from "@hugeicons/core-free-icons";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AccentIconBadge, TONE_PL } from "@/components/details/AccentIconBadge";
import { useT } from "@/lib/i18n/LanguageProvider";
import { formatNumber, formatCurrency } from "@/lib/format";
import type { PowerBIPLSegmentRow } from "@/data/powerbiPL";

const EST = "#2563eb"; // projected / tahmini (brand blue)
const REAL = "#059669"; // realized / gerçekleşen (emerald)
const POS = "#047857";
const NEG = "#be123c";
const NEUTRAL = "#475569";

export interface PowerBIPLDetail {
  monthKey: string;
  monthLabel: string;
  segments: PowerBIPLSegmentRow[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: PowerBIPLDetail | null;
}

const usd = (v: number) => formatCurrency(v, "USD", { maximumFractionDigits: 0 });
const plColor = (v: number) => (v > 0 ? POS : v < 0 ? NEG : NEUTRAL);

/**
 * Segment drill-down for the "Power BI Version" table. Mirrors the live
 * RealizedPLDetailSheet chrome (icon badge + summary strip) but the body is
 * the per-segment matrix straight from the Power BI detailed export:
 * Segment × (Projected P&L, Live Realized P&L, Projected Budget).
 */
export function PowerBIPLDetailSheet({ open, onOpenChange, detail }: Props) {
  const t = useT();

  const segments = detail?.segments ?? [];
  const totals = segments.reduce(
    (a, s) => ({
      projPL: a.projPL + s.projPLUsd,
      realPL: a.realPL + s.realPLUsd,
      budget: a.budget + s.budgetUsd,
    }),
    { projPL: 0, realPL: 0, budget: 0 }
  );
  const plToBudget =
    totals.budget !== 0 ? (totals.realPL / totals.budget) * 100 : null;
  // Largest realized contribution first.
  const sorted = [...segments].sort((a, b) => b.realPLUsd - a.realPLUsd);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:w-[620px] sm:max-w-[620px] p-0 flex flex-col gap-0"
      >
        <SheetHeader className="px-5 pt-5 pb-4 border-b border-border/40 text-left space-y-0">
          <div className="flex items-start gap-3">
            <AccentIconBadge size="sm" tone={TONE_PL}>
              <HugeiconsIcon icon={Calendar03Icon} size={16} strokeWidth={2} />
            </AccentIconBadge>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-[15px] font-semibold leading-snug tracking-tight">
                {detail ? detail.monthLabel : ""} · {t("dash.pbi.detailTitle")}
              </SheetTitle>
              <SheetDescription className="text-[11.5px] leading-snug mt-0.5">
                {t("dash.pbi.detailSub").replace("{count}", String(segments.length))}
              </SheetDescription>
            </div>
          </div>
          {/* Summary strip — month headline figures, colour-coded */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-4">
            <SummaryStat label={t("dash.rpl.budget")} value={usd(totals.budget)} color={NEUTRAL} />
            <SummaryStat label={t("dash.rpl.projPL")} value={usd(totals.projPL)} color={EST} />
            <SummaryStat label={t("dash.rpl.realPL")} value={usd(totals.realPL)} color={plColor(totals.realPL)} />
            <SummaryStat
              label={t("dash.rpl.plToBudget")}
              value={plToBudget == null ? "—" : `${formatNumber(plToBudget, 1)}%`}
              color={plToBudget == null ? NEUTRAL : plColor(totals.realPL)}
            />
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-5 py-4 pb-8">
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider">
                  <th className="px-2 py-2 text-left font-bold text-slate-600">
                    {t("dash.pbi.segment")}
                  </th>
                  <th className="px-2 py-2 text-right font-bold whitespace-nowrap" style={{ color: EST }}>
                    {t("dash.rpl.projPL")}
                  </th>
                  <th className="px-2 py-2 text-right font-bold whitespace-nowrap" style={{ color: REAL }}>
                    {t("dash.rpl.realPL")}
                  </th>
                  <th className="px-2 py-2 text-right font-bold text-slate-500 whitespace-nowrap">
                    {t("dash.rpl.budget")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((s) => (
                  <tr key={s.segment} className="border-t border-border/40">
                    <td className="px-2 py-1.5 font-semibold text-slate-700 whitespace-nowrap">
                      {s.segment}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: plColor(s.projPLUsd) }}>
                      {usd(s.projPLUsd)}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-semibold" style={{ color: plColor(s.realPLUsd) }}>
                      {usd(s.realPLUsd)}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-slate-500">
                      {usd(s.budgetUsd)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border/70 font-bold text-slate-800 bg-foreground/[0.03]">
                  <td className="px-2 py-2 whitespace-nowrap">{t("dash.rpl.total")}</td>
                  <td className="px-2 py-2 text-right tabular-nums" style={{ color: plColor(totals.projPL) }}>
                    {usd(totals.projPL)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums" style={{ color: plColor(totals.realPL) }}>
                    {usd(totals.realPL)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-slate-600">
                    {usd(totals.budget)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function SummaryStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div
      className="rounded-xl bg-foreground/[0.025] px-3 py-2.5 min-w-0 border-l-[3px]"
      style={{ borderLeftColor: color }}
    >
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">
        {label}
      </div>
      <div
        className="text-[14px] font-bold tabular-nums leading-tight truncate mt-1"
        style={{ color }}
        title={value}
      >
        {value}
      </div>
    </div>
  );
}
