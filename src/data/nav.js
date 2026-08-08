import {
  DashboardCircleIcon,
  AiChat02Icon,
  Activity01Icon,
  Settings02Icon,
  HelpCircleIcon,
  AppStoreIcon,
} from "@hugeicons/core-free-icons"

export const navGroups = [
  {
    id: "workspace",
    labelKey: "nav.workspace",
    items: [
      { id: "dashboard", labelKey: "nav.dashboard", icon: DashboardCircleIcon, active: true },
      { id: "apps", labelKey: "nav.apps", icon: AppStoreIcon },
      { id: "activity", labelKey: "nav.activity", icon: Activity01Icon },
    ],
  },
  {
    id: "tools",
    labelKey: "nav.tools",
    items: [
      { id: "chat", labelKey: "nav.chat", icon: AiChat02Icon, comingSoon: true },
      { id: "settings", labelKey: "nav.settings", icon: Settings02Icon, comingSoon: true },
      { id: "help", labelKey: "nav.help", icon: HelpCircleIcon },
    ],
  },
]
