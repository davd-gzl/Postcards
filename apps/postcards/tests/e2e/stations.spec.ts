import { test, expect, type Page } from "@playwright/test";
import { gotoTab } from "./nav-helper";

// Spec 021, US1 — find and mark a railway station VISITED, fully offline, from the
// bundled dataset (a dev fixture until `pnpm railways` runs). Zero network egress.

test("offline: search a station, mark it visited, zero external requests", async ({
  page,
  baseURL,
}: {
  page: Page;
  baseURL?: string;
}) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("postcards-offline-mode", "1");
      localStorage.setItem("postcards-intro-seen", "1");
    } catch {
      /* private mode */
    }
  });

  const external: string[] = [];
  page.on("request", (req) => {
    const url = req.url();
    if (url.startsWith(baseURL!) || url.startsWith("data:") || url.startsWith("blob:")) return;
    external.push(url);
  });

  await page.goto("/");
  await expect(page.getByText("Cities in view")).toBeVisible();

  // "Hauptbahnhof" matches only stations in the fixture (Berlin + München).
  await page.getByLabel("Search a city or country").fill("Hauptbahnhof");
  await page.getByRole("button", { name: "Mark Berlin Hauptbahnhof visited" }).first().click();
  await page.keyboard.press("Escape");

  // It's a visited place, listed with the station glyph.
  await gotoTab(page, "Places");
  await expect(page.getByText("Berlin Hauptbahnhof")).toBeVisible();

  await page.waitForTimeout(500);
  expect(external, `station flow external requests: ${external.join(", ")}`).toEqual([]);
});

// Spec 021, US2/US3 — a logged station flows through to the totals strip (its own
// counter), the map's Stations mode, and the Places browse kind.
test("a visited station surfaces in the strip, map mode, and Places browse", async ({
  page,
}: {
  page: Page;
}) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("postcards-offline-mode", "1");
      localStorage.setItem("postcards-intro-seen", "1");
    } catch {
      /* private mode */
    }
  });

  await page.goto("/");
  await expect(page.getByText("Cities in view")).toBeVisible();

  await page.getByLabel("Search a city or country").fill("Hauptbahnhof");
  await page.getByRole("button", { name: "Mark Berlin Hauptbahnhof visited" }).first().click();
  await page.keyboard.press("Escape");

  // Totals strip gains a stations counter.
  await expect(page.locator(".stat-strip")).toContainText("stations");

  // The map's Stations mode heads its in-view list accordingly.
  await page.locator(".map-mode").getByRole("button", { name: "Stations" }).click();
  await expect(page.getByText("Stations in view")).toBeVisible();

  // Places browses the world of stations by kind, with the visited one listed.
  await gotoTab(page, "Places");
  await page.getByRole("group", { name: /kind/i }).getByRole("button", { name: "Stations" }).click();
  await expect(page.getByText("Berlin Hauptbahnhof").first()).toBeVisible();
});

// Spec 021, US4 — a station is a reachable trip stop (you travel between stations),
// found by search in the journey composer, with the leg distance measured.
test("stations are reachable as train trip stops", async ({ page }: { page: Page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("postcards-offline-mode", "1");
      localStorage.setItem("postcards-intro-seen", "1");
    } catch {
      /* private mode */
    }
  });

  await page.goto("/");
  await expect(page.getByText("Cities in view")).toBeVisible();

  await gotoTab(page, "Trips");
  await page.getByRole("button", { name: "Reconstruct a journey" }).click();
  await expect(page.getByRole("heading", { name: "New trip" })).toBeVisible();

  const search = page.getByRole("searchbox");
  await search.fill("Gare de Lyon");
  await page.getByRole("button", { name: /Add .*Gare de Lyon.* to the trip/ }).first().click();
  await search.fill("Part-Dieu");
  await page.getByRole("button", { name: /Add .*Part-Dieu.* to the trip/ }).first().click();

  await expect(page.locator(".trip-stops li")).toHaveCount(2);
  await expect(page.locator(".trip-distance-km")).toContainText("km");
});
