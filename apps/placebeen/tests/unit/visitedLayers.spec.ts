import { describe, it, expect } from "vitest";
import { getReferenceData } from "../../src/lib/reference/referenceData";
import { visitedCountryNumerics, visitedCityPoints } from "../../src/features/map/visitedLayers";
import type { Visit } from "../../src/lib/schema/models";

const ref = getReferenceData();

function cityVisit(id: string, name: string, countryId: string): Visit {
  return {
    visitId: crypto.randomUUID(),
    place: { kind: "city", id, name, countryId },
    date: null,
    note: null,
    addedAt: new Date().toISOString(),
  };
}

describe("map layers", () => {
  const visits = [cityVisit("paris-fr", "Paris", "FR")];

  it("maps visited countries to their numeric geometry id", () => {
    const numerics = visitedCountryNumerics(visits, ref);
    // France ISO 3166-1 numeric is 250.
    expect(numerics).toContain("250");
  });

  it("emits a point at the city's [lon, lat] (GeoJSON order)", () => {
    const fc = visitedCityPoints(visits, ref);
    expect(fc.features).toHaveLength(1);
    const [lon, lat] = fc.features[0]!.geometry.coordinates;
    expect(lon).toBeCloseTo(2.3522, 3);
    expect(lat).toBeCloseTo(48.8566, 3);
  });
});
