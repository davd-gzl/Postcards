import { describe, it, expect } from "vitest";
import {
  addMonths,
  dayIntensity,
  hexToRgba,
  monthMatrix,
  storyDayIndex,
  ymOf,
} from "../../src/features/journal/calendar";
import { CONTINENT_COLORS, CONTINENT_FALLBACK } from "../../src/lib/reference/continents";

// A fixed, offline continent lookup — the helper stays pure (no reference data).
const continentOf = (iso2: string): string =>
  ({ FR: "Europe", JP: "Asia", US: "Americas" })[iso2] ?? "";

describe("calendar month math", () => {
  it("ymOf takes the YYYY-MM prefix of an ISO day", () => {
    expect(ymOf("2026-07-15")).toBe("2026-07");
  });

  it("addMonths crosses year boundaries both ways", () => {
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-07", 0)).toBe("2026-07");
  });
});

describe("monthMatrix (grid layout)", () => {
  it("lays a month out as full 7-day weeks with the right in-month days", () => {
    const weeks = monthMatrix("2026-02"); // Feb 2026, 28 days; Feb 1 is a Sunday
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    const inMonth = weeks.flat().filter((d) => d.inMonth);
    expect(inMonth.map((d) => d.dayOfMonth)).toEqual(Array.from({ length: 28 }, (_, i) => i + 1));
    expect(inMonth[0]!.iso).toBe("2026-02-01");
    expect(inMonth[27]!.iso).toBe("2026-02-28");
    // Monday-first grid: a Sunday 1st sits in the last column (index 6).
    const flat = weeks.flat();
    expect(flat.findIndex((d) => d.iso === "2026-02-01") % 7).toBe(6);
    // Padding days are flagged out-of-month and never counted as entries.
    expect(flat.filter((d) => !d.inMonth).length).toBe(flat.length - 28);
  });

  it("pads the trailing week from the next month", () => {
    const weeks = monthMatrix("2026-01"); // Jan 2026, 31 days
    const last = weeks[weeks.length - 1]!;
    expect(last).toHaveLength(7);
    // The grid is a whole number of weeks.
    expect(weeks.flat().length % 7).toBe(0);
  });
});

describe("dayIntensity (tint alpha by entry count)", () => {
  it("is 0 with no entries and rises with the count, capped at 0.55", () => {
    expect(dayIntensity(0)).toBe(0);
    expect(dayIntensity(1)).toBeCloseTo(0.22);
    expect(dayIntensity(2)).toBeCloseTo(0.33);
    expect(dayIntensity(3)).toBeGreaterThan(dayIntensity(1));
    expect(dayIntensity(20)).toBe(0.55); // capped
  });
});

describe("hexToRgba", () => {
  it("expands a #rrggbb colour to an rgba() string with the given alpha", () => {
    expect(hexToRgba("#2a78d6", 0.5)).toBe("rgba(42, 120, 214, 0.5)");
  });
});

describe("storyDayIndex (per-day colour + count)", () => {
  const stories = [
    { date: "2026-07-01", place: { countryId: "FR" } },
    { date: "2026-07-01", place: { countryId: "FR" } },
    { date: "2026-07-01", place: { countryId: "JP" } },
    { date: "2026-07-05", place: { countryId: "US" } },
  ];

  it("tints only days with entries, counts them, and colours by the dominant place", () => {
    const idx = storyDayIndex(stories, continentOf);
    // Two days have entries; empty days are simply absent (they render neutral).
    expect(idx.size).toBe(2);
    expect(idx.has("2026-07-02")).toBe(false);

    const d1 = idx.get("2026-07-01")!;
    expect(d1.count).toBe(3);
    expect(d1.countryId).toBe("FR"); // 2 FR vs 1 JP → France dominates the day
    expect(d1.continent).toBe("Europe");
    expect(d1.color).toBe(CONTINENT_COLORS.Europe);
    expect(d1.intensity).toBeCloseTo(dayIntensity(3));

    const d5 = idx.get("2026-07-05")!;
    expect(d5.count).toBe(1);
    expect(d5.color).toBe(CONTINENT_COLORS.Americas);
  });

  it("breaks a count tie deterministically (lexicographically smaller code)", () => {
    const idx = storyDayIndex(
      [
        { date: "2026-07-10", place: { countryId: "JP" } },
        { date: "2026-07-10", place: { countryId: "FR" } },
      ],
      continentOf,
    );
    expect(idx.get("2026-07-10")!.countryId).toBe("FR"); // "FR" < "JP"
  });

  it("falls back to the neutral colour when the continent is unknown", () => {
    const idx = storyDayIndex([{ date: "2026-07-20", place: { countryId: "ZZ" } }], continentOf);
    const cell = idx.get("2026-07-20")!;
    expect(cell.continent).toBe("");
    expect(cell.color).toBe(CONTINENT_FALLBACK);
  });
});
