import { describe, it, expect } from "vitest";
import { dedupeUpsert, findByPlace } from "../../src/lib/store/useVisits";
import type { Visit } from "../../src/lib/schema/models";

function cityVisit(id: string, name: string, countryId: string, note: string | null = null): Visit {
  return {
    visitId: crypto.randomUUID(),
    place: { kind: "city", id, name, countryId },
    date: null,
    note,
    status: "visited" as const,
    favorite: false,
    addedAt: new Date().toISOString(),
  };
}

describe("dedupeUpsert (FR-015)", () => {
  it("adds a new place", () => {
    const list = dedupeUpsert([], cityVisit("paris-fr", "Paris", "FR"));
    expect(list).toHaveLength(1);
  });

  it("does not duplicate the same place; updates in place keeping id/addedAt", () => {
    const first = cityVisit("paris-fr", "Paris", "FR");
    const list1 = dedupeUpsert([], first);
    const list2 = dedupeUpsert(list1, cityVisit("paris-fr", "Paris", "FR", "second"));
    expect(list2).toHaveLength(1);
    expect(list2[0]!.visitId).toBe(first.visitId);
    expect(list2[0]!.addedAt).toBe(first.addedAt);
    expect(list2[0]!.note).toBe("second");
  });

  it("finds a visit by place", () => {
    const list = dedupeUpsert([], cityVisit("lyon-fr", "Lyon", "FR"));
    expect(findByPlace(list, { kind: "city", id: "lyon-fr" })).toBeDefined();
    expect(findByPlace(list, { kind: "city", id: "nope" })).toBeUndefined();
  });
});
