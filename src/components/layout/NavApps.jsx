import { useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  MoreHorizontalIcon,
  LinkSquare02Icon,
  Bookmark01Icon,
  ArrowDown01Icon,
} from "@hugeicons/core-free-icons"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { IconOrLogo } from "@/components/common/IconOrLogo"
import { useLocale } from "@/hooks/useLocale"
import { useConfig } from "@/hooks/useConfig"
import { cn, safeExternalUrl } from "@/lib/utils"

const GROUP_LABEL = "text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/55"
const COLLAPSE_THRESHOLD = 3

function AppItem({ app }) {
  const { t } = useLocale()
  const { isMobile, setOpenMobile } = useSidebar()
  const href = safeExternalUrl(app.url)
  // Tap on app row should also close the mobile sheet (the user is leaving
  // for an external tab; the sheet would still be open behind it on return).
  const closeOnTap = () => {
    if (isMobile) setOpenMobile(false)
  }
  return (
    <SidebarMenuItem>
      <Tooltip>
        <TooltipTrigger asChild>
          <SidebarMenuButton asChild>
            <a href={href} target="_blank" rel="noopener noreferrer" onClick={closeOnTap}>
              <span className="grid size-5 shrink-0 place-items-center overflow-hidden rounded-[5px]">
                <IconOrLogo
                  iconName={app.iconName}
                  logo={app.logo}
                  strokeWidth={1.6}
                  className="size-5"
                />
              </span>
              <span>{app.name}</span>
            </a>
          </SidebarMenuButton>
        </TooltipTrigger>
        {app.description && !isMobile && (
          <TooltipContent side="right" sideOffset={12} className="max-w-xs">
            <p className="leading-relaxed text-background">{app.description}</p>
          </TooltipContent>
        )}
      </Tooltip>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction showOnHover className="rounded-sm data-[state=open]:bg-accent">
            <HugeiconsIcon icon={MoreHorizontalIcon} />
            <span className="sr-only">{t("apps.bookmark")}</span>
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-44 rounded-lg"
          side={isMobile ? "bottom" : "right"}
          align={isMobile ? "end" : "start"}
        >
          <DropdownMenuItem asChild>
            <a href={href} target="_blank" rel="noopener noreferrer" onClick={closeOnTap}>
              <HugeiconsIcon icon={LinkSquare02Icon} />
              <span>{t("apps.openExternal")}</span>
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <HugeiconsIcon icon={Bookmark01Icon} />
            <span>{t("apps.bookmark")}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  )
}

function AppGroup({ titleKey, apps }) {
  const { t } = useLocale()
  const [expanded, setExpanded] = useState(false)

  if (apps.length === 0) return null

  const overflow = apps.length > COLLAPSE_THRESHOLD
  const visible = overflow && !expanded ? apps.slice(0, COLLAPSE_THRESHOLD) : apps
  const hiddenCount = apps.length - COLLAPSE_THRESHOLD

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel className={GROUP_LABEL}>{t(titleKey)}</SidebarGroupLabel>
      <SidebarMenu>
        {visible.slice(0, COLLAPSE_THRESHOLD).map((app) => (
          <AppItem key={app.id} app={app} />
        ))}
        <AnimatePresence initial={false}>
          {expanded &&
            apps.slice(COLLAPSE_THRESHOLD).map((app, i) => (
              <motion.div
                key={app.id}
                initial={{ opacity: 0, y: -4, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -4, height: 0 }}
                transition={{ duration: 0.22, delay: i * 0.025, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <AppItem app={app} />
              </motion.div>
            ))}
        </AnimatePresence>
        {overflow && (
          <SidebarMenuItem>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className={cn(
                "group/more relative mt-0.5 flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-1.5",
                "text-[11px] font-medium tracking-tight text-muted-foreground/70 transition",
                "hover:bg-sidebar-accent/40 hover:text-foreground",
              )}
            >
              <span>
                {expanded
                  ? t("nav.showLess")
                  : t("nav.showMore").replace("{count}", String(hiddenCount))}
              </span>
              <motion.span
                animate={{ rotate: expanded ? 180 : 0 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className="inline-flex"
              >
                <HugeiconsIcon icon={ArrowDown01Icon} className="size-3" strokeWidth={2} />
              </motion.span>
            </button>
          </SidebarMenuItem>
        )}
      </SidebarMenu>
    </SidebarGroup>
  )
}

export function NavApps() {
  const { aiApps, businessApps } = useConfig()
  return (
    <>
      <AppGroup titleKey="nav.appsAI" apps={aiApps} />
      <AppGroup titleKey="nav.appsBusiness" apps={businessApps} />
    </>
  )
}
