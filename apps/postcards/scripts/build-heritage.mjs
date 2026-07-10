// Build the UNESCO World Heritage Sites dataset from Wikidata (CC0) — the
// "historic sites" category behind per-country coverage %. Aggregator-only
// (Constitution I): we vendor a named, openly-licensed dataset with provenance;
// the app authors nothing.
//
// Output: public/reference/heritage.json
//   [{ id, name, countryIso2, lat, lon, category }, ...]
//
// Run: node scripts/build-heritage.mjs        (needs network to query.wikidata.org)
//
// NOTE: this could not run in the sandbox that first scaffolded the feature —
// query.wikidata.org is blocked there by the network policy. Run it on a machine
// with open network access. Until then, scripts/build-heritage-seed.mjs ships a
// curated subset so the feature works; running THIS script overwrites it with the
// complete list. See docs/CATEGORIES-HANDOFF.md for the full plan.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ENDPOINT = "https://query.wikidata.org/sparql";

// World Heritage Sites (heritage designation P1435 = Q9259), with the country's
// ISO 3166-1 alpha-2 code (P297) and coordinates (P625). One row per site;
// sites spanning multiple countries yield one row per country (fine — they count
// in each). The category (cultural/natural/mixed) comes from criteria when present.
const QUERY = `
SELECT ?site ?siteLabel ?iso ?coord WHERE {
  ?site wdt:P1435 wd:Q9259 .
  ?site wdt:P17 ?country . ?country wdt:P297 ?iso .
  OPTIONAL { ?site wdt:P625 ?coord . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`;

const res = await fetch(`${ENDPOINT}?query=${encodeURIComponent(QUERY)}`, {
  headers: {
    Accept: "application/sparql-results+json",
    // Wikidata asks for a descriptive UA with contact info.
    "User-Agent": "Postcards/1.0 (https://github.com/davd-gzl/Postcards) heritage dataset build",
  },
});
if (!res.ok) throw new Error(`Wikidata query failed: ${res.status} ${res.statusText}`);
const json = await res.json();

/** Parse a WKT "Point(lon lat)" literal into {lat, lon}, or null. */
function parsePoint(wkt) {
  const m = /Point\(([-\d.]+)\s+([-\d.]+)\)/.exec(wkt ?? "");
  return m ? { lon: Number(m[1]), lat: Number(m[2]) } : null;
}

const seen = new Set();
const out = [];
for (const b of json.results.bindings) {
  const qid = b.site?.value?.split("/").pop();
  const iso = b.iso?.value?.toUpperCase();
  const name = b.siteLabel?.value;
  if (!qid || !iso || !name) continue;
  const key = `${qid}:${iso}`;
  if (seen.has(key)) continue; // dedupe repeated coord rows
  seen.add(key);
  const pt = parsePoint(b.coord?.value);
  out.push({
    id: qid,
    name,
    countryIso2: iso,
    lat: pt ? Number(pt.lat.toFixed(4)) : 0,
    lon: pt ? Number(pt.lon.toFixed(4)) : 0,
  });
}
out.sort((a, b) => a.name.localeCompare(b.name));

const dir = dirname(fileURLToPath(import.meta.url));
const path = join(dir, "..", "public", "reference", "heritage.json");
writeFileSync(path, JSON.stringify(out));
const countries = new Set(out.map((s) => s.countryIso2)).size;
console.log(`wrote ${out.length} World Heritage Sites across ${countries} countries -> ${path}`);
