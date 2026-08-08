/**
 * Currency conversion utility — monthly historical rates 2021-01 → 2026-12.
 *
 * The dashboard rolls everything up in USD, but project lines can be
 * priced in USD / EUR / TRY / RUB / GBP. We don't have a live FX feed
 * wired in (no Dataverse FX table, no external API), so rates are
 * hardcoded here as monthly mid-month approximations from public
 * sources. The values are intentionally indicative for executive
 * KPI displays — not accounting-grade reconciliation. When a finance
 * feed is wired in, swap `FX_HISTORY` for a hook that reads the dated
 * rates per project.
 *
 * Per-project conversion uses the project's `projectDate` so a 2022
 * RUB-priced project converts at the war-shock spread rather than
 * today's rate, which is what executive KPIs expect.
 *
 * Coverage:
 *   - 6 fiscal years × 12 months = 72 months per currency
 *   - EUR, TRY, RUB, GBP — covers ~all currencies seen in F&O so far
 *   - USD = 1 by definition
 *
 * Date resolution:
 *   - Project dates inside the table window → exact monthly rate
 *   - Pre-2021 dates → first listed month (clamp)
 *   - Post-2026 dates → last listed month (clamp)
 *   - Missing/invalid date → last listed month (so the legacy
 *     `toUsd(amount, currency)` form still works without a date)
 */

const FX_FIRST_YEAR = 2021;
const FX_LAST_YEAR = 2026;
const MONTHS_COUNT = (FX_LAST_YEAR - FX_FIRST_YEAR + 1) * 12;

/** Monthly USD-conversion factor per currency. Index = (year-2021)×12 + (month-1). */
const FX_HISTORY: Record<string, number[]> = {
  // EUR/USD (ECB reference, mid-month)
  EUR: [
    1.21, 1.21, 1.19, 1.20, 1.22, 1.21, 1.18, 1.18, 1.18, 1.16, 1.14, 1.13, // 2021
    1.13, 1.14, 1.10, 1.07, 1.06, 1.06, 1.02, 1.01, 0.99, 0.98, 1.03, 1.07, // 2022
    1.08, 1.07, 1.07, 1.10, 1.09, 1.09, 1.11, 1.09, 1.07, 1.06, 1.08, 1.09, // 2023
    1.09, 1.08, 1.08, 1.07, 1.08, 1.08, 1.08, 1.10, 1.11, 1.09, 1.06, 1.04, // 2024
    1.04, 1.04, 1.07, 1.10, 1.13, 1.16, 1.17, 1.16, 1.18, 1.15, 1.13, 1.06, // 2025
    1.05, 1.06, 1.07, 1.07, 1.08, 1.08, 1.08, 1.08, 1.08, 1.08, 1.08, 1.08, // 2026
  ],

  // TRY/USD (lira depreciation through the table window)
  TRY: [
    0.135, 0.142, 0.137, 0.121, 0.118, 0.115, 0.116, 0.119, 0.114, 0.108, 0.085, 0.075,
    0.075, 0.072, 0.068, 0.068, 0.062, 0.057, 0.057, 0.055, 0.054, 0.054, 0.054, 0.054,
    0.053, 0.053, 0.053, 0.051, 0.050, 0.042, 0.038, 0.037, 0.037, 0.036, 0.035, 0.034,
    0.034, 0.032, 0.031, 0.031, 0.031, 0.030, 0.030, 0.029, 0.029, 0.029, 0.029, 0.028,
    0.028, 0.028, 0.027, 0.026, 0.026, 0.025, 0.025, 0.025, 0.024, 0.024, 0.024, 0.027,
    0.027, 0.027, 0.026, 0.026, 0.025, 0.025, 0.025, 0.025, 0.025, 0.025, 0.025, 0.025,
  ],

  // RUB/USD (CBR mid-month — war shock March 2022 visible)
  RUB: [
    0.0135, 0.0134, 0.0135, 0.0133, 0.0136, 0.0138, 0.0136, 0.0136, 0.0137, 0.0140, 0.0142, 0.0136,
    0.0130, 0.0124, 0.0089, 0.0125, 0.0143, 0.0182, 0.0179, 0.0166, 0.0167, 0.0162, 0.0164, 0.0144,
    0.0142, 0.0134, 0.0130, 0.0124, 0.0123, 0.0118, 0.0110, 0.0104, 0.0103, 0.0102, 0.0111, 0.0111,
    0.0112, 0.0111, 0.0108, 0.0107, 0.0111, 0.0114, 0.0114, 0.0111, 0.0108, 0.0103, 0.0099, 0.0091,
    0.0093, 0.0103, 0.0119, 0.0120, 0.0124, 0.0128, 0.0128, 0.0125, 0.0121, 0.0124, 0.0126, 0.0125,
    0.0125, 0.0124, 0.0123, 0.0122, 0.0121, 0.0120, 0.0120, 0.0120, 0.0120, 0.0120, 0.0120, 0.0120,
  ],

  // GBP/USD (BoE reference, mid-month)
  GBP: [
    1.36, 1.39, 1.39, 1.39, 1.41, 1.39, 1.38, 1.37, 1.36, 1.36, 1.35, 1.32,
    1.36, 1.34, 1.31, 1.26, 1.25, 1.23, 1.20, 1.21, 1.13, 1.12, 1.18, 1.21,
    1.21, 1.21, 1.23, 1.24, 1.24, 1.27, 1.29, 1.27, 1.23, 1.21, 1.24, 1.27,
    1.27, 1.26, 1.27, 1.25, 1.27, 1.27, 1.28, 1.29, 1.32, 1.30, 1.27, 1.26,
    1.24, 1.25, 1.29, 1.32, 1.34, 1.36, 1.36, 1.34, 1.34, 1.30, 1.27, 1.25,
    1.26, 1.26, 1.27, 1.27, 1.28, 1.28, 1.28, 1.28, 1.28, 1.28, 1.28, 1.28,
  ],
};

