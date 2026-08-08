import { useSyncExternalStore } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { PlusSignCircleIcon, ArrowUpRight01Icon } from "@hugeicons/core-free-icons"
import { getUnreadCount, subscribeUnread } from "@/lib/chatBus"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useLocale } from "@/hooks/useLocale"
import { cn } from "@/lib/utils"

const GROUP_LABEL = "text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/55"

export function NavMain({ items, activeId, onSelect, onQuickAction }) {
  const { t } = useLocale()
  // Answers that landed while the user was on another page / tab. Read
  // straight from the store rather than threaded down through
  // DashboardLayout → Sidebar, since only this one row cares.
  const unreadAnswers = useSyncExternalStore(subscribeUnread, getUnreadCount, () => 0)
  return (
    <>
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                type="button"
                onClick={() => onQuickAction?.()}
                tooltip={t("nav.quickAction", "Yeni sohbet")}
                className="cursor-pointer bg-gradient-to-r from-brand-from via-brand-via to-brand-to text-white shadow-sm duration-200 ease-linear hover:brightness-110 hover:text-white active:text-white"
              >
                <HugeiconsIcon icon={PlusSignCircleIcon} />
                <span>{t("nav.quickAction", "Yeni sohbet")}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      <SidebarGroup>
        <SidebarGroupLabel className={GROUP_LABEL}>
          {t("nav.workspace")}
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {items.map((item) => {
              const active = activeId === item.id
              return (
                <SidebarMenuItem key={item.id} className="relative">
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute -left-2 top-1/2 z-10 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand shadow-[1px_0_6px_-1px_color-mix(in_oklch,var(--brand-text),transparent_45%)]"
                    />
                  )}
                  <SidebarMenuButton
                    isActive={active}
                    // External items override the tooltip to mention "opens
                    // in a new tab" — the collapsed-rail tooltip is the only
                    // affordance icon-only users see.
                    tooltip={t(item.tooltipKey ?? item.labelKey)}
                    disabled={!!item.comingSoon}
                    onClick={() => onSelect(item)}
                    className={cn(
                      active && "text-brand [&_svg]:text-brand font-semibold",
                    )}
                  >
                    {item.icon && <HugeiconsIcon icon={item.icon} />}
                    {/* Label has explicit collapsed-hide because shadcn's
                        sidebar relies on `[&>span:last-child]:hidden` to
                        clear the label on the icon-only rail. By adding a
                        trailing external-link icon span AFTER the label
                        (for item.isExternal), the label is no longer the
                        last child and that rule misses it — so we hide it
                        explicitly here. */}
                    <span className="flex-1 group-data-[collapsible=icon]:hidden">
                      {t(item.labelKey)}
                    </span>
                    {/* Unread answers. Count on the expanded rail; on the
                        icon-only rail the label is gone, so it collapses to
                        a dot pinned to the icon's corner. */}
                    {item.id === "chat" && unreadAnswers > 0 && (
                      <>
                        <span className="ml-auto inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold tabular-nums text-white group-data-[collapsible=icon]:hidden">
                          {unreadAnswers > 9 ? "9+" : unreadAnswers}
                        </span>
                        <span
                          aria-hidden="true"
                          className="absolute right-1.5 top-1.5 hidden size-2 rounded-full bg-brand ring-2 ring-sidebar group-data-[collapsible=icon]:block"
                        />
                      </>
                    )}
                    {item.isExternal && (
                      <HugeiconsIcon
                        icon={ArrowUpRight01Icon}
                        className="ml-auto size-3.5 shrink-0 text-muted-foreground/60 group-data-[collapsible=icon]:hidden"
                        aria-hidden="true"
                      />
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  )
}
