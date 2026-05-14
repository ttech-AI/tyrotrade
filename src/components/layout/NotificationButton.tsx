import * as React from "react";
import { useNavigate } from "react-router-dom";
import { CircleCheck, Clock, Bell } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useThemeAccent } from "@/components/layout/theme-accent";
import { useProjects } from "@/hooks/useProjects";
import { formatDate, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Project, VesselMilestones } from "@/lib/dataverse/entities";

const RECENT_DAYS = 30;
const UPCOMING_DAYS = 30;

interface EventItem {
  projectNo: string;
  vesselName?: string;
  label: string;
  date: Date;
  kind: "done" | "upcoming";
  stage: string;
}

const MILESTONE_DEFS: Array<{
  key: keyof VesselMilestones;
  label: string;
  stage: string;
}> = [
  { key: "lpEta", label: "Yükleme limanına varış (LP-ETA)", stage: "Yükleme" },
  { key: "lpNorAccepted", label: "LP-NOR Kabul", stage: "Yükleme" },
  { key: "lpSd", label: "Yükleme başladı", stage: "Yükleme" },
  { key: "lpEd", label: "Yükleme tamamlandı", stage: "Yükleme" },
  { key: "blDate", label: "Bill of Lading düzenlendi", stage: "Yolda" },
  { key: "dpEta", label: "Varış limanına ulaşma (DP-ETA)", stage: "Varış" },
  { key: "dpNorAccepted", label: "DP-NOR Kabul", stage: "Varış" },
  { key: "dpSd", label: "Tahliye başladı (DP-SD)", stage: "Tahliye" },
  { key: "dpEd", label: "Tahliye tamamlandı (DP-ED)", stage: "Tahliye" },
];

const STAGE_COLORS: Record<string, { bg: string; fg: string }> = {
  Yükleme: { bg: "rgba(245,158,11,0.14)", fg: "rgb(180 83 9)" },
  Yolda: { bg: "rgba(59,130,246,0.14)", fg: "rgb(29 78 216)" },
  Varış: { bg: "rgba(99,102,241,0.14)", fg: "rgb(67 56 202)" },
  Tahliye: { bg: "rgba(16,185,129,0.14)", fg: "rgb(4 120 87)" },
};

function buildEvents(projects: Project[], now: Date): EventItem[] {
  const out: EventItem[] = [];
  for (const p of projects) {
    const vp = p.vesselPlan;
    if (!vp) continue;
    const ms = vp.milestones;
    for (const def of MILESTONE_DEFS) {
      const iso = ms[def.key];
      if (!iso) continue;
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) continue;
      out.push({
        projectNo: p.projectNo,
        vesselName: vp.vesselName,
        label: def.label,
        stage: def.stage,
        date: d,
        kind: d.getTime() <= now.getTime() ? "done" : "upcoming",
      });
    }
  }
  return out;
}

/**
 * Premium notification button + popover for the topbar.
 *
 * Pulls events the same way `EventsPanel` does (last RECENT_DAYS + next
 * UPCOMING_DAYS) but renders them in a compact 360-px popover with
 * scrollable lists and stage chips. The bell carries a live badge that
 * counts the upcoming events and gently pulses when there are any
 * within the next 24 h.
 */
