import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  FilterIcon,
  FilterResetIcon,
} from "@hugeicons/core-free-icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import {
  MultiSelectCombobox,
  type MultiSelectOption,
} from "@/components/ui/multi-select-combobox";
import { useThemeAccent } from "@/components/layout/theme-accent";
import {
  extractAvailableOptions,
  projectFilterCount,
  type ProjectFilterState,
} from "@/lib/filters/projectFilters";
import { PERIODS, type PeriodKey } from "@/lib/dashboard/periods";
import {
  getCurrentFyKey,
  lastNFinancialYears,
} from "@/lib/dashboard/financialPeriod";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/LanguageProvider";
import type { Project } from "@/lib/dataverse/entities";

/** Map a period key to its `filter.period.*` translation key. The
 *  `PERIODS` data module keeps Turkish `label`s for legacy callers;
 *  the filter UI resolves the localized label through this map. */
const PERIOD_LABEL_KEY: Record<PeriodKey, string> = {
  monthly: "filter.period.monthly",
  quarterly: "filter.period.quarterly",
  yearly: "filter.period.yearly",
  fy: "filter.period.fy",
  all: "filter.period.all",
};

interface AdvancedFilterProps {
  /** Source projects — used to extract distinct option values per
   *  combobox section. Pass the unfiltered list. */
  projects: Project[];
  filters: ProjectFilterState;
  onChange: (next: ProjectFilterState) => void;
  /** Per-page default for the includeWithoutShipPlan toggle —
   *  determines what counts as "active filter" for the badge. */
  shipPlanDefault?: boolean;
  /** Per-page default for the period chip — used to decide whether
   *  the current period selection counts toward the active-filter
   *  badge. Trade Cost ships with `"all"` so its default doesn't
   *  show as an active filter; other pages stay on the FY default. */
  periodDefault?: import("@/lib/dashboard/periods").PeriodKey;
  /** Number of projects after filters applied — shown in footer. */
  resultCount?: number;
  /** Total before filters — shown in footer. */
  totalCount?: number;
  /** Render a compact 36×36 icon-only square trigger instead of the
   *  full "Filtre" labelled pill. Used by ProjectList where the
   *  search input + a labelled pill would crowd the panel header. */
  iconOnly?: boolean;
  /** When true, render the dashboard's glassy white-pill variant —
   *  always-open (no collapse animation), 3D-lifted shadow stack,
   *  navy filter icon + "Filtre" wordmark in navy ink. Width is
   *  capped to match TYRO Chat / TYRO AI siblings so the topbar +
   *  dashboard CTAs read as a symmetric set. Mutually exclusive with
   *  `iconOnly`. (Prop name kept for API stability — was previously
   *  a hover-collapse variant that flipped to always-open after the
   *  user asked for size parity with the chat buttons.) */
  collapsible?: boolean;
  /** Trigger paint (only honoured when `collapsible=false`):
   *  - `"accent"` (default) → live sidebar accent gradient (matches AskAi)
   *  - `"muted"` → cool medium-dark slate gradient (theme-neutral, calmer
   *    next to the AI button on the dashboard topbar). Active-count badge
   *    keeps slate ink so it reads against the white pill.
   *  - `"ghost"` → white pill with accent-colored ink and an outer
   *    drop shadow (no fill). Used on Trade Cost where the toolbar
   *    already carries a coloured accent on neighbouring controls
   *    and the filter should read as a quiet companion, not a
   *    second CTA. */
  tone?: "accent" | "muted" | "ghost";
  className?: string;
}

/** Cool light-to-dark slate gradient — used when `tone="muted"`. Same
 *  3-stop sweep dialect as the TYRO AI emerald gradient, but in a
 *  neutral grey palette so the dashboard's filter pill reads as a
 *  calm sibling rather than a competing accent. Slate-400 → slate-500
 *  → slate-800 gives a visible light-to-dark sheen without going
 *  black. Active-count badge stays slate-800 ink. */
const MUTED_TONE = {
  gradient:
    "linear-gradient(135deg, #94a3b8 0%, #64748b 55%, #1e293b 100%)",
  ring: "rgba(30, 41, 59, 0.55)",
  solid: "#1e293b",
};

