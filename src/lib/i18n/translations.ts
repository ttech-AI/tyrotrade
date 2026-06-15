/**
 * TR/EN string table for the app.
 *
 * Lightweight custom i18n (no react-i18next) — two languages, no
 * pluralization/ICU, so a flat key→string map per language is enough.
 *
 * CONVENTION (enforced going forward — see CLAUDE.md): every user-facing
 * string gets a key here with BOTH a `tr` and `en` entry. Components never
 * hardcode display text; they call `t("some.key")` from `useT()`. A missing
 * key falls back to the Turkish value, then to the raw key (so an untranslated
 * string is still readable, never blank).
 *
 * Default language is Turkish; the sidebar LanguageToggle flips to English.
 *
 * This table is seeded with the app chrome (sidebar nav + topbar titles) and
 * grows as pages are swept onto `t()`.
 */

export type Lang = "tr" | "en";

type StringMap = Record<string, string>;

const tr: StringMap = {
  /* nav groups */
  "navGroup.operations": "Operasyon",
  "navGroup.analysis": "Analiz",
  "navGroup.management": "Yönetim",
  "navGroup.system": "Sistem",

  /* nav items */
  "nav.overview": "Genel Bakış",
  "nav.dashboard": "Yönetici Paneli",
  "nav.projects": "Sefer Takibi",
  "nav.tradeCost": "Trade Cost",
  "nav.priceTracking": "Fiyat Takibi",
  "nav.dataManagement": "Veri Yönetimi",
  "nav.help": "Yardım",
  "nav.settings": "Ayarlar",

  /* sidebar controls */
  "sidebar.theme": "Tema",
  "sidebar.language": "Dil",
  "sidebar.pin": "Sidebar'ı sabitle",
  "sidebar.unpin": "Sabitlemeyi kaldır",

  /* topbar — small eyebrow label (kept as-is per page) */
  "eyebrow.dashboard": "Dashboard",
  "eyebrow.overview": "Genel Bakış",
  "eyebrow.projects": "Vessel Projects",
  "eyebrow.tradeCost": "Trade Cost",
  "eyebrow.priceTracking": "Fiyat Takibi",
  "eyebrow.dataManagement": "Veri Yönetimi",
  "eyebrow.settings": "Ayarlar",

  /* topbar — H1 headline + document/fallback titles */
  "title.dashboard": "Yönetici Paneli",
  "title.overview": "Gemi Projeleri Özeti",
  "title.projects": "Sefer Takibi",
  "title.tradeCost": "Tahmini × Gerçekleşen Maliyet",
  "title.priceTracking": "İndikatif Navlun Fiyatları",
  "title.dataManagement": "Dataverse Inspector",
  "title.settings": "Uygulama Tercihleri",
  "title.app": "tyroFreight",

  /* misc shell */
  "app.tagline": "Freight Operations",
  "topbar.search": "Ara",
  "topbar.openMenu": "Menüyü aç",

  /* ── Fiyat Takibi / Price Analysis ── */
  "common.all": "Hepsi",
  "ft.search.label": "Ara",
  "ft.search.placeholder": "Rota, kargo, gemi…",
  "ft.search.clear": "Aramayı temizle",
  "ft.period.all": "Tümü",
  "ft.period.allTitle": "Tüm geçerlilik dönemleri",
  "ft.period.fy": "Mali yıl",
  "ft.period.thisYear": "(bu yıl)",
  "ft.clear": "Temizle",
  "ft.refresh": "Yenile",
  "ft.refreshing": "Yükleniyor…",
  "ft.refresh.sub": "Navlun fiyatlarını Dataverse'ten tekrar çek",
  "ft.meta.lanes": "hat",
  "ft.meta.quotes": "teklif",
  "ft.meta.within": "içinden",
  "ft.meta.updated": "Son güncelleme",
  "ft.filter.loadingPort": "Yükleme Limanı",
  "ft.filter.dischargePort": "Boşaltma Limanı",
  "ft.filter.vesselType": "Gemi Tipi",
  "ft.filter.shipClass": "Gemi Sınıfı",
  "ft.filter.cargo": "Kargo",
  "ft.filter.searchPort": "Liman ara...",
  "ft.filter.searchVesselType": "Gemi tipi ara...",
  "ft.filter.searchShipClass": "Sınıf ara...",
  "ft.filter.searchCargo": "Kargo ara...",
  "ft.state.loadingTitle": "Navlun fiyatları yükleniyor…",
  "ft.state.stage.headers": "Rota başlıkları çekiliyor",
  "ft.state.stage.details": "Fiyat satırları çekiliyor",
  "ft.state.stage.join": "Rotalar fiyatlarla eşleştiriliyor",
  "ft.state.connecting": "Bağlanılıyor",
  "ft.state.records": "kayıt",
  "ft.state.emptyTitle": "İndikatif Navlun Fiyatları",
  "ft.state.emptyBody":
    "Rota başlıkları ve fiyat satırları Dataverse'ten çekilip birleştirilir; her rota + gemi sınıfı için güncel oran ve trend gösterilir. Sonuç önbelleğe alınır — tekrar açıldığında anında gelir.",
  "ft.state.loadCta": "Navlun fiyatlarını yükle",
  "ft.state.noData": "Canlı veri kaynağına ulaşılamadı.",
  "ft.state.goToData": "Veri Yönetimi'ne git",
  "ft.state.mockTitle": "Canlı veri gerekiyor",
  "ft.state.mockBody":
    "Fiyat Takibi yalnızca gerçek Dataverse verisiyle çalışır — bu entity'lerin mock karşılığı yok. Gerçek moda geçip giriş yaptığında navlun fiyatları otomatik yüklenir.",
  "ft.state.errorTitle": "Veri çekilemedi",
  "ft.state.retry": "Tekrar dene",
};

