/**
 * Types for the JS `useLocale` hook, so the TypeScript pages ported from
 * tyrofreight can call `t(...)` with real checking. The runtime lives in
 * useLocale.js / providers/LocaleProvider.jsx; this only describes it.
 */
export type Locale = "tr" | "en" | "ru" | "ar"

export interface LocaleContextValue {
  locale: Locale
  setLocale: (next: Locale) => void
  /** Cycle to the next locale in LOCALES order. */
  toggle: () => void
  /**
   * Translate a key. Falls back to English, then to `fallback`, then to the
   * key itself. `vars` interpolates {name} placeholders.
   */
  t: {
    (key: string): string
    (key: string, fallback: string): string
    (key: string, vars: Record<string, string | number>): string
    (key: string, fallback: string, vars: Record<string, string | number>): string
  }
}

export function useLocale(): LocaleContextValue
