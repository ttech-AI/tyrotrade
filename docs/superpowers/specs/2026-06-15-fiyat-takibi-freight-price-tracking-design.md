# Fiyat Takibi (Indicative Freight Price Tracking) — Design

**Date:** 2026-06-15 · **Status:** approved, building · **Route:** `/price-tracking` · **Nav:** Analiz group · **UI label:** "Fiyat Takibi"

## Goal

New sidebar page that lists/analyses **indicative freight prices** by joining two Dataverse virtual entities. Inspired by the Power BI actual + indicative freight reports, but cleaner: one row per lane with current rate + trend, expandable to history (Power BI repeats each route dozens of times).

## Confirmed decisions

1. **Grid view:** current rate per lane + sparkline trend; expand row → historical quote windows.
2. **Lane grain:** route + ship-size class (e.g. `Santos → Umm Qasr · Ultramax`). No "market" field exists; this derives Power BI's "(Ultra)" lane concept.
3. **Data mode:** real Dataverse only. Mock mode shows an empty state (no fabricated freight data).
4. **Scope:** indicative only (these two entities). The two Power BIs are visual inspiration only.

## Source entities

- **`mserp_tryaifreightpriceheaderentities`** (route headers) — use: `mserp_headerrecid` (join key), `mserp_loadingportnew`, `mserp_dischargingportnew`, `mserp_durationdays`, `mserp_distance`.
- **`mserp_tryaifreightpricedetailentities`** (price lines, joined via `mserp_headerrecid`) — use: `mserp_validitystartdate`, `mserp_validityfinishdate`, `mserp_vesseltypename`, `mserp_shipsizecategory`, `mserp_cargogoodname`, `mserp_freightprice` (min), `mserp_maxfreightprice`, `mserp_currencycode`, `mserp_mintonage`, `mserp_maxtonage`, `mserp_loadingratestr`, `mserp_loadingrateterm`, `mserp_dischargeratestr`, `mserp_dischargerateterm`, `mserp_stowagefactor`, `mserp_laycanfrom`, `mserp_laycanto`, `mserp_notes`, `mserp_freightcargotype`, `mserp_loadingpartyname`, `mserp_dischargingpartyname`, `mserp_tryshipoperationpackagetype`, `mserp_linenumber`.

## Data approach — self-contained synthetic-cache pipeline

`lib/dataverse/freightPrices.ts`: fetch all headers (`listAll`, small) + all detail lines (`listAll`, paginated), join by `mserp_headerrecid` in-memory → trimmed `FreightRow[]` → cache under synthetic key `tyro:dv:freightPriceRows`. NOT in the global refresh chain. `writeCache` is quota-guarded (`{ok, reason}`); on overflow fall back to in-memory for the session. Both raw entities also registered in the Veri Yönetimi inspector for independent debugging.

`hooks/useFreightPrices.ts`: hydrate from cache (fingerprint pattern), expose `rows / isFetching / fetchedAt / error / refetch`. **Auto-fetch on first visit when cache empty** (fetch is light: 2 calls), else read cache + manual `Yenile`. Falls back to manual-only if volume proves large.

## Domain model — `lib/selectors/freight.ts`

- **`FreightRow`** — one detail line enriched with header ports + distance/duration. The join unit.
- **`FreightLane`** — rows grouped by route + ship-size class. Derives per lane:
  - **current quote** — window containing today; else most-recent past (flagged stale).
  - **Δ% momentum** — current vs previous window price.
  - **trend series** — `freightPrice` over `validityStart` (sparkline + line chart).

## Page layout (`pages/PriceTrackingPage.tsx`) — mirrors Trade Cost skeleton

- **Toolbar** (GlassPanel strong): quick-filter comboboxes + search box + AdvancedFilter + Yenile.
- **5 KPI tiles:** Aktif Hat · Ortalama Güncel Navlun (USD/ton, +min–max) · En Pahalı Hat · En Ucuz Hat · Piyasa Yönü (net rising vs falling).
- **2 charts:** Navlun Trend (recharts LineChart, price over validity windows, min/max band — NEW chart type for the app) · Hat Bazında Güncel Navlun Top 10 (horizontal bars).
- **Grid (FreightTable):** one row per lane — Hat (route + ship-class chip) · Gemi Tipi · Kargo · Güncel Navlun (min–max + currency) · Trend (sparkline + Δ%) · Geçerlilik · Tonaj · Yükleme Oranı+Terim · Tahliye Oranı+Terim. Expand → historical quotes. Sortable (PLCostTable pattern).
- **Detail panel (slide-in):** full lane profile — ports + distance/duration, big current rate, complete quote history, all attrs (stowage, laycan, party names, cargo type, package type, notes), per-lane trend chart.

## Filters — `lib/filters/freightFilters.ts` (lightweight, parallel to projectFilters)

`FreightFilterState`: `period` + `fyKey` (validity-window overlap), `loadingPorts`, `dischargePorts`, `vesselTypes`, `shipSizeCategories`, `cargoGoods`, `currencies`, `search` (route/cargo/notes). Functions: `makeEmptyFreightFilters`, `applyFreightFilter`, `extractFreightOptions`, `freightFilterCount`. Reuses `PeriodFilter`, `MultiSelectCombobox`, `financialPeriod.ts`. Does NOT reuse `ProjectFilterState` (different domain).

## Files

**New:** `pages/PriceTrackingPage.tsx`, `lib/dataverse/freightPrices.ts`, `lib/dataverse/freightTypes.ts`, `hooks/useFreightPrices.ts`, `lib/filters/freightFilters.ts`, `lib/selectors/freight.ts`, `components/freight/{FreightKpiTiles, FreightTrendChart, FreightTopLanesChart, FreightQuickFilters, FreightTable, FreightDetailPanel, FreightEmptyState}.tsx`

**Touch:** `App.tsx` (lazy route), `components/layout/AppSidebar.tsx` (Analiz nav item), `lib/dataverse/columnOrder.ts` + `entityConfig.ts` + `fieldLabels.ts` (register both entities).

## Verification

No test runner. Contract = `npm run lint` (tsc --noEmit) + `npm run build` (tsc -b + vite). Both pass. User previews in their own browser under real Dataverse login (live auth needs refresh — token expired, so the live fetch+join was NOT verified against real rows; logic is type-checked only). Read-only invariant preserved: only `list()/listAll()`, only `writeCache` to localStorage.

## As-built deltas (vs. plan)

- **Inspector registration DEFERRED.** `columnOrder.ts` / `entityConfig.ts` / `fieldLabels.ts` were NOT touched — the Veri Yönetimi inspector is hardcoded per-entity (not config-driven), so adding two raw tabs is a separate, larger change. The `$select` lists live co-located in `freightPrices.ts`. Offered as a follow-up.
- **Currency quick-filter** dropped from the toolbar UI (kept in `FreightFilterState` for future); 5 comboboxes shown (Yükleme/Boşaltma Limanı, Gemi Tipi, Gemi Sınıfı, Kargo) + free-text search + period chips.
- **Route is OPEN** (no `RestrictedRoute`), unlike Trade Cost. Easy to gate later if freight rates should be email-allowlisted.
- Added `formatFreightRate` to `lib/format.ts`; states bundled in `FreightStates.tsx`; `FreightSparkline.tsx` added for table/panel inline trends.
