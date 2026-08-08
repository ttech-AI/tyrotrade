import { HugeiconsIcon } from "@hugeicons/react"
import {
  Logout01Icon,
  UserCircleIcon,
  Notification01Icon,
  Settings02Icon,
} from "@hugeicons/core-free-icons"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PastelOrb } from "@/components/brand/PastelOrb"
import { useLocale } from "@/hooks/useLocale"
import { currentUser } from "@/data/user"

function RingAvatar({ size = 32 }) {
  const firstInitial = (currentUser.name || "?").trim().charAt(0).toUpperCase()
  const initialsFontSize = Math.max(11, Math.round(size * 0.46))
  return (
    <div style={{ width: size, height: size }} className="overflow-hidden rounded-full">
      <PastelOrb label={currentUser.fullName}>
        <span
          className="select-none font-semibold leading-none"
          style={{
            fontSize: initialsFontSize,
            letterSpacing: "-0.02em",
            color: "var(--avatar-text)",
          }}
        >
          {firstInitial}
        </span>
      </PastelOrb>
    </div>
  )
}

export function HeaderUserButton() {
  const { t } = useLocale()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={currentUser.fullName}
          className="rounded-full transition hover:scale-[1.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <RingAvatar size={30} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="w-60 rounded-lg [&_[role=menuitem]_svg]:!size-[18px] [&_[role=menuitem]]:gap-2.5 [&_[role=menuitem]]:py-2"
      >
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2.5 px-2 py-2 text-left text-sm">
            <RingAvatar size={36} />
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{currentUser.fullName}</span>
              <span className="truncate text-xs text-muted-foreground">
                {currentUser.email}
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
        <DropdownMenuItem className="text-destructive font-medium focus:bg-destructive/10 focus:text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive [&_svg]:!text-destructive">
          <HugeiconsIcon icon={Logout01Icon} />
          {t("user.signout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
