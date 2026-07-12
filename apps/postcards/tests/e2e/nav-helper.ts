import { type Page } from "@playwright/test";

// Passport and Moments are views inside the Places screen now; every other
// section is a direct button in the bar (the "More" sheet is gone).
const PLACES_VIEWS = new Set(["Passport", "Moments"]);

/** Navigate to a section by name, going through Places for its inner views. */
export async function gotoTab(page: Page, name: string): Promise<void> {
  if (PLACES_VIEWS.has(name)) {
    await page.getByRole("button", { name: "Places", exact: true }).click();
    // The Places view switcher carries the view name.
    await page.getByRole("button", { name, exact: true }).click();
  } else {
    await page.getByRole("button", { name, exact: true }).click();
  }
}
