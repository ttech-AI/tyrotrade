import * as React from "react";
import {
  getDataverseClient,
  type DataverseListResponse,
  type ODataQuery,
} from "@/freight/lib/dataverse";
import {
  CACHE_UPDATED_EVENT,
  readCache,
  writeCache,
  type CacheUpdatedDetail,
  type EntityCacheEntry,
} from "@/freight/lib/storage/entityCache";

interface UseEntityRowsArgs {
  entitySet: string;
  query?: ODataQuery;
}

interface EntityRowsState<T> {
  rows: T[];
  totalCount?: number;
  fetchedAt: string | null;
  /** Live-progress count while pagination is in flight. */
  loaded: number | null;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
}

export interface UseEntityRowsReturn<T> extends EntityRowsState<T> {
  /** Manually trigger a fresh fetch (walks all pages, persists to localStorage).
   *  Accepts an optional `queryOverride` — used by the Veri Yönetimi bulk
   *  refresh to pass a project-IDs `In` filter to child entities once the
   *  project list is known. When omitted, falls back to the hook's `query`. */
  refetch: (queryOverride?: ODataQuery) => Promise<void>;
}

/**
 * Manual-trigger read hook for the Data Inspector.
 *
 * - Hydrates initial state from `localStorage` (instant render on revisit)
 * - **Does NOT auto-fetch** — user clicks "Verileri Güncelle" → `refetch()`
 * - On refetch: uses `client.listAll()` to walk all pages (no `$top` cap),
 *   then writes the result to `localStorage` (overwrites prior cache)
 * - Reports `loaded` count during pagination so UI can show progress
 *
 * Custom state instead of TanStack Query because we need (a) manual trigger,
 * (b) localStorage hydration, and (c) progress callbacks during pagination.
 */
export function useEntityRows<T = Record<string, unknown>>({
  entitySet,
  query,
}: UseEntityRowsArgs): UseEntityRowsReturn<T> {
  // Hydrate from localStorage on mount (or when entity changes)
  const [state, setState] = React.useState<EntityRowsState<T>>(() => {
    const cached = readCache<T>(entitySet);
    return {
      rows: cached?.value ?? [],
      totalCount: cached?.totalCount,
      fetchedAt: cached?.fetchedAt ?? null,
      loaded: null,
      isFetching: false,
      isError: false,
      error: null,
    };
  });

  // Re-hydrate when entitySet changes (different tab)
  const lastEntityRef = React.useRef(entitySet);
  React.useEffect(() => {
    if (lastEntityRef.current !== entitySet) {
      lastEntityRef.current = entitySet;
      const cached = readCache<T>(entitySet);
      setState({
        rows: cached?.value ?? [],
        totalCount: cached?.totalCount,
        fetchedAt: cached?.fetchedAt ?? null,
        loaded: null,
        isFetching: false,
        isError: false,
        error: null,
      });
    }
  }, [entitySet]);

  // Cross-cutting cache writes (e.g. the chunked refresh helpers in
  // `refreshAll.ts` invoked from `RefreshAllButton`) bypass `refetch()`
  // entirely — they `writeCache(...)` directly, then dispatch
  // `tyro:cache-updated`. Listen for that event so this hook's state
  // stays in sync without forcing every refresh path to call our own
  // refetch. Only updates when NOT mid-fetch (so an in-flight call's
  // own writeCache dispatch doesn't race with its setState).
  React.useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<CacheUpdatedDetail>).detail;
      if (!detail || detail.entitySet !== entitySet) return;
      const cached = readCache<T>(entitySet);
      if (!cached) return;
      setState((s) => {
        if (s.isFetching) return s; // own refetch will set state
        return {
          ...s,
          rows: cached.value,
          totalCount: cached.totalCount,
          fetchedAt: cached.fetchedAt,
          loaded: cached.value.length,
          isError: false,
          error: null,
        };
      });
    };
    window.addEventListener(CACHE_UPDATED_EVENT, handler);
    return () => window.removeEventListener(CACHE_UPDATED_EVENT, handler);
  }, [entitySet]);

  const refetch = React.useCallback(async (queryOverride?: ODataQuery) => {
    setState((s) => ({
      ...s,
      isFetching: true,
      isError: false,
      error: null,
      loaded: 0,
    }));

    try {
      const client = getDataverseClient();
      const effectiveQuery = queryOverride ?? query;
      const result: DataverseListResponse<T> = await client.listAll<T>(
        entitySet,
        effectiveQuery,
        (loaded) => {
          setState((s) => ({ ...s, loaded }));
        }
      );

      const fetchedAt = new Date().toISOString();
      const entry: EntityCacheEntry<T> = {
        fetchedAt,
        value: result.value,
        totalCount: result.totalCount,
      };
      writeCache(entitySet, entry);

      setState({
        rows: result.value,
        totalCount: result.totalCount,
        fetchedAt,
        loaded: result.value.length,
        isFetching: false,
        isError: false,
        error: null,
      });
    } catch (err) {
      setState((s) => ({
        ...s,
        isFetching: false,
        isError: true,
        error: err instanceof Error ? err : new Error(String(err)),
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entitySet, JSON.stringify(query ?? {})]);

  return { ...state, refetch };
}
