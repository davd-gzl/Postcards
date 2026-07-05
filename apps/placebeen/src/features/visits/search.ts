import type { PlaceRef } from "../../lib/schema/models";
import type { ReferenceData } from "../../lib/reference/types";

export interface SearchResult {
  place: PlaceRef;
  /** Secondary line for the UI (e.g. country name for a city). */
  detail: string;
}

/**
 * Search reference data for countries and cities matching the query.
 * Returns PlaceRefs ready to log. Aggregator-only: results come from reference
 * data; nothing is invented (FR-016 handled by the caller when empty).
 */
export function searchPlaces(ref: ReferenceData, query: string, limit = 8): SearchResult[] {
  const q = query.trim();
  if (!q) return [];

  const countryResults: SearchResult[] = ref.searchCountries(q, limit).map((c) => ({
    place: { kind: "country", id: c.iso2, name: c.name, countryId: c.iso2 },
    detail: "Country",
  }));

  const cityResults: SearchResult[] = ref.searchCities(q, limit).map((c) => {
    const country = ref.countryByIso2(c.countryIso2);
    return {
      place: { kind: "city", id: c.id, name: c.name, countryId: c.countryIso2 },
      detail: country ? `City · ${country.name}` : "City",
    };
  });

  const airportResults: SearchResult[] = ref.searchAirports(q, limit).map((a) => {
    const country = ref.countryByIso2(a.countryIso2);
    const where = [a.city, country?.name].filter(Boolean).join(", ");
    return {
      place: { kind: "airport", id: a.id, name: `${a.name} (${a.id})`, countryId: a.countryIso2 },
      detail: where ? `Airport · ${where}` : "Airport",
    };
  });

  // Countries first for exact-name matches, then cities, then airports.
  return [...countryResults, ...cityResults, ...airportResults].slice(0, limit * 2);
}
