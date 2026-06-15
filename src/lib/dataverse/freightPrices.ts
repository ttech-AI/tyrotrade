/**
 * 🔒 READ-ONLY indicative-freight-price pipeline.
 *
 * Joins two F&O virtual entities into a flat, trimmed `FreightRow[]` the
 * "Fiyat Takibi" page consumes:
 *
 *   mserp_tryaifreightpriceheaderentities  (route headers — ports, distance)
 *        │  mserp_headerrecid  (bigint join key)
 *        ▼
 *   mserp_tryaifreightpricedetailentities  (price LINES — one per validity
 *        window × vessel class × cargo, with min/max freight, tonnage, rates)
 *
 * The header carries the ONLY usable port names; every other useful field is
 * on the detail. We fetch both tenant-wide (`listAll`, paginated), build a
 * `headerRecId → ports` map, then project each detail line into a `FreightRow`
 * enriched with its route. Output is cached under the synthetic key
 * `tyro:dv:freightPriceRows` (writeCache accepts any string key) — NOT a real
 * entity set, and deliberately NOT part of the global refresh chain, so users
 * who never open the page never pay the fetch.
 *
 * Quota note: we cache the TRIMMED join (≈25 fields/row), never the raw
 * entities, and `writeCache` is quota-guarded — on overflow the rows stay in
 * React state for the session (see useFreightPrices).
 */

import type { DataverseClient } from "./client";

/* ─────────── $select column lists (co-located — these are NOT inspector
 *  entities, so they don't live in columnOrder.ts). Every field below is
 *  present on a live sample row the user provided, so $select is safe. ─────── */

export const FREIGHT_HEADER_ENTITY = "mserp_tryaifreightpriceheaderentities";
export const FREIGHT_DETAIL_ENTITY = "mserp_tryaifreightpricedetailentities";

/** Synthetic localStorage cache key for the joined, trimmed rows. */
export const FREIGHT_PRICE_ROWS_CACHE = "freightPriceRows";

const FREIGHT_HEADER_COLUMNS = [
  "mserp_headerrecid",
  "mserp_loadingportnew",
  "mserp_dischargingportnew",
  "mserp_durationdays",
  "mserp_distance",
] as const;

const FREIGHT_DETAIL_COLUMNS = [
  "mserp_detailrecid",
  "mserp_headerrecid",
  "mserp_linenumber",
  "mserp_vesseltypename",
  "mserp_shipsizecategory",
  "mserp_cargogoodname",
  "mserp_freightcargotype",
  "mserp_tryshipoperationpackagetype",
  "mserp_freightprice",
  "mserp_maxfreightprice",
  "mserp_currencycode",
  "mserp_validitystartdate",
  "mserp_validityfinishdate",
  "mserp_laycanfrom",
  "mserp_laycanto",
  "mserp_mintonage",
  "mserp_maxtonage",
  "mserp_loadingratestr",
  "mserp_loadingrateterm",
  "mserp_dischargeratestr",
  "mserp_dischargerateterm",
  "mserp_stowagefactor",
  "mserp_loadingpartyname",
  "mserp_dischargingpartyname",
  "mserp_notes",
] as const;

/* ─────────── Domain row ─────────── */

/**
 * One detail price line, enriched with its header's route. The single join
 * unit every freight selector / filter / table row derives from.
 */
export interface FreightRow {
  /** Stable per-line key (mserp_detailrecid). */
  detailRecId: string;
  /** Join key back to the header (mserp_headerrecid). */
  headerRecId: string;
  lineNumber: number | null;

  /* Route — from the header */
  loadingPort: string;
  dischargePort: string;
  distance: number | null;
  durationDays: number | null;

  /* Classification — from the detail */
  vesselType: string;
  shipSizeCategory: string;
  cargoGood: string;
  freightCargoType: string;
  packageType: string;

  /* Price (per-ton rate, in `currency`) */
  freightPrice: number | null;
  maxFreightPrice: number | null;
  currency: string;

  /* Validity window + laycan (ISO strings, as returned) */
  validityStart: string | null;
  validityFinish: string | null;
  laycanFrom: string | null;
  laycanTo: string | null;

  /* Tonnage band */
  minTonnage: number | null;
  maxTonnage: number | null;

  /* Loading / discharge rates (kept as the raw strings F&O sends, e.g.
   * "5000" or "4000-4000-6000") + their terms (SSHEX, SSHINC, …) */
  loadingRate: string;
  loadingRateTerm: string;
  dischargeRate: string;
  dischargeRateTerm: string;
  stowageFactor: number | null;

  /* Parties / free text */
  loadingPartyName: string;
  dischargePartyName: string;
  notes: string;
}

/* ─────────── Fetch progress (drives the light progress UI) ─────────── */

export type FreightFetchStage = "headers" | "details" | "join";

export interface FreightFetchProgress {
  stage: FreightFetchStage;
  /** Records loaded so far in this stage. */
  loaded: number;
}

/* ─────────── Coercion helpers ─────────── */

