/**
 * Freight-price selectors — turn flat `FreightRow[]` into the lane-grouped,
 * current-rate-aware model the Fiyat Takibi page renders.
 *
 * Lane grain = route + ship-size class (the user's chosen grouping; mirrors
 * the Power BI "(Ultra)" lane concept since the entities carry no "market"
 * field). Within a lane, quotes form a time series over their validity
 * windows; the "current" quote is the one effective today.
 *
 * Pure functions, no React. Single source of truth for KPIs, the trend
 * chart, the top-lanes chart, and the table — so every surface agrees.
 */

import { trSort } from "@/lib/format";
import type { FreightRow } from "@/lib/dataverse/freightPrices";

export interface FreightLane {
  laneKey: string;
  loadingPort: string;
  dischargePort: string;
  shipSizeCategory: string;
  /** "Santos → Umm Qasr" */
  routeLabel: string;

  /* Representative attributes (from the current quote, else first quote). */
  vesselType: string;
  cargoGood: string;
  currency: string;
  distance: number | null;
  durationDays: number | null;
  /** Lane spans more than one cargo good across its quotes. */
  mixedCargo: boolean;

  /* Quote history, sorted by effective date asc (undated last). */
  quotes: FreightRow[];
  quoteCount: number;

  /* Current / previous effective quote. */
  current: FreightRow | null;
  previous: FreightRow | null;
  currentPrice: number | null;
  currentMaxPrice: number | null;
  /** No quote window contains "now" — the current pick is the latest known. */
  isStale: boolean;
  /** Current vs previous window price, percent. null when no comparison. */
  deltaPct: number | null;

  /** Sparkline / chart points: price over effective date (dated quotes only). */
  trend: FreightTrendPoint[];
}

/** A single lane-sparkline point: price at an effective date. */
export interface FreightTrendPoint {
  /** Epoch ms of the point (for ordering / x-axis). */
  ms: number;
  price: number;
}

/** A page-level monthly trend point: avg + min/max band over a month. */
export interface FreightMonthlyPoint {
  /** Epoch ms of the month's first day (x-axis ordering). */
  ms: number;
  /** Month bucket key "YYYY-MM". */
  month: string;
  /** Display label, e.g. "Nis 26". */
  label: string;
  /** Mean freight price in the bucket. */
  avg: number;
  min: number;
  max: number;
  count: number;
}

export interface FreightKpis {
  totalLanes: number;
  /** Lanes whose current quote is effective today (not stale). */
  activeLanes: number;
  /** Average current rate over lanes in the dominant currency. */
  avgCurrentPrice: number | null;
  avgCurrency: string;
  minPrice: { lane: FreightLane; price: number } | null;
  maxPrice: { lane: FreightLane; price: number } | null;
  rising: number;
  falling: number;
  flat: number;
  /** rising − falling (>0 market firming, <0 softening). */
  netMomentum: number;
}

/* ─────────── date helpers ─────────── */

function ms(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
}

/** Effective ordering key: start, else finish, else +∞ (undated sorts last). */
function effectiveMs(r: FreightRow): number {
  return ms(r.validityStart) ?? ms(r.validityFinish) ?? Number.POSITIVE_INFINITY;
}

function windowContains(r: FreightRow, nowMs: number): boolean {
  const s = ms(r.validityStart);
  const f = ms(r.validityFinish);
  if (s != null && f != null) return nowMs >= s && nowMs <= f;
  if (s != null) return nowMs >= s; // open-ended forward
  if (f != null) return nowMs <= f; // open-ended backward
  return false; // undated
}

/* ─────────── lane construction ─────────── */

export function buildFreightLanes(
  rows: FreightRow[],
  now: Date = new Date()
): FreightLane[] {
  const nowMs = now.getTime();
  const groups = new Map<string, FreightRow[]>();
  for (const r of rows) {
    const key = `${r.loadingPort}>${r.dischargePort}#${r.shipSizeCategory}`;
    const list = groups.get(key);
    if (list) list.push(r);
    else groups.set(key, [r]);
  }

  const lanes: FreightLane[] = [];
  for (const [laneKey, list] of groups) {
    const quotes = [...list].sort((a, b) => effectiveMs(a) - effectiveMs(b));

    // Current quote: prefer the window containing today (most recent start);
    // else most-recent past; else earliest future; else last undated.
    let current: FreightRow | null = null;
    const containing = quotes.filter((q) => windowContains(q, nowMs));
    if (containing.length) {
      current = containing.reduce((a, b) =>
        effectiveMs(b) >= effectiveMs(a) ? b : a
      );
    } else {
      const past = quotes.filter((q) => {
        const e = effectiveMs(q);
        return e !== Number.POSITIVE_INFINITY && e <= nowMs;
      });
      if (past.length) current = past[past.length - 1];
      else {
        const future = quotes.filter((q) => {
          const e = effectiveMs(q);
          return e !== Number.POSITIVE_INFINITY && e > nowMs;
        });
        current = future.length ? future[0] : quotes[quotes.length - 1] ?? null;
      }
    }

    const idx = current ? quotes.indexOf(current) : -1;
    const previous = idx > 0 ? quotes[idx - 1] : null;

    const currentPrice = current?.freightPrice ?? null;
    const prevPrice = previous?.freightPrice ?? null;
    const deltaPct =
      currentPrice != null && prevPrice != null && prevPrice !== 0
        ? ((currentPrice - prevPrice) / prevPrice) * 100
        : null;

    const rep = current ?? quotes[0];
    const cargoSet = new Set(quotes.map((q) => q.cargoGood).filter(Boolean));

    const trend: FreightTrendPoint[] = quotes
      .filter((q) => q.freightPrice != null && effectiveMs(q) !== Number.POSITIVE_INFINITY)
      .map((q) => ({ ms: effectiveMs(q), price: q.freightPrice as number }))
      .sort((a, b) => a.ms - b.ms);

    lanes.push({
      laneKey,
      loadingPort: rep.loadingPort,
      dischargePort: rep.dischargePort,
      shipSizeCategory: rep.shipSizeCategory,
      routeLabel: `${rep.loadingPort} → ${rep.dischargePort}`,
      vesselType: rep.vesselType,
      cargoGood: rep.cargoGood,
      currency: rep.currency,
      distance: rep.distance,
      durationDays: rep.durationDays,
      mixedCargo: cargoSet.size > 1,
      quotes,
      quoteCount: quotes.length,
      current,
      previous,
      currentPrice,
      currentMaxPrice: current?.maxFreightPrice ?? null,
      isStale: current ? !windowContains(current, nowMs) : true,
      deltaPct,
      trend,
    });
  }

  return lanes.sort((a, b) => trSort(a.routeLabel, b.routeLabel));
}

