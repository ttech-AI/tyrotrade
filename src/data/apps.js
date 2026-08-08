import {
  SignatureIcon,
  Target02Icon,
  Package01Icon,
  CargoShipIcon,
  Telescope02Icon,
  AiChipIcon,
  Office365Icon,
  AiBrain02Icon,
  ChartHistogramIcon,
  DocumentValidationIcon,
} from "@hugeicons/core-free-icons"

export const apps = [
  // ---------- AI Uygulamaları ----------
  {
    id: "tyrosign",
    name: "tyroSign",
    group: "ai",
    category: "operations",
    description: { tr: "Dijital imza ve onay akışları", en: "Digital signing and approvals" },
    icon: SignatureIcon,
    url: "#",
    lastUsedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    id: "tyrostrategy",
    name: "tyroStrategy",
    group: "ai",
    category: "management",
    description: { tr: "Stratejik hedef ve aksiyon takibi", en: "Strategic goal and action tracking" },
    icon: Target02Icon,
    url: "#",
    lastUsedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
  },
  {
    id: "tyrostock",
    name: "tyroStock",
    group: "ai",
    category: "operations",
    description: { tr: "Stok ve envanter yönetimi · D365 FO", en: "Stock and inventory · D365 FO" },
    icon: Package01Icon,
    url: "#",
    lastUsedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  },
  {
    id: "tyrotrade",
    name: "tyroTrade",
    group: "ai",
    category: "trade",
    description: { tr: "Vessel ve trade operasyonları", en: "Vessel and trade operations" },
    icon: CargoShipIcon,
    url: "#",
    lastUsedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
  },
  {
    id: "tyroforecast",
    name: "tyroForecast",
    group: "ai",
    category: "forecast",
    description: { tr: "Talep ve satış tahminleme", en: "Demand and sales forecasting" },
    icon: Telescope02Icon,
    url: "#",
    lastUsedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  },
  {
    id: "tyro-aiops",
    name: "tyroAIOps",
    group: "ai",
    category: "it",
    description: { tr: "Merkezi IT operasyon platformu", en: "Central IT operations platform" },
    icon: AiChipIcon,
    url: "#",
    lastUsedAt: "new",
  },

  // ---------- İş Uygulamaları ----------
  {
    id: "d365-erp",
    name: "D365 ERP",
    group: "business",
    category: "erp",
    description: { tr: "Microsoft Dynamics 365 Finance & Operations", en: "Microsoft Dynamics 365 Finance & Operations" },
    icon: Office365Icon,
    url: "#",
    lastUsedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
  },
  {
    id: "tibot",
    name: "Tibot",
    group: "business",
    category: "automation",
    description: { tr: "Tiryaki kurumsal asistan", en: "Tiryaki enterprise assistant" },
    icon: AiBrain02Icon,
    url: "#",
    lastUsedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  },
  {
    id: "power-bi",
    name: "Power BI",
    group: "business",
    category: "analytics",
    description: { tr: "Kurumsal raporlama ve analiz", en: "Enterprise reporting and analytics" },
    icon: ChartHistogramIcon,
    url: "#",
    lastUsedAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
  },
  {
    id: "paperwork",
    name: "Paperwork",
    group: "business",
    category: "documents",
    description: { tr: "Belge ve evrak takibi", en: "Document and paperwork tracking" },
    icon: DocumentValidationIcon,
    url: "#",
    lastUsedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
]

export function getApp(id) {
  return apps.find((a) => a.id === id)
}

export function getAppsByGroup(group) {
  return apps.filter((a) => a.group === group)
}
