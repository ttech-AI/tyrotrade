/**
 * Compose Project[] (existing UI shape) from the 5 raw Dataverse entity
 * row arrays cached in localStorage by `useEntityRows`.
 *
 * 🔒 Read-only, pure derivation. No mutations, no fetches.
 *
 * Inputs are the raw OData rows (`Record<string, unknown>[]`) — keys are the
 * `mserp_*` logical names plus FormattedValue annotations for option-set /
 * lookup / numeric / date fields.
 *
 * Output is `Project[]` matching `src/lib/dataverse/entities.ts` so existing
 * UI consumers (ProjectList, RouteMap, LeaderboardPanel, dashboard tiles,
 * selectors) keep working without changes.
 */

import type {
  Project,
  ProjectLine,
  VesselPlan,
  VesselMilestones,
  VesselStatus,
  VesselDemurrageNotes,
  Port,
  CostEstimate,
  CostEstimateLine,
  DeliveryMode,
  Incoterm,
  SegmentBudgetYearSummary,
  SegmentBudgetMonthSummary,
} from "./entities";
import { getFormattedValue } from "./formatted";
import {
  lookupPortWithCountry,
  canonicalPortKey,
  getUnresolvedPorts,
} from "@/lib/routing/portCoordinates";
import { selectCorridor } from "@/lib/routing/corridors";

export interface ComposeInput {
  projectRows: Record<string, unknown>[];
  shipRows: Record<string, unknown>[];
  lineRows: Record<string, unknown>[];
  /** Per-(projectNo, expenseType) aggregate rows from the refresh-chain
   *  "Tahmini Gider Toplamı" step. One entry per group, carrying the
   *  FormattedValue label so client-side bucketing (Freight / Insurance
   *  / Duties / Other) still works after the raw-row master cache was
   *  retired for quota reasons. Composer multiplies each row's
   *  `totalUnitUsd` by the project's tons (from vesselPlan) to derive
   *  the `CostEstimateLine.totalUsd` rendered by EstimatedExpenseCard /
   *  BudgetSalesCard / the dashboard P&L tile.
   *
   *  Shape: `{ projectNo, expenseTypeCode, expenseTypeLabel,
   *  totalUnitUsd, rowCount }` — see `EstimatedExpenseAggregateRow` in
   *  `refreshAll.ts`. Untyped here so composer stays framework-agnostic. */
  expenseAggregateRows: Record<string, unknown>[];
  /** Optional — per-project per-currency invoiced totals from the
   *  `$apply=groupby(...)/aggregate(lineamount with sum as total)` query.
   *  One row per (projid, currency). When present, projects are enriched
   *  with `salesActualUsd` + `salesActualByCurrency`. */
  salesAggregateRows?: Record<string, unknown>[];
  /** Optional — sub-project (alt-proje) header rows. When present, every
   *  parent project that has one or more sub-project rows is HIDDEN from
   *  the output and replaced by a synthetic `Project` per sub-project.
   *  The synthetic project inherits segment / trader / currency / etc.
   *  from the parent and gets its `projectName` from the sub-project's
   *  `mserp_description`. `lines` stays empty for sub-projects (line
   *  catalogue belongs to the parent). All other child entities
   *  (ship-plan, expense, sales) join through the sub-project ID under
   *  the same FK columns parents use. */
  subProjectRows?: Record<string, unknown>[];
}

export interface ComposeWarnings {
  unresolvedPorts: string[];
  projectsWithoutShipPlan: number;
  projectsWithMissingPort: number;
}

export interface ComposeResult {
  projects: Project[];
  warnings: ComposeWarnings;
}

/* ─────────── Expense bucket vocabulary ─────────── */
// Keys are `mserp_refexpenseid` strings (friendlier than the numeric type
// code). Anything not matched flows to "other" so totals stay correct.
const FREIGHT_REFS = new Set(["Freight", "Navlun", "Sea Freight", "FREIGHT"]);
const INSURANCE_REFS = new Set(["Insurance", "Sigorta", "INSURANCE"]);
const DUTIES_REFS = new Set([
  "Customs",
  "Duty",
  "Duties",
  "Gümrük",
  "Import Duty",
  "CUSTOMS",
  "DUTY",
]);

/* ─────────── Public composer ─────────── */

