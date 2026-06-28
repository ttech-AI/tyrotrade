import * as React from "react";
import {
  CACHE_UPDATED_EVENT,
  cacheFingerprint,
  readCache,
  type CacheUpdatedDetail,
} from "@/lib/storage/entityCache";
import {
  SEGMENT_BUDGET_BY_MONTH_CACHE,
  buildSegmentBudgetMap,
  type SegmentBudgetMonthRow,
} from "@/lib/dataverse/segmentBudget";

/**
 * 🔒 Read-only — segment → (monthKey → net budget USD) map from the
 * `segmentBudgetByMonth` cache (written by the "Bütçe Toplamları" refresh
 * step). Same fingerprint-subscription pattern as `useRealProjects` so it
 * re-derives when a refresh lands. Empty map until the first refresh.
 */
export function useSegmentBudgetMap(): Map<string, Map<string, number>> {
  const [fp, setFp] = React.useState(() =>
    cacheFingerprint(SEGMENT_BUDGET_BY_MONTH_CACHE)
  );
  React.useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === `tyro:dv:${SEGMENT_BUDGET_BY_MONTH_CACHE}`) {
        setFp(cacheFingerprint(SEGMENT_BUDGET_BY_MONTH_CACHE));
      }
    };
    const onCache = (e: Event) => {
      const d = (e as CustomEvent<CacheUpdatedDetail>).detail;
      if (!d || d.entitySet === SEGMENT_BUDGET_BY_MONTH_CACHE) {
        setFp(cacheFingerprint(SEGMENT_BUDGET_BY_MONTH_CACHE));
      }
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(CACHE_UPDATED_EVENT, onCache);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(CACHE_UPDATED_EVENT, onCache);
    };
  }, []);
  return React.useMemo(() => {
    const cached = readCache<SegmentBudgetMonthRow>(
      SEGMENT_BUDGET_BY_MONTH_CACHE
    );
    return buildSegmentBudgetMap(cached?.value ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fp]);
}
