import {
  applyPeriodFilter,
  DEFAULT_PERIOD,
  type PeriodKey,
} from "@/lib/dashboard/periods";
import { getCurrentFyKey } from "@/lib/dashboard/financialPeriod";
import { PROJECT_ID_EXCEPTIONS } from "@/lib/dataverse/refreshAll";
import type { Project } from "@/lib/dataverse/entities";

/** Pre-built lookup so the per-row hot path in `applyProjectFilter`
 *  never has to call `.includes()` on the exceptions array. Mirrors
 *  the source-of-truth list in refreshAll.ts so a single change there
 *  flows everywhere. */
const PROJECT_ID_EXCEPTION_SET = new Set(PROJECT_ID_EXCEPTIONS);

/** Sentinel voyageType option for projects whose `mserp_tryexpenseprojecttype`
 *  is empty (no ship plan / unset İşlem Yönü). Surfaced as its own filter
 *  chip so the user can include/exclude blank-direction projects — picking
 *  only Satış/Satınalma/Transit would otherwise silently drop them. */
export const UNDEFINED_VOYAGE_TYPE = "Tanımsız";

/**
 * Unified filter state used by Dashboard, Vessel Projects, and Veri
 * Yönetimi. Replaces three different per-page filter shapes with a
 * single source of truth so a) the same UI components can drive each
 * page and b) future fields land in one place.
 *
 * Read-only — apply only narrows the project set; no Dataverse
 * mutation flows through here.
 */
export interface ProjectFilterState {
  /** Time-window selector. `fy` (default) plus a `fyKey` is the
   *  Tiryaki-conventional view; rolling presets (monthly/quarterly/
   *  yearly) and `all` cover ad-hoc lookups. */
  period: PeriodKey;
  /** When `period === "fy"`, which financial year ("25-26"). Null →
   *  resolved at apply time to the current FY. */
  fyKey: string | null;

  // Categorical multi-selects — Sets are O(1) and JSON-safe via
  // [...].
  statuses: Set<string>;
  groups: Set<string>;
  incoterms: Set<string>;
  segments: Set<string>;
  voyageStatuses: Set<string>;
  /** İşlem Yönü — `vesselPlan.voyageType` (`mserp_tryexpenseprojecttype`):
   *  Satış / Satınalma / Transit / İthalat / İhracat … The trade-direction
   *  pill shown top-right of the hero vessel image in Sefer Takibi. */
  voyageTypes: Set<string>;
  /** Operational trader assigned to the project (`mserp_traderid`). */
  traders: Set<string>;
  /** Lead/master trader (`mserp_maintraderid`) — the senior trader who
   *  owns the deal. Distinct from `traders` so the user can filter by
   *  desk leader vs. project executor independently. */
  mainTraders: Set<string>;
  companies: Set<string>;
  suppliers: Set<string>;
  buyers: Set<string>;
  vessels: Set<string>;
  /** Loading port names (`mserp_tryloadingport`) — multiselect.
   *  Matched against the project's `vesselPlan.loadingPort.name`. */
  loadingPorts: Set<string>;
  /** Discharge port names (`mserp_trydischargeport`) — multiselect.
   *  Matched against the project's `vesselPlan.dischargePort.name`. */
  dischargePorts: Set<string>;
  /** Specific project codes (PRJ.../TRK...). Lets the user narrow
   *  down to a hand-picked list when they know exactly which projects
   *  they care about. Independent of route-driven `selectedId` —
   *  navigation never auto-populates this set. */
  projectNos: Set<string>;

  /** When false, projects without `vesselPlan` are dropped. Default
   *  varies per page — the dashboard wants inclusive (true), the
   *  Vessel Projects list wants operationally-scoped (false). */
  includeWithoutShipPlan: boolean;

  /** "Arasa Satınalma Seferleri" checkbox. When FALSE, Arasa-Trabzon
   *  segment projects whose İşlem Yönü (voyageType) is "Satınalma" are
   *  excluded — mirrors Power BI's `ArasaPurchaseFlag = 0`. Default true
   *  (include) so non-E.M pages are unaffected; E.M Bakış seeds it false
   *  so the exclusion is visible + user-toggleable. */
  includeArasaPurchase: boolean;
}