export function composeProjects(input: ComposeInput): ComposeResult {
  const {
    projectRows,
    shipRows,
    lineRows,
    expenseAggregateRows,
    salesAggregateRows,
    subProjectRows,
  } = input;

  // Sub-project elevation index. Group sub-projects by their parent
  // `mserp_projid` so we can (a) hide parents that own sub-projects
  // and (b) emit one synthetic Project per sub-project. Empty when the
  // sub-project cache hasn't been written yet (mock mode, first-time
  // refresh, etc.) — composition then degrades gracefully to the old
  // parent-only behaviour.
  const subsByParent = new Map<string, Record<string, unknown>[]>();
  for (const r of subProjectRows ?? []) {
    const parentId = readString(r, "mserp_projid");
    if (!parentId) continue;
    const list = subsByParent.get(parentId);
    if (list) list.push(r);
    else subsByParent.set(parentId, [r]);
  }

  // 1. Build per-projid Maps once. O(n + m + k).
  const shipByProjid = new Map<string, Record<string, unknown>>();
  for (const r of shipRows) {
    const id = readString(r, "mserp_tryshipprojid");
    if (id && !shipByProjid.has(id)) shipByProjid.set(id, r);
  }

  const linesByProjid = new Map<string, Record<string, unknown>[]>();
  for (const r of lineRows) {
    const id = readString(r, "mserp_projid");
    if (!id) continue;
    const list = linesByProjid.get(id);
    if (list) list.push(r);
    else linesByProjid.set(id, [r]);
  }

  // Pre-aggregated per-(projectNo, expenseType) rows from the
  // "Tahmini Gider Toplamı" refresh step. Each entry already carries
  // the sum of `mserp_expamountusdd` for its group + the FormattedValue
  // label for client-side bucketing — composer just looks up the right
  // entries by projectNo and multiplies by project tons.
  const expensesByProjid = new Map<string, Record<string, unknown>[]>();
  for (const r of expenseAggregateRows) {
    const id = readString(r, "projectNo");
    if (!id) continue;
    const list = expensesByProjid.get(id);
    if (list) list.push(r);
    else expensesByProjid.set(id, [r]);
  }

  // Per-projid sales totals (from server-side aggregation). One entry per
  // (projid, currency). USD only flows into salesActualUsd; all currencies
  // are kept in salesActualByCurrency for the budget-vs-actual card.
  const salesByProjid = new Map<
    string,
    { byCurrency: Record<string, number>; usd: number; count: number }
  >();
  for (const r of salesAggregateRows ?? []) {
    const pid = readString(r, "mserp_etgtryprojid");
    if (!pid) continue;
    const cur = readString(r, "mserp_currencycode") || "USD";
    const total = num(r["total"]);
    const cnt = num(r["cnt"]);
    let entry = salesByProjid.get(pid);
    if (!entry) {
      entry = { byCurrency: {}, usd: 0, count: 0 };
      salesByProjid.set(pid, entry);
    }
    entry.byCurrency[cur] = (entry.byCurrency[cur] ?? 0) + total;
    if (cur === "USD") entry.usd += total;
    entry.count += cnt;
  }

  // Segment budget rollup intentionally REMOVED from composer — the
  // master `mserp_tryaiprojectbudgetlineentities` cache was retired
  // after sub-projects elevated cache size past the localStorage
  // quota threshold. The Veri Yönetimi "Tahmini Bütçe (Segment)" tab
  // now fetches budget rows on-demand for the SELECTED project's
  // segment only (`useSegmentBudget(segment)` hook). No active consumer
  // reads `project.segmentBudgets` / `project.segmentBudgetsByMonth`
  // anymore — the deprecated `BudgetVsActualCard.tsx` isn't mounted in
  // any page. Project type fields are left in `entities.ts` as
  // `optional / undefined` so the typing surface stays stable for
  // anyone who may yet import them.

  let projectsWithoutShipPlan = 0;
  let projectsWithMissingPort = 0;

  /**
   * Build one Project from either a parent row OR a sub-project row.
   *
   * When `sub` is null, this is a regular parent project: `entityId` is
   * the parent's `mserp_projid`, line catalogue comes from the parent,
   * and segment/trader/etc. read from the parent row directly.
   *
   * When `sub` is non-null, this is an elevated sub-project: `entityId`
   * is the sub-project's `mserp_subprojectid` (used as the join key for
   * ALL child entities — ship-plan, expense, sales, purchase — because
   * the F&O custom layer writes those FKs against sub-project IDs the
   * same way they target parent IDs). The project name comes from the
   * sub-project's `mserp_description`. Segment + trader + currency are
   * INHERITED from the parent — sub-projects don't carry those columns
   * on their own header. `lines` stays empty because the line catalogue
   * belongs to the parent; voyage legs (sub-projects) split logistics,
   * not the order itself.
   */
  const buildProject = (
    parent: Record<string, unknown>,
    sub: Record<string, unknown> | null
  ): Project => {
    const parentProjid = readString(parent, "mserp_projid");
    const subProjid = sub ? readString(sub, "mserp_subprojectid") : "";
    // Entity ID used as the FK lookup key into every child Map.
    const entityId = sub ? subProjid : parentProjid;

    const ship = entityId ? shipByProjid.get(entityId) : undefined;
    // Lines belong to the parent only. For sub-projects we emit an
    // empty array so the right-panel "Proje Satırları" card renders a
    // graceful empty state instead of inheriting the parent catalogue
    // (which would double-count if the parent surfaced too).
    const linesRaw = sub
      ? []
      : entityId
      ? linesByProjid.get(entityId) ?? []
      : [];
    const expensesRaw = entityId
      ? expensesByProjid.get(entityId) ?? []
      : [];

    const projectLines = linesRaw.map(toProjectLine);
    // Vessel-name title fallback: prefer the sub-project description
    // when present (often carries the vessel inline, e.g. "MV XIN HAI
    // TONG 29 / VOYAGE 2"); fall back to the parent's projname.
    const projectNameForVessel = sub
      ? readString(sub, "mserp_description") || readString(parent, "mserp_projname") || ""
      : readString(parent, "mserp_projname") || "";
    const vesselPlan = ship
      ? toVesselPlan(ship, projectNameForVessel)
      : undefined;
    // Project tonnage: prefer vessel plan's voyageTotalTonnage; fall back to
    // sum of line quantities (kg → tons). Used as the multiplier for the
    // estimated-expense per-line totals.
    const projectTons = computeProjectTons(vesselPlan, projectLines);
    const costEstimateLines =
      expensesRaw.length > 0
        ? toCostEstimateLines(expensesRaw, projectTons)
        : undefined;
    // Roll up the per-line totals so `costEstimate.totalUsd` matches the
    // subtotal shown in the Estimated Expense card. Using lines (with tons
    // already applied) instead of raw rate rows avoids an off-by-tons bug.
    const costEstimate = costEstimateLines
      ? toCostEstimate(costEstimateLines)
      : undefined;

    if (!ship) projectsWithoutShipPlan++;
    if (
      vesselPlan &&
      (vesselPlan.loadingPort.lat === 0 ||
        vesselPlan.dischargePort.lat === 0 ||
        vesselPlan.loadingPort.lon === 0 ||
        vesselPlan.dischargePort.lon === 0)
    ) {
      projectsWithMissingPort++;
    }

    // Currency: sub-projects don't carry their own currency column —
    // inherit from the parent header.
    const currency = normaliseCurrency(readString(parent, "mserp_currencycode"));

    // Synthetic cargoValueUsd from lines × unitPrice, but only when project
    // currency is USD (no FX conversion in V1). Existing selectors fall back
    // to the same calc when this field is undefined.
    // Sub-projects have no lines, so this branch only fires for parents
    // (sub-projects rely on the ship-plan's own cargoValueUsd if set).
    if (vesselPlan && currency === "USD" && projectLines.length > 0) {
      const sum = projectLines.reduce(
        (acc, l) => acc + (l.quantityKg / 1000) * l.unitPrice,
        0
      );
      if (sum > 0) vesselPlan.cargoValueUsd = Math.round(sum);
    }

    // Segment INHERITED from parent (sub-project header doesn't carry
    // `mserp_tryprojectsegment` — its own `mserp_segmentid` is a
    // different attribute).
    const segment = readString(parent, "mserp_tryprojectsegment") || null;

    // Sales actual enrichment from aggregate cache, keyed by the active
    // entityId — sub-projects look up their own salesAggregate row;
    // parents look up theirs.
    const salesEntry = entityId ? salesByProjid.get(entityId) : undefined;
    const salesActualUsd = salesEntry
      ? Math.round(salesEntry.usd)
      : undefined;
    const salesActualByCurrency = salesEntry
      ? Object.fromEntries(
          Object.entries(salesEntry.byCurrency).map(([k, v]) => [
            k,
            Math.round(v),
          ])
        )
      : undefined;
    const salesActualInvoiceCount = salesEntry?.count;

    // segmentBudgets / segmentBudgetsByMonth — deliberately left
    // undefined. See the explanatory comment above the (removed)
    // budget rollup block for why these fields are no longer populated
    // at compose time (on-demand `useSegmentBudget(segment)` covers the
    // single live consumer instead).
    const segmentBudgets: SegmentBudgetYearSummary[] | undefined = undefined;
    const segmentBudgetsByMonth: SegmentBudgetMonthSummary[] | undefined =
      undefined;

    // Project name resolution:
    //  - Parent project → its own `mserp_projname`
    //  - Sub-project → its own `mserp_description` (per spec)
    //    Fall back to the parent's name when description is empty so
    //    the UI never renders a blank title.
    const projectName = sub
      ? readString(sub, "mserp_description") ||
        readString(parent, "mserp_projname") ||
        entityId ||
        "(adsız)"
      : readString(parent, "mserp_projname") || entityId || "(adsız)";

    // Sub-projects often carry their own `mserp_dlvmodeid` /
    // `mserp_dlvtermid` (delivery mode/term), `mserp_startdate` /
    // `mserp_enddate` (operation window) — prefer those when set,
    // fall back to the parent's value otherwise.
    const deliveryMode = sub
      ? normaliseDeliveryModeFromSub(sub) || normaliseDeliveryMode(parent)
      : normaliseDeliveryMode(parent);
    const incoterm = sub
      ? normaliseIncotermFromSub(sub) || normaliseIncoterm(parent)
      : normaliseIncoterm(parent);

    // projectDate (contract / signing date): parents read
    // `mserp_contractdate`. Sub-projects don't have a contract date —
    // use the sub-project's startdate (operation window start) as a
    // proxy; fall back to the parent's contract date.
    const projectDate = sub
      ? isoDate(sub["mserp_startdate"]) ??
        isoDate(parent["mserp_contractdate"]) ??
        ""
      : isoDate(parent["mserp_contractdate"]) ?? "";

    // operationPeriod (execution period): parents read
    // `mserp_executionperiod`. Sub-projects use enddate (operation
    // window close) as a closer-to-reality "execution" marker; fall
    // back to the parent's executionperiod.
    const operationPeriod = sub
      ? isoDate(sub["mserp_enddate"]) ?? isoDate(parent["mserp_executionperiod"])
      : isoDate(parent["mserp_executionperiod"]);

    const project: Project = {
      projectNo: entityId || `unknown-${Math.random().toString(36).slice(2, 8)}`,
      projectName,
      projectGroup: readString(parent, "mserp_projgroupid") || "TAHIL",
      // Trader IDs INHERITED from parent — sub-projects don't own
      // these columns on their own headers.
      traderNo: readString(parent, "mserp_traderid") || "",
      mainTraderNo: readString(parent, "mserp_maintraderid") || "",
      customerAccount: sub
        ? readString(sub, "mserp_custaccount") ||
          readString(sub, "mserp_vendaccount") ||
          readString(parent, "mserp_vendaccount") ||
          null
        : readString(parent, "mserp_vendaccount") || null,
      description:
        getFormattedValue(parent, "mserp_vendaccountdescription") ?? null,
      currency,
      tradeType: readString(parent, "mserp_projtradetypeid") || "TICARET",
      segment,
      deliveryMode,
      incoterm,
      // Workflow + status from parent (sub-project header carries no
      // workflow column; status fields are also parent-owned).
      status:
        getFormattedValue(parent, "mserp_status") ||
        readString(parent, "mserp_status") ||
        "Açık",
      workflowStatus:
        getFormattedValue(parent, "mserp_workflowstatus") ||
        readString(parent, "mserp_workflowstatus") ||
        "Gönderilmedi",
      projectDate,
      organic: undefined,
      transactionDirection: null,
      // Operasyon periyodu — F&O `mserp_executionperiod` (parent) or
      // `mserp_enddate` (sub). When set, this is the date the dashboard
      // FY filter + period bucketing + per-row FX conversion key on
      // (vs. signing-date `projectDate`). Falls back to `projectDate`
      // everywhere via `selectExecutionDate(p)`.
      operationPeriod,
      vesselPlan,
      lines: projectLines,
      costEstimate,
      costEstimateLines,
      actualCost: undefined,
      salesActualUsd,
      salesActualByCurrency,
      salesActualInvoiceCount,
      segmentBudgets,
      segmentBudgetsByMonth,
    };

    return project;
  };

  // Two-pass composition:
  // 1. Iterate parent projectRows. For each parent that has sub-rows,
  //    emit ONLY the sub-projects (parent hidden). Otherwise emit the
  //    parent normally.
  // 2. Sub-rows whose parent isn't in `projectRows` (rare but possible
  //    when the parent fell out of scope) are dropped — without a
  //    parent we have no segment / trader / currency to inherit, and
  //    surfacing an orphan sub-project would look like a phantom
  //    project to the user.
  //
  // The parent-hiding rule is intentional: Vessel Projects + Dashboard
  // operate on voyage-leg granularity. Veri Yönetimi inspector wants
  // parent rows too — it handles that downstream by accepting raw
  // parent rows whose elevated sub-projects passed the filter.
  const projects: Project[] = [];
  for (const parent of projectRows) {
    const parentId = readString(parent, "mserp_projid");
    const subs = parentId ? subsByParent.get(parentId) : undefined;
    if (subs && subs.length > 0) {
      for (const sub of subs) {
        projects.push(buildProject(parent, sub));
      }
    } else {
      projects.push(buildProject(parent, null));
    }
  }

  // Sort by date desc so the most recent projects (which actually have ship
  // plans) bubble to the top — list/auto-select default UX. Old projects
  // (2021 era) without ship plans land at the bottom of the list.
  projects.sort((a, b) => {
    if (!a.projectDate && !b.projectDate) return 0;
    if (!a.projectDate) return 1;
    if (!b.projectDate) return -1;
    return b.projectDate.localeCompare(a.projectDate);
  });

  return {
    projects,
    warnings: {
      unresolvedPorts: getUnresolvedPorts(),
      projectsWithoutShipPlan,
      projectsWithMissingPort,
    },
  };
}

