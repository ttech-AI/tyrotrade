import { HugeiconsIcon } from "@hugeicons/react"
import {
  StickyNote01Icon,
  BubbleChatTranslateIcon,
  PaintBoardIcon,
  AiSearch02Icon,
} from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { useLocale } from "@/hooks/useLocale"
import { useIsMobile } from "@/hooks/use-mobile"

const CHIPS = [
  { id: "summary", labelKey: "chat.chips.summary", prefixKey: "chat.chips.prefix.summary", icon: StickyNote01Icon },
  { id: "translate", labelKey: "chat.chips.translate", prefixKey: "chat.chips.prefix.translate", icon: BubbleChatTranslateIcon },
  { id: "design", labelKey: "chat.chips.design", prefixKey: "chat.chips.prefix.design", icon: PaintBoardIcon },
  { id: "research", labelKey: "chat.chips.research", prefixKey: "chat.chips.prefix.research", icon: AiSearch02Icon },
]

export function QuickChips({ onChip }) {
  const { t } = useLocale()
  const isMobile = useIsMobile()
  // 4 chips don't fit on a 375 px viewport even at compact size — drop the
  // last one (Araştırma) on mobile. Desktop / tablet shows all four.
  const visibleChips = isMobile ? CHIPS.slice(0, 3) : CHIPS
  return (
    <div
      role="group"
      aria-label={t("chat.chips.aria")}
      className="flex w-full flex-wrap items-center justify-center gap-2"
    >
      {visibleChips.map((chip) => (
        <Button
          key={chip.id}
          variant="outline"
          size="sm"
          onClick={() => onChip?.(t(chip.prefixKey))}
          className="h-9 gap-1.5 rounded-full border-border/70 bg-background px-3 text-[13px] font-medium text-foreground/80 hover:text-foreground sm:h-10 sm:gap-2 sm:px-4 sm:text-sm"
        >
          <HugeiconsIcon icon={chip.icon} className="size-4 text-brand-via sm:size-[18px]" strokeWidth={1.6} />
          {t(chip.labelKey)}
        </Button>
      ))}
    </div>
  )
}
