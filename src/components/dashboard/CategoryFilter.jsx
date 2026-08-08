import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useLocale } from "@/hooks/useLocale"

export function CategoryFilter({ available, value, onChange }) {
  const { t, locale } = useLocale()
  const current = value ?? "all"

  return (
    <Tabs value={current} onValueChange={(v) => onChange(v === "all" ? null : v)}>
      <TabsList className="bg-muted/60">
        <TabsTrigger value="all" className="text-xs">
          {t("apps.filterAll")}
        </TabsTrigger>
        {available.map((c) => (
          <TabsTrigger key={c.id} value={c.id} className="text-xs">
            {c[locale] ?? c.tr}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
