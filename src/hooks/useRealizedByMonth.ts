import * as React from "react";
import { getDataverseClient } from "@/lib/dataverse";
import {
  CACHE_UPDATED_EVENT,
  cacheFingerprint,
  readCache,
  writeCache,
  type CacheUpdatedDetail,
} from "@/lib/storage/entityCache";
import {
  fetchRealizedByMonthForProjects,
  indexRealizedByMonth,
  REALIZED_BY_MONTH_CACHE,
  type RealizedByMonthRow,
  type RealizedByMonthMap,
} from "@/lib/dataverse/realizedByMonth";

/** Sibling cache holding the projid SCOPE the monthly aggregate was
 *  computed for — same pattern as the expense rollup so the page can
 *  gate "does this cache cover the filtered set?". */
const REALIZED_BY_MONTH_SCOPE_CACHE = "realizedByMonthScope";

export interface UseRealizedByMonthReturn {
  /** Flat realised (projectNo × month) rows. */
  rows: RealizedByMonthRow[];
  /** projectNo → monthKey → {revenueUsd, qtyTons, purchaseUsd}. */
  byProjectMonth: RealizedByMonthMap;
  /** ProjectNos this cache was last computed for. */
  computedProjids: string[];
  /** ISO timestamp of the most recent successful fetch, or null. */
  fetchedAt: string | null;
  /** True when the cache is missing entirely. */
  isEmpty: boolean;
  /** True while a fetch is in flight. */
  isFetching: boolean;
  /** Last fetch error, if any. */
  error: string | null;
  /** Manually trigger a scoped fetch for the given projids. */
  refresh: (projids: string[]) => void;
}

/**
 * 🔒 Read-only hook — month-resolved realised SALES + PURCHASE for the
 * E.M Bakış "Monthly Projected × Realized P&L" table.
 *
 * Mirrors `useActualExpenseRollup`'s shape (scoped `refresh(projids)`,
 * coverage-aware `computedProjids`, cache fingerprint) so the Dashboard
 * page drives both with the same auto-fetch latch. Buckets realised by
 * INVOICE DATE month (the PBI "Live Realized" axis) instead of the
 * project's single execution month — see `realizedByMonth.ts`.
 */
export function useRealizedByMonth(): UseRealizedByMonthReturn {
  const fingerprint = useCacheFingerprint(REALIZED_BY_MONTH_CACHE);
  const [isFetching, setIsFetching] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const snapshot = React.useMemo(() => {
    const cached = readCache<RealizedByMonthRow>(REALIZED_BY_MONTH_CACHE);
    const scope = readCache<string>(REALIZED_BY_MONTH_SCOPE_CACHE);
    const rows = cached?.value ?? [];
    return {
      rows,
      byProjectMonth: indexRealizedByMonth(rows),
      // Coverage meaningful only when rows exist (same reasoning as the
      // expense rollup: a data refresh clears rows but not scope).
      computedProjids: rows.length > 0 ? scope?.value ?? [] : [],
      fetchedAt: cached?.fetchedAt ?? null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint]);

  const runFetch = React.useCallback(async (projids: string[]) => {
    const scoped = [...new Set(projids.filter(Boolean))];
    if (scoped.length === 0) return;
    setIsFetching(true);
    setError(null);
    try {
      const client = getDataverseClient();
      const { rows, computedProjids } = await fetchRealizedByMonthForProjects(
        client,
        scoped
      );
      const fetchedAt = new Date().toISOString();
      writeCache(REALIZED_BY_MONTH_CACHE, { fetchedAt, value: rows });
      writeCache(REALIZED_BY_MONTH_SCOPE_CACHE, {
        fetchedAt,
        value: computedProjids,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[useRealizedByMonth] fetch failed:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsFetching(false);
    }
  }, []);

  return {
    rows: snapshot.rows,
    byProjectMonth: snapshot.byProjectMonth,
    computedProjids: snapshot.computedProjids,
    fetchedAt: snapshot.fetchedAt,
    isEmpty: snapshot.rows.length === 0,
    isFetching,
    error,
    refresh: (projids: string[]) => {
      void runFetch(projids);
    },
  };
}

/** Fingerprint pattern shared with the other cache-backed hooks. */
function useCacheFingerprint(entitySet: string): string {
  const [fp, setFp] = React.useState(() => cacheFingerprint(entitySet));
  React.useEffect(() => {
    const storageHandler = (e: StorageEvent) => {
      if (!e.key || e.key === `tyro:dv:${entitySet}`) {
        setFp(cacheFingerprint(entitySet));
      }
    };
    const cacheHandler = (e: Event) => {
      const detail = (e as CustomEvent<CacheUpdatedDetail>).detail;
      if (!detail || detail.entitySet === entitySet) {
        setFp(cacheFingerprint(entitySet));
      }
    };
    window.addEventListener("storage", storageHandler);
    window.addEventListener(CACHE_UPDATED_EVENT, cacheHandler);
    const fresh = cacheFingerprint(entitySet);
    if (fresh !== fp) setFp(fresh);
    return () => {
      window.removeEventListener("storage", storageHandler);
      window.removeEventListener(CACHE_UPDATED_EVENT, cacheHandler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entitySet]);
  return fp;
}
