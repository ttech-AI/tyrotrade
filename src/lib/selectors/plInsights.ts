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
export function generateSmartInsights(tree: PLCostNode[]): PLCostInsight[] {
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
      text: `${balanced.label} en dengeli segment (%${pct})`,
      tone: "positive",
      tooltip: `${balanced.label} segmentinde gerçekleşen gider, tahminin %${pct}'ine geldi — tahminden sadece ${gap} puan sapma. Portföydeki en isabetli forecast. Hangi statü/projelerin bu dengeyi tutturduğunu görmek için tıklayın.`,
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
      text: `${heaviest.label} en masraflı segment (${realised})`,
      tone: "info",
      tooltip: `${heaviest.label} segmenti, gerçekleşen gider toplamının yaklaşık %${share.toFixed(0)}'ini tek başına oluşturuyor (${realised}, ${heaviest.rawProjectNos.length} proje). Portföyün en pahalı parçası. Hangi gider kalemlerinin bu paya katkı verdiğini görmek için tıklayın.`,
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
      text: `${lightest.label} en az masraflı segment (${realised})`,
      tone: "positive",
      tooltip: `${lightest.label} segmentinde toplam ${realised} gerçekleşen gider var — anlamlı eşiği aşan en düşük rakam. Küçük portföy ya da düşük lojistik yoğunluğu olabilir. Detay için tıklayın.`,
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
      text: overshoot
        ? `${mostDeviated.label} tahmini ${deltaTxt} aştı`
        : `${mostDeviated.label} tahminin ${deltaTxt} altında`,
      tone: overshoot ? "warning" : "positive",
      tooltip: overshoot
        ? `${mostDeviated.label} segmentinde gerçekleşen gider, tahminin ${deltaTxt} (%${pct}) üzerine çıktı — portföyde tahminden en çok sapan segment. Tıklayarak hangi statü ve projelerin bu sapmaya neden olduğunu görebilirsiniz.`
        : `${mostDeviated.label} segmentinde gerçekleşen gider, tahminin ${deltaTxt} (%${pct}) altında kaldı — portföyde tahminden en çok sapan segment ama pozitif yönde. Tıklayarak nereden tasarruf çıktığını görebilirsiniz.`,
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
      text: `${leastDeviated.label} tahminden en az saptı (Δ ${deltaTxt})`,
      tone: "positive",
      tooltip: `${leastDeviated.label} segmentinde gerçekleşen ile tahmini arasında yalnızca ${deltaTxt} fark var (%${pct} gerçekleşme). Anlamlı bir forecast hatası eşiğinin (${formatCompactCurrency(MIN_DELTA_FOR_SMALL_VARIANCE, "USD")}) altındaki en isabetli segment.`,
      targetNodeId: leastDeviated.id,
    });
  }

  return out.slice(0, 5);
}
