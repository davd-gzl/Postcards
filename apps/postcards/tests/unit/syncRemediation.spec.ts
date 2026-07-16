import { describe, it, expect } from "vitest";
import {
  shouldGuardRemoval,
  GUARD_MIN_LOCAL,
  GUARD_MAX_REMOVAL_RATIO,
} from "../../src/lib/sync/syncConfig";
import { withEntry, SYNC_LOG_MAX, type SyncLogEntry } from "../../src/lib/sync/syncLog";

// The remediation policy units (spec 013): the safety-guard threshold and the
// bounded sync log — both pure, tested without the DOM / localStorage.

describe("shouldGuardRemoval (safety-guard threshold)", () => {
  it("gates a mass deletion — over half of a non-trivial store", () => {
    expect(shouldGuardRemoval({ local: 20, removed: 15 })).toBe(true);
    expect(shouldGuardRemoval({ local: 100, removed: 100 })).toBe(true);
  });

  it("allows an ordinary deletion of a small fraction", () => {
    expect(shouldGuardRemoval({ local: 20, removed: 3 })).toBe(false);
    expect(shouldGuardRemoval({ local: 100, removed: 50 })).toBe(false); // exactly half, not over
  });

  it("does not gate tiny datasets even if all would be removed (no nagging)", () => {
    expect(shouldGuardRemoval({ local: GUARD_MIN_LOCAL - 1, removed: GUARD_MIN_LOCAL - 1 })).toBe(
      false,
    );
  });

  it("does not gate when nothing is removed (a normal converging sync)", () => {
    expect(shouldGuardRemoval({ local: 100, removed: 0 })).toBe(false);
  });

  it("honours custom thresholds", () => {
    expect(
      shouldGuardRemoval({ local: 4, removed: 3 }, { minLocal: 2, maxRemovalRatio: 0.5 }),
    ).toBe(true);
    expect(
      shouldGuardRemoval({ local: 4, removed: 3 }, { minLocal: 10, maxRemovalRatio: 0.5 }),
    ).toBe(false); // below the custom minimum
  });

  it("uses a sensible default ratio just above half", () => {
    expect(GUARD_MAX_REMOVAL_RATIO).toBeGreaterThan(0);
    expect(GUARD_MAX_REMOVAL_RATIO).toBeLessThan(1);
  });
});

describe("sync log (withEntry)", () => {
  const entry = (at: string, status: SyncLogEntry["status"] = "ok"): SyncLogEntry => ({
    at,
    status,
    code: "changed",
  });

  it("prepends newest-first", () => {
    let list: SyncLogEntry[] = [];
    list = withEntry(list, entry("1"));
    list = withEntry(list, entry("2"));
    expect(list.map((e) => e.at)).toEqual(["2", "1"]);
  });

  it("caps the history at SYNC_LOG_MAX, dropping the oldest", () => {
    let list: SyncLogEntry[] = [];
    for (let i = 0; i < SYNC_LOG_MAX + 5; i++) list = withEntry(list, entry(String(i)));
    expect(list).toHaveLength(SYNC_LOG_MAX);
    expect(list[0]!.at).toBe(String(SYNC_LOG_MAX + 4)); // newest kept
    expect(list[list.length - 1]!.at).toBe(String(5)); // oldest surviving entry
  });
});
