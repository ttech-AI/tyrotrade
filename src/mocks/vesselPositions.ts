/**
 * Mock AIS positions for local development.
 *
 * The real live position comes from the cloudflare-worker scrape, which only
 * works when the app runs against real Dataverse data (real IMO + vessel
 * names that resolve on myshiptracking). In mock mode the projects are
 * synthetic, so we synthesize an AIS hit here instead — letting the
 * stale-position UI (grey "anlık konum al" button, "Son konum N gün önce"
 * note, the VesselMap stale list) be exercised offline with no worker.
 *
 * The age is deterministic per project so the same project is always fresh
 * or always stale across reloads — pick an even-hashing projectNo to see a
 * live marker, an odd-hashing one to see the stale lock.
 */

const FRESH_AGE_DAYS = 4;
const STALE_AGE_DAYS = 45;

/** Stable string hash → deterministic fresh/stale split. */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Whole-day age this project's mock position should report. */
export function mockPositionAgeDays(projectNo: string): number {
  return hash(projectNo) % 2 === 0 ? FRESH_AGE_DAYS : STALE_AGE_DAYS;
}

/** ISO timestamp `mockPositionAgeDays` ago — mirrors the worker's `positionReceivedAt`. */
export function mockPositionReceivedAt(
  projectNo: string,
  now: Date = new Date()
): string {
  return new Date(
    now.getTime() - mockPositionAgeDays(projectNo) * 86_400_000
  ).toISOString();
}
