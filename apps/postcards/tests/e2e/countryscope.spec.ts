import { test, expect } from "@playwright/test";
import { gotoTab } from "./nav-helper";

// "What counts as a country" — switching the scope changes both the count of
// visited countries and the world denominator, dropping dependent territories.
test("count with or without dependent territories", async ({ page }) => {
  await page.goto("/");

  // Countries are visited via places inside them: a city in a UN member
  // (Paris → France) and one in a territory (Hong Kong city → Hong Kong).
  await page.getByLabel("Search a city or country").fill("Paris");
  await page.getByRole("button", { name: "Mark Paris visited" }).first().click();
  await page.getByLabel("Search a city or country").fill("Hong Kong");
  await page.getByRole("button", { name: "Mark Hong Kong visited" }).first().click();
  await page.keyboard.press("Escape");

  await gotoTab(page, "Stats");

  // Default scope counts both, against the full countries + territories list.
  const countTile = page.locator(".stat-grid .stat-tile").first();
  const denomTile = page.locator(".stat-grid .stat-tile").nth(1);
  await expect(countTile).toContainText("2");
  await expect(denomTile).toContainText(/countries & territories/);

  // Switch to UN members only (segmented toggle) → Hong Kong (a territory)
  // drops from the count, and the denominator relabels + shrinks.
  await page.getByRole("button", { name: "UN · 193" }).first().click();
  await expect(countTile).toContainText("1");
  await expect(denomTile).toContainText(/UN member states/);
  await expect(denomTile).not.toContainText(/countries & territories/);
});
