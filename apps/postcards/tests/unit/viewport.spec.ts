import { describe, it, expect } from "vitest";
import {
  citiesInView,
  markerCitiesInView,
  type Bounds,
} from "../../src/features/map/viewport";
import type { City } from "../../src/lib/reference/types";

function city(id: string, lat: number, lon: number, population: number): City {
  return { id, name: id, countryIso2: "XX", subdivisionId: null, lat, lon, population };
}

const cities: City[] = [
  city("paris", 48.85, 2.35, 2_100_000),
  city("london", 51.5, -0.12, 9_000_000),
  city("tokyo", 35.68, 139.65, 13_500_000),
  city("nuku", -21.13, -175.2, 22_000), // near antimeridian (Tonga-ish)
];

describe("citiesInView", () => {
  it("returns nothing without bounds", () => {
    expect(citiesInView(cities, null)).toEqual([]);
  });

  it("filters to cities inside the viewport", () => {
    const europe: Bounds = { west: -10, south: 40, east: 20, north: 60 };
    const names = citiesInView(cities, europe).map((c) => c.id);
    expect(names).toContain("paris");
    expect(names).toContain("london");
    expect(names).not.toContain("tokyo");
  });

  it("sorts by population, most people first", () => {
    const world: Bounds = { west: -180, south: -85, east: 180, north: 85 };
    const order = citiesInView(cities, world).map((c) => c.id);
    expect(order[0]).toBe("tokyo");
    expect(order[1]).toBe("london");
  });

  it("respects the limit", () => {
    const world: Bounds = { west: -180, south: -85, east: 180, north: 85 };
    expect(citiesInView(cities, world, 2)).toHaveLength(2);
  });

  it("handles a viewport crossing the antimeridian", () => {
    const pacific: Bounds = { west: 170, south: -30, east: -170, north: 0 };
    const names = citiesInView(cities, pacific).map((c) => c.id);
    expect(names).toContain("nuku");
    expect(names).not.toContain("paris");
  });

  it("presorted + finite limit: early-exits with the MOST populous matches", () => {
    const presorted = [...cities].sort((a, b) => (b.population ?? 0) - (a.population ?? 0));
    const world: Bounds = { west: -180, south: -85, east: 180, north: 85 };
    const top2 = citiesInView(presorted, world, 2, true).map((c) => c.id);
    expect(top2).toEqual(["tokyo", "london"]);
    // And a filtered viewport still respects the cap + order.
    const europe: Bounds = { west: -10, south: 40, east: 20, north: 60 };
    expect(citiesInView(presorted, europe, 1, true).map((c) => c.id)).toEqual(["london"]);
  });

  it("the spatial-grid path matches a brute-force scan (many cities, zoomed in)", () => {
    // A deterministic field of cities; no Math.random (unavailable in this env).
    const many: City[] = [];
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let i = 0; i < 4000; i++) {
      many.push(city(`c${i}`, rnd() * 170 - 85, rnd() * 360 - 180, Math.floor(rnd() * 1e6)));
    }
    const brute = (b: Bounds, limit: number) =>
      many
        .filter(
          (c) =>
            c.lat >= b.south &&
            c.lat <= b.north &&
            (b.west <= b.east
              ? c.lon >= b.west && c.lon <= b.east
              : c.lon >= b.west || c.lon <= b.east),
        )
        .sort((x, y) => (y.population ?? 0) - (x.population ?? 0))
        .slice(0, limit)
        .map((c) => c.id);
    // A zoomed-in window (few cells → grid path) must agree with brute force.
    for (const b of [
      { west: 2, south: 40, east: 12, north: 50 } as Bounds,
      { west: -100, south: 20, east: -80, north: 40 } as Bounds,
      { west: 175, south: -10, east: -175, north: 10 } as Bounds, // antimeridian
    ]) {
      expect(new Set(citiesInView(many, b, 20).map((c) => c.id))).toEqual(new Set(brute(b, 20)));
    }
  });

  it("the grid path matches a brute-force scan at the poles and the date line", () => {
    // Cities clustered where the grid's row-clamp / column-wrap edge cases bite:
    // the far north/south rows and either side of ±180°.
    const edge: City[] = [
      city("northpole", 89.9, 10, 500),
      city("northpole2", 89.4, -170, 600),
      city("svalbard", 78.2, 15.6, 2_600),
      city("southpole", -89.8, 0, 100),
      city("mcmurdo", -77.85, 166.7, 1_200), // Antarctica, near +180
      city("attu", 52.9, 172.9, 20), // just west of the date line
      city("adak", 51.88, -176.66, 300), // just east of the date line
      city("quito", -0.18, -78.47, 1_600_000), // equator, for good measure
    ];
    const brute = (b: Bounds, limit: number) =>
      new Set(
        edge
          .filter(
            (c) =>
              c.lat >= b.south &&
              c.lat <= b.north &&
              (b.west <= b.east
                ? c.lon >= b.west && c.lon <= b.east
                : c.lon >= b.west || c.lon <= b.east),
          )
          .sort((x, y) => (y.population ?? 0) - (x.population ?? 0))
          .slice(0, limit)
          .map((c) => c.id),
      );
    for (const b of [
      { west: -180, south: 80, east: 180, north: 90 } as Bounds, // north cap
      { west: -20, south: -90, east: 20, north: -70 } as Bounds, // south cap
      { west: 170, south: 45, east: -170, north: 60 } as Bounds, // date line, Aleutians
      { west: 160, south: -85, east: -160, north: -70 } as Bounds, // date line, Antarctica
    ]) {
      expect(new Set(citiesInView(edge, b, 20).map((c) => c.id))).toEqual(brute(b, 20));
    }
  });
});

