import { test, expect, type Page } from "@playwright/test";
import { gotoTab } from "./nav-helper";

// Spec 019 — Trip Reconstruction. A dedicated composer page assembles a past trip
// as an ordered chain of stops (airports + cities), shows the running great-circle
// distance, and fixes the Travel back-navigation bug.

async function openComposer(page: Page): Promise<void> {
  await page.goto("/");
  await gotoTab(page, "Trips");
  await page.getByRole("button", { name: "Reconstruct a journey" }).click();
  await expect(page.getByRole("heading", { name: "New trip" })).toBeVisible();
}

async function addStop(page: Page, query: string, code: string): Promise<void> {
  await page.getByRole("combobox", { name: "Add a stop" }).fill(query);
  await page.getByRole("option").filter({ hasText: code }).first().click();
}

function kmOf(text: string | null): number {
  return Number((text ?? "").replace(/[^\d]/g, "")) || 0;
}

// US1 — build a multi-stop trip, reorder, save, and see it listed; reopen restores it.
test("build a multi-stop trip, save it, and reopen to edit", async ({ page }) => {
  await openComposer(page);

  await addStop(page, "CDG", "CDG"); // Paris airport
  await addStop(page, "Tokyo", "Tokyo"); // city
  await addStop(page, "JFK", "JFK"); // New York airport

  const stops = page.locator(".trip-stops li");
  await expect(stops).toHaveCount(3);
  await expect(stops.nth(0)).toContainText("CDG");
  await expect(stops.nth(2)).toContainText("JFK");

  // Reorder: move the last stop up, then confirm the order changed.
  await page.getByRole("button", { name: /Move .*JFK.* up/ }).click();
  await expect(page.locator(".trip-stops li").nth(1)).toContainText("JFK");

  // Name + a rough (year-only) date, then save.
  await page.getByLabel("Trip name").fill("Round the world");
  await page.getByLabel("Year").fill("2024");
  await page.getByRole("button", { name: "Save trip" }).click();

  // Back on the Trips list: the journey is there with its stop count.
  await expect(page.getByRole("heading", { name: "Travel log" })).toBeVisible();
  await expect(page.getByText(/3 stops/)).toBeVisible();

  // Reopen it → the composer restores the three stops.
  await page.getByRole("button", { name: /Edit trip/ }).first().click();
  await expect(page.getByRole("heading", { name: "Edit trip" })).toBeVisible();
  await expect(page.locator(".trip-stops li")).toHaveCount(3);
});

// US2 — the total distance is shown and grows as stops are added.
test("distance is shown and updates live as stops change", async ({ page }) => {
  await openComposer(page);

  await addStop(page, "CDG", "CDG");
  await addStop(page, "JFK", "JFK");
  const two = kmOf(await page.locator(".trip-distance-km").textContent());
  expect(two).toBeGreaterThan(5000); // CDG↔JFK ≈ 5,800 km

  await addStop(page, "Tokyo", "Tokyo");
  const three = kmOf(await page.locator(".trip-distance-km").textContent());
  expect(three).toBeGreaterThan(two); // adding a leg only grows the great-circle path
});

// US3 — opening an airport from the Travel screen and pressing Back returns to the
// Travel list (not a dead-end on the map, and never exiting the app).
test("Back from a Travel airport returns to the Travel list", async ({ page }) => {
  // Seed an airport into the roll-up by saving a quick trip first.
  await openComposer(page);
  await addStop(page, "CDG", "CDG");
  await addStop(page, "JFK", "JFK");
  await page.getByRole("button", { name: "Save trip" }).click();
  await expect(page.getByRole("heading", { name: "Travel log" })).toBeVisible();

  // Open an airport from the most-visited roll-up → its detail page.
  const rollup = page.locator(".airport-rollup");
  await rollup.getByRole("button").filter({ hasText: "CDG" }).first().click();
  await expect(page.getByRole("heading", { name: "Travel log" })).toHaveCount(0); // a page layer covers it

  // A single Escape returns to the Travel list — not the map, and the app stays.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Travel log" })).toBeVisible();
});
