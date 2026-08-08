import { HugeiconsIcon } from "@hugeicons/react"
import { LanguageSquareIcon } from "@hugeicons/core-free-icons"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useLocale } from "@/hooks/useLocale"
import { LOCALES } from "@/providers/LocaleProvider"

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useLocale()

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("header.language")}
              className="size-9 rounded-xl [&_svg]:!size-[18px]"
            >
              <HugeiconsIcon icon={LanguageSquareIcon} />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{t("header.language")}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuRadioGroup value={locale} onValueChange={setLocale}>
          {LOCALES.map((code) => (
            <DropdownMenuRadioItem key={code} value={code}>
              {t(`locale.${code}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
