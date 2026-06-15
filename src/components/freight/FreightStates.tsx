import { Link } from "react-router-dom";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  BoatIcon,
  RefreshIcon,
  Database01Icon,
  Alert02Icon,
} from "@hugeicons/core-free-icons";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { Button } from "@/components/ui/button";
import { useThemeAccent } from "@/components/layout/theme-accent";
import { formatNumber } from "@/lib/format";
import type { FreightFetchProgress } from "@/lib/dataverse/freightPrices";

/* ─────────── Loading ─────────── */

const STAGE_TEXT: Record<FreightFetchProgress["stage"], string> = {
  headers: "Rota başlıkları çekiliyor",
  details: "Fiyat satırları çekiliyor",
  join: "Rotalar fiyatlarla eşleştiriliyor",
};

const STAGE_ORDER: FreightFetchProgress["stage"][] = [
  "headers",
  "details",
  "join",
];

/** Light fetch narration — a pulsing badge + the active stage + a 3-dot
 *  step rail. Far simpler than the Trade Cost AI-engine panel because the
 *  freight fetch is just two calls + a join. */
export function FreightProgress({
  progress,
}: {
  progress: FreightFetchProgress | null;
}) {
  const accent = useThemeAccent();
  const activeIdx = progress ? STAGE_ORDER.indexOf(progress.stage) : 0;
  return (
    <GlassPanel tone="default" className="flex-1 min-h-0 rounded-2xl">
      <div className="h-full flex items-center justify-center p-8">
        <div className="max-w-md w-full text-center space-y-5">
          <div className="inline-flex">
            <span
              className="size-16 rounded-2xl grid place-items-center text-white shadow-lg animate-pulse"
              style={{
                background: accent.gradient,
                boxShadow: `0 10px 28px -8px ${accent.ring}, inset 0 1px 0 0 rgba(255,255,255,0.30)`,
              }}
            >
              <HugeiconsIcon icon={BoatIcon} size={28} strokeWidth={1.75} />
            </span>
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              Navlun fiyatları yükleniyor…
            </h2>
            <p className="text-[13px] text-muted-foreground">
              {progress ? STAGE_TEXT[progress.stage] : "Bağlanılıyor"}
              {progress && progress.loaded > 0 && (
                <span className="font-semibold text-foreground">
                  {" "}
                  · {formatNumber(progress.loaded)} kayıt
                </span>
              )}
            </p>
          </div>
          {/* 3-step rail */}
          <div className="flex items-center justify-center gap-2">
            {STAGE_ORDER.map((s, i) => {
              const done = i < activeIdx;
              const active = i === activeIdx;
              return (
                <span
                  key={s}
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    width: active ? 28 : 14,
                    background:
                      done || active ? accent.solid : "rgba(15,23,42,0.12)",
                    opacity: done ? 0.5 : 1,
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}

/* ─────────── Empty (first load / cache cleared) ─────────── */

export function FreightEmptyState({
  hasData,
  onLoad,
}: {
  /** True when project/data layer is reachable; false routes to Veri Yönetimi. */
  hasData: boolean;
  onLoad: () => void;
}) {
  const accent = useThemeAccent();
  return (
    <GlassPanel tone="default" className="flex-1 min-h-0 rounded-2xl">
      <div className="h-full flex items-center justify-center p-8">
        <div className="max-w-lg w-full text-center space-y-5">
          <div className="inline-flex">
            <span
              className="size-16 rounded-2xl grid place-items-center text-white shadow-lg"
              style={{
                background: accent.gradient,
                boxShadow: `0 10px 28px -8px ${accent.ring}, inset 0 1px 0 0 rgba(255,255,255,0.30)`,
              }}
            >
              <HugeiconsIcon icon={BoatIcon} size={28} strokeWidth={1.75} />
            </span>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              İndikatif Navlun Fiyatları
            </h2>
            <p className="text-[13.5px] text-muted-foreground leading-relaxed max-w-md mx-auto">
              Rota başlıkları ve fiyat satırları Dataverse'ten çekilip
              birleştirilir; her rota+gemi sınıfı için güncel oran ve trend
              gösterilir. Sonuç önbelleğe alınır — tekrar açıldığında anında
              gelir.
            </p>
          </div>
          {hasData ? (
            <button
              type="button"
              onClick={onLoad}
              className="inline-flex items-center gap-2 h-11 px-6 rounded-full text-white font-semibold text-[14px] shadow-md transition-transform hover:scale-[1.03] active:scale-95"
              style={{
                background: accent.gradient,
                boxShadow: `0 6px 18px -6px ${accent.ring}, inset 0 1px 0 0 rgba(255,255,255,0.25)`,
              }}
            >
              <HugeiconsIcon icon={RefreshIcon} size={17} strokeWidth={2} />
              Navlun fiyatlarını yükle
            </button>
          ) : (
            <div className="text-[13px] text-muted-foreground/90 pt-1">
              Canlı veri kaynağına ulaşılamadı.{" "}
              <Link
                to="/data"
                className="font-semibold text-foreground hover:underline inline-flex items-center gap-1"
              >
                <HugeiconsIcon icon={Database01Icon} size={13} strokeWidth={2} />
                Veri Yönetimi'ne git
              </Link>
            </div>
          )}
        </div>
      </div>
    </GlassPanel>
  );
}

/* ─────────── Mock-mode (real-only page) ─────────── */

export function FreightMockState() {
  return (
    <GlassPanel tone="default" className="flex-1 min-h-0 rounded-2xl">
      <div className="h-full flex items-center justify-center p-8">
        <div className="max-w-md text-center space-y-3">
          <div className="inline-flex">
            <span className="size-14 rounded-2xl grid place-items-center bg-slate-100 ring-1 ring-slate-200 text-slate-500">
              <HugeiconsIcon icon={BoatIcon} size={26} strokeWidth={1.75} />
            </span>
          </div>
          <h2 className="text-lg font-bold tracking-tight text-foreground">
            Canlı veri gerekiyor
          </h2>
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            Fiyat Takibi yalnızca gerçek Dataverse verisiyle çalışır — bu
            entity'lerin mock karşılığı yok. Gerçek moda geçip giriş
            yaptığında navlun fiyatları otomatik yüklenir.
          </p>
        </div>
      </div>
    </GlassPanel>
  );
}

/* ─────────── Error ─────────── */

export function FreightErrorState({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <GlassPanel tone="default" className="flex-1 min-h-0 rounded-2xl">
      <div className="h-full flex items-center justify-center p-8">
        <div className="max-w-md text-center space-y-3">
          <div className="inline-flex">
            <span className="size-14 rounded-2xl grid place-items-center bg-rose-50 ring-1 ring-rose-200 text-rose-600">
              <HugeiconsIcon icon={Alert02Icon} size={26} strokeWidth={2} />
            </span>
          </div>
          <div className="text-rose-700 font-semibold">Veri çekilemedi</div>
          <p className="text-sm text-muted-foreground break-words">{error}</p>
          <Button onClick={onRetry} variant="outline" size="sm">
            Tekrar dene
          </Button>
        </div>
      </div>
    </GlassPanel>
  );
}
