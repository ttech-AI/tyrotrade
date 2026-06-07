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
// STALE_AFTER_MS sabiti auto-fetch ile birlikte kaldırıldı.
// İleride zaman-bazlı stale uyarısı eklemek istersek tekrar
// reactivate edilebilir.

export interface UseActualExpenseRollupReturn {
  /** Flat realised-expense rollup rows (per projectNo × expenseId). */
  rows: ActualExpenseRollupRow[];
  /** ProjectNos the cached rollup was last computed for. Lets the page
   *  tell whether the current filtered set is fully covered (→ render
   *  from cache) or extends beyond it (→ prompt a scoped re-compute). */
  computedProjids: string[];
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
  /** Manually trigger a fetch. Pass the scoped projid list (the
   *  currently-filtered projects) to compute ONLY those — dramatically
   *  faster than the full tenant sweep. Omit to recompute every active
   *  project (cache-derived, the slow path). */
  refresh: (projids?: string[]) => void;
}

/** Sibling cache holding the projid SCOPE the rollup was computed for.
 *  Written in the same tick as the rollup cache, so the snapshot memo
 *  (keyed on the rollup fingerprint) reads a consistent pair. */
const ROLLUP_SCOPE_CACHE = "actualExpenseRollupScope";

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
    const scope = readCache<string>(ROLLUP_SCOPE_CACHE);
    return {
      rows: cached?.value ?? [],
      computedProjids: scope?.value ?? [],
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
   *  isFetching/error/stages to the caller. `projidsOverride` scopes
   *  the run to a subset (the page passes the filtered projects) —
   *  the single biggest perf lever, since the full tenant sweep over
   *  ~850 projects takes minutes while a segment (~60) takes seconds. */
  const runFetch = React.useCallback(
    async (projidsOverride?: string[]) => {
      setIsFetching(true);
      setError(null);
      setStages(INITIAL_STAGES);
      try {
        const client = getDataverseClient();
        let projids: string[];
        if (projidsOverride && projidsOverride.length > 0) {
          // Scoped run — exactly the projects the page is showing.
          projids = [...new Set(projidsOverride.filter(Boolean))];
        } else {
          // Full sweep (no scope): re-read every active project ID from
          // cache, incl. sub-projects (voyage legs book realised rows
          // under their own FK). Slow — minutes on this tenant.
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
          projids = [...idSet];
        }

        const rollup = await fetchActualExpenseRollupForAllProjects(
          client,
          projids,
          applyProgress
        );
        const fetchedAt = new Date().toISOString();
        writeCache(ACTUAL_EXPENSE_ROLLUP_CACHE, {
          fetchedAt,
          value: rollup,
        });
        // Record the scope so the page knows which filtered sets this
        // cache covers (written second so the rollup fingerprint bump
        // picks up a consistent pair).
        writeCache(ROLLUP_SCOPE_CACHE, { fetchedAt, value: projids });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[useActualExpenseRollup] fetch failed:", err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsFetching(false);
      }
    },
    [applyProgress]
  );

  // Auto-fetch DISABLED — user feedback: 30-60s pipeline page mount'a
  // tetiklenince sayfayı "kilitliyor" hissi veriyordu. Şimdi sadece
  // manual refresh butonu fetch eder; cache stale/empty olsa bile
  // kendiliğinden başlamaz. Empty state'i kullanıcı görür, "Hesapla"
  // butonuyla bilinçli olarak başlatır.

  return {
    rows: snapshot.rows,
    computedProjids: snapshot.computedProjids,
    fetchedAt: snapshot.fetchedAt,
    isEmpty: snapshot.rows.length === 0,
    isFetching,
    error,
    stages,
    refresh: (projids?: string[]) => {
      void runFetch(projids);
    },
  };
}

// `isStale` helper auto-fetch effect ile birlikte kaldırıldı; manuel
// refresh artık tek yol, freshness değerlendirmesine ihtiyaç kalmadı.

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
