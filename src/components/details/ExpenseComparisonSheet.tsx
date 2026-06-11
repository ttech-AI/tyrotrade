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
 * İki bölme: TAHMİNİ kalemler (costEstimateLines: kod × birim $/t ×
 * tonaj) ve GERÇEKLEŞEN kalemler (expense-line satırları, expenseId
 * bazında toplanmış, işaretli USD). Kartın başlıktaki toplamlarını
 * OLUŞTURAN kalemler birebir bunlar — toplamlar aynı kaynaktan gelir.
 *
 * İsim zenginleştirme (kullanıcı notu): tahmini kalemlerin çoğunda
 * metinsel ad yok (yalnızca mserp_tryexpensetype kodu). Bu kod uzayı
 * gerçekleşen tarafın `mserp_expenseid`'siyle AYNI olduğundan, adı
 * olmayan tahmini kalem, aynı koddaki gerçekleşen kalemin adını
 * (refExpenseId → description) devralır. Eşleşen kalemler iki yönde de
 * ⇄ rozetiyle işaretlenir.
 */

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
        className="w-full sm:w-[440px] sm:max-w-[440px] p-0 flex flex-col gap-0"
      >
        <SheetHeader className="px-4 pt-4 pb-3 border-b border-border/40 text-left space-y-0">
          <div className="flex items-start gap-2.5">
            <AccentIconBadge size="sm" tone={TONE_EXPENSE}>
              <HugeiconsIcon
                icon={BalanceScaleIcon}
                size={16}
                strokeWidth={2}
              />
            </AccentIconBadge>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-[14px] font-semibold leading-snug">
                Gider Karşılaştırması Detayı
              </SheetTitle>
              <SheetDescription className="text-[11px] leading-snug mt-0.5">
                {project.projectNo} · kartı oluşturan tahmini × gerçekleşen
                kalemler
              </SheetDescription>
            </div>
          </div>
          {/* Özet şerit */}
          <div className="grid grid-cols-3 gap-2 pt-3">
            <SummaryStat
              label="Tahmini"
              value={formatCurrency(expectedUsd, "USD", {
                maximumFractionDigits: 0,
              })}
              color="#6366f1"
            />
            <SummaryStat
              label="Gerçekleşen"
              value={formatCurrency(realizedUsd, "USD", {
                maximumFractionDigits: 0,
              })}
              color="#0f172a"
            />
            <SummaryStat
              label="Fark"
              value={`${variance >= 0 ? "+" : "−"}${formatCurrency(Math.abs(variance), "USD", { maximumFractionDigits: 0 })}`}
              color={overBudget ? "#e11d48" : "#059669"}
            />
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-4 py-3 space-y-5 pb-6">
            {/* ─── Tahmini kalemler ─── */}
            <section aria-label="Tahmini gider kalemleri">
              <SectionHeader
                color="#6366f1"
                title="Tahmini Gider Kalemleri"
                count={estimateItems.length}
                totalUsd={expectedUsd}
              />
              {estimateItems.length === 0 ? (
                <EmptyNote text="Bu projede tahmini gider kalemi yok." />
              ) : (
                <div className="mt-1.5 space-y-0.5">
                  {estimateItems.map((item, i) => (
                    <div
                      key={`${item.code}-${i}`}
                      className="flex items-start justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-foreground/[0.03] transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[12.5px] font-medium text-foreground/90 truncate">
                            {item.name}
                          </span>
                          {realizedCodes.has(item.code) && (
                            <MatchBadge note="Gerçekleşen tarafta da var" />
                          )}
                        </div>
                        <div className="text-[10.5px] text-muted-foreground font-mono mt-0.5">
                          {item.code}
                          <span className="font-sans">
                            {" "}
                            · {formatNumber(item.unitPriceUsd, 2)} $/t ×{" "}
                            {formatNumber(item.tons, 0)} t
                          </span>
                        </div>
                      </div>
                      <span className="text-[12.5px] font-bold tabular-nums shrink-0 text-foreground">
                        {formatCurrency(item.totalUsd, "USD", {
                          maximumFractionDigits: 0,
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ─── Gerçekleşen kalemler ─── */}
            <section aria-label="Gerçekleşen gider kalemleri">
              <SectionHeader
                color="#0f172a"
                title="Gerçekleşen Gider Kalemleri"
                count={realizedItems.length}
                totalUsd={realizedUsd}
              />
              {realizedItems.length === 0 ? (
                <EmptyNote text="Henüz gerçekleşen gider kaydı yok." />
              ) : (
                <div className="mt-1.5 space-y-0.5">
                  {realizedItems.map((item) => (
                    <div
                      key={item.code}
                      className="flex items-start justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-foreground/[0.03] transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[12.5px] font-medium text-foreground/90 truncate">
                            {item.name}
                          </span>
                          {estimateCodes.has(item.code) && (
                            <MatchBadge note="Tahmini tarafta da var" />
                          )}
                        </div>
                        <div className="text-[10.5px] text-muted-foreground font-mono mt-0.5">
                          {item.code}
                          <span className="font-sans">
                            {" "}
                            · {item.rowCount} kayıt
                          </span>
                        </div>
                      </div>
                      <span
                        className={cn(
                          "text-[12.5px] font-bold tabular-nums shrink-0",
                          item.totalUsd < 0
                            ? "text-emerald-700"
                            : "text-foreground"
                        )}
                      >
                        {item.totalUsd < 0 ? "−" : ""}
                        {formatCurrency(Math.abs(item.totalUsd), "USD", {
                          maximumFractionDigits: 0,
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

/* ─────────── Small bits ─────────── */

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
    <div className="rounded-xl bg-foreground/[0.03] border border-border/40 px-2.5 py-2 min-w-0">
      <div className="text-[9.5px] uppercase tracking-wider text-muted-foreground truncate">
        {label}
      </div>
      <div
        className="text-[13px] font-bold tabular-nums leading-tight truncate mt-0.5"
        style={{ color }}
        title={value}
      >
        {value}
      </div>
    </div>
  );
}

function SectionHeader({
  color,
  title,
  count,
  totalUsd,
}: {
  color: string;
  title: string;
  count: number;
  totalUsd: number;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-border/40 pb-1.5">
      <span
        aria-hidden
        className="size-2 rounded-full shrink-0"
        style={{ background: color }}
      />
      <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-foreground/80 flex-1 min-w-0 truncate">
        {title}
      </span>
      <span className="text-[10.5px] font-semibold tabular-nums text-muted-foreground shrink-0">
        {count} kalem ·{" "}
        {formatCurrency(totalUsd, "USD", { maximumFractionDigits: 0 })}
      </span>
    </div>
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

function EmptyNote({ text }: { text: string }) {
  return (
    <p className="text-[12px] text-muted-foreground italic px-2 py-3">{text}</p>
  );
}
