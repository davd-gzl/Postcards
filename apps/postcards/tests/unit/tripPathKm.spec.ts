import { describe, it, expect } from "vitest";
import { tripPathKm, haversineKm } from "../../src/features/travel/distance";
import type { ReferenceData, Airport } from "../../src/lib/reference/types";
import type { PlaceRef } from "../../src/lib/schema/models";

// Minimal reference stub: three airports with coordinates + one that doesn't resolve.
const airports: Record<string, Airport> = {
  CDG: { id: "CDG", name: "Charles de Gaulle", city: "Paris", countryIso2: "FR", lat: 49.01, lon: 2.55 },
  HND: { id: "HND", name: "Haneda", city: "Tokyo", countryIso2: "JP", lat: 35.55, lon: 139.78 },
  ITM: { id: "ITM", name: "Osaka Itami", city: "Osaka", countryIso2: "JP", lat: 34.79, lon: 135.44 },
};
const ref = {
  airportById: (id: string) => airports[id],
  cityById: () => undefined,
  heritageById: () => undefined,
} as unknown as ReferenceData;

const ap = (id: string): PlaceRef => ({ kind: "airport", id, name: id, countryId: "FR" });
const co = (id: string) => ({ lon: airports[id]!.lon, lat: airports[id]!.lat });

describe("tripPathKm — great-circle path over ordered stops (spec 019)", () => {
  it("sums the leg distances between consecutive resolvable stops", () => {
    const stops = [ap("CDG"), ap("HND"), ap("ITM")];
    const expected = haversineKm(co("CDG"), co("HND")) + haversineKm(co("HND"), co("ITM"));
    const { km, unresolvedLegs } = tripPathKm(stops, ref);
    expect(km).toBeCloseTo(expected, 6);
    expect(unresolvedLegs).toBe(0);
    // Sanity: CDG→HND is ~9,700 km; the two-leg path is clearly > 9,000.
    expect(km).toBeGreaterThan(9_000);
  });

  it("skips a leg touching an unresolvable stop but still sums the rest", () => {
    const country: PlaceRef = { kind: "country", id: "FR", name: "France", countryId: "FR" };
    const stops = [ap("CDG"), country, ap("HND"), ap("ITM")];
    // CDG→country and country→HND are unmeasured (2 legs); only HND→ITM counts.
    const { km, unresolvedLegs } = tripPathKm(stops, ref);
    expect(unresolvedLegs).toBe(2);
    expect(km).toBeCloseTo(haversineKm(co("HND"), co("ITM")), 6);
  });

  it("returns zero for fewer than two stops", () => {
    expect(tripPathKm([], ref)).toEqual({ km: 0, unresolvedLegs: 0 });
    expect(tripPathKm([ap("CDG")], ref)).toEqual({ km: 0, unresolvedLegs: 0 });
  });
});
