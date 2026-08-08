import type { ReactNode } from "react";
import { ChevronRight } from "@/freight/icons";
import { TableIcon } from "@hugeicons/core-free-icons";
import { BentoTile } from "./BentoTile";
import { RefreshButton } from "./RefreshButton";
import { TONE_PL } from "@/freight/components/details/AccentIconBadge";
import { useLocale } from "@/hooks/useLocale";
import { formatNumber, formatCompactCurrency } from "@/freight/lib/format";
import { cn } from "@/lib/utils";
import type {
  RealizedPLMonthRow,
  RealizedPLTableData,
} from "@/freight/lib/selectors/realizedPLTable";

/** Column-group tones, matched to the chart above: projected rides the brand
 *  accent, realized the P&L green, so the two groups stay distinguishable in
 *  every palette. The neutral columns (budget, P&L-to-budget) are secondary
 *  text, not a series. */
const PROJECTED = "var(--series-projected)";
const REALIZED = "var(--series-realized)";
const NEUTRAL_COL = "var(--muted-foreground)";
/** Signed money, so P&L tokens rather than success/destructive. */
const POS = "var(--pl-pos)";
const NEG = "var(--pl-neg)";

interface Props {
  data: RealizedPLTableData;
  hasRealizedCoverage: boolean;
  isFetching?: boolean;
  onRefresh?: () => void;
  onSelectMonth: (row: RealizedPLMonthRow) => void;
  fyLabel: string;
  /** Optional title override — used by the second "invoice-date" variant
   *  of the card. Defaults to the standard project-period title. */
  title?: string;
  /** Optional subtitle override (defaults to `fyLabel · <monthly subtitle>`). */
  subtitle?: string;
  /** Hide the refresh button — for the static "Power BI Version" snapshot
   *  table, which has nothing to refetch. */
  hideRefresh?: boolean;
}

function plColor(v: number) {
  return v > 0 ? POS : v < 0 ? NEG : "var(--pl-neutral)";
}

/**
 * E.M Bakış "Gerçekleşen × Tahmini P&L" monthly table — Power BI
 * "LIVE REALIZED – PROJECTED P&L" replica. Months are FY-scoped and
 * dynamic with the page filter; each month row is clickable to open the
 * per-project drill-down. Projected (tahmini) column group reads the brand
 * accent, Realized (gerçekleşen) reads green, echoing the chart above.
 */
export function RealizedPLTable({
  data,
  hasRealizedCoverage,
  isFetching,
  onRefresh,
  onSelectMonth,
  fyLabel,
  title,
  subtitle,
  hideRefresh,
}: Props) {
  const { t } = useLocale();
  const money = (v: number) => formatCompactCurrency(v, "USD");
  const tons = (v: number) => `${formatNumber(Math.round(v))} t`;
  // Realized revenue/qty are cache-backed (always valid). Realized P&L
  // needs the expense rollup — show "—" until it covers the set so we
  // never display a P&L missing its expense leg.
  const cov = hasRealizedCoverage;

  return (
    <BentoTile
      title={title ?? t("dash.rpl.title")}
      subtitle={subtitle ?? `${fyLabel} · ${t("dash.monthly.subtitle")}`}
      icon={TableIcon}
      iconTone={TONE_PL}
      interactive={false}
      headerAction={
        hideRefresh || !onRefresh ? undefined : (
          <RefreshButton
            isFetching={isFetching ?? false}
            hasRealizedCoverage={hasRealizedCoverage}
            onRefresh={onRefresh}
          />
        )
      }
    >
      <div className="flex flex-col gap-2">
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full min-w-[860px] border-collapse text-[12px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider">
                <th className="sticky left-0 z-10 bg-card/95 backdrop-blur px-2 py-2 text-left font-bold text-muted-foreground">
                  {t("dash.rpl.month")}
                </th>
                <Th tone={PROJECTED}>{t("dash.rpl.projQty")}</Th>
                <Th tone={PROJECTED}>{t("dash.rpl.projRevenue")}</Th>
                <Th tone={PROJECTED}>{t("dash.rpl.projPL")}</Th>
                <Th tone={NEUTRAL_COL}>{t("dash.rpl.budget")}</Th>
                <Th tone={REALIZED}>{t("dash.rpl.realQty")}</Th>
                <Th tone={REALIZED}>{t("dash.rpl.realRevenue")}</Th>
                <Th tone={REALIZED}>{t("dash.rpl.realPL")}</Th>
                <Th tone={NEUTRAL_COL}>{t("dash.rpl.plToBudget")}</Th>
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
                    <td className="sticky left-0 z-10 bg-card/95 group-hover:bg-muted backdrop-blur px-2 py-1.5 font-semibold text-foreground whitespace-nowrap">
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
              <tr className="border-t-2 border-border/70 font-bold text-foreground">
                <td className="sticky left-0 z-10 bg-muted px-2 py-2 whitespace-nowrap">
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
        foot ? "bg-muted" : ""
      )}
      style={color ? { color } : undefined}
    >
      {children}
    </td>
  );
}
