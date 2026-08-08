/**
 * AIS position freshness.
 *
 * The vessel-position scraper (cloudflare-worker) returns two distinct
 * timestamps:
 *   - `updatedAt`          — when *we* scraped (always "now"), useless for age
 *   - `positionReceivedAt` — when the vessel's AIS actually reported the
 *                            position (UTC, from myshiptracking). This is the
 *                            real freshness signal.
 *
 * A position older than `MAX_POSITION_AGE_DAYS` is considered stale and is
 * dropped by consumers (RouteMap, VesselMapPage) — the live position is not
 * used; progress falls back to the date-based milestone estimate.
 *
 * Null/unparseable `positionReceivedAt` is treated as NOT stale: we have no
 * evidence the position is old, so we keep prior behaviour (use it) rather
 * than silently hiding every vessel when a scrape happens to omit the field.
 */
export const MAX_POSITION_AGE_DAYS = 3;

/** Whole-day age of an AIS position, or null when the timestamp is missing/invalid. */
export function positionAgeDays(
  receivedAt: string | null | undefined,
  now: Date = new Date()
): number | null {
  if (!receivedAt) return null;
  const t = Date.parse(receivedAt);
  if (Number.isNaN(t)) return null;
  return Math.floor((now.getTime() - t) / 86_400_000);
}

/** True when the position is older than the staleness threshold. */
export function isPositionStale(
  receivedAt: string | null | undefined,
  now: Date = new Date()
): boolean {
  const age = positionAgeDays(receivedAt, now);
  return age !== null && age > MAX_POSITION_AGE_DAYS;
}
