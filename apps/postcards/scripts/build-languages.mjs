// Build per-country data from `world-countries` (ODbL): spoken languages (for
// Wikivoyage phrasebook/alphabet links) and the COMMON country name (the correct
// Wikivoyage article title — "Russia", not the ISO-official "Russian Federation").
// Aggregator-only (Constitution I): we vendor a named, openly-licensed dataset
// with provenance; the app authors nothing.
//
// Outputs:
//   public/reference/languages.json     { "FR": [{ code: "fra", name: "French" }], ... }
//   public/reference/article-names.json { "RU": "Russia", "MD": "Moldova", ... }
//
// Run: node scripts/build-languages.mjs   (offline — reads the local npm package)

import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const countries = require("world-countries");

const out = {};
const names = {};
for (const c of countries) {
  const iso2 = c.cca2;
  if (!iso2) continue;
  if (c.languages) {
    const langs = Object.entries(c.languages).map(([code, name]) => ({ code, name }));
    if (langs.length) out[iso2] = langs;
  }
  if (c.name?.common) names[iso2] = c.name.common;
}

const dir = dirname(fileURLToPath(import.meta.url));
const refDir = join(dir, "..", "public", "reference");
writeFileSync(join(refDir, "languages.json"), JSON.stringify(out));
writeFileSync(join(refDir, "article-names.json"), JSON.stringify(names));
const langCount = new Set(Object.values(out).flat().map((l) => l.name)).size;
console.log(
  `wrote languages for ${Object.keys(out).length} countries (${langCount} distinct) + ` +
    `${Object.keys(names).length} common names -> ${refDir}`,
);
