import * as React from "react";
import {
  CACHE_UPDATED_EVENT,
  readCache,
  type CacheUpdatedDetail,
} from "@/lib/storage/entityCache";
import {
  composeProjects,
  type ComposeWarnings,
} from "@/lib/dataverse/composeProjects";
import type { Project } from "@/lib/dataverse/entities";

const ENTITY_SETS = {
  projects: "mserp_etgtryprojecttableentities",
  /** Sub-project header — voyage legs split out from a parent project.
   *  When present, the composer HIDES the parent and emits one
   *  synthetic Project per sub-project (with the parent's segment /
   *  trader / currency inherited). FK to parent: `mserp_projid`. */
  subProject: "mserp_trysubprojectentities",
  ship: "mserp_tryaiprojectshiprelationentities",
  lines: "mserp_tryaiprojectlineentities",
  /** Synthetic key — NOT a real Dataverse entity set. Holds the
   *  per-(projectNo, expenseType) aggregate from the "Tahmini Gider
   *  Toplamı" refresh step. Replaces the old
   *  `mserp_tryaiotherexpenseentities` raw-row cache (retired after
   *  sub-project union pushed it past the localStorage quota). */
  estimatedExpenseAggregate: "estimatedExpenseAggregateByProject",
  /** Synthetic key — NOT a real Dataverse entity set. Holds the per-project
   *  `$apply=groupby+aggregate(lineamount with sum)` result so KingProjects
   *  ranking and the BudgetVsActual card don't have to fetch raw invoices
   *  for all 320 active projects. */
  salesAggregate: "salesAggregateByProject",
} as const;

export interface UseRealProjectsReturn {
  projects: Project[];
  /** True when the project header cache is missing or empty — empty-state UI cue. */
  isEmpty: boolean;
  fetchedAt: {
    projects: string | null;
    ship: string | null;
    lines: string | null;
    /** Tahmini Gider aggregate cache timestamp (replaces the old raw
     *  expense cache that was retired for quota reasons). */
    estimatedExpense: string | null;
  };
  warnings: ComposeWarnings | null;
}

/**
 * 🔒 Read-only hook: hydrate the 5 cached Dataverse entity arrays from
 * localStorage and run the `composeProjects` derivation.
 *
 * - localStorage is the single source of truth — Data Management page is
 *   the only writer (via `useEntityRows` → `writeCache`).
 * - Re-derives only when the cache fingerprint (raw localStorage value
 *   prefix) changes, so React.useMemo keeps `projects` ref-stable across
 *   unrelated renders.
 * - Cache miss in any of the 4 child entities → degraded compose (no
 *   vesselPlan / lines / costEstimate for affected projects). Only the
 *   `projects` header cache being absent triggers `isEmpty=true`.
 */
/** Module-level memo of the last warning fingerprint we logged so the
 *  console doesn't spam on every re-render — only when the actual list
 *  of unresolved ports changes do we re-log. */
let lastWarningFingerprint = "";

