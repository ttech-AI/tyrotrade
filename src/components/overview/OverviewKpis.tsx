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
  type GroupCountRow,
  type OverviewGroupAggregate,
  type VesselGroup,
} from "@/lib/selectors/overview";

/**
 * Genel Bakış KPI row — 4 equally-weighted executive cards.
 *
 * Hero (accent gradient) and the 3 group cards (white glass) share the
 * same anatomy: icon pill · label · headline count + share · ⓘ premium
 * tooltip with the numeric breakdown · share bar · 2×2 mini-stat grid
 * (açık / aktif sefer / bekleyen / tonaj). All four are clickable deep
 * links into Sefer Takibi (hero → everything, group → its segments).
 *
 * The ⓘ trigger is a styled chip (not a bare glyph) that scales up on
 * hover — discoverable without stealing attention. It's a <span>, not a
 * <button>, because the whole card is already a button (nested buttons
 * are invalid HTML); clicks on it stop propagation so the tooltip can
 * be inspected without navigating.
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
    <TooltipProvider delayDuration={150}>
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
                  <KpiInfoTooltip
                    variant="hero"
                    gradient={accent.gradient}
                    title="Filo Özeti"
                    subtitle="Filtrelenmiş tüm gemi projeleri"
                    rows={[
                      {
                        label: "Açık / Kapalı",
                        value: `${agg.openCount} / ${agg.total - agg.openCount}`,
                      },
                      {
                        label: "Aktif sefer (Commenced)",
                        value: String(agg.commencedCount),
                      },
                      {
                        label: "Atama / yükleme bekleyen",
                        value: String(agg.waitingCount),
                      },
                      {
                        label: "Planlanan toplam tonaj",
                        value: `${formatNumber(Math.round(agg.totalTonnageMt))} t`,
                      },
                      ...agg.rows.map((r) => ({
                        label: GROUP_META[r.group].label,
                        value: `${r.count} (%${formatNumber(r.pct, 1)})`,
                        dot: GROUP_META[r.group].solid,
                      })),
                    ]}
                  />
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

        {/* ─── Group cards — hero anatomy on white glass ─── */}
        {agg.rows.map((row) => (
          <GroupKpiCard
            key={row.group}
            row={row}
            reduceMotion={!!reduceMotion}
            variants={reduceMotion ? undefined : itemVariants}
            onClick={() => onGroupClick(row.group)}
          />
        ))}
      </motion.div>
    </TooltipProvider>
  );
}

/* ─────────── Group card ─────────── */

function GroupKpiCard({
  row,
  reduceMotion,
  variants,
  onClick,
}: {
  row: GroupCountRow;
  reduceMotion: boolean;
  variants?: Variants;
  onClick: () => void;
}) {
  const meta = GROUP_META[row.group];
  return (
    <motion.div
      variants={variants}
      className="col-span-12 sm:col-span-6 xl:col-span-3"
    >
      <motion.button
        type="button"
        onClick={onClick}
        whileHover={reduceMotion ? undefined : { y: -2, scale: 1.005 }}
        title={`${meta.label} projelerini Sefer Takibi'nde aç`}
        className="group h-full w-full text-left glass glass-subtle rounded-2xl px-4 py-3.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2"
        style={{ "--tw-ring-color": meta.ring } as React.CSSProperties}
      >
        <div className="flex items-start gap-3">
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
            <div className="flex items-center justify-between gap-2">
              <span
                className="text-[10.5px] uppercase tracking-wider font-semibold truncate"
                style={{ color: meta.solid }}
              >
                {meta.label}
              </span>
              <span className="inline-flex items-center gap-1 shrink-0">
                <ArrowUpRight
                  aria-hidden
                  className="size-3.5 text-muted-foreground/50 opacity-0 -translate-x-0.5 group-hover:opacity-100 group-hover:translate-x-0 transition-all"
                  strokeWidth={2.25}
                />
                <KpiInfoTooltip
                  variant="light"
                  gradient={meta.gradient}
                  accentColor={meta.solid}
                  title={`${meta.label} Özeti`}
                  subtitle="Segment ön ekine göre grup"
                  rows={[
                    {
                      label: "Proje",
                      value: `${row.count} (%${formatNumber(row.pct, 1)} pay)`,
                      dot: meta.solid,
                    },
                    { label: "Açık proje", value: String(row.openCount) },
                    {
                      label: "Aktif sefer (Commenced)",
                      value: String(row.commencedCount),
                    },
                    {
                      label: "Atama / yükleme bekleyen",
                      value: String(row.waitingCount),
                    },
                    {
                      label: "Planlanan tonaj",
                      value: `${formatNumber(Math.round(row.tonnageMt))} t`,
                    },
                  ]}
                />
              </span>
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

        {/* Mini-stat grid — same anatomy as the hero card */}
        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-border/50 pt-2.5">
          <LightStat label="Açık proje" value={row.openCount} />
          <LightStat label="Aktif sefer" value={row.commencedCount} />
          <LightStat label="Bekleyen" value={row.waitingCount} />
          <div className="min-w-0">
            <div className="text-[9.5px] uppercase tracking-wider text-muted-foreground/80 truncate">
              Tonaj
            </div>
            <div className="text-[14px] font-bold tabular-nums leading-tight text-foreground">
              <AnimatedNumber value={row.tonnageMt} preset="tons" />
            </div>
          </div>
        </div>
      </motion.button>
    </motion.div>
  );
}

