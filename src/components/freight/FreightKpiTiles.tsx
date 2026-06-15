import { HugeiconsIcon } from "@hugeicons/react";
import {
  BoatIcon,
  BadgeDollarSignIcon,
  TrendingUp,
  TrendingDown,
  ChartHistogramIcon,
} from "@hugeicons/core-free-icons";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { formatFreightRate, formatNumber } from "@/lib/format";
import type { FreightKpis } from "@/lib/selectors/freight";

/** Same per-tile gradient palette language as the Trade Cost KPI bar. */
type Tone = "slate" | "emerald" | "sky" | "rose" | "amber";

const TONE_PALETTE: Record<Tone, { gradient: string; ring: string }> = {
  slate: {
    gradient: "linear-gradient(135deg, #94a3b8, #64748b)",
    ring: "rgba(100,116,139,0.35)",
  },
  emerald: {
    gradient: "linear-gradient(135deg, #34d399, #059669)",
    ring: "rgba(16,185,129,0.40)",
  },
  sky: {
    gradient: "linear-gradient(135deg, #38bdf8, #0284c7)",
    ring: "rgba(56,189,248,0.40)",
  },
  rose: {
    gradient: "linear-gradient(135deg, #fb7185, #e11d48)",
    ring: "rgba(244,63,94,0.40)",
  },
  amber: {
    gradient: "linear-gradient(135deg, #fbbf24, #d97706)",
    ring: "rgba(245,158,11,0.40)",
  },
};

/**
 * Five-up KPI bar for Fiyat Takibi. Tiles answer, at a glance:
 *   1. Aktif Hat        — how many lanes have a rate effective today
 *   2. Ortalama Navlun  — the average current rate (dominant currency)
 *   3. En Pahalı Hat    — priciest lane + its rate
 *   4. En Ucuz Hat      — cheapest lane + its rate
 *   5. Piyasa Yönü      — net lanes firming vs softening (a metric the
 *                         source Power BI lacks)
 * Each tile carries an explanatory hover tooltip.
 */
export function FreightKpiTiles({ kpis }: { kpis: FreightKpis }) {
  const firming = kpis.netMomentum > 0;
  const softening = kpis.netMomentum < 0;
  const momentumTone: Tone = firming ? "rose" : softening ? "emerald" : "slate";
  const unit = `${kpis.avgCurrency}/t`;

  return (
    <TooltipProvider delayDuration={250}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <Tile
          label="Aktif Hat"
          value={formatNumber(kpis.activeLanes)}
          sub={`${formatNumber(kpis.totalLanes)} hattan`}
          icon={BoatIcon}
          tone="sky"
          tooltip={{
            title: "Aktif Hat Sayısı",
            body:
              "Bugün geçerli (validity penceresi bugünü kapsayan) bir teklifi olan rota+gemi sınıfı hatlarının sayısı. Parantezdeki toplam, geçmiş/gelecek teklifleri de dahil tüm hat sayısıdır. Aradaki fark, şu an fiyat kotası olmayan (boşta) hatları gösterir.",
            formula: "count(hat: güncel teklif bugünü kapsıyor)",
          }}
        />
        <Tile
          label="Ortalama Güncel Navlun"
          value={
            kpis.avgCurrentPrice == null
              ? "—"
              : formatFreightRate(kpis.avgCurrentPrice, kpis.avgCurrency, false)
          }
          sub={kpis.avgCurrentPrice == null ? "veri yok" : unit}
          icon={BadgeDollarSignIcon}
          tone="slate"
          valueBold
          tooltip={{
            title: "Ortalama Güncel Navlun",
            body:
              "Fiyatı olan tüm hatların güncel navlununun ortalaması, baskın para biriminde (ton başına). Farklı para birimleri tek eksende karışmasın diye yalnızca en sık görülen para biriminin hatları ortalamaya katılır.",
            formula: "ort(hat.güncelFiyat | para birimi = baskın)",
          }}
        />
        <Tile
          label="En Pahalı Hat"
          value={
            kpis.maxPrice
              ? formatFreightRate(
                  kpis.maxPrice.price,
                  kpis.maxPrice.lane.currency,
                  false
                )
              : "—"
          }
          sub={kpis.maxPrice ? kpis.maxPrice.lane.routeLabel : "veri yok"}
          icon={TrendingUp}
          tone="rose"
          tooltip={{
            title: "En Pahalı Hat",
            body:
              "Güncel navlunu en yüksek olan hat (baskın para birimi içinde). Maliyet baskısının en yoğun olduğu rotayı işaret eder — alt satırda rota adı yer alır.",
            formula: "arg max hat.güncelFiyat",
          }}
        />
        <Tile
          label="En Ucuz Hat"
          value={
            kpis.minPrice
              ? formatFreightRate(
                  kpis.minPrice.price,
                  kpis.minPrice.lane.currency,
                  false
                )
              : "—"
          }
          sub={kpis.minPrice ? kpis.minPrice.lane.routeLabel : "veri yok"}
          icon={TrendingDown}
          tone="emerald"
          tooltip={{
            title: "En Ucuz Hat",
            body:
              "Güncel navlunu en düşük olan hat (baskın para birimi içinde). En uygun maliyetli rotayı gösterir — alt satırda rota adı yer alır.",
            formula: "arg min hat.güncelFiyat",
          }}
        />
        <Tile
          label="Piyasa Yönü"
          value={
            kpis.rising + kpis.falling === 0
              ? "—"
              : firming
                ? `▲ ${formatNumber(kpis.netMomentum)}`
                : softening
                  ? `▼ ${formatNumber(Math.abs(kpis.netMomentum))}`
                  : "→ 0"
          }
          sub={`${formatNumber(kpis.rising)} ↑ · ${formatNumber(
            kpis.falling
          )} ↓ · ${formatNumber(kpis.flat)} →`}
          icon={ChartHistogramIcon}
          tone={momentumTone}
          valueBold
          tooltip={{
            title: "Piyasa Yönü (Momentum)",
            body:
              "Her hattın güncel teklifi bir önceki geçerlilik penceresine göre yükseldi mi düştü mü? Net = yükselen − düşen. Pozitif değer piyasanın genel olarak sertleştiğini (navlunlar artıyor), negatif değer yumuşadığını gösterir. ±%0,5 altı değişim 'yatay' sayılır.",
            formula: "yükselen − düşen (Δ%, pencere bazında)",
          }}
        />
      </div>
    </TooltipProvider>
  );
}

