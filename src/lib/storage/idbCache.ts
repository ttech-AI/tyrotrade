/**
 * Minimal promise-based IndexedDB key/value store for entity caches.
 *
 * One object store ("entities"), keyed by the bare entitySet string (e.g.
 * "mserp_etgtryprojecttableentities" or a synthetic key like
 * "freightPriceRows"). No dependencies.
 *
 * Why IndexedDB: localStorage caps at ~5 MB (far less, and flakier, on iOS
 * Safari) and our entity caches total ~3.5–6 MB — so localStorage writes
 * silently fail on mobile, leaving the UI empty. IndexedDB quotas are orders
 * of magnitude larger and uniform across mobile/desktop. `entityCache.ts`
 * keeps an in-memory mirror as the SYNC source of truth and persists here
 * asynchronously, so existing synchronous readers are unaffected.
 */

const DB_NAME = "tyro-cache";
const STORE = "entities";
const VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

/** Load every entry as a `{ key: value }` map. */
export async function idbGetAll(): Promise<Record<string, unknown>> {
  const db = await openDb();
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const keysReq = store.getAllKeys();
    const valsReq = store.getAll();
    tx.oncomplete = () => {
      const keys = keysReq.result as IDBValidKey[];
      const vals = valsReq.result as unknown[];
      const out: Record<string, unknown> = {};
      keys.forEach((k, i) => {
        out[String(k)] = vals[i];
      });
      resolve(out);
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbPut(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbDelete(key: string): Promise<void> {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbClear(): Promise<void> {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
