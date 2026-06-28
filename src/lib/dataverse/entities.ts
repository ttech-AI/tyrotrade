export type DeliveryMode = "Gemi" | "Kara" | "Konteyner";
export type Incoterm = "FOB" | "CIF" | "CFR" | "DAP" | "EXW" | "DDP";
/** Vessel-plan voyage status — set only when a ship plan row exists.
 *
 *  Six canonical values from the F&O TRYProjectShipRelation form
 *  (`mserp_voyagestatus` option-set), normalised to English by
 *  `normaliseVesselStatus`:
 *    - "To Be Nominated"  — vessel not yet assigned to the contract
 *    - "Nominated"        — vessel assigned, awaiting loading
 *    - "Commenced"        — voyage in progress (loading → transit → discharge)
 *    - "Completed"        — cargo delivered, voyage closed operationally
 *    - "Closed"           — finalised (paid, closed in finance)
 *    - "Cancelled"        — voyage cancelled before completion
 *
 *  When this field is absent the UI falls back to the project's own
 *  `status` (Açık / Kapalı). */
export type VesselStatus =
  | "To Be Nominated"
  | "Nominated"
  | "Commenced"
  | "Completed"
  | "Closed"
  | "Cancelled"
  | string;
export type ProjectStatus = "Açık" | "Kapalı" | string;

export type TransportMode = "sea" | "road";

export const transportModeFor = (m: DeliveryMode): TransportMode =>
  m === "Kara" ? "road" : "sea";

export interface Port {
  name: string;
  country: string;
  lon: number;
  lat: number;
}

export interface Waypoint {
  lon: number;
  lat: number;
  name?: string;
}

export interface VesselMilestones {
  lpEta: string | null;
  lpNorAccepted: string | null;
  lpSd: string | null;
  lpEd: string | null;
  blDate: string | null;
  dpEta: string | null;
  dpNorAccepted: string | null;
  /** DP-(SD) — Tahliye Başlangıç Tarihi (`mserp_trydischargestartdate`). */
  dpSd: string | null;
  /** DP-(ED) — Tahliye Bitiş Tarihi (`mserp_trydischargeenddate`). */
  dpEd: string | null;
}

export interface VesselPlan {
  vesselName: string;
  /** IMO Numarası — looked up from the vessel-master entity
   *  (`mserp_tryvlxvesseltableentities.mserp_imonumber`) via the
   *  ship-relation row's `mserp_vessel` RecID. Null when the
   *  vessel-master entry is missing or the IMO field is empty. */
  imoNumber?: string | null;
  fixtureId: string;
  voyage: number;
  /** Optional — may be omitted when the ship row has no recognisable
   *  voyage status. UI components fall back to the project's own status. */
  vesselStatus?: VesselStatus;
  operationStatus: string;
  supplier: string;
  buyer: string;
  cargoProduct: string;
  voyageTotalTonnage: number;
  actualQuantity: number;
  cargoValueUsd?: number;
  loadingPort: Port;
  dischargePort: Port;
  /** Ordered list of discharge ports when the F&O `mserp_trydischargeport`
   *  string names more than one (comma-separated, e.g. "Morehead, New
   *  Orleans"). Each entry is a resolved {@link Port}; order = discharge
   *  sequence. `dischargePort` mirrors the LAST entry (final destination).
   *  Left undefined for the common single-port case — consumers should
   *  treat `dischargeStops ?? [dischargePort]` as the canonical sequence. */
  dischargeStops?: Port[];
  /** Optional intermediate sea-only waypoints (straits, canals) between
   *  loadingPort and dischargePort. Order matters. Excludes origin/destination. */
  waypoints?: Waypoint[];
  milestones: VesselMilestones;
  heroImageUrl?: string;
  /** `mserp_trydescription` — operator's free-text "Açıklama" on the ship
   *  plan. Surfaced in the right panel as "Önemli not" so the user can read
   *  voyage-specific guidance (deviations, special handling, etc.) without
   *  drilling into Veri Yönetimi. */
  description?: string | null;
  /** Demurrage / extra-cost notes captured at the loading + discharge ports.
   *  Each field is optional — only set when F&O has a value. The UI lists
   *  the present ones as a bulleted "Demuraj Notları" block. */
  demurrage?: VesselDemurrageNotes;
  /** mserp_companyid — "Şirket Hesap Kodu" (e.g. "TYRO"). Surfaced as a
   *  compact pill in the right-panel overview. */
  companyId?: string | null;
  /** mserp_dlvtermid — "Teslimat Koşulları" friendly value (e.g. "FOB",
   *  "CIF"). Falls back to the project's `incoterm` when absent. */
  deliveryTerm?: string | null;
  /** mserp_paymtermid — "Ödeme Yöntemi" friendly value (e.g. "Net 30"). */
  paymentTerm?: string | null;
  /** mserp_paymentsched — "Ödeme Planı" (payment schedule, e.g. "30/60/90").
   *  Rendered alongside `paymentTerm` in the contract strip. */
  paymentSchedule?: string | null;
  /** mserp_tryexpenseprojecttype — "İşlem Yönü" / project-type label
   *  (e.g. "Transit", "Import", "Export"). Prefixes the "Sefer" pill on
   *  the hero overlay so the operator sees voyage flavour at a glance. */
  voyageType?: string | null;
  /** mserp_trypaymentstatus — "Ödeme Durumu" formatted value (e.g.
   *  "Tamamlandı", "Beklemede"). Rendered as its own card below the
   *  demurrage notes when set. */
  paymentStatus?: string | null;
  /** mserp_netfreightamount — "Ürün Bedeli ($)". The actual cargo value
   *  from F&O, used for the Tahmini Bedel stat. Distinct from
   *  `cargoValueUsd` which we synthesize from line totals when this field
   *  is missing. */
  netFreightAmount?: number;
  /** mserp_loadingtime — Yükleme Süresi (gün). Surfaced in the
   *  RouteMap header pill row alongside Tahliye + Transit, replacing
   *  the older single "transit" pill that was derived from the
   *  milestone span. */
  loadingDays?: number | null;
  /** mserp_evacuationtime — Tahliye Süresi (gün). */
  evacuationDays?: number | null;
  /** mserp_transfertime — Transit Süresi (gün). */
  transferDays?: number | null;
}

