import { HugeiconsIcon } from "@hugeicons/react"
import {
  DashboardCircleIcon,
  AiChat02Icon,
  Analytics01Icon,
  Settings02Icon,
  HelpCircleIcon,
  CopilotIcon,
  ArrowUpRight01Icon,
  Moon01Icon,
  Sun01Icon,
  LanguageCircleIcon,
  Add01Icon,
} from "@hugeicons/core-free-icons"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { useLocale } from "@/hooks/useLocale"
import { useTheme } from "@/hooks/useTheme"

// Pages mirror what the sidebar shows (navMain + navSecondary). External
// items live in their own group below so Cmd+K still finds them but the
// visual grouping signals they leave the SPA. Keep these in sync with
// src/components/layout/Sidebar.jsx + HeaderSearch.jsx.
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

export function CommandPalette({ open, onOpenChange, onNavigate, onNewChat }) {
  const { t, toggle: toggleLocale } = useLocale()
  const { theme, toggle: toggleTheme } = useTheme()

  const close = () => onOpenChange?.(false)

  const go = (path) => {
    onNavigate?.(path)
    close()
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title={t("cmd.placeholder")}>
      <CommandInput placeholder={t("cmd.placeholder")} />
      <CommandList>
        <CommandEmpty>{t("cmd.empty")}</CommandEmpty>

        <CommandGroup heading={t("cmd.groupPages")}>
          {PAGES.map((p) => (
            <CommandItem
              key={p.id}
              value={t(p.labelKey)}
              onSelect={() => go(p.path)}
            >
              <HugeiconsIcon icon={p.icon} size={16} strokeWidth={1.5} />
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
                close()
              }}
            >
              <HugeiconsIcon icon={p.icon} size={16} strokeWidth={1.5} />
              <span className="font-medium">{t(p.labelKey)}</span>
              <span className="ml-2 truncate text-xs text-muted-foreground">
                {t(p.subtitleKey)}
              </span>
              <HugeiconsIcon
                icon={ArrowUpRight01Icon}
                size={14}
                strokeWidth={1.5}
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
              close()
            }}
          >
            <HugeiconsIcon icon={Add01Icon} size={16} strokeWidth={1.5} />
            <span>{t("nav.quickAction")}</span>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              toggleTheme()
              close()
            }}
          >
            <HugeiconsIcon icon={theme === "dark" ? Sun01Icon : Moon01Icon} size={16} strokeWidth={1.5} />
            {t("cmd.actionToggleTheme")}
          </CommandItem>
          <CommandItem
            onSelect={() => {
              toggleLocale()
              close()
            }}
          >
            <HugeiconsIcon icon={LanguageCircleIcon} size={16} strokeWidth={1.5} />
            {t("cmd.actionToggleLocale")}
          </CommandItem>
          <CommandItem onSelect={() => go("/settings")}>
            <HugeiconsIcon icon={Settings02Icon} size={16} strokeWidth={1.5} />
            {t("cmd.actionOpenSettings")}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
