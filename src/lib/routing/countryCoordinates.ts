/**
 * Country name → representative {lat, lon} lookup.
 *
 * Used as a *fallback* on the route map: when a project's loading or
 * discharge **port** can't be resolved to coordinates (so no route line
 * can be drawn — see `isPortDefined` in RouteMap), we still want to mark
 * roughly *where* the cargo is coming from / going to. The F&O ship row
 * carries `mserp_loadingcountryregionid` / `mserp_dischargecountryregionid`
 * as English country names ("Ukraine", "Turkey", "Iraq", …), so we map
 * those to a single representative point (capital city) per country.
 *
 * This is intentionally coarse — a country-level pin, not a port. It only
 * exists to give the operator *some* geographic anchor when precise port
 * data is missing. Matching is diacritic/case-insensitive and tolerates
 * common F&O / ISO naming variants via the alias list.
 */

import { normalisePortKey } from "./portCoordinates";

export interface CountryPoint {
  /** Canonical display name. */
  name: string;
  lon: number;
  lat: number;
}

interface CountryRecord extends CountryPoint {
  /** Extra spellings / ISO codes that map to this country. The canonical
   *  name is indexed automatically; only add what differs. */
  aliases: string[];
}

/** Representative point per country — capital city coordinates. Covers the
 *  countries Tiryaki trades through (superset of `PORT_RECORDS` countries)
 *  plus common origins/destinations that may appear without a known port. */
