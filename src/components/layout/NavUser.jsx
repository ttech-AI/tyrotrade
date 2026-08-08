import { HugeiconsIcon } from "@hugeicons/react"
import {
  Logout01Icon,
  MoreVerticalIcon,
  UserCircleIcon,
  Notification01Icon,
  Settings02Icon,
} from "@hugeicons/core-free-icons"
import { useMsal } from "@azure/msal-react"
import { useNavigate } from "react-router-dom"
import { UserAvatar } from "@/components/common/UserAvatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useLocale } from "@/hooks/useLocale"
import { useMe } from "@/hooks/useMe"
import { isMsalConfigured, MOCK_LOGGED_IN_KEY } from "@/lib/msal"

export function NavUser() {
  const { isMobile } = useSidebar()
  const { t } = useLocale()
  const me = useMe()
  const { instance } = useMsal()
  const navigate = useNavigate()

  async function handleSignOut() {
    if (isMsalConfigured) {
      const account = instance.getActiveAccount() ?? undefined
      // logoutRedirect navigates the whole page to AAD then back to
      // postLogoutRedirectUri (/login). Don't navigate manually — the redirect
      // handles it, and any manual nav before it kicks in is a race.
      await instance.logoutRedirect({ account }).catch(() => {
        // If redirect setup fails (rare), at least clear local state.
        instance.setActiveAccount(null)
        navigate("/login")
      })
      return
    }
    window.sessionStorage.removeItem(MOCK_LOGGED_IN_KEY)
    navigate("/login")
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:justify-center"
            >
              <div className="-ml-[5px] size-7 shrink-0 group-data-[collapsible=icon]:ml-0 group-data-[collapsible=icon]:size-6">
                <UserAvatar photoUrl={me.photoUrl} label={me.fullName} />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-medium">{me.fullName}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {me.email}
                </span>
              </div>
              <HugeiconsIcon icon={MoreVerticalIcon} className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg [&_[role=menuitem]_svg]:!size-[18px] [&_[role=menuitem]]:gap-2.5 [&_[role=menuitem]]:py-2"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <div className="h-8 w-8">
                  <UserAvatar photoUrl={me.photoUrl} label={me.fullName} />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{me.fullName}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {me.email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <HugeiconsIcon icon={UserCircleIcon} />
                {t("user.profile")}
              </DropdownMenuItem>
              <DropdownMenuItem>
                <HugeiconsIcon icon={Settings02Icon} />
                {t("user.preferences")}
              </DropdownMenuItem>
              <DropdownMenuItem>
                <HugeiconsIcon icon={Notification01Icon} />
                {t("header.notifications")}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleSignOut}
              className="text-destructive font-medium focus:bg-destructive/10 focus:text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive [&_svg]:!text-destructive"
            >
              <HugeiconsIcon icon={Logout01Icon} />
              {t("user.signout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
