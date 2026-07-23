// Build the bundled RAILWAY STATION reference data from Wikidata (CC0).
//
//   public/reference/railways.json   mainline/intercity railway stations
//
// WHY Wikidata (CC0): it is the only global source that maps 1:1 onto this app's
// reference shape — a stable id (QID), a name, a country (P17 → ISO 3166-1 alpha-2
// via P297) and coordinates (P625) — with NO attribution or share-alike burden.
// Aggregator-only (Constitution I): this script RESHAPES existing, openly-licensed
// facts; it invents nothing. Provenance is recorded in the emitted file.
//
// THRESHOLDING to a few-thousand MAINLINE set (not hundreds of thousands of
// tram/metro stops): we take instances of *railway station* (Q55488) EXACTLY — its
// metro/tram/light-rail siblings are DIFFERENT classes, so they're already excluded
// — require a coordinate (P625), drop demolished/disused (P5817/P576), and keep only
// stations notable enough to carry a Wikipedia sitelink OR a UIC/IBNR code (P954).
// That lands in the low-thousands globally and biases toward significant stations.
//
// NOTE: query.wikidata.org must be reachable to run this (it was blocked by the
// egress policy in the authoring sandbox). Run it where Wikidata is reachable:
//
//   node scripts/build-railways.mjs   (from apps/postcards)
//
// Then the file is bundled under public/reference/ like cities/airports and loaded
// through the same reference-data seam.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "reference", "railways.json");
const ENDPOINT = "https://query.wikidata.org/sparql";
const PAGE = 5000; // rows per request; paginate with LIMIT/OFFSET to avoid timeouts
const UA = "Postcards-reference-build/1.0 (local-first travel journal; contact via repo)";

// One page of stations. Filters, in order: exactly a railway station (Q55488);
// has coordinates; not marked demolished/disused; has a country; AND (has ≥1
// Wikipedia sitelink OR a UIC/IBNR station code P954) as the notability threshold.
const query = (limit, offset) => `
SELECT ?station ?stationLabel ?iso2 ?lat ?lon WHERE {
  ?station wdt:P31 wd:Q55488 ;
           wdt:P625 ?coord ;
           wdt:P17 ?country .
  ?country wdt:P297 ?iso2 .
  FILTER NOT EXISTS { ?station wdt:P576 ?abolished. }        # dissolved/abolished date
  FILTER NOT EXISTS { ?station wdt:P5817 wd:Q56556915. }     # state of use = demolished
  FILTER NOT EXISTS { ?station wdt:P5817 wd:Q45382883. }     # state of use = disused
  FILTER( EXISTS { ?station wdt:P954 ?uic. }
          || EXISTS { ?sl schema:about ?station ; schema:isPartOf ?wiki .
                      FILTER(CONTAINS(STR(?wiki), "wikipedia.org")) } )
  BIND(geof:latitude(?coord) AS ?lat)
  BIND(geof:longitude(?coord) AS ?lon)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY ?station
LIMIT ${limit} OFFSET ${offset}`;

async function fetchPage(limit, offset) {
  const url = `${ENDPOINT}?format=json&query=${encodeURIComponent(query(limit, offset))}`;
  const res = await fetch(url, { headers: { Accept: "application/sparql-results+json", "User-Agent": UA } });
  if (!res.ok) throw new Error(`Wikidata SPARQL ${res.status} ${res.statusText}`);
  const json = await res.json();
  return json.results.bindings;
}

function main() {
  return (async () => {
    // De-dupe by QID (occasional split items) and drop unnamed rows — a place must
    // carry a label. Coordinates are numbers; ISO2 is upper-cased for the app.
    const byId = new Map();
    for (let offset = 0; ; offset += PAGE) {
      const rows = await fetchPage(PAGE, offset);
      if (!rows.length) break;
      for (const r of rows) {
        const id = r.station.value.replace("http://www.wikidata.org/entity/", "");
        const name = r.stationLabel?.value?.trim();
        // Wikidata returns the QID as the label when no English label exists — skip those.
        if (!name || name === id || byId.has(id)) continue;
        const iso2 = r.iso2.value.toUpperCase();
        const lat = Number(r.lat.value);
        const lon = Number(r.lon.value);
        if (!/^[A-Z]{2}$/.test(iso2) || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        // subdivisionId is left null for v1: railways contribute to per-COUNTRY
        // coverage immediately; region (admin-1) assignment via nearest-centroid
        // against public/reference/subdivisions.json can be layered on later, the
        // way build-reference.mjs matches city regions geographically.
        byId.set(id, { id, name, countryIso2: iso2, subdivisionId: null, lat, lon });
      }
      process.stderr.write(`  …${byId.size} stations so far\n`);
      if (rows.length < PAGE) break;
    }

    const stations = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
    const out = {
      // Provenance is part of the file (Constitution: named source + license + date).
      _source: {
        dataset: "Wikidata railway stations (instance of Q55488)",
        url: "https://query.wikidata.org/",
        license: "CC0-1.0",
        retrieved: new Date().toISOString().slice(0, 10),
        note: "Mainline stations with coordinates and a Wikipedia sitelink or UIC code; metro/tram excluded.",
      },
      stations,
    };
    writeFileSync(OUT, JSON.stringify(out));
    process.stderr.write(`Wrote ${stations.length} railway stations → ${OUT}\n`);
  })();
}

main().catch((e) => {
  process.stderr.write(String(e?.stack || e) + "\n");
  process.exitCode = 1;
});
