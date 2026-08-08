import { PastelOrb } from "@/components/brand/PastelOrb"
import { cn } from "@/lib/utils"

/**
 * User avatar that prefers the Microsoft Graph profile photo (data URL from
 * useMe().photoUrl) and gracefully falls back to the branded PastelOrb when
 * no photo is available.
 *
 * Drop-in shape compatible with PastelOrb: pass the same `label` and
 * `className`. When `photoUrl` is non-empty, we render a covered <img>;
 * otherwise PastelOrb renders with the user's name as aria-label.
 */
export function UserAvatar({ photoUrl, label, className, children }) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={label || ""}
        // Same shape as PastelOrb (aspect-square w-full rounded-full) so the
        // wrapper div sizes both the same way and the swap is invisible.
        className={cn(
          "relative aspect-square w-full overflow-hidden rounded-full object-cover",
          className,
        )}
      />
    )
  }
  return (
    <PastelOrb label={label} className={className}>
      {children}
    </PastelOrb>
  )
}
