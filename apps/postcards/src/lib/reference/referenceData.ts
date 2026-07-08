import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";
import type {
  Airport,
  City,
  Country,
  ReferenceData,
  ReferenceProvenance,
  Subdivision,
} from "./types";
import provenanceData from "./data/provenance.json";
import continentsData from "./data/continents.json";
import sovereigntyData from "./data/sovereignty.json";
import { inScope, type CountryScope, type Sovereignty } from "./scope";

countries.registerLocale(enLocale as Parameters<typeof countries.registerLocale>[0]);

const provenance = provenanceData as ReferenceProvenance[];
const continents = continentsData as Record<string, string>;
const sovereignty = sovereigntyData as Record<string, Sovereignty>;

// Gazetteer + subdivisions are served as static, SW-cached assets and loaded once
// at startup (see initReferenceData()).
const CITIES_URL = `${import.meta.env.BASE_URL}reference/cities.json`;
const SUBDIVISIONS_URL = `${import.meta.env.BASE_URL}reference/subdivisions.json`;
const AIRPORTS_URL = `${import.meta.env.BASE_URL}reference/airports.json`;

function buildCountries(cities: City[], subdivisions: Subdivision[]): Country[] {
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
      sovereignty: sovereignty[iso2] ?? "territory",
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
  search: string;
}

interface IndexedAirport extends Airport {
  search: string;
}

class ReferenceDataImpl implements ReferenceData {
  readonly countries: Country[];
  readonly provenance: ReferenceProvenance[] = provenance;
  private cities: IndexedCity[];
  private airports: IndexedAirport[];
  private byIso2 = new Map<string, Country>();
  private byNumeric = new Map<string, Country>();
  private cityIndex = new Map<string, City>();
  private airportIndex = new Map<string, Airport>();
  private subIndex = new Map<string, Subdivision>();
  private subsByCountry = new Map<string, Subdivision[]>();
  private countrySearch: { c: Country; search: string }[];

  constructor(cities: City[], subdivisions: Subdivision[], airports: Airport[] = []) {
    this.cities = cities.map((c) => ({ ...c, search: normalize(c.name) }));
    this.airports = airports.map((a) => ({ ...a, search: normalize(a.name) }));
    this.countries = buildCountries(cities, subdivisions);
    this.countrySearch = this.countries.map((c) => ({ c, search: normalize(c.name) }));
    for (const c of this.countries) {
      this.byIso2.set(c.iso2, c);
      this.byNumeric.set(c.numeric, c);
    }
    for (const c of this.cities) this.cityIndex.set(c.id, c);
    for (const a of this.airports) this.airportIndex.set(a.id, a);
    for (const s of subdivisions) {
      this.subIndex.set(s.id, s);
      const arr = this.subsByCountry.get(s.countryIso2);
      if (arr) arr.push(s);
      else this.subsByCountry.set(s.countryIso2, [s]);
    }
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
    return this.subsByCountry.get(countryIso2) ?? [];
  }
  subdivisionById(id: string): Subdivision | undefined {
    return this.subIndex.get(id);
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
  allAirports(): Airport[] {
    return this.airports;
  }
  airportById(id: string): Airport | undefined {
    return this.airportIndex.get(id.toUpperCase());
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
  searchAirports(query: string, limit = 8): Airport[] {
    const q = normalize(query);
    if (!q) return [];
    // IATA codes are 3 letters; a short query is likely a code — match those first.
    const code = query.trim().toUpperCase();
    const codeExact: Airport[] = [];
    const codePrefix: Airport[] = [];
    const nameStarts: Airport[] = [];
    const nameContains: Airport[] = [];
    for (const a of this.airports) {
      if (a.id === code) codeExact.push(a);
      else if (code.length >= 2 && a.id.startsWith(code)) codePrefix.push(a);
      else if (a.search.startsWith(q)) nameStarts.push(a);
      else if (a.search.includes(q)) nameContains.push(a);
    }
    return [...codeExact, ...codePrefix, ...nameStarts, ...nameContains].slice(0, limit);
  }
  worldCountryCount(scope: CountryScope = "all"): number {
    if (scope === "all") return this.countries.length;
    return this.countries.reduce((n, c) => n + (inScope(c.sovereignty, scope) ? 1 : 0), 0);
  }
}

let instance: ReferenceData | null = null;

/** Build from in-memory data (tests, fallbacks). */
export function initReferenceDataSync(
  cities: City[],
  subdivisions: Subdivision[],
  airports: Airport[] = [],
): ReferenceData {
  instance = new ReferenceDataImpl(cities, subdivisions, airports);
  return instance;
}

/** Load the bundled gazetteer + subdivisions + airports assets and build the reference data. */
export async function initReferenceData(): Promise<ReferenceData> {
  if (instance) return instance;
  try {
    const [cities, subdivisions, airports] = await Promise.all([
      fetch(CITIES_URL).then((r) => (r.ok ? r.json() : Promise.reject(new Error("cities")))),
      fetch(SUBDIVISIONS_URL).then((r) => (r.ok ? r.json() : [])),
      fetch(AIRPORTS_URL).then((r) => (r.ok ? r.json() : [])),
    ]);
    return initReferenceDataSync(
      cities as City[],
      subdivisions as Subdivision[],
      airports as Airport[],
    );
  } catch {
    console.warn("Postcards: reference data failed to load; continuing without cities.");
    return initReferenceDataSync([], [], []);
  }
}

/** Singleton accessor. Requires initReferenceData()/initReferenceDataSync() first. */
export function getReferenceData(): ReferenceData {
  if (!instance) throw new Error("Reference data not initialized");
  return instance;
}
