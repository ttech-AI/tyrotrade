import { Languages } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { Lang } from "@/lib/i18n/translations";

/**
 * Sidebar TR/EN language toggle — sits in the Sistem block right next to the
 * ThemeSwitcher. Expanded: a labelled row with an inline TR|EN segmented
 * control. Collapsed: an icon button (current lang badge) that flips on click.
 * Matches NavItemLink / ThemeSwitcher geometry so the block reads as one stack.
 */
export function LanguageToggle({ showLabel }: { showLabel: boolean }) {
  const { lang, setLang, t } = useLanguage();

  if (!showLabel) {
    const next: Lang = lang === "tr" ? "en" : "tr";
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setLang(next)}
            aria-label={`${t("sidebar.language")}: ${lang.toUpperCase()}`}
            className="group relative flex items-center justify-center rounded-xl h-11 w-11 shrink-0 text-[var(--sb-text-muted)] hover:text-[var(--sb-text)] hover:bg-[var(--sb-hover-bg)] transition-colors"
          >
            <Languages className="size-5 shrink-0" />
            <span className="absolute bottom-0.5 right-0.5 text-[8px] font-bold leading-none px-1 py-0.5 rounded-full bg-[var(--sb-active-bg)] text-[var(--sb-pin-active)]">
              {lang.toUpperCase()}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">
          {t("sidebar.language")} · {lang.toUpperCase()}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="flex items-center rounded-xl text-[14px] font-medium h-10 w-full pl-3 pr-2 gap-3 text-[var(--sb-text-muted)]">
      <Languages className="size-[18px] shrink-0" />
      <span className="truncate flex-1 text-left">{t("sidebar.language")}</span>
      <div
        role="radiogroup"
        aria-label={t("sidebar.language")}
        className="inline-flex items-center rounded-full p-0.5 gap-0.5 bg-[var(--sb-hover-bg)] shrink-0"
      >
        <Seg active={lang === "tr"} onClick={() => setLang("tr")} label="TR" />
        <Seg active={lang === "en"} onClick={() => setLang("en")} label="EN" />
      </div>
    </div>
  );
}

function Seg({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "h-6 px-2 rounded-full text-[11px] font-bold tracking-wide transition-colors",
        active
          ? "bg-[var(--sb-active-bg)] text-[var(--sb-pin-active)]"
          : "text-[var(--sb-text-faint)] hover:text-[var(--sb-text)]"
      )}
    >
      {label}
    </button>
  );
}