export function useRealProjects(): UseRealProjectsReturn {
  // Cheap fingerprints: first 80 chars of the raw localStorage value.
  // Covers fetchedAt + start of array, enough to detect a real refresh.
  const fpProjects = useCacheFingerprint(ENTITY_SETS.projects);
  const fpSubProject = useCacheFingerprint(ENTITY_SETS.subProject);
  const fpShip = useCacheFingerprint(ENTITY_SETS.ship);
  const fpLines = useCacheFingerprint(ENTITY_SETS.lines);
  const fpExpenseAgg = useCacheFingerprint(
    ENTITY_SETS.estimatedExpenseAggregate
  );
  const fpSalesAgg = useCacheFingerprint(ENTITY_SETS.salesAggregate);

  return React.useMemo<UseRealProjectsReturn>(() => {
    const projC = readCache<Record<string, unknown>>(ENTITY_SETS.projects);
    const subProjC = readCache<Record<string, unknown>>(
      ENTITY_SETS.subProject
    );
    const shipC = readCache<Record<string, unknown>>(ENTITY_SETS.ship);
    const linesC = readCache<Record<string, unknown>>(ENTITY_SETS.lines);
    const expAggC = readCache<Record<string, unknown>>(
      ENTITY_SETS.estimatedExpenseAggregate
    );
    const salesAggC = readCache<Record<string, unknown>>(
      ENTITY_SETS.salesAggregate
    );

    const fetchedAt = {
      projects: projC?.fetchedAt ?? null,
      ship: shipC?.fetchedAt ?? null,
      lines: linesC?.fetchedAt ?? null,
      estimatedExpense: expAggC?.fetchedAt ?? null,
    };

    if (!projC || projC.value.length === 0) {
      return { projects: [], isEmpty: true, fetchedAt, warnings: null };
    }

    const composed = composeProjects({
      projectRows: projC.value,
      shipRows: shipC?.value ?? [],
      lineRows: linesC?.value ?? [],
      expenseAggregateRows: expAggC?.value ?? [],
      salesAggregateRows: salesAggC?.value ?? [],
      // Sub-project rows lift parents to voyage-leg granularity.
      // Missing cache → composer falls back to parent-only output.
      subProjectRows: subProjC?.value ?? [],
    });

    // Surface unresolved ports proactively so they can all be added in
    // one pass, instead of users having to click through each project
    // and report missing-coordinate banners individually. Only logs
    // when the set actually changes (refresh / new data).
    const unresolved = composed.warnings.unresolvedPorts;
    if (unresolved.length > 0) {
      const fp = unresolved.join("|");
      if (fp !== lastWarningFingerprint) {
        lastWarningFingerprint = fp;
        console.warn(
          `[TYRO] ${unresolved.length} port adı portCoordinates.ts'te bulunamadı — eklenmesi gerekiyor:\n  ` +
            unresolved.map((p) => `  • ${p}`).join("\n"),
        );
      }
    }

    return {
      projects: composed.projects,
      isEmpty: false,
      fetchedAt,
      warnings: composed.warnings,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fpProjects, fpSubProject, fpShip, fpLines, fpExpenseAgg, fpSalesAgg]);
}

/**
 * Read a cheap fingerprint from localStorage. Re-runs every render but only
 * triggers downstream re-derivation when the fingerprint actually changes
 * (different fetchedAt or row count).
 */
function useCacheFingerprint(entitySet: string): string {
  const [fp, setFp] = React.useState(() => readFingerprint(entitySet));
  React.useEffect(() => {
    // Cross-tab: native storage event fires when ANOTHER tab writes.
    const storageHandler = (e: StorageEvent) => {
      if (!e.key || e.key === `tyro:dv:${entitySet}`) {
        setFp(readFingerprint(entitySet));
      }
    };
    // Same-tab: writeCache dispatches `tyro:cache-updated` because
    // setItem doesn't trigger the storage event in the writing tab.
    const cacheHandler = (e: Event) => {
      const detail = (e as CustomEvent<CacheUpdatedDetail>).detail;
      if (!detail || detail.entitySet === entitySet) {
        setFp(readFingerprint(entitySet));
      }
    };
    window.addEventListener("storage", storageHandler);
    window.addEventListener(CACHE_UPDATED_EVENT, cacheHandler);
    // Initial reconciliation in case localStorage was written between the
    // useState lazy-init and effect mount (very narrow race).
    const fresh = readFingerprint(entitySet);
    if (fresh !== fp) setFp(fresh);
    return () => {
      window.removeEventListener("storage", storageHandler);
      window.removeEventListener(CACHE_UPDATED_EVENT, cacheHandler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entitySet]);
  return fp;
}

function readFingerprint(entitySet: string): string {
  try {
    const raw = localStorage.getItem(`tyro:dv:${entitySet}`);
    if (!raw) return "";
    return raw.slice(0, 80);
  } catch {
    return "";
  }
}
