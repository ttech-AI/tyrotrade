import * as React from "react";
import { Link, useMatch } from "react-router-dom";
import {
  Ship,
  Database,
  Settings,
  HelpCircle,
  Pin,
  PinOff,
} from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Home01Icon,
  BadgeDollarSignIcon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Wordmark } from "@/components/brand/Wordmark";
import { Logo } from "@/components/brand/Logo";
import { useSidebar } from "./sidebar-context";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { ProfileMenu } from "./ProfileMenu";

/** Wrapper to make HugeIcons compatible with the lucide-style ElementType nav signature.
 *  strokeWidth 1.75 lighter weight — matches SaaS sidebar conventions
 *  (Linear / Notion / Vercel) where icons read as "navigation hints",
 *  not headline glyphs. Heavier stroke (2+) competes with the label
 *  text and tires the eye over long sessions. */
function HomeLineIcon({ className }: { className?: string }) {
  return (
    <HugeiconsIcon icon={Home01Icon} className={className} strokeWidth={1.75} />
  );
}

function PLCostIcon({ className }: { className?: string }) {
  return (
    <HugeiconsIcon
      icon={BadgeDollarSignIcon}
      className={className}
      strokeWidth={1.75}
    />
  );
}

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

/** Sidebar groups — sentence-case Turkish labels, soft section headers.
 *  Pattern lifted from Linear / Notion / Vercel: short hint labels,
 *  not capitalised bombast. Grouping logic:
 *    "Operasyon"   → günlük / aktif takip için (Anasayfa + Sefer Takibi)
 *    "Analiz"      → karar destek + raporlama (Trade Cost)
 *    "Yönetim"     → veri kaynağı + admin (Veri Yönetimi)
 *    Bottom block  → sistem (TYRO Stock, Yardım, Tema, Ayarlar, Profil)
 *  The bottom block stays inline rendered (NOT via NAV_GROUPS) because
 *  it has heterogeneous items (external link + theme switcher + profile
 *  menu) that don't share the NavItemLink shape. */
const NAV_GROUPS: NavGroup[] = [
  {
    label: "Operasyon",
    items: [
      { to: "/", label: "Anasayfa", icon: HomeLineIcon },
      { to: "/projects", label: "Sefer Takibi", icon: Ship },
    ],
  },
  {
    label: "Analiz",
    items: [{ to: "/pl-cost", label: "Trade Cost", icon: PLCostIcon }],
  },
  {
    label: "Yönetim",
    items: [{ to: "/data", label: "Veri Yönetimi", icon: Database }],
  },
  {
    label: "Sistem",
    items: [
      { to: "/help", label: "Yardım", icon: HelpCircle },
      { to: "/settings", label: "Ayarlar", icon: Settings },
    ],
  },
];

interface AppSidebarProps {
  embedded?: boolean;
  onItemClick?: () => void;
}

