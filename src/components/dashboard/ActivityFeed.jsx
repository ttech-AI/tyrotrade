import { Card } from "@/components/ui/card"
import { ActivityItem } from "./ActivityItem"
import { useLocale } from "@/hooks/useLocale"
import { activities } from "@/data/activities"

export function ActivityFeed() {
  const { t } = useLocale()
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">{t("activity.title")}</h2>
        <button
          type="button"
          className="text-xs font-medium text-muted-foreground hover:text-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          {t("notif.viewAll")}
        </button>
      </div>
      <Card className="p-1.5 gap-0 border-border/60 bg-card">
        <ul className="divide-y divide-border/30">
          {activities.map((a) => (
            <ActivityItem key={a.id} activity={a} />
          ))}
        </ul>
      </Card>
    </section>
  )
}
