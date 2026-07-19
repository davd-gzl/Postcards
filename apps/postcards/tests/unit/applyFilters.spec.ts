import { describe, it, expect } from "vitest";
import { getReferenceData } from "../../src/lib/reference/referenceData";
import { placeMatches, sortPlaces, activeChips } from "../../src/features/filter/applyFilters";
import { DEFAULT_FILTERS, type FilterState } from "../../src/lib/store/useFilters";
import type { Visit, Photo } from "../../src/lib/schema/models";
import type { City } from "../../src/lib/reference/types";
import type { TFunction } from "../../src/lib/i18n";

const ref = getReferenceData();
const paris = ref.searchCities("Paris")[0]!; // >1M, FR (Europe)
const tokyo = ref.searchCities("Tokyo")[0]!; // >1M, JP (Asia)

function cityVisit(city: City, opts: Partial<Visit> = {}): Visit {
  return {
    visitId: crypto.randomUUID(),
    place: { kind: "city", id: city.id, name: city.name, countryId: city.countryIso2 },
    date: null,
    note: null,
    status: "visited",
    favorite: false,
    addedAt: new Date().toISOString(),
    ...opts,
  };
}
const st = (o: Partial<FilterState>): FilterState => ({ ...DEFAULT_FILTERS, ...o });
const photo: Photo = { src: "data:image/png;base64,AAAA", caption: null };

describe("placeMatches", () => {
  it("passes everything under default filters", () => {
    expect(placeMatches(cityVisit(paris), ref, DEFAULT_FILTERS)).toBe(true);
  });

  it("status matches the record (visited vs wishlist); multi-select is OR", () => {
    expect(placeMatches(cityVisit(paris, { status: "visited" }), ref, st({ status: ["visited"] }))).toBe(true);
    expect(placeMatches(cityVisit(paris, { status: "wishlist" }), ref, st({ status: ["visited"] }))).toBe(false);
    // A record shows if its status is among the selected ones (OR across the set).
    expect(placeMatches(cityVisit(paris, { status: "wishlist" }), ref, st({ status: ["visited", "wishlist"] }))).toBe(true);
    // Empty = show everything.
    expect(placeMatches(cityVisit(paris, { status: "wishlist" }), ref, st({ status: [] }))).toBe(true);
  });

  it("population gates cities but not non-city places (D4)", () => {
    expect(placeMatches(cityVisit(paris), ref, st({ minPop: 1_000_000 }))).toBe(true); // Paris >1M
    const custom: Visit = {
      ...cityVisit(paris),
      place: { kind: "custom", id: "c1", name: "spot", countryId: "FR", lat: 0, lon: 0 },
    };
    expect(placeMatches(custom, ref, st({ minPop: 1_000_000 }))).toBe(true); // no population → passes
  });

  it("favoritesOnly / hasPhoto / hasNote", () => {
    expect(placeMatches(cityVisit(paris, { favorite: false }), ref, st({ favoritesOnly: true }))).toBe(false);
    expect(placeMatches(cityVisit(paris, { favorite: true }), ref, st({ favoritesOnly: true }))).toBe(true);
    expect(placeMatches(cityVisit(paris, { note: "hi" }), ref, st({ hasNote: true }))).toBe(true);
    expect(placeMatches(cityVisit(paris, { note: null }), ref, st({ hasNote: true }))).toBe(false);
    expect(placeMatches(cityVisit(paris, { photos: [photo] }), ref, st({ hasPhoto: true }))).toBe(true);
    expect(placeMatches(cityVisit(paris), ref, st({ hasPhoto: true }))).toBe(false);
  });

  it("continent + folder", () => {
    expect(placeMatches(cityVisit(paris), ref, st({ continent: "Europe" }))).toBe(true);
    expect(placeMatches(cityVisit(tokyo), ref, st({ continent: "Europe" }))).toBe(false);
    expect(placeMatches(cityVisit(paris, { folder: "Japan" }), ref, st({ folder: "Japan" }))).toBe(true);
    expect(placeMatches(cityVisit(paris), ref, st({ folder: "Japan" }))).toBe(false);
  });
});

describe("sortPlaces", () => {
  it("orders by population then name for 'pop', alphabetical for 'az'", () => {
    const list = [cityVisit(paris), cityVisit(tokyo)];
    const byPop = sortPlaces(list, ref, st({ sort: "pop" })).map((v) => v.place.name);
    // Tokyo is larger than Paris → first under "pop".
    expect(byPop[0]).toBe(tokyo.name);
    const az = sortPlaces(list, ref, st({ sort: "az" })).map((v) => v.place.name);
    expect(az).toEqual([...az].sort((a, b) => a.localeCompare(b)));
  });
});

describe("activeChips", () => {
  const t = ((k: string) => k) as unknown as TFunction;
  it("is empty for default filters", () => {
    expect(activeChips(DEFAULT_FILTERS, t)).toEqual([]);
  });
  it("emits one chip per non-default dimension", () => {
    const chips = activeChips(st({ status: ["wishlist"], minPop: 1_000_000, favoritesOnly: true }), t);
    const fields = chips.map((c) => c.field);
    expect(fields).toContain("status");
    expect(fields).toContain("minPop");
    expect(fields).toContain("favoritesOnly");
    expect(chips.find((c) => c.field === "minPop")!.label).toBe("1M+");
  });
});
