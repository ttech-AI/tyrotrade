// One-time client-side migration. 2026-08-08: app defaults changed (locale
// tr→en, palette fiesta→ocean-breeze-v2). The providers persist their CURRENT
// value to localStorage on every boot, so any browser that visited before the
// change carries the old defaults around as if the user had chosen them — the
// new defaults would never surface there. Bumping VERSION clears the persisted
// locale/palette ONCE; from then on preferences persist normally. Theme is
// deliberately left alone (its default didn't change; a chosen dark mode
// should survive).
const VERSION_KEY = "tyrotrade-defaults-v"
const VERSION = "2"

export function applyDefaultsMigration() {
  try {
    if (window.localStorage.getItem(VERSION_KEY) === VERSION) return
    window.localStorage.removeItem("tyrotrade-palette")
    window.localStorage.removeItem("tyrotrade-locale")
    window.localStorage.setItem(VERSION_KEY, VERSION)
  } catch {
    // storage unavailable — providers fall back to the new defaults anyway
  }
}
