import { HugeiconsIcon } from "@hugeicons/react"
import { getIconByName } from "@/lib/iconRegistry"
import { cn } from "@/lib/utils"

export function IconOrLogo({ iconName, logo, className, size, strokeWidth = 1.6, alt = "" }) {
  if (logo) {
    // Logo fills the parent container fully — ignore the size className that's intended for icon sizing
    return (
      <img
        src={logo}
        alt={alt}
        className="size-full object-cover"
        draggable={false}
      />
    )
  }
  const icon = getIconByName(iconName)
  if (!icon) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center text-[10px] font-semibold opacity-60",
          className,
        )}
      >
        ?
      </span>
    )
  }
  return (
    <HugeiconsIcon
      icon={icon}
      className={className}
      size={size}
      strokeWidth={strokeWidth}
    />
  )
}
