import { describe, it, expect } from "vitest";
import { getReferenceData } from "../../src/lib/reference/referenceData";

const ref = getReferenceData();

describe("bundled gazetteer integrity (GeoNames cities15000)", () => {
  const cities = ref.allCities();

  it("is a real, sizeable gazetteer", () => {
    expect(cities.length).toBeGreaterThan(20000);
    expect(new Set(cities.map((c) => c.countryIso2)).size).toBeGreaterThan(180);
  });

  it("has unique GeoNames ids and valid records", () => {
    const ids = new Set<string>();
    for (const c of cities) {
      expect(ids.has(c.id)).toBe(false);
      ids.add(c.id);
      expect(c.name.length).toBeGreaterThan(0);
      expect(c.lat).toBeGreaterThanOrEqual(-90);
      expect(c.lat).toBeLessThanOrEqual(90);
      expect(c.lon).toBeGreaterThanOrEqual(-180);
      expect(c.lon).toBeLessThanOrEqual(180);
      expect(c.population ?? 0).toBeGreaterThanOrEqual(15000);
    }
  });

  it("keeps the population-sorted order the ranking relies on", () => {
    for (let i = 1; i < Math.min(cities.length, 5000); i++) {
      expect(cities[i - 1]!.population! >= cities[i]!.population!).toBe(true);
    }
  });

  it("maps every French city to a real (named) region", () => {
    const frRegions = new Set(ref.subdivisionsOf("FR").map((s) => s.id));
    expect(frRegions.size).toBe(13); // 13 metropolitan regions
    const fr = cities.filter((c) => c.countryIso2 === "FR");
    expect(fr.length).toBeGreaterThan(500);
    for (const c of fr) {
      expect(c.subdivisionId).toBeTruthy();
      expect(frRegions.has(c.subdivisionId!)).toBe(true);
    }
  });

  it("names first-level regions worldwide (Paris in Île-de-France, Tokyo prefecture)", () => {
    const paris = ref.cityById("2988507");
    expect(paris?.name).toBe("Paris");
    expect(paris?.subdivisionId).toBe("FR-11");
    expect(ref.subdivisionById(paris!.subdivisionId!)?.name).toBe("Île-de-France");
    // A non-FR country resolves a real region name (not a code placeholder).
    const tokyo = ref.searchCities("Tokyo")[0]!;
    const tokyoRegion = ref.subdivisionById(tokyo.subdivisionId!);
    expect(tokyoRegion?.name).toBeTruthy();
    expect(tokyoRegion?.name.includes(" region ")).toBe(false);
  });
});
