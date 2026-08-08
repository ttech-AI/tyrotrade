import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useLocale } from "@/hooks/useLocale"
import { getApp } from "@/data/apps"
import { getCategory, categoryTones } from "@/data/categories"
import { formatRelative } from "@/lib/date"
import { cn } from "@/lib/utils"

function buildText(activity, locale) {
  const targetText = activity.target?.[locale] ?? activity.target?.tr ?? ""
  switch (activity.actionKey) {
    case "activities.approved":
      return { actor: activity.actor, action: locale === "tr" ? `${targetText} onayladı` : `approved ${targetText}` }
    case "activities.goalUpdated":
      return { actor: null, action: locale === "tr" ? `${targetText} güncellendi` : `${targetText} was updated` }
    case "activities.nobReceived":
      return { actor: activity.actor, action: targetText }
    case "activities.shiftAssigned":
      return { actor: activity.actor, action: targetText }
    case "activities.alertResolved":
      return { actor: null, action: targetText }
    default:
      return { actor: activity.actor, action: targetText }
  }
}

function initials(name) {
  return name
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export function ActivityItem({ activity }) {
  const { locale } = useLocale()
  const app = getApp(activity.appId)
  const category = getCategory(app?.category)
  const tones = categoryTones[category?.tone] ?? categoryTones.cyan
  const { actor, action } = buildText(activity, locale)

  return (
    <li>
      <button
        type="button"
        className="group w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-accent/60 transition text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {actor ? (
          <Avatar className="size-9 ring-1 ring-border">
            <AvatarFallback className="bg-muted text-foreground text-[11px] font-semibold">
              {initials(actor)}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div className={cn("grid size-9 shrink-0 place-items-center rounded-full", tones.icon)}>
            {app && <HugeiconsIcon icon={app.icon} size={16} strokeWidth={1.5} />}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm leading-snug">
            {actor && <span className="font-medium">{actor}</span>}
            {actor && <span> </span>}
            <span className="text-muted-foreground">{action}</span>
          </p>
          <p className="text-xs text-muted-foreground/80 mt-0.5">
            {app?.name} · {formatRelative(activity.timestamp, locale)}
          </p>
        </div>
        <HugeiconsIcon
          icon={ArrowRight01Icon}
          size={14}
          strokeWidth={1.5}
          className="shrink-0 text-muted-foreground/40 group-hover:text-foreground group-hover:translate-x-0.5 transition"
        />
      </button>
    </li>
  )
}
