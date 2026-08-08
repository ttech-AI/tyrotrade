/**
 * Brand accent for the ported freight pages.
 *
 * Replaces tyrofreight's `useThemeAccent()`, which resolved three hardcoded
 * sidebar themes to literal hex. tyroTrade instead swaps `--brand-*` CSS
 * variables via the `data-palette` attribute across ~14 palettes, so the
 * accent must be expressed as CSS-var EXPRESSIONS, not resolved colors: the
 * browser then repaints on a palette or dark-mode change with zero React work.
 *
 * The returned shape is identical to the source's ThemeAccent, so all ~30
 * `accent.*` call sites in the ported tree needed nothing but an import swap.
 */
import { useEffect, useMemo, useState } from "react"

export interface BrandAccent {
  /** Single-color accent — left stripes, 1px borders, dots. */
  solid: string
  /** 3-stop gradient — avatar / button fills. */
  gradient: string
  /** Semi-transparent ring. */
  ring: string
  /** Stronger ring for hover / keyboard focus. */
  ringStrong: string
  /** Soft tint for selected rows and pills. */
  tint: string
  /** 3 distinct stops for multi-bucket charts (light → mid → deep). */
  stops: [string, string, string]
}

const CSS_VAR_ACCENT: BrandAccent = {
  solid: "var(--brand-text)",
  gradient:
    "linear-gradient(135deg, var(--brand-from) 0%, var(--brand-via) 55%, var(--brand-deep) 100%)",
  ring: "color-mix(in oklab, var(--brand-deep) 55%, transparent)",
  ringStrong: "color-mix(in oklab, var(--brand-deep) 85%, transparent)",
  tint: "color-mix(in oklab, var(--brand-via) 10%, transparent)",
  stops: ["var(--brand-from)", "var(--brand-via)", "var(--brand-deep)"],
}

/** CSS-driven accent. Prefer this everywhere the value lands in CSS. */
export function useBrandAccent(): BrandAccent {
  return CSS_VAR_ACCENT
}

/**
 * Resolve a `--brand-*` token to a concrete `rgb(...)` string.
 *
 * Needed by consumers that cannot accept CSS variables: MapLibre's paint
 * validator rejects both `var()` and `oklch()`, and recharts needs literal
 * colors for SVG fills. Resolution goes through the browser rather than string
 * parsing on purpose — tyroTrade's palettes MIX formats (ocean-breeze is
 * oklch, the default ocean-breeze-v2 is hex) and `getComputedStyle().color`
 * normalises both to rgb().
 */
export function resolveBrandVar(varName: string, fallback = "#0077b6"): string {
  if (typeof window === "undefined") return fallback
  const probe = document.createElement("span")
  probe.style.color = `var(${varName})`
  probe.style.display = "none"
  document.body.appendChild(probe)
  const resolved = getComputedStyle(probe).color
  probe.remove()
  return resolved || fallback
}

export interface ResolvedAccent {
  solid: string
  from: string
  via: string
  deep: string
  soft: string
  stops: [string, string, string]
}

export function resolveBrandAccent(): ResolvedAccent {
  const from = resolveBrandVar("--brand-from", "#48cae4")
  const via = resolveBrandVar("--brand-via", "#00b4d8")
  const deep = resolveBrandVar("--brand-deep", "#03045e")
  return {
    solid: resolveBrandVar("--brand-text", "#0077b6"),
    from,
    via,
    deep,
    soft: resolveBrandVar("--brand-soft", "#caf0f8"),
    stops: [from, via, deep],
  }
}

/**
 * Resolved accent that re-resolves when the user switches palette or theme.
 *
 * PaletteProvider sets `data-palette` and ThemeProvider toggles the `dark`
 * class, both on <html> — a MutationObserver on those two attributes is the
 * only reliable signal, since CSS-variable changes fire no event.
 */
export function useResolvedBrandAccent(): ResolvedAccent {
  const [accent, setAccent] = useState<ResolvedAccent>(() => resolveBrandAccent())

  useEffect(() => {
    const root = document.documentElement
    const observer = new MutationObserver(() => setAccent(resolveBrandAccent()))
    observer.observe(root, { attributes: true, attributeFilter: ["data-palette", "class"] })
    // Re-resolve once on mount: the first paint may have run before the
    // palette attribute was applied.
    setAccent(resolveBrandAccent())
    return () => observer.disconnect()
  }, [])

  return useMemo(() => accent, [accent])
}
