import { describe, it, expect } from "vitest";
import { getReferenceData } from "../../src/lib/reference/referenceData";
import { computeCoverage, computeCountryCoverage } from "../../src/features/stats/computeStats";
import type { Visit } from "../../src/lib/schema/models";

const ref = getReferenceData();

function cityVisit(id: string, name: string, countryId: string): Visit {
  return {
    visitId: crypto.randomUUID(),
    place: { kind: "city", id, name, countryId },
    date: null,
    note: null,
    addedAt: new Date().toISOString(),
  };
}

describe("coverage statistics", () => {
  const visits = [
    cityVisit("paris-fr", "Paris", "FR"),
    cityVisit("lyon-fr", "Lyon", "FR"),
    cityVisit("tokyo-jp", "Tokyo", "JP"),
  ];

  it("counts countries, cities and % of world", () => {
    const cov = computeCoverage(visits, ref);
    expect(cov.countriesVisited).toBe(2); // FR, JP
    expect(cov.citiesVisited).toBe(3);
    expect(cov.worldCountryCount).toBeGreaterThan(190);
    expect(cov.worldPct).toBeCloseTo(2 / cov.worldCountryCount, 6);
  });

  it("computes BOTH per-country metrics: % of cities and % of regions", () => {
    const fr = computeCountryCoverage(visits, ref, "FR");
    expect(fr.citiesVisited).toBe(2);
    expect(fr.citiesTotal).toBe(14); // starter FR gazetteer
    expect(fr.regionsVisited).toBe(2); // Île-de-France + Auvergne-Rhône-Alpes
    expect(fr.regionsTotal).toBe(13); // starter FR regions
    expect(fr.cityPct).toBeCloseTo(2 / 14, 6);
    expect(fr.regionPct).toBeCloseTo(2 / 13, 6);
  });
});
