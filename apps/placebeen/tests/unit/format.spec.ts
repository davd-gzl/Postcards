import { describe, it, expect } from "vitest";
import { countryFlag } from "../../src/lib/format/format";

describe("countryFlag", () => {
  it("builds the regional-indicator pair for a country", () => {
    expect(countryFlag("FR")).toBe("🇫🇷");
    expect(countryFlag("jp")).toBe("🇯🇵");
  });
  it("works for territories too", () => {
    expect(countryFlag("GP")).toBe("🇬🇵"); // Guadeloupe
    expect(countryFlag("RE")).toBe("🇷🇪"); // Réunion
  });
});
