import { useNavigate } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useT } from "@/lib/i18n/LanguageProvider";
import { formatNumber, formatCompactCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  RealizedPLMonthDetail,
  RealizedPLProjectRow,
} from "@/lib/selectors/realizedPLTable";

const BLUE = "#2563eb";
const GREEN = "#059669";
const POS = "rgb(4 120 87)";
const NEG = "rgb(190 24 93)";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: RealizedPLMonthDetail | null;
}

const money = (v: number) => formatCompactCurrency(v, "USD");
const tons = (v: number) => `${formatNumber(Math.round(v))} t`;
const plColor = (v: number) => (v > 0 ? POS : v < 0 ? NEG : "rgb(71 85 105)");

/**
 * Month drill-down for the realized-vs-projected table — Power BI's
 * "Projected P&L Details" + "Live Realized P&L Details" cards. Opens
 * from a month-row click; lists every project bucketed into that month
 * with its projected and realized figures. Rows deep-link to the
 * Vessel Projects page.
 */
export function RealizedPLDetailSheet({ open, onOpenChange, detail }: Props) {
  const t = useT();
  const navigate = useNavigate();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          "w-full sm:max-w-[680px] p-0 flex flex-col gap-0 overflow-hidden",
          "bg-white/97 backdrop-blur-2xl border-l border-border/60",
          "shadow-[0_30px_80px_-16px_rgba(15,23,42,0.45)]"
        )}
        aria-describedby={undefined}
      >
        <div
          aria-hidden
          className="h-1 w-full shrink-0"
          style={{ background: `linear-gradient(90deg, ${BLUE}, ${GREEN})` }}
        />
        <div className="px-5 py-4 shrink-0 border-b border-border/40">
          <SheetTitle className="text-[16px] font-semibold tracking-tight">
            {detail ? detail.monthLabel : ""} · {t("dash.rpl.detailTitle")}
          </SheetTitle>
          <SheetDescription className="text-[12px] text-muted-foreground mt-0.5">
            {detail
              ? t("dash.rpl.detailSub").replace(
                  "{count}",
                  String(detail.projected.length)
                )
              : ""}
          </SheetDescription>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-4 py-4 space-y-6">
            {detail && (
              <>
                <DetailTable
                  title={t("dash.rpl.projectedDetails")}
                  tone={BLUE}
                  rows={detail.projected}
                  qtyLabel={t("dash.rpl.projQty")}
                  revenueLabel={t("dash.rpl.projRevenue")}
                  plLabel={t("dash.rpl.projPL")}
                  budgetLabel={t("dash.rpl.projBudget")}
                  budgetTotal={detail.monthBudgetUsd}
                  onPick={(no) => {
                    onOpenChange(false);
                    navigate(`/projects/${no}`, {
                      state: { focusProjectNo: no },
                    });
                  }}
                />
                <DetailTable
                  title={t("dash.rpl.realizedDetails")}
                  tone={GREEN}
                  rows={detail.realized}
                  qtyLabel={t("dash.rpl.realQty")}
                  revenueLabel={t("dash.rpl.realRevenue")}
                  plLabel={t("dash.rpl.realPL")}
                  budgetLabel={t("dash.rpl.realBudget")}
                  onPick={(no) => {
                    onOpenChange(false);
                    navigate(`/projects/${no}`, {
                      state: { focusProjectNo: no },
                    });
                  }}
                />
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function DetailTable({
  title,
  tone,
  rows,
  qtyLabel,
  revenueLabel,
  plLabel,
  budgetLabel,
  budgetTotal,
  onPick,
}: {
  title: string;
  tone: string;
  rows: RealizedPLProjectRow[];
  qtyLabel: string;
  revenueLabel: string;
  plLabel: string;
  budgetLabel: string;
  /** When given (projected side), the footer budget shows this single
   *  month figure instead of a sum; otherwise sums the per-row budget. */
  budgetTotal?: number;
  onPick: (projectNo: string) => void;
}) {
  const t = useT();
  const totQty = rows.reduce((s, r) => s + r.qtyTons, 0);
  const totRevenue = rows.reduce((s, r) => s + r.revenueUsd, 0);
  const totPL = rows.reduce((s, r) => s + r.plUsd, 0);
  const totBudget =
    budgetTotal !== undefined
      ? budgetTotal
      : rows.reduce((s, r) => s + r.budgetUsd, 0);

  return (
    <div className="rounded-xl border border-border/50 overflow-hidden">
      <div
        className="px-3 py-2 text-[12px] font-bold text-white"
        style={{ background: tone }}
      >
        {title}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-[11.5px]">
          <thead>
            <tr className="text-[9.5px] uppercase tracking-wider text-slate-500 bg-foreground/[0.03]">
              <th className="px-2.5 py-1.5 text-left font-bold">
                {t("dash.rpl.projectVessel")}
              </th>
              <th className="px-2 py-1.5 text-left font-bold">
                {t("dash.rpl.segment")}
              </th>
              <th className="px-2 py-1.5 text-right font-bold">{qtyLabel}</th>
              <th className="px-2 py-1.5 text-right font-bold">{revenueLabel}</th>
              <th className="px-2 py-1.5 text-right font-bold">{plLabel}</th>
              <th className="px-2 py-1.5 text-right font-bold">{budgetLabel}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.projectNo}
                onClick={() => onPick(r.projectNo)}
                className="border-t border-border/30 cursor-pointer hover:bg-foreground/[0.035]"
              >
                <td className="px-2.5 py-1.5 max-w-[220px]">
                  <span className="font-mono text-[10px] text-slate-500 mr-1">
                    {r.projectNo}
                  </span>
                  <span className="font-medium text-slate-800">
                    {r.projectName}
                  </span>
                  {r.vesselName && (
                    <span className="text-slate-500"> · {r.vesselName}</span>
                  )}
                </td>
                <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap">
                  {r.segment ?? "—"}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {tons(r.qtyTons)}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {money(r.revenueUsd)}
                </td>
                <td
                  className="px-2 py-1.5 text-right tabular-nums font-semibold"
                  style={{ color: plColor(r.plUsd) }}
                >
                  {money(r.plUsd)}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {money(r.budgetUsd)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border/60 font-bold text-slate-800 bg-foreground/[0.04]">
              <td className="px-2.5 py-1.5">{t("dash.rpl.total")}</td>
              <td />
              <td className="px-2 py-1.5 text-right tabular-nums">
                {tons(totQty)}
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums">
                {money(totRevenue)}
              </td>
              <td
                className="px-2 py-1.5 text-right tabular-nums"
                style={{ color: plColor(totPL) }}
              >
                {money(totPL)}
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums">
                {money(totBudget)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
