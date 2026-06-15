import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Robot01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

interface TyroChatButtonProps {
  onClick: () => void;
  className?: string;
  active?: boolean;
  /** Icon-only circular variant for tight toolbars (mobile topbar) —
   *  drops the "TYRO Chat" label + min-width so it fits a phone header. */
  compact?: boolean;
}

/**
 * Fixed indigo-violet gradient — distinct from the live-accent TYRO AI
 * button (Gemini chat) and from the muted slate Filtre button so the
 * three topbar pills read as three different "tools": filter, internal
 * AI, external Copilot Studio agent.
 *
 * Indigo→violet matches the Microsoft Copilot brand palette without
 * literally copying it; keeps the surface premium and modern.
 */
const TYRO_CHAT_GRADIENT =
  "linear-gradient(135deg, #818cf8 0%, #6366f1 55%, #4338ca 100%)";
const TYRO_CHAT_RING = "rgba(67, 56, 202, 0.55)";

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
}: TyroChatButtonProps) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={active ? "TYRO Chat'i kapat" : "TYRO Chat'i aç"}
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
        boxShadow: active
          ? `0 0 0 2px rgba(99,102,241,0.5), 0 4px 12px -4px ${TYRO_CHAT_RING}, inset 0 1px 0 0 rgba(255,255,255,0.2)`
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
  );
}

/** Exported for the drawer header so its accent strip + icon pill use
 *  the same gradient + ring as the trigger button. */
export const TYRO_CHAT_TONE = {
  gradient: TYRO_CHAT_GRADIENT,
  ring: TYRO_CHAT_RING,
  solid: "#4338ca",
};
