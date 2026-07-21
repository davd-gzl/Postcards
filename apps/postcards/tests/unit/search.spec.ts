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

  it("puts prefix matches above mid-word hits across kinds (ista → Istanbul, not Afghanistan)", () => {
    const results = searchPlaces(ref, "ista");
    expect(results[0]!.place.name.toLowerCase().startsWith("ista")).toBe(true);
    // The mid-word country hit must not outrank every prefix-matched city.
    const afghanistan = results.findIndex((r) => r.place.id === "AF");
    const firstPrefixCity = results.findIndex(
      (r) => r.place.kind === "city" && r.place.name.toLowerCase().startsWith("ista"),
    );
    expect(firstPrefixCity).toBeGreaterThanOrEqual(0);
    if (afghanistan >= 0) expect(firstPrefixCity).toBeLessThan(afghanistan);
  });

  it("ranks an explicit UPPERCASE IATA code first, ahead of a like-named city (LAX before Laxou)", () => {
    const results = searchPlaces(ref, "LAX");
    expect(results[0]!.place.kind).toBe("airport");
    expect(results[0]!.place.id).toBe("LAX");
  });

  it("treats a lowercase 3-letter prefix as a place name, keeping cities first (por → Porto, not Pori airport)", () => {
    // "por" is also a valid IATA code (POR = Pori) — lowercase must NOT front-load airports.
    const results = searchPlaces(ref, "por");
    expect(results[0]!.place.kind).not.toBe("airport");
  });

  it("still puts places first for ordinary name queries (Paris → country/city, not airport)", () => {
    const results = searchPlaces(ref, "Paris");
    expect(results[0]!.place.kind).not.toBe("airport");
  });

  it("surfaces a country's airports when the query NAMES the country (FR-007)", () => {
    // "France" matches those airports by COUNTRY, not by their own name. (Heritage
    // is fetched lazily and absent from the sync unit gazetteer, so the by-country
    // heritage path is covered by browseList.spec.ts with a mock; here we assert the
    // bundled airports.)
    const results = searchPlaces(ref, "France");
    expect(results[0]!.place.kind).toBe("country");
    expect(results[0]!.place.id).toBe("FR");
    // Several FRENCH airports appear even though "France" matches none of their
    // names — that's the by-country surfacing. (A few name-matched airports from
    // other countries may also ride along in the ranked tail; that's expected.)
    const frAirports = results.filter((r) => r.place.kind === "airport" && r.place.countryId === "FR");
    expect(frAirports.length).toBeGreaterThanOrEqual(3);
  });

  it("leaves ordinary city queries unaffected by country intent (no country injected for 'Tokyo')", () => {
    const results = searchPlaces(ref, "Tokyo");
    // No country whose name starts with "tokyo" ⇒ the first hit stays a place.
    expect(results[0]!.place.kind).not.toBe("country");
    expect(results.some((r) => r.place.kind === "city")).toBe(true);
  });
});
