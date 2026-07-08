import { describe, it, expect } from "vitest";
import { getReferenceData } from "../../src/lib/reference/referenceData";
import { computeCoverage, computeCountryCoverage } from "../../src/features/stats/computeStats";
import { searchPlaces } from "../../src/features/visits/search";
import { airportPoints } from "../../src/features/map/visitedLayers";
import type { Visit } from "../../src/lib/schema/models";
import type { Airport } from "../../src/lib/reference/types";

const ref = getReferenceData();

function airportVisit(a: Airport, status: Visit["status"] = "visited"): Visit {
  return {
    visitId: crypto.randomUUID(),
    place: { kind: "airport", id: a.id, name: `${a.name} (${a.id})`, countryId: a.countryIso2 },
    date: null,
    note: null,
    status,
    favorite: false,
    addedAt: new Date().toISOString(),
  };
}

describe("bundled airports gazetteer (OpenFlights, IATA-coded)", () => {
  const airports = ref.allAirports();

  it("is a real, sizeable, worldwide set", () => {
    expect(airports.length).toBeGreaterThan(5000);
    expect(new Set(airports.map((a) => a.countryIso2)).size).toBeGreaterThan(180);
  });

  it("every airport has a 3-letter IATA id, valid coords, and a resolvable country", () => {
    const ids = new Set<string>();
    for (const a of airports) {
      expect(a.id).toMatch(/^[A-Z]{3}$/);
      expect(ids.has(a.id)).toBe(false); // IATA is globally unique
      ids.add(a.id);
      expect(ref.countryByIso2(a.countryIso2)).toBeDefined(); // never an invented country
      expect(a.lat).toBeGreaterThanOrEqual(-90);
      expect(a.lat).toBeLessThanOrEqual(90);
      expect(a.lon).toBeGreaterThanOrEqual(-180);
      expect(a.lon).toBeLessThanOrEqual(180);
    }
  });

  it("finds well-known airports by IATA code and by name", () => {
    const cdg = ref.airportById("CDG")!;
    expect(cdg.countryIso2).toBe("FR");
    expect(cdg.city).toBe("Paris");
    expect(ref.searchAirports("CDG")[0]!.id).toBe("CDG");
    expect(ref.searchAirports("cdg")[0]!.id).toBe("CDG"); // case-insensitive code
    expect(ref.searchAirports("Kennedy").some((a) => a.id === "JFK")).toBe(true);
  });

  it("surfaces airports in unified place search, labelled with city/country", () => {
    const results = searchPlaces(ref, "JFK");
    const jfk = results.find((r) => r.place.kind === "airport" && r.place.id === "JFK");
    expect(jfk).toBeDefined();
    expect(jfk!.detail).toContain("Airport");
    expect(jfk!.detail).toContain("New York");
  });
});

describe("airport visits and coverage", () => {
  const jfk = ref.airportById("JFK")!;
  const cdg = ref.airportById("CDG")!;

  it("a visited airport counts its country but never inflates % of cities/regions", () => {
    const visits = [airportVisit(jfk)];
    const cov = computeCoverage(visits, ref);
    expect(cov.countriesVisited).toBe(1); // US, from the airport
    expect(cov.citiesVisited).toBe(0); // airports are not cities
    expect(cov.airportsVisited).toBe(1);

    const us = computeCountryCoverage(visits, ref, "US");
    expect(us.citiesVisited).toBe(0);
    expect(us.cityPct).toBe(0);
    expect(us.regionsVisited).toBe(0);
  });

  it("counts distinct visited airports only (wishlist excluded)", () => {
    const cov = computeCoverage([airportVisit(jfk), airportVisit(cdg, "wishlist")], ref);
    expect(cov.airportsVisited).toBe(1);
    expect(cov.countriesVisited).toBe(1); // FR is only wished, so US only
  });

  it("emits map points tagged wish/fav, resolving coordinates from the gazetteer", () => {
    const fc = airportPoints([airportVisit(jfk), airportVisit(cdg, "wishlist")], ref);
    expect(fc.features).toHaveLength(2);
    const jfkPt = fc.features.find((f) => f.properties!.iata === "JFK")!;
    expect(jfkPt.properties!.wish).toBe(0);
    expect(jfkPt.geometry.coordinates).toEqual([jfk.lon, jfk.lat]);
    const cdgPt = fc.features.find((f) => f.properties!.iata === "CDG")!;
    expect(cdgPt.properties!.wish).toBe(1);
  });
});
