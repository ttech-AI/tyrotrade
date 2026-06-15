import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ChatEdit01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { useThemeAccent } from "@/components/layout/theme-accent";
import { useT } from "@/lib/i18n/LanguageProvider";

interface AskAiButtonProps {
  onClick: () => void;
  className?: string;
}

/**
 * "TYRO AI" — opens the Gemini chatbot drawer. Painted with the live
 * sidebar accent so the button visually announces the active theme:
 *   - light theme  → sky/navy gradient
 *   - navy theme   → gold gradient
 *   - black theme  → bright sky gradient
 *
 * Same gradient powers the drawer header, send button, and message
 * avatars so the entire AI surface tracks the user's theme choice.
 *
 * Collapsed-by-default — same dialect as TyroWmsButton on its left.
 * At rest the button is a 36×36 circular icon-only pill so it doesn't
 * crowd the topbar; on hover it animates the width open to reveal the
 * "TYRO AI" wordmark. Pair-symmetric pill geometry with the WMS
 * sibling: same height (h-9), same width animation (w-9 → w-[120px]),
 * same shimmer, same easing.
 */
export function AskAiButton({ onClick, className }: AskAiButtonProps) {
  const [hovered, setHovered] = React.useState(false);
  const accent = useThemeAccent();
  const t = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      aria-label={t("dash.askAi.aria")}
      className={cn(
        "group relative inline-flex items-center shrink-0 overflow-hidden",
        "rounded-full h-9 text-[13px] font-semibold text-white",
        "ring-1 ring-white/15 hover:ring-white/30",
        // Width animation: 36px collapsed → 120px expanded. Same easing
        // + duration as TyroWmsButton so the two pills feel like a
        // coordinated pair when the user hovers them in sequence.
        "transition-[width,box-shadow,transform] duration-300 ease-out",
        hovered ? "w-[120px]" : "w-9",
        "active:scale-95",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className
      )}
      style={{
        background: accent.gradient,
        boxShadow: `0 4px 12px -4px ${accent.ring}, inset 0 1px 0 0 rgba(255,255,255,0.2)`,
      }}
    >
      {/* Animated shimmer overlay on hover */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-0 rounded-full pointer-events-none",
          "before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/30 before:to-transparent",
          "before:translate-x-[-120%] before:transition-transform before:duration-700",
          hovered && "before:translate-x-[120%]"
        )}
      />

      {/* Icon — pinned 36×36 so the collapsed pill is a perfect circle. */}
      <span className="relative z-[1] size-9 grid place-items-center shrink-0">
        <HugeiconsIcon
          icon={ChatEdit01Icon}
          size={16}
          strokeWidth={2}
          className={cn(
            "transition-transform duration-300",
            hovered ? "rotate-6 scale-110" : "rotate-0"
          )}
        />
      </span>

      {/* Wordmark fades in alongside the width animation. */}
      <span
        className={cn(
          "relative z-[1] flex-1 inline-flex items-center justify-center",
          "tracking-tight whitespace-nowrap pr-3",
          "transition-opacity duration-200",
          hovered ? "opacity-100 delay-100" : "opacity-0"
        )}
      >
        TYRO AI
      </span>
    </button>
  );
}
