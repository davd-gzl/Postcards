import { test, expect } from "@playwright/test";

// Log trips in two different years, then filter the Travel log by year and see
// the list + totals narrow to the chosen period.
test("filter the travel log by year", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Trips", exact: true }).click();

  async function addDatedTrip(from: string, to: string, date: string) {
    await page.getByLabel("From", { exact: true }).fill(from);
    await page.getByRole("option").filter({ hasText: from }).first().click();
    await page.getByLabel("To", { exact: true }).fill(to);
    await page.getByRole("option").filter({ hasText: to }).first().click();
    await page.locator("#trip-date").fill(date);
    await page.getByRole("button", { name: "Add trip" }).click();
    await expect(page.getByText(/Added .*→/)).toBeVisible(); // undo toast
  }

  await addDatedTrip("CDG", "JFK", "2024-08-14");
  await addDatedTrip("LHR", "SFO", "2023-05-01");

  // No filter yet → both trips counted.
  await expect(page.locator(".travel-totals")).toContainText("2 trips");

  // Filter to 2024 → one trip; the month sub-filter appears.
  await page.locator("#trip-filter-year").selectOption("2024");
  await expect(page.locator(".travel-totals")).toContainText("1 trip");
  await expect(page.locator("#trip-filter-month")).toBeVisible();

  // Switch to 2023 → the other trip (and the month resets to "all").
  await page.locator("#trip-filter-year").selectOption("2023");
  await expect(page.locator(".travel-totals")).toContainText("1 trip");

  // Back to all years → both again.
  await page.locator("#trip-filter-year").selectOption("all");
  await expect(page.locator(".travel-totals")).toContainText("2 trips");
});
