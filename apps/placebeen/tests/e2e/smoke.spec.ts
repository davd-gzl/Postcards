import { test, expect } from "@playwright/test";

// End-to-end smoke: the app mounts with the real gazetteer, a place can be
// added via search, and it shows up in statistics and the Places list.
test("add a place via search and see it in stats + places", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Place'Been")).toBeVisible();

  // Map screen is default: search and add Paris (top result = Paris, France).
  await page.getByLabel("Search a city or country").fill("Paris");
  await page.getByRole("button", { name: /Paris/ }).first().click();
  await expect(page.getByText("Added Paris")).toBeVisible(); // undo toast

  // Stats reflects it, including the continent section.
  await page.getByRole("button", { name: "Stats", exact: true }).click();
  await expect(page.getByText("countries", { exact: true })).toBeVisible();
  await expect(page.locator(".country-head", { hasText: "France" })).toBeVisible();
  await expect(page.getByText("By continent")).toBeVisible();

  // Places lists it.
  await page.getByRole("button", { name: "Places", exact: true }).click();
  await expect(page.getByText("Paris", { exact: true })).toBeVisible();
});

test("undo reverts an add", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Search a city or country").fill("Tokyo");
  await page.getByRole("button", { name: /Tokyo/ }).first().click();
  await page.getByRole("button", { name: "Undo" }).click();

  await page.getByRole("button", { name: "Places", exact: true }).click();
  await expect(page.getByText("Nothing yet", { exact: false })).toBeVisible();
});

test("country checklist toggles a country", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Places", exact: true }).click();
  await page.getByRole("button", { name: "Countries" }).click();
  await page.getByLabel("Filter countries").fill("Japan");
  await page.getByRole("button", { name: "Mark Japan visited" }).click();

  await page.getByRole("button", { name: "Stats", exact: true }).click();
  await expect(page.locator(".country-head", { hasText: "Japan" })).toBeVisible();
});
