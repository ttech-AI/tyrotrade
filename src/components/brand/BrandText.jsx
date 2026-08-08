import { cn } from "@/lib/utils"

export function BrandText({ className }) {
  return (
    <span
      className={cn(
        "inline-flex items-baseline text-[18px] font-bold tracking-tight leading-none",
        className,
      )}
    >
      <span>tyro</span>
      <span className="text-brand">Trade</span>
    </span>
  )
}