const en: StringMap = {
  "navGroup.operations": "Operations",
  "navGroup.analysis": "Analysis",
  "navGroup.management": "Management",
  "navGroup.system": "System",

  "nav.overview": "Overview",
  "nav.dashboard": "Executive Panel",
  "nav.projects": "Vessel Ops",
  "nav.tradeCost": "Trade Cost",
  "nav.priceTracking": "Price Analysis",
  "nav.dataManagement": "Data Management",
  "nav.help": "Help",
  "nav.settings": "Settings",

  "sidebar.theme": "Theme",
  "sidebar.language": "Language",
  "sidebar.pin": "Pin sidebar",
  "sidebar.unpin": "Unpin sidebar",

  "eyebrow.dashboard": "Dashboard",
  "eyebrow.overview": "Overview",
  "eyebrow.projects": "Vessel Projects",
  "eyebrow.tradeCost": "Trade Cost",
  "eyebrow.priceTracking": "Price Analysis",
  "eyebrow.dataManagement": "Data Management",
  "eyebrow.settings": "Settings",

  "title.dashboard": "Executive Panel",
  "title.overview": "Vessel Projects Overview",
  "title.projects": "Vessel Ops",
  "title.tradeCost": "Estimated × Realized Cost",
  "title.priceTracking": "Indicative Freight Prices",
  "title.dataManagement": "Dataverse Inspector",
  "title.settings": "Application Preferences",
  "title.app": "tyroFreight",

  "app.tagline": "Freight Operations",
  "topbar.search": "Search",
  "topbar.openMenu": "Open menu",

  /* ── Fiyat Takibi / Price Analysis ── */
  "common.all": "All",
  "ft.search.label": "Search",
  "ft.search.placeholder": "Route, cargo, vessel…",
  "ft.search.clear": "Clear search",
  "ft.period.all": "All",
  "ft.period.allTitle": "All validity periods",
  "ft.period.fy": "Financial year",
  "ft.period.thisYear": "(this year)",
  "ft.clear": "Clear",
  "ft.refresh": "Refresh",
  "ft.refreshing": "Loading…",
  "ft.refresh.sub": "Re-fetch freight prices from Dataverse",
  "ft.meta.lanes": "lanes",
  "ft.meta.quotes": "quotes",
  "ft.meta.within": "of",
  "ft.meta.updated": "Last updated",
  "ft.filter.loadingPort": "Loading Port",
  "ft.filter.dischargePort": "Discharge Port",
  "ft.filter.vesselType": "Vessel Type",
  "ft.filter.shipClass": "Ship Class",
  "ft.filter.cargo": "Cargo",
  "ft.filter.searchPort": "Search port...",
  "ft.filter.searchVesselType": "Search vessel type...",
  "ft.filter.searchShipClass": "Search class...",
  "ft.filter.searchCargo": "Search cargo...",
  "ft.state.loadingTitle": "Loading freight prices…",
  "ft.state.stage.headers": "Fetching route headers",
  "ft.state.stage.details": "Fetching price lines",
  "ft.state.stage.join": "Matching routes to prices",
  "ft.state.connecting": "Connecting",
  "ft.state.records": "records",
  "ft.state.emptyTitle": "Indicative Freight Prices",
  "ft.state.emptyBody":
    "Route headers and price lines are fetched from Dataverse and joined; each route + ship class shows its current rate and trend. The result is cached — instant on the next visit.",
  "ft.state.loadCta": "Load freight prices",
  "ft.state.noData": "Couldn't reach the live data source.",
  "ft.state.goToData": "Go to Data Management",
  "ft.state.mockTitle": "Live data required",
  "ft.state.mockBody":
    "Price Analysis works only with real Dataverse data — these entities have no mock equivalent. Switch to real mode and sign in, and freight prices load automatically.",
  "ft.state.errorTitle": "Couldn't fetch data",
  "ft.state.retry": "Try again",
};

export const translations: Record<Lang, StringMap> = { tr, en };
