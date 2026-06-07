/**
 * Tenant-wide aggregation of realised expense lines for the Trade
 * Cost report. Mirrors the per-project chain inside
 * `useProjectExpenseLines` (inventdimb → dist → expense-line + refmap
 * + FX header join) but runs ONCE for all active projects so the
 * report can render 320 projects without firing 320 round-trips.
 *
 * Two normalisations applied during aggregation:
 *
 *   1. **Expense-id exclusion**: lines whose `mserp_expenseid` is
 *      in `EXCLUDED_EXPENSE_IDS` (KDV, Damga Vergisi, the four
 *      fiyat-farkı codes) are dropped. Numeric, not label-based,
 *      so an F&O label rename never re-admits the row.
 *   2. **Account-type sign-flip**: each line's contribution is
 *      signed by its header's `mserp_accounttype`:
 *        Vendor (200000003)   → +amount   (real cost)
 *        Customer (200000001) → −amount   (reflection, billed back)
 *        else                 → line dropped (manual journal)
 *      So Vendor + Customer pairs for the same expensenum (e.g.
 *      CBOT real cost + CBOT reflection fee) net to ~0 — matches
 *      what the F&O native report shows.
 *   3. **FX conversion**: each line's native `mserp_amountcur` is
 *      multiplied by the header's `mserp_exchratesecond` when the
 *      row's currency isn't USD, so non-USD invoices don't inflate
 *      the dollar sum (TRY 1M was previously summed as $1M).
 *
 * Header context comes from a parallel expense-table header fetch
 * (Step 3b below). Strict: lines whose header didn't come back
 * (failed chunk) are dropped — we can't tell Vendor from Customer
 * without it, so treating them as positive would re-admit the
 * reflection-double-counting bug.
 *
 * Output is a flat array keyed by (projectNo, expenseId).
 */

import type { DataverseClient } from "@/lib/dataverse";
import { listAllByInChunked } from "@/lib/dataverse/refreshAll";
import { EXPENSE_LINE_COLUMNS } from "@/lib/dataverse/columnOrder";

/** Realised expense rollup row — one per (projectNo, expenseId). */
export interface ActualExpenseRollupRow {
  /** Project number — join key against the projects cache. */
  projectNo: string;
  /** F&O numeric expense category code (e.g. "712621", "710041"). */
  expenseId: string;
  /** Sample expense voucher number from the contributing rows. */
  expenseNum: string;
  /** Textual class from the per-project refmap (e.g. "OPEX",
   *  "FREIGHT", "İTHALAT BULK - NAVLUN"). null when refmap had no
   *  entry. */
  refExpenseId: string | null;
  /** Sample free-text description from the contributing rows. */
  description: string;
  /** Realised USD total — sum of contributing line amounts
   *  converted to USD via the expense-table header's
   *  `mserp_exchratesecond` when the row's currency isn't USD. */
  totalUsd: number;
  /** Number of underlying expense-line rows aggregated. Helpful for
   *  drill-down: "this rollup row aggregates 4 voucher entries." */
  rowCount: number;
}

/* ─────────── Entity sets used by the chain ─────────── */
const INVENTDIMB_ENTITY = "mserp_inventdimbientities";
const DIST_ENTITY = "mserp_tryaifrtexpenselinedistlineentities";
const EXPENSE_ENTITY = "mserp_tryaiexpenselineentities";
/** Expense HEADER entity — joined to lines by `mserp_expensenum`
 *  for FX context (currency + exchratesecond) + account-type
 *  classification (Vendor vs Customer / reflection). Same pattern
 *  as the per-project chain in `useProjectExpenseLines`. */
const EXPENSE_TABLE_ENTITY = "mserp_tryaiexpensetableentities";

/** F&O `mserp_accounttype` option-set values seen on expense
 *  table headers. Vendor = real cost we incurred; Customer =
 *  reflection voucher (we billed the customer to recover the
 *  cost). General accounting (200000000) is a manual journal we
 *  drop because we can't classify it automatically. Same
 *  constants live in `useProjectExpenseLines` — extend in both
 *  files together if F&O introduces a new option-set value we
 *  need to handle. */
const ACCOUNT_TYPE_VENDOR = 200000003;
const ACCOUNT_TYPE_CUSTOMER = 200000001;
const REFMAP_ENTITY = "mserp_tryaiotherexpenseprojectlineentities";

