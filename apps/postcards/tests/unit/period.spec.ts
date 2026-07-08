import { describe, it, expect } from "vitest";
import {
  periodLabel,
  tripMonths,
  tripYears,
  tripsInPeriod,
} from "../../src/features/travel/period";
import type { PlaceRef, Trip } from "../../src/lib/schema/models";

const p: PlaceRef = { kind: "city", id: "1", name: "A", countryId: "FR" };
const q: PlaceRef = { kind: "city", id: "2", name: "B", countryId: "JP" };

function trip(id: string, date: string | null): Trip {
  return {
    tripId: id,
    from: p,
    to: q,
    mode: "flight",
    date,
    carrier: null,
    note: null,
    addedAt: "2024-01-01T00:00:00.000Z",
  };
}

const trips: Trip[] = [
  trip("a", "2024-08-14"),
  trip("b", "2024-03-02"),
  trip("c", "2023-12-31"),
  trip("d", null), // undated
  trip("e", "2024-08-30"),
];

describe("tripYears", () => {
  it("lists distinct years newest-first, ignoring undated trips", () => {
    expect(tripYears(trips)).toEqual(["2024", "2023"]);
  });
  it("is empty when nothing is dated", () => {
    expect(tripYears([trip("x", null)])).toEqual([]);
  });
});

describe("tripMonths", () => {
  it("lists the months that have a trip in the given year, ascending", () => {
    expect(tripMonths(trips, "2024")).toEqual(["03", "08"]);
    expect(tripMonths(trips, "2023")).toEqual(["12"]);
  });
});

describe("tripsInPeriod", () => {
  it("returns everything (incl. undated) for 'all'", () => {
    expect(tripsInPeriod(trips, "all", "all")).toHaveLength(5);
  });
  it("keeps only dated trips in the chosen year", () => {
    const r = tripsInPeriod(trips, "2024", "all");
    expect(r.map((t) => t.tripId).sort()).toEqual(["a", "b", "e"]);
  });
  it("narrows further by month", () => {
    const r = tripsInPeriod(trips, "2024", "08");
    expect(r.map((t) => t.tripId).sort()).toEqual(["a", "e"]);
  });
  it("excludes undated trips once a year is chosen", () => {
    expect(tripsInPeriod(trips, "2024", "all").some((t) => t.date === null)).toBe(false);
  });
  it("is empty for a year with no trips", () => {
    expect(tripsInPeriod(trips, "2020", "all")).toEqual([]);
  });
});

describe("periodLabel", () => {
  it("formats all-time, year, and month+year", () => {
    expect(periodLabel("all", "all")).toBe("");
    expect(periodLabel("2024", "all")).toBe("2024");
    expect(periodLabel("2024", "08")).toBe("August 2024");
  });
});
