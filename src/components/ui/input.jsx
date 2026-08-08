import * as React from "react"

import { cn } from "@/lib/utils"

function Input({
  className,
  type,
  ...props
}) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // text-base (16px) on mobile prevents iOS Safari's auto-zoom-on-focus;
        // sm:text-sm / md:text-xs falls back to compact desktop sizing.
        // h-10 on mobile keeps tap-targets near the 44pt WCAG/HIG floor;
        // sm:h-7 restores the original compact desktop height.
        "h-10 w-full min-w-0 rounded-md border border-input bg-input/20 px-2 py-0.5 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-xs/relaxed file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 sm:h-7 sm:text-sm md:text-xs/relaxed dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props} />
  );
}

export { Input }
