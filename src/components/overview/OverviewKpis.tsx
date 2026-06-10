import { motion, useReducedMotion, type Variants } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import { BoatIcon } from "@hugeicons/core-free-icons";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { AnimatedNumber } from "@/components/dashboard/AnimatedNumber";
import { useThemeAccent } from "@/components/layout/theme-accent";
import { formatNumber } from "@/lib/format";
import {
  GROUP_META,
  type OverviewGroupAggregate,
} from "@/lib/selectors/overview";

/**
 * Genel Bakış KPI row — 1 hero card (Toplam Gemi Projesi, theme-accent
 * gradient like the reference report's highlighted tile) + 3 group cards
 * (Anadolu / Organik / International) with count, share % and a mini
 * progress bar in each group's fixed semantic colour.
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

export function OverviewKpis({ agg }: { agg: OverviewGroupAggregate }) {
  const accent = useThemeAccent();
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      variants={reduceMotion ? undefined : containerVariants}
      initial="hidden"
      animate="show"
      className="grid grid-cols-12 gap-3"
    >
      {/* Hero — total vessel projects */}
      <motion.div
        variants={reduceMotion ? undefined : itemVariants}
        className="col-span-12 sm:col-span-6 xl:col-span-3"
      >
        <div
          className="h-full rounded-2xl px-4 py-3.5 flex items-start gap-3 text-white overflow-hidden relative"
          style={{
            background: accent.gradient,
            boxShadow: `0 10px 28px -10px ${accent.ring}, inset 0 1px 0 0 rgba(255,255,255,0.25)`,
          }}
        >
          <span
            aria-hidden
            className="size-10 rounded-xl grid place-items-center shrink-0 bg-white/15 backdrop-blur-sm"
            style={{ boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.25)" }}
          >
            <HugeiconsIcon icon={BoatIcon} size={20} strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[10.5px] uppercase tracking-wider font-semibold text-white/85 truncate">
              Toplam Gemi Projesi
            </div>
            <div className="mt-0.5 text-[26px] font-semibold leading-none tracking-tight tabular-nums">
              <AnimatedNumber value={agg.total} preset="count" />
            </div>
            <div className="text-[11px] font-medium text-white/80 mt-1 truncate">
              {agg.openCount} açık proje
            </div>
          </div>
        </div>
      </motion.div>

      {/* Group cards */}
      {agg.rows.map((row) => {
        const meta = GROUP_META[row.group];
        return (
          <motion.div
            key={row.group}
            variants={reduceMotion ? undefined : itemVariants}
            className="col-span-12 sm:col-span-6 xl:col-span-3"
          >
            <GlassPanel tone="subtle" className="h-full rounded-2xl">
              <div className="px-4 py-3.5 flex items-start gap-3 h-full">
                <span
                  aria-hidden
                  className="size-10 rounded-xl grid place-items-center shrink-0 text-white shadow-sm"
                  style={{
                    background: meta.gradient,
                    boxShadow: `0 4px 12px -4px ${meta.ring}, inset 0 1px 0 0 rgba(255,255,255,0.25)`,
                  }}
                >
                  <HugeiconsIcon icon={BoatIcon} size={18} strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <div
                    className="text-[10.5px] uppercase tracking-wider font-semibold truncate"
                    style={{ color: meta.solid }}
                  >
                    {meta.label}
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
            </GlassPanel>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
