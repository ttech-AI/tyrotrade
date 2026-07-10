import * as React from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Invoice03Icon } from "@hugeicons/core-free-icons";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { useT } from "@/lib/i18n/LanguageProvider";
import { type PendingPayments } from "@/lib/selectors/overview";

/**
 * "Ödeme Bekleyen Gemiler" — voyages whose ship plan carries a pending
 * payment status (`mserp_trypaymentstatus` reads "Beklemede" / pending).
 * Rows are sorted by "bekleme süresi" (waiting days) — the longest
 * waiting first — where waiting = days since the voyage's most recent
 * populated milestone. Rows deep-link into Sefer Takibi.
 *
 * The list fills the card and scrolls when there are more voyages than
 * fit — no "show more" collapse, so the card never grows past its grid
 * slot; the user simply scrolls the rest. A capped height (`max-h`) keeps
 * it bounded even on mobile, where the card stacks full-width with no
 * sibling to constrain it, and a bottom fade + chevron makes it obvious
 * there are more rows below when the list overflows.
 */
export function PendingPaymentsCard({
  pending,
}: {
  pending: PendingPayments;
}) {
  const t = useT();
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [moreBelow, setMoreBelow] = React.useState(false);

  const syncScrollHint = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    // >4px of unseen content below the viewport → there's more to scroll.
    const more = el.scrollHeight - el.clientHeight - el.scrollTop > 4;
    setMoreBelow((prev) => (prev === more ? prev : more));
  }, []);

  // Re-evaluate on mount, when the row set changes, and whenever the
  // scroll box is resized (responsive reflow / theme font swap).
  React.useEffect(() => {
    syncScrollHint();
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(syncScrollHint);
    ro.observe(el);
    return () => ro.disconnect();
  }, [syncScrollHint, pending.rows.length]);

  return (
    <GlassPanel
      tone="default"
      className="rounded-2xl h-full flex flex-col overflow-hidden"
    >
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <HugeiconsIcon
            icon={Invoice03Icon}
            size={16}
            strokeWidth={1.75}
            className="text-muted-foreground"
          />
          <h3 className="text-sm font-bold text-slate-900">
            {t("ov.pending.title")}
          </h3>
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {t("ov.pending.subtitle")}
        </p>
      </div>

      {pending.count === 0 ? (
        <div className="flex-1 grid place-items-center px-4 pb-6">
          <p className="text-[12.5px] text-muted-foreground text-center">
            {t("ov.pending.empty")}
          </p>
        </div>
      ) : (
        <>
          {/* Summary strip */}
          <div className="mx-3 rounded-xl bg-rose-500/[0.07] border border-rose-500/15 px-3.5 py-2.5 flex items-center gap-1.5">
            <span className="text-[22px] font-bold tabular-nums leading-none text-rose-600">
              {pending.count}
            </span>
            <span className="text-[11px] font-semibold text-rose-700/80">
              {t("ov.common.voyage")}
            </span>
          </div>

          {/* Rows — fill the card and scroll when longer than it fits.
              `min-h-0` lets this flex child shrink below its content so
              `overflow-y-auto` engages (instead of growing the card past
              its grid slot); `max-h` caps it on mobile where the card
              stacks full-width with no sibling to bound its height. */}
          <div className="relative flex-1 min-h-0">
            <div
              ref={scrollRef}
              onScroll={syncScrollHint}
              className="h-full max-h-[52vh] px-2 py-1.5 overflow-y-auto overscroll-contain"
            >
              {pending.rows.map((r) => (
                <Link
                  key={r.projectNo}
                  to={`/projects/${r.projectNo}`}
                  state={{ focusProjectNo: r.projectNo }}
                  className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-foreground/[0.04] transition-colors min-w-0"
                  title={`${r.projectNo} ${t("ov.pending.openInProjects")}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-medium text-foreground/90 truncate">
                      {r.label}
                    </div>
                    <div className="text-[10.5px] font-mono text-muted-foreground truncate">
                      {r.projectNo}
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold tabular-nums text-muted-foreground w-[52px] text-right shrink-0">
                    {r.days} {t("common.days")}
                  </span>
                  <ArrowUpRight
                    className="size-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    strokeWidth={2.25}
                  />
                </Link>
              ))}
            </div>
            {/* Scroll affordance — fades the last row and floats a chevron
                so it's obvious more voyages sit below. Uses the card's own
                glass tint so it reads correctly in every theme. Hidden
                (and non-interactive) once scrolled to the bottom. */}
            <div
              aria-hidden
              className={`pointer-events-none absolute inset-x-0 bottom-0 h-9 flex items-end justify-center bg-gradient-to-t from-[var(--glass-tint-strong)] to-transparent transition-opacity duration-200 ${
                moreBelow ? "opacity-100" : "opacity-0"
              }`}
            >
              <ChevronDown
                className="size-4 mb-1 text-muted-foreground"
                strokeWidth={2.25}
              />
            </div>
          </div>
        </>
      )}
    </GlassPanel>
  );
}
