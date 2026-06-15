# Mobil + i18n Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development or superpowers:executing-plans to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.
>
> **No test runner in this repo.** Verification contract = `npm run lint` (`tsc --noEmit`) + `npm run build` + manual browser check (the user drives the browser preview). Wherever a generic plan would say "write failing test", here it means "add the code, then lint+build, then verify in the browser".
>
> **🔒 READ-ONLY Dataverse invariant** holds throughout: only `list()/listAll()/get()`, only `writeCache` to local storage. No `useMutation`/POST/PATCH/PUT/DELETE.

**Goal:** Make tyrotrade fully usable on phones — fix the mobile "data doesn't show" bug, make every page responsive, fix the unreachable chat button, and add a TR/EN language toggle with a lightweight i18n system.

**Architecture:** Four independent, separately-shippable phases executed in order. Phase 1 replaces the localStorage entity cache with an IndexedDB-backed store + a synchronous in-memory mirror (so existing sync readers are untouched) — this removes the quota ceiling that breaks mobile. Phase 2 makes layouts responsive (the recurring gap is wide tables). Phase 3 unhides the chat trigger on phones. Phase 4 adds a custom `t()` i18n context + a sidebar toggle.

**Tech Stack:** React 19, TS 5.7, Vite 6, Tailwind v4, react-router 7 (HashRouter), framer-motion, recharts. No new heavy deps (i18n is a ~300-line custom context, not react-i18next).

**Sequence + rationale:** P1 first (no point styling pages whose data is empty on mobile) → P2 responsive → P3 chat → P4 i18n (user explicitly wants i18n last). Each phase ends green on lint+build and is committable on its own.

---

## Phase 1 — Fix mobile data bug (IndexedDB + in-memory mirror)

**Root cause (confirmed):** localStorage quota exhaustion on iOS Safari. The refresh chain writes ~3.5–6 MB across 8 cache keys (`ship` alone ~2–4 MB, written twice). On quota failure `writeCache` returns `{ok:false}` — which `refreshAll` ignores (success toast lies) — and consumers read localStorage-only with no in-memory fallback → empty UI. Desktop fits under quota; mobile doesn't.