/** F&O `mserp_expenseid` codes excluded from realised operational
 *  P&L. Same set + names that live in `useProjectExpenseLines.ts`
 *  so the per-project drill-down and the Trade Cost aggregate agree.
 *  Pass-through TAXES / treasury transfers only — the price-difference
 *  codes 710017 / 710041 were removed (Power BI counts them; their
 *  direction is handled by the Vendor/Customer × isReturned sign):
 *    - "730030" — ITHALAT BULK KDV (vergi)
 *    - "731016" — ITHALAT - DAMGA VERGISI (vergi)
 *    - "790051" — ITHALAT - HAZINE FIYAT FARKI (hazine transferi)
 *    - "790052" — IHRACAT - HAZINE FIYAT FARKI (hazine transferi)
 *  Extend in both files together. */
const EXCLUDED_EXPENSE_IDS = new Set<string>([
  "730030",
  "731016",
  "790051",
  "790052",
]);

/** F&O `mserp_posted` → tri-state. NoYes OPTION-SET (not boolean):
 *  No = 200000000 (draft), Yes = 200000001 (posted to ledger). Also
 *  accepts the `@FormattedValue` ("Evet"/"Hayır") + boolean / 1 / 0.
 *  Returns true / false when unambiguous, null when missing/unknown.
 *  Callers drop ONLY explicit `false`; null never drops. Same helper
 *  lives in `useProjectExpenseLines.ts`. */
