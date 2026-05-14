/**
 * Sea-route waypoint corridors. Originally lifted from
 * `scripts/build-mocks.py:42-119` and extended for the live Dataverse
 * port set so routes hug straits/canals (Bosphorus, Dardanelles, Kerch,
 * Suez, Bab-el-Mandeb, Hormuz, Gibraltar) instead of slicing across
 * land via great-circle.
 *
 * The composer calls `selectCorridor(originKey, destKey, …)` with the
 * canonical port keys from `portCoordinates.ts`. Each branch returns
 * an ordered list of intermediate waypoints; origin and destination
 * ports themselves are NOT included — caller adds them.
 *
 * Symmetry: most maritime routes are reversible. When we identify a
 * pair-with-corridor in one direction we also handle the reverse so the
 * route doesn't fall through to the midpoint fallback (which crosses
 * land for ~half the realistic ports).
 */

import type { Waypoint } from "@/lib/dataverse/entities";

const wp = (lon: number, lat: number, name?: string): Waypoint =>
  name ? { lon, lat, name } : { lon, lat };

/* ─────────── Strait waypoints (named, canonical) ─────────── */

const KERCH = wp(36.62, 45.32, "Kerch Strait");
const BOSPHORUS = wp(28.97, 41.0, "Bosphorus");
const MARMARA_W = wp(28.0, 40.7, "Sea of Marmara");
const DARDANELLES = wp(26.5, 40.05, "Dardanelles");
const AEGEAN_S = wp(25.5, 38.5);
const PORT_SAID_N = wp(32.3, 31.25, "Port Said (Suez N)");
const SUEZ_S = wp(32.55, 29.95, "Suez (Canal S)");
const BAB_EL_MANDEB = wp(43.4, 12.6, "Bab-el-Mandeb");
const GULF_OF_ADEN = wp(51.0, 12.5, "Gulf of Aden");
const HORMUZ = wp(56.5, 26.5, "Strait of Hormuz");
const GIBRALTAR = wp(-5.5, 36.0, "Strait of Gibraltar");

/* ─────────── Atlantic legs (existing — kept for back-compat) ─────────── */

export const ARG_TO_GIB: Waypoint[] = [
  wp(-58.5, -34.6, "Río de la Plata"),
  wp(-55.0, -36.0),
  wp(-45.0, -28.0),
  wp(-30.0, -15.0),
  wp(-22.0, 0.0),
  wp(-22.0, 15.0),
  wp(-18.0, 22.0),
  wp(-10.0, 33.0),
  GIBRALTAR,
];

export const BRAZIL_TO_GIB: Waypoint[] = [
  wp(-50.0, -0.5, "Amazon Mouth"),
  wp(-40.0, 2.0),
  wp(-28.0, 8.0),
  wp(-18.0, 22.0),
  wp(-10.0, 35.0),
  GIBRALTAR,
];

export const MED_TO_SUEZ: Waypoint[] = [
  wp(5.0, 38.0),
  wp(18.0, 35.5),
  PORT_SAID_N,
];

export const SUEZ_TO_GULF: Waypoint[] = [
  SUEZ_S,
  wp(35.5, 27.0),
  wp(39.5, 18.0),
  BAB_EL_MANDEB,
  GULF_OF_ADEN,
  wp(58.0, 16.0),
  HORMUZ,
  wp(51.0, 28.0),
  wp(49.0, 29.6),
];

export const BLACK_SEA_TO_MED: Waypoint[] = [
  wp(31.5, 45.5),
  wp(30.5, 43.5),
  wp(29.5, 41.5),
  BOSPHORUS,
  MARMARA_W,
  DARDANELLES,
  AEGEAN_S,
];

export const TURKEY_TO_EGYPT: Waypoint[] = [
  wp(33.5, 35.5),
  wp(32.0, 33.5),
  wp(30.5, 31.7),
];

/* ─────────── Reusable transition fragments ─────────── */

/** Bosphorus passage — used when departing/arriving at a Marmara port
 *  to/from Black Sea. Includes the actual strait points but NOT the
 *  Marmara port itself. */
const BOSPHORUS_LEG: Waypoint[] = [wp(29.5, 41.5), BOSPHORUS];

