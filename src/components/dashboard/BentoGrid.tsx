import * as React from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { ActivePipelineTile as ActivePipelineTileBase } from "./tiles/ActivePipelineTile";
import { PeriodPerformanceTile as PeriodPerformanceTileBase } from "./tiles/PeriodPerformanceTile";
import { EstimatedPLTile as EstimatedPLTileBase } from "./tiles/EstimatedPLTile";
import { EstimatedQuantityTile as EstimatedQuantityTileBase } from "./tiles/EstimatedQuantityTile";
import { EstimatedExpenseTile as EstimatedExpenseTileBase } from "./tiles/EstimatedExpenseTile";
import { CurrencyExposureTile as CurrencyExposureTileBase } from "./tiles/CurrencyExposureTile";
import { CorridorConcentrationTile as CorridorConcentrationTileBase } from "./tiles/CorridorConcentrationTile";
import { VelocityTile as VelocityTileBase } from "./tiles/VelocityTile";
import { CounterpartyMixTile as CounterpartyMixTileBase } from "./tiles/CounterpartyMixTile";
import type { KpiId } from "./KpiDetailDrawer";
import { useT } from "@/lib/i18n/LanguageProvider";
import type { Project } from "@/lib/dataverse/entities";

// Module-level React.memo wrappers — re-render the tile only when its
// actual props change. All 9 tiles receive `projects` + `now` from
// DashboardPage's memos (stable references) and `handlers.*` from the
// useMemo below (stable when `onSelectKpi` is stable). Without memo
// every filter/state change re-runs the tile's internal aggregations.
const ActivePipelineTile = React.memo(ActivePipelineTileBase);
const PeriodPerformanceTile = React.memo(PeriodPerformanceTileBase);
const EstimatedPLTile = React.memo(EstimatedPLTileBase);
const EstimatedQuantityTile = React.memo(EstimatedQuantityTileBase);
const EstimatedExpenseTile = React.memo(EstimatedExpenseTileBase);
const CurrencyExposureTile = React.memo(CurrencyExposureTileBase);
const CorridorConcentrationTile = React.memo(CorridorConcentrationTileBase);
const VelocityTile = React.memo(VelocityTileBase);
const CounterpartyMixTile = React.memo(CounterpartyMixTileBase);

interface BentoGridProps {
  projects: Project[];
  now?: Date;
  /** Tile click handler — opens the KPI detail drawer. Each tile
   *  fires this with its identifier; DashboardPage uses it to render
   *  the appropriate breakdown view. */
  onSelectKpi?: (id: KpiId) => void;
}

const containerVariants: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.05, delayChildren: 0.05 },
  },
};

/**
 * Executive Bento Grid — premium 9-tile dashboard.
 *
 * Layout (12-col responsive, 3 rows on lg+):
 *
 *   Row 1: [PeriodPerformance HERO 6] [EstimatedPL 3] [EstimatedQuantity 3]
 *   Row 2: [EstimatedExpense 3]       [ActivePipeline 9]
 *   Row 3: [CurrencyExp 3] [Corridor 3] [Velocity 3] [Counterparty 3]
 *
 * Each tile fires `onSelectKpi(id)` on click — the parent renders a
 * `KpiDetailDrawer` with the matching breakdown component.
 */
export function BentoGrid({ projects, now = new Date(), onSelectKpi }: BentoGridProps) {
  const reduceMotion = useReducedMotion();
  const t = useT();

  // Stable click handlers — recreated only when `onSelectKpi` itself
  // changes. Each tile receives the SAME function reference across renders
  // so React.memo on the tile can short-circuit when projects/now haven't
  // changed.
  const handlers = React.useMemo(() => {
    if (!onSelectKpi) return undefined;
    return {
      period: () => onSelectKpi("period"),
      pl: () => onSelectKpi("pl"),
      quantity: () => onSelectKpi("quantity"),
      expense: () => onSelectKpi("expense"),
      pipeline: () => onSelectKpi("pipeline"),
      currency: () => onSelectKpi("currency"),
      corridor: () => onSelectKpi("corridor"),
      velocity: () => onSelectKpi("velocity"),
      counterparty: () => onSelectKpi("counterparty"),
    };
  }, [onSelectKpi]);

  return (
    <motion.section
      variants={reduceMotion ? undefined : containerVariants}
      initial="hidden"
      animate="show"
      className="grid grid-cols-12 auto-rows-min gap-3"
      aria-label={t("dash.grid.aria")}
    >
      {/* Row 1 — Hero + headline P&L + tonnage */}
      <PeriodPerformanceTile
        projects={projects}
        now={now}
        span="col-span-12 sm:col-span-12 lg:col-span-6"
        onClick={handlers?.period}
      />
      <EstimatedPLTile
        projects={projects}
        now={now}
        span="col-span-12 sm:col-span-6 lg:col-span-3"
        onClick={handlers?.pl}
      />
      <EstimatedQuantityTile
        projects={projects}
        now={now}
        span="col-span-12 sm:col-span-6 lg:col-span-3"
        onClick={handlers?.quantity}
      />

      {/* Row 2 — Expense breakdown + pipeline */}
      <EstimatedExpenseTile
        projects={projects}
        span="col-span-12 sm:col-span-6 lg:col-span-3"
        onClick={handlers?.expense}
      />
      <ActivePipelineTile
        projects={projects}
        now={now}
        span="col-span-12 sm:col-span-6 lg:col-span-9"
        onClick={handlers?.pipeline}
      />

      {/* Row 3 — Risk / portfolio composition KPIs */}
      <CurrencyExposureTile
        projects={projects}
        span="col-span-12 sm:col-span-6 lg:col-span-3"
        onClick={handlers?.currency}
      />
      <CorridorConcentrationTile
        projects={projects}
        span="col-span-12 sm:col-span-6 lg:col-span-3"
        onClick={handlers?.corridor}
      />
      <VelocityTile
        projects={projects}
        span="col-span-12 sm:col-span-6 lg:col-span-3"
        onClick={handlers?.velocity}
      />
      <CounterpartyMixTile
        projects={projects}
        span="col-span-12 sm:col-span-6 lg:col-span-3"
        onClick={handlers?.counterparty}
      />
    </motion.section>
  );
}
