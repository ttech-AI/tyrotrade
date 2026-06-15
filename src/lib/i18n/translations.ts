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
  "common.noData": "veri yok",
  "common.days": "gün",
  /* KPI tiles */
  "ft.kpi.activeLanes": "Aktif Hat",
  "ft.kpi.lanesTotal": "hattan",
  "ft.kpi.avg": "Ortalama Güncel Navlun",
  "ft.kpi.priciest": "En Pahalı Hat",
  "ft.kpi.cheapest": "En Ucuz Hat",
  "ft.kpi.momentum": "Piyasa Yönü",
  "ft.kpi.formula": "Formül",
  "ft.kpi.activeLanes.t": "Aktif Hat Sayısı",
  "ft.kpi.activeLanes.b":
    "Bugün geçerli (validity penceresi bugünü kapsayan) bir teklifi olan rota+gemi sınıfı hatlarının sayısı. Parantezdeki toplam, geçmiş/gelecek teklifleri de dahil tüm hat sayısıdır. Aradaki fark, şu an fiyat kotası olmayan (boşta) hatları gösterir.",
  "ft.kpi.activeLanes.f": "count(hat: güncel teklif bugünü kapsıyor)",
  "ft.kpi.avg.b":
    "Fiyatı olan tüm hatların güncel navlununun ortalaması, baskın para biriminde (ton başına). Farklı para birimleri tek eksende karışmasın diye yalnızca en sık görülen para biriminin hatları ortalamaya katılır.",
  "ft.kpi.avg.f": "ort(hat.güncelFiyat | para birimi = baskın)",
  "ft.kpi.priciest.b":
    "Güncel navlunu en yüksek olan hat (baskın para birimi içinde). Maliyet baskısının en yoğun olduğu rotayı işaret eder — alt satırda rota adı yer alır.",
  "ft.kpi.priciest.f": "arg max hat.güncelFiyat",
  "ft.kpi.cheapest.b":
    "Güncel navlunu en düşük olan hat (baskın para birimi içinde). En uygun maliyetli rotayı gösterir — alt satırda rota adı yer alır.",
  "ft.kpi.cheapest.f": "arg min hat.güncelFiyat",
  "ft.kpi.momentum.t": "Piyasa Yönü (Momentum)",
  "ft.kpi.momentum.b":
    "Her hattın güncel teklifi bir önceki geçerlilik penceresine göre yükseldi mi düştü mü? Net = yükselen − düşen. Pozitif değer piyasanın genel olarak sertleştiğini, negatif değer yumuşadığını gösterir. ±%0,5 altı değişim 'yatay' sayılır.",
  "ft.kpi.momentum.f": "yükselen − düşen (Δ%, pencere bazında)",
  /* Table */
  "ft.col.lane": "Hat",
  "ft.col.currentRate": "Güncel Navlun",
  "ft.col.trend": "Trend",
  "ft.col.validity": "Geçerlilik",
  "ft.col.tonnage": "Tonaj",
  "ft.col.loading": "Yükleme",
  "ft.col.discharge": "Tahliye",
  "ft.col.mixed": "+karma",
  "ft.col.stale": "geçmiş",
  "ft.col.showHistory": "Geçmişi göster",
  "ft.col.hideHistory": "Geçmişi gizle",
  "ft.col.openDetail": "detay için tıkla",
  "ft.table.empty": "Filtreye uyan hat yok.",
  "ft.table.sort": "Sırala",
  "ft.sort.route": "Rota",
  "ft.sort.price": "Fiyat",
  "ft.sort.trend": "Trend",
  "ft.sort.date": "Tarih",
  /* Charts */
  "ft.chart.trend": "Navlun Trend",
  "ft.chart.trend.subA": "Aylık ortalama",
  "ft.chart.trend.subB": "min–maks bandı",
  "ft.chart.noTrend": "Trend için yeterli veri yok",
  "ft.chart.avg": "Ortalama",
  "ft.chart.min": "En düşük",
  "ft.chart.max": "En yüksek",
  "ft.chart.topLanes": "Hat Bazında Güncel Navlun",
  "ft.chart.topLanes.subA": "En pahalı",
  "ft.chart.topLanes.subB": "hat · ton başına",
  "ft.chart.noLanes": "Fiyatlı hat bulunamadı",
  "ft.chart.current": "Güncel",
  /* Detail panel */
  "ft.panel.route": "Rota Bilgisi",
  "ft.panel.currentQuote": "Güncel Teklif Detayı",
  "ft.panel.history": "Teklif Geçmişi",
  "ft.panel.stale": "son bilinen (güncel değil)",
  "ft.panel.noQuote": "Geçerli teklif yok",
  "ft.panel.close": "Kapat",
  "ft.field.distance": "Mesafe",
  "ft.field.duration": "Süre",
  "ft.field.cargoType": "Kargo Tipi",
  "ft.field.stowage": "İstif Faktörü",
  "ft.field.loadingRate": "Yükleme Oranı",
  "ft.field.dischargeRate": "Tahliye Oranı",
  "ft.field.laycan": "Laycan",
  "ft.field.parties": "Taraflar",
  "ft.field.packageType": "Paket Tipi",
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
  "common.noData": "no data",
  "common.days": "days",
  /* KPI tiles */
  "ft.kpi.activeLanes": "Active Lanes",
  "ft.kpi.lanesTotal": "total",
  "ft.kpi.avg": "Average Current Rate",
  "ft.kpi.priciest": "Priciest Lane",
  "ft.kpi.cheapest": "Cheapest Lane",
  "ft.kpi.momentum": "Market Direction",
  "ft.kpi.formula": "Formula",
  "ft.kpi.activeLanes.t": "Active Lane Count",
  "ft.kpi.activeLanes.b":
    "Number of route + ship-class lanes with a quote effective today (validity window covers today). The total in parentheses counts all lanes including past/future quotes. The gap shows lanes with no current quote (idle).",
  "ft.kpi.activeLanes.f": "count(lane: current quote covers today)",
  "ft.kpi.avg.b":
    "Average current rate across all priced lanes, in the dominant currency (per ton). Only lanes in the most common currency are averaged so different currencies don't mix on one axis.",
  "ft.kpi.avg.f": "avg(lane.currentRate | currency = dominant)",
  "ft.kpi.priciest.b":
    "The lane with the highest current rate (within the dominant currency). Points to the route under the most cost pressure — the route name is in the sub-line.",
  "ft.kpi.priciest.f": "arg max lane.currentRate",
  "ft.kpi.cheapest.b":
    "The lane with the lowest current rate (within the dominant currency). Shows the most cost-effective route — the route name is in the sub-line.",
  "ft.kpi.cheapest.f": "arg min lane.currentRate",
  "ft.kpi.momentum.t": "Market Direction (Momentum)",
  "ft.kpi.momentum.b":
    "Did each lane's current quote rise or fall vs the previous validity window? Net = rising − falling. Positive means the market is firming overall, negative means softening. Changes under ±0.5% count as 'flat'.",
  "ft.kpi.momentum.f": "rising − falling (Δ%, per window)",
  /* Table */
  "ft.col.lane": "Lane",
  "ft.col.currentRate": "Current Rate",
  "ft.col.trend": "Trend",
  "ft.col.validity": "Validity",
  "ft.col.tonnage": "Tonnage",
  "ft.col.loading": "Loading",
  "ft.col.discharge": "Discharge",
  "ft.col.mixed": "+mixed",
  "ft.col.stale": "past",
  "ft.col.showHistory": "Show history",
  "ft.col.hideHistory": "Hide history",
  "ft.col.openDetail": "click for detail",
  "ft.table.empty": "No lanes match the filter.",
  "ft.table.sort": "Sort",
  "ft.sort.route": "Route",
  "ft.sort.price": "Price",
  "ft.sort.trend": "Trend",
  "ft.sort.date": "Date",
  /* Charts */
  "ft.chart.trend": "Freight Trend",
  "ft.chart.trend.subA": "Monthly average",
  "ft.chart.trend.subB": "min–max band",
  "ft.chart.noTrend": "Not enough data for a trend",
  "ft.chart.avg": "Average",
  "ft.chart.min": "Lowest",
  "ft.chart.max": "Highest",
  "ft.chart.topLanes": "Current Rate by Lane",
  "ft.chart.topLanes.subA": "Top",
  "ft.chart.topLanes.subB": "lanes · per ton",
  "ft.chart.noLanes": "No priced lanes found",
  "ft.chart.current": "Current",
  /* Detail panel */
  "ft.panel.route": "Route Info",
  "ft.panel.currentQuote": "Current Quote Detail",
  "ft.panel.history": "Quote History",
  "ft.panel.stale": "last known (not current)",
  "ft.panel.noQuote": "No current quote",
  "ft.panel.close": "Close",
  "ft.field.distance": "Distance",
  "ft.field.duration": "Duration",
  "ft.field.cargoType": "Cargo Type",
  "ft.field.stowage": "Stowage Factor",
  "ft.field.loadingRate": "Loading Rate",
  "ft.field.dischargeRate": "Discharge Rate",
  "ft.field.laycan": "Laycan",
  "ft.field.parties": "Parties",
  "ft.field.packageType": "Package Type",
};

export const translations: Record<Lang, StringMap> = { tr, en };