export function AppSidebar({
  embedded = false,
  onItemClick,
}: AppSidebarProps) {
  const { expanded, pinned, togglePin, theme } = useSidebar();
  const showLabels = embedded || expanded;
  // First 3 groups (Operasyon / Analiz / Yönetim) render in the
  // scrolling nav area. Last group (Sistem) renders at the bottom
  // pinned to the profile + theme switcher. Sistem items are unpacked
  // because they share the bottom block with sibling-app shortcuts +
  // theme switcher (heterogeneous content, not a clean NavSection).
  const topGroups = NAV_GROUPS.slice(0, 3);
  const systemGroup = NAV_GROUPS[3];

  return (
    <TooltipProvider delayDuration={150} disableHoverableContent>
      <div
        data-sb-theme={theme}
        className={cn(
          "sidebar-themed flex flex-col h-full overflow-hidden relative rounded-[24px]",
          embedded && "w-full"
        )}
      >
        <div
          className={cn(
            "h-16 flex items-center px-3 shrink-0",
            showLabels ? "justify-between gap-2" : "justify-center"
          )}
        >
          {showLabels ? (
            <>
              <Wordmark
                variant="compact"
                onDark={theme !== "light"}
                palette={theme === "navy" ? "amber" : theme === "black" ? "sky-bright" : "sky"}
              />
              {!embedded && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={togglePin}
                      aria-label={
                        pinned ? "Sabitlemeyi kaldır" : "Sidebar'ı sabitle"
                      }
                      className={cn(
                        "shrink-0 transition-colors text-[var(--sb-text-faint)] hover:text-[var(--sb-text)] hover:bg-[var(--sb-hover-bg)]",
                        pinned &&
                          "text-[var(--sb-pin-active)] hover:text-[var(--sb-pin-active)]"
                      )}
                    >
                      {pinned ? (
                        <PinOff className="size-4" />
                      ) : (
                        <Pin className="size-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {pinned ? "Sabitlemeyi kaldır" : "Sidebar'ı sabitle"}
                  </TooltipContent>
                </Tooltip>
              )}
            </>
          ) : (
            <Logo
              size={34}
              onDark={theme !== "light"}
              palette={theme === "navy" ? "amber" : theme === "black" ? "sky-bright" : "sky"}
            />
          )}
        </div>

        <div className="px-3 pb-2">
          <div className="h-px bg-gradient-to-r from-transparent via-[var(--sb-divider)] to-transparent" />
        </div>

        <nav
          className={cn(
            "flex-1 overflow-y-auto overflow-x-hidden flex flex-col",
            showLabels ? "px-2 pt-1 gap-2" : "items-center px-0 pt-1 gap-1.5"
          )}
        >
          {topGroups.map((g, idx) => (
            <NavSection
              key={g.label}
              group={g}
              showLabels={showLabels}
              onItemClick={onItemClick}
              topDivider={idx > 0}
            />
          ))}
        </nav>

        <div
          className={cn(
            "pb-3 pt-2 shrink-0 flex flex-col",
            showLabels ? "px-2 gap-0.5" : "items-center px-0 gap-1.5"
          )}
        >
          <div
            className={cn(
              "mb-2 h-px bg-gradient-to-r from-transparent via-[var(--sb-divider)] to-transparent",
              !showLabels && "w-8 mx-auto"
            )}
          />
          {showLabels && (
            // Same softer dialect as `NavSection`'s section header above.
            <div className="px-3 pt-2.5 pb-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--sb-text-faint)]/85">
              {systemGroup.label}
            </div>
          )}
          {/* Sibling-app shortcuts above the Yardım nav item. */}
          <SidebarToolItem
            kind="link"
            href="https://tyrowms.github.io/"
            iconNode={<Logo size={18} palette="aurora" />}
            label="tyroStock"
            showLabel={showLabels}
            tooltip="tyroStock'u yeni sekmede aç"
            onClick={onItemClick}
          />
          <NavItemLink
            item={systemGroup.items[0]}
            showLabel={showLabels}
            onClick={onItemClick}
          />
          <ThemeSwitcher showLabel={showLabels} />
          <NavItemLink
            item={systemGroup.items[1]}
            showLabel={showLabels}
            onClick={onItemClick}
          />
          {/* Profile menu — pinned to the very bottom of the sidebar */}
          <div
            className={cn(
              "mt-2 mb-1 h-px bg-gradient-to-r from-transparent via-[var(--sb-divider)] to-transparent",
              !showLabels && "w-8 mx-auto"
            )}
          />
          <ProfileMenu expanded={showLabels} />
        </div>
      </div>
    </TooltipProvider>
  );
}

function NavSection({
  group,
  showLabels,
  onItemClick,
  topDivider,
  extra,
}: {
  group: NavGroup;
  showLabels: boolean;
  onItemClick?: () => void;
  topDivider?: boolean;
  extra?: React.ReactNode;
}) {
  return (
    <>
      {topDivider && !showLabels && (
        <div className="mb-1 h-px w-8 mx-auto bg-[var(--sb-divider)] opacity-60" />
      )}
      {showLabels && (
        // SaaS-pattern section label — capitalised but softer than
        // before: lighter weight (medium), tighter tracking, more
        // padding above to breathe between groups. Size bumped to
        // 11px to match the heavier nav-item typography.
        <div className="px-3 pt-2.5 pb-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--sb-text-faint)]/85">
          {group.label}
        </div>
      )}
      {group.items.map((item) => (
        <NavItemLink
          key={item.to}
          item={item}
          showLabel={showLabels}
          onClick={onItemClick}
        />
      ))}
      {extra}
    </>
  );
}

function NavItemLink({
  item,
  showLabel,
  onClick,
}: {
  item: NavItem;
  showLabel: boolean;
  onClick?: () => void;
}) {
  const Icon = item.icon;
  const match = useMatch({ path: item.to, end: item.to === "/" });
  const isActive = !!match;

  const inner = (
    <Link
      to={item.to}
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        // Text 14px / row 40px (h-10) — SaaS sidebar normu
        // (Linear / Notion / Vercel hepsi 14px).
        "group flex items-center rounded-xl text-[14px] font-medium transition-colors relative shrink-0",
        showLabel
          ? "h-10 w-full pl-3 pr-3 gap-3"
          : "h-11 w-11 justify-center px-0",
        // Elegant active state — boxed inset-bar + ring kombinasyonu
        // ağırdı, onun yerine Linear/Notion deseni: subtle bg tint +
        // semibold text + accent-coloured icon. Dekorasyon yok, sadece
        // typography + renk + bg konuşuyor. Çok daha modern, çok daha
        // zarif. Pin button'un aktif sidebar göstergesi rolünü gerek
        // yok burada tekrarlamaya — bg tint + accent icon yeterli ipucu.
        isActive
          ? "bg-[var(--sb-active-bg)] text-[var(--sb-text-strong)] font-semibold"
          : "text-[var(--sb-text-muted)] hover:text-[var(--sb-text)] hover:bg-[var(--sb-hover-bg)]"
      )}
    >
      {/* Icon 18px expanded, 20px collapsed — text ile orantılı.
       *  Aktifken accent rengini alır (icon, label'dan ayrı renkte) —
       *  bu küçük detay, label tek başına ağır olmadan, "bu sayfadasın"
       *  ipucu verir. */}
      <Icon
        className={cn(
          showLabel ? "size-[18px]" : "size-5",
          "shrink-0 transition-colors",
          isActive && "text-[var(--sb-pin-active)]"
        )}
      />
      {showLabel && <span className="truncate">{item.label}</span>}
    </Link>
  );

  if (!showLabel) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{inner}</TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    );
  }
  return inner;
}

