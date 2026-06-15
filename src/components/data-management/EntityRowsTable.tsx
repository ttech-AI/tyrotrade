import * as React from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useThemeAccent } from "@/components/layout/theme-accent";
import {
  getFormattedValue,
  isFormattedValueKey,
} from "@/lib/dataverse/formatted";
import { reorderColumns } from "@/lib/dataverse/columnOrder";
import { getFieldLabel } from "@/lib/dataverse/fieldLabels";
import { useT } from "@/lib/i18n/LanguageProvider";

export interface SortState {
  field: string;
  direction: "asc" | "desc";
}

interface EntityRowsTableProps<T extends Record<string, unknown>> {
  rows: T[];
  /** Field names rendered as columns. If undefined, auto-discovered from data. */
  columns?: string[];
  /** Optional best-practice ordering hint — listed fields go first when
   *  auto-discovering columns; the rest follow in discovery order. */
  priorityColumns?: readonly string[];
  /** Click handler when a row is clicked */
  onRowClick?: (row: T, index: number) => void;
  /** Currently selected row index (for highlight) */
  selectedIndex?: number | null;
  /** Empty state text */
  emptyText?: string;
  /** Max height before vertical scroll */
  maxHeight?: string;
  /** Active sort (controlled). When set, header click toggles `direction`. */
  sort?: SortState | null;
  /** Sort change handler — when omitted, headers are not clickable. */
  onSortChange?: (next: SortState) => void;
  className?: string;
}

/**
 * Generic Dataverse rows table.
 *
 * - Auto-discovers columns from first 50 rows when `columns` is undefined.
 * - Renders the human-readable `FormattedValue` annotation when present
 *   (option sets, lookups, dates) alongside the raw code.
 * - Horizontal scroll for wide schemas — table sized via `min-w-max`.
 * - Sortable columns when `sort` + `onSortChange` are provided. Click a header
 *   to toggle `asc`/`desc` (or set if not yet active).
 *
 * Vertical-scroll-only (no virtualization yet — fine up to a few thousand rows).
 */
