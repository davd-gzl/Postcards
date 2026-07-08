// Classify each ISO 3166-1 entry as a UN member state ("un") or a dependent
// territory ("territory"), from the world-countries dataset (mledoze, ODbL) —
// the same source already used for continents. Aggregator-only (Constitution I):
// we reshape the dataset's own `unMember` flag; we do not decide statehood.
//
// Output: src/lib/reference/data/sovereignty.json  { "US": "un", "HK": "territory", ... }
// Run: node scripts/build-sovereignty.mjs   (from apps/postcards)
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const world = require("world-countries");
const countries = require("i18n-iso-countries");
countries.registerLocale(require("i18n-iso-countries/langs/en.json"));

const byCca2 = new Map(world.map((c) => [c.cca2, c]));
const out = {};
for (const iso2 of Object.keys(countries.getNames("en"))) {
  if (!countries.alpha2ToNumeric(iso2)) continue; // keep the same set as buildCountries
  const c = byCca2.get(iso2);
  out[iso2] = c && c.unMember ? "un" : "territory";
}

const dir = dirname(fileURLToPath(import.meta.url));
const path = join(dir, "..", "src", "lib", "reference", "data", "sovereignty.json");
writeFileSync(path, JSON.stringify(out) + "\n");
const un = Object.values(out).filter((v) => v === "un").length;
console.log(`wrote ${Object.keys(out).length} countries (${un} UN, ${Object.keys(out).length - un} territories) -> ${path}`);
