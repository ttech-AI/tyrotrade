import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Robot01Icon } from "@hugeicons/core-free-icons";
import { useLocale } from "@/hooks/useLocale";
import { cn } from "@/lib/utils";

interface TyroChatButtonProps {
  onClick: () => void;
  className?: string;
  active?: boolean;
  /** Icon-only circular variant for tight toolbars (mobile topbar) —
   *  drops the "TYRO Chat" label + min-width so it fits a phone header. */
  compact?: boolean;
  /** Answers that arrived while the user was away — badged on the pill
   *  until the chat is opened. */
  unread?: number;
}

/**
 * Chat CTA fill. The source used a fixed indigo→violet gradient to sit
 * apart from its three hardcoded sidebar accents; in tyroTrade the chat
 * pill is simply the app's primary action, so it rides the brand ramp and
 * follows the user's palette + theme instead of being a fourth fixed hue.
 * Values stay CSS expressions — every consumer drops them into `style`,
 * so the browser repaints on a palette switch with no React work.
 */
const TYRO_CHAT_GRADIENT =
  "linear-gradient(135deg, var(--brand-from) 0%, var(--brand-via) 55%, var(--brand-deep) 100%)";
const TYRO_CHAT_RING = "color-mix(in oklab, var(--brand-deep) 55%, transparent)";

/**
 * "TYRO Chat" — opens the Copilot Studio agent drawer (iframe embed).
 * Mirrors AskAiButton's geometry (h-9, rounded-full, min-w-[110px],
 * text-[13px]) so the two AI CTAs sit as identical-shaped siblings on
 * the topbar.
 */
export function TyroChatButton({
  onClick,
  className,
  active,
  compact,
  unread = 0,
}: TyroChatButtonProps) {
  const [hovered, setHovered] = React.useState(false);
  const { t } = useLocale();
  return (
    // Wrapper exists purely so the unread badge can hang outside the
    // button's rounded edge — the button itself is `overflow-hidden` for
    // the hover shimmer, which would clip a badge rendered inside it.
    <span className="relative inline-flex shrink-0">
    <button
      type="button"
      // Marks this as the chat's own toggle so ChatHost's tap-outside
      // handler doesn't close the panel a beat before this click reopens it.
      data-tyro-chat-trigger=""
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={
        (active ? t("ai.copilot.close.aria") : t("ai.copilot.open.aria")) +
        (unread > 0 ? ` — ${unread} ${t("ai.copilot.unread.aria")}` : "")
      }
      aria-pressed={active}
      className={cn(
        "group relative inline-flex items-center justify-center gap-2 shrink-0",
        compact
          ? "rounded-full size-9"
          : "rounded-full px-3.5 min-w-[110px] h-9",
        "text-[13px] font-semibold text-white",
        "ring-1 ring-white/15 hover:ring-white/30",
        "transition-all duration-200",
        "hover:scale-[1.04]",
        "active:scale-95",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "overflow-hidden",
        className
      )}
      style={{
        background: TYRO_CHAT_GRADIENT,
        // The inset white line is gloss on the coloured fill (not a
        // surface), so it stays literal white in both themes.
        boxShadow: active
          ? `0 0 0 2px color-mix(in oklab, var(--brand-via) 50%, transparent), 0 4px 12px -4px ${TYRO_CHAT_RING}, inset 0 1px 0 0 rgba(255,255,255,0.2)`
          : `0 4px 12px -4px ${TYRO_CHAT_RING}, inset 0 1px 0 0 rgba(255,255,255,0.2)`,
        opacity: active ? 0.85 : 1,
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
      <HugeiconsIcon
        icon={Robot01Icon}
        size={16}
        strokeWidth={2}
        className={cn(
          "shrink-0 transition-transform duration-300 relative z-[1]",
          hovered ? "rotate-[-6deg] scale-110" : "rotate-0"
        )}
      />
      {/* 1px nudge down so the wordmark sits on the Robot icon's
          visual baseline — the glyph has more weight at the bottom
          (head + body) than the top (antenna), which makes the
          geometrically-centered text read as floating high.
          Hidden in compact (icon-only) mode for tight mobile topbars. */}
      {!compact && (
        <span
          className="relative z-[1] tracking-tight"
          style={{ transform: "translateY(1px)" }}
        >
          TYRO Chat
        </span>
      )}
    </button>
      {unread > 0 && (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute -top-1 -right-1 z-[1]",
            "min-w-[18px] h-[18px] px-1 rounded-full grid place-items-center",
            "text-[10px] font-bold tabular-nums text-white",
            "bg-destructive ring-2 ring-background shadow-sm"
          )}
        >
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </span>
  );
}

/** Exported for the drawer header so its accent strip + icon pill use
 *  the same gradient + ring as the trigger button. */
export const TYRO_CHAT_TONE = {
  gradient: TYRO_CHAT_GRADIENT,
  ring: TYRO_CHAT_RING,
  solid: "var(--brand-deep)",
};
