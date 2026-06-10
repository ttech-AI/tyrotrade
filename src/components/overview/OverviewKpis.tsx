import * as React from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  BoatIcon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AnimatedNumber } from "@/components/dashboard/AnimatedNumber";
import { useThemeAccent } from "@/components/layout/theme-accent";
import { formatNumber } from "@/lib/format";
import {
  GROUP_META,
  type OverviewGroupAggregate,
  type VesselGroup,
} from "@/lib/selectors/overview";

/**
 * Genel Bakış KPI row.
 *
 * Hero = "yönetici içgörü kartı": theme-accent gradient, headline count,
 * a 2×2 executive mini-stat grid (açık · aktif sefer · bekleyen · tonaj)
 * and an ⓘ tooltip with the numeric breakdown. Clicking it opens Sefer
 * Takibi unfiltered.
 *
 * The 3 group cards are interactive: hover lift + arrow affordance;
 * clicking opens Sefer Takibi pre-filtered to that group's segments.
 */

const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] },
  },
};

export function OverviewKpis({
  agg,
  onHeroClick,
  onGroupClick,
}: {
  agg: OverviewGroupAggregate;
  /** Open Sefer Takibi with the page's full (unfiltered) scope. */
  onHeroClick: () => void;
  /** Open Sefer Takibi pre-filtered to the group's segments. */
  onGroupClick: (group: VesselGroup) => void;
}) {
  const accent = useThemeAccent();
  const reduceMotion = useReducedMotion();
  const openPct = agg.total > 0 ? (agg.openCount / agg.total) * 100 : 0;

  return (
    <TooltipProvider delayDuration={200}>
      <motion.div
        variants={reduceMotion ? undefined : containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-12 gap-3"
      >
        {/* ─── Hero — executive summary ─── */}
        <motion.div
          variants={reduceMotion ? undefined : itemVariants}
          className="col-span-12 sm:col-span-6 xl:col-span-3"
        >
          <motion.button
            type="button"
            onClick={onHeroClick}
            whileHover={reduceMotion ? undefined : { y: -2, scale: 1.005 }}
            title="Tüm gemi projelerini Sefer Takibi'nde aç"
            className="h-full w-full text-left rounded-2xl px-4 py-3.5 text-white overflow-hidden relative cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            style={{
              background: accent.gradient,
              boxShadow: `0 10px 28px -10px ${accent.ring}, inset 0 1px 0 0 rgba(255,255,255,0.25)`,
            }}
          >
            {/* Decorative glow blobs — depth without noise */}
            <span
              aria-hidden
              className="absolute -top-8 -right-8 size-28 rounded-full bg-white/10 blur-2xl pointer-events-none"
            />
            <span
              aria-hidden
              className="absolute -bottom-10 -left-6 size-24 rounded-full bg-black/10 blur-2xl pointer-events-none"
            />

            <div className="relative flex items-start gap-3">
              <span
                aria-hidden
                className="size-10 rounded-xl grid place-items-center shrink-0 bg-white/15 backdrop-blur-sm"
                style={{ boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.25)" }}
              >
                <HugeiconsIcon icon={BoatIcon} size={20} strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10.5px] uppercase tracking-wider font-semibold text-white/85 truncate">
                    Toplam Gemi Projesi
                  </span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className="shrink-0 grid place-items-center size-5 rounded-full hover:bg-white/15 transition-colors"
                        aria-label="Sayısal özet"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <HugeiconsIcon
                          icon={InformationCircleIcon}
                          size={14}
                          strokeWidth={2}
                        />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent
                      side="bottom"
                      className="max-w-[280px] bg-white text-foreground shadow-[0_18px_40px_-12px_rgba(15,23,42,0.28)] ring-1 ring-foreground/10 backdrop-blur-none p-0 overflow-hidden"
                    >
                      <div
                        className="h-1"
                        style={{ background: accent.gradient }}
                      />
                      <div className="px-3 py-2.5 space-y-1">
                        <div className="text-[11.5px] font-bold">
                          Filo Özeti
                        </div>
                        <TooltipRow
                          label="Açık / Kapalı"
                          value={`${agg.openCount} / ${agg.total - agg.openCount}`}
                        />
                        <TooltipRow
                          label="Aktif sefer (Commenced)"
                          value={String(agg.commencedCount)}
                        />
                        <TooltipRow
                          label="Atama/yükleme bekleyen"
                          value={String(agg.waitingCount)}
                        />
                        <TooltipRow
                          label="Planlanan toplam tonaj"
                          value={`${formatNumber(Math.round(agg.totalTonnageMt))} t`}
                        />
                        {agg.rows.map((r) => (
                          <TooltipRow
                            key={r.group}
                            label={GROUP_META[r.group].label}
                            value={`${r.count} (%${formatNumber(r.pct, 1)})`}
                          />
                        ))}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="mt-0.5 flex items-baseline gap-2">
                  <span className="text-[28px] font-semibold leading-none tracking-tight tabular-nums">
                    <AnimatedNumber value={agg.total} preset="count" />
                  </span>
                  <span className="text-[11px] font-semibold text-white/80 tabular-nums">
                    %{formatNumber(openPct, 0)} açık
                  </span>
                </div>
              </div>
            </div>

            {/* Executive mini-stat grid */}
            <div className="relative mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-white/15 pt-2.5">
              <HeroStat label="Açık proje" value={agg.openCount} />
              <HeroStat label="Aktif sefer" value={agg.commencedCount} />
              <HeroStat label="Bekleyen" value={agg.waitingCount} />
              <div className="min-w-0">
                <div className="text-[9.5px] uppercase tracking-wider text-white/65 truncate">
                  Toplam Tonaj
                </div>
                <div className="text-[14px] font-bold tabular-nums leading-tight">
                  <AnimatedNumber value={agg.totalTonnageMt} preset="tons" />
                </div>
              </div>
            </div>
          </motion.button>
        </motion.div>

        {/* ─── Group cards — clickable ─── */}
        {agg.rows.map((row) => {
          const meta = GROUP_META[row.group];
          return (
            <motion.div
              key={row.group}
              variants={reduceMotion ? undefined : itemVariants}
              className="col-span-12 sm:col-span-6 xl:col-span-3"
            >
              <motion.button
                type="button"
                onClick={() => onGroupClick(row.group)}
                whileHover={
                  reduceMotion ? undefined : { y: -2, scale: 1.005 }
                }
                title={`${meta.label} projelerini Sefer Takibi'nde aç`}
                className="group h-full w-full text-left glass glass-subtle rounded-2xl cursor-pointer focus-visible:outline-none focus-visible:ring-2"
                style={
                  {
                    "--tw-ring-color": meta.ring,
                  } as React.CSSProperties
                }
              >
                <div className="px-4 py-3.5 flex items-start gap-3 h-full">
                  <span
                    aria-hidden
                    className="size-10 rounded-xl grid place-items-center shrink-0 text-white shadow-sm"
                    style={{
                      background: meta.gradient,
                      boxShadow: `0 4px 12px -4px ${meta.ring}, inset 0 1px 0 0 rgba(255,255,255,0.25)`,
                    }}
                  >
                    <HugeiconsIcon
                      icon={BoatIcon}
                      size={18}
                      strokeWidth={1.75}
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="text-[10.5px] uppercase tracking-wider font-semibold truncate"
                        style={{ color: meta.solid }}
                      >
                        {meta.label}
                      </span>
                      <ArrowUpRight
                        aria-hidden
                        className="size-3.5 shrink-0 text-muted-foreground/50 opacity-0 -translate-x-0.5 group-hover:opacity-100 group-hover:translate-x-0 transition-all"
                        strokeWidth={2.25}
                      />
                    </div>
                    <div className="mt-0.5 flex items-baseline gap-2">
                      <span className="text-[24px] font-semibold leading-none tracking-tight tabular-nums text-foreground">
                        <AnimatedNumber value={row.count} preset="count" />
                      </span>
                      <span
                        className="text-[12px] font-bold tabular-nums"
                        style={{ color: meta.solid }}
                      >
                        %{formatNumber(row.pct, 1)}
                      </span>
                    </div>
                    {/* Mini share bar */}
                    <div
                      className="mt-2 h-1.5 w-full rounded-full overflow-hidden"
                      style={{ background: "rgba(15,23,42,0.06)" }}
                    >
                      <motion.div
                        className="h-full rounded-full"
                        initial={reduceMotion ? false : { width: 0 }}
                        animate={{
                          width: `${Math.max(0, Math.min(100, row.pct))}%`,
                        }}
                        transition={{
                          duration: 0.7,
                          ease: [0.22, 1, 0.36, 1],
                          delay: 0.15,
                        }}
                        style={{ background: meta.gradient }}
                      />
                    </div>
                  </div>
                </div>
              </motion.button>
            </motion.div>
          );
        })}
      </motion.div>
    </TooltipProvider>
  );
}

function HeroStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0">
      <div className="text-[9.5px] uppercase tracking-wider text-white/65 truncate">
        {label}
      </div>
      <div className="text-[14px] font-bold tabular-nums leading-tight">
        <AnimatedNumber value={value} preset="count" />
      </div>
    </div>
  );
}

function TooltipRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}
