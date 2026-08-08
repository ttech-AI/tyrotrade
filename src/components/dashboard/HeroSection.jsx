import { useLocale } from "@/hooks/useLocale"
import { currentUser } from "@/data/user"
import { apps } from "@/data/apps"
import { unreadCount } from "@/data/notifications"
import { formatLongDate } from "@/lib/date"

export function HeroSection() {
  const { t, locale } = useLocale()
  const summary = t("hero.summary")
    .replace("{apps}", String(apps.length))
    .replace("{notifs}", String(unreadCount))

  return (
    <section className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground capitalize">
        {formatLongDate(new Date(), locale)}
      </p>
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
        {t("hero.welcome")}, {currentUser.name}.
      </h1>
      <p className="text-sm text-muted-foreground max-w-xl">
        {t("hero.subtitle")} <span className="text-foreground/80">{summary}</span>
      </p>
    </section>
  )
}
