import { HugeiconsIcon } from "@hugeicons/react"
import { ColorsIcon } from "@hugeicons/core-free-icons"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useLocale } from "@/hooks/useLocale"
import { usePalette } from "@/hooks/usePalette"

function Swatch({ colors, solid = false }) {
  if (solid) {
    return (
      <span
        style={{ backgroundColor: colors[0] }}
        className="size-3.5 rounded-full ring-1 ring-background"
      />
    )
  }
  return (
    <span className="inline-flex h-4 items-center -space-x-1.5">
      {colors.map((c, i) => (
        <span
          key={i}
          style={{ backgroundColor: c }}
          className="size-3.5 rounded-full ring-1 ring-background"
        />
      ))}
    </span>
  )
}

const GROUP_LABEL = "text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/60"

export function PaletteSwitcher() {
  const { t } = useLocale()
  const { palette, setPalette, palettes } = usePalette()

  const solidPalettes = palettes.filter((p) => p.group === "solid")
  const gradientPalettes = palettes.filter((p) => p.group !== "solid")

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("palette.title", "Renk paleti")}
              className="size-9 rounded-xl [&_svg]:!size-[18px]"
            >
              <HugeiconsIcon icon={ColorsIcon} />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{t("palette.title", "Renk paleti")}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuRadioGroup value={palette} onValueChange={setPalette}>
          <DropdownMenuLabel className={GROUP_LABEL}>
            {t("palette.group.solid")}
          </DropdownMenuLabel>
          {solidPalettes.map((p) => (
            <DropdownMenuRadioItem key={p.id} value={p.id} className="gap-2">
              <span className="flex-1">{t(p.labelKey, p.id)}</span>
              <Swatch colors={p.swatch} solid />
            </DropdownMenuRadioItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className={GROUP_LABEL}>
            {t("palette.group.gradient")}
          </DropdownMenuLabel>
          {gradientPalettes.map((p) => (
            <DropdownMenuRadioItem key={p.id} value={p.id} className="gap-2">
              <span className="flex-1">{t(p.labelKey, p.id)}</span>
              <Swatch colors={p.swatch} />
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
