import { test, expect } from "@playwright/test";

// End-to-end: an airport can be found by IATA code, logged, and shows up in the
// totals strip (as an "airports" counter) and the Places list — proving the new
// place kind is wired through search → store → stats → lists.
test("log an airport by IATA code and see it counted", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Postcards")).toBeVisible();

  // Search by IATA code; the top result is the matching airport.
  await page.getByLabel("Search a city or country").fill("JFK");
  await page.getByRole("button", { name: /JFK/ }).first().click();
  await expect(page.getByText(/Added .*JFK/)).toBeVisible(); // undo toast

  // Totals strip gains an airports counter.
  await expect(page.locator(".stat-strip")).toContainText("airports");

  // Places lists the airport, labelled as one.
  await page.getByRole("button", { name: "Places", exact: true }).click();
  await expect(page.getByText(/JFK/).first()).toBeVisible();
  await expect(page.getByText(/Airport ·/).first()).toBeVisible();
});
