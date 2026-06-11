import * as React from "react";
import { getDataverseClient } from "@/lib/dataverse";
import { EXPENSE_LINE_COLUMNS } from "@/lib/dataverse/columnOrder";
import {
  CACHE_UPDATED_EVENT,
  type CacheUpdatedDetail,
} from "@/lib/storage/entityCache";
// ⚠️ GEÇİCİ — Sunrise TR hardcoded gerçekleşen gider (entity gelince bu
// import + runExpenseChain başındaki blok + modül dosyası SİLİNECEK).
import {
  buildSunriseTrOverrideRow,
  getSunriseTrRealizedOverride,
} from "@/lib/dataverse/sunriseTrOverrides";

/** Inventory-dimension entity — maps a project number (carried in
 *  `mserp_inventdimension2`) to the set of `mserp_inventdimid` keys
 *  that the distribution lines are stamped with. The distribution
 *  entity has no `mserp_etgtryprojid` we can rely on; the project
 *  link goes through this dim table. */
const INVENTDIMB_ENTITY = "mserp_inventdimbientities";

/** Distribution-line entity — used purely as a "is this expense
 *  linked to this project?" filter via `mserp_inventdimid`. Its own
 *  column data isn't shown anywhere; we only read `mserp_expensenum`
 *  from each row to drive the final lookup against the authoritative
 *  entity. */
const DIST_ENTITY = "mserp_tryaifrtexpenselinedistlineentities";

/** Authoritative expense-line entity carrying the correct amounts
 *  and descriptions. Joined to the distribution entity via
 *  `mserp_expensenum`. */
const EXPENSE_ENTITY = "mserp_tryaiexpenselineentities";

/** Expense HEADER entity — one row per `mserp_expensenum` carrying
 *  the row's currency + USD exchange rate + account type. Three
 *  things the LINE entity DOESN'T expose:
 *    - `mserp_currencycode`     — line currency (drives FX conversion)
 *    - `mserp_exchratesecond`   — USD exchange rate at txn date
 *    - `mserp_accounttype`      — Vendor (200000003), Customer
 *                                  (200000001 → reflection), or
 *                                  General accounting (200000000)
 *  Without the FX context non-USD entries silently inflate the
 *  USD sum. Without the account-type context "reflection" vouchers
 *  (TYRO billing the customer to recover a vendor cost) get
 *  double-counted on the realised side — same expenseid shows up
 *  twice with the same positive amount instead of netting to zero.
 *  We fetch headers in parallel chunks once we have the expensenum
 *  set and build a `expensenum → { currency, rate, accountType }`
 *  map. */
const EXPENSE_TABLE_ENTITY = "mserp_tryaiexpensetableentities";

/** F&O `mserp_accounttype` option-set values seen on expense
 *  table headers. Vendor entries are real cost we incurred;
 *  Customer entries are reflection vouchers (we billed the
 *  customer to recover the cost) so they NET the Vendor side
 *  out — same expensenum appears with both flavours. General
 *  accounting entries are manual journals we can't classify
 *  automatically. */
const ACCOUNT_TYPE_VENDOR = 200000003;
const ACCOUNT_TYPE_CUSTOMER = 200000001;

/** F&O `mserp_expenseid` codes excluded from realised operational
 *  P&L. The enrichment step drops any expense line whose code
 *  matches one of these. Names alongside each code document what
 *  the label looked like when the entry was added — the lookup
 *  itself is strictly numeric, so a label rename in F&O won't
 *  re-admit the row.
 *
 *  Excluded set — pass-through TAXES / treasury transfers only. The
 *  price-difference codes 710017 (FIYAT FARKLARI) and 710041 (SATIS
 *  FIYAT FARKLARI) used to be here, but Power BI counts them in
 *  realised expense (verified on PRJ000002000), so they were removed —
 *  their direction is now handled by the Vendor/Customer × isReturned
 *  sign below, not by exclusion:
 *    - "730030" — ITHALAT BULK KDV (vergi)
 *    - "731016" — ITHALAT - DAMGA VERGISI (vergi)
 *    - "790051" — ITHALAT - HAZINE FIYAT FARKI (hazine transferi)
 *    - "790052" — IHRACAT - HAZINE FIYAT FARKI (hazine transferi)
 *
 *  Extend this set as new pass-through / tax codes surface; the same
 *  constant lives in `actualExpenseRollup.ts` so the per-project
 *  drill-down and the Trade Cost aggregate stay in sync. */
