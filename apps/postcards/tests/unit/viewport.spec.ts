import { describe, it, expect } from "vitest";
import { citiesInView, type Bounds } from "../../src/features/map/viewport";
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
});
