/**
 * Smart insights generator for the Trade Cost page.
 *
 * Walks the L1 (segment) layer of the hierarchy and surfaces up to
 * five punchy callouts an executive can scan in one breath. The
 * focus is **segment-level** comparisons because that's the unit of
 * portfolio thinking: "where did we spend most", "which segment did
 * we forecast best", "where did things go off the rails".
 *
 * Generated insights (in priority order):
 *
 *   1. En Dengeli Segment
 *      Segment whose R/E % is closest to 100% — the segment we
 *      forecast most accurately.
 *
 *   2. En Masraflı Segment
 *      Segment with the highest absolute `realizedUsd` — where the
 *      portfolio is spending the most money.
 *
 *   3. En Az Masraflı Segment
 *      Segment with the lowest absolute `realizedUsd` (above a small
 *      minimum so we don't pick a noise segment) — the smallest line
 *      item in the portfolio.
 *
 *   4. Tahminden En Çok Sapan Segment
 *      Segment with the biggest absolute |deltaUsd| — the biggest
 *      dollar-amount surprise vs estimate, in either direction.
 *
 *   5. Tahminden En Az Sapan Segment
 *      Segment with the smallest absolute |deltaUsd| (still above a
 *      minimum so we don't pick a meaningless near-zero one) — the
 *      best forecast in dollar terms.
 *
 * Each insight carries:
 *   - `text`    : short chip label (≤ 80 chars)
 *   - `tone`    : drives chip background + icon
 *   - `tooltip` : richer hover explanation (2-3 sentences max)
 *   - `targetNodeId` (when applicable): chip becomes clickable and
 *     opens the corresponding detail panel
 *
 * Diversification: each insight slot iterates over its ranked
 * candidate list and picks the highest-ranked one whose segment id
 * hasn't already been pinned by an earlier slot. So if Iraq is both
 * "en masraflı" (#2) AND globally "en çok sapan" (#4), slot #4 falls
 * through to the SECOND-most-deviating segment instead of silently
 * disappearing. Every slot reliably surfaces a distinct segment as
 * long as ≥ 1 eligible candidate exists for it.
 */

import type { PLCostNode } from "@/lib/selectors/plCost";
import { formatCompactCurrency } from "@/lib/format";

/** The translate function from `useT()` — passed in by the calling
 *  component so this selector can build i18n strings without the
 *  hook (selectors run outside React). */
export type TranslateFn = (key: string) => string;

/** Substitute `{name}` placeholders in a translated template with
 *  the provided data values. Values are pre-formatted strings (labels,
 *  currency, percentages) so language only affects the surrounding
 *  words, never the data. */
function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

export type InsightTone = "positive" | "warning" | "danger" | "info";

export interface PLCostInsight {
  /** Short, punchy callout text (≤ 80 chars). */
  text: string;
  /** Tone drives chip background + icon. */
  tone: InsightTone;
  /** Hover tooltip explanation (richer than `text`). */
  tooltip: string;
  /** When set, clicking the chip should scroll/highlight this node. */
  targetNodeId?: string;
}

/** Threshold helpers. Tunable in one place if exec preferences shift. */
/** Minimum realisedUsd a segment needs to be considered eligible for
 *  "en az masraflı" — without it, the smallest segment is always a
 *  $1 noise row and the callout reads as garbage. */
const MIN_REALIZED_FOR_LOW_SPEND = 50_000;
/** Minimum |deltaUsd| for "en az sapan" — same reason; without a
 *  floor we'd surface a $200 delta on a $5M segment as "perfect". */
const MIN_DELTA_FOR_SMALL_VARIANCE = 5_000;

/**
 * Build the ribbon insights from a fully-aggregated tree. Returns up
 * to 5 callouts. Empty tree (or no comparable segments) → empty
 * array (caller hides the ribbon).
 */