const EXCLUDED_EXPENSE_IDS = new Set<string>([
  "730030",
  "731016",
  "790051",
  "790052",
]);

/** Reference-map entity — per project, carries
 *  `(mserp_tryexpensetype, mserp_refexpenseid)` pairs that translate
 *  the numeric `mserp_expenseid` values surfaced on the realised
 *  expense-line entity (e.g. `730026`, `710041`) into the textual
 *  label used on the forecast side (e.g. `OPEX`, `FREIGHT`,
 *  `İTHALAT BULK - NAVLUN`). Without this lookup the forecast and
 *  realised expense rows are impossible to reconcile by class.
 *  Filtered per project so the map stays small. */
const EXPENSE_REFMAP_ENTITY = "mserp_tryaiotherexpenseprojectlineentities";

/** Same chunk size as the global IN filter helpers — keeps each
 *  request URL safely under proxy/CDN limits. Used for both the
 *  inventdimid → distribution lookup and the expensenum → expense
 *  lookup. */
const IN_CHUNK_SIZE = 50;

/** F&O `mserp_posted` → tri-state. It's a NoYes OPTION-SET (not a
 *  boolean): No = 200000000 (draft / not posted), Yes = 200000001
 *  (posted to ledger). We also accept the `@FormattedValue` annotation
 *  ("Evet"/"Hayır" or "Yes"/"No") and boolean / 1 / 0 fallbacks.
 *  Returns true / false when unambiguous, null when missing/unknown.
 *  Callers drop ONLY an explicit `false` (a draft); null never drops —
 *  so a schema/parse hiccup can't silently zero realised expense. */
function parsePosted(raw: unknown, formatted?: unknown): boolean | null {
  // Prefer the human-readable @FormattedValue when present.
  const f = String(formatted ?? "")
    .trim()
    .toLowerCase();
  if (f === "yes" || f === "evet") return true;
  if (f === "no" || f === "hayır" || f === "hayir") return false;
  // Raw: NoYes option-set codes + boolean / numeric / string fallbacks.
  if (raw === true || raw === 1 || raw === "1" || raw === 200000001)
    return true;
  if (raw === false || raw === 0 || raw === "0" || raw === 200000000)
    return false;
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (s === "yes" || s === "evet" || s === "true" || s === "200000001")
    return true;
  if (
    s === "no" ||
    s === "hayır" ||
    s === "hayir" ||
    s === "false" ||
    s === "200000000"
  )
    return false;
  return null;
}

/** F&O `mserp_isreturned` (header) → boolean. NoYes OPTION-SET: Yes =
 *  200000001 (returned), No = 200000000. A "returned" line FLIPS the
 *  Vendor/Customer sign — a returned Vendor cost reduces realised (−),
 *  a returned Customer reflection adds back (+). Anything that isn't an
 *  explicit Yes is treated as not-returned (false), so a missing value
 *  defaults to the normal Vendor+/Customer− direction. Verified against
 *  Power BI on PRJ000002000 (total reconciled to the cent). */
function isReturnedYes(raw: unknown, formatted?: unknown): boolean {
  const f = String(formatted ?? "")
    .trim()
    .toLowerCase();
  if (f === "yes" || f === "evet") return true;
  if (f === "no" || f === "hayır" || f === "hayir") return false;
  return raw === true || raw === 1 || raw === "1" || raw === 200000001;
}

