import { describe, it, expect } from "vitest";
import { getReferenceData } from "../../src/lib/reference/referenceData";
import { inScope } from "../../src/lib/reference/scope";
import { computeCoverage } from "../../src/features/stats/computeStats";
import type { Visit } from "../../src/lib/schema/models";

const ref = getReferenceData();

function countryVisit(iso2: string, name: string): Visit {
  return {
    visitId: crypto.randomUUID(),
    place: { kind: "country", id: iso2, name, countryId: iso2 },
    date: null,
    note: null,
    status: "visited" as const,
    favorite: false,
    addedAt: new Date().toISOString(),
  };
}

describe("inScope", () => {
  it("'all' admits both UN members and territories", () => {
    expect(inScope("un", "all")).toBe(true);
    expect(inScope("territory", "all")).toBe(true);
  });
  it("'un' admits only UN members", () => {
    expect(inScope("un", "un")).toBe(true);
    expect(inScope("territory", "un")).toBe(false);
  });
});

describe("reference classification", () => {
  it("marks Hong Kong / Jersey as territories and France / US as UN members", () => {
    expect(ref.countryByIso2("HK")?.sovereignty).toBe("territory");
    expect(ref.countryByIso2("JE")?.sovereignty).toBe("territory");
    expect(ref.countryByIso2("FR")?.sovereignty).toBe("un");
    expect(ref.countryByIso2("US")?.sovereignty).toBe("un");
  });

  it("counts exactly 193 UN members — the Holy See is a non-member observer", () => {
    expect(ref.countryByIso2("VA")?.sovereignty).toBe("territory");
    expect(ref.worldCountryCount("un")).toBe(193);
  });
});

describe("worldCountryCount(scope)", () => {
  it("counts fewer under 'un' than 'all', matching the classification", () => {
    const all = ref.worldCountryCount("all");
    const un = ref.worldCountryCount("un");
    const unExpected = ref.countries.filter((c) => c.sovereignty === "un").length;
    expect(all).toBe(ref.countries.length);
    expect(un).toBe(unExpected);
    expect(un).toBeLessThan(all);
    expect(un).toBeGreaterThan(180); // ~193 UN members
  });
});

describe("computeCoverage honours the scope", () => {
  const visits = [countryVisit("FR", "France"), countryVisit("HK", "Hong Kong")];

  it("counts a visited territory under 'all'", () => {
    expect(computeCoverage(visits, ref, "all").countriesVisited).toBe(2);
  });
  it("drops the territory under 'un'", () => {
    expect(computeCoverage(visits, ref, "un").countriesVisited).toBe(1);
  });
  it("defaults to counting everything", () => {
    expect(computeCoverage(visits, ref).countriesVisited).toBe(2);
  });
});
