import { Link } from "react-router-dom";
import { HugeiconsIcon } from "@hugeicons/react";
import { ChartLineData01Icon, Database01Icon } from "@hugeicons/core-free-icons";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { Button } from "@/components/ui/button";
import { useThemeAccent } from "@/components/layout/theme-accent";
import { useProjects } from "@/hooks/useProjects";
import { useActualExpenseRollup } from "@/hooks/useActualExpenseRollup";
import { formatDate } from "@/lib/format";

/**
 * P&L Cost — Tahmini × Gerçekleşen maliyet karşılaştırma raporu.
 *
 * Hierarchy: Segment → Voyage Status → Vessel/Project (toggle) →
 * Expense Line. Üstte 5 KPI tile + smart insights ribbon, altında
 * sticky-tree hierarchical table, sağda slide-in detail panel.
 *
 * MVP iskeletini bu commit kuruyor: page chrome + boş veri yolunda
 * empty state + Verileri Güncelle yönlendirme. Tree-aggregate logic
 * + table + KPI tile'ları sonraki phase'lerde geliyor.
 */
export function PLCostPage() {
  const accent = useThemeAccent();
  const { projects } = useProjects();
  const rollup = useActualExpenseRollup();

  const totalProjects = projects.length;
  const isPipelineReady = !rollup.isEmpty;

  return (
    <div className="h-full flex flex-col gap-3 min-h-0">
      {/* ─── Toolbar ─── */}
      <GlassPanel tone="strong" className="rounded-2xl shrink-0">
        <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
          {/* Sol: gradient pill + başlık */}
          <span
            className="size-10 rounded-xl grid place-items-center shrink-0 text-white shadow-sm"
            style={{
              background: accent.gradient,
              boxShadow: `0 4px 12px -4px ${accent.ring}, inset 0 1px 0 0 rgba(255,255,255,0.25)`,
            }}
          >
            <HugeiconsIcon
              icon={ChartLineData01Icon}
              size={20}
              strokeWidth={2}
            />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[16px] font-bold tracking-tight leading-tight">
              P&amp;L Cost
            </div>
            <div className="text-[11.5px] text-muted-foreground leading-tight mt-0.5">
              Tahmini × Gerçekleşen Maliyet
              {totalProjects > 0 && ` · ${totalProjects} proje`}
              {rollup.fetchedAt && (
                <>
                  {" · "}son güncelleme {formatDate(rollup.fetchedAt)}
                </>
              )}
            </div>
          </div>
          {/* Sağ: search / filter / view-mode placeholder'ları
              (Phase N.4'te canlanacak) */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-[10.5px] text-muted-foreground italic">
              Toolbar kontrolleri Phase N.4'te eklenecek
            </div>
          </div>
        </div>
      </GlassPanel>

      {/* ─── İçerik ─── */}
      {isPipelineReady ? (
        <GlassPanel tone="default" className="flex-1 min-h-0 rounded-2xl">
          <div className="p-4 flex flex-col gap-3 h-full overflow-auto">
            <div className="text-sm text-muted-foreground">
              Veri pipeline hazır — <strong>{rollup.rows.length}</strong> rollup
              satırı cache'lendi. Tree + KPI + tablo Phase N.3-N.5'te canlanacak.
            </div>
            {/* Geçici inceleme: ilk 20 row */}
            <div className="text-[11px] font-mono bg-foreground/[0.04] rounded-lg p-3 max-h-[60vh] overflow-auto">
              <pre className="whitespace-pre-wrap break-words">
                {JSON.stringify(rollup.rows.slice(0, 20), null, 2)}
              </pre>
            </div>
          </div>
        </GlassPanel>
      ) : (
        <GlassPanel tone="default" className="flex-1 min-h-0 rounded-2xl">
          <div className="h-full flex items-center justify-center p-8">
            <div className="max-w-md text-center space-y-4">
              <span
                className="size-14 mx-auto rounded-2xl grid place-items-center text-white"
                style={{
                  background: accent.gradient,
                  boxShadow: `0 6px 18px -4px ${accent.ring}`,
                }}
              >
                <HugeiconsIcon
                  icon={ChartLineData01Icon}
                  size={26}
                  strokeWidth={2}
                />
              </span>
              <div>
                <div className="text-base font-semibold">
                  Veri henüz hazır değil
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  P&amp;L Cost raporu için Gerçekleşen Gider Toplamları
                  cache'inin doldurulması gerekiyor. Veri Yönetimi sayfasından{" "}
                  <strong>Verileri Güncelle</strong>'ye basıp "Gerçekleşen
                  Gider Toplamları" adımının başarıyla tamamlanmasını
                  bekleyin.
                </p>
              </div>
              <Button asChild>
                <Link to="/data" className="gap-1.5">
                  <HugeiconsIcon
                    icon={Database01Icon}
                    size={16}
                    strokeWidth={2}
                  />
                  Veri Yönetimi'ne git
                </Link>
              </Button>
            </div>
          </div>
        </GlassPanel>
      )}
    </div>
  );
}
