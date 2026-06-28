import type { ReactNode } from "react";
import { RefreshCw, ChevronRight } from "lucide-react";
import { TableIcon } from "@hugeicons/core-free-icons";
import { BentoTile } from "./BentoTile";
import { TONE_PL } from "@/components/details/AccentIconBadge";
import { useT } from "@/lib/i18n/LanguageProvider";
import { formatNumber, formatCompactCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  RealizedPLMonthRow,
  RealizedPLTableData,
} from "@/lib/selectors/realizedPLTable";

const BLUE = "#2563eb"; // projected / tahmini (brand)
const GREEN = "#059669"; // realized / gerçekleşen
const POS = "rgb(4 120 87)";
const NEG = "rgb(190 24 93)";

interface Props {
  data: RealizedPLTableData;
  hasRealizedCoverage: boolean;
  isFetching: boolean;
  onRefresh: () => void;
  onSelectMonth: (row: RealizedPLMonthRow) => void;
  fyLabel: string;
}

function plColor(v: number) {
  return v > 0 ? POS : v < 0 ? NEG : "rgb(71 85 105)";
}

/**
 * E.M Bakış "Gerçekleşen × Tahmini K/Z" monthly table — Power BI
 * "LIVE REALIZED – PROJECTED P&L" replica. Months are FY-scoped and
 * dynamic with the page filter; each month row is clickable to open the
 * per-project drill-down. Projected (tahmini) column group reads blue,
 * Realized (gerçekleşen) reads green, echoing the chart above.
 */
export function RealizedPLTable({
  data,
  hasRealizedCoverage,
  isFetching,
  onRefresh,
  onSelectMonth,
  fyLabel,
}: Props) {
  const t = useT();
  const money = (v: number) => formatCompactCurrency(v, "USD");
  const tons = (v: number) => `${formatNumber(Math.round(v))} t`;
  // Realized revenue/qty are cache-backed (always valid). Realized P&L
  // needs the expense rollup — show "—" until it covers the set so we
  // never display a P&L missing its expense leg.
  const cov = hasRealizedCoverage;

  return (
    <BentoTile
      title={t("dash.rpl.title")}
      subtitle={`${fyLabel} · ${t("dash.monthly.subtitle")}`}
      icon={TableIcon}
      iconTone={TONE_PL}
      interactive={false}
    >
      <div className="flex flex-col gap-2">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isFetching}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
              "border border-border/60 bg-foreground/[0.03] hover:bg-foreground/[0.06]",
              "transition-colors disabled:opacity-60 disabled:cursor-default"
            )}
            style={{ color: GREEN }}
          >
            <RefreshCw
              className={cn("size-3.5", isFetching && "animate-spin")}
              strokeWidth={2.25}
            />
            {isFetching
              ? t("dash.monthly.computing")
              : hasRealizedCoverage
                ? t("dash.monthly.refresh")
                : t("dash.monthly.compute")}
          </button>
        </div>

        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full min-w-[860px] border-collapse text-[12px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider">
                <th className="sticky left-0 z-10 bg-white/95 backdrop-blur px-2 py-2 text-left font-bold text-slate-600">
                  {t("dash.rpl.month")}
                </th>
                <Th tone={BLUE}>{t("dash.rpl.projQty")}</Th>
                <Th tone={BLUE}>{t("dash.rpl.projRevenue")}</Th>
                <Th tone={BLUE}>{t("dash.rpl.projPL")}</Th>
                <Th tone="#64748b">{t("dash.rpl.budget")}</Th>
                <Th tone={GREEN}>{t("dash.rpl.realQty")}</Th>
                <Th tone={GREEN}>{t("dash.rpl.realRevenue")}</Th>
                <Th tone={GREEN}>{t("dash.rpl.realPL")}</Th>
                <Th tone="#64748b">{t("dash.rpl.plToBudget")}</Th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => {
                const empty =
                  r.projQtyTons === 0 &&
                  r.realQtyTons === 0 &&
                  r.projRevenueUsd === 0 &&
                  r.realRevenueUsd === 0;
                return (
                  <tr
                    key={r.monthKey}
                    onClick={() => !empty && onSelectMonth(r)}
                    className={cn(
                      "border-t border-border/40 group",
                      empty
                        ? "opacity-45"
                        : "cursor-pointer hover:bg-foreground/[0.035]"
                    )}
                  >
                    <td className="sticky left-0 z-10 bg-white/95 group-hover:bg-[#f8fafc] backdrop-blur px-2 py-1.5 font-semibold text-slate-700 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        {r.monthLabel}
                        {!empty && (
                          <ChevronRight className="size-3 text-muted-foreground/40 group-hover:text-muted-foreground/80" />
                        )}
                      </span>
                    </td>
                    <Td>{tons(r.projQtyTons)}</Td>
                    <Td>{money(r.projRevenueUsd)}</Td>
                    <Td color={plColor(r.projPLUsd)}>{money(r.projPLUsd)}</Td>
                    <Td>{money(r.budgetUsd)}</Td>
                    <Td>{tons(r.realQtyTons)}</Td>
                    <Td>{money(r.realRevenueUsd)}</Td>
                    <Td color={cov ? plColor(r.realPLUsd) : undefined}>
                      {cov ? money(r.realPLUsd) : "—"}
                    </Td>
                    <Td color={cov && r.plToBudgetPct != null ? plColor(r.realPLUsd) : undefined}>
                      {cov && r.plToBudgetPct != null
                        ? `${formatNumber(r.plToBudgetPct, 1)}%`
                        : "—"}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border/70 font-bold text-slate-800">
                <td className="sticky left-0 z-10 bg-[#f1f5f9] px-2 py-2 whitespace-nowrap">
                  {data.total.monthLabel}
                </td>
                <Td foot>{tons(data.total.projQtyTons)}</Td>
                <Td foot>{money(data.total.projRevenueUsd)}</Td>
                <Td foot color={plColor(data.total.projPLUsd)}>
                  {money(data.total.projPLUsd)}
                </Td>
                <Td foot>{money(data.total.budgetUsd)}</Td>
                <Td foot>{tons(data.total.realQtyTons)}</Td>
                <Td foot>{money(data.total.realRevenueUsd)}</Td>
                <Td foot color={cov ? plColor(data.total.realPLUsd) : undefined}>
                  {cov ? money(data.total.realPLUsd) : "—"}
                </Td>
                <Td foot color={cov && data.total.plToBudgetPct != null ? plColor(data.total.realPLUsd) : undefined}>
                  {cov && data.total.plToBudgetPct != null
                    ? `${formatNumber(data.total.plToBudgetPct, 1)}%`
                    : "—"}
                </Td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </BentoTile>
  );
}

function Th({ children, tone }: { children: ReactNode; tone: string }) {
  return (
    <th
      className="px-2 py-2 text-right font-bold whitespace-nowrap"
      style={{ color: tone }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  color,
  foot,
}: {
  children: ReactNode;
  color?: string;
  foot?: boolean;
}) {
  return (
    <td
      className={cn(
        "px-2 py-1.5 text-right tabular-nums whitespace-nowrap",
        foot ? "bg-[#f1f5f9]" : ""
      )}
      style={color ? { color } : undefined}
    >
      {children}
    </td>
  );
}
