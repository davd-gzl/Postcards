import { describe, it, expect } from "vitest";
import { mergeById, gcTombstones, type SyncSnapshot } from "../../src/lib/sync/merge";

interface Rec {
  id: string;
  v: string;
  updatedAt: string;
}
const idOf = (r: Rec) => r.id;
const tsOf = (r: Rec) => r.updatedAt;
const snap = (records: Rec[], tombstones: SyncSnapshot<Rec>["tombstones"] = []): SyncSnapshot<Rec> => ({
  records,
  tombstones,
});

describe("mergeById", () => {
  it("keeps the newest version of a record", () => {
    const a = snap([{ id: "1", v: "old", updatedAt: "2026-01-01T00:00:00Z" }]);
    const b = snap([{ id: "1", v: "new", updatedAt: "2026-02-01T00:00:00Z" }]);
    expect(mergeById(a, b, idOf, tsOf).records).toEqual([{ id: "1", v: "new", updatedAt: "2026-02-01T00:00:00Z" }]);
  });

  it("unions records that exist only on one side", () => {
    const a = snap([{ id: "1", v: "a", updatedAt: "2026-01-01T00:00:00Z" }]);
    const b = snap([{ id: "2", v: "b", updatedAt: "2026-01-01T00:00:00Z" }]);
    expect(mergeById(a, b, idOf, tsOf).records.map((r) => r.id)).toEqual(["1", "2"]);
  });

  it("is commutative: merge(a,b) equals merge(b,a)", () => {
    const a = snap([
      { id: "1", v: "a1", updatedAt: "2026-01-02T00:00:00Z" },
      { id: "2", v: "a2", updatedAt: "2026-01-01T00:00:00Z" },
    ]);
    const b = snap([{ id: "1", v: "b1", updatedAt: "2026-01-01T00:00:00Z" }]);
    expect(mergeById(a, b, idOf, tsOf)).toEqual(mergeById(b, a, idOf, tsOf));
  });

  it("is idempotent: merge(a,a) equals a (normalized)", () => {
    const a = snap([
      { id: "2", v: "x", updatedAt: "2026-01-01T00:00:00Z" },
      { id: "1", v: "y", updatedAt: "2026-01-01T00:00:00Z" },
    ]);
    const once = mergeById(a, a, idOf, tsOf);
    const twice = mergeById(once, once, idOf, tsOf);
    expect(twice).toEqual(once);
    expect(once.records.map((r) => r.id)).toEqual(["1", "2"]); // deterministic order
  });

  it("a deletion after the last edit removes the record", () => {
    const a = snap([{ id: "1", v: "a", updatedAt: "2026-01-01T00:00:00Z" }]);
    const b = snap([], [{ id: "1", deletedAt: "2026-02-01T00:00:00Z" }]);
    const m = mergeById(a, b, idOf, tsOf);
    expect(m.records).toEqual([]);
    expect(m.tombstones).toEqual([{ id: "1", deletedAt: "2026-02-01T00:00:00Z" }]);
  });

  it("an edit strictly newer than a deletion revives the record (explicit re-add)", () => {
    const a = snap([{ id: "1", v: "revived", updatedAt: "2026-03-01T00:00:00Z" }]);
    const b = snap([], [{ id: "1", deletedAt: "2026-02-01T00:00:00Z" }]);
    expect(mergeById(a, b, idOf, tsOf).records).toEqual([
      { id: "1", v: "revived", updatedAt: "2026-03-01T00:00:00Z" },
    ]);
  });

  it("breaks exact-timestamp ties deterministically (order-independent)", () => {
    const a = snap([{ id: "1", v: "aaa", updatedAt: "2026-01-01T00:00:00Z" }]);
    const b = snap([{ id: "1", v: "bbb", updatedAt: "2026-01-01T00:00:00Z" }]);
    expect(mergeById(a, b, idOf, tsOf)).toEqual(mergeById(b, a, idOf, tsOf));
  });

  it("gcTombstones drops only tombstones older than the horizon", () => {
    const s = snap([], [
      { id: "old", deletedAt: "2025-01-01T00:00:00Z" },
      { id: "new", deletedAt: "2026-06-01T00:00:00Z" },
    ]);
    expect(gcTombstones(s, "2026-01-01T00:00:00Z").tombstones.map((t) => t.id)).toEqual(["new"]);
  });
});
