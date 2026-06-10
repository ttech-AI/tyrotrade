import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Clock01Icon } from "@hugeicons/core-free-icons";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { selectHeroImage } from "@/lib/routing/heroImages";
import {
  voyageDisplayLabel,
  type WaitingVessel,
} from "@/lib/selectors/overview";

/**
 * "En Uzun Bekleyen Gemi" — the single longest-waiting voyage (status
 * To Be Nominated / Nominated) as a hero-image card: status badge +
 * waiting-days pill over the image, then reason + since-date rows.
 * Up to 3 runner-up waiters render as compact rows below, so the card
 * answers "who else is stuck?" without leaving the page. Everything
 * deep-links into Sefer Takibi pre-filtered to that project.
 */

/** Same hero-badge palette ProjectOverviewCard uses (post-recolor). */
const STATUS_HERO_STYLE: Record<string, string> = {
  "To Be Nominated": "bg-amber-400 text-white border border-amber-300/60",
  Nominated: "bg-sky-500 text-white border border-sky-300/60",
};

export function LongestWaitingCard({
  waiting,
}: {
  waiting: WaitingVessel[];
}) {
  const top = waiting[0];
  const runnersUp = waiting.slice(1, 4);

  return (
    <GlassPanel
      tone="default"
      className="rounded-2xl h-full flex flex-col overflow-hidden"
    >
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <HugeiconsIcon
            icon={Clock01Icon}
            size={16}
            strokeWidth={1.75}
            className="text-muted-foreground"
          />
          <h3 className="text-sm font-bold text-slate-900">
            En Uzun Bekleyen Gemi
          </h3>
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Atama / yükleme bekleyen seferler · {waiting.length} sefer
        </p>
      </div>

      {!top ? (
        <div className="flex-1 grid place-items-center px-4 pb-6">
          <p className="text-[12.5px] text-muted-foreground text-center">
            Bekleyen sefer yok — tüm gemiler atanmış ve yolda. 🎉
          </p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Hero — image + badge + days pill, whole block deep-links */}
          <Link
            to={`/projects/${top.project.projectNo}`}
            state={{ focusProjectNo: top.project.projectNo }}
            className="group block relative h-32 shrink-0 mx-3 rounded-xl overflow-hidden"
            title={`${top.project.projectNo} projesini Sefer Takibi'nde aç`}
          >
            <img
              src={selectHeroImage(top.project)}
              alt={voyageDisplayLabel(top.project)}
              className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />
            <span
              className={cn(
                "absolute top-2 right-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold tracking-tight shadow-sm",
                STATUS_HERO_STYLE[
                  top.project.vesselPlan?.vesselStatus ?? ""
                ] ?? "bg-slate-600 text-white border border-slate-300/60"
              )}
              style={{
                boxShadow:
                  "inset 0 1px 0 0 rgba(255,255,255,0.3), 0 2px 6px -1px rgba(0,0,0,0.25)",
              }}
              lang="en"
            >
              {top.project.vesselPlan?.vesselStatus}
            </span>
            <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between gap-2">
              <span className="text-white text-[12.5px] font-semibold leading-snug line-clamp-2 min-w-0">
                {voyageDisplayLabel(top.project)}
              </span>
              <span className="shrink-0 inline-flex items-baseline gap-1 rounded-full bg-white/90 backdrop-blur-sm px-2.5 py-1 shadow-sm">
                <span className="text-[15px] font-bold tabular-nums text-amber-600 leading-none">
                  {top.days}
                </span>
                <span className="text-[10px] font-semibold text-amber-700/80">
                  gün
                </span>
              </span>
            </div>
          </Link>

          {/* Detail rows */}
          <div className="px-4 pt-3 pb-2 space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] min-w-0">
              <span className="font-mono text-muted-foreground shrink-0">
                {top.project.projectNo}
              </span>
              {top.project.segment && (
                <>
                  <span className="text-muted-foreground/60 shrink-0">·</span>
                  <span className="text-muted-foreground truncate">
                    {top.project.segment}
                  </span>
                </>
              )}
            </div>
            <DetailRow label="Bekleme Nedeni" value={top.reason} />
            <DetailRow
              label="Beklemeye Başladığı Tarih"
              value={formatDate(top.sinceIso)}
            />
          </div>

          {/* Runner-ups */}
          {runnersUp.length > 0 && (
            <div className="mt-auto border-t border-border/40 px-2 py-1.5">
              {runnersUp.map((w) => (
                <Link
                  key={w.project.projectNo}
                  to={`/projects/${w.project.projectNo}`}
                  state={{ focusProjectNo: w.project.projectNo }}
                  title={`${w.project.projectNo} projesini Sefer Takibi'nde aç`}
                  className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-foreground/[0.04] transition-colors min-w-0"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "size-1.5 rounded-full shrink-0",
                      w.project.vesselPlan?.vesselStatus === "To Be Nominated"
                        ? "bg-amber-400"
                        : "bg-sky-500"
                    )}
                  />
                  <span className="text-[11.5px] font-medium text-foreground/85 truncate min-w-0 flex-1">
                    {voyageDisplayLabel(w.project)}
                  </span>
                  <span className="text-[11.5px] font-bold tabular-nums text-amber-600 shrink-0">
                    {w.days} gün
                  </span>
                  <ArrowUpRight
                    className="size-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    strokeWidth={2.25}
                  />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </GlassPanel>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-[10.5px] uppercase tracking-wider text-muted-foreground shrink-0 pt-0.5">
        {label}
      </span>
      <span className="text-[12px] font-medium text-foreground/90 text-right min-w-0 line-clamp-2">
        {value}
      </span>
    </div>
  );
}
