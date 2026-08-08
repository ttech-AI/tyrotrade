import { cn } from "@/lib/utils";
import { useBrandAccent } from "@/freight/hooks/useBrandAccent";

export interface TabItem {
  key: string;
  label: string;
  /** Right-aligned count badge (optional). */
  count?: number;
}

interface TabStripProps {
  tabs: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  className?: string;
}

/**
 * Theme-aware tab strip used across Data Management sections.
 *
 * Active tab uses `accent.tint` background + `accent.solid` text/underline,
 * tracking the live sidebar theme (light → sky, navy → gold, black → bright sky).
 * Replaces the previous hardcoded `bg-foreground / text-background` look.
 */
export function TabStrip({ tabs, activeKey, onChange, className }: TabStripProps) {
  const accent = useBrandAccent();

  return (
    <div className={cn("flex gap-1 overflow-x-auto", className)}>
      {tabs.map((t) => {
        const active = t.key === activeKey;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={cn(
              "relative inline-flex items-center gap-2 h-9 px-3.5 rounded-lg",
              "text-[12.5px] font-semibold whitespace-nowrap transition-all",
              "outline-none focus-visible:ring-2 focus-visible:ring-ring",
              !active && "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.05]"
            )}
            style={
              active
                ? {
                    backgroundColor: accent.tint,
                    color: accent.solid,
                    boxShadow: `inset 0 0 0 1px ${accent.ring}`,
                  }
                : undefined
            }
          >
            {t.label}
            {typeof t.count === "number" && (
              <span
                className={cn(
                  "inline-flex items-center justify-center rounded-full h-4.5 min-w-4.5 px-1.5",
                  "text-[10px] font-bold tabular-nums leading-none",
                  active ? "" : "bg-foreground/[0.08] text-muted-foreground"
                )}
                style={
                  active
                    ? {
                        background: accent.gradient,
                        color: "white",
                      }
                    : undefined
                }
              >
                {t.count.toLocaleString("tr-TR")}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
