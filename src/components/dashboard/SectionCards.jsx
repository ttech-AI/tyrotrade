import { HugeiconsIcon } from "@hugeicons/react"
import { ChartIncreaseIcon, ChartDecreaseIcon } from "@hugeicons/core-free-icons"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useLocale } from "@/hooks/useLocale"
import { stats } from "@/data/stats"
import { apps, getApp } from "@/data/apps"

const trendByStat = {
  "pending-approvals": {
    delta: "+12.5%",
    direction: "up",
    noteKey: "stats.trend.pendingApprovals.note",
    subKey: "stats.trend.pendingApprovals.sub",
  },
  "active-goals": {
    delta: "+4.5%",
    direction: "up",
    noteKey: "stats.trend.activeGoals.note",
    subKey: "stats.trend.activeGoals.sub",
  },
  "open-shifts": {
    delta: "-20%",
    direction: "down",
    noteKey: "stats.trend.openShifts.note",
    subKey: "stats.trend.openShifts.sub",
  },
}

const cards = [
  ...stats.map((s) => {
    const trend = trendByStat[s.id]
    const app = getApp(s.sourceAppId)
    return {
      titleKey: s.labelKey,
      value: s.value,
      delta: trend?.delta ?? "",
      direction: trend?.direction ?? "up",
      noteKey: trend?.noteKey ?? "",
      subKey: trend?.subKey ?? "",
      sourceApp: app?.name ?? "",
    }
  }),
  {
    titleKey: "stats.totalApps",
    value: apps.length,
    delta: "+1",
    direction: "up",
    noteKey: "stats.trend.totalApps.note",
    subKey: "stats.trend.totalApps.sub",
    sourceApp: "tyroTrade",
  },
]

export function SectionCards() {
  const { t } = useLocale()
  return (
    <div className="*:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4 grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-brand-from/8 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card lg:px-6">
      {cards.map((c, i) => {
        const trendIcon = c.direction === "up" ? ChartIncreaseIcon : ChartDecreaseIcon
        return (
          <Card key={i} className="@container/card">
            <CardHeader className="relative">
              <CardDescription>{t(c.titleKey, c.titleKey)}</CardDescription>
              <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
                {c.value}
              </CardTitle>
              {c.delta && (
                <div className="absolute right-4 top-4">
                  <Badge variant="outline" className="flex gap-1 rounded-lg text-xs">
                    <HugeiconsIcon icon={trendIcon} className="size-3" />
                    {c.delta}
                  </Badge>
                </div>
              )}
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1 text-sm">
              <div className="line-clamp-1 flex gap-2 font-medium">
                {c.noteKey && t(c.noteKey)} <HugeiconsIcon icon={trendIcon} className="size-4" />
              </div>
              <div className="text-muted-foreground">{c.subKey && t(c.subKey)}</div>
            </CardFooter>
          </Card>
        )
      })}
    </div>
  )
}
