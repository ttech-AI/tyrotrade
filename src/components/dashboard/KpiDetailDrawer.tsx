import * as React from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  type IconBadgeTone,
} from "@/components/details/AccentIconBadge";
import { useThemeAccent } from "@/components/layout/theme-accent";
import { cn } from "@/lib/utils";

/* ─────────── KPI identifier union ─────────── */

export type KpiId =
  | "period"
  | "pl"
  | "quantity"
  | "expense"
  | "pipeline"
  | "currency"
  | "corridor"
  | "velocity"
  | "counterparty";

/* ─────────── Drawer chrome ─────────── */

interface KpiDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Header label (e.g. "Tahmini Gider"). */
  title: string;
  /** Optional subtitle (e.g. "USD · 95 proje"). */
  subtitle?: string;
  /** Icon glyph for the header pill. */
  icon?: IconSvgElement;
  /** Header pill colour — usually the same tone the source tile uses. */
  iconTone?: IconBadgeTone;
  /** Optional toolbar (search + sort) that renders **outside** ScrollArea
   *  so it stays pinned to the top of the body while rows scroll under
   *  it. Pass a `<KpiDrawerToolbar />` element here — drawer doesn't own
   *  the search/sort state because it changes per-KPI. */
  toolbar?: React.ReactNode;
  /** Tailwind max-width class for the drawer panel. Defaults to a
   *  narrow 480px; pass a wider one (e.g. the realized-P&L breakdown)
   *  for content that needs room to breathe. */
  widthClass?: string;
  children?: React.ReactNode;
}

/**
 * Right-side detail drawer for the dashboard KPI tiles. Shares the
 * floating-glass dialect with TyroAiDrawer (rounded-l-3xl, opaque
 * white, theme accent strip on top). Body is a ScrollArea — each
 * KPI's own breakdown component renders into `children`.
 */
