import { test, expect } from "@playwright/test";

// End-to-end smoke: the app mounts, and a visit can be logged and reflected in stats.
test("log a visit and see it in statistics", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Place'Been" })).toBeVisible();

  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByLabel("Search a city or country").fill("Paris");
  await page.getByRole("button", { name: /Paris/ }).first().click();
  await page.getByRole("button", { name: /Add visit/ }).click();

  await page.getByRole("button", { name: "Visits", exact: true }).click();
  await expect(page.getByText("Paris")).toBeVisible();

  await page.getByRole("button", { name: "Stats", exact: true }).click();
  await expect(page.getByText("countries visited")).toBeVisible();
  await expect(page.getByText("France", { exact: true })).toBeVisible();
});
