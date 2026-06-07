import * as React from "react";
import { Link } from "react-router-dom";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Database01Icon,
  RefreshIcon,
  BoatIcon,
  Briefcase01Icon,
  BadgeDollarSignIcon,
} from "@hugeicons/core-free-icons";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { Button } from "@/components/ui/button";
import { useThemeAccent, type ThemeAccent } from "@/components/layout/theme-accent";
import { useProjects } from "@/hooks/useProjects";
import { useActualExpenseRollup } from "@/hooks/useActualExpenseRollup";
import {
  buildPLCostTree,
  aggregateRootMetrics,
  type ViewMode,
  type PLCostNode,
} from "@/lib/selectors/plCost";
import { selectEstimateTotal } from "@/lib/selectors/project";
import { PLCostTable } from "@/components/pl-cost/PLCostTable";
import { PLCostKpiTiles } from "@/components/pl-cost/PLCostKpiTiles";
import { PLCostProgress } from "@/components/pl-cost/PLCostProgress";
import { PLCostInsightsRibbon } from "@/components/pl-cost/PLCostInsightsRibbon";
import { PLCostDetailPanel } from "@/components/pl-cost/PLCostDetailPanel";
import { PLCostQuickFilters } from "@/components/pl-cost/PLCostQuickFilters";
import { generateSmartInsights } from "@/lib/selectors/plInsights";
import { AdvancedFilter } from "@/components/filters/AdvancedFilter";
import {
  applyProjectFilter,
  makeEmptyFilters,
  type ProjectFilterState,
} from "@/lib/filters/projectFilters";

/**
 * P&L Cost — Tahmini × Gerçekleşen maliyet karşılaştırma raporu.
 *
 * Layout:
 *   - Toolbar: title + view-mode segmented control (Gemi/Proje) +
 *     manual "Yenile" button
 *   - 5 KPI tiles (Toplam Tahmini, Gerçekleşen, %, Δ, En Sapan)
 *   - Hierarchical table: Segment → Voyage → Vessel/Project → Expense
 *
 * Data:
 *   - Project skeleton from `useProjects` (filtered by composer)
 *   - Realised expense rollup from `useActualExpenseRollup`
 *     (lazy auto-fetched on mount, 6h freshness cache)
 */
