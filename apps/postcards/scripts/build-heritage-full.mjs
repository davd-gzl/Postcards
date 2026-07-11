// Build the FULL UNESCO World Heritage List -> public/reference/heritage.json
//
// Source (aggregator-only, Constitution I — the app authors no world facts):
//   UNESCO World Heritage Centre, official World Heritage List
//   (https://whc.unesco.org/en/list/ — syndication data, field names match the
//   whc.unesco.org whc-sites export: name_en, iso_codes, category, coordinates,
//   id_no, date_inscribed, …). 1,248 sites, complete through the 47th session
//   of the World Heritage Committee (July 2025).
// License:
//   CC BY-SA 3.0 IGO — UNESCO World Heritage Centre publishes the List under
//   Creative Commons Attribution-ShareAlike 3.0 IGO (https://whc.unesco.org/en/licenses/6).
//   Attribution: © UNESCO World Heritage Centre, https://whc.unesco.org
// Retrieved: 2026-07-11, via the public GitHub mirror of the UNESCO data
//   https://raw.githubusercontent.com/BayoatHT/solve_cia/main/proj_004_cia/___proj_heritage/_raw_data/json/all_world_heritage.json
//   (whc.unesco.org itself is unreachable from the build sandbox). The raw
//   payload is vendored gzipped at scripts/data/whc-sites-2025.json.gz so this
//   build is reproducible offline; spot-checked against the official
//   whc-sites CSV export (2023 edition) for coordinate fidelity.
//
// Output: public/reference/heritage.json — an array of
//   { id, name, countryIso2, lat, lon, category }
//   category ∈ cultural | natural | mixed.
//   Transnational sites emit ONE entry per country, same name, id suffixed
//   with the country code (whs-<slug>-fr, whs-<slug>-es, …), reusing the
//   site's coordinates. Sites the source ships without coordinates keep
//   lat 0 / lon 0 — the app treats (0,0) as "no coords", it never guesses.
//   Names are sanitized to inert plain text (HTML tags/entities stripped).
//
// Run: node scripts/build-heritage-full.mjs
//
// Countries are ISO 3166-1 alpha-2 from the source's iso_codes. The single
// site without any country code (Old City of Jerusalem, id_no 148 — UNESCO
// lists it under "Jerusalem (Site proposed by Jordan)", no ISO code) is
// skipped rather than assigned an invented code.

import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, "data", "whc-sites-2025.json.gz");
const OUT = join(here, "..", "public", "reference", "heritage.json");

const sites = JSON.parse(gunzipSync(readFileSync(SRC)).toString("utf8"));
if (!Array.isArray(sites) || sites.length < 1100) {
  throw new Error(`unexpected source: ${Array.isArray(sites) ? sites.length : typeof sites} entries`);
}

/** Strip HTML tags/entities the UNESCO feed sometimes embeds (e.g. <em>) — output must be inert. */
function sanitizeName(raw) {
  return String(raw)
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&(quot|apos|nbsp|ndash|mdash|rsquo|lsquo|eacute|egrave);/g, (_, e) =>
      ({ quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", eacute: "é", egrave: "è" })[e],
    )
    .replace(/\s+/g, " ")
    .trim();
}

/** Lowercase ASCII slug of a site name (diacritics folded, non-alphanumerics -> "-"). */
function slugify(name) {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[øØ]/g, "o")
    .replace(/[æÆ]/g, "ae")
    .replace(/[œŒ]/g, "oe")
    .replace(/[ßẞ]/g, "ss")
    .replace(/[đĐðÐ]/g, "d")
    .replace(/[þÞ]/g, "th")
    .replace(/[łŁ]/g, "l")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const CATEGORY = { Cultural: "cultural", Natural: "natural", Mixed: "mixed" };

const out = [];
const skipped = [];
let noCoords = 0;
let transnational = 0;

for (const s of sites) {
  const name = sanitizeName(s.name_en);
  const cat = CATEGORY[s.category];
  if (!name || !cat) throw new Error(`site ${s.id_no}: bad name/category ${JSON.stringify(s.category)}`);

  const isos = [...new Set(
    String(s.iso_codes ?? "")
      .split(",")
      .map((c) => c.trim().toUpperCase())
      .filter((c) => /^[A-Z]{2}$/.test(c)),
  )];
  if (isos.length === 0) {
    skipped.push(`${s.id_no} ${name} (no ISO country code in source)`);
    continue;
  }
  if (isos.length > 1) transnational++;

  const c = s.coordinates;
  const hasCoords = c && typeof c.lat === "number" && typeof c.lon === "number" &&
    Number.isFinite(c.lat) && Number.isFinite(c.lon);
  if (!hasCoords) noCoords++;
  const lat = hasCoords ? Number(c.lat.toFixed(4)) : 0;
  const lon = hasCoords ? Number(c.lon.toFixed(4)) : 0;

  const slug = slugify(name);
  for (const iso of isos) {
    out.push({
      id: isos.length > 1 ? `whs-${slug}-${iso.toLowerCase()}` : `whs-${slug}`,
      name,
      countryIso2: iso,
      lat,
      lon,
      category: cat,
      idNo: String(s.id_no), // temporary, for collision fixes below
    });
  }
}

// Different sites can slugify identically; disambiguate deterministically with
// the source's stable numeric id (never invented).
const counts = new Map();
for (const e of out) counts.set(e.id, (counts.get(e.id) ?? 0) + 1);
let collisions = 0;
for (const e of out) {
  if (counts.get(e.id) > 1) {
    e.id = `${e.id}-${e.idNo}`;
    collisions++;
  }
  delete e.idNo;
}

out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

// Validate before writing: unique ids, coordinate ranges, ISO codes, categories.
const ids = new Set();
for (const e of out) {
  if (ids.has(e.id)) throw new Error(`duplicate id: ${e.id}`);
  ids.add(e.id);
  if (!/^whs-[a-z0-9-]+$/.test(e.id)) throw new Error(`bad id: ${e.id}`);
  if (!/^[A-Z]{2}$/.test(e.countryIso2)) throw new Error(`bad iso: ${e.id}`);
  if (e.lat < -90 || e.lat > 90 || e.lon < -180 || e.lon > 180) throw new Error(`bad coords: ${e.id}`);
  if (!["cultural", "natural", "mixed"].includes(e.category)) throw new Error(`bad category: ${e.id}`);
  if (!e.name || /[<>]/.test(e.name)) throw new Error(`unsanitized name: ${e.id}`);
}

writeFileSync(OUT, JSON.stringify(out) + "\n");

const perCountry = new Map();
for (const e of out) perCountry.set(e.countryIso2, (perCountry.get(e.countryIso2) ?? 0) + 1);
const countryCounts = [...perCountry.entries()].sort((a, b) => b[1] - a[1]);
console.log(`wrote ${out.length} entries (${sites.length - skipped.length} sites, ${transnational} transnational) across ${perCountry.size} countries -> ${OUT}`);
console.log(`skipped: ${skipped.length ? skipped.join("; ") : "none"}`);
console.log(`sites without coordinates in source (kept at 0,0): ${noCoords}`);
console.log(`slug collisions disambiguated with UNESCO id_no: ${collisions}`);
console.log(`top countries: ${countryCounts.slice(0, 5).map(([k, v]) => `${k}=${v}`).join(" ")}; min: ${countryCounts.at(-1)?.[1]}`);
