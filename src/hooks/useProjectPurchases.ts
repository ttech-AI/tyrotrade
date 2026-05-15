import * as React from "react";
import { getDataverseClient } from "@/lib/dataverse";
import { readCache, writeCache } from "@/lib/storage/entityCache";
import { PURCHASE_COLUMNS } from "@/lib/dataverse/columnOrder";
import {
  getFinancingPurchIdSet,
  NON_INTERCOMPANY_FILTER,
} from "@/lib/dataverse/refreshAll";

const ENTITY_SET = "mserp_tryaivendinvoicetransentities";

export interface UseProjectPurchasesReturn {
  /** Vendor invoice transaction rows for the current project, with
   *  intercompany + financing-order rows already stripped. */
  rows: Record<string, unknown>[];
  /** True while a fresh fetch is in flight. */
  isFetching: boolean;
  /** ISO timestamp of the most recent fetch (or null on first mount). */
  fetchedAt: string | null;
  /** Network / parse error message surfaced to the UI, if any. */
  error: string | null;
}

/**
 * 🔒 Read-only — fetch realised purchase (vendor invoice) rows for one
 * project on demand.
 *
 * Why this exists: the master `tyro:dv:mserp_tryaivendinvoicetransentities`
 * cache was retired because adding sub-project IDs to the union scope
 * pushed it past the localStorage 5MB quota. Per-project realised
 * purchases are now only needed when the user is actively looking at
 * one project — fetch them on-demand instead of carrying the whole
 * tenant in cache.
 *
 * Consumers:
 *   - `BudgetSalesCard` — "Alım" side of the realised P&L view
 *   - Veri Yönetimi → "Satınalma Faturaları" tab — raw row inspector
 *
 * Project FK = `mserp_purchtable_etgtryprojid` (the flattened parent
 * purchase table column — different prefix from the customer side's
 * `mserp_etgtryprojid`). Accepts EITHER a parent projectNo OR a
 * sub-project ID transparently.
 *
 * Financing-order rows (mserp_purchid in cached set) excluded
 * CLIENT-SIDE — F&O virtual entities reject `not In(...)` filters.
 */
export function useProjectPurchases(
  projectNo: string | null | undefined
): UseProjectPurchasesReturn {
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
            $filter: `mserp_purchtable_etgtryprojid eq '${projectNo}' and (${NON_INTERCOMPANY_FILTER})`,
            $select: PURCHASE_COLUMNS.join(","),
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
          `[useProjectPurchases] fetch failed for ${projectNo}:`,
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
      (r) => r["mserp_purchtable_etgtryprojid"] === projectNo
    );
    // Strip financing-order rows (mserp_etgordertype === Finansman on
    // the parent purchase table → mserp_purchid in the cached set).
    const financingSet = getFinancingPurchIdSet();
    const filtered =
      financingSet.size > 0
        ? projectRows.filter(
            (r) => !financingSet.has(String(r["mserp_purchid"] ?? ""))
          )
        : projectRows;
    return {
      rows: filtered,
      isFetching,
      fetchedAt: cached?.fetchedAt ?? null,
      error,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectNo, isFetching, error, refreshTick]);
}
