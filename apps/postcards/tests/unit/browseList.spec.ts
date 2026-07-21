import { describe, it, expect, beforeEach } from "vitest";
import { browseList, __resetBrowseCache } from "../../src/features/visits/browseList";
import { DEFAULT_FILTERS } from "../../src/lib/store/useFilters";
import type { ReferenceData, City, HeritageSite, Airport, Country } from "../../src/lib/reference/types";
import type { Visit } from "../../src/lib/schema/models";

const cities: City[] = [
  { id: "paris", name: "Paris", countryIso2: "FR", subdivisionId: null, lat: 48.85, lon: 2.35, population: 2_100_000 },
  { id: "lyon", name: "Lyon", countryIso2: "FR", subdivisionId: null, lat: 45.75, lon: 4.85, population: 500_000 },
  { id: "tokyo", name: "Tokyo", countryIso2: "JP", subdivisionId: null, lat: 35.68, lon: 139.69, population: 9_000_000 },
];
const heritage: HeritageSite[] = [
  { id: "h1", name: "Mont-Saint-Michel", countryIso2: "FR", lat: 48.6, lon: -1.5, category: "cultural" },
  { id: "h2", name: "Yakushima", countryIso2: "JP", lat: 30.3, lon: 130.5, category: "natural" },
];
const airports: Airport[] = [
  { id: "CDG", name: "Charles de Gaulle", city: "Paris", countryIso2: "FR", lat: 49, lon: 2.5 },
  { id: "HND", name: "Haneda", city: "Tokyo", countryIso2: "JP", lat: 35.5, lon: 139.8 },
];
const countries: Record<string, Country> = {
  FR: { iso2: "FR", iso3: "FRA", numeric: "250", name: "France", continent: "Europe", cityCount: 2, bigCityCount: 2, subdivisionCount: 1, sovereignty: "un" },
  JP: { iso2: "JP", iso3: "JPN", numeric: "392", name: "Japan", continent: "Asia", cityCount: 1, bigCityCount: 1, subdivisionCount: 1, sovereignty: "un" },
};

const lc = (s: string) => s.toLowerCase();
const ref = {
  allCities: () => cities,
  allHeritage: () => heritage,
  allAirports: () => airports,
  searchCities: (q: string) => cities.filter((c) => lc(c.name).includes(lc(q))),
  searchHeritage: (q: string) => heritage.filter((h) => lc(h.name).includes(lc(q))),
  searchAirports: (q: string) => airports.filter((a) => lc(a.name).includes(lc(q)) || lc(a.id) === lc(q)),
  countryByIso2: (iso2: string) => countries[iso2],
  continentOf: (iso2: string) => countries[iso2]?.continent ?? "",
} as unknown as ReferenceData;

const visit = (
  kind: "city" | "heritage" | "airport",
  id: string,
  status: "visited" | "wishlist",
  favorite = false,
): Visit =>
  ({ visitId: `v-${id}`, place: { kind, id, name: id, countryId: "FR" }, status, favorite }) as Visit;

const F = DEFAULT_FILTERS;

beforeEach(() => __resetBrowseCache());

describe("browseList — reference browse + personal status overlay (spec 018 US2)", () => {
  it("lists ALL reference cities, most-populous first, marked not-visited by default", () => {
    const rows = browseList("cities", "all", F, ref, [], "");
    expect(rows.map((r) => r.id)).toEqual(["tokyo", "paris", "lyon"]); // population-ranked
    expect(rows.every((r) => r.status === "none")).toBe(true);
  });

  it("overlays personal status from visits", () => {
    const rows = browseList("cities", "all", F, ref, [visit("city", "tokyo", "visited")], "");
    expect(rows.find((r) => r.id === "tokyo")?.status).toBe("visited");
    expect(rows.find((r) => r.id === "paris")?.status).toBe("none");
  });

  it("status = notVisited excludes anything you've logged", () => {
    const rows = browseList("cities", "notVisited", F, ref, [visit("city", "tokyo", "visited")], "");
    expect(rows.map((r) => r.id)).not.toContain("tokyo");
    expect(rows.map((r) => r.id)).toEqual(["paris", "lyon"]);
  });

  it("status = visited / wishlist / favorites filter the overlay", () => {
    const visits = [visit("city", "tokyo", "visited", true), visit("city", "paris", "wishlist")];
    expect(browseList("cities", "visited", F, ref, visits, "").map((r) => r.id)).toEqual(["tokyo"]);
    expect(browseList("cities", "wishlist", F, ref, visits, "").map((r) => r.id)).toEqual(["paris"]);
    expect(browseList("cities", "favorites", F, ref, visits, "").map((r) => r.id)).toEqual(["tokyo"]);
  });

  it("search narrows within the kind", () => {
    expect(browseList("cities", "all", F, ref, [], "tok").map((r) => r.id)).toEqual(["tokyo"]);
  });

  it("monuments carry their category; the category filter narrows them", () => {
    const all = browseList("monuments", "all", F, ref, [], "");
    expect(all.find((r) => r.id === "h1")?.category).toBe("cultural");
    const cultural = browseList("monuments", "all", { ...F, category: "cultural" }, ref, [], "");
    expect(cultural.map((r) => r.id)).toEqual(["h1"]);
  });

  it("airports browse the world, name includes the IATA code", () => {
    const rows = browseList("airports", "all", F, ref, [], "");
    expect(rows.map((r) => r.id).sort()).toEqual(["CDG", "HND"]);
    expect(rows.find((r) => r.id === "CDG")?.name).toContain("(CDG)");
  });

  it("continent filter narrows every kind", () => {
    const rows = browseList("cities", "all", { ...F, continent: "Asia" }, ref, [], "");
    expect(rows.map((r) => r.id)).toEqual(["tokyo"]);
  });
});
