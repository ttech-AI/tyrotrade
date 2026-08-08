import { HugeiconsIcon } from "@hugeicons/react"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useLocale } from "@/hooks/useLocale"
import { cn } from "@/lib/utils"

export function NavSecondary({ items, activeId, onSelect, ...props }) {
  const { t } = useLocale()
  return (
    <SidebarGroup {...props}>
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
                  onClick={() => (item.onClick ? item.onClick() : onSelect?.(item))}
                  disabled={!!item.comingSoon}
                  tooltip={t(item.labelKey)}
                  className={cn(
                    active && "text-brand [&_svg]:text-brand font-semibold",
                  )}
                >
                  <HugeiconsIcon icon={item.icon} />
                  <span>{t(item.labelKey)}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