export interface VesselDemurrageNotes {
  /** mserp_trydemurragereasondesc — "Yükleme Limanındaki Demoraj Açıklaması".
   *  The AI-variant entity only carries description columns; the parent
   *  table's `*reason` option-set + `*reasonexp` text aren't synced here. */
  loadingDescription?: string | null;
  /** mserp_trydischargedemurragedesc — "Tahliye Limanındaki Demoraj Açıklaması" */
  dischargeDescription?: string | null;
}

export interface ProjectLine {
  itemCode: string;
  productName: string;
  quantityKg: number;
  unit: string;
  /** Sales unit price (per ton). Stored in F&O as `mserp_unitprice` —
   *  the column is misnamed at the system level, but operationally it
   *  represents the SALES side of the line. */
  unitPrice: number;
  /** Purchase unit price (per ton). Stored in F&O as
   *  `mserp_salesprice` — again a system-naming oddity. Optional so
   *  the legacy mock dataset (which never had this field) still
   *  type-checks; consumers should treat absent as `0`. */
  purchasePrice?: number;
  currency: string;
  level1: string;
  level2: string;
  level3: string;
  qualityClass: string;
}

export interface CostEstimate {
  freightUsd: number;
  insuranceUsd: number;
  dutiesUsd: number;
  otherUsd: number;
  totalUsd: number;
}

/**
 * One row from `mserp_tryaiotherexpenseentities` reshaped for UI.
 * `unitPriceUsd` is `mserp_expamountusdd` (per-ton USD rate); `totalUsd` is
 * the rate multiplied by the project's tonnage so each row carries its own
 * computed total ready for the Estimated Expense card.
 */
export interface CostEstimateLine {
  /** Display name — friendly category from
   *  `mserp_tryexpensetype@FormattedValue` (e.g. "Operasyonel giderler")
   *  when set, falls back to the raw `mserp_tryexpensetype` code, then
   *  "Diğer" when both are empty. */
  name: string;
  /** mserp_tryexpensetype — "Yan masraf türü" raw code (e.g. "721002").
   *  Surfaced separately so the UI can render code + friendly category. */
  code?: string;
  /** mserp_description — optional human note */
  description?: string;
  /** mserp_expamountusdd — unit price per metric ton (USD/MT) */
  unitPriceUsd: number;
  /** Tonnage used to compute the total (project.vesselPlan.voyageTotalTonnage
   *  or summed line tons fallback). Surfaced for transparency. */
  tons: number;
  /** unitPriceUsd × tons — already rolled up so the UI just renders. */
  totalUsd: number;
}

