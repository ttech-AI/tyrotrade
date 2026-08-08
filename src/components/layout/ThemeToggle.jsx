import { HugeiconsIcon } from "@hugeicons/react"
import { Moon02Icon, Sun03Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useTheme } from "@/hooks/useTheme"
import { useLocale } from "@/hooks/useLocale"

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const { t } = useLocale()
  const isDark = theme === "dark"
  const label = isDark ? t("header.toggleLight") : t("header.toggleDark")
  const icon = isDark ? Sun03Icon : Moon02Icon

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={toggle}
          aria-label={label}
          className="size-9 rounded-xl [&_svg]:!size-[18px]"
        >
          <HugeiconsIcon icon={icon} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
