import * as React from "react";
import { getDataverseClient } from "@/lib/dataverse";
import { readCache, writeCache } from "@/lib/storage/entityCache";
import { EXPENSE_COLUMNS } from "@/lib/dataverse/columnOrder";

const ENTITY_SET = "mserp_tryaiotherexpenseentities";

export interface UseProjectEstimatedExpenseReturn {
  /** Raw estimated-expense rows for the current project. */
  rows: Record<string, unknown>[];
  /** True while a fresh fetch is in flight. */
  isFetching: boolean;
  /** ISO timestamp of the most recent fetch (or null on first mount). */
  fetchedAt: string | null;
  /** Network / parse error message surfaced to the UI, if any. */
  error: string | null;
}

/**
 * 🔒 Read-only — fetch estimated-expense rows for one project on demand.
 *
 * Why this exists: the master `tyro:dv:mserp_tryaiotherexpenseentities`
 * cache was retired (its per-project totals are now stored as a pre-
 * aggregated synthetic cache for composer P&L). Raw line lists (one row
 * per expenseType × project) are still needed for:
 *   - `EstimatedExpenseCard` — per-line Freight/Insurance/Customs rows
 *     with their unit price × tons math
 *   - `BudgetSalesCard` — "Tahmini" side of the realised P&L view
 *   - Veri Yönetimi → "Tahmini Gider" tab — raw row inspector
 *
 * Behaviour mirrors `useProjectInvoices`:
 *   - Triggers a fresh `listAll` server-side filter every time the
 *     `projectNo` changes; cancels in-flight when it changes again.
 *   - Stores results into the shared
 *     `tyro:dv:mserp_tryaiotherexpenseentities` cache slot so the
 *     Veri Yönetimi inspector tab can read the same data without
 *     re-fetching. Defensive client-side filter on `mserp_etgtryprojid`
 *     guards against showing rows from a previously-selected project.
 *   - Accepts EITHER a parent projectNo OR a sub-project ID (the FK
 *     accepts either form on this Tiryaki tenant).
 */
export function useProjectEstimatedExpense(
  projectNo: string | null | undefined
): UseProjectEstimatedExpenseReturn {
  const [isFetching, setIsFetching] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshTick, setRefreshTick] = React.useState(0);

  React.useEffect(() => {
    if (!projectNo) return;
    let cancelled = false;
    setIsFetching(true);
    setError(null);
    (async () => {
      try {
        const client = getDataverseClient();
        const result = await client.listAll<Record<string, unknown>>(
          ENTITY_SET,
          {
            // Plan-detail FK (estimate rows live on tryplanprojectid;
            // etgtryprojid header rows can be stale). Matches the refresh
            // aggregate + the comparison card's "Tahmini" total.
            $filter: `mserp_tryplanprojectid eq '${projectNo}'`,
            $select: EXPENSE_COLUMNS.join(","),
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
          `[useProjectEstimatedExpense] fetch failed for ${projectNo}:`,
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
  }, [projectNo]);

  return React.useMemo(() => {
    const cached = readCache<Record<string, unknown>>(ENTITY_SET);
    const all = cached?.value ?? [];
    if (!projectNo) {
      return {
        rows: [],
        isFetching,
        fetchedAt: cached?.fetchedAt ?? null,
        error,
      };
    }
    const projectRows = all.filter(
      (r) => r["mserp_tryplanprojectid"] === projectNo
    );
    return {
      rows: projectRows,
      isFetching,
      fetchedAt: cached?.fetchedAt ?? null,
      error,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectNo, isFetching, error, refreshTick]);
}
