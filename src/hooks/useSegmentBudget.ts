import * as React from "react";
import { getDataverseClient } from "@/lib/dataverse";
import { readCache, writeCache } from "@/lib/storage/entityCache";
import { BUDGET_COLUMNS } from "@/lib/dataverse/columnOrder";

const ENTITY_SET = "mserp_tryaiprojectbudgetlineentities";

export interface UseSegmentBudgetReturn {
  /** Budget rows for the requested segment. */
  rows: Record<string, unknown>[];
  /** True while a fresh fetch is in flight. */
  isFetching: boolean;
  /** ISO timestamp of the most recent fetch (or null on first mount). */
  fetchedAt: string | null;
  /** Network / parse error message surfaced to the UI, if any. */
  error: string | null;
}

/**
 * 🔒 Read-only — fetch segment-budget rows for ONE segment on demand.
 *
 * Why this exists: the master `tyro:dv:mserp_tryaiprojectbudgetlineentities`
 * cache was retired. The entity is tenant-wide (every segment × year ×
 * month combination, hundreds of rows) but the only active consumer
 * (Veri Yönetimi → "Tahmini Bütçe (Segment)" tab) ever shows the
 * SELECTED project's segment subset. Fetch only what we render.
 *
 * Behaviour:
 *   - Triggers a fresh `listAll` server-side filter every time the
 *     `segment` argument changes; cancels in-flight when it changes
 *     again.
 *   - Stores results into the shared
 *     `tyro:dv:mserp_tryaiprojectbudgetlineentities` cache slot so
 *     repeated visits to the same segment within a session are
 *     instant. Defensive client-side filter on `mserp_segment`.
 *   - When `segment` is null / empty → returns `[]` without firing.
 */
export function useSegmentBudget(
  segment: string | null | undefined
): UseSegmentBudgetReturn {
  const [isFetching, setIsFetching] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshTick, setRefreshTick] = React.useState(0);

  React.useEffect(() => {
    if (!segment) return;
    let cancelled = false;
    setIsFetching(true);
    setError(null);
    (async () => {
      try {
        const client = getDataverseClient();
        // Escape single quotes in segment names — Dataverse OData uses
        // doubled `''` to literalise apostrophes inside string literals.
        const escaped = segment.replace(/'/g, "''");
        const result = await client.listAll<Record<string, unknown>>(
          ENTITY_SET,
          {
            $filter: `mserp_segment eq '${escaped}'`,
            $select: BUDGET_COLUMNS.join(","),
            $count: true,
          }
        );
        if (cancelled) return;
        writeCache(ENTITY_SET, {
          fetchedAt: new Date().toISOString(),
          value: result.value,
          totalCount: result.totalCount,
        });
        setRefreshTick((n) => n + 1);
      } catch (err) {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.warn(
          `[useSegmentBudget] fetch failed for segment "${segment}":`,
          err
        );
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setIsFetching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [segment]);

  return React.useMemo(() => {
    const cached = readCache<Record<string, unknown>>(ENTITY_SET);
    const all = cached?.value ?? [];
    if (!segment) {
      return {
        rows: [],
        isFetching,
        fetchedAt: cached?.fetchedAt ?? null,
        error,
      };
    }
    const segmentRows = all.filter((r) => r["mserp_segment"] === segment);
    return {
      rows: segmentRows,
      isFetching,
      fetchedAt: cached?.fetchedAt ?? null,
      error,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segment, isFetching, error, refreshTick]);
}
