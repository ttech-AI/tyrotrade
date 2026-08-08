import * as HugeIcons from "@hugeicons/core-free-icons"

const allEntries = Object.entries(HugeIcons).filter(
  ([name, value]) => name.endsWith("Icon") && Array.isArray(value),
)

export const iconRegistry = Object.fromEntries(allEntries)

export const iconNames = allEntries.map(([name]) => name).sort()

export function getIconByName(name) {
  if (!name) return null
  return iconRegistry[name] ?? null
}

export function searchIcons(query, limit = 150) {
  const q = (query || "").trim().toLowerCase().replace(/icon$/, "")
  if (!q) return iconNames.slice(0, limit)
  const results = []
  for (const name of iconNames) {
    if (name.toLowerCase().includes(q)) {
      results.push(name)
      if (results.length >= limit) break
    }
  }
  return results
}
