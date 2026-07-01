import * as React from "react";
import { translations, type Lang } from "./translations";

/**
 * App language context — TR/EN. Persisted under `tyro:lang` (own key,
 * mirroring the sidebar theme pattern in sidebar-context.tsx). Default is
 * ENGLISH for first-time visitors; the sidebar LanguageToggle flips it and
 * an explicit "tr" choice persists.
 *
 * `t(key)` resolves against the active language, falling back to Turkish,
 * then to the raw key (so an untranslated string is still readable).
 */

const STORAGE_KEY = "tyro:lang";

interface LanguageContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const LanguageContext = React.createContext<LanguageContextValue | null>(null);

function readLang(): Lang {
  // Default language is ENGLISH for first-time visitors. The stored
  // preference wins: only an explicit "tr" flips to Turkish, so once a
  // user picks Türkçe (LanguageToggle → setLang("tr")) it persists.
  if (typeof window === "undefined") return "en";
  return localStorage.getItem(STORAGE_KEY) === "tr" ? "tr" : "en";
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = React.useState<Lang>(() => readLang());

  // Keep <html lang> in sync with the active language. This is what drives
  // CSS `text-transform: uppercase` to pick the correct locale casing rules
  // app-wide: under lang="tr" the browser maps "i" → "İ" (dotted capital),
  // so English labels rendered uppercase came out as "PRİCE" etc. Setting
  // lang="en" makes "i" → "I" everywhere at once — the systematic fix that
  // replaces the per-element `lang="en"` overrides scattered across pages.
  React.useLayoutEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
    }
  }, [lang]);

  const setLang = React.useCallback((l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, l);
  }, []);

  const t = React.useCallback(
    (key: string): string =>
      translations[lang][key] ?? translations.tr[key] ?? key,
    [lang]
  );

  const value = React.useMemo<LanguageContextValue>(
    () => ({ lang, setLang, t }),
    [lang, setLang, t]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = React.useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }
  return ctx;
}

/** Shorthand for components that only need the translate function. */
export function useT(): (key: string) => string {
  return useLanguage().t;
}
