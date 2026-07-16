import { describe, it, expect } from "vitest";
import { countryAtPoint } from "../../src/lib/reference/countryAtPoint";
import type { City } from "../../src/lib/reference/types";

const city = (id: string, cc: string, lat: number, lon: number): City =>
  ({ id, name: id, countryIso2: cc, lat, lon, population: 1000 }) as City;

const cities: City[] = [
  city("paris", "FR", 48.85, 2.35),
  city("rome", "IT", 41.9, 12.5),
  city("tokyo", "JP", 35.68, 139.69),
  city("nyc", "US", 40.71, -74.0),
];

describe("countryAtPoint", () => {
  it("returns the country of the nearest city", () => {
    // A pin dropped just outside Paris → France, no manual pick needed.
    expect(countryAtPoint(cities, 48.86, 2.34)).toBe("FR");
    expect(countryAtPoint(cities, 35.7, 139.7)).toBe("JP");
    expect(countryAtPoint(cities, 40.72, -74.01)).toBe("US");
  });

  it("widens the search box when the nearest city is a few degrees away", () => {
    // ~4° north-west of Paris — outside the tight boxes, found once it widens.
    expect(countryAtPoint(cities, 45, 5)).toBe("FR");
  });

  it("returns null in truly empty ocean beyond the widest box", () => {
    // A single far-flung city and a point on the opposite side of the globe,
    // outside even the ~20° box → left blank for the user to pick.
    expect(countryAtPoint([city("x", "NZ", -41, 174)], 60, -60)).toBeNull();
  });

  it("returns null for an empty gazetteer", () => {
    expect(countryAtPoint([], 48.85, 2.35)).toBeNull();
  });
});