/** Segment + direction whose combination the "Arasa Satınalma Seferleri"
 *  toggle governs. */
export const ARASA_SEGMENT = "Arasa-Trabzon";
export const ARASA_PURCHASE_DIRECTION = "Satınalma";

interface MakeEmptyOptions {
  /** Per-page default for the ship-plan toggle. */
  includeWithoutShipPlan?: boolean;
  /** Per-page default time window. Trade Cost overrides this to
   *  `"all"` so the report covers the whole portfolio out of the
   *  box; Dashboard + Vessel Projects stay on `DEFAULT_PERIOD`
   *  (current financial year). */
  period?: PeriodKey;
  /** Companion override for the FY chip when `period === "fy"`.
   *  Ignored otherwise; defaults to the current FY key. */
  fyKey?: string | null;
  /** Seed for the "Arasa Satınalma Seferleri" toggle. Default true
   *  (include); E.M Bakış passes false to exclude by default. */
  includeArasaPurchase?: boolean;
}

export function makeEmptyFilters(
  opts: MakeEmptyOptions = {}
): ProjectFilterState {
  const period = opts.period ?? DEFAULT_PERIOD;
  return {
    period,
    // Only carry an fyKey when the period is the FY chip — for "all"
    // / "monthly" / "quarterly" / "yearly" the field is irrelevant.
    fyKey:
      period === "fy"
        ? (opts.fyKey ?? getCurrentFyKey())
        : (opts.fyKey ?? null),
    statuses: new Set(),
    groups: new Set(),
    incoterms: new Set(),
    segments: new Set(),
    voyageStatuses: new Set(),
    voyageTypes: new Set(),
    traders: new Set(),
    mainTraders: new Set(),
    companies: new Set(),
    suppliers: new Set(),
    buyers: new Set(),
    vessels: new Set(),
    loadingPorts: new Set(),
    dischargePorts: new Set(),
    projectNos: new Set(),
    includeWithoutShipPlan: opts.includeWithoutShipPlan ?? true,
    includeArasaPurchase: opts.includeArasaPurchase ?? true,
  };
}

/** Apply the filter state to a list of projects. Period filter runs
 *  first (cheapest cull), categorical filters layer on top, ship-plan
 *  toggle is the cheapest no-op. */
