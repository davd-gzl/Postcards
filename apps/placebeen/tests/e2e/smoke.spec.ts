import { test, expect } from "@playwright/test";

// End-to-end smoke: the app mounts, a place can be added via search, and it
// shows up in statistics and the Places list.
test("add a place via search and see it in stats + places", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Place'Been")).toBeVisible();

  // Map screen is default: search and add Paris.
  await page.getByLabel("Search a city or country").fill("Paris");
  await page.getByRole("button", { name: /Paris/ }).first().click();

  // Stats reflects it.
  await page.getByRole("button", { name: "Stats", exact: true }).click();
  await expect(page.getByText("countries", { exact: true })).toBeVisible();
  await expect(page.getByText("France", { exact: true })).toBeVisible();

  // Places lists it.
  await page.getByRole("button", { name: "Places", exact: true }).click();
  await expect(page.getByText("Paris", { exact: true })).toBeVisible();
});
