import { describe, it, expect } from "vitest";
import { getReferenceData } from "../../src/lib/reference/referenceData";
import {
  coordsOf,
  haversineKm,
  travelTotals,
  tripDistanceKm,
} from "../../src/features/travel/distance";
import { serializeFile } from "../../src/features/backup/exportJson";
import { importFile } from "../../src/features/backup/importJson";
import { PlaceBeenFileSchema, type PlaceRef, type Trip } from "../../src/lib/schema/models";

const ref = getReferenceData();

function airportRef(iata: string): PlaceRef {
  const a = ref.airportById(iata)!;
  return { kind: "airport", id: a.id, name: `${a.name} (${a.id})`, countryId: a.countryIso2 };
}

function trip(from: PlaceRef, to: PlaceRef, mode: Trip["mode"] = "flight"): Trip {
  return {
    tripId: crypto.randomUUID(),
    from,
    to,
    mode,
    date: null,
    carrier: null,
    note: null,
    addedAt: new Date().toISOString(),
  };
}

describe("great-circle distance", () => {
  it("computes a known route (CDG ↔ JFK ≈ 5,835 km)", () => {
    const cdg = coordsOf(airportRef("CDG"), ref)!;
    const jfk = coordsOf(airportRef("JFK"), ref)!;
    const d = haversineKm(cdg, jfk);
    expect(d).toBeGreaterThan(5700);
    expect(d).toBeLessThan(5950);
  });

  it("is zero for identical points and symmetric", () => {
    const cdg = coordsOf(airportRef("CDG"), ref)!;
    const jfk = coordsOf(airportRef("JFK"), ref)!;
    expect(haversineKm(cdg, cdg)).toBeCloseTo(0, 6);
    expect(haversineKm(cdg, jfk)).toBeCloseTo(haversineKm(jfk, cdg), 6);
  });

  it("returns null distance when an endpoint has no coordinate (a country)", () => {
    const country: PlaceRef = { kind: "country", id: "FR", name: "France", countryId: "FR" };
    expect(coordsOf(country, ref)).toBeNull();
    expect(tripDistanceKm(trip(country, airportRef("JFK")), ref)).toBeNull();
  });
});

describe("travel totals", () => {
  it("counts trips and sums only trips with two resolvable endpoints", () => {
    const country: PlaceRef = { kind: "country", id: "FR", name: "France", countryId: "FR" };
    const trips = [
      trip(airportRef("CDG"), airportRef("JFK")),
      trip(airportRef("JFK"), airportRef("CDG")),
      trip(country, airportRef("JFK")), // no distance — must not fabricate one
    ];
    const totals = travelTotals(trips, ref);
    expect(totals.trips).toBe(3);
    const oneWay = tripDistanceKm(trips[0]!, ref)!;
    expect(totals.totalKm).toBeCloseTo(oneWay * 2, 3); // third trip contributes 0 km
  });

  it("breaks totals down by mode in a stable order", () => {
    const trips = [
      trip(airportRef("CDG"), airportRef("JFK"), "flight"),
      trip(airportRef("CDG"), airportRef("LHR"), "train"),
      trip(airportRef("LHR"), airportRef("CDG"), "train"),
    ];
    const { byMode } = travelTotals(trips, ref);
    expect(byMode.map((m) => m.mode)).toEqual(["flight", "train"]); // MODE_ORDER
    expect(byMode.find((m) => m.mode === "train")!.trips).toBe(2);
  });
});

describe("trips are portable (round-trip + backward compatible)", () => {
  it("exports and re-imports trips unchanged", () => {
    const trips = [trip(airportRef("CDG"), airportRef("JFK"))];
    const text = serializeFile([], trips);
    const result = importFile(text);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.trips).toEqual(trips);
  });

  it("imports an older file with no trips as an empty travel log", () => {
    const text = JSON.stringify({
      format: "placebeen",
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      visits: [],
    });
    const result = importFile(text);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.trips).toEqual([]);
  });

  it("sanitizes trip free-text on import (inert data)", () => {
    const evil = {
      format: "placebeen",
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      visits: [],
      trips: [
        {
          tripId: crypto.randomUUID(),
          from: { kind: "airport", id: "CDG", name: "CDG", countryId: "FR" },
          to: { kind: "airport", id: "JFK", name: "JFK", countryId: "US" },
          mode: "flight",
          date: null,
          carrier: "=cmd|' /c calc'!A1",
          note: null,
          addedAt: new Date().toISOString(),
        },
      ],
    };
    const parsed = PlaceBeenFileSchema.safeParse(evil);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.trips[0]!.carrier!.startsWith("=")).toBe(false);
  });
});
