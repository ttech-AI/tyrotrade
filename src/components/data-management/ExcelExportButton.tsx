import * as React from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Download01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import {
  exportSheetsToExcel,
  type ExcelSheetSpec,
} from "@/lib/export/excelExport";
import { useT } from "@/lib/i18n/LanguageProvider";

/** Excel'in marka yeşili — tema accent'inden bilinçli olarak bağımsız:
 *  buton "bu bir Excel indirmesi" diye okunmalı (TONE_* sabitleri gibi
 *  semantik, tema-bağımsız bir ton). */
const EXCEL_GRADIENT =
  "linear-gradient(135deg, #34d399 0%, #059669 55%, #065f46 100%)";
const EXCEL_RING = "rgba(5, 150, 105, 0.5)";

/**
 * "Excel" — Veri Yönetimi araç çubuğunda Güncelle'nin yanındaki indirme
 * butonu. Tıklanınca `sheets()` ile o anki master-cache satırları
 * toplanır ve çok sayfalı bir .xlsx olarak indirilir (Güncelle ile dolan
 * sekmeler; ilk sayfa Projeler — sıra çağıranın verdiği dizidir).
 *
 * `sheets` bir FONKSİYON: satırlar tıklama ANINDA okunur, böylece buton
 * mount edildikten sonra gelen bir Güncelle'nin taze verisi indirilir.
 * SheetJS lazy yüklenir (~400 KB) — basmayan kullanıcı bedelini ödemez.
 */
export function ExcelExportButton({
  sheets,
  fileNameBase = "tyro-veri-yonetimi",
  className,
}: {
  sheets: () => ExcelSheetSpec[];
  fileNameBase?: string;
  className?: string;
}) {
  const t = useT();
  const [busy, setBusy] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);

  const handleClick = React.useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const specs = sheets();
      const written = await exportSheetsToExcel(specs, fileNameBase);
      if (written === 0) {
        toast.error(t("dm.excel.empty.toast"));
      } else {
        toast.success(
          t("dm.excel.success.toast").replace("{count}", String(written))
        );
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[ExcelExportButton] export failed:", err);
      toast.error(t("dm.excel.fail.toast"));
    } finally {
      setBusy(false);
    }
  }, [busy, sheets, fileNameBase, t]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      title={t("dm.excel.title")}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "group relative inline-flex items-center gap-2 shrink-0 self-center",
        "rounded-full px-3.5 h-9 text-[13px] font-semibold text-white",
        "ring-1 ring-white/15 hover:ring-white/30",
        "transition-all duration-200 hover:scale-[1.04] active:scale-95",
        "disabled:opacity-85 disabled:cursor-wait disabled:hover:scale-100",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "overflow-hidden whitespace-nowrap justify-center",
        className
      )}
      style={{
        background: EXCEL_GRADIENT,
        boxShadow: `0 4px 12px -4px ${EXCEL_RING}, inset 0 1px 0 0 rgba(255,255,255,0.2)`,
      }}
    >
      {/* Hover shimmer — RefreshAllButton ile aynı mikro-dil */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-0 rounded-full pointer-events-none",
          "before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/30 before:to-transparent",
          "before:translate-x-[-120%] before:transition-transform before:duration-700",
          hovered && !busy && "before:translate-x-[120%]"
        )}
      />
      {busy ? (
        <Loader2 className="size-4 animate-spin" strokeWidth={2.25} />
      ) : (
        <HugeiconsIcon icon={Download01Icon} size={16} strokeWidth={2} />
      )}
      {busy ? t("dm.excel.preparing") : t("dm.excel.label")}
    </button>
  );
}
