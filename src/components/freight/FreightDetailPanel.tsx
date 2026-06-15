import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  BoatIcon,
  Calendar03Icon,
  Package01Icon,
  Note01Icon,
} from "@hugeicons/core-free-icons";
import { useThemeAccent } from "@/components/layout/theme-accent";
import { useT } from "@/lib/i18n/LanguageProvider";
import { cn } from "@/lib/utils";
import { formatFreightRate, formatDate, formatNumber } from "@/lib/format";
import type { FreightLane } from "@/lib/selectors/freight";
import { FreightSparkline } from "./FreightSparkline";

const DELTA_UP = "#e11d48";
const DELTA_DOWN = "#059669";
const DELTA_FLAT = "#64748b";

function deltaColor(delta: number | null): string {
  if (delta == null || Math.abs(delta) < 0.5) return DELTA_FLAT;
  return delta > 0 ? DELTA_UP : DELTA_DOWN;
}

function priceRange(a: number | null, b: number | null, currency: string): string {
  if (a == null) return "—";
  if (b != null && Math.abs(b - a) > 0.001) {
    return `${formatNumber(a, a % 1 ? 2 : 0)}–${formatNumber(
      b,
      b % 1 ? 2 : 0
    )} ${currency}/t`;
  }
  return formatFreightRate(a, currency);
}

function tonnage(a: number | null, b: number | null): string {
  if (a == null && b == null) return "—";
  if (a != null && b != null && a !== b)
    return `${formatNumber(a)} – ${formatNumber(b)} t`;
  return `${formatNumber((a ?? b) as number)} t`;
}

/**
 * Lane detail rail — slides in from the right when a lane is selected in
 * the table or top-lanes chart. Shows the full lane profile: current rate
 * hero, route meta (distance / duration from the header), current-quote
 * attributes, a price-history trend, and every quote window.
 */
