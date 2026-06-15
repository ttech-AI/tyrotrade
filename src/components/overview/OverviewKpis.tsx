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
import { useT } from "@/lib/i18n/LanguageProvider";
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
 * (açık / aktif sefer / bekleyen / tonaj). All four are clickable
 * IN-PAGE filters: a group card applies its segments to the page's
 * filter state (re-click toggles off), the hero resets to defaults.
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
  onHeroContext,
  onGroupContext,
}: {
  agg: OverviewGroupAggregate;
  /** Reset the page filters to the fresh-visit defaults. */
  onHeroClick: () => void;
  /** Toggle the group's segments on the page's segment filter. */
  onGroupClick: (group: VesselGroup) => void;
  /** Right-click → "Detaya git" context menu (Sefer Takibi). */
  onHeroContext?: (e: React.MouseEvent) => void;
  onGroupContext?: (group: VesselGroup, e: React.MouseEvent) => void;
}) {
  const accent = useThemeAccent();
  const reduceMotion = useReducedMotion();
  const t = useT();
  const assignedPct =
    agg.total > 0 ? (agg.vesselAssignedCount / agg.total) * 100 : 0;
  // Group cards ordered by project count (desc) — the biggest book sits
  // right after the hero, so the row reads as a ranking.
  const sortedRows = [...agg.rows].sort((a, b) => b.count - a.count);

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
            onContextMenu={onHeroContext}
            whileHover={reduceMotion ? undefined : { y: -2, scale: 1.005 }}
            title={t("ov.kpi.heroReset")}
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
                    {t("ov.kpi.totalShipProjects")}
                  </span>
                  <KpiInfoTooltip
                    variant="hero"
                    gradient={accent.gradient}
                    title={t("ov.kpi.fleetSummary")}
                    subtitle={t("ov.kpi.fleetSummarySub")}
                    rows={[
                      {
                        label: t("ov.kpi.vesselAssignedUnassigned"),
                        value: `${agg.vesselAssignedCount} / ${agg.total - agg.vesselAssignedCount}`,
                      },
                      {
                        label: t("ov.kpi.openClosed"),
                        value: `${agg.openCount} / ${agg.total - agg.openCount}`,
                      },
                      {
                        label: t("ov.kpi.activeVoyage"),
                        value: String(agg.commencedCount),
                      },
                      {
                        label: t("ov.kpi.waitingAssignLoad"),
                        value: String(agg.waitingCount),
                      },
                      {
                        label: t("ov.kpi.plannedTotalTonnage"),
                        value: `${formatNumber(Math.round(agg.totalTonnageMt))} t`,
                      },
                      ...sortedRows.map((r) => ({
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
                    %{formatNumber(assignedPct, 0)} {t("ov.kpi.vesselAssignedPct")}
                  </span>
                </div>
              </div>
            </div>

            {/* Tek şerit — gemi var/yok + tonaj; gerisi tooltip'te */}
            <div className="relative mt-3 grid grid-cols-3 gap-x-3 border-t border-white/15 pt-2.5">
              <HeroStat
                label={t("ov.kpi.vesselAssigned")}
                value={agg.vesselAssignedCount}
              />
              <HeroStat
                label={t("ov.kpi.vesselUnassigned")}
                value={agg.total - agg.vesselAssignedCount}
              />
              <div className="min-w-0">
                <div className="text-[9.5px] uppercase tracking-wider text-white/65 truncate">
                  {t("ov.kpi.totalTonnage")}
                </div>
                <div className="text-[14px] font-bold tabular-nums leading-tight">
                  <AnimatedNumber value={agg.totalTonnageMt} preset="tons" />
                </div>
              </div>
            </div>
          </motion.button>
        </motion.div>

        {/* ─── Group cards — hero anatomy on white glass, count-desc ─── */}
        {sortedRows.map((row) => (
          <GroupKpiCard
            key={row.group}
            row={row}
            reduceMotion={!!reduceMotion}
            variants={reduceMotion ? undefined : itemVariants}
            onClick={() => onGroupClick(row.group)}
            onContext={
              onGroupContext
                ? (e) => onGroupContext(row.group, e)
                : undefined
            }
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
  onContext,
}: {
  row: GroupCountRow;
  reduceMotion: boolean;
  variants?: Variants;
  onClick: () => void;
  onContext?: (e: React.MouseEvent) => void;
}) {
  const t = useT();
  const meta = GROUP_META[row.group];
  const assignedPct =
    row.count > 0 ? (row.vesselAssignedCount / row.count) * 100 : 0;
  return (
    <motion.div
      variants={variants}
      className="col-span-12 sm:col-span-6 xl:col-span-3"
    >
      <motion.button
        type="button"
        onClick={onClick}
        onContextMenu={onContext}
        whileHover={reduceMotion ? undefined : { y: -2, scale: 1.005 }}
        title={`${meta.label} ${t("ov.kpi.groupFilter")}`}
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
                // lang="en" on the International label — CSS `uppercase`
                // under the page's tr locale turns "i" into dotted "İ"
                // ("INTERNATİONAL"); English word, English casing.
                lang={row.group === "International" ? "en" : undefined}
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
                  title={`${meta.label} ${t("ov.kpi.groupSummary")}`}
                  subtitle={t("ov.kpi.groupSummarySub")}
                  rows={[
                    {
                      label: t("ov.kpi.project"),
                      value: `${row.count} (%${formatNumber(row.pct, 1)} ${t("ov.kpi.share")})`,
                      dot: meta.solid,
                    },
                    {
                      label: t("ov.kpi.vesselAssignedUnassigned"),
                      value: `${row.vesselAssignedCount} / ${row.count - row.vesselAssignedCount}`,
                    },
                    {
                      label: t("ov.kpi.openProject"),
                      value: String(row.openCount),
                    },
                    {
                      label: t("ov.kpi.activeVoyage"),
                      value: String(row.commencedCount),
                    },
                    {
                      label: t("ov.kpi.waitingAssignLoad"),
                      value: String(row.waitingCount),
                    },
                    {
                      label: t("ov.kpi.plannedTonnage"),
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
                className="text-[11.5px] font-bold tabular-nums truncate"
                style={{ color: meta.solid }}
              >
                %{formatNumber(assignedPct, 0)} {t("ov.kpi.vesselAssignedPct")}
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

        {/* Tek şerit — gemi var/yok + tonaj; gerisi tooltip'te */}
        <div className="mt-3 grid grid-cols-3 gap-x-3 border-t border-border/50 pt-2.5">
          <LightStat
            label={t("ov.kpi.vesselAssigned")}
            value={row.vesselAssignedCount}
          />
          <LightStat
            label={t("ov.kpi.vesselUnassigned")}
            value={row.count - row.vesselAssignedCount}
          />
          <div className="min-w-0">
            <div className="text-[9.5px] uppercase tracking-wider text-muted-foreground/80 truncate">
              {t("ov.kpi.tonnage")}
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
  const t = useT();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="img"
          aria-label={`${title} — ${t("ov.kpi.numericBreakdown")}`}
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
        className="w-[320px] max-w-[90vw] p-0 overflow-hidden rounded-2xl text-foreground shadow-[0_24px_56px_-12px_rgba(15,23,42,0.35)] ring-1 ring-foreground/10"
        // Inline solid white — the base TooltipContent ships the frosted
        // `glass glass-strong` classes whose translucent background made
        // this unreadable over busy cards; an inline style is the only
        // reliable override for a custom (non-Tailwind) class.
        style={{ background: "#ffffff", backdropFilter: "none" }}
      >
        <div className="h-1.5" style={{ background: gradient }} />
        <div className="px-4 pt-3 pb-2.5 flex items-center gap-3 border-b border-border/40">
          <span
            aria-hidden
            className="size-9 rounded-xl grid place-items-center text-white shadow-sm shrink-0"
            style={{
              background: gradient,
              boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.25)",
            }}
          >
            <HugeiconsIcon icon={BoatIcon} size={17} strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <div className="text-[13.5px] font-bold leading-tight tracking-tight">
              {title}
            </div>
            <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">
              {subtitle}
            </div>
          </div>
        </div>
        <div className="px-4 py-3 space-y-2">
          {rows.map((r, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-4 text-[12.5px] leading-snug"
            >
              <span className="inline-flex items-center gap-2 text-muted-foreground min-w-0">
                {r.dot && (
                  <span
                    aria-hidden
                    className="size-2 rounded-full shrink-0"
                    style={{ background: r.dot }}
                  />
                )}
                <span className="truncate">{r.label}</span>
              </span>
              <span className="font-bold tabular-nums shrink-0 text-foreground">
                {r.value}
              </span>
            </div>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
