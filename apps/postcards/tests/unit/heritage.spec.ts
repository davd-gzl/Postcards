import { describe, it, expect } from "vitest";
import { initReferenceDataSync } from "../../src/lib/reference/referenceData";
import { computeCountryCoverage } from "../../src/features/stats/computeStats";
import { searchPlaces } from "../../src/features/visits/search";
import type { HeritageSite } from "../../src/lib/reference/types";
import type { Visit } from "../../src/lib/schema/models";

// The shipped heritage.json is empty until `scripts/build-heritage.mjs` is run on
// a networked machine (Wikidata is blocked in the build sandbox). These tests
// exercise the framework wiring with injected data so the logic is verified now.
const heritage: HeritageSite[] = [
  { id: "Q1", name: "Palace of Versailles", countryIso2: "FR", lat: 48.8, lon: 2.1 },
  { id: "Q2", name: "Mont-Saint-Michel", countryIso2: "FR", lat: 48.6, lon: -1.5 },
  { id: "Q3", name: "Historic Centre of Rome", countryIso2: "IT", lat: 41.9, lon: 12.5 },
];
const ref = initReferenceDataSync([], [], [], heritage);

function heritageVisit(id: string, iso2: string): Visit {
  return {
    visitId: crypto.randomUUID(),
    place: { kind: "heritage", id, name: id, countryId: iso2 },
    date: null,
    note: null,
    status: "visited" as const,
    favorite: false,
    addedAt: new Date().toISOString(),
  };
}

describe("reference: heritage sites", () => {
  it("indexes sites by id and by country, and searches by name", () => {
    expect(ref.allHeritage()).toHaveLength(3);
    expect(ref.heritageOf("FR")).toHaveLength(2);
    expect(ref.heritageOf("IT")).toHaveLength(1);
    expect(ref.heritageOf("JP")).toHaveLength(0);
    expect(ref.heritageById("Q1")?.name).toBe("Palace of Versailles");
    expect(ref.searchHeritage("versailles")[0]?.id).toBe("Q1");
  });

  it("surfaces heritage sites in the unified place search", () => {
    const results = searchPlaces(ref, "Mont-Saint");
    expect(results.some((r) => r.place.kind === "heritage" && r.place.id === "Q2")).toBe(true);
  });
});

describe("stats: per-country heritage coverage", () => {
  it("counts visited sites against the country's total", () => {
    const fr = computeCountryCoverage([heritageVisit("Q1", "FR")], ref, "FR");
    expect(fr.heritageTotal).toBe(2);
    expect(fr.heritageVisited).toBe(1);
    expect(fr.heritagePct).toBeCloseTo(0.5);
  });

  it("never counts a site toward the wrong country", () => {
    const fr = computeCountryCoverage([heritageVisit("Q3", "IT")], ref, "FR");
    expect(fr.heritageVisited).toBe(0);
    expect(fr.heritageTotal).toBe(2);
  });
});
