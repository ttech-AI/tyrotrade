/**
 * Month-resolved realised SALES + PURCHASE aggregation for the E.M Bakış
 * "Monthly Projected × Realized P&L" table (LIVE_PL replica).
 *
 * 🔒 Read-only. Fetches raw customer- + vendor-invoice rows for a scoped
 * set of projects and buckets them by **invoice date month** — the axis
 * Power BI's "Live Realized" measures use (verified: Aug-25 = 174.5M,
 * qty 456,857, matches PBI to 0.08%). This is deliberately DIFFERENT from
 * the per-project realised totals (`salesActualUsd` / `purchaseActualUsd`)
 * the composer produces, which have no month dimension and get bucketed
 * into the project's single execution month.
 *
 * Why raw rows (not a `$apply` groupby): F&O virtual entities reject
 * `groupby` on a datetime field ("Groupby on datetime field is not
 * supported"), so a server-side per-month aggregate isn't possible. The
 * E.M scope is small (~260 projects → ~350 sales rows), so a raw fetch +
 * client-side monthly bucketing is cheap.
 *
 * Same exclusions as the tenant sales/purchase aggregates so the numbers
 * reconcile with the rest of the app:
 *   - intercompany rows dropped server-side (`NON_INTERCOMPANY_FILTER`)
 *   - financing-order rows (`mserp_etgordertype === 'Finansman'`) dropped
 *     client-side via the cached financing sales/purchase ID sets
 *   - item codes starting with "8" dropped (PBI "ItemId does not start
 *     with '8'" — treasury / non-goods lines)
 *
 * FX: each row converts at its OWN invoice date (not the project's
 * execution-date anchor), which is closer to how PBI reports the USD
 * figure per transaction.
 */

import type { DataverseClient } from "@/lib/dataverse/client";
import {
  listAllByInChunked,
  NON_INTERCOMPANY_FILTER,
  getFinancingSalesIdSet,
  getFinancingPurchIdSet,
} from "@/lib/dataverse/refreshAll";
import { toUsdAtDate } from "@/lib/finance/fxRates";

const SALES_ENTITY = "mserp_tryaicustinvoicetransentities";
const PURCHASE_ENTITY = "mserp_tryaivendinvoicetransentities";

/** One realised (projectNo × month) aggregate. Serialisable so the whole
 *  array rides the localStorage cache like the other synthetic rollups. */
export interface RealizedByMonthRow {
  /** Project number — join key against the projects cache. */
  projectNo: string;
  /** "YYYY-MM" of the invoice date. */
  monthKey: string;
  /** Σ customer-invoice line amount for this project+month, FX→USD at
   *  each invoice's own date. */
  revenueUsd: number;
  /** Σ invoiced quantity (kg → t) for this project+month. */
  qtyTons: number;
  /** Σ vendor-invoice line amount for this project+month, FX→USD. */
  purchaseUsd: number;
}

/** Synthetic localStorage cache key (not a real Dataverse entity set). */
export const REALIZED_BY_MONTH_CACHE = "realizedByMonth";

