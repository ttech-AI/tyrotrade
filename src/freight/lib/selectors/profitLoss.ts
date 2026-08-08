import type { Project } from "@/freight/lib/dataverse/entities";
import { selectEstimateTotal } from "./project";

/**
 * Per-project P&L selectors.
 *
 * Lifted from `src/components/details/ProfitLossCard.tsx` so the same math
 * powers both the right-rail card and the dashboard executive tiles. Pure
 * functions, no React, no hooks — read-only over the existing `Project`
 * shape.
 *
 * Currency caveat:
 *   `selectSalesTotal` and `selectPurchaseTotal` are evaluated in the
 *   project line's native currency (typically USD or EUR; see
 *   `lines[i].currency`). `selectExpenseTotal` is always USD (Dataverse
 *   normalises `mserp_expamountusdd` to USD per ton). Combining sales and
 *   expense across projects with different sales currencies is therefore
 *   only valid when projects share USD pricing — dashboard aggregators
 *   must filter by `lines[0].currency === "USD"` for the global rollup or
 *   accept the USD-only subset as the "global" P&L (the safer default).
 */

export interface ProjectPL {
  /** Sum of (quantityKg / 1000) × unitPrice across all lines (sales side). */
  salesTotal: number;
  /** Sum of (quantityKg / 1000) × purchasePrice across all lines (procurement). */
  purchaseTotal: number;
  /** Sum of costEstimate totalUsd (always USD). */
  expenseTotal: number;
  /** salesTotal − purchaseTotal − expenseTotal (in line currency / mixed). */
  pl: number;
  /** pl / salesTotal × 100; null when salesTotal ≤ 0 (no margin reference). */
  marginPct: number | null;
  /** Currency code of the sales side — usually USD or EUR. Undefined when
   *  there are no priced lines (rare). Carried so consumers can decide
   *  whether to roll-up or quarantine the project. */
  currency: string | undefined;
}

/** Sales side per project (lines × unit price). Currency-native. */
export function selectSalesTotal(p: Pick<Project, "lines">): number {
  let total = 0;
  for (const l of p.lines) {
    if (l.unitPrice > 0 && l.quantityKg > 0) {
      total += (l.quantityKg / 1000) * l.unitPrice;
    }
  }
  return total;
}

/** Purchase side per project (lines × purchase price). Currency-native. */
export function selectPurchaseTotal(p: Pick<Project, "lines">): number {
  let total = 0;
  for (const l of p.lines) {
    const pp = l.purchasePrice ?? 0;
    if (pp > 0 && l.quantityKg > 0) {
      total += (l.quantityKg / 1000) * pp;
    }
  }
  return total;
}

/** Expense side per project (cost estimate total). USD. */
export function selectExpenseTotal(
  p: Pick<Project, "costEstimate">
): number {
  return selectEstimateTotal(p);
}

/** Full P&L bundle — call once per project and reuse fields. */
export function selectProjectPL(
  p: Pick<Project, "lines" | "costEstimate" | "currency">
): ProjectPL {
  const salesTotal = selectSalesTotal(p);
  const purchaseTotal = selectPurchaseTotal(p);
  const expenseTotal = selectExpenseTotal(p);
  const pl = salesTotal - purchaseTotal - expenseTotal;
  const marginPct = salesTotal > 0 ? (pl / salesTotal) * 100 : null;
  const currency = p.lines[0]?.currency ?? p.currency ?? undefined;
  return { salesTotal, purchaseTotal, expenseTotal, pl, marginPct, currency };
}