/* ─────────── Per-project in-memory LRU cache ───────────
 *
 * The realised-expense chain is 3 sequential network phases
 * (inventdimid → dist → expense-line), ~2-5 s per project on the
 * enterprise proxy. Selecting a project you've already opened this
 * session shouldn't pay that again, so the enriched result is memoised
 * by projectNo — revisits are instant (no network). Bounded LRU so a
 * long Thursday review session doesn't grow memory unbounded.
 *
 * Invalidation: a full "Verileri Güncelle" rewrites the projects master
 * cache (`mserp_etgtryprojecttableentities`). That's the one entitySet a
 * refresh touches but ordinary project navigation never does (the
 * per-project estimate / invoice / purchase hooks write their OWN keys).
 * On that signal the whole cache is dropped so realised totals can't go
 * stale after the user re-pulls data. */
const PROJECTS_MASTER_ENTITY = "mserp_etgtryprojecttableentities";
const MAX_CACHE_ENTRIES = 60;

interface CachedExpenseResult {
  rows: Record<string, unknown>[];
  fetchedAt: string;
}

const expenseLineCache = new Map<string, CachedExpenseResult>();

function cacheGet(projectNo: string): CachedExpenseResult | undefined {
  const hit = expenseLineCache.get(projectNo);
  if (hit) {
    // LRU touch — move to the most-recently-used end.
    expenseLineCache.delete(projectNo);
    expenseLineCache.set(projectNo, hit);
  }
  return hit;
}

function cacheSet(projectNo: string, entry: CachedExpenseResult): void {
  expenseLineCache.delete(projectNo);
  expenseLineCache.set(projectNo, entry);
  while (expenseLineCache.size > MAX_CACHE_ENTRIES) {
    const oldest = expenseLineCache.keys().next().value;
    if (oldest === undefined) break;
    expenseLineCache.delete(oldest);
  }
}

if (typeof window !== "undefined") {
  // Same-tab full refresh — drop everything (realised data re-pulled).
  window.addEventListener(CACHE_UPDATED_EVENT, (e) => {
    const detail = (e as CustomEvent<CacheUpdatedDetail>).detail;
    if (detail?.entitySet === PROJECTS_MASTER_ENTITY) expenseLineCache.clear();
  });
  // Cross-tab full refresh.
  window.addEventListener("storage", (e) => {
    if (e.key === `tyro:dv:${PROJECTS_MASTER_ENTITY}`) expenseLineCache.clear();
  });
}

/* ─────────── Shared fetch (hook + hover prefetch) ─────────── */

/** Runs the full 3-phase realised-expense chain for one project, writes
 *  the enriched result into `expenseLineCache`, and returns it. Runs to
 *  completion (no per-await cancellation) — both the hook and hover
 *  prefetch call it, and a finished run is always worth caching even if
 *  the user navigated away mid-flight. See the hook JSDoc below for the
 *  step-by-step description of the chain. */