function monthKeyOf(iso: unknown): string | null {
  if (typeof iso !== "string" || iso.length < 7) return null;
  const s = iso.slice(0, 7);
  return /^\d{4}-\d{2}$/.test(s) ? s : null;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Fetch + bucket realised sales & purchase by invoice month for the given
 * projects. Returns a flat `RealizedByMonthRow[]` plus the projids it
 * actually covered (so the consumer can gate on coverage exactly like the
 * expense rollup does).
 */
export async function fetchRealizedByMonthForProjects(
  client: DataverseClient,
  projids: string[]
): Promise<{ rows: RealizedByMonthRow[]; computedProjids: string[] }> {
  const cleanProjids = Array.from(
    new Set(projids.map((p) => p.trim()).filter(Boolean))
  );
  if (cleanProjids.length === 0) return { rows: [], computedProjids: [] };

  const financingSales = getFinancingSalesIdSet();
  const financingPurch = getFinancingPurchIdSet();

  // Independent (allSettled): customer invoices (revenue + qty) and vendor
  // invoices (purchase). Both intercompany-filtered server-side. If ONE
  // query fails (e.g. an entity/field quirk on the buy side) we still
  // surface the other so realised Revenue/Qty appear — and we log exactly
  // which leg failed instead of killing the whole aggregate.
  const [salesSettled, purchSettled] = await Promise.allSettled([
    listAllByInChunked<Record<string, unknown>>(
      client,
      SALES_ENTITY,
      "mserp_etgtryprojid",
      cleanProjids,
      {
        $select:
          "mserp_etgtryprojid,mserp_salesid,mserp_invoicedate,mserp_qty,mserp_lineamount,mserp_currencycode,mserp_itemid",
      },
      undefined,
      NON_INTERCOMPANY_FILTER
    ),
    listAllByInChunked<Record<string, unknown>>(
      client,
      PURCHASE_ENTITY,
      "mserp_purchtable_etgtryprojid",
      cleanProjids,
      {
        $select:
          "mserp_purchtable_etgtryprojid,mserp_purchid,mserp_invoicedate,mserp_lineamount,mserp_currencycode,mserp_itemid",
      },
      undefined,
      NON_INTERCOMPANY_FILTER
    ),
  ]);
  if (salesSettled.status === "rejected") {
    // eslint-disable-next-line no-console
    console.warn("[realizedByMonth] SALES query failed:", salesSettled.reason);
  }
  if (purchSettled.status === "rejected") {
    // eslint-disable-next-line no-console
    console.warn(
      "[realizedByMonth] PURCHASE query failed:",
      purchSettled.reason
    );
  }
  const salesRes =
    salesSettled.status === "fulfilled" ? salesSettled.value : { value: [] };
  const purchRes =
    purchSettled.status === "fulfilled" ? purchSettled.value : { value: [] };

  // projectNo → monthKey → aggregate. Built additively then flattened.
  const agg = new Map<
    string,
    Map<string, { revenueUsd: number; qtyTons: number; purchaseUsd: number }>
  >();
  const bump = (
    projectNo: string,
    monthKey: string
  ): { revenueUsd: number; qtyTons: number; purchaseUsd: number } => {
    let byMonth = agg.get(projectNo);
    if (!byMonth) {
      byMonth = new Map();
      agg.set(projectNo, byMonth);
    }
    let entry = byMonth.get(monthKey);
    if (!entry) {
      entry = { revenueUsd: 0, qtyTons: 0, purchaseUsd: 0 };
      byMonth.set(monthKey, entry);
    }
    return entry;
  };

  for (const r of salesRes.value) {
    const salesid = String(r.mserp_salesid ?? "");
    if (financingSales.has(salesid)) continue;
    if (String(r.mserp_itemid ?? "").startsWith("8")) continue;
    const projectNo = String(r.mserp_etgtryprojid ?? "").trim();
    if (!projectNo) continue;
    const monthKey = monthKeyOf(r.mserp_invoicedate);
    if (!monthKey) continue;
    const cur = String(r.mserp_currencycode ?? "USD");
    const iso = String(r.mserp_invoicedate ?? "").slice(0, 10);
    const entry = bump(projectNo, monthKey);
    entry.revenueUsd += toUsdAtDate(num(r.mserp_lineamount), cur, iso);
    entry.qtyTons += num(r.mserp_qty) / 1000;
  }

  for (const r of purchRes.value) {
    const purchid = String(r.mserp_purchid ?? "");
    if (financingPurch.has(purchid)) continue;
    if (String(r.mserp_itemid ?? "").startsWith("8")) continue;
    const projectNo = String(r.mserp_purchtable_etgtryprojid ?? "").trim();
    if (!projectNo) continue;
    const monthKey = monthKeyOf(r.mserp_invoicedate);
    if (!monthKey) continue;
    const cur = String(r.mserp_currencycode ?? "USD");
    const iso = String(r.mserp_invoicedate ?? "").slice(0, 10);
    const entry = bump(projectNo, monthKey);
    entry.purchaseUsd += toUsdAtDate(num(r.mserp_lineamount), cur, iso);
  }

  const rows: RealizedByMonthRow[] = [];
  for (const [projectNo, byMonth] of agg) {
    for (const [monthKey, e] of byMonth) {
      rows.push({
        projectNo,
        monthKey,
        revenueUsd: Math.round(e.revenueUsd),
        qtyTons: Math.round(e.qtyTons),
        purchaseUsd: Math.round(e.purchaseUsd),
      });
    }
  }
  return { rows, computedProjids: cleanProjids };
}

/* ─────────── Consumer-side reshape ─────────── */

/** Per-project month map: projectNo → monthKey → {revenue, qty, purchase}. */
export type RealizedByMonthMap = Map<
  string,
  Map<string, { revenueUsd: number; qtyTons: number; purchaseUsd: number }>
>;

/** Rebuild the nested map from the flat cached rows. */
export function indexRealizedByMonth(
  rows: RealizedByMonthRow[]
): RealizedByMonthMap {
  const map: RealizedByMonthMap = new Map();
  for (const r of rows) {
    let byMonth = map.get(r.projectNo);
    if (!byMonth) {
      byMonth = new Map();
      map.set(r.projectNo, byMonth);
    }
    byMonth.set(r.monthKey, {
      revenueUsd: r.revenueUsd,
      qtyTons: r.qtyTons,
      purchaseUsd: r.purchaseUsd,
    });
  }
  return map;
}
