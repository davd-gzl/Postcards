import { describe, it, expect } from "vitest";
import { getReferenceData } from "../../src/lib/reference/referenceData";
import {
  computeCoverage,
  computeContinentCoverage,
  visitedCountriesList,
} from "../../src/features/stats/computeStats";
import type { Visit } from "../../src/lib/schema/models";

// SC-004: statistics update within 1 second on a history of ≥ 10,000 visits.
// Built against the real gazetteer so the denominators are realistic.
describe("stats performance at 10k visits (SC-004)", () => {
  const ref = getReferenceData();

  it("recomputes all stats views in under a second", () => {
    const cities = ref.allCities().slice(0, 10_000);
    expect(cities.length).toBe(10_000);
    const visits: Visit[] = cities.map((c, i) => ({
      visitId: `perf-${i}`,
      place: { kind: "city", id: c.id, name: c.name, countryId: c.countryIso2 },
      status: "visited",
      favorite: false,
      date: null,
      note: null,
      addedAt: "2026-01-01T00:00:00.000Z",
    }));

    const t0 = performance.now();
    const coverage = computeCoverage(visits, ref);
    const continents = computeContinentCoverage(visits, ref);
    const countries = visitedCountriesList(visits, ref);
    const elapsed = performance.now() - t0;

    expect(coverage.citiesVisited).toBe(10_000);
    expect(continents.length).toBeGreaterThan(3);
    expect(countries.length).toBeGreaterThan(50);
    // The spec's budget is 1s; leave headroom for slow CI machines only in
    // reporting, not in the assertion — the budget IS the requirement.
    expect(elapsed).toBeLessThan(1000);
  });
});
