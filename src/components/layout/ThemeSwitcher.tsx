import { Palette, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSidebar, type SidebarTheme } from "./sidebar-context";
import { useThemeAccent } from "./theme-accent";

interface ThemeOption {
  value: SidebarTheme;
  label: string;
  description: string;
  /** Sidebar surface gradient — same as the live theme. */
  surface: string;
  /** Accent gradient (used for the wordmark on this theme). */
  accent: string;
  /** "tyro" text color over the surface swatch. */
  tyroColor: string;
  /** Tiny dot color in the corner — represents the active highlight. */
  dot: string;
}

const THEME_OPTIONS: ThemeOption[] = [
  {
    value: "light",
    label: "Light",
    description: "Beyaz frosted · sky vurgu",
    surface: "linear-gradient(160deg, #ffffff 0%, #f1f5f9 100%)",
    accent: "linear-gradient(90deg, #38bdf8, #2563eb, #1e3a8a)",
    tyroColor: "#0f172a",
    dot: "#1e3a8a",
  },
  {
    value: "navy",
    label: "Navy",
    description: "Koyu navy · gold vurgu",
    surface: "#0b1e3f",
    accent: "linear-gradient(90deg, #e0ad3e, #c8922a, #e0ad3e)",
    tyroColor: "#ffffff",
    dot: "#e0ad3e",
  },
  {
    value: "black",
    label: "Black",
    description: "Premium siyah · sky vurgu",
    surface: "linear-gradient(160deg, #050505 0%, #1a1a1a 100%)",
    accent: "linear-gradient(90deg, #7dd3fc, #38bdf8, #0ea5e9)",
    tyroColor: "#ffffff",
    dot: "#38bdf8",
  },
];

interface ThemeSwitcherProps {
  showLabel: boolean;
}

export function ThemeSwitcher({ showLabel }: ThemeSwitcherProps) {
  const { theme, setTheme } = useSidebar();
  const accent = useThemeAccent();
  const active = THEME_OPTIONS.find((o) => o.value === theme);
  // Mid stop of the active theme — used as the visible ring around the
  // small swatch in the sidebar trigger so the indicator picks up the
  // current theme's signature accent (sky/gold/cyan mid).
  const swatchRing = accent.stops[1];

  const trigger = (
    <button
      type="button"
      aria-label="Sidebar teması"
      className={cn(
        // Same dimensions as NavItemLink + SidebarToolItem so the
        // bottom Sistem block reads as one rhythmic stack.
        "group flex items-center rounded-xl text-[14px] font-medium transition-all relative shrink-0",
        showLabel
          ? "h-10 w-full pl-3 pr-3 gap-3"
          : "h-11 w-11 justify-center px-0",
        "text-[var(--sb-text-muted)] hover:text-[var(--sb-text)] hover:bg-[var(--sb-hover-bg)]"
      )}
    >
      <Palette
        className={cn(showLabel ? "size-[18px]" : "size-5", "shrink-0")}
      />
      {showLabel && (
        <>
          <span className="truncate flex-1 text-left">Tema</span>
          {/* Ring colour comes from the active theme's mid stop so
              the small swatch picks up the current theme's signature
              hue (sky / gold / cyan) instead of a generic neutral. */}
          <span
            className="size-4 rounded-full shrink-0 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25)]"
            style={{
              background: active?.surface,
              boxShadow: `0 0 0 2px ${swatchRing}, inset 0 1px 0 0 rgba(255,255,255,0.25)`,
            }}
            aria-hidden
          />
        </>
      )}
    </button>
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        {showLabel ? (
          trigger
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>{trigger}</TooltipTrigger>
            <TooltipContent side="right">Tema</TooltipContent>
          </Tooltip>
        )}
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="end"
        sideOffset={14}
        className={cn(
          "w-[340px] p-0 overflow-hidden",
          // Opaque white panel — the previous frosted .glass background
          // let the underlying sidebar surface bleed through, making
          // theme swatches read against the wrong palette. Solid
          // bg-white + saturated backdrop-blur keeps the swatches
          // legible regardless of what's behind the popover.
          "bg-white backdrop-blur-2xl backdrop-saturate-150",
          "ring-1 ring-foreground/10",
          "shadow-[0_28px_70px_-14px_rgba(15,23,42,0.45),0_8px_24px_-8px_rgba(15,23,42,0.18)]"
        )}
      >
        {/* Top specular hairline — extra glass cue */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent z-10"
        />
        <div className="relative px-4 py-3 border-b border-white/35">
          <div className="text-[13px] font-semibold tracking-tight">
            Sidebar Teması
          </div>
          <div className="text-[10.5px] text-muted-foreground mt-0.5">
            Sadece sidebar'ı etkiler — uygulamanın geri kalanı değişmez
          </div>
        </div>
        <div className="relative p-2.5 grid grid-cols-3 gap-2">
          {THEME_OPTIONS.map((opt) => {
            const isActive = theme === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTheme(opt.value)}
                className={cn(
                  "group relative flex flex-col items-center gap-2 p-2 rounded-xl transition-all",
                  "ring-1 ring-transparent",
                  isActive
                    ? "ring-foreground/20"
                    : "hover:ring-foreground/10"
                )}
              >
                <ThemeAvatar option={opt} active={isActive} />
                <div className="text-center">
                  <div className="text-[11.5px] font-semibold tracking-tight flex items-center justify-center gap-1">
                    {opt.label}
                    {isActive && (
                      <Check
                        className="size-3 text-emerald-600"
                        strokeWidth={3}
                      />
                    )}
                  </div>
                  <div className="text-[9.5px] text-muted-foreground leading-tight mt-0.5">
                    {opt.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ThemeAvatar({
  option,
  active,
}: {
  option: ThemeOption;
  active: boolean;
}) {
  return (
    <div
      className={cn(
        "relative w-full aspect-[4/3] rounded-lg overflow-hidden",
        "border border-foreground/10",
        "shadow-[0_1px_2px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.18)]",
        active && "ring-1 ring-foreground/20"
      )}
      style={{ background: option.surface }}
    >
      {/* Minimal mock — most of the swatch shows the surface color cleanly.
       * One small wordmark + a single thin accent bar so the theme color
       * (navy / white / black) stays dominant. */}
      <div className="absolute inset-0 px-2 py-2 flex flex-col justify-between">
        <span
          className="text-[7.5px] font-extrabold leading-none lowercase flex items-baseline tracking-tight"
          style={{ color: option.tyroColor }}
        >
          tyro
          <span
            style={{
              background: option.accent,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            trade
          </span>
        </span>
        {/* Single accent bar — represents the active sidebar item indicator */}
        <div
          className="h-[3px] w-1/2 rounded-full"
          style={{ backgroundImage: option.accent }}
        />
      </div>
      {/* Top-right active dot */}
      <span
        className="absolute top-1 right-1 size-1.5 rounded-full ring-1 ring-white/40"
        style={{ backgroundColor: option.dot }}
        aria-hidden
      />
    </div>
  );
}