/** Dardanelles passage — Marmara to Aegean. */
const DARDANELLES_LEG: Waypoint[] = [DARDANELLES, AEGEAN_S];

/** Kerch passage — Sea of Azov ↔ Black Sea. */
const KERCH_LEG: Waypoint[] = [KERCH];

/** Aegean → Eastern Mediterranean (between Greek islands & Turkey). */
const AEGEAN_TO_E_MED: Waypoint[] = [
  wp(27.0, 36.5),
  wp(30.0, 33.5),
];

/** Black Sea → Aegean: full Bosphorus + Marmara + Dardanelles. */
const BS_TO_AEGEAN: Waypoint[] = [
  ...BOSPHORUS_LEG,
  MARMARA_W,
  ...DARDANELLES_LEG,
];

/** Aegean → Egypt (East Med approach to Port Said area). */
const AEGEAN_TO_EGYPT: Waypoint[] = [
  wp(28.0, 35.0),
  wp(30.5, 32.5),
  wp(31.5, 31.5),
];

/* ─────────── Port classification sets ─────────── */

const ARG_PORTS = new Set(["rosario", "bahiablanca", "sanlorenzo", "timbues", "recalada"]);
const BRAZIL_PORTS = new Set([
  "santarem",
  "paranagua",
  "santos",
  "riogrande",
  "saofranciscodosul",
  "itacoatiara",
  "barcarena",
  "viladoconde",
  "recife",
  "maceio",
  "saosebastiao",
  // Amazon delta + extra Atlantic terminals
  "santana",
  "itaqui",
  "imbituba",
  "pecem",
  "suape",
  "aratu",
]);

/** Sea of Azov ports — must transit Kerch Strait to enter Black Sea.
 *  Includes Don/Volga river ports (Bagaevskaya, Balakovo) which reach
 *  the Azov/Black Sea via inland waterways; for corridor purposes they
 *  enter open water at the Azov coast. */
const AZOV_PORTS = new Set([
  "yeisk",
  "rostov",
  "azov",
  "kavkaz",
  "mariupol",
  "taganrog",
  "temryuk",
  "bagaevskaya",
  "balakovo",
]);

/** Black Sea proper — covers Ukraine/Russia/Bulgaria/Romania/Türkiye BS
 *  coasts + Danube delta ports (accessed via Sulina branch) + Georgia.
 *  Includes Sea of Azov ports (they reach open Black Sea via Kerch). */
const BLACK_SEA_PORTS = new Set([
  // Ukraine
  "mykolaiv",
  "odessa",
  "pivdennyi",
  "chornomorsk",
  "reni",
  "izmail",
  // Russia (Black Sea)
  "novorossiysk",
  "taman",
  // Bulgaria
  "varna",
  "burgas",
  // Romania
  "constanta",
  "galati",
  // Moldova (Danube delta)
  "giurgiulesti",
  // Georgia
  "batumi",
  "poti",
  // Türkiye (Black Sea coast)
  "samsun",
  "giresun",
  "trabzon",
  "karasu",
  // Sea of Azov
  ...AZOV_PORTS,
]);

/** Türkiye Marmara / Bosphorus ports — between Black Sea and Aegean. */
const MARMARA_PORTS = new Set([
  "istanbul",
  "ambarli",
  "derince",
  "gemlik",
  "bandirma",
  "tekirdag",
  "marport",
  "evyap",
]);

/** Türkiye Mediterranean / Aegean ports — Sanko/Yumurtalık/Ceyhan
 *  cluster sits on the same East Med coast as İskenderun. Adana
 *  anchors at Karataş on the Med coast for routing purposes. */
const TURKEY_MED_PORTS = new Set([
  "izmir",
  "mersin",
  "iskenderun",
  "sanko",
  "yumurtalik",
  "ceyhan",
  "toros",
  "adana",
]);

/** Egypt (Suez approach) — Mediterranean coast. */
const EGYPT_PORTS = new Set(["alexandria", "damietta", "portsaid", "sokhna"]);

/** Italy / Greece / Adriatic / West-Med — reachable via Aegean or Gibraltar. */
const ITALY_GREECE_PORTS = new Set([
  "trieste",
  "genoa",
  "ravenna",
  "piraeus",
  "thessaloniki",
  "volos",
  "split",
  "koper",
  "tarragona",
  "pozzallo",
  "algeciras",
  "molfetta",
]);

