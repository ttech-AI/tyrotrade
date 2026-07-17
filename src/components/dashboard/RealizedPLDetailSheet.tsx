import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
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
import { AccentIconBadge, TONE_FORECAST } from "@/components/details/AccentIconBadge";
import { useT } from "@/lib/i18n/LanguageProvider";
import { formatNumber, formatCurrency } from "@/lib/format";
import type {
  RealizedPLMonthDetail,
  RealizedPLProjectRow,
} from "@/lib/selectors/realizedPLTable";

/* Fixed semantic tones. Projected = the tyrotrade sky→navy brand blue
 * (logo/wordmark gradient `#38bdf8 → #2563eb → #1e3a8a`); realized =
 * emerald. `grad` drives the section header strips (logo identity);
 * `solid` is the readable text/chip accent (a real logo stop). */
const EST = {
  solid: "#2563eb",
  grad: "linear-gradient(90deg, #38bdf8 0%, #2563eb 60%, #1e3a8a 100%)",
  band: "rgba(37,99,235,0.08)",
  border: "rgba(37,99,235,0.22)",
};
const REAL = {
  solid: "#059669",
  grad: "linear-gradient(90deg, #34d399 0%, #10b981 55%, #059669 100%)",
  band: "rgba(5,150,105,0.08)",
  border: "rgba(5,150,105,0.22)",
};
const POS = "#047857";
const NEG = "#be123c";
const NEUTRAL = "#475569";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: RealizedPLMonthDetail | null;
}

const usd = (v: number) => formatCurrency(v, "USD", { maximumFractionDigits: 0 });
const tons = (v: number) => `${formatNumber(Math.round(v))} t`;
const plColor = (v: number) => (v > 0 ? POS : v < 0 ? NEG : NEUTRAL);

/**
 * Month drill-down for the realized-vs-projected table. Follows the
 * Gider Karşılaştırması panel's dialect: a colour-coded summary strip up
 * top, then two banded sections (Tahmini = blue, Gerçekleşen = green)
 * listing each project as a readable two-line card — not a cramped
 * table. Rows deep-link to the Vessel Projects page.
 */
