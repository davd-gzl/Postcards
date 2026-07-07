import { describe, it, expect } from "vitest";
import { getReferenceData } from "../../src/lib/reference/referenceData";
import {
  visitedCountryNumerics,
  visitedCityPoints,
  tripArcs,
} from "../../src/features/map/visitedLayers";
import type { PlaceRef, Trip, Visit } from "../../src/lib/schema/models";
import { haversineKm } from "../../src/features/travel/distance";

const ref = getReferenceData();
const paris = ref.searchCities("Paris")[0]!;

function cityVisit(id: string, name: string, countryId: string): Visit {
  return {
    visitId: crypto.randomUUID(),
    place: { kind: "city", id, name, countryId },
    date: null,
    note: null,
    status: "visited" as const,
    favorite: false,
    addedAt: new Date().toISOString(),
  };
}

describe("map layers", () => {
  const visits = [cityVisit(paris.id, paris.name, paris.countryIso2)];

  it("maps visited countries to their numeric geometry id", () => {
    const numerics = visitedCountryNumerics(visits, ref);
    // France ISO 3166-1 numeric is 250.
    expect(numerics).toContain("250");
  });

  it("emits a point at the city's [lon, lat] (GeoJSON order)", () => {
    const fc = visitedCityPoints(visits, ref);
    expect(fc.features).toHaveLength(1);
    const [lon, lat] = fc.features[0]!.geometry.coordinates;
    expect(lon).toBeCloseTo(paris.lon, 3);
    expect(lat).toBeCloseTo(paris.lat, 3);
  });

  it("tags each point with its country code for the flag marker", () => {
    const fc = visitedCityPoints(visits, ref);
    expect(fc.features[0]!.properties?.cc).toBe("FR");
  });
});

describe("trip arcs", () => {
  const airport = (iata: string): PlaceRef => {
    const a = ref.airportById(iata)!;
    return { kind: "airport", id: a.id, name: a.id, countryId: a.countryIso2 };
  };
  const trip = (from: PlaceRef, to: PlaceRef): Trip => ({
    tripId: crypto.randomUUID(),
    from,
    to,
    mode: "flight",
    date: null,
    carrier: null,
    note: null,
    addedAt: new Date().toISOString(),
  });

  it("draws a densified great-circle arc tagged with the mode", () => {
    const fc = tripArcs([trip(airport("CDG"), airport("JFK"))], ref);
    expect(fc.features).toHaveLength(1);
    const line = fc.features[0]!;
    expect(line.properties?.mode).toBe("flight");
    const coords = line.geometry.coordinates;
    expect(coords.length).toBeGreaterThan(10); // densified, not just 2 endpoints
    // Endpoints match the airports.
    const cdg = ref.airportById("CDG")!;
    const jfk = ref.airportById("JFK")!;
    expect(coords[0]![0]).toBeCloseTo(cdg.lon, 3);
    expect(coords[coords.length - 1]![1]).toBeCloseTo(jfk.lat, 3);
    // The arc bulges north of the straight lon/lat chord (great-circle behaviour).
    const mid = coords[Math.floor(coords.length / 2)]!;
    expect(mid[1]).toBeGreaterThan((cdg.lat + jfk.lat) / 2);
    // Total polyline length ≈ the great-circle distance.
    let len = 0;
    for (let i = 1; i < coords.length; i++) {
      len += haversineKm(
        { lon: coords[i - 1]![0], lat: coords[i - 1]![1] },
        { lon: coords[i]![0], lat: coords[i]![1] },
      );
    }
    expect(len).toBeGreaterThan(5700);
    expect(len).toBeLessThan(5950);
  });

  it("skips trips whose endpoint has no coordinate (never invents a line)", () => {
    const country: PlaceRef = { kind: "country", id: "FR", name: "France", countryId: "FR" };
    const fc = tripArcs([trip(country, airport("JFK"))], ref);
    expect(fc.features).toHaveLength(0);
  });
});
