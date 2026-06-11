import * as React from "react";
import { ArrowLeftRight } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { BalanceScaleIcon } from "@hugeicons/core-free-icons";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AccentIconBadge, TONE_EXPENSE } from "./AccentIconBadge";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { Project } from "@/lib/dataverse/entities";

/**
 * Gider Karşılaştırması detay paneli — kartın sağından kayan Sheet.
 *
 * İki bölme, her biri KENDİ renk-bantlı konteynerinde (göz başlıkları
 * tarayarak ayırabilsin): TAHMİNİ = indigo bant, GERÇEKLEŞEN = emerald
 * bant. Satır tipografisi tamamen sans (mono YOK — kodlar yumuşak chip
 * olarak), 13px adlar + 11px alt satır, satırlar arası ince ayraç.
 *
 * İsim zenginleştirme: tahmini kalemlerin çoğunda metinsel ad yok
 * (yalnızca mserp_tryexpensetype kodu). Bu kod uzayı gerçekleşen
 * tarafın `mserp_expenseid`'siyle AYNI olduğundan, adı olmayan tahmini
 * kalem aynı koddaki gerçekleşen kalemin adını devralır. Eşleşen
 * kalemler iki yönde de ⇄ rozetiyle işaretlenir.
 */

/* Bölme kimlikleri — sabit semantik tonlar (tema-bağımsız). */
const EST = {
  solid: "#6366f1",
  band: "rgba(99, 102, 241, 0.09)",
  border: "rgba(99, 102, 241, 0.22)",
};
const REAL = {
  solid: "#059669",
  band: "rgba(5, 150, 105, 0.09)",
  border: "rgba(5, 150, 105, 0.22)",
};

interface RealizedItem {
  code: string;
  name: string;
  totalUsd: number;
  rowCount: number;
}

interface EstimateItem {
  code: string;
  name: string;
  unitPriceUsd: number;
  tons: number;
  totalUsd: number;
}

export function ExpenseComparisonSheet({
  open,
  onOpenChange,
  project,
  realizedRows,
  expectedUsd,
  realizedUsd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  /** Enriched rows from `useProjectExpenseLines` (signed `_usd` field). */
  realizedRows: Record<string, unknown>[];
  expectedUsd: number;
  realizedUsd: number;
}) {
  // Realized: group per expenseId — kalem = masraf kategorisi.
  const realizedItems = React.useMemo<RealizedItem[]>(() => {
    const byCode = new Map<string, RealizedItem>();
    for (const r of realizedRows) {
      const raw = r["mserp_amountcur_usd"];
      const usd = Number(raw);
      if (raw === undefined || raw === null || !Number.isFinite(usd)) continue;
      const code = String(r["mserp_expenseid"] ?? "").trim() || "—";
      const name =
        String(r["mserp_refexpenseid"] ?? "").trim() ||
        String(r["mserp_description"] ?? "").trim() ||
        code;
      const item = byCode.get(code);
      if (item) {
        item.totalUsd += usd;
        item.rowCount += 1;
      } else {
        byCode.set(code, { code, name, totalUsd: usd, rowCount: 1 });
      }
    }
    return [...byCode.values()].sort(
      (a, b) => Math.abs(b.totalUsd) - Math.abs(a.totalUsd)
    );
  }, [realizedRows]);

  // Tahmini: composer'ın costEstimateLines'ı + gerçekleşenden ad devri.
  const estimateItems = React.useMemo<EstimateItem[]>(() => {
    const nameByCode = new Map<string, string>();
    for (const r of realizedItems) {
      if (r.code !== "—" && r.name !== r.code) nameByCode.set(r.code, r.name);
    }
    const lines = project.costEstimateLines ?? [];
    return lines
      .map((l) => {
        const code = (l.code ?? "").trim() || "—";
        const ownName = (l.name ?? "").trim();
        const hasRealName =
          ownName.length > 0 && ownName !== code && ownName !== "Diğer";
        return {
          code,
          name: hasRealName
            ? ownName
            : (nameByCode.get(code) ?? (ownName || code)),
          unitPriceUsd: l.unitPriceUsd,
          tons: l.tons,
          totalUsd: l.totalUsd,
        };
      })
      .sort((a, b) => b.totalUsd - a.totalUsd);
  }, [project.costEstimateLines, realizedItems]);

  const estimateCodes = React.useMemo(
    () => new Set(estimateItems.map((e) => e.code).filter((c) => c !== "—")),
    [estimateItems]
  );
  const realizedCodes = React.useMemo(
    () => new Set(realizedItems.map((r) => r.code).filter((c) => c !== "—")),
    [realizedItems]
  );

  const variance = realizedUsd - expectedUsd;
  const overBudget = variance > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        // stopPropagation: emniyet kemeri — panel artık kartın dışında
        // ama herhangi bir üst tıklanabilirin handler'ına köpürmesin.
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:w-[460px] sm:max-w-[460px] p-0 flex flex-col gap-0"
      >
        <SheetHeader className="px-5 pt-5 pb-4 border-b border-border/40 text-left space-y-0">
          <div className="flex items-start gap-3">
            <AccentIconBadge size="sm" tone={TONE_EXPENSE}>
              <HugeiconsIcon
                icon={BalanceScaleIcon}
                size={16}
                strokeWidth={2}
              />
            </AccentIconBadge>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-[15px] font-semibold leading-snug tracking-tight">
                Gider Karşılaştırması Detayı
              </SheetTitle>
              <SheetDescription className="text-[11.5px] leading-snug mt-0.5">
                {project.projectNo} · kartı oluşturan kalemler
              </SheetDescription>
            </div>
          </div>
          {/* Özet şerit — renk-kodlu sol çizgili istatistikler */}
          <div className="grid grid-cols-3 gap-2 pt-4">
            <SummaryStat
              label="Tahmini"
              value={formatCurrency(expectedUsd, "USD", {
                maximumFractionDigits: 0,
              })}
              color={EST.solid}
            />
            <SummaryStat
              label="Gerçekleşen"
              value={formatCurrency(realizedUsd, "USD", {
                maximumFractionDigits: 0,
              })}
              color={REAL.solid}
            />
            <SummaryStat
              label="Fark"
              value={`${variance >= 0 ? "+" : "−"}${formatCurrency(Math.abs(variance), "USD", { maximumFractionDigits: 0 })}`}
              color={overBudget ? "#e11d48" : "#059669"}
            />
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-5 py-4 space-y-4 pb-8">
            {/* ─── Tahmini kalemler ─── */}
            <Section
              tone={EST}
              title="Tahmini Gider Kalemleri"
              count={estimateItems.length}
              totalUsd={expectedUsd}
              empty={
                estimateItems.length === 0
                  ? "Bu projede tahmini gider kalemi yok."
                  : null
              }
            >
              {estimateItems.map((item, i) => (
                <ItemRow
                  key={`${item.code}-${i}`}
                  name={item.name}
                  code={item.code}
                  matched={realizedCodes.has(item.code)}
                  matchNote="Gerçekleşen tarafta da var"
                  sub={`${formatNumber(item.unitPriceUsd, 2)} $/t × ${formatNumber(item.tons, 0)} t`}
                  value={formatCurrency(item.totalUsd, "USD", {
                    maximumFractionDigits: 0,
                  })}
                />
              ))}
            </Section>

            {/* ─── Gerçekleşen kalemler ─── */}
            <Section
              tone={REAL}
              title="Gerçekleşen Gider Kalemleri"
              count={realizedItems.length}
              totalUsd={realizedUsd}
              empty={
                realizedItems.length === 0
                  ? "Henüz gerçekleşen gider kaydı yok."
                  : null
              }
            >
              {realizedItems.map((item) => (
                <ItemRow
                  key={item.code}
                  name={item.name}
                  code={item.code}
                  matched={estimateCodes.has(item.code)}
                  matchNote="Tahmini tarafta da var"
                  sub={`${item.rowCount} kayıt`}
                  value={`${item.totalUsd < 0 ? "−" : ""}${formatCurrency(Math.abs(item.totalUsd), "USD", { maximumFractionDigits: 0 })}`}
                  valueClassName={
                    item.totalUsd < 0 ? "text-emerald-700" : undefined
                  }
                />
              ))}
            </Section>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
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
        className="text-[13.5px] font-bold tabular-nums leading-tight truncate mt-1"
        style={{ color }}
        title={value}
      >
        {value}
      </div>
    </div>
  );
}