export function PLCostPage() {
  const accent = useThemeAccent();
  const { projects: rawProjects } = useProjects();
  const rollup = useActualExpenseRollup();
  const [viewMode, setViewMode] = React.useState<ViewMode>("project");
  // Unified filter state (period + categorical multi-selects). Same
  // shape Vessel Projects + Dashboard use, so the AdvancedFilter
  // popover renders identical UI here. Trade Cost-specific defaults:
  //   - period: "all"  — Tahmini × Gerçekleşen comparisons are most
  //     meaningful across the full lifecycle of every project, not
  //     constrained to the current financial year. The user can
  //     narrow with the period chip if they want a focused view.
  //   - includeWithoutShipPlan: true — P&L data lives on the project,
  //     not the voyage, so projects without a vessel plan still
  //     contribute to expense / estimate aggregates.
  const [filters, setFilters] = React.useState<ProjectFilterState>(() =>
    makeEmptyFilters({ includeWithoutShipPlan: true, period: "all" })
  );
  const now = React.useMemo(() => new Date(), []);

  // Apply the unified filter on the domain project list. Tree builds
  // off the filtered subset.
  const projects = React.useMemo(
    () => applyProjectFilter(rawProjects, filters, now),
    [rawProjects, filters, now]
  );
  const totalProjects = projects.length;

  // Projid scope for the rollup = the filtered projects that ALSO have a
  // Tahmini (estimate) value. Two reasons: (1) projects with no forecast
  // are excluded from the report anyway (buildPLCostTree drops them), so
  // fetching their realised expense is wasted work; (2) running the sweep
  // over this subset (a segment ~60 projects) instead of all ~850 is the
  // difference between seconds and minutes.
  const filteredProjids = React.useMemo(
    () =>
      projects
        .filter((p) => selectEstimateTotal(p) > 0)
        .map((p) => p.projectNo)
        .filter(Boolean),
    [projects]
  );
  // Does the cached rollup already cover every filtered project? If yes
  // we render straight from cache; if the filter widened past the last
  // run, fall back to the ComputePrompt so numbers are never partial.
  const coversFilter = React.useMemo(() => {
    if (filteredProjids.length === 0) return false;
    const computed = new Set(rollup.computedProjids);
    return filteredProjids.every((id) => computed.has(id));
  }, [filteredProjids, rollup.computedProjids]);

  // Build the tree only once per (projects × rollup × viewMode) combo.
  const tree = React.useMemo<PLCostNode[]>(() => {
    if (rollup.isEmpty || projects.length === 0) return [];
    return buildPLCostTree(projects, rollup.rows, viewMode);
  }, [projects, rollup.rows, rollup.isEmpty, viewMode]);

  const rootMetrics = React.useMemo(
    () => aggregateRootMetrics(tree),
    [tree]
  );

  // Find the L3 row with the largest |deltaUsd| — this is the
  // "En Sapan" KPI tile. Skip nodes whose expected is 0 (they
  // produce infinite ratios but no real signal).
  const topVariance = React.useMemo(() => {
    let best: { node: PLCostNode } | null = null;
    const walk = (nodes: PLCostNode[]) => {
      for (const n of nodes) {
        if (n.level === 3 && n.metrics.expectedUsd > 0) {
          if (
            !best ||
            Math.abs(n.metrics.deltaUsd) >
              Math.abs(best.node.metrics.deltaUsd)
          ) {
            best = { node: n };
          }
        }
        if (n.children) walk(n.children);
      }
    };
    walk(tree);
    if (!best) return undefined;
    const node: PLCostNode = (best as { node: PLCostNode }).node;
    return {
      label: node.label,
      deltaUsd: node.metrics.deltaUsd,
      realizedExpectedPct: node.metrics.realizedExpectedPct,
    };
  }, [tree]);

  const insights = React.useMemo(() => generateSmartInsights(tree), [tree]);

  // Refresh handler — the TYRO AI progress UI takes over the content
  // area whenever `isFetching` is true, so there's no separate toast
  // to fire here. Errors still surface inline via the ErrorState
  // panel (which already covers the same content slot).
  const handleRefresh = React.useCallback(() => {
    if (rollup.isFetching) return;
    // Scope the sweep to the filtered projects — the page only ever
    // renders this subset, so computing more would be wasted minutes.
    rollup.refresh(filteredProjids);
  }, [rollup, filteredProjids]);

  // Detail panel: selected node id (path) + lookup helper.
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(
    null
  );
  const findNodeById = React.useCallback(
    (nodes: PLCostNode[], id: string): PLCostNode | null => {
      for (const n of nodes) {
        if (n.id === id) return n;
        if (n.children) {
          const found = findNodeById(n.children, id);
          if (found) return found;
        }
      }
      return null;
    },
    []
  );
  const selectedNode = React.useMemo(
    () => (selectedNodeId ? findNodeById(tree, selectedNodeId) : null),
    [selectedNodeId, tree, findNodeById]
  );

  return (
    <div className="h-full flex flex-col gap-3 min-h-0">
      {/* ─── Quick filters + global controls ───
            Toolbar best-practice layout:
              - All interactive controls are 36 px (h-9) tall so bottoms
                line up on a single baseline (items-end).
              - Labelled filter columns on the left form a uniform grid
                of [10.5 px UPPERCASE LABEL] / [h-9 trigger].
              - Right cluster is icon-only by design: action buttons
                don't need top labels because the icon + tooltip pair
                already provides discoverability. This left/right
                asymmetry is the affordance ("data" vs "actions").
              - A subtle vertical divider lives between the two groups,
                spanning only the trigger row (h-9, not the full column
                height) so it doesn't visually overpower the labels.
              - Toolbar wrapper padding (px-4 py-3) gives every control
                breathing room without bloating vertical real estate. */}
      <GlassPanel
        tone="strong"
        className="rounded-2xl shrink-0"
        aria-label="Trade Cost araç çubuğu"
      >
        <div className="px-4 py-3 flex items-end gap-3 flex-wrap">
          <PLCostQuickFilters
            projects={rawProjects}
            filters={filters}
            onChange={setFilters}
          />
          <span
            aria-hidden
            className="h-9 w-px bg-foreground/10 shrink-0 self-end"
          />
          <div
            role="toolbar"
            aria-label="Trade Cost eylem kümesi"
            className="flex items-end gap-2.5 shrink-0"
          >
            <AdvancedFilter
              projects={rawProjects}
              filters={filters}
              onChange={setFilters}
              periodDefault="all"
              tone="ghost"
            />
            <ViewModeToggle
              value={viewMode}
              onChange={setViewMode}
              accent={accent}
            />
            <RefreshButton
              onClick={handleRefresh}
              isFetching={rollup.isFetching}
              accent={accent}
            />
          </div>
        </div>
      </GlassPanel>

      {/* ─── İçerik ─── */}
      {rollup.error ? (
        <ErrorState error={rollup.error} onRetry={rollup.refresh} />
      ) : rollup.isFetching ? (
        // Any in-flight fetch — initial load, post-Veri-Yönetimi
        // invalidation, or manual "Yenile" click — takes over the
        // content area with the TYRO AI progress UI. The user sees
        // the five-step chain in detail instead of staring at stale
        // numbers while the engine rebuilds them.
        <GlassPanel tone="default" className="flex-1 min-h-0 rounded-2xl">
          <PLCostProgress
            stages={rollup.stages}
            totalProjects={totalProjects}
          />
        </GlassPanel>
      ) : rollup.isEmpty || !coversFilter ? (
        // Cache boş (ilk ziyaret / Veri Yönetimi sonrası invalidation)
        // VEYA filtre son hesaplanan kapsamı aşıyor → sade boş durum +
        // "Hesapla" CTA'sı. Tıklayınca rollup SADECE filtrelenmiş
        // projeler için çalışır (isFetching → PLCostProgress devralır),
        // biter bitmez tree render edilir. `hasProjects` master proje
        // cache'inden gelir; veri hiç yüklenmediyse Veri Yönetimi'ne
        // yönlendirir. `stale` = cache dolu ama filtre kapsanmıyor.
        <ComputePrompt
          accentRing={accent.ring}
          accentGradient={accent.gradient}
          hasProjects={rawProjects.length > 0}
          count={filteredProjids.length}
          stale={!rollup.isEmpty && !coversFilter}
          onCompute={handleRefresh}
        />
      ) : (
        <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-hidden">
          <GlassPanel tone="subtle" className="rounded-xl shrink-0">
            <div className="px-3.5 py-2.5">
              <PLCostInsightsRibbon
                insights={insights}
                onSelectNode={setSelectedNodeId}
              />
            </div>
          </GlassPanel>
          <PLCostKpiTiles
            rootMetrics={rootMetrics}
            totalProjects={totalProjects}
            topVariance={topVariance}
          />
          <div className="flex-1 min-h-0 overflow-hidden">
            <PLCostTable
              tree={tree}
              viewMode={viewMode}
              selectedNodeId={selectedNodeId}
              onSelectNode={(node) => setSelectedNodeId(node.id)}
            />
          </div>
          {/* Inline "background refresh" indicator was here, but now
              that any active fetch swaps the content for the full
              progress UI, this branch is only reached when isFetching
              is false — so the indicator never fired. Removed for
              clarity. */}
        </div>
      )}
      {/* Detail side panel — slide-in / dismissible. Lives outside
          the main grid so it overlays the table without affecting
          its layout. */}
      <PLCostDetailPanel
        node={selectedNode}
        onClose={() => setSelectedNodeId(null)}
      />
    </div>
  );
}

