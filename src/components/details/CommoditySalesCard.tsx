import * as React from "react";
import { Wheat, DollarSign, Euro } from "lucide-react";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { AccentIconBadge, TONE_CARGO } from "./AccentIconBadge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatCompactCurrency, formatCurrency, formatNumber } from "@/lib/format";
import { useProjectInvoices } from "@/hooks/useProjectInvoices";
import type { Project } from "@/lib/dataverse/entities";

interface Props {
  project: Project;
}

/** F&O `mserp_tryexpensetype` kodları — Navlun. Sağ paneldeki "Navlun/Miktar"
 *  kutusu, tahmini gider satırları arasında bu kodlardan hangisi varsa onun
 *  birim fiyatını (USD/ton) gösterir. İkisi aynı anda nadiren bulunur; ikisi
 *  de varsa öncelik listedeki ilk koda (730026) aittir. costEstimateLines.code
 *  bu raw koddur. */
const FREIGHT_EXPENSE_CODES = ["730026", "721024"] as const;

/**
 * Cargo info card for the project right panel.
 *
 * Shows:
 *   - Product name (with hover tooltip listing distinct invoice line
 *     items: code + Turkish name + tons)
 *   - Tahmini Miktar  ← `mserp_cargoquantity`     (vesselPlan.voyageTotalTonnage)
 *   - Tahmini Bedel   ← `mserp_netfreightamount`  (vesselPlan.netFreightAmount)
 *   - Tahmini Fiyat   = Bedel / Miktar (per-ton)
 *
 * The realised-sales × budget breakdown lives in `BudgetSalesCard`
 * (rendered below this in the right panel). Splitting them keeps each
 * card focused — operators reading cargo quantities aren't distracted
 * by invoice-period rollups.
 */