export function applyProjectFilter(
  projects: Project[],
  fInput: ProjectFilterState,
  now: Date = new Date()
): Project[] {
  // Defensive — any Set field that's somehow missing/undefined (a
  // partial state shape from a stale tab, an in-flight migration, an
  // older hot-reloaded chunk, …) is filled with an empty Set so the
  // per-row predicate's `.size` / `.has` calls never throw. Crash
  // mode was "white screen on combobox click" because
  // `f.loadingPorts.size` blew up when filter shape was behind the
  // new typings.
  const EMPTY = new Set<string>();
  const f: ProjectFilterState = {
    ...fInput,
    statuses: fInput.statuses ?? EMPTY,
    groups: fInput.groups ?? EMPTY,
    incoterms: fInput.incoterms ?? EMPTY,
    segments: fInput.segments ?? EMPTY,
    voyageStatuses: fInput.voyageStatuses ?? EMPTY,
    voyageTypes: fInput.voyageTypes ?? EMPTY,
    traders: fInput.traders ?? EMPTY,
    mainTraders: fInput.mainTraders ?? EMPTY,
    companies: fInput.companies ?? EMPTY,
    suppliers: fInput.suppliers ?? EMPTY,
    buyers: fInput.buyers ?? EMPTY,
    vessels: fInput.vessels ?? EMPTY,
    loadingPorts: fInput.loadingPorts ?? EMPTY,
    dischargePorts: fInput.dischargePorts ?? EMPTY,
    projectNos: fInput.projectNos ?? EMPTY,
    includeArasaPurchase: fInput.includeArasaPurchase ?? true,
  };

  // Period filter — applied to NON-exception projects only. Exception
  // projects (PROJECT_ID_EXCEPTIONS — e.g. ORGANIK01) are brought into
  // scope explicitly and typically don't have a contract date inside
  // the current FY. Re-include them after the period cull so the
  // implicit "current FY" default doesn't silently drop them.
  const periodFiltered = applyPeriodFilter(projects, f.period, f.fyKey, now);
  const seenIds = new Set(periodFiltered.map((p) => p.projectNo));
  const exceptionsDropped = projects.filter(
    (p) => PROJECT_ID_EXCEPTION_SET.has(p.projectNo) && !seenIds.has(p.projectNo)
  );
  const merged =
    exceptionsDropped.length > 0
      ? [...periodFiltered, ...exceptionsDropped]
      : periodFiltered;

  return merged.filter((p) => {
    // Whitelisted exception projects (PROJECT_ID_EXCEPTIONS — e.g.
    // ORGANIK01) bypass the ship-plan gate. They were brought into
    // scope precisely BECAUSE they sit outside the sea-mode +
    // non-empty-segment defaults, so they typically have no
    // vesselPlan. Without this bypass the Vessel Projects page (which
    // defaults `includeWithoutShipPlan: false`) would silently drop
    // them and the user can't find them with a free-text search.
    const isExceptionProject = PROJECT_ID_EXCEPTION_SET.has(p.projectNo);

    // "Gemi planı olmayanları dahil et" — checks ONLY whether the
    // project carries a vesselPlan row at all. Vessel name + port
    // coordinates being unresolved is NOT a disqualifier here, since
    // F&O's `mserp_tryai*` virtual entity already filters out rows
    // with empty vessel names — any vesselPlan we have IS a real plan
    // even if the vessel hasn't been named yet.
    if (
      !f.includeWithoutShipPlan &&
      !p.vesselPlan &&
      !isExceptionProject
    )
      return false;
    if (f.voyageStatuses.size > 0) {
      const vs = p.vesselPlan?.vesselStatus ?? "";
      if (!f.voyageStatuses.has(vs)) return false;
    }
    if (f.voyageTypes.size > 0) {
      // Empty İşlem Yönü maps to the "Tanımsız" sentinel so a blank-value
      // project is only kept when the user explicitly selects Tanımsız.
      const vt = (p.vesselPlan?.voyageType ?? "").trim() || UNDEFINED_VOYAGE_TYPE;
      if (!f.voyageTypes.has(vt)) return false;
    }
    if (f.statuses.size > 0 && !f.statuses.has(p.status)) return false;
    if (f.groups.size > 0 && !f.groups.has(p.projectGroup)) return false;
    if (f.incoterms.size > 0 && !f.incoterms.has(p.incoterm)) return false;
    if (f.segments.size > 0) {
      if (!p.segment || !f.segments.has(p.segment)) return false;
    }
    if (f.traders.size > 0 && !f.traders.has(p.traderNo)) return false;
    if (f.mainTraders.size > 0 && !f.mainTraders.has(p.mainTraderNo))
      return false;
    if (
      f.companies.size > 0 &&
      !f.companies.has(p.vesselPlan?.companyId ?? "")
    )
      return false;
    if (f.suppliers.size > 0) {
      const sup = (p.vesselPlan?.supplier ?? "").trim();
      if (!f.suppliers.has(sup)) return false;
    }
    if (f.buyers.size > 0) {
      const buy = (p.vesselPlan?.buyer ?? "").trim();
      if (!f.buyers.has(buy)) return false;
    }
    if (f.vessels.size > 0) {
      const ves = (p.vesselPlan?.vesselName ?? "").trim();
      if (!f.vessels.has(ves)) return false;
    }
    if (f.loadingPorts.size > 0) {
      const lp = (p.vesselPlan?.loadingPort?.name ?? "").trim();
      if (!f.loadingPorts.has(lp)) return false;
    }
    if (f.dischargePorts.size > 0) {
      const dp = (p.vesselPlan?.dischargePort?.name ?? "").trim();
      if (!f.dischargePorts.has(dp)) return false;
    }
    if (f.projectNos.size > 0 && !f.projectNos.has(p.projectNo)) return false;
    // "Arasa Satınalma Seferleri" — unchecked (false) drops Arasa-Trabzon
    // purchase-direction voyages (PBI ArasaPurchaseFlag=0).
    if (
      !f.includeArasaPurchase &&
      p.segment === ARASA_SEGMENT &&
      (p.vesselPlan?.voyageType ?? "").trim() === ARASA_PURCHASE_DIRECTION
    )
      return false;
    return true;
  });
}