const COUNTRY_RECORDS: CountryRecord[] = [
  // ── Türkiye + neighbours ─────────────────────────────────────────────
  { name: "Türkiye", lat: 39.93, lon: 32.85, aliases: ["turkey", "turkiye", "tur", "tr"] },
  { name: "Greece", lat: 37.98, lon: 23.73, aliases: ["yunanistan", "grc", "gr"] },
  { name: "Bulgaria", lat: 42.7, lon: 23.32, aliases: ["bulgaristan", "bgr", "bg"] },
  { name: "Romania", lat: 44.43, lon: 26.1, aliases: ["romanya", "rou", "ro"] },
  { name: "Moldova", lat: 47.01, lon: 28.86, aliases: ["moldova", "mda", "md"] },
  { name: "Cyprus", lat: 35.19, lon: 33.38, aliases: ["kibris", "cyp", "cy"] },

  // ── Black Sea / Caucasus ─────────────────────────────────────────────
  { name: "Ukraine", lat: 50.45, lon: 30.52, aliases: ["ukrayna", "ukr", "ua"] },
  { name: "Russia", lat: 55.75, lon: 37.62, aliases: ["rusya", "russianfederation", "rus", "ru"] },
  { name: "Georgia", lat: 41.72, lon: 44.78, aliases: ["gurcistan", "geo", "ge"] },

  // ── Middle East / Gulf ───────────────────────────────────────────────
  { name: "Iraq", lat: 33.31, lon: 44.36, aliases: ["irak", "irq", "iq"] },
  { name: "Iran", lat: 35.69, lon: 51.39, aliases: ["iran", "iranislamicrepublicof", "irn", "ir"] },
  { name: "Saudi Arabia", lat: 24.71, lon: 46.68, aliases: ["suudiarabistan", "ksa", "sau", "sa"] },
  { name: "Jordan", lat: 31.95, lon: 35.93, aliases: ["urdun", "jor", "jo"] },
  { name: "Lebanon", lat: 33.89, lon: 35.5, aliases: ["lubnan", "lbn", "lb"] },
  { name: "Syria", lat: 33.51, lon: 36.29, aliases: ["suriye", "syrianarabrepublic", "syr", "sy"] },
  { name: "Israel", lat: 31.77, lon: 35.21, aliases: ["israil", "isr", "il"] },
  { name: "UAE", lat: 24.45, lon: 54.38, aliases: ["unitedarabemirates", "birlesikarapemirlikleri", "are", "ae"] },
  { name: "Oman", lat: 23.59, lon: 58.41, aliases: ["umman", "omn", "om"] },
  { name: "Qatar", lat: 25.29, lon: 51.53, aliases: ["katar", "qat", "qa"] },
  { name: "Kuwait", lat: 29.38, lon: 47.99, aliases: ["kuveyt", "kwt", "kw"] },
  { name: "Bahrain", lat: 26.23, lon: 50.59, aliases: ["bahreyn", "bhr", "bh"] },
  { name: "Yemen", lat: 15.37, lon: 44.19, aliases: ["yemen", "yem", "ye"] },

  // ── Mediterranean / Europe ───────────────────────────────────────────
  { name: "Italy", lat: 41.9, lon: 12.5, aliases: ["italya", "ita", "it"] },
  { name: "Spain", lat: 40.42, lon: -3.7, aliases: ["ispanya", "esp", "es"] },
  { name: "France", lat: 48.85, lon: 2.35, aliases: ["fransa", "fra", "fr"] },
  { name: "Portugal", lat: 38.72, lon: -9.14, aliases: ["portekiz", "prt", "pt"] },
  { name: "Croatia", lat: 45.81, lon: 15.98, aliases: ["hirvatistan", "hrv", "hr"] },
  { name: "Slovenia", lat: 46.06, lon: 14.51, aliases: ["slovenya", "svn", "si"] },
  { name: "Albania", lat: 41.33, lon: 19.82, aliases: ["arnavutluk", "alb", "al"] },
  { name: "Montenegro", lat: 42.44, lon: 19.26, aliases: ["karadag", "mne", "me"] },
  { name: "Malta", lat: 35.9, lon: 14.51, aliases: ["malta", "mlt", "mt"] },

  // ── Northern Europe ──────────────────────────────────────────────────
  { name: "Netherlands", lat: 52.37, lon: 4.9, aliases: ["hollanda", "holland", "nld", "nl"] },
  { name: "Belgium", lat: 50.85, lon: 4.35, aliases: ["belcika", "bel", "be"] },
  { name: "Germany", lat: 52.52, lon: 13.4, aliases: ["almanya", "deu", "de"] },
  { name: "United Kingdom", lat: 51.51, lon: -0.13, aliases: ["ingiltere", "uk", "greatbritain", "gbr", "gb"] },
  { name: "Ireland", lat: 53.35, lon: -6.26, aliases: ["irlanda", "irl", "ie"] },
  { name: "Poland", lat: 52.23, lon: 21.01, aliases: ["polonya", "pol", "pl"] },
  { name: "Lithuania", lat: 54.69, lon: 25.28, aliases: ["litvanya", "ltu", "lt"] },
  { name: "Latvia", lat: 56.95, lon: 24.11, aliases: ["letonya", "lva", "lv"] },
  { name: "Estonia", lat: 59.44, lon: 24.75, aliases: ["estonya", "est", "ee"] },
  { name: "Denmark", lat: 55.68, lon: 12.57, aliases: ["danimarka", "dnk", "dk"] },
  { name: "Norway", lat: 59.91, lon: 10.75, aliases: ["norvec", "nor", "no"] },
  { name: "Sweden", lat: 59.33, lon: 18.07, aliases: ["isvec", "swe", "se"] },
  { name: "Finland", lat: 60.17, lon: 24.94, aliases: ["finlandiya", "fin", "fi"] },

  // ── Africa ───────────────────────────────────────────────────────────
  { name: "Egypt", lat: 30.04, lon: 31.24, aliases: ["misir", "egyptarabrepublic", "egy", "eg"] },
  { name: "Libya", lat: 32.89, lon: 13.19, aliases: ["libya", "lby", "ly"] },
  { name: "Tunisia", lat: 36.81, lon: 10.18, aliases: ["tunus", "tun", "tn"] },
  { name: "Algeria", lat: 36.75, lon: 3.06, aliases: ["cezayir", "dza", "dz"] },
  { name: "Morocco", lat: 34.02, lon: -6.84, aliases: ["fas", "mar", "ma"] },
  { name: "Sudan", lat: 15.5, lon: 32.56, aliases: ["sudan", "sdn", "sd"] },
  { name: "Ethiopia", lat: 9.03, lon: 38.74, aliases: ["etiyopya", "eth", "et"] },
  { name: "Djibouti", lat: 11.59, lon: 43.15, aliases: ["cibuti", "dji", "dj"] },
  { name: "Eritrea", lat: 15.34, lon: 38.93, aliases: ["eritre", "eri", "er"] },
  { name: "Kenya", lat: -1.29, lon: 36.82, aliases: ["kenya", "ken", "ke"] },
  { name: "Tanzania", lat: -6.16, lon: 35.74, aliases: ["tanzanya", "tza", "tz"] },
  { name: "Mozambique", lat: -25.97, lon: 32.58, aliases: ["mozambik", "moz", "mz"] },
  { name: "South Africa", lat: -25.75, lon: 28.19, aliases: ["guneyafrika", "zaf", "za"] },
  { name: "Namibia", lat: -22.56, lon: 17.08, aliases: ["namibya", "nam", "na"] },
  { name: "Angola", lat: -8.84, lon: 13.23, aliases: ["angola", "ago", "ao"] },
  { name: "Nigeria", lat: 9.08, lon: 7.4, aliases: ["nijerya", "nga", "ng"] },
  { name: "Ghana", lat: 5.6, lon: -0.19, aliases: ["gana", "gha", "gh"] },
  { name: "Togo", lat: 6.13, lon: 1.22, aliases: ["togo", "tgo", "tg"] },
  { name: "Benin", lat: 6.5, lon: 2.62, aliases: ["benin", "ben", "bj"] },
  { name: "Guinea", lat: 9.64, lon: -13.58, aliases: ["gine", "gin", "gn"] },
  { name: "Côte d'Ivoire", lat: 6.83, lon: -5.29, aliases: ["cotedivoire", "ivorycoast", "fildisisahili", "civ", "ci"] },
  { name: "Senegal", lat: 14.72, lon: -17.47, aliases: ["senegal", "sen", "sn"] },

  // ── Americas ─────────────────────────────────────────────────────────
  { name: "USA", lat: 38.9, lon: -77.04, aliases: ["unitedstates", "unitedstatesofamerica", "amerika", "abd", "usa", "us"] },
  { name: "Canada", lat: 45.42, lon: -75.7, aliases: ["kanada", "can", "ca"] },
  { name: "Mexico", lat: 19.43, lon: -99.13, aliases: ["meksika", "mex", "mx"] },
  { name: "Brazil", lat: -15.79, lon: -47.88, aliases: ["brezilya", "bra", "br"] },
  { name: "Argentina", lat: -34.6, lon: -58.38, aliases: ["arjantin", "arg", "ar"] },
  { name: "Uruguay", lat: -34.9, lon: -56.16, aliases: ["uruguay", "ury", "uy"] },
  { name: "Paraguay", lat: -25.28, lon: -57.64, aliases: ["paraguay", "pry", "py"] },
  { name: "Venezuela", lat: 10.48, lon: -66.9, aliases: ["venezuela", "ven", "ve"] },
  { name: "Colombia", lat: 4.71, lon: -74.07, aliases: ["kolombiya", "col", "co"] },
  { name: "Peru", lat: -12.05, lon: -77.04, aliases: ["peru", "per", "pe"] },
  { name: "Chile", lat: -33.45, lon: -70.67, aliases: ["sili", "chl", "cl"] },

  // ── South / East Asia + Oceania ──────────────────────────────────────
  { name: "India", lat: 28.61, lon: 77.21, aliases: ["hindistan", "ind", "in"] },
  { name: "Pakistan", lat: 33.69, lon: 73.06, aliases: ["pakistan", "pak", "pk"] },
  { name: "Bangladesh", lat: 23.81, lon: 90.41, aliases: ["banglades", "bgd", "bd"] },
  { name: "Sri Lanka", lat: 6.93, lon: 79.86, aliases: ["srilanka", "lka", "lk"] },
  { name: "China", lat: 39.9, lon: 116.4, aliases: ["cin", "chn", "cn"] },
  { name: "Japan", lat: 35.68, lon: 139.69, aliases: ["japonya", "jpn", "jp"] },
  { name: "South Korea", lat: 37.57, lon: 126.98, aliases: ["guneykore", "korearepublicof", "republicofkorea", "kor", "kr"] },
  { name: "Vietnam", lat: 21.03, lon: 105.85, aliases: ["vietnam", "vietnam", "vnm", "vn"] },
  { name: "Thailand", lat: 13.76, lon: 100.5, aliases: ["tayland", "tha", "th"] },
  { name: "Malaysia", lat: 3.14, lon: 101.69, aliases: ["malezya", "mys", "my"] },
  { name: "Singapore", lat: 1.35, lon: 103.82, aliases: ["singapur", "sgp", "sg"] },
  { name: "Indonesia", lat: -6.21, lon: 106.85, aliases: ["endonezya", "idn", "id"] },
  { name: "Philippines", lat: 14.6, lon: 120.98, aliases: ["filipinler", "phl", "ph"] },
  { name: "Australia", lat: -35.28, lon: 149.13, aliases: ["avustralya", "aus", "au"] },
  { name: "New Zealand", lat: -41.29, lon: 174.78, aliases: ["yenizelanda", "nzl", "nz"] },
];

// Build alias → record index once at module init.
const COUNTRY_INDEX: Map<string, CountryPoint> = (() => {
  const m = new Map<string, CountryPoint>();
  for (const rec of COUNTRY_RECORDS) {
    const point: CountryPoint = { name: rec.name, lon: rec.lon, lat: rec.lat };
    m.set(normalisePortKey(rec.name), point);
    for (const a of rec.aliases) {
      const k = normalisePortKey(a);
      if (k) m.set(k, point);
    }
  }
  return m;
})();

/** Resolve a free-form country string to a representative point. Returns
 *  null when the string is empty, the "—" sentinel, or unknown. */
export function lookupCountry(
  raw: string | null | undefined
): CountryPoint | null {
  if (!raw || raw.trim() === "—") return null;
  const k = normalisePortKey(raw);
  if (!k) return null;
  return COUNTRY_INDEX.get(k) ?? null;
}
