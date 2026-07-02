// Build the bundled city gazetteer (public/reference/cities.json) from the
// GeoNames-derived `all-the-cities` package (CC BY 4.0). Aggregator-only:
// this script filters and reshapes — it never invents records.
//
// Run: node scripts/build-cities.mjs  (from apps/placebeen)
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const allCities = require("all-the-cities");

const MIN_POPULATION = 15000; // GeoNames "cities15000" tier

// GeoNames uses INSEE codes for French first-level regions (ADM1).
// Map them to the ISO 3166-2:FR ids used by our subdivisions dataset.
const FR_INSEE_TO_ISO = {
  11: "FR-IDF",
  24: "FR-CVL",
  27: "FR-BFC",
  28: "FR-NOR",
  32: "FR-HDF",
  44: "FR-GES",
  52: "FR-PDL",
  53: "FR-BRE",
  75: "FR-NAQ",
  76: "FR-OCC",
  84: "FR-ARA",
  93: "FR-PAC",
  94: "FR-20R",
};

// Sanity check the FR mapping against two well-known cities before trusting it.
const paris = allCities.find((c) => c.cityId === 2988507);
const lyon = allCities.find((c) => c.cityId === 2996944);
if (paris?.adminCode !== "11" || lyon?.adminCode !== "84") {
  throw new Error("GeoNames FR admin codes changed — refusing to write a wrong region mapping.");
}

const out = [];
const seen = new Set();
for (const c of allCities) {
  if (!c.population || c.population < MIN_POPULATION) continue;
  if (!c.cityId || seen.has(c.cityId)) continue;
  const [lon, lat] = c.loc.coordinates;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
  seen.add(c.cityId);
  out.push({
    id: String(c.cityId), // GeoNames id — the stable public identifier
    name: c.name,
    countryIso2: c.country,
    subdivisionId: c.country === "FR" ? (FR_INSEE_TO_ISO[c.adminCode] ?? null) : null,
    lat: Math.round(lat * 1e4) / 1e4,
    lon: Math.round(lon * 1e4) / 1e4,
    population: c.population,
  });
}
out.sort((a, b) => b.population - a.population);

const here = dirname(fileURLToPath(import.meta.url));
const dest = join(here, "..", "public", "reference", "cities.json");
writeFileSync(dest, JSON.stringify(out) + "\n");

const fr = out.filter((c) => c.countryIso2 === "FR");
console.log(`wrote ${out.length} cities (>=${MIN_POPULATION} pop) to ${dest}`);
console.log(`FR cities: ${fr.length}, with region mapped: ${fr.filter((c) => c.subdivisionId).length}`);
console.log(`countries covered: ${new Set(out.map((c) => c.countryIso2)).size}`);
