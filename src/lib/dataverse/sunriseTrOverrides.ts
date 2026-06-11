/**
 * ⚠️⚠️ GEÇİCİ — SİLİNECEK ⚠️⚠️
 *
 * Sunrise TR segmenti için gerçekleşen gider HARDCODED override'ları.
 *
 * Bu segmentin gerçekleşen giderleri farklı bir F&O entity'sinden
 * gelecek; entity henüz elimizde olmadığı için bugünkü toplantıda
 * Sefer Takibi ekranı (Gider Karşılaştırması kartı + Gerçekleşen K&Z
 * kartı) doğru toplamları göstersin diye aşağıdaki projelere sabit
 * değer basıyoruz (kullanıcının verdiği rakamlar, USD).
 *
 * KALDIRMA PLANI: entity adı geldiğinde —
 *   1. Bu dosyayı SİL.
 *   2. `useProjectExpenseLines.ts` içindeki tek override bloğunu
 *      (import + `runExpenseChain` başındaki short-circuit) SİL.
 *   3. Yeni entity'yi normal zincire (veya ayrı bir Sunrise-TR koluna)
 *      bağla.
 *
 * Kapsam: yalnızca per-proje zincir (Sefer Takibi kartları + kalem
 * detay paneli). Trade Cost tenant rollup'ına BİLEREK dokunmuyor.
 */

/** projectNo → gerçekleşen gider (USD). Anahtarlar normalize edilerek
 *  (trim + upper) karşılaştırılır. */
const SUNRISE_TR_REALIZED_USD: Record<string, number> = {
  "ORGANIK01-145": 148,
  "ORGANIK01-143": 2_859_197,
  "ORGANIK01-138": 2_120_507,
  "ORGANIK01-133": 349_240,
  "ORGANIK01-127": 373_236,
  "ORGANIK01-120": 1_985_973,
  "ORGANIK01-108": 267_065,
  "ORGANIK01-147": 125_912,
};

/** Override tutarı — proje listede değilse null. */
export function getSunriseTrRealizedOverride(
  projectNo: string | null | undefined
): number | null {
  const key = (projectNo ?? "").trim().toUpperCase();
  if (!key) return null;
  return SUNRISE_TR_REALIZED_USD[key] ?? null;
}

/**
 * Zincirin döndürdüğü enriched satırlarla AYNI şekilde tek sentetik
 * satır üretir (`mserp_amountcur_usd` işaretli USD): kartlar, kalem
 * detay paneli ve Gerçekleşen K&Z hiçbir değişiklik gerektirmeden bu
 * satırı normal bir gider kalemi gibi tüketir.
 */
export function buildSunriseTrOverrideRow(
  projectNo: string,
  usd: number
): Record<string, unknown> {
  return {
    mserp_expensenum: "SUNRISE-TR-GEÇİCİ",
    mserp_expenseid: "SUNRISE-TR",
    mserp_description:
      "Sunrise TR gerçekleşen gider — geçici sabit değer (entity bekleniyor)",
    mserp_refexpenseid: "SUNRISE TR GERÇEKLEŞEN GİDER",
    mserp_projectnum: projectNo,
    mserp_amountcur: usd,
    mserp_amountcur_usd: usd,
    mserp_currencycode: "USD",
  };
}