/**
 * Sibling-app / AI shortcut row — mirrors `NavItemLink`'s layout
 * (same h-9 expanded row / h-10 w-10 collapsed icon-only) so the
 * Sistem group reads as one rhythmic stack. `kind="button"`
 * triggers an in-app action (AI drawer); `kind="link"` opens an
 * external URL in a new tab.
 *
 * `iconNode` is rendered as-is — callers pass a HugeIcon glyph,
 * a brand `<Logo>` SVG, or any other React element. An optional
 * `accentDot` colour pins a small dot to the icon's top-right
 * corner; omit it when the icon is already chromatic (e.g. the
 * full-colour TYRO Stock origami).
 */
function SidebarToolItem(
  props: {
    iconNode: React.ReactNode;
    label: string;
    tooltip: string;
    showLabel: boolean;
    /** Tiny indicator dot on the icon — usually omitted when the
     *  icon itself carries brand colour. */
    accentDot?: string;
    onClick?: () => void;
  } & (
    | { kind: "button" }
    | { kind: "link"; href: string }
  )
) {
  const { iconNode, label, tooltip, showLabel, accentDot, onClick } = props;

  const innerContent = (
    <>
      <span className="relative shrink-0 grid place-items-center size-5">
        {iconNode}
        {accentDot && (
          <span
            aria-hidden
            className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full"
            style={{ backgroundColor: accentDot }}
          />
        )}
      </span>
      {showLabel && <span className="truncate">{label}</span>}
    </>
  );

  // Matches NavItemLink — h-10 / 14px text / 18-20px icons / gap-3 so
  // Sistem block reads as a continuation of the primary nav rather
  // than a smaller orphan row.
  const sharedClassName = cn(
    "group flex items-center rounded-xl text-[14px] font-medium transition-colors relative shrink-0",
    showLabel
      ? "h-10 w-full pl-3 pr-3 gap-3"
      : "h-11 w-11 justify-center px-0",
    "text-[var(--sb-text-muted)] hover:text-[var(--sb-text)] hover:bg-[var(--sb-hover-bg)]"
  );

  const trigger =
    props.kind === "button" ? (
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={sharedClassName}
      >
        {innerContent}
      </button>
    ) : (
      <a
        href={props.href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
        aria-label={label}
        className={sharedClassName}
      >
        {innerContent}
      </a>
    );

  if (!showLabel) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
        <TooltipContent side="right">{tooltip}</TooltipContent>
      </Tooltip>
    );
  }
  return trigger;
}
