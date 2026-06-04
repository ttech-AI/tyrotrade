const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);
    const name = url.searchParams.get("name");
    const imo = url.searchParams.get("imo");

    if (!name || !imo) {
      return json({ error: "name ve imo zorunlu" }, 400);
    }

    // 1. Search
    // myshiptracking's name search treats hyphens/underscores literally and
    // returns ZERO results for names like "BURCUM-I" (even though the vessel
    // is listed as "BURCUM I"). Normalise separators to spaces for the query;
    // the original `name` is still used for slug matching + the echoed reply.
    const searchName = name.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
    const searchUrl = `https://www.myshiptracking.com/vessels?name=${encodeURIComponent(searchName)}&side=false`;
    const searchHtml = await fetchHtml(searchUrl);

    const imoRegex = new RegExp(`/vessels/[^"\\s]*-imo-${imo}[^"\\s]*`, "g");
    const imoMatches = [...searchHtml.matchAll(imoRegex)];

    // Fallback: prefer exact name slug match (e.g. "maverick-mmsi-" not "millenium-maverick-mmsi-")
    const nameSlug = name.toLowerCase().replace(/\s+/g, "-");
    const exactNameRegex = new RegExp(`/vessels/${nameSlug}-mmsi-[^"\\s]*`, "g");
    const exactMatches = [...searchHtml.matchAll(exactNameRegex)];

    // Last resort: first vessel result in the list
    const anyVesselRegex = /\/vessels\/[^"\s]+-imo-[\d]+/g;
    const anyMatches = [...searchHtml.matchAll(anyVesselRegex)];

    const match = imoMatches[0]?.[0] ?? exactMatches[0]?.[0] ?? anyMatches[0]?.[0] ?? null;

    if (!match) {
      return json({ error: "Gemi bulunamadı", imo, name }, 404);
    }

    // 2. Vessel page
    const vesselUrl = "https://www.myshiptracking.com" + match;
    const vesselHtml = await fetchHtml(vesselUrl);

    // 3. Parse position
    const posMatch = vesselHtml.match(
      /canvas_map_generate\([^,]+,\s*\d+,\s*(-?\d+\.\d+),\s*(-?\d+\.\d+),\s*([\d.]+),\s*([\d.]+)/
    );

    if (!posMatch) {
      return json({ error: "Konum verisi yok", imo, name }, 404);
    }

    const lat = parseFloat(posMatch[1]);
    const lon = parseFloat(posMatch[2]);
    const cog = parseFloat(posMatch[3]);
    const sog = parseFloat(posMatch[4]);

    const mmsiMatch = vesselHtml.match(/>MMSI<\/th>\s*<td>([\d]{5,12})/);
    const flagMatch = vesselHtml.match(/Flag<\/th>[\s\S]*?title="([^"]{3,30})"/);
    const dwtMatch = vesselHtml.match(/>DWT<\/th>\s*<td>([\d,]+)\s*<small>Tons/);
    const statusMatch = vesselHtml.match(
      /(Under way[^<]{0,20}|Moored|At anchor|Stopped|Not under command)/
    );

    // Position Received — the actual AIS report time (UTC), distinct from
    // `updatedAt` (our scrape time, always "now"). myshiptracking renders it
    // as title="YYYY-MM-DD HH:MM" on the "Position Received" table row, and
    // again in the prose "as reported on <strong>...</strong> by AIS". The
    // table row is canonical; prose is the fallback. Frontend uses this to
    // drop positions older than the staleness threshold.
    const posTimeMatch =
      vesselHtml.match(
        /Position Received<\/th>\s*<td>[\s\S]*?title="(\d{4}-\d{2}-\d{2} \d{2}:\d{2})"/
      ) ||
      vesselHtml.match(
        /as reported on <strong>(\d{4}-\d{2}-\d{2} \d{2}:\d{2})<\/strong>/
      );
    const positionReceivedAt = posTimeMatch
      ? new Date(posTimeMatch[1].replace(" ", "T") + ":00Z").toISOString()
      : null;

    return json({
      name,
      imo,
      lat,
      lon,
      cog,
      sog,
      mmsi: mmsiMatch?.[1] ?? null,
      flag: flagMatch?.[1] ?? null,
      dwt: dwtMatch?.[1] ?? null,
      status: statusMatch?.[1] ?? null,
      vesselUrl,
      positionReceivedAt,
      updatedAt: new Date().toISOString(),
    });
  },
};

async function fetchHtml(url) {
  const res = await fetch(url, { headers: HEADERS });
  return res.text();
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