/** Active-filter chip count. Period in default state doesn't count;
 *  any deviation does. ShipPlan toggle counts when set to its non-
 *  default value (depends on caller's default). `periodDefault`
 *  lets each page declare its own baseline — Trade Cost uses `"all"`
 *  while Dashboard + Vessel Projects stay on the FY default. */
export function projectFilterCount(
  f: ProjectFilterState,
  shipPlanDefault: boolean = true,
  periodDefault: PeriodKey = DEFAULT_PERIOD,
  arasaDefault: boolean = true
): number {
  const periodActive =
    f.period !== periodDefault ||
    (f.period === "fy" && f.fyKey !== null && f.fyKey !== getCurrentFyKey());
  // Same defensive `.size ?? 0` pattern as `applyProjectFilter` —
  // any field that's somehow undefined on `f` (stale shape) shouldn't
  // crash the badge render.
  return (
    (f.statuses?.size ?? 0) +
    (f.groups?.size ?? 0) +
    (f.incoterms?.size ?? 0) +
    (f.segments?.size ?? 0) +
    (f.voyageStatuses?.size ?? 0) +
    (f.voyageTypes?.size ?? 0) +
    (f.traders?.size ?? 0) +
    (f.mainTraders?.size ?? 0) +
    (f.companies?.size ?? 0) +
    (f.suppliers?.size ?? 0) +
    (f.buyers?.size ?? 0) +
    (f.vessels?.size ?? 0) +
    (f.loadingPorts?.size ?? 0) +
    (f.dischargePorts?.size ?? 0) +
    (f.projectNos?.size ?? 0) +
    (f.includeWithoutShipPlan === shipPlanDefault ? 0 : 1) +
    ((f.includeArasaPurchase ?? true) === arasaDefault ? 0 : 1) +
    (periodActive ? 1 : 0)
  );
}

/** Distinct sorted values per filter field. Computed once per project
 *  list reference and reused by the AdvancedFilter combobox sections. */
export interface AvailableOptions {
  statuses: string[];
  groups: string[];
  incoterms: string[];
  segments: string[];
  voyageStatuses: string[];
  voyageTypes: string[];
  traders: string[];
  mainTraders: string[];
  companies: string[];
  suppliers: string[];
  buyers: string[];
  vessels: string[];
  loadingPorts: string[];
  dischargePorts: string[];
  /** Project options carry the full {value, label, keywords} shape so
   *  the combobox can show "PRJ000123 — 55KMT BRZ SOY" as the label
   *  while storing only the projectNo in the selection Set, and
   *  cmdk's search matches against both code and name keywords. */
  projects: Array<{ value: string; label: string; keywords: string[]; sub?: string }>;
}

/**
 * Canonical voyage statuses — always surfaced as filter chips even
 * when no project in the current data set carries that value. Same
 * order the F&O option-set defines + matches `composeProjects`'s
 * normalisation outputs. Lets the user spot "no Nominated voyages
 * exist right now" without losing the filter affordance.
 */
const CANONICAL_VOYAGE_STATUSES = [
  "To Be Nominated",
  "Nominated",
  "Commenced",
  "Completed",
  "Closed",
  "Cancelled",
] as const;

