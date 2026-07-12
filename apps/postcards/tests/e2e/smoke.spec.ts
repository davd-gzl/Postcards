import { test, expect } from "@playwright/test";
import { gotoTab } from "./nav-helper";

// End-to-end smoke: the app mounts with the real gazetteer, a place can be
// added via search, and it shows up in statistics and the Places list.
test("add a place via search and see it in stats + places", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Postcards")).toBeVisible();

  // Map screen is default: search and add Paris (top result = Paris, France).
  await page.getByLabel("Search a city or country").fill("Paris");
  await page.getByRole("button", { name: /Paris/ }).first().click();
  // Adds are silent (no toast noise); the result is verified in Stats + Places below.

  // Stats reflects it, including the continent section.
  await gotoTab(page, "Stats");
  await expect(page.getByText("countries", { exact: true })).toBeVisible();
  await expect(page.locator(".country-head", { hasText: "France" })).toBeVisible();
  await expect(page.getByText("By continent")).toBeVisible();

  // Places lists it.
  await page.getByRole("button", { name: "Places", exact: true }).click();
  await expect(page.getByText("Paris", { exact: true })).toBeVisible();
});

test("undo reverts a removal", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Search a city or country").fill("Tokyo");
  await page.getByRole("button", { name: /Tokyo/ }).first().click();

  // Removing a place (which can drop photos/notes) is the one action with an
  // undoable toast. Remove Tokyo, then undo — it comes back.
  await page.getByRole("button", { name: "Places", exact: true }).click();
  await expect(page.getByText("Tokyo", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Remove Tokyo" }).click();
  await expect(page.getByText("Removed Tokyo")).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("Tokyo", { exact: true })).toBeVisible();
});

test("country checklist toggles a country", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Places", exact: true }).click();
  await page.getByRole("button", { name: "Countries" }).click();
  await page.getByLabel("Filter countries").fill("Japan");
  await page.getByRole("button", { name: "Mark Japan visited" }).click();

  await gotoTab(page, "Stats");
  await expect(page.locator(".country-head", { hasText: "Japan" })).toBeVisible();
});
