import { describe, it, expect } from "vitest";
import { getReferenceData } from "../../src/lib/reference/referenceData";
import { searchPlaces } from "../../src/features/visits/search";

const ref = getReferenceData();

describe("searchPlaces (aggregator-only)", () => {
  it("finds a country by name", () => {
    const results = searchPlaces(ref, "France");
    expect(results.some((r) => r.place.kind === "country" && r.place.id === "FR")).toBe(true);
  });

  it("finds a city by name (accent-insensitive)", () => {
    const results = searchPlaces(ref, "paris");
    expect(results.some((r) => r.place.kind === "city" && r.place.id === "paris-fr")).toBe(true);
  });

  it("returns nothing for an unknown place (never invents)", () => {
    expect(searchPlaces(ref, "zzznotarealplace")).toHaveLength(0);
  });
});
