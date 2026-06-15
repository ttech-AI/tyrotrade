import * as React from "react";
import { translations, type Lang } from "./translations";

/**
 * App language context — TR/EN. Persisted under `tyro:lang` (own key,
 * mirroring the sidebar theme pattern in sidebar-context.tsx). Default is
 * Turkish; the sidebar LanguageToggle flips it.
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
  if (typeof window === "undefined") return "tr";
  return localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "tr";
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = React.useState<Lang>(() => readLang());

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