/* ─────────── Shared bits ─────────── */

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

function LightStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0">
      <div className="text-[9.5px] uppercase tracking-wider text-muted-foreground/80 truncate">
        {label}
      </div>
      <div className="text-[14px] font-bold tabular-nums leading-tight text-foreground">
        <AnimatedNumber value={value} preset="count" />
      </div>
    </div>
  );
}

interface TooltipStatRow {
  label: string;
  value: string;
  /** Optional colour dot before the label. */
  dot?: string;
}

/**
 * Premium ⓘ tooltip — gradient top strip, icon-pill header, dot-coded
 * stat rows. The trigger chip is always visible (ring + tinted bg) and
 * scales up on hover so the affordance is unmissable without shouting.
 */
function KpiInfoTooltip({
  variant,
  gradient,
  accentColor,
  title,
  subtitle,
  rows,
}: {
  /** "hero" = white-on-gradient trigger · "light" = on white glass. */
  variant: "hero" | "light";
  gradient: string;
  accentColor?: string;
  title: string;
  subtitle: string;
  rows: TooltipStatRow[];
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="img"
          aria-label={`${title} — sayısal döküm`}
          onClick={(e) => e.stopPropagation()}
          className={
            variant === "hero"
              ? "shrink-0 grid place-items-center size-6 rounded-full bg-white/20 ring-1 ring-white/35 hover:bg-white/30 hover:scale-110 transition-all cursor-help"
              : "shrink-0 grid place-items-center size-6 rounded-full bg-foreground/[0.05] ring-1 ring-border/70 hover:scale-110 hover:bg-foreground/[0.08] transition-all cursor-help"
          }
          style={
            variant === "light" && accentColor
              ? { color: accentColor }
              : undefined
          }
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
        sideOffset={8}
        className="max-w-[300px] p-0 overflow-hidden rounded-xl bg-white text-foreground shadow-[0_18px_44px_-12px_rgba(15,23,42,0.30)] ring-1 ring-foreground/10 backdrop-blur-none"
      >
        <div className="h-1.5" style={{ background: gradient }} />
        <div className="px-3.5 py-2.5 flex items-center gap-2.5 border-b border-border/40">
          <span
            aria-hidden
            className="size-7 rounded-lg grid place-items-center text-white shadow-sm shrink-0"
            style={{ background: gradient }}
          >
            <HugeiconsIcon icon={BoatIcon} size={14} strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <div className="text-[12px] font-bold leading-tight">{title}</div>
            <div className="text-[10.5px] text-muted-foreground leading-tight">
              {subtitle}
            </div>
          </div>
        </div>
        <div className="px-3.5 py-2.5 space-y-1.5">
          {rows.map((r, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-4 text-[11.5px]"
            >
              <span className="inline-flex items-center gap-1.5 text-muted-foreground min-w-0">
                {r.dot && (
                  <span
                    aria-hidden
                    className="size-1.5 rounded-full shrink-0"
                    style={{ background: r.dot }}
                  />
                )}
                <span className="truncate">{r.label}</span>
              </span>
              <span className="font-semibold tabular-nums shrink-0">
                {r.value}
              </span>
            </div>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