export interface ActualCost {
  bookedUsd: number;
  invoicedUsd: number;
  paidUsd: number;
}

export interface Project {
  projectNo: string;
  projectName: string;
  projectGroup: "TAHIL" | "YAGLITOHUM" | "MISIR" | string;
  traderNo: string;
  mainTraderNo: string;
  customerAccount?: string | null;
  description?: string | null;
  currency: "USD" | "EUR" | "TRY";
  tradeType: string;
  segment?: string | null;
  deliveryMode: DeliveryMode;
  incoterm: Incoterm;
  status: ProjectStatus;
  workflowStatus: string;
  projectDate: string;
  organic?: boolean | null;
  transactionDirection?: string | null;
  operationPeriod?: string | null;
  vesselPlan?: VesselPlan;
  lines: ProjectLine[];
  costEstimate?: CostEstimate;
  /** Per-line breakdown of estimated expenses (rate × tons). */
  costEstimateLines?: CostEstimateLine[];
  actualCost?: ActualCost;
  /** Total invoiced sales in USD (sum of `mserp_lineamount` where currency=USD).
   *  Source: server-side aggregation over invoice transactions. */
  salesActualUsd?: number;
  /** Same totals broken out by currency code. USD, TRY, EUR all in their own
   *  units (no FX conversion). */
  salesActualByCurrency?: Record<string, number>;
  /** Number of invoice rows aggregated for this project. */
  salesActualInvoiceCount?: number;
  /** Realized invoiced quantity in TONS (Σ `mserp_qty` kg ÷ 1000) from
   *  customer invoices — the "Live Realized Quantity" column on the E.M
   *  Bakış realized-vs-projected table. */
  salesActualQtyTons?: number;
  /** Total realized vendor-invoice purchase in USD (sum of
   *  `mserp_lineamount` where currency=USD) — the realized "Alım" twin
   *  of `salesActualUsd`. Server-side aggregation over
   *  `mserp_tryaivendinvoicetransentities`, financing-order rows
   *  stripped. Used for realized K/Z so the dashboard reconciles with
   *  the project-detail BudgetSalesCard. */
  purchaseActualUsd?: number;
  /** Same purchase totals broken out by currency code (no FX). */
  purchaseActualByCurrency?: Record<string, number>;
  /** Per-year aggregated budget for this project's segment (sum of
   *  `mserp_amount` / `mserp_qty` over all rows with the same segment). */
  segmentBudgets?: SegmentBudgetYearSummary[];
  /** Per-month aggregated budget — used by the project detail card to
   *  match invoiced sales' invoice-month against its budget period. */
  segmentBudgetsByMonth?: SegmentBudgetMonthSummary[];
}

export interface SegmentBudgetYearSummary {
  year: number;
  /** Sum of `mserp_amount` for the segment in this year. */
  totalAmount: number;
  /** Sum of `mserp_qty` for the segment in this year. */
  totalQty: number;
}

export interface SegmentBudgetMonthSummary {
  year: number;
  /** Calendar month (1–12) extracted from `mserp_year` ISO date. */
  month: number;
  /** Sum of `mserp_amount` for the segment in this month. */
  totalAmount: number;
  /** Sum of `mserp_qty` for the segment in this month. */
  totalQty: number;
}

export const isSea = (p: Project) => transportModeFor(p.deliveryMode) === "sea";
export const isRoad = (p: Project) => transportModeFor(p.deliveryMode) === "road";

/* ─────────── Composed view types (for read-only client + UI) ─────────── */

/**
 * Composed "full" project view with all child entities resolved.
 *
 * Today this is identical to `Project` (because mock data inlines everything).
 * Once the real Dataverse client lands, the assembly will happen via a single
 * `$expand` round-trip in `projectRepo.getProjectFull(no)`. The UI continues
 * to consume `ProjectFull` regardless of which client is active.
 */
export type ProjectFull = Project;

/**
 * Lightweight project header — used by list views (Project list, KingProjects,
 * CommandPalette). Real client can return only these fields via `$select`.
 *
 * For now this is just `Project` minus the heavy nested arrays/objects, as
 * a documented type alias. Mock client returns the full project anyway.
 */
export type ProjectHeader = Omit<
  Project,
  "lines" | "costEstimate" | "actualCost"
> & {
  /** Heavy children intentionally omitted in header view */
  lines?: never;
  costEstimate?: never;
  actualCost?: never;
};
