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
};

export const translations: Record<Lang, StringMap> = { tr, en };