function parsePosted(raw: unknown, formatted?: unknown): boolean | null {
  const f = String(formatted ?? "")
    .trim()
    .toLowerCase();
  if (f === "yes" || f === "evet") return true;
  if (f === "no" || f === "hayır" || f === "hayir") return false;
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

/** F&O `mserp_isreturned` (header) → boolean. NoYes OPTION-SET (Yes =
 *  200000001 = returned). A returned line FLIPS the Vendor/Customer
 *  sign — returned Vendor cost reduces realised (−), returned Customer
 *  reflection adds back (+). Non-Yes → not returned. Same helper lives
 *  in `useProjectExpenseLines.ts`; verified vs Power BI on PRJ000002000. */
function isReturnedYes(raw: unknown, formatted?: unknown): boolean {
  const f = String(formatted ?? "")
    .trim()
    .toLowerCase();
  if (f === "yes" || f === "evet") return true;
  if (f === "no" || f === "hayır" || f === "hayir") return false;
  return raw === true || raw === 1 || raw === "1" || raw === 200000001;
}

/* ─────────── Progress reporting ─────────── */

/** Logical stage names for the rollup pipeline. UI surfaces these as
 *  step rows — tick / spinner / pending. The order is the actual
 *  execution order (steps 1+R run in parallel). */
export type RollupStage =
  | "inventdimb"
  | "refmap"
  | "dist"
  | "expense-line"
  | "aggregate";

export const ROLLUP_STAGES: RollupStage[] = [
  "inventdimb",
  "refmap",
  "dist",
  "expense-line",
  "aggregate",
];

/** One per stage transition. Caller can use this to drive a
 *  step-by-step progress UI (tyrowms-style). `count` is the natural
 *  unit for each step:
 *   - inventdimb     → distinct inventdimid count
 *   - refmap         → refmap row count (per-project mapping count)
 *   - dist           → distinct expensenum count
 *   - expense-line   → ham realised row count
 *   - aggregate      → final rollup row count
 */
export interface RollupProgress {
  /** The stage that just completed (or just started, when `running`). */
  stage: RollupStage;
  /** Was this a "stage starting" report or a "stage just completed"? */
  status: "running" | "done";
  /** Number of records associated with the just-completed stage. */
  count?: number;
}

export type ProgressCallback = (p: RollupProgress) => void;

/**
 * Tenant-wide pipeline (4 chunked fetches; refmap is parallel with
 * the inventdimb step so the whole thing runs in roughly the time of
 * the longest single stage):
 *
 *   1. inventdimb   — projids × IN(`mserp_inventdimension2`)
 *      → Map<projid, Set<inventdimid>>
 *
 *   R. refmap (paralleled with step 1)
 *      — projids × IN(`mserp_etgtryprojid`)
 *      → Map<projid, Map<expensetype, refexpenseid>>
 *
 *   2. dist         — flat inventdimids × IN(`mserp_inventdimid`)
 *      → Map<inventdimid, Set<expensenum>>
 *
 *   3. expense-line — flat expensenums × IN(`mserp_expensenum`)
 *      → ham gerçekleşen rows
 *
 * Then a single in-memory pass over the expense rows: re-attach each
 * row to every project whose inventdimids resolve to its expensenum,
 * apply the 710041 sign-flip, and roll up by (projid, expenseId).
 *
 * Best-effort failure handling: refmap (R) failure logs a warning
 * and proceeds with `refExpenseId: null`. Steps 1-3 failure throws —
 * the caller (refreshAll step) catches and reports the chain failure.
 */
export async function fetchActualExpenseRollupForAllProjects(
  client: DataverseClient,
  projids: string[],
  onProgress?: ProgressCallback
): Promise<ActualExpenseRollupRow[]> {
  if (projids.length === 0) return [];

  // Mark steps 1 & R as running. They fire in parallel.
  onProgress?.({ stage: "inventdimb", status: "running" });
  onProgress?.({ stage: "refmap", status: "running" });

  // Step 1 + R in parallel.
  const [dimSettled, refMapSettled, projNumSettled] = await Promise.allSettled([
    listAllByInChunked<Record<string, unknown>>(
      client,
      INVENTDIMB_ENTITY,
      "mserp_inventdimension2",
      projids,
      { $select: "mserp_inventdimension2,mserp_inventdimid" }
    ),
    listAllByInChunked<Record<string, unknown>>(
      client,
      REFMAP_ENTITY,
      "mserp_etgtryprojid",
      projids,
      {
        $select: "mserp_etgtryprojid,mserp_tryexpensetype,mserp_refexpenseid",
      }
    ),
    // Step P (parallel): expense lines stamped directly with a project
    // via the `mserp_projectnum` column — catches realised expenses NOT
    // reachable through the inventdimid → distribution chain (voucher /
    // manual costs like "BİNA ONARIM GİDERİ"). Mirrors the per-project
    // hook's Step P so the Trade Cost aggregate and the project drill-
    // down agree. Best-effort: failure logs a warning and the rollup
    // falls back to the inventdimid chain alone.
    listAllByInChunked<Record<string, unknown>>(
      client,
      EXPENSE_ENTITY,
      "mserp_projectnum",
      projids,
      { $select: "mserp_projectnum,mserp_expensenum" }
    ),
  ]);

  if (dimSettled.status === "rejected") throw dimSettled.reason;
  const dimResult = dimSettled.value;

  // Step P → Map<projid, Set<expensenum>> (best-effort). Unioned with
  // the dist-chain expensenums below so projectnum-only expenses join
  // the same header / refmap / exclusion / sign enrichment + rollup.
  const projToProjnumExpenseNums = new Map<string, Set<string>>();
  if (projNumSettled.status === "fulfilled") {
    for (const r of projNumSettled.value.value) {
      const pid = String(r.mserp_projectnum ?? "").trim();
      const en = String(r.mserp_expensenum ?? "").trim();
      if (!pid || !en) continue;
      if (!projToProjnumExpenseNums.has(pid))
        projToProjnumExpenseNums.set(pid, new Set());
      projToProjnumExpenseNums.get(pid)!.add(en);
    }
  } else {
    // eslint-disable-next-line no-console
    console.warn(
      "[actualExpenseRollup] projectnum-direct fetch failed — using inventdimid chain only:",
      projNumSettled.reason
    );
  }

  // Build refmap (best-effort). Map<projid, Map<expensetype, ref>>.
  const projRefMap = new Map<string, Map<string, string>>();
  if (refMapSettled.status === "fulfilled") {
    for (const r of refMapSettled.value.value) {
      const pid = String(r.mserp_etgtryprojid ?? "").trim();
      const type = String(r.mserp_tryexpensetype ?? "").trim();
      const ref = String(r.mserp_refexpenseid ?? "").trim();
      if (!pid || !type || !ref) continue;
      if (!projRefMap.has(pid)) projRefMap.set(pid, new Map());
      projRefMap.get(pid)!.set(type, ref);
    }
  } else {
    // eslint-disable-next-line no-console
    console.warn(
      "[actualExpenseRollup] refmap fetch failed — proceeding without expense-class labels:",
      refMapSettled.reason
    );
  }

  // Map projid → Set<inventdimid>.
  const projToInventDimIds = new Map<string, Set<string>>();
  for (const r of dimResult.value) {
    const pid = String(r.mserp_inventdimension2 ?? "").trim();
    const did = String(r.mserp_inventdimid ?? "").trim();
    if (!pid || !did) continue;
    if (!projToInventDimIds.has(pid)) projToInventDimIds.set(pid, new Set());
    projToInventDimIds.get(pid)!.add(did);
  }

  // Flat distinct inventdimids for the dist fetch.
  const allInventDimIds = Array.from(
    new Set(
      Array.from(projToInventDimIds.values()).flatMap((s) => Array.from(s))
    )
  );

  // Report Step 1 done (even on early return so the UI ticks).
  onProgress?.({
    stage: "inventdimb",
    status: "done",
    count: allInventDimIds.length,
  });
  // Refmap also "done" by now (Promise.allSettled awaited above).
  onProgress?.({
    stage: "refmap",
    status: "done",
    count:
      refMapSettled.status === "fulfilled"
        ? refMapSettled.value.value.length
        : 0,
  });

  // Proceed if EITHER path yielded project links — a project may have
  // only projectnum-direct expenses (no inventdimid at all).
  if (projToInventDimIds.size === 0 && projToProjnumExpenseNums.size === 0)
    return [];

  // Step 2: dist rows → expensenums, keyed by inventdimid.
  onProgress?.({ stage: "dist", status: "running" });
  const distResult = await listAllByInChunked<Record<string, unknown>>(
    client,
    DIST_ENTITY,
    "mserp_inventdimid",
    allInventDimIds,
    { $select: "mserp_inventdimid,mserp_expensenum" }
  );
  const dimToExpenseNums = new Map<string, Set<string>>();
  for (const r of distResult.value) {
    const did = String(r.mserp_inventdimid ?? "").trim();
    const en = String(r.mserp_expensenum ?? "").trim();
    if (!did || !en) continue;
    if (!dimToExpenseNums.has(did)) dimToExpenseNums.set(did, new Set());
    dimToExpenseNums.get(did)!.add(en);
  }

  // Flat distinct expensenums — union of the dist-chain expensenums AND
  // the projectnum-direct expensenums, so Step 3 fetches rows + headers
  // for both sources.
  const allExpenseNums = Array.from(
    new Set([
      ...Array.from(dimToExpenseNums.values()).flatMap((s) => Array.from(s)),
      ...Array.from(projToProjnumExpenseNums.values()).flatMap((s) =>
        Array.from(s)
      ),
    ])
  );

  onProgress?.({
    stage: "dist",
    status: "done",
    count: allExpenseNums.length,
  });

  if (allExpenseNums.length === 0) return [];

  // Step 3: authoritative expense-line rows + expense-table
  // headers in parallel. The header fetch supplies FX context
  // (currency + exchratesecond) AND accounttype (Vendor vs
  // Customer for the reflection sign-flip). Strict: if the
  // entire header fetch fails, every line gets dropped since we
  // can't classify the sign without the header.
  onProgress?.({ stage: "expense-line", status: "running" });
  const [expResult, headerSettled] = await Promise.all([
    listAllByInChunked<Record<string, unknown>>(
      client,
      EXPENSE_ENTITY,
      "mserp_expensenum",
      allExpenseNums,
      { $select: EXPENSE_LINE_COLUMNS.join(",") }
    ),
    listAllByInChunked<Record<string, unknown>>(
      client,
      EXPENSE_TABLE_ENTITY,
      "mserp_expensenum",
      allExpenseNums,
      {
        $select:
          "mserp_expensenum,mserp_currencycode,mserp_exchratesecond,mserp_accounttype,mserp_posted,mserp_isreturned",
      }
    )
      .then((r) => ({ status: "fulfilled" as const, value: r }))
      .catch((reason) => ({ status: "rejected" as const, reason })),
  ]);

  // Build expensenum → { currency, rate, accountType, posted, isReturned }
  // map from header rows. If the whole fetch failed (rare — proxy/5xx),
  // the map stays empty and every line gets dropped since we need
  // accounttype + isReturned to decide the sign.
  const headerByExpenseNum = new Map<
    string,
    {
      currency: string;
      rate: number;
      accountType: number | null;
      posted: boolean | null;
      isReturned: boolean;
    }
  >();
  if (headerSettled.status === "fulfilled") {
    for (const h of headerSettled.value.value) {
      const num = String(h.mserp_expensenum ?? "").trim();
      const cur = String(h.mserp_currencycode ?? "").trim().toUpperCase();
      const rate = Number(h.mserp_exchratesecond);
      const at = Number(h.mserp_accounttype);
      if (!num) continue;
      headerByExpenseNum.set(num, {
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
  } else {
    // eslint-disable-next-line no-console
    console.warn(
      "[actualExpenseRollup] expense-table header fetch failed — all expense lines will be dropped (cannot determine Vendor vs Customer):",
      headerSettled.reason
    );
  }

  onProgress?.({
    stage: "expense-line",
    status: "done",
    count: expResult.value.length,
  });
  onProgress?.({ stage: "aggregate", status: "running" });

  // Index expense-rows by expensenum for the per-project pass.
  // Two line-level gates run here so we only carry rows that
  // actually contribute to the realised sum:
  //
  //   - `mserp_expenseid` ∉ EXCLUDED_EXPENSE_IDS (tax / pass-
  //     through codes never count, regardless of accounttype).
  //   - header for this expensenum exists AND accountType ∈
  //     {Vendor, Customer} (drop General accounting and any line
  //     whose header chunk failed — we can't sign them safely).
  const rowsByExpenseNum = new Map<string, Record<string, unknown>[]>();
  let droppedExcludedCount = 0;
  let droppedNoHeaderCount = 0;
  let droppedUnknownAccountTypeCount = 0;
  let droppedDraftCount = 0;
  for (const r of expResult.value) {
    const en = String(r.mserp_expensenum ?? "").trim();
    if (!en) continue;
    const code = String(r.mserp_expenseid ?? "").trim();
    if (code && EXCLUDED_EXPENSE_IDS.has(code)) {
      droppedExcludedCount += 1;
      continue;
    }
    const header = headerByExpenseNum.get(en);
    if (!header) {
      droppedNoHeaderCount += 1;
      continue;
    }
    // Only ledger-POSTED expenses count; drafts (mserp_posted = No /
    // 200000000) are excluded. Tri-state: only explicit false drops.
    if (header.posted === false) {
      droppedDraftCount += 1;
      continue;
    }
    if (
      header.accountType !== ACCOUNT_TYPE_VENDOR &&
      header.accountType !== ACCOUNT_TYPE_CUSTOMER
    ) {
      droppedUnknownAccountTypeCount += 1;
      continue;
    }
    if (!rowsByExpenseNum.has(en)) rowsByExpenseNum.set(en, []);
    rowsByExpenseNum.get(en)!.push(r);
  }
  const droppedTotal =
    droppedExcludedCount +
    droppedNoHeaderCount +
    droppedUnknownAccountTypeCount +
    droppedDraftCount;
  if (droppedTotal > 0) {
    // eslint-disable-next-line no-console
    console.info(
      `[actualExpenseRollup] kept ${expResult.value.length - droppedTotal}/${expResult.value.length} lines (dropped ${droppedExcludedCount} excluded-id, ${droppedNoHeaderCount} no-header, ${droppedUnknownAccountTypeCount} unknown-accounttype, ${droppedDraftCount} draft).`
    );
  }

  // Aggregate per (projid, expenseId).
  const rollup = new Map<
    string,
    Map<
      string,
      { totalUsd: number; rowCount: number; expenseNum: string; description: string }
    >
  >();
  // Iterate the union of projids with ANY expense link — via the
  // inventdimid chain OR the projectnum-direct path. Projectnum-only
  // projects (no inventdimid) would otherwise be skipped entirely.
  const allLinkedProjids = new Set<string>([
    ...projToInventDimIds.keys(),
    ...projToProjnumExpenseNums.keys(),
  ]);
  // Projectnum-only lines whose dimension string doesn't carry the
  // project (mistagged projectnum) — dropped from realised.
  let droppedDimMismatchCount = 0;
  for (const projid of allLinkedProjids) {
    // Collect this project's expensenum set from BOTH sources, but keep
    // the inventdimid-derived set separate: those expensenums are
    // project-dimensioned (inventdimension2 = this project) → trusted.
    // Expensenums coming ONLY via the projectnum stamp get a final
    // dimension cross-check in the row loop below.
    const projExpenseNums = new Set<string>();
    const dimDerivedEns = new Set<string>();
    const dimIds = projToInventDimIds.get(projid);
    if (dimIds) {
      for (const did of dimIds) {
        const ens = dimToExpenseNums.get(did);
        if (ens) for (const en of ens) dimDerivedEns.add(en);
      }
    }
    for (const en of dimDerivedEns) projExpenseNums.add(en);
    const pnEns = projToProjnumExpenseNums.get(projid);
    if (pnEns) for (const en of pnEns) projExpenseNums.add(en);
    if (projExpenseNums.size === 0) continue;

    if (!rollup.has(projid)) rollup.set(projid, new Map());
    const projMap = rollup.get(projid)!;

    for (const en of projExpenseNums) {
      const expRows = rowsByExpenseNum.get(en);
      if (!expRows) continue;
      // Header is guaranteed present (line indexing gate above
      // only kept rows whose expensenum is in headerByExpenseNum
      // with a Vendor/Customer accountType).
      const header = headerByExpenseNum.get(en)!;
      // Base Vendor(+)/Customer(−), flipped when the line is returned
      // (returned Vendor cost reduces realised, returned Customer
      // reflection adds back). Matches Power BI — verified PRJ000002000.
      const base = header.accountType === ACCOUNT_TYPE_VENDOR ? +1 : -1;
      const sign = header.isReturned ? -base : base;
      // Projectnum-only lines (not reachable via this project's
      // inventdimid chain) get a final dimension cross-check below.
      const projnumOnly = !dimDerivedEns.has(en);
      for (const exr of expRows) {
        // Cross-contamination guard: a line reached via a shared
        // inventdimid / expensenum may belong to a DIFFERENT project —
        // its authoritative `mserp_projectnum` then names that other
        // project. Empty projectnum is fine; a foreign one must not be
        // attributed to THIS project.
        const linePid = String(exr.mserp_projectnum ?? "").trim();
        if (linePid && linePid !== projid) continue;
        // Final dimension cross-check — projectnum-ONLY lines only.
        // A line reached solely via the mserp_projectnum stamp is trusted
        // only if this project number appears in its financial-dimension
        // string. Mistagged projectnum → dimension lacks the project →
        // drop. (Inventdimid-chain lines are project-dimensioned already
        // and skip this check — matches useProjectExpenseLines.)
        if (projnumOnly) {
          const ddv = String(exr.mserp_defaultdimensiondisplayvalue ?? "");
          if (!ddv.includes(projid)) {
            droppedDimMismatchCount += 1;
            continue;
          }
        }
        const expenseId = String(exr.mserp_expenseid ?? "").trim();
        if (!expenseId) continue;
        const description = String(exr.mserp_description ?? "").trim();
        const rawAmount = Number(exr.mserp_amountcur);
        const nativeAmount = Number.isFinite(rawAmount) ? rawAmount : 0;
        // FX conversion: USD stays as-is; non-USD multiplies by
        // the header's exchratesecond (rate is in USD-per-native
        // form — TRY × 0.0750 ≈ USD). Then sign-flip: Vendor +,
        // Customer − so reflection pairs net to zero.
        const baseUsd =
          header.currency === "USD"
            ? nativeAmount
            : nativeAmount * header.rate;
        const amountUsd = sign * baseUsd;

        const existing = projMap.get(expenseId);
        if (existing) {
          existing.totalUsd += amountUsd;
          existing.rowCount += 1;
        } else {
          projMap.set(expenseId, {
            totalUsd: amountUsd,
            rowCount: 1,
            expenseNum: en,
            description,
          });
        }
      }
    }
  }

  if (droppedDimMismatchCount > 0) {
    // eslint-disable-next-line no-console
    console.info(
      `[actualExpenseRollup] dropped ${droppedDimMismatchCount} projectnum-only line(s) failing the dimension cross-check (mistagged projectnum).`
    );
  }

  // Flatten + refmap join.
  const result: ActualExpenseRollupRow[] = [];
  for (const [projectNo, expenseMap] of rollup) {
    const refMap = projRefMap.get(projectNo);
    for (const [expenseId, agg] of expenseMap) {
      result.push({
        projectNo,
        expenseId,
        expenseNum: agg.expenseNum,
        refExpenseId: refMap?.get(expenseId) ?? null,
        description: agg.description,
        totalUsd: agg.totalUsd,
        rowCount: agg.rowCount,
      });
    }
  }
  onProgress?.({
    stage: "aggregate",
    status: "done",
    count: result.length,
  });
  return result;
}
