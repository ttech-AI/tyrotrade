import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons"
import { motion } from "motion/react"
import { Card } from "@/components/ui/card"
import { useLocale } from "@/hooks/useLocale"
import { getApp } from "@/data/apps"
import { cn, safeExternalUrl } from "@/lib/utils"

export function StatCard({ stat, index = 0, className }) {
  const { t } = useLocale()
  const app = getApp(stat.sourceAppId)

  const handleClick = () => {
    const safe = safeExternalUrl(app?.url)
    if (safe !== "#") {
      window.open(safe, "_blank", "noopener,noreferrer")
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card
        className={cn(
          "group relative p-5 gap-2 overflow-hidden border-border/60 bg-card hover:shadow-md hover:border-border transition-all duration-200",
          className,
        )}
      >
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {t(stat.labelKey)}
        </p>
        <p className="text-4xl font-semibold tracking-tight tabular-nums">{stat.value}</p>
        {app && (
          <button
            type="button"
            onClick={handleClick}
            className="self-start inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            {app.name}
            <HugeiconsIcon
              icon={ArrowUpRight01Icon}
              size={11}
              strokeWidth={2}
              className="opacity-60 group-hover:opacity-100 transition"
            />
          </button>
        )}
      </Card>
    </motion.div>
  )
}
