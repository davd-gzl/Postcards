import { test, expect } from "@playwright/test";

// PRIORITY #1 regression guard: on a phone, tapping to mark a place visited must
// paint the new state immediately — the visible flip is DECOUPLED from the
// IndexedDB write (the original bug: marking a photo-laden place re-serialized
// multi-MB of base64 to IndexedDB on the main thread BEFORE the flag painted).
//
// What we assert here is the FLIP LATENCY: how long until the tapped control
// reflects the new state. That is our synchronous React commit and is unaffected
// by the GPU, so it is stable in CI. If a future change re-couples the paint to
// the async persist, this latency jumps from a few ms into the 100s of ms and the
// test fails — which is exactly the user-visible regression we care about.
//
// We deliberately do NOT assert on `longtask` wall-clock. Marking a place also
// triggers a MapLibre WebGL repaint; under the headless software-GL used in CI a
// single repaint frame costs ~100ms, but on a real device's GPU it is cheap and
// off the main thread. Asserting an absolute long-task ceiling would measure the
// test environment's GL emulation, not our code. The one repaint cost that IS
// real on-device — decoding OSM raster tiles — is avoided by defaulting to the
// offline vector basemap. The "mutation writes tiny refs, not MB of photos"
// invariant is covered deterministically in tests/unit/photoBlobs.spec.ts.

// A representative modern phone: 390×844 CSS px, touch input. DPR 2 (not 3) keeps
// the software-GL map render light enough not to starve sibling e2e workers — the
// flip-latency we measure is a React commit and is independent of pixel ratio.
test.use({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});

// Observe long tasks purely for diagnostics (logged, never asserted).
const LONGTASK_INIT = () => {
  interface W {
    __longTasks: number[];
  }
  const w = window as unknown as W;
  w.__longTasks = [];
  try {
    const po = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) w.__longTasks.push(e.duration);
    });
    po.observe({ entryTypes: ["longtask"] });
  } catch {
    /* longtask API unavailable — the flip-latency assertion still guards paint */
  }
};

/** Click the button whose aria-label matches `markLabel`, then report how long
 *  until a button labelled `flippedLabel` exists — the visible state flip. Also
 *  returns the worst long task seen in a short window after, for logging only. */
async function measureFlip(
  page: import("@playwright/test").Page,
  markLabel: string,
  flippedLabel: string,
): Promise<{ ok: boolean; latency: number; maxLongTask: number }> {
  return page.evaluate(
    async ({ markLabel, flippedLabel }) => {
      interface W {
        __longTasks: number[];
      }
      const w = window as unknown as W;
      const byLabel = (re: RegExp) =>
        [...document.querySelectorAll("button")].find((b) =>
          re.test(b.getAttribute("aria-label") || ""),
        );
      const btn = byLabel(new RegExp(`^${markLabel}$`));
      if (!btn) return { ok: false, latency: -1, maxLongTask: 0 };
      w.__longTasks = [];
      const flipped = new RegExp(flippedLabel);
      const t0 = performance.now();
      btn.click();
      // React commits discrete events (a click) before paint; poll rAF as a
      // safety net until the control reflects the new state.
      let latency = -1;
      const deadline = t0 + 1500;
      while (performance.now() < deadline) {
        if (byLabel(flipped)) {
          latency = performance.now() - t0;
          break;
        }
        await new Promise((r) => requestAnimationFrame(() => r(null)));
      }
      await new Promise((r) => setTimeout(r, 400));
      const maxLongTask = w.__longTasks.length ? Math.max(...w.__longTasks) : 0;
      return { ok: latency >= 0, latency, maxLongTask };
    },
    { markLabel, flippedLabel },
  );
}

test("marking a place visited paints instantly on mobile (paint decoupled from persist)", async ({
  page,
}) => {
  await page.addInitScript(LONGTASK_INIT);
  await page.goto("/");
  const search = page.getByLabel("Search a city or country");

  // Warm up: the very first visit fits the camera to your places (a one-time
  // move) and the full gazetteer loads in the background. Mark one, then MEASURE
  // a subsequent mark — the steady-state interaction a user actually repeats.
  await search.fill("Paris");
  await page.getByRole("button", { name: "Mark Paris visited" }).first().click();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1500);

  await search.fill("Lyon");
  await expect(page.getByRole("button", { name: "Mark Lyon visited" }).first()).toBeVisible();
  await page.waitForTimeout(300);

  const { ok, latency, maxLongTask } = await measureFlip(
    page,
    "Mark Lyon visited",
    "Remove Lyon from visited",
  );
  // eslint-disable-next-line no-console
  console.log(
    `[perf] mark-visited flip=${latency.toFixed(1)}ms (longtask≈${maxLongTask.toFixed(0)}ms, GL-bound, not asserted)`,
  );
  expect(ok).toBe(true);
  // The flag must flip near-instantly. A regression that awaits the IndexedDB
  // write before painting would push this into the 100s of ms.
  expect(latency).toBeLessThan(100);
});
