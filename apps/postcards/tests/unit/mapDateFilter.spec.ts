import { describe, it, expect } from "vitest";
import {
  matchesDateFilter,
  itemsInDateBucket,
  dateBuckets,
} from "../../src/features/travel/period";
import { visitedCountryIds } from "../../src/features/stats/computeStats";
import type { PlaceRef, Visit } from "../../src/lib/schema/models";

// The map's year filter reuses these helpers to narrow YOUR visited places to a
// period. These tests pin the qualifying rule for markers/list (itemsInDateBucket)
// and country shading (visitedCountryIds over the filtered set), plus the chips.

function visit(
  id: string,
  countryId: string,
  date: string | null,
  extra: Partial<Visit> = {},
): Visit {
  return {
    visitId: crypto.randomUUID(),
    place: { kind: "city", id, name: id, countryId } as PlaceRef,
    date,
    note: null,
    status: "visited",
    favorite: false,
    addedAt: "2024-01-01T00:00:00.000Z",
    ...extra,
  };
}

describe("matchesDateFilter", () => {
  it("'all' matches everything, dated or not", () => {
    expect(matchesDateFilter("2024-08-14", "all")).toBe(true);
    expect(matchesDateFilter(null, "all")).toBe(true);
  });
  it("'none' matches only undated items", () => {
    expect(matchesDateFilter(null, "none")).toBe(true);
    expect(matchesDateFilter(undefined, "none")).toBe(true);
    expect(matchesDateFilter("2024-08-14", "none")).toBe(false);
  });
  it("a year matches only dates in that year", () => {
    expect(matchesDateFilter("2024-01-01", "2024")).toBe(true);
    expect(matchesDateFilter("2024-12-31", "2024")).toBe(true);
    expect(matchesDateFilter("2023-12-31", "2024")).toBe(false);
    expect(matchesDateFilter(null, "2024")).toBe(false);
  });
});

describe("itemsInDateBucket (which visits qualify)", () => {
  const visits = [
    visit("a", "FR", "2024-08-14"),
    visit("b", "JP", "2023-03-02"),
    visit("c", "IT", "2024-01-05"),
    visit("d", "DE", null), // undated
  ];

  it("'all' keeps every visit", () => {
    expect(itemsInDateBucket(visits, "all")).toHaveLength(4);
  });
  it("a year keeps only that year's dated visits", () => {
    expect(itemsInDateBucket(visits, "2024").map((v) => v.place.id).sort()).toEqual(["a", "c"]);
    expect(itemsInDateBucket(visits, "2023").map((v) => v.place.id)).toEqual(["b"]);
  });
  it("'none' keeps only undated visits", () => {
    expect(itemsInDateBucket(visits, "none").map((v) => v.place.id)).toEqual(["d"]);
  });
  it("a year with no visits keeps nothing", () => {
    expect(itemsInDateBucket(visits, "2020")).toEqual([]);
  });
});

describe("country shading over a period (visitedCountryIds of the filtered set)", () => {
  const visits = [
    visit("a", "FR", "2024-08-14"),
    visit("b", "JP", "2023-03-02"),
    visit("c", "FR", "2023-06-01"), // FR again, different year
    visit("d", "DE", null), // undated
  ];

  it("'all' shades every visited country", () => {
    expect([...visitedCountryIds(itemsInDateBucket(visits, "all"))].sort()).toEqual([
      "DE",
      "FR",
      "JP",
    ]);
  });
  it("a year shades only countries with a qualifying visit that year", () => {
    expect([...visitedCountryIds(itemsInDateBucket(visits, "2024"))]).toEqual(["FR"]);
    expect([...visitedCountryIds(itemsInDateBucket(visits, "2023"))].sort()).toEqual(["FR", "JP"]);
  });
  it("'none' shades only countries reached by an undated visit", () => {
    expect([...visitedCountryIds(itemsInDateBucket(visits, "none"))]).toEqual(["DE"]);
  });
});

describe("dateBuckets (the year chips over visited places)", () => {
  it("lists distinct years newest-first and flags the undated bucket", () => {
    const b = dateBuckets([
      visit("a", "FR", "2024-08-14"),
      visit("b", "JP", "2023-03-02"),
      visit("c", "IT", "2024-01-05"),
      visit("d", "DE", null),
    ]);
    expect(b.years).toEqual(["2024", "2023"]);
    expect(b.undated).toBe(true);
  });
  it("has no undated bucket when every visit is dated", () => {
    const b = dateBuckets([visit("a", "FR", "2024-08-14")]);
    expect(b.years).toEqual(["2024"]);
    expect(b.undated).toBe(false);
  });
  it("is empty for no visits", () => {
    expect(dateBuckets([])).toEqual({ years: [], undated: false });
  });
});
