import { describe, it, expect } from "vitest";
import { addStop, removeStop, moveStop, endpoints } from "../../src/features/travel/tripStops";
import type { PlaceRef } from "../../src/lib/schema/models";

const p = (id: string): PlaceRef => ({ kind: "airport", id, name: id, countryId: "FR" });
const [a, b, c, d] = [p("A"), p("B"), p("C"), p("D")];

describe("tripStops — immutable ordered-stop helpers (spec 019)", () => {
  it("addStop appends without mutating the input", () => {
    const src = [a, b];
    const out = addStop(src, c);
    expect(out.map((s) => s.id)).toEqual(["A", "B", "C"]);
    expect(src.map((s) => s.id)).toEqual(["A", "B"]); // unchanged
  });

  it("removeStop drops the indexed stop; out-of-range is a no-op copy", () => {
    expect(removeStop([a, b, c], 1).map((s) => s.id)).toEqual(["A", "C"]);
    const src = [a, b];
    const out = removeStop(src, 9);
    expect(out.map((s) => s.id)).toEqual(["A", "B"]);
    expect(out).not.toBe(src); // still a copy
  });

  it("moveStop reorders with clamped indices", () => {
    expect(moveStop([a, b, c, d], 0, 2).map((s) => s.id)).toEqual(["B", "C", "A", "D"]);
    expect(moveStop([a, b, c], 2, 0).map((s) => s.id)).toEqual(["C", "A", "B"]);
    // Out-of-range destination clamps to the last position.
    expect(moveStop([a, b, c], 0, 99).map((s) => s.id)).toEqual(["B", "C", "A"]);
    // A no-op move returns an equal-length copy.
    const src = [a, b, c];
    expect(moveStop(src, 1, 1).map((s) => s.id)).toEqual(["A", "B", "C"]);
    expect(moveStop(src, 1, 1)).not.toBe(src);
  });

  it("endpoints returns null under two stops, first/last otherwise", () => {
    expect(endpoints([])).toBeNull();
    expect(endpoints([a])).toBeNull();
    const e = endpoints([a, b, c]);
    expect(e?.from.id).toBe("A");
    expect(e?.to.id).toBe("C");
  });
});
