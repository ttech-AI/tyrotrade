import { motion, useReducedMotion } from "framer-motion";
import { ContainerIcon } from "@hugeicons/core-free-icons";
import { BentoTile } from "../BentoTile";
import { AnimatedNumber } from "../AnimatedNumber";
import { TONE_SEA } from "@/components/details/AccentIconBadge";
import { useThemeAccent } from "@/components/layout/theme-accent";
import type { Project } from "@/lib/dataverse/entities";

interface ActivePipelineTileProps {
  projects: Project[];
  now?: Date;
  span?: string;
  rowSpan?: string;
  onClick?: () => void;
}

/**
 * Voyage statü dağılımı — 6 F&O kategorisi. Görsel olarak hepsi
 * gösterilir (bar + label), ancak tile'ın headline'ı sadece **aktif**
 * 3 kategorinin toplamını alır:
 *   - "To Be Nominated"  — gemi atanmadı            (aktif)
 *   - "Nominated"        — gemi atandı, sefer yok   (aktif)
 *   - "Commenced"        — sefer in-progress         (aktif)
 *   - "Completed"        — teslim edildi             (terminal)
 *   - "Closed"           — dosya kapandı / ödendi   (terminal)
 *   - "Cancelled"        — iptal                    (terminal)
 *
 * Aktif = pipeline'da yaşayan işler. Terminal kategoriler bar'da yer
 * tutar (görünürlük korunur) ama "Aktif Pipeline" sayısına dahil
 * edilmez — çünkü o iş artık aktif değil.
 */
const STATUS_CATEGORIES = [
  { key: "To Be Nominated", label: "To Be Nominated", color: "#f59e0b", active: true },
  { key: "Nominated", label: "Nominated", color: "#0ea5e9", active: true },
  { key: "Commenced", label: "Commenced", color: "#22c55e", active: true },
  { key: "Completed", label: "Completed", color: "#10b981", active: false },
  { key: "Closed", label: "Closed", color: "#64748b", active: false },
  { key: "Cancelled", label: "Cancelled", color: "#f43f5e", active: false },
] as const;

export function ActivePipelineTile({
  projects,
  span,
  rowSpan,
  onClick,
}: ActivePipelineTileProps) {
  const reduceMotion = useReducedMotion();
  const accent = useThemeAccent();

  // Two counters: `activeTotal` (headline — sadece To Be Nominated +
  // Nominated + Commenced) ve `sumStages` (bar payda — 6 kategorinin
  // toplamı). Bar görsel olarak tüm dağılımı gösterir, ama "Aktif
  // Pipeline" başlığı yalnızca pipeline'da yaşayan işleri sayar.
  const counts: Record<string, number> = Object.fromEntries(
    STATUS_CATEGORIES.map((c) => [c.key, 0])
  );
  let activeTotal = 0;
  let sumStages = 0;
  for (const p of projects) {
    const vs = p.vesselPlan?.vesselStatus;
    if (!vs || !(vs in counts)) continue;
    counts[vs]++;
    sumStages++;
    const cat = STATUS_CATEGORIES.find((c) => c.key === vs);
    if (cat?.active) activeTotal++;
  }

  return (
    <BentoTile
      title="Aktif Pipeline"
      subtitle="Voyage durumu · gemi planlı projeler"
      icon={ContainerIcon}
      iconTone={TONE_SEA}
      span={span}
      rowSpan={rowSpan}
      onClick={onClick}
    >
      <div className="flex flex-col gap-3 h-full">
        <div
          className="flex items-baseline gap-3"
          title={`Aktif: ${activeTotal} (To Be Nominated + Nominated + Commenced). Bar tüm ${sumStages} voyage'ın dağılımını gösterir.`}
        >
          {/* Headline = sadece aktif 3 statü (TBN + Nom + Commenced).
              Terminal kategoriler (Completed/Closed/Cancelled) bar'da
              görünür ama aktif sayıma dahil değil. */}
          <span
            className="text-[30px] font-semibold leading-none tracking-tight"
            style={{ color: accent.solid }}
          >
            <AnimatedNumber value={activeTotal} preset="count" />
          </span>
          <span
            className="text-[11px] font-medium"
            style={{ color: accent.stops[2], opacity: 0.75 }}
          >
            aktif proje
          </span>
        </div>

        {/* Tüm 6 voyage statüsünün stacked dağılımı + altında label/sayı
         *  satırı. Bar payda = sumStages (6 kategori toplam). Headline
         *  bunun dışında, sadece aktif 3 kategoriyi sayar. */}
        <div className="flex flex-col gap-2 mt-auto">
          <div
            className="relative h-2.5 w-full rounded-full overflow-hidden"
            style={{
              background: "rgba(15,23,42,0.06)",
              boxShadow:
                "inset 0 1px 1px 0 rgba(15,23,42,0.08), inset 0 -1px 0 0 rgba(255,255,255,0.6)",
            }}
            role="progressbar"
            aria-label="Voyage durum dağılımı"
          >
            {sumStages > 0 &&
              STATUS_CATEGORIES.map((s, i) => {
                const value = counts[s.key] ?? 0;
                const pct = (value / sumStages) * 100;
                const offsetPct = STATUS_CATEGORIES.slice(0, i).reduce(
                  (acc, prev) =>
                    acc + ((counts[prev.key] ?? 0) / sumStages) * 100,
                  0
                );
                return (
                  <motion.div
                    key={s.key}
                    initial={
                      reduceMotion ? { width: `${pct}%` } : { width: 0 }
                    }
                    animate={{ width: `${pct}%` }}
                    transition={{
                      duration: 0.7,
                      delay: 0.1 + i * 0.08,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="absolute top-0 h-full"
                    style={{
                      left: `${offsetPct}%`,
                      background: `linear-gradient(180deg, ${s.color} 0%, ${s.color} 55%, color-mix(in oklab, ${s.color} 75%, black 25%) 100%)`,
                      boxShadow:
                        "inset 0 1px 0 0 rgba(255,255,255,0.4), inset 0 -1px 0 0 rgba(0,0,0,0.08)",
                      // Terminal kategoriler bir tık silikleşsin — bar
                      // okunur kalsın ama aktif kategoriler öne çıksın.
                      opacity: s.active ? 1 : 0.7,
                    }}
                    title={`${s.label}: ${value} proje · %${pct.toFixed(1)}${s.active ? " · aktif" : " · terminal"}`}
                  />
                );
              })}
          </div>

          <div className="flex items-center justify-between gap-x-2 gap-y-1 text-[10.5px] flex-wrap">
            {STATUS_CATEGORIES.map((s) => {
              const value = counts[s.key] ?? 0;
              if (value === 0) return null;
              const pct = sumStages > 0 ? (value / sumStages) * 100 : 0;
              return (
                <div
                  key={s.key}
                  className="flex items-center gap-1.5 min-w-0 truncate"
                  title={`${s.label} — ${value} proje · %${pct.toFixed(1)}${s.active ? " · aktif sayıma dahil" : " · terminal"}`}
                  style={{ opacity: s.active ? 1 : 0.6 }}
                >
                  <span
                    className="size-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="truncate font-medium text-foreground/80">
                    {s.label}
                  </span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {value}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </BentoTile>
  );
}
