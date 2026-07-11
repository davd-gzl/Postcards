// Reference data is aggregated from external openly-licensed datasets and is
// read-only (Constitution I: aggregator, never an author). User records point at
// this data by stable id.

import type { CountryScope, Sovereignty } from "./scope";

export interface Country {
  iso2: string;
  iso3: string;
  numeric: string; // ISO 3166-1 numeric, used to join map geometry
  name: string;
  continent: string; // Europe|Asia|Africa|Americas|Oceania|Antarctic (from world-countries)
  cityCount: number; // # of gazetteer cities in this country (denominator for % of cities)
  subdivisionCount: number; // # of first-level subdivisions (denominator for % of regions)
  sovereignty: Sovereignty; // "un" member vs dependent "territory" (from world-countries)
}

export interface Subdivision {
  id: string; // ISO 3166-2 where available
  countryIso2: string;
  name: string;
}

export interface City {
  id: string; // stable id (GeoNames id once the full gazetteer is vendored; slug in the starter set)
  name: string;
  countryIso2: string;
  subdivisionId: string | null;
  lat: number;
  lon: number;
  population: number | null;
}

export interface Airport {
  id: string; // IATA code (globally unique), e.g. "CDG"
  name: string;
  city: string; // home city, may be empty
  countryIso2: string;
  lat: number;
  lon: number;
}

/** A spoken language of a country (English name + language code). */
export interface Language {
  code: string; // ISO 639-3 where available
  name: string; // English name, e.g. "French"
}

// A "category" place: a notable site that contributes to per-country coverage
// (e.g. a UNESCO World Heritage Site). Aggregated from a named dataset — the app
// authors none of these. The first category is World Heritage; more (museums,
// monuments, …) are drop-in datasets of the same shape (see docs/CATEGORIES-HANDOFF.md).
export interface HeritageSite {
  id: string; // stable id (Wikidata QID once vendored)
  name: string;
  countryIso2: string;
  lat: number;
  lon: number;
  category?: string; // "cultural" | "natural" | "mixed" where known
}

export interface ReferenceProvenance {
  dataset: string;
  license: string;
  version: string;
  url?: string;
}

export interface ReferenceData {
  countries: Country[];
  countryByIso2(iso2: string): Country | undefined;
  countryByNumeric(numeric: string): Country | undefined;
  continentOf(iso2: string): string;
  /** Common country name (Wikivoyage/Wikipedia article title), e.g. "Russia". Falls back to the ISO name. */
  articleNameOf(iso2: string): string;
  subdivisionsOf(countryIso2: string): Subdivision[];
  subdivisionById(id: string): Subdivision | undefined;
  citiesOf(countryIso2: string): City[];
  allCities(): City[];
  cityById(id: string): City | undefined;
  allAirports(): Airport[];
  airportById(id: string): Airport | undefined;
  /** Spoken languages of a country (for Wikivoyage phrasebook/alphabet guides). */
  languagesOf(iso2: string): Language[];
  /** All heritage sites, those in a country (coverage denominator), one by id, or a search. */
  allHeritage(): HeritageSite[];
  heritageOf(countryIso2: string): HeritageSite[];
  heritageById(id: string): HeritageSite | undefined;
  searchCountries(query: string, limit?: number): Country[];
  searchCities(query: string, limit?: number): City[];
  searchAirports(query: string, limit?: number): Airport[];
  searchHeritage(query: string, limit?: number): HeritageSite[];
  /** Number of countries counted under the given scope (default: all, incl. territories). */
  worldCountryCount(scope?: CountryScope): number;
  provenance: ReferenceProvenance[];
}
