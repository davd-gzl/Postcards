import { test, expect } from "@playwright/test";

// A places CSV (the app's own export shape) imports by MERGING — it adds places
// and never erases what you already have. No confirm dialog on this path.
const CSV = [
  "lat;lon;country;city;been",
  '35.6895;139.69171;"jp";"Tokyo";"been"',
  '39.9075;116.39723;"cn";"Beijing";"want"',
  '48.85341;2.3488;"fr";"Paris";"been,fave"',
].join("\n");

test("import a places CSV — merges without erasing, no confirm", async ({ page }) => {
  // Any confirm() would mean this path treated the merge as destructive.
  page.on("dialog", (d) => {
    throw new Error(`Unexpected dialog on CSV import: ${d.message()}`);
  });
  await page.goto("/");

  // Seed one existing visit that the CSV does NOT mention — it must survive.
  await page.getByLabel("Search a city or country").fill("Lisbon");
  await page.getByRole("button", { name: "Mark Lisbon visited" }).first().click();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Settings" }).click();
  await page.locator('input[type="file"]').first().setInputFiles({
    name: "places_export.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(CSV),
  });
  await expect(page.locator(".notice-ok")).toContainText(/Added 3 places/);

  // The imported places show up, and the pre-existing one is untouched.
  await page.getByRole("button", { name: "Places", exact: true }).click();
  await expect(page.getByText("Tokyo", { exact: true })).toBeVisible();
  await expect(page.getByText("Lisbon", { exact: true })).toBeVisible(); // not erased

  // Beijing was tagged "want" → it lands on the Wishlist, not Visited.
  await page.getByRole("button", { name: /Wishlist/ }).click();
  await expect(page.getByText("Beijing", { exact: true })).toBeVisible();
});
