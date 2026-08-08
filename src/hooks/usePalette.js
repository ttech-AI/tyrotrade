import { useContext } from "react"
import { PaletteContext } from "@/providers/PaletteProvider"

export function usePalette() {
  const ctx = useContext(PaletteContext)
  if (!ctx) throw new Error("usePalette must be used within a PaletteProvider")
  return ctx
}
