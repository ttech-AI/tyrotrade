import * as React from "react";
import { ChevronRight, ChevronDown, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { trSort, formatDate, formatNumber } from "@/lib/format";
import { useIsMobile } from "@/hooks/useMediaQuery";
import type { FreightLane } from "@/lib/selectors/freight";
import type { FreightRow } from "@/lib/dataverse/freightPrices";
import { FreightSparkline } from "./FreightSparkline";

type SortKey = "route" | "price" | "delta" | "validity";
type SortDir = "asc" | "desc";

/** Δ% colour coding: rising freight = cost up = rose; falling = emerald. */
const DELTA_UP = "#e11d48";
const DELTA_DOWN = "#059669";
const DELTA_FLAT = "#64748b";

function deltaColor(delta: number | null): string {
  if (delta == null || Math.abs(delta) < 0.5) return DELTA_FLAT;
  return delta > 0 ? DELTA_UP : DELTA_DOWN;
}

function priceRange(a: number | null, b: number | null): string {
  if (a == null) return "—";
  if (b != null && Math.abs(b - a) > 0.001) {
    return `${formatNumber(a, a % 1 ? 2 : 0)}–${formatNumber(b, b % 1 ? 2 : 0)}`;
  }
  return formatNumber(a, a % 1 ? 2 : 0);
}

function tonnageRange(a: number | null, b: number | null): string {
  if (a == null && b == null) return "—";
  if (a != null && b != null && a !== b) {
    return `${formatNumber(a)}–${formatNumber(b)}`;
  }
  return formatNumber((a ?? b) as number);
}

function rateText(rate: string, term: string): string {
  if (!rate && !term) return "—";
  return [rate, term].filter(Boolean).join(" ");
}

function sortLanes(
  lanes: FreightLane[],
  key: SortKey,
  dir: SortDir
): FreightLane[] {
  const mul = dir === "asc" ? 1 : -1;
  const valOf = (l: FreightLane): number | null => {
    switch (key) {
      case "price":
        return l.currentPrice;
      case "delta":
        return l.deltaPct;
      case "validity":
        return l.current?.validityStart
          ? new Date(l.current.validityStart).getTime()
          : null;
      default:
        return 0;
    }
  };
  return [...lanes].sort((a, b) => {
    if (key === "route") return mul * trSort(a.routeLabel, b.routeLabel);
    const va = valOf(a);
    const vb = valOf(b);
    // Nulls always sort to the end regardless of direction.
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    return mul * (va - vb);
  });
}

export function FreightTable({
  lanes,
  selectedLaneKey,
  onSelectLane,
}: {
  lanes: FreightLane[];
  selectedLaneKey?: string | null;
  onSelectLane?: (lane: FreightLane) => void;
}) {
  const isMobile = useIsMobile();
  const [sortKey, setSortKey] = React.useState<SortKey>("route");
  const [sortDir, setSortDir] = React.useState<SortDir>("asc");
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  const sorted = React.useMemo(
    () => sortLanes(lanes, sortKey, sortDir),
    [lanes, sortKey, sortDir]
  );

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // Natural default: alpha → asc, numeric → desc.
      setSortDir(key === "route" ? "asc" : "desc");
    }
  };

  const toggleExpand = (laneKey: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(laneKey)) next.delete(laneKey);
      else next.add(laneKey);
      return next;
    });
  };

  // Mobile: a 9-column table is unreadable on a phone, so render a
  // card-per-lane list (route + current rate + trend), tap → detail panel.
  if (isMobile) {
    return (
      <FreightCardList
        lanes={sorted}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={toggleSort}
        selectedLaneKey={selectedLaneKey}
        onSelectLane={onSelectLane}
      />
    );
  }

  return (
    <div className="h-full rounded-2xl border border-border/50 bg-white/60 overflow-auto">
      <table className="w-full min-w-[940px] border-collapse text-left">
        <thead className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm shadow-[0_1px_0_0_rgba(15,23,42,0.08)]">
          <tr className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
            <SortableTh
              label="Hat"
              active={sortKey === "route"}
              dir={sortDir}
              onClick={() => toggleSort("route")}
              className="pl-3 min-w-[230px]"
            />
            <Th className="min-w-[110px]">Gemi Tipi</Th>
            <Th className="min-w-[120px]">Kargo</Th>
            <SortableTh
              label="Güncel Navlun"
              active={sortKey === "price"}
              dir={sortDir}
              onClick={() => toggleSort("price")}
              align="right"
              className="min-w-[120px]"
            />
            <SortableTh
              label="Trend"
              active={sortKey === "delta"}
              dir={sortDir}
              onClick={() => toggleSort("delta")}
              className="min-w-[120px]"
            />
            <SortableTh
              label="Geçerlilik"
              active={sortKey === "validity"}
              dir={sortDir}
              onClick={() => toggleSort("validity")}
              className="min-w-[150px]"
            />
            <Th className="min-w-[100px]">Tonaj</Th>
            <Th className="min-w-[120px]">Yükleme</Th>
            <Th className="min-w-[120px] pr-3">Tahliye</Th>
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={9} className="py-10 text-center text-[13px] text-muted-foreground">
                Filtreye uyan hat yok.
              </td>
            </tr>
          ) : (
            sorted.map((lane) => (
              <LaneRows
                key={lane.laneKey}
                lane={lane}
                isExpanded={expanded.has(lane.laneKey)}
                isSelected={selectedLaneKey === lane.laneKey}
                onToggle={() => toggleExpand(lane.laneKey)}
                onSelect={() => onSelectLane?.(lane)}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function LaneRows({
  lane,
  isExpanded,
  isSelected,
  onToggle,
  onSelect,
}: {
  lane: FreightLane;
  isExpanded: boolean;
  isSelected: boolean;
  onToggle: () => void;
  onSelect: () => void;
}) {
  const dColor = deltaColor(lane.deltaPct);
  const sparkValues = lane.trend.map((t) => t.price);
  return (
    <>
      <tr
        onClick={onSelect}
        className={cn(
          "group border-t border-border/40 cursor-pointer transition-colors align-middle",
          isSelected ? "bg-sky-50/80" : "hover:bg-foreground/[0.025]"
        )}
        title={`${lane.routeLabel} — detay için tıkla`}
      >
        {/* Hat */}
        <td className="py-2 pl-3 pr-2">
          <div className="flex items-start gap-1.5 min-w-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              aria-label={isExpanded ? "Geçmişi gizle" : "Geçmişi göster"}
              aria-expanded={isExpanded}
              className="mt-0.5 shrink-0 grid place-items-center size-5 rounded-md text-muted-foreground/70 hover:bg-foreground/[0.06] hover:text-foreground transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="size-3.5" strokeWidth={2.5} />
              ) : (
                <ChevronRight className="size-3.5" strokeWidth={2.5} />
              )}
            </button>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-foreground/90 truncate">
                {lane.routeLabel}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                {lane.shipSizeCategory && (
                  <span className="inline-flex items-center rounded-md bg-sky-100/70 text-sky-700 px-1.5 py-0.5 text-[10px] font-semibold">
                    {lane.shipSizeCategory}
                  </span>
                )}
                <span className="text-[10.5px] text-muted-foreground tabular-nums">
                  {lane.quoteCount} teklif
                </span>
              </div>
            </div>
          </div>
        </td>
        {/* Gemi Tipi */}
        <td className="py-2 px-2 text-[12px] text-foreground/80">
          <span className="line-clamp-2">{lane.vesselType || "—"}</span>
        </td>
        {/* Kargo */}
        <td className="py-2 px-2 text-[12px] text-foreground/80">
          <span className="line-clamp-2">{lane.cargoGood || "—"}</span>
          {lane.mixedCargo && (
            <span className="ml-1 text-[10px] text-amber-600 font-medium">+karma</span>
          )}
        </td>
        {/* Güncel Navlun */}
        <td className="py-2 px-2 text-right">
          <div className="text-[13px] font-bold tabular-nums text-foreground">
            {priceRange(lane.currentPrice, lane.currentMaxPrice)}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {lane.currency}/t
            {lane.isStale && (
              <span className="ml-1 text-amber-600 font-medium">· geçmiş</span>
            )}
          </div>
        </td>
        {/* Trend */}
        <td className="py-2 px-2">
          <div className="flex items-center gap-1.5">
            <FreightSparkline values={sparkValues} color={dColor} />
            {lane.deltaPct != null && (
              <span
                className="text-[11px] font-bold tabular-nums shrink-0"
                style={{ color: dColor }}
              >
                {lane.deltaPct > 0 ? "+" : ""}
                {formatNumber(lane.deltaPct, 1)}%
              </span>
            )}
          </div>
        </td>
        {/* Geçerlilik */}
        <td className="py-2 px-2 text-[11.5px] text-foreground/75 whitespace-nowrap">
          {lane.current ? (
            <>
              {formatDate(lane.current.validityStart)}
              <span className="text-muted-foreground/50"> – </span>
              {formatDate(lane.current.validityFinish)}
            </>
          ) : (
            "—"
          )}
        </td>
        {/* Tonaj */}
        <td className="py-2 px-2 text-[11.5px] tabular-nums text-foreground/75">
          {lane.current
            ? tonnageRange(lane.current.minTonnage, lane.current.maxTonnage)
            : "—"}
        </td>
        {/* Yükleme */}
        <td className="py-2 px-2 text-[11px] text-foreground/70">
          <span className="line-clamp-2">
            {lane.current
              ? rateText(lane.current.loadingRate, lane.current.loadingRateTerm)
              : "—"}
          </span>
        </td>
        {/* Tahliye */}
        <td className="py-2 px-2 pr-3 text-[11px] text-foreground/70">
          <span className="line-clamp-2">
            {lane.current
              ? rateText(
                  lane.current.dischargeRate,
                  lane.current.dischargeRateTerm
                )
              : "—"}
          </span>
        </td>
      </tr>

      {/* Expanded quote history (newest first) */}
      {isExpanded &&
        [...lane.quotes]
          .slice()
          .reverse()
          .map((q, i) => <QuoteRow key={`${lane.laneKey}-q-${i}`} q={q} />)}
    </>
  );
}

function QuoteRow({ q }: { q: FreightRow }) {
  return (
    <tr className="border-t border-border/20 bg-slate-50/40 text-[11.5px]">
      <td className="py-1.5 pl-10 pr-2 text-foreground/70 whitespace-nowrap">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1 rounded-full bg-slate-300" />
          {formatDate(q.validityStart)}
          <span className="text-muted-foreground/50">–</span>
          {formatDate(q.validityFinish)}
        </span>
      </td>
      <td className="py-1.5 px-2 text-foreground/65">{q.vesselType || "—"}</td>
      <td className="py-1.5 px-2 text-foreground/65">{q.cargoGood || "—"}</td>
      <td className="py-1.5 px-2 text-right tabular-nums font-semibold text-foreground/85">
        {priceRange(q.freightPrice, q.maxFreightPrice)}
        <span className="text-[10px] text-muted-foreground font-normal"> {q.currency}/t</span>
      </td>
      <td className="py-1.5 px-2 text-muted-foreground">
        {q.shipSizeCategory || "—"}
      </td>
      <td className="py-1.5 px-2 text-foreground/60 tabular-nums">
        {tonnageRange(q.minTonnage, q.maxTonnage)}
      </td>
      <td className="py-1.5 px-2 text-foreground/55">
        {rateText(q.loadingRate, q.loadingRateTerm)}
      </td>
      <td className="py-1.5 px-2 pr-3 text-foreground/55">
        {rateText(q.dischargeRate, q.dischargeRateTerm)}
      </td>
    </tr>
  );
}

/* ─────────── header cells ─────────── */

function Th({
  children,
  className,
  align,
}: {
  children: React.ReactNode;
  className?: string;
  align?: "right";
}) {
  return (
    <th
      className={cn(
        "py-2 px-2 font-semibold",
        align === "right" ? "text-right" : "text-left",
        className
      )}
    >
      {children}
    </th>
  );
}

function SortableTh({
  label,
  active,
  dir,
  onClick,
  className,
  align,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  className?: string;
  align?: "right";
}) {
  return (
    <th className={cn("py-2 px-2 font-semibold", className)}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1 uppercase tracking-wider transition-colors hover:text-foreground",
          align === "right" && "flex-row-reverse",
          active ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {label}
        {active &&
          (dir === "asc" ? (
            <ArrowUp className="size-3" strokeWidth={2.5} />
          ) : (
            <ArrowDown className="size-3" strokeWidth={2.5} />
          ))}
      </button>
    </th>
  );
}

/* ─────────── mobile card list ─────────── */

function FreightCardList({
  lanes,
  sortKey,
  sortDir,
  onSort,
  selectedLaneKey,
  onSelectLane,
}: {
  lanes: FreightLane[];
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  selectedLaneKey?: string | null;
  onSelectLane?: (lane: FreightLane) => void;
}) {
  return (
    <div className="h-full flex flex-col rounded-2xl border border-border/50 bg-white/60 overflow-hidden">
      <div className="flex items-center gap-1.5 px-2.5 py-2 border-b border-border/40 shrink-0 overflow-x-auto">
        <span className="text-[10.5px] uppercase tracking-wider text-muted-foreground shrink-0 mr-0.5">
          Sırala
        </span>
        <SortChip label="Rota" active={sortKey === "route"} dir={sortDir} onClick={() => onSort("route")} />
        <SortChip label="Fiyat" active={sortKey === "price"} dir={sortDir} onClick={() => onSort("price")} />
        <SortChip label="Trend" active={sortKey === "delta"} dir={sortDir} onClick={() => onSort("delta")} />
        <SortChip label="Tarih" active={sortKey === "validity"} dir={sortDir} onClick={() => onSort("validity")} />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
        {lanes.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-muted-foreground">
            Filtreye uyan hat yok.
          </div>
        ) : (
          lanes.map((lane) => {
            const dColor = deltaColor(lane.deltaPct);
            return (
              <button
                key={lane.laneKey}
                type="button"
                onClick={() => onSelectLane?.(lane)}
                className={cn(
                  "w-full text-left rounded-xl border p-3 transition-colors",
                  selectedLaneKey === lane.laneKey
                    ? "border-sky-300 bg-sky-50/70"
                    : "border-border/50 bg-white hover:bg-foreground/[0.02]"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-semibold text-foreground/90 truncate">
                      {lane.routeLabel}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 min-w-0">
                      {lane.shipSizeCategory && (
                        <span className="inline-flex items-center rounded-md bg-sky-100/70 text-sky-700 px-1.5 py-0.5 text-[10px] font-semibold shrink-0">
                          {lane.shipSizeCategory}
                        </span>
                      )}
                      <span className="text-[11px] text-muted-foreground truncate">
                        {lane.cargoGood || "—"}
                        {lane.mixedCargo && (
                          <span className="text-amber-600"> +karma</span>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[15px] font-bold tabular-nums text-foreground leading-tight">
                      {priceRange(lane.currentPrice, lane.currentMaxPrice)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {lane.currency}/t
                      {lane.isStale && <span className="text-amber-600"> · geçmiş</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 mt-2">
                  <div className="flex items-center gap-1.5">
                    <FreightSparkline values={lane.trend.map((t) => t.price)} color={dColor} />
                    {lane.deltaPct != null && (
                      <span
                        className="text-[11px] font-bold tabular-nums"
                        style={{ color: dColor }}
                      >
                        {lane.deltaPct > 0 ? "+" : ""}
                        {formatNumber(lane.deltaPct, 1)}%
                      </span>
                    )}
                  </div>
                  <div className="text-[10.5px] text-muted-foreground whitespace-nowrap">
                    {lane.current ? (
                      <>
                        {formatDate(lane.current.validityStart)}
                        <span className="text-muted-foreground/50"> – </span>
                        {formatDate(lane.current.validityFinish)}
                      </>
                    ) : (
                      `${lane.quoteCount} teklif`
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function SortChip({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[12px] font-semibold transition-colors shrink-0",
        active ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-600"
      )}
    >
      {label}
      {active &&
        (dir === "asc" ? (
          <ArrowUp className="size-3" strokeWidth={2.5} />
        ) : (
          <ArrowDown className="size-3" strokeWidth={2.5} />
        ))}
    </button>
  );
}
