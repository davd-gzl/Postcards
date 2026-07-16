import { describe, it, expect, vi, afterEach } from "vitest";
import { createSyncScheduler } from "../../src/lib/sync/scheduler";

// The auto-sync scheduler in isolation (spec 013): the in-flight lock, debounce
// coalescing and "no lost edit during a run" behaviour — the parts that keep
// background sync from hammering the API or dropping work.

afterEach(() => {
  vi.useRealTimers();
});

describe("createSyncScheduler", () => {
  it("coalesces a burst of debounced requests into a single run", async () => {
    vi.useFakeTimers();
    let runs = 0;
    const s = createSyncScheduler({
      run: async () => {
        runs++;
      },
      canRun: () => true,
      debounceMs: 1000,
    });

    s.requestDebounced();
    s.requestDebounced();
    s.requestDebounced();
    expect(runs).toBe(0); // nothing until the quiet period elapses

    await vi.advanceTimersByTimeAsync(1000);
    expect(runs).toBe(1); // three rapid edits → one push
  });

  it("never runs when canRun() is false", async () => {
    vi.useFakeTimers();
    let runs = 0;
    const s = createSyncScheduler({
      run: async () => {
        runs++;
      },
      canRun: () => false,
      debounceMs: 100,
    });
    s.requestImmediate();
    s.requestDebounced();
    await vi.advanceTimersByTimeAsync(500);
    expect(runs).toBe(0);
  });

  it("holds a single in-flight lock — no two runs overlap — and services one follow-up", async () => {
    // Real timers here: we gate the run manually and use a short real debounce.
    let active = 0;
    let maxActive = 0;
    let runs = 0;
    const gates: Array<() => void> = [];
    const run = () =>
      new Promise<void>((resolve) => {
        active++;
        runs++;
        maxActive = Math.max(maxActive, active);
        gates.push(() => {
          active--;
          resolve();
        });
      });

    const s = createSyncScheduler({ run, canRun: () => true, debounceMs: 5 });

    s.requestImmediate(); // run #1 starts and blocks on its gate
    s.requestImmediate(); // locked → remembered as pending
    s.requestImmediate(); // still just pending (coalesced)
    expect(runs).toBe(1);
    expect(s.isRunning()).toBe(true);
    expect(maxActive).toBe(1);

    gates[0]!(); // finish run #1 → the pending work schedules ONE debounced follow-up
    await new Promise((r) => setTimeout(r, 20)); // > debounceMs
    expect(runs).toBe(2); // exactly one follow-up for the two coalesced triggers
    expect(maxActive).toBe(1); // never overlapped

    gates[1]!(); // finish run #2
    await new Promise((r) => setTimeout(r, 20));
    expect(runs).toBe(2); // nothing left pending → no extra run
  });

  it("requestImmediate cancels a pending debounce so they don't double-run", async () => {
    vi.useFakeTimers();
    let runs = 0;
    const s = createSyncScheduler({
      run: async () => {
        runs++;
      },
      canRun: () => true,
      debounceMs: 1000,
    });
    s.requestDebounced(); // arm a debounce
    s.requestImmediate(); // should run now AND cancel the armed debounce
    await Promise.resolve();
    expect(runs).toBe(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(runs).toBe(1); // the cancelled debounce did not fire a second run
  });

  it("dispose() cancels a pending run", async () => {
    vi.useFakeTimers();
    let runs = 0;
    const s = createSyncScheduler({
      run: async () => {
        runs++;
      },
      canRun: () => true,
      debounceMs: 500,
    });
    s.requestDebounced();
    s.dispose();
    await vi.advanceTimersByTimeAsync(1000);
    expect(runs).toBe(0);
  });
});
