import { TyroLogo } from "@/components/brand/TyroLogo"
import { useLocale } from "@/hooks/useLocale"
import { cn } from "@/lib/utils"

export function Brand({ className, size = 28, showWordmark = true }) {
  const { t } = useLocale()
  return (
    <div className={cn("flex items-center gap-2 min-w-0", className)}>
      <TyroLogo size={size} />
      {showWordmark && (
        <span className="text-base font-semibold tracking-tight lowercase truncate">
          {t("brand.name")}
        </span>
      )}
    </div>
  )
}