export function extractAvailableOptions(
  projects: Project[]
): AvailableOptions {
  const s = new Set<string>();
  const g = new Set<string>();
  const i = new Set<string>();
  const seg = new Set<string>();
  const vs = new Set<string>();
  const vt = new Set<string>();
  const tr = new Set<string>();
  const mtr = new Set<string>();
  const co = new Set<string>();
  const sup = new Set<string>();
  const buy = new Set<string>();
  const ves = new Set<string>();
  const lp = new Set<string>();
  const dp = new Set<string>();
  // Seed voyage statuses with the canonical 6 so chips always appear,
  // even if a status currently has zero matching projects.
  for (const cs of CANONICAL_VOYAGE_STATUSES) vs.add(cs);
  for (const p of projects) {
    if (p.status) s.add(p.status);
    if (p.projectGroup) g.add(p.projectGroup);
    if (p.incoterm) i.add(p.incoterm);
    if (p.segment) seg.add(p.segment);
    if (p.vesselPlan?.vesselStatus) vs.add(p.vesselPlan.vesselStatus);
    // Blank İşlem Yönü → the "Tanımsız" sentinel option, so blank-value
    // projects remain selectable (many projects carry no voyageType).
    vt.add(p.vesselPlan?.voyageType?.trim() || UNDEFINED_VOYAGE_TYPE);
    if (p.traderNo) tr.add(p.traderNo);
    if (p.mainTraderNo) mtr.add(p.mainTraderNo);
    if (p.vesselPlan?.companyId) co.add(p.vesselPlan.companyId);
    const supplier = p.vesselPlan?.supplier?.trim();
    if (supplier) sup.add(supplier);
    const buyer = p.vesselPlan?.buyer?.trim();
    if (buyer) buy.add(buyer);
    const vessel = p.vesselPlan?.vesselName?.trim();
    if (vessel && vessel !== "—") ves.add(vessel);
    const loadingPort = p.vesselPlan?.loadingPort?.name?.trim();
    if (loadingPort && loadingPort !== "—") lp.add(loadingPort);
    const dischargePort = p.vesselPlan?.dischargePort?.name?.trim();
    if (dischargePort && dischargePort !== "—") dp.add(dischargePort);
  }
  // Project options — sorted by projectNo descending (newest IDs
  // surface first; F&O assigns these monotonically). Keywords mix
  // projectNo + projectName + segment so a search for "soybean" or
  // "international" or "PRJ123" all hit.
  const projectOptions = projects
    .map((p) => ({
      value: p.projectNo,
      label: `${p.projectNo} — ${truncate(p.projectName, 60)}`,
      keywords: [
        p.projectNo,
        p.projectName,
        p.segment ?? "",
        p.projectGroup ?? "",
        p.vesselPlan?.vesselName ?? "",
      ].filter(Boolean),
      sub: p.vesselPlan?.vesselName
        ? `Gemi: ${p.vesselPlan.vesselName}`
        : undefined,
    }))
    .sort((a, b) => b.value.localeCompare(a.value));

  // Voyage statuses preserve workflow order (canonical first, then any
  // non-canonical strings found in data appended alphabetically).
  const voyageStatuses = [
    ...CANONICAL_VOYAGE_STATUSES.filter((c) => vs.has(c)),
    ...[...vs]
      .filter(
        (v) => !(CANONICAL_VOYAGE_STATUSES as readonly string[]).includes(v)
      )
      .sort(),
  ];

  return {
    statuses: [...s].sort(),
    groups: [...g].sort(),
    incoterms: [...i].sort(),
    segments: [...seg].sort(),
    voyageStatuses,
    voyageTypes: [...vt].sort(),
    traders: [...tr].sort(),
    mainTraders: [...mtr].sort(),
    companies: [...co].sort(),
    suppliers: [...sup].sort(),
    buyers: [...buy].sort(),
    vessels: [...ves].sort(),
    loadingPorts: [...lp].sort(),
    dischargePorts: [...dp].sort(),
    projects: projectOptions,
  };
}

function truncate(s: string, max: number): string {
  const t = (s ?? "").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}
