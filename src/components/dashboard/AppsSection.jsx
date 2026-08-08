import { useMemo, useState } from "react"
import { AppCard } from "./AppCard"
import { CategoryFilter } from "./CategoryFilter"
import { useLocale } from "@/hooks/useLocale"
import { apps } from "@/data/apps"
import { categories } from "@/data/categories"

export function AppsSection() {
  const { t } = useLocale()
  const [activeCategory, setActiveCategory] = useState(null)

  const available = useMemo(() => {
    const ids = new Set(apps.map((a) => a.category))
    return categories.filter((c) => ids.has(c.id))
  }, [])

  const visible = activeCategory
    ? apps.filter((a) => a.category === activeCategory)
    : apps

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-semibold tracking-tight">{t("apps.title")}</h2>
        <CategoryFilter
          available={available}
          value={activeCategory}
          onChange={setActiveCategory}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {visible.map((app, i) => (
          <AppCard key={app.id} app={app} index={i} />
        ))}
      </div>
    </section>
  )
}