/**
 * Page-agnostic Advanced Filter popover. One trigger pill matches the
 * AskAi/Filtre topbar dialect (110px min-width, accent gradient,
 * rounded-full); inside, a stack of categorical sections in this
 * order:
 *
 *   1. ShipPlan toggle
 *   2. Sefer Durumu (chip — low cardinality)
 *   3. Durum (chip)
 *   4. Teslimat Koşulu (chip)
 *   5. Segment (combobox)
 *   6. Trader (combobox)
 *   7. Şirket (combobox)
 *   8. Gemi (combobox)
 *   9. Tedarikçi (combobox)
 *  10. Müşteri / Alıcı (combobox)
 *  11. Proje Grubu (combobox)
 *
 * Period + FY are *not* in here — those live in `PeriodFilter` which
 * sits at the top of the page above the bento/list. Keeping them
 * separate means the user can change the period without re-opening
 * the popover.
 */
export function AdvancedFilter({
  projects,
  filters,
  onChange,
  shipPlanDefault = true,
  periodDefault,
  resultCount,
  totalCount,
  iconOnly = false,
  collapsible = false,
  tone = "accent",
  className,
}: AdvancedFilterProps) {
  const t = useT();
  const accent = useThemeAccent();
  const triggerTone = tone === "muted" ? MUTED_TONE : accent;
  const activeCount = projectFilterCount(
    filters,
    shipPlanDefault,
    periodDefault
  );
  const hasFilters = activeCount > 0;
  // Local hover state used by the collapsible variant — mirrors the
  // animation pattern in TyroWmsButton + AskAiButton.
  const [hovered, setHovered] = React.useState(false);

  const options = React.useMemo(
    () => extractAvailableOptions(projects),
    [projects]
  );

  function clearAll() {
    onChange({
      ...filters,
      statuses: new Set(),
      groups: new Set(),
      incoterms: new Set(),
      segments: new Set(),
      voyageStatuses: new Set(),
      traders: new Set(),
      mainTraders: new Set(),
      companies: new Set(),
      suppliers: new Set(),
      buyers: new Set(),
      vessels: new Set(),
      loadingPorts: new Set(),
      dischargePorts: new Set(),
      projectNos: new Set(),
      includeWithoutShipPlan: shipPlanDefault,
    });
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        {iconOnly ? (
          // Compact icon-only trigger — used by ProjectList where the
          // search input is already wide and a labelled pill crowds
          // the panel header. Square 36×36 with corner badge for the
          // active count.
          <button
            type="button"
            aria-label={t("filter.aria")}
            className={cn(
              "size-9 rounded-xl grid place-items-center shrink-0 shadow-sm relative transition-transform",
              "hover:scale-[1.04] active:scale-95",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
              className
            )}
            style={{
              background: triggerTone.gradient,
              color: "white",
              boxShadow: `0 4px 12px -4px ${triggerTone.ring}, inset 0 1px 0 0 rgba(255,255,255,0.25)`,
            }}
          >
            <HugeiconsIcon icon={FilterIcon} size={16} strokeWidth={2} />
            {activeCount > 0 && (
              <span
                className="absolute -top-1 -right-1 size-4 grid place-items-center rounded-full text-[9px] font-bold tabular-nums"
                style={{
                  background: "white",
                  color: triggerTone.solid,
                  boxShadow: `0 0 0 1.5px ${triggerTone.solid}, 0 2px 6px -1px ${triggerTone.ring}`,
                }}
              >
                {activeCount}
              </span>
            )}
          </button>
        ) : collapsible ? (
          // Always-open glassy white pill. Same min-width + height as
          // the TYRO Chat / TYRO AI sibling buttons so the topbar +
          // dashboard CTAs read as a symmetric set.
          //
          // 3D presence comes from a stacked shadow:
          //   - inset top highlight (rgba 1,1,1)         → glass top sheen
          //   - inset bottom shadow (slate 0.04)         → ambient floor
          //   - outer 1px hairline ring                  → button edge
          //   - 1+4+12px layered drops                   → lifted feel
          // Hover bumps the lift by translating up 1px and deepening
          // the outer drops + adding an indigo edge tint for affordance.
          <button
            type="button"
            aria-label={t("filter.aria")}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onFocus={() => setHovered(true)}
            onBlur={() => setHovered(false)}
            className={cn(
              "group relative inline-flex items-center justify-center gap-2 shrink-0",
              "h-9 rounded-full px-3.5 min-w-[110px]",
              "text-[13px] font-semibold tracking-tight",
              "transition-[transform,box-shadow] duration-200 ease-out",
              hovered && "-translate-y-px",
              "active:translate-y-0 active:scale-[0.98]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              className
            )}
            style={{
              // Subtle vertical gradient: white at top, faintly cooler
              // off-white at bottom — simulates light from above so the
              // pill reads as a 3D-lifted disc rather than a flat blob.
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.92) 100%)",
              backdropFilter: "blur(12px) saturate(150%)",
              color: MUTED_TONE.solid,
              boxShadow: hovered
                ? [
                    "inset 0 1px 0 0 rgba(255,255,255,1)",
                    "inset 0 -1px 1px 0 rgba(15,23,42,0.04)",
                    "0 0 0 1px rgba(99,102,241,0.20)",
                    "0 2px 4px 0 rgba(15,23,42,0.08)",
                    "0 10px 24px -6px rgba(15,23,42,0.18)",
                  ].join(", ")
                : [
                    "inset 0 1px 0 0 rgba(255,255,255,1)",
                    "inset 0 -1px 1px 0 rgba(15,23,42,0.04)",
                    "0 0 0 1px rgba(15,23,42,0.07)",
                    "0 1px 2px 0 rgba(15,23,42,0.06)",
                    "0 6px 14px -4px rgba(15,23,42,0.12)",
                  ].join(", "),
            }}
          >
            <HugeiconsIcon
              icon={FilterIcon}
              size={16}
              strokeWidth={2}
              style={{ color: MUTED_TONE.solid }}
            />
            <span>{t("filter.label")}</span>
            {activeCount > 0 && (
              <span
                className="ml-0.5 h-5 min-w-5 px-1.5 inline-flex items-center justify-center rounded-full text-[10.5px] font-bold tabular-nums text-white"
                style={{
                  background: MUTED_TONE.solid,
                  boxShadow: `inset 0 1px 0 0 rgba(255,255,255,0.20), 0 2px 6px -1px ${MUTED_TONE.ring}`,
                }}
              >
                {activeCount}
              </span>
            )}
          </button>
        ) : tone === "ghost" ? (
          // Ghost variant — white pill with accent-tinted ink and a
          // layered outer drop shadow (no fill). Reads as a quiet
          // companion on toolbars that already carry a louder accent
          // element next to it.
          <button
            type="button"
            aria-label={t("filter.aria")}
            className={cn(
              "h-9 rounded-full px-3.5 min-w-[110px] inline-flex items-center justify-center gap-2 shrink-0 relative transition-transform",
              "text-[13px] font-semibold tracking-tight",
              "hover:scale-[1.04] active:scale-95",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
              className
            )}
            style={{
              background: "white",
              color: accent.solid,
              // Same 3-layer outer drop shadow we use on the
              // RefreshButton white state — keeps Filtre + Refresh as
              // visually identical "neutral white pill" siblings.
              boxShadow:
                "0 1px 2px 0 rgba(15,23,42,0.08), 0 4px 12px -4px rgba(15,23,42,0.18), inset 0 0 0 1px rgba(15,23,42,0.10)",
            }}
          >
            <HugeiconsIcon icon={FilterIcon} size={16} strokeWidth={2} />
            <span>{t("filter.label")}</span>
            {activeCount > 0 && (
              <span
                className="ml-0.5 h-5 min-w-5 px-1.5 inline-flex items-center justify-center rounded-full text-[10.5px] font-bold tabular-nums text-white"
                style={{
                  background: accent.solid,
                  boxShadow: `0 2px 6px -1px ${accent.ring}`,
                }}
              >
                {activeCount}
              </span>
            )}
          </button>
        ) : (
          <button
            type="button"
            aria-label={t("filter.aria")}
            className={cn(
              // rounded-full + symmetric px-3.5 + min-w-[110px] mirrors
              // AskAiButton so the topbar pair reads as identical siblings.
              "h-9 rounded-full px-3.5 min-w-[110px] inline-flex items-center justify-center gap-2 shrink-0 shadow-sm relative transition-transform",
              "text-[13px] font-semibold tracking-tight",
              "hover:scale-[1.04] active:scale-95",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
              className
            )}
            style={{
              background: triggerTone.gradient,
              color: "white",
              boxShadow: `0 4px 12px -4px ${triggerTone.ring}, inset 0 1px 0 0 rgba(255,255,255,0.25)`,
            }}
          >
            <HugeiconsIcon icon={FilterIcon} size={16} strokeWidth={2} />
            <span>{t("filter.label")}</span>
            {activeCount > 0 && (
              <span
                className="ml-0.5 h-5 min-w-5 px-1.5 inline-flex items-center justify-center rounded-full text-[10.5px] font-bold tabular-nums"
                style={{
                  background: "white",
                  color: triggerTone.solid,
                  boxShadow: `inset 0 0 0 1.5px ${triggerTone.solid}, 0 2px 6px -1px ${triggerTone.ring}`,
                }}
              >
                {activeCount}
              </span>
            )}
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent
        // ProjectList sits in the left column with the map on its
        // right — opening the popover to the right lets it land over
        // the map rather than the (clipped) viewport edge. Other
        // surfaces (Dashboard, Veri Yönetimi) keep the default
        // bottom-end placement.
        side={iconOnly ? "right" : "bottom"}
        align={iconOnly ? "start" : "end"}
        sideOffset={10}
        collisionPadding={12}
        className={cn(
          "w-[min(22rem,calc(100vw-1rem))] p-0 overflow-hidden flex flex-col",
          "max-h-[min(calc(100vh-120px),620px)]",
          "bg-white/95 backdrop-blur-2xl backdrop-saturate-150",
          "ring-1 ring-white/55",
          "shadow-[0_28px_72px_-16px_rgba(15,23,42,0.45)]"
        )}
        style={
          {
            "--filter-active-bg": accent.tint,
            "--filter-active-fg": accent.solid,
            "--filter-active-border": accent.ring,
          } as React.CSSProperties
        }
      >
        {/* Header — pill always uses the live `triggerTone` so the
            popover opens with the same accent the user just clicked.
            Dashboard, ProjectList, and Veri Yönetimi all default to
            the sidebar accent, so the icon + gradient inside the
            popover match across pages. The collapsible dashboard
            trigger paints its OWN navy stroke on the white shell
            outside; once opened, the popover snaps back to the
            shared accent dialect. */}
        <div className="px-4 py-3 flex items-center gap-3 shrink-0 border-b border-border/40">
          <span
            className="size-9 rounded-xl grid place-items-center shrink-0 text-white shadow-sm"
            style={{
              background: triggerTone.gradient,
              boxShadow: `0 4px 12px -4px ${triggerTone.ring}, inset 0 1px 0 0 rgba(255,255,255,0.25)`,
            }}
          >
            <HugeiconsIcon
              icon={FilterIcon}
              size={16}
              strokeWidth={2}
            />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold tracking-tight leading-tight">
              {t("filter.title")}
            </div>
            <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">
              {hasFilters
                ? t("filter.activeCount").replace("{count}", String(activeCount))
                : t("filter.multiSelectSearch")}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 flex flex-col gap-3">
          {/* Dönem (period + financial year) — first section so it sets
              the time scope before the user dives into categorical
              filters. */}
          <PeriodSection
            period={filters.period}
            fyKey={filters.fyKey}
            onChange={(period, fyKey) =>
              onChange({ ...filters, period, fyKey })
            }
          />

          {/* Ship-plan inclusion toggle REMOVED — `includeWithoutShipPlan`
              is hard-locked to `true` at every page's `makeEmptyFilters`
              call so projects without vessel plans (Karayolu, exception
              IDs like ORGANIK01, etc.) always pass through. The field
              stays on `ProjectFilterState` for backwards compat but the
              user never toggles it. */}

          {/* Section order (user-specified):
                1. Segment
                2. Sefer Durumu
                3. Ana Trader + Trader
                4. Kalkış Limanı + Varış Limanı
                5. Durum + Teslimat Koşulu
                6. Şirket / Gemi / Tedarikçi / Müşteri / Proje Grubu
                7. Proje No (still the catchall fuzzy search at the end)
              All sections render as a search-multiselect combobox now
              — previously Sefer Durumu / Durum / Teslimat Koşulu were
              chip toggles which became impractical once the user wanted
              quick filter via typing instead of clicking through chips. */}

          {/* 1. Segment */}
          {options.segments.length > 0 && (
            <ComboboxSection
              title={t("filter.segment")}
              count={filters.segments.size}
              options={options.segments}
              selected={filters.segments}
              onChange={(next) => onChange({ ...filters, segments: next })}
              placeholder={t("filter.segment.placeholder")}
              accent={accent}
            />
          )}

          {/* 2. Sefer Durumu — converted from chip toggle to combobox */}
          {options.voyageStatuses.length > 0 && (
            <ComboboxSection
              title={t("filter.voyageStatus")}
              count={filters.voyageStatuses.size}
              options={options.voyageStatuses}
              selected={filters.voyageStatuses}
              onChange={(next) =>
                onChange({ ...filters, voyageStatuses: next })
              }
              placeholder={t("filter.voyageStatus.placeholder")}
              accent={accent}
            />
          )}

          {/* 3a. Ana Trader (lead/desk owner — `mserp_maintraderid`) */}
          {options.mainTraders.length > 0 && (
            <ComboboxSection
              title={t("filter.mainTrader")}
              count={filters.mainTraders.size}
              options={options.mainTraders}
              selected={filters.mainTraders}
              onChange={(next) => onChange({ ...filters, mainTraders: next })}
              placeholder={t("filter.mainTrader.placeholder")}
              accent={accent}
            />
          )}

          {/* 3b. Trader (per-project executor — `mserp_traderid`) */}
          {options.traders.length > 0 && (
            <ComboboxSection
              title={t("filter.trader")}
              count={filters.traders.size}
              options={options.traders}
              selected={filters.traders}
              onChange={(next) => onChange({ ...filters, traders: next })}
              placeholder={t("filter.trader.placeholder")}
              accent={accent}
            />
          )}

          {/* 4a. Kalkış Limanı — combobox */}
          {options.loadingPorts.length > 0 && (
            <ComboboxSection
              title={t("filter.loadingPort")}
              count={filters.loadingPorts.size}
              options={options.loadingPorts}
              selected={filters.loadingPorts}
              onChange={(next) => onChange({ ...filters, loadingPorts: next })}
              placeholder={t("filter.loadingPort.placeholder")}
              searchPlaceholder={t("filter.port.search")}
              accent={accent}
            />
          )}

          {/* 4b. Varış Limanı — combobox */}
          {options.dischargePorts.length > 0 && (
            <ComboboxSection
              title={t("filter.dischargePort")}
              count={filters.dischargePorts.size}
              options={options.dischargePorts}
              selected={filters.dischargePorts}
              onChange={(next) =>
                onChange({ ...filters, dischargePorts: next })
              }
              placeholder={t("filter.dischargePort.placeholder")}
              searchPlaceholder={t("filter.port.search")}
              accent={accent}
            />
          )}

          {/* 5a. Durum — combobox */}
          {options.statuses.length > 0 && (
            <ComboboxSection
              title={t("filter.status")}
              count={filters.statuses.size}
              options={options.statuses}
              selected={filters.statuses}
              onChange={(next) => onChange({ ...filters, statuses: next })}
              placeholder={t("filter.status.placeholder")}
              accent={accent}
            />
          )}

          {/* 5b. Teslimat Koşulu — combobox */}
          {options.incoterms.length > 0 && (
            <ComboboxSection
              title={t("filter.incoterm")}
              count={filters.incoterms.size}
              options={options.incoterms}
              selected={filters.incoterms}
              onChange={(next) => onChange({ ...filters, incoterms: next })}
              placeholder={t("filter.incoterm.placeholder")}
              accent={accent}
            />
          )}

          {/* 6a. Şirket */}
          {options.companies.length > 0 && (
            <ComboboxSection
              title={t("filter.company")}
              count={filters.companies.size}
              options={options.companies}
              selected={filters.companies}
              onChange={(next) => onChange({ ...filters, companies: next })}
              placeholder={t("filter.company.placeholder")}
              accent={accent}
            />
          )}

          {/* 6b. Gemi */}
          {options.vessels.length > 0 && (
            <ComboboxSection
              title={t("filter.vessel")}
              count={filters.vessels.size}
              options={options.vessels}
              selected={filters.vessels}
              onChange={(next) => onChange({ ...filters, vessels: next })}
              placeholder={t("filter.vessel.placeholder")}
              searchPlaceholder={t("filter.vessel.search")}
              accent={accent}
            />
          )}

          {/* 6c. Tedarikçi */}
          {options.suppliers.length > 0 && (
            <ComboboxSection
              title={t("filter.supplier")}
              count={filters.suppliers.size}
              options={options.suppliers}
              selected={filters.suppliers}
              onChange={(next) => onChange({ ...filters, suppliers: next })}
              placeholder={t("filter.supplier.placeholder")}
              searchPlaceholder={t("filter.supplier.search")}
              accent={accent}
            />
          )}

          {/* 6d. Müşteri / Alıcı */}
          {options.buyers.length > 0 && (
            <ComboboxSection
              title={t("filter.buyer")}
              count={filters.buyers.size}
              options={options.buyers}
              selected={filters.buyers}
              onChange={(next) => onChange({ ...filters, buyers: next })}
              placeholder={t("filter.buyer.placeholder")}
              searchPlaceholder={t("filter.buyer.search")}
              accent={accent}
            />
          )}

          {/* 6e. Proje Grubu */}
          {options.groups.length > 0 && (
            <ComboboxSection
              title={t("filter.group")}
              count={filters.groups.size}
              options={options.groups}
              selected={filters.groups}
              onChange={(next) => onChange({ ...filters, groups: next })}
              placeholder={t("filter.group.placeholder")}
              accent={accent}
            />
          )}

          {/* 7. Proje No — fuzzy combobox over projectNo + name +
              vessel + segment + group keywords. Stays at the bottom
              as the catchall lookup. */}
          {options.projects.length > 0 && (
            <ComboboxSection
              title={t("filter.projectNo")}
              count={filters.projectNos.size}
              options={options.projects}
              selected={filters.projectNos}
              onChange={(next) => onChange({ ...filters, projectNos: next })}
              placeholder={t("filter.projectNo.placeholder")}
              searchPlaceholder={t("filter.projectNo.search")}
              accent={accent}
            />
          )}
        </div>

        {/* Sticky footer */}
        <div className="sticky bottom-0 z-[1] px-4 py-2.5 border-t border-border/50 bg-white/95 backdrop-blur-xl flex items-center justify-between gap-2 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearAll}
            disabled={!hasFilters}
            className={cn(
              "h-8 px-2.5 gap-1.5 text-[11.5px] font-medium rounded-full",
              hasFilters
                ? "text-foreground hover:bg-foreground/[0.06]"
                : "text-muted-foreground/60"
            )}
            style={hasFilters ? { color: accent.solid } : undefined}
          >
            <HugeiconsIcon icon={FilterResetIcon} size={13} strokeWidth={2} />
            {t("filter.clear")}
          </Button>
          {resultCount !== undefined && totalCount !== undefined && (
            <div className="text-[11px] text-muted-foreground text-right">
              {hasFilters ? (
                <>
                  <span
                    className="font-bold tabular-nums"
                    style={{ color: accent.solid }}
                  >
                    {resultCount}
                  </span>
                  {" / "}
                  <span className="tabular-nums">{totalCount}</span>{" "}
                  {t("filter.resultCountSuffix")}
                </>
              ) : (
                <>
                  {t("filter.allLead")}{" "}
                  <span className="font-semibold text-foreground tabular-nums">
                    {totalCount}
                  </span>{" "}
                  {t("filter.allTail")}
                </>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ─────────── Helpers ─────────── */

// `toggleSet` removed — every section now uses MultiSelectCombobox which
// emits the full next Set; we no longer need a per-value toggler.

const CHIP_CLASS = cn(
  "h-7 rounded-full text-[11.5px] px-2.5 font-medium",
  "border-foreground/15 bg-transparent",
  "hover:bg-foreground/[0.04] hover:border-foreground/25",
  "data-[state=on]:bg-[var(--filter-active-bg)]",
  "data-[state=on]:text-[var(--filter-active-fg)]",
  "data-[state=on]:border-[var(--filter-active-border)]",
  "data-[state=on]:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.4)]",
  "data-[state=on]:font-semibold",
  "transition-colors"
);

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    // Darker ink + slightly heavier weight so section labels (Segment,
    // Sefer Durumu, Trader, …) read clearly above each combobox. The
    // previous `text-muted-foreground` (~slate-500) washed out against
    // the popover bg and made the labels feel "system noise".
    <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.12em] text-foreground/80">
      <span>{title}</span>
      {count > 0 && (
        <span
          className="h-[18px] min-w-[18px] inline-flex items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums"
          style={{
            backgroundColor: "var(--filter-active-bg)",
            color: "var(--filter-active-fg)",
          }}
        >
          {count}
        </span>
      )}
    </div>
  );
}

/* PeriodSection — period (Aylık · Çeyreklik · Yıllık · Finansal
 *  Dönem · Tüm Zamanlar) chip group + last-3-FY chip row when "fy"
 *  is active. Lives inside the AdvancedFilter popover so the time
 *  scope and categorical scope are managed in one surface. */
function PeriodSection({
  period,
  fyKey,
  onChange,
}: {
  period: PeriodKey;
  fyKey: string | null;
  onChange: (period: PeriodKey, fyKey: string | null) => void;
}) {
  const t = useT();
  const fyOptions = React.useMemo(() => lastNFinancialYears(new Date(), 3), []);
  const showFyOptions = period === "fy";
  return (
    <div className="flex flex-col gap-1.5">
      <SectionHeader
        title={t("filter.period")}
        count={
          period === "fy" && (fyKey ?? getCurrentFyKey()) === getCurrentFyKey()
            ? 0
            : period !== "fy" || fyKey !== getCurrentFyKey()
              ? 1
              : 0
        }
      />
      <ToggleGroup
        type="single"
        value={period}
        onValueChange={(v) => {
          if (!v) return;
          const next = v as PeriodKey;
          const nextFy = next === "fy" ? fyKey ?? getCurrentFyKey() : null;
          onChange(next, nextFy);
        }}
        variant="outline"
        size="sm"
        spacing={4}
        className="flex-wrap"
      >
        {PERIODS.map((p) => (
          <ToggleGroupItem key={p.key} value={p.key} className={CHIP_CLASS}>
            {t(PERIOD_LABEL_KEY[p.key])}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {showFyOptions && (
        <div className="mt-1.5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-1">
            {t("filter.financialYear")}
          </div>
          <ToggleGroup
            type="single"
            value={fyKey ?? getCurrentFyKey()}
            onValueChange={(v) => {
              if (!v) return;
              onChange("fy", v);
            }}
            variant="outline"
            size="sm"
            spacing={4}
            className="flex-wrap"
          >
            {fyOptions.map((fy) => (
              <ToggleGroupItem
                key={fy.key}
                value={fy.key}
                className={CHIP_CLASS}
              >
                {fy.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      )}
    </div>
  );
}

// `ChipSection` removed — all multi-select sections (Sefer Durumu,
// Durum, Teslimat Koşulu) converted to ComboboxSection with search.
// Chip toggling stayed on the PeriodSection only because period is
// 5 fixed buckets, not an open set.

function ComboboxSection({
  title,
  count,
  options,
  selected,
  onChange,
  placeholder,
  searchPlaceholder,
  accent,
}: {
  title: string;
  count: number;
  options: ReadonlyArray<MultiSelectOption>;
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  accent: { solid: string; ring: string; tint: string };
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <SectionHeader title={title} count={count} />
      <MultiSelectCombobox
        options={options}
        selected={selected}
        onChange={onChange}
        placeholder={placeholder}
        searchPlaceholder={searchPlaceholder}
        accent={accent}
      />
    </div>
  );
}