/* ─────────── Ship → VesselPlan ─────────── */

/**
 * Regex extractor for vessel names embedded in F&O project titles
 * like "MV MY REYHAN / 1960 MT SBPP / ARASA / MC FOOD" or
 * "55KMT BRZ SOY / MV XIN HAI TONG 29".
 *
 * IMPORTANT: only `MV / M\V / M\T` are accepted as vessel prefixes.
 * Bare `MT` is intentionally NOT matched — in Tiryaki F&O data it
 * almost always means "Metric Ton" (quantity unit), e.g.
 * "1960 MT SBPP" or "55KMT BRZ SOY". Treating it as a vessel prefix
 * caused captures like "SBPP" to leak through and mask the real
 * vessel mentioned earlier in the same title.
 *
 * The match list is scanned end-to-end; the LAST match wins because
 * some titles put the vessel at the end after quantity prefixes
 * ("55KMT BRZ SOY / MV XIN HAI TONG 29"). Titles like
 * "MV MY REYHAN / 1960 MT SBPP / …" produce a single match, so the
 * "last == only" — vessel "MY REYHAN" wins.
 */
const VESSEL_NAME_RE =
  /\b(?:MV|M\/V|M\/T)[ \-/]+([A-Z][A-Z0-9 \-]{1,30})/i;

