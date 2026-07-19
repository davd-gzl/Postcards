import { test, expect } from "@playwright/test";
import { gotoTab } from "./nav-helper";

// End-to-end: log a journey in the Travel log via the two place pickers, and see
// it listed with a computed distance and reflected in the totals.
test("log a trip and see its distance in the totals", async ({ page }) => {
  await page.goto("/");
  await gotoTab(page, "Trips");
  await expect(page.getByRole("heading", { name: "Travel log" })).toBeVisible();

  // The add form is collapsed by default now — open it first.
  await page.getByRole("button", { name: "New trip" }).click();
  // Pick the "from" airport by IATA code.
  await page.getByLabel("From", { exact: true }).fill("CDG");
  await page.getByRole("option").filter({ hasText: "CDG" }).first().click();

  // Pick the "to" airport.
  await page.getByLabel("To", { exact: true }).fill("JFK");
  await page.getByRole("option").filter({ hasText: "JFK" }).first().click();

  await page.getByRole("button", { name: "Add trip" }).click();
  await expect(page.getByText(/Added .*→/)).toBeVisible(); // undo toast

  // Totals updated and the trip is listed with a km distance.
  await expect(page.locator(".travel-totals")).toContainText("1 trip");
  await expect(page.locator(".travel-totals")).toContainText("km");
  await expect(page.getByText(/→/).first()).toBeVisible();
  await expect(page.getByText(/km/).first()).toBeVisible();
});
