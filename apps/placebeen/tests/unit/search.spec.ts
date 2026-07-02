import { describe, it, expect } from "vitest";
import { getReferenceData } from "../../src/lib/reference/referenceData";
import { searchPlaces } from "../../src/features/visits/search";

const ref = getReferenceData();

describe("searchPlaces (aggregator-only, real gazetteer)", () => {
  it("finds a country by name", () => {
    const results = searchPlaces(ref, "France");
    expect(results.some((r) => r.place.kind === "country" && r.place.id === "FR")).toBe(true);
  });

  it("ranks the most populous city first (Paris, France before Paris, Texas)", () => {
    const firstCity = searchPlaces(ref, "paris").find((r) => r.place.kind === "city");
    expect(firstCity?.place.countryId).toBe("FR");
    expect(firstCity?.place.id).toBe("2988507");
  });

  it("is accent-insensitive (Zürich found via 'zurich')", () => {
    const results = ref.searchCities("zurich");
    expect(results.some((c) => c.countryIso2 === "CH")).toBe(true);
  });

  it("prefers prefix matches over substring matches", () => {
    const results = ref.searchCities("york");
    // "York" (GB) starts with the query; "New York City" merely contains it.
    expect(results[0]!.name.toLowerCase().startsWith("york")).toBe(true);
  });

  it("returns nothing for an unknown place (never invents)", () => {
    expect(searchPlaces(ref, "zzznotarealplace")).toHaveLength(0);
  });
});
