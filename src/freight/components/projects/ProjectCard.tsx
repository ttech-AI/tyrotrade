import * as React from "react";
import { ArrowRight, Route, Ship } from "@/freight/icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { BubbleChatIcon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { type Project } from "@/freight/lib/dataverse/entities";
import { useBrandAccent } from "@/freight/hooks/useBrandAccent";
import { useLocale } from "@/hooks/useLocale";
import { TYRO_CHAT_TONE } from "@/freight/components/layout/TyroChatButton";
import { prefetchProjectExpenseLines } from "@/freight/hooks/useProjectExpenseLines";

/** Hover→click intent delay before warming the realised-expense cache.
 *  Long enough that cards the pointer merely sweeps over don't each fire
 *  a fetch; short enough to be done by the time the user clicks. */
const PREFETCH_INTENT_MS = 180;

interface ProjectCardProps {
  project: Project;
  selected: boolean;
  onClick: () => void;
  onQuickAsk?: (e: React.MouseEvent, project: Project) => void;
}


/** One voyage-lifecycle token per status, expanded into the dot fill, its
 *  halo ring and the label colour. Written as inline styles rather than
 *  Tailwind classes because the `--status-*` tokens carry the palette and
 *  Tailwind can't generate an arbitrary-alpha ring from a CSS variable
 *  without a class per status. */
function statusTone(token: string) {
  return {
    dot: token,
    ring: `color-mix(in oklab, ${token} 25%, transparent)`,
    // Pulled toward --foreground so the 10.5px uppercase label stays
    // legible on the card: several palettes put --status-nominated /
    // --status-commenced at a very light lightness. The source picked a
    // `-700` shade for the same reason; mixing does it in both themes.
    label: `color-mix(in oklab, ${token} 70%, var(--foreground))`,
  };
}

const STATUS_TONE: Record<
  string,
  { dot: string; ring: string; label: string }
> = {
  // Active voyage.
  Commenced: statusTone("var(--status-commenced)"),
  Completed: statusTone("var(--status-completed)"),
  // "Open" comes from the project-level status fallback when no vessel
  // status is set (legacy projects, mock data). Shares the "nominated"
  // step of the ramp, as it did in the source.
  Open: statusTone("var(--status-nominated)"),
  Closed: statusTone("var(--status-closed)"),
  // Vessel assigned, on-deck.
  Nominated: statusTone("var(--status-nominated)"),
  // Waiting for vessel assignment — the pending step of the ramp.
  "To Be Nominated": statusTone("var(--status-tbn)"),
  Cancelled: statusTone("var(--status-cancelled)"),
};

const FALLBACK_TONE = statusTone("var(--status-tbn)");

