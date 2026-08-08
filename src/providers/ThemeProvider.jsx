import { createContext, useCallback, useEffect, useMemo, useState } from "react"

const STORAGE_KEY = "tyrotrade-theme"
const VALID = ["light", "dark"]

export const ThemeContext = createContext(null)

function readInitial() {
  if (typeof window === "undefined") return "light"
  const saved = window.localStorage.getItem(STORAGE_KEY)
  if (VALID.includes(saved)) return saved
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readInitial)

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle("dark", theme === "dark")
    window.localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  // useCallback so the context value's setTheme / toggle references stay
  // stable. Without these, the useMemo below would still produce a new
  // object every render (since setTheme/toggle would be fresh closures),
  // defeating the memoization for every consumer.
  const setTheme = useCallback((next) => {
    setThemeState(VALID.includes(next) ? next : "light")
  }, [])
  const toggle = useCallback(() => {
    setThemeState((t) => (t === "dark" ? "light" : "dark"))
  }, [])

  // Memoize the context value object so the only reason consumers re-render
  // is an actual theme change, not a parent re-render of <ThemeProvider>.
  const value = useMemo(
    () => ({ theme, setTheme, toggle }),
    [theme, setTheme, toggle],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
