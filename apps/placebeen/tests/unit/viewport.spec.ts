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
});