export function CommoditySalesCard({ project }: Props) {
  // Estimated stats sourced directly from the F&O Gemi Planı:
  //   Tahmini Miktar  ← mserp_cargoquantity      (vesselPlan.voyageTotalTonnage)
  //   Tahmini Bedel   ← mserp_netfreightamount   (vesselPlan.netFreightAmount)
  //   Tahmini Fiyat   = Tahmini Bedel / Tahmini Miktar  (USD per ton)
  // Falls back to summed project lines (kg → t, qty × unitPrice) only when
  // there's no ship plan attached, so legacy land projects still render.
  const fallbackTons =
    project.lines.reduce((s, l) => s + l.quantityKg, 0) / 1000;
  const fallbackValueUsd = project.lines.reduce(
    (s, l) => s + (l.quantityKg / 1000) * l.unitPrice,
    0
  );
  const estimatedTons =
    project.vesselPlan?.voyageTotalTonnage &&
    project.vesselPlan.voyageTotalTonnage > 0
      ? project.vesselPlan.voyageTotalTonnage
      : fallbackTons;
  const estimatedAmount =
    project.vesselPlan?.netFreightAmount &&
    project.vesselPlan.netFreightAmount > 0
      ? project.vesselPlan.netFreightAmount
      : project.vesselPlan?.cargoValueUsd ?? fallbackValueUsd;
  const estimatedPricePerTon =
    estimatedTons > 0 ? estimatedAmount / estimatedTons : 0;

  // Navlun birim fiyatı — tahmini gider satırlarında navlun kodlarından
  // (öncelik sırasıyla 730026, 721024) hangisi varsa onun USD/ton birim
  // fiyatı. Hiçbiri yoksa 0 (kutu "—" gösterir).
  const freightLine = project.costEstimateLines
    ? FREIGHT_EXPENSE_CODES.map((code) =>
        project.costEstimateLines!.find((l) => l.code === code)
      ).find(Boolean)
    : undefined;
  const freightUnitPriceUsd = freightLine?.unitPriceUsd ?? 0;
  const productName =
    project.vesselPlan?.cargoProduct ??
    project.lines[0]?.productName ??
    "—";

  // Currency for the Tahmini Bedel/Fiyat stats — project lines carry the
  // authoritative `mserp_currencycode`. Fall back to the project header
  // currency when no lines exist (rare). USD/EUR/TRY supported.
  const valueCurrency =
    project.lines[0]?.currency ?? project.currency ?? "USD";

  // Tooltip data — distinct (item code, Turkish name, total kg) tuples
  // pulled from invoice rows. Invoices carry both `mserp_itemid` (code)
  // and `mserp_name` (Turkish label) which is more descriptive than
  // `vesselPlan.cargoProduct`. Fetched on-demand per project; the same
  // hook is used by `BudgetSalesCard` so the cache write is shared.
  const { invoices } = useProjectInvoices(project.projectNo);
  const invoiceItems = React.useMemo(() => {
    if (invoices.length === 0) return null;
    const map = new Map<
      string,
      { code: string; name: string; qtyKg: number }
    >();
    for (const inv of invoices) {
      const code = String(inv["mserp_itemid"] ?? "").trim();
      if (!code) continue;
      const name = String(inv["mserp_name"] ?? "").trim();
      const qty = Number(inv["mserp_qty"]);
      let entry = map.get(code);
      if (!entry) {
        entry = { code, name, qtyKg: 0 };
        map.set(code, entry);
      }
      // Take the first non-empty Turkish name we encounter for this code.
      if (!entry.name && name) entry.name = name;
      if (Number.isFinite(qty)) entry.qtyKg += qty;
    }
    return [...map.values()].sort((a, b) => b.qtyKg - a.qtyKg);
  }, [invoices]);

  return (
    <GlassPanel tone="default" className="rounded-2xl">
      <div className="p-4">
        {/* Two-row layout: product name on top (icon + label + name spanning
            full width so long names wrap cleanly), 3-col stats grid below.
            Removes the cramped inline-stat row that didn't fit in the
            sidebar. */}
        <div className="flex items-start gap-2.5 mb-3">
          <AccentIconBadge size="sm" tone={TONE_CARGO}>
            <Wheat className="size-4" strokeWidth={2} />
          </AccentIconBadge>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Taşınan Ürün
            </div>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-[13px] font-semibold leading-snug line-clamp-2 break-words cursor-default">
                    {productName}
                  </div>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  align="start"
                  sideOffset={6}
                  className="max-w-[340px] p-0 overflow-hidden"
                >
                  {invoiceItems && invoiceItems.length > 0 ? (
                    <div className="px-3 py-2.5">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                        Faturalı kalemler · {invoiceItems.length}
                      </div>
                      <div className="space-y-1">
                        {invoiceItems.slice(0, 8).map((item) => (
                          <div
                            key={item.code}
                            className="flex items-baseline gap-2 text-[11.5px]"
                          >
                            <span className="font-mono text-muted-foreground tabular-nums shrink-0 w-14">
                              {item.code}
                            </span>
                            <span className="font-medium text-foreground/90 truncate flex-1 min-w-0">
                              {item.name || "—"}
                            </span>
                            <span className="text-muted-foreground tabular-nums shrink-0">
                              {formatNumber(item.qtyKg / 1000, 0)} t
                            </span>
                          </div>
                        ))}
                        {invoiceItems.length > 8 && (
                          <div className="text-[10px] text-muted-foreground italic pt-1">
                            +{invoiceItems.length - 8} kalem daha
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="px-3 py-2 text-[12px] max-w-[300px] break-words">
                      {productName}
                    </div>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* "Tahmini" tek bir zarif başlığa alındı (üstte, ince ayraç
            çizgisiyle) — böylece kutu etiketleri "Tahmini"yi tekrar
            etmeden kısa kalır: Miktar / Ürün Bedeli / Bedel/Miktar /
            Navlun/Miktar. Dört kutu dar panele 2×2 yerleşir. */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground shrink-0">
            Tahmini
          </span>
          <span className="flex-1 h-px bg-border/50" aria-hidden />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <CompactStat
            label="Miktar"
            value={`${formatNumber(estimatedTons, 0)} t`}
            title={`${formatNumber(estimatedTons, 2)} ton`}
          />
          <CompactStat
            label="Ürün Bedeli"
            // formatCompactCurrency already returns a string with the
            // currency symbol baked in (e.g. "$13,9 Mn"). With the icon
            // prefix this would duplicate the mark, so strip non-digit
            // leading characters and keep only the magnitude.
            value={stripCurrencyMark(
              formatCompactCurrency(estimatedAmount, valueCurrency)
            )}
            title={formatCurrency(estimatedAmount, valueCurrency)}
            icon={<CurrencyIcon currency={valueCurrency} />}
          />
          <CompactStat
            label="Bedel/Miktar"
            value={
              estimatedPricePerTon > 0
                ? `${formatNumber(estimatedPricePerTon, 0)} / t`
                : "—"
            }
            title={
              estimatedPricePerTon > 0
                ? `${formatCurrency(estimatedPricePerTon, valueCurrency)} / ton`
                : undefined
            }
            icon={
              estimatedPricePerTon > 0 ? (
                <CurrencyIcon currency={valueCurrency} />
              ) : undefined
            }
          />
          <CompactStat
            label="Navlun/Miktar"
            // Tahmini giderdeki 730026 (Navlun) satırının birim fiyatı —
            // expamountusdd USD cinsinden olduğu için para birimi sabit USD.
            value={
              freightUnitPriceUsd > 0
                ? `${formatNumber(freightUnitPriceUsd, 0)} / t`
                : "—"
            }
            title={
              freightUnitPriceUsd > 0
                ? `${formatCurrency(freightUnitPriceUsd, "USD")} / ton · Navlun (${freightLine?.code ?? ""})`
                : "Tahmini giderde Navlun satırı (730026 / 721024) yok"
            }
            icon={
              freightUnitPriceUsd > 0 ? (
                <CurrencyIcon currency="USD" />
              ) : undefined
            }
          />
        </div>
      </div>
    </GlassPanel>
  );
}

/* ─────────── Helpers ─────────── */

/** Tight stat tile — label small-caps on top, value below. No min-width so
 *  the tiles pack into the ~360px right-panel (2×2 grid) comfortably.
 *  Optional `icon` renders inline before the value (e.g. currency mark
 *  for monetary stats). `title` attribute carries the un-truncated value
 *  for hover precision. */
function CompactStat({
  label,
  value,
  title,
  icon,
}: {
  label: string;
  value: string;
  title?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className="px-2 py-1.5 rounded-xl bg-card/50 border border-border/40 min-w-0"
      title={title}
    >
      {/* Tek satır — "Tahmini" başlığa taşındığı için etiketler kısa
          (Miktar / Ürün Bedeli / Bedel/Miktar) ve tek satıra sığar. */}
      <div className="text-[9.5px] uppercase tracking-wide text-muted-foreground truncate">
        {label}
      </div>
      <div className="flex items-center gap-1 mt-0.5 min-w-0">
        {icon && (
          <span className="shrink-0 text-muted-foreground/80">{icon}</span>
        )}
        <span className="text-[12.5px] font-semibold tabular-nums truncate">
          {value}
        </span>
      </div>
    </div>
  );
}

/** Drop the currency symbol/code from a `formatCompactCurrency` output so
 *  the icon prefix doesn't double up. `Intl.NumberFormat` for tr-TR
 *  prepends `$`/`€` or appends `₺` / 3-letter codes — strip leading and
 *  trailing non-digit characters except commas/dots in the magnitude. */
function stripCurrencyMark(formatted: string): string {
  // Match the numeric core (digits, dots, commas, optional Mn/Bn suffix
  // like "13,9 Mn" or "13,9 Mr.") and discard everything outside it.
  const match = formatted.match(/-?\d[\d.,]*(?:\s*(?:Mn|Bn|Mr\.?|B|M))?/);
  return match ? match[0].trim() : formatted;
}

/** Render the appropriate currency mark for USD / EUR / TRY. Uses lucide
 *  glyphs for $/€ and the Unicode TL symbol for TRY (no native icon).
 *  Sized to match the value text so the stat reads as a single unit. */
function CurrencyIcon({ currency }: { currency: string }) {
  const cls = "size-3";
  switch (currency.toUpperCase()) {
    case "USD":
      return <DollarSign className={cls} strokeWidth={2.5} />;
    case "EUR":
      return <Euro className={cls} strokeWidth={2.5} />;
    case "TRY":
    case "TL":
      return (
        <span
          className="text-[13px] font-bold leading-none"
          aria-label="Türk Lirası"
        >
          ₺
        </span>
      );
    default:
      return null;
  }
}
