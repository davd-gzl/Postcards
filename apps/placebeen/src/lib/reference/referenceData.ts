import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";
import type { City, Country, ReferenceData, ReferenceProvenance, Subdivision } from "./types";
import subdivisionsData from "./data/subdivisions.json";
import citiesData from "./data/cities.json";
import provenanceData from "./data/provenance.json";

countries.registerLocale(enLocale as Parameters<typeof countries.registerLocale>[0]);

const subdivisions = subdivisionsData as Subdivision[];
const cities = citiesData as unknown as City[];
const provenance = provenanceData as ReferenceProvenance[];

function buildCountries(): Country[] {
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

class ReferenceDataImpl implements ReferenceData {
  readonly countries: Country[];
  readonly provenance: ReferenceProvenance[] = provenance;
  private byIso2 = new Map<string, Country>();
  private byNumeric = new Map<string, Country>();
  private cityIndex = new Map<string, City>();

  constructor() {
    this.countries = buildCountries();
    for (const c of this.countries) {
      this.byIso2.set(c.iso2, c);
      this.byNumeric.set(c.numeric, c);
    }
    for (const c of cities) this.cityIndex.set(c.id, c);
  }

  countryByIso2(iso2: string): Country | undefined {
    return this.byIso2.get(iso2.toUpperCase());
  }
  countryByNumeric(numeric: string): Country | undefined {
    return this.byNumeric.get(numeric) ?? this.byNumeric.get(numeric.padStart(3, "0"));
  }
  subdivisionsOf(countryIso2: string): Subdivision[] {
    return subdivisions.filter((s) => s.countryIso2 === countryIso2);
  }
  citiesOf(countryIso2: string): City[] {
    return cities.filter((c) => c.countryIso2 === countryIso2);
  }
  allCities(): City[] {
    return cities;
  }
  cityById(id: string): City | undefined {
    return this.cityIndex.get(id);
  }
  searchCountries(query: string, limit = 8): Country[] {
    const q = normalize(query);
    if (!q) return [];
    return this.countries.filter((c) => normalize(c.name).includes(q)).slice(0, limit);
  }
  searchCities(query: string, limit = 8): City[] {
    const q = normalize(query);
    if (!q) return [];
    return cities.filter((c) => normalize(c.name).includes(q)).slice(0, limit);
  }
  worldCountryCount(): number {
    return this.countries.length;
  }
}

let instance: ReferenceData | null = null;

/** Singleton accessor for the bundled reference data. */
export function getReferenceData(): ReferenceData {
  if (!instance) instance = new ReferenceDataImpl();
  return instance;
}