function Tile({
  label,
  value,
  sub,
  icon,
  tone,
  valueBold,
  tooltip,
}: {
  label: string;
  value: string;
  sub: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any;
  tone: Tone;
  valueBold?: boolean;
  tooltip: { title: string; body: string; formula: string };
}) {
  const palette = TONE_PALETTE[tone];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="cursor-help">
          <GlassPanel tone="subtle" className="rounded-xl">
            <div className="px-4 py-3 flex items-start gap-3">
              <span
                className="size-10 rounded-xl grid place-items-center shrink-0 text-white shadow-sm"
                style={{
                  background: palette.gradient,
                  boxShadow: `0 4px 12px -4px ${palette.ring}, inset 0 1px 0 0 rgba(255,255,255,0.25)`,
                }}
              >
                <HugeiconsIcon icon={icon} size={18} strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-medium">
                  {label}
                </div>
                <div
                  className={`mt-0.5 tabular-nums leading-tight truncate ${
                    valueBold
                      ? "text-[19px] font-bold"
                      : "text-[18px] font-semibold"
                  }`}
                >
                  {value}
                </div>
                <div className="text-[10.5px] text-muted-foreground/80 mt-0.5 truncate">
                  {sub}
                </div>
              </div>
            </div>
          </GlassPanel>
        </div>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        align="start"
        sideOffset={8}
        className="max-w-[320px] p-0 overflow-hidden bg-white shadow-[0_18px_40px_-12px_rgba(15,23,42,0.28)] ring-1 ring-foreground/10 backdrop-blur-none"
      >
        <div className="h-1" style={{ background: palette.gradient }} />
        <div className="px-3.5 py-2.5 bg-white">
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className="size-6 rounded-lg grid place-items-center shrink-0 text-white shadow-sm"
              style={{
                background: palette.gradient,
                boxShadow: `0 2px 6px -2px ${palette.ring}`,
              }}
            >
              <HugeiconsIcon icon={icon} size={13} strokeWidth={2.25} />
            </span>
            <span className="text-[12px] font-bold uppercase tracking-wider text-foreground">
              {tooltip.title}
            </span>
          </div>
          <p className="text-[12px] leading-snug text-foreground/85 whitespace-normal font-normal">
            {tooltip.body}
          </p>
          <div className="mt-2 pt-1.5 border-t border-foreground/10">
            <div className="text-[9.5px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">
              Formül
            </div>
            <code className="text-[11px] font-mono text-foreground/90 leading-tight">
              {tooltip.formula}
            </code>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