async function runExpenseChain(
  projectNo: string
): Promise<Record<string, unknown>[]> {
  // ⚠️ GEÇİCİ — Sunrise TR override: listedeki projeler için zincir HİÇ
  // koşmaz, kullanıcı tarafından verilen sabit USD tek sentetik kalem
  // olarak döner (Gider Karşılaştırması + Gerçekleşen K&Z + detay paneli
  // hepsi bunu tüketir). Entity gelince bu blok silinecek.
  const sunriseOverride = getSunriseTrRealizedOverride(projectNo);
  if (sunriseOverride != null) {
    // eslint-disable-next-line no-console
    console.info(
      `[useProjectExpenseLines] ${projectNo}: Sunrise TR GEÇİCİ override aktif — gerçekleşen gider sabit $${sunriseOverride} (entity bekleniyor).`
    );
    const rows = [buildSunriseTrOverrideRow(projectNo, sunriseOverride)];
    cacheSet(projectNo, { rows, fetchedAt: new Date().toISOString() });
    return rows;
  }

  const client = getDataverseClient();

  // Step 0 / R / P in parallel.
  const [dimSettled, refMapSettled, projNumSettled] = await Promise.allSettled([
    client.listAll<Record<string, unknown>>(INVENTDIMB_ENTITY, {
      $filter: `mserp_inventdimension2 eq '${projectNo}'`,
      $select: "mserp_inventdimid",
    }),
    client.listAll<Record<string, unknown>>(EXPENSE_REFMAP_ENTITY, {
      $filter: `mserp_etgtryprojid eq '${projectNo}'`,
      $select: "mserp_tryexpensetype,mserp_refexpenseid",
    }),
    client.listAll<Record<string, unknown>>(EXPENSE_ENTITY, {
      $filter: `mserp_projectnum eq '${projectNo}'`,
      $select: "mserp_expensenum",
    }),
  ]);

  // Step 0 is required — bail if it failed.
  if (dimSettled.status === "rejected") throw dimSettled.reason;
  const dimResult = dimSettled.value;

  // Step P expensenums (best-effort).
  const projNumExpensenums: string[] = [];
  if (projNumSettled.status === "fulfilled") {
    for (const r of projNumSettled.value.value) {
      const n = String(r.mserp_expensenum ?? "").trim();
      if (n) projNumExpensenums.push(n);
    }
  } else {
    // eslint-disable-next-line no-console
    console.warn(
      `[useProjectExpenseLines] projectnum-direct fetch failed for ${projectNo} — using inventdimid chain only:`,
      projNumSettled.reason
    );
  }

  // Step R is best-effort.
  const refMap = new Map<string, string>();
  if (refMapSettled.status === "fulfilled") {
    for (const r of refMapSettled.value.value) {
      const k = String(r.mserp_tryexpensetype ?? "").trim();
      const v = String(r.mserp_refexpenseid ?? "").trim();
      if (k && v && !refMap.has(k)) refMap.set(k, v);
    }
  } else {
    // eslint-disable-next-line no-console
    console.warn(
      `[useProjectExpenseLines] refmap fetch failed for ${projectNo} — proceeding without expense-class labels:`,
      refMapSettled.reason
    );
  }

  const inventDimIds = [
    ...new Set(
      dimResult.value
        .map((r) => String(r.mserp_inventdimid ?? "").trim())
        .filter((s): s is string => s.length > 0)
    ),
  ];

  // Step 1: dist rows for those inventdimids → expensenums (chunked IN).
  const distExpensenums: string[] = [];
  for (let i = 0; i < inventDimIds.length; i += IN_CHUNK_SIZE) {
    const chunk = inventDimIds.slice(i, i + IN_CHUNK_SIZE);
    const inFilter = `Microsoft.Dynamics.CRM.In(PropertyName='mserp_inventdimid',PropertyValues=[${chunk
      .map((id) => `'${id}'`)
      .join(",")}])`;
    const distResult = await client.listAll<Record<string, unknown>>(
      DIST_ENTITY,
      { $filter: inFilter, $select: "mserp_expensenum" }
    );
    for (const r of distResult.value) {
      const n = String(r.mserp_expensenum ?? "").trim();
      if (n) distExpensenums.push(n);
    }
  }

  // Inventdimid-derived = project-dimensioned → trusted. Projectnum-only
  // expensenums get the dimension cross-check in the loop below.
  const distSet = new Set(distExpensenums);
  const expensenums = [...new Set([...distExpensenums, ...projNumExpensenums])];

  if (expensenums.length === 0) {
    cacheSet(projectNo, { rows: [], fetchedAt: new Date().toISOString() });
    return [];
  }

  // Step 2 + 2b in parallel: line rows + header rows.
  const linePromises: Promise<{ value: Record<string, unknown>[] }>[] = [];
  const headerPromises: Promise<{ value: Record<string, unknown>[] }>[] = [];
  for (let i = 0; i < expensenums.length; i += IN_CHUNK_SIZE) {
    const chunk = expensenums.slice(i, i + IN_CHUNK_SIZE);
    const inFilter = `Microsoft.Dynamics.CRM.In(PropertyName='mserp_expensenum',PropertyValues=[${chunk
      .map((n) => `'${n}'`)
      .join(",")}])`;
    linePromises.push(
      client.listAll<Record<string, unknown>>(EXPENSE_ENTITY, {
        $filter: inFilter,
        $select: EXPENSE_LINE_COLUMNS.join(","),
        $count: true,
      })
    );
    headerPromises.push(
      client.listAll<Record<string, unknown>>(EXPENSE_TABLE_ENTITY, {
        $filter: inFilter,
        $select:
          "mserp_expensenum,mserp_currencycode,mserp_exchratesecond,mserp_accounttype,mserp_posted,mserp_isreturned",
      })
    );
  }
  const [lineSettled, headerSettled] = await Promise.all([
    Promise.all(linePromises),
    Promise.allSettled(headerPromises),
  ]);

  const all: Record<string, unknown>[] = [];
  for (const r of lineSettled) all.push(...r.value);

  // Build expensenum → { currency, rate, accountType, posted } map.
  const headerByExpensenum = new Map<
    string,
    {
      currency: string;
      rate: number;
      accountType: number | null;
      posted: boolean | null;
      isReturned: boolean;
    }
  >();
  for (const settled of headerSettled) {
    if (settled.status !== "fulfilled") continue;
    for (const h of settled.value.value) {
      const num = String(h.mserp_expensenum ?? "").trim();
      const cur = String(h.mserp_currencycode ?? "").trim().toUpperCase();
      const rate = Number(h.mserp_exchratesecond);
      const at = Number(h.mserp_accounttype);
      if (!num) continue;
      headerByExpensenum.set(num, {
        currency: cur || "USD",
        rate: Number.isFinite(rate) ? rate : 1,
        accountType: Number.isFinite(at) ? at : null,
        posted: parsePosted(
          h.mserp_posted,
          h["mserp_posted@OData.Community.Display.V1.FormattedValue"]
        ),
        isReturned: isReturnedYes(
          h.mserp_isreturned,
          h["mserp_isreturned@OData.Community.Display.V1.FormattedValue"]
        ),
      });
    }
  }
  const headerFailureCount = headerSettled.filter(
    (s) => s.status === "rejected"
  ).length;
  if (headerFailureCount > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[useProjectExpenseLines] expense-table header fetch failed for ${headerFailureCount}/${headerSettled.length} chunks of ${projectNo} — lines in those chunks will be dropped (no way to confirm accounttype / FX rate).`
    );
  }

  // Enrichment (exclusion → foreign-projectnum → dim cross-check →
  // posted → sign-flip → FX). See inline comments for each gate.
  const enriched: Record<string, unknown>[] = [];
  let droppedExcludedCount = 0;
  let droppedNoHeaderCount = 0;
  let droppedUnknownAccountTypeCount = 0;
  let droppedForeignProjectCount = 0;
  let droppedDraftCount = 0;
  let droppedDimMismatchCount = 0;
  for (const r of all) {
    const code = String(r.mserp_expenseid ?? "").trim();
    if (code && EXCLUDED_EXPENSE_IDS.has(code)) {
      droppedExcludedCount += 1;
      continue;
    }
    // Foreign-projectnum guard.
    const linePid = String(r.mserp_projectnum ?? "").trim();
    if (linePid && linePid !== projectNo) {
      droppedForeignProjectCount += 1;
      continue;
    }
    const expensenum = String(r.mserp_expensenum ?? "").trim();
    // Final dimension cross-check — projectnum-ONLY lines only.
    if (expensenum && !distSet.has(expensenum)) {
      const ddv = String(r.mserp_defaultdimensiondisplayvalue ?? "");
      if (!ddv.includes(projectNo)) {
        droppedDimMismatchCount += 1;
        continue;
      }
    }
    const header = expensenum ? headerByExpensenum.get(expensenum) : undefined;
    if (!header) {
      droppedNoHeaderCount += 1;
      continue;
    }
    // Posted-only.
    if (header.posted === false) {
      droppedDraftCount += 1;
      continue;
    }
    const base =
      header.accountType === ACCOUNT_TYPE_VENDOR
        ? +1
        : header.accountType === ACCOUNT_TYPE_CUSTOMER
          ? -1
          : 0;
    if (base === 0) {
      droppedUnknownAccountTypeCount += 1;
      continue;
    }
    // isReturned flips the Vendor/Customer base sign: a returned Vendor
    // cost reduces realised (−), a returned Customer reflection adds
    // back (+). Matches Power BI (verified on PRJ000002000).
    const sign = header.isReturned ? -base : base;

    const out: Record<string, unknown> = { ...r };
    const ref = code ? refMap.get(code) : undefined;
    if (ref) out.mserp_refexpenseid = ref;

    const amount = Number(r.mserp_amountcur);
    if (Number.isFinite(amount)) {
      const usd = header.currency === "USD" ? amount : amount * header.rate;
      out.mserp_amountcur_usd = sign * usd;
      out.mserp_currencycode = header.currency;
      out.mserp_exchratesecond = header.rate;
      out.mserp_accounttype = header.accountType;
    }
    enriched.push(out);
  }
  const droppedTotal =
    droppedExcludedCount +
    droppedNoHeaderCount +
    droppedUnknownAccountTypeCount +
    droppedForeignProjectCount +
    droppedDraftCount +
    droppedDimMismatchCount;
  if (droppedTotal > 0) {
    // eslint-disable-next-line no-console
    console.info(
      `[useProjectExpenseLines] ${projectNo}: kept ${enriched.length}/${all.length} lines (dropped ${droppedExcludedCount} excluded-id, ${droppedNoHeaderCount} no-header, ${droppedUnknownAccountTypeCount} unknown-accounttype, ${droppedForeignProjectCount} foreign-projectnum, ${droppedDraftCount} draft, ${droppedDimMismatchCount} dim-mismatch).`
    );
  }

  cacheSet(projectNo, { rows: enriched, fetchedAt: new Date().toISOString() });
  return enriched;
}

/** In-flight dedup — hover prefetch + the hook's own fetch share ONE
 *  promise per projectNo, so a hover-then-click never double-fetches. */
const inFlight = new Map<string, Promise<Record<string, unknown>[]>>();

function fetchExpenseLines(
  projectNo: string
): Promise<Record<string, unknown>[]> {
  const cached = cacheGet(projectNo);
  if (cached) return Promise.resolve(cached.rows);
  const running = inFlight.get(projectNo);
  if (running) return running;
  const p = runExpenseChain(projectNo);
  inFlight.set(projectNo, p);
  // Free the slot on settle (success caches; failure lets a retry run).
  p.then(
    () => inFlight.delete(projectNo),
    () => inFlight.delete(projectNo)
  );
  return p;
}

/**
 * 🔒 Read-only — warm the realised-expense cache for a project WITHOUT
 * mounting the hook. Call on hover (with a small intent delay) so the
 * ~2-5 s chain is already done — or in flight — by the time the user
 * clicks. Fire-and-forget; errors are swallowed (a failed prefetch just
 * means the click pays the normal fetch). No-op when already cached or
 * in flight.
 */
export function prefetchProjectExpenseLines(
  projectNo: string | null | undefined
): void {
  if (!projectNo) return;
  if (cacheGet(projectNo) || inFlight.has(projectNo)) return;
  void fetchExpenseLines(projectNo).catch(() => {
    /* best-effort cache warm */
  });
}

export interface UseProjectExpenseLinesReturn {
  /** Authoritative expense-line rows for the current project. */
  rows: Record<string, unknown>[];
  /** True while ANY of the three async steps is in flight. */
  isFetching: boolean;
  /** ISO timestamp of the most recent successful chain completion. */
  fetchedAt: string | null;
  /** Last error message, when the chain failed. */
  error: string | null;
}

/**
 * 🔒 Read-only — fetch realised-expense LINES for one project via a
 * chain of three sequential steps + one parallel reference-map step:
 *
 *   0. List inventory-dimension rows from `mserp_inventdimbientities`
 *      filtered by `mserp_inventdimension2 eq '<projectNo>'`. Pull
 *      only `mserp_inventdimid`. This step exists because the
 *      distribution entity (Step 1) is not directly indexed by
 *      project number — the project link lives in the inventdim
 *      table.
 *   R. (PARALLEL to Step 0) List rows from
 *      `mserp_tryaiotherexpenseprojectlineentities` filtered by
 *      `mserp_etgtryprojid eq '<projectNo>'`. Build a
 *      `mserp_tryexpensetype → mserp_refexpenseid` map. This is
 *      best-effort: failure here just leaves enriched rows without
 *      the textual class label, the rest of the chain proceeds.
 *   1. De-duplicate the inventdimids, then list distribution rows
 *      from `mserp_tryaifrtexpenselinedistlineentities` using a
 *      chunked `In(mserp_inventdimid, …)` filter. Pull only
 *      `mserp_expensenum`.
 *   2. De-duplicate the expense numbers, then fetch the matching
 *      rows from `mserp_tryaiexpenselineentities` using a chunked
 *      `In(mserp_expensenum, …)` filter so the URL stays under
 *      proxy limits even when a project touches hundreds of expense
 *      vouchers.
 *   2b. (PARALLEL to Step 2) Fetch the expense HEADER rows from
 *       `mserp_tryaiexpensetableentities` for the same expensenum
 *       chunks. Header carries `mserp_currencycode`,
 *       `mserp_exchratesecond` (USD exchange rate at the txn
 *       date), and `mserp_accounttype` (Vendor / Customer /
 *       General accounting). Build a
 *       `expensenum → { currency, rate, accountType }` map.
 *   3. Enrich each Step-2 row by setting `mserp_refexpenseid` from
 *      Step-R's map keyed on the row's `mserp_expenseid`, AND
 *      attaching a derived `mserp_amountcur_usd` field. The value
 *      is signed:
 *        - Vendor header   → +amount (real cost, adds to total)
 *        - Customer header → −amount (reflection, subtracts)
 *        - else            → line is dropped entirely
 *      Amount itself is FX-converted via `mserp_exchratesecond`
 *      when the row's currency isn't USD. Lines whose
 *      `mserp_expenseid` is in `EXCLUDED_EXPENSE_IDS` (tax /
 *      pass-through / FX-adjustment codes — see the constant for
 *      the full list with their human-readable labels) are
 *      filtered out before the sign step. Consumers
 *      should sum `mserp_amountcur_usd` for USD totals; the
 *      original `mserp_amountcur` is preserved for the raw
 *      inspector view.
 *
 * Returns the enriched step-2 rows. The inventdimb + distribution +
 * refmap entities act as filter / lookup intermediaries only — their
 * raw rows aren't surfaced anywhere.
 *
 * Results are memoised in a bounded per-project in-memory LRU cache
 * (see the cache block above): the first visit pays the ~2-5 s chain,
 * any revisit this session is instant with no network. The cache is
 * dropped wholesale when a full data refresh rewrites the projects
 * master cache, so realised totals never go stale.
 */
export function useProjectExpenseLines(
  projectNo: string | null | undefined
): UseProjectExpenseLinesReturn {
  const [rows, setRows] = React.useState<Record<string, unknown>[]>([]);
  const [isFetching, setIsFetching] = React.useState(false);
  const [fetchedAt, setFetchedAt] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!projectNo) {
      setRows([]);
      setError(null);
      return;
    }
    // Cache hit → instant, skip the whole 3-phase chain.
    const cached = cacheGet(projectNo);
    if (cached) {
      setRows(cached.rows);
      setFetchedAt(cached.fetchedAt);
      setError(null);
      setIsFetching(false);
      return;
    }
    let cancelled = false;
    setIsFetching(true);
    setError(null);
    // Delegates to the shared fetcher — if a hover prefetch is already in
    // flight for this project we await the SAME promise instead of firing
    // a second chain. On resolve the result is already in the cache.
    fetchExpenseLines(projectNo)
      .then((resultRows) => {
        if (cancelled) return;
        setRows(resultRows);
        setFetchedAt(
          cacheGet(projectNo)?.fetchedAt ?? new Date().toISOString()
        );
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        // eslint-disable-next-line no-console
        console.warn(
          `[useProjectExpenseLines] fetch failed for ${projectNo}:`,
          err
        );
        setError(message);
      })
      .finally(() => {
        if (!cancelled) setIsFetching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectNo]);

  return {
    rows,
    isFetching,
    fetchedAt,
    error,
  };
}
