import * as React from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  Home01Icon,
  ShipmentTrackingIcon,
  DatabaseIcon,
  Settings02Icon,
  FilterIcon,
  Notification03Icon,
  Robot01Icon,
  ChatEdit01Icon,
  RefreshIcon,
  HelpCircleIcon,
} from "@hugeicons/core-free-icons";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useThemeAccent } from "@/components/layout/theme-accent";
import { useT } from "@/lib/i18n/LanguageProvider";
import { cn } from "@/lib/utils";

interface HelpSection {
  /** Anchor / route this card explains. */
  to?: string;
  icon: IconSvgElement;
  /** Translation key for the card title. */
  titleKey: string;
  /** Translation key for the one-line tagline shown next to the title. */
  taglineKey: string;
  /** Translation key for the body paragraph. */
  bodyKey: string;
  /** Translation keys for the bulleted feature list. */
  bulletKeys?: string[];
}

const PAGE_SECTIONS: HelpSection[] = [
  {
    to: "/",
    icon: Home01Icon,
    titleKey: "help.page.dashboard.title",
    taglineKey: "help.page.dashboard.tagline",
    bodyKey: "help.page.dashboard.body",
    bulletKeys: [
      "help.page.dashboard.b1",
      "help.page.dashboard.b2",
      "help.page.dashboard.b3",
      "help.page.dashboard.b4",
      "help.page.dashboard.b5",
    ],
  },
  {
    to: "/projects",
    icon: ShipmentTrackingIcon,
    titleKey: "help.page.projects.title",
    taglineKey: "help.page.projects.tagline",
    bodyKey: "help.page.projects.body",
    bulletKeys: [
      "help.page.projects.b1",
      "help.page.projects.b2",
      "help.page.projects.b3",
      "help.page.projects.b4",
    ],
  },
  {
    to: "/data",
    icon: DatabaseIcon,
    titleKey: "help.page.data.title",
    taglineKey: "help.page.data.tagline",
    bodyKey: "help.page.data.body",
    bulletKeys: [
      "help.page.data.b1",
      "help.page.data.b2",
      "help.page.data.b3",
      "help.page.data.b4",
    ],
  },
  {
    to: "/settings",
    icon: Settings02Icon,
    titleKey: "help.page.settings.title",
    taglineKey: "help.page.settings.tagline",
    bodyKey: "help.page.settings.body",
    bulletKeys: [
      "help.page.settings.b1",
      "help.page.settings.b2",
      "help.page.settings.b3",
      "help.page.settings.b4",
    ],
  },
];

interface ButtonHelp {
  icon: IconSvgElement;
  /** Translation key for the button title. */
  titleKey: string;
  /** Translation key for the button body. */
  bodyKey: string;
}

const TOPBAR_BUTTONS: ButtonHelp[] = [
  {
    icon: FilterIcon,
    titleKey: "help.topbar.filter.title",
    bodyKey: "help.topbar.filter.body",
  },
  {
    icon: Notification03Icon,
    titleKey: "help.topbar.notification.title",
    bodyKey: "help.topbar.notification.body",
  },
  {
    icon: Robot01Icon,
    titleKey: "help.topbar.ai.title",
    bodyKey: "help.topbar.ai.body",
  },
  {
    icon: ChatEdit01Icon,
    titleKey: "help.topbar.chat.title",
    bodyKey: "help.topbar.chat.body",
  },
  {
    icon: RefreshIcon,
    titleKey: "help.topbar.refresh.title",
    bodyKey: "help.topbar.refresh.body",
  },
];

const KEYBOARD_SHORTCUTS: Array<{ keys: string; actionKey: string }> = [
  { keys: "⌘ K", actionKey: "help.kbd.cmdk" },
  { keys: "Esc", actionKey: "help.kbd.esc" },
  { keys: "Tab / ⇧ Tab", actionKey: "help.kbd.tab" },
];

/**
 * /help — single-scroll help/onboarding page. Theme-aware: hero panel
 * + section icon pills track the live sidebar accent so the help
 * surface speaks the same brand language as the rest of the app.
 */
