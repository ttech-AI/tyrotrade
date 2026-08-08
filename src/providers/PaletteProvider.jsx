import { createContext, useCallback, useEffect, useMemo, useState } from "react"
import { DEFAULT_PALETTE, palettes } from "@/data/palettes"

const STORAGE_KEY = "tyrotrade-palette"

const VALID = new Set(palettes.map((p) => p.id))

export const PaletteContext = createContext(null)

function readInitial() {
  if (typeof window === "undefined") return DEFAULT_PALETTE
  const saved = window.localStorage.getItem(STORAGE_KEY)
  return saved && VALID.has(saved) ? saved : DEFAULT_PALETTE
}

export function PaletteProvider({ children }) {
  const [palette, setPaletteState] = useState(readInitial)

  useEffect(() => {
    document.documentElement.setAttribute("data-palette", palette)
    window.localStorage.setItem(STORAGE_KEY, palette)
  }, [palette])

  const setPalette = useCallback(
    (id) => setPaletteState(VALID.has(id) ? id : DEFAULT_PALETTE),
    [],
  )

  const value = useMemo(
    () => ({ palette, setPalette, palettes }),
    [palette, setPalette],
  )

  return <PaletteContext.Provider value={value}>{children}</PaletteContext.Provider>
}
