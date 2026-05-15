import * as React from "react";
import { getDataverseClient } from "@/lib/dataverse";
import {
  CACHE_UPDATED_EVENT,
  readCache,
  writeCache,
  type CacheUpdatedDetail,
} from "@/lib/storage/entityCache";
import { ACTUAL_EXPENSE_ROLLUP_CACHE } from "@/lib/dataverse/refreshAll";
import {
  fetchActualExpenseRollupForAllProjects,
  ROLLUP_STAGES,
  type ActualExpenseRollupRow,
  type RollupProgress,
  type RollupStage,
} from "@/lib/dataverse/actualExpenseRollup";

/** Per-stage status surfaced to the UI step list. */
export type StageStatus = "pending" | "running" | "done";

export interface StageProgress {
  stage: RollupStage;
  status: StageStatus;
  /** Last reported count (records / IDs / rows). null while pending. */
  count: number | null;
}

/** Cache freshness threshold — anything older than this and the
 *  hook auto-refreshes on next mount. Manual `refresh()` always
 *  bypasses the check. 6 hours: long enough that intra-day return
 *  visits skip the 4-stage pipeline cost, short enough that the
 *  next day's view sees fresh data without thinking about it. */
const STALE_AFTER_MS = 6 * 60 * 60 * 1000;

export interface UseActualExpenseRollupReturn {
  /** Flat realised-expense rollup rows (per projectNo × expenseId). */
  rows: ActualExpenseRollupRow[];
  /** ISO timestamp of the most recent successful fetch, or null. */
  fetchedAt: string | null;
  /** True when the cache is missing entirely (first visit / cleared). */
  isEmpty: boolean;
  /** True while a fetch is in flight. */
  isFetching: boolean;
  /** Last fetch error, if any. */
  error: string | null;
  /** Per-stage progress entries — drives the step-by-step progress
   *  UI. Reset to all-pending when a fresh fetch starts; updates as
   *  each stage transitions through `running` → `done`. */
  stages: StageProgress[];
  /** Manually trigger a fetch (page's test "Yenile" button) —
   *  bypasses the staleness check. */
  refresh: () => void;
}

const INITIAL_STAGES: StageProgress[] = ROLLUP_STAGES.map((stage) => ({
  stage,
  status: "pending",
  count: null,
}));

/**
 * 🔒 Read-only hook — exposes the tenant-wide realised-expense rollup
 * with a **lazy auto-fetch + manual refresh** pattern.
 *
 * On mount:
 *   - Cache exists AND fresh (< 6h)  → render from cache, no fetch.
 *   - Cache missing OR stale (≥ 6h)  → auto-fetch in the background;
 *     page shows progress UI via `isFetching=true`.
 *
 * The page also exposes a manual "Yenile" button that calls
 * `refresh()` (bypasses freshness check) — useful for testing and
 * for users who want fresher data than the 6h threshold.
 *
 * Fetch writes to localStorage (`tyro:dv:actualExpenseRollup`) and
 * fires the same-tab `tyro:cache-updated` event. The pipeline
 * (`fetchActualExpenseRollupForAllProjects`) runs ~1-2 min on this
 * tenant; pulling it out of the bulk refresh keeps auto-refresh
 * fast and lets users who never open the P&L Cost page skip it.
 */
export function useActualExpenseRollup(): UseActualExpenseRollupReturn {
  const fingerprint = useCacheFingerprint(ACTUAL_EXPENSE_ROLLUP_CACHE);
  const [isFetching, setIsFetching] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [stages, setStages] = React.useState<StageProgress[]>(INITIAL_STAGES);

  // Read snapshot from localStorage on every fingerprint bump.
  const snapshot = React.useMemo(() => {
    const cached = readCache<ActualExpenseRollupRow>(
      ACTUAL_EXPENSE_ROLLUP_CACHE
    );
    return {
      rows: cached?.value ?? [],
      fetchedAt: cached?.fetchedAt ?? null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint]);

  /** Apply a single progress event into the stages array (immutable
   *  update — replaces the entry for the matching stage). */
  const applyProgress = React.useCallback(
    (p: RollupProgress) => {
      setStages((prev) =>
        prev.map((s) =>
          s.stage === p.stage
            ? {
                stage: p.stage,
                status: p.status,
                count: p.count ?? s.count,
              }
            : s
        )
      );
    },
    []
  );

  /** Run the 4-stage pipeline + write the result to cache. Surface
   *  isFetching/error/stages to the caller. */
  const runFetch = React.useCallback(async () => {
    setIsFetching(true);
    setError(null);
    setStages(INITIAL_STAGES);
    try {
      const client = getDataverseClient();
      // Re-read the active project IDs at fetch time (the projects
      // cache may have been refreshed in the background between
      // mounts). Include sub-project IDs in the same union — voyage
      // legs book their own realised-expense rows under the same
      // FK columns the rollup pipeline scans, so omitting them would
      // silently undercount the Trade Cost report.
      const projidCache = readCache<Record<string, unknown>>(
        "mserp_etgtryprojecttableentities"
      );
      const subProjidCache = readCache<Record<string, unknown>>(
        "mserp_trysubprojectentities"
      );
      const idSet = new Set<string>();
      for (const r of projidCache?.value ?? []) {
        const id = r.mserp_projid as string | undefined;
        if (id) idSet.add(id);
      }
      for (const r of subProjidCache?.value ?? []) {
        const id = r.mserp_subprojectid as string | undefined;
        if (id) idSet.add(id);
      }
      const projids = [...idSet];

      const rollup = await fetchActualExpenseRollupForAllProjects(
        client,
        projids,
        applyProgress
      );
      writeCache(ACTUAL_EXPENSE_ROLLUP_CACHE, {
        fetchedAt: new Date().toISOString(),
        value: rollup,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[useActualExpenseRollup] fetch failed:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsFetching(false);
    }
  }, [applyProgress]);

  // Auto-fetch on mount when cache is missing / stale. Ref guards
  // against double-firing in StrictMode. Only triggers ONCE per
  // page mount; manual refresh button drives subsequent fetches.
  const autoFetchedRef = React.useRef(false);
  React.useEffect(() => {
    if (autoFetchedRef.current) return;
    if (isFetching) return;
    if (snapshot.rows.length === 0 || isStale(snapshot.fetchedAt)) {
      autoFetchedRef.current = true;
      void runFetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    rows: snapshot.rows,
    fetchedAt: snapshot.fetchedAt,
    isEmpty: snapshot.rows.length === 0,
    isFetching,
    error,
    stages,
    refresh: () => {
      void runFetch();
    },
  };
}

function isStale(fetchedAt: string | null): boolean {
  if (!fetchedAt) return true;
  const t = new Date(fetchedAt).getTime();
  if (!Number.isFinite(t)) return true;
  return Date.now() - t > STALE_AFTER_MS;
}

/** Same fingerprint pattern as `useRealProjects.useCacheFingerprint`
 *  — listens for cross-tab `storage` events AND the same-tab
 *  `tyro:cache-updated` custom event so consumers re-render after a
 *  fetch in either tab. */
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
