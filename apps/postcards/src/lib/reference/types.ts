// Reference data is aggregated from external openly-licensed datasets and is
// read-only (Constitution I: aggregator, never an author). User records point at
// this data by stable id.

export interface Country {
  iso2: string;
  iso3: string;
  numeric: string; // ISO 3166-1 numeric, used to join map geometry
  name: string;
  continent: string; // Europe|Asia|Africa|Americas|Oceania|Antarctic (from world-countries)
  cityCount: number; // # of gazetteer cities in this country (denominator for % of cities)
  subdivisionCount: number; // # of first-level subdivisions (denominator for % of regions)
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
  subdivisionsOf(countryIso2: string): Subdivision[];
  subdivisionById(id: string): Subdivision | undefined;
  citiesOf(countryIso2: string): City[];
  allCities(): City[];
  cityById(id: string): City | undefined;
  allAirports(): Airport[];
  airportById(id: string): Airport | undefined;
  searchCountries(query: string, limit?: number): Country[];
  searchCities(query: string, limit?: number): City[];
  searchAirports(query: string, limit?: number): Airport[];
  worldCountryCount(): number;
  provenance: ReferenceProvenance[];
}
