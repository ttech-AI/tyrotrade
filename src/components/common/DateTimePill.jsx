import { useEffect, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Calendar05Icon } from "@hugeicons/core-free-icons"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useLocale } from "@/hooks/useLocale"
import { getDateTimeFormat } from "@/lib/intl-cache"

// Hoisted format-option literals so the per-locale Intl cache key is stable
// (the cache stringifies options — same reference → same key, same hit).
const OPTS_WEEKDAY_SHORT = { weekday: "short" }
const OPTS_DATE_SHORT = { day: "numeric", month: "short" }
const OPTS_WEEKDAY_LONG = { weekday: "long" }
const OPTS_FULL_DATE = { day: "numeric", month: "long", year: "numeric" }
const OPTS_TIME = { hour: "2-digit", minute: "2-digit" }

function format(now, locale) {
  return {
    // Compact display (visible in the header)
    weekdayShort: getDateTimeFormat(locale, OPTS_WEEKDAY_SHORT).format(now),
    dateShort: getDateTimeFormat(locale, OPTS_DATE_SHORT).format(now),
    // Verbose tooltip — full weekday + day + month + year + clock
    weekdayLong: getDateTimeFormat(locale, OPTS_WEEKDAY_LONG).format(now),
    fullDate: getDateTimeFormat(locale, OPTS_FULL_DATE).format(now),
    time: getDateTimeFormat(locale, OPTS_TIME).format(now),
  }
}

export function DateTimePill({ className = "" }) {
  const { locale } = useLocale()
  const [now, setNow] = useState(() => new Date())

  // Refresh every minute so the tooltip's clock reading stays current
  // when the user hovers (was: hourly, which left the clock stale).
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60 * 1000)
    return () => clearInterval(t)
  }, [])

  const { weekdayShort, dateShort, weekdayLong, fullDate, time } = format(now, locale)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`${weekdayLong}, ${fullDate} · ${time}`}
          className={
            "hidden md:flex h-9 items-center gap-2 px-2 rounded-md transition hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 " +
            className
          }
        >
          <span className="grid size-6 place-items-center rounded-lg bg-gradient-to-br from-brand-from via-brand-via to-brand-to text-white">
            <HugeiconsIcon icon={Calendar05Icon} className="size-3.5" />
          </span>
          <div className="flex flex-col leading-tight">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground/80">
              {weekdayShort}
            </span>
            <span className="text-[10px] text-muted-foreground">{dateShort}</span>
          </div>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6} className="flex-col items-center gap-0 px-3 py-2 text-center">
        {/* Tooltip primitive paints bg-foreground + text-background, so use
            text-background (NOT text-foreground) — otherwise the text is
            invisible against the matching bg. */}
        <div className="text-[11px] font-semibold uppercase tracking-wider text-background">
          {weekdayLong}
        </div>
        <div className="mt-0.5 text-xs text-background/90">{fullDate}</div>
        <div className="mt-0.5 text-[11px] tabular-nums text-background/65">{time}</div>
      </TooltipContent>
    </Tooltip>
  )
}
