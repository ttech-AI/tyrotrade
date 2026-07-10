import * as React from "react";
import {
  CACHE_UPDATED_EVENT,
  cacheFingerprint,
  readCache,
  type CacheUpdatedDetail,
} from "@/lib/storage/entityCache";
import {
  selectPendingPaymentsFromShips,
  type PendingPayments,
} from "@/lib/selectors/overview";

/** Ship-plan entity — the sole source for the payment-pending card. */
const SHIP_ENTITY_SET = "mserp_tryaiprojectshiprelationentities";
/** Project header entity — carries `mserp_traderid` / `mserp_maintraderid`. */
const PROJECT_ENTITY_SET = "mserp_etgtryprojecttableentities";
/** Sub-project header entity — inherits trader from its parent (FK `mserp_projid`). */
const SUBPROJECT_ENTITY_SET = "mserp_trysubprojectentities";

/** Only Fatih Tiryakioğlu's (TRD-FTB) voyages surface in this alert — the
 *  rest of the book is tracked through a different payment process. */
const PENDING_PAYMENTS_TRADER = "TRD-FTB";

/**
 * 🔒 Read-only hook: the "Ödeme Bekleyen Gemiler" card, sourced DIRECTLY
 * from the cached ship-plan rows — NOT from the composed/filtered project
 * list. This is what makes the card a true global alert:
 *
 * - independent of every page filter (group / segment / status / period) —
 *   those live in page state and never touch this cache;
 * - independent of the segment scope that drops headerless projects;
 * - independent of sub-project elevation (a voyage whose only record is a
 *   sub-project ship row, e.g. ORGANIK01-71, is still counted here).
 *
 * The one deliberate scope restriction: only `PENDING_PAYMENTS_TRADER`
 * (TRD-FTB) voyages are included, joined in via the project header (and,
 * for elevated sub-projects, the parent project the sub-project inherits
 * its trader from) — ship-plan rows carry no trader column of their own.
 *
 * Re-derives only when the ship / project / sub-project cache fingerprints
 * change (same pattern as useRealProjects / useFreightPrices).
 */
export function usePendingPayments(): PendingPayments {
  const fpShip = useCacheFingerprint(SHIP_ENTITY_SET);
  const fpProjects = useCacheFingerprint(PROJECT_ENTITY_SET);
  const fpSubProjects = useCacheFingerprint(SUBPROJECT_ENTITY_SET);
  return React.useMemo(() => {
    const shipCache = readCache<Record<string, unknown>>(SHIP_ENTITY_SET);
    const projectCache = readCache<Record<string, unknown>>(PROJECT_ENTITY_SET);
    const subProjectCache = readCache<Record<string, unknown>>(
      SUBPROJECT_ENTITY_SET
    );
    const traderByProjectId = buildTraderLookup(
      projectCache?.value ?? [],
      subProjectCache?.value ?? []
    );
    const shipRows = (shipCache?.value ?? []).filter((s) => {
      const projectNo = readStr(s, "mserp_tryshipprojid").trim();
      const trader = traderByProjectId.get(projectNo);
      return (
        trader?.traderNo === PENDING_PAYMENTS_TRADER ||
        trader?.mainTraderNo === PENDING_PAYMENTS_TRADER
      );
    });
    return selectPendingPaymentsFromShips(shipRows, new Date());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fpShip, fpProjects, fpSubProjects]);
}

function readStr(r: Record<string, unknown>, k: string): string {
  const v = r[k];
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

/** Maps every project id (parent AND elevated sub-project) to its trader
 *  codes, so ship-plan rows — which carry no trader column — can be
 *  filtered by trader via their `mserp_tryshipprojid` FK. Sub-projects
 *  inherit the parent's trader (they don't own the column themselves). */
function buildTraderLookup(
  projectRows: Record<string, unknown>[],
  subProjectRows: Record<string, unknown>[]
): Map<string, { traderNo: string; mainTraderNo: string }> {
  const byParentId = new Map<
    string,
    { traderNo: string; mainTraderNo: string }
  >();
  for (const p of projectRows) {
    const projid = readStr(p, "mserp_projid").trim();
    if (!projid) continue;
    byParentId.set(projid, {
      traderNo: readStr(p, "mserp_traderid").trim(),
      mainTraderNo: readStr(p, "mserp_maintraderid").trim(),
    });
  }
  const lookup = new Map(byParentId);
  for (const sp of subProjectRows) {
    const subProjid = readStr(sp, "mserp_subprojectid").trim();
    if (!subProjid) continue;
    const parentProjid = readStr(sp, "mserp_projid").trim();
    const inherited = byParentId.get(parentProjid);
    if (inherited) lookup.set(subProjid, inherited);
  }
  return lookup;
}

/* ─────────── Cache fingerprint (same pattern as sibling hooks) ─────────── */

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