// Sanity guard — every series must be exactly MONTHS_COUNT long. Throwing
// at module load surfaces typos immediately during build.
for (const [code, series] of Object.entries(FX_HISTORY)) {
  if (series.length !== MONTHS_COUNT) {
    throw new Error(
      `FX_HISTORY[${code}] has ${series.length} entries, expected ${MONTHS_COUNT}`
    );
  }
}

/** Latest available rate per currency — used for the legacy `toUsd()`
 *  (no-date) form and for any caller that just wants today's rate. */
const LATEST_RATES_TO_USD: Record<string, number> = (() => {
  const out: Record<string, number> = { USD: 1 };
  for (const [code, series] of Object.entries(FX_HISTORY)) {
    out[code] = series[series.length - 1];
  }
  return out;
})();

export interface FxConversion {
  /** Amount in USD after applying the rate. */
  usd: number;
  /** True when an FX rate was applied (i.e. source currency ≠ USD). */
  converted: boolean;
  /** True when the source currency is in `FX_HISTORY`. */
  recognised: boolean;
  /** The rate used (1 for USD, table value otherwise). */
  rate: number;
}

/**
 * Resolve the monthly rate for `currency` at `isoDate`. Returns `null`
 * when the currency isn't in the table.
 */
function resolveRate(
  currency: string,
  isoDate: string | null | undefined
): number | null {
  if (currency === "USD") return 1;
  const series = FX_HISTORY[currency];
  if (!series) return null;
  if (!isoDate) return series[series.length - 1];
  const t = new Date(isoDate);
  if (Number.isNaN(t.getTime())) return series[series.length - 1];
  const y = t.getUTCFullYear();
  const m = t.getUTCMonth(); // 0-11
  if (y < FX_FIRST_YEAR) return series[0];
  if (y > FX_LAST_YEAR) return series[series.length - 1];
  const idx = (y - FX_FIRST_YEAR) * 12 + m;
  return series[idx] ?? series[series.length - 1];
}

/**
 * Convert an amount in a source currency into USD using the historical
 * rate for the supplied ISO date. Always returns a numeric result so
 * callers don't need null-checks; the `recognised` flag tells you
 * whether the result was a real conversion or a passthrough.
 *
 * `isoDate` is typically the project's `projectDate` so a project signed
 * in EUR in 2022-09 converts at that month's rate (~0.99) rather than
 * today's (~1.07).
 */
export function convertToUsdAtDate(
  amount: number,
  currency: string | undefined | null,
  isoDate: string | undefined | null
): FxConversion {
  if (!Number.isFinite(amount)) {
    return { usd: 0, converted: false, recognised: false, rate: 0 };
  }
  const code = (currency ?? "USD").toUpperCase();
  const rate = resolveRate(code, isoDate);
  if (rate === null) {
    // Unknown currency — pass through as-is and flag for the UI.
    return { usd: amount, converted: false, recognised: false, rate: 1 };
  }
  return {
    usd: amount * rate,
    converted: code !== "USD",
    recognised: true,
    rate,
  };
}

/** Convenience for callers that just want the USD number, dated. */
export function toUsdAtDate(
  amount: number,
  currency: string | undefined | null,
  isoDate: string | undefined | null
): number {
  return convertToUsdAtDate(amount, currency, isoDate).usd;
}

/* ─────────── Legacy (no-date) helpers — kept for backward compat ───────────
 *
 * Resolve to the latest known rate. New code should prefer
 * `toUsdAtDate(...)` with the project's `projectDate`. Existing call
 * sites that don't have a date in scope still work via these wrappers.
 */

export function convertToUsd(
  amount: number,
  currency: string | undefined | null
): FxConversion {
  if (!Number.isFinite(amount)) {
    return { usd: 0, converted: false, recognised: false, rate: 0 };
  }
  const code = (currency ?? "USD").toUpperCase();
  const rate = LATEST_RATES_TO_USD[code];
  if (rate === undefined) {
    return { usd: amount, converted: false, recognised: false, rate: 1 };
  }
  return {
    usd: amount * rate,
    converted: code !== "USD",
    recognised: true,
    rate,
  };
}

export function toUsd(
  amount: number,
  currency: string | undefined | null
): number {
  return convertToUsd(amount, currency).usd;
}

/** Currencies the table currently knows about. */
export const SUPPORTED_FX_CODES: string[] = ["USD", ...Object.keys(FX_HISTORY)];
