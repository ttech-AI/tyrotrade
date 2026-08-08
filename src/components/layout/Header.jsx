import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon, SidebarLeftIcon } from "@hugeicons/core-free-icons"
import { useSidebar } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { BrandText } from "@/components/brand/BrandText"
import { ThemeToggle } from "./ThemeToggle"
import { PaletteSwitcher } from "./PaletteSwitcher"
import { LanguageSwitcher } from "./LanguageSwitcher"
import { HeaderSearch } from "@/components/common/HeaderSearch"
import { DateTimePill } from "@/components/common/DateTimePill"
import { useLocale } from "@/hooks/useLocale"

function PremiumSidebarTrigger() {
  const { toggleSidebar } = useSidebar()
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggleSidebar}
      aria-label="Toggle sidebar"
      className="-ml-1 size-9 rounded-xl [&_svg]:!size-5 text-muted-foreground hover:text-foreground"
    >
      <HugeiconsIcon icon={SidebarLeftIcon} />
    </Button>
  )
}

const PAGE_LABEL_KEY = {
  dashboard: "nav.dashboard",
  chat: "nav.chat",
  analytics: "nav.analytics",
  settings: "nav.settings",
  help: "nav.help",
}

export function Header({ activeId = "dashboard", onOpenSearch, onNavigate, onNewChat }) {
  const { t } = useLocale()
  const pageLabelKey = PAGE_LABEL_KEY[activeId] ?? "nav.dashboard"

  return (
    <header className="group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 flex h-14 pwa:h-11 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex w-full items-center gap-3 px-4 lg:px-6">
        <PremiumSidebarTrigger />

        <span className="h-5 w-px bg-border/70 rounded-full" aria-hidden="true" />

        <Breadcrumb>
          <BreadcrumbList className="text-sm">
            <BreadcrumbItem className="hidden md:flex items-center">
              <a href="#" className="hover:opacity-80 transition-opacity">
                <BrandText className="text-sm" />
              </a>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block [&>svg]:size-3.5 text-muted-foreground/60" />
            <BreadcrumbItem>
              <BreadcrumbPage className="font-medium">{t(pageLabelKey)}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <HeaderSearch onNavigate={onNavigate} onNewChat={onNewChat} />

        <button
          type="button"
          onClick={onOpenSearch}
          aria-label={t("header.searchAria")}
          className="ml-auto sm:hidden grid place-items-center size-10 rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground transition"
        >
          <HugeiconsIcon icon={Search01Icon} className="size-5" />
        </button>

        <div className="flex items-center gap-0.5 sm:gap-1">
          <ThemeToggle />
          <PaletteSwitcher />
          <LanguageSwitcher />
        </div>
        <DateTimePill />
      </div>
    </header>
  )
}
