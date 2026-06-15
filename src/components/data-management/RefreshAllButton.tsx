import * as React from "react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { RefreshIcon } from "@hugeicons/core-free-icons";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useThemeAccent } from "@/components/layout/theme-accent";
import { readCache } from "@/lib/storage/entityCache";
import { describeProjectFilter } from "@/lib/dataverse/refreshAll";
import { useT } from "@/lib/i18n/LanguageProvider";
import {
  RefreshErrorToast,
  RefreshLoadingToast,
  RefreshSuccessToast,
} from "@/components/ui/refresh-toast";

interface RefreshAllButtonProps {
  /** Async functions to invoke sequentially. Each one returns when its fetch
   *  + cache write are complete. */
  steps: Array<{ label: string; refetch: () => Promise<void> }>;
  className?: string;
}

/**
 * Premium gradient refresh button — visually mirrors `AskAiButton` so the two
 * primary call-to-actions feel like a coherent pair (one pulls fresh data,
 * the other talks to the AI). Sky-navy theme accent gradient, animated
 * shimmer on hover, icon spins while busy.
 *
 * Idle label: "Güncelle". While running: "<currentEntity>… X/N".
 */
export function RefreshAllButton({
  steps,
  className,
}: RefreshAllButtonProps) {
  const t = useT();
  const accent = useThemeAccent();
  const [hovered, setHovered] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [currentLabel, setCurrentLabel] = React.useState("");
  const [progress, setProgress] = React.useState({ done: 0, total: 0 });

  async function refreshAll() {
    if (busy) return;
    setBusy(true);
    setProgress({ done: 0, total: steps.length });
    const startedAt = Date.now();

    // Single sticky toast that progressively swaps from loading →
    // success/error via sonner's id-based update. unstyled flag lets
    // our custom JSX carry its own surface — same component the
    // post-login auto-refresh fires.
    const toastId = toast.custom(
      () => (
        <RefreshLoadingToast
          stepLabel={steps[0]?.label}
          current={0}
          total={steps.length}
        />
      ),
      { duration: Infinity, unstyled: true }
    );

    let failedStep: string | null = null;
    let failureMessage: string | null = null;
    try {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        setCurrentLabel(step.label);
        toast.custom(
          () => (
            <RefreshLoadingToast
              stepLabel={step.label}
              current={i + 1}
              total={steps.length}
            />
          ),
          { id: toastId, duration: Infinity, unstyled: true }
        );
        try {
          await step.refetch();
        } catch (err) {
          failedStep = step.label;
          failureMessage = err instanceof Error ? err.message : String(err);
          break;
        }
        setProgress({ done: i + 1, total: steps.length });
      }
    } finally {
      setBusy(false);
      setCurrentLabel("");
    }

    const durationSec = (Date.now() - startedAt) / 1000;

    if (failedStep) {
      toast.custom(
        () => (
          <RefreshErrorToast
            stepLabel={failedStep ?? undefined}
            message={failureMessage ?? undefined}
          />
        ),
        { id: toastId, duration: 8000, unstyled: true }
      );
    } else {
      // Pull project count from the just-written cache so the success
      // toast can show "437 proje senkronlandı". Falls back gracefully
      // when the cache slot is unexpectedly missing.
      const cached = readCache(
        "mserp_etgtryprojecttableentities"
      );
      const projectCount = cached?.totalCount ?? cached?.value.length;
      toast.custom(
        () => (
          <RefreshSuccessToast
            projectCount={projectCount}
            durationSec={durationSec}
            stepCount={steps.length}
          />
        ),
        { id: toastId, duration: 5000, unstyled: true }
      );
    }
  }

  const label = busy
    ? `${currentLabel}… ${progress.done}/${progress.total}`
    : t("dm.refresh.label");
  const filterDescription = describeProjectFilter();

  const button = (
    <button
      type="button"
      onClick={refreshAll}
      disabled={busy}
      data-testid="refresh-all-button"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "group relative inline-flex items-center gap-2 shrink-0 self-center",
        "rounded-full px-3.5 h-9 text-[13px] font-semibold text-white",
        "ring-1 ring-white/15 hover:ring-white/30",
        "transition-all duration-200",
        "hover:scale-[1.04]",
        "active:scale-95",
        "disabled:opacity-85 disabled:cursor-wait disabled:hover:scale-100",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "overflow-hidden whitespace-nowrap min-w-[120px] justify-center",
        className
      )}
      style={{
        background: accent.gradient,
        boxShadow: `0 4px 12px -4px ${accent.ring}, inset 0 1px 0 0 rgba(255,255,255,0.2)`,
      }}
    >
      {/* Animated shimmer overlay on hover (skipped while busy) */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-0 rounded-full pointer-events-none",
          "before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/30 before:to-transparent",
          "before:translate-x-[-120%] before:transition-transform before:duration-700",
          hovered && !busy && "before:translate-x-[120%]"
        )}
      />
      <HugeiconsIcon
        icon={RefreshIcon}
        size={16}
        strokeWidth={2}
        className={cn(
          "shrink-0 relative z-[1] transition-transform duration-300",
          busy
            ? "animate-spin"
            : hovered
              ? "rotate-[120deg] scale-110"
              : "rotate-0"
        )}
      />
      <span className="relative z-[1] tracking-tight">{label}</span>
    </button>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="end"
          sideOffset={8}
          className={cn(
            "p-0 max-w-[340px]",
            "bg-white/97 backdrop-blur-2xl backdrop-saturate-150",
            "ring-1 ring-foreground/10",
            "shadow-[0_18px_44px_-14px_rgba(15,23,42,0.32)]"
          )}
        >
          <div
            className="px-3.5 py-2 border-b border-border/40 flex items-center gap-2"
            style={{
              background: `linear-gradient(135deg, ${accent.tint} 0%, transparent 100%)`,
            }}
          >
            <HugeiconsIcon
              icon={RefreshIcon}
              size={14}
              strokeWidth={2}
              style={{ color: accent.solid }}
            />
            <span className="text-[12px] font-bold uppercase tracking-wider text-slate-900">
              {t("dm.refresh.tooltip.title")}
            </span>
          </div>
          <div className="px-3.5 py-2.5 space-y-1.5">
            <div className="text-[11px] text-slate-700 leading-relaxed">
              {(() => {
                // Render the lead with its emphasis phrase bolded — split
                // the localized lead on the localized bold substring so the
                // <span> emphasis survives in both TR and EN.
                const lead = t("dm.refresh.tooltip.lead");
                const bold = t("dm.refresh.tooltip.leadBold");
                const idx = lead.indexOf(bold);
                if (idx === -1) return lead;
                return (
                  <>
                    {lead.slice(0, idx)}
                    <span className="font-semibold text-slate-900">{bold}</span>
                    {lead.slice(idx + bold.length)}
                  </>
                );
              })()}
            </div>
            <ul className="space-y-0.5 pt-1">
              {filterDescription.split("\n").map((line, i) => (
                <li
                  key={i}
                  className="text-[11px] font-mono leading-snug"
                  style={{ color: accent.stops[2] }}
                >
                  {line}
                </li>
              ))}
            </ul>
            <div className="text-[10.5px] text-foreground/65 leading-snug pt-1.5 border-t border-border/30 mt-2">
              {t("dm.refresh.tooltip.chain")}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
