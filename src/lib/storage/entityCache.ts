/**
 * Entity-row cache — in-memory mirror (synchronous source of truth) backed by
 * IndexedDB (asynchronous persistence).
 *
 * WHY THIS SHAPE: the old implementation wrote straight to localStorage, which
 * caps at ~5 MB (less, and flakier, on iOS Safari). Our entity caches total
 * ~3.5–6 MB, so on mobile the writes silently failed (`QuotaExceededError`)
 * and every consumer — which reads synchronously via a fingerprint — saw an
 * empty cache. Result: "refresh ran but Sefer Takibi / Genel Bakış show
 * nothing" on phones.
 *
 * The fix keeps the SAME synchronous public API (`readCache` / `writeCache` /
 * `cacheFingerprint` / …) so the ~6 consumers don't change, but backs it with:
 *   - an in-memory `Map` mirror = the synchronous source of truth, and
 *   - IndexedDB (quota ~hundreds of MB, uniform mobile/desktop) for persistence.
 *
 * `writeCache` updates the mirror synchronously (so the data is available this
 * session no matter what) and fire-and-forgets the IndexedDB write. On boot,
 * `hydrateEntityCache()` loads IndexedDB into the mirror (migrating any leftover
 * localStorage caches first) and dispatches `tyro:cache-updated` per entity so
 * already-mounted consumers re-render.
 *
 * Same-tab updates are signalled via the `tyro:cache-updated` CustomEvent.
 * (Cross-tab sync via the native `storage` event no longer fires for IndexedDB
 * writes — acceptable; the app is effectively single-tab. A BroadcastChannel
 * could restore it later if needed.)
 */

import { idbClear, idbDelete, idbGetAll, idbPut } from "./idbCache";

const KEY_PREFIX = "tyro:dv:";

/** Custom event fired on the window after a cache write/clear so same-tab
 *  subscribers (`useCacheFingerprint` etc.) re-derive immediately. */
export const CACHE_UPDATED_EVENT = "tyro:cache-updated";

export interface CacheUpdatedDetail {
  entitySet: string;
}

function dispatchCacheUpdated(entitySet: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<CacheUpdatedDetail>(CACHE_UPDATED_EVENT, {
      detail: { entitySet },
    })
  );
}

export interface EntityCacheEntry<T = Record<string, unknown>> {
  /** ISO timestamp when this snapshot was captured */
  fetchedAt: string;
  /** Raw rows */
  value: T[];
  /** Server-reported total (may be undefined if `$count` wasn't requested) */
  totalCount?: number;
}

/** In-memory mirror — the SYNCHRONOUS source of truth for every reader.
 *  Keyed by the bare entitySet string. */
const mirror = new Map<string, EntityCacheEntry>();

export function readCache<T = Record<string, unknown>>(
  entitySet: string
): EntityCacheEntry<T> | null {
  const entry = mirror.get(entitySet);
  return entry ? (entry as EntityCacheEntry<T>) : null;
}

export function writeCache<T = Record<string, unknown>>(
  entitySet: string,
  entry: EntityCacheEntry<T>
): { ok: boolean; reason?: string } {
  try {
    // The mirror is the synchronous source of truth: once set, the data is
    // available to every reader for the rest of the session regardless of
    // whether the async IndexedDB persistence below succeeds. This is what
    // removes the old "write failed → UI empty" class of bug.
    mirror.set(entitySet, entry as EntityCacheEntry);
    dispatchCacheUpdated(entitySet);
    // Persist asynchronously; a failure only costs cross-reload persistence,
    // not this session's render.
    void idbPut(entitySet, entry).catch((err) => {
      // eslint-disable-next-line no-console
      console.warn(
        `[entityCache] IndexedDB persist failed for ${entitySet}: ${
          err instanceof Error ? err.name : "unknown"
        }. Data is in-session only.`
      );
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.name : "unknown" };
  }
}

export function clearCache(entitySet: string): void {
  mirror.delete(entitySet);
  dispatchCacheUpdated(entitySet);
  void idbDelete(entitySet).catch(() => {});
}

export function clearAllCaches(): void {
  const keys = [...mirror.keys()];
  mirror.clear();
  void idbClear().catch(() => {});
  for (const k of keys) dispatchCacheUpdated(k);
}

/** Cheap change-detection fingerprint for the cache-fingerprint hooks.
 *  Changes whenever a slot is (re)written or cleared. Replaces the old
 *  `localStorage.getItem(...).slice(0, 80)` approach. */
export function cacheFingerprint(entitySet: string): string {
  const entry = mirror.get(entitySet);
  if (!entry) return "";
  return `${entry.fetchedAt}:${entry.value?.length ?? 0}`;
}

/** All cached entity sets + their `fetchedAt` — for the Veri Yönetimi diagnostics. */
export function listCacheSnapshots(): Array<{
  entitySet: string;
  fetchedAt: string;
  count: number;
}> {
  const out: Array<{ entitySet: string; fetchedAt: string; count: number }> =
    [];
  for (const [entitySet, entry] of mirror) {
    out.push({
      entitySet,
      fetchedAt: entry.fetchedAt,
      count: entry.value?.length ?? 0,
    });
  }
  return out.sort((a, b) => b.fetchedAt.localeCompare(a.fetchedAt));
}

/**
 * Boot-time hydration. MUST run before (or as) the app renders data consumers.
 *
 * 1. One-time migration: move any leftover `localStorage["tyro:dv:*"]` entries
 *    into the mirror + IndexedDB, then remove them from localStorage to reclaim
 *    that scarce ~5 MB. (Only finds data on the first run after this ships.)
 * 2. Load every IndexedDB entry into the mirror.
 * 3. Dispatch `tyro:cache-updated` per entity so any already-mounted consumer
 *    re-renders with the now-available data.
 *
 * Always resolves (never rejects) — if IndexedDB is unavailable the app simply
 * runs with whatever the migration salvaged (or empty, prompting a refresh).
 */
export async function hydrateEntityCache(): Promise<void> {
  // 1 — migrate leftover localStorage caches (first run only).
  try {
    if (typeof localStorage !== "undefined") {
      const lsKeys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(KEY_PREFIX)) lsKeys.push(k);
      }
      for (const k of lsKeys) {
        const raw = localStorage.getItem(k);
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as EntityCacheEntry;
            if (parsed?.fetchedAt && Array.isArray(parsed.value)) {
              const es = k.slice(KEY_PREFIX.length);
              mirror.set(es, parsed);
              void idbPut(es, parsed).catch(() => {});
            }
          } catch {
            // corrupt entry — drop it
          }
        }
        localStorage.removeItem(k);
      }
    }
  } catch {
    // localStorage unavailable — nothing to migrate
  }

  // 2 — load IndexedDB into the mirror.
  try {
    const all = await idbGetAll();
    for (const [es, value] of Object.entries(all)) {
      if (value && typeof value === "object") {
        mirror.set(es, value as EntityCacheEntry);
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[entityCache] IndexedDB hydrate failed: ${
        err instanceof Error ? err.message : String(err)
      }. Running with migrated/empty cache.`
    );
  }

  // 3 — notify already-mounted consumers.
  for (const es of mirror.keys()) dispatchCacheUpdated(es);
}
