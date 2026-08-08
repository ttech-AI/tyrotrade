import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowDown01Icon, SquareLock02Icon, Tick01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { IconOrLogo } from "@/components/common/IconOrLogo"
import { showAgentNoAccess } from "@/components/common/AgentAccessToast"
import { useLocale } from "@/hooks/useLocale"
import { useConfig } from "@/hooks/useConfig"
import { cn } from "@/lib/utils"

export function AgentSelect({ value, onChange }) {
  const { t } = useLocale()
  const { agents, getAgent } = useConfig()
  const current = getAgent(value)

  // Kilitli agent seçilirse onChange HİÇ çağrılmaz → aktif agent değişmez,
  // konuşma bölünmez. Toast da "tıkladım, bir şey olmadı" hissini önler.
  function handlePick(agent) {
    if (agent.locked) {
      showAgentNoAccess(agent.name, t)
      return
    }
    onChange?.(agent.id)
  }
  return (
    <DropdownMenu>
      {/* Nested Tooltip + DropdownMenu — both wrap the same Button via
          asChild. Radix's focus management hides the tooltip the moment
          the menu opens, so they don't double-render. */}
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              aria-label={current?.name}
              className={
                // h-9 still matches the attach / mic buttons in the composer
                // bottom row, but the horizontal weight (padding, gap, font)
                // shrinks on mobile so the pill is roughly two-thirds its old
                // width without dropping the agent name. On sm+ it relaxes
                // back to a normal pill. Long names (TYRO Project Manager …)
                // truncate via max-w + truncate so the row never overflows.
                [
                  "h-9 gap-1.5 rounded-full border-border/50 bg-background px-2.5",
                  "text-[12px] font-medium transition-colors hover:bg-muted/40",
                  "sm:gap-2 sm:px-3 sm:text-[13px]",
                ].join(" ")
              }
            >
              <span className="grid size-[14px] shrink-0 place-items-center overflow-hidden rounded-sm sm:size-4">
                <IconOrLogo
                  iconName={current?.iconName}
                  logo={current?.logo}
                  className="size-[14px] sm:size-4"
                />
              </span>
              <span className="max-w-[88px] truncate sm:max-w-[180px]">{current?.name}</span>
              <HugeiconsIcon
                icon={ArrowDown01Icon}
                className="size-3 shrink-0 text-muted-foreground/70 sm:size-3.5"
              />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6}>
          {t("chat.tooltip.agent")}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        align="start"
        side="top"
        sideOffset={8}
        className="w-[min(280px,calc(100vw-2rem))] sm:w-56"
      >
        {agents.map((agent) => (
          <DropdownMenuItem
            key={agent.id}
            onClick={() => handlePick(agent)}
            // Radix `disabled` KULLANILMIYOR: disabled item tıklamayı yemez,
            // toast hiç çıkmazdı. Satır tıklanabilir kalıp reddediyor.
            aria-disabled={agent.locked || undefined}
            className="flex items-center gap-2"
          >
            <span
              className={cn(
                "grid size-4 shrink-0 place-items-center overflow-hidden rounded-sm text-brand-deep",
                agent.locked && "opacity-55 saturate-50",
              )}
            >
              <IconOrLogo
                iconName={agent.iconName}
                logo={agent.logo}
                className="size-4"
              />
            </span>
            <span className={cn("flex-1", agent.locked && "text-muted-foreground")}>
              {agent.name}
            </span>
            {agent.locked ? (
              <HugeiconsIcon
                icon={SquareLock02Icon}
                className="size-3.5 shrink-0 text-brand"
                strokeWidth={2}
              />
            ) : (
              value === agent.id && (
                <HugeiconsIcon icon={Tick01Icon} className="size-3.5 text-brand-via" />
              )
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
