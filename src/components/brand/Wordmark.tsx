import * as React from "react";
import { cn } from "@/lib/utils";
import { Logo, type LogoPalette } from "./Logo";

type Variant = "default" | "compact" | "logoOnly";

interface WordmarkProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  logoSize?: number;
  /** Dark/blue surface: `tyro` flips to white and `trade` uses a warm-only gradient. */
  onDark?: boolean;
  /** Color palette for logo + "Freight" gradient. Default "sky". */
  palette?: LogoPalette;
}

export const Wordmark = React.forwardRef<HTMLDivElement, WordmarkProps>(
  (
    { className, variant = "default", logoSize, onDark = false, palette = "sky", ...props },
    ref
  ) => {
    const size = logoSize ?? (variant === "compact" ? 30 : 40);

    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center gap-2.5 select-none",
          variant === "logoOnly" && "gap-0",
          className
        )}
        {...props}
      >
        <Logo size={size} onDark={onDark} palette={palette} />
        {variant !== "logoOnly" && (
          <div className="leading-none flex items-baseline gap-[1px]">
            <span
              className={cn(
                "font-extrabold tracking-tight lowercase",
                variant === "compact" ? "text-[17px]" : "text-[22px]",
                onDark ? "text-white" : "text-foreground"
              )}
              style={{ letterSpacing: "-0.025em" }}
            >
              tyro
            </span>
            <span
              className={cn(
                "font-extrabold tracking-tight",
                palette === "amber"
                  ? "text-amber-gradient"
                  : palette === "sky-bright"
                  ? "text-sky-bright-gradient"
                  : "text-brand-gradient",
                variant === "compact" ? "text-[17px]" : "text-[22px]"
              )}
              style={{ letterSpacing: "-0.025em" }}
            >
              Freight
            </span>
          </div>
        )}
      </div>
    );
  }
);
Wordmark.displayName = "Wordmark";
