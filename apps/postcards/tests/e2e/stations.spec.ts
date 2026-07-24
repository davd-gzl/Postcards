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