function str(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (v == null) return "";
  return String(v).trim();
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** ISO date string passthrough (formatDate parses it). Empty → null. */
function isoOrNull(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/** Stringify a bigint/number recid into a stable map key. */
function recKey(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

/** F&O stores `mserp_notes` as rich HTML. Strip tags + decode the common
 *  entities to plain text (newlines preserved at block boundaries) so the
 *  detail panel doesn't render raw `<p><span>` markup. */
function stripHtml(v: unknown): string {
  const s = typeof v === "string" ? v : v == null ? "" : String(v);
  if (!s) return "";
  return s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&(rsquo|lsquo|#39|apos);/gi, "'")
    .replace(/&(rdquo|ldquo|quot);/gi, '"')
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

interface HeaderInfo {
  loadingPort: string;
  dischargePort: string;
  distance: number | null;
  durationDays: number | null;
}

function projectRow(
  d: Record<string, unknown>,
  headers: Map<string, HeaderInfo>
): FreightRow | null {
  const headerRecId = recKey(d.mserp_headerrecid ?? d.mserp_headerrecid_bigint);
  const h = headers.get(headerRecId);
  // Orphan detail line — its header (the only source of route ports) is
  // missing from the header entity. ~4% of rows on the Tiryaki tenant.
  // A freight rate with no route isn't placeable in a route-based list,
  // so we drop it; the caller logs the count (not a silent cap).
  if (!h) return null;
  return {
    detailRecId: recKey(
      d.mserp_detailrecid ??
        d.mserp_detailrecid_bigint ??
        d.mserp_tryaifreightpricedetailentityid
    ),
    headerRecId,
    lineNumber: num(d.mserp_linenumber),

    loadingPort: h.loadingPort || "—",
    dischargePort: h.dischargePort || "—",
    distance: h.distance,
    durationDays: h.durationDays,

    vesselType: str(d.mserp_vesseltypename),
    shipSizeCategory: str(d.mserp_shipsizecategory),
    cargoGood: str(d.mserp_cargogoodname),
    freightCargoType: str(d.mserp_freightcargotype),
    packageType: str(d.mserp_tryshipoperationpackagetype),

    freightPrice: num(d.mserp_freightprice),
    maxFreightPrice: num(d.mserp_maxfreightprice),
    currency: str(d.mserp_currencycode) || "USD",

    validityStart: isoOrNull(d.mserp_validitystartdate),
    validityFinish: isoOrNull(d.mserp_validityfinishdate),
    laycanFrom: isoOrNull(d.mserp_laycanfrom),
    laycanTo: isoOrNull(d.mserp_laycanto),

    minTonnage: num(d.mserp_mintonage),
    maxTonnage: num(d.mserp_maxtonage),

    loadingRate: str(d.mserp_loadingratestr),
    loadingRateTerm: str(d.mserp_loadingrateterm),
    dischargeRate: str(d.mserp_dischargeratestr),
    dischargeRateTerm: str(d.mserp_dischargerateterm),
    stowageFactor: num(d.mserp_stowagefactor),

    loadingPartyName: str(d.mserp_loadingpartyname),
    dischargePartyName: str(d.mserp_dischargingpartyname),
    notes: stripHtml(d.mserp_notes),
  };
}

/**
 * Fetch both entities tenant-wide and join into `FreightRow[]`.
 *
 * Two `listAll` sweeps (headers small, details paginated) + an in-memory
 * join. No project scoping — freight prices are reference data spanning all
 * routes. `onProgress` fires per page so the UI can narrate.
 */
export async function fetchFreightPriceRows(
  client: DataverseClient,
  onProgress?: (p: FreightFetchProgress) => void
): Promise<FreightRow[]> {
  // 1 — headers (one row per route; small). Build recId → ports map.
  const headerRes = await client.listAll<Record<string, unknown>>(
    FREIGHT_HEADER_ENTITY,
    { $select: FREIGHT_HEADER_COLUMNS.join(",") },
    (loaded) => onProgress?.({ stage: "headers", loaded })
  );
  const headers = new Map<string, HeaderInfo>();
  for (const row of headerRes.value) {
    const recId = recKey(row.mserp_headerrecid ?? row.mserp_headerrecid_bigint);
    if (!recId) continue;
    headers.set(recId, {
      loadingPort: str(row.mserp_loadingportnew),
      dischargePort: str(row.mserp_dischargingportnew),
      distance: num(row.mserp_distance),
      durationDays: num(row.mserp_durationdays),
    });
  }

  // 2 — details (price lines; paginated). Project + enrich with route.
  const detailRes = await client.listAll<Record<string, unknown>>(
    FREIGHT_DETAIL_ENTITY,
    { $select: FREIGHT_DETAIL_COLUMNS.join(",") },
    (loaded) => onProgress?.({ stage: "details", loaded })
  );

  // 3 — join (instant). Drop orphan lines (no matching header) and report
  // the count rather than silently swallowing them.
  const rows: FreightRow[] = [];
  let dropped = 0;
  for (const d of detailRes.value) {
    const row = projectRow(d, headers);
    if (row) rows.push(row);
    else dropped += 1;
  }
  if (dropped > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[freightPrices] ${dropped} detay satırı atlandı — eşleşen header (rota) bulunamadı.`
    );
  }
  onProgress?.({ stage: "join", loaded: rows.length });
  return rows;
}
