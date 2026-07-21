import { describe, it, expect } from "vitest";
import { parseCoordsInput } from "../../src/features/visits/coordsInput";

describe("parseCoordsInput — hand-typed coordinate parsing + reversal guard", () => {
  it("reads the documented latitude-first order as typed", () => {
    expect(parseCoordsInput("48.85, 2.35")).toEqual({ lat: 48.85, lon: 2.35, swapped: false });
  });

  it("accepts the common separators (comma, semicolon, whitespace)", () => {
    expect(parseCoordsInput("48.85; 2.35")).toEqual({ lat: 48.85, lon: 2.35, swapped: false });
    expect(parseCoordsInput("48.85 2.35")).toEqual({ lat: 48.85, lon: 2.35, swapped: false });
  });

  it("keeps latitude-first when BOTH readings are in range (can't disambiguate)", () => {
    // Paris pasted as lon, lat — both ≤ 90, so we respect the documented order and
    // rely on the form's country preview to surface a genuine mix-up.
    expect(parseCoordsInput("2.35, 48.85")).toEqual({ lat: 2.35, lon: 48.85, swapped: false });
  });

  it("corrects a reversed pair when latitude-first is physically impossible", () => {
    // Sydney as lon, lat: 151.2 can't be a latitude, so this is unambiguously
    // reversed — flip it and flag the swap.
    expect(parseCoordsInput("151.2, -33.87")).toEqual({ lat: -33.87, lon: 151.2, swapped: true });
    // Tokyo the same way.
    expect(parseCoordsInput("139.69, 35.68")).toEqual({ lat: 35.68, lon: 139.69, swapped: true });
  });

  it("handles negative and integer values", () => {
    expect(parseCoordsInput("-33.87, 151.2")).toEqual({ lat: -33.87, lon: 151.2, swapped: false });
    expect(parseCoordsInput("0, 0")).toEqual({ lat: 0, lon: 0, swapped: false });
  });

  it("rejects garbage and out-of-range pairs", () => {
    expect(parseCoordsInput("")).toBeNull();
    expect(parseCoordsInput("hello")).toBeNull();
    expect(parseCoordsInput("48.85")).toBeNull();
    expect(parseCoordsInput("200, 300")).toBeNull(); // neither reading is valid
    expect(parseCoordsInput("91, 200")).toBeNull(); // 91 not a lat, 200 not a lon either way
  });
});
