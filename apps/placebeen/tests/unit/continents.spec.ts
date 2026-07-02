import { describe, it, expect } from "vitest";
import { getReferenceData } from "../../src/lib/reference/referenceData";
import { continentColor, CONTINENT_COLORS } from "../../src/lib/reference/continents";

const ref = getReferenceData();

describe("continents", () => {
  it("maps countries to their continent/region", () => {
    expect(ref.continentOf("FR")).toBe("Europe");
    expect(ref.continentOf("JP")).toBe("Asia");
    expect(ref.continentOf("US")).toBe("Americas");
    expect(ref.continentOf("EG")).toBe("Africa");
    expect(ref.continentOf("AU")).toBe("Oceania");
  });

  it("exposes the continent on the country record", () => {
    expect(ref.countryByIso2("FR")?.continent).toBe("Europe");
  });

  it("resolves a color per continent with a fallback", () => {
    expect(continentColor("Europe")).toBe(CONTINENT_COLORS.Europe);
    expect(continentColor(undefined)).toBeTruthy();
  });
});
