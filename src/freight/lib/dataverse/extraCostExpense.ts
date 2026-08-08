import type { DataverseClient } from "./client";

/**
 * 🔒 READ-ONLY — extra-cost (yan masraf) realised-expense source.
 *
 * F&O distributes "extra costs" (freight, insurance, customs, etc.) onto
 * projects through `mserp_tryaietgextracostdistributingentities`. For some
 * projects — notably the Organik book — the realised operational expense
 * lives ENTIRELY here, not in the freight expense-line chain
 * (`useProjectExpenseLines`' inventdimb → dist → expense-line steps). That
 * gap is why those projects used to carry hardcoded realised totals
 * (`sunriseTrOverrides.ts`, now removed). This module replaces the hack with
 * the real rows.
 *
 * Calibration (live, ORGANIK01-133, reconciled to Power BI 349,239.57):
 *   - Project link  = `mserp_trysubprojectid` (the app's sub-project = projectNo).
 *     The main-project dims (`findimproject` / `inventdimension2`) hold
 *     `ORGANIK01` and are huge — don't filter on those.
 *   - Realised USD  = `mserp_distribuitionamountreporting`. The reporting
 *     currency is USD and is ALREADY converted per row, so rows in TRY/EUR
 *     need NO manual FX. Per-row values match Power BI exactly; the raw sum
 *     reconciles to 99.996%. No sign / account-type / exclusion logic is
 *     needed (unlike the freight chain) — Power BI is a straight sum.
 */
export const EXTRACOST_ENTITY = "mserp_tryaietgextracostdistributingentities";

/** Trimmed $select — the entity has 117+ columns; we pull only these. */
const EXTRACOST_COLUMNS = [
  "mserp_trysubprojectid",
  "mserp_extracostentryno",
  "mserp_expensename",
  "mserp_expenseid",
  "mserp_currencycode",
  "mserp_distribuitionamountreporting",
  "mserp_transdate",
] as const;

/**
 * Fetch the extra-cost distribution rows for one sub-project and map each to
 * a synthetic realised-expense row shaped exactly like the enriched rows
 * `runExpenseChain` produces — so the existing consumers (Gider
 * Karşılaştırması card, Gerçekleşen K&Z, detail panel) sum
 * `mserp_amountcur_usd` and group by `mserp_refexpenseid` / `mserp_description`
 * with no changes.
 *
 * The reporting amount is already USD, so `mserp_amountcur_usd` is set
 * directly with no FX / sign math. Best-effort: callers should tolerate a
 * thrown error (e.g. via `Promise.allSettled`) — a failure just means the
 * project shows only its freight-chain realised rows.
 */
export async function fetchExtraCostExpenseRows(
  client: DataverseClient,
  projectNo: string
): Promise<Record<string, unknown>[]> {
  const res = await client.listAll<Record<string, unknown>>(EXTRACOST_ENTITY, {
    $filter: `mserp_trysubprojectid eq '${projectNo}'`,
    $select: EXTRACOST_COLUMNS.join(","),
  });

  const out: Record<string, unknown>[] = [];
  for (const r of res.value) {
    const usd = Number(r.mserp_distribuitionamountreporting);
    if (!Number.isFinite(usd)) continue;
    const name = String(r.mserp_expensename ?? "").trim();
    out.push({
      mserp_expensenum: String(r.mserp_extracostentryno ?? "").trim(),
      mserp_expenseid: String(r.mserp_expenseid ?? "").trim(),
      mserp_description: name,
      // Forecast-side class label — expensename already reads like the
      // forecast class (e.g. "İTHALAT BULK - NAVLUN"), so the comparison
      // card groups it directly.
      mserp_refexpenseid: name,
      mserp_amountcur: usd,
      // The reporting field IS USD; carry it as the signed USD total the
      // consumers sum. Positive (these are costs; PBI is a straight sum).
      mserp_amountcur_usd: usd,
      mserp_currencycode: "USD",
      mserp_datefinancial: r.mserp_transdate ?? null,
      // Source marker — lets the inspector / future logic tell extra-cost
      // rows apart from freight-chain rows.
      mserp_extracost: true,
      mserp_projectnum: projectNo,
    });
  }
  return out;
}
