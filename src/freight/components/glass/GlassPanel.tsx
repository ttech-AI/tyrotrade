import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "default" | "strong" | "subtle";

export interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: Tone;
  noise?: boolean;
  asChild?: boolean;
}

const toneClass: Record<Tone, string> = {
  default: "glass",
  strong: "glass glass-strong",
  subtle: "glass glass-subtle",
};

export const GlassPanel = React.forwardRef<HTMLDivElement, GlassPanelProps>(
  ({ className, tone = "default", noise = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(toneClass[tone], noise && "glass-noise", className)}
        {...props}
      >
        <div className="relative z-[3] h-full flex flex-col min-h-0 min-w-0">
          {children}
        </div>
      </div>
    );
  }
);
GlassPanel.displayName = "GlassPanel";

export const GlassCard = React.forwardRef<HTMLDivElement, GlassPanelProps>(
  ({ className, ...props }, ref) => (
    <GlassPanel
      ref={ref}
      className={cn("p-4", className)}
      {...props}
    />
  )
);
GlassCard.displayName = "GlassCard";
