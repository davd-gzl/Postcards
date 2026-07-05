// Build the bundled reference data from openly-licensed sources:
//  - public/reference/cities.json        GeoNames cities >= 15k (all-the-cities, CC BY 4.0)
//  - public/reference/subdivisions.json  first-level regions (GeoNames admin-1 taxonomy),
//                                         named by nearest region centroid from the dr5hn
//                                         countries-states-cities dataset (ODbL/OpenDB).
// Region names are matched GEOGRAPHICALLY (nearest centroid), not by code, because GeoNames
// admin codes rarely equal ISO/other code schemes. Aggregator-only: reshapes existing data.
//
// Run: node scripts/build-reference.mjs  (from apps/placebeen)
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const allCities = require("all-the-cities");
const { State } = require("country-state-city");

const MIN_POPULATION = 15000;

// France: GeoNames admin-1 = the 13 metropolitan regions (dr5hn lists departments),
// so name them directly by INSEE region code.
const FR_REGION_NAMES = {
  11: "Île-de-France", 24: "Centre-Val de Loire", 27: "Bourgogne-Franche-Comté",
  28: "Normandie", 32: "Hauts-de-France", 44: "Grand Est", 52: "Pays de la Loire",
  53: "Bretagne", 75: "Nouvelle-Aquitaine", 76: "Occitanie", 84: "Auvergne-Rhône-Alpes",
  93: "Provence-Alpes-Côte d'Azur", 94: "Corse",
};

// dr5hn states per country, with usable centroids.
const statesByCountry = new Map();
function statesOf(cc) {
  if (!statesByCountry.has(cc)) {
    const list = (State.getStatesOfCountry(cc) || [])
      .map((s) => ({ name: s.name, lat: parseFloat(s.latitude), lon: parseFloat(s.longitude) }))
      .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lon) && !(s.lat === 0 && s.lon === 0));
    statesByCountry.set(cc, list);
  }
  return statesByCountry.get(cc);
}

const here = dirname(fileURLToPath(import.meta.url));
const refDir = join(here, "..", "public", "reference");

// --- Cities + per-region centroid accumulation ---
const cities = [];
const seen = new Set();
const regions = new Map(); // "CC-code" -> { cc, adminCode, sumLat, sumLon, n }
for (const c of allCities) {
  if (!c.population || c.population < MIN_POPULATION || !c.cityId || seen.has(c.cityId)) continue;
  const [lon, lat] = c.loc.coordinates;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
  seen.add(c.cityId);
  const subId = c.adminCode ? `${c.country}-${c.adminCode}` : null;
  if (subId) {
    let r = regions.get(subId);
    if (!r) regions.set(subId, (r = { cc: c.country, adminCode: String(c.adminCode), sumLat: 0, sumLon: 0, n: 0 }));
    r.sumLat += lat;
    r.sumLon += lon;
    r.n++;
  }
  cities.push({
    id: String(c.cityId), name: c.name, countryIso2: c.country, subdivisionId: subId,
    lat: Math.round(lat * 1e4) / 1e4, lon: Math.round(lon * 1e4) / 1e4, population: c.population,
  });
}
cities.sort((a, b) => b.population - a.population);
writeFileSync(join(refDir, "cities.json"), JSON.stringify(cities) + "\n");

// --- Name each region by nearest state centroid (or FR override) ---
function nearestName(cc, lat, lon) {
  let best = null, bestD = Infinity;
  for (const s of statesOf(cc)) {
    const d = (s.lat - lat) ** 2 + (s.lon - lon) ** 2;
    if (d < bestD) { bestD = d; best = s.name; }
  }
  return best;
}

let named = 0;
const subdivisions = [];
for (const [id, r] of regions) {
  const cLat = r.sumLat / r.n, cLon = r.sumLon / r.n;
  const name = r.cc === "FR" ? FR_REGION_NAMES[r.adminCode] : nearestName(r.cc, cLat, cLon);
  if (name) named++;
  subdivisions.push({ id, countryIso2: r.cc, name: name ?? `${r.cc} region ${r.adminCode}` });
}
subdivisions.sort((a, b) => a.id.localeCompare(b.id));
writeFileSync(join(refDir, "subdivisions.json"), JSON.stringify(subdivisions) + "\n");

console.log(`cities: ${cities.length} | subdivisions: ${subdivisions.length}`);
console.log(`named: ${named}/${subdivisions.length} (${Math.round((named / subdivisions.length) * 100)}%)`);
console.log(`countries with regions: ${new Set(subdivisions.map((s) => s.countryIso2)).size}`);
console.log(`Paris subId: ${cities.find((c) => c.id === "2988507")?.subdivisionId}`);