export function FreightDetailPanel({
  lane,
  onClose,
}: {
  lane: FreightLane | null;
  onClose: () => void;
}) {
  const accent = useThemeAccent();
  const t = useT();
  return (
    <AnimatePresence>
      {lane && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-[1px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed right-0 top-0 z-40 h-full w-full max-w-[440px] bg-white shadow-[-18px_0_44px_-16px_rgba(15,23,42,0.34)] flex flex-col"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            role="dialog"
            aria-label={`${lane.routeLabel} navlun detayı`}
          >
            {/* Header */}
            <div
              className="px-5 py-4 text-white shrink-0"
              style={{ background: accent.gradient }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <HugeiconsIcon icon={BoatIcon} size={18} strokeWidth={2} />
                    <h2 className="text-[15px] font-bold truncate">
                      {lane.routeLabel}
                    </h2>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {lane.shipSizeCategory && (
                      <span className="inline-flex items-center rounded-md bg-white/20 px-1.5 py-0.5 text-[10.5px] font-semibold">
                        {lane.shipSizeCategory}
                      </span>
                    )}
                    {lane.vesselType && (
                      <span className="text-[11px] text-white/85">
                        {lane.vesselType}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={t("ft.panel.close")}
                  className="shrink-0 grid place-items-center size-8 rounded-lg bg-white/15 hover:bg-white/25 transition-colors"
                >
                  <X className="size-4" strokeWidth={2.5} />
                </button>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-5">
              {/* Current rate hero */}
              <div className="rounded-xl border border-border/50 bg-slate-50/60 px-4 py-3">
                <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-medium">
                  {t("ft.col.currentRate")}
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-[26px] font-bold tabular-nums leading-none text-foreground">
                    {priceRange(
                      lane.currentPrice,
                      lane.currentMaxPrice,
                      lane.currency
                    )}
                  </span>
                  {lane.deltaPct != null && (
                    <span
                      className="text-[12.5px] font-bold tabular-nums"
                      style={{ color: deltaColor(lane.deltaPct) }}
                    >
                      {lane.deltaPct > 0 ? "▲ +" : lane.deltaPct < 0 ? "▼ " : ""}
                      {formatNumber(lane.deltaPct, 1)}%
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  {lane.current ? (
                    <>
                      {formatDate(lane.current.validityStart)} –{" "}
                      {formatDate(lane.current.validityFinish)}
                      {lane.isStale && (
                        <span className="ml-1.5 text-amber-600 font-medium">
                          · {t("ft.panel.stale")}
                        </span>
                      )}
                    </>
                  ) : (
                    t("ft.panel.noQuote")
                  )}
                </div>
                {lane.trend.length >= 2 && (
                  <div className="mt-2">
                    <FreightSparkline
                      values={lane.trend.map((t) => t.price)}
                      width={380}
                      height={44}
                      color={deltaColor(lane.deltaPct)}
                      className="w-full"
                    />
                  </div>
                )}
              </div>

              {/* Route meta */}
              <Section icon={BoatIcon} title={t("ft.panel.route")} solid={accent.solid}>
                <Grid>
                  <Field label={t("ft.filter.loadingPort")} value={lane.loadingPort} />
                  <Field label={t("ft.filter.dischargePort")} value={lane.dischargePort} />
                  <Field
                    label={t("ft.field.distance")}
                    value={
                      lane.distance != null && lane.distance > 0
                        ? formatNumber(lane.distance)
                        : "—"
                    }
                  />
                  <Field
                    label={t("ft.field.duration")}
                    value={
                      lane.durationDays != null && lane.durationDays > 0
                        ? `${formatNumber(lane.durationDays)} ${t("common.days")}`
                        : "—"
                    }
                  />
                </Grid>
              </Section>

              {/* Current quote attributes */}
              {lane.current && (
                <Section
                  icon={Package01Icon}
                  title={t("ft.panel.currentQuote")}
                  solid={accent.solid}
                >
                  <Grid>
                    <Field label={t("ft.filter.vesselType")} value={lane.current.vesselType || "—"} />
                    <Field label={t("ft.filter.shipClass")} value={lane.current.shipSizeCategory || "—"} />
                    <Field label={t("ft.filter.cargo")} value={lane.current.cargoGood || "—"} />
                    <Field label={t("ft.field.cargoType")} value={lane.current.freightCargoType || "—"} />
                    <Field label={t("ft.col.tonnage")} value={tonnage(lane.current.minTonnage, lane.current.maxTonnage)} />
                    <Field
                      label={t("ft.field.stowage")}
                      value={
                        lane.current.stowageFactor != null
                          ? formatNumber(lane.current.stowageFactor, 2)
                          : "—"
                      }
                    />
                    <Field
                      label={t("ft.field.loadingRate")}
                      value={
                        [lane.current.loadingRate, lane.current.loadingRateTerm]
                          .filter(Boolean)
                          .join(" ") || "—"
                      }
                    />
                    <Field
                      label={t("ft.field.dischargeRate")}
                      value={
                        [
                          lane.current.dischargeRate,
                          lane.current.dischargeRateTerm,
                        ]
                          .filter(Boolean)
                          .join(" ") || "—"
                      }
                    />
                    {(lane.current.laycanFrom || lane.current.laycanTo) && (
                      <Field
                        label={t("ft.field.laycan")}
                        value={`${formatDate(lane.current.laycanFrom)} – ${formatDate(lane.current.laycanTo)}`}
                        wide
                      />
                    )}
                    {(lane.current.loadingPartyName ||
                      lane.current.dischargePartyName) && (
                      <Field
                        label={t("ft.field.parties")}
                        value={
                          [
                            lane.current.loadingPartyName,
                            lane.current.dischargePartyName,
                          ]
                            .filter(Boolean)
                            .join(" / ") || "—"
                        }
                        wide
                      />
                    )}
                    {lane.current.packageType && (
                      <Field label={t("ft.field.packageType")} value={lane.current.packageType} wide />
                    )}
                  </Grid>
                  {lane.current.notes && (
                    <div className="mt-2 flex items-start gap-1.5 text-[11.5px] text-muted-foreground">
                      <HugeiconsIcon
                        icon={Note01Icon}
                        size={13}
                        strokeWidth={2}
                        className="mt-0.5 shrink-0"
                      />
                      <span className="leading-snug whitespace-pre-line">
                        {lane.current.notes}
                      </span>
                    </div>
                  )}
                </Section>
              )}

              {/* Quote history */}
              <Section
                icon={Calendar03Icon}
                title={`${t("ft.panel.history")} (${lane.quoteCount})`}
                solid={accent.solid}
              >
                <div className="space-y-1.5">
                  {[...lane.quotes]
                    .reverse()
                    .map((q, i) => (
                      <div
                        key={`q-${i}`}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border/40 px-2.5 py-1.5"
                      >
                        <div className="min-w-0">
                          <div className="text-[11.5px] font-medium text-foreground/80 whitespace-nowrap">
                            {formatDate(q.validityStart)}
                            <span className="text-muted-foreground/50"> – </span>
                            {formatDate(q.validityFinish)}
                          </div>
                          <div className="text-[10.5px] text-muted-foreground truncate">
                            {[q.cargoGood, q.shipSizeCategory]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </div>
                        </div>
                        <div className="text-[12.5px] font-bold tabular-nums text-foreground shrink-0">
                          {priceRange(q.freightPrice, q.maxFreightPrice, q.currency)}
                        </div>
                      </div>
                    ))}
                </div>
              </Section>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Section({
  icon,
  title,
  solid,
  children,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any;
  title: string;
  solid: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <HugeiconsIcon icon={icon} size={14} strokeWidth={2} style={{ color: solid }} />
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-foreground/80">
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">{children}</div>;
}

function Field({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={cn("min-w-0", wide && "col-span-2")}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80">
        {label}
      </div>
      <div className="text-[12.5px] font-medium text-foreground/90 mt-0.5 break-words">
        {value}
      </div>
    </div>
  );
}
