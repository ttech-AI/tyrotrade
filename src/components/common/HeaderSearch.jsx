import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Search01Icon,
  DashboardCircleIcon,
  AiChat02Icon,
  Analytics01Icon,
  Settings02Icon,
  HelpCircleIcon,
  CopilotIcon,
  ArrowUpRight01Icon,
  Moon02Icon,
  Sun03Icon,
  LanguageSquareIcon,
  Add01Icon,
} from "@hugeicons/core-free-icons"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { useLocale } from "@/hooks/useLocale"
import { useTheme } from "@/hooks/useTheme"

// Keep in sync with src/components/layout/Sidebar.jsx + CommandPalette.jsx.
// External group below mirrors the Copilot sidebar entry — same URL, same
// new-tab behavior, same external arrow hint.
const PAGES = [
  { id: "dashboard", path: "/dashboard", labelKey: "nav.dashboard", icon: DashboardCircleIcon },
  { id: "chat", path: "/chat", labelKey: "nav.chat", icon: AiChat02Icon },
  { id: "analytics", path: "/analytics", labelKey: "nav.analytics", icon: Analytics01Icon },
  { id: "settings", path: "/settings", labelKey: "nav.settings", icon: Settings02Icon },
  { id: "help", path: "/help", labelKey: "nav.help", icon: HelpCircleIcon },
]

const EXTERNAL = [
  {
    id: "copilot",
    href: "https://m365.cloud.microsoft/chat",
    labelKey: "nav.copilot",
    subtitleKey: "nav.copilotSubtitle",
    icon: CopilotIcon,
  },
]

export function HeaderSearch({ onNavigate, onNewChat }) {
  const { t, toggle: toggleLocale } = useLocale()
  const { theme, toggle: toggleTheme } = useTheme()
  const [open, setOpen] = useState(false)

  const go = (path) => {
    onNavigate?.(path)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("header.searchAria")}
          className="ml-auto hidden sm:flex items-center gap-2 h-9 px-3 rounded-xl border border-input/80 bg-background/60 text-sm text-muted-foreground hover:bg-accent hover:text-foreground hover:border-input transition shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-56 lg:w-72"
        >
          <HugeiconsIcon icon={Search01Icon} className="size-4 shrink-0" />
          <span className="flex-1 text-left truncate">{t("header.search")}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-[380px] p-0 overflow-hidden"
      >
        <Command className="[&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]]:px-2 [&_[cmdk-input]]:h-10 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-2.5 [&_[cmdk-item]_svg]:h-4 [&_[cmdk-item]_svg]:w-4">
          <CommandInput placeholder={t("header.search")} />
          <CommandList>
            <CommandEmpty>{t("cmd.empty")}</CommandEmpty>

            <CommandGroup heading={t("cmd.groupPages")}>
              {PAGES.map((p) => (
                <CommandItem
                  key={p.id}
                  value={t(p.labelKey)}
                  onSelect={() => go(p.path)}
                >
                  <HugeiconsIcon icon={p.icon} />
                  <span className="font-medium">{t(p.labelKey)}</span>
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading={t("cmd.groupExternal")}>
              {EXTERNAL.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`${t(p.labelKey)} ${t(p.subtitleKey)}`}
                  onSelect={() => {
                    window.open(p.href, "_blank", "noopener,noreferrer")
                    setOpen(false)
                  }}
                >
                  <HugeiconsIcon icon={p.icon} />
                  <span className="font-medium">{t(p.labelKey)}</span>
                  <span className="ml-2 truncate text-xs text-muted-foreground">
                    {t(p.subtitleKey)}
                  </span>
                  <HugeiconsIcon
                    icon={ArrowUpRight01Icon}
                    className="ml-auto text-muted-foreground/70"
                  />
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading={t("cmd.groupActions")}>
              <CommandItem
                value={t("nav.quickAction")}
                onSelect={() => {
                  onNewChat?.()
                  setOpen(false)
                }}
              >
                <HugeiconsIcon icon={Add01Icon} />
                <span>{t("nav.quickAction")}</span>
              </CommandItem>
              <CommandItem onSelect={() => { toggleTheme(); setOpen(false) }}>
                <HugeiconsIcon icon={theme === "dark" ? Sun03Icon : Moon02Icon} />
                {t("cmd.actionToggleTheme")}
              </CommandItem>
              <CommandItem onSelect={() => { toggleLocale(); setOpen(false) }}>
                <HugeiconsIcon icon={LanguageSquareIcon} />
                {t("cmd.actionToggleLocale")}
              </CommandItem>
              <CommandItem onSelect={() => go("/settings")}>
                <HugeiconsIcon icon={Settings02Icon} />
                {t("cmd.actionOpenSettings")}
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
