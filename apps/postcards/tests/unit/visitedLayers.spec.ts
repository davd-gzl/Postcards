import { describe, it, expect } from "vitest";
import type { Feature, FeatureCollection, Point } from "geojson";
import { getReferenceData } from "../../src/lib/reference/referenceData";
import {
  visitedCityPoints,
  optimizeVisitedPoints,
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

describe("optimize visited points (one city per area)", () => {
  // Minimal feature carrying only what the reducer reads.
  const pt = (
    name: string,
    props: { cc?: string; region?: string; pop?: number; custom?: number; fav?: number },
  ): Feature<Point> => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [0, 0] },
    properties: { name, cc: "FR", region: "", pop: 0, custom: 0, fav: 0, ...props },
  });
  const fc = (features: Feature<Point>[]): FeatureCollection<Point> => ({
    type: "FeatureCollection",
    features,
  });
  const names = (out: FeatureCollection<Point>) =>
    out.features.map((f) => f.properties?.name).sort();

  it("keeps only the most-populous city in an area", () => {
    const out = optimizeVisitedPoints(
      fc([
        pt("Big", { region: "IDF", pop: 2_000_000 }),
        pt("Small", { region: "IDF", pop: 5_000 }),
        pt("Mid", { region: "IDF", pop: 40_000 }),
      ]),
    );
    expect(out.features).toHaveLength(1);
    expect(out.features[0]!.properties?.name).toBe("Big");
  });

  it("treats country + subdivision as the area (same region name, different country stays)", () => {
    const out = optimizeVisitedPoints(
      fc([
        pt("A", { cc: "FR", region: "West", pop: 100 }),
        pt("B", { cc: "US", region: "West", pop: 100 }),
      ]),
    );
    expect(names(out)).toEqual(["A", "B"]);
  });

  it("always keeps favourites and custom points, even when a bigger city shares the area", () => {
    const out = optimizeVisitedPoints(
      fc([
        pt("Capital", { region: "IDF", pop: 2_000_000 }),
        pt("MyFavVillage", { region: "IDF", pop: 200, fav: 1 }),
        pt("MyPin", { region: "IDF", pop: 0, custom: 1 }),
      ]),
    );
    // Biggest area rep + the favourite + the custom pin all survive.
    expect(names(out)).toEqual(["Capital", "MyFavVillage", "MyPin"]);
  });

  it("leaves a set that is already one-per-area untouched", () => {
    const input = fc([
      pt("Paris", { region: "IDF", pop: 2_000_000 }),
      pt("Lyon", { region: "ARA", pop: 500_000 }),
    ]);
    expect(names(optimizeVisitedPoints(input))).toEqual(["Lyon", "Paris"]);
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
