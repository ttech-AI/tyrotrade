import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Cancel01Icon,
  Search01Icon,
  Sorting01Icon,
  Sorting02Icon,
} from "@hugeicons/core-free-icons";
import { useThemeAccent } from "@/components/layout/theme-accent";
import { useT } from "@/lib/i18n/LanguageProvider";
import { cn } from "@/lib/utils";

/* ─────────── Sort spec ─────────── */

export interface KpiSortSpec {
  /** Currently-applied sort direction. */
  value: "default" | "reverse";
  /** Toggle between default ↔ reverse. */
  onChange: (next: "default" | "reverse") => void;
  /** Tooltip text shown when sort is on its **default** orientation. */
  defaultLabel: string;
  /** Tooltip text shown when sort has been **reversed**. */
  reverseLabel: string;
}

interface KpiDrawerToolbarProps {
  query: string;
  onQueryChange: (q: string) => void;
  /** Number of rows currently visible after free-text filtering. */
  resultCount: number;
  /** Total project pool feeding the drawer (denominator for the counter). */
  totalCount: number;
  /** Optional sort flip — when omitted, the toggle is hidden. */
  sort?: KpiSortSpec;
  /** Optional inline secondary toggle (e.g. supplier/buyer in CounterpartyBreakdown).
   *  Sits to the left of the search input so the primary control rail stays familiar. */
  segmentSlot?: React.ReactNode;
  /** Placeholder for the search input. */
  placeholder?: string;
  className?: string;
}

/**
 * Sticky search + sort bar that lives at the top of every KPI detail
 * drawer body. Mirrors the rounded-full search dialect from
 * `ProjectList` so the visual language is consistent across the app.
 *
 * The sort button only renders when a `sort` spec is supplied — drawers
 * with deterministic categorical order (Pipeline, Currency) opt out.
 */
export function KpiDrawerToolbar({
  query,
  onQueryChange,
  resultCount,
  totalCount,
  sort,
  segmentSlot,
  placeholder,
  className,
}: KpiDrawerToolbarProps) {
  const accent = useThemeAccent();
  const t = useT();
  const isReversed = sort?.value === "reverse";
  const resolvedPlaceholder = placeholder ?? t("dash.toolbar.searchPlaceholder");
  return (
    <div
      className={cn(
        "shrink-0 z-10 sticky top-0",
        "px-3 py-2.5 border-b border-border/40",
        "bg-white/85 backdrop-blur-xl backdrop-saturate-150",
        className
      )}
    >
      <div className="flex items-center gap-2">
        {segmentSlot}

        {/* Search */}
        <div className="relative flex-1 min-w-0">
          <HugeiconsIcon
            icon={Search01Icon}
            size={14}
            strokeWidth={2.25}
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-[1]"
            style={{ color: accent.solid }}
          />
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={resolvedPlaceholder}
            aria-label={t("dash.toolbar.searchAria")}
            className={cn(
              "w-full h-8 pl-8 pr-7 rounded-full text-[12.5px] outline-none",
              "bg-white/70",
              "ring-1 ring-foreground/15 hover:ring-foreground/30 focus:ring-2 focus:ring-ring",
              "placeholder:text-muted-foreground/70 transition-shadow"
            )}
            style={{
              boxShadow:
                "inset 0 1px 0 0 rgba(255,255,255,0.85), 0 2px 6px -3px rgba(15,23,42,0.16)",
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => onQueryChange("")}
              aria-label={t("dash.toolbar.clearSearch")}
              className="absolute right-2 top-1/2 -translate-y-1/2 size-5 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06] z-[1]"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={11} strokeWidth={2.5} />
            </button>
          )}
        </div>

        {/* Sort flip */}
        {sort && (
          <button
            type="button"
            onClick={() =>
              sort.onChange(isReversed ? "default" : "reverse")
            }
            aria-label={isReversed ? sort.defaultLabel : sort.reverseLabel}
            title={isReversed ? sort.reverseLabel : sort.defaultLabel}
            className={cn(
              "size-8 rounded-xl grid place-items-center shrink-0 transition-all",
              "hover:scale-[1.04] active:scale-95",
              isReversed
                ? "text-white shadow-sm"
                : "text-foreground/75 bg-foreground/[0.04] hover:bg-foreground/[0.08] border border-foreground/10"
            )}
            style={
              isReversed
                ? {
                    background: accent.gradient,
                    boxShadow: `0 4px 12px -4px ${accent.ring}, inset 0 1px 0 0 rgba(255,255,255,0.25)`,
                  }
                : undefined
            }
          >
            <HugeiconsIcon
              icon={isReversed ? Sorting02Icon : Sorting01Icon}
              size={14}
              strokeWidth={2}
            />
          </button>
        )}
      </div>

      {/* Counter row */}
      <div className="flex items-center justify-between mt-1.5 px-1">
        <span className="text-[10.5px] text-muted-foreground/85 truncate">
          {sort
            ? isReversed
              ? sort.reverseLabel
              : sort.defaultLabel
            : t("dash.toolbar.naturalOrder")}
        </span>
        <span className="text-[10.5px] tabular-nums font-semibold text-foreground/75 shrink-0">
          <span className="text-foreground">{resultCount}</span>
          <span className="text-muted-foreground/70"> / {totalCount}</span>
        </span>
      </div>
    </div>
  );
}
