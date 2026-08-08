import { createContext, useCallback, useEffect, useMemo, useState } from "react"
import { strings as tr } from "@/data/strings.tr"
import { strings as en } from "@/data/strings.en"
import { strings as ru } from "@/data/strings.ru"
import { strings as ar } from "@/data/strings.ar"

const STORAGE_KEY = "tyrotrade-locale"
const DICTIONARIES = { tr, en, ru, ar }
// Locales available in the picker. Order = display order in UI. toggle()
// cycles through this list in order — most callsites should call
// setLocale(id) through a dropdown so the user picks their actual language.
export const LOCALES = ["tr", "en", "ru", "ar"]
// Layout stays LTR for every locale (sidebar on the left, header tools on
// the right). Arabic text reads naturally right-to-left INSIDE its own
// containers via the browser's bidi algorithm — no `dir="rtl"` needed
// globally. Per user request: "arapçada sidebar filan yeri değiştirme
// sadece yazıları değiştir çeviri yap".
const DEFAULT = "en"

export const LocaleContext = createContext(null)

function readInitial() {
  if (typeof window === "undefined") return DEFAULT
  const saved = window.localStorage.getItem(STORAGE_KEY)
  return LOCALES.includes(saved) ? saved : DEFAULT
}

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState(readInitial)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, locale)
    document.documentElement.setAttribute("lang", locale)
    // dir always ltr — chrome layout (sidebar, header) stays in place across
    // all locales; Arabic text bidi-renders naturally inside its containers.
    document.documentElement.setAttribute("dir", "ltr")
  }, [locale])

  /**
   * t(key, fallbackOrVars?, vars?)
   *
   * Falls through to ENGLISH before giving up, so a key that only exists in
   * en/tr renders readable text under ru/ar instead of the raw key string
   * (the freight pages add several hundred keys and the ru/ar files trail).
   *
   * `vars` interpolates {name} placeholders — the ported freight strings use
   * them heavily, and doing it here keeps `.replace()` chains out of the call
   * sites.
   */
  const t = useCallback(
    (key, fallbackOrVars, maybeVars) => {
      const varsGiven = typeof fallbackOrVars === "object" && fallbackOrVars !== null
      const fallback = varsGiven ? undefined : fallbackOrVars
      const vars = varsGiven ? fallbackOrVars : maybeVars

      const dict = DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT]
      const value = dict[key] ?? DICTIONARIES.en[key] ?? fallback ?? key
      if (!vars) return value
      return String(value).replace(/\{(\w+)\}/g, (m, name) =>
        vars[name] != null ? String(vars[name]) : m,
      )
    },
    [locale],
  )

  const setLocale = useCallback(
    (next) => setLocaleState(LOCALES.includes(next) ? next : DEFAULT),
    [],
  )

  // Cycle through LOCALES in order. Kept for backward compat with the
  // single-tap header toggle pattern.
  const toggle = useCallback(
    () =>
      setLocaleState((l) => {
        const i = LOCALES.indexOf(l)
        return LOCALES[(i + 1) % LOCALES.length]
      }),
    [],
  )

  const value = useMemo(
    () => ({ locale, setLocale, toggle, t }),
    [locale, setLocale, toggle, t],
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}
