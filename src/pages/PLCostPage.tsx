import { Link } from "react-router-dom";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ChartLineData01Icon,
  Database01Icon,
  RefreshIcon,
} from "@hugeicons/core-free-icons";
import { Loader2 } from "lucide-react";
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
 * Data: `useActualExpenseRollup` lazy auto-fetches the tenant-wide
 * realised-expense rollup on mount (cache miss / stale). The
 * 4-stage pipeline is heavy (~1-2 min) so it's excluded from the
 * bulk refresh — visitors who never open this page don't pay for
 * it. A manual "Yenile" button forces a fresh fetch.
 *
 * MVP iskeletini bu commit kuruyor: page chrome + auto-fetch loading
 * UI + diagnostic preview. Tree-aggregate + table + KPI tile'ları
 * sonraki phase'lerde geliyor.
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
                <> · son hesap {formatDate(rollup.fetchedAt)}</>
              )}
            </div>
          </div>
          {/* Sağ: manuel refresh button — test için. Hook auto-fetch
              zaten yapıyor, ama freshness'ı bypass etmek için. */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={rollup.refresh}
              disabled={rollup.isFetching}
              className="gap-1.5"
            >
              {rollup.isFetching ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <HugeiconsIcon
                  icon={RefreshIcon}
                  size={14}
                  strokeWidth={2}
                />
              )}
              {rollup.isFetching ? "Hesaplanıyor..." : "Yenile"}
            </Button>
          </div>
        </div>
      </GlassPanel>

      {/* ─── İçerik ─── */}
      {rollup.error ? (
        <GlassPanel tone="default" className="flex-1 min-h-0 rounded-2xl">
          <div className="h-full flex items-center justify-center p-8">
            <div className="max-w-md text-center space-y-3">
              <div className="text-rose-700 font-semibold">Hata</div>
              <p className="text-sm text-muted-foreground break-words">
                {rollup.error}
              </p>
              <Button onClick={rollup.refresh} variant="outline" size="sm">
                Tekrar dene
              </Button>
            </div>
          </div>
        </GlassPanel>
      ) : rollup.isFetching && rollup.isEmpty ? (
        // İlk yüklemede: full-page progress
        <GlassPanel tone="default" className="flex-1 min-h-0 rounded-2xl">
          <div className="h-full flex items-center justify-center p-8">
            <div className="max-w-md text-center space-y-4">
              <Loader2
                className="size-10 mx-auto animate-spin"
                style={{ color: accent.solid }}
              />
              <div>
                <div className="text-base font-semibold">
                  Veriler hazırlanıyor
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Gerçekleşen gider rollup'ı 4-aşamalı sorgu zinciri
                  ile çekiliyor (inventdimb → dist → expense-line +
                  refmap). Bu işlem 1-2 dakika sürebilir.
                </p>
              </div>
            </div>
          </div>
        </GlassPanel>
      ) : isPipelineReady ? (
        <GlassPanel tone="default" className="flex-1 min-h-0 rounded-2xl">
          <div className="p-4 flex flex-col gap-3 h-full overflow-auto">
            <div className="text-sm text-muted-foreground">
              Veri pipeline hazır — <strong>{rollup.rows.length}</strong> rollup
              satırı cache'lendi. Tree + KPI + tablo Phase N.3-N.5'te
              canlanacak.
              {rollup.isFetching && (
                <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground/80">
                  <Loader2 className="size-3 animate-spin" /> Arka planda
                  yenileniyor...
                </span>
              )}
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
        // Cache yok + fetch tetiklenmemiş (rare — auto-fetch genelde
        // hemen çalışır). Empty state ile fallback.
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
                  Veri henüz yüklenmedi
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Önce projeler verisi çekilmeli. Veri Yönetimi sayfasından
                  Verileri Güncelle'ye basıp dönün — bu sayfa otomatik
                  hazırlamaya başlar.
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
