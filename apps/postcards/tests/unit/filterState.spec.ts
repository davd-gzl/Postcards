import { describe, it, expect, beforeEach } from "vitest";
import {
  useFilters,
  DEFAULT_FILTERS,
  isDefault,
  withFieldCleared,
} from "../../src/lib/store/useFilters";

describe("filter state helpers", () => {
  it("isDefault is true only when every dimension is at its default", () => {
    expect(isDefault(DEFAULT_FILTERS)).toBe(true);
    expect(isDefault({ ...DEFAULT_FILTERS, status: "visited" })).toBe(false);
    expect(isDefault({ ...DEFAULT_FILTERS, minPop: 100_000 })).toBe(false);
    expect(isDefault({ ...DEFAULT_FILTERS, favoritesOnly: true })).toBe(false);
    expect(isDefault({ ...DEFAULT_FILTERS, date: { mode: "undated" } })).toBe(false);
  });

  it("withFieldCleared resets exactly one dimension", () => {
    const s = { ...DEFAULT_FILTERS, status: "visited" as const, minPop: 1_000_000 };
    const cleared = withFieldCleared(s, "minPop");
    expect(cleared.minPop).toBe(0); // reset
    expect(cleared.status).toBe("visited"); // untouched
  });
});

describe("useFilters store", () => {
  beforeEach(() => {
    useFilters.getState().clearAll();
  });

  it("set merges dimensions and clearField / clearAll reset", () => {
    useFilters.getState().set({ status: "wishlist", minPop: 100_000 });
    expect(useFilters.getState().status).toBe("wishlist");
    expect(useFilters.getState().minPop).toBe(100_000);

    useFilters.getState().clearField("minPop");
    expect(useFilters.getState().minPop).toBe(0);
    expect(useFilters.getState().status).toBe("wishlist"); // only minPop reset

    useFilters.getState().clearAll();
    expect(useFilters.getState().status).toBe("all");
    expect(useFilters.getState().minPop).toBe(0);
  });

  it("persists preference dimensions to localStorage", () => {
    useFilters.getState().set({ status: "visited", minPop: 1_000_000, sort: "az" });
    expect(localStorage.getItem("postcards-city-filter")).toBe("visited");
    expect(localStorage.getItem("postcards-city-minpop")).toBe("1000000");
    expect(localStorage.getItem("postcards-list-sort")).toBe("az");
  });
});
