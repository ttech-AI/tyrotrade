/**
 * Lightweight filter system for the Fiyat Takibi (indicative freight) page.
 *
 * Deliberately NOT the project-domain `ProjectFilterState` — freight rows
 * have a different shape (ports, vessel class, cargo, validity windows,
 * currency) and a different date semantic (validity window, not project
 * date). Keeping a parallel, focused state avoids polluting the project
 * filter logic with freight-only concerns.
 *
 * Period model is intentionally minimal: "all" (default — freight rate
 * histories span multiple fiscal years) or "fy" (rows whose validity window
 * overlaps the selected Tiryaki financial year).
 */

import { trSort } from "@/lib/format";
import { findFyByKey } from "@/lib/dashboard/financialPeriod";
import type { FreightRow } from "@/lib/dataverse/freightPrices";

export type FreightPeriod = "all" | "fy";

export interface FreightFilterState {
  period: FreightPeriod;
  /** FY key like "25-26" when period === "fy". */
  fyKey: string | null;
  loadingPorts: Set<string>;
  dischargePorts: Set<string>;
  vesselTypes: Set<string>;
  shipSizeCategories: Set<string>;
  cargoGoods: Set<string>;
  currencies: Set<string>;
  /** Free-text — matches route / cargo / vessel / notes. */
  search: string;
}

export interface FreightOptions {
  loadingPorts: string[];
  dischargePorts: string[];
  vesselTypes: string[];
  shipSizeCategories: string[];
  cargoGoods: string[];
  currencies: string[];
}

const EMPTY: ReadonlySet<string> = new Set();

export function makeEmptyFreightFilters(
  opts?: { period?: FreightPeriod; fyKey?: string | null }
): FreightFilterState {
  return {
    period: opts?.period ?? "all",
    fyKey: opts?.fyKey ?? null,
    loadingPorts: new Set(),
    dischargePorts: new Set(),
    vesselTypes: new Set(),
    shipSizeCategories: new Set(),
    cargoGoods: new Set(),
    currencies: new Set(),
    search: "",
  };
}

const trLower = (s: string): string => s.toLocaleLowerCase("tr-TR");

/** True when the row's validity window overlaps [start, end]. Undated rows
 *  (no start AND no finish) are treated as NOT in any specific FY. */
function overlapsRange(
  row: FreightRow,
  start: Date,
  end: Date
): boolean {
  const s = row.validityStart ? new Date(row.validityStart) : null;
  const f = row.validityFinish ? new Date(row.validityFinish) : null;
  if (!s && !f) return false;
  const lo = s ?? f!; // if only one bound is set, treat the window as that point
  const hi = f ?? s!;
  return lo <= end && hi >= start;
}

export function applyFreightFilter(
  rows: FreightRow[],
  state: FreightFilterState,
  _now: Date = new Date()
): FreightRow[] {
  let out = rows;

  // Period cull (FY only; "all" is a no-op).
  if (state.period === "fy" && state.fyKey) {
    const fy = findFyByKey(state.fyKey);
    if (fy) out = out.filter((r) => overlapsRange(r, fy.start, fy.end));
  }

  // Categorical narrowing — defensive `?? EMPTY` so a stale/partial state
  // shape can't throw.
  const narrow = (
    field: keyof Pick<
      FreightRow,
      | "loadingPort"
      | "dischargePort"
      | "vesselType"
      | "shipSizeCategory"
      | "cargoGood"
      | "currency"
    >,
    set: Set<string> | undefined
  ) => {
    const s = set ?? (EMPTY as Set<string>);
    if (s.size > 0) out = out.filter((r) => s.has(r[field]));
  };
  narrow("loadingPort", state.loadingPorts);
  narrow("dischargePort", state.dischargePorts);
  narrow("vesselType", state.vesselTypes);
  narrow("shipSizeCategory", state.shipSizeCategories);
  narrow("cargoGood", state.cargoGoods);
  narrow("currency", state.currencies);

  // Free-text search across route + cargo + vessel + notes.
  const q = trLower(state.search.trim());
  if (q) {
    out = out.filter((r) => {
      const hay = trLower(
        `${r.loadingPort} ${r.dischargePort} ${r.cargoGood} ${r.vesselType} ${r.shipSizeCategory} ${r.notes}`
      );
      return hay.includes(q);
    });
  }

  return out;
}

/** Distinct sorted option values per field (skips empty / "—" placeholders). */
export function extractFreightOptions(rows: FreightRow[]): FreightOptions {
  const sets = {
    loadingPorts: new Set<string>(),
    dischargePorts: new Set<string>(),
    vesselTypes: new Set<string>(),
    shipSizeCategories: new Set<string>(),
    cargoGoods: new Set<string>(),
    currencies: new Set<string>(),
  };
  const add = (set: Set<string>, v: string) => {
    if (v && v !== "—") set.add(v);
  };
  for (const r of rows) {
    add(sets.loadingPorts, r.loadingPort);
    add(sets.dischargePorts, r.dischargePort);
    add(sets.vesselTypes, r.vesselType);
    add(sets.shipSizeCategories, r.shipSizeCategory);
    add(sets.cargoGoods, r.cargoGood);
    add(sets.currencies, r.currency);
  }
  return {
    loadingPorts: [...sets.loadingPorts].sort(trSort),
    dischargePorts: [...sets.dischargePorts].sort(trSort),
    vesselTypes: [...sets.vesselTypes].sort(trSort),
    shipSizeCategories: [...sets.shipSizeCategories].sort(trSort),
    cargoGoods: [...sets.cargoGoods].sort(trSort),
    currencies: [...sets.currencies].sort(trSort),
  };
}

/** Count of active (non-default) filter dimensions — drives the toolbar badge. */
export function freightFilterCount(state: FreightFilterState): number {
  let n = 0;
  if (state.period !== "all") n += 1;
  n += state.loadingPorts.size > 0 ? 1 : 0;
  n += state.dischargePorts.size > 0 ? 1 : 0;
  n += state.vesselTypes.size > 0 ? 1 : 0;
  n += state.shipSizeCategories.size > 0 ? 1 : 0;
  n += state.cargoGoods.size > 0 ? 1 : 0;
  n += state.currencies.size > 0 ? 1 : 0;
  n += state.search.trim() ? 1 : 0;
  return n;
}
