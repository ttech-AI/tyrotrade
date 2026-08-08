// Shared per-locale Intl.DateTimeFormat cache.
//
// Why a cache: Intl constructors allocate dozens of objects per call. In hot
// paths (every chat message render, the DateTimePill ticking each minute,
// every activity card on the dashboard) the wasted allocations add up.
// `new Intl.DateTimeFormat(...)` cannot be hoisted to module scope because
// the locale is runtime-variable (TR ↔ EN toggle), so we cache one formatter
// per { locale, options } combination instead. Formatters are immutable, so
// reuse is always safe.

const formatters = new Map()

// Map our short locale codes to BCP-47 tags. Used by every Intl.* lookup
// AND by the Web Speech APIs (recognizer + synthesis) — exported so other
// modules can stay in sync with one mapping. Add new locales here when
// they get a strings file.
const BCP47 = {
  tr: "tr-TR",
  en: "en-US",
  ru: "ru-RU",
  ar: "ar-SA",
}

export function bcp47(locale) {
  return BCP47[locale] || "en-US"
}

/**
 * Return a cached Intl.DateTimeFormat for the given locale + options. The
 * cache key is the JSON-stringified options + locale; identical options
 * objects with different key order will produce different keys, so always
 * pass a literal with consistent ordering at call sites.
 *
 * @param {"tr"|"en"|string} locale
 * @param {Intl.DateTimeFormatOptions} options
 * @returns {Intl.DateTimeFormat}
 */
export function getDateTimeFormat(locale, options) {
  const key = locale + "|" + JSON.stringify(options)
  let f = formatters.get(key)
  if (!f) {
    f = new Intl.DateTimeFormat(bcp47(locale), options)
    formatters.set(key, f)
  }
  return f
}