export function EntityRowsTable<T extends Record<string, unknown>>({
  rows,
  columns,
  priorityColumns,
  onRowClick,
  selectedIndex,
  emptyText,
  maxHeight = "60vh",
  sort,
  onSortChange,
  className,
}: EntityRowsTableProps<T>) {
  const t = useT();
  const accent = useThemeAccent();
  // Fall back to the localized "No data" when the caller doesn't pass
  // an explicit empty-state string.
  const resolvedEmptyText = emptyText ?? t("dm.empty.default");

  const cols = React.useMemo(() => {
    if (columns && columns.length > 0) return columns;
    if (rows.length === 0) return [];

    // Single pass over ALL rows: collect only fields that have at least one
    // non-empty value (not null / not undefined / not "") across the dataset.
    // Universally-empty columns are hidden entirely so the table stays focused
    // on real data — no clutter from optional fields nobody filled in.
    // 0 and false are treated as valid values (don't drop them).
    const useful = new Set<string>();
    for (const row of rows) {
      for (const [k, v] of Object.entries(row)) {
        if (k.startsWith("@") || isFormattedValueKey(k)) continue;
        if (useful.has(k)) continue;
        if (v !== null && v !== undefined && v !== "") {
          useful.add(k);
        }
      }
    }
    const arr = [...useful];
    return priorityColumns ? reorderColumns(arr, priorityColumns) : arr;
  }, [columns, rows, priorityColumns]);

  if (rows.length === 0) {
    return (
      <div
        className={cn(
          "grid place-items-center text-sm text-muted-foreground py-8 px-4",
          className
        )}
      >
        {resolvedEmptyText}
      </div>
    );
  }

  const isSortable = !!onSortChange;
  function handleSort(field: string) {
    if (!onSortChange) return;
    if (sort?.field === field) {
      onSortChange({ field, direction: sort.direction === "asc" ? "desc" : "asc" });
    } else {
      onSortChange({ field, direction: "desc" });
    }
  }

  return (
    <div
      // `min-w-0 max-w-full` is mandatory for horizontal scroll containment:
      // without these, `min-w-max` on the inner <table> propagates up through
      // flex parents (GlassPanel inner) and pushes the page wider than viewport.
      className={cn(
        "relative overflow-auto min-w-0 max-w-full",
        className
      )}
      style={{ maxHeight }}
    >
      {/* Inspector table — Inter sans throughout (was font-mono before;
       *  mono made prose values ("Commenced", "Açık", invoice notes)
       *  harder to read than necessary). `tabular-nums` keeps number
       *  columns aligned without forcing mono. Mono kept only on
       *  explicit code-like values (F&O field names in tooltips). */}
      <table className="min-w-max border-collapse text-[13px] tabular-nums">
        <thead className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm">
          <tr>
            <th className="px-2.5 py-2 text-left text-[11px] text-muted-foreground font-semibold border-b border-foreground/[0.08] w-10">
              #
            </th>
            {cols.map((c) => {
              const active = sort?.field === c;
              const label = getFieldLabel(c);
              return (
                <th
                  key={c}
                  onClick={isSortable ? () => handleSort(c) : undefined}
                  // System name as tooltip — keeps the schema discoverable
                  // while the visible header reads in Turkish.
                  title={c}
                  className={cn(
                    "px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.04em] border-b border-foreground/[0.08] whitespace-nowrap select-none",
                    isSortable && "cursor-pointer hover:bg-foreground/[0.04]",
                    active ? "text-foreground" : "text-muted-foreground"
                  )}
                  style={
                    active
                      ? { color: accent.solid, backgroundColor: accent.tint }
                      : undefined
                  }
                >
                  <span className="inline-flex items-center gap-1">
                    {label}
                    {isSortable &&
                      (active ? (
                        sort.direction === "asc" ? (
                          <ChevronUp className="size-3" />
                        ) : (
                          <ChevronDown className="size-3" />
                        )
                      ) : (
                        <ChevronsUpDown className="size-3 opacity-30" />
                      ))}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const selected = selectedIndex === i;
            return (
              <tr
                key={i}
                onClick={() => onRowClick?.(row, i)}
                className={cn(
                  "border-b border-foreground/[0.04] transition-colors",
                  onRowClick && "cursor-pointer",
                  onRowClick && !selected && "hover:bg-foreground/[0.04]"
                )}
                style={
                  selected
                    ? {
                        backgroundColor: accent.tint,
                        boxShadow: `inset 3px 0 0 0 ${accent.solid}`,
                      }
                    : undefined
                }
              >
                <td className="px-2.5 py-2 tabular-nums text-muted-foreground/60 w-10 sticky left-0 bg-inherit">
                  {i + 1}
                </td>
                {cols.map((c) => {
                  const rawFormatted = getFormattedValue(row, c);
                  // F&O option-set FormattedValue often renders unset
                  // values as "(0 - Null)" or similar sentinels. Treat
                  // them as empty so the cell shows nothing rather
                  // than parading a "Null" placeholder.
                  const formatted = isNullSentinel(rawFormatted)
                    ? undefined
                    : rawFormatted;
                  return (
                    <td
                      key={c}
                      className="px-2.5 py-2 max-w-[320px] truncate whitespace-nowrap"
                      title={
                        formatted
                          ? `${formatted} (${formatCellTitle(row[c])})`
                          : formatCellTitle(row[c])
                      }
                    >
                      {formatted ? (
                        // FormattedValue is human-readable on its own
                        // (e.g. "Commenced", "1/4/2022"). Drop the raw
                        // grey subtitle so the cell stays clean — option-
                        // set integers like 200000003 are noise.
                        <span className="font-sans font-medium">
                          {formatted}
                        </span>
                      ) : (
                        formatCell(row[c])
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  // ISO dates (datetime "2026-04-25T…" OR date-only "2026-04-25")
  // → dd.MM.yyyy Turkish convention. Matches the `formatDate` helper
  // used elsewhere so the inspector reads the same as the right-panel.
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}(T|$)/.test(v)) {
    const [y, m, d] = v.slice(0, 10).split("-");
    return `${d}.${m}.${y}`;
  }
  if (typeof v === "string" && isNullSentinel(v)) return "";
  // F&O option-set codes — 9-digit integers in the 100M–1B range.
  // When they appear without a `FormattedValue` annotation it means
  // the column carries a numeric enum code with no human-readable
  // label set in F&O (e.g. "İşlem Yönü" defaulting to 200000000).
  // Render those as empty strings instead of parading the raw code.
  if (
    typeof v === "number" &&
    Number.isInteger(v) &&
    v >= 100_000_000 &&
    v < 1_000_000_000
  ) {
    return "";
  }
  if (typeof v === "string" && /^[12]\d{8}$/.test(v)) {
    return "";
  }
  return String(v);
}

/** True when the FormattedValue / raw string is one of F&O's "no
 *  value" sentinels — option-sets often surface these instead of an
 *  honest null when nothing is selected. */
function isNullSentinel(v: string | undefined | null): boolean {
  if (!v) return false;
  const s = v.trim().toLowerCase();
  return (
    s === "" ||
    s === "0" ||
    s === "null" ||
    s === "(0 - null)" ||
    s === "0 - null" ||
    s === "—" ||
    s === "-"
  );
}

function formatCellTitle(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/* ─────────── Sorting helper ─────────── */

/**
 * Apply a SortState to a row array. Pure — returns a new sorted array,
 * doesn't mutate input. ISO date strings, numbers, and free strings sort
 * naturally; nulls go to the end regardless of direction.
 */
export function sortRows<T extends Record<string, unknown>>(
  rows: T[],
  sort: SortState | null | undefined
): T[] {
  if (!sort) return rows;
  const { field, direction } = sort;
  const dir = direction === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const av = a[field];
    const bv = b[field];
    if (av === bv) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "number" && typeof bv === "number") {
      return (av - bv) * dir;
    }
    return String(av).localeCompare(String(bv), "tr") * dir;
  });
}
