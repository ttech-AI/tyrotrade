import { useEffect } from "react"

export function useHotkey(combo, handler, { enabled = true } = {}) {
  useEffect(() => {
    if (!enabled) return undefined
    const parts = combo.toLowerCase().split("+")
    const wantMod = parts.includes("mod") || parts.includes("meta") || parts.includes("ctrl")
    const wantShift = parts.includes("shift")
    const wantAlt = parts.includes("alt")
    const key = parts[parts.length - 1]

    const onKeyDown = (event) => {
      const modPressed = event.metaKey || event.ctrlKey
      if (wantMod && !modPressed) return
      if (wantShift && !event.shiftKey) return
      if (wantAlt && !event.altKey) return
      if (event.key.toLowerCase() !== key) return
      event.preventDefault()
      handler(event)
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [combo, handler, enabled])
}
