import * as React from "react";
import { getDataverseClient, shouldUseMock } from "@/lib/dataverse";
import {
  CACHE_UPDATED_EVENT,
  readCache,
  writeCache,
  type CacheUpdatedDetail,
} from "@/lib/storage/entityCache";
import {
  fetchFreightPriceRows,
  FREIGHT_PRICE_ROWS_CACHE,
  type FreightFetchProgress,
  type FreightRow,
} from "@/lib/dataverse/freightPrices";

/**
 * 🔒 Read-only hook for the joined indicative-freight-price rows.
 *
 * Same cache-fingerprint pattern as `useRealProjects` / `useActualExpenseRollup`:
 * reads the synthetic `tyro:dv:freightPriceRows` slot, listens for same-tab
 * `tyro:cache-updated` + cross-tab `storage` events, and re-derives only when
 * the 80-char fingerprint changes.
 *
 * Unlike the Trade Cost rollup (a 30-60s pipeline → manual-only), the freight
 * fetch is light (2 `listAll` calls + an in-memory join), so we **auto-fetch
 * on first visit when the cache is empty**. Returning visits render instantly
 * from cache; the page's "Yenile" button re-runs `refetch()`.
 *
 * Real-Dataverse only: in mock mode there are no freight entities, so we never
 * fetch and expose `isMock` for the page to show a "needs live data" state.
 */
export interface UseFreightPricesReturn {
  rows: FreightRow[];
  /** ISO timestamp of the last successful fetch, or null. */
  fetchedAt: string | null;
  /** True when the cache is empty (first visit / cleared). */
  isEmpty: boolean;
  isFetching: boolean;
  error: string | null;
  /** Live per-stage fetch progress (headers → details → join), or null. */
  progress: FreightFetchProgress | null;
  /** True in mock/offline mode — page shows a real-only empty state. */
  isMock: boolean;
  /** Manually re-run the fetch (the page's "Yenile" button). */
  refetch: () => void;
}

export function useFreightPrices(): UseFreightPricesReturn {
  const isMock = shouldUseMock();
  const fingerprint = useCacheFingerprint(FREIGHT_PRICE_ROWS_CACHE);
  const [isFetching, setIsFetching] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [progress, setProgress] =
    React.useState<FreightFetchProgress | null>(null);

  const snapshot = React.useMemo(() => {
    const cached = readCache<FreightRow>(FREIGHT_PRICE_ROWS_CACHE);
    return { rows: cached?.value ?? [], fetchedAt: cached?.fetchedAt ?? null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint]);

  const runFetch = React.useCallback(async () => {
    if (isMock) {
      setError(
        "Bu sayfa canlı Dataverse verisi gerektirir — mock modda navlun verisi yok."
      );
      return;
    }
    setIsFetching(true);
    setError(null);
    setProgress(null);
    try {
      const client = getDataverseClient();
      const rows = await fetchFreightPriceRows(client, (p) => setProgress(p));
      writeCache<FreightRow>(FREIGHT_PRICE_ROWS_CACHE, {
        fetchedAt: new Date().toISOString(),
        value: rows,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[useFreightPrices] fetch failed:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsFetching(false);
      setProgress(null);
    }
  }, [isMock]);

  // Auto-fetch on first visit when the cache is empty (real mode only).
  // Fires once per mount; returning visits with a populated cache skip it.
  const autoTried = React.useRef(false);
  React.useEffect(() => {
    if (autoTried.current || isMock) return;
    const cached = readCache<FreightRow>(FREIGHT_PRICE_ROWS_CACHE);
    if (cached && cached.value.length > 0) return;
    autoTried.current = true;
    void runFetch();
  }, [isMock, runFetch]);

  return {
    rows: snapshot.rows,
    fetchedAt: snapshot.fetchedAt,
    isEmpty: snapshot.rows.length === 0,
    isFetching,
    error,
    progress,
    isMock,
    refetch: () => {
      void runFetch();
    },
  };
}

/* ─────────── Cache fingerprint (same pattern as sibling hooks) ─────────── */

function useCacheFingerprint(entitySet: string): string {
  const [fp, setFp] = React.useState(() => readFingerprint(entitySet));
  React.useEffect(() => {
    const storageHandler = (e: StorageEvent) => {
      if (!e.key || e.key === `tyro:dv:${entitySet}`) {
        setFp(readFingerprint(entitySet));
      }
    };
    const cacheHandler = (e: Event) => {
      const detail = (e as CustomEvent<CacheUpdatedDetail>).detail;
      if (!detail || detail.entitySet === entitySet) {
        setFp(readFingerprint(entitySet));
      }
    };
    window.addEventListener("storage", storageHandler);
    window.addEventListener(CACHE_UPDATED_EVENT, cacheHandler);
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