export function RealizedPLDetailSheet({ open, onOpenChange, detail }: Props) {
  const t = useT();
  const navigate = useNavigate();

  const projTotals = sumRows(detail?.projected ?? []);
  const realTotals = sumRows(detail?.realized ?? []);
  const budget = detail?.monthBudgetUsd ?? 0;
  const plToBudget = budget !== 0 ? (realTotals.pl / budget) * 100 : null;

  const go = (no: string) => {
    onOpenChange(false);
    navigate(`/projects/${no}`, { state: { focusProjectNo: no } });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:w-[760px] sm:max-w-[760px] p-0 flex flex-col gap-0"
      >
        <SheetHeader className="px-5 pt-5 pb-4 border-b border-border/40 text-left space-y-0">
          <div className="flex items-start gap-3">
            <AccentIconBadge size="sm" tone={TONE_FORECAST}>
              <HugeiconsIcon icon={Calendar03Icon} size={16} strokeWidth={2} />
            </AccentIconBadge>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-[15px] font-semibold leading-snug tracking-tight">
                {detail ? detail.monthLabel : ""} · {t("dash.rpl.detailTitle")}
              </SheetTitle>
              <SheetDescription className="text-[11.5px] leading-snug mt-0.5">
                {detail
                  ? t("dash.rpl.detailSub").replace(
                      "{count}",
                      String(detail.projected.length)
                    )
                  : ""}
              </SheetDescription>
            </div>
          </div>
          {/* Summary strip — month headline figures, colour-coded */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-4">
            <SummaryStat label={t("dash.rpl.budget")} value={usd(budget)} color={NEUTRAL} />
            <SummaryStat label={t("dash.rpl.projPL")} value={usd(projTotals.pl)} color={EST.solid} />
            <SummaryStat label={t("dash.rpl.realPL")} value={usd(realTotals.pl)} color={plColor(realTotals.pl)} />
            <SummaryStat
              label={t("dash.rpl.plToBudget")}
              value={plToBudget == null ? "—" : `${formatNumber(plToBudget, 1)}%`}
              color={plToBudget == null ? NEUTRAL : plColor(realTotals.pl)}
            />
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-5 py-4 space-y-4 pb-8">
            {detail && (
              <>
                <Section
                  tone={EST}
                  title={t("dash.rpl.projectedDetails")}
                  count={detail.projected.length}
                  totals={projTotals}
                >
                  {detail.projected.map((r) => (
                    <ProjectRow
                      key={r.projectNo}
                      row={r}
                      tone={EST.solid}
                      onPick={go}
                    />
                  ))}
                </Section>
                <Section
                  tone={REAL}
                  title={t("dash.rpl.realizedDetails")}
                  count={detail.realized.length}
                  totals={realTotals}
                >
                  {detail.realized.map((r) => (
                    <ProjectRow
                      key={r.projectNo}
                      row={r}
                      tone={REAL.solid}
                      onPick={go}
                    />
                  ))}
                </Section>
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function sumRows(rows: RealizedPLProjectRow[]) {
  return rows.reduce(
    (a, r) => ({
      qty: a.qty + r.qtyTons,
      revenue: a.revenue + r.revenueUsd,
      pl: a.pl + r.plUsd,
    }),
    { qty: 0, revenue: 0, pl: 0 }
  );
}

/* ─────────── Building blocks ─────────── */

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

function Section({
  tone,
  title,
  count,
  totals,
  children,
}: {
  tone: { solid: string; grad: string; band: string; border: string };
  title: string;
  count: number;
  totals: { qty: number; revenue: number; pl: number };
  children: ReactNode;
}) {
  const t = useT();
  return (
    <div
      className="rounded-2xl overflow-hidden border"
      style={{ borderColor: tone.border }}
    >
      {/* Band header — brand-gradient strip (logo identity), white text */}
      <div
        className="flex items-center justify-between gap-2 px-3.5 py-2.5 text-white"
        style={{ background: tone.grad }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            aria-hidden
            className="size-2 rounded-full shrink-0 bg-white/90"
          />
          <span className="text-[11.5px] font-bold uppercase tracking-wider truncate">
            {title}
          </span>
          <span className="text-[10px] font-semibold text-white/75 tabular-nums">
            · {count}
          </span>
        </div>
        <span className="text-[14px] font-bold tabular-nums shrink-0">
          {usd(totals.pl)}
        </span>
      </div>
      {/* Rows */}
      <div className="divide-y divide-border/40">{children}</div>
      {/* Footer totals */}
      <div className="flex items-center justify-between gap-3 px-3.5 py-2 bg-foreground/[0.03] text-[11px]">
        <span className="font-bold uppercase tracking-wider text-slate-600">
          {t("dash.rpl.total")}
        </span>
        <div className="flex items-center gap-4 tabular-nums text-slate-600">
          <span>{tons(totals.qty)}</span>
          <span>{usd(totals.revenue)}</span>
          <span className="font-bold" style={{ color: plColor(totals.pl) }}>
            {usd(totals.pl)}
          </span>
        </div>
      </div>
    </div>
  );
}

function ProjectRow({
  row,
  tone,
  onPick,
}: {
  row: RealizedPLProjectRow;
  tone: string;
  onPick: (projectNo: string) => void;
}) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={() => onPick(row.projectNo)}
      className="w-full text-left px-3.5 py-2.5 hover:bg-foreground/[0.03] transition-colors group flex items-start gap-3"
    >
      <div className="min-w-0 flex-1">
        {/* Line 1 — code chip + segment */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className="font-mono text-[10px] font-semibold px-1.5 py-px rounded"
            style={{ color: tone, background: `${tone}14` }}
          >
            {row.projectNo}
          </span>
          {row.segment && (
            <span className="text-[9.5px] font-semibold uppercase tracking-wide text-foreground/70 bg-foreground/[0.06] border border-foreground/10 px-1.5 py-px rounded">
              {row.segment}
            </span>
          )}
        </div>
        {/* Line 2 — name + vessel */}
        <div className="text-[12.5px] font-semibold text-foreground leading-snug mt-1">
          {row.projectName}
          {row.vesselName && (
            <span className="font-normal text-muted-foreground">
              {" "}
              · ⚓ {row.vesselName}
            </span>
          )}
        </div>
        {/* Line 3 — qty + revenue stats */}
        <div className="mt-1.5 flex items-center gap-4 text-[10.5px] text-muted-foreground tabular-nums">
          <span>
            <span className="text-foreground/55">{t("dash.rpl.qtyShort")}</span>{" "}
            <span className="font-semibold text-foreground/80">
              {tons(row.qtyTons)}
            </span>
          </span>
          <span>
            <span className="text-foreground/55">{t("dash.rpl.revenueShort")}</span>{" "}
            <span className="font-semibold text-foreground/80">
              {usd(row.revenueUsd)}
            </span>
          </span>
        </div>
      </div>
      {/* Headline P&L */}
      <div className="shrink-0 text-right flex items-center gap-1">
        <div>
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground/70">
            {t("dash.rpl.plShort")}
          </div>
          <div
            className="text-[14px] font-bold tabular-nums leading-tight"
            style={{ color: plColor(row.plUsd) }}
          >
            {usd(row.plUsd)}
          </div>
        </div>
        <ChevronRight className="size-3.5 text-muted-foreground/40 group-hover:text-muted-foreground/80 transition-colors" />
      </div>
    </button>
  );
}
