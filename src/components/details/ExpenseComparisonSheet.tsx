import * as React from "react";
import { ArrowLeftRight, ChevronRight } from "lucide-react";
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
import { useT } from "@/lib/i18n/LanguageProvider";
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

/** One underlying expense-line record behind a realized aggregate —
 *  surfaced when the user expands a realized item. */
interface RealizedRecord {
  /** masraf no — `mserp_expensenum`. */
  expenseNum: string;
  /** signed USD contribution (`mserp_amountcur_usd`). */
  usd: number;
  /** native line amount (`mserp_amountcur`). */
  nativeAmount: number;
  /** line currency (from the joined header). */
  currency: string;
  /** USD exchange rate at txn date (from the header). */
  rate: number;
  /** `mserp_accounttype` (Vendor / Customer / General accounting / Bank). */
  accountType: number | null;
  /** free-text line description. */
  description: string;
}

interface RealizedItem {
  code: string;
  name: string;
  totalUsd: number;
  rowCount: number;
  /** The individual line records that compose this aggregate. */
  records: RealizedRecord[];
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
  const t = useT();
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
      const record: RealizedRecord = {
        expenseNum: String(r["mserp_expensenum"] ?? "").trim(),
        usd,
        nativeAmount: Number(r["mserp_amountcur"]) || 0,
        currency:
          String(r["mserp_currencycode"] ?? "").trim().toUpperCase() || "USD",
        rate: Number(r["mserp_exchratesecond"]) || 1,
        accountType:
          r["mserp_accounttype"] === undefined ||
          r["mserp_accounttype"] === null
            ? null
            : Number(r["mserp_accounttype"]),
        description: String(r["mserp_description"] ?? "").trim(),
      };
      const item = byCode.get(code);
      if (item) {
        item.totalUsd += usd;
        item.rowCount += 1;
        item.records.push(record);
      } else {
        byCode.set(code, {
          code,
          name,
          totalUsd: usd,
          rowCount: 1,
          records: [record],
        });
      }
    }
    const items = [...byCode.values()];
    // Largest contribution first — both at the item level and within each
    // item's record list, so the biggest driver is always on top.
    for (const it of items)
      it.records.sort((a, b) => Math.abs(b.usd) - Math.abs(a.usd));
    return items.sort((a, b) => Math.abs(b.totalUsd) - Math.abs(a.totalUsd));
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
                {t("proj.expenseSheet.title")}
              </SheetTitle>
              <SheetDescription className="text-[11.5px] leading-snug mt-0.5">
                {project.projectNo} · {t("proj.expenseSheet.subtitle")}
              </SheetDescription>
            </div>
          </div>
          {/* Özet şerit — renk-kodlu sol çizgili istatistikler */}
          <div className="grid grid-cols-3 gap-2 pt-4">
            <SummaryStat
              label={t("proj.expenseSheet.estimated")}
              value={formatCurrency(expectedUsd, "USD", {
                maximumFractionDigits: 0,
              })}
              color={EST.solid}
            />
            <SummaryStat
              label={t("proj.expenseSheet.realized")}
              value={formatCurrency(realizedUsd, "USD", {
                maximumFractionDigits: 0,
              })}
              color={REAL.solid}
            />
            <SummaryStat
              label={t("proj.expenseSheet.difference")}
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
              title={t("proj.expenseSheet.estimatedItems")}
              count={estimateItems.length}
              countLabel={t("proj.expenseSheet.itemsSuffix")}
              totalUsd={expectedUsd}
              empty={
                estimateItems.length === 0
                  ? t("proj.expenseSheet.noEstimate")
                  : null
              }
            >
              {estimateItems.map((item, i) => (
                <ItemRow
                  key={`${item.code}-${i}`}
                  name={item.name}
                  code={item.code}
                  matched={realizedCodes.has(item.code)}
                  matchNote={t("proj.expenseSheet.matchedInRealized")}
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
              title={t("proj.expenseSheet.realizedItems")}
              count={realizedItems.length}
              countLabel={t("proj.expenseSheet.itemsSuffix")}
              totalUsd={realizedUsd}
              empty={
                realizedItems.length === 0
                  ? t("proj.expenseSheet.noRealized")
                  : null
              }
            >
              {realizedItems.map((item) => (
                <RealizedItemRow
                  key={item.code}
                  item={item}
                  matched={estimateCodes.has(item.code)}
                  matchNote={t("proj.expenseSheet.matchedInEstimate")}
                  t={t}
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
  countLabel,
  totalUsd,
  empty,
  children,
}: {
  tone: { solid: string; band: string; border: string };
  title: string;
  count: number;
  /** Localized unit word shown after the count (e.g. "lines" / "kalem"). */
  countLabel: string;
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
          {count} {countLabel} ·{" "}
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

/** F&O `mserp_accounttype` → kısa etiket. Boş string bilinmeyen/null. */
function acctLabel(at: number | null, t: (key: string) => string): string {
  switch (at) {
    case 200000003:
      return t("proj.expenseSheet.acct.vendor");
    case 200000001:
      return t("proj.expenseSheet.acct.customer");
    case 200000000:
      return t("proj.expenseSheet.acct.ledger");
    case 200000002:
      return t("proj.expenseSheet.acct.bank");
    default:
      return "";
  }
}

/** Gerçekleşen kalem satırı — sol başında aç/kapa oku. Açılınca aggregate'i
 *  oluşturan satır-bazlı kayıtlar (masraf no + hesap tipi + ham tutar/kur +
 *  işaretli USD) alt blokta görünür. */
function RealizedItemRow({
  item,
  matched,
  matchNote,
  t,
}: {
  item: RealizedItem;
  matched: boolean;
  matchNote: string;
  t: (key: string) => string;
}) {
  const [open, setOpen] = React.useState(false);
  const negative = item.totalUsd < 0;
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={t("proj.expenseSheet.toggleRecords")}
        className={cn(
          "w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors",
          open ? "bg-foreground/[0.02]" : "hover:bg-foreground/[0.025]"
        )}
      >
        <ChevronRight
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground/70 transition-transform duration-150",
            open && "rotate-90"
          )}
          strokeWidth={2.5}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[13px] font-medium text-foreground leading-snug truncate">
              {item.name}
            </span>
            {matched && <MatchBadge note={matchNote} />}
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <CodeChip code={item.code} />
            <span className="text-[11px] text-muted-foreground truncate">
              {item.rowCount} {t("proj.expenseSheet.recordsSuffix")}
            </span>
          </div>
        </div>
        <span
          className={cn(
            "text-[13px] font-bold tabular-nums shrink-0",
            negative ? "text-emerald-700" : "text-foreground"
          )}
        >
          {negative ? "−" : ""}
          {formatCurrency(Math.abs(item.totalUsd), "USD", {
            maximumFractionDigits: 0,
          })}
        </span>
      </button>
      {open && (
        <div className="bg-foreground/[0.025] border-t border-border/40">
          {/* Emerald tree-rail + indentation tie the records to the parent
              and align them under its expand control; recessed bg + smaller
              muted type below make the child level read as clearly nested. */}
          <div className="ml-6 mr-2 my-1 border-l-2 border-emerald-500/30 pl-3 divide-y divide-border/30">
            {item.records.map((rec, i) => (
              <RecordRow
                key={`${rec.expenseNum}-${i}`}
                rec={rec}
                parentName={item.name}
                t={t}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Tek gerçekleşen kayıt — ana satırın altında, ikincil seviye olarak okunur:
 *  masraf no (kaydın kimliği) önde, hesap tipi + (USD değilse) ham tutar/kur
 *  yanında. Üst kalemin adı TEKRARLANMAZ — açıklama yalnızca üst addan
 *  farklıysa (örn. reflection invoice) ayrı bir başlık olarak gösterilir.
 *  Tipografi küçük + soluk, değer hafif → üst kalemle karışmaz. */
function RecordRow({
  rec,
  parentName,
  t,
}: {
  rec: RealizedRecord;
  parentName: string;
  t: (key: string) => string;
}) {
  const negative = rec.usd < 0;
  const acct = acctLabel(rec.accountType, t);
  const nonUsd = rec.currency !== "" && rec.currency !== "USD";
  // Don't echo the parent category name — only surface a description that
  // genuinely differs (e.g. a reflection invoice carries its own text).
  const distinctDesc =
    rec.description && rec.description !== parentName ? rec.description : "";
  const meta = (
    <div className="flex items-center gap-x-1.5 gap-y-0.5 flex-wrap">
      <CodeChip code={rec.expenseNum || "—"} />
      {acct && (
        <span className="text-[10px] text-muted-foreground">{acct}</span>
      )}
      {nonUsd && (
        <span className="text-[10px] text-muted-foreground tabular-nums">
          · {formatNumber(rec.nativeAmount, 2)} {rec.currency} ×{" "}
          {formatNumber(rec.rate, 4)}
        </span>
      )}
    </div>
  );
  return (
    <div className="flex items-center justify-between gap-3 pr-1 py-1.5">
      <div className="min-w-0 flex-1">
        {distinctDesc ? (
          <>
            <div className="text-[11.5px] text-foreground/70 leading-snug truncate">
              {distinctDesc}
            </div>
            <div className="mt-0.5">{meta}</div>
          </>
        ) : (
          meta
        )}
      </div>
      <span
        className={cn(
          "text-[11.5px] font-medium tabular-nums shrink-0",
          negative ? "text-emerald-700" : "text-foreground/65"
        )}
      >
        {negative ? "−" : ""}
        {formatCurrency(Math.abs(rec.usd), "USD", { maximumFractionDigits: 0 })}
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