/** Atlantic Iberia — west of Gibraltar on the Atlantic side. Reachable
 *  from anywhere east of Gibraltar by transiting the strait + Gulf of
 *  Cádiz. Sevilla is upriver on the Guadalquivir but vessels do reach
 *  it; the corridor terminates at the river mouth area, then the line
 *  draws inland to the port coordinates. */
const ATLANTIC_IBERIA_PORTS = new Set(["sevilla"]);

/** Levant ports — between Türkiye Med and Egypt on the East Med coast. */
const LEVANT_PORTS = new Set(["beirut", "tripoli_lb", "tartous", "latakia"]);

/** Persian Gulf endpoint — final destination for trans-Suez voyages. */
function isUmmQasr(k: string): boolean {
  return k === "ummqasr";
}

const isAzov = (k: string) => AZOV_PORTS.has(k);
const isBlackSea = (k: string) => BLACK_SEA_PORTS.has(k);
const isMarmara = (k: string) => MARMARA_PORTS.has(k);
const isTurkeyMed = (k: string) => TURKEY_MED_PORTS.has(k);
const isEgypt = (k: string) => EGYPT_PORTS.has(k);
const isItalyGreece = (k: string) => ITALY_GREECE_PORTS.has(k);
const isLevant = (k: string) => LEVANT_PORTS.has(k);
const isAtlanticIberia = (k: string) => ATLANTIC_IBERIA_PORTS.has(k);

/** Med → Gibraltar → Gulf of Cádiz approach. Reused by every corridor
 *  that ends in Atlantic Iberia. The final waypoint sits at the
 *  Guadalquivir river mouth (Sanlúcar de Barrameda) so the line
 *  enters the river from the sea before drawing inland to the port. */
const MED_TO_ATLANTIC_IBERIA: Waypoint[] = [
  wp(0.0, 36.2),
  GIBRALTAR,
  wp(-6.3, 36.78, "Guadalquivir Mouth"),
];

/**
 * Pick a corridor between two ports. Returns an ordered list of
 * waypoints to insert between origin and destination. Empty array =
 * straight great-circle line is fine (rare — mostly used for
 * coast-to-coast within the same enclosed basin). Single midpoint
 * fallback is the worst case — used only when no rule matches.
 *
 * Direction-symmetric where possible: the function tries the (o,d)
 * branch first, then the (d,o) branch with the waypoint list reversed.
 */
export function selectCorridor(
  originKey: string,
  destKey: string,
  originLonLat: [number, number],
  destLonLat: [number, number]
): Waypoint[] {
  // First try the forward direction; if no match, try reverse and
  // reverse the resulting waypoint list so it threads correctly back.
  const fwd = pickForward(originKey, destKey);
  if (fwd) return fwd;
  const rev = pickForward(destKey, originKey);
  if (rev) return [...rev].reverse();
  // Fallback — single midpoint between origin and destination.
  const [ox, oy] = originLonLat;
  const [dx, dy] = destLonLat;
  if (!Number.isFinite(ox) || !Number.isFinite(dx)) return [];
  return [wp((ox + dx) / 2, (oy + dy) / 2)];
}

