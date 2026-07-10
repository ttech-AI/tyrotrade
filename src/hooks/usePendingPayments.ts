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

/**
 * 🔒 Read-only hook: the "Ödeme Bekleyen Gemiler" card, sourced DIRECTLY
 * from the cached ship-plan rows — NOT from the composed/filtered project
 * list. This is what makes the card a true global alert:
 *
 * - independent of every page filter (group / segment / status / period /
 *   trader) — those live in page state and never touch this cache;
 * - independent of the segment scope that drops headerless projects;
 * - independent of sub-project elevation (a voyage whose only record is a
 *   sub-project ship row, e.g. ORGANIK01-71, is still counted here).
 *
 * Re-derives only when the ship cache fingerprint changes (same pattern as
 * useRealProjects / useFreightPrices).
 */
export function usePendingPayments(): PendingPayments {
  const fp = useCacheFingerprint(SHIP_ENTITY_SET);
  return React.useMemo(() => {
    const cache = readCache<Record<string, unknown>>(SHIP_ENTITY_SET);
    return selectPendingPaymentsFromShips(cache?.value ?? [], new Date());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fp]);
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