/** Renk-bantlı bölme konteyneri — başlık şeridi bölmenin kimlik rengini
 *  taşır, gövde satırları ince ayraçlarla ayrılır. */
function Section({
  tone,
  title,
  count,
  totalUsd,
  empty,
  children,
}: {
  tone: { solid: string; band: string; border: string };
  title: string;
  count: number;
  totalUsd: number;
  empty: string | null;
  children?: React.ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className="rounded-xl overflow-hidden border"
      style={{ borderColor: tone.border }}
    >
      <div
        className="px-3.5 py-2.5 flex items-center gap-2"
        style={{ background: tone.band }}
      >
        <span
          aria-hidden
          className="size-2 rounded-full shrink-0"
          style={{ background: tone.solid }}
        />
        <span
          className="text-[12px] font-bold tracking-tight flex-1 min-w-0 truncate"
          style={{ color: tone.solid }}
        >
          {title}
        </span>
        <span
          className="text-[11px] font-semibold tabular-nums shrink-0"
          style={{ color: tone.solid }}
        >
          {count} kalem ·{" "}
          {formatCurrency(totalUsd, "USD", { maximumFractionDigits: 0 })}
        </span>
      </div>
      {empty ? (
        <p className="text-[12px] text-muted-foreground italic px-3.5 py-4">
          {empty}
        </p>
      ) : (
        <div className="divide-y divide-border/40">{children}</div>
      )}
    </section>
  );
}

function ItemRow({
  name,
  code,
  matched,
  matchNote,
  sub,
  value,
  valueClassName,
}: {
  name: string;
  code: string;
  matched: boolean;
  matchNote: string;
  sub: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 hover:bg-foreground/[0.025] transition-colors">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[13px] font-medium text-foreground leading-snug truncate">
            {name}
          </span>
          {matched && <MatchBadge note={matchNote} />}
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <CodeChip code={code} />
          <span className="text-[11px] text-muted-foreground truncate">
            {sub}
          </span>
        </div>
      </div>
      <span
        className={cn(
          "text-[13px] font-bold tabular-nums shrink-0 text-foreground",
          valueClassName
        )}
      >
        {value}
      </span>
    </div>
  );
}

/** Masraf kodu — mono yerine yumuşak sans chip (göz yormasın). */
function CodeChip({ code }: { code: string }) {
  return (
    <span className="inline-flex items-center h-[18px] px-1.5 rounded-md bg-foreground/[0.05] text-[10px] font-semibold tabular-nums text-foreground/65 shrink-0">
      {code}
    </span>
  );
}

/** İki yönlü eşleşme rozeti — aynı masraf kodu diğer bölmede de var. */
function MatchBadge({ note }: { note: string }) {
  return (
    <span
      title={note}
      className="shrink-0 inline-flex items-center justify-center size-4 rounded-full bg-sky-500/10 text-sky-600"
    >
      <ArrowLeftRight className="size-2.5" strokeWidth={2.5} />
    </span>
  );
}
