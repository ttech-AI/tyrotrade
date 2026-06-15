import * as React from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, ChevronDown, ChevronUp } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Invoice03Icon } from "@hugeicons/core-free-icons";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { formatCurrency } from "@/lib/format";
import { useT } from "@/lib/i18n/LanguageProvider";
import {
  voyageDisplayLabel,
  type PendingPayments,
} from "@/lib/selectors/overview";

/**
 * "Ödeme Bekleyen Gemiler" — voyages whose ship plan carries a pending
 * payment status (`mserp_trypaymentstatus` reads "Beklemede" / pending).
 * Amount column = `mserp_netfreightamount`, whose F&O label is "Ürün
 * Bedeli ($)" — the voyage's cargo value in USD (NOT freight, despite
 * the column's technical name); the summary strip totals it. "Bekleme
 * süresi" = days since the voyage's most recent populated milestone.
 * Rows deep-link into Sefer Takibi.
 */
/** Rows shown before the user expands the list. */
const COLLAPSED_ROWS = 5;

export function PendingPaymentsCard({
  pending,
}: {
  pending: PendingPayments;
}) {
  const t = useT();
  const [showAll, setShowAll] = React.useState(false);
  const visibleRows = showAll
    ? pending.rows
    : pending.rows.slice(0, COLLAPSED_ROWS);
  const hiddenCount = pending.rows.length - COLLAPSED_ROWS;
  return (
    <GlassPanel
      tone="default"
      className="rounded-2xl h-full flex flex-col overflow-hidden"
    >
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <HugeiconsIcon
            icon={Invoice03Icon}
            size={16}
            strokeWidth={1.75}
            className="text-muted-foreground"
          />
          <h3 className="text-sm font-bold text-slate-900">
            {t("ov.pending.title")}
          </h3>
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {t("ov.pending.subtitle")}
        </p>
      </div>

      {pending.count === 0 ? (
        <div className="flex-1 grid place-items-center px-4 pb-6">
          <p className="text-[12.5px] text-muted-foreground text-center">
            {t("ov.pending.empty")}
          </p>
        </div>
      ) : (
        <>
          {/* Summary strip */}
          <div className="mx-3 rounded-xl bg-rose-500/[0.07] border border-rose-500/15 px-3.5 py-2.5 flex items-center justify-between gap-3">
            <div className="flex items-baseline gap-1.5">
              <span className="text-[22px] font-bold tabular-nums leading-none text-rose-600">
                {pending.count}
              </span>
              <span className="text-[11px] font-semibold text-rose-700/80">
                {t("ov.common.voyage")}
              </span>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-rose-700/70 font-semibold">
                {t("ov.pending.totalPending")}
              </div>
              <div className="text-[15px] font-bold tabular-nums text-rose-600 leading-tight">
                {formatCurrency(pending.totalUsd, "USD", {
                  maximumFractionDigits: 0,
                })}
              </div>
            </div>
          </div>

          {/* Rows */}
          <div className="flex-1 px-2 py-1.5 overflow-y-auto">
            {visibleRows.map((r) => (
              <Link
                key={r.project.projectNo}
                to={`/projects/${r.project.projectNo}`}
                state={{ focusProjectNo: r.project.projectNo }}
                className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-foreground/[0.04] transition-colors min-w-0"
                title={`${r.project.projectNo} ${t("ov.pending.openInProjects")}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-medium text-foreground/90 truncate">
                    {voyageDisplayLabel(r.project)}
                  </div>
                  <div className="text-[10.5px] font-mono text-muted-foreground truncate">
                    {r.project.projectNo}
                  </div>
                </div>
                <span className="text-[12.5px] font-bold tabular-nums text-foreground shrink-0">
                  {r.amountUsd > 0
                    ? formatCurrency(r.amountUsd, "USD", {
                        maximumFractionDigits: 0,
                      })
                    : "—"}
                </span>
                <span className="text-[11px] font-semibold tabular-nums text-muted-foreground w-[52px] text-right shrink-0">
                  {r.days} {t("common.days")}
                </span>
                <ArrowUpRight
                  className="size-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  strokeWidth={2.25}
                />
              </Link>
            ))}
            {/* Expand / collapse — first 5 by default, the rest on
                demand so the card stays scannable */}
            {hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 mt-0.5 text-[11.5px] font-semibold text-foreground/70 hover:text-foreground hover:bg-foreground/[0.04] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                {showAll ? (
                  <>
                    <ChevronUp className="size-3.5" strokeWidth={2.25} />
                    {t("ov.pending.showLess")}
                  </>
                ) : (
                  <>
                    <ChevronDown className="size-3.5" strokeWidth={2.25} />
                    {t("ov.pending.showMore")} (+{hiddenCount})
                  </>
                )}
              </button>
            )}
          </div>
        </>
      )}
    </GlassPanel>
  );
}