export function HelpPage() {
  const accent = useThemeAccent();
  const t = useT();

  return (
    <ScrollArea className="h-full">
      <div className="max-w-4xl mx-auto px-3 py-4 space-y-4">
        {/* Hero */}
        <GlassPanel tone="default" className="rounded-2xl">
          <div className="px-6 py-6 flex items-center gap-4">
            <span
              className="size-12 rounded-2xl grid place-items-center text-white shadow-sm shrink-0"
              style={{
                background: accent.gradient,
                boxShadow: `0 6px 18px -4px ${accent.ring}, inset 0 1px 0 0 rgba(255,255,255,0.30)`,
              }}
            >
              <HugeiconsIcon
                icon={HelpCircleIcon}
                size={24}
                strokeWidth={1.75}
              />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                {t("help.hero.title")}
              </h1>
              <p className="text-[12.5px] text-foreground/70 mt-1 leading-snug">
                {t("help.hero.body")}
              </p>
            </div>
          </div>
        </GlassPanel>

        {/* Pages */}
        <SectionTitle>{t("help.section.pages")}</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {PAGE_SECTIONS.map((s) => (
            <PageHelpCard key={s.titleKey} section={s} accent={accent} />
          ))}
        </div>

        {/* Topbar buttons */}
        <SectionTitle>{t("help.section.topbar")}</SectionTitle>
        <GlassPanel tone="default" className="rounded-2xl">
          <ul className="divide-y divide-border/50">
            {TOPBAR_BUTTONS.map((b) => (
              <li key={b.titleKey} className="px-5 py-4 flex items-start gap-3">
                <span
                  className="size-9 rounded-xl grid place-items-center text-white shrink-0 shadow-sm"
                  style={{
                    background: accent.gradient,
                    boxShadow: `0 4px 12px -4px ${accent.ring}, inset 0 1px 0 0 rgba(255,255,255,0.25)`,
                  }}
                >
                  <HugeiconsIcon icon={b.icon} size={16} strokeWidth={1.85} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-semibold text-slate-900 leading-tight">
                    {t(b.titleKey)}
                  </div>
                  <p className="text-[12px] text-foreground/70 mt-1 leading-relaxed">
                    {t(b.bodyKey)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </GlassPanel>

        {/* Keyboard shortcuts */}
        <SectionTitle>{t("help.section.shortcuts")}</SectionTitle>
        <GlassPanel tone="default" className="rounded-2xl">
          <ul className="divide-y divide-border/50">
            {KEYBOARD_SHORTCUTS.map((k) => (
              <li
                key={k.keys}
                className="px-5 py-3 flex items-center justify-between gap-4"
              >
                <span className="text-[12.5px] text-foreground/85">
                  {t(k.actionKey)}
                </span>
                <kbd
                  className="font-mono text-[11px] font-semibold px-2.5 py-1 rounded-lg shrink-0"
                  style={{
                    color: accent.stops[2],
                    background: accent.tint,
                    boxShadow: `inset 0 0 0 1px ${accent.ring}, inset 0 -1px 0 0 rgba(255,255,255,0.25)`,
                  }}
                >
                  {k.keys}
                </kbd>
              </li>
            ))}
          </ul>
        </GlassPanel>

        {/* Footer */}
        <p className="text-[11px] text-foreground/55 px-1 pb-2">
          {t("help.footer")}
        </p>
      </div>
    </ScrollArea>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-foreground/65 px-2 pt-2">
      {children}
    </h2>
  );
}

function PageHelpCard({
  section,
  accent,
}: {
  section: HelpSection;
  accent: ReturnType<typeof useThemeAccent>;
}) {
  const t = useT();
  const inner = (
    <GlassPanel
      tone="default"
      className={cn(
        "rounded-2xl h-full transition-all",
        section.to && "hover:shadow-lg hover:-translate-y-px"
      )}
    >
      <div className="p-5 flex flex-col gap-3 h-full">
        <div className="flex items-start gap-3">
          <span
            className="size-10 rounded-xl grid place-items-center text-white shrink-0 shadow-sm"
            style={{
              background: accent.gradient,
              boxShadow: `0 4px 12px -4px ${accent.ring}, inset 0 1px 0 0 rgba(255,255,255,0.25)`,
            }}
          >
            <HugeiconsIcon icon={section.icon} size={18} strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="text-[14px] font-bold text-slate-900 leading-tight">
                {t(section.titleKey)}
              </h3>
              {section.to && (
                <ChevronRight className="size-3.5 text-foreground/40" />
              )}
            </div>
            <p className="text-[10.5px] uppercase tracking-wider text-foreground/60 mt-0.5">
              {t(section.taglineKey)}
            </p>
          </div>
        </div>
        <p className="text-[12px] text-foreground/75 leading-relaxed">
          {t(section.bodyKey)}
        </p>
        {section.bulletKeys && (
          <ul className="space-y-1.5 mt-auto">
            {section.bulletKeys.map((b) => (
              <li
                key={b}
                className="flex items-start gap-2 text-[11.5px] text-foreground/75"
              >
                <span
                  className="mt-1.5 size-1.5 rounded-full shrink-0"
                  style={{ background: accent.solid }}
                />
                <span>{t(b)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </GlassPanel>
  );

  if (!section.to) return inner;
  return (
    <Link to={section.to} className="block">
      {inner}
    </Link>
  );
}
