/**
 * Smart insights generator for the P&L Cost page.
 *
 * Walks the hierarchy and surfaces 3-5 punchy callouts an executive
 * can scan in one breath. Examples:
 *
 *   - "3 proje %120+ gerçekleşme — bütçe aşımı"
 *   - "Iran segmenti tahminin %32 altında"
 *   - "İhracat Bulk Navlun ortalama %18 sapıyor"
 *
 * Output is always opinion-bearing, not just numbers — the badge tone
 * + text together telegraph "ok / watch / problem" without forcing
 * the reader to mentally compare percentages.
 */

import type { PLCostNode } from "@/lib/selectors/plCost";

export type InsightTone = "positive" | "warning" | "danger" | "info";

export interface PLCostInsight {
  /** Short, punchy callout text (≤ 80 chars). */
  text: string;
  /** Tone drives chip background + emoji. */
  tone: InsightTone;
  /** When set, clicking the chip should scroll/highlight this node. */
  targetNodeId?: string;
}

/** Threshold helpers. Tunable in one place if exec preferences shift. */
const OVER_BUDGET_PCT = 120;
const UNDER_BUDGET_PCT = 70; // < 70% = significantly under budget (positive)
const HEAVY_VARIANCE_USD = 100_000; // $100k absolute delta floor for "biggest"

/**
 * Build the ribbon insights from a fully-aggregated tree. Returns up
 * to 5 callouts, ordered by severity (danger → warning → info →
 * positive). Empty tree → empty array (caller hides the ribbon).
 */
export function generateSmartInsights(tree: PLCostNode[]): PLCostInsight[] {
  if (tree.length === 0) return [];
  const out: PLCostInsight[] = [];

  // Flatten L3 (vessel/project) nodes — these are the operational
  // units users compare to budget.
  const l3Nodes: PLCostNode[] = [];
  const walk = (nodes: PLCostNode[]) => {
    for (const n of nodes) {
      if (n.level === 3) l3Nodes.push(n);
      if (n.children) walk(n.children);
    }
  };
  walk(tree);

  // 1. Over-budget projects (> 120%)
  const overBudgetCount = l3Nodes.filter(
    (n) =>
      n.metrics.realizedExpectedPct != null &&
      n.metrics.realizedExpectedPct > OVER_BUDGET_PCT &&
      n.metrics.expectedUsd > 0
  ).length;
  if (overBudgetCount > 0) {
    out.push({
      text: `${overBudgetCount} proje %${OVER_BUDGET_PCT}+ üzerinde gerçekleşti — bütçe aşımı`,
      tone: "danger",
    });
  }

  // 2. Biggest single absolute variance (positive or negative)
  const sortedByAbsDelta = [...l3Nodes]
    .filter(
      (n) =>
        n.metrics.expectedUsd > 0 &&
        Math.abs(n.metrics.deltaUsd) >= HEAVY_VARIANCE_USD
    )
    .sort(
      (a, b) =>
        Math.abs(b.metrics.deltaUsd) - Math.abs(a.metrics.deltaUsd)
    );
  if (sortedByAbsDelta.length > 0) {
    const top = sortedByAbsDelta[0];
    const overshoot = top.metrics.deltaUsd > 0;
    const pct = top.metrics.realizedExpectedPct
      ? `%${top.metrics.realizedExpectedPct.toFixed(0)}`
      : "—";
    out.push({
      text: overshoot
        ? `${top.label} en fazla bütçe aştı (${pct})`
        : `${top.label} bütçenin altında kaldı (${pct})`,
      tone: overshoot ? "warning" : "positive",
      targetNodeId: top.id,
    });
  }

  // 3. Segments below target (< 70%) — best-performing segments
  const segmentBelowTarget = tree.filter(
    (n) =>
      n.metrics.realizedExpectedPct != null &&
      n.metrics.realizedExpectedPct < UNDER_BUDGET_PCT &&
      n.metrics.expectedUsd > 0
  );
  if (segmentBelowTarget.length > 0) {
    const best = segmentBelowTarget.sort(
      (a, b) =>
        (a.metrics.realizedExpectedPct ?? 0) -
        (b.metrics.realizedExpectedPct ?? 0)
    )[0];
    out.push({
      text: `${best.label} segmenti hedefin altında (%${best.metrics.realizedExpectedPct?.toFixed(0) ?? "—"})`,
      tone: "positive",
      targetNodeId: best.id,
    });
  }

  // 4. Highest-spend segment (volume signal, not variance)
  const heaviestSegment = [...tree].sort(
    (a, b) => b.metrics.realizedUsd - a.metrics.realizedUsd
  )[0];
  if (heaviestSegment && heaviestSegment.metrics.realizedUsd > 0) {
    out.push({
      text: `${heaviestSegment.label} en büyük gerçekleşen segment (${heaviestSegment.rawProjectNos.length} proje)`,
      tone: "info",
      targetNodeId: heaviestSegment.id,
    });
  }

  return out.slice(0, 5);
}