export function generateSmartInsights(
  tree: PLCostNode[],
  t: TranslateFn
): PLCostInsight[] {
  if (tree.length === 0) return [];

  // L1 segments are the only subject. Filter to ones with real
  // signal in both expected and realised — empty-expected segments
  // produce null R/E ratios that don't fit the comparisons.
  const segments = tree.filter(
    (s) => s.metrics.expectedUsd > 0 && s.metrics.realizedUsd > 0
  );

  if (segments.length === 0) return [];

  const out: PLCostInsight[] = [];
  const consumedSegmentIds = new Set<string>();

  /** Pick the first candidate in a ranked list whose segment id isn't
   *  already pinned by a higher-priority insight. Falls back through
   *  the list instead of silently dropping the slot — that way every
   *  configured insight type actually appears in the ribbon as long
   *  as ≥ 1 eligible segment exists for it. */
  const pickNextAvailable = (
    candidates: PLCostNode[]
  ): PLCostNode | null => {
    for (const c of candidates) {
      if (!consumedSegmentIds.has(c.id)) return c;
    }
    return null;
  };

  const pushInsight = (insight: PLCostInsight): void => {
    if (insight.targetNodeId) consumedSegmentIds.add(insight.targetNodeId);
    out.push(insight);
  };

  // ─── 1. En Dengeli Segment (R/E closest to 100%) ───
  const balancedRanked = [...segments].sort((a, b) => {
    const ga = Math.abs((a.metrics.realizedExpectedPct ?? 100) - 100);
    const gb = Math.abs((b.metrics.realizedExpectedPct ?? 100) - 100);
    return ga - gb;
  });
  const balanced = pickNextAvailable(balancedRanked);
  if (balanced) {
    const pct = balanced.metrics.realizedExpectedPct?.toFixed(1) ?? "—";
    const gap = Math.abs(
      (balanced.metrics.realizedExpectedPct ?? 100) - 100
    ).toFixed(1);
    pushInsight({
      text: fill(t("tc.insights.balanced.text"), { label: balanced.label, pct }),
      tone: "positive",
      tooltip: fill(t("tc.insights.balanced.tip"), {
        label: balanced.label,
        pct,
        gap,
      }),
      targetNodeId: balanced.id,
    });
  }

  // ─── 2. En Masraflı Segment (highest realisedUsd) ───
  const heaviestRanked = [...segments].sort(
    (a, b) => b.metrics.realizedUsd - a.metrics.realizedUsd
  );
  const heaviest = pickNextAvailable(heaviestRanked);
  if (heaviest) {
    const realised = formatCompactCurrency(heaviest.metrics.realizedUsd, "USD");
    const share =
      (heaviest.metrics.realizedUsd /
        segments.reduce((s, x) => s + x.metrics.realizedUsd, 0)) *
      100;
    pushInsight({
      text: fill(t("tc.insights.heaviest.text"), {
        label: heaviest.label,
        amount: realised,
      }),
      tone: "info",
      tooltip: fill(t("tc.insights.heaviest.tip"), {
        label: heaviest.label,
        share: share.toFixed(0),
        amount: realised,
        count: String(heaviest.rawProjectNos.length),
      }),
      targetNodeId: heaviest.id,
    });
  }

  // ─── 3. En Az Masraflı Segment (lowest realisedUsd above floor) ───
  const lightestRanked = [...segments]
    .filter((s) => s.metrics.realizedUsd >= MIN_REALIZED_FOR_LOW_SPEND)
    .sort((a, b) => a.metrics.realizedUsd - b.metrics.realizedUsd);
  const lightest = pickNextAvailable(lightestRanked);
  if (lightest) {
    const realised = formatCompactCurrency(lightest.metrics.realizedUsd, "USD");
    pushInsight({
      text: fill(t("tc.insights.lightest.text"), {
        label: lightest.label,
        amount: realised,
      }),
      tone: "positive",
      tooltip: fill(t("tc.insights.lightest.tip"), {
        label: lightest.label,
        amount: realised,
      }),
      targetNodeId: lightest.id,
    });
  }

  // ─── 4. Tahminden En Çok Sapan Segment (highest |deltaUsd|) ───
  // Crucially this slot does NOT just take the global #1 — if that
  // segment is already pinned by an earlier insight (typically
  // "En Masraflı" since the biggest spender tends to absorb the
  // biggest absolute delta too), we fall through to the next-most-
  // deviating segment so the variance dimension always shows up.
  const mostDeviatedRanked = [...segments]
    .filter((s) => Math.abs(s.metrics.deltaUsd) > 0)
    .sort(
      (a, b) =>
        Math.abs(b.metrics.deltaUsd) - Math.abs(a.metrics.deltaUsd)
    );
  const mostDeviated = pickNextAvailable(mostDeviatedRanked);
  if (mostDeviated) {
    const overshoot = mostDeviated.metrics.deltaUsd > 0;
    const deltaTxt = formatCompactCurrency(
      Math.abs(mostDeviated.metrics.deltaUsd),
      "USD"
    );
    const pct = mostDeviated.metrics.realizedExpectedPct?.toFixed(0) ?? "—";
    pushInsight({
      text: fill(
        t(overshoot ? "tc.insights.mostDeviated.over" : "tc.insights.mostDeviated.under"),
        { label: mostDeviated.label, amount: deltaTxt }
      ),
      tone: overshoot ? "warning" : "positive",
      tooltip: fill(
        t(
          overshoot
            ? "tc.insights.mostDeviated.overTip"
            : "tc.insights.mostDeviated.underTip"
        ),
        { label: mostDeviated.label, amount: deltaTxt, pct }
      ),
      targetNodeId: mostDeviated.id,
    });
  }

  // ─── 5. Tahminden En Az Sapan Segment (smallest |deltaUsd|) ───
  // Hard floor on the delta — without it we'd surface a $200 delta
  // on a $5M segment as "perfect forecast" which feels like cheating.
  const leastDeviatedRanked = [...segments]
    .filter(
      (s) => Math.abs(s.metrics.deltaUsd) >= MIN_DELTA_FOR_SMALL_VARIANCE
    )
    .sort(
      (a, b) =>
        Math.abs(a.metrics.deltaUsd) - Math.abs(b.metrics.deltaUsd)
    );
  const leastDeviated = pickNextAvailable(leastDeviatedRanked);
  if (leastDeviated) {
    const deltaTxt = formatCompactCurrency(
      Math.abs(leastDeviated.metrics.deltaUsd),
      "USD"
    );
    const pct = leastDeviated.metrics.realizedExpectedPct?.toFixed(0) ?? "—";
    pushInsight({
      text: fill(t("tc.insights.leastDeviated.text"), {
        label: leastDeviated.label,
        amount: deltaTxt,
      }),
      tone: "positive",
      tooltip: fill(t("tc.insights.leastDeviated.tip"), {
        label: leastDeviated.label,
        amount: deltaTxt,
        pct,
        floor: formatCompactCurrency(MIN_DELTA_FOR_SMALL_VARIANCE, "USD"),
      }),
      targetNodeId: leastDeviated.id,
    });
  }

  return out.slice(0, 5);
}
