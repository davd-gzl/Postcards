import { test, expect } from "@playwright/test";

// US5: the core flow is fully keyboard-operable.
test("add a visit and browse with the keyboard only", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Cities in view")).toBeVisible();

  // "/" focuses the search input.
  await page.keyboard.press("/");
  await expect(page.getByLabel("Search a city or country")).toBeFocused();

  // Type, arrow to the first option, Enter to add.
  await page.keyboard.type("tokyo");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Added Tokyo")).toBeVisible();

  // Leave the input, then switch tabs with number keys.
  await page.getByText("Place'Been").click();
  await page.keyboard.press("2");
  await expect(page.getByText("Statistics")).toBeVisible();
  await expect(page.locator(".country-head", { hasText: "Japan" })).toBeVisible();

  await page.keyboard.press("3");
  await expect(page.getByRole("button", { name: "Countries" })).toBeVisible();

  // "?" opens the shortcuts overlay; Escape closes it.
  await page.keyboard.press("?");
  await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
