import { cn } from "@/lib/utils"

export function PastelOrb({ className, label, children }) {
  return (
    <div
      role="img"
      aria-label={label}
      className={cn(
        "relative aspect-square w-full overflow-hidden rounded-full",
        "bg-[radial-gradient(circle_at_30%_25%,var(--brand-orb-0)_0%,var(--brand-orb-1)_10%,var(--brand-orb-2)_38%,var(--brand-orb-3)_72%,var(--brand-orb-4)_100%)]",
        className,
      )}
      style={{
        boxShadow: "inset -2px -3px 8px rgba(8, 80, 110, 0.25)",
      }}
    >
      <span
        className="pointer-events-none absolute left-[18%] top-[14%] h-1/3 w-1/3 rounded-full opacity-60 blur-[2px]"
        style={{ backgroundColor: "var(--brand-orb-1)" }}
      />
      <span className="pointer-events-none absolute right-[18%] bottom-[20%] h-1/5 w-1/5 rounded-full bg-[var(--brand-orb-2)]/55 blur-[3px]" />
      {children && (
        <span className="absolute inset-0 grid place-items-center">{children}</span>
      )}
    </div>
  )
}
