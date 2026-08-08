import { HugeiconsIcon } from "@hugeicons/react"
import { Settings01Icon, Logout01Icon, ProfileIcon } from "@hugeicons/core-free-icons"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useLocale } from "@/hooks/useLocale"
import { currentUser } from "@/data/user"
import { cn } from "@/lib/utils"

export function UserMenu({ variant = "compact" }) {
  const { t, locale } = useLocale()
  const initials = currentUser.initials
  const showFull = variant === "full"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition",
            showFull
              ? "w-full px-2 py-2 rounded-lg hover:bg-sidebar-accent"
              : "pr-1 hover:opacity-90",
          )}
        >
          <Avatar className="size-8 ring-1 ring-border">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          {showFull ? (
            <div className="flex flex-col items-start min-w-0 leading-tight">
              <span className="text-sm font-medium truncate">{currentUser.fullName}</span>
              <span className="text-xs text-muted-foreground truncate">
                {currentUser.title[locale] ?? currentUser.title.tr}
              </span>
            </div>
          ) : (
            <span className="hidden sm:inline text-sm font-medium">{currentUser.name} T.</span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{currentUser.fullName}</span>
            <span className="text-xs text-muted-foreground truncate">{currentUser.email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <HugeiconsIcon icon={ProfileIcon} size={16} strokeWidth={1.5} />
          {t("user.profile")}
        </DropdownMenuItem>
        <DropdownMenuItem>
          <HugeiconsIcon icon={Settings01Icon} size={16} strokeWidth={1.5} />
          {t("user.preferences")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <HugeiconsIcon icon={Logout01Icon} size={16} strokeWidth={1.5} />
          {t("user.signout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
