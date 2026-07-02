import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";
import type { City, Country, ReferenceData, ReferenceProvenance, Subdivision } from "./types";
import subdivisionsData from "./data/subdivisions.json";
import provenanceData from "./data/provenance.json";
import continentsData from "./data/continents.json";

countries.registerLocale(enLocale as Parameters<typeof countries.registerLocale>[0]);

const subdivisions = subdivisionsData as Subdivision[];
const provenance = provenanceData as ReferenceProvenance[];
const continents = continentsData as Record<string, string>;

// The city gazetteer (GeoNames-derived, ~24k cities) is served as a static,
// SW-cached asset and loaded once at startup — see initReferenceData().
const CITIES_URL = `${import.meta.env.BASE_URL}reference/cities.json`;

function buildCountries(cities: City[]): Country[] {
  const names = countries.getNames("en");
  const cityCounts = new Map<string, number>();
  for (const c of cities) cityCounts.set(c.countryIso2, (cityCounts.get(c.countryIso2) ?? 0) + 1);
  const subCounts = new Map<string, number>();
  for (const s of subdivisions)
    subCounts.set(s.countryIso2, (subCounts.get(s.countryIso2) ?? 0) + 1);

  const list: Country[] = [];
  for (const [iso2, name] of Object.entries(names)) {
    const iso3 = countries.alpha2ToAlpha3(iso2);
    const numeric = countries.alpha2ToNumeric(iso2);
    if (!iso3 || !numeric) continue;
    list.push({
      iso2,
      iso3,
      numeric,
      name,
      continent: continents[iso2] ?? "",
      cityCount: cityCounts.get(iso2) ?? 0,
      subdivisionCount: subCounts.get(iso2) ?? 0,
    });
  }
  list.sort((a, b) => a.name.localeCompare(b.name));
  return list;
}

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

interface IndexedCity extends City {
  /** Precomputed normalized name so per-keystroke search stays fast at 24k cities. */
  search: string;
}

class ReferenceDataImpl implements ReferenceData {
  readonly countries: Country[];
  readonly provenance: ReferenceProvenance[] = provenance;
  private cities: IndexedCity[];
  private byIso2 = new Map<string, Country>();
  private byNumeric = new Map<string, Country>();
  private cityIndex = new Map<string, City>();
  private countrySearch: { c: Country; search: string }[];

  constructor(cities: City[]) {
    // Gazetteer arrives population-sorted from the build script; keep that order
    // so search/viewport ranking is "most people first" by construction.
    this.cities = cities.map((c) => ({ ...c, search: normalize(c.name) }));
    this.countries = buildCountries(cities);
    this.countrySearch = this.countries.map((c) => ({ c, search: normalize(c.name) }));
    for (const c of this.countries) {
      this.byIso2.set(c.iso2, c);
      this.byNumeric.set(c.numeric, c);
    }
    for (const c of this.cities) this.cityIndex.set(c.id, c);
  }

  countryByIso2(iso2: string): Country | undefined {
    return this.byIso2.get(iso2.toUpperCase());
  }
  countryByNumeric(numeric: string): Country | undefined {
    return this.byNumeric.get(numeric) ?? this.byNumeric.get(numeric.padStart(3, "0"));
  }
  continentOf(iso2: string): string {
    return continents[iso2.toUpperCase()] ?? "";
  }
  subdivisionsOf(countryIso2: string): Subdivision[] {
    return subdivisions.filter((s) => s.countryIso2 === countryIso2);
  }
  subdivisionById(id: string): Subdivision | undefined {
    return subdivisions.find((s) => s.id === id);
  }
  citiesOf(countryIso2: string): City[] {
    return this.cities.filter((c) => c.countryIso2 === countryIso2);
  }
  allCities(): City[] {
    return this.cities;
  }
  cityById(id: string): City | undefined {
    return this.cityIndex.get(id);
  }
  searchCountries(query: string, limit = 8): Country[] {
    const q = normalize(query);
    if (!q) return [];
    const starts: Country[] = [];
    const contains: Country[] = [];
    for (const { c, search } of this.countrySearch) {
      if (search.startsWith(q)) starts.push(c);
      else if (search.includes(q)) contains.push(c);
    }
    return [...starts, ...contains].slice(0, limit);
  }
  searchCities(query: string, limit = 8): City[] {
    const q = normalize(query);
    if (!q) return [];
    // Cities are population-sorted, so first-hits are the most relevant;
    // prefix matches outrank substring matches.
    const starts: City[] = [];
    const contains: City[] = [];
    for (const c of this.cities) {
      if (c.search.startsWith(q)) {
        if (starts.push(c) >= limit && contains.length >= limit) break;
      } else if (c.search.includes(q)) {
        contains.push(c);
      }
    }
    return [...starts, ...contains].slice(0, limit);
  }
  worldCountryCount(): number {
    return this.countries.length;
  }
}

let instance: ReferenceData | null = null;

/** Build the reference data from an in-memory gazetteer (tests, fallbacks). */
export function initReferenceDataSync(cities: City[]): ReferenceData {
  instance = new ReferenceDataImpl(cities);
  return instance;
}

/** Load the bundled gazetteer asset and build the reference data (app startup). */
export async function initReferenceData(): Promise<ReferenceData> {
  if (instance) return instance;
  try {
    const res = await fetch(CITIES_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const cities = (await res.json()) as City[];
    return initReferenceDataSync(cities);
  } catch {
    // Degraded but functional: countries still work without the gazetteer.
    console.warn("Place'Been: city gazetteer failed to load; continuing without cities.");
    return initReferenceDataSync([]);
  }
}

/** Singleton accessor. Requires initReferenceData()/initReferenceDataSync() first. */
export function getReferenceData(): ReferenceData {
  if (!instance) throw new Error("Reference data not initialized");
  return instance;
}
