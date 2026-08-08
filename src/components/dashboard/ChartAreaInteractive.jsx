import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import { useLocale } from "@/hooks/useLocale"
import { bcp47 } from "@/lib/intl-cache"
import { chartData } from "@/data/chartData"

export function ChartAreaInteractive() {
  const { locale, t } = useLocale()
  const isMobile = useIsMobile()
  const [timeRange, setTimeRange] = React.useState(() => (isMobile ? "7d" : "90d"))

  const chartConfig = {
    activity: { label: t("chart.activityLabel") },
    approvals: { label: t("chart.series.approvals"), color: "var(--chart-1)" },
    updates: { label: t("chart.series.updates"), color: "var(--chart-2)" },
  }

  const filteredData = React.useMemo(() => {
    const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90
    const ref = new Date(chartData[chartData.length - 1].date)
    const start = new Date(ref)
    start.setDate(start.getDate() - days)
    return chartData.filter((item) => new Date(item.date) >= start)
  }, [timeRange])

  const intlLocale = bcp47(locale)

  return (
    <Card className="@container/card">
      <CardHeader className="relative">
        <CardTitle>{t("chart.activity.title")}</CardTitle>
        <CardDescription>
          <span className="@[540px]/card:block hidden">{t("chart.activity.longDesc")}</span>
          <span className="@[540px]/card:hidden">{t("chart.activity.shortDesc")}</span>
        </CardDescription>
        <div className="absolute right-4 top-4">
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={(v) => v && setTimeRange(v)}
            variant="outline"
            className="@[767px]/card:flex hidden"
          >
            <ToggleGroupItem value="90d" className="h-8 px-2.5">
              {t("chart.range.90")}
            </ToggleGroupItem>
            <ToggleGroupItem value="30d" className="h-8 px-2.5">
              {t("chart.range.30")}
            </ToggleGroupItem>
            <ToggleGroupItem value="7d" className="h-8 px-2.5">
              {t("chart.range.7")}
            </ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger
              className="@[767px]/card:hidden flex w-40"
              aria-label={t("chart.range.90")}
            >
              <SelectValue placeholder={t("chart.range.90")} />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="90d" className="rounded-lg">{t("chart.range.90")}</SelectItem>
              <SelectItem value="30d" className="rounded-lg">{t("chart.range.30")}</SelectItem>
              <SelectItem value="7d" className="rounded-lg">{t("chart.range.7")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
          <AreaChart data={filteredData}>
            <defs>
              <linearGradient id="fillApprovals" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-approvals)" stopOpacity={1.0} />
                <stop offset="95%" stopColor="var(--color-approvals)" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="fillUpdates" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-updates)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-updates)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const d = new Date(value)
                return d.toLocaleDateString(intlLocale, { month: "short", day: "numeric" })
              }}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) =>
                    new Date(value).toLocaleDateString(intlLocale, { month: "short", day: "numeric" })
                  }
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="updates"
              type="natural"
              fill="url(#fillUpdates)"
              stroke="var(--color-updates)"
              stackId="a"
            />
            <Area
              dataKey="approvals"
              type="natural"
              fill="url(#fillApprovals)"
              stroke="var(--color-approvals)"
              stackId="a"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
