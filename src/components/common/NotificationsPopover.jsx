import { HugeiconsIcon } from "@hugeicons/react"
import { Notification01Icon } from "@hugeicons/core-free-icons"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { useLocale } from "@/hooks/useLocale"
import { notifications, unreadCount } from "@/data/notifications"
import { getApp } from "@/data/apps"
import { formatRelative } from "@/lib/date"
import { cn } from "@/lib/utils"

export function NotificationsPopover() {
  const { t, locale } = useLocale()
  const hasUnread = unreadCount > 0

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("header.notifications")}
              className="relative size-8"
            >
              <HugeiconsIcon icon={Notification01Icon} />
              {hasUnread && (
                <span className="absolute top-1 right-1 grid place-items-center min-w-[15px] h-[15px] px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-semibold leading-none">
                  {unreadCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{t("header.notifications")}</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3">
          <h3 className="text-sm font-semibold">{t("notif.title")}</h3>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground transition"
          >
            {t("notif.markAllRead")}
          </button>
        </div>
        <Separator />
        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              {t("notif.empty")}
            </p>
          ) : (
            <ul className="py-1">
              {notifications.map((n) => {
                const app = getApp(n.appId)
                return (
                  <li
                    key={n.id}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 hover:bg-accent/40 transition",
                      !n.read && "bg-accent/20",
                    )}
                  >
                    <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary text-secondary-foreground mt-0.5">
                      {app && <HugeiconsIcon icon={app.icon} size={16} strokeWidth={1.5} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{t(n.titleKey)}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {n.body[locale] ?? n.body.tr}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {app?.name} · {formatRelative(n.timestamp, locale)}
                      </p>
                    </div>
                    {!n.read && <span className="size-2 rounded-full bg-primary mt-1.5" />}
                  </li>
                )
              })}
            </ul>
          )}
        </ScrollArea>
        <Separator />
        <button
          type="button"
          className="w-full px-4 py-2.5 text-xs font-medium text-center text-muted-foreground hover:text-foreground hover:bg-accent/40 transition"
        >
          {t("notif.viewAll")}
        </button>
      </PopoverContent>
    </Popover>
  )
}
