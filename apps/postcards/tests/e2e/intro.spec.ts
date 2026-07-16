import { test, expect } from "@playwright/test";

// The global config seeds "intro seen" so the welcome page never blocks other
// tests. Opt OUT of that seed here to exercise the real first-run intro.
test.use({ storageState: { cookies: [], origins: [] } });

test("first run shows the intro page (skippable, once)", async ({ page }) => {
  await page.goto("/");

  // The intro page auto-opens with its optional-download buttons and a Skip.
  const skip = page.getByRole("button", { name: "Skip" });
  await expect(skip).toBeVisible();
  await expect(page.getByRole("button", { name: /Get started/ })).toBeVisible();

  // Skipping closes it…
  await skip.click();
  await expect(page.getByRole("button", { name: "Skip" })).toHaveCount(0);

  // …and it never comes back (the choice is remembered).
  await page.reload();
  await expect(page.getByRole("button", { name: "Skip" })).toHaveCount(0);
});