function extractVesselFromProjectName(name: string): string | null {
  if (!name) return null;
  const matches = [...name.matchAll(new RegExp(VESSEL_NAME_RE, "gi"))];
  if (matches.length === 0) return null;
  const m = matches[matches.length - 1];
  let v = m[1].trim().replace(/^[\s\-/.,]+|[\s\-/.,]+$/g, "").toUpperCase();
  // Cut at any 2+ space gap, " - " separator, "/", or "(" — those
  // usually delimit a following section ("MV XYZ // SAMA APRIL").
  v = v.split(/\s{2,}|\s*-\s*|\/|\(/)[0].trim();
  return v ? v.slice(0, 32) : null;
}

function toVesselPlan(
  s: Record<string, unknown>,
  projectName: string = ""
): VesselPlan {
  const lpName = readString(s, "mserp_tryloadingport");
  const lpCountry = readString(s, "mserp_loadingcountryregionid");
  const dpName = readString(s, "mserp_trydischargeport");
  const dpCountry = readString(s, "mserp_dischargecountryregionid");

  const lp =
    lookupPortWithCountry(lpName, lpCountry) ?? fallbackPort(lpName, lpCountry);
  const dp =
    lookupPortWithCountry(dpName, dpCountry) ?? fallbackPort(dpName, dpCountry);

  const waypoints = selectCorridor(
    canonicalPortKey(lpName),
    canonicalPortKey(dpName),
    [lp.lon, lp.lat],
    [dp.lon, dp.lat]
  );

  const planned = num(s["mserp_cargoquantity"]);
  const actual = num(s["mserp_outturnquantity"]) || planned;

  // Milestone mapping verified against the D365 form export ("Record info").
  // Order matches the production timeline UX (9 milestones):
  //   LP-(ETA)        → mserp_tryestimatedtimeofarrival
  //   LP-NOR-Accepted → mserp_trynoraccepteddate
  //   LP-(SD)         → mserp_tryloadstartdate
  //   LP-(ED)         → mserp_tryloadenddate
  //   BL              → mserp_trydeparturedatebl
  //   DP-(ETA)        → mserp_arrivaldate          (NOT tryestimatedtimeofarrival)
  //   DP-NOR-Accepted → mserp_tryarrivalconfirmdate (NOT arrivaldate)
  //   DP-(SD)         → mserp_trydischargestartdate
  //   DP-(ED)         → mserp_trydischargeenddate
  const milestones: VesselMilestones = {
    lpEta: isoDate(s["mserp_tryestimatedtimeofarrival"]),
    lpNorAccepted: isoDate(s["mserp_trynoraccepteddate"]),
    lpSd: isoDate(s["mserp_tryloadstartdate"]),
    lpEd: isoDate(s["mserp_tryloadenddate"]),
    blDate: isoDate(s["mserp_trydeparturedatebl"]),
    dpEta: isoDate(s["mserp_arrivaldate"]),
    dpNorAccepted: isoDate(s["mserp_tryarrivalconfirmdate"]),
    dpSd: isoDate(s["mserp_trydischargestartdate"]),
    dpEd: isoDate(s["mserp_trydischargeenddate"]),
  };

  // Supplier (Tedarikçi Firma) lives on `mserp_tryseller`. The earlier
  // mapping preferred `mserp_charterepartyname` (Gemiyi Kiralayan) which
  // is the *charterer*, not the supplier — so the dashboard's "En büyük
  // tedarikçi" rollup was effectively counting carriers. Read tryseller
  // first; fall back to charterepartyname only when seller is absent so
  // legacy rows still render something rather than blank.
  const supplier =
    readString(s, "mserp_tryseller") ||
    readString(s, "mserp_charterepartyname") ||
    "";

  const description = readVesselDescription(s);
  const demurrage = readDemurrageNotes(s);
  // Compact-pill fields for the right panel — friendly value when the
  // option-set / lookup carries a FormattedValue annotation, raw code
  // otherwise. Empty / null-sentinel values are dropped so pills don't
  // render literal strings like "Null" or "(0 - Null)" coming back from
  // F&O option-sets.
  const FRIENDLY_NULL_SENTINELS = new Set([
    "",
    "0",
    "null",
    "(0 - null)",
    "0 - null",
    "—",
    "-",
  ]);
  const isUsefulFriendly = (raw: string, allowNumeric: boolean): boolean => {
    const trimmed = raw.trim();
    if (trimmed.length === 0) return false;
    if (FRIENDLY_NULL_SENTINELS.has(trimmed.toLowerCase())) return false;
    // Long pure-numeric strings (e.g. "200000000") are option-set enum
    // codes that leaked through when Dataverse failed to attach a
    // FormattedValue annotation. Never show those to the user.
    if (!allowNumeric && /^\d+$/.test(trimmed)) return false;
    return true;
  };
  const pickFriendly = (key: string): string | null => {
    // FormattedValue may itself be numeric (rare), so allow numerics there;
    // raw codes are filtered out — they're enum integers, not friendly text.
    const fv = getFormattedValue(s, key);
    if (fv && isUsefulFriendly(fv, true)) return fv.trim();
    const raw = readString(s, key);
    return isUsefulFriendly(raw, false) ? raw.trim() : null;
  };
  const companyId = pickFriendly("mserp_companyid");
  const deliveryTerm = pickFriendly("mserp_dlvtermid");
  const paymentTerm = pickFriendly("mserp_paymtermid");
  const paymentSchedule = pickFriendly("mserp_paymentsched");
  const paymentStatus = pickFriendly("mserp_trypaymentstatus");
  const voyageType = pickFriendly("mserp_tryexpenseprojecttype");
  const netFreightAmount = num(s["mserp_netfreightamount"]);

  // Vessel name resolution — the entity dropped `mserp_vesselname`
  // from its $select-able schema and `mserp_vessel`'s
  // `@OData.Community.Display.V1.FormattedValue` annotation isn't
  // populated either (the column is just a numeric RecID without a
  // related-entity link surfaced through the dual-write metadata).
  // Cascade through every candidate that could carry a real string
  // and bail out to a project-title regex when none do.
  //
  // Numeric-only strings (RecIDs leaking past FV) are rejected so
  // the UI never shows "5637148123" — or its locale-formatted twin
  // "5,637,148,123" — as a vessel name. That bug was visible in
  // production until 2026-05-01.
  const isUsableVesselString = (v: string | undefined | null): v is string =>
    !!v &&
    v.trim().length > 0 &&
    !/^\d[\d\s,.]*$/.test(v.trim());
  const vesselCandidates = [
    readString(s, "mserp_vesselname"),
    getFormattedValue(s, "mserp_vessel"),
    readString(s, "mserp_vesselnameid"),
    readString(s, "mserp_shipname"),
  ];
  const fromCandidates = vesselCandidates.find(isUsableVesselString);
  const fromTitle = fromCandidates
    ? null
    : extractVesselFromProjectName(projectName);
  const vesselName = fromCandidates ?? fromTitle ?? "—";

  // IMO number — surfaced via the post-fetch enrichment that joins
  // the ship row's `mserp_vessel` RecID against the vessel-master
  // entity. Null when the master lookup didn't match (rare; new
  // vessel just chartered, master not refreshed yet).
  const imoRaw = readString(s, "mserp_imonumber").trim();
  const imoNumber = imoRaw.length > 0 ? imoRaw : null;

  return {
    vesselName,
    imoNumber,
    fixtureId: readString(s, "mserp_assignmentid") || "",
    voyage:
      Number(readString(s, "mserp_vesselvoyagenumber") || "1") || 1,
    vesselStatus: normaliseVesselStatus(s),
    operationStatus: readString(s, "mserp_tryshipmentstatus") || "",
    supplier,
    buyer: readString(s, "mserp_trybuyer") || "",
    cargoProduct: readString(s, "mserp_trycargogoods") || "",
    voyageTotalTonnage: planned,
    actualQuantity: actual,
    cargoValueUsd: undefined, // Filled in composeProjects() for USD projects
    loadingPort: lp,
    dischargePort: dp,
    waypoints,
    milestones,
    heroImageUrl: undefined,
    description,
    demurrage,
    companyId,
    deliveryTerm,
    paymentTerm,
    paymentSchedule,
    paymentStatus,
    voyageType,
    netFreightAmount: netFreightAmount > 0 ? netFreightAmount : undefined,
    // Voyage-leg durations as captured on the F&O Gemi Planı —
    // surfaced in the RouteMap header pill row. `num()` collapses
    // missing/non-finite to 0; we treat 0 as "not set" so the pill
    // hides itself rather than rendering "0g".
    loadingDays: positiveOrNull(num(s["mserp_loadingtime"])),
    evacuationDays: positiveOrNull(num(s["mserp_evacuationtime"])),
    transferDays: positiveOrNull(num(s["mserp_transfertime"])),
  };
}

function readVesselDescription(s: Record<string, unknown>): string | null {
  const raw = readString(s, "mserp_trydescription").trim();
  if (raw.length === 0) return null;
  // Same null-sentinels as demurrage — operators sometimes type "-" / "—"
  // to "clear" a field in F&O instead of leaving it blank.
  const lower = raw.toLowerCase();
  if (lower === "-" || lower === "—" || lower === "null") return null;
  return raw;
}

/** Pull the 2 demurrage description columns off the ship row.
 *
 *  Only these 2 free-text fields exist on
 *  `mserp_tryaiprojectshiprelationentities` (verified — the parent
 *  TRYProjectShipRelation table also has `*reason` option-sets and
 *  `*reasonexp` text columns, but the AI variant we read here does
 *  NOT carry those):
 *
 *    mserp_trydemurragereasondesc      — "Yükleme Limanındaki Demoraj Açıklaması"
 *    mserp_trydischargedemurragedesc   — "Tahliye Limanındaki Demoraj Açıklaması"
 *
 *  Empty / null-sentinel / numeric-only values are dropped. Returns
 *  `undefined` when both fields are empty so the right-panel
 *  "Demuraj Notları" card disappears entirely. */
function readDemurrageNotes(
  s: Record<string, unknown>
): VesselDemurrageNotes | undefined {
  const NULL_SENTINELS = new Set([
    "",
    "0",
    "null",
    "(0 - null)",
    "0 - null",
    "—",
    "-",
  ]);
  const pickText = (key: string): string | null => {
    const raw = readString(s, key).trim();
    if (raw.length === 0) return null;
    if (NULL_SENTINELS.has(raw.toLowerCase())) return null;
    if (/^\d+$/.test(raw)) return null;
    return raw;
  };

  const notes: VesselDemurrageNotes = {
    loadingDescription: pickText("mserp_trydemurragereasondesc"),
    dischargeDescription: pickText("mserp_trydischargedemurragedesc"),
  };

  const hasAny = notes.loadingDescription || notes.dischargeDescription;
  return hasAny ? notes : undefined;
}

function normaliseVesselStatus(
  s: Record<string, unknown>
): VesselStatus | undefined {
  // Prefer the option-set FormattedValue (friendly label like "Commenced"
  // or "To be nominated"); fall back to the free-text shipment-status
  // column for tenants that ignore the option-set.
  const fv =
    getFormattedValue(s, "mserp_voyagestatus") ||
    getFormattedValue(s, "mserp_tryshipmentstatus") ||
    readString(s, "mserp_voyagestatus") ||
    "";
  if (!fv) return undefined;
  // Raw F&O option-set integer code (no FormattedValue annotation
  // surfaced for this row). An unset voyage status defaults to the
  // option-set's "no value" code in the 100M–1B range; semantically
  // that means the voyage hasn't been assigned yet → "To Be Nominated".
  // Without this fallback the field would surface as undefined and
  // ProjectCard would drop back to project.status (Açık/Open), losing
  // the actual voyage state.
  if (/^[12]\d{8}$/.test(fv.trim())) return "To Be Nominated";
  const u = fv.toLowerCase();

  // Order matters — "to be nominated" must be tested before "nominated"
  // (substring match), and "cancelled" before any "complet" check is fine.
  if (u.includes("cancel") || u.includes("iptal")) return "Cancelled";
  if (u.includes("to be nominat") || u.includes("atanacak"))
    return "To Be Nominated";
  if (u.includes("nominat") || u.includes("atan")) return "Nominated";
  if (
    u.includes("closed") ||
    u.includes("kapali") ||
    u.includes("kapalı")
  ) {
    return "Closed";
  }
  if (
    u.includes("complet") ||
    u.includes("tamamlan") ||
    u.includes("discharged") ||
    u.includes("bosaltıld") ||
    u.includes("boşaltıld")
  ) {
    return "Completed";
  }
  if (
    u.includes("commen") ||
    u.includes("baslad") ||
    u.includes("başlad") ||
    u.includes("active") ||
    u.includes("progress") ||
    u.includes("loading") ||
    u.includes("yukle") ||
    u.includes("transit") ||
    u.includes("yolda")
  ) {
    return "Commenced";
  }
  // Unrecognised label — leave the field undefined so the UI can fall
  // back to the project's own Open/Closed status.
  return undefined;
}

/* ─────────── Lines → ProjectLine ─────────── */

function toProjectLine(r: Record<string, unknown>): ProjectLine {
  const itemCode = readString(r, "mserp_itemid");
  return {
    itemCode,
    productName: itemCode, // No name field in PROJECT_LINE_COLUMNS — reuse code
    quantityKg: num(r["mserp_qty"]),
    unit: readString(r, "mserp_unitid") || "KG",
    unitPrice: num(r["mserp_unitprice"]),
    // Purchase price hides under the misleading `mserp_salesprice`
    // column — see `ProjectLine` JSDoc.
    purchasePrice: num(r["mserp_salesprice"]),
    currency: readString(r, "mserp_currencycode") || "USD",
    level1: readString(r, "mserp_etgproductlevel01"),
    level2: readString(r, "mserp_etgproductlevel02"),
    level3: readString(r, "mserp_etgproductlevel03"),
    qualityClass: readString(r, "mserp_qualitycategoryid"),
  };
}

/* ─────────── Project tonnage (multiplier for expense lines) ─────────── */

function computeProjectTons(
  vesselPlan: VesselPlan | undefined,
  lines: ProjectLine[]
): number {
  // Prefer the project line tonnage so estimated expense scales the
  // same way Tahmini Satış / Tahmini Alım do (both sum
  // `Σ (line.quantityKg / 1000) × unitPrice`). Mixing voyage tonnage
  // here would produce an off-axis Tahmini Gider when the vessel
  // booking covers a different load size than the project lines —
  // typically because the vessel is shared across multiple projects.
  // Falls back to vessel plan only when there are no priced lines.
  const totalKg = lines.reduce((acc, l) => acc + l.quantityKg, 0);
  if (totalKg > 0) return totalKg / 1000;
  if (vesselPlan && vesselPlan.voyageTotalTonnage > 0) {
    return vesselPlan.voyageTotalTonnage;
  }
  return 0;
}

/* ─────────── Expenses → CostEstimateLine[] (per-line totals) ─────────── */

function toCostEstimateLines(
  aggregateRows: Record<string, unknown>[],
  tons: number
): CostEstimateLine[] {
  // Aggregate rows come pre-grouped from the "Tahmini Gider Toplamı"
  // refresh step (one entry per projectNo × expenseTypeCode), so this
  // function is a flat map instead of a grouping loop.
  //
  // Shape (from `EstimatedExpenseAggregateRow` in refreshAll.ts):
  //   { projectNo, expenseTypeCode, expenseTypeLabel, totalUnitUsd, rowCount }
  //
  // `name` falls back through label → code → "Diğer" exactly the same
  // way the old raw-row variant did, so the downstream bucketing logic
  // in `toCostEstimate` keeps matching FREIGHT_REFS / INSURANCE_REFS /
  // DUTIES_REFS unchanged.
  const lines: CostEstimateLine[] = [];
  for (const r of aggregateRows) {
    const code = readString(r, "expenseTypeCode").trim();
    const label = readString(r, "expenseTypeLabel").trim();
    const name = (label || code || "Diğer").trim();
    const unitPriceUsd = num(r["totalUnitUsd"]);
    lines.push({
      name,
      code: code || undefined,
      unitPriceUsd,
      tons,
      totalUsd: unitPriceUsd * tons,
    });
  }
  return lines;
}

/* ─────────── CostEstimateLine[] → CostEstimate (rolled up) ─────────── */

function toCostEstimate(lines: CostEstimateLine[]): CostEstimate {
  let freight = 0;
  let insurance = 0;
  let duties = 0;
  let other = 0;
  for (const l of lines) {
    if (!l.totalUsd) continue;
    if (FREIGHT_REFS.has(l.name)) freight += l.totalUsd;
    else if (INSURANCE_REFS.has(l.name)) insurance += l.totalUsd;
    else if (DUTIES_REFS.has(l.name)) duties += l.totalUsd;
    else other += l.totalUsd;
  }
  const totalUsd = freight + insurance + duties + other;
  return {
    freightUsd: Math.round(freight),
    insuranceUsd: Math.round(insurance),
    dutiesUsd: Math.round(duties),
    otherUsd: Math.round(other),
    totalUsd: Math.round(totalUsd),
  };
}

/* ─────────── Helpers ─────────── */

function readString(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return "";
}

function num(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/** Treat a 0 / non-finite numeric as "not set". Used by the duration
 *  fields on the ship plan — F&O writes 0 when the operator hasn't
 *  filled in the loading / discharge / transit time, and we'd rather
 *  hide the pill than render "0g". */
function positiveOrNull(v: number): number | null {
  return Number.isFinite(v) && v > 0 ? v : null;
}

function isoDate(v: unknown): string | null {
  if (!v || typeof v !== "string") return null;
  const s = v.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function normaliseDeliveryMode(p: Record<string, unknown>): DeliveryMode {
  const fv = getFormattedValue(p, "mserp_dlvmode") || readString(p, "mserp_dlvmode");
  if (!fv) return "Gemi";
  const u = fv.toLowerCase();
  if (u.includes("kara") || u.includes("road") || u.includes("truck")) return "Kara";
  if (u.includes("konteyner") || u.includes("container")) return "Konteyner";
  return "Gemi";
}

/** Sub-project variant — sub-project header uses `mserp_dlvmodeid`
 *  (note the `id` suffix) instead of the parent's `mserp_dlvmode`.
 *  Returns null when the column is absent / empty so the caller can
 *  fall back to the parent's value. */
function normaliseDeliveryModeFromSub(
  sub: Record<string, unknown>
): DeliveryMode | null {
  const fv =
    getFormattedValue(sub, "mserp_dlvmodeid") ||
    readString(sub, "mserp_dlvmodeid");
  if (!fv) return null;
  const u = fv.toLowerCase();
  if (u.includes("kara") || u.includes("road") || u.includes("truck")) return "Kara";
  if (u.includes("konteyner") || u.includes("container")) return "Konteyner";
  return "Gemi";
}

function normaliseCurrency(raw: string): "USD" | "EUR" | "TRY" {
  if (raw === "USD" || raw === "EUR" || raw === "TRY") return raw;
  // Real Dataverse uses ISO codes uppercased — anything else (TL, EURO, etc.)
  // gets coerced to USD as a safe default so currency-comparison aggregations
  // don't NaN.
  return "USD";
}

function normaliseIncoterm(p: Record<string, unknown>): Incoterm {
  const raw =
    getFormattedValue(p, "mserp_dlvterm") || readString(p, "mserp_dlvterm");
  if (!raw) return "FOB";
  const u = raw.toUpperCase();
  if (u.includes("FOB")) return "FOB";
  if (u.includes("CIF")) return "CIF";
  if (u.includes("CFR")) return "CFR";
  if (u.includes("DAP")) return "DAP";
  if (u.includes("DDP")) return "DDP";
  if (u.includes("EXW")) return "EXW";
  // Tenant-specific codes (e.g. MUS_DP_TES) — Incoterm is `string` union,
  // pass through so the chip shows the raw label.
  return raw as Incoterm;
}

/** Sub-project variant — column is `mserp_dlvtermid` (note `id` suffix).
 *  Returns null when absent so the caller can inherit from parent. */
function normaliseIncotermFromSub(
  sub: Record<string, unknown>
): Incoterm | null {
  const raw =
    getFormattedValue(sub, "mserp_dlvtermid") ||
    readString(sub, "mserp_dlvtermid");
  if (!raw) return null;
  const u = raw.toUpperCase();
  if (u.includes("FOB")) return "FOB";
  if (u.includes("CIF")) return "CIF";
  if (u.includes("CFR")) return "CFR";
  if (u.includes("DAP")) return "DAP";
  if (u.includes("DDP")) return "DDP";
  if (u.includes("EXW")) return "EXW";
  return raw as Incoterm;
}

function fallbackPort(name: string, country: string): Port {
  return { name: name || "—", country: country || "—", lat: 0, lon: 0 };
}
