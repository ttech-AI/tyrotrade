import * as React from "react";
import { useBrandAccent } from "@/freight/hooks/useBrandAccent";
import { cn } from "@/lib/utils";

/** Single icon-pill color — gradient + matching shadow ring tint. */
export interface IconBadgeTone {
  /** CSS background gradient (e.g. `linear-gradient(...)`). */
  gradient: string;
  /** rgba color for outer drop-shadow. */
  ring: string;
  /** Solid mid-stop hex — used by minimal/stroke-only renders that
   *  drop the pill background and need a single semantic colour. */
  solid: string;
}

interface AccentIconBadgeProps {
  /** Icon node — HugeIcon or lucide icon. The badge sets `color: white`
   *  so stroke icons render white automatically. */
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
  /** Optional fixed-color override. When omitted, the badge follows the
   *  live sidebar theme via `useBrandAccent` (used by AppShell page
   *  headers, project list filter pill, etc). When provided, the colors
   *  stay locked to that tone — use this for content-semantic icons
   *  like cargo (amber), expense (rose), or vessel (sea/road). */
  tone?: IconBadgeTone;
  className?: string;
}

const SIZE_TOKENS = {
  sm: "size-7 rounded-lg", // 28px
  md: "size-9 rounded-xl", // 36px — matches AppShell PageTitleSlot
  lg: "size-10 rounded-xl", // 40px — hero overlays
} as const;

/**
 * Stroke-icon pill with gradient background. Shared visual language with
 * `AppShell.PageTitleSlot`. Defaults to the active sidebar accent; pass
 * `tone` to lock the colors to a content-semantic palette.
 */
export function AccentIconBadge({
  children,
  size = "md",
  tone,
  className,
}: AccentIconBadgeProps) {
  const accent = useBrandAccent();
  const effectiveTone = tone ?? {
    gradient: accent.gradient,
    ring: accent.ring,
  };
  return (
    <span
      className={cn(
        "grid place-items-center shrink-0 shadow-sm text-white",
        SIZE_TOKENS[size],
        className
      )}
      style={{
        background: effectiveTone.gradient,
        boxShadow: `0 4px 12px -4px ${effectiveTone.ring}, inset 0 1px 0 0 rgba(255,255,255,0.25)`,
      }}
    >
      {children}
    </span>
  );
}

/* ─────────── Shared content-semantic tones ───────────
 *
 * The source app hardcoded a Tailwind 400/500/700 triple per tone. Here
 * every tone is derived from ONE token expression so it tracks the active
 * palette and dark mode, while the tones stay mutually distinguishable —
 * they label different KPI kinds, so collapsing them all onto the brand
 * would destroy the coding. Anchors are picked by MEANING:
 *
 *   money sign      → --pl-pos / --pl-neg
 *   risk / cost     → --warning
 *   this app's      → --brand-* stops
 *   logistics lanes → --chart-3 / --chart-4 (the categorical ramp)
 *   the rest        → an oklab mix of two of the above, which lands on a
 *                     hue between them in every palette
 */

/** Build the light→mid→deep pill ramp + ring from a single base colour.
 *  The end stops mix toward white/black rather than toward the surface
 *  tokens on purpose: the pill is a saturated fill carrying a white icon
 *  in BOTH themes, so its internal shading must not invert with the page. */
function makeTone(base: string): IconBadgeTone {
  return {
    gradient: `linear-gradient(135deg, color-mix(in oklab, ${base} 74%, white) 0%, ${base} 55%, color-mix(in oklab, ${base} 66%, black) 100%)`,
    ring: `color-mix(in oklab, ${base} 55%, transparent)`,
    solid: base,
  };
}

/** Wheat / cargo — the risk/attention token (was amber gold). */
export const TONE_CARGO: IconBadgeTone = makeTone("var(--warning)");

/** Estimated expense — the loss token: this pill always sits on money
 *  leaving the project, so it takes --pl-neg rather than --destructive. */
export const TONE_EXPENSE: IconBadgeTone = makeTone("var(--pl-neg)");

/** Sea voyage — the canonical brand ramp (was ocean blue, which WAS the
 *  source app's accent). Uses the 3 brand stops verbatim. */
export const TONE_SEA: IconBadgeTone = {
  gradient:
    "linear-gradient(135deg, var(--brand-from) 0%, var(--brand-via) 55%, var(--brand-deep) 100%)",
  ring: "color-mix(in oklab, var(--brand-deep) 55%, transparent)",
  solid: "var(--brand-text)",
};

/** Road / truck — the categorical ramp's mid stop. Sits next to cargo
 *  (--warning) the same way the source's orange sat next to its amber. */
export const TONE_ROAD: IconBadgeTone = makeTone("var(--chart-4)");

/** Profit & loss — the gain token, signals financial gain/loss. */
export const TONE_PL: IconBadgeTone = makeTone("var(--pl-pos)");

/** Forecast / estimate — the brand accent desaturated toward the neutral
 *  text token. Conveys "this is a model prediction" rather than a
 *  realised result, and stays clearly softer than TONE_SEA's full-chroma
 *  brand ramp in every palette. Used by the Tahmini Kâr & Zarar card so
 *  it doesn't read as a closed-out balance. */
export const TONE_FORECAST: IconBadgeTone = makeTone(
  "color-mix(in oklab, var(--brand-via) 62%, var(--muted-foreground))"
);

/** Currency / FX exposure — halfway between the gain token and the brand
 *  accent, i.e. the teal the source used. "Money flow" coding, distinct
 *  from cost (--pl-neg) and P&L (--pl-pos). */
export const TONE_CURRENCY: IconBadgeTone = makeTone(
  "color-mix(in oklab, var(--pl-pos) 55%, var(--brand-via))"
);

/** Corridor / route concentration — the categorical ramp's light stop.
 *  Logistics tone, reads like a "lane" colour without overlapping cargo
 *  (--warning) or road (--chart-4). */
export const TONE_CORRIDOR: IconBadgeTone = makeTone("var(--chart-3)");

/** Velocity / transit time — the deep brand stop pulled toward the loss
 *  token, which lands violet in the cool palettes and plum in the warm
 *  ones. Time / motion / analytics cue, doesn't compete with forecast. */
export const TONE_VELOCITY: IconBadgeTone = makeTone(
  "color-mix(in oklab, var(--brand-deep) 62%, var(--pl-neg))"
);

/** Counterparty / relationship mix — the loss token pulled toward the
 *  light brand stop, i.e. the source's pink/magenta. People / parties
 *  cue. Distinguishes from cargo, expense and velocity. */
export const TONE_COUNTERPARTY: IconBadgeTone = makeTone(
  "color-mix(in oklab, var(--pl-neg) 68%, var(--brand-from))"
);

/** TYRO AI / Gemini chatbot — the light brand stop. Carries the
 *  premium-AI vibe (matches the chatbot drawer avatar tile and the
 *  topbar "TYRO AI" button) while staying lighter-anchored than
 *  TONE_SEA's full brand ramp.
 *  NOTE: Most TYRO AI surfaces now read the live sidebar accent via
 *  `useBrandAccent()` instead of this fixed tone — kept for fallback. */
export const TONE_AI: IconBadgeTone = makeTone("var(--brand-from)");