describe("markerCitiesInView", () => {
  const nyc = city("nyc", 40.7, -74, 8_400_000);
  const boston = city("boston", 42.36, -71.06, 690_000);
  const philly = city("philly", 39.95, -75.16, 1_580_000);
  const usEast: Bounds = { west: -80, south: 36, east: -68, north: 45 };
  const set = [nyc, boston, philly];

  it("returns the population-capped in-view set (biggest kept)", () => {
    const two = markerCitiesInView(set, usEast, 2).map((c) => c.id);
    expect(two).toEqual(["nyc", "philly"]); // top two by population
  });

  it("filter 'visited' keeps only cities with a record", () => {
    const visited = new Set(["nyc", "boston"]);
    const ids = markerCitiesInView(set, usEast, 10, "visited", visited).map((c) => c.id);
    expect(new Set(ids)).toEqual(new Set(["nyc", "boston"]));
  });

  it("filter 'unvisited' drops cities with a record", () => {
    const visited = new Set(["nyc"]);
    const ids = markerCitiesInView(set, usEast, 10, "unvisited", visited).map((c) => c.id);
    expect(new Set(ids)).toEqual(new Set(["boston", "philly"]));
  });

  it("minPopulation drops cities below the headcount", () => {
    // boston (690k) falls below a 1M threshold; nyc + philly survive.
    const ids = markerCitiesInView(set, usEast, 10, "all", undefined, 1_000_000).map((c) => c.id);
    expect(new Set(ids)).toEqual(new Set(["nyc", "philly"]));
  });

  it("minPopulation combines with the status filter (AND)", () => {
    const visited = new Set(["nyc", "boston"]);
    // Of the visited cities (nyc, boston), only nyc clears the 1M threshold.
    const ids = markerCitiesInView(set, usEast, 10, "visited", visited, 1_000_000).map((c) => c.id);
    expect(ids).toEqual(["nyc"]);
  });

  it("minPopulation of 0 is a no-op (every in-view city kept)", () => {
    const ids = markerCitiesInView(set, usEast, 10, "all", undefined, 0).map((c) => c.id);
    expect(new Set(ids)).toEqual(new Set(["nyc", "boston", "philly"]));
  });

  it("null bounds yields nothing", () => {
    expect(markerCitiesInView(set, null, 10)).toEqual([]);
  });
});
