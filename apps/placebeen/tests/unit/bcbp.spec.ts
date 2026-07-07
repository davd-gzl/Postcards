import { describe, it, expect } from "vitest";
import { parseBcbp, julianToDate } from "../../src/lib/bcbp/parse";

// A valid single-leg boarding pass (IATA BCBP): Luc Desmarais, YUL→FRA, AF/AC834, day 226.
const ONE_LEG = "M1DESMARAIS/LUC       EABC123 YULFRAAC 0834 226F001A0025 100";
// Two legs: YUL→FRA then FRA→NRT (a connection).
const TWO_LEGS =
  "M2DESMARAIS/LUC       E" +
  "ABC123 YULFRAAC 0834 226F001A0025 100" +
  "ABC123 FRANRTAF 0290 228Y012C0031 100";

describe("parseBcbp", () => {
  it("parses a single-leg pass into from/to/carrier/flight/day", () => {
    const r = parseBcbp(ONE_LEG)!;
    expect(r).not.toBeNull();
    expect(r.passengerName).toBe("DESMARAIS/LUC");
    expect(r.legs).toHaveLength(1);
    expect(r.legs[0]).toMatchObject({
      from: "YUL",
      to: "FRA",
      carrier: "AC",
      flightNumber: "834", // leading zeros stripped
      julianDay: 226,
    });
  });

  it("walks the variable-length fields to parse every leg of a connection", () => {
    const r = parseBcbp(TWO_LEGS)!;
    expect(r.legs.map((l) => `${l.from}-${l.to}`)).toEqual(["YUL-FRA", "FRA-NRT"]);
    expect(r.legs[1]!.julianDay).toBe(228);
  });

  it("rejects things that aren't boarding passes (never invents a trip)", () => {
    expect(parseBcbp("")).toBeNull();
    expect(parseBcbp("hello world")).toBeNull();
    expect(parseBcbp("https://example.com/some/qr/url")).toBeNull();
    // Right shape but non-IATA airport codes → rejected.
    expect(parseBcbp("M1TEST/A             E1234567 99988877712 226F001A0025 100")).toBeNull();
  });

  it("tolerates a trailing newline from a scanner", () => {
    expect(parseBcbp(ONE_LEG + "\r\n")?.legs[0]?.from).toBe("YUL");
  });
});

describe("julianToDate", () => {
  it("resolves the day-of-year within the current year when it's in the past", () => {
    // Day 226 = 14 Aug; scanning on 1 Sep 2026 → 2026-08-14.
    expect(julianToDate(226, new Date("2026-09-01T00:00:00Z"))).toBe("2026-08-14");
  });

  it("assumes last year when this year's date would be in the future", () => {
    // Scanning on 7 Jul 2026, a day-226 (14 Aug) pass is for a flight already taken → 2025.
    expect(julianToDate(226, new Date("2026-07-07T00:00:00Z"))).toBe("2025-08-14");
  });
});
