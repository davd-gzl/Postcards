import { test, expect } from "@playwright/test";

// The global config seeds "intro seen" so the welcome modal never blocks other
// tests. Opt OUT of that seed here to exercise the real first-run intro.
test.use({ storageState: { cookies: [], origins: [] } });

test("first run auto-opens the welcome intro (incl. optional downloads), once", async ({ page }) => {
  await page.goto("/");

  // The intro opens by itself and explains what the app is + what's downloadable.
  // "Optional downloads" text lives only in this modal, so it's a clean signal.
  await expect(page.getByText(/Optional downloads/i)).toBeVisible();

  // Dismissing it closes it…
  await page.getByRole("button", { name: /Got it/i }).click();
  await expect(page.getByText(/Optional downloads/i)).toHaveCount(0);

  // …and it never comes back (the choice is remembered).
  await page.reload();
  await expect(page.getByText(/Optional downloads/i)).toHaveCount(0);
});