/* ─────────── currency + KPIs ─────────── */

/** Most frequent currency among the items (ties → first seen). "" if none. */
function dominantCurrency(currencies: string[]): string {
  const counts = new Map<string, number>();
  for (const c of currencies) {
    if (!c) continue;
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  let best = "";
  let bestN = 0;
  for (const [c, n] of counts) {
    if (n > bestN) {
      best = c;
      bestN = n;
    }
  }
  return best;
}

/** Flat threshold for momentum classification (±0.5%). */
const FLAT_EPS = 0.5;

export function computeFreightKpis(lanes: FreightLane[]): FreightKpis {
  const priced = lanes.filter((l) => l.currentPrice != null);
  const avgCurrency = dominantCurrency(priced.map((l) => l.currency));
  const inCur = priced.filter((l) => l.currency === avgCurrency);

  const avgCurrentPrice =
    inCur.length > 0
      ? inCur.reduce((s, l) => s + (l.currentPrice as number), 0) / inCur.length
      : null;

  let minPrice: FreightKpis["minPrice"] = null;
  let maxPrice: FreightKpis["maxPrice"] = null;
  for (const l of inCur) {
    const p = l.currentPrice as number;
    if (!minPrice || p < minPrice.price) minPrice = { lane: l, price: p };
    if (!maxPrice || p > maxPrice.price) maxPrice = { lane: l, price: p };
  }

  let rising = 0;
  let falling = 0;
  let flat = 0;
  for (const l of lanes) {
    if (l.deltaPct == null) continue;
    if (l.deltaPct > FLAT_EPS) rising += 1;
    else if (l.deltaPct < -FLAT_EPS) falling += 1;
    else flat += 1;
  }

  return {
    totalLanes: lanes.length,
    activeLanes: lanes.filter((l) => l.current && !l.isStale).length,
    avgCurrentPrice,
    avgCurrency: avgCurrency || "USD",
    minPrice,
    maxPrice,
    rising,
    falling,
    flat,
    netMomentum: rising - falling,
  };
}

/** Top-N lanes by current rate (descending), priced lanes only. */
export function topLanesByPrice(
  lanes: FreightLane[],
  n: number = 10
): FreightLane[] {
  return lanes
    .filter((l) => l.currentPrice != null)
    .sort((a, b) => (b.currentPrice as number) - (a.currentPrice as number))
    .slice(0, n);
}

/* ─────────── monthly trend (page-level chart) ─────────── */

function monthKey(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, (m ?? 1) - 1, 1);
  return new Intl.DateTimeFormat("tr-TR", {
    month: "short",
    year: "2-digit",
  }).format(d);
}

/**
 * Monthly avg/min/max of freight price over the (filtered) rows, in the
 * dominant currency — feeds the trend line chart. Mixing currencies on one
 * axis would be meaningless, so off-currency rows are excluded.
 */
export function buildMonthlyTrend(rows: FreightRow[]): {
  points: FreightMonthlyPoint[];
  currency: string;
} {
  const cur = dominantCurrency(rows.map((r) => r.currency));
  const buckets = new Map<string, number[]>();
  for (const r of rows) {
    if (r.currency !== cur) continue;
    if (r.freightPrice == null) continue;
    const key = monthKey(r.validityStart) ?? monthKey(r.validityFinish);
    if (!key) continue;
    const arr = buckets.get(key);
    if (arr) arr.push(r.freightPrice);
    else buckets.set(key, [r.freightPrice]);
  }

  const points: FreightMonthlyPoint[] = [...buckets.entries()]
    .map(([key, prices]) => {
      const sum = prices.reduce((s, p) => s + p, 0);
      const [y, m] = key.split("-").map(Number);
      return {
        ms: new Date(y, (m ?? 1) - 1, 1).getTime(),
        month: key,
        label: monthLabel(key),
        avg: sum / prices.length,
        min: Math.min(...prices),
        max: Math.max(...prices),
        count: prices.length,
      };
    })
    .sort((a, b) => a.ms - b.ms);

  return { points, currency: cur || "USD" };
}
