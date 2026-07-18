import { test, expect } from "@playwright/test";

// Spec 016 — the ONE Filter panel. Every slicing dimension the map used to
// scatter across its header (status segmented, population row, sort, place-kind
// mode) now lives inside a single focus-trapped panel, and the active filters
// show as removable chips. These prove the consolidation and the summary.

test("the one Filter panel drives the map; the old inline controls are gone", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Postcards")).toBeVisible();

  // A visited city so the list has something to slice.
  await page.getByLabel("Search a city or country").fill("Paris");
  await page.getByRole("button", { name: "Mark Paris visited" }).first().click();
  await page.keyboard.press("Escape");

  // The scattered map controls no longer exist: no population row, no top
  // place-kind mode selector — they moved into the panel.
  await expect(page.locator(".pop-filter-row")).toHaveCount(0);
  await expect(page.locator(".map-ctl-top")).toHaveCount(0);

  // Open the one panel; it hosts every dimension.
  await page.locator(".map-ctl-right").getByRole("button", { name: /Filter/ }).click();
  const panel = page.getByRole("dialog", { name: "Filters" });
  await expect(panel).toBeVisible();
  // Place-kind mode (map-only) is in here now, not on the map header.
  await expect(panel.getByRole("button", { name: "Cities", exact: true })).toBeVisible();
  await expect(panel.getByRole("button", { name: /Monuments/ })).toBeVisible();

  // Apply status = Want list and People = 1M+.
  await panel.getByRole("button", { name: "Want list", exact: true }).click();
  await panel.getByRole("button", { name: "1M+", exact: true }).click();
  await panel.getByRole("button", { name: "Done" }).click();

  // The applied filters render as a chip summary with a Clear all.
  const summary = page.locator(".filter-summary");
  await expect(summary).toBeVisible();
  await expect(summary).toContainText("Want list");
  await expect(summary).toContainText("1M+");
  await expect(summary.getByRole("button", { name: "Clear all" })).toBeVisible();

  // Reopening shows the applied values still selected (persisted preferences).
  await page.locator(".map-ctl-right").getByRole("button", { name: /Filter/ }).click();
  await expect(panel.getByRole("button", { name: "Want list", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(panel.getByRole("button", { name: "1M+", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  // Escape closes the panel and restores focus.
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
});

test("chips remove one dimension; Clear all resets everything", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Search a city or country").fill("Paris");
  await page.getByRole("button", { name: "Mark Paris visited" }).first().click();
  await page.keyboard.press("Escape");

  // Apply two dimensions.
  await page.locator(".map-ctl-right").getByRole("button", { name: /Filter/ }).click();
  const panel = page.getByRole("dialog", { name: "Filters" });
  await panel.getByRole("button", { name: "Want list", exact: true }).click();
  await panel.getByRole("button", { name: "1M+", exact: true }).click();
  await panel.getByRole("button", { name: "Done" }).click();

  const summary = page.locator(".filter-summary");
  await expect(summary).toContainText("Want list");
  await expect(summary).toContainText("1M+");

  // Removing the population chip resets only that dimension.
  await summary.getByRole("button", { name: "Remove 1M+ filter" }).click();
  await expect(summary).not.toContainText("1M+");
  await expect(summary).toContainText("Want list");

  // Clear all wipes the rest and hides the summary entirely.
  await summary.getByRole("button", { name: "Clear all" }).click();
  await expect(page.locator(".filter-summary")).toHaveCount(0);
});
