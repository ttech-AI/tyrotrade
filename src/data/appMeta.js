import pkg from "../../package.json"

export const appMeta = {
  name: "tyroTrade",
  brand: "tyroTrade · TTECH Business Solutions",
  parent: "Tiryaki Agro",
  version: pkg.version || "0.0.0",
  releaseDate: "2026",
  stack: ["React 19", "Vite 8", "Tailwind v4", "shadcn/ui"],
  iconLibrary: "Hugeicons",
}

export const localStorageRegistry = [
  {
    key: "tyrotrade-theme",
    labelKey: "settings.general.storage.theme",
    descriptionKey: "settings.general.storage.themeDescription",
  },
  {
    key: "tyrotrade-palette",
    labelKey: "settings.general.storage.palette",
    descriptionKey: "settings.general.storage.paletteDescription",
  },
  {
    key: "tyrotrade-locale",
    labelKey: "settings.general.storage.locale",
    descriptionKey: "settings.general.storage.localeDescription",
  },
  {
    key: "tyrotrade-config-v1",
    labelKey: "settings.general.storage.config",
    descriptionKey: "settings.general.storage.configDescription",
  },
  {
    // IndexedDB, not localStorage: the freight pages mirror whole Dataverse
    // entity sets here (see src/freight/lib/storage/entityCache.ts), which is
    // far past what localStorage can hold.
    key: "tyrotrade-freight-cache",
    labelKey: "settings.general.storage.freight",
    descriptionKey: "settings.general.storage.freightDescription",
  },
]
