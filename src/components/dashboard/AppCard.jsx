import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowUpRight01Icon, Clock01Icon, Bookmark01Icon } from "@hugeicons/core-free-icons"
import { motion } from "motion/react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useLocale } from "@/hooks/useLocale"
import { getCategory, categoryTones } from "@/data/categories"
import { formatRelative } from "@/lib/date"
import { cn, safeExternalUrl } from "@/lib/utils"

export function AppCard({ app, index = 0 }) {
  const { t, locale } = useLocale()
  const category = getCategory(app.category)
  const tones = categoryTones[category?.tone] ?? categoryTones.cyan
  const description = app.description[locale] ?? app.description.tr

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: index * 0.04, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -3 }}
      className="group"
    >
      <Card className="relative h-full p-5 gap-4 border-border/60 bg-card transition-all duration-200 hover:shadow-lg hover:border-border focus-within:ring-2 focus-within:ring-ring">
        <div className="flex items-start justify-between gap-3">
          <div className={cn("grid size-11 place-items-center rounded-xl", tones.icon)}>
            <HugeiconsIcon icon={app.icon} size={22} strokeWidth={1.5} />
          </div>
          <Badge variant="outline" className={cn("text-[10px] font-medium px-2 py-0.5", tones.badge)}>
            {category?.[locale] ?? category?.tr}
          </Badge>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <a
              href={safeExternalUrl(app.url)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-base font-semibold tracking-tight outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-ring"
              aria-label={`${app.name} — ${t("apps.openExternal")}`}
            >
              {app.name}
            </a>
            <HugeiconsIcon
              icon={ArrowUpRight01Icon}
              size={14}
              strokeWidth={2}
              className="text-muted-foreground/60 group-hover:text-foreground transition-colors -translate-x-0.5 group-hover:translate-x-0 group-hover:-translate-y-0.5 duration-200"
            />
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground/80">
          <span className="inline-flex items-center gap-1.5">
            <HugeiconsIcon icon={Clock01Icon} size={13} strokeWidth={1.5} />
            {formatRelative(app.lastUsedAt, locale)}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                aria-label={t("apps.bookmark")}
                className="relative z-10 grid size-7 place-items-center rounded-md text-muted-foreground/60 opacity-0 group-hover:opacity-100 hover:bg-accent hover:text-foreground transition focus-visible:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <HugeiconsIcon icon={Bookmark01Icon} size={14} strokeWidth={1.5} />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t("apps.bookmark")}</TooltipContent>
          </Tooltip>
        </div>
      </Card>
    </motion.div>
  )
}