export function KpiDetailDrawer({
  open,
  onOpenChange,
  title,
  subtitle,
  icon,
  iconTone,
  toolbar,
  widthClass = "sm:max-w-[480px]",
  children,
}: KpiDetailDrawerProps) {
  const accent = useThemeAccent();
  // Header tone defaults to the live sidebar accent so each drawer's
  // chrome syncs with the tile that opened it (each tile passes its
  // own tone here when it has a fixed semantic colour).
  const tone = iconTone ?? {
    gradient: accent.gradient,
    ring: accent.ring,
    solid: accent.solid,
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          // `overflow-hidden` is required so the top accent strip
          // (first child) honours the parent's `rounded-l-3xl` —
          // without it the strip cuts straight across the rounded
          // top-left corner instead of curving into it.
          "w-full p-0 flex flex-col gap-0 overflow-hidden",
          widthClass,
          "bg-white/95 backdrop-blur-2xl backdrop-saturate-150",
          "border-l border-border/60",
          "shadow-[0_30px_80px_-16px_rgba(15,23,42,0.45)]"
        )}
        aria-describedby={undefined}
      >
        {/* Top accent bar — instantly identifies which KPI the drawer
            is showing through its tone colour. */}
        <div
          aria-hidden
          className="h-1 w-full shrink-0"
          style={{ background: tone.gradient }}
        />

        {/* Header */}
        <div className="px-5 py-4 flex items-center gap-3 shrink-0 border-b border-border/40">
          {icon && (
            <span
              className="size-10 rounded-xl grid place-items-center shrink-0 shadow-sm text-white"
              style={{
                background: tone.gradient,
                boxShadow: `0 4px 12px -4px ${tone.ring}, inset 0 1px 0 0 rgba(255,255,255,0.25)`,
              }}
            >
              <HugeiconsIcon icon={icon} size={18} strokeWidth={1.75} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <SheetTitle className="text-[16px] font-semibold tracking-tight leading-tight">
              {title}
            </SheetTitle>
            {subtitle && (
              <SheetDescription className="text-[12px] text-muted-foreground leading-tight mt-0.5">
                {subtitle}
              </SheetDescription>
            )}
          </div>
        </div>

        {/* Toolbar (search + sort) — pinned outside ScrollArea so the
            input stays accessible regardless of row scroll position. */}
        {toolbar}

        {/* Body */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-2 py-2">{children}</div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

/* ─────────── Reusable group / row primitives ─────────── */

/**
 * Header for a group of project rows (e.g. "Commenced · 11" inside the
 * Pipeline drawer). Optional value chip on the right for the group's
 * total metric.
 *
 * Renders as a tinted band — light slate fill + soft inner border — so
 * group boundaries pop visibly through the dense row stack. Optional
 * `icon` (HugeIcons) sits in a small badge on the left; a `toneColor`
 * vertical strip threads alongside the icon when categories carry a
 * semantic palette (status, currency, etc.).
 *
 * Premium hierarchy: tinted surface, accent strip, icon badge, uppercase
 * label, count pill, optional metric chip on the right.
 */
export function KpiGroupHeader({
  label,
  count,
  valueChip,
  toneColor,
  icon,
}: {
  label: string;
  count: number;
  valueChip?: React.ReactNode;
  /** Optional accent colour for the left strip — categorical palette. */
  toneColor?: string;
  /** Optional HugeIcons glyph to render in the left badge. */
  icon?: IconSvgElement;
}) {
  return (
    <div
      className={cn(
        "relative flex items-center gap-2 mt-3 mb-1.5 first:mt-1",
        "px-3 py-2 rounded-lg overflow-hidden",
        "bg-foreground/[0.045]",
        "border border-foreground/[0.07]"
      )}
    >
      {toneColor && (
        <span
          aria-hidden
          className="absolute inset-y-2 left-0 w-1 rounded-r-full"
          style={{ backgroundColor: toneColor }}
        />
      )}
      {icon && (
        <span
          className={cn(
            "size-6 rounded-md grid place-items-center shrink-0",
            "bg-white/70 ring-1 ring-foreground/[0.06] text-foreground/80",
            toneColor ? "ml-1" : ""
          )}
          style={
            toneColor
              ? {
                  color: toneColor,
                  boxShadow: `inset 0 0 0 1px ${toneColor}33`,
                }
              : undefined
          }
        >
          <HugeiconsIcon icon={icon} size={13} strokeWidth={1.85} />
        </span>
      )}
      <span className="text-[10.75px] font-bold uppercase tracking-[0.14em] text-foreground/85 truncate min-w-0">
        {label}
      </span>
      <span
        className={cn(
          "inline-flex items-center justify-center min-w-5 h-4 px-1.5 rounded-full shrink-0",
          "text-[9.5px] font-semibold tabular-nums",
          "bg-white/85 text-foreground/75",
          "ring-1 ring-foreground/[0.08]"
        )}
      >
        {count}
      </span>
      <div className="flex-1" />
      {valueChip}
    </div>
  );
}

/* ─────────── Segment chip ─────────── */

/**
 * Small tinted pill that surfaces a project's segment (e.g.
 * "International") next to the projectNo. Neutral palette so any
 * drawer's tone keeps dominance; truncate-safe so long segment names
 * never push the metric out of view.
 */
export function SegmentChip({ segment }: { segment: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center h-4 px-1.5 rounded-md shrink-0",
        "text-[9.5px] font-semibold uppercase tracking-wide",
        "text-foreground/75 bg-foreground/[0.06]",
        "border border-foreground/10"
      )}
    >
      {segment}
    </span>
  );
}

/**
 * Single project row inside the drawer body. Click → close drawer +
 * navigate to the Vessel Projects page with that project filtered
 * down to a single-project list AND selected. The `state` payload is
 * read by `ProjectsPage` once on mount/transition.
 *
 * Two-line layout (premium hierarchy):
 *   • Line 1 — projectNo (mono) · projectName (semi-bold)
 *   • Line 2 — segment chip (when present) · vessel ⚓ name
 *
 * Segment chip is rendered when a value is supplied; falls back gracefully
 * for projects with no segment data.
 */
export function KpiProjectRow({
  projectNo,
  projectName,
  segment,
  vesselName,
  metric,
  metricColor,
  onClose,
}: {
  projectNo: string;
  projectName?: string;
  /** Project segment (e.g. "International"). Rendered as a tinted pill on line 2. */
  segment?: string;
  vesselName?: string;
  /** Right-aligned headline metric (e.g. "$1.2M", "+%8.4", "12 gün"). */
  metric?: string;
  /** Optional metric tint (semantic colour for positive/negative). */
  metricColor?: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const hasSubLine = Boolean(segment) || Boolean(vesselName);
  return (
    <button
      type="button"
      onClick={() => {
        onClose();
        navigate(`/projects/${projectNo}`, {
          state: { focusProjectNo: projectNo },
        });
      }}
      className={cn(
        "w-full grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3",
        "rounded-xl px-3 py-2.5 text-left",
        "hover:bg-foreground/[0.04] transition-colors group"
      )}
    >
      <div className="min-w-0 flex flex-col gap-1">
        {/* Line 1 — projectNo + projectName */}
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span className="font-mono text-[11px] tabular-nums text-foreground/65 shrink-0">
            {projectNo}
          </span>
          {projectName && (
            <span className="text-[12.5px] font-semibold text-foreground truncate leading-tight">
              {projectName}
            </span>
          )}
        </div>
        {/* Line 2 — segment chip + vessel name */}
        {hasSubLine && (
          <div className="flex items-center gap-1.5 min-w-0">
            {segment && <SegmentChip segment={segment} />}
            {vesselName && (
              <span className="text-[10.5px] text-muted-foreground truncate min-w-0">
                <span aria-hidden className="mr-0.5">
                  ⚓
                </span>
                {vesselName}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {metric && (
          <span
            className="text-[12.5px] font-bold tabular-nums"
            style={metricColor ? { color: metricColor } : undefined}
          >
            {metric}
          </span>
        )}
        <ChevronRight className="size-3.5 text-muted-foreground/60 group-hover:text-muted-foreground transition-colors" />
      </div>
    </button>
  );
}

/** Empty-state placeholder for KPI views with no rows. */
export function KpiEmptyState({ message }: { message: string }) {
  return (
    <div className="text-center text-[12px] text-muted-foreground/70 py-8 px-4">
      {message}
    </div>
  );
}
