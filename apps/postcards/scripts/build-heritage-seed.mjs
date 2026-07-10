// Seed subset of UNESCO World Heritage Sites, written to public/reference/heritage.json.
//
// The full dataset (~1200 sites) is fetched from Wikidata by build-heritage.mjs,
// which needs network access to query.wikidata.org (blocked in some sandboxes).
// Until that runs, this curated, verifiable subset of well-known sites makes the
// monuments feature real: they show on the map, in search, and in per-country
// coverage. Aggregator-only (Constitution I): these are real UNESCO WHS facts
// (name / country / coordinates), transcribed with provenance — nothing invented.
// Running build-heritage.mjs later overwrites this file with the complete set.
//
// Run: node scripts/build-heritage-seed.mjs

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/** [name, ISO2, lat, lon, category] — category: cultural | natural | mixed */
const SITES = [
  ["Taj Mahal", "IN", 27.1751, 78.0421, "cultural"],
  ["Great Wall of China", "CN", 40.4319, 116.5704, "cultural"],
  ["Imperial Palaces (Forbidden City)", "CN", 39.9163, 116.3972, "cultural"],
  ["Machu Picchu", "PE", -13.1631, -72.545, "mixed"],
  ["City of Cusco", "PE", -13.5167, -71.9789, "cultural"],
  ["Historic Centre of Rome (Colosseum)", "IT", 41.8902, 12.4922, "cultural"],
  ["Venice and its Lagoon", "IT", 45.4408, 12.3155, "cultural"],
  ["Archaeological Areas of Pompeii", "IT", 40.7497, 14.4869, "cultural"],
  ["Works of Antoni Gaudí (Sagrada Família)", "ES", 41.4036, 2.1744, "cultural"],
  ["Alhambra, Generalife and Albayzín", "ES", 37.1761, -3.5881, "cultural"],
  ["Mont-Saint-Michel and its Bay", "FR", 48.6361, -1.5115, "cultural"],
  ["Palace and Park of Versailles", "FR", 48.8049, 2.1204, "cultural"],
  ["Stonehenge, Avebury and Associated Sites", "GB", 51.1789, -1.8262, "cultural"],
  ["Tower of London", "GB", 51.5081, -0.0759, "cultural"],
  ["Cologne Cathedral", "DE", 50.9413, 6.9583, "cultural"],
  ["Acropolis, Athens", "GR", 37.9715, 23.7267, "cultural"],
  ["Memphis and its Necropolis (Pyramids of Giza)", "EG", 29.9792, 31.1342, "cultural"],
  ["Nubian Monuments (Abu Simbel)", "EG", 22.3372, 31.6258, "cultural"],
  ["Historic Areas of Istanbul (Hagia Sophia)", "TR", 41.0086, 28.98, "cultural"],
  ["Göreme National Park and the Rock Sites of Cappadocia", "TR", 38.6431, 34.8286, "mixed"],
  ["Petra", "JO", 30.3285, 35.4444, "cultural"],
  ["Kremlin and Red Square, Moscow", "RU", 55.752, 37.6175, "cultural"],
  ["Medina of Fez", "MA", 34.0654, -4.9738, "cultural"],
  ["Robben Island", "ZA", -33.8069, 18.3667, "cultural"],
  ["Sydney Opera House", "AU", -33.8568, 151.2153, "cultural"],
  ["Great Barrier Reef", "AU", -18.2871, 147.6992, "natural"],
  ["Historic Monuments of Ancient Kyoto (Himeji nearby)", "JP", 35.0116, 135.7681, "cultural"],
  ["Itsukushima Shinto Shrine", "JP", 34.2959, 132.3199, "cultural"],
  ["Chichen-Itza", "MX", 20.6829, -88.5686, "cultural"],
  ["Pre-Hispanic City of Teotihuacan", "MX", 19.6925, -98.8438, "cultural"],
  ["Grand Canyon National Park", "US", 36.1069, -112.1129, "natural"],
  ["Statue of Liberty", "US", 40.6892, -74.0445, "cultural"],
  ["Yellowstone National Park", "US", 44.428, -110.5885, "natural"],
  ["Iguaçu National Park", "BR", -25.6953, -54.4367, "natural"],
  ["Angkor", "KH", 13.4125, 103.867, "cultural"],
  ["Borobudur Temple Compounds", "ID", -7.6079, 110.2038, "cultural"],
  ["Kathmandu Valley", "NP", 27.7024, 85.3079, "cultural"],
  ["Ha Long Bay", "VN", 20.9101, 107.1839, "natural"],
  ["Rapa Nui National Park (Easter Island)", "CL", -27.1127, -109.3497, "cultural"],
  ["Galápagos Islands", "EC", -0.9538, -90.9656, "natural"],
  ["Serengeti National Park", "TZ", -2.3333, 34.8333, "natural"],
  ["Bagan", "MM", 21.1717, 94.8585, "cultural"],
];

const slug = (s) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const out = SITES.map(([name, iso2, lat, lon, category]) => ({
  id: `whs-${slug(name)}`,
  name,
  countryIso2: iso2,
  lat,
  lon,
  category,
})).sort((a, b) => a.name.localeCompare(b.name));

const dir = dirname(fileURLToPath(import.meta.url));
const path = join(dir, "..", "public", "reference", "heritage.json");
writeFileSync(path, JSON.stringify(out));
const countries = new Set(out.map((s) => s.countryIso2)).size;
console.log(`wrote ${out.length} seed World Heritage Sites across ${countries} countries -> ${path}`);
