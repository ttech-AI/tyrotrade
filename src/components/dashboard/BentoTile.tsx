import * as React from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { cn } from "@/lib/utils";
import { useThemeAccent } from "@/components/layout/theme-accent";
import type { IconBadgeTone } from "@/components/details/AccentIconBadge";

type Tone = "default" | "strong" | "subtle";

export interface BentoTileSpan {
  /** Tailwind col-span className fragment, e.g. `col-span-12 md:col-span-6 lg:col-span-3` */
  span?: string;
  /** Tailwind row-span className fragment, e.g. `row-span-2` */
  rowSpan?: string;
}

export interface BentoTileProps extends BentoTileSpan {
  /** Section eyebrow / heading shown at top */
  title?: string;
  /** Optional secondary line under title */
  subtitle?: string;
  /** HugeIcon glyph — passed straight to <HugeiconsIcon icon={...}> */
  icon?: IconSvgElement;
  /** Optional fixed-color override for the icon pill. When omitted, the
   *  badge follows the live sidebar theme via `useThemeAccent`. */
  iconTone?: IconBadgeTone;
  /** Glass density for this tile */
  tone?: Tone;
  /** Override hover behavior — when false, no lift/scale */
  interactive?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Optional right-aligned header slot (e.g. a "Yenile" button) — sits
   *  where the icon used to, now that the icon leads on the left. */
  headerAction?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

/** Stagger child variants — used by BentoGrid parent. Exported so individual
 *  tiles can be dropped into other motion contexts. */
export const tileVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] },
  },
};

/**
 * BentoTile — premium liquid-glass dashboard tile.
 *
 * Composes:
 * - `GlassPanel` for the frosted surface
 * - framer-motion `motion.div` wrapper for stagger / hover lift
 * - HugeIcon header (no background square — stroke-only, accent-tinted)
 *
 * Children render inside a relative content area below the header.
 * Use `span` and `rowSpan` to control bento placement.
 */
export function BentoTile({
  span,
  rowSpan,
  title,
  subtitle,
  icon,
  iconTone,
  tone = "default",
  interactive = true,
  onClick,
  headerAction,
  className,
  children,
}: BentoTileProps) {
  const accent = useThemeAccent();
  const reduceMotion = useReducedMotion();
  // Default pill = live sidebar accent (theme-reactive). Tiles can override
  // with a semantic tone (TONE_PL, TONE_EXPENSE, etc.) when the icon
  // colour itself carries domain meaning.
  const effectiveTone: IconBadgeTone = iconTone ?? {
    gradient: accent.gradient,
    ring: accent.ring,
    solid: accent.solid,
  };

  return (
    <motion.div
      variants={tileVariants}
      onClick={onClick}
      className={cn(
        "min-w-0 min-h-0",
        interactive && !reduceMotion && "hover:-translate-y-0.5 hover:scale-[1.005] transition-transform duration-200",
        span,
        rowSpan,
        onClick && "cursor-pointer"
      )}
    >
      <GlassPanel
        tone={tone}
        className={cn(
          "h-full rounded-2xl overflow-hidden group",
          "transition-shadow duration-200",
          interactive &&
            "hover:shadow-[inset_0_0_0_1px_var(--bento-ring),var(--shadow-glass)]",
          className
        )}
        style={
          {
            // CSS var so the hover inset ring tracks theme accent live
            "--bento-ring": accent.ringStrong,
          } as React.CSSProperties
        }
      >
        <div className="p-4 flex flex-col gap-2 h-full min-w-0">
          {(title || icon || headerAction) && (
            <header className="flex items-center gap-2.5 min-w-0">
              {icon && (
                // Leading stroke icon (left of the title) — mirrors the
                // "Ödeme Bekleyen Gemiler" card. Semantic tone reads
                // through the stroke; no pill so the headline numbers
                // still lead.
                <HugeiconsIcon
                  icon={icon}
                  size={18}
                  strokeWidth={1.75}
                  style={{ color: effectiveTone.solid }}
                  className="shrink-0"
                />
              )}
              <div className="min-w-0 flex-1">
                {title && (
                  // Dark navy ink (`text-slate-900`) gives KPI tile
                  // titles a deliberate weight that lifts them off the
                  // glass surface without competing with the headline
                  // numbers below.
                  <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-900 truncate">
                    {title}
                  </div>
                )}
                {subtitle && (
                  <div className="text-[10.5px] text-muted-foreground/80 truncate mt-0.5">
                    {subtitle}
                  </div>
                )}
              </div>
              {headerAction && <div className="shrink-0">{headerAction}</div>}
            </header>
          )}
          <div className="relative flex-1 min-w-0">{children}</div>
        </div>
      </GlassPanel>
    </motion.div>
  );
}
