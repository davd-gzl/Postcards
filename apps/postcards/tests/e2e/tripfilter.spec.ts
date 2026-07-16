import { test, expect, type Page } from "@playwright/test";
import { gotoTab } from "./nav-helper";

async function addDatedTrip(page: Page, from: string, to: string, date: string) {
  await page.getByLabel("From", { exact: true }).fill(from);
  await page.getByRole("option").filter({ hasText: from }).first().click();
  await page.getByLabel("To", { exact: true }).fill(to);
  await page.getByRole("option").filter({ hasText: to }).first().click();
  await page.locator("#trip-date").fill(date);
  await page.getByRole("button", { name: "Add trip" }).click();
  await expect(page.getByText(/Added .*→/)).toBeVisible(); // undo toast
}

// Log trips in two different years, then filter the Travel log by year and see
// the list + totals narrow to the chosen period.
test("filter the travel log by year", async ({ page }) => {
  await page.goto("/");
  await gotoTab(page, "Trips");

  await addDatedTrip(page, "CDG", "JFK", "2024-08-14");
  await addDatedTrip(page, "LHR", "SFO", "2023-05-01");

  // No filter yet → both trips counted.
  await expect(page.locator(".travel-totals")).toContainText("2 trips");

  // Filter to 2024 → one trip; the month sub-filter appears.
  await page.locator("#trip-filter-year").selectOption("2024");
  await expect(page.locator(".travel-totals")).toContainText("1 trip");
  await expect(page.locator("#trip-filter-month")).toBeVisible();

  // Switch to 2023 → the other trip.
  await page.locator("#trip-filter-year").selectOption("2023");
  await expect(page.locator(".travel-totals")).toContainText("1 trip");

  // Back to all years → both again.
  await page.locator("#trip-filter-year").selectOption("all");
  await expect(page.locator(".travel-totals")).toContainText("2 trips");
});

// The map has its OWN date filter (independent of the Trips tab now), with quick
// chips built from your dated content. Picking a year narrows the trip arcs and
// tags the map's Trips toggle with that period.
test("the map's own date filter tags the trip arcs by period", async ({ page }) => {
  await page.goto("/");
  await gotoTab(page, "Trips");

  await addDatedTrip(page, "CDG", "JFK", "2024-08-14");
  await addDatedTrip(page, "LHR", "SFO", "2023-05-01");

  await page.getByRole("button", { name: "Map", exact: true }).click();
  // Pick 2024 on the map's own filter chips (derived from the dated trips).
  await page.locator(".year-filter").getByRole("button", { name: "2024", exact: true }).click();

  // The Trips toggle (in the Layers panel) reflects the map's period.
  await page.getByRole("button", { name: /Layers/ }).click();
  await expect(page.getByRole("button", { name: /Trips.*2024/ })).toBeVisible();
});

// If the trips underneath the filter change so the selected year vanishes, the
// stored period is reconciled back to "all" — no phantom <select> value, no
// silently-empty map.
test("filtering to a year whose trips are all deleted resets to all years", async ({ page }) => {
  await page.goto("/");
  await gotoTab(page, "Trips");

  await addDatedTrip(page, "CDG", "JFK", "2024-08-14");
  await addDatedTrip(page, "LHR", "SFO", "2023-05-01");

  await page.locator("#trip-filter-year").selectOption("2024");
  await expect(page.locator(".travel-totals")).toContainText("1 trip");

  // Remove the only 2024 trip; the year no longer exists in the data.
  await page.getByRole("button", { name: "Remove trip CDG → JFK" }).click();

  // The filter self-heals to "All years" and the remaining 2023 trip is shown.
  await expect(page.locator("#trip-filter-year")).toHaveValue("all");
  await expect(page.getByText("LHR → SFO")).toBeVisible();
});