/**
 * Görünüm Modu (Proje | Gemi) — segmented round pill, same height as
 * the filter trigger + refresh button. Active half gets the accent
 * gradient + white icon; inactive half stays subtle but legible.
 */
function ViewModeToggle({
  value,
  onChange,
  accent,
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
  accent: ThemeAccent;
}) {
  return (
    <TooltipProvider delayDuration={250}>
      <div
        role="radiogroup"
        aria-label="Görünüm modu"
        // iOS-style segmented control: subtle gray track, active
        // segment pops out as a white pill with a small lift shadow,
        // inactive segment lets the track's gray show through.
        className="inline-flex items-center h-9 rounded-full bg-slate-100 ring-1 ring-slate-200/70 p-1 gap-1"
      >
        <ToggleButton
          active={value === "project"}
          onClick={() => onChange("project")}
          icon={Briefcase01Icon}
          label="Proje"
          tooltip="3. seviyede projeleri grupla"
          accent={accent}
        />
        <ToggleButton
          active={value === "vessel"}
          onClick={() => onChange("vessel")}
          icon={BoatIcon}
          label="Gemi"
          tooltip="3. seviyede gemileri grupla"
          accent={accent}
        />
      </div>
    </TooltipProvider>
  );
}

function ToggleButton({
  active,
  onClick,
  icon,
  label,
  tooltip,
  accent,
}: {
  active: boolean;
  onClick: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any;
  label: string;
  tooltip: string;
  accent: ThemeAccent;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          role="radio"
          onClick={onClick}
          aria-checked={active}
          aria-label={label}
          className="h-7 px-3 rounded-full text-[12.5px] font-semibold inline-flex items-center gap-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent"
          style={{
            // Active = white pill that pops out of the gray track,
            // inactive = transparent so the track shows. Active text
            // gets the accent ink so the brand stays visible without
            // flooding the button in colour.
            background: active ? "white" : "transparent",
            color: active ? accent.solid : "rgba(71, 85, 105, 0.85)",
            boxShadow: active
              ? "0 1px 2px 0 rgba(15,23,42,0.10), 0 2px 6px -2px rgba(15,23,42,0.14), inset 0 1px 0 0 rgba(255,255,255,0.5)"
              : undefined,
            // Theme-driven focus ring so the outline matches sidebar accent
            // regardless of light/navy/black mode.
            ["--tw-ring-color" as never]: accent.ring,
          }}
        >
          <HugeiconsIcon icon={icon} size={15} strokeWidth={2} />
          {label}
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        className="bg-white text-foreground shadow-[0_12px_28px_-8px_rgba(15,23,42,0.24)] ring-1 ring-foreground/10 backdrop-blur-none"
      >
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Refresh control — round, accent-tinted, same dimensions as the
 * filter trigger pill (size-9). Rotating refresh glyph while
 * `isFetching=true` makes it crystal-clear the engine is working;
 * the page-level toast surfaced via `useActualExpenseRollup` is the
 * loud parallel signal so users browsing other tiles still see
 * progress.
 */
function RefreshButton({
  onClick,
  isFetching,
  accent,
}: {
  onClick: () => void;
  isFetching: boolean;
  accent: ThemeAccent;
}) {
  return (
    <TooltipProvider delayDuration={120}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onClick}
            disabled={isFetching}
            aria-label={isFetching ? "Hesaplama sürüyor" : "Yenile"}
            aria-busy={isFetching}
            aria-live="polite"
            className="size-9 rounded-full grid place-items-center shrink-0 shadow-sm transition-all hover:scale-[1.04] active:scale-95 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            style={{
              background: isFetching ? accent.gradient : "white",
              color: isFetching ? "white" : accent.solid,
              boxShadow: isFetching
                ? `0 4px 12px -4px ${accent.ring}, inset 0 1px 0 0 rgba(255,255,255,0.25)`
                : "0 1px 2px 0 rgba(15,23,42,0.08), 0 4px 12px -4px rgba(15,23,42,0.18), inset 0 0 0 1px rgba(15,23,42,0.10)",
              ["--tw-ring-color" as never]: accent.ring,
            }}
          >
            <HugeiconsIcon
              icon={RefreshIcon}
              size={16}
              strokeWidth={2}
              className={isFetching ? "animate-spin" : undefined}
            />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          sideOffset={8}
          className="bg-white shadow-[0_12px_28px_-8px_rgba(15,23,42,0.24)] ring-1 ring-foreground/10 backdrop-blur-none px-3 py-1.5"
        >
          {/* Two-line tooltip: the headline is the verb the user
              cares about ("Yenile"), the sub-line tells them what
              actually happens — verbose enough to feel
              informative on hover without crowding the icon at
              rest. While fetching, the tooltip switches to a
              status read-out. */}
          {isFetching ? (
            <div
              className="text-[11.5px] font-bold uppercase tracking-wider"
              style={{ color: accent.solid }}
            >
              Hesaplama sürüyor…
            </div>
          ) : (
            <>
              <div
                className="text-[11.5px] font-bold uppercase tracking-wider"
                style={{ color: accent.solid }}
              >
                Yenile
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Trade Cost motorunu yeniden çalıştır
              </div>
            </>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ErrorState({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <GlassPanel tone="default" className="flex-1 min-h-0 rounded-2xl">
      <div className="h-full flex items-center justify-center p-8">
        <div className="max-w-md text-center space-y-3">
          <div className="text-rose-700 font-semibold">Hata</div>
          <p className="text-sm text-muted-foreground break-words">{error}</p>
          <Button onClick={onRetry} variant="outline" size="sm">
            Tekrar dene
          </Button>
        </div>
      </div>
    </GlassPanel>
  );
}

/**
 * Trade Cost boş durumu — rollup cache boşken (ilk ziyaret / Veri
 * Yönetimi sonrası invalidation). Kullanıcıya ne hesaplanacağını
 * anlatır + tek bir "Hesapla" CTA'sı sunar. Tıklayınca tenant-wide
 * gerçekleşen-gider sweep'i başlar (~30-60 sn); başlarken sayfa
 * otomatik olarak `PLCostProgress`'e, biterken Tahmini × Gerçekleşen
 * ağacına geçer (isEmpty=false). Sonuç önbelleğe alınır → tekrar
 * açıldığında anında gelir.
 *
 * `hasProjects=false` iken (master proje cache'i hiç dolmamış) Hesapla
 * yerine Veri Yönetimi'ne yönlendirir — çekilecek proje yok.
 */
function ComputePrompt({
  accentRing,
  accentGradient,
  hasProjects,
  count,
  stale,
  onCompute,
}: {
  accentRing: string;
  accentGradient: string;
  hasProjects: boolean;
  /** Number of currently-filtered projects the compute will scope to. */
  count: number;
  /** Cache exists but the current filter widened past it → re-run. */
  stale: boolean;
  onCompute: () => void;
}) {
  // Rough wall-clock hint scaled by scope — a segment is seconds, the
  // whole tenant is minutes. Encourages narrowing the filter.
  const heavy = count > 150;
  return (
    <GlassPanel tone="default" className="flex-1 min-h-0 rounded-2xl">
      <div className="h-full flex items-center justify-center p-8">
        <div className="max-w-lg w-full text-center space-y-5">
          {/* Accent gradient rozet */}
          <div className="inline-flex">
            <span
              className="size-16 rounded-2xl grid place-items-center text-white shadow-lg"
              style={{
                background: accentGradient,
                boxShadow: `0 10px 28px -8px ${accentRing}, inset 0 1px 0 0 rgba(255,255,255,0.30)`,
              }}
            >
              <HugeiconsIcon
                icon={BadgeDollarSignIcon}
                size={28}
                strokeWidth={1.75}
              />
            </span>
          </div>

          {/* Headline + açıklama */}
          <div className="space-y-2">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Tahmini × Gerçekleşen Maliyet
            </h2>
            <p className="text-[13.5px] text-muted-foreground leading-relaxed max-w-md mx-auto">
              {stale ? (
                <>
                  Filtre değişti — yeni kapsam için yeniden hesapla. Hesapla,
                  yalnızca{" "}
                  <span className="font-semibold text-foreground">
                    filtrelenmiş {count} proje
                  </span>{" "}
                  için gerçekleşen masrafları çeker.
                </>
              ) : (
                <>
                  Her segment için{" "}
                  <span className="font-semibold text-foreground">
                    Tahmini Gider
                  </span>{" "}
                  ve{" "}
                  <span className="font-semibold text-foreground">
                    Gerçekleşen Gider
                  </span>{" "}
                  karşılaştırması. Hesapla, yalnızca{" "}
                  <span className="font-semibold text-foreground">
                    filtrelenmiş {count} proje
                  </span>{" "}
                  için çalışır; sonuç önbelleğe alınır.
                </>
              )}
            </p>
          </div>

          {hasProjects ? (
            <button
              type="button"
              onClick={onCompute}
              className="inline-flex items-center gap-2 h-11 px-6 rounded-full text-white font-semibold text-[14px] shadow-md transition-transform hover:scale-[1.03] active:scale-95"
              style={{
                background: accentGradient,
                boxShadow: `0 6px 18px -6px ${accentRing}, inset 0 1px 0 0 rgba(255,255,255,0.25)`,
              }}
            >
              <HugeiconsIcon icon={RefreshIcon} size={17} strokeWidth={2} />
              Hesapla ({count})
            </button>
          ) : (
            <div className="text-[13px] text-muted-foreground/90 pt-1">
              Henüz proje verisi yüklenmedi.{" "}
              <Link
                to="/data"
                className="font-semibold text-foreground hover:underline inline-flex items-center gap-1"
              >
                <HugeiconsIcon icon={Database01Icon} size={13} strokeWidth={2} />
                Veri Yönetimi'ne git
              </Link>
            </div>
          )}

          {/* Hız ipucu — geniş kapsam yavaş; segment seçimi saniyeler. */}
          {hasProjects && heavy && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-700 text-[12px] font-medium">
              <span className="size-1.5 rounded-full bg-amber-500" />
              {count} proje uzun sürebilir — üstten bir segment seçerek
              saniyelere indirebilirsin.
            </div>
          )}

          {/* Ne göreceğini anlatan ince alt-satır */}
          <p className="text-[11.5px] text-muted-foreground/70 leading-relaxed">
            Segment → Voyage Status → Proje/Gemi → Masraf kalemi
            hiyerarşisi, sapma metrikleri ve drill-down paneli ile.
          </p>
        </div>
      </div>
    </GlassPanel>
  );
}

