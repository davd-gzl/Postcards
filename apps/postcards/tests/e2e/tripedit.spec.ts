import { test, expect } from "@playwright/test";
import { gotoTab } from "./nav-helper";

// End-to-end: a logged trip can be edited (here, adding a date) and saved.
test("edit a logged trip", async ({ page }) => {
  await page.goto("/");
  await gotoTab(page, "Trips");

  // Add a trip. Filter the option by its code so the picker's listbox row is
  // targeted, never the mode <select>'s native "Flight" option (both expose
  // role=option; the deferred picker list can lag a frame behind the keystroke).
  await page.getByLabel("From", { exact: true }).fill("CDG");
  await page.getByRole("option").filter({ hasText: "CDG" }).first().click();
  await page.getByLabel("To", { exact: true }).fill("JFK");
  await page.getByRole("option").filter({ hasText: "JFK" }).first().click();
  await page.getByRole("button", { name: "Add trip" }).click();
  await expect(page.locator(".travel-totals")).toContainText("1 trip");

  // Edit it → the form enters edit mode.
  await page.getByRole("button", { name: /Edit trip/ }).click();
  await expect(page.getByRole("button", { name: "Save changes" })).toBeVisible();
  await page.getByLabel(/^Date/).fill("2024-05-01");
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByText(/Updated CDG → JFK/)).toBeVisible();
  await expect(page.locator(".travel-totals")).toContainText("1 trip"); // still one, not a duplicate
  await expect(page.getByText(/May 1, 2024/)).toBeVisible(); // the new date shows on the row
});
