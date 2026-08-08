/**
 * Tiryaki Finansal Yıl (FY) — 1 Temmuz 00:00 → 30 Haziran 23:59:59.999.
 *
 * Etiket "YY-YY" (örn: 1 Tem 2025 - 30 Haz 2026 = "25-26"). Bugünkü tarih
 * hangi FY'ye düşüyor: Temmuz-Aralık → bu yıl başlangıçlı; Ocak-Haziran →
 * önceki yıl başlangıçlı. 2026-04-27 dolayısıyla FY 25-26'da.
 *
 * Bu modülü dashboard period selector'u + KPI aggregations çağırır. Hiçbir
 * UI komponenti dışı yan etki yok — saf fonksiyonlar.
 */

export interface FinancialYear {
  /** Başlangıç takvim yılı (örn 2025 = 1 Tem 2025 başlayan FY) */
  startYear: number;
  /** Bitiş takvim yılı (= startYear + 1) */
  endYear: number;
  /** 1 Temmuz <startYear> 00:00:00 (local time) */
  start: Date;
  /** 30 Haziran <endYear> 23:59:59.999 (local time) */
  end: Date;
  /** Kısa etiket: "25-26" */
  label: string;
  /** Tam etiket: "FY 2025-26" */
  fullLabel: string;
  /** URL/key-safe tanımlayıcı (= label) */
  key: string;
}

/** Verilen tarih hangi finansal yıla düşüyor? */
export function getFinancialYear(d: Date = new Date()): FinancialYear {
  const m = d.getMonth(); // 0 = Ocak, 6 = Temmuz
  const y = d.getFullYear();
  // Temmuz (6) ve sonrası → bu yıl başlangıçlı; Ocak-Haziran → önceki yıl
  const startYear = m >= 6 ? y : y - 1;
  return makeFY(startYear);
}

/** Belirli bir başlangıç yılı için FY metası üret. */
export function makeFY(startYear: number): FinancialYear {
  const start = new Date(startYear, 6, 1, 0, 0, 0, 0); // Jul 1 local
  const end = new Date(startYear + 1, 5, 30, 23, 59, 59, 999); // Jun 30 local
  const yy1 = String(startYear).slice(-2);
  const yy2 = String(startYear + 1).slice(-2);
  return {
    startYear,
    endYear: startYear + 1,
    start,
    end,
    label: `${yy1}-${yy2}`,
    fullLabel: `FY ${startYear}-${yy2}`,
    key: `${yy1}-${yy2}`,
  };
}

/**
 * Son N finansal yıl, eski → yeni sıralı. Default 3 yıl: ["23-24","24-25","25-26"]
 * (2026-04-27 referansıyla).
 */
export function lastNFinancialYears(
  now: Date = new Date(),
  n: number = 3
): FinancialYear[] {
  const current = getFinancialYear(now);
  const out: FinancialYear[] = [];
  for (let i = 0; i < n; i++) out.push(makeFY(current.startYear - i));
  return out.reverse();
}

/**
 * "25-26" gibi key string'inden FinancialYear çöz. Geçersiz format → null.
 *
 * 2 haneli yıl çözümlemesi: Tiryaki 2000 öncesi kurulmadığı için her zaman
 * 2000+ kabul edilir (örn "25" → 2025, "99" → 2099 değil 1999 değil → 2025
 * ve sonrası bizim için yeterli). 2100'e kadar güvenli.
 */
export function findFyByKey(key: string): FinancialYear | null {
  const m = key.match(/^(\d{2})-(\d{2})$/);
  if (!m) return null;
  const yy = parseInt(m[1], 10);
  if (!Number.isFinite(yy)) return null;
  const startYear = 2000 + yy;
  return makeFY(startYear);
}

/** Bir tarih string'i (ISO) belirli bir FY içinde mi? */
export function isInFinancialYear(
  date: string | Date,
  fy: FinancialYear
): boolean {
  const t = typeof date === "string" ? new Date(date) : date;
  if (!Number.isFinite(t.getTime())) return false;
  return t >= fy.start && t <= fy.end;
}

/**
 * Liste filtrele: yalnızca belirtilen FY içindeki öğeler kalsın.
 *
 * Tarih önceliği (2026-05): `operationPeriod` (Operasyon Periyodu —
 * F&O `mserp_executionperiod`) → `projectDate` (sözleşme tarihi).
 * Operasyon periyodu set edilmiş projelerde FY filtreleri buna göre
 * çalışır; eski projelerde (alan boş) projectDate fallback devreye
 * girer.
 */
export function filterByFinancialYear<
  T extends { projectDate: string; operationPeriod?: string | null },
>(items: T[], fy: FinancialYear): T[] {
  return items.filter((it) =>
    isInFinancialYear(it.operationPeriod || it.projectDate, fy)
  );
}

/** Mevcut FY'nin key'ini döner (örn "25-26"). Default helper. */
export function getCurrentFyKey(now: Date = new Date()): string {
  return getFinancialYear(now).key;
}