export function ProjectCard({ project, selected, onClick, onQuickAsk }: ProjectCardProps) {
  const accent = useBrandAccent();
  const { t } = useLocale();
  // Use vessel voyage status when present; fall back to project Open/Closed.
  const status = project.vesselPlan?.vesselStatus ?? project.status;
  const tone = STATUS_TONE[status] ?? FALLBACK_TONE;
  const lp = project.vesselPlan?.loadingPort.name;
  const dp = project.vesselPlan?.dischargePort.name;
  // Gemi adı — numeric-only RecID sızıntısı (F&O) ve "—" placeholder'ı
  // ele; gerçek gemi adı yoksa satır hiç render edilmez.
  const rawVessel = project.vesselPlan?.vesselName ?? "";
  const vesselName =
    rawVessel && rawVessel !== "—" && !/^\d[\d\s,.]*$/.test(rawVessel.trim())
      ? rawVessel
      : null;

  // Hover prefetch — warm the realised-expense chain so the right-rail
  // "Gider Karşılaştırması" card is already (or nearly) ready by the
  // time the user clicks. Debounced by intent; a passing sweep doesn't
  // fetch. prefetchProjectExpenseLines is a no-op if already cached /
  // in flight, so this is cheap to fire.
  const prefetchTimer = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const startPrefetch = React.useCallback(() => {
    prefetchTimer.current = setTimeout(
      () => prefetchProjectExpenseLines(project.projectNo),
      PREFETCH_INTENT_MS
    );
  }, [project.projectNo]);
  const cancelPrefetch = React.useCallback(() => {
    if (prefetchTimer.current) {
      clearTimeout(prefetchTimer.current);
      prefetchTimer.current = null;
    }
  }, []);
  React.useEffect(() => cancelPrefetch, [cancelPrefetch]); // clear on unmount

  return (
    <div
      className="relative group"
      onMouseEnter={startPrefetch}
      onMouseLeave={cancelPrefetch}
    >
    <button
      type="button"
      onClick={onClick}
      // Keyboard navigation is deliberate intent → prefetch immediately.
      onFocus={() => prefetchProjectExpenseLines(project.projectNo)}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "group relative w-full min-w-0 max-w-full text-left rounded-xl px-3 py-2.5 transition-colors overflow-hidden",
        "border outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
        selected
          ? "border-transparent"
          : "bg-card/40 border-border/60 hover:bg-card/70 hover:border-border"
      )}
      style={
        selected
          ? {
              boxShadow: `inset 0 0 0 1px ${accent.ring}`,
              backgroundColor: accent.tint,
            }
          : undefined
      }
    >
      {/* Selected — gradient mesh that fades inward from the left edge.
          Stays within ~28px so it doesn't bleed across the card surface. */}
      {selected && (
        <>
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 w-7 pointer-events-none"
            style={{
              background: `linear-gradient(90deg, ${accent.tint}, transparent)`,
            }}
          />
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 w-[3px] pointer-events-none"
            style={{ background: accent.gradient }}
          />
        </>
      )}

      {/* Row 1 — statü: renkli nokta + statü metni. Eskiden sadece
          seçilince çıkan alt-caption buraya, noktanın yanına taşındı ve
          artık her kartta görünür → durum tek bakışta okunur. */}
      <div className="relative flex items-center gap-1.5 min-w-0">
        <span
          className="size-2 rounded-full shrink-0"
          // `ring-2` written as a box-shadow: the ring colour is a
          // color-mix() on a CSS var, which Tailwind can't take as a
          // ring-* utility.
          style={{ backgroundColor: tone.dot, boxShadow: `0 0 0 2px ${tone.ring}` }}
          aria-hidden
        />
        <span
          // lang="en": statüler İngilizce ("Nominated", "Commenced").
          // CSS `uppercase` sayfanın tr locale'inde "i"→"İ" yapıyordu
          // ("NOMİNATED"); lang="en" ile doğru "NOMINATED" (i→I) olur.
          lang="en"
          className="font-semibold uppercase tracking-wide text-[10.5px] truncate min-w-0"
          style={{ color: tone.label }}
        >
          {status}
        </span>
      </div>

      {/* Row 2 — proje kodu + segment (statünün bir altına alındı). */}
      <div className="relative mt-1 flex items-center gap-1.5 min-w-0 text-[11.5px]">
        <span className="font-mono text-muted-foreground tracking-tight truncate min-w-0">
          {project.projectNo}
        </span>
        {project.segment && (
          <>
            <span className="text-muted-foreground/80 shrink-0">·</span>
            <span className="text-muted-foreground/80 truncate min-w-0">
              {project.segment}
            </span>
          </>
        )}
      </div>

      {/* Row 3 — title. Tam wrap: ellipsis YOK, ad sığmazsa aşağı
          satıra kayar (panel genişledi, çok satırlı adlar artık
          tamamen okunur). */}
      <h3 className="relative text-[14.5px] font-semibold leading-snug mt-1.5 break-words">
        {project.projectName}
      </h3>

      {/* Row 3 — route (kalkış → varış limanı). */}
      <div className="relative mt-1.5 flex items-center gap-1.5 min-w-0 text-[11.5px] text-muted-foreground">
        <Route
          className="size-3 shrink-0 opacity-60 text-muted-foreground"
          strokeWidth={2}
          aria-hidden
        />
        <span className="truncate min-w-0">{lp}</span>
        <ArrowRight className="size-3 shrink-0 opacity-50" />
        <span className="truncate min-w-0">{dp}</span>
        {/* Gemi adı yoksa rota en alt satır olur — chat ikonu (hover)
            altında metin kalmasın diye reserved trailing slot. */}
        {!vesselName && <span className="ml-auto size-6 shrink-0" aria-hidden />}
      </div>

      {/* Row 4 — gemi adı (yalnızca gerçek bir ad varsa). Rotanın
          hemen altında, çapa/gemi ikonuyla. Trailing slot, hover'da
          beliren TYRO Chat ikonunun altına metin kaçmasın diye. */}
      {vesselName && (
        <div className="relative mt-1 flex items-center gap-1.5 min-w-0 text-[11.5px] text-muted-foreground">
          <Ship
            className="size-3 shrink-0 opacity-60 text-muted-foreground"
            strokeWidth={2}
            aria-hidden
          />
          <span className="truncate min-w-0 font-medium text-foreground/70">
            {vesselName}
          </span>
          {/* Reserved trailing slot — chat ikonu boyutunda, hover'da
              metin reflow olmasın. */}
          <span className="ml-auto size-6 shrink-0" aria-hidden />
        </div>
      )}

    </button>

    {onQuickAsk && (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onQuickAsk(e, project); }}
        aria-label={t("proj.card.askInChat")}
        // Positioned at the route row's trailing edge — replaces the
        // tonnage display the user retired. Hover-only so the card
        // stays calm by default but the chat affordance is one
        // pixel away when the user mouses in.
        className="absolute bottom-2 right-2 size-6 rounded-lg grid place-items-center text-white shadow-md transition-transform opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95"
        style={{
          background: TYRO_CHAT_TONE.gradient,
          boxShadow: `0 3px 8px -2px ${TYRO_CHAT_TONE.ring}`,
        }}
      >
        <HugeiconsIcon icon={BubbleChatIcon} size={12} strokeWidth={2} />
      </button>
    )}
    </div>
  );
}