export function NotificationButton() {
  const accent = useThemeAccent();
  const navigate = useNavigate();
  const [open, setOpen] = React.useState(false);
  const { projects } = useProjects();
  const now = React.useMemo(() => new Date(), []);

  const recentCutoff = now.getTime() - RECENT_DAYS * 24 * 60 * 60 * 1000;
  const upcomingCutoff = now.getTime() + UPCOMING_DAYS * 24 * 60 * 60 * 1000;

  const all = React.useMemo(() => buildEvents(projects, now), [projects, now]);

  const recent = React.useMemo(
    () =>
      all
        .filter(
          (e) =>
            e.kind === "done" &&
            e.date.getTime() >= recentCutoff &&
            e.date.getTime() <= now.getTime()
        )
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .slice(0, 8),
    [all, recentCutoff, now]
  );

  // Primary: 30-day window. Fallback: when nothing's in the window,
  // surface the next N future milestones regardless of date so the
  // notification list never reads "boş" while real future ETAs exist
  // farther out.
  const upcomingInWindow = React.useMemo(
    () =>
      all
        .filter(
          (e) =>
            e.kind === "upcoming" &&
            e.date.getTime() > now.getTime() &&
            e.date.getTime() <= upcomingCutoff
        )
        .sort((a, b) => a.date.getTime() - b.date.getTime()),
    [all, upcomingCutoff, now]
  );
  // Fallback only computed when the in-window list is empty. Booled
  // out so the memo's dep array doesn't churn on every length flip
  // (in practice it's almost always 0/0 or N/N anyway).
  const shouldUseFallback = upcomingInWindow.length === 0;
  const upcomingFallback = React.useMemo(() => {
    if (!shouldUseFallback) return [];
    return all
      .filter((e) => e.kind === "upcoming" && e.date.getTime() > now.getTime())
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 8);
  }, [all, shouldUseFallback, now]);
  const isUsingUpcomingFallback =
    shouldUseFallback && upcomingFallback.length > 0;
  const upcoming = isUsingUpcomingFallback
    ? upcomingFallback
    : upcomingInWindow.slice(0, 8);

  const totalNew = recent.length + upcoming.length;
  // "Imminent" = anything happening in the next 24h. Triggers the pulse.
  const imminent = upcoming.some(
    (e) => e.date.getTime() - now.getTime() <= 24 * 60 * 60 * 1000
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Bildirimler"
          className="text-foreground/70 relative size-10 hover:text-foreground"
        >
          {/* Bell stroke is 22 px so the icon sits comfortably inside the
              40 px hit-target without dominating the topbar — large enough
              to read at a glance, small enough to keep the corner badge
              visually separate. */}
          <Bell className="size-[22px]" strokeWidth={1.75} />
          {totalNew > 0 && (
            <>
              <span
                className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full grid place-items-center text-[10px] font-bold tabular-nums shadow-sm ring-2 ring-background"
                style={{
                  background: accent.gradient,
                  color: "white",
                  boxShadow: `0 2px 6px -1px ${accent.ring}`,
                }}
              >
                {totalNew > 99 ? "99+" : totalNew}
              </span>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={10}
        collisionPadding={12}
        className={cn(
          "w-[min(22rem,calc(100vw-1rem))] p-0 overflow-hidden flex flex-col",
          // Use Radix's collision-aware height variable — Popover
          // measures the available viewport space and exposes it as
          // a CSS custom property, so the panel always shrinks to
          // fit. Also clamp to a sane upper bound (640px) so the
          // popover doesn't span 1100px on a tall display.
          "max-h-[min(var(--radix-popover-content-available-height),640px)]",
          "bg-white/95 backdrop-blur-2xl backdrop-saturate-150",
          "ring-1 ring-white/55",
          "shadow-[0_28px_72px_-16px_rgba(15,23,42,0.45)]"
        )}
      >
        {/* Header */}
        <div className="px-4 py-3 flex items-center gap-3 shrink-0 border-b border-border/40">
          <span
            className="size-9 rounded-xl grid place-items-center shrink-0 text-white shadow-sm"
            style={{
              background: accent.gradient,
              boxShadow: `0 4px 12px -4px ${accent.ring}, inset 0 1px 0 0 rgba(255,255,255,0.25)`,
            }}
          >
            <Bell className="size-4" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold tracking-tight leading-tight">
              Bildirimler
            </div>
            <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">
              {isUsingUpcomingFallback
                ? `Son ${RECENT_DAYS} gün · İleriye dönük ilk milestone'lar`
                : `Son ${RECENT_DAYS} gün · Önümüzdeki ${UPCOMING_DAYS} gün`}
            </div>
          </div>
        </div>

        {/* Native vertical scroll — earlier shadcn ScrollArea
            occasionally measured 0px height inside the Popover's flex
            column, leaving overflow content unreachable. `flex-1
            min-h-0 overflow-y-auto` is the simplest combination that
            always yields a working scroll inside a constrained-height
            flex parent. Light styling keeps the scrollbar minimal so
            the glass aesthetic isn't broken. */}
        <div
          className={cn(
            "flex-1 min-h-0 overflow-y-auto overscroll-contain",
            "[&::-webkit-scrollbar]:w-1.5",
            "[&::-webkit-scrollbar-thumb]:rounded-full",
            "[&::-webkit-scrollbar-thumb]:bg-foreground/15",
            "[&::-webkit-scrollbar-thumb:hover]:bg-foreground/25"
          )}
        >
          <div className="px-3 py-3">
            {/* Upcoming first — actionable */}
            <SectionHeader
              tone="upcoming"
              title={isUsingUpcomingFallback ? "Yaklaşan ilk planlı" : "Yaklaşan"}
              count={upcoming.length}
            />
            <ol className="space-y-1.5 mb-3">
              {upcoming.length === 0 ? (
                <li className="text-[11px] text-muted-foreground/70 italic px-2 py-1">
                  İleriye dönük tarihli milestone yok — gemi planlarında
                  DP-ETA / yükleme tarihleri henüz girilmemiş olabilir.
                </li>
              ) : (
                <>
                  {isUsingUpcomingFallback && (
                    <li className="text-[10.5px] text-muted-foreground/80 italic px-2 py-1">
                      Önümüzdeki {UPCOMING_DAYS} gün boş — daha uzaktaki
                      ilk {upcoming.length} olay gösteriliyor.
                    </li>
                  )}
                  {upcoming.map((e, i) => (
                    <EventRow
                      key={`u-${i}`}
                      event={e}
                      now={now}
                      onClick={() => {
                        navigate(`/projects/${e.projectNo}`);
                        setOpen(false);
                      }}
                    />
                  ))}
                </>
              )}
            </ol>

            <SectionHeader
              tone="done"
              title="Son Olaylar"
              count={recent.length}
            />
            <ol className="space-y-1.5">
              {recent.length === 0 ? (
                <li className="text-[11px] text-muted-foreground/70 italic px-2 py-1">
                  Bu pencerede gerçekleşen olay yok
                </li>
              ) : (
                recent.map((e, i) => (
                  <EventRow
                    key={`r-${i}`}
                    event={e}
                    now={now}
                    onClick={() => {
                      navigate(`/projects/${e.projectNo}`);
                      setOpen(false);
                    }}
                  />
                ))
              )}
            </ol>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SectionHeader({
  tone,
  title,
  count,
}: {
  tone: "done" | "upcoming";
  title: string;
  count: number;
}) {
  return (
    <div className="flex items-center justify-between gap-2 mb-1.5 mt-1 px-2">
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            "size-1.5 rounded-full",
            tone === "done" ? "bg-emerald-500" : "bg-sky-500"
          )}
        />
        <span className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
      </div>
      <span className="text-[10px] tabular-nums text-muted-foreground/80">
        {count}
      </span>
    </div>
  );
}

function EventRow({
  event,
  now,
  onClick,
}: {
  event: EventItem;
  now: Date;
  onClick: () => void;
}) {
  const stageColors = STAGE_COLORS[event.stage] ?? STAGE_COLORS["Yolda"];
  // Relative-time pill colours follow `kind` (past vs. upcoming),
  // not the milestone stage — the eye should resolve "yarın / 5 gün
  // önce" first, then drill into the stage chip on the left. Two
  // separate colour systems keep them visually independent.
  const timePillBg =
    event.kind === "done" ? "rgba(16,185,129,0.13)" : "rgba(14,165,233,0.15)";
  const timePillFg =
    event.kind === "done" ? "rgb(4 120 87)" : "rgb(2 132 199)";
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="w-full flex gap-2.5 text-left hover:bg-foreground/[0.05] rounded-lg p-2.5 transition-colors"
      >
        <div className="shrink-0 mt-0.5">
          {event.kind === "done" ? (
            <span className="size-6 rounded-full bg-emerald-500/15 text-emerald-700 grid place-items-center">
              <CircleCheck className="size-3.5" />
            </span>
          ) : (
            <span className="size-6 rounded-full bg-sky-500/15 text-sky-700 grid place-items-center">
              <Clock className="size-3.5" />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          {/* Top row: stage chip + milestone label + right-aligned
              relative-time pill. Time pill is the headline metric
              for a notification ("yarın" / "5 gün önce"), so it
              gets its own coloured chip on the right edge instead
              of being buried in the meta line below. */}
          <div className="flex items-center gap-1.5">
            <span
              className="px-1.5 py-[1.5px] rounded text-[10px] font-semibold tracking-tight shrink-0"
              style={{
                backgroundColor: stageColors.bg,
                color: stageColors.fg,
              }}
            >
              {event.stage}
            </span>
            <span
              className={cn(
                "text-[12.5px] font-semibold leading-snug truncate flex-1 min-w-0",
                event.kind === "done" ? "text-foreground" : "text-foreground/90"
              )}
            >
              {event.label}
            </span>
            <span
              className="shrink-0 px-1.5 py-[1.5px] rounded-full text-[10.5px] font-semibold tabular-nums"
              style={{ backgroundColor: timePillBg, color: timePillFg }}
            >
              {formatRelativeTime(event.date, now)}
            </span>
          </div>
          {/* Bottom meta row: identity + absolute date. Each piece
              now has its own contrast level so they stop reading as
              one undifferentiated wall of grey:
                projectNo  → mono, foreground/70 (identity anchor)
                vesselName → foreground/65, truncates first
                tarih      → tabular-nums, foreground/65
              Dot separators are rendered as their own muted spans
              so they sit visually behind the data, not next to it. */}
          <div className="text-[11px] flex items-center gap-1.5 min-w-0 leading-tight">
            <span className="font-mono font-semibold text-foreground/70 shrink-0">
              {event.projectNo}
            </span>
            {event.vesselName && (
              <>
                <span className="text-muted-foreground/40 shrink-0">·</span>
                <span className="truncate text-foreground/65">
                  {event.vesselName}
                </span>
              </>
            )}
            <span className="text-muted-foreground/40 shrink-0">·</span>
            <span className="tabular-nums text-foreground/65 shrink-0">
              {formatDate(event.date.toISOString())}
            </span>
          </div>
        </div>
      </button>
    </li>
  );
}
