const trCollator = new Intl.Collator("tr", { sensitivity: "base" });

export const formatCurrency = (
  amount: number,
  currency: string = "USD",
  opts?: { maximumFractionDigits?: number }
): string =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    maximumFractionDigits: opts?.maximumFractionDigits ?? 0,
  }).format(amount);

export const formatCompactCurrency = (
  amount: number,
  currency: string = "USD"
): string =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);

export const formatTons = (kg: number): string => {
  const tons = kg / 1000;
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(tons);
};

export const formatNumber = (n: number, fractionDigits = 0): string =>
  new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  }).format(n);

/**
 * Per-ton indicative freight rate, e.g. `"61,06 USD/t"`. Used across the
 * Fiyat Takibi page (KPIs, table, charts, detail panel) so every surface
 * formats freight prices identically. Up to 2 decimals, trailing zeros
 * dropped. Pass `withUnit=false` for the bare number (chart axes / tiles
 * that render the unit separately).
 */
export const formatFreightRate = (
  value: number,
  currency: string = "USD",
  withUnit: boolean = true
): string => {
  const n = new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: 2,
  }).format(value);
  return withUnit ? `${n} ${currency}/t` : n;
};

/**
 * Standard Turkish date display — `dd.MM.yyyy` (e.g. `25.04.2026`).
 *
 * Used everywhere a date is shown to the user (project list, right-panel
 * cards, milestone timeline, dashboard tiles, data inspector). Operators
 * read the same format whether they're in the Veri Yönetimi raw table or
 * in the Projeler hero card — consistency is the goal.
 *
 * Accepts ISO datetime ("2026-04-25T00:00:00Z") or date-only ("2026-04-25");
 * any other parseable string falls back through `new Date()`.
 */
export const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
};

/** Compact `dd.MM` (no year) — kept for pill / inline contexts where the
 *  year is implied by surrounding context. */
export const formatDateShort = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
  }).format(d);
};

export const trSort = trCollator.compare;

/** Turkish relative-time helper for milestone/event chips:
 *  "bugün", "yarın", "dün", "X gün sonra", "X gün önce".
 *  Day delta is rounded so a few-hour drift around midnight doesn't
 *  bump the label by a whole bucket. */
export const formatRelativeTime = (date: Date, now: Date): string => {
  const ms = date.getTime() - now.getTime();
  const days = Math.round(ms / (1000 * 60 * 60 * 24));
  if (days === 0) return "bugün";
  if (days === 1) return "yarın";
  if (days === -1) return "dün";
  if (days > 0) return `${days} gün sonra`;
  return `${Math.abs(days)} gün önce`;
};