function pickForward(o: string, d: string): Waypoint[] | null {
  /* ─────────── Argentina / Brazil → elsewhere ─────────── */

  if (ARG_PORTS.has(o) && isUmmQasr(d)) {
    return [...ARG_TO_GIB, ...MED_TO_SUEZ, ...SUEZ_TO_GULF];
  }
  if (ARG_PORTS.has(o) && isItalyGreece(d)) {
    return [...ARG_TO_GIB, wp(5.0, 38.0), wp(9.0, 42.5)];
  }
  if (ARG_PORTS.has(o) && isTurkeyMed(d)) {
    return [...ARG_TO_GIB, ...MED_TO_SUEZ.slice(0, 2)];
  }
  if (ARG_PORTS.has(o) && isEgypt(d)) {
    return [...ARG_TO_GIB, ...MED_TO_SUEZ];
  }
  if (ARG_PORTS.has(o) && isBlackSea(d)) {
    return [
      ...ARG_TO_GIB,
      ...MED_TO_SUEZ.slice(0, 2),
      ...[...BS_TO_AEGEAN].reverse(),
    ];
  }
  if (ARG_PORTS.has(o) && isMarmara(d)) {
    return [
      ...ARG_TO_GIB,
      ...MED_TO_SUEZ.slice(0, 2),
      AEGEAN_S,
      DARDANELLES,
    ];
  }

  if (BRAZIL_PORTS.has(o) && isUmmQasr(d)) {
    return [...BRAZIL_TO_GIB, ...MED_TO_SUEZ, ...SUEZ_TO_GULF];
  }
  if (BRAZIL_PORTS.has(o) && isTurkeyMed(d)) {
    return [...BRAZIL_TO_GIB, ...MED_TO_SUEZ.slice(0, 2)];
  }
  if (BRAZIL_PORTS.has(o) && isEgypt(d)) {
    return [...BRAZIL_TO_GIB, ...MED_TO_SUEZ];
  }
  if (BRAZIL_PORTS.has(o) && isItalyGreece(d)) {
    return [...BRAZIL_TO_GIB, wp(5.0, 38.0), wp(9.0, 42.5)];
  }
  if (BRAZIL_PORTS.has(o) && isBlackSea(d)) {
    return [
      ...BRAZIL_TO_GIB,
      ...MED_TO_SUEZ.slice(0, 2),
      ...[...BS_TO_AEGEAN].reverse(),
    ];
  }
  if (BRAZIL_PORTS.has(o) && isMarmara(d)) {
    return [
      ...BRAZIL_TO_GIB,
      ...MED_TO_SUEZ.slice(0, 2),
      AEGEAN_S,
      DARDANELLES,
    ];
  }

  /* ─────────── Black Sea ↔ Black Sea ─────────── */

  if (isBlackSea(o) && isBlackSea(d)) {
    // Same basin — Kerch only when one (and only one) end is in Sea of Azov.
    const oAzov = isAzov(o);
    const dAzov = isAzov(d);
    if (oAzov !== dAzov) return [...KERCH_LEG];
    return []; // direct great-circle stays in water for BS-BS / Azov-Azov
  }

  /* ─────────── Black Sea ↔ Marmara (via Bosphorus) ─────────── */

  if (isBlackSea(o) && isMarmara(d)) {
    return isAzov(o) ? [...KERCH_LEG, ...BOSPHORUS_LEG] : [...BOSPHORUS_LEG];
  }

  /* ─────────── Black Sea ↔ Aegean / Türkiye Med / Egypt / Levant / Iraq ─────────── */

  if (isBlackSea(o) && isTurkeyMed(d)) {
    const head = isAzov(o) ? [...KERCH_LEG] : [];
    return [...head, ...BS_TO_AEGEAN, ...AEGEAN_TO_E_MED];
  }
  if (isBlackSea(o) && isEgypt(d)) {
    const head = isAzov(o) ? [...KERCH_LEG] : [];
    return [...head, ...BS_TO_AEGEAN, ...AEGEAN_TO_EGYPT];
  }
  if (isBlackSea(o) && isLevant(d)) {
    const head = isAzov(o) ? [...KERCH_LEG] : [];
    return [...head, ...BS_TO_AEGEAN, wp(28.0, 35.0), wp(33.0, 34.5)];
  }
  if (isBlackSea(o) && isItalyGreece(d)) {
    const head = isAzov(o) ? [...KERCH_LEG] : [];
    return [...head, ...BS_TO_AEGEAN, wp(22.0, 38.0), wp(18.0, 38.5)];
  }
  if (isBlackSea(o) && isAtlanticIberia(d)) {
    const head = isAzov(o) ? [...KERCH_LEG] : [];
    return [
      ...head,
      ...BS_TO_AEGEAN,
      wp(22.0, 37.0),
      wp(16.0, 37.0),
      wp(8.0, 37.0),
      ...MED_TO_ATLANTIC_IBERIA,
    ];
  }
  if (isBlackSea(o) && isUmmQasr(d)) {
    const head = isAzov(o) ? [...KERCH_LEG] : [];
    return [...head, ...BS_TO_AEGEAN, ...MED_TO_SUEZ.slice(2), ...SUEZ_TO_GULF];
  }

  /* ─────────── Marmara ↔ Mediterranean / Egypt / Iraq ─────────── */

  if (isMarmara(o) && isItalyGreece(d)) {
    return [...DARDANELLES_LEG, wp(22.0, 38.0), wp(18.0, 38.5)];
  }
  if (isMarmara(o) && isTurkeyMed(d)) {
    return [...DARDANELLES_LEG, ...AEGEAN_TO_E_MED];
  }
  if (isMarmara(o) && isEgypt(d)) {
    return [...DARDANELLES_LEG, ...AEGEAN_TO_EGYPT];
  }
  if (isMarmara(o) && isLevant(d)) {
    return [...DARDANELLES_LEG, wp(28.0, 35.0), wp(33.0, 34.5)];
  }
  if (isMarmara(o) && isUmmQasr(d)) {
    return [...DARDANELLES_LEG, ...MED_TO_SUEZ.slice(2), ...SUEZ_TO_GULF];
  }
  if (isMarmara(o) && isAtlanticIberia(d)) {
    return [
      ...DARDANELLES_LEG,
      wp(22.0, 37.0),
      wp(16.0, 37.0),
      wp(8.0, 37.0),
      ...MED_TO_ATLANTIC_IBERIA,
    ];
  }

  /* ─────────── Marmara ↔ Marmara ─────────── */

  if (isMarmara(o) && isMarmara(d)) return []; // same basin — direct

  /* ─────────── Türkiye Med → Türkiye Med / Egypt / Italy / Iraq / Levant ─────────── */

  if (isTurkeyMed(o) && isTurkeyMed(d)) return []; // same coast
  if (isTurkeyMed(o) && d === "alexandria") {
    return [...TURKEY_TO_EGYPT];
  }
  if (isTurkeyMed(o) && isEgypt(d)) {
    return [...TURKEY_TO_EGYPT];
  }
  if (isTurkeyMed(o) && isLevant(d)) return [wp(35.5, 35.0)];
  if (isTurkeyMed(o) && isItalyGreece(d)) {
    return [wp(28.0, 36.0), wp(23.0, 36.5), wp(18.0, 37.0)];
  }
  if (isTurkeyMed(o) && isUmmQasr(d)) {
    return [
      ...TURKEY_TO_EGYPT,
      wp(33.0, 31.5),
      ...SUEZ_TO_GULF.slice(2),
    ];
  }
  if (isTurkeyMed(o) && isAtlanticIberia(d)) {
    return [
      wp(30.0, 35.0),
      wp(22.0, 36.0),
      wp(16.0, 37.0),
      wp(8.0, 37.0),
      ...MED_TO_ATLANTIC_IBERIA,
    ];
  }

  /* ─────────── Levant ↔ within Levant / Egypt ─────────── */

  if (isLevant(o) && isLevant(d)) return []; // same coast
  if (isLevant(o) && isEgypt(d)) return [wp(34.5, 33.0), wp(31.5, 31.5)];

  /* ─────────── Egypt ↔ Egypt / Italy / Iraq ─────────── */

  if (isEgypt(o) && isEgypt(d)) return []; // same coast
  if (isEgypt(o) && isItalyGreece(d)) {
    return [wp(28.0, 33.0), wp(22.0, 36.0), wp(18.0, 37.0)];
  }
  if (isEgypt(o) && isUmmQasr(d)) {
    return [...SUEZ_TO_GULF];
  }
  if (isEgypt(o) && isAtlanticIberia(d)) {
    return [
      wp(28.0, 33.5),
      wp(20.0, 35.5),
      wp(12.0, 37.0),
      wp(4.0, 37.5),
      ...MED_TO_ATLANTIC_IBERIA,
    ];
  }

  /* ─────────── Italy/Greece ↔ Italy/Greece ─────────── */

  if (isItalyGreece(o) && isItalyGreece(d)) return []; // West/Mid Med direct
  if (isItalyGreece(o) && isAtlanticIberia(d)) {
    return [wp(5.0, 38.0), wp(-2.0, 36.5), ...MED_TO_ATLANTIC_IBERIA];
  }

  return null;
}
