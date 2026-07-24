import { describe, it, expect } from "vitest";
import { initReferenceDataSync } from "../../src/lib/reference/referenceData";
import type { Station } from "../../src/lib/reference/types";
import { PlaceRefSchema } from "../../src/lib/schema/models";

const stations: Station[] = [
  { id: "Q-gdl", name: "Paris Gare de Lyon", countryIso2: "FR", subdivisionId: null, lat: 48.84, lon: 2.37 },
  { id: "Q-pdd", name: "Lyon Part-Dieu", countryIso2: "FR", subdivisionId: null, lat: 45.76, lon: 4.86 },
  { id: "Q-tok", name: "Tokyo Station", countryIso2: "JP", subdivisionId: null, lat: 35.68, lon: 139.77 },
];

function ref() {
  return initReferenceDataSync([], [], [], [], {}, {}, stations);
}

describe("reference seam: railway stations", () => {
  it("indexes and returns all stations", () => {
    expect(ref().allStations()).toHaveLength(3);
  });

  it("looks a station up by its raw (opaque) id — no upper-casing", () => {
    expect(ref().stationById("Q-gdl")?.name).toBe("Paris Gare de Lyon");
    expect(ref().stationById("Q-GDL")).toBeUndefined(); // ids are opaque, not codes
  });

  it("searches stations by name (prefix before contains), accent/case-insensitive", () => {
    const r = ref();
    expect(r.searchStations("gare").map((s) => s.id)).toEqual(["Q-gdl"]);
    expect(r.searchStations("part").map((s) => s.id)).toEqual(["Q-pdd"]);
    expect(r.searchStations("station").map((s) => s.id)).toEqual(["Q-tok"]);
    expect(r.searchStations("")).toEqual([]);
  });

  it("groups stations per country for coverage (stationsOf)", () => {
    const r = ref();
    expect(r.stationsOf("FR").map((s) => s.id).sort()).toEqual(["Q-gdl", "Q-pdd"]);
    expect(r.stationsOf("jp")).toHaveLength(1); // case-insensitive iso2
    expect(r.stationsOf("ZZ")).toEqual([]);
  });

  it("degrades gracefully when no station data is present", () => {
    const r = initReferenceDataSync([], []);
    expect(r.allStations()).toEqual([]);
    expect(r.searchStations("gare")).toEqual([]);
    expect(r.stationsOf("FR")).toEqual([]);
  });
});

describe("schema: a station PlaceRef (v14)", () => {
  it("accepts kind 'station' and round-trips", () => {
    const parsed = PlaceRefSchema.parse({ kind: "station", id: "Q-gdl", name: "Paris Gare de Lyon", countryId: "FR" });
    expect(parsed.kind).toBe("station");
    expect(parsed.name).toBe("Paris Gare de Lyon");
  });
});