**Fix strategy:** Keep the existing synchronous `readCache`/`writeCache` API (so the ~6 consumers don't change), but back it with an in-memory `Map` mirror that is the synchronous source of truth, persisted asynchronously to IndexedDB (quota ~hundreds of MB on mobile, no ceiling). Hydrate the mirror from IndexedDB once on boot; migrate any existing localStorage caches into it. Net effect: mobile behaves identically to PC.

### File structure

- Create `src/lib/storage/idbCache.ts` — thin IndexedDB key/value wrapper (open DB, get-all, put, delete, clear). ~80 lines, no deps.
- Modify `src/lib/storage/entityCache.ts` — keep the public API (`readCache`/`writeCache`/`clearCache`/`clearAllCaches`/`listCacheSnapshots`/`CACHE_UPDATED_EVENT`); back it with an in-memory `Map` mirror + async IndexedDB persistence; add `hydrateEntityCache()` + `cacheFingerprint(entitySet)`.
- Modify `src/main.tsx` — `await hydrateEntityCache()` (with migration) before/around app render; on completion the hydration dispatches `tyro:cache-updated` per entity so consumers re-render.
- Modify `src/hooks/useRealProjects.ts`, `src/hooks/useActualExpenseRollup.ts`, `src/hooks/useFreightPrices.ts` — replace the local `readFingerprint` (which reads `localStorage.getItem`) with the shared `cacheFingerprint()` from entityCache.
- Modify `src/lib/dataverse/refreshAll.ts` — inspect `writeCache` results; if any `{ok:false}`, surface a warning toast instead of a silent success. Fix the stale "in React state" comment.
- (Optional, deferred) `src/lib/filters/projectFilters.ts` / `OverviewPage.tsx` — guard the "no vesselPlan data at all" case so a (now-unlikely) partial cache doesn't filter everything out.

### Tasks

- [ ] **Task 1.1 — IndexedDB wrapper.** Create `src/lib/storage/idbCache.ts`:

```ts
// Minimal promise-based IndexedDB KV store for entity caches. One object
// store ("entities"), keyed by entitySet string. No deps.
const DB_NAME = "tyro-cache";
const STORE = "entities";
const VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
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

export async function idbGetAll(): Promise<Record<string, unknown>> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const out: Record<string, unknown> = {};
    const keysReq = store.getAllKeys();
    const valsReq = store.getAll();
    tx.oncomplete = () => {
      const keys = keysReq.result as IDBValidKey[];
      const vals = valsReq.result as unknown[];
      keys.forEach((k, i) => (out[String(k)] = vals[i]));
      resolve(out);
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbPut(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbDelete(key: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbClear(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
```

- [ ] **Task 1.2 — Mirror-backed entityCache.** Rewrite `src/lib/storage/entityCache.ts` internals to use an in-memory `Map` mirror as the sync source of truth; `writeCache` updates the mirror synchronously (always `{ok:true}` unless serialization throws), fires `tyro:cache-updated`, and fire-and-forget persists to IndexedDB. Add:
  - `const mirror = new Map<string, EntityCacheEntry>()`
  - `readCache(entitySet)` → `mirror.get(entitySet) ?? null` (sync, same signature).
  - `writeCache(entitySet, entry)` → `mirror.set(...)`, dispatch event, `void idbPut("tyro:dv:"+entitySet, entry)`; return `{ok:true}`.
  - `clearCache` / `clearAllCaches` → mutate mirror + `void idbDelete/idbClear`, dispatch.
  - `cacheFingerprint(entitySet)` → derive an 80-char-equivalent fingerprint from the mirror entry (e.g. `entry.fetchedAt + ":" + entry.value.length`), replacing the localStorage-slice approach.
  - `hydrateEntityCache()` → (a) one-time migrate: read any existing `localStorage["tyro:dv:*"]` into the mirror + IndexedDB, then `localStorage.removeItem` them to reclaim space; (b) `idbGetAll()` → load every entry into the mirror; (c) dispatch `tyro:cache-updated` for each loaded entitySet so already-mounted consumers re-render. Wrap in try/catch (if IndexedDB unavailable, fall back to the current localStorage behavior).
  - Verify: `npm run lint`.

- [ ] **Task 1.3 — Boot hydration.** In `src/main.tsx`, call `hydrateEntityCache()` before rendering data consumers. Simplest non-blocking approach: kick off hydration immediately, render the app right away (consumers show their empty/loading states for ~tens of ms), and let the per-entity `tyro:cache-updated` dispatches from hydration trigger re-render. Verify: `npm run lint && npm run build`.

- [ ] **Task 1.4 — Redirect fingerprints.** In `useRealProjects.ts`, `useActualExpenseRollup.ts`, `useFreightPrices.ts`, replace each local `readFingerprint(entitySet)` body with a call to the exported `cacheFingerprint(entitySet)`. Keep the event listeners as-is (they already listen to `CACHE_UPDATED_EVENT` + `storage`). Verify: `npm run lint`.

- [ ] **Task 1.5 — Honest refresh result.** In `refreshAll.ts`, capture `writeCache` return values; if any step's write returns `{ok:false}`, set a flag and show a warning toast ("Veriler kaydedilemedi — depolama hatası") instead of the success toast. Fix the misleading comment in `entityCache.ts` about rows surviving in React state. Verify: `npm run lint && npm run build`.

- [ ] **Task 1.6 — Manual verify (USER).** On a phone (or DevTools mobile emulation + a fresh profile): log in (real mode), run a refresh, confirm Sefer Takibi + Genel Bakış now show data. Confirm Application → IndexedDB → `tyro-cache` is populated and localStorage is no longer near quota.

- [ ] **Task 1.7 — Commit.** `git add` the changed files; commit `"Mobil veri hatasi: entity cache localStorage -> IndexedDB + bellek aynasi (kota tavani kalkti)"`.

---

## Phase 2 — Mobile-responsive all pages

**Recurring gap:** wide data tables overflow horizontally with no mobile reflow. Secondary: fixed chart heights, grid cramping at 375–640px, drawer edge margins. Shell/sidebar/drawers are already responsive (`useIsMobile` @768px, Sheet drawer).

### File structure

- Create `src/components/ui/responsive-table.tsx` — a small helper/convention for "table on desktop, stacked cards on mobile" (or a `useIsMobile`-driven column-visibility hook). Reused by the four wide tables.
- Modify the four table hosts: `src/components/overview/SegmentMatrixCard.tsx`, `src/components/pl-cost/PLCostTable.tsx`, `src/components/freight/FreightTable.tsx`, `src/components/data-management/EntityRowsTable.tsx`.
- Modify chart wrappers with fixed heights: `src/components/freight/FreightTrendChart.tsx` + `FreightTopLanesChart.tsx` (and any dashboard charts) — replace `h-[260px]` with responsive height.
- Modify grid hosts for sm refinement: `src/pages/DashboardPage.tsx` + `src/components/dashboard/BentoGrid.tsx`, `src/pages/OverviewPage.tsx`, `src/pages/PriceTrackingPage.tsx` (toolbar wrap on mobile).
- Modify `src/pages/ProjectsPage.tsx` — polish the existing Liste/Harita/Detay mobile tab interaction.
- Modify chat/detail drawers for small-screen edge margin (`src/components/chat/*`, detail panels).

### Tasks

- [ ] **Task 2.1 — Decide + build the responsive-table pattern.** Implement `useIsMobile`-gated rendering: on `<768px`, render each row as a stacked card (label: value pairs) for FreightTable / PLCostTable; for SegmentMatrixCard + EntityRowsTable (data-dense), allow horizontal scroll but pin the first column and shrink padding. Create `src/components/ui/responsive-table.tsx` with the shared card-stack primitive. Verify: lint.
- [ ] **Task 2.2 — FreightTable mobile.** Apply the card-stack on mobile (Hat + Güncel Navlun + Trend as the primary card; rest in a collapsible). Keep desktop table unchanged. Verify: lint + build + browser.
- [ ] **Task 2.3 — PLCostTable mobile.** Same card-stack/column-priority treatment; preserve the tree expand/collapse. Verify: lint + build + browser.
- [ ] **Task 2.4 — SegmentMatrixCard + EntityRowsTable mobile.** Constrain `min-w-[420px]` → horizontal scroll within the card (not the page); shrink cell padding on mobile. Verify: lint + build + browser.
- [ ] **Task 2.5 — Charts responsive height.** Replace fixed `h-[260px]` with `h-[220px] sm:h-[260px]` (or aspect-based) in Freight charts + any dashboard chart tiles. Verify: lint + build + browser.
- [ ] **Task 2.6 — Grid + toolbar refinement.** Dashboard BentoGrid + Overview grid: verify cards aren't cramped at 375px (add `sm:` spans/padding). PriceTrackingPage toolbar: confirm it wraps cleanly on mobile (search full-width, filters wrap, period chips wrap). Verify: browser.
- [ ] **Task 2.7 — ProjectsPage mobile tabs polish.** Smooth the Liste/Harita/Detay switching; ensure the map tab sizes correctly and the detail tab is reachable. Verify: browser.
- [ ] **Task 2.8 — Drawer edge margins.** Add small-screen breathing room (`mx-2`/`p-2` on `<sm`) to chat + detail drawers. Verify: browser.
- [ ] **Task 2.9 — Full mobile sweep (USER) + commit.** Walk every page at 375px + 768px; note any leftover overflow. Commit `"Mobil responsive: tablolar (kart-yigini), grafik yukseklikleri, grid/toolbar ince ayar"`.

---

## Phase 3 — TYRO Chat reachable + polished on mobile

**Real bug:** the topbar "TYRO Chat" trigger is `hidden sm:inline-flex` → invisible on phones <640px, so users can't open chat. Drawers themselves are already full-screen on mobile (Sheet).

### Tasks

- [ ] **Task 3.1 — Unhide the chat trigger on mobile.** In `src/components/layout/AppShell.tsx` (topbar) make the chat button visible on all sizes — either show it `<sm` (drop `hidden sm:inline-flex`) or add it to the mobile Sheet menu / as a floating action button on `<sm`. Pick the FAB or always-visible icon so it's thumb-reachable. Verify: lint + build + browser.
- [ ] **Task 3.2 — Input/keyboard polish.** Ensure the chat input stays above the iOS keyboard (use `dvh`/safe-area, `scrollIntoView` on focus) and the send button is reachable. Verify: browser on a real phone.
- [ ] **Task 3.3 — Commit.** `"TYRO Chat mobilde acilabiliyor: topbar tetikleyici gorunur + klavye/giris cilasi"`.

---

## Phase 4 — i18n TR/EN (infra + high-traffic pages, then incremental)

**State:** no i18n infra; ~775 Turkish strings across 118 `.tsx`, mostly inline. Decision: lightweight custom `t()` context (no react-i18next), default `tr`, toggle in sidebar by ThemeSwitcher, EN system prompt for TYRO AI. Translate infra + high-traffic pages first; sweep the rest incrementally. Convention: every new string gets a tr+en key.

### File structure

- Create `src/lib/i18n/translations.ts` — `{ tr: {...}, en: {...} }` keyed string maps (start with the high-traffic keys; grows over time).
- Create `src/lib/i18n/LanguageProvider.tsx` — context holding `lang` + `setLang`, persisted in `tyro:settings` (extend `UserSettings.language: "tr"|"en"`, default `"tr"`); broadcasts via the existing settings event.
- Create `src/lib/i18n/useT.ts` — `useT()` returns `t(key) => translations[lang][key] ?? translations.tr[key] ?? key` plus `lang`/`setLang`.
- Create `src/components/layout/LanguageToggle.tsx` — TR/EN pill, `showLabel` prop (mirrors ThemeSwitcher), calls `setLang`.
- Modify `src/main.tsx` — wrap app in `<LanguageProvider>`.
- Modify `src/components/layout/AppSidebar.tsx` — render `<LanguageToggle showLabel={showLabels} />` right after `<ThemeSwitcher>`.
- Modify `src/lib/settings/userSettings.ts` — add `language` field + default.
- Modify `src/lib/ai/systemPrompt.ts` — add `TYRO_AI_SYSTEM_PROMPT_EN`; `src/lib/ai/buildContext.ts` + `TyroAiDrawer.tsx` select prompt/labels by `lang`.
- Modify high-traffic pages/components to use `t()`: `AppSidebar`, `AppShell` titles, `OverviewPage`, `ProjectsPage`, `PriceTrackingPage`, `PLCostPage`, `SettingsPage`, KPI tiles.

### Tasks

- [ ] **Task 4.1 — i18n core.** Create `translations.ts` (seed ~80 high-traffic keys, tr+en), `LanguageProvider.tsx`, `useT.ts`. Extend `userSettings.ts` with `language` (default `"tr"`). Wrap `main.tsx`. Verify: lint + build.
- [ ] **Task 4.2 — LanguageToggle in sidebar.** Build `LanguageToggle.tsx` (TR/EN pill, `showLabel`), slot after ThemeSwitcher in AppSidebar. Verify: lint + build + browser (toggle persists across reload).
- [ ] **Task 4.3 — Sidebar + shell strings.** Replace nav labels, group headers, AppShell `PAGE_TITLES`/`PAGE_TITLE_CONFIGS` with `t()`. Verify: toggle flips them live.
- [ ] **Task 4.4 — High-traffic pages.** Convert Overview, Projects, Price Tracking, PL Cost, Settings + their KPI tiles to `t()`. Add the keys to `translations.ts` (tr+en). Verify per page: toggle flips all visible text.
- [ ] **Task 4.5 — TYRO AI bilingual.** Add `TYRO_AI_SYSTEM_PROMPT_EN`; select prompt + context labels by `lang` so the assistant answers in the chosen language. Verify: ask a question in each mode.
- [ ] **Task 4.6 — Enforcement convention.** Document in CLAUDE.md: "All new user-facing strings go through `t()` with a tr+en key in `translations.ts`." (Optional later: a dev-time console.warn when `t()` hits a missing key.) Commit.
- [ ] **Task 4.7 — Incremental sweep (ongoing).** Remaining pages/components converted opportunistically; each PR adds its keys. Not blocking — tracked as follow-up.

---

## Self-review notes

- **Spec coverage:** P1 bug (IndexedDB+mirror+honest toast+fingerprint redirect) ✓; P2 responsive (4 tables, charts, grids, projects, drawers) ✓; P3 chat (unhide trigger + keyboard) ✓; P4 i18n (infra, toggle, AI, high-traffic pages, convention) ✓.
- **No test runner:** all "verify" steps are lint/build/manual — intentional, matches the repo.
- **Read-only invariant:** Phase 1 only changes the local-storage layer (IndexedDB is still local, not Dataverse); no new Dataverse writes anywhere.
- **Risk notes:** P1's async-boot hydration means a brief empty flash before data appears on first paint (acceptable; can add a splash gate if jarring). `SHIP_COLUMNS` trim intentionally dropped (IndexedDB makes it unnecessary; avoids the CLAUDE.md "locked columns" risk). Each phase is independently committable + deployable to both remotes.
