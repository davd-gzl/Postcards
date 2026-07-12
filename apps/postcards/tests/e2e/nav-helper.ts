import { type Page } from "@playwright/test";

// Secondary sections now live behind the bottom bar's "More" button.
const OVERFLOW = new Set(["Stats", "Trips", "Moments"]);

/** Navigate to a section by name, opening the "More" sheet first when needed. */
export async function gotoTab(page: Page, name: string): Promise<void> {
  if (OVERFLOW.has(name)) {
    await page.getByRole("button", { name: "More sections" }).click();
    // The sheet's buttons carry the section name; open it, then click.
    await page.getByRole("button", { name, exact: true }).click();
  } else {
    await page.getByRole("button", { name, exact: true }).click();
  }
}
